import { Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { NumericKeypad } from "@/components/numeric-keypad";
import { Button } from "@/components/ui/button";
import { buscarCliente, type ClienteCaja } from "@/lib/api/caja";
import { telefonoE164 } from "@/lib/api/client";
import { avisarError, useCaja } from "./caja-contexto";

import { Tecla, useConMouse, useDigitos, useFocoCaja, useTecla } from "./teclado";

const formato = (d: string) => [d.slice(0, 2), d.slice(2, 6), d.slice(6, 10)].filter(Boolean).join(" ");

export function PasoBuscar({ inicial, onEncontrado, onAlta }: { inicial: string; onEncontrado: (tel: string, c: ClienteCaja) => void; onAlta: (tel: string) => void }) {
  const conMouse = useConMouse();
  useFocoCaja();
  const { ejecutar, moneda } = useCaja();
  const [tel, setTel] = useState(inicial);
  const [noExiste, setNoExiste] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const buscar = async () => {
    if (ocupado || tel.length !== 10) return;
    setOcupado(true);
    try {
      const r = await ejecutar(() => buscarCliente(telefonoE164(tel)));
      if (r.encontrado) onEncontrado(tel, r);
      else setNoExiste(true);
    } catch (e) {
      avisarError(e, moneda);
    } finally {
      setOcupado(false);
    }
  };

  const onKey = (k: string) => {
    if (ocupado) return;
    setNoExiste(false);
    if (k === "borrar") setTel((p) => p.slice(0, -1));
    else if (k === "limpiar") setTel("");
    else setTel((p) => p.length < 10 ? p + k : p);
  };
  useDigitos(onKey, { activo: !ocupado });
  useTecla((e) => {
    if (e.key === "Escape") { onKey("limpiar"); return true; }
    if (e.key === "Enter" && tel.length === 10) {
      if (noExiste) onAlta(tel); else void buscar();
      return true;
    }
    return false;
  }, { activo: !ocupado });
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-5">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Buscar cliente</h1>
        <p className="mt-1 text-base text-muted-foreground">{conMouse ? "Escribe los 10 dígitos de su teléfono con el teclado y presiona Enter." : "Escribe los 10 dígitos de su teléfono."}</p>
      </div>
      <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
        <p className="text-sm uppercase tracking-[0.12em] text-muted-foreground">Teléfono del cliente</p>
        <p className="mt-2 min-h-[3.5rem] font-mono text-4xl font-bold tabular-nums tracking-wider">
          {formato(tel) || <span className="text-muted-foreground">55 0000 0000</span>}
        </p>
        <NumericKeypad compacto={conMouse} className="mt-4" onKey={onKey} />
        <Button size="lg" className="mt-4 h-14 w-full text-lg" disabled={ocupado || tel.length !== 10} onClick={() => void buscar()}>
          <Search className="size-5" /> {ocupado ? "Buscando…" : "Buscar"}<Tecla>Enter</Tecla>
        </Button>
      </div>
      {noExiste && (
        <div className="rounded-2xl bg-card p-5 ring-1 ring-border">
          <p className="text-lg font-semibold">Este teléfono aún no es cliente</p>
          <p className="mt-1 text-muted-foreground">Puedes darlo de alta ahora mismo.</p>
          <Button size="lg" className="mt-4 h-14 w-full text-lg" onClick={() => onAlta(tel)}>
            <UserPlus className="size-5" /> Dar de alta<Tecla>Enter</Tecla>
          </Button>
        </div>
      )}
    </div>
  );
}
