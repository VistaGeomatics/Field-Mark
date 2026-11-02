"use strict";
const RELEASE="2026-11-02-tablet-portal-1";
const ROOT=new URL("./",self.registration.scope).href;
const PREFIX="fieldmark-offline-";
const CACHE_NAME=PREFIX+RELEASE;
const ASSETS=["manifest.webmanifest","fieldmark-icon.png"].map(name=>new URL(name,ROOT).href);
function htmlRelease(source){const match=source.match(/<meta\s+name="fieldmark-release"\s+content="([^"]+)"/i);return match?match[1]:null;}
self.addEventListener("install",event=>{
 event.waitUntil((async()=>{
  const response=await fetch(new Request(ROOT,{cache:"reload"}));
  if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html")||htmlRelease(await response.clone().text())!==RELEASE)throw new Error("Publish the matching index.html and offline worker together.");
  const cache=await caches.open(CACHE_NAME);await cache.put(ROOT,response);await cache.addAll(ASSETS.map(url=>new Request(url,{cache:"reload"})));
 })());
});
self.addEventListener("activate",event=>{
 event.waitUntil((async()=>{
  // These caches contain program files, not the IndexedDB job library or calculator memory.
  for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==CACHE_NAME){const cache=await caches.open(key);if(await cache.match(ROOT))await caches.delete(key);}
  await self.clients.claim();
 })());
});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET")return;
 const url=new URL(event.request.url),root=new URL(ROOT);
 if(url.origin!==root.origin)return;
 const main=url.pathname===root.pathname||url.pathname===new URL("index.html",ROOT).pathname,asset=ASSETS.find(value=>new URL(value).pathname===url.pathname);
 if(!main&&!asset)return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME),key=main?ROOT:asset;
  // Revalidate online so an old offline copy cannot permanently mask an uploaded update.
  try{
   const response=await fetch(new Request(event.request,{cache:"no-cache"}));
   if(response.ok&&(!main||(response.headers.get("content-type")||"").includes("text/html")&&htmlRelease(await response.clone().text()))){await cache.put(key,response.clone());return response;}
   const cached=await cache.match(key);return cached||response;
  }catch(error){const cached=await cache.match(key);if(cached)return cached;throw error;}
 })());
});
self.addEventListener("message",event=>{
 if(event.data&&event.data.type==="FM_ACTIVATE_UPDATE"){event.waitUntil(self.skipWaiting());return;}
 if(!event.data||event.data.type!=="FM_OFFLINE_STATUS"||!event.ports[0])return;
 event.waitUntil((async()=>{const cache=await caches.open(CACHE_NAME),main=await cache.match(ROOT),assets=await Promise.all(ASSETS.map(url=>cache.match(url))),release=main&&htmlRelease(await main.clone().text());event.ports[0].postMessage({release:release||RELEASE,workerRelease:RELEASE,ready:!!release&&assets.every(Boolean)});})());
});
