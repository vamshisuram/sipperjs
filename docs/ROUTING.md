# Routing — File-Based with Nested Layouts

## Why Nested Layouts

Nested layouts are more scalable than flat routing. Every serious SSR framework landed here (Next.js, Nuxt, SvelteKit, Remix). Reasons:

- **Persistent shells**: Navigating between sibling routes doesn't remount the parent layout
- **Streaming**: Layouts can be sent first while child page data loads
- **Code splitting**: Each route segment is a natural split point
- **Shared state**: Layouts can hold state that persists across child navigations

## File Structure

```
routes/
  layout.jsx          ← root layout (wraps everything)
  page.jsx            ← home page (/)
  about/
    page.jsx           ← /about
  dashboard/
    layout.jsx         ← dashboard layout (persists across dashboard pages)
    page.jsx           ← /dashboard
    settings/
      page.jsx         ← /dashboard/settings
    profile/
      page.jsx         ← /dashboard/profile
  blog/
    page.jsx           ← /blog
    [slug]/
      page.jsx         ← /blog/:slug (dynamic segment)
```

## Conventions

- `layout.jsx` — Persistent wrapper. Must render a `<Slot />` for child content.
- `page.jsx` — The actual page content for that route segment.
- `[param]` — Dynamic route segments.
- Folders without `page.jsx` are layout-only groupings.

## Layout Behavior

```jsx
// routes/dashboard/layout.jsx
function DashboardLayout() {
  return (
    <div class="dashboard">
      <Sidebar />
      <main>
        <Slot />  {/* child page renders here */}
      </main>
    </div>
  )
}
```

When navigating from `/dashboard` to `/dashboard/settings`:
1. `DashboardLayout` stays mounted (no re-render, no teardown)
2. Only the `<Slot />` content swaps from `dashboard/page.jsx` to `dashboard/settings/page.jsx`
3. Any reactive state in the layout persists

## Navigation

Client-side navigation after initial SSR load works like a typical CSR framework:

1. Intercept `<a>` clicks
2. Fetch the new page component (code-split)
3. Fetch data for the new route
4. Swap only the changed segments (layouts persist)
5. Update browser history

## Data Loading

Each `page.jsx` or `layout.jsx` can export a `load` function:

```jsx
// routes/dashboard/page.jsx
export async function load({ params, fetch }) {
  const data = await fetch('/api/dashboard')
  return { stats: data }
}

function DashboardPage(props) {
  // props.stats available from load()
  return <div>{props.stats.totalUsers}</div>
}
```

- `load` runs on the server for SSR
- `load` runs on the client for SPA navigations
- Layout `load` functions only re-run when the layout's params change
