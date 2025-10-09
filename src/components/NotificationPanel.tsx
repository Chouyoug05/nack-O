import { useEffect, useMemo, useState, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bell, AlertCircle, CheckCircle, Info, X } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { notificationsColRef, ordersColRef } from "@/lib/collections";
import { deleteDoc, doc as fsDoc, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { Order } from "@/types/order";

interface NotificationDoc {
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  createdAt: number; // epoch ms
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

const NotificationPanel = ({ size = "md", className, onNavigateToOrders }: NotificationPanelProps) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingOrders, setPendingOrders] = useState<number>(0);
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator === 'undefined' ? true : navigator.onLine);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload a short sound for notifications
    try {
      const audio = new Audio('/favicon.png'); // placeholder to warm cache
      audioRef.current = new Audio('data:audio/mp3;base64,//uQZAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAACcQCA...');
    } catch { /* ignore */ }
    // Request permission for Web Notifications
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => undefined);
      }
    } catch { /* ignore */ }
  }, []);

  // Fermer le popover lors des changements de route (évite des erreurs DOM sur Chrome)
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) { setNotifications([]); return; }
    const q = query(notificationsColRef(db, user.uid), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const list: Notification[] = snap.docs.map((d) => {
        const n = d.data() as NotificationDoc;
        const ts = Number((n.createdAt as unknown as number) || 0);
        const time = new Date(ts).toLocaleString();
        return {
          id: d.id,
          title: n.title,
          message: n.message,
          type: n.type,
          time,
          read: !!n.read,
        };
      });
      setNotifications(list);
      // Play sound and show Web Notification for the latest item if unread
      try {
        const newest = list[0];
        if (newest && !newest.read) {
          if (audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(() => undefined);
          }
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(newest.title, { body: newest.message, icon: '/icons/icon-192x192.png' });
          }
        }
      } catch { /* ignore */ }
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user) { setPendingOrders(0); return; }
    const q = query(ordersColRef(db, user.uid), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snap) => setPendingOrders(snap.size), () => {
      // On snapshot failure (likely offline), fallback to cached orders
      try {
        const cached = localStorage.getItem(getManagerOrdersCacheKey(user.uid));
        if (cached) {
          const list = JSON.parse(cached) as Order[];
          setPendingOrders(Array.isArray(list) ? list.filter(o => o.status === 'pending').length : 0);
        }
      } catch { /* ignore */ }
    });
    const onOnline = () => setIsOnline(true);
    const onOffline = () => {
      setIsOnline(false);
      // also refresh fallback count immediately when going offline
      try {
        const cached = localStorage.getItem(getManagerOrdersCacheKey(user.uid));
        if (cached) {
          const list = JSON.parse(cached) as Order[];
          setPendingOrders(Array.isArray(list) ? list.filter(o => o.status === 'pending').length : 0);
        }
      } catch { /* ignore */ }
    };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      unsub();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [user]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);
  const badgeCount = unreadCount + pendingOrders;

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
    // Optimistic UI only for notifications; orders remain pending until traitées
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = async (id: string) => {
    if (!user) return;
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="icon" 
          className={`relative hover:bg-accent ${className}`}
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
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0 z-50" 
        align="end"
        sideOffset={5}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-lg">Notifications</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={markAllAsRead}
                className="text-xs hover:bg-accent"
              >
                Tout marquer comme lu
              </Button>
            )}
          </div>
          {badgeCount > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {pendingOrders} commande{pendingOrders > 1 ? "s" : ""} en attente • {unreadCount} notif
            </p>
          )}
        </div>

        <ScrollArea className="h-80">
          <div className="p-2">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="w-12 h-12 text-muted-foreground/50 mb-2" />
                <p className="text-sm text-muted-foreground">Aucune notification</p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <Card 
                    key={notification.id} 
                    className={`cursor-pointer transition-all hover:shadow-sm border ${
                      !notification.read 
                        ? getTypeColor(notification.type) + " shadow-sm" 
                        : "bg-background"
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`text-sm font-medium truncate ${
                              !notification.read ? "font-semibold" : ""
                            }`}>
                              {notification.title}
                            </h4>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 flex-shrink-0"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNotification(notification.id);
                              }}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">
                              {notification.time}
                            </p>
                            {!notification.read && (
                              <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-3 border-t border-border">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              onClick={() => setOpen(false)}
            >
              Voir toutes les notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default NotificationPanel;