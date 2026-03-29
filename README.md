# Sipper

A reactive UI framework with **3 APIs**. No VDOM. No hooks. No lifecycle methods. SSR-first.

```
npm install sipperjs
```

## The Entire API

```js
import { state, control, snapshot } from 'sipperjs'
```

| API | What it does |
|-----|-------------|
| `state(value)` | Create state → `[getter, setter]` |
| `control(fn)` | Lifecycle — setup, reactive subscriptions, cleanup |
| `snapshot(value)` | Escape hatch — freeze a value |

Derived values are plain functions. Components run once. No re-renders.

## Quick Start

```jsx
import { h, state, control, mount } from 'sipperjs'

function Counter() {
  const [getCount, setCount] = state(0)
  const doubled = getCount() * 2  // auto-reactive (build transform)

  return (
    <div>
      <p>Count: {getCount()}</p>
      <p>Doubled: {doubled}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}

mount(Counter, document.getElementById('app'))
```

## How It Works

### State

```js
const [getCount, setCount] = state(0)

getCount()           // always returns the latest value
setCount(5)          // set directly
setCount(c => c + 1) // updater function
```

### Objects with Immer-Style Updates

```js
const [getUser, setUser] = state({ name: 'V', settings: { theme: 'dark' } })

setUser(draft => {
  draft.settings.theme = 'light'  // looks like mutation, contained in setter
})
```

### Derived Values — Just Functions

```js
const doubled = getCount() * 2  // build transform makes this reactive
```

The build transform wraps it: `const doubled = () => getCount() * 2`. Cascades like a spreadsheet.

### Control — The Single Lifecycle

```js
// Setup (runs once, no reactive deps)
control(() => {
  console.log('component alive')
  return () => console.log('component gone')  // cleanup on unmount
})

// Reactive subscription
control(() => {
  document.title = `Count: ${getCount()}`  // re-runs when count changes
})

// External resources
control(() => {
  const id = setInterval(() => tick(), 1000)
  return () => clearInterval(id)  // auto-cleaned on unmount
})
```

### Snapshot — Escape Hatch

```js
const initial = snapshot(getCount())  // frozen at current value, never updates
```

## Provide / Inject

Tree-scoped state without prop drilling:

```js
// Parent
provide('theme', getTheme)

// Any descendant — no matter how deep
const getTheme = inject('theme')
```

## SSR

```js
// Server
import { renderToString } from 'sipperjs/server'
const { html, state } = renderToString(App)

// Client
import { hydrate } from 'sipperjs'
hydrate(App, document.getElementById('app'))
```

## Vite Setup

```js
// vite.config.js
import reactiveJSX from 'sipperjs/plugin'

export default {
  plugins: [reactiveJSX()],
  esbuild: { jsx: 'preserve' }
}
```

## DevTools

```js
import { initDevTools } from 'sipperjs/devtools'
initDevTools()  // adds live state inspector panel
```

## Design Philosophy

1. **3 APIs, not 30** — `state()` replaces useState/useRef/useMemo/createSignal/ref/reactive/computed
2. **JavaScript is the abstraction** — functions are derivations, closures are refs
3. **Components run once** — no re-renders, no VDOM diffing
4. **SSR-first** — server renders HTML, client hydrates with restored state
5. **The framework prevents mistakes** — automatic cleanup, ownership scopes, immutable getters
6. **Event delegation** — one listener per event type, not per element

## License

MIT
