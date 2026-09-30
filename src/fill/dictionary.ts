import type { FieldKey } from '../data';
import { normalize } from './normalize';

// Aliases per field type, in English, French and Arabic, as data. Matching normalizes both sides,
// so accents, case, separators and camelCase don't matter here.
export const ALIASES: Record<FieldKey, readonly string[]> = {
  username: ['username', 'user name', 'login', 'login name', 'user id', 'pseudo', 'handle', 'identifiant', 'nom utilisateur', "nom d'utilisateur", 'اسم المستخدم', 'اسم الدخول'],
  fullName: ['full name', 'name', 'your name', 'guest name', 'contact name', 'attendee name', 'customer name', 'client name', 'passenger name', 'applicant name', 'candidate name', 'recipient name', 'nom complet', 'nom et prénom', 'prénom et nom', 'nom prénom', 'nom du client', 'الاسم الكامل', 'الاسم واللقب', 'اسم الزبون'],
  firstName: ['first name', 'firstname', 'fname', 'given name', 'forename', 'prénom', 'الاسم الأول', 'الاسم الشخصي', 'الاسم'],
  middleName: ['middle name', 'second prénom', 'الاسم الأوسط'],
  lastName: ['last name', 'lastname', 'lname', 'surname', 'family name', 'nom', 'nom de famille', 'اللقب', 'اسم العائلة'],
  email: ['email', 'e-mail', 'mail', 'email address', 'e-mail address', 'courriel', 'adresse électronique', 'adresse mail', 'adresse e-mail', 'البريد الإلكتروني', 'البريد'],
  phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile', 'mobile number', 'cell', 'cellphone', 'cell phone', 'gsm', 'whatsapp', 'contact number', 'numéro de téléphone', 'portable', 'téléphone portable', 'numéro de portable', 'الهاتف', 'رقم الهاتف', 'هاتف', 'الجوال', 'رقم الجوال', 'الهاتف المحمول'],
  password: ['password', 'confirm password', 'repeat password', 'pwd', 'passwd', 'pass', 'mot de passe', 'confirmation mot de passe', 'mdp', 'كلمة المرور', 'تأكيد كلمة المرور'],
  birthDate: ['date of birth', 'birth date', 'birthday', 'dob', 'date de naissance', 'date naissance', 'تاريخ الميلاد'],
  age: ['age', 'how old', 'العمر'],
  gender: ['gender', 'sex', 'genre', 'sexe', 'الجنس'],
  nationality: ['nationality', 'citizenship', 'nationalité', 'الجنسية'],
  company: ['company', 'company name', 'organization', 'organisation', 'organization name', 'org', 'employer', 'business name', 'entreprise', 'société', "nom de l'entreprise", 'raison sociale', 'الشركة', 'اسم الشركة', 'المؤسسة'],
  jobTitle: ['job title', 'profession', 'position', 'occupation', 'fonction', 'poste', 'titre du poste', 'المهنة', 'المسمى الوظيفي', 'الوظيفة'],
  department: ['department', 'dept', 'division', 'département', 'service', 'القسم'],
  industry: ['industry', 'sector', 'secteur', "secteur d'activité", 'القطاع', 'الصناعة'],
  employeeCount: ['employee count', 'number of employees', 'company size', 'headcount', 'effectif', "taille de l'entreprise", 'nombre de salariés', 'عدد الموظفين'],
  address: ['address', 'street address', 'address line 1', 'street', 'street and number', 'street name', 'addr', 'billing address', 'shipping address', 'delivery address', 'home address', 'adresse', 'adresse postale', 'rue', 'adresse de livraison', 'adresse de facturation', 'العنوان', 'عنوان الشارع', 'الشارع'],
  address2: ['address line 2', 'address 2', 'apartment', 'suite', 'floor', 'building', 'complément adresse', "complément d'adresse", 'appartement', 'bâtiment', 'étage', 'الشقة'],
  city: ['city', 'town', 'locality', 'ville', 'المدينة', 'مدينة'],
  state: ['state', 'province', 'region', 'county', 'wilaya', 'الولاية', 'ولاية', 'المحافظة'],
  postalCode: ['postal code', 'postcode', 'zip', 'zip code', 'cp', 'code postal', 'الرمز البريدي'],
  country: ['country', 'country name', 'pays', 'البلد', 'الدولة'],
  website: ['website', 'web site', 'url', 'homepage', 'home page', 'portfolio', 'linkedin', 'linked in', 'profile url', 'site', 'blog', 'site web', 'site internet', 'الموقع الإلكتروني', 'الموقع'],
  bio: ['bio', 'biography', 'about', 'about me', 'about you', 'about yourself', 'biographie', 'à propos', 'présentation', 'نبذة'],
  description: ['description', 'details', 'product description', 'الوصف', 'التفاصيل'],
  message: ['message', 'comment', 'your message', 'cover letter', 'msg', 'commentaire', 'votre message', 'lettre de motivation', 'motivation', 'الرسالة', 'رسالة', 'تعليق'],
  subject: ['subject', 'topic', 'sujet', 'objet', 'الموضوع', 'موضوع'],
  notes: ['notes', 'note', 'order notes', 'special requests', 'instructions', 'delivery instructions', 'remarks', 'remarques', 'remarque', 'observations', 'ملاحظات'],
  quantity: ['quantity', 'qty', 'number of guests', 'guests', 'passengers', 'attendees', 'number of attendees', 'number of people', 'travellers', 'travelers', 'pax', 'quantité', 'nombre de personnes', "nombre d'exemplaires", 'exemplaires', 'nombre de participants', 'الكمية', 'عدد الأشخاص', 'عدد المسافرين'],
  price: ['price', 'unit price', 'cost', 'prix', 'prix unitaire', 'tarif', 'coût', 'السعر', 'الثمن'],
  amount: ['amount', 'total', 'total amount', 'montant', 'somme', 'المبلغ'],
  salary: ['salary', 'expected salary', 'salary expectations', 'annual salary', 'wage', 'salaire', 'rémunération', 'prétentions salariales', 'prétentions', 'الراتب', 'الأجر'],
  percentage: ['percentage', 'percent', 'discount', 'discount percentage', 'pct', 'pourcentage', 'remise', 'النسبة'],
  rating: ['rating', 'score', 'satisfaction', 'satisfied', 'how satisfied', 'stars', 'évaluation', 'التقييم'],
  date: ['date', 'event date', 'delivery date', 'appointment date', 'release date', 'publication date', 'date de livraison', 'date du rendez-vous', 'التاريخ', 'تاريخ الموعد'],
  startDate: ['start date', 'check in', 'check-in date', 'arrival date', 'arrival', 'departure date', 'from date', 'date from', 'available from', 'availability date', 'date de début', "date d'arrivée", 'arrivée', 'date de départ', 'date de disponibilité', 'disponibilité', 'تاريخ البداية', 'تاريخ البدء', 'تاريخ الوصول'],
  endDate: ['end date', 'check out', 'check-out date', 'return date', 'to date', 'date to', 'date de fin', 'date de retour', 'retour', 'تاريخ النهاية', 'تاريخ الانتهاء', 'تاريخ المغادرة', 'تاريخ العودة'],
  time: ['time', 'arrival time', 'session time', 'time slot', 'preferred time', 'heure', "heure d'arrivée", 'الوقت', 'الساعة'],
  color: ['color', 'colour', 'couleur', 'اللون'],
  search: ['search', 'q', 'query', 'keywords', 'keyword', 'recherche', 'rechercher', 'بحث', 'البحث'],
  title: ['title', 'product title', 'ticket title', 'post title', 'article title', 'titre', 'العنوان المختصر'],
};

// Words that name many things, so they only count on their own or with other evidence:
// "Project name" is not a person's name, and "Delivery date" is only a date with type="date".
export const GENERIC_WORDS: ReadonlySet<string> = new Set(['name', 'nom', 'date', 'time', 'heure', 'title', 'titre', 'service', 'score', 'details', 'login', 'region', 'الاسم', 'total', 'site', 'pass', 'about', 'note', 'arrival', 'arrivee', 'retour', 'position', 'cell', 'handle', 'discount', 'remise', 'motivation', 'org', 'fonction', 'poste', 'division', 'sector', 'secteur', 'cost', 'street', 'rue', 'building', 'floor', 'topic']);

// Single words developers glue to others: userEmail → "useremail", billingCity → "billingcity".
export const COMPOUND_WORDS: ReadonlySet<string> = new Set(['email', 'courriel', 'phone', 'mobile', 'telephone', 'address', 'adresse', 'city', 'ville', 'country', 'company', 'website', 'username', 'password', 'postcode', 'zipcode', 'birthday', 'firstname', 'lastname', 'surname', 'salary', 'quantity', 'price', 'amount', 'gender', 'nationality', 'department', 'message', 'subject', 'description']);
// Words that may sit next to a glued alias without changing it: orderquantity, numerotelephone.
export const GLUE_WORDS: ReadonlySet<string> = new Set(['order', 'numero', 'num', 'number', 'no', 'id', 'value', 'field', 'input', 'txt', 'text', 'full', 'line']);

// Words that qualify a field without changing its type: billingCity, shippingstate, homephone.
export const QUALIFIERS: readonly string[] = ['billing', 'shipping', 'delivery', 'home', 'work', 'business', 'contact', 'user', 'customer', 'primary', 'secondary', 'current', 'new', 'main', 'personal', 'your', 'my'];

// Autocomplete tokens (the last token of the attribute) and the type they declare.
export const AUTOCOMPLETE: Readonly<Record<string, FieldKey>> = { username: 'username', name: 'fullName', 'given-name': 'firstName', 'family-name': 'lastName', email: 'email', tel: 'phone', 'tel-national': 'phone', organization: 'company', 'organization-title': 'jobTitle', 'street-address': 'address', 'address-line1': 'address', 'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'postalCode', country: 'country', 'country-name': 'country', url: 'website', 'additional-name': 'middleName', bday: 'birthDate', sex: 'gender', 'address-line2': 'address2', 'new-password': 'password', 'current-password': 'password' };

// What an input type or inputmode says about the field, and how strongly.
export const INPUT_TYPE_HINTS: Readonly<Record<string, readonly [FieldKey, number]>> = { email: ['email', 0.9], tel: ['phone', 0.85], url: ['website', 0.8], password: ['password', 0.95], color: ['color', 0.9], time: ['time', 0.7], date: ['date', 0.45], search: ['search', 0.9] };
export const INPUT_MODE_HINTS: Readonly<Record<string, readonly [FieldKey, number]>> = { email: ['email', 0.6], tel: ['phone', 0.6], url: ['website', 0.55], search: ['search', 0.6] };

// Types each kind of control can hold. Anything else is pushed down, not ruled out.
export const NUMERIC_TYPES: ReadonlySet<FieldKey> = new Set(['age', 'employeeCount', 'quantity', 'price', 'amount', 'salary', 'percentage', 'rating', 'postalCode', 'phone']);
export const DATE_FIELD_TYPES: ReadonlySet<FieldKey> = new Set(['birthDate', 'date', 'startDate', 'endDate']);
export const MULTILINE_TYPES: ReadonlySet<FieldKey> = new Set(['address', 'bio', 'description', 'message', 'notes', 'subject']);
export const SELECT_TYPES: ReadonlySet<FieldKey> = new Set(['country', 'state', 'city', 'gender', 'nationality', 'industry', 'department', 'jobTitle', 'employeeCount', 'age', 'quantity', 'rating', 'percentage', 'date', 'startDate', 'endDate', 'birthDate', 'time', 'color', 'title', 'subject']);
export const CONFIRMABLE_TYPES: ReadonlySet<FieldKey> = new Set(['email', 'password', 'phone', 'username']);
export const CONFIRM_WORDS = ['confirm', 'confirmation', 'repeat', 're enter', 'retype', 'verify', 'again', 'confirmer', 'تاكيد', 'اعادة'];
export const SEARCH_WORDS = ['search', 'recherche', 'rechercher', 'بحث', 'البحث'];

export type SensitiveKind = 'card' | 'otp' | 'iban';
// Sensitive fields are recognized so they can be skipped, never filled. Phrases match whole words.
export const SENSITIVE_TERMS: Readonly<Record<SensitiveKind, readonly string[]>> = {
  card: ['card', 'credit card', 'debit card', 'card number', 'cardnumber', 'creditcard', 'cc number', 'cc num', 'ccnumber', 'card no', 'name on card', 'cardholder', 'card holder', 'card expiry', 'card expiration', 'expiry', 'expiry date', 'expiration', 'expiration date', 'expiration month', 'expiration year', 'exp month', 'exp year', 'exp date', 'cc exp', 'mm yy', 'mm aa', 'pin', 'pin code', 'card pin', 'security pin', 'date d expiration', 'date d expiration de la carte', 'carte', 'cvv', 'cvv2', 'cvc', 'cvc2', 'ccv', 'csc', 'security code', 'card verification', 'card security code', 'numéro de carte', 'numéro carte', 'carte bancaire', 'carte de crédit', 'titulaire de la carte', 'nom sur la carte', 'cryptogramme', 'cb numero', 'رقم البطاقة', 'البطاقة البنكية', 'بطاقة الائتمان', 'رمز الأمان'],
  otp: ['one time', 'one time code', 'code received', 'code recu', 'one time password', 'otp', 'verification code', 'code de vérification', 'confirmation code', 'code de confirmation', 'sms code', 'code sms', '2fa', 'two factor', 'authentication code', 'auth code', "code d'authentification", 'totp', 'passcode', 'code we sent', 'digit code', 'رمز التحقق', 'رمز التأكيد', 'كود التحقق'],
  iban: ['iban', 'bic', 'swift', 'swift code', 'rib', 'account no', 'acct no', 'acct number', 'account num', 'routing', 'aba', 'bank code', "relevé d'identité bancaire", 'bank account', 'bank account number', 'account number', 'account holder', 'routing number', 'sort code', 'numéro de compte', 'compte bancaire', 'titulaire du compte', 'code banque', 'code guichet', 'numéro ccp', 'compte ccp', 'رقم الحساب', 'الحساب البنكي', 'الحساب المصرفي'],
};
// A fieldset about card or bank details makes every text field inside it sensitive.
// Glued names: ccnum, cardcvc, cardNumber written as one word, sepaiban.
export const SENSITIVE_GLUED: Readonly<Record<SensitiveKind, RegExp>> = {
  card: /^(?:cc|card|credit|carte|cb)(?:num|number|no|cvc|cvv|csc|exp|expiry|holder|name|pin|code)|cvv|cvc|ccexp|ccnum/,
  otp: /^(?:otp|totp|2fa|mfa)(?:code)?$|^(?:sms|verification|verif|auth)code$/,
  iban: /iban|^(?:bic|swift)(?:code)?$|^(?:acct|account)(?:no|num|number)$/,
};
export const SENSITIVE_SECTIONS: Readonly<Record<SensitiveKind, readonly string[]>> = {
  card: ['credit card', 'debit card', 'card details', 'payment card', 'card information', 'carte bancaire', 'informations de carte', 'بطاقة'],
  otp: [],
  iban: ['bank details', 'bank account', 'coordonnées bancaires', 'prélèvement sepa', 'direct debit', 'المعلومات البنكية'],
};
// Consent checkboxes: terms, privacy, newsletters and marketing. Latin stems match a word's start.
// Three kinds: agreeing to terms, permission (j'autorise, I give permission), and asking for
// messages (email me, keep me updated, recevoir les actualités).
const CONSENT_STEMS = ['consent', 'agre', 'subscri', 'newsletter', 'accept', 'marketing', 'offer', 'promot', 'partner', 'sponsor', 'optin', 'receive', 'recevoir', 'confidentialite', 'abonn', 'offre', 'partenaire', 'authoris', 'authoriz', 'autoris', 'permission', 'actualite'];
const CONSENT_WORDS = ['policy', 'policies', 'cookie', 'cookies', 'certify', 'declare', 'acknowledge', 'understand', 'attest', 'over 18', 'of age', 'certifie', 'declare', 'atteste', 'reconnais', 'terms', 'privacy', 'conditions', 'gdpr', 'rgpd', 'cgu', 'cgv', 'opt in', 'share my', 'contact me', 'email me', 'text me', 'notify me', 'alert me', 'keep me informed', 'keep me updated', 'keep me posted', 'hear about', 'hear from', 'send me the', 'updates', 'news', 'deals', 'digest', 'etre informe', 'tenir informe', 'lettre d information'];
export const CONSENT = new RegExp(`(?:^| )(?:(?:${CONSENT_STEMS.join('|')})|(?:${CONSENT_WORDS.join('|')})(?= |$))|وافق|شروط|خصوصية|اشتراك|النشرة|العروض|التسويق|تلقي|اخبار|اشعارات|اسمح|اقر|اشهد|اتعهد`, 'u');
// A checkbox that states something about the user ("I have read…", "I am over 18",
// "Je certifie…", "J'ai lu…") is a declaration, never test data.
export const DECLARATION = /^(?:i|im|i m|je|j)(?= )/u;

export const PASSWORD = /password|mot de passe|كلمة المرور/u;
// Placeholder options such as "Select…" or "Choose a country" are never picked at random.
export const PLACEHOLDER_OPTION = /select|choose|choisir|selectionner|اختر/i;
export const COUNTRY_SPELLINGS: Readonly<Record<string, readonly string[]>> = {
  'United States': ['United States','US','USA','États-Unis','الولايات المتحدة'],
  France: ['France','FR','فرنسا'],
  Algeria: ['Algeria','DZ','Algérie','الجزائر'],
};
// AI suggestions containing ID fragments (UUIDs, long hex runs) are discarded.
export const MACHINE_ID = /\b[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\b|(?:^|[\s._-])(?=[0-9a-f]*[a-f])[0-9a-f]{8,}(?=$|[\s._-])/i;

// Free-text types whose value depends on the page, so AI fills them when it's on.
export const CONTEXTUAL_KEYS: readonly FieldKey[] = ['bio','description','message','subject','notes','title','company','jobTitle','department','industry','search'];
// Text types that may be lengthened with more readable sample sentences to meet a minimum length.
export const EXTENDABLE_KEYS: readonly FieldKey[] = ['company','jobTitle','department','industry','address','bio','description','message','subject','notes','search','title'];
export const NUMERIC_KEYS: readonly FieldKey[] = ['age','employeeCount','quantity','price','amount','salary','percentage','rating'];

// Lookup tables, built once when the engine loads.
export interface AliasEntry { key: FieldKey; name: string; tokens: readonly string[]; generic: boolean }
const group = <T>(entries: readonly T[], keyOf: (entry: T) => string) => {
  const map = new Map<string, T[]>();
  for (const entry of entries) map.set(keyOf(entry), [...(map.get(keyOf(entry)) ?? []), entry]);
  return map;
};
export const ALIAS_ENTRIES: readonly AliasEntry[] = (Object.entries(ALIASES) as [FieldKey, readonly string[]][])
  .flatMap(([key, names]) => names.map(raw => { const name = normalize(raw); return { key, name, tokens: name.split(' '), generic: GENERIC_WORDS.has(name) }; }));
export const EXACT = group(ALIAS_ENTRIES, entry => entry.name);
export const WORDS = group(ALIAS_ENTRIES.filter(entry => entry.tokens.length === 1), entry => entry.name);
// Multi-word aliases by first word, longest first, so "address line 2" wins over "address".
export const PHRASES = group([...ALIAS_ENTRIES.filter(entry => entry.tokens.length > 1)].sort((a, b) => b.tokens.length - a.tokens.length || b.name.length - a.name.length), entry => entry.tokens[0]);
// "phonenumber", "dateofbirth", "codepostal": multi-word aliases written as one word.
export const JOINED = group(ALIAS_ENTRIES.filter(entry => entry.tokens.length > 1 && entry.tokens.join('').length >= 6), entry => entry.tokens.join(''));
export const COMPOUND_PARTS = new Map<string, AliasEntry[]>([
  ...[...WORDS].filter(([word]) => COMPOUND_WORDS.has(word)),
  ...JOINED,
]);
// Candidates for typo matching: specific aliases long enough that one edit is still telling.
export const FUZZY_POOL: readonly AliasEntry[] = ALIAS_ENTRIES.filter(entry => !entry.generic && entry.name.replace(/ /g, '').length >= 4);
export const SENSITIVE_PHRASES: Readonly<Record<SensitiveKind, readonly string[]>> = {
  card: SENSITIVE_TERMS.card.map(normalize), otp: SENSITIVE_TERMS.otp.map(normalize), iban: SENSITIVE_TERMS.iban.map(normalize),
};
export const SENSITIVE_SECTION_PHRASES: Readonly<Record<SensitiveKind, readonly string[]>> = {
  card: SENSITIVE_SECTIONS.card.map(normalize), otp: [], iban: SENSITIVE_SECTIONS.iban.map(normalize),
};
export const CONFIRM_PHRASES = CONFIRM_WORDS.map(normalize);
// Words that make a field repeat the one before it. "Verify" isn't one: a verification code isn't a copy.
export const PAIR_PHRASES = ['confirm', 'confirmation', 'repeat', 're enter', 'retype', 'again', 'confirmer', 'répéter', 'ressaisir', 'تأكيد', 'إعادة'].map(normalize);
// A select of languages shares many words with a list of nationalities ("French", "Français").
export const LANGUAGE_PHRASES = ['language', 'languages', 'langue', 'langues', 'lang', 'اللغة'].map(normalize);
// Session choices are the user's to make: "Remember me", "Trust this device" stay as they are.
export const SESSION = /(?:^| )(?:remember|trust this (?:device|browser|computer)|save my (?:login|password|details)|stay (?:signed|logged)|keep me (?:signed|logged)|se souvenir|memoriser (?:mes identifiants|mon mot de passe|cet appareil)|rester connecte)|تذكر|البقاء متصلا/u;
export const SEARCH_PHRASES = SEARCH_WORDS.map(normalize);
