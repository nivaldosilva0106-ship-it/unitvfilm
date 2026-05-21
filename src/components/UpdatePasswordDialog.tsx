import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock } from 'lucide-react';
import { toast } from 'sonner';
import { changePassword } from '@/lib/firebase';
import { getSupabaseClient, isSupabaseEnabled } from '@/lib/supabase';

export const UpdatePasswordDialog = () => {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Escutar evento de recuperação de senha do Supabase
    if (isSupabaseEnabled) {
      const supabase = getSupabaseClient();
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          setOpen(true);
        }
      });
      
      // Também verificar se há hash de recuperação na URL (fallback)
      if (window.location.hash.includes('type=recovery')) {
        setOpen(true);
      }

      return () => {
        subscription.unsubscribe();
      };
    }
  }, []);

  const handleUpdatePassword = async () => {
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
      setOpen(false);
      navigate('/');
    } catch (error: any) {
      console.error('Erro ao atualizar senha:', error);
      toast.error('Ocorreu um erro ao atualizar sua senha. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Não permitir fechar sem atualizar a senha, se foi disparado por recuperação
      if (!isOpen && !loading) {
        setOpen(false);
        // Opcionalmente deslogar o usuário ou redirecionar se ele cancelar
        navigate('/');
      }
    }}>
      <DialogContent className="bg-[#1a1a1a] border-[#333] text-white sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Atualizar Senha</DialogTitle>
          <DialogDescription className="text-gray-400">
            Crie uma nova senha para sua conta.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                id="new-password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                className="pl-10 bg-[#0a0a0a] border-[#333] text-white"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                id="confirm-password"
                type="password"
                placeholder="Confirme a nova senha"
                className="pl-10 bg-[#0a0a0a] border-[#333] text-white"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={handleUpdatePassword}
            disabled={loading}
            className="bg-primary hover:bg-primary/90 text-white w-full"
          >
            {loading ? "Atualizando..." : "Atualizar Senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
