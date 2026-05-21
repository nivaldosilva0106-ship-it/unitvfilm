import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, User, LogIn, Loader2, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signInAnonymously, resetPassword } from '@/lib/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from 'sonner';
import { InstallAppButton } from '@/components/InstallAppButton';

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'selection' | 'login'>('selection');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState('/login-bg.jpg');

  // Recovery State
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  useEffect(() => {
    // Check for password recovery hash from Supabase
    if (window.location.hash.includes('type=recovery')) {
      navigate('/update-password' + window.location.hash);
      return;
    }

    import('@/lib/firebase').then(({ getSiteSettings }) => {
      getSiteSettings().then(settings => {
        if (settings.loginBackgroundUrl) {
          setBgUrl(settings.loginBackgroundUrl);
        }
      });
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error('Erro no login:', error);
      // Catch Supabase specific email not confirmed error
      if (error.message && error.message.includes('Email not confirmed')) {
        toast.error('O seu e-mail ainda não foi confirmado. Por favor verifique a sua caixa de entrada e ative a conta antes de iniciar sessão.');
      } else {
        toast.error('O seu e-mail ou senha está incorreto, tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    try {
      await signInAnonymously();
      toast.success("Entrou como convidado!");
      navigate('/');
    } catch (e) {
      toast.error("Erro ao entrar como convidado");
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
            Uni<span className="text-primary">Tv</span>Film
          </h1>
          <p className="text-muted-foreground">
            {mode === 'selection' ? 'Escolha como deseja entrar' : 'Entre na sua conta'}
          </p>
        </div>

        {mode === 'selection' ? (
          <div className="space-y-4">
            <div
              onClick={handleGuestLogin}
              className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-card hover:border-primary transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-zinc-800 text-gray-400 group-hover:text-white transition-colors">
                    <User className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-white">Entrar sem conta</h3>
                    <p className="text-sm text-gray-400">Acesso limitado (Convidado)</p>
                  </div>
                </div>
                {loading ? <Loader2 className="animate-spin" /> : <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">➜</div>}
              </div>
            </div>

            <div
              onClick={() => setMode('login')}
              className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-card hover:border-primary transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/20 text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <LogIn className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-white">Fazer Login</h3>
                    <p className="text-sm text-gray-400">Acesse sua conta completa</p>
                  </div>
                </div>
                <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">➜</div>
              </div>
            </div>

            <div
              onClick={async () => {
                try {
                  setLoading(true);
                  const { signInWithGoogle } = await import('@/lib/firebase');
                  await signInWithGoogle();
                  // The page will redirect to Google
                } catch (e: any) {
                  toast.error(e.message || "Erro ao entrar com Google");
                  setLoading(false);
                }
              }}
              className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-4 sm:p-6 cursor-pointer hover:bg-card hover:border-primary transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-white text-black transition-colors">
                    <svg viewBox="0 0 24 24" className="w-6 h-6">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-lg text-white">Continuar com Google</h3>
                    <p className="text-sm text-gray-400">Entre rapidamente</p>
                  </div>
                </div>
                {loading ? <Loader2 className="animate-spin" /> : <div className="text-primary opacity-0 group-hover:opacity-100 transition-opacity">➜</div>}
              </div>
            </div>

            <div className="pt-4 text-center">
              <Link to="/signup" className="text-sm text-gray-400 hover:text-white underline">
                Criar uma nova conta
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl p-6 sm:p-8">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="bg-background/50 border-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="bg-background/50 border-border"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setRecoveryEmail(email);
                    setShowRecovery(true);
                  }}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Esqueci a senha
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>

            <div className="mt-6 text-center text-sm space-y-2">
              <button onClick={() => setMode('selection')} className="text-muted-foreground hover:text-white block w-full">
                Voltar
              </button>
              <div>
                <span className="text-muted-foreground">Não tem uma conta? </span>
                <Link to="/signup" className="text-primary hover:underline">
                  Cadastre-se
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <Dialog open={showRecovery} onOpenChange={setShowRecovery}>
        <DialogContent className="bg-[#1a1a1a] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Recuperar Senha</DialogTitle>
            <DialogDescription className="text-gray-400">
              Digite o email da sua conta e enviaremos um link para você redefinir a senha.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recovery-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
                <Input
                  id="recovery-email"
                  type="email"
                  placeholder="seu@email.com"
                  className="pl-10 bg-[#0a0a0a] border-[#333] text-white"
                  value={recoveryEmail}
                  onChange={(e) => setRecoveryEmail(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRecovery(false)} className="text-gray-400 hover:text-white">
              Cancelar
            </Button>
            <Button
              onClick={async () => {
                if (!recoveryEmail) return;
                setRecoveryLoading(true);
                try {
                  await resetPassword(recoveryEmail);
                  toast.success("Se este email estiver cadastrado, você receberá um link para redefinir sua senha.");
                  setTimeout(() => setShowRecovery(false), 2000);
                } catch (e) {
                  toast.error("Verifique se o email está correto.");
                } finally {
                  setRecoveryLoading(false);
                }
              }}
              disabled={recoveryLoading}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {recoveryLoading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
