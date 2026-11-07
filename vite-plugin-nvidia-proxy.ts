/**
 * Dev-server proxy for the NVIDIA Integration API.
 *
 * Runs inside the Vite dev server, so `npm run dev` no longer needs the
 * standalone Express process: the key stays server-side, the browser only ever
 * talks to `/api/nvidia/...`. In production (Vercel) the equivalent handler is
 * `api/nvidia/[...path].ts`.
 */

import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { NVIDIA_API_URL } from './src/lib/constants';

/** Route prefix served by this plugin (mirrors the Vercel edge function). */
const PROXY_PREFIX = '/api/nvidia';

/** Upstream paths the client is allowed to reach. */
const ALLOWED_UPSTREAM_PATHS = ['/chat/completions', '/models'];

type Middleware = (request: IncomingMessage, response: ServerResponse, next: () => void) => void;

function readApiKey(): string | null {
  const rawKey = process.env.VITE_NVIDIA_API_KEY ?? process.env.NVIDIA_API_KEY;
  const apiKey = rawKey?.trim().replace(/^["']|["']$/g, '');
  return apiKey && apiKey.length > 0 ? apiKey : null;
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise(resolve => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => chunks.push(chunk));
    request.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  });
}

/** Handles one `/api/nvidia/*` request, mirroring the edge function behaviour. */
async function handleProxyRequest(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const requestUrl = new URL(request.url ?? '/', 'http://localhost');
  const upstreamPath = requestUrl.pathname.replace(PROXY_PREFIX, '');
  const method = request.method ?? 'GET';

  const sendJson = (status: number, payload: unknown): void => {
    response.statusCode = status;
    response.setHeader('Content-Type', 'application/json');
    response.end(JSON.stringify(payload));
  };

  if (method === 'OPTIONS') {
    response.statusCode = 204;
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    response.end();
    return;
  }

  if (!ALLOWED_UPSTREAM_PATHS.includes(upstreamPath)) {
    sendJson(404, { error: `Chemin proxy inconnu : ${upstreamPath}` });
    return;
  }

  const apiKey = readApiKey();
  if (!apiKey) {
    sendJson(500, {
      error: 'API key is missing on the server.',
      details:
        'Définissez VITE_NVIDIA_API_KEY dans votre fichier .env puis redémarrez le serveur de développement.',
    });
    return;
  }

  const startedAt = Date.now();

  try {
    const upstream = await fetch(`${NVIDIA_API_URL}${upstreamPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(method === 'POST' ? { body: await readBody(request) } : {}),
    });

    const payload = await upstream.text();

    console.info(
      `[nvidia-proxy] ${method} ${upstreamPath} → ${upstream.status} (${Date.now() - startedAt}ms)`
    );

    response.statusCode = upstream.status;
    response.setHeader('Content-Type', upstream.headers.get('Content-Type') ?? 'application/json');
    response.end(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[nvidia-proxy] ${upstreamPath} a échoué :`, message);
    sendJson(502, { error: `Service d'IA injoignable : ${message}` });
  }
}

export function nvidiaProxyPlugin(): Plugin {
  return {
    name: 'dagara-nvidia-proxy',
    configureServer(server) {
      const middleware: Middleware = (request, response, next) => {
        if (!request.url?.startsWith(PROXY_PREFIX)) {
          next();
          return;
        }
        // connect() expects a void return; the handler owns the response.
        void handleProxyRequest(request, response).catch(error => {
          console.error('[nvidia-proxy] erreur interne :', error);
          if (!response.headersSent) {
            response.statusCode = 500;
            response.setHeader('Content-Type', 'application/json');
          }
          response.end(JSON.stringify({ error: 'Erreur interne du proxy.' }));
        });
      };

      server.middlewares.use(middleware);
    },
  };
}
