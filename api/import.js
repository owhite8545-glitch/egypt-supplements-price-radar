export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const items = data.products || (Array.isArray(data) ? data : []);

    return res.status(200).json({
      ok: true,
      itemsCount: items.length,
      message: `تم استلام وتحقق الكتالوج (${items.length} منتج) بنجاح`
    });
  } catch (err) {
    return res.status(400).json({ error: 'ملف JSON غير صالح: ' + err.message });
  }
}
