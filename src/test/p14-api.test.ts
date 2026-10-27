import { describe, expect, it, vi } from "vitest";
import { api } from "@/lib/api/client";
import { asistente, cerrarAsistente } from "@/lib/api/dueno";

vi.mock("@/lib/api/client", () => ({ api: vi.fn().mockResolvedValue({}) }));
describe("P14 contratos", () => {
  it("consulta el estado del servidor", async () => {
    await asistente();
    expect(api).toHaveBeenLastCalledWith("/api/negocio/asistente");
  });
  it("cierra sin cuerpo", async () => {
    await cerrarAsistente();
    expect(api).toHaveBeenLastCalledWith("/api/negocio/asistente/cierre", { method: "POST" });
  });
});