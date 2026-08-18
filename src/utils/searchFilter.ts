// PostgREST .or()/ilike filtrelerine kullanıcı arama metni interpolasyonu için
// güvenli temizleyici. `,` `(` `)` PostgREST'te filtre/grup ayırıcısıdır; bunlar
// kullanıcı girdisinde kalırsa filter injection mümkün olur. Bu yüzden filtre
// anlamı taşıyan karakterleri boşlukla değiştirip kırpıyoruz. Arama kutusu için
// kabul edilebilir bir kısıtlama (örn. "A&B (Ltd)" → "A&B Ltd").
export function sanitizeSearchTerm(input: string | null | undefined): string {
    if (!input) return '';
    return String(input).replace(/[,()*\\:%]/g, ' ').replace(/\s+/g, ' ').trim();
}
