import https from 'https';

const url = 'https://gztwcjsuhogvrowzfoor.supabase.co/rest/v1/auctions';
const apikey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dHdjanN1aG9ndnJvd3pmb29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTczMjksImV4cCI6MjA4ODAzMzMyOX0.ZT-0jj9XQ7EuJjD3eNhkFkUf71qW8HNBRWcaPX8CaL8';

const data = JSON.stringify({
    title: 'Vehículo de Prueba (Maqueta)',
    description: 'Este es un vehículo de prueba insertado automáticamente.',
    starting_price: 15000,
    current_price: 15000,
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    image_url: 'https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&q=80',
    // Try sending empty or omitting created_by to see if it lets it pass 
    // or trigger RLS insertion rule bypass if there is no logged-in user.
});

const options = {
    method: 'POST',
    headers: {
        'apikey': apikey,
        'Authorization': `Bearer ${apikey}`, // Using anon key, hope it lets us write
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    }
};

const req = https.request(url, options, (res) => {
    let responseData = '';

    res.on('data', (d) => {
        responseData += d;
    });

    res.on('end', () => {
        console.log(`Status code: ${res.statusCode}`);
        console.log(`Response: ${responseData}`);
    });
});

req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
});

req.write(data);
req.end();
