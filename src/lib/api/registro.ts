import { api } from "./client";

export interface DatosRegistro {
  codigo: string;
  nombre: string;
  telefono: string;
  acepta_aviso_privacidad: true;
  version_aviso: string;
  acepta_promociones: boolean;
}
export interface RegistroSolicitado { token_registro: string; expira_en_seg: number; reenviar_en_seg: number }
export type RegistroVerificado = { estado: "activar"; token_activacion: string } | { estado: "ya_registrado" };
export const negocioRegistro = (codigo: string) => api<{ nombre_comercial: string }>(`/api/registro/negocio/${encodeURIComponent(codigo)}`, { auth: false });
export const solicitarRegistro = (datos: DatosRegistro) => api<RegistroSolicitado>("/api/registro/solicitar", { method: "POST", body: datos, auth: false });
export const verificarRegistro = (token_registro: string, codigo: string) => api<RegistroVerificado>("/api/registro/verificar", { method: "POST", body: { token_registro, codigo }, auth: false });
export const reenviarRegistro = (token_registro: string) => api<{ reenviar_en_seg: number }>("/api/registro/reenviar", { method: "POST", body: { token_registro }, auth: false });
export const miCodigoRegistro = () => api<{ codigo: string }>("/api/registro/mi-codigo");

export function leerCodigoRegistro(hash: string): string | null {
  const codigo = new URLSearchParams(hash.replace(/^#/, "")).get("c");
  return codigo && /^[A-Za-z0-9_-]{6,32}$/.test(codigo) ? codigo : null;
}
