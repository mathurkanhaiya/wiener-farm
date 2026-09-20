// Global safety guard for Adsgram SDK
// Prevents unhandled AdsgramError: "Unable to retrieve launch parameters from any known source. Try to open your app in Telegram environment"
// when the application runs in standalone browser, dev preview, or outside real Telegram client.

export function installAdsgramGuard() {
  if (typeof window === 'undefined') return;

  const hasTelegramInitData = () => {
    try {
      const tg = (window as any).Telegram?.WebApp;
      if (tg?.initData && tg.initData.length > 0) return true;
      const search = window.location.search || '';
      const hash = window.location.hash || '';
      if (search.includes('tgWebAppData=') || hash.includes('tgWebAppData=')) return true;
    } catch {
      // ignore
    }
    return false;
  };

  const createMockController = (blockId?: string) => ({
    show: async () => {
      console.info(`[Adsgram] Simulating ad view in preview/browser environment for block: ${blockId || 'default'}`);
      await new Promise(r => setTimeout(r, 600));
      return { done: true, description: 'Ad completed' };
    },
    destroy: () => {},
    addEventListener: () => {},
    removeEventListener: () => {}
  });

  let realAdsgram: any = (window as any).Adsgram;

  try {
    Object.defineProperty(window, 'Adsgram', {
      configurable: true,
      enumerable: true,
      get() {
        return {
          ...realAdsgram,
          init: (params: any) => {
            if (!hasTelegramInitData()) {
              return createMockController(params?.blockId);
            }
            try {
              if (realAdsgram && typeof realAdsgram.init === 'function') {
                const controller = realAdsgram.init(params);
                if (controller && typeof controller.show === 'function') {
                  const originalShow = controller.show.bind(controller);
                  controller.show = async () => {
                    try {
                      return await originalShow();
                    } catch (err: any) {
                      const msg = String(err?.message || '');
                      if (msg.includes('launch parameters') || msg.includes('Telegram environment')) {
                        console.warn('[Adsgram] Fallback to simulated ad view (missing launch parameters)');
                        return { done: true, description: 'Simulated ad completed' };
                      }
                      throw err;
                    }
                  };
                }
                return controller;
              }
            } catch (err: any) {
              const msg = String(err?.message || '');
              if (msg.includes('launch parameters') || msg.includes('Telegram environment')) {
                return createMockController(params?.blockId);
              }
              console.warn('[Adsgram] init failed:', err);
            }
            return createMockController(params?.blockId);
          }
        };
      },
      set(val) {
        realAdsgram = val;
      }
    });
  } catch (e) {
    console.warn('[AdsgramGuard] Unable to redefine window.Adsgram property:', e);
  }
}

// Automatically install on module load
installAdsgramGuard();
