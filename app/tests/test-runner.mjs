import assert from "node:assert/strict";
import { sourceIdentity, mediaUrl, pageCreator, inspectResponse, AcquisitionError } from "../runtime/acquire.mjs";

console.log("==================================================");
console.log("   MEDIA SYNC CORE - SUÍTE DE TESTES UNITÁRIOS    ");
console.log("==================================================");

// 1. Teste de identificação e normalização de URLs (sourceIdentity)
console.log("\n[1/4] Testando normalização de URLs e cálculo de media_id...");
{
  const reel = sourceIdentity("https://www.instagram.com/reel/C3b4Xy-v8Qz/");
  assert.equal(reel.source_key, "C3b4Xy-v8Qz");
  assert.equal(reel.source_url, "https://www.instagram.com/reel/C3b4Xy-v8Qz/");
  assert.ok(typeof reel.media_id === "string" && reel.media_id.length > 0);
  console.log("  ✓ URL /reel/ normalizada: key=" + reel.source_key + ", media_id=" + reel.media_id);

  const post = sourceIdentity("https://instagram.com/p/ABC123xyz/");
  assert.equal(post.source_key, "ABC123xyz");
  console.log("  ✓ URL /p/ normalizada com sucesso");

  assert.throws(() => sourceIdentity("https://malicious.com/p/ABC/"), /INVALID_SOURCE/);
  assert.throws(() => sourceIdentity("https://instagram.com/invalid/path/"), /INVALID_SOURCE/);
  assert.throws(() => sourceIdentity("https://user:pass@instagram.com/reel/ABC/"), /INVALID_SOURCE/);
  console.log("  ✓ URLs malformadas ou com credenciais embutidas foram rejeitadas com segurança");
}

// 2. Teste de validação de URL de mídia CDN (mediaUrl)
console.log("\n[2/4] Testando validação de domínios CDN oficiais...");
{
  const validCdn1 = "https://scontent.cdninstagram.com/v/t51.2885-15/video.mp4";
  const validCdn2 = "https://instagram.fbcdn.net/v/t51.2885-15/cover.jpg";
  assert.equal(mediaUrl(validCdn1), validCdn1);
  assert.equal(mediaUrl(validCdn2), validCdn2);
  console.log("  ✓ CDNs autorizadas validadas: cdninstagram.com e fbcdn.net");

  assert.throws(() => mediaUrl("https://untrusted-cdn.com/video.mp4"), /INVALID_MEDIA/);
  assert.throws(() => mediaUrl("http://scontent.cdninstagram.com/video.mp4"), /INVALID_MEDIA/);
  console.log("  ✓ CDNs externas ou conexões não-HTTPS rejeitadas");
}

// 3. Teste de extração de criador a partir de metadados HTML (pageCreator)
console.log("\n[3/4] Testando extração de autoria a partir de metadados OpenGraph...");
{
  const mockSource = { source_key: "C3b4Xy-v8Qz" };
  const mockHtml = `
    <html>
      <head>
        <meta property="og:url" content="https://www.instagram.com/criador_exemplo/reel/C3b4Xy-v8Qz/" />
        <meta name="twitter:title" content="Reel sensacional (@criador_exemplo) no Instagram" />
      </head>
    </html>
  `;
  const creator = pageCreator(mockSource, mockHtml);
  assert.equal(creator, "criador_exemplo");
  console.log("  ✓ Criador autenticado extraído com sucesso: @" + creator);

  // Rejeição em caso de discrepância entre título e og:url
  const mismatchHtml = `
    <html>
      <head>
        <meta property="og:url" content="https://www.instagram.com/criador_a/reel/C3b4Xy-v8Qz/" />
        <meta name="twitter:title" content="Reel (@criador_b) no Instagram" />
      </head>
    </html>
  `;
  assert.throws(() => pageCreator(mockSource, mismatchHtml), /CREATOR_UNAVAILABLE/);
  console.log("  ✓ Discrepâncias de autoria detectadas e rejeitadas");
}

// 4. Teste de tratamento de respostas HTTP e Rate Limiting (inspectResponse)
console.log("\n[4/4] Testando tratamento de respostas HTTP e rate limit...");
{
  assert.throws(() => inspectResponse({ status: 401, url: "https://www.instagram.com" }), /LOGIN_REQUIRED/);
  assert.throws(() => inspectResponse({ status: 403, url: "https://www.instagram.com" }), /ACCESS_RESTRICTED/);
  
  try {
    inspectResponse({ status: 429, headers: { "retry-after": "120" }, url: "https://www.instagram.com" });
    assert.fail("Deveria ter lançado RATE_LIMITED");
  } catch (err) {
    assert.ok(err instanceof AcquisitionError);
    assert.equal(err.code, "RATE_LIMITED");
    assert.ok(err.retryAt !== null);
    console.log("  ✓ Erro 429 com cabeçalho Retry-After capturado e calculado: " + err.retryAt);
  }

  const ok = inspectResponse({ status: 200, url: "https://www.instagram.com/reel/123/", text: "<html></html>" });
  assert.equal(ok.status, 200);
  console.log("  ✓ Resposta 200 OK aceita normalmente");
}

console.log("\n--------------------------------------------------");
console.log("✔ TODOS OS TESTES UNITÁRIOS FORAM APROVADOS COM SUCESSO!");
console.log("--------------------------------------------------\n");
