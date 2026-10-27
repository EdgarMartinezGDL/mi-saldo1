import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { movimientos, type Cursor, type Movimiento } from "@/lib/api/cliente";
import { instante, pesos } from "@/lib/api/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/historial")({
  head: () => ({
    meta: [
      { title: "Historial · MiSaldo" },
      { name: "description", content: "Todos tus movimientos de saldo y sellos: lo que ganaste, usaste y venció." },
      { property: "og:title", content: "Historial · MiSaldo" },
      { property: "og:description", content: "Revisa cada compra, canje y ajuste de tu saldo y tus sellos." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Historial" roles={["cliente"]}>
      <Historial />
    </RequiereSesion>
  ),
});

type Filtro = "todos" | "monedero" | "tarjetas_sellos";
const FILTROS: { v: Filtro; l: string }[] = [
  { v: "todos", l: "Todo" },
  { v: "monedero", l: "Saldo" },
  { v: "tarjetas_sellos", l: "Sellos" },
];

function describir(m: Movimiento) {
  const saldo = m.modulo === "monedero";
  const monto = pesos(Math.abs(m.monto_centavos ?? 0));
  const sellos = Math.abs(m.cantidad ?? 0);
  switch (m.tipo) {
    case "acumulacion":
      if (saldo) return `Ganaste ${monto}${m.monto_compra_centavos ? ` (compra de ${pesos(m.monto_compra_centavos)})` : ""}`;
      return sellos === 0 ? "Compra registrada: suma hacia tu siguiente sello" : `+${sellos} ${sellos === 1 ? "sello" : "sellos"} en ${m.tarjeta ?? "tu tarjeta"}${m.monto_compra_centavos ? ` (compra de ${pesos(m.monto_compra_centavos)})` : ""}`;
    case "canje":
      return saldo ? `Usaste ${monto}` : (m.tarjeta ? `Canjeaste un premio de ${m.tarjeta}` : "Canjeaste un premio");
    case "ajuste_manual":
      return `Ajuste del negocio: ${m.motivo ?? ""}`;
    case "referido":
      return "Premio por recomendar a alguien";
    default:
      return saldo ? "Venció tu saldo" : "Vencieron tus sellos";
  }
}

function Historial() {
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [lista, setLista] = useState<Movimiento[] | null>(null);
  const [siguiente, setSiguiente] = useState<Cursor>(null);
  const [cargando, setCargando] = useState(false);

  const cargar = async (cursor: Cursor) => {
    setCargando(true);
    try {
      const r = await movimientos({ modulo: filtro === "todos" ? undefined : filtro, cursor });
      setLista((prev) => (cursor ? [...(prev ?? []), ...r.movimientos] : r.movimientos));
      setSiguiente(r.siguiente);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo cargar el historial.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    setLista(null);
    void cargar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtro]);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Historial</h1>
        <div className="flex gap-2">
          {FILTROS.map((f) => (
            <button
              key={f.v}
              type="button"
              onClick={() => setFiltro(f.v)}
              className={cn(
                "tap-target rounded-full px-4 text-sm font-semibold ring-1 transition-colors",
                filtro === f.v ? "bg-primary text-primary-foreground ring-primary" : "ring-border text-muted-foreground",
              )}
            >
              {f.l}
            </button>
          ))}
        </div>
        <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
          {!lista ? (
            <Cargando />
          ) : lista.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no tienes movimientos.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {lista.map((m) => {
                const positivo = (m.monto_centavos ?? m.cantidad ?? 0) >= 0;
                return (
                  <li key={m.movimiento_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-base font-medium">{describir(m)}</p>
                      <p className="text-sm text-muted-foreground">{instante(m.fecha)}</p>
                    </div>
                    <span className={cn("shrink-0 font-mono text-base font-semibold tabular-nums", positivo ? "text-primary" : "text-destructive")}>
                      {m.monto_centavos !== undefined
                        ? `${positivo ? "+" : "−"}${pesos(Math.abs(m.monto_centavos))}`
                        : m.cantidad !== undefined
                          ? `${positivo ? "+" : "−"}${Math.abs(m.cantidad)}`
                          : ""}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          {siguiente && (
            <Button variant="secondary" className="mt-4 w-full" disabled={cargando} onClick={() => void cargar(siguiente)}>
              {cargando ? "Cargando…" : "Cargar más"}
            </Button>
          )}
        </section>
        <Link to="/reclamaciones" className="block rounded-2xl bg-card p-5 ring-1 ring-border">
          <p className="text-base font-semibold">¿No se registró una compra?</p>
          <p className="mt-1 text-sm text-muted-foreground">Consulta el estado de tus reclamaciones aquí.</p>
        </Link>
      </div>
    </AppShell>
  );
}
