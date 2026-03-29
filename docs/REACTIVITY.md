# Reactivity System

## Runtime Reactivity + Lightweight Build Transform

Reactivity is achieved at runtime using **Signals** (for primitives) and **Proxies** (for objects). A lightweight build-time JSX transform (babel plugin, ~100 lines) wraps JSX expressions and reactive variable declarations in arrow functions — zero runtime cost, all at compile time.

## API Surface

The complete reactive API:

| API | Purpose |
|-----|---------|
| `state(value)` | Create state → returns `[getter, setter]` |
| `control(fn)` | Subscriptions, setup, cleanup — the single lifecycle mechanism |
| `snapshot(value)` | Escape hatch — freeze a value, opt out of reactivity |

Three APIs. Derived values are plain functions. No lifecycle hooks — the framework handles everything.

## Core Primitives

### `state(value)` → `[getter, setter]`

```js
// Primitives
const [getCount, setCount] = state(0)
getCount()           // 0 — always the latest value
setCount(5)          // set directly
setCount(c => c + 1) // update via function

// Objects and Arrays
const [getUser, setUser] = state({ name: 'V', role: 'admin' })
const [getTodos, setTodos] = state([])
getUser().name       // 'V'
```

The runtime picks the right implementation (signal vs proxy) based on the value type. The developer never needs to choose.

### Derived Values — Just Functions

```js
const [getCount, setCount] = state(0)
const doubled = getCount() * 2   // auto-wrapped by build transform
```

The build transform detects that `doubled` references reactive state and wraps it: `const doubled = () => getCount() * 2`. It **cascades**:

```js
const doubled = getCount() * 2       // → () => getCount() * 2
const quadrupled = doubled * 2       // → () => doubled() * 2
const label = `Count: ${doubled}`    // → () => `Count: ${doubled()}`
```

Spreadsheet model. Change one cell, everything downstream updates. The developer writes plain JavaScript — the transform handles the wiring.

### `snapshot(value)` — Escape Hatch

When you intentionally want a frozen value that doesn't update:

```js
const [getCount, setCount] = state(5)
const doubled = getCount() * 2              // reactive — updates when count changes
const initialValue = snapshot(getCount())   // frozen at 5 — never updates
```

Build-time: the transform sees `snapshot()` and skips wrapping. Runtime: identity function.

### `control(fn)` — Side Effects

Runs when tracked dependencies change. Returns a cleanup function that runs before the next execution and on component unmount.

```js
control(() => {
  const handler = () => console.log(getCount())
  window.addEventListener('resize', handler)
  return () => window.removeEventListener('resize', handler)  // cleanup
})
```

Auto-tracks all getter calls — no dependency arrays.

## Read/Write Separation

- **Read** — `getX()` anywhere, always latest, auto-tracked
- **Write** — `setX()` only, clear intent: "I'm updating state"

Getters return immutable views. Direct mutation like `getUser().name = 'X'` is not allowed.

Capability-based by default — pass `getCount` to a child component without giving it write access:

```jsx
<CountDisplay getCount={getCount} />
```

Child receives the getter, calls `getCount()` in its template, stays reactive to parent state. Cannot modify it.

## Nested Updates — Immer-Style Drafts

Setter callback receives a mutable draft — looks like mutation, but contained inside the setter:

```js
setUser(draft => {
  draft.settings.notifications.email = true
})
```

The conceptual model holds: `setUser()` = state gets updated. What happens inside is just *how*.

## Reactive Props

Parent passes getters as props. Child calls them — stays in sync, no prop drilling workaround needed for reactivity:

```jsx
// Parent
function Counter() {
  const [getCount, setCount] = state(0)
  return <CountDisplay getCount={getCount} label="Count" />
}

// Child — receives getter, calls it
function CountDisplay({ getCount, label }) {
  return <p>{label}: {getCount()}</p>
}
```

## Conditional Rendering

Works like React. Components mount/unmount based on state:

```jsx
{getShowDetails() && <Details />}
```

The JSX transform wraps this in an arrow function. The reactive region (comment anchors in the DOM) handles mount/unmount. When a component unmounts, its ownership scope is disposed — all `control` subscriptions are automatically cleaned up.

## Ownership & Automatic Cleanup

Each component creates an **ownership scope**. All `control` calls register with the current scope. When a component unmounts (conditional rendering, list re-render), the framework automatically disposes all subscriptions. The developer never writes cleanup code for framework subscriptions.

For external resources (setInterval, addEventListener, WebSocket), the cleanup return handles it:

```jsx
function Timer() {
  const [getSeconds, setSeconds] = state(0)

  control(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => clearInterval(id)  // framework runs this on unmount
  })

  return <p>Timer: {getSeconds()}s</p>
}

// Timer mounts/unmounts based on state — ALL cleanup is automatic
{getShowTimer() && <Timer />}
```

No `onCleanup` needed. No `onMount`. No `onHydrate`. The component function body IS the setup. `control` IS the lifecycle.

## Shared State

State can be shared by lifting up to a common parent, or by creating module-level state:

```js
// Module-level — shared across all components that import it
const [getUser, setUser] = state({ name: 'V' })

export { getUser, setUser }
```

Works the same as React's patterns — lift up for local sharing, module-level for global.

## Build Transform

The JSX transform (babel plugin, ~100 lines) does two things at build time:

1. **Wraps JSX expressions** in arrow functions so the framework can track them reactively
2. **Wraps reactive variable declarations** (spreadsheet model) and rewrites references as calls

```jsx
// You write:                            // Build output:
<p>Count: {getCount()}</p>              → <p>Count: {() => getCount()}</p>
const doubled = getCount() * 2          → const doubled = () => getCount() * 2
const quad = doubled * 2                → const quad = () => doubled() * 2
const frozen = snapshot(getCount())     → const frozen = snapshot(getCount())  // skipped
```

Zero runtime cost. The transform runs once at build time.

## No Hooks

| React Hook | Our Equivalent | Why |
|------------|---------------|-----|
| `useState` | `state(value)` | State lives outside render |
| `useMemo` | Plain function (or `memo()` if expensive) | Always fresh, no dependency arrays |
| `useCallback` | Not needed | Functions are stable (no re-render) |
| `useRef` | Regular variable | Component runs once, closures are stable |
| `useEffect` | `control()` | No dependency arrays, auto-tracked, auto-cleanup |
| `useContext` | Module-level state or prop passing | No provider/consumer ceremony |

## Why No Lifecycle Hooks?

Other frameworks have `onMount`, `onUnmount`, `onBeforeUpdate`, `onCleanup`, etc. We don't.

- **Setup** = component function body (runs once)
- **Reactive subscription** = `control` with auto-tracked deps
- **Cleanup on re-run** = `control` cleanup return
- **Cleanup on unmount** = automatic via ownership scope

`control` IS the entire lifecycle. One mechanism, not five.
