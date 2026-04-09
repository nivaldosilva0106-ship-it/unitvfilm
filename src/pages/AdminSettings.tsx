// ... (imports)
import { useState, useEffect } from "react";
import { Copy, Check, AlertTriangle, Globe, Info } from "lucide-react";
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
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [officialSiteUrl, setOfficialSiteUrl] = useState("");
    const [loading, setLoading] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

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
            setWhatsappNumber(settings.whatsappNumber || "");
            setOfficialSiteUrl(settings.officialSiteUrl || "");
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
                youtubeApiKey,
                whatsappNumber,
                officialSiteUrl
            });
            toast.success("Configurações salvas com sucesso!");
        } catch (error) {
            console.error("Error saving settings:", error);
            toast.error("Erro ao salvar configurações");
        }
    };
    
    const handleCopyApiKey = async () => {
        if (!youtubeApiKey) return;
        try {
            await navigator.clipboard.writeText(youtubeApiKey);
            setIsCopied(true);
            toast.success("Chave API copiada!");
            setTimeout(() => setIsCopied(false), 2000);
        } catch (err) {
            toast.error("Erro ao copiar chave");
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
                            <div className="flex gap-2">
                                <Input
                                    id="youtubeApiKey"
                                    type="password"
                                    placeholder="AIzaSy..."
                                    value={youtubeApiKey}
                                    onChange={(e) => setYoutubeApiKey(e.target.value)}
                                    className="bg-background/50 font-mono"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    onClick={handleCopyApiKey}
                                    disabled={!youtubeApiKey}
                                    className="shrink-0"
                                    title="Copiar Chave API"
                                >
                                    {isCopied ? (
                                        <Check className="h-4 w-4 text-green-500" />
                                    ) : (
                                        <Copy className="h-4 w-4" />
                                    )}
                                </Button>
                            </div>
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

                {/* WhatsApp Payment Configuration */}
                <div className="bg-card border border-border rounded-lg p-6">
                    <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                        <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> 
                        Configuração de Pagamento (WhatsApp)
                    </h2>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="whatsappNumber">Número de Telefone</Label>
                            <Input
                                id="whatsappNumber"
                                placeholder="2449XXXXXXXXX"
                                value={whatsappNumber}
                                onChange={(e) => setWhatsappNumber(e.target.value.replace(/\D/g, ''))}
                                className="bg-background/50 font-mono"
                            />
                            <p className="text-sm text-muted-foreground">
                                Este número será usado para redirecionar usuários após o registro de planos pagos.
                                <br />
                                <span className="text-xs italic text-yellow-500/80">
                                    Nota: Use o formato internacional (ex: 244944016791)
                                </span>
                            </p>
                </div>
            </div>

            {/* Site Domain / Redirection */}
            <div className="bg-card border border-border rounded-lg p-6">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                    <Globe className="w-5 h-5 text-blue-500" />
                    Domínio do Site / Redirecionamento
                </h2>
                <div className="space-y-4">
                    <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <div className="text-sm">
                            <p className="text-amber-500 font-bold mb-1">Atenção: Risco de Bloqueio</p>
                            <p className="text-muted-foreground leading-relaxed">
                                Ao definir um domínio oficial, **todos os usuários** que entrarem por qualquer outra URL (ex: vercel.app) serão redirecionados. 
                                Certifique-se de que a URL inserida está correta e ativa.
                            </p>
                            <div className="mt-3 p-2 bg-black/40 rounded border border-white/10 font-mono text-[10px]">
                                <p className="text-blue-400 mb-1 font-bold">Modo de Segurança (Caso algo corra mal):</p>
                                <p className="text-zinc-400">Adicione <span className="text-white">?bypass_redirect=true</span> ao final de qualquer URL para ignorar o redirecionamento.</p>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="officialUrl">URL Oficial do Site</Label>
                        <Input
                            id="officialUrl"
                            placeholder="https://meudominio.com"
                            value={officialSiteUrl}
                            onChange={(e) => setOfficialSiteUrl(e.target.value)}
                            className="bg-background/50 font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            Exemplo: https://unitvfilms.vercel.app ou https://meusite.com
                        </p>
                    </div>

                    {officialSiteUrl && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-center gap-2">
                            <Info className="w-4 h-4 text-blue-500" />
                            <p className="text-[11px] text-blue-400">
                                Redirecionamento ativo para usuários fora do domínio oficial.
                            </p>
                        </div>
                    )}
                </div>
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
