import { useState, useRef, useEffect } from "react";
import { Search, Package, MapPin, User, Weight, Clock, CheckCircle2, Truck, Building2, ArrowRight, Loader2 } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const API_BASE = (import.meta.env.VITE_API_URL as string) || "http://localhost:3000/api";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TrackingStep {
  estatus: string;
  agencia?: string;
  estado?: string;
  fecha_scan?: string;
  fecha?: string;
  fecha_hora?: string;
  fecha_hora_string?: string;
}

interface TrackingData {
  nro_envio?: string;
  destinatario?: string;
  agencia_origen?: string;
  agencia_destino?: string;
  peso?: string | number;
  tracking?: Record<string, TrackingStep>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getStepType(estatus: string): "generado" | "salida" | "transito" | "agencia" | "entregado" | "default" {
  const s = (estatus || "").toLowerCase();
  if (s.includes("entrada") || s.includes("generado")) return "generado";
  if (s.includes("entregado")) return "entregado";
  if (s.includes("salida")) return "salida";
  if (s.includes("transito") || s.includes("tránsito")) return "transito";
  if (s.includes("disponible") || s.includes("agencia") || s.includes("pedido") || s.includes("por entregar") || s.includes("asignaci")) return "agencia";
  return "default";
}

function getStepLabel(estatus: string, estado?: string): string {
  const s = (estatus || "").toLowerCase();
  if (s.includes("entrada") || s.includes("generado")) return "ENTRADA MRW";
  if (s.includes("entregado")) return "ENTREGADO";
  if (s.includes("transito") || s.includes("tránsito")) {
    const e = estado && String(estado).trim() ? String(estado).toUpperCase() : "";
    return e ? `EN TRÁNSITO ${e}` : "EN TRÁNSITO";
  }
  if (s.includes("disponible")) return "DISPONIBLE EN AGENCIA";
  if (s.includes("salida")) return "SALIDA DE AGENCIA";
  if (s.includes("pedido") || s.includes("por entregar") || s.includes("asignaci")) return "PEDIDO POR ENTREGAR";
  if (s.includes("monitoreo") || s.includes("operaciones")) return "MONITOREO OPERACIONES";
  return (estatus || "").toUpperCase();
}

function getStepDate(step: TrackingStep): Date | null {
  const raw = step.fecha_scan || step.fecha || step.fecha_hora || step.fecha_hora_string;
  if (!raw) return null;
  try { return new Date(raw); } catch { return null; }
}

function formatDate(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString("es-VE", { hour: "numeric", minute: "2-digit", hour12: true });
}

function cleanAgency(name?: string): string {
  if (!name) return "";
  return name
    .replace(/^agencia\s*/i, "")
    .replace(/\s*[-–—]\s*\d+\s*$/, "")
    .replace(/\s*\b\d{3,}\b\s*$/, "")
    .replace(/^\d+\s*[-–—:]?\s*/, "")
    .replace(/\s*\(.*\)\s*$/, "")
    .trim();
}

// ─── Step icon & colours ─────────────────────────────────────────────────────

const STEP_CONFIG = {
  generado:  { icon: Package,       bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-300",  dot: "bg-blue-500",   line: "bg-blue-200"  },
  salida:    { icon: ArrowRight,     bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-300",dot: "bg-orange-500", line: "bg-orange-200"},
  transito:  { icon: Truck,          bg: "bg-violet-100", text: "text-violet-700", border: "border-violet-300",dot: "bg-violet-500", line: "bg-violet-200"},
  agencia:   { icon: Building2,      bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-300", dot: "bg-amber-500",  line: "bg-amber-200" },
  entregado: { icon: CheckCircle2,   bg: "bg-green-100",  text: "text-green-700",  border: "border-green-300", dot: "bg-green-500",  line: "bg-green-200" },
  default:   { icon: MapPin,         bg: "bg-gray-100",   text: "text-gray-700",   border: "border-gray-300",  dot: "bg-gray-400",   line: "bg-gray-200"  },
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function Rastreo() {
  // Alto del menú fijo (cambia si hay mensajes en la franja de arriba): el bloque empieza justo debajo
  const [altoMenu, setAltoMenu] = useState<number | null>(null);
  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;
    // Solo se mide arriba de la página: al bajar, el menú cambia unos píxeles y la página saltaría
    const medir = () => {
      const alto = Math.round(header.getBoundingClientRect().height);
      setAltoMenu((prev) => (prev == null || window.scrollY <= 10 ? alto : prev));
    };
    medir();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(medir);
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  const [guia, setGuia] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [contacto, setContacto] = useState<string | null>(null);
  const [data, setData] = useState<TrackingData | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  async function buscar(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const num = guia.trim();
    if (!num) return;
    setLoading(true);
    setError(null);
    setContacto(null);
    setData(null);
    try {
      const res = await fetch(`${API_BASE}/mrw/tracking`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nro_tracking: num }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "No se encontró información para ese número de guía.");
        if (json.contacto) setContacto(json.contacto);
      } else {
        setData(json);
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      }
    } catch {
      setError("No se pudo conectar con el servidor. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const steps = data?.tracking ? Object.values(data.tracking) : [];
  const lastStep = steps[0];
  const lastType = lastStep ? getStepType(lastStep.estatus) : null;
  const isDelivered = lastType === "entregado";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Header cartItemsCount={0} cartPulseKey={0} onCartClick={() => {}} />

      {/* ── Hero banner ── */}
      {/* El relleno superior iguala la altura del menú fijo: así el bloque queda centrado debajo de él */}
      <section
        className="bg-gradient-to-br from-[#f5f0ea] to-[#ede8e1] pt-24 sm:pt-28 border-b border-[#e0d8cf]"
        style={altoMenu ? { paddingTop: altoMenu } : undefined}
      >
        <div className="max-w-4xl mx-auto px-6 py-10 flex flex-col md:flex-row items-center gap-8">
          {/* Text */}
          <div className="flex-1 text-center md:text-left space-y-3">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#ca9e67]">Envíos nacionales</p>
            <h2 className="text-3xl md:text-4xl font-extrabold text-gray-800 leading-tight">
              Localiza tu<br />
              <span className="text-[#ca9e67]">pedido</span>
            </h2>
            <p className="text-gray-500 text-sm">Ingresa el número de guía MRW y conoce el estado de tu encomienda en tiempo real.</p>
          </div>
          {/* Logo */}
          <div className="shrink-0">
            <img src="/mrw-logo.png" alt="MRW Venezuela" className="h-20 md:h-24 w-auto object-contain drop-shadow-md" />
          </div>
        </div>

        {/* Search bar inside hero */}
        <div className="bg-white/60 backdrop-blur-sm border-t border-[#e0d8cf] py-6 px-6">
          <form onSubmit={buscar} className="max-w-2xl mx-auto flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={guia}
                onChange={(e) => setGuia(e.target.value)}
                placeholder="Ej: 1234567890123"
                className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-9 pr-4 text-base sm:text-sm text-gray-800 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-[#ca9e67]/40 focus:border-[#ca9e67] transition-colors"
                disabled={loading}
                minLength={5}
                maxLength={45}
              />
            </div>
            <button
              type="submit"
              disabled={loading || guia.trim().length < 5}
              className="inline-flex items-center gap-2 rounded-lg bg-[#ca9e67] hover:bg-[#b58a53] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {loading ? "Buscando…" : "Rastrear"}
            </button>
          </form>
        </div>
      </section>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">

        {/* ── Error ── */}
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-5 py-4 text-sm text-destructive space-y-3">
            <p>{error}</p>
            {contacto && (
              <a href={contacto} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-700 transition-colors">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.136.564 4.14 1.546 5.876L.057 23.5l5.757-1.508A11.956 11.956 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.658-.5-5.188-1.374l-.371-.22-3.865 1.012 1.03-3.763-.241-.387A9.937 9.937 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                Contactar a MRW por WhatsApp
              </a>
            )}
          </div>
        )}

        {/* ── Result ── */}
        {data && (
          <div ref={resultRef} className="space-y-5">
            {/* Package info card */}
            <div className={`rounded-2xl border p-5 shadow-sm ${isDelivered ? "bg-green-50 border-green-200" : "bg-white"}`}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-0.5">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Número de guía</p>
                  <p className="text-2xl font-bold tabular-nums tracking-tight">{data.nro_envio || guia}</p>
                </div>
                {lastStep && (
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${STEP_CONFIG[lastType!]?.bg} ${STEP_CONFIG[lastType!]?.text}`}>
                    {isDelivered ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Truck className="h-3.5 w-3.5" />}
                    {getStepLabel(lastStep.estatus, lastStep.estado)}
                  </span>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-2">
                {data.destinatario && (
                  <div className="flex gap-2 items-start">
                    <User className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Destinatario</p>
                      <p className="text-sm font-medium leading-tight">{data.destinatario}</p>
                    </div>
                  </div>
                )}
                {data.agencia_destino && (
                  <div className="flex gap-2 items-start">
                    <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agencia destino</p>
                      <p className="text-sm font-medium leading-tight">{cleanAgency(data.agencia_destino)}</p>
                    </div>
                  </div>
                )}
                {data.agencia_origen && (
                  <div className="flex gap-2 items-start">
                    <Building2 className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Agencia origen</p>
                      <p className="text-sm font-medium leading-tight">{cleanAgency(data.agencia_origen)}</p>
                    </div>
                  </div>
                )}
                {data.peso != null && (
                  <div className="flex gap-2 items-start">
                    <Weight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Peso</p>
                      <p className="text-sm font-medium leading-tight">{data.peso} kg</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            {steps.length > 0 && (
              <div className="rounded-2xl border bg-white p-5 shadow-sm">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-5">Historial de eventos</h3>
                <ol className="relative space-y-0">
                  {steps.map((step, idx) => {
                    const type = getStepType(step.estatus);
                    const cfg = STEP_CONFIG[type];
                    const Icon = cfg.icon;
                    const date = getStepDate(step);
                    const isFirst = idx === 0;
                    const isLast = idx === steps.length - 1;

                    return (
                      <li key={idx} className="flex gap-4">
                        {/* Timeline column */}
                        <div className="flex flex-col items-center">
                          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 ${cfg.border} ${cfg.bg} z-10`}>
                            <Icon className={`h-4 w-4 ${cfg.text}`} />
                          </div>
                          {!isLast && <div className={`w-0.5 flex-1 my-1 ${cfg.line}`} style={{ minHeight: "2rem" }} />}
                        </div>

                        {/* Content */}
                        <div className={`pb-6 flex-1 min-w-0 ${isFirst ? "pt-1" : "pt-1"}`}>
                          <div className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${cfg.bg} ${cfg.text} mb-1`}>
                            {getStepLabel(step.estatus, step.estado)}
                          </div>
                          <div className="space-y-0.5">
                            {step.agencia && (
                              <p className="text-sm font-medium text-foreground">{cleanAgency(step.agencia)}</p>
                            )}
                            {date && (
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDate(date)} — {formatTime(date)}
                              </p>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Footer note */}
            <p className="text-center text-xs text-muted-foreground pb-4">
              Información provista por MRW Venezuela · <a href="https://mrwve.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">mrwve.com</a>
            </p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!data && !error && !loading && (
          <div className="text-center py-10 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Ingresa tu número de guía para ver el estado de tu envío</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
