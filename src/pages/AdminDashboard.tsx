import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { profilesColRef, notificationsColRef } from "@/lib/collections";
import { addDoc, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import type { UserProfile } from "@/types/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, Bell, CheckCircle, Clock, Gift, Search, Users, Wrench } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NotificationForm {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  target: "all" | "filtered" | "selected";
}

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [allProfiles, setAllProfiles] = useState<UserProfile[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "trial" | "active" | "expired">("all");
  const [selectedUids, setSelectedUids] = useState<Set<string>>(new Set());
  const [notif, setNotif] = useState<NotificationForm>({ title: "", message: "", type: "info", target: "all" });
  const [activationDays, setActivationDays] = useState<number>(30);
  const [isFixingAbnormal, setIsFixingAbnormal] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    const q = query(profilesColRef(db), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserProfile[] = snap.docs.map(d => ({ ...(d.data() as UserProfile) }));
      setAllProfiles(list);
    });
    return () => unsub();
  }, [isAdmin]);

  const now = Date.now();
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allProfiles.filter(p => {
      const matchSearch = !s || [p.ownerName, p.email, p.establishmentName].some(v => (v || "").toLowerCase().includes(s));
      const plan = p.plan || "trial";
      const isExpired = plan === "expired" || (p.subscriptionEndsAt ? p.subscriptionEndsAt < now : false);
      const status = plan === "active" && !isExpired ? "active" : plan === "trial" ? "trial" : "expired";
      const matchStatus = statusFilter === "all" || status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [allProfiles, search, statusFilter, now]);

  const stats = useMemo(() => {
    const total = allProfiles.length;
    const active = allProfiles.filter(p => (p.plan === "active") && (typeof p.subscriptionEndsAt === 'number' ? p.subscriptionEndsAt > now : true)).length;
    const trial = allProfiles.filter(p => (p.plan || "trial") === "trial").length;
    const expired = total - active - trial;
    const price = Number(import.meta.env.VITE_SUB_PRICE_XAF || 5000);
    const monthly = active * price;
    return { total, active, trial, expired, price, monthly };
  }, [allProfiles, now]);

  const toggleSelect = (uid: string) => {
    setSelectedUids(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });
  };

  const getTargetUids = (): string[] => {
    if (notif.target === "all") return allProfiles.map(p => p.uid);
    if (notif.target === "filtered") return filtered.map(p => p.uid);
    return Array.from(selectedUids);
  };

  const sendNotifications = async () => {
    const uids = getTargetUids();
    if (uids.length === 0) return;
    const createdAt = Date.now();
    for (const uid of uids) {
      try {
        await addDoc(notificationsColRef(db, uid), {
          title: notif.title || "Annonce",
          message: notif.message || "",
          type: notif.type,
          createdAt,
          read: false,
        });
      } catch {
        // ignore individual failure
      }
    }
    setNotif(prev => ({ ...prev, title: "", message: "" }));
  };

  const activateForDays = async (uid: string, days: number) => {
    const ms = Math.max(1, days) * 24 * 60 * 60 * 1000;
    const until = Date.now() + ms;
    try {
      await updateDoc(doc(db, "profiles", uid), {
        plan: 'active',
        subscriptionEndsAt: until,
        updatedAt: Date.now(),
      });
      toast({ title: "Succès", description: `Abonnement activé pour ${days} jours` });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible d'activer l'abonnement", variant: "destructive" });
    }
  };

  const fixAbnormalSubscription = async (uid: string) => {
    const profile = allProfiles.find(p => p.uid === uid);
    if (!profile || profile.plan !== 'active' || !profile.subscriptionEndsAt) return;
    
    const now = Date.now();
    const daysRemaining = (profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
    
    if (daysRemaining <= 30) {
      toast({ title: "Info", description: "Cet abonnement est normal (≤ 30 jours)" });
      return;
    }
    
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const newSubscriptionEndsAt = now + thirtyDaysMs;
    
    try {
      await updateDoc(doc(db, "profiles", uid), {
        subscriptionEndsAt: newSubscriptionEndsAt,
        updatedAt: now,
      });
      toast({ 
        title: "Corrigé", 
        description: `Abonnement corrigé: ${Math.floor(daysRemaining)}j → 30j` 
      });
    } catch (error) {
      toast({ title: "Erreur", description: "Impossible de corriger l'abonnement", variant: "destructive" });
    }
  };

  const fixAllAbnormalSubscriptions = async () => {
    setIsFixingAbnormal(true);
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let fixed = 0;
    let errors = 0;
    
    try {
      for (const profile of allProfiles) {
        if (profile.plan !== 'active' || !profile.subscriptionEndsAt) continue;
        
        const daysRemaining = (profile.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000);
        if (daysRemaining > 30) {
          try {
            await updateDoc(doc(db, "profiles", profile.uid), {
              subscriptionEndsAt: now + thirtyDaysMs,
              updatedAt: now,
            });
            fixed++;
          } catch {
            errors++;
          }
        }
      }
      
      toast({ 
        title: "Correction terminée", 
        description: `${fixed} abonnement(s) corrigé(s)${errors > 0 ? `, ${errors} erreur(s)` : ''}` 
      });
    } catch (error) {
      toast({ title: "Erreur", description: "Erreur lors de la correction", variant: "destructive" });
    } finally {
      setIsFixingAbnormal(false);
    }
  };

  return (
    <div className="min-h-screen p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Administration</h1>
            <p className="text-sm text-muted-foreground">Gestion des utilisateurs, abonnements, notifications et promotions</p>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users size={16}/> Utilisateurs</CardTitle><CardDescription>Total inscrits</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.total}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><CheckCircle size={16} className="text-green-600"/> Actifs</CardTitle><CardDescription>Abonnés en cours</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.active}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Clock size={16} className="text-amber-600"/> Essai</CardTitle><CardDescription>En période d'essai</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.trial}</div></CardContent>
          </Card>
          <Card className="border-0 shadow-card">
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><AlertCircle size={16} className="text-red-600"/> Expirés</CardTitle><CardDescription>Abonnements expirés</CardDescription></CardHeader>
            <CardContent><div className="text-2xl font-bold">{stats.expired}</div></CardContent>
          </Card>
        </div>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Revenus estimés</CardTitle>
            <CardDescription>Basé sur les abonnements actifs × prix mensuel</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <Badge variant="secondary">Prix: {stats.price.toLocaleString()} XAF</Badge>
              <Badge variant="default">Actifs: {stats.active}</Badge>
              <div className="text-xl font-semibold ml-auto">≈ {stats.monthly.toLocaleString()} XAF/mois</div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2"><Bell size={18}/> Notifications</CardTitle>
            <CardDescription>Envoyer un message à tous, aux filtrés ou aux sélectionnés</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <Input placeholder="Titre" value={notif.title} onChange={e => setNotif({ ...notif, title: e.target.value })} />
              <Select value={notif.type} onValueChange={(v) => setNotif({ ...notif, type: v as NotificationForm["type"] })}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="info">Info</SelectItem>
                  <SelectItem value="success">Succès</SelectItem>
                  <SelectItem value="warning">Avertissement</SelectItem>
                  <SelectItem value="error">Erreur</SelectItem>
                </SelectContent>
              </Select>
              <Select value={notif.target} onValueChange={(v) => setNotif({ ...notif, target: v as NotificationForm["target"] })}>
                <SelectTrigger><SelectValue placeholder="Cible" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="filtered">Filtrés</SelectItem>
                  <SelectItem value="selected">Sélectionnés</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={sendNotifications} className="w-full">Envoyer</Button>
            </div>
            <Input placeholder="Message" value={notif.message} onChange={e => setNotif({ ...notif, message: e.target.value })} />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Utilisateurs</CardTitle>
            <CardDescription>Rechercher, filtrer, sélectionner et activer gratuitement</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <div className="relative">
                <Search size={16} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-7 w-64" placeholder="Rechercher (nom, email, établissement)" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
                <SelectTrigger className="w-40"><SelectValue placeholder="Statut" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="active">Actifs</SelectItem>
                  <SelectItem value="trial">Essai</SelectItem>
                  <SelectItem value="expired">Expirés</SelectItem>
                </SelectContent>
              </Select>
              <div className="ml-auto flex items-center gap-2">
                <Input type="number" className="w-28" min={1} value={activationDays} onChange={e => setActivationDays(Number(e.target.value || 0))} />
                <Button 
                  variant="destructive" 
                  onClick={fixAllAbnormalSubscriptions}
                  disabled={isFixingAbnormal}
                  title="Corriger tous les abonnements avec plus de 30 jours"
                >
                  <Wrench size={16} className="mr-2"/>
                  {isFixingAbnormal ? "Correction..." : "Corriger abonnements anormaux"}
                </Button>
                <Button variant="outline" onClick={async () => {
                  const uids = Array.from(selectedUids);
                  for (const uid of uids) await activateForDays(uid, activationDays);
                }}><Gift size={16} className="mr-2"/>Activer {activationDays} j</Button>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>Établissement</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Fin d'abonnement</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((p) => {
                    const isExpired = (p.plan === 'expired') || (typeof p.subscriptionEndsAt === 'number' ? p.subscriptionEndsAt < now : false);
                    const status = p.plan === 'active' && !isExpired ? 'active' : p.plan === 'trial' ? 'trial' : 'expired';
                    return (
                      <TableRow key={p.uid}>
                        <TableCell>
                          <input type="checkbox" checked={selectedUids.has(p.uid)} onChange={() => toggleSelect(p.uid)} />
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{p.ownerName || p.email}</span>
                            <span className="text-xs text-muted-foreground">{p.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>{p.establishmentName || "—"}</TableCell>
                        <TableCell>
                          {status === 'active' && <Badge className="bg-green-100 text-green-700" variant="secondary">Actif</Badge>}
                          {status === 'trial' && <Badge className="bg-amber-100 text-amber-700" variant="secondary">Essai</Badge>}
                          {status === 'expired' && <Badge className="bg-red-100 text-red-700" variant="secondary">Expiré</Badge>}
                        </TableCell>
                        <TableCell>
                          {p.subscriptionEndsAt ? (
                            <div className="flex flex-col">
                              <span>{new Date(p.subscriptionEndsAt).toLocaleDateString()}</span>
                              {p.plan === 'active' && p.subscriptionEndsAt > now && (
                                <span className={`text-xs ${((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000)) > 30 ? 'text-red-600 font-semibold' : 'text-muted-foreground'}`}>
                                  {Math.floor((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000))} jours restants
                                </span>
                              )}
                            </div>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {p.plan === 'active' && p.subscriptionEndsAt && p.subscriptionEndsAt > now && 
                             ((p.subscriptionEndsAt - now) / (24 * 60 * 60 * 1000)) > 30 && (
                              <Button 
                                size="sm" 
                                variant="destructive" 
                                onClick={() => fixAbnormalSubscription(p.uid)}
                                title="Corriger l'abonnement anormal"
                              >
                                <Wrench size={14} className="mr-1"/> Corriger
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => activateForDays(p.uid, activationDays)}>
                              <Gift size={14} className="mr-2"/> Activer {activationDays} j
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard; 