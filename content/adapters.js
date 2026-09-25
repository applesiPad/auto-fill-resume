/**
 * Resume Auto Filler — Site Adapters (L0)
 *
 * Platform fingerprint + deterministic adaptation rules for major Chinese
 * job-application systems (北森 / 大易 / 国聘 / legacy WebForm & table-layout
 * portals common in 央国企 recruitment sites).
 *
 * Adapters run BEFORE the generic weighted matcher: any field matched by an
 * adapter rule is filled deterministically and skipped by the matcher.
 * Adapters may also contribute extra label selectors and section keywords
 * that improve the generic engine on that platform.
 *
 * Loaded before content.js via manifest content_scripts.
 */
(function() {
  'use strict';
  if (window.__RF_ADAPTERS__) return;

  const REGISTRY = [];

  /**
   * adapter = {
   *   id, name, priority (lower = checked first),
   *   match({url, doc, win}) -> bool
   *   rules: [{ selector, key, section? }]     // deterministic css → field key
   *   labelSelectors: [...]                    // extra label containers for getIdentifiers
   *   sectionKeywords: { education: [...], ... } // extra section keywords
   *   multiEntry?: { ... }                     // platform-specific "add entry" selectors
   * }
   */

  // ----------------------------------------------------------------
  // 北森 Beisen / iTalent (cloud ATS used by many 央企/银行)
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'beisen',
    name: '北森 iTalent',
    priority: 10,
    match({ url, doc }) {
      if (/beisen\.com|italent\.cn|italent\.com/i.test(url)) return true;
      // DOM fingerprints: 北森 component prefix
      if (doc.querySelector('[class*="bx-"], [class*="beisen"], [class*="italent"]')) return true;
      return false;
    },
    rules: [
      // conservative structural rules verified against snapshot; the generic
      // matcher + LLM layer handle the long tail
    ],
    labelSelectors: [
      '.bx-form-label', '[class*="bx-form-label"]', '[class*="form-label"]',
      '[class*="field-label"]', '[class*="Label__root"]',
    ],
    sectionKeywords: {
      basic: ['基本信息', '个人信息'],
      education: ['教育经历', '教育背景'],
      work: ['工作经历', '工作/实习经历', '职业经历'],
      project: ['项目经历', '项目经验'],
    },
  });

  // ----------------------------------------------------------------
  // 大易 Dayee (用友系 ATS, old JSP table portals)
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'dayee',
    name: '大易 Dayee',
    priority: 10,
    match({ url, doc }) {
      if (/dayee\.com|dayee/i.test(url)) return true;
      if (doc.querySelector('meta[name="generator"][content*="dayee" i]')) return true;
      return false;
    },
    rules: [],
    labelSelectors: [
      '.td_label', '.td-label', '[class*="label_td"]', 'td.tdtitle',
      '.form-label', '[class*="itemlabel"]',
    ],
    sectionKeywords: {
      education: ['教育经历', '学历信息'],
      work: ['工作经历', '工作/实习'],
      family: ['家庭'],
    },
  });

  // ----------------------------------------------------------------
  // 国聘 iguopin (国资委背景统一招聘平台)
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'iguopin',
    name: '国聘',
    priority: 10,
    match({ url }) {
      return /iguopin\.com/i.test(url);
    },
    rules: [],
    labelSelectors: ['[class*="label"]', '[class*="Label"]'],
    sectionKeywords: {
      education: ['教育经历'],
      work: ['工作经历', '实习经历'],
    },
  });

  // ----------------------------------------------------------------
  // Generic: legacy table-layout portal (自建央国企门户)
  // Triggers when most form controls live in <table> rows whose previous
  // cells are text labels — the classic 结构化老系统 pattern where
  // name/id are meaningless (ctl00$...$TextBox1).
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'legacy-table',
    name: '通用表格布局系统',
    priority: 50,
    match({ doc }) {
      const els = doc.querySelectorAll('input[type="text"], select, textarea');
      if (els.length < 6) return false;
      let inTable = 0;
      for (const el of els) {
        if (el.closest('table')) inTable++;
      }
      return inTable / els.length >= 0.6;
    },
    rules: [],
    labelSelectors: ['td.label', 'td.td_label', '.tdtitle'],
    // structural label extraction is handled in content.js getIdentifiers
    // (row-cell scan) — this adapter flags the page so that path is active.
    structuralLabels: true,
  });

  // ----------------------------------------------------------------
  // Generic: ASP.NET WebForm postback portals
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'webform',
    name: 'WebForm 回传系统',
    priority: 60,
    match({ win, doc }) {
      if (typeof win.__doPostBack === 'function') return true;
      if (doc.getElementById('__VIEWSTATE') || doc.querySelector('input[name="__VIEWSTATE"]')) return true;
      return false;
    },
    rules: [],
    // after value set, inline onchange handlers (__doPostBack chains) must
    // be invoked explicitly — primitives.js handles this
    postback: true,
  });

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  window.__RF_ADAPTERS__ = {
    list: REGISTRY,
    /**
     * @returns {Array} matched adapters sorted by priority (can be multiple:
     *          e.g. dayee + webform + legacy-table stack)
     */
    detect(url, doc) {
      const win = doc.defaultView || window;
      return REGISTRY
        .filter(a => { try { return a.match({ url, doc, win }); } catch (e) { return false; } })
        .sort((a, b) => (a.priority || 50) - (b.priority || 50));
    },
    /** Collect deterministic rules [{el, key}] for the given adapters */
    collectRules(adapters, doc) {
      const out = [];
      for (const ad of adapters || []) {
        for (const r of ad.rules || []) {
          let els = [];
          try { els = doc.querySelectorAll(r.selector); } catch (e) { continue; }
          for (const el of els) {
            if (el && !out.some(o => o.el === el)) out.push({ el, key: r.key, adapter: ad.id });
          }
        }
      }
      return out;
    },
    /** Merged extra label selectors from matched adapters */
    mergedLabelSelectors(adapters) {
      const set = new Set();
      for (const ad of adapters || []) (ad.labelSelectors || []).forEach(s => set.add(s));
      return Array.from(set);
    },
  };
})();
