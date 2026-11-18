import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { CompletarActivacion } from "@/components/completar-activacion";
import { Alerta, AvisoPrivacidad, CampoDigitos, TarjetaEnlace } from "@/components/enlace-ui";
import { ExternalEntryLoading } from "@/components/external-entry-loading";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, telefonoE164 } from "@/lib/api/client";
import { useConsentimiento } from "@/lib/api/privacidad";
import { leerCodigoRegistro, negocioRegistro, reenviarRegistro, solicitarRegistro, verificarRegistro } from "@/lib/api/registro";
import { textoIntentos } from "@/lib/plural";

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

type Paso = { tipo: "datos" } | { tipo: "codigo"; token: string; telefono: string; version: string } |
  { tipo: "activar"; token: string; version: string } | { tipo: "ya_registrado" };

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

export function Registro() {
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
  const [paso, setPaso] = useState<Paso>({ tipo: "datos" });
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [promociones, setPromociones] = useState(false);
  const { aviso, setAviso, version, setVersion, desactualizado } = useConsentimiento();
  const [error, setError] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const [codigo, setCodigo] = useState("");
  const solicitud = useEspera();
  const reenvio = useEspera();
  const volver = (mensaje?: string) => { setPaso({ tipo: "datos" }); setCodigo(""); setTitulo(null); setError(mensaje ?? null); };
  const mensaje = (e: unknown) => e instanceof ApiError ? e.message : "Algo salió mal. Intenta de nuevo.";
  const cooldown = (e: unknown, espera: ReturnType<typeof useEspera>) => {
    if (e instanceof ApiError && e.status === 429) { espera.iniciar(e.retryAfter ?? 60); return true; }
    return false;
  };

  const solicitar = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (bloqueo.current || solicitud.segundos || !codigoNegocio) return;
    const datos = new FormData(e.currentTarget);
    const nombreLimpio = String(datos.get("nombre") ?? "").trim();
    const tel = String(datos.get("telefono") ?? "");
    setNombre(nombreLimpio); setTelefono(tel);
    if (nombreLimpio.length < 2 || nombreLimpio.length > 80) return setError("Escribe tu nombre y apellido (de 2 a 80 caracteres).");
    if (tel.replace(/\D/g, "").length !== 10) return setError("Escribe los 10 dígitos de tu teléfono.");
    if (!aviso || !version) return setError("Acepta el aviso de privacidad.");
    bloqueo.current = true; setOcupado(true); setError(null);
    try {
      const r = await solicitarRegistro({ codigo: codigoNegocio, nombre: nombreLimpio, telefono: telefonoE164(tel), acepta_aviso_privacidad: true, version_aviso: version, acepta_promociones: promociones });
      setCodigo(""); reenvio.iniciar(r.reenviar_en_seg);
      setPaso({ tipo: "codigo", token: r.token_registro, telefono: tel.replace(/\D/g, ""), version });
    } catch (err) {
      if (desactualizado(err)) setError(mensaje(err));
      else if (!cooldown(err, solicitud)) setError(mensaje(err));
    } finally { bloqueo.current = false; setOcupado(false); }
  };

  const verificar = async (valor: string) => {
    setCodigo(valor);
    if (valor.length !== 6 || paso.tipo !== "codigo" || bloqueo.current) return;
    bloqueo.current = true; setOcupado(true); setError(null);
    try {
      const r = await verificarRegistro(paso.token, valor);
      if (r.estado === "ya_registrado") setPaso({ tipo: "ya_registrado" });
      else setPaso({ tipo: "activar", token: r.token_activacion, version: paso.version });
    } catch (err) {
      setCodigo("");
      if (err instanceof ApiError && err.codigo === "token_invalido") volver("El código venció. Pide uno nuevo.");
      else if (err instanceof ApiError && err.codigo === "codigo_invalido") {
        const restantes = err.extras["intentos_restantes"];
        setError(`El código no es correcto.${typeof restantes === "number" ? ` ${textoIntentos(restantes)}` : ""}`);
      } else setError(mensaje(err));
    } finally { bloqueo.current = false; setOcupado(false); }
  };
  const reenviar = async () => {
    if (paso.tipo !== "codigo" || bloqueo.current || reenvio.segundos) return;
    bloqueo.current = true; setOcupado(true); setError(null);
    try { const r = await reenviarRegistro(paso.token); reenvio.iniciar(r.reenviar_en_seg); }
    catch (err) { if (!cooldown(err, reenvio)) setError(mensaje(err)); }
    finally { bloqueo.current = false; setOcupado(false); }
  };

  if (codigoNegocio === undefined || (codigoNegocio && negocio.isPending)) return <ExternalEntryLoading label="Estamos revisando el código." />;
  if (!codigoNegocio || negocio.isError || !negocio.data) return <TarjetaEnlace titulo="Registro no disponible" icono={<UserPlus className="size-5" />}>
    <p className="text-muted-foreground">Por ahora el registro se hace en caja: dale tu número de celular al cajero y te llegará un enlace para activar tu cuenta.</p>
    <Button asChild variant="link" className="mt-3 min-h-11 w-full whitespace-normal"><Link to="/login">¿Ya tienes cuenta? Entra aquí</Link></Button>
  </TarjetaEnlace>;

  return <TarjetaEnlace titulo={titulo ?? (paso.tipo === "ya_registrado" ? "Ya tienes cuenta en Mi Saldo Vip" : paso.tipo === "activar" ? "Activa tu cuenta" : `Únete a ${negocio.data.nombre_comercial}`)}
    {...(paso.tipo === "datos" ? { subtitulo: "Gana cashback y premios en cada compra" } : {})} icono={<UserPlus className="size-5" />}>
    {error && <Alerta>{error}</Alerta>}
    {paso.tipo === "datos" && <form onSubmit={solicitar} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2"><Label htmlFor="nombre">¿Cómo te llamas?</Label><Input id="nombre" name="nombre" autoComplete="name" maxLength={80} className="h-12 text-lg" value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
      <div className="flex flex-col gap-2"><Label htmlFor="telefono">Tu celular (10 dígitos)</Label><Input id="telefono" name="telefono" inputMode="numeric" autoComplete="tel" placeholder="55 1234 5678" className="h-12 text-lg" value={telefono} onChange={(e) => setTelefono(e.target.value.replace(/[^\d ]/g, ""))} /></div>
      <AvisoPrivacidad valor={aviso} onChange={setAviso} onVersion={setVersion} />
      <div className="flex items-start gap-3 rounded-xl p-2"><Checkbox id="promociones" checked={promociones} onCheckedChange={(v) => setPromociones(v === true)} className="mt-0.5 size-6" /><Label htmlFor="promociones" className="text-base leading-snug">Quiero recibir promociones de {negocio.data.nombre_comercial} (cumpleaños, ofertas)</Label></div>
      {solicitud.segundos > 0 && <p role="status" className="text-sm text-muted-foreground">Espera {solicitud.segundos} s para volver a intentar.</p>}
      <Button type="submit" size="lg" disabled={ocupado || solicitud.segundos > 0}>Enviarme el código</Button>
    </form>}
    {paso.tipo === "codigo" && <div className="flex flex-col gap-4">
      <p>Te enviamos un código por WhatsApp al {paso.telefono.replace(/^(\d{2})(\d{4})(\d{4})$/, "$1 $2 $3")}.</p>
      <fieldset disabled={ocupado} className="min-w-0"><CampoDigitos etiqueta="Código que te llegó (6 dígitos)" valor={codigo} onChange={(v) => { void verificar(v); }} largo={6} autoComplete="one-time-code" tecladoFisico activo onActivar={() => {}} /></fieldset>
      {reenvio.segundos > 0 && <p role="status" className="text-sm text-muted-foreground">Espera {reenvio.segundos} s para volver a intentar.</p>}
      <Button variant="secondary" size="lg" disabled={ocupado || reenvio.segundos > 0} onClick={() => void reenviar()}>Reenviar código</Button>
      <Button variant="link" disabled={ocupado} onClick={() => volver()}>Cambiar mi número</Button>
    </div>}
    {paso.tipo === "activar" && <CompletarActivacion token={paso.token} versionAvisoAceptada={paso.version} onTitulo={setTitulo} onExpirado={() => volver("Pasaron más de 15 minutos. Vuelve a pedir el código.")} />}
    {paso.tipo === "ya_registrado" && <><p className="mb-4 text-muted-foreground">Entra con tu teléfono y tu PIN. Si no lo recuerdas, usa Olvidé mi PIN.</p><Button asChild size="lg" className="w-full"><Link to="/login">Entrar</Link></Button></>}
  </TarjetaEnlace>;
}
