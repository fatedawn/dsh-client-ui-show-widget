/**
 * Exercise the generated document end to end in a DOM-less harness:
 * vendor strings present, CSP admits blob, fenced blocks lift, and the
 * upgrade pass calls mermaid.render for each block.
 */
import { readFileSync } from 'node:fs'

const bundle = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

let vendor = null
let registrations = []
const components = {}

const React = {
  createElement: (type, props, ...kids) => ({ type, props: props ?? {}, kids: kids.flat(9) }),
  useRef: () => ({ current: null }),
  useState: (value) => [typeof value === 'function' ? value() : value, () => {}],
  useEffect: () => {},
}

globalThis.URL.createObjectURL = () => 'blob:mock-vendor-url'
globalThis.Blob = globalThis.Blob ?? class { constructor(parts) { this.parts = parts } }

globalThis.window = {
  __ModuleLoader__: {
    load(descriptor) {
      const api = descriptor.factory((name) => {
        if (name === 'react') return React
        throw new Error(`unexpected module ${name}`)
      })
      api.apply({
        slots: {
          inject: (_name, run) => run(),
          register: (options, component) => {
            registrations.push(options)
            components[`${options.name}#${options.key ?? options.id ?? ''}`] = component
          },
        },
      })
    },
  },
}

new Function('window', bundle)(globalThis.window)

vendor = globalThis.window.__DSH_SHOW_WIDGET_VENDOR__
console.log('--- vendor handoff ---')
console.log('loader present   :', typeof vendor?.loader === 'string' ? 'PASS' : 'FAIL')
console.log('katex css present:', typeof vendor?.katexCss === 'string' && vendor.katexCss.length > 1000 ? 'PASS' : 'FAIL')
console.log('katex source     :', typeof vendor?.katexJs === 'string' && vendor.katexJs.length > 1000 ? 'PASS' : 'FAIL')
console.log('mermaid source   :', typeof vendor?.mermaid === 'string' && vendor.mermaid.length > 1000 ? 'PASS' : 'FAIL')

// Rebuild a document the way buildDocument does, by driving the registered row.
const row = components['tool.call.toolview#show_widget']
const block = {
  kind: 'ok',
  content: [{ type: 'text', text: 'ok' }],
  call: { argsRaw: JSON.stringify({ title: 'mermaid test', widget_code: '```mermaid\ngraph TD\nA-->B\n```' }) },
  isError: false,
  subCalls: [],
}

let doc = null
// WidgetFrame is a component; drive it directly so its iframe props are visible.
const frameSlot = Object.entries(components).find(([k]) => k.includes('WidgetFrame'))
const tree = row({ callId: 'c1', toolName: 'show_widget', phase: 'result', block })

/** Walk the tree, rendering nested function components to reach the iframe. */
function findIframe(node, depth = 0) {
  if (node === null || typeof node !== 'object' || depth > 12) return null
  if (node.type === 'iframe' && typeof node.props?.srcDoc === 'string') return node
  for (const kid of node.kids ?? []) {
    const found = findIframe(kid, depth + 1)
    if (found !== null) return found
  }
  // A component reference instead of an element: invoke it.
  if (typeof node.type === 'function' && node.type !== row) {
    try {
      return findIframe(node.type(node.props ?? {}), depth + 1)
    } catch {
      return null
    }
  }
  return null
}

const iframe = findIframe(tree)
if (iframe !== null) doc = iframe.props.srcDoc

console.log('--- generated document ---')
if (doc === null) {
  console.log('srcDoc captured  : FAIL (no iframe found)')
  process.exit(1)
}
console.log('srcDoc captured  : PASS')
console.log('CSP header       :', doc.includes("script-src 'unsafe-inline' 'unsafe-eval' blob:") ? 'PASS' : 'FAIL')
console.log('CSP connect none :', doc.includes("connect-src 'none'") ? 'PASS' : 'FAIL')
console.log('vendor loader    :', doc.includes('blob:') ? 'PASS' : 'FAIL')
console.log('fence lifter     :', doc.includes('liftFences') ? 'PASS' : 'FAIL')
console.log('mermaid render   :', doc.includes('mermaid.render') ? 'PASS' : 'FAIL')
console.log('katex stylesheet :', doc.includes('.katex') ? 'PASS' : 'FAIL')
console.log('helper classes   :', doc.includes('.c-purple') && doc.includes('.box') ? 'PASS' : 'FAIL')
console.log('user fragment    :', doc.includes('```mermaid') ? 'PASS' : 'FAIL')
console.log('doc size         :', (Buffer.byteLength(doc) / 1024).toFixed(0) + 'K')
