import { api, ApiError } from "./client";

export type EstadoPago = "creado" | "pendiente" | "aprobado" | "rechazado" | "cancelado" | "en_revision" | "vencido";
export interface PagoMembresia {
  id: string; metodo: "tarjeta" | "oxxo"; meses: number; monto_centavos: number; moneda: string;
  estado: EstadoPago; detalle_estado: string | null; url_pago: string | null;
  datos_pago: { oxxo?: { referencia?: string; vence?: string; url_ficha?: string | null; instrucciones?: string }; tarjeta?: { ultimos4: string; marca: string | null } };
  simulado: boolean; expira_en: string; aprobado_en: string | null; creado_en: string;
}
export interface ConsultaPago {
  pago: PagoMembresia; preferencia_id: string;
  membresia: { estado: string; fecha_vencimiento: string };
}
export interface ResultadoSimulado {
  pago_simulado: { id: string; estado: EstadoPago; detalle: string | null; datos: PagoMembresia["datos_pago"] };
}
const orden = (id: string) => `/api/negocio/membresia/pagos/${encodeURIComponent(id)}`;
export const crearPago = (body: { metodo: "tarjeta" | "oxxo"; meses: number; idempotency_key: string }) => api<{ creada: boolean; pago: PagoMembresia }>("/api/negocio/membresia/pagos", { method: "POST", body });
export const pagoMembresia = (id: string) => api<ConsultaPago>(orden(id));
export const pagosMembresia = () => api<{ pagos: PagoMembresia[] }>("/api/negocio/membresia/pagos");
export const verificarPago = (id: string) => api<ConsultaPago>(`${orden(id)}/verificacion`, { method: "POST" });
export const pagoSimulado = (id: string) => api<{ pago: PagoMembresia; membresia: ConsultaPago["membresia"]; simulador: true }>(`/api/pagos-simulados/${encodeURIComponent(id)}`);
export const pagarSimulado = (id: string, resultado?: "aprobado" | "rechazado") => api<ResultadoSimulado>(`/api/pagos-simulados/${encodeURIComponent(id)}/pago`, { method: "POST", ...(resultado ? { body: { resultado } } : {}) });
export const pagarOxxoSimulado = (id: string) => api<ResultadoSimulado>(`/api/pagos-simulados/${encodeURIComponent(id)}/pago-oxxo`, { method: "POST" });
export const errorPago = (e: unknown) => {
  if (!(e instanceof ApiError)) return "No pudimos consultar el pago. Intenta de nuevo.";
  if (e.status === 429) return "Espera un momento antes de volver a consultar";
  if (e.codigo === "pasarela_no_disponible") return "La pasarela de pago no responde; intenta de nuevo";
  return typeof e.extras["message"] === "string" ? e.extras["message"] : e.message;
};
export const estadosPago: Record<EstadoPago, string> = { aprobado: "Pagado", pendiente: "Pendiente", rechazado: "Rechazado", vencido: "Vencido", cancelado: "Cancelado", en_revision: "En revisión", creado: "Sin pagar" };
export const intervaloPago = (estado: EstadoPago | undefined, inicio: number, ahora: number) => (estado === "creado" || estado === "pendiente") && ahora - inicio < 120_000 ? 3_000 : false;