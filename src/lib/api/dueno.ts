import { api } from "./client";
import { query } from "./formato";
import type { ClienteCaja, ConfiguracionCaja } from "./caja";

export interface Dashboard {
  periodo: { desde: string; hasta: string; jornadas: number; zona_horaria: string; en_curso: boolean };
  monedero: {
    ventas: { monto_compra_centavos: number; operaciones: number };
    cashback_otorgado_centavos: number;
    canjes: { monto_centavos: number; operaciones: number };
  } | null;
  tarjetas: {
    ventas: { monto_compra_centavos: number; operaciones: number };
    sellos_otorgados: number;
    tarjetas_completadas: number;
    premios_canjeados: number;
  } | null;
  clientes: { atendidos: number; altas: number; bajas: number; activos_total: number; archivados_total: number };
  cajeros: Array<{
    persona_id: string;
    nombre: string;
    apellido_paterno: string | null;
    rol: "dueno" | "empleado";
    monedero: { acumulaciones: number; ventas_centavos: number; cashback_centavos: number; canjes: number; canjes_centavos: number };
    tarjetas: { acumulaciones: number; ventas_centavos: number; sellos_otorgados: number; premios_canjeados: number };
  }>;
  serie: Array<{ fecha: string; monedero_ventas_centavos?: number; sellos_otorgados?: number; clientes_atendidos: number }>;
  reclamaciones: { pendientes: number; mas_antigua_en: string | null };
  validaciones_alta: { pendientes: number };
  nota_ventas: string;
}

export interface Membresia {
  estado: "prueba" | "activa" | "gracia" | "vencida" | "suspendida";
  fecha_vencimiento: string;
  bloqueo_desde: string;
  dias_para_vencer: number;
  aviso_pago_pendiente: boolean;
  fecha_inicio: string;
  movimientos: MovimientoMembresia[];
}

export interface MovimientoMembresia {
  tipo: "extension_manual" | "prueba_gratuita" | "pago_automatico";
  meses_agregados: number | null;
  dias_agregados: number | null;
  monto_centavos: number | null;
  fecha_vencimiento_anterior: string | null;
  fecha_vencimiento_nueva: string;
  creado_en: string;
}

export interface ClienteLista {
  archivado: boolean;
  archivado_en: string | null;
  negocio_cliente_id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  telefono: string | null;
  cuenta_activada: boolean;
  cliente_desde: string;
  ultima_compra_en: string | null;
  saldo_centavos: number | null;
  premios_por_canjear: number | null;
}
export type Siguiente = { antes_de: string; antes_id: string } | null;

export type FichaCliente = ClienteCaja & {
  cliente: ClienteCaja["cliente"] & { telefono: string | null };
  resumen: {
    archivado: boolean;
    archivado_en: string | null;
    ultima_actividad_en: string | null;
    cliente_desde: string;
    ultima_compra_en: string | null;
    acepta_promociones: boolean;
    reclamaciones_pendientes: number;
  };
};

export interface Empleado {
  negocio_empleado_id: string;
  persona_id: string;
  telefono: string | null;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  activo: boolean;
  cuenta_activada: boolean;
  invitacion_vence_en: string | null;
  creado_en: string;
  dado_de_baja_en: string | null;
}

export const dashboard = (p: { fecha?: string; desde?: string; hasta?: string } = {}) =>
  api<Dashboard>(`/api/dashboard${query(p)}`);
export const membresia = () => api<Membresia>("/api/negocio/membresia");

export type EstadoModuloAsistente = "configurado" | "pendiente" | "en_retiro" | "no_contratado";
export type PasoAsistente =
  | { paso: "datos"; obligatorio: false; completo: true; tiene_logo: boolean; tema_id: 1 | 2 | 3 }
  | { paso: "horarios"; obligatorio: true; completo: boolean }
  | { paso: "modulos"; obligatorio: true; completo: boolean; monedero: EstadoModuloAsistente; tarjetas_sellos: EstadoModuloAsistente }
  | { paso: "pin_pos"; obligatorio: true; completo: boolean }
  | { paso: "empleados"; obligatorio: false; completo: boolean; empleados_activos: number }
  | { paso: "referidos"; obligatorio: false; completo: boolean; disponible: boolean };
export interface Asistente {
  configuracion_completa: boolean;
  pendientes_obligatorios: Array<"horarios" | "modulos" | "pin_pos">;
  asistente_cerrado_en: string | null;
  mostrar_asistente: boolean;
  pasos: PasoAsistente[];
}
export const asistente = () => api<Asistente>("/api/negocio/asistente");
export const cerrarAsistente = () => api<Asistente>("/api/negocio/asistente/cierre", { method: "POST" });

export const consultarClientes = (body: { busqueda?: string | undefined; estado?: "activada" | "sin_activar"; archivados?: "excluir" | "incluir" | "solo"; limite?: number } & Partial<NonNullable<Siguiente>>) =>
  api<{ total: number; clientes: ClienteLista[]; siguiente: Siguiente }>("/api/negocio/clientes/consulta", { method: "POST", body });
export const fichaCliente = (negocio_cliente_id: string) =>
  api<FichaCliente>("/api/negocio/clientes/ficha", { method: "POST", body: { negocio_cliente_id } });

export const empleados = () => api<Empleado[]>("/api/empleados");
export const altaEmpleado = (body: { telefono: string; nombre: string; apellido_paterno: string | null; apellido_materno: string | null }) =>
  api<{ resultado?: "ok" | "reactivado"; invitacion_vence_en?: string | null; validacion_id?: string; estado?: "pendiente" }>(
    "/api/empleados",
    { method: "POST", body },
  );
export const reenviarInvitacion = (id: string) =>
  api<{ invitacion_vence_en: string }>(`/api/empleados/${encodeURIComponent(id)}/invitacion`, { method: "POST" });
export const bajaEmpleado = (id: string) =>
  api<{ dado_de_baja: true; sesiones_revocadas: number }>(`/api/empleados/${encodeURIComponent(id)}`, { method: "DELETE" });

export type NegocioConfig = ConfiguracionCaja["negocio"];
export const actualizarNegocio = (body: { nombre_comercial: string; giro: string | null; logo_url: string | null; tema_id: 1 | 2 | 3 }) =>
  api<NegocioConfig>("/api/negocio", { method: "PUT", body });
export const actualizarMonedero = (body: { factor_cashback: string; vigencia_dias: number | null }) =>
  api<{ factor_cashback: number; vigencia_dias: number | null; advertencias: string[] }>("/api/negocio/monedero", { method: "PUT", body });
export const cambiarPinPos = (pin: string, pin_pos: string) =>
  api<{ pin_pos_actualizado: true; primera_vez: boolean; cajas_cerradas: number }>("/api/pos/pin", {
    method: "PUT",
    body: { pin, pin_pos },
  });
