// Server runtime — same API as client, but renders to HTML strings.
// state() works the same. h() produces strings. control/onHydrate are no-ops.

let stateId = 0
const stateStore = new Map()

function resetServer() {
  stateId = 0
  stateStore.clear()
}

// --- state(value) → [getter, setter] ---

export function state(initialValue) {
  const id = stateId++
  let value = initialValue

  function getter() { return value }
  function setter(newValueOrFn) {
    const isObj = typeof value === 'object' && value !== null
    if (typeof newValueOrFn === 'function') {
      if (isObj) {
        const draft = structuredClone(value)
        const result = newValueOrFn(draft)
        value = result !== undefined ? result : draft
      } else {
        value = newValueOrFn(value)
      }
    } else {
      value = newValueOrFn
    }
  }

  stateStore.set(id, getter)
  return [getter, setter]
}

// --- No-ops on server (no reactivity, no DOM, no subscriptions) ---

export function control() {}
export function snapshot(value) { return value }

// --- provide/inject — works on server via simple stack ---
const provideStack = [{}]
export function provide(key, value) { provideStack[provideStack.length - 1][key] = value }
export function inject(key) {
  for (let i = provideStack.length - 1; i >= 0; i--) {
    if (key in provideStack[i]) return provideStack[i][key]
  }
  return undefined
}

// --- HTML escaping + raw HTML marker ---

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

class RawHtml {
  constructor(html) { this.html = html }
  toString() { return this.html }
}

// --- Void elements ---

const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','source','track','wbr'])

// --- JSX runtime: h(tag, props, ...children) → HTML string ---

export function h(tag, props, ...children) {
  // Component function
  if (typeof tag === 'function') {
    provideStack.push({})
    try {
      const result = tag(props || {})
      return result
    } catch (err) {
      return new RawHtml(`<div style="color:red;padding:8px;border:1px solid red">Error in &lt;${tag.name || 'Component'}&gt;: ${escapeHtml(err.message)}</div>`)
    } finally {
      provideStack.pop()
    }
  }

  let html = `<${tag}`

  // Props / attributes
  if (props) {
    for (const [key, val] of Object.entries(props)) {
      // Skip client-only props
      if (key === 'ref') continue
      if (key.startsWith('on')) continue

      if (key === 'class') {
        const v = typeof val === 'function' ? val() : val
        if (v) html += ` class="${escapeHtml(v)}"`
      } else if (key === 'style') {
        if (typeof val === 'object') {
          const css = Object.entries(val).map(([k, v]) => `${k}:${v}`).join(';')
          html += ` style="${escapeHtml(css)}"`
        } else {
          const v = typeof val === 'function' ? val() : val
          if (v) html += ` style="${escapeHtml(v)}"`
        }
      } else {
        const v = typeof val === 'function' ? val() : val
        if (v != null && v !== false) html += ` ${key}="${escapeHtml(v)}"`
      }
    }
  }

  if (VOID.has(tag)) return new RawHtml(html + ' />')

  html += '>'
  html += renderChildren(children)
  html += `</${tag}>`
  return new RawHtml(html)
}

function childToHtml(child) {
  if (child == null || child === false || child === true) return ''
  if (child instanceof RawHtml) return child.html
  if (Array.isArray(child)) return child.map(childToHtml).join('')
  if (typeof child === 'function') {
    const result = child()
    if (Array.isArray(result)) return result.map(childToHtml).join('')
    return childToHtml(result)
  }
  return escapeHtml(String(child))
}

function renderChildren(children) {
  // Insert comment markers between children so the client can match
  // each child to exactly one DOM node during hydration.
  const flat = children.flat(Infinity).filter(c => c != null && c !== false && c !== true)
  if (flat.length === 0) return ''

  const parts = flat.map(childToHtml)
  // Separate adjacent children with comment nodes so the browser
  // doesn't merge them into a single text node
  let html = ''
  for (let i = 0; i < parts.length; i++) {
    if (i > 0) html += '<!---->'
    html += parts[i]
  }
  return html
}

// --- renderToString(Component) → { html, state } ---

export function renderToString(Component) {
  resetServer()
  const result = typeof Component === 'function' ? Component({}) : Component
  const html = result instanceof RawHtml ? result.html : String(result)

  // Collect serialized state
  const serialized = {}
  for (const [id, getter] of stateStore) {
    serialized[id] = getter()
  }

  return { html, state: serialized }
}
