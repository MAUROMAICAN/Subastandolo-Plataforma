const { createClient } = require('./node_modules/@supabase/supabase-js');

async function test() {
    const c = createClient('https://gztwcjsuhogvrowzfoor.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dHdjanN1aG9ndnJvd3pmb29yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ1NzMyOSwiZXhwIjoyMDg4MDMzMzI5fQ.Lq87E6h35zR6T3i7PzC6E_u23L8E_fWn22Vd8R2g0uI');
    const id = '1a938e7d-3047-4f6c-8597-9dd0439c27ee';

    const p = await Promise.all([
        c.auth.admin.getUserById(id),
        c.from('profiles').select('*').eq('id', id).single(),
        c.from('user_roles').select('role').eq('user_id', id),
        c.from('dealer_verification').select('*').eq('user_id', id).maybeSingle(),
        c.from('bids').select('id, amount, auction_id, created_at').eq('user_id', id).order('created_at', { ascending: false }).limit(50),
        c.from('auctions').select('id, title, current_price, status, end_time').eq('winner_id', id).order('end_time', { ascending: false }).limit(20),
        c.from('reviews').select('id, rating, comment, review_type, created_at').eq('reviewed_id', id).order('created_at', { ascending: false }).limit(20),
        c.from('reviews').select('id, rating, comment, review_type, created_at').eq('reviewer_id', id).order('created_at', { ascending: false }).limit(20),
        c.from('disputes').select('id, status, category, created_at, resolution').or(`buyer_id.eq.${id},dealer_id.eq.${id}`).order('created_at', { ascending: false }).limit(20),
        c.from('payment_proofs').select('id, amount_usd, status, created_at, auction_id').eq('buyer_id', id).order('created_at', { ascending: false }).limit(20)
    ]);

    console.log('Queries completed');
    p.forEach((res, index) => {
        if (res.error) console.log(`Query ${index} failed:`, res.error);
        else console.log(`Query ${index} returned data length:`, res.data ? (Array.isArray(res.data) ? res.data.length : '1 (object)') : 'null');
    });
}

test();
