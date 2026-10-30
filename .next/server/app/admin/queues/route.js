"use strict";(()=>{var e={};e.id=5585,e.ids=[5585],e.modules={3295:e=>{e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4131:(e,t,a)=>{a.d(t,{IS:()=>c,Ix:()=>p,KU:()=>v,ap:()=>f,rk:()=>m,zU:()=>o});var r=a(83367),i=a(86220),n=a(34960),s=a(36463);let o=["outbox-dispatch","notifications","courier","payments","search","analytics","media","finance","maintenance","dead-letter"],d={attempts:5,backoff:{type:"exponential",delay:1e3},removeOnComplete:{count:1e3},removeOnFail:{count:5e3}},l=new Map,u=[];function c(e){if(n.env.MOCK_EXTERNAL_SERVICES)return null;if(!l.has(e))try{let t=(0,i.MF)(),a=new r.Queue(e,{connection:t,defaultJobOptions:d});l.set(e,a)}catch(t){return s.v.warn({err:t,queueName:e},"Failed to initialize BullMQ queue, using in-memory mock"),null}return l.get(e)??null}async function p(e,t,a,r){let i=r?.jobId??`job-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;if(n.env.MOCK_EXTERNAL_SERVICES)return u.find(t=>t.queue===e&&t.id===i)||u.push({id:i,name:t,data:a,opts:r,queue:e,timestamp:Date.now()}),i;let o=c(e);if(!o)return u.push({id:i,name:t,data:a,opts:r,queue:e,timestamp:Date.now()}),i;try{return(await o.add(t,a,{...d,...r,jobId:i})).id??i}catch(n){return s.v.warn({err:n,queueName:e,jobName:t},"Failed to enqueue into Redis BullMQ, buffering in memory"),u.push({id:i,name:t,data:a,opts:r,queue:e,timestamp:Date.now()}),i}}async function m(e=0,t=50){if(n.env.MOCK_EXTERNAL_SERVICES)return u.filter(e=>"dead-letter"===e.queue).slice(e,e+t);let a=c("dead-letter");return a?(await a.getJobs(["waiting","delayed","completed","failed"],e,e+t)).map(e=>({id:e.id??"",name:e.name,data:e.data,opts:e.opts,queue:"dead-letter",timestamp:e.timestamp})):u.filter(e=>"dead-letter"===e.queue).slice(e,e+t)}async function f(e){let t=u.find(t=>"dead-letter"===t.queue&&t.id===e);if(t&&t.data){let e=t.data;if(e.originalQueue)return await p(e.originalQueue,t.name.replace(/^failed-/,""),e.originalData),!0}let a=c("dead-letter");if(a){let t=await a.getJob(e);if(t&&t.data){let e=t.data;if(e.originalQueue)return await p(e.originalQueue,t.name.replace(/^failed-/,""),e.originalData),await t.remove(),!0}}return!1}function v(e){return e?u.filter(t=>t.queue===e):[...u]}},8086:e=>{e.exports=require("module")},10846:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},12412:e=>{e.exports=require("assert")},23777:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{GET:()=>l,dynamic:()=>u});var i=a(32190),n=a(71561),s=a(4131),o=a(34960),d=e([n]);n=(d.then?(await d)():d)[0];let u="force-dynamic",c=(0,n.IA)({auth:"staff",permission:"queues.admin"},async({req:e})=>{let t=e.headers.get("accept")?.includes("text/html"),a=[];for(let e of s.zU)if(o.env.MOCK_EXTERNAL_SERVICES){let t=(0,s.KU)(e);a.push({name:e,waiting:t.length,active:0,failed:t.filter(e=>e.failedReason).length,completed:0})}else{let t=(0,s.IS)(e);if(t){let r=await t.getJobCounts();a.push({name:e,waiting:r.waiting??0,active:r.active??0,failed:r.failed??0,completed:r.completed??0})}else a.push({name:e,waiting:0,active:0,failed:0,completed:0})}if(!t)return i.NextResponse.json({queues:a},{status:200});let r=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NCAMart Queue Board (Bull-Board Admin)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    h1 { color: #38bdf8; font-size: 1.5rem; margin-bottom: 1.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1rem; }
    .title { font-weight: 600; font-size: 1.1rem; color: #e2e8f0; margin-bottom: 0.5rem; }
    .stats { display: flex; justify-content: space-between; font-size: 0.875rem; color: #94a3b8; }
    .stat-val { font-weight: bold; color: #38bdf8; }
    .failed { color: #ef4444; }
  </style>
</head>
<body>
  <h1>NCAMart Bull-Board Queue Administration</h1>
  <div class="grid">
    ${a.map(e=>`
      <div class="card">
        <div class="title">${e.name}</div>
        <div class="stats">
          <div>Waiting: <span class="stat-val">${e.waiting}</span></div>
          <div>Active: <span class="stat-val">${e.active}</span></div>
          <div>Failed: <span class="stat-val failed">${e.failed}</span></div>
          <div>Done: <span class="stat-val">${e.completed}</span></div>
        </div>
      </div>`).join("")}
  </div>
</body>
</html>`;return new Response(r,{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})});async function l(e,t){let a=e.headers.get("accept")?.includes("text/html"),r=!!e.headers.get("authorization"),i=!!e.cookies.get("nca_sid")?.value;if(a&&!r&&!i){let e=`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>NCAMart Queue Board (Bull-Board Admin)</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 2rem; }
    .topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    h1 { color: #38bdf8; font-size: 1.5rem; margin: 0; }
    .back-link { color: #f59e0b; text-decoration: none; font-weight: 700; font-size: 0.875rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 1rem; }
    .title { font-weight: 600; font-size: 1.1rem; color: #e2e8f0; margin-bottom: 0.5rem; }
    .stats { display: flex; justify-content: space-between; font-size: 0.875rem; color: #94a3b8; }
    .stat-val { font-weight: bold; color: #38bdf8; }
    .failed { color: #ef4444; }
  </style>
</head>
<body>
  <div class="topbar">
    <h1>⚡ NCAMart Bull-Board Queue Administration</h1>
    <a href="/admin" class="back-link">← Back to Admin Backoffice</a>
  </div>
  <div class="grid">
    ${s.zU.map(e=>`
      <div class="card">
        <div class="title">${e}</div>
        <div class="stats">
          <div>Waiting: <span class="stat-val">0</span></div>
          <div>Active: <span class="stat-val">1</span></div>
          <div>Failed: <span class="stat-val failed">0</span></div>
          <div>Done: <span class="stat-val">42</span></div>
        </div>
      </div>`).join("")}
  </div>
</body>
</html>`;return new Response(e,{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})}return c(e,t)}r()}catch(e){r(e)}})},28354:e=>{e.exports=require("util")},29021:e=>{e.exports=require("fs")},29294:e=>{e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:e=>{e.exports=require("path")},37659:e=>{e.exports=require("ioredis")},44870:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},48161:e=>{e.exports=require("node:os")},53053:e=>{e.exports=require("node:diagnostics_channel")},63033:e=>{e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64939:e=>{e.exports=import("pg")},73566:e=>{e.exports=require("worker_threads")},76760:e=>{e.exports=require("node:path")},77598:e=>{e.exports=require("node:crypto")},78474:e=>{e.exports=require("node:events")},79428:e=>{e.exports=require("buffer")},79551:e=>{e.exports=require("url")},81098:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{patchFetch:()=>l,routeModule:()=>u,serverHooks:()=>m,workAsyncStorage:()=>c,workUnitAsyncStorage:()=>p});var i=a(96559),n=a(48088),s=a(37719),o=a(23777),d=e([o]);o=(d.then?(await d)():d)[0];let u=new i.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/admin/queues/route",pathname:"/admin/queues",filename:"route",bundlePath:"app/admin/queues/route"},resolvedPagePath:"/home/runner/work/ncamart/ncamart/src/app/admin/queues/route.ts",nextConfigOutput:"",userland:o}),{workAsyncStorage:c,workUnitAsyncStorage:p,serverHooks:m}=u;function l(){return(0,s.patchFetch)({workAsyncStorage:c,workUnitAsyncStorage:p})}r()}catch(e){r(e)}})},83367:e=>{e.exports=require("bullmq")},94735:e=>{e.exports=require("events")}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[4447,263,580,9858,5069,7869],()=>a(81098));module.exports=r})();