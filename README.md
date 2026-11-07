# Dagara Germanist AI for Inspector

**Assistant IA pour la recherche en didactique de l'allemand au Burkina Faso.**

De la revue de littérature à la bibliographie : cinq phases structurées, la
possibilité d'utiliser ses propres documents, et le choix entre la
configuration par défaut ou **sa propre clé API**.

- Interface **en français** (l'audience est francophone)
- Cible : inspecteurs pédagogiques, enseignants-chercheurs, étudiants en master
  et doctorat
- Déploiement : web (Vercel) + Android via Capacitor

---

## Démarrer

```bash
npm install
cp .env.example .env     # remplir les clés (optionnel en mode par défaut)
npm run dev              # http://localhost:5173
```

### Variables d'environnement

| Variable | Obligatoire | Usage |
|----------|-------------|-------|
| `VITE_NVIDIA_API_KEY` ou `NVIDIA_API_KEY` | oui, pour le mode par défaut | clé utilisée par le proxy interne |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | non | comptes et synchronisation cloud |
| `VITE_SENTRY_DSN` | non | surveillance des erreurs |

> **Votre propre clé API** : aucune variable n'est nécessaire. Elle se saisit
> dans l'application (bouton « Ma clé API » de l'en-tête) et reste dans ce
> navigateur.

---

## Les cinq phases

| Phase | Ce que fait l'IA |
|-------|------------------|
| 0 — Revue | mots-clés → concepts, théories, auteurs, problématique |
| 1 — Cadrage | sujet + cycle + contexte → hypothèses, questions, objectifs |
| 2 — Outils | questionnaires enseignants / élèves / inspecteurs, grille d'analyse de manuel (FR ou DE) |
| 3 — Analyse | import de fichiers et de documents → analyse + graphiques |
| 4 — Export | bibliographie APA et projet complet en Word |

---

## Fonctionnalités transverses

- **Mes documents & notes** (bouton « Documents ») : importez vos rapports,
  transcriptions, photos de manuels ou notes (PDF, Word, TXT, images). L'IA s'en
  sert comme référence dans toutes les phases. Chaque document peut être
  désactivé sans être supprimé.
- **Multi-projets** : création, tri, import/export JSON, suppression confirmée.
- **Compte & cloud** (si Supabase est configuré) : connexion email, migration
  automatique des projets locaux, synchronisation multi-appareils, historique.
- **Mode hors-ligne** : l'interface se charge sans connexion ; la génération IA
  en exige une.
- **Accessibilité** : libellés ARIA, navigation clavier, `prefers-reduced-motion`
  respecté.

---

## Le mode « Ma clé API »

Sept fournisseurs peuvent être utilisés directement depuis le navigateur, avec
sa propre clé :

| Fournisseur | Préfixe de clé | Remarque |
|-------------|----------------|----------|
| OpenRouter | `sk-or-v1-` | catalogue le plus large, capacités publiées par l'API |
| NVIDIA NIM | `nvapi-` | mode par défaut de l'application |
| OpenAI | `sk-` | |
| Anthropic | `sk-ant-` | adaptateur dédié |
| Groq | `gsk_` | |
| Mistral | — | |

**Seuls les modèles multimodaux sont proposés** : les phases 2 et 3 envoient des
images et des documents, un modèle « texte seul » échouerait. La liste est
filtrée sur l'entrée `texte + image`, les modèles avec *tool calling* d'abord.
Quand le fournisseur ne publie pas les capacités, l'interface l'indique.

La clé est stockée dans ce navigateur et envoyée **directement au fournisseur**,
jamais à nos serveurs. Sans clé, l'application utilise son proxy interne et son
modèle par défaut.

---

## Commandes

| Commande | Effet |
|----------|-------|
| `npm run dev` | serveur de développement |
| `npm run build` | build de production → `dist/` |
| `npm run preview` | sert le build de production |
| `npm run typecheck` | `tsc --noEmit` (mode strict) |
| `npm run lint` | typecheck + ESLint (0 avertissement toléré) |
| `npm run format` / `format:check` | Prettier |
| `npm run test` | 163 tests Vitest |
| `npm run test:coverage` | tests + couverture (seuil 70 %) |
| `npm run serve:landing` | page marketing → `localhost:3001` |
| `npm run build:landing` | recompile le CSS de la page marketing |
| `npm run build:apk` | build web → sync Capacitor → APK Android |

---

## Documentation

| Fichier | Contenu |
|---------|---------|
| `PROGRESS.md` | suivi d'exécution, phase par phase |
| `TECHNICAL_REFERENCE.md` | architecture, modèle de données, conventions |
| `FINAL_ENGINEERING_REPORT.md` | rapport d'ingénierie et écarts connus |
| `README-APK.md` | génération de l'APK |
| `TO_READ/` | spécifications et plan d'implémentation d'origine |
| `RECHERCHE/QUESTIONNAIRE_INSPECTEURS.md` | questionnaire de terrain |

---

## Build Android

Voir `README-APK.md`. En résumé : `npm run build:apk`.

> ⚠️ **Prérequis connus** : le `gradle-wrapper.jar` versionné est tronqué
> (toutes ses entrées deflate s'arrêtent tôt) et le SDK Android n'est pas
> configuré sur ce poste — voir `FINAL_ENGINEERING_REPORT.md` §4, point 9.
