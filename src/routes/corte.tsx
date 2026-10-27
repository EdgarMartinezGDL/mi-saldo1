import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LayoutDashboard } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { miJornada, type MovimientoJornada } from "@/components/caja/caja-extra";
import { fechaCorta, nombreCompleto, pesos, telefonoVisible } from "@/lib/api/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/corte")({
  head: () => ({
    meta: [
      { title: "Mi jornada · MiSaldo" },
      { name: "description", content: "Totales y movimientos de la jornada del cajero, de 5:00 a 5:00." },
      { property: "og:title", content: "Mi jornada · MiSaldo" },
      { property: "og:description", content: "Lo que acumulaste y canjeaste en tu jornada de caja." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Mi jornada" roles={["empleado", "dueno"]}>
      <Jornada />
    </RequiereSesion>
  ),
});

const TIPO: Record<MovimientoJornada["tipo"], string> = {
  acumulacion: "Acumulación", canje: "Canje", ajuste_manual: "Ajuste", expiracion: "Expiración", vencimiento: "Vencimiento", referido: "Referido",
};

function Total({ titulo, valor, className }: { titulo: string; valor: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl bg-card p-4 ring-1 ring-border", className)}>
      <p className="text-sm text-muted-foreground">{titulo}</p>
      <p className="mt-1 font-mono text-2xl font-bold tabular-nums">{valor}</p>
    </div>
  );
}

function Jornada() {
  const { sesion } = useAuth();
  const empleado = sesion?.contexto.rol === "empleado";
  const [extra, setExtra] = useState<MovimientoJornada[]>([]);
  const [cursor, setCursor] = useState<{ antes_de: string; antes_id: string } | null | undefined>(undefined);
  const [cargandoMas, setCargandoMas] = useState(false);
  const q = useQuery({ queryKey: ["mi-jornada"], queryFn: () => miJornada(), enabled: empleado });

  if (!empleado) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-2xl bg-card p-6 ring-1 ring-border">
          <h1 className="text-2xl font-semibold tracking-tight">Mi jornada</h1>
          <p className="mt-2 text-muted-foreground">El resumen del negocio y de cada cajero está en tu Panel.</p>
          <Button asChild size="lg" className="mt-5 w-full"><Link to="/panel"><LayoutDashboard className="size-5" /> Ir al Panel</Link></Button>
        </div>
      </AppShell>
    );
  }

  const d = q.data;
  const siguiente = cursor === undefined ? d?.siguiente ?? null : cursor;
  const movimientos = [...(d?.movimientos ?? []), ...extra];
  const mas = async () => {
    if (!siguiente) return;
    setCargandoMas(true);
    try {
      const r = await miJornada(siguiente);
      setExtra((e) => [...e, ...r.movimientos]);
      setCursor(r.siguiente);
    } finally {
      setCargandoMas(false);
    }
  };
  const hora = (iso: string) => new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "2-digit", timeZone: d?.jornada.zona_horaria ?? "America/Mexico_City" }).format(new Date(iso));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mi jornada</h1>
          <p className="mt-1 text-base text-muted-foreground">{d ? `Jornada del ${fechaCorta(d.jornada.fecha)} · de 5:00 a 5:00` : "Tus movimientos de hoy"}</p>
        </div>
        {q.isLoading && <Cargando />}
        {q.isError && (
          <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
            <p className="font-semibold">{q.error instanceof Error ? q.error.message : "No se pudo cargar tu jornada."}</p>
            <Button size="lg" className="mt-3" onClick={() => void q.refetch()}>Intentar de nuevo</Button>
          </div>
        )}
        {d && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {d.totales.monedero && <>
                <Total titulo="Ventas con saldo" valor={pesos(d.totales.monedero.ventas_centavos)} />
                <Total titulo="Cashback dado" valor={pesos(d.totales.monedero.cashback_centavos)} />
                <Total titulo={`Canjes (${d.totales.monedero.canjes})`} valor={pesos(d.totales.monedero.canjes_centavos)} />
              </>}
              {d.totales.tarjetas && <>
                <Total titulo="Sellos dados" valor={String(d.totales.tarjetas.sellos_otorgados)} />
                <Total titulo="Premios entregados" valor={String(d.totales.tarjetas.premios_canjeados)} />
              </>}
            </div>
            {movimientos.length === 0 ? (
              <p className="rounded-2xl bg-card p-6 text-center text-muted-foreground ring-1 ring-border">Aún no tienes movimientos en esta jornada.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {movimientos.map((m) => {
                  const sellos = m.modulo === "tarjetas_sellos";
                  const negativo = m.tipo === "canje";
                  const valor = sellos ? `${negativo ? "−" : "+"}${m.cantidad ?? 0} ${m.cantidad === 1 ? "sello" : "sellos"}` : `${negativo ? "−" : "+"}${pesos(Math.abs(m.monto_centavos ?? 0))}`;
                  return (
                    <li key={m.movimiento_id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-card p-4 ring-1 ring-border">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold">{nombreCompleto(m.cliente)}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {hora(m.fecha)} · {TIPO[m.tipo]}{m.tarjeta ? ` · ${m.tarjeta.nombre}` : ""} · {telefonoVisible(m.cliente.telefono)}
                        </p>
                      </div>
                      <span className={cn("shrink-0 font-mono text-lg font-bold tabular-nums", negativo ? "text-warn" : "text-primary")}>{valor}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {siguiente && <Button variant="outline" size="lg" disabled={cargandoMas} onClick={() => void mas()}>{cargandoMas ? "Cargando…" : "Ver más"}</Button>}
          </>
        )}
      </div>
    </AppShell>
  );
}
