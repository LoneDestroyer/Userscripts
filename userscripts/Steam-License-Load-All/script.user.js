// ==UserScript==
// @name        Steam Licenses - Load All
// @description Loads all additional Steam license pages. (Due to Steam limiting to 100 per page)
// @author      Lone Destroyer
// @namespace   https://github.com/LoneDestroyer
// @license     MIT
// @version     1.0
// @icon        https://store.steampowered.com/favicon.ico
// @match       https://store.steampowered.com/account/licenses*
// @grant       none
// @downloadURL https://raw.githubusercontent.com/LoneDestroyer/Userscripts/main/userscripts/Steam-License-Load-All/script.user.js
// @updateURL   https://raw.githubusercontent.com/LoneDestroyer/Userscripts/main/userscripts/Steam-License-Load-All/script.user.js
// ==/UserScript==

(function () {
    'use strict';

    const $ = window.jQuery;
    if (!$) {
        return;
    }

    const table = $('table').first();
    const tableBody = table.find('tbody').first();
    const tableBodyEl = tableBody[0];

    if (!table.length || !tableBody.length) {
        return;
    }

    const stopStatus = () => `Stopped. ${loaded} licenses loaded from ${pageCount} page(s).`;
    const normalizeUrl = href => (href ? new URL(href, window.location.href).toString() : '');

    // SteamDB Functionality (Adds the SteamDB column to the license table)
    const hasSteamDbLicenseColumn = table.find('th.steamdb_license_id_col, td.steamdb_license_id_col').length > 0;

    // Keep the addon-created SteamDB column in sync for rows we append later.
    function addSteamDbLicenseColumn(row) {
        if (!hasSteamDbLicenseColumn || row.querySelector('.steamdb_license_id_col')) {
            return;
        }

        // SteamDB already patched the original table; only clone that behavior for rows we append later.
        const nameCell = row.cells[1];
        if (!nameCell) {
            return;
        }

        if (nameCell.tagName === 'TH') {
            // Header rows should stay a plain column label.
            const headerCell = document.createElement('th');
            headerCell.className = 'steamdb_license_id_col';
            headerCell.textContent = 'SteamDB';
            nameCell.after(headerCell);
            return;
        }

        const removeElement = nameCell.querySelector('.free_license_remove_link a');

        const newCell = document.createElement('td');
        newCell.className = 'steamdb_license_id_col';

        const link = document.createElement('a');

        if (removeElement) {
            // Free licenses expose a package id in the remove link, which SteamDB links directly.
            const subidMatch = removeElement.href.match(/RemoveFreeLicense\( ?(?<subid>[0-9]+)/);

            if (subidMatch) {
                const subid = subidMatch.groups.subid;
                link.href = `https://steamdb.info/sub/${subid}/`;
                link.textContent = subid;
            }
        }

        if (!link.href) {
            // Non-subid rows still get a usable SteamDB link, but it points to search instead.
            const params = new URLSearchParams();
            params.set('a', 'sub');
            params.set('q', nameCell.textContent.trim());
            link.href = `https://steamdb.info/search/?${params.toString()}`;
            link.textContent = 'Search';
        }

        newCell.append(link);
        nameCell.after(newCell);
    }
    // End SteamDB Functionality

    let isRunning = false;
    let isPaused = false;
    let loaded = 0;
    let pageCount = 0;
    let delay = 0;
    const maxDelay = 5000;
    const requestTimeoutMs = 20000;
    let retryCount = 0;
    let nextUrl = normalizeUrl($('a.license_paginator_next').first().attr('href') || '');
    let shouldStop = false;
    let currentRequest = null;

    const paginator = $('.license_paginator_ctn').first();
    const loadButton = $([
        '<a href="#" class="license_paginator_next steam-license-loader-button">',
        '  <span class="steam-license-loader-icon" aria-hidden="true"></span>',
        '  <span class="steam-license-loader-label">Load all licenses</span>',
        '</a>'
    ].join(''));
    const loadButtonLabel = loadButton.find('.steam-license-loader-label');
    const status = $('<div class="steam-license-loader-status">Ready to load additional license pages.</div>');

    // Put the loader in the same control area Steam already uses when possible.
    if (paginator.length) {
        paginator.prepend(loadButton);
        paginator.after(status);
    } else {
        const controls = $('<div class="steam-license-loader-controls"></div>');
        controls.append(loadButton, status);
        table.before(controls);
    }

    const style = `
        .steam-license-loader-controls { margin: 8px 0 12px; }
        .steam-license-loader-button.license_paginator_next { margin-right: auto; }
        .steam-license-loader-label { min-width: 100px; display: inline-block; text-align: center; }
        .steam-license-loader-icon { display: inline-block; width: 10px; height: 10px; margin-right: 6px; vertical-align: -1px; position: relative; }
        .steam-license-loader-button .steam-license-loader-icon::before { content: ''; position: absolute; }
        .steam-license-loader-button.steam-license-loader-idle .steam-license-loader-icon::before { left: 1px; top: 0; width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 8px solid #ffffff; }
        .steam-license-loader-button.steam-license-loader-running .steam-license-loader-icon::before { left: 1px; top: 1px; width: 8px; height: 8px; background: linear-gradient(to right, #ffffff 0 3px, transparent 3px 5px, #ffffff 5px 8px); }
        .steam-license-loader-button.steam-license-loader-paused .steam-license-loader-icon::before { left: 1px; top: 1px; width: 8px; height: 8px; background: #ffffff; }
        .steam-license-loader-button.steam-license-loader-running { background-color: #2a8f5a; }
        .steam-license-loader-button.steam-license-loader-paused { background-color: #5b6571; }
        .steam-license-loader-button.steam-license-loader-paused .steam-license-loader-icon::before { background: #ffd27d; }
        .steam-license-loader-button.steam-license-loader-done { background-color: #4f6b22; }
        .steam-license-loader-button.steam-license-loader-done .steam-license-loader-icon::before { left: 1px; top: 1px; width: 6px; height: 3px; border-left: 2px solid #ffffff; border-bottom: 2px solid #ffffff; transform: rotate(-45deg); }
        .steam-license-loader-status { margin-top: 6px; color: #acb2b8; font-size: 12px; }
    `;

    if (!document.getElementById('steam-license-loader-style')) {
        $('<style id="steam-license-loader-style"></style>').text(style).appendTo('head');
    }

    function updateStatus(text) {
        status.text(text);
        console.log(text);
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function setControlState(state) {
        loadButton.removeClass('steam-license-loader-idle steam-license-loader-running steam-license-loader-paused steam-license-loader-done');

        if (state === 'running') {
            // Running state doubles as the pause button.
            isRunning = true;
            isPaused = false;
            loadButton.addClass('steam-license-loader-running');
            loadButtonLabel.text('Pause loading');
            return;
        }

        isRunning = false;

        if (state === 'paused') {
            isPaused = true;
            loadButton.addClass('steam-license-loader-paused');
            loadButtonLabel.text('Paused');
            return;
        }

        isPaused = false;

        if (state === 'done') {
            loadButton.addClass('steam-license-loader-done');
            loadButtonLabel.text('All loaded');
            return;
        }

        loadButton.addClass('steam-license-loader-idle');
        loadButtonLabel.text('Load all licenses');
    }

    function loadPage(url) {
        return new Promise(resolve => {
            // Fetch one license page at a time so we can back off on rate limits.
            currentRequest = $.ajax({
                url,
                method: 'GET',
                dataType: 'text',
                timeout: requestTimeoutMs
            });

            currentRequest.done(function (responseText) {
                let parsed;
                try {
                    parsed = new DOMParser().parseFromString(responseText, 'text/html');
                } catch (error) {
                    resolve({ statusText: 'parseerror', xhr: currentRequest, rows: null, nextHref: '' });
                    return;
                }

                const body = parsed.querySelector('table tbody');
                const rows = body ? body.querySelectorAll('tr') : [];
                const nextAnchor = parsed.querySelector('a.license_paginator_next');
                const nextHref = normalizeUrl(nextAnchor ? nextAnchor.getAttribute('href') || '' : '');

                resolve({ statusText: 'success', xhr: currentRequest, rows, nextHref });
            });

            currentRequest.fail(function (xhr, statusText) {
                resolve({ rows: null, nextHref: '', statusText, xhr });
            });

            currentRequest.always(function () {
                currentRequest = null;
            });
        });
    }

    async function loadAllPages() {
        if (isRunning) {
            return;
        }

        if (!nextUrl) {
            updateStatus('All visible licenses are already loaded.');
            setControlState('done');
            return;
        }

        const resuming = isPaused;
        shouldStop = false;
        setControlState('running');

        if (!resuming) {
            loaded = 0;
            pageCount = 0;
            delay = 0;
            retryCount = 0;
        }

        try {
            updateStatus(resuming ? 'Resuming license loading...' : 'Loading additional license pages...');

            while (nextUrl) {
                if (shouldStop) {
                    updateStatus(stopStatus());
                    break;
                }

                if (delay > 0) {
                    await sleep(delay);

                    if (shouldStop) {
                        updateStatus(stopStatus());
                        break;
                    }
                }

                const { rows, nextHref, statusText, xhr } = await loadPage(nextUrl);

                if (statusText === 'abort') {
                    updateStatus(stopStatus());
                    break;
                }

                if (
                    statusText === 'error' &&
                    xhr &&
                    (xhr.status === 429 || xhr.status === 500 || xhr.status === 503)
                ) {
                    // On Steam throttling, widen the delay and try the same page again.
                    retryCount += 1;
                    delay = Math.min(delay === 0 ? 250 : delay * 2, maxDelay);
                    updateStatus(`Steam is rate limiting. Retry ${retryCount}, waiting ${delay}ms...`);
                    continue;
                }

                if (statusText !== 'success' || !rows) {
                    const code = xhr && typeof xhr.status !== 'undefined' ? xhr.status : 'n/a';
                    const text = xhr && xhr.statusText ? xhr.statusText : statusText;
                    updateStatus(`Stopped: ${code} ${text}`);
                    break;
                }

                retryCount = 0;
                delay = 0;
                pageCount += 1;

                if (rows.length) {
                    // Keep the appended rows compatible with the SteamDB addon when it is installed.
                    const fragment = document.createDocumentFragment();
                    for (let i = 0; i < rows.length; i += 1) {
                        addSteamDbLicenseColumn(rows[i]);
                        fragment.appendChild(rows[i]);
                    }
                    tableBodyEl.appendChild(fragment);
                    loaded += rows.length;
                }

                nextUrl = nextHref;

                if (shouldStop) {
                    updateStatus(stopStatus());
                    break;
                }

                updateStatus(`Loading... ${loaded} licenses loaded from ${pageCount} page(s).`);
            }

            if (!nextUrl) {
                updateStatus(`Finished. Loaded ${loaded} additional licenses.`);
            }
        } finally {
            if (nextUrl) {
                setControlState(shouldStop ? 'paused' : 'idle');
            } else {
                setControlState('done');
            }
        }
    }

    loadButton.on('click', function (event) {
        event.preventDefault();

        if (isRunning) {
            // Click while running to stop
            shouldStop = true;
            if (currentRequest) {
                currentRequest.abort();
            }
            return;
        }

        loadAllPages();
    });

    loadButton.on('mousedown', function (event) {
        event.preventDefault();
    });

    setControlState(nextUrl ? 'idle' : 'done');

})();