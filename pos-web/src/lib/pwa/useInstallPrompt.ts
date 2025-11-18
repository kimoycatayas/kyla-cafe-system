"use client";

import { useEffect, useState } from "react";
import {
  isInstallPromptAvailable,
  triggerInstallPrompt,
  isAppInstalled,
} from "./installPrompt";

/**
 * React hook for PWA install prompt
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isAvailable, isInstalled, promptInstall } = useInstallPrompt();
 * 
 *   if (isInstalled) return <div>App is installed!</div>;
 *   if (!isAvailable) return null;
 * 
 *   return (
 *     <button onClick={promptInstall}>
 *       Install App
 *     </button>
 *   );
 * }
 * ```
 */
export function useInstallPrompt() {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check initial state
    setIsAvailable(isInstallPromptAvailable());
    setIsInstalled(isAppInstalled());

    // Listen for install prompt availability changes
    const handleInstallAvailable = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setIsAvailable(customEvent.detail);
    };

    window.addEventListener("pwa-install-available", handleInstallAvailable);

    return () => {
      window.removeEventListener("pwa-install-available", handleInstallAvailable);
    };
  }, []);

  const promptInstall = async () => {
    const outcome = await triggerInstallPrompt();
    if (outcome === "accepted") {
      setIsInstalled(true);
      setIsAvailable(false);
    }
  };

  return {
    isAvailable,
    isInstalled,
    promptInstall,
  };
}

