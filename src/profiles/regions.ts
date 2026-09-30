import type { Random } from '../rng';
import { mobileNumber, WILAYAS, type Place } from './algeria';
import { COMMUNES } from './algeria-communes';

// Generated addresses use every commune of wilayas 1 to 58, with the wilaya's main postal code (the
// wilaya code followed by 000): postal codes in the eleven new wilayas are still being settled.
// Kept here, not in the engine, because only data generation needs it.
export const GENERATED_PLACES: readonly Place[] = COMMUNES.filter(([code]) => code <= 58).map(([code, fr, ar, dairaFr, dairaAr]) => {
  const wilaya = String(code).padStart(2, '0');
  return { wilaya, commune: { fr, ar }, daira: { fr: dairaFr, ar: dairaAr }, postalCode: `${wilaya}000` };
});



export type Region = 'us' | 'fr' | 'dz';
export const REGIONS: readonly Region[] = ['us', 'fr', 'dz'];
export interface Location { city: string; state: string; postalCode: string; district: string; country: string; nationality: string }

const digits = (random: Random, count: number) => Array.from({ length: count }, () => random(10)).join('');
const pairs = (random: Random, count: number) => Array.from({ length: count }, () => digits(random, 2)).join(' ');

// Phone numbers in each country's format. US numbers use 555-0100 to 555-0199, which is set
// aside for fiction; French and Algerian ones follow the real format and may be in use.
export const PHONES: Readonly<Record<Region, (random: Random) => string>> = {
  us: random => `+1 202 555 01${digits(random, 2)}`,
  fr: random => `+33 6 ${pairs(random, 4)}`,
  dz: mobileNumber,
};

const us: Location[] = [
  { city: 'Washington', state: 'District of Columbia', postalCode: '20001', district: 'Capitol Hill', country: 'United States', nationality: 'American' },
  { city: 'Austin', state: 'Texas', postalCode: '78701', district: 'Downtown', country: 'United States', nationality: 'American' },
  { city: 'Chicago', state: 'Illinois', postalCode: '60601', district: 'The Loop', country: 'United States', nationality: 'American' },
  { city: 'Seattle', state: 'Washington', postalCode: '98101', district: 'Belltown', country: 'United States', nationality: 'American' },
];
const fr: Location[] = [
  { city: 'Paris', state: 'Île-de-France', postalCode: '75001', district: '1er arrondissement', country: 'France', nationality: 'French' },
  { city: 'Lyon', state: 'Auvergne-Rhône-Alpes', postalCode: '69002', district: '2e arrondissement', country: 'France', nationality: 'French' },
  { city: 'Marseille', state: "Provence-Alpes-Côte d'Azur", postalCode: '13001', district: '1er arrondissement', country: 'France', nationality: 'French' },
  { city: 'Toulouse', state: 'Occitanie', postalCode: '31000', district: 'Capitole', country: 'France', nationality: 'French' },
];

// Algerian communes in French, or in Arabic when the data language is Arabic. Built once.
const algerianPlaces = new Map<boolean, Location[]>();
function algeria(arabic: boolean): Location[] {
  let places = algerianPlaces.get(arabic);
  if (!places) {
    places = GENERATED_PLACES.map(place => {
      const wilaya = WILAYAS.find(entry => entry.code === place.wilaya)!;
      const pick = (name: { fr: string; ar: string }) => arabic ? name.ar : name.fr;
      return { city: pick(place.commune), state: pick(wilaya), postalCode: place.postalCode, district: pick(place.daira), country: 'Algeria', nationality: 'Algerian' };
    });
    algerianPlaces.set(arabic, places);
  }
  return places;
}

export function locationsFor(region: Region, arabic: boolean): readonly Location[] {
  return region === 'us' ? us : region === 'fr' ? fr : algeria(arabic);
}
