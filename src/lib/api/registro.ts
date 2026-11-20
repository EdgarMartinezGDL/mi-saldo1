import { api } from "./client";

export interface DatosRegistro {
  codigo: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  nacimiento_dia: number;
  nacimiento_mes: number;
  correo: string;
  telefono: string;
  acepta_aviso_privacidad: true;
  version_aviso: string;
}
export type RegistroSolicitado = { estado: "pendiente"; expira_en: string } | { estado: "cuenta_existente" };
export interface Unido { estado: "unido" | "ya_es_cliente"; negocio_id: string; nombre_comercial: string }
/** QR-A12: el código va en el cuerpo, no en la ruta (no queda en los registros de acceso). */
export const negocioRegistro = (codigo: string) => api<{ nombre_comercial: string }>("/api/registro/negocio", { method: "POST", body: { codigo }, auth: false });
export const solicitarRegistro = (datos: DatosRegistro) => {
  const { apellido_materno, ...resto } = datos;
  return api<RegistroSolicitado>("/api/registro/solicitar", { method: "POST", body: { ...resto, ...(apellido_materno?.trim() ? { apellido_materno: apellido_materno.trim() } : {}) }, auth: false });
};
export const unirmeNegocio = (codigo: string, version_aviso: string) => api<Unido>("/api/registro/unirme", { method: "POST", body: { codigo, acepta_aviso_privacidad: true, version_aviso } });
export const nuevoCodigoRegistro = () => api<{ codigo: string }>("/api/registro/mi-codigo/nuevo", { method: "POST" });
export const enlaceRegistro = (origen: string, codigo: string) => `${origen}/registro#c=${encodeURIComponent(codigo)}`;
export const miCodigoRegistro = () => api<{ codigo: string }>("/api/registro/mi-codigo");

export function leerCodigoRegistro(hash: string): string | null {
  const codigo = new URLSearchParams(hash.replace(/^#/, "")).get("c");
  return codigo && /^[A-Za-z0-9_-]{6,32}$/.test(codigo) ? codigo : null;
}
