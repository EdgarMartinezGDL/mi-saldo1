import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { Alerta, TarjetaEnlace } from "@/components/enlace-ui";
import { Button } from "@/components/ui/button";
import { avisoQuery, fechaAviso } from "@/lib/api/privacidad";

export const Route = createFileRoute("/aviso-privacidad")({
  head: () => ({ meta: [
    { title: "Aviso de privacidad · MiSaldo" },
    { name: "description", content: "Consulta el aviso de privacidad vigente de MiSaldo y el contacto para ejercer tus derechos ARCO." },
    { property: "og:title", content: "Aviso de privacidad · MiSaldo" },
    { property: "og:description", content: "Datos personales y derechos ARCO en MiSaldo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: PaginaAviso,
});

function PaginaAviso() {
  const aviso = useQuery(avisoQuery());
  const navigate = useNavigate();
  return <TarjetaEnlace titulo="Aviso de privacidad" icono={<ShieldCheck className="size-5" />}>
    {aviso.isPending ? <p>Cargando aviso…</p> : aviso.isError ? <><Alerta>No pudimos cargar el aviso de privacidad.</Alerta><Button onClick={() => void aviso.refetch()}>Reintentar</Button></> : <div className="flex flex-col gap-5">
      {aviso.data.provisional && <Alerta tono="aviso">Aviso provisional. La versión definitiva está en revisión legal.</Alerta>}
      <p className="break-words text-sm text-muted-foreground">Versión {aviso.data.version} · vigente desde {fechaAviso(aviso.data.vigente_desde)}</p>
      {aviso.data.secciones.map((s, i) => <section key={i} className="flex flex-col gap-2"><h2 className="text-lg font-semibold">{s.titulo}</h2>{s.parrafos.map((p, j) => <p key={j} className="text-sm leading-relaxed">{p}</p>)}</section>)}
      <p className="text-sm">¿Dudas o quieres ejercer tus derechos ARCO? Escribe a <a href={`mailto:${aviso.data.contacto_arco}`} className="break-all font-semibold text-primary underline">{aviso.data.contacto_arco}</a></p>
    </div>}
    <Button variant="secondary" className="mt-5" onClick={() => { if (window.history.length > 1) window.history.back(); else void navigate({ to: "/" }); }}>Volver</Button>
  </TarjetaEnlace>;
}