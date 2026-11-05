/**
 * Host half of the show_widget bundle.
 *
 * Registering the tool is what makes `show_widget` callable by the model and
 * places its name on the wire; the browser half keys its tool view on that same
 * name. The call payload is the card the person sees, so the model-facing
 * content is a short receipt instead of the widget source.
 *
 * @module dsh-client-ui-show-widget
 */
import { defineTool } from '@deepseek-ai/dsh-tools'

/** Stable Loader identity, matching the profile patch row id. */
export const name = 'client-ui-show-widget'

/** Both services must exist before this plugin can register anything. */
export const inject = ['tools', 'systemPrompt']

/**
 * Standing instruction that makes the model reach for a widget without being
 * asked. A tool description alone loses to the model's habit of writing prose,
 * so the same expectation is also stated in the system prompt.
 */
const WIDGET_POLICY = [
  '# Visual output',
  '',
  '`show_widget` is the default way to answer anything structural or comparative.',
  'Call it without waiting to be asked whenever the reply would otherwise contain',
  'three or more parallel items, or would describe a flow, hierarchy, proportion,',
  'timeline, sequence, state machine or architecture.',
  '',
  'Use it instead of: bullet lists that enumerate comparable things, markdown tables,',
  'and paragraphs that explain a process step by step. Do not ask permission first,',
  'and do not describe a diagram in prose while skipping the widget.',
  '',
  'Inside `widget_code`, prefer a ```mermaid fenced block for flowcharts, sequences,',
  'class and state diagrams, gantt, pie, journey, mindmap and xychart; use HTML or',
  'inline SVG only when an exact layout is needed. Display math goes in `$$...$$`.',
  'Keep each widget focused, and write your prose around it rather than stacking',
  'several dense diagrams back to back.',
].join('\n')

/**
 * Register the model-facing `show_widget` tool and its standing instruction.
 * @param ctx - Host root context.
 */
export function apply(ctx) {
  // The policy is advisory: a host whose prompt registry predates `section`
  // must still get the tool, so this cannot be allowed to abort registration.
  try {
    ctx.systemPrompt.section({
      name: 'show-widget:policy',
      // Just ahead of the tool sections, so the expectation frames them rather
      // than trailing the per-tool instructions.
      order: 950,
      text: WIDGET_POLICY,
    })
  } catch {
    // Older hosts expose no prompt registry; the tool description still applies.
  }

  ctx.tools.register(defineTool({
    name: 'show_widget',
    description: [
      'Render an inline widget in the conversation instead of writing a file.',
      'Pass one self-contained HTML fragment in widget_code: SVG diagrams, illustrations,',
      'tables, or small HTML interactions. The fragment is shown to the person, not',
      'returned to you, so never rely on it as a record of the answer.',
      '',
      'USE THIS TOOL PROACTIVELY. Whenever a visual would communicate faster than prose,',
      'call it without being asked: comparisons, tool or component inventories,',
      'architecture and process flows, timelines, sequences, proportions, hierarchies,',
      'state machines, data trends, or any explanation where a picture beats a paragraph.',
      'If the answer would contain three or more parallel items, or describe a flow,',
      'structure or relationship, prefer a widget over a bullet list or a markdown table.',
      'Do not ask permission and do not describe a diagram in text while skipping the widget.',
      '',
      'Mermaid diagrams are available: put a ```mermaid fenced block in the fragment',
      'and it renders as a diagram. Reach for it first for flowchart, sequence, class,',
      'state, gantt, pie, journey, mindmap and xychart needs.',
      'KaTeX math is available: wrap display math in $$...$$ and inline math in \\(...\\).',
      'Use SVG or HTML tables when you need an exact custom layout mermaid cannot express.',
      'Keep each widget small and use several calls rather than one dense diagram;',
      'write prose between widgets instead of stacking them back to back.',
    ].join(' '),
    parameters: {
      title: {
        type: 'string',
        required: true,
        description: 'Short title shown on the widget card.',
      },
      widget_code: {
        type: 'string',
        required: true,
        description: 'Self-contained HTML or SVG fragment to render.',
      },
      loading_messages: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional status lines shown while the widget renders.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string', required: true },
          status: { type: 'string', required: true },
        },
      },
      render: (args, value) => [{
        type: 'text',
        text: `Widget "${value.title}" rendered (${value.status}) and is now visible to the person.`,
      }],
    },
    isConcurrencySafe: () => true,
    execute(args) {
      return Promise.resolve({ title: args.title, status: 'rendered' })
    },
  }))
}
