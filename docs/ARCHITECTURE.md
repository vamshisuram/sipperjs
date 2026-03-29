# Architecture

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Syntax | JSX (runtime) | Familiar, no compiler needed |
| Reactivity | Unified `state()` API (Proxy + Signals internally) | Runtime, no magic, one concept to learn |
| SSR | First-class, stream layouts | HTML-first |
| Hydration | Attach behavior, don't re-render | Match DOM nodes, bind reactivity |
| Routing | File-based, nested layouts | Proven, scalable |
| Partial hydration | Implicit (no interactivity = no JS) | No forced API surface |
| Lifecycle | `control` only — setup, subscriptions, cleanup in one | No lifecycle hooks to learn |

## Positioning

This framework targets the gap between existing solutions:

| Framework | Syntax | Reactivity | SSR Story |
|-----------|--------|------------|-----------|
| **Solid** | JSX | Signals | Weak |
| **Qwik** | JSX | Signals | Strong (resumability) but weird DX |
| **Svelte 5** | Custom | Runes (signals) | Good but not JSX |
| **This framework** | JSX | Unified `state()` (Signals + Proxy internally) | Strong SSR + familiar DX |

**Our niche**: Solid's mental model + Qwik's SSR philosophy + React's familiar syntax — without any of their respective weirdness.

## Component Model

Components are **functions that run once**. JSX compiles to a static template with reactive bindings — not a render function that re-executes.

```jsx
function Counter(props) {
  const [getCount, setCount] = state(props.initial)
  const doubled = getCount() * 2  // plain variable — transform makes it reactive

  return (
    <div>
      <span>{getCount()}</span>
      <span>{doubled}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </div>
  )
}
```

### Key Properties

1. **No re-renders**: The function body executes once. Reactive bindings update the DOM directly.
2. **No hooks**: No `useState`, `useMemo`, `useCallback` — these are workarounds for React's re-render model. `state()` eliminates the need.
3. **No VDOM**: No diffing. Templates are static; only reactive expressions update.

## JSX Compilation Target

JSX should compile to a static template + a list of reactive bindings:

```js
// JSX in:
<div class={getStyle()}>{getCount()}</div>

// Compiles to roughly:
template('<div><!></div>')
  .bind(0, 'class', () => getStyle())   // reactive binding to attribute
  .bind(1, 'text', () => getCount())    // reactive binding to text node
```

Template created once. Bindings subscribe to signals. No diffing, no re-render.

Since we're runtime-only (no compiler), the JSX transform is the standard one — any JSX transformer works. The runtime interprets the resulting `createElement` calls to build the template + binding representation.
