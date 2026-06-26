import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";

const DISMISS_KEY = "slashslack:install-dismissed";

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}
function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/** Dismissable "add to home screen" prompt, mobile only. */
export function InstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    if (!isMobile() || isStandalone() || localStorage.getItem(DISMISS_KEY)) return;

    // Android / Chromium: capture the install event
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);

    // iOS Safari: no event — show instructions after a short delay
    if (isIos()) {
      const t = setTimeout(() => setVisible(true), 1500);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onPrompt);
      };
    }
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      await deferred.userChoice;
      dismiss();
    }
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-3 inset-x-3 z-[60] bg-elev border border-border rounded-theme shadow-2xl p-3 flex items-center gap-3 md:hidden">
      <div className="w-9 h-9 rounded-md bg-accent text-accent-fg flex items-center justify-center font-bold shrink-0">
        S
      </div>
      <div className="flex-1 text-sm min-w-0">
        <div className="font-semibold">Add to your home screen</div>
        {deferred ? (
          <div className="text-muted text-xs">Install the app for quick access.</div>
        ) : (
          <div className="text-muted text-xs flex items-center gap-1">
            Tap <Share size={12} /> then “Add to Home Screen”.
          </div>
        )}
      </div>
      {deferred && (
        <button onClick={install} className="bg-accent text-accent-fg text-sm px-3 py-1.5 rounded-theme flex items-center gap-1 shrink-0">
          <Download size={14} /> Add
        </button>
      )}
      <button onClick={dismiss} className="text-muted hover:text-fg shrink-0">
        <X size={18} />
      </button>
    </div>
  );
}
