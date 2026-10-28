import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, MessageCircle, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { fichaNegocio } from "@/lib/api/cliente";
import { DIAS_SEMANA, enlaceMapa, textoEstadoHorario } from "@/lib/api/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/mi-negocio")({
  head: () => ({ meta: [
    { title: "Mi negocio · MiSaldo" },
    { name: "description", content: "Horario, ubicación y teléfono del negocio donde juntas tu saldo." },
    { property: "og:title", content: "Mi negocio · MiSaldo" },
    { property: "og:description", content: "Consulta el horario, la dirección y el contacto de tu negocio." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <RequiereSesion titulo="Mi negocio" roles={["cliente"]}><Ficha /></RequiereSesion>,
});

function Ficha() {
  const { sesion } = useAuth();
  const ficha = useQuery({ queryKey: ["cliente-ficha-negocio", sesion?.contexto.negocio_id], queryFn: fichaNegocio, enabled: !!sesion, retry: false });
  const f = ficha.data;
  return <AppShell>
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" className="h-12 self-start"><Link to="/"><ArrowLeft className="size-4" />Inicio</Link></Button>
      {ficha.isPending ? <Cargando /> : ficha.isError ? <div>
        <p className="text-muted-foreground">{ficha.error instanceof ApiError ? ficha.error.message : "No se pudo cargar."}</p>
        <Button className="mt-3 h-12" onClick={() => void ficha.refetch()}>Reintentar</Button>
      </div> : f ? <>
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <div className="flex items-center gap-4">
            {f.logo_url ? <img src={f.logo_url} alt={f.nombre_comercial} className="size-16 shrink-0 rounded-2xl object-cover" /> : <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-secondary text-2xl font-semibold">{f.nombre_comercial.charAt(0)}</div>}
            <div className="min-w-0">
              <h1 className="break-words text-2xl font-semibold">{f.nombre_comercial}</h1>
              {f.giro !== null && <p className="text-sm text-muted-foreground">{f.giro}</p>}
            </div>
          </div>
          <p className={cn("mt-4 w-fit rounded-lg px-3 py-2 text-sm font-medium", f.abierto_ahora === true ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground")}>{textoEstadoHorario(f)}</p>
        </section>
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold">Horario</h2>
          {!f.horario_publicado ? <p className="mt-3 text-muted-foreground">Este negocio aún no publica su horario.</p> : <ul className="mt-3 flex flex-col gap-1">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const h = f.horarios.find((h) => h.dia_semana === d);
              return <li key={d} className={cn("flex justify-between gap-3 px-2 py-2 text-sm", d === f.hoy_dia_semana && "rounded-lg bg-secondary font-semibold")}>
                <span className="shrink-0">{DIAS_SEMANA[d]}{d === f.hoy_dia_semana && <span className="ml-2 text-xs">Hoy</span>}</span>
                <span className="text-right">{!h || h.cerrado ? "Cerrado" : <>{h.hora_apertura} a {h.hora_cierre}{h.hora_cierre && h.hora_apertura && h.hora_cierre < h.hora_apertura ? " (del día siguiente)" : ""}</>}</span>
              </li>;
            })}
          </ul>}
          {f.zona_horaria !== Intl.DateTimeFormat().resolvedOptions().timeZone && <p className="mt-3 break-words text-xs text-muted-foreground">Horario en la zona del negocio ({f.zona_horaria}).</p>}
        </section>
        {f.direccion !== null && <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold">Ubicación</h2>
          <p className="mt-3 break-words text-base">{f.direccion}</p>
          <Button asChild variant="secondary" className="mt-3 h-12"><a href={enlaceMapa(f.nombre_comercial, f.direccion)} target="_blank" rel="noopener noreferrer"><MapPin className="size-4" />Cómo llegar</a></Button>
        </section>}
        {f.telefono_contacto !== null && <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold">Contacto</h2>
          <p className="mt-3 break-words text-base">{f.telefono_contacto}</p>
          <div className="mt-3 flex flex-wrap gap-3">
            <Button asChild className="h-12"><a href={"tel:" + f.telefono_contacto}><Phone className="size-4" />Llamar</a></Button>
            {f.telefono_es_whatsapp && <Button asChild variant="secondary" className="h-12"><a href={"https://wa.me/" + f.telefono_contacto.slice(1)} target="_blank" rel="noopener noreferrer"><MessageCircle className="size-4" />WhatsApp</a></Button>}
          </div>
        </section>}
        {f.direccion === null && f.telefono_contacto === null && <section className="rounded-2xl bg-card p-5 ring-1 ring-border">El negocio aún no agrega su dirección ni su teléfono.</section>}
      </> : null}
    </div>
  </AppShell>;
}