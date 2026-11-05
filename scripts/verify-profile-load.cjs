/**
 * Load the real desktop profile through dsh-app-boot and report whether the
 * show-widget bundle resolved to a patch layer or was skipped.
 */
const path = require('node:path')
const fs = require('node:fs')

const APP_BOOT = 'E:/tools/node-v22.22.3-win-x64/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-app-boot/lib/index.js'
const INSTALL_ANCHOR = 'E:/tools/node-v22.22.3-win-x64/node_modules/@deepseek-ai/dsh/package.json'
const PROFILE_DIR = 'C:/Users/Administrator/.dsh/profiles/desktop'

async function main() {
  const boot = await import('file:///' + APP_BOOT.replace(/\\/g, '/'))
  const exported = Object.keys(boot).filter((key) => /loadProfile|readProfile/i.test(key))
  console.log('relevant exports:', exported.join(','))

  const loader = boot.loadProfileDirectory ?? boot.loadProfile
  if (typeof loader !== 'function') {
    console.log('NO LOADER EXPORT; all exports:', Object.keys(boot).join(','))
    return
  }

  const profile = loader('dsh', PROFILE_DIR, INSTALL_ANCHOR)
  console.log('profile name:', profile.name)
  console.log('layers:', profile.layers.map((layer) => layer.packageName).join(' | '))
  console.log('skipped:', JSON.stringify(profile.skippedBundles, null, 1))

  const mine = profile.layers.find((layer) => layer.packageName === 'dsh-client-ui-show-widget')
  if (mine === undefined) {
    console.log('RESULT: show-widget bundle NOT loaded')
    return
  }
  console.log('RESULT: loaded')
  console.log('  packageDir:', mine.packageDir)
  console.log('  patchPaths:', mine.patchPaths.join(','))
  console.log('  patches:', JSON.stringify(mine.patches))
}

main().catch((error) => {
  console.error('FAIL:', error && error.stack ? error.stack : error)
  process.exitCode = 1
})
