import { ReactNode } from "react";
import { AdminSidebar } from "./AdminSidebar";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <div className="pl-16 lg:pl-56 transition-all duration-300">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center px-6 sticky top-0 z-30">
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
        </header>
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
};
