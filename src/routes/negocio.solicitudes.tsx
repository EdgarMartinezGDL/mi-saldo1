import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SeccionNegocio } from "@/components/negocio/comun";
import { CampoTexto, Chip, Confirmar, errorOperacion, Pestanas, useRecargarConteos } from "@/components/negocio/operacion-ui";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import { cancelarValidacion, validacionesAlta, type EstadoValidacion, type Validacion } from "@/lib/api/operacion";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";

export const Route = createFileRoute("/negocio/solicitudes")({
  head: () => ({
    meta: [
      { title: "Solicitudes de alta · MiSaldo" },
      { name: "description", content: "Altas que esperan la confirmación del titular del teléfono." },
      { property: "og:title", content: "Solicitudes de alta · MiSaldo" },
      { property: "og:description", content: "Estado de las altas pendientes de confirmar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio
      titulo="Solicitudes de alta"
      descripcion="Cuando un teléfono ya está registrado con otro nombre, el titular confirma desde su app o con el enlace que le enviamos. Aquí ves su estado y puedes cancelar si te equivocaste."
    >
      <Solicitudes />
    </SeccionNegocio>
  ),
});

const ESTADO: Record<EstadoValidacion, { texto: string; tono: "verde" | "ambar" | "rojo" | "gris" }> = {
  pendiente: { texto: "Pendiente", tono: "ambar" },
  confirmada: { texto: "Confirmada", tono: "verde" },
  rechazada: { texto: "Rechazada", tono: "rojo" },
  vencida: { texto: "Vencida", tono: "gris" },
  cancelada: { texto: "Cancelada", tono: "gris" },
};

function Solicitudes() {
  const [pestana, setPestana] = useState<"pendiente" | "todas">("pendiente");
  const [lista, setLista] = useState<Validacion[] | null>(null);
  const [cancelando, setCancelando] = useState<Validacion | null>(null);
  const [motivo, setMotivo] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const recargarConteos = useRecargarConteos();
  const refCancelando = useDesplazarAlAbrir(cancelando?.validacion_id, true);

  const cargar = async () => {
    try {
      const r = await validacionesAlta({ ...(pestana === "pendiente" ? { estado: "pendiente" as const } : {}), limite: 50 });
      setLista(r.validaciones);
    } catch (e) {
      errorOperacion(e);
      setLista([]);
    }
  };
  useEffect(() => {
    setLista(null);
    void cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pestana]);

  const ejecutar = async () => {
    if (!cancelando) return;
    try {
      await cancelarValidacion(cancelando.validacion_id, motivo.trim());
      toast.success("Solicitud cancelada");
      setConfirmar(false);
      setCancelando(null);
      void cargar();
      recargarConteos();
    } catch (e) {
      setConfirmar(false);
      errorOperacion(e);
      if (e instanceof ApiError && e.codigo === "ya_resuelta") {
        setCancelando(null);
        void cargar();
      }
    }
  };

  const motivoOk = motivo.trim().length >= 5 && motivo.trim().length <= 500;

  return (
    <>
      <Pestanas valor={pestana} onChange={setPestana} opciones={[["pendiente", "Pendientes"], ["todas", "Todas"]]} />
      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        {!lista ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">{pestana === "pendiente" ? "No hay solicitudes pendientes." : "No hay solicitudes."}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lista.map((v) => (
              <li key={v.validacion_id} className="flex flex-col gap-1 py-3">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0 text-base font-medium">{nombreCompleto(v.nombre_capturado)}</span>
                  <Chip tono={ESTADO[v.estado].tono}>{ESTADO[v.estado].texto}</Chip>
                </span>
                <span className="text-sm text-muted-foreground">
                  {telefonoVisible(v.telefono)} · {v.tipo === "cliente" ? "Cliente" : "Empleado"}
                  {v.capturado_por && ` · Capturó: ${v.capturado_por.nombre}`}
                </span>
                <span className="text-sm text-muted-foreground">
                  {instante(v.creado_en)}
                  {v.estado === "pendiente" && ` · Vence ${instante(v.expira_en)}`}
                </span>
                {v.estado === "rechazada" && <span className="text-sm text-red-400">El titular dijo que no es él</span>}
                {v.estado === "cancelada" && v.motivo_cancelacion && <span className="text-sm text-muted-foreground">Motivo: {v.motivo_cancelacion}</span>}
                {v.estado === "pendiente" &&
                  (cancelando?.validacion_id === v.validacion_id ? (
                    <div ref={refCancelando} className="mt-2 flex flex-col gap-2">
                      <CampoTexto etiqueta="Motivo" valor={motivo} onChange={setMotivo} />
                      <Button size="lg" variant="destructive" disabled={!motivoOk} onClick={() => setConfirmar(true)}>Cancelar solicitud</Button>
                      <Button variant="ghost" onClick={() => setCancelando(null)}>Volver</Button>
                    </div>
                  ) : (
                    <Button variant="secondary" className="mt-2 self-start" onClick={() => { setMotivo(""); setCancelando(v); }}>
                      Cancelar solicitud
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Confirmar
        abierto={confirmar}
        onAbierto={setConfirmar}
        titulo="¿Cancelar la solicitud?"
        descripcion={cancelando ? `${nombreCompleto(cancelando.nombre_capturado)} · ${telefonoVisible(cancelando.telefono)}` : undefined}
        boton="Sí, cancelar"
        accion={ejecutar}
      />
    </>
  );
}
