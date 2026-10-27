import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CampoDigitos, TarjetaEnlace } from "@/components/enlace-ui";
import { BotonesEdicion, useModoEdicion, VistaLectura } from "@/components/seccion-editable";
import { plural } from "@/lib/plural";

afterEach(cleanup);

describe("P8", () => {
  it("encabezado con el lema de la marca", () => {
    render(<TarjetaEnlace titulo="Hola" icono={null}>x</TarjetaEnlace>);
    expect(screen.getByText("MiSaldo · By MicroFix Cloud")).toBeInTheDocument();
  });

  it("plural()", () => {
    expect(plural(1, "sello", "sellos")).toBe("1 sello");
    expect(plural(2, "sello", "sellos")).toBe("2 sellos");
    expect(plural(0, "mes", "meses")).toBe("0 meses");
  });

  it("muestra el total cuando el PIN pasa de las casillas", () => {
    function Pin() {
      const [v, setV] = useState("");
      return <CampoDigitos etiqueta="PIN" valor={v} onChange={setV} largo={6} limite={128} activo onActivar={() => {}} />;
    }
    render(<Pin />);
    const tecla = screen.getByRole("button", { name: /^1$/ });
    for (let i = 0; i < 6; i++) fireEvent.click(tecla);
    expect(screen.queryByText("6 dígitos")).toBeNull();
    fireEvent.click(tecla); fireEvent.click(tecla);
    expect(screen.getByText("8 dígitos")).toBeInTheDocument();
  });

  it("modo lectura y edición", () => {
    function Form() {
      const m = useModoEdicion({ nombre: "Café" });
      if (!m.editando) return <VistaLectura datos={[{ etiqueta: "Nombre", valor: m.guardado.nombre }]} onEditar={m.editar} />;
      return (
        <div ref={m.ref}>
          <input aria-label="Nombre" value={m.valores.nombre} onChange={(e) => m.set("nombre", e.target.value)} />
          <BotonesEdicion cambiado={m.cambiado} onGuardar={() => m.terminar()} onCancelar={m.cancelar} />
        </div>
      );
    }
    render(<Form />);
    expect(screen.queryByLabelText("Nombre")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Pan" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.getByText("Café")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Editar/ }));
    expect(screen.getByLabelText("Nombre")).toHaveValue("Café");
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Pan" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.queryByLabelText("Nombre")).toBeNull();
    expect(screen.getByText("Pan")).toBeInTheDocument();
  });
});
