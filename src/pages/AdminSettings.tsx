import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export const AdminSettings = () => {
    const [loginBgUrl, setLoginBgUrl] = useState("");
    const [holidayDecorationsEnabled, setHolidayDecorationsEnabled] = useState(false);
    const [holidayDecorationsType, setHolidayDecorationsType] = useState<'christmas' | 'newyear' | 'both'>('christmas');
    const [loading, setLoading] = useState(true);
    const { isAdmin, loading: authLoading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            navigate("/");
            return;
        }
    }, [isAdmin, authLoading, navigate]);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const settings = await getSiteSettings();
            if (settings.loginBackgroundUrl) {
                setLoginBgUrl(settings.loginBackgroundUrl);
            }
            setHolidayDecorationsEnabled(settings.holidayDecorationsEnabled || false);
            setHolidayDecorationsType(settings.holidayDecorationsType || 'christmas');
        } catch (error) {
            console.error("Error loading settings:", error);
            toast.error("Erro ao carregar configurações");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await updateSiteSettings({
                loginBackgroundUrl: loginBgUrl,
                holidayDecorationsEnabled,
                holidayDecorationsType
            });
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Erro ao salvar configurações");
        }
    };

    if (authLoading || (loading && isAdmin)) {
        return (
            <AdminLayout title="Configurações do Site">
                <div className="flex items-center justify-center py-12">
                    <p className="text-muted-foreground">Carregando...</p>
                </div>
            </AdminLayout>
        );
    }

    if (!isAdmin) return null;

    return (
        <AdminLayout title="Configurações do Site">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Login Background Settings */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4">Imagem de Fundo do Login</h2>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="loginBg">URL da Imagem</Label>
                            <Input
                                id="loginBg"
                                placeholder="https://exemplo.com/imagem.jpg"
                                value={loginBgUrl}
                                onChange={(e) => setLoginBgUrl(e.target.value)}
                                className="bg-background/50"
                            />
                            <p className="text-sm text-muted-foreground">
                                Insira a URL de uma imagem para substituir o fundo padrão da página de login.
                            </p>
                        </div>

                        {loginBgUrl && (
                            <div className="mt-4">
                                <Label>Pré-visualização</Label>
                                <div className="mt-2 relative h-48 rounded-lg overflow-hidden border border-border">
                                    <img
                                        src={loginBgUrl}
                                        alt="Preview"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </form>
                </div>

                {/* Holiday Decorations Settings */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        🎄 Decorações de Natal e Ano Novo
                    </h2>
                    <form onSubmit={handleSave} className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                                <Label htmlFor="decorations-toggle">Ativar Decorações</Label>
                                <p className="text-sm text-muted-foreground">
                                    Exibir decorações festivas em todo o site
                                </p>
                            </div>
                            <Switch
                                id="decorations-toggle"
                                checked={holidayDecorationsEnabled}
                                onCheckedChange={setHolidayDecorationsEnabled}
                            />
                        </div>

                        {holidayDecorationsEnabled && (
                            <div className="space-y-2">
                                <Label htmlFor="decoration-type">Tema das Decorações</Label>
                                <Select value={holidayDecorationsType} onValueChange={(value: 'christmas' | 'newyear' | 'both') => setHolidayDecorationsType(value)}>
                                    <SelectTrigger className="bg-background/50">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="christmas">🎄 Natal (neve, luzes)</SelectItem>
                                        <SelectItem value="newyear">🎆 Ano Novo (fogos, brilhos)</SelectItem>
                                        <SelectItem value="both">🎉 Natal + Ano Novo</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground">
                                    Escolha o tipo de decoração festiva a ser exibida
                                </p>
                            </div>
                        )}

                        {holidayDecorationsEnabled && (
                            <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <h4 className="font-medium text-green-500 text-sm mb-2">✨ Decorações Ativas</h4>
                                <p className="text-xs text-muted-foreground">
                                    {holidayDecorationsType === 'christmas' && 'As decorações de Natal incluem neve a cair, luzes piscantes e elementos festivos.'}
                                    {holidayDecorationsType === 'newyear' && 'As decorações de Ano Novo incluem fogos de artifício, brilhos e elementos festivos.'}
                                    {holidayDecorationsType === 'both' && 'Todas as decorações de Natal e Ano Novo estão ativas!'}
                                </p>
                            </div>
                        )}
                    </form>
                </div>

                {/* Save Button */}
                <div className="flex justify-end">
                    <Button onClick={handleSave} className="w-full md:w-auto">
                        Salvar Configurações
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
};
