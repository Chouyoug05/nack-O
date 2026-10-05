import { auth } from "@/lib/firebase";

export interface CompletePaymentResult {
  success: boolean;
  alreadyCompleted?: boolean;
  establishmentId?: string;
  orderId?: string;
  type?: string;
  error?: string;
}

function resolveCompletePaymentUrl(): string {
  if (typeof window === "undefined") return "/.netlify/functions/complete-public-payment";
  return "/.netlify/functions/complete-public-payment";
}

export async function completePaymentViaServer(transactionId: string): Promise<CompletePaymentResult> {
  const res = await fetch(resolveCompletePaymentUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ transactionId }),
  });
  const data = (await res.json().catch(() => ({}))) as CompletePaymentResult & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Erreur confirmation paiement (${res.status})`);
  }
  return data;
}

function resolveSendNotificationUrl(): string {
  if (typeof window === "undefined") return "/.netlify/functions/send-notification";
  return "/.netlify/functions/send-notification";
}

export async function sendOrderNotificationViaServer(payload: {
  establishmentId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  let token = "";
  try {
    token = (await auth.currentUser?.getIdToken(false)) || "";
  } catch {
    token = "";
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  await fetch(resolveSendNotificationUrl(), {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
