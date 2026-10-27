import { CheckCircle2, UserRound, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tecla, useTecla } from "./teclado";
import type { Comprobante } from "./paso-operacion";

export function PasoComprobante({ comprobante, nombre, onNuevo, onSeguir }: { comprobante: Comprobante; nombre: string | null; onNuevo: () => void; onSeguir: () => void }) {
  useTecla((e) => {
    if (e.key === "Enter") { if (nombre) onSeguir(); else onNuevo(); return true; }
    if (e.key.toLowerCase() === "n") { onNuevo(); return true; }
    return false;
  });
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div className="rounded-2xl bg-primary/10 p-6 text-center ring-1 ring-primary/40">
        <CheckCircle2 className="mx-auto size-14 text-primary" />
        <p className="mt-3 text-2xl font-semibold">{comprobante.titulo}</p>
        {comprobante.lineas.map((l) => <p key={l} className="mt-2 text-lg text-muted-foreground">{l}</p>)}
      </div>
      <Button size="lg" className="h-16 w-full text-xl" onClick={onNuevo}><Users className="size-6" /> Nuevo cliente<Tecla>N</Tecla></Button>
      {nombre && <Button size="lg" variant="outline" className="h-16 w-full text-xl" onClick={onSeguir}><UserRound className="size-6" /> Seguir con {nombre}<Tecla>Enter</Tecla></Button>}
    </div>
  );
}
