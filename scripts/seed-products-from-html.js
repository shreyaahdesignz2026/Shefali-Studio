const fs = require('fs');
const path = require('path');
const { getSupabaseAdmin } = require('../api/_lib/supabaseAdmin');

function parseProducts(html) {
  const articles = html.match(/<article class="product"[\s\S]*?<\/article>/g) || [];
  const products = [];
  const failures = [];

  for (const block of articles) {
    const category = (block.match(/data-cat="([^"]+)"/) || [])[1];
    const name = (block.match(/<h3 class="product-name">([^<]+)<\/h3>/) || [])[1];
    const subcategory = (block.match(/<p class="product-cat">([^<]+)<\/p>/) || [])[1];
    const description = (block.match(/<p class="product-desc">([^<]*)<\/p>/) || [])[1];
    const isProvisional = /data-provisional="1"/.test(block);

    const saleMatch = block.match(/<span class="price"><s>₹([\d.,]+)<\/s>₹([\d.,]+)<em>Sale<\/em><\/span>/);
    const plainMatch = block.match(/<span class="price">₹([\d.,]+)(?:<em[^>]*>[^<]*<\/em>)?<\/span>/);

    let price, originalPrice;
    if (saleMatch) {
      originalPrice = parseFloat(saleMatch[1].replace(/,/g, ''));
      price = parseFloat(saleMatch[2].replace(/,/g, ''));
    } else if (plainMatch) {
      price = parseFloat(plainMatch[1].replace(/,/g, ''));
      originalPrice = null;
    }

    if (!category || !name || price == null || Number.isNaN(price)) {
      failures.push({ name: name || '(unknown)', category: category || '(unknown)' });
      continue;
    }

    products.push({
      name,
      category,
      subcategory: subcategory || null,
      description: description || null,
      price,
      original_price: originalPrice || null,
      is_provisional: isProvisional,
      status: 'active',
    });
  }

  return { products, failures };
}

async function main() {
  const htmlPath = path.join(__dirname, '..', 'products', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const { products, failures } = parseProducts(html);

  console.log(`Parsed ${products.length} products, ${failures.length} failures.`);
  if (failures.length) {
    console.log('Failed to parse (add these manually via the admin panel):');
    failures.forEach((f) => console.log(`  - ${f.name} (${f.category})`));
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from('products').insert(products);
  if (error) {
    console.error('Insert failed:', error.message);
    process.exit(1);
  }
  console.log(`Inserted ${products.length} products.`);
}

main();
