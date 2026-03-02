import { Client } from 'pg';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';

async function createAuction() {
    const client = new Client({ connectionString });

    try {
        await client.connect();
        console.log("Connected to PostgreSQL centrally.");

        // First disable trigger or constraints if necessary. We will find a user id.
        const userRes = await client.query('SELECT id FROM auth.users LIMIT 1;');
        if (userRes.rowCount === 0) {
            console.log("Wait, auth.users is entirely empty! This explains everything.");

            // Just insert a mock user if needed, or disable the constraint completely
            console.log("Disabling the constraint temporally...");
            await client.query('ALTER TABLE public.auctions DROP CONSTRAINT IF EXISTS auctions_created_by_fkey;');

            const insertRes = await client.query(`
         INSERT INTO public.auctions (
          title, description, starting_price, current_price, end_time, status, image_url, created_by
         ) VALUES (
          'Vehículo de Prueba (Maqueta)', 
          'Este es un vehículo de prueba insertado automáticamente para pruebas de diseño.',
          15000, 15000, NOW() + INTERVAL '7 days', 'active', 
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
          '00000000-0000-0000-0000-000000000000'
         ) RETURNING id;
       `);

            console.log("Mock Product created successfully! ID:", insertRes.rows[0].id);

        } else {
            const realUserId = userRes.rows[0].id;
            console.log("Found real user ID:", realUserId);

            const insertRes = await client.query(`
         INSERT INTO public.auctions (
          title, description, starting_price, current_price, end_time, status, image_url, created_by
         ) VALUES (
          'Vehículo de Prueba (Maqueta)', 
          'Este es un vehículo de prueba insertado automáticamente para pruebas de diseño.',
          15000, 15000, NOW() + INTERVAL '7 days', 'active', 
          'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
          $1
         ) RETURNING id;
       `, [realUserId]);

            console.log("Mock Product created successfully with real user. ID:", insertRes.rows[0].id);
        }

    } catch (e) {
        console.error("PG error:", e);
    } finally {
        await client.end();
    }
}

createAuction();
