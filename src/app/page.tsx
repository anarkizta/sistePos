"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, ShoppingCart, CreditCard, Banknote, Trash2, Plus, Minus } from "lucide-react";

type Product = {
  id: number;
  barcode: string | null;
  name: string;
  price: string;
  stock: number;
};

type CartItem = Product & { quantity: number; cartItemId: string };

import Swal from 'sweetalert2';

export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetch("/api/productos")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error(err));
  }, []);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))
  );

  const addToCart = (product: Product) => {
    setCart(prev => {
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
    setCart(prev => prev.map(item => {
      if (item.cartItemId === cartItemId) {
        const newQ = item.quantity + delta;
        return newQ > 0 ? { ...item, quantity: newQ } : item;
      }
      return item;
    }));
  };

  const removeItem = (cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const total = useMemo(() => cart.reduce((sum, item) => sum + (parseFloat(item.price) * item.quantity), 0), [cart]);

  const procesarPago = (metodo: string) => {
    Swal.fire({
      title: `Pago con ${metodo}`,
      text: `¿Confirmar pago por $${total.toLocaleString('es-CL')}?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#2563eb',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cobrar'
    }).then((result) => {
      if (result.isConfirmed) {
        setCart([]);
        Swal.fire({
          title: '¡Pagado!',
          text: 'Venta registrada con éxito.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false
        });
      }
    });
  };

  return (
    <div className="flex h-full gap-6">
      <div className="flex-1 flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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

      <div className="w-[450px] flex flex-col bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
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
