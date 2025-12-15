import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { addAd, getAllAds, updateAd, deleteAd } from "@/lib/firebase";
import type { Ad, AdNetwork, AdType, AdPlacement } from "@/types/ad";
import { AD_PLACEMENT_LABELS, AD_NETWORK_LABELS, AD_TYPE_LABELS, AD_NETWORK_INSTRUCTIONS } from "@/types/ad";
import { Plus, Save, Trash2, Edit, Info, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

const AdminAds = () => {
  const navigate = useNavigate();
  const { isAdmin, loading } = useAuth();
  const [ads, setAds] = useState<Ad[]>([]);
  const [editingAd, setEditingAd] = useState<Partial<Ad>>({
    name: "",
    code: "",
    placement: "content-top",
    network: "adsense",
    adType: "banner",
    active: true,
    description: "",
  });

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/');
      return;
    }
    if (isAdmin) {
      loadAds();
    }
  }, [isAdmin, loading, navigate]);

  const loadAds = async () => {
    try {
      const data = await getAllAds();
      setAds(data);
    } catch (error) {
      toast.error("Erro ao carregar anúncios");
    }
  };

  const handleSave = async () => {
    if (!editingAd.name || !editingAd.code || !editingAd.placement || !editingAd.network || !editingAd.adType) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      if (editingAd.id) {
        await updateAd(editingAd.id, {
          ...editingAd,
          updatedAt: new Date().toISOString(),
        });
        toast.success("Anúncio atualizado!");
      } else {
        await addAd({
          ...editingAd,
          createdAt: new Date().toISOString(),
          impressions: 0,
          clicks: 0,
        } as Omit<Ad, 'id'>);
        toast.success("Anúncio adicionado!");
      }

      setEditingAd({
        name: "",
        code: "",
        placement: "content-top",
        network: "adsense",
        adType: "banner",
        active: true,
        description: "",
      });
      loadAds();
    } catch (error) {
      toast.error("Erro ao salvar anúncio");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja realmente remover este anúncio?")) return;

    try {
      await deleteAd(id);
      toast.success("Anúncio removido!");
      loadAds();
    } catch (error) {
      toast.error("Erro ao remover anúncio");
    }
  };

  const handleEdit = (ad: Ad) => {
    setEditingAd(ad);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-12">
          <p className="text-center text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 sm:px-8 pt-24 pb-8">
        <h1 className="text-3xl font-bold text-foreground mb-8">Gerenciar Anúncios</h1>

        <Alert className="mb-6 bg-primary/5 border-primary/20">
          <Info className="h-5 w-5" />
          <AlertDescription>
            <strong>Sistema de Monetização Integrado</strong>
            <p className="text-sm mt-1">
              Configure anúncios de múltiplas redes (AdSense, AdMob, outros) em posições estratégicas do site.
              Consulte o guia completo em <code>docs/AD_SYSTEM_GUIDE.md</code> para melhores práticas e instruções detalhadas.
            </p>
          </AlertDescription>
        </Alert>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Formulário */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              {editingAd.id ? "Editar Anúncio" : "Novo Anúncio"}
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="ad-name">Nome do Anúncio *</Label>
                <Input
                  id="ad-name"
                  value={editingAd.name || ""}
                  onChange={(e) => setEditingAd({ ...editingAd, name: e.target.value })}
                  placeholder="Ex: Google AdSense Header"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="ad-network">Rede de Anúncios *</Label>
                  <Select
                    value={editingAd.network}
                    onValueChange={(value) => setEditingAd({ ...editingAd, network: value as AdNetwork })}
                  >
                    <SelectTrigger id="ad-network">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AD_NETWORK_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="ad-type">Tipo de Anúncio *</Label>
                  <Select
                    value={editingAd.adType}
                    onValueChange={(value) => setEditingAd({ ...editingAd, adType: value as AdType })}
                  >
                    <SelectTrigger id="ad-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(AD_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="ad-placement">Posição *</Label>
                <Select
                  value={editingAd.placement}
                  onValueChange={(value) => setEditingAd({ ...editingAd, placement: value as AdPlacement })}
                >
                  <SelectTrigger id="ad-placement">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(AD_PLACEMENT_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ad-description">Descrição (opcional)</Label>
                <Input
                  id="ad-description"
                  value={editingAd.description || ""}
                  onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
                  placeholder="Descrição interna do anúncio"
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="ad-code" className="text-base font-semibold">
                  Código do Anúncio (HTML/Script) *
                </Label>

                {editingAd.network && (
                  <Alert className="bg-primary/5 border-primary/20">
                    <Info className="h-4 w-4" />
                    <AlertDescription className="text-xs whitespace-pre-line">
                      <strong>Como obter o código {AD_NETWORK_LABELS[editingAd.network as AdNetwork]}:</strong>
                      {AD_NETWORK_INSTRUCTIONS[editingAd.network as AdNetwork]}
                      <span className="block mt-2 text-primary font-semibold">
                        👇 Cole o código no campo abaixo:
                      </span>
                    </AlertDescription>
                  </Alert>
                )}

                <div className="w-full">
                  <Textarea
                    id="ad-code"
                    value={editingAd.code || ""}
                    onChange={(e) => setEditingAd({ ...editingAd, code: e.target.value })}
                    placeholder='<script async src="https://pagead2.googlesyndication.com/..."></script>'
                    rows={8}
                    className="w-full min-h-[200px] font-mono text-sm bg-background/50 border-2 border-primary/30 focus:border-primary focus-visible:ring-primary"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Cole aqui o código fornecido pelo Google AdSense, AdMob ou outra plataforma
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="ad-active"
                  checked={editingAd.active ?? true}
                  onCheckedChange={(checked) => setEditingAd({ ...editingAd, active: checked })}
                />
                <Label htmlFor="ad-active">Anúncio Ativo</Label>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSave} className="flex-1">
                  <Save className="w-4 h-4 mr-2" />
                  {editingAd.id ? "Atualizar" : "Adicionar"}
                </Button>
                {editingAd.id && (
                  <Button
                    variant="outline"
                    onClick={() => setEditingAd({
                      name: "",
                      code: "",
                      placement: "content-top",
                      network: "adsense",
                      adType: "banner",
                      active: true,
                      description: "",
                    })}
                  >
                    Cancelar
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* Lista de Anúncios */}
          <Card className="p-6 bg-card border-border">
            <h2 className="text-xl font-semibold mb-4 text-foreground">
              Anúncios Cadastrados ({ads.length})
            </h2>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {ads.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Nenhum anúncio cadastrado ainda
                </p>
              ) : (
                ads.map((ad) => (
                  <Card key={ad.id} className="p-4 bg-background/50">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-semibold text-foreground">{ad.name}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded ${ad.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                            {ad.active ? 'Ativo' : 'Inativo'}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary">
                            {AD_NETWORK_LABELS[ad.network]}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded bg-secondary/20 text-secondary-foreground">
                            {AD_TYPE_LABELS[ad.adType]}
                          </span>
                        </div>

                        {ad.description && (
                          <p className="text-xs text-muted-foreground mb-1 italic">{ad.description}</p>
                        )}

                        <p className="text-sm text-muted-foreground mb-2">
                          <strong>Posição:</strong> {AD_PLACEMENT_LABELS[ad.placement]}
                        </p>

                        {(ad.impressions !== undefined || ad.clicks !== undefined) && (
                          <div className="flex gap-3 text-xs text-muted-foreground mb-2">
                            <span><Eye className="w-3 h-3 inline mr-1" />{ad.impressions || 0} impressões</span>
                            <span>👆 {ad.clicks || 0} cliques</span>
                          </div>
                        )}

                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            Ver código
                          </summary>
                          <pre className="mt-2 p-2 bg-black/20 rounded overflow-x-auto">
                            <code>{ad.code}</code>
                          </pre>
                        </details>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(ad)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(ad.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminAds;
