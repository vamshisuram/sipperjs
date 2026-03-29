// Sipper DevTools — live state inspector
// Import and call `initDevTools()` to add the panel to the page.

export function initDevTools() {
  const sipper = globalThis.__SIPPER__
  if (!sipper) { console.warn('[Sipper DevTools] No Sipper runtime found'); return }

  // Create panel
  const panel = document.createElement('div')
  panel.id = 'sipper-devtools'
  panel.innerHTML = `
    <style>
      #sipper-devtools {
        position: fixed; bottom: 0; right: 0; width: 380px; max-height: 50vh;
        background: #1a1a2e; color: #e0e0e0; font-family: 'SF Mono', Monaco, Consolas, monospace;
        font-size: 12px; border-top-left-radius: 8px; box-shadow: -2px -2px 12px rgba(0,0,0,0.3);
        z-index: 99999; display: flex; flex-direction: column;
      }
      #sipper-devtools .header {
        padding: 8px 12px; background: #16213e; border-top-left-radius: 8px;
        display: flex; justify-content: space-between; align-items: center;
        cursor: pointer; user-select: none;
      }
      #sipper-devtools .header .title { font-weight: bold; color: #00d2ff; }
      #sipper-devtools .header .badge {
        background: #0f3460; padding: 2px 8px; border-radius: 10px; font-size: 10px;
      }
      #sipper-devtools .body { overflow-y: auto; padding: 8px 0; }
      #sipper-devtools .section { padding: 4px 12px; }
      #sipper-devtools .section-title {
        color: #00d2ff; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;
        margin: 8px 0 4px 0; border-bottom: 1px solid #2a2a4a; padding-bottom: 4px;
      }
      #sipper-devtools .state-row {
        display: flex; justify-content: space-between; align-items: center;
        padding: 3px 0; border-bottom: 1px solid #2a2a4a;
      }
      #sipper-devtools .state-id { color: #888; min-width: 30px; }
      #sipper-devtools .state-value {
        color: #e2b714; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        margin: 0 8px;
      }
      #sipper-devtools .state-value.string { color: #98c379; }
      #sipper-devtools .state-value.number { color: #e2b714; }
      #sipper-devtools .state-value.boolean { color: #c678dd; }
      #sipper-devtools .state-value.object { color: #61afef; }
      #sipper-devtools .state-subs {
        color: #666; font-size: 10px; min-width: 40px; text-align: right;
      }
      #sipper-devtools .scope-tree { padding-left: 12px; }
      #sipper-devtools .scope-node { padding: 2px 0; }
      #sipper-devtools .scope-name { color: #c678dd; }
      #sipper-devtools .scope-info { color: #666; font-size: 10px; }
      #sipper-devtools .collapsed .body { display: none; }
      #sipper-devtools .update-flash { animation: sipper-flash 0.3s ease-out; }
      @keyframes sipper-flash { from { background: #2a4a2a; } to { background: transparent; } }
    </style>
    <div class="header" onclick="this.parentElement.classList.toggle('collapsed')">
      <span class="title">🥤 Sipper DevTools</span>
      <span class="badge" id="sipper-dt-count">0 states</span>
    </div>
    <div class="body">
      <div class="section">
        <div class="section-title">State</div>
        <div id="sipper-dt-states"></div>
      </div>
      <div class="section">
        <div class="section-title">Component Tree</div>
        <div id="sipper-dt-tree"></div>
      </div>
    </div>
  `
  document.body.appendChild(panel)

  // Render state list
  function renderStates() {
    const container = document.getElementById('sipper-dt-states')
    const count = document.getElementById('sipper-dt-count')
    if (!container) return

    count.textContent = `${sipper.states.length} states`

    let html = ''
    for (const s of sipper.states) {
      const val = s.getter()
      const type = Array.isArray(val) ? 'object' : typeof val
      let display

      if (type === 'object' && val !== null) {
        if (Array.isArray(val)) display = `Array(${val.length})`
        else display = JSON.stringify(val).slice(0, 60)
      } else if (type === 'string') {
        display = `"${val}"`
      } else {
        display = String(val)
      }

      const label = s.label || `state#${s.id}`

      html += `<div class="state-row" id="sipper-dt-state-${s.id}">
        <span class="state-id">${label}</span>
        <span class="state-value ${type}" title="${String(display)}">${display}</span>
        <span class="state-subs">${s.subscribers.size} subs</span>
      </div>`
    }
    container.innerHTML = html
  }

  // Render component scope tree
  function renderTree() {
    const container = document.getElementById('sipper-dt-tree')
    if (!container) return

    function renderScope(scope, depth) {
      const indent = depth * 16
      const childCount = scope.children.length
      const cleanupCount = scope.cleanups.length
      let html = `<div class="scope-node" style="padding-left:${indent}px">
        <span class="scope-name">&lt;${scope.name}&gt;</span>
        <span class="scope-info"> ${childCount} children, ${cleanupCount} controls</span>
      </div>`
      for (const child of scope.children) {
        html += renderScope(child, depth + 1)
      }
      return html
    }

    let html = ''
    for (const scope of sipper.scopes) {
      html += renderScope(scope, 0)
    }
    container.innerHTML = html || '<div style="color:#666;padding:4px">No components mounted</div>'
  }

  // Initial render
  renderStates()
  renderTree()

  // Subscribe to state changes
  sipper.onChange = () => {
    renderStates()
    // Flash effect on changed states
    for (const s of sipper.states) {
      const el = document.getElementById(`sipper-dt-state-${s.id}`)
      if (el) {
        el.classList.remove('update-flash')
        el.offsetHeight // force reflow
        el.classList.add('update-flash')
      }
    }
  }

  // Periodic tree refresh (scopes change on mount/unmount)
  setInterval(renderTree, 1000)

  console.log('[Sipper DevTools] Initialized — click the panel header to toggle')
}
