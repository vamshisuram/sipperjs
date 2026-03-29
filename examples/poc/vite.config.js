import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import reactiveJSX from './plugins/reactive-jsx.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Plugin to swap runtime.js → runtime.server.js during SSR
function ssrRuntimeSwap() {
  return {
    name: 'ssr-runtime-swap',
    enforce: 'pre',
    resolveId(source, importer, options) {
      if (options?.ssr && importer?.includes('/src/')) {
        if (source === './runtime.js' || source === '/src/runtime.js') {
          return resolve(__dirname, 'src/runtime.server.js')
        }
      }
    }
  }
}

export default {
  plugins: [ssrRuntimeSwap(), reactiveJSX()],
  esbuild: {
    jsx: 'preserve'
  }
}
