'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const CONFIG = require('./js/config.js');

const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4'
};

function handler(req, res) {
  const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  const rel = urlPath === '/' ? '/index.html' : urlPath;
  const filePath = path.join(ROOT, path.normalize(rel));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, function (err, stat) {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found: ' + rel);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': stat.size,
      'Cache-Control': 'no-store'
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

function createServer() {
  return http.createServer(handler);
}

module.exports = { createServer };

if (require.main === module) {
  const port = Number(process.env.PORT || 5173);
  const server = createServer();
  server.listen(port, '127.0.0.1', function () {
    console.log(CONFIG.title + ' · ' + CONFIG.duration + 's · ' + CONFIG.width + 'x' + CONFIG.height);
    console.log('预览地址： http://127.0.0.1:' + port + '/');
    console.log('空格播放/暂停 · ←/→ 逐秒 · Home 回到开头');
  });
  server.on('error', function (err) {
    if (err.code === 'EADDRINUSE') {
      console.error('端口 ' + port + ' 被占用，可用 PORT=5174 npm run preview 换端口');
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}
