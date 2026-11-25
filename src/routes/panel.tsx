import { PendientesAsistente, useAsistente } from "@/components/negocio/asistente";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Archive, ChevronRight, Megaphone, MessageSquareWarning, Stamp, TrendingUp, UserCheck, UserPlus, UserRoundPlus, Users, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { AppShell } from "@/components/app-shell";
import { BotonQrRegistro, useEnlaceRegistro } from "@/components/qr-registro";
import { CopiarEnlace } from "@/components/copiar-enlace";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { IconoTono, type Tono } from "@/components/fila-lista";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { ApiError } from "@/lib/api/client";
import { configuracion } from "@/lib/api/caja";
import { dashboard, membresia, type Dashboard, type Membresia } from "@/lib/api/dueno";
import { fechaCorta, pesos } from "@/lib/api/formato";
import { useMisValidaciones } from "@/lib/use-mis-validaciones";

export const Route = createFileRoute("/panel")({
  head: () => ({
    meta: [
      { title: "Panel del dueño · Mi Saldo Vip" },
      {
        name: "description",
        content: "Ventas del día, clientes atendidos, sellos entregados y reclamaciones pendientes.",
      },
      { property: "og:title", content: "Panel del dueño · Mi Saldo Vip" },
      {
        property: "og:description",
        content: "Métricas del negocio: ventas, clientes, sellos y quejas pendientes de la semana.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Panel" roles={["dueno"]}>
      <Panel />
    </RequiereSesion>
  ),
});

const restarDias = (f: string, dias: number) => {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
};
const etiquetaPesos = (centavos: number) => {
  if (!centavos) return "";
  const p = centavos / 100;
  if (p < 1000) return `$${Math.round(p)}`;
  return `$${Math.round(p / 100) / 10}k`;
};
const DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function Panel() {
  const { sesion } = useAuth();
  const { nombre, enlace, conRegistro } = useEnlaceRegistro();
  const { data: estadoAsistente } = useAsistente();
  const navigate = useNavigate();
  useEffect(() => {
    if (estadoAsistente?.mostrar_asistente) void navigate({ to: "/negocio/asistente", replace: true });
  }, [estadoAsistente, navigate]);
  const [hoy, setHoy] = useState<Dashboard | null>(null);
  const [semana, setSemana] = useState<Dashboard | null>(null);
  const [memb, setMemb] = useState<Membresia | null>(null);
  const [sinPinPos, setSinPinPos] = useState(false);
  const [vista, setVista] = useState<"saldo" | "sellos">("saldo");
  const { data: misValidaciones } = useMisValidaciones();

  useEffect(() => {
    const err = (e: unknown) => toast.error(e instanceof ApiError ? e.message : "No se pudo cargar el panel.");
    dashboard()
      .then((d) => {
        setHoy(d);
        return dashboard({ desde: restarDias(d.periodo.hasta, 6), hasta: d.periodo.hasta }).then(setSemana);
      })
      .catch(err);
    membresia().then(setMemb).catch(() => undefined);
    configuracion()
      .then((c) => setSinPinPos(!c.negocio.pin_pos_configurado))
      .catch(() => undefined);
  }, []);

  if (!hoy) {
    return (
      <AppShell>
        <Cargando forma="tarjetas" />
      </AppShell>
    );
  }

  const ambos = !!hoy.monedero && !!hoy.tarjetas;
  const ventasCards = ambos
    ? [
        { label: "Ventas con saldo", value: pesos(hoy.monedero!.ventas.monto_compra_centavos), icon: TrendingUp },
        { label: "Ventas con sellos", value: pesos(hoy.tarjetas!.ventas.monto_compra_centavos), icon: TrendingUp },
      ]
    : [{ label: "Ventas de hoy", value: pesos((hoy.monedero ?? hoy.tarjetas)?.ventas.monto_compra_centavos ?? 0), icon: TrendingUp }];
  const cards: Array<{ label: string; value: string; icon: LucideIcon; tono: Tono; aviso: boolean; to?: "/clientes" | "/negocio/movimientos" | undefined; search?: { archivados: "solo" } }> = [
    // U-07: ventas y atendidos abren Movimientos (que ya filtra a hoy por omisión).
    ...ventasCards.map((c) => ({ ...c, tono: "success" as const, aviso: false, to: "/negocio/movimientos" as const })),
    { label: "Clientes atendidos", value: String(hoy.clientes.atendidos), icon: Users, tono: "primary", aviso: false, to: "/negocio/movimientos" },
    { label: "Clientes nuevos hoy", value: String(hoy.clientes.altas), icon: UserRoundPlus, tono: "success", aviso: false, to: "/clientes" },
    { label: "Clientes en total", value: String(hoy.clientes.activos_total), icon: Users, tono: "neutro", aviso: false, to: "/clientes" },
    ...(hoy.clientes.archivados_total > 0 ? [{ label: "Clientes archivados", value: String(hoy.clientes.archivados_total), icon: Archive, tono: "neutro" as const, aviso: false, to: "/clientes" as const, search: { archivados: "solo" as const } }] : []),
    { label: "Sellos entregados", value: String(hoy.tarjetas?.sellos_otorgados ?? 0), icon: Stamp, tono: "warning", aviso: false, to: undefined },
  ];
  // U-04: lo pendiente va en la franja "Para atender hoy", solo si hay algo.
  const validacionesPendientes = misValidaciones?.validaciones?.filter((v) => v.estado === "pendiente").length ?? 0;
  type PorAtender = { n: number; uno: string; varios: string; icon: LucideIcon; to: "/negocio/reclamaciones" | "/negocio/solicitudes" | "/validaciones" };
  const porAtender = ([
    { n: hoy.reclamaciones.pendientes, uno: "reclamación por revisar", varios: "reclamaciones por revisar", icon: MessageSquareWarning, to: "/negocio/reclamaciones" },
    { n: hoy.validaciones_alta.pendientes, uno: "solicitud de alta pendiente", varios: "solicitudes de alta pendientes", icon: UserPlus, to: "/negocio/solicitudes" },
    { n: validacionesPendientes, uno: "solicitud por confirmar", varios: "solicitudes por confirmar", icon: UserCheck, to: "/validaciones" },
  ] satisfies PorAtender[]).filter((p) => p.n > 0);
  const usaVentas = !!hoy.monedero && (!hoy.tarjetas || vista === "saldo");
  const serie = (semana?.serie ?? []).map((s) => ({
    fecha: s.fecha,
    value: usaVentas ? (s.monedero_ventas_centavos ?? 0) : (s.sellos_otorgados ?? 0),
  }));
  const max = Math.max(1, ...serie.map((d) => d.value));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        {estadoAsistente && <PendientesAsistente datos={estadoAsistente} />}
        {memb?.aviso_pago_pendiente && (
          <Link
            to="/negocio/membresia"
            className="sticky top-[76px] z-20 -mx-1 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-warn px-4 py-2 text-sm font-semibold text-warn-foreground shadow-soft"
          >
            <span>
              {memb.estado === "vencida"
                ? `Caja bloqueada desde el ${fechaCorta(memb.bloqueo_desde)}.`
                : `Tu membresía venció el ${fechaCorta(memb.fecha_vencimiento)}. La caja se bloquea el ${fechaCorta(memb.bloqueo_desde)}.`}
            </span>
            <span className="shrink-0 underline underline-offset-4">Pagar</span>
          </Link>
        )}
        <Link
          to="/caja"
          className="btn-accion tap-target flex min-h-16 items-center justify-center gap-3 rounded-2xl px-6 text-lg font-semibold text-accent-foreground"
        >
          Ir a la caja
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Panel</h1>
            <p className="mt-1 text-base text-muted-foreground">Cómo va tu negocio hoy.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <BotonQrRegistro />
            {/* U-06: el envío diario de promociones a un toque; el cartel (ocasional) pasó a Negocio → Configuración. */}
            {sesion?.contexto.rol === "dueno" && <Button variant="secondary" className="min-h-12 text-base" asChild><Link to="/negocio/promociones"><Megaphone /> Enviar promoción</Link></Button>}
          </div>
        </div>

        {porAtender.length > 0 && (
          <section aria-labelledby="para-atender" className="rounded-2xl bg-warn p-4 text-warn-foreground">
            <h2 id="para-atender" className="text-lg font-semibold tracking-tight">Para atender hoy</h2>
            <ul className="mt-2 flex flex-col gap-2">
              {porAtender.map((p) => (
                <li key={p.to}>
                  <Link to={p.to} className="flex min-h-12 items-center gap-3 rounded-xl bg-background/15 px-3 py-2 text-base font-semibold transition-colors hover:bg-background/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p.icon aria-hidden="true" className="size-5 shrink-0" />
                    <span className="min-w-0"><span className="font-mono tabular-nums">{p.n}</span> {p.n === 1 ? p.uno : p.varios}</span>
                    <ChevronRight aria-hidden="true" className="ml-auto size-5 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {sinPinPos && !estadoAsistente?.pendientes_obligatorios.includes("pin_pos") && (
          <Link to="/negocio/pin-pos" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">
            Define el PIN POS para que tus cajeros puedan abrir la caja →
          </Link>
        )}

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
          {cards.map((c) => {
            const clase = cn("rounded-2xl p-4 ring-1", c.aviso ? "bg-warn text-warn-foreground ring-warn" : "bg-card ring-border", c.to && "transition-[color,background-color,border-color,box-shadow,transform] duration-150 hover:ring-primary/60 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none");
            const cuerpo = (
              <>
                {c.aviso ? <c.icon className="size-6 shrink-0 text-warn-foreground" /> : <IconoTono icono={c.icon} tono={c.tono} className="size-10 [&_svg]:size-5" />}
                <p className="mt-3 font-mono text-2xl font-bold tabular-nums sm:text-3xl">{c.value}</p>
                <p className={cn("mt-1 text-sm", c.aviso ? "text-barra-foreground dark:text-warn-foreground" : "text-muted-foreground")}>{c.label}</p>
              </>
            );
            return c.to ? (
              <Link key={c.label} to={c.to} {...(c.search ? { search: c.search } : {})} className={clase}>{cuerpo}</Link>
            ) : (
              <div key={c.label} className={clase}>{cuerpo}</div>
            );
          })}
        </div>
        {ambos && hoy.nota_ventas && <p className="-mt-3 text-xs text-muted-foreground">{hoy.nota_ventas}</p>}

        {sesion?.contexto.rol === "dueno" && conRegistro && enlace && nombre && (
          <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight"><Megaphone aria-hidden="true" className="size-5 shrink-0 text-primary-texto" />Invita a tus clientes</h2>
            <p className="my-3 text-sm text-muted-foreground">Comparte tu enlace en tus estados de WhatsApp, Facebook o grupos. Cada cliente llena sus datos y tú lo apruebas en la Caja.</p>
            <CopiarEnlace enlace={enlace} nombreNegocio={nombre} campoVisible />
          </section>
        )}

        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          {ambos && (
            <div className="mb-4 flex gap-2" role="tablist">
              {(["saldo", "sellos"] as const).map((v) => (
                <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)}
                  className={cn("tap-target rounded-full px-4 py-2 text-sm font-semibold", vista === v ? "bg-primary text-primary-foreground" : "bg-muted text-secondary-foreground")}>
                  {v === "saldo" ? "Ventas con saldo" : "Sellos"}
                </button>
              ))}
            </div>
          )}
          <h2 className="text-lg font-semibold tracking-tight">{usaVentas ? "Ventas con saldo de la semana" : "Sellos de la semana"}</h2>
          <div className="mt-5 flex h-48 items-end gap-2">
            {serie.map((d) => (
              <div key={d.fecha} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {usaVentas ? etiquetaPesos(d.value) : d.value || ""}
                </span>
                <div className="w-full rounded-t-lg bg-primary" style={{ height: `${(d.value / max) * 100}%` }} />
                <span className="text-xs text-muted-foreground">{DIA[new Date(`${d.fecha}T12:00:00Z`).getUTCDay()]}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold tracking-tight">Cajeros de hoy</h2>
          {hoy.cajeros.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Aún no hay operaciones hoy.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-separador">
              {hoy.cajeros.map((c) => (
                <li key={c.persona_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-medium">
                      {c.nombre} {c.apellido_paterno ?? ""}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {c.rol === "dueno" ? "Dueño" : "Cajero"} · {c.monedero.acumulaciones + c.tarjetas.acumulaciones} operaciones
                    </p>
                  </div>
                  <span className="shrink-0 text-base font-semibold tabular-nums">
                    {pesos(c.monedero.ventas_centavos || c.tarjetas.ventas_centavos)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
