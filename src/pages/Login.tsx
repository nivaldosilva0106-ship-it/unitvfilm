import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, User, LogIn, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signIn, signInAnonymously } from '@/lib/firebase';
import { toast } from 'sonner';

const Login = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'selection' | 'login'>('selection');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signIn(email, password);
      toast.success('Login realizado com sucesso!');
      navigate('/');
    } catch (error: any) {
      console.error('Erro no login:', error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Credenciais inválidas');
      } else {
        toast.error('Erro ao fazer login. Tente novamente.');
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

      <div className="w-full max-w-md relative z-20">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary p-3 rounded-lg glow-effect">
              <Film className="w-8 h-8 text-primary-foreground" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-foreground mb-2">
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
              className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-6 cursor-pointer hover:bg-card hover:border-primary transition-all group"
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
              className="bg-card/80 backdrop-blur border border-border/50 rounded-xl p-6 cursor-pointer hover:bg-card hover:border-primary transition-all group"
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

            <div className="pt-4 text-center">
              <Link to="/signup" className="text-sm text-gray-400 hover:text-white underline">
                Criar uma nova conta
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-lg p-8">
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
    </div>
  );
};

export default Login;
