// 8-karakterlik public offer short_code uretici.
// DB tarafinda da ayni alfabeyle BEFORE INSERT trigger var (20260514 migration),
// bu yuzden frontend gonderemese bile guvenli.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function generateOfferShortCode(): string {
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += ALPHABET.charAt(Math.floor(Math.random() * ALPHABET.length));
    }
    return result;
}
