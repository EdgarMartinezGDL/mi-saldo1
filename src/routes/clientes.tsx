import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { AjusteManual } from "@/components/negocio/ajuste-manual";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ApiError } from "@/lib/api/client";
import { consultarClientes, fichaCliente, type ClienteLista, type FichaCliente, type Siguiente } from "@/lib/api/dueno";
import { diaDeInstante, fechaCorta, instante, nombreCompleto, pesos, telefonoVisible } from "@/lib/api/formato";
import { plural } from "@/lib/plural";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

export const Route = createFileRoute("/clientes")({
  validateSearch: (s: Record<string, unknown>): { archivados?: "incluir" | "solo" } =>
    s["archivados"] === "solo" || s["archivados"] === "incluir" ? { archivados: s["archivados"] } : {},
  head: () => ({
    meta: [
      { title: "Clientes · MiSaldo" },
      { name: "description", content: "Busca a tus clientes por nombre o teléfono y revisa su saldo y sellos." },
      { property: "og:title", content: "Clientes · MiSaldo" },
      { property: "og:description", content: "Lista y ficha de clientes del negocio, sin abrir la caja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Clientes" roles={["dueno"]}>
      <Clientes />
    </RequiereSesion>
  ),
});

/** Digits only need 4+, text needs 2+; anything shorter lists everyone. */
const busquedaValida = (q: string) => {
  const t = q.trim();
  const digitos = t.replace(/[\s+-]/g, "");
  if (/^\d+$/.test(digitos)) return digitos.length >= 4 ? digitos : undefined;
  return t.length >= 2 ? t : undefined;
};

function Clientes() {
  const { archivados } = Route.useSearch();
  const navigate = useNavigate();
  const elegir = (v: string) => {
    if (v !== "activos" && v !== "incluir" && v !== "solo") return;
    void navigate({ to: "/clientes", search: v === "activos" ? {} : { archivados: v }, replace: true });
  };
  const [q, setQ] = useState("");
  const [lista, setLista] = useState<ClienteLista[] | null>(null);
  const [total, setTotal] = useState(0);
  const [siguiente, setSiguiente] = useState<Siguiente>(null);
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [ajustando, setAjustando] = useState(false);
  const refFicha = useDesplazarAlAbrir(fichaId);
  const refLista = useDesplazarAlAbrir(lista?.length);

  const cargar = async (cursor: Siguiente) => {
    try {
      const r = await consultarClientes({ busqueda: busquedaValida(q), limite: 50, ...(archivados ? { archivados } : {}), ...(cursor ?? {}) });
      setLista((prev) => (cursor ? [...(prev ?? []), ...r.clientes] : r.clientes));
      setTotal(r.total);
      setSiguiente(r.siguiente);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cargar la lista.");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void cargar(null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, archivados]);

  const abrir = async (id: string) => {
    try {
      setFicha(await fichaCliente(id));
      setFichaId(id);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo abrir la ficha.");
    }
  };

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Clientes</h1>
          <p className="mt-1 text-base text-muted-foreground">{lista ? plural(total, "cliente", "clientes") : "Busca por nombre o teléfono."}</p>
        </div>
        <label className="relative block">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o teléfono..."
            aria-label="Buscar cliente"
            className="h-12 w-full rounded-xl border border-border bg-card pl-12 pr-4 text-base shadow-soft outline-none transition placeholder:text-muted-foreground focus:border-primary/60 focus:ring-4 focus:ring-primary/15"
          />
        </label>
        <ToggleGroup
          type="single"
          aria-label="Filtrar clientes"
          value={archivados ?? "activos"}
          onValueChange={elegir}
          className="grid w-full grid-cols-3 gap-1 rounded-xl bg-card p-1 ring-1 ring-border sm:max-w-md"
        >
          <ToggleGroupItem value="activos" className="h-11 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Activos</ToggleGroupItem>
          <ToggleGroupItem value="incluir" className="h-11 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Todos</ToggleGroupItem>
          <ToggleGroupItem value="solo" className="h-11 rounded-lg text-sm font-medium data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">Archivados</ToggleGroupItem>
        </ToggleGroup>

        {ficha && (
          <section ref={refFicha} className="rounded-2xl bg-card p-5 ring-1 ring-primary/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-lg font-semibold">{nombreCompleto(ficha.cliente)}</p>
                <p className="text-sm text-muted-foreground">{telefonoVisible(ficha.cliente.telefono)}</p>
              </div>
              <button type="button" aria-label="Cerrar ficha" onClick={() => setFicha(null)} className="tap-target grid place-items-center text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            {ficha.resumen.archivado && (
              <div className="mt-3 rounded-xl bg-warn/10 p-3 text-sm text-warn">
                <p className="font-bold">Archivado desde {diaDeInstante(ficha.resumen.archivado_en)}</p>
                <p>Sin compras ni canjes en 180 días. Conserva su saldo y sus sellos, pero no recibe avisos de vencimiento. Vuelve a la lista con su siguiente compra o canje en caja; un ajuste manual no lo reactiva.</p>
              </div>
            )}
            {ficha.monedero && (
              <p className="mt-3 font-mono text-3xl font-bold tabular-nums">
                {pesos(ficha.monedero.saldo_centavos)}
                {ficha.monedero.fecha_vencimiento && (
                  <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">vence {fechaCorta(ficha.monedero.fecha_vencimiento)}</span>
                )}
              </p>
            )}
            <ul className="mt-3 flex flex-col gap-2">
              {(ficha.tarjetas ?? []).map((t) => (
                <li key={t.tarjeta_digital_id} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 text-sm ring-1 ring-border">
                  <span className="min-w-0 truncate font-medium">{t.nombre}</span>
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-0.5 font-mono text-xs font-bold">
                    {t.sellos_actuales}/{t.sellos_requeridos}
                    {t.completas_por_canjear > 0 && ` · ${plural(t.completas_por_canjear, "premio", "premios")}`}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 grid gap-1 text-sm text-muted-foreground">
              <p>Cliente desde {instante(ficha.resumen.cliente_desde)}</p>
              <p>Última compra: {ficha.resumen.ultima_compra_en ? instante(ficha.resumen.ultima_compra_en) : "sin compras"}</p>
              {ficha.resumen.archivado && <p>Última compra o canje: {ficha.resumen.ultima_actividad_en ? instante(ficha.resumen.ultima_actividad_en) : "sin compras ni canjes"}</p>}
              {!ficha.resumen.acepta_promociones && <p>No acepta promociones.</p>}
              {ficha.resumen.reclamaciones_pendientes > 0 && (
                <p className="font-medium text-warn">{plural(ficha.resumen.reclamaciones_pendientes, "reclamación pendiente", "reclamaciones pendientes")}</p>
              )}
            </div>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {ficha.cliente.telefono && (
                <Button size="lg" onClick={() => setAjustando(true)}>Ajustar saldo o sellos</Button>
              )}
              {ficha.cliente.telefono && (
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/negocio/movimientos" search={{ telefono: ficha.cliente.telefono.replace(/\D/g, "").slice(-10) }}>Ver movimientos</Link>
                </Button>
              )}
              {ficha.resumen.reclamaciones_pendientes > 0 && (
                <Button size="lg" variant="secondary" asChild>
                  <Link to="/negocio/reclamaciones">Ver reclamaciones</Link>
                </Button>
              )}
            </div>
            {ficha.cliente.telefono && (
              <AjusteManual
                ficha={ficha}
                telefono={ficha.cliente.telefono}
                abierto={ajustando}
                onAbierto={setAjustando}
                onHecho={() => fichaId && void fichaCliente(fichaId).then(setFicha).catch(() => undefined)}
              />
            )}
          </section>
        )}

        <section ref={refLista} className="rounded-2xl bg-card p-5 ring-1 ring-border">
          {!lista ? (
            <Cargando />
          ) : lista.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">{archivados === "solo" ? "No hay clientes archivados." : "No hay clientes que coincidan."}</p>
              {busquedaValida(q) !== undefined && archivados === undefined && (
                <>
                  <p className="mt-2 text-sm text-muted-foreground">Si lleva más de 180 días sin comprar, puede estar archivado.</p>
                  <Button variant="secondary" className="mt-3" onClick={() => elegir("incluir")}>Buscar también en archivados</Button>
                </>
              )}
            </div>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {lista.map((c) => (
                <li key={c.negocio_cliente_id}>
                  <button
                    type="button"
                    onClick={() => void abrir(c.negocio_cliente_id)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="min-w-0 truncate text-base font-medium">{nombreCompleto(c)}</p>
                        {c.archivado && <Badge variant="secondary">Archivado</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {telefonoVisible(c.telefono)}
                        {!c.cuenta_activada && " · sin activar"}
                        {c.archivado && ` · desde ${diaDeInstante(c.archivado_en)}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-right">
                      {c.saldo_centavos !== null && <span className="block font-mono font-semibold tabular-nums">{pesos(c.saldo_centavos)}</span>}
                      {!!c.premios_por_canjear && <span className="block text-xs text-accent">{plural(c.premios_por_canjear, "premio", "premios")}</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {siguiente && (
            <Button variant="secondary" className="mt-4 w-full" onClick={() => void cargar(siguiente)}>
              Cargar más
            </Button>
          )}
        </section>
      </div>
    </AppShell>
  );
}
