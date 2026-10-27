import { Check, Copy, CreditCard, Landmark, Store } from "lucide-react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { datosPago } from "@/lib/api/operacion";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { membresia as consultarMembresia, type Membresia } from "@/lib/api/dueno";
import { cn } from "@/lib/utils";
import { instante, pesos } from "@/lib/api/formato";
import { Button } from "@/components/ui/button";
import { HistorialPagosEnLinea, PagoEnLinea } from "@/components/pago-en-linea";

type Metodo = "transferencia" | "oxxo" | "tarjeta" | null;

const VERDE = "bg-emerald-400/15 text-emerald-400 ring-emerald-400/40";
const AMBAR = "bg-amber-400/15 text-amber-400 ring-amber-400/40";
const ROJO = "bg-red-400/15 text-red-400 ring-red-400/40";
const ESTADO_MEMBRESIA: Record<Membresia["estado"], { texto: string; clases: string }> = {
  prueba: { texto: "Prueba gratis", clases: VERDE },
  activa: { texto: "Vigente", clases: VERDE },
  gracia: { texto: "Pago pendiente", clases: AMBAR },
  vencida: { texto: "Bloqueada", clases: ROJO },
  suspendida: { texto: "Suspendida", clases: ROJO },
};

function fechaLarga(iso: string) {
  const fecha = new Date(`${iso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(fecha.getTime())) return iso;
  return fecha.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
}

function textoEstado(m: Membresia) {
  const v = fechaLarga(m.fecha_vencimiento);
  const b = fechaLarga(m.bloqueo_desde);
  switch (m.estado) {
    case "prueba": return `Tu prueba termina el ${v}.`;
    case "activa": return `Vence el ${v}.`;
    case "gracia": return `Venció el ${v}. La caja se bloqueará el ${b} si no registramos tu pago.`;
    case "vencida": return `Venció el ${v}. Caja bloqueada desde el ${b}. Se desbloquea en cuanto registremos tu pago.`;
    case "suspendida": return "MiSaldo suspendió tu cuenta. Escríbenos por WhatsApp para resolverlo.";
  }
}

function lineaMovimiento(m: Membresia["movimientos"][number]) {
  if (m.tipo === "extension_manual") {
    const n = m.meses_agregados ?? 0;
    return `Pago · ${n} ${n === 1 ? "mes" : "meses"} · ${pesos(m.monto_centavos)}`;
  }
  if (m.tipo === "prueba_gratuita") return `Días de prueba · ${m.dias_agregados ?? 0} días`;
  return `Pago con tarjeta · ${pesos(m.monto_centavos)}`;
}

function EstadoMembresia() {
  const consulta = useQuery({ queryKey: ["membresia"], queryFn: consultarMembresia, retry: false });
  const datos = consulta.data;
  const fallo = consulta.isError;

  if (fallo)
    return (
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary/70 px-4 py-3">
        <p className="text-sm text-muted-foreground">No pudimos consultar tu membresía.</p>
        <Button size="sm" variant="secondary" onClick={() => void consulta.refetch()}>Intentar de nuevo</Button>
      </div>
    );
  if (!datos) return <p className="mt-4 text-sm text-muted-foreground">Consultando tu membresía…</p>;
  const estilo = ESTADO_MEMBRESIA[datos.estado];
  const movs = (datos.movimientos ?? []).slice(0, 5);

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Estado de tu membresía</p>
          <p className="mt-0.5 text-sm text-foreground">{textoEstado(datos)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ring-1", estilo.clases)}>
          {estilo.texto}
        </span>
      </div>
      <div className="mt-4">
        <h3 className="text-base font-semibold">Historial</h3>
        {movs.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Aún no hay pagos registrados.</p>
        ) : (
          <ul className="mt-2 flex flex-col divide-y divide-border">
            {movs.map((m, i) => (
              <li key={`${m.creado_en}-${m.tipo}-${i}`} className="py-2">
                <p className="text-sm font-medium">{lineaMovimiento(m)}</p>
                <p className="text-xs text-muted-foreground">
                  {m.fecha_vencimiento_anterior ? `${fechaLarga(m.fecha_vencimiento_anterior)} → ` : ""}
                  {fechaLarga(m.fecha_vencimiento_nueva)} · {instante(m.creado_en)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

async function copiar(valor: string, etiqueta: string) {
  try {
    await navigator.clipboard.writeText(valor);
    toast.success(`${etiqueta} copiado`);
  } catch {
    toast.error(`No se pudo copiar. Cópialo manualmente: ${valor}`);
  }
}

function Dato({ etiqueta, valor, mono = true }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary/70 px-4 py-3">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{etiqueta}</p>
        <p className={cn("text-base font-semibold", mono ? "break-all font-mono tracking-wide" : "truncate")}>{valor}</p>
      </div>
      <button
        type="button"
        onClick={() => void copiar(valor, etiqueta)}
        aria-label={`Copiar ${etiqueta.toLowerCase()}`}
        className="tap-target shadow-soft grid size-11 shrink-0 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-primary active:shadow-none"
      >
        <Copy className="size-5" />
      </button>
    </div>
  );
}

function BotonWhatsApp({ href }: { href: string | undefined }) {
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="tap-target flex min-h-14 items-center justify-center gap-3 rounded-2xl px-6 py-4 text-lg font-bold text-white transition-transform active:scale-[0.98]"
      style={{ backgroundColor: "#25D366" }}
    >
      <WhatsAppIcon className="size-7 shrink-0" />
      Ya pagué, enviar comprobante
    </a>
  );
}

function MetodoHeader({
  icono,
  titulo,
  subtitulo,
  seleccionado,
  deshabilitado,
  onClick,
}: {
  icono: React.ReactNode;
  titulo: string;
  subtitulo: string;
  seleccionado: boolean;
  deshabilitado?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={seleccionado}
      disabled={deshabilitado}
      className={cn(
        "tap-target flex w-full items-center gap-4 rounded-xl px-4 py-4 text-left transition-colors",
        deshabilitado
          ? "cursor-not-allowed opacity-55"
          : seleccionado
            ? "btn-premium text-primary-foreground"
            : "bg-secondary/60 text-foreground hover:bg-secondary",
      )}
    >
      <span
        className={cn(
          "grid size-12 shrink-0 place-items-center rounded-full",
          deshabilitado ? "bg-background/60 text-muted-foreground" : seleccionado ? "bg-primary/20" : "bg-primary/12 text-primary",
        )}
      >
        {icono}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold leading-tight">{titulo}</span>
          {deshabilitado && (
            <span className="rounded-full bg-amber-400/20 px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-400 ring-1 ring-amber-400/40">
              Próximamente
            </span>
          )}
        </span>
        <span className={cn("mt-0.5 block text-sm", deshabilitado ? "text-muted-foreground" : seleccionado ? "text-primary-foreground/80" : "text-muted-foreground")}>
          {subtitulo}
        </span>
      </span>
      {!deshabilitado && (
        <span
          className={cn(
            "grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors",
            seleccionado ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/50",
          )}
        >
          {seleccionado && <Check className="size-4" />}
        </span>
      )}
    </button>
  );
}

/** Sección de Membresía / métodos de pago, incrustada en Ajustes (solo Dueño con sesión real). */
export function SeccionMembresia() {
  const [metodo, setMetodo] = useState<Metodo>(null);
  const { sesion } = useAuth();
  const esDueno = sesion?.contexto.rol === "dueno";
  // No caching: payment details are fetched fresh and dropped when the screen closes.
  const pago = useQuery({ queryKey: ["membresia-pago"], queryFn: datosPago, enabled: esDueno, gcTime: 0, staleTime: 0, retry: false });

  // Seguridad: solo el rol real de la sesión puede ver los datos bancarios.
  if (sesion?.contexto.rol !== "dueno") return null;

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold tracking-tight">Membresía</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Renueva tu membresía de MiSaldo y elige cómo pagar tu mensualidad. Toca una opción para ver sus datos.
      </p>

      <EstadoMembresia />

      <div className="mt-4 flex flex-col gap-3">
        {pago.isPending ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Cargando los datos de pago…</p>
        ) : pago.isError ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="text-sm text-destructive">No pudimos cargar los datos de pago.</p>
            <Button variant="secondary" onClick={() => void pago.refetch()}>Intentar de nuevo</Button>
          </div>
        ) : !pago.data.transferencia && !pago.data.oxxo && !pago.data.pasarela?.disponible ? (
          <p className="py-4 text-center text-sm text-muted-foreground">Por ahora no hay datos de pago disponibles. Intenta más tarde.</p>
        ) : null}
        {pago.data?.transferencia && (() => { const t = pago.data.transferencia; return (
        <div className="rounded-2xl border border-border bg-background/40 p-2">
          <MetodoHeader
            icono={<Landmark className="size-6" />}
            titulo="Transferencia bancaria"
            subtitulo="Depósito o transferencia SPEI"
            seleccionado={metodo === "transferencia"}
            onClick={() => setMetodo(metodo === "transferencia" ? null : "transferencia")}
          />
          {metodo === "transferencia" && (
            <div className="flex flex-col gap-3 p-2 pt-3">
              {t.banco && <Dato etiqueta="Institución" valor={t.banco} mono={false} />}
              {t.clabe && <Dato etiqueta="CLABE" valor={t.clabe} />}
              {t.beneficiario && <Dato etiqueta="Beneficiario" valor={t.beneficiario} mono={false} />}
              <BotonWhatsApp href={pago.data.whatsapp?.enlace} />
            </div>
          )}
        </div>); })()}

        {pago.data?.oxxo && (() => { const o = pago.data.oxxo; return (
        <div className="rounded-2xl border border-border bg-background/40 p-2">
          <MetodoHeader
            icono={<Store className="size-6" />}
            titulo="Depósito en efectivo (OXXO)"
            subtitulo="Paga en cualquier tienda OXXO"
            seleccionado={metodo === "oxxo"}
            onClick={() => setMetodo(metodo === "oxxo" ? null : "oxxo")}
          />
          {metodo === "oxxo" && (
            <div className="flex flex-col gap-3 p-2 pt-3">
              <p className="rounded-xl bg-secondary/70 px-4 py-3 text-sm text-muted-foreground">
                Tarjeta <span className="font-semibold text-foreground">Spin by OXXO</span> (+ comisión por establecimiento).
              </p>
              {o.tarjeta && <Dato etiqueta="Número de tarjeta" valor={o.tarjeta} />}
              {o.titular && <Dato etiqueta="Titular de la tarjeta" valor={o.titular} mono={false} />}
              <BotonWhatsApp href={pago.data.whatsapp?.enlace} />
            </div>
          )}
        </div>); })()}

        {pago.data?.pasarela?.disponible && <div className="rounded-2xl border border-border bg-background/40 p-2">
          <MetodoHeader
            icono={<CreditCard className="size-6" />}
            titulo="Pago en línea"
            subtitulo="Tarjeta u OXXO con Mercado Pago"
            seleccionado={metodo === "tarjeta"}
            deshabilitado={!pago.data?.pasarela?.disponible}
            onClick={() => setMetodo(metodo === "tarjeta" ? null : "tarjeta")}
          />
          {metodo === "tarjeta" && pago.data?.pasarela?.disponible && <PagoEnLinea pasarela={pago.data.pasarela} />}
        </div>}
      </div>

      <HistorialPagosEnLinea />

      <p className="mt-4 text-center text-sm text-muted-foreground">
        Tu membresía se renueva cuando confirmemos el pago.
      </p>
    </section>
  );
}
