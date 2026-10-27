/** Owner daily operation: history, manual adjustments, claims, sign-up validations, payment details. */
import { api, apiArchivo } from "./client";
import { query } from "./formato";

export type Siguiente = { antes_de: string; antes_id: string } | null;
export type TipoMovimiento = "acumulacion" | "canje" | "ajuste_manual" | "expiracion" | "vencimiento" | "referido";
export type Modulo = "monedero" | "tarjetas_sellos";

export interface PersonaCorta {
  persona_id?: string;
  nombre: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  telefono?: string;
  rol?: string;
}

export interface Movimiento {
  movimiento_id: string;
  fecha: string;
  jornada: string;
  modulo: Modulo;
  tipo: TipoMovimiento;
  monto_centavos?: number;
  monto_compra_centavos?: number;
  saldo_resultante_centavos?: number;
  cantidad?: number;
  tarjeta?: string;
  tarjeta_digital_id?: string;
  motivo?: string;
  origen?: string;
  cliente?: PersonaCorta;
  operador?: PersonaCorta | null;
}

export interface ConsultaHistorial {
  desde: string;
  hasta: string;
  zona_horaria: string;
  siguiente: Siguiente;
  movimientos: Movimiento[];
}

export interface FiltrosHistorial {
  desde?: string;
  hasta?: string;
  operador_persona_id?: string;
  telefono?: string;
  tipo?: TipoMovimiento;
  modulo?: Modulo;
  tarjeta_digital_id?: string;
}

export const consultarHistorial = (body: FiltrosHistorial & { limite?: number; antes_de?: string; antes_id?: string }) =>
  api<ConsultaHistorial>("/api/historial/consulta", { method: "POST", body });

/** Export uses `operador` instead of `operador_persona_id`. */
const cuerpoExportacion = ({ operador_persona_id, ...f }: FiltrosHistorial) => ({ ...f, ...(operador_persona_id ? { operador: operador_persona_id } : {}) });
export const conteoExportacion = (f: FiltrosHistorial) =>
  api<{ conteo: number; tope: number; excede_limite: boolean }>("/api/negocio/exportaciones/historial", { method: "POST", body: cuerpoExportacion(f) });
export const descargarExportacion = (f: FiltrosHistorial) =>
  apiArchivo("/api/negocio/exportaciones/historial/descarga", cuerpoExportacion(f));

export interface ResultadoAjuste {
  resultado: "ok";
  duplicado: boolean;
  ajuste_id: string;
  solicitado: number;
  aplicado: number;
  topado: boolean;
  alerta: boolean;
  motivo: string;
  saldo_anterior_centavos?: number;
  saldo_centavos?: number;
  aviso?: string;
  tarjeta_nombre?: string;
  tarjetas_completadas?: number;
  tarjetas_reabiertas?: number;
  tarjeta?: { sellos_actuales: number; sellos_requeridos: number; fecha_vencimiento: string | null } | null;
}

export const ajusteMonedero = (body: { telefono: string; monto_centavos: number; motivo: string; idempotency_key: string }) =>
  api<ResultadoAjuste>("/api/ajustes/monedero", { method: "POST", body });
export const ajusteSellos = (body: { telefono: string; tarjeta_digital_id: string; cantidad: number; motivo: string; idempotency_key: string }) =>
  api<ResultadoAjuste>("/api/ajustes/sellos", { method: "POST", body });

export interface ConfigAjustes {
  tope_diario_centavos: number | null;
  tope_diario_sellos: number | null;
  umbral_alerta_centavos: number | null;
  umbral_alerta_sellos: number | null;
}
export const configAjustes = () => api<ConfigAjustes>("/api/ajustes/configuracion");
export const guardarConfigAjustes = (body: ConfigAjustes) => api<ConfigAjustes>("/api/ajustes/configuracion", { method: "PUT", body });

export type EstadoReclamacion = "pendiente" | "aprobada" | "rechazada" | "cancelada";
export interface Reclamacion {
  reclamacion_id: string;
  folio: string;
  estado: EstadoReclamacion;
  modulo: Modulo;
  tarjeta: { tarjeta_digital_id: string; nombre: string } | null;
  cantidad_reclamada: number;
  cantidad_aprobada: number | null;
  fecha_compra: string;
  referencia_ticket: string | null;
  descripcion: string;
  resolucion_nota: string | null;
  creado_en: string;
  resuelto_en: string | null;
  ajuste_id: string | null;
  cliente: PersonaCorta;
  creado_por: PersonaCorta | null;
  resuelto_por: PersonaCorta | null;
}

export const reclamaciones = (p: { estado?: "pendiente"; limite?: number; antes_de?: string; antes_id?: string }) =>
  api<{ reclamaciones: Reclamacion[]; siguiente: Siguiente }>(`/api/reclamaciones${query(p)}`);
export const reclamacion = (id: string) =>
  api<{ reclamacion: Reclamacion; historial: ConsultaHistorial }>(`/api/reclamaciones/${encodeURIComponent(id)}`);
export const aprobarReclamacion = (id: string, body: { cantidad?: number; nota?: string }) =>
  api<unknown>(`/api/reclamaciones/${encodeURIComponent(id)}/aprobacion`, { method: "POST", body });
export const rechazarReclamacion = (id: string, nota: string) =>
  api<unknown>(`/api/reclamaciones/${encodeURIComponent(id)}/rechazo`, { method: "POST", body: { nota } });
export const cancelarReclamacion = (id: string, motivo: string) =>
  api<unknown>(`/api/reclamaciones/${encodeURIComponent(id)}/cancelacion`, { method: "POST", body: { motivo } });

export type EstadoValidacion = "pendiente" | "confirmada" | "rechazada" | "vencida" | "cancelada";
export interface Validacion {
  validacion_id: string;
  tipo: "cliente" | "empleado";
  estado: EstadoValidacion;
  resultado: string | null;
  telefono: string;
  nombre_capturado: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null };
  capturado_por: { persona_id: string; nombre: string } | null;
  creado_en: string;
  expira_en: string;
  resuelto_en: string | null;
  motivo_cancelacion: string | null;
}
export const validacionesAlta = (p: { estado?: "pendiente"; limite?: number }) =>
  api<{ validaciones: Validacion[] }>(`/api/validaciones-alta${query(p)}`);
export const cancelarValidacion = (id: string, motivo: string) =>
  api<Validacion>(`/api/validaciones-alta/${encodeURIComponent(id)}/cancelacion`, { method: "POST", body: { motivo } });

export interface DatosPago {
  pasarela: { disponible: boolean; simulado: boolean; metodos: ("tarjeta" | "oxxo")[]; precio_mensual_centavos: number; moneda: string; meses_maximos: number };
  transferencia: { banco: string; clabe: string; beneficiario: string } | null;
  oxxo: { tarjeta: string; titular: string } | null;
  whatsapp: { numero: string; enlace: string } | null;
}
export const datosPago = () => api<DatosPago>("/api/negocio/membresia/pago");
