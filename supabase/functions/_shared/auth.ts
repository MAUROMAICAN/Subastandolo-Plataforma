import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Verifies that the caller is the Supabase service role (server-to-server).
 * Returns true if the Authorization header matches the service role key.
 * Use this for Edge Functions that should ONLY be invoked by other Edge Functions,
 * DB triggers, or cron jobs — never directly by end users.
 */
export function isServiceRole(req: Request): boolean {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return false;
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    return token === serviceRoleKey;
}

/**
 * Verifies the caller is an authenticated user.
 * Returns the user object if valid, or null if not.
 */
export async function getCallerUser(req: Request): Promise<{ id: string; email?: string } | null> {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const client = createClient(supabaseUrl, anonKey, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error } = await client.auth.getUser();
        if (error || !user) return null;
        return { id: user.id, email: user.email };
    } catch {
        return null;
    }
}

/**
 * Checks if the caller is an admin user.
 * First validates the JWT, then checks the user_roles table.
 */
export async function isAdmin(req: Request): Promise<boolean> {
    const user = await getCallerUser(req);
    if (!user) return false;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .limit(1);
    return (data && data.length > 0) || false;
}

/**
 * Returns true if the caller is either the service role OR an admin user.
 * Use for functions invoked from admin panel AND from other Edge Functions.
 */
export async function isServiceRoleOrAdmin(req: Request): Promise<boolean> {
    return isServiceRole(req) || await isAdmin(req);
}

/**
 * Returns true if the caller is either the service role OR any authenticated user.
 * Use for functions invoked from client code (any logged-in user) AND from other Edge Functions.
 */
export async function isServiceRoleOrUser(req: Request): Promise<boolean> {
    return isServiceRole(req) || (await getCallerUser(req)) !== null;
}

/** Standard 401 response */
export function unauthorized(corsHeaders: Record<string, string>) {
    return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}

/** Standard 403 response */
export function forbidden(corsHeaders: Record<string, string>) {
    return new Response(
        JSON.stringify({ error: "Acceso denegado" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
}
