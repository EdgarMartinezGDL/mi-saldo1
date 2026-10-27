import { Pencil } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Read-only until "Editar". `guardado` is the saved value; `valores` the draft being edited.
 * `cancelar` restores the saved value; `terminar(nuevo)` returns to reading after a successful save.
 */
export function useModoEdicion<T>(guardado: T) {
  const [base, setBase] = useState<T>(guardado);
  const [valores, setValores] = useState<T>(guardado);
  const [editando, setEditando] = useState(false);
  const firma = JSON.stringify(guardado);
  const previa = useRef(firma);
  useEffect(() => {
    if (previa.current === firma) return;
    previa.current = firma;
    setBase(guardado);
    if (!editando) setValores(guardado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firma]);
  const ref = useDesplazarAlAbrir<HTMLDivElement>(editando, true);
  const editar = useCallback(() => { setValores(base); setEditando(true); }, [base]);
  const cancelar = useCallback(() => { setValores(base); setEditando(false); }, [base]);
  const terminar = useCallback((nuevo?: T) => {
    setValores((v) => { const n = nuevo ?? v; setBase(n); return n; });
    setEditando(false);
  }, []);
  const set = useCallback(<K extends keyof T>(k: K, v: T[K]) => setValores((p) => ({ ...p, [k]: v })), []);
  return { editando, valores, setValores, set, editar, cancelar, terminar, guardado: base, cambiado: !igual(valores, base), ref };
}

export type Dato = { etiqueta: string; valor: ReactNode };

/** Saved values as label + text, with the "Editar" button. */
export function VistaLectura({ datos, onEditar, puedeEditar = true, children }: { datos: Dato[]; onEditar: () => void; puedeEditar?: boolean; children?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <dl className="grid gap-4 sm:grid-cols-2">
        {datos.map((d) => (
          <div key={d.etiqueta} className="min-w-0">
            <dt className="text-sm text-muted-foreground">{d.etiqueta}</dt>
            <dd className="mt-0.5 break-words text-base font-medium">{d.valor === "" || d.valor == null ? "—" : d.valor}</dd>
          </div>
        ))}
      </dl>
      {children}
      {puedeEditar && (
        <Button type="button" variant="outline" size="lg" className="tap-target h-14 w-full text-base sm:w-auto sm:self-start sm:px-8" onClick={onEditar}>
          <Pencil className="size-5" /> Editar
        </Button>
      )}
    </div>
  );
}

/** "Guardar" (keeps the screen's own label) + "Cancelar". Disabled while nothing changed. */
export function BotonesEdicion({ textoGuardar = "Guardar", ocupado, cambiado, onGuardar, onCancelar, textoOcupado = "Guardando…" }: {
  textoGuardar?: string; textoOcupado?: string; ocupado?: boolean; cambiado: boolean; onGuardar: () => void; onCancelar: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Button type="button" size="lg" className="tap-target h-14 w-full text-base sm:w-auto sm:px-8" disabled={ocupado || !cambiado} onClick={onGuardar}>
        {ocupado ? textoOcupado : textoGuardar}
      </Button>
      <Button type="button" variant="outline" size="lg" className="tap-target h-14 w-full text-base sm:w-auto sm:px-8" disabled={ocupado} onClick={onCancelar}>
        Cancelar
      </Button>
    </div>
  );
}
