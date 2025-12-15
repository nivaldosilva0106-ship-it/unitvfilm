import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { signUp, getSiteSettings } from '@/lib/firebase';
import { toast } from 'sonner';
import { SUBSCRIPTION_BENEFITS } from '@/types/payment';
import type { SubscriptionTier } from '@/types/user';

const Signup = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('basic');
  const [loading, setLoading] = useState(false);
  const [bgUrl, setBgUrl] = useState('/login-bg.jpg');

  useEffect(() => {
    getSiteSettings().then(settings => {
      if (settings.loginBackgroundUrl) {
        setBgUrl(settings.loginBackgroundUrl);
      }
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password, 'free');
      toast.success('Conta criada! Complete o pagamento para acessar o conteúdo.');
      navigate('/payment', { state: { tier: selectedTier } });
    } catch (error: any) {
      console.error('Erro no cadastro:', error);

      if (error.code === 'auth/email-already-in-use') {
        toast.error('Este email já está em uso');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Email inválido');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Senha muito fraca. Use pelo menos 6 caracteres');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Background Image */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />

      {/* Color Overlay - Dark Green 80% */}
      <div className="absolute inset-0 z-10 bg-[#022c22]/80" />

      <div className="w-full max-w-5xl relative z-20">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary p-3 rounded-lg glow-effect">
              <Film className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Uni<span className="text-primary">Tv</span>Film
          </h1>
          <p className="text-muted-foreground">Crie sua conta e escolha seu plano</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {(['basic', 'premium', 'vip'] as const).map((tier) => {
            const info = SUBSCRIPTION_BENEFITS[tier];
            return (
              <Card
                key={tier}
                className={`cursor-pointer transition-all ${selectedTier === tier
                  ? 'border-primary shadow-lg scale-105'
                  : 'border-border hover:border-primary/50'
                  }`}
                onClick={() => setSelectedTier(tier)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>{info.name}</span>
                    {tier === 'premium' && (
                      <Crown className="w-5 h-5 text-primary" />
                    )}
                  </CardTitle>
                  <CardDescription className="text-2xl font-bold text-primary">
                    {info.price.toLocaleString('pt-AO')} Kzs
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>✓ Qualidade {info.videoQuality}</p>
                  <p>
                    ✓{' '}
                    {info.downloads === -1
                      ? 'Downloads ilimitados'
                      : `${info.downloads} downloads`}
                  </p>
                  {info.earlyAccess && <p>✓ Acesso antecipado</p>}
                  {info.adsRemoval && <p>✓ Sem anúncios</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Card className="bg-card border border-border">
          <CardHeader>
            <CardTitle>Dados da Conta</CardTitle>
            <CardDescription>
              Após criar sua conta, você será direcionado para o pagamento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="bg-background/50 border-border"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? 'Criando conta...' : 'Continuar para Pagamento'}
              </Button>

              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Já tem uma conta? </span>
                <Link to="/login" className="text-primary hover:underline">
                  Entre aqui
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Signup;
