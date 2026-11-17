/** Nombre público como texto plano, sin controles ni cambios de dirección. */
export function limpiarNombreNegocio(crudo: string | null): string | null {
  if (crudo === null) return null;
  try {
    const nombre = decodeURIComponent(crudo)
      .replace(/[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 150);
    return nombre || null;
  } catch {
    return null;
  }
}

export function enlaceBienvenida(origen: string, nombreComercial: string): string {
  const nombre = limpiarNombreNegocio(nombreComercial) ?? "";
  return `${origen}/bienvenida#n=${encodeURIComponent(nombre)}`;
}