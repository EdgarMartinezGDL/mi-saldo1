import { api } from "./client";
import { query } from "./formato";
import type { ResultadoAjuste } from "./operacion";

export type EstadoMembresia = "prueba" | "activa" | "gracia" | "vencida" | "suspendida";

export interface ResumenStaff {
  negocios: { total: number; por_estado: Record<EstadoMembresia, number>; vencen_7_dias: number; sin_pago: number };
  alertas_pendientes: number;
  whatsapp: { lugares_libres: number; alerta_capacidad: boolean; negocios_sin_whatsapp: number };
  staff: { miembros_activos: number; admins_activos: number };
}

export interface NegocioStaff {
  negocio_id: string;
  nombre_comercial: string;
  giro: string | null;
  dueno: { nombre: string; apellido_paterno: string | null; telefono: string | null; correo: string | null };
  membresia: {
    estado: EstadoMembresia;
    fecha_vencimiento: string;
    dias_para_vencer: number;
    bloqueo_desde: string;
    aviso_pago_pendiente: boolean;
  };
}

export interface Persona {
  persona_id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  telefono: string | null;
  correo: string | null;
  cuenta_activada: boolean;
  tiene_2fa: boolean;
  roles: {
    dueno: { negocio_id: string; nombre_comercial: string }[];
    empleado: { negocio_id: string; nombre_comercial: string }[];
    cliente: number;
    staff: boolean;
  };
}

export type FichaPersona = Persona & FichaExtra & {
  nacimiento_dia: number | null;
  nacimiento_mes: number | null;
  eliminada: boolean;
  clientes: {
    negocio_cliente_id: string;
    negocio: { negocio_id: string; nombre_comercial: string; membresia: EstadoMembresia };
    monedero: { saldo_centavos: number; fecha_vencimiento: string | null } | null;
    tarjetas: {
      tarjeta_digital_id: string;
      tarjeta: string;
      estado: "abierta" | "completa";
      sellos_actuales: number;
      sellos_requeridos: number;
      fecha_vencimiento: string | null;
    }[];
    reclamaciones_pendientes: number;
    cliente_desde: string;
    ultima_compra_en: string | null;
    acepta_promociones: boolean;
  }[];
};

export type CambiosPersona = Partial<{
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  nacimiento_dia: number | null;
  nacimiento_mes: number | null;
}>;

export const resumenStaff = () => api<ResumenStaff>("/api/staff/resumen");
export const negociosStaff = (p: { busqueda?: string | undefined; estado?: EstadoMembresia; despues_de?: string; despues_id?: string }) =>
  api<{ total: number; negocios: NegocioStaff[]; siguiente: { despues_de: string; despues_id: string } | null }>(
    `/api/staff/negocios${query({ ...p, limite: 50 })}`,
  );
export const suspenderNegocio = (id: string, motivo: string) =>
  api<{ suspendido: true; sesiones_revocadas: number }>(`/api/staff/negocios/${encodeURIComponent(id)}/suspension`, {
    method: "POST",
    body: { motivo },
  });
export const reactivarNegocio = (id: string, motivo: string) =>
  api<{ estado: EstadoMembresia }>(`/api/staff/negocios/${encodeURIComponent(id)}/reactivacion`, { method: "POST", body: { motivo } });

export const buscarPersonas = (busqueda: string) => api<Persona[]>(`/api/staff/personas${query({ busqueda })}`);
export const fichaPersona = (id: string) => api<FichaPersona>(`/api/staff/personas/${encodeURIComponent(id)}`);
export const rectificarDatos = (id: string, cambios: CambiosPersona, motivo: string) =>
  api<{ cambios: { campo: string }[]; persona: Persona }>(`/api/staff/personas/${encodeURIComponent(id)}/datos`, {
    method: "PUT",
    body: { ...cambios, motivo },
  });

export interface MembresiaStaff {
  estado: EstadoMembresia;
  fecha_inicio: string;
  fecha_vencimiento: string;
  dias_para_vencer: number;
  bloqueo_desde: string;
  aviso_pago_pendiente: boolean;
}

export interface MovimientoMembresia {
  tipo: "extension_manual" | "prueba_gratuita" | "pago_automatico";
  meses_agregados: number | null;
  dias_agregados: number | null;
  monto_centavos: number | null;
  referencia_pago: string | null;
  fecha_vencimiento_anterior: string;
  fecha_vencimiento_nueva: string;
  staff: string | null;
  creado_en: string;
}

export interface DetalleNegocioStaff extends PlanDetalle {
  negocio_id: string;
  nombre_comercial: string;
  activo: boolean;
  membresia_pagada: boolean;
  membresia: MembresiaStaff;
  movimientos: MovimientoMembresia[];
}

export const detalleNegocioStaff = (id: string) => api<DetalleNegocioStaff>(`/api/staff/negocios/${encodeURIComponent(id)}`);
export const registrarPagoMembresia = (id: string, body: { meses: number; monto_centavos: number; referencia_pago: string }) =>
  api<MembresiaStaff>(`/api/staff/negocios/${encodeURIComponent(id)}/membresia/extension`, { method: "POST", body });
export const extenderPrueba = (id: string, dias: number) =>
  api<MembresiaStaff>(`/api/staff/negocios/${encodeURIComponent(id)}/prueba/extension`, { method: "POST", body: { dias } });

/* ---------- P4: level, new business, plan, WhatsApp portfolios, Staff adjustments ---------- */

export type Modulo = "monedero" | "tarjetas_sellos";
export interface ModuloNegocio { modulo: Modulo; estado: "activo" | "en_retiro" | "apagado"; fecha_activacion: string | null; retiro_desde: string | null }
export interface WhatsappNegocio { portafolio_id: string; numero_whatsapp: string; estado_portafolio: EstadoPortafolio; asignado_en: string }
export interface DuenoDetalle {
  persona_id: string;
  nombre: string;
  apellido_paterno: string | null;
  telefono: string | null;
  correo: string | null;
  cuenta_activada: boolean;
  tiene_2fa: boolean;
}
export interface PlanDetalle {
  dueno?: DuenoDetalle | null;
  zona_horaria?: string;
  limite_tarjetas_activas?: number;
  modulos?: ModuloNegocio[];
  whatsapp?: WhatsappNegocio | null;
}

export const miSesion = () => api<{ persona_id: string; rol: string; negocio_id: string | null }>("/api/auth/sesion");
export interface MiembroStaff { persona_id: string; nombre: string; nivel: "admin" | "soporte"; activo: boolean; totp?: string }
export const miembrosStaff = () => api<{ miembros: MiembroStaff[]; admins_activos: number }>("/api/staff/miembros");

export interface CuerpoAltaNegocio {
  telefono: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  correo: string;
  nombre_comercial: string;
  giro: string | null;
  moneda: "MXN";
  zona_horaria: string;
  modulos: Modulo[];
  limite_tarjetas_activas: number;
  dias_prueba: number;
  portafolio_id: string | null;
  titular_confirmado: boolean;
  idempotency_key: string;
}
export interface RespuestaAltaNegocio {
  repetido: boolean;
  negocio_id: string;
  persona_id: string;
  persona_nueva: boolean;
  cuenta_activada: boolean;
  invitacion_vence_en: string | null;
  membresia: { estado: EstadoMembresia; fecha_vencimiento: string };
  whatsapp: WhatsappNegocio | null;
}
export const altaNegocio = (body: CuerpoAltaNegocio) => api<RespuestaAltaNegocio>("/api/staff/negocios", { method: "POST", body });
export const reenviarInvitacionDueno = (id: string) =>
  api<{ invitacion_vence_en: string }>(`/api/staff/negocios/${encodeURIComponent(id)}/invitacion`, { method: "POST" });

export const cambiarModulo = (id: string, modulo: Modulo, activo: boolean, motivo: string) =>
  api<{ modulo: Modulo; antes: string; estado: ModuloNegocio["estado"]; modulos: ModuloNegocio[] }>(
    `/api/staff/negocios/${encodeURIComponent(id)}/modulos/${modulo}`, { method: "PUT", body: { activo, motivo } });
export const cambiarLimiteTarjetas = (id: string, limite_tarjetas_activas: number) =>
  api<{ limite_tarjetas_activas: number; antes: number; activas: number }>(
    `/api/staff/negocios/${encodeURIComponent(id)}/limite-tarjetas`, { method: "PUT", body: { limite_tarjetas_activas } });
export const cambiarZonaHoraria = (id: string, zona_horaria: string, motivo: string) =>
  api<{ zona_horaria: string; antes: string; cajas_cerradas: number; advertencias: string[] }>(
    `/api/staff/negocios/${encodeURIComponent(id)}/zona-horaria`, { method: "PUT", body: { zona_horaria, motivo } });
export const cambiarWhatsapp = (id: string, body: { portafolio_id: string; motivo?: string }) =>
  api<WhatsappNegocio>(`/api/staff/negocios/${encodeURIComponent(id)}/whatsapp`, { method: "PUT", body });

export type EstadoPortafolio = "preparando" | "activo" | "pausado" | "retirado";
export interface Portafolio {
  portafolio_id: string;
  numero_whatsapp: string;
  estado: EstadoPortafolio;
  capacidad: number;
  asignados: number;
  libres: number;
  plantillas_confirmadas_en: string | null;
  nota: string | null;
  creado_en: string;
}
export const portafolios = () =>
  api<{ lugares_libres: number; alerta_capacidad: boolean; negocios_sin_whatsapp: number; portafolios: Portafolio[] }>("/api/staff/portafolios");
export const crearPortafolio = (body: { portafolio_id: string; numero_whatsapp: string; capacidad: number; nota: string | null }) =>
  api<Portafolio>("/api/staff/portafolios", { method: "POST", body });
export const estadoPortafolio = (id: string, body: { estado: EstadoPortafolio; plantillas_confirmadas: boolean; motivo: string }) =>
  api<Portafolio>(`/api/staff/portafolios/${encodeURIComponent(id)}/estado`, { method: "PUT", body });
export const capacidadPortafolio = (id: string, capacidad: number) =>
  api<Portafolio>(`/api/staff/portafolios/${encodeURIComponent(id)}/capacidad`, { method: "PUT", body: { capacidad } });
export const migrarPortafolio = (id: string, motivo: string) =>
  api<{ movidos: number; reparto: Record<string, number> }>(`/api/staff/portafolios/${encodeURIComponent(id)}/migracion`, { method: "POST", body: { motivo } });

export interface ClienteStaff {
  activo: boolean;
  negocio: { negocio_id: string; nombre_comercial: string; membresia: EstadoMembresia; modulos?: unknown[] };
  cliente: { persona_id: string; nombre: string; apellido_paterno: string | null; telefono: string | null };
  monedero: { saldo_centavos: number; fecha_vencimiento: string | null } | null;
  tarjetas: { cliente_tarjeta_id: string; tarjeta_digital_id: string; tarjeta: string; estado: "abierta" | "completa"; sellos_actuales: number; sellos_requeridos: number; fecha_vencimiento: string | null }[];
  ajustes_recientes: { ajuste_id: string; modulo: Modulo; tarjeta?: string | null; solicitado: number; aplicado: number; origen: "dueno" | "staff"; motivo: string; referencia_soporte: string | null; creado_en: string }[];
}
export const clienteStaff = (negocioId: string, personaId: string) =>
  api<ClienteStaff>(`/api/staff/negocios/${encodeURIComponent(negocioId)}/clientes/${encodeURIComponent(personaId)}`);
export type ResultadoAjusteStaff = ResultadoAjuste & { origen: "staff"; referencia_soporte: string | null };
export const ajusteStaffMonedero = (negocioId: string, body: { persona_id: string; monto_centavos: number; motivo: string; referencia_soporte: string | null; idempotency_key: string }) =>
  api<ResultadoAjusteStaff>(`/api/staff/negocios/${encodeURIComponent(negocioId)}/ajustes/monedero`, { method: "POST", body });
export const ajusteStaffSellos = (negocioId: string, body: { persona_id: string; tarjeta_digital_id: string; cantidad: number; motivo: string; referencia_soporte: string | null; idempotency_key: string }) =>
  api<ResultadoAjusteStaff>(`/api/staff/negocios/${encodeURIComponent(negocioId)}/ajustes/sellos`, { method: "POST", body });

/* ---------- P5: person record actions, "No soy yo" alerts, audit, team, test notice ---------- */
export interface FichaExtra {
  telefono_liberado?: string | null;
  telefono_liberado_en?: string | null;
  creado_en?: string;
  sesiones_abiertas?: number;
  staff?: { nivel: "admin" | "soporte"; activo: boolean } | null;
  avisos_privacidad?: { version: string; aceptado_en: string; origen: "caja" | "app" | string; negocio: string | null }[];
}
const pid = (id: string) => `/api/staff/personas/${encodeURIComponent(id)}`;
export interface PerdidaNegocio {
  negocio: { negocio_id?: string; nombre_comercial: string };
  saldo_centavos: number;
  tarjetas: { tarjeta: string; sellos_en_curso: number; premios_por_canjear: number }[];
  reclamaciones_pendientes: number;
  referidos_pendientes: number;
}
export const retirarPromociones = (id: string, body: { negocio_id?: string; motivo: string }) =>
  api<{ retiradas: number; negocios: { negocio_id: string; nombre_comercial: string; retiradas: boolean }[] }>(`${pid(id)}/promociones/retiro`, { method: "POST", body });
export const bajaClienteStaff = (id: string, body: { negocio_id?: string; motivo: string }) =>
  api<{ cuenta_eliminada: boolean; sesiones_cerradas: number; negocios: PerdidaNegocio[] }>(`${pid(id)}/baja-cliente`, { method: "POST", body });
export const liberarTelefono = (id: string, body: { validacion_id: string | null; motivo: string }) =>
  api<{ persona_id: string; telefono_liberado: string; flujos_anulados: number; tiene_correo: boolean; sesiones_revocadas: number }>(
    `${pid(id)}/telefono/liberacion`, { method: "POST", body });
export const solicitarTelefono = (id: string, telefono: string) =>
  api<{ cambio_id: string; expira_en: string; correo: string }>(`${pid(id)}/telefono/solicitud`, { method: "POST", body: { telefono } });
export const confirmarTelefono = (cambioId: string, codigo: string) =>
  api<Persona>(`/api/staff/cambios-telefono/${encodeURIComponent(cambioId)}/confirmacion`, { method: "POST", body: { codigo } });
export const restablecerTotp = (id: string, motivo: string) =>
  api<{ restablecido: true; sesiones_revocadas: number }>(`${pid(id)}/totp/restablecimiento`, { method: "POST", body: { motivo } });

export interface Alerta {
  validacion_id: string;
  tipo: "cliente" | "empleado";
  rechazada_en: string;
  negocio: { negocio_id: string; nombre_comercial: string };
  titular: { persona_id: string; nombre: string; apellido_paterno: string | null; telefono: string | null; correo: string | null; roles: Partial<Persona["roles"]> };
  nombre_capturado: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null };
  capturado_por: { persona_id: string; nombre: string } | null;
  atendida_en: string | null;
  nota: string | null;
  atendida_por: string | { nombre: string } | null;
}
export type Cursor = { antes_de: string; antes_id: string } | null;
export const alertas = (p: { estado: "pendiente" | "atendida"; antes_de?: string; antes_id?: string }) =>
  api<{ total: number; alertas: Alerta[]; siguiente: Cursor }>(`/api/staff/alertas${query({ ...p, limite: 50 })}`);
export const atenderAlerta = (id: string, nota: string) =>
  api<{ atendida: true }>(`/api/staff/alertas/${encodeURIComponent(id)}/atencion`, { method: "POST", body: { nota } });

export interface EventoAuditoria {
  auditoria_id: string;
  creado_en: string;
  accion: string;
  actor: { persona_id?: string; nombre: string; apellido_paterno?: string | null } | null;
  negocio: { negocio_id: string; nombre_comercial: string } | null;
  detalle: unknown;
  ip: string | null;
}
export const auditoria = (p: { negocio_id?: string | undefined; persona_id?: string | undefined; accion?: string | undefined; desde?: string | undefined; hasta?: string | undefined; antes_de?: string; antes_id?: string }) =>
  api<{ eventos: EventoAuditoria[]; siguiente: Cursor }>(`/api/staff/auditoria${query({ ...p, limite: 50 })}`);

export interface MiembroEquipo {
  persona_id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  telefono: string | null;
  correo: string | null;
  nivel: "admin" | "soporte";
  activo: boolean;
  cuenta_activada: boolean;
  totp: "activo" | "pendiente" | "sin_totp";
  invitacion_vence_en: string | null;
  creado_en: string;
  baja_en: string | null;
  baja_motivo: string | null;
  baja_por: string | { nombre: string } | null;
}
const mid = (id: string) => `/api/staff/miembros/${encodeURIComponent(id)}`;
export const equipo = () => api<{ admins_activos: number; miembros: MiembroEquipo[] }>("/api/staff/miembros?incluir_bajas=true");
export const altaMiembro = (body: { telefono: string; nombre: string; apellido_paterno?: string; apellido_materno?: string; correo: string; nivel: "admin" | "soporte" }) =>
  api<{ persona_nueva: boolean; invitacion_vence_en: string | null; miembro: MiembroEquipo }>("/api/staff/miembros", { method: "POST", body });
export const reinvitarMiembro = (id: string) => api<{ invitacion_vence_en: string }>(`${mid(id)}/invitacion`, { method: "POST" });
export const nivelMiembro = (id: string, nivel: "admin" | "soporte", motivo: string) =>
  api<{ antes: string; miembro: MiembroEquipo }>(`${mid(id)}/nivel`, { method: "PUT", body: { nivel, motivo } });
export const bajaMiembro = (id: string, motivo: string) =>
  api<{ miembro: MiembroEquipo; sesiones_revocadas: number }>(`${mid(id)}/baja`, { method: "POST", body: { motivo } });
export const reactivarMiembro = (id: string, nivel: "admin" | "soporte", motivo: string) =>
  api<{ invitacion_vence_en: string | null; miembro: MiembroEquipo }>(`${mid(id)}/reactivacion`, { method: "POST", body: { nivel, motivo } });

export const avisoPrueba = (negocio_id: string | null) =>
  api<{ encoladas: { id: string; canal: "whatsapp" | "correo" }[] }>("/api/notificaciones/prueba", { method: "POST", body: { negocio_id } });

export type MotivoRestablecimiento = "tiene_correo" | "sin_rol_negocio" | "cuenta_sin_activar" | "es_staff" | "persona_eliminada" | "propio";
export interface EstadoRestablecimiento { puede: boolean; motivo: MotivoRestablecimiento | null; enlace_vigente_hasta: string | null }
export const estadoRestablecimiento = (id: string) => api<EstadoRestablecimiento>(`${pid(id)}/pin/restablecimiento`);
export const autorizarRestablecimiento = (id: string, motivo: string) =>
  api<{ enviado: true; persona_id: string; nombre: string; telefono: string; expira_en: string }>(`${pid(id)}/pin/restablecimiento`, { method: "POST", body: { motivo } });

export type EstadoNotificacion = "pendiente" | "reintentando" | "enviado" | "fallido";
export type CanalNotificacion = "whatsapp" | "correo";
export interface NotificacionStaff {
  notificacion_id: string;
  creado_en: string;
  actualizado_en: string;
  enviado_en: string | null;
  evento: string;
  canal: CanalNotificacion;
  estado: EstadoNotificacion;
  intentos: number;
  ultimo_error: string | null;
  remitente: string | null;
  destinatario: { persona_id: string; nombre: string; apellido_paterno: string | null; telefono: string | null; correo: string | null };
  negocio: { negocio_id: string; nombre_comercial: string } | null;
}
export interface FiltrosNotificaciones {
  estado?: EstadoNotificacion;
  canal?: CanalNotificacion;
  evento?: string;
  negocio_id?: string;
  persona_id?: string;
  desde?: string;
  hasta?: string;
  limite?: number;
  antes_de?: string;
  antes_id?: string;
}
export interface RespuestaNotificaciones {
  notificaciones: NotificacionStaff[];
  siguiente: Cursor;
  resumen_24h: Record<EstadoNotificacion, number> | null;
}
export const notificaciones = (filtros: FiltrosNotificaciones = {}) =>
  api<RespuestaNotificaciones>(`/api/staff/notificaciones${query({ limite: 50, ...filtros })}`);

export interface PrecioMembresia {
  precio_mensual_centavos: number;
  moneda: string;
  motivo: string;
  factor: "totp" | "pin";
  desde: string;
  staff: { persona_id: string; nombre: string };
}
export interface RespuestaPrecio { vigente: PrecioMembresia | null; historial: PrecioMembresia[] }
export type CuerpoPrecioMembresia = { precio_mensual_centavos: number; motivo: string } &
  ({ codigo_totp: string; pin?: never } | { pin: string; codigo_totp?: never });
export const precioMembresia = () => api<RespuestaPrecio>("/api/staff/membresia/precio");
export const fijarPrecioMembresia = (body: CuerpoPrecioMembresia) =>
  api<{ cambiado: boolean; vigente: PrecioMembresia; anterior: PrecioMembresia | null }>("/api/staff/membresia/precio", { method: "PUT", body });
