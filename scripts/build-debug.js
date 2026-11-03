/** 调试用：把某个快照 + 5 个 content 脚本打包成可直接打开、自动填写并打印明细的页面 */
const fs = require('fs');
const path = require('path');

const snap = process.argv[2] || 'workday-apply';
const read = p => fs.readFileSync(p, 'utf8');
const js = s => JSON.stringify(s);

const SHIM = read('test/eval-shim.js');
const I18N = read('content/value-i18n.js');
const MATCHERS = read('content/matchers.js');
const ADP = read('content/adapters.js');
const PRIM = read('content/primitives.js');
const CONTENT = read('content/content.js');

// 从 eval-runner 里抠出 FIXTURE 源码
const runner = read('test/eval-runner.js');
const j = runner.indexOf('const FIXTURE');
const k = runner.indexOf('\n  };', j);
const FIXTURE_SRC = runner.slice(j + 'const '.length, k + 4).trim().replace(/;$/, '');

let html = read(path.join('test', 'snapshots', snap + '.html'));

const inject = `
<script>window.__ERRORS__=[];window.addEventListener('error',e=>window.__ERRORS__.push(String(e.message)+' @line '+e.lineno+':'+e.colno));</script>
<script>${SHIM}</script>
<script>${I18N}</script>
<script>${MATCHERS}</script>
<script>${ADP}</script>
<script>${PRIM}</script>
<script>${CONTENT}</script>
<script>
(function(){
  const ${FIXTURE_SRC};
  window.__DBG__ = { fixture: FIXTURE };
  const dump = () => [...document.querySelectorAll('input,select,textarea')].map(el => ({
    sel: el.id ? '#' + el.id : el.name,
    tag: el.tagName.toLowerCase(),
    type: el.type || '',
    value: el.value,
    checked: el.checked || undefined,
    dbg: (window.__RF_DEBUG__ ? null : null)
  }));
  window.addEventListener('load', () => setTimeout(async () => {
    try { await window.__RF_DEBUG__.fill(FIXTURE); } catch (e) { window.__DBG__.error = String(e); }
    window.__DBG__.result = dump();
    window.__DBG__.probe = {
      i18n: !!window.__RF_DEBUG__.i18n,
      dateParts: window.__RF_DEBUG__.i18n.dateParts('2023-06-30'),
      reformat: (() => {
        const el = document.querySelector('#edu1-end');
        return el ? window.__RF_DEBUG__.reformatDateValue(el, '2023-06-30') : 'no el';
      })(),
      monthSel: (() => {
        const el = document.querySelector('#edu2-start-month');
        return el ? window.__RF_DEBUG__.i18n.isMonthSelect(el) : 'no el';
      })(),
      yearOpts: (() => {
        const el = document.querySelector('#edu2-start-year');
        return el ? [...el.options].map(o => o.value + '/' + o.textContent.trim()) : 'no el';
      })(),
      edu2StartYearVal: (() => {
        const el = document.querySelector('#edu2-start-year');
        return el ? el.value : 'no el';
      })()
    };
    document.title = 'DONE';
  }, 400));
})();
</script>
`;

// 用函数式替换：字符串替换里 $' / $& 等是特殊模式，会把源码里的 '__reactProps$' 破坏掉
html = html.replace('</body>', () => inject + '\n</body>');
fs.writeFileSync(path.join('dist', 'debug.html'), html, 'utf8');
console.log('Built dist/debug.html for', snap, '(', Math.round(html.length / 1024), 'KB )');
