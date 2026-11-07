/**
 * Vercel Edge Function — NVIDIA proxy (T3.1/T3.5/T3.6).
 *
 * Mirrors `/api/nvidia/*` of the local dev proxy (see
 * `vite-plugin-nvidia-proxy.ts`) so the same client code works in both
 * environments. Runs on the Edge Runtime: no Node APIs, plain fetch, and the
 * NVIDIA key is injected from the environment — never from the client.
 */

import { NVIDIA_API_URL } from '../../src/lib/constants';

export const config = { runtime: 'edge' };

/** Upstream paths the client may reach. */
const ALLOWED_UPSTREAM_PATHS = ['/chat/completions', '/models'];

/** Token-bucket rate limiter: 30 requests per 60s per client IP. */
const RATE_LIMIT = { maxRequests: 30, windowMs: 60_000 };

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Per-isolate bucket store. Edge functions are stateless across isolates, so
 * this is a best-effort guard against bursts (the durable quota lives in the
 * `generations` table); it is intentionally not a security boundary.
 */
const buckets = new Map<string, Bucket>();

function rateLimit(key: string): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT.windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  bucket.count += 1;
  if (bucket.count > RATE_LIMIT.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

function clientKey(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'anonymous';
}

function jsonResponse(
  body: unknown,
  status: number,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const upstreamPath = url.pathname.replace(/^\/api\/nvidia/, '');

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
      },
    });
  }

  if (!ALLOWED_UPSTREAM_PATHS.includes(upstreamPath)) {
    return jsonResponse({ error: `Chemin proxy inconnu : ${upstreamPath}` }, 404);
  }

  const limit = rateLimit(clientKey(request));
  if (!limit.allowed) {
    return jsonResponse(
      { error: 'Trop de requêtes. Veuillez patienter avant de relancer une génération.' },
      429,
      { 'Retry-After': String(limit.retryAfterSeconds) }
    );
  }

  const apiKey = process.env.NVIDIA_API_KEY ?? process.env.VITE_NVIDIA_API_KEY;
  if (!apiKey) {
    return jsonResponse(
      {
        error: 'API key is missing on the server.',
        details: 'Configurez NVIDIA_API_KEY dans les variables du projet Vercel.',
      },
      500
    );
  }

  const startedAt = Date.now();
  const method = request.method === 'POST' ? 'POST' : 'GET';

  try {
    const upstream = await fetch(`${NVIDIA_API_URL}${upstreamPath}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(method === 'POST' ? { body: await request.text() } : {}),
    });

    const payload = await upstream.text();
    const durationMs = Date.now() - startedAt;

    // Lightweight request log (T3.6): model, latency, status. No key material.
    console.info(
      JSON.stringify({
        event: 'nvidia_proxy',
        path: upstreamPath,
        method,
        status: upstream.status,
        duration_ms: durationMs,
      })
    );

    return new Response(payload, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('Content-Type') ?? 'application/json',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: 'nvidia_proxy_error', path: upstreamPath, message }));
    return jsonResponse({ error: `Service d'IA injoignable : ${message}` }, 502);
  }
}
