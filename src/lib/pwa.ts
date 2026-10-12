export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPromptEvent | null = null;
export const getInstallPrompt = () => installPrompt;
export const clearInstallPrompt = () => {
  installPrompt = null;
  window.dispatchEvent(new Event('tajneed-install-change'));
};
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event as InstallPromptEvent;
  window.dispatchEvent(new Event('tajneed-install-change'));
});
window.addEventListener('appinstalled', clearInstallPrompt);

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  const register = () => {
    void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .catch(error => console.warn('App offline support unavailable:', error));
  };
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
