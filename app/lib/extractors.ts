/**
 * Utilitários e extratores dedicados para processamento de conteúdo multimodal de Reels
 */

export interface RecipeData {
  isRecipe: boolean;
  ingredients: string[];
  preparation: string[];
}

export interface PlaceData {
  isPlace: boolean;
  address: string | null;
  city: string | null;
  highlights: string[];
}

export interface TutorialData {
  isTutorial: boolean;
  steps: string[];
}

export interface EnrichedSummaryResult {
  summary: string;
  recipe: RecipeData | null;
  place: PlaceData | null;
  tutorial: TutorialData | null;
  copyableText: string;
}

/**
 * 1. Limpa a legenda original removendo linhas que indicam localização ou música postadas.
 */
export function cleanCaption(raw: string | null | undefined): string {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    return "Nenhuma legenda informada para este vídeo.";
  }

  const lines = raw.split(/\r?\n/);
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true; // preserva quebras de linha existentes

    // Filtra indicadores de música / áudio
    if (/^(?:🎵|🎶|🎧)\s*/i.test(trimmed)) return false;
    if (
      /^(?:m[úu]sica|som original|original sound|track|soundtrack|song|faixa|trilha sonora)\s*[:\-–—]/i.test(
        trimmed
      )
    ) {
      return false;
    }
    if (/(?:🎵|🎶)\s*(?:m[úu]sica|som original|audio|faixa)/i.test(trimmed)) {
      return false;
    }

    // Filtra indicadores de localização
    if (/^(?:📍|📌|🗺️)\s*/i.test(trimmed)) return false;
    if (
      /^(?:local(?:iza[çc][ãa]o)?|location|onde fica|ponto de refer[êe]ncia)\s*[:\-–—]/i.test(
        trimmed
      )
    ) {
      return false;
    }

    return true;
  });

  const result = filtered.join("\n").trim();
  return result || "Nenhuma legenda informada para este vídeo.";
}

/**
 * Extrator 1: Isola ingredientes e modo de preparo em fichas de receita.
 */
export function extractRecipe(text: string): RecipeData {
  if (!text || typeof text !== "string") {
    return { isRecipe: false, ingredients: [], preparation: [] };
  }

  const lower = text.toLowerCase();
  const recipeKeywords = [
    "ingrediente",
    "modo de preparo",
    "como fazer",
    "receita",
    "xícara",
    "colher",
    "pitada",
    "refogue",
    "forno a",
    "fogo médio",
    "liquidificador",
    "farinha",
    "açúcar",
    "chocolate",
    "frigideira",
    "rendimento",
  ];

  const keywordHits = recipeKeywords.filter((kw) => lower.includes(kw));
  if (keywordHits.length < 2) {
    return { isRecipe: false, ingredients: [], preparation: [] };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ingredients: string[] = [];
  const preparation: string[] = [];

  let section: "none" | "ingredients" | "prep" = "none";

  const measurePattern =
    /\b(?:\d+[\/\.,]?\d*|\d+)\s*(?:g|kg|ml|l|x[íi]cara[s]?|colher(?:es)?(?:\s+de\s+(?:sopa|ch[áa]|caf[ée]|sobremesa))?|pitada[s]?|fatia[s]?|unidade[s]?|dente[s]?|lata[s]?|caixa[s]?|pacote[s]?|copo[s]?|grama[s]?|litro[s]?)\b/i;

  for (const line of lines) {
    const lLower = line.toLowerCase();

    if (/^[\#\*\-—–\s]*(?:ingredientes|recheio|massa|calda|cobertura)\b/i.test(lLower)) {
      section = "ingredients";
      continue;
    }

    if (
      /^[\#\*\-—–\s]*(?:modo de preparo|como fazer|preparo|instru[çc][õo]es|passo a passo|modo de fazer)\b/i.test(
        lLower
      )
    ) {
      section = "prep";
      continue;
    }

    // Se estiver explicitamente na seção de ingredientes
    if (section === "ingredients") {
      if (line.length > 2 && !/^(?:modo de preparo|preparo)/i.test(line)) {
        ingredients.push(line.replace(/^[\-•*]\s*/, ""));
        continue;
      }
    }

    // Se estiver explicitamente na seção de preparo
    if (section === "prep") {
      if (line.length > 3) {
        preparation.push(line.replace(/^[\-•*\d+\.]\s*/, ""));
        continue;
      }
    }

    // Heurística de linha com medidas de culinária
    if (measurePattern.test(line) && line.length < 120 && ingredients.length < 25) {
      ingredients.push(line.replace(/^[\-•*]\s*/, ""));
    }
  }

  const isRecipe = ingredients.length >= 2 || (ingredients.length >= 1 && preparation.length >= 1);
  return {
    isRecipe,
    ingredients,
    preparation,
  };
}

/**
 * Extrator 2: Isola endereço e cidade em fichas de lugares / viagens / gastronomia.
 */
export function extractPlace(text: string): PlaceData {
  if (!text || typeof text !== "string") {
    return { isPlace: false, address: null, city: null, highlights: [] };
  }

  const lower = text.toLowerCase();
  const placeKeywords = [
    "endereço",
    "endereco",
    "onde fica",
    "localizado",
    "localização",
    "fica em",
    "fica na",
    "fica no",
    "rua ",
    "r. ",
    "av. ",
    "avenida ",
    "alameda ",
    "al. ",
    "bairro ",
    "cidade ",
    "restaurante",
    "café",
    "bar ",
    "hospedagem",
    "hotel",
    "pousada",
    "passeio",
    "ponto turístico",
  ];

  const keywordHits = placeKeywords.filter((kw) => lower.includes(kw));
  if (keywordHits.length < 2) {
    return { isPlace: false, address: null, city: null, highlights: [] };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let address: string | null = null;
  let city: string | null = null;
  const highlights: string[] = [];

  // Padrões de endereço brasileiro
  const addressRegex =
    /(?:(?:rua|r\.|avenida|av\.|alameda|al\.|estrada|rodovia|rod\.|travessa|tv\.|pra[çc]a|pr\.)\s+[A-Za-z0-9À-ÖØ-öø-ÿ\s\.\-—]+,\s*(?:n[º°]?\s*)?\d+[A-Za-z0-9\s\-—,]*)/i;

  // Cidades conhecidas ou padrão "Cidade - UF"
  const cityRegex =
    /\b([A-ZÀ-ÖØ-öø-ÿ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-öø-ÿ][a-zà-öø-ÿ]+)*)\s*(?:-|–|\/)\s*([A-Z]{2})\b/;

  const knownCities = [
    "São Paulo",
    "Rio de Janeiro",
    "Belo Horizonte",
    "Curitiba",
    "Brasília",
    "Salvador",
    "Fortaleza",
    "Recife",
    "Porto Alegre",
    "Florianópolis",
    "Goiânia",
    "Campinas",
    "Santos",
    "Gramado",
    "Canela",
    "Campos do Jordão",
    "Ubatuba",
    "Ilhabela",
    "Paraty",
    "Foz do Iguaçu",
  ];

  for (const line of lines) {
    // Busca endereço explícito
    if (!address) {
      if (/^(?:endere[çc]o|local|fica na|fica no|onde fica)\s*[:\-–—]\s*(.+)/i.test(line)) {
        const match = line.match(/^(?:endere[çc]o|local|fica na|fica no|onde fica)\s*[:\-–—]\s*(.+)/i);
        if (match) address = match[1].trim();
      } else {
        const addrMatch = line.match(addressRegex);
        if (addrMatch) {
          address = addrMatch[0].trim();
        }
      }
    }

    // Busca cidade / estado
    if (!city) {
      const cityMatch = line.match(cityRegex);
      if (cityMatch) {
        city = `${cityMatch[1]} - ${cityMatch[2]}`;
      } else {
        for (const known of knownCities) {
          if (new RegExp(`\\b${known}\\b`, "i").test(line)) {
            city = known;
            break;
          }
        }
      }
    }

    // Destaques / Valores / Horários
    if (
      /^(?:valor(?:es)?|pre[çc]o|entrada|ingresso|hor[áa]rio|funcionamento|atendimento|dica|destaque)\s*[:\-–—]/i.test(
        line
      )
    ) {
      highlights.push(line);
    }
  }

  const isPlace = Boolean(address || city || (keywordHits.length >= 3 && highlights.length > 0));
  return {
    isPlace,
    address,
    city,
    highlights,
  };
}

/**
 * Extrator 3: Isola passos enumerados em tutoriais / passo a passo.
 */
export function extractTutorial(text: string): TutorialData {
  if (!text || typeof text !== "string") {
    return { isTutorial: false, steps: [] };
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const steps: string[] = [];

  const numberedRegex = /^(?:(?:\d+[\.\)\-—º°]|passo\s*\d+|etapa\s*\d+)\s*[:\-–—]?\s*)(.+)/i;

  for (const line of lines) {
    const match = line.match(numberedRegex);
    if (match && match[1] && match[1].length > 3) {
      steps.push(line);
    }
  }

  const isTutorial = steps.length >= 2;
  return {
    isTutorial,
    steps,
  };
}

/**
 * Constrói o Resumo Enriquecido combinando a transcrição, inspeção visual,
 * descrição semântica e aplicando os 3 extratores dedicados.
 */
export function buildEnrichedSummary(item: {
  caption?: string | null;
  transcription?: string | null;
  video_inspection?: string | null;
  semantic_description?: string | null;
}): EnrichedSummaryResult {
  const parts: string[] = [];
  if (item.semantic_description) parts.push(item.semantic_description);
  if (item.video_inspection) parts.push(item.video_inspection);
  if (item.transcription) parts.push(item.transcription);

  const combinedText = [
    item.semantic_description ?? "",
    item.video_inspection ?? "",
    item.transcription ?? "",
    item.caption ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const recipe = extractRecipe(combinedText);
  const place = extractPlace(combinedText);
  const tutorial = extractTutorial(combinedText);

  // O resumo base usa a descrição semântica gerada ou síntese da inspeção + áudio
  let mainSummary = item.semantic_description?.trim() ?? "";
  if (!mainSummary && item.video_inspection) {
    mainSummary = item.video_inspection.trim();
  }
  if (!mainSummary && item.transcription) {
    mainSummary = item.transcription.trim();
  }
  if (!mainSummary && item.caption) {
    mainSummary = cleanCaption(item.caption);
  }
  if (!mainSummary) {
    mainSummary = "Resumo em processamento pela inteligência artificial.";
  }

  // Monta o texto formatado para cópia
  const copyParts: string[] = [];
  copyParts.push(`📌 RESUMO DO VÍDEO\n${mainSummary}`);

  if (recipe.isRecipe) {
    copyParts.push(`\n🍳 FICHA DE RECEITA`);
    if (recipe.ingredients.length > 0) {
      copyParts.push(`Ingredientes:\n` + recipe.ingredients.map((i) => `• ${i}`).join("\n"));
    }
    if (recipe.preparation.length > 0) {
      copyParts.push(`Modo de Preparo:\n` + recipe.preparation.map((p, idx) => `${idx + 1}. ${p}`).join("\n"));
    }
  }

  if (place.isPlace) {
    copyParts.push(`\n📍 FICHA DO LOCAL`);
    if (place.address) copyParts.push(`Endereço: ${place.address}`);
    if (place.city) copyParts.push(`Cidade/Região: ${place.city}`);
    if (place.highlights.length > 0) {
      copyParts.push(`Destaques:\n` + place.highlights.map((h) => `• ${h}`).join("\n"));
    }
  }

  if (tutorial.isTutorial && !recipe.isRecipe) {
    copyParts.push(`\n📋 PASSOS DO TUTORIAL\n` + tutorial.steps.join("\n"));
  }

  return {
    summary: mainSummary,
    recipe: recipe.isRecipe ? recipe : null,
    place: place.isPlace ? place : null,
    tutorial: tutorial.isTutorial ? tutorial : null,
    copyableText: copyParts.join("\n\n"),
  };
}
