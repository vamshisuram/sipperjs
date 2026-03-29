import { renderToString } from './runtime.server.js'
import { App } from './app.jsx'

export function render() {
  return renderToString(App)
}
