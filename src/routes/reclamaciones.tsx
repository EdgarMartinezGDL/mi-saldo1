import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/auth-provider";
import { Cargando, RequiereSesion } from "@/components/requiere-sesion";
import { ApiError } from "@/lib/api/client";
import { reclamaciones, type EstadoReclamacion, type Reclamacion } from "@/lib/api/cliente";
import { fechaCorta, instante, pesos } from "@/lib/api/formato";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/reclamaciones")({
  head: () => ({
    meta: [
      { title: "Reclamaciones · MiSaldo" },
      {
        name: "description",
        content: "Consulta el folio, el estado y la resolución de tus reclamaciones.",
      },
      { property: "og:title", content: "Reclamaciones · MiSaldo" },
      {
        property: "og:description",
        content: "Consulta el folio, el estado y la resolución de tus reclamaciones.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <RequiereSesion titulo="Reclamaciones" roles={["cliente"]}>
      <MisReclamaciones />
    </RequiereSesion>
  ),
});

const ESTADO_STYLE: Record<EstadoReclamacion, string> = {
  pendiente: "text-warn",
  aprobada: "text-primary",
  rechazada: "text-destructive",
  cancelada: "text-muted-foreground",
};

function MisReclamaciones() {
  const { sesion } = useAuth();
  const [lista, setLista] = useState<Reclamacion[] | null>(null);

  useEffect(() => {
    reclamaciones()
      .then((r) => setLista(r.reclamaciones))
      .catch((e) => toast.error(e instanceof ApiError ? e.message : "No se pudieron cargar tus reclamaciones."));
  }, [sesion?.contexto.negocio_id]);

  if (!lista) {
    return (
      <AppShell>
        <Cargando />
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Reclamaciones</h1>
          <p className="mt-1 text-base text-muted-foreground">
            Si una compra no se te registró, la reclamación la levanta el cajero del negocio: te llega un WhatsApp con el
            folio. Aquí solo consultas el estado.
          </p>
        </div>

        {lista.length === 0 ? (
          <section className="rounded-2xl bg-card p-6 ring-1 ring-border">
            <p className="text-base font-semibold">No tienes reclamaciones</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Cuando el negocio registre una reclamación a tu nombre, aparecerá aquí con su folio y estado.
            </p>
          </section>
        ) : (
          <section className="flex flex-col gap-3">
            {lista.map((r) => (
              <article key={r.reclamacion_id} className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold">
                      {r.modulo === "monedero" ? pesos(r.cantidad_reclamada) : `${r.cantidad_reclamada} sellos`}
                      {r.tarjeta ? ` · ${r.tarjeta.nombre}` : ""}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {r.folio} · Compra del {fechaCorta(r.fecha_compra)}
                      {r.referencia_ticket ? ` · Ticket ${r.referencia_ticket}` : ""}
                    </p>
                  </div>
                  <span className={cn("pill-badge shrink-0 capitalize", ESTADO_STYLE[r.estado])}>{r.estado}</span>
                </div>

                {r.descripcion && <p className="mt-2 text-sm text-muted-foreground">{r.descripcion}</p>}

                {r.estado !== "pendiente" && (
                  <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
                    {r.cantidad_aprobada !== null && (
                      <p className="font-semibold">
                        {r.estado === "aprobada"
                          ? r.modulo === "monedero"
                            ? `Se abonaron ${pesos(r.cantidad_aprobada)} a tu saldo.`
                            : `Se abonaron ${r.cantidad_aprobada} sellos.`
                          : r.modulo === "monedero"
                            ? `Reclamaste ${pesos(r.cantidad_reclamada)}; no se abonó nada.`
                            : `Reclamaste ${r.cantidad_reclamada} sellos; no se abonó nada.`}
                      </p>
                    )}
                    {r.resolucion_nota && <p className="mt-1 text-muted-foreground">{r.resolucion_nota}</p>}
                    {r.resuelto_en && (
                      <p className="mt-1 text-xs text-muted-foreground">Resuelta el {instante(r.resuelto_en)}</p>
                    )}
                  </div>
                )}

                {r.estado === "pendiente" && (
                  <p className="mt-3 text-sm font-medium text-warn">
                    En revisión por el negocio. Te avisaremos cuando haya respuesta.
                  </p>
                )}

                <p className="mt-2 text-xs text-muted-foreground">Levantada el {instante(r.creado_en)}</p>
              </article>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
