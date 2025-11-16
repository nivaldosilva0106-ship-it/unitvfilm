import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Crown, LogOut, AlertCircle, Settings } from "lucide-react";
import { toast } from "sonner";
import { SUBSCRIPTION_BENEFITS } from "@/types/payment";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
      toast.success("Logout realizado com sucesso!");
      navigate("/login");
    } catch (error) {
      toast.error("Erro ao fazer logout");
    }
  };

  if (!user) {
    navigate("/login");
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-foreground mb-8 flex items-center gap-3">
          <User className="w-10 h-10 text-primary" />
          Meu Perfil
        </h1>

        <div className="grid gap-6">
          {/* Profile Information Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <span>Informações da Conta</span>
                {isAdmin && (
                  <Badge className="bg-primary text-primary-foreground">
                    <Settings className="w-4 h-4 mr-1" />
                    Admin
                  </Badge>
                )}
                {profile?.isPremium && !isAdmin && (
                  <Badge className="bg-primary text-primary-foreground">
                    <Crown className="w-4 h-4 mr-1" />
                    {SUBSCRIPTION_BENEFITS[profile.subscriptionTier || 'basic'].name}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Seus dados de perfil</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Mail className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="text-foreground font-medium">{profile?.email || user.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <p className="text-sm text-muted-foreground">Membro desde</p>
                  <p className="text-foreground font-medium">
                    {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('pt-BR') : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                <Crown className="w-5 h-5 text-primary" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Status da conta</p>
                  <p className="text-foreground font-medium">
                    {isAdmin 
                      ? 'Administrador - Acesso Total'
                      : profile?.isPremium
                        ? SUBSCRIPTION_BENEFITS[profile.subscriptionTier || 'basic'].name
                        : 'Gratuito'}
                  </p>
                  {profile?.subscriptionExpiresAt && !isAdmin && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Expira em {new Date(profile.subscriptionExpiresAt).toLocaleDateString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>

              {!isAdmin && !profile?.isPremium && (
                <div className="flex items-start gap-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-destructive">Conta não ativa</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Complete o pagamento para acessar o conteúdo
                    </p>
                  </div>
                </div>
              )}
              
              {isAdmin && (
                <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                  <p className="text-sm font-medium text-primary">
                    Como administrador, você tem acesso ilimitado a todos os conteúdos e recursos da plataforma.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions Card */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Ações</CardTitle>
              <CardDescription>Gerenciar sua conta</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!isAdmin && !profile?.isPremium && (
                <Button 
                  className="w-full"
                  onClick={() => navigate("/payment", { state: { tier: 'basic' } })}
                >
                  <Crown className="w-4 h-4 mr-2" />
                  Ativar Assinatura
                </Button>
              )}
              
              {isAdmin && (
                <Button 
                  className="w-full"
                  onClick={() => navigate("/admin")}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Painel Administrativo
                </Button>
              )}
              
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/my-list")}
              >
                Minha Lista
              </Button>
              
              <Button 
                variant="destructive" 
                className="w-full justify-start"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sair da Conta
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Profile;
