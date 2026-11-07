/**
 * Diagnostic: lists the model IDs offered by the NVIDIA Integration API,
 * optionally filtered by a substring.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/list-models.ts        # all models
 *   npx tsx --env-file=.env scripts/list-models.ts llama  # models containing "llama"
 */

import { NVIDIA_API_URL } from '../src/lib/constants';

interface NvidiaModel {
  id: string;
}

interface NvidiaModelsResponse {
  data?: NvidiaModel[];
}

async function main(): Promise<void> {
  const apiKey = process.env.VITE_NVIDIA_API_KEY ?? process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    console.error('Aucune clé API trouvée : définissez VITE_NVIDIA_API_KEY.');
    process.exitCode = 1;
    return;
  }

  const filter = process.argv[2]?.toLowerCase();

  const response = await fetch(`${NVIDIA_API_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey.trim()}` },
  });

  const payload = (await response.json()) as NvidiaModelsResponse;
  const models = payload.data ?? [];

  if (models.length === 0) {
    console.log("Aucun modèle renvoyé par l'API.");
    return;
  }

  const ids = models
    .map(model => model.id)
    .filter(id => (filter ? id.toLowerCase().includes(filter) : true));

  console.log(ids.join('\n'));
}

main().catch((error: unknown) => {
  console.error('Erreur:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
