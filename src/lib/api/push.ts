import { api } from "./client";

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
}
export const historialPromociones = () => api<{ promociones: Promocion[] }>("/api/push/promociones");

export const enviarPromocion = (body: { titulo: string; cuerpo: string; ruta: string; codigo: string }) =>
  api<{ promocion_id: string; destinatarios: number }>("/api/push/promociones", { method: "POST", body });
