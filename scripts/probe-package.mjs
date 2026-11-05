/**
 * Reproduce the host's client-package validation against this package, so the
 * discovery rules are exercised rather than assumed.
 */
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const pkgPath = join(here, '..', 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

console.log('--- package under test ---')
console.log('name   :', pkg.name)
console.log('main   :', pkg.main)

const fail = (message) => {
  console.log('FAIL  :', message)
  process.exitCode = 1
}
const pass = (message) => console.log('PASS  :', message)

// Rule 1: dsh.client.platform === "web"
const platform = pkg.dsh?.client?.platform
platform === 'web' ? pass('dsh.client.platform === "web"') : fail(`platform is ${JSON.stringify(platform)}`)

// Rule 2: exports must include "./client"
const clientRel = pkg.exports?.['./client']
if (typeof clientRel === 'string') {
  const clientAbs = join(dirname(pkgPath), clientRel)
  existsSync(clientAbs) ? pass(`exports["./client"] -> ${clientRel} exists`) : fail(`exports["./client"] -> ${clientRel} missing on disk`)
  const bytes = existsSync(clientAbs) ? readFileSync(clientAbs) : Buffer.alloc(0)
  bytes.length > 0 ? pass(`bundle is ${bytes.length} bytes`) : fail('bundle is empty')
  // The host wraps bundles as CJS factories; a bare ESM export would never register.
  const text = bytes.toString('utf8')
  text.includes('__ModuleLoader__') ? pass('bundle uses __ModuleLoader__ registration') : fail('bundle never calls __ModuleLoader__.load')
} else {
  fail('exports["./client"] absent')
}

// Rule 3: the host's own declaration parse must accept the fields present.
const decl = pkg.dsh?.client ?? {}
console.log('--- declaration ---')
console.log('inject      :', JSON.stringify(decl.inject))
console.log('immediately :', JSON.stringify(decl.immediately))
console.log('external    :', JSON.stringify(decl.external))
if (decl.immediately !== undefined && typeof decl.immediately !== 'boolean') fail('dsh.client.immediately must be boolean')
else pass('dsh.client.immediately is a valid boolean')

// Rule 4: peer range must satisfy the installed host, or it lands in skippedBundles.
console.log('--- peers ---')
for (const [name, range] of Object.entries(pkg.peerDependencies ?? {})) {
  console.log(`${name}: ${range}`)
}
