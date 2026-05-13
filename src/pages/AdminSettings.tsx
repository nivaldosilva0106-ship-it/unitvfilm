// ... (imports)
import { useState, useEffect } from "react";
import { Copy, Check, AlertTriangle, Globe, Info, Smartphone, MonitorPlay, Loader2, Wifi, WifiOff, Trash2 } from "lucide-react";
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
    const [pwaIconUrl, setPwaIconUrl] = useState("");
    const [apkDownloadUrl, setApkDownloadUrl] = useState("");
    const [apkLiteDownloadUrl, setApkLiteDownloadUrl] = useState("");
    const [requiredAppVersion, setRequiredAppVersion] = useState<number>(1);
    const [requiredLiteAppVersion, setRequiredLiteAppVersion] = useState<number>(1);
    const [appUpdateNotes, setAppUpdateNotes] = useState("");
    const [enableApkDownload, setEnableApkDownload] = useState(false);
    const [enablePwaInstall, setEnablePwaInstall] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    // UniTvIPTV Integration
    const [iptvApiKey, setIptvApiKey] = useState("");
    const [iptvApiBaseUrl, setIptvApiBaseUrl] = useState("");
    const [iptvTestStatus, setIptvTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [iptvTestMessage, setIptvTestMessage] = useState("");

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
            setPwaIconUrl(settings.pwaIconUrl || "");
            setApkDownloadUrl(settings.apkDownloadUrl || "");
            setApkLiteDownloadUrl(settings.apkLiteDownloadUrl || "");
            setRequiredAppVersion(settings.requiredAppVersion || 1);
            setRequiredLiteAppVersion(settings.requiredLiteAppVersion || 1);
            setAppUpdateNotes(settings.appUpdateNotes || "");
            setEnableApkDownload(settings.enableApkDownload || false);
            setEnablePwaInstall(settings.enablePwaInstall || false);
            setIptvApiKey(settings.iptvApiKey || "");
            setIptvApiBaseUrl(settings.iptvApiBaseUrl || "");
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
                officialSiteUrl,
                pwaIconUrl,
                apkDownloadUrl,
                apkLiteDownloadUrl,
                requiredAppVersion,
                requiredLiteAppVersion,
                appUpdateNotes,
                enableApkDownload,
                iptvApiKey,
                iptvApiBaseUrl,
                enablePwaInstall
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

    const handleTestIptvConnection = async () => {
        if (!iptvApiKey || !iptvApiBaseUrl) {
            setIptvTestStatus('error');
            setIptvTestMessage('Preencha a Chave API e a URL Base antes de testar.');
            return;
        }

        setIptvTestStatus('testing');
        setIptvTestMessage('');

        try {
            const response = await fetch('/api/external-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: 'clients',
                    data: {
                        nome_usuario: '__unitvfilm_test__',
                        login_usuario: `test_conn_${Date.now()}`,
                        senha_usuario: 'test_connection'
                    },
                    apiKey: iptvApiKey,
                    baseUrl: iptvApiBaseUrl
                })
            });

            if (response.ok || response.status === 400) {
                // 400 = "login already exists" which still proves the connection works
                setIptvTestStatus('success');
                setIptvTestMessage('Conexão estabelecida com sucesso! A API está respondendo.');
            } else if (response.status === 401) {
                setIptvTestStatus('error');
                setIptvTestMessage('Chave API inválida ou inativa. Verifique no painel UniTvIPTV.');
            } else {
                const result = await response.json().catch(() => ({}));
                setIptvTestStatus('error');
                setIptvTestMessage(result.error || `Erro HTTP ${response.status}`);
            }
        } catch (error: any) {
            setIptvTestStatus('error');
            setIptvTestMessage(`Falha na conexão: ${error.message}`);
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

    const handleClearCache = async () => {
        if (!confirm("Tem certeza que deseja limpar todo o cache do site? Isso fará logout de sessões não guardadas e apagará preferências locais. O site será recarregado.")) {
            return;
        }

        try {
            // Limpar Local Storage (preservando talvez algum auth se o Firebase usar indexDB, 
            // mas o localStorage é seguro apagar para limpeza pesada)
            localStorage.clear();
            
            // Limpar Session Storage
            sessionStorage.clear();
            
            // Limpar caches do navegador (Service Workers, PWA, etc)
            if ('caches' in window) {
                const cacheNames = await caches.keys();
                await Promise.all(cacheNames.map(name => caches.delete(name)));
            }

            toast.success("Cache limpo com sucesso! Recarregando...");
            
            setTimeout(() => {
                window.location.reload();
            }, 1500);
        } catch (error) {
            console.error("Erro ao limpar cache:", error);
            toast.error("Ocorreu um erro ao tentar limpar o cache.");
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
            <div className="max-w-2xl mx-auto">
                <form onSubmit={handleSave} className="space-y-6">
                    {/* Login Background Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4">Imagem de Fundo do Login</h2>
                        <div className="space-y-4">
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
                        </div>
                    </div>

                    {/* Holiday Decorations Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            🎄 Decorações de Natal e Ano Novo
                        </h2>
                        <div className="space-y-6">
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
                        </div>
                    </div>

                    {/* YouTube API Key Settings */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                            🔑 YouTube API Key
                        </h2>
                        <div className="space-y-4">
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
                        </div>
                    </div>

                    {/* WhatsApp Payment Configuration */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                            <svg className="w-5 h-5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg> 
                                Configuração de Pagamento (WhatsApp)
                        </h2>
                        <div className="space-y-4">
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
                    </div>

                    {/* App Installation Configuration (PWA / APK) */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                            <Smartphone className="w-5 h-5 text-purple-500" />
                            Configuração do Aplicativo (PWA / APK)
                        </h2>
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="pwa-toggle">Instalação PWA</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Permitir instalar via navegador
                                            </p>
                                        </div>
                                        <Switch
                                            id="pwa-toggle"
                                            checked={enablePwaInstall}
                                            onCheckedChange={setEnablePwaInstall}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="pwaIcon">URL do Ícone PWA (Diálogo)</Label>
                                        <Input
                                            id="pwaIcon"
                                            placeholder="https://exemplo.com/logo.png"
                                            value={pwaIconUrl}
                                            onChange={(e) => setPwaIconUrl(e.target.value)}
                                            className="bg-background/50"
                                        />
                                        <p className="text-[10px] text-muted-foreground">
                                            Este ícone será exibido no diálogo de instalação dentro do site.
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="space-y-0.5">
                                            <Label htmlFor="apk-toggle">Download APK</Label>
                                            <p className="text-sm text-muted-foreground">
                                                Oferecer download do APK Android
                                            </p>
                                        </div>
                                        <Switch
                                            id="apk-toggle"
                                            checked={enableApkDownload}
                                            onCheckedChange={setEnableApkDownload}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="apkUrl">Link APK Normal</Label>
                                        <Input
                                            id="apkUrl"
                                            placeholder="https://exemplo.com/app.apk"
                                            value={apkDownloadUrl}
                                            onChange={(e) => setApkDownloadUrl(e.target.value)}
                                            className="bg-background/50"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="apkLiteUrl">Link APK Lite (TV Box)</Label>
                                        <Input
                                            id="apkLiteUrl"
                                            placeholder="https://exemplo.com/app-lite.apk"
                                            value={apkLiteDownloadUrl}
                                            onChange={(e) => setApkLiteDownloadUrl(e.target.value)}
                                            className="bg-background/50"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 pt-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="requiredAppVersion">Versão Normal</Label>
                                            <Input
                                                id="requiredAppVersion"
                                                type="number"
                                                min="1"
                                                value={requiredAppVersion}
                                                onChange={(e) => setRequiredAppVersion(parseInt(e.target.value) || 1)}
                                                className="bg-background/50"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="requiredLiteAppVersion">Versão Lite</Label>
                                            <Input
                                                id="requiredLiteAppVersion"
                                                type="number"
                                                min="1"
                                                value={requiredLiteAppVersion}
                                                onChange={(e) => setRequiredLiteAppVersion(parseInt(e.target.value) || 1)}
                                                className="bg-background/50"
                                            />
                                            </div>
                                    </div>
                                    <div className="space-y-2 pt-2">
                                        <Label htmlFor="appUpdateNotes">Notas da Atualização (O que mudou?)</Label>
                                        <textarea
                                            id="appUpdateNotes"
                                            placeholder="Ex: Resolvemos bugs e adicionamos novas funções..."
                                            value={appUpdateNotes}
                                            onChange={(e) => setAppUpdateNotes(e.target.value)}
                                            className="w-full bg-background/50 border border-border rounded-md p-2 text-sm min-h-[80px] focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 outline-none transition-all"
                                        />
                                    </div>
                                    <p className="text-[10px] text-muted-foreground mt-2">
                                        Se a versão instalada for menor que a exigida, o usuário será obrigado a atualizar.
                                    </p>
                                </div>
                            </div>

                            {(pwaIconUrl) && (
                                <div className="pt-4 border-t border-border">
                                    <Label className="mb-2 block">Pré-visualização do Ícone</Label>
                                    <div className="w-16 h-16 rounded-xl bg-zinc-900 border border-white/10 p-2 flex items-center justify-center">
                                        <img src={pwaIconUrl} alt="App Icon" className="w-full h-full object-contain" />
                                    </div>
                                </div>
                            )}
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

                    {/* UniTvIPTV Integration */}
                    <div className="bg-card border border-border rounded-lg p-6">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-white">
                            <MonitorPlay className="w-5 h-5 text-green-500" />
                            Integração UniTvIPTV
                        </h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Configure a conexão com o servidor UniTvIPTV para sincronizar conteúdos e gerar listas IPTV para os usuários.
                        </p>
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="iptvApiBaseUrl">URL Base da API</Label>
                                <Input
                                    id="iptvApiBaseUrl"
                                    placeholder="https://unitviptvs.vercel.app/api/external/v1"
                                    value={iptvApiBaseUrl}
                                    onChange={(e) => setIptvApiBaseUrl(e.target.value)}
                                    className="bg-background/50 font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Endereço completo da API externa. Ex: https://seudominio.com/api/external/v1
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="iptvApiKey">Chave de API (API Key)</Label>
                                <Input
                                    id="iptvApiKey"
                                    type="password"
                                    placeholder="utv_xxxxxxxxxxxxxxxxxxxxxxxxx"
                                    value={iptvApiKey}
                                    onChange={(e) => setIptvApiKey(e.target.value)}
                                    className="bg-background/50 font-mono text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Gere a sua chave no painel administrativo do UniTvIPTV (seção API Keys).
                                </p>
                            </div>

                            <div className="flex items-center gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleTestIptvConnection}
                                    disabled={iptvTestStatus === 'testing' || !iptvApiKey || !iptvApiBaseUrl}
                                    className="shrink-0"
                                >
                                    {iptvTestStatus === 'testing' ? (
                                        <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Testando...</>
                                    ) : (
                                        <><Wifi className="w-4 h-4 mr-2" /> Testar Conexão</>
                                    )}
                                </Button>
                            </div>

                            {iptvTestStatus === 'success' && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
                                    <Wifi className="w-4 h-4 text-green-500" />
                                    <p className="text-xs text-green-500 font-medium">{iptvTestMessage}</p>
                                </div>
                            )}

                            {iptvTestStatus === 'error' && (
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                                    <WifiOff className="w-4 h-4 text-red-500" />
                                    <p className="text-xs text-red-500 font-medium">{iptvTestMessage}</p>
                                </div>
                            )}

                            {iptvApiKey && iptvApiBaseUrl && iptvTestStatus === 'idle' && (
                                <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                    <p className="text-xs text-green-500 font-medium">✓ Credenciais IPTV configuradas</p>
                                </div>
                            )}

                            {(!iptvApiKey || !iptvApiBaseUrl) && (
                                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                                    <p className="text-xs text-amber-500 font-medium">
                                        A sincronização de conteúdo e a geração de listas IPTV ficarão desativadas até que ambos os campos sejam preenchidos.
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
                                    type="button"
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

                    {/* Cache Management */}
                    <div className="bg-card border border-border rounded-lg p-6 border-red-500/20">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-red-500">
                            <Trash2 className="w-5 h-5" />
                            Limpeza de Cache e Dados Locais
                        </h2>
                        
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Se o site estiver lento, com imagens não carregando ou falhando ao ler os links do player, limpar o cache pode resolver. 
                                Isso removerá os dados temporários armazenados no navegador.
                            </p>

                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <p className="text-xs text-red-500 font-medium">
                                    ⚠️ O site será recarregado automaticamente após a limpeza.
                                </p>
                            </div>

                            <Button 
                                type="button" 
                                variant="destructive" 
                                onClick={handleClearCache}
                                className="w-full md:w-auto mt-2"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Limpar Cache do Site
                            </Button>
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pb-8">
                        <Button type="submit" className="w-full md:w-auto">
                            Salvar Todas as Configurações
                        </Button>
                    </div>
                </form>
            </div>
        </AdminLayout>
    );
};
