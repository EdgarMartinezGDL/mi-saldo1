import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronRight, Megaphone } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { diaMes } from "@/lib/api/formato";
import { promocionesVigentes, type PromocionVigente } from "@/lib/api/push";

/** Only internal routes ("/algo", never "//host" or "https://"). */
export const rutaInterna = (ruta: string) => /^\/[A-Za-z0-9/_-]*$/.test(ruta) && !ruta.includes("//");

const VISIBLES = 3;

/** P47: active promotions of the CURRENT business on the client's home. Hidden when there are none or the API fails. */
export function PromocionesVigentes() {
  const { sesion, conectado } = useAuth();
  const negocioId = sesion?.contexto.negocio_id;
  const [todas, setTodas] = useState(false);
  const q = useQuery({
    queryKey: ["promociones-vigentes", negocioId],
    queryFn: promocionesVigentes,
    enabled: !!negocioId && sesion?.contexto.rol === "cliente" && conectado !== false,
    refetchOnWindowFocus: true,
    retry: false,
  });
  if (q.isError || !q.data) return null;
  const propias = (q.data.promociones ?? []).filter((p) => p.negocio_id === negocioId);
  if (propias.length === 0) return null;
  const mostradas = todas ? propias : propias.slice(0, VISIBLES);
  return (
    <section aria-labelledby="promociones-titulo" className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 id="promociones-titulo" className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Megaphone className="size-5 text-primary-texto" aria-hidden="true" /> Promociones
      </h2>
      <ul className="mt-3 flex flex-col divide-y divide-separador">
        {mostradas.map((p) => <li key={p.promocion_id}><Renglon p={p} /></li>)}
      </ul>
      {propias.length > VISIBLES && !todas && (
        <Button variant="link" className="mt-1 min-h-11 px-0" onClick={() => setTodas(true)}>Ver todas ({propias.length})</Button>
      )}
    </section>
  );
}

function Renglon({ p }: { p: PromocionVigente }) {
  const cuerpo = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{p.titulo}</span>
        <span className="block text-sm">{p.cuerpo}</span>
        <span className="mt-1 block text-sm text-muted-foreground">Válida hasta el {diaMes(p.vigente_hasta)}</span>
      </span>
      {p.ruta !== "/" && rutaInterna(p.ruta) && <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );
  if (p.ruta !== "/" && rutaInterna(p.ruta)) {
    return <Link to={p.ruta} className="tap-target flex items-center gap-3 py-3 hover:text-primary-texto">{cuerpo}</Link>;
  }
  return <div className="flex items-center gap-3 py-3">{cuerpo}</div>;
}
