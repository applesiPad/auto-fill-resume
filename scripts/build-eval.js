/**
 * Build the self-contained eval page: dist/eval.html
 * Inlines shim + adapters + primitives + content scripts + snapshots + runner
 * so the whole regression suite runs from a single file (file:// friendly).
 *
 * Usage: node scripts/build-eval.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

const SHIM_SRC = read('test/eval-shim.js');
const ADAPTERS_SRC = read('content/adapters.js');
const PRIMITIVES_SRC = read('content/primitives.js');
const CONTENT_SRC = read('content/content.js');
const RUNNER_SRC = read('test/eval-runner.js');

const SNAP_CONFIG = [
  {
    id: 'legacy-webform', file: 'legacy-webform.html',
    name: '央企自建 WebForm 老系统',
    desc: 'ctl00 无语义命名 / table 布局 label / WdatePicker / UEditor 富文本 / 验证码与家庭字段防误填',
    url: 'https://hr.example-soe.com.cn:8443/Recruit/ResumeEdit.aspx'
  },
  {
    id: 'dayee-table', file: 'dayee-table.html',
    name: '大易(Dayee)风格 JSP 系统',
    desc: 'meta 指纹 / 懒加载下拉(聚焦后才填充选项) / laydate 日期控件',
    url: 'https://campus.example-bank.com.cn/dayee/apply/info.jsp'
  },
  {
    id: 'beisen-react', file: 'beisen-react.html',
    name: '北森 iTalent 风格 React 系统',
    desc: 'bx- 组件 / div 表单结构 / 多条目教育经历分组填写(两段教育)',
    url: 'https://app.example-beisen.cn/apply/step1'
  },
  {
    id: 'iguopin-modern', file: 'iguopin-modern.html',
    name: '国聘风格 + LLM 兜底(mock)',
    desc: '规则识别不了的"生源地/外语水平"由 LLM 语义映射完成;企业自定义问题(奖惩情况)不误填',
    url: 'https://www.iguopin.com/apply/12345'
  },
  {
    id: 'iframe-nested', file: 'iframe-nested.html',
    name: 'iframe 嵌套表单',
    desc: '表单整体装在 iframe 内,验证跨 frame 填写能力',
    url: 'https://job.example-bank.com.cn:9443/apply/frame.jsp'
  },
  {
    id: 'modal-add', file: 'modal-add.html',
    name: '弹窗式多条目(新增 → Modal → 确定)',
    desc: '教育经历初始为空,点击"新增"弹出 Modal 表单;填完自动点确定落列表,再新增录入第二条',
    url: 'https://app.example-ats.cn/apply/candidate'
  },
  {
    id: 'inline-add', file: 'inline-add.html',
    name: '行内追加重式(新增一行)',
    desc: '表格初始为空,点击"新增一行"追加输入行;两条教育经历逐行追加并填写',
    url: 'https://recruit.example-bank.com.cn:9443/apply/edu.jsp'
  },
  {
    id: 'open-questions', file: 'open-questions.html',
    name: '开放题/筛选题/附件综合',
    desc: '本地题库回答"是否服从调剂" · AI 起草"为什么选择我行"(mock) · 一寸照片自动上传 · 未识别字段进反馈面板',
    url: 'https://campus.example-bank.com.cn/apply/supplement'
  },
  {
    id: 'shadow-dom', file: 'shadow-dom.html',
    name: 'Shadow DOM Web Components',
    desc: '表单位于自定义元素 shadow root 内,验证引擎的 shadow 穿透采集',
    url: 'https://portal.example-ats.com/candidate/info'
  },
  {
    id: 'corrections', file: 'corrections.html',
    name: '纠错学习闭环(L4)',
    desc: '填写 → 用户手动修正 → 清空重填 → 使用修正后的值',
    url: 'https://apply.example.com/form'
  }
];

const SNAPSHOTS = SNAP_CONFIG.map(cfg => ({
  id: cfg.id,
  name: cfg.name,
  desc: cfg.desc,
  url: cfg.url,
  html: read(path.join('test', 'snapshots', cfg.file))
}));

// Escape "</script" inside JS string literals so inlined HTML doesn't
// terminate the host <script> element ("<\/script" evaluates identically)
const js = v => JSON.stringify(v).replace(/<\/script/gi, '<\\/script');

const TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<title>简历自动填写助手 · 鲁棒性评测台</title>
<style>
  :root { --bg:#0f1420; --card:#171e2e; --border:#26304a; --text:#dce3f2; --muted:#8b96ad; --ok:#34a853; --warn:#f59e0b; --bad:#ea4335; --accent:#5b8cff; }
  * { box-sizing: border-box; }
  body { margin:0; padding:24px; background:var(--bg); color:var(--text); font:14px/1.6 -apple-system,"Microsoft YaHei",sans-serif; }
  h1 { font-size:18px; margin:0 0 4px; }
  .sub { color:var(--muted); font-size:12px; margin-bottom:18px; }
  .bar { display:flex; align-items:center; gap:14px; margin-bottom:18px; }
  #summary { font-size:14px; color:var(--muted); }
  #runBtn { background:var(--accent); color:#fff; border:none; border-radius:6px; padding:8px 22px; font-size:14px; cursor:pointer; }
  #runBtn:disabled { opacity:.5; cursor:default; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:8px; padding:14px 16px; margin-bottom:14px; }
  .card-head { display:flex; justify-content:space-between; align-items:center; }
  .card .name { font-weight:600; }
  .card .desc { color:var(--muted); font-size:12px; margin:2px 0 8px; }
  .score { font-weight:600; padding:2px 10px; border-radius:10px; font-size:13px; }
  .score.good { background:rgba(52,168,83,.15); color:var(--ok); }
  .score.warn { background:rgba(245,158,11,.15); color:var(--warn); }
  .score.bad  { background:rgba(234,67,53,.15); color:var(--bad); }
  .score.pending { background:rgba(139,150,173,.15); color:var(--muted); }
  table { width:100%; border-collapse:collapse; font-size:12.5px; }
  th, td { text-align:left; padding:5px 8px; border-bottom:1px solid var(--border); }
  th { color:var(--muted); font-weight:500; }
  tr.ok td { color:#9fd8ab; }
  tr.fail td { color:#f2a49c; }
  tr.fail td:last-child, tr.ok td:last-child { font-weight:700; }
  .tag-llm { background:rgba(245,158,11,.2); color:var(--warn); border-radius:4px; padding:0 6px; font-size:11px; }
  .tag-fix { background:rgba(91,140,255,.2); color:var(--accent); border-radius:4px; padding:0 6px; font-size:11px; }
  #frames { position:fixed; left:-2000px; top:0; width:1100px; height:900px; opacity:0; pointer-events:none; }
  .snap-frame { width:1050px; height:850px; border:none; }
</style>
</head>
<body>
  <h1>简历自动填写助手 · 鲁棒性评测台</h1>
  <div class="sub">十份央国企网申结构模拟快照 × 五层填写流水线(适配器 → 规则 → LLM 兜底 → 题库/附件 → 纠错学习)。快照为结构模拟,可随时用真实页面 DOM 替换 test/snapshots/ 下的文件。</div>
  <div class="bar">
    <button id="runBtn">开始评测</button>
    <span id="summary"></span>
  </div>
  <div id="results"></div>
  <div id="frames"></div>
<script>
const SHIM_SRC = ${js(SHIM_SRC)};
const ADAPTERS_SRC = ${js(ADAPTERS_SRC)};
const PRIMITIVES_SRC = ${js(PRIMITIVES_SRC)};
const CONTENT_SRC = ${js(CONTENT_SRC)};
const SNAPSHOTS = ${js(SNAPSHOTS)};
</script>
<script>
${RUNNER_SRC}
</script>
</body>
</html>
`;

const outDir = path.join(ROOT, 'dist');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'eval.html');
fs.writeFileSync(outPath, TEMPLATE, 'utf8');
console.log('Built ' + path.relative(ROOT, outPath) + ' (' + Math.round(TEMPLATE.length / 1024) + ' KB)');
