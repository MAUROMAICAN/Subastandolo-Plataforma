import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gztwcjsuhogvrowzfoor.supabase.co';
// We need the service role key to bypass RLS and create products directly
const SERVICE_ROLE_KEY = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_ROLE_KEY) {
    console.error("Missing service role key! Check your .env setup.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
});

async function createMaquetaProduct() {
    console.log("Fetching first available user to act as creator...");
    const { data: usersData, error: usersErr } = await supabase.from('profiles').select('id').limit(1);

    if (usersErr || !usersData || usersData.length === 0) {
        console.error("Failed to find any user/profile:", usersErr);
        return;
    }

    const creatorId = usersData[0].id;
    console.log("Using user ID:", creatorId, "to create the dummy product.");

    const { data, error } = await supabase.from('auctions').insert({
        title: 'Vehículo de Prueba (Maqueta)',
        description: 'Este es un vehículo de prueba insertado automáticamente para pruebas de diseño en modo desarrollo.',
        starting_price: 15000,
        current_price: 15000,
        end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'active',
        image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
        created_by: creatorId
    }).select();

    if (error) {
        console.error("Failed to create dummy product:", error);
    } else {
        console.log("Successfully created dummy product:", data[0].title);
    }
}

createMaquetaProduct();
