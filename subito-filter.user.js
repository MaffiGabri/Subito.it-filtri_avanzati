// ==UserScript==
// @name         Subito.it - Filtri Avanzati (Prezzo, Blacklist, Vetrina)
// @namespace    http://tampermonkey.net/
// @version      3.2.0
// @description  Filtra annunci su Subito.it per prezzo, parole chiave e nasconde la vetrina
// @author       MaffiGabri
// @match        *://*.subito.it/*
// @grant        none
// @homepageURL  https://github.com/MaffiGabri/Subito.it-filtri_avanzati/
// @supportURL   https://github.com/MaffiGabri/Subito.it-filtri_avanzati/issues
// @updateURL    https://raw.githubusercontent.com/MaffiGabri/Subito.it-filtri_avanzati/main/subito-filter.user.js
// @downloadURL  https://raw.githubusercontent.com/MaffiGabri/Subito.it-filtri_avanzati/main/subito-filter.user.js
// ==/UserScript==


/*

================================================================================

A COSA SERVE:

Questo script crea un'interfaccia fluttuante su Subito.it che permette di ripulire i risultati di ricerca in tempo reale.

================================================================================

*/



(function() {
    'use strict';

    // --- 1. CONFIGURAZIONE E STATO GLOBALE ---
    const CARD_SELECTOR = 'article[class*="card" i], div[class*="card" i], .items__item, [data-testid="item-card"]';
    const PANEL_WIDTH = 280;

    // Manteniamo lo stato dei prezzi come stringhe per l'UI (così gestiamo il campo vuoto)
    let savedMin = localStorage.getItem('subitoMinPrice');
    let savedMax = localStorage.getItem('subitoMaxPrice');

    // Normalizziamo i vecchi salvataggi (0 e Infinity) in campi vuoti più eleganti
    if (savedMin === '0' || savedMin === 'NaN') savedMin = '';
    if (savedMax === 'Infinity' || savedMax === 'NaN') savedMax = '';

    const state = {
        minPrice: savedMin !== null ? savedMin : '',
        maxPrice: savedMax !== null ? savedMax : '',
        blacklist: localStorage.getItem('subitoBlacklist') || '',
        isActive: localStorage.getItem('subitoFilterActive') !== 'false', // Default su ON
        isMinimized: localStorage.getItem('subitoPanelMinimized') === 'true',
        hideSponsored: localStorage.getItem('subitoHideSponsored') === 'true',
        collapseMode: localStorage.getItem('subitoCollapseMode') === 'true'
    };

    // --- 2. INIEZIONE CSS ---
    function injectStyles() {
        if (document.getElementById('tm-subito-styles')) return;

        const style = document.createElement('style');
        style.id = 'tm-subito-styles';
        style.textContent = `
            /* MODALITÀ FANTASMA: Bassa opacità ma recuperabile all'hover */
            html body article.tm-filtered-card-ghost,
            html body div.tm-filtered-card-ghost,
            html body .tm-filtered-card-ghost {
                opacity: 0.1 !important;
                filter: grayscale(100%) !important;
                transition: opacity 0.3s ease, filter 0.3s ease !important;
                /* Rimosso pointer-events: none per permettere l'hover */
            }
            html body article.tm-filtered-card-ghost:hover,
            html body div.tm-filtered-card-ghost:hover,
            html body .tm-filtered-card-ghost:hover {
                opacity: 1 !important;
                filter: none !important;
            }

            /* SAFE COLLAPSE: Sparizione totale senza distruggere il Virtual DOM */
            html body article.tm-filtered-card-collapse,
            html body div.tm-filtered-card-collapse,
            html body .tm-filtered-card-collapse {
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

            /* UI Pannello */
            #tm-filter-panel {
                position: fixed;
                background: #ffffff;
                border: 2px solid #ff3e41;
                border-radius: 8px;
                z-index: 999999;
                box-shadow: 0 10px 25px rgba(0,0,0,0.25);
                font-family: system-ui, -apple-system, sans-serif;
                width: ${PANEL_WIDTH}px;
                display: flex;
                flex-direction: column;
                overflow: hidden;
                transition: height 0.2s ease;
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
            .tm-panel-body { padding: 14px; display: flex; flex-direction: column; gap: 12px; }
            .tm-hidden { display: none !important; }

            /* Controlli UI */
            .tm-input { width: 100%; padding: 8px; border: 1px solid #ced4da; border-radius: 6px; font-size: 13px; box-sizing: border-box; transition: border-color 0.2s; }
            .tm-input:focus { border-color: #ff3e41; outline: none; }
            .tm-row { display: flex; gap: 10px; align-items: center; justify-content: space-between; }
            .tm-btn { flex: 1; padding: 10px; border: none; border-radius: 6px; cursor: pointer; font-weight: 600; font-size: 13px; transition: all 0.2s; }
            .tm-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
            .tm-btn:active { transform: translateY(0); }
            .tm-btn-primary { background: #ff3e41; color: white; }
            .tm-btn-on { background: #28a745; color: white; }
            .tm-btn-off { background: #e9ecef; color: #495057; }

            /* Visibilità Checkbox */
            .tm-checkbox-wrapper { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
            .tm-checkbox-wrapper input[type="checkbox"] {
                appearance: checkbox !important;
                -webkit-appearance: checkbox !important;
                width: 18px !important;
                height: 18px !important;
                display: inline-block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: static !important;
                margin: 0 !important;
                cursor: pointer !important;
            }
            .tm-checkbox-wrapper label { font-size: 13px; color: #343a40; cursor: pointer; user-select: none; font-weight: 500;}

            /* Animazione Ciclica per il Pallino */
            @keyframes tm-color-cycle {
                0%   { background-color: #ff3e41; } /* Rosso Subito */
                50%  { background-color: #28a745; } /* Verde Attivo */
                100% { background-color: #ff3e41; } /* Torna Rosso */
            }
            .tm-circle-animated {
                animation: tm-color-cycle 3s infinite ease-in-out;
            }
        `;
        document.head.appendChild(style);
    }

    // --- 3. CORE LOGIC  ---

    function extractPrice(cardNode) {
        const priceSection = cardNode.querySelector('[class*="price" i]') || cardNode;
        // Strip di tutti gli spazi
        const text = (priceSection.innerText || priceSection.textContent || '').replace(/\s+/g, '');
        // Match su cifre contigue a € (es: "1.500,50€")
        const match = text.match(/([\d.,]+)€/i);

        if (match) {
            let priceStr = match[1];
            // Pulizia standard europeo -> standard matematico
            priceStr = priceStr.replace(/\./g, ''); // via i separatori migliaia
            priceStr = priceStr.replace(/,/g, '.'); // virgole tramutate in punto

            const parsed = parseFloat(priceStr);
            if (!isNaN(parsed)) return parsed;
        }
        return null;
    }

    function isSponsored(cardNode) {
        const badges = cardNode.querySelectorAll('span.caption, [class*="tag" i], [class*="badge" i]');
        for (let badge of badges) {
            const text = (badge.innerText || badge.textContent || '').toLowerCase().trim();
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
            .filter(t => t.length > 0);

        if (terms.length === 0) return null;

        const patternString = terms.join('|');

        // Triplo Fallback per copertura Browser Assoluta
        try {
            // 1. Massima precisione Unicode usando Lookbehind (Browser Moderni)
            return new RegExp(`(?<!\\p{L})(${patternString})(?!\\p{L})`, 'iu');
        } catch (e) {
            try {
                // 2. Fallback Unicode Senza Lookbehind (Safari 11+)
                return new RegExp(`(?:^|[^\\p{L}])(${patternString})(?![\\p{L}])`, 'iu');
            } catch (e2) {
                // 3. Fallback di emergenza basico (Vecchi Sistemi)
                return new RegExp(`\\b(${patternString})\\b`, 'i');
            }
        }
    }

    function isBanner(card) {
        // Riconosce banner ads nativi ed evita di calcolarli
        const className = card.className;
        if (typeof className === 'string') {
            const lower = className.toLowerCase();
            if (lower.includes('banner') || lower.includes('ad-slot')) return true;
        }
        return false;
    }

    // --- 4. MOTORE DI FILTRAGGIO ---

    function processCards(cardsArray) {
        if (!state.isActive) {
            cardsArray.forEach(c => c.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse'));
            return;
        }

        const blacklistRegex = buildBlacklistRegex(state.blacklist);

        cardsArray.forEach(card => {
            if (isBanner(card)) return;

            let shouldHide = false;
            const cardText = (card.innerText || card.textContent || '').toLowerCase();

            // 1. Blacklist
            if (blacklistRegex && blacklistRegex.test(cardText)) {
                shouldHide = true;
            }

            // 2. Vetrina / Sponsorizzati
            if (!shouldHide && state.hideSponsored && isSponsored(card)) {
                shouldHide = true;
            }

            // 3. Range Prezzo
            if (!shouldHide) {
                const price = extractPrice(card);
                if (price !== null) {
                    // Conversione sicura: se il campo è vuoto (''), tratta come 0 (min) o Infinity (max)
                    const minP = parseFloat(state.minPrice);
                    const maxP = parseFloat(state.maxPrice);
                    const actualMin = isNaN(minP) ? 0 : minP;
                    const actualMax = isNaN(maxP) ? Infinity : maxP;

                    if (price < actualMin || price > actualMax) {
                        shouldHide = true;
                    }
               }
            }

            // Applicazione Sicura degli Stili
            if (shouldHide) {
                if (state.collapseMode) {
                    if (!card.classList.contains('tm-filtered-card-collapse')) {
                        card.classList.add('tm-filtered-card-collapse');
                        card.classList.remove('tm-filtered-card-ghost');
                    }
                } else {
                    if (!card.classList.contains('tm-filtered-card-ghost')) {
                        card.classList.add('tm-filtered-card-ghost');
                        card.classList.remove('tm-filtered-card-collapse');
                    }
                }
            } else {
                card.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse');
            }
        });
    }

    // --- 5. OBSERVER A PROVA DI REACT ---
    const pendingNodes = new Set();
    let animationFrameId = null;

    const observer = new MutationObserver((mutations) => {
        if (!state.isActive) return;
        let hasNewCards = false;

        for (let mutation of mutations) {
            // A. Intercetta nuovi nodi aggiunti al DOM
            if (mutation.type === 'childList') {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;
                    if (node.id && node.id.startsWith('tm-')) continue; // Ignora la nostra UI

                    if (node.matches && node.matches(CARD_SELECTOR)) {
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
            }
            // B. Intercetta il DOM Recycling di React (modifica href/immagini di nodi esistenti)
            // L'attributo "class" è bandito volontariamente per evitare loop
            else if (mutation.type === 'attributes') {
                let target = mutation.target;
                const closestCard = target.closest ? target.closest(CARD_SELECTOR) : null;
                if (closestCard) {
                    pendingNodes.add(closestCard);
                    hasNewCards = true;
                }
            }
        }

        // Coda debounced: processa tutto al primo frame libero disponibile
        if (hasNewCards) {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            animationFrameId = requestAnimationFrame(() => {
                processCards(Array.from(pendingNodes));
                pendingNodes.clear();
            });
        }
    });

    // --- 6. INTERFACCIA UTENTE (UI & EVENTI) ---
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
                        <label style="font-size:12px; color:#6c757d; font-weight: 500;">Prezzo Min (€)</label>
                        <input type="number" id="tm-input-min" class="tm-input" placeholder="Min" value="${state.minPrice}">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size:12px; color:#6c757d; font-weight: 500;">Prezzo Max (€)</label>
                        <input type="number" id="tm-input-max" class="tm-input" placeholder="Max" value="${state.maxPrice}">
                    </div>
                </div>

                <div>
                    <label style="font-size:12px; color:#6c757d; font-weight: 500;">Blacklist (parole divise da virgola)</label>
                    <input type="text" id="tm-input-blacklist" class="tm-input" placeholder="es: difettoso, rotto, cerco" value="${state.blacklist}">
                </div>

                <div class="tm-checkbox-wrapper">
                    <input type="checkbox" id="tm-check-sponsored" ${state.hideSponsored ? 'checked' : ''}>
                    <label for="tm-check-sponsored">Nascondi Vetrina</label>
                </div>

                <div class="tm-checkbox-wrapper">
                    <input type="checkbox" id="tm-check-collapse" ${state.collapseMode ? 'checked' : ''}>
                    <label for="tm-check-collapse">Scomparsa totale (Collassa griglia)</label>
                </div>

                <div class="tm-row" style="margin-top: 6px;">
                    <button id="tm-btn-apply" class="tm-btn tm-btn-primary">Applica Filtri</button>
                    <button id="tm-btn-reset" class="tm-btn" style="background: #f1f3f5; border: 1px solid #ced4da; color: #495057; flex: 0.5;" title="Azzera filtri">Reset</button>
                </div>

                <div class="tm-row" style="margin-top: 2px;">
                    <button id="tm-btn-toggle" class="tm-btn"></button>
                </div>

                <div id="tm-status-text" style="font-size: 12px; text-align: center; font-weight: 600; margin-top: 4px;"></div>
            </div>
        `;
        document.body.appendChild(panel);

        function updateStateUI() {
            const toggleBtn = document.getElementById('tm-btn-toggle');
            const statusText = document.getElementById('tm-status-text');
            const statusCircle = document.getElementById('tm-status-circle');

            if (state.isActive) {
                toggleBtn.textContent = 'Attivo';
                toggleBtn.className = 'tm-btn tm-btn-on';
                statusText.textContent = 'Filtri Attivi sulla griglia';
                statusText.style.color = '#28a745';

                if (statusCircle) {
                    statusCircle.classList.add('tm-circle-animated');
                    statusCircle.style.backgroundColor = '';
                }
            } else {
                toggleBtn.textContent = 'Spento';
                toggleBtn.className = 'tm-btn tm-btn-off';
                statusText.textContent = 'Filtri Disattivati';
                statusText.style.color = '#6c757d';

                if (statusCircle) {
                    statusCircle.classList.remove('tm-circle-animated');
                    statusCircle.style.backgroundColor = '#6c757d';
                }
            }
        }

        updateStateUI();

        // --- Gestione Selezione Testo (UX Avanzata) ---
        const inputMin = document.getElementById('tm-input-min');
        const inputMax = document.getElementById('tm-input-max');
        const inputBlacklist = document.getElementById('tm-input-blacklist');

        // Seleziona l'intero contenuto non appena si clicca/entra nel campo
        const autoSelectContent = function() { this.select(); };
        inputMin.addEventListener('focus', autoSelectContent);
        inputMax.addEventListener('focus', autoSelectContent);
        inputBlacklist.addEventListener('focus', autoSelectContent);

        // --- Logica Drag & Drop ---
        const header = document.getElementById('tm-drag-header');
        let startX, startY;

        function onMouseMove(e) {
            let x = e.clientX - startX;
            let y = e.clientY - startY;

            x = Math.max(0, Math.min(x, window.innerWidth - panel.offsetWidth));
            y = Math.max(0, Math.min(y, window.innerHeight - panel.offsetHeight));

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

        // --- Eventi Logica UI ---
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
            const allCards = Array.from(document.querySelectorAll(CARD_SELECTOR));
            allCards.forEach(c => c.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse'));
            processCards(allCards);
        };

        const applyFilters = () => {
            // Manteniamo le stringhe nell'UI state
            state.minPrice = document.getElementById('tm-input-min').value;
            state.maxPrice = document.getElementById('tm-input-max').value;
            state.blacklist = document.getElementById('tm-input-blacklist').value;
            state.hideSponsored = document.getElementById('tm-check-sponsored').checked;
            state.collapseMode = document.getElementById('tm-check-collapse').checked;
            state.isActive = true;

            localStorage.setItem('subitoMinPrice', state.minPrice);
            localStorage.setItem('subitoMaxPrice', state.maxPrice);
            localStorage.setItem('subitoBlacklist', state.blacklist);
            localStorage.setItem('subitoHideSponsored', state.hideSponsored);
            localStorage.setItem('subitoCollapseMode', state.collapseMode);
            localStorage.setItem('subitoFilterActive', 'true');

            updateStateUI();
            forceRecalculateAll(); // Ricalcola ignorando lo stato precedente per applicare al volo
        };

        document.getElementById('tm-btn-apply').addEventListener('click', applyFilters);
        document.getElementById('tm-check-sponsored').addEventListener('change', applyFilters);
        document.getElementById('tm-check-collapse').addEventListener('change', applyFilters);

        document.getElementById('tm-btn-toggle').addEventListener('click', () => {
            state.isActive = !state.isActive;
            localStorage.setItem('subitoFilterActive', state.isActive.toString());
            updateStateUI();
            if (state.isActive) {
                applyFilters();
            } else {
                forceRecalculateAll();
            }
        });

        //  Logica Tasto Reset
        document.getElementById('tm-btn-reset').addEventListener('click', () => {
            // 1. Azzera fisicamente i campi di input
            document.getElementById('tm-input-min').value = '';
            document.getElementById('tm-input-max').value = '';
            document.getElementById('tm-input-blacklist').value = '';
            document.getElementById('tm-check-sponsored').checked = false;
            document.getElementById('tm-check-collapse').checked = false;

            // 2. Svuota lo stato interno e spegne il filtro
            state.minPrice = '';
            state.maxPrice = '';
            state.blacklist = '';
            state.hideSponsored = false;
            state.collapseMode = false;
            state.isActive = false;

            // 3. Salva la pulizia nel LocalStorage
            localStorage.setItem('subitoMinPrice', '');
            localStorage.setItem('subitoMaxPrice', '');
            localStorage.setItem('subitoBlacklist', '');
            localStorage.setItem('subitoHideSponsored', 'false');
            localStorage.setItem('subitoCollapseMode', 'false');
            localStorage.setItem('subitoFilterActive', 'false');

            // 4. Aggiorna l'interfaccia (il pallino torna grigio) e ripulisce la pagina
            updateStateUI();
            forceRecalculateAll();
        });
    }

    // --- 7. AVVIO DEL PROGRAMMA ---
    initUI();

    // Configurazione dell'Observer
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'href', 'data-testid']
    });

    // Inizializzazione post-rendering
    setTimeout(() => {
        processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));
    }, 1000);

})();
