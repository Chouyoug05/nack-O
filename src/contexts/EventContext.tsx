import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { db } from "@/lib/firebase";
import { eventsColRef } from "@/lib/collections";
import { addDoc, deleteDoc, doc, onSnapshot, updateDoc } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import type { EventDoc } from "@/types/event";

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxCapacity: number;
  ticketPrice: number;
  currency: string;
  createdAt: Date;
  isActive: boolean;
  ticketsSold: number;
  shareableLink: string;
  imageUrl?: string;
  ownerUid?: string;
  organizerWhatsapp?: string;
  paymentEnabled?: boolean; // Activer le paiement en ligne pour cet événement
}

interface EventContextType {
  events: Event[];
  addEvent: (event: Pick<EventDoc, 'title' | 'description' | 'date' | 'time' | 'location' | 'maxCapacity' | 'ticketPrice' | 'currency' | 'isActive' | 'imageUrl' | 'organizerWhatsapp' | 'paymentEnabled'> & { ticketsSold?: number }) => Promise<string>;
  getEventById: (id: string) => Event | undefined;
  updateEvent: (id: string, event: Partial<EventDoc>) => Promise<void>;
  deleteEvent: (id: string) => Promise<void>;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    if (!user) {
      setEvents([]);
      return;
    }
    const unsub = onSnapshot(eventsColRef(db, user.uid), (snap) => {
      const list: Event[] = snap.docs.map((d) => {
        const data = d.data() as EventDoc;
        return {
          id: d.id,
          title: data.title,
          description: data.description,
          date: data.date,
          time: data.time,
          location: data.location,
          maxCapacity: data.maxCapacity,
          ticketPrice: data.ticketPrice,
          currency: data.currency,
          createdAt: new Date(data.createdAt),
          isActive: data.isActive,
          ticketsSold: data.ticketsSold ?? 0,
          shareableLink: data.shareableLink ?? `${window.location.origin}/event/${d.id}`,
          imageUrl: data.imageUrl,
          ownerUid: data.ownerUid ?? user.uid,
          organizerWhatsapp: data.organizerWhatsapp,
          paymentEnabled: data.paymentEnabled ?? false,
        };
      });
      setEvents(list);
    });
    return () => unsub();
  }, [user]);

  const addEvent: EventContextType['addEvent'] = async (evt) => {
    if (!user) throw new Error('Not authenticated');
    const payload: EventDoc = {
      title: evt.title,
      description: evt.description,
      date: evt.date,
      time: evt.time,
      location: evt.location,
      maxCapacity: evt.maxCapacity,
      ticketPrice: evt.ticketPrice,
      currency: evt.currency,
      createdAt: Date.now(),
      isActive: evt.isActive,
      ticketsSold: evt.ticketsSold ?? 0,
      imageUrl: evt.imageUrl,
      ownerUid: user.uid,
      organizerWhatsapp: evt.organizerWhatsapp,
      paymentEnabled: evt.paymentEnabled ?? false,
    };
    const ref = await addDoc(eventsColRef(db, user.uid), payload);
    const link = `${window.location.origin}/event/${ref.id}`;
    await updateDoc(doc(eventsColRef(db, user.uid), ref.id), { shareableLink: link, eventId: ref.id });
    return ref.id;
  };

  const getEventById = (id: string) => events.find(e => e.id === id);

  const updateEvent: EventContextType['updateEvent'] = async (id, data) => {
    if (!user) throw new Error('Not authenticated');
    const update: Partial<EventDoc> = { ...data };
    await updateDoc(doc(eventsColRef(db, user.uid), id), update);
  };

  const deleteEvent: EventContextType['deleteEvent'] = async (id) => {
    if (!user) throw new Error('Not authenticated');
    await deleteDoc(doc(eventsColRef(db, user.uid), id));
  };

  const value = useMemo<EventContextType>(() => ({
    events,
    addEvent,
    getEventById,
    updateEvent,
    deleteEvent,
  }), [events]);

  return (
    <EventContext.Provider value={value}>
      {children}
    </EventContext.Provider>
  );
};