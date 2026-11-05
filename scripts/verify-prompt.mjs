/**
 * Confirm the host half registers the tool and contributes the standing
 * visual-output policy to the system prompt.
 */
import { readFileSync } from 'node:fs'

const entry = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8')

const tools = []
const sections = []
let injected = null

const ctx = {
  tools: { register: (tool) => tools.push(tool) },
  systemPrompt: {
    getSectionOrder: (name) => ({ FILE_REFERENCE: 900, TOOL_BASH: 1000 })[name] ?? 0,
    section: (options) => sections.push(options),
  },
}

// The module imports @deepseek-ai/dsh-tools; stub defineTool via a bare loader.
const stub = `export const defineTool = (definition) => definition`
const mod = await import(`data:text/javascript,${encodeURIComponent(stub + '\n' + entry.replace(/^import[^\n]*\n/gm, ''))}`)

injected = mod.inject
mod.apply(ctx)

console.log('--- host registration ---')
console.log('inject lists tools     :', injected.includes('tools') ? 'PASS' : 'FAIL')
console.log('inject lists systemPrompt :', injected.includes('systemPrompt') ? 'PASS' : 'FAIL')
console.log('one tool registered    :', tools.length === 1 ? 'PASS' : `FAIL (${tools.length})`)
console.log('tool named show_widget :', tools[0]?.name === 'show_widget' ? 'PASS' : 'FAIL')
console.log('one prompt section     :', sections.length === 1 ? 'PASS' : `FAIL (${sections.length})`)

const section = sections[0]
console.log('section has finite order:', Number.isFinite(section?.order) ? 'PASS' : 'FAIL')
console.log('section names visual out:', section?.text?.includes('Visual output') ? 'PASS' : 'FAIL')
console.log('policy says proactive  :', section?.text?.includes('without waiting to be asked') ? 'PASS' : 'FAIL')
console.log('policy names show_widget:', section?.text?.includes('show_widget') ? 'PASS' : 'FAIL')
console.log('policy names mermaid   :', section?.text?.includes('mermaid') ? 'PASS' : 'FAIL')

const description = tools[0]?.description ?? ''
console.log('--- tool description ---')
console.log('mentions mermaid       :', description.includes('mermaid') ? 'PASS' : 'FAIL')
console.log('mentions katex         :', description.includes('KaTeX') ? 'PASS' : 'FAIL')
console.log('asks proactive use     :', description.includes('PROACTIVELY') ? 'PASS' : 'FAIL')
