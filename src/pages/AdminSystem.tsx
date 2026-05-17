import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { getAllUsers, getAllContents, getPlans, getAllAds, firebaseConfig } from "@/lib/firebase";
import { getSupabaseConfig, getSupabaseClient } from "@/lib/supabase";
import { 
  Shield, Server, Database, Activity, HardDrive, 
  RefreshCw, Play, CheckCircle2, XCircle, Copy, 
  FileJson, Upload, AlertTriangle, ChevronDown, ChevronUp 
} from "lucide-react";

export default function AdminSystem() {
    const [stats, setStats] = useState({ users: 0, content: 0, plans: 0, ads: 0 });
    const [loading, setLoading] = useState(true);
    
    // Supabase Connection States
    const [supabaseUrl, setSupabaseUrl] = useState("");
    const [supabaseKey, setSupabaseKey] = useState("");
    const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [connectionMessage, setConnectionMessage] = useState("");
    
    // Collapsible states
    const [showSql, setShowSql] = useState(false);
    const [copySuccess, setCopySuccess] = useState(false);
    
    // Importer states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [parsedData, setParsedData] = useState<any>(null);
    const [importing, setImporting] = useState(false);
    const [importProgress, setImportProgress] = useState(0);
    const [importLogs, setImportLogs] = useState<string[]>([]);

    useEffect(() => {
        // Load stats
        Promise.all([getAllUsers(), getAllContents(), getPlans(), getAllAds()])
            .then(([users, contents, plans, ads]) => {
                setStats({
                    users: users.length,
                    content: contents.length,
                    plans: plans.length,
                    ads: ads.length
                });
            })
            .catch(err => console.error("Erro ao carregar stats", err))
            .finally(() => setLoading(false));

        // Load Supabase credentials
        const config = getSupabaseConfig();
        setSupabaseUrl(config.url);
        setSupabaseKey(config.key);
    }, []);

    // Save Supabase settings
    const handleSaveSupabase = () => {
        localStorage.setItem("supabase_url", supabaseUrl.trim());
        localStorage.setItem("supabase_anon_key", supabaseKey.trim());
        setConnectionStatus("idle");
        setConnectionMessage("Configurações salvas localmente! Teste a conexão para validar.");
    };

    // Clear Supabase settings (fallback to Firebase)
    const handleClearSupabase = () => {
        localStorage.removeItem("supabase_url");
        localStorage.removeItem("supabase_anon_key");
        setSupabaseUrl("");
        setSupabaseKey("");
        setConnectionStatus("idle");
        setConnectionMessage("Configurações limpas! O site voltou a operar via Firebase.");
    };

    // Test Supabase connection
    const handleTestConnection = async () => {
        if (!supabaseUrl.trim() || !supabaseKey.trim()) {
            setConnectionStatus("error");
            setConnectionMessage("Por favor, preencha a URL e a Anon Key do Supabase.");
            return;
        }

        setConnectionStatus("testing");
        setConnectionMessage("Conectando ao cluster do Supabase...");

        try {
            // Save temporarily
            localStorage.setItem("supabase_url", supabaseUrl.trim());
            localStorage.setItem("supabase_anon_key", supabaseKey.trim());
            
            const supabase = getSupabaseClient();
            if (!supabase) {
                throw new Error("Não foi possível instanciar o cliente do Supabase.");
            }

            // Test query on 'contents' table to see if it exists
            const { error: contentsError } = await supabase.from("contents").select("id").limit(1);
            
            if (contentsError) {
                if (contentsError.code === "42P01") {
                    throw new Error("Tabela 'contents' não foi criada. Execute o script SQL de tabelas primeiro!");
                }
                throw contentsError;
            }

            // Test query on 'profiles' table
            const { error: profilesError } = await supabase.from("profiles").select("id").limit(1);
            if (profilesError && profilesError.code === "42P01") {
                throw new Error("Tabela 'profiles' não encontrada. Verifique se executou todo o script SQL.");
            }

            setConnectionStatus("success");
            setConnectionMessage("Conectado com sucesso! Banco de dados totalmente operacional.");
        } catch (err: any) {
            console.error(err);
            setConnectionStatus("error");
            setConnectionMessage(err.message || "Erro de conexão. Verifique suas credenciais e rede.");
        }
    };

    // Handle File Selection
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setSelectedFile(file);
        setImportLogs([]);
        setImportProgress(0);
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setParsedData(json);
                addLog(`Arquivo carregado com sucesso. Tamanho: ${(file.size / 1024).toFixed(1)} KB`);
            } catch (err) {
                setParsedData(null);
                setSelectedFile(null);
                alert("Arquivo JSON inválido. Verifique a formatação do backup.");
            }
        };
        reader.readAsText(file);
    };

    const addLog = (msg: string) => {
        setImportLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
    };

    // Batch JSON importer
    const handleImportData = async () => {
        if (!parsedData) return;
        
        const supabase = getSupabaseClient();
        if (!supabase) {
            alert("Por favor, conecte e teste o Supabase com sucesso primeiro.");
            return;
        }

        setImporting(true);
        setImportProgress(0);
        setImportLogs([]);
        addLog("Iniciando processo de migração para o Supabase...");

        try {
            // 1. Process Settings
            if (parsedData.settings) {
                addLog("Importando Configurações Gerais...");
                const { error } = await supabase.from("settings").upsert({
                    key: "site",
                    value: parsedData.settings
                });
                if (error) throw error;
                addLog("✓ Configurações Gerais importadas!");
            }
            
            if (parsedData.sliderSettings) {
                addLog("Importando Configurações do Banner...");
                const { error } = await supabase.from("settings").upsert({
                    key: "slider",
                    value: parsedData.sliderSettings
                });
                if (error) throw error;
                addLog("✓ Configurações do Banner importadas!");
            }

            setImportProgress(10);

            // 2. Process Plans
            if (parsedData.plans) {
                addLog("Importando Planos de Assinatura...");
                const plansList = Object.entries(parsedData.plans).map(([id, p]: [string, any]) => ({
                    id,
                    name: p.name || "",
                    description: p.description || "",
                    price: Number(p.price) || 0,
                    durationDays: Number(p.durationDays) || 30,
                    limits: p.limits || { maxProfiles: 2 },
                    features: p.features || [],
                    isActive: p.isActive !== undefined ? p.isActive : true,
                    requiresVerification: p.requiresVerification || false,
                    whatsappNumber: p.whatsappNumber || ""
                }));
                
                const { error } = await supabase.from("plans").upsert(plansList);
                if (error) throw error;
                addLog(`✓ ${plansList.length} planos importados com sucesso!`);
            }

            setImportProgress(20);

            // 3. Process Ads
            if (parsedData.ads) {
                addLog("Importando Campanhas de Anúncios...");
                const adsList = Object.entries(parsedData.ads).map(([id, a]: [string, any]) => ({
                    id,
                    title: a.title || "",
                    url: a.url || "",
                    imageUrl: a.imageUrl || "",
                    placement: a.placement || "home_banner",
                    active: a.active !== undefined ? a.active : true,
                    createdAt: a.createdAt || new Date().toISOString()
                }));
                
                const { error } = await supabase.from("ads").upsert(adsList);
                if (error) throw error;
                addLog(`✓ ${adsList.length} anúncios importados!`);
            }

            setImportProgress(30);

            // 4. Process Profiles
            if (parsedData.profiles) {
                addLog("Importando Contas de Usuários...");
                const profilesList = Object.entries(parsedData.profiles).map(([id, p]: [string, any]) => ({
                    id,
                    email: p.email || "",
                    isPremium: p.isPremium || false,
                    subscriptionTier: p.subscriptionTier || "free",
                    planId: p.planId || "free",
                    status: p.status || "active",
                    subscriptionExpiresAt: p.subscriptionExpiresAt || null,
                    createdAt: p.createdAt || new Date().toISOString(),
                    credits: p.credits || { date: "", moviesWatched: 0, episodesWatched: 0 },
                    currentLimits: p.currentLimits || null,
                    lastSeen: p.lastSeen || null,
                    currentProfileName: p.currentProfileName || null,
                    currentProfileAvatar: p.currentProfileAvatar || null,
                    lastExpiryNotification: p.lastExpiryNotification || null,
                    lastIPTVGeneratedAt: p.lastIPTVGeneratedAt || null,
                    phone: p.phone || "",
                    displayName: p.displayName || "",
                    trialSignup: p.trialSignup || false
                }));
                
                // Chunk profiles (blocks of 50)
                const chunkSize = 50;
                for (let i = 0; i < profilesList.length; i += chunkSize) {
                    const chunk = profilesList.slice(i, i + chunkSize);
                    const { error } = await supabase.from("profiles").upsert(chunk);
                    if (error) throw error;
                    addLog(`Migrando Usuários (${i + chunk.length} de ${profilesList.length})...`);
                    setImportProgress(30 + Math.round((i / profilesList.length) * 20));
                }
                addLog(`✓ ${profilesList.length} usuários migrados com sucesso!`);
            }

            // 4.5. Process Sub-Profiles (accountProfiles)
            if (parsedData.accountProfiles) {
                addLog("Importando Perfis de Contas (Sub-perfis)...");
                const subProfilesList: any[] = [];
                Object.entries(parsedData.accountProfiles).forEach(([userId, profilesObj]: [string, any]) => {
                    if (profilesObj && typeof profilesObj === 'object') {
                        Object.entries(profilesObj).forEach(([subProfileId, p]: [string, any]) => {
                            if (p && typeof p === 'object') {
                                subProfilesList.push({
                                    id: subProfileId,
                                    userId: userId,
                                    name: p.name || "Perfil",
                                    avatar: p.avatar || "",
                                    avatarUrl: p.avatar || "",
                                    isKids: p.isKids || false,
                                    pin: p.pin || null,
                                    pinAttempts: p.pinAttempts || 0,
                                    lockoutUntil: p.lockoutUntil || null,
                                    createdAt: p.createdAt || new Date().toISOString(),
                                    showLocalLibrary: p.showLocalLibrary || false
                                });
                            }
                        });
                    }
                });

                if (subProfilesList.length > 0) {
                    const { error } = await supabase.from("account_profiles").upsert(subProfilesList);
                    if (error) throw error;
                    addLog(`✓ ${subProfilesList.length} sub-perfis de contas importados!`);
                }
            }

            // 4.6. Process Admins
            if (parsedData.admins) {
                addLog("Importando Perfis Administrativos...");
                const adminsList = Object.entries(parsedData.admins).map(([id, a]: [string, any]) => ({
                    id,
                    email: a.email || "",
                    createdAt: a.createdAt || new Date().toISOString()
                }));

                if (adminsList.length > 0) {
                    const { error } = await supabase.from("admins").upsert(adminsList);
                    if (error) throw error;
                    addLog(`✓ ${adminsList.length} administradores migrados!`);
                }
            }

            setImportProgress(50);

            // 5. Process Contents (The Catalog)
            if (parsedData.contents) {
                addLog("Importando Catálogo de Filmes e Séries...");
                const rawContents = Object.entries(parsedData.contents).map(([id, c]: [string, any]) => ({
                    id,
                    title: c.title || "",
                    category: c.category || "Filmes",
                    description: c.description || "",
                    thumbnail_url: c.thumbnail_url || c.imageUrl || "",
                    video_url: c.video_url || "",
                    internal_player_url: c.internal_player_url || "",
                    subtitle_url: c.subtitle_url || "",
                    is_new: c.is_new || false,
                    new_since: c.new_since || "",
                    video_urls: c.video_urls || [],
                    episodes: c.episodes || [],
                    download_url: c.download_url || "",
                    trailer_url: c.trailer_url || "",
                    language: c.language || "",
                    release_date: c.release_date || "",
                    tmdb_id: c.tmdb_id ? Number(c.tmdb_id) : null,
                    rating: c.rating ? Number(c.rating) : null,
                    isPremium: c.isPremium || false,
                    likes: Number(c.likes) || 0,
                    dislikes: Number(c.dislikes) || 0,
                    classification: c.classification || "",
                    cast: c.cast || "",
                    duration: c.duration || "",
                    year: c.year ? Number(c.year) : null,
                    genre: c.genre || [],
                    backdrop_url: c.backdrop_url || "",
                    adBlockFriendly: c.adBlockFriendly !== undefined ? c.adBlockFriendly : true,
                    download_mode: c.download_mode || "direct",
                    downloads: c.downloads || [],
                    is_cinema_mode: c.is_cinema_mode || false,
                    cast_members: c.cast_members || [],
                    google_drive_url: c.google_drive_url || "",
                    tiktok_url: c.tiktok_url || "",
                    channel_logo_url: c.channel_logo_url || "",
                    watermark_position: c.watermark_position || "top-right",
                    watermark_size: Number(c.watermark_size) || 10,
                    mobile_watermark_position: c.mobile_watermark_position || "top-right",
                    mobile_watermark_size: Number(c.mobile_watermark_size) || 8,
                    main_video_id: c.main_video_id || "",
                    interval_list: c.interval_list || [],
                    ad_list: c.ad_list || [],
                    shuffle_intervals: c.shuffle_intervals || false,
                    shuffle_ads: c.shuffle_ads || false,
                    break_frequency: Number(c.break_frequency) || 15,
                    global_intervals_count: Number(c.global_intervals_count) || 0,
                    global_ads_count: Number(c.global_ads_count) || 0,
                    post_break_logo_url: c.post_break_logo_url || "",
                    watch_provider: c.watch_provider || "",
                    external_sync_enabled: c.external_sync_enabled || false,
                    external_source_url: c.external_source_url || ""
                }));

                const chunkSize = 50;
                for (let i = 0; i < rawContents.length; i += chunkSize) {
                    const chunk = rawContents.slice(i, i + chunkSize);
                    const { error } = await supabase.from("contents").upsert(chunk);
                    if (error) throw error;
                    addLog(`Migrando Catálogo (${i + chunk.length} de ${rawContents.length})...`);
                    setImportProgress(50 + Math.round((i / rawContents.length) * 45));
                }
                addLog(`✓ ${rawContents.length} mídias integradas com sucesso!`);
            }

            setImportProgress(100);
            addLog("🎉 Processo de Migração concluído com total sucesso!");
            alert("Backup integrado com sucesso no Supabase!");
        } catch (error: any) {
            console.error("Migration failed:", error);
            addLog(`❌ ERRO NA MIGRAÇÃO: ${error.message || JSON.stringify(error)}`);
            alert("Ocorreu um erro durante a importação. Veja o log de console.");
        } finally {
            setImporting(false);
        }
    };

    // Copy SQL instructions
    const handleCopySql = () => {
        navigator.clipboard.writeText(SQL_SCHEMA);
        setCopySuccess(true);
        setTimeout(() => setCopySuccess(false), 2000);
    };

    return (
        <AdminLayout title="Sistema e Servidor">
            <div className="space-y-8 animate-in fade-in duration-500 pb-10">

                {/* Visão Geral */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                        <Activity className="w-5 h-5 text-red-500" /> Visão Geral do Sistema
                    </h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
                        <Card className="bg-zinc-950/60 border-zinc-800/80 backdrop-blur-md">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Total Usuários</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-white">{loading ? "..." : stats.users}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-950/60 border-zinc-800/80 backdrop-blur-md">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Conteúdos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-white">{loading ? "..." : stats.content}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-950/60 border-zinc-800/80 backdrop-blur-md">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Planos Ativos</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-white">{loading ? "..." : stats.plans}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-zinc-950/60 border-zinc-800/80 backdrop-blur-md">
                            <CardHeader className="pb-1">
                                <CardTitle className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Anúncios</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-3xl font-black text-white">{loading ? "..." : stats.ads}</div>
                            </CardContent>
                        </Card>
                    </div>
                </div>

                {/* Supabase Integration Card */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                        <Server className="w-5 h-5 text-red-500" /> Servidor de Escalar (Supabase)
                    </h2>
                    <Card className="bg-zinc-950/80 border-zinc-800/80 backdrop-blur-lg">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Integração Supabase</CardTitle>
                            <CardDescription>
                                Substitua o Firebase RTDB pelo Supabase para lidar com volumes gigantescos de dados de catálogo de forma instantânea e sem limites de cota grátis.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Supabase URL</Label>
                                    <Input 
                                        placeholder="https://sua-id.supabase.co" 
                                        value={supabaseUrl}
                                        onChange={e => setSupabaseUrl(e.target.value)}
                                        className="bg-black/50 border-zinc-800 focus:border-red-500 text-white font-mono text-sm"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-zinc-300">Supabase Anon Key</Label>
                                    <Input 
                                        placeholder="eyJhbGciOi..." 
                                        type="password"
                                        value={supabaseKey}
                                        onChange={e => setSupabaseKey(e.target.value)}
                                        className="bg-black/50 border-zinc-800 focus:border-red-500 text-white font-mono text-sm"
                                    />
                                </div>
                            </div>

                            {/* Status message */}
                            {connectionMessage && (
                                <div className={`p-4 rounded-lg flex items-start gap-3 border ${
                                    connectionStatus === "success" 
                                        ? "bg-green-500/10 border-green-500/20 text-green-400"
                                        : connectionStatus === "error"
                                        ? "bg-red-500/10 border-red-500/20 text-red-400"
                                        : "bg-zinc-500/10 border-zinc-500/20 text-zinc-300"
                                }`}>
                                    {connectionStatus === "success" && <CheckCircle2 className="w-5 h-5 shrink-0" />}
                                    {connectionStatus === "error" && <XCircle className="w-5 h-5 shrink-0" />}
                                    {connectionStatus === "testing" && <RefreshCw className="w-5 h-5 animate-spin shrink-0" />}
                                    <span className="text-xs font-semibold">{connectionMessage}</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-3">
                                <Button 
                                    onClick={handleTestConnection}
                                    disabled={connectionStatus === "testing"}
                                    className="bg-red-600 hover:bg-red-700 text-white font-bold"
                                >
                                    {connectionStatus === "testing" ? "Testando..." : "Testar Conexão"}
                                </Button>
                                <Button 
                                    onClick={handleSaveSupabase}
                                    variant="outline"
                                    className="border-zinc-700 hover:bg-zinc-900 text-zinc-200"
                                >
                                    Salvar Credenciais
                                </Button>
                                {(localStorage.getItem("supabase_url")) && (
                                    <Button 
                                        onClick={handleClearSupabase}
                                        variant="ghost"
                                        className="text-zinc-400 hover:text-white hover:bg-zinc-900"
                                    >
                                        Limpar Conexão (Voltar ao Firebase)
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Step 2: SQL Scripts */}
                <div>
                    <Card className="bg-zinc-950/80 border-zinc-800/80">
                        <CardHeader className="cursor-pointer select-none" onClick={() => setShowSql(!showSql)}>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-md text-white flex items-center gap-2">
                                        <Database className="w-4 h-4 text-red-500" /> Script de Estrutura SQL (Supabase Dashboard)
                                    </CardTitle>
                                    <CardDescription>
                                        Clique aqui para visualizar o script SQL necessário para criar as tabelas no Supabase.
                                    </CardDescription>
                                </div>
                                {showSql ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
                            </div>
                        </CardHeader>
                        {showSql && (
                            <CardContent className="space-y-4 pt-0">
                                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                    <p className="text-xs text-zinc-300">
                                        Copie todo o script abaixo, acesse o painel do seu <strong>Supabase &gt; SQL Editor &gt; New Query</strong>, cole o código e clique em <strong>Run</strong>. Isso criará toda a estrutura de banco necessária.
                                    </p>
                                </div>
                                <div className="relative">
                                    <pre className="p-4 bg-black/80 rounded-lg text-xs font-mono text-zinc-400 overflow-x-auto max-h-[300px] border border-zinc-800">
                                        {SQL_SCHEMA}
                                    </pre>
                                    <Button 
                                        onClick={handleCopySql} 
                                        className="absolute top-2 right-2 bg-zinc-800 hover:bg-zinc-700 text-white p-2 text-xs h-7 flex items-center gap-1.5"
                                    >
                                        <Copy className="w-3.5 h-3.5" />
                                        {copySuccess ? "Copiado!" : "Copiar SQL"}
                                    </Button>
                                </div>
                            </CardContent>
                        )}
                    </Card>
                </div>

                {/* Step 3: Migration Importer */}
                <div>
                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-white">
                        <HardDrive className="w-5 h-5 text-red-500" /> Importador Inteligente de Backup JSON
                    </h2>
                    <Card className="bg-zinc-950/80 border-zinc-800/80 backdrop-blur-lg">
                        <CardHeader>
                            <CardTitle className="text-lg text-white">Migrador Automático</CardTitle>
                            <CardDescription>
                                Carregue o arquivo `.json` de backup contendo todos os dados do Firebase para migrar todo o catálogo, usuários, planos e anúncios de forma automatizada.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            
                            {/* File Upload Box */}
                            <div className="border border-dashed border-zinc-800 rounded-lg p-6 flex flex-col items-center justify-center bg-black/30 hover:bg-black/50 transition-colors">
                                <FileJson className="w-12 h-12 text-zinc-600 mb-3" />
                                <Label htmlFor="json-upload" className="cursor-pointer text-sm font-bold text-red-500 hover:underline flex items-center gap-2">
                                    <Upload className="w-4 h-4" /> Selecionar Arquivo JSON
                                </Label>
                                <Input 
                                    id="json-upload" 
                                    type="file" 
                                    accept=".json" 
                                    onChange={handleFileChange} 
                                    className="hidden" 
                                />
                                {selectedFile && (
                                    <p className="mt-2 text-xs font-semibold text-zinc-400">
                                        Arquivo: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                    </p>
                                )}
                            </div>

                            {/* Parsed summary */}
                            {parsedData && (
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 bg-zinc-900/40 rounded-lg border border-zinc-800">
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">
                                            {parsedData.contents ? Object.keys(parsedData.contents).length : 0}
                                        </div>
                                        <div className="text-xs text-zinc-500">Mídias</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">
                                            {parsedData.profiles ? Object.keys(parsedData.profiles).length : 0}
                                        </div>
                                        <div className="text-xs text-zinc-500">Usuários</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">
                                            {parsedData.plans ? Object.keys(parsedData.plans).length : 0}
                                        </div>
                                        <div className="text-xs text-zinc-500">Planos</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">
                                            {parsedData.ads ? Object.keys(parsedData.ads).length : 0}
                                        </div>
                                        <div className="text-xs text-zinc-500">Anúncios</div>
                                    </div>
                                    <div className="text-center">
                                        <div className="text-lg font-bold text-white">
                                            {parsedData.settings ? "Sim" : "Não"}
                                        </div>
                                        <div className="text-xs text-zinc-500">Ajustes</div>
                                    </div>
                                </div>
                            )}

                            {/* Progress bar */}
                            {importing && (
                                <div className="space-y-2">
                                    <div className="flex justify-between text-xs text-zinc-400 font-bold">
                                        <span>Progresso da Migração</span>
                                        <span>{importProgress}%</span>
                                    </div>
                                    <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden">
                                        <div 
                                            className="h-full bg-red-600 transition-all duration-300"
                                            style={{ width: `${importProgress}%` }}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Logger Console */}
                            {importLogs.length > 0 && (
                                <div className="space-y-2">
                                    <Label className="text-xs font-bold text-zinc-400">Terminal do Migrador</Label>
                                    <pre className="p-3 bg-black text-[10px] font-mono text-zinc-500 rounded-lg max-h-[160px] overflow-y-auto border border-zinc-900/80">
                                        {importLogs.map((log, idx) => (
                                            <div key={idx} className={log.includes("❌") ? "text-red-400" : log.includes("✓") || log.includes("🎉") ? "text-green-400" : ""}>
                                                {log}
                                            </div>
                                        ))}
                                    </pre>
                                </div>
                            )}

                            {/* Submit */}
                            {parsedData && (
                                <Button 
                                    onClick={handleImportData}
                                    disabled={importing}
                                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-11 flex items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4 fill-current" />
                                    {importing ? "Executando Importação..." : "Iniciar Migração para o Supabase"}
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Legacy warning */}
                <div>
                    <Card className="bg-zinc-950/60 border-zinc-800/80">
                        <CardContent className="pt-6">
                            <div className="flex items-start gap-3">
                                <Shield className="w-5 h-5 text-zinc-500 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-zinc-300 text-sm">Resiliência de Servidores</h4>
                                    <p className="text-xs text-zinc-500">
                                        Com o Supabase ativo, a aplicação ignora leituras e escritas no banco de dados do Firebase. Caso você deseje retornar ao Firebase, basta clicar no botão "Limpar Conexão". Seus logins de autenticação continuarão funcionando em ambos os modos perfeitamente!
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

            </div>
        </AdminLayout>
    );
}

const SQL_SCHEMA = `-- 1. CONTENTS TABLE
create table if not exists contents (
    id text primary key,
    title text not null,
    category text not null,
    description text,
    thumbnail_url text,
    video_url text,
    internal_player_url text,
    subtitle_url text,
    is_new boolean default false,
    new_since text,
    video_urls jsonb default '[]'::jsonb,
    episodes jsonb default '[]'::jsonb,
    download_url text,
    trailer_url text,
    language text,
    release_date text,
    tmdb_id bigint,
    rating numeric,
    "isPremium" boolean default false,
    likes integer default 0,
    dislikes integer default 0,
    classification text,
    "cast" text,
    duration text,
    year integer,
    genre jsonb default '[]'::jsonb,
    backdrop_url text,
    "adBlockFriendly" boolean default true,
    download_mode text,
    downloads jsonb default '[]'::jsonb,
    is_cinema_mode boolean default false,
    cast_members jsonb default '[]'::jsonb,
    google_drive_url text,
    tiktok_url text,
    channel_logo_url text,
    watermark_position text,
    watermark_size integer,
    mobile_watermark_position text,
    mobile_watermark_size integer,
    main_video_id text,
    interval_list jsonb default '[]'::jsonb,
    ad_list jsonb default '[]'::jsonb,
    shuffle_intervals boolean default false,
    shuffle_ads boolean default false,
    break_frequency numeric,
    global_intervals_count integer,
    global_ads_count integer,
    post_break_logo_url text,
    watch_provider text,
    external_sync_enabled boolean default false,
    external_source_url text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- Enable RLS and allow public read, and full write access
alter table contents enable row level security;
create policy "Allow public read contents" on contents for select to public using (true);
create policy "Allow all contents access" on contents for all using (true) with check (true);

-- 2. SETTINGS TABLE
create table if not exists settings (
    key text primary key,
    value jsonb not null,
    updated_at timestamp with time zone default timezone('utc'::text, now())
);

alter table settings enable row level security;
create policy "Allow public read settings" on settings for select to public using (true);
create policy "Allow all settings access" on settings for all using (true) with check (true);

-- 3. PROFILES TABLE
create table if not exists profiles (
    id text primary key,
    email text,
    "isPremium" boolean default false,
    "subscriptionTier" text default 'free',
    "planId" text default 'free',
    status text default 'active',
    "subscriptionExpiresAt" text,
    "createdAt" text,
    credits jsonb default '{"date":"","moviesWatched":0,"episodesWatched":0}'::jsonb,
    "currentLimits" jsonb,
    "lastSeen" text,
    "currentProfileName" text,
    "currentProfileAvatar" text,
    "lastExpiryNotification" text,
    "lastIPTVGeneratedAt" text,
    phone text,
    "displayName" text,
    "trialSignup" boolean default false
);

alter table profiles enable row level security;
create policy "Allow public read profiles" on profiles for select to public using (true);
create policy "Allow all profiles access" on profiles for all using (true) with check (true);

-- 4. ACCOUNT PROFILES TABLE
create table if not exists account_profiles (
    id text primary key,
    "userId" text not null,
    name text not null,
    avatar text,
    "avatarUrl" text,
    "isKids" boolean default false,
    pin text,
    "pinAttempts" integer default 0,
    "lockoutUntil" text,
    "createdAt" text,
    "showLocalLibrary" boolean default false
);

alter table account_profiles enable row level security;
create policy "Allow public read account_profiles" on account_profiles for select to public using (true);
create policy "Allow all account_profiles access" on account_profiles for all using (true) with check (true);

-- 5. PLANS TABLE
create table if not exists plans (
    id text primary key,
    name text not null,
    description text,
    price numeric not null,
    "durationDays" integer not null,
    limits jsonb not null,
    features jsonb default '[]'::jsonb,
    "isActive" boolean default true,
    "requiresVerification" boolean default false,
    "whatsappNumber" text
);

alter table plans enable row level security;
create policy "Allow public read plans" on plans for select to public using (true);
create policy "Allow all plans access" on plans for all using (true) with check (true);

-- 6. ADS TABLE
create table if not exists ads (
    id text primary key,
    title text not null,
    url text,
    "imageUrl" text,
    placement text,
    active boolean default true,
    "createdAt" text
);

alter table ads enable row level security;
create policy "Allow public read ads" on ads for select to public using (true);
create policy "Allow all ads access" on ads for all using (true) with check (true);

-- 7. MY LIST TABLE
create table if not exists my_list (
    id text primary key,
    "userId" text not null,
    "contentId" text not null,
    content jsonb not null,
    "addedAt" text
);

alter table my_list enable row level security;
create policy "Allow public read my_list" on my_list for select to public using (true);
create policy "Allow all my_list access" on my_list for all using (true) with check (true);

-- 8. VERIFICATION CODES TABLE
create table if not exists verification_codes (
    id text primary key,
    code text not null,
    type text,
    "createdAt" text,
    "expiresAt" text,
    "isUsed" boolean default false,
    "usedBy" text,
    "usedAt" text
);

alter table verification_codes enable row level security;
create policy "Allow public read verification_codes" on verification_codes for select to public using (true);
create policy "Allow all verification_codes access" on verification_codes for all using (true) with check (true);

-- 9. USER PROGRESS TABLE
create table if not exists user_progress (
    id text primary key,
    "userId" text,
    "profileId" text not null,
    "contentId" text not null,
    season integer,
    episode integer,
    "lastPositionSeconds" numeric not null,
    "durationSeconds" numeric,
    "updatedAt" text
);

alter table user_progress enable row level security;
create policy "Allow public read user_progress" on user_progress for select to public using (true);
create policy "Allow all user_progress access" on user_progress for all using (true) with check (true);

-- 10. ADMINS TABLE
create table if not exists admins (
    id text primary key,
    email text not null,
    "createdAt" text
);

alter table admins enable row level security;
create policy "Allow public read admins" on admins for select to public using (true);
create policy "Allow all admins access" on admins for all using (true) with check (true);
`;
