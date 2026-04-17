import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Header } from "@/components/Header";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Camera, Check, MessageCircle, Lock, AlertTriangle, Library
} from "lucide-react";
import { toast } from "sonner";
import { getAccountProfiles, getAvatars, createAccountProfile, updateAccountProfile, deleteAccountProfile, verifyRecoveryCode, validatePin } from "@/lib/firebase";
import { Profile as UserProfileType, Avatar } from "@/types/user";
import { cn } from "@/lib/utils";

const Profile = () => {
  const navigate = useNavigate();
  const { user, profile: accountProfile, currentProfile, logout, selectProfile, plan } = useAuth();

  // State
  const [profiles, setProfiles] = useState<UserProfileType[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfileType | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Recovery Modal
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryStep, setRecoveryStep] = useState<'code' | 'new_pin'>('code');

  // Form State
  const [formName, setFormName] = useState("");
  const [formAvatar, setFormAvatar] = useState("");
  const [formIsKids, setFormIsKids] = useState(false);
  const [formShowLocalLibrary, setFormShowLocalLibrary] = useState(true);
  const [formPin, setFormPin] = useState(""); // New PIN or Empty
  const [currentPin, setCurrentPin] = useState(""); // Confirmation PIN
  const [formLoading, setFormLoading] = useState(false);

  // System Avatars
  const [systemAvatars, setSystemAvatars] = useState<Avatar[]>([]);

  // Check Limits
  const maxProfiles = accountProfile?.profilesLimitOverride ?? plan?.limits?.maxProfiles ?? 2;
  const canCreateProfile = profiles.length < maxProfiles;

  useEffect(() => {
    if (user) {
      loadData();
    } else {
      navigate("/login");
    }
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    try {
      const [profilesData, avatarsData] = await Promise.all([
        getAccountProfiles(user.uid),
        getAvatars()
      ]);
      setProfiles(profilesData);
      setSystemAvatars(avatarsData);
    } catch (error) {
      console.error("Error loading profile data", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoadingProfiles(false);
    }
  };

  const openEditModal = (p: UserProfileType | null) => {
    if (p) {
      setEditingProfile(p);
      setFormName(p.name);
      setFormAvatar(p.avatar || p.avatarUrl || "");
      setFormIsKids(p.isKids);
      setFormShowLocalLibrary(p.showLocalLibrary !== false); // Defaults to true
      setFormPin(""); // Don't show PIN
      setCurrentPin("");
      setIsAddingNew(false);
    } else {
      // Adding new
      setEditingProfile(null);
      setFormName("");
      setFormAvatar(systemAvatars[0]?.url || "");
      setFormIsKids(false);
      setFormShowLocalLibrary(true);
      setFormPin("");
      setCurrentPin("");
      setIsAddingNew(true);
    }
    setShowEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    if (!formName.trim()) { toast.error("Nome é obrigatório"); return; }

    // Security Check: Verify Current PIN if editing and PIN is set
    if (!isAddingNew && editingProfile?.pin) {
      if (!currentPin) {
        toast.error("Confirme seu PIN atual");
        return;
      }

      const pinResult = await validatePin(user.uid, editingProfile.id, currentPin);
      if (!pinResult.success) {
        if (pinResult.locked) {
          toast.error(`Bloqueado por segurança. Tente em ${pinResult.remainingTime} min.`);
        } else {
          toast.error("PIN incorreto");
        }
        return;
      }
    }

    setFormLoading(true);
    try {
      const data: any = {
        name: formName,
        avatar: formAvatar,
        isKids: formIsKids,
        showLocalLibrary: formShowLocalLibrary,
      };

      // Update PIN only if user typed something
      if (formPin.trim()) {
        data.pin = formPin.trim();
      }

      if (isAddingNew) {
        // If adding new, PIN is optional but if typed, use it. 
        // No current PIN check needed.
        await createAccountProfile(user.uid, data);
        toast.success("Perfil criado!");
      } else if (editingProfile) {
        await updateAccountProfile(user.uid, editingProfile.id, data);
        toast.success("Perfil atualizado!");

        if (currentProfile?.id === editingProfile.id) {
          const updated = { ...editingProfile, ...data };
          // Basic update, deeper update needs context refresh conceptually
          // But visually this updates avatar/name
        }
      }
      setShowEditModal(false);
      loadData();
    } catch (e) {
      toast.error("Erro ao salvar perfil");
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProfile = async () => {
    if (!editingProfile || !user) return;

    // Require PIN to delete too
    if (editingProfile.pin) {
      if (!currentPin) {
        toast.error("Digite o PIN para confirmar exclusão");
        return;
      }
      const pinResult = await validatePin(user.uid, editingProfile.id, currentPin);
      if (!pinResult.success) {
        if (pinResult.locked) {
          toast.error(`Bloqueado por segurança. Tente em ${pinResult.remainingTime} min.`);
        } else {
          toast.error("PIN incorreto");
        }
        return;
      }
    }

    if (confirm(`Excluir perfil ${editingProfile.name}?`)) {
      setFormLoading(true);
      try {
        await deleteAccountProfile(user.uid, editingProfile.id);
        toast.success("Perfil removido");
        setShowEditModal(false);
        loadData();
        if (currentProfile?.id === editingProfile.id) {
          navigate("/profiles");
        }
      } catch (e) {
        toast.error("Erro ao remover");
      } finally {
        setFormLoading(false);
      }
    }
  };

  const handleForgotPin = () => {
    const message = `Olá, solicito a recuperação do PIN para o usuário ${user?.email} (${plan?.name || 'Plano'}).`;
    const url = `https://wa.me/244944016791?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');

    // Close Edit, Open Recovery
    setShowEditModal(false);
    setRecoveryStep('code');
    setRecoveryCode("");
    setFormPin("");
    setShowRecoveryModal(true);
  };

  const handleVerifyRecoveryCode = async () => {
    if (!user) return;
    if (!recoveryCode) return;

    setFormLoading(true);
    try {
      const result = await verifyRecoveryCode(recoveryCode, user.uid);
      if (result.success) {
        setRecoveryStep('new_pin');
        toast.success("Código validado. Defina o novo PIN.");
      } else {
        toast.error("Código inválido ou expirado.");
      }
    } catch (e) {
      toast.error("Erro na verificação");
    } finally {
      setFormLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (!user || !editingProfile) return;
    if (!formPin) { toast.error("Digite o novo PIN"); return; }

    setFormLoading(true);
    try {
      // Reset PIN for the profile that was being edited when "Forgot PIN" was clicked
      // We saved 'editingProfile' state.
      await updateAccountProfile(user.uid, editingProfile.id, { pin: formPin });
      toast.success("PIN redefinido com sucesso!");
      setShowRecoveryModal(false);
      loadData();
    } catch (e) {
      toast.error("Erro ao redefinir PIN");
    } finally {
      setFormLoading(false);
    }
  };

  if (!user || !accountProfile) return null;

  return (
    <div className="min-h-screen bg-[#141414] text-white font-sans">
      <Header />

      <div className="container mx-auto px-4 py-16 sm:py-24 max-w-6xl animate-in fade-in duration-500">

        {/* Cabeçalho do Perfil Ativo */}
        <div className="mb-8 sm:mb-12 flex flex-col md:flex-row items-center md:items-start gap-6 md:gap-8 border-b border-zinc-800 pb-10">
          <div className="relative group">
            <img
              src={currentProfile?.avatar || currentProfile?.avatarUrl || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
              alt="Avatar"
              className="w-32 h-32 md:w-40 md:h-40 rounded shadow-2xl object-cover ring-4 ring-transparent group-hover:ring-primary/50 transition-all"
            />
            {currentProfile && (
              <button
                onClick={() => openEditModal(currentProfile)}
                className="absolute bottom-2 right-2 bg-black/80 p-2 rounded-full border border-white/20 hover:bg-primary hover:text-white transition-colors"
              >
                <Camera className="w-5 h-5" />
              </button>
            )}
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-5xl font-bold mb-2">{currentProfile?.name || "Usuário"}</h1>
              <div className="flex items-center justify-center md:justify-start gap-3">
                <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10 uppercase tracking-wider text-xs px-2 py-0.5">
                  {accountProfile.isPremium ? "Premium" : "Free"}
                </Badge>
                {currentProfile?.isKids && (
                  <Badge variant="outline" className="border-blue-500/50 text-blue-400 bg-blue-500/10 uppercase tracking-wider text-xs px-2 py-0.5">Kids</Badge>
                )}
              </div>
            </div>

            {currentProfile && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4">
                <Button onClick={() => openEditModal(currentProfile)} variant="outline" className="border-white/20 hover:bg-white/10 text-white gap-2">
                  <Check className="w-4 h-4" /> Editar Perfil
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Lista de Perfis */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <MessageCircle className="w-6 h-6 text-primary" /> Meus Perfis
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {profiles.map(p => (
              <div key={p.id} className="group relative">
                <div
                  onClick={() => selectProfile(p)}
                  className={cn(
                    "cursor-pointer transition-all duration-300 transform hover:scale-105",
                    currentProfile?.id === p.id ? "ring-2 ring-primary rounded-lg p-1" : ""
                  )}
                >
                  <div className="relative aspect-square mb-2 sm:mb-3 overflow-hidden rounded-lg bg-zinc-800">
                    <img
                      src={p.avatar || p.avatarUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:opacity-80 transition-opacity"
                    />
                    {p.isKids && (
                      <div className="absolute top-2 right-2 bg-blue-500 text-white text-[9px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded font-bold shadow-sm">
                        KIDS
                      </div>
                    )}
                    {p.pin && (
                      <div className="absolute top-2 left-2 bg-black/60 p-1 rounded-full">
                        <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" />
                      </div>
                    )}

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="secondary"
                        size="sm"
                        className="rounded-full h-10 w-10 p-0"
                        onClick={(e) => { e.stopPropagation(); openEditModal(p); }}
                      >
                        <Camera className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <h3 className="text-center font-medium truncate">{p.name}</h3>
                </div>
              </div>
            ))}

            {/* Adicionar Novo - Hidden if Limit Reached */}
            {canCreateProfile && (
              <div
                onClick={() => openEditModal(null)}
                className="cursor-pointer group flex flex-col items-center justify-center aspect-square rounded-lg border-2 border-dashed border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900 transition-all"
              >
                <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mb-2 group-hover:bg-zinc-700 transition-colors">
                  <span className="text-4xl text-zinc-400 font-light">+</span>
                </div>
                <span className="text-zinc-500 font-medium group-hover:text-zinc-300">Adicionar Perfil</span>
              </div>
            )}

            {!canCreateProfile && (
              <div className="flex flex-col items-center justify-center aspect-square rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
                <AlertTriangle className="w-8 h-8 text-yellow-600 mb-2" />
                <p className="text-sm text-gray-500">Limite de perfis atingido ({maxProfiles})</p>
              </div>
            )}
          </div>
        </div>

      </div>

      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333] text-white sm:max-w-[800px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{isAddingNew ? "Criar Novo Perfil" : "Editar Perfil"}</DialogTitle>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-6">
            {/* Left Column: Avatar Selection */}
            <div className="space-y-6 flex flex-col items-center">
              <div className="relative group">
                <img
                  src={formAvatar || "https://upload.wikimedia.org/wikipedia/commons/0/0b/Netflix-avatar.png"}
                  className="w-32 h-32 md:w-48 md:h-48 rounded-xl shadow-2xl object-cover ring-4 ring-zinc-800 transition-transform group-hover:scale-105"
                  alt="Avatar Preview"
                />
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl">
                  <Camera className="w-8 h-8 text-white" />
                </div>
              </div>
              
              <div className="w-full">
                <Label className="mb-4 block text-zinc-400 text-xs uppercase tracking-widest text-center">Escolha seu Avatar</Label>
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 p-4 bg-black/30 rounded-2xl border border-white/5 max-h-[200px] overflow-y-auto scrollbar-hide">
                  {systemAvatars.map(av => (
                    <button
                      key={av.id}
                      onClick={() => setFormAvatar(av.url)}
                      className={cn(
                        "rounded-lg overflow-hidden transition-all hover:scale-110 aspect-square",
                        formAvatar === av.url ? "ring-2 ring-primary scale-110 z-10" : "opacity-60 hover:opacity-100"
                      )}
                    >
                      <img src={av.url} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column: Settings */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-zinc-400 font-medium">Nome do Perfil</Label>
                <Input
                  value={formName}
                  onChange={e => setFormName(e.target.value)}
                  placeholder="Ex: Minha Família"
                  className="bg-[#0f0f0f] border-zinc-800 h-12 text-lg focus:ring-primary/50"
                />
              </div>

              {/* Security Section */}
              <div className="bg-zinc-900/50 border border-zinc-800 p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <Label className="flex items-center gap-2 text-zinc-200">
                    <Lock className="w-4 h-4 text-primary" /> PIN de Segurança
                  </Label>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-tighter">🔒 4 Dígitos</span>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="password"
                      maxLength={4}
                      placeholder={isAddingNew ? "Definir PIN (Opcional)" : "Novo PIN (Deixe vazio para manter)"}
                      value={formPin}
                      onChange={e => setFormPin(e.target.value.replace(/\D/g, ''))}
                      className="bg-[#0a0a0a] border-zinc-800 text-center tracking-[1em] font-bold text-xl h-12"
                      autoComplete="new-password"
                    />
                  </div>

                  {!isAddingNew && editingProfile?.pin && (
                    <div className="pt-2 mt-2 border-t border-zinc-800/50 space-y-3">
                      <Label className="text-xs text-red-500/80 font-medium italic">Confirmação obrigatória para salvar:</Label>
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          maxLength={4}
                          placeholder="PIN Atual"
                          value={currentPin}
                          onChange={e => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                          className="bg-[#0a0a0a] border-red-500/20 focus:border-red-500 text-center tracking-[1em]"
                          autoComplete="new-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-xs text-zinc-500 hover:text-white"
                          onClick={handleForgotPin}
                        >
                          Esqueci
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Toggles Container */}
              <div className="grid grid-cols-1 gap-3">
                <div 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer",
                    formIsKids ? "bg-blue-500/10 border border-blue-500/30" : "bg-zinc-900/30 border border-zinc-800"
                  )}
                  onClick={() => setFormIsKids(!formIsKids)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", formIsKids ? "bg-blue-500/20 text-blue-400" : "bg-zinc-800 text-zinc-400")}>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Perfil Kids</p>
                      <p className="text-[11px] text-zinc-500">Apenas conteúdo livre</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formIsKids}
                    readOnly
                    className="w-5 h-5 accent-blue-500 pointer-events-none"
                  />
                </div>

                <div 
                  className={cn(
                    "flex items-center justify-between p-4 rounded-2xl transition-all cursor-pointer",
                    formShowLocalLibrary ? "bg-primary/10 border border-primary/30" : "bg-zinc-900/30 border border-zinc-800"
                  )}
                  onClick={() => setFormShowLocalLibrary(!formShowLocalLibrary)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-2 rounded-lg", formShowLocalLibrary ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-400")}>
                      <Library className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Biblioteca Local</p>
                      <p className="text-[11px] text-zinc-500">Mostrar ficheiros offline</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={formShowLocalLibrary}
                    readOnly
                    className="w-5 h-5 accent-primary pointer-events-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-between items-center sm:justify-between border-t border-zinc-800 pt-6 mt-2">
            <div>
              {!isAddingNew && (
                <Button 
                  variant="ghost" 
                  onClick={handleDeleteProfile} 
                  disabled={formLoading} 
                  className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                >
                  Excluir Perfil
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" onClick={() => setShowEditModal(false)} className="text-zinc-500">
                Cancelar
              </Button>
              <Button onClick={handleSaveProfile} disabled={formLoading} className="min-w-[120px] bg-primary hover:bg-primary/90 text-white font-bold rounded-xl">
                {formLoading ? "Aguarde..." : "Salvar"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Recuperação de PIN */}
      <Dialog open={showRecoveryModal} onOpenChange={setShowRecoveryModal}>
        <DialogContent className="bg-[#1a1a1a] border-[#333] text-white">
          <DialogHeader>
            <DialogTitle>Recuperação de PIN</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            {recoveryStep === 'code' ? (
              <>
                <p className="text-gray-400 text-sm">
                  Insira o código de validação que você recebeu do suporte via WhatsApp.
                </p>
                <Input
                  placeholder="CÓDIGO (ex: AB12CD)"
                  value={recoveryCode}
                  onChange={e => setRecoveryCode(e.target.value.toUpperCase())}
                  className="text-center font-mono tracking-widest bg-[#0a0a0a] border-[#333]"
                />
                <Button onClick={handleVerifyRecoveryCode} disabled={formLoading} className="w-full bg-primary hover:bg-primary/90">
                  {formLoading ? "Validando..." : "Validar Código"}
                </Button>
              </>
            ) : (
              <>
                <p className="text-green-400 text-sm">
                  Código verificado! Defina seu novo PIN.
                </p>
                <Input
                  type="password"
                  maxLength={4}
                  placeholder="Novo PIN (4 dígitos)"
                  value={formPin}
                  onChange={e => setFormPin(e.target.value.replace(/\D/g, ''))}
                  className="bg-[#0a0a0a] border-[#333]"
                />
                <Button onClick={handleResetPin} disabled={formLoading} className="w-full bg-primary hover:bg-primary/90">
                  {formLoading ? "Salvando..." : "Redefinir PIN"}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default Profile;
