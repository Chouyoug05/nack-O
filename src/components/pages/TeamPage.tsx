import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Plus, 
  UserCheck, 
  UserX, 
  Edit, 
  Link,
  Copy,
  Mail,
  Phone,
  Trash2,
  RefreshCw,
  ChevronLeft,
  LogOut,
  Calendar,
  UtensilsCrossed,
  Wallet,
  QrCode
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { teamColRef, agentTokensTopColRef } from "@/lib/collections";
import { addDoc, deleteDoc, doc as fsDoc, onSnapshot, updateDoc, setDoc, doc } from "firebase/firestore";
import type { TeamMemberDoc, TeamRole } from "@/types/team";
import { useNavigate } from "react-router-dom";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'serveur' | 'caissier' | 'agent-evenement' | 'cuisinier';
  status: 'active' | 'inactive';
  agentCode?: string;
  dashboardLink?: string;
  lastConnection?: Date;
  agentToken?: string;
}

const TeamPage = () => {
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRoleSelectionOpen, setIsRoleSelectionOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'serveur' | 'caissier' | 'agent-evenement' | 'cuisinier' | null>(null);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });
  
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(teamColRef(db, user.uid), (snap) => {
      const list: TeamMember[] = snap.docs.map((d) => {
        const data = d.data() as TeamMemberDoc;
        return {
          id: d.id,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || "",
          phone: data.phone,
          role: data.role,
          status: data.status,
          agentCode: data.agentCode,
          dashboardLink: data.dashboardLink,
          lastConnection: data.lastConnection ? new Date(data.lastConnection) : undefined,
          agentToken: data.agentToken,
        };
      });
      setTeamMembers(list);
      (async () => {
        for (const m of list) {
          if (m.agentToken) {
            try {
              await setDoc(doc(agentTokensTopColRef(db), m.agentToken), {
                ownerUid: user.uid,
                agentCode: m.agentCode,
                firstName: m.firstName,
                lastName: m.lastName,
                role: m.role,
                updatedAt: Date.now(),
              }, { merge: true });
            } catch { /* ignore */ }
          }
        }
      })();
    });
    return () => unsub();
  }, [user]);

  const [newMember, setNewMember] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: ""
  });

  const generateAgentCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const randomStr = (len: number) => Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const existingCodes = new Set(teamMembers.map(m => m.agentCode).filter(Boolean) as string[]);
    let code = `AGT-${randomStr(4)}-${randomStr(4)}`;
    while (existingCodes.has(code)) code = `AGT-${randomStr(4)}-${randomStr(4)}`;
    return code;
  };

  const generateAgentToken = () => {
    const bytes = new Uint8Array(16);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const generateDashboardLink = (role: TeamRole, token: string) => {
    if (role === 'serveur') return `/serveur/${token}`;
    if (role === 'caissier') return `/caisse/${token}`;
    if (role === 'cuisinier') return `/cuisine/${token}`;
    return `/agent-evenement/${token}`;
  };

  const getRoleIcon = (role: TeamMember['role']) => {
    switch (role) {
      case 'serveur': return UtensilsCrossed;
      case 'caissier': return Wallet;
      case 'agent-evenement': return QrCode;
      case 'cuisinier': return UtensilsCrossed;
      default: return UserCheck;
    }
  };

  const getRoleLabel = (role: TeamMember['role']) => {
    switch (role) {
      case 'serveur': return 'Serveur';
      case 'caissier': return 'Caissier';
      case 'agent-evenement': return 'Agent Événement';
      case 'cuisinier': return 'Cuisinier';
      default: return role;
    }
  };

  const handleAddMember = async () => {
    if (!user) return;
    if (!newMember.firstName || !newMember.lastName || !newMember.phone || !selectedRole) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    const agentCode = generateAgentCode();
    const agentToken = generateAgentToken();
    const dashboardLink = generateDashboardLink(selectedRole, agentToken);
    
    const payload: TeamMemberDoc = {
      firstName: newMember.firstName,
      lastName: newMember.lastName,
      email: newMember.email || undefined,
      phone: newMember.phone,
      role: selectedRole,
      status: "active",
      agentCode,
      dashboardLink,
      agentToken,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const teamDocRef = await addDoc(teamColRef(db, user.uid), payload);
    try {
      await setDoc(doc(agentTokensTopColRef(db), agentToken), {
        ownerUid: user.uid,
        agentCode,
        firstName: payload.firstName,
        lastName: payload.lastName,
        role: payload.role,
        createdAt: Date.now(),
      });
    } catch { /* ignore token mapping errors */ }

    setNewMember({ firstName: "", lastName: "", email: "", phone: "" });
    setSelectedRole(null);
    setIsAddModalOpen(false);

    const fullLink = `${window.location.origin}${dashboardLink}`;
    navigator.clipboard.writeText(fullLink);
    
    toast({
      title: "Agent ajouté avec succès",
      description: `${payload.firstName} ${payload.lastName} ajouté. Le lien sécurisé a été copié.`,
    });
  };

  const copyDashboardLink = (link: string, name: string) => {
    const fullLink = `${window.location.origin}${link}`;
    navigator.clipboard.writeText(fullLink);
    toast({
      title: "Lien copié",
      description: `Le lien d'accès de ${name} a été copié dans le presse-papier`,
    });
  };

  const toggleMemberStatus = async (id: string) => {
    if (!user) return;
    const member = teamMembers.find(m => m.id === id);
    if (!member) return;
    const newStatus = member.status === 'active' ? 'inactive' : 'active';
    await updateDoc(fsDoc(teamColRef(db, user.uid), id), { status: newStatus, updatedAt: Date.now() });
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!user) return;
    const member = teamMembers.find(m => m.id === id);
    await deleteDoc(fsDoc(teamColRef(db, user.uid), id));
    try {
      if (member?.agentToken) await deleteDoc(doc(agentTokensTopColRef(db), member.agentToken));
    } catch { /* ignore */ }
    toast({ title: "Agent supprimé", description: `${name} a été retiré de l'équipe.` });
    setIsBottomSheetOpen(false);
    setSelectedMember(null);
  };

  const handleRegenerateCodes = async (member: TeamMember) => {
    if (!user) return;
    const newCode = generateAgentCode();
    const newToken = generateAgentToken();
    const newLink = generateDashboardLink(member.role as TeamRole, newToken);
    try {
      await updateDoc(fsDoc(teamColRef(db, user.uid), member.id), {
        agentCode: newCode,
        agentToken: newToken,
        dashboardLink: newLink,
        updatedAt: Date.now(),
      });
      if (member.agentToken) {
        try { await deleteDoc(doc(agentTokensTopColRef(db), member.agentToken)); } catch { /* ignore */ }
      }
      await setDoc(doc(agentTokensTopColRef(db), newToken), {
        ownerUid: user.uid,
        agentCode: newCode,
        firstName: member.firstName,
        lastName: member.lastName,
        role: member.role,
        createdAt: Date.now(),
      });
      const full = `${window.location.origin}${newLink}`;
      navigator.clipboard.writeText(full);
      toast({ title: "Codes régénérés", description: `Nouveau code: ${newCode}. Lien copié.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible de régénérer le code.", variant: "destructive" });
    }
  };

  const openAddModal = (role: 'serveur' | 'caissier' | 'agent-evenement' | 'cuisinier') => {
    // Fonctionnalités débloquées : tous les rôles sont disponibles
    setSelectedRole(role);
    setIsAddModalOpen(true);
    setIsRoleSelectionOpen(false);
  };

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsBottomSheetOpen(true);
  };

  const handleEditClick = (member: TeamMember) => {
    setEditingMember({
      firstName: member.firstName,
      lastName: member.lastName,
      email: member.email || "",
      phone: member.phone
    });
    setSelectedMember(member);
    setIsEditDialogOpen(true);
    setIsBottomSheetOpen(false);
  };

  const handleUpdateMember = async () => {
    if (!user || !selectedMember) return;
    if (!editingMember.firstName || !editingMember.lastName || !editingMember.phone) {
      toast({
        title: "Erreur",
        description: "Veuillez remplir tous les champs obligatoires",
        variant: "destructive"
      });
      return;
    }

    try {
      await updateDoc(fsDoc(teamColRef(db, user.uid), selectedMember.id), {
        firstName: editingMember.firstName,
        lastName: editingMember.lastName,
        email: editingMember.email || undefined,
        phone: editingMember.phone,
        updatedAt: Date.now(),
      });

      // Mettre à jour aussi dans agentTokens si le token existe
      if (selectedMember.agentToken) {
        try {
          await setDoc(doc(agentTokensTopColRef(db), selectedMember.agentToken), {
            firstName: editingMember.firstName,
            lastName: editingMember.lastName,
            updatedAt: Date.now(),
          }, { merge: true });
        } catch { /* ignore */ }
      }

      toast({
        title: "Membre modifié",
        description: `${editingMember.firstName} ${editingMember.lastName} a été mis à jour.`,
      });
      setIsEditDialogOpen(false);
      setSelectedMember(null);
    } catch (error: unknown) {
      toast({
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible de modifier le membre",
        variant: "destructive"
      });
    }
  };

  const handleInfoClick = (member: TeamMember) => {
    setSelectedMember(member);
    setIsInfoDialogOpen(true);
    setIsBottomSheetOpen(false);
  };

  const openAddModalFromFAB = () => {
    // Ouvrir le menu de sélection de rôle
    setIsRoleSelectionOpen(true);
  };

  return (
    <div className="relative flex h-auto min-h-screen w-full flex-col bg-background">
      {/* Top App Bar */}
      <div className="sticky top-0 z-10 flex items-center bg-background p-4 pb-2 justify-between border-b border-gray-200">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="text-[#181411] dark:text-white flex size-12 shrink-0 items-center justify-center"
          aria-label="Retour"
        >
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[#181411] dark:text-white text-xl font-bold leading-tight tracking-[-0.015em] flex-1 text-center">
          Équipe
        </h2>
        <div className="size-12 shrink-0"></div>
      </div>

      {/* Image Grid */}
      <main className="flex-grow p-4">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-4">
          {teamMembers.map((member) => {
            const RoleIcon = getRoleIcon(member.role);
            const initials = `${member.firstName[0]}${member.lastName[0]}`;
            return (
              <div
                key={member.id}
                onClick={() => handleMemberClick(member)}
                className="flex flex-col gap-2 text-center pb-3 items-center bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-lg transition-shadow cursor-pointer"
              >
                <div className="relative w-28 h-28">
                  <div className="w-full h-full bg-center bg-no-repeat aspect-square bg-cover rounded-full bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center">
                    <span className="text-3xl font-bold text-primary">
                      {initials}
                    </span>
                  </div>
                  <div className="absolute -bottom-1 -right-1 flex items-center justify-center size-9 bg-gray-200 dark:bg-gray-700 rounded-full border-2 border-white dark:border-gray-800">
                    <RoleIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                  </div>
                </div>
                <div>
                  <p className="text-[#181411] dark:text-white text-lg font-bold leading-normal">
                    {member.firstName}
                  </p>
                  <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs mt-1">
                    {member.status === 'active' ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>
            );
          })}
          {teamMembers.length === 0 && (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground">Aucun membre dans l'équipe</p>
            </div>
          )}
        </div>
      </main>

      {/* FAB */}
      <div className="fixed bottom-6 right-6 z-20">
        <button
          onClick={openAddModalFromFAB}
          className="flex max-w-[480px] cursor-pointer items-center justify-center overflow-hidden rounded-full h-16 w-16 bg-primary text-white shadow-lg hover:bg-blue-600 transition-colors"
          aria-label="Ajouter un membre"
        >
          <Plus size={32} />
        </button>
      </div>

      {/* Role Selection Dialog */}
      <Dialog open={isRoleSelectionOpen} onOpenChange={setIsRoleSelectionOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Ajouter un membre d'équipe</DialogTitle>
            <DialogDescription>
              Sélectionnez le type d'agent à ajouter
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-3 py-4 overflow-y-auto flex-1 min-h-0">
            <Button
              variant="outline"
              onClick={() => openAddModal('serveur')}
              className="h-20 flex flex-col gap-2 border-2 hover:border-primary"
            >
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6" />
                <span className="font-semibold text-lg">Serveur</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Prendre des commandes et gérer les produits
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => openAddModal('caissier')}
              className="h-20 flex flex-col gap-2 border-2 hover:border-primary"
            >
              <div className="flex items-center gap-2">
                <Wallet className="w-6 h-6" />
                <span className="font-semibold text-lg">Caissier</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Enregistrer les paiements à la caisse
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => openAddModal('cuisinier')}
              className="h-20 flex flex-col gap-2 border-2 hover:border-primary"
            >
              <div className="flex items-center gap-2">
                <UtensilsCrossed className="w-6 h-6" />
                <span className="font-semibold text-lg">Cuisinier</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Gérer les commandes de nourriture et leur préparation
              </span>
            </Button>
            <Button
              variant="outline"
              onClick={() => openAddModal('agent-evenement')}
              className="h-20 flex flex-col gap-2 border-2 hover:border-primary"
            >
              <div className="flex items-center gap-2">
                <QrCode className="w-6 h-6" />
                <span className="font-semibold text-lg">Agent Événement</span>
              </div>
              <span className="text-sm text-muted-foreground">
                Scanner et valider les billets d'événements
              </span>
            </Button>
          </div>
          <div className="flex justify-end pt-2 border-t">
            <Button variant="outline" onClick={() => setIsRoleSelectionOpen(false)}>
              Annuler
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bottom Sheet */}
      {isBottomSheetOpen && selectedMember && (
        <div className="fixed inset-0 z-30 flex flex-col justify-end items-stretch bg-black/40" onClick={() => setIsBottomSheetOpen(false)}>
          <div
            className="flex flex-col items-stretch bg-background rounded-t-xl transition-transform duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setIsBottomSheetOpen(false)}
              className="flex h-6 w-full items-center justify-center pt-2"
            >
              <div className="h-1.5 w-10 rounded-full bg-gray-300 dark:bg-gray-600"></div>
            </button>
            <div className="flex p-4 justify-center">
              <div className="flex w-full flex-col gap-4 items-center">
                <div className="flex gap-4 flex-col items-center">
                  <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-32 w-32 shadow-md bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center">
                    <span className="text-5xl font-bold text-primary">
                      {`${selectedMember.firstName[0]}${selectedMember.lastName[0]}`}
                    </span>
                  </div>
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-[#181411] dark:text-white text-3xl font-bold leading-tight tracking-[-0.015em] text-center">
                      {selectedMember.firstName} {selectedMember.lastName}
                    </p>
                    <p className="text-[#8a7260] dark:text-gray-400 text-lg font-normal leading-normal text-center flex items-center gap-2">
                      {(() => {
                        const RoleIcon = getRoleIcon(selectedMember.role);
                        return <RoleIcon className="w-5 h-5" />;
                      })()}
                      {getRoleLabel(selectedMember.role)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* Contextual Actions */}
            <div className="grid grid-cols-3 gap-4 p-4 pb-6">
              <button
                onClick={() => handleEditClick(selectedMember)}
                className="flex flex-col items-center justify-center gap-2 p-3 aspect-square bg-gray-200/50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition"
              >
                <Edit className="w-8 h-8 text-primary" />
                <span className="text-xs font-medium">Modifier</span>
              </button>
              <button
                onClick={() => handleInfoClick(selectedMember)}
                className="flex flex-col items-center justify-center gap-2 p-3 aspect-square bg-gray-200/50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-300/50 dark:hover:bg-gray-600/50 transition"
              >
                <Calendar className="w-8 h-8 text-primary" />
                <span className="text-xs font-medium">Infos</span>
              </button>
              <button
                onClick={() => {
                  if (selectedMember) {
                    handleDeleteMember(selectedMember.id, `${selectedMember.firstName} ${selectedMember.lastName}`);
                  }
                }}
                className="flex flex-col items-center justify-center gap-2 p-3 aspect-square bg-destructive/10 dark:bg-destructive/20 rounded-xl hover:bg-destructive/20 dark:hover:bg-destructive/30 transition"
              >
                <Trash2 className="w-8 h-8 text-destructive" />
                <span className="text-xs font-medium">Supprimer</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ajouter un {selectedRole === 'serveur' ? 'Serveur' : selectedRole === 'caissier' ? 'Caissier' : selectedRole === 'cuisinier' ? 'Cuisinier' : 'Agent Événement'}
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations du nouvel agent. Un code d'agent et un lien d'accès personnalisé seront générés automatiquement.
              {selectedRole === 'agent-evenement' && ' Cet agent aura accès uniquement au scanner QR pour valider les billets d\'événements.'}
              {selectedRole === 'cuisinier' && ' Cet agent aura accès uniquement aux commandes contenant de la nourriture pour gérer leur préparation.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">Prénom *</Label>
              <Input
                id="firstName"
                value={newMember.firstName}
                onChange={(e) => setNewMember({...newMember, firstName: e.target.value})}
                placeholder="Marie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Nom de famille *</Label>
              <Input
                id="lastName"
                value={newMember.lastName}
                onChange={(e) => setNewMember({...newMember, lastName: e.target.value})}
                placeholder="Mvondo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Téléphone *</Label>
              <Input
                id="phone"
                value={newMember.phone}
                onChange={(e) => setNewMember({...newMember, phone: e.target.value})}
                placeholder="+241 01 23 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email (optionnel)</Label>
              <Input
                id="email"
                type="email"
                value={newMember.email}
                onChange={(e) => setNewMember({...newMember, email: e.target.value})}
                placeholder="marie.mvondo@gmail.com"
              />
            </div>
          </div>
          
          {newMember.firstName && newMember.lastName && selectedRole && (
            <div className="bg-nack-beige-light p-4 rounded-lg space-y-3">
              <div>
                <p className="text-sm font-medium mb-2">Code agent qui sera généré:</p>
                <Badge variant="outline" className="font-mono">
                  {generateAgentCode()}
                </Badge>
              </div>
              <div>
                <p className="text-sm font-medium mb-2">Lien d'accès qui sera généré:</p>
                <code className="text-xs bg-background p-2 rounded border block break-all">
                  {window.location.origin}{generateDashboardLink(selectedRole, generateAgentToken())}
                </code>
              </div>
               <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                 <p className="text-xs text-blue-800 font-medium mb-1">
                   {selectedRole === 'serveur' ? '🛎️ Interface Serveur' : 
                    selectedRole === 'caissier' ? '💰 Interface Caisse' : 
                    selectedRole === 'cuisinier' ? '👨‍🍳 Interface Cuisine' :
                    '📱 Interface Agent Événement'}
                 </p>
                 <p className="text-xs text-blue-700">
                   {selectedRole === 'serveur' 
                     ? 'L\'agent aura accès aux produits et pourra prendre les commandes'
                     : selectedRole === 'caissier'
                     ? 'L\'agent aura accès à la feuille de caisse pour enregistrer les paiements'
                     : selectedRole === 'cuisinier'
                     ? 'L\'agent aura accès uniquement aux commandes contenant de la nourriture pour gérer leur préparation'
                     : 'L\'agent aura accès uniquement au scanner QR pour valider les billets d\'événements'
                   }
                 </p>
               </div>
              <p className="text-xs text-muted-foreground">
                Le lien sera automatiquement copié dans le presse-papier après l'ajout de l'agent.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)} className="w-full sm:w-auto">
              Annuler
            </Button>
            <Button onClick={handleAddMember} className="bg-gradient-primary text-white w-full sm:w-auto">
              Ajouter l'agent
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Info Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={setIsInfoDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Informations de l'équipier</DialogTitle>
            <DialogDescription>
              Détails complets du membre de l'équipe
            </DialogDescription>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center gap-4">
                <div className="bg-center bg-no-repeat aspect-square bg-cover rounded-full min-h-24 w-24 shadow-md bg-gradient-to-br from-primary/20 via-primary/10 to-primary/5 flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary">
                    {`${selectedMember.firstName[0]}${selectedMember.lastName[0]}`}
                  </span>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold">
                    {selectedMember.firstName} {selectedMember.lastName}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center justify-center gap-2 mt-1">
                    {(() => {
                      const RoleIcon = getRoleIcon(selectedMember.role);
                      return <RoleIcon className="w-4 h-4" />;
                    })()}
                    {getRoleLabel(selectedMember.role)}
                  </p>
                </div>
              </div>

              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center gap-3">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Téléphone</p>
                    <p className="text-sm text-muted-foreground">{selectedMember.phone}</p>
                  </div>
                </div>

                {selectedMember.email && (
                  <div className="flex items-center gap-3">
                    <Mail className="w-5 h-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Email</p>
                      <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <Badge variant={selectedMember.status === 'active' ? 'default' : 'secondary'}>
                    {selectedMember.status === 'active' ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>

                {selectedMember.agentCode && (
                  <div className="bg-nack-beige-light p-3 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Code d'agent</p>
                    <Badge variant="outline" className="font-mono text-sm">
                      {selectedMember.agentCode}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(selectedMember.agentCode || '');
                        toast({ title: "Code copié", description: "Le code d'agent a été copié" });
                      }}
                      className="w-full"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copier le code
                    </Button>
                  </div>
                )}

                {selectedMember.dashboardLink && (
                  <div className="bg-nack-beige-light p-3 rounded-lg space-y-2">
                    <p className="text-sm font-medium">Lien d'accès</p>
                    <code className="text-xs bg-background p-2 rounded border block break-all">
                      {window.location.origin}{selectedMember.dashboardLink}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const fullLink = `${window.location.origin}${selectedMember.dashboardLink}`;
                        navigator.clipboard.writeText(fullLink);
                        toast({ title: "Lien copié", description: "Le lien a été copié" });
                      }}
                      className="w-full"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copier le lien
                    </Button>
                  </div>
                )}

                {selectedMember.lastConnection && (
                  <div className="text-sm text-muted-foreground">
                    <p className="font-medium">Dernière connexion</p>
                    <p>{new Date(selectedMember.lastConnection).toLocaleString('fr-FR')}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setIsInfoDialogOpen(false)}>
              Fermer
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Modifier le membre</DialogTitle>
            <DialogDescription>
              Modifiez les informations de {selectedMember?.firstName} {selectedMember?.lastName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editFirstName">Prénom *</Label>
              <Input
                id="editFirstName"
                value={editingMember.firstName}
                onChange={(e) => setEditingMember({...editingMember, firstName: e.target.value})}
                placeholder="Marie"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editLastName">Nom de famille *</Label>
              <Input
                id="editLastName"
                value={editingMember.lastName}
                onChange={(e) => setEditingMember({...editingMember, lastName: e.target.value})}
                placeholder="Mvondo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editPhone">Téléphone *</Label>
              <Input
                id="editPhone"
                value={editingMember.phone}
                onChange={(e) => setEditingMember({...editingMember, phone: e.target.value})}
                placeholder="+241 01 23 45 67"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email (optionnel)</Label>
              <Input
                id="editEmail"
                type="email"
                value={editingMember.email}
                onChange={(e) => setEditingMember({...editingMember, email: e.target.value})}
                placeholder="marie.mvondo@gmail.com"
              />
            </div>
          </div>
          <div className="flex flex-col sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleUpdateMember} className="bg-gradient-primary text-white">
              Enregistrer
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeamPage;