/**
 * Run the payload fixtures through the plugin's real author schema and body,
 * reporting which pass validation and what the model-facing text would be.
 */
import { readFileSync } from 'node:fs'
import { validateArgs } from '@deepseek-ai/dsh-tools'
import * as plugin from '../lib/index.js'

const SPEC = {
  title: { type: 'string', required: true, description: 'x' },
  widget_code: { type: 'string', required: true, description: 'x' },
  loading_messages: { type: 'array', items: { type: 'string' }, description: 'x' },
}

const fixtures = JSON.parse(readFileSync(new URL('./test-payloads.json', import.meta.url), 'utf8'))

async function main() {
  const registered = []
  plugin.apply({ tools: { register: (definition) => registered.push(definition) } })
  const tool = registered[0]

  for (const fixture of fixtures.cases) {
    const violations = validateArgs(SPEC, fixture.args)
    const rejected = violations.length > 0
    const expectedReject = fixture.name.includes('错误态')
    const verdict = rejected === expectedReject ? 'PASS' : 'FAIL'

    let detail = rejected ? violations.join('; ') : ''
    if (!rejected && !expectedReject) {
      const value = await tool.execute(fixture.args)
      detail = `execute=${JSON.stringify(value)} code=${fixture.args.widget_code.length}B`
    }
    console.log(`[${verdict}] ${fixture.name}: ${detail}`)
  }
}

main().catch((error) => {
  console.error('FAIL:', error.stack ?? error.message)
  process.exitCode = 1
})
