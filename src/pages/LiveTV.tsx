import { useState, useEffect, useRef } from 'react';
import { getAllContents } from "@/lib/firebase";
import { Content } from "@/types/content";
import { Header } from "@/components/Header";
import { ShieldCheck, Tv, Play, Search, WifiOff, X, ExternalLink, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useSearchParams } from 'react-router-dom';

const LiveTV = () => {
    const [channels, setChannels] = useState<Content[]>([]);
    const [activeChannel, setActiveChannel] = useState<Content | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [adBlockEnabled, setAdBlockEnabled] = useState(true);
    const [iframeKey, setIframeKey] = useState(0); // Force re-render iframe on channel change
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);

    const [searchParams] = useSearchParams();
    const channelIdParam = searchParams.get('channelId');

    useEffect(() => {
        const fetchChannels = async () => {
            try {
                const allContent = await getAllContents();
                const tvChannels = allContent.filter(c => c.category === 'tv');
                setChannels(tvChannels);

                // Handle query param
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
        setIframeKey(prev => prev + 1); // Reset iframe
        // On mobile, close sidebar after selection
        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    const toggleAdBlock = () => {
        setAdBlockEnabled(!adBlockEnabled);
        toast.info(`Bloqueador de Anúncios ${!adBlockEnabled ? 'Ativado' : 'Desativado'}`, {
            description: !adBlockEnabled ? "Pop-ups serão bloqueados." : "Anúncios podem aparecer."
        });
    };

    return (
        <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
            <Header />

            <div className="flex-1 max-w-[1800px] mx-auto w-full pt-20 px-4 md:px-8 pb-8 flex flex-col md:flex-row gap-6 h-[calc(100vh-80px)]">

                {/* SIDEBAR - CHANNEL LIST */}
                <div className={`
                    fixed md:relative z-20 inset-0 md:inset-auto bg-[#0a0a0a] md:bg-transparent
                    flex flex-col w-full md:w-80 lg:w-96 flex-shrink-0 transition-transform duration-300
                    ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
                `}>
                    <div className="flex items-center justify-between mb-4 md:hidden p-4 border-b border-white/10">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Tv className="w-5 h-5 text-primary" /> Canais
                        </h2>
                        <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
                            <X className="w-6 h-6 text-white" />
                        </Button>
                    </div>

                    <div className="relative mb-4 px-4 md:px-0">
                        <Search className="absolute left-3 md:left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <Input
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Buscar canal..."
                            className="bg-white/5 border-white/10 pl-10 text-white rounded-xl focus:ring-primary/50"
                        />
                    </div>

                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 px-4 md:px-0 pb-20 md:pb-0 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
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
                                            : 'bg-white/5 border border-transparent hover:bg-white/10'}
                                    `}
                                >
                                    <div className="relative w-16 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-black/50">
                                        <img
                                            src={channel.thumbnail_url}
                                            alt={channel.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => (e.currentTarget.src = "/placeholder.svg")}
                                        />
                                        {activeChannel?.id === channel.id && (
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                <div className="w-2 h-2 bg-primary rounded-full animate-ping" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className={`font-bold text-sm truncate ${activeChannel?.id === channel.id ? 'text-primary' : 'text-white'}`}>
                                            {channel.title}
                                        </h3>
                                        <p className="text-xs text-gray-400 truncate">Ao Vivo</p>
                                    </div>
                                    <Play className={`w-4 h-4 ${activeChannel?.id === channel.id ? 'text-primary opacity-100' : 'text-white opacity-0 group-hover:opacity-50'}`} />
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* MAIN PLAYER AREA */}
                <div className="flex-1 flex flex-col h-full min-h-0 relative z-10">
                    {/* Mobile Toggle & Title */}
                    <div className="flex md:hidden items-center justify-between mb-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsSidebarOpen(true)}
                            className="bg-white/5 border-white/10 text-white"
                        >
                            <ListIcon className="w-4 h-4 mr-2" />
                            Lista de Canais
                        </Button>
                    </div>

                    {activeChannel ? (
                        <div className="relative flex-1 bg-black rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex flex-col">
                            {/* AdBlock Header */}
                            <div className="absolute top-4 left-4 z-30 flex items-center gap-2">
                                <div
                                    onClick={toggleAdBlock}
                                    className={`
                                        flex items-center gap-2 px-3 py-1.5 rounded-full backdrop-blur-md cursor-pointer transition-all hover:scale-105 active:scale-95 select-none
                                        ${adBlockEnabled
                                            ? 'bg-green-500/20 border border-green-500/50 text-green-400'
                                            : 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400'}
                                    `}
                                >
                                    {adBlockEnabled ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                                    <span className="text-xs font-bold uppercase tracking-wide">
                                        {adBlockEnabled ? 'AdBlock Ativo' : 'AdBlock Desativado'}
                                    </span>
                                </div>
                            </div>

                            {/* Player Wrapper */}
                            <div className="relative flex-1 w-full bg-black group">
                                {adBlockEnabled && (
                                    // Transparent overlay to catch aggressive popups? 
                                    // Actually, sandbox is better. But we can add a visual cue.
                                    <div className="absolute inset-0 pointer-events-none z-20 border-[3px] border-primary/0 group-hover:border-primary/10 transition-colors rounded-xl" />
                                )}

                                <iframe
                                    key={iframeKey}
                                    src={activeChannel.video_url}
                                    className="w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                                    allowFullScreen
                                    // SANDBOX: The core of the AdBlock
                                    // allow-scripts: needed for player
                                    // allow-same-origin: needed for some players
                                    // NO allow-popups: blocks new tabs!
                                    sandbox={adBlockEnabled
                                        ? "allow-forms allow-scripts allow-same-origin allow-presentation allow-fullscreen"
                                        : "allow-forms allow-scripts allow-same-origin allow-presentation allow-fullscreen allow-popups allow-popups-to-escape-sandbox"}
                                    referrerPolicy="no-referrer"
                                    loading="eager"
                                    title={activeChannel.title}
                                />
                            </div>

                            {/* Info Bar */}
                            <div className="p-4 md:p-6 bg-zinc-900 border-t border-white/10 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-white/5 rounded-lg flex items-center justify-center">
                                        <img src={activeChannel.thumbnail_url} className="w-8 h-8 object-contain" alt="Logo" />
                                    </div>
                                    <div>
                                        <h1 className="text-xl font-bold text-white">{activeChannel.title}</h1>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse" />
                                            <span className="text-xs text-red-500 font-bold uppercase tracking-widest">Ao Vivo Agora</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 flex flex-col items-center justify-center text-center p-8">
                            <Tv className="w-20 h-20 text-white/20 mb-4" />
                            <h3 className="text-2xl font-bold text-white mb-2">Selecione um Canal</h3>
                            <p className="text-gray-400">Escolha um canal na lista ao lado para começar a assistir.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// Helper for mobile icon
const ListIcon = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
);

export default LiveTV;
