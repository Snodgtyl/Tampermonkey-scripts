// ==UserScript==
// @name         SDC Sync Copilot
// @namespace    https://fclm-portal.amazon.com
// @version      4.0.0
// @description  Full shift sync board dashboard on FCLM - IB/OB/Sort metrics, CPLH, Support Teams
// @author       snodgtyl
// @match        https://fclm-portal.amazon.com/*
// @grant        GM_xmlhttpRequest
// @connect      fc-benchmarking.amazon.com
// @run-at       document-idle
// ==/UserScript==

(function() {
'use strict';

// === CONFIG ===
const STORAGE_KEY = 'syncboard_config';
const ACTIONS_KEY = 'syncboard_actions';
const SUPPORT_KEY = 'syncboard_support';
const SITES = ['KRB3','KRB1','KRB2','KRB4','KRB6','ATL7','AVP8','HGR5','QXX6','SAV7'];

const SITE_SCHEDULES = {
    KRB3: { days:{full:{sh:5,sm:45,eh:17,em:30},p1:{sh:6,sm:15,eh:9,em:45},p2:{sh:9,sm:46,eh:13,em:15},p3:{sh:13,sm:45,eh:16,em:45}}, nights:{full:{sh:17,sm:45,eh:5,em:30},p1:{sh:18,sm:15,eh:21,em:45},p2:{sh:21,sm:46,eh:1,em:15},p3:{sh:1,sm:45,eh:4,em:45}} },
    KRB1: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:0,eh:5,em:45},p1:{sh:18,sm:30,eh:22,em:0},p2:{sh:22,sm:1,eh:1,em:30},p3:{sh:1,sm:30,eh:5,em:0}} },
    KRB2: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    KRB4: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:0,eh:5,em:45},p1:{sh:18,sm:30,eh:22,em:0},p2:{sh:22,sm:1,eh:1,em:30},p3:{sh:1,sm:30,eh:5,em:0}} },
    KRB6: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    ATL7: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:17,sm:30,eh:5,em:15},p1:{sh:18,sm:0,eh:21,em:30},p2:{sh:21,sm:31,eh:1,em:0},p3:{sh:1,sm:0,eh:4,em:30}} },
    AVP8: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    HGR5: { days:{full:{sh:5,sm:0,eh:16,em:30},p1:{sh:5,sm:30,eh:9,em:0},p2:{sh:9,sm:1,eh:12,em:30},p3:{sh:12,sm:30,eh:15,em:45}}, nights:{full:{sh:16,sm:0,eh:5,em:45},p1:{sh:16,sm:30,eh:20,em:0},p2:{sh:20,sm:1,eh:23,em:30},p3:{sh:23,sm:30,eh:5,em:0}} },
    QXX6: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    SAV7: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
};
const PROCESS_IDS = { stow:'1003035', palletStow:'1003041', pick:'1003065', sort:'1003009', obDock:'1003021' };
const DEFAULT_CONFIG = {
    site:'KRB3', shiftType:'Days', schedType:'3P',
    days:{ full:{sh:5,sm:45,eh:17,em:30}, p1:{sh:6,sm:15,eh:9,em:45}, p2:{sh:9,sm:46,eh:13,em:15}, p3:{sh:13,sm:45,eh:16,em:45} },
    nights:{ full:{sh:17,sm:45,eh:5,em:30}, p1:{sh:18,sm:15,eh:21,em:45}, p2:{sh:21,sm:46,eh:1,em:15}, p3:{sh:1,sm:45,eh:4,em:45} },
    targets:{}
};

function loadConfig(){try{const s=localStorage.getItem(STORAGE_KEY);return s?{...DEFAULT_CONFIG,...JSON.parse(s)}:{...DEFAULT_CONFIG};}catch(e){return{...DEFAULT_CONFIG};}}
function saveConfig(c){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(c));}catch(e){}}
function loadActions(){try{const s=localStorage.getItem(ACTIONS_KEY);return s?JSON.parse(s):[];}catch(e){return[];}}
function saveActions(a){try{localStorage.setItem(ACTIONS_KEY,JSON.stringify(a));}catch(e){}}
function loadSupport(){try{const s=localStorage.getItem(SUPPORT_KEY);return s?JSON.parse(s):{};}catch(e){return{};}}
function saveSupport(d){try{localStorage.setItem(STORAGE_KEY.replace('config','support'),JSON.stringify(d));}catch(e){}}

// === DATE & FETCH HELPERS ===
function fmtDate(d){return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0');}
function getShiftDates(config){
    const now=new Date(), sched=config.shiftType==='Nights'?config.nights:config.days;
    let startDate=new Date(now), endDate=new Date(now);
    startDate.setHours(sched.full.sh,sched.full.sm,0,0);
    if(config.shiftType==='Nights'&&sched.full.eh<sched.full.sh) endDate.setDate(endDate.getDate()+1);
    endDate.setHours(sched.full.eh,sched.full.em,0,0);
    if(config.shiftType==='Nights'&&now.getHours()<12){startDate.setDate(startDate.getDate()-1);endDate.setDate(endDate.getDate()-1);}
    return{startDate,endDate};
}
async function fetchHTML(url){const r=await fetch(url,{credentials:'include'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}
function buildFnUrl(site,pid,sd,sh,sm,ed,eh,em){return`/reports/functionRollup?reportFormat=HTML&warehouseId=${site}&processId=${pid}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}`;}
function buildPPRUrl(site,sd,sh,sm,ed,eh,em){return`/reports/processPathRollup?reportFormat=HTML&warehouseId=${site}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}&_adjustPlanHours=on&_hideEmptyLineItems=on&employmentType=AllEmployees`;}

function parseFnRollup(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const tr=doc.querySelector('tfoot tr.total.empl-all')||doc.querySelector('tr.total.empl-all')||doc.querySelector('tfoot tr.total')||doc.querySelector('tfoot tr');
    let units=0,hours=0,rate=0,hc=0;
    if(tr){const cells=tr.querySelectorAll('td.numeric');if(cells.length>=3){hours=parseFloat(cells[0].textContent.replace(/,/g,''))||0;units=parseInt(cells[1].textContent.replace(/,/g,''),10)||0;rate=parseFloat(cells[2].textContent.replace(/,/g,''))||0;}}
    const links=doc.querySelectorAll('a[href*="employeeId="]');const ids=new Set();links.forEach(l=>{const m=l.href.match(/employeeId=([^&]+)/);if(m)ids.add(m[1]);});hc=ids.size;
    // For palletStow: get CASE_UNIT from "Pallet Transfer In" Total row (6th numeric = index 5)
    let palletCases=0;
    const rows=doc.querySelectorAll('tr');let foundPTI=false;
    for(const row of rows){
        if(Array.from(row.querySelectorAll('th,td')).some(c=>/pallet\s*transfer\s*in/i.test(c.textContent.trim())))foundPTI=true;
        if(foundPTI){const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});if(nums.length>=6)palletCases=Math.round(nums[5]);break;}}
    }
    return{totalUnits:units,directHours:hours,rate,headcount:hc,palletCases};
}

function parsePPR(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    let ibPlan=0,ibAct=0,obPlan=0,obAct=0,daTransferHrs=0,daTransferPlan=0,caseStowReserveHrs=0;
    // IB Total
    const ibCB=doc.querySelector('input[value="ppr.detail.inbound.inbound.total"]');
    if(ibCB){const row=ibCB.closest('tr');if(row){const cells=row.querySelectorAll('td');const nums=[];cells.forEach(c=>{const t=c.textContent.trim().replace(/,/g,'');const v=parseFloat(t);if(!isNaN(v)&&t!=='')nums.push(v);});if(nums.length>=2)ibAct=nums[1];if(nums.length>=7&&nums[6]>0)ibPlan=ibAct/(nums[6]/100);else if(nums.length>=10)ibPlan=nums[9];}}
    // Case Stow to Reserve (subtract from IB Total for CPLH)
    const rows=doc.querySelectorAll('tr');
    for(const row of rows){const cells=row.querySelectorAll('td,th');for(let ci=0;ci<cells.length;ci++){const ct=cells[ci].textContent.trim();if(ct==='Case Stow to Reserve'||ct==='Case Stow Reserve'){const hrsCell=row.querySelector('td.actualTimeSeconds');if(hrsCell){const div=hrsCell.querySelector('div.original');const txt=(div?div.textContent:hrsCell.textContent).trim().replace(/,/g,'');caseStowReserveHrs=parseFloat(txt)||0;}break;}}if(caseStowReserveHrs>0)break;}
    // DA Transfer
    for(const row of rows){if(row.textContent.includes('DA Bldg to Bldg Transfer TOTAL')||row.textContent.includes('DA Transfer TOTAL')){const cells=row.querySelectorAll('td');const nums=[];cells.forEach(c=>{const t=c.textContent.trim().replace(/,/g,'');const v=parseFloat(t);if(!isNaN(v)&&t!=='')nums.push(v);});if(nums.length>=2)daTransferHrs=nums[1];if(nums.length>=7&&nums[6]>0)daTransferPlan=daTransferHrs/(nums[6]/100);else if(nums.length>=10)daTransferPlan=nums[9];break;}}
    // OB Total
    const obCB=doc.querySelector('input[value*="outbound.outbound.total"]')||doc.querySelector('input[value*="outbound.total"]');
    if(obCB){const row=obCB.closest('tr');if(row){const cells=row.querySelectorAll('td');const nums=[];cells.forEach(c=>{const t=c.textContent.trim().replace(/,/g,'');const v=parseFloat(t);if(!isNaN(v)&&t!=='')nums.push(v);});if(nums.length>=2)obAct=nums[1];if(nums.length>=7&&nums[6]>0)obPlan=obAct/(nums[6]/100);else if(nums.length>=10)obPlan=nums[9];}}
    return{ibPlannedHrs:ibPlan,ibActualHrs:ibAct,obPlannedHrs:obPlan,obActualHrs:obAct,daTransferHrs,daTransferPlan,caseStowReserveHrs};
}

async function fetchPeriod(site,startDate,sched){
    const sh=sched.sh,sm=sched.sm,eh=sched.eh,em=sched.em;
    let eDate=new Date(startDate);if(eh<sh)eDate.setDate(eDate.getDate()+1);
    const urls={ppr:buildPPRUrl(site,startDate,sh,sm,eDate,eh,em),stow:buildFnUrl(site,PROCESS_IDS.stow,startDate,sh,sm,eDate,eh,em),palletStow:buildFnUrl(site,PROCESS_IDS.palletStow,startDate,sh,sm,eDate,eh,em),pick:buildFnUrl(site,PROCESS_IDS.pick,startDate,sh,sm,eDate,eh,em),sort:buildFnUrl(site,PROCESS_IDS.sort,startDate,sh,sm,eDate,eh,em),obDock:buildFnUrl(site,PROCESS_IDS.obDock,startDate,sh,sm,eDate,eh,em)};
    const res={};
    await Promise.all(Object.entries(urls).map(async([k,u])=>{try{const h=await fetchHTML(u);res[k]=k==='ppr'?parsePPR(h):parseFnRollup(h);}catch(e){console.warn('[SB]',k,e.message);res[k]=k==='ppr'?{ibPlannedHrs:0,ibActualHrs:0,obPlannedHrs:0,obActualHrs:0,daTransferHrs:0,daTransferPlan:0}:{totalUnits:0,directHours:0,rate:0,headcount:0};}}));
    return res;
}

async function fetchAllData(config){
    const site=config.site,sched=config.shiftType==='Nights'?config.nights:config.days,{startDate}=getShiftDates(config);
    setStatus('Fetching Full Shift...');const full=await fetchPeriod(site,startDate,sched.full);
    setStatus('Fetching P1...');const p1=await fetchPeriod(site,startDate,sched.p1);
    setStatus('Fetching P2...');const p2=await fetchPeriod(site,startDate,sched.p2);
    setStatus('Fetching P3...');const p3=await fetchPeriod(site,startDate,sched.p3);
    setStatus('Fetching Fast Start...');const fastStart=await fetchFastStart(site,config.shiftType);
    setStatus('\u2713 Updated '+new Date().toLocaleTimeString());
    return{full,p1,p2,p3,fastStart};
}

function fetchFastStart(site,shiftType){
    return new Promise((resolve)=>{
        // For night shift after midnight, use yesterday's date (shift started yesterday evening)
        const today=new Date();
        if(shiftType==='Nights'&&today.getHours()<12){
            today.setDate(today.getDate()-1);
        }
        const dateStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
        const url='https://fc-benchmarking.amazon.com/rest/get_fast_start_moves?dateString='+dateStr+'&warehouseId='+site;
        GM_xmlhttpRequest({method:'GET',url,headers:{'Accept':'application/json'},
            onload:function(resp){try{const data=JSON.parse(resp.responseText);if(!data.moves_data||!data.authorized){resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0});return;}let ibSOS=0,ibEOL=0,obSOS=0,obEOL=0;data.moves_data.forEach(proc=>{const isIB=proc.mainProcess==='Inbound';const isOB=proc.mainProcess==='Outbound';if(!proc.segments)return;proc.segments.forEach(seg=>{if(!seg.moves||seg.moves.length===0)return;const durations=seg.moves.map(m=>m.duration||0);const avg=durations.reduce((a,b)=>a+b,0)/durations.length/60000;if(seg.displayName==='Start of Shift'){if(isIB)ibSOS=avg;if(isOB)obSOS=avg;}else if(seg.displayName==='Break 1'){if(isIB)ibEOL=avg;if(isOB)obEOL=avg;}});});resolve({ibSOS,ibEOL,obSOS,obEOL});}catch(e){resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0});}},
            onerror:function(){resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0});}
        });
    });
}

// === DATA PROCESSING (cumulative) ===
function processData(raw){
    const m={ib:{},ob:{},sort:{}};
    const config=loadConfig();
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    // Period durations in hours (for HC calculation)
    function periodHrs(p){let h=p.eh-p.sh;if(h<0)h+=24;return h+(p.em-p.sm)/60;}
    const pDurations={full:periodHrs(sched.full),p1:periodHrs(sched.p1),p2:periodHrs(sched.p2),p3:periodHrs(sched.p3)};

    ['full','p1','p2','p3'].forEach(p=>{
        const d=raw[p];if(!d)return;
        const stow=d.stow||{},pStow=d.palletStow||{},pick=d.pick||{},obDock=d.obDock||{},sort=d.sort||{},ppr=d.ppr||{};
        // IB: total stow = case transfer in (stow units) + pallet transfer in CASE count
        const palletCases=pStow.palletCases||0;
        const ibU=(stow.totalUnits||0)+palletCases;
        const ibPPRHrs=ppr.ibActualHrs||0;
        const caseStowReserve=ppr.caseStowReserveHrs||0;
        const ibDH=stow.directHours||0;
        const ibTotalHrs=ibPPRHrs>0?ibPPRHrs:ibDH;
        const ibIndirect=ibTotalHrs>ibDH?ibTotalHrs-ibDH:0;
        // CPLH uses IB Total minus Case Stow to Reserve (matching Oculus)
        const cplhHrs=ibTotalHrs-caseStowReserve;
        const dur=pDurations[p]||1;
        m.ib[p]={totalStow:ibU,stowUnits:stow.totalUnits||0,palletUnits:pStow.totalUnits||0,palletCases,
            directHours:ibDH,indirectHours:ibIndirect,totalHours:ibTotalHrs,
            directPct:ibTotalHrs>0?(ibDH/ibTotalHrs)*100:0,indirectPct:ibTotalHrs>0?(ibIndirect/ibTotalHrs)*100:0,
            rate:stow.rate||0,headcount:(stow.headcount||0)+(pStow.headcount||0),
            cplh:cplhHrs>0?ibU/cplhHrs:0,
            directHC:dur>0?ibDH/dur:0,indirectHC:dur>0?ibIndirect/dur:0,
            pprPlannedHrs:ppr.ibPlannedHrs||0,pprActualHrs:ibPPRHrs,
            pctToOP:(ppr.ibPlannedHrs||0)>0?(ibPPRHrs/ppr.ibPlannedHrs)*100:0};
        const daHrs=ppr.daTransferHrs||0;
        const obPickDH=pick.directHours||0;
        const obTotalHrs=daHrs>0?daHrs:obPickDH;
        const obIndirect=obTotalHrs>obPickDH?obTotalHrs-obPickDH:0;
        const daPlan=ppr.daTransferPlan||0;
        m.ob[p]={pickUnits:pick.totalUnits||0,loadedUnits:obDock.totalUnits||0,
            directHours:obPickDH,indirectHours:obIndirect,totalHours:obTotalHrs,
            directPct:obTotalHrs>0?(obPickDH/obTotalHrs)*100:0,indirectPct:obTotalHrs>0?(obIndirect/obTotalHrs)*100:0,
            pickRate:pick.rate||0,pickHC:pick.headcount||0,dockHC:obDock.headcount||0,
            cplh:daHrs>0?(obDock.totalUnits||0)/daHrs:(obPickDH>0?(obDock.totalUnits||0)/obPickDH:0),
            directHC:dur>0?obPickDH/dur:0,indirectHC:dur>0?obIndirect/dur:0,
            pprPlannedHrs:daPlan,pprActualHrs:daHrs,
            pctToOP:daPlan>0?(daHrs/daPlan)*100:0};
        m.sort[p]={totalUnits:sort.totalUnits||0,directHours:sort.directHours||0,totalHours:sort.directHours||0,rate:sort.rate||0,headcount:sort.headcount||0,cplh:(sort.directHours||0)>0?sort.totalUnits/sort.directHours:0};
    });
    // Cumulative
    if(m.ib.p1&&m.ib.p2){m.ib.p2.totalStow=(m.ib.p1.totalStow||0)+((raw.p2?.stow?.totalUnits||0)+(raw.p2?.palletStow?.palletCases||0));m.ib.p2.stowUnits=(m.ib.p1.stowUnits||0)+(raw.p2?.stow?.totalUnits||0);m.ib.p2.palletUnits=(m.ib.p1.palletUnits||0)+(raw.p2?.palletStow?.totalUnits||0);m.ib.p2.palletCases=(m.ib.p1.palletCases||0)+(raw.p2?.palletStow?.palletCases||0);m.ob.p2.pickUnits=(m.ob.p1.pickUnits||0)+(raw.p2?.pick?.totalUnits||0);m.ob.p2.loadedUnits=(m.ob.p1.loadedUnits||0)+(raw.p2?.obDock?.totalUnits||0);m.sort.p2.totalUnits=(m.sort.p1.totalUnits||0)+(raw.p2?.sort?.totalUnits||0);}
    if(m.ib.p2&&m.ib.p3){m.ib.p3.totalStow=(m.ib.p2.totalStow||0)+((raw.p3?.stow?.totalUnits||0)+(raw.p3?.palletStow?.palletCases||0));m.ib.p3.stowUnits=(m.ib.p2.stowUnits||0)+(raw.p3?.stow?.totalUnits||0);m.ib.p3.palletUnits=(m.ib.p2.palletUnits||0)+(raw.p3?.palletStow?.totalUnits||0);m.ib.p3.palletCases=(m.ib.p2.palletCases||0)+(raw.p3?.palletStow?.palletCases||0);m.ob.p3.pickUnits=(m.ob.p2.pickUnits||0)+(raw.p3?.pick?.totalUnits||0);m.ob.p3.loadedUnits=(m.ob.p2.loadedUnits||0)+(raw.p3?.obDock?.totalUnits||0);m.sort.p3.totalUnits=(m.sort.p2.totalUnits||0)+(raw.p3?.sort?.totalUnits||0);}
    return m;
}

// === UI HELPERS ===
function fmt(v,d=0){if(v==null||isNaN(v))return'—';return Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}
function fmtPct(v){if(!v||isNaN(v)||v===0)return'—';return v.toFixed(1)+'%';}
function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val;return el;}
function setPctClass(el,pct){if(!el)return;el.classList.remove('pct-good','pct-warn','pct-bad');if(pct>=95)el.classList.add('pct-good');else if(pct>=80)el.classList.add('pct-warn');else if(pct>0)el.classList.add('pct-bad');}
function setStatus(msg){const el=document.getElementById('last-update');if(el)el.textContent=msg;}

// === PERIOD CHECK — blank future periods ===
function hasPeriodStarted(period, config){
    const now=new Date(), cm=now.getHours()*60+now.getMinutes();
    const s=period.sh*60+period.sm;
    if(config.shiftType==='Nights'){
        // Night shift: periods can start before midnight (e.g. P1 18:15) or after (e.g. P3 1:45)
        if(period.sh>=12){
            // Period starts in the PM (before midnight)
            // If we're currently in PM: started if cm >= s
            // If we're currently in AM (past midnight): this period already started yesterday = true
            return cm>=720 ? cm>=s : true;
        } else {
            // Period starts in the AM (after midnight, e.g. 1:45)
            // If we're currently in AM: started if cm >= s
            // If we're currently in PM: hasn't started yet (it's tomorrow's AM)
            return cm<720 ? cm>=s : false;
        }
    }
    return cm>=s;
}
function blankFuturePeriods(config){
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const periods=[sched.p1,sched.p2,sched.p3];
    const keys=['p1','p2','p3'];
    keys.forEach((pk,idx)=>{
        if(!hasPeriodStarted(periods[idx],config)){
            const prefixes=['ib-sync-','ib-stow-','ib-cases-','ib-pallets-','ib-cti-','ib-rate-','ib-dhrs-','ib-dpct-','ib-ihrs-','ib-ipct-','ib-thrs-','ib-cplh-','ib-op-','ib-dhc-','ib-ihc-',
                'ob-sync-','ob-pick-','ob-cases-','ob-rate-','ob-loadp-','ob-dhrs-','ob-dpct-','ob-ihrs-','ob-ipct-','ob-thrs-','ob-cplh-','ob-op-','ob-dhc-','ob-ihc-',
                'sort-total-','sort-units-','sort-rate-','sort-dhrs-','sort-cplh-'];
            prefixes.forEach(pre=>{const el=document.getElementById(pre+pk);if(el)el.textContent='';});
        }
    });
}

// === RENDER ===
function renderIB(m){
    const p1=m.ib.p1||{},p2=m.ib.p2||{},p3=m.ib.p3||{},f=m.ib.full||{};
    setEl('ib-sync-p1',fmt(p1.totalStow));setEl('ib-sync-p2',fmt(p2.totalStow));setEl('ib-sync-p3',fmt(p3.totalStow));setEl('ib-sync-total',fmt(f.totalStow));
    setEl('ib-stow-p1',fmt(p1.totalStow));setEl('ib-stow-p2',fmt(p2.totalStow));setEl('ib-stow-p3',fmt(p3.totalStow));setEl('ib-stow-total',fmt(f.totalStow));
    setEl('ib-cases-p1',fmt(p1.stowUnits));setEl('ib-cases-p2',fmt(p2.stowUnits));setEl('ib-cases-p3',fmt(p3.stowUnits));setEl('ib-cases-total',fmt(f.stowUnits));
    setEl('ib-pallets-p1',fmt(p1.palletUnits||0));setEl('ib-pallets-p2',fmt(p2.palletUnits||0));setEl('ib-pallets-p3',fmt(p3.palletUnits||0));setEl('ib-pallets-total',fmt(f.palletUnits||0));
    setEl('ib-cti-p1',fmt(p1.totalStow));setEl('ib-cti-p2',fmt(p2.totalStow));setEl('ib-cti-p3',fmt(p3.totalStow));setEl('ib-cti-total',fmt(f.totalStow));
    setEl('ib-rate-p1',fmt(p1.rate,1));setEl('ib-rate-p2',fmt(p2.rate,1));setEl('ib-rate-p3',fmt(p3.rate,1));setEl('ib-rate-total',fmt(f.rate,1));
    setEl('ib-dhrs-p1',fmt(p1.directHours,2));setEl('ib-dhrs-p2',fmt(p2.directHours,2));setEl('ib-dhrs-p3',fmt(p3.directHours,2));setEl('ib-dhrs-total',fmt(f.directHours,2));
    setEl('ib-dpct-p1',fmtPct(p1.directPct));setEl('ib-dpct-p2',fmtPct(p2.directPct));setEl('ib-dpct-p3',fmtPct(p3.directPct));setEl('ib-dpct-total',fmtPct(f.directPct));
    setEl('ib-ihrs-p1',fmt(p1.indirectHours,2));setEl('ib-ihrs-p2',fmt(p2.indirectHours,2));setEl('ib-ihrs-p3',fmt(p3.indirectHours,2));setEl('ib-ihrs-total',fmt(f.indirectHours,2));
    setEl('ib-ipct-p1',fmtPct(p1.indirectPct));setEl('ib-ipct-p2',fmtPct(p2.indirectPct));setEl('ib-ipct-p3',fmtPct(p3.indirectPct));setEl('ib-ipct-total',fmtPct(f.indirectPct));
    setEl('ib-thrs-p1',fmt(p1.totalHours,2));setEl('ib-thrs-p2',fmt(p2.totalHours,2));setEl('ib-thrs-p3',fmt(p3.totalHours,2));setEl('ib-thrs-total',fmt(f.totalHours,2));
    setEl('ib-cplh-p1',fmt(p1.cplh,2));setEl('ib-cplh-p2',fmt(p2.cplh,2));setEl('ib-cplh-p3',fmt(p3.cplh,2));setEl('ib-cplh-total',fmt(f.cplh,2));
    setEl('ib-op-p1',fmtPct(p1.pctToOP));setEl('ib-op-p2',fmtPct(p2.pctToOP));setEl('ib-op-p3',fmtPct(p3.pctToOP));const opEl=setEl('ib-op-total',fmtPct(f.pctToOP));setPctClass(opEl,f.pctToOP||0);
    // Direct HC & Indirect HC
    setEl('ib-dhc-p1',fmt(p1.directHC,1));setEl('ib-dhc-p2',fmt(p2.directHC,1));setEl('ib-dhc-p3',fmt(p3.directHC,1));setEl('ib-dhc-total',fmt(f.directHC,1));
    setEl('ib-ihc-p1',fmt(p1.indirectHC,1));setEl('ib-ihc-p2',fmt(p2.indirectHC,1));setEl('ib-ihc-p3',fmt(p3.indirectHC,1));setEl('ib-ihc-total',fmt(f.indirectHC,1));
    setEl('ib-timestamp',new Date().toLocaleString()+' MST');
}
function renderOB(m){
    const p1=m.ob.p1||{},p2=m.ob.p2||{},p3=m.ob.p3||{},f=m.ob.full||{};
    setEl('ob-sync-p1',fmt(p1.pickUnits));setEl('ob-sync-p2',fmt(p2.pickUnits));setEl('ob-sync-p3',fmt(p3.pickUnits));setEl('ob-sync-total',fmt(f.pickUnits));
    setEl('ob-pick-p1',fmt(p1.pickUnits));setEl('ob-pick-p2',fmt(p2.pickUnits));setEl('ob-pick-p3',fmt(p3.pickUnits));setEl('ob-pick-total',fmt(f.pickUnits));
    setEl('ob-cases-p1',fmt(p1.pickUnits));setEl('ob-cases-p2',fmt(p2.pickUnits));setEl('ob-cases-p3',fmt(p3.pickUnits));setEl('ob-cases-total',fmt(f.pickUnits));
    setEl('ob-rate-p1',fmt(p1.pickRate,1));setEl('ob-rate-p2',fmt(p2.pickRate,1));setEl('ob-rate-p3',fmt(p3.pickRate,1));setEl('ob-rate-total',fmt(f.pickRate,1));
    setEl('ob-loadp-p1',fmt(p1.loadedUnits));setEl('ob-loadp-p2',fmt(p2.loadedUnits));setEl('ob-loadp-p3',fmt(p3.loadedUnits));setEl('ob-loadp-total',fmt(f.loadedUnits));
    setEl('ob-dhrs-p1',fmt(p1.directHours,2));setEl('ob-dhrs-p2',fmt(p2.directHours,2));setEl('ob-dhrs-p3',fmt(p3.directHours,2));setEl('ob-dhrs-total',fmt(f.directHours,2));
    setEl('ob-dpct-p1',fmtPct(p1.directPct));setEl('ob-dpct-p2',fmtPct(p2.directPct));setEl('ob-dpct-p3',fmtPct(p3.directPct));setEl('ob-dpct-total',fmtPct(f.directPct));
    setEl('ob-ihrs-p1',fmt(p1.indirectHours,2));setEl('ob-ihrs-p2',fmt(p2.indirectHours,2));setEl('ob-ihrs-p3',fmt(p3.indirectHours,2));setEl('ob-ihrs-total',fmt(f.indirectHours,2));
    setEl('ob-ipct-p1',fmtPct(p1.indirectPct));setEl('ob-ipct-p2',fmtPct(p2.indirectPct));setEl('ob-ipct-p3',fmtPct(p3.indirectPct));setEl('ob-ipct-total',fmtPct(f.indirectPct));
    setEl('ob-thrs-p1',fmt(p1.totalHours,2));setEl('ob-thrs-p2',fmt(p2.totalHours,2));setEl('ob-thrs-p3',fmt(p3.totalHours,2));setEl('ob-thrs-total',fmt(f.totalHours,2));
    setEl('ob-cplh-p1',fmt(p1.cplh,2));setEl('ob-cplh-p2',fmt(p2.cplh,2));setEl('ob-cplh-p3',fmt(p3.cplh,2));setEl('ob-cplh-total',fmt(f.cplh,2));
    setEl('ob-op-p1',fmtPct(p1.pctToOP));setEl('ob-op-p2',fmtPct(p2.pctToOP));setEl('ob-op-p3',fmtPct(p3.pctToOP));const opEl=setEl('ob-op-total',fmtPct(f.pctToOP));setPctClass(opEl,f.pctToOP||0);
    setEl('ob-dhc-p1',fmt(p1.directHC,1));setEl('ob-dhc-p2',fmt(p2.directHC,1));setEl('ob-dhc-p3',fmt(p3.directHC,1));setEl('ob-dhc-total',fmt(f.directHC,1));
    setEl('ob-ihc-p1',fmt(p1.indirectHC,1));setEl('ob-ihc-p2',fmt(p2.indirectHC,1));setEl('ob-ihc-p3',fmt(p3.indirectHC,1));setEl('ob-ihc-total',fmt(f.indirectHC,1));
    setEl('ob-timestamp',new Date().toLocaleString()+' MST');
}
function renderSort(m){
    const p1=m.sort.p1||{},p2=m.sort.p2||{},p3=m.sort.p3||{},f=m.sort.full||{};
    const sortSec=document.getElementById('sort-section');
    const sortRight=document.getElementById('sort-targets-right');
    const sortCard=document.getElementById('sort-summary-card');
    const hasData=(f.totalUnits>0||f.directHours>0);
    if(sortSec)sortSec.style.display=hasData?'':'none';
    if(sortRight)sortRight.style.display=hasData?'':'none';
    if(sortCard)sortCard.style.display=hasData?'':'none';
    if(!hasData)return;
    setEl('sort-total-p1',fmt(p1.totalUnits));setEl('sort-total-p2',fmt(p2.totalUnits));setEl('sort-total-p3',fmt(p3.totalUnits));setEl('sort-total-total',fmt(f.totalUnits));
    setEl('sort-units-p1',fmt(p1.totalUnits));setEl('sort-units-p2',fmt(p2.totalUnits));setEl('sort-units-p3',fmt(p3.totalUnits));setEl('sort-units-total',fmt(f.totalUnits));
    setEl('sort-rate-p1',fmt(p1.rate,1));setEl('sort-rate-p2',fmt(p2.rate,1));setEl('sort-rate-p3',fmt(p3.rate,1));setEl('sort-rate-total',fmt(f.rate,1));
    setEl('sort-dhrs-p1',fmt(p1.directHours,2));setEl('sort-dhrs-p2',fmt(p2.directHours,2));setEl('sort-dhrs-p3',fmt(p3.directHours,2));setEl('sort-dhrs-total',fmt(f.directHours,2));
    setEl('sort-cplh-p1',fmt(p1.cplh,2));setEl('sort-cplh-p2',fmt(p2.cplh,2));setEl('sort-cplh-p3',fmt(p3.cplh,2));setEl('sort-cplh-total',fmt(f.cplh,2));
}

function updateTargetRows(){
    const config=loadConfig(),periods=config.schedType==='4Q'?4:3;
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    const sortG=parseFloat(document.getElementById('sort-goal')?.value)||0;
    if(ibG>0){const pp=ibG/periods;setEl('ib-target-p1',fmt(Math.round(pp)));setEl('ib-target-p2',fmt(Math.round(pp*2)));setEl('ib-target-p3',fmt(Math.round(ibG)));setEl('ib-target-total',fmt(Math.round(ibG)));}
    if(obG>0){const pp=obG/periods;setEl('ob-target-p1',fmt(Math.round(pp)));setEl('ob-target-p2',fmt(Math.round(pp*2)));setEl('ob-target-p3',fmt(Math.round(obG)));setEl('ob-target-total',fmt(Math.round(obG)));}
    if(sortG>0){const pp=sortG/periods;setEl('sort-target-p1',fmt(Math.round(pp)));setEl('sort-target-p2',fmt(Math.round(pp*2)));setEl('sort-target-p3',fmt(Math.round(sortG)));setEl('sort-target-total',fmt(Math.round(sortG)));}
}
function renderTargets(m){
    const f=m.ib.full||{},ob=m.ob.full||{},sf=m.sort.full||{};
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    const sortG=parseFloat(document.getElementById('sort-goal')?.value)||0;
    const ibRateT=parseFloat(document.getElementById('ib-rate-target')?.value)||0;
    const ibCplhT=parseFloat(document.getElementById('ib-cplh-target')?.value)||0;
    if(ibG>0){const p=(f.totalStow||0)/ibG*100;const el=setEl('ib-goal-pct',fmtPct(p));setPctClass(el,p);}
    if(ibRateT>0&&f.rate){const p=(f.rate/ibRateT)*100;const el=setEl('ib-rate-pct',fmtPct(p));setPctClass(el,p);}
    if(ibCplhT>0&&f.cplh){const p=(f.cplh/ibCplhT)*100;const el=setEl('ib-cplh-pct',fmtPct(p));setPctClass(el,p);}
    if(obG>0){const p=(ob.pickUnits||0)/obG*100;const el=setEl('ob-goal-pct',fmtPct(p));setPctClass(el,p);}
    // Summary cards (hero KPI) with pace-based coloring
    // Color logic: compare actual % vs expected % based on time elapsed in shift
    function getPaceColor(actualPct, config){
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const now=new Date(), cm=now.getHours()*60+now.getMinutes();
        const fullStart=sched.full.sh*60+sched.full.sm;
        const fullEnd=sched.full.eh*60+sched.full.em;
        let shiftDuration, elapsed;
        if(fullEnd>fullStart){shiftDuration=fullEnd-fullStart;elapsed=cm-fullStart;}
        else{shiftDuration=(1440-fullStart)+fullEnd;elapsed=cm>=fullStart?cm-fullStart:(1440-fullStart)+cm;}
        if(elapsed<0)elapsed=0;
        const pctElapsed=(elapsed/shiftDuration)*100;
        // If ahead of pace: green. Within 10% of pace: amber. Behind by >10%: red
        if(actualPct>=pctElapsed)return 'green';
        if(actualPct>=pctElapsed-10)return 'amber';
        return 'red';
    }
    setEl('sum-stow-goal',ibG>0?fmt(ibG):'—');setEl('sum-stow-rate',f.rate?fmt(f.rate,1):'—');setEl('sum-ib-cplh',f.cplh?fmt(f.cplh,2):'—');
    if(ibG>0&&f.totalStow){const p=(f.totalStow/ibG)*100;const el=setEl('sum-ib-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ib-actual',fmt(f.totalStow));setEl('sum-ib-remaining',fmt(ibG-f.totalStow));
        const bar=document.getElementById('ib-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    setEl('sum-pick-goal',obG>0?fmt(obG):'—');setEl('sum-pick-rate',ob.pickRate?fmt(ob.pickRate,1):'—');setEl('sum-ob-cplh',ob.cplh?fmt(ob.cplh,2):'—');
    if(obG>0&&ob.pickUnits){const p=(ob.pickUnits/obG)*100;const el=setEl('sum-ob-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ob-actual',fmt(ob.pickUnits));setEl('sum-ob-remaining',fmt(obG-ob.pickUnits));
        const bar=document.getElementById('ob-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    setEl('sum-sort-goal',sortG>0?fmt(sortG):'—');setEl('sum-sort-rate',sf.rate?fmt(sf.rate,1):'—');setEl('sum-sort-cplh',sf.cplh?fmt(sf.cplh,2):'—');
    if(sortG>0&&sf.totalUnits){const p=(sf.totalUnits/sortG)*100;const el=setEl('sum-sort-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-sort-actual',fmt(sf.totalUnits));setEl('sum-sort-remaining',fmt(sortG-sf.totalUnits));
        const bar=document.getElementById('sort-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    // Pace Insights
    renderPaceInsight('ib-pace-insight',ibG,f.totalStow||0,f.rate||0,f.directHC||0,config);
    renderPaceInsight('ob-pace-insight',obG,ob.pickUnits||0,ob.pickRate||0,ob.directHC||0,config);
}
function renderPaceInsight(elId,goal,actual,rate,hc,config){
    const el=document.getElementById(elId);if(!el)return;
    if(!goal||!actual||!rate||goal<=0){el.textContent='';return;}
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const now=new Date(),cm=now.getHours()*60+now.getMinutes();
    const fullStart=sched.full.sh*60+sched.full.sm,fullEnd=sched.full.eh*60+sched.full.em;
    let shiftDuration,elapsed;
    if(fullEnd>fullStart){shiftDuration=fullEnd-fullStart;elapsed=cm-fullStart;}
    else{shiftDuration=(1440-fullStart)+fullEnd;elapsed=cm>=fullStart?cm-fullStart:(1440-fullStart)+cm;}
    if(elapsed<0)elapsed=0;
    const remaining=(shiftDuration-elapsed)/60; // hours left
    if(remaining<=0){el.innerHTML='<span class="pace-good">\u2713 Shift complete</span>';return;}
    const needed=goal-actual;
    if(needed<=0){el.innerHTML='<span class="pace-good">\u2713 Goal met!</span>';return;}
    const projected=actual+Math.round(rate*hc*remaining);
    const willMake=projected>=goal;
    if(willMake){
        const surplus=projected-goal;
        el.innerHTML=`<span class="pace-good">\u2713 On pace</span> \u2014 projected ${fmt(projected)} (+${fmt(surplus)} over goal)`;
    } else {
        const shortfall=goal-projected;
        const rateNeeded=hc>0?Math.ceil(needed/(hc*remaining)):0;
        const hcNeeded=rate>0?Math.ceil(needed/(rate*remaining)):0;
        const extraHC=hcNeeded>hc?hcNeeded-Math.floor(hc):0;
        el.innerHTML=`<span class="pace-bad">\u26A0 Behind pace</span> \u2014 projected ${fmt(projected)} (${fmt(shortfall)} short). Need <strong>${rateNeeded} UPH</strong> at current HC, or <strong>+${extraHC} HC</strong> at current rate.`;
    }
}
function renderFastStart(fs,config){
    if(!fs)return;const t=config.targets||{};
    const ibST=parseFloat(t['ib-fast-sos'])||13,ibET=parseFloat(t['ib-fast-eol'])||18;
    const obST=parseFloat(t['ob-fast-sos'])||13,obET=parseFloat(t['ob-fast-eol'])||18;
    // P1 = SOS (compared to SOS target), P2 = EOL (compared to EOL target)
    if(fs.ibSOS>0){const el=setEl('ib-fast-p1',fs.ibSOS.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.ibSOS<=ibST?'pct-good':'pct-bad');}
        const pct=(ibST/fs.ibSOS)*100;const pEl=setEl('ib-fast-sos-pct',fs.ibSOS.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.ibSOS<=ibST?'pct-good':'pct-bad');}}
    if(fs.ibEOL>0){const el=setEl('ib-fast-p2',fs.ibEOL.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.ibEOL<=ibET?'pct-good':'pct-bad');}
        const pEl=setEl('ib-fast-eol-pct',fs.ibEOL.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.ibEOL<=ibET?'pct-good':'pct-bad');}}
    if(fs.obSOS>0){const el=setEl('ob-fast-p1',fs.obSOS.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.obSOS<=obST?'pct-good':'pct-bad');}
        const pEl=setEl('ob-fast-sos-pct',fs.obSOS.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.obSOS<=obST?'pct-good':'pct-bad');}}
    if(fs.obEOL>0){const el=setEl('ob-fast-p2',fs.obEOL.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.obEOL<=obET?'pct-good':'pct-bad');}
        const pEl=setEl('ob-fast-eol-pct',fs.obEOL.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.obEOL<=obET?'pct-good':'pct-bad');}}
}

// === CHARTS (combo) ===
let charts={};
function renderCharts(m){
    if(typeof Chart==='undefined')return;
    const labels=['P1','P2','P3'];const config=loadConfig();const periods=config.schedType==='4Q'?4:3;
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    // Determine which periods have started (don't chart future periods)
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const pList=[sched.p1,sched.p2,sched.p3];
    function pStarted(p){return hasPeriodStarted(p,config);}
    function val(v,idx){return pStarted(pList[idx])?v:null;}
    const baseOpts=(yL,y2L)=>({responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#9aa0a6',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#9aa0a6',font:{size:9}},grid:{color:'#363b44'}},y:{ticks:{color:'#9aa0a6',font:{size:9}},grid:{color:'#363b44'},beginAtZero:true,title:{display:!!yL,text:yL||'',color:'#9aa0a6',font:{size:9}}},y2:{position:'right',ticks:{color:'#ffcc00',font:{size:9}},grid:{drawOnChartArea:false},beginAtZero:true,title:{display:!!y2L,text:y2L||'',color:'#ffcc00',font:{size:9}}}}});
    function make(id,data,opts){const ctx=document.getElementById(id);if(!ctx)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(ctx,{type:'bar',data,options:opts});}
    // Stow
    const sp=ibG>0?[Math.round(ibG/periods),Math.round(ibG/periods*2),Math.round(ibG)]:[0,0,0];
    make('chart-stow',{labels,datasets:[{type:'bar',label:'Planned',data:[val(sp[0],0),val(sp[1],1),val(sp[2],2)],backgroundColor:'rgba(158,158,158,0.4)',borderColor:'#9e9e9e',borderWidth:1,yAxisID:'y'},{type:'bar',label:'Actual',data:[val(m.ib.p1?.totalStow||0,0),val(m.ib.p2?.totalStow||0,1),val(m.ib.p3?.totalStow||0,2)],backgroundColor:'rgba(76,175,80,0.6)',borderColor:'#4CAF50',borderWidth:1,yAxisID:'y'},{type:'line',label:'Rate',data:[val(m.ib.p1?.rate||0,0),val(m.ib.p2?.rate||0,1),val(m.ib.p3?.rate||0,2)],borderColor:'#ffcc00',borderWidth:2,pointRadius:4,pointBackgroundColor:'#ffcc00',tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('Stowed','Rate'));
    // CPLH
    make('chart-cplh-ib',{labels,datasets:[{type:'bar',label:'CPLH',data:[val(m.ib.p1?.cplh||0,0),val(m.ib.p2?.cplh||0,1),val(m.ib.p3?.cplh||0,2)],backgroundColor:'rgba(52,199,89,0.7)',borderColor:'#34c759',borderWidth:1,yAxisID:'y'},{type:'line',label:'Direct%',data:[val(m.ib.p1?.directPct||0,0),val(m.ib.p2?.directPct||0,1),val(m.ib.p3?.directPct||0,2)],borderColor:'#2196F3',borderWidth:2,pointRadius:3,tension:.2,yAxisID:'y2',spanGaps:false},{type:'line',label:'Indirect%',data:[val(m.ib.p1?.indirectPct||0,0),val(m.ib.p2?.indirectPct||0,1),val(m.ib.p3?.indirectPct||0,2)],borderColor:'#FF9800',borderWidth:2,pointRadius:3,tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('CPLH','Spend %'));
    // Pick
    const pp=obG>0?[Math.round(obG/periods),Math.round(obG/periods*2),Math.round(obG)]:[0,0,0];
    make('chart-pick',{labels,datasets:[{type:'bar',label:'Planned',data:[val(pp[0],0),val(pp[1],1),val(pp[2],2)],backgroundColor:'rgba(158,158,158,0.4)',borderColor:'#9e9e9e',borderWidth:1,yAxisID:'y'},{type:'bar',label:'Actual',data:[val(m.ob.p1?.pickUnits||0,0),val(m.ob.p2?.pickUnits||0,1),val(m.ob.p3?.pickUnits||0,2)],backgroundColor:'rgba(76,175,80,0.6)',borderColor:'#4CAF50',borderWidth:1,yAxisID:'y'},{type:'line',label:'Rate',data:[val(m.ob.p1?.pickRate||0,0),val(m.ob.p2?.pickRate||0,1),val(m.ob.p3?.pickRate||0,2)],borderColor:'#ffcc00',borderWidth:2,pointRadius:4,pointBackgroundColor:'#ffcc00',tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('Picked','Pick Rate'));
    // Loaded
    make('chart-loaded',{labels,datasets:[{type:'bar',label:'Picked',data:[val(m.ob.p1?.pickUnits||0,0),val(m.ob.p2?.pickUnits||0,1),val(m.ob.p3?.pickUnits||0,2)],backgroundColor:'rgba(255,152,0,0.7)',borderColor:'#FF9800',borderWidth:1},{type:'bar',label:'Loaded',data:[val(m.ob.p1?.loadedUnits||0,0),val(m.ob.p2?.loadedUnits||0,1),val(m.ob.p3?.loadedUnits||0,2)],backgroundColor:'rgba(76,175,80,0.7)',borderColor:'#4CAF50',borderWidth:1}]},baseOpts('Units'));
}

// === ACTIONS ===
function renderActions(){
    const actions=loadActions(),tbody=document.getElementById('actions-body');if(!tbody)return;
    tbody.innerHTML='';
    actions.forEach((a,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input type="text" value="${a.item||''}" data-i="${i}" data-f="item"></td><td><input type="text" value="${a.owner||''}" data-i="${i}" data-f="owner" style="width:100px"></td><td><select data-i="${i}" data-f="status"><option ${a.status==='Open'?'selected':''}>Open</option><option ${a.status==='In Progress'?'selected':''}>In Progress</option><option ${a.status==='Done'?'selected':''}>Done</option></select></td><td><span class="action-delete" data-i="${i}">\u2715</span></td>`;tbody.appendChild(tr);});
    tbody.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{const a=loadActions(),i=+el.dataset.i;if(a[i]){a[i][el.dataset.f]=el.value;saveActions(a);}}));
    tbody.querySelectorAll('.action-delete').forEach(el=>el.addEventListener('click',()=>{const a=loadActions();a.splice(+el.dataset.i,1);saveActions(a);renderActions();}));
}

// === PERIOD DOTS ===
function updatePeriodDots(){
    const config=loadConfig(),sched=config.shiftType==='Nights'?config.nights:config.days;
    const now=new Date(),cm=now.getHours()*60+now.getMinutes();
    function inPeriod(p){
        const s=p.sh*60+p.sm, e=p.eh*60+p.em;
        if(e>s) return cm>=s&&cm<e;
        // Crosses midnight
        return cm>=s||cm<e;
    }
    function pastPeriod(p){
        const e=p.eh*60+p.em;
        if(config.shiftType==='Nights'){
            if(p.eh<12){
                // Period ends in AM: if we're in AM, past if cm>=e; if PM, not past (hasn't ended yet today)
                return cm<720 ? cm>=e : false;
            } else {
                // Period ends in PM: if we're in PM, past if cm>=e; if AM (after midnight), already past
                return cm>=720 ? cm>=e : true;
            }
        }
        return cm>=e;
    }
    ['p1','p2','p3'].forEach((k,i)=>{const el=document.getElementById('dot-'+k);if(!el)return;el.classList.remove('active','completed');const p=[sched.p1,sched.p2,sched.p3][i];if(inPeriod(p))el.classList.add('active');else if(pastPeriod(p))el.classList.add('completed');});
}

// === HTML ===
function buildHTML(){return `
<nav class="topnav"><div class="topnav-left"><span class="logo"><svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="#22262e" stroke="#4a9eff" stroke-width="4"/><path d="M25 65 L25 40 L50 28 L75 40 L75 65 Z" fill="none" stroke="#e8eaed" stroke-width="3" stroke-linejoin="round"/><line x1="25" y1="65" x2="75" y2="65" stroke="#e8eaed" stroke-width="3"/><rect x="30" y="45" width="16" height="20" fill="none" stroke="#e8eaed" stroke-width="2"/><line x1="30" y1="50" x2="46" y2="50" stroke="#e8eaed" stroke-width="1.5"/><line x1="30" y1="55" x2="46" y2="55" stroke="#e8eaed" stroke-width="1.5"/><line x1="30" y1="60" x2="46" y2="60" stroke="#e8eaed" stroke-width="1.5"/><rect x="54" y="48" width="14" height="17" fill="none" stroke="#e8eaed" stroke-width="2"/><rect x="57" y="52" width="4" height="5" fill="#e8eaed"/><rect x="62" y="55" width="3" height="4" fill="#e8eaed"/></svg></span><h1 class="site-title">FC Sync Board</h1>
<div class="nav-tabs"><button class="nav-tab active" data-tab="sync">Sync IB-OB</button><button class="nav-tab" data-tab="support">Support Teams</button><button class="nav-tab" data-tab="settings">Settings</button></div></div>
<div class="topnav-right"><select id="site-select" class="select-input"></select><select id="shift-select" class="select-input"><option value="Days">Days</option><option value="Nights">Nights</option></select>
<div class="period-indicator"><span class="period-dot" id="dot-p1">P1</span><span class="period-dot" id="dot-p2">P2</span><span class="period-dot" id="dot-p3">P3</span></div>
<button id="btn-fetch" class="btn btn-primary">\u25B6 Get Data</button><button id="btn-snip" class="btn btn-snip">\uD83D\uDCF7 Snip</button><button id="btn-exit" class="btn btn-danger">\u2715 Exit</button><span id="last-update" class="meta-text">Ready</span></div></nav>

<main id="tab-sync" class="tab-content active"><div class="sync-layout">
<div class="sync-left">
<section class="metrics-section ib-section"><div class="section-header"><h2>INBOUND | NTP</h2><span class="fclm-timestamp" id="ib-timestamp">\u2014</span></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="ib-target-p1">\u2014</td><td id="ib-target-p2">\u2014</td><td id="ib-target-p3">\u2014</td><td id="ib-target-total">\u2014</td></tr>
<tr class="row-wip"><td>Cage WIP</td><td><input type="number" class="table-input" id="ib-wip-p1" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ib-wip-p2" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ib-wip-p3" placeholder="\u2014"></td><td><span class="wip-eos">EOS</span><input type="number" class="table-input" id="ib-wip-eos" placeholder="\u2014"></td></tr>
<tr class="row-sync"><td class="bold">Sync Metrics</td><td id="ib-sync-p1">0</td><td id="ib-sync-p2">0</td><td id="ib-sync-p3">0</td><td id="ib-sync-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Stow - Total</td><td id="ib-stow-p1">0</td><td id="ib-stow-p2">0</td><td id="ib-stow-p3">0</td><td id="ib-stow-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Cases Stowed</td><td id="ib-cases-p1">0</td><td id="ib-cases-p2">0</td><td id="ib-cases-p3">0</td><td id="ib-cases-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Pallets Stowed</td><td id="ib-pallets-p1">0</td><td id="ib-pallets-p2">0</td><td id="ib-pallets-p3">0</td><td id="ib-pallets-total">0</td></tr>
<tr><td>&nbsp;&nbsp;CTI/PTI per period</td><td id="ib-cti-p1">0</td><td id="ib-cti-p2">0</td><td id="ib-cti-p3">0</td><td id="ib-cti-total">0</td></tr>
<tr class="row-rate"><td>Stow Rate</td><td id="ib-rate-p1">\u2014</td><td id="ib-rate-p2">\u2014</td><td id="ib-rate-p3">\u2014</td><td id="ib-rate-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="ib-dhrs-p1">0</td><td id="ib-dhrs-p2">0</td><td id="ib-dhrs-p3">0</td><td id="ib-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ib-dpct-p1">\u2014</td><td id="ib-dpct-p2">\u2014</td><td id="ib-dpct-p3">\u2014</td><td id="ib-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ib-ihrs-p1">0</td><td id="ib-ihrs-p2">0</td><td id="ib-ihrs-p3">0</td><td id="ib-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ib-ipct-p1">\u2014</td><td id="ib-ipct-p2">\u2014</td><td id="ib-ipct-p3">\u2014</td><td id="ib-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ib-thrs-p1">0</td><td id="ib-thrs-p2">0</td><td id="ib-thrs-p3">0</td><td id="ib-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="ib-cplh-p1">\u2014</td><td id="ib-cplh-p2">\u2014</td><td id="ib-cplh-p3">\u2014</td><td id="ib-cplh-total">\u2014</td></tr>
<tr><td>% to OP</td><td id="ib-op-p1">\u2014</td><td id="ib-op-p2">\u2014</td><td id="ib-op-p3">\u2014</td><td id="ib-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ib-fast-p1">\u2014</td><td id="ib-fast-p2">\u2014</td><td id="ib-fast-p3">\u2014</td><td></td></tr>
<tr class="row-hc"><td>Direct HC</td><td id="ib-dhc-p1">\u2014</td><td id="ib-dhc-p2">\u2014</td><td id="ib-dhc-p3">\u2014</td><td id="ib-dhc-total">\u2014</td></tr>
<tr class="row-hc"><td>Indirect HC</td><td id="ib-ihc-p1">\u2014</td><td id="ib-ihc-p2">\u2014</td><td id="ib-ihc-p3">\u2014</td><td id="ib-ihc-total">\u2014</td></tr>
</tbody></table></section>

<section class="metrics-section ob-section"><div class="section-header"><h2>OUTBOUND | NTP</h2><span class="fclm-timestamp" id="ob-timestamp">\u2014</span></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="ob-target-p1">\u2014</td><td id="ob-target-p2">\u2014</td><td id="ob-target-p3">\u2014</td><td id="ob-target-total">\u2014</td></tr>
<tr class="row-wip"><td>Cage WIP</td><td><input type="number" class="table-input" id="ob-wip-p1" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ob-wip-p2" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ob-wip-p3" placeholder="\u2014"></td><td><span class="wip-eos">EOS</span><input type="number" class="table-input" id="ob-wip-eos" placeholder="\u2014"></td></tr>
<tr class="row-sync"><td class="bold">Sync Metrics</td><td id="ob-sync-p1">0</td><td id="ob-sync-p2">0</td><td id="ob-sync-p3">0</td><td id="ob-sync-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Pick - Total</td><td id="ob-pick-p1">0</td><td id="ob-pick-p2">0</td><td id="ob-pick-p3">0</td><td id="ob-pick-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Cases Picked</td><td id="ob-cases-p1">0</td><td id="ob-cases-p2">0</td><td id="ob-cases-p3">0</td><td id="ob-cases-total">0</td></tr>
<tr class="row-rate"><td>Pick Rate</td><td id="ob-rate-p1">\u2014</td><td id="ob-rate-p2">\u2014</td><td id="ob-rate-p3">\u2014</td><td id="ob-rate-total">\u2014</td></tr>
<tr><td>Loaded per Period</td><td id="ob-loadp-p1">0</td><td id="ob-loadp-p2">0</td><td id="ob-loadp-p3">0</td><td id="ob-loadp-total">0</td></tr>
<tr><td>Direct Hours</td><td id="ob-dhrs-p1">0</td><td id="ob-dhrs-p2">0</td><td id="ob-dhrs-p3">0</td><td id="ob-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ob-dpct-p1">\u2014</td><td id="ob-dpct-p2">\u2014</td><td id="ob-dpct-p3">\u2014</td><td id="ob-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ob-ihrs-p1">0</td><td id="ob-ihrs-p2">0</td><td id="ob-ihrs-p3">0</td><td id="ob-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ob-ipct-p1">\u2014</td><td id="ob-ipct-p2">\u2014</td><td id="ob-ipct-p3">\u2014</td><td id="ob-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ob-thrs-p1">0</td><td id="ob-thrs-p2">0</td><td id="ob-thrs-p3">0</td><td id="ob-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="ob-cplh-p1">\u2014</td><td id="ob-cplh-p2">\u2014</td><td id="ob-cplh-p3">\u2014</td><td id="ob-cplh-total">\u2014</td></tr>
<tr><td>% to OP</td><td id="ob-op-p1">\u2014</td><td id="ob-op-p2">\u2014</td><td id="ob-op-p3">\u2014</td><td id="ob-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ob-fast-p1">\u2014</td><td id="ob-fast-p2">\u2014</td><td id="ob-fast-p3">\u2014</td><td></td></tr>
<tr class="row-hc"><td>Direct HC</td><td id="ob-dhc-p1">\u2014</td><td id="ob-dhc-p2">\u2014</td><td id="ob-dhc-p3">\u2014</td><td id="ob-dhc-total">\u2014</td></tr>
<tr class="row-hc"><td>Indirect HC</td><td id="ob-ihc-p1">\u2014</td><td id="ob-ihc-p2">\u2014</td><td id="ob-ihc-p3">\u2014</td><td id="ob-ihc-total">\u2014</td></tr>
</tbody></table></section>

<section class="metrics-section sort-section" id="sort-section"><div class="section-header"><h2>SORT | NTP</h2></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="sort-target-p1">\u2014</td><td id="sort-target-p2">\u2014</td><td id="sort-target-p3">\u2014</td><td id="sort-target-total">\u2014</td></tr>
<tr class="row-wip"><td>Cage WIP</td><td><input type="number" class="table-input" id="sort-wip-p1" placeholder="\u2014"></td><td><input type="number" class="table-input" id="sort-wip-p2" placeholder="\u2014"></td><td><input type="number" class="table-input" id="sort-wip-p3" placeholder="\u2014"></td><td><span class="wip-eos">EOS</span><input type="number" class="table-input" id="sort-wip-eos" placeholder="\u2014"></td></tr>
<tr><td>Sort - Total</td><td id="sort-total-p1">0</td><td id="sort-total-p2">0</td><td id="sort-total-p3">0</td><td id="sort-total-total">0</td></tr>
<tr><td>Sort (Units)</td><td id="sort-units-p1">0</td><td id="sort-units-p2">0</td><td id="sort-units-p3">0</td><td id="sort-units-total">0</td></tr>
<tr class="row-rate"><td>Sort Rate (UPH)</td><td id="sort-rate-p1">\u2014</td><td id="sort-rate-p2">\u2014</td><td id="sort-rate-p3">\u2014</td><td id="sort-rate-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="sort-dhrs-p1">0</td><td id="sort-dhrs-p2">0</td><td id="sort-dhrs-p3">0</td><td id="sort-dhrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="sort-cplh-p1">\u2014</td><td id="sort-cplh-p2">\u2014</td><td id="sort-cplh-p3">\u2014</td><td id="sort-cplh-total">\u2014</td></tr>
</tbody></table></section>

<section class="metrics-section"><div class="section-header"><h2>SYNC Actions</h2><div><button id="btn-add-action" class="btn btn-small">+ Add</button> <button id="btn-clear-actions" class="btn btn-small btn-danger">Clear</button></div></div>
<table class="actions-table"><thead><tr><th>Action Item</th><th>Owner</th><th>Status</th><th></th></tr></thead><tbody id="actions-body"></tbody></table></section>
</div><!-- sync-left -->

<div class="sync-right">
<div class="goal-summary-col">
<div class="goal-card ib-card"><div class="goal-header"><span class="goal-title">Inbound</span><span class="goal-pct" id="sum-ib-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="ib-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-stow-goal">\u2014</strong></span><span>Actual <strong id="sum-ib-actual">\u2014</strong></span><span>Remaining <strong id="sum-ib-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-stow-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ib-cplh">\u2014</strong> CPLH</span></div><div class="pace-insight" id="ib-pace-insight"></div></div>
<div class="goal-card ob-card"><div class="goal-header"><span class="goal-title">Outbound</span><span class="goal-pct" id="sum-ob-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="ob-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-pick-goal">\u2014</strong></span><span>Actual <strong id="sum-ob-actual">\u2014</strong></span><span>Remaining <strong id="sum-ob-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-pick-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ob-cplh">\u2014</strong> CPLH</span></div><div class="pace-insight" id="ob-pace-insight"></div></div>
<div class="goal-card sort-card" id="sort-summary-card"><div class="goal-header"><span class="goal-title">Sort</span><span class="goal-pct" id="sum-sort-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="sort-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-sort-goal">\u2014</strong></span><span>Actual <strong id="sum-sort-actual">\u2014</strong></span><span>Remaining <strong id="sum-sort-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-sort-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-sort-cplh">\u2014</strong> CPLH</span></div></div>
</div>
<div class="targets-panel"><h3 class="panel-title">Shift Plan Targets</h3>
<div class="target-groups-row">
<div class="tg-compact"><h4>INBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><input type="number" id="ib-bb-goal" class="target-input"></td><td></td></tr>
<tr><td>IB GOAL</td><td><input type="number" id="ib-goal-input" class="target-input"></td><td><span id="ib-goal-pct">\u2014</span></td></tr>
<tr><td>STOW RATE</td><td><input type="number" id="ib-rate-target" class="target-input"></td><td><span id="ib-rate-pct">\u2014</span></td></tr>
<tr><td>IB CPLH</td><td><input type="number" id="ib-cplh-target" class="target-input"></td><td><span id="ib-cplh-pct">\u2014</span></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ib-fast-sos" class="target-input" value="13"></td><td><span id="ib-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ib-fast-eol" class="target-input" value="18"></td><td><span id="ib-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
<div class="tg-compact"><h4>OUTBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><input type="number" id="ob-bb-goal" class="target-input"></td><td></td></tr>
<tr><td>DA GOAL</td><td><input type="number" id="ob-goal-input" class="target-input"></td><td><span id="ob-goal-pct">\u2014</span></td></tr>
<tr><td>PICK RATE</td><td><input type="number" id="ob-rate-target" class="target-input"></td><td></td></tr>
<tr><td>DA CPLH</td><td><input type="number" id="ob-cplh-target" class="target-input"></td><td></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ob-fast-sos" class="target-input" value="13"></td><td><span id="ob-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ob-fast-eol" class="target-input" value="18"></td><td><span id="ob-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
</div>
<div id="sort-targets-right" class="sort-tgt"><h4>SORT</h4><table class="target-table"><tbody>
<tr><td>SORT PRIMARY GOAL</td><td><input type="number" id="sort-goal" class="target-input"></td><td><span id="sort-goal-pct">\u2014</span></td></tr>
<tr><td>SORT RATE (UPH)</td><td><input type="number" id="sort-rate-target" class="target-input"></td><td></td></tr>
</tbody></table></div>
</div>
<div class="charts-panel">
<div class="chart-card"><h3>Stow (Planned vs Actual) + Rate</h3><canvas id="chart-stow" height="170"></canvas></div>
<div class="chart-card"><h3>CPLH + Direct vs Indirect</h3><canvas id="chart-cplh-ib" height="170"></canvas></div>
<div class="chart-card"><h3>Picked (Plan vs Actual) + Rate</h3><canvas id="chart-pick" height="170"></canvas></div>
<div class="chart-card"><h3>Picked vs Loaded</h3><canvas id="chart-loaded" height="170"></canvas></div>
</div>
</div><!-- sync-right -->
</div></main>

<main id="tab-support" class="tab-content"><div class="support-grid">
<div class="support-card safety"><h2>Safety</h2><table class="support-table"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody>
<tr><td>Injury</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="sf-injury-a"></td><td><input type="text" class="support-input" id="sf-injury-q1"></td><td><input type="text" class="support-input" id="sf-injury-q2"></td><td><input type="text" class="support-input" id="sf-injury-q3"></td></tr>
<tr><td>PIT Incident</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="sf-pit-a"></td><td><input type="text" class="support-input" id="sf-pit-q1"></td><td><input type="text" class="support-input" id="sf-pit-q2"></td><td><input type="text" class="support-input" id="sf-pit-q3"></td></tr>
<tr><td>RIBs</td><td><span class="fixed-target">1</span></td><td><input type="text" class="support-input" id="sf-ribs-a"></td><td><input type="text" class="support-input" id="sf-ribs-q1"></td><td><input type="text" class="support-input" id="sf-ribs-q2"></td><td><input type="text" class="support-input" id="sf-ribs-q3"></td></tr>
<tr><td>ARCs</td><td><span class="fixed-target">6</span></td><td><input type="text" class="support-input" id="sf-arcs-a"></td><td><input type="text" class="support-input" id="sf-arcs-q1"></td><td><input type="text" class="support-input" id="sf-arcs-q2"></td><td><input type="text" class="support-input" id="sf-arcs-q3"></td></tr>
<tr><td>Trailer Audits</td><td><span class="fixed-target">3</span></td><td><input type="text" class="support-input" id="sf-audit-a"></td><td><input type="text" class="support-input" id="sf-audit-q1"></td><td><input type="text" class="support-input" id="sf-audit-q2"></td><td><input type="text" class="support-input" id="sf-audit-q3"></td></tr>
<tr><td>Wellness Huddle</td><td><input type="text" class="support-input" id="sf-well-t"></td><td><input type="text" class="support-input" id="sf-well-a"></td><td><input type="text" class="support-input" id="sf-well-q1"></td><td><input type="text" class="support-input" id="sf-well-q2"></td><td><input type="text" class="support-input" id="sf-well-q3"></td></tr>
</tbody></table><div class="callout-section"><h4>Callouts/Notes</h4><textarea id="sf-notes" class="callout-textarea" placeholder="Safety notes..."></textarea></div></div>
<div class="support-card quality"><h2>Quality</h2><table class="support-table"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody>
<tr><td>PS Piles</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-piles-a"></td><td><input type="text" class="support-input" id="q-piles-q1"></td><td><input type="text" class="support-input" id="q-piles-q2"></td><td><input type="text" class="support-input" id="q-piles-q3"></td></tr>
<tr><td>Ship Failed Moves</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-ship-a"></td><td><input type="text" class="support-input" id="q-ship-q1"></td><td><input type="text" class="support-input" id="q-ship-q2"></td><td><input type="text" class="support-input" id="q-ship-q3"></td></tr>
<tr><td>Pick Shorts</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-shorts-a"></td><td><input type="text" class="support-input" id="q-shorts-q1"></td><td><input type="text" class="support-input" id="q-shorts-q2"></td><td><input type="text" class="support-input" id="q-shorts-q3"></td></tr>
<tr><td>Bin Collisions</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-bins-a"></td><td><input type="text" class="support-input" id="q-bins-q1"></td><td><input type="text" class="support-input" id="q-bins-q2"></td><td><input type="text" class="support-input" id="q-bins-q3"></td></tr>
<tr><td>GCAs</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-gcas-a"></td><td><input type="text" class="support-input" id="q-gcas-q1"></td><td><input type="text" class="support-input" id="q-gcas-q2"></td><td><input type="text" class="support-input" id="q-gcas-q3"></td></tr>
<tr><td>Andons</td><td><span class="fixed-target">&lt;50</span></td><td><input type="text" class="support-input" id="q-andons-a"></td><td><input type="text" class="support-input" id="q-andons-q1"></td><td><input type="text" class="support-input" id="q-andons-q2"></td><td><input type="text" class="support-input" id="q-andons-q3"></td></tr>
<tr><td>SBC</td><td><span class="fixed-target">\u2014</span></td><td><input type="text" class="support-input" id="q-sbc-a"></td><td><input type="text" class="support-input" id="q-sbc-q1"></td><td><input type="text" class="support-input" id="q-sbc-q2"></td><td><input type="text" class="support-input" id="q-sbc-q3"></td></tr>
</tbody></table><div class="callout-section"><h4>Callouts/Notes</h4><textarea id="q-notes" class="callout-textarea" placeholder="Quality notes..."></textarea></div></div>
<div class="support-card learning"><h2>Learning</h2><table class="support-table"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody>
<tr><td>Cross-Trainings</td><td><input type="text" class="support-input" id="l-cross-t"></td><td><input type="text" class="support-input" id="l-cross-a"></td><td><input type="text" class="support-input" id="l-cross-q1"></td><td><input type="text" class="support-input" id="l-cross-q2"></td><td><input type="text" class="support-input" id="l-cross-q3"></td></tr>
<tr><td>Retrains</td><td><input type="text" class="support-input" id="l-retrain-t"></td><td><input type="text" class="support-input" id="l-retrain-a"></td><td><input type="text" class="support-input" id="l-retrain-q1"></td><td><input type="text" class="support-input" id="l-retrain-q2"></td><td><input type="text" class="support-input" id="l-retrain-q3"></td></tr>
</tbody></table><div class="callout-section"><h4>Callouts/Notes</h4><textarea id="l-notes" class="callout-textarea" placeholder="Learning notes..."></textarea></div></div>
</div></main>

<main id="tab-settings" class="tab-content"><div class="settings-grid">
<div class="settings-card"><h2>Day Shift Schedule</h2><table class="settings-table"><thead><tr><th>Period</th><th>Start Hr</th><th>Start Min</th><th>End Hr</th><th>End Min</th></tr></thead><tbody>
<tr><td>Full</td><td><input type="number" class="sched-input" id="ds-full-sh"></td><td><input type="number" class="sched-input" id="ds-full-sm"></td><td><input type="number" class="sched-input" id="ds-full-eh"></td><td><input type="number" class="sched-input" id="ds-full-em"></td></tr>
<tr><td>P1</td><td><input type="number" class="sched-input" id="ds-p1-sh"></td><td><input type="number" class="sched-input" id="ds-p1-sm"></td><td><input type="number" class="sched-input" id="ds-p1-eh"></td><td><input type="number" class="sched-input" id="ds-p1-em"></td></tr>
<tr><td>P2</td><td><input type="number" class="sched-input" id="ds-p2-sh"></td><td><input type="number" class="sched-input" id="ds-p2-sm"></td><td><input type="number" class="sched-input" id="ds-p2-eh"></td><td><input type="number" class="sched-input" id="ds-p2-em"></td></tr>
<tr><td>P3</td><td><input type="number" class="sched-input" id="ds-p3-sh"></td><td><input type="number" class="sched-input" id="ds-p3-sm"></td><td><input type="number" class="sched-input" id="ds-p3-eh"></td><td><input type="number" class="sched-input" id="ds-p3-em"></td></tr>
</tbody></table></div>
<div class="settings-card"><h2>Night Shift Schedule</h2><table class="settings-table"><thead><tr><th>Period</th><th>Start Hr</th><th>Start Min</th><th>End Hr</th><th>End Min</th></tr></thead><tbody>
<tr><td>Full</td><td><input type="number" class="sched-input" id="ns-full-sh"></td><td><input type="number" class="sched-input" id="ns-full-sm"></td><td><input type="number" class="sched-input" id="ns-full-eh"></td><td><input type="number" class="sched-input" id="ns-full-em"></td></tr>
<tr><td>P1</td><td><input type="number" class="sched-input" id="ns-p1-sh"></td><td><input type="number" class="sched-input" id="ns-p1-sm"></td><td><input type="number" class="sched-input" id="ns-p1-eh"></td><td><input type="number" class="sched-input" id="ns-p1-em"></td></tr>
<tr><td>P2</td><td><input type="number" class="sched-input" id="ns-p2-sh"></td><td><input type="number" class="sched-input" id="ns-p2-sm"></td><td><input type="number" class="sched-input" id="ns-p2-eh"></td><td><input type="number" class="sched-input" id="ns-p2-em"></td></tr>
<tr><td>P3</td><td><input type="number" class="sched-input" id="ns-p3-sh"></td><td><input type="number" class="sched-input" id="ns-p3-sm"></td><td><input type="number" class="sched-input" id="ns-p3-eh"></td><td><input type="number" class="sched-input" id="ns-p3-em"></td></tr>
</tbody></table></div>
<div class="settings-card"><h2>Config</h2><div class="setting-row"><label>Schedule Type</label><select id="settings-sched-type" class="select-input"><option value="3P">3P</option><option value="4Q">4Q</option></select></div>
<button id="btn-save-settings" class="btn btn-primary">\uD83D\uDCBE Save Settings</button><p class="settings-note">Saved to browser localStorage.</p></div>
</div></main>
`;}

// === CSS ===
function buildCSS(){return `
#sb-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1d23;color:#e8eaed;font-size:13px;line-height:1.4;min-height:100vh;}
.topnav{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:#22262e;border-bottom:1px solid #363b44;position:sticky;top:0;z-index:100;}
.topnav-left{display:flex;align-items:center;gap:14px;}.topnav-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.logo{font-size:20px;display:flex;align-items:center;}.site-title{font-size:15px;font-weight:600;margin:0;white-space:nowrap;}
.nav-tabs{display:flex;gap:4px;}.nav-tab{padding:5px 12px;border:none;background:transparent;color:#9aa0a6;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;}
.nav-tab:hover{background:#2a2f38;color:#e8eaed;}.nav-tab.active{background:#4a9eff;color:#fff;}
.select-input{padding:4px 8px;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;border-radius:5px;font-size:12px;}
.meta-text{font-size:11px;color:#9aa0a6;}
.period-indicator{display:flex;gap:4px;}.period-dot{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#2a2f38;color:#9aa0a6;border:1px solid #363b44;}
.period-dot.active{background:#34c759;color:#000;border-color:#34c759;}.period-dot.completed{background:#4a9eff;color:#fff;border-color:#4a9eff;}
.btn{padding:5px 10px;border:none;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;}.btn-primary{background:#4a9eff;color:#fff;}.btn-primary:hover{background:#3d8be0;}.btn-primary:disabled{opacity:.5;cursor:wait;}
.btn-danger{background:#ff453a;color:#fff;}.btn-small{padding:3px 7px;font-size:11px;}.btn-snip{background:#9c27b0;color:#fff;}.btn-snip:hover{background:#7b1fa2;}
.tab-content{display:none;padding:10px 16px;}.tab-content.active{display:block;}
.sync-layout{display:grid;grid-template-columns:1fr 520px;gap:10px;align-items:start;}
.sync-left{min-width:0;}
.sync-right{position:sticky;top:52px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 60px);overflow-y:auto;overflow-x:hidden;padding-right:4px;}
.targets-panel{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:8px 10px;}
.panel-title{font-size:10px;color:#9aa0a6;margin:0 0 6px;}
.target-groups-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.tg-compact h4{font-size:11px;margin-bottom:4px;color:#2196F3;font-weight:700;}
.tg-compact:last-child h4{color:#FF9800;}
.sort-tgt{margin-top:6px;padding-top:6px;border-top:1px solid #363b44;}
.sort-tgt h4{font-size:11px;color:#FF9800;font-weight:700;margin-bottom:4px;}
.target-table{width:100%;border-collapse:collapse;font-size:10px;}.target-table th{padding:2px 4px;font-size:9px;color:#9aa0a6;text-align:center;border-bottom:1px solid #363b44;}.target-table th:first-child{text-align:left;}
.target-table td{padding:2px 4px;border-bottom:1px solid #363b44;white-space:nowrap;}.target-table td:first-child{font-size:10px;color:#9aa0a6;}
.target-input{width:55px;padding:2px 4px;background:#2a2f38;border:1px solid #363b44;color:#ffcc00;border-radius:3px;font-size:11px;text-align:right;font-weight:600;-moz-appearance:textfield;}
.target-input::-webkit-outer-spin-button,.target-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.goal-summary-col{display:flex;flex-direction:column;gap:8px;}
.goal-card{background:#22262e;border:1px solid #363b44;border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:4px;}
.goal-card.ib-card{border-left:4px solid #2196F3;}
.goal-card.ob-card{border-left:4px solid #FF9800;}
.goal-card.sort-card{border-left:4px solid #555;}
.goal-header{display:flex;justify-content:space-between;align-items:center;}
.goal-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#9aa0a6;}
.goal-pct{font-size:18px;font-weight:700;}
.goal-progress{width:100%;height:6px;background:#363b44;border-radius:3px;overflow:hidden;margin:2px 0;}
.goal-progress-bar{height:100%;border-radius:3px;transition:width 0.3s;}
.goal-progress-bar.green{background:#34c759;}.goal-progress-bar.amber{background:#ffcc00;}.goal-progress-bar.red{background:#ff453a;}
.goal-stats{display:flex;gap:12px;font-size:11px;color:#9aa0a6;flex-wrap:wrap;}
.goal-stats span{white-space:nowrap;}.goal-stats strong{color:#e8eaed;}
.pace-insight{font-size:10px;color:#9aa0a6;margin-top:4px;padding-top:4px;border-top:1px solid #363b44;line-height:1.4;}
.pace-insight .pace-good{color:#34c759;}.pace-insight .pace-warn{color:#ffcc00;}.pace-insight .pace-bad{color:#ff453a;}
.goal-label{font-size:10px;color:#9aa0a6;text-transform:uppercase;}.goal-value{font-size:12px;font-weight:700;text-align:right;}
.charts-panel{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.chart-card{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:10px;}.chart-card h3{font-size:11px;margin-bottom:6px;color:#e8eaed;font-weight:600;}.chart-card canvas{width:100%!important;height:170px!important;}
`;}

function buildCSS2(){return `
.metrics-section{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:14px 18px;margin-bottom:12px;}
.metrics-section.ib-section{border-left:4px solid #2196F3;}
.metrics-section.ob-section{border-left:4px solid #FF9800;}
.metrics-section.sort-section{border-left:4px solid #555;}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}.section-header h2{font-size:13px;font-weight:700;margin:0;}.fclm-timestamp{font-size:11px;color:#9aa0a6;}
.metrics-table{width:100%;border-collapse:collapse;font-size:12px;}.metrics-table th{text-align:center;padding:5px 8px;border-bottom:2px solid #363b44;color:#9aa0a6;font-weight:600;font-size:11px;border-right:1px solid #363b44;}.metrics-table th:first-child{text-align:left;}.metrics-table th:last-child{border-right:none;}
.metrics-table td{padding:4px 8px;text-align:center;border-bottom:1px solid #363b44;border-right:1px solid #363b44;}.metrics-table td:first-child{text-align:left;border-left:none;}.metrics-table td:last-child{border-right:none;}
.metrics-table .bold{font-weight:700;}.row-sync td{background:rgba(74,158,255,0.08);font-weight:700;}.row-cplh td{background:rgba(52,199,89,0.1);font-weight:700;font-size:13px;}
.row-rate td{color:#e8eaed;font-weight:500;}.row-fast td{color:#ff9500;}.row-total td{border-top:2px solid #363b44;}.row-target td{background:rgba(255,204,0,0.08);font-weight:700;}.row-hc td{color:#9aa0a6;font-style:italic;}.row-wip td{font-style:italic;color:#9aa0a6;}
.table-input{width:60px;padding:2px 5px;background:rgba(255,204,0,0.15);border:1px solid rgba(255,204,0,0.4);color:#ffcc00;border-radius:3px;font-size:12px;text-align:center;font-weight:600;-moz-appearance:textfield;}
.table-input::-webkit-outer-spin-button,.table-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.wip-eos{font-size:9px;color:#9aa0a6;margin-right:4px;}
.pct-good{color:#34c759!important;font-weight:700;}.pct-warn{color:#ffcc00!important;font-weight:700;}.pct-bad{color:#ff453a!important;font-weight:700;}
.actions-table{width:100%;border-collapse:collapse;font-size:12px;}.actions-table th{text-align:left;padding:4px 8px;border-bottom:2px solid #363b44;color:#9aa0a6;}.actions-table td{padding:4px 8px;border-bottom:1px solid #363b44;}
.actions-table input{width:100%;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;padding:3px 6px;border-radius:4px;font-size:12px;}
.actions-table select{background:#2a2f38;border:1px solid #363b44;color:#e8eaed;padding:3px 6px;border-radius:4px;font-size:11px;}.action-delete{cursor:pointer;color:#ff453a;font-size:14px;}
.support-grid{display:grid;grid-template-columns:1fr;gap:16px;}.support-card{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:16px;border-left:4px solid #363b44;}
.support-card.safety{border-left-color:#34c759;}.support-card.quality{border-left-color:#ff9500;}.support-card.learning{border-left-color:#4a9eff;}
.support-card h2{font-size:14px;margin-bottom:10px;}.support-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;}
.support-table th{padding:4px 6px;border-bottom:2px solid #363b44;color:#9aa0a6;text-align:center;font-size:11px;}.support-table th:first-child{text-align:left;}
.support-table td{padding:3px 6px;border-bottom:1px solid #363b44;}.support-input{width:55px;padding:2px 5px;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;border-radius:3px;font-size:12px;text-align:center;}
.fixed-target{display:inline-block;width:55px;text-align:center;font-weight:700;color:#34c759;font-size:12px;}
.callout-section{margin-top:8px;}.callout-section h4{font-size:11px;color:#9aa0a6;margin-bottom:4px;}
.callout-textarea{width:100%;min-height:60px;padding:8px;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;border-radius:5px;font-size:12px;resize:vertical;font-family:inherit;}
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}.settings-card{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:16px;}.settings-card h2{font-size:14px;margin-bottom:10px;}
.settings-table{width:100%;border-collapse:collapse;font-size:12px;}.settings-table th{padding:4px 6px;border-bottom:2px solid #363b44;color:#9aa0a6;text-align:center;font-size:11px;}.settings-table th:first-child{text-align:left;}
.settings-table td{padding:4px 6px;text-align:center;}.settings-table td:first-child{text-align:left;font-weight:500;}
.sched-input{width:50px;padding:3px 5px;background:#2a2f38;border:1px solid #363b44;color:#ffcc00;border-radius:4px;font-size:12px;text-align:center;}
.setting-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}.setting-row label{font-size:12px;min-width:100px;}.settings-note{font-size:11px;color:#9aa0a6;margin-top:10px;}
@media(max-width:1100px){.sync-layout{grid-template-columns:1fr;}.sync-right{position:static;max-height:none;}}
`;}

// === BOOT ===
let boardActive=false, currentMetrics=null, config=loadConfig(), originalBody='';

function addLaunchBtn(){
    const b=document.createElement('div');b.id='sb-launch';
    b.innerHTML='\u{1F3ED} Sync Board';
    b.style.cssText='position:fixed;bottom:20px;right:20px;z-index:99999;padding:12px 20px;background:#4a9eff;color:#fff;border-radius:8px;cursor:pointer;font:bold 14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4);';
    b.onclick=launch;document.body.appendChild(b);
}

function launch(){
    if(boardActive)return;boardActive=true;
    document.getElementById('sb-launch').style.display='none';
    originalBody=document.body.innerHTML;
    const style=document.createElement('style');style.textContent=buildCSS()+buildCSS2();document.head.appendChild(style);
    document.body.innerHTML='<div id="sb-root">'+buildHTML()+'</div>';
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';s.onload=()=>{if(currentMetrics)renderCharts(currentMetrics);};document.head.appendChild(s);
    // Load html2canvas for snip feature
    const h2c=document.createElement('script');h2c.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';document.head.appendChild(h2c);
    initBoard();
}

function exitBoard(){document.body.innerHTML=originalBody;boardActive=false;addLaunchBtn();}

function initBoard(){
    config=loadConfig();
    const sel=document.getElementById('site-select');
    SITES.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.appendChild(o);});
    sel.value=config.site;
    document.getElementById('shift-select').value=config.shiftType;
    // Load targets
    const t=config.targets||{};
    ['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target'].forEach(id=>{const el=document.getElementById(id);if(el&&t[id])el.value=t[id];});
    // Load settings
    const ds=config.days,ns=config.nights;
    ['ds-full-sh','ds-full-sm','ds-full-eh','ds-full-em','ds-p1-sh','ds-p1-sm','ds-p1-eh','ds-p1-em','ds-p2-sh','ds-p2-sm','ds-p2-eh','ds-p2-em','ds-p3-sh','ds-p3-sm','ds-p3-eh','ds-p3-em'].forEach((id,i)=>{const vals=[ds.full.sh,ds.full.sm,ds.full.eh,ds.full.em,ds.p1.sh,ds.p1.sm,ds.p1.eh,ds.p1.em,ds.p2.sh,ds.p2.sm,ds.p2.eh,ds.p2.em,ds.p3.sh,ds.p3.sm,ds.p3.eh,ds.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    ['ns-full-sh','ns-full-sm','ns-full-eh','ns-full-em','ns-p1-sh','ns-p1-sm','ns-p1-eh','ns-p1-em','ns-p2-sh','ns-p2-sm','ns-p2-eh','ns-p2-em','ns-p3-sh','ns-p3-sm','ns-p3-eh','ns-p3-em'].forEach((id,i)=>{const vals=[ns.full.sh,ns.full.sm,ns.full.eh,ns.full.em,ns.p1.sh,ns.p1.sm,ns.p1.eh,ns.p1.em,ns.p2.sh,ns.p2.sm,ns.p2.eh,ns.p2.em,ns.p3.sh,ns.p3.sm,ns.p3.eh,ns.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    document.getElementById('settings-sched-type').value=config.schedType||'3P';
    updateTargetRows();
    // Events
    document.getElementById('btn-fetch').onclick=doFetch;
    document.getElementById('btn-exit').onclick=exitBoard;
    document.getElementById('btn-snip').onclick=doSnip;
    document.getElementById('btn-add-action')?.addEventListener('click',()=>{const a=loadActions();a.push({item:'',owner:'',status:'Open'});saveActions(a);renderActions();});
    document.getElementById('btn-clear-actions')?.addEventListener('click',()=>{if(confirm('Clear all actions?')){saveActions([]);renderActions();}});
    document.getElementById('btn-save-settings')?.addEventListener('click',saveSettingsUI);
    sel.onchange=e=>{config.site=e.target.value;if(SITE_SCHEDULES[config.site]){config.days=SITE_SCHEDULES[config.site].days;config.nights=SITE_SCHEDULES[config.site].nights;}saveConfig(config);refreshSettingsInputs();};
    document.getElementById('shift-select').onchange=e=>{config.shiftType=e.target.value;saveConfig(config);};
    document.querySelectorAll('.target-input').forEach(inp=>{inp.addEventListener('input',updateTargetRows);inp.addEventListener('change',()=>{saveTargetsUI();if(currentMetrics)renderTargets(currentMetrics);});});
    document.querySelectorAll('.nav-tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));tab.classList.add('active');const target=document.getElementById('tab-'+tab.dataset.tab);if(target)target.classList.add('active');});
    const sup=loadSupport();Object.keys(sup).forEach(id=>{const el=document.getElementById(id);if(el)el.value=sup[id];});
    document.querySelectorAll('.support-input,.callout-textarea').forEach(el=>el.addEventListener('change',()=>{const d={};document.querySelectorAll('.support-input,.callout-textarea').forEach(e=>{d[e.id]=e.value;});saveSupport(d);}));
    renderActions();updatePeriodDots();setInterval(updatePeriodDots,60000);
}

function refreshSettingsInputs(){
    const ds=config.days,ns=config.nights;
    ['ds-full-sh','ds-full-sm','ds-full-eh','ds-full-em','ds-p1-sh','ds-p1-sm','ds-p1-eh','ds-p1-em','ds-p2-sh','ds-p2-sm','ds-p2-eh','ds-p2-em','ds-p3-sh','ds-p3-sm','ds-p3-eh','ds-p3-em'].forEach((id,i)=>{const vals=[ds.full.sh,ds.full.sm,ds.full.eh,ds.full.em,ds.p1.sh,ds.p1.sm,ds.p1.eh,ds.p1.em,ds.p2.sh,ds.p2.sm,ds.p2.eh,ds.p2.em,ds.p3.sh,ds.p3.sm,ds.p3.eh,ds.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    ['ns-full-sh','ns-full-sm','ns-full-eh','ns-full-em','ns-p1-sh','ns-p1-sm','ns-p1-eh','ns-p1-em','ns-p2-sh','ns-p2-sm','ns-p2-eh','ns-p2-em','ns-p3-sh','ns-p3-sm','ns-p3-eh','ns-p3-em'].forEach((id,i)=>{const vals=[ns.full.sh,ns.full.sm,ns.full.eh,ns.full.em,ns.p1.sh,ns.p1.sm,ns.p1.eh,ns.p1.em,ns.p2.sh,ns.p2.sm,ns.p2.eh,ns.p2.em,ns.p3.sh,ns.p3.sm,ns.p3.eh,ns.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
}

function doSnip(){
    if(typeof html2canvas==='undefined'){alert('Screenshot library still loading. Try again in a moment.');return;}
    const root=document.getElementById('sb-root');
    const btn=document.getElementById('btn-snip');
    btn.textContent='\u23F3 Capturing...';btn.disabled=true;
    // Temporarily remove sticky/scroll constraints so full content is captured
    const rightPanel=root.querySelector('.sync-right');
    const origStyles={};
    if(rightPanel){origStyles.position=rightPanel.style.position;origStyles.maxHeight=rightPanel.style.maxHeight;origStyles.overflow=rightPanel.style.overflow;origStyles.top=rightPanel.style.top;rightPanel.style.position='static';rightPanel.style.maxHeight='none';rightPanel.style.overflow='visible';rightPanel.style.top='auto';}
    // Force colors for html2canvas (doesn't resolve CSS vars well)
    const style=document.createElement('style');style.id='snip-fix';
    style.textContent='#sb-root,#sb-root *{color:#e8eaed !important;}#sb-root .pct-good{color:#34c759 !important;}#sb-root .pct-warn{color:#ffcc00 !important;}#sb-root .pct-bad{color:#ff453a !important;}#sb-root .row-fast td{color:#ff9500 !important;}#sb-root .goal-title{color:#9aa0a6 !important;}#sb-root .goal-stats{color:#9aa0a6 !important;}#sb-root .goal-stats strong{color:#e8eaed !important;}#sb-root .fclm-timestamp{color:#9aa0a6 !important;}#sb-root .meta-text{color:#9aa0a6 !important;}#sb-root .target-input{color:#ffcc00 !important;}#sb-root .table-input{color:#ffcc00 !important;}#sb-root .panel-title{color:#9aa0a6 !important;}#sb-root .tg-compact h4{color:#2196F3 !important;}#sb-root .tg-compact:last-child h4{color:#FF9800 !important;}#sb-root .fixed-target{color:#34c759 !important;}#sb-root .row-hc td{color:#9aa0a6 !important;}#sb-root .section-header h2{color:#e8eaed !important;}#sb-root .metrics-table .bold{color:#e8eaed !important;}#sb-root .nav-tab{color:#9aa0a6 !important;}#sb-root .nav-tab.active{color:#fff !important;}';
    document.head.appendChild(style);
    setTimeout(()=>{
        html2canvas(root,{backgroundColor:'#1a1d23',scale:1,useCORS:true,logging:false,windowHeight:root.scrollHeight,height:root.scrollHeight}).then(canvas=>{
            // Restore styles
            document.head.removeChild(style);
            if(rightPanel){rightPanel.style.position=origStyles.position;rightPanel.style.maxHeight=origStyles.maxHeight;rightPanel.style.overflow=origStyles.overflow;rightPanel.style.top=origStyles.top;}
            canvas.toBlob(blob=>{
                if(navigator.clipboard&&window.ClipboardItem){
                    navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>{
                        btn.textContent='\u2713 Copied!';setTimeout(()=>{btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;},2000);
                    }).catch(()=>{downloadBlob(blob);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;});
                } else {downloadBlob(blob);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;}
            },'image/png');
        }).catch(e=>{document.head.removeChild(style);if(rightPanel){rightPanel.style.position=origStyles.position;rightPanel.style.maxHeight=origStyles.maxHeight;rightPanel.style.overflow=origStyles.overflow;rightPanel.style.top=origStyles.top;}console.error('Snip failed:',e);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;alert('Screenshot failed: '+e.message);});
    },150);
}
function downloadBlob(blob){
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
    a.download='SyncBoard_'+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.png';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

async function doFetch(){
    config=loadConfig();config.site=document.getElementById('site-select').value;config.shiftType=document.getElementById('shift-select').value;saveConfig(config);
    const btn=document.getElementById('btn-fetch');btn.disabled=true;btn.textContent='\u23F3 Fetching...';
    try{
        const raw=await fetchAllData(config);
        currentMetrics=processData(raw);
        renderIB(currentMetrics);renderOB(currentMetrics);renderSort(currentMetrics);
        renderTargets(currentMetrics);renderCharts(currentMetrics);
        renderFastStart(raw.fastStart,config);
        blankFuturePeriods(config);
        // Retry charts if Chart.js wasn't ready yet
        if(typeof Chart==='undefined'){setTimeout(()=>{if(typeof Chart!=='undefined'&&currentMetrics)renderCharts(currentMetrics);},2000);}
    }catch(err){console.error(err);setStatus('\u26A0\uFE0F '+err.message);alert('Fetch failed: '+err.message+'\n\nMake sure you are on Amazon network and authenticated to Midway.');}
    finally{btn.disabled=false;btn.textContent='\u25B6 Get Data';}
}

function saveTargetsUI(){a
    const t={};['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target'].forEach(id=>{t[id]=document.getElementById(id)?.value||'';});
    config.targets=t;saveConfig(config);
}

function saveSettingsUI(){
    config.days={full:{sh:+document.getElementById('ds-full-sh').value,sm:+document.getElementById('ds-full-sm').value,eh:+document.getElementById('ds-full-eh').value,em:+document.getElementById('ds-full-em').value},p1:{sh:+document.getElementById('ds-p1-sh').value,sm:+document.getElementById('ds-p1-sm').value,eh:+document.getElementById('ds-p1-eh').value,em:+document.getElementById('ds-p1-em').value},p2:{sh:+document.getElementById('ds-p2-sh').value,sm:+document.getElementById('ds-p2-sm').value,eh:+document.getElementById('ds-p2-eh').value,em:+document.getElementById('ds-p2-em').value},p3:{sh:+document.getElementById('ds-p3-sh').value,sm:+document.getElementById('ds-p3-sm').value,eh:+document.getElementById('ds-p3-eh').value,em:+document.getElementById('ds-p3-em').value}};
    config.nights={full:{sh:+document.getElementById('ns-full-sh').value,sm:+document.getElementById('ns-full-sm').value,eh:+document.getElementById('ns-full-eh').value,em:+document.getElementById('ns-full-em').value},p1:{sh:+document.getElementById('ns-p1-sh').value,sm:+document.getElementById('ns-p1-sm').value,eh:+document.getElementById('ns-p1-eh').value,em:+document.getElementById('ns-p1-em').value},p2:{sh:+document.getElementById('ns-p2-sh').value,sm:+document.getElementById('ns-p2-sm').value,eh:+document.getElementById('ns-p2-eh').value,em:+document.getElementById('ns-p2-em').value},p3:{sh:+document.getElementById('ns-p3-sh').value,sm:+document.getElementById('ns-p3-sm').value,eh:+document.getElementById('ns-p3-eh').value,em:+document.getElementById('ns-p3-em').value}};
    config.schedType=document.getElementById('settings-sched-type').value;
    saveTargetsUI();saveConfig(config);alert('Settings saved!');
}

addLaunchBtn();
})();
// ==UserScript==
// @name          SDCSyncCopilot.user.js
// @namespace    https://fclm-portal.amazon.com
// @version      3.0.0
// @description  Full shift sync board dashboard on FCLM - IB/OB/Sort metrics, CPLH, Support Teams
// @author       snodgtyl
// @match        https://fclm-portal.amazon.com/*
// @grant        GM_xmlhttpRequest
// @connect      fc-benchmarking.amazon.com
// @run-at       document-idle
// ==/UserScript==

(function() {
'use strict';

// === CONFIG ===
const STORAGE_KEY = 'syncboard_config';
const ACTIONS_KEY = 'syncboard_actions';
const SUPPORT_KEY = 'syncboard_support';
const SITES = ['KRB3','KRB1','KRB2','KRB4','KRB6','ATL7','AVP8','HGR5','QXX6','SAV7'];

const SITE_SCHEDULES = {
    KRB3: { days:{full:{sh:5,sm:45,eh:17,em:30},p1:{sh:6,sm:15,eh:9,em:45},p2:{sh:9,sm:46,eh:13,em:15},p3:{sh:13,sm:45,eh:16,em:45}}, nights:{full:{sh:17,sm:45,eh:5,em:30},p1:{sh:18,sm:15,eh:21,em:45},p2:{sh:21,sm:46,eh:1,em:15},p3:{sh:1,sm:45,eh:4,em:45}} },
    KRB1: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:0,eh:5,em:45},p1:{sh:18,sm:30,eh:22,em:0},p2:{sh:22,sm:1,eh:1,em:30},p3:{sh:1,sm:30,eh:5,em:0}} },
    KRB2: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    KRB4: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:0,eh:5,em:45},p1:{sh:18,sm:30,eh:22,em:0},p2:{sh:22,sm:1,eh:1,em:30},p3:{sh:1,sm:30,eh:5,em:0}} },
    KRB6: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    ATL7: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:17,sm:30,eh:5,em:15},p1:{sh:18,sm:0,eh:21,em:30},p2:{sh:21,sm:31,eh:1,em:0},p3:{sh:1,sm:0,eh:4,em:30}} },
    AVP8: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    HGR5: { days:{full:{sh:5,sm:0,eh:16,em:30},p1:{sh:5,sm:30,eh:9,em:0},p2:{sh:9,sm:1,eh:12,em:30},p3:{sh:12,sm:30,eh:15,em:45}}, nights:{full:{sh:16,sm:0,eh:5,em:45},p1:{sh:16,sm:30,eh:20,em:0},p2:{sh:20,sm:1,eh:23,em:30},p3:{sh:23,sm:30,eh:5,em:0}} },
    QXX6: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
    SAV7: { days:{full:{sh:6,sm:30,eh:18,em:15},p1:{sh:7,sm:0,eh:10,em:30},p2:{sh:10,sm:31,eh:14,em:0},p3:{sh:14,sm:30,eh:17,em:30}}, nights:{full:{sh:18,sm:30,eh:6,em:15},p1:{sh:19,sm:0,eh:22,em:30},p2:{sh:22,sm:31,eh:2,em:0},p3:{sh:2,sm:0,eh:5,em:30}} },
};
const PROCESS_IDS = { stow:'1003035', palletStow:'1003041', pick:'1003065', sort:'1003009', obDock:'1003021' };
const DEFAULT_CONFIG = {
    site:'KRB3', shiftType:'Days', schedType:'3P',
    days:{ full:{sh:5,sm:45,eh:17,em:30}, p1:{sh:6,sm:15,eh:9,em:45}, p2:{sh:9,sm:46,eh:13,em:15}, p3:{sh:13,sm:45,eh:16,em:45} },
    nights:{ full:{sh:17,sm:45,eh:5,em:30}, p1:{sh:18,sm:15,eh:21,em:45}, p2:{sh:21,sm:46,eh:1,em:15}, p3:{sh:1,sm:45,eh:4,em:45} },
    targets:{}
};

function loadConfig(){try{const s=localStorage.getItem(STORAGE_KEY);return s?{...DEFAULT_CONFIG,...JSON.parse(s)}:{...DEFAULT_CONFIG};}catch(e){return{...DEFAULT_CONFIG};}}
function saveConfig(c){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(c));}catch(e){}}
function loadActions(){try{const s=localStorage.getItem(ACTIONS_KEY);return s?JSON.parse(s):[];}catch(e){return[];}}
function saveActions(a){try{localStorage.setItem(ACTIONS_KEY,JSON.stringify(a));}catch(e){}}
function loadSupport(){try{const s=localStorage.getItem(SUPPORT_KEY);return s?JSON.parse(s):{};}catch(e){return{};}}
function saveSupport(d){try{localStorage.setItem(STORAGE_KEY.replace('config','support'),JSON.stringify(d));}catch(e){}}

// === DATE & FETCH HELPERS ===
function fmtDate(d){return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0');}
function getShiftDates(config){
    const now=new Date(), sched=config.shiftType==='Nights'?config.nights:config.days;
    let startDate=new Date(now), endDate=new Date(now);
    startDate.setHours(sched.full.sh,sched.full.sm,0,0);
    if(config.shiftType==='Nights'&&sched.full.eh<sched.full.sh) endDate.setDate(endDate.getDate()+1);
    endDate.setHours(sched.full.eh,sched.full.em,0,0);
    if(config.shiftType==='Nights'&&now.getHours()<12){startDate.setDate(startDate.getDate()-1);endDate.setDate(endDate.getDate()-1);}
    return{startDate,endDate};
}
async function fetchHTML(url){const r=await fetch(url,{credentials:'include'});if(!r.ok)throw new Error('HTTP '+r.status);return r.text();}
function buildFnUrl(site,pid,sd,sh,sm,ed,eh,em){return`/reports/functionRollup?reportFormat=HTML&warehouseId=${site}&processId=${pid}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}`;}
function buildPPRUrl(site,sd,sh,sm,ed,eh,em){return`/reports/processPathRollup?reportFormat=HTML&warehouseId=${site}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}&_adjustPlanHours=on&_hideEmptyLineItems=on&employmentType=AllEmployees`;}

function parseFnRollup(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const tr=doc.querySelector('tfoot tr.total.empl-all')||doc.querySelector('tr.total.empl-all')||doc.querySelector('tfoot tr.total')||doc.querySelector('tfoot tr');
    let units=0,hours=0,rate=0,hc=0;
    if(tr){const cells=tr.querySelectorAll('td.numeric');if(cells.length>=3){hours=parseFloat(cells[0].textContent.replace(/,/g,''))||0;units=parseInt(cells[1].textContent.replace(/,/g,''),10)||0;rate=parseFloat(cells[2].textContent.replace(/,/g,''))||0;}}
    const links=doc.querySelectorAll('a[href*="employeeId="]');const ids=new Set();links.forEach(l=>{const m=l.href.match(/employeeId=([^&]+)/);if(m)ids.add(m[1]);});hc=ids.size;
    // For palletStow: get CASE_UNIT from "Pallet Transfer In" Total row (6th numeric = index 5)
    let palletCases=0;
    const rows=doc.querySelectorAll('tr');let foundPTI=false;
    for(const row of rows){
        if(Array.from(row.querySelectorAll('th,td')).some(c=>/pallet\s*transfer\s*in/i.test(c.textContent.trim())))foundPTI=true;
        if(foundPTI){const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});if(nums.length>=6)palletCases=Math.round(nums[5]);break;}}
    }
    return{totalUnits:units,directHours:hours,rate,headcount:hc,palletCases};
}

function parsePPR(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    let ibPlan=0,ibAct=0,obPlan=0,obAct=0,daTransferHrs=0,daTransferPlan=0,caseStowReserveHrs=0;
    // IB Total
    const ibCB=doc.querySelector('input[value="ppr.detail.inbound.inbound.total"]');
    if(ibCB){const row=ibCB.closest('tr');if(row){const cells=row.querySelectorAll('td');const nums=[];cells.forEach(c=>{const t=c.textContent.trim().replace(/,/g,'');const v=parseFloat(t);if(!isNaN(v)&&t!=='')nums.push(v);});if(nums.length>=2)ibAct=nums[1];if(nums.length>=7&&nums[6]>0)ibPlan=ibAct/(nums[6]/100);else if(nums.length>=10)ibPlan=nums[9];}}
    // Case Stow to Reserve (subtract from IB Total for CPLH)
    const rows=doc.querySelectorAll('tr');
    for(const row of rows){const cells=row.querySelectorAll('td,th');for(let ci=0;ci<cells.length;ci++){const ct=cells[ci].textContent.trim();if(ct==='Case Stow to Reserve'||ct==='Case Stow Reserve'){const hrsCell=row.querySelector('td.actualTimeSeconds');if(hrsCell){const div=hrsCell.querySelector('div.original');const txt=(div?div.textContent:hrsCell.textContent).trim().replace(/,/g,'');caseStowReserveHrs=parseFloat(txt)||0;}break;}}if(caseStowReserveHrs>0)break;}
    // DA Transfer
    for(const row of rows){if(row.textContent.includes('DA Bldg to Bldg Transfer TOTAL')||row.textContent.includes('DA Transfer TOTAL')){const cells=row.querySelectorAll('td');const nums=[];cells.forEach(c=>{const t=c.textContent.trim().replace(/,/g,'');const v=parseFloat(t);if(!isNaN(v)&&t!=='')nums.push(v);});if(nums.length>=2)daTransferHrs=nums[1];if(nums.length>=7&&nums[6]>0)daTransferPlan=daTransferHrs/(nums[6]/100);else if(nums.length>=10)daTransferPlan=nums[9];break;}}
    // OB Total
    const obCB=doc.querySelector('input[value*="outbound.outbound.total"]')||doc.querySelector('input[value*="outbound.total"]');
    if(obCB){const row=obCB.closest('tr');if(row){const cells=row.querySelectorAll('td');const nums=[];cells.forEach(c=>{const t=c.textContent.trim().replace(/,/g,'');const v=parseFloat(t);if(!isNaN(v)&&t!=='')nums.push(v);});if(nums.length>=2)obAct=nums[1];if(nums.length>=7&&nums[6]>0)obPlan=obAct/(nums[6]/100);else if(nums.length>=10)obPlan=nums[9];}}
    return{ibPlannedHrs:ibPlan,ibActualHrs:ibAct,obPlannedHrs:obPlan,obActualHrs:obAct,daTransferHrs,daTransferPlan,caseStowReserveHrs};
}

async function fetchPeriod(site,startDate,sched){
    const sh=sched.sh,sm=sched.sm,eh=sched.eh,em=sched.em;
    let eDate=new Date(startDate);if(eh<sh)eDate.setDate(eDate.getDate()+1);
    const urls={ppr:buildPPRUrl(site,startDate,sh,sm,eDate,eh,em),stow:buildFnUrl(site,PROCESS_IDS.stow,startDate,sh,sm,eDate,eh,em),palletStow:buildFnUrl(site,PROCESS_IDS.palletStow,startDate,sh,sm,eDate,eh,em),pick:buildFnUrl(site,PROCESS_IDS.pick,startDate,sh,sm,eDate,eh,em),sort:buildFnUrl(site,PROCESS_IDS.sort,startDate,sh,sm,eDate,eh,em),obDock:buildFnUrl(site,PROCESS_IDS.obDock,startDate,sh,sm,eDate,eh,em)};
    const res={};
    await Promise.all(Object.entries(urls).map(async([k,u])=>{try{const h=await fetchHTML(u);res[k]=k==='ppr'?parsePPR(h):parseFnRollup(h);}catch(e){console.warn('[SB]',k,e.message);res[k]=k==='ppr'?{ibPlannedHrs:0,ibActualHrs:0,obPlannedHrs:0,obActualHrs:0,daTransferHrs:0,daTransferPlan:0}:{totalUnits:0,directHours:0,rate:0,headcount:0};}}));
    return res;
}

async function fetchAllData(config){
    const site=config.site,sched=config.shiftType==='Nights'?config.nights:config.days,{startDate}=getShiftDates(config);
    setStatus('Fetching Full Shift...');const full=await fetchPeriod(site,startDate,sched.full);
    setStatus('Fetching P1...');const p1=await fetchPeriod(site,startDate,sched.p1);
    setStatus('Fetching P2...');const p2=await fetchPeriod(site,startDate,sched.p2);
    setStatus('Fetching P3...');const p3=await fetchPeriod(site,startDate,sched.p3);
    setStatus('Fetching Fast Start...');const fastStart=await fetchFastStart(site,config.shiftType);
    setStatus('\u2713 Updated '+new Date().toLocaleTimeString());
    return{full,p1,p2,p3,fastStart};
}

function fetchFastStart(site,shiftType){
    return new Promise((resolve)=>{
        // For night shift after midnight, use yesterday's date (shift started yesterday evening)
        const today=new Date();
        if(shiftType==='Nights'&&today.getHours()<12){
            today.setDate(today.getDate()-1);
        }
        const dateStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');
        const url='https://fc-benchmarking.amazon.com/rest/get_fast_start_moves?dateString='+dateStr+'&warehouseId='+site;
        GM_xmlhttpRequest({method:'GET',url,headers:{'Accept':'application/json'},
            onload:function(resp){try{const data=JSON.parse(resp.responseText);if(!data.moves_data||!data.authorized){resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0});return;}let ibSOS=0,ibEOL=0,obSOS=0,obEOL=0;data.moves_data.forEach(proc=>{const isIB=proc.mainProcess==='Inbound';const isOB=proc.mainProcess==='Outbound';if(!proc.segments)return;proc.segments.forEach(seg=>{if(!seg.moves||seg.moves.length===0)return;const durations=seg.moves.map(m=>m.duration||0);const avg=durations.reduce((a,b)=>a+b,0)/durations.length/60000;if(seg.displayName==='Start of Shift'){if(isIB)ibSOS=avg;if(isOB)obSOS=avg;}else if(seg.displayName==='Break 1'){if(isIB)ibEOL=avg;if(isOB)obEOL=avg;}});});resolve({ibSOS,ibEOL,obSOS,obEOL});}catch(e){resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0});}},
            onerror:function(){resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0});}
        });
    });
}

// === DATA PROCESSING (cumulative) ===
function processData(raw){
    const m={ib:{},ob:{},sort:{}};
    const config=loadConfig();
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    // Period durations in hours (for HC calculation)
    function periodHrs(p){let h=p.eh-p.sh;if(h<0)h+=24;return h+(p.em-p.sm)/60;}
    const pDurations={full:periodHrs(sched.full),p1:periodHrs(sched.p1),p2:periodHrs(sched.p2),p3:periodHrs(sched.p3)};

    ['full','p1','p2','p3'].forEach(p=>{
        const d=raw[p];if(!d)return;
        const stow=d.stow||{},pStow=d.palletStow||{},pick=d.pick||{},obDock=d.obDock||{},sort=d.sort||{},ppr=d.ppr||{};
        // IB: total stow = case transfer in (stow units) + pallet transfer in CASE count
        const palletCases=pStow.palletCases||0;
        const ibU=(stow.totalUnits||0)+palletCases;
        const ibPPRHrs=ppr.ibActualHrs||0;
        const caseStowReserve=ppr.caseStowReserveHrs||0;
        const ibDH=stow.directHours||0;
        const ibTotalHrs=ibPPRHrs>0?ibPPRHrs:ibDH;
        const ibIndirect=ibTotalHrs>ibDH?ibTotalHrs-ibDH:0;
        // CPLH uses IB Total minus Case Stow to Reserve (matching Oculus)
        const cplhHrs=ibTotalHrs-caseStowReserve;
        const dur=pDurations[p]||1;
        m.ib[p]={totalStow:ibU,stowUnits:stow.totalUnits||0,palletUnits:pStow.totalUnits||0,palletCases,
            directHours:ibDH,indirectHours:ibIndirect,totalHours:ibTotalHrs,
            directPct:ibTotalHrs>0?(ibDH/ibTotalHrs)*100:0,indirectPct:ibTotalHrs>0?(ibIndirect/ibTotalHrs)*100:0,
            rate:stow.rate||0,headcount:(stow.headcount||0)+(pStow.headcount||0),
            cplh:cplhHrs>0?ibU/cplhHrs:0,
            directHC:dur>0?ibDH/dur:0,indirectHC:dur>0?ibIndirect/dur:0,
            pprPlannedHrs:ppr.ibPlannedHrs||0,pprActualHrs:ibPPRHrs,
            pctToOP:(ppr.ibPlannedHrs||0)>0?(ibPPRHrs/ppr.ibPlannedHrs)*100:0};
        const daHrs=ppr.daTransferHrs||0;
        const obPickDH=pick.directHours||0;
        const obTotalHrs=daHrs>0?daHrs:obPickDH;
        const obIndirect=obTotalHrs>obPickDH?obTotalHrs-obPickDH:0;
        const daPlan=ppr.daTransferPlan||0;
        m.ob[p]={pickUnits:pick.totalUnits||0,loadedUnits:obDock.totalUnits||0,
            directHours:obPickDH,indirectHours:obIndirect,totalHours:obTotalHrs,
            directPct:obTotalHrs>0?(obPickDH/obTotalHrs)*100:0,indirectPct:obTotalHrs>0?(obIndirect/obTotalHrs)*100:0,
            pickRate:pick.rate||0,pickHC:pick.headcount||0,dockHC:obDock.headcount||0,
            cplh:daHrs>0?(obDock.totalUnits||0)/daHrs:(obPickDH>0?(obDock.totalUnits||0)/obPickDH:0),
            directHC:dur>0?obPickDH/dur:0,indirectHC:dur>0?obIndirect/dur:0,
            pprPlannedHrs:daPlan,pprActualHrs:daHrs,
            pctToOP:daPlan>0?(daHrs/daPlan)*100:0};
        m.sort[p]={totalUnits:sort.totalUnits||0,directHours:sort.directHours||0,totalHours:sort.directHours||0,rate:sort.rate||0,headcount:sort.headcount||0,cplh:(sort.directHours||0)>0?sort.totalUnits/sort.directHours:0};
    });
    // Cumulative
    if(m.ib.p1&&m.ib.p2){m.ib.p2.totalStow=(m.ib.p1.totalStow||0)+((raw.p2?.stow?.totalUnits||0)+(raw.p2?.palletStow?.palletCases||0));m.ib.p2.stowUnits=(m.ib.p1.stowUnits||0)+(raw.p2?.stow?.totalUnits||0);m.ib.p2.palletUnits=(m.ib.p1.palletUnits||0)+(raw.p2?.palletStow?.totalUnits||0);m.ib.p2.palletCases=(m.ib.p1.palletCases||0)+(raw.p2?.palletStow?.palletCases||0);m.ob.p2.pickUnits=(m.ob.p1.pickUnits||0)+(raw.p2?.pick?.totalUnits||0);m.ob.p2.loadedUnits=(m.ob.p1.loadedUnits||0)+(raw.p2?.obDock?.totalUnits||0);m.sort.p2.totalUnits=(m.sort.p1.totalUnits||0)+(raw.p2?.sort?.totalUnits||0);}
    if(m.ib.p2&&m.ib.p3){m.ib.p3.totalStow=(m.ib.p2.totalStow||0)+((raw.p3?.stow?.totalUnits||0)+(raw.p3?.palletStow?.palletCases||0));m.ib.p3.stowUnits=(m.ib.p2.stowUnits||0)+(raw.p3?.stow?.totalUnits||0);m.ib.p3.palletUnits=(m.ib.p2.palletUnits||0)+(raw.p3?.palletStow?.totalUnits||0);m.ib.p3.palletCases=(m.ib.p2.palletCases||0)+(raw.p3?.palletStow?.palletCases||0);m.ob.p3.pickUnits=(m.ob.p2.pickUnits||0)+(raw.p3?.pick?.totalUnits||0);m.ob.p3.loadedUnits=(m.ob.p2.loadedUnits||0)+(raw.p3?.obDock?.totalUnits||0);m.sort.p3.totalUnits=(m.sort.p2.totalUnits||0)+(raw.p3?.sort?.totalUnits||0);}
    return m;
}

// === UI HELPERS ===
function fmt(v,d=0){if(v==null||isNaN(v))return'—';return Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}
function fmtPct(v){if(!v||isNaN(v)||v===0)return'—';return v.toFixed(1)+'%';}
function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val;return el;}
function setPctClass(el,pct){if(!el)return;el.classList.remove('pct-good','pct-warn','pct-bad');if(pct>=95)el.classList.add('pct-good');else if(pct>=80)el.classList.add('pct-warn');else if(pct>0)el.classList.add('pct-bad');}
function setStatus(msg){const el=document.getElementById('last-update');if(el)el.textContent=msg;}

// === PERIOD CHECK — blank future periods ===
function hasPeriodStarted(period, config){
    const now=new Date(), cm=now.getHours()*60+now.getMinutes();
    const s=period.sh*60+period.sm;
    if(config.shiftType==='Nights'){
        // Night shift: periods can start before midnight (e.g. P1 18:15) or after (e.g. P3 1:45)
        if(period.sh>=12){
            // Period starts in the PM (before midnight)
            // If we're currently in PM: started if cm >= s
            // If we're currently in AM (past midnight): this period already started yesterday = true
            return cm>=720 ? cm>=s : true;
        } else {
            // Period starts in the AM (after midnight, e.g. 1:45)
            // If we're currently in AM: started if cm >= s
            // If we're currently in PM: hasn't started yet (it's tomorrow's AM)
            return cm<720 ? cm>=s : false;
        }
    }
    return cm>=s;
}
function blankFuturePeriods(config){
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const periods=[sched.p1,sched.p2,sched.p3];
    const keys=['p1','p2','p3'];
    keys.forEach((pk,idx)=>{
        if(!hasPeriodStarted(periods[idx],config)){
            const prefixes=['ib-sync-','ib-stow-','ib-cases-','ib-pallets-','ib-cti-','ib-rate-','ib-dhrs-','ib-dpct-','ib-ihrs-','ib-ipct-','ib-thrs-','ib-cplh-','ib-op-','ib-dhc-','ib-ihc-',
                'ob-sync-','ob-pick-','ob-cases-','ob-rate-','ob-loadp-','ob-dhrs-','ob-dpct-','ob-ihrs-','ob-ipct-','ob-thrs-','ob-cplh-','ob-op-','ob-dhc-','ob-ihc-',
                'sort-total-','sort-units-','sort-rate-','sort-dhrs-','sort-cplh-'];
            prefixes.forEach(pre=>{const el=document.getElementById(pre+pk);if(el)el.textContent='';});
        }
    });
}

// === RENDER ===
function renderIB(m){
    const p1=m.ib.p1||{},p2=m.ib.p2||{},p3=m.ib.p3||{},f=m.ib.full||{};
    setEl('ib-sync-p1',fmt(p1.totalStow));setEl('ib-sync-p2',fmt(p2.totalStow));setEl('ib-sync-p3',fmt(p3.totalStow));setEl('ib-sync-total',fmt(f.totalStow));
    setEl('ib-stow-p1',fmt(p1.totalStow));setEl('ib-stow-p2',fmt(p2.totalStow));setEl('ib-stow-p3',fmt(p3.totalStow));setEl('ib-stow-total',fmt(f.totalStow));
    setEl('ib-cases-p1',fmt(p1.stowUnits));setEl('ib-cases-p2',fmt(p2.stowUnits));setEl('ib-cases-p3',fmt(p3.stowUnits));setEl('ib-cases-total',fmt(f.stowUnits));
    setEl('ib-pallets-p1',fmt(p1.palletUnits||0));setEl('ib-pallets-p2',fmt(p2.palletUnits||0));setEl('ib-pallets-p3',fmt(p3.palletUnits||0));setEl('ib-pallets-total',fmt(f.palletUnits||0));
    setEl('ib-cti-p1',fmt(p1.totalStow));setEl('ib-cti-p2',fmt(p2.totalStow));setEl('ib-cti-p3',fmt(p3.totalStow));setEl('ib-cti-total',fmt(f.totalStow));
    setEl('ib-rate-p1',fmt(p1.rate,1));setEl('ib-rate-p2',fmt(p2.rate,1));setEl('ib-rate-p3',fmt(p3.rate,1));setEl('ib-rate-total',fmt(f.rate,1));
    setEl('ib-dhrs-p1',fmt(p1.directHours,2));setEl('ib-dhrs-p2',fmt(p2.directHours,2));setEl('ib-dhrs-p3',fmt(p3.directHours,2));setEl('ib-dhrs-total',fmt(f.directHours,2));
    setEl('ib-dpct-p1',fmtPct(p1.directPct));setEl('ib-dpct-p2',fmtPct(p2.directPct));setEl('ib-dpct-p3',fmtPct(p3.directPct));setEl('ib-dpct-total',fmtPct(f.directPct));
    setEl('ib-ihrs-p1',fmt(p1.indirectHours,2));setEl('ib-ihrs-p2',fmt(p2.indirectHours,2));setEl('ib-ihrs-p3',fmt(p3.indirectHours,2));setEl('ib-ihrs-total',fmt(f.indirectHours,2));
    setEl('ib-ipct-p1',fmtPct(p1.indirectPct));setEl('ib-ipct-p2',fmtPct(p2.indirectPct));setEl('ib-ipct-p3',fmtPct(p3.indirectPct));setEl('ib-ipct-total',fmtPct(f.indirectPct));
    setEl('ib-thrs-p1',fmt(p1.totalHours,2));setEl('ib-thrs-p2',fmt(p2.totalHours,2));setEl('ib-thrs-p3',fmt(p3.totalHours,2));setEl('ib-thrs-total',fmt(f.totalHours,2));
    setEl('ib-cplh-p1',fmt(p1.cplh,2));setEl('ib-cplh-p2',fmt(p2.cplh,2));setEl('ib-cplh-p3',fmt(p3.cplh,2));setEl('ib-cplh-total',fmt(f.cplh,2));
    setEl('ib-op-p1',fmtPct(p1.pctToOP));setEl('ib-op-p2',fmtPct(p2.pctToOP));setEl('ib-op-p3',fmtPct(p3.pctToOP));const opEl=setEl('ib-op-total',fmtPct(f.pctToOP));setPctClass(opEl,f.pctToOP||0);
    // Direct HC & Indirect HC
    setEl('ib-dhc-p1',fmt(p1.directHC,1));setEl('ib-dhc-p2',fmt(p2.directHC,1));setEl('ib-dhc-p3',fmt(p3.directHC,1));setEl('ib-dhc-total',fmt(f.directHC,1));
    setEl('ib-ihc-p1',fmt(p1.indirectHC,1));setEl('ib-ihc-p2',fmt(p2.indirectHC,1));setEl('ib-ihc-p3',fmt(p3.indirectHC,1));setEl('ib-ihc-total',fmt(f.indirectHC,1));
    setEl('ib-timestamp',new Date().toLocaleString()+' MST');
}
function renderOB(m){
    const p1=m.ob.p1||{},p2=m.ob.p2||{},p3=m.ob.p3||{},f=m.ob.full||{};
    setEl('ob-sync-p1',fmt(p1.pickUnits));setEl('ob-sync-p2',fmt(p2.pickUnits));setEl('ob-sync-p3',fmt(p3.pickUnits));setEl('ob-sync-total',fmt(f.pickUnits));
    setEl('ob-pick-p1',fmt(p1.pickUnits));setEl('ob-pick-p2',fmt(p2.pickUnits));setEl('ob-pick-p3',fmt(p3.pickUnits));setEl('ob-pick-total',fmt(f.pickUnits));
    setEl('ob-cases-p1',fmt(p1.pickUnits));setEl('ob-cases-p2',fmt(p2.pickUnits));setEl('ob-cases-p3',fmt(p3.pickUnits));setEl('ob-cases-total',fmt(f.pickUnits));
    setEl('ob-rate-p1',fmt(p1.pickRate,1));setEl('ob-rate-p2',fmt(p2.pickRate,1));setEl('ob-rate-p3',fmt(p3.pickRate,1));setEl('ob-rate-total',fmt(f.pickRate,1));
    setEl('ob-loadp-p1',fmt(p1.loadedUnits));setEl('ob-loadp-p2',fmt(p2.loadedUnits));setEl('ob-loadp-p3',fmt(p3.loadedUnits));setEl('ob-loadp-total',fmt(f.loadedUnits));
    setEl('ob-dhrs-p1',fmt(p1.directHours,2));setEl('ob-dhrs-p2',fmt(p2.directHours,2));setEl('ob-dhrs-p3',fmt(p3.directHours,2));setEl('ob-dhrs-total',fmt(f.directHours,2));
    setEl('ob-dpct-p1',fmtPct(p1.directPct));setEl('ob-dpct-p2',fmtPct(p2.directPct));setEl('ob-dpct-p3',fmtPct(p3.directPct));setEl('ob-dpct-total',fmtPct(f.directPct));
    setEl('ob-ihrs-p1',fmt(p1.indirectHours,2));setEl('ob-ihrs-p2',fmt(p2.indirectHours,2));setEl('ob-ihrs-p3',fmt(p3.indirectHours,2));setEl('ob-ihrs-total',fmt(f.indirectHours,2));
    setEl('ob-ipct-p1',fmtPct(p1.indirectPct));setEl('ob-ipct-p2',fmtPct(p2.indirectPct));setEl('ob-ipct-p3',fmtPct(p3.indirectPct));setEl('ob-ipct-total',fmtPct(f.indirectPct));
    setEl('ob-thrs-p1',fmt(p1.totalHours,2));setEl('ob-thrs-p2',fmt(p2.totalHours,2));setEl('ob-thrs-p3',fmt(p3.totalHours,2));setEl('ob-thrs-total',fmt(f.totalHours,2));
    setEl('ob-cplh-p1',fmt(p1.cplh,2));setEl('ob-cplh-p2',fmt(p2.cplh,2));setEl('ob-cplh-p3',fmt(p3.cplh,2));setEl('ob-cplh-total',fmt(f.cplh,2));
    setEl('ob-op-p1',fmtPct(p1.pctToOP));setEl('ob-op-p2',fmtPct(p2.pctToOP));setEl('ob-op-p3',fmtPct(p3.pctToOP));const opEl=setEl('ob-op-total',fmtPct(f.pctToOP));setPctClass(opEl,f.pctToOP||0);
    setEl('ob-dhc-p1',fmt(p1.directHC,1));setEl('ob-dhc-p2',fmt(p2.directHC,1));setEl('ob-dhc-p3',fmt(p3.directHC,1));setEl('ob-dhc-total',fmt(f.directHC,1));
    setEl('ob-ihc-p1',fmt(p1.indirectHC,1));setEl('ob-ihc-p2',fmt(p2.indirectHC,1));setEl('ob-ihc-p3',fmt(p3.indirectHC,1));setEl('ob-ihc-total',fmt(f.indirectHC,1));
    setEl('ob-timestamp',new Date().toLocaleString()+' MST');
}
function renderSort(m){
    const p1=m.sort.p1||{},p2=m.sort.p2||{},p3=m.sort.p3||{},f=m.sort.full||{};
    const sortSec=document.getElementById('sort-section');
    const sortRight=document.getElementById('sort-targets-right');
    const sortCard=document.getElementById('sort-summary-card');
    const hasData=(f.totalUnits>0||f.directHours>0);
    if(sortSec)sortSec.style.display=hasData?'':'none';
    if(sortRight)sortRight.style.display=hasData?'':'none';
    if(sortCard)sortCard.style.display=hasData?'':'none';
    if(!hasData)return;
    setEl('sort-total-p1',fmt(p1.totalUnits));setEl('sort-total-p2',fmt(p2.totalUnits));setEl('sort-total-p3',fmt(p3.totalUnits));setEl('sort-total-total',fmt(f.totalUnits));
    setEl('sort-units-p1',fmt(p1.totalUnits));setEl('sort-units-p2',fmt(p2.totalUnits));setEl('sort-units-p3',fmt(p3.totalUnits));setEl('sort-units-total',fmt(f.totalUnits));
    setEl('sort-rate-p1',fmt(p1.rate,1));setEl('sort-rate-p2',fmt(p2.rate,1));setEl('sort-rate-p3',fmt(p3.rate,1));setEl('sort-rate-total',fmt(f.rate,1));
    setEl('sort-dhrs-p1',fmt(p1.directHours,2));setEl('sort-dhrs-p2',fmt(p2.directHours,2));setEl('sort-dhrs-p3',fmt(p3.directHours,2));setEl('sort-dhrs-total',fmt(f.directHours,2));
    setEl('sort-cplh-p1',fmt(p1.cplh,2));setEl('sort-cplh-p2',fmt(p2.cplh,2));setEl('sort-cplh-p3',fmt(p3.cplh,2));setEl('sort-cplh-total',fmt(f.cplh,2));
}

function updateTargetRows(){
    const config=loadConfig(),periods=config.schedType==='4Q'?4:3;
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    const sortG=parseFloat(document.getElementById('sort-goal')?.value)||0;
    if(ibG>0){const pp=ibG/periods;setEl('ib-target-p1',fmt(Math.round(pp)));setEl('ib-target-p2',fmt(Math.round(pp*2)));setEl('ib-target-p3',fmt(Math.round(ibG)));setEl('ib-target-total',fmt(Math.round(ibG)));}
    if(obG>0){const pp=obG/periods;setEl('ob-target-p1',fmt(Math.round(pp)));setEl('ob-target-p2',fmt(Math.round(pp*2)));setEl('ob-target-p3',fmt(Math.round(obG)));setEl('ob-target-total',fmt(Math.round(obG)));}
    if(sortG>0){const pp=sortG/periods;setEl('sort-target-p1',fmt(Math.round(pp)));setEl('sort-target-p2',fmt(Math.round(pp*2)));setEl('sort-target-p3',fmt(Math.round(sortG)));setEl('sort-target-total',fmt(Math.round(sortG)));}
}
function renderTargets(m){
    const f=m.ib.full||{},ob=m.ob.full||{},sf=m.sort.full||{};
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    const sortG=parseFloat(document.getElementById('sort-goal')?.value)||0;
    const ibRateT=parseFloat(document.getElementById('ib-rate-target')?.value)||0;
    const ibCplhT=parseFloat(document.getElementById('ib-cplh-target')?.value)||0;
    if(ibG>0){const p=(f.totalStow||0)/ibG*100;const el=setEl('ib-goal-pct',fmtPct(p));setPctClass(el,p);}
    if(ibRateT>0&&f.rate){const p=(f.rate/ibRateT)*100;const el=setEl('ib-rate-pct',fmtPct(p));setPctClass(el,p);}
    if(ibCplhT>0&&f.cplh){const p=(f.cplh/ibCplhT)*100;const el=setEl('ib-cplh-pct',fmtPct(p));setPctClass(el,p);}
    if(obG>0){const p=(ob.pickUnits||0)/obG*100;const el=setEl('ob-goal-pct',fmtPct(p));setPctClass(el,p);}
    // Summary cards (hero KPI) with pace-based coloring
    // Color logic: compare actual % vs expected % based on time elapsed in shift
    function getPaceColor(actualPct, config){
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const now=new Date(), cm=now.getHours()*60+now.getMinutes();
        const fullStart=sched.full.sh*60+sched.full.sm;
        const fullEnd=sched.full.eh*60+sched.full.em;
        let shiftDuration, elapsed;
        if(fullEnd>fullStart){shiftDuration=fullEnd-fullStart;elapsed=cm-fullStart;}
        else{shiftDuration=(1440-fullStart)+fullEnd;elapsed=cm>=fullStart?cm-fullStart:(1440-fullStart)+cm;}
        if(elapsed<0)elapsed=0;
        const pctElapsed=(elapsed/shiftDuration)*100;
        // If ahead of pace: green. Within 10% of pace: amber. Behind by >10%: red
        if(actualPct>=pctElapsed)return 'green';
        if(actualPct>=pctElapsed-10)return 'amber';
        return 'red';
    }
    setEl('sum-stow-goal',ibG>0?fmt(ibG):'—');setEl('sum-stow-rate',f.rate?fmt(f.rate,1):'—');setEl('sum-ib-cplh',f.cplh?fmt(f.cplh,2):'—');
    if(ibG>0&&f.totalStow){const p=(f.totalStow/ibG)*100;const el=setEl('sum-ib-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ib-actual',fmt(f.totalStow));setEl('sum-ib-remaining',fmt(ibG-f.totalStow));
        const bar=document.getElementById('ib-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    setEl('sum-pick-goal',obG>0?fmt(obG):'—');setEl('sum-pick-rate',ob.pickRate?fmt(ob.pickRate,1):'—');setEl('sum-ob-cplh',ob.cplh?fmt(ob.cplh,2):'—');
    if(obG>0&&ob.pickUnits){const p=(ob.pickUnits/obG)*100;const el=setEl('sum-ob-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ob-actual',fmt(ob.pickUnits));setEl('sum-ob-remaining',fmt(obG-ob.pickUnits));
        const bar=document.getElementById('ob-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    setEl('sum-sort-goal',sortG>0?fmt(sortG):'—');setEl('sum-sort-rate',sf.rate?fmt(sf.rate,1):'—');setEl('sum-sort-cplh',sf.cplh?fmt(sf.cplh,2):'—');
    if(sortG>0&&sf.totalUnits){const p=(sf.totalUnits/sortG)*100;const el=setEl('sum-sort-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-sort-actual',fmt(sf.totalUnits));setEl('sum-sort-remaining',fmt(sortG-sf.totalUnits));
        const bar=document.getElementById('sort-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
}
function renderFastStart(fs,config){
    if(!fs)return;const t=config.targets||{};
    const ibST=parseFloat(t['ib-fast-sos'])||13,ibET=parseFloat(t['ib-fast-eol'])||18;
    const obST=parseFloat(t['ob-fast-sos'])||13,obET=parseFloat(t['ob-fast-eol'])||18;
    // P1 = SOS (compared to SOS target), P2 = EOL (compared to EOL target)
    if(fs.ibSOS>0){const el=setEl('ib-fast-p1',fs.ibSOS.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.ibSOS<=ibST?'pct-good':'pct-bad');}
        const pct=(ibST/fs.ibSOS)*100;const pEl=setEl('ib-fast-sos-pct',fs.ibSOS.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.ibSOS<=ibST?'pct-good':'pct-bad');}}
    if(fs.ibEOL>0){const el=setEl('ib-fast-p2',fs.ibEOL.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.ibEOL<=ibET?'pct-good':'pct-bad');}
        const pEl=setEl('ib-fast-eol-pct',fs.ibEOL.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.ibEOL<=ibET?'pct-good':'pct-bad');}}
    if(fs.obSOS>0){const el=setEl('ob-fast-p1',fs.obSOS.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.obSOS<=obST?'pct-good':'pct-bad');}
        const pEl=setEl('ob-fast-sos-pct',fs.obSOS.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.obSOS<=obST?'pct-good':'pct-bad');}}
    if(fs.obEOL>0){const el=setEl('ob-fast-p2',fs.obEOL.toFixed(1));if(el){el.classList.remove('pct-good','pct-bad');el.classList.add(fs.obEOL<=obET?'pct-good':'pct-bad');}
        const pEl=setEl('ob-fast-eol-pct',fs.obEOL.toFixed(1)+'m');if(pEl){pEl.classList.remove('pct-good','pct-bad');pEl.classList.add(fs.obEOL<=obET?'pct-good':'pct-bad');}}
}

// === CHARTS (combo) ===
let charts={};
function renderCharts(m){
    if(typeof Chart==='undefined')return;
    const labels=['P1','P2','P3'];const config=loadConfig();const periods=config.schedType==='4Q'?4:3;
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    // Determine which periods have started (don't chart future periods)
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const pList=[sched.p1,sched.p2,sched.p3];
    function pStarted(p){return hasPeriodStarted(p,config);}
    function val(v,idx){return pStarted(pList[idx])?v:null;}
    const baseOpts=(yL,y2L)=>({responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:'#9aa0a6',font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:'#9aa0a6',font:{size:9}},grid:{color:'#363b44'}},y:{ticks:{color:'#9aa0a6',font:{size:9}},grid:{color:'#363b44'},beginAtZero:true,title:{display:!!yL,text:yL||'',color:'#9aa0a6',font:{size:9}}},y2:{position:'right',ticks:{color:'#ffcc00',font:{size:9}},grid:{drawOnChartArea:false},beginAtZero:true,title:{display:!!y2L,text:y2L||'',color:'#ffcc00',font:{size:9}}}}});
    function make(id,data,opts){const ctx=document.getElementById(id);if(!ctx)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(ctx,{type:'bar',data,options:opts});}
    // Stow
    const sp=ibG>0?[Math.round(ibG/periods),Math.round(ibG/periods*2),Math.round(ibG)]:[0,0,0];
    make('chart-stow',{labels,datasets:[{type:'bar',label:'Planned',data:[val(sp[0],0),val(sp[1],1),val(sp[2],2)],backgroundColor:'rgba(158,158,158,0.4)',borderColor:'#9e9e9e',borderWidth:1,yAxisID:'y'},{type:'bar',label:'Actual',data:[val(m.ib.p1?.totalStow||0,0),val(m.ib.p2?.totalStow||0,1),val(m.ib.p3?.totalStow||0,2)],backgroundColor:'rgba(76,175,80,0.6)',borderColor:'#4CAF50',borderWidth:1,yAxisID:'y'},{type:'line',label:'Rate',data:[val(m.ib.p1?.rate||0,0),val(m.ib.p2?.rate||0,1),val(m.ib.p3?.rate||0,2)],borderColor:'#ffcc00',borderWidth:2,pointRadius:4,pointBackgroundColor:'#ffcc00',tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('Stowed','Rate'));
    // CPLH
    make('chart-cplh-ib',{labels,datasets:[{type:'bar',label:'CPLH',data:[val(m.ib.p1?.cplh||0,0),val(m.ib.p2?.cplh||0,1),val(m.ib.p3?.cplh||0,2)],backgroundColor:'rgba(52,199,89,0.7)',borderColor:'#34c759',borderWidth:1,yAxisID:'y'},{type:'line',label:'Direct%',data:[val(m.ib.p1?.directPct||0,0),val(m.ib.p2?.directPct||0,1),val(m.ib.p3?.directPct||0,2)],borderColor:'#2196F3',borderWidth:2,pointRadius:3,tension:.2,yAxisID:'y2',spanGaps:false},{type:'line',label:'Indirect%',data:[val(m.ib.p1?.indirectPct||0,0),val(m.ib.p2?.indirectPct||0,1),val(m.ib.p3?.indirectPct||0,2)],borderColor:'#FF9800',borderWidth:2,pointRadius:3,tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('CPLH','Spend %'));
    // Pick
    const pp=obG>0?[Math.round(obG/periods),Math.round(obG/periods*2),Math.round(obG)]:[0,0,0];
    make('chart-pick',{labels,datasets:[{type:'bar',label:'Planned',data:[val(pp[0],0),val(pp[1],1),val(pp[2],2)],backgroundColor:'rgba(158,158,158,0.4)',borderColor:'#9e9e9e',borderWidth:1,yAxisID:'y'},{type:'bar',label:'Actual',data:[val(m.ob.p1?.pickUnits||0,0),val(m.ob.p2?.pickUnits||0,1),val(m.ob.p3?.pickUnits||0,2)],backgroundColor:'rgba(76,175,80,0.6)',borderColor:'#4CAF50',borderWidth:1,yAxisID:'y'},{type:'line',label:'Rate',data:[val(m.ob.p1?.pickRate||0,0),val(m.ob.p2?.pickRate||0,1),val(m.ob.p3?.pickRate||0,2)],borderColor:'#ffcc00',borderWidth:2,pointRadius:4,pointBackgroundColor:'#ffcc00',tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('Picked','Pick Rate'));
    // Loaded
    make('chart-loaded',{labels,datasets:[{type:'bar',label:'Picked',data:[val(m.ob.p1?.pickUnits||0,0),val(m.ob.p2?.pickUnits||0,1),val(m.ob.p3?.pickUnits||0,2)],backgroundColor:'rgba(255,152,0,0.7)',borderColor:'#FF9800',borderWidth:1},{type:'bar',label:'Loaded',data:[val(m.ob.p1?.loadedUnits||0,0),val(m.ob.p2?.loadedUnits||0,1),val(m.ob.p3?.loadedUnits||0,2)],backgroundColor:'rgba(76,175,80,0.7)',borderColor:'#4CAF50',borderWidth:1}]},baseOpts('Units'));
}

// === ACTIONS ===
function renderActions(){
    const actions=loadActions(),tbody=document.getElementById('actions-body');if(!tbody)return;
    tbody.innerHTML='';
    actions.forEach((a,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input type="text" value="${a.item||''}" data-i="${i}" data-f="item"></td><td><input type="text" value="${a.owner||''}" data-i="${i}" data-f="owner" style="width:100px"></td><td><select data-i="${i}" data-f="status"><option ${a.status==='Open'?'selected':''}>Open</option><option ${a.status==='In Progress'?'selected':''}>In Progress</option><option ${a.status==='Done'?'selected':''}>Done</option></select></td><td><span class="action-delete" data-i="${i}">\u2715</span></td>`;tbody.appendChild(tr);});
    tbody.querySelectorAll('input,select').forEach(el=>el.addEventListener('change',()=>{const a=loadActions(),i=+el.dataset.i;if(a[i]){a[i][el.dataset.f]=el.value;saveActions(a);}}));
    tbody.querySelectorAll('.action-delete').forEach(el=>el.addEventListener('click',()=>{const a=loadActions();a.splice(+el.dataset.i,1);saveActions(a);renderActions();}));
}

// === PERIOD DOTS ===
function updatePeriodDots(){
    const config=loadConfig(),sched=config.shiftType==='Nights'?config.nights:config.days;
    const now=new Date(),cm=now.getHours()*60+now.getMinutes();
    function inPeriod(p){
        const s=p.sh*60+p.sm, e=p.eh*60+p.em;
        if(e>s) return cm>=s&&cm<e;
        // Crosses midnight
        return cm>=s||cm<e;
    }
    function pastPeriod(p){
        const e=p.eh*60+p.em;
        if(config.shiftType==='Nights'){
            if(p.eh<12){
                // Period ends in AM: if we're in AM, past if cm>=e; if PM, not past (hasn't ended yet today)
                return cm<720 ? cm>=e : false;
            } else {
                // Period ends in PM: if we're in PM, past if cm>=e; if AM (after midnight), already past
                return cm>=720 ? cm>=e : true;
            }
        }
        return cm>=e;
    }
    ['p1','p2','p3'].forEach((k,i)=>{const el=document.getElementById('dot-'+k);if(!el)return;el.classList.remove('active','completed');const p=[sched.p1,sched.p2,sched.p3][i];if(inPeriod(p))el.classList.add('active');else if(pastPeriod(p))el.classList.add('completed');});
}

// === HTML ===
function buildHTML(){return `
<nav class="topnav"><div class="topnav-left"><span class="logo"><svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="#22262e" stroke="#4a9eff" stroke-width="4"/><path d="M25 65 L25 40 L50 28 L75 40 L75 65 Z" fill="none" stroke="#e8eaed" stroke-width="3" stroke-linejoin="round"/><line x1="25" y1="65" x2="75" y2="65" stroke="#e8eaed" stroke-width="3"/><rect x="30" y="45" width="16" height="20" fill="none" stroke="#e8eaed" stroke-width="2"/><line x1="30" y1="50" x2="46" y2="50" stroke="#e8eaed" stroke-width="1.5"/><line x1="30" y1="55" x2="46" y2="55" stroke="#e8eaed" stroke-width="1.5"/><line x1="30" y1="60" x2="46" y2="60" stroke="#e8eaed" stroke-width="1.5"/><rect x="54" y="48" width="14" height="17" fill="none" stroke="#e8eaed" stroke-width="2"/><rect x="57" y="52" width="4" height="5" fill="#e8eaed"/><rect x="62" y="55" width="3" height="4" fill="#e8eaed"/></svg></span><h1 class="site-title">FC Sync Board</h1>
<div class="nav-tabs"><button class="nav-tab active" data-tab="sync">Sync IB-OB</button><button class="nav-tab" data-tab="support">Support Teams</button><button class="nav-tab" data-tab="settings">Settings</button></div></div>
<div class="topnav-right"><select id="site-select" class="select-input"></select><select id="shift-select" class="select-input"><option value="Days">Days</option><option value="Nights">Nights</option></select>
<div class="period-indicator"><span class="period-dot" id="dot-p1">P1</span><span class="period-dot" id="dot-p2">P2</span><span class="period-dot" id="dot-p3">P3</span></div>
<button id="btn-fetch" class="btn btn-primary">\u25B6 Get Data</button><button id="btn-snip" class="btn btn-snip">\uD83D\uDCF7 Snip</button><button id="btn-exit" class="btn btn-danger">\u2715 Exit</button><span id="last-update" class="meta-text">Ready</span></div></nav>

<main id="tab-sync" class="tab-content active"><div class="sync-layout">
<div class="sync-left">
<section class="metrics-section ib-section"><div class="section-header"><h2>INBOUND | NTP</h2><span class="fclm-timestamp" id="ib-timestamp">\u2014</span></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="ib-target-p1">\u2014</td><td id="ib-target-p2">\u2014</td><td id="ib-target-p3">\u2014</td><td id="ib-target-total">\u2014</td></tr>
<tr class="row-wip"><td>Cage WIP</td><td><input type="number" class="table-input" id="ib-wip-p1" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ib-wip-p2" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ib-wip-p3" placeholder="\u2014"></td><td><span class="wip-eos">EOS</span><input type="number" class="table-input" id="ib-wip-eos" placeholder="\u2014"></td></tr>
<tr class="row-sync"><td class="bold">Sync Metrics</td><td id="ib-sync-p1">0</td><td id="ib-sync-p2">0</td><td id="ib-sync-p3">0</td><td id="ib-sync-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Stow - Total</td><td id="ib-stow-p1">0</td><td id="ib-stow-p2">0</td><td id="ib-stow-p3">0</td><td id="ib-stow-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Cases Stowed</td><td id="ib-cases-p1">0</td><td id="ib-cases-p2">0</td><td id="ib-cases-p3">0</td><td id="ib-cases-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Pallets Stowed</td><td id="ib-pallets-p1">0</td><td id="ib-pallets-p2">0</td><td id="ib-pallets-p3">0</td><td id="ib-pallets-total">0</td></tr>
<tr><td>&nbsp;&nbsp;CTI/PTI per period</td><td id="ib-cti-p1">0</td><td id="ib-cti-p2">0</td><td id="ib-cti-p3">0</td><td id="ib-cti-total">0</td></tr>
<tr class="row-rate"><td>Stow Rate</td><td id="ib-rate-p1">\u2014</td><td id="ib-rate-p2">\u2014</td><td id="ib-rate-p3">\u2014</td><td id="ib-rate-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="ib-dhrs-p1">0</td><td id="ib-dhrs-p2">0</td><td id="ib-dhrs-p3">0</td><td id="ib-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ib-dpct-p1">\u2014</td><td id="ib-dpct-p2">\u2014</td><td id="ib-dpct-p3">\u2014</td><td id="ib-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ib-ihrs-p1">0</td><td id="ib-ihrs-p2">0</td><td id="ib-ihrs-p3">0</td><td id="ib-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ib-ipct-p1">\u2014</td><td id="ib-ipct-p2">\u2014</td><td id="ib-ipct-p3">\u2014</td><td id="ib-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ib-thrs-p1">0</td><td id="ib-thrs-p2">0</td><td id="ib-thrs-p3">0</td><td id="ib-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="ib-cplh-p1">\u2014</td><td id="ib-cplh-p2">\u2014</td><td id="ib-cplh-p3">\u2014</td><td id="ib-cplh-total">\u2014</td></tr>
<tr><td>% to OP</td><td id="ib-op-p1">\u2014</td><td id="ib-op-p2">\u2014</td><td id="ib-op-p3">\u2014</td><td id="ib-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ib-fast-p1">\u2014</td><td id="ib-fast-p2">\u2014</td><td id="ib-fast-p3">\u2014</td><td></td></tr>
<tr class="row-hc"><td>Direct HC</td><td id="ib-dhc-p1">\u2014</td><td id="ib-dhc-p2">\u2014</td><td id="ib-dhc-p3">\u2014</td><td id="ib-dhc-total">\u2014</td></tr>
<tr class="row-hc"><td>Indirect HC</td><td id="ib-ihc-p1">\u2014</td><td id="ib-ihc-p2">\u2014</td><td id="ib-ihc-p3">\u2014</td><td id="ib-ihc-total">\u2014</td></tr>
</tbody></table></section>

<section class="metrics-section ob-section"><div class="section-header"><h2>OUTBOUND | NTP</h2><span class="fclm-timestamp" id="ob-timestamp">\u2014</span></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="ob-target-p1">\u2014</td><td id="ob-target-p2">\u2014</td><td id="ob-target-p3">\u2014</td><td id="ob-target-total">\u2014</td></tr>
<tr class="row-wip"><td>Cage WIP</td><td><input type="number" class="table-input" id="ob-wip-p1" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ob-wip-p2" placeholder="\u2014"></td><td><input type="number" class="table-input" id="ob-wip-p3" placeholder="\u2014"></td><td><span class="wip-eos">EOS</span><input type="number" class="table-input" id="ob-wip-eos" placeholder="\u2014"></td></tr>
<tr class="row-sync"><td class="bold">Sync Metrics</td><td id="ob-sync-p1">0</td><td id="ob-sync-p2">0</td><td id="ob-sync-p3">0</td><td id="ob-sync-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Pick - Total</td><td id="ob-pick-p1">0</td><td id="ob-pick-p2">0</td><td id="ob-pick-p3">0</td><td id="ob-pick-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Cases Picked</td><td id="ob-cases-p1">0</td><td id="ob-cases-p2">0</td><td id="ob-cases-p3">0</td><td id="ob-cases-total">0</td></tr>
<tr class="row-rate"><td>Pick Rate</td><td id="ob-rate-p1">\u2014</td><td id="ob-rate-p2">\u2014</td><td id="ob-rate-p3">\u2014</td><td id="ob-rate-total">\u2014</td></tr>
<tr><td>Loaded per Period</td><td id="ob-loadp-p1">0</td><td id="ob-loadp-p2">0</td><td id="ob-loadp-p3">0</td><td id="ob-loadp-total">0</td></tr>
<tr><td>Direct Hours</td><td id="ob-dhrs-p1">0</td><td id="ob-dhrs-p2">0</td><td id="ob-dhrs-p3">0</td><td id="ob-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ob-dpct-p1">\u2014</td><td id="ob-dpct-p2">\u2014</td><td id="ob-dpct-p3">\u2014</td><td id="ob-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ob-ihrs-p1">0</td><td id="ob-ihrs-p2">0</td><td id="ob-ihrs-p3">0</td><td id="ob-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ob-ipct-p1">\u2014</td><td id="ob-ipct-p2">\u2014</td><td id="ob-ipct-p3">\u2014</td><td id="ob-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ob-thrs-p1">0</td><td id="ob-thrs-p2">0</td><td id="ob-thrs-p3">0</td><td id="ob-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="ob-cplh-p1">\u2014</td><td id="ob-cplh-p2">\u2014</td><td id="ob-cplh-p3">\u2014</td><td id="ob-cplh-total">\u2014</td></tr>
<tr><td>% to OP</td><td id="ob-op-p1">\u2014</td><td id="ob-op-p2">\u2014</td><td id="ob-op-p3">\u2014</td><td id="ob-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ob-fast-p1">\u2014</td><td id="ob-fast-p2">\u2014</td><td id="ob-fast-p3">\u2014</td><td></td></tr>
<tr class="row-hc"><td>Direct HC</td><td id="ob-dhc-p1">\u2014</td><td id="ob-dhc-p2">\u2014</td><td id="ob-dhc-p3">\u2014</td><td id="ob-dhc-total">\u2014</td></tr>
<tr class="row-hc"><td>Indirect HC</td><td id="ob-ihc-p1">\u2014</td><td id="ob-ihc-p2">\u2014</td><td id="ob-ihc-p3">\u2014</td><td id="ob-ihc-total">\u2014</td></tr>
</tbody></table></section>

<section class="metrics-section sort-section" id="sort-section"><div class="section-header"><h2>SORT | NTP</h2></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="sort-target-p1">\u2014</td><td id="sort-target-p2">\u2014</td><td id="sort-target-p3">\u2014</td><td id="sort-target-total">\u2014</td></tr>
<tr class="row-wip"><td>Cage WIP</td><td><input type="number" class="table-input" id="sort-wip-p1" placeholder="\u2014"></td><td><input type="number" class="table-input" id="sort-wip-p2" placeholder="\u2014"></td><td><input type="number" class="table-input" id="sort-wip-p3" placeholder="\u2014"></td><td><span class="wip-eos">EOS</span><input type="number" class="table-input" id="sort-wip-eos" placeholder="\u2014"></td></tr>
<tr><td>Sort - Total</td><td id="sort-total-p1">0</td><td id="sort-total-p2">0</td><td id="sort-total-p3">0</td><td id="sort-total-total">0</td></tr>
<tr><td>Sort (Units)</td><td id="sort-units-p1">0</td><td id="sort-units-p2">0</td><td id="sort-units-p3">0</td><td id="sort-units-total">0</td></tr>
<tr class="row-rate"><td>Sort Rate (UPH)</td><td id="sort-rate-p1">\u2014</td><td id="sort-rate-p2">\u2014</td><td id="sort-rate-p3">\u2014</td><td id="sort-rate-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="sort-dhrs-p1">0</td><td id="sort-dhrs-p2">0</td><td id="sort-dhrs-p3">0</td><td id="sort-dhrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="sort-cplh-p1">\u2014</td><td id="sort-cplh-p2">\u2014</td><td id="sort-cplh-p3">\u2014</td><td id="sort-cplh-total">\u2014</td></tr>
</tbody></table></section>

<section class="metrics-section"><div class="section-header"><h2>SYNC Actions</h2><div><button id="btn-add-action" class="btn btn-small">+ Add</button> <button id="btn-clear-actions" class="btn btn-small btn-danger">Clear</button></div></div>
<table class="actions-table"><thead><tr><th>Action Item</th><th>Owner</th><th>Status</th><th></th></tr></thead><tbody id="actions-body"></tbody></table></section>
</div><!-- sync-left -->

<div class="sync-right">
<div class="goal-summary-col">
<div class="goal-card ib-card"><div class="goal-header"><span class="goal-title">Inbound</span><span class="goal-pct" id="sum-ib-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="ib-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-stow-goal">\u2014</strong></span><span>Actual <strong id="sum-ib-actual">\u2014</strong></span><span>Remaining <strong id="sum-ib-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-stow-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ib-cplh">\u2014</strong> CPLH</span></div></div>
<div class="goal-card ob-card"><div class="goal-header"><span class="goal-title">Outbound</span><span class="goal-pct" id="sum-ob-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="ob-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-pick-goal">\u2014</strong></span><span>Actual <strong id="sum-ob-actual">\u2014</strong></span><span>Remaining <strong id="sum-ob-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-pick-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ob-cplh">\u2014</strong> CPLH</span></div></div>
<div class="goal-card sort-card" id="sort-summary-card"><div class="goal-header"><span class="goal-title">Sort</span><span class="goal-pct" id="sum-sort-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="sort-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-sort-goal">\u2014</strong></span><span>Actual <strong id="sum-sort-actual">\u2014</strong></span><span>Remaining <strong id="sum-sort-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-sort-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-sort-cplh">\u2014</strong> CPLH</span></div></div>
</div>
<div class="targets-panel"><h3 class="panel-title">Shift Plan Targets</h3>
<div class="target-groups-row">
<div class="tg-compact"><h4>INBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><input type="number" id="ib-bb-goal" class="target-input"></td><td></td></tr>
<tr><td>IB GOAL</td><td><input type="number" id="ib-goal-input" class="target-input"></td><td><span id="ib-goal-pct">\u2014</span></td></tr>
<tr><td>STOW RATE</td><td><input type="number" id="ib-rate-target" class="target-input"></td><td><span id="ib-rate-pct">\u2014</span></td></tr>
<tr><td>IB CPLH</td><td><input type="number" id="ib-cplh-target" class="target-input"></td><td><span id="ib-cplh-pct">\u2014</span></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ib-fast-sos" class="target-input" value="13"></td><td><span id="ib-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ib-fast-eol" class="target-input" value="18"></td><td><span id="ib-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
<div class="tg-compact"><h4>OUTBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><input type="number" id="ob-bb-goal" class="target-input"></td><td></td></tr>
<tr><td>DA GOAL</td><td><input type="number" id="ob-goal-input" class="target-input"></td><td><span id="ob-goal-pct">\u2014</span></td></tr>
<tr><td>PICK RATE</td><td><input type="number" id="ob-rate-target" class="target-input"></td><td></td></tr>
<tr><td>DA CPLH</td><td><input type="number" id="ob-cplh-target" class="target-input"></td><td></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ob-fast-sos" class="target-input" value="13"></td><td><span id="ob-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ob-fast-eol" class="target-input" value="18"></td><td><span id="ob-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
</div>
<div id="sort-targets-right" class="sort-tgt"><h4>SORT</h4><table class="target-table"><tbody>
<tr><td>SORT PRIMARY GOAL</td><td><input type="number" id="sort-goal" class="target-input"></td><td><span id="sort-goal-pct">\u2014</span></td></tr>
<tr><td>SORT RATE (UPH)</td><td><input type="number" id="sort-rate-target" class="target-input"></td><td></td></tr>
</tbody></table></div>
</div>
<div class="charts-panel">
<div class="chart-card"><h3>Stow (Planned vs Actual) + Rate</h3><canvas id="chart-stow" height="170"></canvas></div>
<div class="chart-card"><h3>CPLH + Direct vs Indirect</h3><canvas id="chart-cplh-ib" height="170"></canvas></div>
<div class="chart-card"><h3>Picked (Plan vs Actual) + Rate</h3><canvas id="chart-pick" height="170"></canvas></div>
<div class="chart-card"><h3>Picked vs Loaded</h3><canvas id="chart-loaded" height="170"></canvas></div>
</div>
</div><!-- sync-right -->
</div></main>

<main id="tab-support" class="tab-content"><div class="support-grid">
<div class="support-card safety"><h2>Safety</h2><table class="support-table"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody>
<tr><td>Injury</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="sf-injury-a"></td><td><input type="text" class="support-input" id="sf-injury-q1"></td><td><input type="text" class="support-input" id="sf-injury-q2"></td><td><input type="text" class="support-input" id="sf-injury-q3"></td></tr>
<tr><td>PIT Incident</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="sf-pit-a"></td><td><input type="text" class="support-input" id="sf-pit-q1"></td><td><input type="text" class="support-input" id="sf-pit-q2"></td><td><input type="text" class="support-input" id="sf-pit-q3"></td></tr>
<tr><td>RIBs</td><td><span class="fixed-target">1</span></td><td><input type="text" class="support-input" id="sf-ribs-a"></td><td><input type="text" class="support-input" id="sf-ribs-q1"></td><td><input type="text" class="support-input" id="sf-ribs-q2"></td><td><input type="text" class="support-input" id="sf-ribs-q3"></td></tr>
<tr><td>ARCs</td><td><span class="fixed-target">6</span></td><td><input type="text" class="support-input" id="sf-arcs-a"></td><td><input type="text" class="support-input" id="sf-arcs-q1"></td><td><input type="text" class="support-input" id="sf-arcs-q2"></td><td><input type="text" class="support-input" id="sf-arcs-q3"></td></tr>
<tr><td>Trailer Audits</td><td><span class="fixed-target">3</span></td><td><input type="text" class="support-input" id="sf-audit-a"></td><td><input type="text" class="support-input" id="sf-audit-q1"></td><td><input type="text" class="support-input" id="sf-audit-q2"></td><td><input type="text" class="support-input" id="sf-audit-q3"></td></tr>
<tr><td>Wellness Huddle</td><td><input type="text" class="support-input" id="sf-well-t"></td><td><input type="text" class="support-input" id="sf-well-a"></td><td><input type="text" class="support-input" id="sf-well-q1"></td><td><input type="text" class="support-input" id="sf-well-q2"></td><td><input type="text" class="support-input" id="sf-well-q3"></td></tr>
</tbody></table><div class="callout-section"><h4>Callouts/Notes</h4><textarea id="sf-notes" class="callout-textarea" placeholder="Safety notes..."></textarea></div></div>
<div class="support-card quality"><h2>Quality</h2><table class="support-table"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody>
<tr><td>PS Piles</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-piles-a"></td><td><input type="text" class="support-input" id="q-piles-q1"></td><td><input type="text" class="support-input" id="q-piles-q2"></td><td><input type="text" class="support-input" id="q-piles-q3"></td></tr>
<tr><td>Ship Failed Moves</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-ship-a"></td><td><input type="text" class="support-input" id="q-ship-q1"></td><td><input type="text" class="support-input" id="q-ship-q2"></td><td><input type="text" class="support-input" id="q-ship-q3"></td></tr>
<tr><td>Pick Shorts</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-shorts-a"></td><td><input type="text" class="support-input" id="q-shorts-q1"></td><td><input type="text" class="support-input" id="q-shorts-q2"></td><td><input type="text" class="support-input" id="q-shorts-q3"></td></tr>
<tr><td>Bin Collisions</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-bins-a"></td><td><input type="text" class="support-input" id="q-bins-q1"></td><td><input type="text" class="support-input" id="q-bins-q2"></td><td><input type="text" class="support-input" id="q-bins-q3"></td></tr>
<tr><td>GCAs</td><td><span class="fixed-target">0</span></td><td><input type="text" class="support-input" id="q-gcas-a"></td><td><input type="text" class="support-input" id="q-gcas-q1"></td><td><input type="text" class="support-input" id="q-gcas-q2"></td><td><input type="text" class="support-input" id="q-gcas-q3"></td></tr>
<tr><td>Andons</td><td><span class="fixed-target">&lt;50</span></td><td><input type="text" class="support-input" id="q-andons-a"></td><td><input type="text" class="support-input" id="q-andons-q1"></td><td><input type="text" class="support-input" id="q-andons-q2"></td><td><input type="text" class="support-input" id="q-andons-q3"></td></tr>
<tr><td>SBC</td><td><span class="fixed-target">\u2014</span></td><td><input type="text" class="support-input" id="q-sbc-a"></td><td><input type="text" class="support-input" id="q-sbc-q1"></td><td><input type="text" class="support-input" id="q-sbc-q2"></td><td><input type="text" class="support-input" id="q-sbc-q3"></td></tr>
</tbody></table><div class="callout-section"><h4>Callouts/Notes</h4><textarea id="q-notes" class="callout-textarea" placeholder="Quality notes..."></textarea></div></div>
<div class="support-card learning"><h2>Learning</h2><table class="support-table"><thead><tr><th>Metric</th><th>Target</th><th>Actual</th><th>Q1</th><th>Q2</th><th>Q3</th></tr></thead><tbody>
<tr><td>Cross-Trainings</td><td><input type="text" class="support-input" id="l-cross-t"></td><td><input type="text" class="support-input" id="l-cross-a"></td><td><input type="text" class="support-input" id="l-cross-q1"></td><td><input type="text" class="support-input" id="l-cross-q2"></td><td><input type="text" class="support-input" id="l-cross-q3"></td></tr>
<tr><td>Retrains</td><td><input type="text" class="support-input" id="l-retrain-t"></td><td><input type="text" class="support-input" id="l-retrain-a"></td><td><input type="text" class="support-input" id="l-retrain-q1"></td><td><input type="text" class="support-input" id="l-retrain-q2"></td><td><input type="text" class="support-input" id="l-retrain-q3"></td></tr>
</tbody></table><div class="callout-section"><h4>Callouts/Notes</h4><textarea id="l-notes" class="callout-textarea" placeholder="Learning notes..."></textarea></div></div>
</div></main>

<main id="tab-settings" class="tab-content"><div class="settings-grid">
<div class="settings-card"><h2>Day Shift Schedule</h2><table class="settings-table"><thead><tr><th>Period</th><th>Start Hr</th><th>Start Min</th><th>End Hr</th><th>End Min</th></tr></thead><tbody>
<tr><td>Full</td><td><input type="number" class="sched-input" id="ds-full-sh"></td><td><input type="number" class="sched-input" id="ds-full-sm"></td><td><input type="number" class="sched-input" id="ds-full-eh"></td><td><input type="number" class="sched-input" id="ds-full-em"></td></tr>
<tr><td>P1</td><td><input type="number" class="sched-input" id="ds-p1-sh"></td><td><input type="number" class="sched-input" id="ds-p1-sm"></td><td><input type="number" class="sched-input" id="ds-p1-eh"></td><td><input type="number" class="sched-input" id="ds-p1-em"></td></tr>
<tr><td>P2</td><td><input type="number" class="sched-input" id="ds-p2-sh"></td><td><input type="number" class="sched-input" id="ds-p2-sm"></td><td><input type="number" class="sched-input" id="ds-p2-eh"></td><td><input type="number" class="sched-input" id="ds-p2-em"></td></tr>
<tr><td>P3</td><td><input type="number" class="sched-input" id="ds-p3-sh"></td><td><input type="number" class="sched-input" id="ds-p3-sm"></td><td><input type="number" class="sched-input" id="ds-p3-eh"></td><td><input type="number" class="sched-input" id="ds-p3-em"></td></tr>
</tbody></table></div>
<div class="settings-card"><h2>Night Shift Schedule</h2><table class="settings-table"><thead><tr><th>Period</th><th>Start Hr</th><th>Start Min</th><th>End Hr</th><th>End Min</th></tr></thead><tbody>
<tr><td>Full</td><td><input type="number" class="sched-input" id="ns-full-sh"></td><td><input type="number" class="sched-input" id="ns-full-sm"></td><td><input type="number" class="sched-input" id="ns-full-eh"></td><td><input type="number" class="sched-input" id="ns-full-em"></td></tr>
<tr><td>P1</td><td><input type="number" class="sched-input" id="ns-p1-sh"></td><td><input type="number" class="sched-input" id="ns-p1-sm"></td><td><input type="number" class="sched-input" id="ns-p1-eh"></td><td><input type="number" class="sched-input" id="ns-p1-em"></td></tr>
<tr><td>P2</td><td><input type="number" class="sched-input" id="ns-p2-sh"></td><td><input type="number" class="sched-input" id="ns-p2-sm"></td><td><input type="number" class="sched-input" id="ns-p2-eh"></td><td><input type="number" class="sched-input" id="ns-p2-em"></td></tr>
<tr><td>P3</td><td><input type="number" class="sched-input" id="ns-p3-sh"></td><td><input type="number" class="sched-input" id="ns-p3-sm"></td><td><input type="number" class="sched-input" id="ns-p3-eh"></td><td><input type="number" class="sched-input" id="ns-p3-em"></td></tr>
</tbody></table></div>
<div class="settings-card"><h2>Config</h2><div class="setting-row"><label>Schedule Type</label><select id="settings-sched-type" class="select-input"><option value="3P">3P</option><option value="4Q">4Q</option></select></div>
<button id="btn-save-settings" class="btn btn-primary">\uD83D\uDCBE Save Settings</button><p class="settings-note">Saved to browser localStorage.</p></div>
</div></main>
`;}

// === CSS ===
function buildCSS(){return `
#sb-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#1a1d23;color:#e8eaed;font-size:13px;line-height:1.4;min-height:100vh;}
.topnav{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:#22262e;border-bottom:1px solid #363b44;position:sticky;top:0;z-index:100;}
.topnav-left{display:flex;align-items:center;gap:14px;}.topnav-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.logo{font-size:20px;display:flex;align-items:center;}.site-title{font-size:15px;font-weight:600;margin:0;white-space:nowrap;}
.nav-tabs{display:flex;gap:4px;}.nav-tab{padding:5px 12px;border:none;background:transparent;color:#9aa0a6;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;}
.nav-tab:hover{background:#2a2f38;color:#e8eaed;}.nav-tab.active{background:#4a9eff;color:#fff;}
.select-input{padding:4px 8px;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;border-radius:5px;font-size:12px;}
.meta-text{font-size:11px;color:#9aa0a6;}
.period-indicator{display:flex;gap:4px;}.period-dot{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#2a2f38;color:#9aa0a6;border:1px solid #363b44;}
.period-dot.active{background:#34c759;color:#000;border-color:#34c759;}.period-dot.completed{background:#4a9eff;color:#fff;border-color:#4a9eff;}
.btn{padding:5px 10px;border:none;border-radius:5px;font-size:12px;font-weight:500;cursor:pointer;}.btn-primary{background:#4a9eff;color:#fff;}.btn-primary:hover{background:#3d8be0;}.btn-primary:disabled{opacity:.5;cursor:wait;}
.btn-danger{background:#ff453a;color:#fff;}.btn-small{padding:3px 7px;font-size:11px;}.btn-snip{background:#9c27b0;color:#fff;}.btn-snip:hover{background:#7b1fa2;}
.tab-content{display:none;padding:10px 16px;}.tab-content.active{display:block;}
.sync-layout{display:grid;grid-template-columns:1fr 520px;gap:10px;align-items:start;}
.sync-left{min-width:0;}
.sync-right{position:sticky;top:52px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 60px);overflow-y:auto;overflow-x:hidden;padding-right:4px;}
.targets-panel{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:8px 10px;}
.panel-title{font-size:10px;color:#9aa0a6;margin:0 0 6px;}
.target-groups-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.tg-compact h4{font-size:11px;margin-bottom:4px;color:#2196F3;font-weight:700;}
.tg-compact:last-child h4{color:#FF9800;}
.sort-tgt{margin-top:6px;padding-top:6px;border-top:1px solid #363b44;}
.sort-tgt h4{font-size:11px;color:#FF9800;font-weight:700;margin-bottom:4px;}
.target-table{width:100%;border-collapse:collapse;font-size:10px;}.target-table th{padding:2px 4px;font-size:9px;color:#9aa0a6;text-align:center;border-bottom:1px solid #363b44;}.target-table th:first-child{text-align:left;}
.target-table td{padding:2px 4px;border-bottom:1px solid #363b44;white-space:nowrap;}.target-table td:first-child{font-size:10px;color:#9aa0a6;}
.target-input{width:55px;padding:2px 4px;background:#2a2f38;border:1px solid #363b44;color:#ffcc00;border-radius:3px;font-size:11px;text-align:right;font-weight:600;-moz-appearance:textfield;}
.target-input::-webkit-outer-spin-button,.target-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.goal-summary-col{display:flex;flex-direction:column;gap:8px;}
.goal-card{background:#22262e;border:1px solid #363b44;border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:4px;}
.goal-card.ib-card{border-left:4px solid #2196F3;}
.goal-card.ob-card{border-left:4px solid #FF9800;}
.goal-card.sort-card{border-left:4px solid #555;}
.goal-header{display:flex;justify-content:space-between;align-items:center;}
.goal-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#9aa0a6;}
.goal-pct{font-size:18px;font-weight:700;}
.goal-progress{width:100%;height:6px;background:#363b44;border-radius:3px;overflow:hidden;margin:2px 0;}
.goal-progress-bar{height:100%;border-radius:3px;transition:width 0.3s;}
.goal-progress-bar.green{background:#34c759;}.goal-progress-bar.amber{background:#ffcc00;}.goal-progress-bar.red{background:#ff453a;}
.goal-stats{display:flex;gap:12px;font-size:11px;color:#9aa0a6;flex-wrap:wrap;}
.goal-stats span{white-space:nowrap;}.goal-stats strong{color:#e8eaed;}
.goal-label{font-size:10px;color:#9aa0a6;text-transform:uppercase;}.goal-value{font-size:12px;font-weight:700;text-align:right;}
.charts-panel{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.chart-card{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:10px;}.chart-card h3{font-size:11px;margin-bottom:6px;color:#e8eaed;font-weight:600;}.chart-card canvas{width:100%!important;height:170px!important;}
`;}

function buildCSS2(){return `
.metrics-section{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:14px 18px;margin-bottom:12px;}
.metrics-section.ib-section{border-left:4px solid #2196F3;}
.metrics-section.ob-section{border-left:4px solid #FF9800;}
.metrics-section.sort-section{border-left:4px solid #555;}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}.section-header h2{font-size:13px;font-weight:700;margin:0;}.fclm-timestamp{font-size:11px;color:#9aa0a6;}
.metrics-table{width:100%;border-collapse:collapse;font-size:12px;}.metrics-table th{text-align:center;padding:5px 8px;border-bottom:2px solid #363b44;color:#9aa0a6;font-weight:600;font-size:11px;border-right:1px solid #363b44;}.metrics-table th:first-child{text-align:left;}.metrics-table th:last-child{border-right:none;}
.metrics-table td{padding:4px 8px;text-align:center;border-bottom:1px solid #363b44;border-right:1px solid #363b44;}.metrics-table td:first-child{text-align:left;border-left:none;}.metrics-table td:last-child{border-right:none;}
.metrics-table .bold{font-weight:700;}.row-sync td{background:rgba(74,158,255,0.08);font-weight:700;}.row-cplh td{background:rgba(52,199,89,0.1);font-weight:700;font-size:13px;}
.row-rate td{color:#e8eaed;font-weight:500;}.row-fast td{color:#ff9500;}.row-total td{border-top:2px solid #363b44;}.row-target td{background:rgba(255,204,0,0.08);font-weight:700;}.row-hc td{color:#9aa0a6;font-style:italic;}.row-wip td{font-style:italic;color:#9aa0a6;}
.table-input{width:60px;padding:2px 5px;background:rgba(255,204,0,0.15);border:1px solid rgba(255,204,0,0.4);color:#ffcc00;border-radius:3px;font-size:12px;text-align:center;font-weight:600;-moz-appearance:textfield;}
.table-input::-webkit-outer-spin-button,.table-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.wip-eos{font-size:9px;color:#9aa0a6;margin-right:4px;}
.pct-good{color:#34c759!important;font-weight:700;}.pct-warn{color:#ffcc00!important;font-weight:700;}.pct-bad{color:#ff453a!important;font-weight:700;}
.actions-table{width:100%;border-collapse:collapse;font-size:12px;}.actions-table th{text-align:left;padding:4px 8px;border-bottom:2px solid #363b44;color:#9aa0a6;}.actions-table td{padding:4px 8px;border-bottom:1px solid #363b44;}
.actions-table input{width:100%;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;padding:3px 6px;border-radius:4px;font-size:12px;}
.actions-table select{background:#2a2f38;border:1px solid #363b44;color:#e8eaed;padding:3px 6px;border-radius:4px;font-size:11px;}.action-delete{cursor:pointer;color:#ff453a;font-size:14px;}
.support-grid{display:grid;grid-template-columns:1fr;gap:16px;}.support-card{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:16px;border-left:4px solid #363b44;}
.support-card.safety{border-left-color:#34c759;}.support-card.quality{border-left-color:#ff9500;}.support-card.learning{border-left-color:#4a9eff;}
.support-card h2{font-size:14px;margin-bottom:10px;}.support-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;}
.support-table th{padding:4px 6px;border-bottom:2px solid #363b44;color:#9aa0a6;text-align:center;font-size:11px;}.support-table th:first-child{text-align:left;}
.support-table td{padding:3px 6px;border-bottom:1px solid #363b44;}.support-input{width:55px;padding:2px 5px;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;border-radius:3px;font-size:12px;text-align:center;}
.fixed-target{display:inline-block;width:55px;text-align:center;font-weight:700;color:#34c759;font-size:12px;}
.callout-section{margin-top:8px;}.callout-section h4{font-size:11px;color:#9aa0a6;margin-bottom:4px;}
.callout-textarea{width:100%;min-height:60px;padding:8px;background:#2a2f38;border:1px solid #363b44;color:#e8eaed;border-radius:5px;font-size:12px;resize:vertical;font-family:inherit;}
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}.settings-card{background:#22262e;border-radius:8px;border:1px solid #363b44;padding:16px;}.settings-card h2{font-size:14px;margin-bottom:10px;}
.settings-table{width:100%;border-collapse:collapse;font-size:12px;}.settings-table th{padding:4px 6px;border-bottom:2px solid #363b44;color:#9aa0a6;text-align:center;font-size:11px;}.settings-table th:first-child{text-align:left;}
.settings-table td{padding:4px 6px;text-align:center;}.settings-table td:first-child{text-align:left;font-weight:500;}
.sched-input{width:50px;padding:3px 5px;background:#2a2f38;border:1px solid #363b44;color:#ffcc00;border-radius:4px;font-size:12px;text-align:center;}
.setting-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}.setting-row label{font-size:12px;min-width:100px;}.settings-note{font-size:11px;color:#9aa0a6;margin-top:10px;}
@media(max-width:1100px){.sync-layout{grid-template-columns:1fr;}.sync-right{position:static;max-height:none;}}
`;}

// === BOOT ===
let boardActive=false, currentMetrics=null, config=loadConfig(), originalBody='';

function addLaunchBtn(){
    const b=document.createElement('div');b.id='sb-launch';
    b.innerHTML='\u{1F3ED} Sync Board';
    b.style.cssText='position:fixed;bottom:20px;right:20px;z-index:99999;padding:12px 20px;background:#4a9eff;color:#fff;border-radius:8px;cursor:pointer;font:bold 14px sans-serif;box-shadow:0 4px 12px rgba(0,0,0,.4);';
    b.onclick=launch;document.body.appendChild(b);
}

function launch(){
    if(boardActive)return;boardActive=true;
    document.getElementById('sb-launch').style.display='none';
    originalBody=document.body.innerHTML;
    const style=document.createElement('style');style.textContent=buildCSS()+buildCSS2();document.head.appendChild(style);
    document.body.innerHTML='<div id="sb-root">'+buildHTML()+'</div>';
    const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';s.onload=()=>{if(currentMetrics)renderCharts(currentMetrics);};document.head.appendChild(s);
    // Load html2canvas for snip feature
    const h2c=document.createElement('script');h2c.src='https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';document.head.appendChild(h2c);
    initBoard();
}

function exitBoard(){document.body.innerHTML=originalBody;boardActive=false;addLaunchBtn();}

function initBoard(){
    config=loadConfig();
    const sel=document.getElementById('site-select');
    SITES.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.appendChild(o);});
    sel.value=config.site;
    document.getElementById('shift-select').value=config.shiftType;
    // Load targets
    const t=config.targets||{};
    ['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target'].forEach(id=>{const el=document.getElementById(id);if(el&&t[id])el.value=t[id];});
    // Load settings
    const ds=config.days,ns=config.nights;
    ['ds-full-sh','ds-full-sm','ds-full-eh','ds-full-em','ds-p1-sh','ds-p1-sm','ds-p1-eh','ds-p1-em','ds-p2-sh','ds-p2-sm','ds-p2-eh','ds-p2-em','ds-p3-sh','ds-p3-sm','ds-p3-eh','ds-p3-em'].forEach((id,i)=>{const vals=[ds.full.sh,ds.full.sm,ds.full.eh,ds.full.em,ds.p1.sh,ds.p1.sm,ds.p1.eh,ds.p1.em,ds.p2.sh,ds.p2.sm,ds.p2.eh,ds.p2.em,ds.p3.sh,ds.p3.sm,ds.p3.eh,ds.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    ['ns-full-sh','ns-full-sm','ns-full-eh','ns-full-em','ns-p1-sh','ns-p1-sm','ns-p1-eh','ns-p1-em','ns-p2-sh','ns-p2-sm','ns-p2-eh','ns-p2-em','ns-p3-sh','ns-p3-sm','ns-p3-eh','ns-p3-em'].forEach((id,i)=>{const vals=[ns.full.sh,ns.full.sm,ns.full.eh,ns.full.em,ns.p1.sh,ns.p1.sm,ns.p1.eh,ns.p1.em,ns.p2.sh,ns.p2.sm,ns.p2.eh,ns.p2.em,ns.p3.sh,ns.p3.sm,ns.p3.eh,ns.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    document.getElementById('settings-sched-type').value=config.schedType||'3P';
    updateTargetRows();
    // Events
    document.getElementById('btn-fetch').onclick=doFetch;
    document.getElementById('btn-exit').onclick=exitBoard;
    document.getElementById('btn-snip').onclick=doSnip;
    document.getElementById('btn-add-action')?.addEventListener('click',()=>{const a=loadActions();a.push({item:'',owner:'',status:'Open'});saveActions(a);renderActions();});
    document.getElementById('btn-clear-actions')?.addEventListener('click',()=>{if(confirm('Clear all actions?')){saveActions([]);renderActions();}});
    document.getElementById('btn-save-settings')?.addEventListener('click',saveSettingsUI);
    sel.onchange=e=>{config.site=e.target.value;if(SITE_SCHEDULES[config.site]){config.days=SITE_SCHEDULES[config.site].days;config.nights=SITE_SCHEDULES[config.site].nights;}saveConfig(config);refreshSettingsInputs();};
    document.getElementById('shift-select').onchange=e=>{config.shiftType=e.target.value;saveConfig(config);};
    document.querySelectorAll('.target-input').forEach(inp=>{inp.addEventListener('input',updateTargetRows);inp.addEventListener('change',()=>{saveTargetsUI();if(currentMetrics)renderTargets(currentMetrics);});});
    document.querySelectorAll('.nav-tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));tab.classList.add('active');const target=document.getElementById('tab-'+tab.dataset.tab);if(target)target.classList.add('active');});
    const sup=loadSupport();Object.keys(sup).forEach(id=>{const el=document.getElementById(id);if(el)el.value=sup[id];});
    document.querySelectorAll('.support-input,.callout-textarea').forEach(el=>el.addEventListener('change',()=>{const d={};document.querySelectorAll('.support-input,.callout-textarea').forEach(e=>{d[e.id]=e.value;});saveSupport(d);}));
    renderActions();updatePeriodDots();setInterval(updatePeriodDots,60000);
}

function refreshSettingsInputs(){
    const ds=config.days,ns=config.nights;
    ['ds-full-sh','ds-full-sm','ds-full-eh','ds-full-em','ds-p1-sh','ds-p1-sm','ds-p1-eh','ds-p1-em','ds-p2-sh','ds-p2-sm','ds-p2-eh','ds-p2-em','ds-p3-sh','ds-p3-sm','ds-p3-eh','ds-p3-em'].forEach((id,i)=>{const vals=[ds.full.sh,ds.full.sm,ds.full.eh,ds.full.em,ds.p1.sh,ds.p1.sm,ds.p1.eh,ds.p1.em,ds.p2.sh,ds.p2.sm,ds.p2.eh,ds.p2.em,ds.p3.sh,ds.p3.sm,ds.p3.eh,ds.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    ['ns-full-sh','ns-full-sm','ns-full-eh','ns-full-em','ns-p1-sh','ns-p1-sm','ns-p1-eh','ns-p1-em','ns-p2-sh','ns-p2-sm','ns-p2-eh','ns-p2-em','ns-p3-sh','ns-p3-sm','ns-p3-eh','ns-p3-em'].forEach((id,i)=>{const vals=[ns.full.sh,ns.full.sm,ns.full.eh,ns.full.em,ns.p1.sh,ns.p1.sm,ns.p1.eh,ns.p1.em,ns.p2.sh,ns.p2.sm,ns.p2.eh,ns.p2.em,ns.p3.sh,ns.p3.sm,ns.p3.eh,ns.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
}

function doSnip(){
    if(typeof html2canvas==='undefined'){alert('Screenshot library still loading. Try again in a moment.');return;}
    const root=document.getElementById('sb-root');
    const btn=document.getElementById('btn-snip');
    btn.textContent='\u23F3 Capturing...';btn.disabled=true;
    // Temporarily remove sticky/scroll constraints so full content is captured
    const rightPanel=root.querySelector('.sync-right');
    const origStyles={};
    if(rightPanel){origStyles.position=rightPanel.style.position;origStyles.maxHeight=rightPanel.style.maxHeight;origStyles.overflow=rightPanel.style.overflow;origStyles.top=rightPanel.style.top;rightPanel.style.position='static';rightPanel.style.maxHeight='none';rightPanel.style.overflow='visible';rightPanel.style.top='auto';}
    // Force colors for html2canvas (doesn't resolve CSS vars well)
    const style=document.createElement('style');style.id='snip-fix';
    style.textContent='#sb-root,#sb-root *{color:#e8eaed !important;}#sb-root .pct-good{color:#34c759 !important;}#sb-root .pct-warn{color:#ffcc00 !important;}#sb-root .pct-bad{color:#ff453a !important;}#sb-root .row-fast td{color:#ff9500 !important;}#sb-root .goal-title{color:#9aa0a6 !important;}#sb-root .goal-stats{color:#9aa0a6 !important;}#sb-root .goal-stats strong{color:#e8eaed !important;}#sb-root .fclm-timestamp{color:#9aa0a6 !important;}#sb-root .meta-text{color:#9aa0a6 !important;}#sb-root .target-input{color:#ffcc00 !important;}#sb-root .table-input{color:#ffcc00 !important;}#sb-root .panel-title{color:#9aa0a6 !important;}#sb-root .tg-compact h4{color:#2196F3 !important;}#sb-root .tg-compact:last-child h4{color:#FF9800 !important;}#sb-root .fixed-target{color:#34c759 !important;}#sb-root .row-hc td{color:#9aa0a6 !important;}#sb-root .section-header h2{color:#e8eaed !important;}#sb-root .metrics-table .bold{color:#e8eaed !important;}#sb-root .nav-tab{color:#9aa0a6 !important;}#sb-root .nav-tab.active{color:#fff !important;}';
    document.head.appendChild(style);
    setTimeout(()=>{
        html2canvas(root,{backgroundColor:'#1a1d23',scale:2,useCORS:true,logging:false,windowHeight:root.scrollHeight,height:root.scrollHeight}).then(canvas=>{
            // Restore styles
            document.head.removeChild(style);
            if(rightPanel){rightPanel.style.position=origStyles.position;rightPanel.style.maxHeight=origStyles.maxHeight;rightPanel.style.overflow=origStyles.overflow;rightPanel.style.top=origStyles.top;}
            canvas.toBlob(blob=>{
                if(navigator.clipboard&&window.ClipboardItem){
                    navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>{
                        btn.textContent='\u2713 Copied!';setTimeout(()=>{btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;},2000);
                    }).catch(()=>{downloadBlob(blob);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;});
                } else {downloadBlob(blob);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;}
            },'image/png');
        }).catch(e=>{document.head.removeChild(style);if(rightPanel){rightPanel.style.position=origStyles.position;rightPanel.style.maxHeight=origStyles.maxHeight;rightPanel.style.overflow=origStyles.overflow;rightPanel.style.top=origStyles.top;}console.error('Snip failed:',e);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;alert('Screenshot failed: '+e.message);});
    },150);
}
function downloadBlob(blob){
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
    a.download='SyncBoard_'+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.png';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

async function doFetch(){
    config=loadConfig();config.site=document.getElementById('site-select').value;config.shiftType=document.getElementById('shift-select').value;saveConfig(config);
    const btn=document.getElementById('btn-fetch');btn.disabled=true;btn.textContent='\u23F3 Fetching...';
    try{
        const raw=await fetchAllData(config);
        currentMetrics=processData(raw);
        renderIB(currentMetrics);renderOB(currentMetrics);renderSort(currentMetrics);
        renderTargets(currentMetrics);renderCharts(currentMetrics);
        renderFastStart(raw.fastStart,config);
        blankFuturePeriods(config);
        // Retry charts if Chart.js wasn't ready yet
        if(typeof Chart==='undefined'){setTimeout(()=>{if(typeof Chart!=='undefined'&&currentMetrics)renderCharts(currentMetrics);},2000);}
    }catch(err){console.error(err);setStatus('\u26A0\uFE0F '+err.message);alert('Fetch failed: '+err.message+'\n\nMake sure you are on Amazon network and authenticated to Midway.');}
    finally{btn.disabled=false;btn.textContent='\u25B6 Get Data';}
}

function saveTargetsUI(){a
    const t={};['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target'].forEach(id=>{t[id]=document.getElementById(id)?.value||'';});
    config.targets=t;saveConfig(config);
}

function saveSettingsUI(){
    config.days={full:{sh:+document.getElementById('ds-full-sh').value,sm:+document.getElementById('ds-full-sm').value,eh:+document.getElementById('ds-full-eh').value,em:+document.getElementById('ds-full-em').value},p1:{sh:+document.getElementById('ds-p1-sh').value,sm:+document.getElementById('ds-p1-sm').value,eh:+document.getElementById('ds-p1-eh').value,em:+document.getElementById('ds-p1-em').value},p2:{sh:+document.getElementById('ds-p2-sh').value,sm:+document.getElementById('ds-p2-sm').value,eh:+document.getElementById('ds-p2-eh').value,em:+document.getElementById('ds-p2-em').value},p3:{sh:+document.getElementById('ds-p3-sh').value,sm:+document.getElementById('ds-p3-sm').value,eh:+document.getElementById('ds-p3-eh').value,em:+document.getElementById('ds-p3-em').value}};
    config.nights={full:{sh:+document.getElementById('ns-full-sh').value,sm:+document.getElementById('ns-full-sm').value,eh:+document.getElementById('ns-full-eh').value,em:+document.getElementById('ns-full-em').value},p1:{sh:+document.getElementById('ns-p1-sh').value,sm:+document.getElementById('ns-p1-sm').value,eh:+document.getElementById('ns-p1-eh').value,em:+document.getElementById('ns-p1-em').value},p2:{sh:+document.getElementById('ns-p2-sh').value,sm:+document.getElementById('ns-p2-sm').value,eh:+document.getElementById('ns-p2-eh').value,em:+document.getElementById('ns-p2-em').value},p3:{sh:+document.getElementById('ns-p3-sh').value,sm:+document.getElementById('ns-p3-sm').value,eh:+document.getElementById('ns-p3-eh').value,em:+document.getElementById('ns-p3-em').value}};
    config.schedType=document.getElementById('settings-sched-type').value;
    saveTargetsUI();saveConfig(config);alert('Settings saved!');
}

addLaunchBtn();
})();
