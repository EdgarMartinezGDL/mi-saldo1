/**
 * U-02 (Claude, 2026-11-24): "Abrir en la Caja" desde la ficha de Clientes.
 * El teléfono viaja por sessionStorage (no por la URL, para que no quede en el
 * historial) y la Caja lo toma una sola vez al abrirse.
 */
const CLAVE = "misaldo-caja-abrir";

export function pedirAbrirEnCaja(telefono: string) {
  const diez = telefono.replace(/\D/g, "").slice(-10);
  try { sessionStorage.setItem(CLAVE, diez); } catch { /* sin almacenamiento: la Caja abre en la búsqueda */ }
}

export function tomarAbrirEnCaja(): string | null {
  try {
    const t = sessionStorage.getItem(CLAVE);
    sessionStorage.removeItem(CLAVE);
    return t && /^\d{10}$/.test(t) ? t : null;
  } catch { return null; }
}
