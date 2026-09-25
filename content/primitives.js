/**
 * Resume Auto Filler — Interaction Primitives
 *
 * Low-level "how to operate one widget" engine, targeting the legacy
 * component ecosystem of 央国企 application portals:
 *   - WdatePicker / My97 / laydate / jeDate date controls
 *   - UEditor / wangEditor / KindEditor rich-text editors
 *   - lazy-loaded <select> (options appear after focus)
 *   - inline onchange / __doPostBack chains (WebForm)
 *   - <input type=file> via DataTransfer
 *
 * Loaded before content.js. content.js injects its own framework-compatible
 * text setter through injectHelpers() so primitives stay dependency-free.
 */
(function() {
  'use strict';
  if (window.__RF_PRIMITIVES__) return;

  let H = null; // helpers injected by content.js: { setNative, triggerEvents }

  // ----------------------------------------------------------------
  // Date helpers
  // ----------------------------------------------------------------

  /** Parse flexible date-ish string → {y, m, d} or null */
  function parseDateParts(value) {
    if (!value) return null;
    const v = String(value).trim();
    if (isPresentValue(v)) return null;
    let m = v.match(/^(\d{4})[.\-/年\s]*(\d{1,2})?[.\-/月\s]*(\d{1,2})?/);
    if (!m) return null;
    return { y: m[1], m: m[2] || '', d: m[3] || '' };
  }

  function isPresentValue(v) {
    return /^(至今|present|current|currently|now|在职|目前|-)$/i.test(String(v).trim());
  }

  /** Format {y,m,d} per dateFmt-like pattern: yyyy-MM-dd / yyyy-MM / yyyy */
  function formatDate(p, fmt) {
    if (!p) return '';
    const mm = p.m ? String(p.m).padStart(2, '0') : '';
    const dd = p.d ? String(p.d).padStart(2, '0') : '';
    if (/yyyy-MM$|yyyy-MM(?!-dd)/.test(fmt) || (!dd && !mm)) return `${p.y}${mm ? '-' + mm : ''}`;
    if (!dd) return `${p.y}-${mm}`;
    return `${p.y}-${mm}-${dd}`;
  }

  // ----------------------------------------------------------------
  // Legacy JS date pickers (WdatePicker / My97 / laydate / jeDate)
  // ----------------------------------------------------------------

  const DATE_PICKER_MARK = /WdatePicker|My97|laydate|jeDate|datepicker|DatePicker|calender|calendar/i;

  /** Text input wired to a legacy JS date picker? */
  function isLegacyDatePicker(el) {
    if (!el || el.tagName !== 'INPUT') return false;
    if (['date', 'month', 'datetime-local', 'file'].includes(el.type)) return false;
    const onclick = el.getAttribute('onclick') || '';
    const onfocus = el.getAttribute('onfocus') || '';
    const cls = typeof el.className === 'string' ? el.className : '';
    if (DATE_PICKER_MARK.test(onclick) || DATE_PICKER_MARK.test(onfocus)) return true;
    if (/\bWdate\b|laydate-icon|jeDate/.test(cls)) return true;
    return false;
  }

  /** Guess dateFmt from the picker wiring (WdatePicker({dateFmt:'yyyy-MM'})) */
  function guessDateFmt(el) {
    const wiring = (el.getAttribute('onclick') || '') + (el.getAttribute('onfocus') || '');
    const m = wiring.match(/dateFmt\s*[:=]\s*['"]([^'"]+)['"]/);
    if (m) return m[1];
    return '';
  }

  /**
   * Fill a legacy-picker input. The picker is only an input helper — the
   * server reads the raw input value — so we set text directly, dispatch
   * change, then invoke any inline onchange (common in WebForm portals).
   * Returns true if handled.
   */
  function fillLegacyDate(el, value) {
    if (isPresentValue(value)) return false; // caller handles "至今" separately
    const p = parseDateParts(value);
    if (!p) return false;
    const text = formatDate(p, guessDateFmt(el)) || String(value);
    if (!H) return false;
    const ok = H.setNative(el, text);
    if (!ok) { try { el.value = text; } catch (e) {} }
    H.triggerEvents(el);
    callInlineHandler(el, 'onchange');
    callInlineHandler(el, 'onblur');
    return true;
  }

  // ----------------------------------------------------------------
  // Rich text editors
  // ----------------------------------------------------------------

  function detectRichText(el) {
    if (!el) return null;
    const win = el.ownerDocument?.defaultView;
    // UEditor: target may sit inside or next to the .edui-editor container
    const ue = el.closest ? el.closest('.edui-editor, [class*="edui-"]') : null;
    if (ue) return { type: 'ueditor', root: ue };
    if (win && win.UE && el.tagName === 'TEXTAREA') {
      const sib = el.previousElementSibling || el.nextElementSibling;
      if (sib && /edui/.test(String(sib.className || ''))) return { type: 'ueditor', root: sib };
    }
    if ((typeof el.className === 'string' && /w-e-text/.test(el.className)) ||
        el.closest?.('.w-e-text-container')) return { type: 'wangeditor', root: el.closest('.w-e-text-container') };
    const ke = el.closest?.('.ke-container, [class*="ke-edit"]');
    if (ke) return { type: 'kindeditor', root: ke };
    return null;
  }

  function isRichText(el) {
    return !!detectRichText(el);
  }

  const rtHtml = (v) => {
    const esc = String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<p>${esc.replace(/\n/g, '</p><p>')}</p>`;
  };

  /** Fill a rich-text editor; el may be the source textarea or the editable region */
  function fillRichText(el, value) {
    const info = detectRichText(el);
    if (!info) return false;
    const doc = el.ownerDocument;
    const win = doc.defaultView;

    // UEditor — prefer the official API (keeps internal state in sync)
    if (info.type === 'ueditor') {
      if (win.UE && typeof win.UE.getEditor === 'function') {
        try {
          const edId = el.id || info.root.querySelector('textarea')?.id;
          if (edId) {
            const ed = win.UE.getEditor(edId);
            ed.setContent(rtHtml(value));
            if (typeof ed.sync === 'function') ed.sync();
            return true;
          }
        } catch (e) { /* fall through to DOM path */ }
      }
      // DOM path: write into the editable iframe body and mirror to textarea
      const frame = info.root.querySelector('iframe');
      const body = frame?.contentDocument?.body;
      if (body) {
        body.innerHTML = rtHtml(value);
        try { frame.dispatchEvent(new Event('load')); } catch (e) {}
      }
      const ta = el.tagName === 'TEXTAREA' ? el : info.root.querySelector('textarea');
      if (ta && H) { H.setNative(ta, rtHtml(value)); }
      return true;
    }

    // wangEditor — editable div lives inside the container
    if (info.type === 'wangeditor') {
      const editable = info.root.querySelector('[contenteditable="true"]') ||
                       (el.isContentEditable ? el : null);
      if (editable) {
        editable.focus();
        editable.innerHTML = rtHtml(value);
        editable.dispatchEvent(new Event('input', { bubbles: true }));
        return true;
      }
      return false;
    }

    // KindEditor — iframe body + hidden textarea
    if (info.type === 'kindeditor') {
      const frame = info.root.querySelector('iframe');
      const body = frame?.contentDocument?.body;
      if (body) body.innerHTML = rtHtml(value);
      const ta = el.tagName === 'TEXTAREA' ? el : info.root.querySelector('textarea');
      if (ta && H) H.setNative(ta, rtHtml(value));
      return !!body || !!ta;
    }
    return false;
  }

  // ----------------------------------------------------------------
  // Inline handlers (WebForm / doPostBack chains)
  // ----------------------------------------------------------------

  function callInlineHandler(el, prop) {
    try {
      const fn = el[prop];
      if (typeof fn === 'function') fn.call(el);
    } catch (e) {}
  }

  /** Fire post-save side effects for legacy portals */
  function afterSetValue(el, opts) {
    callInlineHandler(el, 'onchange');
    if (opts && opts.postback) callInlineHandler(el, 'onblur');
  }

  // ----------------------------------------------------------------
  // Lazy <select>: options appear after focus/click
  // ----------------------------------------------------------------

  /**
   * Try fn(); on failure focus the select to trigger lazy option loading and
   * retry with backoff. fn returns truthy on success.
   */
  async function withSelectRetry(el, fn, { attempts = 6, interval = 150 } = {}) {
    let r = fn();
    if (r) return r;
    for (let i = 0; i < attempts; i++) {
      try {
        el.focus();
        el.dispatchEvent(new Event('focus'));
        if (i === 1) el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      } catch (e) {}
      await new Promise(res => setTimeout(res, interval));
      r = fn();
      if (r) return r;
    }
    return null;
  }

  // ----------------------------------------------------------------
  // File input via DataTransfer (for 证件照/附件上传)
  // ----------------------------------------------------------------

  function base64ToFile(base64, name, mime) {
    const b64 = base64.includes(',') ? base64.split(',')[1] : base64;
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new File([arr], name || 'attachment', { type: mime || 'application/octet-stream' });
  }

  function fillFileInput(el, { name, base64, mime }) {
    if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return false;
    try {
      const file = base64ToFile(base64, name, mime);
      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ----------------------------------------------------------------
  // Public API
  // ----------------------------------------------------------------

  window.__RF_PRIMITIVES__ = {
    // dates
    isLegacyDatePicker,
    fillLegacyDate,
    parseDateParts,
    formatDate,
    isPresentValue,
    // rich text
    isRichText,
    fillRichText,
    // legacy portal behaviors
    afterSetValue,
    callInlineHandler,
    withSelectRetry,
    // files
    fillFileInput,
    /** content.js injects { setNative, triggerEvents } so text setting stays framework-aware */
    injectHelpers(h) { H = h; },
  };
})();
