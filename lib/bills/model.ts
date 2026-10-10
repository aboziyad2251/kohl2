import { z } from 'zod';
export const billSchema = z.object({
 kind: z.enum(['REC','VOU','INV','HND']), invoiceType: z.enum(['rent','sale']).default('rent'),
 party: z.string().trim().min(1).max(150), unit: z.string().trim().min(1).max(150),
 date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s+'T12:00:00Z'); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === s && Number(s.slice(0,4)) >= 1900 && Number(s.slice(0,4)) <= 2200; }),
 amount: z.string().regex(/^\d{1,9}(\.\d{1,2})?$/), vat: z.boolean(),
 method: z.enum(['نقداً','تحويل بنكي','شيك','مدى','رابط دفع']),
 reference: z.string().max(150), notes: z.string().max(1200),
 nature: z.enum(['إيراد للمكتب','أمانة طرف ثالث']).default('إيراد للمكتب'),
 bank: z.string().max(150).default(''), iban: z.string().max(34).default(''),
 condition: z.string().max(1200).default(''), keys: z.string().max(100).default(''),
 override: z.string().regex(/^(REC|VOU|INV|HND)-\d{4}-\d{5,9}$/).optional(),
}).strict().superRefine((v, ctx) => { if (v.vat && (v.kind !== 'INV' || v.nature === 'أمانة طرف ثالث')) ctx.addIssue({code:'custom',message:'VAT applies only to taxable invoices',path:['vat']}); if (v.override && !v.override.startsWith(v.kind+'-'+v.date.slice(0,4)+'-')) ctx.addIssue({code:'custom',message:'Number prefix/year mismatch',path:['override']}); });
export type BillForm = z.infer<typeof billSchema>;
export const titles = {REC:'سند قبض', VOU:'سند صرف', INV:'فاتورة تأجير / بيع', HND:'محضر استلام / تسليم وحدة'};
export function totals(amount: string, vat: boolean) { const [r,h=''] = amount.split('.'); const net = Number(r)*100+Number(h.padEnd(2,'0')); const tax = vat ? Math.round(net*15/100) : 0; return {net,tax,total:net+tax}; }
export const money = (halalas: number) => (halalas/100).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const enOnes = ['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const enTens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
function en(n:number):string { if(n<20)return enOnes[n]; if(n<100)return enTens[Math.floor(n/10)]+(n%10?' '+en(n%10):''); if(n<1000)return en(Math.floor(n/100))+' hundred'+(n%100?' and '+en(n%100):''); for(const [scale,label] of [[1e9,'billion'],[1e6,'million'],[1000,'thousand']] as const) if(n>=scale)return en(Math.floor(n/scale))+' '+label+(n%scale?' '+en(n%scale):''); return ''; }
const arOnes=['صفر','واحد','اثنان','ثلاثة','أربعة','خمسة','ستة','سبعة','ثمانية','تسعة','عشرة','أحد عشر','اثنا عشر','ثلاثة عشر','أربعة عشر','خمسة عشر','ستة عشر','سبعة عشر','ثمانية عشر','تسعة عشر'];
const arTens=['','','عشرون','ثلاثون','أربعون','خمسون','ستون','سبعون','ثمانون','تسعون'];
const hundreds=['','مائة','مائتان','ثلاثمائة','أربعمائة','خمسمائة','ستمائة','سبعمائة','ثمانمائة','تسعمائة'];
function ar(n:number):string { if(n<20)return arOnes[n]; if(n<100)return (n%10?ar(n%10)+' و':'')+arTens[Math.floor(n/10)]; if(n<1000)return hundreds[Math.floor(n/100)]+(n%100?' و'+ar(n%100):''); for(const [scale,single,dual,plural] of [[1e9,'مليار','ملياران','مليارات'],[1e6,'مليون','مليونان','ملايين'],[1000,'ألف','ألفان','آلاف']] as const) if(n>=scale){const q=Math.floor(n/scale); return (q===1?single:q===2?dual:ar(q)+' '+(q<=10?plural:single))+(n%scale?' و'+ar(n%scale):'');}return ''; }
function currencyAr(n:number,single:string,dual:string,plural:string){return n===1?single:n===2?dual:ar(n)+' '+(n>=3&&n<=10?plural:(single==='ريال سعودي'?'ريالاً سعودياً':'هللة'));}
export function words(halalas:number) { if(!Number.isSafeInteger(halalas)||halalas<0||halalas>114999999999)throw new Error('Invalid amount'); const r=Math.floor(halalas/100),h=halalas%100; return {ar:currencyAr(r,'ريال سعودي','ريالان سعوديان','ريالات سعودية')+(h?' و'+currencyAr(h,'هللة','هللتان','هللات'):'')+' فقط لا غير',en:en(r)+' Saudi riyal'+(r===1?'':'s')+(h?' and '+en(h)+' halala'+(h===1?'':'s'):'')+' only'}; }
export function hijri(date:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||isNaN(Date.parse(date)))return '—';return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(date+'T12:00:00Z'));}
// Five-field TLV payload placeholder; this does not implement ZATCA Phase 2 signing/clearance.
export function tlv(values:string[]) { const bytes:number[]=[]; values.forEach((v,i)=>{const b=new TextEncoder().encode(v);if(b.length>255)throw new Error('TLV value too long');bytes.push(i+1,b.length,...Array.from(b));});return btoa(String.fromCharCode(...bytes)); }



