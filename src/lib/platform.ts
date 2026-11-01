/** Bridge to the Electron main process, exposed by electron/preload.cjs. */
export interface WaymarkBridge {
  isElectron: true;
  readWorkspace: () => string | null;
  writeWorkspace: (value: string) => boolean;
  writeWorkspaceAsync?: (value: string) => Promise<boolean>;
  platform: string;
  minimize: () => void;
  maximizeToggle: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizedChange: (cb: (maximized: boolean) => void) => () => void;
  notify: (title: string, body: string) => void;
  openExternal: (url: string) => void;
  setCloseToTray: (enabled: boolean) => void;
  setLaunchAtLogin: (enabled: boolean) => void;
  onOpenUrl: (cb: (url: string) => void) => () => void;
}

declare global {
  interface Window {
    waymark?: WaymarkBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.waymark?.isElectron;
}

export function bridge(): WaymarkBridge | null {
  return typeof window !== "undefined" ? (window.waymark ?? null) : null;
}

/** Open a URL in the system browser when in Electron, otherwise a new tab. */
export function openUrl(url: string): void {
  const b = bridge();
  if (b) b.openExternal(url);
  else window.open(url, "_blank", "noopener,noreferrer");
}

/** Show a desktop notification, falling back to the web Notification API. */
export function desktopNotify(title: string, body: string): void {
  const b = bridge();
  if (b) {
    b.notify(title, body);
    return;
  }
  if (typeof Notification !== "undefined") {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    } else if (Notification.permission !== "denied") {
      void Notification.requestPermission().then((p) => {
        if (p === "granted") new Notification(title, { body });
      });
    }
  }
}
