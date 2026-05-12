const http = require('http');
const net = require('net');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const API_PORT = 5000;
const HTML = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  // Proxy /api/* to AXIS Office
  if (req.url.startsWith('/api/') || req.url.startsWith('/socket.io/')) {
    const body = [];
    req.on('data', chunk => body.push(chunk));
    req.on('end', () => {
      const options = {
        hostname: 'localhost',
        port: API_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${API_PORT}` }
      };
      const proxy = http.request(options, (apiRes) => {
        res.writeHead(apiRes.statusCode, {
          ...apiRes.headers,
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type,Authorization'
        });
        apiRes.pipe(res);
      });
      proxy.on('error', () => {
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'AXIS Office offline' }));
      });
      if (body.length) proxy.write(Buffer.concat(body));
      proxy.end();
    });
    return;
  }

  // Serve static files from dashboard directory
  const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };
  const filePath = (req.url === '/' || req.url === '/index.html')
    ? HTML
    : path.join(__dirname, req.url.split('?')[0]);
  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'text/plain';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(err.code === 'ENOENT' ? 404 : 500); res.end(err.code === 'ENOENT' ? 'Not found' : 'Error'); return; }
    res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
});

// Proxy WebSocket upgrades (Socket.IO) to AXIS Office
server.on('upgrade', (req, clientSocket, head) => {
  const serverSocket = net.connect(API_PORT, 'localhost', () => {
    serverSocket.write(
      `${req.method} ${req.url} HTTP/1.1\r\n` +
      Object.entries(req.headers).map(([k,v]) => `${k}: ${v}`).join('\r\n') +
      '\r\n\r\n'
    );
    serverSocket.write(head);
  });
  serverSocket.pipe(clientSocket);
  clientSocket.pipe(serverSocket);
  serverSocket.on('error', () => clientSocket.destroy());
  clientSocket.on('error', () => serverSocket.destroy());
});

server.listen(PORT, () => {
  console.log(`\n⚔  AXIS RPG Dashboard  →  http://localhost:${PORT}`);
  console.log(`   Proxying API + WebSocket to AXIS Office :${API_PORT}`);
});
