// ==UserScript==
// @name         SchedulingVETVTODashboard.user.js
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Overlay dashboard for scheduling.amazon.com that summarizes VET/VTO/READY opportunities by day and shift
// @author       You
// @match        https://scheduling.amazon.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    console.log('[SVD] KRB3 Scheduling Opportunities script loaded');

    // ─── Shift Config ───────────────────────────────────────────────────────────
    const DAY_SHIFT_START = 6.5;   // 06:30
    const DAY_SHIFT_END = 18.5;    // 18:30

    // ─── Get Site Name from Page ───────────────────────────────────────────────
    function getSiteName() {
        // Look for site selector button/dropdown text (e.g., "Site: KRB3")
        const siteBtn = document.querySelector('[class*="site"] button, button[class*="site"], .navbar-text, .nav button');
        if (siteBtn) {
            const match = siteBtn.textContent.match(/Site:\s*(\w+)/i);
            if (match) return match[1];
        }
        // Fallback: check URL for site parameter
        const urlMatch = window.location.href.match(/[?&]site[=:](\w+)/i);
        if (urlMatch) return urlMatch[1];
        // Fallback: look for any element with site info
        const allBtns = document.querySelectorAll('button, .btn, .dropdown-toggle');
        for (const btn of allBtns) {
            const match = btn.textContent.match(/Site:\s*(\w+)/i);
            if (match) return match[1];
        }
        return 'Site';
    }
    const ALLOWED_WORK_GROUPS = ['inbound', 'da', 'ic/qa/cs', 'rc picking', 'rc sort'];

    function isAllowedWorkGroup(workGroup) {
        const normalized = workGroup.trim().toLowerCase();
        return ALLOWED_WORK_GROUPS.some(g => normalized === g || normalized.includes(g));
    }

    // ─── Helpers ────────────────────────────────────────────────────────────────

    function parseTime(str) {
        const parts = str.trim().split(':');
        if (parts.length !== 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h + m / 60;
    }

    function calcDuration(startStr, endStr) {
        const s = parseTime(startStr);
        const e = parseTime(endStr);
        if (s === null || e === null) return 0;
        let dur = e - s;
        if (dur <= 0) dur += 24;
        return dur;
    }

    function classifyShift(dateStr, startTimeStr) {
        const startTime = parseTime(startTimeStr);
        if (startTime === null) return { shift: 'Unknown', shiftDay: dateStr || 'Unknown Date' };

        let shift = '';

        if (startTime >= DAY_SHIFT_START && startTime < DAY_SHIFT_END) {
            shift = 'Day Shift (06:30 - 18:30)';
        } else {
            shift = 'Night Shift (18:30 - 06:30)';
        }

        // Use the date as-is from the page container — the page already groups by correct date
        return { shift, shiftDay: formatShiftDate(dateStr) };
    }

    function formatShiftDate(dateStr) {
        if (!dateStr) return 'Unknown Date';
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const parsed = new Date(y, m, d);
        if (isNaN(parsed.getTime())) return dateStr;
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return `${dateStr} ${days[parsed.getDay()]}`;
    }

    function formatDateISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    // ─── Scrape opportunities from page ─────────────────────────────────────────

    function scrapeOpportunities() {
        const opportunities = [];

        // Strategy 1: Angular date_container structure
        const dateContainers = document.querySelectorAll('.date_container');
        console.log('[SVD] Strategy 1 - date_containers found:', dateContainers.length);

        if (dateContainers.length > 0) {
            for (const container of dateContainers) {
                const h5 = container.querySelector('h5');
                let currentDate = '';
                if (h5) {
                    const dateMatch = h5.textContent.trim().match(/(\d{4}-\d{2}-\d{2})/);
                    if (dateMatch) currentDate = dateMatch[1];
                }

                // Find all tr elements within this container
                const allRows = container.querySelectorAll('tr');
                console.log('[SVD] Container date:', currentDate, '| rows:', allRows.length);

                parseRows(allRows, currentDate, opportunities);
            }
        }

        // Strategy 2: Find tables near h5 date headers
        if (opportunities.length === 0) {
            console.log('[SVD] Strategy 2 - looking for h5 date headers');
            const allH5 = document.querySelectorAll('h5');
            for (const h5 of allH5) {
                const dateMatch = h5.textContent.trim().match(/(\d{4}-\d{2}-\d{2})/);
                if (!dateMatch) continue;
                const currentDate = dateMatch[1];

                // Walk up to find the parent container, then find table within
                let parent = h5.parentElement;
                while (parent) {
                    const table = parent.querySelector('table');
                    if (table) {
                        const rows = table.querySelectorAll('tr');
                        parseRows(rows, currentDate, opportunities);
                        break;
                    }
                    // Check next sibling
                    if (parent.nextElementSibling) {
                        const table2 = parent.nextElementSibling.querySelector('table');
                        if (table2) {
                            const rows = table2.querySelectorAll('tr');
                            parseRows(rows, currentDate, opportunities);
                            break;
                        }
                    }
                    parent = parent.parentElement;
                }
            }
        }

        // Strategy 3: Any table on the page with time-like data
        if (opportunities.length === 0) {
            console.log('[SVD] Strategy 3 - scanning all tables');
            const allTables = document.querySelectorAll('table');
            for (const table of allTables) {
                const rows = table.querySelectorAll('tr');
                if (rows.length < 2) continue;

                // Find date from context
                let currentDate = '';
                let el = table;
                while (el && !currentDate) {
                    el = el.parentElement;
                    if (el) {
                        const h5 = el.querySelector('h5');
                        if (h5) {
                            const dm = h5.textContent.match(/(\d{4}-\d{2}-\d{2})/);
                            if (dm) currentDate = dm[1];
                        }
                    }
                }

                parseRows(rows, currentDate, opportunities);
            }
        }

        console.log('[SVD] Total opportunities scraped:', opportunities.length);
        return opportunities;
    }

    /**
     * Parse table rows, auto-detecting columns by scanning cell content.
     * The page has extra cells (checkbox, icon) before the data that headers don't account for.
     * So we detect columns from actual data content rather than relying on header indices.
     */
    function parseRows(rows, currentDate, opportunities) {
        if (!rows || rows.length < 2) return;

        // Detect columns from ACTUAL DATA ROW content (not headers)
        // because headers don't match cell count due to hidden checkbox/icon columns
        let workGroupCol = -1, typeCol = -1, headcountCol = -1, startCol = -1, endCol = -1;

        // Scan first few data rows to identify column positions by content
        for (const row of rows) {
            if (row.querySelector('th')) continue;
            const cells = row.querySelectorAll('td');
            if (cells.length < 5) continue;

            for (let i = 0; i < cells.length; i++) {
                const txt = cells[i].textContent.trim();
                const upper = txt.toUpperCase();

                // Type column: contains VET, VTO, READY, or MET
                if (typeCol === -1 && (upper === 'VET' || upper === 'VTO' || upper === 'READY' || upper === 'MET')) {
                    typeCol = i;
                }
                // Headcount column: N/N pattern
                else if (headcountCol === -1 && /^\d+\s*\/\s*\d+$/.test(txt)) {
                    headcountCol = i;
                }
                // Time columns: bare HH:MM (not followed by extra text like "Jul 03")
                else if (/^\d{1,2}:\d{2}$/.test(txt)) {
                    if (startCol === -1) startCol = i;
                    else if (endCol === -1 && i === startCol + 1) endCol = i;
                }
                // Work group: text that's not a type, not a number, not a time
                else if (workGroupCol === -1 && txt.length > 1 && txt.length < 30
                    && !/^\d/.test(txt) && !/^\d{1,2}:\d{2}/.test(txt)
                    && upper !== 'VET' && upper !== 'VTO' && upper !== 'READY' && upper !== 'MET'
                    && !txt.includes('Clone') && !txt.includes('APPROVED') && !txt.includes('Lock')) {
                    workGroupCol = i;
                }
            }
            if (typeCol !== -1 && headcountCol !== -1 && startCol !== -1 && endCol !== -1 && workGroupCol !== -1) break;
        }

        console.log('[SVD] Detected cols from data - wg:', workGroupCol, 'type:', typeCol, 'hc:', headcountCol, 'start:', startCol, 'end:', endCol);

        if (startCol === -1 || endCol === -1) {
            console.log('[SVD] Could not detect start/end time columns from data');
            return;
        }

        // Parse data rows
        let parsed = 0;
        for (const row of rows) {
            if (row.querySelector('th')) continue;

            const cells = row.querySelectorAll('td');
            if (cells.length < Math.max(startCol, endCol) + 1) continue;

            const startText = cells[startCol].textContent.trim();
            const endText = cells[endCol].textContent.trim();

            // Validate time format
            if (!/^\d{1,2}:\d{2}$/.test(startText) || !/^\d{1,2}:\d{2}$/.test(endText)) continue;

            // Extract work group
            const workGroup = workGroupCol >= 0 && workGroupCol < cells.length ? cells[workGroupCol].textContent.trim() : 'Unknown';

            // Filter work groups
            if (!isAllowedWorkGroup(workGroup)) continue;

            // Extract type
            const typeText = typeCol >= 0 && typeCol < cells.length ? cells[typeCol].textContent.trim().toUpperCase() : '';

            // Extract headcount
            const headcountText = headcountCol >= 0 && headcountCol < cells.length ? cells[headcountCol].textContent.trim() : '0';

            let accepted = 0, offered = 0;
            const hcMatch = headcountText.match(/(\d+)\s*\/\s*(\d+)/);
            if (hcMatch) { accepted = parseInt(hcMatch[1], 10); offered = parseInt(hcMatch[2], 10); }
            else { accepted = parseInt(headcountText, 10) || 0; offered = accepted; }

            // Type: exact match from page
            let oppType = 'Unknown';
            if (typeText === 'VET') oppType = 'VET';
            else if (typeText === 'VTO') oppType = 'VTO';
            else if (typeText === 'READY') oppType = 'READY';
            else if (typeText === 'MET') oppType = 'MET';
            else if (typeText.includes('READY')) oppType = 'READY';
            else if (typeText.includes('VTO')) oppType = 'VTO';
            else if (typeText.includes('VET')) oppType = 'VET';
            else oppType = typeText || 'Unknown';

            const duration = calcDuration(startText, endText);
            const { shift, shiftDay } = classifyShift(currentDate, startText);

            opportunities.push({
                workGroup,
                type: oppType,
                accepted,
                offered,
                startTime: startText,
                endTime: endText,
                duration,
                totalHours: accepted * duration,
                date: currentDate,
                shift,
                shiftDay,
                headcountCell: cells[headcountCol] || null
            });
            parsed++;
        }
        console.log('[SVD] Parsed', parsed, 'rows from this section');
    }

    // ─── Render Dashboard ───────────────────────────────────────────────────────

    function renderDashboard() {
        const opportunities = scrapeOpportunities();

        // Filter out opportunities that have already ended
        const now = new Date();
        const todayISO = formatDateISO(now);
        const currentTime = now.getHours() + now.getMinutes() / 60;

        const activeOpportunities = opportunities.filter(opp => {
            // If the date is in the future, always show
            if (opp.date > todayISO) return true;
            // If the date is in the past, don't show
            if (opp.date < todayISO) return false;
            // If it's today, only show if start time hasn't passed yet
            const startTime = parseTime(opp.startTime);
            if (startTime === null) return true;
            return startTime > currentTime;
        });

        // Group: Day → Shift → opportunities
        const byDay = {};
        for (const opp of activeOpportunities) {
            const day = opp.shiftDay || 'Unknown Date';
            const shift = opp.shift || 'Unknown Shift';
            if (!byDay[day]) byDay[day] = {};
            if (!byDay[day][shift]) byDay[day][shift] = [];
            byDay[day][shift].push(opp);
        }



        // Build HTML
        let bodyHTML = '';
        const sortedDays = Object.keys(byDay).sort();

        for (const day of sortedDays) {
            const dayShifts = byDay[day];
            const dayOpps = Object.values(dayShifts).flat();
            const dayTotalHours = dayOpps.reduce((s, e) => s + e.totalHours, 0);

            bodyHTML += `<div class="svd-day-section">
                <div class="svd-day-header">
                    <span class="svd-day-name">\u{1F4C5} ${day}</span>
                    <span class="svd-day-totals">${dayTotalHours.toFixed(1)} total hrs</span>
                </div>`;

            // Sort shifts by earliest start time (whichever has the soonest opportunity goes first)
            const sortedShifts = Object.keys(dayShifts).sort((a, b) => {
                const aEarliest = Math.min(...dayShifts[a].map(o => parseTime(o.startTime) || 99));
                const bEarliest = Math.min(...dayShifts[b].map(o => parseTime(o.startTime) || 99));
                return aEarliest - bEarliest;
            });

            for (const shift of sortedShifts) {
                const shiftOpps = dayShifts[shift];
                const shiftTotalHours = shiftOpps.reduce((s, e) => s + e.totalHours, 0);
                const shiftOppCount = shiftOpps.length;
                const shiftIcon = shift.includes('Day') ? '\u2600\uFE0F' : '\u{1F319}';
                const shiftId = `svd-shift-${day}-${shift}`.replace(/[^a-zA-Z0-9]/g, '_');

                bodyHTML += `<div class="svd-shift-section">
                    <div class="svd-shift-header">
                        <span class="svd-shift-name">${shiftIcon} ${shift}</span>
                        <button class="svd-copy-logins-btn" data-shift-id="${shiftId}">Copy Logins</button>
                        <span class="svd-shift-totals">${shiftOppCount} opps | ${shiftTotalHours.toFixed(1)} hrs</span>
                    </div>
                    <table class="svd-tbl">
                        <thead><tr><th>Type</th><th>Work Group</th><th>Time</th><th>HC</th><th>Duration</th><th>Total Hours</th></tr></thead>
                        <tbody>`;

                shiftOpps.sort((a, b) => (parseTime(a.startTime) || 0) - (parseTime(b.startTime) || 0));

                for (const entry of shiftOpps) {
                    const typeColor = entry.type === 'VTO' ? '#a6e3a1' : entry.type === 'VET' ? '#89b4fa' : entry.type === 'READY' ? '#f9e2af' : '#cba6f7';
                    bodyHTML += `<tr>
                        <td><span style="color:${typeColor};font-weight:bold;">${entry.type}</span></td>
                        <td>${entry.workGroup}</td>
                        <td>${entry.startTime} - ${entry.endTime}</td>
                        <td>${entry.accepted}/${entry.offered}</td>
                        <td>${entry.duration.toFixed(2)} hrs</td>
                        <td style="font-weight:bold;">${entry.totalHours.toFixed(1)} hrs</td>
                    </tr>`;
                }
                bodyHTML += `</tbody></table>
                </div>`;

                // Store opportunities reference for this shift
                window.__svdShiftData = window.__svdShiftData || {};
                window.__svdShiftData[shiftId] = shiftOpps;
            }
            bodyHTML += `</div>`;
        }

        if (activeOpportunities.length === 0) {
            bodyHTML = `<div style="padding:12px;color:#f38ba8;text-align:center;">
                No opportunities detected yet.<br>
                <span style="font-size:11px;color:#a6adc8;">
                    Check console (F12) for [SVD] debug messages.<br>
                    The page may still be loading - click refresh to retry.
                </span>
            </div>`;
        }

        const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        let container = document.getElementById('svd-dash');
        if (!container) {
            container = document.createElement('div');
            container.id = 'svd-dash';
            document.body.appendChild(container);
        }

        container.innerHTML = `
            <div class="svd-header">
                <div class="svd-title">\u{1F4CB} ${getSiteName()} Scheduling Opportunities</div>
                <div class="svd-subtitle">Updated: ${timeStr}</div>
                <button id="svd-toggle" title="Minimize/Expand">\u25BC</button>
                <button id="svd-refresh" title="Refresh data">\u{1F504}</button>
            </div>
            <div class="svd-body">${bodyHTML}</div>
        `;

        document.getElementById('svd-toggle').addEventListener('click', function() {
            const body = container.querySelector('.svd-body');
            if (body.style.display === 'none') { body.style.display = ''; this.textContent = '\u25BC'; }
            else { body.style.display = 'none'; this.textContent = '\u25B2'; }
        });

        document.getElementById('svd-refresh').addEventListener('click', () => renderDashboard());
    }

    // ─── Copy Logins Handler (delegated) ────────────────────────────────────────
    // Use event delegation so it survives re-renders
    document.addEventListener('click', async function(e) {
        const btn = e.target.closest('.svd-copy-logins-btn');
        if (!btn) return;

        const shiftId = btn.dataset.shiftId;
        const opps = window.__svdShiftData && window.__svdShiftData[shiftId];
        if (!opps || opps.length === 0) {
            btn.textContent = 'No data';
            setTimeout(() => { btn.textContent = 'Copy Logins'; }, 2000);
            return;
        }

        btn.textContent = 'Fetching...';
        btn.disabled = true;

        try {
            const allEntries = [];

            for (const opp of opps) {
                if (!opp.headcountCell) continue;
                if (opp.accepted === 0) continue;

                const link = opp.headcountCell.querySelector('a');
                if (!link) continue;

                console.log('[SVD] Clicking headcount for:', opp.workGroup, opp.startTime, '-', opp.endTime);
                link.click();

                await waitForElement('.modal', 3000);
                await sleep(1000);

                // Find and click "Accepted List" tab
                const allTabs = document.querySelectorAll('.modal .nav-tabs a, .modal .nav-tabs li a, .modal a.nav-link, .modal [uib-tab-heading-transclude], .nav-tabs a');
                let acceptedTab = null;
                for (const tab of allTabs) {
                    if (tab.textContent.includes('Accepted')) {
                        acceptedTab = tab;
                        break;
                    }
                }

                if (acceptedTab) {
                    acceptedTab.click();
                    await sleep(500);
                    await waitForElement('.modal table tbody tr td', 3000);
                    await sleep(500);
                }

                // Grab employee name + login from the accepted list table
                const modalEl = document.querySelector('.modal');
                if (modalEl) {
                    const tables = modalEl.querySelectorAll('table');
                    for (const table of tables) {
                        if (table.offsetParent === null) continue;
                        const rows = table.querySelectorAll('tbody tr, tr');
                        for (const row of rows) {
                            if (row.querySelector('th')) continue;
                            const cells = row.querySelectorAll('td');
                            if (cells.length >= 2) {
                                const employeeName = cells[0].textContent.trim();
                                let login = '';
                                for (let ci = 1; ci < cells.length; ci++) {
                                    const linkEl = cells[ci].querySelector('a');
                                    if (linkEl) {
                                        const txt = linkEl.textContent.trim();
                                        if (txt && txt.length > 2 && txt.length < 20 && !/^\d+$/.test(txt) && !txt.includes(' ')) {
                                            login = txt;
                                            break;
                                        }
                                    }
                                }
                                if (login && employeeName) {
                                    const timeSlot = `${opp.startTime} - ${opp.endTime}`;
                                    allEntries.push({ name: employeeName, login, timeSlot, workGroup: opp.workGroup });
                                }
                            }
                        }
                    }
                }

                // Close modal
                const allBtns = document.querySelectorAll('.modal button, .modal-footer button, .modal .btn');
                let closeBtn = null;
                for (const b of allBtns) {
                    const txt = b.textContent.trim().toUpperCase();
                    if (txt === 'OK' || txt === 'CLOSE' || txt === 'X' || txt === '\u00D7') {
                        closeBtn = b;
                        break;
                    }
                }
                if (!closeBtn) {
                    closeBtn = document.querySelector('.modal .close, .modal button.close, .modal-header button');
                }
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27 }));
                }

                await sleep(600);
            }

            // Deduplicate by login
            const seen = new Set();
            const uniqueEntries = [];
            for (const entry of allEntries) {
                if (!seen.has(entry.login)) {
                    seen.add(entry.login);
                    uniqueEntries.push(entry);
                }
            }

            console.log('[SVD] Total unique entries found:', uniqueEntries.length);
            if (uniqueEntries.length > 0) {
                const text = uniqueEntries.map(e => `${e.name}\t${e.login}\t${e.timeSlot}`).join('\n');
                showCopyPopup(text, uniqueEntries.length);
                btn.textContent = `Found ${uniqueEntries.length}!`;
            } else {
                btn.textContent = 'No logins found';
            }
        } catch (err) {
            console.error('[SVD] Error fetching logins:', err);
            btn.textContent = 'Error';
        }

        btn.disabled = false;
        setTimeout(() => { btn.textContent = 'Copy Logins'; }, 3000);
    });

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function showCopyPopup(text, count) {
        // Remove existing popup if any
        const existing = document.getElementById('svd-copy-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'svd-copy-popup';
        popup.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-weight:bold;color:#89dceb;">${count} Associates Found</span>
                <button id="svd-popup-close" style="background:none;border:none;color:#f38ba8;font-size:18px;cursor:pointer;">\u2715</button>
            </div>
            <textarea id="svd-popup-text" readonly style="width:100%;height:200px;background:#1e1e2e;color:#cdd6f4;border:1px solid #45475a;border-radius:4px;padding:6px;font-family:monospace;font-size:11px;resize:vertical;">${text}</textarea>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <button id="svd-popup-copy" style="flex:1;padding:6px;background:#89b4fa;color:#1e1e2e;border:none;border-radius:4px;cursor:pointer;font-weight:bold;">Copy to Clipboard</button>
                <button id="svd-popup-select" style="flex:1;padding:6px;background:#45475a;color:#cdd6f4;border:1px solid #89dceb;border-radius:4px;cursor:pointer;">Select All</button>
            </div>
        `;
        popup.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#313244;border:2px solid #89dceb;border-radius:12px;padding:16px;min-width:400px;max-width:600px;box-shadow:0 8px 32px rgba(0,0,0,0.8);font-family:Segoe UI,Arial,sans-serif;';
        document.body.appendChild(popup);

        document.getElementById('svd-popup-close').addEventListener('click', () => popup.remove());

        document.getElementById('svd-popup-copy').addEventListener('click', function() {
            const textarea = document.getElementById('svd-popup-text');
            textarea.select();
            document.execCommand('copy');
            this.textContent = 'Copied!';
            this.style.background = '#a6e3a1';
            setTimeout(() => { this.textContent = 'Copy to Clipboard'; this.style.background = '#89b4fa'; }, 2000);
        });

        document.getElementById('svd-popup-select').addEventListener('click', () => {
            const textarea = document.getElementById('svd-popup-text');
            textarea.select();
        });
    }

    function copyToClipboard(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    function waitForElement(selector, timeout) {
        return new Promise((resolve) => {
            const el = document.querySelector(selector);
            if (el) { resolve(el); return; }

            const observer = new MutationObserver(() => {
                const el = document.querySelector(selector);
                if (el) { observer.disconnect(); resolve(el); }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
        });
    }

    // ─── Inject Styles ──────────────────────────────────────────────────────────

    function injectStyles() {
        if (document.getElementById('svd-styles')) return;
        const style = document.createElement('style');
        style.id = 'svd-styles';
        style.textContent = `
            #svd-dash {
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 2147483647;
                background: #1e1e2e;
                border: 2px solid #89dceb;
                border-radius: 12px;
                box-shadow: 0 4px 24px rgba(0,0,0,0.7);
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 13px;
                color: #cdd6f4;
                max-width: 580px;
                min-width: 360px;
                max-height: 85vh;
                overflow: hidden;
                display: flex;
                flex-direction: column;
            }
            .svd-header {
                background: #313244;
                padding: 10px 14px;
                border-bottom: 2px solid #89dceb;
                position: relative;
            }
            .svd-title { font-size: 16px; font-weight: bold; color: #89dceb; }
            .svd-subtitle { font-size: 11px; color: #a6adc8; margin-top: 2px; }
            .svd-grand-totals { display: flex; gap: 16px; margin-top: 8px; flex-wrap: wrap; }
            .svd-stat { font-size: 13px; font-weight: bold; }
            .svd-stat-label { color: #a6adc8; font-weight: normal; }
            #svd-toggle, #svd-refresh {
                position: absolute; top: 10px; background: none;
                border: 1px solid #89dceb; color: #89dceb; border-radius: 4px;
                cursor: pointer; font-size: 12px; padding: 2px 6px;
            }
            #svd-toggle { right: 40px; }
            #svd-refresh { right: 12px; }
            #svd-toggle:hover, #svd-refresh:hover { background: #45475a; }
            .svd-body { overflow-y: auto; padding: 8px 12px 12px; max-height: 65vh; }
            .svd-day-section { margin-bottom: 16px; border: 1px solid #45475a; border-radius: 8px; overflow: hidden; }
            .svd-day-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 12px; background: #181825; border-bottom: 1px solid #45475a;
            }
            .svd-day-name { font-weight: bold; color: #cba6f7; font-size: 14px; }
            .svd-day-totals { color: #89dceb; font-weight: bold; font-size: 12px; }
            .svd-shift-section { margin: 6px 8px; border: 1px solid #313244; border-radius: 6px; overflow: hidden; }
            .svd-shift-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 5px 10px; background: #1e1e2e; border-bottom: 1px solid #313244;
            }
            .svd-shift-name { font-weight: bold; color: #fab387; font-size: 13px; }
            .svd-shift-totals { color: #89dceb; font-size: 12px; }
            .svd-tbl { width: 100%; border-collapse: collapse; margin-top: 4px; }
            .svd-tbl th { background: #313244; color: #bac2de; padding: 3px 6px; text-align: left; font-size: 11px; text-transform: uppercase; }
            .svd-tbl td { padding: 3px 6px; border-bottom: 1px solid #313244; font-size: 12px; }
            .svd-tbl tr:hover td { background: #313244; }
            .svd-copy-logins-btn {
                padding: 2px 8px;
                background: #45475a;
                border: 1px solid #89b4fa;
                color: #89b4fa;
                border-radius: 4px;
                cursor: pointer;
                font-size: 10px;
                font-weight: bold;
            }
            .svd-copy-logins-btn:hover { background: #585b70; }
            .svd-copy-logins-btn:disabled { opacity: 0.6; cursor: wait; }
        `;
        document.head.appendChild(style);
    }

    // ─── Init ───────────────────────────────────────────────────────────────────

    function startDashboard() {
        console.log('[SVD] Starting dashboard...');
        injectStyles();
        renderDashboard();

        // Retry a few times until we find data, then stop to avoid scroll issues
        let retries = 0;
        const retryInterval = setInterval(() => {
            retries++;
            // Only re-render if we haven't found data yet or first 5 retries
            const container = document.getElementById('svd-dash');
            const body = container ? container.querySelector('.svd-body') : null;
            const hasData = body && !body.textContent.includes('No opportunities detected');
            if (!hasData && retries <= 10) {
                renderDashboard();
            } else {
                clearInterval(retryInterval);
            }
        }, 3000);
    }

    let started = false;
    function tryStart() {
        if (started) return;
        started = true;
        startDashboard();
    }

    tryStart();

    window.addEventListener('hashchange', () => {
        started = false;
        const existing = document.getElementById('svd-dash');
        if (existing) existing.remove();
        tryStart();
    });

})();
