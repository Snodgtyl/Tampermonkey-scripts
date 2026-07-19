// ==UserScript==
// @name         Rodeo CPT Dashboard
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Overlays a CPT breakdown dashboard on Rodeo ExSD pages — current shift & next shift (switches 30 min before SOS)
// @author       You
// @updateURL    https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/RodeoCPTDashboard.user.js
// @downloadURL  https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/RodeoCPTDashboard.user.js
// @match        https://rodeo-iad.amazon.com/*
// @match        https://rodeo-pdx.amazon.com/*
// @match        https://rodeo-dub.amazon.com/*
// @match        https://rodeo-nrt.amazon.com/*
// @match        https://rodeo-sin.amazon.com/*
// @include      https://rodeo-*.amazon.com/*
// @match        https://trans-logistics.amazon.com/ssp/dock/hrz/ob*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @connect      rodeo-iad.amazon.com
// @connect      rodeo-pdx.amazon.com
// @connect      rodeo-dub.amazon.com
// @connect      rodeo-nrt.amazon.com
// @connect      rodeo-sin.amazon.com
// @connect      picking-console.na.picking.aft.a2z.com
// @connect      fclm-portal.amazon.com
// @connect      adapt-iad.amazon.com
// @connect      trans-logistics.amazon.com
// ==/UserScript==

(function () {
    'use strict';

    // ─── SSP Dock Collector: scrape trailer data when on the SSP page ───────
    if (window.location.hostname === 'trans-logistics.amazon.com' && window.location.pathname.includes('/ssp/dock/hrz/ob')) {
        console.log('[RCD-SSP] Collector running on SSP dock page');

        // Check if we need to auto-search a VRID (from hyperlink click)
        const urlParams = new URLSearchParams(window.location.search);
        const searchVrid = urlParams.get('searchLoad') || '';
        if (searchVrid) {
            console.log('[RCD-SSP] Auto-searching for:', searchVrid);
            let searchAttempts = 0;
            const searchInterval = setInterval(() => {
                searchAttempts++;
                const searchInput = document.querySelector('input[placeholder*="Search"]')
                    || document.querySelector('input[type="text"]');
                if (searchInput) {
                    searchInput.value = searchVrid;
                    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
                    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                    searchInput.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
                    console.log('[RCD-SSP] ✓ Filled search:', searchVrid);
                    clearInterval(searchInterval);
                }
                if (searchAttempts >= 30) clearInterval(searchInterval);
            }, 500);
            return; // Don't scrape when in search mode — keep existing cached data
        }

        // Wait for the table to render (it's a JS SPA)
        let attempts = 0;
        const maxAttempts = 80; // 40 seconds — wait longer for P column to render
        const interval = setInterval(() => {
            attempts++;
            // Look for table rows with trailer data
            const rows = document.querySelectorAll('table tbody tr, table tr');
            // Check if we have actual data rows (not just headers)
            let dataRows = 0;
            rows.forEach(r => { if (r.querySelectorAll('td').length >= 5) dataRows++; });

            // Also check if P column data has loaded (look for containerHierarchy or numeric P values)
            const hasContainerData = document.querySelectorAll('a[data-vrid]').length > 0
                || document.querySelectorAll('.loadedPCell').length > 0
                || document.querySelectorAll('[class*="containerHierarchy"]').length > 0;

            if ((dataRows > 2 && (hasContainerData || attempts >= 40)) || attempts >= maxAttempts) {
                clearInterval(interval);
                if (dataRows < 2) {
                    console.log('[RCD-SSP] Timed out waiting for table data');
                    return;
                }
                console.log(`[RCD-SSP] Found ${dataRows} data rows, scraping...`);

                const trailers = [];
                const tables = document.querySelectorAll('table');
                for (const tbl of tables) {
                    const headers = Array.from(tbl.querySelectorAll('th')).map(h => h.textContent.trim());
                    if (headers.length < 5) continue;

                    console.log('[RCD-SSP] Table headers:', headers);
                    const statusCol = headers.findIndex(h => /^Status$/i.test(h));
                    const locationCol = headers.findIndex(h => /^Location$/i.test(h));
                    const vridCol = headers.findIndex(h => /VR\s*Id/i.test(h));
                    const cptCol = headers.indexOf('CPT');
                    const sortRouteCol = headers.findIndex(h => /SortRoute|Sort/i.test(h));

                    console.log(`[RCD-SSP] Columns: status=${statusCol}, location=${locationCol}, vrid=${vridCol}, cpt=${cptCol}, sortRoute=${sortRouteCol}`);
                    if (vridCol < 0) continue;

                    // Build a map of VRID → container count
                    const containerMap = {};
                    // Method 1: <a> tags with data-vrid whose text is purely numeric
                    document.querySelectorAll('a[data-vrid]').forEach(a => {
                        const vr = a.getAttribute('data-vrid') || '';
                        const text = a.textContent.trim();
                        if (vr && /^\d+$/.test(text)) {
                            containerMap[vr] = text;
                        }
                    });
                    // Method 2: Find the P column header index and read from cells directly
                    if (Object.keys(containerMap).length === 0) {
                        // The "P" header in the SSP table - find its exact index
                        const allThs = Array.from(tbl.querySelectorAll('thead th, th'));
                        let pColIdx = -1;
                        allThs.forEach((th, i) => {
                            if (th.textContent.trim() === 'P') pColIdx = i;
                        });
                        console.log('[RCD-SSP] P column index from th scan:', pColIdx, 'total ths:', allThs.length);
                        if (pColIdx >= 0) {
                            tbl.querySelectorAll('tr').forEach(row => {
                                if (row.textContent.includes('Scheduled Departure Window')) return;
                                const tds = row.querySelectorAll('td');
                                if (tds.length < 5) return;
                                const vr = vridCol >= 0 && tds[vridCol] ? tds[vridCol].textContent.trim() : '';
                                // P column index from headers maps to td index (subtract header-only columns if any)
                                // Since headers include checkbox/alert columns that are also td in data rows,
                                // the index should be the same
                                const pCell = tds[pColIdx] || null;
                                const pText = pCell ? pCell.textContent.trim().replace(/[^0-9]/g, '') : '';
                                if (vr && vr.length > 3 && pText && parseInt(pText) > 0) {
                                    containerMap[vr] = pText;
                                }
                            });
                        }
                    }
                    console.log('[RCD-SSP] Container map:', Object.keys(containerMap).length, 'sample:', JSON.stringify(Object.entries(containerMap).slice(0, 5)));

                    let firstRowLogged = false;
                    let rowIdx = 0;
                    tbl.querySelectorAll('tr').forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length < 5) { rowIdx++; return; }
                        if (row.textContent.includes('Scheduled Departure Window')) { rowIdx++; return; }

                        const vrid = vridCol >= 0 && cells[vridCol] ? cells[vridCol].textContent.trim() : '';
                        const location = locationCol >= 0 && cells[locationCol] ? cells[locationCol].textContent.trim() : '';
                        const status = statusCol >= 0 && cells[statusCol] ? cells[statusCol].textContent.trim().replace(/\s+/g, ' ') : '';
                        const cpt = cptCol >= 0 && cells[cptCol] ? cells[cptCol].textContent.trim() : '';

                        // Get container count from the VRID map
                        let containers = containerMap[vrid] || '';
                        if (!containers) {
                            // Fallback: look for element with data-vrid matching in this row
                            const el = row.querySelector(`[data-vrid="${vrid}"]`);
                            if (el) {
                                const txt = el.textContent.trim();
                                const numMatch = txt.match(/\b(\d{2,5})\b/);
                                if (numMatch) containers = numMatch[1];
                            }
                        }

                        // Get destination from SortRoute column (format: "WT KRB3->SMF1" or "KRB3->SAN3")
                        let destination = '';
                        if (sortRouteCol >= 0 && cells[sortRouteCol]) {
                            const sr = cells[sortRouteCol].textContent.trim();
                            // Match "->DEST" pattern (destination is after the arrow)
                            const destMatch = sr.match(/->\s*([A-Z]{2,5}\d{1,2})/i);
                            if (destMatch) destination = destMatch[1].toUpperCase();
                        }

                        if (!firstRowLogged && vrid) {
                            console.log(`[RCD-SSP] First data row: vrid=${vrid}, loc=${location}, containers=${containers}, dest=${destination}, cpt=${cpt}`);
                            firstRowLogged = true;
                        }

                        if (vrid && vrid.length > 3) {
                            trailers.push({ vrid, location, status, containers, cpt, destination });
                        }
                        rowIdx++;
                    });

                    if (trailers.length > 0) break;
                }

                console.log(`[RCD-SSP] Scraped ${trailers.length} trailers`);
                if (trailers.length > 0) {
                    console.log('[RCD-SSP] First trailer:', trailers[0]);
                    // Extract FC from the page — try URL param, then page content
                    const urlParams = new URLSearchParams(window.location.search);
                    let nodeId = urlParams.get('nodeId') || urlParams.get('nodeid') || '';
                    // If no nodeId in URL, try to find it from the sort route or page text
                    if (!nodeId) {
                        const pageText = document.body.textContent || '';
                        const fcMatch = pageText.match(/\b(KRB[1-9]|QXX\d|ATL\d|AVP\d|HGR\d|SAV\d)\b/i);
                        if (fcMatch) nodeId = fcMatch[1].toUpperCase();
                    }
                    // Also try from sort route column in first trailer
                    if (!nodeId && trailers[0].location) {
                        const locMatch = document.body.textContent.match(/\b([A-Z]{3}\d)-/);
                        if (locMatch) nodeId = locMatch[1];
                    }
                    console.log('[RCD-SSP] Detected FC:', nodeId);
                    const data = { trailers, timestamp: Date.now(), fc: nodeId };
                    // Clear old data and store fresh
                    GM_setValue('sspDock_' + nodeId, JSON.stringify(data));
                    GM_setValue('sspDock_', JSON.stringify(data));
                    console.log(`[RCD-SSP] ✓ Stored ${trailers.length} trailers for ${nodeId || '(all)'}`);
                }
            }
        }, 500);

        return; // Don't run the rest of the Rodeo dashboard on SSP pages
    }

    // ─── Auto-clear stale cache on version update ───────────────────────────
    const SCRIPT_VERSION = '2.4';
    const lastVer = localStorage.getItem('_rcd_scriptVersion') || '';
    if (lastVer !== SCRIPT_VERSION) {
        // Clear cached prefs/data from previous versions
        localStorage.removeItem('rcd_prefs_v1');
        localStorage.setItem('_rcd_scriptVersion', SCRIPT_VERSION);
        console.log(`[RodeoCPT] Version updated ${lastVer} → ${SCRIPT_VERSION}, cleared cached data`);
    }

    // ─── Auto-refresh at :00, :15, :30, :45 ────────────────────────────────────
    const now = new Date();
    const mins = now.getMinutes();
    const nextQuarter = (Math.floor(mins / 15) + 1) * 15;
    const msUntilNext = ((nextQuarter - mins) * 60 - now.getSeconds()) * 1000 - now.getMilliseconds();
    setTimeout(() => location.reload(), msUntilNext > 0 ? msUntilNext : 0);

    // ─── Style presets ────────────────────────────────────────────────────────────
    const THEMES = {
        'Dark':     { bg:'#1e1e2e', hdr:'#313244', text:'#cdd6f4', meta:'#a6adc8', title:'#cba6f7', secCur:'#89b4fa', secNext:'#f9e2af', secSum:'#f38ba8', thBg:'#45475a', thLbl:'#313244', tdBdr:'#313244', lblBg:'#252535', lblClr:'#89b4fa', totBg:'#252535', totClr:'#cba6f7', rowHov:'#313244', trowBg:'#2a2a3e', trowBdr:'#585b70', trowLbl:'#f38ba8', btnBg:'#45475a', btnHov:'#585b70', refBg:'#1e66f5', refHov:'#3d7ef7', dbgBg:'#181825', dbgBdr:'#45475a', curCell:'#1e3a1e', riskCell:'#3a1a1a', riskHdr:'#4a1a1a' },
        'Light':    { bg:'#f8f9fa', hdr:'#e9ecef', text:'#212529', meta:'#6c757d', title:'#6f42c1', secCur:'#0d6efd', secNext:'#fd7e14', secSum:'#dc3545', thBg:'#dee2e6', thLbl:'#e9ecef', tdBdr:'#dee2e6', lblBg:'#f1f3f5', lblClr:'#0d6efd', totBg:'#f1f3f5', totClr:'#6f42c1', rowHov:'#e9ecef', trowBg:'#e2e6ea', trowBdr:'#adb5bd', trowLbl:'#dc3545', btnBg:'#dee2e6', btnHov:'#ced4da', refBg:'#0d6efd', refHov:'#0b5ed7', dbgBg:'#f1f3f5', dbgBdr:'#dee2e6', curCell:'#d4edda', riskCell:'#f8d7da', riskHdr:'#f5c6cb' },
        'Midnight': { bg:'#0d1117', hdr:'#161b22', text:'#c9d1d9', meta:'#8b949e', title:'#79c0ff', secCur:'#58a6ff', secNext:'#e3b341', secSum:'#ff7b72', thBg:'#21262d', thLbl:'#161b22', tdBdr:'#21262d', lblBg:'#0d1117', lblClr:'#58a6ff', totBg:'#0d1117', totClr:'#79c0ff', rowHov:'#161b22', trowBg:'#1c2128', trowBdr:'#30363d', trowLbl:'#ff7b72', btnBg:'#21262d', btnHov:'#30363d', refBg:'#1f6feb', refHov:'#388bfd', dbgBg:'#010409', dbgBdr:'#21262d', curCell:'#0d2a0d', riskCell:'#2a0d0d', riskHdr:'#3a1010' },
        'Hi-Con':   { bg:'#000', hdr:'#111', text:'#fff', meta:'#ccc', title:'#ff0', secCur:'#0cf', secNext:'#fa0', secSum:'#f44', thBg:'#222', thLbl:'#111', tdBdr:'#333', lblBg:'#0a0a0a', lblClr:'#0cf', totBg:'#0a0a0a', totClr:'#ff0', rowHov:'#1a1a1a', trowBg:'#111', trowBdr:'#555', trowLbl:'#f44', btnBg:'#333', btnHov:'#444', refBg:'#05f', refHov:'#07f', dbgBg:'#050505', dbgBdr:'#333', curCell:'#003300', riskCell:'#330000', riskHdr:'#440000' },
    };

    const BORDERS = {
        'Subtle': { w:'1px', r:'8px',  sh:'0 8px 32px rgba(0,0,0,0.5)' },
        'Bold':   { w:'2px', r:'6px',  sh:'0 8px 32px rgba(0,0,0,0.6)' },
        'Sharp':  { w:'2px', r:'0px',  sh:'0 4px 16px rgba(0,0,0,0.5)' },
        'Glow':   { w:'1px', r:'10px', sh:'0 0 16px 3px currentColor, 0 8px 32px rgba(0,0,0,0.5)' },
        'None':   { w:'0px', r:'8px',  sh:'none' },
    };

    const STORAGE_KEY = 'rcd_prefs_v1';
    function loadPrefs() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; } }
    function savePrefs(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
    let prefs = loadPrefs();
    let curTheme  = 'Midnight';
    let curBorder = prefs.border || 'Subtle';

    function applyStyle(el) {
        const t = THEMES[curTheme]   || THEMES['Dark'];
        const b = BORDERS[curBorder] || BORDERS['Subtle'];
        el.style.cssText = `
            background:${t.bg}; color:${t.text};
            border:${b.w} solid ${t.title}; border-radius:${b.r};
            box-shadow:${b.sh};
            --rcd-bg:${t.bg}; --rcd-hdr:${t.hdr}; --rcd-text:${t.text}; --rcd-meta:${t.meta};
            --rcd-title:${t.title}; --rcd-sec-cur:${t.secCur}; --rcd-sec-next:${t.secNext}; --rcd-sec-sum:${t.secSum};
            --rcd-th:${t.thBg}; --rcd-th-lbl:${t.thLbl}; --rcd-td-bdr:${t.tdBdr};
            --rcd-lbl-bg:${t.lblBg}; --rcd-lbl-clr:${t.lblClr};
            --rcd-tot-bg:${t.totBg}; --rcd-tot-clr:${t.totClr};
            --rcd-row-hov:${t.rowHov}; --rcd-trow-bg:${t.trowBg}; --rcd-trow-bdr:${t.trowBdr}; --rcd-trow-lbl:${t.trowLbl};
            --rcd-btn:${t.btnBg}; --rcd-btn-hov:${t.btnHov}; --rcd-ref:${t.refBg}; --rcd-ref-hov:${t.refHov};
            --rcd-dbg-bg:${t.dbgBg}; --rcd-dbg-bdr:${t.dbgBdr};
            --rcd-cur:${t.curCell}; --rcd-risk:${t.riskCell}; --rcd-risk-hdr:${t.riskHdr};
        `;
    }

    // ─── Work pool groupings ──────────────────────────────────────────────────────
    const POOL_GROUPS = {
        'Ready to Pick': ['ReadyToPick', 'ReadyToPickHardCapped', 'ReadyToPickUnconstrained'],
        'Picking Not Yet Picked': ['PickingNotYetPicked', 'PickingNotYetPickedPrioritized',
            'PickingNotYetPickedNotPrioritized', 'PickingNotYetPickedHardCapped',
            'BulkPickFromReserve', 'PPBulkPickFromReserve'],
        'Picking Picked': ['PickingPicked', 'PickingPickedInProgress', 'PickingPickedInTransit',
            'PickingPickedRouting', 'PickingPickedAtDestination'],
        'Inducted': ['Inducted'],
        'Packing': ['Packing'],
        'Crossdock': ['Crossdock', 'CrossdockNotYetPicked'],
        'Transship Sorted': ['TransshipSorted'],
        'Palletized': ['Palletized', 'PalletizedStaged'],
        'Manifest Pending': ['ManifestPending', 'ManifestPendingVerification']
    };

    const GROUP_ORDER = [
        'Ready to Pick', 'Picking Not Yet Picked', 'Picking Picked',
        'Inducted', 'Packing', 'Crossdock', 'Transship Sorted', 'Palletized', 'Manifest Pending'
    ];

    const GROUP_CLASS = {
        'Ready to Pick':           'rcd-rtp',
        'Picking Not Yet Picked':  'rcd-pnyp',
        'Picking Picked':          'rcd-pp',
        'Inducted':                'rcd-ind',
        'Packing':                 'rcd-pak',
        'Crossdock':               'rcd-xdk',
        'Transship Sorted':        'rcd-tss',
        'Palletized':              'rcd-pal',
        'Manifest Pending':        'rcd-mp'
    };

    // ─── FC Shift Configuration ─────────────────────────────────────────────
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
    const DEFAULT_SHIFT = { dayStartH:7, dayStartM:0, dayEndH:17, dayEndM:30, nightStartH:18, nightStartM:30, nightEndH:5, nightEndM:0 };

    function getShiftConfig(fc) {
        return FC_SHIFTS[(fc || '').toUpperCase()] || DEFAULT_SHIFT;
    }

    // ─── Shift boundaries ─────────────────────────────────────────────────────────
    // Returns ACTUAL shift boundaries (for FCLM pick rate, etc.)
    function getActualShiftBoundaries(fc) {
        const shift = getShiftConfig(fc);
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes();
        const timeVal = h * 60 + m;
        let shiftStart, shiftEnd, nextShiftStart, nextShiftEnd;

        const dayStart   = shift.dayStartH * 60 + shift.dayStartM;
        const nightStart = shift.nightStartH * 60 + shift.nightStartM;
        const nightEnd   = shift.nightEndH * 60 + shift.nightEndM;
        const dayEnd     = shift.dayEndH * 60 + shift.dayEndM;
        const grace = 30; // 30-minute grace period after shift ends

        if (timeVal >= dayStart && timeVal < nightStart) {
            // Day shift
            shiftStart = new Date(now); shiftStart.setHours(shift.dayStartH, shift.dayStartM, 0, 0);
            shiftEnd   = new Date(now); shiftEnd.setHours(shift.dayEndH, shift.dayEndM, 0, 0);
        } else if (timeVal < nightEnd) {
            // After midnight, still on last night's shift
            shiftStart = new Date(now); shiftStart.setDate(shiftStart.getDate() - 1); shiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            shiftEnd = new Date(shiftStart); shiftEnd.setDate(shiftEnd.getDate() + 1); shiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        } else if (timeVal >= nightEnd && timeVal < nightEnd + grace && timeVal < dayStart) {
            // Grace period after night shift ends — still report last night's shift
            shiftStart = new Date(now); shiftStart.setDate(shiftStart.getDate() - 1); shiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            shiftEnd = new Date(shiftStart); shiftEnd.setDate(shiftEnd.getDate() + 1); shiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        } else if (timeVal >= dayEnd && timeVal < dayEnd + grace && timeVal < nightStart) {
            // Grace period after day shift ends — still report today's day shift
            shiftStart = new Date(now); shiftStart.setHours(shift.dayStartH, shift.dayStartM, 0, 0);
            shiftEnd   = new Date(now); shiftEnd.setHours(shift.dayEndH, shift.dayEndM, 0, 0);
        } else {
            // Night shift (before midnight)
            shiftStart = new Date(now); shiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            shiftEnd = new Date(shiftStart); shiftEnd.setDate(shiftEnd.getDate() + 1); shiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        }
        // Next shift
        nextShiftStart = new Date(shiftEnd);
        if (shiftEnd.getHours() < 12) {
            nextShiftStart.setHours(shift.dayStartH, shift.dayStartM, 0, 0);
            nextShiftEnd = new Date(nextShiftStart); nextShiftEnd.setHours(shift.dayEndH, shift.dayEndM, 0, 0);
        } else {
            nextShiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            nextShiftEnd = new Date(nextShiftStart); nextShiftEnd.setDate(nextShiftEnd.getDate() + 1); nextShiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        }
        return { shiftStart, shiftEnd, nextShiftStart, nextShiftEnd };
    }

    // Returns DISPLAY shift boundaries for Rodeo CPT data
    // Switches to next shift data at fixed times: 5:45 PM → night shift, 5:45 AM → day shift
    function getShiftBoundaries(fc) {
        const shift = getShiftConfig(fc);
        const now = new Date();
        const h = now.getHours(), m = now.getMinutes();
        const timeVal = h * 60 + m;

        const NIGHT_SWITCH = 17 * 60 + 45; // 5:45 PM — start showing night shift data
        const DAY_SWITCH   =  5 * 60 + 45; // 5:45 AM — start showing day shift data

        const dayStart   = shift.dayStartH * 60 + shift.dayStartM;
        const nightEnd   = shift.nightEndH * 60 + shift.nightEndM;

        let shiftStart, shiftEnd, nextShiftStart, nextShiftEnd;

        if (timeVal >= DAY_SWITCH && timeVal < NIGHT_SWITCH) {
            // Day shift window (5:45 AM to 5:44 PM)
            shiftStart = new Date(now); shiftStart.setHours(shift.dayStartH, shift.dayStartM, 0, 0);
            shiftEnd   = new Date(now); shiftEnd.setHours(shift.dayEndH, shift.dayEndM, 0, 0);
        } else if (timeVal >= NIGHT_SWITCH) {
            // Night shift window (5:45 PM to midnight)
            shiftStart = new Date(now); shiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            shiftEnd = new Date(shiftStart); shiftEnd.setDate(shiftEnd.getDate() + 1); shiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        } else {
            // Night shift window (midnight to 5:44 AM)
            shiftStart = new Date(now); shiftStart.setDate(shiftStart.getDate() - 1); shiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            shiftEnd = new Date(shiftStart); shiftEnd.setDate(shiftEnd.getDate() + 1); shiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        }

        // Next shift
        nextShiftStart = new Date(shiftEnd);
        if (shiftEnd.getHours() < 12) {
            // Night ended, next is day
            nextShiftStart.setHours(shift.dayStartH, shift.dayStartM, 0, 0);
            nextShiftEnd = new Date(nextShiftStart); nextShiftEnd.setHours(shift.dayEndH, shift.dayEndM, 0, 0);
        } else {
            // Day ended, next is night
            nextShiftStart.setHours(shift.nightStartH, shift.nightStartM, 0, 0);
            nextShiftEnd = new Date(nextShiftStart); nextShiftEnd.setDate(nextShiftEnd.getDate() + 1); nextShiftEnd.setHours(shift.nightEndH, shift.nightEndM, 0, 0);
        }

        // Determine which shift is "current" for labeling
        const isNightShift = shiftStart.getHours() >= 12 || shiftStart.getHours() < 6;
        const currentShiftLabel = isNightShift ? 'Night Shift' : 'Day Shift';

        return { shiftStart, shiftEnd, nextShiftStart, nextShiftEnd, currentShiftLabel };
    }

    function fmtTime(d) { return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }); }
    function fmtDate(d) { return d.toLocaleDateString([], { month: 'short', day: 'numeric' }); }

    function matchPoolGroup(label) {
        const norm = label.replace(/[\s_-]/g, '').toLowerCase();
        for (const [group, pools] of Object.entries(POOL_GROUPS)) {
            for (const pool of pools) {
                if (norm.includes(pool.toLowerCase())) return group;
            }
        }
        return null;
    }

    function parseCPTDate(str) {
        str = str.trim();
        let m;
        m = str.match(/(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (m) return new Date(+m[1], +m[2]-1, +m[3], +m[4], +m[5]);
        m = str.match(/([A-Za-z]{3})\s+(\d{1,2})[,\s]+(\d{1,2}):(\d{2})/);
        if (m) {
            const mo = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11}[m[1].toLowerCase()];
            return new Date(new Date().getFullYear(), mo, +m[2], +m[3], +m[4]);
        }
        m = str.match(/(\d{1,2})\/(\d{1,2})\s+(\d{2}):(\d{2})/);
        if (m) return new Date(new Date().getFullYear(), +m[1]-1, +m[2], +m[3], +m[4]);
        m = str.match(/^(\d{2}):(\d{2})$/);
        if (m) { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), +m[1], +m[2]); }
        return null;
    }

    function forceTransshipments(url) {
        const u = new URL(url);
        // Don't override CUSTOMER_SHIPMENTS (e.g. bulk freight)
        if (u.searchParams.get('shipmentType') === 'CUSTOMER_SHIPMENTS') return u.toString();
        u.searchParams.set('shipmentType', 'TRANSSHIPMENTS');
        return u.toString();
    }

    function fetchCaseCount(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: forceTransshipments(url),
                headers: { 'Range': 'bytes=100000-200000' },
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let m = text.match(/pager-result-size">([\d,]+)<\/span>/i);
                    if (!m) m = text.match(/([\d,]+)<\/span>\s*results/i);
                    if (m) { resolve(parseInt(m[1].replace(/,/g, ''), 10)); return; }
                    resolve(null);
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null),
                timeout: 30000
            });
        });
    }

    function fetchCaseCountRaw(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Range': 'bytes=100000-200000' },
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let m = text.match(/pager-result-size">([\d,]+)<\/span>/i);
                    if (!m) m = text.match(/([\d,]+)<\/span>\s*results/i);
                    if (m) { resolve(parseInt(m[1].replace(/,/g, ''), 10)); return; }
                    resolve(null);
                },
                onerror: () => resolve(null),
                ontimeout: () => resolve(null),
                timeout: 30000
            });
        });
    }

    function fetchCaseCountRawFull(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let m = text.match(/pager-result-size">([\d,]+)<\/span>/i);
                    if (!m) m = text.match(/([\d,]+)<\/span>\s*results/i);
                    if (m) { resolve(parseInt(m[1].replace(/,/g, ''), 10)); return; }
                    resolve(0);
                },
                onerror: () => resolve(0),
                ontimeout: () => resolve(0),
                timeout: 60000
            });
        });
    }

    function fetchCaseCountFull(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: forceTransshipments(url),
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let m = text.match(/pager-result-size">([\d,]+)<\/span>/i);
                    if (!m) m = text.match(/([\d,]+)<\/span>\s*results/i);
                    if (m) { resolve(parseInt(m[1].replace(/,/g, ''), 10)); return; }
                    resolve(0);
                },
                onerror: () => resolve(0),
                ontimeout: () => resolve(0),
                timeout: 60000
            });
        });
    }

    // ─── Fetch Bulk Freight count by unique Outer Scannable IDs ─────────────────
    function fetchBulkFreightCount(url, workPool) {
        return new Promise((resolve) => {
            // Build correct URL: CUSTOMER_SHIPMENTS, correct WorkPool
            const u = new URL(url);
            u.searchParams.set('shipmentType', 'CUSTOMER_SHIPMENTS');
            u.searchParams.set('WorkPool', workPool || 'PickingNotYetPicked');
            const fetchUrl = u.toString();
            console.log('[RCD DEBUG] Bulk freight fetch URL:', fetchUrl);
            GM_xmlhttpRequest({
                method: 'GET',
                url: fetchUrl,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let m = text.match(/pager-result-size">([\d,]+)<\/span>/i);
                    if (!m) m = text.match(/([\d,]+)<\/span>\s*results/i);
                    if (!m) m = text.match(/of\s+([\d,]+)\s*results/i);
                    const count = m ? parseInt(m[1].replace(/,/g, ''), 10) : 0;
                    console.log(`[RCD DEBUG] Bulk freight pager count: ${count}`);
                    resolve({ count, url: fetchUrl });
                },
                onerror: () => resolve({ count: 0, url: fetchUrl }),
                ontimeout: () => resolve({ count: 0, url: fetchUrl }),
                timeout: 60000
            });
        });
    }

    // ─── Fetch Destination Warehouse IDs with counts from a Picking Picked detail page ───
    function fetchDestWarehouseIds(url) {
        return new Promise((resolve) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                onload: (resp) => {
                    const text = resp.responseText || '';
                    const destCounts = {};
                    try {
                        const doc = new DOMParser().parseFromString(text, 'text/html');
                        const headers = Array.from(doc.querySelectorAll('th')).map(h => h.textContent.trim());
                        const destCol = headers.findIndex(h => /destination\s*warehouse/i.test(h));
                        if (destCol >= 0) {
                            doc.querySelectorAll('tbody tr').forEach(row => {
                                const cells = row.querySelectorAll('td');
                                if (cells[destCol]) {
                                    const val = cells[destCol].textContent.trim();
                                    if (val && val !== '—' && val !== '-') {
                                        destCounts[val] = (destCounts[val] || 0) + 1;
                                    }
                                }
                            });
                        }
                    } catch (e) {
                        console.warn('[RCD] fetchDestWarehouseIds parse error:', e);
                    }
                    resolve(destCounts);
                },
                onerror: () => resolve({}),
                ontimeout: () => resolve({}),
                timeout: 30000
            });
        });
    }

    // ─── Fetch Pick Rate JPH from FCLM ─────────────────────────────────────────
    function fetchPickRate(fc, shiftStart, shiftEnd) {
        return new Promise((resolve) => {
            const now = new Date();
            const startDate = `${shiftStart.getFullYear()}/${String(shiftStart.getMonth()+1).padStart(2,'0')}/${String(shiftStart.getDate()).padStart(2,'0')}`;
            const nowDate = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')}`;
            const sH = shiftStart.getHours(), sM = shiftStart.getMinutes();
            const eH = now.getHours(), eM = now.getMinutes();
            const url = `https://fclm-portal.amazon.com/reports/functionRollup?reportFormat=HTML` +
                `&warehouseId=${fc}&processId=1003065&maxIntradayDays=1&spanType=Intraday` +
                `&startDateIntraday=${encodeURIComponent(startDate)}` +
                `&startHourIntraday=${sH}&startMinuteIntraday=${String(sM).padStart(2,'0')}` +
                `&endDateIntraday=${encodeURIComponent(nowDate)}` +
                `&endHourIntraday=${eH}&endMinuteIntraday=${String(eM).padStart(2,'0')}`;

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                anonymous: false,
                headers: { 'Accept': 'text/html' },
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let jph = '';
                    let totalPicks = 0;
                    console.log('[PickRate DEBUG] Response length:', text.length);
                    if (text.length > 500) {
                        let bestJPH = '';
                        let bestHours = 0;
                        let bestJobs = 0;
                        // Use DOMParser for reliable HTML parsing
                        try {
                            const doc = new DOMParser().parseFromString(text, 'text/html');
                            const rows = doc.querySelectorAll('tr');
                            console.log('[PickRate DEBUG] Total <tr> found:', rows.length);
                            rows.forEach((row, idx) => {
                                const cells = row.querySelectorAll('td');
                                if (cells.length >= 4) {
                                    const cellTexts = Array.from(cells).map(c => c.textContent.trim());
                                    if (cellTexts[0] === 'Total') {
                                        console.log(`[PickRate DEBUG] Total row ${idx} (${cellTexts.length} cells):`, JSON.stringify(cellTexts.slice(0, 6)));
                                        const nums = [];
                                        for (let i = 1; i < cellTexts.length; i++) {
                                            const v = parseFloat(cellTexts[i].replace(/,/g, ''));
                                            if (!isNaN(v)) nums.push(v);
                                        }
                                        console.log('[PickRate DEBUG] Total row nums:', JSON.stringify(nums), '| Pass filter?', nums.length >= 3);
                                        if (nums.length >= 3 && nums[0] >= bestHours) {
                                            bestHours = nums[0];
                                            bestJPH = nums[2].toFixed(2);
                                            bestJobs = Math.round(nums[1]);
                                        }
                                    }
                                }
                            });
                        } catch (e) {
                            console.log('[PickRate DEBUG] DOMParser error:', e);
                        }
                        console.log('[PickRate DEBUG] bestJPH:', bestJPH, '| bestHours:', bestHours, '| bestJobs:', bestJobs);
                        if (bestJPH) { jph = bestJPH; totalPicks = bestJobs; }
                    }
                    console.log('[PickRate DEBUG] Final result:', jph, totalPicks);
                    resolve({ jph, totalPicks });
                },
                onerror: (e) => resolve({ jph: 'err:net', totalPicks: 0 }),
                ontimeout: () => resolve({ jph: 'err:timeout', totalPicks: 0 }),
                timeout: 20000
            });
        });
    }

    // ─── Fetch Total Jobs from FCLM functionRollup (processId=1003021) for CPLH ─
    function fetchCPLHJobs(fc, shiftStart, shiftEnd) {
        return new Promise((resolve) => {
            const startDate = `${shiftStart.getFullYear()}/${String(shiftStart.getMonth()+1).padStart(2,'0')}/${String(shiftStart.getDate()).padStart(2,'0')}`;
            const endDate = `${shiftEnd.getFullYear()}/${String(shiftEnd.getMonth()+1).padStart(2,'0')}/${String(shiftEnd.getDate()).padStart(2,'0')}`;
            const sH = shiftStart.getHours(), sM = shiftStart.getMinutes();
            const eH = shiftEnd.getHours(), eM = shiftEnd.getMinutes();
            const url = `https://fclm-portal.amazon.com/reports/functionRollup?reportFormat=HTML` +
                `&warehouseId=${fc}&processId=1003021&maxIntradayDays=1&spanType=Intraday` +
                `&startDateIntraday=${encodeURIComponent(startDate)}` +
                `&startHourIntraday=${sH}&startMinuteIntraday=${String(sM).padStart(2,'0')}` +
                `&endDateIntraday=${encodeURIComponent(endDate)}` +
                `&endHourIntraday=${eH}&endMinuteIntraday=${String(eM).padStart(2,'0')}`;

            GM_xmlhttpRequest({
                method: 'GET', url, anonymous: false,
                headers: { 'Accept': 'text/html' },
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let totalJobs = 0;
                    try {
                        const doc = new DOMParser().parseFromString(text, 'text/html');
                        // Find the Total row's Jobs cell: <td class="numeric size-total highlighted">
                        const rows = doc.querySelectorAll('tr');
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td');
                            if (cells.length >= 3) {
                                const cellTexts = Array.from(cells).map(c => c.textContent.trim());
                                if (cellTexts.includes('Total')) {
                                    // Find the highlighted total cell
                                    const highlightedCell = row.querySelector('td.size-total.highlighted, td.numeric.size-total');
                                    if (highlightedCell) {
                                        totalJobs = parseInt(highlightedCell.textContent.trim().replace(/,/g, ''), 10) || 0;
                                        if (totalJobs > 0) {
                                            console.log('[CPLH DEBUG] Found Total Jobs:', totalJobs);
                                            break;
                                        }
                                    }
                                    // Fallback: second numeric value in Total row is Jobs
                                    const nums = [];
                                    for (let i = 1; i < cellTexts.length; i++) {
                                        const v = parseFloat(cellTexts[i].replace(/,/g, ''));
                                        if (!isNaN(v) && v > 0) nums.push(v);
                                    }
                                    if (nums.length >= 2) {
                                        totalJobs = Math.round(nums[1]); // Jobs is second numeric after Hours
                                        console.log('[CPLH DEBUG] Fallback Total Jobs:', totalJobs);
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (e) { console.log('[CPLH DEBUG] Jobs parse error:', e); }
                    resolve(totalJobs);
                },
                onerror: () => resolve(0),
                ontimeout: () => resolve(0),
                timeout: 20000
            });
        });
    }

    // ─── Fetch Total Hours from FCLM processPathRollup ────────────────────────
    function fetchTotalHours(fc, shiftStart, shiftEnd) {
        return new Promise((resolve) => {
            const startDate = `${shiftStart.getFullYear()}/${String(shiftStart.getMonth()+1).padStart(2,'0')}/${String(shiftStart.getDate()).padStart(2,'0')}`;
            const endDate = `${shiftEnd.getFullYear()}/${String(shiftEnd.getMonth()+1).padStart(2,'0')}/${String(shiftEnd.getDate()).padStart(2,'0')}`;
            const startDayDate = endDate; // startDateDay matches the end date
            const sH = shiftStart.getHours(), sM = shiftStart.getMinutes();
            const eH = shiftEnd.getHours(), eM = shiftEnd.getMinutes();
            const url = `https://fclm-portal.amazon.com/reports/processPathRollup?reportFormat=HTML` +
                `&warehouseId=${fc}` +
                `&startDateDay=${encodeURIComponent(startDayDate)}` +
                `&maxIntradayDays=1&spanType=Intraday` +
                `&startDateIntraday=${encodeURIComponent(startDate)}` +
                `&startHourIntraday=${sH}&startMinuteIntraday=${String(sM).padStart(2,'0')}` +
                `&endDateIntraday=${encodeURIComponent(endDate)}` +
                `&endHourIntraday=${eH}&endMinuteIntraday=${String(eM).padStart(2,'0')}` +
                `&_adjustPlanHours=on&_hideEmptyLineItems=on&_rememberViewForWarehouse=on&employmentType=AllEmployees`;
            console.log('[CPLH DEBUG] Fetching URL:', url);

            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                anonymous: false,
                headers: { 'Accept': 'text/html' },
                onload: (resp) => {
                    const text = resp.responseText || '';
                    let totalHours = 0;
                    try {
                        const doc = new DOMParser().parseFromString(text, 'text/html');
                        // Find the "Hrs" column index from headers
                        const rows = doc.querySelectorAll('tr');
                        let hrsColIdx = -1;
                        for (const row of rows) {
                            const ths = Array.from(row.querySelectorAll('th'));
                            const idx = ths.findIndex(th => th.textContent.trim() === 'Hrs');
                            if (idx >= 0) { hrsColIdx = idx; break; }
                        }
                        console.log('[CPLH DEBUG] Hrs column index:', hrsColIdx);
                        // Find the DA Transfer TOTAL row
                        for (const row of rows) {
                            const cells = row.querySelectorAll('td');
                            if (cells.length >= 2 && cells[0].textContent.trim() === 'TOTAL' &&
                                cells[1] && cells[1].textContent.includes('DA Bldg to Bldg Transfer TOTAL')) {
                                if (hrsColIdx >= 0 && cells[hrsColIdx - 1]) {
                                    const origDiv = cells[hrsColIdx - 1].querySelector('div[class*="original"]');
                                    totalHours = parseFloat((origDiv || cells[hrsColIdx - 1]).textContent.trim().replace(/,/g, '')) || 0;
                                } else {
                                    // Fallback: second origDiv (index 1) is typically Hrs
                                    const origDivs = row.querySelectorAll('div[class*="original"]');
                                    if (origDivs.length >= 2) {
                                        totalHours = parseFloat(origDivs[1].textContent.trim().replace(/,/g, '')) || 0;
                                    }
                                }
                                console.log('[CPLH DEBUG] DA Transfer TOTAL hours:', totalHours);
                                break;
                            }
                        }
                    } catch (e) {
                        console.log('[CPLH DEBUG] Parse error:', e);
                    }
                    resolve(totalHours);
                },
                onerror: () => resolve(0),
                ontimeout: () => resolve(0),
                timeout: 20000
            });
        });
    }

    // ─── Fetch Active Pickers from Picking Console API ──────────────────────────
    function fetchActivePickers(fc) {
        return new Promise((resolve) => {
            const url = `https://picking-console.na.picking.aft.a2z.com/api/fcs/${fc}/process-paths/information`;
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                onload: (resp) => {
                    const pickerMap = {};
                    try {
                        const data = JSON.parse(resp.responseText);
                        const ppMap = data.processPathInformationMap || {};
                        Object.entries(ppMap).forEach(([ppName, info]) => {
                            pickerMap[ppName] = info.PickerCount || 0;
                        });
                    } catch(e) { /* skip */ }
                    resolve(pickerMap);
                },
                onerror: () => resolve({}),
                ontimeout: () => resolve({}),
                timeout: 15000
            });
        });
    }

    // ─── Fetch Picking Learning Curve breakdown from ADAPT ───────────────────────
    function fetchPickingLearningCurve(fc, shiftStart) {
        const now = new Date();
        console.log('[RCD-LC] Fetching LC from FCLM Function Rollup HTML (LC Toolkit adds LC column)...');

        // Fetch the Function Rollup page as HTML — the FCLM LC Toolkit script adds LC data to it
        // We use processId 1003065 (Pick) which is what the dashboard already uses
        const fmtD = (d) => `${d.getFullYear()}%2F${String(d.getMonth()+1).padStart(2,'0')}%2F${String(d.getDate()).padStart(2,'0')}`;
        const startDate = shiftStart || new Date(now.getTime() - 60 * 60 * 1000);
        const fclmUrl = `https://fclm-portal.amazon.com/reports/functionRollup?reportFormat=CSV&warehouseId=${fc}&processId=1003065&maxIntradayDays=1&spanType=Intraday&startDateIntraday=${fmtD(startDate)}&startHourIntraday=${startDate.getHours()}&startMinuteIntraday=${String(startDate.getMinutes()).padStart(2,'0')}&endDateIntraday=${fmtD(now)}&endHourIntraday=${now.getHours()}&endMinuteIntraday=${String(now.getMinutes()).padStart(2,'0')}`;

        GM_xmlhttpRequest({
            method: 'GET',
            url: fclmUrl,
            timeout: 20000,
            onload: function(resp) {
                const text = resp.responseText || '';
                // CSV has employee-level rows. Get unique employee IDs from column index 3 (Employee ID)
                const lines = text.split('\n');
                const eidSet = new Set();
                for (let i = 1; i < lines.length; i++) {
                    const cells = lines[i].split(',');
                    if (cells.length > 3) {
                        const eid = (cells[3] || '').replace(/"/g, '').trim();
                        if (/^\d{5,12}$/.test(eid)) eidSet.add(eid);
                    }
                }
                const eidList = Array.from(eidSet);
                console.log(`[RCD-LC] Found ${eidList.length} picker employee IDs from FCLM CSV`);

                if (eidList.length === 0) {
                    updatePickLCDisplay(null);
                    return;
                }

                // Now fetch LC data from ADAPT via FCLM proxy approach
                // Use the same GetBatchEmployeePerformanceMetrics endpoint the toolkit uses
                const adaptBase = 'https://adapt-iad.amazon.com';
                const wh = encodeURIComponent(fc.toUpperCase());
                const endIso = now.toISOString();
                const batchStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
                const BATCH_SIZE = 30;
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
                                if (d && d.batchPerformanceMetrics && Object.keys(d.batchPerformanceMetrics).length > 0) {
                                    Object.keys(d.batchPerformanceMetrics).forEach(eid => {
                                        const metrics = d.batchPerformanceMetrics[eid];
                                        if (!Array.isArray(metrics)) return;

                                        let bestLevel = 0;
                                        metrics.forEach(m => {
                                            const attrs = m && m.performanceMetricAttributes;
                                            if (!attrs) return;
                                            const lcStr = attrs.learningCurveId || '';
                                            const lvl = parseInt((lcStr.match(/\d/) || ['0'])[0]) || 0;
                                            if (lvl > bestLevel) bestLevel = lvl;
                                        });

                                        if (!seenEmployees.has(eid)) {
                                            seenEmployees.add(eid);
                                            if (bestLevel >= 1 && bestLevel <= 5) {
                                                lcCounts[bestLevel]++;
                                            } else {
                                                lcCounts.unknown++;
                                            }
                                        }
                                    });
                                } else if (d && d.message) {
                                    // ADAPT returned error — fall back: count all as unknown
                                    console.warn('[RCD-LC] ADAPT error:', d.statusCode, d.message);
                                    batch.forEach(eid => {
                                        if (!seenEmployees.has(eid)) {
                                            seenEmployees.add(eid);
                                            lcCounts.unknown++;
                                        }
                                    });
                                }
                            } catch(e) {
                                console.warn('[RCD-LC] Batch parse error:', e);
                            }

                            completedBatches++;
                            if (completedBatches === batches.length) {
                                console.log('[RCD-LC] All batches done:', JSON.stringify(lcCounts));
                                // If ADAPT failed (all unknown), show the count we have from FCLM
                                const total = lcCounts[1] + lcCounts[2] + lcCounts[3] + lcCounts[4] + lcCounts[5];
                                if (total === 0 && lcCounts.unknown > 0) {
                                    // ADAPT auth failed from Rodeo — display what we know from FCLM
                                    console.log('[RCD-LC] ADAPT unavailable from Rodeo, showing headcount only');
                                    updatePickLCDisplay(null, eidList.length);
                                } else {
                                    updatePickLCDisplay(lcCounts);
                                }
                            }
                        },
                        onerror: function() {
                            completedBatches++;
                            batch.forEach(eid => { if (!seenEmployees.has(eid)) { seenEmployees.add(eid); lcCounts.unknown++; } });
                            if (completedBatches === batches.length) {
                                const total = lcCounts[1] + lcCounts[2] + lcCounts[3] + lcCounts[4] + lcCounts[5];
                                if (total === 0) updatePickLCDisplay(null, eidList.length);
                                else updatePickLCDisplay(lcCounts);
                            }
                        },
                        ontimeout: function() {
                            completedBatches++;
                            batch.forEach(eid => { if (!seenEmployees.has(eid)) { seenEmployees.add(eid); lcCounts.unknown++; } });
                            if (completedBatches === batches.length) {
                                const total = lcCounts[1] + lcCounts[2] + lcCounts[3] + lcCounts[4] + lcCounts[5];
                                if (total === 0) updatePickLCDisplay(null, eidList.length);
                                else updatePickLCDisplay(lcCounts);
                            }
                        }
                    });
                });
            },
            onerror: function() {
                console.warn('[RCD-LC] FCLM CSV fetch failed');
                updatePickLCDisplay(null);
            },
            ontimeout: function() {
                console.warn('[RCD-LC] FCLM CSV fetch timed out');
                updatePickLCDisplay(null);
            }
        });
    }

    function updatePickLCDisplay(lcCounts, headcount) {
        const el = document.getElementById('rcd-lc-display');
        if (!el) return;

        const hcStr = headcount ? `<span style="color:#C3CAD7;">Picking HC: ${headcount}</span>` : '';

        if (!lcCounts) {
            el.innerHTML = hcStr || '<span style="color:#888;">Picking HC: —</span>';
            return;
        }

        const total = lcCounts[1] + lcCounts[2] + lcCounts[3] + lcCounts[4] + lcCounts[5];
        if (total === 0) {
            el.innerHTML = hcStr || '<span style="color:#888;">Picking HC: —</span>';
            return;
        }

        const allTotal = total + lcCounts.unknown;
        const pct = (n) => Math.round((n / allTotal) * 100);
        const parts = [];
        if (lcCounts[5] > 0) parts.push(`<span style="color:#27AE60;font-weight:bold;">LC5 ${pct(lcCounts[5])}%</span>`);
        if (lcCounts[4] > 0) parts.push(`<span style="color:#C3CAD7;">LC4 ${pct(lcCounts[4])}%</span>`);
        if (lcCounts[3] > 0) parts.push(`<span style="color:#eab308;">LC3 ${pct(lcCounts[3])}%</span>`);
        const l12 = lcCounts[1] + lcCounts[2];
        if (l12 > 0) parts.push(`<span style="color:#F2994A;font-weight:bold;">LC1-2 ${pct(l12)}%</span>`);

        // Always show HC + LC mix when available
        el.innerHTML = hcStr + ` <span style="color:#555;">•</span> <span style="color:#C3CAD7;">Learning Curve Mix</span> &nbsp; ${parts.join(' <span style="color:#555;">•</span> ')}`;
    }

    // ─── Scrape Total row units from PredictedCharge & ReadyToPick for Days Backlog ─
    function scrapeWorkPoolTotalUnits(poolName) {
        // Use the same container/children traversal as extractLinks
        const titleSpans = document.querySelectorAll('span.process-path-title');
        if (titleSpans.length === 0) {
            console.log(`[RCD Backlog] No title spans found`);
            return [];
        }

        let container = Array.from(titleSpans).reduce((best, span) => {
            const p = span.parentElement;
            return (!best || p.children.length > best.children.length) ? p : best;
        }, null) || titleSpans[0].parentElement;

        const children = Array.from(container.children);
        let foundPool = false;
        let targetTable = null;

        for (const child of children) {
            const span = child.tagName === 'SPAN' && child.classList.contains('process-path-title')
                ? child : child.querySelector('span.process-path-title');
            if (span) {
                const norm = span.textContent.replace(/[\s_-]/g, '').toLowerCase();
                foundPool = norm.includes(poolName.toLowerCase());
                continue;
            }

            if (foundPool && child.querySelector && child.querySelector('table')) {
                targetTable = child.querySelector('table');
                break;
            }
            if (foundPool && child.tagName === 'TABLE') {
                targetTable = child;
                break;
            }
        }

        if (!targetTable) {
            console.log(`[RCD Backlog] ${poolName} table not found on page`);
            return [];
        }

        // Parse headers to find date/time columns (skip Total, Earlier Total, Range Total, Later Total)
        const headerRow = targetTable.querySelector('thead tr, tr.header-row') || targetTable.querySelector('tr');
        if (!headerRow) return [];
        const headers = Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.replace(/\s+/g, ' ').trim());

        // Find the Total row
        let totalRow = targetTable.querySelector('tr.grand-total');
        if (!totalRow) {
            const allRows = targetTable.querySelectorAll('tbody tr, tr');
            for (const row of allRows) {
                const firstCell = row.querySelector('td, th');
                if (firstCell && firstCell.textContent.trim() === 'Total') { totalRow = row; break; }
            }
        }
        if (!totalRow) {
            console.log(`[RCD Backlog] No Total row found in ${poolName} table`);
            return [];
        }

        const totalCells = Array.from(totalRow.querySelectorAll('td, th'));

        // Collect all numeric values from date/time columns in the Total row
        // Skip non-date columns: first column (process path name), "Total", "Earlier Total", "Range Total", "Later Total"
        const skipHeaders = ['total', 'earliertotal', 'rangetotal', 'latertotal', ''];
        const values = [];
        headers.forEach((h, i) => {
            const norm = h.replace(/[\s_-]/g, '').toLowerCase();
            if (skipHeaders.includes(norm)) return;
            if (i === 0) return; // skip first column (row label)
            if (totalCells[i]) {
                const text = totalCells[i].textContent.trim().replace(/,/g, '');
                const val = parseInt(text, 10) || 0;
                values.push(val);
            }
        });

        console.log(`[RCD Backlog] ${poolName} Total row values (${values.length}):`, values.filter(v => v > 1000));
        return values;
    }

    function calculateDaysBacklog() {
        // Get PNYP units from the "Range Total" column of the PickingNotYetPicked table
        const titleSpans = document.querySelectorAll('span.process-path-title');
        if (titleSpans.length === 0) return 'N/A';

        let container = Array.from(titleSpans).reduce((best, span) => {
            const p = span.parentElement;
            return (!best || p.children.length > best.children.length) ? p : best;
        }, null) || titleSpans[0].parentElement;

        const children = Array.from(container.children);
        let foundPNYP = false;
        let pnypTable = null;

        for (const child of children) {
            const span = child.tagName === 'SPAN' && child.classList.contains('process-path-title')
                ? child : child.querySelector('span.process-path-title');
            if (span) {
                const norm = span.textContent.replace(/[\s_-]/g, '').toLowerCase();
                foundPNYP = norm.includes('pickingnotyetpicked');
                continue;
            }

            if (foundPNYP && child.querySelector && child.querySelector('table')) {
                pnypTable = child.querySelector('table');
                break;
            }
            if (foundPNYP && child.tagName === 'TABLE') {
                pnypTable = child;
                break;
            }
        }

        let pnypUnits = 0;
        if (pnypTable) {
            const headerRow = pnypTable.querySelector('thead tr, tr.header-row') || pnypTable.querySelector('tr');
            const headers = headerRow ? Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.replace(/\s+/g, ' ').trim()) : [];
            // Find "Range Total" column index
            let rangeTotalIdx = headers.findIndex(h => h.replace(/[\s_-]/g, '').toLowerCase() === 'rangetotal');
            // Fallback: use "Total" column
            if (rangeTotalIdx < 0) rangeTotalIdx = headers.findIndex(h => h.replace(/[\s_-]/g, '').toLowerCase() === 'total');

            let totalRow = pnypTable.querySelector('tr.grand-total');
            if (!totalRow) {
                const allRows = pnypTable.querySelectorAll('tbody tr, tr');
                for (const row of allRows) {
                    const firstCell = row.querySelector('td, th');
                    if (firstCell && firstCell.textContent.trim() === 'Total') { totalRow = row; break; }
                }
            }
            if (totalRow && rangeTotalIdx >= 0) {
                const cells = Array.from(totalRow.querySelectorAll('td, th'));
                if (cells[rangeTotalIdx]) {
                    pnypUnits = parseInt(cells[rangeTotalIdx].textContent.trim().replace(/,/g, ''), 10) || 0;
                }
            }
        }
        console.log('[RCD Backlog] PNYP units:', pnypUnits);

        if (pnypUnits === 0) return '0.00';

        // Get PredictedCharge Total row values > 5000
        const pcValues = scrapeWorkPoolTotalUnits('predictedcharge').filter(v => v > 5000);
        // Get ReadyToPick Total row values > 5000
        const rtpValues = scrapeWorkPoolTotalUnits('readytopick').filter(v => v > 5000);

        console.log('[RCD Backlog] PredictedCharge values > 1000:', pcValues);
        console.log('[RCD Backlog] ReadyToPick values > 1000:', rtpValues);

        // Combine all qualifying values and average them
        const allValues = [...pcValues, ...rtpValues];
        if (allValues.length === 0) return 'N/A';

        const avg = allValues.reduce((s, v) => s + v, 0) / allValues.length;
        const backlog = (pnypUnits / avg).toFixed(2);
        console.log('[RCD Backlog] Days Backlog:', backlog, '(PNYP:', pnypUnits, '/ avg:', Math.round(avg), ', from', allValues.length, 'values)');
        return backlog;
    }

    function extractLinks() {
        const cptLinks = {};
        const cptCounts = {}; // direct counts for cells without links: cptCounts[cptLabel][group] = count
        const ppData = {};  // process path breakdown: ppData[cptLabel][group] = { pathName: count, ... }
        const debugInfo = [];
        const titleSpans = document.querySelectorAll('span.process-path-title');
        debugInfo.push(`Pool title spans found: ${titleSpans.length}`);
        if (titleSpans.length === 0) return { cptLinks, cptCounts, ppData, debugInfo };

        let container = Array.from(titleSpans).reduce((best, span) => {
            const p = span.parentElement;
            return (!best || p.children.length > best.children.length) ? p : best;
        }, null) || titleSpans[0].parentElement;
        debugInfo.push(`Container children: ${container.children.length}`);

        const children = Array.from(container.children);
        let currentGroup = null;

        children.forEach((child) => {
            const span = child.tagName === 'SPAN' && child.classList.contains('process-path-title')
                ? child : child.querySelector('span.process-path-title');
            if (span) {
                currentGroup = matchPoolGroup(span.textContent.trim());
                return;
            }

            if ((child.classList.contains('table-wrapper') || (child.tagName !== 'TABLE' && child.querySelector && child.querySelector('table'))) && currentGroup) {
                const table = child.querySelector('table');
                if (!table) return;
                const headerRow = table.querySelector('thead tr, tr.header-row') || table.querySelector('tr');
                if (!headerRow) return;
                const headers = Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.replace(/\s+/g, ' ').trim());
                const cptIndices = [];
                headers.forEach((h, i) => { if (/[A-Za-z]{3}\s+\d{1,2}/.test(h) && /\d{1,2}:\d{2}/.test(h)) cptIndices.push(i); });
                if (cptIndices.length === 0) return;
                let totalRow = table.querySelector('tr.grand-total');
                if (!totalRow) {
                    const allRows = table.querySelectorAll('tbody tr, tr');
                    for (const row of allRows) {
                        const firstCell = row.querySelector('td, th');
                        if (firstCell && firstCell.textContent.trim() === 'Total') { totalRow = row; break; }
                    }
                }
                if (!totalRow) return;
                const cells = Array.from(totalRow.querySelectorAll('td, th'));
                cptIndices.forEach(ci => {
                    const cptLabel = headers[ci];
                    const link = cells[ci] && cells[ci].querySelector('a');
                    if (link && link.href) {
                        if (!cptLinks[cptLabel]) cptLinks[cptLabel] = {};
                        if (!cptLinks[cptLabel][currentGroup]) cptLinks[cptLabel][currentGroup] = link.href;
                    } else if (cells[ci]) {
                        // No link — read count directly from cell text
                        const cellVal = parseInt((cells[ci].textContent || '0').replace(/,/g, ''), 10) || 0;
                        if (cellVal > 0) {
                            if (!cptCounts[cptLabel]) cptCounts[cptLabel] = {};
                            if (!cptCounts[cptLabel][currentGroup]) cptCounts[cptLabel][currentGroup] = cellVal;
                        }
                    }
                });
                // Extract process path breakdown from non-total rows
                table.querySelectorAll('tbody tr:not(.grand-total)').forEach(row => {
                    const rowCells = Array.from(row.querySelectorAll('td, th'));
                    const pathName = rowCells[0] && rowCells[0].textContent.trim();
                    if (!pathName || pathName === 'Total') return;
                    cptIndices.forEach(ci => {
                        const cptLabel = headers[ci];
                        const link = rowCells[ci] && rowCells[ci].querySelector('a');
                        if (link && link.href) {
                            if (!ppData[cptLabel]) ppData[cptLabel] = {};
                            if (!ppData[cptLabel][currentGroup]) ppData[cptLabel][currentGroup] = {};
                            ppData[cptLabel][currentGroup][pathName] = { units: parseInt((rowCells[ci].textContent || '0').replace(/,/g, ''), 10), url: link.href };
                        } else if (rowCells[ci]) {
                            const val = parseInt((rowCells[ci].textContent || '0').replace(/,/g, ''), 10);
                            if (val > 0) {
                                if (!ppData[cptLabel]) ppData[cptLabel] = {};
                                if (!ppData[cptLabel][currentGroup]) ppData[cptLabel][currentGroup] = {};
                                ppData[cptLabel][currentGroup][pathName] = { units: val, url: '', count: val };
                            }
                        }
                    });
                });
            }

            if (child.tagName === 'TABLE' && currentGroup) {
                const headerRow = child.querySelector('thead tr, tr.header-row');
                if (!headerRow) return;
                const headers = Array.from(headerRow.querySelectorAll('th, td')).map(c => c.textContent.replace(/\s+/g, ' ').trim());
                const cptIndices = [];
                headers.forEach((h, i) => { if (/[A-Za-z]{3}\s+\d{1,2}/.test(h) && /\d{1,2}:\d{2}/.test(h)) cptIndices.push(i); });
                if (cptIndices.length === 0) return;
                let totalRow = child.querySelector('tr.grand-total');
                if (!totalRow) {
                    const allRows = child.querySelectorAll('tbody tr, tr');
                    for (const row of allRows) {
                        const firstCell = row.querySelector('td, th');
                        if (firstCell && firstCell.textContent.trim() === 'Total') { totalRow = row; break; }
                    }
                }
                if (!totalRow) return;
                const cells = Array.from(totalRow.querySelectorAll('td, th'));
                cptIndices.forEach(ci => {
                    const cptLabel = headers[ci];
                    const link = cells[ci] && cells[ci].querySelector('a');
                    if (link && link.href) {
                        if (!cptLinks[cptLabel]) cptLinks[cptLabel] = {};
                        if (!cptLinks[cptLabel][currentGroup]) cptLinks[cptLabel][currentGroup] = link.href;
                    } else if (cells[ci]) {
                        const cellVal = parseInt((cells[ci].textContent || '0').replace(/,/g, ''), 10) || 0;
                        if (cellVal > 0) {
                            if (!cptCounts[cptLabel]) cptCounts[cptLabel] = {};
                            if (!cptCounts[cptLabel][currentGroup]) cptCounts[cptLabel][currentGroup] = cellVal;
                        }
                    }
                });
                // Extract process path breakdown
                child.querySelectorAll('tbody tr:not(.grand-total)').forEach(row => {
                    const rowCells = Array.from(row.querySelectorAll('td, th'));
                    const pathName = rowCells[0] && rowCells[0].textContent.trim();
                    if (!pathName || pathName === 'Total') return;
                    cptIndices.forEach(ci => {
                        const cptLabel = headers[ci];
                        const link = rowCells[ci] && rowCells[ci].querySelector('a');
                        if (link && link.href) {
                            if (!ppData[cptLabel]) ppData[cptLabel] = {};
                            if (!ppData[cptLabel][currentGroup]) ppData[cptLabel][currentGroup] = {};
                            ppData[cptLabel][currentGroup][pathName] = { units: parseInt((rowCells[ci].textContent || '0').replace(/,/g, ''), 10), url: link.href };
                        } else if (rowCells[ci]) {
                            const val = parseInt((rowCells[ci].textContent || '0').replace(/,/g, ''), 10);
                            if (val > 0) {
                                if (!ppData[cptLabel]) ppData[cptLabel] = {};
                                if (!ppData[cptLabel][currentGroup]) ppData[cptLabel][currentGroup] = {};
                                ppData[cptLabel][currentGroup][pathName] = { units: val, url: '', count: val };
                            }
                        }
                    });
                });
            }
        });

        debugInfo.push(`CPT keys: ${Object.keys(cptLinks).length}`);
        debugInfo.push(`Direct count keys: ${Object.keys(cptCounts).length}`);
        console.log('[RCD DEBUG] cptLinks:', JSON.stringify(Object.keys(cptLinks)));
        console.log('[RCD DEBUG] cptCounts:', JSON.stringify(cptCounts));
        return { cptLinks, cptCounts, ppData, debugInfo };
    }

    // ─── Dynamic font scaling ────────────────────────────────────────────────────
    // Counts total visible rows (group rows + process path sub-rows) to scale fonts
    function calcDashScale(ppData, cptLinks, cptCounts) {
        let totalRows = 0;
        const allCPTs = new Set([...Object.keys(cptLinks), ...Object.keys(cptCounts)]);
        // Count group rows that have data
        GROUP_ORDER.forEach(() => totalRows++);
        // Count process path sub-rows across all groups/CPTs
        const seenPaths = new Set();
        allCPTs.forEach(cpt => {
            GROUP_ORDER.forEach(group => {
                const paths = ppData[cpt] && ppData[cpt][group];
                if (paths) {
                    Object.keys(paths).forEach(p => {
                        const key = group + '|' + p;
                        if (!seenPaths.has(key)) { seenPaths.add(key); totalRows++; }
                    });
                }
            });
        });
        // Gentle scale: few rows (<=25) = full size, many rows (>=80) = 0.75x
        // This keeps text readable while tightening spacing for dense FCs
        const minRows = 25, maxRows = 80;
        const clamped = Math.max(minRows, Math.min(maxRows, totalRows));
        const scale = 1.0 - (clamped - minRows) / (maxRows - minRows) * 0.25;
        return { scale, totalRows };
    }

    // ─── CSS ──────────────────────────────────────────────────────────────────────
    // CSS uses custom properties for font sizes so they can be adjusted dynamically
    const CSS = `
    #rodeo-cpt-dash {
        position: fixed; top: 0; right: 0; z-index: 99999;
        font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px;
        width: fit-content; max-width: 100vw; max-height: 100vh; overflow-y: auto; overflow-x: auto;
        box-sizing: border-box;
        transform-origin: top right;
        transition: border-color 0.2s, box-shadow 0.2s, border-radius 0.2s;
        --rcd-font-title: 18px;
        --rcd-font-meta: 13px;
        --rcd-font-section: 26px;
        --rcd-font-table: 13px;
        --rcd-font-btn: 14px;
        --rcd-font-subrow: 1em;
        --rcd-pad-cell: 4px 8px;
        --rcd-pad-th: 6px 10px;
        --rcd-pad-subrow: 2px 8px;
    }
    #rodeo-cpt-dash.collapsed .rcd-body { display: none; }
    #rodeo-cpt-dash.collapsed { border-radius: 8px; width: auto; display: inline-block; position: fixed; top: 8px; right: 8px; left: auto; z-index: 99999; }
    #rodeo-cpt-dash.collapsed #rcd-header { padding: 6px 10px; background: rgba(30,30,46,0.95); border-radius: 8px; }
    #rodeo-cpt-dash.collapsed #rcd-header .rcd-header-center { display: none !important; }
    #rodeo-cpt-dash.collapsed #rcd-header .rcd-btns { position: static; transform: none; }
    #rcd-header {
        background: #2A2D3E; padding: 14px 16px 10px;
        display: flex; justify-content: center; align-items: center;
        border-radius: inherit; border-bottom-left-radius: 0; border-bottom-right-radius: 0;
        position: sticky; top: 0; z-index: 2; cursor: default;
        position: relative; min-height: 70px;
    }
    #rcd-header .rcd-header-center { text-align: center; max-width: calc(100% - 160px); }
    #rcd-header .title { font-weight: bold; font-size: 20px; color: #F2F5FA; white-space: nowrap; }
    #rcd-header .meta  { font-size: 13px; color: #888; margin-top: 2px; white-space: nowrap; }
    .rcd-btns { display: flex; flex-direction: column; gap: 4px; align-items: center; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); }
    .rcd-btn {
        cursor: pointer; background: #4A72C9; color: #F2F5FA;
        border: none; border-radius: 6px; padding: 6px 12px; font-size: 12px; font-weight: bold;
        transition: background 0.2s; white-space: nowrap;
    }
    .rcd-btn:hover { background: #5a82d9; }
    .rcd-btn.refresh { background: #4A72C9; color: #F2F5FA; }
    .rcd-btn.refresh:hover { background: #5a82d9; }
    .rcd-btn.debug-btn { background: #161b22; color: #f9e2af; }
    .rcd-body { padding: 10px; background: #0d1117; }
    .rcd-section-title {
        font-weight: bold; font-size: var(--rcd-font-section); color: #f9e2af;
        margin: 24px 0 10px; padding: 12px 0 10px;
        border-top: 3px solid #f9e2af;
        border-bottom: 2px solid #f9e2af;
        letter-spacing: 0.5px;
    }
    .rcd-section-title.next { color: #89b4fa; border-top-color: #89b4fa; border-bottom-color: #89b4fa; }
    .rcd-section-title.summary { color: #f38ba8; border-top-color: #f38ba8; border-bottom-color: #f38ba8; }
    .rcd-section-title .rcd-chevron { display: inline-block; width: 1em; transition: transform 0.2s; }
    .rcd-section-title:hover { opacity: 0.85; }
    .rcd-collapsible { transition: all 0.2s; }
    .rcd-wrap { overflow-x: auto; margin-bottom: 12px; max-width: 100%; border: 3px solid #89b4fa; border-radius: 6px; padding: 4px; }
    .rcd-wrap.rcd-wrap-summary { border-color: #f38ba8; }
    .rcd-wrap.rcd-wrap-current { border-color: #f9e2af; }
    .rcd-wrap.rcd-wrap-next { border-color: #89b4fa; }
    table.rcd-tbl { width: auto; border-collapse: separate; border-spacing: 0; font-size: var(--rcd-font-table); color: #ffffff; font-weight: bold; }
    table.rcd-tbl th {
        background: #161b22; color: #ffffff; padding: var(--rcd-pad-th);
        text-align: center; white-space: nowrap;
        border-left: 4px solid #0d1117;
    }
    table.rcd-tbl th:first-child { border-left: none; }
    table.rcd-tbl th:nth-child(2) { border-left: none; }
    table.rcd-tbl th.lbl-hdr { background: #161b22; text-align: left; min-width: 120px; border-left: none; }
    table.rcd-tbl td {
        padding: var(--rcd-pad-cell); border-bottom: 1px solid #21262d;
        text-align: right; white-space: nowrap; color: #ffffff;
        border-left: 4px solid #0d1117;
    }
    table.rcd-tbl td:first-child { border-left: none; }
    table.rcd-tbl td:nth-child(2) { border-left: none; }
    table.rcd-tbl td.label-cell { text-align: left; color: #ffffff; font-weight: bold; background: #0d1117; border-left: none; text-decoration: underline; text-underline-offset: 4px; font-size: 1.1em; }
    table.rcd-tbl td.total-cell { color: #ffffff; font-weight: bold; background: #0d1117; }
    table.rcd-tbl tr:hover td { background: #161b22; }
    table.rcd-tbl tr.total-row td { background: #161b22; font-weight: bold; border-top: 1px solid #21262d; }
    table.rcd-tbl tr.total-row td.label-cell { color: #f38ba8; }
    table.rcd-tbl tr.rcd-group-row td { border-top: 4px solid #89b4fa !important; }
    .rcd-wrap-summary table.rcd-tbl tr.rcd-group-row td { border-top-color: #f38ba8 !important; }
    .rcd-wrap-current table.rcd-tbl tr.rcd-group-row td { border-top-color: #f9e2af !important; }
    .rcd-wrap-next table.rcd-tbl tr.rcd-group-row td { border-top-color: #89b4fa !important; }
    table.rcd-tbl tbody.rcd-group-section {
    }
    table.rcd-tbl tbody.rcd-group-section tr:first-child td {
        padding-top: 8px;
    }
    table.rcd-tbl tbody.rcd-group-section tr:last-child td {
        padding-bottom: 8px;
    }
    .rcd-rtp, .rcd-pnyp, .rcd-pp, .rcd-ind, .rcd-pak, .rcd-xdk, .rcd-tss, .rcd-pal, .rcd-mp { color: #ffffff; }
    .rcd-no-data { color: #ffffff; padding: 16px; text-align: center; font-style: italic; opacity: 0.6; }
    table.rcd-tbl a { color: #ffffff; text-decoration: underline dotted; }
    table.rcd-tbl a:hover { opacity: 0.8; }
    .rcd-cpt-past td { opacity: 0.45; }
    .rcd-cpt-current td { background: #1e3a1e !important; }
    .rcd-debug {
        background: #0d1117; border: 1px solid #21262d; border-radius: 4px;
        padding: 8px; margin-top: 8px; font-size: 10px; color: #ffffff;
        white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto;
    }
    /* style panel */
    #rcd-style-panel {
        background: var(--rcd-hdr); border: 1px solid var(--rcd-td-bdr);
        border-radius: 6px; padding: 8px 12px; margin-bottom: 8px;
        display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
    }
    #rcd-style-panel label { font-size: 11px; color: var(--rcd-meta); }
    #rcd-style-panel select {
        background: var(--rcd-btn); color: var(--rcd-text);
        border: 1px solid var(--rcd-td-bdr); border-radius: 4px;
        padding: 2px 6px; font-size: 11px; cursor: pointer; margin-left: 4px;
    }
    .rcd-swatches { display: flex; gap: 5px; margin-left: 4px; }
    .rcd-swatch {
        width: 16px; height: 16px; border-radius: 50%; cursor: pointer;
        border: 2px solid transparent; box-sizing: border-box;
    }
    .rcd-swatch.active { border-color: #fff; }
    `;

    // ─── Build summary totals table (Picking Not Yet Picked + Picking Picked) ─────
    function buildTotalsTable(cases, loading, shiftStart) {
        const SUMMARY_GROUPS = ['Picking Not Yet Picked', 'Picking Picked'];
        const now = new Date();
        const cutoff = shiftStart || new Date(now.getTime() - 12 * 3600000);
        const allCPTs = Object.keys(cases).sort((a, b) => parseCPTDate(a) - parseCPTDate(b)).filter(cpt => {
            const d = parseCPTDate(cpt);
            // Keep if: not parseable, or CPT is after shift start
            // Exclude 11:00 CPTs (removal/donation work)
            if (d && d.getHours() === 11 && d.getMinutes() === 0) return false;
            return !d || d >= cutoff;
        });
        if (allCPTs.length === 0 && !loading) return '';

        const totals = {};
        SUMMARY_GROUPS.forEach(g => {
            totals[g] = { cpts: {}, rowTotal: 0 };
            allCPTs.forEach(cpt => {
                const e = cases[cpt] && cases[cpt][g];
                const v = e ? (e.count !== undefined ? e.count : e) : 0;
                totals[g].cpts[cpt] = { val: v, url: e && e.url };
                totals[g].rowTotal += v;
            });
        });
        const combinedTotal = SUMMARY_GROUPS.reduce((s, g) => s + totals[g].rowTotal, 0);

        const t = THEMES[curTheme] || THEMES['Dark'];

        // Check for past-due CPTs (expired with remaining cases)
        const hasPastDue = !loading && allCPTs.some(cpt => {
            const d = parseCPTDate(cpt);
            if (!d || d >= now) return false;
            const colTotal = SUMMARY_GROUPS.reduce((s, g) => s + (totals[g].cpts[cpt]?.val || 0), 0);
            return colTotal > 0;
        });

        const headerCells = allCPTs.map(cpt => {
            const d = parseCPTDate(cpt);
            const past = d && d < now, cur = d && d <= now && now < new Date(d.getTime() + 3600000);
            const colTotal = SUMMARY_GROUPS.reduce((s, g) => s + (totals[g].cpts[cpt]?.val || 0), 0);
            const pastDue = past && colTotal > 0;
            const style = pastDue ? `background:${t.riskHdr};color:${t.trowLbl};font-weight:bold`
                : past && !cur ? 'opacity:0.5' : cur ? `background:${t.curCell}` : '';
            return `<th style="${style}">${d ? fmtTime(d) : cpt}${cur ? ' ◀' : ''}${pastDue ? ' PAST DUE' : ''}</th>`;
        }).join('');

        const groupRows = SUMMARY_GROUPS.map(g => {
            const cls = GROUP_CLASS[g] || '';
            const cells = allCPTs.map(cpt => {
                const d = parseCPTDate(cpt);
                const past = d && d < now, cur = d && d <= now && now < new Date(d.getTime() + 3600000);
                const { val, url } = totals[g].cpts[cpt] || { val: 0 };
                const colTotal = SUMMARY_GROUPS.reduce((s, gg) => s + (totals[gg].cpts[cpt]?.val || 0), 0);
                const pastDue = past && colTotal > 0;
                const disp = loading ? '<span style="opacity:0.4">…</span>'
                    : val > 0 ? (url ? `<a href="${forceTransshipments(url)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${val.toLocaleString()}</a>` : val.toLocaleString())
                    : '<span style="opacity:0.3">—</span>';
                const cellStyle = pastDue ? `background:${t.riskCell};color:${t.trowLbl};font-weight:bold`
                    : past && !cur ? 'opacity:0.5' : cur ? `background:${t.curCell}` : '';
                return `<td class="${cls}" style="${cellStyle}">${disp}</td>`;
            }).join('');
            const rowDisp = loading ? '…' : totals[g].rowTotal > 0 ? totals[g].rowTotal.toLocaleString() : '—';
            return `<tr><td class="label-cell">${g}</td>${cells}<td class="total-cell ${cls}">${rowDisp}</td></tr>`;
        }).join('');

        const combinedCells = allCPTs.map(cpt => {
            const d = parseCPTDate(cpt);
            const past = d && d < now, cur = d && d <= now && now < new Date(d.getTime() + 3600000);
            const colTotal = SUMMARY_GROUPS.reduce((s, g) => s + (totals[g].cpts[cpt]?.val || 0), 0);
            const pastDue = past && colTotal > 0;
            const disp = loading ? '…' : colTotal > 0 ? colTotal.toLocaleString() : '—';
            const cellStyle = pastDue ? `background:${t.riskCell};color:${t.trowLbl};font-weight:bold`
                : past && !cur ? 'opacity:0.5' : cur ? `background:${t.curCell}` : '';
            return `<td style="color:${t.totClr};font-weight:bold;${cellStyle}">${disp}</td>`;
        }).join('');

        const grandDisp = loading ? '…' : combinedTotal > 0 ? combinedTotal.toLocaleString() : '—';
        return `<div class="rcd-wrap rcd-wrap-summary"><table class="rcd-tbl">
            <thead><tr><th class="lbl-hdr">Work Pool</th>${headerCells}<th style="color:${t.totClr}">Total</th></tr></thead>
            <tbody>${groupRows}
            <tr class="total-row"><td class="label-cell">COMBINED</td>${combinedCells}
            <td class="total-cell" style="color:${t.trowLbl}">${grandDisp}</td></tr>
            </tbody></table></div>`;
    }

    // ─── Build one shift table ────────────────────────────────────────────────────
    // Scrape ManifestPending directly from the page — returns { time, count, url, paths: { name: { count, url } } }
    function scrapeManifestPending() {
        const result = { time: '', count: 0, url: '', paths: {} };

        // Brute force: search ALL tables on the page for one containing a ManifestPending link
        const allTables = document.querySelectorAll('table');
        for (const table of allTables) {
            const mpLink = table.querySelector('a[href*="ManifestPending"]');
            if (!mpLink) continue;

            // Found a table with ManifestPending links — parse it
            const rows = Array.from(table.querySelectorAll('tr'));
            if (rows.length < 2) continue;

            // First row = headers
            const hdrRow = rows[0];
            const headers = Array.from(hdrRow.querySelectorAll('th, td')).map(c => c.textContent.replace(/\s+/g, ' ').trim());

            // Find the date+time column index (e.g., "Apr 24 04:30")
            let ti = -1;
            headers.forEach((h, i) => {
                if (ti === -1 && /[A-Za-z]{3}\s+\d{1,2}/.test(h) && /\d{1,2}:\d{2}/.test(h)) ti = i;
            });
            if (ti === -1) continue;

            result.time = headers[ti];

            // Parse data rows
            for (let r = 1; r < rows.length; r++) {
                const cells = Array.from(rows[r].querySelectorAll('td, th'));
                if (cells.length <= ti) continue;
                const label = (cells[0] ? cells[0].textContent.trim() : '');
                if (!label) continue;
                const val = parseInt((cells[ti].textContent || '0').replace(/,/g, ''), 10) || 0;
                const link = cells[ti].querySelector('a');
                const url = link ? link.href : '';
                if (label === 'Total') {
                    result.count = val;
                    result.url = url;
                } else if (val > 0) {
                    result.paths[label] = { count: val, url };
                }
            }
            break;
        }
        return result;
    }

    function buildCPTTable(cpts, shiftStart, shiftEnd, loading, isNextShift, ppData, pickerData, fc, mpResult) {
        const now = new Date();
        const t = THEMES[curTheme] || THEMES['Dark'];
        const shiftCPTs = Object.keys(cpts).filter(cpt => {
            const d = parseCPTDate(cpt);
            // Exclude 11:00 CPTs (removal/donation work)
            if (d && d.getHours() === 11 && d.getMinutes() === 0) return false;
            return d && d >= shiftStart && d < shiftEnd;
        }).sort((a, b) => parseCPTDate(a) - parseCPTDate(b)).filter(cpt => {
            const colTotal = GROUP_ORDER.reduce((s, g) => {
                const e = cpts[cpt] && cpts[cpt][g];
                return s + (e ? (e.count !== undefined ? e.count : e) : 0);
            }, 0);
            return colTotal > 0;
        });

        if (shiftCPTs.length === 0) {
            return `<div class="rcd-no-data">No CPTs in window ${fmtTime(shiftStart)}–${fmtTime(shiftEnd)}</div>`;
        }

        // Check if any CPT in this table is at risk — calculate FIRST
        const tableAtRisk = !loading && shiftCPTs.some(cpt => {
            const d = parseCPTDate(cpt);
            if (!d) return false;
            const past = d < now;
            const minsUntil = (d - now) / 60000;
            const col = GROUP_ORDER.reduce((s, g) => {
                const e = cpts[cpt] && cpts[cpt][g];
                return s + (e ? (e.count !== undefined ? e.count : e) : 0);
            }, 0);
            return !past && minsUntil <= 60 && col > 0;
        });
        const riskBg = tableAtRisk ? `background:${t.riskCell};` : '';
        const riskHdrBg = tableAtRisk ? `background:${t.riskHdr};` : '';
        const riskClr = tableAtRisk ? `color:${t.trowLbl};` : '';
        const riskLblClr = tableAtRisk ? `color:#ffffff;` : '';

        // Pre-calculate which CPTs are past due (expired with remaining cases)
        const pastDueCPTs = new Set();
        if (!loading) {
            shiftCPTs.forEach(cpt => {
                const d = parseCPTDate(cpt);
                if (!d) return;
                const past = d < now;
                const colTotal = GROUP_ORDER.reduce((s, g) => {
                    const e = cpts[cpt] && cpts[cpt][g];
                    return s + (e ? (e.count !== undefined ? e.count : e) : 0);
                }, 0);
                if (past && colTotal > 0) pastDueCPTs.add(cpt);
            });
        }

        const headerCells = shiftCPTs.map(cpt => {
            const d = parseCPTDate(cpt);
            const past = d < now, cur = d <= now && now < new Date(d.getTime() + 3600000);
            const minsUntil = (d - now) / 60000;
            const atRisk = !past && minsUntil <= 60 && GROUP_ORDER.some(g => {
                const e = cpts[cpt] && cpts[cpt][g];
                return (e ? (e.count !== undefined ? e.count : e) : 0) > 0;
            });
            const style = tableAtRisk ? `${riskHdrBg}${riskClr}font-weight:bold`
                : atRisk ? `background:${t.riskHdr};color:${t.trowLbl};font-weight:bold`
                : past && !cur ? 'opacity:0.5' : '';
            const colTotal = GROUP_ORDER.reduce((s, g) => {
                const e = cpts[cpt] && cpts[cpt][g];
                return s + (e ? (e.count !== undefined ? e.count : e) : 0);
            }, 0);
            const pastDue = past && colTotal > 0;
            const hdrStyle = pastDue ? `background:${t.riskHdr};color:${t.trowLbl};font-weight:bold` : style;
            return `<th style="${hdrStyle}">${fmtTime(d)}${cur ? ' ◀' : ''}${atRisk ? ' ⚠' : ''}${pastDue ? ' PAST DUE' : ''}</th>`;
        }).join('');

        const groupRows = GROUP_ORDER.map(group => {
            const cls = GROUP_CLASS[group] || '';
            const rowTotal = shiftCPTs.reduce((s, c) => {
                const e = cpts[c] && cpts[c][group];
                return s + (e ? (e.count !== undefined ? e.count : e) : 0);
            }, 0);
            if (!loading && rowTotal === 0) return '';
            const cells = shiftCPTs.map(cpt => {
                const d = parseCPTDate(cpt);
                const past = d < now, cur = d <= now && now < new Date(d.getTime() + 3600000);
                const minsUntil = (d - now) / 60000;
                const entry = cpts[cpt] && cpts[cpt][group];
                const val = entry ? (entry.count !== undefined ? entry.count : entry) : 0;
                const url = entry && entry.url;
                const atRisk = !past && !cur && minsUntil <= 60 && val > 0;
                const numStr = val > 0 ? val.toLocaleString() : null;
                const disp = loading ? '<span style="opacity:0.4">…</span>'
                    : numStr ? (url ? `<a href="${forceTransshipments(url)}" target="_blank" style="color:inherit;text-decoration:underline dotted">${numStr}</a>` : numStr)
                    : '<span style="opacity:0.3">—</span>';
                const cellStyle = tableAtRisk ? `${riskBg}${riskClr}font-weight:bold`
                    : pastDueCPTs.has(cpt) ? `background:${t.riskCell};color:${t.trowLbl};font-weight:bold`
                    : atRisk ? `background:${t.riskCell};color:${t.trowLbl};font-weight:bold`
                    : past && !cur ? 'opacity:0.5' : cur ? `background:${t.curCell}` : 'color:#58a6ff';
                return `<td class="${cls}" style="${cellStyle}">${disp}${atRisk ? ' ⚠' : ''}</td>`;
            }).join('');
            const totalDisp = loading ? '…' : rowTotal > 0 ? rowTotal.toLocaleString() : '—';

            // Build process path sub-rows
            let destRows = '';
            if (!loading && ppData) {
                const allPaths = new Map();
                shiftCPTs.forEach(cpt => {
                    const paths = ppData[cpt] && ppData[cpt][group];
                    if (paths) {
                        Object.entries(paths).forEach(([path, data]) => {
                            const val = typeof data === 'object' ? (data.count || 0) : (typeof data === 'number' ? data : 0);
                            const url = typeof data === 'object' ? (data.url || '') : '';
                            if (val > 0) {
                                if (!allPaths.has(path)) allPaths.set(path, {});
                                allPaths.get(path)[cpt] = { count: val, url };
                            }
                        });
                    }
                });
                if (allPaths.size > 0) {
                    const sorted = Array.from(allPaths.entries()).map(([path, cptCounts]) => {
                        const total = Object.values(cptCounts).reduce((s, v) => s + v.count, 0);
                        return { path, cptCounts, total };
                    }).sort((a, b) => b.total - a.total);

                    sorted.forEach(({ path, cptCounts, total }) => {
                        const pathCells = shiftCPTs.map(cpt => {
                            const d = cptCounts[cpt];
                            if (!d || d.count === 0) return `<td style="text-align:right;padding:0.1em 0.4em;"></td>`;
                            const disp = d.count.toLocaleString();
                            const content = d.url
                                ? `<a href="${forceTransshipments(d.url)}" target="_blank" style="color:#e8e8e8;text-decoration:underline dotted;font-size:1.15em;">${disp}</a>`
                                : disp;
                            return `<td style="text-align:right;padding:0.1em 0.4em;color:#e8e8e8;font-size:1.15em;">${content}</td>`;
                        }).join('');
                        // Active pickers cell for PNYP paths
                        let pickerDisp = '';
                        if (group === 'Picking Not Yet Picked' && pickerData) {
                            const pc = pickerData[path];
                            if (pc !== undefined && pc > 0) {
                                pickerDisp = `<span style="color:#a6e3a1;font-weight:bold;">${pc}</span>`;
                            }
                        }
                        // Destination warehouse IDs with counts for Picking Picked and PNYP paths
                        let destDisp = '';
                        if (group === 'Picking Picked' || group === 'Picking Not Yet Picked') {
                            const mergedDests = {};
                            shiftCPTs.forEach(cpt => {
                                const ppEntry = ppData[cpt] && ppData[cpt][group] && ppData[cpt][group][path];
                                if (ppEntry && ppEntry.destWarehouses) {
                                    for (const [wh, cnt] of Object.entries(ppEntry.destWarehouses)) {
                                        mergedDests[wh] = (mergedDests[wh] || 0) + cnt;
                                    }
                                }
                            });
                            const entries = Object.entries(mergedDests).sort((a, b) => b[1] - a[1]);
                            if (entries.length > 0) {
                                const parts = entries.map(([wh, cnt]) => `${wh}: ${cnt.toLocaleString()}`);
                                destDisp = ` <span style="color:#f9e2af;font-size:1.15em;font-weight:bold;">[${parts.join(', ')}]</span>`;
                            }
                        }
                        destRows += `<tr style="background:rgba(255,255,255,0.03)"><td style="padding-left:1em;color:#e8e8e8;font-size:1.15em;">↳ ${path}${destDisp}</td><td style="text-align:center;">${pickerDisp}</td>${pathCells}<td style="text-align:right;padding:0.1em 0.4em;color:#e8e8e8;font-size:1.15em;">${total.toLocaleString()}</td></tr>`;
                    });
                }
            }

            return `<tbody class="rcd-group-section"><tr class="rcd-group-row" style="${riskBg}"><td class="label-cell" style="${riskBg}${riskLblClr}">${group}</td><td></td>${cells}<td class="total-cell ${cls}" style="${riskBg}${riskClr}color:#58a6ff;">${totalDisp}</td></tr>${destRows}</tbody>`;
        }).join('');

        const totalCells = shiftCPTs.map(cpt => {
            const d = parseCPTDate(cpt);
            const past = d < now, cur = d <= now && now < new Date(d.getTime() + 3600000);
            const minsUntil = (d - now) / 60000;
            const col = GROUP_ORDER.reduce((s, g) => {
                const e = cpts[cpt] && cpts[cpt][g];
                return s + (e ? (e.count !== undefined ? e.count : e) : 0);
            }, 0);
            const atRisk = !past && minsUntil <= 60 && col > 0;
            const disp = loading ? '…' : col > 0 ? col.toLocaleString() : '—';
            const cellStyle = tableAtRisk ? `${riskBg}${riskClr}font-weight:bold`
                : pastDueCPTs.has(cpt) ? `background:${t.riskCell};color:${t.trowLbl};font-weight:bold`
                : atRisk ? `background:${t.riskCell};color:${t.trowLbl};font-weight:bold`
                : past && !cur ? 'opacity:0.5' : cur ? `background:${t.curCell}` : '';
            return `<td style="color:#58a6ff;font-weight:bold;${cellStyle}">${disp}${atRisk ? ' ⚠' : ''}</td>`;
        }).join('');

        const grand = GROUP_ORDER.reduce((s, g) => s + shiftCPTs.reduce((ss, c) => {
            const e = cpts[c] && cpts[c][g];
            return ss + (e ? (e.count !== undefined ? e.count : e) : 0);
        }, 0), 0);
        const grandDisp = loading ? '…' : grand > 0 ? grand.toLocaleString() : '—';

        // Manifest Pending already shown as a group row above TOTAL — no need to duplicate below
        let mpRow = '';

        const wrapClass = isNextShift ? 'rcd-wrap rcd-wrap-next' : 'rcd-wrap rcd-wrap-current';

        return `<div class="${wrapClass}" style="${riskBg}"><table class="rcd-tbl" style="${riskBg}">
            <thead><tr style="${riskHdrBg}"><th class="lbl-hdr" style="${riskHdrBg}${riskLblClr}">Work Pool</th><th style="${riskHdrBg}color:#a6e3a1;text-align:center;"><a href="https://fc-eligibility-website-iad.aka.amazon.com/#/dashboard/${fc}" target="_blank" style="color:#a6e3a1;text-decoration:underline dotted;">Pickers</a></th>${headerCells}<th style="${riskHdrBg}color:${tableAtRisk ? t.trowLbl : '#58a6ff'};">Total</th></tr></thead>
            ${groupRows}
            <tbody><tr class="total-row" style="${riskHdrBg}"><td class="label-cell" style="${riskHdrBg}${riskLblClr}">TOTAL</td><td style="${riskHdrBg}"></td>${totalCells}
            <td class="total-cell" style="color:${t.trowLbl};${riskHdrBg}">${grandDisp}</td></tr>
            ${mpRow}
            </tbody></table></div>`;
    }

    // ─── Next Day Ready to Pick Drop ─────────────────────────────────────────────
    function buildNextDayDrop(cases, afterDate, loading) {
        if (loading) return '';
        const t = THEMES[curTheme] || THEMES['Dark'];
        const MIN_DROP_CASES = 1000;
        // Find the nearest future CPT with at least MIN_DROP_CASES Ready to Pick
        let bestCPT = null, bestDate = null, bestCount = 0, bestUrl = '';

        Object.keys(cases).forEach(cpt => {
            const d = parseCPTDate(cpt);
            if (!d || d <= afterDate) return;
            // Exclude 11:00 CPTs (removal/donation work)
            if (d.getHours() === 11 && d.getMinutes() === 0) return;

            const rtpEntry = cases[cpt] && cases[cpt]['Ready to Pick'];
            const val = rtpEntry ? (rtpEntry.count !== undefined ? rtpEntry.count : rtpEntry) : 0;

            if (val < MIN_DROP_CASES) return;

            if (!bestDate || d < bestDate) {
                bestDate = d;
                bestCount = val;
                bestCPT = cpt;
                bestUrl = (rtpEntry && rtpEntry.url) || '';
            }
        });

        if (!bestCPT || bestCount === 0) return '';

        const linkStyle = 'color:#e3b341;text-decoration:underline;font-size:1em';
        const totalDisp = bestCount.toLocaleString();
        const linked = bestUrl
            ? `<a href="${forceTransshipments(bestUrl)}" target="_blank" style="${linkStyle}">${totalDisp} cases</a>`
            : `<span style="font-size:1em">${totalDisp} cases</span>`;
        return `<div class="rcd-section-title" style="color:#e3b341">📦 Upcoming Ready to Pick Drop (${bestCPT}) — ${linked}</div>`;
    }

    // ─── Fetch Trailer Status from SSP Dock (reads cached data from SSP collector) ──
    function fetchTrailerStatus(fc) {
        return new Promise((resolve) => {
            // Try FC-specific key first, then fallback to generic key
            let stored = GM_getValue('sspDock_' + fc, null);
            if (!stored) stored = GM_getValue('sspDock_', null);
            if (!stored) {
                console.log('[RCD] No cached SSP dock data — open the SSP dock page to collect data');
                resolve([]);
                return;
            }
            try {
                const data = JSON.parse(stored);
                if (!data || !data.trailers || data.trailers.length === 0) {
                    resolve([]);
                    return;
                }
                const ageMin = ((Date.now() - data.timestamp) / 60000).toFixed(1);
                console.log(`[RCD] SSP dock data found (${ageMin} min old): ${data.trailers.length} trailers`);
                resolve(data.trailers);
            } catch (e) {
                console.log('[RCD] SSP dock data parse error:', e);
                resolve([]);
            }
        });
    }

    function buildTrailerStatusSection(trailers) {
        if (!trailers || trailers.length === 0) return '';
        // Sort: DD locations first, then PS locations, then others
        const sorted = [...trailers].sort((a, b) => {
            const aDD = a.location.startsWith('DD') ? 0 : 1;
            const bDD = b.location.startsWith('DD') ? 0 : 1;
            if (aDD !== bDD) return aDD - bDD;
            return a.location.localeCompare(b.location);
        });
        const rows = sorted.map(t => {
            const statusColor = /finish/i.test(t.status) ? '#a6e3a1' : /loading.*progress/i.test(t.status) ? '#89b4fa' : /loading/i.test(t.status) ? '#f9e2af' : /cancel/i.test(t.status) ? '#f38ba8' : /scheduled/i.test(t.status) ? '#ffffff' : '#ffffff';
            const sspLink = `https://trans-logistics.amazon.com/ssp/dock/hrz/ob?searchLoad=${encodeURIComponent(t.vrid)}`;
            return `<tr>
                <td style="color:#89b4fa;padding:4px 10px;"><a href="${sspLink}" target="_blank" style="color:#89b4fa;text-decoration:underline dotted;">${t.vrid}</a></td>
                <td style="color:#ffffff;padding:4px 10px;">${t.location}</td>
                <td style="color:#ffffff;padding:4px 10px;">${t.destination || '—'}</td>
                <td style="color:#ffffff;padding:4px 10px;text-align:center;">${t.containers || '—'}</td>
                <td style="color:${statusColor};padding:4px 10px;">${t.status}</td>
                <td style="color:#ffffff;padding:4px 10px;">${t.cpt}</td>
            </tr>`;
        }).join('');

        const table = `<div class="rcd-wrap" style="border-color:#89b4fa;"><table class="rcd-tbl">
            <thead><tr>
                <th style="text-align:left;">VRID</th>
                <th style="text-align:left;">Location</th>
                <th style="text-align:left;">Destination</th>
                <th style="text-align:center;">Containers</th>
                <th style="text-align:left;">Status</th>
                <th style="text-align:left;">CPT</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table></div>`;

        return `<div class="rcd-section-title next" style="cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'; this.querySelector('.rcd-chevron').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'"><span class="rcd-chevron">▶</span> 🚛 Trailer Status — ${trailers.length} trailers</div>
        <div class="rcd-collapsible" style="display:none;">${table}</div>`;
    }

    // ─── Render ───────────────────────────────────────────────────────────────────
    let stylePanelOpen = false; // persists across re-renders

    async function render(dashEl) {
        const now = new Date();
        const fc = window.location.pathname.split('/')[1] || '';
        const shift = getShiftConfig(fc);
        const { shiftStart, shiftEnd, nextShiftStart, nextShiftEnd, currentShiftLabel } = getShiftBoundaries(fc);
        const { shiftStart: actualShiftStart, shiftEnd: actualShiftEnd } = getActualShiftBoundaries(fc);
        const timeVal = now.getHours() * 60 + now.getMinutes();
        const dayStart   = shift.dayStartH * 60 + shift.dayStartM;
        const nightStart = shift.nightStartH * 60 + shift.nightStartM;
        const shiftLabel     = currentShiftLabel;
        const nextShiftLabel = shiftLabel === 'Day Shift' ? 'Night Shift' : 'Day Shift';
        const { cptLinks, cptCounts, ppData, debugInfo } = extractLinks();
        const mpScraped = scrapeManifestPending();
        const hasCPTs = Object.keys(cptLinks).length > 0 || Object.keys(cptCounts).length > 0;

        let pickerData = {};
        // Only show pick rate during actual shift + 30 min grace period after shift ends
        const pickRateGrace = 30 * 60 * 1000; // 30 minutes in ms
        const withinPickRateWindow = now >= actualShiftStart && now <= new Date(actualShiftEnd.getTime() + pickRateGrace);
        let pickRateJPH = withinPickRateWindow ? 'loading...' : '';
        let totalPicks = 0;
        let cplh = '';
        let mpResult = null; // resolved manifest pending data with case counts
        let daysBacklog = '';

        const renderHTML = (cases, loading) => {
            const t = THEMES[curTheme] || THEMES['Dark'];
            const fclmStartDate = `${actualShiftStart.getFullYear()}/${String(actualShiftStart.getMonth()+1).padStart(2,'0')}/${String(actualShiftStart.getDate()).padStart(2,'0')}`;
            const fclmEndDate = `${actualShiftEnd.getFullYear()}/${String(actualShiftEnd.getMonth()+1).padStart(2,'0')}/${String(actualShiftEnd.getDate()).padStart(2,'0')}`;
            const fclmUrl = `https://fclm-portal.amazon.com/reports/functionRollup?warehouseId=${fc}&processId=1003065&maxIntradayDays=1&spanType=Intraday` +
                `&startDateIntraday=${encodeURIComponent(fclmStartDate)}&startHourIntraday=${actualShiftStart.getHours()}&startMinuteIntraday=${String(actualShiftStart.getMinutes()).padStart(2,'0')}` +
                `&endDateIntraday=${encodeURIComponent(fclmEndDate)}&endHourIntraday=${actualShiftEnd.getHours()}&endMinuteIntraday=${String(actualShiftEnd.getMinutes()).padStart(2,'0')}`;
            dashEl.innerHTML = `
            <div id="rcd-header">
                <div class="rcd-header-center">
                    <div class="title" style="margin-bottom:4px;">${daysBacklog ? `<span style="color:#89b4fa;font-size:16px;font-weight:bold;">📊 ${daysBacklog} Days Backlog</span> &nbsp; ` : ''}Rodeo CPT Dashboard — ${fc || ''} <span style="font-size:0.8em;color:#ffffff;font-weight:normal">(Cases)</span></div>
                    <div class="meta">${shiftLabel} &nbsp;|&nbsp; ${fmtDate(now)} &nbsp;|&nbsp; ${fmtTime(shiftStart)}–${fmtTime(shiftEnd)} &nbsp;|&nbsp; Now: <span id="rcd-clock">${fmtTime(now)}</span> &nbsp;|&nbsp; <span id="rcd-cpt-countdown" style="color:#89b4fa;font-weight:bold;"></span> &nbsp;|&nbsp; Last refresh: ${fmtTime(new Date())}${loading ? ' &nbsp;|&nbsp; <span style="color:#89b4fa">⟳ loading...</span>' : ''}</div>
                    <div id="rcd-perf-line" style="margin-top:6px;display:flex;gap:8px;justify-content:center;align-items:center;flex-wrap:wrap;">
                        <div style="font-size:15px;font-weight:bold;color:#ffffff;padding:5px 12px;background:#1e2233;border:1px solid #3a4060;border-radius:6px;white-space:nowrap;"><span style="color:#888;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;margin-right:6px;">Performance</span>${(() => { const tp = Object.values(pickerData).reduce((s, v) => s + (v || 0), 0); return tp > 0 ? `<span style="color:#ffffff;">Pickers: ${tp}</span> <span style="color:#555;"> • </span> ` : ''; })()}${cplh ? `<span style="color:#ffffff;">CPLH: ${cplh}</span> <span style="color:#555;"> • </span> ` : ''}${totalPicks > 0 ? `<a href="${fclmUrl}" target="_blank" style="color:#89b4fa;text-decoration:underline dotted;">Total Picks: ${totalPicks.toLocaleString()}</a> <span style="color:#555;"> • </span> ` : ''}${pickRateJPH ? `<a href="${fclmUrl}" target="_blank" style="color:#89b4fa;text-decoration:underline dotted;">Pick Rate: ${pickRateJPH} JPH</a>` : ''}</div>
                        <div style="font-size:14px;padding:5px 12px;background:#1e2233;border:1px solid #3a4060;border-radius:6px;white-space:nowrap;"><span id="rcd-lc-display" style="color:#C3CAD7;">Learning Curve Mix: ⏳</span></div>
                    </div>
                </div>
                <div class="rcd-btns">
                    <button class="rcd-btn refresh" id="rcd-refresh">↻ Refresh</button>
                    <button class="rcd-btn" id="rcd-toggle">▲ Collapse</button>
                </div>
            </div>
            <div class="rcd-body">
                ${!hasCPTs ? `<div class="rcd-no-data">⚠️ No CPT data found. Wait for page to load then click ↻ Refresh.</div>` : ''}
                <div class="rcd-section-title summary" style="cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'; this.dataset.collapsed=this.nextElementSibling.style.display==='none'?'1':''; this.querySelector('.rcd-chevron').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'"><span class="rcd-chevron">▶</span> Picking Summary — All CPTs${!loading ? ` — <span style="font-weight:bold;text-decoration:underline;">${(() => { const cutoff = shiftStart || new Date(Date.now() - 12*3600000); let total = 0; Object.entries(cases).forEach(([cpt, groups]) => { const d = parseCPTDate(cpt); if (d && d.getHours() === 11 && d.getMinutes() === 0) return; if (d && d < cutoff) return; const pnyp = groups['Picking Not Yet Picked']; const pp = groups['Picking Picked']; total += (pnyp ? (pnyp.count !== undefined ? pnyp.count : pnyp) : 0) + (pp ? (pp.count !== undefined ? pp.count : pp) : 0); }); return total.toLocaleString(); })()} cases</span>` : ''}</div>
                <div class="rcd-collapsible" style="display:none;">${buildTotalsTable(cases, loading, shiftStart)}</div>
                <div class="rcd-section-title" style="cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'; this.querySelector('.rcd-chevron').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'"><span class="rcd-chevron">▶</span> Current — ${shiftLabel} <span style="color:#ffffff;font-weight:normal;font-size:0.8em;opacity:0.7">${fmtTime(shiftStart)} → ${fmtTime(shiftEnd)}</span>${!loading ? ` — <span style="font-weight:bold;text-decoration:underline;">${(() => { let t = 0; Object.entries(cases).forEach(([cpt, groups]) => { const d = parseCPTDate(cpt); if (!d || d < shiftStart || d >= shiftEnd) return; if (d.getHours() === 11 && d.getMinutes() === 0) return; GROUP_ORDER.forEach(g => { const e = groups[g]; t += e ? (e.count !== undefined ? e.count : (typeof e === 'number' ? e : 0)) : 0; }); }); return t.toLocaleString(); })()} cases</span>` : ''}</div>
                <div class="rcd-collapsible" style="display:none;">${buildCPTTable(cases, shiftStart, shiftEnd, loading, false, ppData, pickerData, fc, mpResult)}</div>
                <div class="rcd-section-title next" style="cursor:pointer;" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'; this.querySelector('.rcd-chevron').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'"><span class="rcd-chevron">▶</span> Next — ${nextShiftLabel} <span style="color:#ffffff;font-weight:normal;font-size:0.8em;opacity:0.7">${fmtTime(nextShiftStart)} → ${fmtTime(nextShiftEnd)}</span>${!loading ? ` — <span style="font-weight:bold;text-decoration:underline;">${(() => { let t = 0; Object.entries(cases).forEach(([cpt, groups]) => { const d = parseCPTDate(cpt); if (!d || d < nextShiftStart || d >= nextShiftEnd) return; if (d.getHours() === 11 && d.getMinutes() === 0) return; GROUP_ORDER.forEach(g => { const e = groups[g]; t += e ? (e.count !== undefined ? e.count : (typeof e === 'number' ? e : 0)) : 0; }); }); return t.toLocaleString(); })()} cases</span>` : ''}</div>
                <div class="rcd-collapsible" style="display:none;">${buildCPTTable(cases, nextShiftStart, nextShiftEnd, loading, true, ppData, pickerData, fc, null)}</div>
                ${buildNextDayDrop(cases, new Date(), loading)}
                <div id="rcd-trailer-status"></div>
            </div>`;

            applyStyle(dashEl);

            // Dynamic font scaling based on data density
            const { scale: fontScale, totalRows } = calcDashScale(ppData, cptLinks, cptCounts);
            dashEl.style.setProperty('--rcd-font-title', Math.round(18 * fontScale) + 'px');
            dashEl.style.setProperty('--rcd-font-meta', Math.round(13 * fontScale) + 'px');
            dashEl.style.setProperty('--rcd-font-section', Math.round(26 * fontScale) + 'px');
            dashEl.style.setProperty('--rcd-font-table', Math.round(13 * fontScale) + 'px');
            dashEl.style.setProperty('--rcd-font-btn', Math.round(14 * fontScale) + 'px');
            const padV = Math.round(6 * fontScale), padH = Math.round(12 * fontScale);
            const padThV = Math.round(8 * fontScale), padThH = Math.round(12 * fontScale);
            dashEl.style.setProperty('--rcd-pad-cell', padV + 'px ' + padH + 'px');
            dashEl.style.setProperty('--rcd-pad-th', padThV + 'px ' + padThH + 'px');
            dashEl.style.setProperty('--rcd-pad-subrow', Math.round(2 * fontScale) + 'px ' + Math.round(8 * fontScale) + 'px');

            document.getElementById('rcd-toggle').onclick = () => {
                const c = dashEl.classList.toggle('collapsed');
                document.getElementById('rcd-toggle').textContent = c ? '▼ Expand' : '▲ Collapse';
            };
            document.getElementById('rcd-refresh').onclick = () => location.reload();
            // Update clock and CPT countdown every second
            if (window._rcdClockInterval) clearInterval(window._rcdClockInterval);
            window._rcdClockInterval = setInterval(() => {
                const el = document.getElementById('rcd-clock');
                if (el) el.textContent = fmtTime(new Date());
            }, 60000);

            // CPT Countdown — find next upcoming CPT and count down to it
            function updateCPTCountdown() {
                const cdEl = document.getElementById('rcd-cpt-countdown');
                if (!cdEl) return;
                const now = new Date();
                // Find all CPT times from the current shift table headers (first rcd-tbl with data)
                const tables = document.querySelectorAll('#rodeo-cpt-dash table.rcd-tbl');
                let nextCPT = null;
                tables.forEach(tbl => {
                    // Only look at tables that have actual data rows
                    const totalRow = tbl.querySelector('tr.total-row');
                    if (!totalRow) return;
                    tbl.querySelectorAll('thead th').forEach(th => {
                        const text = th.textContent.trim().replace(/ ◀| ⚠| PAST DUE/g, '');
                        const m = text.match(/^(\d{2}):(\d{2})$/);
                        if (!m) return;
                        const h = +m[1], min = +m[2];
                        // Skip midnight and 23:58 (likely not real CPTs or end-of-day markers)
                        if (h === 0 && min === 0) return;
                        if (h === 23 && min >= 55) return;

                        const d = new Date(now);
                        d.setHours(h, min, 0, 0);
                        // If time is earlier than now, it's tomorrow
                        if (d <= now) d.setDate(d.getDate() + 1);
                        if (!nextCPT || d < nextCPT) nextCPT = d;
                    });
                });
                if (nextCPT) {
                    const diff = nextCPT - now;
                    const hrs = Math.floor(diff / 3600000);
                    const mins = Math.floor((diff % 3600000) / 60000);
                    const secs = Math.floor((diff % 60000) / 1000);
                    const cptTime = `${String(nextCPT.getHours()).padStart(2,'0')}:${String(nextCPT.getMinutes()).padStart(2,'0')}`;
                    cdEl.textContent = `Next CPT (${cptTime}): ${hrs}h ${mins}m ${secs}s`;
                } else {
                    cdEl.textContent = '';
                }
            }
            updateCPTCountdown();
            if (window._rcdCountdownInterval) clearInterval(window._rcdCountdownInterval);
            window._rcdCountdownInterval = setInterval(updateCPTCountdown, 1000);

            // Auto-fit: scale horizontally to fit viewport width, allow vertical scroll
            requestAnimationFrame(() => {
                dashEl.style.transform = '';
                dashEl.style.transformOrigin = 'top left';
                const contentW = dashEl.scrollWidth;
                const viewW = window.innerWidth;
                const scaleW = contentW > viewW ? viewW / contentW : 1;
                if (scaleW < 1) {
                    dashEl.style.transform = `scale(${scaleW})`;
                    dashEl.style.width = `${100 / scaleW}vw`;
                    dashEl.style.maxHeight = `${100 / scaleW}vh`;
                }
            });
        };

        renderHTML({}, true);
        if (!hasCPTs) return;

        // Fetch active pickers in parallel
        const pickerPromise = fetchActivePickers(fc).then(data => { pickerData = data; });
        // Fetch pick rate JPH in parallel (only during shift + 30 min after)
        const pickRatePromise = withinPickRateWindow
            ? fetchPickRate(fc, actualShiftStart, actualShiftEnd).then(data => { pickRateJPH = data.jph; totalPicks = data.totalPicks; })
            : Promise.resolve();
        // Fetch total hours for CPLH in parallel (calculation happens after both resolve)
        let totalHours = 0;
        let cplhJobs = 0;
        const cplhPromise = withinPickRateWindow
            ? Promise.all([
                fetchTotalHours(fc, actualShiftStart, actualShiftEnd).then(hours => { totalHours = hours; }),
                fetchCPLHJobs(fc, actualShiftStart, actualShiftEnd).then(jobs => { cplhJobs = jobs; })
            ])
            : Promise.resolve();

        const cases = {};
        const allFetches = [];
        for (const [cptLabel, groups] of Object.entries(cptLinks)) {
            for (const [group, url] of Object.entries(groups)) {
                allFetches.push(fetchCaseCountFull(url).then(count => {
                    if (!cases[cptLabel]) cases[cptLabel] = {};
                    cases[cptLabel][group] = { count: count || 0, url };
                }));
            }
        }
        // Merge direct counts (cells without links) into cases
        for (const [cptLabel, groups] of Object.entries(cptCounts)) {
            for (const [group, count] of Object.entries(groups)) {
                if (!cases[cptLabel]) cases[cptLabel] = {};
                if (!cases[cptLabel][group]) cases[cptLabel][group] = { count, url: '' };
            }
        }

        // ── Fire process path fetches in parallel with case counts ──
        const ppFetches = [];
        const bulkFetched = {}; // track bulk freight fetches per CPT to avoid duplicates
        for (const [cptLabel, groups] of Object.entries(ppData)) {
            for (const [group, paths] of Object.entries(groups)) {
                for (const [pathName, info] of Object.entries(paths)) {
                    if (info.units > 0 && info.url) {
                        const isBulk = /bulk/i.test(pathName);
                        if (isBulk) {
                            // Map group name to WorkPool parameter
                            const wpMap = {
                                'Picking Not Yet Picked': 'PickingNotYetPicked',
                                'Picking Picked': 'PickingPicked',
                                'Ready to Pick': 'ReadyToPick',
                            };
                            const wp = wpMap[group] || 'PickingNotYetPicked';
                            const bulkKey = cptLabel + '/' + pathName + '/' + group;
                            if (!bulkFetched[bulkKey]) {
                                bulkFetched[bulkKey] = fetchBulkFreightCount(info.url, wp);
                            }
                            ppFetches.push(bulkFetched[bulkKey].then(result => {
                                ppData[cptLabel][group][pathName] = { count: result.count || 0, url: result.url };
                            }));
                        } else {
                            ppFetches.push(fetchCaseCountRawFull(info.url).then(async count => {
                                // For Picking Picked and PNYP paths, also fetch destination warehouse IDs
                                let destWarehouses = [];
                                if ((group === 'Picking Picked' || group === 'Picking Not Yet Picked') && info.url) {
                                    destWarehouses = await fetchDestWarehouseIds(info.url);
                                }
                                ppData[cptLabel][group][pathName] = { count: count || 0, url: info.url, destWarehouses };
                            }));
                        }
                    } else {
                        ppData[cptLabel][group][pathName] = { count: 0, url: '' };
                    }
                }
            }
        }

        // Manifest Pending fetch
        const mpFinal = scrapeManifestPending();
        const mpSource = mpFinal.count > 0 ? mpFinal : mpScraped;
        const mpPromise = (async () => {
            if (mpSource.count <= 0) return;
            mpResult = { time: mpSource.time, count: mpSource.count, url: mpSource.url, paths: {} };
            const mpFetches = [];
            if (mpSource.url) {
                mpFetches.push(fetchCaseCountRawFull(mpSource.url).then(count => {
                    if (count) mpResult.count = count;
                }));
            }
            for (const [name, info] of Object.entries(mpSource.paths)) {
                if (info.url) {
                    mpFetches.push(fetchCaseCountRawFull(info.url).then(count => {
                        mpResult.paths[name] = { count: count || 0, url: info.url };
                    }));
                } else {
                    mpResult.paths[name] = { count: info.count, url: '' };
                }
            }
            await Promise.all(mpFetches);
        })();

        // Wait for case counts first, then render immediately
        await Promise.all(allFetches);

        // ── Progressive render: show main case counts immediately ──
        renderHTML(cases, true); // true = still loading detail data (PP paths, pickers, etc.)

        // Wait for everything else to finish
        await Promise.all([...ppFetches, pickerPromise, pickRatePromise, cplhPromise, mpPromise]);

        // Calculate CPLH after both cplhJobs and totalHours are available
        console.log('[CPLH DEBUG] cplhJobs:', cplhJobs, 'totalHours:', totalHours);
        if (totalHours > 0 && cplhJobs > 0) {
            cplh = (cplhJobs / totalHours).toFixed(2);
            console.log('[CPLH DEBUG] CPLH:', cplh);
        }

        // Roll up process path case counts into cases for CPT/group combos that had no Total row link
        // Exclude removal/donation process paths (PPRcDonateS, PPRcRecycleS, PPRcRemovalRecallS, etc.)
        const EXCLUDED_PP = /^PPRc|^PPTransConNights|^PPTransConDays2Pallet$/i;
        for (const [cptLabel, groups] of Object.entries(ppData)) {
            for (const [group, paths] of Object.entries(groups)) {
                const existing = cases[cptLabel] && cases[cptLabel][group];
                if (!existing || existing.count === 0) {
                    let ppTotal = 0;
                    let ppUrl = '';
                    for (const [pathName, info] of Object.entries(paths)) {
                        if (EXCLUDED_PP.test(pathName)) {
                            console.log(`[RCD DEBUG] ppRollup SKIPPING ${cptLabel} / ${group} / ${pathName} (excluded)`);
                            continue;
                        }
                        console.log(`[RCD DEBUG] ppRollup ${cptLabel} / ${group} / ${pathName}: count=${info.count}, url=${info.url ? 'yes' : 'no'}`);
                        ppTotal += (info.count || 0);
                        if (!ppUrl && info.url) ppUrl = info.url;
                    }
                    if (ppTotal > 0) {
                        console.log(`[RCD DEBUG] ppRollup ADDING ${cptLabel} / ${group} = ${ppTotal}`);
                        if (!cases[cptLabel]) cases[cptLabel] = {};
                        cases[cptLabel][group] = { count: ppTotal, url: ppUrl };
                    }
                }
            }
        }

        // ─── Calculate Days Backlog: PNYP units / avg(PredictedCharge + ReadyToPick units > 1000) ──
        daysBacklog = calculateDaysBacklog();

        renderHTML(cases, false);

        // ── Fetch Picking Learning Curve from ADAPT (async, updates LC display) ──
        if (withinPickRateWindow) {
            fetchPickingLearningCurve(fc, actualShiftStart);
        }

        // ── Fetch trailer status from SSP dock (async, renders into placeholder) ──
        fetchTrailerStatus(fc).then(trailers => {
            const el = document.getElementById('rcd-trailer-status');
            if (el && trailers.length > 0) {
                el.innerHTML = buildTrailerStatusSection(trailers);
            }
        });
    }

    // ─── Wait for table data then mount ──────────────────────────────────────────
    function waitAndRender(container) {
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            const spans = document.querySelectorAll('span.process-path-title');
            if (spans.length > 0 || attempts > 30) {
                clearInterval(interval);
                render(container);
            }
        }, 700);
    }

    function mount() {
        // Only run on the main ExSD overview page, not on detail/drill-down pages
        const url = window.location.href;
        const path = window.location.pathname;
        const params = new URLSearchParams(window.location.search);

        // Main page has /ExSD path with yAxis or zAxis params and multiple workPool selections
        // Detail pages typically have shipmentId, or a single WorkPool with no yAxis/zAxis
        const isExSD = path.includes('/ExSD');
        const hasAxisParams = params.has('yAxis') || params.has('zAxis');
        const hasMultipleWorkPools = url.split('workPool=').length > 3;

        if (!isExSD || (!hasAxisParams && !hasMultipleWorkPools)) {
            console.log('[RodeoCPT] Skipping — not the main ExSD page');
            return;
        }

        const style = document.createElement('style');
        style.textContent = CSS;
        document.head.appendChild(style);

        const container = document.createElement('div');
        container.id = 'rodeo-cpt-dash';
        document.body.appendChild(container);

        render(container);
        waitAndRender(container);

        let lastUrl = location.href;
        new MutationObserver(() => {
            if (location.href !== lastUrl) {
                lastUrl = location.href;
                setTimeout(() => waitAndRender(container), 1500);
            }
        }).observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount);
    } else {
        setTimeout(mount, 2000);
    }

})();
