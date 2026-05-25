export type NackDesktopBridge = {
  isElectron?: boolean;
  openExternal?: (url: string) => Promise<void>;
};

type MaybeElectronWindow = Window & {
  nackDesktop?: NackDesktopBridge;
};

export function isElectronRenderer(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const flaggedByPreload = (window as MaybeElectronWindow).nackDesktop?.isElectron === true;
  return flaggedByPreload || ua.includes("Electron");
}
