import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { EstadoPaso, PASOS_ASISTENTE, pasosVisibles, textoPaso, useAsistente } from "@/components/negocio/asistente";
import { mostrarError } from "@/components/negocio/comun";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { cerrarAsistente } from "@/lib/api/dueno";

export const Route = createFileRoute("/negocio/asistente")({
  head: () => ({ meta: [
    { title: "Configura tu negocio · MiSaldo" },
    { name: "description", content: "Configuración inicial de horarios, monedero, tarjetas y PIN POS de tu negocio en MiSaldo." },
    { property: "og:title", content: "Configura tu negocio · MiSaldo" },
    { property: "og:description", content: "Prepara tu negocio para cobrar con el asistente de configuración de MiSaldo." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <RequiereSesion titulo="Configura tu negocio" roles={["dueno"]}><AsistenteInicial /></RequiereSesion>,
});

export function AsistenteInicial() {
  const { data, error } = useAsistente();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const cierre = useMutation({
    mutationFn: cerrarAsistente,
    onSuccess: (respuesta) => {
      qc.setQueryData(["asistente"], respuesta);
      toast.success(respuesta.configuracion_completa ? "¡Listo! Tu negocio ya puede cobrar." : "Puedes terminar cuando quieras desde tu Panel.");
      void navigate({ to: "/panel" });
    },
    onError: (e) => mostrarError(e),
  });
  const pasos = data ? pasosVisibles(data) : [];
  const completos = pasos.filter((p) => p.completo).length;
  return <AppShell><div className="flex flex-col gap-6">
    <div><h1 className="text-3xl font-semibold tracking-tight">Configura tu negocio</h1>
      <p className="mt-1 text-base text-muted-foreground">Te llevará unos minutos. Lo marcado como obligatorio es lo mínimo para que tu caja empiece a cobrar.</p>
    </div>
    {error ? <p role="alert" className="text-destructive">{error.message}</p> : !data ? <Cargando /> : <>
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">{completos} de {pasos.length} pasos</p>
        <progress aria-label="Pasos completos" value={completos} max={pasos.length} className="h-2 w-full overflow-hidden rounded-full bg-secondary [&::-webkit-progress-bar]:bg-secondary [&::-webkit-progress-value]:bg-primary [&::-moz-progress-bar]:bg-primary" />
      </div>
      <ol className="flex flex-col gap-3">
        {pasos.map((p, i) => <li key={p.paso} className="flex flex-wrap items-center gap-4 rounded-2xl bg-card p-5 ring-1 ring-border">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary font-mono font-semibold text-primary shadow-soft">{i + 1}</span>
          <div className="min-w-0 flex-1 basis-48">
            <h2 className="text-lg font-semibold">{PASOS_ASISTENTE[p.paso].titulo}</h2>
            <p className="mb-2 text-sm text-muted-foreground">{textoPaso(p)}</p>
            <EstadoPaso paso={p} />
          </div>
          <Button variant="secondary" asChild><Link to={PASOS_ASISTENTE[p.paso].to} search={{ asistente: 1 }}>{p.completo ? "Revisar" : "Configurar"}</Link></Button>
        </li>)}
      </ol>
      <div className="flex flex-col items-start gap-3">
        {!data.configuracion_completa && <p className="text-sm text-muted-foreground">Te falta: {data.pendientes_obligatorios.map((p) => PASOS_ASISTENTE[p].titulo).join(", ")}.</p>}
        <Button variant={data.configuracion_completa ? "default" : "secondary"} disabled={cierre.isPending} onClick={() => cierre.mutate()}>
          {cierre.isPending ? "Guardando…" : data.configuracion_completa ? "Terminar" : "Terminar después"}
        </Button>
      </div>
    </>}
  </div></AppShell>;
}