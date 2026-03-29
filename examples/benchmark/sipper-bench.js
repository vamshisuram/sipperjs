// Sipper benchmark — uses the actual Sipper runtime with keyed reconciliation
import { state, control, snapshot } from '../src/runtime.js'
import { buildData } from './data.js'

// Inline h() — same as runtime but with _key and _update support for benchmarking
function h(tag, props, ...children) {
  if (typeof tag === 'function') {
    const el = tag(props || {})
    if (el instanceof Node && props && props.key != null) el._key = props.key
    return el
  }
  const el = document.createElement(tag)
  if (props) {
    if (props.key != null) el._key = props.key
    for (const [key, val] of Object.entries(props)) {
      if (key === 'key') continue
      if (key === 'ref') { if (typeof val === 'function') val(el) }
      else if (key === 'class') {
        if (typeof val === 'function') control(() => el.className = val())
        else el.className = val
      }
      else if (key.startsWith('on')) el.addEventListener(key.slice(2).toLowerCase(), val)
      else if (typeof val === 'function') control(() => el.setAttribute(key, val()))
      else el.setAttribute(key, val)
    }
  }
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue
    if (child instanceof Node) el.appendChild(child)
    else el.appendChild(document.createTextNode(String(child)))
  }
  return el
}

// State
const [getRows, setRows] = state([])
const [getSelected, setSelected] = state(-1)

// Operations
export const sipperOps = {
  create() { setRows(buildData(1000)); setSelected(-1) },
  createMany() { setRows(buildData(10000)); setSelected(-1) },
  append() { setRows(rows => [...rows, ...buildData(1000)]) },
  update() {
    setRows(rows => {
      const updated = [...rows]
      for (let i = 0; i < updated.length; i += 10) {
        updated[i] = { ...updated[i], label: updated[i].label + ' !!!' }
      }
      return updated
    })
  },
  swap() {
    setRows(rows => {
      if (rows.length < 999) return rows
      const updated = [...rows]
      const tmp = updated[1]; updated[1] = updated[998]; updated[998] = tmp
      return updated
    })
  },
  select() {
    const rows = getRows()
    if (rows.length > 0) setSelected(rows[0].id)
  },
  delete() {
    setRows(rows => {
      if (rows.length === 0) return rows
      return rows.filter((_, i) => i !== 0)
    })
  },
  clear() { setRows([]); setSelected(-1) }
}

// Render — keyed rows with surgical updates
function Row(row, selectedId) {
  const tr = document.createElement('tr')
  tr._key = row.id
  tr.className = row.id === selectedId ? 'selected' : ''

  const td1 = document.createElement('td')
  td1.textContent = row.id
  tr.appendChild(td1)

  const td2 = document.createElement('td')
  td2.textContent = row.label
  tr.appendChild(td2)

  const td3 = document.createElement('td')
  const selBtn = document.createElement('button')
  selBtn.textContent = 'select'
  selBtn.onclick = () => setSelected(row.id)
  td3.appendChild(selBtn)
  const delBtn = document.createElement('button')
  delBtn.textContent = 'x'
  delBtn.onclick = () => setRows(rows => rows.filter(r => r.id !== row.id))
  td3.appendChild(delBtn)
  tr.appendChild(td3)

  // _update: called by reconciler when reusing this node with new data
  tr._update = function(newRow, newSelectedId) {
    if (td2.textContent !== newRow.label) td2.textContent = newRow.label
    const cls = newRow.id === newSelectedId ? 'selected' : ''
    if (tr.className !== cls) tr.className = cls
  }

  return tr
}

// Mount
export function mountSipper(container) {
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  thead.innerHTML = '<tr><th>ID</th><th>Label</th><th>Actions</th></tr>'
  table.appendChild(thead)
  const tbody = document.createElement('tbody')
  table.appendChild(tbody)
  container.appendChild(table)

  // Keyed reconciliation for the row list
  let prevKeyMap = new Map() // key → {tr, row}

  control(() => {
    const rows = getRows()
    const selectedId = getSelected()
    const newKeyMap = new Map()

    // Build new key set
    for (const row of rows) {
      newKeyMap.set(row.id, row)
    }

    // Remove old nodes not in new set
    for (const [key, entry] of prevKeyMap) {
      if (!newKeyMap.has(key)) {
        entry.tr.remove()
      }
    }

    // Insert/move/update nodes
    let cursor = tbody.firstChild
    for (const row of rows) {
      const existing = prevKeyMap.get(row.id)

      if (existing) {
        // Update content
        existing.tr._update(row, selectedId)
        existing.row = row

        // Move to correct position if needed
        if (existing.tr !== cursor) {
          tbody.insertBefore(existing.tr, cursor)
        } else {
          cursor = cursor.nextSibling
        }
        newKeyMap.set(row.id, row)
        // Keep the entry for next round
        prevKeyMap.set(row.id, existing)
      } else {
        // New row — create and insert
        const tr = Row(row, selectedId)
        tbody.insertBefore(tr, cursor)
        prevKeyMap.set(row.id, { tr, row })
      }
    }

    // Update prevKeyMap to only contain current rows
    for (const [key] of prevKeyMap) {
      if (!newKeyMap.has(key)) prevKeyMap.delete(key)
    }
  })
}
