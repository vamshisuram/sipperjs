# Hydration Strategy

## Core Principle

**Attach behavior, don't re-render.**

The server already rendered the DOM. The client should not throw it away and rebuild it. Instead, it should:

1. Walk the existing DOM
2. Match nodes to component bindings
3. Attach reactive subscriptions
4. Become interactive — without a single re-render

## How It Works

### Server Side

1. Component runs, produces HTML string
2. Reactive state values are serialized into the HTML as a `<script>` tag with JSON
3. DOM structure is rendered with deterministic markers (comments or minimal attributes) for hydration targeting

```html
<!-- Server output -->
<div>
  <span><!--h:0-->0</span>
  <span><!--h:1-->0</span>
  <button>+</button>
</div>
<script type="application/hydration">
  {"state":{"count":0}}
</script>
```

### Client Side

1. Parse the serialized state from `<script>` tag
2. Recreate signals/reactive objects with server values (no recomputation)
3. Walk the DOM using deterministic tree traversal
4. Bind reactive expressions to the matched DOM nodes
5. Attach event handlers

**No DOM is created or replaced. No diffing occurs.**

## DOM Matching Strategy

### Approach: Deterministic Tree Walking (Not Element IDs)

Naive approach: slap `data-hyd-id` on every element. Problem: bloats HTML significantly.

Better approach: **if both server and client traverse the component tree in the same order, you can match nodes by position without IDs.** The server inserts lightweight comment markers at reactive boundaries. The client walks these markers to find binding targets.

This is similar to what Solid does with markers/comments, but without the compilation requirement.

### Two Compilation Targets (Runtime, Not Compiler)

On the server and client, the same component code runs but produces different outputs:

- **Server**: Components produce HTML strings (fast string concatenation)
- **Client (first load)**: Components walk existing DOM and attach bindings (hydration)
- **Client (subsequent)**: Components create DOM nodes and attach bindings (SPA navigation)

The runtime detects whether it's hydrating or mounting fresh and switches behavior accordingly. Same component code, different execution paths.

## What Runs Where

| | Server | Client |
|---|--------|--------|
| Component function body | Yes | Yes |
| `control` | No | Yes |

**`control` does NOT run on the server.** No DOM, no subscriptions, no timers on the server. Only pure rendering. The component function body runs on both — use it for setup logic that applies everywhere.

## State Serialization

The server creates signals, computes derived state, renders HTML. The client picks up where the server left off.

```
Server:
  state(0) → renders "0" into HTML
  getDoubled = () => getCount() * 2 → computes 0, renders into HTML
  Serializes: { count: 0 }

Client:
  state(0) ← restored from serialized state, not recomputed
  getDoubled() ← just calls getCount(), always fresh
  DOM bindings attached to existing nodes
```

No duplicate computation. No flash of content. Instant interactivity.

## Implicit Partial Hydration

No special API. No `"use client"` / `"use server"` directives.

- A component with **zero `state()`/effects/event handlers** = pure HTML. Zero JS shipped to client.
- A component with **interactivity** = HTML on server + hydration JS on client.

The framework looks at what the component actually uses. If there's no `state()` or `control()`, there's nothing to hydrate.

Detection happens at **runtime** (fits the no-compiler philosophy). The cost is shipping the component function even if inert — a micro-optimization to tackle later if needed.
