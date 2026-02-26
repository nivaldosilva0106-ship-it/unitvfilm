import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import electron from 'vite-plugin-electron/simple';

// Custom Vite plugin to mimic Vercel's API proxy during local development
function apiProxyPlugin() {
  return {
    name: 'api-proxy-plugin',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        if (req.url && req.url.startsWith('/api/proxy-embed')) {
          const urlStr = req.url;
          const urlObj = new URL(urlStr, `http://${req.headers.host}`);
          const targetUrl = urlObj.searchParams.get('url');

          if (!targetUrl) {
            res.statusCode = 400;
            res.end('Missing URL parameter');
            return;
          }

          try {
            const fetchRes = await fetch(targetUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
              }
            });

            if (!fetchRes.ok) {
              res.statusCode = fetchRes.status;
              res.end(`Failed to fetch target URL: ${fetchRes.statusText}`);
              return;
            }

            const contentType = fetchRes.headers.get('content-type');
            if (contentType && !contentType.includes('text/html')) {
              const arrayBuffer = await fetchRes.arrayBuffer();
              res.setHeader('Content-Type', contentType);
              res.end(Buffer.from(arrayBuffer));
              return;
            }

            let html = await fetchRes.text();
            const targetUrlObj = new URL(targetUrl);
            const baseUrl = `${targetUrlObj.protocol}//${targetUrlObj.host}`;

            const injectedScript = `
              <script>
                window.open = function() { console.log("[Proxy] Blocked a popup."); return null; };
                document.addEventListener('click', function(e) {
                    const target = e.target.closest('a');
                    if (target && target.target === '_blank') {
                        e.preventDefault();
                        console.log("[Proxy] Blocked a click from opening a new tab.");
                    }
                }, true);
              </script>
            `;

            const headEndIndex = html.toLowerCase().indexOf('</head>');
            if (headEndIndex !== -1) {
              html = html.substring(0, headEndIndex) +
                `\n<base href="${baseUrl}/">\n${injectedScript}\n` +
                html.substring(headEndIndex);
            } else {
              html = `<base href="${baseUrl}/">\n${injectedScript}\n` + html;
            }

            res.setHeader('Content-Type', 'text/html; charset=utf-8');
            res.setHeader('Cache-Control', 's-maxage=0, stale-while-revalidate=0');
            res.statusCode = 200;
            res.end(html);
          } catch (error) {
            console.error('Proxy error:', error);
            res.statusCode = 500;
            res.end('Internal Server Error while proxying.');
          }
          return;
        }
        next();
      });
    }
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    apiProxyPlugin(),
    electron({
      main: {
        // Shortcut of `build.lib.entry`.
        entry: 'electron/main.ts',
      },
      preload: {
        // Shortcut of `build.rollupOptions.input`.
        // Preload scripts may contain Web assets, so use the `build.rollupOptions.input` instead `build.lib.entry`.
        input: path.join(__dirname, 'electron/preload.ts'),
      },
      // Ployfill the Electron and Node.js built-in modules for Renderer process.
      // See 👉 https://github.com/electron-vite/vite-plugin-electron-renderer
      renderer: {},
    }),
  ].filter(Boolean),
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/comandoplay': {
        target: 'https://comandoplay.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/comandoplay/, ''),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "react": path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react-router-dom": path.resolve(__dirname, "node_modules/react-router-dom"),
    },
    dedupe: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query"
    ],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "@tanstack/react-query"
    ],
    force: true,
  },
}));
