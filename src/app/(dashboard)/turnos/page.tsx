"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Clock, RefreshCw, Store, MonitorSmartphone } from "lucide-react";
import OpeningDenominationsFields from "@/components/OpeningDenominationsFields";
import {
  createEmptyOpeningQuantities,
  sumOpeningDenominations,
  OPENING_DENOMINATION_CONFIG,
} from "@/lib/opening-denominations";

type Terminal = { id: number; code: string; name: string; storeId: number };
type StoreRow = { id: number; code: string; name: string; terminals: Terminal[] };

type ArqueoRes = {
  shiftId: number;
  status: string;
  openingCash: number;
  salesCash: number;
  salesCard: number;
  salesTotal: number;
  expectedCashInDrawer: number;
};

type ShiftDetail = {
  id: number;
  storeId: number;
  terminalId: number;
  userId: number;
  status: string;
  openedAt: string;
  closedAt: string | null;
  openingCashAmount: string;
  openingDenominationsJson?: Record<string, number> | null;
  closingCashAmount: string | null;
  user: { displayName: string; username: string };
  terminal: { code: string; name: string };
  store: { code: string; name: string };
};

export default function TurnosPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loadingStores, setLoadingStores] = useState(true);
  const [storeId, setStoreId] = useState<number | "">("");
  const [terminalId, setTerminalId] = useState<number | "">("");
  const [openingQuantities, setOpeningQuantities] = useState(createEmptyOpeningQuantities);
  const [closingCash, setClosingCash] = useState("0");
  const [current, setCurrent] = useState<ShiftDetail | null>(null);
  const [list, setList] = useState<ShiftDetail[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [arqueo, setArqueo] = useState<ArqueoRes | null>(null);

  const terminals = useMemo(() => {
    const s = stores.find((x) => x.id === storeId);
    return s?.terminals ?? [];
  }, [stores, storeId]);

  const openingTotal = useMemo(
    () => sumOpeningDenominations(openingQuantities),
    [openingQuantities],
  );

  const loadStores = useCallback(() => {
    setLoadingStores(true);
    fetch("/api/tiendas")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error al cargar sucursales");
        return data as StoreRow[];
      })
      .then((data) => {
        setStores(data);
        if (data.length === 1) {
          setStoreId(data[0].id);
          if (data[0].terminals.length === 1) setTerminalId(data[0].terminals[0].id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoadingStores(false));
  }, []);

  const refreshShift = useCallback(() => {
    if (!storeId || !terminalId) {
      setCurrent(null);
      return;
    }
    fetch(`/api/turnos/actual?storeId=${storeId}&terminalId=${terminalId}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
        return data.shift as ShiftDetail | null;
      })
      .then(setCurrent)
      .catch(() => setCurrent(null));
  }, [storeId, terminalId]);

  const refreshList = useCallback(() => {
    const q = storeId ? `?storeId=${storeId}&limit=20` : "?limit=20";
    fetch(`/api/turnos${q}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Error");
        return data as ShiftDetail[];
      })
      .then(setList)
      .catch(() => setList([]));
  }, [storeId]);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  useEffect(() => {
    if (!current?.id) {
      setArqueo(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(`/api/turnos/${current.id}/arqueo`);
        const data = await r.json();
        if (cancelled) return;
        if (r.ok) setArqueo(data as ArqueoRes);
        else setArqueo(null);
      } catch {
        if (!cancelled) setArqueo(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [current?.id]);

  const closingCounted = Number(closingCash.replace(",", ".")) || 0;
  const diferenciaPreview =
    arqueo != null ? closingCounted - arqueo.expectedCashInDrawer : null;

  useEffect(() => {
    if (!storeId || !terminalId) return;
    localStorage.setItem("sp_context_store", String(storeId));
    localStorage.setItem("sp_context_terminal", String(terminalId));
    const t = setTimeout(() => {
      fetch("/api/auth/context", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeId, terminalId }),
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [storeId, terminalId]);

  const abrirTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!storeId || !terminalId) {
      setError("Selecciona sucursal y caja.");
      return;
    }
    if (openingTotal <= 0) {
      setError("Ingresa al menos una denominacion para que el fondo sea mayor a $0.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/turnos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeId,
          terminalId,
          openingDenominations: openingQuantities,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo abrir el turno");
      setOpeningQuantities(createEmptyOpeningQuantities());
      refreshShift();
      refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const cerrarTurno = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!current) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/turnos/${current.id}/cerrar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCashAmount: Number(closingCash.replace(",", ".")) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "No se pudo cerrar el turno");
      setClosingCash("0");
      setArqueo(null);
      const rep = data.report as
        | {
            difference: number;
            expectedCashInDrawer: number;
            salesCash: number;
          }
        | undefined;
      if (rep && typeof rep.difference === "number") {
        const sign = rep.difference === 0 ? "" : rep.difference > 0 ? "sobra" : "falta";
        const abs = Math.abs(rep.difference);
        setSuccessMsg(
          `Turno cerrado. Efectivo esperado en caja: $${Number(rep.expectedCashInDrawer).toLocaleString("es-CL")}. ` +
            (rep.difference === 0
              ? "Arqueo cuadrado."
              : `Diferencia: ${sign} $${abs.toLocaleString("es-CL")} (contado vs esperado).`),
        );
        window.setTimeout(() => setSuccessMsg(null), 12000);
      }
      refreshShift();
      refreshList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <Clock className="w-7 h-7 text-blue-500" />
            Turnos y caja
          </h1>
          <p className="text-slate-500 mt-1">
            Apertura, cierre y arqueo por sucursal y caja. Una caja solo puede tener un turno abierto.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            loadStores();
            refreshShift();
            refreshList();
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 px-4 py-3 rounded-xl text-sm">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Store className="w-5 h-5 text-slate-500" />
            Sucursal y caja
          </h2>
          {loadingStores ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : stores.length === 0 ? (
            <p className="text-amber-700 text-sm">
              No tienes sucursales asignadas. Un administrador debe vincularte en{" "}
              <code className="bg-slate-100 px-1 rounded">store_user</code> o asignarte rol supervisor.
              Ejecuta <code className="bg-slate-100 px-1 rounded">npx prisma db seed</code> para sucursal
              PRINCIPAL y enlace del admin.
            </p>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Sucursal</label>
                <select
                  value={storeId === "" ? "" : String(storeId)}
                  onChange={(e) => {
                    const v = e.target.value ? Number(e.target.value) : "";
                    setStoreId(v);
                    setTerminalId("");
                  }}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                >
                  <option value="">Seleccionar...</option>
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Caja</label>
                <select
                  value={terminalId === "" ? "" : String(terminalId)}
                  onChange={(e) => setTerminalId(e.target.value ? Number(e.target.value) : "")}
                  disabled={!storeId}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 disabled:opacity-50"
                >
                  <option value="">Seleccionar...</option>
                  {terminals.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <MonitorSmartphone className="w-5 h-5 text-slate-500" />
            Turno en esta caja
          </h2>
          {!storeId || !terminalId ? (
            <p className="text-slate-500 text-sm">Elige sucursal y caja.</p>
          ) : current ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-slate-500">Estado:</span>{" "}
                <span className="font-semibold text-emerald-600">Abierto</span>
              </p>
              <p>
                <span className="text-slate-500">Cajero:</span>{" "}
                {current.user.displayName} ({current.user.username})
              </p>
              <p>
                <span className="text-slate-500">Apertura:</span>{" "}
                {new Date(current.openedAt).toLocaleString("es-CL")}
              </p>
              <p>
                <span className="text-slate-500">Fondo inicial:</span> $
                {Number(current.openingCashAmount).toLocaleString("es-CL")}
              </p>
              {(() => {
                const j = current.openingDenominationsJson;
                if (!j || typeof j !== "object") return null;
                const rows = OPENING_DENOMINATION_CONFIG.map(({ value, label }) => {
                  const k = String(value);
                  const q = Math.floor(Number(j[k] ?? 0));
                  if (!q || q < 0) return null;
                  return (
                    <li key={k} className="flex justify-between gap-4">
                      <span>{label}</span>
                      <span>
                        {q} × ${value.toLocaleString("es-CL")} = $
                        {(q * value).toLocaleString("es-CL")}
                      </span>
                    </li>
                  );
                }).filter(Boolean);
                if (rows.length === 0) return null;
                return (
                  <details className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
                    <summary className="cursor-pointer font-medium text-slate-700">
                      Desglose por denominacion
                    </summary>
                    <ul className="mt-2 space-y-1 font-mono text-slate-600">{rows}</ul>
                  </details>
                );
              })()}
              <form onSubmit={cerrarTurno} className="pt-2 space-y-3 border-t border-slate-100">
                {arqueo && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 space-y-2 text-xs text-slate-700">
                    <p className="font-semibold text-slate-800 text-sm">Resumen para arqueo</p>
                    <div className="flex justify-between gap-2">
                      <span>Fondo de apertura</span>
                      <span className="font-mono font-medium">
                        ${arqueo.openingCash.toLocaleString("es-CL")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>Ventas en efectivo (turno)</span>
                      <span className="font-mono font-medium text-emerald-800">
                        + ${arqueo.salesCash.toLocaleString("es-CL")}
                      </span>
                    </div>
                    <div className="flex justify-between gap-2 text-slate-500">
                      <span>Ventas tarjeta (referencia, no van en caja)</span>
                      <span className="font-mono">${arqueo.salesCard.toLocaleString("es-CL")}</span>
                    </div>
                    <div className="flex justify-between gap-2 pt-2 border-t border-slate-200 font-semibold text-slate-900">
                      <span>Efectivo esperado en caja</span>
                      <span className="font-mono text-blue-700">
                        ${arqueo.expectedCashInDrawer.toLocaleString("es-CL")}
                      </span>
                    </div>
                    <p className="text-slate-500 pt-1 leading-relaxed">
                      Cuenta solo el efectivo físico y compáralo con el esperado. La diferencia debe
                      reflejar faltantes o sobrantes reales frente a apertura + cobros en efectivo.
                    </p>
                  </div>
                )}
                <label className="block text-sm font-medium text-slate-700">
                  Efectivo contado al cierre
                </label>
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={closingCash}
                  onChange={(e) => setClosingCash(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2"
                />
                {diferenciaPreview !== null && (
                  <p
                    className={`text-sm font-medium ${
                      diferenciaPreview === 0
                        ? "text-emerald-700"
                        : diferenciaPreview > 0
                          ? "text-amber-700"
                          : "text-red-700"
                    }`}
                  >
                    Diferencia (contado − esperado):{" "}
                    {diferenciaPreview === 0
                      ? "$0 — cuadrado"
                      : diferenciaPreview > 0
                        ? `+$${diferenciaPreview.toLocaleString("es-CL")} (sobra en caja)`
                        : `−$${Math.abs(diferenciaPreview).toLocaleString("es-CL")} (falta en caja)`}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 rounded-lg bg-slate-900 text-white font-medium hover:bg-slate-800 disabled:opacity-50"
                >
                  Cerrar turno
                </button>
                <p className="text-xs text-slate-400">
                  Un supervisor con permiso de arqueo puede cerrar el turno de otro cajero desde aqui
                  usando la misma accion.
                </p>
              </form>
            </div>
          ) : (
            <form onSubmit={abrirTurno} className="space-y-4">
              <p className="text-slate-500 text-sm">No hay turno abierto en esta caja.</p>
              <OpeningDenominationsFields
                quantities={openingQuantities}
                onChange={setOpeningQuantities}
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || openingTotal <= 0}
                className="w-full py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Abrir turno
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 font-semibold text-slate-800">
          Ultimos turnos {storeId ? "(sucursal seleccionada)" : "(tus turnos)"}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="p-3">ID</th>
                <th className="p-3">Cajero</th>
                <th className="p-3">Caja</th>
                <th className="p-3">Estado</th>
                <th className="p-3">Apertura</th>
                <th className="p-3">Fondo ini.</th>
                <th className="p-3">Cierre</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="p-3 font-mono">{s.id}</td>
                  <td className="p-3">{s.user.displayName}</td>
                  <td className="p-3">
                    {s.store.code}/{s.terminal.code}
                  </td>
                  <td className="p-3">
                    {s.status === "OPEN" ? (
                      <span className="text-emerald-600 font-medium">Abierto</span>
                    ) : (
                      <span className="text-slate-500">Cerrado</span>
                    )}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {new Date(s.openedAt).toLocaleString("es-CL")}
                  </td>
                  <td className="p-3">${Number(s.openingCashAmount).toLocaleString("es-CL")}</td>
                  <td className="p-3">
                    {s.closingCashAmount != null
                      ? `$${Number(s.closingCashAmount).toLocaleString("es-CL")}`
                      : "—"}
                  </td>
                </tr>
              ))}
              {list.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">
                    Sin registros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
