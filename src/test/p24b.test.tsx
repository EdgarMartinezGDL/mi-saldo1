import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NumericKeypad } from "@/components/numeric-keypad";
import { CasillasDigitos } from "@/components/casillas-digitos";
import { PinPos } from "@/components/caja/paso-abrir";
import { Button } from "@/components/ui/button";
import styles from "@/styles.css?raw";

afterEach(cleanup);

describe("P24b teclado y casillas", () => {
  it("números y acciones tienen canto y presión sin bg-secondary", () => {
    render(<NumericKeypad onKey={() => {}} />);
    expect(screen.getByRole("button", { name: "5" })).toHaveClass("bg-tecla", "border-b-4", "active:translate-y-[3px]");
    expect(screen.getByRole("button", { name: "Borrar un dígito" })).toHaveClass("bg-tecla-accion");
    expect(screen.getByRole("button", { name: "Limpiar" })).toHaveClass("bg-tecla-accion");
    for (const key of screen.getAllByRole("button")) {
      expect(key).not.toHaveClass("bg-secondary", "active:scale-95");
      expect(key).toHaveClass("border-b-4", "active:translate-y-[3px]", "active:border-b", "active:shadow-pressed");
    }
  });

  it("seis casillas con dos puntos resaltan solo la siguiente durante entrada activa", () => {
    const { rerender } = render(<CasillasDigitos largo={6} llenos={2} />);
    const slots = screen.getByLabelText("2 de 6 dígitos");
    expect(slots.children).toHaveLength(6);
    expect(slots.querySelectorAll(".bg-primary")).toHaveLength(2);
    expect(slots.children[2]).toHaveClass("ring-4");
    expect(slots.querySelectorAll(".ring-4")).toHaveLength(1);
    rerender(<CasillasDigitos largo={6} llenos={2} activo={false} />);
    expect(slots.querySelectorAll(".ring-4")).toHaveLength(0);
  });

  it("PIN POS muestra dos puntos al tocar 1 y 2 y mantiene Abrir caja desactivado neutro", () => {
    render(<PinPos onAbierta={() => {}} />);
    const abrir = screen.getByRole("button", { name: /Abrir caja/ });
    expect(abrir).toBeDisabled();
    expect(abrir).toHaveClass("disabled:bg-muted", "disabled:text-muted-foreground", "disabled:opacity-100", "disabled:shadow-none");
    expect(abrir).not.toHaveClass("disabled:opacity-50");
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByLabelText("2 de 6 dígitos").querySelectorAll(".bg-primary")).toHaveLength(2);
    expect(abrir).toBeDisabled();
  });

  it.each(["secondary", "outline", "ghost", "link", "destructive"] as const)("%s conserva transparencia al desactivarse", (variant) => {
    render(<Button variant={variant} disabled>Acción</Button>);
    expect(screen.getByRole("button", { name: "Acción" })).toHaveClass("disabled:opacity-50");
  });

  it.each([
    [":root", "#FFFFFF", "#F1F5F9"],
    [".dark", "#334155", "#0F172A"],
  ])("define tecla y casilla en %s", (selector, tecla, casilla) => {
    const block = styles.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`, "i"))?.[1];
    expect(block).toMatch(new RegExp(`--tecla:\\s*${tecla}\\s*;`, "i"));
    expect(block).toMatch(new RegExp(`--casilla:\\s*${casilla}\\s*;`, "i"));
  });
});