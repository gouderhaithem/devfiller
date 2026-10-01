import type { FieldKey } from '../data';
import { normalize } from './normalize';

// Aliases per field type, in English, French and Arabic, as data. Matching normalizes both sides,
// so accents, case, separators and camelCase don't matter here.
export const ALIASES: Record<FieldKey, readonly string[]> = {
  username: ['username', 'user name', 'login', 'login name', 'user id', 'pseudo', 'handle', 'identifiant', 'nom utilisateur', "nom d'utilisateur", 'اسم المستخدم', 'اسم الدخول'],
  fullName: ['full name', 'name', 'first and last name', 'first last name', 'first name and last name', 'name and surname', 'account holder', 'account holder name', 'titulaire du compte', 'beneficiary name', 'your name', 'guest name', 'contact name', 'attendee name', 'customer name', 'client name', 'passenger name', 'applicant name', 'candidate name', 'recipient name', 'nom complet', 'nom et prénom', 'prénom et nom', 'nom prénom', 'nom du client', 'الاسم الكامل', 'الاسم واللقب', 'اسم الزبون'],
  firstName: ['first name', 'firstname', 'fname', 'given name', 'forename', 'prénom', 'الاسم الأول', 'الاسم الشخصي', 'الاسم'],
  middleName: ['middle name', 'second prénom', 'الاسم الأوسط'],
  lastName: ['last name', 'lastname', 'lname', 'surname', 'family name', 'nom', 'nom de famille', 'اللقب', 'اسم العائلة'],
  email: ['email', 'e-mail', 'mail', 'email address', 'e-mail address', 'courriel', 'adresse électronique', 'adresse mail', 'adresse e-mail', 'البريد الإلكتروني', 'البريد'],
  phone: ['phone', 'phone number', 'area code', 'telephone', 'tel', 'mobile', 'mobile number', 'cell', 'cellphone', 'cell phone', 'gsm', 'whatsapp', 'contact number', 'numéro de téléphone', 'portable', 'téléphone portable', 'numéro de portable', 'الهاتف', 'رقم الهاتف', 'هاتف', 'الجوال', 'رقم الجوال', 'الهاتف المحمول'],
  password: ['password', 'confirm password', 'repeat password', 'pwd', 'passwd', 'pass', 'mot de passe', 'confirmation mot de passe', 'mdp', 'كلمة المرور', 'تأكيد كلمة المرور'],
  birthDate: ['date of birth', 'birth date', 'birthday', 'dob', 'born on', 'né le', 'née le', 'né(e) le', 'date de naissance', 'date naissance', 'تاريخ الميلاد'],
  age: ['age', 'how old', 'العمر'],
  gender: ['gender', 'sex', 'genre', 'sexe', 'الجنس'],
  nationality: ['nationality', 'citizenship', 'nationalité', 'الجنسية'],
  year: ['year', 'graduation year', 'year of graduation', 'year graduated', 'graduated in', 'class of', 'completion year', 'year of completion', 'year obtained', 'passing year', 'year of passing', 'birth year', 'year of birth', 'model year', 'year of manufacture', 'construction year', 'year built',
    'année', "année d'obtention", "année d'obtention du diplôme", 'année du diplôme', 'année de diplôme', 'année de naissance', 'année de fabrication', 'année de construction', 'السنة', 'سنة التخرج', 'سنة الحصول', 'سنة الميلاد', 'سنة الصنع'],
  experience: ['years of experience', 'year of experience', 'years experience', 'experience years', 'experience in years', 'years of work experience', 'years of professional experience', 'work experience years', 'total experience', 'total years of experience', 'yoe', 'experience',
    "années d'expérience", "nombre d'années d'expérience", "années d'expérience professionnelle", 'expérience années', 'expérience en années', 'expérience', 'سنوات الخبرة', 'عدد سنوات الخبرة', 'سنوات الخبرة المهنية', 'الخبرة'],
  company: ['company', 'company name', 'organization', 'organisation', 'organization name', 'org', 'employer', 'business name', 'entreprise', 'société', "nom de l'entreprise", 'raison sociale', 'الشركة', 'اسم الشركة', 'المؤسسة'],
  jobTitle: ['job title', 'profession', 'position', 'occupation', 'fonction', 'poste', 'titre du poste', 'المهنة', 'المسمى الوظيفي', 'الوظيفة'],
  department: ['department', 'dept', 'division', 'département', 'service', 'القسم'],
  industry: ['industry', 'sector', 'secteur', "secteur d'activité", 'القطاع', 'الصناعة'],
  employeeCount: ['employee count', 'number of employees', 'company size', 'headcount', 'effectif', "taille de l'entreprise", 'nombre de salariés', 'عدد الموظفين'],
  address: ['address', 'street address', 'address line 1', 'street', 'street and number', 'street name', 'addr', 'billing address', 'shipping address', 'delivery address', 'home address', 'adresse', 'adresse postale', 'rue', 'adresse de livraison', 'adresse de facturation', 'العنوان', 'عنوان الشارع', 'الشارع'],
  address2: ['address line 2', 'address 2', 'apartment', 'suite', 'floor', 'building', 'complément adresse', "complément d'adresse", 'appartement', 'bâtiment', 'étage', 'الشقة'],
  city: ['city', 'town', 'place of birth', 'birth place', 'birthplace', 'lieu de naissance', 'lieu naissance', 'ville de naissance', 'commune de naissance', 'مكان الميلاد', 'locality', 'municipality', 'ville', 'commune', 'municipalité', 'المدينة', 'مدينة', 'البلدية', 'بلدية'],
  district: ['district', 'daira', 'daïra', 'borough', 'arrondissement', 'الدائرة', 'دائرة'],
  state: ['state', 'province', 'region', 'county', 'wilaya', 'الولاية', 'ولاية', 'المحافظة'],
  postalCode: ['postal code', 'postcode', 'zip', 'zip code', 'cp', 'code postal', 'الرمز البريدي'],
  country: ['country', 'country name', 'pays', 'البلد', 'الدولة'],
  website: ['website', 'web site', 'url', 'homepage', 'home page', 'portfolio', 'linkedin', 'linked in', 'profile url', 'site', 'blog', 'site web', 'site internet', 'الموقع الإلكتروني', 'الموقع'],
  bio: ['bio', 'biography', 'about', 'about me', 'about you', 'about yourself', 'biographie', 'à propos', 'présentation', 'نبذة'],
  description: ['steps to reproduce', 'expected result', 'actual result', 'symptoms', 'symptômes', 'reason', 'purpose', 'description', 'details', 'product description', 'الوصف', 'التفاصيل'],
  message: ['message', 'comment', 'your message', 'cover letter', 'msg', 'commentaire', 'votre message', 'lettre de motivation', 'motivation', 'الرسالة', 'رسالة', 'تعليق'],
  subject: ['subject', 'topic', 'sujet', 'objet', 'الموضوع', 'موضوع'],
  notes: ['notes', 'note', 'order notes', 'special requests', 'instructions', 'delivery instructions', 'remarks', 'remarques', 'remarque', 'observations', 'ملاحظات'],
  measurement: ['length', 'width', 'height', 'depth', 'thickness', 'diameter', 'radius', 'weight', 'unit weight', 'net weight', 'gross weight', 'mass', 'area', 'surface area', 'volume', 'dimensions',
    'longueur', 'largeur', 'hauteur', 'profondeur', 'épaisseur', 'diamètre', 'rayon', 'poids', 'poids unitaire', 'poids net', 'poids brut', 'masse', 'superficie', 'surface habitable', 'الطول', 'العرض', 'الارتفاع', 'العمق', 'السمك', 'القطر', 'الوزن', 'المساحة', 'الحجم'],
  material: ['material', 'materials', 'raw material', 'steel grade', 'material grade', 'grade', 'alloy', 'matière', 'matériau', 'matière première', 'nuance', "nuance d'acier", 'alliage', 'المادة', 'نوع المادة'],
  reference: ['reference', 'ref', 'reference number', 'ref no', 'order number', 'order no', 'order id', 'order reference', 'work order', 'purchase order', 'po number', 'invoice number', 'invoice no', 'quote number',
    'sku', 'part number', 'part no', 'item code', 'product code', 'article code', 'ticket number', 'case number', 'file number', 'tracking number', 'batch number', 'lot number', 'serial number', 'delivery note',
    'référence', 'réf', 'numéro de commande', 'n° de commande', 'no de commande', 'numéro de facture', 'n° de facture', 'numéro de devis', 'n° de devis', 'bon de commande', 'bon de livraison', 'code article', 'numéro de dossier', 'n° de dossier', 'numéro de lot', 'numéro de série', 'n° de série',
    'رقم الطلب', 'المرجع', 'رقم المرجع', 'رقم الفاتورة', 'رقم الملف'],
  quantity: ['bedrooms', 'bathrooms', 'years', 'number of years', 'number of hours', 'hours per month', 'hours per week', 'number of days', 'quantity', 'qty', 'number of', 'nombre de', 'pieces', 'pcs', 'units', 'pièces', 'unités', 'number of guests', 'guests', 'passengers', 'attendees', 'number of attendees', 'number of people', 'travellers', 'travelers', 'pax', 'adults', 'children', 'kids', 'infants', 'rooms', 'number of rooms', 'tickets', 'number of tickets', 'seats', 'nights', 'number of nights', 'low stock threshold', 'reorder level', 'quantité', 'nombre de personnes', "nombre d'exemplaires", 'exemplaires', 'nombre de participants', 'الكمية', 'عدد الأشخاص', 'عدد المسافرين', 'عدد البالغين', 'عدد الأطفال', 'عدد الغرف', 'عدد التذاكر'],
  price: ['price', 'unit price', 'cost', 'prix', 'prix unitaire', 'tarif', 'coût', 'السعر', 'الثمن'],
  amount: ['subtotal', 'sub total', 'line total', 'declared value', 'advance', 'advance received', 'amount', 'total', 'total amount', 'income', 'monthly income', 'annual income', 'expenses', 'monthly expenses', 'down payment', 'deposit', 'budget', 'balance', 'revenue', 'annual revenue', 'turnover',
    'montant', 'somme', 'revenu', 'revenus', 'dépenses', 'apport', 'acompte', "chiffre d'affaires", 'المبلغ', 'الدخل', 'المصاريف', 'الميزانية'],
  salary: ['salary', 'expected salary', 'salary expectations', 'annual salary', 'wage', 'salaire', 'rémunération', 'prétentions salariales', 'prétentions', 'الراتب', 'الأجر'],
  percentage: ['percentage', 'percent', 'discount', 'discount percentage', 'pct', 'pourcentage', 'remise', 'النسبة'],
  rating: ['rating', 'score', 'satisfaction', 'satisfied', 'how satisfied', 'how likely', 'likely to recommend', 'net promoter score', 'nps', 'stars', 'évaluation', 'التقييم'],
  date: ['date', 'event date', 'deadline', 'due date', 'travel date', 'select date', 'select a date', 'choose date', 'choose a date', 'pick a date', 'graduation date', 'joining date', 'date of joining', 'hire date', 'date of hire', 'choisir une date', 'اختر التاريخ', 'delivery date', 'appointment date', 'release date', 'publication date', 'expiry', 'expiry date', 'expiration', 'expiration date', 'valid until', 'issue date', "date d'expiration", 'date de validité', 'date de délivrance', 'date de livraison', 'date du rendez-vous', 'التاريخ', 'تاريخ الموعد'],
  startDate: ['date of arrival', 'date of departure', 'start date', 'check in', 'check-in date', 'arrival date', 'arrival', 'departure date', 'from date', 'date from', 'available from', 'availability date', 'date de début', "date d'arrivée", 'arrivée', 'date de départ', 'date de disponibilité', 'disponibilité', 'تاريخ البداية', 'تاريخ البدء', 'تاريخ الوصول'],
  endDate: ['end date', 'check out', 'check-out date', 'return date', 'to date', 'date to', 'date de fin', 'date de retour', 'retour', 'تاريخ النهاية', 'تاريخ الانتهاء', 'تاريخ المغادرة', 'تاريخ العودة'],
  time: ['time', 'arrival time', 'session time', 'time slot', 'preferred time', 'heure', "heure d'arrivée", 'الوقت', 'الساعة'],
  color: ['color', 'colour', 'couleur', 'اللون'],
  search: ['search', 'q', 'query', 'keywords', 'keyword', 'recherche', 'rechercher', 'بحث', 'البحث'],
  title: ['summary', 'headline', 'listing title', 'title', 'product title', 'ticket title', 'post title', 'article title', 'titre', 'العنوان المختصر'],
};

// Words that name many things, so they only count on their own or with other evidence:
// "Project name" is not a person's name, and "Delivery date" is only a date with type="date".
export const GENERIC_WORDS: ReadonlySet<string> = new Set(['year', 'annee', 'السنة', 'experience', 'الخبرة', 'grade', 'area', 'ref', 'mass', 'units', 'length', 'volume', 'weight', 'height', 'name', 'nom', 'date', 'time', 'heure', 'title', 'titre', 'service', 'score', 'details', 'login', 'region', 'الاسم', 'total', 'site', 'pass', 'about', 'note', 'arrival', 'arrivee', 'retour', 'position', 'cell', 'handle', 'discount', 'remise', 'motivation', 'org', 'fonction', 'poste', 'division', 'sector', 'secteur', 'cost', 'street', 'rue', 'building', 'floor', 'topic']);

// Single words developers glue to others: userEmail → "useremail", billingCity → "billingcity".
export const COMPOUND_WORDS: ReadonlySet<string> = new Set(['email', 'courriel', 'phone', 'mobile', 'telephone', 'address', 'adresse', 'city', 'ville', 'country', 'company', 'website', 'username', 'password', 'postcode', 'zipcode', 'birthday', 'firstname', 'lastname', 'surname', 'salary', 'quantity', 'price', 'amount', 'gender', 'nationality', 'department', 'message', 'subject', 'description']);
// Words that may sit next to a glued alias without changing it: orderquantity, numerotelephone.
export const GLUE_WORDS: ReadonlySet<string> = new Set(['order', 'numero', 'num', 'number', 'no', 'id', 'value', 'field', 'input', 'txt', 'text', 'full', 'line']);

// Words that qualify a field without changing its type: billingCity, shippingstate, homephone.
export const QUALIFIERS: readonly string[] = ['billing', 'shipping', 'delivery', 'home', 'work', 'business', 'contact', 'user', 'customer', 'primary', 'secondary', 'current', 'new', 'main', 'personal', 'your', 'my'];

// Autocomplete tokens (the last token of the attribute) and the type they declare.
export const AUTOCOMPLETE: Readonly<Record<string, FieldKey>> = { username: 'username', name: 'fullName', 'given-name': 'firstName', 'family-name': 'lastName', email: 'email', tel: 'phone', 'tel-national': 'phone', organization: 'company', 'organization-title': 'jobTitle', 'street-address': 'address', 'address-line1': 'address', 'address-level2': 'city', 'address-level1': 'state', 'postal-code': 'postalCode', country: 'country', 'country-name': 'country', url: 'website', 'additional-name': 'middleName', bday: 'birthDate', sex: 'gender', 'address-line2': 'address2', 'new-password': 'password', 'current-password': 'password' };

// What an input type or inputmode says about the field, and how strongly.
export const INPUT_TYPE_HINTS: Readonly<Record<string, readonly [FieldKey, number]>> = { email: ['email', 0.9], tel: ['phone', 0.85], url: ['website', 0.8], password: ['password', 0.95], color: ['color', 0.9], time: ['time', 0.7], date: ['date', 0.55], search: ['search', 0.9] };
export const INPUT_MODE_HINTS: Readonly<Record<string, readonly [FieldKey, number]>> = { email: ['email', 0.6], tel: ['phone', 0.6], url: ['website', 0.55], search: ['search', 0.6] };

// Types each kind of control can hold. Anything else is pushed down, not ruled out.
export const NUMERIC_TYPES: ReadonlySet<FieldKey> = new Set(['year', 'experience', 'measurement', 'reference', 'age', 'employeeCount', 'quantity', 'price', 'amount', 'salary', 'percentage', 'rating', 'postalCode', 'phone']);
export const DATE_FIELD_TYPES: ReadonlySet<FieldKey> = new Set(['birthDate', 'date', 'startDate', 'endDate']);
export const MULTILINE_TYPES: ReadonlySet<FieldKey> = new Set(['address', 'bio', 'description', 'message', 'notes', 'subject']);
export const SELECT_TYPES: ReadonlySet<FieldKey> = new Set(['material', 'country', 'state', 'city', 'gender', 'nationality', 'industry', 'department', 'jobTitle', 'employeeCount', 'age', 'quantity', 'rating', 'percentage', 'date', 'startDate', 'endDate', 'birthDate', 'time', 'color', 'title', 'subject']);
export const CONFIRMABLE_TYPES: ReadonlySet<FieldKey> = new Set(['email', 'password', 'phone', 'username']);
export const CONFIRM_WORDS = ['confirm', 'confirmation', 'repeat', 're enter', 'retype', 'verify', 'again', 'confirmer', 'تاكيد', 'اعادة'];
export const SEARCH_WORDS = ['search', 'recherche', 'rechercher', 'بحث', 'البحث'];

export type SensitiveKind = 'card' | 'otp' | 'iban';
// Sensitive fields are recognized so they can be skipped, never filled. Phrases match whole words.
export const SENSITIVE_TERMS: Readonly<Record<SensitiveKind, readonly string[]>> = {
  card: ['card', 'credit card', 'debit card', 'card number', 'cardnumber', 'creditcard', 'cc number', 'cc num', 'ccnumber', 'card no', 'name on card', 'cardholder', 'card holder', 'card expiry', 'card expiration', 'cc exp', 'mm yy', 'mm aa', 'card pin', 'date d expiration de la carte', 'cvv', 'cvv2', 'cvc', 'cvc2', 'ccv', 'csc', 'security code', 'card verification', 'card security code', 'numéro de carte', 'numéro carte', 'carte bancaire', 'carte de crédit', 'titulaire de la carte', 'nom sur la carte', 'cryptogramme', 'cb numero', 'رقم البطاقة', 'البطاقة البنكية', 'بطاقة الائتمان', 'رمز الأمان'],
  otp: ['one time', 'one time code', 'code from email', 'email code', 'code sent to', 'code we emailed', 'code received', 'code recu', 'one time password', 'otp', 'verification code', 'code de vérification', 'confirmation code', 'code de confirmation', 'sms code', 'code sms', '2fa', 'two factor', 'authentication code', 'auth code', "code d'authentification", 'totp', 'passcode', 'code we sent', 'digit code', 'رمز التحقق', 'رمز التأكيد', 'كود التحقق'],
  iban: ['iban', 'bic', 'swift', 'swift code', 'rib', 'account no', 'acct no', 'acct number', 'account num', 'routing', 'aba', 'bank code', "relevé d'identité bancaire", 'bank account', 'bank account number', 'account number', 'routing number', 'sort code', 'numéro de compte', 'compte bancaire', 'code banque', 'code guichet', 'numéro ccp', 'compte ccp', 'رقم الحساب', 'الحساب البنكي', 'الحساب المصرفي'],
};
// Words a card field uses that other documents use too: "Passport expiry", "Choose a PIN". They only
// mean card data when the form also has a card field.
export const WEAK_CARD_TERMS: readonly string[] = ['expiry', 'expiry date', 'expiration', 'expiration date', 'expiration month', 'expiration year', 'exp month', 'exp year', 'exp date', 'pin', 'pin code', 'security pin', 'date d expiration', 'carte'];
// Cards that aren't payment cards, named right beside the card word: "Numéro de carte d'identité",
// "Library card number". They only override the plain card words, never "credit card" or "CVV".
export const OTHER_CARDS: readonly string[] = ['id card', 'identity card', 'national id card', 'passport card', 'residence card', 'residency card', 'membership card', 'member card', 'loyalty card', 'library card', 'student card', 'insurance card', 'health card', 'carte d identite', 'carte identite', 'carte nationale', 'carte d identite nationale', 'carte sejour', 'carte fidelite', 'carte bibliotheque', 'carte de sejour', 'carte de resident', 'carte vitale', 'carte grise', 'carte chifa', 'carte de fidelite', 'carte d etudiant', 'carte etudiant', 'carte de bibliotheque', 'carte de membre', 'بطاقة التعريف', 'بطاقة الهوية', 'بطاقة الشفاء'];
// Plain card words another card can own: "ID card number" is not a payment card number.
export const PLAIN_CARD_TERMS: readonly string[] = ['card', 'card number', 'cardnumber', 'card no', 'numéro de carte', 'numéro carte', 'carte'];
// Documents whose dates and codes use card words: "Passport expiry", "Certificate expiration".
export const DOCUMENTS: readonly string[] = ['passport', 'passeport', 'identity', 'identite', 'licence', 'license', 'permis', 'certificate', 'certification', 'certificat', 'permit', 'residence', 'sejour', 'policy', 'insurance', 'assurance', 'membership', 'subscription', 'abonnement', 'warranty', 'garantie', 'contract', 'contrat', 'document', 'جواز السفر', 'الرخصة', 'الشهادة'];
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
const CONSENT_STEMS = ['consent', 'agre', 'subscri', 'newsletter', 'accept', 'marketing', 'offer', 'promot', 'partner', 'optin', 'receive', 'recevoir', 'confidentialite', 'abonn', 'offre', 'partenaire', 'autoris', 'permission', 'actualite'];
// Whole words only: "sponsors" but not "sponsorship", "I authorize" but not "authorized to work",
// "terms and conditions" but not medical conditions.
// Sharing data counts too: usage data, analytics, telemetry, crash reports.
const CONSENT_WORDS = ['usage data', 'share anonymous', 'share data', 'share usage', 'crash reports', 'diagnostics', 'telemetry', 'analytics', 'donnees d utilisation', 'statistiques anonymes', 'opt me in', 'communications', 'comms', 'policy', 'policies', 'cookie', 'cookies', 'sponsor', 'sponsors', 'gift aid', 'data sharing', 'text messages', 'email preferences', 'sign me up', 'email list', 'mailing list', 'reveal my name', 'name may be revealed', 'automatically renew', 'renew automatically', 'auto renew', 'auto renewal', 'save card', 'acepto', 'autorizo', 'consiento', 'accetto', 'acconsento', 'aceito', 'concordo', 'akzeptiere', 'einverstanden', 'datenschutz', 'prihvatam', 'slazem', 'согласие', 'соглашаюсь', 'подписаться', 'save payment', 'save my card', 'save this card', 'save this address', 'save my address', 'to my account', 'for next time', 'future purchases', 'opt out', 'optout', 'unsubscribe', 'allow', 'allows', 'allowing', 'grant access', 'give access', 'access to my account', 'permets', 'permettre', 'authorize', 'authorise', 'authorizes', 'authorises', 'authorizing', 'authorising', 'declaration', 'declarations', 'certify', 'declare', 'acknowledge', 'understand', 'attest', 'over 18', 'of age', 'certifie', 'declare', 'atteste', 'reconnais', 'terms', 'privacy', 'terms and conditions', 'the conditions', 'les conditions', 'general conditions', 'conditions of use', 'conditions of sale', 'conditions generales', 'conditions d utilisation', 'conditions de vente', 'gdpr', 'rgpd', 'cgu', 'cgv', 'opt in', 'share my', 'contact me', 'email me', 'text me', 'notify me', 'alert me', 'notification', 'notifications', 'alerts', 'keep me informed', 'keep me updated', 'keep me posted', 'hear about', 'hear from', 'send me the', 'updates', 'news', 'deals', 'digest', 'etre informe', 'tenir informe', 'lettre d information'];
export const CONSENT = new RegExp(`(?:^| )(?:(?:${CONSENT_STEMS.join('|')})|(?:${CONSENT_WORDS.join('|')})(?= |$))|وافق|شروط|خصوصية|اشتراك|النشرة|العروض|التسويق|تلقي|اخبار|اشعارات|اسمح|اقر|اشهد|اتعهد|اصرح|اصادق|اؤكد`, 'u');
// Words that ask permission only as a checkbox's own label: "Keep my gift anonymous", "Can we
// contact you?", "Emailed twice a month". As a question for radios or a select they often aren't.
const CHECKBOX_CONSENT_WORDS = ['contact you', 'text you', 'call you', 'email you', 'send you', 'sign up for', 'join our', 'anonymous', 'anonymously', 'public list', 'show my name', 'include my name', 'electronic signature', 'information is correct', 'true and correct', 'save date', 'send me a reminder', 'like to learn more', 'like to find out', 'like to hear', 'acknowledgment', 'acknowledgement', 'emailed', 'sent weekly', 'sent daily', 'sent monthly', 'times per year', 'times a year', 'twice a week', 'twice a month', 'every 2 weeks', 'every two weeks'];
export const CHECKBOX_CONSENT = new RegExp(`(?:^| )(?:${CHECKBOX_CONSENT_WORDS.join('|')})(?= |$)`, 'u');
// A checkbox that states something about the user ("I have read…", "I am over 18",
// "Je certifie…", "J'ai lu…") is a declaration, never test data.
export const DECLARATION = /^(?:i|im|i m|je|j)(?= )/u;
// Words that describe rather than ask, in a radio group: "Joyfully accepts", "Returns accepted?",
// "Oui, notification reçue". Removed before the group's question and answers are read for consent.
export const DESCRIBING = /(?:^| )(?:accepts|accepted)(?= |$)/gu;
export const DESCRIBING_ANSWER = /(?:^| )(?:accepts|accepted|notification|notifications|alerts)(?= |$)/gu;
// Answers that make a question a scale, not a permission: "Strongly agree", "Neutral", "Very satisfied".
// A scale never speaks for the person ("I agree to…") or names what consent is about.
export const NOT_SCALE_ANSWER = /^(?:i|im|je|j)(?= )|(?:^| )(?:terms|privacy|policy|consent|cookies?|marketing|newsletter|conditions|essential)(?= |$)/u;
export const SCALE_ANSWER = /(?:^| )(?:strongly|somewhat|disagree|neutral|agree|satisfied|dissatisfied|unsatisfied|likely|unlikely|pas du tout|plutot|tout a fait|d accord|neutre|satisfait|insatisfait|بشدة|محايد|موافق|راض)(?= |$)/u;
// A select that only asks yes or no.
export const YES_NO = /^(?:yes|no|y|n|oui|non|نعم|لا|yes please|no thanks|opt in|opt out)$/u;
// Honeypots: fields a page hides from people to catch bots.
// The whole hint must say so: "Leave blank if same as billing" is a real field.
export const TRAP = /^(?:please )?(?:leave (?:this |it )?(?:field )?(?:empty|blank)|do not (?:fill|fill in|fill this|change)|don t (?:fill|fill in|fill this)(?: in)?|ne pas remplir|laisser vide|laissez vide|laissez ce champ vide|honeypot|اترك (?:هذا )?(?:الحقل )?فارغا)$/u;
// Codes and personal or legal ID numbers have no generator: "Passport number" is neither a count nor a reference.
export const ID_NUMBER_WORDS = ['promo code', 'promotional code', 'coupon', 'coupon code', 'discount code', 'voucher', 'voucher code', 'code promo', 'رمز العرض', 'رمز الخصم', 'كود الخصم', 'employee id', 'employee number', 'staff id', 'passport number', 'passport no', 'numéro de passeport', 'national id', 'national id number', 'identifiant national', 'numéro national', 'id number', 'identity number', 'social security number', 'ssn', 'nin', "numéro d'identification", "numéro de carte d'identité", 'sécurité sociale', 'tax id', 'vat number', 'numéro de tva', 'رقم جواز السفر', 'رقم التعريف الوطني'];
// A slug or permalink is part of a path, not a website.
export const SLUG_WORDS = ['slug', 'url slug', 'permalink', 'url key'];
// People other than the one filling the form: "Manager's name" is a person, and their contact
// details are not the applicant's.
export const PERSON_ROLES = ['manager', 'supervisor', 'host person', 'colleague', 'contact person', 'emergency', 'emergency contact', 'guardian', 'parent', 'father', 'mother', 'spouse', 'referee', 'reference 1', 'reference 2', 'reference 3', 'personal reference', 'landlord', 'tenant', 'co applicant', 'coapplicant', 'co borrower', 'co speaker', 'next of kin', 'beneficiary', 'witness', 'tuteur', 'responsable', 'conjoint', 'pere', 'mere', 'الولي', 'الاب', 'الام'];
// Real words one edit from an alias: "employee" is not a typo of "employer".
export const NOT_TYPOS: ReadonlySet<string> = new Set(['employee', 'employees', 'employed']);
// Civility titles: "Mr", "Mme". A select of them is not the title of a thing.
export const CIVILITY = /^(?:mr|mrs|ms|miss|mx|dr|prof|sir|madam|m|mme|mlle|monsieur|madame|mademoiselle|السيد|السيدة|الانسة)$/u;

export const PASSWORD = /password|mot de passe|كلمة المرور/u;
// Placeholder options such as "Select…" or "Choose a country" are never picked at random.
export const PLACEHOLDER_OPTION = /select|choose|choisir|selectionner|اختر/i;
// Two- and three-letter codes, for fields that only take a code.
export const COUNTRY_CODES: Readonly<Record<string, readonly [string, string]>> = { 'United States': ['US', 'USA'], France: ['FR', 'FRA'], Algeria: ['DZ', 'DZA'] };
// Countries and nationalities stay in English in the values so options match; a text field
// written in Arabic takes the Arabic name.
export const ARABIC_NAMES: Readonly<Record<string, string>> = { Algeria: 'الجزائر', France: 'فرنسا', 'United States': 'الولايات المتحدة', Algerian: 'جزائري', French: 'فرنسي', American: 'أمريكي' };
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
export const NUMERIC_KEYS: readonly FieldKey[] = ['year','experience','measurement','age','employeeCount','quantity','price','amount','salary','percentage','rating'];

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
// Aliases that only count as the whole signal: "q" is a search box, "q_a" is not.
const WHOLE_ONLY: ReadonlySet<string> = new Set(['q']);
export const WORDS = group(ALIAS_ENTRIES.filter(entry => entry.tokens.length === 1 && !WHOLE_ONLY.has(entry.name)), entry => entry.name);
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
export const WEAK_CARD_PHRASES: readonly string[] = WEAK_CARD_TERMS.map(normalize);
export const OTHER_CARD_PHRASES: readonly string[] = OTHER_CARDS.map(normalize);
export const PLAIN_CARD_PHRASES: ReadonlySet<string> = new Set(PLAIN_CARD_TERMS.map(normalize));
export const DOCUMENT_PHRASES: readonly string[] = DOCUMENTS.map(normalize);
export const SLUG_PHRASES: readonly string[] = SLUG_WORDS.map(normalize);
export const ID_NUMBER_PHRASES: readonly string[] = ID_NUMBER_WORDS.map(normalize);
export const PERSON_ROLE_PHRASES: readonly string[] = PERSON_ROLES.map(normalize);
// Things with a name of their own: "Facility name", "Name of the event" and "Agency's name" aren't
// the person's name.
const NAMED_THINGS = ['facility', 'agency', 'event', 'product', 'project', 'team', 'store', 'shop', 'school', 'university', 'college', 'group', 'brand', 'venue', 'property', 'domain', 'file', 'course', 'program', 'programme', 'campaign', 'pet', 'hotel', 'restaurant', 'club', 'league', 'plan', 'device', 'app', 'application', 'list', 'test', 'site', 'website', 'workspace', 'channel', 'server', 'network', 'practice', 'clinic', 'hospital', 'church', 'charity', 'fund', 'vessel', 'vehicle', 'package', 'template', 'report', 'document', 'folder', 'category', 'playlist', 'game', 'book', 'song', 'album', 'show', 'os', 'page', 'wiki page', 'entity', 'software', 'system'];
export const NAMED_THING_PHRASES: readonly string[] = [...new Set([
  ...NAMED_THINGS.flatMap(thing => [`${thing} name`, `${thing} s name`]),
  'nom du projet', "nom de l'evenement", "nom de l'etablissement", 'nom du produit', "nom de l'ecole", 'nom du fichier', "nom de l'equipe", 'nom du magasin', 'nom du site', 'nom du groupe',
  'اسم المشروع', 'اسم المنتج', 'اسم الملف', 'اسم الفريق', 'اسم المتجر', 'اسم الموقع',
].map(normalize))];
// "Name of the event" names a thing only when the thing ends the label: "Name of the project
// manager" is a person.
export const NAMED_THING_ENDINGS: readonly string[] = NAMED_THINGS.flatMap(thing => [`name of ${thing}`, `name of the ${thing}`, `name of your ${thing}`]).map(normalize);
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
