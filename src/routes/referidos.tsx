import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { ApiError } from "@/lib/api/client";
import { referidos, type EstadoReferido, type MisReferidos } from "@/lib/api/cliente";
import { fechaCorta, pesos } from "@/lib/api/formato";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/plural";

export const Route = createFileRoute("/referidos")({
  head: () => ({
    meta: [
      { title: "Recomienda y gana · MiSaldo" },
      { name: "description", content: "Recomienda el negocio a tus amigos y gana saldo o sellos cuando hagan su compra." },
      { property: "og:title", content: "Recomienda y gana · MiSaldo" },
      { property: "og:description", content: "Mira a quién recomendaste y los premios que ya ganaste." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Recomienda y gana" roles={["cliente"]}>
      <Referidos />
    </RequiereSesion>
  ),
});

const ESTADO: Record<EstadoReferido, { l: string; c: string }> = {
  pendiente: { l: "Pendiente", c: "bg-warn/15 text-warn" },
  cumplido: { l: "Ganaste", c: "bg-primary/15 text-primary" },
  cumplido_sin_premio: { l: "Sin premio", c: "bg-secondary text-muted-foreground" },
  vencido: { l: "Venció", c: "bg-destructive/10 text-destructive" },
};

const textoPremio = (p: MisReferidos["recomendados"][number]["premio"]) =>
  p.modulo === "monedero" ? pesos(p.monto_centavos) : `${plural(p.sellos ?? 0, "sello", "sellos")}${p.tarjeta_nombre ? ` en ${p.tarjeta_nombre}` : ""}`;

function Referidos() {
  const [datos, setDatos] = useState<MisReferidos | null>(null);
  useEffect(() => {
    referidos().then(setDatos).catch((e) => toast.error(e instanceof ApiError ? e.message : "No se pudo cargar."));
  }, []);

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <h1 className="text-3xl font-semibold tracking-tight">Recomienda y gana</h1>
        {!datos ? (
          <Cargando />
        ) : (
          <>
            <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
              {datos.programa ? (
                <p className="text-base">
                  Gana <strong>{textoPremio(datos.programa.premio)}</strong>: tu amigo se registra en caja dando tu teléfono y hace una
                  compra de al menos <strong>{pesos(datos.programa.monto_minimo_centavos)}</strong> en {datos.programa.vigencia_dias} días.
                </p>
              ) : (
                <p className="text-muted-foreground">Este negocio no tiene el programa de recomendaciones activo.</p>
              )}
              {datos.me_recomendo && (
                <p className="mt-3 text-sm text-muted-foreground">Te recomendó {datos.me_recomendo.nombre}.</p>
              )}
            </section>
            <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
              <h2 className="text-lg font-semibold tracking-tight">Tus recomendados</h2>
              {datos.recomendados.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">Aún no recomiendas a nadie.</p>
              ) : (
                <ul className="mt-3 flex flex-col divide-y divide-border">
                  {datos.recomendados.map((r) => (
                    <li key={r.referido_id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{r.nombre}</p>
                        <p className="text-sm text-muted-foreground">
                          {r.estado === "pendiente" && r.ultimo_dia
                            ? `Tiene hasta el ${fechaCorta(r.ultimo_dia)}`
                            : r.motivo_sin_premio === "tope_mensual"
                              ? "Ya alcanzaste el máximo de premios del mes"
                              : r.motivo_sin_premio === "modulo_no_disponible"
                                ? "El negocio no tenía el premio disponible"
                                : `Desde ${fechaCorta(r.fecha_registro)}`}
                        </p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-3 py-1 text-xs font-semibold", ESTADO[r.estado].c)}>
                        {ESTADO[r.estado].l}
                      </span>
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
