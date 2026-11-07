import { motion } from 'motion/react';
import { LayoutDashboard } from 'lucide-react';

/** Branded first-paint screen shown while the app hydrates. */
export default function SplashScreen() {
  return (
    <div
      className="flex h-screen w-screen flex-col items-center justify-center bg-emerald-600 text-white"
      role="status"
      aria-live="polite"
      aria-label="Chargement de Dagara Germanist AI"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center"
      >
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-emerald-600 shadow-xl">
          <LayoutDashboard size={40} aria-hidden="true" />
        </div>
        <motion.h1
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mb-2 text-center text-4xl font-bold tracking-tight"
        >
          Dagara Germanist AI
        </motion.h1>
        <motion.p
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center font-medium text-emerald-100"
        >
          for Inspector
        </motion.p>
      </motion.div>
    </div>
  );
}
