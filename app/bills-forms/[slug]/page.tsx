import { notFound } from 'next/navigation';
import Link from 'next/link';
import BillEditor from '@/components/forms/BillEditor';
import StandardEditor from '@/components/forms/StandardEditor';
import { getTemplate } from '@/lib/forms/templates';
import { titles, BillForm } from '@/lib/bills/model';
export default function DocumentPage({params}:{params:{slug:string}}){
 const template=getTemplate(params.slug),kind=params.slug.toUpperCase();
 if(!template&&!(kind in titles))notFound();
 return <><Link href="/bills-forms" className="bills-controls inline-block mb-5 text-emerald-300">← جميع الفواتير والسندات والنماذج</Link>{template?<StandardEditor key={template.code} template={template}/>:<BillEditor key={kind} initialKind={kind as BillForm['kind']}/>}</>;
}
