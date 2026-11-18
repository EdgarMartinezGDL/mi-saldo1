/**
 * Brand name as a lockup: "Mi Saldo" at the surrounding title weight,
 * "Vip" smaller and quieter, aligned to the baseline.
 * In running text and page titles write it plainly: "Mi Saldo Vip".
 */
export function MarcaMiSaldo() {
  return (
    <span>
      Mi Saldo
      <span className="ml-1 align-baseline text-[0.7em] [font-size:max(12px,0.7em)] font-medium">Vip</span>
    </span>
  );
}
