"use client";

import { useEffect, useMemo, useState } from "react";
import { Lock, User as UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  username: string;
  displayName: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [username, setUsername] = useState("");
  const [credential, setCredential] = useState("");
  const [rememberSelection, setRememberSelection] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lockHint, setLockHint] = useState<string | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("sp_login_username");
    if (saved) setUsername(saved);
  }, []);

  useEffect(() => {
    setLoadingUsers(true);
    fetch("/api/usuarios")
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudieron cargar los usuarios");
        return r.json();
      })
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    const u = username.trim();
    if (!u) {
      setLockHint(null);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/auth/login-status?username=${encodeURIComponent(u)}`)
        .then((r) => r.json())
        .then((data) => {
          if (data?.locked && data?.message) setLockHint(String(data.message));
          else setLockHint(null);
        })
        .catch(() => setLockHint(null));
    }, 400);
    return () => clearTimeout(t);
  }, [username]);

  const selectedUser = useMemo(
    () => users.find((u) => u.username === username) ?? null,
    [users, username],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const u = username.trim();
    if (!u || !credential) {
      setError("Selecciona un usuario e ingresa tu PIN/clave.");
      return;
    }

    setSubmitting(true);
    try {
      const lsStore = typeof window !== "undefined" ? localStorage.getItem("sp_context_store") : null;
      const lsTerm = typeof window !== "undefined" ? localStorage.getItem("sp_context_terminal") : null;
      const payloadBody: Record<string, unknown> = { username: u, credential };
      if (
        lsStore &&
        lsTerm &&
        Number.isFinite(Number(lsStore)) &&
        Number.isFinite(Number(lsTerm))
      ) {
        payloadBody.storeId = Number(lsStore);
        payloadBody.terminalId = Number(lsTerm);
      }

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payloadBody),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        let msg = payload?.error ?? "No se pudo iniciar sesión.";
        if (
          res.status === 401 &&
          typeof payload?.attemptsRemaining === "number" &&
          payload.attemptsRemaining >= 0
        ) {
          msg += ` Intentos restantes en esta ventana: ${payload.attemptsRemaining}.`;
        }
        setError(msg);
        if (u) {
          fetch(`/api/auth/login-status?username=${encodeURIComponent(u)}`)
            .then((r) => r.json())
            .then((data) => {
              if (data?.locked && data?.message) setLockHint(String(data.message));
            })
            .catch(() => {});
        }
        return;
      }

      if (rememberSelection) localStorage.setItem("sp_login_username", u);
      else localStorage.removeItem("sp_login_username");

      setCredential("");
      router.replace("/");
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
              <Lock className="h-6 w-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">SistePOS</h1>
              <p className="text-slate-300 text-sm">
                Inicia sesión para comenzar tu turno.
              </p>
            </div>
          </div>

          <div className="mt-8 space-y-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400" />
              <p>
                Una sola sesión activa por usuario: si ya estabas logueado en otra
                caja, se cerrará automáticamente.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-amber-400" />
              <p>Bloqueo temporal por intentos fallidos (seguridad).</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur">
          <form onSubmit={onSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                Usuario
              </label>

              <div className="relative">
                <UserIcon className="h-4 w-4 text-slate-400 absolute left-3 top-3.5" />
                <select
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={loadingUsers}
                  className="w-full appearance-none rounded-xl bg-slate-950/40 border border-white/10 pl-10 pr-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">
                    {loadingUsers ? "Cargando usuarios..." : "Selecciona un usuario"}
                  </option>
                  {users.map((u) => (
                    <option key={u.id} value={u.username}>
                      {u.displayName} ({u.username})
                    </option>
                  ))}
                </select>
              </div>

              {selectedUser && (
                <p className="mt-2 text-xs text-slate-400">
                  Acceso para: <span className="text-slate-200 font-semibold">{selectedUser.displayName}</span>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-200 mb-2">
                PIN / Clave
              </label>
              <input
                value={credential}
                onChange={(e) => setCredential(e.target.value)}
                type="password"
                inputMode="numeric"
                autoComplete="current-password"
                className="w-full rounded-xl bg-slate-950/40 border border-white/10 px-4 py-3 text-slate-100 outline-none focus:ring-2 focus:ring-blue-500 tracking-widest"
                placeholder="••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-slate-300 select-none">
                <input
                  type="checkbox"
                  checked={rememberSelection}
                  onChange={(e) => setRememberSelection(e.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-slate-950/40"
                />
                Recordar usuario
              </label>
            </div>

            {lockHint && !error && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                {lockHint}
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-3 font-bold text-white transition-colors"
            >
              {submitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

