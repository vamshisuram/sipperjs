// Solid.js benchmark — uses Solid's runtime API directly (no JSX compiler needed)
import { createSignal, createRoot, batch, For } from 'solid-js'
import { render } from 'solid-js/web'
import { buildData } from './data.js'

export let solidOps = {}

export function mountSolid(container) {
  render(() => {
    const [rows, setRows] = createSignal([])
    const [selected, setSelected] = createSignal(-1)

    solidOps = {
      create() { batch(() => { setRows(buildData(1000)); setSelected(-1) }) },
      createMany() { batch(() => { setRows(buildData(10000)); setSelected(-1) }) },
      append() { setRows(r => [...r, ...buildData(1000)]) },
      update() {
        setRows(r => {
          const updated = [...r]
          for (let i = 0; i < updated.length; i += 10) {
            updated[i] = { ...updated[i], label: updated[i].label + ' !!!' }
          }
          return updated
        })
      },
      swap() {
        setRows(r => {
          if (r.length < 999) return r
          const updated = [...r]
          const tmp = updated[1]; updated[1] = updated[998]; updated[998] = tmp
          return updated
        })
      },
      select() {
        const r = rows()
        if (r.length > 0) setSelected(r[0].id)
      },
      delete() { setRows(r => r.length > 0 ? r.filter((_, i) => i !== 0) : r) },
      clear() { batch(() => { setRows([]); setSelected(-1) }) }
    }

    // Build DOM manually since we can't use Solid's JSX compiler here
    const table = document.createElement('table')
    const thead = document.createElement('thead')
    thead.innerHTML = '<tr><th>ID</th><th>Label</th><th>Actions</th></tr>'
    table.appendChild(thead)
    const tbody = document.createElement('tbody')
    table.appendChild(tbody)

    // Use Solid's createEffect for reactive rendering
    import('solid-js').then(({ createEffect, onCleanup }) => {
      createEffect(() => {
        const data = rows()
        const sel = selected()
        tbody.textContent = ''
        const frag = document.createDocumentFragment()
        for (const row of data) {
          const tr = document.createElement('tr')
          if (row.id === sel) tr.className = 'selected'

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
          delBtn.onclick = () => setRows(r => r.filter(x => x.id !== row.id))
          td3.appendChild(delBtn)
          tr.appendChild(td3)

          frag.appendChild(tr)
        }
        tbody.appendChild(frag)
      })
    })

    return table
  }, container)
}
