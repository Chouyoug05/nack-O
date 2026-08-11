import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { profilesColRef } from "@/lib/collections";
import {
  assignTabletByAdmin,
  listAdminAssignedTablets,
  unassignTabletByAdmin,
  type TabletDoc,
} from "@/lib/tabletsSupport";
import { AdminTabletSendDialog } from "@/components/admin/AdminTabletSendDialog";
import { getDocs } from "firebase/firestore";
import { Settings, Smartphone, UserPlus } from "lucide-react";
import type { UserProfile } from "@/types/profile";

type ProfileRow = UserProfile & { id: string };

function formatWhen(ts?: number) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("fr-FR");
  } catch {
    return "—";
  }
}

export function AdminSettingsTabletsPanel({ search }: { search: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [assigned, setAssigned] = useState<Array<TabletDoc & { id: string }>>([]);
  const [ownerUid, setOwnerUid] = useState("");
  const [imei, setImei] = useState("");
  const [label, setLabel] = useState("Tablette NACK");
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const [profSnap, tablets] = await Promise.all([
      getDocs(profilesColRef(db)),
      listAdminAssignedTablets(db),
    ]);
    setProfiles(
      profSnap.docs.map((d) => ({ id: d.id, ...(d.data() as UserProfile) }))
    );
    setAssigned(tablets);
  };

  useEffect(() => {
    reload().catch(() => undefined);
  }, []);

  const filteredAssigned = useMemo(() => {
    if (!search) return assigned;
    const q = search.toLowerCase();
    return assigned.filter(
      (t) =>
        (t.imei || t.id || "").toLowerCase().includes(q) ||
        (t.establishmentName || "").toLowerCase().includes(q) ||
        (t.ownerName || "").toLowerCase().includes(q) ||
        (t.ownerUid || "").toLowerCase().includes(q)
    );
  }, [assigned, search]);

  const availableUsers = useMemo(
    () =>
      profiles
        .filter((p) => !p.assignedTabletImei)
        .sort((a, b) => (a.establishmentName || a.ownerName || "").localeCompare(b.establishmentName || b.ownerName || "")),
    [profiles]
  );

  const onAssign = async () => {
    if (!user || !ownerUid) {
      toast({ title: "Sélectionnez un utilisateur", variant: "destructive" });
      return;
    }
    const profile = profiles.find((p) => p.id === ownerUid);
    if (!profile) return;
    setSaving(true);
    try {
      await assignTabletByAdmin(db, user.uid, ownerUid, profile, imei, label);
      toast({
        title: "Tablette assignée",
        description: `${profile.establishmentName || profile.ownerName} — IMEI enregistré.`,
      });
      setOwnerUid("");
      setImei("");
      setLabel("Tablette NACK");
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Assignation impossible",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const onUnassign = async (tablet: TabletDoc & { id: string }) => {
    if (!window.confirm(`Retirer la tablette IMEI ${tablet.imei || tablet.id} de ${tablet.establishmentName || tablet.ownerName} ?`)) {
      return;
    }
    try {
      await unassignTabletByAdmin(db, tablet.ownerUid, tablet.imei || tablet.id);
      toast({ title: "Assignation retirée" });
      await reload();
    } catch (e: unknown) {
      toast({
        title: "Erreur",
        description: e instanceof Error ? e.message : "Action impossible",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings size={20} />
            Paramètres — Tablettes & IMEI
          </CardTitle>
          <CardDescription>
            Assignez une tablette (IMEI) à un établissement. Seuls ces comptes verront la boîte de réception tablette et les documents que vous envoyez.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Utilisateur / établissement</Label>
              <Select value={ownerUid || "__none__"} onValueChange={(v) => setOwnerUid(v === "__none__" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un compte…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sélectionner —</SelectItem>
                  {availableUsers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {(p.establishmentName || p.ownerName || p.email) + (p.ownerName && p.establishmentName ? ` (${p.ownerName})` : "")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-tablet-label">Nom de la tablette</Label>
              <Input id="admin-tablet-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex: Tablette caisse #1" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="admin-tablet-imei">IMEI (14-15 chiffres)</Label>
              <Input
                id="admin-tablet-imei"
                className="font-mono"
                inputMode="numeric"
                maxLength={15}
                value={imei}
                onChange={(e) => setImei(e.target.value.replace(/\D/g, "").slice(0, 15))}
                placeholder="356789012345678"
              />
            </div>
          </div>
          <Button variant="nack" disabled={saving} onClick={() => void onAssign()}>
            <UserPlus className="h-4 w-4 mr-2" />
            {saving ? "Assignation…" : "Assigner cette tablette au compte"}
          </Button>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone size={20} />
            Tablettes assignées ({filteredAssigned.length})
          </CardTitle>
          <CardDescription>Envoyez reçus, messages ou notifications vers l&apos;IMEI de chaque compte.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {filteredAssigned.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aucune tablette assignée par l&apos;administration.</p>
          ) : (
            filteredAssigned.map((t) => (
              <div key={t.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold">{t.establishmentName || t.ownerName || "Établissement"}</div>
                    <div className="text-sm text-muted-foreground">
                      {t.label || "Tablette"} • IMEI <span className="font-mono">{t.imei || t.id}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      UID {t.ownerUid} • Dernière activité {formatWhen(t.lastSeenAt)}
                    </div>
                  </div>
                  <Badge className="bg-nack-red/10 text-nack-red border-nack-red/20">Assignée admin</Badge>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  <AdminTabletSendDialog tablet={t} />
                  <Button size="sm" variant="outline" onClick={() => void onUnassign(t)}>
                    Retirer l&apos;assignation
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
