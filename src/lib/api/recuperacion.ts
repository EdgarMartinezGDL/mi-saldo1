/** Access recovery ("Olvidé mi PIN"), mandatory Staff 2FA enrolment, new backup codes and account deletion (P3). */
import { api, setSesion, type Sesion } from "./client";
import type { RespuestaLogin } from "./auth";
import { terminarCopia } from "@/lib/sin-conexion-sesion";

export type Canal = "whatsapp" | "correo";

export interface Verificacion {
  token_recuperacion: string;
  expira_en_seg: number;
  canales_verificados: Canal[];
  canales_requeridos: number | Canal[];
  puede_restablecer_pin: boolean;
  puede_cambiar_codigo_canje: boolean;
  aviso?: string;
}

export const solicitarRecuperacion = (telefono: string, canal: Canal) =>
  api<{ mensaje: string }>("/api/recuperacion/solicitar", { method: "POST", body: { telefono, canal }, auth: false });

export const verificarRecuperacion = (telefono: string, canal: Canal, codigo: string) =>
  api<Verificacion>("/api/recuperacion/verificar", { method: "POST", body: { telefono, canal, codigo }, auth: false });

export const completarRecuperacion = (body: { token_recuperacion: string; pin: string; codigo_canje?: string }) =>
  api<{
    restablecido: true;
    sesiones_cerradas: number;
    codigo_canje_actualizado: boolean;
    codigo_canje_restringido_hasta: string | null;
    sesion: RespuestaLogin;
  }>("/api/recuperacion/completar", { method: "POST", body, auth: false }).then((r) => {
    if (r.sesion.estado === "autenticado") setSesion(r.sesion);
    return r;
  });

export const iniciarEnrolamiento = (token_enrolamiento: string) =>
  api<{ secreto: string; otpauth_uri: string }>("/api/auth/totp/enrolamiento", { method: "POST", body: { token_enrolamiento }, auth: false });

export const confirmarEnrolamiento = (token_enrolamiento: string, codigo: string) =>
  api<{ codigos_respaldo: string[]; sesion: Sesion }>("/api/auth/totp/enrolamiento/confirmacion", {
    method: "POST",
    body: { token_enrolamiento, codigo },
    auth: false,
  });

export const nuevosCodigosRespaldo = (codigo: string) =>
  api<{ codigos_respaldo: string[] }>("/api/auth/totp/respaldo", { method: "POST", body: { codigo } });

export interface VistaEliminacion {
  puede_eliminarse: boolean;
  otros_roles: ("dueno" | "empleado" | "staff")[];
  negocios: {
    negocio: { negocio_id: string; nombre_comercial: string };
    saldo_centavos: number;
    tarjetas: { tarjeta: string; sellos_en_curso: number; premios_por_canjear: number }[];
    reclamaciones_pendientes: number;
    referidos_pendientes: number;
  }[];
}

export const vistaEliminacion = () => api<VistaEliminacion>("/api/perfil/eliminacion");
export const eliminarCuenta = (pin: string) =>
  api<{ cuenta_eliminada: true }>("/api/perfil/eliminacion", { method: "POST", body: { pin, confirmo: true } }).then((r) => { terminarCopia(); return r; });

export const consultarRestablecimiento = (token: string) =>
  api<{ nombre: string; expira_en: string }>("/api/recuperacion/restablecimiento/consulta", { method: "POST", body: { token }, auth: false });
export const completarRestablecimiento = (token: string, pin: string) =>
  api<{ restablecido: true; sesiones_cerradas: number }>("/api/recuperacion/restablecimiento/completar", { method: "POST", body: { token, pin }, auth: false });
