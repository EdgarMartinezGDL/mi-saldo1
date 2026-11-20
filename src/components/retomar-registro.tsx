import { useEffect } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/components/auth-provider";

export const CLAVE_REGISTRO = "misaldo:registro-pendiente";

/** Wait for login/context/TOTP navigation before consuming the one-shot return code. */
export function RetomarRegistro() {
  const { sesion } = useAuth();
  const navigate = useNavigate();
  const estado = useRouterState({ select: (s) => s.status });
  const ruta = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => {
    if (!sesion || estado === "pending") return;
    const timer = window.setTimeout(() => {
      try {
        const codigo = sessionStorage.getItem(CLAVE_REGISTRO);
        if (codigo === null) return;
        sessionStorage.removeItem(CLAVE_REGISTRO);
        if (/^[A-Za-z0-9_-]{6,32}$/.test(codigo)) void navigate({ to: "/registro", hash: `c=${encodeURIComponent(codigo)}`, replace: true });
      } catch { /* Storage may be unavailable on this device. */ }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [sesion, estado, ruta, navigate]);
  return null;
}