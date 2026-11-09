'use client';

import React,{useEffect,useRef,useState} from 'react';
import type * as Leaflet from 'leaflet';
import { MapEntry,entryKey,hasCoordinates,purposeLabels } from '@/lib/property-map';
import { mapLinks } from '@/lib/property-location';

let runtime:Promise<typeof Leaflet>|null=null;
function loadMapLibrary(){
  if(!runtime)runtime=(async()=>{
    // markercluster is a legacy plugin and extends the browser's mutable L object.
    const imported=await import('leaflet');const L={...imported};
    (window as unknown as {L:typeof Leaflet}).L=L;
    await import('leaflet.markercluster');return L;
  })();
  return runtime;
}

export default function KohlPropertyMap({entries,selected,onOpen,fitRequest,selectionRequest}:{entries:MapEntry[];selected:string|null;onOpen:(entry:MapEntry)=>void;fitRequest:number;selectionRequest:number}) {
  const container=useRef<HTMLDivElement>(null),map=useRef<Leaflet.Map|null>(null),cluster=useRef<Leaflet.MarkerClusterGroup|null>(null);
  const library=useRef<typeof Leaflet|null>(null),markers=useRef(new Map<string,Leaflet.Marker>()),open=useRef(onOpen);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[tileError,setTileError]=useState(false);
  open.current=onOpen;
  useEffect(()=>{
    let cancelled=false;let resize:ResizeObserver|undefined;
    (async()=>{
      const L=await loadMapLibrary();
      if(cancelled||!container.current)return;
      library.current=L;
      const instance=L.map(container.current,{scrollWheelZoom:false,zoomControl:true}).setView([24.0,45.0],5);map.current=instance;
      instance.getContainer().setAttribute('aria-label','خريطة مواقع عقارات كحل العقارية');
      const tiles=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'}).addTo(instance);
      tiles.on('tileerror',()=>{if(!cancelled)setTileError(true);});
      cluster.current=L.markerClusterGroup({showCoverageOnHover:false,maxClusterRadius:45,spiderfyOnMaxZoom:true,iconCreateFunction:group=>L.divIcon({html:`<span>${group.getChildCount()}</span>`,className:'kohl-map-cluster',iconSize:[42,42]})});
      cluster.current.addTo(instance);
      resize=new ResizeObserver(()=>instance.invalidateSize());resize.observe(container.current);
      setReady(true);
    })().catch(()=>{if(!cancelled)setError('تعذر تشغيل الخريطة. يمكنك استخدام قائمة العقارات وروابط Google Maps أدناه.');});
    return()=>{cancelled=true;resize?.disconnect();map.current?.remove();map.current=null;cluster.current=null;markers.current.clear();};
  },[]);
  useEffect(()=>{
    const L=library.current,group=cluster.current,instance=map.current;
    if(!ready||!L||!group||!instance)return;
    instance.closePopup();group.clearLayers();markers.current.clear();
    entries.filter(hasCoordinates).forEach(entry=>{
      const purpose=entry.map_purposes[0]||'OTHER';
      const marker=L.marker([entry.latitude!,entry.longitude!],{title:entry.title,alt:entry.title,keyboard:true,icon:L.divIcon({html:'<span>⌂</span>',className:`kohl-property-pin pin-${purpose.toLowerCase()}`,iconSize:[34,42],iconAnchor:[17,40],popupAnchor:[0,-35]})});
      const content=document.createElement('div');content.className='kohl-map-popup';content.dir='rtl';
      const heading=document.createElement('strong');heading.textContent=entry.title;content.append(heading);
      const address=document.createElement('p');address.textContent=[entry.city,entry.address].filter(Boolean).join(' · ');content.append(address);
      const purposes=document.createElement('p');purposes.textContent=entry.map_purposes.map(p=>purposeLabels[p]).join(' · ')||'غير مصنف';content.append(purposes);
      const button=document.createElement('button');button.type='button';button.textContent='فتح ملف العقار';button.addEventListener('click',()=>open.current(entry));content.append(button);
      const link=document.createElement('a');link.href=mapLinks({latitude:entry.latitude!,longitude:entry.longitude!}).directions;link.textContent='اتجاهات Google Maps ↗';link.target='_blank';link.rel='noopener noreferrer';content.append(link);
      marker.bindPopup(content,{maxWidth:290,minWidth:200});group.addLayer(marker);markers.current.set(entryKey(entry),marker);
    });
    const bounds=group.getBounds();if(bounds.isValid())instance.fitBounds(bounds,{padding:[40,40],maxZoom:15});
  },[entries,ready]);
  useEffect(()=>{
    if(!selected||!ready)return;
    const marker=markers.current.get(selected),instance=map.current,L=library.current;
    if(marker&&instance&&L){
      instance.stop();instance.setView(marker.getLatLng(),17,{animate:false});
      // A list selection must also work for coincident pins and after refreshing
      // clusters. Open at the exact point without waiting for cluster animation.
      const content=marker.getPopup()?.getContent();
      if(content)L.popup({maxWidth:290,minWidth:200}).setLatLng(marker.getLatLng()).setContent(content).openOn(instance);
      if(window.matchMedia('(max-width:950px)').matches)container.current?.scrollIntoView({behavior:'smooth',block:'center'});
    }
  },[selected,ready,entries,selectionRequest]);
  useEffect(()=>{
    if(!fitRequest)return;
    const bounds=cluster.current?.getBounds();if(bounds?.isValid())map.current?.fitBounds(bounds,{padding:[40,40],maxZoom:15});
  },[fitRequest]);
  return <div className="kohl-map-wrap">
    <div ref={container} className="kohl-map-canvas" role="region" aria-label="خريطة كحل العقارية" />
    {!ready&&!error&&<p className="map-loading" role="status">جارٍ تشغيل الخريطة…</p>}
    {error&&<p className="map-warning" role="alert">{error}</p>}
    {tileError&&<p className="map-warning" role="status">تعذر تحميل بعض أجزاء الخريطة. مواقع العقارات والقائمة وروابط الاتجاهات ما زالت متاحة.</p>}
  </div>;
}
