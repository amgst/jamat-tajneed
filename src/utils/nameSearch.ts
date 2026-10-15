// Roman Urdu search is approximate; original names are never changed.
const letters: Record<string, string> = {
  'ا': 'a', 'آ': 'a', 'أ': 'a', 'إ': 'a', 'ب': 'b', 'پ': 'p',
  'ت': 't', 'ٹ': 't', 'ث': 's', 'ج': 'j', 'چ': 'ch', 'ح': 'h',
  'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z', 'ر': 'r', 'ڑ': 'r',
  'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'z',
  'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
  'ک': 'k', 'ك': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ں': 'n', 'و': 'w', 'ہ': 'h', 'ه': 'h', 'ھ': 'h', 'ۃ': 'h',
  'ة': 'h', 'ی': 'i', 'ي': 'i', 'ے': 'e', 'ئ': 'i', 'ؤ': 'w', 'ء': '',
};

const normalize = (text: string) => text.normalize('NFKC').toLowerCase()
  .replace(/[\u064B-\u065F\u0670\u0640\u200C\u200D]/g, '')
  .replace(/[۰-۹٠-٩]/g, digit => String(digit.charCodeAt(0) - (digit >= '۰' ? 0x06f0 : 0x0660)));
const romanize = (text: string) => Array.from(text, letter => letters[letter] ?? letter).join('');
const phonetic = (text: string) => text.replace(/ph/g, 'f').replace(/q/g, 'k')
  .replace(/([bdtwr])h/g, '$1').replace(/h$/g, '')
  .replace(/[aeiouwy]/g, '').replace(/(.)\1+/g, '$1');

export function matchesNameSearch(text: string, names: string[], query: string): boolean {
  const normalized = normalize(text);
  const nameTokens = names.flatMap(name => romanize(normalize(name)).split(/[^a-z]+/).filter(Boolean));
  return normalize(query).trim().split(/\s+/).filter(Boolean).every(word => {
    if (normalized.includes(word)) return true;
    if (!/^[a-z]+$/.test(word)) return false;
    const key = phonetic(word);
    return nameTokens.some(token => token === word || (key.length >= 2 && phonetic(token) === key));
  });
}
