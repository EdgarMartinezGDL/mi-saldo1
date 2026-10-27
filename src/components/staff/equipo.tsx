import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Cargando } from "@/components/requiere-sesion";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import {
  altaMiembro, bajaMiembro, equipo, miSesion, nivelMiembro, reactivarMiembro, reinvitarMiembro, type MiembroEquipo,
} from "@/lib/api/staff";
import { cn } from "@/lib/utils";
import { ConfirmarMotivo, errorStaff, NOTA_AUDITORIA, useNivelStaff } from "./comun";
import { plural } from "@/lib/plural";

const ALERTA_ADMINS = "Los demás admins recibirán una alerta de seguridad.";
const MSG: Record<string, string> = {
  nombre_no_coincide: "Ese teléfono es de alguien con otro nombre: verifica el número",
  dado_de_baja: "Está de baja: reactívalo",
  ultimo_admin: "Siempre debe quedar al menos un admin",
  telefono_invalido: "Revisa el teléfono.",
  correo_invalido: "Revisa el correo.",
  nombre_requerido: "Escribe el nombre.",
  nivel_invalido: "Elige Soporte o Admin.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
  no_encontrado: "Ese miembro ya no existe.",
};
type Nivel = "admin" | "soporte";
const quien = (x: MiembroEquipo["baja_por"]) => (typeof x === "string" ? x : x?.nombre ?? "—");

export function PestanaEquipo() {
  const { esAdmin } = useNivelStaff();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["equipo"], queryFn: equipo });
  const { data: yo } = useQuery({ queryKey: ["mi-sesion"], queryFn: miSesion, staleTime: 5 * 60_000 });
  const [nuevo, setNuevo] = useState(false);
  const recargar = () => { void qc.invalidateQueries({ queryKey: ["equipo"] }); void qc.invalidateQueries({ queryKey: ["nivel-staff"] }); };
  if (!data) return <Cargando />;
  const activos = data.miembros.filter((m) => m.activo);
  const bajas = data.miembros.filter((m) => !m.activo);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{activos.length} activos · {plural(data.admins_activos, "admin", "admins")}</p>
        {esAdmin && <Button onClick={() => setNuevo(true)}><Plus className="size-4" /> Nuevo miembro</Button>}
      </div>
      <ul className="flex flex-col gap-3">
        {activos.map((m) => <FilaMiembro key={m.persona_id} m={m} yo={m.persona_id === yo?.persona_id} admin={esAdmin} onCambio={recargar} />)}
      </ul>
      {bajas.length > 0 && (
        <>
          <h3 className="mt-2 text-base font-semibold">De baja</h3>
          <ul className="flex flex-col gap-3">
            {bajas.map((m) => <FilaMiembro key={m.persona_id} m={m} yo={m.persona_id === yo?.persona_id} admin={esAdmin} onCambio={recargar} />)}
          </ul>
        </>
      )}
      {esAdmin && <NuevoMiembro abierto={nuevo} onAbierto={setNuevo} onCreado={recargar} />}
    </div>
  );
}

function FilaMiembro({ m, yo, admin, onCambio }: { m: MiembroEquipo; yo: boolean; admin: boolean; onCambio: () => void }) {
  const conTotp = useConTotp();
  const [accion, setAccion] = useState<null | "nivel" | "baja" | "reactivar" | "reinvitar">(null);
  const [nivelReact, setNivelReact] = useState<Nivel>(m.nivel);
  const otro: Nivel = m.nivel === "admin" ? "soporte" : "admin";
  const estado = m.cuenta_activada ? "Activa" : m.invitacion_vence_en ? `Invitación pendiente (vence ${instante(m.invitacion_vence_en)})` : "Sin activar";
  const tfa = m.totp === "activo" ? "2FA activo" : m.totp === "pendiente" ? "Registrando su app" : "Sin 2FA";
  const correr = (fn: () => Promise<void>) => async () => { try { await fn(); setAccion(null); onCambio(); } catch (e) { errorStaff(e, MSG); throw e; } };

  return (
    <li className="flex flex-col gap-2 rounded-2xl bg-card p-4 ring-1 ring-border">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-base font-medium">{nombreCompleto(m)}{yo && " (tú)"}</span>
        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", m.nivel === "admin" ? "bg-primary/15 text-primary" : "bg-secondary text-foreground")}>
          {m.nivel === "admin" ? "Admin" : "Soporte"}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{telefonoVisible(m.telefono)} · {m.correo ?? "sin correo"}</p>
      <p className="text-sm">{estado} · {tfa}</p>
      {!m.activo && <p className="text-sm text-muted-foreground">Baja el {instante(m.baja_en)} por {quien(m.baja_por)}: {m.baja_motivo}</p>}
      {admin && (
        <div className="flex flex-wrap gap-2">
          {m.activo && !m.cuenta_activada && <Button size="sm" variant="secondary" onClick={() => setAccion("reinvitar")}>Reenviar invitación</Button>}
          {m.activo && !yo && <Button size="sm" variant="secondary" onClick={() => setAccion("nivel")}>Cambiar nivel</Button>}
          {m.activo && !yo && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAccion("baja")}>Dar de baja</Button>}
          {!m.activo && !yo && <Button size="sm" variant="secondary" onClick={() => setAccion("reactivar")}>Reactivar</Button>}
        </div>
      )}
      <ConfirmarMotivo abierto={accion === "reinvitar"} onAbierto={(o) => !o && setAccion(null)} pideMotivo={false} titulo={`¿Reenviar la invitación a ${m.nombre}?`} boton="Sí, reenviar"
        accion={correr(async () => { const r = await conTotp(() => reinvitarMiembro(m.persona_id)); toast.success(`Invitación enviada; vence el ${instante(r.invitacion_vence_en)}`); })} />
      <ConfirmarMotivo abierto={accion === "nivel"} onAbierto={(o) => !o && setAccion(null)} nota={NOTA_AUDITORIA}
        titulo={`¿Cambiar a ${m.nombre} a ${otro === "admin" ? "Admin" : "Soporte"}?`} descripcion={otro === "admin" ? ALERTA_ADMINS : undefined} boton="Sí, cambiar"
        accion={(motivo) => correr(async () => { await conTotp(() => nivelMiembro(m.persona_id, otro, motivo)); toast.success("Nivel actualizado"); })()} />
      <ConfirmarMotivo abierto={accion === "baja"} onAbierto={(o) => !o && setAccion(null)} nota={NOTA_AUDITORIA} destructivo
        titulo={`¿Dar de baja a ${m.nombre}?`} descripcion={`Cierra sus sesiones de Staff y borra su 2FA. ${ALERTA_ADMINS}`} boton="Sí, dar de baja"
        accion={(motivo) => correr(async () => { const r = await conTotp(() => bajaMiembro(m.persona_id, motivo)); toast.success(`Baja hecha. Sesiones cerradas: ${r.sesiones_revocadas}`); })()} />
      <ConfirmarMotivo abierto={accion === "reactivar"} onAbierto={(o) => !o && setAccion(null)} nota={NOTA_AUDITORIA}
        titulo={`¿Reactivar a ${m.nombre}?`} descripcion={`Tendrá que registrar su app otra vez.${nivelReact === "admin" ? ` ${ALERTA_ADMINS}` : ""}`} boton="Sí, reactivar"
        extra={<SelectorNivel valor={nivelReact} onChange={setNivelReact} />}
        accion={(motivo) => correr(async () => { await conTotp(() => reactivarMiembro(m.persona_id, nivelReact, motivo)); toast.success("Miembro reactivado"); })()} />
    </li>
  );
}

function SelectorNivel({ valor, onChange }: { valor: Nivel; onChange: (v: Nivel) => void }) {
  return (
    <div className="flex gap-2">
      {(["soporte", "admin"] as const).map((n) => (
        <button key={n} type="button" onClick={() => onChange(n)}
          className={cn("tap-target flex-1 rounded-xl text-sm font-semibold ring-1", valor === n ? "bg-primary text-primary-foreground ring-primary" : "ring-border")}>
          {n === "admin" ? "Admin" : "Soporte"}
        </button>
      ))}
    </div>
  );
}

function NuevoMiembro({ abierto, onAbierto, onCreado }: { abierto: boolean; onAbierto: (v: boolean) => void; onCreado: () => void }) {
  const conTotp = useConTotp();
  const [lada, setLada] = useState("+52");
  const [tel, setTel] = useState("");
  const [nombre, setNombre] = useState("");
  const [ap, setAp] = useState("");
  const [am, setAm] = useState("");
  const [correo, setCorreo] = useState("");
  const [nivel, setNivel] = useState<Nivel>("soporte");
  const ok = /^\+\d{1,4}$/.test(lada) && tel.length === 10 && nombre.trim().length > 0 && /^\S+@\S+\.\S+$/.test(correo.trim());
  return (
    <ConfirmarMotivo abierto={abierto} onAbierto={onAbierto} pideMotivo={false} listo={ok} titulo="Nuevo miembro de Staff"
      descripcion={`En su primer inicio de sesión registrará su app autenticadora.${nivel === "admin" ? ` ${ALERTA_ADMINS}` : ""}`} boton="Dar de alta"
      extra={
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nm-tel">Teléfono</Label>
            <div className="flex gap-2">
              <Input aria-label="Lada" className="h-10 w-20" value={lada} onChange={(e) => setLada("+" + e.target.value.replace(/\D/g, "").slice(0, 4))} />
              <Input id="nm-tel" inputMode="numeric" className="h-10 flex-1" value={tel} onChange={(e) => setTel(e.target.value.replace(/\D/g, "").slice(0, 10))} />
            </div>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="nm-n">Nombre</Label><Input id="nm-n" maxLength={100} className="h-10" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-2">
            <div className="flex flex-col gap-1.5"><Label htmlFor="nm-ap">Apellido paterno</Label><Input id="nm-ap" maxLength={100} className="h-10" value={ap} onChange={(e) => setAp(e.target.value)} /></div>
            <div className="flex flex-col gap-1.5"><Label htmlFor="nm-am">Apellido materno</Label><Input id="nm-am" maxLength={100} className="h-10" value={am} onChange={(e) => setAm(e.target.value)} /></div>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="nm-c">Correo</Label><Input id="nm-c" type="email" className="h-10" value={correo} onChange={(e) => setCorreo(e.target.value)} /></div>
          <SelectorNivel valor={nivel} onChange={setNivel} />
        </div>
      }
      accion={async () => {
        try {
          const r = await conTotp(() => altaMiembro({
            telefono: `${lada}${tel}`, nombre: nombre.trim(), correo: correo.trim(), nivel,
            ...(ap.trim() ? { apellido_paterno: ap.trim() } : {}), ...(am.trim() ? { apellido_materno: am.trim() } : {}),
          }));
          toast.success(r.invitacion_vence_en ? "Le enviamos una invitación por WhatsApp" : "Ya tenía cuenta: le avisamos");
          setTel(""); setNombre(""); setAp(""); setAm(""); setCorreo(""); setNivel("soporte");
          onAbierto(false);
          onCreado();
        } catch (e) { errorStaff(e, MSG); throw e; }
      }} />
  );
}
