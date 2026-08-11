import type { ThermalTicketData } from "@/utils/ticketThermal";

export type TabletMessageType = "message" | "receipt" | "notification";

export type TabletMessageDoc = {
  tabletImei: string;
  ownerUid: string;
  establishmentName?: string;
  type: TabletMessageType;
  title: string;
  body: string;
  receiptData?: Partial<ThermalTicketData>;
  readAt?: number | null;
  createdAt: number;
  sentByAdminUid: string;
};
