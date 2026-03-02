import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: { full_name: string; phone: string | null; manual_buyer_tier?: string | null; avatar_url?: string | null } | null;
  isAdmin: boolean;
  isDealer: boolean;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, phone: string) => Promise<{ error: any | null }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<{ full_name: string; phone: string | null; manual_buyer_tier?: string | null; avatar_url?: string | null } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDealer, setIsDealer] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- LOCAL DEV BYPASS ---
  if (import.meta.env.DEV && localStorage.getItem("dev_bypass") === "true") {
    const fakeUser = {
      id: "00000000-0000-0000-0000-000000000000",
      email: "prueba@localhost",
    } as User;

    return (
      <AuthContext.Provider value={{
        user: fakeUser,
        session: { user: fakeUser } as Session,
        profile: { full_name: "Usuario Maqueta", phone: "+584120000000" },
        isAdmin: true,   // Grants admin access for UI testing
        isDealer: true,  // Grants dealer access for UI testing
        loading: false,
        refreshProfile: async () => { },
        signUp: async () => ({ error: null }),
        signIn: async () => ({ error: null }),
        signOut: async () => {
          localStorage.removeItem("dev_bypass");
          window.location.href = "/";
        }
      }}>
        {children}
      </AuthContext.Provider>
    );
  }
  // ------------------------

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from("profiles")
              .select("full_name, phone, manual_buyer_tier, avatar_url")
              .eq("id", session.user.id)
              .single();
            setProfile(profileData);

            const { data: rolesData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id);
            const roles = (rolesData || []).map((r: { role: string }) => r.role);
            setIsAdmin(roles.includes("admin"));
            setIsDealer(roles.includes("dealer") || roles.includes("admin"));
            setLoading(false);
          }, 0);
        } else {
          setProfile(null);
          setIsAdmin(false);
          setIsDealer(false);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: window.location.origin,
      },
    });
    // Detect already-registered email: Supabase returns a fake user with empty identities
    if (!error && data?.user && (!data.user.identities || data.user.identities.length === 0)) {
      return { error: { message: "Este correo ya está registrado. Intenta iniciar sesión o recuperar tu contraseña." } };
    }
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data: profileData } = await supabase
      .from("profiles")
      .select("full_name, phone, manual_buyer_tier, avatar_url")
      .eq("id", user.id)
      .single();
    if (profileData) setProfile(profileData);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, isAdmin, isDealer, loading, refreshProfile, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
