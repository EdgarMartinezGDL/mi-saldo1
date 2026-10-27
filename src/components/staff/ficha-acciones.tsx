import { useState } from "react";
import { toast } from "sonner";
import { useConTotp } from "@/components/totp-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/client";
import { instante, pesos, telefonoVisible } from "@/lib/api/formato";
import {
  bajaClienteStaff, confirmarTelefono, liberarTelefono, restablecerTotp, retirarPromociones, solicitarTelefono,
  type FichaPersona, type PerdidaNegocio,
} from "@/lib/api/staff";
import { ConfirmarMotivo, errorStaff, NOTA_AUDITORIA, useStaffNav } from "./comun";
import { useDesplazarAlAbrir } from "@/lib/use-desplazar";
import { plural } from "@/lib/plural";
import { RestablecerPinStaff } from "./restablecer-pin";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const MSG: Record<string, string> = {
  no_encontrada: "Esta persona ya no existe.",
  no_encontrado: "Ya no existe: recarga la ficha.",
  no_es_cliente: "No es cliente de ese negocio.",
  motivo_invalido: "El motivo debe tener de 5 a 500 caracteres.",
  telefono_invalido: "Revisa el número.",
  sin_correo: "No tiene correo: no hay cómo verificarla",
  vencido: "El código venció. Pide otro código",
  agotado: "Demasiados intentos: pide otro código.",
  propio: "El tuyo lo restablece otro admin",
};

/** Extra data of the record (ARCO access request answer). */
export function DatosFicha({ f }: { f: FichaPersona }) {
  const r = f.roles;
  const roles = [
    ...r.dueno.map((d) => `Dueño de ${d.nombre_comercial}`),
    ...r.empleado.map((d) => `Empleado de ${d.nombre_comercial}`),
    ...(r.cliente > 0 ? [`Cliente en ${r.cliente} ${r.cliente === 1 ? "negocio" : "negocios"}`] : []),
    ...(f.staff ? [`Staff (${f.staff.nivel}, ${f.staff.activo ? "activo" : "de baja"})`] : r.staff ? ["Staff"] : []),
  ];
  return (
    <div className="mt-3 flex flex-col gap-1 text-sm">
      {!f.telefono && f.telefono_liberado && (
        <p className="font-medium text-warn">Sin teléfono (antes {telefonoVisible(f.telefono_liberado)}, liberado el {instante(f.telefono_liberado_en)})</p>
      )}
      <p>{roles.length ? roles.join(" · ") : "Sin roles"}</p>
      <p className="text-muted-foreground">
        {f.nacimiento_dia && f.nacimiento_mes ? `Cumpleaños: ${f.nacimiento_dia} de ${MESES[f.nacimiento_mes - 1]}` : "Sin cumpleaños"}
        {f.creado_en && ` · Cuenta creada ${instante(f.creado_en)}`}
        {typeof f.sesiones_abiertas === "number" && ` · ${f.sesiones_abiertas} ${f.sesiones_abiertas === 1 ? "sesión abierta" : "sesiones abiertas"}`}
      </p>
      {(f.avisos_privacidad?.length ?? 0) > 0 && (
        <div className="mt-2">
          <p className="font-medium">Avisos de privacidad aceptados</p>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
            {f.avisos_privacidad!.map((a, i) => (
              <li key={`${a.version}-${i}`}>{a.version} · {instante(a.aceptado_en)} · {a.origen === "caja" ? "en caja" : "en la app"}{a.negocio ? ` · ${a.negocio}` : ""}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Perdidas({ ns }: { ns: PerdidaNegocio[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm text-destructive">
      {ns.map((n, i) => (
        <li key={i}>
          <p className="font-semibold">{n.negocio.nombre_comercial}</p>
          <p>Saldo: {pesos(n.saldo_centavos)}</p>
          {n.tarjetas.map((t) => <p key={t.tarjeta}>{t.tarjeta}: {plural(t.sellos_en_curso, "sello", "sellos")} y {plural(t.premios_por_canjear, "premio", "premios")}</p>)}
          {n.reclamaciones_pendientes > 0 && <p>{plural(n.reclamaciones_pendientes, "reclamación pendiente", "reclamaciones pendientes")}</p>}
          {n.referidos_pendientes > 0 && <p>{plural(n.referidos_pendientes, "recomendación pendiente", "recomendaciones pendientes")}</p>}
        </li>
      ))}
    </ul>
  );
}

/** "Acciones" section of the record (admin only). */
export function AccionesPersona({ f, onCambio }: { f: FichaPersona; onCambio: () => void }) {
  const conTotp = useConTotp();
  const { verAuditoria } = useStaffNav();
  const [abierto, setAbierto] = useState<null | "promo" | "baja" | "liberar" | "totp" | "codigo" | "pin">(null);
  const [negocio, setNegocio] = useState<string>("");
  const [comprobante, setComprobante] = useState<PerdidaNegocio[] | null>(null);
  const [lada, setLada] = useState("+52");
  const [num, setNum] = useState("");
  const [cambio, setCambio] = useState<{ cambio_id: string; expira_en: string; correo: string } | null>(null);
  const [codigo, setCodigo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const refComprobante = useDesplazarAlAbrir<HTMLDivElement>(!!comprobante);
  const refCodigo = useDesplazarAlAbrir<HTMLDivElement>(!!cambio, true);

  const conPromo = f.clientes.filter((c) => c.acepta_promociones);
  const elegidos = negocio ? f.clientes.filter((c) => c.negocio.negocio_id === negocio) : f.clientes;
  const perdidaVista: PerdidaNegocio[] = elegidos.map((c) => ({
    negocio: c.negocio,
    saldo_centavos: c.monedero?.saldo_centavos ?? 0,
    tarjetas: (c.tarjetas ?? []).map((t) => ({ tarjeta: t.tarjeta, sellos_en_curso: t.sellos_actuales, premios_por_canjear: t.estado === "completa" ? 1 : 0 })),
    reclamaciones_pendientes: c.reclamaciones_pendientes,
    referidos_pendientes: 0,
  }));
  const fallar = (e: unknown) => { errorStaff(e, MSG); throw e; };
  const cuerpo = (motivo: string) => (negocio ? { negocio_id: negocio, motivo } : { motivo });

  const SelectorNegocio = ({ lista }: { lista: typeof f.clientes }) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="acc-neg">Negocio</Label>
      <select id="acc-neg" value={negocio} onChange={(e) => setNegocio(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
        <option value="">En todos sus negocios</option>
        {lista.map((c) => <option key={c.negocio.negocio_id} value={c.negocio.negocio_id}>{c.negocio.nombre_comercial}</option>)}
      </select>
    </div>
  );

  const pedirCodigo = async () => {
    setOcupado(true);
    try {
      const r = await solicitarTelefono(f.persona_id, `${lada}${num}`);
      setCambio(r);
      setCodigo("");
    } catch (e) {
      errorStaff(e, MSG);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">Acciones</h3>
        <Button size="sm" variant="link" onClick={() => verAuditoria({ persona_id: f.persona_id, etiqueta: f.nombre })}>Ver en la auditoría</Button>
      </div>
      <div className="flex flex-wrap gap-2">
        {conPromo.length > 0 && <Button size="sm" variant="secondary" onClick={() => { setNegocio(""); setAbierto("promo"); }}>Retirar promociones</Button>}
        {f.clientes.length > 0 && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { setNegocio(""); setAbierto("baja"); }}>Dar de baja como cliente</Button>}
        {f.telefono && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setAbierto("liberar")}>Liberar el teléfono</Button>}
        {f.tiene_2fa && <Button size="sm" variant="secondary" onClick={() => setAbierto("totp")}>Restablecer su 2FA</Button>}
      </div>

      {comprobante && (
        <div ref={refComprobante} className="rounded-xl bg-destructive/10 p-3">
          <p className="mb-2 text-sm font-semibold">Baja hecha. Perdió:</p>
          <Perdidas ns={comprobante} />
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setComprobante(null)}>Cerrar</Button>
        </div>
      )}

      <RestablecerPinStaff personaId={f.persona_id} nombre={f.nombre} abierto={abierto === "pin"} onAbrir={() => setAbierto("pin")} onCerrar={() => setAbierto(null)} />

      {!f.telefono && (
        <div className="flex flex-col gap-2 rounded-xl p-3 ring-1 ring-border">
          <p className="text-sm font-medium">Asignar un número nuevo</p>
          {!cambio ? (
            <div className="flex gap-2">
              <Input aria-label="Lada" className="h-10 w-20" value={lada} onChange={(e) => setLada("+" + e.target.value.replace(/\D/g, "").slice(0, 4))} />
              <Input aria-label="Número nuevo" inputMode="numeric" className="h-10 flex-1" value={num} onChange={(e) => setNum(e.target.value.replace(/\D/g, "").slice(0, 12))} />
              <Button size="sm" disabled={ocupado || num.length < 8} onClick={() => void pedirCodigo()}>{ocupado ? "Enviando…" : "Enviar código"}</Button>
            </div>
          ) : (
            <div ref={refCodigo}>
              <p className="text-sm">Le enviamos un código a {cambio.correo}; vence {instante(cambio.expira_en)}: pídele que te lo dicte.</p>
              <div className="flex gap-2">
                <Input aria-label="Código" inputMode="numeric" maxLength={6} className="h-10 w-32 text-center font-mono" value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))} />
                <Button size="sm" disabled={codigo.length !== 6} onClick={() => setAbierto("codigo")}>Confirmar</Button>
                <Button size="sm" variant="ghost" onClick={() => setCambio(null)}>Pedir otro</Button>
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmarMotivo abierto={abierto === "promo"} onAbierto={(o) => !o && setAbierto(null)} titulo={`¿Retirar las promociones de ${f.nombre}?`}
        descripcion="Solo se retiran: volver a aceptarlas lo decide la persona desde su app" nota={NOTA_AUDITORIA} boton="Sí, retirar"
        extra={<SelectorNegocio lista={conPromo} />}
        accion={async (motivo) => {
          try {
            const r = await retirarPromociones(f.persona_id, cuerpo(motivo));
            const ya = r.negocios.filter((n) => !n.retiradas).map((n) => n.nombre_comercial);
            toast.success(`Se retiraron en ${plural(r.retiradas, "negocio", "negocios")}`, { description: ya.length ? `Ya las tenía retiradas: ${ya.join(", ")}` : undefined });
            setAbierto(null);
            onCambio();
          } catch (e) { fallar(e); }
        }} />

      <ConfirmarMotivo abierto={abierto === "baja"} onAbierto={(o) => !o && setAbierto(null)} titulo={`¿Dar de baja a ${f.nombre} como cliente?`} destructivo
        descripcion="Inmediata e irreversible. Su historial pasa a 'Cliente eliminado'; si no tiene otro rol, la persona se anonimiza y su teléfono y correo quedan libres"
        nota={NOTA_AUDITORIA} boton="Sí, dar de baja"
        extra={<><SelectorNegocio lista={f.clientes} /><div className="rounded-xl bg-destructive/10 p-3"><Perdidas ns={perdidaVista} /></div></>}
        accion={async (motivo) => {
          try {
            const r = await conTotp(() => bajaClienteStaff(f.persona_id, cuerpo(motivo)));
            setComprobante(r.negocios);
            toast.success(r.cuenta_eliminada ? "Baja hecha: la persona quedó anonimizada" : `Baja hecha. Sesiones cerradas: ${r.sesiones_cerradas}`);
            setAbierto(null);
            onCambio();
          } catch (e) { fallar(e); }
        }} />

      <ConfirmarMotivo abierto={abierto === "liberar"} onAbierto={(o) => !o && setAbierto(null)} titulo={`¿Liberar el ${telefonoVisible(f.telefono)}?`} destructivo
        descripcion="Quita el número, cierra todas sus sesiones y anula sus invitaciones y solicitudes pendientes. El aviso le llega solo por correo"
        nota={NOTA_AUDITORIA} boton="Sí, liberar"
        accion={async (motivo) => {
          try {
            const r = await conTotp(() => liberarTelefono(f.persona_id, { validacion_id: null, motivo }));
            toast.success(`Teléfono liberado. Sesiones cerradas: ${r.sesiones_revocadas}`, {
              description: r.tiene_correo ? undefined : "No tiene correo: no podrá recuperar su cuenta hasta que le asignes un número",
            });
            setAbierto(null);
            onCambio();
          } catch (e) { fallar(e); }
        }} />

      <ConfirmarMotivo abierto={abierto === "totp"} onAbierto={(o) => !o && setAbierto(null)} titulo={`¿Restablecer el 2FA de ${f.nombre}?`}
        descripcion="Borra su app autenticadora y cierra todas sus sesiones. Si es Staff, la registrará de nuevo al entrar; si es dueño, queda sin 2FA hasta que lo active"
        nota={NOTA_AUDITORIA} boton="Sí, restablecer"
        accion={async (motivo) => {
          try {
            const r = await conTotp(() => restablecerTotp(f.persona_id, motivo));
            toast.success(`2FA restablecido. Sesiones cerradas: ${r.sesiones_revocadas}`);
            setAbierto(null);
            onCambio();
          } catch (e) { fallar(e); }
        }} />

      <ConfirmarMotivo abierto={abierto === "codigo"} onAbierto={(o) => !o && setAbierto(null)} pideMotivo={false}
        titulo={`¿Asignar el ${telefonoVisible(`${lada}${num}`)} a ${f.nombre}?`} boton="Sí, asignar"
        accion={async () => {
          if (!cambio) return;
          try {
            await conTotp(() => confirmarTelefono(cambio.cambio_id, codigo));
            toast.success("Listo: entra con su PIN de siempre");
            setCambio(null); setNum(""); setCodigo("");
            setAbierto(null);
            onCambio();
          } catch (e) {
            const err = e instanceof ApiError ? e : null;
            if (err?.codigo === "codigo_incorrecto") {
              const r = err.extras["intentos_restantes"];
              toast.error(typeof r === "number" ? (r === 1 ? "Código incorrecto. Te queda 1 intento" : `Código incorrecto. Te quedan ${r} intentos`) : "Código incorrecto.");
              setCodigo("");
              throw e;
            }
            if (err?.codigo === "no_encontrado" || err?.codigo === "vencido" || err?.codigo === "agotado") setCambio(null);
            fallar(e);
          }
        }} />
    </div>
  );
}
