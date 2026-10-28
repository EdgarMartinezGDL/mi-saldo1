import { api } from "./client";
import { query, type Caducidad } from "./formato";
import { escritorCopia, terminarCopia } from "@/lib/sin-conexion-sesion";

export interface FichaNegocio {
  negocio_id: string;
  nombre_comercial: string;
  giro: string | null;
  logo_url: string | null;
  tema_id: 1 | 2 | 3;
  zona_horaria: string;
  direccion: string | null;
  telefono_contacto: string | null;
  telefono_es_whatsapp: boolean;
  horarios: Array<{ dia_semana: number; cerrado: boolean; hora_apertura: string | null; hora_cierre: string | null }>;
  horario_publicado: boolean;
  hoy_dia_semana: number;
  abierto_ahora: boolean | null;
  cierra_a: string | null;
  abre_proximo: { dia_semana: number; hora: string; en_dias: number } | null;
}

export const fichaNegocio = () => api<FichaNegocio>("/api/cliente/negocio");

export interface NegocioCliente {
  negocio_id: string;
  nombre_comercial: string;
  logo_url: string | null;
  tema_id: 1 | 2 | 3;
  zona_horaria: string;
  moneda: string;
  decimales: number;
}

export interface TarjetaResumen {
  tarjeta_digital_id: string;
  nombre: string;
  tipo_sello: "por_transaccion" | "por_monto";
  activa: boolean;
  en_retiro: boolean;
  regla: { sellos_requeridos: number; valor_por_sello_centavos: number | null; premio_texto: string; vigencia_dias: number | null };
  en_curso:
    | ({
        cliente_tarjeta_id: string;
        sellos_actuales: number;
        sellos_requeridos: number;
        faltan: number;
        remanente_centavos: number;
        premio_texto: string;
        fecha_apertura: string;
      } & Caducidad)
    | null;
  premios_por_canjear: Array<{ cliente_tarjeta_id: string; premio_texto: string; fecha_completada: string } & Caducidad>;
}

export interface Resumen {
  negocio: NegocioCliente;
  hoy: string;
  monedero:
    | ({ saldo_centavos: number; factor_cashback: number; vigencia_dias: number | null; en_retiro: boolean } & Caducidad)
    | null;
  tarjetas: TarjetaResumen[] | null;
}

export interface Movimiento {
  movimiento_id: string;
  fecha: string;
  modulo: "monedero" | "tarjetas_sellos";
  tipo: "acumulacion" | "canje" | "ajuste_manual" | "referido" | "expiracion" | "vencimiento";
  monto_centavos?: number;
  saldo_resultante_centavos?: number;
  monto_compra_centavos?: number;
  cantidad?: number;
  tarjeta_digital_id?: string;
  tarjeta?: string;
  motivo?: string;
}

export type Cursor = { antes_de: string; antes_id: string } | null;
export interface PaginaMovimientos {
  movimientos: Movimiento[];
  siguiente: Cursor;
}

type PremioReferido = { modulo: "monedero" | "tarjetas_sellos"; monto_centavos: number | null; sellos: number | null; tarjeta_nombre: string | null };
export type EstadoReferido = "pendiente" | "cumplido" | "cumplido_sin_premio" | "vencido";
export interface MisReferidos {
  programa: { monto_minimo_centavos: number; vigencia_dias: number; premio: PremioReferido } | null;
  me_recomendo: { nombre: string; fecha_registro: string } | null;
  totales: Partial<Record<EstadoReferido, number>>;
  recomendados: Array<{
    referido_id: string;
    nombre: string;
    estado: EstadoReferido;
    fecha_registro: string;
    monto_minimo_centavos: number;
    ultimo_dia: string | null;
    dias_restantes: number | null;
    premio: PremioReferido;
    fecha_cumplimiento: string | null;
    motivo_sin_premio: "tope_mensual" | "modulo_no_disponible" | null;
  }>;
}

export interface VistaBaja {
  negocio: { negocio_id: string; nombre_comercial: string };
  saldo_centavos: number;
  tarjetas: { tarjeta: string; sellos_en_curso: number; premios_por_canjear: number }[];
  reclamaciones_pendientes: number;
  referidos_pendientes: number;
  cuenta_se_elimina: boolean;
}

export interface Perfil {
  aviso_privacidad: { version_aceptada: string | null; aceptado_en: string | null; version_vigente: string; requiere_aceptar: boolean };
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  telefono: string | null;
  correo: string | null;
}

export type EstadoReclamacion = "pendiente" | "aprobada" | "rechazada" | "cancelada";

export interface Reclamacion {
  reclamacion_id: string;
  folio: string;
  estado: EstadoReclamacion;
  modulo: "monedero" | "tarjetas_sellos";
  tarjeta: { tarjeta_digital_id: string; nombre: string } | null;
  cantidad_reclamada: number;
  cantidad_aprobada: number | null;
  fecha_compra: string;
  referencia_ticket: string | null;
  descripcion: string;
  resolucion_nota: string | null;
  creado_en: string;
  resuelto_en: string | null;
}

export const resumen = () => {
  const guardar = escritorCopia();
  return api<Resumen>("/api/cliente/resumen").then((r) => { guardar({ resumen: r }); return r; });
};
export const perfil = () => api<Perfil>("/api/perfil");
export const aceptarAviso = (version: string) => api<{ aceptado: boolean; version: string; aceptado_en: string }>("/api/perfil/aviso-privacidad", { method: "POST", body: { version_aviso: version } });
export const movimientos = (p: { modulo?: "monedero" | "tarjetas_sellos" | undefined; limite?: number; cursor?: Cursor }) =>
  api<PaginaMovimientos>(
    `/api/cliente/movimientos${query({ modulo: p.modulo, limite: p.limite ?? 50, antes_de: p.cursor?.antes_de, antes_id: p.cursor?.antes_id })}`,
  );
export const referidos = () => api<MisReferidos>("/api/cliente/referidos?limite=50");
export const reclamaciones = () => api<{ reclamaciones: Reclamacion[] }>("/api/cliente/reclamaciones?limite=50");
export const vistaBaja = () => api<VistaBaja>("/api/cliente/baja");
export const darmeDeBaja = (pin: string) =>
  api<{ baja: true; cuenta_eliminada: boolean }>("/api/cliente/baja", { method: "POST", body: { pin, confirmo: true } }).then((r) => { terminarCopia(); return r; });
