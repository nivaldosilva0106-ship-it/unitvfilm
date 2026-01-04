import { ReactNode } from "react";
import { AdminSidebar, AdminSidebarContent } from "./AdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

export const AdminLayout = ({ children, title }: AdminLayoutProps) => {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminSidebar />
      <div className="pl-0 lg:pl-56 transition-all duration-300">
        <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center gap-4 px-4 lg:px-6 sticky top-0 z-30">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden shrink-0">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 border-r border-border bg-card">
              <AdminSidebarContent showLogo={true} />
            </SheetContent>
          </Sheet>

          <h1 className="text-xl font-bold truncate">{title}</h1>
        </header>
        <main className="p-4 lg:p-6 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
};
