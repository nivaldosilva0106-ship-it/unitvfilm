import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getPendingPayments, approvePayment, rejectPayment } from '@/lib/firebase';
import { CheckCircle2, XCircle, Clock, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { Payment } from '@/types/payment';
import { SUBSCRIPTION_BENEFITS } from '@/types/payment';

const AdminPayments = () => {
  const navigate = useNavigate();
  const { user, profile, isAdmin, loading: authLoading } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!loading && !profile) {
      navigate('/');
      return;
    }
    loadPayments();
  }, [profile, loading, navigate]);

  const loadPayments = async () => {
    try {
      const data = await getPendingPayments();
      setPayments(data.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ));
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
      toast.error('Erro ao carregar pagamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (payment: Payment) => {
    if (!user) return;
    
    setActionLoading(true);
    try {
      await approvePayment(payment.id, user.uid);
      toast.success('Pagamento aprovado com sucesso!');
      loadPayments();
    } catch (error) {
      console.error('Erro ao aprovar pagamento:', error);
      toast.error('Erro ao aprovar pagamento');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedPayment || !rejectReason.trim()) {
      toast.error('Informe o motivo da rejeição');
      return;
    }

    setActionLoading(true);
    try {
      await rejectPayment(selectedPayment.id, rejectReason);
      toast.success('Pagamento rejeitado');
      setShowRejectDialog(false);
      setSelectedPayment(null);
      setRejectReason('');
      loadPayments();
    } catch (error) {
      console.error('Erro ao rejeitar pagamento:', error);
      toast.error('Erro ao rejeitar pagamento');
    } finally {
      setActionLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-foreground">Gerenciar Pagamentos</h1>
          <Badge variant="outline" className="text-lg px-4 py-2">
            {payments.length} Pendentes
          </Badge>
        </div>

        {payments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Clock className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhum pagamento pendente</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6">
            {payments.map((payment) => {
              const tierInfo = SUBSCRIPTION_BENEFITS[payment.subscriptionTier];
              return (
                <Card key={payment.id} className="border-border">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {payment.userEmail}
                          <Badge className="bg-primary text-primary-foreground">
                            {tierInfo.name}
                          </Badge>
                        </CardTitle>
                        <CardDescription>
                          Enviado em {new Date(payment.createdAt).toLocaleString('pt-BR')}
                        </CardDescription>
                      </div>
                      <Badge variant="outline" className="text-lg">
                        {payment.amount.toLocaleString('pt-AO')} Kzs
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(payment.proofUrl, '_blank')}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        Ver Comprovante
                      </Button>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => handleApprove(payment)}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Aprovar
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => {
                          setSelectedPayment(payment);
                          setShowRejectDialog(true);
                        }}
                        disabled={actionLoading}
                        className="flex-1"
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        Rejeitar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Pagamento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição para o usuário
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo</Label>
              <Input
                id="reason"
                placeholder="Ex: Comprovante ilegível"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={actionLoading || !rejectReason.trim()}
            >
              Rejeitar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPayments;
