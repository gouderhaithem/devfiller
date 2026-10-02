# Fields, labels, and types

DevFiller recognizes these 46 field types. The examples are its built-in aliases, not a promise that every website uses a recognizable label. Custom rules extend the catalog and always win. Matching ignores case, accents, Arabic diacritics and how the name is written, so `phone_number`, `phoneNumber`, `PHONE-NUMBER` and `numéro de téléphone` are all the same signal.

| Field | Typical native control | Recognized label examples |
| --- | --- | --- |
| Username | text | username, user name, login, login name, user id, pseudo, handle, identifiant, nom utilisateur, nom d'utilisateur, اسم المستخدم, اسم الدخول |
| Full name | text | full name, name, first and last name, first last name, first name and last name, name and surname, account holder, account holder name, titulaire du compte, beneficiary name, your name, guest name, contact name, attendee name, customer name, client name, passenger name, applicant name, candidate name, recipient name, nom complet, nom et prénom, prénom et nom, nom prénom, nom du client, الاسم الكامل, الاسم واللقب, اسم الزبون, الاسم |
| First name | text | first name, firstname, fname, given name, forename, prénom, الاسم الأول, الاسم الشخصي |
| Middle name | text | middle name, second prénom, الاسم الأوسط |
| Last name | text | last name, lastname, lname, surname, family name, nom, nom de famille, اللقب, اسم العائلة |
| Email | email / text | email, e-mail, mail, email address, e-mail address, courriel, adresse électronique, adresse mail, adresse e-mail, البريد الإلكتروني, البريد |
| Phone | tel / text | phone, phone number, area code, telephone, tel, mobile, mobile number, cell, cellphone, cell phone, gsm, whatsapp, contact number, numéro de téléphone, portable, téléphone portable, numéro de portable, الهاتف, رقم الهاتف, هاتف, الجوال, رقم الجوال, الهاتف المحمول |
| Password | password (opt-in) | password, confirm password, repeat password, pwd, passwd, pass, mot de passe, confirmation mot de passe, mdp, كلمة المرور, تأكيد كلمة المرور |
| Date of birth | date | date of birth, birth date, birthday, dob, born on, né le, née le, né(e) le, date de naissance, date naissance, تاريخ الميلاد |
| Age | number / range | age, how old, العمر |
| Gender | select / text | gender, sex, genre, sexe, الجنس |
| Nationality | text | nationality, citizenship, nationalité, الجنسية |
| Year | text / number | year, graduation year, year of graduation, year graduated, graduated in, class of, completion year, year of completion, year obtained, passing year, year of passing, birth year, year of birth, model year, year of manufacture, construction year, year built, année, année d'obtention, année d'obtention du diplôme, année du diplôme, année de diplôme, année de naissance, année de fabrication, année de construction, السنة, سنة التخرج, سنة الحصول, سنة الميلاد, سنة الصنع |
| Years of experience | text / number | years of experience, year of experience, years experience, experience years, experience in years, years of work experience, years of professional experience, work experience years, total experience, total years of experience, yoe, experience, années d'expérience, nombre d'années d'expérience, années d'expérience professionnelle, expérience années, expérience en années, expérience, سنوات الخبرة, عدد سنوات الخبرة, سنوات الخبرة المهنية, الخبرة, الخبرة, خبرتك, خبرة |
| Company | text | company, company name, organization, organisation, organization name, org, employer, business name, entreprise, société, nom de l'entreprise, raison sociale, الشركة, اسم الشركة, المؤسسة |
| Job title | text | job title, profession, position, occupation, fonction, poste, titre du poste, المهنة, المسمى الوظيفي, الوظيفة |
| Department | text | department, dept, division, département, service, القسم |
| Industry | text | industry, sector, secteur, secteur d'activité, القطاع, الصناعة |
| Employee count | number / range | employee count, number of employees, company size, headcount, effectif, taille de l'entreprise, nombre de salariés, عدد الموظفين |
| Street address | text | address, street address, address line 1, street, street and number, street name, addr, billing address, shipping address, delivery address, home address, adresse, adresse postale, rue, adresse de livraison, adresse de facturation, العنوان, عنوان الشارع, الشارع |
| Apartment / suite | text | address line 2, address 2, apartment, suite, floor, building, complément adresse, complément d'adresse, appartement, bâtiment, étage, الشقة |
| City / commune | text | city, town, place of birth, birth place, birthplace, lieu de naissance, lieu naissance, ville de naissance, commune de naissance, مكان الميلاد, locality, municipality, ville, commune, municipalité, المدينة, مدينة, البلدية, بلدية, gare de départ, gare d'arrivée, ville de départ, ville d'arrivée |
| District / daira | text | district, daira, daïra, borough, arrondissement, الدائرة, دائرة |
| State / wilaya | select / text | state, province, region, county, wilaya, الولاية, ولاية, المحافظة |
| Postal code | text | postal code, postcode, zip, zip code, cp, code postal, الرمز البريدي |
| Country | select / text | country, country name, pays, البلد, الدولة |
| Website | url / text | website, web site, url, homepage, home page, portfolio, linkedin, linked in, profile url, site, blog, site web, site internet, الموقع الإلكتروني, الموقع |
| Biography | textarea / text | bio, biography, about, about me, about you, about yourself, biographie, à propos, présentation, نبذة |
| Description | textarea / text | steps to reproduce, expected result, actual result, symptoms, symptômes, reason, purpose, description, details, product description, الوصف, التفاصيل |
| Message | textarea / text | message, comment, your message, cover letter, msg, feedback, your query, your enquiry, your inquiry, your question, how can we help, how we can help, tell us how we can help, commentaire, votre message, lettre de motivation, motivation, الرسالة, رسالة, تعليق |
| Subject | text | subject, topic, sujet, objet, inquiry type, enquiry type, type of inquiry, type of enquiry, request type, type of request, issue type, type of issue, reason for contact, reason for contacting, reason for contacting us, contact reason, purpose of contact, nature of your inquiry, nature of your enquiry, nature of your query, type of question, type of feedback, feedback type, i am writing about, inquiry topic, enquiry topic, help topic, objet de votre demande, type de demande, motif de contact, nature de la demande, الموضوع, موضوع, نوع الطلب |
| Notes | textarea / text | notes, note, order notes, special requests, instructions, delivery instructions, remarks, remarques, remarque, observations, ملاحظات |
| Measurement | text | length, width, height, depth, thickness, diameter, radius, weight, unit weight, net weight, gross weight, mass, area, surface area, volume, dimensions, longueur, largeur, hauteur, profondeur, épaisseur, diamètre, rayon, poids, poids unitaire, poids net, poids brut, masse, superficie, surface habitable, الطول, العرض, الارتفاع, العمق, السمك, القطر, الوزن, المساحة, الحجم |
| Material / grade | text | material, materials, raw material, steel grade, material grade, grade, alloy, matière, matériau, matière première, nuance, nuance d'acier, alliage, المادة, نوع المادة |
| Reference / order number | text | reference, ref, reference number, ref no, order number, order no, order id, order reference, work order, purchase order, po number, invoice number, invoice no, quote number, sku, part number, part no, item code, product code, article code, ticket number, case number, file number, tracking number, batch number, lot number, serial number, delivery note, référence, réf, numéro de commande, n° de commande, no de commande, numéro de facture, n° de facture, numéro de devis, n° de devis, bon de commande, bon de livraison, code article, numéro de dossier, n° de dossier, numéro de lot, numéro de série, n° de série, رقم الطلب, المرجع, رقم المرجع, رقم الفاتورة, رقم الملف |
| Quantity | number / range | bedrooms, bathrooms, years, number of years, number of hours, hours per month, hours per week, number of days, quantity, qty, number of, nombre de, pieces, pcs, units, pièces, unités, number of guests, guests, passengers, attendees, number of attendees, number of people, travellers, travelers, pax, adults, children, kids, infants, rooms, number of rooms, tickets, number of tickets, seats, nights, number of nights, low stock threshold, reorder level, quantité, nombre de personnes, nombre d'exemplaires, exemplaires, nombre de participants, الكمية, عدد الأشخاص, عدد المسافرين, عدد البالغين, عدد الأطفال, عدد الغرف, عدد التذاكر |
| Price | number / range | price, unit price, cost, prix, prix unitaire, tarif, coût, السعر, الثمن |
| Amount | number / range | subtotal, sub total, line total, declared value, advance, advance received, amount, amt, total, total amount, income, monthly income, annual income, expenses, monthly expenses, down payment, deposit, budget, balance, revenue, annual revenue, turnover, montant, somme, revenu, revenus, dépenses, apport, acompte, chiffre d'affaires, المبلغ, الدخل, المصاريف, الميزانية |
| Salary | number / range | salary, expected salary, salary expectations, annual salary, wage, salaire, rémunération, prétentions salariales, prétentions, الراتب, الأجر, راتبك, الراتب المتوقع, راتبك المتوقع |
| Percentage | number / range | percentage, percent, discount, discount percentage, pct, pourcentage, remise, النسبة |
| Rating | number / range | rating, score, satisfaction, satisfied, how satisfied, how likely, likely to recommend, net promoter score, nps, stars, évaluation, التقييم |
| Date | date | date, event date, deadline, due date, travel date, select date, select a date, choose date, choose a date, pick a date, graduation date, joining date, date of joining, hire date, date of hire, choisir une date, اختر التاريخ, delivery date, appointment date, release date, publication date, expiry, expiry date, expiration, expiration date, valid until, issue date, date d'expiration, date de validité, date de délivrance, date de livraison, date du rendez-vous, التاريخ, تاريخ الموعد |
| Start date | date | date of arrival, date of departure, start date, check in, check-in date, arrival date, arrival, departure date, from date, date from, available from, availability date, date de début, date d'arrivée, arrivée, date de départ, date de disponibilité, disponibilité, تاريخ البداية, تاريخ البدء, تاريخ الوصول |
| End date | date | end date, check out, check-out date, return date, to date, date to, date de fin, date de retour, retour, تاريخ النهاية, تاريخ الانتهاء, تاريخ المغادرة, تاريخ العودة |
| Time | time | time, arrival time, session time, time slot, preferred time, heure, heure d'arrivée, الوقت, الساعة |
| Color | color | color, colour, couleur, اللون |
| Search | search / text | search, q, query, keywords, keyword, recherche, rechercher, بحث, البحث, mots clés, mots-clés, mot clé, mot-clé |
| Title | text | summary, headline, listing title, title, product title, ticket title, post title, article title, titre, العنوان المختصر |

## How recognition works

DevFiller scores every clue a field gives (its `autocomplete` token, type, label, name, placeholder, nearby text, units and the answers it offers), reads the form as a whole, and fills a field only when the evidence is strong enough. Card fields are recognized and filled with sandbox test cards (never real ones); bank, one-time-code and consent fields are recognized so they're never filled.

## Test cards

Choose the result to test under **Fill settings → Test cards**. Every card works with any future expiry (DevFiller writes December, three years ahead) and any CVC (it writes 123).

| Scenario | Test card |
| --- | --- |
| Successful payment (default) | 4242 4242 4242 4242 |
| Declined card | 4000 0000 0000 0002 |
| Insufficient funds | 4000 0000 0000 9995 |
| Expired card | 4000 0000 0000 0069 |
| Incorrect CVC | 4000 0000 0000 0127 |

The number is written the way the field takes it: spaced, digits only, or one group of four per box. **Leave card fields empty** turns this off. A coupon or gift-card box, a card PIN and any field that doesn't say which part of the card it is stay empty. Payment forms inside a provider's iframe (Stripe Elements, for example) can't be reached, because DevFiller fills the page's own frame only. [How recognition works](https://www.devfiller.com/docs/how-it-works/) explains each step and how accurate it is, measured by the [benchmark](https://github.com/gouderhaithem/devfiller/blob/main/benchmark/RESULTS.md).

## Generic control coverage

**Fill unknown fields** is enabled by default to populate controls without a recognized label, even if text validation rejects the sample.

- Text and textarea: simple real words for text inputs and short readable sentences for textareas, with a different choice on consecutive clicks.
- Number and range: bounded, step-aligned sample numbers. Existing range values are preserved unless replacement is enabled.
- Date, datetime-local, month, week, time: varying formatted sample values, adjusted for min/max where applicable.
- Color: a sample hex color; the default native value is preserved unless replacement is enabled.
- Native select: a matching semantic option, or an eligible non-placeholder option in generic mode; replacement chooses a different option when possible. Multi-selects receive one option.
- Radio: a different eligible option per named group when possible; existing selection is kept unless replacement is enabled.
- Checkbox: toggle eligible boxes on each replacement in generic mode. Detected consent, subscription, marketing, permission, privacy and terms choices are ticked as test values; exclude one to keep it manual.

## Additional ideas for later versions

| Area | Suggested additions |
| --- | --- |
| Regional data | Algerian postal codes per commune (from an Algérie Poste source), French departments, more countries |
| Identity | Name prefixes/suffixes, aliases, pronouns, localized nationality choices |
| Business | SKU, product name, order reference, invoice reference, tax fixtures, currency, discount, inventory count |
| Travel | Departure/arrival, destination, booking reference, passenger count, duration |
| Education | School, university, degree, study field, graduation year, student reference |
| Recruiting | Experience years, availability date, skills, portfolio, employment type |
| Technical | UUID, slug, hostname, IP fixtures, semantic version, JSON payload, regular-expression-based strings |
| Testing | Seeded repeatable data, invalid/boundary-value scenarios, per-site presets, import/export |
| Advanced widgets | React/ARIA comboboxes, searchable selects, date-picker widgets, rich text, frames, shadow roots |
| Files and payments | Explicit fixture-file selection and sandbox-only payment fixtures |

These suggestions are not implemented. Custom rules insert the exact configured value without added prefixes or suffixes. Generated defaults use readable words and phrases; they never append random IDs.
