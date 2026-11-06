import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { activarPush, desactivarPush, estadoPush } from "@/lib/push-dispositivo";
import { NotificacionesDispositivo } from "@/components/cuenta/secciones";
import { useCerrarSesion } from "@/components/cerrar-sesion";
import { Route } from "@/routes/negocio.promociones";
import pushRaw from "@/lib/api/push.ts?raw";
import dispositivoRaw from "@/lib/push-dispositivo.ts?raw";
import rutaRaw from "@/routes/negocio.promociones.tsx?raw";
import seccionesRaw from "@/components/cuenta/secciones.tsx?raw";

const m = vi.hoisted(() => ({
  llavePublica: vi.fn(), registrar: vi.fn(), baja: vi.fn(),
  resumen: vi.fn(), historial: vi.fn(), enviar: vi.fn(),
  promocionesCliente: vi.fn(), logout: vi.fn(), navigate: vi.fn(),
  subscribe: vi.fn(), unsubscribe: vi.fn(), getSubscription: vi.fn(), requestPermission: vi.fn(),
  toastOk: vi.fn(), toastErr: vi.fn(), orden: [] as string[],
}));

vi.mock("@/lib/api/push", () => ({
  llavePublica: m.llavePublica, registrarSuscripcion: m.registrar, bajaSuscripcion: m.baja,
  resumenPromociones: m.resumen, historialPromociones: m.historial, enviarPromocion: m.enviar,
}));
vi.mock("@/lib/api/auth", () => ({ logout: m.logout }));
vi.mock("@/components/auth-provider", () => ({ useAuth: () => ({ sesion: { contexto: { rol: "dueno", nombre_comercial: "Taquería La Cuna" } } }) }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ resetSessionData: vi.fn() }) }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => (fn: () => Promise<unknown>) => fn() }));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => m.navigate,
}));
vi.mock("@/components/requiere-sesion", async (original) => ({
  ...await original<typeof import("@/components/requiere-sesion")>(),
  RequiereSesion: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/components/negocio/comun", () => ({
  SeccionNegocio: ({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) => (
    <div><h1>{titulo}</h1><p>{descripcion}</p>{children}</div>
  ),
}));
vi.mock("@/components/cuenta/cuenta-api", async (original) => ({
  ...await original<typeof import("@/components/cuenta/cuenta-api")>(),
  promociones: m.promocionesCliente,
}));
vi.mock("sonner", () => ({ toast: { success: m.toastOk, error: m.toastErr, info: vi.fn() } }));

// ---- browser push stubs -------------------------------------------------
const SUB = {
  endpoint: "https://push.example.com/sub1",
  toJSON: () => ({ endpoint: "https://push.example.com/sub1", expirationTime: null, keys: { p256dh: "a2xhdmU", auth: "YXV0aA" } }),
  unsubscribe: m.unsubscribe,
};

function stubNavegador(opts: { registro?: boolean; suscripcion?: boolean; permiso?: string; ua?: string; standalone?: boolean } = {}) {
  const { registro = true, suscripcion = false, permiso = "default", ua, standalone = true } = opts;
  const reg = registro
    ? { active: {}, pushManager: { getSubscription: m.getSubscription, subscribe: m.subscribe } }
    : null;
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: { getRegistration: async () => reg } });
  Object.defineProperty(window, "PushManager", { configurable: true, value: class {} });
  Object.defineProperty(window, "Notification", { configurable: true, value: { permission: permiso, requestPermission: m.requestPermission } });
  if (ua) Object.defineProperty(navigator, "userAgent", { configurable: true, value: ua });
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: (q: string) => ({ matches: standalone && q.includes("standalone"), addEventListener: () => {}, removeEventListener: () => {} }),
  });
  m.getSubscription.mockResolvedValue(suscripcion ? SUB : null);
}

function limpiarNavegador() {
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(window, "Notification");
  Reflect.deleteProperty(window, "matchMedia");
}

function montar(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return client;
}

const RESUMEN = {
  destinatarios: 5, clientes_con_push: 3, totp_activo: true, puede_enviar: true,
  disponible_desde: null, limite: { por_dia: 1, por_semana: 3 },
};

beforeEach(() => {
  vi.clearAllMocks();
  m.orden.length = 0;
  m.llavePublica.mockResolvedValue({ llave_publica: "AQID" });
  m.registrar.mockResolvedValue({ suscrito: true, id: "s-1" });
  m.baja.mockResolvedValue({ eliminada: true });
  m.resumen.mockResolvedValue(RESUMEN);
  m.historial.mockResolvedValue({ promociones: [] });
  m.promocionesCliente.mockResolvedValue({ acepta_promociones: true });
  m.enviar.mockResolvedValue({ promocion_id: "p-1", destinatarios: 5 });
  m.logout.mockImplementation(async () => { m.orden.push("logout"); });
  m.unsubscribe.mockImplementation(async () => { m.orden.push("unsubscribe"); return true; });
  m.subscribe.mockResolvedValue(SUB);
  m.requestPermission.mockResolvedValue("granted");
});
afterEach(() => { cleanup(); limpiarNavegador(); });

describe("P25 estadoPush", () => {
  it("no_disponible sin PushManager", async () => {
    await expect(estadoPush()).resolves.toBe("no_disponible");
  });
  it("no_disponible sin registro activo de /sw.js", async () => {
    stubNavegador({ registro: false });
    await expect(estadoPush()).resolves.toBe("no_disponible");
  });
  it("instalar_ios en iPhone sin instalar", async () => {
    stubNavegador({ ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1", standalone: false, suscripcion: true, permiso: "granted" });
    await expect(estadoPush()).resolves.toBe("instalar_ios");
  });
  it("bloqueadas con permiso denied", async () => {
    stubNavegador({ permiso: "denied" });
    await expect(estadoPush()).resolves.toBe("bloqueadas");
  });
  it("activadas con suscripción y desactivadas sin ella", async () => {
    stubNavegador({ suscripcion: true, permiso: "granted" });
    await expect(estadoPush()).resolves.toBe("activadas");
    stubNavegador({ suscripcion: false, permiso: "granted" });
    await expect(estadoPush()).resolves.toBe("desactivadas");
  });
});

describe("P25 activarPush", () => {
  it("con permiso concedido suscribe con la llave convertida y registra solo los campos permitidos", async () => {
    stubNavegador();
    await activarPush();
    expect(m.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]) });
    expect(m.registrar).toHaveBeenCalledWith(
      { endpoint: "https://push.example.com/sub1", expirationTime: null, keys: { p256dh: "a2xhdmU", auth: "YXV0aA" } },
      expect.any(String),
    );
    expect(Object.keys(m.registrar.mock.calls[0]![0] as object).sort()).toEqual(["endpoint", "expirationTime", "keys"]);
    expect(typeof m.registrar.mock.calls[0]![1]).toBe("string");
  });
  it("con permiso negado no llama al backend", async () => {
    stubNavegador();
    m.requestPermission.mockResolvedValue("denied");
    await activarPush();
    expect(m.llavePublica).not.toHaveBeenCalled();
    expect(m.registrar).not.toHaveBeenCalled();
  });
  it("si el backend falla, deshace la suscripción y lanza el error", async () => {
    stubNavegador();
    m.registrar.mockRejectedValue(new ApiError(500, { codigo: "x" }));
    await expect(activarPush()).rejects.toThrow();
    expect(m.unsubscribe).toHaveBeenCalled();
  });
});

describe("P25 desactivarPush", () => {
  it("desuscribe aquí antes de avisar al backend", async () => {
    stubNavegador({ suscripcion: true });
    m.baja.mockImplementation(async () => { m.orden.push("baja"); return { eliminada: true }; });
    await desactivarPush();
    expect(m.orden).toEqual(["unsubscribe", "baja"]);
    expect(m.baja).toHaveBeenCalledWith("https://push.example.com/sub1");
  });
});

function HarnessSalir() {
  const { pedirConfirmacion, dialogo } = useCerrarSesion();
  return <><button onClick={pedirConfirmacion}>Salir</button>{dialogo}</>;
}

describe("P25 cerrar sesión desactiva notificaciones", () => {
  it("unsubscribe ocurre antes de logout", async () => {
    stubNavegador({ suscripcion: true });
    montar(<HarnessSalir />);
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, cerrar sesión" }));
    await waitFor(() => expect(m.logout).toHaveBeenCalled());
    expect(m.orden).toEqual(["unsubscribe", "logout"]);
  });
  it("si desactivarPush falla, igual cierra la sesión", async () => {
    stubNavegador({ suscripcion: true });
    m.unsubscribe.mockRejectedValue(new Error("sin red"));
    montar(<HarnessSalir />);
    fireEvent.click(screen.getByRole("button", { name: "Salir" }));
    fireEvent.click(await screen.findByRole("button", { name: "Sí, cerrar sesión" }));
    await waitFor(() => expect(m.logout).toHaveBeenCalled());
  });
});

describe("P25 Cuenta (cliente)", () => {
  it("no muestra la tarjeta cuando el dispositivo no admite push", async () => {
    const client = montar(<NotificacionesDispositivo />);
    await waitFor(() => expect(client.getQueryState(["push-estado"])?.status).toBe("success"));
    expect(screen.queryByText("Notificaciones")).toBeNull();
  });
  it("en desactivadas muestra el botón Activar notificaciones", async () => {
    stubNavegador();
    montar(<NotificacionesDispositivo />);
    expect(await screen.findByRole("button", { name: /Activar notificaciones/ })).toBeInTheDocument();
  });
  it("en activadas muestra Desactivar y la nota de Promociones apagadas", async () => {
    stubNavegador({ suscripcion: true, permiso: "granted" });
    m.promocionesCliente.mockResolvedValue({ acepta_promociones: false });
    montar(<NotificacionesDispositivo />);
    expect(await screen.findByRole("button", { name: "Desactivar" })).toBeInTheDocument();
    expect(screen.getByText(/activa también/)).toBeInTheDocument();
  });
});

function montarRuta() {
  const Component = (Route as unknown as { options: { component: React.ComponentType } }).options.component;
  return montar(<Component />);
}

async function llenarFormulario() {
  fireEvent.change(await screen.findByLabelText("Título"), { target: { value: "Dos por uno hoy" } });
  fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Solo hoy en toda la carta." } });
}

async function abrirDialogoYConfirmar() {
  await llenarFormulario();
  fireEvent.click(screen.getByRole("button", { name: /Enviar promoción/ }));
  await screen.findByText("Confirma con tu app autenticadora");
  for (const d of ["1", "2", "3", "4", "5", "6"]) fireEvent.click(screen.getByRole("button", { name: d }));
  fireEvent.click(screen.getByRole("button", { name: "Enviar" }));
}

describe("P25 Promociones (dueño)", () => {
  it("el destino tiene exactamente 3 opciones con rutas /, /canjear y /referidos", async () => {
    montarRuta();
    const select = await screen.findByLabelText("A dónde lleva") as HTMLSelectElement;
    expect([...select.options].map((o) => o.value)).toEqual(["/", "/canjear", "/referidos"]);
  });
  it("el contador y el botón respetan 3–50 y 5–150", async () => {
    montarRuta();
    await screen.findByLabelText("Título");
    const boton = screen.getByRole("button", { name: /Enviar promoción/ });
    expect(boton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Título"), { target: { value: "Ab" } });
    fireEvent.change(screen.getByLabelText("Mensaje"), { target: { value: "Hola" } });
    expect(screen.getByText("2/50")).toBeInTheDocument();
    expect(boton).toBeDisabled();
    await llenarFormulario();
    expect(boton).toBeEnabled();
  });
  it("con totp_activo false el botón está desactivado y aparece el enlace a Cuenta", async () => {
    m.resumen.mockResolvedValue({ ...RESUMEN, totp_activo: false });
    montarRuta();
    await llenarFormulario();
    expect(screen.getByRole("button", { name: /Enviar promoción/ })).toBeDisabled();
    expect(screen.getByText("Activarla en Cuenta")).toBeInTheDocument();
  });
  it("el diálogo envía titulo, cuerpo, ruta y codigo; el botón Enviar es primario", async () => {
    montarRuta();
    await abrirDialogoYConfirmar();
    await waitFor(() => expect(m.enviar).toHaveBeenCalledWith({ titulo: "Dos por uno hoy", cuerpo: "Solo hoy en toda la carta.", ruta: "/", codigo: "123456" }));
    expect(m.toastOk).toHaveBeenCalledWith("Promoción enviada a 5 dispositivos");
  });
  it("un 422 deja el diálogo abierto con los intentos restantes y casillas limpias", async () => {
    m.enviar.mockRejectedValue(new ApiError(422, { codigo: "codigo_incorrecto", intentos_restantes: 2 }));
    montarRuta();
    await abrirDialogoYConfirmar();
    expect(await screen.findByText(/Te quedan 2 intentos/)).toBeInTheDocument();
    expect(screen.getByText("Confirma con tu app autenticadora")).toBeInTheDocument();
    expect(screen.getByLabelText("0 de 6 dígitos")).toBeInTheDocument();
  });
  it("un 429 limite cierra el diálogo y muestra la fecha", async () => {
    m.enviar.mockRejectedValue(new ApiError(429, { codigo: "limite", disponible_desde: "2026-11-07T18:00:00Z" }));
    montarRuta();
    await abrirDialogoYConfirmar();
    await waitFor(() => expect(m.toastErr).toHaveBeenCalledWith(expect.stringContaining("Podrás enviar otra el")));
    expect(screen.queryByText("Confirma con tu app autenticadora")).toBeNull();
  });
});

describe("P25 diseño", () => {
  const prohibido = [/#[0-9a-fA-F]{3,6}\b/, /\b(bg|text|ring|border)-(slate|gray|blue|red|rose|green|yellow|amber)-\d/, /shadow-\[inset/, /bg-gradient/];
  it.each([["push.ts", pushRaw], ["push-dispositivo.ts", dispositivoRaw], ["negocio.promociones.tsx", rutaRaw]])("%s no contiene colores fijos ni estilos prohibidos", (_nombre, raw) => {
    for (const re of prohibido) expect(raw).not.toMatch(re);
  });
  it("NotificacionesDispositivo no contiene colores fijos ni estilos prohibidos", () => {
    const bloque = seccionesRaw.slice(seccionesRaw.indexOf("export function NotificacionesDispositivo"));
    expect(bloque).not.toBe("");
    for (const re of prohibido) expect(bloque).not.toMatch(re);
  });
  it("el botón Enviar del diálogo lleva bg-primary", async () => {
    montarRuta();
    await llenarFormulario();
    fireEvent.click(screen.getByRole("button", { name: /Enviar promoción/ }));
    const enviar = await screen.findByRole("button", { name: "Enviar" });
    expect(enviar).toHaveClass("bg-primary");
  });
});
