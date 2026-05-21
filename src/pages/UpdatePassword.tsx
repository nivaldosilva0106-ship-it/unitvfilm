import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, Lock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { changePassword } from '@/lib/firebase';
import { InstallAppButton } from '@/components/InstallAppButton';

const UpdatePassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState('/login-bg.jpg');

  useEffect(() => {
    import('@/lib/firebase').then(({ getSiteSettings }) => {
      getSiteSettings().then(settings => {
        if (settings.loginBackgroundUrl) {
          setBgUrl(settings.loginBackgroundUrl);
        }
      });
    });
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      toast.error('Digite a nova senha.');
      return;
    }
    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    try {
      await changePassword(password);
      toast.success('Senha atualizada com sucesso!');
      navigate('/login');
    } catch (error: any) {
      console.error('Erro ao atualizar senha:', error);
      toast.error('Ocorreu um erro ao atualizar sua senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />
      <div className="absolute inset-0 z-10 bg-[#022c22]/80" />

      <div className="w-full max-w-md relative z-20 mt-12 sm:mt-0">
        <div className="absolute -top-12 right-0 sm:top-0 sm:right-[-40px]">
          <InstallAppButton variant="icon" />
        </div>
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary p-3 rounded-lg glow-effect">
              <Film className="w-8 h-8 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Nova <span className="text-primary">Senha</span>
          </h1>
          <p className="text-muted-foreground">
            Crie uma nova senha para a sua conta
          </p>
        </div>

        <div className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  id="new-password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Confirme a nova senha"
                  className="pl-10 h-12 bg-background/50 border-border/50 focus:border-primary transition-colors"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary/90 transition-all shadow-lg hover:shadow-primary/25 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Salvar Nova Senha"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdatePassword;
