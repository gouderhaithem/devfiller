import type { FieldKey } from '../data';
import { normalize } from './normalize';
import { WILAYAS } from '../profiles/algeria';

// What a list of options says about its field. A select or radio group whose answers are mostly
// country names is a country, whatever its label says.

const COUNTRIES = [
  'Algeria', 'Algérie', 'الجزائر', 'Morocco', 'Maroc', 'المغرب', 'Tunisia', 'Tunisie', 'تونس', 'Libya', 'Libye', 'ليبيا', 'Egypt', 'Égypte', 'مصر',
  'Mauritania', 'Mauritanie', 'موريتانيا', 'Sudan', 'Soudan', 'السودان', 'France', 'فرنسا', 'Belgium', 'Belgique', 'Switzerland', 'Suisse', 'Luxembourg',
  'Germany', 'Allemagne', 'ألمانيا', 'Spain', 'Espagne', 'إسبانيا', 'Italy', 'Italie', 'إيطاليا', 'Portugal', 'Netherlands', 'Pays-Bas', 'Austria', 'Autriche',
  'United Kingdom', 'Royaume-Uni', 'المملكة المتحدة', 'Ireland', 'Irlande', 'Sweden', 'Suède', 'Norway', 'Norvège', 'Denmark', 'Danemark', 'Finland', 'Finlande',
  'Poland', 'Pologne', 'Greece', 'Grèce', 'Turkey', 'Türkiye', 'Turquie', 'تركيا', 'Russia', 'Russie', 'Ukraine', 'Romania', 'Roumanie',
  'United States', 'USA', 'États-Unis', 'الولايات المتحدة', 'Canada', 'كندا', 'Mexico', 'Mexique', 'Brazil', 'Brésil', 'Argentina', 'Argentine', 'Chile', 'Chili', 'Colombia', 'Colombie',
  'Saudi Arabia', 'Arabie saoudite', 'السعودية', 'United Arab Emirates', 'Émirats arabes unis', 'الإمارات', 'Qatar', 'قطر', 'Kuwait', 'Koweït', 'الكويت', 'Oman', 'عمان', 'Bahrain', 'Bahreïn', 'البحرين',
  'Jordan', 'Jordanie', 'الأردن', 'Lebanon', 'Liban', 'لبنان', 'Syria', 'Syrie', 'سوريا', 'Iraq', 'Irak', 'العراق', 'Palestine', 'فلسطين', 'Iran', 'Pakistan', 'India', 'Inde', 'الهند',
  'China', 'Chine', 'الصين', 'Japan', 'Japon', 'اليابان', 'South Korea', 'Corée du Sud', 'Indonesia', 'Indonésie', 'Australia', 'Australie', 'New Zealand', 'Nouvelle-Zélande',
  'Senegal', 'Sénégal', 'Mali', 'Niger', 'Nigeria', 'Côte d’Ivoire', "Côte d'Ivoire", 'Ivory Coast', 'Cameroon', 'Cameroun', 'South Africa', 'Afrique du Sud', 'Kenya', 'Ethiopia', 'Éthiopie',
];
const NATIONALITIES = [
  'Algerian', 'Algérien', 'Algérienne', 'جزائري', 'جزائرية', 'Moroccan', 'Marocain', 'Marocaine', 'مغربي', 'مغربية', 'Tunisian', 'Tunisien', 'Tunisienne', 'تونسي', 'تونسية',
  'Egyptian', 'Égyptien', 'Égyptienne', 'مصري', 'مصرية', 'Libyan', 'Libyen', 'Libyenne', 'French', 'Français', 'Française', 'فرنسي', 'فرنسية', 'Belgian', 'Belge',
  'German', 'Allemand', 'Allemande', 'ألماني', 'Spanish', 'Espagnol', 'Espagnole', 'Italian', 'Italien', 'Italienne', 'Portuguese', 'Portugais', 'Portugaise', 'Dutch', 'Néerlandais', 'Néerlandaise',
  'British', 'Britannique', 'Irish', 'Irlandais', 'Swiss', 'American', 'Américain', 'Américaine', 'أمريكي', 'Canadian', 'Canadien', 'Canadienne', 'Mexican', 'Mexicain', 'Brazilian', 'Brésilien',
  'Turkish', 'Turc', 'Turque', 'Saudi', 'Saoudien', 'Saoudienne', 'سعودي', 'Lebanese', 'Libanais', 'Libanaise', 'Syrian', 'Syrien', 'Syrienne', 'Jordanian', 'Jordanien',
  'Indian', 'Indien', 'Indienne', 'Chinese', 'Chinois', 'Chinoise', 'Japanese', 'Japonais', 'Japonaise', 'Senegalese', 'Sénégalais', 'Sénégalaise', 'Malian', 'Malien', 'Malienne',
  'Ivorian', 'Ivoirien', 'Ivoirienne', 'Cameroonian', 'Camerounais', 'Camerounaise', 'Nigerian', 'Nigérian', 'Russian', 'Russe', 'Polish', 'Polonais', 'Greek', 'Grec', 'Grecque',
];
// The wilayas (from the Algeria profile), then US states and French and Canadian regions.
const WILAYA_NAMES = [...WILAYAS.flatMap(wilaya => [wilaya.fr, wilaya.ar]), 'Alger-Centre', 'الجزائر العاصمة'];
const REGION_NAMES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana',
  'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee',
  'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming',
  'Île-de-France', 'Auvergne-Rhône-Alpes', 'Hauts-de-France', "Provence-Alpes-Côte d'Azur", 'Occitanie', 'Nouvelle-Aquitaine', 'Grand Est', 'Bretagne', 'Normandie', 'Pays de la Loire',
  'Centre-Val de Loire', 'Bourgogne-Franche-Comté', 'Corse', 'Ontario', 'Quebec', 'Québec', 'British Columbia', 'Alberta', 'Manitoba', 'Saskatchewan', 'Nova Scotia', 'New Brunswick',
];
// Regions end here.
const GENDERS = ['Male', 'Female', 'Man', 'Woman', 'Other', 'Non-binary', 'Prefer not to say', 'Homme', 'Femme', 'Masculin', 'Féminin', 'Autre', 'Non binaire', 'Je préfère ne pas répondre', 'ذكر', 'أنثى', 'آخر', 'M', 'F', 'H'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul', 'Aug', 'Sep', 'Sept', 'Oct', 'Nov', 'Dec',
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  'janv', 'févr', 'avr', 'juil', 'déc',
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
  'جانفي', 'فيفري', 'أفريل', 'ماي', 'جوان', 'جويلية', 'أوت',
];

// Every name of each month, in calendar order: English, French and Arabic, full and abbreviated.
export const MONTH_NAMES: readonly ReadonlySet<string>[] = [
  ['January', 'Jan', 'janvier', 'janv', 'يناير', 'جانفي'], ['February', 'Feb', 'février', 'févr', 'fev', 'فبراير', 'فيفري'],
  ['March', 'Mar', 'mars', 'مارس'], ['April', 'Apr', 'avril', 'avr', 'أبريل', 'أفريل'], ['May', 'mai', 'مايو', 'ماي'],
  ['June', 'Jun', 'juin', 'يونيو', 'جوان'], ['July', 'Jul', 'juillet', 'juil', 'يوليو', 'جويلية'], ['August', 'Aug', 'août', 'aout', 'أغسطس', 'أوت'],
  ['September', 'Sep', 'Sept', 'septembre', 'سبتمبر'], ['October', 'Oct', 'octobre', 'أكتوبر'], ['November', 'Nov', 'novembre', 'نوفمبر'],
  ['December', 'Dec', 'décembre', 'déc', 'ديسمبر'],
].map(names => new Set(names.map(name => normalize(name).replace(/ /g, ''))));

// Spellings of the generated gender values, so a radio group or select can pick the matching answer.
export const GENDER_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  Female: ['Female', 'Woman', 'Femme', 'Féminin', 'F', 'أنثى', 'Madame'],
  Male: ['Male', 'Man', 'Homme', 'Masculin', 'M', 'H', 'ذكر', 'Monsieur'],
  'Prefer not to say': ['Prefer not to say', 'Other', 'Autre', 'Je préfère ne pas répondre', 'Non-binary', 'آخر'],
};
// Spellings of the generated states. A wilaya can appear by its French or Arabic name, or its code
// ("16", "16 - Alger"); the code comes last because it must match exactly.
export const STATE_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  ...Object.fromEntries(WILAYAS.flatMap(wilaya => {
    const english = wilaya.code === '16' ? ['Algiers', 'الجزائر العاصمة'] : [];
    const spellings = [wilaya.fr, wilaya.ar, ...english, `${wilaya.code} - ${wilaya.fr}`, ...new Set([wilaya.code, String(Number(wilaya.code))])];
    return [[wilaya.fr, spellings], [wilaya.ar, [wilaya.ar, ...spellings]]];
  })),
  Algiers: ['Algiers', 'Alger', 'الجزائر', 'الجزائر العاصمة', '16'],
  'Île-de-France': ['Île-de-France', 'Ile de France', 'IDF'],
  'District of Columbia': ['District of Columbia', 'DC', 'Washington DC'],
  Texas: ['Texas', 'TX'], Illinois: ['Illinois', 'IL'], Washington: ['Washington', 'WA'],
};

const index = (words: readonly string[]) => new Set(words.map(normalize));
export const OPTION_LISTS: ReadonlyArray<readonly [FieldKey, ReadonlySet<string>]> = [
  ['country', index(COUNTRIES)], ['nationality', index(NATIONALITIES)], ['state', index([...WILAYA_NAMES, ...REGION_NAMES])], ['gender', index(GENDERS)],
];
// Recognizes a month list by any of these names, full or abbreviated ("janv.", "Sept").
export const MONTH_SET: ReadonlySet<string> = new Set([...index(MONTHS), ...MONTH_NAMES.flatMap(names => [...names])]);
