import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { getAllContents, updateContent } from "@/lib/firebase";
import { Content } from "@/types/content";

export const AdminBulkUpdate = () => {
    const [loading, setLoading] = useState(false);

    const handleBulkUrlUpdate = async () => {
        if (!window.confirm("Tem certeza que deseja alterar TODAS as URLs 'brplayer.cc' para 'brstream.cc' em todo o banco de dados? Esta ação percorrerá todos os filmes, séries (incluindo todos os episódios) e canais de TV. Esta ação não pode ser desfeita.")) {
            return;
        }

        setLoading(true);
        const loadingToast = toast.loading("Iniciando atualização em massa de domínios...");
        try {
            const allData = await getAllContents();
            let updatedCount = 0;

            for (const content of allData) {
                let needsUpdate = false;
                const updatedContent: Partial<Content> = { ...content };

                // Helper para substituir o domínio antigo pelo novo
                const replaceDomain = (url?: string) => {
                    if (!url) return url;
                    // Procura por watch.brplayer.cc/watch? ou watch.brplayer.cc/watch/
                    if (url.includes('brplayer.cc/watch')) {
                        return url.replace(/https?:\/\/watch\.brplayer\.cc\/watch[/?]/g, 'https://watch.brstream.cc/watch?');
                    }
                    return url;
                };

                // 1. Verificar url principal (video_url)
                if (content.video_url) {
                    const newUrl = replaceDomain(content.video_url);
                    if (newUrl !== content.video_url) {
                        updatedContent.video_url = newUrl;
                        needsUpdate = true;
                    }
                }

                // 2. Verificar array de urls (video_urls)
                if (content.video_urls && content.video_urls.length > 0) {
                    const newUrls = content.video_urls.map(url => replaceDomain(url) || '');
                    if (JSON.stringify(newUrls) !== JSON.stringify(content.video_urls)) {
                        updatedContent.video_urls = newUrls;
                        needsUpdate = true;
                    }
                }

                // 3. Verificar episódios (séries e nostalgia)
                if (content.episodes && content.episodes.length > 0) {
                    let epUpdated = false;
                    const newEpisodes = content.episodes.map(ep => {
                        const newEpUrl = replaceDomain(ep.url);
                        const newEpInternal = replaceDomain(ep.internal_player_url);
                        const newEpGoogle = replaceDomain(ep.google_drive_url);

                        if (newEpUrl !== ep.url || newEpInternal !== ep.internal_player_url || newEpGoogle !== ep.google_drive_url) {
                            epUpdated = true;
                            needsUpdate = true;
                            return {
                                ...ep,
                                url: newEpUrl || '',
                                internal_player_url: newEpInternal || ep.internal_player_url,
                                google_drive_url: newEpGoogle || ep.google_drive_url
                            };
                        }
                        return ep;
                    });
                    if (epUpdated) {
                        updatedContent.episodes = newEpisodes;
                    }
                }

                // 4. Verificar outros campos de player interno no nível raiz
                if (content.internal_player_url) {
                    const newUrl = replaceDomain(content.internal_player_url);
                    if (newUrl !== content.internal_player_url) {
                        updatedContent.internal_player_url = newUrl;
                        needsUpdate = true;
                    }
                }

                if (content.google_drive_url) {
                    const newUrl = replaceDomain(content.google_drive_url);
                    if (newUrl !== content.google_drive_url) {
                        updatedContent.google_drive_url = newUrl;
                        needsUpdate = true;
                    }
                }

                if (needsUpdate) {
                    await updateContent(content.id, updatedContent);
                    updatedCount++;
                }
            }

            toast.success(`Sucesso! ${updatedCount} conteúdos foram atualizados para o novo domínio.`, { id: loadingToast });
        } catch (error) {
            console.error("Erro no bulk update:", error);
            toast.error("Erro ao realizar atualização em massa.", { id: loadingToast });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mt-8 p-6 bg-amber-500/10 rounded-xl border border-amber-500/20 shadow-lg group">
            <div className="flex items-center gap-2 mb-4 text-amber-500">
                <LinkIcon className="w-5 h-5" />
                <h3 className="font-bold text-lg text-amber-500">Atualização Global de Domínio (BRPlayer → BRStream)</h3>
            </div>
            <div className="space-y-4">
                <p className="text-sm text-gray-400 leading-relaxed">
                    Esta ferramenta percorre <strong>todo o banco de dados</strong> e altera automaticamente qualquer link do domínio antigo
                    <code className="mx-1 px-1 bg-amber-500/20 rounded text-amber-400 font-mono text-xs">watch.brplayer.cc</code> para o novo
                    <code className="mx-1 px-1 bg-amber-500/20 rounded text-amber-400 font-mono text-xs">watch.brstream.cc</code>.
                </p>
                <div className="bg-amber-500/5 p-3 rounded-lg border border-amber-500/20">
                    <p className="text-[11px] text-amber-500/80 italic font-medium">
                        * Afeta Filmes, Séries (todos os episódios) e Canais de TV. O sufixo da URL (parâmetros após watch? ou watch/) será mantido e convertido para o novo formato watch?.
                    </p>
                </div>
                <Button
                    type="button"
                    onClick={handleBulkUrlUpdate}
                    disabled={loading}
                    variant="outline"
                    className="w-full h-12 border-amber-500/30 text-amber-500 hover:bg-amber-500/10 hover:border-amber-500 font-bold transition-all shadow-[0_0_20px_rgba(245,158,11,0.05)] group-hover:shadow-[0_0_25px_rgba(245,158,11,0.15)]"
                >
                    <RefreshCw className={`w-5 h-5 mr-2 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                    {loading ? "Processando..." : "Atualizar Todos os Links do Servidor para BRStream"}
                </Button>
            </div>
        </div>
    );
};
