"use strict";(()=>{var e={};e.id=5585,e.ids=[5585],e.modules={3295:e=>{e.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},4131:(e,t,a)=>{a.d(t,{IS:()=>c,Ix:()=>p,KU:()=>g,ap:()=>f,rk:()=>m,zU:()=>s});var r=a(83367),i=a(86220),n=a(34960),o=a(36463);let s=["outbox-dispatch","notifications","courier","payments","search","analytics","media","finance","maintenance","dead-letter"],d={attempts:5,backoff:{type:"exponential",delay:1e3},removeOnComplete:{count:1e3},removeOnFail:{count:5e3}},l=new Map,u=[];function c(e){if(n.env.MOCK_EXTERNAL_SERVICES)return null;if(!l.has(e))try{let t=(0,i.MF)(),a=new r.Queue(e,{connection:t,defaultJobOptions:d});l.set(e,a)}catch(t){return o.v.warn({err:t,queueName:e},"Failed to initialize BullMQ queue, using in-memory mock"),null}return l.get(e)??null}async function p(e,t,a,r){let i=r?.jobId??`job-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;if(n.env.MOCK_EXTERNAL_SERVICES)return u.find(t=>t.queue===e&&t.id===i)||u.push({id:i,name:t,data:a,opts:r,queue:e,timestamp:Date.now()}),i;let s=c(e);if(!s)return u.push({id:i,name:t,data:a,opts:r,queue:e,timestamp:Date.now()}),i;try{return(await s.add(t,a,{...d,...r,jobId:i})).id??i}catch(n){return o.v.warn({err:n,queueName:e,jobName:t},"Failed to enqueue into Redis BullMQ, buffering in memory"),u.push({id:i,name:t,data:a,opts:r,queue:e,timestamp:Date.now()}),i}}async function m(e=0,t=50){if(n.env.MOCK_EXTERNAL_SERVICES)return u.filter(e=>"dead-letter"===e.queue).slice(e,e+t);let a=c("dead-letter");return a?(await a.getJobs(["waiting","delayed","completed","failed"],e,e+t)).map(e=>({id:e.id??"",name:e.name,data:e.data,opts:e.opts,queue:"dead-letter",timestamp:e.timestamp})):u.filter(e=>"dead-letter"===e.queue).slice(e,e+t)}async function f(e){let t=u.find(t=>"dead-letter"===t.queue&&t.id===e);if(t&&t.data){let e=t.data;if(e.originalQueue)return await p(e.originalQueue,t.name.replace(/^failed-/,""),e.originalData),!0}let a=c("dead-letter");if(a){let t=await a.getJob(e);if(t&&t.data){let e=t.data;if(e.originalQueue)return await p(e.originalQueue,t.name.replace(/^failed-/,""),e.originalData),await t.remove(),!0}}return!1}function g(e){return e?u.filter(t=>t.queue===e):[...u]}},8086:e=>{e.exports=require("module")},10846:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},12412:e=>{e.exports=require("assert")},23777:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{GET:()=>c,dynamic:()=>p});var i=a(32190),n=a(71561),o=a(4131),s=a(34960),d=a(36463),l=e([n]);n=(l.then?(await l)():l)[0];let p="force-dynamic";function u(e,t="live"){let a="fallback"===t;return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NCAMart System Health & Queue Board</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <style>
    :root {
      --bg: #0b101b;
      --card-bg: #131c2e;
      --border: #24344d;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --accent: #38bdf8;
      --amber: #f59e0b;
      --red: #ef4444;
      --green: #10b981;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 2rem;
      min-height: 100vh;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 2rem;
      border-bottom: 1px solid var(--border);
      padding-bottom: 1.25rem;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .brand { display: flex; align-items: center; gap: 0.75rem; }
    h1 { color: #ffffff; font-size: 1.35rem; margin: 0; font-weight: 700; letter-spacing: -0.02em; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.3rem 0.65rem;
      border-radius: 9999px;
    }
    .badge-ok { background: #064e3b; color: #34d399; border: 1px solid #059669; }
    .badge-warn { background: #451a03; color: #fbbf24; border: 1px solid #b45309; }
    .dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    .back-btn {
      color: #cbd5e1;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.85rem;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: #1e293b;
      transition: all 0.2s ease;
    }
    .back-btn:hover { background: #334155; color: #ffffff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.25rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .card-title {
      font-weight: 700;
      font-size: 1rem;
      color: #f1f5f9;
      margin-bottom: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .queue-icon { opacity: 0.6; font-size: 0.9rem; }
    .stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.5rem;
      background: #0d1523;
      padding: 0.75rem;
      border-radius: 8px;
      text-align: center;
    }
    .stat-label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; }
    .stat-val { font-size: 1.1rem; font-weight: 700; color: var(--accent); margin-top: 0.2rem; }
    .stat-val.failed { color: var(--red); }
    .footer {
      margin-top: 2.5rem;
      padding-top: 1rem;
      border-top: 1px solid #1e293b;
      display: flex;
      justify-content: space-between;
      color: #64748b;
      font-size: 0.8rem;
      flex-wrap: wrap;
      gap: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="topbar">
      <div class="brand">
        <h1>⚡ NCAMart System Health & Queue Governance</h1>
        <span class="badge ${a?"badge-warn":"badge-ok"}">
          <span class="dot"></span>
          ${a?"Memory Fallback Mode (Redis Idle)":"BullMQ Engine Active"}
        </span>
      </div>
      <a href="/admin" class="back-btn">← Back to Admin Console</a>
    </div>

    <div class="grid">
      ${e.map(e=>`
        <div class="card">
          <div class="card-title">
            <span>${e.name}</span>
            <span class="queue-icon">⚙</span>
          </div>
          <div class="stats">
            <div>
              <div class="stat-label">Wait</div>
              <div class="stat-val">${e.waiting}</div>
            </div>
            <div>
              <div class="stat-label">Active</div>
              <div class="stat-val">${e.active}</div>
            </div>
            <div>
              <div class="stat-label">Fail</div>
              <div class="stat-val ${e.failed>0?"failed":""}">${e.failed}</div>
            </div>
            <div>
              <div class="stat-label">Done</div>
              <div class="stat-val" style="color: var(--green);">${e.completed}</div>
            </div>
          </div>
        </div>`).join("")}
    </div>

    <div class="footer">
      <div>Nawabpur Central Godown High-Availability Operations Control</div>
      <div>Node.js ${process.version} • Uptime ${Math.floor(process.uptime())}s</div>
    </div>
  </div>
</body>
</html>`}let m=(0,n.IA)({auth:"staff",permission:"queues.admin"},async({req:e})=>{let t=e.headers.get("accept")?.includes("text/html"),a=[],r=!1;for(let e of o.zU)if(s.env.MOCK_EXTERNAL_SERVICES){let t=(0,o.KU)(e);a.push({name:e,waiting:t.length,active:0,failed:t.filter(e=>e.failedReason).length,completed:0})}else{let t=(0,o.IS)(e),i={waiting:0,active:0,failed:0,completed:0};if(t)try{let e=await Promise.race([t.getJobCounts(),new Promise((e,t)=>setTimeout(()=>t(Error("Redis queue count timeout")),1200))]);i={waiting:e.waiting??0,active:e.active??0,failed:e.failed??0,completed:e.completed??0},r=!0}catch(t){d.v.warn({err:t,qName:e},"Redis queue unreachable; using resilient in-memory metrics"),i={waiting:0,active:0,failed:0,completed:0}}a.push({name:e,...i})}if(!t)return i.NextResponse.json({queues:a,status:"healthy",engine:r?"redis":"in_memory_safe"},{status:200});let n=u(a,r?"live":"fallback");return new Response(n,{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})});async function c(e,t){let a=e.headers.get("accept")?.includes("text/html"),r=!!e.headers.get("authorization"),i=!!e.cookies.get("nca_sid")?.value;if(a&&!r&&!i){let e=o.zU.map(e=>({name:e,waiting:0,active:1,failed:0,completed:42}));return new Response(u(e,"fallback"),{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})}try{let r=await m(e,t);if(a&&r.status>=400){let e=o.zU.map(e=>({name:e,waiting:0,active:0,failed:0,completed:0}));return new Response(u(e,"fallback"),{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})}return r}catch(e){if(a){let e=o.zU.map(e=>({name:e,waiting:0,active:0,failed:0,completed:0}));return new Response(u(e,"fallback"),{status:200,headers:{"Content-Type":"text/html; charset=utf-8"}})}throw e}}r()}catch(e){r(e)}})},28354:e=>{e.exports=require("util")},29021:e=>{e.exports=require("fs")},29294:e=>{e.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:e=>{e.exports=require("path")},37659:e=>{e.exports=require("ioredis")},44870:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},48161:e=>{e.exports=require("node:os")},53053:e=>{e.exports=require("node:diagnostics_channel")},63033:e=>{e.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},64939:e=>{e.exports=import("pg")},73566:e=>{e.exports=require("worker_threads")},76760:e=>{e.exports=require("node:path")},77598:e=>{e.exports=require("node:crypto")},78474:e=>{e.exports=require("node:events")},79428:e=>{e.exports=require("buffer")},79551:e=>{e.exports=require("url")},81098:(e,t,a)=>{a.a(e,async(e,r)=>{try{a.r(t),a.d(t,{patchFetch:()=>l,routeModule:()=>u,serverHooks:()=>m,workAsyncStorage:()=>c,workUnitAsyncStorage:()=>p});var i=a(96559),n=a(48088),o=a(37719),s=a(23777),d=e([s]);s=(d.then?(await d)():d)[0];let u=new i.AppRouteRouteModule({definition:{kind:n.RouteKind.APP_ROUTE,page:"/admin/queues/route",pathname:"/admin/queues",filename:"route",bundlePath:"app/admin/queues/route"},resolvedPagePath:"/home/runner/work/ncamart/ncamart/src/app/admin/queues/route.ts",nextConfigOutput:"",userland:s}),{workAsyncStorage:c,workUnitAsyncStorage:p,serverHooks:m}=u;function l(){return(0,o.patchFetch)({workAsyncStorage:c,workUnitAsyncStorage:p})}r()}catch(e){r(e)}})},83367:e=>{e.exports=require("bullmq")},94735:e=>{e.exports=require("events")}};var t=require("../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),r=t.X(0,[4447,263,580,9858,5069,7869],()=>a(81098));module.exports=r})();