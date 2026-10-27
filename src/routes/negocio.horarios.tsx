import { useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ConConfig, SeccionNegocio, useConfigNegocio } from "@/components/negocio/comun";
import { Confirmar, errorOperacion } from "@/components/negocio/operacion-ui";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { ConfiguracionNegocio, Horario } from "@/lib/api/caja";
import { guardarHorarios } from "@/lib/api/marketing";

export const Route = createFileRoute("/negocio/horarios")({
  validateSearch: validarBusquedaAsistente,
  head: () => ({
    meta: [
      { title: "Horarios · MiSaldo" },
      { name: "description", content: "Los días y horas en que abre tu negocio." },
      { property: "og:title", content: "Horarios · MiSaldo" },
      { property: "og:description", content: "Configura los días y horas en que abres." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Horarios" descripcion="Los días y horas en que abres.">
      <ConConfig>{(c) => <Horarios cfg={c} />}</ConConfig>
    </SeccionNegocio>
  ),
});

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN = [1, 2, 3, 4, 5, 6, 0];
const corta = (h: string | null) => (h ? h.slice(0, 5) : null);

function inicial(cfg: ConfiguracionNegocio): Horario[] {
  const h = cfg.horarios ?? [];
  return [0, 1, 2, 3, 4, 5, 6].map((d) => {
    const x = h.find((y) => y.dia_semana === d);
    if (x) return { ...x, hora_apertura: corta(x.hora_apertura), hora_cierre: corta(x.hora_cierre) };
    return d === 0 || h.length > 0
      ? { dia_semana: d, cerrado: true, hora_apertura: null, hora_cierre: null }
      : { dia_semana: d, cerrado: false, hora_apertura: "09:00", hora_cierre: "19:00" };
  });
}

export function Horarios({ cfg }: { cfg: ConfiguracionNegocio }) {
  const invalidarAsistente = useInvalidarAsistente();
  const { actualizar } = useConfigNegocio();
  const conTotp = useConTotp();
  const { editando, valores: dias, setValores: setDias, editar, cancelar, terminar, guardado, cambiado, ref } = useModoEdicion(inicial(cfg));
  const [confirmar, setConfirmar] = useState(false);
  const vacio = (cfg.horarios ?? []).length === 0;
  const cambiar = (d: number, p: Partial<Horario>) => setDias((xs) => xs.map((x) => (x.dia_semana === d ? { ...x, ...p } : x)));
  const faltan = dias.some((x) => !x.cerrado && (!x.hora_apertura || !x.hora_cierre || x.hora_apertura === x.hora_cierre));

  const copiar = () => {
    const primero = ORDEN.map((d) => dias[d]!).find((x) => !x.cerrado);
    if (!primero) return;
    setDias((xs) => xs.map((x) => (x.cerrado ? x : { ...x, hora_apertura: primero.hora_apertura, hora_cierre: primero.hora_cierre })));
  };

  const guardar = async () => {
    const cuerpo = dias.map((x) => (x.cerrado ? { ...x, hora_apertura: null, hora_cierre: null } : x));
    try {
      const r = await conTotp(() => guardarHorarios(cuerpo));
      invalidarAsistente();
      actualizar((c) => ({ ...c, horarios: Array.isArray(r) ? r : cuerpo }));
      toast.success("Horarios guardados");
      setConfirmar(false);
      terminar(cuerpo);
    } catch (e) {
      setConfirmar(false);
      errorOperacion(e, undefined, { horarios_invalidos: "Revisa los horarios: alguno no es válido." });
    }
  };

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      {vacio && <p className="mb-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-400 ring-1 ring-amber-400/30">Aún no configuras tus horarios</p>}
      {editando ? (
        <div ref={ref} className="flex flex-col gap-4">
          <ul className="flex flex-col divide-y divide-border">
            {ORDEN.map((d) => {
              const x = dias[d]!;
              const cruza = !x.cerrado && x.hora_apertura && x.hora_cierre && x.hora_cierre < x.hora_apertura;
              return (
                <li key={d} className="flex flex-col gap-2 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-base font-semibold">{DIAS[d]}</span>
                    <label className="flex items-center gap-2 text-sm">
                      {x.cerrado ? "Cerrado" : "Abierto"}
                      <Switch
                        checked={!x.cerrado}
                        onCheckedChange={(v) => cambiar(d, v ? { cerrado: false, hora_apertura: x.hora_apertura ?? "09:00", hora_cierre: x.hora_cierre ?? "19:00" } : { cerrado: true })}
                        aria-label={`${DIAS[d]} abierto`}
                      />
                    </label>
                  </div>
                  {!x.cerrado && (
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="time" aria-label={`${DIAS[d]}: abre`} value={x.hora_apertura ?? ""} onChange={(e) => cambiar(d, { hora_apertura: e.target.value })}
                        className="h-12 rounded-xl border border-border bg-card px-3 text-base shadow-soft" />
                      <span className="text-muted-foreground">a</span>
                      <input type="time" aria-label={`${DIAS[d]}: cierra`} value={x.hora_cierre ?? ""} onChange={(e) => cambiar(d, { hora_cierre: e.target.value })}
                        className="h-12 rounded-xl border border-border bg-card px-3 text-base shadow-soft" />
                      {cruza && <span className="text-sm text-amber-400">Cierra al día siguiente</span>}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button variant="secondary" size="lg" className="tap-target h-12" onClick={copiar}>Copiar a todos los días abiertos</Button>
          </div>
          {faltan && <p className="text-sm text-destructive">Cada día abierto necesita hora de apertura y de cierre distintas.</p>}
          <BotonesEdicion textoGuardar="Guardar horarios" cambiado={(cambiado || vacio) && !faltan} onGuardar={() => setConfirmar(true)} onCancelar={cancelar} />
        </div>
      ) : (
        <VistaLectura
          onEditar={editar}
          datos={ORDEN.map((d) => {
            const x = guardado[d]!;
            return { etiqueta: DIAS[d]!, valor: x.cerrado ? "Cerrado" : `${x.hora_apertura} a ${x.hora_cierre}` };
          })}
        />
      )}
      <Confirmar abierto={confirmar} onAbierto={setConfirmar} titulo="¿Guardar los horarios?" descripcion="Se reemplazan los horarios de toda la semana." boton="Sí, guardar" accion={guardar} />
    </section>
  );
}
