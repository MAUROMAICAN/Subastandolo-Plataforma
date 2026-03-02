import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gztwcjsuhogvrowzfoor.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6dHdjanN1aG9ndnJvd3pmb29yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI0NTczMjksImV4cCI6MjA4ODAzMzMyOX0.ZT-0jj9XQ7EuJjD3eNhkFkUf71qW8HNBRWcaPX8CaL8';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkUsers() {
    const { data, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error fetching users:', error);
    } else {
        console.log('--- ALL USERS ---');
        console.log(JSON.stringify(data.users.map(u => ({ id: u.id, email: u.email })), null, 2));
    }
}

checkUsers();
