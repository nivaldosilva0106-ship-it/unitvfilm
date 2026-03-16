import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Film, Upload, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { createPayment } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { SUBSCRIPTION_BENEFITS, SUBSCRIPTION_PRICES } from '@/types/payment';
import type { SubscriptionTier } from '@/types/user';

const Payment = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const tier = (location.state?.tier as SubscriptionTier) || 'basic';
  const tierInfo = SUBSCRIPTION_BENEFITS[tier === 'free' ? 'basic' : tier];

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!proofFile) {
      toast.error('Por favor, anexe o comprovante de pagamento');
      return;
    }

    setLoading(true);

    try {
      // Simular upload do comprovante (em produção, usar storage)
      const proofUrl = URL.createObjectURL(proofFile);

      await createPayment({
        userId: user.uid,
        userEmail: user.email || '',
        amount: tierInfo.price,
        proofUrl,
        status: 'pending',
        subscriptionTier: tier === 'free' ? 'basic' : tier,
      });

      setSubmitted(true);
      toast.success('Comprovante enviado! Aguarde a aprovação.');
    } catch (error) {
      console.error('Erro ao enviar comprovante:', error);
      toast.error('Erro ao enviar comprovante. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <Card className="w-full max-w-md border-border">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-primary/20 p-4 rounded-full">
                <Clock className="w-12 h-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl">Pagamento em Análise</CardTitle>
            <CardDescription>
              Seu comprovante foi enviado com sucesso!
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Estamos verificando seu pagamento. Você receberá um email assim que for aprovado.
                Isso pode levar até 24 horas.
              </p>
            </div>
            <Button onClick={() => navigate('/')} className="w-full">
              Voltar para Início
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="bg-primary p-3 rounded-lg glow-effect">
              <Film className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
            Uni<span className="text-primary">Tv</span>Film
          </h1>
          <p className="text-muted-foreground">Complete seu pagamento</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Detalhes da Assinatura */}
          <Card className="border-primary/50">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Plano {tierInfo.name}</span>
                <Badge className="bg-primary text-primary-foreground text-xs sm:text-sm">
                  {tierInfo.price.toLocaleString('pt-AO')} Kzs/mês
                </Badge>
              </CardTitle>
              <CardDescription>Benefícios incluídos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-foreground">Qualidade até {tierInfo.videoQuality}</span>
              </div>
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-primary" />
                <span className="text-foreground">
                  {tierInfo.downloads === -1 ? 'Downloads ilimitados' : `${tierInfo.downloads} downloads simultâneos`}
                </span>
              </div>
              {tierInfo.earlyAccess && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-foreground">Acesso antecipado a novos conteúdos</span>
                </div>
              )}
              {tierInfo.adsRemoval && (
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  <span className="text-foreground">Sem anúncios</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Formulário de Pagamento */}
          <Card className="border-border">
            <CardHeader>
              <CardTitle>Transferência Bancária</CardTitle>
              <CardDescription>
                Envie o comprovante de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted p-3 sm:p-4 rounded-lg mb-6 space-y-2">
                <p className="text-sm font-medium text-foreground">Dados Bancários:</p>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground flex justify-between"><span>Banco:</span> <span className="font-mono">BAI</span></p>
                  <p className="text-xs sm:text-sm text-muted-foreground flex justify-between"><span>Conta:</span> <span className="font-mono">0000 0000 0000 0000</span></p>
                  <p className="text-xs sm:text-sm text-muted-foreground flex justify-between"><span>Titular:</span> <span>UniTvFilm, Lda</span></p>
                </div>
                <p className="text-sm sm:text-base font-semibold text-primary mt-2 pt-2 border-t border-border/50">
                  Total: {tierInfo.price.toLocaleString('pt-AO')} Kzs
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="proof">Comprovante de Pagamento *</Label>
                  <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary transition-colors">
                    <Input
                      id="proof"
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileChange}
                      className="hidden"
                      required
                    />
                    <label htmlFor="proof" className="cursor-pointer">
                      <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-foreground mb-1">
                        {proofFile ? proofFile.name : 'Clique para escolher arquivo'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PNG, JPG ou PDF até 5MB
                      </p>
                    </label>
                  </div>
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? 'Enviando...' : 'Enviar Comprovante'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Payment;
