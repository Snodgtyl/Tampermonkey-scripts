// ==UserScript==
// @name         SDC Sync Copilot
// @namespace    https://fclm-portal.amazon.com
// @version      14.20.0
// @description  Full shift sync board dashboard on FCLM - IB/OB/Sort metrics, CPLH, Support Teams
// @author       snodgtyl
// @updateURL    https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/SDCSyncCopilot.user.js
// @downloadURL  https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/SDCSyncCopilot.user.js
// @match        https://fclm-portal.amazon.com/*
// @grant        GM_xmlhttpRequest
// @connect      fc-benchmarking.amazon.com
// @connect      adapt-iad.amazon.com
// @connect      galaxybi.aka.corp.amazon.com
// @connect      galaxybiprintfile-prod.s3.us-west-2.amazonaws.com
// @connect      midway-auth.amazon.com
// @connect      guided-coaching.corp.amazon.com
// @connect      atlas.qubit.amazon.dev
// @connect      moc.prod.atlas-opensearch.qubit.amazon.dev
// @connect      fcmenu-iad-regionalized.corp.amazon.com
// @connect      alps-iad.iad.proxy.amazon.com
// @connect      hooks.slack.com
// @run-at       document-idle
// ==/UserScript==

(function() {
'use strict';

// === CONFIG ===
const STORAGE_KEY = 'syncboard_config';
const ACTIONS_KEY = 'syncboard_actions';
const SUPPORT_KEY = 'syncboard_support';
const SITES = ['KRB3','KRB1','KRB2','KRB4','KRB6','ATL7','AVP8','HGR5','QXX6','SAV7'];

// Verbose debug logging. OFF by default so the console stays clean. To turn it on for
// troubleshooting, run in the console: localStorage.setItem('syncboard_debug','1') then reload.
// Real failures still log via console.warn/console.error regardless of this flag.
const SB_DEBUG = (()=>{try{return localStorage.getItem('syncboard_debug')==='1';}catch(e){return false;}})();
function dbg(...args){if(SB_DEBUG)console.log(...args);}

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
// Per-site shift-hours used by the EOS Wash CTI/TOP Hours Variance:
//   block = paid shift block per HC (e.g. a 10-hr site), ops = productive hours (shift minus
//   breaks). KRB3 = block 10, ops 9.25 (10.5h shift - ~1.25h breaks). Default to KRB3's values
//   for any site not yet mapped; fill in other sites' block/ops as they're confirmed.
const SHIFT_HOURS = { KRB3:{block:10, ops:9.25} };
const SHIFT_HOURS_DEFAULT = {block:10, ops:9.25};
const PROCESS_IDS = { stow:'1003035', palletStow:'1003041', pick:'1003065', sort:'1003009', obDock:'1003021', icqa:'1003030', vretPack:'1003056', vretPick:'1003034', rsr:'01003012',
    // TO (Transfer Out) loaded volume was split into two separate reports (line-item / process-id
    // changes). Fluid-load totes+cases now live under "TO Fluid Load" (toFluidLoad); pallet-loaded
    // cases live under "Transfer Out Dock" (toDock). loadedUnits = fluid-load jobs + dock pallet cases.
    // toDock '1003022' (no leading zero) matches the user's confirmed-working Dock Pallet Loader
    // report URL (processId=1003022), which provides the pallet-loaded Case-UNIT volume.
    toFluidLoad:'01785143661476', toDock:'1003022' };
// ICQA DC% (Direct Count %):
//   numerator   = "Library Deep" (Direct Count) functions: SBC - Library Deep + Other Library Deep
//   denominator = report GRAND TOTAL paid hours (all functions), read from summary tfoot total row
// e.g. (Other Library Deep 14.41 + SBC - Library Deep 2.50) / grand total 22.52 = ~75%
const DC_NUMERATOR_FUNCTIONS=['SBC - Library Deep','Other Library Deep'];
const DC_PERCENT_FUNCTIONS=['SBC - Library Deep','SBC - Pallet Single','Other Library Deep','Other Pallet Single'];
const DEFAULT_CONFIG = {
    site:'KRB3', shiftType:'Days', schedType:'3P',
    days:{ full:{sh:5,sm:45,eh:17,em:30}, p1:{sh:6,sm:15,eh:9,em:45}, p2:{sh:10,sm:15,eh:13,em:15}, p3:{sh:13,sm:15,eh:16,em:45} },
    nights:{ full:{sh:17,sm:45,eh:5,em:30}, p1:{sh:18,sm:15,eh:21,em:45}, p2:{sh:22,sm:15,eh:1,em:15}, p3:{sh:1,sm:15,eh:4,em:45} },
    targets:{}
};

// ============================ FLOW (Cages-on-dock / runway) ============================
// Ported from the Flow Analyzer (PPR) userscript by erpadil so the hourly Flow tables
// carry the same cages-on-dock, runway/backlog health, and Slack notifications.
// Per-site cage density (units per cage). STOW = inbound dock (IDRT/CTI); LOAD = outbound
// staged cartons (Pick/Fluid Load). Static per site (not pulled from FCLM).
const SITE_CAGE_DENSITY_STOW = { AVP8:22, HGR5:27, KRB1:20, KRB2:17, KRB3:19, KRB4:21, KRB6:20, QXX6:20, SAV7:19 };
const SITE_CAGE_DENSITY_LOAD = { AVP8:19, HGR5:28, KRB1:19, KRB2:19, KRB3:18, KRB4:19, KRB6:18, QXX6:19, SAV7:18 };
// Runway/backlog thresholds (hours). Inbound: LOW runway = bad. Outbound: HIGH backlog = bad.
const RUNWAY_RED=0.5, RUNWAY_YELLOW=1.0;       // inbound stow: <30m red, <1h yellow
const LOAD_BACKLOG_GREEN=1.5, LOAD_BACKLOG_RED=2.0; // outbound load: <=1.5h green, >2h red
// Slack workflow webhooks. SOS = shift cage counts, JOB_BALANCE = a one-line summary each
// time the flow view is fetched (so the team sees the tool being used). Fire-and-forget.
// SECURITY: the URLs are NOT hardcoded here (a committed webhook URL is a secret and gets
// flagged/leaked when pushed to a public repo). They live only in this browser's
// localStorage and are entered once via Settings. If unset, the Slack posts are simply
// skipped (no error). Rotate the Slack workflow trigger if a URL was ever committed.
// Slack workflow webhooks. Hardcoded so the triggers ALWAYS fire for every user out of the
// box (no setup). SOS = shift cage counts; JOB_BALANCE = a usage summary each flow fetch.
// SECURITY NOTE: this file is published on public GitHub, so these URLs are exposed. Treat
// them as non-secret and rotatable — if abused, rotate the Slack workflow trigger and update
// the constants below. Settings -> Slack Webhooks can override per-browser if needed.
const SLACK_SOS_DEFAULT='https://hooks.slack.com/triggers/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';
const SLACK_JOB_BALANCE_DEFAULT='https://hooks.slack.com/triggers/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';
const SLACK_SOS_KEY='syncboard_slack_sos_url';
const SLACK_JOB_BALANCE_KEY='syncboard_slack_jobbalance_url';
// Read the per-browser override if one was saved in Settings; otherwise use the hardcoded
// default so the triggers always work. A saved empty string ('') intentionally disables it.
function getSlackSosUrl(){try{const v=localStorage.getItem(SLACK_SOS_KEY);return v!=null?v:SLACK_SOS_DEFAULT;}catch(e){return SLACK_SOS_DEFAULT;}}
function getSlackJobBalanceUrl(){try{const v=localStorage.getItem(SLACK_JOB_BALANCE_KEY);return v!=null?v:SLACK_JOB_BALANCE_DEFAULT;}catch(e){return SLACK_JOB_BALANCE_DEFAULT;}}
const SOS_LOG_KEY='syncboard_sosLog_v1';

function flowCageDensity(site,mode){
    const t=mode==='load'?SITE_CAGE_DENSITY_LOAD:SITE_CAGE_DENSITY_STOW;
    return t[String(site||'').toUpperCase()]||0;
}
function loadSosLog(){try{const s=localStorage.getItem(SOS_LOG_KEY);const a=s?JSON.parse(s):[];return Array.isArray(a)?a:[];}catch(e){return[];}}
function saveSosLog(log){try{localStorage.setItem(SOS_LOG_KEY,JSON.stringify(log));}catch(e){}}
// Latest saved SOS cage count for a site + direction ('IB'|'OB').
function getSosRecord(site,direction){
    if(!site)return null;
    const want=String(site).toUpperCase(),wantDir=direction?String(direction).toUpperCase():null;
    const log=loadSosLog();
    for(let i=log.length-1;i>=0;i--){
        if(log[i].site!==want)continue;
        if(wantDir&&(log[i].direction||'').toUpperCase()!==wantDir)continue;
        return log[i];
    }
    return null;
}
function saveSosRecord(site,cages,density,direction){
    if(!site)return null;
    const entry={site:String(site).toUpperCase(),cages:Number(cages)||0,density:Number(density)||0,savedAt:new Date().toISOString()};
    if(direction)entry.direction=String(direction).toUpperCase();
    const log=loadSosLog();log.push(entry);saveSosLog(log);
    return entry;
}
// Fire-and-forget POST to a Slack workflow webhook. Never throws.
function postToSlack(url,payload,label){
    if(!url)return;
    const body=JSON.stringify(payload),tag=label||'Slack webhook';
    try{
        if(typeof GM_xmlhttpRequest==='function'){
            GM_xmlhttpRequest({method:'POST',url,headers:{'Content-Type':'application/json'},data:body,
                onload:(r)=>{if(r.status<200||r.status>=300)console.warn('[SB-Slack] '+tag+' HTTP',r.status);},
                onerror:(e)=>console.warn('[SB-Slack] '+tag+' failed:',e)});
        }else{
            fetch(url,{method:'POST',mode:'no-cors',headers:{'Content-Type':'application/json'},body}).catch(e=>console.warn('[SB-Slack] '+tag+' fetch failed:',e));
        }
    }catch(e){console.warn('[SB-Slack] '+tag+' error:',e);}
}
function fmtSlackTime(iso){try{return new Date(iso).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});}catch(e){return iso;}}
// SOS Slack message (mirrors the Flow Analyzer's single `message` variable).
function postSosToSlack(rec){
    const cases=(Number(rec.cages)||0)*(Number(rec.density)||0);
    const dir=rec.direction?rec.direction+' | ':'';
    const message='SOS Cages | '+dir+rec.site+' | '+Math.round(rec.cages)+' cages @ density '+rec.density+
        ' (~'+Math.round(cases)+' cases) | '+fmtSlackTime(rec.savedAt);
    postToSlack(getSlackSosUrl(),{message},'SOS Slack webhook');
}
// Job-balance Slack message posted when a flow view is fetched.
function postJobBalanceToSlack(s){
    const dir=s.direction?s.direction+' | ':'';
    const totalCages=Math.round(Number(s.cages)||0);
    const message=dir+s.site+' | Total Cages: '+totalCages.toLocaleString()+' | Avg Runway: '+(s.runwayText||'N/A')+
        ' | '+(s.status||'N/A')+' | '+fmtSlackTime(new Date().toISOString());
    postToSlack(getSlackJobBalanceUrl(),{message},'Job Balance Slack webhook');
}
// Post a "flow view fetched" summary to the job-balance Slack channel. Headlines the OB
// dock (falls back to IB): current cages on dock + runway/backlog status. Fire-and-forget.
function postHourlyFlowToSlack(hourlyData,config){
    if(!hourlyData||!hourlyData.length)return;
    const site=(config.site||'').toUpperCase();
    // Prefer OB if there's outbound activity, else IB.
    const obActive=hourlyData.some(h=>(h.ob&&(h.ob.pickUnits>0||h.ob.loadedUnits>0)));
    const dir=obActive?'OB':'IB';
    const rec=getSosRecord(site,dir);
    const density=(rec&&rec.density>0)?rec.density:flowCageDensity(site,obActive?'load':'stow');
    // Find the latest hour with flow and its cages (walkCages already set h.ob.cages/h.ib.cages).
    let cages=0,status='N/A',runwayText='N/A';
    for(let i=hourlyData.length-1;i>=0;i--){
        const h=hourlyData[i];
        if(obActive){
            if(h.ob&&(h.ob.pickUnits>0||h.ob.loadedUnits>0)){
                cages=h.ob.cages||0;const clear=h.ob.loadedRate||0;const cod=cages*density;
                const b=dockHealthBucket(cod,clear,'load',true);
                status=b?b.charAt(0).toUpperCase()+b.slice(1):'N/A';
                runwayText=(clear>0)?((cod/clear<1)?Math.round(cod/clear*60)+'m':(cod/clear).toFixed(1)+'h'):'\u221E';
                break;
            }
        }else if(h.ib&&(h.ib.rsrVol>0||h.ib.stowUnits>0)){
            cages=h.ib.cages||0;const clear=h.ib.stowUnits||0;const cod=cages*density;
            const b=dockHealthBucket(cod,clear,'stow',true);
            status=b?b.charAt(0).toUpperCase()+b.slice(1):'N/A';
            runwayText=(clear>0)?((cod/clear<1)?Math.round(cod/clear*60)+'m':(cod/clear).toFixed(1)+'h'):'1h+';
            break;
        }
    }
    postJobBalanceToSlack({site,cages,status,runwayText,direction:obActive?'Outbound':'Inbound'});
}
// Prefill the hourly SOS inputs: densities from the site table, cages from the last saved
// record for the current site + direction. Called on init and after a save.
function initSosControls(){
    const site=(loadConfig().site||'').toUpperCase();
    const ibD=document.getElementById('sos-ib-density'),obD=document.getElementById('sos-ob-density');
    if(ibD&&!ibD.value){const d=flowCageDensity(site,'stow');if(d)ibD.value=d;}
    if(obD&&!obD.value){const d=flowCageDensity(site,'load');if(d)obD.value=d;}
    const ibRec=getSosRecord(site,'IB'),obRec=getSosRecord(site,'OB');
    const ibC=document.getElementById('sos-ib-cages'),obC=document.getElementById('sos-ob-cages');
    if(ibC&&!ibC.value&&ibRec)ibC.value=Math.round(ibRec.cages);
    if(obC&&!obC.value&&obRec)obC.value=Math.round(obRec.cages);
    updateSosNote();
}
function updateSosNote(){
    const note=document.getElementById('sos-note');if(!note)return;
    const site=(loadConfig().site||'').toUpperCase();
    const ib=getSosRecord(site,'IB'),ob=getSosRecord(site,'OB');
    const bits=[];
    if(ib)bits.push('IB '+Math.round(ib.cages)+' @ '+fmtSlackTime(ib.savedAt));
    if(ob)bits.push('OB '+Math.round(ob.cages)+' @ '+fmtSlackTime(ob.savedAt));
    note.textContent=bits.length?('Saved: '+bits.join('  |  ')):('No saved SOS for '+site+'.');
}
// Save the SOS cage count for a direction, persist locally, and post to the SOS Slack webhook.
function saveSosFromUi(direction){
    const site=(loadConfig().site||'').toUpperCase();
    const isIB=direction==='IB';
    const cages=parseFloat(document.getElementById(isIB?'sos-ib-cages':'sos-ob-cages')?.value)||0;
    const density=parseFloat(document.getElementById(isIB?'sos-ib-density':'sos-ob-density')?.value)||flowCageDensity(site,isIB?'stow':'load');
    const rec=saveSosRecord(site,cages,density,direction);
    if(rec)postSosToSlack(rec);
    updateSosNote();
    const btn=document.getElementById(isIB?'btn-save-sos-ib':'btn-save-sos-ob');
    if(btn){const t=btn.textContent;btn.textContent='\u2713 Saved';setTimeout(()=>{btn.textContent=t;},1500);}
    // Re-render so the newly-saved SOS seeds the cage walk immediately.
    if(currentHourly&&currentHourly.data)renderHourlyTables(currentHourly.data,currentHourly.totalHours);
}
// Classify hours-of-work-on-dock into a health bucket (Flow Analyzer model).
//   mode 'load' (outbound): backlog HIGH = bad. <1.5h healthy, 1.5-2h warning, >=2h critical.
//   mode 'stow' (inbound):  runway LOW = bad. >=1h healthy, 30-59m warning, <=29m/empty critical.
// Returns null when the hour is idle (no flow) so it's excluded from tallies.
function dockHealthBucket(casesOnDock,clearRate,mode,hasFlow){
    if(casesOnDock==null||isNaN(casesOnDock))return null;
    if(!hasFlow)return null;
    if(mode==='load'){
        if(casesOnDock<=0)return 'healthy';
        if(!(clearRate>0))return 'critical';
        const h=casesOnDock/clearRate;
        return h<LOAD_BACKLOG_GREEN?'healthy':h<LOAD_BACKLOG_RED?'warning':'critical';
    }
    if(casesOnDock<=0)return 'critical';
    if(!(clearRate>0))return 'healthy';
    const h=casesOnDock/clearRate;
    return h>=RUNWAY_YELLOW?'healthy':h>=RUNWAY_RED?'warning':'critical';
}
// Walk the hours building a running cages-on-dock balance seeded from SOS, floored at 0.
// inflowKey/outflowKey pick which per-hour volume adds vs clears the dock. Sets h[cageProp].
// Returns the final running balance.
function walkCages(hours,inflowKey,outflowKey,seedCages,density,cageProp){
    if(!(density>0))return 0;
    let running=Number(seedCages)||0;
    hours.forEach(h=>{
        const inflow=h[inflowKey]||0,outflow=h[outflowKey]||0;
        running=Math.max(0,running+(inflow-outflow)/density);
        h[cageProp]=running;
    });
    return running;
}

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
// Fetch FCLM HTML. Retries ONCE on a 5xx server error (e.g. the HTTP 500s FCLM throws during its
// rolling version upgrades) after a short backoff, since those are usually transient. 4xx (auth)
// and network errors are not retried here - they're handled by the caller's session logic.
async function fetchHTML(url){
    let r=await fetch(url,{credentials:'include'});
    if(r.status>=500&&r.status<600){
        await new Promise(res=>setTimeout(res,800));
        r=await fetch(url,{credentials:'include'});
    }
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.text();
}
function buildFnUrl(site,pid,sd,sh,sm,ed,eh,em){return`/reports/functionRollup?reportFormat=HTML&warehouseId=${site}&processId=${pid}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}`;}
function buildPPRUrl(site,sd,sh,sm,ed,eh,em){return`/reports/processPathRollup?reportFormat=HTML&warehouseId=${site}&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}&_adjustPlanHours=on&_hideEmptyLineItems=on&employmentType=AllEmployees`;}
// Same as buildPPRUrl but allows a multi-day INTRADAY window (maxIntradayDays=8) so a full week
// can be requested while STILL getting the server-rendered PPR (spanType=Week renders client-side
// and its rows aren't in the fetched HTML). Used for the weekly ICQA RO rate so it reuses the
// exact shift calc (parseICQARow on the IC/QA/CS row) over a Sunday->now window.
function buildPPRUrlMultiDay(site,sd,sh,sm,ed,eh,em){return`/reports/processPathRollup?reportFormat=HTML&warehouseId=${site}&maxIntradayDays=8&spanType=Intraday&startDateIntraday=${encodeURIComponent(fmtDate(sd))}&startHourIntraday=${sh}&startMinuteIntraday=${sm}&endDateIntraday=${encodeURIComponent(fmtDate(ed))}&endHourIntraday=${eh}&endMinuteIntraday=${em}&_adjustPlanHours=on&_hideEmptyLineItems=on&employmentType=AllEmployees`;}

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
    // Wall Builder HEADCOUNT (# AAs) from the OB Dock report. The report renders ONE <table> per
    // function, each with a <caption> naming it (e.g. "Wall Builder [1540335693954]"). Find the
    // table whose caption is Wall Builder and count its unique employee rows (employeeId= links).
    // Absent on non-OB-dock reports (no such caption) -> stays 0.
    let wallBuilderHC=0;
    {
        const wbIds=new Set();
        doc.querySelectorAll('table').forEach(tbl=>{
            const cap=(tbl.querySelector('caption')?.textContent||'').trim();
            if(!/wall\s*builder/i.test(cap))return;
            tbl.querySelectorAll('a[href*="employeeId="]').forEach(l=>{const m=l.href.match(/employeeId=([^&]+)/);if(m)wbIds.add(m[1]);});
        });
        wallBuilderHC=wbIds.size;
    }
    // For palletStow: get CASE_UNIT from "Pallet Transfer In" Total row (6th numeric = index 5)
    let palletCases=0;
    const rows=doc.querySelectorAll('tr');let foundPTI=false;
    for(const row of rows){
        if(Array.from(row.querySelectorAll('th,td')).some(c=>/pallet\s*transfer\s*in/i.test(c.textContent.trim())))foundPTI=true;
        if(foundPTI){const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});if(nums.length>=6)palletCases=Math.round(nums[5]);break;}}
    }
    // TransshipPalletVerified cases: pallets that were loaded/verified but NOT counted by Fluid
    // Load. They live under the "Transfer Out" function's Total row (the TransshipPalletVerified
    // Case-UNIT column, e.g. 856 cases / 7 pallets in the sample). Parse that row and take its
    // Case value so DA/loaded volume includes pallet-loaded cases, not just fluid-load cases.
    // Row numerics (TransshipPalletVerified): [Jobs, EACH-UNIT, EACH-UPH?, Case-UNIT, Case-UPH?,
    // Pallet-UNIT, ...]; we want the Case-UNIT — the largest of the mid values. To stay robust we
    // read the "Transfer Out" Total row's numerics and pick the Case-UNIT by position after Jobs.
    let transshipPalletCases=0;
    let foundTO=false;
    for(const row of rows){
        // Match the exact "Transfer Out" function label (not "Transfer Out Pick"/"Dock"/"5S"/etc).
        if(!foundTO&&Array.from(row.querySelectorAll('th,td,a')).some(c=>/^transfer\s*out$/i.test(c.textContent.trim())))foundTO=true;
        if(foundTO){
            const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){
                const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});
                // nums for TransshipPalletVerified Total: [Jobs, EACH-UNIT, Case-UNIT, Pallet-UNIT].
                // Case-UNIT is index 2 (856 in the sample: [7, 1879, 856, 7]).
                if(nums.length>=3)transshipPalletCases=Math.round(nums[2]);
                break;
            }
        }
    }
    // SORT SITES ONLY: "Palletize - Tote" work (ScanToteToPallet). On sort sites totes get
    // palletized and that volume isn't in Fluid Load. This section is ABSENT on non-sort sites
    // (e.g. KRB3), so we search for it and simply bypass when missing (contributes 0). We keep
    // CPLH in CASES, so we only add a CASE value here. The ScanToteToPallet section shows
    // Jobs/Tote (e.g. 2269) and EACH (e.g. 20624) but not always a Case column; palletizeToteCases
    // is filled only when a Case value exists, and palletizeToteJobs is captured for reference.
    let palletizeToteCases=0,palletizeToteJobs=0;
    let foundPT=false;
    for(const row of rows){
        if(!foundPT&&Array.from(row.querySelectorAll('th,td,a')).some(c=>/palletize\s*[-\u2013]?\s*tote/i.test(c.textContent.trim())))foundPT=true;
        if(foundPT){
            const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){
                const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});
                // nums: [Jobs, JPH, EACH-UNIT, EACH-UPH, Tote-UNIT, Tote-UPH, ...]. Jobs=index0.
                // A Case column for palletized totes isn't present in the sample, so we do NOT
                // guess a case value here (would corrupt the cases-basis CPLH). Once the sort-site
                // CASE source is confirmed, set palletizeToteCases from the right column below.
                if(nums.length>=1)palletizeToteJobs=Math.round(nums[0]);
                break;
            }
        }
    }
    // For OB Dock loaded volume (CASES): Fluid Load Case cases + Fluid Load Tote jobs +
    // TransshipPalletVerified cases + (sort-site) palletized-tote CASES. Any source that isn't in
    // the report contributes 0, so non-sort sites are unaffected. palletizeToteCases stays 0 until
    // the sort-site case source is confirmed (palletizeToteJobs is logged for reference only).
    const fluidLoadJobs=units+fluidLoadToteJobs+transshipPalletCases+palletizeToteCases;
    // OB Dock "Loaded Cartons Rate" = the Fluid Load - Case function's JPH (554.52 in the report),
    // read off that function group's own "Total" row. Numerics in that row are
    // [hours, jobs, JPH, each-unit, each-uph, case-unit, case-uph]; JPH = index 2.
    let fluidCaseJPH=0,fluidCaseJobs=0;
    let foundFLC=false;
    for(const row of rows){
        if(!foundFLC&&Array.from(row.querySelectorAll('th,td,a')).some(c=>/fluid\s*load\s*[-\u2013]?\s*case/i.test(c.textContent.trim())))foundFLC=true;
        if(foundFLC){
            const cellTexts=Array.from(row.querySelectorAll('td')).map(c=>c.textContent.trim());
            if(cellTexts.includes('Total')){
                const nums=[];cellTexts.forEach(c=>{const v=parseFloat(c.replace(/,/g,''));if(!isNaN(v))nums.push(v);});
                if(nums.length>=3){fluidCaseJobs=Math.round(nums[1]);fluidCaseJPH=nums[2];}
                break;
            }
        }
    }
    // Diagnostic: only log when this looks like the OB Dock report (has fluid-load jobs), so we
    // can verify the pallet-verified + sort-site pallet-tote cases are added to loaded volume.
    if(units>0||fluidLoadToteJobs>0||transshipPalletCases>0||palletizeToteJobs>0){
        dbg('[SB-DA loaded] fluidCaseJobs='+units+' fluidToteJobs='+fluidLoadToteJobs+' transshipPalletCases='+transshipPalletCases+' palletizeToteJobs='+palletizeToteJobs+' palletizeToteCases='+palletizeToteCases+' wallBuilderHC='+wallBuilderHC+' => loadedUnits(cases)='+fluidLoadJobs);
    }
    return{totalUnits:units,directHours:hours,rate,headcount:hc,palletCases,eachUnits,caseUnits,fluidLoadJobs,fluidCaseJPH,fluidCaseJobs,transshipPalletCases,palletizeToteJobs,palletizeToteCases,wallBuilderHC};
}

// Helper: pull the numeric cells from a fn-rollup report's grand-total (tfoot) row.
function fnRollupTotalNums(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const tr=doc.querySelector('tfoot tr.total.empl-all')||doc.querySelector('tr.total.empl-all')||doc.querySelector('tfoot tr.total')||doc.querySelector('tfoot tr');
    const nums=[];
    if(tr){tr.querySelectorAll('td.numeric').forEach(c=>{const v=parseFloat(c.textContent.replace(/,/g,''));if(!isNaN(v))nums.push(v);});}
    // Headcount: unique employeeIds across the whole report.
    const ids=new Set();doc.querySelectorAll('a[href*="employeeId="]').forEach(l=>{const m=l.href.match(/employeeId=([^&]+)/);if(m)ids.add(m[1]);});
    return{nums,headcount:ids.size,doc};
}
// "TO Fluid Load" report (processId 01785143661476). Totes + cases for TO loaded volume.
// tfoot Total numerics are [paidHours, Jobs, JPH, EACH-UNIT, EACH-UPH, Case-UNIT, Case-UPH]
// e.g. [18.00, 6011, 333.95, 52224, 2901.38, 6011, 333.95] -> jobs=6011, cases=6011.
// We keep the original "Total jobs" basis (index 1) as the loaded-volume driver.
function parseToFluidLoad(html){
    const {nums,headcount}=fnRollupTotalNums(html);
    const paidHours=nums.length>=1?nums[0]:0;
    const jobs=nums.length>=2?Math.round(nums[1]):0;
    const jph=nums.length>=3?nums[2]:0;
    const eachUnits=nums.length>=4?Math.round(nums[3]):0;
    const caseUnits=nums.length>=6?Math.round(nums[5]):0;
    if(jobs>0||caseUnits>0)dbg('[SB-TO fluid] jobs='+jobs+' cases='+caseUnits+' each='+eachUnits+' jph='+jph+' hrs='+paidHours+' hc='+headcount);
    return{jobs,caseUnits,eachUnits,jph,directHours:paidHours,headcount};
}
// "Transfer Out Dock" report (processId 1003022). Pallet-loaded cases for TO loaded volume.
// tfoot Total numerics are [paidHours, Jobs, JPH, Case-UNIT, Case-UPH, Pallet-UNIT, Pallet-UPH]
// e.g. [0.04, 10, 285.71, 389, 11114.29, 10, 285.71] -> cases=389, pallets=10.
function parseToDock(html){
    const {nums,headcount}=fnRollupTotalNums(html);
    const paidHours=nums.length>=1?nums[0]:0;
    const jobs=nums.length>=2?Math.round(nums[1]):0;
    // Primary read keeps the confirmed layout [paidHours,Jobs,JPH,Case-UNIT,Case-UPH,Pallet-UNIT,
    // Pallet-UPH]: Case-UNIT=idx3 (the pallet-loaded cases we feed into OB loaded volume),
    // Pallet-UNIT=idx5. idx3 is fragile if the report's numeric columns shift, so emit a loud
    // console.warn below so the live value is always visible/verifiable.
    const caseUnits=nums.length>=4?Math.round(nums[3]):0;
    const palletUnits=nums.length>=6?Math.round(nums[5]):0;
    console.warn('[SB-TO dock] processId=1003022 nums='+JSON.stringify(nums)+' => caseUnits(idx3)='+caseUnits+' palletUnits(idx5)='+palletUnits+' jobs='+jobs+' hrs='+paidHours+' hc='+headcount);
    if(caseUnits>0||palletUnits>0)dbg('[SB-TO dock] pallets='+palletUnits+' cases='+caseUnits+' jobs='+jobs+' hrs='+paidHours+' hc='+headcount);
    return{caseUnits,palletUnits,jobs,directHours:paidHours,headcount};
}
// Wall Builder report (process 4300006861): total paid hours = tfoot total row's
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
    // Intraday PPR: the row has a stable id. Week-span PPR renders the same line item WITHOUT
    // that id, so fall back to finding the row by its visible "IC/QA/CS" (or "ICQA") label.
    let row=doc.getElementById('ppr.detail.support.support.ICQACS');
    if(!row){
        const rows=doc.querySelectorAll('tr');
        for(const tr of rows){
            const firstCell=tr.querySelector('th,td');
            const label=(firstCell?firstCell.textContent:'').replace(/\s+/g,' ').trim();
            // Match "IC/QA/CS", "ICQA/CS", "IC/QA", "ICQA" etc. at the start of the row label.
            if(/^ic\s*\/?\s*qa(\s*\/?\s*cs)?\b/i.test(label)||/^icqa\b/i.test(label)){row=tr;break;}
        }
    }
    if(!row)return{vol:0,hrs:0,rate:0};
    let vol=0,hrs=0,rate=0;
    // Preferred path: read by the FCLM cell classes (present on the id-based Intraday row).
    row.querySelectorAll('td').forEach(c=>{
        const cls=c.className||'';
        const div=c.querySelector('div.original');
        const txt=(div?div.textContent:c.textContent).trim().replace(/,/g,'');
        const v=parseFloat(txt);
        if(isNaN(v))return;
        if(cls.includes('actualVolume'))vol=v;
        else if(cls.includes('actualTimeSeconds'))hrs=v;
        else if(cls.includes('actualProductivity'))rate=v;
    });
    // Fallback for the Week row (no FCLM cell classes): the standard PPR column order is
    // [label, Planned Vol, Planned Hrs, Planned Rate, Actual Vol, Actual Hrs, Actual Rate, ...].
    // Pull the numeric cells and take Actual Vol/Hrs/Rate by position, then derive rate if needed.
    if(vol===0&&hrs===0&&rate===0){
        const cells=Array.from(row.querySelectorAll('td'));
        const nums=cells.map(c=>{const d=c.querySelector('div.original');const t=(d?d.textContent:c.textContent).trim().replace(/,/g,'');const v=parseFloat(t);return isNaN(v)?null:v;}).filter(v=>v!==null);
        // nums: [PlanVol, PlanHrs, PlanRate, ActVol, ActHrs, ActRate, ...]
        if(nums.length>=6){vol=nums[3];hrs=nums[4];rate=nums[5];}
        else if(nums.length>=3){vol=nums[0];hrs=nums[1];rate=nums[2];}
    }
    if(rate===0&&hrs>0)rate=vol/hrs;
    return{vol,hrs,rate};
}

async function fetchPeriod(site,startDate,sched){
    const sh=sched.sh,sm=sched.sm,eh=sched.eh,em=sched.em;
    // For night shift periods after midnight, adjust the start date to next day
    let sDate=new Date(startDate);
    if(sh<12&&startDate.getHours()>=12){sDate.setDate(sDate.getDate()+1);}
    let eDate=new Date(sDate);if(eh<sh)eDate.setDate(eDate.getDate()+1);
    const urls={ppr:buildPPRUrl(site,sDate,sh,sm,eDate,eh,em),stow:buildFnUrl(site,PROCESS_IDS.stow,sDate,sh,sm,eDate,eh,em),palletStow:buildFnUrl(site,PROCESS_IDS.palletStow,sDate,sh,sm,eDate,eh,em),pick:buildFnUrl(site,PROCESS_IDS.pick,sDate,sh,sm,eDate,eh,em),sort:buildFnUrl(site,PROCESS_IDS.sort,sDate,sh,sm,eDate,eh,em),obDock:buildFnUrl(site,PROCESS_IDS.obDock,sDate,sh,sm,eDate,eh,em),toFluidLoad:buildFnUrl(site,PROCESS_IDS.toFluidLoad,sDate,sh,sm,eDate,eh,em),toDock:buildFnUrl(site,PROCESS_IDS.toDock,sDate,sh,sm,eDate,eh,em),rsr:buildFnUrl(site,PROCESS_IDS.rsr,sDate,sh,sm,eDate,eh,em)};
    const res={};
    // Dispatch each report to its parser. PPR uses parsePPR; the split TO reports use their own
    // parsers; everything else uses the generic fn-rollup parser.
    const parseFor=(k,h)=>{if(k==='ppr')return parsePPR(h);if(k==='toFluidLoad')return parseToFluidLoad(h);if(k==='toDock')return parseToDock(h);return parseFnRollup(h);};
    const emptyFor=(k)=>{if(k==='ppr')return{ibPlannedHrs:0,ibActualHrs:0,obPlannedHrs:0,obActualHrs:0,daTransferHrs:0,daTransferPlan:0,caseStowReserveHrs:0,throughputVol:0,throughputHrs:0,totHrs:0};if(k==='toFluidLoad')return{jobs:0,caseUnits:0,eachUnits:0,jph:0,directHours:0,headcount:0};if(k==='toDock')return{caseUnits:0,palletUnits:0,jobs:0,directHours:0,headcount:0};return{totalUnits:0,directHours:0,rate:0,headcount:0};};
    await Promise.all(Object.entries(urls).map(async([k,u])=>{try{const h=await fetchHTML(u);res[k]=parseFor(k,h);}catch(e){console.warn('[SB]',k,e.message);res[k]=emptyFor(k);}}));
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
    return'/reports/processPathRollup?reportFormat=HTML&warehouseId='+site+'&spanType=Week&startDateWeek='+encodeURIComponent(fmtDate(weekStartDate))+'&_adjustPlanHours=on&employmentType=AllEmployees';
}
// Function Rollup report scoped to the report's own Week span (used for ICQA DC% week view)
function buildFnUrlWeek(site,pid,weekStartDate){
    return'/reports/functionRollup?reportFormat=HTML&warehouseId='+site+'&processId='+pid+'&spanType=Week&startDateWeek='+encodeURIComponent(fmtDate(weekStartDate));
}
// Walks a Function Rollup page and pulls the "Total Paid Hours" (first numeric cell in
// the "Total" sub-row) for each named Function. From the Inspector, each function's
// Total sub-row is a <tr class=" empl-all"> containing a <td> with text "Total" (the
// size-total cell) plus <td class="numeric size-total highlighted"> cells.
// The function name appears as link text in an earlier row of the same function block.
function parseFunctionHoursByName(doc,names){
    const result={};
    names.forEach(n=>{result[n]=0;});
    const allRows=doc.querySelectorAll('tr');
    let currentFn=null;
    for(let i=0;i<allRows.length;i++){
        const row=allRows[i];
        const rowText=row.textContent;
        // Check if this row starts a new function block
        for(const name of names){
            if(rowText.indexOf(name)!==-1){
                // Make sure it's actually the function name row, not just a coincidence
                const links=row.querySelectorAll('a');
                for(const a of links){
                    if(a.textContent.trim()===name){currentFn=name;break;}
                }
                if(currentFn===name)break;
                // Fallback: check td text directly
                const tds=row.querySelectorAll('td');
                for(const td of tds){
                    if(td.textContent.trim()===name){currentFn=name;break;}
                }
                if(currentFn===name)break;
            }
        }
        // Check if this is the "Total" sub-row for the current function
        if(currentFn){
            const tds=row.querySelectorAll('td');
            let isTotalRow=false;
            for(const td of tds){
                const t=td.textContent.trim();
                if(t==='Total'&&td.className.indexOf('size-total')!==-1){isTotalRow=true;break;}
                if(t==='Total'&&td.className.indexOf('highlighted')!==-1){isTotalRow=true;break;}
                if(t==='Total'&&!td.className.includes('numeric')){isTotalRow=true;break;}
            }
            if(isTotalRow){
                // First cell whose class contains "numeric" = Total Paid Hours
                for(const td of tds){
                    if(td.className.indexOf('numeric')!==-1){
                        const val=parseFloat(td.textContent.trim().replace(/,/g,''))||0;
                        if(val>0){result[currentFn]=val;break;}
                    }
                }
                currentFn=null;
            }
        }
    }
    return result;
}
// DC% (Direct Count %) = (SBC - Library Deep + Other Library Deep hours)
//   / (report GRAND TOTAL paid hours), off the ICQA process Function Rollup.
// See parseSummaryFunctionHours() + calcDCPercent() below.

// Reads per-function paid hours straight from the ICQA Function Rollup SUMMARY table
// (table#summary). Each function is one row in that table's <tbody>: the function name is
// link/th text and its Total Paid Hours is the FIRST <td class="numeric"> in that same row.
// This is the same, proven structure parseFnRollup() uses for the tfoot grand-total row,
// so it avoids the fragile per-function-detail-block walk that misread the wrong column.
function parseSummaryFunctionHours(doc,names){
    const result={};names.forEach(n=>{result[n]=0;});
    const summary=doc.querySelector('table#summary')||doc;
    const rows=summary.querySelectorAll('tbody tr, tr');
    for(const row of rows){
        // The label lives in the row's th/td link text (e.g. "Other Library Deep").
        let label='';
        const a=row.querySelector('a');
        if(a)label=a.textContent.trim();
        if(!label){const th=row.querySelector('th');if(th)label=th.textContent.trim();}
        if(!label)continue;
        // Match against the requested function names (exact, then normalized).
        let matched=null;
        for(const n of names){if(label===n){matched=n;break;}}
        if(!matched){const norm=s=>s.replace(/\s+/g,' ').trim().toLowerCase();for(const n of names){if(norm(label)===norm(n)){matched=n;break;}}}
        if(!matched)continue;
        // The summary lists each function in more than one row-block (e.g. a Paid-Hours
        // block and a Units block). The FIRST occurrence is the Paid Hours value, so keep
        // it and do NOT let a later duplicate row (e.g. Other Library Deep=3.14) overwrite
        // the correct value (e.g. Other Library Deep=15.33).
        if(result[matched]>0)continue;
        const cell=row.querySelector('td.numeric');
        if(cell){const v=parseFloat(cell.textContent.trim().replace(/,/g,''))||0;if(v>0)result[matched]=v;}
    }
    return result;
}
// DC% (Direct Count %):
//   numerator   = SBC - Library Deep + Other Library Deep paid hours
//   denominator = the report GRAND TOTAL paid hours (summary tfoot total row, first numeric)
// e.g. (2.50 + 14.41) / 22.52 = ~75%.
function calcDCPercent(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    // Numerator functions, read from the summary table.
    const byName=parseSummaryFunctionHours(doc,DC_NUMERATOR_FUNCTIONS);
    const dcHours=DC_NUMERATOR_FUNCTIONS.reduce((s,n)=>s+(byName[n]||0),0);
    // Denominator = report grand total paid hours (same row parseFnRollup uses).
    const totalRow=doc.querySelector('tfoot tr.total.empl-all')||doc.querySelector('tr.total.empl-all')||doc.querySelector('tfoot tr.total')||doc.querySelector('tfoot tr');
    let totalHours=0;
    if(totalRow){const c=totalRow.querySelectorAll('td.numeric');if(c.length>=1)totalHours=parseFloat(c[0].textContent.trim().replace(/,/g,''))||0;}
    // DEBUG: dump every summary-table function row (label + first numeric) so we can verify
    // exact function names/values on the live page if the numbers still look off.
    try{
        const dump=[];const summary=doc.querySelector('table#summary')||doc;
        summary.querySelectorAll('tbody tr, tr').forEach(r=>{
            const a=r.querySelector('a');const th=r.querySelector('th');
            const lbl=(a?a.textContent.trim():(th?th.textContent.trim():''));
            const num=r.querySelector('td.numeric');
            if(lbl&&num){const v=parseFloat(num.textContent.trim().replace(/,/g,''));if(!isNaN(v))dump.push(lbl+'='+v);}
        });
        dbg('[SB-DC] summary rows:',dump.join(' | '));
    }catch(e){}
    dbg('[SB-DC] numerator byName:',JSON.stringify(byName),'dcHours:',dcHours,'grandTotalHours:',totalHours);
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
// Normalizes a single ALPS grid cell to a number, tolerating every value shape ALPS emits:
// a plain number, {value:<number>}, {value:{parsedValue:<number>}}, or a formatted string
// (e.g. "9,474" -> strip commas, parseFloat). Returns null when nothing numeric is present.
function alpsCellNumber(cell){
    if(cell==null)return null;
    let v=cell;
    if(typeof v==='object'){
        if(v.value!=null)v=v.value;
    }
    if(typeof v==='object'&&v!=null){
        if(typeof v.parsedValue!=='undefined')v=v.parsedValue;
    }
    if(typeof v==='number')return isNaN(v)?null:v;
    if(typeof v==='string'){const n=parseFloat(v.replace(/,/g,''));return isNaN(n)?null:n;}
    return null;
}
// Reads the "Capacity" cell for the current date from the Day/Night COMBINED CARTONS section
// of the ALPS dailyView getPlanSelectionData response. The response's Metric header rows run
// ["Day","Night",...,"Day Combined Cartons","Night Combined Cartons",...]; the published carton
// target lives NESTED under the Combined-Cartons section (ALPS UI: Day Combined Cartons >
// Volume > Capacity = 9,474 / Night = 9,000), NOT under the bare "Day"/"Night" header. So we
// (1) match the section row whose header === "Day/Night Combined Cartons", then (2) recurse its
// subRows for the FIRST "Capacity" row, with a positional fallback for a flat (sub-row-less)
// response. IB vs DA is the request's `selection` param, not a different section — both return
// the same Combined-Cartons headers, so the walk is identical.
function findAlpsSectionCapacity(data,dayOrNight,dateISO,diag){
    // diag is an OPTIONAL write-only out-param for troubleshooting (see fetchAlpsDailyCapacity).
    // Behavior/return value is IDENTICAL whether or not diag is passed; every diag write is
    // guarded by if(diag).
    const norm=(s)=>String(s==null?'':s).trim().toLowerCase();
    const targetSection=dayOrNight==='Night'?'Night Combined Cartons':'Day Combined Cartons';
    const wantSection=norm(targetSection);
    if(diag){diag.targetSection=targetSection;diag.sectionFound=false;diag.capacityFound=false;diag.subRowHeaders=[];}
    if(!Array.isArray(data))return null;
    // 1. Locate the "Day/Night Combined Cartons" section node. Each top-level element either
    // carries its rows in a Metric array (match the FIRST row whose header === target) or IS the
    // row itself (fallback). Break out once found.
    let sectionNode=null;
    for(const el of data){
        if(el&&Array.isArray(el.Metric)){
            for(const r of el.Metric){if(r&&norm(r.header)===wantSection){sectionNode=r;break;}}
            if(sectionNode)break;
        }
        if(el&&norm(el.header)===wantSection){sectionNode=el;break;}
    }
    if(!sectionNode)return null; // diag.sectionFound stays false
    if(diag)diag.sectionFound=true;
    // 2. COLLECT ALL "Capacity" rows in the matched section's subtree (recurse subRows fully),
    // in document order. There can be MULTIPLE Capacity rows (an aggregate/parent whose cell is
    // null plus the real Volume->Capacity row that holds the value); we must pick by value, not
    // by position. Closes over norm and diag; records every header seen (capped at 40).
    const capacityRows=[];
    function collectCapacityDeep(node){
        if(!node)return;
        if(diag&&node.header!=null&&diag.subRowHeaders.length<40)diag.subRowHeaders.push(node.header);
        if(norm(node.header)==='capacity')capacityRows.push(node);
        if(Array.isArray(node.subRows)){
            for(const sub of node.subRows)collectCapacityDeep(sub);
        }
    }
    collectCapacityDeep(sectionNode);
    // 3. SECONDARY positional fallback for a flat response (section node with no subRows, or no
    // nested Capacity found): flatten rows the SAME way the diagnostic does, find the section
    // header's index, then scan forward for EVERY "Capacity" row before the next section header.
    // Mirrors the old positional behavior but collects all candidates, scoped to the section.
    if(capacityRows.length===0){
        const rows=[];
        for(const el of data){
            if(el&&Array.isArray(el.Metric)){for(const r of el.Metric)rows.push(r);}
            else rows.push(el);
        }
        const STOP=new Set(['day combined cartons','night combined cartons','day','night','hq','local time-zone','local time zone']);
        let start=-1;
        for(let i=0;i<rows.length;i++){if(rows[i]&&norm(rows[i].header)===wantSection){start=i;break;}}
        if(start>=0){
            for(let i=start+1;i<rows.length;i++){
                const r=rows[i];
                if(diag&&r&&r.header!=null&&diag.subRowHeaders.length<40)diag.subRowHeaders.push(r.header);
                if(r&&STOP.has(norm(r.header)))break;
                if(r&&norm(r.header)==='capacity')capacityRows.push(r);
            }
        }
    }
    if(capacityRows.length===0)return null; // diag.capacityFound stays false
    // Resolves ONE Capacity row's value for the date: first the row's own cell, else the row's
    // OWN direct "Forecast" subRow. ALPS keeps the published/forecasted carton number for a day
    // whose Capacity has not been locked/overridden in a "Forecast" child nested directly under
    // the Capacity row (the header dump shows "Capacity" immediately followed by its own
    // "Forecast" subRow). The forecast lookup is scoped to capRow.subRows DIRECT children only so
    // we never grab sibling "Forecast" rows belonging to Assignments / Volume Delta / Rate / etc.
    // Reuses norm + alpsCellNumber (no reimplementation). Returns number|null.
    function capacityValue(capRow,dateISO){
        if(!capRow)return null;
        const own=alpsCellNumber(capRow[dateISO]);
        if(own!=null)return own;
        if(Array.isArray(capRow.subRows)){
            for(const child of capRow.subRows){
                if(child&&norm(child.header)==='forecast')return alpsCellNumber(child[dateISO]);
            }
        }
        return null;
    }
    // Finds a Capacity row's OWN direct "Forecast" subRow (or null) — used for diag reporting of
    // the raw forecast-child cell.
    function forecastChildOf(capRow){
        if(capRow&&Array.isArray(capRow.subRows)){
            for(const child of capRow.subRows){
                if(child&&norm(child.header)==='forecast')return child;
            }
        }
        return null;
    }
    // 4. Record each Capacity candidate (capped at ~10) so we can SEE which row held the value.
    if(diag){
        diag.capacityCandidates=[];
        for(const row of capacityRows){
            if(diag.capacityCandidates.length>=10)break;
            const raw=row[dateISO];
            const fc=forecastChildOf(row);
            diag.capacityCandidates.push({dateKeysPresent:Object.prototype.hasOwnProperty.call(row,dateISO),rawValueForDate:raw,parsed:alpsCellNumber(raw),forecastRawValue:fc?fc[dateISO]:null,resolved:capacityValue(row,dateISO)});
        }
    }
    // 5. Prefer the FIRST Capacity row whose RESOLVED value (own cell, else own Forecast child)
    // for dateISO is a NON-NULL number, skipping null aggregate/parent rows. If none resolves to
    // a usable value, fall back to the FIRST Capacity row (parses to null) so behavior degrades
    // gracefully.
    let chosenRow=null;
    for(const row of capacityRows){if(capacityValue(row,dateISO)!=null){chosenRow=row;break;}}
    if(!chosenRow)chosenRow=capacityRows[0];
    const resolved=capacityValue(chosenRow,dateISO);
    if(diag){
        diag.capacityFound=true;diag.capacityDateKeys=Object.keys(chosenRow);diag.rawCell=chosenRow[dateISO];
        // resolvedVia tells where the returned number came from: the Capacity cell itself, its
        // Forecast child, or nothing.
        diag.resolvedVia=(alpsCellNumber(chosenRow[dateISO])!=null)?'capacity':(resolved!=null?'forecast-child':'none');
        // DIAGNOSTIC: deep, depth-first dump of the CHOSEN capacity row + its subRows so we can
        // SEE where 7,156 lives (a key/field other than .value, or a different subRow). Each entry
        // captures the FULL raw cell object at dateISO (node[dateISO]) — not just .value — because
        // the number we want may sit under a computed/rollup/override field. Capped at depth<=3
        // levels and <=30 total entries.
        const capacityRowDump=[];
        const dumpDeep=(node,depth)=>{
            if(!node||depth>3||capacityRowDump.length>=30)return;
            capacityRowDump.push({header:node.header,cellForDate:(node[dateISO]!=null?node[dateISO]:null),otherKeys:Object.keys(node).filter((k)=>k!=='subRows')});
            if(Array.isArray(node.subRows)){
                for(const sub of node.subRows){
                    if(capacityRowDump.length>=30)break;
                    dumpDeep(sub,depth+1);
                }
            }
        };
        dumpDeep(chosenRow,1);
        diag.capacityRowDump=capacityRowDump;
        // Capture the chosen Capacity cell's own key/field names and the full raw cell object so
        // we see every field name present on the Capacity cell itself.
        diag.chosenCapacityAllKeys=Object.keys(chosenRow);
        diag.chosenCapacityCellRaw=chosenRow[dateISO];
    }
    return resolved;
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
    dbg('[SB] ALPS auth failed, refreshing session via iframe...');
    const iframe=document.createElement('iframe');
    iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
    iframe.src='https://iad.alps-basecamp.lamps.amazon.dev/'+site;
    document.body.appendChild(iframe);
    setTimeout(()=>{
        if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
        dbg('[SB] Retrying ALPS fetch after auth...');
        fetchAlpsLoadedRate(site,true).then(resolve);
    },5000);
}
// Fetches the ALPS daily-plan "Capacity" (published target VOLUME in CARTONS) for a single
// selection (process path), a Day/Night section, and the current production date. Mirrors
// fetchAlpsLoadedRate's structure (resolve Live planId, then GET getPlanSelectionData via
// GM_xmlhttpRequest with the hidden-iframe session refresh + single retry on auth failure),
// but uses view=dailyView and withUserOverrides=TRUE.
// UNITS-vs-CARTONS GOTCHA: a prior capture with withUserOverrides=false returned the raw
// forecast in UNITS/eaches (~73,185) instead of the published CARTONS (~9,474). Using
// withUserOverrides=true should yield cartons. If the extracted value is implausibly large
// (> 60000 when a carton target should be ~10k) we still DISPLAY it but log a warning about a
// possible units-vs-cartons mismatch. This needs live confirmation against the running site.
//
// PLAN RESOLUTION: the daily-capacity path resolves the STABLE weekly "S1" plan (a plan carrying
// BOTH the "Live" AND "Weekly" tags, newest by createdAt) rather than the rolling draft returned
// by latest-completed-plan-by-tag?tagName=Live. The S1 carton targets are set the week before and
// do not change day-to-day; the rolling Live draft can shift. resolveAlpsS1PlanId does the
// two-call list+tags resolution; fetchAlpsDailyCapacity falls back to the old Live behavior if no
// S1 plan is found so it degrades gracefully. (ICQA path fetchAlpsLoadedRate stays on tagName=Live.)
// Memoizes the resolved S1 (stable weekly) plan resolution per site+weekSunday for the
// duration of ONE fetchEOSWashData run. Caches the in-flight PROMISE (not the value) so the
// concurrent IB + DA capacity fetches (Promise.all in fetchEOSWashData) share a single
// resolution instead of each hitting the list/tags endpoints. Keyed by site + '|' + weekSundayMs
// so it auto-invalidates next week and across sites; short-lived because each EOS run reassigns.
let _alpsS1PlanCache={key:null,promise:null};
// Resolves the S1 (stable weekly) planId for the current week: GET the week's completed plans,
// POST to batch-get-plan-tags for all of them, then PICK the planId carrying BOTH 'Live' and
// 'Weekly' tags (newest by createdAt when several match). Returns Promise<string|null> and never
// rejects — resolves null on empty list / tag fetch failure / no S1 match so callers stay
// fail-soft. No iframe/session-retry here; session refresh stays owned by fetchAlpsDailyCapacity /
// refreshAlpsSessionAndRetryDaily, which re-invoke this (and hit the memo) on their retry.
function resolveAlpsS1PlanId(site){
    const sunday=getWeekSunday();
    // The weekly S1 (published) plan is created the FRIDAY BEFORE the week it covers, so its
    // createdAt falls in the PRIOR week. Look back 10 days from this week's Sunday so that plan is
    // included in the candidate list; otherwise completed-plans-by-date-range returns only the
    // recent rolling drafts and no Live+Weekly S1 plan is found. endMs still covers the full week.
    const weekStartMs=sunday.getTime();
    const startMs=weekStartMs-10*24*3600*1000;
    const endMs=weekStartMs+7*24*3600*1000;
    const key=site+'|'+weekStartMs;
    if(_alpsS1PlanCache.key===key&&_alpsS1PlanCache.promise)return _alpsS1PlanCache.promise;
    const promise=new Promise(resolve=>{
        const listUrl='https://alps-iad.iad.proxy.amazon.com/api/site/'+site+'/completed-plans-by-date-range?siteType=FULFILLMENT_CENTER&inclusiveStartTime='+startMs+'&exclusiveEndTime='+endMs+'&exhaustive=true&includeErrorPlans=false';
        GM_xmlhttpRequest({method:'GET',url:listUrl,headers:{'Accept':'application/json'},
            onload:function(resp){
                try{
                    const list=JSON.parse(resp.responseText);
                    const metas=(list&&list.planMetaDataList)||[];
                    if(metas.length===0){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: no plans in week range');resolve(null);return;}
                    const planIds=metas.map(m=>m&&m.planId).filter(Boolean);
                    const createdAtById={};
                    metas.forEach(m=>{if(m&&m.planId)createdAtById[m.planId]=m.createdAt;});
                    if(planIds.length===0){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: no planIds in week range');resolve(null);return;}
                    const tagsUrl='https://alps-iad.iad.proxy.amazon.com/api/site/'+site+'/plan/batch-get-plan-tags';
                    GM_xmlhttpRequest({method:'POST',url:tagsUrl,headers:{'Content-Type':'application/json','Accept':'application/json'},data:JSON.stringify({planIds:planIds}),
                        onload:function(resp2){
                            try{
                                const tags=JSON.parse(resp2.responseText);
                                const byId=(tags&&tags.tagAssignmentsByPlanId)||{};
                                // The PUBLISHED/PRODUCTION plan the ALPS UI shows (with the real
                                // carton targets, e.g. c81d072b) is the one tagged "Promoted" — only
                                // one plan is Promoted at a time (the plan promoted to live/production).
                                // "Live"+"Weekly" alone is too broad (every recent recalc carries them,
                                // ~30 candidates), so a "newest Live+Weekly" pick grabs a newer draft
                                // with slightly different numbers. Prefer PROMOTED; fall back to
                                // Live+Weekly only if no Promoted plan is present, so it degrades.
                                const promoted=[],liveWeekly=[];
                                for(const pid of planIds){
                                    const assigns=byId[pid]||[];
                                    const names=new Set(assigns.map(a=>a&&a.tagDefinition&&String(a.tagDefinition.tagName||'').toLowerCase()));
                                    if(names.has('promoted'))promoted.push(pid);
                                    if(names.has('live')&&names.has('weekly'))liveWeekly.push(pid);
                                }
                                const pick=(promoted.length?promoted:liveWeekly);
                                pick.sort((a,b)=>(createdAtById[b]||0)-(createdAtById[a]||0));
                                const chosen=pick[0]||null;
                                if(chosen){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: S1 planId='+chosen+' (via='+(promoted.length?'Promoted':'Live+Weekly')+', promoted='+promoted.length+' liveWeekly='+liveWeekly.length+')');resolve(chosen);}
                                else{console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: no Promoted or Live+Weekly plan found');resolve(null);}
                            }catch(e){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: tags parse error: '+e.message);resolve(null);}
                        },
                        onerror:function(){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: tags fetch error');resolve(null);},
                        ontimeout:function(){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: tags fetch timeout');resolve(null);}
                    });
                }catch(e){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: list parse error: '+e.message);resolve(null);}
            },
            onerror:function(){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: list fetch error');resolve(null);},
            ontimeout:function(){console.warn('[SB-EOS-ALPS] resolveAlpsS1PlanId: list fetch timeout');resolve(null);}
        });
    });
    _alpsS1PlanCache={key:key,promise:promise};
    return promise;
}
function fetchAlpsDailyCapacity(site,selection,dateISO,dayOrNight,isRetry){
    return new Promise(resolve=>{
        const sunday=getWeekSunday();
        const sundayStr=isoDate(sunday);
        const endDate=new Date(sunday);endDate.setDate(endDate.getDate()+6);
        const retryOrFail=(reason)=>{
            if(!isRetry){refreshAlpsSessionAndRetryDaily(site,selection,dateISO,dayOrNight,resolve);return;}
            console.warn('[SB-EOS-ALPS] selection='+selection+' FINAL FAIL:',reason);resolve(null);
        };
        // Second stage (unchanged behavior): with a resolved planId, GET the dailyView
        // getPlanSelectionData grid, run findAlpsSectionCapacity, emit the existing diagnostics,
        // and resolve the capacity value. viaS1 only drives the logged resolution path.
        const proceedWithPlan=(planId,viaS1)=>{
            console.warn('[SB-EOS-ALPS] resolved planId='+planId+' (via='+(viaS1?'S1-weekly':'fallback-live')+')');
            // view=dailyView + withUserOverrides=true (see GOTCHA above). startDate/endDate
            // span the week (Sun..Sat) like the weekly fetch; we read the current date's column.
            const dataUrl='https://alps-iad.iad.proxy.amazon.com/api/report/FULFILLMENT_CENTER/'+site+'/getPlanSelectionData?view=dailyView&selection='+encodeURIComponent(selection)+'&planId='+encodeURIComponent(planId)+'&withUserOverrides=true&startDate='+sundayStr+'&endDate='+isoDate(endDate);
            GM_xmlhttpRequest({method:'GET',url:dataUrl,headers:{'Accept':'application/json'},
                onload:function(resp2){
                    try{
                        const data=JSON.parse(resp2.responseText);
                        // Header dump: flatten the SAME WAY findAlpsSectionCapacity does
                        // (each el.Metric or the el itself) and map to r.header.
                        const headerList=[];
                        if(Array.isArray(data)){
                            for(const el of data){
                                if(el&&Array.isArray(el.Metric)){for(const r of el.Metric)headerList.push(r&&r.header);}
                                else headerList.push(el&&el.header);
                            }
                        }
                        console.warn('[SB-EOS-ALPS] '+selection+'/'+dayOrNight+' status='+(resp2.status||0)+' isArray='+Array.isArray(data)+' topLevel='+(Array.isArray(data)?data.length:'n/a')+' headers='+JSON.stringify(headerList.slice(0,60)));
                        const diag={};
                        const val=findAlpsSectionCapacity(data,dayOrNight,dateISO,diag);
                        console.warn('[SB-EOS-ALPS] '+selection+'/'+dayOrNight+' sectionFound='+diag.sectionFound+' capacityFound='+diag.capacityFound+' dateISO='+dateISO+' capacityDateKeys='+JSON.stringify((diag.capacityDateKeys||[]).slice(0,20))+' rawCell='+JSON.stringify(diag.rawCell)+' => val='+val);
                        console.warn('[SB-EOS-ALPS] '+selection+'/'+dayOrNight+' subRowHeaders='+JSON.stringify(diag.subRowHeaders||[]));
                        console.warn('[SB-EOS-ALPS] '+selection+'/'+dayOrNight+' capacityCandidates='+JSON.stringify(diag.capacityCandidates||[]));
                        console.warn('[SB-EOS-ALPS] '+selection+'/'+dayOrNight+' capacityRowDump='+JSON.stringify(diag.capacityRowDump||[])+' chosenCapacityAllKeys='+JSON.stringify(diag.chosenCapacityAllKeys||[])+' chosenCapacityCellRaw='+JSON.stringify(diag.chosenCapacityCellRaw||null));
                        dbg('[SB-EOS-ALPS] selection='+selection+' section='+dayOrNight+' date='+dateISO+' rawCapacity='+val);
                        if(val!=null&&val>60000){
                            console.warn('[SB-EOS-ALPS] implausibly large capacity ('+val+') for '+selection+'/'+dayOrNight+'/'+dateISO+' \u2014 possible units-vs-cartons mismatch (expected ~10k cartons)');
                        }
                        resolve(val);
                    }catch(e){retryOrFail('plan data parse error: '+e.message);}
                },
                onerror:function(){retryOrFail('plan data fetch error for selection='+selection);},
                ontimeout:function(){retryOrFail('plan data fetch timeout for selection='+selection);}
            });
        };
        // Fallback (OLD behavior): resolve the latest-completed Live plan by tag, then proceed.
        const resolveViaLiveFallback=()=>{
            const planUrl='https://alps-iad.iad.proxy.amazon.com/api/site/'+site+'/latest-completed-plan-by-tag?tagName=Live&siteType=FULFILLMENT_CENTER&polling=true';
            GM_xmlhttpRequest({method:'GET',url:planUrl,headers:{'Accept':'application/json'},
                onload:function(resp){
                    let planId=null;
                    try{planId=JSON.parse(resp.responseText).planId;}catch(e){}
                    console.warn('[SB-EOS-ALPS] '+selection+' planId='+planId+' (status='+(resp.status||0)+')');
                    if(!planId){console.warn('[SB-EOS-ALPS] '+selection+' planId response body (first 200): '+String(resp&&resp.responseText||'').slice(0,200));retryOrFail('no planId in response (session likely expired) for selection='+selection);return;}
                    proceedWithPlan(planId,false);
                },
                onerror:function(){retryOrFail('planId fetch error for selection='+selection);},
                ontimeout:function(){retryOrFail('planId fetch timeout for selection='+selection);}
            });
        };
        // PRIMARY path: resolve the STABLE weekly S1 plan (BOTH Live+Weekly tags). On null (no S1
        // match / auth fail / empty), fall back to the latest-completed Live plan so we degrade
        // gracefully. The .catch is belt-and-suspenders — resolveAlpsS1PlanId never rejects.
        resolveAlpsS1PlanId(site).then(s1PlanId=>{
            if(s1PlanId){proceedWithPlan(s1PlanId,true);}
            else{console.warn('[SB-EOS-ALPS] '+selection+' no S1 plan resolved \u2014 falling back to latest-completed Live plan');resolveViaLiveFallback();}
        }).catch(()=>resolveViaLiveFallback());
    });
}
// Daily-capacity twin of refreshAlpsSessionAndRetry: silent iframe session refresh, then a
// single retry of fetchAlpsDailyCapacity. Kept separate so the ICQA path is unaffected.
function refreshAlpsSessionAndRetryDaily(site,selection,dateISO,dayOrNight,resolve){
    dbg('[SB-EOS-ALPS] ALPS auth failed, refreshing session via iframe...');
    const iframe=document.createElement('iframe');
    iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
    iframe.src='https://iad.alps-basecamp.lamps.amazon.dev/'+site;
    document.body.appendChild(iframe);
    setTimeout(()=>{
        if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
        dbg('[SB-EOS-ALPS] Retrying ALPS daily capacity fetch after auth...');
        fetchAlpsDailyCapacity(site,selection,dateISO,dayOrNight,true).then(resolve);
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
        // Week: use the SAME calc as the shift — the PPR IC/QA/CS row's actualVolume /
        // actualTimeSeconds via parseICQARow. The shift works because it uses the INTRADAY PPR
        // (server-rendered). The problem with the earlier attempts was spanType=Week, whose PPR
        // renders client-side (data not in the fetched HTML). Fix: fetch the INTRADAY PPR over a
        // Multi-day (maxIntradayDays=8) Intraday PPR now renders CLIENT-SIDE (its IC/QA/CS row
        // isn't in the fetched HTML). The SINGLE-DAY (maxIntradayDays=1) Intraday PPR is still
        // server-rendered and works (that's how the shift value is read). So: fetch a 1-day PPR for
        // EACH day of the week so far (Sunday -> today), parse each with parseICQARow, and sum the
        // IC/QA/CS volume + hours across the days. Week RO rate = totalVol / totalHrs.
        try{
            const weekSun=getWeekSunday();
            const today=new Date();
            const dayFetches=[];
            for(let d=new Date(weekSun);d<=today;d.setDate(d.getDate()+1)){
                const day=new Date(d);
                const isToday=day.toDateString()===today.toDateString();
                const eh=isToday?today.getHours():23, em=isToday?today.getMinutes():59;
                const url=buildPPRUrl(config.site,day,0,0,day,eh,em);   // 1-day Intraday PPR (server-rendered)
                dayFetches.push(fetchHTML(url).then(h=>parseICQARow(new DOMParser().parseFromString(h,'text/html'))).catch(()=>({vol:0,hrs:0,rate:0})));
            }
            const dayResults=await Promise.all(dayFetches);
            let totVol=0,totHrs=0;
            dayResults.forEach(r=>{totVol+=(r.vol||0);totHrs+=(r.hrs||0);});
            const weekRate=totHrs>0?totVol/totHrs:0;
            dbg('[SB-ICQA-RO] Week (summed 1-day PPRs): days='+dayResults.length+' vol='+totVol+' hrs='+totHrs.toFixed(2)+' rate='+weekRate.toFixed(2));
            setEl('icqa-ro-week-actual',weekRate>0?fmt(weekRate,2):'\u2014');
            if(target>0&&weekRate>0){const p=(weekRate/target)*100;const el=setEl('icqa-ro-week-pct',fmtPct(p));setPctClass(el,p);}
            else setEl('icqa-ro-week-pct','\u2014');
        }catch(we){
            console.warn('[SB-ICQA-RO] Week fetch failed:',we.message,'(session/URL issue?)');
            setEl('icqa-ro-week-actual','\u2014');setEl('icqa-ro-week-pct','\u2014');
        }
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
        dbg('[SB-DC] Fetching shift DC%, URL:',shiftUrl);
        const shiftHtml=await fetchHTML(shiftUrl);
        dbg('[SB-DC] Shift HTML length:',shiftHtml.length,'first 300:',shiftHtml.substring(0,300));
        const shiftDC=calcDCPercent(shiftHtml);
        dbg('[SB-DC] Shift result:',JSON.stringify(shiftDC));
        // Store ICQA total hours (the DC% denominator) so the EOS Wash can show it as ICQA Actual Hours.
        window._icqaTotalHours=shiftDC.totalHours;
        setEl('icqa-dc-shift-actual',shiftDC.totalHours>0?fmtPct(shiftDC.pct):'\u2014');
        // Color shift DC% green if >= 70, red if below
        const shiftEl=document.getElementById('icqa-dc-shift-actual');
        if(shiftEl&&shiftDC.totalHours>0){shiftEl.style.color=shiftDC.pct>=70?'#2e7d32':'#c62828';}

        const weekUrl=buildFnUrlWeek(site,PROCESS_IDS.icqa,getWeekSunday());
        const weekHtml=await fetchHTML(weekUrl);
        const weekDC=calcDCPercent(weekHtml);
        setEl('icqa-dc-week-actual',weekDC.totalHours>0?fmtPct(weekDC.pct):'\u2014');
        // Color week DC% green if >= 70, red if below
        const weekEl=document.getElementById('icqa-dc-week-actual');
        if(weekEl&&weekDC.totalHours>0){weekEl.style.color=weekDC.pct>=70?'#2e7d32':'#c62828';}
    }catch(e){console.warn('[SB-DC] ICQA DC% fetch error:',e.message,e.stack);}
}

// === ICQA: ATLAS Qubit defect metrics (Bin Collision, Ship Failed Moves) ===
// The ATLAS defect dashboard (atlas.qubit.amazon.dev) exposes a cookie-authed GraphQL
// endpoint. Auth is the Midway SSO cookie (amzn_sso_token) which GM_xmlhttpRequest sends
// automatically — same model as GalaxyBI/GCA, NOT AWS SigV4 — so we can replay it in the
// background. It uses an Apollo PERSISTED QUERY (operationName "getMetrics"), identified by a
// sha256Hash. If ATLAS ever changes that query the hash changes and the call returns
// PersistedQueryNotFound; recapture the hash from DevTools if that happens.
// variables.relativeTime is SECONDS back from now — we set it to seconds-since-shift-SOS so it
// tracks shift-to-date (matching how the dashboard is read for the shift). warehouseType is
// "Supplemental" for these SDC sites (as captured).
const ATLAS_GQL_URL='https://atlas.qubit.amazon.dev/graphql';
const ATLAS_GETMETRICS_HASH='7e9652a8ba7b9a27e0cfab2ba2ec2ca41e4bb8296d523a41896c36811776e0a4';
// Metrics we surface, by their ATLAS metric `name`, with the label shown in the ICQA panel.
const ATLAS_METRICS=[
    {name:'STOW_BIN_COLLISION',elBase:'atlas-binc',label:'Bin Collision'},
    {name:'SHIP_FAILED_MOVES',elBase:'atlas-shipfm',label:'Ship Failed Moves'}
];
// Seconds from shift SOS (full period start) to now, for the relativeTime window. Falls back to
// 2.5h (9000s) if the shift start can't be resolved or is in the future.
function atlasRelativeSeconds(config){
    try{
        // Count from P1 SOS (the actual shift start, e.g. 18:15), NOT the board's "full" window
        // which opens 30 min earlier (17:45) for other metrics. The ATLAS dashboard measures from
        // SOS, so anchoring here makes the board's DPMO window match the dashboard's.
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const p1=sched.p1;
        const now=new Date();
        const sos=new Date(now);
        sos.setHours(p1.sh,p1.sm,0,0);
        // Nights: if it's morning (before noon), the shift started yesterday evening.
        if(config.shiftType==='Nights'&&now.getHours()<12){sos.setDate(sos.getDate()-1);}
        // If SOS is somehow still in the future (e.g. pre-shift), fall back below.
        const secs=Math.floor((now.getTime()-sos.getTime())/1000);
        if(secs>0&&secs<26*3600)return secs;   // sane bound: 0..26h
    }catch(e){}
    return 9000; // 2.5h default
}
async function fetchIcqaAtlas(config){
    const cfg=config||loadConfig();
    const site=cfg.site;
    const relativeTime=atlasRelativeSeconds(cfg);
    const body=JSON.stringify({
        operationName:'getMetrics',
        variables:{region:'NA',relativeTime,warehouse:site,warehouseType:'Supplemental'},
        extensions:{persistedQuery:{version:1,sha256Hash:ATLAS_GETMETRICS_HASH}}
    });
    return new Promise((resolve)=>{
        if(typeof GM_xmlhttpRequest!=='function'){console.warn('[SB-ATLAS] GM_xmlhttpRequest unavailable');resolve(false);return;}
        GM_xmlhttpRequest({
            method:'POST',
            url:ATLAS_GQL_URL,
            headers:{'Content-Type':'application/json','Accept':'*/*'},
            data:body,
            onload:function(resp){
                try{
                    const data=JSON.parse(resp.responseText);
                    // PersistedQueryNotFound surfaces as an errors[] entry — flag it clearly.
                    if(data.errors&&data.errors.length){
                        console.warn('[SB-ATLAS] GraphQL errors:',JSON.stringify(data.errors).slice(0,300));
                    }
                    const metrics=data?.data?.warehouseMetrics?.metrics;
                    if(!Array.isArray(metrics)){console.warn('[SB-ATLAS] no metrics array in response');renderAtlasMetrics(null);resolve(false);return;}
                    const byName={};metrics.forEach(m=>{if(m&&m.name)byName[m.name]=m;});
                    dbg('[SB-ATLAS] binC='+(byName.STOW_BIN_COLLISION?byName.STOW_BIN_COLLISION.value+'/'+byName.STOW_BIN_COLLISION.threshold:'n/a')+' shipFM='+(byName.SHIP_FAILED_MOVES?byName.SHIP_FAILED_MOVES.value+'/'+byName.SHIP_FAILED_MOVES.threshold:'n/a')+' relSec='+relativeTime);
                    renderAtlasMetrics(byName);
                    resolve(true);
                }catch(e){
                    // Non-JSON = almost certainly a Midway login redirect (session expired).
                    console.warn('[SB-ATLAS] parse error (session expired? visit atlas.qubit.amazon.dev to auth):',e.message);
                    renderAtlasMetrics(null);
                    resolve(false);
                }
            },
            onerror:function(e){console.warn('[SB-ATLAS] fetch error:',e&&e.error);renderAtlasMetrics(null);resolve(false);},
            ontimeout:function(){console.warn('[SB-ATLAS] timeout');renderAtlasMetrics(null);resolve(false);}
        });
    });
}
// Paint the ATLAS metric rows. DPMO: LOWER is better, so green when value <= threshold, red over,
// amber within 10% under. byName=null clears to em-dashes (fetch failed).
const ATLAS_CACHE_KEY='syncboard_atlas_dpmo';
function renderAtlasMetrics(byName){
    // ATLAS Midway sessions expire often, blanking the DPMO rows to "\u2014" several times a day.
    // To avoid forcing a re-auth every time: on a successful fetch cache the values + timestamp;
    // on a failed fetch fall back to the cached values and mark them stale (instead of blanking).
    let stale=false, stamp=0;
    if(byName){
        try{
            const slim={};ATLAS_METRICS.forEach(def=>{const m=byName[def.name];if(m)slim[def.name]={value:m.value,threshold:m.threshold};});
            localStorage.setItem(ATLAS_CACHE_KEY,JSON.stringify({byName:slim,ts:Date.now()}));
        }catch(e){}
    }else{
        try{const c=JSON.parse(localStorage.getItem(ATLAS_CACHE_KEY)||'null');if(c&&c.byName){byName=c.byName;stale=true;stamp=c.ts||0;}}catch(e){}
    }
    ATLAS_METRICS.forEach(def=>{
        const valEl=document.getElementById(def.elBase+'-value');
        const tgtEl=document.getElementById(def.elBase+'-threshold');
        const m=byName?byName[def.name]:null;
        if(!m){if(valEl){valEl.textContent='\u2014';valEl.style.color='';}if(tgtEl)tgtEl.textContent='\u2014';return;}
        const v=Number(m.value)||0;
        const t=(m.threshold==null)?null:Number(m.threshold);
        if(valEl){
            valEl.textContent=v.toLocaleString();
            // Color the value by threshold: green under / amber within 10% / red over (DPMO lower is better).
            if(t!=null&&t>0)valEl.style.color=v<=t?'#2e7d32':(v<=t*1.1?'#e65100':'#c62828');
            else valEl.style.color='';
            valEl.style.opacity=stale?'0.55':'';   // dim stale values so it's clear they're cached
        }
        if(tgtEl)tgtEl.textContent=(t!=null)?t.toLocaleString():'\u2014';
    });
    // Note states: live fetch OK -> hidden; stale cache shown -> "as of HH:MM, refresh ATLAS";
    // no data at all (fail + no cache) -> original "session expired, open ATLAS".
    const note=document.getElementById('atlas-session-note');
    if(note){
        if(!byName){
            note.style.display='';
            note.innerHTML='\u26A0\uFE0F ATLAS DPMO session expired \u2014 <a href="https://atlas.qubit.amazon.dev/defect-dashboard" target="_blank" style="color:#1565c0;text-decoration:underline;font-weight:700;">open ATLAS</a> to sign in, then click Get Data.';
        }else if(stale){
            note.style.display='';
            const hhmm=stamp?new Date(stamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'earlier';
            note.innerHTML='\u2139\uFE0F ATLAS DPMO showing cached values from '+hhmm+' \u2014 <a href="https://atlas.qubit.amazon.dev/defect-dashboard" target="_blank" style="color:#1565c0;text-decoration:underline;font-weight:700;">open ATLAS</a> to refresh.';
        }else{
            note.style.display='none';
        }
    }
    // ATLAS defect values/thresholds just rendered - refresh the SYNC Actions banner so an
    // over-threshold defect (Bin Collision / Ship Failed Moves) shows up as an action to classify.
    if(typeof updateActionRequired==='function')updateActionRequired();
}

// === ICQA: OpenSearch raw Bin Collision COUNT (separate from the ATLAS DPMO) ===
// The ATLAS OpenSearch dashboard (moc.prod.atlas-opensearch.qubit.amazon.dev) exposes the raw
// event COUNT (not DPMO) via its Kibana/OpenSearch internal search endpoint. Auth is a cookie
// (security_authentication), so GM_xmlhttpRequest can replay it. The endpoint REQUIRES the
// osd-xsrf + osd-version headers (Kibana CSRF guard) or it 400s. We read rawResponse.hits.total.
// The query body is templated with warehouse_id:<site> and a timestamp range = shift SOS->now (UTC).
const OS_SEARCH_URL='https://moc.prod.atlas-opensearch.qubit.amazon.dev/_dashboards/internal/search/opensearch';
const OS_XSRF_HEADERS={'Content-Type':'application/json','osd-xsrf':'osd-fetch','osd-version':'2.13.0','Accept':'*/*'};
// Build the shift SOS -> now window as UTC ISO strings, anchored at P1 SOS (matching the ATLAS DPMO).
function osShiftRangeISO(config){
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const p1=sched.p1;
    const now=new Date();
    const sos=new Date(now);
    sos.setHours(p1.sh,p1.sm,0,0);
    if(config.shiftType==='Nights'&&now.getHours()<12){sos.setDate(sos.getDate()-1);}
    if(sos.getTime()>now.getTime())sos.setDate(sos.getDate()-1); // safety: never future
    return{gte:sos.toISOString(),lte:now.toISOString()};
}
// The raw event COUNTS we pull from OpenSearch. Same endpoint/body shape for each; only the
// `type` filter (and the aggs field, which we don't read) differ. count = rawResponse.hits.total.
const OS_COUNTS=[
    {type:'STOW_BIN_COLLISIONS',aggField:'container.keyword',elId:'atlas-binc-count',label:'bin collision'},
    {type:'SHIP_FAILED_MOVES',aggField:'failure_reason.keyword',elId:'atlas-shipfm-count',label:'ship failed moves'}
];
// Generic OpenSearch count fetch for one metric type over the shift SOS->now window.
function fetchOsCount(def,config){
    const cfg=config||loadConfig();
    const site=cfg.site;
    const {gte,lte}=osShiftRangeISO(cfg);
    // Mirror the dashboard's query body; only warehouse_id, type, timestamp range, and preference vary.
    // NOTE: `preference` is a sibling of `body` under `params` (NOT inside `body`). Nesting it
    // inside body triggers OpenSearch "Unknown key for a VALUE_NUMBER in [preference]" (HTTP 400).
    const body=JSON.stringify({params:{index:'atlas*',
        body:{
            aggs:{"2":{terms:{field:def.aggField,order:{_count:'desc'},size:20}}},
            size:0,stored_fields:['*'],script_fields:{},
            docvalue_fields:[{field:'@timestamp',format:'date_time'},{field:'timestamp',format:'date_time'}],
            _source:{excludes:[]},
            query:{bool:{
                must:[{query_string:{analyze_wildcard:true,query:'warehouse_id:'+site,time_zone:'America/Los_Angeles'}}],
                filter:[
                    {bool:{should:[{match:{type:def.type}}],minimum_should_match:1}},
                    {range:{timestamp:{gte,lte,format:'strict_date_optional_time'}}}
                ],should:[],must_not:[]}}
        },
        preference:Date.now()
    }});
    return new Promise((resolve)=>{
        if(typeof GM_xmlhttpRequest!=='function'){renderOsCount(def.elId,null);resolve(false);return;}
        GM_xmlhttpRequest({
            method:'POST',url:OS_SEARCH_URL,headers:OS_XSRF_HEADERS,data:body,
            onload:function(resp){
                const txt=resp.responseText||'';
                // Expired session redirects to a federate/login HTML page instead of JSON.
                if(/<html|<!doctype|federate|idp\.|authorize|login/i.test(txt.slice(0,500))){
                    console.warn('[SB-OS] '+def.label+' session expired (got login/HTML) \u2014 open the OpenSearch dashboard + sign in, then Get Data.');
                    renderOsCount(def.elId,null);resolve(false);return;
                }
                try{
                    const data=JSON.parse(txt);
                    // hits.total may be a number (as captured) or {value:n}.
                    const total=data?.rawResponse?.hits?.total;
                    const count=(typeof total==='object'&&total)?Number(total.value):Number(total);
                    if(isNaN(count)){console.warn('[SB-OS] '+def.label+' no hits.total. status='+resp.status+' first 200:',txt.slice(0,200));renderOsCount(def.elId,null);resolve(false);return;}
                    dbg('[SB-OS] '+def.label+' count='+count+' window '+gte+'..'+lte);
                    renderOsCount(def.elId,count);
                    resolve(true);
                }catch(e){
                    console.warn('[SB-OS] '+def.label+' parse error (session expired?):',e.message,'first 200:',txt.slice(0,200));
                    renderOsCount(def.elId,null);resolve(false);
                }
            },
            onerror:function(e){console.warn('[SB-OS] '+def.label+' fetch error (osd-xsrf/CORS?):',e&&e.error);renderOsCount(def.elId,null);resolve(false);},
            ontimeout:function(){console.warn('[SB-OS] '+def.label+' timeout');renderOsCount(def.elId,null);resolve(false);}
        });
    });
}
// Fetch every OpenSearch count (bin collision, ship failed moves, ...). Show the "open OpenSearch"
// note only if EVERY count failed (i.e. the session isn't established — the new-user case).
function fetchOsCounts(config){
    Promise.all(OS_COUNTS.map(def=>fetchOsCount(def,config))).then(results=>{
        const anyOk=results.some(r=>r===true);
        const note=document.getElementById('os-session-note');
        if(note)note.style.display=anyOk?'none':'';
    });
}
function renderOsCount(elId,count){
    const el=document.getElementById(elId);
    if(el)el.textContent=(count==null||isNaN(count))?'\u2014':Number(count).toLocaleString();
}

// === ICQA: GCA's (Coaching to Deliver, target 0) ===
// Calls Guided Coaching's SearchCoachingInstances API directly in the background
// (captured via browser devtools network tab). This runs cross-origin via
// GM_xmlhttpRequest, which sends the browser's existing guided-coaching.corp.amazon.com
// session cookies automatically — no need to have that tab open, same idea as the
// Fast Start fetch elsewhere in this file.
const ICQA_GCA_REASONS=['MANUAL_QUALITY_COACHING_FOR_STOW','MANUAL_PRODUCTIVITY_COACHING_FOR_STOW','TOO_MANY_STOW_MULTIPLE_EVENT_DEFECTS','TOO_MANY_STOW_MULTIPLE_EVENT_NOT_SCANNED_DEFECTS','TOO_MANY_STOW_MULTIPLE_EVENT_WRONG_BIN_DEFECTS','TOO_MANY_NIKE_QUANTITY_STOW_MULTIPLE_EVENT_DEFECTS','TOO_MANY_NIKE_QUANTITY_STOW_OVERAGE_DEFECTS','TOO_MANY_NIKE_QUANTITY_STOW_LOW_UNITS_PER_TRANSACTION_DEFECTS','STOW_QUBIT_RISK_SCORE_TOO_HIGH','TOO_MANY_STOW_MACHINE_GUN_RISK_SIGNATURES','TOO_MANY_STOW_OUT_OF_SEQUENCE_RISK_SIGNATURES','TOO_MANY_STOW_PC99_RISK_SIGNATURES','TOO_MANY_STOW_SWITCH_RISK_SIGNATURES','TOO_MANY_STOW_SHORTAGE_RISK_SIGNATURES','TOO_MANY_STOW_OVERAGE_RISK_SIGNATURES','TOO_MANY_STOW_DAMAGE_RISK_SIGNATURES','TOO_MANY_STOW_BIN_COLLISION_RISK_SIGNATURES','TOO_MANY_STOW_AMNESTY_DIRTY_BIN_RISK_SIGNATURES','TOO_MANY_STOW_SHORTAGE_DEFECTS','TOO_MANY_STOW_OVERAGE_DEFECTS','TOO_MANY_NO_STOW_TURNAWAY_INDICATORS','TOO_MANY_STOW_AMNESTY_LAST_TOUCH_ERROR_INDICATORS','TOO_MANY_SCAN_WHILE_STOW_DEFECTS','TOO_MANY_STOW_HOLDING_MULTIPLE_ITEMS_DEFECTS','TOO_MANY_STOW_BLOCKING_CAMERA_DEFECTS','TOO_MANY_SWEEP_AFTER_STOW_DEFECTS','TOO_MANY_POD_FRICTION_NON_COMPLIANT_STOW_OVERRIDES','TOO_MANY_STOW_FIDO_TRIPS_ERROR_INDICATORS','TOO_MANY_STOW_FIDO_PROMPTS_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_PICK','MANUAL_PRODUCTIVITY_COACHING_FOR_PICK','TOO_MANY_PICK_ERROR_INDICATORS','TOO_MANY_PICK_OVERAGE_ERROR_INDICATORS','TOO_MANY_PICK_SHORTAGE_ERROR_INDICATORS','TOO_MANY_PICK_DAMAGE_ERROR_INDICATORS','TOO_HIGH_PICK_DPMO','PICK_QUBIT_RISK_SCORE_TOO_HIGH','TOO_MANY_PICK_SHORTAGE_RISK_SIGNATURES','TOO_MANY_PICK_DAMAGE_RISK_SIGNATURES','TOO_MANY_PICK_SCANNED_WRONG_ASIN_RISK_SIGNATURES','TOO_MANY_PICK_REJECT_RISK_SIGNATURES','TOO_MANY_PICK_UNSCANNABLE_RISK_SIGNATURES','TOO_MANY_PICK_WRONG_ADJUSTMENT_DEFECTS','TOO_MANY_PICK_OVERFILLED_TOTE_ERROR_INDICATORS','TOO_MANY_PICK_AMNESTY_DIRTY_BIN_RISK_SIGNATURES','TOO_MANY_PICK_AMNESTY_LAST_TOUCH_ERROR_INDICATORS','TOO_MANY_PICK_FIDO_TRIPS_ERROR_INDICATORS','TOO_MANY_PICK_FIDO_PROMPTS_ERROR_INDICATORS','TOO_MANY_PICK_FALSE_DAMAGE_ERROR_INDICATORS','TOO_MANY_PICK_HIGH_REACH_WITHOUT_STEP_LADDER_DEFECTS','MANUAL_QUALITY_COACHING_FOR_INDUCT','MANUAL_PRODUCTIVITY_COACHING_FOR_INDUCT','TOO_MANY_INDUCT_ERROR_INDICATORS','TOO_MANY_INDUCT_SHORTAGE_ERROR_INDICATORS','TOO_MANY_INDUCT_DAMAGE_ERROR_INDICATORS','TOO_MANY_INDUCT_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_REBIN','MANUAL_PRODUCTIVITY_COACHING_FOR_REBIN','TOO_MANY_AFE_REBIN_ERROR_INDICATORS','TOO_MANY_AFE_REBIN_SHORTAGE_ERROR_INDICATORS','TOO_MANY_AFE_REBIN_DAMAGE_ERROR_INDICATORS','TOO_HIGH_AFE_REBIN_DPMO','TOO_MANY_AFE_REBIN_FALSE_DAMAGE_ERROR_INDICATORS','TOO_MANY_BATCHY_REBIN_ERROR_INDICATORS','TOO_MANY_BATCHY_REBIN_SHORTAGE_ERROR_INDICATORS','TOO_MANY_BATCHY_REBIN_DAMAGE_ERROR_INDICATORS','TOO_HIGH_BATCHY_REBIN_DPMO','MANUAL_QUALITY_COACHING_FOR_RECEIVE','MANUAL_PRODUCTIVITY_COACHING_FOR_RECEIVE','TOO_MANY_RECEIVE_OVERAGE_ERROR_INDICATORS','TOO_MANY_RECEIVE_SHORTAGE_ERROR_INDICATORS','TOO_MANY_RECEIVE_ERROR_INDICATORS','TOO_MANY_RECEIVE_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_ICQA','MANUAL_PRODUCTIVITY_COACHING_FOR_ICQA','TOO_MANY_ICQA_AMNESTY_DIRTY_BIN_RISK_SIGNATURES','TOO_MANY_ICQA_AMNESTY_LAST_TOUCH_ERROR_INDICATORS','TOO_MANY_ICQA_FIDO_TRIPS_ERROR_INDICATORS','TOO_MANY_ICQA_FIDO_PROMPTS_ERROR_INDICATORS','TOO_MANY_ICQA_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_PACK','MANUAL_PRODUCTIVITY_COACHING_FOR_PACK','TOO_MANY_PACK_WRONG_CONTAINER_USED_DEFECTS','TOO_MANY_PACK_WEIGHT_OUT_OF_TOLERANCE_ERROR_INDICATORS','TOO_MANY_PACK_WRONG_CONTAINER_USED_ERROR_INDICATORS','TOO_MANY_PACK_DAMAGE_RISK_SIGNATURES','TOO_MANY_PACK_SHORTAGE_RISK_SIGNATURES','TOO_MANY_PACK_UNSCANNABLE_RISK_SIGNATURES','TOO_MANY_PACK_SERIAL_UNSCANNABLE_RISK_SIGNATURES','TOO_MANY_PACK_NO_SCANNABLE_ID_RISK_SIGNATURES','TOO_MANY_PACK_DUPLICATE_SERIAL_SCAN_RISK_SIGNATURES','TOO_MANY_PACK_NO_PACKING_SLIP_RISK_SIGNATURES','TOO_MANY_PACK_BROKEN_SET_DEFECTS','TOO_MANY_PACK_MASTER_PACK_DEFECTS','TOO_MANY_PACK_DAMAGE_DEFECTS','TOO_MANY_PACK_SHORTAGE_DEFECTS','TOO_MANY_PACK_OVERAGE_DEFECTS','TOO_MANY_PACK_MISSING_DUNNAGE_DEFECTS','TOO_MANY_PACK_INSUFFICIENT_DUNNAGE_DEFECTS','TOO_MANY_PACK_CONCESSION_APPLIED_ERROR_INDICATORS','TOO_MANY_PACK_CONCESSION_DEFECTS','TOO_MANY_PACK_OPEN_BOX_DEFECTS','TOO_MANY_PACK_LABEL_APPLICATION_DEFECTS','TOO_MANY_PACK_LABEL_PRINTING_DEFECTS','TOO_MANY_PACK_WRONG_BOX_MCF_DEFECTS','TOO_MANY_PACK_WRONG_BOX_DEFECTS','TOO_MANY_PACK_PACKAGE_PROTECTION_LEVEL_DEFECTS','TOO_MANY_PACK_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_REVERSE_LOGISTICS','MANUAL_PRODUCTIVITY_COACHING_FOR_CUSTOMER_RETURNS','TOO_MANY_CUSTOMER_RETURNS_ITEM_MATCH_RISK_SIGNATURES','TOO_MANY_CUSTOMER_RETURNS_ITEM_DAMAGE_REMOVED_RISK_SIGNATURES','MANUAL_QUALITY_COACHING_FOR_SPACE_MANAGEMENT','MANUAL_QUALITY_COACHING_FOR_OUTBOUND_PROBLEM_SOLVE','TOO_MANY_POPS_MARKED_MISSING_ITEMS_FROM_CONTAINER_RISK_SIGNATURES','TOO_MANY_POPS_MARKED_MISSING_ITEMS_FROM_SPOOS_ERROR_INDICATORS','TOO_MANY_POPS_MARKED_MISSING_TOTE_BEFORE_PACK_ERROR_INDICATORS','TOO_MANY_POPS_MARKED_MISSING_TOTE_ERROR_INDICATORS','TOO_MANY_POPS_MARKED_MISSING_SHIPMENT_C15_DEFECTS','TOO_MANY_POPS_MARKED_MISSING_SHIPMENT_C704_DEFECTS','TOO_MANY_POPS_MARKED_MISSING_SHIPMENTS_ERROR_INDICATORS','TOO_MANY_POPS_REPROCESSED_SHIPMENTS_RISK_SIGNATURES','TOO_MANY_SLAM_OPERATOR_CONCESSION_ERROR_INDICATORS','TOO_MANY_OUTBOUND_PROBLEM_SOLVE_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_INBOUND_PROBLEM_SOLVE','TOO_MANY_INBOUND_PROBLEM_SOLVE_EXCESSIVE_DELETES_DAMAGES','TOO_MANY_INBOUND_PROBLEM_SOLVE_FALSE_DAMAGE_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_DECANT','MANUAL_PRODUCTIVITY_COACHING_FOR_DECANT','TOO_MANY_DECANT_ERROR_INDICATORS','MANUAL_QUALITY_COACHING_FOR_SHIP','MANUAL_PRODUCTIVITY_COACHING_FOR_SHIP','TOO_MANY_PACKAGE_MISSORTS','TOO_MANY_CONTAINER_MISSORTS','TOO_LOW_AMNESTY_FIND_RATE_RISK_SIGNATURES'];
// --- GCA popup/diagnostic fix verification note ---
// Changes (all inside fetchIcqaGCA onload + promptGcaLogin text):
//  (1) Added console.warn('[SB-GCA] unexpected response ...') logging status + first 300 chars of
//      the body, placed BEFORE the re-auth branch and only reached when the success guard did not
//      return (never logs on success).
//  (2) Failure branch BEFORE/AFTER:
//        BEFORE: const looksLikeLogin=status===401||status===403||status===0&&/.../i.test(resp.responseText||'');
//                if(looksLikeLogin){promptGcaLogin(config);}
//                else setEl('icqa-gca-updated','GCA unavailable (retrying)');
//        AFTER:  bodyTxt=String(resp.responseText||''); looksLikeLogin (same meaning, parens added);
//                looksTransient=status>=500 -> silent retry status 'GCA unavailable (server N, retrying)';
//                every other non-login/non-5xx response -> promptGcaLogin(config) (clickable link restored).
//  (3) promptGcaLogin innerHTML BEFORE/AFTER:
//        BEFORE: '\u26A0\uFE0F <a id="gca-login-link" ...>Log in to Guided Coaching</a>'
//        AFTER:  '\u26A0\uFE0F GCA stuck \u2014 <a id="gca-login-link" ...>Log in to Guided Coaching</a>'
//  Listener wiring, dataset.gcaPrompt guard, request body, interval, onerror, ontimeout, and
//  openGcaLoginPopup are UNCHANGED. Brace/paren/backtick balance verified by reading: balanced
//  (no backticks in region; if/else-if/else and GM_xmlhttpRequest/try-catch all close cleanly).
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
                // A real auth failure looks like an HTML login redirect or a 401/403 — the body
                // won't parse as JSON. Only THAT should prompt re-auth. A 200 with valid JSON is a
                // success; anything else transient (5xx, odd body) is a soft failure, NOT auth.
                const status=resp.status||0;
                let data=null;
                try{data=JSON.parse(resp.responseText);}catch(e){data=null;}
                if(data&&(data.coachingInstances!==undefined||data.additionalCoachingInstances!==undefined)){
                    const count=(data.coachingInstances?.length||0)+(data.additionalCoachingInstances||0);
                    // Count up only when the value actually changes (this fetch runs every 30s;
                    // re-animating an unchanged number would be distracting).
                    const gcaEl=document.getElementById('icqa-gca-value');
                    const prevGca=gcaEl?(parseInt((gcaEl.textContent||'').replace(/[^0-9]/g,''))):NaN;
                    if(count>0&&count!==prevGca)countUpEl('icqa-gca-value',count,'',0);
                    else setEl('icqa-gca-value',String(count));
                    const banner=document.getElementById('icqa-gca-banner');
                    if(banner)banner.style.background=count>0?'#c62828':'#2e7d32';
                    setEl('icqa-gca-updated','\u2713 Updated '+new Date().toLocaleTimeString());
                    return;
                }
                // Success guard did NOT return. Log the raw response so a contract/shape change is
                // visible without opening DevTools (console.warn, not dbg, so it shows always).
                console.warn('[SB-GCA] unexpected response \u2014 status='+status+' bodyStart='+String(resp.responseText||'').slice(0,300));
                // Didn't get valid JSON. If it's an auth status (401/403) or a login-page redirect,
                // the session is expired -> show a clickable prompt (does NOT auto-open a popup).
                const bodyTxt=String(resp.responseText||'');
                const looksLikeLogin=status===401||status===403||(status===0&&/<html|sign in|midway|login/i.test(bodyTxt));
                const looksTransient=status>=500; // 5xx: real server error, just retry silently
                if(looksLikeLogin){
                    promptGcaLogin(config);
                } else if(looksTransient){
                    setEl('icqa-gca-updated','\u26A0\uFE0F GCA unavailable (server '+status+', retrying)');
                } else {
                    // 2xx/4xx that parsed but lacked the expected fields, OR an unparseable non-login body:
                    // most likely the session/response needs a re-auth round-trip. Offer the clickable
                    // login prompt (user-gesture gated) so the user can re-badge, which is how it worked
                    // before. Still show a short status so it's not a silent dead end.
                    promptGcaLogin(config);
                }
            },
            onerror:function(){
                // Network error (not necessarily auth). Show a soft status; do NOT open a popup.
                setEl('icqa-gca-updated','\u26A0\uFE0F GCA fetch failed (retrying)');
            },
            ontimeout:function(){
                // Timeout is transient, not an auth failure. Soft status; do NOT open a popup.
                setEl('icqa-gca-updated','\u26A0\uFE0F GCA timed out (retrying)');
            }
        });
    }catch(e){console.warn('[SB] ICQA GCA fetch error:',e.message);}
}
// Session expired: show a CLICKABLE prompt in the GCA banner instead of auto-opening a
// popup. The popup only opens when the user clicks it (a real user gesture), so it no longer
// pops on its own from the 30s interval or a transient blip. Idempotent — safe to call repeatedly.
function promptGcaLogin(config){
    setEl('icqa-gca-value','\u2014');
    const banner=document.getElementById('icqa-gca-banner');
    if(banner)banner.style.background='#757575';
    const upd=document.getElementById('icqa-gca-updated');
    if(upd){
        // Only (re)wire the prompt once; don't stack listeners on repeated calls.
        if(upd.dataset.gcaPrompt!=='1'){
            upd.dataset.gcaPrompt='1';
            upd.innerHTML='\u26A0\uFE0F GCA stuck \u2014 <a href="#" id="gca-login-link" style="color:#90caf9;text-decoration:underline;cursor:pointer;">Log in to Guided Coaching</a>';
            const link=document.getElementById('gca-login-link');
            if(link)link.addEventListener('click',(e)=>{e.preventDefault();openGcaLoginPopup(config);});
        }
    }
}
// Actually open the SSO login popup. Called ONLY from the user's click on the prompt above
// (Guided Coaching's login page sends X-Frame-Options: deny, so a hidden iframe won't work).
// Guarded so a second click while one is open doesn't spawn another window.
let gcaPopupOpen=false;
function openGcaLoginPopup(config){
    if(gcaPopupOpen)return;
    dbg('[SB-GCA] User requested login, opening Guided Coaching popup...');
    try{
        const popup=window.open('https://guided-coaching.corp.amazon.com/','gca_auth','width=500,height=400,left=200,top=200');
        if(popup){
            gcaPopupOpen=true;
            setEl('icqa-gca-updated','\u26A0\uFE0F Badge in to the Guided Coaching popup...');
            const finish=()=>{gcaPopupOpen=false;const upd=document.getElementById('icqa-gca-updated');if(upd)upd.dataset.gcaPrompt='';fetchIcqaGCA(config,true);};
            // Poll until the popup closes (user badges in and closes, or auto-close after timeout)
            const poll=setInterval(()=>{
                try{
                    if(popup.closed){clearInterval(poll);dbg('[SB-GCA] Popup closed, retrying GCA fetch...');finish();}
                }catch(e){}
            },1000);
            // Safety timeout: stop polling after 60s and close popup
            setTimeout(()=>{clearInterval(poll);try{if(!popup.closed)popup.close();}catch(e){}if(gcaPopupOpen)finish();},60000);
        }else{
            setEl('icqa-gca-updated','\u26A0\uFE0F Popup blocked \u2014 allow popups for FCLM');
        }
    }catch(e){
        gcaPopupOpen=false;
        console.warn('[SB-GCA] Could not open popup:',e.message);
        setEl('icqa-gca-updated','\u26A0\uFE0F Log in to Guided Coaching manually');
    }
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
            onload:function(resp){try{
                // An expired/unestablished benchmarking session returns an HTML login page (not JSON)
                // or JSON with authorized=false. Distinguish those so the UI can show a clear note
                // instead of a silent "—". _authorized/_hasData flags drive the fast-start-note.
                const ct=(resp.responseText||'').trim();
                if(ct.startsWith('<')){console.warn('[SB-FastStart] get_fast_start_moves returned HTML (session not established)');resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0,_authorized:false,_hasData:false});return;}
                const data=JSON.parse(resp.responseText);
                if(!data.authorized){console.warn('[SB-FastStart] not authorized \u2014 benchmarking session needed');resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0,_authorized:false,_hasData:false});return;}
                if(!data.moves_data||data.moves_data.length===0){dbg('[SB-FastStart] authorized but no moves_data for '+dateStr);resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0,_authorized:true,_hasData:false});return;}
                let ibSOS=0,ibEOL=0,obSOS=0,obEOL=0;data.moves_data.forEach(proc=>{const isIB=proc.mainProcess==='Inbound';const isOB=proc.mainProcess==='Outbound';if(!proc.segments)return;proc.segments.forEach(seg=>{if(!seg.moves||seg.moves.length===0)return;const durations=seg.moves.map(m=>m.duration||0);const avg=durations.reduce((a,b)=>a+b,0)/durations.length/60000;if(seg.displayName==='Start of Shift'){if(isIB)ibSOS=avg;if(isOB)obSOS=avg;}else if(seg.displayName==='Break 1'){if(isIB)ibEOL=avg;if(isOB)obEOL=avg;}});});
                dbg('[SB-FastStart] parsed ibSOS='+ibSOS.toFixed(1)+' ibEOL='+ibEOL.toFixed(1)+' obSOS='+obSOS.toFixed(1)+' obEOL='+obEOL.toFixed(1));
                resolve({ibSOS,ibEOL,obSOS,obEOL,_authorized:true,_hasData:(ibSOS>0||ibEOL>0||obSOS>0||obEOL>0)});
            }catch(e){console.warn('[SB-FastStart] parse error:',e.message);resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0,_authorized:false,_hasData:false});}},
            onerror:function(){console.warn('[SB-FastStart] fetch error');resolve({ibSOS:0,ibEOL:0,obSOS:0,obEOL:0,_authorized:false,_hasData:false});}
        });
    });
}

// === 24-HOUR DATA FETCH (00:00 - 23:59 today) for BB Goal Tracker ===
async function fetch24hrData(site){
    try{
        const today=new Date();
        const startDate=new Date(today);startDate.setHours(0,0,0,0);
        const endDate=new Date(today);
        // Stow (Case Transfer In), Pallet Stow, and the two split TO reports (TO Fluid Load +
        // Transfer Out Dock) function rollups for the full day.
        const stowUrl=buildFnUrl(site,PROCESS_IDS.stow,startDate,0,0,endDate,23,59);
        const palletStowUrl=buildFnUrl(site,PROCESS_IDS.palletStow,startDate,0,0,endDate,23,59);
        const toFluidUrl=buildFnUrl(site,PROCESS_IDS.toFluidLoad,startDate,0,0,endDate,23,59);
        const toDockUrl=buildFnUrl(site,PROCESS_IDS.toDock,startDate,0,0,endDate,23,59);
        const [stowHtml,palletStowHtml,toFluidHtml,toDockHtml]=await Promise.all([fetchHTML(stowUrl),fetchHTML(palletStowUrl),fetchHTML(toFluidUrl),fetchHTML(toDockUrl)]);
        const stow=parseFnRollup(stowHtml);
        const pStow=parseFnRollup(palletStowHtml);
        const toFluid=parseToFluidLoad(toFluidHtml);
        const toDock=parseToDock(toDockHtml);
        const palletCases=pStow.palletCases||0;
        const ibVol24=(stow.totalUnits||0)+palletCases;
        const ibDensity24=(stow.caseUnits||0)>0?(stow.eachUnits||0)/(stow.caseUnits||1):0;
        const obDensity24=(toFluid.caseUnits||0)>0?(toFluid.eachUnits||0)/(toFluid.caseUnits||1):0;
        // OB loaded volume (cases) = TO Fluid Load jobs + Transfer Out Dock pallet cases.
        const obVol24=(toFluid.jobs||0)+(toDock.caseUnits||0);
        return{ibVol24,obVol24,ibDensity24,obDensity24};
    }catch(e){console.warn('[SB] 24hr data fetch error:',e.message);return{ibVol24:0,obVol24:0,ibDensity24:0,obDensity24:0};}
}

// === PRIOR-DAY 24hr REPORTING (yesterday 00:00-23:59) ===
// Fetches the full prior calendar day so the Shift Plan Targets panel's "Prior Day" view can
// show Plan (LP, already cached) vs Actual (produced yesterday) vs Variance. Actuals:
//   IB/DA volume + density -> same sources as fetch24hrData (stow, palletStow, TO fluid+dock)
//   IB/DA/Throughput CPLH  -> computed EXACTLY like the shift: volume / PPR hours, but over the
//                             00:00-23:59 window (PPR ibActualHrs / daTransferHrs / throughputHrs).
// dayOffset: 0 = today (00:00 -> now), 1 = yesterday (00:00 -> 23:59). Used by both the
// Current Day and Prior Day views of the Shift Plan Targets panel.
async function fetchDayData(site,dayOffset){
    try{
        const off=dayOffset||0;
        const d=new Date();d.setDate(d.getDate()-off);
        const start=new Date(d);start.setHours(0,0,0,0);
        const end=new Date(d);
        // For today, end = now (partial day so far); for a past day, end = 23:59.
        const eh=off===0?end.getHours():23, em=off===0?end.getMinutes():59;
        const stowUrl=buildFnUrl(site,PROCESS_IDS.stow,start,0,0,end,eh,em);
        const palletStowUrl=buildFnUrl(site,PROCESS_IDS.palletStow,start,0,0,end,eh,em);
        const toFluidUrl=buildFnUrl(site,PROCESS_IDS.toFluidLoad,start,0,0,end,eh,em);
        const toDockUrl=buildFnUrl(site,PROCESS_IDS.toDock,start,0,0,end,eh,em);
        // PPR over the window for the hours (IB actual, DA transfer, throughput).
        const pprUrl=buildPPRUrl(site,start,0,0,end,eh,em);
        const [stowHtml,palletStowHtml,toFluidHtml,toDockHtml,pprHtml]=await Promise.all([
            fetchHTML(stowUrl),fetchHTML(palletStowUrl),fetchHTML(toFluidUrl),fetchHTML(toDockUrl),fetchHTML(pprUrl)
        ]);
        const stow=parseFnRollup(stowHtml);
        const pStow=parseFnRollup(palletStowHtml);
        const toFluid=parseToFluidLoad(toFluidHtml);
        const toDock=parseToDock(toDockHtml);
        const ppr=parsePPR(pprHtml);
        const palletCases=pStow.palletCases||0;
        const ibVol=(stow.totalUnits||0)+palletCases;
        const obVol=(toFluid.jobs||0)+(toDock.caseUnits||0);
        const ibDensity=(stow.caseUnits||0)>0?(stow.eachUnits||0)/(stow.caseUnits||1):0;
        const obDensity=(toFluid.caseUnits||0)>0?(toFluid.eachUnits||0)/(toFluid.caseUnits||1):0;
        // CPLH — same formulas as the shift (renderIB/renderOB/Site CPLH), over this window.
        const ibHrs=ppr.ibActualHrs||0;
        const daHrs=ppr.daTransferHrs||0;
        const tHrs=ppr.throughputHrs||0;
        const ibCplh=ibHrs>0?ibVol/ibHrs:0;
        const obCplh=daHrs>0?obVol/daHrs:0;
        const siteVol=obVol+(stow.totalUnits||0)+palletCases;
        const siteCplh=tHrs>0?siteVol/tHrs:0;
        dbg('[SB-Day'+off+'] '+fmtDate(start)+' ibVol='+ibVol+' obVol='+obVol+' ibCplh='+ibCplh.toFixed(2)+' obCplh='+obCplh.toFixed(2)+' siteCplh='+siteCplh.toFixed(2)+' (ibHrs='+ibHrs+' daHrs='+daHrs+' tHrs='+tHrs+')');
        return{dateStr:fmtDate(start),ibVol,obVol,ibDensity,obDensity,ibCplh,obCplh,siteCplh,ibHrs,daHrs,tHrs};
    }catch(e){console.warn('[SB-Day] fetch error:',e.message);return null;}
}

// === LABOR PLANNING (LP) CPLH — Manual Input + Auto-fetch attempt ===
function loadLPValues(){
    try{const s=localStorage.getItem('syncboard_lp');return s?JSON.parse(s):{};}catch(e){return{};}
}
// Fill the Shift Plan Targets panel's read-only LP rows from cached LP values. Called on init
// (so they show before a fetch) and again by renderLPPercents after each fetch. Safe if the
// spans or values are missing (shows an em-dash).
function seedShiftPlanLPRows(){
    const lp=loadLPValues()||{};
    const put=(id,v)=>{const el=document.getElementById(id);if(el){const n=parseFloat(v)||0;el.textContent=n>0?n.toFixed(2):'\u2014';}};
    put('spt-ib-lp-cplh',lp.ibCplh);
    put('spt-ob-lp-cplh',lp.obCplh);
    put('spt-ib-lp-density',lp.ibDensityLP);
    put('spt-ob-lp-density',lp.obDensityLP);
    put('spt-site-lp-cplh',lp.siteCplh);
}
// ---- Shift Plan Targets panel: 3-view toggle (Shift Plan Targets / Current Day / Prior Day) ----
// The two day views share the same Plan/Actual/Variance table shape. dayData[0]=today (00:00->now),
// dayData[1]=yesterday (full day). Fetched on first open of each; invalidated on Get Data.
const dayData=[null,null];       // [todayResult, yesterdayResult]
const dayLoading=[false,false];
// Which view: 'targets' (shift plan), 'current' (day 0), 'prior' (day 1).
function setDayView(which){
    const views={targets:'spt-targets-view',current:'spt-current-view',prior:'spt-prior-view'};
    const btns={targets:'btn-view-targets',current:'btn-view-current',prior:'btn-view-prior'};
    Object.keys(views).forEach(k=>{
        const v=document.getElementById(views[k]);if(v)v.style.display=(k===which)?'':'none';
        const b=document.getElementById(btns[k]);if(b)b.classList.toggle('active',k===which);
    });
    // Dept Backlog only shows for the day views (Current / Prior), not Shift Plan Targets.
    const dept=document.getElementById('spt-dept-backlog');
    if(dept)dept.style.display=(which==='current'||which==='prior')?'':'none';
    if(which==='current')ensureDay(0);
    else if(which==='prior')ensureDay(1);
}
// Fetch a day's data on demand (offset 0=today,1=yesterday), cache it, then render.
function ensureDay(off){
    if(dayData[off]){renderDayView(off,dayData[off]);return;}
    if(dayLoading[off])return;
    dayLoading[off]=true;
    const status=document.getElementById(off===0?'spt-current-status':'spt-prior-status');
    if(status)status.textContent='Fetching\u2026';
    fetchDayData(loadConfig().site,off).then(d=>{
        dayLoading[off]=false;dayData[off]=d;
        if(d){renderDayView(off,d);if(status)status.textContent='\u2713 '+d.dateStr;}
        else if(status)status.textContent='\u26A0 Fetch failed \u2014 try Get Data first';
    });
}
// Render a Plan/Actual/Variance day view. prefix 'cd' (current) or 'pd' (prior). Plan = cached LP
// (single daily plan); Actual = the day's produced data; Variance = (Actual-Plan)/Plan %.
function renderDayView(off,d){
    const lp=loadLPValues()||{};
    const prefix=off===0?'cd':'pd';
    const dateEl=document.getElementById(off===0?'spt-current-date':'spt-prior-date');
    if(dateEl)dateEl.textContent=d.dateStr||(off===0?'Current Day':'Prior Day');
    const fmtNum=(v,dec)=>{const n=Number(v)||0;return n>0?(dec!=null?n.toFixed(dec):Math.round(n).toLocaleString()):'\u2014';};
    const setRow=(base,plan,act,dec)=>{
        const planEl=document.getElementById(prefix+'-'+base+'-plan');
        const actEl=document.getElementById(prefix+'-'+base+'-act');
        const varEl=document.getElementById(prefix+'-'+base+'-var');
        if(planEl)planEl.textContent=fmtNum(plan,dec);
        if(actEl)actEl.textContent=fmtNum(act,dec);
        if(varEl){
            const p=Number(plan)||0,a=Number(act)||0;
            if(p>0){
                const diff=a-p;                       // raw difference (Actual - Plan)
                const pct=(diff/p)*100;               // percent difference
                const diffStr=(diff>=0?'+':'')+(dec!=null?diff.toFixed(dec):Math.round(diff).toLocaleString());
                varEl.textContent=diffStr+' ('+(pct>=0?'+':'')+pct.toFixed(1)+'%)';
                // Higher-is-better: green at/above plan, amber within 10% under, red below.
                varEl.style.color=pct>=0?'#2e7d32':(pct>=-10?'#e65100':'#c62828');
            }else{varEl.textContent='\u2014';varEl.style.color='';}
        }
    };
    // BB Goal Plan: LP BB goals are keyed by DAY-OF-WEEK, so today and yesterday differ. For the
    // prior day, use the separately-fetched yesterday goals if available; else fall back to today's.
    const ibBB=(off===1&&priorBBGoals.ib>0)?priorBBGoals.ib:(parseFloat(lp.ibBBGoal)||0);
    const obBB=(off===1&&priorBBGoals.ob>0)?priorBBGoals.ob:(parseFloat(lp.obBBGoal)||0);
    setRow('ib-bb',ibBB,d.ibVol,null);
    setRow('ib-den',parseFloat(lp.ibDensityLP)||0,d.ibDensity,2);
    setRow('ib-cplh',parseFloat(lp.ibCplh)||0,d.ibCplh,2);
    setRow('da-bb',obBB,d.obVol,null);
    setRow('da-den',parseFloat(lp.obDensityLP)||0,d.obDensity,2);
    setRow('da-cplh',parseFloat(lp.obCplh)||0,d.obCplh,2);
    setRow('tp-cplh',parseFloat(lp.siteCplh)||0,d.siteCplh,2);
    // For the prior day, kick off the yesterday-specific BB goal fetch once (day-of-week keyed).
    if(off===1&&priorBBGoals.ib===0&&priorBBGoals.ob===0&&!priorBBGoals.loading)fetchPriorBBGoals();
}
// LP BB goals for YESTERDAY (day-of-week keyed). CPLH/density LP are weekly (same across the week),
// but BB goals differ per day, so the prior-day view needs yesterday's specific BB goals.
const priorBBGoals={ib:0,ob:0,loading:false};
function fetchPriorBBGoals(){
    const lp=loadLPValues()||{};
    const planId=lp._planId, sundayStr=lp._sundayStr;
    if(!planId||!sundayStr){console.warn('[SB-PriorBB] no cached planId/sundayStr yet \u2014 run Get Data first');return;}
    const days=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const y=new Date();y.setDate(y.getDate()-1);
    const yDay=days[y.getDay()];
    priorBBGoals.loading=true;
    let done=0;const check=()=>{if(done>=2){priorBBGoals.loading=false;dbg('[SB-PriorBB] '+yDay+' ib='+priorBBGoals.ib+' ob='+priorBBGoals.ob);if(dayData[1])renderDayView(1,dayData[1]);}};
    fetchBBGoalFromLP(planId,'IB',sundayStr,(v)=>{priorBBGoals.ib=v||0;done++;check();},yDay);
    fetchBBGoalFromLP(planId,'DA',sundayStr,(v)=>{priorBBGoals.ob=v||0;done++;check();},yDay);
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
        dbg('[SB-LP] Fetching reports:',reportsUrl);
        // Shared re-auth: GalaxyBI returns its SSO/login page as HTTP 200 HTML (not an error)
        // when the session is expired, so BOTH a network error AND a non-JSON 200 must trigger
        // the silent iframe re-auth. Without this, an expired session just resolves null and the
        // "visit GalaxyBI" banner appears with no retry — which is the bug the user hit.
        const reauthAndRetry=(why)=>{
            if(isRetry){console.warn('[SB-LP] Still failing after re-auth ('+why+')');resolve(null);return;}
            dbg('[SB-LP] '+why+' — refreshing GalaxyBI session via hidden iframe, then retrying...');
            const iframe=document.createElement('iframe');
            iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
            iframe.src='https://galaxybi.aka.corp.amazon.com/';
            document.body.appendChild(iframe);
            setTimeout(()=>{
                if(iframe.parentNode)iframe.parentNode.removeChild(iframe);
                dbg('[SB-LP] Retrying LP fetch after re-auth...');
                attemptLPFetch(site,resolve,true);
            },5000);
        };
        GM_xmlhttpRequest({method:'GET',url:reportsUrl,
            headers:{'Accept':'*/*','Content-Type':'application/json'},
            onload:function(resp){
                try{
                    const text=resp.responseText.trim();
                    if(!text.startsWith('[')&&!text.startsWith('{')){
                        // Non-JSON 200 = almost always the GalaxyBI login/SSO page (expired session).
                        // Route through the SAME silent re-auth as a network error instead of giving up.
                        const looksLikeLogin=/<html|<!doctype|sign in|midway|login|federate/i.test(text);
                        console.warn('[SB-LP] Reports not JSON, status:',resp.status,'first 200:',text.substring(0,200));
                        if(looksLikeLogin){reauthAndRetry('reports returned HTML login (status '+resp.status+')');}
                        else resolve(null);
                        return;
                    }
                    const data=JSON.parse(text);
                    const reports=data.reports||data||[];
                    const withPlan=(Array.isArray(reports)?reports:[]).filter(r=>r&&r.planId);
                    // Published-at time: the site publishes TWO reports per week (Wed prelim + Fri
                    // final), so among the CURRENT week's reports we want the latest-published (Fri).
                    const pubOf=(r)=>{
                        const cand=r.publishedAt||r.publishedTime||r.publishTime||r.publishedDate||r.publishDate||
                                   r.createdAt||r.createdTime||r.creationTime||r.lastModified||r.updatedAt||r.timestamp;
                        const t=cand?new Date(cand).getTime():0;
                        return isNaN(t)?0:t;
                    };
                    // A report's WEEK (its plan week's Sunday, YYYY-MM-DD). The report list can
                    // include NEXT week's plan once it's published (e.g. on a Wed/Thu), and that
                    // future plan has NO rows for the current week -> everything comes back 0/wrong.
                    // So we MUST restrict to the current week (sundayStr) before choosing by pub time.
                    const weekOf=(r)=>{
                        const cand=r.reportDate||r.startReportDate||r.weekStartDate||r.planWeek||r.weekStart||r.date||'';
                        return cand?String(cand).slice(0,10):'';
                    };
                    dbg('[SB-LP] reports returned:',withPlan.length,
                        withPlan.map(r=>({name:r.reportName,planId:r.planId,week:weekOf(r),pub:new Date(pubOf(r)).toISOString(),keys:Object.keys(r)})));
                    // 1) Prefer reports whose week == this week's Sunday. 2) If the week field doesn't
                    // match our format, fall back to reports published ON/BEFORE now (exclude future).
                    // 3) Among the chosen set, take the LATEST-published (the Fri final over Wed prelim).
                    const nowMs=Date.now();
                    let pool=withPlan.filter(r=>weekOf(r)===sundayStr);
                    if(!pool.length){
                        console.warn('[SB-LP] No report matched current week ('+sundayStr+') by date field; excluding future-published reports instead.');
                        pool=withPlan.filter(r=>pubOf(r)<=nowMs+60000); // allow 1 min clock skew
                    }
                    if(!pool.length)pool=withPlan;   // last resort: anything
                    let finalReport=pool.slice().sort((a,b)=>pubOf(b)-pubOf(a))[0];
                    if(!finalReport||!finalReport.planId){console.warn('[SB-LP] No usable report found (0 with a planId)');resolve(null);return;}
                    const planId=finalReport.planId;
                    dbg('[SB-LP] Using report:',finalReport.reportName,'planId=',planId,'week=',weekOf(finalReport),'publishedAt=',new Date(pubOf(finalReport)).toISOString());
                    let done=0;const results={ibCplh:0,obCplh:0,siteCplh:0,ctiRate:0,topRate:0,ibDensityLP:0,obDensityLP:0,ibBBGoal:0,obBBGoal:0,_planId:planId,_sundayStr:sundayStr};
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
                        dbg('[SB-LP] DeratedRates final: CTI='+results.ctiRate+' SiteCPLH='+results.siteCplh);
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
                console.warn('[SB-LP] Reports network error:',e);
                reauthAndRetry('reports network error');
            },
            ontimeout:function(){
                console.warn('[SB-LP] Reports request timed out');
                reauthAndRetry('reports timeout');
            }
        });
}

function fetchLPPageAuto(planId,pageName,sundayStr,fieldName,targetKey,callback){
    const site=loadConfig().site;
    const url=`https://galaxybi.aka.corp.amazon.com/api/metadata/pageUrl?pageName=${pageName}&planId=${planId}&site=${site}`;
    dbg('[SB-LP] Fetching page:',pageName,'url:',url);
    GM_xmlhttpRequest({method:'GET',url,headers:{'Accept':'*/*','Content-Type':'application/json'},
        onload:function(resp){
            try{
                const text=resp.responseText.trim();
                dbg('[SB-LP] pageUrl response for',pageName,'status:',resp.status,'first 200:',text.substring(0,200));
                if(!text.startsWith('{')){callback(0);return;}
                const s3Url=JSON.parse(text).url;
                if(!s3Url){console.warn('[SB-LP] No url field for',pageName);callback(0);return;}
                dbg('[SB-LP] Got S3 URL for',pageName,s3Url.substring(0,80)+'...');
                GM_xmlhttpRequest({method:'GET',url:s3Url,headers:{'Accept':'*/*'},
                    onload:function(s3Resp){
                        try{
                            const rows=JSON.parse(s3Resp.responseText);
                            dbg('[SB-LP]',pageName,'data:',rows.length,'rows');
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
                            dbg(`[SB-LP] ${pageName} → ${targetKey} = ${val}`);
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
                                const drDbg=rows.filter(r=>(r.lineItem||'').trim()===targetLineItem&&r.date===sundayStr);
                                dbg(`[SB-LP] DeratedRates debug: ${targetLineItem} date=${sundayStr} matches:`,drDbg.map(r=>r.type+'/'+r.packType+'='+r.value));
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
                                dbg('[SB-LP] Transfer Out Pick matches:',matches.map(r=>r.lineItem+'/'+r.packType+'='+r.value));
                                if(matches.length>0){val=parseFloat(matches[0].value)||0;}
                            }
                            dbg(`[SB-LP] Rate[${pageName}]: ${targetLineItem} = ${val}`);
                            callback(val);
                        }catch(e){callback(0);}
                    },onerror:function(){callback(0);},ontimeout:function(){callback(0);}
                });
            }catch(e){callback(0);}
        },onerror:function(){callback(0);},ontimeout:function(){callback(0);}
    });
}

function fetchBBGoalFromLP(planId,pageName,sundayStr,callback,dayName){
    const site=loadConfig().site;
    const url=`https://galaxybi.aka.corp.amazon.com/api/metadata/pageUrl?pageName=${pageName}&planId=${planId}&site=${site}`;
    // The BB goal is keyed by day-of-week. Default to today; caller can pass a specific day
    // (e.g. yesterday) so the prior-day view shows that day's plan, not today's.
    const days=['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];
    const todayDay=dayName||days[new Date().getDay()];
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
                            dbg(`[SB-LP] BB Goal ${pageName} (${todayDay}) = ${val}`);
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
    return dk?{good:'#1b8a4a',warn:'#c77d00',bad:'#d32f2f',txt:'#fff'}:{good:'rgba(52,211,153,0.15)',warn:'rgba(251,191,36,0.1)',bad:'rgba(220,38,38,0.12)',txt:''};
}
function cfDensityColors(){
    const dk=document.getElementById('sb-root')?.classList.contains('dark-mode');
    return dk?{goodBg:'#4caf50',goodTxt:'#fff',warnBg:'#ff9800',warnTxt:'#fff',badBg:'#f44336',badTxt:'#fff'}:{goodBg:'rgba(46,125,50,0.12)',goodTxt:'#2e7d32',warnBg:'rgba(230,81,0,0.1)',warnTxt:'#e65100',badBg:'rgba(198,40,40,0.1)',badTxt:'#c62828'};
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
    // Shift Plan Targets panel: mirror the LP targets as read-only rows alongside the shift-plan
    // targets so the panel is a one-stop shop for both. Same LP values already fetched above.
    const sptSet=(id,v,dec)=>{const el=document.getElementById(id);if(el)el.textContent=v>0?v.toFixed(dec):'\u2014';};
    sptSet('spt-ib-lp-cplh',ibLpCplh,2);
    sptSet('spt-ob-lp-cplh',obLpCplh,2);
    sptSet('spt-ib-lp-density',ibDensityLP,2);
    sptSet('spt-ob-lp-density',obDensityLP,2);
    sptSet('spt-site-lp-cplh',siteLpCplh,2);
    // Conditional format IB Stow Rate cells based on LP CTI rate
    if(ctiRate>0){['ib-rate-p1','ib-rate-p2','ib-rate-p3','ib-rate-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=ctiRate){el.style.background=cc.good;el.style.color=cc.txt;}else if(v>=ctiRate*0.95){el.style.background=cc.warn;el.style.color=cc.txt;}else{el.style.background=cc.bad;el.style.color=cc.txt;}});}
    // Conditional format IB CPLH cells based on LP CPLH
    if(ibLpCplh>0){['ib-cplh-p1','ib-cplh-p2','ib-cplh-p3','ib-cplh-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=ibLpCplh){el.style.background=cc.good;el.style.color=cc.txt;}else if(v>=ibLpCplh*0.95){el.style.background=cc.warn;el.style.color=cc.txt;}else{el.style.background=cc.bad;el.style.color=cc.txt;}});}
    // Conditional format OB Pick Rate cells based on LP TOP rate
    if(topRate>0){['ob-rate-p1','ob-rate-p2','ob-rate-p3','ob-rate-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=topRate){el.style.background=cc.good;el.style.color=cc.txt;}else if(v>=topRate*0.95){el.style.background=cc.warn;el.style.color=cc.txt;}else{el.style.background=cc.bad;el.style.color=cc.txt;}});}
    // Conditional format OB CPLH cells based on LP CPLH
    if(obLpCplh>0){['ob-cplh-p1','ob-cplh-p2','ob-cplh-p3','ob-cplh-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=obLpCplh){el.style.background=cc.good;el.style.color=cc.txt;}else if(v>=obLpCplh*0.95){el.style.background=cc.warn;el.style.color=cc.txt;}else{el.style.background=cc.bad;el.style.color=cc.txt;}});}
    // Conditional format IB Density cells based on LP Density
    if(ibDensityLP>0){const dc=cfDensityColors();['ib-density-p1','ib-density-p2','ib-density-p3','ib-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=ibDensityLP){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=ibDensityLP*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
    // Conditional format OB Density cells based on LP Density
    if(obDensityLP>0){const dc=cfDensityColors();['ob-density-p1','ob-density-p2','ob-density-p3','ob-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=obDensityLP){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=obDensityLP*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
    // LP coloring just updated - refresh the SYNC Actions "action required" banner.
    updateActionRequired();
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
                    // Per-level summed hours + units, used for the New-Hire LC Loss calc
                    // (cases lost vs LP target rate). Kept separate from counts/rates so the
                    // existing mix display is unchanged.
                    const lcHours={1:0,2:0,3:0,4:0,5:0,unknown:0};
                    const lcUnits={1:0,2:0,3:0,4:0,5:0,unknown:0};
                    // Helper: parse a numeric cell's text to a float (strip commas). NaN -> 0.
                    const num=(cell)=>{if(!cell)return 0;const v=parseFloat((cell.textContent||'').trim().replace(/,/g,''));return isNaN(v)?0:v;};
                    rows.forEach(row=>{
                        let lcLevel=0,jph=0;
                        const cells=row.querySelectorAll('td');
                        cells.forEach(cell=>{const m=cell.textContent.trim().match(/^Level\s*(\d)$/i);if(m)lcLevel=parseInt(m[1]);});
                        if(lcLevel<1||lcLevel>5)return;
                        const allC=Array.from(cells);
                        // JPH = last cell value that's a reasonable rate (1-300)
                        for(let i=allC.length-1;i>=0;i--){
                            const v=parseFloat(allC[i].textContent.trim().replace(/,/g,''));
                            if(!isNaN(v)&&v>=1&&v<=300){jph=v;break;}
                        }
                        // Hours + units via FCLM's cell CSS classes. FCLM functionRollup rows use a
                        // multi-row grouped header, so flat column indexes don't line up with the
                        // employee-row <td>s. The cells themselves carry stable classes:
                        //   td.size-total          -> Hours (Total) for the row
                        //   td.size-total.numeric   -> the quantity/units columns (first = total qty)
                        // Fall back to a hours<unit heuristic over size-total cells if classes shift.
                        let hrs=0,units=0;
                        const hCell=row.querySelector('td.size-total:not(.numeric)')||row.querySelector('td.size-total');
                        if(hCell){const h=num(hCell);if(h>0&&h<400)hrs=h;}
                        const uCells=row.querySelectorAll('td.highlighted.size-total.numeric, td.size-total.numeric');
                        if(uCells.length){units=num(uCells[0]);}
                        // Heuristic fallback: if classes gave us nothing, scan size-total cells and
                        // treat the small one (<400) as hours and the largest as units.
                        if((hrs===0||units===0)){
                            const stCells=Array.from(row.querySelectorAll('td.size-total'));
                            let maxV=0,minHr=0;
                            stCells.forEach(c=>{const v=num(c);if(v>maxV)maxV=v;if(v>0&&v<400&&(minHr===0||v<minHr))minHr=v;});
                            if(units===0)units=maxV;
                            if(hrs===0)hrs=minHr;
                        }
                        lcCounts[lcLevel]++;
                        if(jph>0)lcRates[lcLevel].push(jph);
                        lcHours[lcLevel]+=hrs;lcUnits[lcLevel]+=units;
                    });
                    dbg('[SB-LC] iframe parse success! counts=',JSON.stringify(lcCounts),'lcHours=',JSON.stringify(lcHours),'lcUnits=',JSON.stringify(lcUnits));
                    updateLCDisplay(displayElId,lcCounts,lcRates,lcHours,lcUnits);
                } else {
                    dbg('[SB-LC] iframe timeout, falling back to ADAPT...');
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
    const lcHours={1:0,2:0,3:0,4:0,5:0,unknown:0};
    const lcUnits={1:0,2:0,3:0,4:0,5:0,unknown:0};
    let done=0;const seen=new Set();
    const fnKeywords=processId==='1003035'?['case transfer in','pallet transfer','stow','inbound']:['pick','outbound','each pick','case pick'];
    batches.forEach(batch=>{
        const eidParam=encodeURIComponent(JSON.stringify(batch));
        const url=`https://adapt-iad.amazon.com/api/femida-svc/GetBatchEmployeePerformanceMetrics?warehouseId=${encodeURIComponent(site)}&employeeIds=${eidParam}&startTime=${encodeURIComponent(batchStart)}&endTime=${encodeURIComponent(endIso)}&performanceMetricType=ProcessPathRollupHourly`;
        GM_xmlhttpRequest({method:'GET',url,timeout:30000,
            onload:function(br){try{const d=JSON.parse(br.responseText);if(d&&d.batchPerformanceMetrics){Object.keys(d.batchPerformanceMetrics).forEach(eid=>{const metrics=d.batchPerformanceMetrics[eid];if(!Array.isArray(metrics))return;let bestLevel=0,isMatch=false,totalUnits=0,totalHrs=0;metrics.forEach(m=>{const attrs=m&&m.performanceMetricAttributes;if(!attrs)return;let fn='';try{const pa=typeof attrs.processAttributes==='string'?JSON.parse(attrs.processAttributes):attrs.processAttributes;fn=((pa&&pa.FUNCTION_NAME)||'').toLowerCase();}catch(e){}if(fnKeywords.some(k=>fn.includes(k))){isMatch=true;const lcStr=attrs.learningCurveId||'';const lvl=parseInt((lcStr.match(/\d/)||['0'])[0])||0;if(lvl>bestLevel)bestLevel=lvl;const u=parseFloat(attrs.totalUnitsProcessed||attrs.units||attrs.totalUnits||attrs.jobCount||0)||0;const h=parseFloat(attrs.totalHoursWorked||attrs.hours||attrs.totalPaidHours||attrs.paidHours||0)||0;const r=parseFloat(attrs.rate||attrs.uph||attrs.jph||attrs.throughput||0)||0;totalUnits+=u;totalHrs+=h;if(r>0&&totalUnits===0)totalUnits=r;}});if(isMatch&&!seen.has(eid)){seen.add(eid);const lvlKey=bestLevel>=1&&bestLevel<=5?bestLevel:'unknown';lcCounts[lvlKey]++;if(totalHrs>0&&totalHrs<200){lcRates[lvlKey].push(totalUnits/totalHrs);lcHours[lvlKey]+=totalHrs;lcUnits[lvlKey]+=totalUnits;}else if(totalUnits>0&&totalUnits<=300)lcRates[lvlKey].push(totalUnits);}});}}catch(e){console.warn('[SB-LC] ADAPT parse error:',e);}done++;if(done===batches.length){dbg('[SB-LC] ADAPT done. counts=',JSON.stringify(lcCounts),'lcHours=',JSON.stringify(lcHours),'lcUnits=',JSON.stringify(lcUnits));if(lcRates[5].length>0)dbg('[SB-LC] LC5 sample rates:',lcRates[5].slice(0,5));updateLCDisplay(displayElId,lcCounts,lcRates,lcHours,lcUnits);}},
            onerror:function(){done++;if(done===batches.length)updateLCDisplay(displayElId,lcCounts,lcRates,lcHours,lcUnits);},
            ontimeout:function(){done++;if(done===batches.length)updateLCDisplay(displayElId,lcCounts,lcRates,lcHours,lcUnits);}
        });
    });
}
function updateLCDisplay(elId,lcCounts,lcRates,lcHours,lcUnits){
    const el=document.getElementById(elId);if(!el)return;
    // Save LC data to localStorage for per-period retention
    try{const key='sb_lc_'+elId;localStorage.setItem(key,JSON.stringify({counts:lcCounts,rates:lcRates,hours:lcHours,units:lcUnits,ts:Date.now()}));}catch(e){}
    if(!lcCounts){
        // Try loading from localStorage cache
        try{const cached=JSON.parse(localStorage.getItem('sb_lc_'+elId));if(cached&&cached.counts){lcCounts=cached.counts;lcRates=cached.rates;lcHours=cached.hours;lcUnits=cached.units;}}catch(e){}
        if(!lcCounts){el.innerHTML='<span style="color:#5B6B7A;">Learning Curve Mix: \u2014</span>';renderLCLoss(elId,null,null,null,null);return;}
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
    renderLCLoss(elId,lcHours,lcUnits,lcCounts,lcRates);
}

// New-Hire LC Loss: hours and cases "lost" by LC1-4 associates (anyone not yet LC5)
// Cases lost per LC level, summed over LC1-4 (new hires below full-ramp LC5):
//   per-level cases lost = (LP rate - level's actual rate) * headcount at that level * hours into shift
// where the level's actual rate = that level's total units / total hours (aggregate UPH).
// Only levels running BELOW the LP rate contribute (a level at/above the LP rate loses nothing).
// Example: LC1 = 9 AAs @ 24 UPH, LP = 35, 7.5h in -> (35-24)*9*7.5 = 742.5 cases lost.
// Hours-into-shift comes from SOS (getShiftDates) to now, capped at the shift length. Baseline
// LP rate = the per-associate STOW/PICK rate (ctiRate/topRate), with fallbacks to the manual
// rate target and the displayed "LP Target" text. No "hours lost" - cases only.
// Re-render both New-Hire LC Loss rows from the cached LC data. Used after the LP rate fetch
// resolves, since the first render happens during the LC iframe parse (before the LP rate loads).
function rerenderLCLossFromCache(){
    ['ib-lc-display','ob-lc-display'].forEach(elId=>{
        try{
            const c=JSON.parse(localStorage.getItem('sb_lc_'+elId)||'null');
            if(c&&c.counts)renderLCLoss(elId,c.hours,c.units,c.counts,c.rates);
        }catch(e){}
    });
}
function renderLCLoss(elId,lcHours,lcUnits,lcCounts,lcRates){
    const lossElId=elId.replace('-lc-display','-lc-loss');
    const el=document.getElementById(lossElId);if(!el)return;
    const isIB=elId.indexOf('ib-')===0;
    const lp=loadLPValues()||{};
    const readNum=(id)=>{const e=document.getElementById(id);if(!e)return 0;const v=parseFloat((e.value!=null?e.value:e.textContent)||'');return isNaN(v)?0:v;};
    // Baseline = the LP STOW/PICK RATE only (ctiRate / topRate). Do NOT fall back to the manual
    // STOW/PICK RATE *target* input - that's the user's goal, not the plan rate, and it reads
    // wrong (e.g. 50/40). If the LP rate isn't loaded yet, use the displayed "LP Target" text
    // (same source), else show a dash. renderLCLoss is re-run after the LP fetch resolves.
    let lpRate=parseFloat(isIB?lp.ctiRate:lp.topRate)||0;
    if(lpRate<=0)lpRate=readNum(isIB?'lp-cti-rate-display':'lp-top-rate-display');
    if(!lcCounts||!lcHours||!lcUnits){el.innerHTML='<span style="color:#5B6B7A;">New-Hire LC Loss: \u2014</span>';return;}
    if(lpRate<=0){el.innerHTML='<span style="color:#5B6B7A;">New-Hire LC Loss: \u2014 <span style="color:#999;">(set the '+(isIB?'Stow':'Pick')+' Rate LP target, then Get Data)</span></span>';return;}
    // Hours into shift (SOS -> now), capped at the full shift length so it never over-counts.
    const config=loadConfig();
    const {startDate,endDate}=getShiftDates(config);
    const now=new Date();
    const shiftLenH=Math.max(0,(endDate-startDate)/3600000);
    let hoursIn=(now-startDate)/3600000;
    if(hoursIn<0)hoursIn=0; if(shiftLenH>0&&hoursIn>shiftLenH)hoursIn=shiftLenH;
    if(hoursIn<=0){el.innerHTML='<span style="color:#5B6B7A;">New-Hire LC Loss: \u2014 <span style="color:#999;">(shift not started)</span></span>';return;}
    // Per-level actual rate: use the averaged per-AA JOBS rate (lcRates) - this is the same
    // jobs/hr (cases/hr) basis as the LP rate (CTI / TO Pick), matching the "LC3 50 UPH" shown
    // in the mix. Do NOT use lcUnits/lcHours: for stow lcUnits is EACHES, so that ratio is an
    // eaches/hr number (~200) and would be the wrong basis against a cases/hr LP rate. Fall back
    // to units/hours only if a level has no per-AA rate samples. Count = AAs at that level.
    let totalLost=0,anyLevel=false;const perLevelNotes=[];
    for(let lvl=1;lvl<=4;lvl++){
        const cnt=lcCounts[lvl]||0; if(cnt<=0)continue;
        let rate=0;
        const rs=(lcRates&&lcRates[lvl])||[];
        if(rs.length){rate=rs.reduce((a,b)=>a+b,0)/rs.length;}
        else if((lcHours[lvl]||0)>0){rate=lcUnits[lvl]/lcHours[lvl];}
        if(rate<=0)continue;
        anyLevel=true;
        const gap=lpRate-rate;
        if(gap<=0)continue; // this level is at/above LP - no loss
        const lost=gap*cnt*hoursIn;
        totalLost+=lost;
        perLevelNotes.push('LC'+lvl+': '+cnt+'\u00d7('+Math.round(lpRate)+'-'+Math.round(rate)+')');
    }
    if(!anyLevel){el.innerHTML='<span style="color:#5B6B7A;">New-Hire LC Loss: \u2014 <span style="color:#999;">(no LC1-4 rate data)</span></span>';return;}
    // Prominent cases-lost figure; the per-level breakdown moves into a hover tooltip so the
    // row stays clean and readable. Zero loss shows in muted green (nothing being lost).
    const rounded=Math.round(totalLost);
    // Use a CLASS (lc-loss-bad / lc-loss-good) not an inline color: the dark-mode blanket rule
    // `span[style*="color"]{color:inherit}` was overriding the inline red/green and forcing white.
    // Classes have dark-mode overrides in buildCSS2 so the color survives in both themes.
    const cls=rounded>0?'lc-loss-bad':'lc-loss-good';
    const tip=`${hoursIn.toFixed(1)}h into shift \u00d7 rate gap vs ${Math.round(lpRate)} LP rate`
        +(perLevelNotes.length?` \u2014 ${perLevelNotes.join(', ')}`:'');
    const lossNumId=lossElId+'-num';
    el.innerHTML=`<span style="color:#5B6B7A;font-weight:700;">New-Hire LC Loss:</span> `
        +`<span class="${cls}" title="${tip}" style="font-weight:800;font-size:14px;cursor:help;"><span id="${lossNumId}">${fmt(rounded)}</span> cases lost</span>`
        +` <span title="${tip}" style="color:#8a99a8;cursor:help;">\u24D8</span>`;
    // Count the cases-lost figure up from 0 for a bit of pop.
    if(rounded>0)countUpEl(lossNumId,rounded,'',0);
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
        const stow=d.stow||{},pStow=d.palletStow||{},pick=d.pick||{},obDock=d.obDock||{},sort=d.sort||{},ppr=d.ppr||{},rsr=d.rsr||{},toFluid=d.toFluidLoad||{},toDock=d.toDock||{};
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
        m.ib[p]={totalStow:ibU,periodStow:ibU,stowUnits:stow.totalUnits||0,palletUnits:pStow.totalUnits||0,palletCases,
            directHours:ibDH,indirectHours:ibIndirect,totalHours:ibTotalHrs,
            directPct:ibTotalHrs>0?(ibDH/ibTotalHrs)*100:0,indirectPct:ibTotalHrs>0?(ibIndirect/ibTotalHrs)*100:0,
            rate:stow.rate||0,headcount:(stow.headcount||0)+(pStow.headcount||0),
            // RSR (Receive Rate) = IDRT JPH Total (process 01003012), read straight off the fn-rollup
            // total row's JPH column (parseFnRollup.rate). Per period + shift-overall (full window).
            rsrRate:rsr.rate||0,
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
        // Loaded per Period = TO Fluid Load jobs (totes+cases, processId 01785143661476)
        //                     + Transfer Out Dock pallet-loaded cases (processId 1003022).
        // The TO loaded volume was split into two reports; sum them here. Fall back to the legacy
        // single obDock.fluidLoadJobs only if neither new report returned anything.
        const toLoaded=(toFluid.jobs||0)+(toDock.caseUnits||0);
        const loadedUnits=toLoaded>0?toLoaded:(obDock.fluidLoadJobs||0);
        console.warn('[SB-DA loaded] toFluidJobs='+(toFluid.jobs||0)+' toDockCases='+(toDock.caseUnits||0)+' => loadedUnits='+loadedUnits);
        m.ob[p]={pickUnits:pick.totalUnits||0,loadedUnits:loadedUnits,
            // periodPick / periodLoaded stay per-period (that time window only). syncLoaded is the
            // cumulative running total used ONLY by the OB Sync Metrics row.
            periodPick:pick.totalUnits||0,periodLoaded:loadedUnits,syncLoaded:loadedUnits,
            // DISPLAY-ONLY: pallet-loaded cases from Transfer Out Dock (processId 1003022), surfaced
            // as its own OB row. Per-period = that window's toDock.caseUnits; full = full-window parse.
            palletLoadedCases:(toDock.caseUnits||0),periodPalletLoaded:(toDock.caseUnits||0),
            directHours:obPickDH,indirectHours:obIndirect,totalHours:obTotalHrs,
            directPct:obTotalHrs>0?(obPickDH/obTotalHrs)*100:0,indirectPct:obTotalHrs>0?(obIndirect/obTotalHrs)*100:0,
            pickRate:pick.rate||0,pickHC:pick.headcount||0,dockHC:(toFluid.headcount||0)+(toDock.headcount||0)||obDock.headcount||0,
            cplh:obTotalHrs>0?loadedUnits/obTotalHrs:0,
            // Density (units/case): prefer the new TO Fluid Load report's each/case; fall back to legacy obDock.
            density:(toFluid.caseUnits||0)>0?(toFluid.eachUnits||0)/(toFluid.caseUnits||1):((obDock.caseUnits||0)>0?(obDock.eachUnits||0)/(obDock.caseUnits||1):0),
            directHC:dur>0?obPickDH/dur:0,indirectHC:dur>0?obIndirect/dur:0,
            pprPlannedHrs:daPlan,pprActualHrs:daHrs,
            pctToOP:daPlan>0?(daHrs/daPlan)*100:0};
        m.sort[p]={totalUnits:sort.totalUnits||0,directHours:sort.directHours||0,totalHours:sort.directHours||0,rate:sort.rate||0,headcount:sort.headcount||0,cplh:(sort.directHours||0)>0?sort.totalUnits/sort.directHours:0};
    });
    // Cumulative running totals for the SYNC METRICS rows ONLY (IB totalStow, OB syncLoaded,
    // Sort totalUnits). The per-period rows (CTI/PTI, Pick - Total, Cases Picked, Loaded per
    // Period) keep their own single-window values (periodStow / periodPick / periodLoaded) and
    // are never overwritten here.
    if(m.ib.p1&&m.ib.p2&&(raw.p2?.stow?.totalUnits>0||raw.p2?.palletStow?.palletCases>0)){
        m.ib.p2.totalStow=(m.ib.p1.totalStow||0)+((raw.p2?.stow?.totalUnits||0)+(raw.p2?.palletStow?.palletCases||0));
        m.ob.p2.syncLoaded=(m.ob.p1.syncLoaded||0)+(m.ob.p2.periodLoaded||0);
        m.sort.p2.totalUnits=(m.sort.p1.totalUnits||0)+(raw.p2?.sort?.totalUnits||0);
    }
    if(m.ib.p2&&m.ib.p3&&(raw.p3?.stow?.totalUnits>0||raw.p3?.palletStow?.palletCases>0||raw.p3?.pick?.totalUnits>0)){
        m.ib.p3.totalStow=m.ib.full?.totalStow||(m.ib.p2.totalStow||0)+((raw.p3?.stow?.totalUnits||0)+(raw.p3?.palletStow?.palletCases||0));
        m.ob.p3.syncLoaded=(m.ob.full?.loadedUnits)||((m.ob.p2.syncLoaded||0)+(m.ob.p3.periodLoaded||0));
        m.sort.p3.totalUnits=m.sort.full?.totalUnits||(m.sort.p2.totalUnits||0)+(raw.p3?.sort?.totalUnits||0);
    }
    return m;
}

// === UI HELPERS ===
function fmt(v,d=0){if(v==null||isNaN(v))return'—';return Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}
function fmtPct(v){if(!v||isNaN(v)||v===0)return'—';return v.toFixed(1)+'%';}
function setEl(id,val){const el=document.getElementById(id);if(el)el.textContent=val;return el;}
// Count-up: animate an element's number from its current value to `target` over ~0.7s, then
// show the final formatted text. Used on the big goal % so it rolls up on each Get Data. Falls
// back to an instant set when reduced-motion is on or the value is tiny/invalid. Returns el.
function countUpEl(id,target,suffix,decimals){
    const el=document.getElementById(id);if(!el)return el;
    const dec=decimals||0, suf=suffix||'';
    const final=(target).toFixed(dec)+suf;
    const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion:reduce)').matches;
    if(reduce||!isFinite(target)||target<=0){el.textContent=final;return el;}
    const from=parseFloat((el.textContent||'').replace(/[^0-9.\-]/g,''))||0;
    const dur=700,start=performance.now();
    const ease=(t)=>1-Math.pow(1-t,3);
    function step(now){
        const t=Math.min(1,(now-start)/dur);
        const v=from+(target-from)*ease(t);
        el.textContent=v.toFixed(dec)+suf;
        if(t<1)requestAnimationFrame(step);else el.textContent=final;
    }
    requestAnimationFrame(step);
    return el;
}
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
                'ob-sync-','ob-pick-','ob-cases-','ob-rate-','ob-density-','ob-loadp-','ob-palletloaded-','ob-dhrs-','ob-dpct-','ob-ihrs-','ob-ipct-','ob-thrs-','ob-cplh-','ob-op-',
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
    if(ibG>0){const periods=loadConfig().schedType==='4Q'?4:3;const dc=cfDensityColors();
        [['ib-sync-p1',p1.totalStow,ibG/periods],['ib-sync-p2',p2.totalStow,ibG/periods*2],['ib-sync-p3',p3.totalStow,ibG],['ib-sync-total',f.totalStow,ibG]].forEach(([id,act,tgt])=>{
            const el=document.getElementById(id);if(!el)return;if(!act||act<=0){el.style.background='';el.style.color='';return;}if(act>=tgt){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(act>=tgt*0.95){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});
    }
    setEl('ib-cases-p1',fmt(p1.stowUnits));setEl('ib-cases-p2',fmt(p2.stowUnits));setEl('ib-cases-p3',fmt(p3.stowUnits));setEl('ib-cases-total',fmt(f.stowUnits));
    setEl('ib-pallets-p1',fmt(p1.palletUnits||0));setEl('ib-pallets-p2',fmt(p2.palletUnits||0));setEl('ib-pallets-p3',fmt(p3.palletUnits||0));setEl('ib-pallets-total',fmt(f.palletUnits||0));
    // CTI/PTI per period = ONLY that period's production (not the cumulative Sync Metrics running total)
    setEl('ib-cti-p1',fmt(p1.periodStow!=null?p1.periodStow:p1.totalStow));setEl('ib-cti-p2',fmt(p2.periodStow!=null?p2.periodStow:p2.totalStow));setEl('ib-cti-p3',fmt(p3.periodStow!=null?p3.periodStow:p3.totalStow));setEl('ib-cti-total',fmt(f.totalStow));
    setEl('ib-rate-p1',fmt(p1.rate,1));setEl('ib-rate-p2',fmt(p2.rate,1));setEl('ib-rate-p3',fmt(p3.rate,1));setEl('ib-rate-total',fmt(f.rate,1));
    // RSR (Receive Rate) = IDRT JPH Total; per period + shift-overall (full). Blank when 0.
    setEl('ib-rsr-p1',p1.rsrRate>0?fmt(p1.rsrRate,1):'\u2014');setEl('ib-rsr-p2',p2.rsrRate>0?fmt(p2.rsrRate,1):'\u2014');setEl('ib-rsr-p3',p3.rsrRate>0?fmt(p3.rsrRate,1):'\u2014');setEl('ib-rsr-total',f.rsrRate>0?fmt(f.rsrRate,1):'\u2014');
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
    // Sync Metrics row = cumulative running total (syncLoaded). Total column = whole-shift loaded.
    const sync1=p1.syncLoaded!=null?p1.syncLoaded:p1.loadedUnits;
    const sync2=p2.syncLoaded!=null?p2.syncLoaded:p2.loadedUnits;
    const sync3=p3.syncLoaded!=null?p3.syncLoaded:p3.loadedUnits;
    const syncT=f.loadedUnits;
    setEl('ob-sync-p1',fmt(sync1));setEl('ob-sync-p2',fmt(sync2));setEl('ob-sync-p3',fmt(sync3));setEl('ob-sync-total',fmt(syncT));
    // Conditional format OB sync metrics cells vs targets (based on loaded)
    const obG=parseFloat(document.getElementById('ob-goal-input')?.value)||0;
    if(obG>0){const periods=loadConfig().schedType==='4Q'?4:3;const dc=cfDensityColors();
        [['ob-sync-p1',sync1,obG/periods],['ob-sync-p2',sync2,obG/periods*2],['ob-sync-p3',sync3,obG],['ob-sync-total',syncT,obG]].forEach(([id,act,tgt])=>{
            const el=document.getElementById(id);if(!el)return;if(!act||act<=0){el.style.background='';el.style.color='';return;}if(act>=tgt){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(act>=tgt*0.95){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});
    }
    // Pick - Total / Cases Picked = per-period (that time window only); Total = whole-shift pick.
    const pick1=p1.periodPick!=null?p1.periodPick:p1.pickUnits;
    const pick2=p2.periodPick!=null?p2.periodPick:p2.pickUnits;
    const pick3=p3.periodPick!=null?p3.periodPick:p3.pickUnits;
    setEl('ob-pick-p1',fmt(pick1));setEl('ob-pick-p2',fmt(pick2));setEl('ob-pick-p3',fmt(pick3));setEl('ob-pick-total',fmt(f.pickUnits));
    setEl('ob-cases-p1',fmt(pick1));setEl('ob-cases-p2',fmt(pick2));setEl('ob-cases-p3',fmt(pick3));setEl('ob-cases-total',fmt(f.pickUnits));
    setEl('ob-rate-p1',fmt(p1.pickRate,1));setEl('ob-rate-p2',fmt(p2.pickRate,1));setEl('ob-rate-p3',fmt(p3.pickRate,1));setEl('ob-rate-total',fmt(f.pickRate,1));
    // OB Density
    setEl('ob-density-p1',p1.density>0?fmt(p1.density,2):'\u2014');setEl('ob-density-p2',p2.density>0?fmt(p2.density,2):'\u2014');setEl('ob-density-p3',p3.density>0?fmt(p3.density,2):'\u2014');setEl('ob-density-total',f.density>0?fmt(f.density,2):'\u2014');
    // Conditional format OB density vs planned
    const obDT=parseFloat(document.getElementById('ob-density-target')?.value)||0;
    if(obDT>0){const dc=cfDensityColors();['ob-density-p1','ob-density-p2','ob-density-p3','ob-density-total'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const v=parseFloat(el.textContent)||0;if(v<=0){el.style.background='';el.style.color='';return;}if(v>=obDT){el.style.background=dc.goodBg;el.style.color=dc.goodTxt;}else if(v>=obDT*0.9){el.style.background=dc.warnBg;el.style.color=dc.warnTxt;}else{el.style.background=dc.badBg;el.style.color=dc.badTxt;}});}
    // Rate conditional formatting handled by renderLPPercents (LP rate)
    // Loaded per Period = per-period loaded (that time window only); Total = whole-shift loaded.
    const load1=p1.periodLoaded!=null?p1.periodLoaded:p1.loadedUnits;
    const load2=p2.periodLoaded!=null?p2.periodLoaded:p2.loadedUnits;
    const load3=p3.periodLoaded!=null?p3.periodLoaded:p3.loadedUnits;
    setEl('ob-loadp-p1',fmt(load1));setEl('ob-loadp-p2',fmt(load2));setEl('ob-loadp-p3',fmt(load3));setEl('ob-loadp-total',fmt(f.loadedUnits));
    // Conditional format Loaded per Period cells vs targets (per-period target = goal / #periods)
    if(obG>0){const periods=loadConfig().schedType==='4Q'?4:3;const cc2=cfColors();const perTgt=obG/periods;
        [['ob-loadp-p1',load1,perTgt],['ob-loadp-p2',load2,perTgt],['ob-loadp-p3',load3,perTgt],['ob-loadp-total',f.loadedUnits,obG]].forEach(([id,act,tgt])=>{
            const el=document.getElementById(id);if(!el)return;if(!act||act<=0){el.style.background='';return;}el.style.background=act>=tgt?cc2.good:act>=tgt*0.95?cc2.warn:cc2.bad;});
    }
    // Palletized Cases Loaded = per-period Transfer Out Dock cases (that window only); Total = whole-shift. Plain informational row, no conditional coloring.
    const pal1=p1.periodPalletLoaded!=null?p1.periodPalletLoaded:(p1.palletLoadedCases||0);
    const pal2=p2.periodPalletLoaded!=null?p2.periodPalletLoaded:(p2.palletLoadedCases||0);
    const pal3=p3.periodPalletLoaded!=null?p3.periodPalletLoaded:(p3.palletLoadedCases||0);
    setEl('ob-palletloaded-p1',fmt(pal1));setEl('ob-palletloaded-p2',fmt(pal2));setEl('ob-palletloaded-p3',fmt(pal3));setEl('ob-palletloaded-total',fmt(f.palletLoadedCases||0));
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
    setEl('sum-stow-goal',ibG>0?fmt(ibG):'—');setEl('sum-stow-rate',f.rate?fmt(f.rate,1):'—');if(f.cplh)countUpEl('sum-ib-cplh',f.cplh,'',2);else setEl('sum-ib-cplh','—');
    if(ibG>0&&f.totalStow){const p=(f.totalStow/ibG)*100;const el=countUpEl('sum-ib-pct',p,'%',1);const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ib-actual',fmt(f.totalStow));setEl('sum-ib-remaining',fmt(ibG-f.totalStow));
        const bar=document.getElementById('ib-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    // Position period markers on IB bar
    const periods=config.schedType==='4Q'?4:3;
    const ibM1=document.getElementById('ib-marker-p1');const ibM2=document.getElementById('ib-marker-p2');
    if(ibM1)ibM1.style.left=(100/periods)+'%';if(ibM2)ibM2.style.left=(200/periods)+'%';
    setEl('sum-pick-goal',obG>0?fmt(obG):'—');setEl('sum-pick-rate',ob.pickRate?fmt(ob.pickRate,1):'—');if(ob.cplh)countUpEl('sum-ob-cplh',ob.cplh,'',2);else setEl('sum-ob-cplh','—');
    if(obG>0&&ob.loadedUnits){const p=(ob.loadedUnits/obG)*100;const el=countUpEl('sum-ob-pct',p,'%',1);const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-ob-actual',fmt(ob.loadedUnits));setEl('sum-ob-remaining',fmt(obG-ob.loadedUnits));
        const bar=document.getElementById('ob-progress-bar');if(bar){bar.style.width=Math.min(p,100)+'%';bar.className='goal-progress-bar '+pColor;}}
    const obM1=document.getElementById('ob-marker-p1');const obM2=document.getElementById('ob-marker-p2');
    if(obM1)obM1.style.left=(100/periods)+'%';if(obM2)obM2.style.left=(200/periods)+'%';
    setEl('sum-sort-goal',sortG>0?fmt(sortG):'—');setEl('sum-sort-rate',sf.rate?fmt(sf.rate,1):'—');setEl('sum-sort-cplh',sf.cplh?fmt(sf.cplh,2):'—');
    if(sortG>0&&sf.totalUnits){const p=(sf.totalUnits/sortG)*100;const el=countUpEl('sum-sort-pct',p,'%',1);const pColor=getPaceColor(p,config);el.classList.remove('pct-good','pct-warn','pct-bad');el.classList.add(pColor==='green'?'pct-good':pColor==='amber'?'pct-warn':'pct-bad');setEl('sum-sort-actual',fmt(sf.totalUnits));setEl('sum-sort-remaining',fmt(sortG-sf.totalUnits));
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
// NOTE: renamed from renderFastStart -> renderFastStartRow. There is a SECOND function named
// renderFastStart (the Fast Start TAB table renderer) later in the file; because JS hoists the
// last declaration, that one was shadowing this one and the IB/OB Fast Start row never rendered.
// This renders the compact Fast Start row (minutes-to-first) in the IB/OB Sync tables.
function renderFastStartRow(fs,config){
    if(!fs)return;
    const t=config.targets||{};
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
    // Fast Start session/data note. When the benchmarking tool returned no usable numbers,
    // tell the user why: not-authorized -> they must open the benchmarking site to establish a
    // session; authorized-but-empty -> moves data not published for the shift yet.
    const fsNote=document.getElementById('fast-start-note');
    if(fsNote){
        if(fs._authorized===false){
            fsNote.style.display='';
            fsNote.innerHTML='\u26A0\uFE0F Fast Start unavailable \u2014 <a href="https://fc-benchmarking.amazon.com/" target="_blank" style="color:#1565c0;text-decoration:underline;font-weight:700;">open FC Benchmarking</a> to sign in, then click Get Data.';
        }else if(fs._authorized===true&&fs._hasData===false){
            fsNote.style.display='';
            fsNote.innerHTML='\u2139\uFE0F Fast Start: no move data published for this shift yet.';
        }else{
            fsNote.style.display='none';
        }
    }
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
    updateActionRequired();
}
// Scan the key IB/OB metrics for anything red / under LP and surface a banner in the SYNC Actions
// panel telling the user an action must be classified. "Under LP" is read from the % to LP total
// cells (pct-bad) plus the Rate / Density / CPLH totals when they carry the red "bad" color that
// renderLPPercents applies. Keeps the user from missing a miss that needs an action logged.
function updateActionRequired(){
    const banner=document.getElementById('action-required-banner');if(!banner)return;
    // Named checks: label -> element id. A check "fails" if the cell is red (pct-bad class or a
    // red inline color/background from renderLPPercents' cc.bad).
    // Density intentionally excluded - we don't want density misses to require an action item.
    const checks=[
        ['IB CPLH','ib-op-total'],['IB Stow Rate','ib-rate-total'],
        ['OB CPLH','ob-op-total'],['OB Pick Rate','ob-rate-total']
    ];
    // Bad-color signatures used by cfColors/cfDensityColors (browsers report inline colors as
    // rgb/rgba, so match on the RGB triples rather than the original hex): 220,38,38 (cc.bad
    // light), 211,47,47 (#d32f2f dark), 198,40,40 (density bad light), 244,67,54 (#f44336 dark),
    // 198,40,40 (#c62828 badTxt).
    const RED_RGBS=['220,38,38','211,47,47','198,40,40','244,67,54'];
    const isRed=(el)=>{
        if(!el)return false;
        if(el.classList&&el.classList.contains('pct-bad'))return true;
        const c=((el.style&&(el.style.color||''))+' '+(el.style&&(el.style.background||''))).replace(/\s/g,'').toLowerCase();
        return RED_RGBS.some(r=>c.indexOf(r.replace(/\s/g,''))!==-1);
    };
    const misses=[];
    checks.forEach(([label,id])=>{const el=document.getElementById(id);if(isRed(el)){const v=(el.textContent||'').trim();misses.push(label+(v&&v!=='\u2014'?' ('+v+')':''));}});
    // ICQA Defects (ATLAS): DPMO where LOWER is better, so a defect is OVER threshold when
    // value > threshold. Read the rendered ICQA panel cells (value + threshold) for each defect;
    // when over, flag it so the user classifies an action (e.g. "over defects: Bin Collision").
    // Parses the comma-formatted DPMO text; skips any defect whose value/threshold isn't a usable
    // number (em-dash = fetch not loaded yet, so no false positive).
    const defChecks=[
        ['Bin Collision','atlas-binc-value','atlas-binc-threshold'],
        ['Ship Failed Moves','atlas-shipfm-value','atlas-shipfm-threshold']
    ];
    const numOf=(id)=>{const el=document.getElementById(id);if(!el)return NaN;return parseFloat((el.textContent||'').replace(/,/g,''));};
    const overDefects=[];
    defChecks.forEach(([label,valId,thrId])=>{
        const v=numOf(valId),t=numOf(thrId);
        if(!isNaN(v)&&!isNaN(t)&&t>0&&v>t)overDefects.push(label+' ('+Math.round(v).toLocaleString()+' > '+Math.round(t).toLocaleString()+')');
    });
    if(misses.length||overDefects.length){
        banner.className='ar-alert';
        banner.style.display='flex';
        const parts=[];
        if(misses.length)parts.push(misses.length+' metric'+(misses.length>1?'s':'')+' under LP \u2014 classify an action: <b>'+misses.join(', ')+'</b>');
        if(overDefects.length)parts.push('over defects threshold: <b>'+overDefects.join(', ')+'</b>');
        banner.innerHTML='\u26A0\uFE0F <span>'+parts.join(' &nbsp;\u2022&nbsp; ')+'</span>';
    }else{
        banner.className='ar-clear';
        banner.style.display='flex';
        banner.innerHTML='\u2705 <span>All tracked metrics at or above LP; defects within threshold.</span>';
    }
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
<div class="nav-tabs"><button class="nav-tab active" data-tab="sync">Sync IB-OB</button><button class="nav-tab" data-tab="hourly">Hourly</button><button class="nav-tab" data-tab="faststart">Fast Start</button><button class="nav-tab" data-tab="vrets">VRETs</button><button class="nav-tab" data-tab="eoswash">EOS Wash</button><button class="nav-tab" data-tab="settings">Settings</button></div></div>
<div class="topnav-right"><select id="site-select" class="select-input"></select><select id="shift-select" class="select-input"><option value="Days">Days</option><option value="Nights">Nights</option></select>
<div class="period-indicator"><span class="period-dot" id="dot-p1">P1</span><span class="period-dot" id="dot-p2">P2</span><span class="period-dot" id="dot-p3">P3</span></div>
<button id="btn-fetch" class="btn btn-primary">\u25B6 Get Data</button><button id="btn-snip" class="btn btn-snip">\uD83D\uDCF7 Snip</button><button id="btn-dark" class="btn" style="background:#333;color:#fff;border-color:#333;">\u263D</button><button id="btn-exit" class="btn btn-danger">\u2715 Exit</button><span id="last-update" class="meta-text">Ready</span></div></nav>

<main id="tab-sync" class="tab-content active"><div class="sync-layout">
<div class="sync-left">

<section class="metrics-section actions-section"><div class="section-header"><h2>\u{1F4CB} SYNC Actions</h2><div><button id="btn-add-action" class="btn btn-small">+ Add</button> <button id="btn-clear-actions" class="btn btn-small btn-danger">Clear</button></div></div>
<div id="action-required-banner" style="display:none;"></div>
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
<tr><td>RSR (Receive Rate)</td><td id="ib-rsr-p1">\u2014</td><td id="ib-rsr-p2">\u2014</td><td id="ib-rsr-p3">\u2014</td><td id="ib-rsr-total">\u2014</td></tr>
<tr><td>Density <span style="margin-left:20px;font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ib-density-display">\u2014</span></span></td><td id="ib-density-p1">\u2014</td><td id="ib-density-p2">\u2014</td><td id="ib-density-p3">\u2014</td><td id="ib-density-total">\u2014</td></tr>
<tr><td>Direct Hours</td><td id="ib-dhrs-p1">0</td><td id="ib-dhrs-p2">0</td><td id="ib-dhrs-p3">0</td><td id="ib-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ib-dpct-p1">\u2014</td><td id="ib-dpct-p2">\u2014</td><td id="ib-dpct-p3">\u2014</td><td id="ib-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ib-ihrs-p1">0</td><td id="ib-ihrs-p2">0</td><td id="ib-ihrs-p3">0</td><td id="ib-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ib-ipct-p1">\u2014</td><td id="ib-ipct-p2">\u2014</td><td id="ib-ipct-p3">\u2014</td><td id="ib-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ib-thrs-p1">0</td><td id="ib-thrs-p2">0</td><td id="ib-thrs-p3">0</td><td id="ib-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH <span style="margin-left:20px;font-size:11px;background:#e3f2fd;color:#1565c0;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ib-cplh-display">\u2014</span></span></td><td id="ib-cplh-p1">\u2014</td><td id="ib-cplh-p2">\u2014</td><td id="ib-cplh-p3">\u2014</td><td id="ib-cplh-total">\u2014</td></tr>
<tr><td>% to LP</td><td id="ib-op-p1">\u2014</td><td id="ib-op-p2">\u2014</td><td id="ib-op-p3">\u2014</td><td id="ib-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ib-fast-p1">\u2014</td><td id="ib-fast-p2">\u2014</td><td id="ib-fast-p3">\u2014</td><td></td></tr>
<tr class="row-fast-note"><td colspan="5" id="fast-start-note" style="display:none;font-size:10px;color:#c62828;padding:2px 0;">\u2014</td></tr>
<tr class="row-lc"><td colspan="5" id="ib-lc-display" style="font-size:11px;color:#5B6B7A;">Learning Curve Mix: \u2014</td></tr>
<tr class="row-lc-loss"><td colspan="5" id="ib-lc-loss" style="font-size:12px;color:#5B6B7A;padding:4px 0;">New-Hire LC Loss: \u2014</td></tr>
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
<tr><td>Palletized Cases Loaded</td><td id="ob-palletloaded-p1">0</td><td id="ob-palletloaded-p2">0</td><td id="ob-palletloaded-p3">0</td><td id="ob-palletloaded-total">0</td></tr>
<tr><td>Direct Hours</td><td id="ob-dhrs-p1">0</td><td id="ob-dhrs-p2">0</td><td id="ob-dhrs-p3">0</td><td id="ob-dhrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Direct %</td><td id="ob-dpct-p1">\u2014</td><td id="ob-dpct-p2">\u2014</td><td id="ob-dpct-p3">\u2014</td><td id="ob-dpct-total">\u2014</td></tr>
<tr><td>Indirect Hours</td><td id="ob-ihrs-p1">0</td><td id="ob-ihrs-p2">0</td><td id="ob-ihrs-p3">0</td><td id="ob-ihrs-total">0</td></tr>
<tr><td>&nbsp;&nbsp;Indirect %</td><td id="ob-ipct-p1">\u2014</td><td id="ob-ipct-p2">\u2014</td><td id="ob-ipct-p3">\u2014</td><td id="ob-ipct-total">\u2014</td></tr>
<tr class="row-total"><td>Total Hours</td><td id="ob-thrs-p1">0</td><td id="ob-thrs-p2">0</td><td id="ob-thrs-p3">0</td><td id="ob-thrs-total">0</td></tr>
<tr class="row-cplh"><td class="bold">CPLH <span style="margin-left:20px;font-size:11px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;font-weight:700;">LP Target = <span id="lp-ob-cplh-display">\u2014</span></span></td><td id="ob-cplh-p1">\u2014</td><td id="ob-cplh-p2">\u2014</td><td id="ob-cplh-p3">\u2014</td><td id="ob-cplh-total">\u2014</td></tr>
<tr><td>% to LP</td><td id="ob-op-p1">\u2014</td><td id="ob-op-p2">\u2014</td><td id="ob-op-p3">\u2014</td><td id="ob-op-total">\u2014</td></tr>
<tr class="row-fast"><td>Fast Start</td><td id="ob-fast-p1">\u2014</td><td id="ob-fast-p2">\u2014</td><td id="ob-fast-p3">\u2014</td><td></td></tr>
<tr class="row-lc"><td colspan="5" id="ob-lc-display" style="font-size:11px;color:#5B6B7A;">Learning Curve Mix: \u2014</td></tr>
<tr class="row-lc-loss"><td colspan="5" id="ob-lc-loss" style="font-size:12px;color:#5B6B7A;padding:4px 0;">New-Hire LC Loss: \u2014</td></tr>
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

<div class="charts-panel">
<div class="chart-card"><h3>Stow (Planned vs Actual) + Rate</h3><canvas id="chart-stow" height="170"></canvas></div>
<div class="chart-card"><h3>CPLH + Direct vs Indirect</h3><canvas id="chart-cplh-ib" height="170"></canvas></div>
<div class="chart-card"><h3>Picked (Plan vs Actual) + Rate</h3><canvas id="chart-pick" height="170"></canvas></div>
<div class="chart-card"><h3>Picked vs Loaded</h3><canvas id="chart-loaded" height="170"></canvas></div>
</div>

</div><!-- sync-left -->

<div class="sync-right">
<div class="goal-summary-col">
<div class="goal-card ib-card"><div class="goal-header"><span class="goal-title">Inbound</span><span class="goal-pct" id="sum-ib-pct">\u2014</span></div><div class="goal-progress" id="ib-progress-wrap"><div class="goal-progress-bar green" id="ib-progress-bar" style="width:0%"></div><div class="period-marker" id="ib-marker-p1" data-label="P1" style="left:33%"></div><div class="period-marker" id="ib-marker-p2" data-label="P2" style="left:66%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-stow-goal">\u2014</strong></span><span>Actual <strong id="sum-ib-actual">\u2014</strong></span><span>Remaining <strong id="sum-ib-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-stow-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ib-cplh">\u2014</strong> CPLH</span></div><div class="pace-insight" id="ib-pace-insight"></div></div>
<div class="goal-card ob-card"><div class="goal-header"><span class="goal-title">Outbound</span><span class="goal-pct" id="sum-ob-pct">\u2014</span></div><div class="goal-progress" id="ob-progress-wrap"><div class="goal-progress-bar green" id="ob-progress-bar" style="width:0%"></div><div class="period-marker" id="ob-marker-p1" data-label="P1" style="left:33%"></div><div class="period-marker" id="ob-marker-p2" data-label="P2" style="left:66%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-pick-goal">\u2014</strong></span><span>Actual <strong id="sum-ob-actual">\u2014</strong></span><span>Remaining <strong id="sum-ob-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-pick-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-ob-cplh">\u2014</strong> CPLH</span></div><div class="pace-insight" id="ob-pace-insight"></div></div>
<div class="goal-card sort-card" id="sort-summary-card"><div class="goal-header"><span class="goal-title">Sort</span><span class="goal-pct" id="sum-sort-pct">\u2014</span></div><div class="goal-progress"><div class="goal-progress-bar green" id="sort-progress-bar" style="width:0%"></div></div><div class="goal-stats"><span>Goal <strong id="sum-sort-goal">\u2014</strong></span><span>Actual <strong id="sum-sort-actual">\u2014</strong></span><span>Remaining <strong id="sum-sort-remaining">\u2014</strong></span></div><div class="goal-stats"><span>\u25B2 <strong id="sum-sort-rate">\u2014</strong> Rate</span><span>\u2713 <strong id="sum-sort-cplh">\u2014</strong> CPLH</span></div></div>
</div>
<div class="icqa-panel" id="icqa-panel" style="background:#fff;border:2px solid #000;border-radius:4px;padding:10px 14px;">
<input type="hidden" id="icqa-ro-target" value="">
<input type="hidden" id="icqa-dc-target" value="70">
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
<div><span style="color:#333;font-size:10px;">GOAL</span><br><strong id="icqa-dc-shift-pct" style="font-size:16px;">70%</strong></div>
<div><span style="color:#333;font-size:10px;">WEEK DC%</span><br><strong id="icqa-dc-week-actual" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">GOAL</span><br><strong id="icqa-dc-week-pct" style="font-size:16px;">70%</strong></div>
</div>
<div style="font-size:10px;font-weight:700;color:#555;margin:8px 0 2px;">Defects (ATLAS) <span style="font-weight:400;color:#888;font-size:9px;">shift-to-date DPMO \u00b7 lower is better</span></div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;font-size:12px;">
<div><span style="color:#333;font-size:10px;">BIN COLLISION</span><br><strong id="atlas-binc-value" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">THRESHOLD</span><br><strong id="atlas-binc-threshold" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">BIN COLL COUNT</span><br><strong id="atlas-binc-count" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">SHIP FAILED MOVES</span><br><strong id="atlas-shipfm-value" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">THRESHOLD</span><br><strong id="atlas-shipfm-threshold" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">SHIP FM COUNT</span><br><strong id="atlas-shipfm-count" style="font-size:16px;">\u2014</strong></div>
</div>
<div id="atlas-session-note" style="display:none;font-size:10px;color:#c62828;margin-top:4px;">\u26A0\uFE0F ATLAS DPMO session expired \u2014 <a href="https://atlas.qubit.amazon.dev/defect-dashboard" target="_blank" style="color:#1565c0;text-decoration:underline;font-weight:700;">open ATLAS</a> to sign in, then click Get Data.</div>
<div id="os-session-note" style="display:none;font-size:10px;color:#c62828;margin-top:2px;">\u26A0\uFE0F Counts unavailable \u2014 <a href="https://moc.prod.atlas-opensearch.qubit.amazon.dev/_dashboards/app/dashboards?security_tenant=global" target="_blank" style="color:#1565c0;text-decoration:underline;font-weight:700;">open OpenSearch</a> to sign in, then click Get Data.</div>
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
<div id="vret-panel" style="background:#fff;border:2px solid #000;border-radius:4px;border-left:4px solid #e65100;padding:10px 14px;margin-top:6px;">
<h3 style="font-size:11px;font-weight:700;margin-bottom:6px;">VRETs (Weekly Pack \u2013 Units) <span style="margin-left:8px;font-size:10px;background:#fff3e0;color:#e65100;padding:2px 8px;border-radius:4px;font-weight:700;">see VRETs tab</span></h3>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;font-size:12px;">
<div><span style="color:#333;font-size:10px;">PACK WTD</span><br><strong id="sync-vret-wtd" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">WEEK GOAL</span><br><strong id="sync-vret-goal" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">% TO GOAL</span><br><strong id="sync-vret-pct" style="font-size:16px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">DELTA</span><br><strong id="sync-vret-delta" style="font-size:16px;">\u2014</strong></div>
</div>
<div class="vrets-bar" style="margin-top:6px;"><div id="sync-vret-bar" style="width:0%;"></div></div>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:12px;margin-top:8px;">
<div><span style="color:#333;font-size:10px;">TODAY PICK</span><br><strong id="sync-vret-today-pick" style="font-size:14px;">\u2014</strong></div>
<div><span style="color:#333;font-size:10px;">TODAY PACK</span><br><strong id="sync-vret-today-pack" style="font-size:14px;">\u2014</strong></div>
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
<div class="targets-panel"><h3 class="panel-title" style="display:flex;justify-content:space-between;align-items:center;">
<span style="display:inline-flex;gap:0;"><button id="btn-view-targets" class="btn btn-small day-toggle active" style="border-radius:4px 0 0 4px;">Shift Plan Targets</button><button id="btn-view-current" class="btn btn-small day-toggle" style="border-radius:0;">Current Day</button><button id="btn-view-prior" class="btn btn-small day-toggle" style="border-radius:0 4px 4px 0;">Prior Day</button></span>
<button id="btn-clear-targets" class="btn btn-small btn-danger">Clear</button></h3>
<div id="spt-targets-view">
<div class="target-groups-row">
<div class="tg-compact"><h4>INBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><span id="ib-bb-goal" style="font-weight:bold;">\u2014</span></td><td></td></tr>
<tr><td>IB GOAL</td><td><input type="number" id="ib-goal-input" class="target-input"></td><td><span id="ib-goal-pct">\u2014</span></td></tr>
<tr><td>STOW RATE</td><td><input type="number" id="ib-rate-target" class="target-input"></td><td><span id="ib-rate-pct">\u2014</span></td></tr>
<tr><td>IB CPLH</td><td><input type="number" id="ib-cplh-target" class="target-input"></td><td><span id="ib-cplh-pct">\u2014</span></td></tr>
<tr class="lp-row"><td>IB LP CPLH</td><td><span id="spt-ib-lp-cplh" class="lp-val">\u2014</span></td><td></td></tr>
<tr><td>PLANNED DENSITY</td><td><input type="number" id="ib-density-target" class="target-input" step="0.01"></td><td><span id="ib-density-pct">\u2014</span></td></tr>
<tr class="lp-row"><td>IB LP DENSITY</td><td><span id="spt-ib-lp-density" class="lp-val">\u2014</span></td><td></td></tr>
<tr><td>SOS FAST START</td><td><input type="number" id="ib-fast-sos" class="target-input" value="13" readonly style="background:#eee;color:#333;cursor:default;"></td><td><span id="ib-fast-sos-pct">\u2014</span></td></tr>
<tr><td>EOL FAST START</td><td><input type="number" id="ib-fast-eol" class="target-input" value="18" readonly style="background:#eee;color:#333;cursor:default;"></td><td><span id="ib-fast-eol-pct">\u2014</span></td></tr>
</tbody></table></div>
<div class="tg-compact"><h4>OUTBOUND</h4><table class="target-table"><thead><tr><th></th><th>Target</th><th>%</th></tr></thead><tbody>
<tr><td>24 HR BB GOAL</td><td><span id="ob-bb-goal" style="font-weight:bold;">\u2014</span></td><td></td></tr>
<tr><td>DA GOAL</td><td><input type="number" id="ob-goal-input" class="target-input"></td><td><span id="ob-goal-pct">\u2014</span></td></tr>
<tr><td>PICK RATE</td><td><input type="number" id="ob-rate-target" class="target-input"></td><td><span id="ob-rate-pct">\u2014</span></td></tr>
<tr><td>DA CPLH</td><td><input type="number" id="ob-cplh-target" class="target-input"></td><td><span id="ob-cplh-pct">\u2014</span></td></tr>
<tr class="lp-row"><td>DA LP CPLH</td><td><span id="spt-ob-lp-cplh" class="lp-val">\u2014</span></td><td></td></tr>
<tr><td>PLANNED DENSITY</td><td><input type="number" id="ob-density-target" class="target-input" step="0.01"></td><td><span id="ob-density-pct">\u2014</span></td></tr>
<tr class="lp-row"><td>DA LP DENSITY</td><td><span id="spt-ob-lp-density" class="lp-val">\u2014</span></td><td></td></tr>
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
<tr class="lp-row"><td>THROUGHPUT LP CPLH</td><td><span id="spt-site-lp-cplh" class="lp-val">\u2014</span></td><td></td></tr>
</tbody></table></div>
</div><!-- /spt-targets-view -->

<div id="spt-current-view" style="display:none;">
<div class="day-report-title">24hr Reporting \u2014 <span id="spt-current-date">Current Day</span></div>
<table class="target-table day-table"><thead><tr><th></th><th>Plan</th><th>Actual</th><th>Variance</th></tr></thead><tbody>
<tr><td>IB 24hr BB</td><td id="cd-ib-bb-plan">\u2014</td><td id="cd-ib-bb-act">\u2014</td><td id="cd-ib-bb-var">\u2014</td></tr>
<tr><td>IB LP Density</td><td id="cd-ib-den-plan">\u2014</td><td id="cd-ib-den-act">\u2014</td><td id="cd-ib-den-var">\u2014</td></tr>
<tr><td>IB LP CPLH</td><td id="cd-ib-cplh-plan">\u2014</td><td id="cd-ib-cplh-act">\u2014</td><td id="cd-ib-cplh-var">\u2014</td></tr>
<tr class="day-gap"><td colspan="4"></td></tr>
<tr><td>DA 24hr BB</td><td id="cd-da-bb-plan">\u2014</td><td id="cd-da-bb-act">\u2014</td><td id="cd-da-bb-var">\u2014</td></tr>
<tr><td>DA LP Density</td><td id="cd-da-den-plan">\u2014</td><td id="cd-da-den-act">\u2014</td><td id="cd-da-den-var">\u2014</td></tr>
<tr><td>DA LP CPLH</td><td id="cd-da-cplh-plan">\u2014</td><td id="cd-da-cplh-act">\u2014</td><td id="cd-da-cplh-var">\u2014</td></tr>
<tr class="day-gap"><td colspan="4"></td></tr>
<tr><td>Throughput LP CPLH</td><td id="cd-tp-cplh-plan">\u2014</td><td id="cd-tp-cplh-act">\u2014</td><td id="cd-tp-cplh-var">\u2014</td></tr>
</tbody></table>
<div id="spt-current-status" style="font-size:10px;color:#888;text-align:right;margin-top:6px;"></div>
</div>

<div id="spt-prior-view" style="display:none;">
<div class="day-report-title">24hr Reporting \u2014 <span id="spt-prior-date">Prior Day</span></div>
<table class="target-table day-table"><thead><tr><th></th><th>Plan</th><th>Actual</th><th>Variance</th></tr></thead><tbody>
<tr><td>IB 24hr BB</td><td id="pd-ib-bb-plan">\u2014</td><td id="pd-ib-bb-act">\u2014</td><td id="pd-ib-bb-var">\u2014</td></tr>
<tr><td>IB LP Density</td><td id="pd-ib-den-plan">\u2014</td><td id="pd-ib-den-act">\u2014</td><td id="pd-ib-den-var">\u2014</td></tr>
<tr><td>IB LP CPLH</td><td id="pd-ib-cplh-plan">\u2014</td><td id="pd-ib-cplh-act">\u2014</td><td id="pd-ib-cplh-var">\u2014</td></tr>
<tr class="day-gap"><td colspan="4"></td></tr>
<tr><td>DA 24hr BB</td><td id="pd-da-bb-plan">\u2014</td><td id="pd-da-bb-act">\u2014</td><td id="pd-da-bb-var">\u2014</td></tr>
<tr><td>DA LP Density</td><td id="pd-da-den-plan">\u2014</td><td id="pd-da-den-act">\u2014</td><td id="pd-da-den-var">\u2014</td></tr>
<tr><td>DA LP CPLH</td><td id="pd-da-cplh-plan">\u2014</td><td id="pd-da-cplh-act">\u2014</td><td id="pd-da-cplh-var">\u2014</td></tr>
<tr class="day-gap"><td colspan="4"></td></tr>
<tr><td>Throughput LP CPLH</td><td id="pd-tp-cplh-plan">\u2014</td><td id="pd-tp-cplh-act">\u2014</td><td id="pd-tp-cplh-var">\u2014</td></tr>
</tbody></table>
<div id="spt-prior-status" style="font-size:10px;color:#888;text-align:right;margin-top:6px;"></div>
</div>

<!-- DEPT BACKLOG: shown only for the Current Day / Prior Day views (hidden for Shift Plan Targets) -->
<div id="spt-dept-backlog" class="sort-tgt dept-tgt" style="display:none;margin-top:6px;padding-top:6px;border-top:2px solid #000;"><h4 style="color:#333;">DEPT BACKLOG</h4>
<table class="target-table dept-table"><thead><tr><th></th><th>Units</th><th>Cases</th><th>Days (Units)</th><th>Days (Cases)</th><th>IPT Backlog</th></tr></thead><tbody>
<tr><td>Inbound Backlog</td>
<td><input type="text" id="dept-ib-units" class="dept-input"></td>
<td><input type="text" id="dept-ib-cases" class="dept-input"></td>
<td><input type="text" id="dept-ib-days-units" class="dept-input"></td>
<td><input type="text" id="dept-ib-days-cases" class="dept-input"></td>
<td><input type="text" id="dept-ib-ipt" class="dept-input"></td></tr>
<tr><td>DA Backlog</td>
<td><input type="text" id="dept-da-units" class="dept-input"></td>
<td><input type="text" id="dept-da-cases" class="dept-input"></td>
<td><input type="text" id="dept-da-days-units" class="dept-input"></td>
<td><input type="text" id="dept-da-days-cases" class="dept-input"></td>
<td><input type="text" id="dept-da-ipt" class="dept-input"></td></tr>
</tbody></table></div>
</div><!-- sync-right -->
</div></main>

<main id="tab-hourly" class="tab-content"><div class="hourly-container">
<div class="section-header"><h2>Hourly Flow</h2><button id="btn-fetch-hourly" class="btn btn-primary">\u25B6 Fetch Hourly</button><span id="hourly-status" class="meta-text"></span></div>
<div class="sos-bar" style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:#fff;border:2px solid #000;border-radius:4px;padding:8px 14px;margin-bottom:10px;">
<strong style="font-size:12px;">Start-of-Shift Cages:</strong>
<label style="font-size:12px;">IB (Received) <input type="number" id="sos-ib-cages" class="target-input" style="width:70px;" min="0" step="1"> @ <input type="number" id="sos-ib-density" class="target-input" style="width:60px;" min="0" step="0.1" title="cases/cage"></label>
<label style="font-size:12px;">OB (Loaded) <input type="number" id="sos-ob-cages" class="target-input" style="width:70px;" min="0" step="1"> @ <input type="number" id="sos-ob-density" class="target-input" style="width:60px;" min="0" step="0.1" title="cartons/cage"></label>
<button id="btn-save-sos-ib" class="btn" style="font-size:11px;padding:5px 10px;">\uD83D\uDCBE Save IB SOS</button>
<button id="btn-save-sos-ob" class="btn" style="font-size:11px;padding:5px 10px;">\uD83D\uDCBE Save OB SOS</button>
<span id="sos-note" style="font-size:11px;color:#666;"></span>
</div>
<div id="hourly-tables"></div>
</div></main>

<main id="tab-eoswash" class="tab-content"><div class="eoswash-container">
<div class="section-header"><h2 style="margin-right:14px;">EOS Wash</h2><button id="btn-fetch-eoswash" class="btn btn-primary">\u25B6 Fetch EOS Wash</button><button id="btn-email-eoswash" class="btn" style="background:#1565c0;color:#fff;border-color:#1565c0;">\u2709 Email</button><span id="eoswash-status" class="meta-text" style="margin-left:12px;"></span>
<span style="margin-left:auto;display:inline-flex;align-items:center;gap:10px;font-size:12px;font-weight:700;color:#555;white-space:nowrap;">
<label style="display:inline-flex;align-items:center;gap:4px;">IB LP Target <input type="number" id="eos-ib-plan-input" class="eos-input" placeholder="\u2014" title="IB (Case Transfer In) daily plan carton target \u2014 enter the ALPS Day/Night Combined Cartons Capacity for the current shift"></label>
<label style="display:inline-flex;align-items:center;gap:4px;">OB LP Target <input type="number" id="eos-da-plan-input" class="eos-input" placeholder="\u2014" title="OB (Transfer Out Pick) daily plan carton target \u2014 enter the ALPS Day/Night Combined Cartons Capacity for the current shift"></label>
</span></div>
<div id="eoswash-content"></div>
</div></main>

<main id="tab-faststart" class="tab-content"><div class="faststart-container">
<div class="section-header"><h2>Fast Start Tracker</h2><span class="meta-text" style="font-size:11px;">Time-to-first-activity from clock-in (SDC)</span></div>
<div class="fs-controls" style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;background:#fff;border:2px solid #000;border-radius:4px;padding:10px 14px;margin-bottom:10px;">
<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;">SITE</label><select id="fs-site" class="select-input"></select></div>
<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;">SHIFT START (DATE / TIME)</label><input type="datetime-local" id="fs-start-datetime" class="select-input" style="width:210px;"></div>
<div><label style="display:block;font-size:11px;font-weight:700;margin-bottom:4px;">GOAL (MIN)</label><input type="number" id="fs-goal-time" class="target-input" value="20" min="1" max="60" style="width:80px;"></div>
<div><label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:2px;"><input type="checkbox" id="fs-remove-nonfc" checked style="width:15px;height:15px;">Remove NonFC</label></div>
<button id="btn-fetch-faststart" class="btn btn-primary">\u25B6 Run Fast Start</button>
<span id="faststart-status" class="meta-text"></span>
</div>
<div id="fs-window-note" style="font-size:12px;color:#666;margin-bottom:10px;min-height:16px;"></div>
<div id="faststart-content"></div>
</div></main>

<main id="tab-vrets" class="tab-content"><div class="vrets-container">
<div class="section-header"><h2>Weekly VRETs Tracker</h2>
<label style="font-size:12px;">Week <select id="vrets-week-sel" class="select-input"></select></label>
<label style="font-size:12px;">Pack Goal <input type="number" id="vrets-goal-input" class="target-input" style="width:90px;"></label>
<button id="btn-fetch-vrets" class="btn btn-primary">\u25B6 Fetch VRETs</button>
<span id="vrets-status" class="meta-text"></span></div>
<div id="vrets-content"></div>
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
<div class="settings-card"><h2>Slack Webhooks (local only)</h2>
<p class="settings-note" style="margin-top:0;">Paste the Slack workflow trigger URLs once. Stored ONLY in this browser (never in the script file), so they aren't exposed if the code is shared or pushed to GitHub. Leave blank to disable Slack posts.</p>
<div class="setting-row"><label>SOS cages</label><input type="text" id="slack-sos-url" class="select-input" placeholder="https://hooks.slack.com/triggers/\u2026" style="flex:1;min-width:280px;"></div>
<div class="setting-row"><label>Job balance</label><input type="text" id="slack-jobbalance-url" class="select-input" placeholder="https://hooks.slack.com/triggers/\u2026" style="flex:1;min-width:280px;"></div>
<button id="btn-save-slack" class="btn btn-primary">\uD83D\uDCBE Save Slack URLs</button> <span id="slack-save-note" class="settings-note" style="margin-left:8px;"></span></div>
</div></main>
`;}

// === CSS ===
function buildCSS(){return `
#sb-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:linear-gradient(160deg,#f4f8ff 0%,#eef2f8 45%,#e9eef6 100%);background-attachment:fixed;color:#000000;font-size:13px;line-height:1.4;min-height:100vh;}
.topnav{display:flex;align-items:center;justify-content:space-between;padding:6px 16px;background:#f0f0f0;border-bottom:2px solid #000;position:sticky;top:0;z-index:100;}
.topnav-left{display:flex;align-items:center;gap:14px;}.topnav-right{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.logo{font-size:20px;display:flex;align-items:center;}.site-title{font-size:15px;font-weight:700;margin:0;white-space:nowrap;color:#000;}
.nav-tabs{display:flex;gap:4px;}.nav-tab{padding:5px 12px;border:1px solid #000;background:#fff;color:#333;border-radius:4px;cursor:pointer;font-size:12px;font-weight:500;transition:background .22s ease,color .22s ease,transform .15s ease,box-shadow .22s ease;}
.nav-tab:hover{background:#e0e0e0;color:#000;transform:translateY(-1px);}
.nav-tab.active{background:#2e7d32;color:#fff;border-color:#2e7d32;box-shadow:0 2px 8px rgba(46,125,50,.4);animation:tabPop .25s ease;}
@keyframes tabPop{0%{transform:scale(.94);}60%{transform:scale(1.05);}100%{transform:scale(1);}}
@media(prefers-reduced-motion:reduce){.nav-tab.active{animation:none;}.nav-tab:hover{transform:none;}}
.select-input{padding:4px 8px;background:#fff;border:1px solid #000;color:#000;border-radius:4px;font-size:12px;}
.meta-text{font-size:11px;color:#333;}
.period-indicator{display:flex;gap:4px;}.period-dot{padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;background:#e0e0e0;color:#666;border:1px solid #000;}
.period-dot.active{background:#2e7d32;color:#fff;border-color:#2e7d32;}.period-dot.completed{background:#1565c0;color:#fff;border-color:#1565c0;}
.btn{padding:5px 10px;border:1px solid #000;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;}.btn-primary{background:#2e7d32;color:#fff;border-color:#2e7d32;}.btn-primary:hover{background:#1b5e20;}.btn-primary:disabled{opacity:.5;cursor:wait;}
/* Get Data pulses while a fetch is in flight (only during the fetch, not persistent). */
.btn-fetching{animation:btnFetchPulse 1s ease-in-out infinite;opacity:1!important;}
@keyframes btnFetchPulse{0%,100%{box-shadow:0 0 0 0 rgba(46,125,50,.5);}50%{box-shadow:0 0 0 6px rgba(46,125,50,0);}}
@media(prefers-reduced-motion:reduce){.btn-fetching{animation:none;}}
.btn-danger{background:#c62828;color:#fff;border-color:#c62828;}.btn-small{padding:3px 7px;font-size:11px;}.btn-snip{background:#6a1b9a;color:#fff;border-color:#6a1b9a;}.btn-snip:hover{background:#4a148c;}
/* Hidden tabs must take ZERO space. Use height:0/overflow:hidden in addition to display:none
   so a hidden tab can never leave a tall empty gap above the visible tab. */
.tab-content{display:none;height:0;overflow:hidden;padding:0;}
.tab-content.active{display:block;height:auto;overflow:visible;padding:10px 16px;}
.sync-layout{display:grid;grid-template-columns:1fr 520px;gap:10px;align-items:start;}
.sync-left{min-width:0;}
/* --- #1 Entrance animation: panels fade + rise in with a stagger when the board opens. --- */
@keyframes sbRise{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}
#sb-root .metrics-section,#sb-root .sync-right > *{animation:sbRise .5s cubic-bezier(.22,1,.36,1) both;}
#sb-root .sync-left .metrics-section:nth-child(1){animation-delay:.02s;}
#sb-root .sync-left .metrics-section:nth-child(2){animation-delay:.08s;}
#sb-root .sync-left .metrics-section:nth-child(3){animation-delay:.14s;}
#sb-root .sync-left .metrics-section:nth-child(4){animation-delay:.20s;}
#sb-root .sync-right > *:nth-child(1){animation-delay:.06s;}
#sb-root .sync-right > *:nth-child(2){animation-delay:.12s;}
#sb-root .sync-right > *:nth-child(3){animation-delay:.18s;}
#sb-root .sync-right > *:nth-child(4){animation-delay:.24s;}
#sb-root .sync-right > *:nth-child(5){animation-delay:.30s;}
#sb-root .sync-right > *:nth-child(n+6){animation-delay:.34s;}
/* Respect reduced-motion users: no entrance animation. */
@media(prefers-reduced-motion:reduce){#sb-root .metrics-section,#sb-root .sync-right > *{animation:none!important;}}
/* --- #4 Depth: soft gradient page background + panel sheen/shadow. --- */
#sb-root .metrics-section,#sb-root .sync-right .goal-card,#sb-root .sync-right .icqa-panel,#sb-root .sync-right .site-cplh-panel,#sb-root .sync-right .targets-panel,#sb-root .sync-right #bb-24hr-panel,#sb-root .sync-right #vret-panel{box-shadow:0 2px 10px rgba(20,40,80,.08);transition:box-shadow .2s ease,transform .2s ease;}
#sb-root .metrics-section:hover{box-shadow:0 6px 20px rgba(20,40,80,.14);}
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
/* LP rows in the Shift Plan Targets panel: read-only auto-filled LP targets, styled to read
   as reference values (blue-grey, italic) distinct from the yellow editable target inputs. */
.target-table tr.lp-row td{background:#eef3f8;}
.target-table tr.lp-row td:first-child{color:#0F4C81;font-weight:600;font-style:italic;}
.lp-val{display:inline-block;width:68px;padding:3px 5px;text-align:right;font-weight:700;color:#0F4C81;font-size:12px;}
#sb-root.dark-mode .target-table tr.lp-row td{background:#123!important;}
#sb-root.dark-mode .target-table tr.lp-row td:first-child,#sb-root.dark-mode .lp-val{color:#64b5f6!important;}
/* Dept Backlog table: manual-entry inputs, one row per direction. Compact to fit the panel. */
.dept-table th{font-size:8px;padding:2px 3px;text-align:center;}
.dept-table td{padding:2px 3px;}
.dept-input{width:52px;padding:3px 4px;background:#cfe8ff;border:1px solid #000;color:#000;border-radius:3px;font-size:11px;text-align:right;font-weight:600;}
#sb-root.dark-mode .dept-input{background:#1e3a5f!important;color:#cfe8ff!important;border-color:#777!important;}
/* View toggle (Shift Plan Targets / Current Day / Prior Day) in the panel title */
.day-toggle{font-size:11px;padding:5px 10px;border:1px solid #888;background:#eee;color:#333;cursor:pointer;font-weight:700;}
.day-toggle.active{background:#1565c0;color:#fff;border-color:#1565c0;}
/* Higher specificity (.targets-panel .day-toggle) so it beats the later ".targets-panel *"
   rule AND the generic ".btn{color:#000}" rule. Inactive AND active are both white in dark mode. */
#sb-root.dark-mode .targets-panel .day-toggle{background:#16213e!important;color:#fff!important;border-color:#555!important;}
#sb-root.dark-mode .targets-panel .day-toggle.active{background:#1565c0!important;color:#fff!important;border-color:#1565c0!important;}
/* 24hr Reporting day tables (Plan/Actual/Variance) — bigger text/cells than the target tables. */
.day-report-title{text-align:center;font-weight:700;font-size:15px;margin:4px 0 10px;color:#000;}
#sb-root.dark-mode .day-report-title{color:#fff!important;}
/* Dark mode: force white for all Shift Plan Targets panel headings/labels incl. inline-styled ones */
#sb-root.dark-mode .targets-panel h4,#sb-root.dark-mode .targets-panel .day-report-title,#sb-root.dark-mode .dept-tgt h4,#sb-root.dark-mode .sort-tgt h4{color:#fff!important;}
#sb-root.dark-mode .day-table td:first-child,#sb-root.dark-mode .day-table th{color:#fff!important;}
.day-table{font-size:14px;}
.day-table th{font-size:13px;padding:6px 10px;}
.day-table td{padding:8px 10px;font-size:14px;text-align:right;}
.day-table td:first-child,.day-table th:first-child{text-align:left;font-weight:700;}
.day-table td:not(:first-child),.day-table th:not(:first-child){text-align:right;}
.day-table tr.day-gap td{border:none;height:8px;padding:0;}
#sb-root.dark-mode .day-table td,#sb-root.dark-mode .day-table th{color:#e0e0e0!important;border-color:#444!important;}
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
.goal-progress-bar{height:100%;border-radius:2px;transition:width .9s cubic-bezier(.22,1,.36,1);position:relative;overflow:hidden;}
/* moving sheen on the goal bars for a little life */
.goal-progress-bar::after{content:"";position:absolute;top:0;left:0;height:100%;width:40px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.45),transparent);animation:goalBarSheen 2.6s linear infinite;}
@keyframes goalBarSheen{0%{transform:translateX(-40px);}100%{transform:translateX(360px);}}
@media(prefers-reduced-motion:reduce){.goal-progress-bar::after{animation:none;display:none;}}
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
.metrics-section.sort-section{border-left:4px solid #000;}
/* SYNC Actions is the primary panel: thicker accent, tinted header bar, raised shadow. */
.metrics-section.actions-section{border:2px solid #146EB4;border-left:6px solid #146EB4;box-shadow:0 2px 10px rgba(20,110,180,0.18);}
.metrics-section.actions-section .section-header{background:#146EB4;margin:-14px -18px 10px -18px;padding:9px 16px;border-radius:2px 2px 0 0;}
.metrics-section.actions-section .section-header h2{color:#fff;font-size:15px;}
#action-required-banner{margin:0 0 10px 0;padding:9px 14px;border-radius:5px;font-weight:700;font-size:13px;display:flex;align-items:center;gap:8px;}
#action-required-banner.ar-alert{background:#fdecea;border:1px solid #c62828;color:#8e1a1a;}
#action-required-banner.ar-clear{background:#e8f5e9;border:1px solid #2e7d32;color:#1b5e20;}
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
.hourly-section.ob-flow-hourly{border-left:4px solid #e65100;}
.hourly-section.ib-flow-hourly{border-left:4px solid #1565c0;}
/* OB Flow table: hours as rows, centered cells, light zebra striping (Hour + Cartons Pick tinted) */
.flow-table{border-collapse:collapse;width:100%;}
.flow-table th,.flow-table td{padding:9px 12px;text-align:center;font-size:12.5px;border-bottom:1px solid #e0e0e0;white-space:nowrap;}
.flow-table th{background:#f5f5f5;font-weight:700;border-bottom:2px solid #ccc;}
.flow-table tbody tr:nth-child(even){background:#fafafa;}
.flow-table td:nth-child(2){background:rgba(255,243,224,0.55);}
#sb-root.dark-mode .flow-table th{background:#12294d!important;border-color:#444!important;}
#sb-root.dark-mode .flow-table td{border-color:#333!important;}
#sb-root.dark-mode .flow-table tbody tr:nth-child(even){background:#123055!important;}
#sb-root.dark-mode .flow-table td:nth-child(2){background:#1a3a2e!important;}
/* Fast Start Tracker */
.faststart-container{padding:4px 0;}
.faststart-section{background:#fff;border:2px solid #000;border-radius:4px;padding:12px 16px;margin-bottom:10px;border-left:4px solid #146EB4;}
.faststart-section h3{font-size:13px;font-weight:700;margin-bottom:8px;}
.fs-summary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;}
.fs-card{background:#fff;border:2px solid #e0e0e0;border-radius:8px;padding:14px 16px;}
.fs-card-title{font-weight:700;color:#232F3E;border-bottom:2px solid #146EB4;padding-bottom:6px;margin-bottom:10px;font-size:14px;}
.fs-metric{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;margin-bottom:5px;}
.fs-metric-label{color:#666;font-size:11px;text-transform:uppercase;letter-spacing:.03em;}
.fs-metric-val{font-size:20px;font-weight:700;}
.fs-detail-table{width:100%;border-collapse:collapse;font-size:13px;}
.fs-detail-table th{background:#f0f0f0;padding:7px 8px;text-align:left;border-bottom:1px solid #ccc;}
.fs-detail-table td{padding:7px 8px;border-bottom:1px solid #eee;}
/* Fast Start row status (over goal / within goal) - class-based so dark mode can recolor them. */
.fs-row-over{background:#ffebee;}
.fs-row-ok{background:#e8f5e9;}
#sb-root.dark-mode .fs-row-over td{background:#4a1f28!important;color:#ffd9df!important;}
#sb-root.dark-mode .fs-row-ok td{background:#163a2a!important;color:#c9f3dc!important;}
#sb-root.dark-mode .faststart-section{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .faststart-section h3{color:#e0e0e0!important;}
#sb-root.dark-mode .fs-card{background:#16213e!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .fs-detail-table th{background:#1a1a3a!important;color:#e0e0e0!important;border-color:#444!important;}
#sb-root.dark-mode .fs-detail-table td{color:#e0e0e0!important;border-color:#333!important;}
/* Fast Start control bar + inputs + summary cards + status/notes */
#sb-root.dark-mode .fs-controls{background:#0f3460!important;border-color:#444!important;}
#sb-root.dark-mode .fs-controls label{color:#e0e0e0!important;}
#sb-root.dark-mode .fs-summary-grid .fs-card,#sb-root.dark-mode .fs-card .fs-card{background:#16213e!important;}
#sb-root.dark-mode #fs-window-note,#sb-root.dark-mode #faststart-status{color:#aab4c4!important;}
#sb-root.dark-mode .faststart-container input[type="number"],#sb-root.dark-mode .faststart-container input[type="text"],#sb-root.dark-mode .faststart-container input[type="datetime-local"]{background:#1a1a2e!important;color:#e0e0e0!important;border-color:#555!important;}
/* Settings tab: cards, tables, schedule inputs, config/slack panels */
#sb-root.dark-mode .settings-card{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;box-shadow:0 3px 14px rgba(0,0,0,.35)!important;}
#sb-root.dark-mode .settings-card h2{color:#e0e0e0!important;}
#sb-root.dark-mode .settings-table th,#sb-root.dark-mode .settings-table td{color:#e0e0e0!important;border-color:#444!important;}
#sb-root.dark-mode .sched-input{background:#1a1a2e!important;color:#ffd740!important;border-color:#555!important;}
#sb-root.dark-mode .settings-note{color:#aab4c4!important;}
/* EOS Wash */
.eoswash-container{padding:4px 0;}
.eoswash-section{background:#fff;border:2px solid #000;border-radius:4px;padding:12px 16px;margin-bottom:10px;}
.eoswash-section h3{font-size:13px;font-weight:700;margin-bottom:8px;}
.eoswash-section.ib-eos{border-left:4px solid #1565c0;}
.eoswash-section.da-eos{border-left:4px solid #e65100;}
/* Color-coded EOS Wash process sections: Inbound=blue, Outbound=orange, Support/Throughput=purple */
.eoswash-section.eos-ib-section{border:3px solid #1565c0;}
.eoswash-section.eos-ib-section h3{color:#1565c0;}
.eoswash-section.eos-da-section{border:3px solid #e65100;}
.eoswash-section.eos-da-section h3{color:#e65100;}
.eoswash-section.eos-support-section{border:3px solid #7b1fa2;}
.eoswash-section.eos-support-section h3{color:#7b1fa2;}
/* Safety Summary = green section (border + heading + soft green fill). */
.eoswash-section.eos-safety-section{border:3px solid #2e7d32;background:#eef7ee;}
.eoswash-section.eos-safety-section h3{color:#2e7d32;}
#sb-root.dark-mode .eoswash-section.eos-safety-section{background:#17351c!important;border-color:#2e7d32!important;}
#sb-root.dark-mode .eoswash-section.eos-safety-section h3{color:#81c784!important;}
.eoswash-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
@media(max-width:1100px){.eoswash-grid{grid-template-columns:1fr;}}
.eos-accuracy-table td,.eos-accuracy-table th{padding:4px 10px;text-align:right;border-bottom:1px solid #ccc;}
.eos-accuracy-table td:first-child,.eos-accuracy-table th:first-child{text-align:left;font-weight:700;}
.eos-input{width:80px;padding:3px 5px;background:#ffffcc;border:1px solid #000;color:#000;border-radius:3px;font-size:12px;text-align:right;font-weight:700;-moz-appearance:textfield;}
.eos-input::-webkit-outer-spin-button,.eos-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
/* Section-color tint on the DATA columns (Process Path, Volume, Hours, Rate) of the EOS Wash
   process tables, matching the reference Excel. The comparison/variance columns on the right
   (% to LP, % to Daily Plan, Hours Variance) keep their own conditional good/warn/bad coloring,
   and the Bridge column keeps its yellow note box, so we only tint columns 1-4.
   Volume table (eos-vol-table) is 8 columns: 1 Process Path | 2 Volume | 3 Hours | 4 Rate |
   5 % to LP | 6 % to Daily Plan | 7 Hours Variance | 8 Bridge. Tint 1-4 only.
   NOTE: these are plain tbody data rows; the conditional cells (5-7) set an inline background via
   bg()/varBg() which overrides CSS, so even if a rule reached them the conditional color wins —
   but we scope to nth-child(-n+4) to be safe and leave the yellow Bridge (8) alone. */
.eoswash-section.eos-ib-section .eos-vol-table tbody td:nth-child(-n+4){background:#dbe7f6;}
.eoswash-section.eos-da-section .eos-vol-table tbody td:nth-child(-n+4){background:#fbe3cf;}
/* Support sub-table (eos-support-table) is 4 columns: 1 Process Path | 2 Hours |
   3 Hours Variance | 4 Bridge. Tint only Process Path + Hours (1-2); leave Hours Variance (3)
   conditional and Bridge (4) yellow. IB support = blue tint, DA support = orange tint. */
.eoswash-section.eos-ib-section .eos-support-table tbody td:nth-child(-n+2){background:#dbe7f6;}
.eoswash-section.eos-da-section .eos-support-table tbody td:nth-child(-n+2){background:#fbe3cf;}
/* SITE INDIRECT / THROUGHPUT (purple) section: its support table + the THROUGHPUT total row. */
.eoswash-section.eos-support-section .eos-support-table tbody td:nth-child(-n+2){background:#ece3f3;}
.eoswash-section.eos-support-section .eos-vol-table tbody td:nth-child(-n+4){background:#ece3f3;}
/* Dark-mode tints (muted so text stays readable). */
#sb-root.dark-mode .eoswash-section.eos-ib-section .eos-vol-table tbody td:nth-child(-n+4),#sb-root.dark-mode .eoswash-section.eos-ib-section .eos-support-table tbody td:nth-child(-n+2){background:#1b3a5c!important;color:#e0e0e0!important;}
#sb-root.dark-mode .eoswash-section.eos-da-section .eos-vol-table tbody td:nth-child(-n+4),#sb-root.dark-mode .eoswash-section.eos-da-section .eos-support-table tbody td:nth-child(-n+2){background:#5c3a1b!important;color:#e0e0e0!important;}
#sb-root.dark-mode .eoswash-section.eos-support-section .eos-vol-table tbody td:nth-child(-n+4),#sb-root.dark-mode .eoswash-section.eos-support-section .eos-support-table tbody td:nth-child(-n+2){background:#3a2b50!important;color:#e0e0e0!important;}
/* Thicker rows in the EOS Wash tables for readability */
.eoswash-section .metrics-table td,.eoswash-section .metrics-table th{padding:11px 10px;font-size:12.5px;}
.eoswash-section .metrics-table .eos-manual{padding:6px 6px;font-size:12px;}
.eoswash-section .metrics-table td:last-child{min-width:240px;width:260px;}
.eos-bridge-ta{min-height:38px;line-height:1.3;overflow:hidden;background:#ffffcc!important;color:#000!important;}
#sb-root.dark-mode .eos-bridge-ta{background:#fff3b0!important;color:#000!important;border-color:#777!important;}
/* Support/indirect sub-group within an IB/OB section: compact, visually set off from the
   volume table above it so hours-only paths read as a distinct block (no blank Volume/Rate cells). */
.eos-support-label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:#777;margin:12px 0 4px 2px;}
.eos-support-table{opacity:.95;}
.eos-support-table th,.eos-support-table td{background:rgba(0,0,0,0.02);}
#sb-root.dark-mode .eos-support-label{color:#9aa7b8;}
#sb-root.dark-mode .eos-support-table th,#sb-root.dark-mode .eos-support-table td{background:rgba(255,255,255,0.03)!important;}
/* VRETs tab */
.vrets-container{padding:4px 0;}
.vrets-kpis{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px;}
.vrets-kpi{background:#fff;border:2px solid #000;border-radius:6px;padding:12px 14px;text-align:center;}
.vrets-kpi .k-label{font-size:11px;color:#555;font-weight:700;}
.vrets-kpi .k-val{font-size:26px;font-weight:800;margin-top:4px;}
.vrets-kpi .k-sub{font-size:11px;color:#555;margin-top:4px;}
.vrets-section{background:#fff;border:2px solid #000;border-radius:4px;padding:12px 16px;margin-bottom:10px;border-left:4px solid #e65100;}
.vrets-section h3{font-size:13px;font-weight:700;margin-bottom:8px;}
.vrets-section .metrics-table td,.vrets-section .metrics-table th{padding:8px 10px;font-size:12.5px;}
.vrets-bar{position:relative;background:#e0e0e0;border-radius:3px;height:8px;overflow:hidden;margin-top:6px;}
.vrets-bar>div{height:100%;background:#22c55e;border-radius:3px;}
#sb-root.dark-mode .vrets-kpi,#sb-root.dark-mode .vrets-section{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .vrets-kpi .k-label,#sb-root.dark-mode .vrets-kpi .k-sub,#sb-root.dark-mode .vrets-section h3{color:#e0e0e0!important;}
#sb-root.dark-mode .vrets-section .metrics-table th,#sb-root.dark-mode .vrets-section .metrics-table td{color:#e0e0e0!important;border-color:#444!important;}
/* Compact VRETs panel (Sync tab) dark-mode: readable badge + darker progress track */
#sb-root.dark-mode #vret-panel h3 span{background:#5a3a00!important;color:#ffcc80!important;}
#sb-root.dark-mode .vrets-bar{background:#2a2a45!important;}
/* Dark Mode */
#sb-root.dark-mode{background:radial-gradient(1200px 600px at 20% -10%,#243a66 0%,#1a1a2e 55%,#15152a 100%)!important;background-attachment:fixed!important;color:#e0e0e0!important;}
#sb-root.dark-mode .topnav{background:#16213e!important;border-color:#333!important;}
#sb-root.dark-mode .metrics-section,#sb-root.dark-mode .goal-card,#sb-root.dark-mode .site-cplh-panel,#sb-root.dark-mode .icqa-panel,#sb-root.dark-mode .targets-panel,#sb-root.dark-mode .chart-card,#sb-root.dark-mode .hourly-section,#sb-root.dark-mode #bb-24hr-panel,#sb-root.dark-mode #vret-panel{background:#0f3460!important;border-top-color:#444!important;border-right-color:#444!important;border-bottom-color:#444!important;color:#e0e0e0!important;box-shadow:0 3px 14px rgba(0,0,0,.35)!important;}
/* Preserve the colored LEFT accent borders on the IB/OB/sort panels in dark mode (the generic
   dark-mode border-color above must NOT override these). Sort = black per spec. */
#sb-root.dark-mode .metrics-section.ib-section{border-left:4px solid #1565c0!important;}
#sb-root.dark-mode .metrics-section.ob-section{border-left:4px solid #e65100!important;}
#sb-root.dark-mode .metrics-section.sort-section{border-left:4px solid #000!important;}
#sb-root.dark-mode .metrics-section.actions-section{border-left:6px solid #146EB4!important;}
#sb-root.dark-mode .metrics-table th,#sb-root.dark-mode .metrics-table td,#sb-root.dark-mode .target-table td,#sb-root.dark-mode .target-table th,#sb-root.dark-mode .day-table th,#sb-root.dark-mode .dept-table th,#sb-root.dark-mode .actions-table th,#sb-root.dark-mode .actions-table td{color:#e0e0e0!important;border-color:#444!important;}
#sb-root.dark-mode .metrics-table td{border-bottom-color:#333!important;}
#sb-root.dark-mode .section-header h2,#sb-root.dark-mode .bold,#sb-root.dark-mode h3,#sb-root.dark-mode h4,#sb-root.dark-mode .panel-title,#sb-root.dark-mode .site-title{color:#e0e0e0!important;}
#sb-root.dark-mode .target-input,#sb-root.dark-mode .actions-table input,#sb-root.dark-mode .actions-table textarea,#sb-root.dark-mode .actions-table select,#sb-root.dark-mode .select-input{background:#1a1a2e!important;color:#e0e0e0!important;border-color:#555!important;}
#sb-root.dark-mode .goal-title{color:#ccc!important;}
#sb-root.dark-mode .goal-stats,#sb-root.dark-mode .goal-stats strong{color:#e0e0e0!important;}
#sb-root.dark-mode .fclm-timestamp,#sb-root.dark-mode .meta-text{color:#aaa!important;}
#sb-root.dark-mode .row-target td{background:rgba(255,235,59,0.15)!important;}
#sb-root.dark-mode .row-sync td{}
#sb-root.dark-mode .goal-progress{background:#333!important;}
#sb-root.dark-mode .nav-tab{color:#aaa!important;background:#1a1a2e!important;}
#sb-root.dark-mode .nav-tab.active{color:#fff!important;background:#2e7d32!important;}
#sb-root.dark-mode .shift-timeline{background:#333!important;}
#sb-root.dark-mode .timeline-hour{background:#1a1a2e!important;color:#aaa!important;}
#sb-root.dark-mode .pace-insight{color:#ccc!important;border-color:#444!important;}
#sb-root.dark-mode .tg-compact h4{color:#64b5f6!important;}
#sb-root.dark-mode .metrics-table td[style*="background"]{color:#fff!important;}
/* Dark mode: make conditional-format cell colors SOLID (not transparent) so they read
   clearly on the dark board. Light mode is unaffected. */
#sb-root.dark-mode .metrics-table td[style*="rgba(52,211,153"]{background:#1b8a4a!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(251,191,36"]{background:#c77d00!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(220,38,38"]{background:#c62828!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(46,125,50"]{background:#1b8a4a!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(230,81,0"]{background:#c77d00!important;color:#fff!important;}
/* Dark-mode conditional-format fills. The cfColors()/cfDensityColors() helpers paint cells with
   translucent rgba backgrounds tuned for a WHITE page; on the dark board those near-transparent
   fills are invisible. Map each translucent bg to a solid, readable dark-mode color with white
   text. Covers CPLH/rate (cfColors) and density (cfDensityColors), good/warn/bad. */
/* CPLH & Rate - good=rgba(52,211,153,0.15) warn=rgba(251,191,36,0.1) bad=rgba(220,38,38,0.12) */
#sb-root.dark-mode .metrics-table td[style*="rgba(52,211,153"]{background:#1b8a4a!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(251,191,36"]{background:#c77d00!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(220,38,38"]{background:#d32f2f!important;color:#fff!important;}
/* Density - good=rgba(46,125,50,0.12) warn=rgba(230,81,0,0.1) bad=rgba(198,40,40,0.1) */
#sb-root.dark-mode .metrics-table td[style*="rgba(46,125,50"]{background:#1b8a4a!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(230,81,0"]{background:#c77d00!important;color:#fff!important;}
#sb-root.dark-mode .metrics-table td[style*="rgba(198,40,40"]{background:#c62828!important;color:#fff!important;}
#sb-root.dark-mode .row-rate td,#sb-root.dark-mode .row-fast td{color:#ffab40!important;}
#sb-root.dark-mode .pct-good{color:#69f0ae!important;}
#sb-root.dark-mode .pct-warn{color:#ffd740!important;}
#sb-root.dark-mode .pct-bad{color:#ff5252!important;}
#sb-root.dark-mode span[style*="color"]{color:inherit!important;}
/* New-Hire LC Loss figure color (class-based so the dark span[style*=color] rule can't flatten it). */
.lc-loss-bad{color:#c0392b;}
.lc-loss-good{color:#2e7d32;}
#sb-root.dark-mode .lc-loss-bad{color:#ff5252!important;}
#sb-root.dark-mode .lc-loss-good{color:#69f0ae!important;}
#sb-root.dark-mode .table-input{background:#1a1a2e!important;color:#ffd740!important;border-color:#666!important;}
#sb-root.dark-mode .goal-card *,#sb-root.dark-mode .site-cplh-panel *,#sb-root.dark-mode .icqa-panel *,#sb-root.dark-mode .targets-panel *,#sb-root.dark-mode #bb-24hr-panel *,#sb-root.dark-mode #vret-panel *{color:#e0e0e0!important;}
#sb-root.dark-mode .goal-card .pct-good,#sb-root.dark-mode .targets-panel .pct-good,#sb-root.dark-mode .icqa-panel .pct-good{color:#69f0ae!important;}
#sb-root.dark-mode .goal-card .pct-warn,#sb-root.dark-mode .targets-panel .pct-warn,#sb-root.dark-mode .icqa-panel .pct-warn{color:#ffd740!important;}
#sb-root.dark-mode .goal-card .pct-bad,#sb-root.dark-mode .targets-panel .pct-bad,#sb-root.dark-mode .icqa-panel .pct-bad{color:#ff5252!important;}
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
/* Hourly tab dark-mode: force the section boxes and every cell dark, matching the Sync tab. */
#sb-root.dark-mode .hourly-container,#sb-root.dark-mode .hourly-section{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .hourly-section h3{color:#e0e0e0!important;}
#sb-root.dark-mode .hourly-section .metrics-table th,#sb-root.dark-mode .hourly-section .metrics-table td{color:#e0e0e0!important;border-color:#444!important;}
/* Dark-mode Flow section distinction: keep the blue (IB) / orange (OB) accent borders
   (the blanket .hourly-section border-color:#444 above would otherwise flatten them),
   thicken them, and add a matching full outline + tinted header so IB vs OB read clearly. */
#sb-root.dark-mode .hourly-section.ib-flow-hourly{border:2px solid #2a6fc0!important;border-left:6px solid #4a9eff!important;}
#sb-root.dark-mode .hourly-section.ob-flow-hourly{border:2px solid #b85c1a!important;border-left:6px solid #ff9800!important;}
#sb-root.dark-mode .ib-flow-hourly h3{color:#7ab8ff!important;}
#sb-root.dark-mode .ob-flow-hourly h3{color:#ffb74d!important;}
#sb-root.dark-mode .ib-flow-hourly .flow-table th{background:#123a63!important;color:#cfe4ff!important;}
#sb-root.dark-mode .ob-flow-hourly .flow-table th{background:#4a2e14!important;color:#ffe0b8!important;}
/* Hourly SOS cage bar dark-mode */
#sb-root.dark-mode .sos-bar{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .sos-bar strong,#sb-root.dark-mode .sos-bar label,#sb-root.dark-mode .sos-bar span{color:#e0e0e0!important;}
/* Flow table (own .flow-table styling, NOT .metrics-table) so inline green/red cell colors survive dark mode. */
#sb-root.dark-mode .flow-table td,#sb-root.dark-mode .flow-table th{color:#e0e0e0;}
/* EOS Wash dark-mode */
#sb-root.dark-mode .eoswash-section{background:#0f3460!important;border-color:#444!important;color:#e0e0e0!important;}
#sb-root.dark-mode .eoswash-section h3{color:#e0e0e0!important;}
#sb-root.dark-mode .eoswash-section .metrics-table th,#sb-root.dark-mode .eoswash-section .metrics-table td{color:#e0e0e0!important;border-color:#444!important;}
#sb-root.dark-mode .eos-input,#sb-root.dark-mode .eos-manual{background:#4a4a1f!important;color:#ffe082!important;border-color:#777!important;}
/* Keep the colored section headings vivid in dark mode */
#sb-root.dark-mode .eos-ib-section h3{color:#64b5f6!important;}
#sb-root.dark-mode .eos-da-section h3{color:#ffab40!important;}
#sb-root.dark-mode .eos-support-section h3{color:#ce93d8!important;}
#sb-root.dark-mode .eos-ib-section{border-color:#1565c0!important;}
#sb-root.dark-mode .eos-da-section{border-color:#e65100!important;}
#sb-root.dark-mode .eos-support-section{border-color:#9c27b0!important;}
`;}

// === HOURLY TAB ===
async function fetchHourlyData(){
    const config=loadConfig();
    const site=config.site;
    const sched=config.shiftType==='Nights'?config.nights:config.days;
    const {startDate}=getShiftDates(config);
    const statusEl=document.getElementById('hourly-status');
    const btn=document.getElementById('btn-fetch-hourly');
    // Guard: never throw if the button/status aren't found (that would abort the whole fetch).
    if(btn){btn.disabled=true;btn.textContent='\u23F3 Fetching...';}
    if(statusEl)statusEl.textContent='Fetching hourly data...';
    // Show an immediate visible message inside the panel so the user always sees feedback.
    const tablesEl=document.getElementById('hourly-tables');
    if(tablesEl)tablesEl.innerHTML='<div style="padding:20px;font-size:14px;color:inherit;">\u23F3 Fetching hourly data\u2026</div>';

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

    // Fetch each hour in parallel (same as fetchPeriod). Wall Builder HC comes FROM the OB Dock
    // (1003021) report itself (parseFnRollup.wallBuilderHC counts AAs under the Wall Builder
    // function) — no separate fetch needed.
    try{
        const results=await Promise.all(hours.map(hr=>fetchPeriod(site,startDate,hr)));
        const hourlyData=results.map((raw,i)=>{
            const stow=raw.stow||{},pStow=raw.palletStow||{},pick=raw.pick||{},obDock=raw.obDock||{},sort=raw.sort||{},ppr=raw.ppr||{},rsr=raw.rsr||{},toFluid=raw.toFluidLoad||{},toDock=raw.toDock||{};
            // OB loaded volume (cases) = TO Fluid Load jobs + Transfer Out Dock pallet cases (split
            // reports). Fall back to the legacy single obDock report if neither returned anything.
            const obLoaded=((toFluid.jobs||0)+(toDock.caseUnits||0))||(obDock.fluidLoadJobs||0);
            const obLoadedRate=toFluid.jph||obDock.fluidCaseJPH||0;
            const obLoadedHC=((toFluid.headcount||0)+(toDock.headcount||0))||obDock.headcount||0;
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
                ib:{totalStow:ibU,stowUnits:stow.totalUnits||0,palletUnits:pStow.totalUnits||0,rate:stow.rate||0,rsrRate:rsr.rate||0,
                    // Flow view fields (new IB hourly style): received vs stowed balance.
                    rsrVol:rsr.totalUnits||0,          // Cases Received = RSR/IDRT support volume
                    rsrHC:rsr.headcount||0,            // Receive HC (active AAs receiving)
                    stowHC:stow.headcount||0,          // Stow HC (active AAs stowing)
                    directHours:ibDH,indirectHours:ibIndirect,totalHours:ibTotalHrs,directPct:ibTotalHrs>0?(ibDH/ibTotalHrs)*100:0,indirectPct:ibTotalHrs>0?(ibIndirect/ibTotalHrs)*100:0,cplh:cplhHrs>0?ibU/cplhHrs:0,pctToOP:(ppr.ibPlannedHrs||0)>0?(ibTotalHrs/ppr.ibPlannedHrs)*100:0},
                ob:{pickUnits:pick.totalUnits||0,loadedUnits:obLoaded,pickRate:pick.rate||0,directHours:obPickDH,indirectHours:obIndirect,totalHours:daHrs,directPct:daHrs>0?(obPickDH/daHrs)*100:0,indirectPct:daHrs>0?(obIndirect/daHrs)*100:0,cplh:daHrs>0?obLoaded/daHrs:0,pctToOP:(ppr.daTransferPlan||0)>0?(daHrs/ppr.daTransferPlan)*100:0,
                    // Flow view fields (new OB hourly style)
                    pickHC:pick.headcount||0,               // active AAs in Transfer Out Pick this hour
                    loadedHC:obLoadedHC,                     // active AAs on the dock this hour (TO Fluid Load + Dock)
                    wallBuilderHC:obDock.wallBuilderHC||0,   // Wall Builder HEADCOUNT (# AAs) from OB Dock report
                    loadedRate:obLoadedRate},                // Loaded Cartons Rate = TO Fluid Load JPH
                sort:{totalUnits:sort.totalUnits||0,rate:sort.rate||0,directHours:sort.directHours||0,cplh:(sort.directHours||0)>0?sort.totalUnits/sort.directHours:0}
            };
        });
        renderHourlyTables(hourlyData,totalHours);
        if(statusEl)statusEl.textContent='\u2713 Updated '+new Date().toLocaleTimeString();
    }catch(err){
        console.error('Hourly fetch failed:',err);
        if(statusEl)statusEl.textContent='\u26A0 '+err.message;
        // Surface the error inside the panel so it's visible without opening the console.
        const te=document.getElementById('hourly-tables');
        if(te)te.innerHTML='<div style="padding:20px;font-size:14px;color:#c62828;">\u26A0 Hourly fetch failed: '+(err&&err.message?err.message:err)+'<br><br>If this says a network/CORS error, your FCLM session likely expired \u2014 reload the page (F5) to re-authenticate, then try again.</div>';
    }finally{if(btn){btn.disabled=false;btn.textContent='\u25B6 Fetch Hourly';}}
}

function renderHourlyTables(hourlyData,totalHours){
    const container=document.getElementById('hourly-tables');if(!container)return;
    // Remember the data so the dark/day toggle can re-render colors without re-fetching.
    currentHourly={data:hourlyData,totalHours:totalHours};
    const config=loadConfig();
    // Sort table still uses goal/per-hour target for its cumulative "Sync Metrics" row.
    const sortGoal=parseFloat(document.getElementById('sort-goal')?.value)||0;
    const sortPerHr=sortGoal>0?Math.round(sortGoal/totalHours):0;

    function condBg(actual,target){if(!actual||actual<=0||!target||target<=0)return'';return actual>=target?'background:rgba(46,125,50,0.12)':actual>=target*0.9?'background:rgba(230,81,0,0.1)':'background:rgba(198,40,40,0.1)';}
    function fv(v,d=0){if(!v||isNaN(v)||v===0)return'';return Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});}
    function actTarget(actual,target,decimals=0){const a=fv(actual,decimals);const t=fv(target,decimals);if(!a&&!t)return'';if(!t)return a;if(!a)return'— / '+t;return a+' / '+t;}

    // Headers
    const headers=hourlyData.map(h=>'<th>'+h.label+'</th>').join('');
    const totalHeader='<th>Total</th>';

    // Cumulative Sorted total for the Sort table's running "Sync Metrics" row.
    let sortCum=0;const sortCums=[];
    hourlyData.forEach(h=>{sortCum+=h.sort.totalUnits;sortCums.push(sortCum);});

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

    function bucketLabel(b){return b==='healthy'?'Healthy':b==='warning'?'Warning':b==='critical'?'Critical':'\u2014';}
    // Runway text for a status cell tooltip.
    function runwayTxt(cases,rate){if(!(rate>0))return cases>0?'\u221E (nothing clearing)':'0';const hh=cases/rate;return hh<1?Math.round(hh*60)+'m':hh.toFixed(1)+'h';}
    // Status rendered as a tinted chip so Healthy/Warning/Critical pop in BOTH themes
    // (dark mode gets a solid pill; light mode a soft tint). tip = optional title attr.
    function statusBadge(bucket,dk,tip){
        if(!bucket)return `<td style="color:#888;"${tip||''}>\u2014</td>`;
        const map=dk
            ?{healthy:['#0f5132','#69f0ae'],warning:['#5a3a00','#ffcc80'],critical:['#5c1a1a','#ff8a80']}
            :{healthy:['#e8f5e9','#1b5e20'],warning:['#fff3e0','#e65100'],critical:['#ffebee','#b71c1c']};
        const [bg,fg]=map[bucket];
        // color/background use !important so the snip's blanket color-override style can't wash
        // the pill out (html2canvas honors inline !important over author !important rules).
        return `<td${tip||''}><span style="display:inline-block;padding:2px 10px;border-radius:10px;background:${bg}!important;color:${fg}!important;font-weight:700;font-size:11.5px;">${bucketLabel(bucket)}</span></td>`;
    }

    // ---- OB "Flow" hourly table (hours as rows). Status = runway/backlog health. ----
    // Flow Balance = Loaded Cartons / Cartons Pick (%). Deviation = |Balance-100|.
    // Cages on Dock = running (picked - loaded)/density seeded from saved OB SOS. Status:
    // outbound backlog HIGH = bad (<1.5h Healthy, 1.5-2h Warning, >=2h Critical).
    function buildOBFlowTable(){
        const dk=document.getElementById('sb-root')?.classList.contains('dark-mode');
        const GREEN=dk?'#69f0ae':'#2e7d32',RED=dk?'#ff5252':'#c62828';
        const site=(config.site||'').toUpperCase();
        const obRec=getSosRecord(site,'OB');
        const density=(obRec&&obRec.density>0)?obRec.density:flowCageDensity(site,'load');
        const seed=obRec?obRec.cages:0;
        // Walk cages on dock (picked adds, loaded clears).
        if(density>0)walkCages(hourlyData.map(h=>h.ob),'pickUnits','loadedUnits',seed,density,'cages');
        const cols=['Hour','Cartons Pick','Loaded Cartons','Difference','Cages on Dock','Cartons Pick HC','Cartons Pick Rate','Loaded Cartons HC','Loaded Cartons Rate','Flow Balance','Flow Deviation','Status'];
        const head='<tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
        const rows=hourlyData.map(h=>{
            const o=h.ob;
            const pick=o.pickUnits||0,loaded=o.loadedUnits||0;
            const diff=pick-loaded;
            const balance=pick>0?(loaded/pick*100):0;
            const deviation=balance>0?Math.abs(balance-100):0;
            const balColor=balance>=100?GREEN:RED;
            const hasFlow=(pick>0||loaded>0);
            // Clear rate = per-associate load rate (Loaded Cartons Rate = Fluid Load - Case JPH).
            const clearRate=o.loadedRate||0;
            const casesOnDock=(density>0&&o.cages!=null)?o.cages*density:null;
            const bucket=(density>0)?dockHealthBucket(casesOnDock,clearRate,'load',hasFlow):(hasFlow?(balance>=100?'healthy':'warning'):null);
            const cagesTxt=(density>0&&o.cages!=null)?Math.round(o.cages).toLocaleString():'\u2014';
            const cagesColor=(o.cages!=null&&o.cages<=0)?GREEN:(dk?'#e0e0e0':'#155724');
            const rwTip=casesOnDock!=null?(' title="'+runwayTxt(casesOnDock,clearRate)+' of backlog on dock"'):'';
            return `<tr>
                <td style="text-align:left;font-weight:600;">${h.label}</td>
                <td>${fv(pick)}</td>
                <td>${fv(loaded)}</td>
                <td style="color:${diff>=0?GREEN:RED}!important;font-weight:600;">${pick||loaded?fv(diff):''}</td>
                <td style="color:${cagesColor}!important;font-weight:700;">${cagesTxt}</td>
                <td>${o.pickHC>0?fv(o.pickHC,2):'\u2014'}</td>
                <td>${o.pickRate>0?fv(o.pickRate,1):'\u2014'}</td>
                <td>${o.loadedHC>0?fv(o.loadedHC,2):'\u2014'}</td>
                <td>${o.loadedRate>0?fv(o.loadedRate,1):'\u2014'}</td>
                <td style="color:${balColor}!important;font-weight:700;">${balance>0?balance.toFixed(1)+'%':'\u2014'}</td>
                <td style="color:${balColor}!important;font-weight:600;">${balance>0?deviation.toFixed(1)+'%':'\u2014'}</td>
                ${statusBadge(bucket,dk,rwTip)}
            </tr>`;
        }).join('');
        return `<section class="hourly-section ob-flow-hourly"><h3>OUTBOUND | Flow (Hourly)</h3><div style="overflow-x:auto;"><table class="flow-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div></section>`;
    }

    // ---- IB "Flow" hourly table (hours as rows). Status = runway health. ----
    // Cases Received = RSR/IDRT support volume; Cases Stowed = Case Transfer In.
    // Flow Balance = Cases Stowed / Cases Received. Cages on Dock = running (received - stowed)/
    // density seeded from saved IB SOS. Status: inbound runway LOW = bad (>=1h Healthy,
    // 30-59m Warning, <=29m/empty Critical). Clear rate = whole stow team's throughput (cases stowed).
    function buildIBFlowTable(){
        const dk=document.getElementById('sb-root')?.classList.contains('dark-mode');
        const GREEN=dk?'#69f0ae':'#2e7d32',RED=dk?'#ff5252':'#c62828';
        const site=(config.site||'').toUpperCase();
        const ibRec=getSosRecord(site,'IB');
        const density=(ibRec&&ibRec.density>0)?ibRec.density:flowCageDensity(site,'stow');
        const seed=ibRec?ibRec.cages:0;
        if(density>0)walkCages(hourlyData.map(h=>h.ib),'rsrVol','stowUnits',seed,density,'cages');
        const cols=['Hour','Cases Received','Cases Stowed','Difference','Cages on Dock','Receive HC','RSR (Receive Rate)','Stow HC','Stow Rate','Flow Balance','Flow Deviation','Status'];
        const head='<tr>'+cols.map(c=>`<th>${c}</th>`).join('')+'</tr>';
        const rows=hourlyData.map(h=>{
            const b=h.ib;
            const received=b.rsrVol||0,stowed=b.stowUnits||0;
            const diff=received-stowed;
            const balance=received>0?(stowed/received*100):0;
            const deviation=balance>0?Math.abs(balance-100):0;
            const balColor=balance>=100?GREEN:RED;
            const hasFlow=(received>0||stowed>0);
            // Clear rate = whole stow team's throughput that hour (Cases Stowed).
            const clearRate=stowed;
            const casesOnDock=(density>0&&b.cages!=null)?b.cages*density:null;
            const bucket=(density>0)?dockHealthBucket(casesOnDock,clearRate,'stow',hasFlow):(hasFlow?(balance>=100?'healthy':'warning'):null);
            const cagesTxt=(density>0&&b.cages!=null)?Math.round(b.cages).toLocaleString():'\u2014';
            const cagesColor=(b.cages!=null&&b.cages<=0)?RED:(dk?'#e0e0e0':'#155724');
            const rwTip=casesOnDock!=null?(' title="'+runwayTxt(casesOnDock,clearRate)+' of runway on dock"'):'';
            return `<tr>
                <td style="text-align:left;font-weight:600;">${h.label}</td>
                <td>${fv(received)}</td>
                <td>${fv(stowed)}</td>
                <td style="color:${diff<=0?GREEN:RED}!important;font-weight:600;">${received||stowed?fv(diff):''}</td>
                <td style="color:${cagesColor}!important;font-weight:700;">${cagesTxt}</td>
                <td>${b.rsrHC>0?fv(b.rsrHC,2):'\u2014'}</td>
                <td>${b.rsrRate>0?fv(b.rsrRate,1):'\u2014'}</td>
                <td>${b.stowHC>0?fv(b.stowHC,2):'\u2014'}</td>
                <td>${b.rate>0?fv(b.rate,1):'\u2014'}</td>
                <td style="color:${balColor}!important;font-weight:700;">${balance>0?balance.toFixed(1)+'%':'\u2014'}</td>
                <td style="color:${balColor}!important;font-weight:600;">${balance>0?deviation.toFixed(1)+'%':'\u2014'}</td>
                ${statusBadge(bucket,dk,rwTip)}
            </tr>`;
        }).join('');
        return `<section class="hourly-section ib-flow-hourly"><h3>INBOUND | Flow (Hourly)</h3><div style="overflow-x:auto;"><table class="flow-table"><thead>${head}</thead><tbody>${rows}</tbody></table></div></section>`;
    }

    // Flow-only hourly tab: IB flow, OB flow, and Sort (if present). Old detailed
    // per-metric tables are intentionally dropped per the Flow-only design.
    container.innerHTML=buildIBFlowTable()+buildOBFlowTable()+sortHTML;

    // Post a one-line "tool in use" summary to the job-balance Slack channel so
    // the team sees the flow view is being used (Erik's request). Uses the OB
    // (outbound) dock state as the headline, falling back to IB. Fire-and-forget.
    try{ postHourlyFlowToSlack(hourlyData,config); }catch(e){ /* never block render */ }

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
    // After the tables paint, make sure we're scrolled to the top so users don't have to scroll.
    window.scrollTo(0,0);
}

// ============================ VRETs (V-Returns) ============================
// Weekly V-Returns tracker: Pack (1003056) + Pick (1003034) EACH-Total from FCLM function
// rollups, split by day/night shift, week-to-date vs a saved weekly Pack goal.
function vretLoadGoal(){const v=parseFloat(localStorage.getItem('syncboard_vret_goal'));return(!isNaN(v)&&v>0)?v:10949;}
function vretSaveGoal(v){try{localStorage.setItem('syncboard_vret_goal',String(v));}catch(e){}}
// Amazon week: weeks start Sunday. Returns {weekNum, weekStart(Date)} for a target date.
function vretAmazonWeek(target){
    const year=target.getFullYear();
    const jan1=new Date(year,0,1);
    const week1Start=new Date(jan1);week1Start.setDate(jan1.getDate()-jan1.getDay());
    const diffDays=Math.floor((target-week1Start)/86400000);
    const weekNum=Math.floor(diffDays/7)+1;
    const weekStart=new Date(target);weekStart.setDate(target.getDate()-target.getDay());weekStart.setHours(0,0,0,0);
    return{weekNum,weekStart};
}
function vretShiftGroup(dow){if(dow>=0&&dow<=2)return'FHD / FHN';if(dow===3)return'Wed DS / Wed NS';return'BHD / BHN';}
function vretNightWindow(dow){return dow===3?{sh:17,sm:30,eh:5,em:30}:{sh:18,sm:30,eh:5,em:30};}
function vretFmtDate(d){return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0');}
function vretDayName(d){return['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()];}
function vretDateShort(d){return String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0');}

// Pull one process's EACH-Total (UNITS) for a time window (reuses buildFnUrl/parseFnRollup).
// VRETs are tracked in UNITS (the EACH-Total column, parseFnRollup.eachUnits = td.numeric
// index 3), NOT the Jobs column. Falls back to totalUnits (Jobs) only if the report has no
// each column for this process.
async function vretFetchOne(site,pid,sd,sh,sm,ed,eh,em){
    try{const html=await fetchHTML(buildFnUrl(site,pid,sd,sh,sm,ed,eh,em));const r=parseFnRollup(html);return r.eachUnits||r.totalUnits||0;}catch(e){return 0;}
}
// Pull the full week (weekStart..today) day+night Pack/Pick per day.
async function fetchVRETsWeek(site,weekStart,today){
    const results=[];
    const now=new Date();
    let cur=new Date(weekStart);cur.setHours(0,0,0,0);
    const end=new Date(today);end.setHours(0,0,0,0);
    while(cur<=end){
        const d=new Date(cur);
        const next=new Date(d);next.setDate(next.getDate()+1);
        const dow=d.getDay();
        const isToday=d.toDateString()===end.toDateString();
        // Day window: Sunday from 00:00, other days from 05:30, to 17:30.
        const dSh=dow===0?0:5,dSm=dow===0?0:30;
        const nw=vretNightWindow(dow);
        const nightStarted=!isToday||(now.getHours()>nw.sh||(now.getHours()===nw.sh&&now.getMinutes()>=nw.sm));
        const [dayPack,dayPick,nightPack,nightPick]=await Promise.all([
            vretFetchOne(site,PROCESS_IDS.vretPack,d,dSh,dSm,d,17,30),
            vretFetchOne(site,PROCESS_IDS.vretPick,d,dSh,dSm,d,17,30),
            nightStarted?vretFetchOne(site,PROCESS_IDS.vretPack,d,nw.sh,nw.sm,next,nw.eh,nw.em):Promise.resolve(0),
            nightStarted?vretFetchOne(site,PROCESS_IDS.vretPick,d,nw.sh,nw.sm,next,nw.eh,nw.em):Promise.resolve(0),
        ]);
        results.push({date:new Date(d),label:vretDayName(d)+' '+vretDateShort(d),shiftGroup:vretShiftGroup(dow),
            dayPack,dayPick,nightPack,nightPick,nightStarted,totalPack:dayPack+nightPack,totalPick:dayPick+nightPick});
        cur.setDate(cur.getDate()+1);
    }
    return results;
}

// Populate the week selector (current + previous 8 weeks) once.
function vretPopulateWeeks(){
    const sel=document.getElementById('vrets-week-sel');if(!sel||sel.options.length)return;
    const today=new Date();today.setHours(0,0,0,0);
    for(let w=0;w<9;w++){
        const t=new Date(today);t.setDate(today.getDate()-w*7);
        const {weekNum,weekStart}=vretAmazonWeek(t);
        const wkEnd=new Date(weekStart);wkEnd.setDate(weekStart.getDate()+6);
        const label='Wk'+weekNum+' ('+(weekStart.getMonth()+1)+'/'+weekStart.getDate()+'-'+(wkEnd.getMonth()+1)+'/'+wkEnd.getDate()+')';
        const opt=document.createElement('option');
        opt.value=JSON.stringify({weekNum,weekStart:weekStart.toISOString()});
        opt.textContent=label;if(w===0)opt.selected=true;
        sel.appendChild(opt);
    }
}

async function fetchVRETsData(){
    const statusEl=document.getElementById('vrets-status');
    const btn=document.getElementById('btn-fetch-vrets');
    const content=document.getElementById('vrets-content');
    const goalInput=document.getElementById('vrets-goal-input');
    if(goalInput){if(!goalInput.value)goalInput.value=vretLoadGoal();else vretSaveGoal(parseFloat(goalInput.value)||vretLoadGoal());}
    const goal=parseFloat(goalInput&&goalInput.value)||vretLoadGoal();
    if(btn){btn.disabled=true;btn.textContent='\u23F3 Fetching...';}
    if(statusEl)statusEl.textContent='Fetching VRETs...';
    if(content&&content.innerHTML.trim()==='')content.innerHTML='<div style="padding:20px;font-size:14px;">\u23F3 Fetching VRETs data\u2026</div>';
    try{
        const config=loadConfig();const site=config.site;
        // Week from selector (default current).
        let weekNum,weekStart;
        const sel=document.getElementById('vrets-week-sel');
        if(sel&&sel.value){const s=JSON.parse(sel.value);weekNum=s.weekNum;weekStart=new Date(s.weekStart);}
        else{const w=vretAmazonWeek(new Date());weekNum=w.weekNum;weekStart=w.weekStart;}
        const todayActual=new Date();todayActual.setHours(0,0,0,0);
        const weekEnd=new Date(weekStart);weekEnd.setDate(weekStart.getDate()+6);
        const today=todayActual<=weekEnd?todayActual:weekEnd;
        const data=await fetchVRETsWeek(site,weekStart,today);
        currentVRETs={data,goal,weekNum,site};
        renderVRETsTab(currentVRETs);
        updateVRETsPanel(currentVRETs); // also refresh the compact Sync-tab panel
        if(statusEl)statusEl.textContent='\u2713 Updated '+new Date().toLocaleTimeString();
    }catch(err){
        console.error('[SB-VRET] fetch failed:',err);
        if(statusEl)statusEl.textContent='\u26A0 '+err.message;
        if(content)content.innerHTML='<div style="padding:20px;font-size:14px;color:#c62828;">\u26A0 VRETs fetch failed: '+(err&&err.message?err.message:err)+'<br><br>If this is a network/CORS error, your FCLM session likely expired \u2014 reload the page (F5) and try again.</div>';
    }finally{if(btn){btn.disabled=false;btn.textContent='\u25B6 Fetch VRETs';}}
}

function renderVRETsTab(v){
    const content=document.getElementById('vrets-content');if(!content)return;
    const data=(v&&v.data)||[];const goal=(v&&v.goal)||0;const weekNum=(v&&v.weekNum)||'';
    const dc=cfDensityColors();
    const fmtN=n=>(n==null||isNaN(n))?'0':Number(n).toLocaleString();
    const perShiftGoal=Math.round(goal/14);
    const wtdPack=data.reduce((s,d)=>s+d.totalPack,0);
    const wtdPick=data.reduce((s,d)=>s+d.totalPick,0);
    const daysElapsed=data.length;
    const wtdGoal=Math.round(goal*daysElapsed/7);
    const delta=wtdPack-wtdGoal;
    const onTarget=delta>=0;
    const progressPct=goal>0?(wtdPack/goal*100):0;
    const status=wtdPack>=goal?'Goal Achieved':(onTarget?'On Target':'At Risk');
    const statusColor=onTarget?'#22c55e':'#ef4444';

    const kpis=`<div class="vrets-kpis">
        <div class="vrets-kpi"><div class="k-label">PACK WEEKLY GOAL (UNITS)</div><div class="k-val">${fmtN(goal)}</div><div class="k-sub">Goal per shift: ${fmtN(perShiftGoal)}</div></div>
        <div class="vrets-kpi"><div class="k-label">PACK WTD (UNITS)</div><div class="k-val">${wtdPack>=goal?fmtN(wtdPack):fmtN(wtdPack)+' / '+fmtN(wtdGoal)}</div><div class="vrets-bar"><div style="width:${Math.min(progressPct,100)}%"></div></div><div class="k-sub">${progressPct.toFixed(1)}%</div></div>
        <div class="vrets-kpi"><div class="k-label">DELTA (VS GOAL)</div><div class="k-val" style="color:${statusColor};">${fmtN(delta)}</div><div class="k-sub" style="color:${statusColor};">\u25CF ${status}</div></div>
    </div>`;

    // Daily Progress
    let running=0;
    const dailyRows=data.map((row,ri)=>{
        running+=row.totalPack;
        const dayWtdGoal=Math.round(goal*(ri+1)/7);
        const gap=running-dayWtdGoal;
        const gapStyle=gap>=0?`color:${dc.goodTxt};`:`color:${dc.badTxt};`;
        return `<tr>
            <td style="text-align:left;">${row.label}</td>
            <td>${fmtN(row.totalPack)}</td>
            <td>${fmtN(row.totalPick)}</td>
            <td>${fmtN(running)}</td>
            <td>${fmtN(dayWtdGoal)}</td>
            <td style="${gap>=0?`background:${dc.goodBg};`:`background:${dc.badBg};`}${gapStyle}">${fmtN(gap)}</td>
            <td style="color:${gap>=0?'#22c55e':'#ef4444'};font-weight:700;">${gap>=0?'\u25CF':'\u25CF'}</td>
        </tr>`;
    }).join('');
    const dailyHTML=`<section class="vrets-section"><h3>Daily Progress</h3>
        <table class="metrics-table"><thead><tr><th style="text-align:left;">Day</th><th>Pack</th><th>Pick</th><th>WTD Pack</th><th>WTD Goal</th><th>Gap</th><th>Status</th></tr></thead>
        <tbody>${dailyRows}</tbody></table></section>`;

    // Pack by Shift
    const shiftRows=data.map(row=>{
        const dayOk=row.dayPack>=perShiftGoal;
        const nightOk=row.nightStarted&&row.nightPack>=perShiftGoal;
        const nightLabel=row.nightStarted?fmtN(row.nightPack):'0*';
        return `<tr>
            <td style="text-align:left;">${row.label}</td>
            <td style="text-align:left;">${row.shiftGroup}</td>
            <td>${fmtN(row.dayPack)}</td>
            <td style="color:${dayOk?'#22c55e':'#ef4444'};font-weight:700;">\u25CF</td>
            <td>${nightLabel}</td>
            <td style="color:${nightOk?'#22c55e':'#ef4444'};font-weight:700;">\u25CF</td>
        </tr>`;
    }).join('');
    const shiftHTML=`<section class="vrets-section"><h3>Pack by Shift</h3>
        <table class="metrics-table"><thead><tr><th style="text-align:left;">Day</th><th style="text-align:left;">Shift Group</th><th>Day Pack</th><th>Day</th><th>Night Pack</th><th>Night</th></tr></thead>
        <tbody>${shiftRows}</tbody></table>
        <div style="font-size:10px;color:#888;margin-top:4px;">* Night shift not started yet. Green dot = met per-shift goal (${fmtN(perShiftGoal)}).</div></section>`;

    // Claw-back plan (only when at risk and a higher pace is required)
    let clawHTML='';
    if(!onTarget){
        const remainingPack=goal-wtdPack;
        const remainingDays=7-daysElapsed;
        const remainingShifts=remainingDays*2+((data[data.length-1]&&!data[data.length-1].nightStarted)?1:0);
        const newGoalPerShift=remainingShifts>0?Math.ceil(remainingPack/remainingShifts):0;
        if(newGoalPerShift>perShiftGoal){
            const inc=newGoalPerShift-perShiftGoal;
            const incPct=perShiftGoal>0?Math.round(inc/perShiftGoal*100):0;
            clawHTML=`<section class="vrets-section" style="border-left-color:#c62828;"><h3>Claw-Back Plan</h3>
                <table class="metrics-table"><thead><tr><th>Remaining Pack</th><th>Remaining Shifts</th><th>New Goal/Shift</th><th>Increase</th></tr></thead>
                <tbody><tr><td>${fmtN(remainingPack)}</td><td>${remainingShifts}</td><td>${fmtN(newGoalPerShift)}</td><td style="color:#c62828;font-weight:700;">+${fmtN(inc)} (+${incPct}%)</td></tr></tbody></table></section>`;
        }
    }

    const creditHTML='<div style="text-align:center;font-size:10px;color:#999;margin-top:10px;font-style:italic;">Inspired by sorianou</div>';
    content.innerHTML=kpis+dailyHTML+shiftHTML+clawHTML+creditHTML;
    window.scrollTo(0,0);
}

// Compact VRETs panel on the Sync tab (populated from the same weekly fetch).
function updateVRETsPanel(v){
    if(!v||!v.data)return;
    const goal=v.goal||0;
    const data=v.data;
    const wtdPack=data.reduce((s,d)=>s+d.totalPack,0);
    const daysElapsed=data.length;
    const wtdGoal=Math.round(goal*daysElapsed/7);
    const delta=wtdPack-wtdGoal;
    const pct=goal>0?(wtdPack/goal*100):0;
    const last=data[data.length-1]||{};
    setEl('sync-vret-wtd',fmt(wtdPack));
    setEl('sync-vret-goal',fmt(goal));
    setEl('sync-vret-pct',pct>0?fmtPct(pct):'\u2014');
    const de=setEl('sync-vret-delta',fmt(delta));
    if(de){const dk=document.getElementById('sb-root')?.classList.contains('dark-mode');
        // setProperty(...,'important') so the dark-mode "#vret-panel *" color rule doesn't override it.
        de.style.setProperty('color',delta>=0?(dk?'#69f0ae':'#2e7d32'):(dk?'#ff5252':'#c62828'),'important');}
    setEl('sync-vret-today-pick',fmt(last.totalPick||0));
    setEl('sync-vret-today-pack',fmt(last.totalPack||0));
    const bar=document.getElementById('sync-vret-bar');if(bar)bar.style.width=Math.min(pct,100)+'%';
}

// ============================ EOS WASH TAB ============================
// Parses a full Process Path Rollup (PPR) HTML report into a map keyed by line-item name.
// Reads cells by CSS class (robust against rows that have an extra leading header cell):
//   actualVolume -> volume, actualTimeSeconds -> hours, actualProductivity -> rate,
//   planProductivity -> plan rate, planVarianceSeconds -> hours variance (=PPR!M27),
//   ratioToPlan -> % to plan.
function parsePPRDetail(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    const map={};
    const num=(cell)=>{if(!cell)return null;const div=cell.querySelector('div.original');const t=(div?div.textContent:cell.textContent).trim().replace(/,/g,'').replace('%','');const v=parseFloat(t);return isNaN(v)?null:v;};
    doc.querySelectorAll('tr').forEach(tr=>{
        const nameCell=tr.querySelector('td.lineItemName, td[class*="lineItemName"]');
        if(!nameCell)return;
        const name=nameCell.textContent.trim();if(!name)return;
        const vol=num(tr.querySelector('td.actualVolume'));
        const hrs=num(tr.querySelector('td.actualTimeSeconds'));
        const rate=num(tr.querySelector('td.actualProductivity'));
        const planRate=num(tr.querySelector('td.planProductivity'));
        const planVar=num(tr.querySelector('td.planVarianceSeconds'));
        const ratio=num(tr.querySelector('td.ratioToPlan'));
        const unitCell=tr.querySelector('td.unitType');
        const unit=unitCell?unitCell.textContent.trim():'';
        // Keep the first occurrence of a given line-item name.
        if(map[name]===undefined)map[name]={vol,hrs,rate,planRate,planVar,ratio,unit};
    });
    return map;
}

// Manual EOS Wash daily-plan targets (cartons) for the "% to Daily Plan" column. The user enters
// the IB (Case Transfer In) and DA (Transfer Out Pick) Combined-Cartons Capacity for the current
// shift in the EOS Wash header; values persist in localStorage so they survive reloads/Get Data
// (set once a week when the ALPS plan publishes). Returns {caseTransferIn, transferOutPick} with
// null for any field left blank. Prefers the live input value, falling back to the saved value.
const EOS_PLAN_KEY='syncboard_eos_plan_targets';
function readEosPlanTargets(){
    let saved={};
    try{const s=localStorage.getItem(EOS_PLAN_KEY);if(s)saved=JSON.parse(s)||{};}catch(e){}
    const parse=(id,savedVal)=>{
        const el=document.getElementById(id);
        const raw=el?(el.value!=null&&el.value!==''?el.value:''):'';
        if(raw!==''){const v=parseFloat(String(raw).replace(/,/g,''));return isNaN(v)?null:v;}
        const sv=parseFloat(savedVal);return isNaN(sv)?null:sv;
    };
    return{
        caseTransferIn:parse('eos-ib-plan-input',saved.caseTransferIn),
        transferOutPick:parse('eos-da-plan-input',saved.transferOutPick)
    };
}
// Persist the two manual plan inputs to localStorage, then re-render the EOS Wash so the
// "% to Daily Plan" column reflects the new target immediately (no re-fetch needed).
function saveEosPlanTargets(){
    const t=readEosPlanTargets();
    try{localStorage.setItem(EOS_PLAN_KEY,JSON.stringify(t));}catch(e){}
    if(currentEOSWash)renderEOSWash(currentEOSWash);
}
// On first build, seed the two inputs from the saved values and wire change listeners.
function initEosPlanInputs(){
    let saved={};
    try{const s=localStorage.getItem(EOS_PLAN_KEY);if(s)saved=JSON.parse(s)||{};}catch(e){}
    const ib=document.getElementById('eos-ib-plan-input');
    const da=document.getElementById('eos-da-plan-input');
    if(ib&&saved.caseTransferIn!=null)ib.value=saved.caseTransferIn;
    if(da&&saved.transferOutPick!=null)da.value=saved.transferOutPick;
    [ib,da].forEach(el=>{if(el&&!el.dataset.eosPlanWired){el.dataset.eosPlanWired='1';el.addEventListener('input',saveEosPlanTargets);el.addEventListener('change',saveEosPlanTargets);}});
}
// Fetch the full-shift PPR once and render the EOS Wash. Uses the same shift window as the
// Sync tab (getShiftDates + full schedule).
async function fetchEOSWashData(){
    const statusEl=document.getElementById('eoswash-status');
    const btn=document.getElementById('btn-fetch-eoswash');
    const content=document.getElementById('eoswash-content');
    if(btn){btn.disabled=true;btn.textContent='\u23F3 Fetching...';}
    if(statusEl)statusEl.textContent='Fetching EOS Wash data...';
    if(content&&content.innerHTML.trim()==='')content.innerHTML='<div style="padding:20px;font-size:14px;">\u23F3 Fetching EOS Wash data\u2026</div>';
    try{
        const config=loadConfig();
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const {startDate}=getShiftDates(config);
        let sDate=new Date(startDate);
        if(sched.full.sh<12&&startDate.getHours()>=12){sDate.setDate(sDate.getDate()+1);}
        let eDate=new Date(sDate);if(sched.full.eh<sched.full.sh)eDate.setDate(eDate.getDate()+1);
        const pprUrl=buildPPRUrl(config.site,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em);
        // Also fetch case-based volumes from the function rollups (same source the Sync tab uses),
        // since the PPR reports pick/transfer-out in EACHES, not cases.
        const S=PROCESS_IDS;
        // Use the SAME report set + parsers as the Sync tab, including the SPLIT Transfer Out
        // reports (toFluidLoad + toDock) that replaced the old single obDock report. OB loaded
        // volume (cases) = TO Fluid Load jobs + Transfer Out Dock pallet cases, matching Sync's
        // loadedUnits. The old obDock report is no longer used here.
        const [pprHtml,stowH,palletH,pickH,toFluidH,toDockH]=await Promise.all([
            fetchHTML(pprUrl),
            fetchHTML(buildFnUrl(config.site,S.stow,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em)),
            fetchHTML(buildFnUrl(config.site,S.palletStow,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em)),
            fetchHTML(buildFnUrl(config.site,S.pick,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em)),
            fetchHTML(buildFnUrl(config.site,S.toFluidLoad,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em)),
            fetchHTML(buildFnUrl(config.site,S.toDock,sDate,sched.full.sh,sched.full.sm,eDate,sched.full.eh,sched.full.em))
        ]);
        const ppr=parsePPRDetail(pprHtml);
        const stow=parseFnRollup(stowH),pallet=parseFnRollup(palletH),pick=parseFnRollup(pickH);
        const toFluid=parseToFluidLoad(toFluidH),toDock=parseToDock(toDockH);
        // Case volumes keyed by PPR line-item name (used to override PPR eaches with real cases).
        const caseVols={
            'Case Transfer In':stow.totalUnits||0,
            'Pallet Transfer In':pallet.palletCases||0,
            'Transfer Out Pick - Total':pick.totalUnits||0,
            'Transfer Out - Fluid Load':toFluid.jobs||0,
            'Transfer Out Dock':toDock.caseUnits||0,
        };
        // Real HOURS for the two OUTBOUND rows whose hours come from the split Transfer Out
        // reports (Total Paid Hours), NOT the PPR line-item. The PPR row for these carries no/
        // zero hours, so without this override the Hours cell renders blank. Fail-soft: 0 when
        // the report has no data (e.g. Transfer Out Dock today), which keeps the cell blank.
        const caseHrs={
            'Transfer Out - Fluid Load':(toFluid.directHours||0),
            'Transfer Out Dock':(toDock.directHours||0),
        };
        // ALPS daily-plan TARGET volume (Capacity, cartons) for the current production day,
        // Day vs Night section. Compared against the actual shift volume in renderEOSWash.
        // Fail-soft: any ALPS error leaves alpsTarget entries null (the new "% to Daily Plan"
        // cells render blank) and NEVER breaks the existing render. IB=inbound-joint,
        // DA=daOBDA-transferOut.
        // Daily-plan TARGET volume (cartons) for the "% to Daily Plan" column now comes from the
        // MANUAL inputs in the EOS Wash header (eos-ib-plan-input / eos-da-plan-input), not ALPS.
        // The ALPS daily-capacity auto-fetch is disabled for now (the published Capacity value the
        // UI shows isn't retrievable from the getPlanSelectionData API — it's browser-computed), so
        // the user enters the IB/DA Combined-Cartons Capacity for the current shift by hand. Values
        // persist via loadEosPlanTargets()/the input's localStorage wiring. renderEOSWash reads the
        // same inputs live, so this just seeds currentEOSWash for the theme-toggle re-render path.
        const alpsTarget=readEosPlanTargets();
        currentEOSWash={ppr,caseVols,caseHrs,alpsTarget};
        renderEOSWash(currentEOSWash);
        if(statusEl)statusEl.textContent='\u2713 Updated '+new Date().toLocaleTimeString();
    }catch(err){
        console.error('[SB-EOS] fetch failed:',err);
        if(statusEl)statusEl.textContent='\u26A0 '+err.message;
        if(content)content.innerHTML='<div style="padding:20px;font-size:14px;color:#c62828;">\u26A0 EOS Wash fetch failed: '+(err&&err.message?err.message:err)+'<br><br>If this is a network/CORS error, your FCLM session likely expired \u2014 reload the page (F5) and try again.</div>';
    }finally{if(btn){btn.disabled=false;btn.textContent='\u25B6 Fetch EOS Wash';}}
}

function renderEOSWash(data){
    const content=document.getElementById('eoswash-content');if(!content)return;
    const ppr=(data&&data.ppr)||{};
    const caseVols=(data&&data.caseVols)||{};
    // Real HOURS override (keyed by PPR line-item name) for the two OUTBOUND rows whose hours
    // come from the split Transfer Out reports, not the PPR. Declared before procRow so it is
    // captured in procRow's closure. Only the two TO rows have an entry here.
    const caseHrs=(data&&data.caseHrs)||{};
    // ALPS daily-plan targets (cartons) keyed by PPR line-item name — only the two rows that
    // get the new "% to Daily Plan" comparison have a target; all other rows map to undefined.
    // Daily-plan targets now come from the MANUAL IB/DA Plan inputs in the EOS Wash header
    // (read live so edits reflect without a re-fetch), falling back to whatever was seeded on
    // currentEOSWash. The two keys are ALWAYS present (null when unset) so the two comparison
    // rows keep showing the "% to Daily Plan" column (with a muted placeholder when blank);
    // every other row maps to undefined and stays an empty cell.
    const manualTargets=readEosPlanTargets();
    const seeded=(data&&data.alpsTarget)||{};
    const ibT=(manualTargets.caseTransferIn!=null)?manualTargets.caseTransferIn:(seeded.caseTransferIn!=null?seeded.caseTransferIn:null);
    const daT=(manualTargets.transferOutPick!=null)?manualTargets.transferOutPick:(seeded.transferOutPick!=null?seeded.transferOutPick:null);
    const alpsTargetByName={'Case Transfer In':ibT,'Transfer Out Pick - Total':daT};
    // CTI/TOP Hours Variance inputs (closure vars used in procRow): the manual LP Target volumes
    // (same as ibT/daT), and the per-site shift block/ops hours. eosShift falls back to the
    // default (KRB3 values) for any unmapped site.
    const eosLpTargetIB=(ibT!=null&&ibT>0)?ibT:0;
    const eosLpTargetDA=(daT!=null&&daT>0)?daT:0;
    const eosShift=SHIFT_HOURS[(loadConfig().site||'').toUpperCase()]||SHIFT_HOURS_DEFAULT;
    // Labor-plan Hours Variance for the two LP-target rows (CTI/TOP), used by procRow AND by the
    // totals so IB/DA TOTAL + THROUGHPUT swap in this value instead of the row's old column-M
    // variance (until the other rows' variance basis is finalized). Returns the labor-plan
    // variance (plannedHrs - actualHrs) or null when the LP target/rate aren't available.
    // pprName is 'Case Transfer In' (IB) or 'Transfer Out Pick - Total' (DA).
    const laborPlanVar=(pprName)=>{
        const lpT=(pprName==='Case Transfer In')?eosLpTargetIB:eosLpTargetDA;
        const lpR=(pprName==='Case Transfer In')?ctiLpRate:topLpRate;
        if(!(lpT>0)||!(lpR>0)||!(eosShift.ops>0))return null;
        const dd=ppr[pprName]||{};
        const actHrs=(dd.hrs!=null)?dd.hrs:0;
        return (lpT/lpR/eosShift.ops)*eosShift.block-actHrs;
    };
    // The row's OLD column-M variance ((vol/planRate)-hrs) for CTI/TOP, so the totals can remove
    // it before adding the labor-plan value (keeps the total = sum of what the rows now show).
    const colMVar=(pprName)=>{
        const dd=ppr[pprName]||{};
        const vv=(dd.vol!=null)?dd.vol:0, pr=(dd.planRate!=null)?dd.planRate:0, hh=(dd.hrs!=null)?dd.hrs:0;
        return (pr>0)?((vv/pr)-hh):(hh>0?-hh:0);
    };
    const dc=cfDensityColors();
    // Read existing Sync-tab plan inputs (no re-entry).
    const gv=id=>{const el=document.getElementById(id);if(!el)return 0;const raw=(el.value!=null&&el.value!=='')?el.value:el.textContent;return parseFloat(String(raw).replace(/,/g,''))||0;};
    const ibBB=gv('ib-bb-goal'),ibPlan=gv('ib-goal-input'),ibCplh=gv('ib-cplh-target');
    const daBB=gv('ob-bb-goal'),daPlan=gv('ob-goal-input'),daCplh=gv('ob-cplh-target');
    // LP per-path RATE targets (stow/pick), the SAME values the Sync tab uses to color its IB/OB
    // rate cells (ctiRate / topRate). These are the correct basis for the "% to LP" fallback on
    // the two volume paths below — NOT the CPLH targets (ibCplh/daCplh), which are a different
    // metric (cases per labor hour) and produced wildly wrong % values.
    const lpVals=(typeof loadLPValues==='function'?loadLPValues():null)||{};
    let ctiLpRate=parseFloat(lpVals.ctiRate)||0;
    let topLpRate=parseFloat(lpVals.topRate)||0;
    // CHANGE 3: cached LP SITE CPLH target (DeratedRates "Total Building CPLH Inc Support",
    // e.g. 19.56). Used by throughputRow via closure as the "% to LP" basis — the SAME target
    // the Sync tab uses, NOT the PPR THROUGHPUT ratioToPlan.
    const siteLpCplh=parseFloat((loadLPValues()||{}).siteCplh)||0;
    // display-text fallback if the cached numeric is missing/zero
    if(!(ctiLpRate>0)){const e=document.getElementById('lp-cti-rate-display');const v=e?parseFloat((e.textContent||'').replace(/,/g,'')):NaN;if(v>0)ctiLpRate=v;}
    if(!(topLpRate>0)){const e=document.getElementById('lp-top-rate-display');const v=e?parseFloat((e.textContent||'').replace(/,/g,'')):NaN;if(v>0)topLpRate=v;}
    dbg('[SB-EOS LP targets] ctiLpRate='+ctiLpRate+' topLpRate='+topLpRate+' ibCplh='+ibCplh+' daCplh='+daCplh);

    // Process-path rows: [display label, PPR line-item name, hasVol]. hasVol=true means the row
    // produces real throughput VOLUME (shown with Volume/Rate/% to LP). hasVol=false means it's a
    // support/indirect path (hours only) - rendered in a separate compact group with NO blank
    // Volume/Rate/% cells. Both groups live under the same IB / OB section header.
    const IB_ROWS=[
        ['Case Transfer In','Case Transfer In',true],
        ['Pallet Transfer In','Pallet Transfer In',true],
        ['Case Stow to Reserve','Case Stow to Reserve',true],
        ['Transfer In Support','Transfer In Support',false],
        ['RSR Support','RSR Support',false],
        ['IB Lead/PA','IB Lead/PA',false],
        ['IB Problem Solve','IB Problem Solve',false],
    ];
    // OB uses the NEW split Transfer Out paths (fluid load + dock), matching the Sync tab.
    const DA_ROWS=[
        ['Transfer Out Pick Total (Cases)','Transfer Out Pick - Total',true],
        ['Transfer Out - Fluid Load','Transfer Out - Fluid Load',true],
        ['Transfer Out Dock','Transfer Out Dock',true],
        ['TO Lead/PA','TO Lead/PA',false],
        ['TO Problem Solve','TO Problem Solve',false],
    ];
    const OTHER_ROWS=[
        ['Non FC Controllable','Non_FC_Controllable',false],
        ['Admin/HR/IT','Admin/HR/IT',false],
    ];

    const fv=(v,d=0)=>(v==null||isNaN(v))?'':Number(v).toLocaleString(undefined,{minimumFractionDigits:d,maximumFractionDigits:d});
    // Muted placeholder for an empty data cell (no data) so blanks don't read as broken white.
    const dash=()=>'<span style="opacity:0.4;">\u2014</span>';
    // Cell background by good/warn/bad. dir='high' => higher is better (rate, %); 'low' => lower is better.
    const bg=(pct)=>{if(pct==null||isNaN(pct)||pct===0)return '';if(pct>=100)return `background:${dc.goodBg};color:${dc.goodTxt};`;if(pct>=95)return `background:${dc.warnBg};color:${dc.warnTxt};`;return `background:${dc.badBg};color:${dc.badTxt};`;};
    const varBg=(v)=>{if(v==null||isNaN(v)||v===0)return '';return v>=0?`background:${dc.goodBg};color:${dc.goodTxt};`:`background:${dc.badBg};color:${dc.badTxt};`;};

    // Volume rows are now driven by the per-row hasVol flag (3rd array element), so the Set is
    // built from the row defs rather than hardcoded.
    const HAS_VOLUME=new Set([...IB_ROWS,...DA_ROWS,...OTHER_ROWS].filter(r=>r[2]).map(r=>r[1]));
    // Returns the CASE volume for a row. The PPR reports volume in the row's own unit; we only
    // treat it as cases when the unit is Case/Pallet/Carton. Eaches-based rows (e.g. some pick/
    // transfer-out rows) would otherwise show inflated unit counts, so those are left blank until
    // wired to a case source.
    const caseVol=(pprName,d)=>{
        // Prefer the case-based volume from the function rollups (in cases), when available.
        if(caseVols[pprName]!=null)return caseVols[pprName];
        if(!d||d.vol==null)return null;
        const u=(d.unit||'').toLowerCase();
        if(u===''||u.includes('case')||u.includes('carton')||u.includes('pallet'))return d.vol;
        return null; // eaches / other units are not cases
    };
    // "% to Daily Plan" cell: actual shift VOLUME vs the ALPS daily-plan Capacity target
    // (cartons). Only the two rows in alpsTargetByName have a target; everything else (and any
    // null target / null volume) returns a blank <td> so the 8-column layout stays aligned.
    // Same good/warn/bad coloring as "% to LP"; the target is shown in a tooltip.
    const dailyPlanCell=(pprName,vol)=>{
        // Only the two comparison rows are keys in alpsTargetByName. Membership (value !==
        // undefined) decides whether this row EVER shows the "% to Daily Plan" comparison.
        const isCompRow=(alpsTargetByName[pprName]!==undefined);
        if(!isCompRow)return '<td></td>'; // every other row: empty slot, as before
        const t=alpsTargetByName[pprName];
        // Comparison row but the ALPS target didn't load (or no actual volume): show a muted
        // placeholder so the user can SEE the column exists and that the data just didn't load.
        if(t==null||!(t>0)||vol==null)return '<td style="opacity:0.5;" title="ALPS daily plan target unavailable (check ALPS session / shift date)">\u2014</td>';
        const pct=vol/t*100;
        // Target IS present: show the %, surface target+actual in the tooltip AND on a small
        // second line, keeping the bg(pct) coloring.
        return '<td style="'+bg(pct)+'" title="ALPS daily plan target '+Number(t).toLocaleString()+' (actual vol '+Number(vol).toLocaleString()+')">'+pct.toFixed(1)+'%<br><span style="font-size:9px;opacity:0.8;">plan '+fv(t)+'</span></td>';
    };
    function procRow(label,pprName){
        const d=ppr[pprName]||{};
        const showsVol=HAS_VOLUME.has(pprName);
        const vol=showsVol?caseVol(pprName,d):null;
        // Hours: prefer the PPR line-item hours when present and >0; otherwise, for the two TO
        // rows that carry their real hours in caseHrs (from the split Transfer Out reports), use
        // that override. When both are 0/absent the cell stays blank (so Transfer Out Dock with
        // no data today renders blank). Only rows with a caseHrs entry are affected.
        const pprHrs=d.hrs;
        const ovrHrs=caseHrs[pprName];
        const usedTOHrs=(ovrHrs!=null&&ovrHrs>0&&(pprHrs==null||pprHrs===0));
        const hrs=usedTOHrs?ovrHrs:pprHrs;
        const rate=(showsVol&&vol!=null&&hrs>0)?vol/hrs:(showsVol?d.rate:null);
        // % to LP = the PPR report's own "% to Plan" (ratioToPlan) for EVERY row. PPR already
        // computes it against the correct planned rate; the DeratedRates cache rates are on a
        // different (derated/period) basis, so actual-rate/plan-rate produced wrong values.
        // Blank rows with no computable ratio, and blank support rows with absurd ratios
        // (near-zero planned hours can produce e.g. 1264%, which is meaningless).
        let pctLP=(d.ratio!=null&&d.ratio!==0)?d.ratio:0;
        if(!showsVol&&pctLP>300)pctLP=0; // suppress meaningless support-row ratios
        // Case Stow to Reserve legitimately has no LP rate -> render literal "NA" (handled at
        // render time via lpIsNA below), never a % or blank.
        const lpIsNA=(pprName==='Case Stow to Reserve');
        // Fallback for the two volume paths that have LP data in the Sync tool but whose PPR row
        // may be missing a ratioToPlan: when the PPR ratio is absent/zero AND the row has a
        // computable actual rate AND the matching Sync LP RATE target is set, derive
        // % to LP = actualRate / lpRate * 100. These are the per-path stow/pick RATE targets
        // (ctiLpRate / topLpRate) — the same values the Sync tab colors its rate cells against —
        // NOT the CPLH targets. A real PPR ratio always wins.
        let lpFromCplh=false;let fbTarget=0;
        if(!lpIsNA&&pctLP===0&&rate>0){
            fbTarget=(pprName==='Case Transfer In')?ctiLpRate:(pprName==='Transfer Out Pick - Total')?topLpRate:0;
            if(fbTarget>0){pctLP=(rate/fbTarget)*100;lpFromCplh=true;}
        }
        // Hours Variance = Hours@PlanRate - Actual Hours = (vol/planRate) - hrs, using the PPR's
        // OWN raw volume (d.vol) and plan rate (d.planRate), matching the reference Excel's
        // "Plan Variance (Hrs)" column M. + = used FEWER hours than plan (good); - = MORE.
        // When planRate is 0/absent but the row has actual hours, Hours@PlanRate=0 so var=-hrs.
        const hvVol=(d.vol!=null)?d.vol:0;
        const hvPlanRate=(d.planRate!=null)?d.planRate:0;
        const hvHrs=(d.hrs!=null)?d.hrs:0;
        let hoursVar=(hvPlanRate>0)?((hvVol/hvPlanRate)-hvHrs):(hvHrs>0?-hvHrs:null);
        // CTI (Case Transfer In) & TOP (Transfer Out Pick) Hours Variance use the LABOR-PLAN basis
        // the user specified, NOT the PPR column-M formula: plannedHours = (LP Target / LP rate /
        // opsHours) * shiftBlock, then variance = plannedHours - actual hours. LP Target = the
        // manual IB/OB plan input (alpsTargetByName); LP rate = ctiLpRate / topLpRate; ops/block
        // = the per-site SHIFT_HOURS (KRB3: ops 9.25, block 10). Example (IB): 8300/47.23/9.25*10
        // = 190 planned hrs. If LP Target or LP rate is missing, fall back to null (shows a dash).
        if(pprName==='Case Transfer In'||pprName==='Transfer Out Pick - Total'){
            const lpT=(pprName==='Case Transfer In')?eosLpTargetIB:eosLpTargetDA;
            const lpR=(pprName==='Case Transfer In')?ctiLpRate:topLpRate;
            if(lpT>0&&lpR>0&&eosShift.ops>0){
                const plannedHrs=(lpT/lpR/eosShift.ops)*eosShift.block;
                hoursVar=plannedHrs-((hvHrs!=null)?hvHrs:0);
            }else{
                hoursVar=null; // can't compute without a plan target + LP rate
            }
        }
        // Diagnostic: raw inputs behind every EOS Wash "% to LP" and "Hours Variance" cell so
        // any row can be reconciled against PPR / the cached LP planned rates.
        dbg('[SB-EOS row] '+label+
            ' | showsVol='+showsVol+
            ' vol='+(vol==null?'n/a':vol)+
            ' hrs='+(hrs==null?'n/a':Number(hrs).toFixed(2))+(usedTOHrs?' (hrs-from-TOreport)':'')+
            ' actualRate='+(rate==null?'n/a':Number(rate).toFixed(2))+
            ' pprRatioToPlan='+(d.ratio==null?'n/a':Number(d.ratio).toFixed(1)+'%')+
            ' => %toLP='+(lpIsNA?'NA':lpFromCplh?pctLP.toFixed(1)+'% (lp-rate-fallback)':pctLP>0?pctLP.toFixed(1)+'%':'(blank)')+
            (lpFromCplh?' | LPfallback: actualRate='+rate.toFixed(2)+' / LPrate='+fbTarget.toFixed(2)+' = '+pctLP.toFixed(1)+'% (src='+(pprName==='Case Transfer In'?'ctiRate':'topRate')+')':'')+
            ' | planVarianceHrs='+(hoursVar==null?'n/a':Number(hoursVar).toFixed(2)));
        // CHANGE 1: LP rate basis to show as a small muted label in the "% to LP" cell.
        // ctiLpRate for Case Transfer In, topLpRate for Transfer Out Pick - Total, else the
        // PPR row's own planRate (planProductivity). Only shown when >0; NA row never shows it.
        let lpBasis=0;
        if(pprName==='Case Transfer In')lpBasis=ctiLpRate;
        else if(pprName==='Transfer Out Pick - Total')lpBasis=topLpRate;
        else if(d.planRate>0)lpBasis=d.planRate;
        // % to LP cell content: NA for Case Stow to Reserve; else the optional "LP <rate>" label
        // + the %; a muted dash when there's no computable %.
        const lpCellInner=lpIsNA?'NA':((lpBasis>0?`<span style="font-size:9px;opacity:0.7;display:block;">LP ${fv(lpBasis,2)}</span>`:'')+(pctLP>0?pctLP.toFixed(1)+'%':(lpBasis>0?'':dash())));
        return `<tr>
            <td style="text-align:left;">${label}</td>
            <td>${vol!=null?fv(vol):dash()}</td>
            <td>${hrs!=null?fv(hrs,2):dash()}</td>
            <td>${rate!=null&&rate>0?fv(rate,2):dash()}</td>
            <td${lpIsNA?'':` style="${bg(pctLP)}"`}>${lpCellInner}</td>
            ${dailyPlanCell(pprName,vol)}
            <td style="${varBg(hoursVar)}">${hoursVar!=null?fv(hoursVar,2):dash()}</td>
            ${bridge(slug(label))}
        </tr>`;
    }
    // Which line items count as real THROUGHPUT VOLUME (support/lead/PS rows are indirect and
    // their "volume" is not real production, so they only contribute HOURS, not volume/CPLH).
    const IB_VOL_ROWS=['Case Transfer In','Pallet Transfer In'];
    // DA TOTAL volume = Transfer Out Pick cases (matches the Excel "Transfer Out Pick Total (Cases)");
    // hours = all DA rows. CPLH = cases / total DA hours.
    const DA_VOL_ROWS=['Transfer Out Pick - Total'];
    const sumVol=(names)=>{let v=0,have=false;names.forEach(n=>{const d=ppr[n];const cv=caseVol(n,d);if(cv!=null){v+=cv;have=true;}});return have?v:null;};
    const sumHrs=(names)=>{let h=0,have=false;names.forEach(n=>{const d=ppr[n];if(d&&d.hrs!=null){h+=d.hrs;have=true;}});return have?h:null;};

    // Subtotal row: VOLUME from the volume rows only, HOURS from all rows, CPLH = vol/hrs.
    // Hours variance = (planned volume / CPLH goal) - actual hours (positive = under plan).
    function totalRow(label,allNames,volNames,planVol,cplhGoal,cls){
        const vol=sumVol(volNames);
        const hrs=sumHrs(allNames);
        // Rate column for the TOTAL row = CPLH (volume / TOTAL hours), matching the Sync tab's
        // IB/DA CPLH exactly — NOT the per-path CTI/TOP rate (those stay on the Case Transfer In /
        // Transfer Out Pick rows). Read the Sync tab's already-rendered CPLH total so the two
        // tabs agree (the wash's own sumHrs covers only this section's rows, which gave a
        // different hours denominator and a mismatched rate like 30.03 vs the Sync 19.20).
        // IB TOTAL -> #ib-cplh-total, DA TOTAL -> #ob-cplh-total; fall back to vol/hrs if absent.
        const cplhElId=(label.indexOf('IB')===0)?'ib-cplh-total':(label.indexOf('DA')===0?'ob-cplh-total':null);
        let rate=(hrs&&hrs>0&&vol!=null)?vol/hrs:0;
        if(cplhElId){const syncCplh=parseFloat((document.getElementById(cplhElId)?.textContent||'').replace(/,/g,''));if(syncCplh>0)rate=syncCplh;}
        // Hours Variance = SUM over member rows of (vol/planRate - hrs) (Excel column M total),
        // using each PPR line item's OWN raw volume and plan rate.
        let tvar=0, tvarHas=false;
        allNames.forEach(n=>{const dd=ppr[n]; if(dd){const vv=(dd.vol!=null)?dd.vol:0; const pr=(dd.planRate!=null)?dd.planRate:0; const hh=(dd.hrs!=null)?dd.hrs:0; const rowVar=(pr>0)?((vv/pr)-hh):(hh>0?-hh:0); tvar+=rowVar; tvarHas=true;}});
        // OPTION 1: swap the CTI/TOP contribution in the TOTAL from the old column-M value to the
        // labor-plan value (planned HC hours - actual), so the TOTAL matches the row the user now
        // sees. IB TOTAL swaps Case Transfer In; DA TOTAL swaps Transfer Out Pick - Total. Only
        // when the labor-plan value is available (LP target + rate present).
        const totalSwapKey=(label.indexOf('IB')===0)?'Case Transfer In':(label.indexOf('DA')===0?'Transfer Out Pick - Total':null);
        if(tvarHas&&totalSwapKey){const lpv=laborPlanVar(totalSwapKey);if(lpv!=null){tvar=tvar-colMVar(totalSwapKey)+lpv;}}
        const hoursVar=tvarHas?tvar:null;
        const cplhPct=(cplhGoal>0&&rate>0)?(rate/cplhGoal)*100:0;
        // % to Daily Plan for the TOTAL row: total section volume vs the manual LP Target.
        // IB TOTAL -> the Case Transfer In (IB) target; DA TOTAL -> the Transfer Out Pick (DA)
        // target. Reuses dailyPlanCell by passing the matching comparison-row key, so it renders
        // the %, "plan X" line, coloring, and the muted placeholder exactly like the row cells.
        const totalPlanKey=(label.indexOf('IB')===0)?'Case Transfer In':(label.indexOf('DA')===0?'Transfer Out Pick - Total':null);
        const totalPlanTd=totalPlanKey?dailyPlanCell(totalPlanKey,vol):'<td></td>';
        return `<tr class="${cls}" style="font-weight:700;border-top:2px solid #000;">
            <td style="text-align:left;">${label}</td>
            <td>${vol!=null?fv(vol):dash()}</td>
            <td>${hrs!=null?fv(hrs,2):dash()}</td>
            <td>${rate>0?fv(rate,2):dash()}</td>
            <td style="${bg(cplhPct)}">${cplhPct>0?cplhPct.toFixed(1)+'%':dash()}</td>
            ${totalPlanTd}
            <td style="${varBg(hoursVar)}">${hoursVar!=null?fv(hoursVar,2):dash()}</td>
            ${bridge(slug(label))}
        </tr>`;
    }
    // THROUGHPUT = all hours; volume = IB volume + DA volume (real throughput).
    function throughputRow(){
        // Volume: cases-basis site volume = IB volume rows + DA volume rows (unchanged basis).
        const vol=(sumVol(IB_VOL_ROWS)||0)+(sumVol(DA_VOL_ROWS)||0);
        // Hours: the PPR THROUGHPUT row's OWN hours (NOT sum of every row's hours).
        const tp=ppr['THROUGHPUT']||{};
        const tHrs=(ppr['THROUGHPUT']&&ppr['THROUGHPUT'].hrs)||0;
        let rate=tHrs>0?vol/tHrs:0;
        // ROBUSTNESS fallback: if PPR THROUGHPUT hours are missing, fall back to the Sync tab's
        // already-rendered Site CPLH so the row still shows ~15.9.
        if(!(rate>0)){const sv=parseFloat(document.getElementById('site-cplh-value')?.textContent);if(sv>0)rate=sv;}
        // % to LP against the cached LP SITE CPLH target (e.g. 19.56), NOT the PPR ratio.
        const pct=(siteLpCplh>0&&rate>0)?(rate/siteLpCplh)*100:0;
        // Hours Variance = SUM over ALL rows (IB + DA + OTHER) of (vol/planRate - hrs)
        // (Excel column M site total), using each PPR line item's OWN raw volume and plan rate.
        const allNames=IB_ROWS.concat(DA_ROWS,OTHER_ROWS).map(r=>r[1]);
        let tphVar=0, tphHas=false;
        allNames.forEach(n=>{const dd=ppr[n]; if(dd){const vv=(dd.vol!=null)?dd.vol:0; const pr=(dd.planRate!=null)?dd.planRate:0; const hh=(dd.hrs!=null)?dd.hrs:0; const rv=(pr>0)?((vv/pr)-hh):(hh>0?-hh:0); tphVar+=rv; tphHas=true;}});
        // OPTION 1: swap BOTH CTI and TOP contributions in the throughput TOTAL from their old
        // column-M values to the labor-plan values, same as the IB/DA totals. Each swap applies
        // only when that path's labor-plan value is available.
        if(tphHas){['Case Transfer In','Transfer Out Pick - Total'].forEach(k=>{const lpv=laborPlanVar(k);if(lpv!=null){tphVar=tphVar-colMVar(k)+lpv;}});}
        const hv=tphHas?tphVar:null;
        // % to Daily Plan for THROUGHPUT = total throughput volume vs the COMBINED daily plan
        // (IB LP Target + OB LP Target). Mirrors dailyPlanCell's render (%, "plan X" line, bg
        // coloring, muted placeholder when the combined target isn't set). Targets come from the
        // manual IB/DA inputs via alpsTargetByName (keyed by the two comparison-row names).
        const ibTgt=alpsTargetByName['Case Transfer In'];
        const daTgt=alpsTargetByName['Transfer Out Pick - Total'];
        const combinedTgt=((ibTgt!=null&&ibTgt>0)?ibTgt:0)+((daTgt!=null&&daTgt>0)?daTgt:0);
        let tpDailyPlanTd;
        if(combinedTgt>0&&vol>0){
            const tpPct=vol/combinedTgt*100;
            tpDailyPlanTd='<td style="'+bg(tpPct)+'" title="Combined daily plan (IB+OB) \u2014 actual vol '+Number(vol).toLocaleString()+' / target '+Number(combinedTgt).toLocaleString()+'">'+tpPct.toFixed(1)+'%<br><span style="font-size:9px;opacity:0.8;">plan '+fv(combinedTgt)+'</span></td>';
        }else{
            tpDailyPlanTd='<td style="opacity:0.5;" title="Combined daily plan unavailable \u2014 enter IB and OB LP Targets">\u2014</td>';
        }
        dbg('[SB-EOS throughput] vol='+vol+' tHrs='+tHrs+' rate='+rate.toFixed(2)+' siteLpCplh='+siteLpCplh+' => %toLP='+pct.toFixed(1)+'% (sync site-cplh-value='+(document.getElementById('site-cplh-value')?.textContent)+') combinedPlanTgt='+combinedTgt);
        return `<tr style="font-weight:700;border-top:3px solid #000;background:rgba(123,31,162,0.10);">
            <td style="text-align:left;">THROUGHPUT</td><td>${vol>0?fv(vol):dash()}</td><td>${tHrs>0?fv(tHrs,2):dash()}</td><td>${rate>0?fv(rate,2):dash()}</td>
            <td style="${bg(pct)}">${siteLpCplh>0?`<span style="font-size:9px;opacity:0.7;display:block;">LP ${fv(siteLpCplh,2)}</span>`:''}${pct>0?pct.toFixed(1)+'%':dash()}</td>
            ${tpDailyPlanTd}
            <td style="${varBg(hv)}">${hv!=null?fv(hv,2):dash()}</td>${bridge('throughput')}
        </tr>`;
    }

    // Compact support/indirect row: Hours + Hours Variance + Bridge only. NO Volume/Rate/%
    // cells (so no blank squares). Rendered under a sub-header within the IB/OB section.
    function supportRow(label,pprName){
        const d=ppr[pprName]||{};
        const hrs=d.hrs;
        // Hours Variance = (vol/planRate) - hrs (Excel column M). Support rows typically have
        // 0 vol / no plan rate, so this yields -hrs. Uses the PPR's OWN raw d.vol / d.planRate.
        const hvHrs=(d.hrs!=null)?d.hrs:0;
        const hvPlanRate=(d.planRate!=null)?d.planRate:0;
        const hvVol=(d.vol!=null)?d.vol:0;
        const hoursVar=(hvPlanRate>0)?((hvVol/hvPlanRate)-hvHrs):(hvHrs>0?-hvHrs:null);
        return `<tr>
            <td style="text-align:left;">${label}</td>
            <td>${hrs!=null?fv(hrs,2):dash()}</td>
            <td style="${varBg(hoursVar)}">${hoursVar!=null?fv(hoursVar,2):dash()}</td>
            ${bridge(slug(label))}
        </tr>`;
    }
    // Header for the volume group (full columns) and the compact support group.
    const volHead='<tr><th style="text-align:left;">Process Path</th><th>Volume</th><th>Hours</th><th>Rate</th><th>% to LP</th><th>% to Daily Plan</th><th>Hours Variance</th><th style="min-width:220px;">Bridge</th></tr>';
    const supHead='<tr><th style="text-align:left;">Support / Indirect</th><th>Hours</th><th>Hours Variance</th><th style="min-width:220px;">Bridge</th></tr>';
    // Builds one section (IB or OB): a volume table (full cols) + a compact support table, both
    // under the one section header. Support group is omitted entirely if it has no rows.
    function section(sectionClass,title,rows,totalHTML){
        const volRows=rows.filter(r=>r[2]);
        const supRows=rows.filter(r=>!r[2]);
        let html='<section class="eoswash-section '+sectionClass+'"><h3>'+title+'</h3>';
        // (1) Volume table — volume rows only, NO total row here.
        html+='<table class="metrics-table eos-vol-table"><tbody>'+volHead+volRows.map(r=>procRow(r[0],r[1])).join('')+'</tbody></table>';
        // (2) Support / indirect group (omitted when empty).
        if(supRows.length){
            html+='<div class="eos-support-label">Support / Indirect (hours only)</div>';
            html+='<table class="metrics-table eos-support-table"><tbody>'+supHead+supRows.map(r=>supportRow(r[0],r[1])).join('')+'</tbody></table>';
        }
        // (3) TOTAL row LAST, in a volume-structured table so its 8 cells align under the
        // volume columns (same metrics-table + eos-vol-table + volHead widths).
        html+='<table class="metrics-table eos-vol-table"><tbody>'+volHead+totalHTML+'</tbody></table>';
        html+='</section>';
        return html;
    }
    const th='<thead><tr><th style="text-align:left;">Process Path</th><th>Volume</th><th>Hours</th><th>Rate</th><th>% to LP</th><th>% to Daily Plan</th><th>Hours Variance</th><th style="min-width:220px;">Bridge</th></tr></thead>';
    // Manual Bridge note (wraps text), keyed per row so it saves/restores like the other manual fields.
    const bridge=(key)=>`<td><textarea class="support-input eos-manual eos-bridge-ta" id="eos-bridge-${key}" placeholder="notes\u2026" rows="2" style="width:100%;box-sizing:border-box;background:#ffffcc;color:#000;border:1px solid #999;border-radius:3px;resize:vertical;white-space:pre-wrap;word-wrap:break-word;font-family:inherit;"></textarea></td>`;
    const slug=(s)=>s.replace(/[^a-z0-9]+/gi,'-').toLowerCase();

    // Shift Accuracy: Actual VOLUME = real throughput volume rows only; CPLH = vol / total hours.
    const ibActVol=sumVol(IB_VOL_ROWS)||0;
    const ibActHrs=sumHrs(IB_ROWS.map(r=>r[1]))||0;
    const ibActCplh=ibActHrs>0?ibActVol/ibActHrs:0;
    const daActVol=sumVol(DA_VOL_ROWS)||0;
    const daActHrs=sumHrs(DA_ROWS.map(r=>r[1]))||0;
    const daActCplh=daActHrs>0?daActVol/daActHrs:0;
    const accRow=(label,plan,act,dec=0,pctHigh=true)=>{
        const varc=(plan&&act)?((pctHigh?act/plan:plan/act)*100):0;
        return `<tr><td>${label}</td><td>${plan?fv(plan,dec):'\u2014'}</td><td>${act?fv(act,dec):'\u2014'}</td><td style="${bg(varc)}">${varc>0?varc.toFixed(1)+'%':'\u2014'}</td></tr>`;
    };
    const accuracyHTML=`<section class="eoswash-section">
        <h3>Shift Accuracy</h3>
        <table class="metrics-table eos-accuracy-table"><thead><tr><th>Metric</th><th>Plan</th><th>Actual</th><th>% to Plan</th></tr></thead><tbody>
        ${accRow('IB 24hr BB',ibBB,ibActVol)}
        ${accRow('IB Shift LP BB',eosLpTargetIB,ibActVol)}
        ${accRow('IB Shift Plan',ibPlan,ibActVol)}
        ${accRow('IB CPLH',ibCplh,ibActCplh,2)}
        <tr><td colspan="4" style="height:6px;background:#888;"></td></tr>
        ${accRow('OB 24hr BB',daBB,daActVol)}
        ${accRow('OB Shift LP BB',eosLpTargetDA,daActVol)}
        ${accRow('DA Shift Plan',daPlan,daActVol)}
        ${accRow('DA CPLH',daCplh,daActCplh,2)}
        </tbody></table>
        <div style="font-size:10px;color:#888;margin-top:6px;">Plan values are read from the Sync tab targets.</div>
    </section>`;

    // INBOUND (blue) and OUTBOUND (orange): each has a volume table + a compact support group.
    // SUPPORT/THROUGHPUT (purple): site-level indirect (Non-FC, Admin) + the THROUGHPUT total.
    const ibTotal=totalRow('IB TOTAL',IB_ROWS.map(r=>r[1]),IB_VOL_ROWS,ibPlan,ibCplh,'');
    const daTotal=totalRow('DA TOTAL',DA_ROWS.map(r=>r[1]),DA_VOL_ROWS,daPlan,daCplh,'');
    const processHTML=
        section('eos-ib-section','INBOUND',IB_ROWS,ibTotal)+
        section('eos-da-section','OUTBOUND',DA_ROWS,daTotal)+
    `<section class="eoswash-section eos-support-section">
        <h3>SITE INDIRECT / THROUGHPUT</h3>
        <div class="eos-support-label">Support / Indirect (hours only)</div>
        <table class="metrics-table eos-support-table"><tbody>
        ${supHead}
        ${OTHER_ROWS.map(r=>supportRow(r[0],r[1])).join('')}
        </tbody></table>
        <table class="metrics-table eos-vol-table" style="margin-top:8px;"><tbody>
        ${volHead}
        ${throughputRow()}
        </tbody></table>
    </section>`;

    // ---- Manual-entry sections (saved via the existing support-input mechanism) ----
    // These will be automated later; for now they're editable inputs that persist.
    const inp=(id,ph='')=>`<input type="text" class="support-input eos-manual" id="${id}" placeholder="${ph}" style="width:100%;box-sizing:border-box;background:#ffffcc;color:#000;border:1px solid #999;border-radius:3px;">`;
    const backlogHTML=`<section class="eoswash-section">
        <h3>Backlog</h3>
        <table class="metrics-table"><thead><tr><th style="text-align:left;">Dept</th><th>Units</th><th>Cases</th><th>Days in Units</th><th>Days in Cases</th><th>IPT Backlog</th></tr></thead><tbody>
        <tr><td style="text-align:left;">Inbound Backlog</td><td>${inp('eos-bl-ib-units')}</td><td>${inp('eos-bl-ib-cases')}</td><td>${inp('eos-bl-ib-dunits')}</td><td>${inp('eos-bl-ib-dcases')}</td><td rowspan="2" style="vertical-align:middle;">${inp('eos-bl-ipt')}</td></tr>
        <tr><td style="text-align:left;">DA Backlog</td><td>${inp('eos-bl-da-units')}</td><td>${inp('eos-bl-da-cases')}</td><td>${inp('eos-bl-da-dunits')}</td><td>${inp('eos-bl-da-dcases')}</td></tr>
        </tbody></table>
    </section>`;

    const qualityHTML=`<section class="eoswash-section">
        <h3>Quality</h3>
        <div class="eoswash-grid">
          <div>
            <h4 style="font-size:12px;margin:0 0 4px;">Atlas Breakdown</h4>
            <table class="metrics-table"><thead><tr><th style="text-align:left;">Metric</th><th>Threshold</th><th>DPMO</th></tr></thead><tbody>
            <tr><td style="text-align:left;">Bin Collisions</td><td>${inp('eos-q-bincol-thr')}</td><td>${inp('eos-q-bincol-dpmo')}</td></tr>
            <tr><td style="text-align:left;">Ship Failed Moves</td><td>${inp('eos-q-shipfail-thr')}</td><td>${inp('eos-q-shipfail-dpmo')}</td></tr>
            </tbody></table>
          </div>
          <div>
            <h4 style="font-size:12px;margin:0 0 4px;">ICQA Execution</h4>
            <table class="metrics-table"><tbody>
            <tr><td style="text-align:left;">ICQA Plan Rate</td><td>${inp('eos-q-icqa-plan')}</td></tr>
            <tr><td style="text-align:left;">ICQA Actual Hours</td><td>${inp('eos-q-icqa-hrs')}</td></tr>
            <tr><td style="text-align:left;">ICQA Actual Rate</td><td>${inp('eos-q-icqa-rate')}</td></tr>
            <tr><td style="text-align:left;">ICQA % to RO</td><td>${inp('eos-q-icqa-ro')}</td></tr>
            </tbody></table>
          </div>
          <div>
            <h4 style="font-size:12px;margin:0 0 4px;">Piles</h4>
            <table class="metrics-table"><tbody>
            <tr><td style="text-align:left;">IB Problem Solve</td><td>${inp('eos-q-piles-ibps')}</td></tr>
            <tr id="eos-pile-ibps-note-row" style="display:none;"><td colspan="2" style="text-align:left;">
              <label style="display:block;font-size:10px;color:#842029;margin:0 0 2px;">Reason (over threshold):</label>
              <textarea class="support-input eos-manual" id="eos-q-piles-ibps-note" placeholder="Explain why piles are over threshold\u2026" rows="2" style="width:100%;box-sizing:border-box;background:#ffffcc;color:#000;border:1px solid #999;border-radius:3px;resize:vertical;"></textarea>
            </td></tr>
            <tr><td style="text-align:left;">Damages</td><td>${inp('eos-q-piles-dmg')}</td></tr>
            <tr id="eos-pile-dmg-note-row" style="display:none;"><td colspan="2" style="text-align:left;">
              <label style="display:block;font-size:10px;color:#842029;margin:0 0 2px;">Reason (over threshold):</label>
              <textarea class="support-input eos-manual" id="eos-q-piles-dmg-note" placeholder="Explain why damages are over threshold\u2026" rows="2" style="width:100%;box-sizing:border-box;background:#ffffcc;color:#000;border:1px solid #999;border-radius:3px;resize:vertical;"></textarea>
            </td></tr>
            <tr><td style="text-align:left;">DA Problem Solve</td><td>${inp('eos-q-piles-daps')}</td></tr>
            <tr id="eos-pile-daps-note-row" style="display:none;"><td colspan="2" style="text-align:left;">
              <label style="display:block;font-size:10px;color:#842029;margin:0 0 2px;">Reason (over threshold):</label>
              <textarea class="support-input eos-manual" id="eos-q-piles-daps-note" placeholder="Explain why piles are over threshold\u2026" rows="2" style="width:100%;box-sizing:border-box;background:#ffffcc;color:#000;border:1px solid #999;border-radius:3px;resize:vertical;"></textarea>
            </td></tr>
            <tr id="eos-pile-sortps-row"><td style="text-align:left;">Sort Problem Solve</td><td>${inp('eos-q-piles-sortps')}</td></tr>
            <tr id="eos-pile-sortps-note-row" style="display:none;"><td colspan="2" style="text-align:left;">
              <label style="display:block;font-size:10px;color:#842029;margin:0 0 2px;">Reason (over threshold):</label>
              <textarea class="support-input eos-manual" id="eos-q-piles-sortps-note" placeholder="Explain why piles are over threshold\u2026" rows="2" style="width:100%;box-sizing:border-box;background:#ffffcc;color:#000;border:1px solid #999;border-radius:3px;resize:vertical;"></textarea>
            </td></tr>
            </tbody></table>
          </div>
        </div>
    </section>`;

    // Safety: 5 editable leader rows.
    const safetyRows=[0,1,2,3,4].map(i=>`<tr>
        <td>${inp('eos-sf-name-'+i)}</td><td>${inp('eos-sf-rbi-'+i)}</td><td>${inp('eos-sf-audit-'+i)}</td><td>${inp('eos-sf-icare-'+i)}</td><td>${inp('eos-sf-pa-'+i)}</td><td>${inp('eos-sf-arc-'+i)}</td><td>${inp('eos-sf-bridge-'+i)}</td>
    </tr>`).join('');
    const safetyHTML=`<section class="eoswash-section eos-safety-section">
        <h3>Safety Summary</h3>
        <table class="metrics-table"><thead><tr><th style="text-align:left;">Leader Name</th><th>Weekly RBI</th><th>Trailer Audits</th><th>I-Care</th><th>PA Name</th><th>Daily ARC</th><th>Bridge</th></tr></thead><tbody>
        ${safetyRows}
        </tbody></table>
    </section>`;

    content.innerHTML=accuracyHTML+processHTML+backlogHTML+qualityHTML+safetyHTML;

    // Restore saved manual values and wire change-to-save (inputs are created dynamically,
    // so the initBoard-time listener doesn't cover them).
    const sup=loadSupport();
    content.querySelectorAll('.eos-manual').forEach(el=>{
        if(sup[el.id]!=null)el.value=sup[el.id];
        el.addEventListener('change',()=>{
            const d=loadSupport();
            document.querySelectorAll('.support-input,.callout-textarea,.eos-manual').forEach(e=>{if(e.id)d[e.id]=e.value;});
            saveSupport(d);
        });
        // Bridge note textareas auto-grow to fit their text (no inner scrollbar): grow on input
        // and once now so a restored/pre-filled note shows in full on load.
        if(el.classList.contains('eos-bridge-ta')){
            const autoGrow=()=>{el.style.height='auto';el.style.height=(el.scrollHeight)+'px';el.style.overflowY='hidden';};
            el.addEventListener('input',autoGrow);
            autoGrow();
        }
    });

    // --- Piles thresholds: red cell + reveal a reason note when value is OVER the threshold ---
    // Per-row threshold (value STRICTLY over it is "over"): IB PS / DA PS / Sort PS = 0 (any value
    // > 0 is over); Damages = 5 (only > 5 is over).
    const PILE_OK_BG='#ffffcc';   // normal eos-manual yellow
    function updatePilesThreshold(){
        const specs=[
            {inp:'eos-q-piles-ibps',  note:'eos-pile-ibps-note-row',  thresh:0},
            {inp:'eos-q-piles-dmg',   note:'eos-pile-dmg-note-row',   thresh:5},
            {inp:'eos-q-piles-daps',  note:'eos-pile-daps-note-row',  thresh:0},
            {inp:'eos-q-piles-sortps',note:'eos-pile-sortps-note-row',thresh:0}
        ];
        specs.forEach(s=>{
            const el=document.getElementById(s.inp);
            const noteRow=document.getElementById(s.note);
            if(!el)return;
            const n=parseFloat((el.value||'').toString().replace(/,/g,''));
            const over=Number.isFinite(n)&&n>s.thresh;
            if(over){
                el.style.background='#f8d7da';
                el.style.color='#842029';
                el.style.borderColor='#c62828';
            }else{
                el.style.background=PILE_OK_BG;
                el.style.color='#000';
                el.style.borderColor='#999';
            }
            if(noteRow)noteRow.style.display=over?'':'none';
        });
    }
    // Additional live-update 'input' listeners (persistence 'change' listeners above are untouched).
    ['eos-q-piles-ibps','eos-q-piles-dmg','eos-q-piles-daps','eos-q-piles-sortps'].forEach(id=>{
        const el=document.getElementById(id);
        if(el)el.addEventListener('input',updatePilesThreshold);
    });
    updatePilesThreshold(); // initial state from persisted values

    // Auto-hide "Sort Problem Solve" when the site has no sort data (e.g. KRB3),
    // mirroring renderSort's hasData rule: f.totalUnits>0 || f.directHours>0.
    (function(){
        const sortRow=document.getElementById('eos-pile-sortps-row');
        const sortNoteRow=document.getElementById('eos-pile-sortps-note-row');
        let hasSort=true; // fail-soft default: show on uncertainty
        try{
            const f=currentMetrics&&currentMetrics.sort&&currentMetrics.sort.full;
            if(f&&typeof f==='object'){
                hasSort=((f.totalUnits>0)||(f.directHours>0));
            }
            // If currentMetrics/sort/full is absent, hasSort stays true (show).
        }catch(e){hasSort=true;}
        if(sortRow)sortRow.style.display=hasSort?'':'none';
        if(sortNoteRow&&!hasSort)sortNoteRow.style.display='none';
        // When sort data IS present, the note row visibility is governed solely by
        // updatePilesThreshold() above — do not force it visible here.
    })();

    // Auto-fill ICQA Quality fields from the Sync tab's live ICQA panel. Auto-filled values are
    // LOCKED (read-only) so they can't be manually changed.
    const txt=id=>{const e=document.getElementById(id);return e?(e.textContent||'').trim():'';};
    const autofill=(targetId,val)=>{const el=document.getElementById(targetId);if(el&&val!=null&&val!==''&&val!=='\u2014'){el.value=val;el.readOnly=true;el.style.background='#e8f5e9';el.style.cursor='not-allowed';el.title='Auto-filled from live data';}};
    autofill('eos-q-icqa-plan',txt('icqa-ro-target-display'));   // RO / plan target (e.g. 2,400)
    autofill('eos-q-icqa-rate',txt('icqa-ro-shift-actual'));     // shift RO rate (actual, e.g. 2,576.61)
    autofill('eos-q-icqa-ro',txt('icqa-ro-shift-pct'));          // shift % to RO (e.g. 107.4%)
    // ICQA Actual Hours = FCLM ICQA total hours (the DC% denominator computed in fetchIcqaDC).
    if(typeof window._icqaTotalHours==='number'&&window._icqaTotalHours>0){
        autofill('eos-q-icqa-hrs',window._icqaTotalHours.toFixed(2));
    }
    window.scrollTo(0,0);
}

// Capture the EOS Wash as an image, copy it to the clipboard, and open an email addressed to
// the site's boss ({SITE}-boss@amazon.com). The user pastes the image into the email body.
function emailEOSWash(){
    const content=document.getElementById('eoswash-content');
    const btn=document.getElementById('btn-email-eoswash');
    if(!content||content.innerHTML.trim()===''){alert('Fetch the EOS Wash first, then email.');return;}
    if(typeof html2canvas==='undefined'){alert('Screenshot library still loading. Try again in a moment.');return;}
    const config=loadConfig();
    const site=(config.site||'').toUpperCase();
    const to=site?`${site}-boss@amazon.com`:'';
    const shift=config.shiftType||'';
    const dateStr=new Date().toLocaleDateString();
    const subject=`${site} EOS Wash \u2013 ${shift} \u2013 ${dateStr}`;
    const isDark=document.getElementById('sb-root')?.classList.contains('dark-mode');
    if(btn){btn.disabled=true;btn.textContent='\u23F3 Capturing...';}
    // Give the browser a tick, then capture.
    setTimeout(()=>{
        html2canvas(content,{backgroundColor:isDark?'#1a1a2e':'#ffffff',scale:1,useCORS:true,logging:false,windowWidth:content.scrollWidth,windowHeight:content.scrollHeight}).then(canvas=>{
            // Build an .eml file (standard email format) with the EOS Wash image embedded inline
            // in the HTML body. Opening the .eml launches the DESKTOP Outlook app with a new
            // message already addressed, subjected, and containing the image — ready to send.
            const dataUrl=canvas.toDataURL('image/png');
            const b64=dataUrl.split(',')[1];
            const cid='eoswash_'+Date.now();
            const boundary='----=_SB_'+Date.now();
            const htmlBody=''+
                '<html><body style="font-family:Calibri,Arial,sans-serif;font-size:11pt;">'+
                'KRB team,<br><br>Please see the '+site+' EOS Wash below.<br><br>'+
                '<img src="cid:'+cid+'" style="max-width:100%;"><br><br>'+
                'Thank you,<br></body></html>';
            // CRLF line endings are required by the .eml (RFC 822) format.
            const CRLF='\r\n';
            const eml=[
                'To: '+to,
                'Subject: '+subject,
                'X-Unsent: 1',                 // tells Outlook this is an unsent draft to open in compose
                'Content-Type: multipart/related; boundary="'+boundary+'"',
                '',
                '--'+boundary,
                'Content-Type: text/html; charset="utf-8"',
                'Content-Transfer-Encoding: 7bit',
                '',
                htmlBody,
                '',
                '--'+boundary,
                'Content-Type: image/png; name="EOSWash.png"',
                'Content-Transfer-Encoding: base64',
                'Content-ID: <'+cid+'>',
                'Content-Disposition: inline; filename="EOSWash.png"',
                '',
                b64.replace(/(.{76})/g,'$1'+CRLF),
                '',
                '--'+boundary+'--',
                ''
            ].join(CRLF);
            const blob=new Blob([eml],{type:'message/rfc822'});
            const url=URL.createObjectURL(blob);
            const a=document.createElement('a');
            a.href=url;
            a.download=(site||'EOS')+'_EOS_Wash_'+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.eml';
            document.body.appendChild(a);a.click();document.body.removeChild(a);
            setTimeout(()=>URL.revokeObjectURL(url),4000);
            if(btn){btn.textContent='\u2713 Opening Outlook\u2026';setTimeout(()=>{btn.textContent='\u2709 Email';btn.disabled=false;},4000);}
        }).catch(e=>{
            console.error('[SB-EOS] email capture failed:',e);
            if(btn){btn.textContent='\u2709 Email';btn.disabled=false;}
            alert('Screenshot failed: '+e.message);
        });
    },150);
}

// === BOOT ===
let boardActive=false, currentMetrics=null, config=loadConfig(), originalBody='';
// Holds the last-fetched hourly data + slot count so the dark/day toggle can re-render the
// Hourly tab colors without re-fetching (mirrors how currentMetrics re-renders the Sync tab).
let currentHourly=null;
// Holds the last-fetched EOS Wash PPR data so the dark/day toggle can re-render without re-fetching.
let currentEOSWash=null;
// Holds the last-fetched VRETs weekly data so the dark/day toggle can re-render without re-fetching.
let currentVRETs=null;
// Holds the last-fetched Fast Start result so it can be re-applied after async renders settle.
let currentFastStart=null;

function addLaunchBtn(){
    // Inject the launch button's animation/style once (keyframes can't live in inline cssText).
    if(!document.getElementById('sb-launch-style')){
        const st=document.createElement('style');st.id='sb-launch-style';
        st.textContent=
            // Pulsing multi-layer glow
            '@keyframes sbLaunchGlow{0%,100%{box-shadow:0 10px 30px rgba(74,158,255,.6),0 0 0 0 rgba(0,198,255,.55);}50%{box-shadow:0 16px 44px rgba(0,198,255,.95),0 0 0 16px rgba(0,198,255,0);}}'+
            // Gentle float
            '@keyframes sbLaunchFloat{0%,100%{transform:translateY(0);}50%{transform:translateY(-6px);}}'+
            // Rotating conic halo behind the button
            '@keyframes sbLaunchSpin{to{transform:rotate(1turn);}}'+
            // Shimmer sweep across the face
            '@keyframes sbLaunchShimmer{0%{left:-60%;}60%,100%{left:140%;}}'+
            // Default: right edge, vertically centered (clear of FCLM's top search box, the
            // bottom-left "Analyze Fast Starts" button, and the data table). Draggable; a saved
            // position overrides this via the inline style set below.
            '#sb-launch{position:fixed;top:50%;right:20px;transform:translateY(-50%);z-index:99999;display:flex;align-items:center;gap:12px;'+
            'padding:18px 34px;border-radius:60px;cursor:grab;color:#fff;overflow:hidden;isolation:isolate;'+
            "font:900 23px/1 'Segoe UI',sans-serif;letter-spacing:.5px;white-space:nowrap;text-shadow:0 2px 6px rgba(0,0,0,.35);"+
            'background:linear-gradient(135deg,#0d47a1 0%,#1565c0 35%,#4a9eff 65%,#00c6ff 100%);'+
            'border:3px solid rgba(255,255,255,.45);'+
            'animation:sbLaunchGlow 2.2s ease-in-out infinite;'+
            'transition:box-shadow .2s ease;user-select:none;}'+
            '#sb-launch.sb-dragging{cursor:grabbing;animation:none;opacity:.92;}'+
            '#sb-launch .sb-launch-grip{font-size:18px;opacity:.75;position:relative;z-index:2;cursor:grab;margin-right:-2px;}'+
            // Rotating conic-gradient halo ring (sits behind via ::before)
            '#sb-launch::before{content:"";position:absolute;inset:-3px;border-radius:inherit;z-index:-1;'+
            'background:conic-gradient(from 0deg,#00c6ff,#4a9eff,#8e44ff,#00c6ff);'+
            'animation:sbLaunchSpin 4s linear infinite;filter:blur(6px);opacity:.75;}'+
            // Diagonal shimmer streak sweeping across
            '#sb-launch::after{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;z-index:1;pointer-events:none;'+
            'background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);'+
            'animation:sbLaunchShimmer 3.4s ease-in-out infinite;}'+
            '#sb-launch:hover{filter:brightness(1.08);}'+
            '#sb-launch .sb-launch-icon{font-size:28px;line-height:1;position:relative;z-index:2;}'+
            '#sb-launch .sb-launch-text{position:relative;z-index:2;}';
        document.head.appendChild(st);
    }
    const b=document.createElement('div');b.id='sb-launch';
    b.innerHTML='<span class="sb-launch-grip" title="Drag to move">\u2630</span><span class="sb-launch-icon">\u{1F3ED}</span><span class="sb-launch-text">Sync Board</span>';
    document.body.appendChild(b);
    // Restore a saved position (if the user dragged it before). Stored as {left,top} px.
    try{
        const pos=JSON.parse(localStorage.getItem('syncboard_launch_pos')||'null');
        if(pos&&typeof pos.left==='number'&&typeof pos.top==='number'){
            b.style.left=pos.left+'px';b.style.top=pos.top+'px';b.style.transform='none';
        }
    }catch(e){}
    makeLaunchDraggable(b);
}

// Drag-to-move for the launch button. Distinguishes a click (launch the board) from a drag
// (reposition + save). Keeps the button on-screen and persists {left,top} to localStorage.
function makeLaunchDraggable(b){
    let dragging=false,moved=false,sx=0,sy=0,ox=0,oy=0;
    const onDown=(e)=>{
        const pt=e.touches?e.touches[0]:e;
        dragging=true;moved=false;
        const r=b.getBoundingClientRect();
        ox=r.left;oy=r.top;sx=pt.clientX;sy=pt.clientY;
        // Switch to left/top positioning so dragging is 1:1 (drop the translateX centering).
        b.style.left=ox+'px';b.style.top=oy+'px';b.style.transform='none';
        b.classList.add('sb-dragging');
        document.addEventListener('mousemove',onMove);document.addEventListener('mouseup',onUp);
        document.addEventListener('touchmove',onMove,{passive:false});document.addEventListener('touchend',onUp);
        e.preventDefault();
    };
    const onMove=(e)=>{
        if(!dragging)return;
        const pt=e.touches?e.touches[0]:e;
        const dx=pt.clientX-sx,dy=pt.clientY-sy;
        if(Math.abs(dx)>4||Math.abs(dy)>4)moved=true;
        let nl=ox+dx,nt=oy+dy;
        // Keep it fully on-screen.
        const w=b.offsetWidth,h=b.offsetHeight;
        nl=Math.max(4,Math.min(nl,window.innerWidth-w-4));
        nt=Math.max(4,Math.min(nt,window.innerHeight-h-4));
        b.style.left=nl+'px';b.style.top=nt+'px';
        if(e.cancelable)e.preventDefault();
    };
    const onUp=()=>{
        if(!dragging)return;dragging=false;b.classList.remove('sb-dragging');
        document.removeEventListener('mousemove',onMove);document.removeEventListener('mouseup',onUp);
        document.removeEventListener('touchmove',onMove);document.removeEventListener('touchend',onUp);
        if(moved){
            try{localStorage.setItem('syncboard_launch_pos',JSON.stringify({left:parseFloat(b.style.left)||0,top:parseFloat(b.style.top)||0}));}catch(e){}
        }
    };
    b.addEventListener('mousedown',onDown);
    b.addEventListener('touchstart',onDown,{passive:false});
    // Click launches the board ONLY if it wasn't a drag.
    b.addEventListener('click',()=>{if(!moved)launch();});
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
    ['icqa-ro-shift-actual','icqa-ro-shift-pct','icqa-ro-week-actual','icqa-ro-week-pct','atlas-binc-value','atlas-binc-threshold','atlas-binc-count','atlas-shipfm-value','atlas-shipfm-threshold','atlas-shipfm-count'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.style.color='';el.classList.remove('pct-good','pct-warn','pct-bad');}});
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
    ['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-density-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-density-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target','site-cplh-target','dept-ib-units','dept-ib-cases','dept-ib-days-units','dept-ib-days-cases','dept-ib-ipt','dept-da-units','dept-da-cases','dept-da-days-units','dept-da-days-cases','dept-da-ipt'].forEach(id=>{const el=document.getElementById(id);if(el&&t[id])el.value=t[id];});
    // Load settings
    const ds=config.days,ns=config.nights;
    ['ds-full-sh','ds-full-sm','ds-full-eh','ds-full-em','ds-p1-sh','ds-p1-sm','ds-p1-eh','ds-p1-em','ds-p2-sh','ds-p2-sm','ds-p2-eh','ds-p2-em','ds-p3-sh','ds-p3-sm','ds-p3-eh','ds-p3-em'].forEach((id,i)=>{const vals=[ds.full.sh,ds.full.sm,ds.full.eh,ds.full.em,ds.p1.sh,ds.p1.sm,ds.p1.eh,ds.p1.em,ds.p2.sh,ds.p2.sm,ds.p2.eh,ds.p2.em,ds.p3.sh,ds.p3.sm,ds.p3.eh,ds.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    ['ns-full-sh','ns-full-sm','ns-full-eh','ns-full-em','ns-p1-sh','ns-p1-sm','ns-p1-eh','ns-p1-em','ns-p2-sh','ns-p2-sm','ns-p2-eh','ns-p2-em','ns-p3-sh','ns-p3-sm','ns-p3-eh','ns-p3-em'].forEach((id,i)=>{const vals=[ns.full.sh,ns.full.sm,ns.full.eh,ns.full.em,ns.p1.sh,ns.p1.sm,ns.p1.eh,ns.p1.em,ns.p2.sh,ns.p2.sm,ns.p2.eh,ns.p2.em,ns.p3.sh,ns.p3.sm,ns.p3.eh,ns.p3.em];const el=document.getElementById(id);if(el)el.value=vals[i];});
    document.getElementById('settings-sched-type').value=config.schedType||'3P';
    updateTargetRows();
    // Seed the Shift Plan Targets panel's LP rows from cached LP values so they show on load
    // (before a fresh Get Data). renderLPPercents refreshes them once metrics come in.
    seedShiftPlanLPRows();
    // Events
    document.getElementById('btn-fetch').onclick=doFetch;
    document.getElementById('btn-exit').onclick=exitBoard;
    document.getElementById('btn-snip').onclick=doSnip;
    document.getElementById('btn-dark').onclick=()=>{const root=document.getElementById('sb-root');root.classList.toggle('dark-mode');const isDark=root.classList.contains('dark-mode');localStorage.setItem('syncboard_dark',isDark?'1':'0');document.getElementById('btn-dark').textContent=isDark?'\u2600':'\u263D';if(currentMetrics){renderIB(currentMetrics);renderOB(currentMetrics);renderLPPercents(currentMetrics);renderCharts(currentMetrics);}
        // Re-render the Hourly tab too (colors follow day/dark) without re-fetching.
        if(currentHourly&&currentHourly.data){renderHourlyTables(currentHourly.data,currentHourly.totalHours);}
        // Re-render the EOS Wash tab colors on theme change.
        if(currentEOSWash){renderEOSWash(currentEOSWash);}
        // Re-render the VRETs tab AND the compact Sync-tab panel (delta color is theme-aware).
        if(currentVRETs){renderVRETsTab(currentVRETs);updateVRETsPanel(currentVRETs);}};
    // Restore dark mode preference
    if(localStorage.getItem('syncboard_dark')==='1'){document.getElementById('sb-root').classList.add('dark-mode');document.getElementById('btn-dark').textContent='\u2600';}
    document.getElementById('btn-fetch-hourly')?.addEventListener('click',fetchHourlyData);
    document.getElementById('btn-fetch-eoswash')?.addEventListener('click',fetchEOSWashData);
    document.getElementById('btn-fetch-faststart')?.addEventListener('click',fetchFastStartData);
    document.getElementById('btn-email-eoswash')?.addEventListener('click',emailEOSWash);
    initEosPlanInputs(); // seed + wire the manual IB/DA daily-plan target inputs
    document.getElementById('btn-fetch-vrets')?.addEventListener('click',fetchVRETsData);
    // Populate the VRETs week selector and default goal input on init.
    vretPopulateWeeks();
    { const gi=document.getElementById('vrets-goal-input'); if(gi&&!gi.value)gi.value=vretLoadGoal();
      if(gi)gi.addEventListener('change',()=>{vretSaveGoal(parseFloat(gi.value)||vretLoadGoal());if(currentVRETs){currentVRETs.goal=parseFloat(gi.value)||currentVRETs.goal;renderVRETsTab(currentVRETs);updateVRETsPanel(currentVRETs);}}); }
    // SOS cages (hourly Flow): prefill density from the site table + last saved counts; wire Save + Slack post.
    initSosControls();
    document.getElementById('btn-save-sos-ib')?.addEventListener('click',()=>saveSosFromUi('IB'));
    document.getElementById('btn-save-sos-ob')?.addEventListener('click',()=>saveSosFromUi('OB'));
    document.getElementById('btn-view-targets')?.addEventListener('click',()=>setDayView('targets'));
    document.getElementById('btn-view-current')?.addEventListener('click',()=>setDayView('current'));
    document.getElementById('btn-view-prior')?.addEventListener('click',()=>setDayView('prior'));
    document.getElementById('btn-clear-targets')?.addEventListener('click',()=>{
        ['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-density-target','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-density-target','sort-goal','sort-rate-target','dept-ib-units','dept-ib-cases','dept-ib-days-units','dept-ib-days-cases','dept-ib-ipt','dept-da-units','dept-da-cases','dept-da-days-units','dept-da-days-cases','dept-da-ipt'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
        saveTargetsUI();updateTargetRows();
        // Clear the % column displays
        ['ib-goal-pct','ib-rate-pct','ib-cplh-pct','ib-density-pct','ob-goal-pct','ob-rate-pct','ob-cplh-pct','ob-density-pct','sort-goal-pct','sort-rate-pct'].forEach(id=>{const el=document.getElementById(id);if(el){el.textContent='\u2014';el.classList.remove('pct-good','pct-warn','pct-bad');}});
    });
    document.getElementById('btn-add-action')?.addEventListener('click',()=>{const a=loadActions();a.push({item:'',owner:'',status:'Open'});saveActions(a);renderActions();});
    document.getElementById('btn-clear-actions')?.addEventListener('click',()=>{if(confirm('Clear all actions?')){saveActions([]);renderActions();}});
    document.getElementById('btn-save-settings')?.addEventListener('click',saveSettingsUI);
    // Prefill the Settings Slack fields from localStorage (the only place the URLs live).
    { const sos=document.getElementById('slack-sos-url'),jb=document.getElementById('slack-jobbalance-url');
      if(sos)sos.value=getSlackSosUrl();if(jb)jb.value=getSlackJobBalanceUrl(); }
    document.getElementById('btn-save-slack')?.addEventListener('click',()=>{
        const sos=(document.getElementById('slack-sos-url')?.value||'').trim();
        const jb=(document.getElementById('slack-jobbalance-url')?.value||'').trim();
        try{localStorage.setItem(SLACK_SOS_KEY,sos);localStorage.setItem(SLACK_JOB_BALANCE_KEY,jb);}catch(e){}
        const note=document.getElementById('slack-save-note');if(note){note.textContent='\u2713 Saved (this browser only)';setTimeout(()=>{note.textContent='';},2500);}
    });
    sel.onchange=e=>{config.site=e.target.value;if(SITE_SCHEDULES[config.site]){config.days=SITE_SCHEDULES[config.site].days;config.nights=SITE_SCHEDULES[config.site].nights;}saveConfig(config);refreshSettingsInputs();currentMetrics=null;clearBoard();updatePeriodDots();};
    document.getElementById('shift-select').onchange=e=>{config.shiftType=e.target.value;saveConfig(config);currentMetrics=null;clearBoard();updatePeriodDots();doFetch();};
    document.querySelectorAll('.target-input').forEach(inp=>{inp.addEventListener('input',updateTargetRows);inp.addEventListener('change',()=>{saveTargetsUI();if(currentMetrics)renderTargets(currentMetrics);});});
    // Dept Backlog inputs are manual-only; just persist them on change (no metric re-render).
    document.querySelectorAll('.dept-input').forEach(inp=>inp.addEventListener('change',saveTargetsUI));
    document.querySelectorAll('.nav-tab').forEach(tab=>tab.onclick=()=>{
        document.querySelectorAll('.nav-tab').forEach(t=>t.classList.remove('active'));
        // Clear any leftover inline display (an older build set style.display inline, which
        // overrides the CSS class and leaves a hidden tab still taking up space). Force each
        // non-selected tab to display:none inline, and the selected one to display:block.
        document.querySelectorAll('.tab-content').forEach(t=>{t.classList.remove('active');t.style.display='none';});
        tab.classList.add('active');
        const target=document.getElementById('tab-'+tab.dataset.tab);
        if(target){target.classList.add('active');target.style.display='block';}
        window.scrollTo(0,0);
        // Auto-load the Hourly tab the first time it's opened.
        if(tab.dataset.tab==='hourly'){
            const ht=document.getElementById('hourly-tables');
            if(ht&&ht.innerHTML.trim()===''){fetchHourlyData();}
        }
        // Auto-load the EOS Wash tab the first time it's opened.
        if(tab.dataset.tab==='eoswash'){
            const et=document.getElementById('eoswash-content');
            if(et&&et.innerHTML.trim()===''){fetchEOSWashData();}
        }
        // Prime the Fast Start tab controls the first time it's opened (no auto-fetch:
        // Fast Start is a heavy, on-demand query, so the user clicks Run themselves).
        if(tab.dataset.tab==='faststart'){
            initFastStartControls();
        }
        // Auto-load the VRETs tab the first time it's opened.
        if(tab.dataset.tab==='vrets'){
            vretPopulateWeeks();
            const vc=document.getElementById('vrets-content');
            if(vc&&vc.innerHTML.trim()===''){fetchVRETsData();}
        }
    });
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

// Undo anything doSnip() may have left behind if a capture was aborted or hung.
// A stuck Snip leaves #sb-root force-sized (min-width/width 1400px, height auto) and the
// #snip-fix <style> injected, which breaks the layout and pushes tab content below the fold.
function resetSnipState(){
    const root=document.getElementById('sb-root');
    if(root){root.style.overflow='';root.style.height='';root.style.minWidth='';root.style.width='';}
    const leftover=document.getElementById('snip-fix');
    if(leftover&&leftover.parentNode)leftover.parentNode.removeChild(leftover);
    const rp=root&&root.querySelector('.sync-right');
    if(rp){rp.style.position='';rp.style.maxHeight='';rp.style.overflow='';rp.style.top='';rp.style.minHeight='';}
    const sl=root&&root.querySelector('.sync-layout');
    if(sl){sl.style.gridTemplateColumns='';sl.style.alignItems='';}
    const btn=document.getElementById('btn-snip');
    if(btn){btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;}
}
function doSnip(){
    if(typeof html2canvas==='undefined'){alert('Screenshot library still loading. Try again in a moment.');return;}
    // Clear any leftover state from a previous aborted capture before starting a new one.
    resetSnipState();
    const root=document.getElementById('sb-root');
    const btn=document.getElementById('btn-snip');
    btn.textContent='\u23F3 Capturing...';btn.disabled=true;
    // Safety net: if html2canvas hangs or never restores, force cleanup after 15s so the
    // board can never get stuck in "Capturing..." with a broken layout.
    const snipSafety=setTimeout(()=>{try{resetSnipState();}catch(e){}},15000);
    window._snipSafety=snipSafety;
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
        style.textContent='#sb-root,#sb-root *{color:#e0e0e0 !important;}#sb-root .metrics-table td[style*="background"]{color:#fff !important;}#sb-root .metrics-table td[style*="rgba(220,38,38"],#sb-root .metrics-table td[style*="rgba(244,67,54"],#sb-root .metrics-table td[style*="rgba(198,40,40"]{background:#b71c1c !important;}#sb-root .metrics-table td[style*="rgba(52,211,153"],#sb-root .metrics-table td[style*="rgba(46,204,113"]{background:rgba(46,204,113,0.45) !important;}#sb-root span[style*="background"]{color:#000 !important;}#sb-root span[style*="background"] *{color:#000 !important;}#sb-root span[style*="background"] span{color:#000 !important;}#sb-root .pct-good{color:#69f0ae !important;}#sb-root .pct-warn{color:#ffd740 !important;}#sb-root .pct-bad{color:#ff5252 !important;}#sb-root .row-fast td{color:#ffab40 !important;}#sb-root .row-rate td{color:#ffab40 !important;}#sb-root .goal-title{color:#ccc !important;}#sb-root .goal-stats{color:#e0e0e0 !important;}#sb-root .goal-stats strong{color:#fff !important;}#sb-root .fclm-timestamp{color:#aaa !important;}#sb-root .meta-text{color:#aaa !important;}#sb-root .target-input{color:#ffd740 !important;padding:4px 6px !important;font-size:13px !important;line-height:1.3 !important;}#sb-root .table-input{color:#ffd740 !important;}#sb-root .panel-title{color:#e0e0e0 !important;}#sb-root .tg-compact h4{color:#64b5f6 !important;}#sb-root .tg-compact:last-child h4{color:#69f0ae !important;}#sb-root .fixed-target{color:#69f0ae !important;}#sb-root .row-hc td{color:#aaa !important;}#sb-root .section-header h2{color:#e0e0e0 !important;}#sb-root .metrics-table .bold{color:#e0e0e0 !important;}#sb-root .nav-tab{color:#aaa !important;}#sb-root .nav-tab.active{color:#fff !important;}#sb-root .target-table td{padding:4px 6px !important;line-height:1.4 !important;color:#e0e0e0 !important;}#sb-root .topnav{background:#16213e !important;}#sb-root .metrics-section,#sb-root .goal-card,#sb-root .site-cplh-panel,#sb-root .targets-panel,#sb-root .chart-card{background:#0f3460 !important;border-top-color:#444 !important;border-right-color:#444 !important;border-bottom-color:#444 !important;}#sb-root .metrics-section.ib-section{border-left:4px solid #1565c0 !important;}#sb-root .metrics-section.ob-section{border-left:4px solid #e65100 !important;}#sb-root .metrics-section.sort-section{border-left:4px solid #000 !important;}#sb-root .metrics-section.actions-section{border-left:6px solid #146EB4 !important;}';
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
            clearTimeout(snipSafety);
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
        }).catch(e=>{clearTimeout(snipSafety);try{if(document.getElementById('snip-fix'))document.head.removeChild(style);}catch(_){}if(rightPanel){rightPanel.style.position=origStyles.rPos;rightPanel.style.maxHeight=origStyles.rMax;rightPanel.style.overflow=origStyles.rOvf;rightPanel.style.top=origStyles.rTop;rightPanel.style.minHeight=origStyles.rMinH||'';}if(syncLayout){syncLayout.style.gridTemplateColumns=origStyles.sGrid;syncLayout.style.alignItems=origStyles.sAlign||'';}root.style.overflow='';root.style.height='';root.style.minWidth='';root.style.width='';console.error('Snip failed:',e);btn.textContent='\uD83D\uDCF7 Snip';btn.disabled=false;alert('Screenshot failed: '+e.message);});
    },150);
}
function downloadBlob(blob){
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;
    a.download='SyncBoard_'+new Date().toISOString().slice(0,16).replace(/[T:]/g,'-')+'.png';
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

// Silently refresh an expired FCLM/Midway session by loading the portal in a hidden iframe
// (same pattern used for ALPS/GalaxyBI re-auth), then re-run the fetch WITHOUT a page reload
// so the board stays open. Called when a fetch returns a total blackout after the quick retry.
// Non-destructive session-expiry banner. Keeps the board open (no page reload) and tells the
// user to re-auth in a new tab, then click Get Data again. Fixes the "Get Data closes the tool"
// report, where a full Midway expiry used to trigger location.reload() and wipe the board.
function showFclmReauthBanner(){
    let banner=document.getElementById('sb-fclm-reauth-banner');
    if(!banner){
        banner=document.createElement('div');
        banner.id='sb-fclm-reauth-banner';
        banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font:bold 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#c62828;color:#fff;';
        document.body.appendChild(banner);
    }
    banner.innerHTML='<span>\u26A0\uFE0F FCLM session expired. Open <a href="https://fclm-portal.amazon.com/" target="_blank" style="color:#fff;text-decoration:underline;">FCLM Portal</a> in a new tab, sign in (Midway/badge tap), then come back and click <b>Get Data</b> again. The board stays open.</span><button onclick="this.parentElement.style.display=\'none\'" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Dismiss</button>';
    banner.style.display='flex';
}

function reauthFclmAndRetry(){
    dbg('[SB] FCLM session appears expired \u2014 refreshing via hidden iframe...');
    let done=false;
    const iframe=document.createElement('iframe');
    iframe.style.cssText='position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;opacity:0;';
    iframe.src='https://fclm-portal.amazon.com/';
    const finish=()=>{if(done)return;done=true;try{if(iframe.parentNode)iframe.parentNode.removeChild(iframe);}catch(e){}
        // Re-run the fetch tagged 'reauth' so a still-empty result reloads instead of looping.
        doFetch('reauth');};
    iframe.onload=()=>{setTimeout(finish,1500);}; // give the cookie a moment to settle
    document.body.appendChild(iframe);
    // Safety: if the iframe never fires onload (blocked/timeout), still retry after 6s.
    setTimeout(finish,6000);
}

async function doFetch(isRetry){
    config=loadConfig();config.site=document.getElementById('site-select').value;config.shiftType=document.getElementById('shift-select').value;saveConfig(config);
    // Invalidate the day caches so they re-fetch for the (possibly new) site/day. Note which day
    // view is currently showing so we can refresh it after this fetch.
    const curDayVisible=document.getElementById('spt-current-view')?.style.display!=='none';
    const priDayVisible=document.getElementById('spt-prior-view')?.style.display!=='none';
    dayData[0]=null;dayData[1]=null;
    priorBBGoals.ib=0;priorBBGoals.ob=0;   // yesterday's BB goals re-fetch on next Prior Day render
    const btn=document.getElementById('btn-fetch');btn.disabled=true;btn.textContent=isRetry?'\u23F3 Retrying...':'\u23F3 Fetching...';btn.classList.add('btn-fetching');
    try{
        const raw=await fetchAllData(config);
        // Session-expiry detection. A stale FCLM session returns a TOTAL blackout (every report
        // empty). The old check only looked at IB stow/PPR, so it false-fired whenever stow
        // happened to be 0 for the window even though OB / EOS / LP clearly had data (session was
        // fine). Now we consider the session ALIVE if ANY data source returned a signal:
        //   IB stow, IB PPR hrs, OB pick, OB dock/DA hrs, or the whole-shift PPR total hours.
        const f=raw.full||{};const ppr=f.ppr||{};
        const anySignal=(
            (f.stow?.totalUnits||0)>0 || (f.stow?.directHours||0)>0 ||
            (f.pick?.totalUnits||0)>0 || (f.pick?.directHours||0)>0 ||
            (f.obDock?.fluidLoadJobs||0)>0 ||
            (ppr.ibActualHrs||0)>0 || (ppr.obActualHrs||0)>0 || (ppr.daTransferHrs||0)>0 || (ppr.totHrs||0)>0
        );
        // Only treat empty as a stale session if we're currently within the shift time window (data should exist)
        const now=new Date(),cm=now.getHours()*60+now.getMinutes();
        const sched=config.shiftType==='Nights'?config.nights:config.days;
        const p1Start=sched.p1.sh*60+sched.p1.sm;
        const shiftActive=config.shiftType==='Nights'?(cm>=p1Start||cm<sched.full.eh*60+sched.full.em):(cm>=p1Start&&cm<=sched.full.eh*60+sched.full.em);
        if(!anySignal&&shiftActive){
            // A tab left open for hours lets the FCLM/Midway session cookie expire in the
            // background; the next Get Data then hits a login redirect (empty data). A manual F5
            // works only because reloading re-runs the Midway handshake. We do that same re-auth
            // WITHOUT a reload: load the FCLM portal in a hidden iframe to refresh the cookie,
            // wait, then auto-retry the fetch. isRetry===undefined -> quick immediate retry;
            // isRetry==='reauth' -> we've already tried the iframe re-auth once.
            if(!isRetry){
                setStatus('\u21BB Refreshing data...');
                return doFetch('quick');
            }
            if(isRetry==='quick'){
                setStatus('\u21BB Re-authenticating FCLM session...');
                return reauthFclmAndRetry();
            }
            // isRetry==='reauth' - the silent re-auth didn't take (Midway fully expired, needs a
            // badge tap). DO NOT reload the page: a reload tears down the whole board (resets
            // boardActive, wipes #sb-root) and dumps the user back to just the launch button -
            // which is exactly the "Get Data closes the tool" bug. Instead keep the board open
            // and surface a non-destructive banner asking the user to re-auth and retry, the same
            // pattern used for GalaxyBI / ATLAS / OpenSearch session expiry.
            setStatus('\u26A0\uFE0F Session expired \u2014 re-authenticate, then click Get Data');
            showFclmReauthBanner();
            btn.disabled=false;btn.textContent='\u25B6 Get Data';return;
        }
        currentMetrics=processData(raw);
        renderIB(currentMetrics);renderOB(currentMetrics);renderSort(currentMetrics);
        renderTargets(currentMetrics);renderCharts(currentMetrics);
        currentFastStart=raw.fastStart;   // keep for re-apply after async renders settle
        renderFastStartRow(raw.fastStart,config);
        blankFuturePeriods(config);
        // Render Site CPLH: (Fluid Load Case + Fluid Load Tote + Case Transfer In + Pallet Transfer In cases) / THROUGHPUT hours
        // Uses separate 12hr window (15 min before SOS to 15 min before next shift SOS)
        const cplhPpr=raw.cplhData?.ppr||{};
        const stowJobs=raw.cplhData?.stow?.totalUnits||0;
        const palletCases24=raw.cplhData?.palletStow?.palletCases||0;
        // OB loaded piece: TO Fluid Load jobs + Transfer Out Dock pallet cases (split reports).
        // Fall back to the legacy single obDock report if neither new report returned anything.
        const cplhToFluid=raw.cplhData?.toFluidLoad||{};
        const cplhToDock=raw.cplhData?.toDock||{};
        const obDockFluid=((cplhToFluid.jobs||0)+(cplhToDock.caseUnits||0))||(raw.cplhData?.obDock?.fluidLoadJobs||0);
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
        fetchIcqaAtlas(config);
        fetchOsCounts(config);
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
                dbg('[SB-LP] Auto-fetched LP values:',lp);
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
                dbg('[SB-LP] Auto-fetch failed, using saved LP values');
                // Show reminder if no LP data cached
                const cached=loadLPValues();
                if(!cached.ibCplh&&!cached.obCplh){
                    const banner=document.getElementById('sb-reminder-banner')||document.createElement('div');
                    banner.id='sb-reminder-banner';
                    banner.style.cssText='position:fixed;top:0;left:0;right:0;z-index:999999;padding:10px 20px;display:flex;align-items:center;justify-content:space-between;font:bold 13px sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:#e65100;color:#fff;';
                    banner.innerHTML='<span>\u26A0\uFE0F LP data unavailable — auto re-auth didn\'t work. Open <a href="https://galaxybi.aka.corp.amazon.com" target="_blank" style="color:#fff;text-decoration:underline;">GalaxyBI</a> in a tab, sign in (Midway), then click Get Data again.</span><button onclick="this.parentElement.style.display=\'none\'" style="background:rgba(255,255,255,0.2);border:none;color:#fff;padding:4px 10px;border-radius:4px;cursor:pointer;font-weight:bold;">Dismiss</button>';
                    document.body.appendChild(banner);
                }
            }
            renderLPPercents(currentMetrics);
            // LP values just refreshed (and were saved). Re-seed the Shift Plan Targets panel's LP
            // rows and re-render whichever day view is open so their Plan column reflects the new plan.
            seedShiftPlanLPRows();
            // LP stow/pick rates (ctiRate/topRate) just loaded. The New-Hire LC Loss rows rendered
            // earlier during the LC iframe parse, before these rates existed, so re-render them now
            // from cached LC data against the correct LP rate.
            rerenderLCLossFromCache();
            // Re-apply Fast Start after all async renders have settled, in case an earlier render
            // pass cleared the row. Harmless if it was already showing.
            if(currentFastStart)renderFastStartRow(currentFastStart,config);
            priorBBGoals.ib=0;priorBBGoals.ob=0;   // prior-day BB goals were plan-specific; refetch
            const curVis=document.getElementById('spt-current-view')?.style.display!=='none';
            const priVis=document.getElementById('spt-prior-view')?.style.display!=='none';
            if(curVis&&dayData[0])renderDayView(0,dayData[0]);
            if(priVis&&dayData[1])renderDayView(1,dayData[1]);
        });
        // Retry charts if Chart.js wasn't ready yet
        if(typeof Chart==='undefined'){setTimeout(()=>{if(typeof Chart!=='undefined'&&currentMetrics)renderCharts(currentMetrics);},2000);}
        // Kick off the weekly VRETs pull in the BACKGROUND (not awaited) so the compact VRETs
        // panel on the Sync tab fills in without the user having to open the VRETs tab first.
        // fetchVRETsData updates both the tab and the panel when it resolves.
        fetchVRETsData();
        // If a day view is open, re-fetch it now (LP plan values just refreshed too).
        if(curDayVisible&&!dayLoading[0])ensureDay(0);
        if(priDayVisible&&!dayLoading[1])ensureDay(1);
    }catch(err){console.error(err);setStatus('\u26A0\uFE0F '+err.message);alert('Fetch failed: '+err.message+'\n\nMake sure you are on Amazon network and authenticated to Midway.');}
    finally{btn.disabled=false;btn.textContent='\u25B6 Get Data';btn.classList.remove('btn-fetching');}
}

function saveTargetsUI(){
    const t={};['ib-bb-goal','ib-goal-input','ib-rate-target','ib-cplh-target','ib-density-target','ib-fast-sos','ib-fast-eol','ob-bb-goal','ob-goal-input','ob-rate-target','ob-cplh-target','ob-density-target','ob-fast-sos','ob-fast-eol','sort-goal','sort-rate-target','site-cplh-target','dept-ib-units','dept-ib-cases','dept-ib-days-units','dept-ib-days-cases','dept-ib-ipt','dept-da-units','dept-da-cases','dept-da-days-units','dept-da-days-cases','dept-da-ipt'].forEach(id=>{t[id]=document.getElementById(id)?.value||'';});
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

// ============================ FAST START TRACKER (SDC) ============================
// Ported from the "Fast Start Tracker (DC Sites)" userscript by dalwalla, trimmed to the
// SDC single-site flow this board's sites use. Measures each associate's time-to-first-
// activity from clock-in, per process (CaseStow / PalletTransIn / Pick), and reports TP90,
// Average, count, Over-Goal and Minutes-Lost. Runs same-origin on FCLM via credentialed
// fetch (no GM_xmlhttpRequest needed) and persists inputs in localStorage.
const FS_GOAL_KEY='syncboard_fs_goal';
const FS_DT_KEY='syncboard_fs_datetime';
const FS_NONFC_KEY='syncboard_fs_nonfc';
// Window shape: search opens FS_LOOKBACK_MIN before shift start and runs FS_FORWARD_MIN after.
// Per-associate cap: minutes-to-first over FS_CAP_MIN means the AA isn't part of fast start.
const FS_LOOKBACK_MIN=40, FS_FORWARD_MIN=60, FS_CAP_MIN=60;
// SDC process IDs and the job-action -> process map (same as the source's SDC config).
const FS_PROCESSES={CaseStow:'1003035',PalletTransIn:'1003041',Pick:'1003065',NonFCControllable:'1003047'};
const FS_ACTION_MAP={CaseStowed:'CaseStow',PalletTransferred:'PalletTransIn',ItemPicked:'Pick'};
// Tie-break when two processes share the identical first-scan timestamp.
const FS_TIE_BREAK=['CaseStow','Pick'];
let fsLastResults=[];   // kept so a target/goal change can re-render without re-fetching

function fsShowStatus(msg,type){
    const el=document.getElementById('faststart-status');
    if(!el){dbg('[SB-FastStart] '+msg);return;}
    el.textContent=msg;
    el.style.color=type==='error'?'#c62828':type==='success'?'#2e7d32':'#666';
}
function fsIsAnonymous(name,empId){
    const n=String(name||'').toLowerCase();
    const e=String(empId||'').trim();
    return n.includes('anonymous')||e===''||e.replace(/0/g,'')==='';
}
// Build an FCLM CSV report URL (same-origin). params is a flat object.
function fsBuildURL(base,params){
    const q=Object.entries(params).map(([k,v])=>k+'='+encodeURIComponent(v)).join('&');
    return base+'?'+q;
}
// Fetch a CSV report same-origin (credentialed). Throws on HTTP error or an HTML login
// redirect (expired FCLM session), so the caller can surface a clear message.
async function fsFetchCSV(url){
    const r=await fetch(url,{credentials:'include'});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const body=await r.text();
    if(/^\s*<(!doctype|html)/i.test(body))throw new Error('Session expired \u2014 reload FCLM (F5)');
    return fsParseCSV(body);
}
// Minimal CSV parser (handles quoted fields with embedded commas).
function fsParseCSV(text){
    const lines=text.trim().split('\n');
    if(!lines.length)return [];
    const parseLine=(line)=>{
        const out=[];let cur='',inQ=false;
        for(let i=0;i<line.length;i++){const c=line[i];
            if(c==='"')inQ=!inQ;
            else if(c===','&&!inQ){out.push(cur.trim());cur='';}
            else cur+=c;}
        out.push(cur.trim());return out;
    };
    const headers=parseLine(lines[0]);
    const rows=[];
    for(let i=1;i<lines.length;i++){
        if(!lines[i].trim())continue;
        const vals=parseLine(lines[i]);const row={};
        headers.forEach((h,idx)=>{row[h]=vals[idx]||'';});
        rows.push(row);
    }
    return rows;
}
function fsFetchAttendance(site,startDate,endDate){
    const url=fsBuildURL('https://fclm-portal.amazon.com/reports/employeeAttendance',{
        reportFormat:'CSV',warehouseId:site,startDateDay:fmtDate(startDate),maxIntradayDays:'30',spanType:'Intraday',
        startDateIntraday:fmtDate(startDate),startHourIntraday:startDate.getHours(),startMinuteIntraday:startDate.getMinutes(),
        endDateIntraday:fmtDate(endDate),endHourIntraday:endDate.getHours(),endMinuteIntraday:endDate.getMinutes()});
    return fsFetchCSV(url);
}
function fsFetchProcess(site,processId,startDate,endDate,processName){
    const url=fsBuildURL('https://fclm-portal.amazon.com/reports/functionRollup',{
        reportFormat:'CSV',warehouseId:site,processId,maxIntradayDays:'1',spanType:'Intraday',
        startDateIntraday:fmtDate(startDate),startHourIntraday:startDate.getHours(),startMinuteIntraday:startDate.getMinutes(),
        endDateIntraday:fmtDate(endDate),endHourIntraday:endDate.getHours(),endMinuteIntraday:endDate.getMinutes()});
    return fsFetchCSV(url).then(data=>({processName,data}));
}
function fsFetchActivity(site,employeeId,startDate,endDate){
    const url=fsBuildURL('https://fclm-portal.amazon.com/employee/activityDetails',{
        reportFormat:'CSV',employeeId,warehouseId:site,startDateDay:fmtDate(startDate),maxIntradayDays:'1',spanType:'Intraday',
        startDateIntraday:fmtDate(startDate),startHourIntraday:startDate.getHours(),startMinuteIntraday:startDate.getMinutes(),
        endDateIntraday:fmtDate(endDate),endHourIntraday:endDate.getHours(),endMinuteIntraday:endDate.getMinutes()});
    return fsFetchCSV(url);
}
// Earliest qualifying scan per process, as { process: {time} }.
function fsFirstActivityByProcess(activityData){
    const earliest={};
    activityData.forEach(row=>{
        const action=row['Job Action']||row['Action']||row['action'];
        const time=row['Event Date/Time']||row['Action Time']||row['ActionTime']||row['Time'];
        if(FS_ACTION_MAP[action]&&time){
            const p=FS_ACTION_MAP[action];
            if(!earliest[p]||new Date(time)<new Date(earliest[p].time))earliest[p]={time,process:p};
        }
    });
    return earliest;
}
// TP90 / Avg / Over-Goal / Minutes-Lost from a list of minutes-to-first values.
function fsComputeMetrics(times,goal){
    const n=times.length;
    if(!n)return{count:0,avg:null,tp90:null,overGoal:0,minutesLost:0};
    const avg=times.reduce((a,b)=>a+b,0)/n;
    const overGoal=times.filter(t=>t>goal).length;
    const sorted=[...times].sort((a,b)=>a-b);
    const pos=(sorted.length-1)*0.9,lo=Math.floor(pos),hi=Math.ceil(pos),fr=pos-lo;
    const tp90=sorted[lo]+(sorted[hi]-sorted[lo])*fr;
    const minutesLost=times.filter(t=>t>goal).reduce((s,t)=>s+(t-goal),0);
    return{count:n,avg,tp90,overGoal,minutesLost};
}
// Resolve all associates: roster -> punch-in -> first activity -> minutes-to-first row.
async function fsProcessEmployees(attendance,processDataArray,site,startDate,endDate,attStartDate,removeNonFC){
    const employees=new Map();
    const nonFC=new Set();
    if(removeNonFC){
        const nf=processDataArray.find(p=>p.processName==='NonFCControllable');
        if(nf)nf.data.forEach(row=>{
            const id=row['Employee Id']||row['Employee ID']||row['EmployeeID'];
            const nm=row['Name']||row['Employee Name']||'';
            if(id&&!fsIsAnonymous(nm,id))nonFC.add(id.trim());
        });
    }
    processDataArray.forEach(({processName,data})=>{
        if(processName==='NonFCControllable')return;
        data.forEach(row=>{
            const id=row['Employee Id']||row['Employee ID']||row['EmployeeID'];
            const nm=row['Name']||row['Employee Name']||row['EmployeeName'];
            if(!id||!nm||fsIsAnonymous(nm,id))return;
            const key=id.trim();
            if(!employees.has(key))employees.set(key,{employeeId:key,name:nm.trim(),punchIn:null,nonFC:nonFC.has(key)});
        });
    });
    // First "In" punch per associate, matched on Employee Id.
    attendance.forEach(row=>{
        const id=row['Employee Id']||row['Employee ID']||row['EmployeeID'];
        const nm=row['Employee Name']||row['EmployeeName']||row['Employee']||row['Name'];
        const type=row['Punch Type']||row['PunchType']||row['Type'];
        const time=row['Punch Time']||row['PunchTime']||row['Time'];
        if(type!=='In'||!time||fsIsAnonymous(nm,id))return;
        const key=id?String(id).trim():'';
        const emp=key&&employees.get(key);
        if(!emp||emp.punchIn)return;
        emp.punchIn=time;
    });
    const rows=[];
    let processed=0,total=employees.size;
    for(const [empId,emp] of employees){
        if(emp.nonFC||!emp.punchIn){processed++;continue;}
        let activity;
        try{activity=await fsFetchActivity(site,empId,attStartDate,endDate);}
        catch(e){processed++;continue;}
        const byProcess=fsFirstActivityByProcess(activity);
        let winner=null;
        Object.keys(byProcess).forEach(p=>{
            const rank=FS_TIE_BREAK.indexOf(p)===-1?FS_TIE_BREAK.length:FS_TIE_BREAK.indexOf(p);
            const t=new Date(byProcess[p].time).getTime();
            if(winner===null||t<winner.t||(t===winner.t&&rank<winner.rank))winner={process:p,t,rank,time:byProcess[p].time};
        });
        if(winner){
            const clean=(s)=>s.replace(/\s+(EST|EDT|PST|PDT|CST|CDT|MST|MDT)$/i,'');
            const punch=new Date(clean(emp.punchIn));
            const act=new Date(clean(winner.time));
            const minutesToFirst=Math.round((act-punch)/60000);
            rows.push({employeeId:empId,name:emp.name,punchIn:emp.punchIn,firstActivity:winner.time,process:winner.process,minutesToFirst});
        }
        processed++;
        if(processed%10===0||processed===total)fsShowStatus('Processing associates '+processed+'/'+total+'\u2026','info');
        await new Promise(r=>setTimeout(r,40));
    }
    // Keep 0..CAP minute band only; 0 (scan same minute as punch) is the fastest valid start.
    return rows.filter(r=>r.minutesToFirst!==null&&r.minutesToFirst>=0&&r.minutesToFirst<=FS_CAP_MIN)
               .sort((a,b)=>(b.minutesToFirst||0)-(a.minutesToFirst||0));
}
async function fetchFastStartData(){
    const site=document.getElementById('fs-site').value;
    const dt=document.getElementById('fs-start-datetime').value;
    const goal=parseInt(document.getElementById('fs-goal-time').value,10)||20;
    const removeNonFC=document.getElementById('fs-remove-nonfc').checked;
    const btn=document.getElementById('btn-fetch-faststart');
    const content=document.getElementById('faststart-content');
    if(!site){fsShowStatus('Select a site','error');return;}
    if(!dt){fsShowStatus('Enter a shift start date/time','error');return;}
    // Persist inputs
    try{localStorage.setItem(FS_GOAL_KEY,String(goal));localStorage.setItem(FS_DT_KEY,dt);localStorage.setItem(FS_NONFC_KEY,removeNonFC?'1':'0');}catch(e){}
    const startDate=new Date(dt);
    const endDate=new Date(startDate.getTime()+FS_FORWARD_MIN*60*1000);
    const attStartDate=new Date(startDate.getTime()-FS_LOOKBACK_MIN*60*1000);
    const hhmm=(d)=>String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    const note=document.getElementById('fs-window-note');
    if(note)note.innerHTML='<b>'+site+'</b> \u00b7 shift start <b>'+hhmm(startDate)+'</b> \u00b7 searching <b>'+hhmm(attStartDate)+' \u2013 '+hhmm(endDate)+'</b> ('+FS_LOOKBACK_MIN+' min before \u2192 '+FS_FORWARD_MIN+' min after) \u00b7 goal '+goal+' min';
    if(btn){btn.disabled=true;btn.textContent='\u23F3 Running...';}
    if(content)content.innerHTML='<div style="padding:20px;font-size:14px;">\u23F3 Querying Fast Start data\u2026 this can take a minute.</div>';
    fsShowStatus('Querying data\u2026','info');
    try{
        const uniqueProcesses={};
        Object.entries(FS_PROCESSES).forEach(([name,id])=>{if(!uniqueProcesses[id])uniqueProcesses[id]=name;});
        const [attendance,...processData]=await Promise.all([
            fsFetchAttendance(site,attStartDate,endDate),
            ...Object.entries(uniqueProcesses).map(([id,name])=>fsFetchProcess(site,id,attStartDate,endDate,name))
        ]);
        const results=await fsProcessEmployees(attendance,processData,site,startDate,endDate,attStartDate,removeNonFC);
        fsLastResults=results;
        renderFastStart(results,goal);
        fsShowStatus('\u2713 Complete \u2014 '+results.length+' associates \u00b7 '+new Date().toLocaleTimeString(),'success');
    }catch(err){
        console.error('[SB-FastStart] error:',err);
        if(content)content.innerHTML='<div style="padding:20px;font-size:14px;color:#c62828;">\u26A0 Fast Start failed: '+(err&&err.message?err.message:err)+'</div>';
        fsShowStatus('\u26A0 '+(err&&err.message?err.message:err),'error');
    }finally{if(btn){btn.disabled=false;btn.textContent='\u25B6 Run Fast Start';}}
}
function renderFastStart(results,goal){
    const content=document.getElementById('faststart-content');
    if(!content)return;
    if(!results.length){content.innerHTML='<div style="padding:14px;background:#fff3e0;border-radius:6px;">No qualifying activity returned for this window.</div>';return;}
    const byProcess={};
    results.forEach(r=>{(byProcess[r.process]=byProcess[r.process]||[]).push(r);});
    const order=['Pick','CaseStow','PalletTransIn'];
    const procs=order.filter(p=>byProcess[p]).concat(Object.keys(byProcess).filter(p=>!order.includes(p)));
    const tp90Color=(v)=>v===null?'#999':(v>goal?'#c62828':'#2e7d32');
    // Summary cards
    let cards='<div class="fs-summary-grid">';
    procs.forEach(p=>{
        const m=fsComputeMetrics(byProcess[p].map(r=>r.minutesToFirst),goal);
        cards+='<div class="fs-card"><div class="fs-card-title">'+p+'</div>'+
            '<div class="fs-metric"><span class="fs-metric-label">TP90</span><span class="fs-metric-val" style="color:'+tp90Color(m.tp90)+';">'+(m.tp90==null?'\u2014':m.tp90.toFixed(1))+' min</span></div>'+
            '<div class="fs-metric"><span class="fs-metric-label">Average</span><span>'+(m.avg==null?'\u2014':m.avg.toFixed(1))+' min</span></div>'+
            '<div class="fs-metric"><span class="fs-metric-label">Total AAs</span><span>'+m.count+'</span></div>'+
            '<div class="fs-metric"><span class="fs-metric-label">Over Goal</span><span style="color:'+(m.overGoal>0?'#c62828':'#2e7d32')+';">'+m.overGoal+'</span></div>'+
            '<div class="fs-metric"><span class="fs-metric-label">Min Lost</span><span style="color:#c62828;">'+m.minutesLost.toFixed(1)+'</span></div>'+
            '</div>';
    });
    cards+='</div>';
    // Per-process detail tables
    let tables='';
    procs.forEach(p=>{
        const emps=byProcess[p];
        const rows=emps.map(e=>'<tr class="'+(e.minutesToFirst>goal?'fs-row-over':'fs-row-ok')+'">'+
            '<td>'+e.employeeId+'</td><td>'+e.name+'</td><td title="'+e.punchIn+'">'+fsFmtTime(e.punchIn)+'</td>'+
            '<td title="'+e.firstActivity+'">'+fsFmtTime(e.firstActivity)+'</td><td style="font-weight:700;">'+e.minutesToFirst+'</td></tr>').join('');
        tables+='<section class="faststart-section"><h3>'+p+' ('+emps.length+' associates)</h3>'+
            '<table class="metrics-table fs-detail-table"><thead><tr><th>Employee ID</th><th>Name</th><th>Punch In</th><th>First Activity</th><th>Minutes</th></tr></thead><tbody>'+rows+'</tbody></table></section>';
    });
    content.innerHTML=cards+tables;
}
function fsFmtTime(timeStr){
    if(!timeStr)return '';
    const cleaned=timeStr.replace(/\s+(EST|EDT|PST|PDT|CST|CDT|MST|MDT)$/i,'');
    const d=new Date(cleaned);
    if(isNaN(d.getTime()))return timeStr;
    return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
}
// Populate the Fast Start controls from saved values / current config. Idempotent.
function initFastStartControls(){
    const siteSel=document.getElementById('fs-site');
    if(siteSel&&!siteSel.options.length){
        SITES.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;siteSel.appendChild(o);});
        siteSel.value=(loadConfig().site)||SITES[0];
    }
    const goal=document.getElementById('fs-goal-time');
    if(goal){const g=localStorage.getItem(FS_GOAL_KEY);if(g)goal.value=g;}
    const nonfc=document.getElementById('fs-remove-nonfc');
    if(nonfc){const n=localStorage.getItem(FS_NONFC_KEY);if(n!=null)nonfc.checked=n==='1';}
    const dt=document.getElementById('fs-start-datetime');
    if(dt&&!dt.value){
        const saved=localStorage.getItem(FS_DT_KEY);
        if(saved){dt.value=saved;}
        else{
            // Default to today at this site's P1 (SOS) start time.
            const c=loadConfig();const sched=c.shiftType==='Nights'?c.nights:c.days;const p1=sched.p1;
            const d=new Date();d.setHours(p1.sh,p1.sm,0,0);
            const pad=(x)=>String(x).padStart(2,'0');
            dt.value=d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
        }
    }
}

addLaunchBtn();
})();
