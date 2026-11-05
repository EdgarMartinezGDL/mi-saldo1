import { cleanup, render, screen } from "@testing-library/react";
import { Gift } from "lucide-react";
import { afterEach, describe, expect, it } from "vitest";
import { CasillasDigitos } from "@/components/casillas-digitos";
import { EstadoVacio } from "@/components/estado-vacio";
import { IconoTono, Iniciales } from "@/components/fila-lista";
import { Cargando } from "@/components/requiere-sesion";
import { Button } from "@/components/ui/button";
import styles from "@/styles.css?raw";
import franjaCaja from "@/components/caja/franja-caja.tsx?raw";
import clientes from "@/routes/clientes.tsx?raw";

afterEach(cleanup);

describe("P24c listas, títulos, cargas y vacíos", () => {
  it.each([
    [":root", "#334155", "#CBD5E1", "#A16207"],
    [".dark", "#E2E8F0", "#334155", "#FCD34D"],
  ])("define secondary-foreground, separador y warning-icono en %s", (selector, sec, sep, warn) => {
    const block = styles.match(new RegExp(`${selector.replace(".", "\\.")}\\s*\\{([^}]+)\\}`, "i"))?.[1];
    expect(block).toMatch(new RegExp(`--secondary-foreground:\\s*${sec}\\s*;`, "i"));
    expect(block).toMatch(new RegExp(`--separador:\\s*${sep}\\s*;`, "i"));
    expect(block).toMatch(new RegExp(`--warning-icono:\\s*${warn}\\s*;`, "i"));
  });

  it("la casilla siguiente refuerza su anillo en oscuro", () => {
    render(<CasillasDigitos largo={6} llenos={2} />);
    const slots = screen.getByLabelText("2 de 6 dígitos");
    expect(slots.children[2]).toHaveClass("ring-primary/15", "dark:ring-primary/40");
  });

  it("«Sí, cerrar caja» usa la variante primario, no destructive", () => {
    expect(franjaCaja).toMatch(/variant="primario"[^>]*>\s*\{ocupado \? "Cerrando…" : "Sí, cerrar caja"\}/);
    expect(franjaCaja).not.toMatch(/variant="destructive"[^>]*>\s*\{ocupado \? "Cerrando…" : "Sí, cerrar caja"\}/);
    render(<Button variant="primario">Sí, cerrar caja</Button>);
    const boton = screen.getByRole("button", { name: "Sí, cerrar caja" });
    expect(boton).toHaveClass("bg-primary");
    expect(boton).not.toHaveClass("bg-destructive");
  });

  it("Iniciales toma las dos primeras palabras y cae al ícono sin nombre", () => {
    const { rerender } = render(<Iniciales nombre="Ana López" />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    rerender(<Iniciales nombre="Diego" />);
    expect(screen.getByText("D")).toBeInTheDocument();
    rerender(<Iniciales nombre=" " />);
    expect(document.querySelector("svg.lucide-user")).not.toBeNull();
  });

  it("IconoTono warning usa fondo amarillo tenue e ícono legible", () => {
    const { container } = render(<IconoTono icono={Gift} tono="warning" />);
    expect(container.firstChild).toHaveClass("bg-warning/15", "text-warning-icono");
  });

  it("Cargando anuncia el estado y pulsa bloques; tarjetas muestra 4", () => {
    const { rerender } = render(<Cargando />);
    const estado = screen.getByRole("status");
    expect(estado).toHaveTextContent("Cargando…");
    expect(estado.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
    rerender(<Cargando forma="tarjetas" />);
    expect(screen.getByRole("status").querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  it("EstadoVacio muestra el título y la acción", () => {
    render(<EstadoVacio icono={Gift} titulo="Aún no tienes premios por cobrar." accion={<button>Ver tienda</button>} />);
    expect(screen.getByText("Aún no tienes premios por cobrar.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver tienda" })).toBeInTheDocument();
  });

  it("Clientes muestra «Sin activar» como pill y filas tocables", () => {
    expect(clientes).toContain('pill-badge text-warning-icono">Sin activar</span>');
    expect(clientes).not.toContain("sin activar");
    expect(clientes).toContain("active:bg-secondary");
    expect(clientes).not.toContain("divide-y");
  });
});
