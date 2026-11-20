/**
 * QR-A8 (comité, 2026-11-20): el teléfono que se pasa de una pantalla a otra
 * (registro o login → login u "Olvidé mi PIN") viaja en sessionStorage y no en
 * la URL, para que no quede en el historial del navegador ni en registros.
 * Se lee una vez y se borra.
 */
const CLAVE = "misaldo.telefono-prellenado";

export function guardarTelefonoPrellenado(telefono: string) {
  const digitos = telefono.replace(/\D/g, "");
  try {
    if (/^\d{10}$/.test(digitos)) sessionStorage.setItem(CLAVE, digitos);
    else sessionStorage.removeItem(CLAVE);
  } catch {
    /* Optional device storage. */
  }
}

export function leerTelefonoPrellenado(): string {
  try {
    const v = typeof window === "undefined" ? null : sessionStorage.getItem(CLAVE);
    return v && /^\d{10}$/.test(v) ? v : "";
  } catch {
    return "";
  }
}

export function olvidarTelefonoPrellenado() {
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* Optional device storage. */
  }
}
