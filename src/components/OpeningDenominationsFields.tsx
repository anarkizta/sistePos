"use client";

import {
  OPENING_DENOMINATION_CONFIG,
  sumOpeningDenominations,
} from "@/lib/opening-denominations";

type Props = {
  quantities: Record<string, number>;
  onChange: (next: Record<string, number>) => void;
  disabled?: boolean;
};

export default function OpeningDenominationsFields({
  quantities,
  onChange,
  disabled = false,
}: Props) {
  const total = sumOpeningDenominations(quantities);

  const setQty = (key: string, raw: string) => {
    if (raw === "") {
      onChange({ ...quantities, [key]: 0 });
      return;
    }
    const n = Math.trunc(Number(raw));
    if (!Number.isFinite(n) || n < 0) return;
    onChange({ ...quantities, [key]: n });
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-600">
        Cantidad de billetes y monedas del fondo inicial (para cambio). El total se calcula solo.
      </p>
      <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-100 text-slate-600 text-left text-xs uppercase tracking-wide">
              <th className="px-3 py-2 font-medium">Denominacion</th>
              <th className="px-3 py-2 font-medium w-28">Cantidad</th>
              <th className="px-3 py-2 font-medium text-right w-32">Subtotal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {OPENING_DENOMINATION_CONFIG.map(({ value, label, kind }) => {
              const key = String(value);
              const qty = quantities[key] ?? 0;
              const subtotal = value * qty;
              return (
                <tr key={key} className="hover:bg-slate-50/80">
                  <td className="px-3 py-2">
                    <span className="text-slate-800">{label}</span>
                    <span className="ml-2 text-xs text-slate-400 capitalize">({kind})</span>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      min={0}
                      step={1}
                      inputMode="numeric"
                      disabled={disabled}
                      value={qty}
                      onChange={(e) => setQty(key, e.target.value)}
                      className="w-full border border-slate-200 rounded-md px-2 py-1.5 text-right font-mono disabled:opacity-50"
                    />
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-slate-700">
                    ${subtotal.toLocaleString("es-CL")}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 rounded-lg bg-blue-50 border border-blue-100 px-4 py-3">
        <span className="text-sm font-medium text-blue-900">Total fondo de apertura</span>
        <span className="text-lg font-bold text-blue-950 tabular-nums">
          ${total.toLocaleString("es-CL")}
        </span>
      </div>
    </div>
  );
}
