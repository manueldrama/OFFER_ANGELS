// İmzalı dosya bağlantısını YENİ SEKMEDE açar.
//
// NEDEN AYRI YARDIMCI:
//   `const url = await getUrl(); window.open(url)` sezgisel görünüyor ama
//   ÇALIŞMIYOR: tarayıcı açılır pencereye yalnız KULLANICI HAREKETİ sürerken
//   izin verir. await sırasında o pencere kapanır ve window.open sessizce
//   engellenir — kullanıcı düğmeye basar, hiçbir şey olmaz, hata da çıkmaz.
//   Evrak görüntülemenin "çalışmıyor" olmasının sebebi buydu.
//
//   Çözüm: pencereyi tıklama anında BOŞ olarak aç, adres gelince içine yaz.
//   Engellenirse (bazı tarayıcılar boş pencereyi de engeller) çağıran taraf
//   `blocked` cevabıyla kullanıcıya bir bağlantı gösterebilir.

export interface OpenResult {
    ok: boolean;
    /** Açılır pencere engellendi — çağıran isterse bağlantıyı elle sunar. */
    blocked: boolean;
    url: string | null;
    error?: unknown;
}

export async function openSignedFile(getUrl: () => Promise<string>): Promise<OpenResult> {
    // TIKLAMA ANINDA açılır — await'ten SONRA değil.
    const win = window.open('', '_blank', 'noopener');

    try {
        const url = await getUrl();
        if (win && !win.closed) {
            win.location.href = url;
            return { ok: true, blocked: false, url };
        }
        // Pencere engellendi: aynı sekmede açmayı dene. Kullanıcı geri
        // tuşuyla dönebilir; hiçbir şey olmamasından iyidir.
        window.location.href = url;
        return { ok: true, blocked: true, url };
    } catch (error) {
        win?.close();
        return { ok: false, blocked: false, url: null, error };
    }
}
