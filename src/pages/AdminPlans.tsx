import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Copy, RefreshCw } from "lucide-react";
import { getPlans, createPlan, updatePlan, createVerificationCode } from "@/lib/firebase";
import type { Plan } from "@/types/user";

export default function AdminPlans() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState<Partial<Plan>>({});

    // Code Generator State
    const [selectedPlanId, setSelectedPlanId] = useState("");
    const [generatedCode, setGeneratedCode] = useState("");

    useEffect(() => {
        loadPlans();
    }, []);

    const loadPlans = async () => {
        try {
            const data = await getPlans();
            setPlans(data);
        } catch (error) {
            toast.error("Erro ao carregar planos");
        } finally {
            setLoading(false);
        }
    };

    const handleSavePlan = async () => {
        if (!editingPlan.name || !editingPlan.limits) {
            toast.error("Preencha os campos obrigatórios");
            return;
        }

        try {
            const planData = {
                name: editingPlan.name,
                description: editingPlan.description || "",
                price: Number(editingPlan.price) || 0,
                limits: {
                    moviesPerDay: editingPlan.requiresVerification ? -1 : Number(editingPlan.limits?.moviesPerDay ?? 2),
                    episodesPerDay: editingPlan.requiresVerification ? -1 : Number(editingPlan.limits?.episodesPerDay ?? 1),
                    maxProfiles: Number(editingPlan.limits?.maxProfiles) || 2,
                    canDownload: editingPlan.limits?.canDownload || false,
                },
                durationDays: editingPlan.durationDays || 30, // Default 30
                isActive: editingPlan.isActive ?? true,
                requiresVerification: editingPlan.requiresVerification ?? false,
                whatsappNumber: editingPlan.whatsappNumber || ""
            };

            if (editingPlan.id) {
                await updatePlan(editingPlan.id, planData);
                toast.success("Plano atualizado!");
            } else {
                // New Plan
                // Ensure ID logic if needed, but createPlan handles generation?
                // createPlan takes Omit<Plan, 'id'>.
                // But we might want manual ID for 'free'?
                // We'll let firebase generate ID for custom plans.
                // For 'free' plan, user might need to edit manually or we seed it.
                await createPlan(planData as any);
                toast.success("Plano criado!");
            }
            setIsModalOpen(false);
            setEditingPlan({});
            loadPlans();
        } catch (e) {
            toast.error("Erro ao salvar plano");
        }
    };

    const handleEdit = (plan: Plan) => {
        setEditingPlan(plan);
        setIsModalOpen(true);
    };

    const handleGenerateCode = async () => {
        if (!selectedPlanId) {
            toast.error("Selecione um plano");
            return;
        }

        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 30 days validity default? Or 24h?
        // "Código temporário... validade X horas/dias". Let's do 7 days.
        expiresAt.setDate(new Date().getDate() + 7);

        try {
            await createVerificationCode({
                code,
                planId: selectedPlanId,
                createdAt: new Date().toISOString(),
                expiresAt: expiresAt.toISOString(),
                isUsed: false
            });
            setGeneratedCode(code);
            toast.success("Código gerado!");
        } catch (e) {
            toast.error("Erro ao gerar código");
        }
    };

    const copyCode = () => {
        if (generatedCode) {
            navigator.clipboard.writeText(generatedCode);
            toast.success("Copiado!");
        }
    };

    return (
        <AdminLayout title="Gerenciar Planos">
            <div className="space-y-8">
                {/* Code Generator Section */}
                <div className="bg-zinc-900/50 p-6 rounded-lg border border-zinc-800">
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                        <RefreshCw className="w-5 h-5 text-primary" /> Gerador de Código
                    </h2>
                    <div className="flex flex-col md:flex-row gap-4 items-end">
                        <div className="space-y-2 flex-1">
                            <Label>Selecione o Plano</Label>
                            <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Escolha um plano..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {plans.filter(p => p.requiresVerification).map(plan => (
                                        <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleGenerateCode} className="mb-[2px]">Gerar Código</Button>
                    </div>

                    {generatedCode && (
                        <div className="mt-4 p-4 bg-black/40 rounded-lg flex items-center justify-between border border-primary/20">
                            <div className="space-y-1">
                                <Label className="text-xs text-muted-foreground">Código de Verificação</Label>
                                <p className="text-2xl font-mono text-primary font-bold tracking-wider">{generatedCode}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={copyCode}>
                                <Copy className="w-5 h-5" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* Plans List */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold">Planos Disponíveis</h2>
                        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
                            <DialogTrigger asChild>
                                <Button onClick={() => setEditingPlan({ limits: { moviesPerDay: 2, episodesPerDay: 1, maxProfiles: 2, canDownload: false } })}>
                                    <Plus className="w-4 h-4 mr-2" /> Novo Plano
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="max-w-2xl bg-zinc-950 border-zinc-800 text-white max-h-[90vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle>{editingPlan.id ? 'Editar Plano' : 'Criar Novo Plano'}</DialogTitle>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label>Nome do Plano</Label>
                                            <Input value={editingPlan.name || ''} onChange={e => setEditingPlan({ ...editingPlan, name: e.target.value })} placeholder="Ex: Free, Premium" />
                                        </div>
                                        <div className="space-y-2">
                                            <Label>Preço (KZ)</Label>
                                            <Input type="number" value={editingPlan.price || 0} onChange={e => setEditingPlan({ ...editingPlan, price: Number(e.target.value) })} />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Descrição</Label>
                                        <Input value={editingPlan.description || ''} onChange={e => setEditingPlan({ ...editingPlan, description: e.target.value })} />
                                    </div>

                                    <div className="space-y-2">
                                        <Label>Duração do Plano (Dias)</Label>
                                        <Select
                                            value={String(editingPlan.durationDays || 30)}
                                            onValueChange={(v) => setEditingPlan({ ...editingPlan, durationDays: Number(v) })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue placeholder="Selecione..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="7">1 Semana (7 dias)</SelectItem>
                                                <SelectItem value="30">1 Mês (30 dias)</SelectItem>
                                                <SelectItem value="90">3 Meses (90 dias)</SelectItem>
                                                <SelectItem value="365">1 Ano (365 dias)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-4 border-t border-border pt-4">
                                        <h4 className="font-semibold">Regras e Limites</h4>
                                        {/* Only show limits for Free plans (not requiring verification) */}
                                        {!editingPlan.requiresVerification ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="space-y-2">
                                                    <Label>Filmes por Dia</Label>
                                                    <Input type="number" value={editingPlan.limits?.moviesPerDay ?? 2} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, moviesPerDay: Number(e.target.value) } })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Episódios por Dia</Label>
                                                    <Input type="number" value={editingPlan.limits?.episodesPerDay ?? 1} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, episodesPerDay: Number(e.target.value) } })} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Máximo de Perfis</Label>
                                                    <Input type="number" value={editingPlan.limits?.maxProfiles ?? 2} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, maxProfiles: Number(e.target.value) } })} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-500 text-sm">
                                                Planos pagos possuem acesso ilimitado a filmes e séries.
                                                <div className="mt-2 text-white">
                                                    <Label className="text-white mb-1 block">Máximo de Perfis</Label>
                                                    <Input className="bg-black/20 border-white/10" type="number" value={editingPlan.limits?.maxProfiles ?? 2} onChange={e => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, maxProfiles: Number(e.target.value) } })} />
                                                </div>
                                            </div>
                                        )}

                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between bg-zinc-900 p-3 rounded">
                                                <Label>Permitir Downloads?</Label>
                                                <Switch checked={editingPlan.limits?.canDownload || false} onCheckedChange={c => setEditingPlan({ ...editingPlan, limits: { ...editingPlan.limits!, canDownload: c } })} />
                                            </div>

                                            <div className="flex items-center justify-between bg-zinc-900 p-3 rounded">
                                                <Label>Exige Pagamento/Verificação?</Label>
                                                <Switch checked={editingPlan.requiresVerification || false} onCheckedChange={c => setEditingPlan({ ...editingPlan, requiresVerification: c })} />
                                            </div>

                                            {editingPlan.requiresVerification && (
                                                <div className="space-y-2">
                                                    <Label>Número WhatsApp Admin (com código país, sem +)</Label>
                                                    <Input value={editingPlan.whatsappNumber || "244944016791"} onChange={e => setEditingPlan({ ...editingPlan, whatsappNumber: e.target.value })} placeholder="244944016791" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <Button onClick={handleSavePlan} className="w-full">Salvar Plano</Button>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Nome</TableHead>
                                <TableHead>Preço</TableHead>
                                <TableHead>Limites (F/E/P)</TableHead>
                                <TableHead>Download</TableHead>
                                <TableHead>Verificação</TableHead>
                                <TableHead>Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {plans.map(plan => (
                                <TableRow key={plan.id}>
                                    <TableCell className="font-medium">{plan.name}</TableCell>
                                    <TableCell>{plan.price > 0 ? `${plan.price} KZ` : 'Grátis'}</TableCell>
                                    <TableCell>{plan.limits.moviesPerDay === -1 ? '∞' : plan.limits.moviesPerDay} / {plan.limits.episodesPerDay === -1 ? '∞' : plan.limits.episodesPerDay} / {plan.limits.maxProfiles} P</TableCell>
                                    <TableCell>{plan.limits.canDownload ? 'Sim' : 'Não'}</TableCell>
                                    <TableCell>{plan.requiresVerification ? 'Sim' : 'Não'}</TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(plan)}>Editar</Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </div>
        </AdminLayout>
    );
}
