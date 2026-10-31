import { api, ApiError } from "./client";

export type EstadoPago = "creado" | "pendiente" | "aprobado" | "rechazado" | "cancelado" | "en_revision" | "vencido";
export interface PagoMembresia {
  id: string; proveedor: "stripe" | "mercadopago"; metodo: "tarjeta" | "oxxo"; meses: number; monto_centavos: number; moneda: string;
  estado: EstadoPago; detalle_estado: string | null; url_pago: string | null;
  datos_pago: { oxxo?: { referencia?: string; vence?: string; url_ficha?: string | null; instrucciones?: string }; tarjeta?: { ultimos4: string; marca: string | null } };
  origen: "orden" | "suscripcion"; suscripcion_id: string | null;
  simulado: boolean; prueba: boolean; expira_en: string; aprobado_en: string | null; creado_en: string;
}
export interface ConsultaPago {
  pago: PagoMembresia; preferencia_id: string;
  membresia: { estado: string; fecha_vencimiento: string };
}
export interface ResultadoSimulado {
  pago_simulado: { id: string; estado: EstadoPago; detalle: string | null; datos: PagoMembresia["datos_pago"] };
}
const orden = (id: string) => `/api/negocio/membresia/pagos/${encodeURIComponent(id)}`;
export const crearPago = (body: { proveedor?: "stripe" | "mercadopago"; metodo: "tarjeta" | "oxxo"; meses: number; idempotency_key: string }) =>
  api<{ creada: boolean; pago: PagoMembresia }>("/api/negocio/membresia/pagos", { method: "POST", body });
export const pagoMembresia = (id: string) => api<ConsultaPago>(orden(id));
export const pagosMembresia = () => api<{ pagos: PagoMembresia[] }>("/api/negocio/membresia/pagos");
export const verificarPago = (id: string) => api<ConsultaPago>(`${orden(id)}/verificacion`, { method: "POST" });
export const pagoSimulado = (id: string) => api<{ pago: PagoMembresia; membresia: ConsultaPago["membresia"]; simulador: true }>(`/api/pagos-simulados/${encodeURIComponent(id)}`);
export const pagarSimulado = (id: string, resultado?: "aprobado" | "rechazado") => api<ResultadoSimulado>(`/api/pagos-simulados/${encodeURIComponent(id)}/pago`, { method: "POST", ...(resultado ? { body: { resultado } } : {}) });
export const pagarOxxoSimulado = (id: string) => api<ResultadoSimulado>(`/api/pagos-simulados/${encodeURIComponent(id)}/pago-oxxo`, { method: "POST" });
export type ClaveMetodo = "stripe_tarjeta" | "stripe_domiciliado" | "transferencia" | "oxxo_deposito" | "mercadopago";
export interface MetodoPagoMembresia {
  clave: ClaveMetodo; proveedor: "stripe" | "manual" | "mercadopago"; modalidad: "unico" | "suscripcion";
  nombre: string; estado: "activo" | "proximamente" | "apagado"; disponible: boolean;
}
export interface MetodosMembresia {
  metodos: MetodoPagoMembresia[]; precio_mensual_centavos: number | null; moneda: string | null;
  stripe_prueba: boolean; mercadopago_simulado: boolean;
}
export type EstadoSuscripcion = "creada" | "vencida" | "activa" | "pago_pendiente" | "cancelada" | "duplicada";
export interface SuscripcionMembresia {
  id: string; proveedor: "stripe"; modo: "prueba" | "real"; prueba: boolean; estado: EstadoSuscripcion;
  precio_mensual_centavos: number; moneda: string; primer_cobro: string;
  cancelar_al_final: boolean; periodo_fin: string | null; url_pago: string | null;
  tarjeta: { marca: string | null; ultimos4: string } | null;
  expira_en: string; activada_en: string | null; cancelada_en: string | null; creado_en: string;
}
export interface ConsultaSuscripcion { suscripcion: SuscripcionMembresia | null; cobros: PagoMembresia[] }

const suscripcion = "/api/negocio/membresia/suscripcion";
export const metodosMembresia = () => api<MetodosMembresia>("/api/negocio/membresia/metodos");
export const crearSuscripcion = (idempotency_key: string) =>
  api<{ creada: boolean; suscripcion: SuscripcionMembresia }>(suscripcion, { method: "POST", body: { idempotency_key } });
export const consultarSuscripcion = () => api<ConsultaSuscripcion>(suscripcion);
export const verificarSuscripcion = () => api<ConsultaSuscripcion>(`${suscripcion}/verificacion`, { method: "POST" });
export const cancelarSuscripcion = () =>
  api<{ cambiado: boolean; suscripcion: SuscripcionMembresia }>(`${suscripcion}/cancelacion`, { method: "POST" });
export const reanudarSuscripcion = () =>
  api<{ cambiado: boolean; suscripcion: SuscripcionMembresia }>(`${suscripcion}/reanudacion`, { method: "POST" });
export const intervaloSuscripcion = (estado: EstadoSuscripcion | undefined, inicio: number, ahora: number) =>
  estado === "creada" && ahora - inicio < 60_000 ? 3_000 : false;
export const errorSuscripcion = (e: unknown) => {
  if (!(e instanceof ApiError)) return "No pudimos completar la acción. Intenta de nuevo.";
  if (e.status === 429) return "Espera un momento antes de volver a intentarlo";
  if (e.codigo === "pasarela_no_disponible") return "La pasarela de pago no responde; intenta de nuevo";
  return typeof e.extras["message"] === "string" ? e.extras["message"] : e.message;
};

export const errorPago = (e: unknown) => {
  if (!(e instanceof ApiError)) return "No pudimos consultar el pago. Intenta de nuevo.";
  if (e.status === 429) return "Espera un momento antes de volver a consultar";
  if (e.codigo === "pasarela_no_disponible") return "La pasarela de pago no responde; intenta de nuevo";
  return typeof e.extras["message"] === "string" ? e.extras["message"] : e.message;
};
export const estadosPago: Record<EstadoPago, string> = { aprobado: "Pagado", pendiente: "Pendiente", rechazado: "Rechazado", vencido: "Vencido", cancelado: "Cancelado", en_revision: "En revisión", creado: "Sin pagar" };
export const intervaloPago = (estado: EstadoPago | undefined, inicio: number, ahora: number) => (estado === "creado" || estado === "pendiente") && ahora - inicio < 120_000 ? 3_000 : false;