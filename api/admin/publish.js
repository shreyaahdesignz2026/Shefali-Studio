const fs = require('fs');
const path = require('path');
const os = require('os');
const { requireAdmin } = require('../_lib/auth');
const { getSupabaseAdmin } = require('../_lib/supabaseAdmin');
const { renderCatalogueHtml } = require('../_lib/templateProducts');
const { attachImages } = require('../_lib/productImages');
const { deployDirectory } = require('../_lib/vercelDeploy');

const INCLUDED_TOP_LEVEL = [
  'index.html',
  'about',
  'admin',
  'artisoul-tribe',
  'assets',
  'cart',
  'checkout',
  'contact',
  'events',
  'faq',
  'gift-card',
  'legal',
  'members',
  'notice-board',
  'products',
  'services',
  'special-offer',
  'wishlist',
];

function copyIncluded(srcRoot, destRoot) {
  fs.mkdirSync(destRoot, { recursive: true });
  for (const name of INCLUDED_TOP_LEVEL) {
    const src = path.join(srcRoot, name);
    if (!fs.existsSync(src)) continue;
    fs.cpSync(src, path.join(destRoot, name), { recursive: true });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    await requireAdmin(req.headers.authorization);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('category')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });

  try {
    await attachImages(supabase, products);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }

  const catalogueHtml = renderCatalogueHtml(products, process.env.SUPABASE_URL);

  const tmpDir = path.join(os.tmpdir(), `publish-${Date.now()}`);
  copyIncluded(process.cwd(), tmpDir);

  const productsPagePath = path.join(tmpDir, 'products', 'index.html');
  const original = fs.readFileSync(productsPagePath, 'utf8');
  const start = original.indexOf('<!-- CATALOGUE:START -->');
  const end = original.indexOf('<!-- CATALOGUE:END -->');
  if (start === -1 || end === -1) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return res.status(500).json({ error: 'Catalogue markers not found in products/index.html' });
  }
  const updated =
    original.slice(0, start) +
    '<!-- CATALOGUE:START -->\n' +
    catalogueHtml +
    '\n' +
    original.slice(end);
  fs.writeFileSync(productsPagePath, updated, 'utf8');

  fs.mkdirSync(path.join(tmpDir, '.vercel'), { recursive: true });
  fs.writeFileSync(
    path.join(tmpDir, '.vercel', 'project.json'),
    JSON.stringify({
      projectId: process.env.VERCEL_PROJECT_ID,
      orgId: process.env.VERCEL_ORG_ID,
      projectName: 'shreyaahs-bliss-trails',
    })
  );

  try {
    const result = await deployDirectory({
      rootDir: tmpDir,
      token: process.env.VERCEL_TOKEN,
      teamId: process.env.VERCEL_ORG_ID,
      projectId: process.env.VERCEL_PROJECT_ID,
      projectName: 'shreyaahs-bliss-trails',
    });
    return res.status(200).json({ ok: true, deployment: result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
};
