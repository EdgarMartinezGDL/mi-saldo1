/** Owner configuration and marketing: stamp cards, cashback simulation, hours, referrals, reports. */
import { api, apiArchivo } from "./client";
import { query } from "./formato";
import type { Horario, TarjetaConfig } from "./caja";

export type CuerpoTarjeta = {
  nombre: string;
  tipo_sello: TarjetaConfig["tipo_sello"];
  sellos_requeridos: number;
  valor_por_sello_centavos: number | null;
  premio_texto: string;
  vigencia_dias: number | null;
};
export const crearTarjeta = (body: CuerpoTarjeta) => api<TarjetaConfig>("/api/negocio/tarjetas", { method: "POST", body });
export const editarTarjeta = (id: string, body: Omit<CuerpoTarjeta, "tipo_sello">) =>
  api<TarjetaConfig>(`/api/negocio/tarjetas/${encodeURIComponent(id)}`, { method: "PUT", body });
export const activarTarjeta = (id: string, activa: boolean) =>
  api<TarjetaConfig>(`/api/negocio/tarjetas/${encodeURIComponent(id)}/activa`, { method: "PUT", body: { activa } });

export interface Simulacion { factor_cashback: number; ejemplos: { monto_compra_centavos: number; monedero_centavos: number }[] }
export const simularMonedero = (body: { factor_cashback?: string; montos_centavos?: number[] }) =>
  api<Simulacion>("/api/negocio/monedero/simulacion", { method: "POST", body });

export const guardarHorarios = (horarios: Horario[]) => api<Horario[]>("/api/negocio/horarios", { method: "PUT", body: { horarios } });

export interface ConfigReferidos {
  activo: boolean;
  disponible: boolean;
  vigencia_dias: number;
  monto_minimo_centavos?: number | null;
  premio_modulo?: "monedero" | "tarjetas_sellos" | null;
  premio_monto_centavos?: number | null;
  premio_sellos_cantidad?: number | null;
  premio_tarjeta_id?: string | null;
  tope_mensual?: number | null;
}
export type CuerpoReferidos = {
  activo: boolean;
  monto_minimo_centavos: number;
  premio_modulo: "monedero" | "tarjetas_sellos";
  tope_mensual: number;
} & ({ premio_monto_centavos: number } | { premio_sellos_cantidad: number; premio_tarjeta_id: string });

export type EstadoReferido = "pendiente" | "cumplido" | "cumplido_sin_premio" | "vencido";
type PersonaRef = { nombre: string; apellido_paterno?: string | null; telefono_sufijo: string };
export interface Referido {
  estado: EstadoReferido;
  referidor: PersonaRef;
  referido: PersonaRef;
  fecha_registro: string;
  vence_en: string;
  fecha_cumplimiento?: string | null;
  compra_monto_centavos?: number | null;
  premio_modulo?: "monedero" | "tarjetas_sellos" | null;
  premio_monto_centavos?: number | null;
  premio_sellos_cantidad?: number | null;
  premio_tarjeta?: string | null;
  motivo_sin_premio?: "tope_mensual" | "modulo_no_disponible" | "referidor_inactivo" | null;
}
export type SiguienteRef = { antes_de: string; antes_id: string } | null;

export const configReferidos = () => api<ConfigReferidos>("/api/negocio/referidos/configuracion");
export const guardarConfigReferidos = (body: CuerpoReferidos) =>
  api<ConfigReferidos>("/api/negocio/referidos/configuracion", { method: "PUT", body });
export const listaReferidos = (p: { estado?: EstadoReferido; limite?: number; antes_de?: string; antes_id?: string }) =>
  api<{ configuracion: ConfigReferidos; totales: Partial<Record<EstadoReferido, number>>; referidos: Referido[]; siguiente: SiguienteRef }>(
    `/api/negocio/referidos${query(p)}`,
  );

export type Reporte = "cumpleaneros" | "inactivos";
export const contarReporte = (r: Reporte, body: { desde: string; hasta: string; incluir_archivados?: boolean }) =>
  api<{ conteo: number; tope: number; excede_limite: boolean }>(`/api/negocio/exportaciones/${r}`, { method: "POST", body });
export const descargarReporte = (r: Reporte, body: { desde: string; hasta: string; texto?: string; incluir_archivados?: boolean }) =>
  apiArchivo(`/api/negocio/exportaciones/${r}/descarga`, body);
