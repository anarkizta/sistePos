"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, Plus, Edit2, Search, X } from "lucide-react";

type Role = { id: number; code: string; name: string };

type UserRow = {
  id: number;
  username: string;
  displayName: string;
  credentialType: string;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  roles: Role[];
};

type MeState = {
  permissions: string[];
  loaded: boolean;
};

function permSet(perms: string[]) {
  return new Set(perms);
}

export default function UsuariosPage() {
  const [me, setMe] = useState<MeState>({ permissions: [], loaded: false });
  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formCredentialType, setFormCredentialType] = useState<"PIN" | "PASSWORD">("PASSWORD");
  const [formPassword, setFormPassword] = useState("");
  const [formPin, setFormPin] = useState("");
  const [formActive, setFormActive] = useState(true);
  const [formRoleIds, setFormRoleIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const canList = useMemo(() => {
    const p = permSet(me.permissions);
    return p.has("usuario_crear") || p.has("usuario_editar");
  }, [me.permissions]);

  const canCreate = useMemo(() => {
    const p = permSet(me.permissions);
    return p.has("usuario_crear") && p.has("rol_asignar");
  }, [me.permissions]);

  const canEdit = useMemo(() => permSet(me.permissions).has("usuario_editar"), [me.permissions]);

  const canAssignRoles = useMemo(() => permSet(me.permissions).has("rol_asignar"), [me.permissions]);

  const loadMe = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    const data = await res.json();
    const permissions: string[] = Array.isArray(data.permissions) ? data.permissions : [];
    setMe({ permissions, loaded: true });
  }, []);

  const loadUsers = useCallback(async () => {
    const res = await fetch("/api/usuarios/gestion");
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error ?? "Error al cargar usuarios");
    }
    const data = await res.json();
    setUsers(data);
  }, []);

  const loadRoles = useCallback(async () => {
    const res = await fetch("/api/roles");
    if (!res.ok) return;
    const data = await res.json();
    setRoles(data);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await loadMe();
    } catch {
      setMe({ permissions: [], loaded: true });
    }
    try {
      await loadUsers();
    } catch {
      setUsers([]);
    }
    try {
      await loadRoles();
    } catch {
      setRoles([]);
    } finally {
      setLoading(false);
    }
  }, [loadMe, loadRoles, loadUsers]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!me.loaded) return;
    const p = permSet(me.permissions);
    if (p.has("usuario_crear") || p.has("rol_asignar")) {
      void loadRoles();
    }
  }, [me.loaded, me.permissions, loadRoles]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        u.displayName.toLowerCase().includes(q) ||
        u.roles.some((r) => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
    );
  }, [users, searchQuery]);

  const openCreate = () => {
    if (!canCreate) return;
    setEditing(null);
    setFormUsername("");
    setFormDisplayName("");
    setFormCredentialType("PASSWORD");
    setFormPassword("");
    setFormPin("");
    setFormActive(true);
    setFormRoleIds([]);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (u: UserRow) => {
    if (!canEdit) return;
    setEditing(u);
    setFormUsername(u.username);
    setFormDisplayName(u.displayName);
    setFormCredentialType(u.credentialType === "PIN" ? "PIN" : "PASSWORD");
    setFormPassword("");
    setFormPin("");
    setFormActive(u.isActive);
    setFormRoleIds(u.roles.map((r) => r.id));
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setFormError("");
  };

  const toggleRole = (id: number) => {
    if (!canAssignRoles) return;
    setFormRoleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const submit = async () => {
    setFormError("");
    setSaving(true);
    try {
      if (editing) {
        const body: Record<string, unknown> = {
          displayName: formDisplayName.trim(),
          isActive: formActive,
        };
        if (canAssignRoles) {
          body.roleIds = formRoleIds;
        }
        if (formCredentialType === "PASSWORD" && formPassword) {
          body.password = formPassword;
        }
        if (formCredentialType === "PIN" && formPin) {
          body.pin = formPin;
        }
        if (!formPassword && !formPin && formCredentialType !== editing.credentialType) {
          body.credentialType = formCredentialType;
        }

        const res = await fetch(`/api/usuarios/gestion/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data.error ?? "No se pudo guardar");
          return;
        }
      } else {
        const username = formUsername.trim();
        const displayName = formDisplayName.trim();
        if (!username || !displayName) {
          setFormError("Alias y nombre son obligatorios");
          return;
        }
        if (formRoleIds.length === 0) {
          setFormError("Selecciona al menos un rol");
          return;
        }
        if (formCredentialType === "PASSWORD" && formPassword.length < 6) {
          setFormError("La clave debe tener al menos 6 caracteres");
          return;
        }
        if (formCredentialType === "PIN" && formPin.length < 4) {
          setFormError("El PIN debe tener al menos 4 digitos");
          return;
        }

        const body: Record<string, unknown> = {
          username,
          displayName,
          credentialType: formCredentialType,
          isActive: formActive,
          roleIds: formRoleIds,
        };
        if (formCredentialType === "PASSWORD") {
          body.password = formPassword;
        } else {
          body.pin = formPin;
        }

        const res = await fetch("/api/usuarios/gestion", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setFormError(data.error ?? "No se pudo crear");
          return;
        }
      }
      closeModal();
      await loadUsers();
    } finally {
      setSaving(false);
    }
  };

  if (!me.loaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-slate-500">Cargando…</div>
    );
  }

  if (!canList) {
    return (
      <div className="max-w-lg mx-auto mt-12 rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
        <h1 className="text-lg font-semibold flex items-center gap-2">
          <UserCog className="w-6 h-6" />
          Usuarios
        </h1>
        <p className="mt-2 text-sm">
          No tienes permiso para ver esta seccion. Se requiere{" "}
          <code className="bg-amber-100 px-1 rounded">usuario_crear</code> o{" "}
          <code className="bg-amber-100 px-1 rounded">usuario_editar</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <UserCog className="w-8 h-8 text-blue-600" />
            Usuarios y roles
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Crear cuentas, asignar roles (ADMIN, Supervisor, Cajero) y credenciales.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5" />
            Nuevo usuario
          </button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          placeholder="Buscar por alias, nombre o rol…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Alias</th>
                <th className="text-left px-4 py-3 font-semibold">Nombre</th>
                <th className="text-left px-4 py-3 font-semibold">Roles</th>
                <th className="text-left px-4 py-3 font-semibold">Credencial</th>
                <th className="text-left px-4 py-3 font-semibold">Estado</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-mono text-slate-800">{u.username}</td>
                  <td className="px-4 py-3">{u.displayName}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <span
                          key={r.id}
                          className="inline-block px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs"
                        >
                          {r.code}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.credentialType}</td>
                  <td className="px-4 py-3">
                    {u.isActive ? (
                      <span className="text-emerald-700 font-medium">Activo</span>
                    ) : (
                      <span className="text-slate-400">Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => openEdit(u)}
                        className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-slate-500 py-10">No hay usuarios que coincidan.</p>
        )}
      </div>

      {!canCreate && canList && (
        <p className="text-sm text-slate-500">
          Solo puedes ver el listado. Para crear usuarios necesitas{" "}
          <code className="bg-slate-100 px-1 rounded">usuario_crear</code> y{" "}
          <code className="bg-slate-100 px-1 rounded">rol_asignar</code>.
        </p>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-slate-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-800">
                {editing ? "Editar usuario" : "Nuevo usuario"}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 text-red-800 text-sm px-3 py-2 border border-red-100">
                  {formError}
                </div>
              )}

              {!editing && (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">Alias (login)</span>
                  <input
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={formUsername}
                    onChange={(e) => setFormUsername(e.target.value)}
                    autoComplete="off"
                  />
                </label>
              )}

              <label className="block">
                <span className="text-sm font-medium text-slate-700">Nombre visible</span>
                <input
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                  value={formDisplayName}
                  onChange={(e) => setFormDisplayName(e.target.value)}
                />
              </label>

              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cred"
                    checked={formCredentialType === "PASSWORD"}
                    onChange={() => setFormCredentialType("PASSWORD")}
                  />
                  <span className="text-sm">Clave</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="cred"
                    checked={formCredentialType === "PIN"}
                    onChange={() => setFormCredentialType("PIN")}
                  />
                  <span className="text-sm">PIN</span>
                </label>
              </div>

              {formCredentialType === "PASSWORD" ? (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {editing ? "Nueva clave (opcional)" : "Clave (min. 6 caracteres)"}
                  </span>
                  <input
                    type="password"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              ) : (
                <label className="block">
                  <span className="text-sm font-medium text-slate-700">
                    {editing ? "Nuevo PIN (opcional)" : "PIN (min. 4 digitos)"}
                  </span>
                  <input
                    type="password"
                    inputMode="numeric"
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                    value={formPin}
                    onChange={(e) => setFormPin(e.target.value)}
                    autoComplete="new-password"
                  />
                </label>
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                />
                <span className="text-sm text-slate-700">Usuario activo</span>
              </label>

              <div>
                <span className="text-sm font-medium text-slate-700 block mb-2">Roles</span>
                {!canAssignRoles ? (
                  <div className="space-y-2">
                    {editing && (
                      <div className="flex flex-wrap gap-1">
                        {editing.roles.map((r) => (
                          <span
                            key={r.id}
                            className="inline-block px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-xs"
                          >
                            {r.code}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="text-sm text-slate-500">
                      No puedes cambiar roles. Se requiere permiso{" "}
                      <code className="bg-slate-100 px-1 rounded">rol_asignar</code>.
                    </p>
                  </div>
                ) : roles.length === 0 ? (
                  <p className="text-sm text-amber-700">No se pudieron cargar los roles.</p>
                ) : (
                  <div className="space-y-2 border border-slate-100 rounded-lg p-3 bg-slate-50/50">
                    {roles.map((r) => (
                      <label key={r.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formRoleIds.includes(r.id)}
                          onChange={() => toggleRole(r.id)}
                        />
                        <span className="text-sm">
                          <span className="font-medium">{r.code}</span>
                          <span className="text-slate-500"> — {r.name}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2 bg-slate-50/50 rounded-b-2xl">
              <button
                type="button"
                onClick={closeModal}
                className="px-4 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-white"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                disabled={saving || (!editing && !canCreate) || (Boolean(editing) && !canEdit)}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
