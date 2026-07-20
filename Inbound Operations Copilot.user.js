// ==UserScript==
// @name         Inbound Operations Copilot
// @namespace    http://tampermonkey.net/
// @version      8.5.0
// @description  Adds a formatted summary dashboard to Oculus transship pages with AFT pending cases, items, and case density — VRIDs link to YMS — AI-powered anomaly detection and smart trailer prioritization
// @author       You
// @updateURL    https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/OculusTransshipDashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/OculusTransshipDashboard.user.js
// @match        https://oculus.qubit.amazon.dev/transship/*
// @match        https://afttransshipmenthub-na.aka.amazon.com/*/view-transfers/inbound*
// @match        https://afttransshipmenthub-eu.aka.amazon.com/*/view-transfers/inbound*
// @match        https://afttransshipmenthub-fe.aka.amazon.com/*/view-transfers/inbound*
// @match        https://afttransshipmenthub.aka.amazon.com/*/view-transfers/inbound*
// @match        https://trans-logistics.amazon.com/yms/shipclerk*
// @match        https://track.relay.amazon.dev/*
// @match        https://stowmap-na.amazon.com/stowmap/*
// @match        https://us-east-1.quicksight.aws.amazon.com/sn/account/amazonbi/apps/e679414f-e0a0-466e-9053-c97d5d81174f*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_listValues
// @grant        GM_deleteValue
// @grant        GM_notification
// @connect      afttransshipmenthub-na.aka.amazon.com
// @connect      afttransshipmenthub-eu.aka.amazon.com
// @connect      afttransshipmenthub-fe.aka.amazon.com
// @connect      afttransshipmenthub.aka.amazon.com
// @connect      fclm-portal.amazon.com
// @connect      maple-syrup.corp.amazon.com
// @connect      stowmap-na.amazon.com
// @connect      adapt-iad.amazon.com
// ==/UserScript==

(function () {
    'use strict';

    // ─── YMS Ship Clerk: Auto-fill search from URL hash ────────────────────
    // YMS natively handles nodeId (site selection) from the URL hash,
    // but does NOT auto-fill the searchQuery into the filter box.
    if (window.location.hostname === 'trans-logistics.amazon.com' && window.location.pathname.includes('/yms/shipclerk')) {
        const hash = window.location.hash || '';
        const hashParams = new URLSearchParams(hash.replace(/^#\/yard\??/, ''));
        const searchQuery = hashParams.get('searchQuery');
        if (!searchQuery) return; // Nothing to fill

        console.log('[OculusDash-YMS] Auto-fill search:', searchQuery);

        let attempts = 0;
        const maxAttempts = 40; // 20 seconds

        const interval = setInterval(() => {
            attempts++;

            // Find the search/filter input
            const searchInput = document.querySelector('input[placeholder*="Search"]')
                || document.querySelector('input[ng-model*="search"]')
                || document.querySelector('input[ng-model*="Search"]')
                || document.getElementById('searchInput')
                || document.querySelector('.search-bar input')
                || document.querySelector('input[type="search"]')
                || document.querySelector('input[type="text"][placeholder]');

            if (searchInput) {
                searchInput.value = searchQuery;
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                // Press Enter to trigger the search
                searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                // Try Angular scope update if available
                try {
                    if (typeof angular !== 'undefined') {
                        const scope = angular.element(searchInput).scope();
                        if (scope) {
                            scope.$apply(() => {
                                scope.topbar = scope.topbar || {};
                                scope.topbar.filters = scope.topbar.filters || {};
                                scope.topbar.filters.searchQuery = searchQuery;
                            });
                            if (scope.topbar && typeof scope.topbar.textSearch === 'function') {
                                scope.topbar.textSearch(scope.topbar.filters.searchQuery);
                            }
                        }
                    }
                } catch(e) { /* ignore */ }
                console.log('[OculusDash-YMS] ✓ Filled search:', searchQuery);
                clearInterval(interval);
                return;
            }

            if (attempts >= maxAttempts) {
                console.warn('[OculusDash-YMS] Timed out waiting for search input');
                clearInterval(interval);
            }
        }, 500);

        return; // Don't run the rest of the script on YMS
    }

    // ─── Relay Track & Trace: Auto-fill search from URL hash ───────────────
    if (window.location.hostname === 'track.relay.amazon.dev') {
        const hash = window.location.hash;
        const searchVrid = hash ? hash.replace('#search=', '') : '';
        if (!searchVrid) return; // Nothing to search

        console.log('[OculusDash-RTT] Auto-fill search:', searchVrid);

        // Wait for the page to fully settle before interacting
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds

        const interval = setInterval(() => {
            attempts++;

            // Find the search input inside the rtt-analytics-primary-search container
            const searchInput = document.querySelector('.rtt-analytics-primary-search input[role="combobox"]')
                || document.querySelector('input[placeholder="Search"][role="combobox"]')
                || document.querySelector('input[placeholder="Search"]');

            if (searchInput) {
                // Wait a bit longer for the app to fully initialize
                clearInterval(interval);
                setTimeout(() => {
                    // Focus the input
                    searchInput.focus();
                    searchInput.click();

                    // Use native setter to bypass React controlled component
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                    nativeInputValueSetter.call(searchInput, searchVrid);
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    searchInput.dispatchEvent(new Event('change', { bubbles: true }));

                    // Wait for the suggestions dropdown to appear, then click "Search Trips"
                    setTimeout(() => {
                        const clickSearchTrips = () => {
                            // Look for "Search Trips" option in the dropdown
                            const allOptions = document.querySelectorAll('[role="option"], [role="listbox"] li, [class*="popover"] li, [class*="suggestion"] li, [class*="menu"] li');
                            for (const opt of allOptions) {
                                if (opt.textContent.trim().includes('Search Trips')) {
                                    opt.click();
                                    console.log('[OculusDash-RTT] ✓ Clicked "Search Trips"');
                                    // Clean up the hash
                                    history.replaceState(null, '', window.location.pathname + window.location.search);
                                    return true;
                                }
                            }
                            // Fallback: look for any element containing "Search Trips" text
                            const allElements = document.querySelectorAll('div, span, li, a, button, p');
                            for (const el of allElements) {
                                if (el.textContent.trim() === 'Search Trips' && el.offsetParent !== null) {
                                    el.click();
                                    console.log('[OculusDash-RTT] ✓ Clicked "Search Trips" (fallback)');
                                    history.replaceState(null, '', window.location.pathname + window.location.search);
                                    return true;
                                }
                            }
                            return false;
                        };

                        // Try clicking immediately, retry a few times if dropdown hasn't appeared
                        let retries = 0;
                        const retryInterval = setInterval(() => {
                            if (clickSearchTrips() || retries >= 10) {
                                clearInterval(retryInterval);
                                if (retries >= 10) {
                                    console.warn('[OculusDash-RTT] Could not find "Search Trips" option');
                                }
                            }
                            retries++;
                        }, 300);
                    }, 800);

                    console.log('[OculusDash-RTT] ✓ Filled search:', searchVrid);
                }, 2000); // 2 second delay after input found for app to settle
                return;
            }

            if (attempts >= maxAttempts) {
                console.warn('[OculusDash-RTT] Timed out waiting for search input');
                clearInterval(interval);
            }
        }, 500);

        return; // Don't run the rest of the script on Track & Trace
    }

    // ─── Stow Map Automation: Auto-fill and download on stowmap page ────────
    if (window.location.hostname === 'stowmap-na.amazon.com') {
        const isPending = GM_getValue('stowmap_pending', 'false');
        if (isPending !== 'true') return; // Only run if triggered from Oculus button

        console.log('[OculusDash-StowMap] Automation started');

        let attempts = 0;
        const maxAttempts = 40; // 20 seconds

        const interval = setInterval(() => {
            attempts++;

            // Step 1: Click "Bins Report" tab
            const binsBtn = document.getElementById('binStatus-button');
            if (binsBtn) {
                clearInterval(interval);
                binsBtn.click();
                console.log('[OculusDash-StowMap] Clicked Bins Report');

                // Step 2: Wait for form to appear, then fill Floor and Mod
                setTimeout(() => {
                    // Find Floor input (first number input in the bins report form)
                    const binForm = document.querySelector('#binLevelReport .inner-options form') ||
                                    document.querySelector('.binStatusOptionFilter form') ||
                                    document.querySelector('#binLevelReport form');
                    const inputs = binForm ? binForm.querySelectorAll('input') : document.querySelectorAll('#binLevelReport input');

                    let floorInput = null, modInput = null;
                    for (const inp of inputs) {
                        const label = inp.closest('div')?.querySelector('label, b, strong')?.textContent || '';
                        const placeholder = inp.placeholder || '';
                        if (/floor/i.test(label) || /floor/i.test(placeholder) || inp.name === 'floor') {
                            floorInput = inp;
                        } else if (/mod/i.test(label) || /mod/i.test(placeholder) || inp.name === 'mod') {
                            modInput = inp;
                        }
                    }

                    // Fallback: first two inputs in the form
                    if (!floorInput && inputs.length >= 1) floorInput = inputs[0];
                    if (!modInput && inputs.length >= 2) modInput = inputs[1];

                    if (floorInput) {
                        floorInput.value = '1';
                        floorInput.dispatchEvent(new Event('input', { bubbles: true }));
                        floorInput.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log('[OculusDash-StowMap] Filled Floor = 1');
                    }
                    if (modInput) {
                        modInput.value = 'V';
                        modInput.dispatchEvent(new Event('input', { bubbles: true }));
                        modInput.dispatchEvent(new Event('change', { bubbles: true }));
                        console.log('[OculusDash-StowMap] Filled Mod = V');
                    }

                    // Step 3: Click Download button
                    setTimeout(() => {
                        const downloadBtn = document.getElementById('download') ||
                                            document.querySelector('.buttonDownload') ||
                                            document.querySelector('button#download');
                        if (downloadBtn) {
                            downloadBtn.click();
                            console.log('[OculusDash-StowMap] Clicked Download');

                            // Step 4: Wait for download to start, then navigate to QuickSight
                            GM_setValue('stowmap_pending', 'false');
                            setTimeout(() => {
                                const quicksightUrl = 'https://us-east-1.quicksight.aws.amazon.com/sn/account/amazonbi/apps/e679414f-e0a0-466e-9053-c97d5d81174f/view/Stow-Map-Generator?sso_login=true#';
                                window.location.href = quicksightUrl;
                            }, 3000); // Wait 3s for download to start
                        } else {
                            console.warn('[OculusDash-StowMap] Download button not found');
                            GM_setValue('stowmap_pending', 'false');
                        }
                    }, 1500);
                }, 2000); // Wait for Bins Report tab to render
            }

            if (attempts >= maxAttempts) {
                clearInterval(interval);
                console.warn('[OculusDash-StowMap] Timed out waiting for Bins Report button');
                GM_setValue('stowmap_pending', 'false');
            }
        }, 500);

        return; // Don't run the rest of the script on stowmap
    }

    // ─── QuickSight Stow Map: Highlight upload area ─────────────────────────
    if (window.location.hostname.includes('quicksight.aws.amazon.com')) {
        console.log('[OculusDash-QS] On QuickSight Stow Map Generator page');
        // Show a helper overlay reminding the user to upload the downloaded file
        setTimeout(() => {
            const overlay = document.createElement('div');
            overlay.id = 'oc-qs-helper';
            overlay.innerHTML = `
                <div style="position:fixed;top:20px;right:20px;z-index:999999;background:#313244;border:2px solid #a6e3a1;border-radius:12px;padding:16px 20px;box-shadow:0 8px 32px rgba(0,0,0,0.6);font-family:'Segoe UI',Arial,sans-serif;max-width:350px;">
                    <div style="font-weight:bold;font-size:16px;color:#a6e3a1;margin-bottom:8px;">✅ Bin data downloaded!</div>
                    <div style="color:#cdd6f4;font-size:13px;line-height:1.5;">
                        Upload the file that just downloaded (most recent file in your Downloads folder) to the upload area on this page.
                    </div>
                    <button id="oc-qs-dismiss" style="margin-top:10px;background:#45475a;color:#cdd6f4;border:none;border-radius:4px;padding:6px 12px;cursor:pointer;font-size:12px;">Dismiss</button>
                </div>`;
            document.body.appendChild(overlay);
            document.getElementById('oc-qs-dismiss').onclick = () => overlay.remove();
            // Auto-dismiss after 30s
            setTimeout(() => { if (overlay.parentElement) overlay.remove(); }, 30000);
        }, 2000);

        return; // Don't run the rest of the script on QuickSight
    }

    // ─── Auto-clear stale cache on version update ───────────────────────────
    const SCRIPT_VERSION = '6.4';
    const lastVer = GM_getValue('_scriptVersion', '');
    if (lastVer !== SCRIPT_VERSION) {
        // Clear all cached AFT data from previous versions
        const keys = GM_listValues ? GM_listValues() : [];
        keys.forEach(k => { if (k.startsWith('aftData_')) GM_deleteValue(k); });
        GM_setValue('_scriptVersion', SCRIPT_VERSION);
        console.log(`[OculusDash] Version updated ${lastVer} → ${SCRIPT_VERSION}, cleared cached AFT data`);
    }

    // ─── FC Shift Configuration ─────────────────────────────────────────────
    // FHD = First Half Day (Day shift), FHN = First Half Night (Night shift)
    const FC_SHIFTS = {
        QXX6: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:19, nightStartM:0,  nightEndH:5,  nightEndM:30 },
        ATL7: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:18, nightStartM:0,  nightEndH:4,  nightEndM:30 },
        AVP8: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:19, nightStartM:0,  nightEndH:5,  nightEndM:30 },
        HGR5: { dayStartH:5,  dayStartM:30, dayEndH:18, dayEndM:0,  nightStartH:16, nightStartM:30, nightEndH:5,  nightEndM:0  },
        KRB1: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:18, nightStartM:30, nightEndH:5,  nightEndM:0  },
        KRB2: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:19, nightStartM:0,  nightEndH:5,  nightEndM:30 },
        KRB3: { dayStartH:6,  dayStartM:15, dayEndH:16, dayEndM:45, nightStartH:18, nightStartM:15, nightEndH:4,  nightEndM:45 },
        KRB4: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:18, nightStartM:30, nightEndH:5,  nightEndM:0  },
        KRB6: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:19, nightStartM:0,  nightEndH:5,  nightEndM:30 },
        SAV7: { dayStartH:7,  dayStartM:0,  dayEndH:17, dayEndM:30, nightStartH:19, nightStartM:0,  nightEndH:5,  nightEndM:30 },
    };
    // Default fallback if FC not in map
    const DEFAULT_SHIFT = { dayStartH:7, dayStartM:0, dayEndH:17, dayEndM:30, nightStartH:18, nightStartM:30, nightEndH:5, nightEndM:0 };

    function getShiftConfig(fc) {
        return FC_SHIFTS[fc.toUpperCase()] || DEFAULT_SHIFT;
    }

    // ─── Detect which site we're on ─────────────────────────────────────────
    const isAFT = window.location.hostname.includes('afttransshipmenthub');

    // ─── AFT domain mapping per FC ──────────────────────────────────────────
    // Each FC may use a different regional AFT dashboard
    const AFT_DOMAINS = {
        QXX6: 'afttransshipmenthub-na.aka.amazon.com',
        ATL7: 'afttransshipmenthub-na.aka.amazon.com',
        AVP8: 'afttransshipmenthub-na.aka.amazon.com',
        HGR5: 'afttransshipmenthub-na.aka.amazon.com',
        KRB1: 'afttransshipmenthub-na.aka.amazon.com',
        KRB2: 'afttransshipmenthub-na.aka.amazon.com',
        KRB3: 'afttransshipmenthub-na.aka.amazon.com',
        KRB4: 'afttransshipmenthub-na.aka.amazon.com',
        KRB6: 'afttransshipmenthub-na.aka.amazon.com',
        SAV7: 'afttransshipmenthub-na.aka.amazon.com',
    };
    const DEFAULT_AFT_DOMAIN = 'afttransshipmenthub-na.aka.amazon.com';

    function getAFTUrl(fc) {
        const domain = AFT_DOMAINS[(fc || '').toUpperCase()] || DEFAULT_AFT_DOMAIN;
        return `https://${domain}/${fc}/view-transfers/inbound/`;
    }

    if (isAFT) {
        // ═══ AFT SITE: Minimal collector — fetch API, store result ═══════════
        const fc = window.location.pathname.split('/').filter(Boolean)[0] || '';
        if (!fc) return;
        console.log('[OculusDash-AFT] Collector running for', fc);

        // Wait for page to settle, then call the API (same-origin = auth works)
        setTimeout(async () => {
            const today = new Date();
            const sd = new Date(today); sd.setDate(today.getDate() - 7);
            const ed = new Date(today); ed.setDate(today.getDate() + 14);
            const fmt = d => d.toISOString().split('T')[0];

            // Try multiple API paths — different AFT versions use different endpoints
            const apiPaths = [
                `/inbound/getTransferManifestsByDateAndSourceWarehouse/?startDate=${fmt(sd)}&endDate=${fmt(ed)}&warehouseId=${fc}&_=${Date.now()}`,
                `/${fc}/inbound/getTransferManifestsByDateAndSourceWarehouse/?startDate=${fmt(sd)}&endDate=${fmt(ed)}&warehouseId=${fc}&_=${Date.now()}`,
                `/api/inbound/transfers?warehouseId=${fc}&startDate=${fmt(sd)}&endDate=${fmt(ed)}`,
                `/${fc}/api/inbound/transfers?startDate=${fmt(sd)}&endDate=${fmt(ed)}`,
            ];

            let apiSuccess = false;
            for (const url of apiPaths) {
                console.log('[OculusDash-AFT] Trying API:', url);
                try {
                    const resp = await fetch(url);
                    console.log('[OculusDash-AFT] API status:', resp.status);
                    if (!resp.ok) { console.warn('[OculusDash-AFT] API returned', resp.status, '— trying next'); continue; }

                    const json = await resp.json();
                    console.log('[OculusDash-AFT] Got JSON, sample:', JSON.stringify(json).substring(0, 300));

                    // Find the array of transfers
                    let arr = null;
                    if (Array.isArray(json)) arr = json;
                    else if (json && typeof json === 'object') {
                        for (const v of Object.values(json)) {
                            if (Array.isArray(v) && v.length > 0) { arr = v; break; }
                        }
                        if (!arr) {
                            for (const v of Object.values(json)) {
                                if (v && typeof v === 'object' && !Array.isArray(v)) {
                                    for (const vv of Object.values(v)) {
                                        if (Array.isArray(vv) && vv.length > 0) { arr = vv; break; }
                                    }
                                }
                                if (arr) break;
                            }
                        }
                    }

                    if (!arr || arr.length === 0) {
                        console.warn('[OculusDash-AFT] No transfers in response — trying next');
                        continue;
                    }

                    console.log('[OculusDash-AFT] Found', arr.length, 'transfers');
                    if (arr[0]) console.log('[OculusDash-AFT] First item keys:', Object.keys(arr[0]));

                    // Check if API has inline PENDING cases/items data
                    // First try pending-specific keys, then fall back to detail page fetches
                    let totalCases = 0, totalItems = 0, count = 0;
                    const detailUrls = [];
                    const pendingCaseKeys = ['totalPendingCases','pendingCases'];
                    const pendingItemKeys = ['totalPendingItems','pendingItems'];

                    for (const t of arr) {
                        let c = 0, it = 0;
                        for (const k of pendingCaseKeys) { if (t[k] !== undefined && t[k] !== null) { c = parseInt(t[k],10)||0; break; } }
                        for (const k of pendingItemKeys) { if (t[k] !== undefined && t[k] !== null) { it = parseInt(t[k],10)||0; break; } }
                        // Also check nested totalPending object
                        if (c === 0 && it === 0 && t.totalPending) {
                            c = parseInt(t.totalPending.cases,10)||0;
                            it = parseInt(t.totalPending.items,10)||0;
                        }

                        if (c > 0 || it > 0) {
                            totalCases += c; totalItems += it; count++;
                        }
                        // Always collect detail URLs as fallback — we'll use them if inline pending data is missing
                        const ref = t.shipmentReferenceId || t.shipment_reference_id || t.referenceId || t.id || t.amazonShipmentReferenceId;
                        if (ref) detailUrls.push(`/${fc}/view-transfers/inbound/${ref}`);
                    }

                    if (count > 0) {
                        const result = { totalCases, totalItems, count, trailerCount: count, timestamp: Date.now(), fc };
                        GM_setValue('aftData_' + fc, JSON.stringify(result));
                        console.log('[OculusDash-AFT] ✓ Stored from API (pending only):', result);
                        apiSuccess = true;
                    } else if (detailUrls.length > 0) {
                        // No pending-specific keys — fetch each trailer's detail page for Total Pending
                        console.log(`[OculusDash-AFT] No pending keys in manifest, fetching ${detailUrls.length} detail pages...`);
                        await fetchAndStoreDetails(detailUrls, fc);
                        apiSuccess = GM_getValue('aftData_' + fc, null) !== null;
                    }

                    if (!apiSuccess && detailUrls.length > 0) {
                        // Detail pages also failed — last resort: use manifest generic keys
                        // This may overcount but is better than showing nothing
                        console.log('[OculusDash-AFT] Detail pages failed, falling back to manifest generic keys...');
                        const genCaseKeys = ['cases','totalCases','caseQuantity','caseCount'];
                        const genItemKeys = ['items','totalItems','itemQuantity','itemCount'];
                        let gc = 0, gi = 0, gcount = 0;
                        for (const t of arr) {
                            let c = 0, it = 0;
                            for (const k of genCaseKeys) { if (t[k] !== undefined && t[k] !== null) { c = parseInt(t[k],10)||0; break; } }
                            for (const k of genItemKeys) { if (t[k] !== undefined && t[k] !== null) { it = parseInt(t[k],10)||0; break; } }
                            if (c > 0 || it > 0) { gc += c; gi += it; gcount++; }
                        }
                        if (gcount > 0) {
                            const result = { totalCases: gc, totalItems: gi, count: gcount, trailerCount: gcount, timestamp: Date.now(), fc, approx: true };
                            GM_setValue('aftData_' + fc, JSON.stringify(result));
                            console.log('[OculusDash-AFT] ✓ Stored from manifest (generic, may overcount):', result);
                            apiSuccess = true;
                        }
                    }
                    break; // Got a valid response, stop trying
                } catch (e) {
                    console.warn('[OculusDash-AFT] API error:', e.message, '— trying next');
                    continue;
                }
            }

            if (!apiSuccess) {
                // All API paths failed — fall back to table scrape
                console.log('[OculusDash-AFT] All APIs failed, falling back to table scrape...');
                await new Promise(r => setTimeout(r, 8000));
                await scrapeTableAndFetchDetails(fc);
            }
        }, 3000);

        async function scrapeTableAndFetchDetails(fc) {
            // First, change the "Show entries" dropdown to show all rows
            const selects = document.querySelectorAll('select');
            for (const sel of selects) {
                // Look for the entries-per-page dropdown (has options like 10, 25, 50, 100)
                const opts = Array.from(sel.options).map(o => o.value);
                if (opts.some(v => v === '10' || v === '25' || v === '50')) {
                    // Find the highest option or -1 (all)
                    const allOpt = Array.from(sel.options).find(o => o.value === '-1' || o.text.toLowerCase().includes('all'));
                    const maxOpt = Array.from(sel.options).reduce((max, o) => {
                        const n = parseInt(o.value, 10);
                        return n > max.val ? { val: n, opt: o } : max;
                    }, { val: 0, opt: null });

                    if (allOpt) {
                        sel.value = allOpt.value;
                    } else if (maxOpt.opt) {
                        sel.value = maxOpt.opt.value;
                    }
                    sel.dispatchEvent(new Event('change', { bubbles: true }));
                    console.log(`[OculusDash-AFT] Changed table to show ${sel.value} entries`);
                    // Wait for table to re-render
                    await new Promise(r => setTimeout(r, 3000));
                    break;
                }
            }

            const tables = document.querySelectorAll('table');
            for (const tbl of tables) {
                const ths = Array.from(tbl.querySelectorAll('th')).map(h => h.textContent.trim());
                if (!ths.some(t => t.includes('YMS Arrival Time'))) continue;

                const ymsCol = ths.findIndex(h => h.includes('YMS Arrival Time'));
                const detailsCol = ths.findIndex(h => h.includes('Details'));
                const shipRefCol = ths.findIndex(h => h.includes('Shipment Reference'));

                const detailUrls = [];
                for (const row of tbl.querySelectorAll('tr')) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length === 0 || cells.length <= ymsCol) continue;
                    if (!cells[ymsCol]?.textContent.trim()) continue;

                    let href = null;
                    if (detailsCol !== -1 && cells[detailsCol]) {
                        const link = cells[detailsCol].querySelector('a');
                        if (link) href = link.getAttribute('href');
                    }
                    if (!href && shipRefCol !== -1 && cells[shipRefCol]) {
                        const ref = cells[shipRefCol].textContent.trim();
                        if (ref) href = `/${fc}/view-transfers/inbound/${ref}`;
                    }
                    if (href) detailUrls.push(href.startsWith('http') ? href : window.location.origin + href);
                }

                console.log(`[OculusDash-AFT] Table scrape: ${detailUrls.length} trailers with YMS`);
                if (detailUrls.length > 0) await fetchAndStoreDetails(detailUrls, fc);
                break;
            }
        }

        async function fetchAndStoreDetails(urls, fc) {
            let totalCases = 0, totalItems = 0, ok = 0;

            for (let i = 0; i < urls.length; i++) {
                console.log(`[OculusDash-AFT] Loading detail ${i+1}/${urls.length}: ${urls[i]}`);
                try {
                    // Extract the shipment ref from the URL (last path segment)
                    const pathParts = new URL(urls[i]).pathname.split('/').filter(Boolean);
                    const shipRef = pathParts[pathParts.length - 1];

                    // Try the stowing-in-progress JSON API
                    const apiUrl = `/stowing-in-progress/?warehouseId=${fc}&amazonShipmentRefId=${shipRef}`;
                    console.log(`[OculusDash-AFT] Trying API: ${apiUrl}`);

                    const apiResp = await fetch(apiUrl);
                    console.log(`[OculusDash-AFT] API response: ${apiResp.status} (${apiResp.headers.get('content-type')})`);
                    if (apiResp.ok) {
                        const text = await apiResp.text();
                        try {
                            const data = JSON.parse(text);
                            console.log(`[OculusDash-AFT] Detail ${i+1} JSON keys:`, Object.keys(data));
                            const p = findPendingInJson(data);
                            if (p) {
                                totalCases += p.cases; totalItems += p.items; ok++;
                                console.log(`[OculusDash-AFT] ✓ Detail ${ok}: cases=${p.cases}, items=${p.items}`);
                                continue;
                            }
                        } catch(e) { /* not JSON */ }
                    }

                    // Fallback: fetch the detail page HTML and extract Total Pending
                    const htmlResp = await fetch(urls[i]);
                    if (htmlResp.ok) {
                        const html = await htmlResp.text();
                        const doc = new DOMParser().parseFromString(html, 'text/html');

                        // First priority: Look for Total Pending row in tables (most accurate)
                        const p = extractPendingFromDoc(doc);
                        if (p) {
                            totalCases += p.cases; totalItems += p.items; ok++;
                            console.log(`[OculusDash-AFT] ✓ Detail ${ok} (table Total Pending): cases=${p.cases}, items=${p.items}`);
                            continue;
                        }

                        // Fallback: Look for specific span IDs (may be total pending on some AFT versions)
                        const casesSpan = doc.getElementById('caseQuantityTotal');
                        const itemsSpan = doc.getElementById('quantityItemsTotal');
                        if (casesSpan || itemsSpan) {
                            const c = parseInt(casesSpan?.textContent.trim().replace(/,/g,''),10) || 0;
                            const it = parseInt(itemsSpan?.textContent.trim().replace(/,/g,''),10) || 0;
                            if (c > 0 || it > 0) {
                                totalCases += c; totalItems += it; ok++;
                                console.log(`[OculusDash-AFT] ✓ Detail ${ok} (span IDs): cases=${c}, items=${it}`);
                                continue;
                            }
                        }
                    }

                    console.log(`[OculusDash-AFT] Detail ${i+1}: no data found`);
                } catch (e) {
                    console.error(`[OculusDash-AFT] Detail ${i+1} error:`, e);
                }
            }

            const result = { totalCases, totalItems, count: ok, trailerCount: urls.length, timestamp: Date.now(), fc };
            GM_setValue('aftData_' + fc, JSON.stringify(result));
            console.log('[OculusDash-AFT] ✓ Stored:', result);
        }

        function findPendingInJson(data) {
            if (!data || typeof data !== 'object') return null;

            // Per-trailer detail API — pending-specific keys first, then broader keys as fallback
            const caseKeys = ['totalPendingCases', 'pendingCases', 'caseQuantityTotal', 'caseQuantity', 'totalCases', 'cases'];
            const itemKeys = ['totalPendingItems', 'pendingItems', 'quantityItemsTotal', 'itemQuantity', 'totalItems', 'items'];

            let cases = 0, items = 0;
            for (const k of caseKeys) { if (data[k] !== undefined) { cases = parseInt(data[k],10)||0; break; } }
            for (const k of itemKeys) { if (data[k] !== undefined) { items = parseInt(data[k],10)||0; break; } }
            if (cases > 0 || items > 0) return { cases, items };

            // Check nested totalPending
            if (data.totalPending) {
                return { cases: parseInt(data.totalPending.cases,10)||0, items: parseInt(data.totalPending.items,10)||0 };
            }

            return null;
        }

        function loadDetailViaIframe(url) {
            return new Promise((resolve) => {
                const iframe = document.createElement('iframe');
                iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;opacity:0;';
                iframe.src = url;
                document.body.appendChild(iframe);

                let attempts = 0;
                const maxAttempts = 30; // 30 seconds max per detail page

                const check = setInterval(() => {
                    attempts++;
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        if (!doc || !doc.body) return;

                        const bodyText = doc.body.textContent || '';

                        // Log what we see at 5s, 10s, 15s
                        if (attempts === 5 || attempts === 10 || attempts === 15) {
                            console.log(`[OculusDash-AFT] iframe @${attempts}s: body length=${bodyText.length}, has "Total Pending"=${bodyText.includes('Total Pending')}, has "Cases"=${bodyText.includes('Cases')}`);
                            // Log all tables found
                            const tables = doc.querySelectorAll('table');
                            console.log(`[OculusDash-AFT] iframe @${attempts}s: ${tables.length} tables found`);
                            tables.forEach((t, i) => {
                                const ths = Array.from(t.querySelectorAll('th')).map(h => h.textContent.trim());
                                const trs = t.querySelectorAll('tr').length;
                                console.log(`[OculusDash-AFT] Table ${i}: ${trs} rows, headers:`, ths);
                            });
                        }

                        // Look for "Total Pending" text — means the detail data has rendered
                        if (bodyText.includes('Total Pending')) {
                            // Give it one more second to fully render numbers
                            setTimeout(() => {
                                clearInterval(check);
                                const p = extractPendingFromDoc(iframe.contentDocument || iframe.contentWindow.document);
                                console.log(`[OculusDash-AFT] Extracted from iframe:`, p);
                                iframe.remove();
                                resolve(p);
                            }, 2000);
                            clearInterval(check); // stop checking while we wait
                            return;
                        }
                    } catch (e) {
                        if (attempts === 5) console.log('[OculusDash-AFT] iframe access error:', e.message);
                    }

                    if (attempts >= maxAttempts) {
                        clearInterval(check);
                        // Log final state before giving up
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            console.log('[OculusDash-AFT] iframe timed out. Body snippet:', (doc.body?.textContent || '').substring(0, 300));
                        } catch(e) {}
                        iframe.remove();
                        resolve(null);
                    }
                }, 1000);
            });
        }

        function extractPendingFromDoc(doc) {
            // Look for table with Cases/Items columns and Total Pending row
            for (const table of doc.querySelectorAll('table')) {
                const ths = Array.from(table.querySelectorAll('th')).map(h => h.textContent.trim());
                const ci = ths.findIndex(h => h === 'Cases'), ii = ths.findIndex(h => h === 'Items');
                if (ci === -1 && ii === -1) continue;
                for (const row of table.querySelectorAll('tr')) {
                    if (!row.textContent.includes('Total Pending')) continue;
                    const cells = row.querySelectorAll('td, th');
                    let c = 0, it = 0;
                    if (ci !== -1 && cells[ci]) c = parseInt(cells[ci].textContent.trim().replace(/,/g,''),10)||0;
                    if (ii !== -1 && cells[ii]) it = parseInt(cells[ii].textContent.trim().replace(/,/g,''),10)||0;
                    if (c === 0 && it === 0) {
                        const nums = Array.from(cells).map(x => parseInt(x.textContent.trim().replace(/,/g,''),10)).filter(n => !isNaN(n));
                        if (nums.length >= 4) { c = nums[2]; it = nums[3]; }
                    }
                    if (c > 0 || it > 0) return { cases: c, items: it };
                }
            }
            // Fallback: scan for Total Pending in any element
            for (const el of doc.querySelectorAll('*')) {
                if (el.children.length > 0 || !el.textContent.trim().includes('Total Pending')) continue;
                const parent = el.closest('tr') || el.parentElement;
                if (!parent) continue;
                const nums = Array.from(parent.querySelectorAll('*'))
                    .filter(e => e.children.length === 0)
                    .map(e => e.textContent.trim())
                    .filter(t => /^\d[\d,]*$/.test(t))
                    .map(t => parseInt(t.replace(/,/g,''),10));
                if (nums.length >= 4) return { cases: nums[2], items: nums[3] };
            }
            return null;
        }

        return; // Don't run dashboard UI on AFT site
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ═══ OCULUS SITE: Dashboard UI ═══════════════════════════════════════════
    // ═══════════════════════════════════════════════════════════════════════════

    const AUTO_REFRESH_MS = 20 * 60 * 1000;
    setTimeout(() => location.reload(), AUTO_REFRESH_MS);

    async function fetchAFTData(oculusVrids) {
        const fc = window.location.pathname.split('/').pop();
        console.log('[OculusDash] Reading stored AFT data for', fc);

        // Check for cached data first (from AFT tab collector)
        const stored = GM_getValue('aftData_' + fc, null);
        if (stored) {
            const data = JSON.parse(stored);
            const ageMin = ((Date.now() - data.timestamp) / 60000).toFixed(1);
            console.log(`[OculusDash] ✓ AFT data found (${ageMin} min old):`, data);
            // Only use cache if it has actual data AND is less than 60 min old
            if (parseFloat(ageMin) <= 60 && data.totalCases > 0) return data;
            if (data.totalCases === 0) console.warn('[OculusDash] Cached data has 0 cases, re-fetching...');
            else console.warn('[OculusDash] Cached data is stale, fetching fresh from AFT...');
        }

        // Direct fetch from AFT API via GM_xmlhttpRequest (cross-origin)
        console.log('[OculusDash] Fetching AFT data directly for', fc);
        const aftDomain = (AFT_DOMAINS[(fc || '').toUpperCase()] || DEFAULT_AFT_DOMAIN);
        const today = new Date();
        const sd = new Date(today); sd.setDate(today.getDate() - 7);
        const ed = new Date(today); ed.setDate(today.getDate() + 14);
        const fmt = d => d.toISOString().split('T')[0];
        const fmtSlash = d => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;

        // Try multiple API URL patterns — different AFT versions use different paths
        const apiUrls = [
            `https://${aftDomain}/inbound/getTransferManifestsByDateAndSourceWarehouse/?startDate=${fmt(sd)}&endDate=${fmt(ed)}&warehouseId=${fc}&_=${Date.now()}`,
            `https://${aftDomain}/inbound/getTransferManifestsByDateAndSourceWarehouse?startDate=${fmt(sd)}&endDate=${fmt(ed)}&warehouseId=${fc}`,
            `https://${aftDomain}/${fc}/inbound/getTransferManifestsByDateAndSourceWarehouse/?startDate=${fmt(sd)}&endDate=${fmt(ed)}&warehouseId=${fc}&_=${Date.now()}`,
            // Alternate date formats and paths
            `https://${aftDomain}/inbound/getTransferManifestsByDateAndSourceWarehouse/?startDate=${fmtSlash(sd)}&endDate=${fmtSlash(ed)}&warehouseId=${fc}&_=${Date.now()}`,
            `https://${aftDomain}/api/inbound/transfers?warehouseId=${fc}&startDate=${fmt(sd)}&endDate=${fmt(ed)}`,
            `https://${aftDomain}/${fc}/api/inbound/transfers?startDate=${fmt(sd)}&endDate=${fmt(ed)}`,
            // Some AFT versions use a shorter date range
            `https://${aftDomain}/inbound/getTransferManifestsByDateAndSourceWarehouse/?startDate=${fmt(today)}&endDate=${fmt(ed)}&warehouseId=${fc}&_=${Date.now()}`,
        ];

        for (const apiUrl of apiUrls) {
            try {
                console.log('[OculusDash] Trying AFT API:', apiUrl);
                const json = await new Promise((resolve, reject) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: apiUrl,
                        headers: { 'Accept': 'application/json' },
                        onload: (resp) => {
                            console.log('[OculusDash] AFT API status:', resp.status, 'length:', (resp.responseText||'').length);
                            if (resp.status >= 200 && resp.status < 300 && resp.responseText) {
                                try { resolve(JSON.parse(resp.responseText)); }
                                catch(e) {
                                    console.log('[OculusDash] Response not JSON, first 200 chars:', resp.responseText.substring(0, 200));
                                    reject(new Error('AFT response not JSON'));
                                }
                            } else {
                                reject(new Error('AFT API status ' + resp.status));
                            }
                        },
                        onerror: (e) => reject(new Error('AFT network error')),
                        ontimeout: () => reject(new Error('AFT timeout')),
                        timeout: 30000
                    });
                });

                // Find the array of transfers
                let arr = null;
                if (Array.isArray(json)) arr = json;
                else if (json && typeof json === 'object') {
                    // Search all values for an array
                    for (const v of Object.values(json)) {
                        if (Array.isArray(v) && v.length > 0) { arr = v; break; }
                    }
                    // Deep search one level
                    if (!arr) {
                        for (const v of Object.values(json)) {
                            if (v && typeof v === 'object' && !Array.isArray(v)) {
                                for (const vv of Object.values(v)) {
                                    if (Array.isArray(vv) && vv.length > 0) { arr = vv; break; }
                                }
                            }
                            if (arr) break;
                        }
                    }
                }

                if (!arr || arr.length === 0) {
                    console.warn('[OculusDash] No transfers array in response, trying next URL...');
                    continue;
                }

                console.log('[OculusDash] AFT API returned', arr.length, 'transfers');
                if (arr[0]) console.log('[OculusDash] First transfer keys:', Object.keys(arr[0]));

                // Pass 1: Try to find inline PENDING case/item data from ALL transfers (not just YMS)
                // IMPORTANT: Only use pending-specific keys to avoid counting total shipment quantities
                let totalCases = 0, totalItems = 0, count = 0;
                const perTrailer = {}; // Map of VRID → { cases, items }
                const pendingCaseKeyNames = ['totalPendingCases','pendingCases'];
                const pendingItemKeyNames = ['totalPendingItems','pendingItems'];
                const vridKeyNames = ['trailerId','vehicleReferenceId','vrid','loadIdentifier','trailerNumber','vehicleId','loadId'];

                for (const t of arr) {
                    let c = 0, it = 0;
                    for (const k of pendingCaseKeyNames) { if (t[k] !== undefined && t[k] !== null) { c = parseInt(t[k],10)||0; break; } }
                    for (const k of pendingItemKeyNames) { if (t[k] !== undefined && t[k] !== null) { it = parseInt(t[k],10)||0; break; } }
                    // Also check nested totalPending object
                    if (c === 0 && it === 0 && t.totalPending) {
                        c = parseInt(t.totalPending.cases,10)||0;
                        it = parseInt(t.totalPending.items,10)||0;
                    }
                    if (c > 0 || it > 0) { totalCases += c; totalItems += it; count++; }
                    // Extract VRID for per-trailer map
                    let vrid = '';
                    for (const k of vridKeyNames) { if (t[k]) { vrid = String(t[k]).trim(); break; } }
                    if (!vrid) {
                        // Try any key containing 'vrid' or 'vehicle'
                        for (const [k, v] of Object.entries(t)) {
                            const kl = k.toLowerCase();
                            if ((kl.includes('vrid') || kl.includes('vehicle')) && v && typeof v === 'string') { vrid = v.trim(); break; }
                        }
                    }
                    if (vrid && (c > 0 || it > 0)) {
                        perTrailer[vrid] = { cases: c, items: it };
                    }
                    // Log first transfer's keys to help debug VRID field
                    if (count === 1 && !vrid) {
                        console.log('[OculusDash] First transfer all keys/values:', JSON.stringify(Object.entries(t).map(([k,v]) => [k, typeof v === 'string' ? v : typeof v]).slice(0, 30)));
                    }
                }

                // If we got inline data, filter to only YMS-arrived trailers
                if (count > 0) {
                    // Re-count with YMS filter for accuracy
                    let ymsCases = 0, ymsItems = 0, ymsCount = 0;
                    for (const t of arr) {
                        let hasYms = false;
                        for (const [k, v] of Object.entries(t)) {
                            const kl = k.toLowerCase();
                            if ((kl.includes('yms') || kl.includes('arrival') || kl.includes('checkedin') || kl.includes('checked_in')) && v) {
                                hasYms = true; break;
                            }
                        }
                        if (!hasYms) continue;
                        let c = 0, it = 0;
                        for (const k of pendingCaseKeyNames) { if (t[k] !== undefined && t[k] !== null) { c = parseInt(t[k],10)||0; break; } }
                        for (const k of pendingItemKeyNames) { if (t[k] !== undefined && t[k] !== null) { it = parseInt(t[k],10)||0; break; } }
                        if (c === 0 && it === 0 && t.totalPending) {
                            c = parseInt(t.totalPending.cases,10)||0;
                            it = parseInt(t.totalPending.items,10)||0;
                        }
                        if (c > 0 || it > 0) { ymsCases += c; ymsItems += it; ymsCount++; }
                    }
                    // Use YMS-filtered if we got results, otherwise use all
                    const useCases = ymsCount > 0 ? ymsCases : totalCases;
                    const useItems = ymsCount > 0 ? ymsItems : totalItems;
                    const useCount = ymsCount > 0 ? ymsCount : count;
                    const result = { totalCases: useCases, totalItems: useItems, count: useCount, trailerCount: useCount, timestamp: Date.now(), fc, perTrailer };
                    GM_setValue('aftData_' + fc, JSON.stringify(result));
                    console.log('[OculusDash] ✓ AFT direct fetch:', result.totalCases, 'cases,', result.totalItems, 'items,', Object.keys(perTrailer).length, 'per-trailer entries');
                    return result;
                }

                // Pass 2: No inline data — collect detail refs from ALL transfers
                // But only fetch details for trailers visible in Oculus (if provided)
                console.log('[OculusDash] No inline case data, trying detail pages...');
                const detailRefs = [];
                const refToTrailerId = {}; // Map shipmentRef → trailerId for per-trailer data
                const oculusSet = oculusVrids ? new Set(oculusVrids.map(v => v.toUpperCase())) : null;
                // Log first few trailerIds to debug matching
                const sampleTids = arr.slice(0, 5).map(t => t.trailerId || t.vehicleReferenceId || t.vrid || 'NONE');
                console.log('[OculusDash] Sample AFT trailerIds:', JSON.stringify(sampleTids));
                console.log('[OculusDash] Sample Oculus VRIDs:', JSON.stringify(oculusVrids ? oculusVrids.slice(0, 5) : 'none'));
                for (const t of arr) {
                    const ref = t.shipmentReferenceId || t.shipment_reference_id || t.referenceId || t.id || t.amazonShipmentReferenceId;
                    if (ref) {
                        const tid = t.trailerId || t.vehicleReferenceId || t.vrid || '';
                        if (tid) refToTrailerId[ref] = tid;
                        // Only fetch details for trailers visible in Oculus yard
                        if (oculusSet) {
                            if (tid && oculusSet.has(tid.toUpperCase())) detailRefs.push(ref);
                        } else {
                            detailRefs.push(ref);
                        }
                    }
                }
                console.log(`[OculusDash] Matched ${detailRefs.length} of ${arr.length} AFT transfers to Oculus in-yard VRIDs`);

                if (detailRefs.length > 0) {
                    console.log(`[OculusDash] Fetching ${detailRefs.length} detail pages (filtered from ${arr.length} total)...`);
                    console.log('[OculusDash] TrailerId map sample:', JSON.stringify(Object.entries(refToTrailerId).slice(0, 5)));
                    let detailCases = 0, detailItems = 0, detailOk = 0;
                    const detailPerTrailer = {};
                    let firstDetailLogged = false;
                    // Fetch in parallel batches of 5
                    for (let i = 0; i < detailRefs.length; i += 5) {
                        const batch = detailRefs.slice(i, i + 5);
                        const results = await Promise.all(batch.map(ref => {
                            // Fetch the AFT inbound detail HTML page which has the Total Pending table
                            const detailUrl = `https://${aftDomain}/${fc}/view-transfers/inbound/${ref}`;
                            return new Promise((resolve) => {
                                GM_xmlhttpRequest({
                                    method: 'GET', url: detailUrl,
                                    headers: { 'Accept': 'text/html' },
                                    onload: (resp) => {
                                        const html = resp.responseText || '';
                                        if (!firstDetailLogged) {
                                            firstDetailLogged = true;
                                            console.log('[OculusDash] First detail response status:', resp.status, 'length:', html.length, 'has Total Pending:', html.includes('Total Pending'));
                                        }
                                        // Parse Total Pending from the HTML
                                        try {
                                            const doc = new DOMParser().parseFromString(html, 'text/html');
                                            let cases = 0, items = 0;
                                            // Look for table with Cases/Items columns and Total Pending row
                                            for (const table of doc.querySelectorAll('table')) {
                                                const ths = Array.from(table.querySelectorAll('th')).map(h => h.textContent.trim());
                                                const ci = ths.findIndex(h => h === 'Cases');
                                                const ii = ths.findIndex(h => h === 'Items');
                                                if (ci === -1 && ii === -1) continue;
                                                for (const row of table.querySelectorAll('tr')) {
                                                    if (!row.textContent.includes('Total Pending')) continue;
                                                    const cells = row.querySelectorAll('td, th');
                                                    if (ci !== -1 && cells[ci]) cases = parseInt(cells[ci].textContent.trim().replace(/,/g,''),10)||0;
                                                    if (ii !== -1 && cells[ii]) items = parseInt(cells[ii].textContent.trim().replace(/,/g,''),10)||0;
                                                    if (cases === 0 && items === 0) {
                                                        // Fallback: grab all numbers from the row
                                                        const nums = Array.from(cells).map(x => parseInt(x.textContent.trim().replace(/,/g,''),10)).filter(n => !isNaN(n) && n > 0);
                                                        if (nums.length >= 2) { cases = nums[nums.length - 2]; items = nums[nums.length - 1]; }
                                                    }
                                                    break;
                                                }
                                                if (cases > 0 || items > 0) break;
                                            }
                                            resolve({ ref, cases, items });
                                        } catch(e) {
                                            resolve({ ref, cases: 0, items: 0 });
                                        }
                                    },
                                    onerror: () => resolve({ ref, cases: 0, items: 0 }),
                                    ontimeout: () => resolve({ ref, cases: 0, items: 0 }),
                                    timeout: 20000
                                });
                            });
                        }));
                        for (const { ref, cases: c, items: it } of results) {
                            if (c > 0 || it > 0) {
                                detailCases += c; detailItems += it; detailOk++;
                                const tid = refToTrailerId[ref];
                                if (tid) detailPerTrailer[tid] = { cases: c, items: it };
                            }
                        }
                    }
                    if (detailOk > 0) {
                        const result = { totalCases: detailCases, totalItems: detailItems, count: detailOk, trailerCount: detailRefs.length, timestamp: Date.now(), fc, perTrailer: detailPerTrailer };
                        GM_setValue('aftData_' + fc, JSON.stringify(result));
                        console.log('[OculusDash] ✓ AFT detail fetch:', detailCases, 'cases,', detailItems, 'items,', Object.keys(detailPerTrailer).length, 'per-trailer entries');
                        return result;
                    }
                }

                console.warn('[OculusDash] API returned transfers but no pending data extractable from detail pages');
                // Last resort: use manifest generic keys — may overcount but better than nothing
                console.log('[OculusDash] Falling back to manifest generic keys...');
                const genCK = ['cases','totalCases','caseQuantity','caseCount','numberOfCases'];
                const genIK = ['items','totalItems','itemQuantity','itemCount','numberOfItems'];
                let gc = 0, gi = 0, gcount = 0;
                for (const t of arr) {
                    let c = 0, it = 0;
                    for (const k of genCK) { if (t[k] !== undefined && t[k] !== null) { c = parseInt(t[k],10)||0; break; } }
                    for (const k of genIK) { if (t[k] !== undefined && t[k] !== null) { it = parseInt(t[k],10)||0; break; } }
                    if (c > 0 || it > 0) { gc += c; gi += it; gcount++; }
                }
                if (gcount > 0) {
                    const result = { totalCases: gc, totalItems: gi, count: gcount, trailerCount: gcount, timestamp: Date.now(), fc, approx: true };
                    GM_setValue('aftData_' + fc, JSON.stringify(result));
                    console.log('[OculusDash] ✓ AFT generic fallback:', result);
                    return result;
                }
                // Don't try next URL — we got a valid response, just no data
                break;
            } catch (err) {
                console.warn('[OculusDash] AFT API attempt failed:', err.message);
                continue; // Try next URL pattern
            }
        }

        // All API attempts failed — try scraping the AFT inbound page HTML
        console.log('[OculusDash] Trying AFT page scrape fallback...');
        try {
            const pageUrl = `https://${aftDomain}/${fc}/view-transfers/inbound/`;
            const html = await new Promise((resolve, reject) => {
                GM_xmlhttpRequest({
                    method: 'GET', url: pageUrl,
                    onload: (resp) => {
                        console.log('[OculusDash] AFT page status:', resp.status, 'length:', (resp.responseText||'').length);
                        if (resp.status >= 200 && resp.status < 300) resolve(resp.responseText || '');
                        else reject(new Error('Page status ' + resp.status));
                    },
                    onerror: () => reject(new Error('Page network error')),
                    ontimeout: () => reject(new Error('Page timeout')),
                    timeout: 30000
                });
            });

            if (html.length > 500) {
                // Method 1: Look for caseQuantityTotal and quantityItemsTotal spans
                const casesMatch = html.match(/id=["']caseQuantityTotal["'][^>]*>([\d,]+)/);
                const itemsMatch = html.match(/id=["']quantityItemsTotal["'][^>]*>([\d,]+)/);
                if (casesMatch || itemsMatch) {
                    const c = casesMatch ? parseInt(casesMatch[1].replace(/,/g,''),10)||0 : 0;
                    const it = itemsMatch ? parseInt(itemsMatch[1].replace(/,/g,''),10)||0 : 0;
                    if (c > 0 || it > 0) {
                        const result = { totalCases: c, totalItems: it, count: 1, trailerCount: 1, timestamp: Date.now(), fc };
                        GM_setValue('aftData_' + fc, JSON.stringify(result));
                        console.log('[OculusDash] ✓ AFT page scrape (spans):', result);
                        return result;
                    }
                }

                // Method 2: Look for embedded JSON data in script tags (SPA initial state)
                const jsonMatches = html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi);
                for (const m of jsonMatches) {
                    const script = m[1];
                    // Look for window.__INITIAL_STATE__ or similar patterns
                    const stateMatch = script.match(/(?:window\.__\w+__|window\.\w+State|var\s+\w*[Dd]ata)\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/|$)/);
                    if (stateMatch) {
                        try {
                            const state = JSON.parse(stateMatch[1]);
                            console.log('[OculusDash] Found embedded state, keys:', Object.keys(state));
                            // Try to find transfer data in the state
                            const findTransfers = (obj, depth = 0) => {
                                if (depth > 3 || !obj) return null;
                                if (Array.isArray(obj) && obj.length > 0 && typeof obj[0] === 'object') return obj;
                                if (typeof obj === 'object') {
                                    for (const v of Object.values(obj)) {
                                        const r = findTransfers(v, depth + 1);
                                        if (r) return r;
                                    }
                                }
                                return null;
                            };
                            const transfers = findTransfers(state);
                            if (transfers) {
                                console.log('[OculusDash] Found embedded transfers:', transfers.length);
                                // Process same as API response — only use pending-specific keys
                                let tc = 0, ti = 0, cnt = 0;
                                const ck = ['totalPendingCases','pendingCases'];
                                const ik = ['totalPendingItems','pendingItems'];
                                for (const t of transfers) {
                                    let c = 0, it = 0;
                                    for (const k of ck) { if (t[k] !== undefined) { c = parseInt(t[k],10)||0; break; } }
                                    for (const k of ik) { if (t[k] !== undefined) { it = parseInt(t[k],10)||0; break; } }
                                    if (c > 0 || it > 0) { tc += c; ti += it; cnt++; }
                                }
                                if (cnt > 0) {
                                    const result = { totalCases: tc, totalItems: ti, count: cnt, trailerCount: cnt, timestamp: Date.now(), fc };
                                    GM_setValue('aftData_' + fc, JSON.stringify(result));
                                    console.log('[OculusDash] ✓ AFT embedded state:', result);
                                    return result;
                                }
                            }
                        } catch(e) { /* not valid JSON */ }
                    }
                }

                // Method 3: Look for any API URLs in the page source we can try
                const apiMatches = html.matchAll(/["'](\/[^"']*(?:transfer|manifest|inbound)[^"']*(?:warehouse|date)[^"']*?)["']/gi);
                for (const am of apiMatches) {
                    const path = am[1];
                    if (path.includes('getTransfer')) continue; // Already tried
                    const tryUrl = `https://${aftDomain}${path}`;
                    console.log('[OculusDash] Found API path in page:', tryUrl);
                    try {
                        const resp = await new Promise((resolve) => {
                            GM_xmlhttpRequest({
                                method: 'GET', url: tryUrl,
                                headers: { 'Accept': 'application/json' },
                                onload: (r) => { try { resolve(JSON.parse(r.responseText)); } catch(e) { resolve(null); } },
                                onerror: () => resolve(null),
                                ontimeout: () => resolve(null),
                                timeout: 15000
                            });
                        });
                        if (resp && (Array.isArray(resp) || typeof resp === 'object')) {
                            console.log('[OculusDash] Got response from discovered API');
                            // Try to extract data same as main flow
                            let arr = Array.isArray(resp) ? resp : null;
                            if (!arr) { for (const v of Object.values(resp)) { if (Array.isArray(v) && v.length > 0) { arr = v; break; } } }
                            if (arr && arr.length > 0) {
                                let tc = 0, ti = 0, cnt = 0;
                                const ck = ['totalPendingCases','pendingCases'];
                                const ik = ['totalPendingItems','pendingItems'];
                                for (const t of arr) {
                                    let c = 0, it = 0;
                                    for (const k of ck) { if (t[k] !== undefined) { c = parseInt(t[k],10)||0; break; } }
                                    for (const k of ik) { if (t[k] !== undefined) { it = parseInt(t[k],10)||0; break; } }
                                    if (c > 0 || it > 0) { tc += c; ti += it; cnt++; }
                                }
                                if (cnt > 0) {
                                    const result = { totalCases: tc, totalItems: ti, count: cnt, trailerCount: cnt, timestamp: Date.now(), fc };
                                    GM_setValue('aftData_' + fc, JSON.stringify(result));
                                    console.log('[OculusDash] ✓ AFT discovered API:', result);
                                    return result;
                                }
                            }
                        }
                    } catch(e) { /* skip */ }
                }

                console.log('[OculusDash] Page scrape: no data found in HTML (' + html.length + ' chars)');
            }
        } catch(e) {
            console.warn('[OculusDash] AFT page scrape failed:', e.message);
        }

        console.warn('[OculusDash] All direct AFT fetch methods failed for', fc, '— opening AFT page in background...');
        if (stored) { console.log('[OculusDash] Using stale cached data while refreshing'); }

        // Auto-open AFT page in a small popup so the collector script runs
        // The collector will store data via GM_setValue, then we poll for it
        const aftUrl = getAFTUrl(fc);
        try {
            const popup = window.open(aftUrl, 'aft_collector_' + fc, 'width=400,height=300,left=-9999,top=-9999');
            if (popup) {
                console.log('[OculusDash] Opened AFT popup for', fc, '— waiting for collector...');
                // Poll for stored data for up to 30 seconds
                const result = await new Promise((resolve) => {
                    let attempts = 0;
                    const poll = setInterval(() => {
                        attempts++;
                        const fresh = GM_getValue('aftData_' + fc, null);
                        if (fresh) {
                            const data = JSON.parse(fresh);
                            // Only accept data that's newer than when we started
                            if (data.timestamp > Date.now() - 60000) {
                                clearInterval(poll);
                                try { popup.close(); } catch(e) {}
                                console.log('[OculusDash] ✓ Got fresh data from AFT collector');
                                resolve(data);
                                return;
                            }
                        }
                        if (attempts >= 30) {
                            clearInterval(poll);
                            try { popup.close(); } catch(e) {}
                            console.warn('[OculusDash] AFT collector timed out after 30s');
                            resolve(null);
                        }
                    }, 1000);
                });
                if (result) return result;
            } else {
                console.warn('[OculusDash] Popup blocked — user needs to allow popups or open AFT manually');
            }
        } catch(e) {
            console.warn('[OculusDash] Could not open AFT popup:', e.message);
        }

        if (stored) return JSON.parse(stored);
        return null;
    }


    // ─── Fetch Active Stowers count from FCLM functionRollup ────────────────
    // Counts rows under "Case Transfer In" for the last hour (each row = one stower)
    function fetchActiveStowers(fc) {
        return new Promise((resolve) => {
            const now = new Date();
            // Simple 1-hour window: now minus 1 hour to now
            const startDate = new Date(now.getTime() - 60 * 60 * 1000);
            const endDate = new Date(now);

            const fmtD = (d) => `${d.getFullYear()}%2F${String(d.getMonth()+1).padStart(2,'0')}%2F${String(d.getDate()).padStart(2,'0')}`;
            const url = `https://fclm-portal.amazon.com/reports/functionRollup?reportFormat=HTML&warehouseId=${fc}&processId=1003035&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${fmtD(startDate)}&startHourIntraday=${startDate.getHours()}&startMinuteIntraday=${String(startDate.getMinutes()).padStart(2,'0')}&endDateIntraday=${fmtD(endDate)}&endHourIntraday=${endDate.getHours()}&endMinuteIntraday=${String(endDate.getMinutes()).padStart(2,'0')}`;

            console.log(`[OculusDash] Active stowers fetch: ${startDate.getHours()}:${String(startDate.getMinutes()).padStart(2,'0')} - ${endDate.getHours()}:${String(endDate.getMinutes()).padStart(2,'0')}`);
            console.log(`[OculusDash] Active stowers full URL:`, url.replace(/%2F/g, '/'));

            GM_xmlhttpRequest({
                method: 'GET', url,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let headcount = 0;
                    console.log(`[OculusDash] Active stowers response length: ${text.length}`);
                    try {
                        // The detail table is in the response but may be hidden.
                        // Count employee timeDetails links — each unique employee = 1 stower
                        const empMatches = text.match(/\/employee\/timeDetails\?employeeId=\d+/g);
                        if (empMatches && empMatches.length > 0) {
                            // Deduplicate by employee ID (same person may appear in multiple size tabs)
                            const uniqueIds = new Set();
                            empMatches.forEach(m => {
                                const id = m.match(/employeeId=(\d+)/);
                                if (id) uniqueIds.add(id[1]);
                            });
                            headcount = uniqueIds.size;
                            console.log(`[OculusDash] Active stowers (unique employee links): ${headcount}`);
                        }

                        // Fallback: try Headcount text
                        if (headcount === 0) {
                            const m = text.match(/Headcount:\s*(\d+)/i);
                            if (m) {
                                headcount = parseInt(m[1], 10);
                                console.log(`[OculusDash] Active stowers (Headcount text): ${headcount}`);
                            }
                        }
                    } catch (e) {
                        console.log('[OculusDash] Active stowers parse error:', e);
                    }
                    resolve(headcount);
                },
                onerror: (e) => { console.log('[OculusDash] Active stowers network error:', e); resolve(0); },
                ontimeout: () => { console.log('[OculusDash] Active stowers timeout'); resolve(0); },
                timeout: 20000
            });
        });
    }

    // ─── Fetch Stow Rate JPH from FCLM ─────────────────────────────────────
    function fetchStowRate(fc) {
        return new Promise((resolve) => {
            const shift = getShiftConfig(fc);
            const now = new Date();
            const hour = now.getHours();
            const min = now.getMinutes();
            const timeVal = hour * 60 + min;
            let startDate, endDate, startH, startM, endH, endM;

            const nightStart = shift.nightStartH * 60 + shift.nightStartM;
            const nightEnd   = shift.nightEndH * 60 + shift.nightEndM;
            const dayStart   = shift.dayStartH * 60 + shift.dayStartM;
            const dayEnd     = shift.dayEndH * 60 + shift.dayEndM;

            // 30-minute grace period after shift ends
            const grace = 30;
            const dayEndGrace = dayEnd + grace;
            const nightEndGrace = nightEnd + grace;

            const isNight = timeVal >= nightStart || timeVal < nightEndGrace;
            const isDay = timeVal >= dayStart && timeVal < dayEndGrace;

            if (!isNight && !isDay) {
                resolve(null);
                return;
            }

            if (isNight) {
                startH = shift.nightStartH; startM = shift.nightStartM;
                endH = shift.nightEndH; endM = shift.nightEndM;
                if (hour >= shift.nightStartH) {
                    startDate = new Date(now);
                    endDate = new Date(now); endDate.setDate(endDate.getDate() + 1);
                } else {
                    startDate = new Date(now); startDate.setDate(startDate.getDate() - 1);
                    endDate = new Date(now);
                }
            } else {
                startH = shift.dayStartH; startM = shift.dayStartM;
                endH = shift.dayEndH; endM = shift.dayEndM;
                startDate = new Date(now);
                endDate = new Date(now);
            }

            const fmtD = (d) => `${d.getFullYear()}%2F${String(d.getMonth()+1).padStart(2,'0')}%2F${String(d.getDate()).padStart(2,'0')}`;
            const url = `https://fclm-portal.amazon.com/reports/functionRollup?warehouseId=${fc}&processId=1003035&startDateDay=&startDateWeek=&startDateMonth=&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${fmtD(startDate)}&startHourIntraday=${startH}&startMinuteIntraday=${startM}&endDateIntraday=${fmtD(endDate)}&endHourIntraday=${endH}&endMinuteIntraday=${endM}`;

            GM_xmlhttpRequest({
                method: 'GET', url,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let jph = null;
                    let totalStows = 0;
                    if (text.length > 500) {
                        let bestJPH = '';
                        let bestHours = 0;
                        let bestJobs = 0;
                        try {
                            const doc = new DOMParser().parseFromString(text, 'text/html');
                            const rows = doc.querySelectorAll('tr');
                            rows.forEach((row) => {
                                const cells = row.querySelectorAll('td');
                                if (cells.length >= 4) {
                                    const cellTexts = Array.from(cells).map(c => c.textContent.trim());
                                    if (cellTexts[0] === 'Total') {
                                        const nums = [];
                                        for (let i = 1; i < cellTexts.length; i++) {
                                            const v = parseFloat(cellTexts[i].replace(/,/g, ''));
                                            if (!isNaN(v)) nums.push(v);
                                        }
                                        if (nums.length >= 3 && nums[0] >= bestHours) {
                                            bestHours = nums[0];
                                            bestJPH = nums[2].toFixed(2);
                                            bestJobs = Math.round(nums[1]);
                                        }
                                    }
                                }
                            });
                        } catch (e) { /* skip */ }
                        if (bestJPH) { jph = bestJPH; totalStows = bestJobs; }
                    }
                    resolve({ jph, totalStows, url });
                },
                onerror: () => resolve(null),
            });
        });
    }

    // ─── Fetch Inbound Total Hours from FCLM processPathRollup ──────────────
    function fetchInboundHours(fc) {
        return new Promise((resolve) => {
            const shift = getShiftConfig(fc);
            const now = new Date();
            const hour = now.getHours();
            const min = now.getMinutes();
            const timeVal = hour * 60 + min;
            let startDate, endDate, startH, startM, endH, endM;

            const nightStart = shift.nightStartH * 60 + shift.nightStartM;
            const nightEnd   = shift.nightEndH * 60 + shift.nightEndM;
            const dayStart   = shift.dayStartH * 60 + shift.dayStartM;
            const dayEnd     = shift.dayEndH * 60 + shift.dayEndM;

            // 30-minute grace period after shift ends
            const grace = 30;
            const dayEndGrace = dayEnd + grace;
            const nightEndGrace = nightEnd + grace;

            const isNight = timeVal >= nightStart || timeVal < nightEndGrace;
            const isDay = timeVal >= dayStart && timeVal < dayEndGrace;

            if (!isNight && !isDay) { resolve(0); return; }

            if (isNight) {
                startH = shift.nightStartH; startM = shift.nightStartM;
                endH = shift.nightEndH; endM = shift.nightEndM;
                if (hour >= shift.nightStartH) {
                    startDate = new Date(now);
                    endDate = new Date(now); endDate.setDate(endDate.getDate() + 1);
                } else {
                    startDate = new Date(now); startDate.setDate(startDate.getDate() - 1);
                    endDate = new Date(now);
                }
            } else {
                startH = shift.dayStartH; startM = shift.dayStartM;
                endH = shift.dayEndH; endM = shift.dayEndM;
                startDate = new Date(now);
                endDate = new Date(now);
            }

            const fmtD = (d) => `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`;

            const url = `https://fclm-portal.amazon.com/reports/processPathRollup?reportFormat=HTML` +
                `&warehouseId=${fc}` +
                `&maxIntradayDays=1&spanType=Intraday` +
                `&startDateIntraday=${encodeURIComponent(fmtD(startDate))}` +
                `&startHourIntraday=${startH}&startMinuteIntraday=${String(startM).padStart(2,'0')}` +
                `&endDateIntraday=${encodeURIComponent(fmtD(endDate))}` +
                `&endHourIntraday=${endH}&endMinuteIntraday=${String(endM).padStart(2,'0')}` +
                `&_adjustPlanHours=on&_hideEmptyLineItems=on&_rememberViewForWarehouse=on&employmentType=AllEmployees`;

            GM_xmlhttpRequest({
                method: 'GET', url,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let totalHours = 0;
                    console.log('[OculusDash] IB hours fetch, response length:', text.length, 'url:', url.substring(0, 100));
                    try {
                        const doc = new DOMParser().parseFromString(text, 'text/html');
                        const rows = doc.querySelectorAll('tr');
                        // Find "Hrs" column index from headers
                        let hrsColIdx = -1;
                        for (const row of rows) {
                            const ths = Array.from(row.querySelectorAll('th'));
                            const idx = ths.findIndex(th => th.textContent.trim() === 'Hrs');
                            if (idx >= 0) { hrsColIdx = idx; break; }
                        }
                        if (hrsColIdx < 0) {
                            console.warn('[OculusDash] IB hours: "Hrs" column not found in PPR headers');
                        }
                        // Debug: find any row containing "Total" text
                        let debugTotalSamples = [];
                        for (const row of rows) {
                            if (row.textContent.includes('Total') || row.textContent.includes('TOTAL')) {
                                const cells = row.querySelectorAll('td, th');
                                if (cells.length > 0) {
                                    debugTotalSamples.push(Array.from(cells).slice(0, 6).map(c => c.textContent.trim().substring(0, 40)));
                                }
                            }
                            if (debugTotalSamples.length >= 5) break;
                        }
                        if (debugTotalSamples.length > 0) {
                            console.log('[OculusDash] IB hours debug - rows with Total:', JSON.stringify(debugTotalSamples));
                        } else {
                            console.warn('[OculusDash] IB hours debug - NO rows containing Total/TOTAL text found!');
                        }
                        // Find IB Total hours and Case Stow to Reserve hours from PPR
                        // Row format varies due to rowspans. Strategy: find the row, then look for
                        // the Hrs value which sits between Vol (large int) and Rate (larger decimal)
                        let ibTotalHrs = 0;
                        let caseStowReserveHrs = 0;

                        function extractHrsFromRow(row) {
                            const cells = row.querySelectorAll('td, th');
                            // Collect all numeric values from cells
                            const nums = [];
                            for (let i = 0; i < cells.length; i++) {
                                const txt = cells[i].textContent.trim().replace(/,/g, '');
                                const val = parseFloat(txt);
                                if (!isNaN(val)) nums.push({ val, idx: i });
                            }
                            // Pattern: Vol (large) | Hrs (small-medium) | Rate (large)
                            // Hrs is typically the smallest positive decimal among the last 3 numeric cells
                            // Or: find sequence where nums[i] > nums[i+1] < nums[i+2]
                            for (let i = 0; i < nums.length - 2; i++) {
                                if (nums[i].val > nums[i+1].val && nums[i+2].val > nums[i+1].val && nums[i+1].val > 0) {
                                    return nums[i+1].val; // This is Hrs (valley between Vol and Rate)
                                }
                            }
                            // Fallback: second numeric value if first is Vol
                            if (nums.length >= 3 && nums[0].val > 100 && nums[1].val < nums[0].val && nums[1].val > 0) {
                                return nums[1].val;
                            }
                            return 0;
                        }

                        for (const row of rows) {
                            const rowText = row.textContent;
                            if (rowText.includes('IB Total') && !rowText.includes('IB Lead')) {
                                const cells = row.querySelectorAll('td, th');
                                for (let ci = 0; ci < cells.length; ci++) {
                                    if (cells[ci].textContent.trim() === 'IB Total') {
                                        ibTotalHrs = extractHrsFromRow(row);
                                        break;
                                    }
                                }
                            }
                            if (rowText.includes('Case Stow to Reserve')) {
                                const cells = row.querySelectorAll('td, th');
                                for (let ci = 0; ci < cells.length; ci++) {
                                    if (cells[ci].textContent.trim() === 'Case Stow to Reserve') {
                                        caseStowReserveHrs = extractHrsFromRow(row);
                                        break;
                                    }
                                }
                            }
                        }

                        if (ibTotalHrs > 0) {
                            totalHours = ibTotalHrs - caseStowReserveHrs;
                            console.log('[OculusDash] IB Total hrs:', ibTotalHrs, '- Case Stow Reserve:', caseStowReserveHrs, '= CPLH hours:', totalHours);
                        } else {
                            console.warn('[OculusDash] IB hours: Could not find IB Total row');
                        }
                        // Use fallback if IB Total wasn't found
                        if (totalHours === 0 && fallbackHours > 0) {
                            totalHours = fallbackHours;
                            console.log('[OculusDash] IB hours (fallback TOTAL row):', totalHours);
                        }
                    } catch (e) { console.log('[OculusDash] IB hours parse error:', e); }
                    resolve(totalHours);
                },
                onerror: () => { console.warn('[OculusDash] IB hours fetch error'); resolve(0); },
                ontimeout: () => { console.warn('[OculusDash] IB hours fetch timeout'); resolve(0); },
                timeout: 20000
            });
        });
    }

    // ─── Fetch Total Cases (Case Transfer In + Pallet Transfer In) from FCLM ────
    function fetchTotalCases(fc) {
        return new Promise((resolve) => {
            const shift = getShiftConfig(fc);
            const now = new Date();
            const hour = now.getHours();
            const min = now.getMinutes();
            const timeVal = hour * 60 + min;
            let startDate, endDate, startH, startM, endH, endM;

            const nightStart = shift.nightStartH * 60 + shift.nightStartM;
            const nightEnd   = shift.nightEndH * 60 + shift.nightEndM;
            const dayStart   = shift.dayStartH * 60 + shift.dayStartM;
            const dayEnd     = shift.dayEndH * 60 + shift.dayEndM;

            // 30-minute grace period after shift ends
            const grace = 30;
            const dayEndGrace = dayEnd + grace;
            const nightEndGrace = nightEnd + grace;

            const isNight = timeVal >= nightStart || timeVal < nightEndGrace;
            const isDay = timeVal >= dayStart && timeVal < dayEndGrace;

            if (!isNight && !isDay) { resolve(null); return; }

            if (isNight) {
                startH = shift.nightStartH; startM = shift.nightStartM;
                endH = shift.nightEndH; endM = shift.nightEndM;
                if (hour >= shift.nightStartH) {
                    startDate = new Date(now);
                    endDate = new Date(now); endDate.setDate(endDate.getDate() + 1);
                } else {
                    startDate = new Date(now); startDate.setDate(startDate.getDate() - 1);
                    endDate = new Date(now);
                }
            } else {
                startH = shift.dayStartH; startM = shift.dayStartM;
                endH = shift.dayEndH; endM = shift.dayEndM;
                startDate = new Date(now);
                endDate = new Date(now);
            }

            const fmtD = (d) => `${d.getFullYear()}%2F${String(d.getMonth()+1).padStart(2,'0')}%2F${String(d.getDate()).padStart(2,'0')}`;
            const url = `https://fclm-portal.amazon.com/reports/functionRollup?reportFormat=HTML&warehouseId=${fc}&processId=1003041&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${fmtD(startDate)}&startHourIntraday=${startH}&startMinuteIntraday=${startM}&endDateIntraday=${fmtD(endDate)}&endHourIntraday=${endH}&endMinuteIntraday=${endM}`;

            GM_xmlhttpRequest({
                method: 'GET', url,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let totalCases = 0;
                    if (text.length > 500) {
                        try {
                            const doc = new DOMParser().parseFromString(text, 'text/html');
                            const rows = doc.querySelectorAll('tr');
                            let foundPalletTransfer = false;
                            let palletTotalFound = false;
                            rows.forEach((row) => {
                                if (palletTotalFound) return;
                                const allCells = Array.from(row.querySelectorAll('th, td'));
                                allCells.forEach(c => {
                                    if (/^pallet\s*transfer\s*in$/i.test(c.textContent.trim())) foundPalletTransfer = true;
                                });

                                if (foundPalletTransfer) {
                                    const cells = row.querySelectorAll('td');
                                    const cellTexts = Array.from(cells).map(c => c.textContent.trim());
                                    if (cellTexts.includes('Total')) {
                                        const nums = [];
                                        for (const c of cellTexts) {
                                            const v = parseFloat(c.replace(/,/g, ''));
                                            if (!isNaN(v)) nums.push(v);
                                        }
                                        // nums: [Hours, Jobs, JPH, EACH_UNIT, EACH_UPH, CASE_UNIT, ...]
                                        if (nums.length >= 6) {
                                            totalCases = Math.round(nums[5]);
                                            console.log(`[OculusDash] Pallet Transfer In Case UNIT: ${totalCases}, nums=${JSON.stringify(nums)}`);
                                        }
                                        palletTotalFound = true;
                                    }
                                }
                            });
                        } catch (e) { console.log('[OculusDash] fetchTotalCases error:', e); }
                    }
                    console.log('[OculusDash] Pallet Transfer In cases:', totalCases);
                    resolve({ totalCases, url });
                },
                onerror: () => resolve(null),
            });
        });
    }

    // ─── Fetch daily stow jobs for backlog calculation ─────────────────────
    function fetchDailyStowJobs(fc, daysBack = 7) {
        const shift = getShiftConfig(fc);
        const fmtD = (d) => `${d.getFullYear()}%2F${String(d.getMonth()+1).padStart(2,'0')}%2F${String(d.getDate()).padStart(2,'0')}`;
        const promises = [];
        for (let i = 1; i <= daysBack; i++) {
            const day = new Date(); day.setDate(day.getDate() - i);
            const next = new Date(day); next.setDate(next.getDate() + 1);
            // Full day: day shift start → night shift end next day
            const url = `https://fclm-portal.amazon.com/reports/functionRollup?warehouseId=${fc}&processId=1003035&startDateDay=&startDateWeek=&startDateMonth=&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${fmtD(day)}&startHourIntraday=${shift.dayStartH}&startMinuteIntraday=${shift.dayStartM}&endDateIntraday=${fmtD(next)}&endHourIntraday=${shift.nightEndH}&endMinuteIntraday=${shift.nightEndM}`;
            promises.push(new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'GET', url,
                    onload: (resp) => {
                        const text = resp.responseText || '';
                        let jobs = 0;
                        if (text.length > 500) {
                            try {
                                const doc = new DOMParser().parseFromString(text, 'text/html');
                                const rows = doc.querySelectorAll('tr');
                                rows.forEach((row) => {
                                    const cells = row.querySelectorAll('td');
                                    if (cells.length >= 4) {
                                        const cellTexts = Array.from(cells).map(c => c.textContent.trim());
                                        if (cellTexts[0] === 'Total') {
                                            const nums = [];
                                            for (let i = 1; i < cellTexts.length; i++) {
                                                const v = parseFloat(cellTexts[i].replace(/,/g, ''));
                                                if (!isNaN(v)) nums.push(v);
                                            }
                                            if (nums.length >= 2 && nums[1] > jobs) jobs = nums[1];
                                        }
                                    }
                                });
                            } catch (e) { /* skip */ }
                        }
                        resolve(jobs);
                    },
                    onerror: () => resolve(0),
                });
            }));
        }
        return Promise.all(promises);
    }

    // ─── Fetch KIPS trailer count from Maple Syrup ─────────────────────────────
    function fetchKipsCount(fc) {
        const url = `https://maple-syrup.corp.amazon.com/${fc.toUpperCase()}/kips/thermometer`;
        GM_xmlhttpRequest({
            method: 'GET',
            url: url,
            onload: function(response) {
                try {
                    const kipsEl = document.getElementById('oc-kips-count');
                    if (!kipsEl) return;
                    // Parse the HTML and count rows in the kips-gantt table tbody
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(response.responseText, 'text/html');
                    const tbody = doc.querySelector('#kips-gantt tbody') || doc.querySelector('table.kips-table tbody');
                    if (tbody) {
                        const rows = tbody.querySelectorAll('tr[role="row"], tr[data-ste-time]');
                        const count = rows.length > 0 ? rows.length : tbody.querySelectorAll('tr').length;
                        kipsEl.textContent = count;
                        console.log('[OculusDash] KIPS count (rows):', count);
                    } else {
                        // Fallback: count all table rows that have data-ste-time attribute
                        const allRows = doc.querySelectorAll('tr[data-ste-time]');
                        if (allRows.length > 0) {
                            kipsEl.textContent = allRows.length;
                            console.log('[OculusDash] KIPS count (fallback rows):', allRows.length);
                        } else {
                            kipsEl.textContent = '—';
                            console.warn('[OculusDash] KIPS: could not find trailer rows');
                        }
                    }
                } catch(e) {
                    const kipsEl = document.getElementById('oc-kips-count');
                    if (kipsEl) kipsEl.textContent = '—';
                    console.warn('[OculusDash] KIPS fetch parse error:', e);
                }
            },
            onerror: function() {
                const kipsEl = document.getElementById('oc-kips-count');
                if (kipsEl) kipsEl.textContent = '—';
                console.warn('[OculusDash] KIPS fetch failed');
            }
        });
    }

    // ─── Fetch Learning Curve breakdown from ADAPT ──────────────────────────────
    function fetchLearningCurve(fc) {
        const adaptBase = 'https://adapt-iad.amazon.com';
        const wh = encodeURIComponent(fc.toUpperCase());
        const now = new Date();
        const endIso = now.toISOString();
        const startIso = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

        console.log('[OculusDash-LC] Fetching employee list from FCLM stow rollup...');

        // Step 1: Get employee IDs from the FCLM Function Rollup for stow (same page we already hit for stow rate)
        const startDate = new Date(now.getTime() - 60 * 60 * 1000);
        const endDate = new Date(now);
        const fmtD = (d) => `${d.getFullYear()}%2F${String(d.getMonth()+1).padStart(2,'0')}%2F${String(d.getDate()).padStart(2,'0')}`;
        const fclmUrl = `https://fclm-portal.amazon.com/reports/functionRollup?reportFormat=HTML&warehouseId=${fc}&processId=1003035&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${fmtD(startDate)}&startHourIntraday=${startDate.getHours()}&startMinuteIntraday=${String(startDate.getMinutes()).padStart(2,'0')}&endDateIntraday=${fmtD(endDate)}&endHourIntraday=${endDate.getHours()}&endMinuteIntraday=${String(endDate.getMinutes()).padStart(2,'0')}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: fclmUrl,
            timeout: 20000,
            onload: function(resp) {
                const text = resp.responseText || '';
                // Extract employee IDs from the FCLM page (links contain employeeId=XXXXXXX)
                const empMatches = text.match(/employeeId=(\d+)/g);
                const eidSet = new Set();
                if (empMatches) {
                    empMatches.forEach(m => {
                        const id = m.replace('employeeId=', '');
                        if (id.length >= 5) eidSet.add(id);
                    });
                }

                const eidList = Array.from(eidSet);
                console.log(`[OculusDash-LC] Found ${eidList.length} employee IDs from FCLM`);

                if (eidList.length === 0) {
                    console.warn('[OculusDash-LC] No employees found in FCLM rollup');
                    updateLCDisplay(null);
                    return;
                }

                // Step 2: Batch fetch LC levels from ADAPT
                const batchStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const BATCH_SIZE = 50;
                const batches = [];
                for (let i = 0; i < eidList.length; i += BATCH_SIZE) {
                    batches.push(eidList.slice(i, i + BATCH_SIZE));
                }

                const lcCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, unknown: 0 };
                let completedBatches = 0;
                const seenEmployees = new Set();

                batches.forEach(batch => {
                    const eidParam = encodeURIComponent(JSON.stringify(batch));
                    const batchUrl = `${adaptBase}/api/femida-svc/GetBatchEmployeePerformanceMetrics?warehouseId=${wh}&employeeIds=${eidParam}&startTime=${encodeURIComponent(batchStart)}&endTime=${encodeURIComponent(endIso)}&performanceMetricType=ProcessPathRollupHourly`;

                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: batchUrl,
                        timeout: 30000,
                        onload: function(br) {
                            try {
                                const d = JSON.parse(br.responseText);
                                if (d && d.batchPerformanceMetrics) {
                                    Object.keys(d.batchPerformanceMetrics).forEach(eid => {
                                        const metrics = d.batchPerformanceMetrics[eid];
                                        if (!Array.isArray(metrics)) return;

                                        let bestLevel = 0;
                                        let isStower = false;
                                        metrics.forEach(m => {
                                            const attrs = m && m.performanceMetricAttributes;
                                            if (!attrs) return;
                                            const funcName = (() => {
                                                try {
                                                    const pa = typeof attrs.processAttributes === 'string'
                                                        ? JSON.parse(attrs.processAttributes)
                                                        : attrs.processAttributes;
                                                    return (pa && pa.FUNCTION_NAME) || '';
                                                } catch(e) { return ''; }
                                            })();
                                            const fn = funcName.toLowerCase();
                                            if (fn.includes('case transfer in') || fn.includes('pallet transfer') || fn.includes('stow') || fn.includes('inbound')) {
                                                isStower = true;
                                                const lcStr = attrs.learningCurveId || '';
                                                const lvl = parseInt((lcStr.match(/\d/) || ['0'])[0]) || 0;
                                                if (lvl > bestLevel) bestLevel = lvl;
                                            }
                                        });

                                        if (isStower && !seenEmployees.has(eid)) {
                                            seenEmployees.add(eid);
                                            if (bestLevel >= 1 && bestLevel <= 5) {
                                                lcCounts[bestLevel]++;
                                            } else {
                                                lcCounts.unknown++;
                                            }
                                        }
                                    });
                                }
                            } catch(e) {
                                console.warn('[OculusDash-LC] Batch parse error:', e);
                            }

                            completedBatches++;
                            if (completedBatches === batches.length) {
                                console.log('[OculusDash-LC] All batches done:', JSON.stringify(lcCounts));
                                updateLCDisplay(lcCounts);
                            }
                        },
                        onerror: function() {
                            completedBatches++;
                            if (completedBatches === batches.length) updateLCDisplay(lcCounts);
                        },
                        ontimeout: function() {
                            completedBatches++;
                            if (completedBatches === batches.length) updateLCDisplay(lcCounts);
                        }
                    });
                });
            },
            onerror: function() {
                console.warn('[OculusDash-LC] FCLM fetch failed');
                updateLCDisplay(null);
            },
            ontimeout: function() {
                console.warn('[OculusDash-LC] FCLM fetch timed out');
                updateLCDisplay(null);
            }
        });
    }

    function updateLCDisplay(lcCounts) {
        const el = document.getElementById('oc-lc-display');
        if (!el) return;

        if (!lcCounts) {
            el.textContent = 'Learning Curve Mix: —';
            el.style.color = '#888';
            return;
        }

        const total = lcCounts[1] + lcCounts[2] + lcCounts[3] + lcCounts[4] + lcCounts[5] + lcCounts.unknown;
        if (total === 0) {
            el.textContent = 'Learning Curve Mix: No stowers found';
            el.style.color = '#888';
            return;
        }

        const pct = (n) => Math.round((n / total) * 100);
        const parts = [];
        if (lcCounts[5] > 0) parts.push(`<span style="color:#27AE60;font-weight:bold;">LC5 ${pct(lcCounts[5])}%</span>`);
        if (lcCounts[4] > 0) parts.push(`<span style="color:#C3CAD7;">LC4 ${pct(lcCounts[4])}%</span>`);
        if (lcCounts[3] > 0) parts.push(`<span style="color:#eab308;">LC3 ${pct(lcCounts[3])}%</span>`);
        const l12 = lcCounts[1] + lcCounts[2];
        if (l12 > 0) parts.push(`<span style="color:#F2994A;font-weight:bold;">LC1-2 ${pct(l12)}%</span>`);

        el.innerHTML = `<span style="color:#C3CAD7;">Learning Curve Mix</span> &nbsp; ${parts.join(' <span style="color:#555;">•</span> ')}`;
    }

    // ─── Wait for page to fully render ──────────────────────────────────────────
    function waitForContent(callback, maxWait = 30000) {
        const start = Date.now();
        const interval = setInterval(() => {
            const h3 = document.querySelector('h3');
            const rows = document.querySelectorAll('tr, [role="row"]');
            const hasData = Array.from(rows).some(r => r.querySelectorAll('td, [role="cell"]').length >= 20);
            if (h3 && h3.textContent.includes('Transship Summary') && hasData) {
                clearInterval(interval);
                setTimeout(callback, 2000);
            } else if (Date.now() - start > maxWait) {
                clearInterval(interval);
                callback();
            }
        }, 1000);
    }

    // ─── Extract summary stats from the top cards ────────────────────────────────
    function extractSummary() {
        const allLeaves = [];
        document.querySelector('main')?.querySelectorAll('*').forEach(el => {
            if (el.children.length === 0 && el.textContent.trim()) allLeaves.push(el.textContent.trim());
        });
        const labels = [
            '# of Trailers', 'Total Units', '% Case', '% Tote',
            '% SA Pallet', '% Floor Loaded Trailer', '% Palletized Trailer',
            '% Small', '% Medium', '% Other', 'Case Density', 'Tote Density'
        ];
        const rows = { 'IN YARD': {}, 'TOMORROW - FORECAST': {}, 'PREVIOUS WEEK': {} };
        const sections = ['IN YARD', 'TOMORROW - FORECAST', 'PREVIOUS WEEK'];
        const labelStart = allLeaves.indexOf('# of Trailers');
        if (labelStart === -1) return { rows, raw: allLeaves };
        const allValues = allLeaves.slice(labelStart + labels.length);
        let idx = 0;
        sections.forEach(section => {
            const marker = allValues.indexOf(section, idx);
            if (marker !== -1) {
                const vals = allValues.slice(marker + 1, marker + 1 + labels.length);
                labels.forEach((lbl, i) => { rows[section][lbl] = vals[i] || 'N/A'; });
                idx = marker + 1;
            }
        });
        return { rows, labels, raw: allLeaves };
    }

    // ─── Extract trailer table rows ──────────────────────────────────────────────
    function extractTrailers() {
        const trailers = [];
        const tables = document.querySelectorAll('table, [role="grid"]');
        const statuses = ['ARRIVED', 'CHECKED_IN', 'ARRIVAL_SCHEDULED', 'DEPARTED'];

        // Build column index map from header row
        let colMap = {};
        const allRows = document.querySelectorAll('tr, [role="row"]');
        for (const r of allRows) {
            const ths = Array.from(r.querySelectorAll('th, [role="columnheader"]'));
            if (ths.length >= 10) {
                ths.forEach((th, i) => {
                    const txt = th.textContent.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (txt) colMap[txt] = i;
                });
                console.log('[OculusDash DEBUG] Column map from headers:', JSON.stringify(colMap));
                break;
            }
        }

        // Helper to get column index by partial key match
        const col = (key) => {
            const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (colMap[k] !== undefined) return colMap[k];
            // Fuzzy match
            for (const [name, idx] of Object.entries(colMap)) {
                if (name.includes(k)) return idx;
            }
            return -1;
        };

        // If header detection failed, try to find trailer location by scanning first data row
        let trailerLocIdx = col('trailerlocation');
        if (trailerLocIdx < 0) {
            // Look for a cell matching PS/DD + digits pattern in first data row
            for (const r of allRows) {
                const cells = Array.from(r.querySelectorAll('td, [role="cell"]'));
                if (cells.length >= 20) {
                    for (let i = 0; i < cells.length; i++) {
                        const txt = cells[i].textContent.trim();
                        if (/^(PS|DD)\d{2,}$/i.test(txt)) {
                            trailerLocIdx = i;
                            console.log('[OculusDash DEBUG] Found trailer location at index', i, 'value:', txt);
                            break;
                        }
                    }
                    if (trailerLocIdx >= 0) break;
                }
            }
        }
        console.log('[OculusDash DEBUG] trailerLocIdx:', trailerLocIdx);

        const rows = document.querySelectorAll('tr, [role="row"]');
        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, [role="cell"]'));
            if (cells.length >= 20) {
                const vals = cells.map(c => c.textContent.trim());
                // Also check for th cells in the row (VRID may be in a th)
                const thCells = Array.from(row.querySelectorAll('th'));
                const vrid = thCells.length > 0 ? thCells[0].textContent.trim() : '';
                if (statuses.some(s => vals.includes(s))) {
                    if (trailers.length === 0) {
                        console.log('[OculusDash DEBUG] First data row vrid:', vrid, 'vals[0..5]:', JSON.stringify(vals.slice(0, 6)));
                        console.log('[OculusDash DEBUG] First data row vals[20..30]:', JSON.stringify(vals.slice(20, 30)));
                        console.log('[OculusDash DEBUG] col totalcartons:', col('totalcartons'), 'col totalunits:', col('totalunits'), 'col units:', col('units'));
                    }
                    // Log palletized rows to debug Total Units column
                    const loadCfg = vals[col('loadconfig')]||(vals.includes('PALLETIZED') ? 'PALLETIZED' : '');
                    if (loadCfg === 'PALLETIZED' && trailers.filter(t => t.loadConfig === 'PALLETIZED').length === 0) {
                        console.log('[OculusDash DEBUG] First PALLETIZED row vrid:', vrid, 'cells:', cells.length, 'vals[18..28]:', JSON.stringify(vals.slice(18, 28)));
                    }
                    const apptIdx = col('apptstatus') >= 0 ? col('apptstatus') : vals.findIndex(v => statuses.includes(v));
                    trailers.push({
                        trailerNum: vrid || vals[0]||'',
                        isa: vrid ? (vals[0]||'') : (vals[1]||''),
                        trailerLocation: (trailerLocIdx >= 0 ? vals[trailerLocIdx] : vals[col('trailerlocation')])||'',
                        scac: vals[col('scac')]||vals[9]||'',
                        source: vals[col('source')]||vals[10]||'',
                        apptStatus: vals[apptIdx]||'',
                        transshipStatus: vals[apptIdx+1]||'',
                        loadConfig: vals[col('loadconfig')]||(apptIdx >= 0 ? vals[apptIdx+2] : '')||'',
                        flType: vals[col('fltype')]||(apptIdx >= 0 ? vals[apptIdx+3] : '')||'',
                        priorityScore: vals[col('priorityscore')]||vals[8]||'',
                        arrivalTime: vals[col('arrivaltime')]||vals[11]||'',
                        singleASINPallets: vals[col('singleasinpallets')]||vals[14]||'0',
                        mixedASINPallets: vals[col('mixedasinpallets')]||vals[15]||'0',
                        totalPallets: vals[col('totalpallets')]||vals[16]||'0',
                        flCases: vals[col('flcases')]||vals[18]||'0',
                        palletizedSACases: vals[col('palletizedsacases')]||vals[20]||'0',
                        palletizedMixCases: vals[col('palletizedmixcases')]||vals[21]||'0',
                        totalCartons: (() => {
                            // FLOOR-LOAD rows: vals[22], PALLETIZED rows (51+ cells): vals[21]
                            // Use whichever has a valid number
                            const v22 = parseInt((vals[22]||'0').replace(/,/g,''), 10) || 0;
                            if (v22 > 0) return vals[22];
                            const v21 = parseInt((vals[21]||'0').replace(/,/g,''), 10) || 0;
                            if (v21 > 0) return vals[21];
                            return '0';
                        })(),
                        totalUnits: (() => {
                            // Total Units is the last large non-zero numeric value in the row (after index 22)
                            // Skip percentage values (contain %)
                            for (let i = vals.length - 1; i > 22; i--) {
                                if ((vals[i]||'').includes('%')) continue;
                                const n = parseInt((vals[i]||'0').replace(/,/g,''), 10);
                                if (n > 0) return vals[i];
                            }
                            return '0';
                        })(),
                    });
                }
            }
        });
        return trailers;
    }

    function getMeta() {
        const allText = [];
        document.querySelectorAll('*').forEach(el => {
            if (el.children.length === 0 && el.textContent.trim()) allText.push(el.textContent.trim());
        });
        const fcIdx = allText.findIndex(t => t.startsWith('Fulfillment Center:'));
        const refreshIdx = allText.findIndex(t => t.includes('minutes ago') || t.includes('seconds ago') || t.includes('hour'));
        const tzIdx = allText.findIndex(t => t.includes('FC local timezone:'));
        return {
            fc: fcIdx !== -1 ? allText[fcIdx] : '',
            refresh: refreshIdx !== -1 ? allText[refreshIdx] : '',
            tz: tzIdx !== -1 ? allText[tzIdx] : ''
        };
    }

    // ─── CSS ─────────────────────────────────────────────────────────────────────
    const CSS = `
    #oc-dash { position:fixed;top:0;left:0;z-index:99999;background:#20232F;color:#e0e0e0;border:none;border-radius:0;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;width:100vw;max-height:100vh;overflow-y:auto;box-sizing:border-box; }
    #oc-dash.collapsed .oc-body { display:none; }
    #oc-dash.collapsed { max-height:none;overflow:visible; }
    #oc-header { background:#2A2D3E;padding:16px 16px 12px;display:flex;justify-content:center;align-items:center;border-radius:0;position:sticky;top:0;z-index:2;position:relative;min-height:90px; }
    #oc-header .oc-header-center { text-align:center; }
    #oc-header .title { font-weight:bold;font-size:22px;color:#F2F5FA; }
    #oc-header .meta { font-size:14px;color:#888;margin-top:2px; }
    .oc-btns { display:flex;gap:6px;align-items:center;position:absolute;right:12px;top:30%;transform:translateY(-50%); }
    .oc-left-btns { position:absolute;left:12px;top:30%;transform:translateY(-50%);display:flex;gap:10px;align-items:center;max-width:40%;overflow:hidden; }
    .oc-kips-btn { background:#4A72C9;color:#F2F5FA;border:none;border-radius:6px;padding:10px 18px;font-size:16px;font-weight:bold;cursor:pointer;text-decoration:none;display:inline-block;transition:background 0.2s;white-space:nowrap;flex-shrink:0; }
    .oc-kips-btn:hover { background:#5a82d9; }
    .oc-stowmap-btn { background:#4A72C9;color:#F2F5FA;border:none;border-radius:6px;padding:10px 18px;font-size:16px;font-weight:bold;cursor:pointer;transition:background 0.2s;text-decoration:none;white-space:nowrap;flex-shrink:0; }
    .oc-stowmap-btn:hover { background:#5a82d9; }
    .oc-recs-btn { background:#4A72C9;color:#F2F5FA;border:none;border-radius:6px;padding:10px 18px;font-size:16px;font-weight:bold;cursor:pointer;transition:background 0.2s;text-decoration:none;white-space:nowrap; }
    .oc-recs-btn:hover { background:#5a82d9; }
    .oc-recs-btn.active { background:#27AE60;color:#F2F5FA; }
    .oc-btn { cursor:pointer;background:#4A72C9;color:#F2F5FA;border:none;border-radius:6px;padding:10px 18px;font-size:14px;font-weight:bold; }
    .oc-btn:hover { background:#5a82d9; }
    .oc-btn.refresh { background:#4A72C9;color:#F2F5FA; }
    .oc-btn.refresh:hover { background:#5a82d9; }
    .oc-recs-overlay { padding:14px;overflow-y:auto;max-height:calc(100vh - 120px); }
    .oc-body { padding:14px; }
    .summary-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:14px; }
    .summary-card { background:#2A2D3E;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.06); }
    .card-header { padding:10px 14px;font-weight:bold;font-size:18px;text-align:center;border-radius:8px 8px 0 0; }
    .card-header.yard { background:#4F73C9;color:#F2F5FA; }
    .card-header.tmrw { background:#009688;color:#F2F5FA; }
    .card-table { width:100%;border-collapse:collapse;font-size:16px;background:#323547; }
    .card-table td { padding:10px 14px;border-bottom:1px solid #3a3d4e; }
    .card-table td:first-child { color:#C3CAD7; }
    .card-table td:last-child { text-align:right;color:#ffffff;font-weight:bold;font-size:18px; }
    .card-table tr:last-child td { border-bottom:none; }
    .trailer-wrap { overflow-x:hidden; }
    table.trailer-tbl { width:100%;border-collapse:collapse;font-size:12px; }
    table.trailer-tbl th { background:#364D82;color:#C3CAD7;padding:6px 4px;text-align:left;white-space:nowrap;position:sticky;top:0;font-weight:bold;font-size:11px;text-transform:uppercase;letter-spacing:0.3px; }
    table.trailer-tbl td { padding:5px 4px;border-bottom:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#e0e0e0; }
    table.trailer-tbl tr:nth-child(odd) td { background:#2A2D3E; }
    table.trailer-tbl tr:nth-child(even) td { background:#313447; }
    table.trailer-tbl tr:hover td { background:#3a3d52; }
    .status-arrived { color:#27AE60; } .status-checked_in { color:#4A72C9; }
    .status-arrival_sched { color:#888; } .status-departed { color:#F2994A; }
    .score-high { color:#EB5757;font-weight:bold; } .score-mid { color:#F2994A; } .score-low { color:#e0e0e0; }
    .no-trailers { color:#666;padding:14px;text-align:center; }
    .trailer-section-header { display:flex;justify-content:space-between;align-items:center;font-weight:bold;font-size:14px;color:#F2F5FA;background:#4A72C9;margin:12px 0 8px;padding:8px 14px;border-radius:8px;cursor:pointer;user-select:none; }
    .trailer-section-header:hover { background:#5a82d9; }
    .trailer-toggle-btn { background:rgba(255,255,255,0.2);color:#F2F5FA;border:none;border-radius:4px;padding:3px 10px;font-size:11px;cursor:pointer; }
    .trailer-toggle-btn:hover { background:rgba(255,255,255,0.3); }
    .trailer-section-body.hidden { display:none; }
    `;

    // ─── Render ───────────────────────────────────────────────────────────────────
    function statusClass(s) {
        const m = { 'ARRIVED':'arrived','CHECKED_IN':'checked_in','ARRIVAL_SCHEDULED':'arrival_sched','DEPARTED':'departed' };
        return 'status-' + (m[s] || '');
    }
    function scoreClass(s) {
        const n = parseFloat(s); if (isNaN(n)) return '';
        return n >= 3000 ? 'score-high' : n >= 1000 ? 'score-mid' : 'score-low';
    }
    function buildSummaryCard(title, cls, data, labels) {
        const rows = labels.map(l => `<tr><td>${l}</td><td>${data[l]||'N/A'}</td></tr>`).join('');
        return `<div class="summary-card"><div class="card-header ${cls}">${title}</div><table class="card-table">${rows}</table></div>`;
    }
    let trailerSortField = null; // null = default status sort, or field name to sort desc
    function buildTrailerTable(trailers, fc, aftPerTrailer) {
        if (!trailers.length) return '<div class="no-trailers">No trailer data found — try refreshing.</div>';
        const aftMap = aftPerTrailer || {};
        const order = { 'CHECKED_IN':0,'ARRIVED':1,'ARRIVAL_SCHEDULED':2,'DEPARTED':3 };
        let sorted;
        if (trailerSortField) {
            sorted = [...trailers].sort((a,b) => {
                const av = parseInt((a[trailerSortField]||'0').replace(/,/g,''),10)||0;
                const bv = parseInt((b[trailerSortField]||'0').replace(/,/g,''),10)||0;
                return bv - av;
            });
        } else {
            sorted = [...trailers].sort((a,b) => (order[a.apptStatus]??9) - (order[b.apptStatus]??9));
        }
        const sortableColumns = {
            'SA Pallets': 'singleASINPallets',
            'SA Pallet Cases': 'palletizedSACases',
            'Mixed Pallets': 'mixedASINPallets',
            'FL Cases': 'flCases',
            'Total Cartons': 'totalCartons',
            'Total Units': 'totalUnits',
        };
        const hdrs = ['VRID','Map Location','Appt Status','Trailer Location','Load Config','FL Type','Priority','Source','Arrival Time','SA Pallets','SA Pallet Cases','Mixed Pallets','FL Cases','Total Cartons','Total Units','Density'];
        const head = hdrs.map(h => {
            if (sortableColumns[h]) {
                const field = sortableColumns[h];
                const arrow = trailerSortField === field ? ' ▼' : ' ⇅';
                return `<th style="cursor:pointer;user-select:none;text-align:right;" class="oc-sortable" data-field="${field}">${h}${arrow}</th>`;
            }
            if (h === 'Density') return `<th style="text-align:right;">${h}</th>`;
            return `<th>${h}</th>`;
        }).join('');
        const body = sorted.map(t => {
            const isInYard = t.apptStatus === 'ARRIVED' || t.apptStatus === 'CHECKED_IN';
            const isScheduled = t.apptStatus === 'ARRIVAL_SCHEDULED';
            // CHECKED_IN trailers search by dock door location; ARRIVED trailers search by VRID
            const ymsSearchTerm = t.apptStatus === 'CHECKED_IN' && t.trailerLocation
                ? t.trailerLocation
                : t.trailerNum;
            const ymsUrl = `https://trans-logistics.amazon.com/yms/shipclerk#/yard?nodeId=${encodeURIComponent(fc)}&searchQuery=${encodeURIComponent(ymsSearchTerm)}`;
            const vridCell = isInYard
                ? `<a href="${ymsUrl}" target="_blank" style="color:#9EC5FF;font-weight:600;text-decoration:underline dotted;" title="Open in YMS Yard Management — search for ${ymsSearchTerm}">${t.trailerNum}</a>`
                : t.trailerNum;
            // Map Location column: map icon linking to Relay Track & Trace for ARRIVAL_SCHEDULED, checkmark for in-yard
            const trackUrl = `https://track.relay.amazon.dev/#search=${encodeURIComponent(t.trailerNum)}`;
            let mapLocationCell;
            if (isScheduled) {
                mapLocationCell = `<a href="${trackUrl}" target="_blank" title="Track ${t.trailerNum} on Relay — view live location" style="font-size:1.4em;text-decoration:none;">🗺️</a>`;
            } else {
                mapLocationCell = `<span title="Trailer is on site" style="font-size:1.3em;">✅</span>`;
            }
            return `<tr>
            <td>${vridCell}</td><td style="text-align:center;width:20px;padding:2px;">${mapLocationCell}</td>
            <td class="${statusClass(t.apptStatus)}">${t.apptStatus}</td>
            <td>${t.trailerLocation}</td>
            <td>${t.loadConfig}</td><td>${t.flType}</td>
            <td class="${scoreClass(t.priorityScore)}">${t.priorityScore}</td>
            <td>${t.source}</td><td>${t.arrivalTime}</td>
            <td style="text-align:right;color:#e0e0e0">${t.singleASINPallets}</td>
            <td style="text-align:right;color:#e0e0e0">${t.palletizedSACases}</td>
            <td style="text-align:right;color:#e0e0e0">${t.mixedASINPallets}</td>
            <td style="text-align:right;color:#e0e0e0">${t.flCases}</td>
            <td style="text-align:right;color:#ffffff;font-weight:bold">${isInYard && aftMap[t.trailerNum] ? aftMap[t.trailerNum].cases.toLocaleString() : t.totalCartons}</td>
            <td style="text-align:right;color:#ffffff;font-weight:bold">${isInYard && aftMap[t.trailerNum] ? aftMap[t.trailerNum].items.toLocaleString() : t.totalUnits}</td>
            <td style="text-align:right;color:#e0e0e0">${(() => {
                const cases = isInYard && aftMap[t.trailerNum] ? aftMap[t.trailerNum].cases : parseInt((t.totalCartons||'0').replace(/,/g,''),10)||0;
                const units = isInYard && aftMap[t.trailerNum] ? aftMap[t.trailerNum].items : parseInt((t.totalUnits||'0').replace(/,/g,''),10)||0;
                return cases > 0 ? (units / cases).toFixed(2) : '—';
            })()}</td>
        </tr>`;
        }).join('');
        return `<div class="trailer-wrap"><table class="trailer-tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
    }
    function sum(trailers, field) {
        return trailers.reduce((a, t) => a + (parseInt((t[field]||'0').replace(/,/g,''),10)||0), 0).toLocaleString();
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ═══ AI MODULE: Anomaly Detection + Smart Prioritization ════════════════
    // ═══════════════════════════════════════════════════════════════════════════

    const AI_HISTORY_KEY_PREFIX = 'ai_history_';
    const AI_MAX_HISTORY = 50; // Keep last 50 data points per FC

    // ─── Store a snapshot of current metrics for trend analysis ──────────────
    function recordMetricSnapshot(fc, metrics) {
        const key = AI_HISTORY_KEY_PREFIX + fc;
        let history = [];
        try { history = JSON.parse(GM_getValue(key, '[]')); } catch(e) { history = []; }
        history.push({ ...metrics, ts: Date.now() });
        // Keep only last N entries
        if (history.length > AI_MAX_HISTORY) history = history.slice(-AI_MAX_HISTORY);
        GM_setValue(key, JSON.stringify(history));
        return history;
    }

    function getMetricHistory(fc) {
        const key = AI_HISTORY_KEY_PREFIX + fc;
        try { return JSON.parse(GM_getValue(key, '[]')); } catch(e) { return []; }
    }

    // ─── Statistical helpers ────────────────────────────────────────────────
    function mean(arr) { return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length; }
    function stdDev(arr) {
        if (arr.length < 2) return 0;
        const m = mean(arr);
        return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / (arr.length - 1));
    }

    // ─── Anomaly Detection Engine ───────────────────────────────────────────
    function detectAnomalies(fc, currentMetrics) {
        const history = getMetricHistory(fc);
        const alerts = [];

        if (history.length < 5) {
            // Not enough data yet
            return [{ type: 'info', icon: '📊', msg: `Building baseline… (${history.length}/5 snapshots collected)` }];
        }

        // Pending cases growth rate — is it accelerating?
        if (currentMetrics.pendingCases > 0 && history.length >= 3) {
            const recentPending = history.slice(-5).map(h => h.pendingCases).filter(v => v > 0);
            if (recentPending.length >= 2) {
                const prevAvg = mean(recentPending);
                const growthPct = ((currentMetrics.pendingCases - prevAvg) / prevAvg * 100).toFixed(0);
                if (growthPct > 50) {
                    alerts.push({ type: 'critical', icon: '🔴', msg: `Pending cases spiked ${growthPct}% (${currentMetrics.pendingCases.toLocaleString()} vs recent avg ${Math.round(prevAvg).toLocaleString()}) — inbound outpacing stow capacity` });
                } else if (growthPct < -30) {
                    alerts.push({ type: 'good', icon: '✅', msg: `Pending cases down ${Math.abs(growthPct)}% — clearing backlog well` });
                }
            }
        }

        // KIPS queue alert
        if (currentMetrics.kipsCount > 5) {
            alerts.push({ type: 'warning', icon: '🚛', msg: `${currentMetrics.kipsCount} trailers queued in KIPS — yard may be backed up` });
        }

        if (alerts.length === 0) {
            alerts.push({ type: 'good', icon: '✅', msg: 'All metrics within normal range' });
        }

        return alerts;
    }

    // ─── Smart Trailer Prioritization ───────────────────────────────────────
    function scoreTrailers(trailers, aftPerTrailer) {
        const now = new Date();
        const pureCase = [];    // Floor loaded / pure case trailers
        const palletized = [];  // Palletized trailers
        const sapTrailers = []; // Single ASIN Pallet trailers (high indirect labor impact)
        const longestInYard = []; // All trailers sorted by time in yard

        for (const t of trailers) {
            if (t.apptStatus !== 'ARRIVED' && t.apptStatus !== 'CHECKED_IN') continue;

            // Get case count
            const aftData = aftPerTrailer ? aftPerTrailer[t.trailerNum] : null;
            const cases = aftData ? aftData.cases : parseInt((t.totalCartons||'0').replace(/,/g,''),10) || 0;

            // Calculate time in yard
            let hoursInYard = 0;
            if (t.arrivalTime) {
                const arrival = parseArrivalTime(t.arrivalTime);
                if (arrival) hoursInYard = (now - arrival) / (1000 * 60 * 60);
            }

            // Determine load type
            const loadConfig = (t.loadConfig || '').toUpperCase();
            const isPureCase = loadConfig.includes('FLOOR') || loadConfig.includes('CASE');
            const isPalletized = loadConfig.includes('PALLET');

            // Check for SAP (Single ASIN Pallets) — only significant if 2+ SAP with 100+ combined cases
            const sapCount = parseInt((t.singleASINPallets||'0').replace(/,/g,''), 10) || 0;
            const hasSAP = sapCount >= 2 && cases >= 100;

            // Build trailer entry
            const entry = {
                trailer: t,
                cases,
                hoursInYard: hoursInYard,
                sapCount,
                loadType: isPureCase ? 'Pure Case' : isPalletized ? 'Palletized' : 'Other',
                reasons: [],
            };

            // Classify volume label for pure case (500-1800 range)
            if (isPureCase) {
                if (cases >= 1500) entry.reasons.push(`${cases.toLocaleString()} cases (heavy)`);
                else if (cases >= 1000) entry.reasons.push(`${cases.toLocaleString()} cases (medium-heavy)`);
                else if (cases >= 500) entry.reasons.push(`${cases.toLocaleString()} cases (standard)`);
                else if (cases > 0) entry.reasons.push(`${cases.toLocaleString()} cases (light)`);
                pureCase.push(entry);
            } else if (isPalletized) {
                if (cases >= 1500) entry.reasons.push(`${cases.toLocaleString()} cases (heavy)`);
                else if (cases >= 1000) entry.reasons.push(`${cases.toLocaleString()} cases (medium)`);
                else if (cases > 0) entry.reasons.push(`${cases.toLocaleString()} cases`);
                palletized.push(entry);
            } else {
                // Unknown/other type — put with palletized
                if (cases > 0) entry.reasons.push(`${cases.toLocaleString()} cases`);
                palletized.push(entry);
            }

            // SAP tracking (can overlap with palletized)
            if (hasSAP) {
                entry.reasons.push(`${sapCount} SA Pallets ⭐`);
                sapTrailers.push(entry);
            }

            // Time in yard tracking
            if (hoursInYard >= 2) {
                longestInYard.push(entry);
            }
        }

        // Sort each group by case volume descending (highest first)
        pureCase.sort((a, b) => b.cases - a.cases);
        palletized.sort((a, b) => b.cases - a.cases);
        sapTrailers.sort((a, b) => b.cases - a.cases);
        longestInYard.sort((a, b) => b.hoursInYard - a.hoursInYard);

        return { pureCase, palletized, sapTrailers, longestInYard };
    }

    function parseArrivalTime(arrStr) {
        if (!arrStr) return null;
        try {
            // Try ISO format or common date formats
            const d = new Date(arrStr);
            if (!isNaN(d.getTime())) return d;
            // Try "MM/DD HH:MM" or "HH:MM" format
            const timeMatch = arrStr.match(/(\d{1,2}):(\d{2})/);
            if (timeMatch) {
                const now = new Date();
                const h = parseInt(timeMatch[1], 10);
                const m = parseInt(timeMatch[2], 10);
                const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
                // If time is in future, assume it was yesterday
                if (d > now) d.setDate(d.getDate() - 1);
                return d;
            }
        } catch(e) {}
        return null;
    }

    // ─── Build Operations Brief Panel HTML ─────────────────────────────────
    function buildAIInsightsHTML(alerts, priorityData, fc, metrics) {
        const { pureCase, palletized, sapTrailers, longestInYard } = priorityData;
        const siteName = (fc || 'Unknown').toUpperCase();
        metrics = metrics || {};

        // ─── Natural Language Summary ───────────────────────────────────────
        const totalInYard = pureCase.length + palletized.length;
        const totalCases = [...pureCase, ...palletized].reduce((s, e) => s + e.cases, 0);
        const primaryType = pureCase.length > 0 ? 'floor-load' : 'palletized';
        const stowers = metrics.activeStowers || 0;
        const stowRate = metrics.stowRate || 0;
        const casesPerHour = stowers > 0 && stowRate > 0 ? stowRate * stowers : 0;
        const hoursToClear = casesPerHour > 0 ? (totalCases / casesPerHour) : 0;

        let summaryText = '';
        if (totalInYard === 0) {
            summaryText = `No trailers currently in yard at ${siteName}. Standing by.`;
        } else {
            summaryText = `${totalInYard} trailers in yard with ${totalCases.toLocaleString()} total cases. `;
            if (pureCase.length > 0 && palletized.length > 0) {
                summaryText += `Workload is mixed — ${pureCase.length} pure case and ${palletized.length} palletized. Recommend clearing floor-load first for faster throughput. `;
            } else if (pureCase.length > 0) {
                summaryText += `Workload is entirely floor-load. Process by volume — highest first. `;
            } else {
                summaryText += `Workload is all palletized. Process by volume — highest first. `;
            }
            if (sapTrailers.length > 0) {
                const totalSAP = sapTrailers.reduce((s, e) => s + e.sapCount, 0);
                summaryText += `${sapTrailers.length} trailer${sapTrailers.length > 1 ? 's' : ''} with ${totalSAP} SA Pallets available — stowing these improves CPLH and indirect labor budget. `;
            }
            if (hoursToClear > 0) {
                summaryText += `At current pace (${stowers} stowers, ${stowRate} JPH), estimated ${hoursToClear.toFixed(1)}h to clear all pending.`;
            }
        }

        // ─── Build priority-scored trailer list with reasoning ───────────────
        function buildPriorityList(items, label, order) {
            if (items.length === 0) return '';
            const rows = items.map((item, idx) => {
                // Priority score: 100-point scale based on factors
                let score = 0;
                const reasons = [];

                // Volume factor (max 40 pts)
                if (item.cases >= 1500) { score += 40; reasons.push('🔥 Heavy load'); }
                else if (item.cases >= 1000) { score += 30; reasons.push('📦 High volume'); }
                else if (item.cases >= 500) { score += 20; reasons.push('📦 Standard volume'); }
                else { score += 10; reasons.push('📦 Light load'); }

                // SAP bonus (max 20 pts)
                if (item.sapCount >= 2) { score += 20; reasons.push('⭐ SAP — improves CPLH'); }

                // Time in yard factor (max 25 pts)
                if (item.hoursInYard >= 48) { score += 25; reasons.push('⏰ Critical aging (48h+)'); }
                else if (item.hoursInYard >= 24) { score += 20; reasons.push('⏰ Aging (24h+)'); }
                else if (item.hoursInYard >= 8) { score += 15; reasons.push('⏰ Sitting 8h+'); }
                else if (item.hoursInYard >= 4) { score += 10; reasons.push('⏰ 4h+ in yard'); }

                // Load type bonus (max 15 pts)
                if (item.loadType === 'Pure Case') { score += 15; reasons.push('🚛 Floor load — fast to process'); }
                else { score += 5; }

                // Cap at 100
                score = Math.min(score, 100);

                const scoreColor = score >= 80 ? '#EB5757' : score >= 60 ? '#F2994A' : score >= 40 ? '#eab308' : '#C3CAD7';
                const typeIcon = item.loadType === 'Pure Case' ? '🚛' : item.sapCount >= 2 ? '⭐' : '📦';

                // Estimated processing time
                const estHours = casesPerHour > 0 ? (item.cases / casesPerHour).toFixed(1) : '—';

                return `<tr>
                    <td style="padding:12px;color:#C3CAD7;font-weight:bold;font-size:16px;text-align:center;width:40px;">#${idx + 1}</td>
                    <td style="padding:12px;">
                        <a href="https://trans-logistics.amazon.com/yms/shipclerk#/yard?nodeId=${encodeURIComponent(fc)}&searchQuery=${encodeURIComponent(item.trailer.trailerNum)}" target="_blank" style="color:#9EC5FF;font-weight:bold;font-size:15px;text-decoration:underline dotted;" title="Open in YMS — search for ${item.trailer.trailerNum}">${typeIcon} ${item.trailer.trailerNum}</a>
                        <div style="color:#888;font-size:12px;margin-top:2px;">${item.loadType} · ${item.trailer.trailerLocation || 'Unknown'} · ${item.cases.toLocaleString()} cases</div>
                    </td>
                    <td style="padding:12px;font-size:13px;color:#C3CAD7;line-height:1.6;">${reasons.map(r => `<div>${r}</div>`).join('')}</td>
                    <td style="padding:12px;text-align:right;color:#e0e0e0;font-size:13px;">${estHours !== '—' ? estHours + 'h' : '—'}</td>
                </tr>`;
            }).join('');

            return `
                <div style="margin-top:16px;">
                    <div style="font-weight:bold;font-size:16px;color:#F2F5FA;margin-bottom:10px;padding:8px 12px;background:#364D82;border-radius:6px;">${order} ${label}</div>
                    <table style="width:100%;border-collapse:collapse;">
                        <thead><tr style="border-bottom:1px solid #3a3d4e;">
                            <th style="padding:6px 12px;text-align:center;color:#888;font-size:11px;text-transform:uppercase;">#</th>
                            <th style="padding:6px 12px;text-align:left;color:#888;font-size:11px;text-transform:uppercase;">Trailer</th>
                            <th style="padding:6px 12px;text-align:left;color:#888;font-size:11px;text-transform:uppercase;">Why</th>
                            <th style="padding:6px 12px;text-align:right;color:#888;font-size:11px;text-transform:uppercase;">Est. Time</th>
                        </tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                </div>`;
        }

        const pureCaseHTML = buildPriorityList(pureCase, 'Pure Case / Floor Load', '① Process First —');
        const palletLabel = pureCase.length > 0 ? '② Process Second —' : '① Process First —';
        const palletizedHTML = buildPriorityList(palletized, 'Palletized', palletLabel);

        // ─── Impact Estimate ────────────────────────────────────────────────
        let impactHTML = '';
        if (casesPerHour > 0 && pureCase.length > 0) {
            // Pure case is ~30% faster to process than palletized
            const pureCaseCases = pureCase.reduce((s, e) => s + e.cases, 0);
            const palletCases = palletized.reduce((s, e) => s + e.cases, 0);
            const timeIfPureCaseFirst = (pureCaseCases / (casesPerHour * 1.3)) + (palletCases / casesPerHour);
            const timeIfPalletFirst = (palletCases / casesPerHour) + (pureCaseCases / (casesPerHour * 1.3));
            const timeSaved = (timeIfPalletFirst - timeIfPureCaseFirst);

            if (timeSaved > 0.1) {
                impactHTML = `
                    <div style="margin-top:16px;padding:12px 14px;background:#1a3a2a;border:1px solid #27AE60;border-radius:6px;">
                        <div style="font-weight:bold;font-size:14px;color:#27AE60;margin-bottom:6px;">⚡ Estimated Impact if Followed</div>
                        <div style="display:flex;gap:24px;font-size:14px;color:#e0e0e0;">
                            <span><strong style="color:#fff;font-size:18px;">${timeSaved.toFixed(1)}h</strong> faster completion</span>
                            <span><strong style="color:#fff;font-size:18px;">+${(timeSaved * stowRate * 0.3).toFixed(0)}</strong> additional cases stowed</span>
                        </div>
                    </div>`;
            }
        }

        // ─── Aging Alerts ───────────────────────────────────────────────────
        let agingHTML = '';
        const criticalAging = longestInYard.filter(e => e.hoursInYard >= 24);
        if (criticalAging.length > 0) {
            const agingItems = criticalAging.slice(0, 3).map(e => {
                const icon = e.hoursInYard >= 48 ? '🔴' : '🟠';
                return `<div style="padding:6px 0;font-size:14px;color:#e0e0e0;">${icon} <strong>${e.trailer.trailerNum}</strong> — ${e.hoursInYard.toFixed(1)}h in yard · ${e.cases.toLocaleString()} cases · ${e.trailer.trailerLocation || ''}</div>`;
            }).join('');
            agingHTML = `
                <div style="margin-top:16px;padding:12px 14px;background:#3a2a1a;border:1px solid #F2994A;border-radius:6px;">
                    <div style="font-weight:bold;font-size:14px;color:#F2994A;margin-bottom:6px;">⚠️ Aging Trailers — Approaching SLA Risk</div>
                    ${agingItems}
                </div>`;
        }

        // ─── Health Indicator ────────────────────────────────────────────────
        let healthStatus = '🟢 Healthy';
        let healthColor = '#27AE60';
        const critCount = criticalAging.length;
        if (critCount >= 3 || (metrics.kipsCount || 0) > 8) {
            healthStatus = '🔴 High Risk';
            healthColor = '#EB5757';
        } else if (critCount >= 1 || (metrics.kipsCount || 0) > 5 || hoursToClear > 6) {
            healthStatus = '🟡 Moderate Risk';
            healthColor = '#F2994A';
        }

        // ─── Today's Focus ──────────────────────────────────────────────────
        let focusText = '';
        let focusBenefit = '';
        if (pureCase.length > 0) {
            focusText = 'Process Floor Loads First';
            if (casesPerHour > 0) {
                const boost = (pureCase.reduce((s, e) => s + e.cases, 0) * 0.3 / (totalCases || 1) * (stowRate * 0.02)).toFixed(1);
                focusBenefit = `+${boost} CPLH`;
            }
        } else if (sapTrailers.length > 0) {
            focusText = 'Prioritize SAP Trailers';
            focusBenefit = 'Improves indirect labor budget';
        } else if (palletized.length > 0) {
            focusText = 'Process by Volume — Highest First';
            focusBenefit = 'Maximize throughput';
        } else {
            focusText = 'No trailers pending';
        }

        return `
            <div style="background:#20232F;padding:18px;min-height:400px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                    <span style="font-weight:bold;font-size:22px;color:#F2F5FA;">🤖 Inbound Operations Copilot — ${siteName}</span>
                    <div style="text-align:right;">
                        <div style="font-size:12px;color:#888;">Updated ${new Date().toLocaleTimeString()}</div>
                    </div>
                </div>
                <div style="padding:12px 16px;background:#2A2D3E;border-radius:8px;margin-bottom:12px;display:flex;justify-content:space-between;align-items:center;border-left:4px solid #4A72C9;">
                    <div>
                        <div style="font-size:12px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Today's Focus</div>
                        <div style="font-size:18px;font-weight:bold;color:#F2F5FA;margin-top:2px;">${focusText}</div>
                    </div>
                    ${focusBenefit ? '' : ''}
                </div>
                <div style="padding:14px 16px;background:#2A2D3E;border-radius:8px;margin-bottom:14px;font-size:15px;color:#C3CAD7;line-height:1.7;border-left:4px solid #4A72C9;">
                    ${summaryText}
                </div>
                ${impactHTML}
                ${agingHTML}
                ${pureCaseHTML}
                ${palletizedHTML}
            </div>`;
    }

    async function render(container) {
        const { rows } = extractSummary();
        const trailers = extractTrailers();
        const meta = getMeta();
        const fc = window.location.pathname.split('/').pop();
        const arrived = trailers.filter(t => t.apptStatus === 'ARRIVED' || t.apptStatus === 'CHECKED_IN');
        const scheduled = trailers.filter(t => t.apptStatus === 'ARRIVAL_SCHEDULED');

        const inYardData = {
            '# of Trailers': String(arrived.length),
            'Total Cases': '⏳ Loading from AFT…',
            'Total Units': '⏳ Loading from AFT…',
            'Single ASIN Pallets': sum(arrived, 'singleASINPallets'),
            'Mixed ASIN Pallets': sum(arrived, 'mixedASINPallets'),
            'FL Cases': sum(arrived, 'flCases'),
            '% Case': (rows['IN YARD']||{})['% Case'] || 'N/A',
            '% SA Pallet': (rows['IN YARD']||{})['% SA Pallet'] || 'N/A',
            '% Floor Loaded Trailer': (rows['IN YARD']||{})['% Floor Loaded Trailer'] || 'N/A',
            '% Palletized Trailer': (rows['IN YARD']||{})['% Palletized Trailer'] || 'N/A',
            'Case Density': '⏳ Loading from AFT…',
        };
        const base = rows['TOMORROW - FORECAST'] || {};
        const tmrwData = {
            '# of Trailers': String(scheduled.length),
            'Total Cases': sum(scheduled, 'totalCartons'),
            'Total Units': sum(scheduled, 'totalUnits'),
            'Single ASIN Pallets': sum(scheduled, 'singleASINPallets'),
            'Mixed ASIN Pallets': sum(scheduled, 'mixedASINPallets'),
            'FL Cases': sum(scheduled, 'flCases'),
            '% Case': base['% Case'] || 'N/A',
            '% SA Pallet': base['% SA Pallet'] || 'N/A',
            '% Floor Loaded Trailer': base['% Floor Loaded Trailer'] || 'N/A',
            '% Palletized Trailer': base['% Palletized Trailer'] || 'N/A',
            'Case Density': base['Case Density'] || 'N/A',
        };
        const cardLabels = Object.keys(inYardData);

        // Build SAP arrival callout for scheduled trailers
        const sapTrailers = scheduled
            .filter(t => parseInt((t.singleASINPallets||'0').replace(/,/g,''), 10) > 0)
            .sort((a, b) => (a.arrivalTime || '').localeCompare(b.arrivalTime || ''));
        const sapTotal = sapTrailers.reduce((s, t) => s + (parseInt((t.singleASINPallets||'0').replace(/,/g,''), 10)||0), 0);
        let sapBanner = '';
        if (sapTrailers.length > 0) {
            const sapRows = sapTrailers.map(t => {
                return `<tr><td style="padding:4px 10px;">${t.trailerNum}</td><td style="padding:4px 10px;">${t.source}</td><td style="padding:4px 10px;text-align:right;color:#89dceb;font-weight:bold;">${t.singleASINPallets}</td><td style="padding:4px 10px;">${t.arrivalTime || 'TBD'}</td></tr>`;
            }).join('');
            sapBanner = `<div style="background:#313244;border:1px solid #89dceb;border-radius:6px;padding:12px 14px;margin-bottom:10px;">
                <div style="font-weight:bold;font-size:18px;color:#89dceb;margin-bottom:6px;">📦 Incoming SA Pallets — ${sapTotal.toLocaleString()} SAP across ${sapTrailers.length} trailer${sapTrailers.length > 1 ? 's' : ''}</div>
                <table style="width:100%;border-collapse:collapse;font-size:16px;color:#cdd6f4;">
                    <thead><tr style="color:#a6adc8;"><th style="padding:4px 10px;text-align:left;">Trailer</th><th style="padding:4px 10px;text-align:left;">Source</th><th style="padding:4px 10px;text-align:right;">SA Pallets</th><th style="padding:4px 10px;text-align:left;">ETA</th></tr></thead>
                    <tbody>${sapRows}</tbody>
                </table>
            </div>`;
        }

        container.innerHTML = `
        <div id="oc-header">
             <div class="oc-header-center">
                <div class="title">Inbound Operations Copilot — ${fc} &nbsp; <span id="oc-backlog" style="color:#ffffff;font-size:18px;font-weight:bold;">⏳ Backlog</span></div>
                <div class="meta">${meta.fc} &nbsp;|&nbsp; ${meta.tz} &nbsp;|&nbsp; Updated: ${meta.refresh}</div>
                <div id="oc-stow-line" style="margin-top:6px;">
                    <div style="font-size:18px;font-weight:bold;color:#ffffff;padding:6px 12px;background:#1e2233;border:1px solid #3a4060;border-radius:6px;display:inline-block;"><span style="color:#888;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;margin-right:8px;">Performance</span><span id="oc-active-stowers" style="color:#ffffff;">Stowers: ⏳</span> <span style="color:#555;"> • </span> <span id="oc-ib-cplh" style="color:#ffffff;"></span><span id="oc-total-stows" style="color:#ffffff;">Total Stows: ⏳</span> <span style="color:#555;"> • </span> <span id="oc-stow-rate" style="color:#ffffff;">Stow Rate: ⏳ JPH</span></div>
                    <div style="font-size:15px;margin-top:6px;padding:6px 12px;background:#1e2233;border:1px solid #3a4060;border-radius:6px;display:inline-block;"><span id="oc-lc-display" style="color:#C3CAD7;">Learning Curve Mix: ⏳</span></div>
                </div>
            </div>
            <div class="oc-btns">
                <button class="oc-recs-btn" id="oc-recs-toggle" title="Open Inbound Operations Copilot — AI-powered processing priorities and impact estimates">🤖 Copilot</button>
                <button class="oc-btn refresh" id="oc-refresh" title="Reload the page to fetch fresh data">↻ Refresh</button>
                <button class="oc-btn" id="oc-toggle" title="Collapse or expand the dashboard body">▲ Collapse</button>
            </div>
            <div class="oc-left-btns">
                <a class="oc-kips-btn" id="oc-kips-link" href="https://maple-syrup.corp.amazon.com/${fc.toUpperCase()}/kips/thermometer" target="_blank" title="Open Maple Syrup KIPS thermometer — view trailers queued in KIPS">🚛 Trailers in KIPS = <span id="oc-kips-count">⏳</span></a>
                <button class="oc-stowmap-btn" id="oc-stowmap-btn" title="Generate a stow map — opens Stowmap, downloads bin data, then navigates to QuickSight heatmap">🗺️ Generate Stow Map</button>
            </div>
        </div>
        <div class="oc-body">
            <div class="summary-grid">
                ${buildSummaryCard('IN YARD', 'yard', inYardData, cardLabels)}
                ${buildSummaryCard('TOMORROW — FORECAST', 'tmrw', tmrwData, cardLabels)}
            </div>
            ${sapBanner}
            <div id="oc-longest-yard"></div>
            <div class="trailer-section-header" id="oc-trailer-header">
                <span>Trailer Detail (${trailers.length} trailers)</span>
                <button class="trailer-toggle-btn" id="oc-trailer-toggle">▲ Collapse</button>
            </div>
            <div class="trailer-section-body" id="oc-trailer-body">
                ${buildTrailerTable(trailers, fc)}
            </div>
        </div>
        <div id="oc-recs-overlay" class="oc-recs-overlay" style="display:none;"></div>`;

        document.getElementById('oc-toggle').onclick = () => {
            const c = container.classList.toggle('collapsed');
            document.getElementById('oc-toggle').textContent = c ? '▼ Expand' : '▲ Collapse';
        };

        // Recommendations toggle — overlays on the body content
        document.getElementById('oc-recs-toggle').onclick = () => {
            const overlay = document.getElementById('oc-recs-overlay');
            const body = container.querySelector('.oc-body');
            const btn = document.getElementById('oc-recs-toggle');
            if (overlay.style.display === 'none') {
                // Show recommendations, hide body
                overlay.style.display = 'block';
                if (body) body.style.display = 'none';
                btn.textContent = '← Back to Dashboard';
                btn.classList.add('active');
            } else {
                // Hide recommendations, show body
                overlay.style.display = 'none';
                if (body) body.style.display = '';
                btn.textContent = '🤖 Copilot';
                btn.classList.remove('active');
            }
        };

        document.getElementById('oc-trailer-header').onclick = () => {
            const b = document.getElementById('oc-trailer-body');
            const btn = document.getElementById('oc-trailer-toggle');
            const h = b.classList.toggle('hidden');
            btn.textContent = h ? '▼ Expand' : '▲ Collapse';
        };
        document.getElementById('oc-refresh').onclick = () => location.reload();

        // ─── Stow Map Generator Button ──────────────────────────────────────
        document.getElementById('oc-stowmap-btn').onclick = (e) => {
            e.preventDefault();
            const stowmapUrl = `https://stowmap-na.amazon.com/stowmap/loadFCAreaMap.htm?warehouseId=${fc.toUpperCase()}`;
            // Store FC and target QuickSight URL for the stowmap automation script
            GM_setValue('stowmap_fc', fc.toUpperCase());
            GM_setValue('stowmap_pending', 'true');
            // Use a dynamically created link click to avoid popup blocker
            const a = document.createElement('a');
            a.href = stowmapUrl;
            a.target = '_blank';
            a.rel = 'noopener';
            document.body.appendChild(a);
            a.click();
            a.remove();
        };

        // Sort columns on click (generic handler for all sortable columns)
        function attachSortHandlers(trailersRef, fcRef, aftRef) {
            document.querySelectorAll('#oc-trailer-body .trailer-tbl .oc-sortable, .trailer-wrap .oc-sortable').forEach(th => {
                th.onclick = (e) => {
                    e.stopPropagation();
                    const field = th.dataset.field;
                    trailerSortField = trailerSortField === field ? null : field;
                    const body = document.getElementById('oc-trailer-body');
                    if (body) {
                        body.innerHTML = buildTrailerTable(trailersRef, fcRef, aftRef);
                        attachSortHandlers(trailersRef, fcRef, aftRef);
                    }
                };
            });
        }
        attachSortHandlers(trailers, fc, undefined);

        // ─── Browser Notifications for Newly Arrived Trailers ───────────────
        try {
            const notifKey = 'notified_arrivals_' + fc;
            let previouslyNotified = [];
            try { previouslyNotified = JSON.parse(GM_getValue(notifKey, '[]')); } catch(e) { previouslyNotified = []; }

            // Find trailers with ARRIVED status (just arrived, not yet checked in)
            const justArrived = trailers.filter(t => t.apptStatus === 'ARRIVED');
            const newArrivals = justArrived.filter(t => !previouslyNotified.includes(t.trailerNum));

            if (newArrivals.length > 0) {
                // Send browser notification for each new arrival
                for (const t of newArrivals) {
                    const cases = parseInt((t.totalCartons||'0').replace(/,/g,''),10) || 0;
                    const sapCount = parseInt((t.singleASINPallets||'0').replace(/,/g,''), 10) || 0;
                    const loadType = (t.loadConfig||'').toUpperCase().includes('FLOOR') ? 'Pure Case' :
                                     (t.loadConfig||'').toUpperCase().includes('PALLET') ? 'Palletized' : t.loadConfig || 'Unknown';
                    const sapNote = sapCount > 0 ? ` | ${sapCount} SA Pallets ⭐` : '';

                    GM_notification({
                        title: `🚛 New Trailer Arrived — ${fc.toUpperCase()}`,
                        text: `${t.trailerNum} from ${t.source || 'Unknown'}\n${loadType} | ${cases.toLocaleString()} cases${sapNote}\nLocation: ${t.trailerLocation || 'TBD'}`,
                        timeout: 10000,
                        onclick: () => { window.focus(); }
                    });
                    console.log(`[OculusDash] 🔔 Notification: New arrival ${t.trailerNum} (${loadType}, ${cases} cases)`);
                }

                // Update the notified list (keep current ARRIVED + CHECKED_IN to avoid re-notifying)
                const allInYardVrids = trailers
                    .filter(t => t.apptStatus === 'ARRIVED' || t.apptStatus === 'CHECKED_IN')
                    .map(t => t.trailerNum);
                GM_setValue(notifKey, JSON.stringify(allInYardVrids));
            } else {
                // Still update the list to prune departed trailers
                const allInYardVrids = trailers
                    .filter(t => t.apptStatus === 'ARRIVED' || t.apptStatus === 'CHECKED_IN')
                    .map(t => t.trailerNum);
                GM_setValue(notifKey, JSON.stringify(allInYardVrids));
            }
        } catch (err) {
            console.warn('[OculusDash] Notification error:', err);
        }

        // ─── Async: Update IN YARD card with AFT data ───────────────────────
        const inYardVrids = arrived.map(t => t.trailerNum);
        try {
            const aft = await fetchAFTData(inYardVrids);
            const card = container.querySelector('.summary-card');
            if (!card) return;
            const cRows = card.querySelectorAll('.card-table tr');
            const upd = (label, val, tip) => {
                for (const r of cRows) {
                    const lc = r.querySelector('td:first-child'), vc = r.querySelector('td:last-child');
                    if (lc && vc && lc.textContent.trim() === label) { vc.textContent = val; if (tip) vc.title = tip; }
                }
            };
            if (aft && aft.totalCases !== undefined) {
                const aftUrl = getAFTUrl(fc);
                // If AFT returned 0 cases, fall back to Oculus totalCartons from arrived trailers
                const effectiveCases = aft.totalCases > 0 ? aft.totalCases : parseInt(sum(arrived, 'totalCartons').replace(/,/g,''),10) || 0;
                // Total Units always comes from Oculus (AFT "Items" is a different metric — individual items per case)
                const effectiveItems = parseInt(sum(arrived, 'totalUnits').replace(/,/g,''),10) || 0;
                const tip = `AFT: ${aft.trailerCount} trailers, ${aft.count} parsed${aft.totalCases === 0 ? ' (using Oculus data)' : ''}`;
                const cd = effectiveCases > 0 ? (effectiveItems / effectiveCases).toFixed(2) : 'N/A';
                for (const r of cRows) {
                    const lc = r.querySelector('td:first-child'), vc = r.querySelector('td:last-child');
                    if (lc && vc && lc.textContent.trim() === 'Total Cases') {
                        vc.innerHTML = `<a href="${aftUrl}" target="_blank" style="color:#a6e3a1;text-decoration:underline;font-weight:bold;" title="Open AFT Transshipment Hub — view inbound transfer details">${effectiveCases.toLocaleString()}</a>`;
                        if (tip) vc.title = tip;
                    }
                }
                upd('Total Units', effectiveItems.toLocaleString(), tip);
                upd('Case Density', cd, `${effectiveItems.toLocaleString()} items / ${effectiveCases.toLocaleString()} cases`);
            } else {
                const aftUrl = getAFTUrl(fc);
                for (const l of ['Total Cases','Total Units','Case Density']) {
                    for (const r of cRows) {
                        const lc = r.querySelector('td:first-child'), vc = r.querySelector('td:last-child');
                        if (lc && vc && lc.textContent.trim() === l) {
                            if (l === 'Total Cases') {
                                vc.innerHTML = `<a href="${aftUrl}" target="_blank" style="color:#f38ba8;text-decoration:underline;" title="Click to open AFT, then refresh this page">⚠ Open AFT →</a>`;
                            } else {
                                vc.innerHTML = `<span style="color:#f38ba8;">⚠ N/A</span>`;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[OculusDash] AFT error:', err);
        }

        // ─── Re-render trailer table with AFT per-trailer data ──────────────
        try {
            const aft = await fetchAFTData(inYardVrids);
            const aftPerTrailer = (aft && aft.perTrailer) || {};
            if (Object.keys(aftPerTrailer).length > 0) {
                console.log('[OculusDash] Re-rendering trailer table with', Object.keys(aftPerTrailer).length, 'per-trailer AFT entries');
                const body = document.getElementById('oc-trailer-body');
                if (body) {
                    body.innerHTML = buildTrailerTable(trailers, fc, aftPerTrailer);
                    // Re-attach sort handlers
                    attachSortHandlers(trailers, fc, aftPerTrailer);
                }
            }
        } catch (err) {
            console.error('[OculusDash] AFT per-trailer re-render error:', err);
        }

        // ─── Longest in Yard (top 5) — inline on main dashboard ─────────────
        try {
            const now = new Date();
            const yardEntries = [];
            for (const t of arrived) {
                let hoursInYard = 0;
                if (t.arrivalTime) {
                    const arrival = parseArrivalTime(t.arrivalTime);
                    if (arrival) hoursInYard = (now - arrival) / (1000 * 60 * 60);
                }
                if (hoursInYard >= 2) {
                    const loadConfig = (t.loadConfig || '').toUpperCase();
                    const loadType = loadConfig.includes('FLOOR') ? 'Pure Case' : loadConfig.includes('PALLET') ? 'Palletized' : t.loadConfig || 'Other';
                    const cases = parseInt((t.totalCartons||'0').replace(/,/g,''),10) || 0;
                    yardEntries.push({ trailer: t, hoursInYard, loadType, cases });
                }
            }
            yardEntries.sort((a, b) => b.hoursInYard - a.hoursInYard);
            const top5 = yardEntries.slice(0, 5);

            const yardContainer = document.getElementById('oc-longest-yard');
            if (yardContainer && top5.length > 0) {
                const yardRows = top5.map(e => {
                    // Threshold-based: 48h+ red, 24h+ orange, 8h+ yellow, else normal
                    const timeColor = e.hoursInYard >= 48 ? '#ef4444' : e.hoursInYard >= 24 ? '#f97316' : e.hoursInYard >= 8 ? '#eab308' : '#e0e0e0';
                    const indicator = e.hoursInYard >= 48 ? ' 🔴' : e.hoursInYard >= 24 ? ' 🟠' : e.hoursInYard >= 8 ? ' 🟡' : '';
                    return `<tr>
                        <td style="padding:12px 12px;color:#ffffff;font-weight:bold;font-size:14px;">${e.trailer.trailerNum}</td>
                        <td style="padding:12px 12px;color:${timeColor};font-weight:bold;font-size:16px;">${e.hoursInYard.toFixed(1)}h${indicator}</td>
                        <td style="padding:12px 12px;color:#C5CAD6;font-size:13px;">${e.loadType}</td>
                        <td style="padding:12px 12px;color:#ffffff;font-size:13px;font-weight:bold;">${e.cases.toLocaleString()}</td>
                        <td style="padding:12px 12px;color:#888;font-size:13px;">${e.trailer.trailerLocation || ''}</td>
                    </tr>`;
                }).join('');
                yardContainer.innerHTML = `
                    <div style="background:#262938;border-radius:8px;padding:16px;margin-bottom:14px;">
                        <div style="font-weight:bold;font-size:16px;color:#f97316;margin-bottom:10px;">🕐 Longest in Yard — Needs Processing</div>
                        <table style="width:100%;border-collapse:collapse;">
                            <thead><tr style="color:#888;">
                                <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Trailer</th>
                                <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Time</th>
                                <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Type</th>
                                <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Cases</th>
                                <th style="padding:8px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:0.3px;">Location</th>
                            </tr></thead>
                            <tbody>${yardRows}</tbody>
                        </table>
                    </div>`;
            }
        } catch (err) {
            console.error('[OculusDash] Longest in yard error:', err);
        }

        // ─── Fetch KIPS count ──────────────────────────────────────────────────
        fetchKipsCount(fc);

        // ─── Fetch Learning Curve from ADAPT ────────────────────────────────────
        fetchLearningCurve(fc);

        // ─── Fetch Stow Rate JPH and Inbound CPLH from FCLM ──────────────────
        try {
            const [result, palletResult, ibHours, activeStowers] = await Promise.all([fetchStowRate(fc), fetchTotalCases(fc), fetchInboundHours(fc), fetchActiveStowers(fc)]);
            const rateEl = document.getElementById('oc-stow-rate');
            const stowsEl = document.getElementById('oc-total-stows');
            const cplhEl = document.getElementById('oc-ib-cplh');
            const stowersEl = document.getElementById('oc-active-stowers');
            if (stowersEl) {
                if (activeStowers > 0) {
                    stowersEl.textContent = `Stowers: ${activeStowers}`;
                    stowersEl.style.color = '#89b4fa';
                } else {
                    stowersEl.textContent = 'Stowers: —';
                    stowersEl.style.color = '#a6adc8';
                }
            }
            if (rateEl) {
                if (result && result.jph) {
                    rateEl.innerHTML = `<a href="${result.url}" target="_blank" style="color:#89b4fa;text-decoration:underline dotted;" title="Open FCLM Function Rollup — view detailed stow metrics">Stow Rate: ${result.jph} JPH</a>`;
                } else {
                    rateEl.textContent = 'Stow Rate: — JPH';
                    rateEl.style.color = '#888888';
                }
            }
            if (stowsEl) {
                const caseTransferIn = (result && result.totalStows) || 0;
                const palletCases = (palletResult && palletResult.totalCases) || 0;
                const grandTotal = caseTransferIn + palletCases;
                // Calculate and display CPLH
                if (cplhEl && grandTotal > 0 && ibHours > 0) {
                    const ibCplh = (grandTotal / ibHours).toFixed(2);
                    cplhEl.innerHTML = `<span style="color:#89b4fa;">CPLH: ${ibCplh}</span> &nbsp;|&nbsp; `;
                }
                if (grandTotal > 0) {
                    const caseUrl = result ? result.url : '#';
                    const palletUrl = palletResult ? palletResult.url : '#';
                    stowsEl.innerHTML = `<span style="position:relative;display:inline-block;cursor:pointer;" id="oc-cases-hover">
                        <span style="color:#89b4fa;text-decoration:underline dotted;">Total Stows: ${grandTotal.toLocaleString()}</span>
                        <div id="oc-cases-dropdown" style="display:none;position:absolute;top:100%;left:0;background:#313244;border:1px solid #89b4fa;border-radius:6px;padding:6px 0;z-index:100;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,0.4);margin-top:0px;">
                            <a href="${caseUrl}" target="_blank" style="display:block;padding:6px 14px;color:#89b4fa;text-decoration:none;font-size:16px;" onmouseenter="this.style.background='#45475a'" onmouseleave="this.style.background=''">📦 Case Transfer In: ${caseTransferIn.toLocaleString()}</a>
                            <a href="${palletUrl}" target="_blank" style="display:block;padding:6px 14px;color:#89b4fa;text-decoration:none;font-size:16px;" onmouseenter="this.style.background='#45475a'" onmouseleave="this.style.background=''">🔲 Pallet Transfer In: ${palletCases.toLocaleString()}</a>
                        </div>
                    </span>`;
                    const hoverEl = document.getElementById('oc-cases-hover');
                    const dropdown = document.getElementById('oc-cases-dropdown');
                    if (hoverEl && dropdown) {
                        let hideTimeout = null;
                        hoverEl.onmouseenter = () => { clearTimeout(hideTimeout); dropdown.style.display = 'block'; };
                        hoverEl.onmouseleave = () => { hideTimeout = setTimeout(() => { dropdown.style.display = 'none'; }, 200); };
                    }
                } else {
                    stowsEl.textContent = 'Total Stows: —';
                    stowsEl.style.color = '#888888';
                }
            }
        } catch (err) {
            console.error('[OculusDash] Stow rate error:', err);
            const rateEl = document.getElementById('oc-stow-rate');
            const stowsEl = document.getElementById('oc-total-stows');
            if (rateEl) { rateEl.textContent = 'Stow Rate: — JPH'; rateEl.style.color = '#a6adc8'; }
            if (stowsEl) { stowsEl.textContent = 'Total Stows: —'; stowsEl.style.color = '#a6adc8'; }
        }

        // ─── Calculate Days of Backlog ──────────────────────────────────────
        try {
            const aft = await fetchAFTData(inYardVrids);
            // Use AFT cases if available, otherwise fall back to Oculus totalCartons
            let totalCases = aft && aft.totalCases ? aft.totalCases : 0;
            if (totalCases === 0) {
                totalCases = parseInt(sum(arrived, 'totalCartons').replace(/,/g,''),10) || 0;
            }
            const dailyJobs = await fetchDailyStowJobs(fc, 7);
            const nonZero = dailyJobs.filter(v => v > 0);
            const avgDaily = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
            const backlog = avgDaily > 0 ? (totalCases / avgDaily).toFixed(1) : '--';
            const el = document.getElementById('oc-backlog');
            if (el) {
                const color = backlog === '--' ? '#a6adc8' : parseFloat(backlog) > 3 ? '#f38ba8' : parseFloat(backlog) > 1.5 ? '#f9e2af' : '#a6e3a1';
                el.textContent = `📊 ${backlog} Days Backlog`;
                el.style.color = color;
                el.title = `Total Stows: ${totalCases.toLocaleString()} | Avg Daily Stow (7d, non-zero): ${Math.round(avgDaily).toLocaleString()}`;
            }
        } catch (err) {
            console.error('[OculusDash] Backlog calc error:', err);
            const el = document.getElementById('oc-backlog');
            if (el) { el.textContent = '📊 -- Days Backlog'; el.style.color = '#a6adc8'; }
        }

        // ─── Recommendations: Anomaly Detection + Smart Prioritization (loads last) ──
        try {
            const aft = await fetchAFTData(inYardVrids);
            const aftPerTrailer = (aft && aft.perTrailer) || {};

            // Gather current metrics for anomaly detection
            const stowRateEl = document.getElementById('oc-stow-rate');
            const stowRateMatch = stowRateEl ? stowRateEl.textContent.match(/([\d.]+)\s*JPH/) : null;
            const currentStowRate = stowRateMatch ? parseFloat(stowRateMatch[1]) : 0;

            const stowersEl = document.getElementById('oc-active-stowers');
            const stowersMatch = stowersEl ? stowersEl.textContent.match(/Stowers:\s*(\d+)/) : null;
            const currentStowers = stowersMatch ? parseInt(stowersMatch[1], 10) : 0;

            const kipsEl = document.getElementById('oc-kips-count');
            const kipsCount = kipsEl ? (parseInt(kipsEl.textContent, 10) || 0) : 0;

            const pendingCases = aft && aft.totalCases ? aft.totalCases : parseInt(sum(arrived, 'totalCartons').replace(/,/g,''),10) || 0;

            const currentMetrics = {
                stowRate: currentStowRate,
                activeStowers: currentStowers,
                pendingCases: pendingCases,
                kipsCount: kipsCount,
                trailerCount: arrived.length,
            };

            // Record snapshot and detect anomalies
            const history = recordMetricSnapshot(fc, currentMetrics);
            const alerts = detectAnomalies(fc, currentMetrics);

            // Score and prioritize trailers
            const prioritized = scoreTrailers(trailers, aftPerTrailer);

            // Render Recommendations into the overlay panel
            const recsOverlay = document.getElementById('oc-recs-overlay');
            if (recsOverlay) {
                recsOverlay.innerHTML = buildAIInsightsHTML(alerts, prioritized, fc, currentMetrics);
            }

            console.log('[OculusDash-AI] Insights rendered:', alerts.length, 'alerts,', prioritized.pureCase.length, 'pure case,', prioritized.palletized.length, 'palletized,', prioritized.sapTrailers.length, 'SAP, history:', history.length, 'snapshots');
        } catch (err) {
            console.error('[OculusDash-AI] Error:', err);
            const recsOverlay = document.getElementById('oc-recs-overlay');
            if (recsOverlay) {
                recsOverlay.innerHTML = `<div style="background:#2A2D3E;border-radius:6px;padding:14px;margin:10px;color:#C3CAD7;font-size:14px;">🤖 Inbound Operations Copilot: Error loading — ${err.message}</div>`;
            }
        }
    }

    function mount() {
        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);
        const container = document.createElement('div');
        container.id = 'oc-dash';
        document.body.appendChild(container);
        waitForContent(() => {
            render(container);
            if (document.querySelector('.no-trailers')) setTimeout(() => render(container), 5000);
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else setTimeout(mount, 3000);

})();
