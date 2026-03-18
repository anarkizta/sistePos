import { Search, Bell, UserCircle } from "lucide-react";

export default function Topbar() {
  return (
    <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shadow-sm z-10">
      <div className="flex items-center w-full max-w-md relative">
        <Search className="w-5 h-5 absolute left-3 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar atajos..."
          className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
        />
      </div>

      <div className="flex items-center gap-4">
        <button className="relative p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
          <Bell className="w-5 h-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
        </button>
        <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
          <div className="text-right">
            <p className="text-sm font-semibold text-slate-700">Cajero 1</p>
            <p className="text-xs text-slate-500">Caja Principal</p>
          </div>
          <UserCircle className="w-10 h-10 text-slate-300" />
        </div>
      </div>
    </header>
  );
}
