// Proxies product images from Supabase Storage through Vercel's own edge
// cache instead of every visitor's browser hitting Supabase directly. Each
// image is content-addressed (a random UUID slug minted once per upload,
// never reused or overwritten in place -- see api/admin/upload-image.js),
// so it's safe to cache "immutable" for a year: once Vercel's CDN has a
// copy for a given querystring, it never needs to ask Supabase again for
// it, which is what actually drives Supabase egress down (this route's own
// handler only ever runs again on a genuine cache miss).
//
// Query params rather than /api/img/<id>/<file> path segments: Vercel's
// zero-config build for a plain (non-framework) api/ directory only
// generates a single-path-segment route for a [...catchAll].js file (it
// does not expand to a true multi-segment regex the way Next.js's router
// does), so a two-segment path 404s at Vercel's own routing layer before
// this function ever runs. A flat file with a query string sidesteps that
// limitation entirely.
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
