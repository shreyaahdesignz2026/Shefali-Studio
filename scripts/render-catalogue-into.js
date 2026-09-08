

const fs = require('fs');
const path = require('path');
const { getSupabaseAdmin } = require('../api/_lib/supabaseAdmin');
const { renderCatalogueHtml } = require('../api/_lib/templateProducts');
const { attachImages } = require('../api/_lib/productImages');

async function main() {
  const targetDir = process.argv[2];
  if (!targetDir) {
    console.error('Usage: node scripts/render-catalogue-into.js <target-directory>');
    process.exit(1);
  }

  const supabase = getSupabaseAdmin();
  const { data: products, error } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')
    .order('category')
    .order('name');
  if (error) {
    console.error('Failed to load products:', error.message);
    process.exit(1);
  }

  await attachImages(supabase, products);

  const catalogueHtml = renderCatalogueHtml(products);

  const productsPagePath = path.join(targetDir, 'products', 'index.html');
  const original = fs.readFileSync(productsPagePath, 'utf8');
  const start = original.indexOf('<!-- CATALOGUE:START -->');
  const end = original.indexOf('<!-- CATALOGUE:END -->');
  if (start === -1 || end === -1) {
    console.error(`Catalogue markers not found in ${productsPagePath}`);
    process.exit(1);
  }
  const updated =
    original.slice(0, start) + '<!-- CATALOGUE:START -->\n' + catalogueHtml + '\n' + original.slice(end);
  fs.writeFileSync(productsPagePath, updated, 'utf8');
  console.log(`Rendered ${products.length} active products into ${productsPagePath}`);
}

main();
