import OpenAI from 'openai';
import { ProjectData } from '../types';
// @ts-ignore
import * as mammoth from 'mammoth';

// ============================================================================
// 1. AI PROVIDER CONFIGURATION & ABSTRACTION LAYER
// ============================================================================
// Configured to use NVIDIA NIM (Kimi k2.5) via OpenAI SDK
// ============================================================================

let openaiClient: OpenAI | null = null;

const getOpenAI = () => {
  if (!openaiClient) {
    // Utilisation du proxy serveur pour éviter les problèmes de CORS et sécuriser la clé
    let baseURL = '/api/nvidia';
    if (typeof window !== 'undefined') {
      const origin = window.location.origin && window.location.origin !== 'null'
        ? window.location.origin
        : `${window.location.protocol}//${window.location.host}`;
      
      if (origin && origin.startsWith('http')) {
        baseURL = `${origin}/api/nvidia`;
      } else {
        baseURL = `${window.location.protocol}//${window.location.host || 'localhost:3000'}/api/nvidia`;
      }
    }

    openaiClient = new OpenAI({
      apiKey: 'not-needed-for-proxy', 
      baseURL: baseURL,
      dangerouslyAllowBrowser: true
    });
  }
  return openaiClient;
};

const getModel = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('dagara-ai-model') || 'meta/llama-3.1-70b-instruct';
  }
  return 'meta/llama-3.1-70b-instruct';
};

// Local definition to avoid depending on Google's Type enum in the business logic
export const SchemaType = {
  OBJECT: "OBJECT",
  STRING: "STRING",
  ARRAY: "ARRAY",
  NUMBER: "NUMBER",
  BOOLEAN: "BOOLEAN",
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withRetry = async <T>(apiCall: () => Promise<T>, maxRetries = 3): Promise<T> => {
  let retries = 0;
  while (true) {
    try {
      return await apiCall();
    } catch (error: any) {
      console.error("API Error details:", error);
      
      if (error.name === 'APIConnectionError' || error.message === 'Connection error.') {
        throw new Error("Impossible de contacter les serveurs d'IA. Vérifiez votre connexion internet (Wi-Fi/4G).");
      }

      if (error?.status === 401) {
        throw new Error("Erreur d'authentification (401). La clé API fournie est invalide ou a expiré.");
      }

      if (error?.status === 403) {
        throw new Error("Accès refusé (403). Cela signifie généralement que votre clé API NVIDIA est invalide, expirée, ou n'a pas les droits pour le modèle sélectionné. Assurez-vous d'utiliser une clé commençant par 'nvapi-' et configurée comme VITE_NVIDIA_API_KEY dans les paramètres.");
      }

      if (error?.status === 404) {
        throw new Error("Modèle ou ressource introuvable (404). Le modèle sélectionné n'est peut-être plus disponible.");
      }

      if (error?.status === 500) {
        if (error?.message?.includes("API key is missing")) {
          throw new Error("La clé API NVIDIA est manquante dans l'application. Veuillez configurer la variable d'environnement VITE_NVIDIA_API_KEY.");
        }
        throw new Error("Erreur interne du serveur (500). Le service d'IA rencontre actuellement des difficultés.");
      }

      if (error?.status === 502 || error?.status === 503 || error?.status === 504) {
        throw new Error(`Le service d'IA est temporairement indisponible (${error.status}). Veuillez réessayer plus tard.`);
      }

      const isRateLimit = 
        error?.status === 429 || 
        error?.status === 'RESOURCE_EXHAUSTED' || 
        error?.message?.includes('429') || 
        error?.message?.includes('quota');
        
      if (isRateLimit) {
        if (retries >= maxRetries) {
          throw new Error("Le quota d'utilisation de l'IA a été dépassé. Veuillez réessayer dans quelques instants.");
        }
        retries++;
        const waitTime = Math.pow(2, retries) * 1000 + Math.random() * 1000;
        console.warn(`Rate limit hit. Retrying in ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
      } else {
        throw new Error(error?.message || "Une erreur inattendue s'est produite lors de la communication avec l'IA.");
      }
    }
  }
};

// --- WRAPPER 1: Text Generation ---
export const generateText = async (contents: any, systemInstruction?: string): Promise<string> => {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  
  let userContent = contents;
  if (Array.isArray(contents?.parts)) {
    userContent = contents.parts.map((p: any) => p.text ? { type: "text", text: p.text } : p).filter(Boolean);
  } else if (Array.isArray(contents)) {
    userContent = contents.map((p: any) => p.text ? { type: "text", text: p.text } : p).filter(Boolean);
  }

  messages.push({ role: "user", content: userContent });

  const response = await withRetry(() => getOpenAI().chat.completions.create({
    model: getModel(),
    messages: messages,
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 4096
  }));
  
  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("L'IA n'a pas renvoyé de réponse. Veuillez réessayer.");
  }
  return text;
};

// --- WRAPPER 2: JSON Generation ---
export const generateJSON = async (contents: any, schema: any, systemInstruction?: string): Promise<any> => {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  
  let userContent = contents;
  if (typeof contents === 'string') {
    userContent = contents;
  } else if (Array.isArray(contents?.parts)) {
    userContent = contents.parts.map((p: any) => p.text ? { type: "text", text: p.text } : p).filter(Boolean);
  } else if (Array.isArray(contents)) {
    userContent = contents.map((p: any) => p.text ? { type: "text", text: p.text } : p).filter(Boolean);
  }

  messages.push({ role: "user", content: userContent });
  
  // Force the model to respect the JSON schema
  const schemaInstruction = `\n\nTu DOIS retourner UNIQUEMENT un objet JSON valide. Ne commence pas ta réponse par du texte de présentation, renvoie directement le JSON. 
  IMPORTANT : Assure-toi d'échapper correctement les guillemets doubles à l'intérieur des chaînes de caractères (ex: "Le \\"titre\\" de l'ouvrage").
  La structure doit correspondre à ce schéma : ${JSON.stringify(schema)}.`;
  
  if (typeof messages[messages.length - 1].content === 'string') {
    messages[messages.length - 1].content += schemaInstruction;
  } else if (Array.isArray(messages[messages.length - 1].content)) {
    messages[messages.length - 1].content.push({ type: "text", text: schemaInstruction });
  }

  const response = await withRetry(() => getOpenAI().chat.completions.create({
    model: getModel(),
    messages: messages,
    response_format: { type: "json_object" },
    temperature: 0.2, // Lower temperature for more consistent JSON
    top_p: 0.95,
    max_tokens: 4096
  }));
  
  let text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("L'IA n'a pas renvoyé de réponse. Veuillez réessayer.");
  }
  const originalText = text;
  
  // Try to extract JSON from markdown code blocks if present
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    text = jsonBlockMatch[1];
  } else {
    const anyBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
    if (anyBlockMatch) {
      text = anyBlockMatch[1];
    } else {
      // Fallback: try to find the first '{' or '[' and the last '}' or ']'
      const firstBrace = text.indexOf('{');
      const firstBracket = text.indexOf('[');
      let firstChar = -1;
      
      if (firstBrace !== -1 && firstBracket !== -1) {
        firstChar = Math.min(firstBrace, firstBracket);
      } else {
        firstChar = Math.max(firstBrace, firstBracket);
      }
      
      if (firstChar !== -1) {
        const isObject = text[firstChar] === '{';
        const lastChar = isObject ? text.lastIndexOf('}') : text.lastIndexOf(']');
        
        if (lastChar !== -1 && lastChar > firstChar) {
          text = text.substring(firstChar, lastChar + 1);
        }
      }
    }
  }
  
  const tryParse = (jsonStr: string) => {
    try {
      return JSON.parse(jsonStr);
    } catch (e) {
      // Attempt to fix common JSON errors like unescaped quotes in strings
      // This is a very basic attempt: find "key": "value" and try to escape internal quotes in "value"
      try {
        // This regex tries to find string values and escape internal double quotes
        // It's risky but can save some responses
        const fixedJson = jsonStr.replace(/":\s*"(.*?)"(\s*[,}\]])/g, (match, p1, p2) => {
          const escaped = p1.replace(/(?<!\\)"/g, '\\"');
          return `": "${escaped}"${p2}`;
        });
        return JSON.parse(fixedJson);
      } catch (e2) {
        throw e; // Throw original error if fix fails
      }
    }
  };

  try {
    let parsed = tryParse(text);
    
    // Normalize the output if the model wrapped it in a "properties" object
    // (which happens sometimes when passing JSON Schema)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      if (parsed.properties && !schema.properties?.properties) {
        parsed = parsed.properties;
      }
    }
    
    return parsed;
  } catch (e) {
    // If parsing fails, try one more time with a more aggressive extraction on the original text
    // This handles cases where the LLM outputs multiple JSON blocks or malformed text
    try {
      const firstBrace = originalText.indexOf('{');
      const firstBracket = originalText.indexOf('[');
      const firstChar = (firstBrace !== -1 && firstBracket !== -1) ? Math.min(firstBrace, firstBracket) : Math.max(firstBrace, firstBracket);
      
      if (firstChar !== -1) {
        const isObject = originalText[firstChar] === '{';
        const lastChar = isObject ? originalText.lastIndexOf('}') : originalText.lastIndexOf(']');
        
        if (lastChar !== -1 && lastChar > firstChar) {
          let parsed = tryParse(originalText.substring(firstChar, lastChar + 1));
          
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            if (parsed.properties && !schema.properties?.properties) {
              parsed = parsed.properties;
            }
          }
          
          return parsed;
        }
      }
    } catch (e2) {
      // Ignore second error and throw the original one
    }
    
    console.error("Failed to parse JSON:", originalText);
    throw new Error("L'IA n'a pas renvoyé un format de données valide. Veuillez réessayer.");
  }
};

// --- WRAPPER 3: Chat ---
export const chatWithAI = async (message: string, history: {role: string, text: string}[], systemInstruction: string): Promise<string> => {
  const messages: any[] = [];
  if (systemInstruction) messages.push({ role: "system", content: systemInstruction });
  
  history.forEach(h => {
    messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
  });
  messages.push({ role: "user", content: message });

  const response = await withRetry(() => getOpenAI().chat.completions.create({
    model: getModel(),
    messages: messages,
    temperature: 0.6,
    top_p: 0.95,
    max_tokens: 4096
  }));
  
  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error("L'IA n'a pas renvoyé de réponse. Veuillez réessayer.");
  }
  return text;
};

// --- WRAPPER 4: File Formatting ---
export const formatFileForAI = async (file: File): Promise<any> => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.readAsDataURL(file);
  });
  
  const base64 = await base64EncodedDataPromise;
  return { type: "image_url", image_url: { url: `data:${file.type};base64,${base64}` } };
};


// ============================================================================
// 2. BUSINESS LOGIC (App Features)
// These functions use the wrappers above. You won't need to change them 
// when switching AI providers!
// ============================================================================

export const generateCadrage = async (subject: string, cycle: string, context: string) => {
  const prompt = `Tu es Dagara Germanist AI for Inspector, expert en didactique de l'allemand au Burkina Faso.
  Génère l'architecture de recherche pour ce sujet :
  Sujet : ${subject}
  Cycle : ${cycle}
  Contexte : ${context}
  
  Directives :
  - Les hypothèses doivent être solides et liées au contexte burkinabè (APC, effectifs, etc.).
  - Les questions doivent problématiser le sujet.
  - Les objectifs doivent comporter un objectif général et des objectifs spécifiques.
  - Génère les données réelles basées sur le sujet, ne renvoie pas le schéma JSON lui-même.`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      hypotheses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      questions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      objectives: {
        type: SchemaType.OBJECT,
        properties: {
          general: { type: SchemaType.STRING },
          specific: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        }
      }
    }
  };

  return await generateJSON(prompt, schema);
};

export const generateTool = async (project: ProjectData, toolType: string, manualName?: string, style?: string, customInstructions?: string) => {
  const langInstruction = project.language === 'de' 
    ? "IMPORTANT: Tu DOIS générer l'outil ENTIÈREMENT EN ALLEMAND (questions, options de réponse, consignes)."
    : "Génère l'outil en français.";

  const prompt = `Tu es Dagara Germanist AI for Inspector. Conçois un outil de collecte de données pour une recherche en didactique de l'allemand au Burkina Faso.
  
  Sujet de la recherche : ${project.subject}
  Hypothèses : ${project.hypotheses.join(', ')}
  Questions de recherche : ${project.questions.join(', ')}
  
  Outil à concevoir : ${toolType}
  ${manualName ? `Manuel concerné : ${manualName}` : ''}
  
  Style d'élaboration (biais psychologique / approche) : ${style || 'Standard / Neutre'}
  Directives personnalisées de l'utilisateur : ${customInstructions || 'Aucune'}
  
  Directives :
  - Format professionnel, prêt à être copié dans Google Forms ou imprimé.
  - Utilise le format Markdown (titres, listes, tableaux si pertinent).
  - Adapte les questions au public cible (${toolType}) en tenant compte du style d'élaboration demandé.
  - Si des directives personnalisées sont fournies, respecte-les scrupuleusement.
  - ${langInstruction}`;

  return await generateText(prompt);
};

export const refineArchitecturePart = async (project: ProjectData, part: 'hypotheses' | 'questions' | 'objectives', instructions: string) => {
  const prompt = `Tu es Dagara Germanist AI for Inspector. Voici l'architecture de recherche actuelle :
  Sujet : ${project.subject}
  Hypothèses actuelles : ${project.hypotheses.join(', ')}
  Questions actuelles : ${project.questions.join(', ')}
  Objectifs actuels : Général: ${project.objectives.general}, Spécifiques: ${project.objectives.specific.join(', ')}

  L'utilisateur veut réviser UNIQUEMENT la partie : ${part}.
  Voici ses instructions de recadrage : "${instructions}"

  Génère une nouvelle version améliorée pour cette partie uniquement, en gardant la cohérence avec le reste du projet.`;

  let schema;
  if (part === 'hypotheses' || part === 'questions') {
    schema = { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } };
  } else {
    schema = {
      type: SchemaType.OBJECT,
      properties: {
        general: { type: SchemaType.STRING },
        specific: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
      }
    };
  }

  return await generateJSON(prompt, schema);
};

export const extractTextFromFile = async (file: File) => {
  if (file.name.toLowerCase().endsWith('.docx')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("Erreur lors de l'extraction du fichier Word :", error);
      throw new Error("Impossible de lire le fichier Word. Assurez-vous qu'il n'est pas corrompu.");
    }
  } else if (file.name.toLowerCase().endsWith('.doc')) {
    throw new Error("Le format .doc n'est pas supporté. Veuillez enregistrer votre fichier au format .docx ou .pdf.");
  }

  const filePart = await formatFileForAI(file);
  const prompt = `Extrait tout le texte de ce document de manière fidèle, en conservant la structure (titres, listes, tableaux en Markdown). Ne rajoute aucun commentaire, renvoie uniquement le contenu du document.`;
  
  return await generateText({ parts: [filePart, { text: prompt }] });
};

export interface ChartRequest {
  id: string;
  type: 'bar' | 'pie';
  description: string;
}

export const analyzeData = async (project: ProjectData, files: File[], analysisType: string, instructions: string, chartRequests: ChartRequest[] = [], referenceTool?: string) => {
  const parts: any[] = [];
  
  for (const file of files) {
    if (file.name.toLowerCase().endsWith('.docx')) {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        parts.push({ text: `--- Contenu du document Word : ${file.name} ---\n${result.value}\n--- Fin du document ---` });
      } catch (error) {
        console.error("Erreur lors de l'extraction du fichier Word :", error);
        throw new Error(`Impossible de lire le fichier Word : ${file.name}`);
      }
    } else if (file.name.toLowerCase().endsWith('.doc')) {
      throw new Error(`Le format .doc n'est pas supporté pour le fichier "${file.name}". Veuillez l'enregistrer au format .docx ou .pdf avant de l'importer.`);
    } else {
      parts.push(await formatFileForAI(file));
    }
  }
  
  const chartInstructions = chartRequests && chartRequests.length > 0 
    ? `L'utilisateur a explicitement demandé de générer les graphiques suivants à partir des données fournies. Tu DOIS extraire les données correspondantes et les inclure dans le tableau 'charts' du JSON :\n${chartRequests.map(c => `- Un graphique de type '${c.type}' (barres ou secteurs) représentant : "${c.description}"`).join('\n')}\nSi les données exactes ne sont pas présentes, fais une estimation raisonnable basée sur le contexte ou renvoie un tableau vide pour ce graphique spécifique.`
    : `Extrait des données quantitatives si possible pour générer des graphiques pertinents (optionnel).`;

  const referenceInstruction = referenceTool 
    ? `\nIMPORTANT - GRILLE D'ANALYSE À UTILISER :\nL'utilisateur a fourni une grille ou un outil spécifique pour structurer cette analyse. Tu DOIS utiliser cette grille comme cadre d'analyse principal pour évaluer les documents :\n"""\n${referenceTool}\n"""\n` 
    : '';

  parts.push({
    text: `Tu es Dagara Germanist AI for Inspector. Effectue une analyse de ces données.
    Type d'analyse : ${analysisType}
    Instructions spécifiques : ${instructions}
    ${referenceInstruction}
    
    Contexte de la recherche :
    Sujet : ${project.subject}
    Hypothèses : ${project.hypotheses.join(', ')}
    
    Directives :
    - Utilise un langage rigoureux (échantillonnage, récurrence thématique, triangulation).
    - ${chartInstructions}
    - Retourne un objet JSON strict avec deux propriétés :
      1. "content" : Le texte de ton analyse en Markdown.
      2. "charts" : Un tableau de graphiques extraits des données.`
  });

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      content: { type: SchemaType.STRING, description: "L'analyse détaillée en Markdown" },
      charts: {
        type: SchemaType.ARRAY,
        items: {
          type: SchemaType.OBJECT,
          properties: {
            title: { type: SchemaType.STRING, description: "Titre du graphique" },
            type: { type: SchemaType.STRING, description: "Type de graphique: 'bar' ou 'pie'" },
            data: {
              type: SchemaType.ARRAY,
              items: {
                type: SchemaType.OBJECT,
                properties: {
                  name: { type: SchemaType.STRING, description: "Nom de la catégorie" },
                  value: { type: SchemaType.NUMBER, description: "Valeur numérique" }
                }
              }
            }
          }
        }
      }
    }
  };

  return await generateJSON({ parts }, schema);
};

export const improveTool = async (project: ProjectData, toolType: string, currentContent: string, instructions: string) => {
  const langInstruction = project.language === 'de' 
    ? "IMPORTANT: Tu DOIS générer l'outil ENTIÈREMENT EN ALLEMAND (questions, options de réponse, consignes)."
    : "Génère l'outil en français.";

  const prompt = `Tu es Dagara Germanist AI for Inspector. L'utilisateur souhaite améliorer ou modifier un outil de collecte de données existant.
  
  Sujet de la recherche : ${project.subject}
  Type d'outil : ${toolType}
  
  Contenu actuel de l'outil :
  """
  ${currentContent}
  """
  
  Instructions de modification : ${instructions}
  
  Directives :
  - Applique les modifications demandées.
  - Garde un format professionnel en Markdown.
  - ${langInstruction}`;

  return await generateText(prompt);
};

export const generateLiteratureReview = async (keywords: string, context: string) => {
  const prompt = `Tu es Dagara Germanist AI for Inspector, expert en didactique de l'allemand au Burkina Faso.
  L'utilisateur prépare une recherche et a fourni ces mots-clés : ${keywords}
  Contexte : ${context}
  
  Génère une proposition de revue de littérature comprenant :
  - Les concepts clés à définir.
  - Les théories didactiques pertinentes (ex: approche actionnelle, etc.).
  - Les auteurs de référence (généraux et spécifiques au contexte africain/burkinabè si possible).
  - Un bref résumé de la problématique potentielle.
  
  IMPORTANT : Assure-toi que tout le texte est compatible avec un format JSON (échappe les guillemets doubles si nécessaire).`;

  const schema = {
    type: SchemaType.OBJECT,
    properties: {
      keywords: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      theories: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      authors: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
      summary: { type: SchemaType.STRING }
    }
  };

  return await generateJSON(prompt, schema);
};

export const generateBibliography = async (project: ProjectData) => {
  const prompt = `Tu es Dagara Germanist AI for Inspector. Génère une bibliographie au format APA pour ce projet de recherche en didactique de l'allemand.
  Sujet : ${project.subject}
  Théories/Auteurs identifiés : ${project.literatureReview?.authors?.join(', ') || 'Non spécifié'}
  
  Fournis une liste de 5 à 10 références bibliographiques (livres, articles scientifiques) pertinentes pour ce sujet, formatées strictement selon la norme APA.
  IMPORTANT : Si le titre contient des guillemets, utilise des guillemets simples (') ou assure-toi qu'ils sont correctement échappés dans le JSON final.`;

  const schema = {
    type: SchemaType.ARRAY,
    items: {
      type: SchemaType.OBJECT,
      properties: {
        id: { type: SchemaType.STRING },
        citation: { type: SchemaType.STRING, description: "La référence complète au format APA" }
      }
    }
  };

  return await generateJSON(prompt, schema);
};

export const chatWithAssistant = async (project: ProjectData, message: string, history: {role: string, text: string}[]) => {
  const systemInstruction = `Tu es Dagara Germanist AI for Inspector, un assistant virtuel spécialisé en didactique de l'allemand au Burkina Faso.
  Tu aides un chercheur/étudiant avec son projet.
  Contexte actuel du projet :
  Sujet : ${project.subject || 'Non défini'}
  Hypothèses : ${project.hypotheses?.join(', ') || 'Non définies'}
  
  Réponds de manière concise, académique et encourageante.`;

  return await chatWithAI(message, history, systemInstruction);
};
