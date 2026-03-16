import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
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
import { Save, Trash2, Edit, Info, Eye } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AdminLayout } from "@/components/admin/AdminLayout";

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
      <AdminLayout title="Gerenciar Anúncios">
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </AdminLayout>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <AdminLayout title="Gerenciar Anúncios">
      <Alert className="mb-6 bg-primary/5 border-primary/20">
        <Info className="h-5 w-5" />
        <AlertDescription>
          <strong>Sistema de Monetização Integrado</strong>
          <p className="text-sm mt-1">
            Configure anúncios de múltiplas redes (AdSense, AdMob, outros) em posições estratégicas do site.
          </p>
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulário */}
        <Card className="p-5 bg-card border-border">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            {editingAd.id ? "Editar Anúncio" : "Novo Anúncio"}
          </h2>

          <div className="space-y-3">
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
                <Label htmlFor="ad-network">Rede *</Label>
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
                <Label htmlFor="ad-type">Tipo *</Label>
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
              <Label htmlFor="ad-description">Descrição</Label>
              <Input
                id="ad-description"
                value={editingAd.description || ""}
                onChange={(e) => setEditingAd({ ...editingAd, description: e.target.value })}
                placeholder="Descrição interna"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ad-code">Código *</Label>
              {editingAd.network && (
                <Alert className="bg-primary/5 border-primary/20 py-2">
                  <AlertDescription className="text-xs">
                    {AD_NETWORK_INSTRUCTIONS[editingAd.network as AdNetwork]}
                  </AlertDescription>
                </Alert>
              )}
              <Textarea
                id="ad-code"
                value={editingAd.code || ""}
                onChange={(e) => setEditingAd({ ...editingAd, code: e.target.value })}
                placeholder='<script async src="..."></script>'
                rows={5}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="ad-active"
                checked={editingAd.active ?? true}
                onCheckedChange={(checked) => setEditingAd({ ...editingAd, active: checked })}
              />
              <Label htmlFor="ad-active">Ativo</Label>
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

        {/* Lista */}
        <Card className="p-5 bg-card border-border">
          <h2 className="text-lg font-semibold mb-4 text-foreground">
            Anúncios ({ads.length})
          </h2>

          <div className="space-y-3 max-h-[500px] overflow-y-auto">
            {ads.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                Nenhum anúncio cadastrado
              </p>
            ) : (
              ads.map((ad) => (
                <Card key={ad.id} className="p-3 bg-background/50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-medium text-foreground text-sm truncate">{ad.name}</h3>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${ad.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {ad.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {AD_PLACEMENT_LABELS[ad.placement]}
                      </p>
                      {(ad.impressions !== undefined || ad.clicks !== undefined) && (
                        <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                          <span><Eye className="w-3 h-3 inline mr-1" />{ad.impressions || 0}</span>
                          <span>👆 {ad.clicks || 0}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleEdit(ad)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(ad.id)}>
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
    </AdminLayout>
  );
};

export default AdminAds;
