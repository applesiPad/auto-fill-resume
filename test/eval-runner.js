/**
 * Resume Auto Filler — Eval Runner
 * Runs each snapshot in an iframe, injects shim + content scripts, fills with
 * the fixture, and scores results against the embedded expected manifest.
 *
 * This file is inlined into dist/eval.html by scripts/build-eval.js.
 * Global inputs provided by the build: SNAPSHOTS, SHIM_SRC, I18N_SRC,
 * MATCHERS_SRC, ADAPTERS_SRC, PRIMITIVES_SRC, CONTENT_SRC.
 */
(function () {
  'use strict';

  // ---- Fixture resume (张三) ----
  const FIXTURE = {
    name: '张三', gender: '男', birthday: '2000-05-20', idCard: '110101200005200011',
    phone: '13800138000', email: 'zhangsan@mail.com', city: '北京',
    politicalStatus: '中共党员', ethnicity: '汉族', hometown: '河南', hukou: '河南',
    height: '178', weight: '65', maritalStatus: '未婚',
    englishLevel: 'CET-6', englishScore: '580', computerLevel: '二级',
    selfEvaluation: '踏实肯干，学习能力强，抗压能力好。',
    expectedJob: '前端开发工程师', expectedSalary: '15-25k', workYears: '应届生',
    skills: 'JavaScript/TypeScript/React',
    educations: [
      { school: '清华大学', degree: '本科', major: '计算机科学与技术', gpa: '3.6/4.0', startDate: '2019-09-01', endDate: '2023-06-30', description: '' },
      { school: '北京四中', degree: '高中', major: '', startDate: '2016-09-01', endDate: '2019-06-30', description: '' }
    ],
    works: [
      { company: '字节跳动', jobTitle: '前端开发实习生', startDate: '2022-06-01', endDate: '2022-12-31', description: '负责抖音 Web 端活动页开发', workType: '实习' }
    ],
    projects: [
      { projectName: '简历自动填写助手', role: '核心开发', description: 'Chrome 插件,多信号字段识别', link: 'https://github.com/x/y' }
    ],
    competitions: [
      { competitionName: 'ACM-ICPC 亚洲区域赛', awardLevel: '省级金奖', awardDate: '2021-08-01', issuer: '中国计算机学会', description: '' }
    ],
    certificates: [
      { certName: 'CET-6', certDate: '2021-06-01', certIssuer: '教育部', certNo: '' }
    ]
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function injectScripts(doc) {
    [SHIM_SRC, I18N_SRC, MATCHERS_SRC, ADAPTERS_SRC, PRIMITIVES_SRC, CONTENT_SRC].forEach(src => {
      const s = doc.createElement('script');
      s.textContent = src;
      (doc.body || doc.documentElement).appendChild(s);
    });
  }

  function collectFrames(doc, acc) {
    acc.push(doc);
    Array.from(doc.querySelectorAll('iframe')).forEach(f => {
      try { if (f.contentDocument) collectFrames(f.contentDocument, acc); } catch (e) { /* cross-origin */ }
    });
    return acc;
  }

  function deepQuery(doc, sel) {
    for (const d of collectFrames(doc, [])) {
      const el = qDeep(d, sel);
      if (el) return el;
    }
    return null;
  }

  /** querySelector that also pierces open shadow roots */
  function qDeep(root, sel) {
    try { const el = root.querySelector(sel); if (el) return el; } catch (e) {}
    let found = null;
    const walk = (node) => {
      if (found) return;
      node.querySelectorAll('*').forEach(el => {
        if (found || !el.shadowRoot) return;
        try { const hit = el.shadowRoot.querySelector(sel); if (hit) { found = hit; } } catch (e) {}
        if (!found) walk(el.shadowRoot);
      });
    };
    try { walk(root); } catch (e) {}
    return found;
  }

  function readEl(el) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? '✓checked' : '';
    // only real form controls have meaningful .value — <li value> is an ordinal!
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return String(el.value);
    return String(el.textContent || el.innerHTML || '').trim();
  }

  async function runSnapshot(snap) {
    const holder = document.getElementById('frames');
    const frame = document.createElement('iframe');
    frame.className = 'snap-frame';
    frame.setAttribute('aria-label', snap.id);
    frame.srcdoc = snap.html;
    holder.appendChild(frame);
    await new Promise(res => { frame.onload = res; setTimeout(res, 1500); });

    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    const expected = JSON.parse(doc.getElementById('__rf_expected').textContent);

    // inject content scripts into this frame and all same-origin child frames
    const docs = collectFrames(doc, []);
    docs.forEach(d => injectScripts(d));
    docs.forEach(d => { d.__RF_URL_OVERRIDE__ = snap.url; });

    if (expected.llmMock) {
      win.__RF_SET_LLM_MOCK__(msg => {
        if (msg.action === 'llmDraftAnswer') {
          return { answer: '贵行的数字化转型走在行业前列,前端工程能力正是我深耕的方向,我希望能把在校积累的工程实践转化为业务价值。' };
        }
        const mappings = [];
        (msg.fields || []).forEach(f => {
          if ((f.label || '').includes('生源地')) mappings.push({ i: f.i, key: 'hometown', conf: 0.9 });
          if ((f.label || '').includes('外语水平')) mappings.push({ i: f.i, key: 'englishLevel', conf: 0.85 });
        });
        return { mappings };
      });
    }

    // seed answer bank / attachments from the snapshot manifest
    if (expected.answerBank || expected.attachments) {
      const seed = {};
      if (expected.answerBank) seed.answerBank = expected.answerBank;
      if (expected.attachments) seed.attachments = expected.attachments;
      try { win.chrome.storage.local.set(seed); } catch (e) {}
    }

    const results = [];
    try {
      // fill every frame that has the debug API (mirrors all_frames delivery)
      for (const d of docs) {
        const w = d.defaultView;
        if (w.__RF_DEBUG__ && typeof w.__RF_DEBUG__.fill === 'function') {
          try { await w.__RF_DEBUG__.fill(FIXTURE); } catch (e) { console.error('[eval]', snap.id, e); }
        }
      }
      await sleep(1800); // let async primitives settle (select retry, pickers)

      // adapter detection (union across frames)
      const detectedAll = docs.flatMap(d => (d.defaultView.__RF_DEBUG__ && d.defaultView.__RF_DEBUG__.adapters ? d.defaultView.__RF_DEBUG__.adapters() : []) || []);
      (expected.adapters || []).forEach(a => {
        results.push({ sel: '(适配器) ' + a, expect: a, actual: detectedAll.join(', ') || '(无)', pass: detectedAll.includes(a) });
      });

      // field verification
      for (const f of expected.fields) {
        const el = deepQuery(doc, f.sel);
        if (f.mode === 'count') {
          const actual = el ? el.querySelectorAll(f.countSel || '*').length : 0;
          results.push({ sel: f.sel + ' 内 ' + (f.countSel || '*'), expect: String(f.expect), actual: String(actual), pass: actual === f.expect });
          continue;
        }
        if (f.mode === 'gone') {
          const gone = !el || el.offsetParent === null || getComputedStyle(el).display === 'none' || getComputedStyle(el).visibility === 'hidden';
          results.push({ sel: f.sel, expect: '(已关闭/隐藏)', actual: gone ? '(已关闭)' : '(仍可见)', pass: gone });
          continue;
        }
        if (f.mode === 'files') {
          const actual = el && el.files && el.files.length ? el.files[0].name : '(未上传)';
          results.push({ sel: f.sel, expect: f.expect, actual, pass: actual === f.expect });
          continue;
        }
        if (f.mode === 'shadowContains') {
          const text = el && el.shadowRoot ? el.shadowRoot.textContent : '';
          results.push({ sel: f.sel + ' (shadow)', expect: f.expect, actual: text.includes(f.expect) ? '包含' : '不包含', pass: text.includes(f.expect) });
          continue;
        }
        if (!el) { results.push({ sel: f.sel, expect: f.expect || '(空)', actual: '(元素未找到)', pass: false }); continue; }
        const actual = readEl(el);
        let pass;
        if (f.expectEmpty) {
          pass = actual === '' || (el.tagName === 'SELECT' && el.selectedIndex <= 0);
        } else if (f.mode === 'checked') {
          pass = !!el.checked;
        } else if (f.mode === 'contains') {
          pass = actual.includes(f.expect);
        } else {
          pass = actual === f.expect;
        }
        results.push({ sel: f.sel + (f.via === 'llm' ? ' <span class="tag-llm">LLM</span>' : ''), expect: f.expectEmpty ? '(保持为空)' : f.expect, actual, pass });
      }

      // corrections mode: edit → learn → refill
      if (expected.mode === 'corrections') {
        for (const c of expected.corrections || []) {
          const el = deepQuery(doc, c.sel);
          if (!el) { results.push({ sel: c.sel, expect: c.editTo, actual: '(元素未找到)', pass: false }); continue; }
          el.value = c.editTo;
          el.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await sleep(500); // correction persistence settles
        for (const c of expected.corrections || []) {
          const el = deepQuery(doc, c.sel);
          if (el) { el.value = ''; el.dispatchEvent(new Event('input', { bubbles: true })); }
        }
        await win.__RF_DEBUG__.fill(FIXTURE);
        await sleep(600);
        for (const c of expected.corrections || []) {
          const el = deepQuery(doc, c.sel);
          const actual = el ? readEl(el) : '(元素未找到)';
          results.push({ sel: c.sel + ' <span class="tag-fix">(重填)</span>', expect: c.expectAfterRefill, actual, pass: actual === c.expectAfterRefill });
        }
      }
    } catch (err) {
      results.push({ sel: '(运行异常)', expect: '-', actual: String(err && err.message || err), pass: false });
    }

    snap.result = {
      results,
      passed: results.filter(r => r.pass).length,
      total: results.length
    };
    renderResults();
    frame.remove();
  }

  // ---- UI ----
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function renderResults() {
    const wrap = document.getElementById('results');
    wrap.innerHTML = SNAPSHOTS.map(s => {
      const r = s.result;
      if (!r) {
        return `<div class="card pending" id="card-${s.id}"><div class="card-head"><span class="name">${esc(s.name)}</span><span class="score pending">待运行</span></div><div class="desc">${esc(s.desc || '')}</div></div>`;
      }
      const pct = r.total ? Math.round((r.passed / r.total) * 100) : 0;
      const cls = pct >= 100 ? 'good' : pct >= 70 ? 'warn' : 'bad';
      const rows = r.results.map(x =>
        `<tr class="${x.pass ? 'ok' : 'fail'}"><td>${x.sel}</td><td>${esc(x.expect)}</td><td>${esc(x.actual)}</td><td>${x.pass ? '✓' : '✗'}</td></tr>`
      ).join('');
      return `<div class="card" id="card-${s.id}">
        <div class="card-head"><span class="name">${esc(s.name)}</span><span class="score ${cls}">${r.passed}/${r.total} · ${pct}%</span></div>
        <div class="desc">${esc(s.desc || '')}</div>
        <table><thead><tr><th>字段</th><th>期望</th><th>实际</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>`;
    }).join('');

    const done = SNAPSHOTS.filter(s => s.result);
    if (done.length === SNAPSHOTS.length) {
      const totalPassed = done.reduce((n, s) => n + s.result.passed, 0);
      const totalAll = done.reduce((n, s) => n + s.result.total, 0);
      document.getElementById('summary').innerHTML =
        `总体填准率: <b>${totalPassed}/${totalAll} · ${Math.round((totalPassed / totalAll) * 100)}%</b>`;
    }
  }

  async function runAll() {
    const btn = document.getElementById('runBtn');
    btn.disabled = true;
    btn.textContent = '评测中…';
    SNAPSHOTS.forEach(s => { s.result = null; });
    renderResults();
    for (const s of SNAPSHOTS) {
      await runSnapshot(s);
      await sleep(200);
    }
    btn.disabled = false;
    btn.textContent = '重新评测';
  }

  document.getElementById('runBtn').addEventListener('click', runAll);
  renderResults();
  // auto-run
  runAll();
})();
