/**
 * Verify the tail-seat strategy: two slots registered, the store publishes
 * settled widgets, and the tail view yields a frame only when one exists.
 */
import { readFileSync } from 'node:fs'

const SOURCE = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

const registrations = []
let components = {}

/** Hook cells per component instance, so two tails never share a slot. */
const instanceCells = new Map()
let activeInstance = 'root'
let renderCursor = 0

/** Render a component under its own hook namespace. */
function renderAs(key, component, props) {
  activeInstance = key
  renderCursor = 0
  return component(props)
}

function cellFor(store, initial) {
  const key = `${activeInstance}#${renderCursor}`
  renderCursor += 1
  if (!store.has(key)) store.set(key, initial)
  return [key, store.get(key)]
}

const React = {
  createElement(type, props, ...kids) {
    const el = { type, props: props ?? {}, kids: kids.flat(9).filter((k) => k !== null && k !== undefined && k !== false) }
    return el
  },
  // Refs must persist across renders of the same call site, like React's.
  useRef: (value = null) => {
    const [key] = cellFor(refCells, { current: value })
    return refCells.get(key)
  },
  useState(initial) {
    const [key, current] = cellFor(stateCells, typeof initial === 'function' ? initial() : initial)
    const set = (next) => stateCells.set(key, typeof next === 'function' ? next(stateCells.get(key)) : next)
    return [stateCells.get(key), set]
  },
  // Collect effects so they run after the render returns, as React does.
  useEffect: (fn) => {
    pendingEffects.push(fn)
  },
  useSyncExternalStore: (subscribe, snapshot) => snapshot(),
}

const stateCells = new Map()
const refCells = new Map()

const pendingEffects = []

/**
 * Run queued effects, then clear the call-site cursor. Effects may set state,
 * which the next component call reads back through the same cells.
 */
function flushEffects() {
  renderCursor = 0
  const queued = pendingEffects.splice(0)
  for (const fn of queued) fn()
}

globalThis.window = {
  // The tail resolves its own node through the transcript DOM, which an offline
  // render cannot provide. An empty document makes those scans no-ops so the
  // assertions below stay meaningful.
  document: { querySelectorAll: () => [], querySelector: () => null },
  setInterval: () => 0,
  clearInterval: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
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
            components[`${options.name}#${options.key ?? ''}`] = component
          },
        },
      })
    },
  },
}

new Function('window', SOURCE)(globalThis.window)

console.log('--- registrations ---')
for (const r of registrations) console.log(`${r.name}  key=${JSON.stringify(r.key ?? '')}`)

const rowSlot = registrations.find((r) => r.name === 'tool.call.toolview')
const tailSlot = registrations.find((r) => r.name === 'conversation.chat.turnTail')
console.log('row slot  :', rowSlot?.key === 'show_widget' ? 'PASS' : 'FAIL')
console.log('tail slot :', tailSlot !== undefined ? 'PASS' : 'FAIL')

const WidgetRow = components['tool.call.toolview#show_widget']
const WidgetTail = components['conversation.chat.turnTail#']

/** Depth-first walk for the frame element. */
function frames(el, hits = []) {
  if (el === null || typeof el !== 'object') return hits
  if (typeof el.type === 'function' && el.type.name === 'WidgetFrame') hits.push(el)
  for (const kid of el.kids ?? []) frames(kid, hits)
  return hits
}

// The tail renders nothing before any widget exists.
flushEffects()
const emptyTail = renderAs('tail-3', WidgetTail, { turn: 3, seq: 1 })
flushEffects()
// No widget yet: an invisible anchor stays mounted so prose fences can be scanned.
console.log('tail before any widget :', emptyTail?.props?.['data-show-widget-tail'] === '' && frames(emptyTail).length === 0 ? 'PASS (anchor)' : 'FAIL')

// Ownership of a widget by a turn comes from the transcript DOM: a tool row
// publishes from its own effect, and the transcript mounts that row BEFORE the
// tail, so no publish-count watermark can tell the two apart. That path is
// covered end to end by scripts/probe-dom.js and probe-structure.js over CDP;
// an offline render has no DOM to read, so only the row is asserted here.
const block = {
  kind: 'ok',
  content: [{ type: 'text', text: 'ok' }],
  call: { argsRaw: JSON.stringify({ title: '工具清单', widget_code: '<table><tr><td>x</td></tr></table>' }) },
  isError: false,
  subCalls: [],
}
const row = renderAs('row', WidgetRow, { callId: 'call-1', toolName: 'show_widget', phase: 'result', block })
flushEffects()
const rowFrames = frames(row)
console.log('row renders frame      :', rowFrames.length === 1 && rowFrames[0].props.title === '工具清单' ? 'PASS' : `FAIL (${rowFrames.length})`)
console.log('row anchors frame      :', rowFrames[0]?.props?.anchor === 'row:call-1' ? 'PASS' : 'FAIL')
console.log('row marks its call     :', row?.props?.['data-call-id'] === 'call-1' ? 'PASS' : 'FAIL')

// Errors must never render a widget.
const errorBlock = { kind: 'error', content: [{ type: 'text', text: 'boom' }], call: { argsRaw: JSON.stringify({ title: 'bad', widget_code: '<b>x</b>' }) }, isError: true }
const errorRow = renderAs('row', WidgetRow, { callId: 'call-2', toolName: 'show_widget', phase: 'result', block: errorBlock })
flushEffects()
console.log('error row hides frame  :', frames(errorRow).length === 0 ? 'PASS' : 'FAIL')

// A row that has not settled yet shows the preparing header and no frame.
const preparing = renderAs('row', WidgetRow, { callId: 'call-3', toolName: 'show_widget', phase: 'preparing', block })
console.log('preparing hides frame  :', frames(preparing).length === 0 ? 'PASS' : 'FAIL')

// With no DOM the tail stays an inert anchor instead of throwing.
const tail = renderAs('tail-3', WidgetTail, { turn: 3, seq: 1 })
flushEffects()
console.log('tail inert without dom :', tail?.props?.['data-show-widget-tail'] !== undefined && frames(tail).length === 0 ? 'PASS' : 'FAIL')

/** A node the scanner can walk, shaped like the chat host's turn markup. */
function el(attrs, children = [], tag = 'div') {
  const node = {
    attrs,
    children,
    tag,
    closest(selector) {
      return selector === '[data-turn-tail]' && this.getAttribute('data-turn-tail') !== null ? this : null
    },
    getAttribute: (name) => attrs[name] ?? null,
    matches: (selector) => selector === '.md-code-block' && attrs.class === 'md-code-block',
    querySelector: (selector) => {
      const found = []
      const visit = (node) => {
        if (typeof node === 'string') return
        if (selector === 'pre' && node.tag === 'pre') found.push(node)
        if (selector.includes('infostring') && node.attrs.class === 'infostring') found.push(node)
        node.children.forEach(visit)
      }
      visit(node)
      return found[0] ?? null
    },
    querySelectorAll(selector) {
      const found = []
      const visit = (current) => {
        if (typeof current !== 'object' || current === null) return
        if (selector === '.md-code-block' && current.matches?.('.md-code-block')) found.push(current)
        current.children?.forEach(visit)
      }
      this.children.forEach(visit)
      return found
    },
    get textContent() {
      return this.children.map((child) => (typeof child === 'string' ? child : child.textContent)).join('')
    },
  }
  return node
}

const turn = el({ 'data-turn-tail': '7' })
const code = el({ class: 'md-code-block' }, [
  el({ class: 'infostring' }, ['mermaid']),
  el({}, ['flowchart LR\n  A --> B'], 'pre'),
])
const prose = el({}, [code])
const previous = el({ 'data-turn-tail': '6' })
turn.previousElementSibling = prose
prose.previousElementSibling = previous
previous.previousElementSibling = null
console.log('sibling:', turn.previousElementSibling === prose, prose.matches('.md-code-block'), prose.querySelectorAll('.md-code-block').length)
console.log('label match:', JSON.stringify(code.querySelector('[class*="infostring"], [data-code-block-banner]')?.textContent))
console.log('pre match:', JSON.stringify(code.querySelector('pre')?.textContent))
const found = globalThis.window.__DSH_TEST_PROSE__(turn)
console.log('prose mermaid lifted   :', found.length === 1 && found[0].startsWith('flowchart LR') ? 'PASS' : `FAIL (${found.length})`)
