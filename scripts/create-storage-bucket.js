const { getSupabaseAdmin } = require('../api/_lib/supabaseAdmin');

async function main() {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.createBucket('product-images', {
    public: true,
    fileSizeLimit: '5MB',
  });
  if (error && !/already exists/i.test(error.message)) {
    console.error('Failed to create bucket:', error.message);
    process.exit(1);
  }
  console.log('Bucket product-images ready.');
}

main();
