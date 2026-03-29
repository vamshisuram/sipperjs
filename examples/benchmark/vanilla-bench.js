// Vanilla JS benchmark — optimized surgical DOM updates (true speed ceiling)
import { buildData } from './data.js'

let rows = []
let selectedId = -1
let tbody = null
let rowElements = new Map() // id → tr element

function createRow(row) {
  const tr = document.createElement('tr')
  if (row.id === selectedId) tr.className = 'selected'

  const td1 = document.createElement('td')
  td1.textContent = row.id
  tr.appendChild(td1)

  const td2 = document.createElement('td')
  td2.textContent = row.label
  tr.appendChild(td2)

  const td3 = document.createElement('td')
  const selBtn = document.createElement('button')
  selBtn.textContent = 'select'
  selBtn.onclick = () => {
    const prev = rowElements.get(selectedId)
    if (prev) prev.className = ''
    selectedId = row.id
    tr.className = 'selected'
  }
  td3.appendChild(selBtn)
  const delBtn = document.createElement('button')
  delBtn.textContent = 'x'
  delBtn.onclick = () => {
    rows = rows.filter(r => r.id !== row.id)
    tr.remove()
    rowElements.delete(row.id)
  }
  td3.appendChild(delBtn)
  tr.appendChild(td3)

  rowElements.set(row.id, tr)
  return tr
}

function fullRender() {
  tbody.textContent = ''
  rowElements.clear()
  const frag = document.createDocumentFragment()
  for (const row of rows) {
    frag.appendChild(createRow(row))
  }
  tbody.appendChild(frag)
}

export const vanillaOps = {
  create() {
    rows = buildData(1000)
    selectedId = -1
    fullRender()
  },
  createMany() {
    rows = buildData(10000)
    selectedId = -1
    fullRender()
  },
  append() {
    const newRows = buildData(1000)
    rows = [...rows, ...newRows]
    const frag = document.createDocumentFragment()
    for (const row of newRows) {
      frag.appendChild(createRow(row))
    }
    tbody.appendChild(frag)
  },
  update() {
    // Surgical: only touch every 10th row's label
    for (let i = 0; i < rows.length; i += 10) {
      rows[i] = { ...rows[i], label: rows[i].label + ' !!!' }
      const tr = rowElements.get(rows[i].id)
      if (tr) tr.children[1].textContent = rows[i].label
    }
  },
  swap() {
    if (rows.length < 999) return
    // Surgical: swap two DOM nodes
    const tmp = rows[1]
    rows[1] = rows[998]
    rows[998] = tmp
    const tr1 = tbody.children[1]
    const tr998 = tbody.children[998]
    tbody.insertBefore(tr998, tr1)
    tbody.insertBefore(tr1, tbody.children[999])
  },
  select() {
    if (rows.length === 0) return
    // Surgical: toggle class on 2 rows
    const prev = rowElements.get(selectedId)
    if (prev) prev.className = ''
    selectedId = rows[0].id
    const next = rowElements.get(selectedId)
    if (next) next.className = 'selected'
  },
  delete() {
    if (rows.length === 0) return
    // Surgical: remove 1 DOM node
    const row = rows[0]
    rows = rows.filter((_, i) => i !== 0)
    const tr = rowElements.get(row.id)
    if (tr) tr.remove()
    rowElements.delete(row.id)
  },
  clear() {
    rows = []
    selectedId = -1
    tbody.textContent = ''
    rowElements.clear()
  }
}

export function mountVanilla(container) {
  const table = document.createElement('table')
  const thead = document.createElement('thead')
  thead.innerHTML = '<tr><th>ID</th><th>Label</th><th>Actions</th></tr>'
  table.appendChild(thead)
  tbody = document.createElement('tbody')
  table.appendChild(tbody)
  container.appendChild(table)
}
