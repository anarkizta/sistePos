"use client";

import { useState, useEffect, useMemo } from "react";
import { Plus, Search, Edit2, Trash2, Package, X, AlertTriangle } from "lucide-react";
import PermissionPrompt from "@/components/PermissionPrompt";

type Product = {
  id: number;
  barcode: string | null;
  name: string;
  price: string;
  stock: number;
};

type FormData = {
  name: string;
  barcode: string;
  price: string;
  stock: string;
};

const emptyForm: FormData = { name: "", barcode: "", price: "", stock: "0" };

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Confirmación de eliminación
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Solicitud de permiso (override)
  const [permissionPromptOpen, setPermissionPromptOpen] = useState(false);
  const [requiredPermission, setRequiredPermission] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<null | { type: "delete"; productId: number }>(
    null,
  );
  const [authorizationId, setAuthorizationId] = useState<number | null>(null);

  // ─── Fetch ───────────────────────────────────────────────────────────────
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/productos");
      if (!res.ok) throw new Error("Error al cargar productos");
      const data = await res.json();
      setProducts(data);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, []);

  // ─── Búsqueda local ───────────────────────────────────────────────────────
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const q = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? "").toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  // ─── Abrir modal ─────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingProduct(null);
    setFormData(emptyForm);
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode ?? "",
      price: product.price,
      stock: String(product.stock),
    });
    setFormError("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
    setFormData(emptyForm);
    setFormError("");
  };

  // ─── Guardar (crear o editar) ─────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setSaving(true);

    try {
      const url = editingProduct
        ? `/api/productos/${editingProduct.id}`
        : "/api/productos";
      const method = editingProduct ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        setFormError(err.error ?? "Error al guardar el producto");
        return;
      }

      closeModal();
      fetchProducts();
    } catch {
      setFormError("Error de conexión con el servidor");
    } finally {
      setSaving(false);
    }
  };

  // ─── Eliminar ─────────────────────────────────────────────────────────────
  const handleDelete = async (id: number) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/productos/${id}`, {
        method: "DELETE",
        headers: authorizationId ? { "x-sp-authorization-id": String(authorizationId) } : undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        if (res.status === 403 && err?.requiredPermission) {
          setRequiredPermission(String(err.requiredPermission));
          setPendingAction({ type: "delete", productId: id });
          setPermissionPromptOpen(true);
          return;
        }
        throw new Error(err?.error ?? "Error al eliminar");
      }
      setDeletingId(null);
      setAuthorizationId(null);
      fetchProducts();
    } catch (error) {
      console.error(error);
    } finally {
      setDeleting(false);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full space-y-6">

      {/* Header */}
      <div className="flex justify-between items-center bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-800">
            <Package className="w-6 h-6 text-blue-500" />
            Inventario de Productos
          </h1>
          <p className="text-slate-500 mt-1">Gestiona los productos de tu Punto de Venta.</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all shadow-sm shadow-blue-500/30"
        >
          <Plus className="w-5 h-5" />
          Nuevo Producto
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
        {/* Buscador */}
        <div className="p-4 border-b border-slate-200 bg-slate-50/50">
          <div className="relative max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nombre o código..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-sm border-b border-slate-200">
                <th className="p-4 font-medium">Código</th>
                <th className="p-4 font-medium">Nombre</th>
                <th className="p-4 font-medium">Precio</th>
                <th className="p-4 font-medium">Stock</th>
                <th className="p-4 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    Cargando productos...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    {searchQuery ? "No se encontraron productos con ese criterio." : "No hay productos registrados."}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-slate-500 font-mono text-sm">{product.barcode || "—"}</td>
                    <td className="p-4 font-medium text-slate-800">{product.name}</td>
                    <td className="p-4 text-blue-600 font-semibold">${Number(product.price).toLocaleString("es-CL")}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${product.stock <= 5 ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700"}`}>
                        {product.stock} un.
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => openEdit(product)}
                        title="Editar producto"
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors rounded-lg hover:bg-blue-50"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeletingId(product.id)}
                        title="Eliminar producto"
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors rounded-lg hover:bg-red-50"
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

      {/* ─── Modal Crear / Editar ─── */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            {/* Cabecera */}
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-slate-800">
                {editingProduct ? "Editar Producto" : "Agregar Producto"}
              </h2>
              <button onClick={closeModal} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nombre *</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ej. Coca Cola 1L"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Código de Barras</label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                  placeholder="Opcional..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Precio *</label>
                  <input
                    required
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Stock *</label>
                  <input
                    required
                    type="number"
                    value={formData.stock}
                    onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
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
                  {saving ? "Guardando..." : editingProduct ? "Actualizar" : "Guardar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Modal Confirmación Eliminar ─── */}
      {deletingId !== null && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-lg font-bold text-slate-800">Eliminar Producto</h3>
            </div>
            <p className="text-slate-500 text-sm">
              ¿Estás seguro de que deseas eliminar este producto? Esta acción no se puede deshacer.
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

      <PermissionPrompt
        open={permissionPromptOpen && !!requiredPermission}
        requiredPermission={requiredPermission ?? ""}
        context={
          pendingAction?.type === "delete"
            ? { action: "producto_borrar", productId: pendingAction.productId }
            : null
        }
        onClose={() => {
          setPermissionPromptOpen(false);
          setRequiredPermission(null);
          setPendingAction(null);
        }}
        onApproved={(authId) => {
          setAuthorizationId(authId);
          if (pendingAction?.type === "delete") {
            handleDelete(pendingAction.productId);
          }
        }}
      />
    </div>
  );
}
