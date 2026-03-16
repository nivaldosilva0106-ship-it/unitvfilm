import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { AdminLayout } from '@/components/admin/AdminLayout';

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
      <AdminLayout title="Gerenciar Pagamentos">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout title="Gerenciar Pagamentos">
      <div className="flex items-center justify-between mb-6">
        <Badge variant="outline" className="text-base px-3 py-1.5">
          {payments.length} Pendentes
        </Badge>
      </div>

      {payments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="w-10 h-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum pagamento pendente</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {payments.map((payment) => {
            const tierInfo = SUBSCRIPTION_BENEFITS[payment.subscriptionTier];
            return (
              <Card key={payment.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                    <div className="w-full sm:w-auto">
                      <CardTitle className="flex items-center gap-2 text-base flex-wrap">
                        <span className="truncate max-w-[200px]">{payment.userEmail}</span>
                        <Badge className="bg-primary text-primary-foreground text-xs whitespace-nowrap">
                          {tierInfo.name}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="text-xs mt-1">
                        {new Date(payment.createdAt).toLocaleString('pt-BR')}
                      </CardDescription>
                    </div>
                    <Badge variant="outline" className="self-start sm:self-center bg-background/50">
                      {payment.amount.toLocaleString('pt-AO')} Kzs
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(payment.proofUrl, '_blank')}
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Ver Comprovante
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleApprove(payment)}
                      disabled={actionLoading}
                      size="sm"
                      className="flex-1"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Aprovar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
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

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Pagamento</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição
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
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPayments;
