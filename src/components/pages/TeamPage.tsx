import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  UserCheck, 
  UserX, 
  Edit, 
  Link,
  Copy,
  Mail,
  Phone,
  Trash2,
  RefreshCw
} from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";
import { teamColRef, agentTokensTopColRef } from "@/lib/collections";
import { addDoc, deleteDoc, doc as fsDoc, onSnapshot, updateDoc, setDoc, doc } from "firebase/firestore";
import type { TeamMemberDoc, TeamRole } from "@/types/team";

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'serveur' | 'caissier' | 'agent-evenement';
  status: 'active' | 'inactive';
  agentCode?: string;
  dashboardLink?: string;
  lastConnection?: Date;
  agentToken?: string;
}

const TeamPage = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'serveur' | 'caissier' | 'agent-evenement' | null>(null);
  
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
      // Backfill public agentTokens mapping for existing members
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
    let code = `AGT-${randomStr(4)}-${randomStr(4)}`; // e.g., AGT-7K4M-Z9QD
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
    return `/agent-evenement/${token}`;
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
    // Create public mapping for token → owner + code (for unauthenticated agent access)
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
    // Clean up token mapping if available
    try {
      if (member?.agentToken) await deleteDoc(doc(agentTokensTopColRef(db), member.agentToken));
    } catch { /* ignore */ }
    toast({ title: "Agent supprimé", description: `${name} a été retiré de l'équipe.` });
  };

  const handleRegenerateCodes = async (member: TeamMember) => {
    if (!user) return;
    const newCode = generateAgentCode();
    const newToken = generateAgentToken();
    const newLink = generateDashboardLink(member.role as TeamRole, newToken);
    try {
      // Update team doc
      await updateDoc(fsDoc(teamColRef(db, user.uid), member.id), {
        agentCode: newCode,
        agentToken: newToken,
        dashboardLink: newLink,
        updatedAt: Date.now(),
      });
      // Remove old mapping
      if (member.agentToken) {
        try { await deleteDoc(doc(agentTokensTopColRef(db), member.agentToken)); } catch { /* ignore */ }
      }
      // Create new mapping
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

  const serveurs = teamMembers.filter(member => member.role === 'serveur');
  const caissiers = teamMembers.filter(member => member.role === 'caissier');
  const agentsEvenement = teamMembers.filter(member => member.role === 'agent-evenement');
  const activeMembers = teamMembers.filter(member => member.status === 'active');

  const openAddModal = (role: 'serveur' | 'caissier' | 'agent-evenement') => {
    if (role === 'serveur' || role === 'caissier') {
      toast({
        title: "Bientôt disponible",
        description: "Les fonctionnalités d’agent serveur et d’agent caisse seront disponibles en novembre.",
      });
      return;
    }
    setSelectedRole(role);
    setIsAddModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Équipe</p>
                <p className="text-2xl font-bold">{teamMembers.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Users size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Membres Actifs</p>
                <p className="text-2xl font-bold text-green-600">{activeMembers.length}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <UserCheck size={24} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-0">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">S / C / E</p>
                <p className="text-2xl font-bold">{serveurs.length} / {caissiers.length} / {agentsEvenement.length}</p>
              </div>
              <div className="w-12 h-12 bg-gradient-secondary rounded-lg flex items-center justify-center">
                <Users size={24} className="text-nack-red" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="shadow-card border-0">
        <CardHeader>
          <CardTitle>Actions rapides</CardTitle>
          <CardDescription>Gérer votre équipe rapidement</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button
              onClick={() => openAddModal('serveur')}
              className="flex-1 bg-blue-500/50 hover:bg-blue-500/50 cursor-not-allowed text-white h-12"
              disabled
            >
              <Plus size={16} className="mr-2" />
              Ajouter un Serveur
            </Button>
            <Button
              onClick={() => openAddModal('caissier')}
              className="flex-1 bg-green-500/50 hover:bg-green-500/50 cursor-not-allowed text-white h-12"
              disabled
            >
              <Plus size={16} className="mr-2" />
              Ajouter un Caissier
            </Button>
            <Button
              onClick={() => openAddModal('agent-evenement')}
              className="flex-1 bg-purple-500 hover:bg-purple-600 text-white h-12"
            >
              <Plus size={16} className="mr-2" />
              Agent Événement
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Team Members */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Serveurs */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Serveurs ({serveurs.length})</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openAddModal('serveur')}
                disabled
                className="opacity-60 cursor-not-allowed"
              >
                <Plus size={16} className="mr-2" />
                Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {serveurs.map((member) => (
                <div key={member.id} className="bg-nack-beige-light rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{member.firstName} {member.lastName}</p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {member.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                   <div className="space-y-2 text-sm">
                     {member.agentCode && (
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-xs">
                           Code: {member.agentCode}
                         </Badge>
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Mail size={14} />
                       <span>{member.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} />
                       <span>{member.phone}</span>
                     </div>
                     {member.lastConnection && (
                       <p className="text-xs text-muted-foreground">
                         Dernière connexion: {member.lastConnection.toLocaleString()}
                       </p>
                     )}
                   </div>

                   <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(member.dashboardLink!, '_blank')}
                        className="flex-1"
                      >
                        <Link size={14} className="mr-2" />
                        Ouvrir l'interface
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyDashboardLink(member.dashboardLink!, `${member.firstName} ${member.lastName}`)}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(member.id, `${member.firstName} ${member.lastName}`)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateCodes(member)}
                        title="Régénérer code"
                      >
                        <RefreshCw size={16} />
                      </Button>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => toggleMemberStatus(member.id)}
                       className={member.status === 'active' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                     >
                       {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                     </Button>
                   </div>
                </div>
              ))}
              {serveurs.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun serveur dans l'équipe
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Caissiers */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Caissiers ({caissiers.length})</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openAddModal('caissier')}
                disabled
                className="opacity-60 cursor-not-allowed"
              >
                <Plus size={16} className="mr-2" />
                Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {caissiers.map((member) => (
                <div key={member.id} className="bg-nack-beige-light rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{member.firstName} {member.lastName}</p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {member.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                   <div className="space-y-2 text-sm">
                     {member.agentCode && (
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-xs">
                           Code: {member.agentCode}
                         </Badge>
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Mail size={14} />
                       <span>{member.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} />
                       <span>{member.phone}</span>
                     </div>
                     {member.lastConnection && (
                       <p className="text-xs text-muted-foreground">
                         Dernière connexion: {member.lastConnection.toLocaleString()}
                       </p>
                     )}
                   </div>

                   <div className="flex items-center gap-2 mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(member.dashboardLink!, '_blank')}
                        className="flex-1"
                      >
                        <Link size={14} className="mr-2" />
                        Ouvrir l'interface
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyDashboardLink(member.dashboardLink!, `${member.firstName} ${member.lastName}`)}
                      >
                        <Copy size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMember(member.id, `${member.firstName} ${member.lastName}`)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Supprimer"
                      >
                        <Trash2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRegenerateCodes(member)}
                        title="Régénérer code"
                      >
                        <RefreshCw size={16} />
                      </Button>
                     <Button
                       variant="ghost"
                       size="sm"
                       onClick={() => toggleMemberStatus(member.id)}
                       className={member.status === 'active' ? 'text-red-600 hover:text-red-700 hover:bg-red-50' : 'text-green-600 hover:text-green-700 hover:bg-green-50'}
                     >
                       {member.status === 'active' ? <UserX size={16} /> : <UserCheck size={16} />}
                     </Button>
                   </div>
                </div>
              ))}
              {caissiers.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun caissier dans l'équipe
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Agents Événement */}
        <Card className="shadow-card border-0">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Agents Événement ({agentsEvenement.length})</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => openAddModal('agent-evenement')}
              >
                <Plus size={16} className="mr-2" />
                Ajouter
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {agentsEvenement.map((member) => (
                <div key={member.id} className="bg-purple-50 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-500 rounded-full flex items-center justify-center text-white font-semibold">
                        {member.firstName[0]}{member.lastName[0]}
                      </div>
                      <div>
                        <p className="font-semibold">{member.firstName} {member.lastName}</p>
                        <Badge variant={member.status === 'active' ? 'default' : 'secondary'} className="text-xs">
                          {member.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  
                   <div className="space-y-2 text-sm">
                     {member.agentCode && (
                       <div className="flex items-center gap-2">
                         <Badge variant="outline" className="text-xs">
                           Code: {member.agentCode}
                         </Badge>
                       </div>
                     )}
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Mail size={14} />
                       <span>{member.email}</span>
                     </div>
                     <div className="flex items-center gap-2 text-muted-foreground">
                       <Phone size={14} />
                       <span>{member.phone}</span>
                     </div>
                     {member.lastConnection && (
                       <p className="text-xs text-muted-foreground">
                         Dernière connexion: {member.lastConnection.toLocaleString()}
                       </p>
                     )}
                   </div>

                  <div className="flex items-center gap-2 mt-4">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => window.open(member.dashboardLink!, '_blank')}
                       className="flex-1"
                     >
                       <Link size={14} className="mr-2" />
                       Ouvrir l'interface
                     </Button>
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => copyDashboardLink(member.dashboardLink!, `${member.firstName} ${member.lastName}`)}
                     >
                       <Copy size={14} />
                     </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteMember(member.id, `${member.firstName} ${member.lastName}`)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      title="Supprimer"
                    >
                      <Trash2 size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRegenerateCodes(member)}
                      title="Régénérer code"
                    >
                      <RefreshCw size={16} />
                    </Button>
                  </div>
                </div>
              ))}
              {agentsEvenement.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  Aucun agent événement dans l'équipe
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add Member Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Ajouter un {selectedRole === 'serveur' ? 'Serveur' : selectedRole === 'caissier' ? 'Caissier' : 'Agent Événement'}
            </DialogTitle>
            <DialogDescription>
              Remplissez les informations du nouvel agent. Un code d'agent et un lien d'accès personnalisé seront générés automatiquement.
              {selectedRole === 'agent-evenement' && ' Cet agent aura accès uniquement au scanner QR pour valider les billets d\'événements.'}
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
                    '📱 Interface Agent Événement'}
                 </p>
                 <p className="text-xs text-blue-700">
                   {selectedRole === 'serveur' 
                     ? 'L\'agent aura accès aux produits et pourra prendre les commandes'
                     : selectedRole === 'caissier'
                     ? 'L\'agent aura accès à la feuille de caisse pour enregistrer les paiements'
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
    </div>
  );
};

export default TeamPage;