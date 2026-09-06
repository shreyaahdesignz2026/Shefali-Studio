const crypto = require('node:crypto');
const sharp = require('sharp');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');

const MAX_WIDTH = 1200;
const BUCKET = 'product-images';
const CACHE_MAX_AGE_SECONDS = String(60 * 60 * 24 * 365); // 1 year — each slug is unique and immutable, so this is safe

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  try {
    await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();

  if (req.method === 'POST') {
    const productId = req.query.productId;
    if (!productId) {
      return res.status(400).json({ error: 'Missing productId query param' });
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

    const slug = crypto.randomUUID();
    const uploads = [
      { path: `${productId}/${slug}.avif`, buffer: avifBuffer, contentType: 'image/avif' },
      { path: `${productId}/${slug}.webp`, buffer: webpBuffer, contentType: 'image/webp' },
      { path: `${productId}/${slug}.jpg`, buffer: jpgBuffer, contentType: 'image/jpeg' },
    ];

    // Three independent network round-trips -- run them concurrently
    // rather than one after another, since none depends on another's
    // result (each writes a different file path).
    const uploadResults = await Promise.all(
      uploads.map((u) =>
        supabase.storage.from(BUCKET).upload(u.path, u.buffer, {
          contentType: u.contentType,
          cacheControl: CACHE_MAX_AGE_SECONDS,
          upsert: true,
        }).then((result) => ({ path: u.path, ...result }))
      )
    );
    for (const { path, error } of uploadResults) {
      if (error) {
        return res.status(500).json({ error: `Storage upload failed for ${path}: ${error.message}` });
      }
    }

    const { data: existing, error: existingError } = await supabase
      .from('product_images')
      .select('position')
      .eq('product_id', productId)
      .order('position', { ascending: false })
      .limit(1);
    if (existingError) return res.status(500).json({ error: existingError.message });
    const nextPosition = existing.length ? existing[0].position + 1 : 0;

    const { data: row, error: insertError } = await supabase
      .from('product_images')
      .insert({ product_id: productId, slug, position: nextPosition })
      .select()
      .single();
    if (insertError) return res.status(500).json({ error: insertError.message });

    return res.status(200).json({ ok: true, image: row });
  }

  if (req.method === 'DELETE') {
    const imageId = req.query.imageId;
    if (!imageId) {
      return res.status(400).json({ error: 'Missing imageId query param' });
    }

    const { data: row, error: rowError } = await supabase
      .from('product_images')
      .select('product_id, slug')
      .eq('id', imageId)
      .maybeSingle();
    if (rowError) return res.status(500).json({ error: rowError.message });
    if (!row) return res.status(404).json({ error: 'Image not found' });

    const paths = ['avif', 'webp', 'jpg'].map((ext) => `${row.product_id}/${row.slug}.${ext}`);
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) return res.status(500).json({ error: removeError.message });

    const { error: deleteError } = await supabase.from('product_images').delete().eq('id', imageId);
    if (deleteError) return res.status(500).json({ error: deleteError.message });

    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
