/** "1 sello" / "2 sellos". */
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** "Te queda 1 intento" / "Te quedan 3 intentos" (sin punto final). */
export const textoIntentos = (n: number) => (n === 1 ? "Te queda 1 intento" : `Te quedan ${n} intentos`);
