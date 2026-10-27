import { useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { CalculadoraMonedero } from "@/components/negocio/calculadora-monedero";
import { TarjetasSellos } from "@/components/negocio/tarjetas-sellos";
import { ConConfig, mostrarError, SeccionNegocio } from "@/components/negocio/comun";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfiguracionNegocio } from "@/lib/api/caja";
import { actualizarMonedero } from "@/lib/api/dueno";

export const Route = createFileRoute("/negocio/monedero")({
  validateSearch: validarBusquedaAsistente,
  head: () => ({
    meta: [
      { title: "Monedero y tarjetas de sellos · MiSaldo" },
      { name: "description", content: "Porcentaje de cashback, vigencia del saldo y tarjetas de sellos." },
      { property: "og:title", content: "Monedero y tarjetas de sellos · MiSaldo" },
      { property: "og:description", content: "Configura cuánto regresa tu negocio en cada compra." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Monedero y tarjetas de sellos" descripcion="Lo que gana tu cliente en cada compra.">
      <ConConfig>{(c) => <Monedero cfg={c} />}</ConConfig>
    </SeccionNegocio>
  ),
});

type Valores = { cashback: string; meses: string };

function Monedero({ cfg }: { cfg: ConfiguracionNegocio }) {
  const invalidarAsistente = useInvalidarAsistente();
  const inicial: Valores = {
    cashback: cfg.monedero ? String(Math.round(cfg.monedero.factor_cashback * 100000) / 1000) : "",
    meses: cfg.monedero?.vigencia_dias ? String(Math.round(cfg.monedero.vigencia_dias / 30)) : "",
  };
  const { editando, valores, set, editar, cancelar, terminar, guardado, cambiado, ref } = useModoEdicion(inicial);
  const [ocupado, setOcupado] = useState(false);
  const conMonedero = cfg.modulos.includes("monedero");
  const [sugerencias, setSugerencias] = useState<string[]>([]);
  const factorTexto = (pct: number) => (pct / 100).toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
  const mostrado = editando ? valores : guardado;
  const pctNum = Number(mostrado.cashback);
  const factorVivo = mostrado.cashback && Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100 ? factorTexto(pctNum) : null;

  const guardar = async () => {
    const pct = Number(valores.cashback);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) {
      toast.error("Escribe un porcentaje de cashback entre 0 y 100.");
      return;
    }
    setOcupado(true);
    try {
      const r = await actualizarMonedero({
        factor_cashback: factorTexto(pct),
        vigencia_dias: valores.meses ? Math.round(Number(valores.meses) * 30) : null,
      });
      invalidarAsistente();
      toast.success("Cashback guardado");
      setSugerencias(r.advertencias ?? []);
      terminar(valores);
    } catch (e) {
      mostrarError(e, { factor_invalido: "El porcentaje de cashback no es válido." });
    } finally {
      setOcupado(false);
    }
  };

  return (
    <>
      {conMonedero ? (
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold tracking-tight">Monedero (cashback)</h2>
          {editando ? (
            <div ref={ref} className="mt-4 flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="cashback" className="text-base">Porcentaje de cashback (%)</Label>
                  <Input id="cashback" inputMode="decimal" value={valores.cashback} onChange={(e) => set("cashback", e.target.value.replace(/[^\d.]/g, ""))} placeholder="5" className="h-14 text-base" />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="meses" className="text-base">Vigencia del saldo (meses, vacío = no vence)</Label>
                  <Input id="meses" inputMode="numeric" value={valores.meses} onChange={(e) => set("meses", e.target.value.replace(/\D/g, ""))} placeholder="3" className="h-14 text-base" />
                </div>
              </div>
              <BotonesEdicion textoGuardar="Guardar cashback" ocupado={ocupado} cambiado={cambiado} onGuardar={() => void guardar()} onCancelar={cancelar} />
            </div>
          ) : (
            <VistaLectura
              onEditar={editar}
              datos={[
                { etiqueta: "Porcentaje de cashback", valor: guardado.cashback ? `${guardado.cashback}%` : "—" },
                { etiqueta: "Vigencia del saldo", valor: guardado.meses ? `${guardado.meses} meses` : "No vence" },
              ]}
            />
          )}
          {sugerencias.map((a) => (
            <p key={a} className="mt-3 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-400 ring-1 ring-amber-400/30">Sugerencia: {a}</p>
          ))}
          <CalculadoraMonedero factor={factorVivo} />
        </section>
      ) : (
        <p className="rounded-2xl bg-card p-5 text-muted-foreground ring-1 ring-border">Tu negocio no tiene activado el monedero.</p>
      )}
      <TarjetasSellos cfg={cfg} />
    </>
  );
}
