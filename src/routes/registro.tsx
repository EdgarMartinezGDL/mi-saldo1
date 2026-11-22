import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { Alerta, AvisoPrivacidad, TarjetaEnlace } from "@/components/enlace-ui";
import { ExternalEntryLoading } from "@/components/external-entry-loading";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CLAVE_REGISTRO } from "@/components/retomar-registro";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import { cambiarContexto, logout } from "@/lib/api/auth";
import { useConsentimiento } from "@/lib/api/privacidad";
import { leerCodigoRegistro, negocioRegistro, solicitarRegistro, unirmeNegocio, type RegistroSolicitado } from "@/lib/api/registro";
import { guardarTelefonoPrellenado } from "@/lib/telefono-prellenado";

export const Route = createFileRoute("/registro")({
  head: () => ({ meta: [
    { title: "Regístrate · Mi Saldo Vip" },
    { name: "description", content: "Regístrate en tu negocio y activa tu cuenta de Mi Saldo Vip." },
    { property: "og:title", content: "Regístrate · Mi Saldo Vip" },
    { property: "og:description", content: "Regístrate en tu negocio y activa tu cuenta de Mi Saldo Vip." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Registro,
});

/** Cooldowns use a deadline so a background tab cannot extend the server's waiting time. */
function useEspera() {
  const [hasta, setHasta] = useState(0);
  const [ahora, setAhora] = useState(0);
  const segundos = Math.max(0, Math.ceil((hasta - ahora) / 1000));
  useEffect(() => {
    if (!hasta) return;
    const tick = () => setAhora(Date.now());
    tick();
    const timer = window.setInterval(tick, 250);
    return () => window.clearInterval(timer);
  }, [hasta]);
  return { segundos, iniciar: (n: number) => { const now = Date.now(); setAhora(now); setHasta(now + Math.max(0, n) * 1000); } };
}

const formatoTel = (t: string) => { const d = t.replace(/\D/g, ""); return [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join(" "); };
const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function nacimientoValido(dia: number, mes: number) {
  const limite = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][mes - 1];
  return limite !== undefined && Number.isInteger(dia) && Number.isInteger(mes) && dia >= 1 && dia <= limite;
}

export function Registro() {
  const { sesion, estado } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [codigoNegocio, setCodigoNegocio] = useState<string | null | undefined>();
  const leido = useRef(false);
  useEffect(() => {
    if (leido.current) return;
    leido.current = true;
    const codigo = leerCodigoRegistro(window.location.hash);
    history.replaceState(history.state, "", window.location.pathname + window.location.search);
    setCodigoNegocio(codigo);
  }, []);
  const negocio = useQuery({ queryKey: ["registro-negocio", codigoNegocio], queryFn: () => negocioRegistro(codigoNegocio ?? ""), enabled: !!codigoNegocio, retry: false });
  const [resultado, setResultado] = useState<RegistroSolicitado | null>(null);
  const [datos, setDatos] = useState({ nombre: "", apellido_paterno: "", apellido_materno: "", telefono: "", nacimiento_dia: "", nacimiento_mes: "", correo: "" });
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [error, setError] = useState<string | null>(null);
  const [noDisponible, setNoDisponible] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const solicitud = useEspera();
  const iniciarSesion = (telefono?: string) => {
    try { if (codigoNegocio) sessionStorage.setItem(CLAVE_REGISTRO, codigoNegocio); } catch { /* Optional device storage. */ }
    guardarTelefonoPrellenado(telefono ?? "");
    void navigate({ to: "/login" });
  };
  const manejarError = (err: unknown) => {
    if (err instanceof ApiError) {
      if (err.status === 404) return setNoDisponible(true);
      if (err.status === 401) return iniciarSesion();
      if (err.status === 429) { solicitud.iniciar(err.retryAfter ?? 60); return; }
      if (err.codigo === "tope_negocio") return setError("Este negocio tiene muchas solicitudes pendientes: pide al cajero que te registre con tu número.");
      if (err.codigo === "nacimiento_invalido") return setError("Esa fecha no existe");
      if (err.codigo === "cliente_dado_de_baja") return setError("Ya fuiste cliente de este negocio y se dio de baja: acude con el negocio para revisarlo.");
      desactualizado(err);
    }
    setError(err instanceof ApiError ? err.message : "Algo salió mal. Intenta de nuevo.");
  };
  const solicitar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (bloqueo.current || solicitud.segundos || !codigoNegocio) return;
    const form = new FormData(e.currentTarget);
    const nuevos = Object.fromEntries(Object.keys(datos).map((key) => [key, String(form.get(key) ?? "").trim()])) as typeof datos;
    setDatos(nuevos);
    if (![nuevos.nombre, nuevos.apellido_paterno].every((v) => v.length >= 1 && v.length <= 100) || nuevos.apellido_materno.length > 100) return setError("Escribe tu nombre y apellido (de 1 a 100 caracteres).");
    if (nuevos.telefono.replace(/\D/g, "").length !== 10) return setError("Escribe los 10 dígitos de tu teléfono.");
    if (!nuevos.nacimiento_dia || !nuevos.nacimiento_mes) return setError("Elige el día y el mes de tu cumpleaños.");
    if (!nacimientoValido(Number(nuevos.nacimiento_dia), Number(nuevos.nacimiento_mes))) return setError("Esa fecha no existe");
    if (nuevos.correo.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nuevos.correo)) return setError("Revisa tu correo electrónico.");
    if (!aviso || !version) return setError("Acepta el aviso de privacidad.");
    bloqueo.current = true; setOcupado(true); setError(null);
    try {
      setResultado(await solicitarRegistro({ codigo: codigoNegocio, nombre: nuevos.nombre, apellido_paterno: nuevos.apellido_paterno,
        ...(nuevos.apellido_materno ? { apellido_materno: nuevos.apellido_materno } : {}), telefono: telefonoE164(nuevos.telefono),
        nacimiento_dia: Number(nuevos.nacimiento_dia), nacimiento_mes: Number(nuevos.nacimiento_mes), correo: nuevos.correo,
        acepta_aviso_privacidad: true, version_aviso: version }));
    } catch (err) { manejarError(err); }
    finally { bloqueo.current = false; setOcupado(false); }
  };
  const unirme = async () => {
    if (bloqueo.current || solicitud.segundos || !codigoNegocio || !aviso || !version) return;
    bloqueo.current = true; setOcupado(true); setError(null);
    try {
      const r = await unirmeNegocio(codigoNegocio, version);
      try { await cambiarContexto({ rol: "cliente", negocio_id: r.negocio_id }); }
      catch (err) { if (!(err instanceof ApiError && err.status === 409 && err.codigo === "mismo_contexto")) throw err; }
      queryClient.clear();
      await navigate({ to: "/" });
      toast.success(`Ya eres cliente de ${r.nombre_comercial}`);
    } catch (err) { manejarError(err); }
    finally { bloqueo.current = false; setOcupado(false); }
  };
  if (codigoNegocio === undefined || (codigoNegocio && negocio.isPending) || estado === "comprobando") return <ExternalEntryLoading label="Estamos revisando el código." />;
  if (!codigoNegocio || negocio.isError || !negocio.data || noDisponible) return <TarjetaEnlace titulo="Registro no disponible" icono={<UserPlus className="size-5" />}>
    <p className="text-muted-foreground">Este código ya no funciona. Pide al negocio su QR nuevo o dale tu número de celular al cajero.</p>
    <Button asChild variant="link" className="mt-3 min-h-11 w-full whitespace-normal"><Link to="/login">¿Ya tienes cuenta? Entra aquí</Link></Button>
  </TarjetaEnlace>;
  const nombreNegocio = negocio.data.nombre_comercial;
  const cambiarDato = (key: keyof typeof datos, value: string) => setDatos((d) => ({ ...d, [key]: value }));
  const privacidad = <AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} />;
  const espera = solicitud.segundos > 0 && <p role="status" className="text-sm text-muted-foreground">Espera {solicitud.segundos} s para volver a intentar.</p>;
  return <TarjetaEnlace titulo={sesion ? `¿Unirte a ${nombreNegocio}?` : resultado?.estado === "pendiente" ? `¡Listo, ${datos.nombre}!` : resultado?.estado === "cuenta_existente" ? "Ya existe una cuenta con este número" : `Únete a ${nombreNegocio}`}
    {...(!sesion && !resultado ? { subtitulo: "Gana cashback y premios en cada compra" } : {})} icono={<UserPlus className="size-5" />}>
    {error && <Alerta>{error}</Alerta>}
    {sesion ? <div className="flex flex-col gap-4">
      <p>Quedarás como cliente de {nombreNegocio} para ganar cashback y premios. Tu cuenta y tus otros negocios siguen igual.</p>
      {privacidad}{espera}
      <Button className="min-h-12" disabled={ocupado || !aviso || !version || solicitud.segundos > 0} onClick={() => void unirme()}>{ocupado ? "Enviando…" : "Unirme"}</Button>
      <Button variant="link" className="min-h-11 whitespace-normal" disabled={ocupado} onClick={async () => {
        setOcupado(true); try { await logout(); } catch { /* logout clears the local session even if offline. */ }
        finally { setResultado(null); setAviso(false); setError(null); setOcupado(false); }
      }}>No soy yo: cerrar sesión</Button>
    </div> : resultado?.estado === "pendiente" ? <div className="flex flex-col gap-4">
      <div><p>Dile este número al cajero:</p><p className="mt-1 font-mono text-[28px] font-bold tabular-nums tracking-wider sm:text-3xl">{formatoTel(datos.telefono)}</p></div>
      <p>Cuando vayas a <strong>{nombreNegocio}</strong>, dale tu número de celular al cajero para activar tu registro.</p>
      <p>Tienes hasta el {new Date(resultado.expira_en).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })} (24 horas). Después tendrás que llenarlo otra vez.</p>
      <p className="text-sm text-muted-foreground">Toma una captura de esta pantalla para tenerla a la mano.</p>
      <p>Al aprobarlo te llegará un WhatsApp para activar tu app.</p>
      <Button variant="secondary" className="min-h-12" onClick={() => { setResultado(null); setError(null); }}>Corregir mis datos</Button>
    </div> : resultado?.estado === "cuenta_existente" ? <div className="flex flex-col gap-4">
      <p>Entra con tu número y tu PIN de acceso (6 dígitos) para unirte a {nombreNegocio}.</p>
      <Button className="min-h-12" onClick={() => iniciarSesion(datos.telefono.replace(/\D/g, ""))}>Iniciar sesión</Button>
      <Button asChild variant="secondary" className="min-h-12"><Link to="/recuperar" onClick={() => guardarTelefonoPrellenado(datos.telefono)}>Olvidé mi PIN de acceso</Link></Button>
      <Button asChild variant="secondary" className="min-h-12"><Link to="/activar">Nunca activé mi cuenta</Link></Button>
      <p className="text-sm text-muted-foreground">También puedes pedirle al cajero que te registre con tu número.</p>
    </div> : <form noValidate onSubmit={solicitar} className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-base font-bold">¿Cómo funciona?</p>
        <ol className="flex flex-col gap-2">
          {["Llena tus datos aquí.", `En tu próxima compra en ${nombreNegocio}, dale tu número de celular al cajero.`, "Te llega un WhatsApp para activar tu app y empiezas a ganar cashback."].map((paso, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-foreground">
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{i + 1}</span>
              <span className="min-w-0 break-words">{paso}</span>
            </li>
          ))}
        </ol>
      </div>
      <div className="border-b border-border pb-3"><Button type="button" variant="secondary" className="min-h-12 h-auto w-full whitespace-normal py-3" onClick={() => iniciarSesion(datos.telefono.replace(/\D/g, ""))}>¿Ya tienes Mi Saldo Vip? Inicia sesión</Button></div>
      {([['nombre', 'Nombre', 'given-name'], ['apellido_paterno', 'Apellido paterno', 'family-name'], ['apellido_materno', 'Apellido materno (opcional)', 'additional-name']] as const).map(([key, label, autocomplete]) => <div key={key} className="flex flex-col gap-2"><Label htmlFor={key}>{label}</Label><Input id={key} name={key} required={key !== "apellido_materno"} maxLength={100} autoComplete={autocomplete} className="h-12 text-base md:text-base" value={datos[key]} onChange={(e) => cambiarDato(key, e.target.value)} /></div>)}
      <div className="flex flex-col gap-2"><Label htmlFor="telefono">Tu celular (10 dígitos)</Label><Input id="telefono" name="telefono" inputMode="numeric" autoComplete="tel" placeholder="55 1234 5678" className="h-14 text-xl md:text-xl" value={datos.telefono} onChange={(e) => cambiarDato("telefono", e.target.value.replace(/[^\d ]/g, ""))} /></div>
      <fieldset className="min-w-0"><legend className="mb-2 font-medium">Tu cumpleaños</legend><div className="grid grid-cols-2 gap-3">
        {([['nacimiento_dia', 'Día'], ['nacimiento_mes', 'Mes']] as const).map(([key, label]) => <div key={key} className="flex min-w-0 flex-col gap-2"><Label htmlFor={key}>{label}</Label><select id={key} name={key} required value={datos[key]} onChange={(e) => cambiarDato(key, e.target.value)} className="h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-ring"><option value="">{label}</option>{key === "nacimiento_dia" ? Array.from({ length: 31 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}</option>) : meses.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}</select></div>)}
      </div><p className="mt-2 text-sm text-muted-foreground">Solo día y mes, para tus promociones de cumpleaños</p></fieldset>
      <div className="flex flex-col gap-2"><Label htmlFor="correo">Correo electrónico</Label><Input id="correo" name="correo" required type="email" autoComplete="email" maxLength={255} className="h-12 text-base md:text-base" value={datos.correo} onChange={(e) => cambiarDato("correo", e.target.value)} /><p className="text-sm text-muted-foreground">Te avisamos aquí si WhatsApp falla</p></div>
      {privacidad}{espera}<Button type="submit" className="min-h-12" disabled={ocupado || solicitud.segundos > 0}>{ocupado ? "Enviando…" : "Enviar mi registro"}</Button>
    </form>}
  </TarjetaEnlace>;
}
