import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Gift, History, Search, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { useMiSaldo } from "@/components/misaldo-provider";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { useQuery } from "@tanstack/react-query";
import { perfil, referidos, resumen, type Perfil, type Resumen } from "@/lib/api/cliente";
import { pesos, textoCaducidad } from "@/lib/api/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MiSaldo · Tu saldo y tus sellos" },
      {
        name: "description",
        content:
          "Consulta tu saldo, tus tarjetas de sellos y tus premios en los negocios donde eres cliente.",
      },
      { property: "og:title", content: "MiSaldo · Tu saldo y tus sellos" },
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
  const { sesion } = useAuth();
  const { updateBusiness } = useMiSaldo();
  const refs = useQuery({ queryKey: ["cliente-referidos"], queryFn: referidos, enabled: !!sesion, retry: false });
  const hayReferidos = !!refs.data && (refs.data.programa !== null || refs.data.recomendados.length > 0);
  const [datos, setDatos] = useState<Resumen | null>(null);
  const [yo, setYo] = useState<Perfil | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    resumen()
      .then((r) => {
        setDatos(r);
        updateBusiness({ name: r.negocio.nombre_comercial, logo: r.negocio.logo_url });
      })
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "No se pudo cargar tu saldo."));
    perfil().then(setYo).catch(() => undefined);
  }, [sesion?.contexto.negocio_id, updateBusiness]);

  if (!datos) {
    return (
      <AppShell>
        <Cargando />
      </AppShell>
    );
  }

  const moneda = datos.negocio.moneda;
  const q = query.trim().toLowerCase();
  const tarjetas = (datos.tarjetas ?? []).filter(
    (t) => !q || t.nombre.toLowerCase().includes(q) || datos.negocio.nombre_comercial.toLowerCase().includes(q),
  );
  const premios = (datos.tarjetas ?? []).flatMap((t) => t.premios_por_canjear.map((p) => ({ ...p, tarjeta: t.nombre })));
  const m = datos.monedero;

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar establecimiento..."
            aria-label="Buscar establecimiento"
            className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
          />
        </label>

        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">Hola de nuevo</p>
            <h1 className="truncate text-2xl font-semibold tracking-tight">{yo?.nombre ?? "Cliente"}</h1>
          </div>
          <span className="shrink-0 rounded-full border border-accent/40 bg-accent/15 px-3 py-1 text-xs font-semibold">
            {datos.negocio.nombre_comercial}
          </span>
        </div>

        {m && (
          <section className="relative overflow-hidden rounded-2xl bg-primary p-5 text-primary-foreground ring-1 ring-black/5 sm:p-6">
            <div className="pane-diagonal" aria-hidden="true">
              <div className="h-[200%] w-1/2 bg-white/10 backdrop-blur-sm" style={{ transform: "translateX(-15%) skewX(-16deg)" }} />
              <div className="h-[200%] w-1/3 bg-accent/25 backdrop-blur-sm" style={{ transform: "translateX(55%) skewX(-16deg)" }} />
            </div>
            <div className="relative">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.16em] opacity-75">Saldo disponible</p>
                <span className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-xs">
                  {Math.round(m.factor_cashback * 1000) / 10}% cashback
                </span>
              </div>
              <p className="mt-3 flex items-baseline gap-1">
                <span className="font-mono text-5xl font-bold leading-none tracking-tighter sm:text-6xl">
                  {pesos(m.saldo_centavos, moneda)}
                </span>
                <span className="ml-1 text-lg opacity-70">{moneda}</span>
              </p>
              <p className="mt-2 text-sm opacity-80">{datos.negocio.nombre_comercial}</p>
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
                  <Button size="lg" variant="ghost" className="tap-target bg-white/15 text-primary-foreground hover:bg-white/25" asChild>
                    <Link to="/canjear">Canjear</Link>
                  </Button>
                </div>
                <span className={cn("text-xs", m.vence_pronto || m.vencido ? "rounded-md bg-warn px-2 py-0.5 font-semibold text-background" : "opacity-75")}>
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
                  <Gift className="size-4 shrink-0 text-accent" /> {p.tarjeta}
                </p>
                <p className="mt-1 text-xl font-bold">{p.premio_texto}</p>
                <p className={cn("mt-2 flex items-center gap-1.5 text-sm font-medium", p.vence_pronto ? "text-warn" : "text-muted-foreground")}>
                  {p.vence_pronto && <TriangleAlert className="size-4 shrink-0" />}
                  {textoCaducidad(p)}
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
            {tarjetas.length === 0 && <p className="text-sm text-muted-foreground">No hay tarjetas que coincidan.</p>}
            <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
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
                              filled && (index % 2 === 0 ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"),
                              !filled && last && "border-2 border-accent text-accent",
                              !filled && !last && "border border-dashed border-border text-muted-foreground",
                            )}
                          >
                            {filled ? "✓" : last ? "★" : i + 1}
                          </span>
                        );
                      })}
                    </div>
                    {card.en_retiro && <p className="mt-2 text-xs font-medium text-warn">Ya no da sellos: canjea tus premios.</p>}
                    {cad && (
                      <p className={cn("mt-3 flex items-center gap-1.5 text-sm font-semibold", cad.vence_pronto || cad.vencido ? "text-warn" : "text-muted-foreground")}>
                        {(cad.vence_pronto || cad.vencido) && <TriangleAlert className="size-4 shrink-0" />}
                        {textoCaducidad(cad)}
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <h2 className="text-lg font-semibold tracking-tight">Para usar tu saldo o premio</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Dicta tu código de canje de 4 dígitos al cajero. Nunca lo compartas con nadie más.
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
