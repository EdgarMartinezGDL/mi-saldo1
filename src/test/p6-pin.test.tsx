import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CampoDigitos } from "@/components/enlace-ui";

afterEach(cleanup);

function Pin({ limite }: { limite?: number }) {
  const [valor, setValor] = useState("");
  return <><CampoDigitos etiqueta="PIN" valor={valor} onChange={setValor} largo={6} limite={limite ?? 6} activo onActivar={() => {}} /><output aria-label="Cantidad">{valor.length}</output></>;
}

describe("P6: teclado de PIN", () => {
  it("permite hasta 128 dígitos para confirmar con el PIN actual sin cambiar sus seis casillas", () => {
    render(<Pin limite={128} />);
    const tecla = screen.getByRole("button", { name: /^1$/ });
    for (let i = 0; i < 129; i++) fireEvent.click(tecla);
    expect(screen.getByLabelText("Cantidad")).toHaveTextContent("128");
    expect(screen.getByLabelText("128 de 128 dígitos").children).toHaveLength(6);
  });
  it("conserva el límite de seis dígitos al crear un PIN nuevo", () => {
    render(<Pin />);
    const tecla = screen.getByRole("button", { name: /^1$/ });
    for (let i = 0; i < 7; i++) fireEvent.click(tecla);
    expect(screen.getByLabelText("Cantidad")).toHaveTextContent("6");
  });
});