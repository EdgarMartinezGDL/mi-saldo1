import { ChevronLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import {
  limpiarSolicitudesQr, negociosSolicitudesQr, solicitudesQrNegocio,
  type NegocioSolicitudesQr, type SolicitudesQrNegocio,
} from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { ConfirmarMotivo, errorStaff, NOTA_AUDITORIA, useNivelStaff } from "./comun";

const MSG: Record<string, string> = {
  no_encontrado: "Ese negocio ya no existe: recarga la lista.",
  criterio_invalido: "Elige qué solicitudes borrar.",
  cursor_invalido: "La lista cambió: vuelve a cargarla.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
};

/** staff.md §8e (0072, QR-D3): negocios cuyo tope de 200 solicitudes por QR se está llenando. */
export function PestanaSolicitudesQr() {
  const [lista, setLista] = useState<{ tope: number; negocios: NegocioSolicitudesQr[] } | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const cargar = () => { negociosSolicitudesQr().then(setLista).catch((e) => errorStaff(e, MSG)); };
  useEffect(cargar, []);

  if (abierto) return <DetalleSolicitudesQr negocioId={abierto} onVolver={() => { setAbierto(null); setLista(null); cargar(); }} />;
  if (!lista) return <Cargando />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        Negocios con solicitudes de registro por QR sin atender (tope: {lista.tope}). Las vencidas no cuentan. Al llegar al 80 % le avisamos al dueño y a los admins.
      </p>
      {lista.negocios.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ningún negocio tiene solicitudes pendientes.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {lista.negocios.map((n) => (
            <li key={n.negocio_id}>
              <button type="button" onClick={() => setAbierto(n.negocio_id)}
                className={cn("flex w-full flex-col gap-1 rounded-2xl bg-card p-4 text-left ring-1", n.alerta ? "bg-warn/10 ring-warn/50" : "ring-border")}>
                <span className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-base font-semibold">{n.nombre_comercial}</span>
                  <span className="shrink-0 font-mono text-lg font-bold tabular-nums">{n.pendientes} / {lista.tope}</span>
                </span>
                {n.alerta && <span className="text-sm font-medium text-warn-texto">Arriba del 80 %</span>}
                <span className="text-sm text-muted-foreground">
                  {n.mas_reciente ? `Última: ${instante(n.mas_reciente)}` : "Sin solicitudes recientes"}
                  {n.ultimo_aviso ? ` · Aviso: ${instante(n.ultimo_aviso)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

type Borrado = { tipo: "ids" } | { tipo: "todas" } | { tipo: "desde"; hora: string };

function DetalleSolicitudesQr({ negocioId, onVolver }: { negocioId: string; onVolver: () => void }) {
  const { esAdmin } = useNivelStaff();
  const conTotp = useConTotp();
  const [datos, setDatos] = useState<SolicitudesQrNegocio | null>(null);
  const [cargando, setCargando] = useState(false);
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set());
  const [borrado, setBorrado] = useState<Borrado | null>(null);

  const cargar = async (mas = false) => {
    setCargando(true);
    try {
      const r = await solicitudesQrNegocio(negocioId, mas ? datos?.siguiente : null);
      setDatos((d) => (mas && d ? { ...r, solicitudes: [...d.solicitudes, ...r.solicitudes] } : r));
      if (!mas) setMarcadas(new Set());
    } catch (e) {
      errorStaff(e, MSG);
    } finally {
      setCargando(false);
    }
  };
  useEffect(() => { void cargar(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [negocioId]);

  const marcar = (id: string) => setMarcadas((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const maxHora = Math.max(1, ...(datos?.por_hora ?? []).map((h) => h.solicitudes));
  const hora = (h: string) => new Date(h).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  const titulo = !borrado ? "" : borrado.tipo === "ids"
    ? `¿Borrar ${marcadas.size === 1 ? "1 solicitud" : `${marcadas.size} solicitudes`}?`
    : borrado.tipo === "todas" ? `¿Borrar las ${datos?.pendientes ?? 0} solicitudes pendientes?` : `¿Borrar las solicitudes que llegaron desde ${hora(borrado.hora)}?`;

  return (
    <div className="flex flex-col gap-4">
      <Button variant="ghost" className="self-start" onClick={onVolver}><ChevronLeft className="size-4" /> Negocios</Button>
      {!datos ? <Cargando /> : (
        <>
          <div>
            <h2 className="text-xl font-semibold">{datos.nombre_comercial}</h2>
            <p className="text-sm text-muted-foreground">
              {datos.pendientes} de {datos.tope} pendientes{datos.ultimo_aviso ? ` · Último aviso del 80 %: ${instante(datos.ultimo_aviso)}` : ""}
            </p>
          </div>

          {datos.por_hora.length > 0 && (
            <section className="rounded-2xl bg-card p-4 ring-1 ring-border">
              <h3 className="text-base font-semibold">Llegadas por hora (últimas 24 h)</h3>
              <ul className="mt-3 flex flex-col gap-2">
                {datos.por_hora.map((h) => (
                  <li key={h.hora} className="flex items-center gap-3 text-sm">
                    <span className="w-28 shrink-0 tabular-nums">{hora(h.hora)}</span>
                    <span className="h-3 min-w-1 rounded-full bg-primary" style={{ width: `${(h.solicitudes / maxHora) * 50}%` }} aria-hidden />
                    <span className="shrink-0 tabular-nums">{h.solicitudes}</span>
                    {esAdmin && (
                      <Button size="sm" variant="ghost" className="ml-auto shrink-0 text-destructive" onClick={() => setBorrado({ tipo: "desde", hora: h.hora })}>
                        Borrar desde aquí
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {esAdmin && datos.solicitudes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" disabled={marcadas.size === 0} onClick={() => setBorrado({ tipo: "ids" })}>
                Borrar seleccionadas ({marcadas.size})
              </Button>
              <Button variant="secondary" className="text-destructive" onClick={() => setBorrado({ tipo: "todas" })}>Borrar todas</Button>
            </div>
          )}

          {datos.solicitudes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay solicitudes pendientes.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {datos.solicitudes.map((s) => {
                const cuerpo = (
                  <span className="flex min-w-0 flex-col">
                    <span className="font-mono tabular-nums">{telefonoVisible(s.telefono)}</span>
                    <span className="truncate">{nombreCompleto(s) || "Sin nombre"}</span>
                    <span className="truncate text-sm text-muted-foreground">{s.correo ?? "Sin correo"} · {instante(s.creada_en)}</span>
                  </span>
                );
                return (
                  <li key={s.id} className="rounded-2xl bg-card p-3 ring-1 ring-border">
                    {esAdmin ? (
                      <label className="flex min-h-11 cursor-pointer items-start gap-3">
                        <input type="checkbox" className="mt-1 size-5 shrink-0" checked={marcadas.has(s.id)} onChange={() => marcar(s.id)}
                          aria-label={`Seleccionar ${telefonoVisible(s.telefono)}`} />
                        {cuerpo}
                      </label>
                    ) : cuerpo}
                  </li>
                );
              })}
            </ul>
          )}
          {datos.siguiente && <Button variant="secondary" disabled={cargando} onClick={() => void cargar(true)}>{cargando ? "Cargando…" : "Cargar más"}</Button>}
        </>
      )}

      <ConfirmarMotivo abierto={!!borrado} onAbierto={(o) => !o && setBorrado(null)} destructivo titulo={titulo}
        descripcion="Se borran sin avisar a nadie: quien llenó una de verdad se da de alta en la Caja. En la auditoría quedan cuántas, el criterio y el motivo (sin teléfonos ni nombres)."
        nota={NOTA_AUDITORIA} boton="Sí, borrar"
        accion={async (motivo) => {
          if (!borrado) return;
          const body = borrado.tipo === "ids" ? { ids: [...marcadas], motivo }
            : borrado.tipo === "todas" ? { todas: true as const, motivo } : { todas: true as const, creadas_desde: borrado.hora, motivo };
          try {
            const r = await conTotp(() => limpiarSolicitudesQr(negocioId, body));
            toast.success(`Borradas: ${r.borradas}. Quedan ${r.pendientes} pendientes.`);
            setBorrado(null);
            await cargar();
          } catch (e) { errorStaff(e, MSG); throw e; }
        }} />
    </div>
  );
}
