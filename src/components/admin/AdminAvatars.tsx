import { useState, useEffect } from 'react';
import { getAvatars, addAvatar, deleteAvatar } from '@/lib/firebase';
import { Avatar } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Trash2, Plus, Image as ImageIcon } from 'lucide-react';

export const AdminAvatars = () => {
    const [avatars, setAvatars] = useState<Avatar[]>([]);
    const [newUrl, setNewUrl] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => { loadAvatars(); }, []);

    const loadAvatars = async () => {
        try {
            const data = await getAvatars();
            setAvatars(data);
        } catch (error) {
            console.error("Failed to load avatars", error);
            toast.error("Erro ao carregar avatares");
        }
    };

    const handleAdd = async () => {
        if (!newUrl) return;
        setLoading(true);
        try {
            await addAvatar(newUrl);
            setNewUrl('');
            toast.success('Avatar adicionado!');
            loadAvatars();
        } catch (e) {
            toast.error('Erro ao adicionar avatar');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (confirm('Excluir este avatar?')) {
            try {
                await deleteAvatar(id);
                loadAvatars();
                toast.success('Avatar removido');
            } catch (e) {
                toast.error('Erro ao remover avatar');
            }
        }
    }

    return (
        <div className="p-6 md:p-10 space-y-8 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b border-border pb-6">
                <div className="p-3 bg-primary/10 rounded-xl">
                    <ImageIcon className="w-8 h-8 text-primary" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Gerenciar Avatares
                    </h1>
                    <p className="text-muted-foreground mt-1">Catálogo de imagens para perfis de usuário</p>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 items-end bg-card p-6 rounded-xl border border-border shadow-sm">
                <div className="w-full sm:flex-1 space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">URL da Imagem</label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="https://exemplo.com/avatar.png"
                            value={newUrl}
                            onChange={e => setNewUrl(e.target.value)}
                            className="bg-input border-border"
                            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                        />
                    </div>
                </div>
                <Button onClick={handleAdd} disabled={loading || !newUrl} className="w-full sm:w-auto gap-2 bg-primary hover:bg-primary/90 text-primary-foreground min-w-[120px]">
                    {loading ? 'Adicionando...' : <><Plus className="w-4 h-4" /> Adicionar</>}
                </Button>
            </div>

            <div className="space-y-4">
                <h2 className="text-lg font-semibold text-white">Avatares Disponíveis ({avatars.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4">
                    {avatars.map(avatar => (
                        <div key={avatar.id} className="group relative aspect-square rounded-xl overflow-hidden border border-border bg-card/50 hover:border-primary/50 transition-all shadow-sm">
                            <img src={avatar.url} alt="Avatar" className="w-full h-full object-cover" loading="lazy" />
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all backdrop-blur-sm">
                                <Button
                                    variant="destructive"
                                    size="icon"
                                    onClick={() => handleDelete(avatar.id)}
                                    className="rounded-full w-10 h-10 shadow-lg hover:scale-110 transition-transform"
                                >
                                    <Trash2 className="w-5 h-5 text-white" />
                                </Button>
                            </div>
                        </div>
                    ))}
                    {avatars.length === 0 && (
                        <div className="col-span-full py-10 text-center text-muted-foreground bg-card/30 rounded-xl border-dashed border border-border">
                            Nenhum avatar cadastrado.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
