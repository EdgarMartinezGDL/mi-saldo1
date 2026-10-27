import { createFileRoute } from "@tanstack/react-router";
import { Gift, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { TarjetaMisCodigos } from "@/components/cuenta/mis-codigos";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { ApiError } from "@/lib/api/client";
import { resumen, type Resumen } from "@/lib/api/cliente";
import { pesos, textoCaducidad } from "@/lib/api/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/canjear")({
  head: () => ({
    meta: [
      { title: "Mis códigos · MiSaldo" },
      { name: "description", content: "Tu saldo y tus premios listos para cobrar en caja con tu código de canje." },
      { property: "og:title", content: "Mis códigos · MiSaldo" },
      { property: "og:description", content: "Dicta tu código de canje de 4 dígitos al cajero para usar saldo o premios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Canjear" roles={["cliente"]}>
      <Canjear />
    </RequiereSesion>
  ),
});

function Canjear() {
  const [datos, setDatos] = useState<Resumen | null>(null);
  useEffect(() => {
    resumen().then(setDatos).catch((e) => toast.error(e instanceof ApiError ? e.message : "No se pudo cargar."));
  }, []);

  const premios = (datos?.tarjetas ?? []).flatMap((t) => t.premios_por_canjear.map((p) => ({ ...p, tarjeta: t.nombre })));

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Mis códigos</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Dicta estos códigos en caja. Sirven en todos tus negocios. El cajero nunca debe pedirte tu PIN.
          </p>
        </div>
        <TarjetaMisCodigos />
        {!datos ? (
          <Cargando />
        ) : (
          <>
            {datos.monedero && (
              <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
                <p className="text-sm text-muted-foreground">Saldo para usar</p>
                <p className="mt-1 font-mono text-4xl font-bold tabular-nums">{pesos(datos.monedero.saldo_centavos, datos.negocio.moneda)}</p>
                <p className={cn("mt-2 text-sm font-medium", datos.monedero.vence_pronto ? "text-warn" : "text-muted-foreground")}>
                  {textoCaducidad(datos.monedero)}
                </p>
              </section>
            )}
            <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <h2 className="text-lg font-semibold tracking-tight">Premios listos</h2>
              {premios.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aún no tienes premios por cobrar.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {premios.map((p) => (
                    <li key={p.cliente_tarjeta_id} className="flex items-center gap-3 py-3">
                      <Gift className="size-5 shrink-0 text-accent" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{p.premio_texto}</p>
                        <p className={cn("flex items-center gap-1 text-sm", p.vence_pronto ? "text-warn" : "text-muted-foreground")}>
                          {p.vence_pronto && <TriangleAlert className="size-3.5" />} {p.tarjeta} · {textoCaducidad(p)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
