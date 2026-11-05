/**
 * Confirm the vendored UMD bundles exist, expose the globals we rely on, and
 * can be turned into blob URLs the sandboxed iframe will accept.
 */
import { readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = process.env.VENDOR_ROOT ?? '/tmp/vendor-build/node_modules'

const files = {
  mermaid: `${root}/mermaid/dist/mermaid.min.js`,
  katexJs: `${root}/katex/dist/katex.min.js`,
  katexCss: `${root}/katex/dist/katex.min.css`,
}

for (const [name, path] of Object.entries(files)) {
  if (!existsSync(path)) {
    console.log(`${name.padEnd(9)}: MISSING ${path}`)
    continue
  }
  const body = readFileSync(path, 'utf8')
  const size = (Buffer.byteLength(body) / 1024).toFixed(0)
  console.log(`${name.padEnd(9)}: ${size}K`)
}

// The UMD wrapper must attach a global; confirm the name we plan to read.
const mermaid = readFileSync(files.mermaid, 'utf8')
const katex = readFileSync(files.katexJs, 'utf8')

const probes = (label, text, needles) => {
  console.log(`--- ${label} ---`)
  for (const needle of needles) {
    console.log(`  ${needle.padEnd(28)}: ${text.includes(needle) ? 'YES' : 'no'}`)
  }
}

probes('mermaid UMD', mermaid, ['mermaid', 'globalThis', 'registerLoader'])
probes('katex UMD', katex, ['katex', 'renderToString'])

// No external URL should be baked in that would break offline installs.
const urls = [...mermaid.matchAll(/https?:\/\/[^\s"')]+/g)].map((m) => m[0])
const unique = [...new Set(urls.map((u) => u.split('/').slice(0, 3).join('/')))]
console.log('--- 内置外部域名 ---')
console.log(unique.slice(0, 10).join('\n') || '（无）')
