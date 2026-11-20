// Claude: QR-A8 (comité, 2026-11-20). El teléfono entre pantallas viaja en sessionStorage, nunca en la URL.
import { beforeEach, describe, expect, it } from "vitest";
import { guardarTelefonoPrellenado, leerTelefonoPrellenado, olvidarTelefonoPrellenado } from "@/lib/telefono-prellenado";

describe("teléfono prellenado", () => {
  beforeEach(() => sessionStorage.clear());
  it("guarda solo 10 dígitos (quita espacios) y lo borra al olvidarlo", () => {
    guardarTelefonoPrellenado("55 1234 5678");
    expect(leerTelefonoPrellenado()).toBe("5512345678");
    olvidarTelefonoPrellenado();
    expect(leerTelefonoPrellenado()).toBe("");
  });
  it("un valor inválido no se guarda y borra el anterior", () => {
    guardarTelefonoPrellenado("5512345678");
    guardarTelefonoPrellenado("123");
    expect(leerTelefonoPrellenado()).toBe("");
  });
  it("ignora lo que no sean 10 dígitos aunque esté guardado", () => {
    sessionStorage.setItem("misaldo.telefono-prellenado", "<script>");
    expect(leerTelefonoPrellenado()).toBe("");
  });
});
