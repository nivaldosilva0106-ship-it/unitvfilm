import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { Video, Check } from 'lucide-react';
import { getAllContents, getSliderSettings, updateSliderSettings, type SliderSettings } from '@/lib/firebase';
import type { Content } from '@/types/content';

const AdminSlider = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [allContent, setAllContent] = useState<Content[]>([]);
    const [settings, setSettings] = useState<SliderSettings>({
        mode: 'random',
        selectedContentIds: []
    });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [contents, sliderSettings] = await Promise.all([
                getAllContents(),
                getSliderSettings()
            ]);

            // Filter only content with trailer URLs
            const withTrailers = contents.filter(c => c.trailer_url);
            setAllContent(withTrailers);
            setSettings(sliderSettings);
        } catch (error) {
            toast.error('Erro ao carregar dados');
        } finally {
            setLoading(false);
        }
    };

    const handleModeChange = (mode: 'manual' | 'random') => {
        setSettings(prev => ({ ...prev, mode }));
    };

    const handleToggleContent = (contentId: string) => {
        setSettings(prev => {
            const isSelected = prev.selectedContentIds.includes(contentId);
            return {
                ...prev,
                selectedContentIds: isSelected
                    ? prev.selectedContentIds.filter(id => id !== contentId)
                    : [...prev.selectedContentIds, contentId]
            };
        });
    };

    const handleSelectAll = () => {
        setSettings(prev => ({
            ...prev,
            selectedContentIds: allContent.map(c => c.id)
        }));
    };

    const handleDeselectAll = () => {
        setSettings(prev => ({
            ...prev,
            selectedContentIds: []
        }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await updateSliderSettings(settings);
            toast.success('Configurações salvas com sucesso!');
        } catch (error) {
            toast.error('Erro ao salvar configurações');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <AdminLayout>
                <div className="flex items-center justify-center h-64">
                    <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                </div>
            </AdminLayout>
        );
    }

    return (
        <AdminLayout>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            <Video className="w-8 h-8 text-primary" />
                            Gerenciar Slider de Vídeos
                        </h1>
                        <p className="text-muted-foreground mt-2">
                            Configure quais vídeos aparecem no slider da página inicial
                        </p>
                    </div>
                </div>

                <Card className="p-6">
                    <div className="space-y-6">
                        {/* Mode Selection */}
                        <div>
                            <label className="text-sm font-medium mb-3 block">Modo de Seleção</label>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <button
                                    onClick={() => handleModeChange('random')}
                                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${settings.mode === 'random'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${settings.mode === 'random' ? 'border-primary' : 'border-muted-foreground'
                                            }`}>
                                            {settings.mode === 'random' && (
                                                <div className="w-3 h-3 rounded-full bg-primary"></div>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold">Aleatório</div>
                                            <div className="text-sm text-muted-foreground">
                                                Todos os vídeos com trailers aparecem aleatoriamente
                                            </div>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    onClick={() => handleModeChange('manual')}
                                    className={`flex-1 p-4 rounded-lg border-2 transition-all ${settings.mode === 'manual'
                                        ? 'border-primary bg-primary/10'
                                        : 'border-border hover:border-primary/50'
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${settings.mode === 'manual' ? 'border-primary' : 'border-muted-foreground'
                                            }`}>
                                            {settings.mode === 'manual' && (
                                                <div className="w-3 h-3 rounded-full bg-primary"></div>
                                            )}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-semibold">Manual</div>
                                            <div className="text-sm text-muted-foreground">
                                                Selecione manualmente quais vídeos aparecem
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Manual Selection */}
                        {settings.mode === 'manual' && (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <div className="text-sm text-muted-foreground">
                                        {settings.selectedContentIds.length} de {allContent.length} selecionados
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleSelectAll}
                                        >
                                            Selecionar Todos
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleDeselectAll}
                                        >
                                            Limpar Seleção
                                        </Button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                                    {allContent.map((content) => {
                                        const isSelected = settings.selectedContentIds.includes(content.id);
                                        return (
                                            <button
                                                key={content.id}
                                                onClick={() => handleToggleContent(content.id)}
                                                className={`relative group rounded-lg overflow-hidden border-2 transition-all ${isSelected
                                                    ? 'border-primary ring-2 ring-primary/20'
                                                    : 'border-transparent hover:border-primary/50'
                                                    }`}
                                            >
                                                <div className="aspect-[2/3] relative">
                                                    <img
                                                        src={content.thumbnail_url}
                                                        alt={content.title}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {isSelected && (
                                                        <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                                            <div className="bg-primary rounded-full p-2">
                                                                <Check className="w-6 h-6 text-white" />
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="p-2 bg-card">
                                                    <p className="text-xs font-medium truncate">{content.title}</p>
                                                </div>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Random Mode Info */}
                        {settings.mode === 'random' && (
                            <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                                <p>
                                    No modo aleatório, todos os {allContent.length} vídeos com trailers serão exibidos
                                    automaticamente de forma aleatória no slider da página inicial.
                                </p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Save Button */}
                <div className="flex flex-col-reverse sm:flex-row justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={() => navigate('/admin')}
                        className="w-full sm:w-auto"
                    >
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full sm:w-auto"
                    >
                        {saving ? 'Salvando...' : 'Salvar Configurações'}
                    </Button>
                </div>
            </div>
        </AdminLayout>
    );
};

export default AdminSlider;
