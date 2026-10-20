import type { FieldKey } from '../data';
import { normalize } from './normalize';
import { EXAMPLE_PREFIX } from './placeholder';
import { optionLists } from './vocabulary';

// What a placeholder's sample answer is, when the sample is all a field shows: "John", "Acme Inc.",
// "12 rue de la Paix", "e.g. Paris", "jean.dupont". Formats (emails, phones, dates) are read by
// placeholderShape; this reads words.

// Names sites use as samples, in English, French and Arabic.
const FIRST_NAMES = ['John', 'Jane', 'Jean', 'Marie', 'Pierre', 'Paul', 'Sophie', 'Camille', 'Lucas', 'Emma', 'Léa', 'Hugo', 'Louis', 'Julien', 'Nicolas', 'Thomas', 'Sarah', 'Alice', 'Bob', 'Alex', 'Michael', 'David', 'James', 'Robert', 'Mary', 'Emily', 'Anna', 'Peter', 'Max', 'Mohamed', 'Mohammed', 'Ahmed', 'Ali', 'Amine', 'Karim', 'Yacine', 'Sofiane', 'Fatima', 'Amina', 'Yasmine', 'Nadia', 'Omar', 'Youssef', 'Mehdi', 'Sami', 'محمد', 'أحمد', 'علي', 'فاطمة', 'أمينة', 'ياسين', 'كريم', 'مريم', 'عمر', 'يوسف'];
const LAST_NAMES = ['Doe', 'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Wilson', 'Taylor', 'Dupont', 'Durand', 'Dubois', 'Martin', 'Bernard', 'Moreau', 'Lefebvre', 'Leroy', 'Petit', 'Benali', 'Bouzid', 'Belkacem', 'Benamar', 'Mansouri', 'Haddad', 'Saidi', 'بن علي', 'بوزيد', 'منصوري', 'حداد'];
// Cities a sample names, besides the communes and wilayas the lists already hold.
const CITIES = ['Paris', 'Lyon', 'Marseille', 'Toulouse', 'Bordeaux', 'Lille', 'Nantes', 'Nice', 'Strasbourg', 'London', 'Manchester', 'New York', 'Los Angeles', 'San Francisco', 'Chicago', 'Boston', 'Seattle', 'Toronto', 'Montreal', 'Montréal', 'Berlin', 'Madrid', 'Barcelona', 'Rome', 'Brussels', 'Bruxelles', 'Geneva', 'Genève', 'Dubai', 'Cairo', 'Le Caire', 'Casablanca', 'Rabat', 'Tunis', 'Algiers', 'Alger', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Sétif', 'Tlemcen', 'Béjaïa', 'Tizi Ouzou', 'الجزائر', 'وهران', 'قسنطينة', 'عنابة', 'باريس', 'القاهرة', 'دبي'];
// A company's legal form ends its name: "Acme Inc.", "Sonatrach SPA", "Dupont SARL".
const LEGAL_FORMS = new Set(['inc', 'llc', 'ltd', 'corp', 'co', 'plc', 'gmbh', 'ag', 'bv', 'sarl', 'sas', 'sasu', 'spa', 'eurl', 'snc', 'sa', 'ش ذ م م']);
// "Co", "Sa", "Ag" are words too: as short forms they're written in capitals ("Dupont SA").
const SHORT_FORMS = new Set(['co', 'sa', 'ag', 'bv']);
// "Select manager", "Choose a plan SA": an instruction naming something to pick, not a sample.
const VERBS = new Set(['select', 'choose', 'pick', 'assign', 'ask', 'contact', 'find', 'search', 'add', 'enter', 'choisir', 'choisissez', 'selectionner', 'selectionnez', 'contacter', 'chercher', 'rechercher', 'اختر', 'ابحث']);
// A house number then a street word, or a street word that starts the address.
const STREET_WORDS = new Set(['rue', 'avenue', 'av', 'ave', 'bd', 'boulevard', 'chemin', 'impasse', 'allee', 'place', 'route', 'cite', 'street', 'st', 'road', 'rd', 'lane', 'ln', 'drive', 'dr', 'way', 'blvd', 'شارع', 'حي', 'طريق', 'نهج']);
const LEADING_STREET = new Set(['rue', 'avenue', 'boulevard', 'chemin', 'impasse', 'cite', 'شارع', 'حي', 'نهج']);
// A job a sample names: "Développeur web", "Project manager", "مهندس برمجيات".
const JOB_WORDS = new Set(['developer', 'developpeur', 'developpeuse', 'engineer', 'ingenieur', 'manager', 'designer', 'accountant', 'comptable', 'teacher', 'enseignant', 'professeur', 'consultant', 'consultante', 'analyst', 'analyste', 'technician', 'technicien', 'director', 'directeur', 'directrice', 'assistant', 'assistante', 'nurse', 'infirmier', 'infirmiere', 'doctor', 'medecin', 'lawyer', 'avocat', 'architect', 'architecte', 'ceo', 'cto', 'cfo', 'founder', 'fondateur', 'مهندس', 'مطور', 'محاسب', 'مدير', 'استاذ', 'طبيب', 'معلم', 'ممرض']);
// "@johndoe", or "jean.dupont" made of a known name: "file.pdf", "v1.2" and "first_name" aren't handles.
const AT_HANDLE = /^@[\p{L}\d._]{3,30}$/u;
const NAME_HANDLE = /^([a-z]+)[._]([a-z]+)\d*$/i;

const index = (words: readonly string[]) => new Set(words.map(normalize));
let lists: { first: Set<string>; last: Set<string>; city: Set<string>; country: ReadonlySet<string> } | undefined;
// Built on first use, like the option lists they borrow from.
function samples() {
  if (lists) return lists;
  const option = new Map(optionLists());
  lists = {
    first: index(FIRST_NAMES), last: index(LAST_NAMES),
    city: new Set([...index(CITIES), ...option.get('city') ?? [], ...option.get('state') ?? []]), country: option.get('country') ?? new Set(),
  };
  return lists;
}

// The sample a placeholder shows, without its "e.g." and quotes, or undefined for an instruction or a question.
function sampleOf(placeholder: string): string | undefined {
  const text = placeholder.trim().replace(EXAMPLE_PREFIX, '').replace(/^["“'«]\s*|\s*["”'»]$/g, '').replace(/\s*[.…]+$/, '').trim();
  return text.length >= 2 && text.length <= 40 && !/[?!:]/.test(text) ? text : undefined;
}

function nameType(tokens: readonly string[]): FieldKey | undefined {
  const { first, last } = samples();
  if (tokens.length === 2 && first.has(tokens[0]) && last.has(tokens[1])) return 'fullName';
  if (tokens.length !== 1) return undefined;
  if (last.has(tokens[0])) return 'lastName';
  return first.has(tokens[0]) ? 'firstName' : undefined;
}

// The type a sample answer belongs to, read from the words of the placeholder alone.
export function sampleType(placeholder: string): FieldKey | undefined {
  const sample = sampleOf(placeholder);
  if (!sample) return undefined;
  const { first, last, city, country } = samples();
  if (AT_HANDLE.test(sample)) return 'username';
  const handle = sample.match(NAME_HANDLE);
  if (handle) return [handle[1], handle[2]].some(part => first.has(normalize(part)) || last.has(normalize(part))) ? 'username' : undefined;
  const text = normalize(sample);
  const tokens = text.split(' ');
  if (country.has(text)) return 'country';
  if (city.has(text)) return 'city';
  if (VERBS.has(tokens[0])) return undefined;
  const form = sample.split(/\s+/).pop()!.replace(/\.$/, '');
  const shortForm = SHORT_FORMS.has(tokens[tokens.length - 1]);
  if (tokens.length >= 2 && (LEGAL_FORMS.has(tokens[tokens.length - 1]) || LEGAL_FORMS.has(tokens.slice(-3).join(' '))) && (!shortForm || form === form.toUpperCase())) return 'company';
  if (tokens.length >= 2 && ((/^\d+[a-z]?$/.test(tokens[0]) && tokens.slice(1).some(token => STREET_WORDS.has(token))) || LEADING_STREET.has(tokens[0]))) return 'address';
  if (tokens.length <= 3 && tokens.some(token => JOB_WORDS.has(token))) return 'jobTitle';
  return nameType(tokens);
}
