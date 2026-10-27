import type { Resumen } from "@/lib/api/cliente";

export const LLAVE_SIN_CONEXION = "misaldo:sin-conexion:v1";
export interface CopiaSinConexion {
  persona_id: string;
  nombre: string;
  codigo_acumulacion: string | null;
  negocios: Array<{
    negocio_id: string; nombre_comercial: string; saldo_centavos: number | null;
    moneda: string; decimales: number;
    tarjetas: Array<{ nombre: string; sellos_actuales: number; sellos_requeridos: number; premios_por_canjear: number }>;
  }>;
  actualizado_en: string;
}

export function leerCopia(): CopiaSinConexion | null {
  try {
    const crudo: unknown = JSON.parse(localStorage.getItem(LLAVE_SIN_CONEXION) ?? "null");
    if (!crudo || typeof crudo !== "object") return null;
    const c = crudo as CopiaSinConexion;
    if (typeof c.persona_id !== "string" || typeof c.nombre !== "string" ||
      !(c.codigo_acumulacion === null || typeof c.codigo_acumulacion === "string") ||
      typeof c.actualizado_en !== "string" || !Number.isFinite(Date.parse(c.actualizado_en)) || !Array.isArray(c.negocios)) return null;
    if (!c.negocios.every((n) => n && typeof n.negocio_id === "string" && typeof n.nombre_comercial === "string" &&
      (n.saldo_centavos === null || Number.isFinite(n.saldo_centavos)) && typeof n.moneda === "string" &&
      Number.isInteger(n.decimales) && n.decimales >= 0 && n.decimales <= 20 && Array.isArray(n.tarjetas) &&
      n.tarjetas.every((t) => t && typeof t.nombre === "string" && [t.sellos_actuales, t.sellos_requeridos, t.premios_por_canjear].every(Number.isFinite)))) return null;
    return c;
  } catch { return null; }
}

export function borrarCopia() {
  try { localStorage.removeItem(LLAVE_SIN_CONEXION); } catch { /* Storage is optional. */ }
}

export function comprobarPersona(personaId: string) {
  const anterior = leerCopia();
  if (anterior && anterior.persona_id !== personaId) borrarCopia();
}

export function actualizarCopia(persona: { persona_id: string; nombre: string }, datos: { resumen?: Resumen; codigo?: string | null }) {
  comprobarPersona(persona.persona_id);
  const anterior = leerCopia();
  const negocios = [...(anterior?.negocios ?? [])];
  if (datos.resumen) {
    const r = datos.resumen;
    const negocio: CopiaSinConexion["negocios"][number] = {
      negocio_id: r.negocio.negocio_id, nombre_comercial: r.negocio.nombre_comercial,
      saldo_centavos: r.monedero?.saldo_centavos ?? null, moneda: r.negocio.moneda, decimales: r.negocio.decimales,
      tarjetas: (r.tarjetas ?? []).map((t) => ({ nombre: t.nombre, sellos_actuales: t.en_curso?.sellos_actuales ?? 0,
        sellos_requeridos: t.en_curso?.sellos_requeridos ?? t.regla.sellos_requeridos, premios_por_canjear: t.premios_por_canjear.length })),
    };
    const indice = negocios.findIndex((n) => n.negocio_id === negocio.negocio_id);
    if (indice < 0) negocios.push(negocio); else negocios[indice] = negocio;
  }
  const copia: CopiaSinConexion = {
    persona_id: persona.persona_id, nombre: persona.nombre,
    codigo_acumulacion: datos.codigo === undefined ? anterior?.codigo_acumulacion ?? null : datos.codigo,
    negocios, actualizado_en: new Date().toISOString(),
  };
  try { localStorage.setItem(LLAVE_SIN_CONEXION, JSON.stringify(copia)); } catch { /* Storage is optional. */ }
}