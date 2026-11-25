import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ChevronRight, Gift, History, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useMiSaldo } from "@/components/misaldo-provider";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { fichaNegocio, perfil, referidos, resumen, tieneReferidos, type Perfil } from "@/lib/api/cliente";
import { pesos, textoCaducidad, textoEstadoHorario } from "@/lib/api/formato";
import { cn } from "@/lib/utils";
import { useRecargaVisible } from "@/lib/use-recarga-visible";
import { fechaTarjeta } from "@/lib/fecha-tarjeta";
import { InvitarInstalar } from "@/components/invitar-instalar";
import { TusPines } from "@/components/cuenta/tus-pines";
import { PromocionesVigentes } from "@/components/cliente/promociones-vigentes";
import { NegociosCliente } from "@/components/mis-negocios";
import { DesplazarAlHash } from "@/components/desplazar-al-hash";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mi Saldo Vip · Tu saldo y tus sellos" },
      {
        name: "description",
        content:
          "Consulta tu saldo, tus tarjetas de sellos y tus premios en los negocios donde eres cliente.",
      },
      { property: "og:title", content: "Mi Saldo Vip · Tu saldo y tus sellos" },
      {
        property: "og:description",
        content: "Saldo, sellos y premios de todos tus negocios favoritos en un solo lugar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Tu saldo" roles={["cliente"]}>
      <ClienteInicio />
    </RequiereSesion>
  ),
});

function ClienteInicio() {
  const { sesion, conectado } = useAuth();
  const { updateBusiness } = useMiSaldo();
  const ficha = useQuery({ queryKey: ["cliente-ficha-negocio", sesion?.contexto.negocio_id], queryFn: fichaNegocio, enabled: !!sesion && conectado !== false, retry: false });
  const refs = useQuery({ queryKey: ["cliente-referidos"], queryFn: referidos, enabled: !!sesion && conectado !== false, retry: false });
  const hayReferidos = tieneReferidos(refs.data);
  const consulta = useQuery({ queryKey: ["cliente-resumen", sesion?.contexto.negocio_id], queryFn: resumen, enabled: !!sesion && conectado !== false, retry: false, staleTime: 20_000 });
  const datos = consulta.data;
  useRecargaVisible(() => { if (!consulta.isFetching) void consulta.refetch(); }, conectado !== false);
  const [yo, setYo] = useState<Perfil | null>(null);

  useEffect(() => {
    if (datos) updateBusiness({ name: datos.negocio.nombre_comercial, logo: datos.negocio.logo_url });
  }, [datos, updateBusiness]);
  useEffect(() => {
    if (conectado === false) return;
    perfil().then(setYo).catch(() => undefined);
  }, [sesion?.contexto.negocio_id, conectado]);

  if (!datos) {
    return (
      <AppShell>
        <Cargando />
      </AppShell>
    );
  }

  const moneda = datos.negocio.moneda;
  const tarjetas = datos.tarjetas ?? [];
  const premios = (datos.tarjetas ?? []).flatMap((t) => t.premios_por_canjear.map((p) => ({ ...p, tarjeta: t.nombre })));
  const m = datos.monedero;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <NegociosCliente />

        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Hola de nuevo</p>
          <h1 className="truncate text-2xl font-semibold tracking-tight">{yo?.nombre ?? "Cliente"}</h1>
        </div>

        <InvitarInstalar />

        {ficha.data && !ficha.isError && !ficha.isPending && (
          <Link to="/mi-negocio" className="flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-border"
            aria-label={`${textoEstadoHorario(ficha.data)}. Ver horario y ubicación de ${ficha.data.nombre_comercial}`}>
            <span aria-hidden="true" className={cn("size-2.5 shrink-0 rounded-full", ficha.data.abierto_ahora === true ? "bg-success" : "bg-muted-foreground")} />
            <span className="min-w-0 text-sm font-medium">{textoEstadoHorario(ficha.data)}</span>
            <span className="ml-auto flex min-w-0 items-center gap-1 text-sm text-primary-texto">Ver horario y ubicación<ChevronRight className="size-4 shrink-0" /></span>
          </Link>
        )}

        {m && (
          <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground ring-1 ring-black/5 sm:p-6">
            <div className="pane-diagonal" aria-hidden="true">
              <div className="h-[200%] w-1/2 bg-white/10 backdrop-blur-sm" style={{ transform: "translateX(-15%) skewX(-16deg)" }} />
              <div className="h-[200%] w-1/3 bg-white/5 backdrop-blur-sm" style={{ transform: "translateX(55%) skewX(-16deg)" }} />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em]">Saldo disponible</p>
                <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-xs">
                  {Math.round(m.factor_cashback * 1000) / 10}% cashback
                </span>
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-5xl font-bold leading-none tracking-tighter sm:text-6xl">
                  {pesos(m.saldo_centavos, moneda)}
                </span>
                <span className="ml-1 text-lg">{moneda}</span>
              </p>
              <p className="mt-2 text-sm">{datos.negocio.nombre_comercial}</p>
              {m.en_retiro && (
                <p className="mt-2 rounded-lg bg-white/15 px-3 py-2 text-xs">
                  Este negocio ya no da cashback: canjea lo que tienes antes del vencimiento.
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  <Button size="lg" className="tap-target bg-background text-foreground hover:bg-background/90" asChild>
                    <Link to="/historial">
                      <History className="size-5" /> Historial
                    </Link>
                  </Button>
                  <Button size="lg" className="tap-target" onClick={() => document.getElementById("tus-pines")?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                    Canjear
                  </Button>
                </div>
                <span className={cn("text-xs", m.vence_pronto || m.vencido ? "rounded-md bg-warn px-2 py-0.5 font-semibold text-background" : "")}>
                  {textoCaducidad(m)}
                </span>
              </div>
            </div>
          </section>
        )}

        {premios.length > 0 && (
          <section className="grid gap-3 sm:grid-cols-2">
            {premios.map((p) => (
              <div key={p.cliente_tarjeta_id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <p className="flex items-center gap-2 truncate text-sm font-semibold">
                   <Gift className="size-6 shrink-0 text-warning" /> {p.tarjeta}
                </p>
                <p className="mt-1 text-xl font-bold">{p.premio_texto}</p>
                <p className="text-sm font-medium">Premio listo · canjéalo en caja</p>
                <p className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", p.vence_pronto ? "text-warn-texto" : "text-muted-foreground")}>
                  {p.vence_pronto && <TriangleAlert className="size-4 shrink-0" />}
                  {p.fecha_vencimiento ? `Canjéalo antes del ${fechaTarjeta(p.fecha_vencimiento)}` : ""}
                </p>
              </div>
            ))}
          </section>
        )}

        {datos.tarjetas && (
          <section>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-tight">Tus tarjetas de sellos</h2>
              <span className="shrink-0 text-xs text-muted-foreground">Desliza →</span>
            </div>
            <div tabIndex={0} role="region" aria-label="Tus tarjetas de sellos" className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
              {tarjetas.map((card, index) => {
                const total = card.en_curso?.sellos_requeridos ?? card.regla.sellos_requeridos;
                const stamps = card.en_curso?.sellos_actuales ?? 0;
                const cad = card.en_curso;
                return (
                  <article
                    key={card.tarjeta_digital_id}
                    className="w-64 shrink-0 rounded-2xl bg-card p-4 ring-1 ring-border"
                    style={{ transform: `rotate(${index % 2 === 0 ? -1.2 : 1}deg)` }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">{card.nombre}</p>
                      <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs font-bold">
                        {stamps}/{total}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{cad?.premio_texto ?? card.regla.premio_texto}</p>
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {Array.from({ length: total }).map((_, i) => {
                        const filled = i < stamps;
                        const last = i === total - 1;
                        return (
                          <span
                            key={i}
                            className={cn(
                              "grid size-9 place-items-center rounded-full text-xs font-bold",
                              filled && "bg-warning text-warning-foreground",
                              !filled && last && "border-2 border-warning text-warning",
                              !filled && !last && "border border-dashed border-border text-muted-foreground",
                            )}
                          >
                            {filled ? "✓" : last ? "★" : i + 1}
                          </span>
                        );
                      })}
                    </div>
                    {card.en_retiro && <p className="mt-2 text-xs font-medium text-warn-texto">Ya no da sellos: canjea tus premios.</p>}
                    {cad?.fecha_vencimiento && (
                      <p className={cn("mt-3 flex items-center gap-1.5 text-sm font-semibold", cad.vence_pronto || cad.vencido ? "text-warn-texto" : "text-muted-foreground")}>
                        {(cad.vence_pronto || cad.vencido) && <TriangleAlert className="size-4 shrink-0" />}
                        Vence el {fechaTarjeta(cad.fecha_vencimiento)} · cada compra renueva la fecha
                      </p>
                    )}
                    {card.regla.vigencia_dias === null && <p className="mt-3 text-sm text-muted-foreground">Sin vencimiento</p>}
                    {card.tipo_sello === "por_monto" && (cad?.remanente_centavos ?? 0) > 0 && <p className="mt-2 text-sm text-muted-foreground">{pesos(cad?.remanente_centavos, moneda)} acumulados para el siguiente sello</p>}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <PromocionesVigentes />
        <DesplazarAlHash id="tus-pines" />

        {sesion?.contexto.rol === "cliente" && <div id="tus-pines" className="scroll-mt-24"><TusPines key={sesion.contexto.negocio_id} telefono={yo?.telefono ?? ""} /></div>}

        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold tracking-tight">Para usar tu saldo o premio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dicta tu PIN de canje (4 dígitos) al cajero. Nunca lo compartas con nadie más.
          </p>
          {hayReferidos && <Button size="lg" variant="link" className="mt-2 px-0" asChild>
            <Link to="/referidos">
              Recomienda y gana <ArrowRight className="size-4" />
            </Link>
          </Button>}
        </section>
      </div>
    </AppShell>
  );
}
