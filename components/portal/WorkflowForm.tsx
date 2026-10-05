'use client';
import { useState } from 'react';
export interface Field { name: string; label: string; type?: 'text' | 'number' | 'date' | 'datetime-local' | 'checkbox' | 'textarea'; value?: string | number | boolean; optional?: boolean; options?: { value: string; label: string }[]; }
export default function WorkflowForm({ title, operation, fixed = {}, fields, save, en }: { title: string; operation: string; fixed?: Record<string, unknown>; fields: Field[]; save: (body: unknown) => Promise<boolean>; en: boolean }) {
    const [busy, setBusy] = useState(false);
    return <form className="portal-card grid sm:grid-cols-2 gap-4" onSubmit={async e => {
        e.preventDefault(); const values = new FormData(e.currentTarget); const body: Record<string, unknown> = { ...fixed, operation };
        for (const field of fields) {
            const raw = values.get(field.name);
            if (field.type === 'checkbox') body[field.name] = !!raw;
            else if (raw !== null && String(raw) !== '') body[field.name] = field.type === 'number' ? Number(raw) : field.type === 'datetime-local' ? new Date(String(raw)).toISOString() : String(raw);
            else if (field.name === 'unit_details') body[field.name] = '';
        }
        if (operation === 'COMMISSION_SAVE') body.basis = body.type === 'FIXED' ? null : body.basis || 'DEAL_VALUE';
        setBusy(true); try { await save(body); } finally { setBusy(false); }
    }}><h3 className="font-bold text-lg sm:col-span-2">{title}</h3>{fields.map(field => <label key={field.name} className={field.type === 'textarea' ? 'sm:col-span-2' : ''}>{field.label}{field.options ? <select className="portal-input" name={field.name} defaultValue={String(field.value ?? '')} required={!field.optional}><option value="">{en ? 'Select' : 'اختر'}</option>{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : field.type === 'textarea' ? <textarea className="portal-input" name={field.name} required={!field.optional} defaultValue={String(field.value ?? '')} maxLength={2000} /> : <input className="portal-input" name={field.name} type={field.type || 'text'} defaultValue={field.type === 'checkbox' ? undefined : String(field.value ?? '')} defaultChecked={field.type === 'checkbox' ? Boolean(field.value) : undefined} required={field.type === 'checkbox' ? false : !field.optional} step={field.type === 'number' ? '0.01' : undefined} maxLength={2000} />}</label>)}<button disabled={busy} className="portal-button sm:col-span-2">{busy ? en ? 'Saving…' : 'جارٍ الحفظ…' : en ? 'Save' : 'حفظ'}</button></form>;
}
