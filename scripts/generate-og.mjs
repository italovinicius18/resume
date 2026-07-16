import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { chromium } from 'playwright';

const profile = process.argv[2];
if (!['data', 'software'].includes(profile)) {
  console.error('usage: node scripts/generate-og.mjs <data|software>');
  process.exit(1);
}

const root = join('dist', profile);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = createServer(async (req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (pathname.endsWith('/')) pathname += 'index.html';
  try {
    const body = await readFile(join(root, pathname));
    res.setHeader('content-type', TYPES[extname(pathname)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('not found');
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

try {
  const response = await page.goto(`http://localhost:${port}/pt/`, { waitUntil: 'networkidle' });
  if (!response || !response.ok()) {
    throw new Error(`og page for ${profile} returned ${response?.status() ?? 'no response'} — did you run PROFILE=${profile} pnpm build?`);
  }
  await page.screenshot({ path: `public/og-${profile}.png` });
  console.log(`✔ public/og-${profile}.png`);
} finally {
  await browser.close();
  server.close();
}
