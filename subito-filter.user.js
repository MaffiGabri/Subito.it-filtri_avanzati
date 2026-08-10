// ==UserScript==
// @name         Subito.it - Filtri Avanzati (Prezzo, Blacklist, Vetrina)
// @namespace    http://tampermonkey.net/
// @version      3.0.0
// @description  Filtra annunci su Subito.it per prezzo, parole chiave e nasconde la vetrina.
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
    // Aggiunti container più generici per garantire robustezza ai cambi di classe
    const CARD_SELECTOR = 'article[class*="card" i], div[class*="card" i], .items__item, [data-testid="item-card"]';

    const state = {
        minPrice: parseFloat(localStorage.getItem('subitoMinPrice')) || 0,
        maxPrice: parseFloat(localStorage.getItem('subitoMaxPrice')) || Infinity,
        blacklist: localStorage.getItem('subitoBlacklist') || '',
        isActive: localStorage.getItem('subitoFilterActive') === 'true',
        isMinimized: localStorage.getItem('subitoPanelMinimized') === 'true',
        hideSponsored: localStorage.getItem('subitoHideSponsored') === 'true',
        collapseMode: localStorage.getItem('subitoCollapseMode') === 'true' // Nuovo stato per il layout
    };

    // --- 2. INIEZIONE CSS ---
    function injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            /* Modalità Fantasma (Esistente) */
            .tm-filtered-card-ghost {
                opacity: 0.1 !important;
                filter: grayscale(100%) !important;
                transition: opacity 0.25s ease, filter 0.25s ease !important;
            }
            .tm-filtered-card-ghost:hover {
                opacity: 1 !important;
                filter: none !important;
            }

            /* Modalità Collasso (Nuova) */
            .tm-filtered-card-collapse {
                display: none !important;
            }

            #tm-filter-panel {
                position: fixed;
                background: #ffffff;
                border: 2px solid #ff3e41;
                border-radius: 8px;
                z-index: 999999;
                box-shadow: 0 8px 16px rgba(0,0,0,0.2);
                font-family: system-ui, -apple-system, sans-serif;
                width: 250px; /* Leggermente allargato per il nuovo testo */
                display: flex;
                flex-direction: column;
                overflow: hidden;
            }
            #tm-drag-header {
                background: #f8f9fa;
                padding: 8px 12px;
                border-bottom: 1px solid #eee;
                cursor: grab;
                user-select: none;
                display: flex;
                align-items: center;
                justify-content: space-between;
            }
            #tm-drag-header:active { cursor: grabbing; }
            .tm-panel-body { padding: 12px; display: flex; flex-direction: column; gap: 10px; }
            .tm-hidden { display: none !important; }

            .tm-input { width: 100%; padding: 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; box-sizing: border-box; }
            .tm-row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
            .tm-btn { flex: 1; padding: 8px; border: none; border-radius: 4px; cursor: pointer; font-weight: 600; font-size: 12px; transition: background 0.2s, opacity 0.2s; }
            .tm-btn:hover { opacity: 0.9; }
            .tm-btn-primary { background: #ff3e41; color: white; }
            .tm-btn-on { background: #28a745; color: white; }
            .tm-btn-off { background: #eee; color: #333; border: 1px solid #ccc; }

            /* FORZA LA VISIBILITÀ DELLE CHECKBOX */
            input[type="checkbox"][id^="tm-check-"] {
                appearance: checkbox !important;
                -webkit-appearance: checkbox !important;
                width: 16px !important;
                height: 16px !important;
                display: inline-block !important;
                visibility: visible !important;
                opacity: 1 !important;
                position: static !important;
                margin: 0 !important;
                clip: auto !important;
                pointer-events: auto !important;
                cursor: pointer !important;
            }
        `;
        document.head.appendChild(style);
    }

    // --- 3. LOGICA CORE DI ESTRAZIONE E FILTRAGGIO ---

    function extractPrice(cardNode) {
        // Cerca specificatamente negli elementi che solitamente contengono il prezzo
        const priceSection = cardNode.querySelector('[class*="price"]') || cardNode;
        const text = (priceSection.innerText || priceSection.textContent || '').replace(/\s+/g, ' ');
        const match = text.match(/([\d\.]+)\s*€/);

        if (match) {
            const priceStr = match[1].replace(/\./g, '');
            const parsed = parseFloat(priceStr);
            if (!isNaN(parsed)) return parsed;
        }
        return null; // Restituisce null se non trova nulla (es: "In regalo")
    }

    function isSponsored(cardNode) {
        // Cerca SOLO nei badge per evitare falsi positivi nel titolo/descrizione
        const badges = cardNode.querySelectorAll('span.caption, [class*="tag"], [class*="badge"], [class*="index-module_badge"]');
        for (let badge of badges) {
            const text = (badge.innerText || badge.textContent || '').toLowerCase().trim();
            if (text === 'vetrina' || text.includes('venditore pro') || text === 'promosso') {
                return true;
            }
        }
        return false;
    }

    // Costruisce una Regex solida che cerca la parola esatta usando i "Word Boundaries" Unicode
    function buildBlacklistRegex(blacklistStr) {
        const terms = blacklistStr.split(',')
            .map(t => t.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) // Escapa i caratteri speciali regex
            .filter(t => t.length > 0);

        if (terms.length === 0) return null;

        // (?<!\p{L}) e (?!\p{L}) significano "non preceduto/seguito da una lettera".
        // Supporta le lettere accentate (àèìòù) molto meglio del classico \b
        return new RegExp(`(?<!\\p{L})(${terms.join('|')})(?!\\p{L})`, 'iu');
    }

    function processCards(cardsArray) {
        if (!state.isActive) {
            cardsArray.forEach(c => {
                c.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse');
            });
            return;
        }

        const blacklistRegex = buildBlacklistRegex(state.blacklist);

        cardsArray.forEach(card => {
            const link = card.tagName.toLowerCase() === 'a' ? card : card.querySelector('a');
            if (!link || !link.href || !link.href.includes('subito.it/')) return;

            let shouldHide = false;

            // Estrae solo il testo visibile
            const cardText = (card.innerText || card.textContent || '').toLowerCase();

            // 1. Blacklist (Parola esatta)
            if (blacklistRegex && blacklistRegex.test(cardText)) {
                shouldHide = true;
            }

            // 2. Sponsorizzati / Vetrina (Controllato solo nei Badge)
            if (!shouldHide && state.hideSponsored && isSponsored(card)) {
                shouldHide = true;
            }

            // 3. Prezzo
            if (!shouldHide) {
                const price = extractPrice(card);
                // Se il prezzo è null (nessun prezzo), lo ignoriamo permettendo all'annuncio di passare
                if (price !== null && (price < state.minPrice || price > (state.maxPrice || Infinity))) {
                    shouldHide = true;
                }
            }

            // Applica CSS dinamico in base alle preferenze dell'utente
            if (shouldHide) {
                if (state.collapseMode) {
                    card.classList.add('tm-filtered-card-collapse');
                    card.classList.remove('tm-filtered-card-ghost');
                } else {
                    card.classList.add('tm-filtered-card-ghost');
                    card.classList.remove('tm-filtered-card-collapse');
                }
            } else {
                card.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse');
            }
        });
    }

    // --- 4. OBSERVER AD ALTE PRESTAZIONI ---
    const pendingNodes = new Set();
    let animationFrameId = null;

    // Questa nuova versione ascolta anche le modifiche interne ai nodi per battere il DOM recycling
    const observer = new MutationObserver((mutations) => {
        if (!state.isActive) return;
        let hasNewCards = false;

        for (let mutation of mutations) {
            let target = mutation.target;

            // Se cambiano gli attributi o il testo, ricalcola la card genitrice
            if (target.nodeType === Node.TEXT_NODE) target = target.parentElement;

            const closestCard = target && target.closest ? target.closest(CARD_SELECTOR) : null;
            if (closestCard) {
                pendingNodes.add(closestCard);
                hasNewCards = true;
            }

            // Gestione classica dei nodi aggiunti
            if (mutation.addedNodes) {
                for (let node of mutation.addedNodes) {
                    if (node.nodeType !== Node.ELEMENT_NODE) continue;

                    if (node.matches && node.matches(CARD_SELECTOR)) {
                        pendingNodes.add(node);
                        hasNewCards = true;
                    }

                    const innerCards = node.querySelectorAll ? node.querySelectorAll(CARD_SELECTOR) : [];
                    if (innerCards.length > 0) {
                        innerCards.forEach(c => pendingNodes.add(c));
                        hasNewCards = true;
                    }
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

    // --- 5. INTERFACCIA UTENTE ---
    function initUI() {
        injectStyles();

        const panel = document.createElement('div');
        panel.id = 'tm-filter-panel';

        const savedLeft = parseFloat(localStorage.getItem('subitoPanelLeft'));
        const savedTop = parseFloat(localStorage.getItem('subitoPanelTop'));

        if (!isNaN(savedLeft) && !isNaN(savedTop)) {
            const safeX = Math.max(0, Math.min(savedLeft, window.innerWidth - 250));
            const safeY = Math.max(0, Math.min(savedTop, window.innerHeight - 50));
            panel.style.left = `${safeX}px`;
            panel.style.top = `${safeY}px`;
        } else {
            panel.style.bottom = '20px';
            panel.style.right = '20px';
        }

        panel.innerHTML = `
            <div id="tm-drag-header">
                <span style="font-weight: 700; color: #ff3e41; font-size: 13px;">⠿ Filtri Subito</span>
                <button id="tm-toggle-btn" style="background:none; border:none; font-size:18px; font-weight:bold; color:#555; cursor:pointer;">
                    ${state.isMinimized ? '+' : '−'}
                </button>
            </div>

            <div id="tm-panel-body" class="tm-panel-body ${state.isMinimized ? 'tm-hidden' : ''}">
                <div class="tm-row">
                    <div>
                        <label style="font-size:11px; color:#666;">Min €</label>
                        <input type="number" id="tm-input-min" class="tm-input" value="${state.minPrice}">
                    </div>
                    <div>
                        <label style="font-size:11px; color:#666;">Max €</label>
                        <input type="number" id="tm-input-max" class="tm-input" value="${state.maxPrice === Infinity ? '' : state.maxPrice}">
                    </div>
                </div>

                <div>
                    <label style="font-size:11px; color:#666;">Escludi parole (parola esatta, separate da virgola):</label>
                    <input type="text" id="tm-input-blacklist" class="tm-input" placeholder="es: rotto, cerco" value="${state.blacklist}">
                </div>

                <div style="display: flex; align-items: center; gap: 8px; margin-top: 4px;">
                    <input type="checkbox" id="tm-check-sponsored" ${state.hideSponsored ? 'checked' : ''}>
                    <label for="tm-check-sponsored" style="font-size: 12px; color: #333; cursor: pointer; user-select: none;">Nascondi Vetrina / Pro</label>
                </div>

                <!-- Nuovo Checkbox per il Collasso -->
                <div style="display: flex; align-items: center; gap: 8px; margin-top: 2px;">
                    <input type="checkbox" id="tm-check-collapse" ${state.collapseMode ? 'checked' : ''}>
                    <label for="tm-check-collapse" style="font-size: 12px; color: #333; cursor: pointer; user-select: none;">Scomparsa totale (Collassa griglia)</label>
                </div>

                <div class="tm-row" style="margin-top: 8px;">
                    <button id="tm-btn-apply" class="tm-btn tm-btn-primary">Applica</button>
                    <button id="tm-btn-toggle" class="tm-btn"></button>
                </div>

                <div id="tm-status-text" style="font-size: 11px; text-align: center; font-weight: bold; margin-top: 4px;"></div>
            </div>
        `;
        document.body.appendChild(panel);

        // --- Logica Aggiornamento Pulsante Dinamico ---
        function updateStateUI() {
            const toggleBtn = document.getElementById('tm-btn-toggle');
            const statusText = document.getElementById('tm-status-text');

            if (state.isActive) {
                toggleBtn.textContent = 'Acceso';
                toggleBtn.className = 'tm-btn tm-btn-on';
                statusText.textContent = 'Filtri Attivi sulla griglia';
                statusText.style.color = '#28a745';
            } else {
                toggleBtn.textContent = 'Spento';
                toggleBtn.className = 'tm-btn tm-btn-off';
                statusText.textContent = 'Filtri Disattivati';
                statusText.style.color = '#6c757d';
            }
        }

        updateStateUI();

        // --- Logica Drag & Drop ---
        const header = document.getElementById('tm-drag-header');
        let isDragging = false;
        let startX, startY;

        header.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON') return;
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX - rect.left;
            startY = e.clientY - rect.top;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            let x = e.clientX - startX;
            let y = e.clientY - startY;

            x = Math.max(0, Math.min(x, window.innerWidth - panel.offsetWidth));
            y = Math.max(0, Math.min(y, window.innerHeight - panel.offsetHeight));

            panel.style.left = `${x}px`;
            panel.style.top = `${y}px`;
            panel.style.bottom = 'auto';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                localStorage.setItem('subitoPanelLeft', parseFloat(panel.style.left));
                localStorage.setItem('subitoPanelTop', parseFloat(panel.style.top));
            }
        });

        // --- Binding Eventi UI ---
        const bodyPanel = document.getElementById('tm-panel-body');
        const toggleBtn = document.getElementById('tm-toggle-btn');

        toggleBtn.addEventListener('click', () => {
            state.isMinimized = !state.isMinimized;
            localStorage.setItem('subitoPanelMinimized', state.isMinimized);
            bodyPanel.classList.toggle('tm-hidden', state.isMinimized);
            panel.style.width = state.isMinimized ? 'auto' : '250px';
            toggleBtn.textContent = state.isMinimized ? '+' : '−';
        });

        const applyFilters = () => {
            state.minPrice = parseFloat(document.getElementById('tm-input-min').value) || 0;
            const maxVal = parseFloat(document.getElementById('tm-input-max').value);
            state.maxPrice = isNaN(maxVal) ? Infinity : maxVal;
            state.blacklist = document.getElementById('tm-input-blacklist').value;
            state.hideSponsored = document.getElementById('tm-check-sponsored').checked;
            state.collapseMode = document.getElementById('tm-check-collapse').checked;
            state.isActive = true;

            localStorage.setItem('subitoMinPrice', state.minPrice);
            localStorage.setItem('subitoMaxPrice', state.maxPrice === Infinity ? '' : state.maxPrice);
            localStorage.setItem('subitoBlacklist', state.blacklist);
            localStorage.setItem('subitoHideSponsored', state.hideSponsored);
            localStorage.setItem('subitoCollapseMode', state.collapseMode);
            localStorage.setItem('subitoFilterActive', 'true');

            updateStateUI();

            // Ripulisce gli stili da tutte le card per forzare un calcolo pulito
            document.querySelectorAll(CARD_SELECTOR).forEach(c => c.classList.remove('tm-filtered-card-ghost', 'tm-filtered-card-collapse'));
            processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));
        };

        // Click ed Eventi
        document.getElementById('tm-btn-apply').addEventListener('click', applyFilters);
        document.getElementById('tm-check-sponsored').addEventListener('change', applyFilters);
        document.getElementById('tm-check-collapse').addEventListener('change', applyFilters);

        document.getElementById('tm-btn-toggle').addEventListener('click', () => {
            if (state.isActive) {
                state.isActive = false;
                localStorage.setItem('subitoFilterActive', 'false');
                updateStateUI();
                processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));
            } else {
                applyFilters();
            }
        });
    }

    // --- 6. AVVIO DEL PROGRAMMA ---
    initUI();
    // Ascolta non solo le aggiunte, ma anche le modifiche interne (attributes, characterData) per battere il recycle di React
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    setTimeout(() => {
        processCards(Array.from(document.querySelectorAll(CARD_SELECTOR)));
    }, 1000);

})();