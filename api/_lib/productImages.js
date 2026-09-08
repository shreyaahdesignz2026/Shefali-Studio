

async function attachImages(supabase, products) {
  if (!products.length) return products;

  const { data: images, error } = await supabase
    .from('product_images')
    .select('product_id, slug, position')
    .in('product_id', products.map((p) => p.id))
    .order('position');
  if (error) throw new Error(error.message);

  const byProduct = {};
  (images || []).forEach((img) => {
    (byProduct[img.product_id] = byProduct[img.product_id] || []).push(img);
  });
  products.forEach((p) => {
    p.images = byProduct[p.id] || [];
  });

  return products;
}

module.exports = { attachImages };
