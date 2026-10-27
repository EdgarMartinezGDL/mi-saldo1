import { LockKeyhole } from "lucide-react";
import { useState } from "react";
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cerrarCaja } from "@/lib/api/caja";
import { avisarError } from "./caja-contexto";
import { useConMouse, useTecla } from "./teclado";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const hora = (iso: string | null, zona: string) =>
  iso ? new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", hour12: false, timeZone: zona }).format(new Date(iso)) : null;

/** Thin always-visible strip: open until, plus "Cerrar caja" with confirmation. */
export function FranjaCaja({ venceEn, zona, gracia, onCerrada }: { venceEn: string | null; zona: string; gracia: boolean; onCerrada: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const conMouse = useConMouse();
  const [ayuda, setAyuda] = useState(false);
  useTecla((e) => { if (e.key === "?") { setAyuda(true); return true; } return false; }, { activo: !ocupado });
  const h = hora(venceEn, zona);
  const cerrar = async () => {
    setOcupado(true);
    try {
      await cerrarCaja();
      setAbierto(false);
      onCerrada();
    } catch (e) {
      avisarError(e);
    } finally {
      setOcupado(false);
    }
  };
  return (
    <div className="mb-5 flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-primary/10 px-4 py-2 ring-1 ring-primary/30">
        <p className="flex items-center gap-2 text-sm font-medium">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          {h ? `Caja abierta hasta las ${h}` : "Caja abierta"}
        </p>
        <div className="flex items-center gap-2">
        {conMouse && <Button variant="outline" size="sm" className="h-11" onClick={() => setAyuda(true)}>Atajos (?)</Button>}
        <Button variant="outline" size="sm" className="h-11" onClick={() => setAbierto(true)}>
          <LockKeyhole className="size-4" /> Cerrar caja
        </Button>
        </div>
      </div>
      {gracia && <p className="rounded-xl bg-warn/10 px-4 py-2 text-sm font-medium text-warn">El negocio tiene un pago pendiente.</p>}
      <Dialog open={ayuda} onOpenChange={setAyuda}>
        <DialogContent>
          <DialogHeader><DialogTitle>Atajos de la caja</DialogTitle><DialogDescription className="sr-only">Atajos de la caja</DialogDescription></DialogHeader>
          <table className="w-full text-left text-sm">
            <thead><tr><th className="py-2 pr-3">Tecla</th><th className="py-2">Qué hace</th></tr></thead>
            <tbody>{[
              ["0–9", "Escribir el teléfono, el PIN POS o el código"],
              ["Retroceso / Supr", "Borrar un dígito / borrar todo"],
              ["Enter", "Buscar, continuar o confirmar"],
              ["Esc", "Volver o cancelar"],
              ["A · C · R", "Acumular · Canjear · Reportar (en la ficha)"],
              ["1 · 2 · 3", "Elegir saldo o tarjeta (si no pide código)"],
              ["+ · −", "Sumar o quitar un sello"],
              ["N", "Nuevo cliente (en el comprobante)"],
              ["?", "Ver esta ayuda"],
            ].map(([tecla, texto]) => <tr key={tecla} className="border-t border-border"><td className="py-2 pr-3 font-mono font-semibold">{tecla}</td><td className="py-2">{texto}</td></tr>)}</tbody>
          </table>
        </DialogContent>
      </Dialog>
      <AlertDialog open={abierto} onOpenChange={(o) => !ocupado && setAbierto(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl">¿Cerrar la caja?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">Para volver a cobrar tendrás que escribir el PIN POS. Tu sesión sigue abierta.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={ocupado} className="h-14 text-base">Cancelar</AlertDialogCancel>
            <Button size="lg" variant="destructive" className="h-14 text-base" disabled={ocupado} onClick={() => void cerrar()}>
              {ocupado ? "Cerrando…" : "Sí, cerrar caja"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
