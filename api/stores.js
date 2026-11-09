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
    const storesPath = path.join(process.cwd(), 'stores.json');
    if (fs.existsSync(storesPath)) {
      const data = fs.readFileSync(storesPath, 'utf8');
      return res.status(200).send(data);
    } else {
      return res.status(404).json({ error: 'Stores configuration not found' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
