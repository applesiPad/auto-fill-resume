// Background service worker — Edge & Chrome compatible
const api = globalThis.browser || globalThis.chrome;

api.runtime.onInstalled.addListener(() => {
  console.log(`Resume Auto Filler v${api.runtime.getManifest().version} installed`);
});

// Keyboard shortcut: Alt+Shift+F to fill current page
api.commands.onCommand.addListener(async (command) => {
  if (command !== 'fill-form') return;

  const [tab] = await api.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  const { resumeData } = await api.storage.local.get('resumeData');
  if (!resumeData || Object.keys(resumeData).length === 0) return;

  try {
    await api.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ['content/value-i18n.js', 'content/matchers.js', 'content/adapters.js', 'content/primitives.js', 'content/content.js']
    });
  } catch (e) {}

  api.tabs.sendMessage(tab.id, { action: 'fillForm', data: resumeData });
});

// ============ LLM message bridge ============

api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'llmMapFields') {
    llmMapFields(msg).then(r => sendResponse(r)).catch(() => sendResponse({ mappings: [] }));
    return true;
  }
  if (msg.action === 'llmDraftAnswer') {
    llmDraftAnswer(msg).then(r => sendResponse(r)).catch(() => sendResponse({ answer: '' }));
    return true;
  }
});
// ============ L2: Semantic field mapping via LLM ============
// Content script serializes unmatched form fields (labels/options only —
// never user values); we map them onto the closed set of profile keys and
// cache by form signature so each distinct form costs one call, ever.

const LLM_URLS = {
  deepseek: 'https://api.deepseek.com/v1/chat/completions',
  kimi: 'https://api.moonshot.cn/v1/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  glm: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  siliconflow: 'https://api.siliconflow.cn/v1/chat/completions',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};
const LLM_MODELS = {
  deepseek: 'deepseek-chat', kimi: 'moonshot-v1-8k', qwen: 'qwen-turbo',
  glm: 'glm-4-flash', siliconflow: 'Qwen/Qwen2.5-7B-Instruct',
  doubao: 'doubao-lite-32k', openai: 'gpt-4o-mini',
};

async function callLLM(settings, messages, { maxTokens = 800, temperature = 0 } = {}) {
  const provider = settings.provider || 'deepseek';
  const url = LLM_URLS[provider] || settings.customUrl;
  if (!url) return null;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${settings.apiKey}` },
    body: JSON.stringify({
      model: settings.model || LLM_MODELS[provider] || 'deepseek-chat',
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';
  const start = text.indexOf('{'), end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try { return JSON.parse(text.substring(start, end + 1)); } catch (e) { return null; }
}

// Simple stable string hash (djb2) for form signatures
function hashString(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

function formSignature(host, fields) {
  const parts = fields
    .map(f => `${f.tag}:${f.type}:${f.name}:${f.id}:${f.label}`)
    .sort();
  return hashString(host + '|' + parts.join('|'));
}

const LLM_CACHE_KEY = 'rfLLMCache';
const LLM_CACHE_MAX = 300;

async function getLLMCache() {
  const r = await api.storage.local.get(LLM_CACHE_KEY);
  return (r && r[LLM_CACHE_KEY]) || {};
}

async function putLLMCacheEntry(sig, mappings) {
  const cache = await getLLMCache();
  cache[sig] = { mappings, ts: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > LLM_CACHE_MAX) {
    keys.sort((a, b) => (cache[a].ts || 0) - (cache[b].ts || 0));
    keys.slice(0, keys.length - LLM_CACHE_MAX).forEach(k => delete cache[k]);
  }
  await api.storage.local.set({ [LLM_CACHE_KEY]: cache });
}

const FIELD_MAP_SYSTEM_PROMPT = `你是求职网申表单的字段语义分析引擎。给你一批表单控件的结构信息(label文本、name/id、候选选项、所属分区),以及一份简历档案可用的字段清单。请判断每个控件应该填入简历中的哪个字段。

规则:
1. 只输出你确定语义的映射;不确定就跳过,宁缺毋滥
2. key 必须严格从字段清单中选择,禁止编造
3. 忽略:验证码、搜索框、登录信息、与个人简历无关的企业自定义问题
4. 注意中文体制内表达示例:"政治面貌"→politicalStatus,"籍贯"→hometown,"户口"→hukou,"本人成分/生源"等无法对应时跳过
5. 下拉框若有选项,可借助选项语义辅助判断(如选项为"群众/党员"说明是政治面貌)
6. conf 为置信度 0~1 的小数

只返回 JSON,格式:{"mappings":[{"i":0,"key":"name","conf":0.95}]},无匹配返回 {"mappings":[]}`;

async function llmMapFields(msg) {
  const { llmSettings } = await api.storage.local.get('llmSettings');
  if (!llmSettings || !llmSettings.apiKey || llmSettings.smartFill === false) {
    return { mappings: [] };
  }
  const fields = (msg.fields || []).slice(0, 60);
  if (fields.length === 0) return { mappings: [] };
  const validKeys = new Set(Object.keys(msg.keyLabels || {}));

  const sig = formSignature(msg.host || '', fields);
  const cache = await getLLMCache();
  if (cache[sig] && Date.now() - (cache[sig].ts || 0) < 30 * 24 * 3600 * 1000) {
    return { mappings: cache[sig].mappings, cached: true };
  }

  const keyList = Object.entries(msg.keyLabels || {})
    .map(([k, v]) => `${k}(${v})`).join('、');
  const userPrompt =
    `## 简历字段清单\n${keyList}\n\n## 表单控件列表(JSON,i为编号)\n` +
    JSON.stringify(fields) +
    `\n\n## 任务\n返回映射 JSON。`;

  const data = await callLLM(llmSettings, [
    { role: 'system', content: FIELD_MAP_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt },
  ], { maxTokens: 1000 });
  if (!data || !Array.isArray(data.mappings)) return { mappings: [] };

  // Whitelist + sanitize
  const mappings = data.mappings
    .filter(m => m && typeof m.i === 'number' && fields[m.i] && validKeys.has(m.key))
    .map(m => ({ i: m.i, key: m.key, conf: typeof m.conf === 'number' ? m.conf : 0.7 }));

  await putLLMCacheEntry(sig, mappings);
  return { mappings };
}

// ============ L2+: AI-drafted answers for open-ended questions ============
// Only runs when the user explicitly opted in (llmSettings.aiDraft). Sends
// the question text plus an intentional summary (意向/技能/自我评价).
async function llmDraftAnswer(msg) {
  const { llmSettings } = await api.storage.local.get('llmSettings');
  if (!llmSettings || !llmSettings.apiKey || !llmSettings.aiDraft) return { answer: '' };
  const p = msg.profile || {};
  const prompt = `你是求职者本人,正在填写求职网申的开放题。请以第一人称写一段真诚、具体、不喊口号的回答,120~250字,不要编造经历。

问题:${msg.question || '(未提供)'}

求职者信息(可参考,不要逐句照搬):
- 求职意向:${p.expectedJob || '未填写'}
- 技能特长:${p.skills || '未填写'}
- 自我评价:${p.selfEvaluation || '未填写'}
- 工作年限:${p.workYears || '未填写'}

只返回 JSON:{"answer":"回答全文"}`;

  const data = await callLLM(llmSettings, [{ role: 'user', content: prompt }], { maxTokens: 600 });
  return { answer: (data && data.answer) || '' };
}
