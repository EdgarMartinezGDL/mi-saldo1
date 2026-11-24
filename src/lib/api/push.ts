import { api } from "./client";

export interface PreferenciasPush { movimientos: boolean; vencimientos: boolean; cumpleanos: boolean }

/** GET /api/push/preferencias — 404 mientras el backend no lo tenga: la sección se oculta. */
export const preferenciasPush = () => api<PreferenciasPush>("/api/push/preferencias");

/** PUT /api/push/preferencias — devuelve las preferencias ya guardadas. */
export const guardarPreferenciasPush = (body: Partial<PreferenciasPush>) =>
  api<PreferenciasPush>("/api/push/preferencias", { method: "PUT", body });

export const llavePublica = () => api<{ llave_publica: string }>("/api/push/llave-publica");

export const registrarSuscripcion = (s: PushSubscriptionJSON, dispositivo: string) =>
  api<{ suscrito: true; id: string }>("/api/push/suscripciones", { method: "POST", body: { ...s, dispositivo } });

export const bajaSuscripcion = (endpoint: string) =>
  api<{ eliminada: boolean }>("/api/push/suscripciones/baja", { method: "POST", body: { endpoint } });

export interface ResumenPromociones {
  destinatarios: number;
  clientes_con_push: number;
  totp_activo: boolean;
  puede_enviar: boolean;
  disponible_desde: string | null;
  limite: { por_dia: number; por_semana: number };
}
export const resumenPromociones = () => api<ResumenPromociones>("/api/push/promociones/resumen");

export interface Promocion {
  id: string;
  titulo: string;
  cuerpo: string;
  ruta: string;
  estado: "enviando" | "enviada";
  destinatarios: number;
  enviados: number;
  fallidos: number;
  creado_en: string;
  terminada_en: string | null;
  /** 0069: último día (del negocio) en que los clientes la ven en Inicio. */
  vigente_hasta: string;
}
export const historialPromociones = () => api<{ promociones: Promocion[] }>("/api/push/promociones");

export const enviarPromocion = (body: { titulo: string; cuerpo: string; ruta: string; codigo: string; vigente_hasta: string }) =>
  api<{ promocion_id: string; destinatarios: number; vigente_hasta: string }>("/api/push/promociones", { method: "POST", body });

/** P47 (0069): promociones vigentes de los negocios donde la persona es cliente (cliente.md §8.1). */
export interface PromocionVigente {
  promocion_id: string;
  negocio_id: string;
  negocio: string;
  titulo: string;
  cuerpo: string;
  ruta: string;
  /** "AAAA-MM-DD": último día en que se ve. */
  vigente_hasta: string;
  enviada_en: string;
}
export const promocionesVigentes = () =>
  api<{ promociones: PromocionVigente[] }>("/api/cliente/promociones/vigentes");
