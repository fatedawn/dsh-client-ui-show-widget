/**
 * Ask the real client-module composition what it makes of this package:
 * whether it is discovered as a client bundle, and what it declares.
 */
import { readFileSync } from 'node:fs'

const ENTRY = 'E:/tools/node-v22.22.3-win-x64/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-modules/lib/index.js'
const source = readFileSync(ENTRY, 'utf8')

// Surface the package discovery predicate so the actual rule can be read, not guessed.
for (const pattern of [/function readClientDecl[\s\S]{0,900}/, /dsh\.client\.platform[\s\S]{0,300}/]) {
  const hit = source.match(pattern)
  if (hit) {
    console.log('----- discovery rule -----')
    console.log(hit[0].slice(0, 900))
    console.log('--------------------------')
  }
}
