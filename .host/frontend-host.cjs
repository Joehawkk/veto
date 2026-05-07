const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const host = '0.0.0.0';
const port = Number(process.env.PORT || 5173);
const backendHost = process.env.BACKEND_HOST || '127.0.0.1';
const backendPort = Number(process.env.BACKEND_PORT || 8080);
const distDir = path.join(__dirname, '..', 'frontend', 'dist');

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sendFile(filePath, response) {
  const ext = path.extname(filePath).toLowerCase();
  response.writeHead(200, {
    'Content-Type': mimeTypes[ext] || 'application/octet-stream',
  });
  fs.createReadStream(filePath).pipe(response);
}

function serveSpa(requestPath, response) {
  const cleanPath = requestPath === '/' ? '/index.html' : requestPath;
  const resolvedPath = path.normalize(path.join(distDir, cleanPath));

  if (resolvedPath.startsWith(distDir) && fs.existsSync(resolvedPath) && fs.statSync(resolvedPath).isFile()) {
    sendFile(resolvedPath, response);
    return;
  }

  sendFile(path.join(distDir, 'index.html'), response);
}

function proxyApi(request, response) {
  const options = {
    hostname: backendHost,
    port: backendPort,
    path: request.url,
    method: request.method,
    headers: {
      ...request.headers,
      host: `${backendHost}:${backendPort}`,
    },
  };

  const proxyRequest = http.request(options, (proxyResponse) => {
    response.writeHead(proxyResponse.statusCode || 502, proxyResponse.headers);
    proxyResponse.pipe(response);
  });

  proxyRequest.on('error', (error) => {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'backend unavailable', detail: error.message }));
  });

  request.pipe(proxyRequest);
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/healthz') {
    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('ok');
    return;
  }

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/uploads')) {
    proxyApi(request, response);
    return;
  }

  serveSpa(url.pathname, response);
});

server.listen(port, host, () => {
  console.log(`frontend host listening on http://${host}:${port}`);
});
