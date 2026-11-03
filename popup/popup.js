// Chrome/Edge API compatibility
const api = globalThis.browser || globalThis.chrome;

// HTML escape utility
function esc(s) { const d = document.createElement('div'); d.textContent = s || ''; return d.innerHTML; }

// ============ Tab Switching ============
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});

// ============ Dynamic Entry Templates ============

const EDU_TEMPLATE = (idx) => `
  <div class="entry-card" data-entry-type="education" data-entry-index="${idx}">
    <div class="entry-card-header">
      <span class="entry-card-title"><span class="entry-card-num">${idx + 1}</span> 教育经历</span>
      <button class="btn-remove-entry" title="删除">&times;</button>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>学校</label>
        <input type="text" data-efield="school" placeholder="学校全称">
      </div>
      <div class="form-group">
        <label>学历</label>
        <select data-efield="degree">
          <option value="">请选择</option>
          <option value="高中">高中</option><option value="中专">中专</option>
          <option value="大专">大专</option><option value="本科">本科</option>
          <option value="硕士">硕士</option><option value="博士">博士</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>专业</label><input type="text" data-efield="major" placeholder="专业名称"></div>
      <div class="form-group form-sm"><label>GPA</label><input type="text" data-efield="gpa" placeholder="3.8/4.0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>入学时间</label><input type="month" data-efield="startDate"></div>
      <div class="form-group"><label>毕业时间</label>
        <div class="date-with-present">
          <input type="month" data-efield="endDate" class="date-input">
          <label class="present-check"><input type="checkbox" data-present="endDate" class="chk-present"><span>至今</span></label>
        </div>
      </div>
    </div>
    <div class="form-group"><label>在校经历</label><textarea data-efield="description" rows="2" placeholder="奖学金、社团、项目等"></textarea></div>
  </div>`;

const WORK_TEMPLATE = (idx) => `
  <div class="entry-card" data-entry-type="work" data-entry-index="${idx}">
    <div class="entry-card-header">
      <div class="entry-card-title"><span class="entry-card-num">${idx + 1}</span> 工作/实习经历</div>
      <div style="display:flex;align-items:center;gap:4px">
        <select data-efield="workType" class="entry-card-type" style="border:none;font-size:10px;padding:2px 6px;border-radius:4px;cursor:pointer;font-family:inherit">
          <option value="全职" class="entry-type-fulltime">全职</option>
          <option value="实习" class="entry-type-intern">实习</option>
          <option value="兼职">兼职</option>
        </select>
        <button class="btn-remove-entry" title="删除">&times;</button>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>公司</label><input type="text" data-efield="company" placeholder="公司名称"></div>
      <div class="form-group"><label>职位</label><input type="text" data-efield="jobTitle" placeholder="岗位名称"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>入职时间</label><input type="month" data-efield="startDate"></div>
      <div class="form-group"><label>离职时间</label>
        <div class="date-with-present">
          <input type="month" data-efield="endDate" class="date-input">
          <label class="present-check"><input type="checkbox" data-present="endDate" class="chk-present"><span>至今</span></label>
        </div>
      </div>
    </div>
    <div class="form-group"><label>工作描述</label><textarea data-efield="description" rows="3" placeholder="主要职责与成就"></textarea></div>
  </div>`;

const PROJECT_TEMPLATE = (idx) => `
  <div class="entry-card" data-entry-type="project" data-entry-index="${idx}">
    <div class="entry-card-header">
      <span class="entry-card-title"><span class="entry-card-num">${idx + 1}</span> 项目经历</span>
      <button class="btn-remove-entry" title="删除">&times;</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label>项目名称</label><input type="text" data-efield="projectName" placeholder="项目名称"></div>
      <div class="form-group"><label>担任角色</label><input type="text" data-efield="role" placeholder="如：前端负责人"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>开始时间</label><input type="month" data-efield="startDate"></div>
      <div class="form-group"><label>结束时间</label>
        <div class="date-with-present">
          <input type="month" data-efield="endDate" class="date-input">
          <label class="present-check"><input type="checkbox" data-present="endDate" class="chk-present"><span>至今</span></label>
        </div>
      </div>
    </div>
    <div class="form-group"><label>项目描述</label><textarea data-efield="description" rows="3" placeholder="项目背景、技术栈、成果"></textarea></div>
    <div class="form-group"><label>项目链接</label><input type="url" data-efield="link" placeholder="https://"></div>
  </div>`;

const COMPETITION_TEMPLATE = (idx) => `
  <div class="entry-card" data-entry-type="competition" data-entry-index="${idx}">
    <div class="entry-card-header">
      <span class="entry-card-title"><span class="entry-card-num">${idx + 1}</span> 竞赛/荣誉</span>
      <button class="btn-remove-entry" title="删除">&times;</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label>竞赛/荣誉名称</label><input type="text" data-efield="competitionName" placeholder="如：ACM区域赛金奖"></div>
      <div class="form-group">
        <label>获奖等级</label>
        <select data-efield="awardLevel">
          <option value="">请选择</option>
          <option value="国家级">国家级</option><option value="省级">省级</option>
          <option value="市级">市级</option><option value="区级">区级</option>
          <option value="校级">校级</option><option value="院级">院级</option>
          <option value="一等奖">一等奖</option><option value="二等奖">二等奖</option>
          <option value="三等奖">三等奖</option><option value="金奖">金奖</option>
          <option value="银奖">银奖</option><option value="铜奖">铜奖</option>
          <option value="优秀奖">优秀奖</option><option value="特等奖">特等奖</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>获奖时间</label><input type="month" data-efield="awardDate"></div>
      <div class="form-group"><label>颁发机构</label><input type="text" data-efield="issuer" placeholder="如：中国计算机学会"></div>
    </div>
    <div class="form-group"><label>描述</label><textarea data-efield="description" rows="2" placeholder="竞赛内容、个人贡献等"></textarea></div>
  </div>`;

const CERT_TEMPLATE = (idx) => `
  <div class="entry-card" data-entry-type="cert" data-entry-index="${idx}">
    <div class="entry-card-header">
      <span class="entry-card-title"><span class="entry-card-num">${idx + 1}</span> 证书/资质</span>
      <button class="btn-remove-entry" title="删除">&times;</button>
    </div>
    <div class="form-row">
      <div class="form-group"><label>证书名称</label><input type="text" data-efield="certName" placeholder="如：软件设计师、驾照C1"></div>
      <div class="form-group"><label>获取时间</label><input type="month" data-efield="certDate"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>颁发机构</label><input type="text" data-efield="certIssuer" placeholder="如：工信部"></div>
      <div class="form-group"><label>证书编号</label><input type="text" data-efield="certNo" placeholder="选填"></div>
    </div>
  </div>`;

// ============ Entry Management ============
function addEntry(listId, template) {
  const list = document.getElementById(listId);
  const count = list.children.length;
  const div = document.createElement('div');
  div.innerHTML = template(count);
  const card = div.firstElementChild;
  list.appendChild(card);

  card.querySelector('.btn-remove-entry').addEventListener('click', () => {
    card.style.animation = 'fadeOut 0.2s ease';
    setTimeout(() => {
      card.remove();
      renumberEntries(listId);
    }, 200);
  });

  // "至今" checkbox toggle
  card.querySelectorAll('.chk-present').forEach(chk => {
    chk.addEventListener('change', () => {
      const dateInput = chk.closest('.date-with-present').querySelector('.date-input');
      if (chk.checked) {
        dateInput.classList.add('is-present');
        dateInput.value = '';
      } else {
        dateInput.classList.remove('is-present');
      }
    });
  });

  // Auto-scroll to new card
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  return card;
}

function renumberEntries(listId) {
  const list = document.getElementById(listId);
  Array.from(list.children).forEach((card, i) => {
    card.dataset.entryIndex = i;
    const num = card.querySelector('.entry-card-num');
    if (num) num.textContent = i + 1;
  });
}

document.getElementById('addEdu').addEventListener('click', () => addEntry('eduList', EDU_TEMPLATE));
document.getElementById('addWork').addEventListener('click', () => addEntry('workList', WORK_TEMPLATE));
document.getElementById('addProject').addEventListener('click', () => addEntry('projectList', PROJECT_TEMPLATE));
document.getElementById('addCompetition').addEventListener('click', () => addEntry('competitionList', COMPETITION_TEMPLATE));
document.getElementById('addCert').addEventListener('click', () => addEntry('certList', CERT_TEMPLATE));

// Add fadeOut animation
const style = document.createElement('style');
style.textContent = '@keyframes fadeOut { to { opacity:0; transform:translateY(-8px); } }';
document.head.appendChild(style);

// ============ Data Collection & Loading ============
function collectEntryFromCard(card) {
  const entry = {};
  card.querySelectorAll('[data-efield]').forEach(el => {
    const val = el.value.trim();
    if (val) entry[el.dataset.efield] = val;
  });
  // "至今" checkbox overrides endDate
  const presentChk = card.querySelector('.chk-present');
  if (presentChk && presentChk.checked) entry.endDate = '至今';
  return entry;
}

function collectData() {
  const data = {};

  // Basic fields (data-field)
  document.querySelectorAll('[data-field]').forEach(el => {
    const val = el.value.trim();
    if (val) data[el.dataset.field] = val;
  });

  const listMap = {
    educations: 'eduList', works: 'workList', projects: 'projectList',
    competitions: 'competitionList', certificates: 'certList',
  };
  for (const [key, listId] of Object.entries(listMap)) {
    data[key] = [];
    document.querySelectorAll(`#${listId} .entry-card`).forEach(card => {
      const entry = collectEntryFromCard(card);
      if (Object.keys(entry).length > 0) data[key].push(entry);
    });
  }

  return data;
}

function loadData(data) {
  // Basic fields
  document.querySelectorAll('[data-field]').forEach(el => {
    const val = data[el.dataset.field];
    if (val) {
      el.value = val;
      el.classList.add('has-value');
    } else {
      el.value = '';
      el.classList.remove('has-value');
    }
  });

  // Helper: load entries into a list with "至今" support
  function loadEntries(listId, template, entries) {
    document.getElementById(listId).innerHTML = '';
    if (!entries || entries.length === 0) return;
    entries.forEach(entry => {
      const card = addEntry(listId, template);
      card.querySelectorAll('[data-efield]').forEach(el => {
        const field = el.dataset.efield;
        const val = entry[field];
        if (field === 'endDate' && val === '至今') {
          // Check the "至今" checkbox instead of setting date value
          const chk = card.querySelector('.chk-present');
          if (chk) {
            chk.checked = true;
            el.classList.add('is-present');
          }
        } else if (val) {
          el.value = val;
        }
      });
    });
  }

  loadEntries('eduList', EDU_TEMPLATE, data.educations);
  loadEntries('workList', WORK_TEMPLATE, data.works);
  loadEntries('projectList', PROJECT_TEMPLATE, data.projects);
  loadEntries('competitionList', COMPETITION_TEMPLATE, data.competitions);
  loadEntries('certList', CERT_TEMPLATE, data.certificates);
}

// ============ ID Card → Birthday/Gender Inference ============
function parseIdCard(idCard) {
  if (!idCard || idCard.length !== 18) return null;
  const info = {};
  // Birthday: positions 6-13 (YYYYMMDD)
  const y = idCard.substring(6, 10), m = idCard.substring(10, 12), d = idCard.substring(12, 14);
  if (+y >= 1900 && +y <= 2100 && +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
    info.birthday = `${y}-${m}-${d}`;
  }
  // Gender: position 16 (odd=male, even=female)
  const genderCode = parseInt(idCard.charAt(16), 10);
  if (!isNaN(genderCode)) info.gender = genderCode % 2 === 1 ? '男' : '女';
  // Province from first 2 digits
  const provinceMap = {
    '11':'北京','12':'天津','13':'河北','14':'山西','15':'内蒙古',
    '21':'辽宁','22':'吉林','23':'黑龙江','31':'上海','32':'江苏',
    '33':'浙江','34':'安徽','35':'福建','36':'江西','37':'山东',
    '41':'河南','42':'湖北','43':'湖南','44':'广东','45':'广西',
    '46':'海南','50':'重庆','51':'四川','52':'贵州','53':'云南',
    '54':'西藏','61':'陕西','62':'甘肃','63':'青海','64':'宁夏','65':'新疆',
    '71':'台湾','81':'香港','82':'澳门',
  };
  const prov = provinceMap[idCard.substring(0, 2)];
  if (prov) info.province = prov;
  return info;
}

// Listen for ID card input and auto-fill birthday/gender
const idCardInput = document.querySelector('[data-field="idCard"]');
if (idCardInput) {
  idCardInput.addEventListener('input', () => {
    const val = idCardInput.value.trim();
    if (val.length === 18) {
      const info = parseIdCard(val);
      if (!info) return;
      const bdField = document.querySelector('[data-field="birthday"]');
      const genderField = document.querySelector('[data-field="gender"]');
      const hometownField = document.querySelector('[data-field="hometown"]');
      const hukouField = document.querySelector('[data-field="hukou"]');
      if (info.birthday && bdField && !bdField.value) {
        bdField.value = info.birthday;
        bdField.classList.add('has-value');
        bdField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (info.gender && genderField && !genderField.value) {
        genderField.value = info.gender;
        genderField.classList.add('has-value');
        genderField.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (info.province) {
        if (hometownField && !hometownField.value) {
          hometownField.value = info.province;
          hometownField.classList.add('has-value');
        }
        if (hukouField && !hukouField.value) {
          hukouField.value = info.province;
          hukouField.classList.add('has-value');
        }
      }
    }
  });
}

// Auto-detect filled fields + auto-save with debounce
let autoSaveTimer = null;
document.addEventListener('input', (e) => {
  if (e.target.dataset && (e.target.dataset.field || e.target.dataset.efield)) {
    e.target.classList.toggle('has-value', e.target.value.trim() !== '');
    // Auto-save after 1.5s of no typing
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      api.storage.local.set({ resumeData: collectData() });
    }, 1500);
  }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset && (e.target.dataset.field || e.target.dataset.efield)) {
    e.target.classList.toggle('has-value', e.target.value.trim() !== '');
    api.storage.local.set({ resumeData: collectData() });
  }
});

// Load saved data
api.storage.local.get('resumeData', (result) => {
  if (result.resumeData) loadData(result.resumeData);
});

// ============ Toast ============
let toastTimer = null;
function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type}`;
  void toast.offsetWidth;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 2200);
}

// ============ Save ============
document.getElementById('btnSave').addEventListener('click', () => {
  const data = collectData();
  api.storage.local.set({ resumeData: data }, () => showToast('信息已保存'));
});

// ============ Scan ============
document.getElementById('btnScan').addEventListener('click', async () => {
  const btn = document.getElementById('btnScan');
  btn.classList.add('loading');
  const done = () => btn.classList.remove('loading');
  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab) { done(); showToast('无法获取标签页', 'error'); return; }
    try { await api.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content/value-i18n.js', 'content/matchers.js', 'content/adapters.js', 'content/primitives.js', 'content/content.js'] }); } catch(e) {}
    api.tabs.sendMessage(tab.id, { action: 'scanForm' }, (response) => {
      done();
      if (api.runtime.lastError || !response) { showToast('扫描失败，请刷新页面后重试', 'error'); return; }
      const panel = document.getElementById('scanResult');
      const count = document.getElementById('scanCount');
      const list = document.getElementById('scanList');
      if (response.fields && response.fields.length > 0) {
        count.textContent = response.fields.length;
        list.innerHTML = response.fields.map(f => {
          return `<span class="scan-tag ${f.matched ? '' : 'unmatched'}" title="${esc(f.identifier)}">${esc(f.label)}</span>`;
        }).join('');
        panel.classList.remove('hidden');
      } else {
        showToast('未检测到表单字段', 'info');
      }
    });
  } catch (err) { done(); showToast('扫描失败', 'error'); }
});
document.getElementById('closeScan').addEventListener('click', () => {
  document.getElementById('scanResult').classList.add('hidden');
});

// ============ Fill ============
document.getElementById('btnFill').addEventListener('click', async () => {
  const data = collectData();
  const arrayKeys = ['educations','works','projects','competitions','certificates'];
  const hasBasicData = Object.keys(data).some(k => !arrayKeys.includes(k));
  const hasEntries = arrayKeys.some(k => data[k]?.length > 0);
  if (!hasBasicData && !hasEntries) { showToast('请先填写个人信息', 'error'); return; }

  const btn = document.getElementById('btnFill');
  btn.classList.add('loading');
  const done = () => btn.classList.remove('loading');
  api.storage.local.set({ resumeData: data });

  try {
    const [tab] = await api.tabs.query({ active: true, currentWindow: true });
    if (!tab) { done(); showToast('无法获取标签页', 'error'); return; }
    try { await api.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content/value-i18n.js', 'content/matchers.js', 'content/adapters.js', 'content/primitives.js', 'content/content.js'] }); } catch(e) {}

    api.tabs.sendMessage(tab.id, { action: 'fillForm', data }, (response) => {
      done();
      if (api.runtime.lastError) { showToast('填写失败，请刷新页面后重试', 'error'); return; }
      if (response && response.success) {
        showToast(`已填写 ${response.filledCount} 个字段`, 'success');
      } else {
        showToast('未找到匹配字段', 'info');
      }
    });
  } catch (err) { done(); showToast('填写失败', 'error'); }
});

// ============ Clear ============
document.getElementById('btnClear').addEventListener('click', () => {
  if (!confirm('确定清除所有数据？')) return;
  api.storage.local.remove('resumeData', () => {
    document.querySelectorAll('[data-field]').forEach(el => { el.value = ''; el.classList.remove('has-value'); });
    ['eduList', 'workList', 'projectList', 'competitionList', 'certList'].forEach(id => document.getElementById(id).innerHTML = '');
    showToast('数据已清除');
  });
});

// ============ Import / Export ============
document.getElementById('btnExport').addEventListener('click', () => {
  const data = collectData();
  if (Object.keys(data).length === 0) { showToast('暂无数据', 'info'); return; }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resume-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('数据已导出');
});

// ============ Smart Fill (L2 LLM mapping) toggle ============
function loadSmartFillToggle() {
  api.storage.local.get('llmSettings', (r) => {
    const s = r && r.llmSettings;
    // default ON — but meaningless until an API key is configured
    document.getElementById('smartFillToggle').checked = s ? s.smartFill !== false : true;
    document.getElementById('aiDraftToggle').checked = !!(s && s.aiDraft);
  });
}
document.getElementById('smartFillToggle').addEventListener('change', (e) => {
  api.storage.local.get('llmSettings', (r) => {
    const s = (r && r.llmSettings) || {};
    s.smartFill = e.target.checked;
    api.storage.local.set({ llmSettings: s });
    showToast(e.target.checked ? 'LLM 智能识别已开启' : 'LLM 智能识别已关闭(仅使用规则+已学习适配)');
  });
});
document.getElementById('aiDraftToggle').addEventListener('change', (e) => {
  api.storage.local.get('llmSettings', (r) => {
    const s = (r && r.llmSettings) || {};
    s.aiDraft = e.target.checked;
    api.storage.local.set({ llmSettings: s });
    showToast(e.target.checked ? 'AI 起草已开启(开放题将发送题目与意向摘要)' : 'AI 起草已关闭');
  });
});

// ============ Answer Bank (网申自定义题题库) ============
function renderAnswerBank(list) {
  const wrap = document.getElementById('answerBankList');
  if (!list.length) {
    wrap.innerHTML = '<p style="font-size:10px;color:var(--text-3)">暂无条目。示例:问题"是否服从调剂" 答案"是";问题"为什么选择我们公司" 答案(你的模板)。</p>';
    return;
  }
  wrap.innerHTML = '';
  list.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.style.cssText = 'gap:6px;align-items:flex-start;margin-bottom:6px';
    row.innerHTML = `
      <div class="form-group" style="flex:0 0 42%">
        <input type="text" placeholder="问题(如:是否服从调剂)" value="${esc(item.q)}" data-abq="${idx}">
      </div>
      <div class="form-group" style="flex:1">
        <textarea placeholder="标准答案" rows="2" data-aba="${idx}">${esc(item.a)}</textarea>
      </div>
      <button type="button" class="btn btn-outline btn-xs danger" data-abdel="${idx}" style="margin-top:18px">删</button>`;
    wrap.appendChild(row);
  });
}

function loadAnswerBank() {
  api.storage.local.get('answerBank', (r) => renderAnswerBank((r && r.answerBank) || []));
}

function saveAnswerBank(cb) {
  const items = [];
  document.querySelectorAll('[data-abq]').forEach(qInput => {
    const idx = qInput.getAttribute('data-abq');
    const aInput = document.querySelector(`[data-aba="${idx}"]`);
    const q = qInput.value.trim(), a = aInput ? aInput.value.trim() : '';
    if (q && a) items.push({ q, a });
  });
  api.storage.local.set({ answerBank: items }, () => cb && cb(items.length));
}

document.getElementById('btnAddAnswer').addEventListener('click', () => {
  saveAnswerBank(() => {
    api.storage.local.get('answerBank', (r) => {
      const list = (r && r.answerBank) || [];
      list.push({ q: '', a: '' });
      api.storage.local.set({ answerBank: list }, () => renderAnswerBank(list));
    });
  });
});
document.getElementById('answerBankList').addEventListener('change', () => saveAnswerBank());
document.getElementById('answerBankList').addEventListener('click', (e) => {
  const del = e.target.getAttribute && e.target.getAttribute('data-abdel');
  if (del === null || del === undefined) return;
  saveAnswerBank(() => {
    api.storage.local.get('answerBank', (r) => {
      const list = (r && r.answerBank) || [];
      list.splice(+del, 1);
      api.storage.local.set({ answerBank: list }, () => renderAnswerBank(list));
    });
  });
});

// ============ Attachments (证件照/身份证/简历) ============
function compressImage(file, maxDim = 800) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        let q = 0.85, out = canvas.toDataURL('image/jpeg', q);
        while (out.length * 0.75 > 200 * 1024 && q > 0.45) {
          q -= 0.15;
          out = canvas.toDataURL('image/jpeg', q);
        }
        resolve({ base64: out, mime: 'image/jpeg' });
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const ATT_KIND_NAMES = { photo: '证件照', idcard: '身份证', resume: '简历附件' };

function renderAttachments(list) {
  const wrap = document.getElementById('attList');
  if (!list.length) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = list.map((a, i) =>
    `<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--text-2);margin:4px 0">
      <span style="color:var(--primary)">●</span> ${esc(ATT_KIND_NAMES[a.kind] || a.kind)} · ${esc(a.name)} · ${(a.size / 1024).toFixed(0)}KB
      <button type="button" class="btn btn-outline btn-xs danger" data-attdel="${i}" style="margin-left:auto">删除</button>
    </div>`).join('');
}

function loadAttachments() {
  api.storage.local.get('attachments', (r) => renderAttachments((r && r.attachments) || []));
}

function upsertAttachment(kind, file) {
  const guard = 3 * 1024 * 1024;
  if (file.size > guard) { showToast('文件过大(>3MB),请先压缩', 'error'); return; }
  const finish = (base64, mime) => {
    api.storage.local.get('attachments', (r) => {
      const list = ((r && r.attachments) || []).filter(a => a.kind !== kind);
      list.push({ kind, name: file.name, base64, mime, size: Math.round(base64.length * 0.75) });
      api.storage.local.set({ attachments: list }, () => {
        renderAttachments(list);
        showToast(`${ATT_KIND_NAMES[kind]}已保存`);
      });
    });
  };
  if (/^image\//.test(file.type)) {
    compressImage(file).then(c => finish(c.base64, c.mime)).catch(() => showToast('图片处理失败', 'error'));
  } else {
    fileToBase64(file).then(b64 => finish(b64, file.type || 'application/octet-stream'));
  }
}

[['attPhoto', 'photo'], ['attIdcard', 'idcard'], ['attResume', 'resume']].forEach(([id, kind]) => {
  document.getElementById(id).addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (f) upsertAttachment(kind, f);
    e.target.value = '';
  });
});
document.getElementById('attList').addEventListener('click', (e) => {
  const del = e.target.getAttribute && e.target.getAttribute('data-attdel');
  if (del === null || del === undefined) return;
  api.storage.local.get('attachments', (r) => {
    const list = (r && r.attachments) || [];
    list.splice(+del, 1);
    api.storage.local.set({ attachments: list }, () => renderAttachments(list));
  });
});

// Settings button — open the resume modal (LLM settings live there)
document.getElementById('btnSettings').addEventListener('click', () => {
  document.getElementById('btnUploadResume').click();
});
// Open modal
document.getElementById('btnUploadResume').addEventListener('click', () => {
  document.getElementById('resumeModal').classList.remove('hidden');
  loadProfileList();
  // Load saved API settings
  api.storage.local.get('llmSettings', (result) => {
    if (result.llmSettings) {
      document.getElementById('llmProvider').value = result.llmSettings.provider || 'deepseek';
      document.getElementById('llmApiKey').value = result.llmSettings.apiKey || '';
      document.getElementById('llmModel').value = result.llmSettings.model || '';
      document.getElementById('llmCustomUrl').value = result.llmSettings.customUrl || '';
    }
    updateProviderHints();
  });
});

// Provider hints
function updateProviderHints() {
  const provider = document.getElementById('llmProvider').value;
  const config = typeof LLM_PROVIDERS !== 'undefined' ? LLM_PROVIDERS[provider] : null;
  const hintEl = document.getElementById('llmKeyHint');
  const linkEl = document.getElementById('llmKeyLink');
  const customGroup = document.getElementById('customUrlGroup');
  const modelInput = document.getElementById('llmModel');
  if (config) {
    hintEl.textContent = config.keyHint || '';
    if (config.keyUrl) { linkEl.href = config.keyUrl; linkEl.classList.remove('hidden'); }
    else { linkEl.classList.add('hidden'); }
    modelInput.placeholder = config.defaultModel ? '默认: ' + config.defaultModel : '';
  }
  customGroup.classList.toggle('hidden', provider !== 'custom');
}
document.getElementById('llmProvider').addEventListener('change', updateProviderHints);

// Test LLM API connection
document.getElementById('btnTestLLM').addEventListener('click', async () => {
  const resultEl = document.getElementById('llmTestResult');
  const apiKey = document.getElementById('llmApiKey').value.trim();
  const provider = document.getElementById('llmProvider').value;
  const model = document.getElementById('llmModel').value.trim();
  const customUrl = document.getElementById('llmCustomUrl').value.trim();

  if (!apiKey) {
    resultEl.innerHTML = '<span style="color:var(--danger)">请先填写 API Key</span>';
    return;
  }

  resultEl.innerHTML = '<span style="color:#91959a">测试中...</span>';

  try {
    const config = typeof LLM_PROVIDERS !== 'undefined' ? LLM_PROVIDERS[provider] : null;
    const useModel = model || (config ? config.defaultModel : '');
    let url, headers, body;

    if (provider === 'claude') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' };
      body = JSON.stringify({ model: useModel || 'claude-haiku-4-5-20251001', max_tokens: 10, messages: [{ role: 'user', content: 'Hi' }] });
    } else {
      url = provider === 'custom' ? customUrl : (config ? config.baseUrl : '');
      if (!url) { resultEl.innerHTML = '<span style="color:var(--danger)">请填写 API 地址</span>'; return; }
      headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` };
      body = JSON.stringify({ model: useModel, messages: [{ role: 'user', content: 'Hi' }], max_tokens: 10 });
    }

    const resp = await fetch(url, { method: 'POST', headers, body });

    if (resp.ok) {
      const data = await resp.json();
      const modelUsed = data.model || data.choices?.[0]?.message?.role || useModel;
      resultEl.innerHTML = `<span style="color:var(--success)">✓ 连接成功${modelUsed ? '，模型: ' + modelUsed : ''}</span>`;
      // Save settings on success
      api.storage.local.set({ llmSettings: { provider, apiKey, model, customUrl } });
    } else {
      const err = await resp.json().catch(() => ({}));
      const msg = err.error?.message || err.msg || `HTTP ${resp.status}`;
      resultEl.innerHTML = `<span style="color:var(--danger)">✗ ${msg}</span>`;
    }
  } catch (e) {
    resultEl.innerHTML = `<span style="color:var(--danger)">✗ ${e.message}</span>`;
  }
});

// Close modal
document.getElementById('closeResumeModal').addEventListener('click', () => {
  document.getElementById('resumeModal').classList.add('hidden');
});
document.querySelector('.modal-backdrop').addEventListener('click', () => {
  document.getElementById('resumeModal').classList.add('hidden');
});

// Upload zone interactions
const uploadZone = document.getElementById('uploadZone');
const resumeFileInput = document.getElementById('resumeFile');

uploadZone.addEventListener('click', () => resumeFileInput.click());
uploadZone.addEventListener('dragover', (e) => { e.preventDefault(); uploadZone.classList.add('dragover'); });
uploadZone.addEventListener('dragleave', () => uploadZone.classList.remove('dragover'));
uploadZone.addEventListener('drop', (e) => {
  e.preventDefault();
  uploadZone.classList.remove('dragover');
  if (e.dataTransfer.files.length > 0) {
    resumeFileInput.files = e.dataTransfer.files;
    handleResumeFile(e.dataTransfer.files[0]);
  }
});
resumeFileInput.addEventListener('change', () => {
  if (resumeFileInput.files.length > 0) handleResumeFile(resumeFileInput.files[0]);
});

function handleResumeFile(file) {
  uploadZone.classList.add('has-file');
  uploadZone.querySelector('p').textContent = file.name;
  uploadZone.querySelector('.hint').textContent = `${(file.size / 1024).toFixed(1)} KB`;
}

// Parse button
document.getElementById('btnParseResume').addEventListener('click', async () => {
  // Get text: file or textarea
  let text = '';
  const file = resumeFileInput.files[0];
  const pastedText = document.getElementById('resumeText').value.trim();

  if (file) {
    try {
      document.getElementById('resumeStep1').classList.add('hidden');
      document.getElementById('resumeLoading').classList.remove('hidden');
      text = await extractTextFromFile(file);
    } catch (err) {
      document.getElementById('resumeLoading').classList.add('hidden');
      document.getElementById('resumeStep1').classList.remove('hidden');
      showToast(err.message, 'error');
      return;
    }
  } else if (pastedText) {
    text = pastedText;
  } else {
    showToast('请上传简历文件或粘贴简历文本', 'error');
    return;
  }

  if (text.length < 30) {
    document.getElementById('resumeLoading').classList.add('hidden');
    document.getElementById('resumeStep1').classList.remove('hidden');
    showToast('简历内容太少，请检查文件', 'error');
    return;
  }

  // Show loading
  document.getElementById('resumeStep1').classList.add('hidden');
  document.getElementById('resumeLoading').classList.remove('hidden');

  try {
    if (parseMode === 'local') {
      parsedResumeData = parseResumeLocal(text);
      document.getElementById('resumeLoading').querySelector('p').textContent = '解析完成';
      renderParsePreview(parsedResumeData);
      document.getElementById('resumeLoading').classList.add('hidden');
      document.getElementById('resumeStep2').classList.remove('hidden');
    } else {
      // AI parsing — requires API key
      const apiKey = document.getElementById('llmApiKey').value.trim();
      const provider = document.getElementById('llmProvider').value;
      const model = document.getElementById('llmModel').value.trim();
      const customUrl = document.getElementById('llmCustomUrl').value.trim();
      if (!apiKey) {
        document.getElementById('resumeLoading').classList.add('hidden');
        document.getElementById('resumeStep1').classList.remove('hidden');
        showToast('AI 模式需要填写 API Key', 'error');
        return;
      }
      if (provider === 'custom' && !customUrl) {
        document.getElementById('resumeLoading').classList.add('hidden');
        document.getElementById('resumeStep1').classList.remove('hidden');
        showToast('自定义模式需要填写 API 地址', 'error');
        return;
      }
      api.storage.local.set({ llmSettings: { provider, apiKey, model, customUrl } });

      // Run local parse first (instant), then AI parse
      document.getElementById('resumeLoading').querySelector('p').textContent = '本地预解析中...';
      const localData = parseResumeLocal(text);
      document.getElementById('resumeLoading').querySelector('p').textContent = 'AI 解析中...';
      const aiData = await parseResumeWithLLM(text, apiKey, provider, model, customUrl);

      // Smart merge: basic fields auto-merge, entries compare if different
      const { merged, conflicts } = smartMergeResume(localData, aiData);
      parsedResumeData = merged;
      _compareLocalData = localData;
      _compareAiData = aiData;

      document.getElementById('resumeLoading').classList.add('hidden');
      if (conflicts.length > 0) {
        renderConflictCompare(conflicts, localData, aiData, merged);
        document.getElementById('resumeStepCompare').classList.remove('hidden');
      } else {
        renderParsePreview(parsedResumeData);
        document.getElementById('resumeStep2').classList.remove('hidden');
      }
    }
  } catch (err) {
    document.getElementById('resumeLoading').classList.add('hidden');
    document.getElementById('resumeStep1').classList.remove('hidden');
    showToast('解析失败: ' + err.message, 'error');
  }
});

let _compareLocalData = null, _compareAiData = null;

// Back button
document.getElementById('btnParseBack').addEventListener('click', () => {
  document.getElementById('resumeStep2').classList.add('hidden');
  document.getElementById('resumeStep1').classList.remove('hidden');
});

// Confirm button - fill data + optionally save as profile
document.getElementById('btnParseConfirm').addEventListener('click', () => {
  if (!parsedResumeData) return;
  loadData(parsedResumeData);
  api.storage.local.set({ resumeData: collectData() });

  // Save as profile if checked
  const saveProfile = document.getElementById('chkSaveProfile').checked;
  if (saveProfile) {
    const profileName = document.getElementById('profileName').value.trim() ||
      (parsedResumeData.name ? `${parsedResumeData.name}的简历` : `简历 ${new Date().toLocaleDateString('zh-CN')}`);
    saveResumeProfile(profileName, parsedResumeData);
  }

  document.getElementById('resumeModal').classList.add('hidden');
  document.getElementById('resumeStep2').classList.add('hidden');
  document.getElementById('resumeStep1').classList.remove('hidden');
  showToast('简历数据已填入', 'success');
});

// ============ Resume Profiles ============
function saveResumeProfile(name, data) {
  api.storage.local.get('resumeProfiles', (result) => {
    const profiles = result.resumeProfiles || [];
    // Deduplicate by name — overwrite if same name exists
    const idx = profiles.findIndex(p => p.name === name);
    const entry = { name, data, savedAt: Date.now() };
    if (idx >= 0) profiles[idx] = entry;
    else profiles.unshift(entry);
    // Keep max 10 profiles
    if (profiles.length > 10) profiles.length = 10;
    api.storage.local.set({ resumeProfiles: profiles }, () => {
      renderProfileSelect(profiles);
    });
  });
}

function renderProfileSelect(profiles) {
  const sel = document.getElementById('profileSelect');
  sel.innerHTML = '<option value="">-- 选择已保存的简历 --</option>';
  (profiles || []).forEach((p, i) => {
    const date = new Date(p.savedAt).toLocaleDateString('zh-CN');
    sel.innerHTML += `<option value="${i}">${esc(p.name)} (${date})</option>`;
  });
}

// Load profiles on modal open
function loadProfileList() {
  api.storage.local.get('resumeProfiles', (result) => {
    renderProfileSelect(result.resumeProfiles || []);
  });
}

// Load profile button
document.getElementById('btnLoadProfile').addEventListener('click', () => {
  const sel = document.getElementById('profileSelect');
  const idx = parseInt(sel.value);
  if (isNaN(idx)) { showToast('请先选择一份简历', 'error'); return; }
  api.storage.local.get('resumeProfiles', (result) => {
    const profiles = result.resumeProfiles || [];
    if (!profiles[idx]) return;
    parsedResumeData = profiles[idx].data;
    loadData(parsedResumeData);
    api.storage.local.set({ resumeData: collectData() });
    document.getElementById('resumeModal').classList.add('hidden');
    showToast(`已加载「${profiles[idx].name}」`, 'success');
  });
});

// Delete profile button
document.getElementById('btnDeleteProfile').addEventListener('click', () => {
  const sel = document.getElementById('profileSelect');
  const idx = parseInt(sel.value);
  if (isNaN(idx)) { showToast('请先选择一份简历', 'error'); return; }
  api.storage.local.get('resumeProfiles', (result) => {
    const profiles = result.resumeProfiles || [];
    if (!profiles[idx]) return;
    const name = profiles[idx].name;
    profiles.splice(idx, 1);
    api.storage.local.set({ resumeProfiles: profiles }, () => {
      renderProfileSelect(profiles);
      showToast(`已删除「${name}」`);
    });
  });
});

// Compare back
document.getElementById('btnCompareBack').addEventListener('click', () => {
  document.getElementById('resumeStepCompare').classList.add('hidden');
  document.getElementById('resumeStep1').classList.remove('hidden');
});

// Compare confirm — apply user choices then go to preview
document.getElementById('btnCompareConfirm').addEventListener('click', () => {
  if (!parsedResumeData || !_compareLocalData || !_compareAiData) return;
  // Apply radio selections
  document.querySelectorAll('.compare-section').forEach(section => {
    const key = section.dataset.key;
    const choice = section.querySelector('input[type="radio"]:checked')?.value;
    if (choice === 'local') {
      parsedResumeData[key] = _compareLocalData[key] || [];
    } else {
      parsedResumeData[key] = _compareAiData[key] || [];
    }
  });
  document.getElementById('resumeStepCompare').classList.add('hidden');
  renderParsePreview(parsedResumeData);
  document.getElementById('resumeStep2').classList.remove('hidden');
});

// ============ Smart Merge ============
const ENTRY_KEYS = ['educations', 'works', 'projects', 'competitions', 'certificates'];
const ENTRY_LABELS = { educations: '教育经历', works: '工作/实习经历', projects: '项目经历', competitions: '竞赛/荣誉', certificates: '证书' };

function smartMergeResume(localData, aiData) {
  const merged = {};
  const conflicts = [];

  // Basic fields: prefer non-empty, if both exist prefer AI
  const allKeys = new Set([...Object.keys(localData), ...Object.keys(aiData)]);
  for (const key of allKeys) {
    if (ENTRY_KEYS.includes(key)) continue;
    const lv = localData[key], av = aiData[key];
    merged[key] = av || lv || '';
  }

  // Entry arrays: compare by count and content
  for (const key of ENTRY_KEYS) {
    const localArr = localData[key] || [];
    const aiArr = aiData[key] || [];
    if (localArr.length === 0 && aiArr.length === 0) {
      merged[key] = [];
    } else if (localArr.length === 0) {
      merged[key] = aiArr;
    } else if (aiArr.length === 0) {
      merged[key] = localArr;
    } else if (localArr.length === aiArr.length && entriesLookSame(localArr, aiArr, key)) {
      merged[key] = aiArr; // Same structure, prefer AI (richer descriptions)
    } else {
      // Conflict: different count or content
      conflicts.push(key);
      merged[key] = aiArr; // Default to AI, user can switch
    }
  }
  return { merged, conflicts };
}

function entriesLookSame(a, b, key) {
  const titleKey = { educations: 'school', works: 'company', projects: 'projectName', competitions: 'competitionName', certificates: 'certName' }[key];
  if (!titleKey) return false;
  const aTitles = a.map(e => (e[titleKey] || '').trim()).sort();
  const bTitles = b.map(e => (e[titleKey] || '').trim()).sort();
  return aTitles.join('|') === bTitles.join('|');
}

function renderConflictCompare(conflicts, localData, aiData, merged) {
  const container = document.getElementById('compareContent');
  let html = '<div style="font-size:11px;color:#91959a;margin-bottom:8px">以下经历两种解析结果不同，请选择更准确的版本：</div>';

  for (const key of conflicts) {
    const label = ENTRY_LABELS[key] || key;
    const localArr = localData[key] || [];
    const aiArr = aiData[key] || [];
    html += `<div class="compare-section" data-key="${key}">
      <div class="compare-title">${label}</div>
      <div class="compare-options">
        <label class="compare-option">
          <input type="radio" name="compare_${key}" value="local">
          <div class="compare-card">
            <div class="compare-card-header">本地解析 <span class="compare-count">${localArr.length} 条</span></div>
            ${renderEntryBrief(localArr, key)}
          </div>
        </label>
        <label class="compare-option">
          <input type="radio" name="compare_${key}" value="ai" checked>
          <div class="compare-card selected">
            <div class="compare-card-header">AI 解析 <span class="compare-count">${aiArr.length} 条</span></div>
            ${renderEntryBrief(aiArr, key)}
          </div>
        </label>
      </div>
    </div>`;
  }
  container.innerHTML = html;

  // Radio toggle styling
  container.querySelectorAll('input[type="radio"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const section = radio.closest('.compare-section');
      section.querySelectorAll('.compare-card').forEach(c => c.classList.remove('selected'));
      radio.closest('.compare-option').querySelector('.compare-card').classList.add('selected');
    });
  });
}

function renderEntryBrief(arr, key) {
  const titleKey = { educations: 'school', works: 'company', projects: 'projectName', competitions: 'competitionName', certificates: 'certName' }[key];
  const subKey = { educations: 'major', works: 'jobTitle', projects: 'role', competitions: 'awardLevel', certificates: 'certDate' }[key];
  return arr.map(e => {
    const title = esc(e[titleKey] || '?');
    const sub = e[subKey] ? ` · ${esc(e[subKey])}` : '';
    const dates = e.startDate ? ` (${esc(e.startDate)}~${esc(e.endDate || '')})` : '';
    return `<div class="compare-entry">${title}${sub}${dates}</div>`;
  }).join('');
}

// Render preview
function renderParsePreview(data) {
  const preview = document.getElementById('parsePreview');
  let html = '';

  // Basic info
  const basicFields = [
    ['姓名', data.name], ['性别', data.gender], ['手机', data.phone], ['邮箱', data.email],
    ['城市', data.city], ['学历', data.educations?.[0]?.degree], ['期望职位', data.expectedJob],
  ];
  const basicHtml = basicFields
    .filter(([,v]) => v)
    .map(([k,v]) => `<div class="parse-field"><span class="parse-field-key">${k}</span><span class="parse-field-val">${esc(v)}</span></div>`)
    .join('');
  if (basicHtml) {
    html += `<div class="parse-section"><div class="parse-section-title">基本信息</div>${basicHtml}</div>`;
  }

  // Education
  if (data.educations?.length > 0) {
    html += `<div class="parse-section"><div class="parse-section-title">教育经历 (${data.educations.length})</div>`;
    data.educations.forEach(e => {
      html += `<div class="parse-entry"><div class="parse-entry-title">${esc(e.school || '?')} · ${esc(e.major)} · ${esc(e.degree)}</div>
        <div style="font-size:10px;color:#999">${esc(e.startDate)} ~ ${esc(e.endDate)}</div></div>`;
    });
    html += '</div>';
  }

  // Work
  if (data.works?.length > 0) {
    html += `<div class="parse-section"><div class="parse-section-title">工作/实习经历 (${data.works.length})</div>`;
    data.works.forEach(w => {
      const tag = w.workType === '实习' ? '<span style="color:#e65100;font-size:10px;background:#fff3e0;padding:0 4px;border-radius:3px;margin-left:4px">实习</span>' : '';
      html += `<div class="parse-entry"><div class="parse-entry-title">${esc(w.company || '?')} · ${esc(w.jobTitle)}${tag}</div>
        <div style="font-size:10px;color:#999">${esc(w.startDate)} ~ ${esc(w.endDate)}</div>
        ${w.description ? `<div style="font-size:11px;color:#666;margin-top:2px">${esc(w.description.substring(0, 80))}${w.description.length > 80 ? '...' : ''}</div>` : ''}</div>`;
    });
    html += '</div>';
  }

  // Projects
  if (data.projects?.length > 0) {
    html += `<div class="parse-section"><div class="parse-section-title">项目经历 (${data.projects.length})</div>`;
    data.projects.forEach(p => {
      html += `<div class="parse-entry"><div class="parse-entry-title">${esc(p.projectName || '?')} · ${esc(p.role)}</div>
        <div style="font-size:10px;color:#999">${esc(p.startDate)} ~ ${esc(p.endDate)}</div></div>`;
    });
    html += '</div>';
  }

  // Competitions
  if (data.competitions?.length > 0) {
    html += `<div class="parse-section"><div class="parse-section-title">竞赛/荣誉 (${data.competitions.length})</div>`;
    data.competitions.forEach(c => {
      html += `<div class="parse-entry"><div class="parse-entry-title">${esc(c.competitionName || '?')} · ${esc(c.awardLevel)}</div></div>`;
    });
    html += '</div>';
  }

  // Certificates
  if (data.certificates?.length > 0) {
    html += `<div class="parse-section"><div class="parse-section-title">证书 (${data.certificates.length})</div>`;
    data.certificates.forEach(c => {
      html += `<div class="parse-entry"><div class="parse-entry-title">${esc(c.certName || '?')}</div></div>`;
    });
    html += '</div>';
  }

  // Skills & Self evaluation
  const extras = [];
  if (data.skills) extras.push(`<div class="parse-field"><span class="parse-field-key">技能</span><span class="parse-field-val">${esc(data.skills)}</span></div>`);
  if (data.selfEvaluation) extras.push(`<div class="parse-field"><span class="parse-field-key">自评</span><span class="parse-field-val">${esc(data.selfEvaluation.substring(0, 60))}...</span></div>`);
  if (extras.length > 0) {
    html += `<div class="parse-section"><div class="parse-section-title">其他</div>${extras.join('')}</div>`;
  }

  preview.innerHTML = html || '<p style="text-align:center;color:#ccc">未解析到有效信息</p>';
}

// ============ Import / Export ============
document.getElementById('btnImport').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      loadData(data);
      api.storage.local.set({ resumeData: data });
      showToast('数据已导入');
    } catch { showToast('导入失败：格式不正确', 'error'); }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// ============ Application Records ============
const STATUS_LABELS = {
  applied: '已投递',
  pending: '待处理',
  interview: '面试中',
  offer: '已录用',
  rejected: '已拒绝'
};

const STATUS_COLORS = {
  applied: '#2196f3',
  pending: '#ff9800',
  interview: '#9c27b0',
  offer: '#4caf50',
  rejected: '#f44336'
};

let currentRecords = [];
let recordsFilter = 'all';
let recordsSearch = '';

function loadRecords() {
  api.runtime.sendMessage({ action: 'getApplications' }, (response) => {
    if (response && response.list) {
      currentRecords = response.list;
      renderRecords();
    }
  });
}

function renderRecords() {
  const listEl = document.getElementById('recordsList');
  const emptyEl = document.getElementById('recordsEmpty');

  // Filter records
  let filtered = currentRecords;
  if (recordsFilter !== 'all') {
    filtered = filtered.filter(r => r.status === recordsFilter);
  }
  if (recordsSearch) {
    const q = recordsSearch.toLowerCase();
    filtered = filtered.filter(r =>
      (r.company && r.company.toLowerCase().includes(q)) ||
      (r.job && r.job.toLowerCase().includes(q)) ||
      (r.host && r.host.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'block';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = filtered.map(r => {
    const date = new Date(r.filledAt || r.createdAt).toLocaleDateString('zh-CN');
    const status = r.status || 'applied';
    const statusLabel = STATUS_LABELS[status] || '已投递';
    const statusColor = STATUS_COLORS[status] || '#2196f3';
    return `
      <div class="record-item" data-id="${r.id}">
        <div class="record-header">
          <span class="record-company">${esc(r.company || r.host || '未知公司')}</span>
          <span class="record-status" style="background:${statusColor}">${statusLabel}</span>
        </div>
        <div class="record-job">${esc(r.job || '未知职位')}</div>
        <div class="record-meta">
          <span class="record-date">${date}</span>
          <span class="record-host">${esc(r.host || '')}</span>
        </div>
        ${r.note ? `<div class="record-note">${esc(r.note)}</div>` : ''}
        <div class="record-actions">
          <select class="record-status-select" data-id="${r.id}">
            ${Object.entries(STATUS_LABELS).map(([k, v]) => `<option value="${k}" ${k === status ? 'selected' : ''}>${v}</option>`).join('')}
          </select>
          <button class="record-note-btn" data-id="${r.id}" title="添加备注">📝</button>
          <button class="record-delete-btn" data-id="${r.id}" title="删除">×</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind events
  listEl.querySelectorAll('.record-status-select').forEach(sel => {
    sel.addEventListener('change', (e) => {
      const id = e.target.dataset.id;
      const status = e.target.value;
      api.runtime.sendMessage({ action: 'updateApplication', data: { id, status } }, () => {
        loadRecords();
        showToast('状态已更新');
      });
    });
  });

  listEl.querySelectorAll('.record-note-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      const record = currentRecords.find(r => r.id === id);
      const note = prompt('添加备注：', record?.note || '');
      if (note !== null) {
        api.runtime.sendMessage({ action: 'updateApplication', data: { id, note } }, () => {
          loadRecords();
          showToast('备注已保存');
        });
      }
    });
  });

  listEl.querySelectorAll('.record-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      if (confirm('确定删除这条记录？')) {
        api.runtime.sendMessage({ action: 'deleteApplication', id }, () => {
          loadRecords();
          showToast('记录已删除');
        });
      }
    });
  });
}

// Filter and search
document.getElementById('recordsFilter').addEventListener('change', (e) => {
  recordsFilter = e.target.value;
  renderRecords();
});

document.getElementById('recordsSearch').addEventListener('input', (e) => {
  recordsSearch = e.target.value;
  renderRecords();
});

// Export records
document.getElementById('btnExportRecords').addEventListener('click', () => {
  if (currentRecords.length === 0) {
    showToast('暂无记录可导出');
    return;
  }
  const data = JSON.stringify(currentRecords, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `投递记录_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('记录已导出');
});

// Import records
document.getElementById('btnImportRecords').addEventListener('click', () => {
  document.getElementById('importRecordsFile').click();
});

document.getElementById('importRecordsFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const records = JSON.parse(ev.target.result);
      if (!Array.isArray(records)) throw new Error('格式错误');
      // Import each record
      let imported = 0;
      records.forEach(r => {
        if (r.host || r.url) {
          api.runtime.sendMessage({ action: 'recordApplication', data: r }, () => {
            imported++;
            if (imported === records.length) {
              loadRecords();
              showToast(`已导入 ${imported} 条记录`);
            }
          });
        }
      });
    } catch {
      showToast('导入失败：格式不正确', 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

// Clear all records
document.getElementById('btnClearRecords').addEventListener('click', () => {
  if (confirm('确定清空所有投递记录？此操作不可恢复。')) {
    // Delete each record
    currentRecords.forEach(r => {
      api.runtime.sendMessage({ action: 'deleteApplication', id: r.id });
    });
    setTimeout(() => {
      loadRecords();
      showToast('记录已清空');
    }, 500);
  }
});

// Load records when records tab is activated
document.querySelector('[data-tab="records"]').addEventListener('click', loadRecords);

// Initial load
loadRecords();