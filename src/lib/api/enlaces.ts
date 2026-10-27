import { api, setSesion } from "./client";
import type { RespuestaLogin } from "./auth";

/** Treat an embedded `sesion` exactly like the login response. */
function guardar<T extends { sesion?: RespuestaLogin }>(r: T) {
  if (r.sesion?.estado === "autenticado") setSesion(r.sesion);
  return r;
}

// ---- Activación de cliente ----
export const verificarEnlaceActivacion = (token: string) =>
  api<{ token_activacion: string; expira_en_seg: number }>("/api/activacion/verificar-enlace", {
    method: "POST",
    body: { token },
    auth: false,
  });

export type DatosActivacion = {
  token_activacion: string;
  pin: string;
  codigo_acumulacion: string;
  codigo_canje: string;
  correo: string | null;
  acepta_aviso_privacidad: true;
  version_aviso: string;
};

export const completarActivacion = (datos: DatosActivacion) =>
  api<{ activada: true; advertencias: string[]; sesion: RespuestaLogin }>("/api/activacion/completar", {
    method: "POST",
    body: datos,
    auth: false,
  }).then(guardar);

export const solicitarCodigoActivacion = (telefono: string) =>
  api<unknown>("/api/activacion/solicitar", { method: "POST", body: { telefono }, auth: false });

export const verificarCodigoActivacion = (telefono: string, codigo: string) =>
  api<{ token_activacion: string; expira_en_seg?: number }>("/api/activacion/verificar-codigo", {
    method: "POST",
    body: { telefono, codigo },
    auth: false,
  });

// ---- Invitación (empleado, dueño, Staff) ----
export const verificarInvitacion = (token: string) =>
  api<{ token_invitacion: string; expira_en_seg: number; nombre: string; negocio: string }>(
    "/api/invitacion/verificar",
    { method: "POST", body: { token }, auth: false },
  );

export const completarInvitacion = (datos: {
  token_invitacion: string;
  pin: string;
  correo: string;
  acepta_aviso_privacidad: true;
  version_aviso: string;
}) =>
  api<{ activada: true; sesion: RespuestaLogin }>("/api/invitacion/completar", {
    method: "POST",
    body: datos,
    auth: false,
  }).then(guardar);

// ---- Validaciones de alta ----
export type EstadoValidacion = "pendiente" | "confirmada" | "rechazada" | "vencida" | "cancelada";
export interface Validacion {
  validacion_id: string;
  tipo: "cliente" | "empleado";
  estado: EstadoValidacion;
  negocio: { negocio_id: string; nombre_comercial: string };
  nombre_capturado: { nombre: string; apellido_paterno: string | null; apellido_materno: string | null };
  creado_en: string;
  expira_en: string;
  resuelto_en: string | null;
}
export type ResultadoValidacion = { estado: "confirmada" | "rechazada"; tipo: "cliente" | "empleado"; rol?: unknown };

export const consultarValidacionEnlace = (token: string) =>
  api<Validacion>("/api/validaciones-alta/enlace", { method: "POST", body: { token }, auth: false });
export const confirmarValidacionEnlace = (token: string) =>
  api<ResultadoValidacion>("/api/validaciones-alta/enlace/confirmacion", { method: "POST", body: { token }, auth: false });
export const rechazarValidacionEnlace = (token: string) =>
  api<ResultadoValidacion>("/api/validaciones-alta/enlace/rechazo", { method: "POST", body: { token }, auth: false });

export const misValidaciones = () => api<{ validaciones: Validacion[] }>("/api/mis-validaciones");
export const confirmarMiValidacion = (id: string, pin: string) =>
  api<ResultadoValidacion>(`/api/mis-validaciones/${encodeURIComponent(id)}/confirmacion`, {
    method: "POST",
    body: { pin },
  });
export const rechazarMiValidacion = (id: string) =>
  api<ResultadoValidacion>(`/api/mis-validaciones/${encodeURIComponent(id)}/rechazo`, { method: "POST" });

// ---- Texto compartido ----
export const nombreCompleto = (n: Validacion["nombre_capturado"]) =>
  [n.nombre, n.apellido_paterno, n.apellido_materno].filter(Boolean).join(" ");

export const textoSolicitud = (v: Validacion) =>
  `${v.negocio.nombre_comercial} quiere registrarte como ${v.tipo} con el nombre ${nombreCompleto(v.nombre_capturado)}`;

export const textoResultado = (r: ResultadoValidacion, negocio: string) =>
  r.estado === "rechazada"
    ? "Gracias, avisamos al equipo de MiSaldo. No se creó nada."
    : r.tipo === "cliente"
      ? `Listo, ya eres cliente de ${negocio}.`
      : "Te llegará una invitación por WhatsApp para crear tu PIN.";

export const textoEstado: Record<EstadoValidacion, string> = {
  pendiente: "Pendiente",
  confirmada: "Ya respondiste: confirmaste que eres tú.",
  rechazada: "Ya respondiste: dijiste que no eres tú.",
  vencida: "Esta solicitud venció.",
  cancelada: "El negocio la canceló.",
};

