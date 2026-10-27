import { Copy, Download } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { guardarArchivo } from "@/lib/api/client";

/** One-time display of backup codes: copy, download, and "Ya los guardé" before continuing. */
export function CodigosRespaldo({ codigos, boton, onListo }: { codigos: string[]; boton: string; onListo: () => void }) {
  const [guardados, setGuardados] = useState(false);
  const texto = codigos.join("\n");
  return (
    <div className="grid gap-3">
      <p className="rounded-xl bg-warn/10 p-3 text-sm font-medium text-warn">
        Guárdalos en un lugar seguro: cada uno sirve una sola vez si pierdes tu teléfono. No los volveremos a mostrar.
      </p>
      <ul className="grid grid-cols-2 gap-2 font-mono text-base">
        {codigos.map((c) => <li key={c} className="rounded-lg bg-secondary px-3 py-2 text-center">{c}</li>)}
      </ul>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="secondary" size="lg" onClick={() => void navigator.clipboard.writeText(texto).then(() => toast.success("Códigos copiados"))}>
          <Copy className="size-4" /> Copiar todos
        </Button>
        <Button type="button" variant="secondary" size="lg"
          onClick={() => guardarArchivo({ blob: new Blob([`Códigos de respaldo de MiSaldo\n\n${texto}\n`], { type: "text/plain" }), nombre: "misaldo-codigos-respaldo.txt" })}>
          <Download className="size-4" /> Descargar
        </Button>
      </div>
      <label className="flex items-center gap-3 rounded-xl bg-secondary px-4 py-3 text-base">
        <Checkbox checked={guardados} onCheckedChange={(v) => setGuardados(v === true)} /> Ya los guardé
      </label>
      <Button size="lg" className="h-14 text-base" disabled={!guardados} onClick={onListo}>{boton}</Button>
    </div>
  );
}
