"use strict";
const RELEASE="2026-10-22-inline-point-text";
const CACHE_PREFIX="fieldmark-offline-";
const CACHE_NAME=CACHE_PREFIX+RELEASE;
const ROOT=new URL("./",self.registration.scope).href;
const ASSETS=["manifest.webmanifest","fieldmark-icon.png"].map(name=>new URL(name,ROOT).href);
self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const response=await fetch(new Request(ROOT,{cache:"reload"}));
    if(!response.ok||!(response.headers.get("content-type")||"").includes("text/html"))throw new Error("Field Mark could not be downloaded for offline use.");
    const source=await response.clone().text();
    if(!source.includes('<meta name="fieldmark-release" content="'+RELEASE+'">'))throw new Error("Upload the matching Field Mark HTML before preparing offline use.");
    const cache=await caches.open(CACHE_NAME);
    await cache.put(ROOT,response);
    await cache.addAll(ASSETS.map(url=>new Request(url,{cache:"reload"})));
  })());
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url),root=new URL(ROOT);
  if(url.origin!==root.origin)return;
  const main=url.pathname===root.pathname||url.pathname===new URL("index.html",ROOT).pathname;
  const asset=ASSETS.find(value=>new URL(value).pathname===url.pathname);
  if(!main&&!asset)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME),cached=await cache.match(main?ROOT:asset);
    if(cached)return cached;
    return fetch(event.request);
  })());
});
self.addEventListener("message",event=>{
  if(event.data&&event.data.type==="FM_ACTIVATE_UPDATE"){event.waitUntil(self.skipWaiting());return;}
  if(!event.data||event.data.type!=="FM_OFFLINE_STATUS"||!event.ports[0])return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME),main=await cache.match(ROOT),assets=await Promise.all(ASSETS.map(url=>cache.match(url)));
    event.ports[0].postMessage({release:RELEASE,ready:!!main&&assets.every(Boolean)});
  })());
});
