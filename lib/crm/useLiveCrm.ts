'use client';
import {useEffect,useState} from 'react';
export function useLiveCrm(refresh:()=>Promise<boolean>){
 const [error,setError]=useState(false);
 useEffect(()=>{
  let active=true;
  const update=async()=>{
   if(document.visibilityState==='hidden'||!navigator.onLine)return;
   try{if(await refresh())if(active)setError(false);}catch{if(active)setError(true);}
  };
  const visible=()=>{if(document.visibilityState!=='hidden')void update();};
  void update();const interval=window.setInterval(()=>void update(),5000);
  window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
  return()=>{active=false;window.clearInterval(interval);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
 },[refresh]);
 return error;
}
