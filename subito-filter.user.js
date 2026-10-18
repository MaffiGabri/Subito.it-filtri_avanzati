// ==UserScript==
// @name         Subito.it - Filtri Avanzati & Automazione
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Filtra annunci su Subito.it, rimuove pubblicità, auto-scroll e cambio pagina intelligente
// @author       MaffiGabri
// @match        *://*.subito.it/*
// @grant        none
// @homepageURL  https://github.com/MaffiGabri/Subito.it-filtri_avanzati/
// @supportURL   https://github.com/MaffiGabri/Subito.it-filtri_avanzati/issues
// @updateURL    https://raw.githubusercontent.com/MaffiGabri/Subito.it-filtri_avanzati/main/subito-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/MaffiGabri/Subito.it-filtri_avanzati/main/subito-filter.user.js
// ==/UserScript==

(function() {
    'use strict';

    // --- 1. CONFIGURAZIONE E STATO GLOBALE ---
    const CARD_SELECTOR = 'article[class*="card" i], [data-testid="item-card"]';
    const PAGINATION_SELECTOR = 'nav[class*="pagination-container" i], .pagination-container';
    const NEXT_BTN_SELECTOR = 'nav[class*="pagination" i] button[aria-label*="prossima pagina" i]';
    const LIST_START_SELECTOR = '[class*="ListingHeading-module" i], [data-testid="listing-container"], [class*="ItemListContainer-module" i]';
    const PANEL_WIDTH = 305;

    let savedMin = localStorage.getItem('subitoMinPrice');
    let savedMax = localStorage.getItem('subitoMaxPrice');
    if (savedMin === '0' || savedMin === 'NaN' || savedMin === null) savedMin = '';
    if (savedMax === 'Infinity' || savedMax === 'NaN' || savedMax === null) savedMax = '';

    const state = {
        minPrice: savedMin,
        maxPrice: savedMax,
        blacklist: localStorage.getItem('subitoBlacklist') || '',
        isActive: localStorage.getItem('subitoFilterActive') !== 'false',
        isMinimized: localStorage.getItem('subitoPanelMinimized') === 'true',
        isAdvOpen: localStorage.getItem('subitoAdvDropdownOpen') === 'true',
        hideSponsored: localStorage.getItem('subitoHideSponsored') === 'true',
        collapseMode: localStorage.getItem('subitoCollapseMode') === 'true',
        // Impostazioni Avanzate
        hideNoPrice: localStorage.getItem('subitoHideNoPrice') === 'true',
        hideCompanies: localStorage.getItem('subitoHideCompanies') === 'true',
        hideAdBanners: localStorage.getItem('subitoHideAdBanners') === 'true',
        autoStartList: localStorage.getItem('subitoAutoStartList') === 'true',
        autoScroll: localStorage.getItem('subitoAutoScroll') === 'true',
        autoScrollSpeed: parseFloat(localStorage.getItem('subitoAutoScrollSpeed')) || 5,
        autoSkip: localStorage.getItem('subitoAutoSkip') === 'true',
        autoSkipSeconds: parseFloat(localStorage.getItem('subitoAutoSkipSeconds')) || 3,
        smartAutomation: localStorage.getItem('subitoSmartAutomation') === 'true'
    };

    const adMetadataMap = new Map();

    // Variabili di stato per Auto-Scroll, Step-Scroll e Auto-Skip
    let autoScrollRaf = null;
    let stepScrollTimeout = null;
    let userPausedScroll = false;
    let isHoveringCard = false;
    let skipCountdownTimer = null;
    let skipRemainingTime = 0;
    let lastRowDetectedCount = null;
    let lastPageSignature = '';

    // --- 2. INDICIZZAZIONE DATI NASCOSTI (JSON-LD & NEXT_DATA) ---
    function indexPageData() {
        try {
            const nextDataEl = document.getElementById('__NEXT_DATA__');
            if (nextDataEl) {
                const nextData = JSON.parse(nextDataEl.textContent);
                const list = nextData?.props?.pageProps?.initialState?.items?.originalList;
                if (Array.isArray(list)) {
                    list.forEach(item => {
                        const url = item?.urls?.default;
                        if (url) {
                            const idMatch = url.match(/-(\d+)\.htm/);
                            const key = idMatch ? idMatch[1] : url;
                            adMetadataMap.set(key, {
                                body: (item.body || '').toLowerCase(),
                                isCompany: Boolean(item?.advertiser?.company),
                                shopName: (item?.advertiser?.shopName || '').toLowerCase()
                            });
                        }
                    });
                }
            }

            const ldScripts = document.querySelectorAll('script[type="application/ld+json"]');
            ldScripts.forEach(script => {
                const data = JSON.parse(script.textContent);
                const graph = data?.['@graph'];
                if (Array.isArray(graph)) {
                    graph.forEach(node => {
                        if (node.name && node.description) {
                            adMetadataMap.set(node.name.trim().toLowerCase(), {
                                body: node.description.toLowerCase(),
                                isCompany: false,
                                shopName: ''
                            });
                        }
                    });
                }
            });
        } catch (err) {
            // Ignora errori di parsing JSON
        }
    }

    // --- 3. CSS ---
    function injectStyles() {
        if (document.getElementById('tm-subito-styles')) return;

        const style = document.createElement('style');
        style.id = 'tm-subito-styles';
        style.textContent = `
            /* MODALITÀ FANTASMA */
            html body article.tm-filtered-card-ghost,
            html body .tm-filtered-card-ghost {
                opacity: 0.12 !important;
                filter: grayscale(100%) !important;
                transition: opacity 0.25s ease, filter 0.25s ease !important;
            }
            html body article.tm-filtered-card-ghost:hover,
            html body .tm-filtered-card-ghost:hover {
                opacity: 1 !important;
                filter: none !important;
            }

            /* SAFE COLLAPSE: Collassa card e relativi wrapper <div> o <li> nella griglia */
            html body article.tm-filtered-card-collapse,
            html body .tm-filtered-card-collapse,
            html body div[data-google-interstitial]:not(.items__item):has(> .tm-filtered-card-collapse),
            html body li:has(> .tm-filtered-card-collapse) {
                height: 0 !important;
                min-height: 0 !important;
                max-height: 0 !important;
                width: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                border: 0 !important;
                overflow: hidden !important;
                opacity: 0 !important;
                visibility: hidden !important;
                position: absolute !important;
                pointer-events: none !important;
            }

            /* NASCONDI BANNER PUBBLICITARI */
            html body.tm-hide-banners #apn_skin_tag,
            html body.tm-hide-banners #apnx_preroll_wrapper,
            html body.tm-hide-banners #banner_container,
            html body.tm-hide-banners section[aria-label="Banner promozionale"],
            html body.tm-hide-banners [class*="ListingContainer-module"][class*="__layout__aside"],
            html body.tm-hide-banners [class*="ListingContainer-module"][class*="__listingTop"],
            html body.tm-hide-banners [class*="ListingContainer-module"][class*="__adv"],
            html body.tm-hide-banners [class*="adsense-before-listing-container"],
            html body.tm-hide-banners [class*="lira-container"],
            html body.tm-hide-banners [class*="smart-adv-lira"],
            html body.tm-hide-banners .items__item.listing-widget:has([id^="listing-in-content-"]),
            html body.tm-hide-banners .items__item.listing-widget:has(article[class*="banner-module"]),
            html body.tm-hide-banners .listing-below {
                display: none !important;
                height: 0 !important;
                min-height: 0 !important;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden !important;
            }

            /* UI Pannello */
            #tm-filter-panel {
                position: fixed;
                background: #ffffff;
                border: 2px solid #ff3e41;
                border-radius: 10px;
                z-index: 999999;
                box-shadow: 0 10px 28px rgba(0,0,0,0.22);
                font-family: system-ui, -apple-system, sans-serif;
                width: ${PANEL_WIDTH}px;
                max-height: 92vh;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                color: #212529;
            }
            #tm-drag-header {
                background: #f8f9fa;
                padding: 10px 14px;
                border-bottom: 1px solid #e9ecef;
                cursor: grab;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            #tm-drag-header:active { cursor: grabbing; }
            .tm-panel-body {
                padding: 12px 14px;
                display: flex;
                flex-direction: column;
                gap: 10px;
                overflow-y: auto;
            }
            .tm-hidden { display: none !important; }

            /* Controlli UI */
            .tm-input { width: 100%; padding: 6px 8px; border: 1px solid #ced4da; border-radius: 6px; font-size: 13px; box-sizing: border-box; background: #fff; color: #212529; transition: border-color 0.2s; }
            .tm-input:focus { border-color: #ff3e41; outline: none; }
            .tm-row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
            .tm-btn { flex: 1; padding: 8px 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.15s; }
            .tm-btn:hover { transform: translateY(-1px); box-shadow: 0 3px 6px rgba(0,0,0,0.1); }
            .tm-btn:active { transform: translateY(0); }
            .tm-btn-primary { background: #ff3e41; color: white; }
            .tm-btn-on { background: #28a745; color: white; }
            .tm-btn-off { background: #e9ecef; color: #495057; }

            /* Checkbox */
            .tm-checkbox-group { display: flex; flex-direction: column; gap: 6px; }
            .tm-checkbox-wrapper { display: flex; align-items: center; gap: 8px; }
            .tm-checkbox-wrapper input[type="checkbox"] {
                appearance: checkbox !important;
                -webkit-appearance: checkbox !important;
                width: 16px !important;
                height: 16px !important;
                margin: 0 !important;
                cursor: pointer !important;
                accent-color: #ff3e41;
                flex-shrink: 0;
            }
            .tm-checkbox-wrapper label { font-size: 12.5px; color: #343a40; cursor: pointer; user-select: none; font-weight: 500; line-height: 1.2; }

            /* Dropdown Impostazioni Avanzate */
            .tm-dropdown-btn {
                background: #f8f9fa;
                border: 1px solid #dee2e6;
                border-radius: 6px;
                padding: 7px 10px;
                font-size: 12.5px;
                font-weight: 600;
                color: #495057;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: space-between;
                user-select: none;
                transition: background 0.15s;
            }
            .tm-dropdown-btn:hover { background: #e9ecef; }
            .tm-dropdown-content {
                background: #fcfcfd;
                border: 1px solid #e9ecef;
                border-radius: 6px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .tm-inline-num {
                width: 58px !important;
                padding: 4px 6px !important;
                font-size: 12px !important;
                text-align: center;
            }

            @keyframes tm-color-cycle {
                0%, 100% { background-color: #ff3e41; }
                50%      { background-color: #28a745; }
            }
            .tm-circle-animated {
                animation: tm-color-cycle 3s infinite ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    // --- 4. CORE LOGIC & ESTRAZIONE DATI ---

    function isBannerCard(card) {
        return Boolean(card.className && typeof card.className === 'string' && card.className.toLowerCase().includes('banner'));
    }

    function extractPrice(cardNode) {
        const priceEl = cardNode.querySelector('[class*="priceSection" i] p[class*="price" i], p[class*="price" i], [class*="price" i]');
        if (!priceEl) return null;

        const text = (priceEl.textContent || '').replace(/\s+/g, '');
        const match = text.match(/([\d.,]+)€/i);

        if (match) {
            const priceStr = match[1].replace(/\./g, '').replace(/,/g, '.');
            const parsed = parseFloat(priceStr);
            if (!isNaN(parsed)) return parsed;
        }
        return null;
    }

    function extractCleanCardData(cardNode) {
        const titleEl = cardNode.querySelector('h3, [class*="subject" i]');
        const locEl = cardNode.querySelector('[class*="location" i]');
        const advEl = cardNode.querySelector('[class*="advertiser" i]');
        const linkEl = cardNode.querySelector('a[href*=".htm"]');

        const title = (titleEl?.textContent || '').trim().toLowerCase();
        const location = (locEl?.textContent || '').trim().toLowerCase();
        const advertiser = (advEl?.textContent || '').trim().toLowerCase();

        let extraBody = '';
        let isCompanyFromData = false;
        let shopName = '';

        if (linkEl?.href) {
            const idMatch = linkEl.href.match(/-(\d+)\.htm/);
            const meta = (idMatch && adMetadataMap.get(idMatch[1])) || adMetadataMap.get(title);
            if (meta) {
                extraBody = meta.body;
                isCompanyFromData = meta.isCompany;
                shopName = meta.shopName;
            }
        }

        return {
            searchableText: `${title} ${location} ${advertiser} ${shopName} ${extraBody}`,
            isCompany: Boolean(advEl) || isCompanyFromData
        };
    }

    function isSponsored(cardNode) {
        const badges = cardNode.querySelectorAll('[class*="badges" i] span, [class*="tag" i], [class*="badge" i]');
        for (const badge of badges) {
            const text = (badge.textContent || '').toLowerCase().trim();
            if (text === 'vetrina' || text.includes('venditore pro') || text === 'promosso') {
                return true;
            }
        }
        return false;
    }

    function buildBlacklistRegex(blacklistStr) {
        if (!blacklistStr) return null;
        const terms = blacklistStr.split(',')
            .map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .filter(Boolean);

        if (terms.length === 0) return null;
        const patternString = terms.join('|');

        try {
            return new RegExp(`(?<!\\p{L})(${patternString})(?!\\p{L})`, 'iu');
        } catch (e) {
            return new RegExp(`\\b(${patternString})\\b`, 'i');
        }
    }

    // --- 5. AUTOMAZIONE INTELLIGENTE: AUTO-START, AUTO-SCROLL E AUTO-SKIP ---

    function isPaginationInViewport() {
        const pagEl = document.querySelector(PAGINATION_SELECTOR);
        if (!pagEl) return false;
        const rect = pagEl.getBoundingClientRect();
        return rect.top <= (window.innerHeight - 20) && rect.bottom >= 0;
    }

    /**
     * Conta quanti annunci validi (non filtrati) ci sono sull'ultima riga della griglia principale
     * subito prima dei bottoni di paginazione.
     */
    function getLastRowValidAdsCount() {
        // Prende tutte le card della griglia principale (escludendo i widget carosello dentro <ul> come "Scelti per te")
        const layoutCards = Array.from(document.querySelectorAll(CARD_SELECTOR)).filter(card => {
            if (isBannerCard(card)) return false;
            if (card.closest('ul')) return false; // Esclude carosello orizzontale
            if (card.classList.contains('tm-filtered-card-collapse')) return false;
            const rect = card.getBoundingClientRect();
            return rect.height > 0 && rect.width > 0;
        });

        if (layoutCards.length === 0) return 0;

        // Trova la coordinata Y (top) dell'ultima riga fisica prima dei pulsanti di paginazione
        const maxTop = Math.max(...layoutCards.map(c => c.getBoundingClientRect().top));

        // Filtra le card che appartengono a quell'ultima riga (tolleranza 30px) e che NON sono ghostate
        const validOnLastRow = layoutCards.filter(card => {
            const rect = card.getBoundingClientRect();
            const isOnLastRow = Math.abs(rect.top - maxTop) < 30;
            const isNotGhosted = !card.classList.contains('tm-filtered-card-ghost');
            return isOnLastRow && isNotGhosted;
        });

        return validOnLastRow.length;
    }

    function computeAutoSkipDuration() {
        const baseSeconds = Math.max(0.5, parseFloat(state.autoSkipSeconds) || 3);
        if (!state.smartAutomation) {
            lastRowDetectedCount = null;
            return baseSeconds;
        }

        const lastRowCount = getLastRowValidAdsCount();
        lastRowDetectedCount = lastRowCount;

        if (lastRowCount === 0) {
            return 1;
        }
        return Math.max(0.5, +((baseSeconds / 3) * lastRowCount).toFixed(1));
    }

    // A. Auto-Start alla lista annunci
    function executeAutoStartToList() {
        if (!state.isActive || !state.autoStartList) return;

        const target = document.querySelector(LIST_START_SELECTOR);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const targetTop = rect.top + window.scrollY - 12;

        if (window.scrollY < targetTop - 30) {
            window.scrollTo({ top: Math.max(0, targetTop), behavior: 'instant' });
        }
    }

    // B. Auto-Skip (con pausa su Hover e calcolo intelligente ultima riga)
    function stopAutoSkipCountdown() {
        if (skipCountdownTimer) {
            clearInterval(skipCountdownTimer);
            skipCountdownTimer = null;
        }
        skipRemainingTime = 0;
        lastRowDetectedCount = null;
        updateCounterUI();
    }

    function startAutoSkipCountdown() {
        if (!state.isActive || !state.autoSkip || skipCountdownTimer) return;

        const nextBtn = document.querySelector(NEXT_BTN_SELECTOR);
        if (!nextBtn || nextBtn.disabled) return;

        skipRemainingTime = computeAutoSkipDuration();
        updateCounterUI();

        skipCountdownTimer = setInterval(() => {
            if (!state.isActive || !state.autoSkip || !isPaginationInViewport()) {
                stopAutoSkipCountdown();
                return;
            }

            // Se il mouse è sopra un annuncio, mette in pausa il conto alla rovescia
            if (isHoveringCard) {
                updateCounterUI();
                return;
            }

            skipRemainingTime = Math.max(0, +(skipRemainingTime - 0.1).toFixed(1));
            updateCounterUI();

            if (skipRemainingTime <= 0) {
                stopAutoSkipCountdown();
                const btnToClick = document.querySelector(NEXT_BTN_SELECTOR);
                if (btnToClick && !btnToClick.disabled) {
                    btnToClick.click();
                }
            }
        }, 100);
    }

    // C. Auto-Scroll (Continuo oppure a Step fluidi in modalità intelligente)
    function stopAutoScroll() {
        if (autoScrollRaf) {
            cancelAnimationFrame(autoScrollRaf);
            autoScrollRaf = null;
        }
        if (stepScrollTimeout) {
            clearTimeout(stepScrollTimeout);
            stepScrollTimeout = null;
        }
    }

    function getStepScrollDistance() {
        // Misura l'altezza reale di una card visibile per scorrere esattamente di 1 riga alla volta
        const sampleCard = Array.from(document.querySelectorAll(CARD_SELECTOR)).find(c => {
            return !isBannerCard(c) && !c.classList.contains('tm-filtered-card-collapse') && c.getBoundingClientRect().height > 50;
        });
        if (sampleCard) {
            return Math.round(sampleCard.getBoundingClientRect().height + 24);
        }
        return Math.round(window.innerHeight * 0.55);
    }

    function runContinuousScrollStep() {
        if (!state.isActive || !state.autoScroll || state.smartAutomation || userPausedScroll) {
            stopAutoScroll();
            return;
        }

        const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 10);
        if (isPaginationInViewport() || atBottom) {
            stopAutoScroll();
            if (state.autoSkip && isPaginationInViewport()) {
                startAutoSkipCountdown();
            }
            return;
        }

        const speedVal = Math.max(0.5, parseFloat(state.autoScrollSpeed) || 5);
        window.scrollBy(0, speedVal * 0.8);
        autoScrollRaf = requestAnimationFrame(runContinuousScrollStep);
    }

    function runSmartStepScroll() {
        if (!state.isActive || !state.autoScroll || !state.smartAutomation || userPausedScroll) {
            stopAutoScroll();
            return;
        }

        const atBottom = (window.innerHeight + window.scrollY) >= (document.documentElement.scrollHeight - 10);
        if (isPaginationInViewport() || atBottom) {
            stopAutoScroll();
            if (state.autoSkip && isPaginationInViewport()) {
                startAutoSkipCountdown();
            }
            return;
        }

        const speedVal = Math.max(0.5, parseFloat(state.autoScrollSpeed) || 5);
        // Pausa di lettura inversamente proporzionale alla velocità (es: vel 5 -> 1500ms di pausa fissa tra gli step)
        const pauseMs = Math.max(400, Math.round(7500 / speedVal));

        if (!isHoveringCard) {
            const stepPx = getStepScrollDistance();
            window.scrollBy({ top: stepPx, behavior: 'smooth' });
        }

        stepScrollTimeout = setTimeout(runSmartStepScroll, pauseMs);
    }

    function triggerPageAutomation() {
        if (!state.isActive) {
            stopAutoScroll();
            stopAutoSkipCountdown();
            return;
        }

        if (isPaginationInViewport()) {
            stopAutoScroll();
            if (state.autoSkip) startAutoSkipCountdown();
        } else {
            stopAutoSkipCountdown();
            if (state.autoScroll && !userPausedScroll) {
                if (state.smartAutomation) {
                    if (!stepScrollTimeout) {
                        const speedVal = Math.max(0.5, parseFloat(state.autoScrollSpeed) || 5);
                        const initialPause = Math.max(400, Math.round(7500 / speedVal));
                        stepScrollTimeout = setTimeout(runSmartStepScroll, initialPause);
                    }
                } else if (!autoScrollRaf) {
                    autoScrollRaf = requestAnimationFrame(runContinuousScrollStep);
                }
            }
        }
    }

    // Rileva quando il mouse entra/esce da un annuncio per mettere in pausa l'Auto-Skip
    document.addEventListener('mouseover', (e) => {
        const card = e.target.closest?.(CARD_SELECTOR);
        if (card && !card.classList.contains('tm-filtered-card-collapse') && !isBannerCard(card)) {
            if (!isHoveringCard) {
                isHoveringCard = true;
                if (skipCountdownTimer) updateCounterUI();
            }
        } else if (isHoveringCard) {
            isHoveringCard = false;
            if (skipCountdownTimer) updateCounterUI();
        }
    }, { passive: true });

    // Se l'utente usa la rotellina verso l'alto, mette in pausa l'auto-scroll
    window.addEventListener('wheel', (e) => {
        if (e.deltaY < 0 && state.autoScroll) {
            userPausedScroll = true;
            stopAutoScroll();
        }
    }, { passive: true });

    // Controlla durante lo scroll se sono comparsi i numeri di paginazione
    window.addEventListener('scroll', () => {
        if (!state.isActive) return;
        if (isPaginationInViewport()) {
            stopAutoScroll();
            if (state.autoSkip && !skipCountdownTimer) {
                startAutoSkipCountdown();
            }
        } else if (skipCountdownTimer) {
            stopAutoSkipCountdown();
        }
    }, { passive: true });

    // --- 6. MOTORE DI FILTRAGGIO ---

    function updateCounterUI() {
        const statusText = document.getElementById('tm-status-text');
        if (!statusText) return;

        if (!state.isActive) {
            statusText.textContent = 'Filtri Disattivati';
            statusText.style.color = '#6c757d';
            return;
        }

        if (skipCountdownTimer && skipRemainingTime > 0) {
            if (isHoveringCard) {
                statusText.textContent = `⏸️ Skip in pausa (mouse su annuncio) • ${skipRemainingTime.toFixed(1)}s`;
                statusText.style.color = '#fd7e14';
            } else {
                const rowInfo = (state.smartAutomation && lastRowDetectedCount !== null)
                    ? ` (${lastRowDetectedCount} ann. ultima riga)`
                    : '';
                statusText.textContent = `⏭️ Skip tra ${skipRemainingTime.toFixed(1)}s${rowInfo}`;
                statusText.style.color = '#ff3e41';
            }
            return;
        }

        const allCards = document.querySelectorAll(CARD_SELECTOR);
        let hiddenCount = 0;
        allCards.forEach(c => {
            if (c.classList.contains('tm-filtered-card-ghost') || c.classList.contains('tm-filtered-card-collapse')) {
                hiddenCount++;
            }
        });

        statusText.textContent = `Attivo • Nascosti: ${hiddenCount} su ${allCards.length} annunci`;
        statusText.style.color = '#28a745';
    }

    function processCards(cardsArray) {
        const shouldHideBanners = state.isActive && state.hideAdBanners;
        document.body.classList.toggle('tm-hide-banners', shouldHideBanners);

        if (!state.isActive) {
            cardsArray.forEach(c => c.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse'));
            updateCounterUI();
            return;
        }

        const blacklistRegex = buildBlacklistRegex(state.blacklist);
        const minP = parseFloat(state.minPrice);
        const maxP = parseFloat(state.maxPrice);
        const hasMin = !isNaN(minP);
        const hasMax = !isNaN(maxP);
        const actualMin = hasMin ? minP : 0;
        const actualMax = hasMax ? maxP : Infinity;

        cardsArray.forEach(card => {
            if (isBannerCard(card)) return;

            let shouldHide = false;
            const { searchableText, isCompany } = extractCleanCardData(card);

            // 1. Blacklist
            if (blacklistRegex && blacklistRegex.test(searchableText)) {
                shouldHide = true;
            }

            // 2. Vetrina / Sponsorizzati
            if (!shouldHide && state.hideSponsored && isSponsored(card)) {
                shouldHide = true;
            }

            // 3. Aziende / Rivenditori
            if (!shouldHide && state.hideCompanies && isCompany) {
                shouldHide = true;
            }

            // 4. Prezzo e Annunci Senza Prezzo
            if (!shouldHide) {
                const price = extractPrice(card);
                if (price === null) {
                    if (state.hideNoPrice || hasMin) {
                        shouldHide = true;
                    }
                } else if (price < actualMin || price > actualMax) {
                    shouldHide = true;
                }
            }

            // Applicazione classi CSS
            if (shouldHide) {
                const targetClass = state.collapseMode ? 'tm-filtered-card-collapse' : 'tm-filtered-card-ghost';
                const removeClass = state.collapseMode ? 'tm-filtered-card-ghost' : 'tm-filtered-card-collapse';
                card.classList.add(targetClass);
                card.classList.remove(removeClass);
            } else {
                card.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse');
            }
        });

        updateCounterUI();
        triggerPageAutomation();
    }

    // --- 7. GESTIONE CAMBIO PAGINA (SPA NEXT.JS) E OBSERVER ---

    function getCurrentPageSignature() {
        const currentPageEl = document.querySelector('[class*="pagination" i] [class*="current-page" i]');
        const pageNum = currentPageEl ? currentPageEl.textContent.trim() : '';
        return `${location.href}|${pageNum}`;
    }

    function handlePageChangeIfNeeded() {
        const sig = getCurrentPageSignature();
        if (sig !== lastPageSignature) {
            lastPageSignature = sig;
            userPausedScroll = false;
            isHoveringCard = false;
            stopAutoSkipCountdown();
            stopAutoScroll();
            indexPageData();

            executeAutoStartToList();
            setTimeout(() => {
                executeAutoStartToList();
                processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));
            }, 180);
        }
    }

    const pendingNodes = new Set();
    let animationFrameId = null;

    const observer = new MutationObserver((mutations) => {
        handlePageChangeIfNeeded();
        if (!state.isActive) return;

        let hasNewCards = false;

        for (const mutation of mutations) {
            if (mutation.type === 'childList') {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.id && node.id.startsWith('tm-')) continue;

                    if (node.matches?.(CARD_SELECTOR)) {
                        pendingNodes.add(node);
                        hasNewCards = true;
                    } else if (node.querySelectorAll) {
                        const innerCards = node.querySelectorAll(CARD_SELECTOR);
                        if (innerCards.length > 0) {
                            innerCards.forEach(c => pendingNodes.add(c));
                            hasNewCards = true;
                        }
                    }
                }
            } else if (mutation.type === 'attributes') {
                const closestCard = mutation.target.closest?.(CARD_SELECTOR);
                if (closestCard) {
                    pendingNodes.add(closestCard);
                    hasNewCards = true;
                }
            }
        }

        if (hasNewCards) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                processCards(Array.from(pendingNodes));
                pendingNodes.clear();
            });
        }
    });

    // --- 8. INTERFACCIA UTENTE (UI & EVENTI) ---
    function initUI() {
        injectStyles();

        const panel = document.createElement('div');
        panel.id = 'tm-filter-panel';

        const savedLeft = parseFloat(localStorage.getItem('subitoPanelLeft'));
        const savedTop = parseFloat(localStorage.getItem('subitoPanelTop'));

        if (!isNaN(savedLeft) && !isNaN(savedTop)) {
            const safeX = Math.max(0, Math.min(savedLeft, window.innerWidth - PANEL_WIDTH));
            const safeY = Math.max(0, Math.min(savedTop, window.innerHeight - 50));
            panel.style.left = `${safeX}px`;
            panel.style.top = `${safeY}px`;
        } else {
            panel.style.bottom = '20px';
            panel.style.right = '20px';
        }

        panel.innerHTML = `
            <div id="tm-drag-header">
                <span style="font-weight: 700; color: #ff3e41; font-size: 14px; letter-spacing: -0.3px;">⠿ Filtri Subito</span>
                <div style="display: flex; align-items: center; gap: 8px; margin-left: 15px;">
                    <span id="tm-status-circle" style="width: 10px; height: 10px; border-radius: 50%; display: inline-block;"></span>
                    <button id="tm-toggle-btn" style="background:none; border:none; font-size:20px; font-weight:bold; color:#6c757d; cursor:pointer; line-height: 1;">
                        ${state.isMinimized ? '+' : '−'}
                    </button>
                </div>
            </div>

            <div id="tm-panel-body" class="tm-panel-body ${state.isMinimized ? 'tm-hidden' : ''}">
                <div class="tm-row">
                    <div style="flex: 1;">
                        <label style="font-size:11.5px; color:#6c757d; font-weight: 500;">Prezzo Min (€)</label>
                        <input type="number" id="tm-input-min" class="tm-input" placeholder="Min">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size:11.5px; color:#6c757d; font-weight: 500;">Prezzo Max (€)</label>
                        <input type="number" id="tm-input-max" class="tm-input" placeholder="Max">
                    </div>
                </div>

                <div>
                    <label style="font-size:11.5px; color:#6c757d; font-weight: 500;">Blacklist (separate da virgola)</label>
                    <input type="text" id="tm-input-blacklist" class="tm-input" placeholder="es: rotto, cerco, finanziamento">
                </div>

                <div class="tm-checkbox-group">
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-sponsored" ${state.hideSponsored ? 'checked' : ''}>
                        <label for="tm-check-sponsored">Nascondi Vetrina / Pro</label>
                    </div>
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-collapse" ${state.collapseMode ? 'checked' : ''}>
                        <label for="tm-check-collapse">Scomparsa totale (Collassa griglia)</label>
                    </div>
                </div>

                <!-- DROPDOWN IMPOSTAZIONI AVANZATE -->
                <div id="tm-adv-dropdown-btn" class="tm-dropdown-btn">
                    <span>⚙️ Impostazioni Avanzate</span>
                    <span id="tm-adv-arrow">${state.isAdvOpen ? '▴' : '▾'}</span>
                </div>

                <div id="tm-adv-dropdown-content" class="tm-dropdown-content ${state.isAdvOpen ? '' : 'tm-hidden'}">
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-noprice" ${state.hideNoPrice ? 'checked' : ''}>
                        <label for="tm-check-noprice">Nascondi annunci senza prezzo</label>
                    </div>
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-companies" ${state.hideCompanies ? 'checked' : ''}>
                        <label for="tm-check-companies">Nascondi Aziende / Rivenditori</label>
                    </div>
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-adbanners" ${state.hideAdBanners ? 'checked' : ''}>
                        <label for="tm-check-adbanners">Nascondi i banner pubblicità</label>
                    </div>
                    <hr style="border: 0; border-top: 1px solid #e9ecef; margin: 2px 0;">
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-autostart" ${state.autoStartList ? 'checked' : ''}>
                        <label for="tm-check-autostart">Auto-start direttamente alla lista</label>
                    </div>
                    <div class="tm-row" style="gap: 6px;">
                        <div class="tm-checkbox-wrapper" style="flex: 1;">
                            <input type="checkbox" id="tm-check-autoscroll" ${state.autoScroll ? 'checked' : ''}>
                            <label for="tm-check-autoscroll">Auto-scroll (velocità):</label>
                        </div>
                        <input type="number" id="tm-input-scroll-speed" class="tm-input tm-inline-num" min="1" max="50" step="1" title="Velocità dello scroll">
                    </div>
                    <div class="tm-row" style="gap: 6px;">
                        <div class="tm-checkbox-wrapper" style="flex: 1;">
                            <input type="checkbox" id="tm-check-autoskip" ${state.autoSkip ? 'checked' : ''}>
                            <label for="tm-check-autoskip">Auto-skip a fine lista (s):</label>
                        </div>
                        <input type="number" id="tm-input-skip-sec" class="tm-input tm-inline-num" min="1" max="60" step="0.5" title="Secondi di attesa prima del cambio pagina">
                    </div>
                    <div class="tm-checkbox-wrapper">
                        <input type="checkbox" id="tm-check-smartmode" ${state.smartAutomation ? 'checked' : ''}>
                        <label for="tm-check-smartmode">Auto scroll/skip intelligente</label>
                    </div>
                </div>

                <div class="tm-row" style="margin-top: 2px;">
                    <button id="tm-btn-apply" class="tm-btn tm-btn-primary">Applica</button>
                    <button id="tm-btn-reset" class="tm-btn" style="background: #f1f3f5; border: 1px solid #ced4da; color: #495057; flex: 0.5;">Reset</button>
                </div>

                <div class="tm-row">
                    <button id="tm-btn-toggle" class="tm-btn"></button>
                </div>

                <div id="tm-status-text" style="font-size: 11.5px; text-align: center; font-weight: 600; margin-top: 2px;"></div>
            </div>
        `;
        document.body.appendChild(panel);

        const inputMin = document.getElementById('tm-input-min');
        const inputMax = document.getElementById('tm-input-max');
        const inputBlacklist = document.getElementById('tm-input-blacklist');
        const inputScrollSpeed = document.getElementById('tm-input-scroll-speed');
        const inputSkipSec = document.getElementById('tm-input-skip-sec');

        inputMin.value = state.minPrice;
        inputMax.value = state.maxPrice;
        inputBlacklist.value = state.blacklist;
        inputScrollSpeed.value = state.autoScrollSpeed;
        inputSkipSec.value = state.autoSkipSeconds;

        if (state.isMinimized) {
            panel.style.width = 'auto';
        }

        function updateStateUI() {
            const toggleBtn = document.getElementById('tm-btn-toggle');
            const statusCircle = document.getElementById('tm-status-circle');

            if (state.isActive) {
                toggleBtn.textContent = 'Filtro Attivo (Clicca per spegnere)';
                toggleBtn.className = 'tm-btn tm-btn-on';
                statusCircle?.classList.add('tm-circle-animated');
                if (statusCircle) statusCircle.style.backgroundColor = '';
            } else {
                toggleBtn.textContent = 'Filtro Spento (Clicca per attivare)';
                toggleBtn.className = 'tm-btn tm-btn-off';
                statusCircle?.classList.remove('tm-circle-animated');
                if (statusCircle) statusCircle.style.backgroundColor = '#6c757d';
            }
            updateCounterUI();
        }

        updateStateUI();

        const autoSelect = function() { this.select(); };
        [inputMin, inputMax, inputBlacklist, inputScrollSpeed, inputSkipSec].forEach(el => {
            el.addEventListener('focus', autoSelect);
        });

        // Toggle Dropdown Impostazioni Avanzate
        const advBtn = document.getElementById('tm-adv-dropdown-btn');
        const advContent = document.getElementById('tm-adv-dropdown-content');
        const advArrow = document.getElementById('tm-adv-arrow');

        advBtn.addEventListener('click', () => {
            state.isAdvOpen = !state.isAdvOpen;
            localStorage.setItem('subitoAdvDropdownOpen', state.isAdvOpen);
            advContent.classList.toggle('tm-hidden', !state.isAdvOpen);
            advArrow.textContent = state.isAdvOpen ? '▴' : '▾';
        });

        // Drag & Drop
        const header = document.getElementById('tm-drag-header');
        let startX, startY;

        function onMouseMove(e) {
            const x = Math.max(0, Math.min(e.clientX - startX, window.innerWidth - panel.offsetWidth));
            const y = Math.max(0, Math.min(e.clientY - startY, window.innerHeight - panel.offsetHeight));
            panel.style.left = `${x}px`;
            panel.style.top = `${y}px`;
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        }

        function onMouseUp() {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            localStorage.setItem('subitoPanelLeft', parseFloat(panel.style.left));
            localStorage.setItem('subitoPanelTop', parseFloat(panel.style.top));
        }

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            e.preventDefault();
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        // Minimizza pannello
        const bodyPanel = document.getElementById('tm-panel-body');
        const toggleBtnMain = document.getElementById('tm-toggle-btn');

        toggleBtnMain.addEventListener('click', () => {
            state.isMinimized = !state.isMinimized;
            localStorage.setItem('subitoPanelMinimized', state.isMinimized);
            bodyPanel.classList.toggle('tm-hidden', state.isMinimized);
            panel.style.width = state.isMinimized ? 'auto' : `${PANEL_WIDTH}px`;
            toggleBtnMain.textContent = state.isMinimized ? '+' : '−';
        });

        const forceRecalculateAll = () => {
            indexPageData();
            const allCards = Array.from(document.querySelectorAll(CARD_SELECTOR));
            processCards(allCards);
        };

        const applyFilters = () => {
            state.minPrice = inputMin.value;
            state.maxPrice = inputMax.value;
            state.blacklist = inputBlacklist.value;
            state.hideSponsored = document.getElementById('tm-check-sponsored').checked;
            state.collapseMode = document.getElementById('tm-check-collapse').checked;
            // Avanzate
            state.hideNoPrice = document.getElementById('tm-check-noprice').checked;
            state.hideCompanies = document.getElementById('tm-check-companies').checked;
            state.hideAdBanners = document.getElementById('tm-check-adbanners').checked;
            state.autoStartList = document.getElementById('tm-check-autostart').checked;
            state.autoScroll = document.getElementById('tm-check-autoscroll').checked;
            state.autoScrollSpeed = Math.max(0.5, parseFloat(inputScrollSpeed.value) || 5);
            state.autoSkip = document.getElementById('tm-check-autoskip').checked;
            state.autoSkipSeconds = Math.max(0.5, parseFloat(inputSkipSec.value) || 3);
            state.smartAutomation = document.getElementById('tm-check-smartmode').checked;

            state.isActive = true;
            userPausedScroll = false;
            stopAutoScroll();
            stopAutoSkipCountdown();

            localStorage.setItem('subitoMinPrice', state.minPrice);
            localStorage.setItem('subitoMaxPrice', state.maxPrice);
            localStorage.setItem('subitoBlacklist', state.blacklist);
            localStorage.setItem('subitoHideSponsored', state.hideSponsored);
            localStorage.setItem('subitoCollapseMode', state.collapseMode);
            localStorage.setItem('subitoHideNoPrice', state.hideNoPrice);
            localStorage.setItem('subitoHideCompanies', state.hideCompanies);
            localStorage.setItem('subitoHideAdBanners', state.hideAdBanners);
            localStorage.setItem('subitoAutoStartList', state.autoStartList);
            localStorage.setItem('subitoAutoScroll', state.autoScroll);
            localStorage.setItem('subitoAutoScrollSpeed', state.autoScrollSpeed);
            localStorage.setItem('subitoAutoSkip', state.autoSkip);
            localStorage.setItem('subitoAutoSkipSeconds', state.autoSkipSeconds);
            localStorage.setItem('subitoSmartAutomation', state.smartAutomation);
            localStorage.setItem('subitoFilterActive', 'true');

            updateStateUI();
            executeAutoStartToList();
            forceRecalculateAll();
        };

        let debounceTimer = null;
        const debouncedApply = () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(applyFilters, 300);
        };

        [inputMin, inputMax, inputBlacklist, inputScrollSpeed, inputSkipSec].forEach(el => {
            el.addEventListener('input', debouncedApply);
            el.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    clearTimeout(debounceTimer);
                    applyFilters();
                }
            });
        });

        document.getElementById('tm-btn-apply').addEventListener('click', applyFilters);

        const allCheckIds = [
            'tm-check-sponsored', 'tm-check-collapse',
            'tm-check-noprice', 'tm-check-companies',
            'tm-check-adbanners', 'tm-check-autostart',
            'tm-check-autoscroll', 'tm-check-autoskip',
            'tm-check-smartmode'
        ];
        allCheckIds.forEach(id => {
            document.getElementById(id).addEventListener('change', applyFilters);
        });

        document.getElementById('tm-btn-toggle').addEventListener('click', () => {
            state.isActive = !state.isActive;
            localStorage.setItem('subitoFilterActive', state.isActive.toString());
            if (!state.isActive) {
                stopAutoScroll();
                stopAutoSkipCountdown();
            } else {
                userPausedScroll = false;
            }
            updateStateUI();
            forceRecalculateAll();
        });

        document.getElementById('tm-btn-reset').addEventListener('click', () => {
            stopAutoScroll();
            stopAutoSkipCountdown();

            inputMin.value = '';
            inputMax.value = '';
            inputBlacklist.value = '';
            inputScrollSpeed.value = 5;
            inputSkipSec.value = 3;
            allCheckIds.forEach(id => {
                document.getElementById(id).checked = false;
            });

            Object.assign(state, {
                minPrice: '', maxPrice: '', blacklist: '',
                hideSponsored: false, collapseMode: false,
                hideNoPrice: false, hideCompanies: false,
                hideAdBanners: false, autoStartList: false,
                autoScroll: false, autoScrollSpeed: 5,
                autoSkip: false, autoSkipSeconds: 3,
                smartAutomation: false, isActive: false
            });

            ['subitoMinPrice', 'subitoMaxPrice', 'subitoBlacklist'].forEach(k => localStorage.setItem(k, ''));
            [
                'subitoHideSponsored', 'subitoCollapseMode',
                'subitoHideNoPrice', 'subitoHideCompanies',
                'subitoHideAdBanners', 'subitoAutoStartList',
                'subitoAutoScroll', 'subitoAutoSkip',
                'subitoSmartAutomation', 'subitoFilterActive'
            ].forEach(k => localStorage.setItem(k, 'false'));
            localStorage.setItem('subitoAutoScrollSpeed', '5');
            localStorage.setItem('subitoAutoSkipSeconds', '3');

            updateStateUI();
            forceRecalculateAll();
        });
    }

    // --- 9. AVVIO ---
    indexPageData();
    initUI();
    lastPageSignature = getCurrentPageSignature();

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'data-testid']
    });

    executeAutoStartToList();
    processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));

    setTimeout(() => {
        indexPageData();
        executeAutoStartToList();
        processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));
    }, 600);

})();
