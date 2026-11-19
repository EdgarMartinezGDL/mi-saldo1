import type { CSSProperties } from "react";
import { Check } from "lucide-react";
import { useMiSaldo } from "@/components/misaldo-provider";
import { Button } from "@/components/ui/button";
import { FONDOS } from "@/lib/fondos";
import { cn } from "@/lib/utils";

export function SelectorFondo() {
  const { fondo, setFondo } = useMiSaldo();
  return <div className="space-y-3">
    <h3 className="text-base font-medium">Fondo</h3>
    {(["claro", "oscuro"] as const).map((modo) => <div key={modo}>
      <p className="mb-3 text-sm text-muted-foreground">{modo === "claro" ? "Claros" : "Oscuros"}</p>
      <div className="flex flex-wrap gap-3">
        {FONDOS.filter((f) => f.modo === modo).map((f) => {
          const elegido = fondo === f.id;
          const colores = f.colores ?? f;
          return <div key={f.id} className="flex w-14 flex-col items-center gap-2">
            <Button type="button" variant="ghost" aria-label={`Fondo ${f.nombre}`} aria-pressed={elegido}
              onClick={() => setFondo(f.id)}
              style={{ "--muestra-fondo": colores.background, "--muestra-card": colores.card } as CSSProperties}
              className={cn("relative size-14 shrink-0 rounded-xl bg-[var(--muestra-fondo)] p-0 hover:bg-[var(--muestra-fondo)]", elegido && "ring-2 ring-foreground ring-offset-2 ring-offset-card")}>
              <span className="grid size-8 place-items-center rounded-full bg-[var(--muestra-card)]">
                {elegido && <Check className={cn("size-5", f.modo === "claro" ? "text-qr-texto" : "text-qr-fondo")} />}
              </span>
            </Button>
            <span className="text-center text-sm leading-tight">{f.nombre}</span>
          </div>;
        })}
      </div>
    </div>)}
  </div>;
}