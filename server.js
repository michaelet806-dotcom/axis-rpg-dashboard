const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8888;
const HTML = path.join(__dirname, 'index.html');

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    fs.readFile(HTML, (err, data) => {
      if (err) { res.writeHead(500); res.end('Error loading dashboard'); return; }
      res.writeHead(200, { 'Content-Type': 'text/html', 'Cache-Control': 'no-cache' });
      res.end(data);
    });
  } else {
    res.writeHead(404); res.end('Not found');
  }
});

server.listen(PORT, () => {
  console.log(`\n⚔  AXIS RPG Dashboard running at http://localhost:${PORT}`);
  console.log(`   Make sure AXIS Office is running on port 5000 for live data.`);
});
