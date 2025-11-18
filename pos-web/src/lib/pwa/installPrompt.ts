/**
 * PWA Install Prompt utilities
 * Handles the beforeinstallprompt event and provides a way to trigger the install prompt
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: BeforeInstallPromptEvent | null = null;

/**
 * Initialize the install prompt handler
 * Call this in your app initialization
 */
export function initializeInstallPrompt(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.addEventListener("beforeinstallprompt", (e) => {
    // Prevent the default browser install prompt
    e.preventDefault();
    // Store the event for later use
    deferredPrompt = e as BeforeInstallPromptEvent;

    // Dispatch a custom event so components can listen for it
    window.dispatchEvent(
      new CustomEvent("pwa-install-available", { detail: true })
    );
  });

  // Clear the prompt after installation
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    window.dispatchEvent(
      new CustomEvent("pwa-install-available", { detail: false })
    );
  });
}

/**
 * Check if the install prompt is available
 */
export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

/**
 * Trigger the install prompt
 * Returns a promise that resolves when the user makes a choice
 */
export async function triggerInstallPrompt(): Promise<
  "accepted" | "dismissed" | null
> {
  if (!deferredPrompt) {
    console.warn("Install prompt is not available");
    return null;
  }

  try {
    // Show the install prompt
    await deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await deferredPrompt.userChoice;

    // Clear the prompt
    deferredPrompt = null;

    return outcome;
  } catch (error) {
    console.error("Error showing install prompt:", error);
    return null;
  }
}

/**
 * Check if the app is already installed
 */
export function isAppInstalled(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  // Check if running in standalone mode (installed PWA)
  if (window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }

  // Check if running from home screen (iOS)
  if ((window.navigator as any).standalone === true) {
    return true;
  }

  return false;
}
