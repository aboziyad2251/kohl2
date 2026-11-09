'use client';
import React,{useState} from 'react';
import {portalRequest} from '@/lib/portal/client';
export default function DeedAttachment({id}:{id:string}){const [url,setUrl]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);return <div>{url?<a className="portal-button" href={url} target="_blank" rel="noopener noreferrer" onClick={()=>setTimeout(()=>setUrl(''),120000)}>فتح الصك المرفق ↗</a>:<button type="button" disabled={busy} className="portal-button" onClick={async()=>{setBusy(true);setError('');try{const data=await portalRequest<{url:string}>(`/api/ownership-documents/${id}/deed`);setUrl(data.url);}catch(e){setError(e instanceof Error?e.message:'تعذر فتح الصك');}finally{setBusy(false);}}}>عرض الصك المرفق</button>}{error&&<p role="alert">{error}</p>}</div>}
