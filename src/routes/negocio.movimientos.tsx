import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Download } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useConfigNegocio, SeccionNegocio } from "@/components/negocio/comun";
import { Confirmar, errorOperacion, FilaMovimiento } from "@/components/negocio/operacion-ui";
import { Cargando } from "@/components/requiere-sesion";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { guardarArchivo, telefonoE164 } from "@/lib/api/client";
import { empleados } from "@/lib/api/dueno";
import { aCentavos } from "@/lib/api/formato";
import {
  configAjustes,
  conteoExportacion,
  consultarHistorial,
  descargarExportacion,
  guardarConfigAjustes,
  type ConfigAjustes,
  type FiltrosHistorial,
  type Modulo,
  type Movimiento,
  type Siguiente,
  type TipoMovimiento,
} from "@/lib/api/operacion";

export const Route = createFileRoute("/negocio/movimientos")({
  validateSearch: (s: Record<string, unknown>): { telefono?: string } =>
    typeof s["telefono"] === "string" || typeof s["telefono"] === "number" ? { telefono: String(s["telefono"]) } : {},
  head: () => ({
    meta: [
      { title: "Movimientos · MiSaldo" },
      { name: "description", content: "Todo lo que pasó en tu caja, con filtros y descarga a Excel." },
      { property: "og:title", content: "Movimientos · MiSaldo" },
      { property: "og:description", content: "Historial de la caja del negocio con filtros y Excel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <SeccionNegocio titulo="Movimientos" descripcion="Todo lo que pasó en tu caja.">
      <Movimientos />
    </SeccionNegocio>
  ),
});

/** Today in Mexico City as AAAA-MM-DD. */
const hoyMx = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
const dias = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;

const TIPOS: [TipoMovimiento, string][] = [
  ["acumulacion", "Acumulación"],
  ["canje", "Canje"],
  ["ajuste_manual", "Ajuste"],
  ["expiracion", "Expiración"],
  ["vencimiento", "Vencimiento"],
  ["referido", "Referido"],
];
const campo = "h-12 w-full rounded-xl border border-border bg-card px-3 text-base shadow-soft outline-none focus:border-primary/60";

function Movimientos() {
  const { telefono: telUrl } = Route.useSearch();
  const conTotp = useConTotp();
  const { data: cfg } = useConfigNegocio();
  const { data: equipo } = useQuery({ queryKey: ["empleados"], queryFn: empleados });
  const hoy = hoyMx();
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [tipo, setTipo] = useState<TipoMovimiento | "">("");
  const [modulo, setModulo] = useState<Modulo | "">("");
  const [tarjeta, setTarjeta] = useState("");
  const [cajero, setCajero] = useState("");
  const [tel, setTel] = useState((telUrl ?? "").replace(/\D/g, "").slice(-10));
  const [abiertos, setAbiertos] = useState(false);
  const [lista, setLista] = useState<Movimiento[] | null>(null);
  const [siguiente, setSiguiente] = useState<Siguiente>(null);
  const [cargando, setCargando] = useState(false);
  const [conteo, setConteo] = useState<number | null>(null);

  const ambos = !!cfg && cfg.modulos.includes("monedero") && cfg.modulos.includes("tarjetas_sellos");
  const rangoMal = desde > hasta ? "La fecha inicial debe ser antes de la final." : dias(desde, hasta) > 92 ? "El rango máximo es de 92 días." : null;
  const telMal = tel !== "" && tel.length !== 10;

  const filtros = (): FiltrosHistorial => ({
    desde,
    hasta,
    ...(tipo ? { tipo } : {}),
    ...(modulo ? { modulo } : {}),
    ...(tarjeta ? { tarjeta_digital_id: tarjeta } : {}),
    ...(cajero ? { operador_persona_id: cajero } : {}),
    ...(tel.length === 10 ? { telefono: telefonoE164(tel) } : {}),
  });

  const cargar = async (cursor: Siguiente) => {
    if (rangoMal || telMal) return;
    setCargando(true);
    try {
      const r = await consultarHistorial({ ...filtros(), limite: 50, ...(cursor ?? {}) });
      setLista((p) => (cursor ? [...(p ?? []), ...r.movimientos] : r.movimientos));
      setSiguiente(r.siguiente ?? null);
    } catch (e) {
      errorOperacion(e);
      if (!cursor) setLista([]);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => void cargar(null), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hasta, tipo, modulo, tarjeta, cajero, tel]);

  const pedirExcel = async () => {
    try {
      const r = await conteoExportacion(filtros());
      if (r.excede_limite) return void toast.error("Son más de 20,000 movimientos: reduce el rango");
      setConteo(r.conteo);
    } catch (e) {
      errorOperacion(e);
    }
  };

  const descargar = async () => {
    try {
      const f = filtros();
      guardarArchivo(await conTotp(() => descargarExportacion(f)));
      setConteo(null);
    } catch (e) {
      errorOperacion(e);
    }
  };

  return (
    <>
      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <button type="button" className="tap-target flex w-full items-center justify-between text-left text-lg font-semibold md:pointer-events-none" onClick={() => setAbiertos(!abiertos)} aria-expanded={abiertos}>
          Filtros <ChevronDown className={`size-5 transition-transform md:hidden ${abiertos ? "rotate-180" : ""}`} />
        </button>
        <div className={`${abiertos ? "grid" : "hidden"} mt-3 gap-3 sm:grid-cols-2 md:grid lg:grid-cols-3`}>
          <label className="flex flex-col gap-1 text-sm font-medium">Desde
            <input type="date" className={campo} value={desde} max={hoy} onChange={(e) => setDesde(e.target.value || hoy)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Hasta
            <input type="date" className={campo} value={hasta} max={hoy} onChange={(e) => setHasta(e.target.value || hoy)} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Tipo
            <select className={campo} value={tipo} onChange={(e) => setTipo(e.target.value as TipoMovimiento | "")}>
              <option value="">Todos</option>
              {TIPOS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select>
          </label>
          {ambos && (
            <label className="flex flex-col gap-1 text-sm font-medium">Módulo
              <select className={campo} value={modulo} onChange={(e) => setModulo(e.target.value as Modulo | "")}>
                <option value="">Todos</option>
                <option value="monedero">Saldo</option>
                <option value="tarjetas_sellos">Sellos</option>
              </select>
            </label>
          )}
          {(cfg?.tarjetas?.length ?? 0) > 0 && (
            <label className="flex flex-col gap-1 text-sm font-medium">Tarjeta
              <select className={campo} value={tarjeta} onChange={(e) => setTarjeta(e.target.value)}>
                <option value="">Todas</option>
                {cfg!.tarjetas!.map((t) => <option key={t.tarjeta_digital_id} value={t.tarjeta_digital_id}>{t.nombre}{t.activa === false ? " (desactivada)" : ""}</option>)}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm font-medium">Cajero
            <select className={campo} value={cajero} onChange={(e) => setCajero(e.target.value)}>
              <option value="">Todos</option>
              {(equipo ?? []).map((p) => <option key={p.persona_id} value={p.persona_id}>{[p.nombre, p.apellido_paterno].filter(Boolean).join(" ")}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium">Teléfono del cliente
            <Input inputMode="numeric" placeholder="10 dígitos" className="h-12 text-base" value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </label>
        </div>
        {(rangoMal || telMal) && <p className="mt-3 text-sm text-destructive">{rangoMal ?? "Escribe los 10 dígitos del teléfono."}</p>}
      </section>

      <Button size="lg" variant="secondary" className="w-full sm:w-auto" disabled={!!rangoMal || telMal} onClick={() => void pedirExcel()}>
        <Download className="size-5" /> Exportar a Excel
      </Button>

      <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
        {!lista ? (
          <Cargando />
        ) : lista.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hay movimientos con estos filtros.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {lista.map((m) => <FilaMovimiento key={m.movimiento_id} m={m} />)}
          </ul>
        )}
        {siguiente && (
          <Button variant="secondary" className="mt-4 w-full" disabled={cargando} onClick={() => void cargar(siguiente)}>
            {cargando ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </section>

      <LimitesAjustes />

      <Confirmar
        abierto={conteo !== null}
        onAbierto={(o) => !o && setConteo(null)}
        titulo={`¿Descargar ${conteo ?? 0} movimientos?`}
        descripcion="Se guardará un archivo de Excel en tu equipo."
        boton="Descargar"
        accion={descargar}
      />
    </>
  );
}

type Llave = keyof ConfigAjustes;
const LIMITES: { llave: Llave; titulo: string; pesos: boolean }[] = [
  { llave: "tope_diario_centavos", titulo: "Tope diario de saldo", pesos: true },
  { llave: "tope_diario_sellos", titulo: "Tope diario de sellos", pesos: false },
  { llave: "umbral_alerta_centavos", titulo: "Alerta desde (saldo)", pesos: true },
  { llave: "umbral_alerta_sellos", titulo: "Alerta desde (sellos)", pesos: false },
];

const aForm = (d: ConfigAjustes) =>
  Object.fromEntries(
    LIMITES.map((l) => [l.llave, d[l.llave] === null ? null : l.pesos ? (d[l.llave]! / 100).toFixed(2) : String(d[l.llave])]),
  ) as Record<Llave, string | null>;

function LimitesAjustes() {
  const q = useQuery({ queryKey: ["ajustes-configuracion"], queryFn: configAjustes });
  return (
    <section className="rounded-2xl bg-card p-5 ring-1 ring-border">
      <h2 className="text-lg font-semibold tracking-tight">Límites de ajustes manuales</h2>
      {!q.data ? (
        q.isError ? <p className="mt-2 text-sm text-destructive">No se pudieron cargar los límites.</p> : <Cargando />
      ) : (
        <FormLimites guardadoInicial={aForm(q.data)} recargar={() => q.refetch()} />
      )}
    </section>
  );
}

function FormLimites({ guardadoInicial, recargar }: { guardadoInicial: Record<Llave, string | null>; recargar: () => Promise<unknown> }) {
  const conTotp = useConTotp();
  const m = useModoEdicion(guardadoInicial);
  const form = m.valores;
  const setForm = m.setValores;
  const [confirmar, setConfirmar] = useState(false);

  const valor = (l: (typeof LIMITES)[number]) => {
    const v = form[l.llave];
    if (v === null || v === undefined) return null;
    return l.pesos ? aCentavos(v) : Number.parseInt(v, 10) || 0;
  };
  const invalido = LIMITES.some((l) => form[l.llave] !== null && !(valor(l)! > 0));

  const guardar = async () => {
    const body = Object.fromEntries(LIMITES.map((l) => [l.llave, valor(l)])) as unknown as ConfigAjustes;
    try {
      await conTotp(() => guardarConfigAjustes(body));
      m.terminar();
      await recargar();
      toast.success("Límites guardados");
      setConfirmar(false);
    } catch (e) {
      errorOperacion(e);
    }
  };

  const texto = (l: (typeof LIMITES)[number]) => {
    const v = m.guardado[l.llave];
    return v === null ? "Sin límite" : l.pesos ? `$${v}` : v;
  };

  return (
    <>
      {!m.editando ? (
        <div className="mt-4">
          <VistaLectura datos={LIMITES.map((l) => ({ etiqueta: l.titulo, valor: texto(l) }))} onEditar={m.editar} />
        </div>
      ) : (
        <div ref={m.ref} className="mt-4 flex flex-col gap-4">
          {LIMITES.map((l) => {
            const v = form[l.llave];
            return (
              <div key={l.llave} className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-border">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{l.titulo}</span>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    Sin límite
                    <Switch checked={v === null} onCheckedChange={(c) => setForm({ ...form, [l.llave]: c ? null : "" })} />
                  </label>
                </div>
                {v !== null && (
                  <Input
                    inputMode={l.pesos ? "decimal" : "numeric"}
                    placeholder={l.pesos ? "$0.00" : "0"}
                    className="h-12 text-base"
                    value={v}
                    onChange={(e) => setForm({ ...form, [l.llave]: l.pesos ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value.replace(/\D/g, "") })}
                  />
                )}
              </div>
            );
          })}
          <BotonesEdicion textoGuardar="Guardar límites" cambiado={m.cambiado && !invalido} onGuardar={() => setConfirmar(true)} onCancelar={m.cancelar} />
        </div>
      )}
      <Confirmar abierto={confirmar} onAbierto={setConfirmar} titulo="¿Guardar los límites?" descripcion="Se aplican a los ajustes manuales desde ahora." boton="Sí, guardar" accion={guardar} />
    </>
  );
}
