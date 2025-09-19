export interface CreatePaymentLinkParams {
  amount: number; // en XAF
  reference: string;
  redirectSuccess: string;
  redirectError: string;
  logoURL: string;
  isTransfer?: boolean;
}

interface CreatePaymentLinkResponse {
  link: string;
  exp: string;
}

const SINGPAY_ENDPOINT = "https://gateway.singpay.ga/v1/ext";

// ATTENTION: pour un vrai déploiement, placez ces secrets côté serveur / variables d'environnement
const SINGPAY_CLIENT_ID = "beae8d8d-377a-48f5-be50-20a2d2578e9f";
const SINGPAY_CLIENT_SECRET = "11b90375aa987292c2e2abe0f19b482b45a4d4d2810813c3c9a10c3655cb3535";
const SINGPAY_WALLET = "682211c3ac445b0a4e899383";
const SINGPAY_DISBURSEMENT = "686119e88718fef8d176f4fa";

export async function createSubscriptionPaymentLink(params: CreatePaymentLinkParams): Promise<string> {
  const body = {
    portefeuille: SINGPAY_WALLET,
    reference: params.reference,
    redirect_success: params.redirectSuccess,
    redirect_error: params.redirectError,
    amount: params.amount,
    disbursement: SINGPAY_DISBURSEMENT,
    logoURL: params.logoURL,
    isTransfer: params.isTransfer ?? false,
  };

  const res = await fetch(SINGPAY_ENDPOINT, {
    method: "POST",
    headers: {
      Accept: "*/*",
      "Content-Type": "application/json",
      "x-client-id": SINGPAY_CLIENT_ID,
      "x-client-secret": SINGPAY_CLIENT_SECRET,
      "x-wallet": SINGPAY_WALLET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SingPay error ${res.status}: ${text}`);
  }
  const data = (await res.json()) as CreatePaymentLinkResponse;
  if (!data.link) throw new Error("Lien de paiement introuvable");
  return data.link;
} 