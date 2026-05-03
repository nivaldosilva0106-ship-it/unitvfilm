import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { createExternalIPTVClient } from "@/lib/external-api";
import { Tv, Copy, Check, Loader2, Sparkles, Gift, Info, ShieldCheck } from "lucide-react";
import { TVSidebar } from "@/components/TVSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";

const IPTV = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerateList = async () => {
    if (!user) {
      toast.error("Você precisa estar logado para gerar uma lista.");
      return;
    }

    setLoading(true);
    try {
      // Generate a unique login and password based on user UID
      const login = `utv_${user.uid.substring(0, 8).toLowerCase()}`;
      const password = Math.random().toString(36).slice(-8);

      const result = await createExternalIPTVClient({
        nome_usuario: user.displayName || user.email?.split('@')[0] || "Usuário UniTv",
        login_usuario: login,
        senha_usuario: password,
      });

      if (result.success && result.m3u_link) {
        setGeneratedLink(result.m3u_link);
        toast.success("Sua lista IPTV foi gerada com sucesso!");
      } else {
        throw new Error("Resposta inválida da API");
      }
    } catch (error: any) {
      toast.error(error.message || "Erro ao gerar lista IPTV. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (generatedLink) {
      navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copiado para a área de transferência!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <TVSidebar />
      
      <main className="lg:pl-20 pb-20 lg:pb-0 min-h-screen">
        <div className="container max-w-4xl mx-auto px-4 py-12 md:py-20">
          <div className="text-center space-y-4 mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-500 text-xs font-bold uppercase tracking-wider animate-pulse">
              <Gift className="w-3 h-3" />
              Oferta Exclusiva
            </div>
            <h1 className="text-4xl md:text-6xl font-black tracking-tighter">
              SUA <span className="text-green-500">LISTA IPTV</span> PROFISSIONAL
            </h1>
            <p className="text-zinc-400 text-lg max-w-2xl mx-auto">
              Gere agora seu acesso exclusivo de 5 dias para o servidor UniTvIPTV. Milhares de canais, filmes e séries em alta definição.
            </p>
          </div>

          {!generatedLink ? (
            <Card className="relative overflow-hidden bg-zinc-900/50 border-zinc-800 p-8 md:p-12 text-center space-y-8 backdrop-blur-xl border-t-green-500/50 border-t-2">
              <div className="absolute top-0 right-0 p-4">
                <Sparkles className="w-8 h-8 text-green-500/20" />
              </div>
              
              <div className="w-20 h-20 bg-green-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 rotate-3 hover:rotate-0 transition-transform duration-500">
                <Tv className="w-10 h-10 text-green-500" />
              </div>

              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Pronto para começar?</h2>
                <p className="text-zinc-500 text-sm">
                  Ao clicar no botão abaixo, criaremos uma conta temporária para você em nossa infraestrutura de canais ao vivo.
                </p>
              </div>

              <Button 
                onClick={handleGenerateList} 
                disabled={loading}
                className="w-full md:w-auto px-12 h-14 bg-green-500 hover:bg-green-400 text-black font-black text-lg rounded-xl shadow-[0_0_30px_-5px_rgba(34,197,94,0.4)] transition-all hover:scale-105 active:scale-95"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    GERANDO ACESSO...
                  </>
                ) : (
                  "GERAR MINHA LISTA GRÁTIS"
                )}
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-8 border-t border-zinc-800/50">
                <div className="flex items-center gap-3 text-left">
                  <ShieldCheck className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-xs text-zinc-400">Servidor Anti-Travamento</span>
                </div>
                <div className="flex items-center gap-3 text-left">
                  <Check className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-xs text-zinc-400">Qualidade 4K / Full HD</span>
                </div>
                <div className="flex items-center gap-3 text-left">
                  <Info className="w-5 h-5 text-green-500 shrink-0" />
                  <span className="text-xs text-zinc-400">Suporte a EPG e Logos</span>
                </div>
              </div>
            </Card>
          ) : (
            <div className="space-y-6 animate-in zoom-in-95 duration-500">
              <Card className="bg-zinc-900 border-green-500/30 p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-green-500 text-black text-[10px] font-black px-3 py-1 rounded-bl-lg uppercase tracking-tighter">
                  Ativo por 5 Dias
                </div>
                
                <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-green-500 rounded-lg">
                      <Tv className="w-6 h-6 text-black" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold">Seu Link M3U</h3>
                      <p className="text-zinc-500 text-xs">Use este link em qualquer player IPTV (IPTV Smarters, XCIPTV, etc)</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-3">
                    <div className="flex-1 bg-black border border-zinc-800 rounded-lg p-4 font-mono text-xs text-green-500 break-all overflow-hidden relative group">
                      {generatedLink}
                    </div>
                    <Button 
                      onClick={copyToClipboard}
                      variant="outline"
                      className="h-auto md:w-32 border-zinc-800 hover:bg-zinc-800 hover:text-white"
                    >
                      {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                      {copied ? "Copiado" : "Copiar"}
                    </Button>
                  </div>

                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 flex gap-3">
                    <Info className="w-5 h-5 text-blue-400 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-sm font-bold text-blue-400">Como usar?</p>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        Abra seu aplicativo de IPTV favorito, escolha a opção "Adicionar Playlist" ou "Link M3U" e cole o endereço acima. Sua lista contém todos os canais ao vivo e VOD do servidor.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              <div className="text-center">
                <Button 
                  variant="link" 
                  className="text-zinc-500 hover:text-white text-xs"
                  onClick={() => setGeneratedLink(null)}
                >
                  Deseja gerar um novo acesso?
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>

      <MobileBottomNav />
    </div>
  );
};

export default IPTV;
