import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ error: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: m.error } }));

import { avisarError } from "@/components/caja/caja-contexto";
import { ApiError } from "@/lib/api/client";

const aviso = () => m.error.mock.calls[0] as [string, { description?: string }];

describe("Claude: errores de la Caja con explicación", () => {
  beforeEach(() => m.error.mockReset());

  it("sin_configuracion: título corto y qué falta (prueba de campo, Nevería sin monedero)", () => {
    avisarError(new ApiError(409, { codigo: "sin_configuracion", message: "El negocio no ha configurado este módulo" }));
    const [titulo, op] = aviso();
    expect(titulo).toBe("Falta configurar");
    expect(op.description).toBe("El dueño debe configurarlo en Negocio antes de usarlo en la Caja.");
  });

  it("un mensaje largo del servidor va completo en la descripción", () => {
    const texto = "El cliente no puede operar en este negocio por ahora";
    avisarError(new ApiError(409, { codigo: "codigo_nuevo_del_servidor", message: texto }));
    const [titulo, op] = aviso();
    expect(titulo).toBe("No se pudo completar");
    expect(op.description).toBe(texto);
  });

  it("un mensaje largo conserva la pista de los intentos", () => {
    const texto = "El cliente no puede operar en este negocio por ahora";
    avisarError(new ApiError(409, { codigo: "codigo_nuevo_del_servidor", message: texto, intentos_restantes: 2 }));
    const [titulo, op] = aviso();
    expect(titulo).toBe("No se pudo completar");
    expect(op.description).toMatch(new RegExp(`^${texto} .+`));
  });

  it("los mensajes cortos quedan como hoy", () => {
    avisarError(new ApiError(422, { codigo: "saldo_insuficiente", message: "x", saldo_centavos: 5000 }));
    const [titulo, op] = aviso();
    expect(titulo).toBe("Saldo insuficiente");
    expect(op.description).toBe("Disponible: $50.00.");
  });
});
