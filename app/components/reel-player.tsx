"use client";

import * as React from "react";
import { Dialog } from "radix-ui";
import {
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  X,
  FileText,
  Sparkles,
  Headphones,
  Copy,
  Check,
  Utensils,
  MapPin,
  ListOrdered,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cleanCaption, buildEnrichedSummary } from "@/lib/extractors";

export type Reference = {
  id: string;
  creator: string | null;
  source_url: string;
  caption?: string | null;
  transcription?: string | null;
  video_inspection?: string | null;
  semantic_description?: string | null;
};

type Props = {
  initial: Reference;
  items: Reference[];
  total: number;
  hasMore: boolean;
  loadMore: () => Promise<Reference[]>;
  onClose: () => void;
};

type TabType = "description" | "summary" | "transcription";

export function ReelPlayer({ initial, items, total, hasMore, loadMore, onClose }: Props) {
  const [current, setCurrent] = React.useState(initial);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [activeTab, setActiveTab] = React.useState<TabType>("description");
  const [copied, setCopied] = React.useState(false);
  const [copiedTranscription, setCopiedTranscription] = React.useState(false);

  const pending = React.useRef(false);
  const mounted = React.useRef(true);
  const origin = React.useRef(typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null);
  const gesture = React.useRef<{ id: number; x: number; y: number } | null>(null);

  const index = items.findIndex((item) => item.id === current.id);
  const hasPrevious = index > 0;
  const hasNext = index >= 0 && (index < items.length - 1 || hasMore);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  React.useEffect(() => {
    setCurrent(initial);
  }, [initial]);

  const move = async (direction: -1 | 1) => {
    if (pending.current || !(direction === 1 ? hasNext : hasPrevious)) return;
    setError("");
    const next = items[index + direction];
    if (next) {
      setCurrent(next);
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const more = await loadMore();
      if (mounted.current && more[0]) setCurrent(more[0]);
    } catch (e) {
      if (mounted.current) setError((e as Error).message);
    } finally {
      pending.current = false;
      if (mounted.current) setLoading(false);
    }
  };

  const startGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") return;
    if (!event.isPrimary) {
      gesture.current = null;
      return;
    }
    if ((event.target as Element).closest("button,a")) return;
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dy) >= 48 && Math.abs(dy) > Math.abs(dx) * 1.5) void move(dy < 0 ? 1 : -1);
  };

  const copyToClipboard = async (text: string, isTranscription = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isTranscription) {
        setCopiedTranscription(true);
        setTimeout(() => setCopiedTranscription(false), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error("Falha ao copiar:", err);
    }
  };

  const cleanedDescription = React.useMemo(() => cleanCaption(current.caption), [current.caption]);
  const enrichedSummary = React.useMemo(() => buildEnrichedSummary(current), [current]);
  const transcriptionText = React.useMemo(() => {
    if (current.transcription && current.transcription.trim()) {
      return current.transcription.trim();
    }
    return "Transcrição do áudio em processamento pela inteligência artificial.";
  }, [current.transcription]);

  return (
    <Dialog.Root open onOpenChange={(open) => { if (!open) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay" />
        <Dialog.Content
          className="player-panel player-panel-expanded"
          aria-describedby={undefined}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            origin.current?.focus();
          }}
          onKeyDown={(event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              void move(event.key === "ArrowDown" ? 1 : -1);
            }
          }}
        >
          <div className="panel-heading">
            <div className="player-header-title">
              <Dialog.Title>{current.creator ?? "Reel"}</Dialog.Title>
              <span className="player-ai-badge">
                <Sparkles size={13} className="ai-badge-icon" />
                Multimodal &amp; Híbrido
              </span>
            </div>
            <Dialog.Close asChild>
              <Button variant="ghost" size="icon" aria-label="Fechar reprodução">
                <X size={20} />
              </Button>
            </Dialog.Close>
          </div>

          <div className="player-layout-grid">
            {/* Coluna da esquerda: Vídeo e Controles de Navegação */}
            <div className="player-media-column">
              <div className="player-body">
                <iframe
                  key={current.id}
                  title={`Reel de ${current.creator ?? "criador"} no Instagram`}
                  src={`${current.source_url}embed/`}
                  sandbox="allow-scripts allow-same-origin allow-popups"
                  allow="autoplay; fullscreen"
                />
                <div
                  className="player-navigation"
                  role="group"
                  aria-label="Navegar pelas referências"
                  onPointerDown={startGesture}
                  onPointerUp={endGesture}
                  onPointerCancel={() => { gesture.current = null; }}
                  onLostPointerCapture={() => { gesture.current = null; }}
                >
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Referência anterior"
                    disabled={!hasPrevious || loading}
                    onClick={() => void move(-1)}
                  >
                    <ChevronUp size={22} />
                  </Button>
                  <span className="player-swipe-hint">Deslize</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Próxima referência"
                    disabled={!hasNext || loading}
                    onClick={() => void move(1)}
                  >
                    {loading ? <LoaderCircle size={22} className="loading-icon" /> : <ChevronDown size={22} />}
                  </Button>
                </div>
              </div>

              <div className="player-footer-bar">
                <div className="player-position" role="status" aria-live="polite">
                  {index + 1} de {total}
                  {loading ? " · Carregando" : !hasNext ? " · Fim das referências" : ""}
                </div>
                {error && <p className="player-error" role="alert">{error} Use a seta para tentar novamente.</p>}
                <a
                  className="instagram-fallback"
                  href={current.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Abrir no Instagram
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>

            {/* Coluna da direita: Abas Interativas de IA */}
            <div className="player-content-column">
              <div className="player-tabs" role="tablist" aria-label="Abas de conteúdo do vídeo">
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "description"}
                  className={`player-tab-button ${activeTab === "description" ? "active" : ""}`}
                  onClick={() => setActiveTab("description")}
                >
                  <FileText size={15} />
                  <span>Descrição</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "summary"}
                  className={`player-tab-button ${activeTab === "summary" ? "active" : ""}`}
                  onClick={() => setActiveTab("summary")}
                >
                  <Sparkles size={15} />
                  <span>Resumo</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={activeTab === "transcription"}
                  className={`player-tab-button ${activeTab === "transcription" ? "active" : ""}`}
                  onClick={() => setActiveTab("transcription")}
                >
                  <Headphones size={15} />
                  <span>Transcrição</span>
                </button>
              </div>

              <div className="player-tab-content" tabIndex={0}>
                {/* 1. ABA DESCRIÇÃO */}
                {activeTab === "description" && (
                  <div className="tab-pane tab-description">
                    <div className="tab-section-intro">
                      <p className="tab-section-note">
                        Texto original da legenda postada com o vídeo (linhas de localização e música foram desconsideradas).
                      </p>
                    </div>
                    <div className="caption-text-block">
                      {cleanedDescription.split("\n").map((line, i) => (
                        <p key={i} className={line.trim() ? "caption-line" : "caption-empty-line"}>
                          {line || "\u00A0"}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {/* 2. ABA RESUMO: Multimodal + Extratores dedicados + Botão Copiar */}
                {activeTab === "summary" && (
                  <div className="tab-pane tab-summary">
                    <div className="summary-overview-box">
                      <div className="box-title">
                        <Bot size={15} />
                        <span>Síntese Multimodal (Áudio + Inspeção de Frames)</span>
                      </div>
                      <p className="summary-overview-text">{enrichedSummary.summary}</p>
                    </div>

                    {/* Ficha de Receita: Ingredientes e Modo de Preparo */}
                    {enrichedSummary.recipe && (
                      <div className="extractor-card recipe-card">
                        <div className="extractor-card-header">
                          <Utensils size={17} />
                          <h3>Ficha de Receita</h3>
                        </div>

                        {enrichedSummary.recipe.ingredients.length > 0 && (
                          <div className="extractor-subgroup">
                            <h4>Ingredientes:</h4>
                            <ul className="extractor-list">
                              {enrichedSummary.recipe.ingredients.map((ing, i) => (
                                <li key={i}>{ing}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {enrichedSummary.recipe.preparation.length > 0 && (
                          <div className="extractor-subgroup">
                            <h4>Modo de Preparo:</h4>
                            <ol className="extractor-ordered-list">
                              {enrichedSummary.recipe.preparation.map((prep, i) => (
                                <li key={i}>{prep}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Ficha de Lugar: Endereço, Cidade e Destaques */}
                    {enrichedSummary.place && (
                      <div className="extractor-card place-card">
                        <div className="extractor-card-header">
                          <MapPin size={17} />
                          <h3>Ficha de Lugar</h3>
                        </div>

                        <div className="place-details">
                          {enrichedSummary.place.city && (
                            <div className="place-item">
                              <span className="place-label">Cidade / Região:</span>
                              <span className="place-val">{enrichedSummary.place.city}</span>
                            </div>
                          )}
                          {enrichedSummary.place.address && (
                            <div className="place-item">
                              <span className="place-label">Endereço:</span>
                              <span className="place-val">{enrichedSummary.place.address}</span>
                            </div>
                          )}
                          {enrichedSummary.place.highlights.length > 0 && (
                            <div className="place-highlights">
                              <span className="place-label">Destaques:</span>
                              <ul className="extractor-list">
                                {enrichedSummary.place.highlights.map((h, i) => (
                                  <li key={i}>{h}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Ficha de Tutorial: Passos enumerados */}
                    {enrichedSummary.tutorial && !enrichedSummary.recipe && (
                      <div className="extractor-card tutorial-card">
                        <div className="extractor-card-header">
                          <ListOrdered size={17} />
                          <h3>Passos do Tutorial</h3>
                        </div>
                        <ol className="extractor-ordered-list">
                          {enrichedSummary.tutorial.steps.map((st, i) => (
                            <li key={i}>{st}</li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Botão de copiar texto ao final da parte do Resumo */}
                    <div className="summary-copy-action">
                      <Button
                        type="button"
                        variant="default"
                        className={`player-copy-button ${copied ? "copied" : ""}`}
                        onClick={() => copyToClipboard(enrichedSummary.copyableText)}
                      >
                        {copied ? <Check size={16} /> : <Copy size={16} />}
                        <span>{copied ? "Texto copiado para a área de transferência!" : "Copiar texto"}</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. ABA TRANSCRIÇÃO */}
                {activeTab === "transcription" && (
                  <div className="tab-pane tab-transcription">
                    <div className="tab-section-intro">
                      <p className="tab-section-note">
                        Transcrição integral do áudio por inteligência artificial (sem marcadores de tempo).
                      </p>
                    </div>
                    <div className="transcription-text-block">
                      <p className="transcription-body">{transcriptionText}</p>
                    </div>
                    {current.transcription && (
                      <div className="transcription-copy-action">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="transcription-copy-btn"
                          onClick={() => copyToClipboard(transcriptionText, true)}
                        >
                          {copiedTranscription ? <Check size={14} /> : <Copy size={14} />}
                          <span>{copiedTranscription ? "Copiado!" : "Copiar transcrição"}</span>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
