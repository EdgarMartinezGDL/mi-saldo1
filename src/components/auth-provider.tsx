import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { onSesion, onSinConexion, refrescar, type Sesion } from "@/lib/api/client";
import { useMiSaldo } from "@/components/misaldo-provider";
import { prepararCopia } from "@/lib/sin-conexion-sesion";

type Estado = "comprobando" | "autenticado" | "anonimo" | "sin_conexion";
type AuthState = { estado: Estado; sesion: Sesion | null; conectado: boolean; reintentar: () => Promise<void> };

const AuthContext = createContext<AuthState>({ estado: "comprobando", sesion: null, conectado: true, reintentar: async () => {} });

/** Session lives only in memory; on load it is recovered via the HttpOnly refresh cookie. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ estado: Estado; sesion: Sesion | null }>({ estado: "comprobando", sesion: null });
  const [conectado, setConectado] = useState(true);
  const { setRole, updateBusiness } = useMiSaldo();
  const reintentar = async () => { try { await refrescar(); } catch { /* Offline listener keeps the retry screen. */ } };

  useEffect(() => {
    onSesion((s) => {
      prepararCopia(s);
      setState({ estado: s ? "autenticado" : "anonimo", sesion: s });
      if (s) setRole(s.contexto.rol);
      if (s?.contexto.nombre_comercial) updateBusiness({ name: s.contexto.nombre_comercial });
    });
    onSinConexion(() => setState((s) => ({ ...s, estado: "sin_conexion" })));
    const offline = () => setConectado(false);
    const online = () => { setConectado(true); void reintentar(); };
    setConectado(navigator.onLine);
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    void reintentar();
    return () => {
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
      onSesion(() => {});
      onSinConexion(() => {});
    };
  }, [setRole, updateBusiness]);

  return <AuthContext.Provider value={{ ...state, conectado, reintentar }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
