/** Business calendar dates, displayed without converting them to the device timezone. */
export const fechaTarjeta = (fecha: string) => {
  const [ano, mes, dia] = fecha.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
};

export function vencimientoRenovado(dias: number, zona: string, ahora = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: zona, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(ahora);
  const parte = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  const fecha = new Date(`${parte("year")}-${parte("month")}-${parte("day")}T12:00:00Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fechaTarjeta(fecha.toISOString());
}