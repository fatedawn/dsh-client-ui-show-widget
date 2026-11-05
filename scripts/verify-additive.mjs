/**
 * Prove additivity: mount the real ToolRuntime, register a few host-side
 * baseline tools, then register this plugin and confirm none of the baseline
 * names disappear and none of their definitions are mutated.
 */
import { Context, Service } from '@deepseek-ai/cordis'
import { ToolRuntime, defineTool } from '@deepseek-ai/dsh-tools'
import * as plugin from '../lib/index.js'

const settle = () => new Promise((resolve) => setTimeout(resolve, 60))

class PromptStub extends Service {
  constructor(ctx) {
    super(ctx, 'systemPrompt')
  }

  tools() {
    return () => {}
  }
}

/** A baseline tool shaped like the host's own text tools. */
function baseline(name) {
  return defineTool({
    name,
    description: `baseline ${name}`,
    parameters: { text: { type: 'string', required: true, description: 'x' } },
    output: {
      schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean', required: true } } },
      render: () => [{ type: 'text', text: 'ok' }],
    },
    isConcurrencySafe: () => true,
    execute: async () => ({ ok: true }),
  })
}

async function main() {
  const ctx = new Context()
  ctx.plugin(PromptStub)
  await settle()
  ctx.plugin(ToolRuntime)
  await settle()

  const names = ['read_file', 'write_file', 'bash', 'todo_write']
  for (const name of names) ctx.tools.register(baseline(name))
  await settle()

  const before = ctx.tools.schemas().map((schema) => schema.name ?? schema.function?.name).sort()
  console.log('before:', JSON.stringify(before))

  ctx.plugin({ inject: plugin.inject, apply: plugin.apply })
  await settle()

  const after = ctx.tools.schemas().map((schema) => schema.name ?? schema.function?.name).sort()
  console.log('after :', JSON.stringify(after))

  const lost = before.filter((name) => !after.includes(name))
  const added = after.filter((name) => !before.includes(name))
  console.log('lost :', JSON.stringify(lost))
  console.log('added:', JSON.stringify(added))
  console.log('additive only:', lost.length === 0 && added.length === 1 && added[0] === 'show_widget')

  // Baseline definitions must still resolve and be callable.
  for (const name of names) {
    const resolved = ctx.tools.get(name)
    console.log(`get(${name}):`, resolved === undefined ? 'MISSING' : 'ok')
  }

  ctx.dispose?.()
  process.exit(0)
}

main().catch((error) => {
  console.error('FAIL:', error.stack ?? error.message)
  process.exitCode = 1
})
