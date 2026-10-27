import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, ApiError } from "@/lib/api/client";

type ConTotp = <T>(fn: () => Promise<T>) => Promise<T>;
const Ctx = createContext<ConTotp>((fn) => fn());

/**
 * Wraps critical actions: on 403 `requiere_totp_reciente` asks for the authenticator code,
 * confirms it (POST /api/auth/totp/confirmacion) and retries the same call once.
 */
export function TotpProvider({ children }: { children: ReactNode }) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const pendiente = useRef<{ ok: () => void; cancelar: () => void } | null>(null);

  const conTotp = useCallback<ConTotp>(async (fn) => {
    try {
      return await fn();
    } catch (e) {
      if (!(e instanceof ApiError && e.codigo === "requiere_totp_reciente")) throw e;
      await new Promise<void>((ok, rej) => {
        pendiente.current = { ok, cancelar: () => rej(new ApiError(403, { codigo: "totp_cancelado" })) };
        setCodigo("");
        setAbierto(true);
      });
      return fn();
    }
  }, []);

  const confirmar = async () => {
    setEnviando(true);
    try {
      const body = /^\d{6}$/.test(codigo) ? { codigo } : { codigo_respaldo: codigo.trim().toUpperCase() };
      await api("/api/auth/totp/confirmacion", { method: "POST", body });
      setAbierto(false);
      pendiente.current?.ok();
      pendiente.current = null;
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "No se pudo confirmar.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Ctx.Provider value={conTotp}>
      {children}
      <Dialog
        open={abierto}
        onOpenChange={(o) => {
          if (!o) {
            pendiente.current?.cancelar();
            pendiente.current = null;
          }
          setAbierto(o);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" /> Confirma con tu app autenticadora
            </DialogTitle>
            <DialogDescription>Escribe el código de 6 dígitos de tu app o un código de respaldo.</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            className="h-12 text-center font-mono text-xl tracking-[0.3em]"
            placeholder="000000"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.slice(0, 20))}
            onKeyDown={(e) => e.key === "Enter" && codigo && void confirmar()}
          />
          <Button size="lg" disabled={!codigo || enviando} onClick={() => void confirmar()}>
            {enviando ? "Confirmando…" : "Confirmar y continuar"}
          </Button>
        </DialogContent>
      </Dialog>
    </Ctx.Provider>
  );
}

export const useConTotp = () => useContext(Ctx);
