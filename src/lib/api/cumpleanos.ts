import { api } from "./client";

/** Claude (2026-11-20): beneficio de cumpleaños (backend 0061, docs/api/cumpleanos.md del repo misaldo). */
export type VigenciaCumpleanos = "dia" | "semana" | "mes";
export interface ConfiguracionCumpleanos { activo: boolean; beneficio: string | null; vigencia: VigenciaCumpleanos; version: number }

/** Viene en la búsqueda de caja cuando hoy aplica (o ya se entregó). */
export type CumpleanosCaja = { negocio_cliente_id: string; cumpleanos_dia: number; cumpleanos_mes: number } & (
  | { estado: "disponible"; beneficio: string; vigencia: VigenciaCumpleanos }
  | { estado: "entregado"; beneficio: string; entrega_id: string; entregado_en: string; entregado_por: string; anulable_hoy: boolean }
  | { estado: "no_disponible" }
);

export const configuracionCumpleanos = () => api<ConfiguracionCumpleanos>("/api/cumpleanos/configuracion");
export const guardarConfiguracionCumpleanos = (body: { activo: boolean; beneficio: string; vigencia: VigenciaCumpleanos }) =>
  api<ConfiguracionCumpleanos>("/api/cumpleanos/configuracion", { method: "PUT", body });
export const entregarCumpleanos = (negocio_cliente_id: string) =>
  api<{ entrega_id: string; beneficio: string }>("/api/cumpleanos/entregas", { method: "POST", body: { negocio_cliente_id } });
export const anularCumpleanos = (entregaId: string, motivo: string) =>
  api<{ anulada: true }>(`/api/cumpleanos/entregas/${encodeURIComponent(entregaId)}/anulacion`, { method: "POST", body: { motivo } });

export const VIGENCIAS: { valor: VigenciaCumpleanos; nombre: string; ayuda: string }[] = [
  { valor: "dia", nombre: "Solo el día", ayuda: "Únicamente el día de su cumpleaños." },
  { valor: "semana", nombre: "La semana", ayuda: "3 días antes y 3 días después de su cumpleaños." },
  { valor: "mes", nombre: "Todo el mes", ayuda: "Cualquier día del mes de su cumpleaños." },
];

export const fechaCumple = (dia: number, mes: number) =>
  `${dia} de ${new Date(2000, mes - 1, 1).toLocaleString("es-MX", { month: "long" })}`;
