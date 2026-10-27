import { api, setSesion, type Contexto, type Rol, type Sesion } from "./client";
import { terminarCopia } from "@/lib/sin-conexion-sesion";

export type RespuestaLogin =
  | ({ estado: "autenticado" } & Sesion)
  | { estado: "seleccionar_contexto"; token_seleccion: string; contextos: Contexto[] }
  | { estado: "requiere_totp"; token_totp: string; expira_en_seg: number }
  | { estado: "requiere_enrolamiento_totp"; token_enrolamiento: string; expira_en_seg: number };

function guardar(r: RespuestaLogin) {
  if (r.estado === "autenticado") setSesion(r);
  return r;
}

export const login = (telefono: string, pin: string) =>
  api<RespuestaLogin>("/api/auth/login", { method: "POST", body: { telefono, pin }, auth: false }).then(guardar);

export const elegirContexto = (token_seleccion: string, rol: Rol, negocio_id: string | null) =>
  api<RespuestaLogin>("/api/auth/contexto", {
    method: "POST",
    body: { token_seleccion, rol, negocio_id },
    auth: false,
  }).then(guardar);

export const validarTotp = (token_totp: string, factor: { codigo: string } | { codigo_respaldo: string }) =>
  api<RespuestaLogin>("/api/auth/totp", {
    method: "POST",
    body: { token_totp, ...factor },
    auth: false,
  }).then(guardar);

export interface ContextoDisponible {
  rol: Rol;
  negocio_id: string | null;
  nombre_comercial: string | null;
  actual: boolean;
  requiere_pin: boolean;
  requiere_totp: boolean;
}

/** GET /api/auth/contextos — every context the person can switch to. */
export const contextos = () => api<{ contextos: ContextoDisponible[] }>("/api/auth/contextos");

/** POST /api/auth/cambio-contexto — switches without signing out; the new session replaces the in-memory token. */
export const cambiarContexto = (body: {
  rol: Rol;
  negocio_id: string | null;
  pin?: string;
  codigo_totp?: string;
  codigo_respaldo?: string;
}) =>
  api<Sesion>("/api/auth/cambio-contexto", { method: "POST", body }).then((s) => {
    setSesion(s);
    return s;
  });

export async function logout() {
  terminarCopia();
  try {
    await api<void>("/api/auth/logout", { method: "POST" });
  } finally {
    terminarCopia();
    setSesion(null);
  }
}
