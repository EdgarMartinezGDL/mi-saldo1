import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { actualizarCopia, borrarCopia, comprobarPersona, leerCopia, LLAVE_SIN_CONEXION } from "@/lib/sin-conexion-storage";
import { fueraDeHorario, horarioHoy, INTERVALO_POS } from "@/lib/caja-horario";
import { permiteWorker } from "@/lib/pwa-registro";
import { ApiError, refrescar, onSesion, onSinConexion, type Sesion } from "@/lib/api/client";
import { prepararCopia, guardarCopia, terminarCopia } from "@/lib/sin-conexion-sesion";
import { AuthProvider, useAuth } from "@/components/auth-provider";
import { RestablecerPinStaff, motivoPinValido } from "@/components/staff/restablecer-pin";
import { pinRestablecimientoValido } from "@/routes/restablecer-pin";
import type { Resumen } from "@/lib/api/cliente";

const mocks = vi.hoisted(() => ({ estado: vi.fn(), autorizar: vi.fn(), totp: vi.fn(), setRole: vi.fn(), updateBusiness: vi.fn() }));
vi.mock("@/components/misaldo-provider", () => ({ useMiSaldo: () => ({ setRole: mocks.setRole, updateBusiness: mocks.updateBusiness }) }));
vi.mock("@/components/totp-provider", () => ({ useConTotp: () => mocks.totp }));
vi.mock("@/lib/api/staff", async (original) => ({ ...await original<typeof import("@/lib/api/staff")>(), estadoRestablecimiento: mocks.estado, autorizarRestablecimiento: mocks.autorizar }));

const persona = { persona_id: "diego", nombre: "Diego" };
const sesion: Sesion = { access_token: "token-de-prueba", token_type: "Bearer", expires_in: 900, sesion_expira_en: "2026-11-17T00:00:00Z", contexto: { rol: "cliente", negocio_id: "barberia", nombre_comercial: "Barbería" } };
const r: Resumen = {
  negocio: { negocio_id: "barberia", nombre_comercial: "Barbería", moneda: "MXN", decimales: 2, logo_url: null, tema_id: 1, zona_horaria: "America/Mexico_City" }, hoy: "2026-10-18", monedero: null,
  tarjetas: [{ tarjeta_digital_id: "t1", nombre: "Cortes", activa: true, en_retiro: false, tipo_sello: "por_transaccion", regla: { sellos_requeridos: 5, valor_por_sello_centavos: null, premio_texto: "Corte", vigencia_dias: null }, en_curso: null, premios_por_canjear: [] }],
};
beforeEach(() => {
  localStorage.clear(); vi.clearAllMocks();
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  mocks.totp.mockImplementation((fn: () => Promise<unknown>) => fn());
});
afterEach(() => { cleanup(); terminarCopia(); onSesion(() => {}); onSinConexion(() => {}); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("P10 horario", () => {
  const estado = { pin_pos_configurado: true, desbloqueado: true, vence_en: null, horario_aplica: true, en_horario: false };
  it("bloquea empleado fuera de horario", () => expect(fueraDeHorario("empleado", estado)).toBe(true));
  it("nunca bloquea dueño", () => expect(fueraDeHorario("dueno", estado)).toBe(false));
  it("sin horarios no restringe", () => expect(fueraDeHorario("empleado", { ...estado, horario_aplica: false })).toBe(false));
  it("dentro del horario opera", () => expect(fueraDeHorario("empleado", { ...estado, en_horario: true })).toBe(false));
  it("revisa cada 60 segundos", () => expect(INTERVALO_POS).toBe(60_000));
  it("elige domingo por la zona del negocio y conserva cruce de medianoche", () => {
    expect(horarioHoy([{ dia_semana: 0, cerrado: false, hora_apertura: "18:00:00", hora_cierre: "02:00:00" }], "America/Mexico_City", new Date("2026-10-19T01:00:00Z"))).toBe("Hoy: 18:00 a 02:00");
  });
});

describe("P10 copia autorizada", () => {
  it("guarda solo los campos permitidos y saldo null sin monedero", () => {
    const entrada = { ...persona, pin: "582047", telefono: "+525500000000" };
    actualizarCopia(entrada, { resumen: r, codigo: "4729" });
    const copia = leerCopia();
    expect(copia?.codigo_acumulacion).toBe("4729");
    expect(copia?.negocios[0]?.saldo_centavos).toBeNull();
    expect(Object.keys(copia ?? {}).sort()).toEqual(["actualizado_en", "codigo_acumulacion", "negocios", "nombre", "persona_id"]);
    expect(localStorage.getItem(LLAVE_SIN_CONEXION)).not.toContain("582047");
    expect(localStorage.getItem(LLAVE_SIN_CONEXION)).not.toContain("telefono");
  });
  it("acumula negocios sin duplicarlos y conserva código", () => {
    actualizarCopia(persona, { resumen: r, codigo: "4729" });
    actualizarCopia(persona, { resumen: { ...r, negocio: { ...r.negocio, negocio_id: "farmacia" } } });
    actualizarCopia(persona, { resumen: r });
    expect(leerCopia()?.negocios).toHaveLength(2);
    expect(leerCopia()?.codigo_acumulacion).toBe("4729");
  });
  it("borra al cambiar persona", () => {
    actualizarCopia(persona, { codigo: "4729" }); comprobarPersona("otra"); expect(leerCopia()).toBeNull();
  });
  it("tolera almacenamiento no disponible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error(); });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error(); });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => { throw new Error(); });
    expect(leerCopia()).toBeNull(); expect(() => actualizarCopia(persona, { resumen: r })).not.toThrow(); expect(borrarCopia).not.toThrow();
  });
  it("obtiene identidad y solo nombre del perfil en cada sesión y borra antes de guardar", async () => {
    actualizarCopia({ persona_id: "anterior", nombre: "Anterior" }, { codigo: "8888" });
    const fetchMock = vi.fn(async (path: string) => new Response(JSON.stringify(path === "/api/auth/sesion" ? { persona_id: "diego", rol: "cliente", negocio_id: "barberia" } : { nombre: "Diego", correo: "privado", telefono: "privado" }), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    prepararCopia(sesion); await guardarCopia({ resumen: r });
    expect(fetchMock.mock.calls.map((x) => x[0])).toEqual(["/api/auth/sesion", "/api/perfil"]);
    expect(leerCopia()?.persona_id).toBe("diego"); expect(leerCopia()?.codigo_acumulacion).toBeNull();
    prepararCopia(sesion); await guardarCopia({ codigo: "4729" }); expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it("no escribe una consulta pendiente tras cerrar sesión", async () => {
    let resolver: ((r: Response) => void) | undefined;
    vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>((resolve) => { resolver = resolve; })));
    prepararCopia(sesion); const pendiente = guardarCopia({ codigo: "4729" }); terminarCopia();
    resolver?.(new Response(JSON.stringify({ persona_id: "diego", rol: "cliente", negocio_id: "barberia" }), { headers: { "content-type": "application/json" } }));
    await pendiente; expect(leerCopia()).toBeNull();
  });
  it("no guarda para dueño", async () => {
    const f = vi.fn(); vi.stubGlobal("fetch", f); prepararCopia({ ...sesion, contexto: { ...sesion.contexto, rol: "dueno" } });
    await guardarCopia({ codigo: "4729" }); expect(f).not.toHaveBeenCalled(); expect(leerCopia()).toBeNull();
  });
});

describe("P10 conexión y sesión", () => {
  it("fetch que lanza no convierte a anónimo", async () => {
    const listener = vi.fn(); const offline = vi.fn(); onSesion(listener); onSinConexion(offline);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("network")));
    await expect(refrescar()).rejects.toBeInstanceOf(ApiError); expect(listener).not.toHaveBeenCalled(); expect(offline).toHaveBeenCalledOnce();
  });
  it("navigator offline evita fetch", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false); const f = vi.fn(); vi.stubGlobal("fetch", f);
    await expect(refrescar()).rejects.toMatchObject({ codigo: "sin_conexion" }); expect(f).not.toHaveBeenCalled();
  });
  it("401 real es anónimo", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 401 })));
    const listener = vi.fn(); onSesion(listener); await expect(refrescar()).resolves.toBeNull(); expect(listener).toHaveBeenCalledWith(null);
  });
  it("evento online vuelve a refrescar y offline conserva sesión abierta", async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError()).mockResolvedValue(new Response(JSON.stringify(sesion), { headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    function Estado() { const a = useAuth(); return <output>{a.estado}:{String(a.conectado)}</output>; }
    render(<AuthProvider><Estado /></AuthProvider>);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("sin_conexion"));
    await act(async () => { window.dispatchEvent(new Event("online")); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("autenticado:true"));
    await act(async () => { window.dispatchEvent(new Event("offline")); });
    expect(screen.getByRole("status")).toHaveTextContent("autenticado:false");
  });
});

describe("P10 worker seguro", () => {
  it.each(["id-preview--abc.lovable.app", "preview--abc.test", "lovableproject.com", "a.lovableproject.com", "a.lovableproject-dev.com", "beta.lovable.dev", "a.beta.lovable.dev", "my-saldo.lovable.app"])("omite %s", (host) => expect(permiteWorker(true, host, false, false)).toBe(false));
  it("solo producción propia, nunca marco, dev o sw off", () => {
    expect(permiteWorker(true, "misaldo.ejemplo.mx", false, false)).toBe(true);
    expect(permiteWorker(false, "misaldo.ejemplo.mx", false, false)).toBe(false);
    expect(permiteWorker(true, "misaldo.ejemplo.mx", true, false)).toBe(false);
    expect(permiteWorker(true, "misaldo.ejemplo.mx", false, true)).toBe(false);
  });
});

describe("P10 PIN", () => {
  it("nuevo PIN exactamente seis dígitos iguales en ambos campos", () => {
    expect(pinRestablecimientoValido("582047", "582047")).toBe(true);
    expect(pinRestablecimientoValido("58204", "58204")).toBe(false);
    expect(pinRestablecimientoValido("582047", "582048")).toBe(false);
    expect(pinRestablecimientoValido("abcdef", "abcdef")).toBe(false);
  });
  it("motivo de 5 a 500 caracteres", () => {
    expect(motivoPinValido("abcd")).toBe(false); expect(motivoPinValido("abcde")).toBe(true);
    expect(motivoPinValido("a".repeat(500))).toBe(true); expect(motivoPinValido("a".repeat(501))).toBe(false);
  });
  it.each(["tiene_correo", "sin_rol_negocio", "cuenta_sin_activar", "es_staff", "persona_eliminada", "propio"])("backend %s impide autorizar", async (motivo) => {
    mocks.estado.mockResolvedValue({ puede: false, motivo, enlace_vigente_hasta: null });
    render(<RestablecerPinStaff personaId="beto" nombre="Beto" abierto={false} onAbrir={() => {}} onCerrar={() => {}} />);
    await waitFor(() => expect(mocks.estado).toHaveBeenCalledWith("beto"));
    expect(screen.getByRole("button", { name: "Restablecer PIN" })).toBeDisabled(); expect(mocks.autorizar).not.toHaveBeenCalled();
  });
  it("requiere confirmación y TOTP, envía solo motivo y vuelve a consultar", async () => {
    mocks.estado.mockResolvedValue({ puede: true, motivo: null, enlace_vigente_hasta: null });
    mocks.autorizar.mockResolvedValue({ enviado: true, telefono: "+52••••••0004", expira_en: "2026-10-19T03:30:00Z" });
    render(<RestablecerPinStaff personaId="beto" nombre="Beto" abierto onAbrir={() => {}} onCerrar={() => {}} />);
    fireEvent.change(await screen.findByLabelText("Motivo"), { target: { value: "Verifiqué su identidad por llamada" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar enlace por WhatsApp" }));
    expect(mocks.autorizar).not.toHaveBeenCalled();
    const dialogo = screen.getByRole("alertdialog"); fireEvent.click(dialogo.querySelector("button:last-child") as HTMLButtonElement);
    await waitFor(() => expect(mocks.autorizar).toHaveBeenCalledWith("beto", "Verifiqué su identidad por llamada"));
    expect(mocks.totp).toHaveBeenCalledOnce(); await waitFor(() => expect(mocks.estado).toHaveBeenCalledTimes(2));
  });
});