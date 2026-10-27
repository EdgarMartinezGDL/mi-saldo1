import { useEffect, useRef, useState } from "react";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { instante, nombreCompleto } from "@/lib/api/formato";
import { notificaciones, type CanalNotificacion, type Cursor, type EstadoNotificacion, type FiltrosNotificaciones, type NotificacionStaff, type RespuestaNotificaciones } from "@/lib/api/staff";
import { inicioDiaMx, diaSiguiente } from "@/lib/fechas-staff";
import { plural } from "@/lib/plural";
import { cn } from "@/lib/utils";
import { errorStaff, useStaffNav } from "./comun";

const ESTADOS: Record<EstadoNotificacion, { etiqueta: string; total: string; color: string }> = {
  enviado: { etiqueta: "Enviado", total: "Enviadas", color: "bg-success/10 text-success" },
  fallido: { etiqueta: "Fallido", total: "Fallidas", color: "bg-destructive/10 text-destructive" },
  pendiente: { etiqueta: "Pendiente", total: "Pendientes", color: "bg-pending/10 text-pending" },
  reintentando: { etiqueta: "Reintentando", total: "Reintentando", color: "bg-pending/10 text-pending" },
};
const ORDEN: EstadoNotificacion[] = ["enviado", "fallido", "pendiente", "reintentando"];

export function PestanaNotificaciones() {
  const { verFicha } = useStaffNav();
  const [estado, setEstado] = useState<EstadoNotificacion | "">("");
  const [canal, setCanal] = useState<CanalNotificacion | "">("");
  const [evento, setEvento] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [lista, setLista] = useState<NotificacionStaff[] | null>(null);
  const [resumen, setResumen] = useState<RespuestaNotificaciones["resumen_24h"]>(null);
  const [siguiente, setSiguiente] = useState<Cursor>(null);
  const [cargando, setCargando] = useState(false);
  const aplicados = useRef<FiltrosNotificaciones>({});
  const peticion = useRef(0);

  const filtros = (valorEstado = estado): FiltrosNotificaciones => ({
    ...(valorEstado ? { estado: valorEstado } : {}), ...(canal ? { canal } : {}),
    ...(evento.trim() ? { evento: evento.trim() } : {}),
    ...(desde ? { desde: inicioDiaMx(desde) } : {}),
    ...(hasta ? { hasta: inicioDiaMx(diaSiguiente(hasta)) } : {}),
  });
  const cargar = async (f: FiltrosNotificaciones, cursor: Cursor = null) => {
    const id = ++peticion.current;
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
    return () => { ++peticion.current; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div className="flex flex-col gap-4">
    <div>
      <h2 className="text-xl font-semibold">Notificaciones</h2>
      <p className="mt-1 text-sm text-muted-foreground">Mientras no haya cuentas de WhatsApp (YCloud) y correo (Amazon SES), los envíos son simulados: «Enviado» significa que el sistema lo procesó.</p>
    </div>
    {resumen && <div>
      <h3 className="mb-3 text-base font-semibold">Últimas 24 horas</h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ORDEN.map((e) => <Button key={e} variant="ghost" disabled={cargando} aria-pressed={estado === e}
          onClick={() => { setEstado(e); void cargar(filtros(e)); }}
          className={cn("h-auto flex-col items-start whitespace-normal rounded-2xl bg-card p-4 text-left ring-1", estado === e ? "ring-primary" : "ring-border")}>
          <span className={cn("font-mono text-2xl font-bold tabular-nums", e === "fallido" && resumen[e] > 0 && "text-destructive")}>{resumen[e]}</span>
          <span className="text-sm text-muted-foreground">{ESTADOS[e].total}</span>
        </Button>)}
      </div>
    </div>}
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={(e) => { e.preventDefault(); void cargar(filtros()); }}>
      <div className="flex flex-col gap-1.5"><Label htmlFor="not-estado">Estado</Label>
        <select id="not-estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoNotificacion | "")} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos</option>{ORDEN.map((e) => <option key={e} value={e}>{ESTADOS[e].etiqueta}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5"><Label htmlFor="not-canal">Canal</Label>
        <select id="not-canal" value={canal} onChange={(e) => setCanal(e.target.value as CanalNotificacion | "")} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
          <option value="">Todos</option><option value="whatsapp">WhatsApp</option><option value="correo">Correo</option>
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
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <Button variant="link" className="h-auto min-w-0 whitespace-normal p-0 text-left" onClick={() => verFicha(n.destinatario.persona_id)}>{nombreCompleto(n.destinatario)}</Button>
          <span className="break-all text-muted-foreground">{n.canal === "whatsapp" ? n.destinatario.telefono : n.destinatario.correo}</span>
        </div>
        <p className="text-xs text-muted-foreground">{n.negocio?.nombre_comercial ?? "MiSaldo (plataforma)"} · {plural(n.intentos, "intento", "intentos")}</p>
        {n.ultimo_error && <p className="break-words text-xs text-destructive">{n.ultimo_error}</p>}
      </li>)}
    </ul>}
    {siguiente && <Button variant="secondary" disabled={cargando} onClick={() => void cargar(aplicados.current, siguiente)}>{cargando ? "Cargando…" : "Cargar más"}</Button>}
  </div>;
}