import { createRef, type ComponentType, type ReactNode } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CampoPin } from "@/components/campo-pin";
import { CampoDigitos } from "@/components/enlace-ui";
import { MiSaldoProvider, useMiSaldo } from "@/components/misaldo-provider";
import { Route as LoginRoute } from "@/routes/login";
import { Route as AjustesRoute } from "@/routes/ajustes";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { readFileSync } from "node:fs";
const m = vi.hoisted(() => ({ success: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: m.success } }));
vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (options: object) => ({ options, useSearch: () => ({}) }), useNavigate: () => vi.fn(), Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a> }));
vi.mock("@tanstack/react-query", async (original) => ({ ...await original<object>(), useQuery: () => ({ data: undefined }) }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ estado: "autenticado", sesion: { contexto: { rol: "empleado" } } }) }));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/requiere-sesion", () => ({ RequiereSesion: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock("@/components/mis-negocios", () => ({ useMisNegocios: () => ({ varios: false }), etiquetaContexto: () => "Cliente" }));
vi.mock("@/components/cerrar-sesion", () => ({ useCerrarSesion: () => ({}) }));
vi.mock("@/components/cuenta/secciones", () => ({ Encabezado: () => null, MisDatos: () => null, Seguridad: () => null, NotificacionesDispositivo: () => null, Promociones: () => null, Tarjeta: ({ children }: { children: ReactNode }) => <section>{children}</section> }));
vi.mock("@/components/continuar-sesion", () => ({ ContinuarSesion: () => null, destinoSeguro: () => null }));
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
afterEach(cleanup);
const routeComponent = (route: unknown) => (route as { options: { component: ComponentType } }).options.component;
describe("P39 secretos", () => {
 it("conserva valor, foco, props y ref; oculta al enviar y remontar", () => {
  const ref = createRef<HTMLInputElement>(); const submit = vi.fn((e) => e.preventDefault());
  const vista = render(<form onSubmit={submit}><CampoPin ref={ref} id="secreto" name="pin" aria-label="PIN" defaultValue="582739" inputMode="numeric" autoComplete="current-password" maxLength={128} data-prueba="conservada" /></form>);
  const input = screen.getByLabelText("PIN"); expect(input).toHaveAttribute("type", "password");
  input.focus(); fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN" }));
  expect(input).toHaveAttribute("type", "text"); expect(input).toHaveValue("582739"); expect(input).toHaveFocus(); expect(ref.current).toBe(input);
  expect(input).toHaveAttribute("data-prueba", "conservada"); expect(input).toHaveAttribute("inputmode", "numeric"); expect(input).toHaveAttribute("maxlength", "128"); expect(input).toHaveAttribute("autocomplete", "current-password");
  expect(screen.getByRole("button", { name: "Ocultar PIN" })).toHaveAttribute("aria-controls", "secreto");
  fireEvent.click(screen.getByRole("button", { name: "Ocultar PIN" })); expect(input).toHaveAttribute("type", "password");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN" })); const form = input.closest("form"); if (!form) throw new Error("Falta formulario"); fireEvent.submit(form);
  expect(submit).toHaveBeenCalledOnce(); expect(input).toHaveAttribute("type", "password");
  vista.unmount(); render(<CampoPin aria-label="PIN" />); expect(screen.getByLabelText("PIN")).toHaveAttribute("type", "password");
 });
 it("nombra PIN POS y propaga onInput/onChange", () => {
  const onInput = vi.fn(), onChange = vi.fn(); render(<CampoPin etiquetaMostrar="PIN POS" aria-label="POS" onInput={onInput} onChange={onChange} />);
  expect(screen.getByRole("button", { name: "Mostrar PIN POS" })).toHaveAttribute("aria-pressed", "false");
  fireEvent.input(screen.getByLabelText("POS"), { target: { value: "582739" } }); expect(onInput).toHaveBeenCalledOnce(); expect(onChange).toHaveBeenCalledOnce();
 });
 it("casillas revelables y ocultación al enviar sin exponer el secreto en aria-label", () => {
  render(<form onSubmit={(e) => e.preventDefault()}><CampoDigitos revelable etiqueta="Tu PIN" valor="582739" onChange={() => {}} largo={6} activo={false} onActivar={() => {}} /></form>);
  const slots = screen.getByRole("img"); expect(slots).toHaveAttribute("aria-label", "6 de 6 dígitos"); expect(slots).not.toHaveTextContent("5");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN" })); expect(slots).toHaveTextContent("582739"); expect(document.querySelector("button button")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Ocultar PIN" })); expect(slots).not.toHaveTextContent("5");
  fireEvent.click(screen.getByRole("button", { name: "Mostrar PIN" })); const form = slots.closest("form"); if (!form) throw new Error("Falta formulario"); fireEvent.submit(form); expect(slots).not.toHaveTextContent("5");
 });
 it("sin revelable no aparece ojo", () => {
  render(<CampoDigitos etiqueta="Código" valor="5827" onChange={() => {}} largo={4} activo={false} onActivar={() => {}} />); expect(screen.queryByRole("button", { name: /Mostrar/ })).toBeNull();
 });
 it.each(["routes/login.tsx", "components/mis-negocios.tsx", "components/cuenta/secciones.tsx", "components/cuenta/mis-codigos.tsx", "routes/baja.tsx", "routes/eliminar-cuenta.tsx", "components/staff/precio-membresia.tsx", "routes/recuperar.tsx", "routes/restablecer-pin.tsx", "routes/negocio.pin-pos.tsx"])("centraliza secreto en %s", (file) => {
  const source = readFileSync(`src/${file}`, "utf8"); expect(source).toContain("CampoPin"); expect(source).not.toMatch(/type=.*password/);
 });
 it.each(["components/caja/paso-abrir.tsx", "components/caja/paso-operacion.tsx", "routes/activar.tsx", "routes/registro.tsx"])("no agrega ojos a %s", (file) => {
  expect(readFileSync(`src/${file}`, "utf8")).not.toMatch(/revelable|CampoPin|OjoSecreto/);
 });
});
describe("P39 Entrada y confirmaciones", () => {
 it("Entrada tiene ojo, logo 176 y teléfono ampliado", () => {
  const Login = routeComponent(LoginRoute); render(<Login />); expect(screen.getByRole("button", { name: "Mostrar PIN" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "Mi Saldo Vip" })).toHaveAttribute("width", "176"); expect(screen.getByRole("img", { name: "Mi Saldo Vip" })).toHaveAttribute("height", "176"); expect(screen.getByLabelText("Teléfono (10 dígitos)")).toHaveClass("h-14");
 });
 it("confirmación compartida amplía título y acciones", () => {
  render(<AlertDialog open><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirmar</AlertDialogTitle><AlertDialogDescription>Revisa antes de continuar.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction>Confirmar acción</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>);
  expect(screen.getByRole("heading")).toHaveClass("text-2xl"); expect(screen.getByRole("button", { name: "Confirmar acción" })).toHaveClass("min-h-14"); expect(screen.getByRole("button", { name: "Cancelar" })).toHaveClass("min-h-14");
 });
});
function Preferencias() { const { theme, customColor } = useMiSaldo(); return <output aria-label="Preferencias">{theme}/{customColor}</output>; }
describe("P39 restauración", () => {
 it.each(["claro", "oscuro", "personalizado"])("visible en %s y restaura valores exactos", async (theme) => {
  localStorage.setItem("misaldo-prefs", JSON.stringify({ theme, customColor: "#16a34a" })); const Ajustes = routeComponent(AjustesRoute); render(<MiSaldoProvider><Ajustes /><Preferencias /></MiSaldoProvider>);
  await waitFor(() => expect(screen.getByLabelText("Preferencias")).toHaveTextContent(`${theme}/#16a34a`)); fireEvent.click(screen.getByRole("button", { name: "Restaurar colores por defecto" }));
  expect(screen.getByLabelText("Preferencias")).toHaveTextContent("oscuro/#2563EB"); expect(m.success).toHaveBeenCalledWith("Colores restaurados", { description: "Volviste a los colores de Mi Saldo Vip." }); expect(screen.getByRole("button", { name: "Restaurar colores por defecto" })).toBeDisabled();
  expect(JSON.parse(localStorage.getItem("misaldo-prefs") ?? "{}")).toEqual({ theme: "oscuro", customColor: "#2563EB", fondo: "azul-noche" });
 });
 it("deshabilitado sin importar mayúsculas", () => {
  localStorage.setItem("misaldo-prefs", JSON.stringify({ theme: "oscuro", customColor: "#2563eb" })); const Ajustes = routeComponent(AjustesRoute); render(<MiSaldoProvider><Ajustes /></MiSaldoProvider>);
  expect(screen.getByRole("button", { name: "Restaurar colores por defecto" })).toBeDisabled(); expect(screen.getByText("Ya tienes los colores por defecto.")).toBeInTheDocument(); expect(m.success).not.toHaveBeenCalled();
 });
});
