// --- Hydration state restore ---

let hydrateState = null
let hydrateStateId = 0
let isHydrating = false

// --- Auto-tracking ---

let activeTracker = null

function track(getter) {
  if (activeTracker) activeTracker.add(getter)
}

// --- Ownership / disposal ---
// Each component creates a scope. control registers with the current scope.
// When a scope is disposed (component unmounts), all subscriptions auto-clean up.

let activeScope = null

function createScope(name) {
  const scope = { name: name || 'anonymous', children: [], cleanups: [], provided: {}, parent: activeScope, states: [] }
  if (activeScope) activeScope.children.push(scope)
  else __SIPPER__.scopes.push(scope)
  return scope
}

function runInScope(scope, fn) {
  const prev = activeScope
  activeScope = scope
  const result = fn()
  activeScope = prev
  return result
}

function disposeScope(scope) {
  for (const child of scope.children) disposeScope(child)
  for (const cleanup of scope.cleanups) cleanup()
  scope.children.length = 0
  scope.cleanups.length = 0
}

// --- DevTools registry ---

const __SIPPER__ = globalThis.__SIPPER__ = globalThis.__SIPPER__ || {
  states: [],       // all state instances: { id, getter, setter, subscribers, label }
  scopes: [],       // root scopes
  onChange: null     // callback when any state changes (devtools subscribes)
}

export { __SIPPER__ }

let stateCounter = 0

// --- state(value) → [getter, setter] ---

export function state(initialValue, label) {
  let value = initialValue
  if (isHydrating && hydrateState) {
    const id = hydrateStateId++
    if (id in hydrateState) value = hydrateState[id]
  }

  const isObj = typeof value === 'object' && value !== null
  const subscribers = new Set()
  const stateId = stateCounter++

  function getter() {
    track(getter)
    return value
  }

  function setter(newValueOrFn) {
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
    for (const sub of [...subscribers]) sub()
    // Notify devtools
    if (__SIPPER__.onChange) __SIPPER__.onChange()
  }

  getter._subscribers = subscribers
  getter._id = stateId

  // Register with devtools
  __SIPPER__.states.push({ id: stateId, getter, setter, subscribers, label: label || null })

  return [getter, setter]
}

// --- snapshot(value) — escape hatch from reactivity ---

export function snapshot(value) {
  return value
}

// --- Event delegation ---
// One listener per event type on the document. Handlers stamped on elements as __click, __keydown, etc.
// On event, walk up from target to find the nearest handler.

const delegatedEvents = new Set()

function ensureDelegated(eventName) {
  if (delegatedEvents.has(eventName)) return
  delegatedEvents.add(eventName)

  document.addEventListener(eventName, (e) => {
    let node = e.target
    const handlerKey = `__${eventName}`
    while (node) {
      const handler = node[handlerKey]
      if (handler) {
        handler(e)
        return
      }
      node = node.parentNode
    }
  })
}

// --- provide(key, value) / inject(key) — tree-scoped state without prop drilling ---
// provide stores a value on the current component's scope.
// inject walks up the scope tree to find it. No Provider/Consumer ceremony.

export function provide(key, value) {
  if (activeScope) activeScope.provided[key] = value
}

export function inject(key) {
  let scope = activeScope
  while (scope) {
    if (key in scope.provided) return scope.provided[key]
    scope = scope.parent
  }
  return undefined
}

// --- control(fn) ---
// The single lifecycle mechanism:
//   - Body runs immediately = setup
//   - Auto-tracked getters = reactive subscription (re-runs on change)
//   - Return a cleanup function = runs before re-execution and on unmount
//   - Registered with ownership scope = auto-disposed when component unmounts

export function control(fn) {
  let currentDeps = new Set()
  let cleanupFn = null

  function dispose() {
    for (const dep of currentDeps) dep._subscribers.delete(run)
    currentDeps.clear()
    if (cleanupFn) { cleanupFn(); cleanupFn = null }
  }

  function run() {
    if (cleanupFn) { cleanupFn(); cleanupFn = null }
    for (const dep of currentDeps) dep._subscribers.delete(run)

    const prev = activeTracker
    activeTracker = new Set()
    const result = fn()
    currentDeps = activeTracker
    activeTracker = prev

    if (typeof result === 'function') cleanupFn = result
    for (const dep of currentDeps) dep._subscribers.add(run)
  }

  if (activeScope) activeScope.cleanups.push(dispose)
  run()
}

// --- JSX runtime: h(tag, props, ...children) ---

export function h(tag, props, ...children) {
  if (typeof tag === 'function') {
    const scope = createScope(tag.name || 'Component')
    return runInScope(scope, () => {
      try {
        const result = tag(props || {})
        if (result instanceof Node) {
          result._scope = scope
          if (props && props.key != null) result._key = props.key
        }
        return result
      } catch (err) {
        console.error(`[Sipper] Error in <${tag.name || 'Anonymous'}>:`, err)
        const fallback = document.createElement('div')
        fallback.style.cssText = 'color:red;padding:8px;border:1px solid red;border-radius:4px;margin:4px 0'
        fallback.textContent = `Error in <${tag.name || 'Component'}>: ${err.message}`
        fallback._scope = scope
        return fallback
      }
    })
  }

  const el = document.createElement(tag)
  if (props && props.key != null) {
    el._key = props.key
  }
  attachProps(el, props)
  appendChildren(el, children)
  return el
}

function attachProps(el, props) {
  if (!props) return
  for (const [key, val] of Object.entries(props)) {
    if (key === 'key' || key === 'ref') {
      if (key === 'ref' && typeof val === 'function') val(el)
    } else if (key === 'class') {
      if (typeof val === 'function') {
        control(() => el.className = val())
      } else {
        el.className = val
      }
    } else if (key === 'style') {
      if (typeof val === 'function') {
        control(() => el.style.cssText = val())
      } else if (typeof val === 'object') {
        Object.assign(el.style, val)
      } else {
        el.style.cssText = val
      }
    } else if (key.startsWith('on')) {
      // Event delegation: stamp handler on element, don't addEventListener
      const eventName = key.slice(2).toLowerCase()
      el[`__${eventName}`] = val
      ensureDelegated(eventName)
    } else if (typeof val === 'function') {
      control(() => el.setAttribute(key, val()))
    } else {
      el.setAttribute(key, val)
    }
  }
}

// --- Children ---

function toNodes(value) {
  if (value == null || value === false || value === true) return []
  if (value instanceof Node) return [value]
  if (Array.isArray(value)) return value.flatMap(toNodes)
  return [document.createTextNode(String(value))]
}

function appendChildren(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue

    if (typeof child === 'function') {
      const start = document.createComment('')
      const end = document.createComment('')
      el.appendChild(start)
      el.appendChild(end)

      let prevNodes = []
      let prevKeyMap = new Map() // key → DOM node

      control(() => {
        const result = child()
        const newNodes = toNodes(Array.isArray(result) ? result : [result])

        // Check if nodes are keyed (have _key property)
        const isKeyed = newNodes.length > 0 && newNodes[0]._key != null

        if (isKeyed) {
          reconcileKeyed(el, start, end, prevNodes, prevKeyMap, newNodes)
        } else {
          // Unkeyed: clear and rebuild (simple path for text, single elements)
          let node = start.nextSibling
          while (node !== end) {
            if (node._scope) disposeScope(node._scope)
            node = node.nextSibling
          }
          while (start.nextSibling !== end) start.nextSibling.remove()
          for (const n of newNodes) el.insertBefore(n, end)
        }

        // Update prev references
        prevNodes = [...newNodes]
        prevKeyMap = new Map()
        for (const n of newNodes) {
          if (n._key != null) prevKeyMap.set(n._key, n)
        }
      })
    } else if (child instanceof Node) {
      el.appendChild(child)
    } else {
      el.appendChild(document.createTextNode(String(child)))
    }
  }
}

// --- Keyed reconciliation ---
// Compares old and new arrays by _key, reuses existing DOM nodes,
// only adds/removes/moves what actually changed.

function reconcileKeyed(parent, start, end, oldNodes, oldKeyMap, newNodes) {
  const newKeyMap = new Map()
  for (const n of newNodes) newKeyMap.set(n._key, n)

  // 1. Remove old nodes not in new set
  for (const old of oldNodes) {
    if (!newKeyMap.has(old._key)) {
      if (old._scope) disposeScope(old._scope)
      old.remove()
    }
  }

  // 2. Insert/move nodes to correct position
  let cursor = start.nextSibling
  for (const newNode of newNodes) {
    const existing = oldKeyMap.get(newNode._key)

    if (existing) {
      // Node exists — move to correct position if needed
      if (existing !== cursor) {
        parent.insertBefore(existing, cursor)
      } else {
        cursor = cursor.nextSibling
      }
      // Update content if the node has changed
      if (existing._update) existing._update(newNode._data)
    } else {
      // New node — insert before cursor
      parent.insertBefore(newNode, cursor)
    }
  }
}

// --- mount(Component, container) ---

export function mount(Component, container) {
  const tree = typeof Component === 'function' ? h(Component, null) : Component
  container.appendChild(tree)
}

// --- hydrate(Component, container) ---

export function hydrate(Component, container) {
  const script = document.querySelector('script[type="application/hydration"]')
  if (script) {
    hydrateState = JSON.parse(script.textContent)
  }
  hydrateStateId = 0
  isHydrating = true

  const tree = typeof Component === 'function' ? h(Component, null) : Component

  container.innerHTML = ''
  container.appendChild(tree)

  isHydrating = false
}
