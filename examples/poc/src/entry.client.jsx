import { hydrate } from './runtime.js'
import { App } from './app.jsx'

hydrate(App, document.getElementById('app'))
