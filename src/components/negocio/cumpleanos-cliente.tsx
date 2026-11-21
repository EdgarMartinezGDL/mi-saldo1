import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { cambiarFechaCumpleCliente, fechaCumple, fechaCumpleCliente, fechaValida } from "@/lib/api/cumpleanos";

const MESES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleString("es-MX", { month: "long" }));
const claseSelect = "h-12 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Claude (2026-11-20, backend 0061/0063): cumpleaños del cliente en la ficha
 * del dueño. El botón "Cambiar cumpleaños" solo aparece cuando el backend lo
 * permite (`cambio_disponible`); hoy está apagado hasta que exista el aviso
 * al cliente. El cambio solo afecta a este negocio.
 */
export function CumpleanosCliente({ negocioClienteId }: { negocioClienteId: string }) {
  const queryClient = useQueryClient();
  const clave = ["cumple-cliente", negocioClienteId];
  const fecha = useQuery({ queryKey: clave, queryFn: () => fechaCumpleCliente(negocioClienteId), retry: false });
  const [abierto, setAbierto] = useState(false);
  const [dia, setDia] = useState("");
  const [mes, setMes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (!fecha.data) return null;
  const f = fecha.data;
  const valido = !!dia && !!mes && fechaValida(Number(dia), Number(mes));

  const abrir = () => { setDia(f.dia ? String(f.dia) : ""); setMes(f.mes ? String(f.mes) : ""); setError(null); setAbierto(true); };
  const guardar = async () => {
    if (ocupado) return;
    if (!valido) return setError("Esa fecha no existe.");
    setOcupado(true); setError(null);
    try {
      await cambiarFechaCumpleCliente(negocioClienteId, Number(dia), Number(mes));
      toast.success("Cumpleaños actualizado en tu negocio");
      setAbierto(false);
      await queryClient.invalidateQueries({ queryKey: clave });
    } catch (e) {
      setError(e instanceof ApiError && e.status !== 500 ? e.message : "No se pudo guardar. Intenta de nuevo.");
    } finally { setOcupado(false); }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p>Cumpleaños: {f.dia && f.mes ? fechaCumple(f.dia, f.mes) : "sin registrar"}{f.propia ? " (corregido en tu negocio)" : ""}</p>
      {f.cambio_disponible && <Button size="sm" variant="secondary" onClick={abrir}>Cambiar cumpleaños</Button>}
      <Dialog open={abierto} onOpenChange={(o) => { if (!ocupado) setAbierto(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cambiar cumpleaños</DialogTitle>
            <DialogDescription>Solo cambia en tu negocio y solo se puede una vez al año. Hazlo cuando el cliente te lo pida en persona.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cumple-dia">Día</Label>
              <select id="cumple-dia" className={claseSelect} value={dia} disabled={ocupado} onChange={(e) => setDia(e.target.value)}>
                <option value="">Día</option>
                {Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="cumple-mes">Mes</Label>
              <select id="cumple-mes" className={claseSelect} value={mes} disabled={ocupado} onChange={(e) => setMes(e.target.value)}>
                <option value="">Mes</option>
                {MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={ocupado} onClick={() => setAbierto(false)}>Cancelar</Button>
            <Button disabled={ocupado || !valido} onClick={() => void guardar()}>{ocupado ? "Guardando…" : "Guardar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
