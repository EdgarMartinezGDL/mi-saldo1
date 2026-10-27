/** caja.md §4.2, §6.1, §8.1 and §9.1 calls, built on the shared `api()` client. */
import { api } from "@/lib/api/client";

export interface ConfigReferidos { activo: boolean; disponible?: boolean }
export const configReferidos = () => api<ConfigReferidos>("/api/negocio/referidos/configuracion");

export type AltaRespuesta =
  | { pendiente: false; persona_id: string; negocio_cliente_id: string; persona_nueva: boolean; cuenta_activada: boolean; enlace_activacion_enviado: boolean; correo_capturado?: "guardado" | "conservado_anterior"; referido?: { registrado: boolean; referidor_nombre?: string; motivo?: string } }
  | { pendiente: true; validacion_id: string; estado: "pendiente"; expira_en: string };

export const altaCliente = (body: {
  telefono: string; nombre: string; correo: string; apellido_paterno?: string; apellido_materno?: string;
  nacimiento_dia?: number; nacimiento_mes?: number; referidor_telefono?: string; acepta_aviso_privacidad: true; version_aviso: string;
}) => api<AltaRespuesta>("/api/clientes", { method: "POST", body });

export const documentarReclamacion = (body: {
  telefono: string; modulo: "monedero" | "tarjetas_sellos"; tarjeta_digital_id?: string; cantidad_reclamada: number;
  fecha_compra: string; descripcion: string; referencia_ticket?: string; idempotency_key: string;
}) => api<{ duplicado: boolean; reclamacion: { folio: string; estado: string } }>("/api/reclamaciones", { method: "POST", body });

export interface MovimientoJornada {
  movimiento_id: string;
  fecha: string;
  modulo: "monedero" | "tarjetas_sellos";
  tipo: "acumulacion" | "canje" | "ajuste_manual" | "expiracion" | "vencimiento" | "referido";
  monto_centavos: number | null;
  monto_compra_centavos: number | null;
  cantidad: number | null;
  tarjeta: { nombre: string } | null;
  cliente: { nombre: string; apellido_paterno: string | null; telefono: string | null };
}
export interface MiJornada {
  jornada: { fecha: string; zona_horaria: string };
  totales: {
    monedero: { acumulaciones: number; ventas_centavos: number; cashback_centavos: number; canjes: number; canjes_centavos: number } | null;
    tarjetas: { acumulaciones: number; ventas_centavos: number; sellos_otorgados: number; premios_canjeados: number } | null;
  };
  movimientos: MovimientoJornada[];
  siguiente: { antes_de: string; antes_id: string } | null;
}
export const miJornada = (cursor?: { antes_de: string; antes_id: string }) => {
  const q = new URLSearchParams({ limite: "50", ...(cursor ?? {}) });
  return api<MiJornada>(`/api/historial/mi-jornada?${q}`);
};
