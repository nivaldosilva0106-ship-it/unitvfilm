import { Film, Settings, Heart, LogOut, LogIn } from "lucide-react";
import { Button } from "./ui/button";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, logout } = useAuth();
  const isAdmin = location.pathname === "/admin";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logout realizado com sucesso');
      navigate('/login');
    } catch (error) {
      toast.error('Erro ao fazer logout');
    }
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-background/95 to-transparent backdrop-blur-sm">
      <div className="container mx-auto px-4 sm:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div 
            className="flex items-center gap-2 cursor-pointer group flex-shrink-0"
            onClick={() => navigate("/")}
          >
            <div className="bg-primary p-2 rounded-lg glow-effect group-hover:scale-110 transition-transform">
              <Film className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">
              Uni<span className="text-primary">Tv</span>Film
            </h1>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {user ? (
              <>
                {profile?.isPremium && (
                  <span className="hidden sm:inline-block text-xs bg-primary/20 text-primary px-2 py-1 rounded font-medium">
                    Premium
                  </span>
                )}
                
                <Button
                  onClick={() => navigate("/my-list")}
                  variant="outline"
                  size="icon"
                  className="border-primary/50 hover:border-primary hover:bg-primary/10"
                >
                  <Heart className="w-4 h-4" />
                </Button>

                {isAdmin ? (
                  <Button
                    onClick={() => navigate("/")}
                    variant="outline"
                    size="icon"
                    className="border-primary/50 hover:border-primary hover:bg-primary/10"
                  >
                    <Film className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={() => navigate("/admin")}
                    variant="outline"
                    size="icon"
                    className="border-primary/50 hover:border-primary hover:bg-primary/10"
                  >
                    <Settings className="w-4 h-4" />
                  </Button>
                )}

                <Button
                  onClick={handleLogout}
                  variant="outline"
                  size="icon"
                  className="border-destructive/50 hover:border-destructive hover:bg-destructive/10"
                >
                  <LogOut className="w-4 h-4" />
                </Button>
              </>
            ) : (
              <Button
                onClick={() => navigate("/login")}
                variant="outline"
                size="sm"
                className="border-primary/50 hover:border-primary hover:bg-primary/10"
              >
                <LogIn className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Entrar</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
