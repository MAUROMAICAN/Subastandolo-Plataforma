import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Normalize Venezuelan phone numbers to a consistent format
function normalizePhone(phone: string): string {
  if (!phone) return "";
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, "");
  // Handle Venezuelan formats: 0412... -> 58412..., 412... -> 58412...
  if (digits.startsWith("0") && digits.length === 11) {
    digits = "58" + digits.substring(1);
  } else if (digits.length === 10 && !digits.startsWith("58")) {
    digits = "58" + digits;
  }
  return digits;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, phone } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const errors: string[] = [];

    // 1. Check blacklisted_records
    if (email) {
      const { data: blacklistedEmail } = await supabase
        .from("blacklisted_records")
        .select("id")
        .eq("email", email.toLowerCase().trim())
        .limit(1);
      if (blacklistedEmail && blacklistedEmail.length > 0) {
        errors.push("blacklisted_email");
      }
    }

    const normalizedPhone = phone ? normalizePhone(phone.trim()) : "";

    if (normalizedPhone) {
      // Check blacklist with normalized phone
      const { data: blacklistedPhone } = await supabase
        .from("blacklisted_records")
        .select("id, phone")
        .not("phone", "is", null);

      if (blacklistedPhone) {
        const isBlacklisted = blacklistedPhone.some(
          (record: { phone: string }) => normalizePhone(record.phone) === normalizedPhone
        );
        if (isBlacklisted) {
          errors.push("blacklisted_phone");
        }
      }
    }

    // 2. Check if phone already exists in profiles (normalized comparison)
    // Allow duplication only if the existing owner is an admin
    if (normalizedPhone && !errors.includes("blacklisted_phone")) {
      const { data: existingPhones } = await supabase
        .from("profiles")
        .select("id, phone")
        .not("phone", "is", null);

      if (existingPhones) {
        const matchingProfiles = existingPhones.filter(
          (profile: { id: string; phone: string }) => profile.phone && normalizePhone(profile.phone) === normalizedPhone
        );

        if (matchingProfiles.length > 0) {
          // Check if ALL matching profiles belong to admins
          const { data: adminRoles } = await supabase
            .from("user_roles")
            .select("user_id")
            .eq("role", "admin")
            .in("user_id", matchingProfiles.map((p: { id: string }) => p.id));

          const adminIds = new Set((adminRoles || []).map((r: { user_id: string }) => r.user_id));
          const nonAdminDuplicates = matchingProfiles.some(
            (p: { id: string }) => !adminIds.has(p.id)
          );

          if (nonAdminDuplicates) {
            errors.push("duplicate_phone");
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ valid: errors.length === 0, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ valid: false, errors: ["server_error"] }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
