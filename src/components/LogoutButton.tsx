"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch {
      router.replace("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="flex items-center gap-3 px-4 py-3 w-full rounded-lg hover:bg-red-900/40 hover:text-red-400 text-slate-400 transition-all group disabled:opacity-50"
    >
      <LogOut className="w-5 h-5 group-hover:text-red-400 transition-colors" />
      <span className="font-medium">{loading ? "Saliendo..." : "Cerrar Sesión"}</span>
    </button>
  );
}
