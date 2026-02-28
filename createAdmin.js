const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createAdmin() {
  const { data, error } = await supabase.auth.signUp({
    email: 'uniformeskronus@gmail.com',
    password: 'Maikol*.2861',
    options: {
      data: {
        full_name: 'Administrator'
      }
    }
  });

  if (error) {
    if (error.message.includes('already exists')) {
      console.log('User already exists. Proceeding to assign role.');
      // Get user ID
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: 'uniformeskronus@gmail.com',
        password: 'Maikol*.2861'
      });
      if (signInData?.user) {
        console.log('User ID:', signInData.user.id);
        const { error: roleError } = await supabase.from('user_roles').upsert({
          user_id: signInData.user.id,
          role: 'admin'
        });
        if (roleError) console.error('Error assigning role:', roleError);
        else console.log('Successfully assigned admin role to existing user.');
      } else {
        console.error('Could not get user ID to assign role:', signInError);
      }
    } else {
      console.error('Error creating user:', error);
    }
  } else if (data?.user) {
    console.log('User created:', data.user.id);
    const { error: roleError } = await supabase.from('user_roles').insert({
      user_id: data.user.id,
      role: 'admin'
    });
    if (roleError) console.error('Error assigning role:', roleError);
    else console.log('Successfully created user and assigned admin role.');
  }
}

createAdmin();
