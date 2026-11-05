/** Confirm the client registration key matches the host wire name byte for byte. */
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const registrations = []

const React = {
  createElement: () => null,
  useRef: () => ({ current: null }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
}

globalThis.window = {
  __ModuleLoader__: {
    load(descriptor) {
      const api = descriptor.factory((name) => {
        if (name === 'react') return React
        throw new Error(`unexpected module ${name}`)
      })
      api.apply({
        slots: {
          inject: (name, run) => run(),
          register: (options, component) => {
            registrations.push({ options, component })
          },
        },
      })
    },
  },
}

new Function('window', source)(globalThis.window)

console.log('module id :', JSON.stringify(source.match(/id: '([^']+)'/)?.[1]))
for (const { options } of registrations) {
  console.log(`slot name : ${JSON.stringify(options.name)}`)
  console.log(`slot key  : ${JSON.stringify(options.key ?? '')}`)
}
const row = registrations.find((r) => r.options.name === 'tool.call.toolview')
console.log('key === show_widget :', row?.options.key === 'show_widget')
console.log('component is function :', typeof row?.component === 'function')
console.log('registration count :', registrations.length)
