import fetch from 'node-fetch';

async function testVal() {
    const url = 'https://oqjwrrttncfcznhmzlrk.supabase.co/functions/v1/validate-registration';
    const anonKey = process.env.VITE_SUPABASE_ANON_KEY;

    if (!anonKey) {
        console.error("Set VITE_SUPABASE_ANON_KEY environment variable.");
        return;
    }

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${anonKey}`
            },
            body: JSON.stringify({ email: "test_pin_user@example.com", phone: "04121234567" })
        });

        const data = await response.json();
        console.log("Status:", response.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (err) {
        console.error("Fetch error:", err);
    }
}

testVal();
