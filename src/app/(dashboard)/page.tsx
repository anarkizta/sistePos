"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ShoppingCart,
  CreditCard,
  Banknote,
  Trash2,
  Plus,
  Minus,
  Lock,
  Store,
} from "lucide-react";

type Product = {
  id: number;
  barcode: string | null;
  name: string;
  price: string;
  stock: number;
};

type CartItem = Product & { quantity: number; cartItemId: string };

import Swal from "sweetalert2";

type MeResponse = {
  session: {
    storeId: number | null;
    terminalId: number | null;
    shiftId: number | null;
    shift: { id: number; status: string } | null;
  } | null;
  permissions: string[];
};

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [meLoading, setMeLoading] = useState(true);
  const [me, setMe] = useState<MeResponse | null>(null);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = (await res.json()) as MeResponse;
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setMeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
    const onFocus = () => {
      void loadMe();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [loadMe]);

  const posBlock = useMemo(() => {
    if (meLoading) {
      return { blocked: false as const, reason: null as null, loading: true };
    }
    if (!me?.session) {
      return { blocked: true as const, reason: "no_context" as const, loading: false };
    }
    const perms = new Set(me.permissions ?? []);
    if (!perms.has("venta_cobrar")) {
      return { blocked: false as const, reason: null, loading: false };
    }
    const { storeId, terminalId, shift } = me.session;
    if (!storeId || !terminalId) {
      return { blocked: true as const, reason: "no_context" as const, loading: false };
    }
    if (!shift || shift.status !== "OPEN") {
      return { blocked: true as const, reason: "no_shift" as const, loading: false };
    }
    return { blocked: false as const, reason: null, loading: false };
  }, [me, meLoading]);

  useEffect(() => {
    fetch("/api/productos")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch((err) => console.error(err));
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const addToCart = (product: Product) => {
    if (posBlock.blocked) return;
    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1, cartItemId: Math.random().toString(36).substr(2, 9) }];
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    if (posBlock.blocked) return;
    setCart((prev) =>
      prev.map((item) => {
        if (item.cartItemId === cartItemId) {
          const newQ = item.quantity + delta;
          return newQ > 0 ? { ...item, quantity: newQ } : item;
        }
        return item;
      }),
    );
  };

  const removeItem = (cartItemId: string) => {
    if (posBlock.blocked) return;
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0), [cart]);

  const procesarPago = (metodo: string) => {
    if (posBlock.blocked) return;
    Swal.fire({
      title: `Pago con ${metodo}`,
      text: `¿Confirmar pago por $${total.toLocaleString('es-CL')}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cobrar'
    }).then(async (result) => {
      if (!result.isConfirmed) return;
      const paymentMethod = metodo.toLowerCase().includes("efect") ? "EFECTIVO" : "TARJETA";
      try {
        const res = await fetch("/api/ventas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ totalAmount: total, paymentMethod }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(typeof payload.error === "string" ? payload.error : "Error al registrar venta");
        }
        setCart([]);
        Swal.fire({
          title: "¡Pagado!",
          text: "Venta registrada con éxito.",
          icon: "success",
          timer: 2000,
          showConfirmButton: false,
        });
      } catch (err) {
        Swal.fire({
          title: "No se pudo registrar",
          text: err instanceof Error ? err.message : "Error de red o servidor",
          icon: "error",
        });
      }
    });
  };

  return (
    <div className="relative flex h-full min-h-0 gap-6">
      {posBlock.loading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl bg-white/80 backdrop-blur-[2px]">
          <p className="text-sm font-medium text-slate-600">Verificando turno de caja…</p>
        </div>
      )}

      {posBlock.blocked && posBlock.reason && (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-xl bg-slate-900/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl border border-slate-200 text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Lock className="h-7 w-7" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Punto de venta bloqueado</h2>
            {posBlock.reason === "no_context" ? (
              <p className="text-slate-600 text-sm leading-relaxed">
                Debes elegir <strong>sucursal</strong> y <strong>caja (terminal)</strong> antes de cobrar.
                Configuralo en Turnos y vuelve aquí.
              </p>
            ) : (
              <p className="text-slate-600 text-sm leading-relaxed">
                Antes de la primera venta debes <strong>abrir turno</strong> e ingresar el{" "}
                <strong>fondo de caja</strong> (apertura por denominaciones) en esa caja.
              </p>
            )}
            <Link
              href="/turnos"
              className="inline-flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
            >
              <Store className="w-5 h-5" />
              Ir a Turnos / Caja
            </Link>
          </div>
        </div>
      )}

      <div
        className={`flex flex-1 min-h-0 flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${
          posBlock.blocked || posBlock.loading ? "pointer-events-none select-none opacity-50" : ""
        }`}
      >
        <div className="p-4 border-b border-slate-200">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
            <input 
              type="text" 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Escanear código o buscar producto..." 
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-700"
              autoFocus
            />
          </div>
        </div>
        
        <div className="flex-1 p-4 bg-slate-50/50 overflow-y-auto">
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((p) => (
              <div 
                key={p.id} 
                onClick={() => addToCart(p)}
                className="bg-white p-4 rounded-xl border border-slate-200 hover:border-blue-400 hover:shadow-md cursor-pointer transition-all active:scale-95 group flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                  <span className="font-bold text-xl">{p.name.charAt(0).toUpperCase()}</span>
                </div>
                <h3 className="font-medium text-slate-800 line-clamp-2 text-sm h-10">{p.name}</h3>
                <p className="text-blue-600 font-bold mt-2">${parseFloat(p.price).toLocaleString('es-CL')}</p>
                <p className="text-xs text-slate-400 mt-1">Stock: {p.stock}</p>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-500">
                No se encontraron productos. 
              </div>
            )}
          </div>
        </div>
      </div>

      <div
        className={`w-[450px] flex flex-col min-h-0 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden ${
          posBlock.blocked || posBlock.loading ? "pointer-events-none select-none opacity-50" : ""
        }`}
      >
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShoppingCart className="w-5 h-5 text-blue-400" />
            <h2 className="font-semibold text-lg">Ticket de Venta</h2>
          </div>
          {cart.length > 0 && (
            <span className="bg-blue-600 text-xs px-2 py-1 rounded-full font-bold">{cart.length}</span>
          )}
        </div>
        
        <div className="flex-1 p-4 bg-slate-50 overflow-y-auto space-y-3">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3">
              <ShoppingCart className="w-12 h-12 opacity-20" />
              <p>El carrito está vacío</p>
            </div>
          ) : (
            cart.map((item) => (
              <div key={item.cartItemId} className="flex gap-3 bg-white p-3 rounded-lg border border-slate-200 shadow-sm animate-in slide-in-from-right-2">
                <div className="flex-1">
                  <p className="font-semibold text-slate-800 text-sm">{item.name}</p>
                  <p className="text-blue-600 font-bold text-sm">${parseFloat(item.price).toLocaleString('es-CL')}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-bold text-slate-800">${(parseFloat(item.price) * item.quantity).toLocaleString('es-CL')}</p>
                  <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
                    <button onClick={() => updateQuantity(item.cartItemId, -1)} className="p-1 hover:bg-white rounded transition-colors text-slate-600">
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="font-semibold text-sm w-4 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.cartItemId, 1)} className="p-1 hover:bg-white rounded transition-colors text-slate-600">
                      <Plus className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeItem(item.cartItemId)} className="p-1 hover:bg-red-100 hover:text-red-500 rounded transition-colors text-slate-400 ml-1">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10">
          <div className="flex justify-between items-center mb-4">
            <span className="text-slate-500 font-semibold text-lg">Total a Pagar</span>
            <span className="text-4xl font-bold text-blue-600 tracking-tight">${total.toLocaleString('es-CL')}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button 
              disabled={cart.length === 0}
              onClick={() => procesarPago('Efectivo')}
              className="flex items-center justify-center gap-2 py-4 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Banknote className="w-6 h-6" />
              EFECTIVO
            </button>
            <button 
              disabled={cart.length === 0}
              onClick={() => procesarPago('Tarjeta')}
              className="flex items-center justify-center gap-2 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-sm shadow-blue-500/30 disabled:opacity-50 border disabled:cursor-not-allowed"
            >
              <CreditCard className="w-6 h-6" />
              TARJETA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
