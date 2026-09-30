import { generateSamples } from './samples';
import { pickWith, randomFor, secureRandom, type Random } from './rng';
import { PEOPLE as ALGERIAN_PEOPLE } from './profiles/algeria';
import { locationsFor, PHONES, REGIONS, type Region } from './profiles/regions';

export { fields, type FieldKey } from './fields';
import type { FieldKey } from './fields';
import { fields } from './fields';
export type Values = Record<FieldKey,string>;
export type Identity = Pick<Values,'firstName'|'middleName'|'lastName'|'fullName'|'username'|'email'>;
export type Locale = 'en' | 'fr' | 'ar';
// Where addresses and phone numbers come from. "mixed" picks one of the regions for each fill.
export type RegionSetting = 'mixed' | Region;
export interface GenerateOptions { seed?: string; region?: RegionSetting }
export interface CustomField { id:string; label:string; value:string; selector?:string; site?:string }
// A field type you set for one field on one site, from the side panel. It wins over recognition.
export interface TypeRule { id:string; selector:string; site:string; type:FieldKey | 'unknown' }
export interface ExclusionRule { id:string; match:'label'|'selector'; value:string; site:string }
export interface Exclusions { skipSearch:boolean; skipHeader:boolean; rules:ExclusionRule[] }
export const defaultExclusions:Exclusions={skipSearch:true,skipHeader:true,rules:[]};
export function validateExclusions(value:unknown):Exclusions {
  const v=value && typeof value==='object'?value as Partial<Exclusions>:{};
  return {
    skipSearch:v.skipSearch!==false,skipHeader:v.skipHeader!==false,
    rules:Array.isArray(v.rules)?v.rules.filter((rule):rule is ExclusionRule=>!!rule && typeof rule.id==='string' && (rule.match==='label'||rule.match==='selector') && typeof rule.value==='string' && !!rule.value.trim() && typeof rule.site==='string'):[],
  };
}
export interface Settings { version:3; locale:Locale; region:RegionSetting; seed:string; typeRules:TypeRule[]; overwrite:boolean; fillUnknown:boolean; passwords:boolean; custom:CustomField[]; exclusions:Exclusions }
export const defaults:Settings = { version:3, locale:'en', region:'mixed', seed:'', typeRules:[], overwrite:true, fillUnknown:true, passwords:false, custom:[], exclusions:defaultExclusions };
const people = {
  en:[['Alex','Morgan'],['Jamie','Parker'],['Jordan','Taylor'],['Casey','Bennett'],['Maya','Chen'],['Noah','Wilson'],['Lena','Brooks'],['Adam','Hayes']],
  fr:[['Camille','Martin'],['Alexandre','Bernard'],['Emma','Laurent'],['Lucas','Robert'],['Chloé','Dubois'],['Hugo','Moreau'],['Léa','Simon'],['Nathan','Lefevre']],
};
const middleNames = {
  en:['Sam','Robin','Noor','Lee','Rose','James','Grace','Daniel'],
  fr:['René','Louis','Marie','Paul','Jeanne','Pierre','Sophie','André'],
};
const toUsername = (first:string,last:string) => `${first}.${last}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z.]/g,'').toLowerCase();
function identity(firstName:string,lastName:string,middleName:string,username:string):Identity {
  return {firstName,lastName,middleName,fullName:`${firstName} ${lastName}`,username,email:`${username}@example.com`};
}
// With the Algeria region, names are Algerian: in Arabic script for Arabic, in Latin script otherwise.
export function generateIdentities(locale:Locale,region?:RegionSetting):Identity[] {
  if(locale==='ar' || region==='dz') return ALGERIAN_PEOPLE.map(person=>{
    const [first,last]=locale==='ar'?person.arabic:person.latin;
    return identity(first,last,locale==='ar'?person.middle.arabic:person.middle.latin,toUsername(...person.latin));
  });
  return people[locale].map(([firstName,lastName],index)=>identity(firstName,lastName,middleNames[locale][index],toUsername(firstName,lastName)));
}
// One number per region, so a fill can follow the country a form asks for.
export function generatePhones(seed?:string):Record<Region,string> {
  const random=randomFor(seed,'phones');
  return Object.fromEntries(REGIONS.map(region=>[region,PHONES[region](random)])) as Record<Region,string>;
}
const previousValues:Partial<Record<string,Values>>={};
// A seed gives the same values on every call. Without one, each call avoids the previous values.
export function generateValues(locale:Locale,options:GenerateOptions={}):Values {
  const seeded=!!options.seed?.trim();
  const random:Random=seeded?randomFor(options.seed,`values|${locale}|${options.region ?? 'mixed'}`):secureRandom;
  const memory=`${locale}|${options.region ?? 'mixed'}`;
  const previous=seeded?undefined:previousValues[memory];
  const identities=generateIdentities(locale,options.region);
  const choices=identities.filter(candidate=>candidate.username!==previous?.username);
  const person=pickWith(random,choices);
  const samples=generateSamples(locale);
  const sample=(key:FieldKey)=>{
    const options=samples[key]!.filter(value=>value!==previous?.[key]);
    return pickWith(random,options);
  };
  // Seeded dates can't depend on the day the test runs: birth dates count back from 1 January 2026
  // and future dates start from 1 January 2030, which stays in the future for years.
  const now = seeded ? new Date(Date.UTC(2026,0,1)) : new Date();
  const future = seeded ? new Date(Date.UTC(2030,0,1)) : new Date();
  // The birth date falls within the year before the age-th birthday, so the age always matches it.
  const age = 18 + random(53);
  const birth = new Date(now); birth.setUTCFullYear(birth.getUTCFullYear()-age); birth.setUTCDate(birth.getUTCDate()-1-random(364));
  const actualAge = now.getUTCFullYear()-birth.getUTCFullYear() - (now.toISOString().slice(5,10)<birth.toISOString().slice(5,10)?1:0);
  // A degree comes 21 to 25 years after birth, and never after this year; experience fits the age.
  const graduation = Math.min(now.getUTCFullYear(), birth.getUTCFullYear()+21+random(5));
  const experience = random(Math.max(1, Math.min(25, actualAge-21))+1);
  const start = new Date(future); start.setUTCDate(start.getUTCDate()+random(365));
  const end = new Date(start); end.setUTCDate(end.getUTCDate()+1+random(30));
  const time = `${String(random(24)).padStart(2,'0')}:${String(random(60)).padStart(2,'0')}`;
  const regions=options.region && options.region!=='mixed' ? [options.region] : REGIONS;
  const region=pickWith(random,regions.length>1 ? regions.filter(candidate=>!previous || locationsFor(candidate,false)[0].country!==previous.country) : regions);
  const places=locationsFor(region,locale==='ar');
  const newPlaces=places.filter(candidate=>candidate.city!==previous?.city);
  const place=pickWith(random,newPlaces.length?newPlaces:places);
  const values:Values = {
    ...person,phone:PHONES[region](random),
    password:sample('password'),birthDate:birth.toISOString().slice(0,10),age:String(actualAge),year:String(graduation),experience:String(experience),gender:sample('gender'),nationality:place.nationality,
    company:sample('company'),jobTitle:sample('jobTitle'),department:sample('department'),industry:sample('industry'),employeeCount:String(1+random(500)),
    address:sample('address'),address2:sample('address2'),city:place.city,district:place.district,state:place.state,postalCode:place.postalCode,country:place.country,website:sample('website'),
    bio:sample('bio'),description:sample('description'),message:sample('message'),subject:sample('subject'),notes:sample('notes'),
    reference:`REF-${String(10000+random(90000))}`,measurement:String(10+random(4990)),material:sample('material'),
    quantity:String(1+random(100)),price:((1+random(99999))/100).toFixed(2),amount:String(1+random(10000)),salary:String(20000+random(180000)),percentage:String(random(101)),rating:String(1+random(5)),date:start.toISOString().slice(0,10),startDate:start.toISOString().slice(0,10),endDate:end.toISOString().slice(0,10),time,color:sample('color'),search:sample('search'),title:sample('title'),
  };
  if(!seeded) previousValues[memory]=values;
  return values;
}
// Arabic values for fields written in Arabic when the extension's language is another one. With
// mixed regions they're Algerian, so names, cities and wilayas are all in Arabic script.
// `latin` holds the same people in Latin script (same usernames), so a form with Arabic and Latin
// name fields can describe one person in both.
export interface LocalizedValues { values:Values; identities:Identity[]; samples:ReturnType<typeof generateSamples>; latin:Identity[] }
export function localizedValues(locale:Locale,options:GenerateOptions={}):Partial<Record<Locale,LocalizedValues>> {
  if(locale==='ar') return {};
  const region:RegionSetting=!options.region || options.region==='mixed' ? 'dz' : options.region;
  return {ar:{values:generateValues('ar',{...options,region}),identities:generateIdentities('ar',region),samples:generateSamples('ar'),latin:generateIdentities(locale,region)}};
}
export function validateSettings(value:unknown):Settings {
  if (!value || typeof value !== 'object') return defaults;
  const v = value as Partial<Settings>;
  const region:RegionSetting = v.region==='us' || v.region==='fr' || v.region==='dz' ? v.region : 'mixed';
  const seed = typeof v.seed==='string' ? v.seed.slice(0,200) : '';
  const types=new Set<string>([...fields.map(([key])=>key),'unknown']);
  const typeRules=Array.isArray(v.typeRules)?v.typeRules.filter((rule):rule is TypeRule=>!!rule && typeof rule.id==='string' && typeof rule.selector==='string' && !!rule.selector && typeof rule.site==='string' && types.has(rule.type)).slice(0,500):[];
  return {version:3,region,seed,typeRules,exclusions:validateExclusions(v.exclusions),locale:v.locale === 'fr' || v.locale === 'ar' ? v.locale : 'en',overwrite:v.version!==3 || v.overwrite !== false,fillUnknown:v.version!==3 || v.fillUnknown !== false,passwords:v.passwords === true,
    custom:Array.isArray(v.custom) ? v.custom.filter((c):c is CustomField => !!c && typeof c.id === 'string' && typeof c.label === 'string' && typeof c.value === 'string') : []};
}
