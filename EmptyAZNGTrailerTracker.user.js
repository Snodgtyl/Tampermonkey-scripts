// ==UserScript==
// @name         Empty AZNG Trailer Tracker
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Monitors YMS Yard Management for empty AZNG trailers at PS locations with no load identifiers — notifies when available to move to DD
// @author       You
// @updateURL    https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/EmptyAZNGTrailerTracker.user.js
// @downloadURL  https://raw.githubusercontent.com/Snodgtyl/Tampermonkey-scripts/main/EmptyAZNGTrailerTracker.user.js
// @match        https://trans-logistics.amazon.com/yms/shipclerk*
// @grant        GM_notification
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function () {
    'use strict';

    // ─── Configuration ──────────────────────────────────────────────────────
    const CONFIG = {
        SCAN_INTERVAL_MS: 30000, // Scan every 30 seconds
        NOTIFICATION_COOLDOWN_MS: 300000, // Don't re-notify for same trailer within 5 minutes
        TARGET_LOCATION_PREFIX: 'PS', // Only look at PS locations
        TARGET_OWNER: 'AZNG', // Owner/Operator must be AZNG
        DD_DOORS: ['DD215', 'DD216', 'DD217', 'DD218', 'DD219', 'DD220'], // DD doors to monitor
        MAINTENANCE_KEYWORDS: ['yellow tag', 'yellow tagged', 'red tag', 'red tagged', 'totes', 'upp', 'maintenance', 'refused', 'damage', 'damaged', 'ni carts', 'hole'],
    };

    // ─── State ──────────────────────────────────────────────────────────────
    let knownTrailers = new Map(); // vehicleId -> { lastNotified, data }
    let knownDDTrailers = new Map(); // DD door trailers
    let panelVisible = true;
    let scanCount = 0;
    let cachedPsResults = []; // Keep last full scan results
    let cachedDdResults = [];
    let searchActive = false; // Pause scanning when user clicked a trailer
    let searchPauseTimer = null;

    // ─── Wait for page to load ──────────────────────────────────────────────
    const hash = window.location.hash || '';
    if (!hash.includes('yard')) return; // Only run on yard view

    console.log('[EmptyAZNG] Trailer tracker initializing...');

    // ─── Create floating dashboard panel ────────────────────────────────────
    function createPanel() {
        const panel = document.createElement('div');
        panel.id = 'azng-tracker-panel';
        panel.innerHTML = `
            <div id="azng-tracker-header">
                <span style="font-weight:bold;font-size:13px;">🚛 Empty AZNG Trailers</span>
                <div>
                    <span id="azng-tracker-count" style="background:#4CAF50;color:#fff;padding:2px 8px;border-radius:10px;font-size:12px;margin-right:6px;">0</span>
                    <button id="azng-tracker-toggle" style="background:none;border:none;color:#fff;cursor:pointer;font-size:16px;">▼</button>
                </div>
            </div>
            <div id="azng-tracker-body">
                <div id="azng-tracker-status" style="padding:6px 10px;font-size:11px;color:#888;border-bottom:1px solid #333;">
                    Scanning...
                </div>
                <div id="azng-tracker-dd-section" style="display:none;">
                    <div style="padding:6px 10px;font-size:11px;font-weight:bold;color:#64B5F6;background:#16213e;border-bottom:1px solid #333;">
                        🟢 At DD Doors (215-220) — Ready
                    </div>
                    <div id="azng-tracker-dd-list"></div>
                </div>
                <div style="padding:6px 10px;font-size:11px;font-weight:bold;color:#81C784;background:#16213e;border-bottom:1px solid #333;">
                    📍 Available at PS — Ready to Move
                </div>
                <div id="azng-tracker-list" style="max-height:300px;overflow-y:auto;"></div>
                <div id="azng-tracker-footer" style="padding:6px 10px;overflow:hidden;position:relative;height:20px;border-top:1px solid #333;">
                    <div id="azng-truck-animation">��🚛</div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Styles
        const style = document.createElement('style');
        style.textContent = `
            #azng-tracker-panel {
                position: fixed;
                top: 80px;
                right: 20px;
                width: 360px;
                background: #1a1a2e;
                border: 1px solid #16213e;
                border-radius: 8px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                z-index: 99999;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                color: #e0e0e0;
                transition: all 0.3s ease;
            }
            #azng-tracker-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px 12px;
                background: #16213e;
                border-radius: 8px 8px 0 0;
                cursor: move;
                user-select: none;
            }
            #azng-tracker-body.collapsed {
                display: none;
            }
            .azng-trailer-row {
                padding: 8px 12px;
                border-bottom: 1px solid #2a2a4a;
                font-size: 12px;
                transition: background 0.2s;
                cursor: pointer;
            }
            .azng-trailer-row:hover {
                background: #2a2a4a;
            }
            .azng-trailer-row:active {
                background: #3a3a5a;
            }
            .azng-trailer-row.new-arrival {
                animation: azng-highlight 2s ease-out;
            }
            @keyframes azng-highlight {
                0% { background: #4CAF5040; }
                100% { background: transparent; }
            }
            .azng-trailer-location {
                font-weight: bold;
                color: #64B5F6;
                margin-right: 8px;
            }
            .azng-trailer-vehicle {
                color: #FFD54F;
                font-weight: 600;
            }
            .azng-trailer-time {
                color: #aaa;
                font-size: 11px;
            }
            .azng-trailer-note {
                font-size: 11px;
                margin-top: 3px;
                padding: 2px 6px;
                border-radius: 3px;
            }
            .azng-note-ok {
                color: #81C784;
            }
            .azng-note-warning {
                color: #FFB74D;
                background: #FFB74D20;
            }
            .azng-note-maintenance {
                color: #EF5350;
                background: #EF535020;
            }
            #azng-tracker-empty {
                padding: 20px;
                text-align: center;
                color: #666;
                font-size: 12px;
            }
            .azng-badge-available {
                display: inline-block;
                background: #4CAF50;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                font-size: 10px;
                margin-left: 6px;
            }
            .azng-badge-issue {
                display: inline-block;
                background: #FF5722;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                font-size: 10px;
                margin-left: 6px;
            }
            .azng-badge-docked {
                display: inline-block;
                background: #2196F3;
                color: #fff;
                padding: 1px 6px;
                border-radius: 3px;
                font-size: 10px;
                margin-left: 6px;
            }
            #azng-truck-animation {
                position: absolute;
                font-size: 14px;
                white-space: nowrap;
                transform: scaleX(-1);
                animation: azng-drive 8s linear infinite;
            }
            @keyframes azng-drive {
                0% { left: -40px; }
                100% { left: 100%; }
            }
        `;
        document.head.appendChild(style);

        // Toggle collapse
        document.getElementById('azng-tracker-toggle').addEventListener('click', () => {
            const body = document.getElementById('azng-tracker-body');
            body.classList.toggle('collapsed');
            document.getElementById('azng-tracker-toggle').textContent = body.classList.contains('collapsed') ? '▶' : '▼';
        });

        // Click-to-search event listener — use delegated click on panel
        document.getElementById('azng-tracker-panel').addEventListener('click', (e) => {
            const row = e.target.closest('.azng-trailer-row');
            if (!row) return;
            const term = row.getAttribute('data-search');
            if (term) {
                console.log('[EmptyAZNG] Click detected, searching for:', term);
                searchForTrailer(term);
            }
        });

        // Make draggable
        makeDraggable(panel, document.getElementById('azng-tracker-header'));
    }

    function makeDraggable(el, handle) {
        let offsetX, offsetY, isDragging = false;
        handle.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - el.getBoundingClientRect().left;
            offsetY = e.clientY - el.getBoundingClientRect().top;
            el.style.transition = 'none';
        });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            el.style.left = (e.clientX - offsetX) + 'px';
            el.style.top = (e.clientY - offsetY) + 'px';
            el.style.right = 'auto';
        });
        document.addEventListener('mouseup', () => {
            isDragging = false;
            el.style.transition = 'all 0.3s ease';
        });
    }

    // ─── Helper: get text content of a cell ────────────────────────────────
    function getCellText(cells, idx) {
        if (idx < 0 || idx === undefined || idx >= cells.length) return '';
        return cells[idx].textContent.trim();
    }

    // ─── Helper: extract clean location code from cell text ─────────────────
    function extractLocation(rawLocation) {
        // Extract just the PS### or DD### from text like "PS865 AAP_FLEET_EMPTY-1"
        const match = rawLocation.match(/(PS|DD|SL|DK)\d+/i);
        return match ? match[0] : rawLocation.split(/\s/)[0];
    }

    // ─── Helper: extract clean owner from cell text ─────────────────────────
    function extractOwner(rawOwner) {
        // Extract just "AZNG (XXXXX)" from text like "AZNG (AVLRX) Unavailable: Healthy"
        const match = rawOwner.match(/AZNG\s*\([A-Z0-9]+\)/i);
        return match ? match[0] : rawOwner.split(/\s+/).slice(0, 2).join(' ');
    }

    // ─── Helper: detect if vehicle graphic is grey (full) vs white (empty) ──
    function isVehicleFull(vehicleCell) {
        if (!vehicleCell) return false;

        // Try to access Angular scope data on the vehicle element for status
        try {
            if (typeof angular !== 'undefined') {
                const aEl = vehicleCell.querySelector('[ng-repeat*="yardAsset"]') || vehicleCell.querySelector('a');
                if (aEl) {
                    const scope = angular.element(aEl).scope();
                    if (scope && scope.yardAsset) {
                        const status = (scope.yardAsset.vehicleStatus || scope.yardAsset.status || '').toLowerCase();
                        const loadStatus = (scope.yardAsset.loadStatus || '').toLowerCase();
                        if (status === 'full' || loadStatus === 'full' || status === 'loaded') {
                            return true;
                        }
                        if (status === 'empty' || loadStatus === 'empty') {
                            return false;
                        }
                    }
                }
            }
        } catch (e) { /* Angular not available or scope error */ }

        // Fallback: check for explicit 'full' in classes or image src
        const imgs = vehicleCell.querySelectorAll('img');
        for (const img of imgs) {
            const src = (img.src || '').toLowerCase();
            if (src.includes('full') || src.includes('loaded')) return true;
            if (src.includes('empty')) return false;
        }

        return false;
    }

    // ─── Detect column mapping from a known AZNG row ────────────────────────
    function detectColumnMap(cells, texts, azngIdx) {
        // The AZNG index tells us where the Owner column is
        // From the header we know the order should be:
        // Location | Vehicle | Time in Yard | Visit Reason | License Plate | Vehicle ID | Owner | Load IDs | Seal | Notes
        //
        // But the data table may have extra cells (for icons, graphics, etc.)
        // We'll use the AZNG column as anchor and detect others by patterns

        const numCells = cells.length;
        const map = {
            owner: azngIdx,
            location: -1,
            vehicle: -1,
            timeInYard: -1,
            visitReason: -1,
            licensePlate: -1,
            vehicleId: -1,
            loadId: -1,
            seal: -1,
            notes: -1,
        };

        // Look for location (DD###, PS###, etc.) — usually early in the row
        for (let j = 0; j < azngIdx; j++) {
            const t = texts[j].toUpperCase().replace(/\s+/g, '');
            if (/^(DD|PS|SL|DK|OF)\d+/.test(t) || /^[A-Z]{2,4}\d{1,4}$/.test(t)) {
                map.location = j;
                break;
            }
        }
        // Fallback: first cell with text that looks like a dock location
        if (map.location === -1) {
            for (let j = 0; j < Math.min(azngIdx, 3); j++) {
                if (texts[j].length > 0) {
                    map.location = j;
                    break;
                }
            }
        }

        // Look for time patterns (HH:MM or ##:##) — Time in Yard
        for (let j = 0; j < azngIdx; j++) {
            if (j === map.location) continue;
            if (/^\d{1,3}:\d{2}$/.test(texts[j]) || /^\d+h\s*\d*m?$/.test(texts[j])) {
                map.timeInYard = j;
                break;
            }
        }

        // Look for visit reason (INBOUND, OUTBOUND, etc.)
        for (let j = 0; j < azngIdx; j++) {
            if (j === map.location || j === map.timeInYard) continue;
            const t = texts[j].toUpperCase();
            if (t.includes('INBOUND') || t.includes('OUTBOUND') || t.includes('LIVE') || t === '') {
                // Could be visit reason — check if it's between time and license plate
                if (map.timeInYard !== -1 && j > map.timeInYard) {
                    map.visitReason = j;
                    break;
                }
            }
        }

        // Look for license plate (alphanumeric pattern like PD63262, with possible state)
        for (let j = 0; j < azngIdx; j++) {
            if (j === map.location || j === map.timeInYard || j === map.visitReason) continue;
            const t = texts[j];
            // License plates typically have a pattern like letters+digits, or contain "US:" state info
            if (/[A-Z]{1,4}\d{3,}/.test(t.toUpperCase()) || t.includes('US:') || /^\d{5,}[A-Z]?$/.test(t)) {
                map.licensePlate = j;
                break;
            }
        }

        // Vehicle ID (like V240237 — starts with V or is a long alphanumeric)
        for (let j = 0; j < azngIdx; j++) {
            if (j === map.location || j === map.timeInYard || j === map.visitReason || j === map.licensePlate) continue;
            const t = texts[j].toUpperCase();
            if (/^V\d{4,}/.test(t) || /^\d{6,}$/.test(t)) {
                map.vehicleId = j;
                break;
            }
        }

        // After owner: Load Identifiers, Seal, Notes
        // Load IDs would be next after owner
        if (azngIdx + 1 < numCells) map.loadId = azngIdx + 1;
        if (azngIdx + 2 < numCells) map.seal = azngIdx + 2;
        if (azngIdx + 3 < numCells) map.notes = azngIdx + 3;

        // Vehicle column — whatever remains before time, usually has image/graphic
        if (map.vehicle === -1 && map.location !== -1) {
            for (let j = map.location + 1; j < (map.timeInYard !== -1 ? map.timeInYard : azngIdx); j++) {
                if (j !== map.location && j !== map.timeInYard && j !== map.visitReason && j !== map.licensePlate && j !== map.vehicleId) {
                    map.vehicle = j;
                    break;
                }
            }
        }

        return map;
    }

    // ─── Scan the YMS table for matching trailers ───────────────────────────
    function scanForEmptyAZNG() {
        scanCount++;
        const psResults = [];
        const ddResults = [];

        // Find the main yard table — try multiple strategies
        let yardTable = null;

        // Strategy 1: Look for table with expected headers
        const tables = document.querySelectorAll('table');

        for (const table of tables) {
            const headerText = table.querySelector('tr') ? table.querySelector('tr').textContent.toLowerCase() : '';
            if ((headerText.includes('location') || headerText.includes('vehicle')) &&
                (headerText.includes('owner') || headerText.includes('operator') || headerText.includes('load'))) {
                yardTable = table;
                break;
            }
        }

        // Strategy 2: Find the table that contains "AZNG" text
        if (!yardTable) {
            for (const table of tables) {
                if (table.textContent.includes('AZNG')) {
                    yardTable = table;
                    break;
                }
            }
        }

        // Strategy 3: Look for the largest table on the page (likely the yard table)
        if (!yardTable && tables.length > 0) {
            let maxRows = 0;
            for (const table of tables) {
                const rowCount = table.querySelectorAll('tr').length;
                if (rowCount > maxRows) {
                    maxRows = rowCount;
                    yardTable = table;
                }
            }
        }

        // Strategy 4: Look for repeating row elements (Angular ng-repeat, etc.)
        if (!yardTable) {
            const ngRows = document.querySelectorAll('[ng-repeat], [data-ng-repeat], [x-ng-repeat]');
            if (ngRows.length > 0) {
                yardTable = ngRows[0].closest('table') || ngRows[0].parentElement;
                console.log(`[EmptyAZNG] Found via ng-repeat (${ngRows.length} rows)`);
            }
        }

        if (!yardTable) {
            // Log what we can see for debugging
            console.log('[EmptyAZNG] ⚠️ No yard table found. Page text sample:', document.body.textContent.substring(0, 500));
            updateStatus('⚠️ Yard table not found — waiting for page load...');
            return { psResults, ddResults };
        }

        // Get all rows from the table
        // YMS uses separate tables for header and body — if we only found 1 row (the header),
        // look for the data table nearby (sibling, next table, or parent container)
        let allRows = yardTable.querySelectorAll('tr');

        if (allRows.length <= 2) {

            let dataTable = null;

            // Strategy A: Look for the next sibling table
            let sibling = yardTable.nextElementSibling;
            while (sibling && !dataTable) {
                if (sibling.tagName === 'TABLE') {
                    const rows = sibling.querySelectorAll('tr');
                    if (rows.length > 2) { dataTable = sibling; break; }
                }
                // Check inside divs/containers
                const innerTable = sibling.querySelector('table');
                if (innerTable && innerTable.querySelectorAll('tr').length > 2) {
                    dataTable = innerTable; break;
                }
                sibling = sibling.nextElementSibling;
            }

            // Strategy B: Check parent's next sibling or adjacent containers
            if (!dataTable) {
                const parent = yardTable.parentElement;
                if (parent) {
                    let pSibling = parent.nextElementSibling;
                    while (pSibling && !dataTable) {
                        const tbl = pSibling.tagName === 'TABLE' ? pSibling : pSibling.querySelector('table');
                        if (tbl && tbl.querySelectorAll('tr').length > 2) {
                            dataTable = tbl; break;
                        }
                        pSibling = pSibling.nextElementSibling;
                    }
                }
            }

            // Strategy C: Look for tables with ng-repeat rows (Angular data binding)
            if (!dataTable) {
                const ngRows = document.querySelectorAll('[ng-repeat*="vehicle"], [ng-repeat*="trailer"], [ng-repeat*="yard"], [ng-repeat*="row"], [ng-repeat*="item"]');
                if (ngRows.length > 0) {
                    dataTable = ngRows[0].closest('table');
                    console.log(`[EmptyAZNG] Found data via ng-repeat (${ngRows.length} rows)`);
                }
            }

            // Strategy D: Find the table with the most rows that contains AZNG
            if (!dataTable) {
                let maxRows = 0;
                for (const table of tables) {
                    if (table === yardTable) continue;
                    const rowCount = table.querySelectorAll('tr').length;
                    if (rowCount > maxRows && table.textContent.includes('AZNG')) {
                        maxRows = rowCount;
                        dataTable = table;
                    }
                }
                if (dataTable) console.log(`[EmptyAZNG] Found data table via AZNG content (${maxRows} rows)`);
            }

            // Strategy E: Find ANY table with more than 5 rows that has DD or PS text
            if (!dataTable) {
                for (const table of tables) {
                    if (table === yardTable) continue;
                    const rowCount = table.querySelectorAll('tr').length;
                    if (rowCount > 5 && (table.textContent.includes('DD') || table.textContent.includes('PS'))) {
                        dataTable = table;
                        console.log(`[EmptyAZNG] Found data table via DD/PS content (${rowCount} rows)`);
                        break;
                    }
                }
            }

            // Strategy F: Scan ALL tr elements on the page with enough td cells
            if (!dataTable) {
                console.log('[EmptyAZNG] No data table found, scanning all page rows directly...');
                const pageTrs = document.querySelectorAll('tr');
                const fakeTable = { querySelectorAll: () => pageTrs, querySelector: () => null };
                allRows = pageTrs;
                console.log(`[EmptyAZNG] Scanning ${allRows.length} total page rows`);
            }

            if (dataTable) {
                allRows = dataTable.querySelectorAll('tr');
                console.log(`[EmptyAZNG] Data table found with ${allRows.length} rows`);
            }
        }

        // Determine column indices from the header we already found
        // (headers may be in a separate table from data rows)
        let headers = [];
        let headerRowIdx = -1;

        // First check if we already identified headers from the original yardTable
        const origHeaderRow = yardTable.querySelector('tr');
        if (origHeaderRow) {
            const cells = origHeaderRow.querySelectorAll('th, td');
            const texts = Array.from(cells).map(c => c.textContent.trim().toLowerCase());
            if (texts.some(t => t.includes('location')) && texts.some(t => t.includes('vehicle') || t.includes('owner'))) {
                headers = texts;
                console.log('[EmptyAZNG] Using headers from header table:', texts.join(' | '));
            }
        }

        // If we still don't have headers, look within the data rows
        if (headers.length === 0) {
            for (let i = 0; i < Math.min(allRows.length, 5); i++) {
                const cells = allRows[i].querySelectorAll('th, td');
                const texts = Array.from(cells).map(c => c.textContent.trim().toLowerCase());
                if (texts.some(t => t.includes('location')) && texts.some(t => t.includes('vehicle') || t.includes('owner'))) {
                    headers = texts;
                    headerRowIdx = i;
                    console.log('[EmptyAZNG] Header row found in data at index', i, ':', texts.join(' | '));
                    break;
                }
            }
        }

        let colLocation = headers.findIndex(h => h.includes('location'));
        let colOwner = headers.findIndex(h => h.includes('owner') || h.includes('operator'));

        // These are only used as fallback reference — actual mapping comes from detectColumnMap
        if (colLocation === -1) colLocation = 0;
        if (colOwner === -1) colOwner = 6;

        if (headers.length === 0) {
            console.log('[EmptyAZNG] No header row detected, using fallback column positions. First row text:', allRows[0]?.textContent.substring(0, 200));
        }

        // Scan data rows (skip header row if found within data)
        const startIdx = headerRowIdx + 1;
        let azngCount = 0;

        // First, figure out the actual column mapping from a sample data row
        // The data table likely has different cell counts than the header due to nested tables/icons
        // We'll detect columns by looking for known patterns in the first few rows
        let colMap = null;
        for (let i = startIdx; i < Math.min(allRows.length, startIdx + 50); i++) {
            const row = allRows[i];
            const cells = Array.from(row.querySelectorAll(':scope > td'));
            if (cells.length < 5) continue;

            // Try to identify columns by content patterns
            const texts = cells.map(c => c.textContent.trim());
            const azngIdx = texts.findIndex(t => t.toUpperCase().includes('AZNG'));
            if (azngIdx !== -1) {
                // Found an AZNG row — use it to determine column mapping
                // Owner column contains "AZNG", work backwards/forwards from there
                console.log(`[EmptyAZNG] Sample AZNG row ${i} (${cells.length} cells):`, texts.join(' | '));

                // Try to auto-detect based on content patterns
                colMap = detectColumnMap(cells, texts, azngIdx);
                if (colMap) {
                    console.log('[EmptyAZNG] Column map detected:', JSON.stringify(colMap));
                    break;
                }
            }
        }

        // If no AZNG row found in first 50, try scanning more broadly
        if (!colMap) {
            console.log('[EmptyAZNG] No AZNG row found in first 50 rows, sampling deeper...');
            for (let i = startIdx; i < allRows.length; i += 50) {
                const row = allRows[i];
                const cells = Array.from(row.querySelectorAll(':scope > td'));
                if (cells.length < 5) continue;
                const texts = cells.map(c => c.textContent.trim());
                const azngIdx = texts.findIndex(t => t.toUpperCase().includes('AZNG'));
                if (azngIdx !== -1) {
                    console.log(`[EmptyAZNG] Sample AZNG row ${i} (${cells.length} cells):`, texts.join(' | '));
                    colMap = detectColumnMap(cells, texts, azngIdx);
                    if (colMap) break;
                }
            }
        }

        if (!colMap) {
            console.log('[EmptyAZNG] ⚠️ Could not detect column mapping — no AZNG rows found');
            updateStatus('⚠️ No AZNG trailers found in yard data');
            return { psResults, ddResults };
        }

        console.log(`[EmptyAZNG] Scanning rows from index ${startIdx} to ${allRows.length - 1} with detected column map`);
        for (let i = startIdx; i < allRows.length; i++) {
            const row = allRows[i];
            const cells = Array.from(row.querySelectorAll(':scope > td'));
            if (cells.length < 5) continue; // Skip rows with too few cells

            const locationCell = cells[colMap.location] || null;
            const location = getCellText(cells, colMap.location);
            const vehicle = getCellText(cells, colMap.vehicle);
            const timeInYard = getCellText(cells, colMap.timeInYard);
            const visitReason = getCellText(cells, colMap.visitReason);
            const licensePlate = getCellText(cells, colMap.licensePlate);
            const vehicleId = getCellText(cells, colMap.vehicleId);
            const owner = getCellText(cells, colMap.owner);
            const loadIdentifiers = getCellText(cells, colMap.loadId);
            const seal = getCellText(cells, colMap.seal);
            const notes = getCellText(cells, colMap.notes);

            // Debug: log first few AZNG rows
            if (azngCount < 3 && owner.toUpperCase().includes('AZNG') && scanCount <= 1) {
                console.log(`[EmptyAZNG] AZNG Row: loc="${location}" owner="${owner}" loadId="${loadIdentifiers}" notes="${notes.substring(0, 50)}"`);
            }

            // Owner/Operator must START with "AZNG" (not just contain it)
            // "AZNU (AZNG)" doesn't count — only "AZNG (xxxxx)" does
            const ownerTrimmed = owner.trim().toUpperCase();
            if (!ownerTrimmed.startsWith(CONFIG.TARGET_OWNER)) continue;

            // Check if vehicle graphic is grey (means full, not empty)
            // The vehicle cell uses Angular ng-repeat with yard asset data
            // We check for 'full' class or attribute on the vehicle element
            const vehicleCell = cells[colMap.vehicle] || null;
            const isFull = isVehicleFull(vehicleCell);
            if (isFull) continue;

            azngCount++;

            // Check notes AND owner text for maintenance/unavailable issues
            const notesLower = notes.toLowerCase();
            const ownerLower = owner.toLowerCase();
            const combinedText = notesLower + ' ' + ownerLower;
            // Flag if keywords found OR if notes contain a DD reference (means assigned elsewhere)
            const hasKeyword = CONFIG.MAINTENANCE_KEYWORDS.some(kw => combinedText.includes(kw));
            const hasDDInNotes = /\bdd\d{1,3}\b/i.test(notes);
            // Check if there's a move in progress (DD destination shown in owner cell)
            const hasMoveInProgress = /\bDD\d{1,3}\b/.test(owner);
            const hasMaintenance = hasKeyword || hasDDInNotes || hasMoveInProgress;

            const trailerData = {
                location,
                vehicle,
                timeInYard,
                visitReason,
                licensePlate,
                vehicleId,
                owner,
                loadIdentifiers: loadIdentifiers.replace(/[\s\n\r]+/g, ' ').trim(),
                seal,
                notes,
                hasMaintenance,
                id: vehicleId || licensePlate || vehicle || location + '_' + scanCount,
            };

            // ─── Check if this is a PS location (empty AZNG available to move) ──
            if (location.toUpperCase().startsWith(CONFIG.TARGET_LOCATION_PREFIX)) {
                // Load identifiers must be empty (no site code = available)
                const loadIdClean = loadIdentifiers.replace(/[\s\n\r]+/g, ' ').trim();
                const hasSiteCode = /[A-Z]{2,4}\d/.test(loadIdClean);
                const hasLoadContent = loadIdClean.length > 0 && hasSiteCode;
                if (!hasLoadContent) {
                    psResults.push(trailerData);
                }
            }

            // ─── Check if this is a DD 215-220 ─────────────────────────────────
            const locationUpper = location.toUpperCase().replace(/\s+/g, '');
            const matchedDD = CONFIG.DD_DOORS.find(dd => locationUpper.startsWith(dd));
            if (matchedDD) {
                // Same empty check as PS: Load identifiers must be empty (no site code)
                const loadIdCleanDD = loadIdentifiers.replace(/[\s\n\r]+/g, ' ').trim();
                const hasSiteCodeDD = /[A-Z]{2,4}\d/.test(loadIdCleanDD);
                const hasLoadContentDD = loadIdCleanDD.length > 0 && hasSiteCodeDD;
                if (!hasLoadContentDD && !hasMaintenance) {
                    trailerData.ddDoor = matchedDD;
                    ddResults.push(trailerData);
                }
            }
        }

        console.log(`[EmptyAZNG] Total AZNG rows found: ${azngCount}, PS matches: ${psResults.length}, DD matches: ${ddResults.length}`);
        return { psResults, ddResults };
    }

    // ─── Detect green checkmark in a cell ───────────────────────────────────
    function detectGreenCheckmark(cell) {
        // The YMS green checkmark appears as a colored circle/icon in the dock door graphic
        // We need to detect any green-colored element in the location cell

        // Method 1: Check ALL elements for green computed background or color
        const allEls = cell.querySelectorAll('*');
        for (const el of allEls) {
            try {
                const computed = window.getComputedStyle(el);
                const bgColor = computed.backgroundColor;
                const color = computed.color;
                const borderColor = computed.borderColor;
                if (isGreenColor(bgColor) || isGreenColor(color) || isGreenColor(borderColor)) {
                    return true;
                }
            } catch (e) { /* skip */ }
        }

        // Method 2: Look for images with green/check/available/ok in src, alt, or class
        const imgs = cell.querySelectorAll('img');
        for (const img of imgs) {
            const src = (img.src || '').toLowerCase();
            const alt = (img.alt || '').toLowerCase();
            const cls = (img.className || '').toLowerCase();
            if (src.includes('green') || src.includes('check') || src.includes('available') || src.includes('ok') || src.includes('success') ||
                alt.includes('green') || alt.includes('check') || alt.includes('available') ||
                cls.includes('green') || cls.includes('check') || cls.includes('available') || cls.includes('success')) {
                return true;
            }
        }

        // Method 3: Look for SVG elements with green fill or stroke
        const svgs = cell.querySelectorAll('svg, svg *');
        for (const svg of svgs) {
            const fill = (svg.getAttribute('fill') || '').toLowerCase();
            const stroke = (svg.getAttribute('stroke') || '').toLowerCase();
            const cls = (svg.className?.baseVal || svg.className || '').toLowerCase();
            const style = (svg.getAttribute('style') || '').toLowerCase();
            if (fill.includes('green') || fill.includes('#4caf50') || fill.includes('#81c784') || fill.includes('#8bc34a') || fill.includes('#66bb6a') || fill === '#0f0' || fill === '#0a0' ||
                stroke.includes('green') || stroke.includes('#4caf50') ||
                cls.includes('green') || cls.includes('check') || cls.includes('success') ||
                style.includes('green') || style.includes('#4caf50') || style.includes('#81c784')) {
                return true;
            }
        }

        // Method 4: Check inline styles for green colors
        for (const el of allEls) {
            const style = (el.getAttribute('style') || '').toLowerCase();
            if (style.includes('green') || style.includes('#4caf50') || style.includes('#81c784') || style.includes('#8bc34a') ||
                style.includes('#66bb6a') || style.includes('rgb(76') || style.includes('rgb(129')) {
                return true;
            }
        }

        // Method 5: Check class names for green/check/available/success patterns
        for (const el of allEls) {
            const cls = (el.className || '').toLowerCase();
            if (cls.includes('green') || cls.includes('check') || cls.includes('available') ||
                cls.includes('success') || cls.includes('ready') || cls.includes('complete') ||
                cls.includes('active') || cls.includes('ok')) {
                return true;
            }
        }

        // Method 6: Check for unicode checkmarks or similar characters
        const cellText = cell.textContent;
        if (cellText.includes('✓') || cellText.includes('✔') || cellText.includes('☑') || cellText.includes('✅')) {
            return true;
        }

        return false;
    }

    // Helper: determine if a CSS color string is "green"
    function isGreenColor(colorStr) {
        if (!colorStr) return false;
        const m = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (m) {
            const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
            // Green-dominant: G channel significantly higher than R and B
            return g > 100 && g > r * 1.3 && g > b * 1.3;
        }
        return false;
    }

    // ─── Click handler: search for trailer in YMS to navigate to it ────────
    function searchForTrailer(searchTerm) {
        // Pause scanning so the panel keeps showing all results while table is filtered
        searchActive = true;
        if (searchPauseTimer) clearTimeout(searchPauseTimer);
        searchPauseTimer = setTimeout(() => { searchActive = false; }, 60000);

        console.log(`[EmptyAZNG] 🔍 Searching for: ${searchTerm}`);

        // Strategy 1: Find the row in the visible table and scroll to it + highlight
        const allRows = document.querySelectorAll('tr');
        for (const row of allRows) {
            const text = row.textContent;
            if (text.includes(searchTerm)) {
                // Found the row — scroll to it and highlight
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const origBg = row.style.backgroundColor;
                row.style.backgroundColor = '#FFEB3B';
                row.style.outline = '3px solid #FF9800';
                setTimeout(() => {
                    row.style.backgroundColor = origBg;
                    row.style.outline = '';
                }, 5000);
                console.log(`[EmptyAZNG] ✓ Scrolled to row containing: ${searchTerm}`);
                break;
            }
        }

        // Strategy 2: Also try filling the search box
        const allInputs = document.querySelectorAll('input');
        let searchInput = null;

        for (const inp of allInputs) {
            const placeholder = (inp.placeholder || '').toLowerCase();
            const ngModel = (inp.getAttribute('ng-model') || '').toLowerCase();
            if (placeholder.includes('search') || ngModel.includes('search') || ngModel.includes('filter')) {
                searchInput = inp;
                break;
            }
        }

        if (searchInput) {
            try {
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(searchInput, searchTerm);
                searchInput.dispatchEvent(new Event('input', { bubbles: true }));
                searchInput.dispatchEvent(new Event('change', { bubbles: true }));

                // Angular scope update
                if (typeof angular !== 'undefined') {
                    const scope = angular.element(searchInput).scope();
                    if (scope) {
                        scope.$apply(() => {
                            const modelAttr = searchInput.getAttribute('ng-model');
                            if (modelAttr) {
                                const parts = modelAttr.split('.');
                                let obj = scope;
                                for (let k = 0; k < parts.length - 1; k++) {
                                    obj[parts[k]] = obj[parts[k]] || {};
                                    obj = obj[parts[k]];
                                }
                                obj[parts[parts.length - 1]] = searchTerm;
                            }
                        });
                        if (scope.topbar && typeof scope.topbar.textSearch === 'function') {
                            scope.topbar.textSearch(searchTerm);
                        }
                    }
                }
            } catch (e) {
                console.log('[EmptyAZNG] Search box fill error:', e.message);
            }
        }
    }

    // ─── Update the panel UI ────────────────────────────────────────────────
    function updatePanel(psTrailers, ddTrailers) {
        const countEl = document.getElementById('azng-tracker-count');
        const listEl = document.getElementById('azng-tracker-list');
        const ddSection = document.getElementById('azng-tracker-dd-section');
        const ddListEl = document.getElementById('azng-tracker-dd-list');

        if (!countEl || !listEl) return;

        const available = psTrailers.filter(t => !t.hasMaintenance);
        const withIssues = psTrailers.filter(t => t.hasMaintenance);

        countEl.textContent = available.length;
        countEl.style.background = available.length > 0 ? '#4CAF50' : '#666';

        // ─── DD Section ─────────────────────────────────────────────────
        if (ddTrailers.length > 0 && ddSection && ddListEl) {
            ddSection.style.display = 'block';
            let ddHtml = '';
            for (const t of ddTrailers) {
                const cleanLoc = extractLocation(t.ddDoor || t.location);
                const cleanOwner = extractOwner(t.owner);
                ddHtml += `
                    <div class="azng-trailer-row" data-search="${cleanLoc}">
                        <div>
                            <span class="azng-trailer-location">${cleanLoc}</span>
                            <span class="azng-badge-docked">✓ DOCKED</span>
                        </div>
                        <div style="margin-top:3px;">
                            <span class="azng-trailer-time">⏱ ${t.timeInYard || 'N/A'} in yard</span>
                            <span style="color:#aaa;margin-left:8px;">${cleanOwner}</span>
                        </div>
                        ${t.notes ? `<div class="azng-trailer-note azng-note-ok">📝 ${t.notes}</div>` : ''}
                        <div style="margin-top:3px;font-size:10px;color:#64B5F6;">🔍 Click to find in yard</div>
                    </div>
                `;
            }
            ddListEl.innerHTML = ddHtml;
        } else if (ddSection) {
            ddSection.style.display = 'none';
        }

        // ─── PS Section — only show available trailers ────────────────────
        if (available.length === 0) {
            listEl.innerHTML = `<div id="azng-tracker-empty">No empty AZNG trailers at PS locations right now</div>`;
            return;
        }

        let html = '';

        for (const t of available) {
            const isNew = !knownTrailers.has(t.id);
            const cleanLoc = extractLocation(t.location);
            const cleanOwner = extractOwner(t.owner);
            html += `
                <div class="azng-trailer-row ${isNew ? 'new-arrival' : ''}" data-search="${cleanLoc}">
                    <div>
                        <span class="azng-trailer-location">${cleanLoc}</span>
                        <span class="azng-badge-available">AVAILABLE</span>
                    </div>
                    <div style="margin-top:3px;">
                        <span class="azng-trailer-time">⏱ ${t.timeInYard || 'N/A'} in yard</span>
                        <span style="color:#aaa;margin-left:8px;">${cleanOwner}</span>
                    </div>
                    ${t.notes ? `<div class="azng-trailer-note azng-note-ok">📝 ${t.notes}</div>` : ''}
                    <div style="margin-top:3px;font-size:10px;color:#64B5F6;">🔍 Click to find in yard</div>
                </div>
            `;
        }

        listEl.innerHTML = html;
    }

    // ─── Notifications ──────────────────────────────────────────────────────
    function notifyNewTrailers(trailers) {
        const now = Date.now();
        const available = trailers.filter(t => !t.hasMaintenance);

        for (const t of available) {
            const known = knownTrailers.get(t.id);
            if (known && (now - known.lastNotified) < CONFIG.NOTIFICATION_COOLDOWN_MS) continue;

            // Send desktop notification
            try {
                GM_notification({
                    title: '🚛 Empty AZNG Trailer Available!',
                    text: `${t.location} — ${t.licensePlate || t.vehicleId || 'Unknown trailer'}\nReady to move to DD`,
                    timeout: 8000,
                    onclick: () => window.focus(),
                });
            } catch (e) {
                // Fallback if GM_notification not available
                console.log(`[EmptyAZNG] 🔔 NEW: ${t.location} — ${t.licensePlate || t.vehicleId}`);
            }

            knownTrailers.set(t.id, { lastNotified: now, data: t });
        }

        // Clean up trailers that are no longer present
        const currentIds = new Set(trailers.map(t => t.id));
        for (const [id] of knownTrailers) {
            if (!currentIds.has(id)) {
                knownTrailers.delete(id);
            }
        }
    }

    // ─── Status bar update ──────────────────────────────────────────────────
    function updateStatus(msg) {
        const statusEl = document.getElementById('azng-tracker-status');
        if (statusEl) statusEl.textContent = msg;
    }

    // ─── Audio alert for new trailers ───────────────────────────────────────
    function playAlert() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = 800;
            gain.gain.value = 0.3;
            osc.start();
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
            osc.stop(ctx.currentTime + 0.5);
        } catch (e) { /* audio not available */ }
    }

    // ─── Main scan loop ─────────────────────────────────────────────────────
    function runScan() {
        // If user clicked a trailer and the table is filtered, use cached results
        if (searchActive) {
            updatePanel(cachedPsResults, cachedDdResults);
            const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const availableCount = cachedPsResults.filter(t => !t.hasMaintenance).length;
            updateStatus(`Last scan: ${now} | PS: ${availableCount} available | DD: ${cachedDdResults.length} docked | 🔍 Search active`);
            return;
        }

        const { psResults, ddResults } = scanForEmptyAZNG();
        const availableCount = psResults.filter(t => !t.hasMaintenance).length;

        // Cache results for when search is active
        if (psResults.length > 0 || ddResults.length > 0) {
            cachedPsResults = psResults;
            cachedDdResults = ddResults;
        }

        updatePanel(psResults, ddResults);

        // Check for new trailers that weren't in previous scan
        const newTrailers = psResults.filter(t => !t.hasMaintenance && !knownTrailers.has(t.id));
        if (newTrailers.length > 0 && scanCount > 1) {
            playAlert();
        }

        notifyNewTrailers(psResults);

        const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        updateStatus(`Last scan: ${now} | PS: ${availableCount} available | DD: ${ddResults.length} docked | Scan #${scanCount}`);

        console.log(`[EmptyAZNG] Scan #${scanCount}: PS=${availableCount} available, DD=${ddResults.length} docked`);
    }

    // ─── Initialize ─────────────────────────────────────────────────────────
    function init() {
        // Wait for the yard table to be present
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds

        const waitForTable = setInterval(() => {
            attempts++;
            const tables = document.querySelectorAll('table');
            let found = false;

            for (const table of tables) {
                const text = table.textContent;
                if (text.includes('Location') && (text.includes('Owner') || text.includes('Operator'))) {
                    found = true;
                    break;
                }
            }

            if (found || attempts >= maxAttempts) {
                clearInterval(waitForTable);

                if (!found) {
                    console.warn('[EmptyAZNG] Yard table not found after waiting. Panel will show when data loads.');
                }

                createPanel();
                runScan();

                // Set up recurring scan
                setInterval(runScan, CONFIG.SCAN_INTERVAL_MS);

                // Also scan when the page auto-refreshes (YMS refreshes every ~3 min)
                const observer = new MutationObserver((mutations) => {
                    // If significant DOM changes happen (table refresh), re-scan after a brief delay
                    let significant = false;
                    for (const m of mutations) {
                        if (m.addedNodes.length > 3 || m.removedNodes.length > 3) {
                            significant = true;
                            break;
                        }
                    }
                    if (significant) {
                        setTimeout(runScan, 2000);
                    }
                });

                observer.observe(document.body, { childList: true, subtree: true });
                console.log('[EmptyAZNG] ✓ Tracker initialized — scanning every', CONFIG.SCAN_INTERVAL_MS / 1000, 'seconds');
            }
        }, 500);
    }

    // Start after a brief delay for page to settle
    setTimeout(init, 3000);

})();
