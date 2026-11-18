const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Business id from a push notice (?negocio=<uuid>), lowercased; anything else is null. */
export function leerNegocioAviso(search: string): string | null {
  const valores = new URLSearchParams(search).getAll("negocio");
  if (valores.length !== 1) return null;
  const v = valores[0] ?? "";
  return UUID.test(v) ? v.toLowerCase() : null;
}

/** Same location without the negocio parameter. */
export function quitarNegocioAviso(pathname: string, search: string, hash: string): string {
  const p = new URLSearchParams(search);
  p.delete("negocio");
  const q = p.toString();
  return pathname + (q ? `?${q}` : "") + hash;
}
