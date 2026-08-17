'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWARegistrar() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[PWA] SW registration failed', err);
      });
    }

    // Listen for install prompt
    function onBeforeInstall(e: Event) {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Listen for app installed
    function onAppInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
    }
    window.addEventListener('appinstalled', onAppInstalled);

    // Online/offline tracking
    setIsOnline(navigator.onLine);
    function onOnline() { setIsOnline(true); }
    function onOffline() { setIsOnline(false); }
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    // Has it been installed before?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onAppInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function handleInstall() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstalled(true);
    }
    setInstallPrompt(null);
  }

  return (
    <>
      {/* Offline indicator (mobile + desktop) */}
      {!isOnline ? (
        <div
          role="status"
          className="fixed top-0 left-0 right-0 z-[60] bg-warning text-ink px-4 py-2 text-center text-[11px] font-extrabold uppercase tracking-[0.15em] shadow-md"
        >
          ⚡ You&apos;re offline — showing cached data
        </div>
      ) : null}

      {/* Install prompt banner (mobile only, top of screen) */}
      {installPrompt && !installed && !dismissed ? (
        <div className="md:hidden fixed bottom-16 left-3 right-3 z-40 bg-ink text-cream border-2 border-orange p-4 shadow-2xl">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-orange mb-1">
            Install UDGOK
          </div>
          <p className="text-[12px] mb-3 leading-snug">
            Add to your home screen for one-tap access in the field.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 px-3 py-2.5 bg-orange text-paper text-[11px] font-extrabold uppercase tracking-[0.1em]"
            >
              Install
            </button>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="px-3 py-2.5 border-2 border-cream/30 text-cream text-[11px] font-extrabold uppercase tracking-[0.1em]"
            >
              Not now
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
