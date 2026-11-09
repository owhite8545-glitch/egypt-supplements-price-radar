import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=120, s-maxage=600');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const couponsPath = path.join(process.cwd(), 'coupons.json');
    if (fs.existsSync(couponsPath)) {
      const data = fs.readFileSync(couponsPath, 'utf8');
      return res.status(200).send(data);
    } else {
      return res.status(404).json({ error: 'Coupons file not found' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
