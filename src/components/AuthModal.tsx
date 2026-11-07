import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Loader2, LogIn, LogOut, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth-context';

/**
 * Account panel: sign in / sign up / sign out.
 *
 * When Supabase is not configured the form explains why cloud accounts are
 * unavailable instead of failing silently.
 */
export default function AuthModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, cloudEnabled, signIn, signUp, signOut } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const result =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password);

    setBusy(false);

    if (!result.ok) {
      setError(result.message ?? 'Une erreur est survenue.');
      return;
    }

    if (mode === 'signup') {
      setError(null);
      setMode('signin');
      return;
    }

    setEmail('');
    setPassword('');
    onClose();
  };

  const handleSignOut = async () => {
    setBusy(true);
    await signOut();
    setBusy(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-title"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 id="auth-title" className="mb-1 text-xl font-semibold text-slate-800">
              {user ? 'Mon compte' : mode === 'signin' ? 'Connexion' : 'Créer un compte'}
            </h2>
            <p className="mb-6 text-sm text-slate-500">
              {user
                ? `Connecté en tant que ${user.email ?? 'utilisateur'}`
                : 'Synchronisez vos projets entre vos appareils.'}
            </p>

            {!cloudEnabled && !user && (
              <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                Le mode cloud n'est pas configuré sur cette installation. Vos projets restent
                enregistrés localement sur cet appareil.
              </p>
            )}

            {user ? (
              <button
                onClick={() => void handleSignOut()}
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 font-medium text-white transition-colors hover:bg-slate-900 disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <LogOut size={16} aria-hidden="true" />
                )}
                Se déconnecter
              </button>
            ) : (
              <form onSubmit={event => void handleSubmit(event)} className="space-y-4">
                <div>
                  <label
                    htmlFor="auth-email"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Adresse email
                  </label>
                  <input
                    id="auth-email"
                    type="email"
                    required
                    value={email}
                    onChange={event => setEmail(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="prenom.nom@exemple.bf"
                  />
                </div>
                <div>
                  <label
                    htmlFor="auth-password"
                    className="mb-1 block text-sm font-medium text-slate-700"
                  >
                    Mot de passe
                  </label>
                  <input
                    id="auth-password"
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={event => setPassword(event.target.value)}
                    className="w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="8 caractères minimum"
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? (
                    <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                  ) : mode === 'signin' ? (
                    <LogIn size={16} aria-hidden="true" />
                  ) : (
                    <UserPlus size={16} aria-hidden="true" />
                  )}
                  {mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'signin' ? 'signup' : 'signin');
                    setError(null);
                  }}
                  className="w-full text-sm text-slate-500 transition-colors hover:text-emerald-600"
                >
                  {mode === 'signin'
                    ? 'Pas encore de compte ? Créer un compte'
                    : 'Déjà un compte ? Se connecter'}
                </button>
              </form>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Fermer
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
