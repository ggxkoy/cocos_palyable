import { game } from 'cc';

export const STORE_URL = 'https://lastwar.onelink.me/PXmq/playable';

interface AdHost {
    mraid?: { open?: (url: string) => void };
    FbPlayableAd?: { onCTAClick?: () => void };
    dapi?: { openStoreUrl?: () => void };
    ExitApi?: { exit?: () => void };
    parent?: { postMessage?: (message: string, origin: string) => void };
    open?: (url: string, target?: string) => unknown;
    addEventListener?: (event: string, callback: () => void) => void;
}

function adHost(): AdHost {
    return globalThis as unknown as AdHost;
}

let listenersInstalled = false;

export function installAdEventListeners(): void {
    if (listenersInstalled) {
        return;
    }
    listenersInstalled = true;

    const host = adHost();
    if (typeof host.addEventListener !== 'function') {
        return;
    }

    host.addEventListener('ad-event-pause', () => {
        game.pause();
    });
    host.addEventListener('ad-event-resume', () => {
        game.resume();
    });
}

export function notifyGameEnd(): void {
    try {
        const host = adHost();
        if (host.parent && typeof host.parent.postMessage === 'function') {
            host.parent.postMessage('gameEnd', '*');
        }
    } catch {
        // The playable keeps running even when the host page blocks messaging.
    }
}

export function download(): void {
    const host = adHost();

    try {
        if (host.mraid && typeof host.mraid.open === 'function') {
            host.mraid.open(STORE_URL);
            return;
        }
    } catch {
        // Fall through to the next ad network bridge.
    }

    try {
        if (host.FbPlayableAd && typeof host.FbPlayableAd.onCTAClick === 'function') {
            host.FbPlayableAd.onCTAClick();
            return;
        }
    } catch {
        // Fall through to the next ad network bridge.
    }

    try {
        if (host.dapi && typeof host.dapi.openStoreUrl === 'function') {
            host.dapi.openStoreUrl();
            return;
        }
    } catch {
        // Fall through to the next ad network bridge.
    }

    try {
        if (host.parent && typeof host.parent.postMessage === 'function') {
            host.parent.postMessage('download', '*');
        }
        if (host.ExitApi && typeof host.ExitApi.exit === 'function') {
            host.ExitApi.exit();
            return;
        }
    } catch {
        // Fall through to the browser fallback.
    }

    try {
        if (typeof host.open === 'function') {
            host.open(STORE_URL, '_blank');
        }
    } catch {
        // Nothing else to try; the CTA tap is still tracked by the host.
    }
}
