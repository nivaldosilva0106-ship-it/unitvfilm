import { useState, useEffect } from 'react';
import { getAllContents } from "@/lib/firebase";
import { Content } from "@/types/content";
import { Header } from "@/components/Header";
import { ShieldCheck, Tv, Play, Search, X, Lock, Crown, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from "@/contexts/AuthContext";

const LiveTV = () => {
    const { user, plan } = useAuth();
    const navigate = useNavigate();

    const [channels, setChannels] = useState<Content[]>([]);
    const [activeChannel, setActiveChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [adBlockEnabled, setAdBlockEnabled] = useState(true);
    const [iframeKey, setIframeKey] = useState(0);
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [searchParams] = useSearchParams();
    const channelIdParam = searchParams.get('channelId');

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const allContent = await getAllContents();
                const tvChannels = allContent.filter(c => c.category === 'tv');
                setChannels(tvChannels);

                if (channelIdParam) {
                    const linkedChannel = tvChannels.find(c => c.id === channelIdParam);
                    if (linkedChannel) setActiveChannel(linkedChannel);
                    else if (tvChannels.length > 0) setActiveChannel(tvChannels[0]);
                } else if (tvChannels.length > 0) {
                    setActiveChannel(tvChannels[0]);
                }
            } catch (error) {
                console.error("Error fetching channels:", error);
                toast.error("Erro ao carregar canais");
            } finally {
                setLoading(false);
            }
        };
        fetchChannels();
    }, [channelIdParam]);

    const filteredChannels = channels.filter(c =>
        c.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleChannelClick = (channel: Content) => {
        setActiveChannel(channel);
        setIframeKey(prev => prev + 1);
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const toggleAdBlock = () => {
        setAdBlockEnabled(!adBlockEnabled);
        toast.info(`Bloqueador de Anúncios ${!adBlockEnabled ? 'Ativado' : 'Desativado'}`);
    };

    // Access Check logic
    const isPremium = plan?.name === 'Premium' || plan?.name === 'Família';
    const canWatch = !activeChannel?.isPremium || isPremium;

    return (
        <div className="h-screen bg-[#0a0a0a] flex flex-col overflow-hidden">
            <Header />

            {/* Main Content Area - Full height minus header */}
            <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden pt-16 sm:pt-20">

                {/* SIDEBAR */}
                <div className={`
                    fixed md:relative z-20 inset-0 md:inset-auto bg-[#0a0a0a] md:bg-transparent
                    flex flex-col w-full md:w-80 lg:w-96 flex-shrink-0 transition-transform duration-300 border-r border-white/5
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                    h-full md:h-auto pb-20 md:pb-0
                `}>
                    <div className="flex items-center justify-between p-4 md:hidden border-b border-white/10 shrink-0">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Tv className="w-5 h-5 text-primary" /> Canais
                        </h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                            <X className="w-6 h-6 text-white" />
                        </Button>
                    </div>

                    <div className="p-4 shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar canal..."
                                className="bg-white/5 border-white/10 pl-10 text-white rounded-xl focus:ring-primary/50"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse mb-2" />
                            ))
                        ) : (
                            filteredChannels.map(channel => (
                                <div
                                    key={channel.id}
                                    onClick={() => handleChannelClick(channel)}
                                    className={`
                                        group flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all duration-200
                                        ${activeChannel?.id === channel.id
                                            ? 'bg-primary/20 border border-primary/50 shadow-[0_0_15px_rgba(220,38,38,0.2)]'
                                            : 'hover:bg-white/5 border border-transparent'}
                                    `}
                                >
                                    <div className="relative w-14 h-10 flex-shrink-0 rounded bg-black/50 overflow-hidden">
                                        <img
                                            src={channel.thumbnail_url}
                                            alt={channel.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                                        />
                                        {channel.isPremium && (
                                            <div className="absolute top-0 right-0 bg-amber-500 rounded-bl-sm p-[1px]">
                                                <Crown className="w-2 h-2 text-white" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-medium text-sm truncate ${activeChannel?.id === channel.id ? 'text-primary' : 'text-zinc-300'}`}>
                                            {channel.title}
                                        </h3>
                                    </div>
                                    {activeChannel?.id === channel.id && <Play className="w-3 h-3 text-primary" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* PLAYER AREA */}
                <div className="flex-1 flex flex-col h-full overflow-hidden bg-black relative z-10 w-full">
                    {/* Mobile Menu Button (Floating) */}
                    <div className="absolute top-4 right-4 z-50 md:hidden">
                        <Button
                            size="sm"
                            onClick={() => setIsSidebarOpen(true)}
                            className="bg-primary/90 text-white shadow-lg backdrop-blur"
                        >
                            <Tv className="w-4 h-4 mr-2" /> Canais
                        </Button>
                    </div>

                    {activeChannel ? (
                        canWatch ? (
                            <div className="flex flex-col h-full w-full relative">
                                {/* AdBlock Toggle */}
                                <div className="absolute top-4 left-4 z-40">
                                    <div
                                        onClick={toggleAdBlock}
                                        className={`
                                            flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md cursor-pointer transition-all hover:scale-105 select-none
                                            ${adBlockEnabled
                                                ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                                                : 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'}
                                        `}
                                    >
                                        {adBlockEnabled ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                        <span className="text-xs font-bold uppercase tracking-wide hidden sm:block">
                                            {adBlockEnabled ? 'Protegido' : 'Desprotegido'}
                                        </span>
                                    </div>
                                </div>

                                {/* Iframe Container - Takes ALL remaining height */}
                                <div className="flex-1 w-full relative group bg-black">
                                    {adBlockEnabled && (
                                        <div className="absolute inset-0 pointer-events-none z-20 border-2 border-transparent group-hover:border-primary/5 transition-colors" />
                                    )}
                                    <iframe
                                        key={iframeKey}
                                        src={activeChannel.video_url}
                                        className="w-full h-full border-0 absolute inset-0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                        allowFullScreen
                                        sandbox={adBlockEnabled
                                            ? "allow-forms allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                                            : "allow-forms allow-scripts allow-same-origin allow-presentation allow-fullscreen allow-popups allow-popups-to-escape-sandbox"}
                                        referrerPolicy="no-referrer"
                                        loading="eager"
                                        title={activeChannel.title}
                                    />
                                </div>
                            </div>
                        ) : (
                            /* PREMIUM LOCK SCREEN */
                            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-black/95 relative overflow-hidden">
                                <div className="absolute inset-0 opacity-20 bg-[url('https://images.unsplash.com/photo-1574375927938-d5a98e8efe30?q=80&w=2069&auto=format&fit=crop')] bg-cover bg-center animate-pulse-slow" />
                                <div className="relative z-10 max-w-md w-full bg-zinc-900/80 backdrop-blur-xl p-8 rounded-2xl border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)]">
                                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                                        <Lock className="w-10 h-10 text-amber-500" />
                                    </div>
                                    <h2 className="text-2xl font-bold text-white mb-2">Canal Premium</h2>
                                    <p className="text-gray-400 mb-8">
                                        Este canal é exclusivo para assinantes Premium. Atualize seu plano para assistir a todos os canais ao vivo sem restrições.
                                    </p>
                                    <Button
                                        onClick={() => navigate('/admin/plans')} // Should probably be user-facing plans page
                                        className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold h-12 text-lg shadow-lg"
                                    >
                                        <Crown className="w-5 h-5 mr-2" />
                                        Virar Premium Agora
                                    </Button>
                                </div>
                            </div>
                        )
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                            <Tv className="w-16 h-16 mb-4 opacity-50" />
                            <p>Selecione um canal para assistir</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveTV;
