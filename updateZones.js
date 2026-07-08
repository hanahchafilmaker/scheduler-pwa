// Update qc_zones keys based on provided CSV
require('dotenv').config({ path: '.env' });
const { supabase } = require('./lib/supabase');

const zones = [
  { key: 'left', label: '냉장(좌)', sort_order: 0 },
  { key: 'right', label: '냉장(우)', sort_order: 1 },
  { key: 'freezer', label: '냉동고', sort_order: 2 },
  { key: 'freezerTop', label: '대형냉동고(상)', sort_order: 3 },
  { key: 'freezerBottom', label: '대형냉동고(하)', sort_order: 4 },
  { key: 'room', label: '상온', sort_order: 5 },
];

async function main() {
  console.log('Starting zone update...');
  for (const z of zones) {
    const { data, error } = await supabase
      .from('qc_zones')
      .upsert(
        { key: z.key, label: z.label, sort_order: z.sort_order },
        { onConflict: 'key' }
      );
    if (error) {
      console.error(`Error upserting zone ${z.key}:`, error);
      process.exit(1);
    }
    console.log(`Upserted zone ${z.key}:`, data);
  }
  console.log('Zone update completed.');
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});