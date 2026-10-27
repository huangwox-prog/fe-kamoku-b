#!/usr/bin/env node
'use strict';
// dist/ をローカルで確認するための簡易Webサーバ（外部依存なし）。
// 使い方: node serve.js [ポート番号]   既定は 8080

const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.argv[2]) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolveFile(urlPath) {
  const file = path.normalize(path.join(DIST, decodeURIComponent(urlPath)));
  if (!file.startsWith(DIST)) return null;
  try {
    const stat = fs.statSync(file);
    if (stat.isDirectory()) return resolveFile(path.posix.join(urlPath, 'index.html'));
    return file;
  } catch {
    return null;
  }
}

http
  .createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    // GitHub Pages と同じく、末尾スラッシュなしのディレクトリはリダイレクト
    if (!urlPath.endsWith('/') && !path.extname(urlPath) && resolveFile(urlPath + '/')) {
      res.writeHead(301, { Location: urlPath + '/' });
      return res.end();
    }
    const file = resolveFile(urlPath);
    if (!file) {
      res.writeHead(404, { 'Content-Type': TYPES['.html'] });
      const notFound = path.join(DIST, '404.html');
      return res.end(fs.existsSync(notFound) ? fs.readFileSync(notFound) : 'Not Found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(PORT, () => {
    console.log(`dist/ を配信中: http://localhost:${PORT}/  （Ctrl + C で停止）`);
  });
