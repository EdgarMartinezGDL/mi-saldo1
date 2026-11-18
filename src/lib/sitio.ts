import type { Rol } from "@/lib/api/client";

/** Shared hostname rules used by the site guard and worker registration. */
export function esVistaPreviaLovable(hostname: string) {
  return hostname.startsWith("id-preview--") || hostname.startsWith("preview--") ||
    /(^|\.)lovable(project)?\.(app|com)$/.test(hostname) ||
    /(^|\.)lovableproject-dev\.com$/.test(hostname) ||
    /(^|\.)(lovableproject-dev\.com|beta\.lovable\.dev)$/.test(hostname);
}

export type TipoSitio = "admin" | "publico" | "desarrollo";

export function tipoSitio(hostname: string): TipoSitio {
  if (hostname.startsWith("admin.")) return "admin";
  const partes = hostname.split(".");
  const ip = partes.length === 4 && partes.every((p) => /^\d{1,3}$/.test(p) && Number(p) <= 255);
  const privada = ip && (Number(partes[0]) === 10 ||
    (Number(partes[0]) === 172 && Number(partes[1]) >= 16 && Number(partes[1]) <= 31) ||
    (Number(partes[0]) === 192 && Number(partes[1]) === 168));
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname) || privada ||
    hostname.endsWith(".trycloudflare.com") || esVistaPreviaLovable(hostname)) return "desarrollo";
  return "publico";
}

export function rolPermitido(sitio: TipoSitio, rol: Rol): boolean {
  return sitio === "desarrollo" || (sitio === "admin" ? rol === "staff" : rol !== "staff");
}

export const sitioActual = () => tipoSitio(window.location.hostname);