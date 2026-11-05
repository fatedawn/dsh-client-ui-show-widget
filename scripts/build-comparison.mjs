/**
 * Build both arms from one dataset so the comparison cannot drift:
 * the GFM table (old mode) and the widget fragment (new mode).
 */
import { writeFileSync } from 'node:fs'

const DATASET = [
  { tool: 'read_file', purpose: '读取文件', status: '可用' },
  { tool: 'write_file', purpose: '写入文件', status: '可用' },
  { tool: 'bash', purpose: '执行命令', status: '可用' },
  { tool: 'todo_write', purpose: '维护待办', status: '可用' },
  { tool: 'show_widget', purpose: '渲染小组件', status: '新增' },
]

/** Old mode: a GFM table renders inline with no widget at all. */
function markdownTable(rows) {
  const head = '| 工具 | 用途 | 状态 |'
  const rule = '| --- | --- | --- |'
  const body = rows.map((row) => `| ${row.tool} | ${row.purpose} | ${row.status} |`)
  return [head, rule, ...body].join('\n')
}

/** New mode: a standalone fragment the show_widget view renders in a sandbox. */
function widgetFragment(rows) {
  const cells = rows.map((row) => [
    '<tr>',
    `<td style="padding:7px 12px;border-bottom:1px solid rgba(127,127,127,.25)">${row.tool}</td>`,
    `<td style="padding:7px 12px;border-bottom:1px solid rgba(127,127,127,.25)">${row.purpose}</td>`,
    `<td style="padding:7px 12px;border-bottom:1px solid rgba(127,127,127,.25)">${row.status}</td>`,
    '</tr>',
  ].join('')).join('\n')
  return [
    '<table style="border-collapse:collapse;width:100%;font:13px/1.6 system-ui,sans-serif">',
    '<thead><tr>',
    '<th style="text-align:left;padding:7px 12px;border-bottom:2px solid rgba(127,127,127,.6)">工具</th>',
    '<th style="text-align:left;padding:7px 12px;border-bottom:2px solid rgba(127,127,127,.6)">用途</th>',
    '<th style="text-align:left;padding:7px 12px;border-bottom:2px solid rgba(127,127,127,.6)">状态</th>',
    '</tr></thead>',
    '<tbody>',
    cells,
    '</tbody>',
    '</table>',
  ].join('\n')
}

const output = {
  dataset: DATASET,
  armA_markdown: markdownTable(DATASET),
  armB_widget_args: {
    title: '工具清单',
    widget_code: widgetFragment(DATASET),
    loading_messages: ['正在整理工具清单'],
  },
}

writeFileSync(new URL('./comparison-payload.json', import.meta.url), JSON.stringify(output, null, 2) + '\n')
console.log('--- A 臂（旧模式 Markdown）---')
console.log(output.armA_markdown)
console.log('\n--- B 臂（新模式 widget_code，' + output.armB_widget_args.widget_code.length + 'B）---')
console.log(output.armB_widget_args.widget_code)
