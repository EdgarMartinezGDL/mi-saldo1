import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronRight } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/components/auth-provider";
import { useMiSaldo } from "@/components/misaldo-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cambiarContexto, contextos, type ContextoDisponible } from "@/lib/api/auth";
import { ApiError, type Rol } from "@/lib/api/client";
import { cn } from "@/lib/utils";

export const ROL_TEXTO: Record<Rol, string> = { cliente: "Cliente", empleado: "Empleado", dueno: "Dueño", staff: "Staff MiSaldo" };
const INICIO: Record<Rol, string> = { cliente: "/", empleado: "/caja", dueno: "/panel", staff: "/staff" };

export const etiquetaContexto = (c: Pick<ContextoDisponible, "rol" | "nombre_comercial">) =>
  c.rol === "staff" || !c.nombre_comercial ? ROL_TEXTO[c.rol] : `${c.nombre_comercial} · ${ROL_TEXTO[c.rol]}`;

/** One shared ["contextos"] query per session. */
export function useContextos() {
  const { estado } = useAuth();
  const q = useQuery({
    queryKey: ["contextos"],
    queryFn: contextos,
    enabled: estado === "autenticado",
    staleTime: 5 * 60_000,
  });
  const lista = q.data?.contextos ?? [];
  return { ...q, lista, varios: lista.length > 1 };
}

type Falta = { pin: boolean; totp: boolean };

/** "Mis negocios": Sheet from the bottom on mobile, Dialog on desktop. */
export function useMisNegocios(): { abrir: () => void; varios: boolean; dialogo: ReactNode } {
  const [abierto, setAbierto] = useState(false);
  const { varios } = useContextos();
  return {
    abrir: () => setAbierto(true),
    varios,
    dialogo: <MisNegocios abierto={abierto} onCambio={setAbierto} />,
  };
}

function MisNegocios({ abierto, onCambio }: { abierto: boolean; onCambio: (v: boolean) => void }) {
  const movil = useIsMobile();
  const titulo = "Mis negocios";
  const desc = "Cambia de negocio o de perfil sin cerrar sesión.";
  const cuerpo = <Selector onCerrar={() => onCambio(false)} abierto={abierto} />;
  if (movil) {
    return (
      <Sheet open={abierto} onOpenChange={onCambio}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="text-xl">{titulo}</SheetTitle>
            <SheetDescription>{desc}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{cuerpo}</div>
        </SheetContent>
      </Sheet>
    );
  }
  return (
    <Dialog open={abierto} onOpenChange={onCambio}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">{titulo}</DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        {cuerpo}
      </DialogContent>
    </Dialog>
  );
}

function Selector({ onCerrar, abierto }: { onCerrar: () => void; abierto: boolean }) {
  const { lista, isLoading, refetch } = useContextos();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { updateBusiness } = useMiSaldo();
  const [elegido, setElegido] = useState<ContextoDisponible | null>(null);
  const [falta, setFalta] = useState<Falta>({ pin: false, totp: false });
  const [pin, setPin] = useState("");
  const [codigo, setCodigo] = useState("");
  const [respaldo, setRespaldo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [esperaHasta, setEsperaHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now());
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (!abierto) {
      setElegido(null);
      setPin("");
      setCodigo("");
      setAviso(null);
    }
  }, [abierto]);

  useEffect(() => {
    if (esperaHasta <= Date.now()) return;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [esperaHasta]);
  const espera = Math.max(0, Math.ceil((esperaHasta - ahora) / 1000));

  const elegir = (c: ContextoDisponible) => {
    setElegido(c);
    setFalta({ pin: c.requiere_pin, totp: c.requiere_totp });
    setPin("");
    setCodigo("");
    setRespaldo(false);
    setAviso(null);
    if (!c.requiere_pin && !c.requiere_totp) void cambiar(c, { pin: false, totp: false });
  };

  const cambiar = async (c: ContextoDisponible, f: Falta) => {
    setOcupado(true);
    setAviso(null);
    try {
      const body: Parameters<typeof cambiarContexto>[0] = { rol: c.rol, negocio_id: c.negocio_id };
      if (f.pin) body.pin = pin;
      if (f.totp) {
        if (respaldo) body.codigo_respaldo = codigo.trim().toUpperCase();
        else body.codigo_totp = codigo;
      }
      const s = await cambiarContexto(body);
      queryClient.clear();
      updateBusiness({ name: s.contexto.nombre_comercial ?? "MiSaldo", logo: null });
      toast.success(`Ahora estás en ${etiquetaContexto(s.contexto)}`);
      onCerrar();
      void navigate({ to: INICIO[s.contexto.rol], replace: true });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      const r = err?.extras["intentos_restantes"];
      const intentos = typeof r === "number" ? ` Te quedan ${r} intentos.` : "";
      switch (err?.codigo) {
        case "requiere_pin":
          setFalta((x) => ({ ...x, pin: true }));
          setAviso("Escribe tu PIN de acceso para continuar.");
          break;
        case "requiere_totp":
          setFalta((x) => ({ ...x, totp: true }));
          setAviso("Escribe el código de tu app autenticadora.");
          break;
        case "pin_incorrecto":
          setPin("");
          setAviso(`PIN incorrecto.${intentos}`);
          break;
        case "codigo_incorrecto":
          setCodigo("");
          setAviso(`El código no es correcto.${intentos}`);
          break;
        case "mismo_contexto":
          onCerrar();
          break;
        case "contexto_no_disponible":
          setElegido(null);
          setAviso("Ya no tienes acceso a ese negocio.");
          void refetch();
          break;
        case "requiere_enrolamiento_totp":
          setAviso("Cierra sesión y entra como Staff para registrar tu app.");
          break;
        default:
          if (err?.status === 401) {
            onCerrar();
            void navigate({ to: "/login", replace: true });
          } else if (err?.status === 429) {
            setEsperaHasta(Date.now() + (err.retryAfter ?? 60) * 1000);
            setAhora(Date.now());
            setAviso(err.message);
          } else {
            setAviso(err?.message ?? "No se pudo cambiar. Intenta de nuevo.");
          }
      }
    } finally {
      setOcupado(false);
    }
  };

  if (isLoading) return <p className="py-6 text-center text-muted-foreground">Cargando…</p>;

  if (elegido) {
    const listo = (!falta.pin || (pin.length >= 4 && pin.length <= 128)) && (!falta.totp || (respaldo ? codigo.trim().length >= 8 : /^\d{6}$/.test(codigo)));
    return (
      <form
        className="mt-2 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (listo && !ocupado && !espera) void cambiar(elegido, falta);
        }}
      >
        <p className="rounded-xl bg-secondary px-4 py-3 text-base font-semibold">{etiquetaContexto(elegido)}</p>
        {falta.pin && (
          <label className="flex flex-col gap-2 text-base font-medium">
            Tu PIN de acceso
            <Input
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              maxLength={128}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="h-14 text-center font-mono text-xl tracking-[0.4em]"
            />
          </label>
        )}
        {falta.totp && (
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-2 text-base font-medium">
              {respaldo ? "Código de respaldo" : "Código de tu app autenticadora"}
              <Input
                inputMode={respaldo ? "text" : "numeric"}
                autoComplete="one-time-code"
                maxLength={respaldo ? 11 : 6}
                value={codigo}
                onChange={(e) => setCodigo(respaldo ? e.target.value : e.target.value.replace(/\D/g, ""))}
                className="h-14 text-center font-mono text-xl tracking-[0.3em]"
              />
            </label>
            <button type="button" className="self-start text-sm text-primary underline-offset-4 hover:underline" onClick={() => { setRespaldo((v) => !v); setCodigo(""); }}>
              {respaldo ? "Usar el código de la app" : "Usar un código de respaldo"}
            </button>
          </div>
        )}
        {aviso && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{aviso}</p>}
        <div className="flex flex-col gap-2 sm:flex-row-reverse">
          <Button type="submit" size="lg" className="h-14 flex-1 text-base" disabled={!listo || ocupado || espera > 0}>
            {ocupado ? "Cambiando…" : espera ? `Espera ${espera} s` : "Cambiar"}
          </Button>
          <Button type="button" variant="outline" size="lg" className="h-14 flex-1 text-base" disabled={ocupado} onClick={() => setElegido(null)}>
            Volver a la lista
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {aviso && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-medium text-destructive">{aviso}</p>}
      {ocupado && <p className="text-center text-sm text-muted-foreground">Cambiando…</p>}
      {lista.map((c) => (
        <button
          key={`${c.rol}-${c.negocio_id ?? "global"}`}
          type="button"
          disabled={c.actual || ocupado}
          onClick={() => elegir(c)}
          aria-current={c.actual ? "true" : undefined}
          className={cn(
            "tap-target flex min-h-14 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-base transition-colors",
            c.actual ? "bg-primary/12 font-semibold text-primary" : "bg-secondary shadow-soft hover:text-primary",
          )}
        >
          <span className="min-w-0 flex-1 truncate">{etiquetaContexto(c)}</span>
          {c.actual ? <Check className="size-5 shrink-0" aria-label="Actual" /> : <ChevronRight className="size-5 shrink-0 text-muted-foreground" />}
        </button>
      ))}
    </div>
  );
}
