export default function PortalChart({ rows, label }: { rows: { label: string; value: number }[]; label: string }) {
 const max = Math.max(1,...rows.map(r => Math.abs(r.value)));
 return <figure className="portal-card"><figcaption className="font-bold mb-4">{label}</figcaption><div className="flex items-end gap-3 h-48" dir="ltr">{rows.map(row => <div className="flex-1 text-center min-w-0" key={row.label}><div className="text-xs mb-2">{row.value.toLocaleString(undefined,{maximumFractionDigits:2})}</div><div className={`rounded-t ${row.value<0?'bg-red-700':'bg-[#2F6D3A]'}`} style={{height:`${Math.max(3,Math.abs(row.value)/max*120)}px`}}/><div className="text-xs mt-2">{row.label}</div></div>)}</div></figure>;
}
