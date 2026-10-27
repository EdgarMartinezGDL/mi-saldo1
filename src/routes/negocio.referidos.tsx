import { useInvalidarAsistente, validarBusquedaAsistente } from "@/components/negocio/asistente";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConConfig, SeccionNegocio } from "@/components/negocio/comun";
import { Chip, Confirmar, errorOperacion, Pestanas } from "@/components/negocio/operacion-ui";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ConfiguracionNegocio } from "@/lib/api/caja";
import { aCentavos, fechaCorta, instante, pesos } from "@/lib/api/formato";
import {
  configReferidos,
  guardarConfigReferidos,
  listaReferidos,
  type ConfigReferidos,
  type CuerpoReferidos,
  type EstadoReferido,
  type Referido,
  type SiguienteRef,
} from "@/lib/api/marketing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/negocio/referidos")({
  validateSearch: validarBusquedaAsistente,
  head: () => ({
    meta: [
      { title: "Recomienda y gana · MiSaldo" },
      { name: "description", content: "Premia a tus clientes por traer clientes nuevos." },
      { property: "og:title", content: "Recomienda y gana · MiSaldo" },
      { property: "og:description", content: "Configura el programa de recomendaciones de tu negocio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Recomienda y gana" descripcion="Premia a tus clientes por traer clientes nuevos.">
      <ConConfig>{(c) => <Referidos cfg={c} />}</ConConfig>
    </SeccionNegocio>
  ),
});

const MENSAJES = {
  sin_captura_monto: "Para activarlo necesitas monedero o una tarjeta de sellos por monto",
  modulo_no_disponible: "El módulo del premio no está activo en tu negocio.",
  sin_configuracion: "Primero configura el cashback o la tarjeta del premio.",
  tarjeta_no_encontrada: "Esa tarjeta ya no está disponible.",
  configuracion_invalida: "Revisa los datos del formulario",
};

function Referidos({ cfg }: { cfg: ConfiguracionNegocio }) {
  const q = useQuery({ queryKey: ["referidos-config"], queryFn: configReferidos });
  if (q.error) return <p className="rounded-xl bg-destructive/10 p-4 text-destructive">{q.error.message}</p>;
  if (!q.data) return <Cargando />;
  return (
    <>
      <Formulario cfg={cfg} rc={q.data} />
      <Lista />
    </>
  );
}

type ValoresRef = {
  activo: boolean;
  minimo: string;
  modulo: "monedero" | "tarjetas_sellos";
  montoPremio: string;
  cantidad: string;
  tarjeta: string;
  tope: string;
};

function Formulario({ cfg, rc }: { cfg: ConfiguracionNegocio; rc: ConfigReferidos }) {
  const invalidarAsistente = useInvalidarAsistente();
  const qc = useQueryClient();
  const conTotp = useConTotp();
  const activas = (cfg.tarjetas ?? []).filter((t) => t.activa);
  const conMonedero = cfg.modulos.includes("monedero");
  const inicial: ValoresRef = {
    activo: rc.activo,
    minimo: rc.monto_minimo_centavos ? (rc.monto_minimo_centavos / 100).toFixed(2) : "",
    modulo: rc.premio_modulo ?? (conMonedero ? "monedero" : "tarjetas_sellos"),
    montoPremio: rc.premio_monto_centavos ? (rc.premio_monto_centavos / 100).toFixed(2) : "",
    cantidad: rc.premio_sellos_cantidad ? String(rc.premio_sellos_cantidad) : "",
    tarjeta: rc.premio_tarjeta_id ?? activas[0]?.tarjeta_digital_id ?? "",
    tope: String(rc.tope_mensual ?? 10),
  };
  const { editando, valores, set, editar, cancelar, terminar, guardado, cambiado, ref } = useModoEdicion(inicial);
  const [confirmar, setConfirmar] = useState(false);

  const min = aCentavos(valores.minimo);
  const premio = aCentavos(valores.montoPremio);
  const cant = Number(valores.cantidad);
  const t = Number(valores.tope);
  const error =
    min <= 0 ? "Escribe la compra mínima del cliente nuevo." :
    valores.modulo === "monedero" && premio <= 0 ? "Escribe el monto del premio." :
    valores.modulo === "tarjetas_sellos" && (!Number.isInteger(cant) || cant < 1 || cant > 100) ? "Los sellos del premio van de 1 a 100." :
    valores.modulo === "tarjetas_sellos" && !activas.some((x) => x.tarjeta_digital_id === valores.tarjeta) ? "Elige una tarjeta activa." :
    !Number.isInteger(t) || t < 1 || t > 100 ? "El máximo de premios al mes va de 1 a 100." : null;
  const deshabilitado = !rc.disponible;

  const guardar = async () => {
    const base = { activo: valores.activo, monto_minimo_centavos: min, tope_mensual: t };
    const cuerpo: CuerpoReferidos =
      valores.modulo === "monedero"
        ? { ...base, premio_modulo: "monedero", premio_monto_centavos: premio }
        : { ...base, premio_modulo: "tarjetas_sellos", premio_sellos_cantidad: cant, premio_tarjeta_id: valores.tarjeta };
    try {
      const r = await conTotp(() => guardarConfigReferidos(cuerpo));
      invalidarAsistente();
      qc.setQueryData(["referidos-config"], r);
      void qc.invalidateQueries({ queryKey: ["referidos-lista"] });
      toast.success(valores.activo ? "Programa guardado" : "Programa apagado", { description: valores.activo ? undefined : "Las recomendaciones pendientes se respetan hasta que venzan" });
      setConfirmar(false);
      terminar(valores);
    } catch (e) {
      setConfirmar(false);
      errorOperacion(e, undefined, MENSAJES);
    }
  };

  const campo = "h-12 text-base";
  const premioTexto = (v: ValoresRef) =>
    v.modulo === "monedero"
      ? `${pesos(aCentavos(v.montoPremio))} de saldo`
      : `${v.cantidad || 0} sellos de ${activas.find((x) => x.tarjeta_digital_id === v.tarjeta)?.nombre ?? ""}`;

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      {deshabilitado && <p className="mb-4 rounded-xl bg-amber-400/10 p-3 text-sm text-amber-400 ring-1 ring-amber-400/30">Para activarlo necesitas monedero o una tarjeta de sellos por monto</p>}
      {editando ? (
        <div ref={ref}>
          <fieldset disabled={deshabilitado} className="flex flex-col gap-4 disabled:opacity-60">
            <label className="flex items-center justify-between gap-3 text-base font-semibold">
              Programa activo
              <Switch checked={valores.activo} onCheckedChange={(v) => set("activo", v)} disabled={deshabilitado} />
            </label>
            {!valores.activo && rc.activo && <p className="text-sm text-muted-foreground">Las recomendaciones pendientes se respetan hasta que venzan</p>}
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-min" className="text-base">Compra mínima del cliente nuevo (pesos)</Label>
              <Input id="r-min" inputMode="decimal" value={valores.minimo} onChange={(e) => set("minimo", e.target.value.replace(/[^\d.]/g, ""))} placeholder="200" className={campo} />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-base font-medium">Premio para quien recomienda</span>
              <Pestanas
                valor={valores.modulo}
                onChange={(v) => set("modulo", v)}
                opciones={[...(conMonedero ? ([["monedero", "Saldo"]] as [typeof valores.modulo, string][]) : []), ...(activas.length ? ([["tarjetas_sellos", "Sellos"]] as [typeof valores.modulo, string][]) : [])]}
              />
              {valores.modulo === "monedero" ? (
                <Input aria-label="Monto del premio en pesos" inputMode="decimal" value={valores.montoPremio} onChange={(e) => set("montoPremio", e.target.value.replace(/[^\d.]/g, ""))} placeholder="50" className={campo} />
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input aria-label="Cantidad de sellos" inputMode="numeric" value={valores.cantidad} onChange={(e) => set("cantidad", e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="2" className={campo} />
                  <select aria-label="Tarjeta" value={valores.tarjeta} onChange={(e) => set("tarjeta", e.target.value)} className="h-12 rounded-xl border border-border bg-card px-3 text-base shadow-soft">
                    {activas.map((x) => <option key={x.tarjeta_digital_id} value={x.tarjeta_digital_id}>{x.nombre}</option>)}
                  </select>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="r-tope" className="text-base">Máximo de premios por persona al mes</Label>
              <Input id="r-tope" inputMode="numeric" value={valores.tope} onChange={(e) => set("tope", e.target.value.replace(/\D/g, "").slice(0, 3))} className={campo} />
            </div>
            <p className="text-sm text-muted-foreground">El cliente nuevo tiene {rc.vigencia_dias} días para hacer su primera compra.</p>
            {error && (valores.minimo || valores.montoPremio || valores.cantidad) && <p className="text-sm text-destructive">{error}</p>}
            <BotonesEdicion textoGuardar="Guardar" cambiado={cambiado && !error} onGuardar={() => setConfirmar(true)} onCancelar={cancelar} />
          </fieldset>
        </div>
      ) : (
        <VistaLectura
          onEditar={editar}
          puedeEditar={!deshabilitado}
          datos={[
            { etiqueta: "Programa", valor: guardado.activo ? "Activado" : "Apagado" },
            { etiqueta: "Compra mínima del cliente nuevo", valor: pesos(aCentavos(guardado.minimo)) },
            { etiqueta: "Premio para quien recomienda", valor: premioTexto(guardado) },
            { etiqueta: "Máximo de premios por persona al mes", valor: guardado.tope },
          ]}
        />
      )}
      <Confirmar
        abierto={confirmar}
        onAbierto={setConfirmar}
        titulo={valores.activo ? "¿Guardar el programa?" : "¿Apagar el programa?"}
        descripcion={valores.activo
          ? `Compra mínima ${pesos(min)}. Premio: ${valores.modulo === "monedero" ? `${pesos(premio)} de saldo` : `${cant} ${cant === 1 ? "sello" : "sellos"} de ${activas.find((x) => x.tarjeta_digital_id === valores.tarjeta)?.nombre ?? ""}`}. Máximo ${t} al mes.`
          : "Las recomendaciones pendientes se respetan hasta que venzan"}
        boton={valores.activo ? "Sí, guardar" : "Sí, apagar"}
        accion={guardar}
      />
    </section>
  );
}

const ESTADOS: Record<EstadoReferido, { texto: string; tono: "verde" | "ambar" | "rojo" | "gris" }> = {
  pendiente: { texto: "Pendientes", tono: "ambar" },
  cumplido: { texto: "Cumplidos", tono: "verde" },
  cumplido_sin_premio: { texto: "Cumplidos sin premio", tono: "rojo" },
  vencido: { texto: "Vencidos", tono: "gris" },
};
const ESTADO_FILA: Record<EstadoReferido, string> = { pendiente: "Pendiente", cumplido: "Cumplido", cumplido_sin_premio: "Cumplido sin premio", vencido: "Vencido" };
const MOTIVO: Record<string, string> = {
  tope_mensual: "Llegó al máximo de premios del mes",
  modulo_no_disponible: "El módulo del premio no estaba activo",
  referidor_inactivo: "Quien recomendó ya no es cliente",
};

function Lista() {
  const [estado, setEstado] = useState<EstadoReferido | "todos">("todos");
  const [items, setItems] = useState<Referido[]>([]);
  const [siguiente, setSiguiente] = useState<SiguienteRef>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const q = useQuery({
    queryKey: ["referidos-lista", estado],
    queryFn: () => listaReferidos({ limite: 50, ...(estado !== "todos" ? { estado } : {}) }),
  });
  useEffect(() => {
    if (q.data) {
      setItems(q.data.referidos);
      setSiguiente(q.data.siguiente);
    }
  }, [q.data]);

  const mas = async () => {
    if (!siguiente) return;
    setCargandoMas(true);
    try {
      const r = await listaReferidos({ limite: 50, ...(estado !== "todos" ? { estado } : {}), ...siguiente });
      setItems((x) => [...x, ...r.referidos]);
      setSiguiente(r.siguiente);
    } catch (e) {
      errorOperacion(e);
    } finally {
      setCargandoMas(false);
    }
  };

  const tot = q.data?.totales ?? {};
  const persona = (p: Referido["referidor"]) => `${p.nombre}${p.apellido_paterno ? ` ${p.apellido_paterno}` : ""} (…${p.telefono_sufijo})`;
  const premio = (r: Referido) =>
    r.premio_modulo === "monedero" && r.premio_monto_centavos
      ? `${pesos(r.premio_monto_centavos)} de saldo`
      : r.premio_modulo === "tarjetas_sellos" && r.premio_sellos_cantidad
        ? `${r.premio_sellos_cantidad} ${r.premio_sellos_cantidad === 1 ? "sello" : "sellos"}${r.premio_tarjeta ? ` de ${r.premio_tarjeta}` : ""}`
        : null;

  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold tracking-tight">Recomendaciones</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {(Object.keys(ESTADOS) as EstadoReferido[]).map((k) => (
          <Chip key={k} tono={ESTADOS[k].tono}>{ESTADOS[k].texto}: {tot[k] ?? 0}</Chip>
        ))}
      </div>
      <select aria-label="Filtrar por estado" value={estado} onChange={(e) => setEstado(e.target.value as typeof estado)} className="mt-4 h-12 w-full rounded-xl border border-border bg-card px-3 text-base shadow-soft sm:w-auto">
        <option value="todos">Todos</option>
        {(Object.keys(ESTADOS) as EstadoReferido[]).map((k) => <option key={k} value={k}>{ESTADOS[k].texto}</option>)}
      </select>
      {q.isLoading ? (
        <Cargando />
      ) : q.error ? (
        <p className="mt-4 text-destructive">{q.error.message}</p>
      ) : items.length === 0 ? (
        <p className="mt-4 text-muted-foreground">Aún no hay recomendaciones.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-border">
          {items.map((r, i) => (
            <li key={`${r.fecha_registro}-${i}`} className="flex flex-col gap-1 py-3">
              <p className="text-base font-medium">{persona(r.referidor)} recomendó a {persona(r.referido)}</p>
              <div><Chip tono={ESTADOS[r.estado].tono}>{ESTADO_FILA[r.estado]}</Chip></div>
              <p className="text-sm text-muted-foreground">Registro {instante(r.fecha_registro)} · Vence {fechaCorta(r.vence_en)}</p>
              {r.compra_monto_centavos != null && r.fecha_cumplimiento && (
                <p className="text-sm">Compra de {pesos(r.compra_monto_centavos)} el {instante(r.fecha_cumplimiento)}</p>
              )}
              {premio(r) && <p className={cn("text-sm", r.estado === "cumplido_sin_premio" && "line-through text-muted-foreground")}>Premio: {premio(r)}</p>}
              {r.estado === "cumplido_sin_premio" && (
                <p className="text-sm text-amber-400">{(r.motivo_sin_premio && MOTIVO[r.motivo_sin_premio]) || "Sin premio"}. Puedes compensarlo con un ajuste manual</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {siguiente && (
        <Button variant="secondary" className="tap-target mt-3 w-full" disabled={cargandoMas} onClick={() => void mas()}>
          {cargandoMas ? "Cargando…" : "Cargar más"}
        </Button>
      )}
    </section>
  );
}
