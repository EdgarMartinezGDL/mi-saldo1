import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { aCentavos, pesos } from "@/lib/api/formato";
import { simularMonedero, type Simulacion } from "@/lib/api/marketing";

/** "If your customer buys… they earn…" table for the rate being typed (debounced simulation). */
export function CalculadoraMonedero({ factor }: { factor: string | null }) {
  const [otro, setOtro] = useState("");
  const [sim, setSim] = useState<Simulacion | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const otroCentavos = aCentavos(otro);

  useEffect(() => {
    let vigente = true;
    const t = setTimeout(async () => {
      try {
        const base = await simularMonedero(factor ? { factor_cashback: factor } : {});
        const extra = otroCentavos > 0 ? await simularMonedero({ ...(factor ? { factor_cashback: factor } : {}), montos_centavos: [otroCentavos] }) : null;
        if (!vigente) return;
        setSim({ factor_cashback: base.factor_cashback, ejemplos: [...base.ejemplos, ...(extra?.ejemplos ?? [])] });
        setAviso(null);
      } catch (e) {
        if (!vigente) return;
        setSim(null);
        setAviso(e instanceof ApiError && e.codigo === "sin_configuracion" ? "Escribe un porcentaje para ver ejemplos." : "No pudimos calcular los ejemplos.");
      }
    }, 400);
    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [factor, otroCentavos]);

  return (
    <div className="mt-6 rounded-xl p-4 ring-1 ring-border">
      <h3 className="text-base font-semibold">Calculadora</h3>
      {aviso ? (
        <p className="mt-2 text-sm text-muted-foreground">{aviso}</p>
      ) : sim ? (
        <table className="mt-3 w-full text-base">
          <thead>
            <tr className="text-left text-sm text-muted-foreground">
              <th className="pb-2 font-medium">Si tu cliente compra…</th>
              <th className="pb-2 text-right font-medium">gana…</th>
            </tr>
          </thead>
          <tbody>
            {sim.ejemplos.map((e, i) => (
              <tr key={`${e.monto_compra_centavos}-${i}`} className="border-t border-border">
                <td className="py-2 font-mono tabular-nums">{pesos(e.monto_compra_centavos)}</td>
                <td className="py-2 text-right font-mono font-semibold tabular-nums text-primary">{pesos(e.monedero_centavos)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">Calculando…</p>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <Label htmlFor="otro-monto" className="text-base">Otro monto (opcional)</Label>
        <Input id="otro-monto" inputMode="decimal" value={otro} onChange={(e) => setOtro(e.target.value.replace(/[^\d.]/g, ""))} placeholder="150" className="h-12 text-base" />
      </div>
    </div>
  );
}
