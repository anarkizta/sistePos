"use client";

import { useMemo, useState } from "react";
import { Shield, X } from "lucide-react";

type Props = {
  open: boolean;
  requiredPermission: string;
  context?: unknown;
  onClose: () => void;
  onApproved: (authorizationId: number) => void;
};

export default function PermissionPrompt({
  open,
  requiredPermission,
  context,
  onClose,
  onApproved,
}: Props) {
  const [approverUsername, setApproverUsername] = useState("");
  const [approverCredential, setApproverCredential] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const title = useMemo(() => {
    return "Se requiere autorizacion";
  }, []);

  if (!open) return null;

  const approve = async () => {
    setError(null);
    const u = approverUsername.trim();
    if (!u || !approverCredential) {
      setError("Ingresa usuario y PIN/clave del supervisor/administrador.");
      return;
    }

    setSubmitting(true);
    try {
      // 1) crear solicitud
      const reqRes = await fetch("/api/auth/authorizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          permissionCode: requiredPermission,
          context: context ?? null,
        }),
      });
      const reqPayload = await reqRes.json().catch(() => ({}));
      if (!reqRes.ok) {
        setError(reqPayload?.error ?? "No se pudo crear la solicitud.");
        return;
      }

      const authorizationId = Number(reqPayload?.id);
      if (!Number.isFinite(authorizationId)) {
        setError("No se pudo obtener el ID de autorizacion.");
        return;
      }

      // 2) aprobar con credenciales de supervisor/admin
      const appRes = await fetch(`/api/auth/authorizations/${authorizationId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          approverUsername: u,
          approverCredential,
        }),
      });

      const appPayload = await appRes.json().catch(() => ({}));
      if (!appRes.ok) {
        setError(appPayload?.error ?? "No se pudo aprobar la solicitud.");
        return;
      }

      setApproverCredential("");
      onApproved(authorizationId);
      onClose();
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{title}</h3>
              <p className="text-xs text-slate-500">
                Permiso requerido: <span className="font-mono">{requiredPermission}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Usuario supervisor/admin
            </label>
            <input
              value={approverUsername}
              onChange={(e) => setApproverUsername(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="supervisor"
              autoComplete="username"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              PIN / Clave
            </label>
            <input
              value={approverCredential}
              onChange={(e) => setApproverCredential(e.target.value)}
              type="password"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none tracking-widest"
              placeholder="••••••"
              autoComplete="current-password"
            />
          </div>

          <div className="pt-2 flex gap-3 justify-end">
            <button
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={approve}
              disabled={submitting}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg disabled:opacity-50"
            >
              {submitting ? "Autorizando..." : "Autorizar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

