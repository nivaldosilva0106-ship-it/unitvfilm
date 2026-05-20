import { useEffect, useState } from "react";
import { getSiteSettings, updateSiteSettings, type SiteSettings, type HomePageSectionConfig, type HomePageConfig, type HeroSliderConfig } from "@/lib/firebase";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GripVertical, Eye, EyeOff, ArrowUp, ArrowDown, Save, RotateCcw, Zap, LayoutGrid, Video, Clock } from "lucide-react";

const DEFAULT_HERO_SLIDER: HeroSliderConfig = {
  enabled: true,
  rotationInterval: 15,
  transitionDuration: 1.5,
  showTextTitle: false,
  showLogo: true,
};

const DEFAULT_SECTIONS: HomePageSectionConfig[] = [
  { id: "featured", title: "Em Destaque", enabled: true, order: 0, maxItems: 20 },
  { id: "recent", title: "Lançamentos Recentes", enabled: true, order: 1, maxItems: 20 },
  { id: "topRated", title: "Mais Assistidos", enabled: true, order: 2, maxItems: 20 },
  { id: "movies", title: "Filmes", enabled: true, order: 3, maxItems: 20 },
  { id: "series", title: "Séries", enabled: true, order: 4, maxItems: 20 },
  { id: "nostalgia", title: "Nostalgia", enabled: true, order: 5, maxItems: 20 },
  { id: "action", title: "Ação e Aventura", enabled: true, order: 6, maxItems: 20 },
  { id: "dramaCrime", title: "Drama & Crime", enabled: true, order: 7, maxItems: 20 },
  { id: "comedyRomance", title: "Comédia & Romance", enabled: true, order: 8, maxItems: 20 },
  { id: "comedy", title: "Comédia e Terror", enabled: true, order: 9, maxItems: 20 },
  { id: "canais24h", title: "Transmissão 24 Horas", enabled: true, order: 10, maxItems: 20 },
];

const DEFAULT_HOME_CONFIG: HomePageConfig = {
  sections: DEFAULT_SECTIONS,
  itemsPerSection: 20,
  enableRandomOrder: true,
  enableRecentSection: true,
  maxSectionsVisible: 20,
  heroSlider: DEFAULT_HERO_SLIDER,
};

export default function AdminHomePageManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<HomePageConfig>(DEFAULT_HOME_CONFIG);
  const [sections, setSections] = useState<HomePageSectionConfig[]>(DEFAULT_SECTIONS);
  const [heroSlider, setHeroSlider] = useState<HeroSliderConfig>(DEFAULT_HERO_SLIDER);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await getSiteSettings();
      if (settings.homePageConfig) {
        setConfig(settings.homePageConfig);
        setSections(settings.homePageConfig.sections || DEFAULT_SECTIONS);
        setHeroSlider(settings.homePageConfig.heroSlider || DEFAULT_HERO_SLIDER);
      } else {
        setConfig(DEFAULT_HOME_CONFIG);
        setSections(DEFAULT_SECTIONS);
        setHeroSlider(DEFAULT_HERO_SLIDER);
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast.error("Erro ao carregar configurações da página inicial");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updatedConfig: HomePageConfig = {
        ...config,
        sections,
        heroSlider,
      };
      await updateSiteSettings({ homePageConfig: updatedConfig });
      toast.success("Configurações da página inicial salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar:", error);
      toast.error("Erro ao salvar configurações");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setConfig(DEFAULT_HOME_CONFIG);
    setSections(DEFAULT_SECTIONS);
    setHeroSlider(DEFAULT_HERO_SLIDER);
    toast.info("Configurações restauradas ao padrão");
  };

  const toggleSection = (id: string) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    setSections(prev => {
      const newSections = [...prev];
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= newSections.length) return prev;
      [newSections[index], newSections[targetIndex]] = [newSections[targetIndex], newSections[index]];
      return newSections.map((s, i) => ({ ...s, order: i }));
    });
  };

  const updateSectionMaxItems = (id: string, value: number) => {
    setSections(prev =>
      prev.map(s => (s.id === id ? { ...s, maxItems: Math.max(1, Math.min(50, value)) } : s))
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <LayoutGrid className="w-6 h-6 text-primary" />
            Gerenciar Página Inicial
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure seções, limite de itens e otimizações de performance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleReset} disabled={saving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Restaurar Padrão
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Salvando..." : "Salvar Configurações"}
          </Button>
        </div>
      </div>

      {/* Hero Slider Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Video className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-white">Slider do Hero (Página Inicial)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Slider Ativado</p>
              <p className="text-xs text-muted-foreground">Rotação automática de posters no hero</p>
            </div>
            <Switch
              checked={heroSlider.enabled}
              onCheckedChange={(checked) => setHeroSlider(prev => ({ ...prev, enabled: checked }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Intervalo de Rotação (segundos)
            </label>
            <Input
              type="number"
              min={5}
              max={120}
              value={heroSlider.rotationInterval}
              onChange={(e) => setHeroSlider(prev => ({ ...prev, rotationInterval: parseInt(e.target.value) || 15 }))}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground">Tempo entre cada troca de poster (5-120s)</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Duração da Transição (segundos)</label>
            <Input
              type="number"
              min={0.5}
              max={5}
              step={0.5}
              value={heroSlider.transitionDuration}
              onChange={(e) => setHeroSlider(prev => ({ ...prev, transitionDuration: parseFloat(e.target.value) || 1.5 }))}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground">Tempo da animação de transição</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Mostrar Logo do Título</p>
              <p className="text-xs text-muted-foreground">Exibir logo do título (TMDB) quando disponível</p>
            </div>
            <Switch
              checked={heroSlider.showLogo}
              onCheckedChange={(checked) => setHeroSlider(prev => ({ ...prev, showLogo: checked }))}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Mostrar Texto como Fallback</p>
              <p className="text-xs text-muted-foreground">Exibir título em texto quando não houver logo</p>
            </div>
            <Switch
              checked={heroSlider.showTextTitle}
              onCheckedChange={(checked) => setHeroSlider(prev => ({ ...prev, showTextTitle: checked }))}
            />
          </div>
        </div>
      </div>

      {/* Performance Settings */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-5 h-5 text-yellow-500" />
          <h2 className="text-lg font-semibold text-white">Otimizações de Performance</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Itens por Seção (padrão)</label>
            <Input
              type="number"
              min={1}
              max={50}
              value={config.itemsPerSection}
              onChange={(e) => setConfig(prev => ({ ...prev, itemsPerSection: parseInt(e.target.value) || 10 }))}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground">Número padrão de itens quando a seção não tem um valor personalizado</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-white">Máximo de Seções Visíveis</label>
            <Input
              type="number"
              min={1}
              max={20}
              value={config.maxSectionsVisible}
              onChange={(e) => setConfig(prev => ({ ...prev, maxSectionsVisible: parseInt(e.target.value) || 10 }))}
              className="bg-background border-border"
            />
            <p className="text-xs text-muted-foreground">Limite máximo de seções exibidas na página inicial</p>
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Ordem Aleatória</p>
              <p className="text-xs text-muted-foreground">Embaralha itens dentro de cada seção ao atualizar</p>
            </div>
            <Switch
              checked={config.enableRandomOrder}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableRandomOrder: checked }))}
            />
          </div>
          <div className="flex items-center justify-between p-3 bg-background rounded-lg">
            <div>
              <p className="text-sm font-medium text-white">Seção de Lançamentos</p>
              <p className="text-xs text-muted-foreground">Exibir seção fixa de conteúdos recentes</p>
            </div>
            <Switch
              checked={config.enableRecentSection}
              onCheckedChange={(checked) => setConfig(prev => ({ ...prev, enableRecentSection: checked }))}
            />
          </div>
        </div>
      </div>

      {/* Sections Management */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <LayoutGrid className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold text-white">Gerenciar Seções</h2>
          <span className="text-xs text-muted-foreground ml-auto">
            {sections.filter(s => s.enabled).length} de {sections.length} ativas
          </span>
        </div>

        <div className="space-y-3">
          {/* Header row */}
          <div className="hidden sm:grid grid-cols-12 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Seção</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Máx. Itens</div>
            <div className="col-span-2 text-center">Ações</div>
          </div>

          {sections.map((section, index) => (
            <div
              key={section.id}
              className={`grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-4 items-center p-3 rounded-lg border transition-colors ${
                section.enabled ? "bg-background border-border" : "bg-background/50 border-border/50 opacity-60"
              }`}
            >
              {/* Order */}
              <div className="sm:col-span-1 flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-muted-foreground hidden sm:block" />
                <span className="text-sm font-bold text-white">{index + 1}</span>
              </div>

              {/* Title */}
              <div className="sm:col-span-4">
                <p className="text-sm font-medium text-white">{section.title}</p>
                <p className="text-xs text-muted-foreground sm:hidden">ID: {section.id}</p>
              </div>

              {/* Toggle */}
              <div className="sm:col-span-2 flex items-center gap-2">
                {section.enabled ? (
                  <Eye className="w-4 h-4 text-green-500" />
                ) : (
                  <EyeOff className="w-4 h-4 text-muted-foreground" />
                )}
                <Switch
                  checked={section.enabled}
                  onCheckedChange={() => toggleSection(section.id)}
                />
              </div>

              {/* Max Items */}
              <div className="sm:col-span-3">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={section.maxItems || config.itemsPerSection}
                  onChange={(e) => updateSectionMaxItems(section.id, parseInt(e.target.value) || 10)}
                  className="bg-background border-border h-8 text-sm"
                />
              </div>

              {/* Move buttons */}
              <div className="sm:col-span-2 flex items-center justify-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSection(index, "up")}
                  disabled={index === 0}
                  className="h-8 w-8 p-0"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => moveSection(index, "down")}
                  disabled={index === sections.length - 1}
                  className="h-8 w-8 p-0"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-400 mb-2">Como funciona</h3>
        <ul className="text-sm text-blue-300/80 space-y-1">
          <li>• Seções desativadas não aparecem na página inicial</li>
          <li>• A ordem das seções segue a configuração acima (de cima para baixo)</li>
          <li>• "Ordem Aleatória" embaralha os itens dentro de cada seção ao atualizar a página</li>
          <li>• "Seção de Lançamentos" mostra conteúdos mais recentes sempre em 2º lugar</li>
          <li>• O limite de itens por seção ajuda a manter a página leve e rápida</li>
        </ul>
      </div>
    </div>
  );
}
