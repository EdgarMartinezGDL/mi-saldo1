import { Share, Smartphone, X } from "lucide-react";
import { useId, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { cerrarInstalacion, esIos, instalada, instalacionCerrada, useInstalacion } from "@/lib/instalacion";

export function InvitarInstalar() {
  const { sesion, conectado } = useAuth();
  const { puedeInstalar, instalar } = useInstalacion();
  const [rechazada, setRechazada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const id = useId();
  if (typeof window === "undefined" || sesion?.contexto.rol !== "cliente" || conectado === false || instalada() || instalacionCerrada()) return null;
  const ios = esIos();
  if (!ios && !puedeInstalar && !rechazada && !ocupado) return null;
  return <section aria-labelledby={id} className="relative rounded-xl bg-card p-4 ring-1 ring-border">
    <Button variant="ghost" size="icon" className="absolute right-1 top-1 size-11" aria-label="Cerrar aviso de instalación" onClick={cerrarInstalacion}><X /></Button>
    <div className="flex items-start gap-3 pr-8">
      <Smartphone aria-hidden="true" className="size-6 shrink-0" />
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold">Instala Mi Saldo Vip para recibir tus promociones</h2>
        {ios ? <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-muted-foreground">
          <li>Toca <strong>Compartir</strong> <Share aria-hidden="true" className="inline size-4" /> abajo en Safari</li>
          <li>Elige <strong>Agregar a inicio</strong></li>
        </ol> : <>
          <p className="mt-2 text-sm text-muted-foreground">Ábrela desde tu pantalla de inicio, como cualquier app.</p>
          <Button className="mt-3 min-h-12 text-base" disabled={ocupado || !puedeInstalar} onClick={async () => {
            setOcupado(true);
            const resultado = await instalar();
            setRechazada(resultado !== "aceptada");
            setOcupado(false);
          }}>Instalar</Button>
        </>}
      </div>
    </div>
  </section>;
}