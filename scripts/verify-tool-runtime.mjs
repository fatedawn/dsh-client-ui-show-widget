/**
 * Register the plugin against a real ToolRuntime on a real cordis Context.
 * ToolRuntime's only hard dependency is a `systemPrompt` service; a minimal
 * implementation satisfies it so the real registration path runs unmodified.
 */
let plugin
try {
  ({ Context, Service } = await import('@deepseek-ai/cordis'))
  ;({ ToolRuntime } = await import('@deepseek-ai/dsh-tools'))
  plugin = await import('../lib/index.js')
} catch (error) {
  // A standalone checkout has no host packages installed; the browser-side
  // suites still cover this build, so skip rather than fail the release gate.
  if (error?.code !== 'ERR_MODULE_NOT_FOUND') throw error
  console.log('SKIP: @deepseek-ai/cordis not installed in this checkout')
  process.exit(0)
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 80))

/** The slice of the prompt service the runtime touches at mount time. */
class PromptStub extends Service {
  constructor(ctx) {
    super(ctx, 'systemPrompt')
    this.sections = []
  }

  tools(register) {
    this.register = register
    return () => {}
  }

  getSectionOrder(name) {
    return { FILE_REFERENCE: 900, TOOL_BASH: 1000 }[name] ?? 0
  }

  section(options) {
    this.sections.push(options)
    return () => {}
  }
}

async function main() {
  const ctx = new Context()
  ctx.plugin(PromptStub)
  await settle()
  console.log('systemPrompt stub mounted:', ctx.systemPrompt !== undefined)

  ctx.plugin(ToolRuntime)
  await settle()
  if (ctx.tools === undefined) throw new Error('ToolRuntime did not provide ctx.tools')
  console.log('ctx.tools mounted:', typeof ctx.tools.register)

  const before = ctx.tools.schemas?.() ?? []
  ctx.plugin({ inject: plugin.inject, apply: plugin.apply })
  await settle()

  const schemas = ctx.tools.schemas()
  const names = schemas.map((schema) => schema.name ?? schema.function?.name)
  console.log('schema count after register:', schemas.length)
  console.log('names:', JSON.stringify(names))
  console.log('has show_widget:', names.includes('show_widget'))

  const resolved = typeof ctx.tools.get === 'function' ? ctx.tools.get('show_widget') : undefined
  console.log('get(show_widget):', resolved === undefined ? 'undefined' : 'found')
  if (resolved !== undefined) {
    const definition = resolved.definition ?? resolved
    console.log('  parameters.required:', JSON.stringify(definition.parameters?.required))
  }

  ctx.dispose?.()
  process.exit(0)
}

main().catch((error) => {
  console.error('FAIL:', error.stack ?? error.message)
  process.exitCode = 1
})
