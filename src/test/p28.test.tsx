import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { useDigitos } from "@/components/caja/teclado";

function CapturarDigitos({ recibidas }: { recibidas: string[] }) {
  useDigitos((tecla) => recibidas.push(tecla));
  return null;
}

afterEach(cleanup);

describe("P28 diálogos que bloquean el teclado de Caja", () => {
  it("recibe 5 sin diálogo", () => {
    const recibidas: string[] = [];
    render(<CapturarDigitos recibidas={recibidas} />);
    fireEvent.keyDown(window, { key: "5" });
    expect(recibidas).toEqual(["5"]);
  });

  it("bloquea 5 con un diálogo abierto", () => {
    const recibidas: string[] = [];
    render(<><CapturarDigitos recibidas={recibidas} /><div role="dialog" data-state="open" /></>);
    fireEvent.keyDown(window, { key: "5" });
    expect(recibidas).toEqual([]);
  });

  it("recibe 5 cuando el diálogo se está cerrando", () => {
    const recibidas: string[] = [];
    render(<><CapturarDigitos recibidas={recibidas} /><div role="dialog" data-state="closed" /></>);
    fireEvent.keyDown(window, { key: "5" });
    expect(recibidas).toEqual(["5"]);
  });

  it("bloquea 5 con un alertdialog abierto", () => {
    const recibidas: string[] = [];
    render(<><CapturarDigitos recibidas={recibidas} /><div role="alertdialog" data-state="open" /></>);
    fireEvent.keyDown(window, { key: "5" });
    expect(recibidas).toEqual([]);
  });

  it("bloquea 5 con un diálogo sin data-state", () => {
    const recibidas: string[] = [];
    render(<><CapturarDigitos recibidas={recibidas} /><div role="dialog" /></>);
    fireEvent.keyDown(window, { key: "5" });
    expect(recibidas).toEqual([]);
  });
});