import Link from "next/link";
import { Home, Package, Users, ShoppingCart, Clock } from "lucide-react";
import LogoutButton from "@/components/LogoutButton";

export default function Sidebar() {
  const menuItems = [
    { name: "Punto de Venta", icon: ShoppingCart, href: "/" },
    { name: "Turnos / Caja", icon: Clock, href: "/turnos" },
    { name: "Productos", icon: Package, href: "/productos" },
    { name: "Clientes", icon: Users, href: "/clientes" },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-slate-300 flex flex-col h-full shadow-xl">
      <div className="p-6 text-white font-bold text-2xl tracking-wider flex items-center gap-3">
        <Home className="w-8 h-8 text-blue-500" />
        SistePOS
      </div>

      <nav className="flex-1 px-4 space-y-2 mt-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800 hover:text-white transition-all group"
            >
              <Icon className="w-5 h-5 text-slate-400 group-hover:text-blue-400 transition-colors" />
              <span className="font-medium">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <LogoutButton />
      </div>
    </aside>
  );
}
