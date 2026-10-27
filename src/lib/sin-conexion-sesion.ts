import { api, type Sesion } from "@/lib/api/client";
import type { Resumen } from "@/lib/api/cliente";
import { actualizarCopia, borrarCopia, comprobarPersona } from "./sin-conexion-storage";

type Identidad = { persona_id: string; nombre: string };
let identidad: Promise<Identidad | null> = Promise.resolve(null);
let generacion = 0;

export function terminarCopia() {
  ++generacion;
  identidad = Promise.resolve(null);
  borrarCopia();
}

/** Reset on every emitted session; identity/profile remain in memory, never in auth payloads. */
export function prepararCopia(sesion: Sesion | null) {
  const actual = ++generacion;
  if (!sesion || sesion.contexto.rol !== "cliente") {
    identidad = Promise.resolve(null);
    if (sesion) borrarCopia();
    return;
  }
  identidad = (async () => {
    const s = await api<{ persona_id: string; rol: string; negocio_id: string | null }>("/api/auth/sesion");
    if (actual !== generacion || s.rol !== "cliente") return null;
    comprobarPersona(s.persona_id);
    const p = await api<{ nombre: string }>("/api/perfil");
    if (actual !== generacion) return null;
    return { persona_id: s.persona_id, nombre: p.nombre };
  })().catch(() => null);
}

export async function guardarCopia(datos: { resumen?: Resumen; codigo?: string | null }) {
  const actual = generacion;
  const persona = await identidad;
  if (persona && actual === generacion) actualizarCopia(persona, datos);
}

/** Bind network results to the session that initiated the request. */
export function escritorCopia() {
  const actual = generacion;
  return (datos: { resumen?: Resumen; codigo?: string | null }) => {
    if (actual === generacion) void guardarCopia(datos);
  };
}