

const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPES = { avif: 'image/avif', webp: 'image/webp', jpg: 'image/jpeg' };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method not allowed');
  }

  const { p: productId, f: filename } = req.query || {};
  const match = /^([0-9a-f-]{36})\.(avif|webp|jpg)$/i.exec(filename || '');
  if (!UUID_RE.test(productId || '') || !match) {
    return res.status(404).send('Not found');
  }
  const ext = match[2].toLowerCase();

  const upstreamUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/product-images/${productId}/${filename}`;
  let upstream;
  try {
    upstream = await fetch(upstreamUrl);
  } catch (e) {
    return res.status(502).send('Upstream fetch failed');
  }
  if (!upstream.ok) {
    return res.status(upstream.status === 404 ? 404 : 502).send('Not found');
  }

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.setHeader('Content-Type', CONTENT_TYPES[ext]);
  res.setHeader('Cache-Control', CACHE_CONTROL);
  return res.status(200).send(buffer);
};
