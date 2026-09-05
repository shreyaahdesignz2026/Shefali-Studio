const sharp = require('sharp');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

const MAX_WIDTH = 1200;
const BUCKET = 'product-images';
const CACHE_MAX_AGE_SECONDS = String(60 * 60 * 24 * 365); // 1 year — filenames are stable per product, so it's safe to cache this long

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const productId = req.query.productId;
  if (!productId) {
    return res.status(400).json({ error: 'Missing productId query param' });
  }

  try {
    await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  let original;
  try {
    original = await readRawBody(req);
    if (!original.length) throw new Error('Empty request body');
  } catch (e) {
    return res.status(400).json({ error: `Could not read uploaded image: ${e.message}` });
  }

  let avifBuffer, webpBuffer, jpgBuffer;
  try {
    const pipeline = sharp(original).resize({ width: MAX_WIDTH, withoutEnlargement: true });
    [avifBuffer, webpBuffer, jpgBuffer] = await Promise.all([
      pipeline.clone().avif({ quality: 60 }).toBuffer(),
      pipeline.clone().webp({ quality: 80 }).toBuffer(),
      pipeline.clone().jpeg({ quality: 82 }).toBuffer(),
    ]);
  } catch (e) {
    return res.status(400).json({ error: `Could not process image: ${e.message}` });
  }

  const supabase = getSupabaseAdmin();
  const uploads = [
    { path: `${productId}/image.avif`, buffer: avifBuffer, contentType: 'image/avif' },
    { path: `${productId}/image.webp`, buffer: webpBuffer, contentType: 'image/webp' },
    { path: `${productId}/image.jpg`, buffer: jpgBuffer, contentType: 'image/jpeg' },
  ];

  for (const u of uploads) {
    const { error } = await supabase.storage.from(BUCKET).upload(u.path, u.buffer, {
      contentType: u.contentType,
      cacheControl: CACHE_MAX_AGE_SECONDS,
      upsert: true,
    });
    if (error) {
      return res.status(500).json({ error: `Storage upload failed for ${u.path}: ${error.message}` });
    }
  }

  const { error: updateError } = await supabase
    .from('products')
    .update({ image_path: productId, updated_at: new Date().toISOString() })
    .eq('id', productId);
  if (updateError) {
    return res.status(500).json({ error: `Product update failed: ${updateError.message}` });
  }

  return res.status(200).json({ ok: true, image_path: productId });
};
