import { sipperOps, mountSipper } from './sipper-bench.js'
import { vanillaOps, mountVanilla } from './vanilla-bench.js'
import { reactOps, mountReact } from './react-bench.js'
import { solidOps, mountSolid } from './solid-bench.js'

// Mount all frameworks
mountSipper(document.getElementById('sipper-app'))
mountVanilla(document.getElementById('vanilla-app'))
mountReact(document.getElementById('react-app'))
mountSolid(document.getElementById('solid-app'))

// Wait a frame for React to mount and expose ops
await frame()
await frame()

const frameworks = {
  sipper: { ops: sipperOps, results: {} },
  react: { ops: reactOps, results: {} },
  solid: { ops: solidOps, results: {} },
  vanilla: { ops: vanillaOps, results: {} }
}

function measure(fn) {
  document.body.offsetHeight // force layout
  const start = performance.now()
  fn()
  document.body.offsetHeight // force layout to include rendering
  return performance.now() - start
}

function updateResults(name) {
  const el = document.getElementById(`${name}-results`)
  el.innerHTML = Object.entries(frameworks[name].results)
    .map(([k, v]) => `<div>${k}: <strong>${v.toFixed(1)}ms</strong></div>`)
    .join('')
}

window.run = function(name, op) {
  const fw = frameworks[name]
  if (!fw.ops[op]) return
  const time = measure(() => fw.ops[op]())
  fw.results[op] = time
  updateResults(name)
}

window.runAll = async function() {
  const benchOps = ['clear', 'create', 'update', 'swap', 'select', 'delete', 'clear', 'create', 'append', 'clear', 'createMany', 'clear']
  const names = ['sipper', 'react', 'solid', 'vanilla']

  // Warm up
  for (const name of names) {
    frameworks[name].ops.create?.()
    await frame()
    frameworks[name].ops.clear?.()
    await frame()
  }

  // Run benchmarks — each op for each framework
  const recordOps = ['create', 'update', 'swap', 'select', 'delete', 'append', 'createMany']
  const times = {}
  for (const name of names) times[name] = {}

  for (const op of recordOps) {
    for (const name of names) {
      // Clear first
      frameworks[name].ops.clear?.()
      await frame()

      // For operations that need data, create it first
      if (['update', 'swap', 'select', 'delete', 'append'].includes(op)) {
        frameworks[name].ops.create?.()
        await frame()
      }

      const t = measure(() => frameworks[name].ops[op]?.())
      times[name][op] = t
      frameworks[name].results[op] = t
      await frame()
    }
  }

  // Update individual panels
  for (const name of names) updateResults(name)

  // Build comparison table
  const comp = document.getElementById('comparison')
  let html = `
    <h2>Results</h2>
    <table class="comparison-table" style="width:100%">
      <tr>
        <th>Operation</th>
        <th>Sipper</th>
        <th>React 19</th>
        <th>Solid.js</th>
        <th>Vanilla JS</th>
        <th>Sipper vs Vanilla</th>
      </tr>`

  for (const op of recordOps) {
    const s = times.sipper[op] || 0
    const r = times.react[op] || 0
    const so = times.solid[op] || 0
    const v = times.vanilla[op] || 0

    // Find fastest
    const all = { sipper: s, react: r, solid: so, vanilla: v }
    const min = Math.min(...Object.values(all))

    function cell(val) {
      const isFastest = Math.abs(val - min) < 0.5
      const style = isFastest ? 'color:green;font-weight:bold' : ''
      return `<td style="${style}">${val.toFixed(1)}ms</td>`
    }

    const ratio = v > 0 ? (s / v) : 0
    const ratioColor = ratio <= 1.5 ? 'green' : ratio <= 3 ? 'orange' : 'red'

    html += `<tr>
      <td><strong>${op}</strong></td>
      ${cell(s)}
      ${cell(r)}
      ${cell(so)}
      ${cell(v)}
      <td style="color:${ratioColor};font-weight:bold">${ratio.toFixed(2)}x</td>
    </tr>`
  }

  html += '</table>'
  comp.innerHTML = html
}

function frame() {
  return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))
}
