import { useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { createFileRoute } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ConConfig, mostrarError, SeccionNegocio, useConfigNegocio } from "@/components/negocio/comun";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ConfiguracionNegocio } from "@/lib/api/caja";
import { cambiarPinPos } from "@/lib/api/dueno";

export const Route = createFileRoute("/negocio/pin-pos")({
  validateSearch: validarBusquedaAsistente,
  head: () => ({
    meta: [
      { title: "PIN POS · MiSaldo" },
      { name: "description", content: "Define o cambia el PIN con el que tus cajeros abren la caja." },
      { property: "og:title", content: "PIN POS · MiSaldo" },
      { property: "og:description", content: "El PIN POS abre la caja de tu negocio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="PIN POS" descripcion="Con este PIN se abre la caja en el mostrador.">
      <ConConfig>{(c) => <PinPos cfg={c} />}</ConConfig>
    </SeccionNegocio>
  ),
});

function PinPos({ cfg }: { cfg: ConfiguracionNegocio }) {
  const invalidarAsistente = useInvalidarAsistente();
  const conTotp = useConTotp();
  const { actualizar } = useConfigNegocio();
  const [pin, setPin] = useState("");
  const [pinPos, setPinPos] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const definido = cfg.negocio.pin_pos_configurado;

  const guardar = async () => {
    setOcupado(true);
    try {
      const r = await conTotp(() => cambiarPinPos(pin, pinPos));
      invalidarAsistente();
      toast.success(r.primera_vez ? "PIN POS definido" : "PIN POS actualizado", {
        description: "Los cajeros tendrán que abrir su caja con el PIN nuevo.",
      });
      setPin("");
      setPinPos("");
      actualizar((c) => ({ ...c, negocio: { ...c.negocio, pin_pos_configurado: true } }));
    } catch (e) {
      mostrarError(e);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Lock className="size-5" /> PIN POS</h2>
      <p className={definido ? "mt-1 text-sm text-muted-foreground" : "mt-2 rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive"}>
        {definido ? "Cambiarlo cierra la caja de todos los cajeros." : "Aún no lo defines: nadie puede abrir la caja."}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="pin" className="text-base">Tu PIN de acceso</Label>
          <Input id="pin" type="password" inputMode="numeric" maxLength={128} value={pin} onChange={(e) => setPin(e.target.value)} className="h-14 text-center font-mono text-xl tracking-[0.4em]" />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="pinpos" className="text-base">Nuevo PIN POS</Label>
          <Input id="pinpos" type="password" inputMode="numeric" maxLength={6} value={pinPos} onChange={(e) => setPinPos(e.target.value.replace(/\D/g, ""))} className="h-14 text-center font-mono text-xl tracking-[0.4em]" />
        </div>
      </div>
      <Button size="lg" className="tap-target mt-5 h-14 w-full text-base sm:w-auto sm:px-8" disabled={pin.length < 4 || pinPos.length !== 6 || ocupado} onClick={() => void guardar()}>
        {ocupado ? "Guardando…" : definido ? "Cambiar PIN POS" : "Definir PIN POS"}
      </Button>
    </section>
  );
}
