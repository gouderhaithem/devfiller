# Fields, labels, and types

DevFiller recognizes these 46 field types. The examples are its built-in aliases, not a promise that every website uses a recognizable label. Custom rules extend the catalog and always win. Matching ignores case, accents, Arabic diacritics and how the name is written, so `phone_number`, `phoneNumber`, `PHONE-NUMBER` and `numéro de téléphone` are all the same signal.

| Field | Typical native control | Recognized label examples |
| --- | --- | --- |
| Username | text | username, user name, login, login name, user id, pseudo, handle, identifiant, nom utilisateur, nom d'utilisateur, اسم المستخدم, اسم الدخول |
| Full name | text | full name, name, your name, guest name, contact name, attendee name, customer name, client name, passenger name, applicant name, candidate name, recipient name, nom complet, nom et prénom, prénom et nom, nom prénom, nom du client, الاسم الكامل, الاسم واللقب, اسم الزبون |
| First name | text | first name, firstname, fname, given name, forename, prénom, الاسم الأول, الاسم الشخصي, الاسم |
| Middle name | text | middle name, second prénom, الاسم الأوسط |
| Last name | text | last name, lastname, lname, surname, family name, nom, nom de famille, اللقب, اسم العائلة |
| Email | email / text | email, e-mail, mail, email address, e-mail address, courriel, adresse électronique, adresse mail, adresse e-mail, البريد الإلكتروني, البريد |
| Phone | tel / text | phone, phone number, area code, telephone, tel, mobile, mobile number, cell, cellphone, cell phone, gsm, whatsapp, contact number, numéro de téléphone, portable, téléphone portable, numéro de portable, الهاتف, رقم الهاتف, هاتف, الجوال, رقم الجوال, الهاتف المحمول |
| Password | password (opt-in) | password, confirm password, repeat password, pwd, passwd, pass, mot de passe, confirmation mot de passe, mdp, كلمة المرور, تأكيد كلمة المرور |
| Date of birth | date | date of birth, birth date, birthday, dob, date de naissance, date naissance, تاريخ الميلاد |
| Age | number / range | age, how old, العمر |
| Gender | select / text | gender, sex, genre, sexe, الجنس |
| Nationality | text | nationality, citizenship, nationalité, الجنسية |
| Company | text | company, company name, organization, organisation, organization name, org, employer, business name, entreprise, société, nom de l'entreprise, raison sociale, الشركة, اسم الشركة, المؤسسة |
| Job title | text | job title, profession, position, occupation, fonction, poste, titre du poste, المهنة, المسمى الوظيفي, الوظيفة |
| Department | text | department, dept, division, département, service, القسم |
| Industry | text | industry, sector, secteur, secteur d'activité, القطاع, الصناعة |
| Employee count | number / range | employee count, number of employees, company size, headcount, effectif, taille de l'entreprise, nombre de salariés, عدد الموظفين |
| Street address | text | address, street address, address line 1, street, street and number, street name, addr, billing address, shipping address, delivery address, home address, adresse, adresse postale, rue, adresse de livraison, adresse de facturation, العنوان, عنوان الشارع, الشارع |
| Apartment / suite | text | address line 2, address 2, apartment, suite, floor, building, complément adresse, complément d'adresse, appartement, bâtiment, étage, الشقة |
| City / commune | text | city, town, locality, municipality, ville, commune, municipalité, المدينة, مدينة, البلدية, بلدية |
| District / daira | text | district, daira, daïra, borough, arrondissement, الدائرة, دائرة |
| State / wilaya | select / text | state, province, region, county, wilaya, الولاية, ولاية, المحافظة |
| Postal code | text | postal code, postcode, zip, zip code, cp, code postal, الرمز البريدي |
| Country | select / text | country, country name, pays, البلد, الدولة |
| Website | url / text | website, web site, url, homepage, home page, portfolio, linkedin, linked in, profile url, site, blog, site web, site internet, الموقع الإلكتروني, الموقع |
| Biography | textarea / text | bio, biography, about, about me, about you, about yourself, biographie, à propos, présentation, نبذة |
| Description | textarea / text | description, details, product description, الوصف, التفاصيل |
| Message | textarea / text | message, comment, your message, cover letter, msg, commentaire, votre message, lettre de motivation, motivation, الرسالة, رسالة, تعليق |
| Subject | text | subject, topic, sujet, objet, الموضوع, موضوع |
| Notes | textarea / text | notes, note, order notes, special requests, instructions, delivery instructions, remarks, remarques, remarque, observations, ملاحظات |
| Measurement | text | length, width, height, depth, thickness, diameter, radius, weight, unit weight, net weight, gross weight, mass, area, surface area, volume, dimensions, longueur, largeur, hauteur, profondeur, épaisseur, diamètre, rayon, poids, poids unitaire, poids net, poids brut, masse, superficie, surface habitable, الطول, العرض, الارتفاع, العمق, السمك, القطر, الوزن, المساحة, الحجم |
| Material / grade | text | material, materials, raw material, steel grade, material grade, grade, alloy, matière, matériau, matière première, nuance, nuance d'acier, alliage, المادة, نوع المادة |
| Reference / order number | text | reference, ref, reference number, ref no, order number, order no, order id, order reference, work order, purchase order, po number, invoice number, invoice no, quote number, sku, part number, part no, item code, product code, article code, ticket number, case number, file number, tracking number, batch number, lot number, serial number, delivery note, référence, réf, numéro de commande, n° de commande, no de commande, numéro de facture, n° de facture, numéro de devis, n° de devis, bon de commande, bon de livraison, code article, numéro de dossier, n° de dossier, numéro de lot, numéro de série, n° de série, رقم الطلب, المرجع, رقم المرجع, رقم الفاتورة, رقم الملف |
| Quantity | number / range | quantity, qty, number of, nombre de, pieces, pcs, units, pièces, unités, number of guests, guests, passengers, attendees, number of attendees, number of people, travellers, travelers, pax, quantité, nombre de personnes, nombre d'exemplaires, exemplaires, nombre de participants, الكمية, عدد الأشخاص, عدد المسافرين |
| Price | number / range | price, unit price, cost, prix, prix unitaire, tarif, coût, السعر, الثمن |
| Amount | number / range | amount, total, total amount, montant, somme, المبلغ |
| Salary | number / range | salary, expected salary, salary expectations, annual salary, wage, salaire, rémunération, prétentions salariales, prétentions, الراتب, الأجر |
| Percentage | number / range | percentage, percent, discount, discount percentage, pct, pourcentage, remise, النسبة |
| Rating | number / range | rating, score, satisfaction, satisfied, how satisfied, stars, évaluation, التقييم |
| Date | date | date, event date, delivery date, appointment date, release date, publication date, date de livraison, date du rendez-vous, التاريخ, تاريخ الموعد |
| Start date | date | start date, check in, check-in date, arrival date, arrival, departure date, from date, date from, available from, availability date, date de début, date d'arrivée, arrivée, date de départ, date de disponibilité, disponibilité, تاريخ البداية, تاريخ البدء, تاريخ الوصول |
| End date | date | end date, check out, check-out date, return date, to date, date to, date de fin, date de retour, retour, تاريخ النهاية, تاريخ الانتهاء, تاريخ المغادرة, تاريخ العودة |
| Time | time | time, arrival time, session time, time slot, preferred time, heure, heure d'arrivée, الوقت, الساعة |
| Color | color | color, colour, couleur, اللون |
| Search | search / text | search, q, query, keywords, keyword, recherche, rechercher, بحث, البحث |
| Title | text | title, product title, ticket title, post title, article title, titre, العنوان المختصر |

## How recognition works

DevFiller scores every clue a field gives (its `autocomplete` token, type, label, name, placeholder, nearby text, units and the answers it offers), reads the form as a whole, and fills a field only when the evidence is strong enough. Card, bank, one-time-code and consent fields are recognized so they're never filled. [How recognition works](https://www.devfiller.com/docs/how-it-works/) explains each step and how accurate it is, measured by the [benchmark](https://github.com/gouderhaithem/form-filler/blob/main/benchmark/RESULTS.md).

## Generic control coverage

**Fill unknown fields** is enabled by default to populate controls without a recognized label, even if text validation rejects the sample.

- Text and textarea: simple real words for text inputs and short readable sentences for textareas, with a different choice on consecutive clicks.
- Number and range: bounded, step-aligned sample numbers. Existing range values are preserved unless replacement is enabled.
- Date, datetime-local, month, week, time: varying formatted sample values, adjusted for min/max where applicable.
- Color: a sample hex color; the default native value is preserved unless replacement is enabled.
- Native select: a matching semantic option, or an eligible non-placeholder option in generic mode; replacement chooses a different option when possible. Multi-selects receive one option.
- Radio: a different eligible option per named group when possible; existing selection is kept unless replacement is enabled.
- Checkbox: toggle eligible boxes on each replacement in generic mode. Detected consent, subscription, marketing, permission, privacy and terms choices stay manual.

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
