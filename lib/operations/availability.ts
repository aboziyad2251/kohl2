/** Pure availability rules. All timestamps must come from the server on writes. */
export type RentalKind = 'DAILY' | 'MONTHLY' | 'ANNUAL';
export interface Period { start: string; end: string }
export interface Occupancy extends Period {
 unitId: string;
 type: 'HOLD' | 'BOOKING' | 'CONTRACT';
 state: 'ACTIVE' | 'CANCELLED' | 'DRAFT';
 expiresAt?: string;
}
export interface AvailableUnit {
 id: string;
 readiness: 'READY' | 'CLEANING' | 'MAINTENANCE' | 'UNAVAILABLE';
 bedrooms: number | null;
 entrances: number | null;
}
function day(value: string) {
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid date');
 const timestamp=Date.parse(value+'T00:00:00Z');
 if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0,10)!==value) throw new Error('Invalid date');
 return timestamp;
}
export function validatePeriod(period: Period) {
 if(day(period.start)>=day(period.end)) throw new Error('End must follow start');
}
/** Checkout/end is exclusive, matching the current booking conflict convention. */
export function overlaps(left: Period,right: Period) {
 validatePeriod(left);validatePeriod(right);
 return left.start<right.end && right.start<left.end;
}
export function holdHours(kind: RentalKind,start: string,now: Date): number {
 if(!Number.isFinite(now.getTime())) throw new Error('Invalid current time');
 const today=new Date(now.getTime()+3*60*60*1000).toISOString().slice(0,10);
 const distance=(day(start)-day(today))/86400000;
 if(distance<0) throw new Error('Cannot hold a past arrival');
 if(kind==='ANNUAL')return 72;
 if(kind==='MONTHLY')return 24;
 if(kind!=='DAILY')throw new Error('Unsupported rental kind');
 return distance<=1?2:12;
}
export function holdDeadline(kind: RentalKind,start: string,now: Date) {
 return new Date(now.getTime()+holdHours(kind,start,now)*3600000).toISOString();
}
export function activeOccupancy(record: Occupancy,now: Date) {
 if(record.state!=='ACTIVE')return false;
 validatePeriod(record);
 if(record.type!=='HOLD')return true;
 // Corrupt expiry cannot silently release a unit. Require data repair instead.
 const expires=Date.parse(record.expiresAt || '');
 if(!Number.isFinite(expires))throw new Error('Active hold expiry is missing');
 return expires>now.getTime();
}
export function unitAvailability(unit: AvailableUnit,period: Period,records: Occupancy[],now: Date) {
 validatePeriod(period);
 if(!Number.isFinite(now.getTime()))throw new Error('Invalid current time');
 const blockers=records.filter(record=>record.unitId===unit.id&&activeOccupancy(record,now)&&overlaps(period,record));
 return {available:unit.readiness==='READY'&&blockers.length===0,ready:unit.readiness==='READY',
  // Return reasons only, never tenant identity or contract financial information.
  reasons:Array.from(new Set(blockers.map(record=>record.type)))};
}
export interface UnitRequirements { bedrooms?: number; entrances?: number }
export function matchesRequirements(unit: AvailableUnit,requirements: UnitRequirements) {
 return (['bedrooms','entrances'] as const).every(key=>{
  const expected=requirements[key];
  if(expected===undefined)return true;
  if(!Number.isInteger(expected)||expected<1)throw new Error('Invalid unit requirement');
  return unit[key]===expected;
 });
}
/** Explicit suggestions only. The caller displays these editable filters before search. */
export function suggestRequirements(query: string): UnitRequirements {
 const normalized=query.replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
  .replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[أإآ]/g,'ا').replace(/[\u064B-\u065F\u0640]/g,'');
 const rooms=normalized.match(/(?:^|\s)(\d+)\s*(?:غرف(?:ة)?|bedrooms?)(?=$|[\s،,.؛;])/i);
 const entrances=normalized.match(/(?:^|\s)(\d+)\s*(?:مداخل|مدخل|entrances?)(?=$|[\s،,.؛;])/i);
 const result:UnitRequirements={};
 if(rooms&&Number(rooms[1])>0)result.bedrooms=Number(rooms[1]);
 if(entrances&&Number(entrances[1])>0)result.entrances=Number(entrances[1]);
 else if(/مدخلين|مدخلان/.test(normalized))result.entrances=2;
 return result;
}
