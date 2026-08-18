// Hafif bildirim sesi — asset dosyası gerektirmez, Web Audio API ile üretilir.
// Tarayıcı otomatik-oynatma kısıtı: AudioContext ilk kullanıcı etkileşiminden sonra
// resume edilir (sohbeti açmak / admin'de tıklamak bu etkileşimi sağlar).

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
    try {
        const AC: typeof AudioContext | undefined =
            (window as any).AudioContext || (window as any).webkitAudioContext;
        if (!AC) return null;
        if (!ctx) ctx = new AC();
        return ctx;
    } catch {
        return null;
    }
}

/** Yumuşak iki notalı "ding" çal. */
export function playPing(volume = 0.12): void {
    const c = getCtx();
    if (!c) return;
    try {
        if (c.state === 'suspended') c.resume().catch(() => {});
        const now = c.currentTime;
        const notes = [
            { f: 660, t: 0 },
            { f: 880, t: 0.11 },
        ];
        for (const n of notes) {
            const o = c.createOscillator();
            const g = c.createGain();
            o.type = 'sine';
            o.frequency.value = n.f;
            o.connect(g);
            g.connect(c.destination);
            const start = now + n.t;
            g.gain.setValueAtTime(0.0001, start);
            g.gain.exponentialRampToValueAtTime(volume, start + 0.015);
            g.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
            o.start(start);
            o.stop(start + 0.2);
        }
    } catch {
        /* sessizce geç */
    }
}
