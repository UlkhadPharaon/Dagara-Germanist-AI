import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getSupabase, isSupabaseConfigured, type AuthUser } from './supabase';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** False while the stored session is being restored. */
  loading: boolean;
  /** False when the build has no Supabase credentials — everything stays local. */
  cloudEnabled: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapAuthError(error: { message?: string; status?: number }): string {
  const message = error.message ?? '';
  if (/Invalid login credentials/i.test(message)) {
    return 'Email ou mot de passe incorrect.';
  }
  if (/Email not confirmed/i.test(message)) {
    return 'Veuillez confirmer votre adresse email avant de vous connecter.';
  }
  if (/User already registered/i.test(message)) {
    return 'Un compte existe déjà avec cette adresse email.';
  }
  if (error.status === 429 || /rate limit/i.test(message)) {
    return 'Trop de tentatives. Veuillez patienter quelques instants.';
  }
  return message || 'Une erreur est survenue. Veuillez réessayer.';
}

/**
 * Session provider.
 *
 * Without Supabase credentials the provider still mounts (so every consumer
 * keeps working) but reports `cloudEnabled: false` and a null user; the app
 * then behaves exactly as the local-only prototype did.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => getSupabase(), []);
  const cloudEnabled = useMemo(() => isSupabaseConfigured() && supabase !== null, [supabase]);

  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(cloudEnabled);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        const sessionUser = data.session?.user;
        setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
      })
      .catch(error => {
        console.error('Restauration de la session impossible :', error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user;
      setUser(sessionUser ? { id: sessionUser.id, email: sessionUser.email ?? null } : null);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [supabase]);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!emailPattern.test(email)) {
        return { ok: false, message: "Format d'email invalide." };
      }
      if (password.length < 8) {
        return { ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' };
      }
      if (!supabase) {
        return {
          ok: false,
          message:
            'Les comptes cloud ne sont pas configurés sur cette installation. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
        };
      }

      const { error } = await supabase.auth.signUp({ email, password });
      if (error) return { ok: false, message: mapAuthError(error) };
      return { ok: true };
    },
    [supabase]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!emailPattern.test(email)) {
        return { ok: false, message: "Format d'email invalide." };
      }
      if (!supabase) {
        return {
          ok: false,
          message:
            'Les comptes cloud ne sont pas configurés sur cette installation. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
        };
      }

      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, message: mapAuthError(error) };
      return { ok: true };
    },
    [supabase]
  );

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, cloudEnabled, signUp, signIn, signOut }),
    [user, loading, cloudEnabled, signUp, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth doit être utilisé dans un <AuthProvider>.');
  }
  return context;
}
