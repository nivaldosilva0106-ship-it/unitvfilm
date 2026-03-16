import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Film, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { signUp, getPlans } from '@/lib/firebase';
import { toast } from 'sonner';
import type { Plan } from '@/types/user';

const Signup = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<'form' | 'plans'>('plans');
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(''); // Prompt implied user has name/phone
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  /* Background State */
  const [bgUrl, setBgUrl] = useState('/login-bg.jpg');

  useEffect(() => {
    loadPlans();
    import('@/lib/firebase').then(({ getSiteSettings }) => {
      getSiteSettings().then(settings => {
        if (settings.loginBackgroundUrl) {
          setBgUrl(settings.loginBackgroundUrl);
        }
      });
    });
  }, []);

  const loadPlans = async () => {
    try {
      // Add default Free Plan if not in DB?
      // We'll fetch DB plans. If empty, show static Free?
      // Assuming DB has plans. If not, we should probably seed them or handle empty.
      // For now, I'll fetch and if empty, render a default Free.
      const dbPlans = await getPlans();
      if (dbPlans.length === 0) {
        // Fallback
        const freePlan: Plan = {
          id: 'free',
          name: 'Plano Free',
          description: 'Acesso limitado a conteúdos gratuitos',
          price: 0,
          limits: { moviesPerDay: 2, episodesPerDay: 1, maxProfiles: 2, canDownload: false },
          isActive: true,
          requiresVerification: false
        };
        setPlans([freePlan]);
      } else {
        setPlans(dbPlans.filter(p => p.isActive));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handlePlanSelect = (plan: Plan) => {
    setSelectedPlan(plan);
    setStep('form');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setLoading(true);

    try {
      // Create Account
      // Note: signUp function in firebase.ts currently takes (email, pass, tier).
      // We should update profile with Name/Phone/PlanId.
      // But signUp returns userCredential. We can update profile after?
      // Or update signUp function?
      // I'll update profile after signUp here if possible, but firebase.ts signUp creates profile.
      // I'll rely on signUp for now, and maybe update profile later or just assume minimal data.
      // Wait, firebase.ts signUp creates static profile.
      // I should update it to store name/planId.
      // I'll update `signUp` in firebase.ts LATER or just use `update(ref(..., profiles/uid))` here?
      // I'll use `update` here.

      const needsVerification = selectedPlan.requiresVerification;
      const status = needsVerification ? 'pending_payment' : 'active';
      const subscriptionTier = selectedPlan.price > 0 ? 'premium' : 'free';

      const { user } = await signUp(email, password, subscriptionTier, selectedPlan.id, status);

      // Update additional profile info
      const { ref, update, getDatabase } = await import('firebase/database');
      const db = getDatabase();
      await update(ref(db, `profiles/${user.uid}`), {
        planId: selectedPlan.id,
        phone: phone || '', // Add phone to profile
        displayName: name || '', // Add name
        credits: { date: new Date().toISOString().split('T')[0], moviesWatched: 0, episodesWatched: 0 }
      });

      if (selectedPlan.requiresVerification) {
        // Paid Plan Flow
        const message = `Quero assinar o plano ${selectedPlan.name}.\nNome: ${name}\nEmail: ${email}\nTelefone: ${phone}\nPreço: ${selectedPlan.price} KZ`;
        const whatsappNumber = selectedPlan.whatsappNumber || "244944016791";
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;

        window.open(url, '_blank');
        toast.success("Conta criada! Envie a mensagem no WhatsApp e insira o código.");
        navigate('/verify-code');
      } else {
        // Free Plan Flow
        toast.success('Conta criada com sucesso!');
        navigate('/');
      }

    } catch (error: any) {
      console.error('Erro no cadastro:', error);
      if (error.code === 'auth/email-already-in-use') {
        toast.error('Email já está em uso');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Senha muito fraca');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] flex items-center justify-center px-4 py-8">
      {/* Background similar to Login */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-20"
        style={{ backgroundImage: `url("${bgUrl}")` }}
      />

      <div className="w-full max-w-4xl relative z-10">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary p-2 rounded-lg">
              <Film className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Uni<span className="text-primary">Tv</span>Film</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-bold text-white px-4">
            {step === 'plans' ? 'Escolha seu Plano' : 'Para finalizar, crie sua conta'}
          </h1>
        </div>

        {step === 'plans' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map(plan => (
              <div key={plan.id} className={`bg-zinc-900 border ${plan.price > 0 ? 'border-primary' : 'border-zinc-800'} rounded-xl p-5 sm:p-6 hover:scale-[1.02] sm:hover:scale-105 transition-transform cursor-pointer flex flex-col`} onClick={() => handlePlanSelect(plan)}>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1 mb-4">
                    <p className="text-3xl font-bold text-primary">
                      {plan.price > 0 ? `${plan.price} KZ` : 'Grátis'}
                    </p>
                    {plan.price > 0 && (
                      <span className="text-sm text-gray-400 font-normal">
                        / {plan.durationDays === 7 ? '1 Semana' :
                          plan.durationDays === 30 ? '1 Mês' :
                            plan.durationDays === 90 ? '3 Meses' :
                              plan.durationDays === 365 ? '1 Ano' :
                                `${plan.durationDays} dias`}
                      </span>
                    )}
                  </div>
                  <ul className="space-y-3 mb-6">
                    <li className="flex items-center gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500" />
                      {plan.limits.moviesPerDay === -1 ? 'Filmes Ilimitados' : `${plan.limits.moviesPerDay} Filmes por dia`}
                    </li>
                    <li className="flex items-center gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500" />
                      {plan.limits.episodesPerDay === -1 ? 'Séries Ilimitadas' : `${plan.limits.episodesPerDay} Episódios por dia`}
                    </li>
                    <li className="flex items-center gap-2 text-gray-300">
                      <Check className="w-4 h-4 text-green-500" />
                      {plan.limits.maxProfiles} Perfis
                    </li>
                    <li className="flex items-center gap-2 text-gray-300">
                      <Check className={`w-4 h-4 ${plan.limits.canDownload ? 'text-green-500' : 'text-gray-600'}`} />
                      {plan.limits.canDownload ? 'Downloads Liberados' : 'Sem Downloads'}
                    </li>
                  </ul>
                </div>
                <Button className={`w-full ${plan.price > 0 ? 'bg-primary hover:bg-primary/90' : 'bg-gray-700 hover:bg-gray-600'}`}>
                  {plan.price > 0 ? 'Assinar Agora' : 'Começar Grátis'}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-w-md mx-auto bg-zinc-900 border border-zinc-800 rounded-xl p-6 sm:p-8">
            <div className="mb-6 flex items-center justify-between">
              <h3 className="font-semibold text-lg text-white">Plano Selecionado: <span className="text-primary">{selectedPlan?.name}</span></h3>
              <Button variant="ghost" size="sm" onClick={() => setStep('plans')} className="text-xs">Alterar</Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <Input id="name" value={name} onChange={e => setName(e.target.value)} required className="bg-black/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone (WhatsApp)</Label>
                <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9XX XXX XXX" required className="bg-black/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="bg-black/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} required className="bg-black/50" />
              </div>

              <Button type="submit" className="w-full h-12 text-lg" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : (selectedPlan?.price && selectedPlan.price > 0 ? 'Ir para Pagamento (WhatsApp)' : 'Criar Conta')}
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Signup;
