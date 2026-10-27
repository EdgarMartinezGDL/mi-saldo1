import type { EstadoPos, Horario } from "@/lib/api/caja";
import type { Rol } from "@/lib/api/client";
export const INTERVALO_POS = 60_000;
export const fueraDeHorario = (rol: Rol, estado: EstadoPos) => rol === "empleado" && estado.horario_aplica && estado.en_horario === false;
export function horarioHoy(horarios: Horario[] | undefined, zona: string, ahora = new Date()) {
  const dia = new Intl.DateTimeFormat("en-US", { timeZone: zona, weekday: "short" }).format(ahora);
  const indice = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(dia);
  const h = horarios?.find((x) => x.dia_semana === indice);
  if (!h) return null;
  if (h.cerrado) return "Hoy: cerrado";
  if (!h.hora_apertura || !h.hora_cierre) return null;
  return `Hoy: ${h.hora_apertura.slice(0, 5)} a ${h.hora_cierre.slice(0, 5)}`;
}