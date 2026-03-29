import { mount } from './runtime.js'
import { App } from './app.jsx'
import { initDevTools } from './devtools.js'

mount(App, document.getElementById('app'))
initDevTools()
