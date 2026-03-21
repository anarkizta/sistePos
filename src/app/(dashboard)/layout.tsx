import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="bg-slate-50 text-slate-800 h-screen flex overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col h-screen min-h-0 overflow-hidden">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-x-hidden overflow-y-auto bg-slate-50/50 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
