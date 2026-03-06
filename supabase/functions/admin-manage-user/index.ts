import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify admin using getClaims (compatible with signing-keys)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');

    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !callerUser?.id) {
      console.error('Auth error:', userError?.message);
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const adminId = callerUser.id;


    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Verify admin role
    const { data: roleData } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', adminId)
      .eq('role', 'admin')
      .limit(1);

    if (!roleData || roleData.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, userId, permissions, email: newEmail, password: newPassword, fullName: newFullName, phone: newPhone, role: newRole } = await req.json();

    // create_user doesn't require userId
    if (action === 'create_user') {
      if (!newEmail || !newPassword || !newFullName) {
        return new Response(JSON.stringify({ error: 'Missing email, password, or fullName' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create user in auth
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email: newEmail,
        password: newPassword,
        email_confirm: true,
        user_metadata: { full_name: newFullName, phone: newPhone || '' },
      });

      if (createError) {
        // Provide helpful message if user already exists
        if (createError.message?.includes('already been registered')) {
          return new Response(JSON.stringify({
            error: 'Este correo ya está registrado. Usa la opción "Promover" en la lista de usuarios para cambiar su rol.'
          }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        return new Response(JSON.stringify({ error: createError.message }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Assign role if specified (admin or dealer)
      if (newRole === 'admin' && newUser?.user) {
        await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role: 'admin' });
      }
      if (newRole === 'dealer' && newUser?.user) {
        await adminClient.from('user_roles').insert({ user_id: newUser.user.id, role: 'dealer' });
      }

      return new Response(JSON.stringify({ success: true, message: 'User created', userId: newUser?.user?.id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!userId || !action) {
      return new Response(JSON.stringify({ error: 'Missing action or userId' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Prevent self-actions (except read-only queries)
    const readOnlyActions = ['list_users', 'get_user_details', 'get_user_email'];
    if (userId === adminId && !readOnlyActions.includes(action)) {
      return new Response(JSON.stringify({ error: 'Cannot modify your own account' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'list_users') {
      const { data: authUsers, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
      if (listError) {
        return new Response(JSON.stringify({ error: listError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const emailMap: Record<string, string> = {};
      (authUsers?.users || []).forEach((u: any) => {
        emailMap[u.id] = u.email || '';
      });
      return new Response(JSON.stringify({ emails: emailMap }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'ban_user') {
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: 'User not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient.auth.admin.updateUserById(userId, { ban_duration: '876000h' });

      const { data: profile } = await adminClient.from('profiles').select('phone').eq('id', userId).single();
      await adminClient.from('blacklisted_records').insert({
        email: userData.user.email || null,
        phone: profile?.phone || null,
        reason: 'Suspendido por administrador',
        banned_by: adminId,
      });

      return new Response(JSON.stringify({ success: true, message: 'User banned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'unban_user') {
      await adminClient.auth.admin.updateUserById(userId, { ban_duration: 'none' });

      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      if (userData?.user?.email) {
        await adminClient.from('blacklisted_records').delete().eq('email', userData.user.email.toLowerCase());
      }

      return new Response(JSON.stringify({ success: true, message: 'User unbanned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'delete_user') {
      const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
      if (deleteError) {
        return new Response(JSON.stringify({ error: deleteError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'User deleted' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_user_email') {
      const { data: userData } = await adminClient.auth.admin.getUserById(userId);
      return new Response(JSON.stringify({ email: userData?.user?.email || '', banned: !!userData?.user?.banned_until }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'get_user_details') {
      const [
        userDataResult,
        profileDataResult,
        rolesDataResult,
        dealerDataResult,
        bidsDataResult,
        wonAuctionsResult,
        reviewsReceivedResult,
        reviewsGivenResult,
        disputesResult,
        paymentProofsResult
      ] = await Promise.allSettled([
        adminClient.auth.admin.getUserById(userId),
        adminClient.from('profiles').select('*').eq('id', userId).single(),
        adminClient.from('user_roles').select('role').eq('user_id', userId),
        adminClient.from('dealer_verification').select('*').eq('user_id', userId).maybeSingle(),
        adminClient.from('bids').select('id, amount, auction_id, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(50),
        adminClient.from('auctions').select('id, title, current_price, status, end_time').eq('winner_id', userId).order('end_time', { ascending: false }).limit(20),
        adminClient.from('reviews').select('id, rating, comment, review_type, created_at').eq('reviewed_id', userId).order('created_at', { ascending: false }).limit(20),
        adminClient.from('reviews').select('id, rating, comment, review_type, created_at').eq('reviewer_id', userId).order('created_at', { ascending: false }).limit(20),
        adminClient.from('disputes').select('id, status, category, created_at, resolution').or(`buyer_id.eq.${userId},dealer_id.eq.${userId}`).order('created_at', { ascending: false }).limit(20),
        adminClient.from('payment_proofs').select('id, amount_usd, status, created_at, auction_id').eq('buyer_id', userId).order('created_at', { ascending: false }).limit(20)
      ]);

      const safeData = (result: any) => result.status === 'fulfilled' && !result.value.error ? result.value.data : null;
      const getError = (result: any) => result.status === 'rejected' ? String(result.reason) : (result.value?.error ? result.value.error.message : null);

      const errors = {
        auth: getError(userDataResult),
        profile: getError(profileDataResult),
        roles: getError(rolesDataResult),
        dealer: getError(dealerDataResult),
        bids: getError(bidsDataResult),
        won_auctions: getError(wonAuctionsResult),
        reviews_received: getError(reviewsReceivedResult),
        reviews_given: getError(reviewsGivenResult),
        disputes: getError(disputesResult),
        payment_proofs: getError(paymentProofsResult),
      };

      // if any error exists, print it
      console.log('User details query errors:', JSON.stringify(errors));

      const userData = safeData(userDataResult);
      const profileData = safeData(profileDataResult);
      const rolesData = safeData(rolesDataResult);
      const dealerData = safeData(dealerDataResult);
      const bidsData = safeData(bidsDataResult);
      const wonAuctions = safeData(wonAuctionsResult);
      const reviewsReceived = safeData(reviewsReceivedResult);
      const reviewsGiven = safeData(reviewsGivenResult);
      const disputes = safeData(disputesResult);
      const paymentProofs = safeData(paymentProofsResult);

      return new Response(JSON.stringify({
        auth: {
          email: userData?.user?.email || '',
          email_confirmed: !!userData?.user?.email_confirmed_at,
          created_at: userData?.user?.created_at,
          last_sign_in: userData?.user?.last_sign_in_at,
          banned: !!userData?.user?.banned_until,
          banned_until: userData?.user?.banned_until,
        },
        profile: profileData,
        roles: (rolesData || []).map((r: any) => r.role),
        dealer: dealerData,
        bids: bidsData || [],
        won_auctions: wonAuctions || [],
        reviews_received: reviewsReceived || [],
        reviews_given: reviewsGiven || [],
        disputes: disputes || [],
        payment_proofs: paymentProofs || [],
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'promote_to_admin') {
      const { data: existingRole } = await adminClient
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'admin')
        .limit(1);

      if (existingRole && existingRole.length > 0) {
        return new Response(JSON.stringify({ error: 'El usuario ya es administrador' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient.from('user_roles').insert({ user_id: userId, role: 'admin' });

      return new Response(JSON.stringify({ success: true, message: 'User promoted to admin' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove_admin') {
      if (userId === adminId) {
        return new Response(JSON.stringify({ error: 'No puedes remover tu propio rol de administrador' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient.from('user_roles').delete().eq('user_id', userId).eq('role', 'admin');
      await adminClient.from('admin_permissions').delete().eq('user_id', userId);

      return new Response(JSON.stringify({ success: true, message: 'Admin role removed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'promote_to_dealer') {
      const { data: existingRole } = await adminClient
        .from('user_roles')
        .select('id')
        .eq('user_id', userId)
        .eq('role', 'dealer')
        .limit(1);

      if (existingRole && existingRole.length > 0) {
        return new Response(JSON.stringify({ error: 'El usuario ya tiene rol de dealer' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Add dealer role
      await adminClient.from('user_roles').insert({ user_id: userId, role: 'dealer' });

      // Create basic dealer_verification entry if doesn't exist
      const { data: existingDealer } = await adminClient
        .from('dealer_verification')
        .select('id')
        .eq('user_id', userId)
        .limit(1);

      if (!existingDealer || existingDealer.length === 0) {
        const { data: profile } = await adminClient.from('profiles').select('full_name, phone').eq('id', userId).single();
        await adminClient.from('dealer_verification').insert({
          user_id: userId,
          business_name: profile?.full_name || 'Dealer',
          phone: profile?.phone || '',
          full_name: profile?.full_name || '',
          status: 'approved',
          reviewed_by: adminId,
          reviewed_at: new Date().toISOString(),
          terms_accepted: true,
          account_status: 'active',
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Usuario promovido a dealer' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'remove_dealer') {
      await adminClient.from('user_roles').delete().eq('user_id', userId).eq('role', 'dealer');

      return new Response(JSON.stringify({ success: true, message: 'Rol de dealer removido' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'set_permissions') {
      if (!permissions || !Array.isArray(permissions)) {
        return new Response(JSON.stringify({ error: 'Missing permissions array' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      await adminClient.from('admin_permissions').delete().eq('user_id', userId);

      if (permissions.length > 0) {
        const rows = permissions.map((p: string) => ({
          user_id: userId,
          permission: p,
          granted_by: adminId,
        }));
        await adminClient.from('admin_permissions').insert(rows);
      }

      return new Response(JSON.stringify({ success: true, message: 'Permissions updated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'update_phone') {
      if (!newPhone && newPhone !== '') {
        return new Response(JSON.stringify({ error: 'Missing phone' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ phone: newPhone || null })
        .eq('id', userId);

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Also update user metadata
      await adminClient.auth.admin.updateUserById(userId, {
        user_metadata: { phone: newPhone || '' },
      });

      return new Response(JSON.stringify({ success: true, message: 'Phone updated' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'reset_password') {
      if (!newPassword || newPassword.length < 6) {
        return new Response(JSON.stringify({ error: 'La contraseña debe tener al menos 6 caracteres' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { error: resetError } = await adminClient.auth.admin.updateUserById(userId, {
        password: newPassword,
      });

      if (resetError) {
        return new Response(JSON.stringify({ error: resetError.message }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Password reset' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
