"use client";

import { useMemo, useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Users, Receipt, X, AlertTriangle } from "lucide-react";

type Customer = {
  id: number;
  rut: string | null;
  name: string;
  phone: string | null;
  credit: string;
};

export default function ClientesPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Estados Formulario Modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const emptyForm = useMemo(() => ({ name: "", rut: "", phone: "", credit: "0" }), []);
  const [formData, setFormData] = useState(emptyForm);

  // Confirmación de eliminación
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCustomers = async () => {
    try {
      const res = await fetch("/api/clientes");
      if (!res.ok) throw new Error("Error al cargar clientes");
      const data = await res.json();
      setCustomers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const filteredCustomers = useMemo(() => {
    if (!searchQuery.trim()) return customers;
    const q = searchQuery.toLowerCase();
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.rut ?? "").toLowerCase().includes(q)
    );
  }, [customers, searchQuery]);

  const openCreate = () => {
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      rut: customer.rut ?? "",
      phone: customer.phone ?? "",
      credit: customer.credit,
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
    setFormData(emptyForm);
    setFormError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setFormError("");

      const url = editingCustomer ? `/api/clientes/${editingCustomer.id}` : "/api/clientes";
      const method = editingCustomer ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setFormError(err.error ?? "Error al guardar el cliente");
        return;
      }

      closeModal();
      fetchCustomers();
    } catch (error) {
      console.error(error);
      setFormError("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/clientes/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Error al eliminar");
      setDeletingId(null);
      fetchCustomers();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <Users className="w-6 h-6 text-blue-500" /> 
            Directorio de Clientes
          </h1>
          <p className="text-slate-500 mt-1">Administra la base de clientes y sus líneas de crédito.</p>
        </div>
        
        <button 
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-sm shadow-blue-500/30"
        >
          <Plus className="w-5 h-5" />
          Nuevo Cliente
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o RUT..." 
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">RUT</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Teléfono</th>
                <th className="p-4 font-medium">Crédito a Favor</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">Cargando clientes...</td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    {searchQuery ? "No se encontraron clientes con ese criterio." : "No hay clientes registrados."}
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500 font-mono text-sm">{customer.rut || "N/A"}</td>
                    <td className="p-4 font-medium text-slate-800 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      {customer.name}
                    </td>
                    <td className="p-4 text-slate-600">{customer.phone || "-"}</td>
                    <td className="p-4 font-semibold text-emerald-600">${customer.credit}</td>
                    <td className="p-4 text-right">
                      <button className="p-2 text-slate-400 hover:text-green-600 transition-colors" title="Ver Historial de Compras">
                        <Receipt className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(customer)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="Editar cliente"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(customer.id)}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        title="Eliminar cliente"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                {editingCustomer ? "Editar Cliente" : "Agregar Cliente"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">RUT</label>
                <input
                  type="text"
                  value={formData.rut}
                  onChange={(e) => setFormData({ ...formData, rut: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="12.345.678-9"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="+569..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Crédito Inicial</label>
                  <input
                    type="number"
                    value={formData.credit}
                    onChange={(e) => setFormData({ ...formData, credit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    step="1"
                    min="0"
                  />
                </div>
              </div>
              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  disabled={saving}
                  onClick={closeModal}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
                >
                  {saving && (
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  )}
                  {saving ? "Guardando..." : editingCustomer ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deletingId !== null && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-slate-800">Eliminar Cliente</h3>
            </div>
            <p className="text-slate-500 text-sm">
              ¿Estás seguro de que deseas eliminar este cliente? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setDeletingId(null)}
                disabled={deleting}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-medium rounded-lg disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deletingId)}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {deleting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                {deleting ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
