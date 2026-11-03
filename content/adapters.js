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
    // structural label extraction is handled in content.js getIdentifiers
    // (row-cell scan) — this adapter flags the page so that path is active.
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
  // Workday (外资/海外主流 ATS)
  // 特征：name/id 全是哈希，语义全挂在 data-automation-id 上；
  //       姓名拆成 legalNameSection_firstName / _lastName 两个框。
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'workday',
    name: 'Workday',
    priority: 5,
    match({ url, doc }) {
      if (/myworkdayjobs\.com|myworkdaysite\.com|workday\.com/i.test(url)) return true;
      if (doc.querySelector('[data-automation-id^="legalNameSection_"], [data-automation-id="addressSection_city"]')) return true;
      return false;
    },
    rules: [
      { selector: '[data-automation-id="legalNameSection_firstName"]', key: 'firstName' },
      { selector: '[data-automation-id="legalNameSection_lastName"]', key: 'lastName' },
      { selector: '[data-automation-id="legalNameSection_middleName"]', key: 'middleName' },
      { selector: '[data-automation-id="email"]', key: 'email' },
      { selector: '[data-automation-id="phoneNumber"]', key: 'phone' },
      { selector: '[data-automation-id="addressSection_addressLine1"]', key: 'address' },
      { selector: '[data-automation-id="addressSection_city"]', key: 'city' },
      { selector: '[data-automation-id="addressSection_postalCode"]', key: 'postalCode' },
      { selector: '[data-automation-id="addressSection_countryRegion"]', key: 'country' },
      { selector: '[data-automation-id="addressSection_region"]', key: 'province' },
    ],
  });

  // ----------------------------------------------------------------
  // Greenhouse (欧美科技公司主力 ATS)
  // 特征：#first_name / #last_name 分开，name 形如 job_application[first_name]，
  //       自定义问题 id 是 question_xxx（不该被通用规则乱填）。
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'greenhouse',
    name: 'Greenhouse',
    priority: 5,
    match({ url, doc }) {
      if (/greenhouse\.io/i.test(url)) return true;
      if (doc.querySelector('#application_form, input[name="job_application[first_name]"]')) return true;
      return false;
    },
    rules: [
      { selector: '#first_name, #job_application_first_name', key: 'firstName' },
      { selector: '#last_name, #job_application_last_name', key: 'lastName' },
      { selector: '#email, #job_application_email', key: 'email' },
      { selector: '#phone, #job_application_phone', key: 'phone' },
      { selector: '#job_application_location', key: 'city' },
    ],
  });

  // ----------------------------------------------------------------
  // Lever (创业公司常用，极简表单)
  // 特征：input[name="name"] 是整名，urls[LinkedIn] 这种数组式 name。
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'lever',
    name: 'Lever',
    priority: 5,
    match({ url, doc }) {
      if (/lever\.co/i.test(url)) return true;
      if (doc.querySelector('form#application-form, .application-question, input[name="urls[LinkedIn]"]')) return true;
      return false;
    },
    rules: [
      { selector: 'input[name="name"]', key: 'name' },
      { selector: 'input[name="email"]', key: 'email' },
      { selector: 'input[name="phone"]', key: 'phone' },
      { selector: 'input[name="org"]', key: 'company' },
      { selector: 'input[name="urls[LinkedIn]"]', key: 'linkedin' },
    ],
  });

  // ----------------------------------------------------------------
  // Moka / 摩卡 (私企最常用的中文 ATS，React 组件)
  // 特征：moka-* / FormItem 类名，字段有真实 label，通用匹配器基本够用，
  //       适配器只负责打标 + 补 label 选择器与分区关键词。
  // ----------------------------------------------------------------
  REGISTRY.push({
    id: 'moka',
    name: 'Moka 摩卡',
    priority: 10,
    match({ url, doc }) {
      if (/mokahr\.com|moka\.(com|cn)/i.test(url)) return true;
      if (doc.querySelector('[class*="moka-"], [class*="MokaForm"], [class*="formItemLabel"], [class*="FormItemLabel"]')) return true;
      return false;
    },
    rules: [
      // Moka 字段 id 不稳定，靠 label 驱动；这里只保留少数稳定结构
      { selector: '.moka-form-item input[name="name"]', key: 'name' },
      { selector: '.moka-form-item input[name="phone"]', key: 'phone' },
      { selector: '.moka-form-item input[name="email"]', key: 'email' },
    ],
  });

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------
  window.__RF_ADAPTERS__ = {
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
  };
})();
