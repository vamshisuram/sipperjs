// React benchmark — uses React.createElement (no JSX build needed)
import React from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { buildData } from './data.js'

const { createElement: ce, useState, useCallback, memo } = React

// Memoized row to avoid unnecessary re-renders (idiomatic React optimization)
const Row = memo(function Row({ row, isSelected, onSelect, onDelete }) {
  return ce('tr', { className: isSelected ? 'selected' : '' },
    ce('td', null, row.id),
    ce('td', null, row.label),
    ce('td', null,
      ce('button', { onClick: () => onSelect(row.id) }, 'select'),
      ce('button', { onClick: () => onDelete(row.id) }, 'x')
    )
  )
})

function App({ opsRef }) {
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(-1)
  const rowsRef = React.useRef(rows)
  rowsRef.current = rows

  const onSelect = useCallback((id) => flushSync(() => setSelected(id)), [])
  const onDelete = useCallback((id) => flushSync(() => setRows(r => r.filter(row => row.id !== id))), [])

  // Expose operations — wrapped in flushSync for synchronous rendering measurement
  opsRef.current = {
    create() { flushSync(() => { setRows(buildData(1000)); setSelected(-1) }) },
    createMany() { flushSync(() => { setRows(buildData(10000)); setSelected(-1) }) },
    append() { flushSync(() => { setRows(r => [...r, ...buildData(1000)]) }) },
    update() {
      flushSync(() => {
        setRows(r => {
          const updated = [...r]
          for (let i = 0; i < updated.length; i += 10) {
            updated[i] = { ...updated[i], label: updated[i].label + ' !!!' }
          }
          return updated
        })
      })
    },
    swap() {
      flushSync(() => {
        setRows(r => {
          if (r.length < 999) return r
          const updated = [...r]
          const tmp = updated[1]; updated[1] = updated[998]; updated[998] = tmp
          return updated
        })
      })
    },
    select() { flushSync(() => { const r = rowsRef.current; if (r.length > 0) setSelected(r[0].id) }) },
    delete() { flushSync(() => { setRows(r => r.length > 0 ? r.filter((_, i) => i !== 0) : r) }) },
    clear() { flushSync(() => { setRows([]); setSelected(-1) }) }
  }

  return ce('table', null,
    ce('thead', null,
      ce('tr', null, ce('th', null, 'ID'), ce('th', null, 'Label'), ce('th', null, 'Actions'))
    ),
    ce('tbody', null,
      rows.map(row => ce(Row, {
        key: row.id, row, isSelected: selected === row.id,
        onSelect, onDelete
      }))
    )
  )
}

export let reactOps = {}

export function mountReact(container) {
  const opsRef = { current: {} }
  const root = createRoot(container)
  root.render(ce(App, { opsRef }))

  // React batches state updates and renders async — we need to flush
  // We'll use a proxy that wraps ops and forces a sync flush
  reactOps = new Proxy({}, {
    get(_, op) {
      return () => {
        if (opsRef.current[op]) {
          opsRef.current[op]()
        }
      }
    }
  })
}
