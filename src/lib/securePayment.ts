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
  const host = window.location.hostname.toLowerCase();
  if (host === "www.nack.pro" || host === "nack.pro") {
    return "https://nack.pro/.netlify/functions/complete-public-payment";
  }
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
  const host = window.location.hostname.toLowerCase();
  if (host === "www.nack.pro" || host === "nack.pro") {
    return "https://nack.pro/.netlify/functions/send-notification";
  }
  return "/.netlify/functions/send-notification";
}

export async function sendOrderNotificationViaServer(payload: {
  establishmentId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}): Promise<void> {
  await fetch(resolveSendNotificationUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => undefined);
}
