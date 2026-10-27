/** YYYY-MM-DD in Mexico City at 00:00 → ISO instant (handles DST-free and historic offsets via Intl). */
export function inicioDiaMx(fecha: string) {
  const base = new Date(`${fecha}T00:00:00Z`);
  const parte = new Intl.DateTimeFormat("en-US", { timeZone: "America/Mexico_City", timeZoneName: "longOffset" }).formatToParts(base)
    .find((p) => p.type === "timeZoneName")?.value ?? "GMT-06:00";
  const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(parte);
  const min = m ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : -360;
  return new Date(base.getTime() - min * 60_000).toISOString();
}
export const diaSiguiente = (f: string) => new Date(Date.parse(`${f}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);