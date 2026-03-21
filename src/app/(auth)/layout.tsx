import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SistePOS - Acceso",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      {children}
    </div>
  );
}
