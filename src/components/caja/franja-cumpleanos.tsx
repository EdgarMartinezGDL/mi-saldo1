import { Cake } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { anularCumpleanos, entregarCumpleanos, fechaCumple, type CumpleanosCaja } from "@/lib/api/cumpleanos";
import { avisarError, Confirmar, useCaja } from "./caja-contexto";

const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });

/**
 * Claude (2026-11-20, backend 0061): franja del beneficio de cumpleaños en la
 * ficha de Caja. Solo aparece si hoy le aplica al cliente (o ya lo recibió).
 * Entregar pide confirmación; anular ("no se entregó") es solo del dueño,
 * el mismo día y con motivo.
 */
export function FranjaCumpleanos({ cumple, nombre, onRefrescar }: { cumple: CumpleanosCaja; nombre: string; onRefrescar: () => Promise<void> }) {
  const { ejecutar, moneda } = useCaja();
  const { sesion } = useAuth();
  const dueno = sesion?.contexto.rol === "dueno";
  const [confirmando, setConfirmando] = useState(false);
  const [anulando, setAnulando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const dia = fechaCumple(cumple.cumpleanos_dia, cumple.cumpleanos_mes);

  const entregar = async () => {
    if (ocupado) return;
    setOcupado(true);
    try {
      const r = await ejecutar(() => entregarCumpleanos(cumple.negocio_cliente_id));
      toast.success(`Listo: ${r.beneficio}`);
      setConfirmando(false);
      await onRefrescar();
    } catch (e) {
      setConfirmando(false);
      if (e instanceof ApiError && e.status === 409) {
        toast.info(e.message || "Este cliente ya recibió su beneficio de cumpleaños");
        await onRefrescar();
      } else avisarError(e, moneda);
    } finally { setOcupado(false); }
  };

  const anular = async () => {
    if (ocupado || cumple.estado !== "entregado" || motivo.trim().length < 3) return;
    setOcupado(true);
    try {
      await ejecutar(() => anularCumpleanos(cumple.entrega_id, motivo.trim()));
      toast.success("Entrega anulada");
      setAnulando(false); setMotivo("");
      await onRefrescar();
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) toast.info(e.message || "Ya no se puede anular");
      else avisarError(e, moneda);
    } finally { setOcupado(false); }
  };

  return (
    <div className="rounded-2xl bg-primary/10 p-4 ring-1 ring-primary/40">
      <p className="flex items-center gap-2 text-xl font-semibold"><Cake className="size-8 shrink-0" /> Cumpleaños de {nombre} ({dia})</p>
      {cumple.estado === "disponible" && <>
        <p className="mt-2 text-base">Beneficio: <strong>{cumple.beneficio}</strong></p>
        <Button className="mt-3 min-h-14 h-auto w-full whitespace-normal py-3 text-lg" disabled={ocupado} onClick={() => setConfirmando(true)}>
          Entregar beneficio de cumpleaños
        </Button>
      </>}
      {cumple.estado === "entregado" && <>
        <p className="mt-2 text-base">Ya recibió su beneficio de cumpleaños hoy a las {hora(cumple.entregado_en)} ({cumple.entregado_por}): {cumple.beneficio}.</p>
        {dueno && cumple.anulable_hoy && (
          <Button variant="link" className="mt-1 min-h-11 px-0 text-(--primary-etiqueta)" disabled={ocupado} onClick={() => setAnulando(true)}>Anular: no se entregó</Button>
        )}
      </>}
      {cumple.estado === "no_disponible" && <p className="mt-2 text-base">Su beneficio de cumpleaños ya no está disponible este año.</p>}

      <Confirmar abierto={confirmando} titulo={`¿Entregar el beneficio a ${nombre}?`}
        {...(cumple.estado === "disponible" ? { detalle: `${cumple.beneficio}. Solo se puede entregar una vez este año en tu negocio.` } : {})}
        accion="Sí, entregar" ocupado={ocupado} onConfirmar={() => void entregar()} onCancelar={() => setConfirmando(false)} />

      <Dialog open={anulando} onOpenChange={(o) => { if (!ocupado) { setAnulando(o); if (!o) setMotivo(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anular la entrega</DialogTitle>
            <DialogDescription>Úsalo solo si el beneficio no se entregó. Queda registrado quién lo anuló y por qué.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="motivo-anulacion">Motivo</Label>
            <Input id="motivo-anulacion" value={motivo} maxLength={200} disabled={ocupado} onChange={(e) => setMotivo(e.target.value)} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={ocupado} onClick={() => { setAnulando(false); setMotivo(""); }}>Cancelar</Button>
            <Button disabled={ocupado || motivo.trim().length < 3} onClick={() => void anular()}>Anular entrega</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
