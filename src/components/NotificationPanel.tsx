import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { notificationsColRef, ordersColRef } from "@/lib/collections";
import { publicAssetUrl } from "@/lib/assets";
import { deleteDoc, doc as fsDoc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { Order } from "@/types/order";

interface NotificationDoc {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: number;
  read?: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  time: string;
  read: boolean;
}

interface NotificationPanelProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  onNavigateToOrders?: () => void;
}

const getManagerOrdersCacheKey = (uid: string) => `nack_m_orders_${uid}`;

function SwipeableRow({
  children,
  onSwipeDelete,
}: {
  children: React.ReactNode;
  onSwipeDelete: () => void;
}) {
  const startX = useRef(0);
  const startY = useRef(0);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    // Swipe horizontal dominant vers la gauche
    if (Math.abs(dx) > Math.abs(dy) && dx < 0) {
      setOffsetX(Math.max(dx, -120));
    }
  };

  const onTouchEnd = () => {
    setDragging(false);
    if (offsetX < -80) {
      onSwipeDelete();
    }
    setOffsetX(0);
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      <div className="absolute inset-y-0 right-0 w-24 bg-red-500 flex items-center justify-center text-white text-xs font-semibold">
        Supprimer
      </div>
      <div
        className="relative bg-background transition-transform"
        style={{ transform: `translateX(${offsetX}px)`, transitionDuration: dragging ? "0ms" : "180ms" }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}

const NotificationPanel = ({ size = "md", className, onNavigateToOrders }: NotificationPanelProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingOrders, setPendingOrders] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const lastNotifiedId = useRef<string | null>(null);

  useEffect(() => {
    try {
      if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => undefined);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(notificationsColRef(db, user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Notification[] = snap.docs.map((d) => {
        const n = d.data() as NotificationDoc;
        const ts = Number((n.createdAt as unknown as number) || 0);
        return {
          id: d.id,
          title: n.title,
          message: n.message,
          type: n.type,
          time: new Date(ts).toLocaleString(),
          read: !!n.read,
        };
      });
      setNotifications(list);

      try {
        const newest = list[0];
        if (newest && !newest.read && newest.id !== lastNotifiedId.current) {
          lastNotifiedId.current = newest.id;
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification(newest.title, {
              body: newest.message,
              icon: publicAssetUrl("icons/icon-192x192.png"),
            });
          }
        }
      } catch {
        /* ignore */
      }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPendingOrders(0);
      return;
    }
    const q = query(ordersColRef(db, user.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(
      q,
      (snap) => setPendingOrders(snap.size),
      () => {
        try {
          const cached = localStorage.getItem(getManagerOrdersCacheKey(user.uid));
          if (cached) {
            const list = JSON.parse(cached) as Order[];
            setPendingOrders(Array.isArray(list) ? list.filter((o) => o.status === "pending").length : 0);
          }
        } catch {
          /* ignore */
        }
      }
    );
    return () => unsub();
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications]);
  const badgeCount = unreadCount;

  const getIcon = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "warning":
        return <AlertCircle className="w-4 h-4 text-orange-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getTypeColor = (type: Notification["type"]) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200";
      case "warning":
        return "bg-orange-50 border-orange-200";
      case "error":
        return "bg-red-50 border-red-200";
      default:
        return "bg-blue-50 border-blue-200";
    }
  };

  const markAsRead = async (id: string) => {
    if (!user) return;
    await updateDoc(fsDoc(notificationsColRef(db, user.uid), id), { read: true });
  };

  const markAllAsRead = async () => {
    if (!user) return;
    const unreadNotifications = notifications.filter((n) => !n.read);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await Promise.all(
        unreadNotifications.map((n) => updateDoc(fsDoc(notificationsColRef(db, user.uid), n.id), { read: true }))
      );
    } catch (error) {
      console.error("Erreur marquage notifications:", error);
    }
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    await deleteDoc(fsDoc(notificationsColRef(db, user.uid), id));
  };

  const handleNotificationClick = async (n: Notification) => {
    await markAsRead(n.id);
    if (n.title.toLowerCase().includes("commande") && onNavigateToOrders) {
      onNavigateToOrders();
      setOpen(false);
    }
  };

  const iconSize = size === "sm" ? 16 : size === "md" ? 18 : 20;

  const listContent = (
    <>
      <div className="px-4 pb-3 border-b border-border pr-12">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <SheetTitle className="text-base sm:text-lg">Notifications</SheetTitle>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs shrink-0">
              Tout lu
            </Button>
          )}
        </div>
        {(pendingOrders > 0 || unreadCount > 0) && (
          <SheetDescription className="text-xs sm:text-sm mt-1">
            {pendingOrders > 0 && (
              <>
                {pendingOrders} commande{pendingOrders > 1 ? "s" : ""} en attente
                {unreadCount > 0 ? " • " : ""}
              </>
            )}
            {unreadCount > 0 && (
              <>
                {unreadCount} non lue{unreadCount > 1 ? "s" : ""}
              </>
            )}
          </SheetDescription>
        )}
      </div>

      <ScrollArea className="flex-1 h-[calc(100vh-8rem)] sm:h-[70vh]">
        <div className="p-2 space-y-2">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Bell className="w-12 h-12 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">Aucune notification</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <SwipeableRow key={notification.id} onSwipeDelete={() => void deleteNotification(notification.id)}>
                <Card
                  className={`cursor-pointer transition-all border ${
                    !notification.read ? getTypeColor(notification.type) + " shadow-sm" : "bg-background"
                  }`}
                  onClick={() => void handleNotificationClick(notification)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">{getIcon(notification.type)}</div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-start justify-between gap-2">
                          <h4
                            className={`text-sm font-medium break-words flex-1 min-w-0 ${
                              !notification.read ? "font-semibold" : ""
                            }`}
                          >
                            {notification.title}
                          </h4>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 hover:bg-red-100 hover:text-red-600 flex-shrink-0"
                            aria-label="Supprimer"
                            onClick={(e) => {
                              e.stopPropagation();
                              void deleteNotification(notification.id);
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 break-words">
                          {notification.message}
                        </p>
                        <div className="flex items-center justify-between mt-2 gap-2">
                          <p className="text-xs text-muted-foreground truncate">{notification.time}</p>
                          {!notification.read && <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1 sm:hidden">Glissez à gauche pour supprimer</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </SwipeableRow>
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border">
        <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(false)}>
          Fermer
        </Button>
      </div>
    </>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={`relative hover:bg-accent ${className}`}
        aria-label="Notifications"
        onClick={() => setOpen(true)}
      >
        <Bell size={iconSize} />
        {badgeCount > 0 && (
          <Badge
            variant="destructive"
            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
          >
            {badgeCount > 9 ? "9+" : badgeCount}
          </Badge>
        )}
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-[90vw] sm:max-w-sm p-0 flex flex-col gap-0">
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
            <SheetDescription>Liste des notifications</SheetDescription>
          </SheetHeader>
          {listContent}
        </SheetContent>
      </Sheet>
    </>
  );
};

export default NotificationPanel;
