import { useState, useRef, useEffect } from 'react';
import type { ProjectData } from '../types';
import { chatWithAssistant } from '../lib/api';
import { MessageCircle, X, Send, Loader2, Bot, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';

interface ChatbotProps {
  project: ProjectData;
}

interface ChatEntry {
  role: 'user' | 'assistant';
  text: string;
}

const GREETING: ChatEntry = {
  role: 'assistant',
  text: "Bonjour ! Je suis Dagara Germanist AI for Inspector. Comment puis-je vous aider avec votre recherche aujourd'hui ?",
};

export default function Chatbot({ project }: ChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatEntry[]>([GREETING]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isOpen]);

  const handleSend = async () => {
    const question = input.trim();
    if (!question || loading) return;

    setMessages(previous => [...previous, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);

    try {
      const responseText = await chatWithAssistant(project, question, messages);
      setMessages(previous => [...previous, { role: 'assistant', text: responseText }]);
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'Une erreur inattendue est survenue.';
      console.error(error);
      setMessages(previous => [
        ...previous,
        { role: 'assistant', text: `Désolé, une erreur est survenue : ${message}` },
      ]);
    }

    setLoading(false);
  };

  return (
    <>
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(true)}
        className={`fixed right-6 bottom-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg transition-transform ${
          isOpen ? 'hidden' : 'flex'
        }`}
        aria-label="Ouvrir l'assistant IA"
      >
        <MessageCircle size={24} aria-hidden="true" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            role="dialog"
            aria-modal="false"
            aria-label="Assistant Dagara Germanist"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex h-full w-full flex-col overflow-hidden border-0 border-slate-200 bg-white shadow-2xl sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[500px] sm:w-96 sm:rounded-2xl sm:border"
          >
            <div className="flex shrink-0 items-center justify-between bg-indigo-600 p-4 text-white">
              <div className="flex items-center gap-2">
                <Bot size={20} aria-hidden="true" />
                <h3 className="text-sm font-semibold">Assistant Dagara Germanist</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-indigo-200 transition-colors hover:text-white"
                aria-label="Fermer l'assistant"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            <div
              className="flex-1 space-y-4 overflow-y-auto bg-slate-50 p-4"
              role="log"
              aria-live="polite"
            >
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                      message.role === 'user'
                        ? 'bg-indigo-100 text-indigo-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}
                  >
                    {message.role === 'user' ? (
                      <User size={16} aria-hidden="true" />
                    ) : (
                      <Bot size={16} aria-hidden="true" />
                    )}
                  </div>
                  <div
                    className={`max-w-[75%] rounded-2xl p-3 text-sm ${
                      message.role === 'user'
                        ? 'rounded-tr-none bg-indigo-600 text-white'
                        : 'rounded-tl-none border border-slate-200 bg-white text-slate-700 shadow-sm'
                    }`}
                  >
                    {message.role === 'user' ? (
                      message.text
                    ) : (
                      <div className="prose prose-sm prose-slate prose-p:leading-relaxed prose-a:text-indigo-600 max-w-none">
                        <ReactMarkdown>{message.text}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Bot size={16} aria-hidden="true" />
                  </div>
                  <div className="flex items-center gap-2 rounded-2xl rounded-tl-none border border-slate-200 bg-white p-3 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-slate-400" aria-hidden="true" />
                    <span className="text-xs text-slate-500">L'IA réfléchit...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-3 pb-6 sm:p-4 sm:pb-4">
              <form
                className="flex items-center gap-2"
                onSubmit={event => {
                  event.preventDefault();
                  void handleSend();
                }}
              >
                <label htmlFor="chatbot-input" className="sr-only">
                  Votre message
                </label>
                <input
                  id="chatbot-input"
                  type="text"
                  value={input}
                  onChange={event => setInput(event.target.value)}
                  placeholder="Posez une question sur votre recherche..."
                  className="flex-1 rounded-xl border-none bg-slate-100 p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:opacity-50"
                  aria-label="Envoyer le message"
                >
                  <Send size={18} aria-hidden="true" />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
