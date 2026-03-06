import { createClient } from '@supabase/supabase-js';

async function test() {
    const url = 'https://gztwcjsuhogvrowzfoor.supabase.co';
    const serviceRole = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dHdjanN1aG9ndnJvd3pmb29yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjQ1NzMyOSwiZXhwIjoyMDg4MDMzMzI5fQ.Lq87E6h35zR6T3i7PzC6E_u23L8E_fWn22Vd8R2g0uI'; // Need to fetch service role key first, wait... actually I don't see it in .env.development. 

    const adminClient = createClient(url, serviceRole, { auth: { persistSession: false } });

    const userId = '1a938e7d-3047-4f6c-8597-9dd0439c27ee';

    let actualUserId = userId;
    const { data: profiles, error: profileErr } = await adminClient.from('profiles').select('id, first_name, last_name, full_name').ilike('full_name', '%Mauro%').limit(1);
    if (profiles && profiles.length > 0) {
        actualUserId = profiles[0].id;
        console.log('Found user ID:', actualUserId);
    } else {
        console.log('User not found by name, using fallback ID');
    }

    console.log('Running queries...');
    try {
        const { data: userData, error: e1 } = await adminClient.auth.admin.getUserById(actualUserId);
        if (e1) console.error('getUserById error:', e1);

        const { data: profileData, error: e2 } = await adminClient.from('profiles').select('*').eq('id', actualUserId).single();
        if (e2) console.error('profiles error:', e2);

        const { data: rolesData, error: e3 } = await adminClient.from('user_roles').select('role').eq('user_id', actualUserId);
        if (e3) console.error('roles error:', e3);

        const { data: dealerData, error: e4 } = await adminClient.from('dealer_verification').select('*').eq('user_id', actualUserId).maybeSingle();
        if (e4) console.error('dealer error:', e4);

        const { data: bidsData, error: e5 } = await adminClient.from('bids').select('id, amount, auction_id, created_at').eq('user_id', actualUserId).order('created_at', { ascending: false }).limit(50);
        if (e5) console.error('bids error:', e5);

        const { data: wonAuctions, error: e6 } = await adminClient.from('auctions').select('id, title, current_price, status, end_time').eq('winner_id', actualUserId).order('end_time', { ascending: false }).limit(20);
        if (e6) console.error('auctions error:', e6);

        const { data: reviewsReceived, error: e7 } = await adminClient.from('reviews').select('id, rating, comment, review_type, created_at').eq('reviewed_id', actualUserId).order('created_at', { ascending: false }).limit(20);
        if (e7) console.error('reviewsReceived error:', e7);

        const { data: reviewsGiven, error: e8 } = await adminClient.from('reviews').select('id, rating, comment, review_type, created_at').eq('reviewer_id', actualUserId).order('created_at', { ascending: false }).limit(20);
        if (e8) console.error('reviewsGiven error:', e8);

        const { data: disputes, error: e9 } = await adminClient.from('disputes').select('id, status, category, created_at, resolution').or(`buyer_id.eq.${actualUserId}, dealer_id.eq.${actualUserId} `).order('created_at', { ascending: false }).limit(20);
        if (e9) console.error('disputes error:', e9);

        const { data: paymentProofs, error: e10 } = await adminClient.from('payment_proofs').select('id, amount_usd, status, created_at, auction_id').eq('buyer_id', actualUserId).order('created_at', { ascending: false }).limit(20);
        if (e10) console.error('payment_proofs error:', e10);

        console.log('Queries complete');
    } catch (err) {
        console.error('Exception thrown:', err);
    }
}

test();
