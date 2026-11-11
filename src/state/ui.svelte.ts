// Navigation and transient UI state: the tab, the toast, confirm requests and
// the overlay stack that Android's back button unwinds.

export type Tab = 'inspection' | 'imprint' | 'chapters' | 'catalog';
export type ToastKind = 'success' | 'error' | 'info' | 'celebrate';

export interface ToastAction {
  label: string;
  run: () => void;
  /** Called when the toast goes away without the action being taken. */
  dismissed?: () => void;
}

export interface Toast {
  message: string;
  kind: ToastKind;
  key: number;
  action?: ToastAction;
  /** Fading out. */
  leaving?: boolean;
}

export interface ConfirmRequest {
  title: string;
  message: string;
  /** The verb on the committing button: "Remove edition", not "OK". */
  action: string;
  danger?: boolean;
  resolve: (ok: boolean) => void;
}

/** Overlays the app opens; one at a time per kind. */
export type Overlay =
  | 'settings'
  | 'coverFinder'
  | 'plate'
  | 'crop'
  | 'preview'
  | 'altText'
  | 'a11y'
  | 'builder'
  | 'report'
  | 'proof'
  | null;

/** How long a toast stays (style.md §8.12): longer when it offers an action. */
export const TOAST_MS = 4000;
export const TOAST_ACTION_MS = 6000;
/** --dur-exit */
const TOAST_EXIT_MS = 160;

class UiState {
  tab = $state<Tab>('inspection');
  overlay = $state<Overlay>(null);
  /** The chapter being dragged in the reading order, so its bar can show it too. */
  dragChapter = $state<string | null>(null);
  /** The chapter shown in the preview sheet. */
  previewChapter = $state<string | null>(null);
  /** The image waiting in the crop sheet. */
  cropImage = $state.raw<{ bytes: Uint8Array; mediaType: string } | null>(null);
  toast = $state.raw<Toast | null>(null);
  confirmRequest = $state.raw<ConfirmRequest | null>(null);
  /** Called by back when no overlay is open and an edition is on the bench. */
  onLeaveEdition: (() => boolean) | null = null;

  private closers: (() => void)[] = [];
  private toastTimer: ReturnType<typeof setTimeout> | undefined;
  private toastKey = 0;

  /** Shows one toast, replacing any current one. */
  notify(message: string, kind: ToastKind = 'info', action?: ToastAction): void {
    if (!this.toast?.leaving) this.toast?.action?.dismissed?.();
    this.toast = { message, kind, key: ++this.toastKey, action };
    this.resumeToast();
  }

  /** A toast with Undo. */
  undoable(message: string, undo: () => void): void {
    this.notify(message, 'success', { label: 'Undo', run: undo });
  }

  /** Holds the toast on screen while it is touched or hovered. */
  pauseToast(): void {
    clearTimeout(this.toastTimer);
  }

  resumeToast(): void {
    clearTimeout(this.toastTimer);
    const toast = this.toast;
    if (!toast) return;
    this.toastTimer = setTimeout(() => this.dismissToast(toast.key), toast.action ? TOAST_ACTION_MS : TOAST_MS);
  }

  dismissToast(key: number): void {
    const toast = this.toast;
    if (toast?.key !== key || toast.leaving) return;
    clearTimeout(this.toastTimer);
    toast.action?.dismissed?.();
    this.toast = { ...toast, action: undefined, leaving: true };
    setTimeout(() => {
      if (this.toast?.key === key) this.toast = null;
    }, TOAST_EXIT_MS);
  }

  /** Runs the toast's action and closes it. */
  actOnToast(): void {
    const toast = this.toast;
    if (!toast?.action) return;
    clearTimeout(this.toastTimer);
    this.toast = null;
    toast.action.run();
  }

  /** Asks in a confirm modal (style.md §8.10). Only for what can't be undone. */
  confirm(request: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    this.confirmRequest?.resolve(false);
    return new Promise((resolve) => {
      this.confirmRequest = {
        ...request,
        resolve: (ok) => {
          this.confirmRequest = null;
          resolve(ok);
        },
      };
    });
  }

  go(tab: Tab): void {
    this.tab = tab;
    globalThis.scrollTo?.({ top: 0 });
  }

  open(overlay: Exclude<Overlay, null>): void {
    this.overlay = overlay;
  }

  close(): void {
    this.overlay = null;
  }

  /** Registers an open overlay; the returned function unregisters it. */
  pushOverlay(close: () => void): () => void {
    this.closers.push(close);
    return () => {
      this.closers = this.closers.filter((c) => c !== close);
    };
  }

  /**
   * Android back (style.md §14): the topmost overlay first, then back to
   * Inspection, then off the bench to the library. False when the app should exit.
   */
  back(): boolean {
    const close = this.closers.at(-1);
    if (close) {
      close();
      return true;
    }
    if (this.onLeaveEdition) {
      if (this.tab !== 'inspection') {
        this.go('inspection');
        return true;
      }
      return this.onLeaveEdition();
    }
    return false;
  }
}

export const ui = new UiState();
