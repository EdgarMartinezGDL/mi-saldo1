/** Calls for the Cuenta screen (cliente.md §8–§9, autenticacion.md §6.1 and §7). Kept here so src/lib/api stays untouched. */
import { api } from "@/lib/api/client";

export interface PerfilCompleto {
  nombre?: string;
  apellido_paterno?: string | null;
  apellido_materno?: string | null;
  telefono?: string | null;
  correo?: string | null;
  correo_sin_confirmar?: string | null;
  tiene_2fa?: boolean;
  pin_actualizado_en?: string | null;
}

export const miPerfil = () => api<PerfilCompleto>("/api/perfil");
export const cambiarPin = (pin_actual: string, pin_nuevo: string) =>
  api<{ pin_actualizado: true; sesiones_cerradas: number }>("/api/perfil/pin", { method: "PUT", body: { pin_actual, pin_nuevo } });
export const solicitarCorreo = (pin: string, correo: string) =>
  api<{ correo: string; expira_en: string; expira_en_seg: number }>("/api/perfil/correo/solicitud", { method: "POST", body: { pin, correo } });
export const confirmarCorreo = (codigo: string) =>
  api<{ correo: string }>("/api/perfil/correo/confirmacion", { method: "POST", body: { codigo } });

export const estadoTotp = () => api<{ estado?: "sin_totp" | "pendiente" | "activo"; obligatorio?: boolean }>("/api/auth/totp");
export const activarTotp = (pin: string) =>
  api<{ secreto: string; otpauth_uri: string }>("/api/auth/totp/activacion", { method: "POST", body: { pin } });
export const confirmarActivacionTotp = (codigo: string) =>
  api<{ codigos_respaldo: string[]; sesiones_revocadas: number }>("/api/auth/totp/activacion/confirmacion", { method: "POST", body: { codigo } });
export const desactivarTotp = (pin: string, codigo: string) =>
  api<{ desactivado: true }>("/api/auth/totp/desactivacion", { method: "POST", body: { pin, codigo } });

export const promociones = () => api<{ acepta_promociones?: boolean }>("/api/cliente/promociones");
export const guardarPromociones = (acepta_promociones: boolean) =>
  api<{ acepta_promociones: boolean }>("/api/cliente/promociones", { method: "PUT", body: { acepta_promociones } });

export interface MisCodigos {
  codigo_acumulacion: string | null;
  tiene_codigo_canje: boolean;
  codigo_canje_bloqueado_hasta: string | null;
  codigo_canje_requiere_cambio: boolean;
}

export const consultarCodigos = (pin: string) =>
  api<MisCodigos>("/api/perfil/codigos/consulta", { method: "POST", body: { pin } });

export const cambiarCodigos = (body: { pin: string; codigo_acumulacion?: string; codigo_canje?: string }) =>
  api<{ codigo_acumulacion_actualizado: boolean; codigo_canje_actualizado: boolean; advertencias: string[] }>(
    "/api/perfil/codigos", { method: "PUT", body });

/** Spanish wording for codes these screens add on top of src/lib/api/errors.ts. */
export const MENSAJES_CUENTA: Record<string, string> = {
  pin_incorrecto: "PIN incorrecto",
  codigo_trivial: "Los códigos no pueden ser una secuencia (1234) ni repetir el mismo dígito (1111)",
  pin_debil: "Usa 6 dígitos sin secuencias (123456) ni repetidos (111111).",
  pin_igual: "El PIN nuevo debe ser distinto al actual.",
  requiere_sesion_con_2fa: "Tienes verificación en dos pasos: haz este cambio desde tu sesión de dueño.",
  mismo_correo: "Ese ya es tu correo.",
  codigo_invalido: "El código del correo no es correcto.",
  codigo_agotado: "Ese código ya no sirve. Pide uno nuevo.",
  sin_solicitud: "Primero pide un código nuevo.",
  ya_activo: "La verificación en dos pasos ya está activa.",
  sin_enrolamiento: "Empieza de nuevo la activación.",
  totp_inactivo: "La verificación en dos pasos no está activa.",
  codigo_incorrecto: "Código incorrecto.",
  obligatorio_staff: "Como Staff MiSaldo no puedes desactivarla.",
};
