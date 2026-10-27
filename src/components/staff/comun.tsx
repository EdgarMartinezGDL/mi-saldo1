import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { miembrosStaff, miSesion } from "@/lib/api/staff";

/** Staff level of the signed-in person (admin writes, soporte only reads). Kept in React Query memory only. */
export function useNivelStaff() {
  const { data } = useQuery({
    queryKey: ["nivel-staff"],
    queryFn: async () => {
      const [s, m] = await Promise.all([miSesion(), miembrosStaff()]);
      return m.miembros.find((x) => x.persona_id === s.persona_id)?.nivel ?? "soporte";
    },
    staleTime: 5 * 60_000,
  });
  return { nivel: data ?? null, esAdmin: data === "admin" };
}

/** Error toast for Staff screens: own text per 400 code; 409s show the API's Spanish message. */
export function errorStaff(e: unknown, propios: Record<string, string> = {}, mostrarMensaje = false) {
  const err = e instanceof ApiError ? e : null;
  if (err?.codigo === "totp_cancelado") return;
  if (err?.codigo === "sin_permiso") return void toast.error("Solo un administrador de Staff puede hacer esto.");
  const crudo = typeof err?.extras["message"] === "string" ? (err.extras["message"] as string) : null;
  const texto =
    (mostrarMensaje && (crudo || (Array.isArray(err?.extras["message"]) ? err.extras["message"].filter((m): m is string => typeof m === "string").join("; ") : null))) ||
    (err?.codigo && propios[err.codigo]) ||
    (err?.status === 409 && crudo && crudo !== err.codigo ? crudo : null) ||
    (err?.status === 400 ? "Revisa los datos del formulario" : null) ||
    err?.message ||
    "Algo salió mal. Intenta de nuevo.";
  toast.error(texto);
}

export const ZONAS: [string, string][] = [
  ["America/Mexico_City", "Centro (Ciudad de México)"],
  ["America/Cancun", "Quintana Roo (Cancún)"],
  ["America/Merida", "Mérida"],
  ["America/Monterrey", "Monterrey"],
  ["America/Chihuahua", "Chihuahua"],
  ["America/Mazatlan", "Mazatlán"],
  ["America/Hermosillo", "Sonora (Hermosillo)"],
  ["America/Tijuana", "Baja California (Tijuana)"],
  ["America/Matamoros", "Matamoros"],
  ["America/Ojinaga", "Ojinaga"],
  ["America/Bahia_Banderas", "Bahía de Banderas"],
];

/** Select of Mexican time zones plus "Otra…" with free IANA text. */
export function SelectorZona({ valor, onChange, id }: { valor: string; onChange: (v: string) => void; id: string }) {
  const conocida = ZONAS.some(([z]) => z === valor);
  const [otra, setOtra] = useState(!conocida);
  return (
    <div className="flex flex-col gap-2">
      <select id={id} value={otra ? "__otra" : valor}
        onChange={(e) => { if (e.target.value === "__otra") { setOtra(true); onChange(""); } else { setOtra(false); onChange(e.target.value); } }}
        className="h-11 rounded-md border border-input bg-background px-3 text-base">
        {ZONAS.map(([z, l]) => <option key={z} value={z}>{l}</option>)}
        <option value="__otra">Otra…</option>
      </select>
      {otra && (
        <input aria-label="Zona horaria IANA" placeholder="America/Bogota" value={valor} onChange={(e) => onChange(e.target.value.trim())}
          className="h-11 rounded-md border border-input bg-background px-3 font-mono text-sm" />
      )}
    </div>
  );
}

/** Confirmation with an optional mandatory reason (5–500). The button stays disabled while sending. */
export function ConfirmarMotivo({
  abierto, onAbierto, titulo, descripcion, boton, pideMotivo = true, extra, listo = true, accion, destructivo,
  nota = "De 5 a 500 caracteres. El dueño recibe un aviso.", etiqueta = "Motivo",
}: {
  nota?: string;
  etiqueta?: string;
  abierto: boolean;
  onAbierto: (v: boolean) => void;
  titulo: string;
  descripcion?: ReactNode;
  boton: string;
  pideMotivo?: boolean;
  extra?: ReactNode;
  listo?: boolean;
  destructivo?: boolean;
  accion: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const m = motivo.trim();
  const ok = listo && (!pideMotivo || (m.length >= 5 && m.length <= 500));
  return (
    <AlertDialog open={abierto} onOpenChange={(o) => { if (!enviando) { onAbierto(o); if (!o) setMotivo(""); } }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descripcion && <AlertDialogDescription>{descripcion}</AlertDialogDescription>}
        </AlertDialogHeader>
        {extra}
        {pideMotivo && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cm-motivo">{etiqueta}</Label>
            <Textarea id="cm-motivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Canal y folio, p. ej. WhatsApp WA-000456" />
            <p className="text-xs text-muted-foreground">{nota}</p>
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={enviando}>Cancelar</AlertDialogCancel>
          <Button variant={destructivo ? "destructive" : "default"} disabled={!ok || enviando}
            onClick={async () => {
              setEnviando(true);
              try {
                await accion(m);
                setMotivo("");
              } catch (e) {
                // A definitive 4xx closes the dialog (the reason is kept); the toast was already shown by the caller.
                if (e instanceof ApiError && e.status >= 400 && e.status < 500 && e.codigo !== "requiere_totp_reciente") onAbierto(false);
              } finally {
                setEnviando(false);
              }
            }}>
            {enviando ? "Enviando…" : boton}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export const NOTA_AUDITORIA = "De 5 a 500 caracteres. Queda en la auditoría.";

/** Cross-tab navigation inside /staff (open a person's record, open the filtered audit). */
export type FiltroAuditoria = { negocio_id?: string; persona_id?: string; etiqueta: string };
type Nav = { irA: (t: string) => void; verFicha: (personaId: string) => void; verAuditoria: (f: FiltroAuditoria) => void };
export const StaffNav = createContext<Nav>({ irA: () => {}, verFicha: () => {}, verAuditoria: () => {} });
export const useStaffNav = () => useContext(StaffNav);
