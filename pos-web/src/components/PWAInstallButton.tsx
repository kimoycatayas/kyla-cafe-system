"use client";

import { useInstallPrompt } from "@/lib/pwa/useInstallPrompt";

/**
 * PWA Install Button Component
 * Shows an install button when the PWA install prompt is available
 * 
 * @example
 * ```tsx
 * <PWAInstallButton />
 * ```
 */
export function PWAInstallButton() {
  const { isAvailable, isInstalled, promptInstall } = useInstallPrompt();

  if (isInstalled) {
    return null; // Don't show anything if already installed
  }

  if (!isAvailable) {
    return null; // Don't show if install prompt isn't available
  }

  return (
    <button
      onClick={promptInstall}
      className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2"
      aria-label="Install Kyla POS app"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
      </svg>
      Install App
    </button>
  );
}

