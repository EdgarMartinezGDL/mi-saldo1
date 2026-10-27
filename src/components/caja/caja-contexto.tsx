import { Tecla } from "./teclado";
import { createContext, useContext, useRef, type ReactNode } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ApiError, nuevaLlave, type Rol } from "@/lib/api/client";
import type { ClienteCaja, ConfiguracionCaja } from "@/lib/api/caja";
import { fechaCorta, pesos } from "@/lib/api/formato";

/** Thrown when the cashier dismisses the PIN POS prompt of an interrupted operation. */
export class OperacionCancelada extends Error {}

export interface CajaCtx {
  config: ConfiguracionCaja;
  moneda: string;
  zona: string;
  rol: Rol;
  /** Runs a caja call; on 423 asks for the PIN POS and retries the same call (same body, same key). */
  ejecutar: <T>(fn: () => Promise<T>) => Promise<T>;
  recargarConfig: () => void;
}

const Ctx = createContext<CajaCtx | null>(null);
export const CajaProvider = ({ valor, children }: { valor: CajaCtx; children: ReactNode }) => <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
export function useCaja() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCaja fuera de la caja");
  return c;
}

/** Same idempotency key while the operation data is unchanged; reset after success. */
export function useLlave() {
  const ref = useRef<{ firma: string; key: string } | null>(null);
  return {
    para: (datos: unknown) => {
      const firma = JSON.stringify(datos);
      if (ref.current?.firma !== firma) ref.current = { firma, key: nuevaLlave() };
      return ref.current.key;
    },
    terminar: () => { ref.current = null; },
  };
}

export const nombreCliente = (c: ClienteCaja["cliente"]) => [c.nombre, c.apellido_paterno].filter(Boolean).join(" ");

/** Error toast with the extra hints the caja spec asks for. Silent for cancel / membership block. */
export function avisarError(e: unknown, moneda = "MXN") {
  if (e instanceof OperacionCancelada) return;
  const err = e instanceof ApiError ? e : null;
  if (err?.codigo === "membresia_vencida") return;
  let desc: string | undefined;
  const x = err?.extras ?? {};
  if (typeof x["intentos_restantes"] === "number") desc = `Te quedan ${x["intentos_restantes"]} intentos.`;
  if (err?.codigo === "saldo_insuficiente" && typeof x["saldo_centavos"] === "number") desc = `Disponible: ${pesos(x["saldo_centavos"] as number, moneda)}.`;
  if (err?.codigo === "tarjeta_vencida" && typeof x["fecha_vencimiento"] === "string") desc = `El premio venció el ${fechaCorta(x["fecha_vencimiento"] as string)}.`;
  if (err?.codigo === "limite_pendientes") desc = "El cliente ya tiene 3 reclamaciones pendientes.";
  if (err?.codigo === "fecha_fuera_de_plazo") desc = "Solo compras de los últimos 30 días.";
  if (err?.status === 0) desc = "No se aplicó nada. Puedes reintentar con seguridad.";
  toast.error(err?.message ?? "Algo salió mal. Intenta de nuevo.", { description: desc });
}

/** Explicit confirmation before any value operation. */
export function Confirmar({ abierto, titulo, detalle, accion, ocupado, onConfirmar, onCancelar }: {
  abierto: boolean; titulo: string; detalle?: string; accion: string; ocupado: boolean; onConfirmar: () => void; onCancelar: () => void;
}) {
  const accionRef = useRef<HTMLButtonElement>(null);
  const abiertoEn = useRef(0);
  return (
    <AlertDialog open={abierto} onOpenChange={(o) => { if (!o && !ocupado) onCancelar(); }}>
      <AlertDialogContent onOpenAutoFocus={(e) => {
        abiertoEn.current = Date.now();
        e.preventDefault(); accionRef.current?.focus();
      }}>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-2xl">{titulo}</AlertDialogTitle>
          {detalle && <AlertDialogDescription className="text-base">{detalle}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2">
          <AlertDialogCancel disabled={ocupado} className="h-14 text-base">Cancelar<Tecla>Esc</Tecla></AlertDialogCancel>
          <Button ref={accionRef} size="lg" className="h-14 text-base" disabled={ocupado} onClick={onConfirmar}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.repeat || Date.now() - abiertoEn.current < 400)) e.preventDefault(); }}>
            {ocupado ? "Procesando…" : accion}<Tecla>Enter</Tecla>
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Big step header with an optional back button. */
export function EncabezadoPaso({ titulo, subtitulo, onVolver }: { titulo: string; subtitulo?: string; onVolver?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1>
        {subtitulo && <p className="mt-1 text-base text-muted-foreground">{subtitulo}</p>}
      </div>
      {onVolver && <Button variant="outline" size="lg" onClick={onVolver}>Volver<Tecla>Esc</Tecla></Button>}
    </div>
  );
}

export const soloMonto = (v: string) => v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
