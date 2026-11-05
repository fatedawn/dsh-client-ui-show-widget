/**
 * Load the built document in a real Chrome page and report whether mermaid and
 * KaTeX actually produced output. The iframe is reproduced with srcdoc, the same
 * way the widget renders it, so CSP and blob-script loading are exercised for
 * real rather than asserted by string matching.
 */
import { writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const PORT = 9333

const SOURCE = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

/** Capture the document the widget would put into srcdoc. */
let captured = null
const React = {
  createElement: (type, props, ...kids) => ({ type, props: props ?? {}, kids: kids.flat(9) }),
  useRef: () => ({ current: null }),
  useState: (v) => [typeof v === 'function' ? v() : v, () => {}],
  useEffect: () => {},
  useSyncExternalStore: (_s, snap) => snap(),
}

globalThis.window = {
  __DSH_SHOW_WIDGET_VENDOR__: undefined,
  URL: { createObjectURL: () => 'blob:stub', revokeObjectURL: () => {} },
  Blob: class { constructor(parts) { this.parts = parts } },
  __ModuleLoader__: {
    load(descriptor) {
      const api = descriptor.factory((name) => {
        if (name === 'react') return React
        throw new Error(`unexpected module ${name}`)
      })
      api.apply({ slots: { inject: (_n, run) => run(), register: () => {} } })
    },
  },
}

// The vendor body is prepended by the build; evaluate it so VENDOR resolves.
new Function('window', SOURCE)(globalThis.window)

const vendor = globalThis.window.__DSH_SHOW_WIDGET_VENDOR__
console.log('vendor present   :', vendor !== undefined ? 'PASS' : 'FAIL')
console.log('vendor.mermaid KB:', vendor?.mermaid ? Math.round(vendor.mermaid.length / 1024) : 0)

/** Build the same kind of document the plugin builds, via its own builder. */
const FRAGMENT = [
  '<div class="mermaid">flowchart LR',
  '  A[提问] --> B[思考]',
  '  B --> C[工具]',
  '</div>',
  '$$E = mc^2$$',
  '<pre><code class="language-mermaid">flowchart TD',
  '  Q[围栏] --> R[图]',
  '</code></pre>',
].join('\n')
const built = globalThis.window.__DSH_TEST_BUILD__?.(FRAGMENT)
if (built === undefined || built === null) {
  console.log('buildDocument hook missing: FAIL')
  process.exit(1)
}
console.log('doc size KB      :', Math.round(built.length / 1024))

// Same payload the widget posts to its frame.
const vendorPayload = { katexJs: vendor?.katexJs ?? '', mermaid: vendor?.mermaid ?? '' }

// The frame's own inline script must parse on its own; a stray escape here is
// what turns the whole widget into a blank card.
const inline = [...built.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1])
console.log('inline scripts   :', inline.length)
inline.forEach((body, index) => {
  try {
    new Function(body)
    console.log(`  script[${index}] parse : PASS (${body.length}b)`)
  } catch (error) {
    console.log(`  script[${index}] parse : FAIL ${error.message}`)
    const lines = body.split('\n')
    lines.forEach((line, n) => {
      try { new Function(line) } catch { console.log(`    line ${n + 1}: ${line.slice(0, 120)}`) }
    })
  }
})

const dir = mkdtempSync(join(tmpdir(), 'widget-probe-'))
const pagePath = join(dir, 'probe.html')
const payloadPath = join(dir, 'payload.js')
// Library source stays out of the page script: mermaid contains the literal
// `</script>`, which would close the page script and produce a false SyntaxError.
writeFileSync(payloadPath, `globalThis.__PAYLOAD__ = ${JSON.stringify(vendorPayload)};\n`)
// JSON does not escape `</script>`; a raw embed would close this page script.
const embeddedDoc = JSON.stringify(built).replace(/</g, '\\u003c')
writeFileSync(pagePath, `<!doctype html><meta charset="utf-8"><body>
<iframe id="f" sandbox="allow-scripts" style="width:700px;height:600px;border:0"></iframe>
<script src="./payload.js"></script>
<script>
const doc = ${embeddedDoc};
const f = document.getElementById('f');
f.srcdoc = doc;
window.__events = [];
window.addEventListener('message', (e) => {
  const d = e.data;
  if (!d || typeof d !== 'object') return;
  window.__events.push(d.type);
  if (d.type === 'dsh-show-widget-ready') {
    f.contentWindow.postMessage({ type: 'dsh-show-widget-libs', payload: globalThis.__PAYLOAD__ }, '*');
  }
  if (d.type === 'dsh-show-widget-height') window.__h = d.height;
  if (d.type === 'dsh-show-widget-probe') window.__probe = d.report;
});
<\/script></body>`)

const chrome = spawn(CHROME, [
  '--headless=new', `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check',
  '--disable-gpu', '--allow-file-access-from-files', `--user-data-dir=${join(dir, 'profile')}`,
  `file:///${pagePath.replace(/\\/g, '/')}`,
], { stdio: 'ignore' })

const wait = (ms) => new Promise((r) => setTimeout(r, ms))
await wait(1800)

let target = null
for (let i = 0; i < 20 && target === null; i += 1) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
    target = list.find((t) => t.type === 'page')
  } catch { await wait(300) }
}
if (target === null) { console.log('chrome target missing: FAIL'); chrome.kill(); process.exit(1) }

const { WebSocket } = await import('node:worker_threads').then(() => globalThis)

// Minimal CDP client over the built-in WebSocket.
const ws = new (globalThis.WebSocket)(target.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const logs = []
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.id !== undefined && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`)
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    const d = msg.params.exceptionDetails
    logs.push(`EXCEPTION ${d.url ?? ''}#${d.lineNumber}:${d.columnNumber} ${d.exception?.description ?? d.text}`)
  }
})
await new Promise((r) => ws.addEventListener('open', r))

const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id
  pending.set(mid, resolve)
  ws.send(JSON.stringify({ id: mid, method, params }))
})

await send('Runtime.enable')
await send('Page.enable')
await wait(6500)

const evalIn = async (expression, contextId) => {
  const res = await send('Runtime.evaluate', {
    expression, returnByValue: true, awaitPromise: true,
    ...(contextId === undefined ? {} : { contextId }),
  })
  return res.result?.result?.value
}

// Find the iframe's execution context and inspect what it rendered.
const contexts = []
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data)
  if (msg.method === 'Runtime.executionContextCreated') contexts.push(msg.params.context)
})
await send('Runtime.disable')
await send('Runtime.enable')
await wait(900)

console.log('contexts:', JSON.stringify(contexts.map((c) => ({ id: c.id, origin: c.origin, aux: c.auxData?.frameId, name: c.name }))))
let report = null
for (const ctx of contexts) {
  const hit = await evalIn(`(() => {
    const mm = document.querySelectorAll('.mermaid');
    const svg = document.querySelectorAll('.mermaid svg, .mermaid svg[id]');
    const err = document.querySelectorAll('.mermaid-error');
    const katex = document.querySelectorAll('.katex');
    return JSON.stringify({
      blocks: mm.length,
      svgs: document.querySelectorAll('svg').length,
      merr: err.length,
      merrText: err[0] ? err[0].textContent.slice(0, 160) : '',
      katex: katex.length,
      hasMermaidGlobal: typeof window.mermaid,
      scripts: document.querySelectorAll('script[src^="blob:"]').length,
    })
  })()`, ctx.id)
  if (hit && hit.includes('hasMermaidGlobal')) report = report ?? hit
}

const pageState = await evalIn('JSON.stringify({ href: location.href, events: window.__events, payload: typeof globalThis.__PAYLOAD__, src: document.querySelector("iframe")?.srcdoc?.slice(0, 40), scripts: document.scripts.length })')
console.log('page state:', pageState)
const step = await evalIn(`(() => {
  const f = document.getElementById('f');
  const before = f.srcdoc.length;
  f.srcdoc = ${JSON.stringify(built)};
  return JSON.stringify({ before, after: f.srcdoc.length, hasRoot: f.srcdoc.includes('id="root"') });
})()`)
console.log('srcdoc step:', step)
await wait(500)
const posted = await evalIn(`(() => {
  const f = document.getElementById('f');
  if (!f.contentWindow) return 'no-window';
  f.contentWindow.postMessage({ type: 'dsh-show-widget-libs', payload: globalThis.__PAYLOAD__ }, '*');
  f.contentWindow.postMessage({ type: 'dsh-show-widget-probe' }, '*');
  return 'posted';
})()`)
console.log('libs posted:', posted)
await wait(5000)
const after = await evalIn('JSON.stringify({ events: window.__events, h: window.__h, probe: window.__probe })')
console.log('after handshake:', after)
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
console.log('targets:', JSON.stringify(targets.map((t) => ({ type: t.type, url: t.url }))))
console.log('--- iframe report ---')
if (report === null) {
  console.log('no iframe context reached: FAIL')
} else {
  console.log(report)
}
console.log('--- console ---')
for (const line of logs.slice(0, 12)) console.log(line)

ws.close()
chrome.kill()
