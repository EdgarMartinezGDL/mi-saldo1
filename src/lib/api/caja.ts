import { api } from "./client";

export interface EstadoPos {
  pin_pos_configurado: boolean;
  desbloqueado: boolean;
  vence_en: string | null;
  horario_aplica: boolean;
  en_horario: boolean;
}

export interface ConfiguracionCaja {
  negocio: {
    negocio_id: string;
    nombre_comercial: string;
    logo_url: string | null;
    moneda: string;
    pin_pos_configurado: boolean;
    membresia_estado: "prueba" | "activa" | "gracia" | "vencida" | "suspendida";
    zona_horaria?: string;
  };
  modulos: Array<"monedero" | "tarjetas_sellos">;
  modulos_en_retiro: Array<"monedero" | "tarjetas_sellos">;
  monedero: { factor_cashback: number; vigencia_dias: number | null; actualizado_en: string } | null;
  horarios?: Horario[];
}

export interface ConfiguracionNegocio extends ConfiguracionCaja {
  negocio: ConfiguracionCaja["negocio"] & { giro: string | null; tema_id: 1 | 2 | 3; zona_horaria: string; limite_tarjetas_activas: number };
  tarjetas?: TarjetaConfig[];
  horarios?: Horario[];
}

export interface TarjetaCliente {
  tarjeta_digital_id: string;
  nombre: string;
  tipo_sello: "por_transaccion" | "por_monto";
  premio_texto: string;
  premio_por_canjear: string | null;
  activa: boolean;
  acumula: boolean;
  sellos_requeridos: number;
  sellos_actuales: number;
  remanente_centavos: number;
  fecha_vencimiento: string | null;
  completas_por_canjear: number;
}

export interface ClienteCaja {
  cliente: {
    persona_id: string;
    nombre: string;
    apellido_paterno: string | null;
    cuenta_activada: boolean;
    requiere_codigo_acumulacion: boolean;
    puede_canjear: boolean;
    correo: CorreoClienteCaja;
  };
  monedero?: { saldo_centavos: number; fecha_vencimiento: string | null; acumula: boolean };
  tarjetas?: TarjetaCliente[];
}

export type Busqueda = { encontrado: false } | ({ encontrado: true } & ClienteCaja);

export interface CorreoClienteCaja {
  estado: "confirmado" | "sin_confirmar" | "sin_correo";
  enmascarado: string | null;
}
export const guardarCorreoCliente = (personaId: string, correo: string) =>
  api<{ guardado: boolean; correo: CorreoClienteCaja }>(`/api/clientes/${encodeURIComponent(personaId)}/correo`, { method: "PUT", body: { correo } });

export interface AcumulacionSellos {
  resultado: "ok";
  duplicado: boolean;
  sellos_agregados: number;
  tarjetas_completadas: { cliente_tarjeta_id: string; premio_texto: string }[];
  cliente_sin_app_activada: boolean;
  tarjeta: {
    sellos_actuales: number;
    sellos_requeridos: number;
    remanente_centavos: number;
    fecha_vencimiento: string | null;
  };
}

export const estadoPos = () => api<EstadoPos>("/api/pos/estado");
export const configuracion = () => api<ConfiguracionCaja>("/api/negocio/configuracion");
export const abrirCaja = (pin_pos: string) =>
  api<{ desbloqueado: boolean; vence_en: string }>("/api/pos/desbloqueo", {
    method: "POST",
    body: { pin_pos },
  });
export const cerrarCaja = () => api<void>("/api/pos/bloqueo", { method: "POST" });

export const buscarCliente = (telefono: string) =>
  api<Busqueda>("/api/clientes/busqueda", { method: "POST", body: { telefono } });

export const acumularSellos = (body: {
  telefono: string;
  tarjeta_digital_id: string;
  idempotency_key: string;
  codigo_acumulacion?: string;
  cantidad?: number;
  monto_compra_centavos?: number;
}) => api<AcumulacionSellos>("/api/tarjetas/acumulaciones", { method: "POST", body });

export interface AcumulacionMonedero {
  resultado: "ok";
  duplicado: boolean;
  movimiento_id: string;
  monto_centavos: number;
  saldo_centavos: number;
  fecha_vencimiento: string | null;
  cliente_sin_app_activada: boolean;
}
export const acumularMonedero = (body: {
  telefono: string;
  idempotency_key: string;
  monto_compra_centavos: number;
  codigo_acumulacion?: string;
}) => api<AcumulacionMonedero>("/api/monedero/acumulaciones", { method: "POST", body });

export interface CanjeMonedero {
  resultado: "ok";
  duplicado: boolean;
  movimiento_id: string;
  monto_canjeado_centavos: number;
  saldo_centavos: number;
  fecha_vencimiento: string | null;
}
export const canjearMonedero = (body: {
  telefono: string;
  codigo_canje: string;
  monto_centavos: number;
  idempotency_key: string;
}) => api<CanjeMonedero>("/api/monedero/canjes", { method: "POST", body });

export interface CanjePremio {
  resultado: "ok";
  duplicado: boolean;
  cliente_tarjeta_id: string;
  premio_texto: string;
  tarjetas_completas_restantes: number;
}
export const canjearPremio = (body: {
  telefono: string;
  codigo_canje: string;
  tarjeta_digital_id: string;
  idempotency_key: string;
}) => api<CanjePremio>("/api/tarjetas/canjes", { method: "POST", body });

export interface TarjetaConfig {
  tarjeta_digital_id: string;
  nombre: string;
  tipo_sello: "por_transaccion" | "por_monto";
  sellos_requeridos: number;
  valor_por_sello_centavos: number | null;
  premio_texto: string;
  vigencia_dias: number | null;
  activa: boolean;
  creado_en: string;
}
export interface Horario { dia_semana: number; cerrado: boolean; hora_apertura: string | null; hora_cierre: string | null }
