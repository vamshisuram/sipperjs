import { h, state, snapshot, control, provide, inject } from './runtime.js'

// ============================================================
// 1. PROVIDE / INJECT — no prop drilling
// ============================================================

// Deep child — gets theme without any prop drilling
function ThemedButton({ label, onClick }) {
  const getTheme = inject('theme')
  return (
    <button
      style={getTheme() === 'dark'
        ? 'background:#333;color:#fff;padding:6px 16px;margin:4px;cursor:pointer;border:1px solid #555;border-radius:4px'
        : 'background:#fff;color:#333;padding:6px 16px;margin:4px;cursor:pointer;border:1px solid #ccc;border-radius:4px'}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

// Middle component — doesn't know about theme at all
function Toolbar({ getCount, setCount }) {
  return (
    <div>
      <ThemedButton label="+" onClick={() => setCount(c => c + 1)} />
      <ThemedButton label="-" onClick={() => setCount(c => c - 1)} />
      <ThemedButton label="Reset" onClick={() => setCount(0)} />
    </div>
  )
}

// ============================================================
// 2. ERROR HANDLING — framework catches, shows fallback
// ============================================================

function BrokenComponent() {
  throw new Error('Something went wrong!')
}

// ============================================================
// 3. GLOBAL STORE PATTERN — built on state(), no new API
// ============================================================

function createStore(initialState, actions, label) {
  const [getState, setState] = state(initialState, label)
  const bound = {}
  for (const [name, action] of Object.entries(actions)) {
    bound[name] = (...args) => setState(draft => action(draft, ...args))
  }
  return { getState, ...bound }
}

// Example store
const todoStore = createStore(
  {
    items: [
      { text: 'Design state() API', done: true },
      { text: 'Build reactive JSX transform', done: true },
      { text: 'Add provide/inject', done: true },
      { text: 'Add error handling', done: true },
      { text: 'Run benchmarks', done: false }
    ],
    filter: 'all'
  },
  {
    add: (state, text) => { state.items.push({ text, done: false }) },
    toggle: (state, index) => { state.items[index].done = !state.items[index].done },
    setFilter: (state, filter) => { state.filter = filter }
  },
  'todoStore'
)

// ============================================================
// COMPONENTS
// ============================================================

function CountDisplay({ getCount, label }) {
  return <p>{label}: {getCount()}</p>
}

function Timer() {
  const [getSeconds, setSeconds] = state(0, 'seconds')

  control(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000)
    return () => {
      clearInterval(id)
      console.log('Timer cleaned up automatically')
    }
  })

  return <p>Timer: {getSeconds()}s (unmount me — cleanup is automatic)</p>
}

function Counter() {
  const [getCount, setCount] = state(5, 'count')
  const [getTheme, setTheme] = state('light', 'theme')
  const [getShowTimer, setShowTimer] = state(false, 'showTimer')

  // Provide theme to entire subtree — no prop drilling
  provide('theme', getTheme)

  const doubled = getCount() * 2
  const initialValue = snapshot(getCount())

  return (
    <div class="section">
      <h2>Counter (with provide/inject)</h2>
      <CountDisplay getCount={getCount} label="Count" />
      <p>Doubled: {doubled}</p>
      <p>Initial (snapshot): {initialValue}</p>

      {/* Toolbar gets themed buttons without knowing about theme */}
      <Toolbar getCount={getCount} setCount={setCount} />

      <ThemedButton
        label={getTheme() === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
        onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
      />

      <hr />
      <ThemedButton
        label={getShowTimer() ? 'Hide Timer' : 'Show Timer'}
        onClick={() => setShowTimer(v => !v)}
      />
      {getShowTimer() && <Timer />}
    </div>
  )
}

function TodoApp() {
  const { getState, add, toggle, setFilter } = todoStore

  const getFiltered = () => {
    const { items, filter } = getState()
    if (filter === 'active') return items.filter(t => !t.done)
    if (filter === 'done') return items.filter(t => t.done)
    return items
  }

  let input

  function addTodo() {
    if (!input.value.trim()) return
    add(input.value.trim())
    input.value = ''
  }

  control(() => {
    document.title = `Sipper — Todos (${getState().items.length})`
    return () => { document.title = 'Sipper' }
  })

  return (
    <div class="section">
      <h2>Todos (global store pattern)</h2>
      <div>
        <input ref={el => input = el} placeholder="Add todo..." onKeydown={e => e.key === 'Enter' && addTodo()} />
        <button onClick={addTodo}>Add</button>
      </div>
      <div style="margin: 8px 0">
        <button onClick={() => setFilter('all')}>All</button>
        <button onClick={() => setFilter('active')}>Active</button>
        <button onClick={() => setFilter('done')}>Done</button>
        <span> Showing: {getState().filter} ({getFiltered().length})</span>
      </div>
      <ul>
        {getFiltered().map((todo, i) => (
          <li
            style={todo.done ? 'text-decoration: line-through; cursor: pointer' : 'cursor: pointer'}
            onClick={() => toggle(getState().items.indexOf(todo))}
          >
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ErrorDemo() {
  return (
    <div class="section">
      <h2>Error Handling</h2>
      <p>The component below throws — framework catches it automatically:</p>
      <BrokenComponent />
    </div>
  )
}

// --- App root ---
export function App() {
  return (
    <div>
      <h1>Sipper — Framework POC</h1>
      <Counter />
      <TodoApp />
      <ErrorDemo />
    </div>
  )
}
