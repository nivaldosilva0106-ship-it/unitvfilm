import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Download, Loader2, Link as LinkIcon, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { Content } from "@/types/content";

interface AdminContentImporterProps {
    onImport: (content: Partial<Content>) => void;
}

export const AdminContentImporter = ({ onImport }: AdminContentImporterProps) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [directUrl, setDirectUrl] = useState("");
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState<'search' | 'url'>('url'); // Default to URL for stability

    // Helper to extract brplayer URL from HTML content
    const extractBrPlayerUrl = (html: string): string | null => {
        // Look for iframe src or specific patterns
        // Pattern: https://watch.brplayer.cc/watch?v=...
        const match = html.match(/https:\/\/watch\.brplayer\.cc\/watch\?v=[a-zA-Z0-9_-]+/);
        if (match) return match[0];

        // Sometimes it might be inside an iframe src
        const iframeMatch = html.match(/src=["'](https:\/\/watch\.brplayer\.cc\/[^"']+)["']/);
        if (iframeMatch) return iframeMatch[1];

        return null;
    };

    const extractTitle = (html: string): string | null => {
        const titleMatch = html.match(/<title>(.*?)<\/title>/);
        if (titleMatch) {
            return titleMatch[1].replace(' - Comandoplay', '').replace(' Assistir Online', '').trim();
        }
        return null;
    };

    const extractImage = (html: string): string | null => {
        // og:image
        const imgMatch = html.match(/property="og:image"\s+content=["']([^"']+)["']/);
        if (imgMatch) return imgMatch[1];
        return null;
    };

    const handleImportFromUrl = async () => {
        if (!directUrl) {
            toast.error("Cole uma URL do Comandoplay");
            return;
        }

        setLoading(true);
        try {
            // Using QuickRet or AllOrigins as CORS proxy
            // NOTE: This relies on public proxies which may be unstable. 
            // For production, a real backend is needed.
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(directUrl)}`;

            const response = await fetch(proxyUrl);
            const data = await response.json();

            if (!data.contents) {
                throw new Error("Falha ao acessar o site via proxy");
            }

            const html = data.contents;
            const embedUrl = extractBrPlayerUrl(html);
            const title = extractTitle(html);
            const image = extractImage(html);

            if (embedUrl) {
                onImport({
                    title: title || "",
                    thumbnail_url: image || "",
                    video_url: embedUrl,
                    // Try to guess category
                    category: directUrl.includes('/series/') ? 'series' : 'movie'
                });
                toast.success("Dados importados com sucesso!");
                setDirectUrl("");
            } else {
                toast.error("Link 'watch.brplayer.cc' não encontrado na página. Tente copiar o link do player manualmente.");
            }

        } catch (error) {
            console.error(error);
            toast.error("Erro ao importar. O site pode estar bloqueando o acesso.");
        } finally {
            setLoading(false);
        }
    };

    const handleSearchRedirect = () => {
        if (!searchQuery) return;
        window.open(`https://comandoplay.com/?s=${encodeURIComponent(searchQuery)}`, '_blank');
        toast.info("Copie o link da página do filme/série e cole abaixo.");
        setStep('url');
    };

    return (
        <div className="bg-card border border-border rounded-xl p-6 mb-8 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Download className="w-4 h-4" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-foreground">Importador Automático</h3>
                    <p className="text-xs text-muted-foreground">Importe dados do Comandoplay</p>
                </div>
            </div>

            <div className="space-y-4">
                {/* Step 1: Search Help */}
                <div className="flex gap-2">
                    <Input
                        placeholder="Nome do Filme ou Série..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchRedirect()}
                        className="flex-1"
                    />
                    <Button onClick={handleSearchRedirect} variant="secondary">
                        <Search className="w-4 h-4 mr-2" />
                        Buscar no Site
                    </Button>
                </div>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">E / OU</span>
                    </div>
                </div>

                {/* Step 2: URL Import */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Cole o link da página do filme (ex: https://comandoplay.com/filmes/matrix...)"
                            value={directUrl}
                            onChange={(e) => setDirectUrl(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={handleImportFromUrl} disabled={loading} className="min-w-[120px]">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                        Importar
                    </Button>
                </div>

                <div className="text-[10px] text-muted-foreground flex items-center gap-1.5 bg-secondary/50 p-2 rounded">
                    <AlertCircle className="w-3 h-3" />
                    <span>O sistema tentará extrair: Título, Imagem e Link do Player (brplayer.cc). Verifique os dados antes de salvar.</span>
                </div>
            </div>
        </div>
    );
};
