import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { fechaCorta, instante, nombreCompleto, telefonoVisible } from "@/lib/api/formato";
import {
  cambiarLimiteTarjetas, cambiarModulo, cambiarWhatsapp, cambiarZonaHoraria, portafolios, reenviarInvitacionDueno,
  type DetalleNegocioStaff, type Modulo, type ModuloNegocio,
} from "@/lib/api/staff";
import { ConfirmarMotivo, errorStaff, SelectorZona, ZONAS } from "./comun";

const NOMBRE_MOD: Record<Modulo, string> = { monedero: "Monedero", tarjetas_sellos: "Tarjetas de sellos" };
const MSG: Record<string, string> = {
  zona_horaria_invalida: "Esa zona horaria no existe",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
  limite_tarjetas_invalido: "El límite debe ser de 1 a 50.",
  ultimo_modulo: "Debe quedar otro módulo que acumule",
  negocio_suspendido: "Reactívalo primero",
  no_encontrado: "Este negocio ya no existe.",
};

const textoModulo = (m: ModuloNegocio) =>
  m.estado === "activo" ? "Activo" : m.estado === "en_retiro" ? `En retiro desde ${fechaCorta(m.retiro_desde)}: ya no acumula, solo se canjea lo que hay` : "Apagado";

export function BloqueDueno({ d, admin }: { d: DetalleNegocioStaff; admin: boolean }) {
  const [enviando, setEnviando] = useState(false);
  const [confirmar, setConfirmar] = useState(false);
  const du = d.dueno;
  if (!du) return null;
  const reenviar = async () => {
    setEnviando(true);
    try {
      const r = await reenviarInvitacionDueno(d.negocio_id);
      toast.success(`Invitación enviada; vence el ${instante(r.invitacion_vence_en)}`);
      setConfirmar(false);
    } catch (e) {
      setConfirmar(false);
      errorStaff(e, MSG);
    } finally {
      setEnviando(false);
    }
  };
  return (
    <section className="flex flex-col gap-1 rounded-2xl bg-card p-4 ring-1 ring-border">
      <h3 className="text-base font-semibold">Dueño</h3>
      <p className="text-base">{nombreCompleto(du)}</p>
      <p className="text-sm text-muted-foreground">{telefonoVisible(du.telefono)}</p>
      {du.correo ? <p className="break-all text-sm text-muted-foreground">{du.correo}</p> : <p className="text-sm font-medium text-warn">Sin correo: no podrá recuperar su acceso</p>}
      <p className="text-sm">{du.cuenta_activada ? "Cuenta activada" : "Invitación pendiente"} · {du.tiene_2fa ? "Con 2FA" : "Sin 2FA"}</p>
      {admin && !du.cuenta_activada && (
        <Button size="sm" variant="secondary" className="mt-2 self-start" disabled={enviando} onClick={() => setConfirmar(true)}>Reenviar invitación</Button>
      )}
      <ConfirmarMotivo abierto={confirmar} onAbierto={setConfirmar} pideMotivo={false} titulo="¿Reenviar la invitación?"
        descripcion="El dueño recibe un enlace nuevo por WhatsApp para definir su PIN." boton="Sí, reenviar" accion={reenviar} />
    </section>
  );
}

function zonaNombre(z: string) {
  return ZONAS.find(([x]) => x === z)?.[1] ?? z;
}

function BloqueLimite({ d, admin, onCambio }: { d: DetalleNegocioStaff; admin: boolean; onCambio: () => void }) {
  const lim = useModoEdicion<string>(String(d.limite_tarjetas_activas ?? 1));
  const [confLimite, setConfLimite] = useState(false);
  const limOk = /^\d+$/.test(lim.valores) && Number(lim.valores) >= 1 && Number(lim.valores) <= 50;

  const guardar = async () => {
    try {
      const r = await cambiarLimiteTarjetas(d.negocio_id, Number(lim.valores));
      toast.success(`Límite: ${r.limite_tarjetas_activas} (antes ${r.antes}; activas ${r.activas})`);
      setConfLimite(false);
      lim.terminar(String(r.limite_tarjetas_activas));
      onCambio();
    } catch (e) {
      setConfLimite(false);
      const err = e instanceof ApiError ? e : null;
      if (err?.codigo === "limite_menor_a_activas") {
        const a = err.extras["activas"];
        toast.error(`${typeof err.extras["message"] === "string" ? err.extras["message"] : "El límite no puede quedar por debajo de las tarjetas activas"}${typeof a === "number" ? ` (activas: ${a})` : ""}`);
      } else errorStaff(e, MSG);
      throw e;
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {lim.editando ? (
        <div ref={lim.ref} className="flex flex-col gap-1.5">
          <Label htmlFor="pl-lim">Límite de tarjetas activas</Label>
          <div className="flex gap-2">
            <Input id="pl-lim" inputMode="numeric" className="h-10 w-20" value={lim.valores} onChange={(e) => lim.setValores(e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </div>
          <BotonesEdicion cambiado={lim.cambiado && limOk} onGuardar={() => setConfLimite(true)} onCancelar={lim.cancelar} />
        </div>
      ) : (
        <VistaLectura puedeEditar={admin} onEditar={lim.editar} datos={[{ etiqueta: "Límite de tarjetas activas", valor: lim.guardado }]} />
      )}
      <ConfirmarMotivo
        abierto={confLimite}
        onAbierto={setConfLimite}
        pideMotivo={false}
        titulo={`¿Cambiar el límite a ${Number(lim.valores) === 1 ? "1 tarjeta activa" : `${lim.valores} tarjetas activas`}?`}
        boton="Sí, cambiar"
        accion={guardar}
      />
    </div>
  );
}

function BloqueZona({ d, admin, onCambio }: { d: DetalleNegocioStaff; admin: boolean; onCambio: () => void }) {
  const zona = useModoEdicion<string>(d.zona_horaria ?? "America/Mexico_City");
  const [confZona, setConfZona] = useState(false);

  const guardar = async (motivo: string) => {
    try {
      const r = await cambiarZonaHoraria(d.negocio_id, zona.valores, motivo);
      toast.success(`Zona horaria: ${zonaNombre(r.zona_horaria)}. Cajas cerradas: ${r.cajas_cerradas}`, {
        description: r.advertencias.length ? r.advertencias.join(" ") : undefined,
      });
      setConfZona(false);
      zona.terminar(r.zona_horaria);
      onCambio();
    } catch (e) { errorStaff(e, MSG); throw e; }
  };

  return (
    <div className="flex flex-col gap-1.5">
      {zona.editando ? (
        <div ref={zona.ref} className="flex flex-col gap-1.5">
          <Label htmlFor="pl-zona">Zona horaria</Label>
          <SelectorZona id="pl-zona" valor={zona.valores} onChange={zona.setValores} />
          <BotonesEdicion cambiado={zona.cambiado && !!zona.valores} onGuardar={() => setConfZona(true)} onCancelar={zona.cancelar} />
        </div>
      ) : (
        <VistaLectura puedeEditar={admin} onEditar={zona.editar} datos={[{ etiqueta: "Zona horaria", valor: zonaNombre(zona.guardado) }]} />
      )}
      <ConfirmarMotivo
        abierto={confZona}
        onAbierto={setConfZona}
        titulo={`¿Cambiar la zona horaria a ${zonaNombre(zona.valores)}?`}
        descripcion="Mueve el corte de las 5:00 y los vencimientos, y cierra las cajas (los cajeros vuelven a escribir el PIN POS)."
        boton="Sí, cambiar"
        accion={guardar}
      />
    </div>
  );
}

function BloqueWhatsapp({ d, admin, onCambio }: { d: DetalleNegocioStaff; admin: boolean; onCambio: () => void }) {
  const { data: lista } = useQuery({ queryKey: ["portafolios"], queryFn: portafolios, enabled: admin });
  const libres = (lista?.portafolios ?? []).filter((p) => p.estado === "activo" && p.libres > 0 && p.portafolio_id !== d.whatsapp?.portafolio_id);
  const wa = useModoEdicion<string>("");
  const [confPf, setConfPf] = useState(false);
  const pf = wa.valores;

  const guardar = async (motivo: string) => {
    try {
      await cambiarWhatsapp(d.negocio_id, d.whatsapp ? { portafolio_id: pf, motivo } : { portafolio_id: pf });
      toast.success(`WhatsApp en ${pf}`);
      setConfPf(false);
      wa.terminar("");
      onCambio();
    } catch (e) { errorStaff(e, MSG); throw e; }
  };

  const textoActual = d.whatsapp ? `${d.whatsapp.portafolio_id} · ${telefonoVisible(d.whatsapp.numero_whatsapp)}` : "Sin número";

  return (
    <div className="flex flex-col gap-1.5">
      {wa.editando ? (
        <div ref={wa.ref} className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">WhatsApp</span>
          <p className="text-sm">{textoActual}</p>
          <div className="flex gap-2">
            <select aria-label="Portafolio" value={pf} onChange={(e) => wa.setValores(e.target.value)} className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-sm">
              <option value="">Elige un portafolio…</option>
              {libres.map((p) => <option key={p.portafolio_id} value={p.portafolio_id}>{p.portafolio_id} · {p.libres} libres</option>)}
            </select>
          </div>
          <BotonesEdicion textoGuardar={d.whatsapp ? "Mover" : "Asignar"} cambiado={wa.cambiado && !!pf} onGuardar={() => setConfPf(true)} onCancelar={wa.cancelar} />
        </div>
      ) : (
        <VistaLectura puedeEditar={admin} onEditar={wa.editar} datos={[{ etiqueta: "WhatsApp", valor: textoActual }]} />
      )}
      <ConfirmarMotivo
        abierto={confPf}
        onAbierto={setConfPf}
        pideMotivo={!!d.whatsapp}
        titulo={d.whatsapp ? `¿Mover el WhatsApp a ${pf}?` : `¿Asignar el portafolio ${pf}?`}
        boton={d.whatsapp ? "Sí, mover" : "Sí, asignar"}
        accion={guardar}
      />
    </div>
  );
}

export function PlanNegocio({ d, admin, onCambio }: { d: DetalleNegocioStaff; admin: boolean; onCambio: () => void }) {
  const [modulo, setModulo] = useState<ModuloNegocio | null>(null);

  return (
    <section className="flex flex-col gap-4 rounded-2xl bg-card p-4 ring-1 ring-border">
      <h3 className="text-base font-semibold">Plan</h3>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Módulos</span>
        {(d.modulos ?? []).map((m) => (
          <div key={m.modulo} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium">{NOMBRE_MOD[m.modulo]}</p>
              <p className="text-xs text-muted-foreground">{textoModulo(m)}</p>
            </div>
            {admin && (
              <Button size="sm" variant={m.estado === "activo" ? "ghost" : "secondary"} className={m.estado === "activo" ? "text-destructive" : ""} onClick={() => setModulo(m)}>
                {m.estado === "activo" ? "Retirar" : "Activar"}
              </Button>
            )}
          </div>
        ))}
      </div>

      <BloqueLimite d={d} admin={admin} onCambio={onCambio} />
      <BloqueZona d={d} admin={admin} onCambio={onCambio} />
      <BloqueWhatsapp d={d} admin={admin} onCambio={onCambio} />

      <ConfirmarMotivo
        abierto={!!modulo}
        onAbierto={(o) => !o && setModulo(null)}
        titulo={modulo ? `¿${modulo.estado === "activo" ? "Retirar" : "Activar"} ${NOMBRE_MOD[modulo.modulo]}?` : ""}
        descripcion={modulo?.estado === "activo" ? "Deja de acumular; los clientes pueden canjear lo que ya tienen." : undefined}
        boton={modulo?.estado === "activo" ? "Sí, retirar" : "Sí, activar"}
        accion={async (motivo) => {
          if (!modulo) return;
          try {
            const r = await cambiarModulo(d.negocio_id, modulo.modulo, modulo.estado !== "activo", motivo);
            toast.success(r.estado === "en_retiro" ? "Quedó en retiro" : r.estado === "apagado" ? "Quedó apagado: no había saldo ni sellos vivos" : "Quedó activo");
            setModulo(null);
            onCambio();
          } catch (e) { errorStaff(e, MSG); throw e; }
        }}
      />
    </section>
  );
}
