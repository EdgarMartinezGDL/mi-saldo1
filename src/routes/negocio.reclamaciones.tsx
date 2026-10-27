import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SeccionNegocio } from "@/components/negocio/comun";
import { CampoTexto, Chip, Confirmar, errorOperacion, FilaMovimiento, Pestanas, useRecargarConteos } from "@/components/negocio/operacion-ui";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { ApiError } from "@/lib/api/client";
import { aCentavos, fechaCorta, instante, nombreCompleto, pesos } from "@/lib/api/formato";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import {
  aprobarReclamacion,
  cancelarReclamacion,
  rechazarReclamacion,
  reclamacion as detalleReclamacion,
  reclamaciones,
  type ConsultaHistorial,
  type EstadoReclamacion,
  type Reclamacion,
  type Siguiente,
} from "@/lib/api/operacion";

export const Route = createFileRoute("/negocio/reclamaciones")({
  head: () => ({
    meta: [
      { title: "Reclamaciones · MiSaldo" },
      { name: "description", content: "Compras que no se registraron: apruébalas, recházalas o cancélalas." },
      { property: "og:title", content: "Reclamaciones · MiSaldo" },
      { property: "og:description", content: "Revisa las reclamaciones de compras no registradas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Reclamaciones" descripcion="Compras que no se registraron.">
      <Reclamaciones />
    </SeccionNegocio>
  ),
});

const ESTADO: Record<EstadoReclamacion, { texto: string; tono: "verde" | "ambar" | "rojo" | "gris" }> = {
  pendiente: { texto: "Pendiente", tono: "ambar" },
  aprobada: { texto: "Aprobada", tono: "verde" },
  rechazada: { texto: "Rechazada", tono: "rojo" },
  cancelada: { texto: "Cancelada", tono: "gris" },
};

const esSaldo = (r: Reclamacion) => r.modulo === "monedero";
const cantidadTexto = (r: Reclamacion, n: number) =>
  esSaldo(r) ? pesos(n) : `${n} ${n === 1 ? "sello" : "sellos"}${r.tarjeta ? ` de ${r.tarjeta.nombre}` : ""}`;
const reclamado = (r: Reclamacion) =>
  `${esSaldo(r) ? `${pesos(r.cantidad_reclamada)} de saldo` : cantidadTexto(r, r.cantidad_reclamada)}${
    r.estado === "aprobada" && r.cantidad_aprobada !== null && r.cantidad_aprobada !== r.cantidad_reclamada
      ? ` · se abonaron ${esSaldo(r) ? pesos(r.cantidad_aprobada) : `${r.cantidad_aprobada} ${r.cantidad_aprobada === 1 ? "sello" : "sellos"}`}`
      : ""
  }`;

function Reclamaciones() {
  const [pestana, setPestana] = useState<"pendiente" | "todas">("pendiente");
  const [lista, setLista] = useState<Reclamacion[] | null>(null);
  const [siguiente, setSiguiente] = useState<Siguiente>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const recargarConteos = useRecargarConteos();
  const refLista = useDesplazarAlAbrir(lista?.length);

  const cargar = async (cursor: Siguiente) => {
    try {
      const r = await reclamaciones({ ...(pestana === "pendiente" ? { estado: "pendiente" as const } : {}), limite: 50, ...(cursor ?? {}) });
      setLista((p) => (cursor ? [...(p ?? []), ...r.reclamaciones] : r.reclamaciones));
      setSiguiente(r.siguiente ?? null);
    } catch (e) {
      errorOperacion(e);
      if (!cursor) setLista([]);
    }
  };

  useEffect(() => {
    setLista(null);
    void cargar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana]);

  const alResolver = () => {
    setAbierta(null);
    void cargar(null);
    recargarConteos();
  };

  return (
    <>
      <Pestanas valor={pestana} onChange={setPestana} opciones={[["pendiente", "Pendientes"], ["todas", "Todas"]]} />
      <section ref={refLista} className="rounded-2xl bg-card p-5 ring-1 ring-border">
        {!lista ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pestana === "pendiente" ? "No hay reclamaciones pendientes." : "No hay reclamaciones."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lista.map((r) => (
              <li key={r.reclamacion_id}>
                <button type="button" onClick={() => setAbierta(r.reclamacion_id)} className="flex w-full flex-col gap-1 py-3 text-left">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-mono font-semibold">{r.folio}</span>
                    <Chip tono={ESTADO[r.estado].tono}>{ESTADO[r.estado].texto}</Chip>
                  </span>
                  <span className="text-base font-medium">{nombreCompleto(r.cliente)} · {reclamado(r)}</span>
                  <span className="text-sm text-muted-foreground">
                    Compra del {fechaCorta(r.fecha_compra)}
                    {r.creado_por && ` · Levantó: ${r.creado_por.nombre}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {siguiente && (
          <Button variant="secondary" className="mt-4 w-full" onClick={() => void cargar(siguiente)}>Cargar más</Button>
        )}
      </section>
      <Detalle id={abierta} onCerrar={() => setAbierta(null)} onResuelta={alResolver} />
    </>
  );
}

type Accion = "aprobar" | "rechazar" | "cancelar" | null;

function Detalle({ id, onCerrar, onResuelta }: { id: string | null; onCerrar: () => void; onResuelta: () => void }) {
  const movil = useIsMobile();
  const conTotp = useConTotp();
  const [datos, setDatos] = useState<{ reclamacion: Reclamacion; historial: ConsultaHistorial } | null>(null);
  const [accion, setAccion] = useState<Accion>(null);
  const [cantidad, setCantidad] = useState("");
  const [nota, setNota] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const refAccion = useDesplazarAlAbrir(accion, true);

  useEffect(() => {
    setDatos(null);
    setAccion(null);
    if (!id) return;
    detalleReclamacion(id).then(setDatos).catch((e) => {
      errorOperacion(e);
      onCerrar();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const r = datos?.reclamacion;
  const elegir = (a: Accion) => {
    setAccion(a);
    setNota("");
    if (r) setCantidad(esSaldo(r) ? (r.cantidad_reclamada / 100).toFixed(2) : String(r.cantidad_reclamada));
  };
  const cantidadNum = r ? (esSaldo(r) ? aCentavos(cantidad) : Number.parseInt(cantidad, 10) || 0) : 0;
  const notaOk = accion === "aprobar" ? nota.trim().length <= 400 : nota.trim().length >= 5 && nota.trim().length <= 500;
  const listo = !!accion && notaOk && (accion !== "aprobar" || cantidadNum > 0);

  const ejecutar = async () => {
    if (!r || !accion) return;
    const n = nota.trim();
    try {
      if (accion === "aprobar") {
        await conTotp(() =>
          aprobarReclamacion(r.reclamacion_id, {
            ...(cantidadNum !== r.cantidad_reclamada ? { cantidad: cantidadNum } : {}),
            ...(n ? { nota: n } : {}),
          }),
        );
        toast.success(`Aprobada: se abonó ${cantidadTexto(r, cantidadNum)} y le avisamos al cliente`);
      } else if (accion === "rechazar") {
        await rechazarReclamacion(r.reclamacion_id, n);
        toast.success("Rechazada");
      } else {
        await cancelarReclamacion(r.reclamacion_id, n);
        toast.success("Cancelada");
      }
      setConfirmar(false);
      onResuelta();
    } catch (e) {
      setConfirmar(false);
      errorOperacion(e);
      if (e instanceof ApiError && e.codigo === "ya_resuelta") onResuelta();
    }
  };

  const tituloConfirmar = !r
    ? ""
    : accion === "aprobar"
      ? `¿Aprobar y abonar ${cantidadTexto(r, cantidadNum)} a ${nombreCompleto(r.cliente)}?`
      : accion === "rechazar"
        ? "¿Rechazar la reclamación?"
        : "¿Cancelar por error de captura?";

  return (
    <Sheet open={!!id} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side={movil ? "bottom" : "right"} className="max-h-[92vh] overflow-y-auto pb-10 sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{r ? `Reclamación ${r.folio}` : "Reclamación"}</SheetTitle>
        </SheetHeader>
        {!r ? (
          <Cargando />
        ) : (
          <div className="mt-4 flex flex-col gap-4 px-1">
            <div className="flex flex-col gap-1">
              <Chip tono={ESTADO[r.estado].tono}>{ESTADO[r.estado].texto}</Chip>
              <p className="mt-2 text-lg font-semibold">{nombreCompleto(r.cliente)}</p>
              <p className="text-base">{reclamado(r)}</p>
              <p className="text-sm">{r.descripcion}</p>
              <p className="text-sm text-muted-foreground">Ticket: {r.referencia_ticket ?? "sin ticket"}</p>
              <p className="text-sm text-muted-foreground">Compra del {fechaCorta(r.fecha_compra)} · Levantada {instante(r.creado_en)}{r.creado_por && ` por ${r.creado_por.nombre}`}</p>
              {r.estado !== "pendiente" && (
                <div className="mt-2 rounded-xl p-3 text-sm ring-1 ring-border">
                  <p>Resolvió: {r.resuelto_por ? nombreCompleto(r.resuelto_por) : "—"}{r.resuelto_en && ` · ${instante(r.resuelto_en)}`}</p>
                  {r.cantidad_aprobada !== null && r.estado === "aprobada" && <p>Aprobado: {cantidadTexto(r, r.cantidad_aprobada)}</p>}
                  {r.resolucion_nota && <p>Nota: {r.resolucion_nota}</p>}
                </div>
              )}
            </div>

            <div>
              <h3 className="font-semibold">Movimientos alrededor de la compra</h3>
              {datos.historial.movimientos.length === 0 ? (
                <p className="mt-1 text-sm text-muted-foreground">No hay movimientos de ese día</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {datos.historial.movimientos.map((m) => <FilaMovimiento key={m.movimiento_id} m={m} />)}
                </ul>
              )}
            </div>

            {r.estado === "pendiente" && (
              <div ref={refAccion} className="flex flex-col gap-3 border-t border-border pt-4">
                {!accion ? (
                  <>
                    <Button size="lg" onClick={() => elegir("aprobar")}>Aprobar</Button>
                    <Button size="lg" variant="secondary" onClick={() => elegir("rechazar")}>Rechazar</Button>
                    <Button size="lg" variant="ghost" onClick={() => elegir("cancelar")}>Cancelar por error de captura</Button>
                  </>
                ) : (
                  <>
                    {accion === "aprobar" && (
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        {esSaldo(r) ? "Cantidad a abonar (pesos)" : "Sellos a abonar"}
                        <Input
                          inputMode={esSaldo(r) ? "decimal" : "numeric"}
                          className="h-12 text-base"
                          value={cantidad}
                          onChange={(e) => setCantidad(esSaldo(r) ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value.replace(/\D/g, ""))}
                        />
                      </label>
                    )}
                    <CampoTexto
                      etiqueta={accion === "aprobar" ? "Nota (opcional)" : accion === "rechazar" ? "Nota" : "Motivo"}
                      ayuda={accion === "cancelar" ? "No se le avisa al cliente" : "El cliente la leerá"}
                      max={accion === "aprobar" ? 400 : 500}
                      valor={nota}
                      onChange={setNota}
                    />
                    <Button size="lg" disabled={!listo} onClick={() => setConfirmar(true)}>
                      {accion === "aprobar" ? "Aprobar" : accion === "rechazar" ? "Rechazar" : "Cancelar reclamación"}
                    </Button>
                    <Button variant="ghost" onClick={() => setAccion(null)}>Volver</Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        <Confirmar abierto={confirmar} onAbierto={setConfirmar} titulo={tituloConfirmar} boton="Sí, continuar" accion={ejecutar} />
      </SheetContent>
    </Sheet>
  );
}
