import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { verifyCode, redeemCode, assignPlanToUser } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export default function VerifyCode() {
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const { user } = useAuth();
    const navigate = useNavigate();

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) {
            toast.error("Faça login primeiro");
            navigate("/login");
            return;
        }

        setLoading(true);
        try {
            // 1. Verify if code is valid and unused
            const verification = await verifyCode(code.trim().toUpperCase());

            if (!verification) {
                toast.error("Código inválido, expirado ou já utilizado.");
                setLoading(false);
                return;
            }

            // 2. Redeem Code
            await redeemCode(user.uid, verification.id);

            // 3. Update User Plan
            await assignPlanToUser(user.uid, verification.planId);

            toast.success("Plano ativado com sucesso!", {
                className: "bg-green-600 border-none text-white",
                icon: <CheckCircle className="w-5 h-5" />
            });

            // Redirect to Home or Profile
            setTimeout(() => navigate("/"), 1500);

        } catch (e) {
            console.error(e);
            toast.error("Erro ao validar código. Contate o suporte.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl p-6 sm:p-8 shadow-xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-xl sm:text-2xl font-bold mb-2">Validar Assinatura</h1>
                    <p className="text-gray-400">Insira o código de confirmação fornecido pelo administrador via WhatsApp.</p>
                </div>

                <form onSubmit={handleVerify} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="code" className="text-base">Código de Confirmação</Label>
                        <Input
                            id="code"
                            value={code}
                            onChange={e => setCode(e.target.value)}
                            placeholder="XXXXXX"
                            className="bg-black/50 border-zinc-700 text-center text-xl sm:text-2xl font-mono tracking-widest uppercase h-14"
                            maxLength={8}
                            required
                        />
                    </div>

                    <Button
                        type="submit"
                        disabled={loading || code.length < 4}
                        className="w-full h-12 text-lg font-bold bg-green-600 hover:bg-green-700 text-white"
                    >
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Ativar Plano"}
                    </Button>
                </form>

                <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded text-sm text-yellow-500 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>Se você ainda não recebeu seu código, envie o comprovante de pagamento para o WhatsApp do suporte: <strong>+244 944 016 791</strong></p>
                </div>
            </div>
        </div>
    );
}
