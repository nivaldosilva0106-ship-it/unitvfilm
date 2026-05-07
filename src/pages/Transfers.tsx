import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { LoadingScreen } from "@/components/LoadingScreen";
import { useAuth } from "@/contexts/AuthContext";
import { getUserTransfers, addTransfer, deleteTransfer, clearAllTransfers } from "@/lib/firebase";
import { TransferItem } from "@/types/user";
import { Download, History, ExternalLink, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const Transfers = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [transfers, setTransfers] = useState<TransferItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    useEffect(() => {
        if (user) {
            loadTransfers();
        } else {
            setLoading(false);
        }
    }, [user]);

    const loadTransfers = async () => {
        if (!user) return;
        try {
            const [data, contents] = await Promise.all([
                getUserTransfers(user.uid),
                import('@/lib/firebase').then(m => m.getAllContents())
            ]);
            
            // Retroactively fix missing thumbnails by matching contentId
            const mappedData = data.map(transfer => {
                if (!transfer.thumbnailUrl) {
                    const content = contents.find(c => c.id === transfer.contentId);
                    if (content) {
                        return { ...transfer, thumbnailUrl: content.thumbnail_url };
                    }
                }
                return transfer;
            });
            
            setTransfers(mappedData);
        } catch (error) {
            console.error("Erro ao carregar transferências:", error);
            toast.error("Erro ao carregar histórico");
        } finally {
            setLoading(false);
        }
    };

    const handleRedownload = (url: string) => {
        toast.info("Iniciando download...");
        window.open(url, '_blank');
    };

    const handleDelete = async (transferId: string) => {
        if (!user) return;
        if (window.confirm("Tem certeza que deseja apagar este item do histórico?")) {
            try {
                await deleteTransfer(user.uid, transferId);
                toast.success("Item apagado com sucesso");
                setTransfers(prev => prev.filter(t => t.id !== transferId));
            } catch (error) {
                toast.error("Erro ao apagar item");
            }
        }
    };

    const handleClearAll = async () => {
        if (!user) return;
        if (window.confirm("Tem certeza que deseja apagar TODO o histórico de transferências? Esta ação não pode ser desfeita.")) {
            try {
                await clearAllTransfers(user.uid);
                toast.success("Histórico limpo com sucesso");
                setTransfers([]);
            } catch (error) {
                toast.error("Erro ao limpar histórico");
            }
        }
    };

    const filteredTransfers = transfers.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) return <LoadingScreen />;

    return (
        <div className="min-h-screen bg-[#0a0a0a] text-white">
            <Header />
            
            <main className="container mx-auto px-4 pt-28 pb-20">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-[#22c55e]/10 flex items-center justify-center border border-[#22c55e]/20">
                            <History className="text-[#22c55e] w-6 h-6" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-black tracking-tight">Minhas Transferências</h1>
                            <p className="text-gray-400 text-sm">Histórico de downloads externos realizados</p>
                        </div>
                    </div>

                    <div className="relative w-full md:w-80 flex gap-2">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <Input 
                                placeholder="Buscar no histórico..." 
                                className="bg-[#151515] border-[#252525] pl-10 focus:border-[#22c55e]/50 transition-all rounded-xl"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        {transfers.length > 0 && (
                            <Button 
                                variant="destructive" 
                                className="rounded-xl px-4" 
                                onClick={handleClearAll}
                                title="Apagar Todo Histórico"
                            >
                                <Trash2 className="w-5 h-5" />
                            </Button>
                        )}
                    </div>
                </div>

                {filteredTransfers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-700">
                        <div className="w-24 h-24 bg-[#151515] rounded-full flex items-center justify-center mb-6 border border-[#252525]">
                            <Download className="w-10 h-10 text-gray-600" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Nenhum download encontrado</h2>
                        <p className="text-gray-500 max-w-md mx-auto mb-8">
                            {searchTerm 
                                ? "Não encontramos nada com esse nome no seu histórico." 
                                : "Seus downloads recentes de filmes e séries aparecerão aqui para você baixar novamente quando quiser."}
                        </p>
                        {!searchTerm && (
                            <Button 
                                onClick={() => navigate("/")}
                                className="bg-[#22c55e] hover:bg-[#22c55e]/80 text-black font-bold px-8 rounded-xl h-12"
                            >
                                Descobrir Conteúdos
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {filteredTransfers.map((transfer) => (
                            <div 
                                key={transfer.id}
                                className="group relative bg-[#151515] border border-[#252525] rounded-2xl overflow-hidden hover:border-[#22c55e]/30 transition-all duration-300 shadow-xl flex flex-col"
                            >
                                <div className="aspect-[2/3] relative overflow-hidden">
                                    <img 
                                        src={transfer.thumbnailUrl || "/placeholder.svg"} 
                                        alt={transfer.title}
                                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-[#151515] via-transparent to-transparent opacity-80" />
                                    
                                    <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-2">
                                        <div className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-white/10 shadow-xl">
                                            <History className="w-4 h-4 text-[#22c55e]" />
                                        </div>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDelete(transfer.id);
                                            }}
                                            className="bg-black/60 backdrop-blur-md p-2 rounded-lg border border-red-500/30 shadow-xl hover:bg-red-500/20 transition-colors"
                                            title="Apagar item"
                                        >
                                            <Trash2 className="w-4 h-4 text-red-500" />
                                        </button>
                                    </div>
                                </div>

                                <div className="p-5 flex-1 flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg mb-1 line-clamp-1 group-hover:text-[#22c55e] transition-colors">
                                            {transfer.title}
                                        </h3>
                                        <p className="text-xs text-gray-500 mb-4 flex items-center gap-1.5">
                                            <span className="w-2 h-2 rounded-full bg-[#22c55e]/40" />
                                            Baixado em: {new Date(transfer.addedAt).toLocaleDateString()}
                                        </p>
                                    </div>

                                    <Button 
                                        onClick={() => handleRedownload(transfer.url)}
                                        className="w-full bg-[#22c55e]/10 hover:bg-[#22c55e] border border-[#22c55e]/20 text-[#22c55e] hover:text-black font-bold h-11 rounded-xl transition-all flex items-center justify-center gap-2 group/btn"
                                    >
                                        <Download className="w-4 h-4 group-hover/btn:animate-bounce" />
                                        Baixar Novamente
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            <style dangerouslySetInnerHTML={{ __html: `
                .line-clamp-1 {
                    display: -webkit-box;
                    -webkit-line-clamp: 1;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }
            `}} />
        </div>
    );
};

export default Transfers;
