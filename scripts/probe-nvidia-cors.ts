/**
 * Diagnostic: checks whether the NVIDIA Integration API answers a CORS
 * pre-flight from a browser origin. Useful when a deployment reports network
 * errors that are cross-origin related.
 *
 * Usage: npx tsx scripts/probe-nvidia-cors.ts
 */

import { NVIDIA_API_URL } from '../src/lib/constants';

async function probe(): Promise<void> {
  const response = await fetch(`${NVIDIA_API_URL}/chat/completions`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://example.com',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });

  console.log('Status:', response.status);
  console.log('Headers:', JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
}

probe().catch((error: unknown) => {
  console.error('Error:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
