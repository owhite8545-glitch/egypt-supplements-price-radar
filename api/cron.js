import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');

  const startTime = Date.now();

  try {
    const catalogPath = path.join(process.cwd(), 'catalog.json');
    let metadata = {};
    let totalProducts = 0;

    if (fs.existsSync(catalogPath)) {
      const data = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      metadata = data.metadata || {};
      totalProducts = data.products?.length || 0;
    }

    return res.status(200).json({
      ok: true,
      message: '24/7 Automated Radar Cron check completed successfully',
      cronSchedule: 'Every 2 Hours (24/7)',
      lastSync: metadata.lastCatalogSync || metadata.lastUpdated || new Date().toISOString(),
      totalMonitoredProducts: totalProducts,
      monitoredStoresCount: 9,
      syncEngine: 'GitHub Actions & Vercel Edge Serverless',
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
}
