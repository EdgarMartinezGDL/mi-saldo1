import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { dashboard } from "@/lib/api/dueno";
import { instante, nombreCompleto, pesos, telefonoVisible } from "@/lib/api/formato";
import type { Movimiento } from "@/lib/api/operacion";
import { cn } from "@/lib/utils";

/** Spanish wording for the codes of this module. */
export const MENSAJES_OPERACION: Record<string, string> = {
  cliente_no_encontrado: "Ese teléfono no es cliente de este negocio.",
  rango_invalido: "La fecha inicial debe ser antes de la final.",
  fecha_futura: "No puedes consultar fechas futuras.",
  rango_excedido: "El rango máximo es de 92 días.",
  tope_diario_excedido: "Ya se alcanzó el tope diario de ajustes.",
  sin_configuracion: "El dueño aún no termina de configurar esta tarjeta.",
  autoajuste: "No puedes ajustar tu propia cuenta de cliente",
  modulo_inactivo: "Este negocio no tiene activada esa función.",
  tarjeta_no_encontrada: "Esa tarjeta ya no está disponible.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
  monto_invalido: "El monto no es válido.",
  cantidad_invalida: "La cantidad no es válida.",
  idempotency_conflicto: "Hubo un problema con la operación. Vuelve a intentarlo.",
  valor_invalido: "Revisa los valores: alguno no es válido.",
  ya_resuelta: "Esta solicitud ya fue resuelta. Actualizamos la lista.",
  cliente_inactivo: "El cliente ya no está activo: recházala con una nota",
  tarjeta_inactiva: "Esa tarjeta ya no está activa.",
  cliente_sin_telefono: "El cliente no tiene teléfono registrado.",
  reclamacion_no_encontrada: "No encontramos esa reclamación.",
  nota_invalida: "La nota no es válida.",
  no_encontrada: "No encontramos esa solicitud.",
};

/** Shows the error; 402 gets the membership toast with a link; cancelled TOTP is silent. */
export function errorOperacion(e: unknown, modulo?: "monedero" | "tarjetas_sellos", propios?: Record<string, string>) {
  const err = e instanceof ApiError ? e : null;
  if (err?.codigo === "totp_cancelado") return;
  if (err?.status === 402 || err?.codigo === "membresia_vencida") {
    toast.error("Tu membresía está vencida: regulariza tu pago para hacer cambios", {
      action: { label: "Ver membresía", onClick: () => window.location.assign("/negocio/membresia") },
    });
    return;
  }
  if (err?.status === 429) return void toast.error(err.message);
  let texto = (err?.codigo && (propios?.[err.codigo] ?? MENSAJES_OPERACION[err.codigo])) || err?.message || "No se pudo completar.";
  if (err?.codigo === "tope_diario_excedido" && typeof err.extras["disponible_hoy"] === "number") {
    const d = err.extras["disponible_hoy"] as number;
    texto += ` Disponible hoy: ${modulo === "tarjetas_sellos" ? `${d} ${d === 1 ? "sello" : "sellos"}` : pesos(d)}.`;
  }
  toast.error(texto);
}

/** Pending counts for the hub cards (GET /api/dashboard). */
export function useConteosNegocio() {
  return useQuery({
    queryKey: ["dashboard-conteos"],
    queryFn: async () => {
      const d = await dashboard();
      return { reclamaciones: d.reclamaciones.pendientes, solicitudes: d.validaciones_alta.pendientes };
    },
  });
}
export function useRecargarConteos() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ["dashboard-conteos"] });
    void qc.invalidateQueries({ queryKey: ["dashboard"] });
  };
}

const plural = (n: number, uno: string, varios: string) => (Math.abs(n) === 1 ? uno : varios);
const sellos = (n: number) => `${Math.abs(n)} ${plural(n, "sello", "sellos")}`;

function tituloMovimiento(m: Movimiento) {
  const monto = m.monto_centavos ?? 0;
  const cant = m.cantidad ?? 0;
  const enSellos = m.modulo === "tarjetas_sellos";
  switch (m.tipo) {
    case "acumulacion":
      return `${enSellos ? `+${sellos(cant)} en ${m.tarjeta ?? "tarjeta"}` : `Ganó ${pesos(Math.abs(monto))}`}${
        typeof m.monto_compra_centavos === "number" ? ` (compra de ${pesos(m.monto_compra_centavos)})` : ""
      }`;
    case "canje":
      return enSellos ? `Canjeó un premio de ${m.tarjeta ?? "tarjeta"}` : `Canjeó ${pesos(Math.abs(monto))}`;
    case "ajuste_manual":
      return `Ajuste: ${m.motivo ?? ""}`;
    case "expiracion":
    case "vencimiento":
      return `Venció ${enSellos ? sellos(cant) : pesos(Math.abs(monto))}`;
    case "referido":
      return "Premio por recomendar";
  }
}

export function FilaMovimiento({ m }: { m: Movimiento }) {
  const valor = m.modulo === "tarjetas_sellos" ? (m.cantidad ?? 0) : (m.monto_centavos ?? 0);
  const texto =
    m.modulo === "tarjetas_sellos"
      ? `${valor > 0 ? "+" : valor < 0 ? "−" : ""}${Math.abs(valor)}`
      : `${valor > 0 ? "+" : valor < 0 ? "−" : ""}${pesos(Math.abs(valor))}`;
  const operador = m.operador ? nombreCompleto(m.operador) : "Sistema";
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 py-3">
      <div className="min-w-0">
        <p className="break-words text-base font-medium">{tituloMovimiento(m)}</p>
        <p className="text-sm text-muted-foreground">
          {m.cliente ? `${nombreCompleto(m.cliente)} · ${telefonoVisible(m.cliente.telefono)}` : "—"} · {operador} · {instante(m.fecha)}
        </p>
      </div>
      <span className={cn("shrink-0 font-mono font-semibold tabular-nums", valor > 0 ? "text-emerald-400" : valor < 0 ? "text-red-400" : "")}>
        {texto}
      </span>
    </li>
  );
}

export function Chip({ tono, children }: { tono: "verde" | "ambar" | "rojo" | "gris"; children: ReactNode }) {
  const clases = {
    verde: "bg-emerald-400/15 text-emerald-400 ring-emerald-400/40",
    ambar: "bg-amber-400/15 text-amber-400 ring-amber-400/40",
    rojo: "bg-red-400/15 text-red-400 ring-red-400/40",
    gris: "bg-muted text-muted-foreground ring-border",
  }[tono];
  return <span className={cn("inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1", clases)}>{children}</span>;
}

/** Textarea for reasons/notes with a length counter. */
export function CampoTexto({ etiqueta, ayuda, valor, onChange, max = 500 }: { etiqueta: string; ayuda?: string; valor: string; onChange: (v: string) => void; max?: number }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{etiqueta}</span>
      <textarea
        value={valor}
        maxLength={max}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-base shadow-soft outline-none focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
      />
      <span className="flex justify-between text-xs text-muted-foreground">
        <span>{ayuda}</span>
        <span>{valor.length}/{max}</span>
      </span>
    </label>
  );
}

/** Confirmation that stays open (button disabled) while the action runs. */
export function Confirmar({
  abierto,
  onAbierto,
  titulo,
  descripcion,
  boton,
  accion,
}: {
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  titulo: string;
  descripcion?: ReactNode;
  boton: string;
  accion: () => Promise<void>;
}) {
  const [enviando, setEnviando] = useState(false);
  return (
    <AlertDialog open={abierto} onOpenChange={(o) => !enviando && onAbierto(o)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descripcion && <AlertDialogDescription>{descripcion}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <Button
            disabled={enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await accion();
              } finally {
                setEnviando(false);
              }
            }}
          >
            {enviando ? "Enviando…" : boton}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Pestanas<T extends string>({ valor, onChange, opciones }: { valor: T; onChange: (v: T) => void; opciones: [T, string][] }) {
  return (
    <div className="flex gap-2" role="tablist">
      {opciones.map(([v, t]) => (
        <button key={v} type="button" role="tab" aria-selected={valor === v} onClick={() => onChange(v)}
          className={cn("tap-target rounded-full px-4 py-2 text-sm font-semibold", valor === v ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
          {t}
        </button>
      ))}
    </div>
  );
}
