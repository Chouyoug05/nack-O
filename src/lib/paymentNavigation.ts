import { isElectronRenderer, type NackDesktopBridge } from "@/lib/platform";

/** Ajoute un paramètre pour la page web de succès / erreur (retour application desktop). */
export function appendElectronPaymentReturn(url: string): string {
  if (!isElectronRenderer()) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}returnClient=electron`;
}

/** Ouvre SingPay (ou autre) : navigateur système sous Electron, navigation courante sur le web. */
export async function openPaymentUrl(url: string): Promise<void> {
  const desk = (typeof window !== "undefined" ? (window as Window & { nackDesktop?: NackDesktopBridge }).nackDesktop : undefined);
  if (desk?.openExternal) {
    await desk.openExternal(url);
    return;
  }
  window.location.href = url;
}
