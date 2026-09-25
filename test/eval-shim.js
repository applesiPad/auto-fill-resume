/**
 * Eval Shim — fakes the chrome.* APIs content.js needs, so the fill engine
 * can run inside plain iframes (no extension required).
 * Inlined into dist/eval.html by scripts/build-eval.js.
 */
(function () {
  if (window.__RF_SHIM__) return;
  window.__RF_SHIM__ = true;

  var mem = {
    llmSettings: { provider: 'deepseek', apiKey: 'mock-key', smartFill: true, aiDraft: true }
  };
  var llmMockFn = null;

  window.__RF_SET_LLM_MOCK__ = function (fn) { llmMockFn = fn; };
  window.__RF_EVAL_DUMP__ = function () { return JSON.parse(JSON.stringify(mem)); };

  // Chromium exposes a bare window.chrome object on normal pages — merge into
  // it instead of replacing, otherwise native stubs shadow the fake APIs.
  window.chrome = window.chrome || {};
  const fake = {
    runtime: {
      id: 'eval-shim',
      onMessage: { addListener: function () {}, removeListener: function () {} },
      sendMessage: function (msg, cb) {
        if (llmMockFn && msg && (msg.action === 'llmMapFields' || msg.action === 'llmDraftAnswer')) {
          setTimeout(function () { cb && cb(llmMockFn(msg)); }, 50);
          return;
        }
        setTimeout(function () { cb && cb(null); }, 0);
      }
    },
    storage: {
      local: {
        get: function (keys, cb) {
          var out = {};
          if (typeof keys === 'string') {
            if (mem[keys] !== undefined) out[keys] = mem[keys];
          } else if (Array.isArray(keys)) {
            keys.forEach(function (k) { if (mem[k] !== undefined) out[k] = mem[k]; });
          } else if (keys && typeof keys === 'object') {
            Object.keys(keys).forEach(function (k) { out[k] = mem[k] !== undefined ? mem[k] : keys[k]; });
          } else {
            out = Object.assign({}, mem);
          }
          setTimeout(function () { cb && cb(out); }, 0);
        },
        set: function (obj, cb) { Object.assign(mem, obj); setTimeout(function () { cb && cb(); }, 0); },
        remove: function (k, cb) {
          if (typeof k === 'string') delete mem[k];
          else if (Array.isArray(k)) k.forEach(function (x) { delete mem[x]; });
          setTimeout(function () { cb && cb(); }, 0);
        }
      }
    }
  };
  if (!window.chrome.runtime) window.chrome.runtime = fake.runtime;
  if (!window.chrome.storage) window.chrome.storage = fake.storage;
})();
