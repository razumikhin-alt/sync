import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanCaption,
  extractRecipe,
  extractPlace,
  extractTutorial,
  buildEnrichedSummary,
} from "../lib/extractors.ts";

test("cleanCaption removes location and music lines while preserving the body text", () => {
  const rawCaption = `
Bolo de Cenoura com Cobertura de Chocolate crocante! 🥕🍫
Fica super fofinho e é muito fácil de fazer.

📍 Local: Padaria Central de Campinas
📌 Onde fica: Rua das Flores, 120
🎵 Música: Jorge & Mateus - Sosseguei
🎶 Áudio: Som original - receita_facil
🎧 Trilha sonora: Pop Hits 2026

Comente "EU QUERO" para receber a receita completa no direct!
  `.trim();

  const cleaned = cleanCaption(rawCaption);

  assert.ok(cleaned.includes("Bolo de Cenoura com Cobertura de Chocolate crocante!"));
  assert.ok(cleaned.includes('Comente "EU QUERO"'));
  assert.ok(!cleaned.includes("Local: Padaria"));
  assert.ok(!cleaned.includes("Rua das Flores"));
  assert.ok(!cleaned.includes("Jorge & Mateus"));
  assert.ok(!cleaned.includes("Som original"));
  assert.ok(!cleaned.includes("Pop Hits"));
});

test("cleanCaption handles empty or null captions gracefully", () => {
  assert.equal(cleanCaption(null), "Nenhuma legenda informada para este vídeo.");
  assert.equal(cleanCaption(""), "Nenhuma legenda informada para este vídeo.");
  assert.equal(cleanCaption("   "), "Nenhuma legenda informada para este vídeo.");
});

test("extractRecipe isolates ingredients and preparation steps in recipe cards", () => {
  const recipeText = `
Receita de Panqueca Proteica
Ingredientes:
- 2 ovos
- 1 xícara de aveia em flocos
- 1 banana madura
- 1 colher de sopa de mel
- 1 pitada de canela em pó

Modo de Preparo:
1. Bata todos os ingredientes no liquidificador até ficar homogêneo.
2. Aqueça uma frigideira antiaderente em fogo médio.
3. Despeje uma concha da massa e doure dos dois lados.
4. Sirva com frutas frescas.
  `;

  const result = extractRecipe(recipeText);

  assert.equal(result.isRecipe, true);
  assert.ok(result.ingredients.length >= 4);
  assert.ok(result.ingredients.some((i) => i.includes("ovos")));
  assert.ok(result.ingredients.some((i) => i.includes("aveia")));
  assert.ok(result.preparation.length >= 3);
  assert.ok(result.preparation.some((p) => p.includes("liquidificador")));
});

test("extractPlace isolates address and city in location cards", () => {
  const placeText = `
Conheci o melhor café escondido do centro histórico!
Um ambiente aconchegante perfeito para trabalhar e tomar um bom espresso.
Endereço: Rua Augusta, 1500 - Consolação
Cidade: São Paulo - SP
Horário: De terça a domingo, das 09h às 19h
Valores: Cafés a partir de R$ 9,00
  `;

  const result = extractPlace(placeText);

  assert.equal(result.isPlace, true);
  assert.ok(result.address && result.address.includes("Augusta"));
  assert.ok(result.city && result.city.includes("São Paulo"));
  assert.ok(result.highlights.length >= 1);
});

test("extractTutorial isolates numbered steps in tutorial cards", () => {
  const tutorialText = `
Como organizar suas finanças pelo celular em 3 passos simples:
1. Anote todas as receitas fixas no início do mês.
2. Categorize os gastos essenciais e variáveis.
3. Defina um limite semanal para compras por impulso.
  `;

  const result = extractTutorial(tutorialText);

  assert.equal(result.isTutorial, true);
  assert.equal(result.steps.length, 3);
  assert.ok(result.steps[0].includes("Anote todas as receitas"));
  assert.ok(result.steps[2].includes("Defina um limite semanal"));
});

test("buildEnrichedSummary combines multimodal insights, extractors and generates copyable text", () => {
  const item = {
    caption: `
Receita rápida de Waffle!
Ingredientes:
- 2 xícaras de farinha
- 2 ovos
- 1 colher de fermento
Modo de preparo:
- Misture tudo e asse na máquina de waffle.
    `,
    transcription: "Hoje eu vou te ensinar a fazer o melhor waffle crocante que você já comeu.",
    video_inspection: "Pessoa batendo massa em tigela de vidro e colocando em máquina de waffle quente.",
    semantic_description: "Preparo de waffle artesanal crocante com massa rápida de liquidificador.",
  };

  const enriched = buildEnrichedSummary(item);

  assert.ok(enriched.summary.includes("waffle"));
  assert.ok(enriched.recipe?.isRecipe);
  assert.ok(enriched.copyableText.includes("RESUMO DO VÍDEO"));
  assert.ok(enriched.copyableText.includes("FICHA DE RECEITA"));
  assert.ok(enriched.copyableText.includes("Ingredientes:"));
  assert.ok(enriched.copyableText.includes("Modo de Preparo:"));
});
