/** "1 sello" / "2 sellos". */
export const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;
