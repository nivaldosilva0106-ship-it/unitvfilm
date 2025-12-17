import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { getAccountProfiles, createAccountProfile, updateAccountProfile, deleteAccountProfile, getAvatars, validatePin, verifyRecoveryCode } from "@/lib/firebase";
import { Profile, Avatar } from "@/types/user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Lock, Pencil, Trash2, Baby, Check, MessageCircle, KeyRound, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";

const ADMIN_WHATSAPP = "244944016791";

export default function ProfileSelection() {
    const { user, profile: userProfile, selectProfile, plan } = useAuth();
    const navigate = useNavigate();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPinModal, setShowPinModal] = useState(false);
    const [showEditPinModal, setShowEditPinModal] = useState(false);
    const [showForgotPinModal, setShowForgotPinModal] = useState(false);
    const [pinTargetProfile, setPinTargetProfile] = useState<Profile | null>(null);

    // Lockout state
    const [isLocked, setIsLocked] = useState(false);
    const [remainingLockTime, setRemainingLockTime] = useState(0);
    const [pinAttempts, setPinAttempts] = useState(0);

    // Form State
    const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
    const [name, setName] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [isKids, setIsKids] = useState(false);
    const [newPin, setNewPin] = useState("");
    const [confirmPin, setConfirmPin] = useState("");
    const [currentPinInput, setCurrentPinInput] = useState("");
    const [formLoading, setFormLoading] = useState(false);

    // Forgot PIN state
    const [recoveryCode, setRecoveryCode] = useState("");
    const [recoveryStep, setRecoveryStep] = useState<'code' | 'newpin'>('code');
    const [recoveryNewPin, setRecoveryNewPin] = useState("");
    const [recoveryConfirmPin, setRecoveryConfirmPin] = useState("");

    // System Avatars
    const [systemAvatars, setSystemAvatars] = useState<Avatar[]>([]);

    const userId = user?.uid;
    const maxProfiles = plan?.limits?.maxProfiles || 2;
    const canCreateProfile = profiles.length < maxProfiles;

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
                setAvatarUrl(data[0].url);
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
                setCurrentPinInput("");
                setPinAttempts(0);
                setIsLocked(false);
                setRemainingLockTime(0);
                
                // Check if profile is locked
                if (profile.lockoutUntil && new Date(profile.lockoutUntil) > new Date()) {
                    const remaining = Math.ceil((new Date(profile.lockoutUntil).getTime() - Date.now()) / 60000);
                    setIsLocked(true);
                    setRemainingLockTime(remaining);
                }
                
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

    const handlePinSubmit = async () => {
        if (!pinTargetProfile || !userId) return;
        
        if (isLocked) {
            toast.error(`Perfil bloqueado. Aguarde ${remainingLockTime} minutos ou contacte o admin.`);
            return;
        }

        setFormLoading(true);
        try {
            const result = await validatePin(userId, pinTargetProfile.id, currentPinInput);
            
            if (result.success) {
                setShowPinModal(false);
                doSelectProfile(pinTargetProfile);
            } else if (result.locked) {
                setIsLocked(true);
                setRemainingLockTime(result.remainingTime || 60);
                toast.error(`Excedeu o número de tentativas. Aguarde ${result.remainingTime || 60} minutos ou contacte o admin.`);
            } else {
                const newAttempts = pinAttempts + 1;
                setPinAttempts(newAttempts);
                toast.error(`PIN incorreto. Tentativa ${newAttempts}/3`);
                setCurrentPinInput("");
            }
        } catch (error) {
            toast.error("Erro ao validar PIN");
        } finally {
            setFormLoading(false);
        }
    };

    const openAddModal = () => {
        setEditingProfile(null);
        setName("");
        setAvatarUrl(systemAvatars[0]?.url || "");
        setIsKids(false);
        setNewPin("");
        setConfirmPin("");
        setShowAddModal(true);
    };

    const openEditModal = (profile: Profile) => {
        setEditingProfile(profile);
        setName(profile.name);
        setAvatarUrl(profile.avatarUrl || profile.avatar);
        setIsKids(profile.isKids);
        setNewPin("");
        setConfirmPin("");
        setCurrentPinInput("");
        
        // If profile has PIN, need to validate before editing
        if (profile.pin) {
            setPinTargetProfile(profile);
            setPinAttempts(0);
            setIsLocked(false);
            
            if (profile.lockoutUntil && new Date(profile.lockoutUntil) > new Date()) {
                const remaining = Math.ceil((new Date(profile.lockoutUntil).getTime() - Date.now()) / 60000);
                setIsLocked(true);
                setRemainingLockTime(remaining);
            }
            
            setShowEditPinModal(true);
        } else {
            setShowAddModal(true);
        }
    };

    const handleEditPinValidation = async () => {
        if (!editingProfile || !userId) return;
        
        if (isLocked) {
            toast.error(`Perfil bloqueado. Aguarde ${remainingLockTime} minutos.`);
            return;
        }

        setFormLoading(true);
        try {
            const result = await validatePin(userId, editingProfile.id, currentPinInput);
            
            if (result.success) {
                setShowEditPinModal(false);
                setShowAddModal(true);
            } else if (result.locked) {
                setIsLocked(true);
                setRemainingLockTime(result.remainingTime || 60);
                toast.error(`Excedeu o número de tentativas. Aguarde ${result.remainingTime || 60} minutos ou contacte o admin.`);
            } else {
                const newAttempts = pinAttempts + 1;
                setPinAttempts(newAttempts);
                toast.error(`PIN incorreto. Tentativa ${newAttempts}/3`);
                setCurrentPinInput("");
            }
        } catch (error) {
            toast.error("Erro ao validar PIN");
        } finally {
            setFormLoading(false);
        }
    };

    const handleSaveProfile = async () => {
        if (!userId) return;
        if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
        if (!avatarUrl) { toast.error("Escolha um avatar"); return; }

        // Validate new PIN if provided
        if (newPin) {
            if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
                toast.error("O PIN deve ter 4 números");
                return;
            }
            if (newPin !== confirmPin) {
                toast.error("Os PINs não coincidem");
                return;
            }
        }

        setFormLoading(true);
        try {
            const profileData: any = {
                name,
                avatar: avatarUrl,
                avatarUrl,
                isKids,
            };

            // Only update PIN if a new one is provided
            if (newPin) {
                profileData.pin = newPin;
                profileData.pinAttempts = 0;
                profileData.lockoutUntil = null;
            }

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

    const handleForgotPin = () => {
        setShowPinModal(false);
        setShowEditPinModal(false);
        setRecoveryCode("");
        setRecoveryNewPin("");
        setRecoveryConfirmPin("");
        setRecoveryStep('code');
        setShowForgotPinModal(true);

        // Open WhatsApp with pre-filled message
        const message = encodeURIComponent(
            `🔐 Solicitação de Recuperação de PIN\n\n` +
            `📧 Email: ${userProfile?.email || 'N/A'}\n` +
            `🆔 User ID: ${userId}\n` +
            `📋 Plano: ${plan?.name || 'Free'}\n` +
            `👤 Perfil: ${pinTargetProfile?.name || editingProfile?.name || 'N/A'}\n\n` +
            `Solicito um código para redefinir o PIN do meu perfil.`
        );
        window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${message}`, '_blank');
    };

    const handleRecoveryCodeSubmit = async () => {
        if (!userId || !recoveryCode.trim()) {
            toast.error("Digite o código de recuperação");
            return;
        }

        setFormLoading(true);
        try {
            const result = await verifyRecoveryCode(recoveryCode.trim().toUpperCase(), userId);
            
            if (result.success) {
                setRecoveryStep('newpin');
                toast.success("Código válido! Defina seu novo PIN.");
            } else {
                toast.error("Código inválido ou expirado. Contacte o admin novamente.");
            }
        } catch (error) {
            toast.error("Erro ao validar código");
        } finally {
            setFormLoading(false);
        }
    };

    const handleRecoveryPinSave = async () => {
        if (!userId) return;
        
        const targetProfile = pinTargetProfile || editingProfile;
        if (!targetProfile) {
            toast.error("Perfil não encontrado");
            return;
        }

        if (recoveryNewPin.length !== 4 || !/^\d{4}$/.test(recoveryNewPin)) {
            toast.error("O PIN deve ter 4 números");
            return;
        }
        if (recoveryNewPin !== recoveryConfirmPin) {
            toast.error("Os PINs não coincidem");
            return;
        }

        setFormLoading(true);
        try {
            await updateAccountProfile(userId, targetProfile.id, {
                pin: recoveryNewPin,
                pinAttempts: 0,
                lockoutUntil: null
            });
            
            toast.success("PIN redefinido com sucesso!");
            setShowForgotPinModal(false);
            loadProfiles();
        } catch (error) {
            toast.error("Erro ao salvar novo PIN");
        } finally {
            setFormLoading(false);
        }
    };

    if (loading) return <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Carregando perfis...</div>;

    return (
        <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center animate-in fade-in duration-700">
            <div className="w-full max-w-5xl px-4 text-center">
                <h1 className="text-3xl md:text-5xl font-medium text-white mb-8 md:mb-12 drop-shadow-lg">Quem está assistindo?</h1>

                <div className="flex flex-wrap justify-center gap-4 md:gap-8 mb-12">
                    {profiles.map(profile => (
                        <div key={profile.id} className="group flex flex-col items-center gap-3 w-24 md:w-32 cursor-pointer" onClick={() => handleProfileClick(profile)}>
                            <div className="relative w-24 h-24 md:w-32 md:h-32 rounded bg-zinc-800 overflow-hidden border-2 border-transparent hover:border-white transition-all duration-200">
                                <img src={profile.avatarUrl || profile.avatar} alt={profile.name} className="w-full h-full object-cover" />

                                {isEditing && (
                                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                        <Pencil className="w-8 h-8 text-white" />
                                    </div>
                                )}

                                {!isEditing && profile.pin && (
                                    <div className="absolute bottom-2 right-2 bg-black/60 p-1 rounded-full">
                                        <Lock className="w-3 h-3 text-white" />
                                    </div>
                                )}
                            </div>
                            <span className="text-gray-400 group-hover:text-white text-lg md:text-xl transition-colors truncate w-full">{profile.name}</span>
                        </div>
                    ))}

                    {/* Add Profile Button - Only show if under plan limit */}
                    {canCreateProfile && (
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

            {/* Add/Edit Modal - NO PIN DISPLAYED */}
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

                            {/* New PIN Section - Never shows current PIN */}
                            <div className="space-y-4 border-t border-zinc-800 pt-4">
                                <div className="flex items-center gap-2">
                                    <KeyRound className="w-4 h-4 text-zinc-400" />
                                    <Label className="text-zinc-400">
                                        {editingProfile?.pin ? "Alterar PIN (deixe vazio para manter)" : "Definir PIN (Opcional)"}
                                    </Label>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="newPin" className="text-sm text-zinc-500">Novo PIN</Label>
                                        <Input
                                            id="newPin"
                                            type="password"
                                            value={newPin}
                                            onChange={e => {
                                                if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                                                    setNewPin(e.target.value);
                                                }
                                            }}
                                            className="bg-[#333] border-none text-white tracking-widest text-center"
                                            placeholder="••••"
                                            maxLength={4}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="confirmPin" className="text-sm text-zinc-500">Confirmar PIN</Label>
                                        <Input
                                            id="confirmPin"
                                            type="password"
                                            value={confirmPin}
                                            onChange={e => {
                                                if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                                                    setConfirmPin(e.target.value);
                                                }
                                            }}
                                            className="bg-[#333] border-none text-white tracking-widest text-center"
                                            placeholder="••••"
                                            maxLength={4}
                                        />
                                    </div>
                                </div>
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

            {/* PIN Entry Modal for Profile Access */}
            <Dialog open={showPinModal} onOpenChange={setShowPinModal}>
                <DialogContent className="bg-[#141414] border-zinc-800 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-center pb-4">Digite o PIN de {pinTargetProfile?.name}</DialogTitle>
                    </DialogHeader>
                    
                    {isLocked ? (
                        <div className="py-6 text-center space-y-4">
                            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
                            <p className="text-yellow-500 font-medium">Perfil Bloqueado</p>
                            <p className="text-zinc-400 text-sm">
                                Excedeu o número de tentativas. Aguarde {remainingLockTime} minutos ou contacte o administrador.
                            </p>
                            <Button 
                                onClick={handleForgotPin}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Contactar Admin via WhatsApp
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="py-6 flex flex-col items-center gap-4">
                                <Input
                                    type="password"
                                    autoFocus
                                    value={currentPinInput}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (/^\d*$/.test(val) && val.length <= 4) {
                                            setCurrentPinInput(val);
                                        }
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && handlePinSubmit()}
                                    className="bg-transparent border-2 border-white text-white text-4xl w-40 text-center h-16 tracking-[1em]"
                                    maxLength={4}
                                    disabled={formLoading}
                                />
                                {pinAttempts > 0 && (
                                    <p className="text-yellow-500 text-sm">Tentativas restantes: {3 - pinAttempts}</p>
                                )}
                            </div>
                            <DialogFooter className="flex flex-col gap-2">
                                <Button onClick={handlePinSubmit} disabled={formLoading} className="w-full bg-primary hover:bg-primary/90">
                                    Entrar
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={handleForgotPin}
                                    className="w-full text-zinc-400 hover:text-white"
                                >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    Esqueci o PIN
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* PIN Validation Modal for Edit Access */}
            <Dialog open={showEditPinModal} onOpenChange={setShowEditPinModal}>
                <DialogContent className="bg-[#141414] border-zinc-800 text-white max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="text-center pb-4">Digite o PIN para editar {editingProfile?.name}</DialogTitle>
                    </DialogHeader>
                    
                    {isLocked ? (
                        <div className="py-6 text-center space-y-4">
                            <AlertTriangle className="w-16 h-16 text-yellow-500 mx-auto" />
                            <p className="text-yellow-500 font-medium">Perfil Bloqueado</p>
                            <p className="text-zinc-400 text-sm">
                                Excedeu o número de tentativas. Aguarde {remainingLockTime} minutos ou contacte o administrador.
                            </p>
                            <Button 
                                onClick={handleForgotPin}
                                className="w-full bg-green-600 hover:bg-green-700 text-white"
                            >
                                <MessageCircle className="w-4 h-4 mr-2" />
                                Contactar Admin via WhatsApp
                            </Button>
                        </div>
                    ) : (
                        <>
                            <div className="py-6 flex flex-col items-center gap-4">
                                <Input
                                    type="password"
                                    autoFocus
                                    value={currentPinInput}
                                    onChange={e => {
                                        const val = e.target.value;
                                        if (/^\d*$/.test(val) && val.length <= 4) {
                                            setCurrentPinInput(val);
                                        }
                                    }}
                                    onKeyDown={e => e.key === 'Enter' && handleEditPinValidation()}
                                    className="bg-transparent border-2 border-white text-white text-4xl w-40 text-center h-16 tracking-[1em]"
                                    maxLength={4}
                                    disabled={formLoading}
                                />
                                {pinAttempts > 0 && (
                                    <p className="text-yellow-500 text-sm">Tentativas restantes: {3 - pinAttempts}</p>
                                )}
                            </div>
                            <DialogFooter className="flex flex-col gap-2">
                                <Button onClick={handleEditPinValidation} disabled={formLoading} className="w-full bg-primary hover:bg-primary/90">
                                    Validar e Editar
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={handleForgotPin}
                                    className="w-full text-zinc-400 hover:text-white"
                                >
                                    <KeyRound className="w-4 h-4 mr-2" />
                                    Esqueci o PIN
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Forgot PIN Modal - Recovery Flow */}
            <Dialog open={showForgotPinModal} onOpenChange={setShowForgotPinModal}>
                <DialogContent className="bg-[#141414] border-zinc-800 text-white max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-center pb-4 flex items-center justify-center gap-2">
                            <KeyRound className="w-5 h-5" />
                            Recuperar PIN
                        </DialogTitle>
                    </DialogHeader>
                    
                    {recoveryStep === 'code' ? (
                        <div className="py-6 space-y-6">
                            <div className="text-center space-y-2">
                                <p className="text-zinc-400 text-sm">
                                    Uma janela do WhatsApp foi aberta para contactar o administrador. 
                                    Aguarde o código de recuperação e insira abaixo.
                                </p>
                            </div>
                            
                            <div className="space-y-2">
                                <Label>Código de Recuperação</Label>
                                <Input
                                    autoFocus
                                    value={recoveryCode}
                                    onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                                    className="bg-[#333] border-none text-white text-center text-xl tracking-widest uppercase"
                                    placeholder="XXXXXX"
                                    maxLength={10}
                                />
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button 
                                    onClick={handleRecoveryCodeSubmit} 
                                    disabled={formLoading || !recoveryCode.trim()}
                                    className="w-full bg-primary hover:bg-primary/90"
                                >
                                    Validar Código
                                </Button>
                                <Button 
                                    variant="ghost" 
                                    onClick={() => {
                                        const message = encodeURIComponent(
                                            `🔐 Solicitação de Recuperação de PIN\n\n` +
                                            `📧 Email: ${userProfile?.email || 'N/A'}\n` +
                                            `🆔 User ID: ${userId}\n` +
                                            `📋 Plano: ${plan?.name || 'Free'}\n` +
                                            `👤 Perfil: ${pinTargetProfile?.name || editingProfile?.name || 'N/A'}\n\n` +
                                            `Solicito um código para redefinir o PIN do meu perfil.`
                                        );
                                        window.open(`https://wa.me/${ADMIN_WHATSAPP}?text=${message}`, '_blank');
                                    }}
                                    className="w-full text-green-500 hover:text-green-400 hover:bg-green-950/30"
                                >
                                    <MessageCircle className="w-4 h-4 mr-2" />
                                    Reenviar Mensagem ao Admin
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="py-6 space-y-6">
                            <div className="text-center space-y-2">
                                <Check className="w-12 h-12 text-green-500 mx-auto" />
                                <p className="text-green-500 font-medium">Código válido!</p>
                                <p className="text-zinc-400 text-sm">Defina um novo PIN para o perfil.</p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Novo PIN</Label>
                                    <Input
                                        type="password"
                                        value={recoveryNewPin}
                                        onChange={e => {
                                            if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                                                setRecoveryNewPin(e.target.value);
                                            }
                                        }}
                                        className="bg-[#333] border-none text-white tracking-widest text-center"
                                        placeholder="••••"
                                        maxLength={4}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Confirmar</Label>
                                    <Input
                                        type="password"
                                        value={recoveryConfirmPin}
                                        onChange={e => {
                                            if (e.target.value.length <= 4 && /^\d*$/.test(e.target.value)) {
                                                setRecoveryConfirmPin(e.target.value);
                                            }
                                        }}
                                        className="bg-[#333] border-none text-white tracking-widest text-center"
                                        placeholder="••••"
                                        maxLength={4}
                                    />
                                </div>
                            </div>

                            <Button 
                                onClick={handleRecoveryPinSave} 
                                disabled={formLoading || recoveryNewPin.length !== 4}
                                className="w-full bg-primary hover:bg-primary/90"
                            >
                                Salvar Novo PIN
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
