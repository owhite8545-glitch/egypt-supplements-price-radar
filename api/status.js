export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
  res.status(200).json({
    isScraping: false,
    status: 'online',
    platform: 'Vercel Serverless & CDN',
    logs: ['منصة أرخص سعر تعمل بكفاءة عالية على Vercel']
  });
}
