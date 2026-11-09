import { z } from 'zod';

export const mapPurposes = ['MANAGEMENT','RENT','SALE'] as const;
export type MapPurpose = typeof mapPurposes[number];
export const purposeLabels:Record<MapPurpose,string> = { MANAGEMENT:'تحت الإدارة',RENT:'للإيجار',SALE:'للبيع' };
export const mapSourceSchema = z.enum(['PROPERTY','MANAGED']);
export type MapSource = z.infer<typeof mapSourceSchema>;
const purposesSchema = z.array(z.enum(mapPurposes)).max(3).refine(values=>new Set(values).size===values.length,'Duplicate purposes');
const fields = {
  latitude:z.number().finite().min(-90).max(90).nullable(),
  longitude:z.number().finite().min(-180).max(180).nullable(),
  map_purposes:purposesSchema,
  map_visible:z.boolean(),
};
const paired = (value:{latitude:number|null;longitude:number|null}) => (value.latitude===null)===(value.longitude===null);
export const mapUpdateSchema = z.object(fields).strict().refine(paired,'Coordinates must be paired');
export const managedMapUpdateSchema = z.object({...fields,city:z.string().trim().max(100),address:z.string().trim().max(1000)}).strict().refine(paired,'Coordinates must be paired');
export interface MapEntry {
  id:string; source:MapSource; title:string; city:string; address:string;
  property_type:string; units_count:number; status:string|null;
  latitude:number|null; longitude:number|null; map_purposes:MapPurpose[]; map_visible:boolean;
}
export const entryKey = (entry:Pick<MapEntry,'source'|'id'>) => `${entry.source}:${entry.id}`;
export function hasCoordinates(entry:Pick<MapEntry,'latitude'|'longitude'>):boolean {
  return typeof entry.latitude==='number' && Number.isFinite(entry.latitude) && entry.latitude>=-90 && entry.latitude<=90 && typeof entry.longitude==='number' && Number.isFinite(entry.longitude) && entry.longitude>=-180 && entry.longitude<=180;
}
const normalize=(value:string)=>value.toLocaleLowerCase('ar').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').trim();
export function filterMapEntries(entries:MapEntry[],filters:{search:string;purpose:'ALL'|'UNCLASSIFIED'|MapPurpose;source:'ALL'|MapSource;location:'ALL'|'LOCATED'|'MISSING';includeHidden:boolean}) {
  const query=normalize(filters.search);
  return entries.filter(entry=>
    (filters.includeHidden || entry.map_visible) &&
    (filters.source==='ALL' || entry.source===filters.source) &&
    (filters.purpose==='ALL' || (filters.purpose==='UNCLASSIFIED' ? entry.map_purposes.length===0 : entry.map_purposes.includes(filters.purpose))) &&
    (filters.location==='ALL' || (filters.location==='LOCATED' ? hasCoordinates(entry) : !hasCoordinates(entry))) &&
    (!query || normalize(`${entry.title} ${entry.city} ${entry.address}`).includes(query))
  );
}
