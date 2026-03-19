import type { Metadata } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "SistePOS - Acceso",
};

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        {children}
      </body>
    </html>
  );
}

