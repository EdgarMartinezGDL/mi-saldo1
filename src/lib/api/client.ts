/**
 * HTTP client for the MiSaldo backend.
 * - Relative /api/* paths only (Caddy proxies them).
 * - Access token lives ONLY in memory; the refresh token is an HttpOnly cookie
 *   the browser sends by itself (credentials: "include").
 * - On a 401 it refreshes once (shared promise) and retries the request.
 */
import { mensajeDeError } from "./errors";

export type Rol = "cliente" | "empleado" | "dueno" | "staff";

export interface Contexto {
  rol: Rol;
  negocio_id: string | null;
  nombre_comercial: string | null;
}

export interface Sesion {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  sesion_expira_en: string;
  contexto: Contexto;
}

export class ApiError extends Error {
  status: number;
  codigo: string | undefined;
  extras: Record<string, unknown>;
  retryAfter: number | undefined;
  constructor(status: number, body: Record<string, unknown>, retryAfter?: number) {
    const codigo = typeof body["codigo"] === "string" ? body["codigo"] : undefined;
    super(mensajeDeError(status, codigo, body["message"], retryAfter));
    this.status = status;
    this.codigo = codigo;
    this.extras = body;
    this.retryAfter = retryAfter;
  }
}

let accessToken: string | null = null;
let sessionListener: ((s: Sesion | null) => void) | null = null;
let refreshing: Promise<Sesion | null> | null = null;
let connectionListener: (() => void) | null = null;
export function onSinConexion(fn: () => void) { connectionListener = fn; }

export function setSesion(s: Sesion | null) {
  accessToken = s?.access_token ?? null;
  sessionListener?.(s);
}
export function onSesion(fn: (s: Sesion | null) => void) {
  sessionListener = fn;
}

async function rawFetch(path: string, init: RequestInit, auth: boolean) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (auth && accessToken) headers.set("Authorization", `Bearer ${accessToken}`);
  return fetch(path, { ...init, headers, credentials: "include" });
}

async function parse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const contentType = res.headers.get("content-type") ?? "";
  let body: Record<string, unknown> = {};

  if (text && !contentType.includes("application/json")) {
    throw new ApiError(502, { codigo: "respuesta_invalida" });
  }

  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError(502, { codigo: "respuesta_invalida" });
  }
  if (!res.ok) {
    const ra = Number(res.headers.get("Retry-After"));
    throw new ApiError(res.status, body, Number.isFinite(ra) && ra > 0 ? ra : undefined);
  }
  return body as T;
}

/** POST /api/auth/refrescar — shared between simultaneous callers. */
export function refrescar(): Promise<Sesion | null> {
  if (!refreshing) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      connectionListener?.();
      return Promise.reject(new ApiError(0, { codigo: "sin_conexion" }));
    }
    refreshing = rawFetch("/api/auth/refrescar", { method: "POST" }, false)
      .then(async (res) => {
        if (!res.ok) return null;
        return (await res.json()) as Sesion;
      })
      .catch(() => {
        connectionListener?.();
        throw new ApiError(0, { codigo: "sin_conexion" });
      })
      .then((s) => {
        setSesion(s);
        return s;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

type Options = { method?: string; body?: unknown; auth?: boolean };

export async function api<T>(path: string, { method = "GET", body, auth = true }: Options = {}) {
  if (!path.startsWith("/api/")) throw new Error("Las rutas deben empezar con /api/");

  if (import.meta.env.DEV && accessToken === "solo-desarrollo") {
    const hoy = new Date().toISOString().slice(0, 10);
    const dias = Array.from({ length: 7 }, (_, index) => {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - (6 - index));
      return fecha.toISOString().slice(0, 10);
    });
    const respuestas: Record<string, unknown> = {
      "/api/dashboard": {
        periodo: { desde: hoy, hasta: hoy, jornadas: 1, zona_horaria: "America/Mexico_City", en_curso: true },
        monedero: { ventas: { monto_compra_centavos: 482000, operaciones: 42 }, cashback_otorgado_centavos: 24100, canjes: { monto_centavos: 18500, operaciones: 5 } },
        tarjetas: { ventas: { monto_compra_centavos: 316000, operaciones: 31 }, sellos_otorgados: 64, tarjetas_completadas: 7, premios_canjeados: 4 },
        clientes: { atendidos: 37, altas: 5, bajas: 0, activos_total: 486 },
        cajeros: [
          { persona_id: "demo-1", nombre: "Mariana", apellido_paterno: "López", rol: "empleado", monedero: { acumulaciones: 18, ventas_centavos: 246000, cashback_centavos: 12300, canjes: 3, canjes_centavos: 9500 }, tarjetas: { acumulaciones: 14, ventas_centavos: 148000, sellos_otorgados: 31, premios_canjeados: 2 } },
          { persona_id: "demo-2", nombre: "Carlos", apellido_paterno: "Ruiz", rol: "empleado", monedero: { acumulaciones: 12, ventas_centavos: 236000, cashback_centavos: 11800, canjes: 2, canjes_centavos: 9000 }, tarjetas: { acumulaciones: 17, ventas_centavos: 168000, sellos_otorgados: 33, premios_canjeados: 2 } },
        ],
        serie: dias.map((fecha, index) => ({ fecha, monedero_ventas_centavos: [290000, 340000, 260000, 410000, 520000, 610000, 482000][index], sellos_otorgados: [31, 38, 29, 47, 58, 72, 64][index], clientes_atendidos: [24, 27, 21, 32, 40, 49, 37][index] })),
        reclamaciones: { pendientes: 2, mas_antigua_en: new Date().toISOString() },
        validaciones_alta: { pendientes: 1 },
        nota_ventas: "Datos de muestra para revisar el diseño.",
      },
      "/api/mis-validaciones": {
        validaciones: [
          { validacion_id: "val-1", tipo: "cliente", estado: "pendiente", negocio: { negocio_id: "n-2", nombre_comercial: "Farmacia Demo" }, nombre_capturado: { nombre: "Helena", apellido_paterno: "Ramos", apellido_materno: null }, creado_en: new Date().toISOString(), expira_en: new Date(Date.now() + 172_800_000).toISOString(), resuelto_en: null },
          { validacion_id: "val-2", tipo: "empleado", estado: "vencida", negocio: { negocio_id: "n-3", nombre_comercial: "Barbería Demo" }, nombre_capturado: { nombre: "Helena", apellido_paterno: "Ramos", apellido_materno: null }, creado_en: "2026-09-01T12:00:00Z", expira_en: "2026-09-04T12:00:00Z", resuelto_en: null },
        ],
      },
      "/api/negocio/membresia": { estado: "activa", fecha_vencimiento: "2026-12-31", bloqueo_desde: "2027-01-08", dias_para_vencer: 88, aviso_pago_pendiente: false },
      "/api/negocio/configuracion": {
        negocio: { negocio_id: "modo-diseno", nombre_comercial: "Taquería La Cuna", logo_url: null, moneda: "MXN", pin_pos_configurado: true, membresia_estado: "activa", giro: "Restaurante", tema_id: 2, zona_horaria: "America/Mexico_City" },
        modulos: ["monedero", "tarjetas_sellos"], modulos_en_retiro: [],
        monedero: { factor_cashback: 0.05, vigencia_dias: 90, actualizado_en: new Date().toISOString() },
      },
      "/api/empleados": [
        { negocio_empleado_id: "emp-1", persona_id: "persona-1", telefono: "+525512345678", nombre: "Mariana", apellido_paterno: "López", apellido_materno: null, activo: true, cuenta_activada: true, invitacion_vence_en: null, creado_en: "2026-01-15T12:00:00Z", dado_de_baja_en: null },
        { negocio_empleado_id: "emp-2", persona_id: "persona-2", telefono: "+525587654321", nombre: "Carlos", apellido_paterno: "Ruiz", apellido_materno: null, activo: true, cuenta_activada: false, invitacion_vence_en: "2026-10-06T18:00:00Z", creado_en: "2026-10-03T18:00:00Z", dado_de_baja_en: null },
      ],
      "/api/negocio/clientes/consulta": {
        total: 3,
        clientes: [
          { negocio_cliente_id: "cli-1", nombre: "Rosa", apellido_paterno: "Martínez", apellido_materno: null, telefono: "+525512345678", cuenta_activada: true, cliente_desde: "2026-01-10T10:00:00Z", ultima_compra_en: "2026-10-03T19:20:00Z", saldo_centavos: 12850, premios_por_canjear: 1 },
          { negocio_cliente_id: "cli-2", nombre: "Luis", apellido_paterno: "Pérez", apellido_materno: null, telefono: "+525588710091", cuenta_activada: true, cliente_desde: "2026-03-22T10:00:00Z", ultima_compra_en: "2026-10-02T17:10:00Z", saldo_centavos: 8400, premios_por_canjear: 0 },
          { negocio_cliente_id: "cli-3", nombre: "Ana", apellido_paterno: "García", apellido_materno: null, telefono: "+525522107744", cuenta_activada: false, cliente_desde: "2026-09-28T10:00:00Z", ultima_compra_en: null, saldo_centavos: 0, premios_por_canjear: 0 },
        ],
        siguiente: null,
      },
      "/api/negocio/clientes/ficha": {
        cliente: { persona_id: "persona-cliente", nombre: "Rosa", apellido_paterno: "Martínez", telefono: "+525512345678", cuenta_activada: true, requiere_codigo_acumulacion: false, puede_canjear: true },
        monedero: { saldo_centavos: 12850, fecha_vencimiento: "2026-12-31", acumula: true },
        tarjetas: [{ tarjeta_digital_id: "tarjeta-1", nombre: "Cliente frecuente", tipo_sello: "por_transaccion", premio_texto: "Orden de tacos gratis", premio_por_canjear: "Orden de tacos gratis", activa: true, acumula: true, sellos_requeridos: 10, sellos_actuales: 8, remanente_centavos: 0, fecha_vencimiento: "2026-12-31", completas_por_canjear: 1 }],
        resumen: { cliente_desde: "2026-01-10T10:00:00Z", ultima_compra_en: "2026-10-03T19:20:00Z", acepta_promociones: true, reclamaciones_pendientes: 1 },
      },
    };
    const exacta = respuestas[path];
    if (exacta !== undefined) return exacta as T;
    if (path.startsWith("/api/dashboard?")) return respuestas["/api/dashboard"] as T;
    return {} as T;
  }

  const init: RequestInit = body === undefined ? { method } : { method, body: JSON.stringify(body) };
  let res: Response;
  try {
    res = await rawFetch(path, init, auth);
  } catch {
    throw new ApiError(0, { codigo: "sin_conexion" });
  }
  if (res.status === 401 && auth) {
    const nueva = await refrescar();
    if (!nueva) throw new ApiError(401, { codigo: "sesion_expirada" });
    try {
      res = await rawFetch(path, init, auth);
    } catch {
      throw new ApiError(0, { codigo: "sin_conexion" });
    }
    if (res.status === 401) {
      setSesion(null);
      throw new ApiError(401, { codigo: "sesion_expirada" });
    }
  }
  return parse<T>(res);
}

/** Like api() but for file downloads: returns the blob and the filename from Content-Disposition. */
export async function apiArchivo(path: string, body: unknown): Promise<{ blob: Blob; nombre: string }> {
  if (!path.startsWith("/api/")) throw new Error("Las rutas deben empezar con /api/");
  const init: RequestInit = { method: "POST", body: JSON.stringify(body) };
  const pedir = async () => {
    try {
      return await rawFetch(path, init, true);
    } catch {
      throw new ApiError(0, { codigo: "sin_conexion" });
    }
  };
  let res = await pedir();
  if (res.status === 401) {
    const nueva = await refrescar();
    if (!nueva) throw new ApiError(401, { codigo: "sesion_expirada" });
    res = await pedir();
    if (res.status === 401) {
      setSesion(null);
      throw new ApiError(401, { codigo: "sesion_expirada" });
    }
  }
  if (!res.ok) await parse(res);
  const cd = res.headers.get("Content-Disposition") ?? "";
  const m = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(cd);
  const nombre = m ? decodeURIComponent((m[1] ?? m[2] ?? "").trim()) : "historial.xlsx";
  return { blob: await res.blob(), nombre: nombre || "historial.xlsx" };
}

/** Saves a blob through a temporary <a download>. */
export function guardarArchivo({ blob, nombre }: { blob: Blob; nombre: string }) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** E.164 for Mexico from 10 typed digits. */
export const telefonoE164 = (digits: string) => `+52${digits.replace(/\D/g, "")}`;
export const nuevaLlave = () => crypto.randomUUID();
