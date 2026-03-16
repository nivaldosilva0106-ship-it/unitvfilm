// ... (imports)
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getSiteSettings, updateSiteSettings } from "@/lib/firebase";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { exportContent, importContent } from "@/lib/contentBackup";

export const AdminSettings = () => {
    const [loginBgUrl, setLoginBgUrl] = useState("");
    const [holidayDecorationsEnabled, setHolidayDecorationsEnabled] = useState(false);
    const [holidayDecorationsType, setHolidayDecorationsType] = useState<'christmas' | 'newyear' | 'both'>('christmas');
    const [youtubeApiKey, setYoutubeApiKey] = useState("");
    const [loading, setLoading] = useState(true);

    // Export/Import State
    const [exportFilters, setExportFilters] = useState({
        movie: false,
        series: false,
        tv: false,
        nostalgia: false
    });
    const [isImporting, setIsImporting] = useState(false);

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
            setYoutubeApiKey(settings.youtubeApiKey || "");
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
                holidayDecorationsType,
                youtubeApiKey
            });
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Erro ao salvar configurações");
        }
    };

    const handleExport = async () => {
        const categories = Object.entries(exportFilters)
            .filter(([_, checked]) => checked)
            .map(([key]) => key);

        await exportContent(categories);
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (confirm("Você tem certeza que deseja importar este arquivo? Isso atualizará o conteúdo existente com o mesmo ID.")) {
            setIsImporting(true);
            try {
                await importContent(file);
                e.target.value = ""; // Reset input
            } finally {
                setIsImporting(false);
            }
        } else {
            e.target.value = "";
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

                {/* YouTube API Key Settings */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        🔑 YouTube API Key
                    </h2>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="youtubeApiKey">API Key do YouTube Data v3</Label>
                            <Input
                                id="youtubeApiKey"
                                type="password"
                                placeholder="AIzaSy..."
                                value={youtubeApiKey}
                                onChange={(e) => setYoutubeApiKey(e.target.value)}
                                className="bg-background/50 font-mono"
                            />
                            <p className="text-sm text-muted-foreground">
                                Esta chave é usada para importar playlists do YouTube automaticamente no NostalgiaTube.
                                <br />
                                <a
                                    href="https://console.cloud.google.com/apis/credentials"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-primary hover:underline"
                                >
                                    Obter uma chave API →
                                </a>
                            </p>
                        </div>
                        {youtubeApiKey && (
                            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <p className="text-xs text-green-500 font-medium">✓ API Key configurada</p>
                            </div>
                        )}
                    </form>
                </div>

                {/* Content Server Management */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                        💾 Gerenciar Conteúdo do Servidor
                    </h2>

                    <div className="grid md:grid-cols-2 gap-8">
                        {/* Export Section */}
                        <div className="space-y-4">
                            <h3 className="font-medium">Exportar Conteúdo</h3>
                            <p className="text-sm text-muted-foreground">
                                Selecione as categorias para baixar um backup JSON.
                            </p>

                            <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="filter-movie"
                                        checked={exportFilters.movie}
                                        onCheckedChange={(checked) => setExportFilters(prev => ({ ...prev, movie: checked === true }))}
                                    />
                                    <Label htmlFor="filter-movie">Filmes</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="filter-series"
                                        checked={exportFilters.series}
                                        onCheckedChange={(checked) => setExportFilters(prev => ({ ...prev, series: checked === true }))}
                                    />
                                    <Label htmlFor="filter-series">Séries</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="filter-tv"
                                        checked={exportFilters.tv}
                                        onCheckedChange={(checked) => setExportFilters(prev => ({ ...prev, tv: checked === true }))}
                                    />
                                    <Label htmlFor="filter-tv">TV Ao Vivo</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="filter-nostalgia"
                                        checked={exportFilters.nostalgia}
                                        onCheckedChange={(checked) => setExportFilters(prev => ({ ...prev, nostalgia: checked === true }))}
                                    />
                                    <Label htmlFor="filter-nostalgia">NostalgiaTube</Label>
                                </div>
                            </div>

                            <Button
                                onClick={handleExport}
                                disabled={!Object.values(exportFilters).some(v => v)}
                                variant="outline"
                                className="w-full"
                            >
                                📥 Baixar Backup
                            </Button>
                        </div>

                        {/* Import Section */}
                        <div className="space-y-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-8">
                            <h3 className="font-medium">Importar Conteúdo</h3>
                            <p className="text-sm text-muted-foreground">
                                Envie um arquivo JSON para restaurar ou adicionar conteúdo.
                            </p>

                            <div className="p-4 border-2 border-dashed border-border rounded-lg bg-background/50 text-center space-y-2">
                                <Input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    disabled={isImporting}
                                    className="cursor-pointer"
                                />
                                <p className="text-xs text-muted-foreground">
                                    O arquivo deve seguir a estrutura padrão do servidor.
                                </p>
                            </div>

                            {isImporting && <p className="text-sm text-yellow-500">Processando arquivo...</p>}

                            <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                                <p className="text-xs text-yellow-500 font-medium">
                                    ⚠️ Atenção: Itens com IDs existentes serão atualizados.
                                </p>
                            </div>
                        </div>
                    </div>
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
