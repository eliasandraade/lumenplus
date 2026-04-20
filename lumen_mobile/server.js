/**
 * Servidor estático para produção (Railway).
 * Serve a pasta dist/ gerada pelo expo export --platform web.
 * Todas as rotas desconhecidas redirecionam para index.html (SPA).
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '8081', 10);
const DIST = path.join(__dirname, 'dist');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.ttf':  'font/ttf',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.map':  'application/json',
};

if (!fs.existsSync(DIST)) {
  console.error('ERRO: pasta dist/ nao encontrada. Execute npm run build antes de iniciar.');
  process.exit(1);
}

const server = http.createServer((req, res) => {
  // Remove query string
  const urlPath = req.url.split('?')[0];
  let filePath = path.join(DIST, urlPath);

  // Tenta servir o arquivo direto; se nao existir, serve index.html (SPA)
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Lumen+ frontend servindo dist/ na porta ${PORT}`);
});
