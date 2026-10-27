import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import { auditoria, buscarPersonas, negociosStaff, type Cursor, type EventoAuditoria } from "@/lib/api/staff";
import { errorStaff, type FiltroAuditoria } from "./comun";
import { inicioDiaMx, diaSiguiente } from "@/lib/fechas-staff";

const GRUPOS: [string, [string, string][]][] = [
  ["Negocios", [["negocio_alta", "Alta de negocio"], ["dueno_reinvitado", "Invitación reenviada"], ["membresia_extendida", "Pago registrado"], ["prueba_extendida", "Prueba extendida"], ["negocio_suspendido", "Negocio suspendido"], ["negocio_reactivado", "Negocio reactivado"], ["membresia_precio_cambiado", "Precio de la membresía"], ["membresia_pagada", "Pago en línea"], ["pago_membresia_creado", "Orden de pago en línea"], ["pago_membresia_en_revision", "Pago en revisión"]]],
  ["Plan y WhatsApp", [["modulo_actualizado", "Módulo actualizado"], ["zona_horaria_cambiada", "Zona horaria cambiada"], ["limite_tarjetas_cambiado", "Límite de tarjetas cambiado"], ["whatsapp_asignado", "WhatsApp asignado"], ["whatsapp_movido", "WhatsApp movido"], ["portafolio_creado", "Portafolio creado"], ["portafolio_estado", "Estado de portafolio"], ["portafolio_capacidad", "Capacidad de portafolio"], ["portafolio_migrado", "Portafolio migrado"]]],
  ["Personas", [["alerta_atendida", "Alerta atendida"], ["telefono_liberado", "Teléfono liberado"], ["telefono_cambio_solicitado", "Cambio de teléfono solicitado"], ["telefono_asignado", "Teléfono asignado"], ["totp_restablecido", "2FA restablecido"], ["ajuste_staff", "Ajuste de Staff"], ["datos_rectificados", "Datos rectificados"], ["promociones_retiradas_staff", "Promociones retiradas"], ["persona_anonimizada", "Persona anonimizada"]]],
  ["Equipo", [["staff_alta", "Alta de Staff"], ["staff_reinvitado", "Staff reinvitado"], ["staff_nivel_cambiado", "Nivel de Staff cambiado"], ["staff_baja", "Baja de Staff"], ["staff_reactivado", "Staff reactivado"]]],
  ["Acceso", [["login_exitoso", "Inicio de sesión"], ["login_fallido", "Inicio de sesión fallido"], ["cambio_contexto", "Cambio de perfil"], ["pin_pos_desbloqueo", "Desbloqueo con PIN POS"]]],
];
const TEXTO = Object.fromEntries(GRUPOS.flatMap(([, xs]) => xs));
const MSG: Record<string, string> = {
  rango_invalido: "Revisa las fechas: «Desde» debe ser antes de «Hasta».",
  accion_invalida: "Esa acción no existe.",
  cursor_invalido: "No se pudo cargar más: vuelve a buscar.",
  limite_invalido: "No se pudo cargar la lista.",
  sin_permiso: "La auditoría es solo para administradores.",
};

export function PestanaAuditoria({ inicial }: { inicial: FiltroAuditoria | null }) {
  const [negocio, setNegocio] = useState<{ id: string; l: string } | null>(inicial?.negocio_id ? { id: inicial.negocio_id, l: inicial.etiqueta } : null);
  const [persona, setPersona] = useState<{ id: string; l: string } | null>(inicial?.persona_id ? { id: inicial.persona_id, l: inicial.etiqueta } : null);
  const [accion, setAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [eventos, setEventos] = useState<EventoAuditoria[] | null>(null);
  const [siguiente, setSiguiente] = useState<Cursor>(null);
  const [cargando, setCargando] = useState(false);
  const [abierto, setAbierto] = useState<string | null>(null);

  useEffect(() => {
    setNegocio(inicial?.negocio_id ? { id: inicial.negocio_id, l: inicial.etiqueta } : null);
    setPersona(inicial?.persona_id ? { id: inicial.persona_id, l: inicial.etiqueta } : null);
  }, [inicial]);

  const cargar = async (mas = false) => {
    setCargando(true);
    try {
      const r = await auditoria({
        negocio_id: negocio?.id, persona_id: persona?.id, accion: accion || undefined,
        desde: desde ? inicioDiaMx(desde) : undefined, hasta: hasta ? inicioDiaMx(diaSiguiente(hasta)) : undefined,
        ...(mas && siguiente ? siguiente : {}),
      });
      setEventos((xs) => (mas && xs ? [...xs, ...r.eventos] : r.eventos));
      setSiguiente(r.siguiente);
    } catch (e) {
      errorStaff(e, MSG);
    } finally {
      setCargando(false);
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { void cargar(); }, [negocio, persona, accion, desde, hasta]);

  return (
    <div className="flex flex-col gap-4">
      <section className="grid gap-3 rounded-2xl bg-card p-4 ring-1 ring-border sm:grid-cols-2">
        <Buscador etiqueta="Negocio" elegido={negocio} onElegir={setNegocio} placeholder="Nombre del negocio o teléfono"
          buscar={async (q) => (await negociosStaff({ busqueda: q })).negocios.map((n) => ({ id: n.negocio_id, l: n.nombre_comercial }))} />
        <Buscador etiqueta="Persona" elegido={persona} onElegir={setPersona} placeholder="Teléfono (10 dígitos) o correo"
          buscar={async (q) => {
            const d = q.replace(/\D/g, "");
            const t = !q.includes("@") && !q.startsWith("+") && d.length === 10 ? `+52${d}` : q;
            return (await buscarPersonas(t)).map((p) => ({ id: p.persona_id, l: `${nombreCompleto(p)} · ${telefonoVisible(p.telefono)}` }));
          }} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="au-acc">Acción</Label>
          <select id="au-acc" value={accion} onChange={(e) => setAccion(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
            <option value="">Todas</option>
            {GRUPOS.map(([g, xs]) => <optgroup key={g} label={g}>{xs.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</optgroup>)}
          </select>
        </div>
        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-1.5"><Label htmlFor="au-d">Desde</Label><Input id="au-d" type="date" className="h-10" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
          <div className="flex flex-1 flex-col gap-1.5"><Label htmlFor="au-h">Hasta</Label><Input id="au-h" type="date" className="h-10" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
        </div>
      </section>
      {!eventos ? <Cargando /> : eventos.length === 0 ? <p className="text-sm text-muted-foreground">Sin eventos con esos filtros.</p> : (
        <ul className="flex flex-col divide-y divide-border rounded-2xl bg-card px-4 ring-1 ring-border">
          {eventos.map((ev) => (
            <li key={ev.auditoria_id} className="py-3">
              <button type="button" className="w-full text-left" onClick={() => setAbierto(abierto === ev.auditoria_id ? null : ev.auditoria_id)}>
                <p className="text-sm font-medium">{TEXTO[ev.accion] ?? ev.accion}</p>
                <p className="text-xs text-muted-foreground">
                  {instante(ev.creado_en)} · {ev.actor ? [ev.actor.nombre, ev.actor.apellido_paterno].filter(Boolean).join(" ") : "Sistema"}
                  {ev.negocio && ` · ${ev.negocio.nombre_comercial}`}{ev.ip && ` · ${ev.ip}`}
                </p>
              </button>
              {abierto === ev.auditoria_id && (
                <pre className="mt-2 whitespace-pre-wrap break-all rounded-lg bg-secondary p-3 text-xs">{JSON.stringify(ev.detalle, null, 2)}</pre>
              )}
            </li>
          ))}
        </ul>
      )}
      {siguiente && <Button variant="secondary" disabled={cargando} onClick={() => void cargar(true)}>{cargando ? "Cargando…" : "Cargar más"}</Button>}
    </div>
  );
}

type Opcion = { id: string; l: string };
function Buscador({ etiqueta, elegido, onElegir, buscar, placeholder }: {
  etiqueta: string; elegido: Opcion | null; onElegir: (o: Opcion | null) => void; buscar: (q: string) => Promise<Opcion[]>; placeholder: string;
}) {
  const [q, setQ] = useState("");
  const [opciones, setOpciones] = useState<Opcion[]>([]);
  const ir = async () => {
    try { setOpciones(await buscar(q.trim())); } catch (e) { errorStaff(e); }
  };
  if (elegido) {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{etiqueta}</Label>
        <div className="flex h-10 items-center justify-between gap-2 rounded-md bg-secondary px-3 text-sm">
          <span className="truncate">{elegido.l}</span>
          <button type="button" aria-label={`Quitar ${etiqueta.toLowerCase()}`} onClick={() => onElegir(null)}><X className="size-4" /></button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{etiqueta}</Label>
      <div className="flex gap-2">
        <Input className="h-10" placeholder={placeholder} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && q.trim() && void ir()} />
        <Button size="sm" className="h-10" disabled={q.trim().length < 2} onClick={() => void ir()}>Buscar</Button>
      </div>
      {opciones.length > 0 && (
        <ul className="flex flex-col rounded-md ring-1 ring-border">
          {opciones.slice(0, 8).map((o) => (
            <li key={o.id}><button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-secondary" onClick={() => { onElegir(o); setOpciones([]); setQ(""); }}>{o.l}</button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
