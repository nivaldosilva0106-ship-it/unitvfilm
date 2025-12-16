import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAccountProfiles, createAccountProfile, updateAccountProfile, deleteAccountProfile, getAvatars } from "@/lib/firebase";
import { Profile, Avatar } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Lock, Pencil, Trash2, Baby, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

export default function ProfileSelection() {
    const { user, selectProfile, plan } = useAuth();
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [pinTargetProfile, setPinTargetProfile] = useState<Profile | null>(null);

    // Form State
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null); // If null, adding new.
    const [name, setName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [isKids, setIsKids] = useState(false);
    const [pin, setPin] = useState("");
    const [formLoading, setFormLoading] = useState(false);

    // System Avatars
    const [systemAvatars, setSystemAvatars] = useState<Avatar[]>([]);

    useEffect(() => {
        if (user) {
            loadProfiles();
            loadAvatars();
        }
    }, [user]);

    const loadProfiles = async () => {
        if (!user) return;
        try {
            const data = await getAccountProfiles(user.uid);
            setProfiles(data);
        } catch (error) {
            toast.error("Erro ao carregar perfis");
        } finally {
            setLoading(false);
        }
    };

    const loadAvatars = async () => {
        try {
            const data = await getAvatars();
            setSystemAvatars(data);
            if (data.length > 0 && !avatarUrl) {
                setAvatarUrl(data[0].url); // Default to first
            }
        } catch (e) {
            console.error("Error loading avatars");
        }
    };

    const handleProfileClick = (profile: Profile) => {
        if (isEditing) {
            openEditModal(profile);
        } else {
            if (profile.pin) {
                setPinTargetProfile(profile);
                setPin("");
                setShowPinModal(true);
            } else {
                doSelectProfile(profile);
            }
        }
    };

    const doSelectProfile = (profile: Profile) => {
        selectProfile(profile);
        navigate("/");
    };

    const handlePinSubmit = () => {
        if (!pinTargetProfile) return;
        if (pin === pinTargetProfile.pin) {
            setShowPinModal(false);
            doSelectProfile(pinTargetProfile);
        } else {
            toast.error("PIN incorreto");
            setPin("");
        }
    };


    const openAddModal = () => {
        if (plan && profiles.length >= plan.limits.maxProfiles) {
            toast.error(`Seu plano permite apenas ${plan.limits.maxProfiles} perfis. Atualize para criar mais.`);
            return;
        }
        setEditingProfile(null);
        setName("");
        setAvatarUrl(systemAvatars[0]?.url || "");
        setIsKids(false);
        setPin("");
        setShowAddModal(true);
    };

    const openEditModal = (profile: Profile) => {
        setEditingProfile(profile);
        setName(profile.name);
        setAvatarUrl(profile.avatarUrl);
        setIsKids(profile.isKids);
        setPin(profile.pin || "");
        setShowAddModal(true);
    };

    const handleSaveProfile = async () => {
        if (!userId) return;
        if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
        if (!avatarUrl) { toast.error("Escolha um avatar"); return; }

        setFormLoading(true);
        try {
            const profileData = {
                name,
                avatarUrl,
                isKids,
                pin: pin.trim() || undefined
            };

            if (editingProfile) {
                await updateAccountProfile(userId, editingProfile.id, profileData);
                toast.success("Perfil atualizado");
            } else {
                await createAccountProfile(userId, profileData);
                toast.success("Perfil criado");
            }
            setShowAddModal(false);
            loadProfiles();
        } catch (e) {
            toast.error("Erro ao salvar perfil");
        } finally {
            setFormLoading(false);
        }
    };

    const handleDeleteProfile = async () => {
        if (!editingProfile || !userId) return;
        if (!confirm(`Tem certeza que deseja excluir o perfil ${editingProfile.name}?`)) return;

        setFormLoading(true);
        try {
            await deleteAccountProfile(userId, editingProfile.id);
            toast.success("Perfil excluído");
            setShowAddModal(false);
            loadProfiles();
        } catch (e) {
            toast.error("Erro ao excluir");
        } finally {
            setFormLoading(false);
        }
    };

    const userId = user?.uid;

    if (loading) return <div className="min-h-screen bg-black flex items-center justify-center text-white">Carregando perfis...</div>;

    return (
        <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="w-full max-w-5xl px-4 text-center">
                <h1 className="text-3xl md:text-5xl font-medium text-white mb-8 md:mb-12 drop-shadow-lg">Quem está assistindo?</h1>

                <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-12">
                    {profiles.map(profile => (
                        <div key={profile.id} className="group flex flex-col items-center gap-3 w-24 md:w-32 cursor-pointer" onClick={() => handleProfileClick(profile)}>
                            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded bg-zinc-800 overflow-hidden border-2 border-transparent hover:border-white transition-all duration-200">
                                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />

                                {/* Overlay Edit Mode */}
                                {isEditing && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <Pencil className="w-8 h-8 text-white" />
                                    </div>
                                )}

                                {/* Lock Icon */}
                                {!isEditing && profile.pin && (
                                    <div className="absolute bottom-2 right-2 bg-black/60 p-1 rounded-full">
                                        <Lock className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                            <span className="text-gray-400 group-hover:text-white text-lg md:text-xl transition-colors truncate w-full">{profile.name}</span>
                        </div>
                    ))}

                    {/* Add Profile Button */}
                    {profiles.length < 5 && (
                        <div className="group flex flex-col items-center gap-3 w-24 md:w-32 cursor-pointer" onClick={openAddModal}>
                            <div className="w-24 h-24 md:w-32 md:h-32 rounded-md bg-transparent flex items-center justify-center border-2 border-zinc-500 hover:border-white hover:bg-white transition-all duration-200 group-hover:bg-white text-zinc-500 group-hover:text-black">
                                <Plus className="w-12 h-12 md:w-16 md:h-16" />
                            </div>
                            <span className="text-gray-400 group-hover:text-white text-lg md:text-xl transition-colors">Adicionar perfil</span>
                        </div>
                    )}
                </div>

                <Button
                    variant="outline"
                    onClick={() => setIsEditing(!isEditing)}
                    className="border-gray-500 text-gray-500 hover:text-white hover:border-white bg-transparent uppercase tracking-widest px-8"
                >
                    {isEditing ? "Concluir" : "Gerenciar perfis"}
                </Button>
            </div>

            {/* Add/Edit Modal */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="bg-[#141414] border-zinc-800 text-white max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-medium">{editingProfile ? "Editar Perfil" : "Adicionar Perfil"}</DialogTitle>
                    </DialogHeader>

                    <div className="grid md:grid-cols-[auto_1fr] gap-8 py-6">
                        {/* Avatar Section */}
                        <div className="space-y-4">
                            <div className="w-32 h-32 md:w-40 md:h-40 relative mx-auto">
                                <img src={avatarUrl || "/placeholder.png"} className="w-full h-full object-cover rounded shadow-lg" />
                            </div>

                            <div className="space-y-2">
                                <Label className="text-zinc-400 text-xs uppercase tracking-wider">Escolher Avatar</Label>
                                <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto p-1 custom-scrollbar">
                                    {systemAvatars.map(av => (
                                        <div key={av.id}
                                            onClick={() => setAvatarUrl(av.url)}
                                            className={cn("aspect-square rounded overflow-hidden cursor-pointer border-2 transition-all", avatarUrl === av.url ? "border-white scale-95" : "border-transparent hover:border-gray-500")}
                                        >
                                            <img src={av.url} className="w-full h-full object-cover" />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Form Section */}
                        <div className="space-y-6">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nome</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    className="bg-[#333] border-none text-white h-10 placeholder:text-gray-500"
                                    placeholder="Nome do perfil"
                                />
                            </div>

                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="kids"
                                    checked={isKids}
                                    onChange={e => setIsKids(e.target.checked)}
                                    className="w-5 h-5 accent-primary bg-zinc-700 border-none rounded"
                                />
                                <Label htmlFor="kids" className="cursor-pointer select-none">Perfil Infantil?</Label>
                            </div>

                            <div className="space-y-2 border-t border-zinc-800 pt-4">
                                <Label htmlFor="pin">PIN de Bloqueio (Opcional)</Label>
                                <Input
                                    id="pin"
                                    value={pin}
                                    onChange={e => {
                                        if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                                            setPin(e.target.value);
                                        }
                                    }}
                                    className="bg-[#333] border-none text-white w-24 tracking-widest text-center"
                                    placeholder="0000"
                                />
                                <p className="text-xs text-zinc-500">Digite 4 números para proteger este perfil.</p>
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="flex gap-2 sm:justify-between">
                        {editingProfile && (
                            <Button variant="outline" onClick={handleDeleteProfile} className="border-red-900/50 text-red-500 hover:bg-red-950 hover:text-red-400 hover:border-red-900">
                                Excluir Perfil
                            </Button>
                        )}
                        <div className="flex gap-2 w-full justify-end">
                            <Button variant="ghost" onClick={() => setShowAddModal(false)} className="hover:bg-white/10 text-gray-300">Cancelar</Button>
                            <Button onClick={handleSaveProfile} disabled={formLoading} className="bg-white text-black hover:bg-gray-200 font-bold px-8">Salvar</Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* PIN Entry Modal */}
            <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
                <DialogContent className="bg-[#141414] border-zinc-800 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-center pb-4">Digite o PIN de {pinTargetProfile?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="py-6 flex justify-center">
                        <Input
                            type="password"
                            autoFocus
                            value={pin}
                            onChange={e => {
                                const val = e.target.value;
                                if (/^\d*$/.test(val) && val.length <= 4) {
                                    setPin(val);
                                }
                            }}
                            onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                            className="bg-transparent border-2 border-white text-white text-4xl w-40 text-center h-16 tracking-[1em]"
                            maxLength={4}
                        />
                    </div>
                    <DialogFooter className="justify-center">
                        <Button onClick={handlePinSubmit} className="w-full bg-primary hover:bg-primary/90">Entrar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
