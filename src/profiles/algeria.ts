import type { Random } from '../rng';

// Algeria profile data, kept apart from the generator so it can be reviewed and updated on its own.
//
// Wilayas: the 58 wilayas of Law 84-09 of 4 February 1984 on the territorial organisation of the
// country, as amended by Law 19-12 of 11 December 2019, which promoted ten delegated wilayas
// (codes 49 to 58). Check for a later reform before relying on this list for anything official.
export const WILAYA_LIST_VERSION = '58 wilayas: Law 84-09 of 4 February 1984, as amended by Law 19-12 of 11 December 2019';

export interface Wilaya { code: string; fr: string; ar: string }
export const WILAYAS: readonly Wilaya[] = ([
  ['Adrar', 'أدرار'], ['Chlef', 'الشلف'], ['Laghouat', 'الأغواط'], ['Oum El Bouaghi', 'أم البواقي'], ['Batna', 'باتنة'], ['Béjaïa', 'بجاية'], ['Biskra', 'بسكرة'],
  ['Béchar', 'بشار'], ['Blida', 'البليدة'], ['Bouira', 'البويرة'], ['Tamanrasset', 'تمنراست'], ['Tébessa', 'تبسة'], ['Tlemcen', 'تلمسان'], ['Tiaret', 'تيارت'],
  ['Tizi Ouzou', 'تيزي وزو'], ['Alger', 'الجزائر'], ['Djelfa', 'الجلفة'], ['Jijel', 'جيجل'], ['Sétif', 'سطيف'], ['Saïda', 'سعيدة'], ['Skikda', 'سكيكدة'],
  ['Sidi Bel Abbès', 'سيدي بلعباس'], ['Annaba', 'عنابة'], ['Guelma', 'قالمة'], ['Constantine', 'قسنطينة'], ['Médéa', 'المدية'], ['Mostaganem', 'مستغانم'],
  ["M'Sila", 'المسيلة'], ['Mascara', 'معسكر'], ['Ouargla', 'ورقلة'], ['Oran', 'وهران'], ['El Bayadh', 'البيض'], ['Illizi', 'إليزي'], ['Bordj Bou Arréridj', 'برج بوعريريج'],
  ['Boumerdès', 'بومرداس'], ['El Tarf', 'الطارف'], ['Tindouf', 'تندوف'], ['Tissemsilt', 'تيسمسيلت'], ['El Oued', 'الوادي'], ['Khenchela', 'خنشلة'], ['Souk Ahras', 'سوق أهراس'],
  ['Tipaza', 'تيبازة'], ['Mila', 'ميلة'], ['Aïn Defla', 'عين الدفلى'], ['Naâma', 'النعامة'], ['Aïn Témouchent', 'عين تموشنت'], ['Ghardaïa', 'غرداية'], ['Relizane', 'غليزان'],
  ['Timimoun', 'تيميمون'], ['Bordj Badji Mokhtar', 'برج باجي مختار'], ['Ouled Djellal', 'أولاد جلال'], ['Béni Abbès', 'بني عباس'], ['In Salah', 'عين صالح'],
  ['In Guezzam', 'عين قزام'], ['Touggourt', 'تقرت'], ['Djanet', 'جانت'], ["El M'Ghair", 'المغير'], ['El Meniaa', 'المنيعة'],
] as const).map(([fr, ar], i) => ({ code: String(i + 1).padStart(2, '0'), fr, ar }));

// The chef-lieu of 20 wilayas: its commune, its daira and the postal code of Algérie Poste's
// scheme, the wilaya code followed by 000. The chef-lieu commune and daira share the wilaya's
// name except in Algiers, where the commune is Alger-Centre in the daira of Sidi M'Hamed.
export interface Place { wilaya: string; commune: { fr: string; ar: string }; daira: { fr: string; ar: string }; postalCode: string }
const CHEFS_LIEUX = ['02', '05', '06', '07', '09', '13', '15', '16', '17', '19', '21', '23', '25', '26', '27', '30', '31', '35', '42', '47'];
export const PLACES: readonly Place[] = CHEFS_LIEUX.map(code => {
  const wilaya = WILAYAS.find(entry => entry.code === code)!;
  const name = { fr: wilaya.fr, ar: wilaya.ar };
  return code === '16'
    ? { wilaya: code, commune: { fr: 'Alger-Centre', ar: 'الجزائر الوسطى' }, daira: { fr: "Sidi M'Hamed", ar: 'سيدي امحمد' }, postalCode: '16000' }
    : { wilaya: code, commune: name, daira: name, postalCode: `${code}000` };
});

// Mobile prefixes that phone-number validators (libphonenumber's metadata for Algeria) accept:
// 540-542 and 549, 550-562, 650-669, 670-676, 690-699 and 770-799.
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);
const PREFIXES = [...range(540, 542), 549, ...range(550, 562), ...range(650, 669), ...range(670, 676), ...range(690, 699), ...range(770, 799)];

// Mobile numbers: +213, a valid mobile prefix and six digits. They are real formats and may be in
// use, so they are for filling forms, never for sending messages.
export function mobileNumber(random: Random): string {
  const digits = (count: number) => Array.from({ length: count }, () => random(10)).join('');
  return `+213 ${PREFIXES[random(PREFIXES.length)]} ${digits(2)} ${digits(2)} ${digits(2)}`;
}

// Algerian names, in Latin script for French and English and in Arabic script for Arabic.
export const PEOPLE: ReadonlyArray<{ latin: readonly [string, string]; arabic: readonly [string, string]; middle: { latin: string; arabic: string } }> = [
  { latin: ['Amine', 'Bensalah'], arabic: ['أمين', 'بن صالح'], middle: { latin: 'Ali', arabic: 'علي' } },
  { latin: ['Leila', 'Mansouri'], arabic: ['ليلى', 'منصوري'], middle: { latin: 'Nour', arabic: 'نور' } },
  { latin: ['Yacine', 'Ammari'], arabic: ['ياسين', 'عماري'], middle: { latin: 'Karim', arabic: 'كريم' } },
  { latin: ['Sara', 'Belkacem'], arabic: ['سارة', 'بلقاسم'], middle: { latin: 'Amel', arabic: 'أمل' } },
  { latin: ['Adam', 'Haddad'], arabic: ['آدم', 'حداد'], middle: { latin: 'Omar', arabic: 'عمر' } },
  { latin: ['Meriem', 'Boukhari'], arabic: ['مريم', 'بوخاري'], middle: { latin: 'Imane', arabic: 'إيمان' } },
  { latin: ['Youcef', 'Benomar'], arabic: ['يوسف', 'بن عمر'], middle: { latin: 'Salim', arabic: 'سليم' } },
  { latin: ['Hind', 'Rahmani'], arabic: ['هند', 'رحماني'], middle: { latin: 'Houda', arabic: 'هدى' } },
];
