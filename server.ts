import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import "dotenv/config";
import OpenAI from "openai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON bodies
  app.use(express.json({ limit: '50mb' }));

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Proxy endpoint for NVIDIA NIM
  app.post(["/api/nvidia/chat/completions", "/api/nvidia//chat/completions"], async (req, res) => {
    try {
      const rawKey = process.env.VITE_NVIDIA_API_KEY || process.env.NVIDIA_API_KEY;
      const apiKey = rawKey ? rawKey.trim().replace(/^["']|["']$/g, '') : null;

      if (!apiKey) {
        return res.status(500).json({ 
          error: "API key is missing on the server.",
          details: "Veuillez configurer VITE_NVIDIA_API_KEY dans les paramètres de l'application."
        });
      }

      // Utilisation du SDK OpenAI côté serveur pour garantir des headers parfaits
      const openai = new OpenAI({
        apiKey: apiKey,
        baseURL: 'https://integrate.api.nvidia.com/v1',
      });

      console.log(`Sending to NVIDIA. Key starts with: ${apiKey.substring(0, 10)}... Model: ${req.body?.model}`);

      // On passe directement le body de la requête au SDK
      const completion = await openai.chat.completions.create(req.body);
      
      res.json(completion);
    } catch (error: any) {
      console.error("NVIDIA Proxy Error:", error.message || error);
      
      // Transfert de l'erreur du SDK vers le client
      const status = error.status || 500;
      let message = error.message || "Internal server error";
      
      if (status === 403) {
        message = "Accès refusé par NVIDIA (403). Votre clé API est invalide, expirée, ou vous n'avez pas accepté les conditions d'utilisation du modèle sur le site de NVIDIA. Vérifiez que votre clé commence bien par 'nvapi-'.";
      } else if (status === 401) {
        message = "Non autorisé (401). Votre clé API NVIDIA est incorrecte.";
      }

      res.status(status).json({ 
        error: message,
        status: status
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
