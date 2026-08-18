/**
 * Supabase tek istekte varsayılan en fazla 1000 satır döndürür. Toplu (`.in(...)`)
 * okumalarda satır hacmi 1000'i aşınca pencere dışındaki kayıtlar sessizce düşer;
 * "lead başına en yeni" / sayaç türü hesaplar eksik/boş çıkar. Bu yardımcı, verilen
 * sorguyu `.range()` ile sayfa sayfa çağırıp tüm satırları toplar.
 *
 * `queryFn`, from/to uygulanmış sorguyu döndürmeli:
 *   const rows = await fetchAllPages<Row>((from, to) =>
 *       supabase.from('t').select('...').in('lead_id', ids)
 *           .order('created_at', { ascending: false }).range(from, to));
 */
export async function fetchAllPages<T>(
    queryFn: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
): Promise<T[]> {
    const PAGE = 1000;
    const out: T[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await queryFn(from, from + PAGE - 1);
        if (error) throw error;
        const rows = data || [];
        out.push(...rows);
        if (rows.length < PAGE) break; // son sayfa
    }
    return out;
}

/**
 * Toplu `.in('col', ids)` okumalarında ID listesi büyüyünce sorgu URL'i Supabase
 * ağ geçidinin satır-uzunluk sınırını aşar ve istek "400 Bad Request" döner. Bu
 * yardımcı, ID listesini küçük parçalara bölüp her parçayı (gerekirse sayfa sayfa,
 * fetchAllPages ile) ayrı ayrı çeker ve tüm satırları birleştirir.
 *
 * ÖNEMLİ: Parçalama, `.in(...)` ile filtrelenen kolona göre yapılmalıdır. Böylece
 * bir anahtarın (ör. lead_id) tüm satırları tek bir parçada kalır; "anahtar başına
 * en yeni kazanır" / sayaç türü hesaplar bölünmeden aynen çalışır.
 *
 *   const rows = await fetchInChunks(leadIds, (chunk, from, to) =>
 *       supabase.from('t').select('...').in('lead_id', chunk)
 *           .order('created_at', { ascending: false }).range(from, to));
 */
export async function fetchInChunks<T>(
    ids: string[],
    queryFn: (chunk: string[], from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>,
    chunkSize = 100,
): Promise<T[]> {
    if (ids.length === 0) return [];
    const out: T[] = [];
    for (let i = 0; i < ids.length; i += chunkSize) {
        const chunk = ids.slice(i, i + chunkSize);
        const rows = await fetchAllPages<T>((from, to) => queryFn(chunk, from, to));
        out.push(...rows);
    }
    return out;
}
