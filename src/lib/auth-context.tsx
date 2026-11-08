import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { getPocketBase, isPocketBaseConfigured, type AuthUser } from './pocketbase';

export interface AuthResult {
  ok: boolean;
  message?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** False while the stored session is being restored. */
  loading: boolean;
  /** False when the build has no PocketBase URL — everything stays local. */
  cloudEnabled: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalises a PocketBase auth record into the app's AuthUser shape. */
function toAuthUser(record: { id: string; email?: string | null }): AuthUser {
  return { id: String(record.id), email: typeof record.email === 'string' ? record.email : null };
}

/** Maps a PocketBase ClientResponseError onto the French UI copy. */
function mapAuthError(error: { message?: string; status?: number; data?: unknown }): string {
  const message = error.message ?? '';
  const fieldData = (error.data ?? {}) as { email?: { message?: string } };
  const emailMessage = fieldData.email?.message ?? '';

  if (error.status === 429 || /rate limit/i.test(message)) {
    return 'Trop de tentatives. Veuillez patienter quelques instants.';
  }
  if (/must be unique|already in use/i.test(emailMessage)) {
    return 'Un compte existe déjà avec cette adresse email.';
  }
  if (/invalid login credentials|failed to authenticate|invalid credentials/i.test(message)) {
    return 'Email ou mot de passe incorrect.';
  }
  if (/not confirmed|not verified|confirm your email/i.test(message + emailMessage)) {
    return 'Veuillez confirmer votre adresse email avant de vous connecter.';
  }
  return message || 'Une erreur est survenue. Veuillez réessayer.';
}

/**
 * Session provider.
 *
 * Without a PocketBase URL the provider still mounts (so every consumer keeps
 * working) but reports `cloudEnabled: false` and a null user; the app then
 * behaves exactly as the local-only prototype did.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const pocketbase = useMemo(() => getPocketBase(), []);
  const cloudEnabled = useMemo(
    () => isPocketBaseConfigured() && pocketbase !== null,
    [pocketbase]
  );

  const [user, setUser] = useState<AuthUser | null>(() => {
    const record = pocketbase?.authStore.record;
    return record ? toAuthUser(record) : null;
  });
  const [loading, setLoading] = useState<boolean>(cloudEnabled);

  useEffect(() => {
    if (!pocketbase) {
      setLoading(false);
      return;
    }

    let active = true;

    // Auth state changes (sign-in/out, token refresh) drive the user state.
    const unsubscribe = pocketbase.authStore.onChange((_token, record) => {
      if (!active) return;
      setUser(record ? toAuthUser(record) : null);
    });

    // A stored token may have expired while the tab was closed: rotate it once
    // (PocketBase equivalent of Supabase's autoRefreshToken). On failure the
    // session is dropped and the app falls back to local-only mode.
    if (pocketbase.authStore.isValid) {
      pocketbase
        .collection('users')
        .authRefresh()
        .catch(error => {
          console.error('Rafraîchissement de la session impossible :', error);
          pocketbase.authStore.clear();
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    } else {
      pocketbase.authStore.clear();
      setLoading(false);
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [pocketbase]);

  const signUp = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!emailPattern.test(email)) {
        return { ok: false, message: "Format d'email invalide." };
      }
      if (password.length < 8) {
        return { ok: false, message: 'Le mot de passe doit contenir au moins 8 caractères.' };
      }
      if (!pocketbase) {
        return {
          ok: false,
          message:
            'Les comptes cloud ne sont pas configurés sur cette installation. Renseignez VITE_POCKETBASE_URL.',
        };
      }

      try {
        await pocketbase.collection('users').create({
          email,
          password,
          passwordConfirm: password,
          emailVisibility: true,
        });
      } catch (error) {
        return { ok: false, message: mapAuthError(error as never) };
      }

      // PocketBase does not sign the user in on create — authenticate right
      // away so the caller gets a usable session (Supabase behaved the same).
      try {
        await pocketbase.collection('users').authWithPassword(email, password);
        return { ok: true };
      } catch {
        return { ok: true, message: 'Compte créé — connectez-vous avec vos identifiants.' };
      }
    },
    [pocketbase]
  );

  const signIn = useCallback(
    async (email: string, password: string): Promise<AuthResult> => {
      if (!emailPattern.test(email)) {
        return { ok: false, message: "Format d'email invalide." };
      }
      if (!pocketbase) {
        return {
          ok: false,
          message:
            'Les comptes cloud ne sont pas configurés sur cette installation. Renseignez VITE_POCKETBASE_URL.',
        };
      }

      try {
        await pocketbase.collection('users').authWithPassword(email, password);
        return { ok: true };
      } catch (error) {
        return { ok: false, message: mapAuthError(error as never) };
      }
    },
    [pocketbase]
  );

  // The AuthContextValue contract requires a promise; clearing the local
  // session is synchronous, so the promise resolves immediately.
  const signOut = useCallback((): Promise<void> => {
    pocketbase?.authStore.clear();
    return Promise.resolve();
  }, [pocketbase]);

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
