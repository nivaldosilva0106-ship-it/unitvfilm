import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";

export const AdminSettings = () => {
    const [loginBgUrl, setLoginBgUrl] = useState("");
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
            await updateSiteSettings({ loginBackgroundUrl: loginBgUrl });
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
            <div className="max-w-2xl mx-auto bg-card border border-border rounded-lg p-6">
                <form onSubmit={handleSave} className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="loginBg">URL da Imagem de Fundo do Login</Label>
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

                    <div className="pt-4">
                        <Button type="submit" className="w-full md:w-auto">
                            Salvar Configurações
                        </Button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
};
