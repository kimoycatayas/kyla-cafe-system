/**
 * Register service worker for PWA functionality
 */

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported in this browser");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
    });

    console.log("Service Worker registered:", registration);

    // Check for updates periodically
    setInterval(() => {
      registration.update();
    }, 60000); // Check every minute

    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
}

