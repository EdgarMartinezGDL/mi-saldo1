import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { instante, nombreCompleto } from "@/lib/api/formato";
import { cadenaNotificacion, notificaciones, reintentarNotificacion, type CadenaNotificacion, type CanalNotificacion, type Cursor, type EntregaNotificacion, type EstadoNotificacion, type FiltrosNotificaciones, type MotivoNoReintentable, type NotificacionStaff, type RespuestaNotificaciones } from "@/lib/api/staff";
import { inicioDiaMx, diaSiguiente } from "@/lib/fechas-staff";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { ConfirmarMotivo, NOTA_AUDITORIA, errorStaff, useStaffNav } from "./comun";

const ESTADOS: Record<EstadoNotificacion, { etiqueta: string; total: string; color: string }> = {
  enviado: { etiqueta: "Enviado", total: "Enviadas", color: "bg-success/10 text-success" },
  fallido: { etiqueta: "Fallido", total: "Fallidas", color: "bg-destructive/10 text-destructive" },
  pendiente: { etiqueta: "Pendiente", total: "Pendientes", color: "bg-pending/10 text-pending" },
  reintentando: { etiqueta: "Reintentando", total: "Reintentando", color: "bg-pending/10 text-pending" },
};
const ORDEN: EstadoNotificacion[] = ["enviado", "fallido", "pendiente", "reintentando"];
const ENTREGAS: Record<EntregaNotificacion, { etiqueta: string; color: string }> = {
  sin_confirmar: { etiqueta: "Sin confirmar", color: "bg-secondary text-muted-foreground" },
  entregado: { etiqueta: "Entregado", color: "bg-success/10 text-success" },
  leido: { etiqueta: "Leído", color: "bg-success/10 text-success" },
  no_entregado: { etiqueta: "No entregado", color: "bg-destructive/10 text-destructive" },
  rebotado: { etiqueta: "Rebotó", color: "bg-destructive/10 text-destructive" },
  queja: { etiqueta: "Marcado como spam", color: "bg-destructive/10 text-destructive" },
};
const ORDEN_ENTREGA: EntregaNotificacion[] = ["sin_confirmar", "entregado", "leido", "no_entregado", "rebotado", "queja"];

export const MOTIVOS_NO_REINTENTO: Record<MotivoNoReintentable, string> = {
  no_fallida: "Solo se reintenta un aviso fallido.",
  ya_reintentada: "Ya se reintentó: revisa el reintento más reciente.",
  evento_no_reintentable: "Lleva un código o un enlace de un solo uso: no se reintenta. La persona debe pedir uno nuevo.",
  vencida: "Tiene más de 7 días: ya no se reintenta.",
  limite_reintentos: "Ya se reintentó 3 veces.",
  persona_eliminada: "La persona se eliminó: ya no recibe avisos.",
  sin_destino: "La persona no tiene teléfono o correo para este canal.",
  correo_suprimido: "El correo rebotó o lo marcó como spam: la persona debe confirmarlo de nuevo desde su perfil.",
};

export function PestanaNotificaciones() {
  const { verFicha } = useStaffNav();
  const [estado, setEstado] = useState<EstadoNotificacion | "">("");
  const [canal, setCanal] = useState<CanalNotificacion | "">("");
  const [entrega, setEntrega] = useState<EntregaNotificacion | "">("");
  const [porReintentar, setPorReintentar] = useState<NotificacionStaff | null>(null);
  const [cadenas, setCadenas] = useState<Record<string, CadenaNotificacion | "cargando">>({});
  const generacionCadenas = useRef(0);
  const [evento, setEvento] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [lista, setLista] = useState<NotificacionStaff[] | null>(null);
  const [resumen, setResumen] = useState<RespuestaNotificaciones["resumen_24h"]>(null);
  const [siguiente, setSiguiente] = useState<Cursor>(null);
  const [cargando, setCargando] = useState(false);
  const aplicados = useRef<FiltrosNotificaciones>({});
  const peticion = useRef(0);

  const filtros = (valorEstado = estado, valorEntrega = entrega): FiltrosNotificaciones => ({
    ...(valorEntrega ? { estado: "enviado", entrega: valorEntrega } : valorEstado ? { estado: valorEstado } : {}), ...(canal ? { canal } : {}),
    ...(evento.trim() ? { evento: evento.trim() } : {}),
    ...(desde ? { desde: inicioDiaMx(desde) } : {}),
    ...(hasta ? { hasta: inicioDiaMx(diaSiguiente(hasta)) } : {}),
  });
  const cargar = async (f: FiltrosNotificaciones, cursor: Cursor = null) => {
    const id = ++peticion.current;
    if (!cursor) { ++generacionCadenas.current; setCadenas({}); }
    setCargando(true);
    try {
      const r = await notificaciones({ ...f, ...(cursor ?? {}) });
      if (id !== peticion.current) return;
      aplicados.current = f;
      setLista((xs) => cursor ? [...(xs ?? []), ...r.notificaciones] : r.notificaciones);
      setSiguiente(r.siguiente);
      if (!cursor) setResumen(r.resumen_24h);
    } catch (e) {
      if (id === peticion.current) { setLista((xs) => xs ?? []); errorStaff(e, {}, true); }
    } finally { if (id === peticion.current) setCargando(false); }
  };
  useEffect(() => {
    void cargar({});
    return () => { ++peticion.current; ++generacionCadenas.current; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alternarCadena = async (id: string) => {
    if (cadenas[id]) {
      setCadenas((xs) => { const copia = { ...xs }; delete copia[id]; return copia; });
      return;
    }
    const generacion = generacionCadenas.current;
    setCadenas((xs) => ({ ...xs, [id]: "cargando" }));
    try {
      const r = await cadenaNotificacion(id);
      if (generacion === generacionCadenas.current) setCadenas((xs) => xs[id] === "cargando" ? { ...xs, [id]: r } : xs);
    } catch (e) {
      if (generacion !== generacionCadenas.current) return;
      errorStaff(e);
      setCadenas((xs) => { const copia = { ...xs }; delete copia[id]; return copia; });
    }
  };

  return <div className="flex flex-col gap-4">
    <div>
      <h2 className="text-xl font-semibold">Notificaciones</h2>
      <p className="mt-1 text-sm text-muted-foreground">Mientras no haya cuentas de WhatsApp (YCloud) y correo (Amazon SES), los envíos son simulados: «Enviado» significa que el sistema lo procesó. Un aviso fallido se puede reintentar hasta 3 veces en los primeros 7 días, salvo los que llevan un código o un enlace de un solo uso.</p>
    </div>
    {resumen && <div>
      <h3 className="mb-3 text-base font-semibold">Últimas 24 horas</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDEN.map((e) => <Button key={e} variant="ghost" disabled={cargando} aria-pressed={estado === e}
          onClick={() => { setEstado(e); setEntrega(""); void cargar(filtros(e, "")); }}
          className={cn("h-auto flex-col items-start whitespace-normal rounded-2xl bg-card p-4 text-left ring-1", estado === e ? "ring-primary" : "ring-border")}>
          <span className={cn("font-mono text-2xl font-bold tabular-nums", e === "fallido" && resumen[e] > 0 && "text-destructive")}>{resumen[e]}</span>
          <span className="text-sm text-muted-foreground">{ESTADOS[e].total}</span>
        </Button>)}
      </div>
      {resumen.entrega && <>
        <h3 className="mt-4 mb-2 text-sm font-medium">Entrega de las enviadas</h3>
        <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
          {ORDEN_ENTREGA.map((x) => <Button key={x} variant="ghost" disabled={cargando} aria-pressed={entrega === x}
            onClick={() => { setEstado("enviado"); setEntrega(x); void cargar(filtros("enviado", x)); }}
            className={cn("h-auto min-w-0 flex-col items-start whitespace-normal rounded-2xl bg-card p-3 text-left ring-1", entrega === x ? "ring-primary" : "ring-border")}>
            <span className={cn("font-mono text-lg font-bold tabular-nums", resumen.entrega[x] > 0 && ["no_entregado", "rebotado", "queja"].includes(x) && "text-destructive")}>{resumen.entrega[x]}</span>
            <span className="text-sm text-muted-foreground">{ENTREGAS[x].etiqueta}</span>
          </Button>)}
        </div>
      </>}
    </div>}
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void cargar(filtros()); }}>
      <div className="flex flex-col gap-1.5"><Label htmlFor="not-estado">Estado</Label>
        <select id="not-estado" value={entrega ? "enviado" : estado} disabled={!!entrega} onChange={(e) => setEstado(e.target.value as EstadoNotificacion | "")} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos</option>{ORDEN.map((e) => <option key={e} value={e}>{ESTADOS[e].etiqueta}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="not-canal">Canal</Label>
        <select id="not-canal" value={canal} onChange={(e) => setCanal(e.target.value as CanalNotificacion | "")} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos</option><option value="whatsapp">WhatsApp</option><option value="correo">Correo</option>
        </select>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="not-entrega">Entrega</Label>
        <select id="not-entrega" value={entrega} onChange={(e) => setEntrega(e.target.value as EntregaNotificacion | "")} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todas</option>{ORDEN_ENTREGA.map((x) => <option key={x} value={x}>{ENTREGAS[x].etiqueta}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="not-evento">Evento</Label><Input id="not-evento" value={evento} onChange={(e) => setEvento(e.target.value)} className="h-10 font-mono" /></div>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor="not-desde">Desde</Label><Input id="not-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="h-10 min-w-0" /></div>
        <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor="not-hasta">Hasta</Label><Input id="not-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="h-10 min-w-0" /></div>
      </div>
      <Button type="submit" disabled={cargando} className="justify-self-start">Buscar</Button>
    </form>
    {!lista ? <Cargando /> : lista.length === 0 ? <p className="text-sm text-muted-foreground">No hay notificaciones con estos filtros.</p> : <ul className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4 ring-1 ring-border">
      {lista.map((n) => <li key={n.notificacion_id} className="flex flex-col gap-2 py-3">
        <p className="text-xs text-muted-foreground">{instante(n.creado_en)}</p>
        <div className="flex flex-wrap items-center gap-2">
          <span className="min-w-0 break-all font-mono text-sm">{n.evento}</span>
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">{n.canal === "whatsapp" ? "WhatsApp" : "Correo"}</span>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ESTADOS[n.estado].color)}>{ESTADOS[n.estado].etiqueta}</span>
          {n.estado === "enviado" && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ENTREGAS[n.entrega].color)}>{ENTREGAS[n.entrega].etiqueta}</span>}
          {n.reintento_num > 0 && <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">Reintento {n.reintento_num} de 3</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Button variant="link" className="h-auto min-w-0 whitespace-normal p-0 text-left" onClick={() => verFicha(n.destinatario.persona_id)}>{nombreCompleto(n.destinatario)}</Button>
          <span className="break-all text-muted-foreground">{n.canal === "whatsapp" ? n.destinatario.telefono : n.destinatario.correo}</span>
        </div>
        <p className="text-xs text-muted-foreground">{n.negocio?.nombre_comercial ?? "MiSaldo (plataforma)"} · {plural(n.intentos, "intento", "intentos")}</p>
        {n.ultimo_error && <p className="break-words text-xs text-destructive">{n.ultimo_error}</p>}
        {["no_entregado", "rebotado", "queja"].includes(n.entrega) && n.entrega_detalle !== null && <p className="text-xs text-destructive">{["codigo_error", "rebote_tipo", "estado_smtp", "queja_tipo"].map((k) => n.entrega_detalle?.[k]).filter((v) => v !== undefined).join(" · ")}</p>}
        <div className="flex flex-wrap items-center gap-2">
          {n.estado === "fallido" && n.reintento.posible && <Button size="sm" onClick={() => setPorReintentar(n)}>Reintentar</Button>}
          {n.estado === "fallido" && !n.reintento.posible && n.reintento.motivo && <p className="text-xs text-muted-foreground">{MOTIVOS_NO_REINTENTO[n.reintento.motivo]}</p>}
          {(n.reintento_num > 0 || n.reintentado_en) && <Button size="sm" variant="secondary" onClick={() => void alternarCadena(n.notificacion_id)}>{cadenas[n.notificacion_id] ? "Ocultar reintentos" : "Ver reintentos"}</Button>}
        </div>
        {cadenas[n.notificacion_id] === "cargando" ? <Cargando /> : (() => {
          const cadena = cadenas[n.notificacion_id];
          return cadena && cadena !== "cargando" ? <ul className="mt-2 flex flex-col gap-2 rounded-xl bg-secondary/50 p-3">
            {cadena.avisos.map((a) => <li key={a.notificacion_id} className="flex flex-col gap-1">
              <p className="text-sm font-medium">{a.reintento_num === 0 ? "Original" : `Reintento ${a.reintento_num}`}{a.notificacion_id === n.notificacion_id ? " · este aviso" : ""}</p>
              <p className="text-xs text-muted-foreground">{instante(a.creado_en)}</p>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ESTADOS[a.estado].color)}>{ESTADOS[a.estado].etiqueta}</span>
                {a.estado === "enviado" && <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", ENTREGAS[a.entrega].color)}>{ENTREGAS[a.entrega].etiqueta}</span>}
              </div>
              {a.ultimo_error !== null && <p className="break-words text-xs text-destructive">{a.ultimo_error}</p>}
            </li>)}
          </ul> : null;
        })()}
      </li>)}
    </ul>}
    {siguiente && <Button variant="secondary" disabled={cargando} onClick={() => void cargar(aplicados.current, siguiente)}>{cargando ? "Cargando…" : "Cargar más"}</Button>}
    {porReintentar !== null && <ConfirmarMotivo abierto={true} onAbierto={(o) => { if (!o) setPorReintentar(null); }}
      titulo="¿Reintentar este aviso?"
      descripcion={`Se envía de nuevo por ${porReintentar.canal === "whatsapp" ? "WhatsApp" : "Correo"} a ${nombreCompleto(porReintentar.destinatario)}, con su teléfono o correo actual. Queda como un aviso nuevo en la lista.`}
      nota={NOTA_AUDITORIA} boton="Sí, reintentar"
      accion={async (motivo) => {
        try {
          const r = await reintentarNotificacion(porReintentar.notificacion_id, motivo);
          toast.success(`Reintento ${r.reintento_num} de 3 en camino`);
          setPorReintentar(null);
          void cargar(aplicados.current);
        } catch (e) {
          errorStaff(e);
          void cargar(aplicados.current);
          throw e;
        }
      }} />}
  </div>;
}