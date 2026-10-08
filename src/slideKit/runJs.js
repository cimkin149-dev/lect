// Runs lecturer/AI-written JavaScript in a Web Worker so it can't touch the page,
// the DOM or localStorage (where sign-in tokens live), and so an infinite loop is
// killed by the timeout instead of freezing the lecture. Network and storage APIs
// are removed inside the worker as a best-effort extra.

export const WORKER_SOURCE = `
const __lines = [];
const __fmt = (a) => a.map((x) => { if (typeof x === 'string') return x; try { return JSON.stringify(x); } catch (e) { return String(x); } }).join(' ');
const __log = (...a) => { __lines.push(__fmt(a)); if (__lines.join('\\n').length > 10000) throw new Error('Output limit reached'); };
const __console = { log: __log, info: __log, warn: __log, error: __log };
['fetch','XMLHttpRequest','WebSocket','importScripts','indexedDB','caches','EventSource','BroadcastChannel','SharedWorker','Worker'].forEach((k) => { try { Object.defineProperty(self, k, { value: undefined, configurable: true }); } catch (e) {} });
self.onmessage = (e) => {
  let error = '';
  try { new Function('console', e.data)(__console); } catch (err) { error = String(err && err.message ? err.message : err); }
  setTimeout(() => postMessage({ output: __lines.join('\\n'), error }), 40);
};
`;

export function runJavaScript(code, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (typeof Worker === "undefined" || typeof Blob === "undefined") {
      resolve({ output: "", error: "Running code isn't supported in this browser.", timedOut: false });
      return;
    }
    let worker;
    let url;
    const finish = (r) => {
      try { worker && worker.terminate(); } catch (e) { /* ignore */ }
      try { url && URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
      resolve(r);
    };
    try {
      url = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }));
      worker = new Worker(url);
    } catch (e) {
      finish({ output: "", error: "Couldn't start the code runner.", timedOut: false });
      return;
    }
    const timer = setTimeout(() => finish({ output: "", error: `Stopped: the code ran longer than ${timeoutMs / 1000} seconds (infinite loop?).`, timedOut: true }), timeoutMs);
    worker.onmessage = (e) => { clearTimeout(timer); finish({ ...e.data, timedOut: false }); };
    worker.onerror = (e) => { clearTimeout(timer); finish({ output: "", error: String((e && e.message) || "Error"), timedOut: false }); };
    worker.postMessage(String(code));
  });
}
