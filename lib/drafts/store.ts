const prefix='kohl.session-drafts.v1:';
const ttl=12*60*60*1000;
let activeUser:string|null=null;
const memory=new Map<string,{value:unknown;at:number}>();
export const draftEvent='kohl:drafts-changed';
export function draftPrefix(user:string,path=''){return prefix+encodeURIComponent(user)+':'+(path?encodeURIComponent(path)+':':'');}
export function draftKey(user:string,path:string,scope:string){return draftPrefix(user,path)+encodeURIComponent(scope);}
function signal(){if(typeof window!=='undefined')window.dispatchEvent(new Event(draftEvent));}
function storageKeys(){try{return Object.keys(sessionStorage).filter(k=>k.startsWith(prefix));}catch{return [];}}
export function readDraft<T>(key:string):T|undefined{
 const cached=memory.get(key);if(cached&&Date.now()-cached.at<ttl)return cached.value as T;
 memory.delete(key);
 try{const raw=sessionStorage.getItem(key);if(!raw)return;const data=JSON.parse(raw);if(!data||typeof data.at!=='number'||Date.now()-data.at>ttl||!Object.prototype.hasOwnProperty.call(data,'value')){sessionStorage.removeItem(key);return;}memory.set(key,data);return data.value as T;}catch{return;}
}
export function writeDraft(key:string,value:unknown){
 if(activeUser!==null&&(!activeUser||!key.startsWith(draftPrefix(activeUser))))return;
 const data={value,at:Date.now()};memory.set(key,data);
 try{const raw=JSON.stringify(data,(k,v)=>/password|access_token|refresh_token|service_role|secret/i.test(k)?undefined:typeof File!=='undefined'&&v instanceof File?undefined:typeof Blob!=='undefined'&&v instanceof Blob?undefined:v);if(raw.length<=1024*1024)sessionStorage.setItem(key,raw);else sessionStorage.removeItem(key);}catch{/* In-memory navigation protection still works if storage is unavailable. */}signal();
}
export function removeDraft(key:string){memory.delete(key);try{sessionStorage.removeItem(key);}catch{}signal();}
export function clearDraftsExcept(user:string){activeUser=user;const keep=user?draftPrefix(user):'';for(const key of Array.from(new Set([...Array.from(memory.keys()),...storageKeys()])))if(!keep||!key.startsWith(keep)){memory.delete(key);try{sessionStorage.removeItem(key);}catch{}}signal();}
export function clearDraftScope(user:string,path:string,scope=''){
 const start=scope?draftKey(user,path,scope):draftPrefix(user,path);
 for(const key of Array.from(new Set([...Array.from(memory.keys()),...storageKeys()])))if(key.startsWith(start)){memory.delete(key);try{sessionStorage.removeItem(key);}catch{}}signal();
}
export function hasPageDraft(user:string,path:string){return Array.from(new Set([...Array.from(memory.keys()),...storageKeys()])).some(key=>key.startsWith(draftPrefix(user,path))&&readDraft(key)!==undefined);}
