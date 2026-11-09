'use client';
import {useCallback,useEffect,useRef,useState,Dispatch,SetStateAction} from 'react';
import {usePathname} from 'next/navigation';
import {useForm,FieldValues,UseFormProps,UseFormReturn} from 'react-hook-form';
import {useAuth} from '@/context/AuthContext';
import {clearDraftsExcept,clearDraftScope,draftKey,readDraft,writeDraft,removeDraft} from './store';
export function useDraftSession(user:string,loading:boolean,authenticated:boolean){useEffect(()=>{if(!loading)clearDraftsExcept(authenticated?user:'');},[user,loading,authenticated]);}
export function useDraftControls(scope:string){const {currentUser}=useAuth(),path=usePathname();return useCallback(()=>clearDraftScope(currentUser.id,path,scope),[currentUser.id,path,scope]);}
export function useDraftState<T>(scope:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const {currentUser}=useAuth(),path=usePathname(),key=draftKey(currentUser.id,path,scope);
 const [value,setValue]=useState<T>(initial),latest=useRef(value),base=useRef(value);const active=useRef(key);
 useEffect(()=>{if(active.current!==key){base.current=typeof initial==='function'?(initial as ()=>T)():initial;}active.current=key;const saved=readDraft<T>(key);const next=saved===undefined?base.current:saved;latest.current=next;setValue(next);},[key]);
 const update=useCallback<Dispatch<SetStateAction<T>>>((action)=>{const next=typeof action==='function'?(action as (old:T)=>T)(latest.current):action;latest.current=next;setValue(next);if(currentUser.id){if(Object.is(next,base.current))removeDraft(key);else writeDraft(key,next);}},[key,currentUser.id]);
 return [value,update];
}
export function useDraftForm<T extends FieldValues>(scope:string,options:UseFormProps<T>,enabled=true):UseFormReturn<T>&{clearDraft:()=>void}{
 const {currentUser}=useAuth(),path=usePathname(),key=draftKey(currentUser.id,path,scope),form=useForm<T>(options);
 const suppress=useRef(false),baseline=useRef<any>(options.defaultValues||{}),originalReset=useRef(form.reset);originalReset.current=form.reset;
 const clear=useCallback(()=>removeDraft(key),[key]);
 const reset=useCallback<UseFormReturn<T>['reset']>((values,keep)=>{suppress.current=true;if(values&&typeof values!=='function'){baseline.current=values;const saved=enabled?readDraft<T>(key):undefined;originalReset.current(saved?{...values,...saved}:values,keep);}else{removeDraft(key);originalReset.current(values===undefined?baseline.current:values,keep);}suppress.current=false;},[key,enabled]);
 useEffect(()=>{if(!enabled||!currentUser.id)return;suppress.current=true;const saved=readDraft<T>(key);if(saved)originalReset.current({...baseline.current,...saved});suppress.current=false;
  const subscription=form.watch((values,info)=>{if(!suppress.current&&info.name)writeDraft(key,values);});return ()=>subscription.unsubscribe();
 },[key,enabled,currentUser.id,form.watch]);
 return {...form,reset,clearDraft:clear};
}

