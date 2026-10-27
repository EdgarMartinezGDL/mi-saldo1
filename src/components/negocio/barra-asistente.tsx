import { Link, useLocation } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { EstadoPaso, PASOS_ASISTENTE, pasosVisibles, useAsistente } from "./asistente";

export function BarraAsistente() {
  const location = useLocation();
  const activa = new URLSearchParams(location.searchStr).get("asistente") === "1";
  if (!activa || !Object.values(PASOS_ASISTENTE).some((p) => p.to === location.pathname)) return null;
  return <BarraActiva pathname={location.pathname} />;
}

function BarraActiva({ pathname }: { pathname: string }) {
  const { data } = useAsistente();
  if (!data) return null;
  const pasos = pasosVisibles(data);
  const index = pasos.findIndex((p) => PASOS_ASISTENTE[p.paso].to === pathname);
  const paso = pasos[index];
  if (!paso) return null;
  const siguiente = pasos[index + 1];
  return <section className="flex flex-col gap-3 rounded-xl bg-secondary p-4 shadow-soft" aria-label="Asistente de configuración">
    <p className="font-semibold">Paso {index + 1} de {pasos.length} · {PASOS_ASISTENTE[paso.paso].titulo}</p>
    <EstadoPaso paso={paso} />
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" asChild className="h-auto min-h-11 whitespace-normal"><Link to="/negocio/asistente">Volver al asistente</Link></Button>
      <Button asChild><Link to={siguiente ? PASOS_ASISTENTE[siguiente.paso].to : "/negocio/asistente"} search={siguiente ? { asistente: 1 } : {}}>
        {!paso.obligatorio && !paso.completo ? "Omitir" : "Siguiente"}
      </Link></Button>
    </div>
  </section>;
}