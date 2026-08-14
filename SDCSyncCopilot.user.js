// ==UserScript==
// @name         SDC Sync Copilot
// @namespace    https://fclm-portal.amazon.com
// @version      13.2.0
// @description  Full shift sync board dashboard on FCLM - IB/OB/Sort metrics, CPLH, Support Teams
// @author       snodgtyl
// @match        https://fclm-portal.amazon.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_openInTab
// @connect      fc-benchmarking.amazon.com
// @connect      adapt-iad.amazon.com
// @connect      galaxybi.aka.corp.amazon.com
// @connect      galaxybiprintfile-prod.s3.us-west-2.amazonaws.com
// @connect      midway-auth.amazon.com
// @connect      guided-coaching.corp.amazon.com
// @connect      fcmenu-iad-regionalized.corp.amazon.com
// @connect      alps-iad.iad.proxy.amazon.com
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
    KRB3: { days:{full:{sh:5,sm:45,eh:17,em:30},p1:{sh:6,sm:15,eh:9,em:45},p2:{sh:10,sm:15,eh:13,em:15},p3:{sh:13,sm:15,eh:16,em:45}}, nights:{full:{sh:17,sm:45,eh:5,em:30},p1:{sh:18,sm:15,eh:21,em:45},p2:{sh:22,sm:15,eh:1,em:15},p3:{sh:1,sm:15,eh:4,em:45}} },
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
const PROCESS_IDS = { stow:'1003035', palletStow:'1003041', pick:'1003065', sort:'1003009', obDock:'1003021', icqa:'1003030' };
// Line items (Function names) that count as "Direct Count" for ICQA DC% —
// SBC - Library Deep + SBC - Pallet Single + Other Library Deep + Other Pallet Single
const DC_PERCENT_FUNCTIONS=['SBC - Library Deep','SBC - Pallet Single','Other Library Deep','Other Pallet Single'];
const DEFAULT_CONFIG = {
    site:'KRB3', shiftType:'Days', schedType:'3P',
    days:{ full:{sh:5,sm:45,eh:17,em:30}, p1:{sh:6,sm:15,eh:9,em:45}, p2:{sh:10,sm:15,eh:13,em:15}, p3:{sh:13,sm:15,eh:16,em:45} },
    nights:{ full:{sh:17,sm:45,eh:5,em:30}, p1:{sh:18,sm:15,eh:21,em:45}, p2:{sh:22,sm:15,eh:1,em:15}, p3:{sh:1,sm:15,eh:4,em:45} },
    targets:{}
};

function loadConfig(){try{const s=localStorage.getItem(STORAGE_KEY);if(s){const c={...DEFAULT_CONFIG,...JSON.parse(s)};
    // Always use SITE_SCHEDULES for the selected site's period times (source of truth)
    const siteSched=SITE_SCHEDULES[c.site];if(siteSched){c.days=siteSched.days;c.nights=siteSched.nights;}
    return c;}return{...DEFAULT_CONFIG};}catch(e){return{...DEFAULT_CONFIG};}}
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
    let units=0,hours=0,rate=0,hc=0,eachUnits=0,caseUnits=0,fluidLoadToteJobs=0;
    if(tr){const cells=tr.querySelectorAll('td.numeric');if(cells.length>=3){hours=parseFloat(cells[0].textContent.replace(/,/g,''))||0;units=parseInt(cells[1].textContent.replace(/,/g,''),10)||0;rate=parseFloat(cells[2].textContent.replace(/,/g,''))||0;}
    // EACH UNIT is index 3, CASE UNIT is index 5 (if present)
    if(cells.length>=4){eachUnits=parseInt(cells[3].textContent.replace(/,/g,''),10)||0;}
    if(cells.length>=6){caseUnits=parseInt(cells[5].textContent.replace(/,/g,''),10)||0;}
    // FluidLoadTote Jobs is index 7 in OB Dock report tfoot
    if(cells.length>=8){fluidLoadToteJobs=parseInt(cells[7].textContent.replace(/,/g,''),10)||0;}}
    const links=doc.querySelectorAll('a[href*="employeeId="]');const ids=new Set();links.forEach(l=>{const m=l.href.match(/employeeId=([^&]+)/);if(m)ids.add(m[1]);});hc=ids.size;
    // For palletStow: get CASE_UNIT from "Pallet Transfer In" Total row (6th numeric = index 5)
    let palletCases=0;
    const rows=doc.querySelectorAll('tr');let foundPTI=false;
    for(const row of rows){
        if(Array.from(row.querySelectorAll('th,td')).some(c=>/pallet\s*transfer\s*in/i.test(c.textContent.trim())))foundPTI=true;
        if(foundPTI){const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});if(nums.length>=6)palletCases=Math.round(nums[5]);break;}}
    }
    // For OB Dock: Fluid Load Jobs = FluidLoadCase Jobs (tfoot index 1) + FluidLoadTote Jobs (tfoot index 7)
    const fluidLoadJobs=units+fluidLoadToteJobs;
    return{totalUnits:units,directHours:hours,rate,headcount:hc,palletCases,eachUnits,caseUnits,fluidLoadJobs};
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
    // THROUGHPUT row from FC Summary
    let throughputVol=0,throughputHrs=0;
    const tpRow=doc.querySelector('tr#ppr\\.fcSummary\\.throughput')||doc.querySelector('tr[id*="fcSummary.throughput"]');
    if(tpRow){const cells=tpRow.querySelectorAll('td');cells.forEach(c=>{const cls=c.className;const div=c.querySelector('div.original');const txt=(div?div.textContent:c.textContent).trim().replace(/,/g,'');const v=parseFloat(txt);if(cls.includes('actualVolume')&&!isNaN(v))throughputVol=v;if(cls.includes('actualTimeSeconds')&&!isNaN(v))throughputHrs=v;});}
    // TIME OFF TASK row from FC Summary
    let totHrs=0;
    const totRow=doc.querySelector('tr#ppr\\.fcSummary\\.timeOffTask')||doc.querySelector('tr[id*="fcSummary.timeOffTask"]');
    if(totRow){const cells=totRow.querySelectorAll('td');cells.forEach(c=>{const cls=c.className;const div=c.querySelector('div.original');const txt=(div?div.textContent:c.textContent).trim().replace(/,/g,'');const v=parseFloat(txt);if(cls.includes('actualTimeSeconds')&&!isNaN(v))totHrs=v;});}
    // Fallback: search rows for "Time Off Task" text if ID selector didn't match
    if(totHrs===0){for(const row of rows){const cells=row.querySelectorAll('td,th');for(let ci=0;ci<cells.length;ci++){const ct=cells[ci].textContent.trim();if(ct==='Time Off Task'){const hrsCell=row.querySelector('td.actualTimeSeconds')||row.querySelector('td.numeric.actualTimeSeconds');if(hrsCell){const div=hrsCell.querySelector('div.original');const txt=(div?div.textContent:hrsCell.textContent).trim().replace(/,/g,'');totHrs=parseFloat(txt)||0;}break;}}if(totHrs>0)break;}}
    // IC/QA/CS row (ICQA RO Rate) — same row shown on the Standard PPR report
    const icqa=parseICQARow(doc);
    return{ibPlannedHrs:ibPlan,ibActualHrs:ibAct,obPlannedHrs:obPlan,obActualHrs:obAct,daTransferHrs,daTransferPlan,caseStowReserveHrs,throughputVol,throughputHrs,totHrs,icqaVol:icqa.vol,icqaHrs:icqa.hrs,icqaRate:icqa.rate};
}
// Parses the "IC/QA/CS" line item row (id="ppr.detail.support.support.ICQACS") off a
// PPR (processPathRollup) report page — its Rate column is the ICQA "RO Rate".
function parseICQARow(doc){
    const row=doc.getElementById('ppr.detail.support.support.ICQACS');
    if(!row)return{vol:0,hrs:0,rate:0};
    let vol=0,hrs=0,rate=0;
    row.querySelectorAll('td').forEach(c=>{
        const cls=c.className;
        const div=c.querySelector('div.original');
        const txt=(div?div.textContent:c.textContent).trim().replace(/,/g,'');
        const v=parseFloat(txt);
        if(isNaN(v))return;
        if(cls.includes('actualVolume'))vol=v;
        else if(cls.includes('actualTimeSeconds'))hrs=v;
        else if(cls.includes('actualProductivity'))rate=v;
    });
    if(rate===0&&hrs>0)rate=vol/hrs;
    return{vol,hrs,rate};
}

async function fetchPeriod(site,startDate,sched){
    const sh=sched.sh,sm=sched.sm,eh=sched.eh,em=sched.em;
    // For night shift periods after midnight, adjust the start date to next day
    let sDate=new Date(startDate);
    if(sh<12&&startDate.getHours()>=12){sDate.setDate(sDate.getDate()+1);}
    let eDate=new Date(sDate);if(eh<sh)eDate.setDate(eDate.getDate()+1);
    const urls={ppr:buildPPRUrl(site,sDate,sh,sm,eDate,eh,em),stow:buildFnUrl(site,PROCESS_IDS.stow,sDate,sh,sm,eDate,eh,em),palletStow:buildFnUrl(site,PROCESS_IDS.palletStow,sDate,sh,sm,eDate,eh,em),pick:buildFnUrl(site,PROCESS_IDS.pick,sDate,sh,sm,eDate,eh,em),sort:buildFnUrl(site,PROCESS_IDS.sort,sDate,sh,sm,eDate,eh,em),obDock:buildFnUrl(site,PROCESS_IDS.obDock,sDate,sh,sm,eDate,eh,em)};
    const res={};
    await Promise.all(Object.entries(urls).map(async([k,u])=>{try{const h=await fetchHTML(u);res[k]=k==='ppr'?parsePPR(h):parseFnRollup(h);}catch(e){console.warn('[SB]',k,e.message);res[k]=k==='ppr'?{ibPlannedHrs:0,ibActualHrs:0,obPlannedHrs:0,obActualHrs:0,daTransferHrs:0,daTransferPlan:0,caseStowReserveHrs:0,throughputVol:0,throughputHrs:0,totHrs:0}:{totalUnits:0,directHours:0,rate:0,headcount:0};}}));
    return res;
}

async function fetchAllData(config){
    const site=config.site,sched=config.shiftType==='Nights'?config.nights:config.days,{startDate}=getShiftDates(config);
    setStatus('Fetching all periods...');
    // Build TOT time window: 30 min before SOS to 15 min after EOS
    const totSched={sh:sched.full.sh,sm:sched.full.sm-30,eh:sched.full.eh,em:sched.full.em+15};
    if(totSched.sm<0){totSched.sh--;totSched.sm+=60;}
    if(totSched.sh<0)totSched.sh+=24;
    if(totSched.em>=60){totSched.eh++;totSched.em-=60;}
    if(totSched.eh>=24)totSched.eh-=24;
    // Build Site CPLH time window: 15 min before SOS to 15 min before next shift SOS
    // Days: P1 start - 15 min to next night P1 start - 15 min (approx 06:00-18:00)
    // Nights: P1 start - 15 min to next day P1 start - 15 min (approx 18:00-06:00)
    const p1Start=sched.p1.sh*60+sched.p1.sm;
    const cplhSh=Math.floor((p1Start-15)/60);const cplhSm=(p1Start-15)%60;
    const cplhEh=(cplhSh+12)%24;const cplhEm=cplhSm;
    const cplhSched={sh:cplhSh<0?cplhSh+24:cplhSh,sm:cplhSm<0?cplhSm+60:cplhSm,eh:cplhEh,em:cplhEm};
    // Fetch all periods in parallel for speed
    const [full,p1,p2,p3,fastStart,data24,totPpr,cplhData]=await Promise.all([
        fetchPeriod(site,startDate,sched.full),
        fetchPeriod(site,startDate,sched.p1),
        fetchPeriod(site,startDate,sched.p2),
        fetchPeriod(site,startDate,sched.p3),
        fetchFastStart(site,config.shiftType),
        fetch24hrData(site),
        fetchTOTPpr(site,startDate,totSched,config.shiftType),
        fetchPeriod(site,startDate,cplhSched)
    ]);
    setStatus('\u2713 Updated '+new Date().toLocaleTimeString());
    return{full,p1,p2,p3,fastStart,data24,totPpr,cplhData};
}

async function fetchTOTPpr(site,startDate,sched,shiftType){
    try{
        let sDate=new Date(startDate);
        if(sched.sh<12&&startDate.getHours()>=12){sDate.setDate(sDate.getDate()+1);}
        let eDate=new Date(sDate);if(sched.eh<sched.sh)eDate.setDate(eDate.getDate()+1);
        const url=buildPPRUrl(site,sDate,sched.sh,sched.sm,eDate,sched.eh,sched.em);
        const html=await fetchHTML(url);
        return parsePPR(html);
    }catch(e){console.warn('[SB] TOT PPR fetch error:',e.message);return{totHrs:0};}
}

// === ICQA: % to RO (RO Rate vs target) ===
// RO Rate is read straight off the IC/QA/CS row of the standard PPR
// (processPathRollup) report (see parseICQARow/parsePPR above) — same report already
// used for IB/OB actuals. Shift reuses the "full" period PPR fetch the board already
// makes (same start/end window as the rest of the board, no extra request needed).
// Week needs one extra fetch, with the report's own Week span.
function buildPPRUrlWeek(site,weekStartDate){
    return'/reports/processPathRollup?reportFormat=HTML&warehouseId='+site+'&spanType=Week&startDateWeek='+encodeURIComponent(fmtDate(weekStartDate))+'&_adjustPlanHours=on&_hideEmptyLineItems=on&employmentType=AllEmployees';
}
// Function Rollup report scoped to the report's own Week span (used for ICQA DC% week view)
function buildFnUrlWeek(site,pid,weekStartDate){
    return'/reports/functionRollup?reportFormat=HTML&warehouseId='+site+'&processId='+pid+'&spanType=Week&startDateWeek='+encodeURIComponent(fmtDate(weekStartDate));
}
// Walks a Function Rollup page's body rows and pulls the "Total Paid Hours" value for
// each named Function line item. The Function name cell uses rowspan across its
// Small/Medium/Large/HeavyBulky/Total sub-rows, so it only appears once in the DOM —
// track it as "current" until we hit that function's own "Total" sub-row.
function parseFunctionHoursByName(doc,names){
    const rows=doc.querySelectorAll('tbody tr');
    const result={};
    names.forEach(n=>result[n]=0);
    let current=null;
    rows.forEach(row=>{
        const cells=Array.from(row.querySelectorAll('th,td'));
        const cellTexts=cells.map(c=>c.textContent.trim());
        for(const name of names){if(cellTexts.includes(name)){current=name;break;}}
        if(current&&cellTexts.includes('Total')){
            const numCell=row.querySelector('td.numeric');
            if(numCell){result[current]=parseFloat(numCell.textContent.trim().replace(/,/g,''))||0;current=null;}
        }
    });
    return result;
}
// DC% (Direct Count %) = (SBC - Library Deep + SBC - Pallet Single + Other Library Deep
// + Other Pallet Single hours) / Total Paid Hours, off the ICQA process Function Rollup.
// The ICQA Function Rollup groups columns by Method (CycleCount/SimpleBinCount/
// AndonInspection/SidelineApp), a different table layout than the plain stow/pick
// reports — parseFnRollup's tfoot-based selectors don't reliably match it, so the
// grand total here is found directly: it's always the very last row in the table,
// and its Function column literally reads "Total" (unlike each function's own
// per-size "Total" sub-row, whose Function cell is blank due to rowspan).
function calcDCPercent(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const byName=parseFunctionHoursByName(doc,DC_PERCENT_FUNCTIONS);
    const dcHours=DC_PERCENT_FUNCTIONS.reduce((s,n)=>s+(byName[n]||0),0);
    let totalHours=0;
    const allRows=doc.querySelectorAll('table tr');
    for(let i=allRows.length-1;i>=0;i--){
        const row=allRows[i];
        const cells=row.querySelectorAll('th,td');
        if(cells.length&&cells[0].textContent.trim()==='Total'){
            const numCell=row.querySelector('td.numeric');
            if(numCell)totalHours=parseFloat(numCell.textContent.trim().replace(/,/g,''))||0;
            break;
        }
    }
    const pct=totalHours>0?(dcHours/totalHours)*100:0;
    return{dcHours,totalHours,pct};
}
function getWeekSunday(){
    const now=new Date();
    const sun=new Date(now);sun.setDate(now.getDate()-now.getDay());sun.setHours(0,0,0,0);
    return sun;
}
function isoDate(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
// Walks the ALPS getPlanSelectionData response (array of {Metric:[...]} sections, each
// Metric row optionally having nested subRows) to find a row by its "header" label,
// regardless of exact nesting/index — the ALPS grid groups rows differently depending
// on selection, so matching by label is more robust than hardcoding array positions.
function findAlpsRow(node,headerName){
    if(!node)return null;
    if(Array.isArray(node)){
        for(const item of node){const f=findAlpsRow(item,headerName);if(f)return f;}
        return null;
    }
    if(typeof node==='object'){
        if(node.header&&String(node.header).toLowerCase()===headerName.toLowerCase())return node;
        if(node.Metric){const f=findAlpsRow(node.Metric,headerName);if(f)return f;}
        if(node.subRows){const f=findAlpsRow(node.subRows,headerName);if(f)return f;}
    }
    return null;
}
// Fetches this week's ICQA "Loaded Rates" value from ALPS Basecamp: first resolves the
// current Live plan's planId, then pulls that plan's weekly "support" (ICQA) grid and
// reads the current week's Sunday column. Runs entirely in the background via
// GM_xmlhttpRequest (uses your existing ALPS session cookies, same as the GCA fetch).
function fetchAlpsLoadedRate(site,isRetry){
    return new Promise(resolve=>{
        const sunday=getWeekSunday();
        const sundayStr=isoDate(sunday);
        const endDate=new Date(sunday);endDate.setDate(endDate.getDate()+6);
        const planUrl='https://alps-iad.iad.proxy.amazon.com/api/site/'+site+'/latest-completed-plan-by-tag?tagName=Live&siteType=FULFILLMENT_CENTER&polling=true';
        const retryOrFail=(reason)=>{
            if(!isRetry){refreshAlpsSessionAndRetry(site,resolve);return;}
            console.warn('[SB] ALPS:',reason);resolve(null);
        };
        GM_xmlhttpRequest({method:'GET',url:planUrl,headers:{'Accept':'application/json'},
            onload:function(resp){
                let planId=null;
                try{planId=JSON.parse(resp.responseText).planId;}catch(e){}
                if(!planId){retryOrFail('no planId in response (session likely expired)');return;}
                const dataUrl='https://alps-iad.iad.proxy.amazon.com/api/report/FULFILLMENT_CENTER/'+site+'/getPlanSelectionData?view=weeklyView&selection=support&planId='+encodeURIComponent(planId)+'&withUserOverrides=false&startDate='+sundayStr+'&endDate='+isoDate(endDate);
                GM_xmlhttpRequest({method:'GET',url:dataUrl,headers:{'Accept':'application/json'},
                    onload:function(resp2){
                        try{
                            const data=JSON.parse(resp2.responseText);
                            const row=findAlpsRow(data,'Loaded Rates');
                            const cell=row&&row[sundayStr];
                            // The value shape varies by request — sometimes a plain number,
                            // sometimes {source, parsedValue}. Handle both.
                            let val=null;
                            if(cell&&cell.value!=null){
                                if(typeof cell.value==='number')val=cell.value;
                                else if(typeof cell.value==='object'&&typeof cell.value.parsedValue==='number')val=cell.value.parsedValue;
                            }
                            resolve(val);
                        }catch(e){retryOrFail('plan data parse error: '+e.message);}
                    },
                    onerror:function(){retryOrFail('plan data fetch error');},
                    ontimeout:function(){retryOrFail('plan data fetch timeout');}
                });
            },
            onerror:function(){retryOrFail('planId fetch error');},
            ontimeout:function(){retryOrFail('planId fetch timeout');}
        });
    });
}
// Same silent-session-refresh trick as attemptLPFetch's GalaxyBI retry and the GCA
// retry above: load ALPS Basecamp in a hidden iframe to pick up a fresh session cookie
// off any still-valid Midway session, then retry once.
function refreshAlpsSessionAndRetry(site,resolve){
    console.log('[SB] ALPS auth failed, refreshing session via iframe...');
    const iframe=document.createElement('iframe');
    iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
    iframe.src='https://iad.alps-basecamp.lamps.amazon.dev/'+site;
    document.body.appendChild(iframe);
    setTimeout(()=>{
        if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
        console.log('[SB] Retrying ALPS fetch after auth...');
        fetchAlpsLoadedRate(site,true).then(resolve);
    },5000);
}
async function fetchIcqaRO(config,raw){
    try{
        let target=parseFloat(document.getElementById('icqa-ro-target')?.value)||0;
        // Auto-fetch this week's target from ALPS; fill the input unless the user is
        // actively editing it (manual entry still works as a fallback/override).
        const alpsRate=await fetchAlpsLoadedRate(config.site);
        if(alpsRate>0){
            target=alpsRate;
            const tEl=document.getElementById('icqa-ro-target');
            if(tEl&&document.activeElement!==tEl){tEl.value=alpsRate;saveTargetsUI();}
        }
        setEl('icqa-ro-target-display',target>0?fmt(target):'\u2014');
        // Shift: from the PPR fetch the board already made for the "full" shift period
        const shiftRate=raw?.full?.ppr?.icqaRate||0;
        setEl('icqa-ro-shift-actual',shiftRate>0?fmt(shiftRate,2):'\u2014');
        if(target>0&&shiftRate>0){const p=(shiftRate/target)*100;const el=setEl('icqa-ro-shift-pct',fmtPct(p));setPctClass(el,p);}
        else setEl('icqa-ro-shift-pct','\u2014');
        // Week: one extra PPR fetch using the report's own Week span
        const weekUrl=buildPPRUrlWeek(config.site,getWeekSunday());
        const weekHtml=await fetchHTML(weekUrl);
        const weekIcqa=parseICQARow(new DOMParser().parseFromString(weekHtml,'text/html'));
        setEl('icqa-ro-week-actual',weekIcqa.rate>0?fmt(weekIcqa.rate,2):'\u2014');
        if(target>0&&weekIcqa.rate>0){const p=(weekIcqa.rate/target)*100;const el=setEl('icqa-ro-week-pct',fmtPct(p));setPctClass(el,p);}
        else setEl('icqa-ro-week-pct','\u2014');
    }catch(e){console.warn('[SB] ICQA RO fetch error:',e.message);}
}

// === ICQA: DC% (Direct Count %, target 70%) ===
// DC% = (SBC - Library Deep + SBC - Pallet Single + Other Library Deep + Other Pallet
// Single hours) / Total Paid Hours, read off the ICQA process path's Function Rollup
// report (processId 1003030) — a different report than the RO Rate's PPR page.
// Shift uses the same full-shift Intraday window as the rest of the board; Week uses
// one extra fetch with the report's own Week span (mirrors fetchIcqaRO's week fetch).
async function fetchIcqaDC(config){
    try{
        const target=parseFloat(document.getElementById('icqa-dc-target')?.value)||70;
        setEl('icqa-dc-target-display',fmt(target)+'%');
        const site=config.site;
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const {startDate}=getShiftDates(config);
        let sDate=new Date(startDate);
        if(sched.full.sh<12&&startDate.getHours()>=12){sDate.setDate(sDate.getDate()+1);}
        let eDate=new Date(sDate);if(sched.full.eh<sched.full.sh)eDate.setDate(eDate.getDate()+1);
        const shiftUrl=buildFnUrl(site,PROCESS_IDS.icqa,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em);
        const shiftHtml=await fetchHTML(shiftUrl);
        const shiftDC=calcDCPercent(shiftHtml);
        setEl('icqa-dc-shift-actual',shiftDC.totalHours>0?fmtPct(shiftDC.pct):'\u2014');
        if(target>0&&shiftDC.totalHours>0){const p=(shiftDC.pct/target)*100;const el=setEl('icqa-dc-shift-pct',fmtPct(p));setPctClass(el,p);}
        else setEl('icqa-dc-shift-pct','\u2014');

        const weekUrl=buildFnUrlWeek(site,PROCESS_IDS.icqa,getWeekSunday());
        const weekHtml=await fetchHTML(weekUrl);
        const weekDC=calcDCPercent(weekHtml);
        setEl('icqa-dc-week-actual',weekDC.totalHours>0?fmtPct(weekDC.pct):'\u2014');
        if(target>0&&weekDC.totalHours>0){const p=(weekDC.pct/target)*100;const el=setEl('icqa-dc-week-pct',fmtPct(p));setPctClass(el,p);}
        else setEl('icqa-dc-week-pct','\u2014');
    }catch(e){console.warn('[SB] ICQA DC% fetch error:',e.message);}
}

// === ICQA: GCA's (Coaching to Deliver, target 0) ===
// Calls Guided Coaching's SearchCoachingInstances API directly in the background
// (captured via browser devtools network tab). This runs cross-origin via
// GM_xmlhttpRequest, which sends the browser's existing guided-coaching.corp.amazon.com
// session cookies automatically — no need to have that tab open, same idea as the
// Fast Start fetch elsewhere in this file.
const ICQA_GCA_REASONS=['MANUAL_QUALITY_COACHING_FOR_STOW','MANUAL_PRODUCTIVITY_COACHING_FOR_STOW','TOO_MANY_STOW_MULTIPLE_EVENT_DEFECTS','TOO_MANY_STOW_MULTIPLE_EVENT_NOT_SCANNED_DEFECTS','TOO_MANY_STOW_MULTIPLE_EVENT_WRONG_BIN_DEFECTS','TOO_MANY_NIKE_QUANTITY_STOW_MULTIPLE_EVENT_DEFECTS','TOO_MANY_NIKE_QUANTITY_STOW_OVERAGE_DEFECTS','TOO_MANY_NIKE_QUANTITY_STOW_LOW_UNITS_PER_TRANSACTION_DEFECTS','STOW_QUBIT_RISK_SCORE_TOO_HIGH','TOO_MANY_STOW_MACHINE_GUN_RISK_SIGNATURES','TOO_MANY_STOW_OUT_OF_SEQUENCE_RISK_SIGNATURES','TOO_MANY_STOW_PC99_RISK_SIGNATURES','TOO_MANY_STOW_SWITCH_RISK_SIGNATURES','TOO_MANY_STOW_SHORTAGE_RISK_SIGNATURES','TOO_MANY_STOW_OVERAGE_RISK_SIGNATURES','TOO_MANY_STOW_DAMAGE_RISK_SIGNATURES','TOO_MANY_STOW_BIN_COLLISION_RISK_SIGNATURES','TOO_MANY_STOW_AMNESTY_DIRTY_BIN_RISK_SIGNATURES','TOO_MANY_STOW_SHORTAGE_DEFECTS','TOO_MANY_STOW_OVERAGE_DEFECTS','TOO_MANY_NO_STOW_TURNAWAY_INDICATORS','TOO_MANY_STOW_AMNESTY_LAST_TOUCH_ERROR_INDICATORS','TOO_MANY_SCAN_WHILE_STOW_DEFECTS','TOO_MANY_STOW_HOLDING_MULTIPLE_ITEMS_DEFECTS','TOO_MANY_STOW_BLOCKING_CAMERA_DEFECTS','TOO_MANY_SWEEP_AFTER_STOW_DEFECTS','TOO_MANY_POD_FRICTION_NON_COMPLIANT_STOW_OVERRIDES','TOO_MANY_STOW_FIDO_TRIPS_ERROR_INDICATORS','TOO_MANY_STOW_FIDO_PROMPTS_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_PICK','MANUAL_PRODUCTIVITY_COACHING_FOR_PICK','TOO_MANY_PICK_ERROR_INDICATORS','TOO_MANY_PICK_OVERAGE_ERROR_INDICATORS','TOO_MANY_PICK_SHORTAGE_ERROR_INDICATORS','TOO_MANY_PICK_DAMAGE_ERROR_INDICATORS','TOO_HIGH_PICK_DPMO','PICK_QUBIT_RISK_SCORE_TOO_HIGH','TOO_MANY_PICK_SHORTAGE_RISK_SIGNATURES','TOO_MANY_PICK_DAMAGE_RISK_SIGNATURES','TOO_MANY_PICK_SCANNED_WRONG_ASIN_RISK_SIGNATURES','TOO_MANY_PICK_REJECT_RISK_SIGNATURES','TOO_MANY_PICK_UNSCANNABLE_RISK_SIGNATURES','TOO_MANY_PICK_WRONG_ADJUSTMENT_DEFECTS','TOO_MANY_PICK_OVERFILLED_TOTE_ERROR_INDICATORS','TOO_MANY_PICK_AMNESTY_DIRTY_BIN_RISK_SIGNATURES','TOO_MANY_PICK_AMNESTY_LAST_TOUCH_ERROR_INDICATORS','TOO_MANY_PICK_FIDO_TRIPS_ERROR_INDICATORS','TOO_MANY_PICK_FIDO_PROMPTS_ERROR_INDICATORS','TOO_MANY_PICK_FALSE_DAMAGE_ERROR_INDICATORS','TOO_MANY_PICK_HIGH_REACH_WITHOUT_STEP_LADDER_DEFECTS','MANUAL_QUALITY_COACHING_FOR_INDUCT','MANUAL_PRODUCTIVITY_COACHING_FOR_INDUCT','TOO_MANY_INDUCT_ERROR_INDICATORS','TOO_MANY_INDUCT_SHORTAGE_ERROR_INDICATORS','TOO_MANY_INDUCT_DAMAGE_ERROR_INDICATORS','TOO_MANY_INDUCT_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_REBIN','MANUAL_PRODUCTIVITY_COACHING_FOR_REBIN','TOO_MANY_AFE_REBIN_ERROR_INDICATORS','TOO_MANY_AFE_REBIN_SHORTAGE_ERROR_INDICATORS','TOO_MANY_AFE_REBIN_DAMAGE_ERROR_INDICATORS','TOO_HIGH_AFE_REBIN_DPMO','TOO_MANY_AFE_REBIN_FALSE_DAMAGE_ERROR_INDICATORS','TOO_MANY_BATCHY_REBIN_ERROR_INDICATORS','TOO_MANY_BATCHY_REBIN_SHORTAGE_ERROR_INDICATORS','TOO_MANY_BATCHY_REBIN_DAMAGE_ERROR_INDICATORS','TOO_HIGH_BATCHY_REBIN_DPMO','MANUAL_QUALITY_COACHING_FOR_RECEIVE','MANUAL_PRODUCTIVITY_COACHING_FOR_RECEIVE','TOO_MANY_RECEIVE_OVERAGE_ERROR_INDICATORS','TOO_MANY_RECEIVE_SHORTAGE_ERROR_INDICATORS','TOO_MANY_RECEIVE_ERROR_INDICATORS','TOO_MANY_RECEIVE_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_ICQA','MANUAL_PRODUCTIVITY_COACHING_FOR_ICQA','TOO_MANY_ICQA_AMNESTY_DIRTY_BIN_RISK_SIGNATURES','TOO_MANY_ICQA_AMNESTY_LAST_TOUCH_ERROR_INDICATORS','TOO_MANY_ICQA_FIDO_TRIPS_ERROR_INDICATORS','TOO_MANY_ICQA_FIDO_PROMPTS_ERROR_INDICATORS','TOO_MANY_ICQA_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_PACK','MANUAL_PRODUCTIVITY_COACHING_FOR_PACK','TOO_MANY_PACK_WRONG_CONTAINER_USED_DEFECTS','TOO_MANY_PACK_WEIGHT_OUT_OF_TOLERANCE_ERROR_INDICATORS','TOO_MANY_PACK_WRONG_CONTAINER_USED_ERROR_INDICATORS','TOO_MANY_PACK_DAMAGE_RISK_SIGNATURES','TOO_MANY_PACK_SHORTAGE_RISK_SIGNATURES','TOO_MANY_PACK_UNSCANNABLE_RISK_SIGNATURES','TOO_MANY_PACK_SERIAL_UNSCANNABLE_RISK_SIGNATURES','TOO_MANY_PACK_NO_SCANNABLE_ID_RISK_SIGNATURES','TOO_MANY_PACK_DUPLICATE_SERIAL_SCAN_RISK_SIGNATURES','TOO_MANY_PACK_NO_PACKING_SLIP_RISK_SIGNATURES','TOO_MANY_PACK_BROKEN_SET_DEFECTS','TOO_MANY_PACK_MASTER_PACK_DEFECTS','TOO_MANY_PACK_DAMAGE_DEFECTS','TOO_MANY_PACK_SHORTAGE_DEFECTS','TOO_MANY_PACK_OVERAGE_DEFECTS','TOO_MANY_PACK_MISSING_DUNNAGE_DEFECTS','TOO_MANY_PACK_INSUFFICIENT_DUNNAGE_DEFECTS','TOO_MANY_PACK_CONCESSION_APPLIED_ERROR_INDICATORS','TOO_MANY_PACK_CONCESSION_DEFECTS','TOO_MANY_PACK_OPEN_BOX_DEFECTS','TOO_MANY_PACK_LABEL_APPLICATION_DEFECTS','TOO_MANY_PACK_LABEL_PRINTING_DEFECTS','TOO_MANY_PACK_WRONG_BOX_MCF_DEFECTS','TOO_MANY_PACK_WRONG_BOX_DEFECTS','TOO_MANY_PACK_PACKAGE_PROTECTION_LEVEL_DEFECTS','TOO_MANY_PACK_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_REVERSE_LOGISTICS','MANUAL_PRODUCTIVITY_COACHING_FOR_CUSTOMER_RETURNS','TOO_MANY_CUSTOMER_RETURNS_ITEM_MATCH_RISK_SIGNATURES','TOO_MANY_CUSTOMER_RETURNS_ITEM_DAMAGE_REMOVED_RISK_SIGNATURES','MANUAL_QUALITY_COACHING_FOR_SPACE_MANAGEMENT','MANUAL_QUALITY_COACHING_FOR_OUTBOUND_PROBLEM_SOLVE','TOO_MANY_POPS_MARKED_MISSING_ITEMS_FROM_CONTAINER_RISK_SIGNATURES','TOO_MANY_POPS_MARKED_MISSING_ITEMS_FROM_SPOOS_ERROR_INDICATORS','TOO_MANY_POPS_MARKED_MISSING_TOTE_BEFORE_PACK_ERROR_INDICATORS','TOO_MANY_POPS_MARKED_MISSING_TOTE_ERROR_INDICATORS','TOO_MANY_POPS_MARKED_MISSING_SHIPMENT_C15_DEFECTS','TOO_MANY_POPS_MARKED_MISSING_SHIPMENT_C704_DEFECTS','TOO_MANY_POPS_MARKED_MISSING_SHIPMENTS_ERROR_INDICATORS','TOO_MANY_POPS_REPROCESSED_SHIPMENTS_RISK_SIGNATURES','TOO_MANY_SLAM_OPERATOR_CONCESSION_ERROR_INDICATORS','TOO_MANY_OUTBOUND_PROBLEM_SOLVE_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_INBOUND_PROBLEM_SOLVE','TOO_MANY_INBOUND_PROBLEM_SOLVE_EXCESSIVE_DELETES_DAMAGES','TOO_MANY_INBOUND_PROBLEM_SOLVE_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_DECANT','MANUAL_PRODUCTIVITY_COACHING_FOR_DECANT','TOO_MANY_DECANT_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_SHIP','MANUAL_PRODUCTIVITY_COACHING_FOR_SHIP','TOO_MANY_PACKAGE_MISSORTS','TOO_MANY_CONTAINER_MISSORTS','TOO_LOW_AMNESTY_FIND_RATE_RISK_SIGNATURES'];
function fetchIcqaGCA(config,isRetry){
    try{
        const site=(config||loadConfig()).site;
        const now=new Date();
        const start=new Date(now.getTime()-14*24*60*60*1000);
        const body=JSON.stringify({
            building:{code:site},
            creationTimeRange:{startTime:start.toISOString(),endTime:now.toISOString()},
            statuses:'["PENDING"]',
            filters:[
                {_filterType:'attribute',attribute:'COACHING_REASON',values:ICQA_GCA_REASONS,negate:false},
                {_filterType:'coacheePresence'}
            ]
        });
        GM_xmlhttpRequest({
            method:'POST',
            url:'https://guided-coaching.corp.amazon.com/api/coaching/SearchCoachingInstances',
            headers:{'Content-Type':'application/json;charset=utf-8','Accept':'application/json'},
            data:body,
            onload:function(resp){
                try{
                    const data=JSON.parse(resp.responseText);
                    const count=(data.coachingInstances?.length||0)+(data.additionalCoachingInstances||0);
                    setEl('icqa-gca-value',String(count));
                    const banner=document.getElementById('icqa-gca-banner');
                    if(banner)banner.style.background=count>0?'#c62828':'#2e7d32';
                    setEl('icqa-gca-updated','\u2713 Updated '+new Date().toLocaleTimeString());
                }catch(e){
                    // Likely got redirected to a login page's HTML instead of JSON (expired session)
                    if(!isRetry)refreshGcaSessionAndRetry(config);
                    else setEl('icqa-gca-updated','\u26A0\uFE0F Parse error');
                }
            },
            onerror:function(){
                if(!isRetry){refreshGcaSessionAndRetry(config);return;}
                setEl('icqa-gca-value','\u2014');
                const b=document.getElementById('icqa-gca-banner');if(b)b.style.background='#757575';
                setEl('icqa-gca-updated','\u26A0\uFE0F Fetch failed (log in to Guided Coaching once)');
            },
            ontimeout:function(){
                if(!isRetry){refreshGcaSessionAndRetry(config);return;}
                setEl('icqa-gca-value','\u2014');
                const b=document.getElementById('icqa-gca-banner');if(b)b.style.background='#757575';
                setEl('icqa-gca-updated','\u26A0\uFE0F Timed out');
            }
        });
    }catch(e){console.warn('[SB] ICQA GCA fetch error:',e.message);}
}
// Guided Coaching's SSO login page sends X-Frame-Options: deny, so it can never be
// loaded in a hidden iframe — that header is a hard browser rule with no userscript
// workaround. Completing the SSO handshake requires a real top-level navigation, so
// this opens Guided Coaching in an actual (background, non-focused) tab via
// GM_openInTab — the same thing as opening it yourself, just automated — waits for the
// session cookie to land, closes the tab, then retries the original request once.
function refreshGcaSessionAndRetry(config){
    if(typeof GM_openInTab!=='function'){
        console.warn('[SB-GCA] GM_openInTab unavailable — log in to Guided Coaching manually once.');
        setEl('icqa-gca-updated','\u26A0\uFE0F Log in to Guided Coaching once');
        return;
    }
    console.log('[SB-GCA] Auth failed, opening Guided Coaching in a background tab to refresh session...');
    const tab=GM_openInTab('https://guided-coaching.corp.amazon.com/',{active:false,insert:true,setParent:true});
    setTimeout(()=>{
        try{tab&&tab.close&&tab.close();}catch(e){}
        console.log('[SB-GCA] Retrying GCA fetch after auth...');
        fetchIcqaGCA(config,true);
    },6000);
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

// === 24-HOUR DATA FETCH (00:00 - 23:59 today) for BB Goal Tracker ===
async function fetch24hrData(site){
    try{
        const today=new Date();
        const startDate=new Date(today);startDate.setHours(0,0,0,0);
        const endDate=new Date(today);
        // Stow (Case Transfer In), Pallet Stow, and OB Dock function rollups for full day
        const stowUrl=buildFnUrl(site,PROCESS_IDS.stow,startDate,0,0,endDate,23,59);
        const palletStowUrl=buildFnUrl(site,PROCESS_IDS.palletStow,startDate,0,0,endDate,23,59);
        const obDockUrl=buildFnUrl(site,PROCESS_IDS.obDock,startDate,0,0,endDate,23,59);
        const [stowHtml,palletStowHtml,obDockHtml]=await Promise.all([fetchHTML(stowUrl),fetchHTML(palletStowUrl),fetchHTML(obDockUrl)]);
        const stow=parseFnRollup(stowHtml);
        const pStow=parseFnRollup(palletStowHtml);
        const obDock=parseFnRollup(obDockHtml);
        const palletCases=pStow.palletCases||0;
        const ibVol24=(stow.totalUnits||0)+palletCases;
        const ibDensity24=(stow.caseUnits||0)>0?(stow.eachUnits||0)/(stow.caseUnits||1):0;
        const obDensity24=(obDock.caseUnits||0)>0?(obDock.eachUnits||0)/(obDock.caseUnits||1):0;
        return{ibVol24,obVol24:obDock.fluidLoadJobs||0,ibDensity24,obDensity24};
    }catch(e){console.warn('[SB] 24hr data fetch error:',e.message);return{ibVol24:0,obVol24:0,ibDensity24:0,obDensity24:0};}
}

// === LABOR PLANNING (LP) CPLH — Manual Input + Auto-fetch attempt ===
function loadLPValues(){
    try{const s=localStorage.getItem('syncboard_lp');return s?JSON.parse(s):{};}catch(e){return{};}
}
function saveLPValues(lp){
    try{localStorage.setItem('syncboard_lp',JSON.stringify(lp));}catch(e){}
}

function fetchLPDataAuto(site){
    return new Promise((resolve)=>{
        attemptLPFetch(site,resolve,false);
    });
}
function attemptLPFetch(site,resolve,isRetry){
        const now=new Date();
        const day=now.getDay();
        const cfg=loadConfig();
        // Determine which Sunday to use for LP data (Galaxy BI weeks start Sunday)
        let sundayOffset=day; // days since last Sunday (Sun=0, Mon=1, Tue=2...)
        if(cfg.shiftType==='Nights'&&day===6){
            // Saturday night shift — new week hasn't started yet for nights
            sundayOffset=6; // go back to last Sunday
        }
        const sun=new Date(now);sun.setDate(now.getDate()-sundayOffset);sun.setHours(0,0,0,0);
        const sundayStr=sun.getFullYear()+'-'+String(sun.getMonth()+1).padStart(2,'0')+'-'+String(sun.getDate()).padStart(2,'0');
        const end=new Date(sun);end.setDate(end.getDate()+14);
        const endStr=end.getFullYear()+'-'+String(end.getMonth()+1).padStart(2,'0')+'-'+String(end.getDate()).padStart(2,'0');
        const reportsUrl=`https://galaxybi.aka.corp.amazon.com/api/folders/labor-planning/templates/lR8NujgNmqXM-print-file/reports?site=${site}&reportType=PUBLISHED&startReportDate=${sundayStr}&endReportDate=${endStr}&userName=snodgtyl`;
        console.log('[SB-LP] Fetching reports:',reportsUrl);
        GM_xmlhttpRequest({method:'GET',url:reportsUrl,
            headers:{'Accept':'*/*','Content-Type':'application/json'},
            onload:function(resp){
                try{
                    const text=resp.responseText.trim();
                    if(!text.startsWith('[')&&!text.startsWith('{')){
                        console.warn('[SB-LP] Reports not JSON, status:',resp.status,'first 200:',text.substring(0,200));
                        resolve(null);return;
                    }
                    const data=JSON.parse(text);
                    const reports=data.reports||data||[];
                    const finalReport=reports.find(r=>r.reportName&&r.reportName.toLowerCase().includes('final'));
                    if(!finalReport||!finalReport.planId){console.warn('[SB-LP] No Final report found');resolve(null);return;}
                    const planId=finalReport.planId;
                    console.log('[SB-LP] Found:',finalReport.reportName,'planId=',planId);
                    let done=0;const results={ibCplh:0,obCplh:0,siteCplh:0,ctiRate:0,topRate:0,ibDensityLP:0,obDensityLP:0,ibBBGoal:0,obBBGoal:0};
                    const checkDone=()=>{if(done>=9){saveLPValues(results);resolve(results);}};
                    fetchLPPageAuto(planId,'IB',sundayStr,'key','IB Total CPLH',(v)=>{results.ibCplh=v;done++;checkDone();});
                    fetchLPPageAuto(planId,'DA',sundayStr,'key','DA Bldg to Bldg Total - CPLH',(v)=>{results.obCplh=v;done++;checkDone();});
                    fetchLPPageAuto(planId,'DeratedRates',sundayStr,'lineItem','Total Building CPLH Inc Support',(v,allRows)=>{
                        results.siteCplh=v;
                        // Extract CTI rate from DeratedRates (Forecast + Cartons)
                        if(allRows&&allRows.length>0){
                            for(const row of allRows){
                                if((row.lineItem||'').trim()==='Case Transfer In'&&row.date===sundayStr&&row.type==='Forecast'&&row.packType==='Cartons'&&parseFloat(row.value)>0){
                                    results.ctiRate=parseFloat(row.value)||0;break;
                                }
                            }
                        }
                        console.log('[SB-LP] DeratedRates final: CTI='+results.ctiRate+' SiteCPLH='+results.siteCplh);
                        done+=2;checkDone();
                    });
                    // Pick rate from UnderatedRatesAndHours (Cartons value is the diluted rate)
                    fetchLPPageAutoRate(planId,'UnderatedRatesAndHours',sundayStr,'Transfer Out Pick - Small',(v)=>{results.topRate=v;done++;checkDone();});
                    fetchLPPageAutoRate(planId,'Density',sundayStr,'Case Transfer In',(v)=>{results.ibDensityLP=v;done++;checkDone();});
                    fetchLPPageAutoRate(planId,'Density',sundayStr,'DA Bldg to Bldg Transfer TOTAL',(v)=>{results.obDensityLP=v;done++;checkDone();});
                    // BB Goals: Week Capacity (Cartons) for today's day from IB and DA
                    fetchBBGoalFromLP(planId,'IB',sundayStr,(v)=>{results.ibBBGoal=v;done++;checkDone();});
                    fetchBBGoalFromLP(planId,'DA',sundayStr,(v)=>{results.obBBGoal=v;done++;checkDone();});
                }catch(e){console.warn('[SB-LP] Parse error:',e);resolve(null);}
            },
            onerror:function(e){
                if(!isRetry){
                    console.log('[SB-LP] Auth failed, refreshing GalaxyBI session via iframe...');
                    const iframe=document.createElement('iframe');
                    iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
                    iframe.src='https://galaxybi.aka.corp.amazon.com/';
                    document.body.appendChild(iframe);
                    setTimeout(()=>{
                        if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
                        console.log('[SB-LP] Retrying LP fetch after auth...');
                        attemptLPFetch(site,resolve,true);
                    },5000);
                }else{
                    console.warn('[SB-LP] Fetch error after retry:',e);
                    resolve(null);
                }
            },
            ontimeout:function(){resolve(null);}
        });
}

function fetchLPPageAuto(planId,pageName,sundayStr,fieldName,targetKey,callback){
    const site=loadConfig().site;
    const url=`https://galaxybi.aka.corp.amazon.com/api/metadata/pageUrl?pageName=${pageName}&planId=${planId}&site=${site}`;
    console.log('[SB-LP] Fetching page:',pageName,'url:',url);
    GM_xmlhttpRequest({method:'GET',url,headers:{'Accept':'*/*','Content-Type':'application/json'},
        onload:function(resp){
            try{
                const text=resp.responseText.trim();
                console.log('[SB-LP] pageUrl response for',pageName,'status:',resp.status,'first 200:',text.substring(0,200));
                if(!text.startsWith('{')){callback(0);return;}
                const s3Url=JSON.parse(text).url;
                if(!s3Url){console.warn('[SB-LP] No url field for',pageName);callback(0);return;}
                console.log('[SB-LP] Got S3 URL for',pageName,s3Url.substring(0,80)+'...');
                GM_xmlhttpRequest({method:'GET',url:s3Url,headers:{'Accept':'*/*'},
                    onload:function(s3Resp){
                        try{
                            const rows=JSON.parse(s3Resp.responseText);
                            console.log('[SB-LP]',pageName,'data:',rows.length,'rows');
                            let val=0;
                            for(const row of rows){
                                const name=(row[fieldName]||'').trim();
                                const matches=name===targetKey||name.includes(targetKey);
                                if(matches&&row.date===sundayStr){
                                    // For DeratedRates/UnderatedRatesAndHours, look for Forecast + Cartons
                                    if(pageName==='DeratedRates'||pageName==='UnderatedRatesAndHours'){
                                        if(row.type!=='Forecast'||row.packType!=='Cartons')continue;
                                    }else{
                                        if(row.packType&&row.packType!=='Units')continue;
                                    }
                                    val=parseFloat(row.value)||0;break;
                                }
                            }
                            // Fallback
                            if(val===0){for(const row of rows){const name=(row[fieldName]||'').trim();const matches=name===targetKey||name.includes(targetKey);if(matches&&row.value&&parseFloat(row.value)>0){if(pageName==='DeratedRates'||pageName==='UnderatedRatesAndHours'){if(row.type!=='Forecast'||row.packType!=='Cartons')continue;}val=parseFloat(row.value);break;}}}
                            console.log(`[SB-LP] ${pageName} → ${targetKey} = ${val}`);
                            callback(val,rows);
                        }catch(e){console.warn('[SB-LP] S3 parse error:',pageName,e);callback(0);}
                    },onerror:function(e){console.warn('[SB-LP] S3 fetch error:',pageName,e);callback(0);},ontimeout:function(){callback(0);}
                });
            }catch(e){console.warn('[SB-LP] pageUrl parse error:',pageName,e);callback(0);}
        },onerror:function(e){console.warn('[SB-LP] pageUrl fetch error:',pageName,e);callback(0);},ontimeout:function(){callback(0);}
    });
}

function fetchLPPageAutoRate(planId,pageName,sundayStr,targetLineItem,callback){
    const site=loadConfig().site;
    const url=`https://galaxybi.aka.corp.amazon.com/api/metadata/pageUrl?pageName=${pageName}&planId=${planId}&site=${site}`;
    GM_xmlhttpRequest({method:'GET',url,headers:{'Accept':'*/*','Content-Type':'application/json'},
        onload:function(resp){
            try{
                const text=resp.responseText.trim();
                if(!text.startsWith('{')){{callback(0);return;}}
                const s3Url=JSON.parse(text).url;
                if(!s3Url){callback(0);return;}
                GM_xmlhttpRequest({method:'GET',url:s3Url,headers:{'Accept':'*/*'},
                    onload:function(s3Resp){
                        try{
                            const rows=JSON.parse(s3Resp.responseText);
                            let val=0;
                            // Debug: log all matching lineItem rows for the target date
                            if(pageName==='DeratedRates'){
                                const dbg=rows.filter(r=>(r.lineItem||'').trim()===targetLineItem&&r.date===sundayStr);
                                console.log(`[SB-LP] DeratedRates debug: ${targetLineItem} date=${sundayStr} matches:`,dbg.map(r=>r.type+'/'+r.packType+'='+r.value));
                            }
                            for(const row of rows){
                                if((row.lineItem||'').trim()===targetLineItem&&row.date===sundayStr&&row.type==='Forecast'&&row.packType==='Cartons'){
                                    val=parseFloat(row.value)||0;break;
                                }
                            }
                            // Fallback for DeratedRates: try Forecast + Units if Cartons not found (for CPLH values only, NOT rates)
                            if(val===0&&pageName==='DeratedRates'&&(targetLineItem.includes('CPLH')||targetLineItem.includes('Total'))){
                                for(const row of rows){
                                    if((row.lineItem||'').trim()===targetLineItem&&row.date===sundayStr&&row.type==='Forecast'&&row.packType==='Units'){
                                        val=parseFloat(row.value)||0;break;
                                    }
                                }
                            }
                            // Debug: if no match, try includes
                            if(val===0&&targetLineItem.includes('Transfer Out')){
                                const matches=rows.filter(r=>r.lineItem&&r.lineItem.includes('Transfer Out Pick')&&r.type==='Forecast'&&r.date===sundayStr&&r.packType==='Cartons'&&parseFloat(r.value)>0);
                                console.log('[SB-LP] Transfer Out Pick matches:',matches.map(r=>r.lineItem+'/'+r.packType+'='+r.value));
                                if(matches.length>0){val=parseFloat(matches[0].value)||0;}
                            }
                            console.log(`[SB-LP] Rate[${pageName}]: ${targetLineItem} = ${val}`);
                            callback(val);
                        }catch(e){callback(0);}
                    },onerror:function(){callback(0);},ontimeout:function(){callback(0);}
                });
            }catch(e){callback(0);}
        },onerror:function(){callback(0);},ontimeout:function(){callback(0);}
    });
}

function fetchBBGoalFromLP(planId,pageName,sundayStr,callback){
    const site=loadConfig().site;
    const url=`https://galaxybi.aka.corp.amazon.com/api/metadata/pageUrl?pageName=${pageName}&planId=${planId}&site=${site}`;
    // Determine today's day name
    const days=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const todayDay=days[new Date().getDay()];
    GM_xmlhttpRequest({method:'GET',url,headers:{'Accept':'*/*','Content-Type':'application/json'},
        onload:function(resp){
            try{
                const text=resp.responseText.trim();
                if(!text.startsWith('{')){callback(0);return;}
                const s3Url=JSON.parse(text).url;
                if(!s3Url){callback(0);return;}
                GM_xmlhttpRequest({method:'GET',url:s3Url,headers:{'Accept':'*/*'},
                    onload:function(s3Resp){
                        try{
                            const rows=JSON.parse(s3Resp.responseText);
                            let val=0;
                            // Look for "Week Capacity (Cartons)" type with today's day key
                            for(const row of rows){
                                const t=(row.type||'').trim();
                                const k=(row.key||'').trim();
                                if(t.includes('Week Capacity')&&t.includes('Cartons')&&k.includes(todayDay)&&row.date===sundayStr){
                                    val=parseFloat(row.value)||0;break;
                                }
                            }
                            // Fallback: just match key containing today's day in Cartons type
                            if(val===0){
                                for(const row of rows){
                                    const t=(row.type||'').trim();
                                    const k=(row.key||'').trim();
                                    if(t.includes('Cartons')&&k.includes(todayDay)&&row.value&&parseFloat(row.value)>0){
                                        val=parseFloat(row.value);break;
                                    }
                                }
                            }
                            console.log(`[SB-LP] BB Goal ${pageName} (${todayDay}) = ${val}`);
                            callback(val);
                        }catch(e){callback(0);}
                    },onerror:function(){callback(0);},ontimeout:function(){callback(0);}
                });
            }catch(e){callback(0);}
        },onerror:function(){callback(0);},ontimeout:function(){callback(0);}
    });
}

// Dark mode color helper for conditional formatting
function cfColors(){
    const dk=document.getElementById('sb-root')?.classList.contains('dark-mode');
    return dk?{good:'#1b8a4a',warn:'#c77d00',bad:'#d32f2f'}:{good:'rgba(52,211,153,0.15)',warn:'rgba(251,191,36,0.1)',bad:'rgba(220,38,38,0.12)'};
}
function cfDensityColors(){
    const dk=document.getElementById('sb-root')?.classList.contains('dark-mode');
    return dk?{goodBg:'#1b8a4a',goodTxt:'#fff',warnBg:'#c77d00',warnTxt:'#fff',badBg:'#d32f2f',badTxt:'#fff'}:{goodBg:'rgba(46,125,50,0.12)',goodTxt:'#2e7d32',warnBg:'rgba(230,81,0,0.1)',warnTxt:'#e65100',badBg:'rgba(198,40,40,0.1)',badTxt:'#c62828'};
}

function renderLPPercents(metrics){
    if(!metrics)return;
    const lp=loadLPValues();
    const cc=cfColors();
    // Also check display spans for LP values (auto-populated)
    const ibLpCplh=parseFloat(lp.ibCplh)||0;
    const obLpCplh=parseFloat(lp.obCplh)||0;
    const siteLpCplh=parseFloat(lp.siteCplh)||0;
    if(ibLpCplh>0){
        const f=metrics.ib?.full||{};
        const ibLP=f.cplh>0?(f.cplh/ibLpCplh)*100:0;
        setEl('ib-op-total',ibLP>0?fmtPct(ibLP):'\u2014');
        const el=document.getElementById('ib-op-total');if(el){el.style.background='';if(ibLP>=100)el.style.background=cc.good;else if(ibLP>=95)el.style.background=cc.warn;else if(ibLP>0)el.style.background=cc.bad;}
        ['p1','p2','p3'].forEach(p=>{const pCplh=metrics.ib?.[p]?.cplh||0;const pLP=pCplh>0?(pCplh/ibLpCplh)*100:0;const elP=setEl('ib-op-'+p,pLP>0?fmtPct(pLP):'\u2014');if(elP){elP.style.background='';if(pLP>=100)elP.style.background=cc.good;else if(pLP>=95)elP.style.background=cc.warn;else if(pLP>0)elP.style.background=cc.bad;}});
    }
    if(obLpCplh>0){
        const f=metrics.ob?.full||{};
        const obLP=f.cplh>0?(f.cplh/obLpCplh)*100:0;
        setEl('ob-op-total',obLP>0?fmtPct(obLP):'\u2014');
        const el=document.getElementById('ob-op-total');if(el){el.style.background='';if(obLP>=100)el.style.background=cc.good;else if(obLP>=95)el.style.background=cc.warn;else if(obLP>0)el.style.background=cc.bad;}
        ['p1','p2','p3'].forEach(p=>{const pCplh=metrics.ob?.[p]?.cplh||0;const pLP=pCplh>0?(pCplh/obLpCplh)*100:0;const elP=setEl('ob-op-'+p,pLP>0?fmtPct(pLP):'\u2014');if(elP){elP.style.background='';if(pLP>=100)elP.style.background=cc.good;else if(pLP>=95)elP.style.background=cc.warn;else if(pLP>0)elP.style.background=cc.bad;}});
    }
    if(siteLpCplh>0){
        const siteCplhVal=parseFloat(document.getElementById('site-cplh-value')?.textContent)||0;
        if(siteCplhVal>0){
            const siteLP=(siteCplhVal/siteLpCplh)*100;
            const pctEl=setEl('site-cplh-pct',fmtPct(siteLP));setPctClass(pctEl,siteLP);
            const lpPctEl=document.getElementById('site-cplh-lp-pct');
            if(lpPctEl){lpPctEl.textContent=siteLP.toFixed(1)+'%';lpPctEl.style.color=siteLP>=100?'#2e7d32':siteLP>=95?'#e65100':'#c62828';}
            const valEl=document.getElementById('site-cplh-value');
            if(valEl){valEl.style.color=siteLP>=100?'#2e7d32':siteLP>=95?'#e65100':'#c62828';}
        }
    }
    // Update the LP display values
    const ibDispEl=document.getElementById('lp-ib-cplh-display');if(ibDispEl)ibDispEl.textContent=ibLpCplh>0?ibLpCplh.toFixed(2):'\u2014';
    const obDispEl=document.getElementById('lp-ob-cplh-display');if(obDispEl)obDispEl.textContent=obLpCplh>0?obLpCplh.toFixed(2):'\u2014';
    const siteDispEl=document.getElementById('lp-site-cplh-display');if(siteDispEl)siteDispEl.textContent=siteLpCplh>0?siteLpCplh.toFixed(2):'\u2014';
    const ctiRate=parseFloat(lp.ctiRate)||0;
    const topRate=parseFloat(lp.topRate)||0;
    const ibDensityLP=parseFloat(lp.ibDensityLP)||0;
    const obDensityLP=parseFloat(lp.obDensityLP)||0;
    const ctiDispEl=document.getElementById('lp-cti-rate-display');if(ctiDispEl)ctiDispEl.textContent=ctiRate>0?ctiRate.toFixed(1):'\u2014';
    const topDispEl=document.getElementById('lp-top-rate-display');if(topDispEl)topDispEl.textContent=topRate>0?topRate.toFixed(1):'\u2014';
    const ibDenDispEl=document.getElementById('lp-ib-density-display');if(ibDenDispEl)ibDenDispEl.textContent=ibDensityLP>0?ibDensityLP.toFixed(2):'\u2014';
    const obDenDispEl=document.getElementById('lp-ob-density-display');if(obDenDispEl)obDenDispEl.textContent=obDensityLP>0?obDensityLP.toFixed(2):'\u2014';
    // Conditional format IB Stow Rate cells based on LP CTI rate
    if(ctiRate>0){['ib-rate-p1','ib-rate-p2','ib-rate-p3','ib-rate-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';return;}if(v>=ctiRate)el.style.background=cc.good;else if(v>=ctiRate*0.95)el.style.background=cc.warn;else el.style.background=cc.bad;});}
    // Conditional format IB CPLH cells based on LP CPLH
    if(ibLpCplh>0){['ib-cplh-p1','ib-cplh-p2','ib-cplh-p3','ib-cplh-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';return;}if(v>=ibLpCplh)el.style.background=cc.good;else if(v>=ibLpCplh*0.95)el.style.background=cc.warn;else el.style.background=cc.bad;});}
    // Conditional format OB Pick Rate cells based on LP TOP rate
    if(topRate>0){['ob-rate-p1','ob-rate-p2','ob-rate-p3','ob-rate-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';return;}if(v>=topRate)el.style.background=cc.good;else if(v>=topRate*0.95)el.style.background=cc.warn;else el.style.background=cc.bad;});}
    // Conditional format OB CPLH cells based on LP CPLH
    if(obLpCplh>0){['ob-cplh-p1','ob-cplh-p2','ob-cplh-p3','ob-cplh-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';return;}if(v>=obLpCplh)el.style.background=cc.good;else if(v>=obLpCplh*0.95)el.style.background=cc.warn;else el.style.background=cc.bad;});}
    // Conditional format IB Density cells based on LP Density
    if(ibDensityLP>0){const dc=cfDensityColors();['ib-density-p1','ib-density-p2','ib-density-p3','ib-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=ibDensityLP){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=ibDensityLP*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
    // Conditional format OB Density cells based on LP Density
    if(obDensityLP>0){const dc=cfDensityColors();['ob-density-p1','ob-density-p2','ob-density-p3','ob-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=obDensityLP){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=obDensityLP*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
}

// === LEARNING CURVE from FCLM iframe (reads live DOM with LC + JPH) ===
function fetchLearningCurve(site,processId,displayElId){
    const config=loadConfig();
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const {startDate}=getShiftDates(config);
    const fmtD=(d)=>`${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;
    const sh=sched.full.sh,sm=sched.full.sm,eh=sched.full.eh,em=sched.full.em;
    let eDate=new Date(startDate);if(eh<sh)eDate.setDate(eDate.getDate()+1);
    const url=`/reports/functionRollup?reportFormat=HTML&warehouseId=${site}&processId=${processId}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtD(startDate))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtD(eDate))}&endHourIntraday=${eh}&endMinuteIntraday=${em}`;

    // Load in hidden iframe so FCLM JS renders the detail rows
    const iframe=document.createElement('iframe');
    iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    iframe.src=url;
    document.body.appendChild(iframe);

    let attempts=0;const maxAttempts=30; // 15 seconds max
    const checkInterval=setInterval(()=>{
        attempts++;
        try{
            const iDoc=iframe.contentDocument||iframe.contentWindow.document;
            const rows=iDoc.querySelectorAll('tr[class*="empl-"]');
            // Wait for employee rows with "Level" text to appear
            let hasLC=false;
            if(rows.length>5){for(const r of rows){if(r.textContent.includes('Level')){hasLC=true;break;}}}
            if(hasLC||attempts>=maxAttempts){
                clearInterval(checkInterval);
                if(hasLC){
                    const lcCounts={1:0,2:0,3:0,4:0,5:0,unknown:0};
                    const lcRates={1:[],2:[],3:[],4:[],5:[],unknown:[]};
                    rows.forEach(row=>{
                        let lcLevel=0,jph=0;
                        const cells=row.querySelectorAll('td');
                        cells.forEach(cell=>{const m=cell.textContent.trim().match(/^Level\s*(\d)$/i);if(m)lcLevel=parseInt(m[1]);});
                        if(lcLevel<1||lcLevel>5)return;
                        // JPH = last cell value that's a reasonable rate (1-300)
                        const allC=Array.from(cells);
                        for(let i=allC.length-1;i>=0;i--){
                            const v=parseFloat(allC[i].textContent.trim().replace(/,/g,''));
                            if(!isNaN(v)&&v>=1&&v<=300){jph=v;break;}
                        }
                        lcCounts[lcLevel]++;
                        if(jph>0)lcRates[lcLevel].push(jph);
                    });
                    console.log('[SB-LC] iframe parse success! counts=',JSON.stringify(lcCounts),'rate lens=',Object.keys(lcRates).map(k=>k+':'+lcRates[k].length).join(','));
                    updateLCDisplay(displayElId,lcCounts,lcRates);
                } else {
                    console.log('[SB-LC] iframe timeout, falling back to ADAPT...');
                    // Fallback: get employee IDs from iframe and use ADAPT for percentages
                    const iDoc2=iframe.contentDocument||iframe.contentWindow.document;
                    const text=iDoc2.body?iDoc2.body.innerHTML:'';
                    const empMatches=text.match(/employeeId=(\d+)/g);
                    const eidSet=new Set();
                    if(empMatches)empMatches.forEach(m=>{const id=m.replace('employeeId=','');if(id.length>=5)eidSet.add(id);});
                    const eidList=Array.from(eidSet);
                    if(eidList.length>0)fetchLCFromAdapt(site,eidList,processId,displayElId);
                    else updateLCDisplay(displayElId,null,null);
                }
                // Cleanup iframe
                setTimeout(()=>{if(iframe.parentNode)iframe.parentNode.removeChild(iframe);},1000);
            }
        }catch(e){
            // Cross-origin or load error
            if(attempts>=maxAttempts){clearInterval(checkInterval);setTimeout(()=>{if(iframe.parentNode)iframe.parentNode.removeChild(iframe);},1000);updateLCDisplay(displayElId,null,null);}
        }
    },500);
}
function fetchLCFromAdapt(site,eidList,processId,displayElId){
    const now=new Date();const endIso=now.toISOString();
    const batchStart=new Date(now.getTime()-7*24*60*60*1000).toISOString();
    const BATCH_SIZE=50;const batches=[];
    for(let i=0;i<eidList.length;i+=BATCH_SIZE)batches.push(eidList.slice(i,i+BATCH_SIZE));
    const lcCounts={1:0,2:0,3:0,4:0,5:0,unknown:0};
    const lcRates={1:[],2:[],3:[],4:[],5:[],unknown:[]};
    let done=0;const seen=new Set();
    const fnKeywords=processId==='1003035'?['case transfer in','pallet transfer','stow','inbound']:['pick','outbound','each pick','case pick'];
    batches.forEach(batch=>{
        const eidParam=encodeURIComponent(JSON.stringify(batch));
        const url=`https://adapt-iad.amazon.com/api/femida-svc/GetBatchEmployeePerformanceMetrics?warehouseId=${encodeURIComponent(site)}&employeeIds=${eidParam}&startTime=${encodeURIComponent(batchStart)}&endTime=${encodeURIComponent(endIso)}&performanceMetricType=ProcessPathRollupHourly`;
        GM_xmlhttpRequest({method:'GET',url,timeout:30000,
            onload:function(br){try{const d=JSON.parse(br.responseText);if(d&&d.batchPerformanceMetrics){Object.keys(d.batchPerformanceMetrics).forEach(eid=>{const metrics=d.batchPerformanceMetrics[eid];if(!Array.isArray(metrics))return;let bestLevel=0,isMatch=false,totalUnits=0,totalHrs=0;metrics.forEach(m=>{const attrs=m&&m.performanceMetricAttributes;if(!attrs)return;let fn='';try{const pa=typeof attrs.processAttributes==='string'?JSON.parse(attrs.processAttributes):attrs.processAttributes;fn=((pa&&pa.FUNCTION_NAME)||'').toLowerCase();}catch(e){}if(fnKeywords.some(k=>fn.includes(k))){isMatch=true;const lcStr=attrs.learningCurveId||'';const lvl=parseInt((lcStr.match(/\d/)||['0'])[0])||0;if(lvl>bestLevel)bestLevel=lvl;const u=parseFloat(attrs.totalUnitsProcessed||attrs.units||attrs.totalUnits||attrs.jobCount||0)||0;const h=parseFloat(attrs.totalHoursWorked||attrs.hours||attrs.totalPaidHours||attrs.paidHours||0)||0;const r=parseFloat(attrs.rate||attrs.uph||attrs.jph||attrs.throughput||0)||0;totalUnits+=u;totalHrs+=h;if(r>0&&totalUnits===0)totalUnits=r;}});if(isMatch&&!seen.has(eid)){seen.add(eid);const lvlKey=bestLevel>=1&&bestLevel<=5?bestLevel:'unknown';lcCounts[lvlKey]++;if(totalHrs>0&&totalHrs<200)lcRates[lvlKey].push(totalUnits/totalHrs);else if(totalUnits>0&&totalUnits<=300)lcRates[lvlKey].push(totalUnits);}});}}catch(e){console.warn('[SB-LC] ADAPT parse error:',e);}done++;if(done===batches.length){console.log('[SB-LC] ADAPT done. counts=',JSON.stringify(lcCounts),'rate lens=',Object.keys(lcRates).map(k=>k+':'+lcRates[k].length).join(','));if(lcRates[5].length>0)console.log('[SB-LC] LC5 sample rates:',lcRates[5].slice(0,5));updateLCDisplay(displayElId,lcCounts,lcRates);}},
            onerror:function(){done++;if(done===batches.length)updateLCDisplay(displayElId,lcCounts,lcRates);},
            ontimeout:function(){done++;if(done===batches.length)updateLCDisplay(displayElId,lcCounts,lcRates);}
        });
    });
}
function updateLCDisplay(elId,lcCounts,lcRates){
    const el=document.getElementById(elId);if(!el)return;
    // Save LC data to localStorage for per-period retention
    try{const key='sb_lc_'+elId;localStorage.setItem(key,JSON.stringify({counts:lcCounts,rates:lcRates,ts:Date.now()}));}catch(e){}
    if(!lcCounts){
        // Try loading from localStorage cache
        try{const cached=JSON.parse(localStorage.getItem('sb_lc_'+elId));if(cached&&cached.counts){lcCounts=cached.counts;lcRates=cached.rates;}}catch(e){}
        if(!lcCounts){el.innerHTML='<span style="color:#5B6B7A;">Learning Curve Mix: \u2014</span>';return;}
    }
    const total=lcCounts[1]+lcCounts[2]+lcCounts[3]+lcCounts[4]+lcCounts[5]+(lcCounts.unknown||0);
    if(total===0){el.innerHTML='<span style="color:#5B6B7A;">Learning Curve Mix: No data</span>';return;}
    const pct=(n)=>Math.round((n/total)*100);
    const avgRate=(lvl)=>{const rates=(lcRates&&lcRates[lvl])||[];if(rates.length===0)return'';const avg=rates.reduce((a,b)=>a+b,0)/rates.length;if(avg>300||avg<1)return'';return` (${Math.round(avg)} UPH)`;};
    const parts=[];
    if(lcCounts[5]>0)parts.push(`<span style="color:#27AE60;font-weight:bold;">LC5 ${pct(lcCounts[5])}%${avgRate(5)}</span>`);
    if(lcCounts[4]>0)parts.push(`<span style="color:#5B6B7A;font-weight:bold;">LC4 ${pct(lcCounts[4])}%${avgRate(4)}</span>`);
    if(lcCounts[3]>0)parts.push(`<span style="color:#eab308;">LC3 ${pct(lcCounts[3])}%${avgRate(3)}</span>`);
    const l12=lcCounts[1]+lcCounts[2];
    if(l12>0){const r12=[...(lcRates[1]||[]),...(lcRates[2]||[])];let avg12='';if(r12.length>0){const a=r12.reduce((x,y)=>x+y,0)/r12.length;if(a<=300&&a>=1)avg12=` (${Math.round(a)} UPH)`;}parts.push(`<span style="color:#F2994A;font-weight:bold;">LC1-2 ${pct(l12)}%${avg12}</span>`);}
    el.innerHTML=`<span style="color:#5B6B7A;font-weight:600;">Learning Curve Mix</span> &nbsp; ${parts.join(' <span style="color:#555;">\u2022</span> ')}`;
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
        // Direct Hours = Case Transfer In + Case Stow to Reserve + Pallet Transfer In
        const ibDH=(stow.directHours||0)+caseStowReserve+(pStow.directHours||0);
        const ibTotalHrs=ibPPRHrs>0?ibPPRHrs:ibDH;
        // Indirect Hours = Total IB - Direct Hours
        const ibIndirect=Math.max(ibTotalHrs-ibDH,0);
        // CPLH = total volume / total hours (IB PPR total)
        const cplhHrs=ibTotalHrs;
        const dur=pDurations[p]||1;
        m.ib[p]={totalStow:ibU,stowUnits:stow.totalUnits||0,palletUnits:pStow.totalUnits||0,palletCases,
            directHours:ibDH,indirectHours:ibIndirect,totalHours:ibTotalHrs,
            directPct:ibTotalHrs>0?(ibDH/ibTotalHrs)*100:0,indirectPct:ibTotalHrs>0?(ibIndirect/ibTotalHrs)*100:0,
            rate:stow.rate||0,headcount:(stow.headcount||0)+(pStow.headcount||0),
            cplh:cplhHrs>0?ibU/cplhHrs:0,
            density:(stow.caseUnits||0)>0?(stow.eachUnits||0)/(stow.caseUnits||1):0,
            directHC:dur>0?ibDH/dur:0,indirectHC:dur>0?ibIndirect/dur:0,
            pprPlannedHrs:ppr.ibPlannedHrs||0,pprActualHrs:ibPPRHrs,
            pctToOP:(ppr.ibPlannedHrs||0)>0?(ibPPRHrs/ppr.ibPlannedHrs)*100:0};
        // OB: Total Hours = DA Bldg to Bldg Transfer TOTAL, Direct = Transfer Out Pick (pick fn rollup), Indirect = Total - Direct
        const daHrs=ppr.daTransferHrs||0;
        const obPickDH=pick.directHours||0;
        const obTotalHrs=daHrs;
        const obIndirect=Math.max(obTotalHrs-obPickDH,0);
        const daPlan=ppr.daTransferPlan||0;
        // Loaded = Fluid Load Case jobs + Fluid Load Tote jobs
        const loadedUnits=obDock.fluidLoadJobs||0;
        m.ob[p]={pickUnits:pick.totalUnits||0,loadedUnits:loadedUnits,
            directHours:obPickDH,indirectHours:obIndirect,totalHours:obTotalHrs,
            directPct:obTotalHrs>0?(obPickDH/obTotalHrs)*100:0,indirectPct:obTotalHrs>0?(obIndirect/obTotalHrs)*100:0,
            pickRate:pick.rate||0,pickHC:pick.headcount||0,dockHC:obDock.headcount||0,
            cplh:obTotalHrs>0?loadedUnits/obTotalHrs:0,
            density:(obDock.caseUnits||0)>0?(obDock.eachUnits||0)/(obDock.caseUnits||1):0,
            directHC:dur>0?obPickDH/dur:0,indirectHC:dur>0?obIndirect/dur:0,
            pprPlannedHrs:daPlan,pprActualHrs:daHrs,
            pctToOP:daPlan>0?(daHrs/daPlan)*100:0};
        m.sort[p]={totalUnits:sort.totalUnits||0,directHours:sort.directHours||0,totalHours:sort.directHours||0,rate:sort.rate||0,headcount:sort.headcount||0,cplh:(sort.directHours||0)>0?sort.totalUnits/sort.directHours:0};
    });
    // Cumulative — only for totalStow (sync metrics). Everything else stays per-period raw.
    if(m.ib.p1&&m.ib.p2&&(raw.p2?.stow?.totalUnits>0||raw.p2?.palletStow?.palletCases>0)){
        m.ib.p2.totalStow=(m.ib.p1.totalStow||0)+((raw.p2?.stow?.totalUnits||0)+(raw.p2?.palletStow?.palletCases||0));
        m.ob.p2.pickUnits=(m.ob.p1.pickUnits||0)+(raw.p2?.pick?.totalUnits||0);
        m.ob.p2.loadedUnits=(m.ob.p1.loadedUnits||0)+(raw.p2?.obDock?.fluidLoadJobs||0);
        m.sort.p2.totalUnits=(m.sort.p1.totalUnits||0)+(raw.p2?.sort?.totalUnits||0);
    }
    if(m.ib.p2&&m.ib.p3&&(raw.p3?.stow?.totalUnits>0||raw.p3?.palletStow?.palletCases>0||raw.p3?.pick?.totalUnits>0)){
        m.ib.p3.totalStow=m.ib.full?.totalStow||(m.ib.p2.totalStow||0)+((raw.p3?.stow?.totalUnits||0)+(raw.p3?.palletStow?.palletCases||0));
        m.ob.p3.pickUnits=m.ob.full?.pickUnits||(m.ob.p2.pickUnits||0)+(raw.p3?.pick?.totalUnits||0);
        m.ob.p3.loadedUnits=m.ob.full?.loadedUnits||(m.ob.p2.loadedUnits||0)+(raw.p3?.obDock?.fluidLoadJobs||0);
        m.sort.p3.totalUnits=m.sort.full?.totalUnits||(m.sort.p2.totalUnits||0)+(raw.p3?.sort?.totalUnits||0);
    }
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
            const prefixes=['ib-sync-','ib-stow-','ib-cases-','ib-pallets-','ib-cti-','ib-rate-','ib-density-','ib-dhrs-','ib-dpct-','ib-ihrs-','ib-ipct-','ib-thrs-','ib-cplh-','ib-op-',
                'ob-sync-','ob-pick-','ob-cases-','ob-rate-','ob-density-','ob-loadp-','ob-dhrs-','ob-dpct-','ob-ihrs-','ob-ipct-','ob-thrs-','ob-cplh-','ob-op-',
                'sort-total-','sort-units-','sort-rate-','sort-dhrs-','sort-cplh-'];
            prefixes.forEach(pre=>{const el=document.getElementById(pre+pk);if(el){el.textContent='';el.style.background='';}});
        }
    });
}

// === RENDER ===
function renderIB(m){
    const p1=m.ib.p1||{},p2=m.ib.p2||{},p3=m.ib.p3||{},f=m.ib.full||{};
    setEl('ib-sync-p1',fmt(p1.totalStow));setEl('ib-sync-p2',fmt(p2.totalStow));setEl('ib-sync-p3',fmt(p3.totalStow));setEl('ib-sync-total',fmt(f.totalStow));
    // Conditional format sync metrics cells vs targets
    const ibG=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    if(ibG>0){const periods=loadConfig().schedType==='4Q'?4:3;const cc=cfColors();
        [['ib-sync-p1',p1.totalStow,ibG/periods],['ib-sync-p2',p2.totalStow,ibG/periods*2],['ib-sync-p3',p3.totalStow,ibG],['ib-sync-total',f.totalStow,ibG]].forEach(([id,act,tgt])=>{
            const el=document.getElementById(id);if(!el)return;if(!act||act<=0){el.style.background='';return;}el.style.background=act>=tgt?cc.good:act>=tgt*0.95?cc.warn:cc.bad;});
    }
    setEl('ib-cases-p1',fmt(p1.stowUnits));setEl('ib-cases-p2',fmt(p2.stowUnits));setEl('ib-cases-p3',fmt(p3.stowUnits));setEl('ib-cases-total',fmt(f.stowUnits));
    setEl('ib-pallets-p1',fmt(p1.palletUnits||0));setEl('ib-pallets-p2',fmt(p2.palletUnits||0));setEl('ib-pallets-p3',fmt(p3.palletUnits||0));setEl('ib-pallets-total',fmt(f.palletUnits||0));
    setEl('ib-cti-p1',fmt(p1.totalStow));setEl('ib-cti-p2',fmt(p2.totalStow));setEl('ib-cti-p3',fmt(p3.totalStow));setEl('ib-cti-total',fmt(f.totalStow));
    setEl('ib-rate-p1',fmt(p1.rate,1));setEl('ib-rate-p2',fmt(p2.rate,1));setEl('ib-rate-p3',fmt(p3.rate,1));setEl('ib-rate-total',fmt(f.rate,1));
    // IB Density
    setEl('ib-density-p1',p1.density>0?fmt(p1.density,2):'\u2014');setEl('ib-density-p2',p2.density>0?fmt(p2.density,2):'\u2014');setEl('ib-density-p3',p3.density>0?fmt(p3.density,2):'\u2014');setEl('ib-density-total',f.density>0?fmt(f.density,2):'\u2014');
    // Conditional format IB density vs planned
    const ibDT=parseFloat(document.getElementById('ib-density-target')?.value)||0;
    if(ibDT>0){const dc=cfDensityColors();['ib-density-p1','ib-density-p2','ib-density-p3','ib-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=ibDT){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=ibDT*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
    // Rate conditional formatting handled by renderLPPercents (LP rate)
    setEl('ib-dhrs-p1',fmt(p1.directHours,2));setEl('ib-dhrs-p2',fmt(p2.directHours,2));setEl('ib-dhrs-p3',fmt(p3.directHours,2));setEl('ib-dhrs-total',fmt(f.directHours,2));
    setEl('ib-dpct-p1',fmtPct(p1.directPct));setEl('ib-dpct-p2',fmtPct(p2.directPct));setEl('ib-dpct-p3',fmtPct(p3.directPct));setEl('ib-dpct-total',fmtPct(f.directPct));
    setEl('ib-ihrs-p1',fmt(p1.indirectHours,2));setEl('ib-ihrs-p2',fmt(p2.indirectHours,2));setEl('ib-ihrs-p3',fmt(p3.indirectHours,2));setEl('ib-ihrs-total',fmt(f.indirectHours,2));
    setEl('ib-ipct-p1',fmtPct(p1.indirectPct));setEl('ib-ipct-p2',fmtPct(p2.indirectPct));setEl('ib-ipct-p3',fmtPct(p3.indirectPct));setEl('ib-ipct-total',fmtPct(f.indirectPct));
    setEl('ib-thrs-p1',fmt(p1.totalHours,2));setEl('ib-thrs-p2',fmt(p2.totalHours,2));setEl('ib-thrs-p3',fmt(p3.totalHours,2));setEl('ib-thrs-total',fmt(f.totalHours,2));
    setEl('ib-cplh-p1',fmt(p1.cplh,2));setEl('ib-cplh-p2',fmt(p2.cplh,2));setEl('ib-cplh-p3',fmt(p3.cplh,2));setEl('ib-cplh-total',fmt(f.cplh,2));
    // CPLH conditional formatting handled by renderLPPercents (LP CPLH)
    // % to LP will be populated by renderLPPercents
    ['ib-op-p1','ib-op-p2','ib-op-p3','ib-op-total'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.style.background='';}});
    setEl('ib-timestamp',new Date().toLocaleString()+' MST');
}
function renderOB(m){
    const p1=m.ob.p1||{},p2=m.ob.p2||{},p3=m.ob.p3||{},f=m.ob.full||{};
    setEl('ob-sync-p1',fmt(p1.loadedUnits));setEl('ob-sync-p2',fmt(p2.loadedUnits));setEl('ob-sync-p3',fmt(p3.loadedUnits));setEl('ob-sync-total',fmt(f.loadedUnits));
    // Conditional format OB sync metrics cells vs targets (based on loaded)
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    if(obG>0){const periods=loadConfig().schedType==='4Q'?4:3;const cc=cfColors();
        [['ob-sync-p1',p1.loadedUnits,obG/periods],['ob-sync-p2',p2.loadedUnits,obG/periods*2],['ob-sync-p3',p3.loadedUnits,obG],['ob-sync-total',f.loadedUnits,obG]].forEach(([id,act,tgt])=>{
            const el=document.getElementById(id);if(!el)return;if(!act||act<=0){el.style.background='';return;}el.style.background=act>=tgt?cc.good:act>=tgt*0.95?cc.warn:cc.bad;});
    }
    setEl('ob-pick-p1',fmt(p1.pickUnits));setEl('ob-pick-p2',fmt(p2.pickUnits));setEl('ob-pick-p3',fmt(p3.pickUnits));setEl('ob-pick-total',fmt(f.pickUnits));
    setEl('ob-cases-p1',fmt(p1.pickUnits));setEl('ob-cases-p2',fmt(p2.pickUnits));setEl('ob-cases-p3',fmt(p3.pickUnits));setEl('ob-cases-total',fmt(f.pickUnits));
    setEl('ob-rate-p1',fmt(p1.pickRate,1));setEl('ob-rate-p2',fmt(p2.pickRate,1));setEl('ob-rate-p3',fmt(p3.pickRate,1));setEl('ob-rate-total',fmt(f.pickRate,1));
    // OB Density
    setEl('ob-density-p1',p1.density>0?fmt(p1.density,2):'\u2014');setEl('ob-density-p2',p2.density>0?fmt(p2.density,2):'\u2014');setEl('ob-density-p3',p3.density>0?fmt(p3.density,2):'\u2014');setEl('ob-density-total',f.density>0?fmt(f.density,2):'\u2014');
    // Conditional format OB density vs planned
    const obDT=parseFloat(document.getElementById('ob-density-target')?.value)||0;
    if(obDT>0){const dc=cfDensityColors();['ob-density-p1','ob-density-p2','ob-density-p3','ob-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=obDT){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=obDT*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
    // Rate conditional formatting handled by renderLPPercents (LP rate)
    setEl('ob-loadp-p1',fmt(p1.loadedUnits));setEl('ob-loadp-p2',fmt(p2.loadedUnits));setEl('ob-loadp-p3',fmt(p3.loadedUnits));setEl('ob-loadp-total',fmt(f.loadedUnits));
    // Conditional format Loaded per Period cells vs targets
    if(obG>0){const periods=loadConfig().schedType==='4Q'?4:3;const cc2=cfColors();
        [['ob-loadp-p1',p1.loadedUnits,obG/periods],['ob-loadp-p2',p2.loadedUnits,obG/periods*2],['ob-loadp-p3',p3.loadedUnits,obG],['ob-loadp-total',f.loadedUnits,obG]].forEach(([id,act,tgt])=>{
            const el=document.getElementById(id);if(!el)return;if(!act||act<=0){el.style.background='';return;}el.style.background=act>=tgt?cc2.good:act>=tgt*0.95?cc2.warn:cc2.bad;});
    }
    setEl('ob-dhrs-p1',fmt(p1.directHours,2));setEl('ob-dhrs-p2',fmt(p2.directHours,2));setEl('ob-dhrs-p3',fmt(p3.directHours,2));setEl('ob-dhrs-total',fmt(f.directHours,2));
    setEl('ob-dpct-p1',fmtPct(p1.directPct));setEl('ob-dpct-p2',fmtPct(p2.directPct));setEl('ob-dpct-p3',fmtPct(p3.directPct));setEl('ob-dpct-total',fmtPct(f.directPct));
    setEl('ob-ihrs-p1',fmt(p1.indirectHours,2));setEl('ob-ihrs-p2',fmt(p2.indirectHours,2));setEl('ob-ihrs-p3',fmt(p3.indirectHours,2));setEl('ob-ihrs-total',fmt(f.indirectHours,2));
    setEl('ob-ipct-p1',fmtPct(p1.indirectPct));setEl('ob-ipct-p2',fmtPct(p2.indirectPct));setEl('ob-ipct-p3',fmtPct(p3.indirectPct));setEl('ob-ipct-total',fmtPct(f.indirectPct));
    setEl('ob-thrs-p1',fmt(p1.totalHours,2));setEl('ob-thrs-p2',fmt(p2.totalHours,2));setEl('ob-thrs-p3',fmt(p3.totalHours,2));setEl('ob-thrs-total',fmt(f.totalHours,2));
    setEl('ob-cplh-p1',fmt(p1.cplh,2));setEl('ob-cplh-p2',fmt(p2.cplh,2));setEl('ob-cplh-p3',fmt(p3.cplh,2));setEl('ob-cplh-total',fmt(f.cplh,2));
    // CPLH conditional formatting handled by renderLPPercents (LP CPLH)
    // % to LP will be populated by renderLPPercents
    ['ob-op-p1','ob-op-p2','ob-op-p3','ob-op-total'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.style.background='';}});
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
    const ibDensityT=parseFloat(document.getElementById('ib-density-target')?.value)||0;
    if(ibDensityT>0&&f.density){const p=(f.density/ibDensityT)*100;const el=setEl('ib-density-pct',fmtPct(p));setPctClass(el,p);}
    if(obG>0){const p=(ob.loadedUnits||0)/obG*100;const el=setEl('ob-goal-pct',fmtPct(p));setPctClass(el,p);}
    // OB Rate % to goal
    const obRateT=parseFloat(document.getElementById('ob-rate-target')?.value)||0;
    const obCplhT=parseFloat(document.getElementById('ob-cplh-target')?.value)||0;
    if(obRateT>0&&ob.pickRate){const p=(ob.pickRate/obRateT)*100;const el=setEl('ob-rate-pct',fmtPct(p));setPctClass(el,p);}
    if(obCplhT>0&&ob.cplh){const p=(ob.cplh/obCplhT)*100;const el=setEl('ob-cplh-pct',fmtPct(p));setPctClass(el,p);}
    const obDensityT=parseFloat(document.getElementById('ob-density-target')?.value)||0;
    if(obDensityT>0&&ob.density){const p=(ob.density/obDensityT)*100;const el=setEl('ob-density-pct',fmtPct(p));setPctClass(el,p);}
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
        // If shift is complete, just check if goal was met
        if(elapsed>=shiftDuration){
            if(actualPct>=100)return 'green';
            if(actualPct>=95)return 'amber';
            return 'red';
        }
        const pctElapsed=(elapsed/shiftDuration)*100;
        if(actualPct>=pctElapsed)return 'green';
        if(actualPct>=pctElapsed-10)return 'amber';
        return 'red';
    }
    setEl('sum-stow-goal',ibG>0?fmt(ibG):'—');setEl('sum-stow-rate',f.rate?fmt(f.rate,1):'—');setEl('sum-ib-cplh',f.cplh?fmt(f.cplh,2):'—');
    if(ibG>0&&f.totalStow){const p=(f.totalStow/ibG)*100;const el=setEl('sum-ib-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ib-actual',fmt(f.totalStow));setEl('sum-ib-remaining',fmt(ibG-f.totalStow));
        const bar=document.getElementById('ib-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    // Position period markers on IB bar
    const periods=config.schedType==='4Q'?4:3;
    const ibM1=document.getElementById('ib-marker-p1');const ibM2=document.getElementById('ib-marker-p2');
    if(ibM1)ibM1.style.left=(100/periods)+'%';if(ibM2)ibM2.style.left=(200/periods)+'%';
    setEl('sum-pick-goal',obG>0?fmt(obG):'—');setEl('sum-pick-rate',ob.pickRate?fmt(ob.pickRate,1):'—');setEl('sum-ob-cplh',ob.cplh?fmt(ob.cplh,2):'—');
    if(obG>0&&ob.loadedUnits){const p=(ob.loadedUnits/obG)*100;const el=setEl('sum-ob-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ob-actual',fmt(ob.loadedUnits));setEl('sum-ob-remaining',fmt(obG-ob.loadedUnits));
        const bar=document.getElementById('ob-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    const obM1=document.getElementById('ob-marker-p1');const obM2=document.getElementById('ob-marker-p2');
    if(obM1)obM1.style.left=(100/periods)+'%';if(obM2)obM2.style.left=(200/periods)+'%';
    setEl('sum-sort-goal',sortG>0?fmt(sortG):'—');setEl('sum-sort-rate',sf.rate?fmt(sf.rate,1):'—');setEl('sum-sort-cplh',sf.cplh?fmt(sf.cplh,2):'—');
    if(sortG>0&&sf.totalUnits){const p=(sf.totalUnits/sortG)*100;const el=setEl('sum-sort-pct',fmtPct(p));const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-sort-actual',fmt(sf.totalUnits));setEl('sum-sort-remaining',fmt(sortG-sf.totalUnits));
        const bar=document.getElementById('sort-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    // Pace Insights — use most recent period's active headcount (from function rollup employee links)
    const ibActiveHC=(m.ib.p3?.headcount>0?m.ib.p3.headcount:m.ib.p2?.headcount>0?m.ib.p2.headcount:m.ib.p1?.headcount)||0;
    const obActiveHC=(m.ob.p3?.pickHC>0?m.ob.p3.pickHC:m.ob.p2?.pickHC>0?m.ob.p2.pickHC:m.ob.p1?.pickHC)||0;
    renderPaceInsight('ib-pace-insight',ibG,f.totalStow||0,f.rate||0,ibActiveHC,config);
    renderPaceInsight('ob-pace-insight',obG,ob.loadedUnits||0,ob.pickRate||0,obActiveHC,config);
}
function renderPaceInsight(elId,goal,actual,rate,hc,config){
    const el=document.getElementById(elId);if(!el)return;
    if(!goal||!actual||!rate||goal<=0){el.textContent='';return;}
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const now=new Date(),cm=now.getHours()*60+now.getMinutes();
    // Use P1 start to P3 end as actual production window (not the padded full window)
    const prodStart=sched.p1.sh*60+sched.p1.sm,prodEnd=sched.p3.eh*60+sched.p3.em;
    let shiftDuration,elapsed;
    if(prodEnd>prodStart){shiftDuration=prodEnd-prodStart;elapsed=cm-prodStart;}
    else{shiftDuration=(1440-prodStart)+prodEnd;elapsed=cm>=prodStart?cm-prodStart:(1440-prodStart)+cm;}
    if(elapsed<0)elapsed=0;
    // Subtract 60 min of breaks (2x 30-min) from production duration
    const productiveDuration=shiftDuration-60;
    const productiveElapsed=Math.min(elapsed,productiveDuration);
    const remaining=Math.max((productiveDuration-productiveElapsed)/60,0); // productive hours left
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
    const isDk=document.getElementById('sb-root')?.classList.contains('dark-mode');
    const txtC=isDk?'#e0e0e0':'#000';const gridC=isDk?'#444':'#ddd';const y2C=isDk?'#ffab40':'#e65100';
    const baseOpts=(yL,y2L)=>({responsive:true,maintainAspectRatio:false,interaction:{mode:'index',intersect:false},plugins:{legend:{labels:{color:txtC,font:{size:9},boxWidth:10}}},scales:{x:{ticks:{color:txtC,font:{size:9}},grid:{color:gridC}},y:{ticks:{color:txtC,font:{size:9}},grid:{color:gridC},beginAtZero:true,title:{display:!!yL,text:yL||'',color:txtC,font:{size:9}}},y2:{position:'right',ticks:{color:y2C,font:{size:9}},grid:{drawOnChartArea:false},beginAtZero:true,title:{display:!!y2L,text:y2L||'',color:y2C,font:{size:9}}}}});
    function make(id,data,opts){const ctx=document.getElementById(id);if(!ctx)return;if(charts[id])charts[id].destroy();charts[id]=new Chart(ctx,{type:'bar',data,options:opts});}
    // Stow
    const sp=ibG>0?[Math.round(ibG/periods),Math.round(ibG/periods*2),Math.round(ibG)]:[0,0,0];
    make('chart-stow',{labels,datasets:[{type:'bar',label:'Planned',data:[val(sp[0],0),val(sp[1],1),val(sp[2],2)],backgroundColor:'rgba(180,180,180,0.5)',borderColor:'#999',borderWidth:1,yAxisID:'y'},{type:'bar',label:'Actual',data:[val(m.ib.p1?.totalStow||0,0),val(m.ib.p2?.totalStow||0,1),val(m.ib.p3?.totalStow||0,2)],backgroundColor:'rgba(0,0,0,0.75)',borderColor:'#000',borderWidth:1,yAxisID:'y'},{type:'line',label:'Rate',data:[val(m.ib.p1?.rate||0,0),val(m.ib.p2?.rate||0,1),val(m.ib.p3?.rate||0,2)],borderColor:'#e65100',borderWidth:2,pointRadius:4,pointBackgroundColor:'#e65100',tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('Stowed','Rate'));
    // CPLH
    make('chart-cplh-ib',{labels,datasets:[{type:'bar',label:'CPLH',data:[val(m.ib.p1?.cplh||0,0),val(m.ib.p2?.cplh||0,1),val(m.ib.p3?.cplh||0,2)],backgroundColor:'rgba(0,0,0,0.75)',borderColor:'#000',borderWidth:1,yAxisID:'y'},{type:'line',label:'Direct%',data:[val(m.ib.p1?.directPct||0,0),val(m.ib.p2?.directPct||0,1),val(m.ib.p3?.directPct||0,2)],borderColor:'#1565c0',borderWidth:2,pointRadius:3,tension:.2,yAxisID:'y2',spanGaps:false},{type:'line',label:'Indirect%',data:[val(m.ib.p1?.indirectPct||0,0),val(m.ib.p2?.indirectPct||0,1),val(m.ib.p3?.indirectPct||0,2)],borderColor:'#e65100',borderWidth:2,pointRadius:3,tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('CPLH','Spend %'));
    // Pick
    const pp=obG>0?[Math.round(obG/periods),Math.round(obG/periods*2),Math.round(obG)]:[0,0,0];
    make('chart-pick',{labels,datasets:[{type:'bar',label:'Planned',data:[val(pp[0],0),val(pp[1],1),val(pp[2],2)],backgroundColor:'rgba(180,180,180,0.5)',borderColor:'#999',borderWidth:1,yAxisID:'y'},{type:'bar',label:'Actual',data:[val(m.ob.p1?.pickUnits||0,0),val(m.ob.p2?.pickUnits||0,1),val(m.ob.p3?.pickUnits||0,2)],backgroundColor:'rgba(0,0,0,0.75)',borderColor:'#000',borderWidth:1,yAxisID:'y'},{type:'line',label:'Rate',data:[val(m.ob.p1?.pickRate||0,0),val(m.ob.p2?.pickRate||0,1),val(m.ob.p3?.pickRate||0,2)],borderColor:'#e65100',borderWidth:2,pointRadius:4,pointBackgroundColor:'#e65100',tension:.2,yAxisID:'y2',spanGaps:false}]},baseOpts('Picked','Pick Rate'));
    // Loaded
    make('chart-loaded',{labels,datasets:[{type:'bar',label:'Picked',data:[val(m.ob.p1?.pickUnits||0,0),val(m.ob.p2?.pickUnits||0,1),val(m.ob.p3?.pickUnits||0,2)],backgroundColor:'rgba(230,81,0,0.7)',borderColor:'#e65100',borderWidth:1},{type:'bar',label:'Loaded',data:[val(m.ob.p1?.loadedUnits||0,0),val(m.ob.p2?.loadedUnits||0,1),val(m.ob.p3?.loadedUnits||0,2)],backgroundColor:'rgba(46,125,50,0.7)',borderColor:'#2e7d32',borderWidth:1}]},baseOpts('Units'));
}

// === ACTIONS ===
function renderActions(){
    const actions=loadActions(),tbody=document.getElementById('actions-body');if(!tbody)return;
    tbody.innerHTML='';
    actions.forEach((a,i)=>{const tr=document.createElement('tr');tr.innerHTML=`<td><input type="text" value="${a.time||''}" data-i="${i}" data-f="time" style="width:50px;text-align:center;" placeholder="HH:MM"></td><td><textarea data-i="${i}" data-f="item" rows="2" style="width:100%;min-width:300px;resize:none;font-family:inherit;word-wrap:break-word;white-space:pre-wrap;">${a.item||''}</textarea></td><td><input type="text" value="${a.owner||''}" data-i="${i}" data-f="owner" style="width:80px"></td><td><select data-i="${i}" data-f="status"><option ${a.status==='Open'?'selected':''}>Open</option><option ${a.status==='In Progress'?'selected':''}>In Progress</option><option ${a.status==='Done'?'selected':''}>Done</option></select></td><td><span class="action-delete" data-i="${i}">\u2715</span></td>`;tbody.appendChild(tr);});
    tbody.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('change',()=>{const a=loadActions(),i=+el.dataset.i;if(a[i]){a[i][el.dataset.f]=el.value;saveActions(a);renderTimeline();}}));
    // Auto-resize textareas to fit content
    tbody.querySelectorAll('textarea').forEach(ta=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';ta.addEventListener('input',()=>{ta.style.height='auto';ta.style.height=ta.scrollHeight+'px';});});
    tbody.querySelectorAll('.action-delete').forEach(el=>el.addEventListener('click',()=>{const a=loadActions();a.splice(+el.dataset.i,1);saveActions(a);renderActions();renderTimeline();}));
    renderTimeline();
}
function renderTimeline(){
    const container=document.getElementById('shift-timeline');if(!container)return;
    const config=loadConfig();
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const startH=sched.full.sh,endH=sched.full.eh;
    // Build array of hours in the shift
    const hours=[];
    let h=startH;
    for(let i=0;i<12;i++){hours.push(h%24);h=(h+1)%24;if(hours.length>1&&h===(endH+1)%24)break;}
    const actions=loadActions();
    const now=new Date();const currentH=now.getHours();
    container.innerHTML='';
    hours.forEach(hr=>{
        const div=document.createElement('div');
        div.className='timeline-hour';
        if(hr===currentH)div.classList.add('current-hour');
        // Check if any actions at this hour
        const hrStr=String(hr).padStart(2,'0');
        const hasAction=actions.some(a=>a.time&&a.time.startsWith(hrStr));
        if(hasAction)div.classList.add('has-action');
        div.textContent=hr>12?hr-12+'p':hr===0?'12a':hr===12?'12p':hr+'a';
        div.title=hrStr+':00';
        div.onclick=()=>{const a=loadActions();a.push({time:hrStr+':00',item:'',owner:'',status:'Open'});saveActions(a);renderActions();};
        container.appendChild(div);
    });
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
<nav class="topnav"><div class="topnav-left"><span class="logo"><svg width="28" height="28" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="46" fill="#333A44" stroke="#4a9eff" stroke-width="4"/><path d="M25 65 L25 40 L50 28 L75 40 L75 65 Z" fill="none" stroke="#E8EAED" stroke-width="3" stroke-linejoin="round"/><line x1="25" y1="65" x2="75" y2="65" stroke="#E8EAED" stroke-width="3"/><rect x="30" y="45" width="16" height="20" fill="none" stroke="#E8EAED" stroke-width="2"/><line x1="30" y1="50" x2="46" y2="50" stroke="#E8EAED" stroke-width="1.5"/><line x1="30" y1="55" x2="46" y2="55" stroke="#E8EAED" stroke-width="1.5"/><line x1="30" y1="60" x2="46" y2="60" stroke="#E8EAED" stroke-width="1.5"/><rect x="54" y="48" width="14" height="17" fill="none" stroke="#E8EAED" stroke-width="2"/><rect x="57" y="52" width="4" height="5" fill="#E8EAED"/><rect x="62" y="55" width="3" height="4" fill="#E8EAED"/></svg></span><h1 class="site-title">FC Sync Board<span style="display:block;font-size:10px;font-weight:400;color:#aaa;margin-top:-2px;">by snodgtyl</span></h1>
<div class="nav-tabs"><button class="nav-tab active" data-tab="sync">Sync IB-OB</button><button class="nav-tab" data-tab="hourly">Hourly</button><button class="nav-tab" data-tab="settings">Settings</button></div></div>
<div class="topnav-right"><select id="site-select" class="select-input"></select><select id="shift-select" class="select-input"><option value="Days">Days</option><option value="Nights">Nights</option></select>
<div class="period-indicator"><span class="period-dot" id="dot-p1">P1</span><span class="period-dot" id="dot-p2">P2</span><span class="period-dot" id="dot-p3">P3</span></div>
<button id="btn-fetch" class="btn btn-primary">\u25B6 Get Data</button><button id="btn-snip" class="btn btn-snip">\uD83D\uDCF7 Snip</button><button id="btn-dark" class="btn" style="background:#333;color:#fff;border-color:#333;">\u263D</button><button id="btn-exit" class="btn btn-danger">\u2715 Exit</button><span id="last-update" class="meta-text">Ready</span></div></nav>

<main id="tab-sync" class="tab-content active"><div class="sync-layout">
<div class="sync-left">

<section class="metrics-section"><div class="section-header"><h2>SYNC Actions</h2><div><button id="btn-add-action" class="btn btn-small">+ Add</button> <button id="btn-clear-actions" class="btn btn-small btn-danger">Clear</button></div></div>
<div class="shift-timeline" id="shift-timeline"></div>
<table class="actions-table" style="margin-top:8px;width:100%;"><thead><tr><th style="width:55px;">Time</th><th>Action Item</th><th style="width:100px;">Owner</th><th style="width:90px;">Status</th><th style="width:20px;"></th></tr></thead><tbody id="actions-body"></tbody></table></section>

<section class="metrics-section ib-section"><div class="section-header"><h2>INBOUND | NTP</h2><span class="fclm-timestamp" id="ib-timestamp">\u2014</span></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="ib-target-p1">\u2014</td><td id="ib-target-p2">\u2014</td><td id="ib-target-p3">\u2014</td><td id="ib-target-total">\u2014</td></tr>
<tr class="row-sync"><td class="bold">Sync Metrics</td><td id="ib-sync-p1">0</td><td id="ib-sync-p2">0</td><td id="ib-sync-p3">0</td><td id="ib-sync-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Cases Stowed</td><td id="ib-cases-p1">0</td><td id="ib-cases-p2">0</td><td id="ib-cases-p3">0</td><td id="ib-cases-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Pallets Stowed</td><td id="ib-pallets-p1">0</td><td id="ib-pallets-p2">0</td><td id="ib-pallets-p3">0</td><td id="ib-pallets-total">0</td></tr>
<tr><td>&nbsp;&nbsp;CTI/PTI per period</td><td id="ib-cti-p1">0</td><td id="ib-cti-p2">0</td><td id="ib-cti-p3">0</td><td id="ib-cti-total">0</td></tr>
<tr class="row-rate"><td>Stow Rate <span style="margin-left:20px;font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-cti-rate-display">\u2014</span></span></td><td id="ib-rate-p1">\u2014</td><td id="ib-rate-p2">\u2014</td><td id="ib-rate-p3">\u2014</td><td id="ib-rate-total">\u2014</td></tr>
<tr><td>Density <span style="margin-left:20px;font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ib-density-display">\u2014</span></span></td><td id="ib-density-p1">\u2014</td><td id="ib-density-p2">\u2014</td><td id="ib-density-p3">\u2014</td><td id="ib-density-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="ib-dhrs-p1">0</td><td id="ib-dhrs-p2">0</td><td id="ib-dhrs-p3">0</td><td id="ib-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ib-dpct-p1">\u2014</td><td id="ib-dpct-p2">\u2014</td><td id="ib-dpct-p3">\u2014</td><td id="ib-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ib-ihrs-p1">0</td><td id="ib-ihrs-p2">0</td><td id="ib-ihrs-p3">0</td><td id="ib-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ib-ipct-p1">\u2014</td><td id="ib-ipct-p2">\u2014</td><td id="ib-ipct-p3">\u2014</td><td id="ib-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ib-thrs-p1">0</td><td id="ib-thrs-p2">0</td><td id="ib-thrs-p3">0</td><td id="ib-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH <span style="margin-left:20px;font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ib-cplh-display">\u2014</span></span></td><td id="ib-cplh-p1">\u2014</td><td id="ib-cplh-p2">\u2014</td><td id="ib-cplh-p3">\u2014</td><td id="ib-cplh-total">\u2014</td></tr>
<tr><td>% to LP</td><td id="ib-op-p1">\u2014</td><td id="ib-op-p2">\u2014</td><td id="ib-op-p3">\u2014</td><td id="ib-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ib-fast-p1">\u2014</td><td id="ib-fast-p2">\u2014</td><td id="ib-fast-p3">\u2014</td><td></td></tr>
<tr class="row-lc"><td colspan="5" id="ib-lc-display" style="font-size:11px;color:#5B6B7A;">Learning Curve Mix: \u2014</td></tr>
</tbody></table></section>

<section class="metrics-section ob-section"><div class="section-header"><h2>OUTBOUND | NTP</h2><span class="fclm-timestamp" id="ob-timestamp">\u2014</span></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="ob-target-p1">\u2014</td><td id="ob-target-p2">\u2014</td><td id="ob-target-p3">\u2014</td><td id="ob-target-total">\u2014</td></tr>
<tr class="row-sync"><td class="bold">Sync Metrics</td><td id="ob-sync-p1">0</td><td id="ob-sync-p2">0</td><td id="ob-sync-p3">0</td><td id="ob-sync-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Pick - Total</td><td id="ob-pick-p1">0</td><td id="ob-pick-p2">0</td><td id="ob-pick-p3">0</td><td id="ob-pick-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Cases Picked</td><td id="ob-cases-p1">0</td><td id="ob-cases-p2">0</td><td id="ob-cases-p3">0</td><td id="ob-cases-total">0</td></tr>
<tr class="row-rate"><td>Pick Rate <span style="margin-left:20px;font-size:11px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-top-rate-display">\u2014</span></span></td><td id="ob-rate-p1">\u2014</td><td id="ob-rate-p2">\u2014</td><td id="ob-rate-p3">\u2014</td><td id="ob-rate-total">\u2014</td></tr>
<tr><td>Density <span style="margin-left:20px;font-size:11px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ob-density-display">\u2014</span></span></td><td id="ob-density-p1">\u2014</td><td id="ob-density-p2">\u2014</td><td id="ob-density-p3">\u2014</td><td id="ob-density-total">\u2014</td></tr>
<tr><td>Loaded per Period</td><td id="ob-loadp-p1">0</td><td id="ob-loadp-p2">0</td><td id="ob-loadp-p3">0</td><td id="ob-loadp-total">0</td></tr>
<tr><td>Direct Hours</td><td id="ob-dhrs-p1">0</td><td id="ob-dhrs-p2">0</td><td id="ob-dhrs-p3">0</td><td id="ob-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ob-dpct-p1">\u2014</td><td id="ob-dpct-p2">\u2014</td><td id="ob-dpct-p3">\u2014</td><td id="ob-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ob-ihrs-p1">0</td><td id="ob-ihrs-p2">0</td><td id="ob-ihrs-p3">0</td><td id="ob-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ob-ipct-p1">\u2014</td><td id="ob-ipct-p2">\u2014</td><td id="ob-ipct-p3">\u2014</td><td id="ob-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ob-thrs-p1">0</td><td id="ob-thrs-p2">0</td><td id="ob-thrs-p3">0</td><td id="ob-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH <span style="margin-left:20px;font-size:11px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ob-cplh-display">\u2014</span></span></td><td id="ob-cplh-p1">\u2014</td><td id="ob-cplh-p2">\u2014</td><td id="ob-cplh-p3">\u2014</td><td id="ob-cplh-total">\u2014</td></tr>
<tr><td>% to LP</td><td id="ob-op-p1">\u2014</td><td id="ob-op-p2">\u2014</td><td id="ob-op-p3">\u2014</td><td id="ob-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ob-fast-p1">\u2014</td><td id="ob-fast-p2">\u2014</td><td id="ob-fast-p3">\u2014</td><td></td></tr>
<tr class="row-lc"><td colspan="5" id="ob-lc-display" style="font-size:11px;color:#5B6B7A;">Learning Curve Mix: \u2014</td></tr>
</tbody></table></section>

<section class="metrics-section sort-section" id="sort-section"><div class="section-header"><h2>SORT | NTP</h2></div>
<table class="metrics-table"><thead><tr><th></th><th>P1</th><th>P2</th><th>P3</th><th>Total</th></tr></thead><tbody>
<tr class="row-target"><td class="bold">Targets</td><td id="sort-target-p1">\u2014</td><td id="sort-target-p2">\u2014</td><td id="sort-target-p3">\u2014</td><td id="sort-target-total">\u2014</td></tr>
<tr><td>Sort - Total</td><td id="sort-total-p1">0</td><td id="sort-total-p2">0</td><td id="sort-total-p3">0</td><td id="sort-total-total">0</td></tr>
<tr><td>Sort (Units)</td><td id="sort-units-p1">0</td><td id="sort-units-p2">0</td><td id="sort-units-p3">0</td><td id="sort-units-total">0</td></tr>
<tr class="row-rate"><td>Sort Rate (UPH)</td><td id="sort-rate-p1">\u2014</td><td id="sort-rate-p2">\u2014</td><td id="sort-rate-p3">\u2014</td><td id="sort-rate-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="sort-dhrs-p1">0</td><td id="sort-dhrs-p2">0</td><td id="sort-dhrs-p3">0</td><td id="sort-dhrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH</td><td id="sort-cplh-p1">\u2014</td><td id="sort-cplh-p2">\u2014</td><td id="sort-cplh-p3">\u2014</td><td id="sort-cplh-total">\u2014</td></tr>
</tbody></table></section>

</div><!-- sync-left -->

<div class="sync-right">
<div class="goal-summary-col">
<div class="goal-card ib-card"><div class="goal-header"><span class="goal-title">Inbound</span><span class="goal-pct" id="sum-ib-pct">\u2014</span></div><div class="goal-progress" id="ib-progress-wrap"><div class="goal-progress-bar green" id="ib-progress-bar" style="width:0%"></div><div class="period-marker" id="ib-marker-p1" data-label="P1" style="left:33%"></div><div class="period-marker" id="ib-marker-p2" data-label="P2" style="left:66%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-stow-goal">\u2014</strong></span><span>Actual <strong id="sum-ib-actual">\u2014</strong></span><span>Remaining <strong id="sum-ib-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-stow-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ib-cplh">\u2014</strong> CPLH</span></div><div class="pace-insight" id="ib-pace-insight"></div></div>
<div class="goal-card ob-card"><div class="goal-header"><span class="goal-title">Outbound</span><span class="goal-pct" id="sum-ob-pct">\u2014</span></div><div class="goal-progress" id="ob-progress-wrap"><div class="goal-progress-bar green" id="ob-progress-bar" style="width:0%"></div><div class="period-marker" id="ob-marker-p1" data-label="P1" style="left:33%"></div><div class="period-marker" id="ob-marker-p2" data-label="P2" style="left:66%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-pick-goal">\u2014</strong></span><span>Actual <strong id="sum-ob-actual">\u2014</strong></span><span>Remaining <strong id="sum-ob-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-pick-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ob-cplh">\u2014</strong> CPLH</span></div><div class="pace-insight" id="ob-pace-insight"></div></div>
<div class="goal-card sort-card" id="sort-summary-card"><div class="goal-header"><span class="goal-title">Sort</span><span class="goal-pct" id="sum-sort-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="sort-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-sort-goal">\u2014</strong></span><span>Actual <strong id="sum-sort-actual">\u2014</strong></span><span>Remaining <strong id="sum-sort-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-sort-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-sort-cplh">\u2014</strong> CPLH</span></div></div>
</div>
<div class="icqa-panel" id="icqa-panel" style="background:#fff;border:2px solid #000;border-radius:4px;padding:10px 14px;">
<h3 style="font-size:11px;font-weight:700;margin-bottom:6px;">ICQA</h3>
<div id="icqa-gca-banner" style="background:#757575;border:2px solid #000;border-radius:4px;padding:10px 14px;margin-bottom:10px;">
<div style="display:flex;align-items:center;justify-content:space-between;">
<h3 style="font-size:13px;font-weight:700;color:#fff;margin:0;">GCA's <span style="font-weight:400;font-size:11px;">(Target 0 &middot; Coaching to Deliver)</span></h3>
<strong id="icqa-gca-value" style="font-size:18px;color:#fff;">\u2014</strong>
</div>
</div>
<div style="font-size:10px;font-weight:700;color:#555;margin-bottom:2px;">% to RO <span style="margin-left:8px;font-size:10px;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:4px;font-weight:700;">RO Target = <span id="icqa-ro-target-display">\u2014</span></span></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px;">
<div><span style="color:#333;font-size:10px;">SHIFT RO RATE</span><br><strong id="icqa-ro-shift-actual" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">SHIFT % TO RO</span><br><strong id="icqa-ro-shift-pct" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">WEEK RO RATE</span><br><strong id="icqa-ro-week-actual" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">WEEK % TO RO</span><br><strong id="icqa-ro-week-pct" style="font-size:16px;">\u2014</strong></div>
</div>
<div style="font-size:10px;font-weight:700;color:#555;margin:8px 0 2px;">DC% <span style="margin-left:8px;font-size:10px;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:4px;font-weight:700;">DC% Target = <span id="icqa-dc-target-display">\u2014</span></span></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px;">
<div><span style="color:#333;font-size:10px;">SHIFT DC%</span><br><strong id="icqa-dc-shift-actual" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">SHIFT % TO GOAL</span><br><strong id="icqa-dc-shift-pct" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">WEEK DC%</span><br><strong id="icqa-dc-week-actual" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">WEEK % TO GOAL</span><br><strong id="icqa-dc-week-pct" style="font-size:16px;">\u2014</strong></div>
</div>
<div style="text-align:right;font-size:9px;color:#888;margin-top:6px;" id="icqa-gca-updated">\u2014</div>
</div>
<div class="site-cplh-panel" id="site-cplh-panel" style="background:#fff;border:2px solid #000;border-radius:4px;padding:10px 14px;margin-top:6px;">
<h3 style="font-size:11px;font-weight:700;margin-bottom:6px;">Site CPLH <span style="margin-left:16px;font-size:11px;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-site-cplh-display">\u2014</span></span></h3>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px;">
<div><span style="color:#333;font-size:10px;">SITE CPLH</span><br><strong id="site-cplh-value" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">% TO LP</span><br><strong id="site-cplh-lp-pct" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">THROUGHPUT VOL</span><br><strong id="site-throughput-vol">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">THROUGHPUT HRS</span><br><strong id="site-throughput-hrs">\u2014</strong></div>
</div>
</div>
<div id="tot-panel" style="background:#c62828;border:2px solid #000;border-radius:4px;padding:10px 14px;margin-top:6px;">
<div style="display:flex;align-items:center;justify-content:space-between;">
<h3 style="font-size:13px;font-weight:700;color:#fff;margin:0;">TOT</h3>
<strong id="tot-value" style="font-size:18px;color:#fff;">\u2014</strong>
</div>
</div>
<div id="bb-24hr-panel" style="background:#fff;border:2px solid #000;border-radius:4px;padding:10px 14px;margin-top:6px;">
<h3 style="font-size:11px;font-weight:700;margin-bottom:8px;">24 Hour Goal Tracker</h3>
<div style="margin-bottom:8px;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
<span style="font-size:11px;font-weight:600;color:#1565c0;">INBOUND</span>
<span style="font-size:11px;" id="bb24-ib-text">\u2014</span>
</div>
<div style="position:relative;background:#e0e0e0;border-radius:3px;height:12px;overflow:hidden;">
<div id="bb24-ib-bar" style="height:100%;background:#1565c0;width:0%;transition:width 0.3s;border-radius:3px;"></div>
<div style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:#000;opacity:0.5;"></div>
</div>
<div style="text-align:right;font-size:10px;color:#555;margin-top:2px;">24hr Density: <strong id="bb24-ib-density">\u2014</strong></div>
</div>
<div>
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
<span style="font-size:11px;font-weight:600;color:#e65100;">OUTBOUND</span>
<span style="font-size:11px;" id="bb24-ob-text">\u2014</span>
</div>
<div style="position:relative;background:#e0e0e0;border-radius:3px;height:12px;overflow:hidden;">
<div id="bb24-ob-bar" style="height:100%;background:#e65100;width:0%;transition:width 0.3s;border-radius:3px;"></div>
<div style="position:absolute;top:0;bottom:0;left:50%;width:2px;background:#000;opacity:0.5;"></div>
</div>
<div style="text-align:right;font-size:10px;color:#555;margin-top:2px;">24hr Density: <strong id="bb24-ob-density">\u2014</strong></div>
</div>
</div>
<div class="targets-panel"><h3 class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">Shift Plan Targets <button id="btn-clear-targets" class="btn btn-small btn-danger">Clear</button></h3>
<div class="target-groups-row">
<div class="tg-compact"><h4>INBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><span id="ib-bb-goal" style="font-weight:bold;">\u2014</span></td><td></td></tr>
<tr><td>IB GOAL</td><td><input type="number" id="ib-goal-input" class="target-input"></td><td><span id="ib-goal-pct">\u2014</span></td></tr>
<tr><td>STOW RATE</td><td><input type="number" id="ib-rate-target" class="target-input"></td><td><span id="ib-rate-pct">\u2014</span></td></tr>
<tr><td>IB CPLH</td><td><input type="number" id="ib-cplh-target" class="target-input"></td><td><span id="ib-cplh-pct">\u2014</span></td></tr>
<tr><td>PLANNED DENSITY</td><td><input type="number" id="ib-density-target" class="target-input" step="0.01"></td><td><span id="ib-density-pct">\u2014</span></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ib-fast-sos" class="target-input" value="13" readonly style="background:#eee;color:#333;cursor:default;"></td><td><span id="ib-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ib-fast-eol" class="target-input" value="18" readonly style="background:#eee;color:#333;cursor:default;"></td><td><span id="ib-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
<div class="tg-compact"><h4>OUTBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><span id="ob-bb-goal" style="font-weight:bold;">\u2014</span></td><td></td></tr>
<tr><td>DA GOAL</td><td><input type="number" id="ob-goal-input" class="target-input"></td><td><span id="ob-goal-pct">\u2014</span></td></tr>
<tr><td>PICK RATE</td><td><input type="number" id="ob-rate-target" class="target-input"></td><td><span id="ob-rate-pct">\u2014</span></td></tr>
<tr><td>DA CPLH</td><td><input type="number" id="ob-cplh-target" class="target-input"></td><td><span id="ob-cplh-pct">\u2014</span></td></tr>
<tr><td>PLANNED DENSITY</td><td><input type="number" id="ob-density-target" class="target-input" step="0.01"></td><td><span id="ob-density-pct">\u2014</span></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ob-fast-sos" class="target-input" value="13" readonly style="background:#eee;color:#333;cursor:default;"></td><td><span id="ob-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ob-fast-eol" class="target-input" value="18" readonly style="background:#eee;color:#333;cursor:default;"></td><td><span id="ob-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
</div>
<div id="sort-targets-right" class="sort-tgt"><h4>SORT</h4><table class="target-table"><tbody>
<tr><td>SORT PRIMARY GOAL</td><td><input type="number" id="sort-goal" class="target-input"></td><td><span id="sort-goal-pct">\u2014</span></td></tr>
<tr><td>SORT RATE (UPH)</td><td><input type="number" id="sort-rate-target" class="target-input"></td><td></td></tr>
</tbody></table></div>
<div class="sort-tgt" style="margin-top:6px;padding-top:6px;border-top:2px solid #000;"><h4 style="color:#333;">SITE</h4><table class="target-table"><tbody>
<tr><td>SITE CPLH TARGET</td><td><input type="number" id="site-cplh-target" class="target-input" step="0.01"></td><td><span id="site-cplh-pct">\u2014</span></td></tr>
<tr><td>ICQA RO TARGET</td><td><input type="number" id="icqa-ro-target" class="target-input" step="1"></td><td></td></tr>
<tr><td>ICQA DC% TARGET</td><td><input type="number" id="icqa-dc-target" class="target-input" step="1" value="70"></td><td></td></tr>
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

<main id="tab-hourly" class="tab-content"><div class="hourly-container">
<div class="section-header"><h2>Hourly Breakdown</h2><button id="btn-fetch-hourly" class="btn btn-primary">\u25B6 Fetch Hourly</button><span id="hourly-status" class="meta-text"></span></div>
<div id="hourly-tables"></div>
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
#sb-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#ffffff;color:#000000;font-size:13px;line-height:1.4;min-height:100vh;}
.topnav{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:#f0f0f0;border-bottom:2px solid #000;position:sticky;top:0;z-index:100;}
.topnav-left{display:flex;align-items:center;gap:14px;}.topnav-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.logo{font-size:20px;display:flex;align-items:center;}.site-title{font-size:15px;font-weight:700;margin:0;white-space:nowrap;color:#000;}
.nav-tabs{display:flex;gap:4px;}.nav-tab{padding:5px 12px;border:1px solid #000;background:#fff;color:#333;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;}
.nav-tab:hover{background:#e0e0e0;color:#000;}.nav-tab.active{background:#2e7d32;color:#fff;border-color:#2e7d32;}
.select-input{padding:4px 8px;background:#fff;border:1px solid #000;color:#000;border-radius:4px;font-size:12px;}
.meta-text{font-size:11px;color:#333;}
.period-indicator{display:flex;gap:4px;}.period-dot{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#e0e0e0;color:#666;border:1px solid #000;}
.period-dot.active{background:#2e7d32;color:#fff;border-color:#2e7d32;}.period-dot.completed{background:#1565c0;color:#fff;border-color:#1565c0;}
.btn{padding:5px 10px;border:1px solid #000;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;}.btn-primary{background:#2e7d32;color:#fff;border-color:#2e7d32;}.btn-primary:hover{background:#1b5e20;}.btn-primary:disabled{opacity:.5;cursor:wait;}
.btn-danger{background:#c62828;color:#fff;border-color:#c62828;}.btn-small{padding:3px 7px;font-size:11px;}.btn-snip{background:#6a1b9a;color:#fff;border-color:#6a1b9a;}.btn-snip:hover{background:#4a148c;}
.tab-content{display:none;padding:10px 16px;}.tab-content.active{display:block;}
.sync-layout{display:grid;grid-template-columns:1fr 520px;gap:10px;align-items:start;}
.sync-left{min-width:0;}
.sync-right{position:sticky;top:52px;display:flex;flex-direction:column;gap:8px;max-height:calc(100vh - 60px);overflow-y:auto;overflow-x:hidden;padding-right:4px;}
.targets-panel{background:#fff;border-radius:4px;border:2px solid #000;padding:8px 10px;}
.panel-title{font-size:10px;color:#333;margin:0 0 6px;font-weight:600;}
.target-groups-row{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.tg-compact h4{font-size:11px;margin-bottom:4px;color:#1565c0;font-weight:700;}
.tg-compact:last-child h4{color:#e65100;}
.sort-tgt{margin-top:6px;padding-top:6px;border-top:2px solid #000;}
.sort-tgt h4{font-size:11px;color:#6a1b9a;font-weight:700;margin-bottom:4px;}
.target-table{width:100%;border-collapse:collapse;font-size:10px;}.target-table th{padding:2px 4px;font-size:9px;color:#333;text-align:center;border-bottom:2px solid #000;}.target-table th:first-child{text-align:left;}
.target-table td{padding:2px 4px;border-bottom:1px solid #ccc;white-space:nowrap;}.target-table td:first-child{font-size:10px;color:#333;font-weight:600;}
.target-input{width:68px;padding:3px 5px;background:#ffffcc;border:1px solid #000;color:#000;border-radius:3px;font-size:12px;text-align:right;font-weight:700;-moz-appearance:textfield;}
.target-input::-webkit-outer-spin-button,.target-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.goal-summary-col{display:flex;flex-direction:column;gap:8px;}
.goal-card{background:#fff;border:2px solid #000;border-radius:4px;padding:10px 14px;display:flex;flex-direction:column;gap:4px;}
.goal-card.ib-card{border-left:4px solid #1565c0;}
.goal-card.ob-card{border-left:4px solid #e65100;}
.goal-card.sort-card{border-left:4px solid #6a1b9a;}
.goal-header{display:flex;justify-content:space-between;align-items:center;}
.goal-title{font-size:11px;font-weight:700;text-transform:uppercase;color:#333;}
.goal-pct{font-size:18px;font-weight:700;}
.goal-progress{width:100%;height:6px;background:#ddd;border-radius:3px;overflow:visible;margin:2px 0;position:relative;border:1px solid #000;}
.goal-progress-bar{height:100%;border-radius:2px;transition:width 0.3s;}
.goal-progress-bar.green{background:#2e7d32;}.goal-progress-bar.amber{background:#e65100;}.goal-progress-bar.red{background:#c62828;}
.period-marker{position:absolute;top:-2px;width:2px;height:10px;background:#000;border-radius:1px;}
.period-marker::after{content:attr(data-label);position:absolute;top:-12px;left:-4px;font-size:8px;color:#333;}
.goal-stats{display:flex;gap:12px;font-size:11px;color:#333;flex-wrap:wrap;}
.goal-stats span{white-space:nowrap;}.goal-stats strong{color:#000;}
.pace-insight{font-size:10px;color:#333;margin-top:4px;padding-top:4px;border-top:1px solid #ccc;line-height:1.4;}
.pace-insight .pace-good{color:#2e7d32;}.pace-insight .pace-warn{color:#e65100;}.pace-insight .pace-bad{color:#c62828;}
.goal-label{font-size:10px;color:#333;text-transform:uppercase;font-weight:600;}.goal-value{font-size:12px;font-weight:700;text-align:right;}
.charts-panel{display:grid;grid-template-columns:1fr 1fr;gap:8px;}
.chart-card{background:#fff;border-radius:4px;border:2px solid #000;padding:10px;}.chart-card h3{font-size:11px;margin-bottom:6px;color:#000;font-weight:700;}.chart-card canvas{width:100%!important;height:170px!important;}
`;}

function buildCSS2(){return `
.metrics-section{background:#fff;border-radius:4px;border:2px solid #000;padding:14px 18px 20px 18px;margin-bottom:12px;overflow:visible;}
.metrics-section.ib-section{border-left:4px solid #1565c0;}
.metrics-section.ob-section{border-left:4px solid #e65100;}
.metrics-section.sort-section{border-left:4px solid #6a1b9a;}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;}.section-header h2{font-size:13px;font-weight:700;margin:0;color:#000;}.fclm-timestamp{font-size:11px;color:#333;}
.metrics-table{width:100%;border-collapse:collapse;font-size:12px;}.metrics-table th{text-align:center;padding:5px 8px;border-bottom:2px solid #000;color:#000;font-weight:700;font-size:11px;border-right:1px solid #ccc;}.metrics-table th:first-child{text-align:left;}.metrics-table th:last-child{border-right:none;}
.metrics-table td{padding:4px 8px;text-align:center;border-bottom:1px solid #ccc;border-right:1px solid #ccc;}.metrics-table td:first-child{text-align:left;border-left:none;}.metrics-table td:last-child{border-right:none;}
.metrics-table .bold{font-weight:700;}.row-sync td{font-weight:700;}.row-cplh td{font-weight:700;font-size:13px;}
.row-rate td{color:#e65100;font-weight:600;}.row-fast td{color:#e65100;}.row-total td{border-top:2px solid #000;}.row-target td{background:#fff9c4;font-weight:700;}.row-hc td{color:#666;font-style:italic;}.row-wip td{font-style:italic;color:#666;}
.table-input{width:60px;padding:2px 5px;background:#ffffcc;border:1px solid #000;color:#000;border-radius:3px;font-size:12px;text-align:center;font-weight:700;-moz-appearance:textfield;}
.table-input::-webkit-outer-spin-button,.table-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.wip-eos{font-size:9px;color:#666;margin-right:4px;}
.pct-good{color:#2e7d32!important;font-weight:700;}.pct-warn{color:#e65100!important;font-weight:700;}.pct-bad{color:#c62828!important;font-weight:700;}
.actions-table{width:100%;border-collapse:collapse;font-size:12px;}.actions-table th{text-align:left;padding:4px 8px;border-bottom:2px solid #000;color:#000;font-weight:700;}.actions-table td{padding:10px 8px;border-bottom:1px solid #ccc;vertical-align:middle;overflow:visible;}
.actions-table input{width:100%;background:#fff;border:1px solid #000;color:#000;padding:6px 6px;border-radius:4px;font-size:12px;box-sizing:border-box;min-width:0;line-height:1.4;}
.actions-table textarea{width:100%;background:#fff;border:1px solid #000;color:#000;padding:6px 6px;border-radius:4px;font-size:12px;box-sizing:border-box;line-height:1.4;overflow:auto;word-wrap:break-word;white-space:pre-wrap;resize:none;min-height:50px;height:auto;}
.actions-table select{background:#fff;border:1px solid #000;color:#000;padding:8px 8px;border-radius:4px;font-size:12px;line-height:1.6;height:auto;min-height:34px;}.action-delete{cursor:pointer;color:#c62828;font-size:14px;}
.shift-timeline{display:flex;gap:1px;height:32px;border-radius:4px;overflow:hidden;background:#ccc;margin-bottom:6px;border:1px solid #000;}
.timeline-hour{flex:1;background:#f5f5f5;display:flex;align-items:center;justify-content:center;font-size:9px;color:#333;cursor:pointer;position:relative;transition:background .15s;}
.timeline-hour:hover{background:#e0e0e0;}
.timeline-hour.has-action{background:rgba(21,101,192,0.15);}
.timeline-hour.current-hour{border-bottom:2px solid #2e7d32;}
.support-grid{display:grid;grid-template-columns:1fr;gap:16px;}.support-card{background:#fff;border-radius:4px;border:2px solid #000;padding:16px;border-left:4px solid #000;}
.support-card.safety{border-left-color:#c62828;}.support-card.quality{border-left-color:#e65100;}.support-card.learning{border-left-color:#1565c0;}
.support-card h2{font-size:14px;margin-bottom:10px;font-weight:700;}.support-table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px;}
.support-table th{padding:4px 6px;border-bottom:2px solid #000;color:#000;text-align:center;font-size:11px;font-weight:700;}.support-table th:first-child{text-align:left;}
.support-table td{padding:3px 6px;border-bottom:1px solid #ccc;}.support-input{width:55px;padding:2px 5px;background:#fff;border:1px solid #000;color:#000;border-radius:3px;font-size:12px;text-align:center;}
.fixed-target{display:inline-block;width:55px;text-align:center;font-weight:700;color:#2e7d32;font-size:12px;}
.callout-section{margin-top:8px;}.callout-section h4{font-size:11px;color:#333;margin-bottom:4px;font-weight:700;}
.callout-textarea{width:100%;min-height:60px;padding:8px;background:#fff;border:1px solid #000;color:#000;border-radius:4px;font-size:12px;resize:vertical;font-family:inherit;}
.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;}.settings-card{background:#fff;border-radius:4px;border:2px solid #000;padding:16px;}.settings-card h2{font-size:14px;margin-bottom:10px;font-weight:700;}
.settings-table{width:100%;border-collapse:collapse;font-size:12px;}.settings-table th{padding:4px 6px;border-bottom:2px solid #000;color:#000;text-align:center;font-size:11px;font-weight:700;}.settings-table th:first-child{text-align:left;}
.settings-table td{padding:4px 6px;text-align:center;}.settings-table td:first-child{text-align:left;font-weight:600;}
.sched-input{width:50px;padding:3px 5px;background:#ffffcc;border:1px solid #000;color:#000;border-radius:4px;font-size:12px;text-align:center;font-weight:700;}
.setting-row{display:flex;align-items:center;gap:10px;margin-bottom:8px;}.setting-row label{font-size:12px;min-width:100px;}.settings-note{font-size:11px;color:#333;margin-top:10px;}
@media(max-width:1100px){.sync-layout{grid-template-columns:1fr;}.sync-right{position:static;max-height:none;}}
.hourly-container{padding:4px 0;}.hourly-container .section-header{margin-bottom:12px;gap:10px;}
.hourly-tables-grid{display:grid;grid-template-columns:1fr;gap:12px;}
.hourly-section{background:#fff;border:2px solid #000;border-radius:4px;padding:12px 16px;margin-bottom:10px;}
.hourly-section h3{font-size:13px;font-weight:700;margin-bottom:8px;}
.hourly-section.ib-hourly{border-left:4px solid #1565c0;}
.hourly-section.ob-hourly{border-left:4px solid #e65100;}
.hourly-section.sort-hourly{border-left:4px solid #6a1b9a;}
/* Dark Mode */
#sb-root.dark-mode{background:#1a1a2e!important;color:#e0e0e0!important;}
#sb-root.dark-mode .topnav{background:#16213e!important;border-color:#333!important;}
#sb-root.dark-mode .metrics-section,#sb-root.dark-mode .goal-card,#sb-root.dark-mode .site-cplh-panel,#sb-root.dark-mode .targets-panel,#sb-root.dark-mode .chart-card,#sb-root.dark-mode .hourly-section,#sb-root.dark-mode #bb-24hr-panel{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .metrics-table th,#sb-root.dark-mode .metrics-table td,#sb-root.dark-mode .target-table td,#sb-root.dark-mode .actions-table th,#sb-root.dark-mode .actions-table td{color:#e0e0e0!important;border-color:#444!important;}
#sb-root.dark-mode .metrics-table td{border-bottom-color:#333!important;}
#sb-root.dark-mode .section-header h2,#sb-root.dark-mode .bold,#sb-root.dark-mode h3,#sb-root.dark-mode h4,#sb-root.dark-mode .panel-title,#sb-root.dark-mode .site-title{color:#e0e0e0!important;}
#sb-root.dark-mode .target-input,#sb-root.dark-mode .actions-table input,#sb-root.dark-mode .actions-table textarea,#sb-root.dark-mode .actions-table select,#sb-root.dark-mode .select-input{background:#1a1a2e!important;color:#e0e0e0!important;border-color:#555!important;}
#sb-root.dark-mode .goal-title{color:#ccc!important;}
#sb-root.dark-mode .goal-stats,#sb-root.dark-mode .goal-stats strong{color:#e0e0e0!important;}
#sb-root.dark-mode .fclm-timestamp,#sb-root.dark-mode .meta-text{color:#aaa!important;}
#sb-root.dark-mode .row-target td{background:rgba(255,235,59,0.15)!important;}
#sb-root.dark-mode .row-sync td{background:rgba(255,183,77,0.12)!important;}
#sb-root.dark-mode .goal-progress{background:#333!important;}
#sb-root.dark-mode .nav-tab{color:#aaa!important;background:#1a1a2e!important;}
#sb-root.dark-mode .nav-tab.active{color:#fff!important;background:#2e7d32!important;}
#sb-root.dark-mode .shift-timeline{background:#333!important;}
#sb-root.dark-mode .timeline-hour{background:#1a1a2e!important;color:#aaa!important;}
#sb-root.dark-mode .pace-insight{color:#ccc!important;border-color:#444!important;}
#sb-root.dark-mode .tg-compact h4{color:#64b5f6!important;}
#sb-root.dark-mode .metrics-table td[style*="background"]{color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(52,211,153"]{background:rgba(46,204,113,0.45)!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(251,191,36"]{background:rgba(255,193,7,0.35)!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(220,38,38"]{background:#b71c1c!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(46,125,50"]{background:rgba(46,204,113,0.45)!important;color:#69f0ae!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(230,81,0"]{background:rgba(255,152,0,0.35)!important;color:#ffab40!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(198,40,40"]{background:#b71c1c!important;color:#fff!important;}
#sb-root.dark-mode .row-rate td,#sb-root.dark-mode .row-fast td{color:#ffab40!important;}
#sb-root.dark-mode .pct-good{color:#69f0ae!important;}
#sb-root.dark-mode .pct-warn{color:#ffd740!important;}
#sb-root.dark-mode .pct-bad{color:#ff5252!important;}
#sb-root.dark-mode span[style*="color"]{color:inherit!important;}
#sb-root.dark-mode .table-input{background:#1a1a2e!important;color:#ffd740!important;border-color:#666!important;}
#sb-root.dark-mode .goal-card *,#sb-root.dark-mode .site-cplh-panel *,#sb-root.dark-mode .targets-panel *,#sb-root.dark-mode #bb-24hr-panel *{color:#e0e0e0!important;}
#sb-root.dark-mode .goal-card .pct-good,#sb-root.dark-mode .targets-panel .pct-good{color:#69f0ae!important;}
#sb-root.dark-mode .goal-card .pct-warn,#sb-root.dark-mode .targets-panel .pct-warn{color:#ffd740!important;}
#sb-root.dark-mode .goal-card .pct-bad,#sb-root.dark-mode .targets-panel .pct-bad{color:#ff5252!important;}
#sb-root.dark-mode .goal-progress-bar.green{background:#4caf50!important;}
#sb-root.dark-mode .goal-progress-bar.amber{background:#ff9800!important;}
#sb-root.dark-mode .goal-progress-bar.red{background:#f44336!important;}
#sb-root.dark-mode span[style*="background"]{color:#000!important;}
#sb-root.dark-mode span[style*="background"] span{color:#000!important;}
#sb-root.dark-mode .btn{color:#000!important;}
#sb-root.dark-mode .btn-primary{color:#fff!important;}
#sb-root.dark-mode .btn-danger{color:#fff!important;}
#sb-root.dark-mode .btn-snip{color:#fff!important;}
#sb-root.dark-mode .btn[style*="background:#333"]{color:#fff!important;}
`;}

// === HOURLY TAB ===
async function fetchHourlyData(){
    const config=loadConfig();
    const site=config.site;
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const {startDate}=getShiftDates(config);
    const statusEl=document.getElementById('hourly-status');
    const btn=document.getElementById('btn-fetch-hourly');
    btn.disabled=true;btn.textContent='\u23F3 Fetching...';
    if(statusEl)statusEl.textContent='Fetching hourly data...';

    // Start = P1 start (SOS), End = P3 end (EOS)
    const hourlyStartH=sched.p1.sh;
    const hourlyStartM=sched.p1.sm;
    const eosH=sched.p3.eh, eosM=sched.p3.em;

    // Calculate total minutes from SOS to EOS
    const sMins=hourlyStartH*60+hourlyStartM;
    const eMins=eosH*60+eosM;
    let totalMins=eMins>sMins?eMins-sMins:(1440-sMins)+eMins;

    // Build hour slots: first = SOS to next full hour, middle = full hours, last = last full hour to EOS
    const hours=[];
    // First slot: SOS to next full hour
    const firstSlotEnd=(Math.ceil(sMins/60)*60)%1440;
    if(firstSlotEnd!==sMins){
        // SOS doesn't start on the hour, so first slot is partial
        hours.push({sh:hourlyStartH,sm:hourlyStartM,eh:Math.floor(firstSlotEnd/60),em:firstSlotEnd%60,label:String(hourlyStartH).padStart(2,'0')+':'+String(hourlyStartM).padStart(2,'0')});
    }
    // Middle full-hour slots
    let cursor=firstSlotEnd===sMins?sMins:firstSlotEnd;
    while(true){
        const nextHour=(cursor+60)%1440;
        // Calculate minutes remaining from cursor to EOS (handling midnight wrap)
        let cursorToEos;
        if(eMins>sMins){
            // No midnight crossing
            cursorToEos=eMins-cursor;
        } else {
            // Crosses midnight
            if(cursor>=sMins) cursorToEos=(1440-cursor)+eMins;
            else cursorToEos=eMins-cursor;
        }
        if(cursorToEos<=0) break;
        if(cursorToEos<=60){
            // Last slot: cursor to EOS
            hours.push({sh:Math.floor(cursor/60),sm:cursor%60,eh:eosH,em:eosM,label:String(Math.floor(cursor/60)).padStart(2,'0')+':'+String(cursor%60).padStart(2,'0')});
            break;
        }
        hours.push({sh:Math.floor(cursor/60),sm:cursor%60,eh:Math.floor(nextHour/60),em:nextHour%60,label:String(Math.floor(cursor/60)).padStart(2,'0')+':'+String(cursor%60).padStart(2,'0')});
        cursor=nextHour;
    }
    const totalHours=hours.length;

    // Fetch each hour in parallel (same as fetchPeriod)
    try{
        const results=await Promise.all(hours.map(hr=>fetchPeriod(site,startDate,hr)));
        const hourlyData=results.map((raw,i)=>{
            const stow=raw.stow||{},pStow=raw.palletStow||{},pick=raw.pick||{},obDock=raw.obDock||{},sort=raw.sort||{},ppr=raw.ppr||{};
            const palletCases=pStow.palletCases||0;
            const ibU=(stow.totalUnits||0)+palletCases;
            const caseStowReserve=ppr.caseStowReserveHrs||0;
            // Direct Hours = Case Transfer In + Case Stow to Reserve + Pallet Transfer In
            const ibDH=(stow.directHours||0)+caseStowReserve+(pStow.directHours||0);
            const ibTotalHrs=ppr.ibActualHrs||ibDH;
            // Indirect Hours = Total IB - Direct Hours
            const ibIndirect=Math.max(ibTotalHrs-ibDH,0);
            const cplhHrs=ibTotalHrs;
            const obPickDH=pick.directHours||0;
            const daHrs=ppr.daTransferHrs||obPickDH;
            const obIndirect=daHrs>obPickDH?daHrs-obPickDH:0;
            return{
                label:hours[i].label,
                ib:{totalStow:ibU,stowUnits:stow.totalUnits||0,palletUnits:pStow.totalUnits||0,rate:stow.rate||0,directHours:ibDH,indirectHours:ibIndirect,totalHours:ibTotalHrs,directPct:ibTotalHrs>0?(ibDH/ibTotalHrs)*100:0,indirectPct:ibTotalHrs>0?(ibIndirect/ibTotalHrs)*100:0,cplh:cplhHrs>0?ibU/cplhHrs:0,pctToOP:(ppr.ibPlannedHrs||0)>0?(ibTotalHrs/ppr.ibPlannedHrs)*100:0},
                ob:{pickUnits:pick.totalUnits||0,loadedUnits:obDock.fluidLoadJobs||0,pickRate:pick.rate||0,directHours:obPickDH,indirectHours:obIndirect,totalHours:daHrs,directPct:daHrs>0?(obPickDH/daHrs)*100:0,indirectPct:daHrs>0?(obIndirect/daHrs)*100:0,cplh:daHrs>0?(obDock.fluidLoadJobs||0)/daHrs:0,pctToOP:(ppr.daTransferPlan||0)>0?(daHrs/ppr.daTransferPlan)*100:0},
                sort:{totalUnits:sort.totalUnits||0,rate:sort.rate||0,directHours:sort.directHours||0,cplh:(sort.directHours||0)>0?sort.totalUnits/sort.directHours:0}
            };
        });
        renderHourlyTables(hourlyData,totalHours);
        if(statusEl)statusEl.textContent='\u2713 Updated '+new Date().toLocaleTimeString();
    }catch(err){
        console.error('Hourly fetch failed:',err);
        if(statusEl)statusEl.textContent='\u26A0 '+err.message;
    }finally{btn.disabled=false;btn.textContent='\u25B6 Fetch Hourly';}
}

function renderHourlyTables(hourlyData,totalHours){
    const container=document.getElementById('hourly-tables');if(!container)return;
    const config=loadConfig();
    const ibGoal=parseFloat(document.getElementById('ib-goal-input')?.value)||0;
    const obGoal=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    const sortGoal=parseFloat(document.getElementById('sort-goal')?.value)||0;
    const ibRateT=parseFloat(document.getElementById('ib-rate-target')?.value)||0;
    const obRateT=parseFloat(document.getElementById('ob-rate-target')?.value)||0;
    const ibCplhT=parseFloat(document.getElementById('ib-cplh-target')?.value)||0;
    const obCplhT=parseFloat(document.getElementById('ob-cplh-target')?.value)||0;

    const ibPerHr=ibGoal>0?Math.round(ibGoal/totalHours):0;
    const obPerHr=obGoal>0?Math.round(obGoal/totalHours):0;
    const sortPerHr=sortGoal>0?Math.round(sortGoal/totalHours):0;

    function condBg(actual,target){if(!actual||actual<=0||!target||target<=0)return'';return actual>=target?'background:rgba(46,125,50,0.12)':actual>=target*0.9?'background:rgba(230,81,0,0.1)':'background:rgba(198,40,40,0.1)';}
    function fv(v,d=0){if(!v||isNaN(v)||v===0)return'';return Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}
    function fvPct(v){if(!v||isNaN(v)||v===0)return'';return v.toFixed(1)+'%';}
    function actTarget(actual,target,decimals=0){const a=fv(actual,decimals);const t=fv(target,decimals);if(!a&&!t)return'';if(!t)return a;if(!a)return'— / '+t;return a+' / '+t;}

    // Headers
    const headers=hourlyData.map(h=>'<th>'+h.label+'</th>').join('');
    const totalHeader='<th>Total</th>';

    // Calculate cumulative totals
    let ibCum=0,obCum=0,sortCum=0;
    const ibCums=[],obCums=[],sortCums=[];
    hourlyData.forEach(h=>{ibCum+=h.ib.totalStow;obCum+=h.ob.pickUnits;sortCum+=h.sort.totalUnits;ibCums.push(ibCum);obCums.push(obCum);sortCums.push(sortCum);});

    // IB Table
    function buildTable(title,cssClass,rows){
        return `<section class="hourly-section ${cssClass}"><h3>${title}</h3><div style="overflow-x:auto;"><table class="metrics-table"><thead><tr><th></th>${headers}${totalHeader}</tr></thead><tbody>${rows}</tbody></table></div></section>`;
    }

    function ibRow(label,getter,target,decimals=0){
        let total=0;const cells=hourlyData.map((h,i)=>{const v=getter(h,i);if(typeof v==='number')total+=v;const display=fv(v,decimals);const style=target?condBg(v,target):'';return`<td style="${style}">${display}</td>`;}).join('');
        return`<tr><td>${label}</td>${cells}<td style="font-weight:700;">${total>0?fv(total,decimals):''}</td></tr>`;
    }
    function ibRateRow(label,getter,target){
        const cells=hourlyData.map(h=>{const v=getter(h);const display=fv(v,1);const style=target?condBg(v,target):'';return`<td style="${style}">${display}</td>`;}).join('');
        return`<tr class="row-rate"><td>${label}</td>${cells}<td style="font-weight:700;">${actTarget(hourlyData.map(h=>getter(h)).filter(v=>v>0).reduce((a,b,_,arr)=>a+b/arr.length,0),target,1)}</td></tr>`;
    }
    function ibCumRow(label,cums,perHrTarget,goal){
        const cells=cums.map((v,i)=>{const cumTarget=perHrTarget*(i+1);const style=condBg(v,cumTarget);return`<td style="font-weight:700;${style}">${fv(v)}</td>`;}).join('');
        return`<tr class="row-sync"><td class="bold">${label}</td>${cells}<td style="font-weight:700;">${actTarget(cums[cums.length-1]||0,goal)}</td></tr>`;
    }

    const ibTargetRow=ibPerHr>0?`<tr class="row-target"><td class="bold">Target (per hr)</td>${hourlyData.map((_,i)=>`<td>${fv(ibPerHr*(i+1))}</td>`).join('')}<td style="font-weight:700;">${fv(ibGoal)}</td></tr>`:'';
    const ibRows=ibTargetRow+
        ibCumRow('Sync Metrics (Running Total)',ibCums,ibPerHr,ibGoal)+
        ibRow('Cases Stowed',h=>h.ib.stowUnits)+
        ibRow('Pallets Stowed',h=>h.ib.palletUnits)+
        ibRateRow('Stow Rate',h=>h.ib.rate,ibRateT)+
        ibRow('Direct Hours',h=>h.ib.directHours,0,2)+
        ibRow('Indirect Hours',h=>h.ib.indirectHours,0,2)+
        ibRow('Total Hours',h=>h.ib.totalHours,0,2)+
        `<tr class="row-cplh"><td class="bold">CPLH</td>${hourlyData.map(h=>{const v=h.ib.cplh;const style=ibCplhT&&v>0?(v>=ibCplhT?'background:rgba(46,125,50,0.12)':v>=ibCplhT*0.9?'background:rgba(230,81,0,0.1)':'background:rgba(198,40,40,0.1)'):'';return`<td style="${style}">${fv(v,2)}</td>`;}).join('')}<td style="font-weight:700;">${actTarget(ibCum>0&&hourlyData.reduce((s,h)=>s+h.ib.totalHours,0)>0?ibCum/hourlyData.reduce((s,h)=>s+h.ib.totalHours,0):0,ibCplhT,2)}</td></tr>`;

    const obTargetRow=obPerHr>0?`<tr class="row-target"><td class="bold">Target (per hr)</td>${hourlyData.map((_,i)=>`<td>${fv(obPerHr*(i+1))}</td>`).join('')}<td style="font-weight:700;">${fv(obGoal)}</td></tr>`:'';
    const obRows=obTargetRow+
        ibCumRow('Sync Metrics (Running Total)',obCums,obPerHr,obGoal)+
        ibRow('Picked',h=>h.ob.pickUnits)+
        ibRow('Loaded',h=>h.ob.loadedUnits)+
        ibRateRow('Pick Rate',h=>h.ob.pickRate,obRateT)+
        ibRow('Direct Hours',h=>h.ob.directHours,0,2)+
        ibRow('Indirect Hours',h=>h.ob.indirectHours,0,2)+
        ibRow('Total Hours',h=>h.ob.totalHours,0,2)+
        `<tr class="row-cplh"><td class="bold">CPLH</td>${hourlyData.map(h=>{const v=h.ob.cplh;const style=obCplhT&&v>0?(v>=obCplhT?'background:rgba(46,125,50,0.12)':v>=obCplhT*0.9?'background:rgba(230,81,0,0.1)':'background:rgba(198,40,40,0.1)'):'';return`<td style="${style}">${fv(v,2)}</td>`;}).join('')}<td style="font-weight:700;">${actTarget(obCum>0&&hourlyData.reduce((s,h)=>s+h.ob.totalHours,0)>0?obCum/hourlyData.reduce((s,h)=>s+h.ob.totalHours,0):0,obCplhT,2)}</td></tr>`;

    let sortHTML='';
    const hasSortData=hourlyData.some(h=>h.sort.totalUnits>0);
    if(hasSortData){
        const sortTargetRow=sortPerHr>0?`<tr class="row-target"><td class="bold">Target (per hr)</td>${hourlyData.map((_,i)=>`<td>${fv(sortPerHr*(i+1))}</td>`).join('')}<td style="font-weight:700;">${fv(sortGoal)}</td></tr>`:'';
        const sortRows=sortTargetRow+
            ibCumRow('Sync Metrics (Running Total)',sortCums,sortPerHr,sortGoal)+
            ibRow('Sorted',h=>h.sort.totalUnits)+
            ibRateRow('Sort Rate',h=>h.sort.rate,0)+
            ibRow('Direct Hours',h=>h.sort.directHours,0,2)+
            `<tr class="row-cplh"><td class="bold">CPLH</td>${hourlyData.map(h=>`<td>${fv(h.sort.cplh,2)}</td>`).join('')}<td>${fv(sortCum>0&&hourlyData.reduce((s,h)=>s+h.sort.directHours,0)>0?sortCum/hourlyData.reduce((s,h)=>s+h.sort.directHours,0):0,2)}</td></tr>`;
        sortHTML=buildTable('SORT | Hourly','sort-hourly',sortRows);
    }

    container.innerHTML=buildTable('INBOUND | Hourly','ib-hourly',ibRows)+buildTable('OUTBOUND | Hourly','ob-hourly',obRows)+sortHTML;

    // Blank out future hour columns (hours that haven't started yet)
    const now=new Date();
    const currentMins=now.getHours()*60+now.getMinutes();
    const tables=container.querySelectorAll('.metrics-table');
    tables.forEach(table=>{
        const rows=table.querySelectorAll('tbody tr');
        rows.forEach(row=>{
            const cells=row.querySelectorAll('td');
            // cells[0] is label, cells[1..N-1] are hour columns, cells[N] is total
            hourlyData.forEach((h,i)=>{
                const cellIdx=i+1; // +1 because first td is label
                if(cellIdx>=cells.length-1)return; // skip total column
                const slotMins=h.label?parseInt(h.label.split(':')[0])*60+parseInt(h.label.split(':')[1]):0;
                // Determine if this hour has started
                let hasStarted=false;
                if(config.shiftType==='Nights'){
                    // Night shift: hours before midnight (>=12) started if currentMins >= slotMins
                    // Hours after midnight (<12) started if we're past midnight (currentMins < 720) and currentMins >= slotMins
                    const slotH=parseInt(h.label.split(':')[0]);
                    if(slotH>=12){hasStarted=currentMins>=720?currentMins>=slotMins:true;}
                    else{hasStarted=currentMins<720?currentMins>=slotMins:false;}
                }else{
                    hasStarted=currentMins>=slotMins;
                }
                if(!hasStarted && cells[cellIdx]){
                    // Don't blank target row
                    if(!row.classList.contains('row-target')){
                        cells[cellIdx].textContent='';
                        cells[cellIdx].style.background='';
                    }
                }
            });
        });
    });

    // Apply LP-based conditional formatting to hourly Rate and CPLH rows
    const lp=loadLPValues();
    const lpCti=parseFloat(lp.ctiRate)||0;
    const lpTop=parseFloat(lp.topRate)||0;
    const lpIbCplh=parseFloat(lp.ibCplh)||0;
    const lpObCplh=parseFloat(lp.obCplh)||0;
    function colorCells(sectionClass,rowLabel,lpVal){
        if(lpVal<=0)return;
        const section=container.querySelector('.'+sectionClass);if(!section)return;
        const rows=section.querySelectorAll('tbody tr');
        rows.forEach(row=>{
            const label=row.querySelector('td');if(!label)return;
            if(label.textContent.trim().startsWith(rowLabel)){
                const cells=row.querySelectorAll('td');
                for(let i=1;i<cells.length;i++){
                    const v=parseFloat(cells[i].textContent)||0;
                    if(v<=0){continue;}
                    if(v>=lpVal)cells[i].style.background='rgba(52,211,153,0.15)';
                    else if(v>=lpVal*0.95)cells[i].style.background='rgba(251,191,36,0.1)';
                    else cells[i].style.background='rgba(220,38,38,0.12)';
                }
            }
        });
    }
    colorCells('ib-hourly','Stow Rate',lpCti);
    colorCells('ib-hourly','CPLH',lpIbCplh);
    colorCells('ob-hourly','Pick Rate',lpTop);
    colorCells('ob-hourly','CPLH',lpObCplh);
}

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

function clearBoard(){
    // Clear all metric cells (not inputs, not target rows)
    document.querySelectorAll('.metrics-table td:not(:first-child)').forEach(td=>{
        if(!td.querySelector('input')&&!td.closest('.row-target')){td.textContent='\u2014';td.style.background='';}
    });
    // Clear summary cards
    ['sum-stow-goal','sum-stow-rate','sum-ib-cplh','sum-ib-pct','sum-ib-actual','sum-ib-remaining','sum-pick-goal','sum-pick-rate','sum-ob-cplh','sum-ob-pct','sum-ob-actual','sum-ob-remaining','sum-sort-goal','sum-sort-rate','sum-sort-cplh','sum-sort-pct','sum-sort-actual','sum-sort-remaining'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.classList.remove('pct-good','pct-warn','pct-bad');}});
    // Reset progress bars
    ['ib-progress-bar','ob-progress-bar','sort-progress-bar'].forEach(id=>{const el=document.getElementById(id);if(el){el.style.width='0%';el.className='goal-progress-bar green';}});
    // Clear site CPLH
    ['site-cplh-value','site-throughput-vol','site-throughput-hrs'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.style.color='';}});
    // Clear ICQA (both are site-dependent; re-fetched on next Get Data / interval tick)
    ['icqa-ro-shift-actual','icqa-ro-shift-pct','icqa-ro-week-actual','icqa-ro-week-pct'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.classList.remove('pct-good','pct-warn','pct-bad');}});
    setEl('icqa-gca-value','\u2014');
    const gcaBanner=document.getElementById('icqa-gca-banner');if(gcaBanner)gcaBanner.style.background='#757575';
    // Clear TOT
    const totEl=document.getElementById('tot-value');if(totEl)totEl.textContent='\u2014';
    // Clear 24hr goal tracker
    ['bb24-ib-text','bb24-ob-text','bb24-ib-density','bb24-ob-density'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='\u2014';});
    ['bb24-ib-bar','bb24-ob-bar'].forEach(id=>{const el=document.getElementById(id);if(el)el.style.width='0%';});
    // Clear hourly tables
    const hourlyContainer=document.getElementById('hourly-tables');if(hourlyContainer)hourlyContainer.innerHTML='';
    // Clear charts
    Object.keys(charts).forEach(k=>{if(charts[k]){charts[k].destroy();delete charts[k];}});
    // Clear pace insights
    ['ib-pace-insight','ob-pace-insight'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='';});
    // Re-render target rows
    updateTargetRows();
}

function initBoard(){
    config=loadConfig();
    const sel=document.getElementById('site-select');
    SITES.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;sel.appendChild(o);});
    sel.value=config.site;
    document.getElementById('shift-select').value=config.shiftType;
    // Load targets
    const t=config.targets||{};
    ['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-density-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-density-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target','site-cplh-target','icqa-ro-target','icqa-dc-target'].forEach(id=>{const el=document.getElementById(id);if(el&&t[id])el.value=t[id];});
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
    document.getElementById('btn-dark').onclick=()=>{const root=document.getElementById('sb-root');root.classList.toggle('dark-mode');const isDark=root.classList.contains('dark-mode');localStorage.setItem('syncboard_dark',isDark?'1':'0');document.getElementById('btn-dark').textContent=isDark?'\u2600':'\u263D';if(currentMetrics){renderIB(currentMetrics);renderOB(currentMetrics);renderLPPercents(currentMetrics);renderCharts(currentMetrics);}};
    // Restore dark mode preference
    if(localStorage.getItem('syncboard_dark')==='1'){document.getElementById('sb-root').classList.add('dark-mode');document.getElementById('btn-dark').textContent='\u2600';}
    document.getElementById('btn-fetch-hourly')?.addEventListener('click',fetchHourlyData);
    document.getElementById('btn-clear-targets')?.addEventListener('click',()=>{
        ['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-density-target','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-density-target','sort-goal','sort-rate-target'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
        saveTargetsUI();updateTargetRows();
        // Clear the % column displays
        ['ib-goal-pct','ib-rate-pct','ib-cplh-pct','ib-density-pct','ob-goal-pct','ob-rate-pct','ob-cplh-pct','ob-density-pct','sort-goal-pct','sort-rate-pct'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.classList.remove('pct-good','pct-warn','pct-bad');}});
    });
    document.getElementById('btn-add-action')?.addEventListener('click',()=>{const a=loadActions();a.push({item:'',owner:'',status:'Open'});saveActions(a);renderActions();});
    document.getElementById('btn-clear-actions')?.addEventListener('click',()=>{if(confirm('Clear all actions?')){saveActions([]);renderActions();}});
    document.getElementById('btn-save-settings')?.addEventListener('click',saveSettingsUI);
    sel.onchange=e=>{config.site=e.target.value;if(SITE_SCHEDULES[config.site]){config.days=SITE_SCHEDULES[config.site].days;config.nights=SITE_SCHEDULES[config.site].nights;}saveConfig(config);refreshSettingsInputs();currentMetrics=null;clearBoard();updatePeriodDots();};
    document.getElementById('shift-select').onchange=e=>{config.shiftType=e.target.value;saveConfig(config);currentMetrics=null;clearBoard();updatePeriodDots();doFetch();};
    document.querySelectorAll('.target-input').forEach(inp=>{inp.addEventListener('input',updateTargetRows);inp.addEventListener('change',()=>{saveTargetsUI();if(currentMetrics)renderTargets(currentMetrics);});});
    document.querySelectorAll('.nav-tab').forEach(tab=>tab.onclick=()=>{document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));tab.classList.add('active');const target=document.getElementById('tab-'+tab.dataset.tab);if(target)target.classList.add('active');});
    const sup=loadSupport();Object.keys(sup).forEach(id=>{const el=document.getElementById(id);if(el)el.value=sup[id];});
    document.querySelectorAll('.support-input,.callout-textarea').forEach(el=>el.addEventListener('change',()=>{const d={};document.querySelectorAll('.support-input,.callout-textarea').forEach(e=>{d[e.id]=e.value;});saveSupport(d);}));
    renderActions();updatePeriodDots();setInterval(updatePeriodDots,60000);
    // ICQA GCA's is relayed from a separate tab (guided-coaching.corp.amazon.com), so
    // refresh it on a timer independent of the main "Get Data" fetch.
    fetchIcqaGCA();setInterval(fetchIcqaGCA,30000);
    // Start period notification reminders
    requestNotificationPermission();
    startPeriodReminders();
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
    const syncLayout=root.querySelector('.sync-layout');
    const origStyles={};
    if(rightPanel){origStyles.rPos=rightPanel.style.position;origStyles.rMax=rightPanel.style.maxHeight;origStyles.rOvf=rightPanel.style.overflow;origStyles.rTop=rightPanel.style.top;origStyles.rMinH=rightPanel.style.minHeight;rightPanel.style.position='static';rightPanel.style.maxHeight='none';rightPanel.style.overflow='visible';rightPanel.style.top='auto';rightPanel.style.minHeight='100%';}
    if(syncLayout){origStyles.sGrid=syncLayout.style.gridTemplateColumns;origStyles.sAlign=syncLayout.style.alignItems;syncLayout.style.gridTemplateColumns='1fr 600px';syncLayout.style.alignItems='stretch';}
    // Also ensure the sb-root expands fully
    root.style.overflow='visible';root.style.height='auto';root.style.minWidth='1400px';root.style.width='1400px';
    // Force colors for html2canvas (doesn't resolve CSS vars well)
    const isDark=root.classList.contains('dark-mode');
    const style=document.createElement('style');style.id='snip-fix';
    if(isDark){
        style.textContent='#sb-root,#sb-root *{color:#e0e0e0 !important;}#sb-root .metrics-table td[style*="background"]{color:#fff !important;}#sb-root .metrics-table td[style*="rgba(220,38,38"],#sb-root .metrics-table td[style*="rgba(244,67,54"],#sb-root .metrics-table td[style*="rgba(198,40,40"]{background:#b71c1c !important;}#sb-root .metrics-table td[style*="rgba(52,211,153"],#sb-root .metrics-table td[style*="rgba(46,204,113"]{background:rgba(46,204,113,0.45) !important;}#sb-root span[style*="background"]{color:#000 !important;}#sb-root span[style*="background"] *{color:#000 !important;}#sb-root span[style*="background"] span{color:#000 !important;}#sb-root .pct-good{color:#69f0ae !important;}#sb-root .pct-warn{color:#ffd740 !important;}#sb-root .pct-bad{color:#ff5252 !important;}#sb-root .row-fast td{color:#ffab40 !important;}#sb-root .row-rate td{color:#ffab40 !important;}#sb-root .goal-title{color:#ccc !important;}#sb-root .goal-stats{color:#e0e0e0 !important;}#sb-root .goal-stats strong{color:#fff !important;}#sb-root .fclm-timestamp{color:#aaa !important;}#sb-root .meta-text{color:#aaa !important;}#sb-root .target-input{color:#ffd740 !important;padding:4px 6px !important;font-size:13px !important;line-height:1.3 !important;}#sb-root .table-input{color:#ffd740 !important;}#sb-root .panel-title{color:#e0e0e0 !important;}#sb-root .tg-compact h4{color:#64b5f6 !important;}#sb-root .tg-compact:last-child h4{color:#69f0ae !important;}#sb-root .fixed-target{color:#69f0ae !important;}#sb-root .row-hc td{color:#aaa !important;}#sb-root .section-header h2{color:#e0e0e0 !important;}#sb-root .metrics-table .bold{color:#e0e0e0 !important;}#sb-root .nav-tab{color:#aaa !important;}#sb-root .nav-tab.active{color:#fff !important;}#sb-root .target-table td{padding:4px 6px !important;line-height:1.4 !important;color:#e0e0e0 !important;}#sb-root .topnav{background:#16213e !important;}#sb-root .metrics-section,#sb-root .goal-card,#sb-root .site-cplh-panel,#sb-root .targets-panel,#sb-root .chart-card{background:#0f3460 !important;border-color:#444 !important;}';
    } else {
        style.textContent='#sb-root,#sb-root *{color:#000 !important;}#sb-root .pct-good{color:#2e7d32 !important;}#sb-root .pct-warn{color:#e65100 !important;}#sb-root .pct-bad{color:#c62828 !important;}#sb-root .row-fast td{color:#e65100 !important;}#sb-root .goal-title{color:#333 !important;}#sb-root .goal-stats{color:#333 !important;}#sb-root .goal-stats strong{color:#000 !important;}#sb-root .fclm-timestamp{color:#333 !important;}#sb-root .meta-text{color:#333 !important;}#sb-root .target-input{color:#000 !important;padding:4px 6px !important;font-size:13px !important;line-height:1.3 !important;}#sb-root .table-input{color:#000 !important;}#sb-root .panel-title{color:#333 !important;}#sb-root .tg-compact h4{color:#1565c0 !important;}#sb-root .tg-compact:last-child h4{color:#2e7d32 !important;}#sb-root .fixed-target{color:#2e7d32 !important;}#sb-root .row-hc td{color:#666 !important;}#sb-root .section-header h2{color:#000 !important;}#sb-root .metrics-table .bold{color:#000 !important;}#sb-root .nav-tab{color:#333 !important;}#sb-root .nav-tab.active{color:#fff !important;}#sb-root .target-table td{padding:4px 6px !important;line-height:1.4 !important;}';
    }
    document.head.appendChild(style);
    // Replace textareas with divs for html2canvas (textareas don't render wrapped text)
    const textareaBackups=[];
    root.querySelectorAll('textarea').forEach(ta=>{
        const div=document.createElement('div');
        div.textContent=ta.value;
        div.style.cssText=window.getComputedStyle(ta).cssText;
        div.style.whiteSpace='pre-wrap';div.style.wordWrap='break-word';div.style.overflow='visible';div.style.height='auto';div.style.minHeight='32px';div.style.display='block';div.style.padding='6px';div.style.border='1px solid '+(isDark?'#555':'#000');div.style.borderRadius='4px';div.style.fontSize='12px';div.style.lineHeight='1.4';div.style.background=isDark?'#1a1a2e':'#fff';div.style.color=isDark?'#e0e0e0':'#000';div.style.width=ta.offsetWidth+'px';div.style.boxSizing='border-box';
        textareaBackups.push({ta,parent:ta.parentNode,next:ta.nextSibling});
        ta.parentNode.replaceChild(div,ta);
    });
    setTimeout(()=>{
        html2canvas(root,{backgroundColor:isDark?'#1a1a2e':'#ffffff',scale:1.5,useCORS:true,logging:false,windowHeight:root.scrollHeight,height:root.scrollHeight}).then(canvas=>{
            // Restore textareas
            textareaBackups.forEach(b=>{const div=b.parent.querySelector('div');if(div&&!div.querySelector){}b.next?b.parent.insertBefore(b.ta,b.next):b.parent.appendChild(b.ta);if(div&&div.parentNode)div.parentNode.removeChild(div);});
            // Restore styles
            document.head.removeChild(style);
            if(rightPanel){rightPanel.style.position=origStyles.rPos;rightPanel.style.maxHeight=origStyles.rMax;rightPanel.style.overflow=origStyles.rOvf;rightPanel.style.top=origStyles.rTop;rightPanel.style.minHeight=origStyles.rMinH||'';}
            if(syncLayout){syncLayout.style.gridTemplateColumns=origStyles.sGrid;syncLayout.style.alignItems=origStyles.sAlign||'';}
            root.style.overflow='';root.style.height='';root.style.minWidth='';root.style.width='';
            canvas.toBlob(blob=>{
                if(navigator.clipboard&&window.ClipboardItem){
                    navigator.clipboard.write([new ClipboardItem({'image/png':blob})]).then(()=>{
                        btn.textContent='\u2713 Copied!';setTimeout(()=>{btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;},2000);
                    }).catch(()=>{downloadBlob(blob);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;});
                } else {downloadBlob(blob);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;}
            },'image/png');
        }).catch(e=>{document.head.removeChild(style);if(rightPanel){rightPanel.style.position=origStyles.rPos;rightPanel.style.maxHeight=origStyles.rMax;rightPanel.style.overflow=origStyles.rOvf;rightPanel.style.top=origStyles.rTop;}if(syncLayout){syncLayout.style.gridTemplateColumns=origStyles.sGrid;syncLayout.style.alignItems=origStyles.sAlign||'';}root.style.overflow='';root.style.height='';console.error('Snip failed:',e);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;alert('Screenshot failed: '+e.message);});
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
        // Detect session expiry: if all data comes back as zeros AND we're within the shift window, auth likely expired
        const stowU=raw.full?.stow?.totalUnits||0;const pickU=raw.full?.pick?.totalUnits||0;const stowH=raw.full?.stow?.directHours||0;
        const ibPPRHrs=raw.full?.ppr?.ibActualHrs||0;
        // Only show session expired if we're currently within the shift time window (data should exist)
        const now=new Date(),cm=now.getHours()*60+now.getMinutes();
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const p1Start=sched.p1.sh*60+sched.p1.sm;
        const shiftActive=config.shiftType==='Nights'?(cm>=p1Start||cm<sched.full.eh*60+sched.full.em):(cm>=p1Start&&cm<=sched.full.eh*60+sched.full.em);
        if(stowU===0&&pickU===0&&stowH===0&&ibPPRHrs===0&&shiftActive){
            setStatus('\u26A0\uFE0F Session expired');
            alert('\u26A0\uFE0F FCLM session expired — no data returned.\n\nPlease refresh this page (F5) to re-authenticate, then try Get Data again.');
            btn.disabled=false;btn.textContent='\u25B6 Get Data';return;
        }
        currentMetrics=processData(raw);
        renderIB(currentMetrics);renderOB(currentMetrics);renderSort(currentMetrics);
        renderTargets(currentMetrics);renderCharts(currentMetrics);
        renderFastStart(raw.fastStart,config);
        blankFuturePeriods(config);
        // Render Site CPLH: (Fluid Load Case + Fluid Load Tote + Case Transfer In + Pallet Transfer In cases) / THROUGHPUT hours
        // Uses separate 12hr window (15 min before SOS to 15 min before next shift SOS)
        const cplhPpr=raw.cplhData?.ppr||{};
        const stowJobs=raw.cplhData?.stow?.totalUnits||0;
        const palletCases24=raw.cplhData?.palletStow?.palletCases||0;
        const obDockFluid=raw.cplhData?.obDock?.fluidLoadJobs||0;
        const tHrs=cplhPpr.throughputHrs||0;
        const siteThroughputVol=obDockFluid+stowJobs+palletCases24;
        const siteCplh=tHrs>0?siteThroughputVol/tHrs:0;
        setEl('site-cplh-value',siteCplh>0?fmt(siteCplh,2):'\u2014');
        // Color Site CPLH based on target
        const siteCplhTarget=parseFloat(document.getElementById('site-cplh-target')?.value)||0;
        const siteCplhEl=document.getElementById('site-cplh-value');
        if(siteCplhEl){siteCplhEl.style.color='';if(siteCplhTarget>0&&siteCplh>0){if(siteCplh>=siteCplhTarget)siteCplhEl.style.color='#2e7d32';else if(siteCplh>=siteCplhTarget*0.9)siteCplhEl.style.color='#e65100';else siteCplhEl.style.color='#c62828';}}
        setEl('site-throughput-vol',siteThroughputVol>0?fmt(siteThroughputVol):'\u2014');
        setEl('site-throughput-hrs',tHrs>0?fmt(tHrs,2):'\u2014');
        // Site CPLH % to target
        if(siteCplhTarget>0&&siteCplh>0){const p=(siteCplh/siteCplhTarget)*100;const el=setEl('site-cplh-pct',fmtPct(p));setPctClass(el,p);}
        // Render ICQA section (GCA's + % to RO)
        fetchIcqaGCA(config);
        fetchIcqaRO(config,raw);
        fetchIcqaDC(config);
        // Render TOT (Time Off Task) from separate PPR fetch (30min before SOS to 15min after EOS)
        const totHrs=raw.totPpr?.totHrs||0;
        if(totHrs>0){const hrs=Math.floor(totHrs);const mins=Math.round((totHrs-hrs)*60);setEl('tot-value',hrs+'h '+mins+'m');}else{setEl('tot-value','\u2014');}
        // Render 24hr BB Goal Tracker
        // Try LP cached BB goals first, then fall back to span text
        const lpCached=loadLPValues();
        const ibBBGoal=parseFloat(document.getElementById('ib-bb-goal')?.textContent?.replace(/,/g,''))||parseFloat(lpCached.ibBBGoal)||0;
        const obBBGoal=parseFloat(document.getElementById('ob-bb-goal')?.textContent?.replace(/,/g,''))||parseFloat(lpCached.obBBGoal)||0;
        const ib24=raw.data24?.ibVol24||0;
        const ob24=raw.data24?.obVol24||0;
        // Save 24hr volumes for LP re-render
        const lpSaved=loadLPValues();lpSaved._ib24Vol=ib24;lpSaved._ob24Vol=ob24;saveLPValues(lpSaved);
        // If we have cached BB goals, use them immediately
        if(ibBBGoal>0){const el=document.getElementById('ib-bb-goal');if(el&&!el.textContent.match(/\d/))el.textContent=Math.round(ibBBGoal).toLocaleString();}
        if(obBBGoal>0){const el=document.getElementById('ob-bb-goal');if(el&&!el.textContent.match(/\d/))el.textContent=Math.round(obBBGoal).toLocaleString();}
        if(ibBBGoal>0){const pct=(ib24/ibBBGoal)*100;setEl('bb24-ib-text',fmt(ib24)+' / '+fmt(Math.round(ibBBGoal))+' ('+pct.toFixed(1)+'%)');const bar=document.getElementById('bb24-ib-bar');if(bar){bar.style.width=Math.min(pct,100)+'%';bar.style.background=pct>=100?'#2e7d32':'#1565c0';}}else{setEl('bb24-ib-text',ib24>0?fmt(ib24)+' (loading goal...)':'\u2014');const bar=document.getElementById('bb24-ib-bar');if(bar)bar.style.width='0%';}
        if(obBBGoal>0){const pct=(ob24/obBBGoal)*100;setEl('bb24-ob-text',fmt(ob24)+' / '+fmt(Math.round(obBBGoal))+' ('+pct.toFixed(1)+'%)');const bar=document.getElementById('bb24-ob-bar');if(bar){bar.style.width=Math.min(pct,100)+'%';bar.style.background=pct>=100?'#2e7d32':'#e65100';}}else{setEl('bb24-ob-text',ob24>0?fmt(ob24)+' (loading goal...)':'\u2014');const bar=document.getElementById('bb24-ob-bar');if(bar)bar.style.width='0%';}
        // 24hr Density
        const ibD24=raw.data24?.ibDensity24||0;
        const obD24=raw.data24?.obDensity24||0;
        setEl('bb24-ib-density',ibD24>0?fmt(ibD24,2):'\u2014');
        setEl('bb24-ob-density',obD24>0?fmt(obD24,2):'\u2014');
        // Fetch Learning Curve data from ADAPT
        fetchLearningCurve(config.site,'1003035','ib-lc-display'); // Stow
        fetchLearningCurve(config.site,'1003065','ob-lc-display'); // Pick
        // Fetch LP CPLH from GalaxyBI (auto), then render % to LP
        fetchLPDataAuto(config.site).then(lp=>{
            if(lp&&(lp.ibCplh>0||lp.obCplh>0)){
                console.log('[SB-LP] Auto-fetched LP values:',lp);
                // Auto-populate BB goals from LP
                if(lp.ibBBGoal>0){const el=document.getElementById('ib-bb-goal');if(el)el.textContent=Math.round(lp.ibBBGoal).toLocaleString();}
                if(lp.obBBGoal>0){const el=document.getElementById('ob-bb-goal');if(el)el.textContent=Math.round(lp.obBBGoal).toLocaleString();}
                // Re-render 24hr goal tracker with LP BB goals
                const savedLP2=loadLPValues();
                const ib24Vol=savedLP2._ib24Vol||0;
                const ob24Vol=savedLP2._ob24Vol||0;
                if(lp.ibBBGoal>0&&ib24Vol>0){const pct=(ib24Vol/lp.ibBBGoal)*100;setEl('bb24-ib-text',fmt(ib24Vol)+' / '+fmt(Math.round(lp.ibBBGoal))+' ('+pct.toFixed(1)+'%)');const bar=document.getElementById('bb24-ib-bar');if(bar){bar.style.width=Math.min(pct,100)+'%';bar.style.background=pct>=100?'#2e7d32':'#1565c0';}}
                if(lp.obBBGoal>0&&ob24Vol>0){const pct=(ob24Vol/lp.obBBGoal)*100;setEl('bb24-ob-text',fmt(ob24Vol)+' / '+fmt(Math.round(lp.obBBGoal))+' ('+pct.toFixed(1)+'%)');const bar=document.getElementById('bb24-ob-bar');if(bar){bar.style.width=Math.min(pct,100)+'%';bar.style.background=pct>=100?'#2e7d32':'#e65100';}}
            }else{
                console.log('[SB-LP] Auto-fetch failed, using saved LP values');
                // Show reminder if no LP data cached
                const cached=loadLPValues();
                if(!cached.ibCplh&&!cached.obCplh){
                    const banner=document.getElementById('sb-reminder-banner')||document.createElement('div');
                    banner.id='sb-reminder-banner';
                    banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font:bold 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#e65100;color:#fff;';
                    banner.innerHTML='<span>\u26A0\uFE0F LP data unavailable — please visit <a href="https://galaxybi.aka.corp.amazon.com" target="_blank" style="color:#fff;text-decoration:underline;">GalaxyBI</a> once to authenticate, then refresh and try again.</span><button onclick="this.parentElement.style.display=\'none\'" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Dismiss</button>';
                    document.body.appendChild(banner);
                }
            }
            renderLPPercents(currentMetrics);
        });
        // Retry charts if Chart.js wasn't ready yet
        if(typeof Chart==='undefined'){setTimeout(()=>{if(typeof Chart!=='undefined'&&currentMetrics)renderCharts(currentMetrics);},2000);}
    }catch(err){console.error(err);setStatus('\u26A0\uFE0F '+err.message);alert('Fetch failed: '+err.message+'\n\nMake sure you are on Amazon network and authenticated to Midway.');}
    finally{btn.disabled=false;btn.textContent='\u25B6 Get Data';}
}

function saveTargetsUI(){
    const t={};['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-density-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-density-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target','site-cplh-target','icqa-ro-target','icqa-dc-target'].forEach(id=>{t[id]=document.getElementById(id)?.value||'';});
    config.targets=t;saveConfig(config);
    // Save LP values separately
    const lp={ibCplh:document.getElementById('lp-ib-cplh')?.value||'',obCplh:document.getElementById('lp-ob-cplh')?.value||'',siteCplh:document.getElementById('lp-site-cplh')?.value||''};
    saveLPValues(lp);
    // Re-render LP percentages if we have metrics
    if(currentMetrics)renderLPPercents(currentMetrics);
}

function saveSettingsUI(){
    config.days={full:{sh:+document.getElementById('ds-full-sh').value,sm:+document.getElementById('ds-full-sm').value,eh:+document.getElementById('ds-full-eh').value,em:+document.getElementById('ds-full-em').value},p1:{sh:+document.getElementById('ds-p1-sh').value,sm:+document.getElementById('ds-p1-sm').value,eh:+document.getElementById('ds-p1-eh').value,em:+document.getElementById('ds-p1-em').value},p2:{sh:+document.getElementById('ds-p2-sh').value,sm:+document.getElementById('ds-p2-sm').value,eh:+document.getElementById('ds-p2-eh').value,em:+document.getElementById('ds-p2-em').value},p3:{sh:+document.getElementById('ds-p3-sh').value,sm:+document.getElementById('ds-p3-sm').value,eh:+document.getElementById('ds-p3-eh').value,em:+document.getElementById('ds-p3-em').value}};
    config.nights={full:{sh:+document.getElementById('ns-full-sh').value,sm:+document.getElementById('ns-full-sm').value,eh:+document.getElementById('ns-full-eh').value,em:+document.getElementById('ns-full-em').value},p1:{sh:+document.getElementById('ns-p1-sh').value,sm:+document.getElementById('ns-p1-sm').value,eh:+document.getElementById('ns-p1-eh').value,em:+document.getElementById('ns-p1-em').value},p2:{sh:+document.getElementById('ns-p2-sh').value,sm:+document.getElementById('ns-p2-sm').value,eh:+document.getElementById('ns-p2-eh').value,em:+document.getElementById('ns-p2-em').value},p3:{sh:+document.getElementById('ns-p3-sh').value,sm:+document.getElementById('ns-p3-sm').value,eh:+document.getElementById('ns-p3-eh').value,em:+document.getElementById('ns-p3-em').value}};
    config.schedType=document.getElementById('settings-sched-type').value;
    saveTargetsUI();saveConfig(config);alert('Settings saved!');
}

// === PERIOD REMINDER NOTIFICATIONS ===
function requestNotificationPermission(){
    if('Notification' in window && Notification.permission==='default'){
        Notification.requestPermission();
    }
}
let reminderInterval=null;
const firedReminders=new Set();
function startPeriodReminders(){
    if(reminderInterval)clearInterval(reminderInterval);
    firedReminders.clear();
    reminderInterval=setInterval(checkPeriodReminders,30000);
    checkPeriodReminders();
}
function checkPeriodReminders(){
    if(!boardActive)return;
    const cfg=loadConfig();
    const sched=cfg.shiftType==='Nights'?cfg.nights:cfg.days;
    const now=new Date(),cm=now.getHours()*60+now.getMinutes();
    const periods=[{name:'P1',end:sched.p1.eh*60+sched.p1.em},{name:'P2',end:sched.p2.eh*60+sched.p2.em},{name:'P3',end:sched.p3.eh*60+sched.p3.em}];
    periods.forEach(p=>{
        let endMin=p.end;
        let currentMin=cm;
        if(cfg.shiftType==='Nights'){
            const shiftStart=sched.p1.sh*60+sched.p1.sm;
            if(endMin<shiftStart)endMin+=1440;
            if(currentMin<shiftStart)currentMin+=1440;
        }
        const diff=endMin-currentMin;
        const key5=p.name+'-5min';
        const key0=p.name+'-end';
        if(diff<=5&&diff>0&&!firedReminders.has(key5)){
            firedReminders.add(key5);
            fireReminder('\u23F0 '+p.name+' ending in 5 min','Get ready to post your '+p.name+' update!','warn');
        }
        if(diff<=0&&diff>=-2&&!firedReminders.has(key0)){
            firedReminders.add(key0);
            fireReminder('\u{1F6A8} '+p.name+' ended \u2014 POST NOW','Time to post your '+p.name+' update! Updates are late!','urgent');
        }
    });
}
function fireReminder(title,body,severity){
    if('Notification' in window && Notification.permission==='granted'){
        const n=new Notification(title,{body,requireInteraction:true,tag:title});
        setTimeout(()=>n.close(),60000);
    }
    showReminderBanner(title,body,severity);
}
function showReminderBanner(title,body,severity){
    let banner=document.getElementById('sb-reminder-banner');
    if(!banner){
        banner=document.createElement('div');
        banner.id='sb-reminder-banner';
        banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font:bold 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);transition:transform 0.3s;';
        document.body.appendChild(banner);
    }
    banner.style.background=severity==='urgent'?'#c62828':'#e65100';
    banner.style.color='#fff';
    banner.innerHTML=`<span>${title} \u2014 ${body}</span><button onclick="this.parentElement.style.display='none'" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Dismiss</button>`;
    banner.style.display='flex';
    setTimeout(()=>{if(banner)banner.style.display='none';},60000);
}

addLaunchBtn();
})();
