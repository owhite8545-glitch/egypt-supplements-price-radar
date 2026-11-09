import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runScraper } from './scraper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

let isScraping = false;
let lastScrapeLogs = [];

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // API Routes
  if (pathname === '/api/catalog') {
    try {
      const catalogPath = path.join(__dirname, 'catalog.json');
      if (fs.existsSync(catalogPath)) {
        const data = fs.readFileSync(catalogPath, 'utf8');
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(data);
      } else {
        return sendJson(res, 404, { error: 'Catalog not generated yet. Click Sync.' });
      }
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/stores') {
    try {
      const storesPath = path.join(__dirname, 'stores.json');
      const data = JSON.parse(fs.readFileSync(storesPath, 'utf8'));
      return sendJson(res, 200, data);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/coupons') {
    try {
      const couponsPath = path.join(__dirname, 'coupons.json');
      const data = JSON.parse(fs.readFileSync(couponsPath, 'utf8'));
      return sendJson(res, 200, data);
    } catch (err) {
      return sendJson(res, 500, { error: err.message });
    }
  }

  if (pathname === '/api/status') {
    return sendJson(res, 200, {
      isScraping,
      logs: lastScrapeLogs.slice(-20)
    });
  }

  if (pathname === '/api/sync' && req.method === 'POST') {
    if (isScraping) {
      return sendJson(res, 409, { error: 'سحب البيانات قيد التنفيذ حالياً' });
    }
    isScraping = true;
    lastScrapeLogs = [`بدء سحب البيانات في ${new Date().toLocaleTimeString('ar-EG')}`];

    // Read options if any
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      let isFull = false;
      try {
        if (body) {
          const parsed = JSON.parse(body);
          isFull = !!parsed.full;
        }
      } catch (e) {}

      // Run async
      runScraper({ full: isFull })
        .then(result => {
          isScraping = false;
          lastScrapeLogs.push(`اكتمل السحب بنجاح: تم سحب ${result.metadata.totalRawProducts} منتج.`);
        })
        .catch(err => {
          isScraping = false;
          lastScrapeLogs.push(`فشل السحب: ${err.message}`);
        });

      return sendJson(res, 202, { message: 'تم إطلاق السحب بنجاح', isFull });
    });
    return;
  }

  if (pathname === '/api/import' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const imported = JSON.parse(body);
        if (!imported.products || !Array.isArray(imported.products)) {
          return sendJson(res, 400, { error: 'ملف غير صالح، يجب أن يحتوي على مصفوفة products' });
        }
        const catalogPath = path.join(__dirname, 'catalog.json');
        fs.writeFileSync(catalogPath, JSON.stringify(imported, null, 2), 'utf8');
        return sendJson(res, 200, {
          message: 'تم استيراد الكتالوج بنجاح',
          itemsCount: imported.products.length
        });
      } catch (err) {
        return sendJson(res, 400, { error: 'خطأ في قراءة ملف JSON: ' + err.message });
      }
    });
    return;
  }

  // Static files
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript',
    '.mjs': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🎯 منصة "أرخص سعر" - رادار أسعار المكملات في مصر تعمل الآن!`);
  console.log(`🌐 الرابط المحلي: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
