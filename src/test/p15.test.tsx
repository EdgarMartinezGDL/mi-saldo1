import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Confirmar, CajaProvider, type CajaCtx } from "@/components/caja/caja-contexto";
import { PasoBuscar } from "@/components/caja/paso-buscar";
import { PinPos } from "@/components/caja/paso-abrir";
import { PasoAcumular, PasoCanjear } from "@/components/caja/paso-operacion";
import { PasoFicha } from "@/components/caja/paso-ficha";
import { PasoComprobante } from "@/components/caja/paso-comprobante";
import { PasoReclamar } from "@/components/caja/paso-reclamar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { CampoDigitos } from "@/components/enlace-ui";
import { useTecla } from "@/components/caja/teclado";
import type { ClienteCaja } from "@/lib/api/caja";
import { useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PasoAlta } from "@/components/caja/paso-alta";
import { NumericKeypad } from "@/components/numeric-keypad";
import { TecladoVisible } from "@/lib/teclado-visible";

const m = vi.hoisted(() => ({ buscar: vi.fn(), abrir: vi.fn(), acumular: vi.fn(), alta: vi.fn(), referidos: vi.fn() }));
vi.mock("@/lib/api/caja", async (o) => ({ ...await o<typeof import("@/lib/api/caja")>(), buscarCliente: m.buscar, abrirCaja: m.abrir, acumularMonedero: m.acumular }));
vi.mock("@/components/caja/caja-extra", async (o) => ({ ...await o<typeof import("@/components/caja/caja-extra")>(), altaCliente: m.alta, configReferidos: m.referidos }));
vi.mock("@tanstack/react-router", async (o) => ({ ...await o<typeof import("@tanstack/react-router")>(), Link: ({ children }: { children: ReactNode }) => <a>{children}</a> }));
const mediaOriginal = window.matchMedia;
function mouse(matches = true) {
  window.matchMedia = vi.fn((query: string) => ({ ...mediaOriginal(query), matches }));
}
const ficha: ClienteCaja = {
  cliente: { persona_id: "diego", nombre: "Diego", apellido_paterno: null, cuenta_activada: true, requiere_codigo_acumulacion: false, puede_canjear: true, correo: { estado: "confirmado", enmascarado: null } },
  monedero: { saldo_centavos: 5000, fecha_vencimiento: null, acumula: true },
};
const ctx: CajaCtx = {
  config: { negocio: { negocio_id: "barberia", nombre_comercial: "Barbería Demo", logo_url: null, moneda: "MXN", pin_pos_configurado: true, membresia_estado: "activa" }, modulos: ["monedero"], modulos_en_retiro: [], monedero: { factor_cashback: .1, vigencia_dias: null, actualizado_en: "2026-10-22" } },
  moneda: "MXN", zona: "America/Mexico_City", rol: "empleado", ejecutar: (fn) => fn(), recargarConfig: () => {},
};
function caja(children: ReactNode) { return render(<CajaProvider valor={ctx}>{children}</CajaProvider>); }
function tecla(key: string, repeat = false) { fireEvent.keyDown(window, { key, repeat }); }
function escribir(valor: string) { for (const key of valor) tecla(key); }
beforeEach(() => {
  vi.clearAllMocks(); mouse();
  m.buscar.mockResolvedValue({ encontrado: true, ...ficha });
  m.abrir.mockResolvedValue({ vence_en: "2026-10-22T08:00:00Z" });
  m.acumular.mockResolvedValue({ monto_centavos: 1500, saldo_centavos: 6500 });
  m.referidos.mockResolvedValue({ activo: false });
  m.alta.mockResolvedValue({ pendiente: false, persona_id: "nuevo" });
});
afterEach(() => { cleanup(); window.matchMedia = mediaOriginal; vi.restoreAllMocks(); });

describe("P15 teclado de Caja", () => {
  it("Borrar conserva size-7 sin la regla que fuerza íconos a size-4", () => {
    render(<NumericKeypad onKey={() => {}} />);
    const borrar = screen.getByRole("button", { name: "Borrar un dígito" });
    expect(borrar.querySelector("svg")).toHaveClass("size-7");
    expect(borrar.className).not.toContain("[&_svg]:size-4");
  });
  it("sin mouse busca diez dígitos con Enter una sola vez y no muestra pistas", async () => {
    mouse(false);
    const encontrado = vi.fn();
    const { container } = caja(<PasoBuscar inicial="" onEncontrado={encontrado} onAlta={() => {}} />);
    escribir("5512345678"); tecla("Enter", true); expect(m.buscar).not.toHaveBeenCalled();
    tecla("Enter"); tecla("Enter");
    await waitFor(() => expect(encontrado).toHaveBeenCalledOnce());
    expect(m.buscar).toHaveBeenCalledExactlyOnceWith("+525512345678");
    expect(container.querySelector("kbd")).toBeNull();
  });
  for (const completo of [true, false]) {
    it(`Enter en aviso marcado ${completo ? "envía una vez el alta completa" : "no envía el alta incompleta"}`, async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      client.setQueryData(["aviso-privacidad"], { version: "2026-10", resumen: "Aviso vigente" });
      caja(<QueryClientProvider client={client}><PasoAlta telefono="5512345678" onVolver={() => {}} onHecha={() => {}} /></QueryClientProvider>);
      fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Diego" } });
      if (completo) fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "diego@ejemplo.mx" } });
      const aviso = screen.getByRole("checkbox", { name: "Acepto el aviso de privacidad" });
      await waitFor(() => expect(aviso).toBeEnabled());
      fireEvent.click(aviso); aviso.focus(); expect(aviso).toHaveAttribute("aria-checked", "true");
      fireEvent.keyDown(aviso, { key: "Enter", repeat: true }); expect(m.alta).not.toHaveBeenCalled();
      fireEvent.keyDown(aviso, { key: "Enter" }); fireEvent.keyDown(aviso, { key: "Enter" });
      if (completo) {
        await waitFor(() => expect(m.alta).toHaveBeenCalledOnce());
        expect(m.alta).toHaveBeenCalledWith(expect.objectContaining({ telefono: "+525512345678", correo: "diego@ejemplo.mx", acepta_aviso_privacidad: true, version_aviso: "2026-10" }));
      } else expect(m.alta).not.toHaveBeenCalled();
      client.clear();
    });
  }
  it("sin mouse Enter del monto salta al código y la confirmación enfoca su acción", () => {
    mouse(false);
    caja(<PasoCanjear telefono="5512345678" ficha={ficha} onVolver={() => {}} onHecho={() => {}} />);
    const monto = screen.getByLabelText("Saldo a usar");
    expect(monto).not.toHaveFocus();
    fireEvent.change(monto, { target: { value: "20" } }); monto.focus();
    fireEvent.keyDown(monto, { key: "Enter" });
    expect(screen.getByRole("button", { name: /Código de canje del cliente/ })).toHaveFocus();
    escribir("1234"); tecla("Enter");
    expect(screen.getByRole("button", { name: "Sí, canjear" })).toHaveFocus();
  });
  it("el foco automático no desplaza y TecladoVisible omite el campo marcado", async () => {
    const foco = vi.spyOn(HTMLElement.prototype, "focus");
    const desplazar = vi.fn();
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollIntoView");
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", { configurable: true, value: desplazar });
    caja(<><TecladoVisible /><PasoAcumular telefono="5512345678" ficha={ficha} onVolver={() => {}} onHecho={() => {}} /></>);
    expect(foco).toHaveBeenCalledWith({ preventScroll: true });
    await new Promise((resolve) => setTimeout(resolve, 300));
    expect(desplazar).not.toHaveBeenCalled();
    if (original) Object.defineProperty(HTMLElement.prototype, "scrollIntoView", original);
    else Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
  });
  it("busca los diez dígitos una vez con Enter e ignora Enter sostenido", async () => {
    const encontrado = vi.fn();
    caja(<PasoBuscar inicial="" onEncontrado={encontrado} onAlta={() => {}} />);
    escribir("5512345678"); tecla("Enter", true); expect(m.buscar).not.toHaveBeenCalled();
    tecla("Enter"); tecla("Enter");
    await waitFor(() => expect(encontrado).toHaveBeenCalledOnce());
    expect(m.buscar).toHaveBeenCalledExactlyOnceWith("+525512345678");
  });
  it("Retroceso borra uno, Supr y Esc limpian y no admite más de diez dígitos", () => {
    caja(<PasoBuscar inicial="" onEncontrado={() => {}} onAlta={() => {}} />);
    escribir("55123456789"); expect(screen.getByText("55 1234 5678")).toBeInTheDocument();
    tecla("Backspace"); expect(screen.getByText("55 1234 567")).toBeInTheDocument();
    tecla("Delete"); tecla("Enter"); expect(m.buscar).not.toHaveBeenCalled();
    escribir("5512345678"); tecla("Escape"); tecla("Enter"); expect(m.buscar).not.toHaveBeenCalled();
  });
  it("Enter después de no encontrar un cliente abre el alta sin repetir búsqueda", async () => {
    m.buscar.mockResolvedValue({ encontrado: false }); const alta = vi.fn();
    caja(<PasoBuscar inicial="" onEncontrado={() => {}} onAlta={alta} />);
    escribir("5512345678"); tecla("Enter"); await screen.findByText("Este teléfono aún no es cliente"); tecla("Enter");
    expect(alta).toHaveBeenCalledWith("5512345678"); expect(m.buscar).toHaveBeenCalledOnce();
  });
  it("PIN POS limita a seis dígitos y Enter abre una sola vez", async () => {
    const abierta = vi.fn(); render(<PinPos onAbierta={abierta} />);
    escribir("12345"); tecla("Enter"); expect(m.abrir).not.toHaveBeenCalled();
    escribir("67"); tecla("Enter"); tecla("Enter");
    await waitFor(() => expect(abierta).toHaveBeenCalledOnce()); expect(m.abrir).toHaveBeenCalledExactlyOnceWith("123456");
  });
  it("confirmación enfoca la acción y bloquea Enter repetido o antes de 400 ms", () => {
    const confirmar = vi.fn(); const ahora = vi.spyOn(Date, "now").mockReturnValue(1000);
    const props = { titulo: "¿Acumular?", accion: "Sí, acumular", ocupado: false, onConfirmar: confirmar, onCancelar: () => {} };
    const { rerender } = render(<Confirmar abierto={false} {...props} />);
    rerender(<Confirmar abierto {...props} />);
    const accion = screen.getByRole("button", { name: /Sí, acumular/ }); expect(accion).toHaveFocus();
    expect(fireEvent.keyDown(accion, { key: "Enter", repeat: true })).toBe(false);
    ahora.mockReturnValue(1399); expect(fireEvent.keyDown(accion, { key: "Enter" })).toBe(false);
    ahora.mockReturnValue(1400); expect(fireEvent.keyDown(accion, { key: "Enter" })).toBe(true);
    expect(confirmar).not.toHaveBeenCalled(); fireEvent.click(accion); expect(confirmar).toHaveBeenCalledOnce();
  });
  it("useTecla ignora campos, modificadores, repeat y diálogos ajenos", () => {
    const manejar = vi.fn(() => true);
    function Escucha() { useTecla(manejar); return <input aria-label="Monto" />; }
    const { rerender } = render(<Escucha />);
    const input = screen.getByLabelText("Monto"); input.focus(); fireEvent.keyDown(input, { key: "1" });
    tecla("1", true); fireEvent.keyDown(window, { key: "1", ctrlKey: true }); expect(manejar).not.toHaveBeenCalled();
    rerender(<><Escucha /><div role="alertdialog" /></>); tecla("1"); expect(manejar).not.toHaveBeenCalled();
    rerender(<Escucha />); tecla("1"); expect(manejar).toHaveBeenCalledOnce();
  });
  it("sin mouse no muestra pistas ni enfoca o desenfoca campos automáticamente", () => {
    mouse(false);
    const input = document.createElement("input"); document.body.append(input); input.focus();
    const { container } = caja(<PasoAcumular telefono="5512345678" ficha={ficha} onVolver={() => {}} onHecho={() => {}} />);
    expect(input).toHaveFocus(); expect(container.querySelector("kbd")).toBeNull(); input.remove();
  });
  it("Enter en monto pasa al código y luego abre confirmación sin canjear todavía", () => {
    caja(<PasoCanjear telefono="5512345678" ficha={ficha} onVolver={() => {}} onHecho={() => {}} />);
    const monto = screen.getByLabelText("Saldo a usar"); expect(monto).toHaveFocus();
    fireEvent.change(monto, { target: { value: "20" } }); fireEvent.keyDown(monto, { key: "Enter" });
    expect(screen.getByRole("button", { name: /Código de canje del cliente/ })).toHaveFocus();
    escribir("1234"); tecla("Enter"); expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
  it("CampoDigitos físico respeta cuatro dígitos y las props por omisión no capturan", () => {
    function Campo({ fisico = false }: { fisico?: boolean }) { const [valor, setValor] = useState(""); return <CampoDigitos etiqueta="Código" valor={valor} onChange={setValor} largo={4} activo onActivar={() => {}} tecladoFisico={fisico} />; }
    const { rerender } = render(<Campo />); escribir("1234"); expect(screen.getByLabelText("0 de 4 dígitos")).toBeInTheDocument();
    rerender(<Campo fisico />); escribir("12345"); expect(screen.getByLabelText("4 de 4 dígitos")).toBeInTheDocument();
    tecla("Backspace"); expect(screen.getByLabelText("3 de 4 dígitos")).toBeInTheDocument(); tecla("Delete"); expect(screen.getByLabelText("0 de 4 dígitos")).toBeInTheDocument();
  });
  it("Esc cancela primero el correo y luego vuelve; A y C respetan disponibilidad", () => {
    const accion = vi.fn(), volver = vi.fn();
    caja(<PasoFicha ficha={{ ...ficha, cliente: { ...ficha.cliente, correo: { estado: "sin_correo", enmascarado: null } } }} onAccion={accion} onVolver={volver} onRefrescar={async () => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Agregar correo" })); fireEvent.keyDown(screen.getByLabelText("Correo del cliente"), { key: "Escape" });
    expect(screen.queryByLabelText("Correo del cliente")).toBeNull(); expect(volver).not.toHaveBeenCalled();
    tecla("A"); expect(accion).toHaveBeenLastCalledWith("acumular"); tecla("c"); expect(accion).toHaveBeenLastCalledWith("canjear"); tecla("Escape"); expect(volver).toHaveBeenCalledOnce();
  });
  it("comprobante Enter sigue, N inicia nuevo y repeat no actúa", () => {
    const seguir = vi.fn(), nuevo = vi.fn(); render(<PasoComprobante nombre="Diego" comprobante={{ titulo: "Listo", lineas: [] }} onSeguir={seguir} onNuevo={nuevo} />);
    tecla("Enter", true); expect(seguir).not.toHaveBeenCalled(); tecla("Enter"); tecla("N"); expect(seguir).toHaveBeenCalledOnce(); expect(nuevo).toHaveBeenCalledOnce();
  });
  it("sellos por cantidad respeta límites 1–100 y repeat no incrementa", () => {
    const tarjeta = { tarjeta_digital_id: "cortes", nombre: "Cortes", tipo_sello: "por_transaccion" as const, premio_texto: "Un corte", premio_por_canjear: null, activa: true, acumula: true, sellos_requeridos: 5, sellos_actuales: 0, remanente_centavos: 0, fecha_vencimiento: null, completas_por_canjear: 0 };
    caja(<PasoAcumular telefono="5512345678" ficha={{ cliente: ficha.cliente, tarjetas: [tarjeta] }} onVolver={() => {}} onHecho={() => {}} />);
    tecla("-"); expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument();
    tecla("+", true); expect(screen.getByText("1", { selector: "span" })).toBeInTheDocument();
    for (let i = 0; i < 101; i++) tecla("ArrowUp");
    expect(screen.getByText("100", { selector: "span" })).toBeInTheDocument();
    tecla("ArrowDown"); expect(screen.getByText("99", { selector: "span" })).toBeInTheDocument();
  });
  it("Enter sobre una opción permite seleccionarla y no abre confirmación", () => {
    caja(<PasoReclamar telefono="5512345678" ficha={ficha} onVolver={() => {}} onHecho={() => {}} />);
    const monto = screen.getByLabelText("Saldo que faltó"); fireEvent.change(monto, { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText("¿Qué pasó?"), { target: { value: "No se registró la compra" } });
    const opcion = screen.getByRole("button", { name: "Saldo" }); opcion.focus();
    expect(fireEvent.keyDown(opcion, { key: "Enter" })).toBe(true); expect(screen.queryByRole("alertdialog")).toBeNull();
  });
  it("Textarea conserva Enter para salto de línea; Enter fuera abre confirmación", () => {
    caja(<PasoReclamar telefono="5512345678" ficha={ficha} onVolver={() => {}} onHecho={() => {}} />);
    fireEvent.change(screen.getByLabelText("Saldo que faltó"), { target: { value: "10" } });
    const descripcion = screen.getByLabelText("¿Qué pasó?"); fireEvent.change(descripcion, { target: { value: "No se registró la compra" } });
    expect(fireEvent.keyDown(descripcion, { key: "Enter" })).toBe(true); expect(screen.queryByRole("alertdialog")).toBeNull();
    tecla("Enter"); expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
  it("PIN del diálogo recibe dígitos sin modificar la búsqueda de atrás", async () => {
    caja(<><PasoBuscar inicial="" onEncontrado={() => {}} onAlta={() => {}} />
      <Dialog open><DialogContent><DialogTitle>La caja se cerró</DialogTitle><PinPos compacto onAbierta={() => {}} /></DialogContent></Dialog>
    </>);
    escribir("123456"); tecla("Enter"); await waitFor(() => expect(m.abrir).toHaveBeenCalledExactlyOnceWith("123456"));
    expect(m.buscar).not.toHaveBeenCalled(); expect(screen.getByText("55 0000 0000")).toBeInTheDocument();
  });
});