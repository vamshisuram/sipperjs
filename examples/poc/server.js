import { createServer as createViteServer } from 'vite'
import { createServer } from 'http'

async function start() {
  // Create Vite dev server in middleware mode for SSR
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'custom'
  })

  const server = createServer(async (req, res) => {
    // Let Vite handle static assets and HMR
    if (req.url !== '/' && req.url !== '/index.html') {
      vite.middlewares.handle(req, res, () => {
        res.writeHead(404)
        res.end('Not Found')
      })
      return
    }

    try {
      // Load the server entry through Vite (gets JSX transform)
      const { render } = await vite.ssrLoadModule('/src/entry.server.jsx')
      const { html: appHtml, state } = render()

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SSR Framework POC</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; }
    button { margin: 4px; padding: 6px 16px; cursor: pointer; }
    .section { border: 1px solid #ddd; border-radius: 8px; padding: 16px; margin: 16px 0; }
  </style>
</head>
<body>
  <div id="app">${appHtml}</div>
  <script type="application/hydration">${JSON.stringify(state)}</script>
  <script type="module" src="/src/entry.client.jsx"></script>
</body>
</html>`

      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(html)
    } catch (e) {
      vite.ssrFixStacktrace(e)
      console.error(e)
      res.writeHead(500)
      res.end(e.message)
    }
  })

  server.listen(3000, () => {
    console.log('SSR server running at http://localhost:3000')
  })
}

start()
