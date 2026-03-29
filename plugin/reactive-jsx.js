import babel from '@babel/core'
import { types as t } from '@babel/core'

// =============================================================================
// Plugin 1: Reactive Variables (spreadsheet model)
//
// Tracks state getters from state() calls, then:
// - Wraps variable declarations that reference getters → arrow functions
// - Tracks those derived variables, rewrites their references as calls
// - Cascades: derived referencing derived gets the same treatment
//
// const [getCount, setCount] = state(0)
// const doubled = getCount() * 2       → const doubled = () => getCount() * 2
// const quadrupled = doubled * 2       → const quadrupled = () => doubled() * 2
// =============================================================================

function reactiveVariablesPlugin() {
  return {
    visitor: {
      Function(path) {
        // Only process functions with block bodies (component functions)
        const body = path.get('body')
        if (!body.isBlockStatement()) return

        const reactiveNames = new Set()
        const stmts = body.get('body')

        // Pass 1: find all state() getters (direct children only)
        for (const stmt of stmts) {
          if (!stmt.isVariableDeclaration()) continue
          for (const decl of stmt.get('declarations')) {
            const init = decl.node.init
            if (!init || init.type !== 'CallExpression') continue
            if (init.callee.type !== 'Identifier' || init.callee.name !== 'state') continue

            const id = decl.node.id
            if (id.type === 'ArrayPattern' && id.elements.length >= 1) {
              const getter = id.elements[0]
              if (getter && getter.type === 'Identifier') {
                reactiveNames.add(getter.name)
              }
            }
          }
        }

        if (reactiveNames.size === 0) return

        // Pass 2: find derived variables (direct children only)
        // Iterate until no new derived names (handles cascading)
        let changed = true
        while (changed) {
          changed = false
          for (const stmt of stmts) {
            if (!stmt.isVariableDeclaration()) continue
            for (const decl of stmt.get('declarations')) {
              const id = decl.node.id
              if (id.type !== 'Identifier') continue
              if (reactiveNames.has(id.name)) continue

              const init = decl.node.init
              if (!init) continue
              if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression') continue
              if (init.type === 'CallExpression' && init.callee.type === 'Identifier' && init.callee.name === 'state') continue
              // snapshot() — escape hatch, skip wrapping
              if (init.type === 'CallExpression' && init.callee.type === 'Identifier' && init.callee.name === 'snapshot') continue

              // Check if init references any reactive name
              let refsReactive = false
              decl.get('init').traverse({
                Identifier(idPath) {
                  if (reactiveNames.has(idPath.node.name)) {
                    refsReactive = true
                    idPath.stop()
                  }
                }
              })

              if (refsReactive) {
                decl.node.init = t.arrowFunctionExpression([], init)
                reactiveNames.add(id.name)
                changed = true
              }
            }
          }
        }

        // Pass 3: collect derived names (exclude original state getters)
        const derivedNames = new Set(reactiveNames)
        for (const stmt of path.get('body').get('body') || []) {
          if (!stmt.isVariableDeclaration()) continue
          for (const decl of stmt.get('declarations')) {
            const init = decl.node.init
            if (!init || init.type !== 'CallExpression') continue
            if (init.callee.type !== 'Identifier' || init.callee.name !== 'state') continue
            const id = decl.node.id
            if (id.type === 'ArrayPattern' && id.elements.length >= 1) {
              const getter = id.elements[0]
              if (getter) derivedNames.delete(getter.name)
            }
          }
        }

        if (derivedNames.size === 0) return

        // Pass 4: rewrite references to derived variables as calls
        path.traverse({
          // Don't descend into nested function declarations (they have own scope)
          // But DO descend into arrow functions assigned to variables (closures over component state)
          Function(innerPath) {
            if (innerPath === path) return
            // Allow traversal into arrow functions and function expressions (callbacks, event handlers)
            // But skip named function declarations — they're separate scopes
            if (innerPath.node.type === 'FunctionDeclaration') {
              innerPath.skip()
            }
          },
          Identifier(idPath) {
            if (!derivedNames.has(idPath.node.name)) return

            // Skip declaration site
            if (idPath.parent.type === 'VariableDeclarator' && idPath.parent.id === idPath.node) return

            // Skip if already being called
            if (idPath.parent.type === 'CallExpression' && idPath.parent.callee === idPath.node) return

            // Skip property keys
            if (idPath.parent.type === 'MemberExpression' && idPath.parent.property === idPath.node && !idPath.parent.computed) return

            // Rewrite: doubled → doubled()
            idPath.replaceWith(t.callExpression(idPath.node, []))
            idPath.skip()
          }
        })
      }
    }
  }
}

// =============================================================================
// Plugin 2: Reactive JSX Expressions
//
// Wraps JSX expression containers in arrow functions so the framework
// can track reactive dependencies.
//
// <span>{getCount()}</span>        → <span>{() => getCount()}</span>
// <button onClick={handler}>       → unchanged (event handlers stay as-is)
// =============================================================================

function reactiveJSXExpressionsPlugin() {
  return {
    visitor: {
      JSXExpressionContainer(path) {
        const expr = path.node.expression

        // JSX comments {/* ... */} — skip
        if (expr.type === 'JSXEmptyExpression') return

        // Already a function — nothing to wrap
        if (expr.type === 'ArrowFunctionExpression' || expr.type === 'FunctionExpression') return

        // Literals are static — no reactivity needed
        if (expr.type === 'StringLiteral' || expr.type === 'NumericLiteral' || expr.type === 'BooleanLiteral') return

        // Event handlers (on*), ref, key — skip
        const parent = path.parent
        if (parent.type === 'JSXAttribute') {
          const name = parent.name.name
          if (name.startsWith('on') || name === 'ref' || name === 'key') return

          // For component props (uppercase tag), don't wrap — pass values as-is.
          // Only wrap for HTML element attributes (lowercase tag) for reactive DOM binding.
          const jsxEl = path.findParent(p => p.isJSXOpeningElement())
          if (jsxEl) {
            const tagName = jsxEl.node.name
            // Uppercase first letter = component, don't wrap props
            if (tagName.type === 'JSXIdentifier' && /^[A-Z]/.test(tagName.name)) return
          }
        }

        // Wrap: expr → () => expr
        path.node.expression = t.arrowFunctionExpression([], expr)
      }
    }
  }
}

// =============================================================================
// Vite plugin: pipes .jsx files through babel with both transforms
// =============================================================================

export default function reactiveJSX() {
  return {
    name: 'reactive-jsx',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('.jsx')) return null

      const result = babel.transformSync(code, {
        filename: id,
        plugins: [
          reactiveVariablesPlugin,
          reactiveJSXExpressionsPlugin,
          ['@babel/plugin-transform-react-jsx', { pragma: 'h', pragmaFrag: 'Fragment' }]
        ],
        sourceMaps: true
      })

      return { code: result.code, map: result.map }
    }
  }
}
