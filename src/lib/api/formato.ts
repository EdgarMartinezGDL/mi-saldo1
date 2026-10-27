/** Display helpers for backend values (centavos, business dates, UTC instants). */
export const pesos = (centavos: number | null | undefined, moneda = "MXN") =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda }).format((centavos ?? 0) / 100);

/** "250.50" typed by the cashier → 25050. Returns 0 for empty/invalid input. */
export const aCentavos = (texto: string) => {
  const n = Number(texto.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
};

/** AAAA-MM-DD (business day) → "29 dic 2026". */
export const fechaCorta = (f: string | null | undefined) => {
  if (!f) return "";
  const [y, m, d] = f.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)),
  );
};

/** ISO instant → "22 oct 2026" in the business time zone. */
export const diaDeInstante = (iso: string | null | undefined, zona = "America/Mexico_City") =>
  iso ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeZone: zona }).format(new Date(iso)) : "";

/** ISO instant → local business time. */
export const instante = (iso: string | null | undefined, zona = "America/Mexico_City") =>
  iso
    ? new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: zona }).format(new Date(iso))
    : "";

export interface Caducidad {
  fecha_vencimiento: string | null;
  dias_para_vencer: number | null;
  vence_pronto: boolean;
  vencido: boolean;
}

export const textoCaducidad = (c: Partial<Caducidad>) => {
  if (c.vencido) return `Venció el ${fechaCorta(c.fecha_vencimiento)}`;
  if (!c.fecha_vencimiento) return "No vence";
  if (c.dias_para_vencer === 0) return "Vence hoy";
  return `Vence el ${fechaCorta(c.fecha_vencimiento)}`;
};

/** Mexican 10-digit input → "55 1234 5678"; other E.164 shown as-is. */
export const telefonoVisible = (tel: string | null | undefined) => {
  if (!tel) return "Sin teléfono";
  const d = tel.startsWith("+52") ? tel.slice(3) : null;
  if (d && d.length === 10) return `${d.slice(0, 2)} ${d.slice(2, 6)} ${d.slice(6)}`;
  return tel;
};

export const nombreCompleto = (p: { nombre: string; apellido_paterno?: string | null; apellido_materno?: string | null }) =>
  [p.nombre, p.apellido_paterno, p.apellido_materno].filter(Boolean).join(" ");

export const query = (params: Record<string, string | number | boolean | null | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};
