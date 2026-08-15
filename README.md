
<p align="center">
  <img src="Testata.png" alt="Subito.it Filtri Avanzati Testata" width="60%">
</p>

Subito.it - Filtri Avanzati 🔍

Un avanzato script per Tampermonkey progettato per ripulire i risultati di ricerca su **Subito.it** in tempo reale. Permette di nascondere o rendere trasparenti gli annunci irrilevanti, le vetrine sponsorizzate e gli articoli fuori budget.

<p align="center">
  <img width="1074" height="748" alt="Dimostrazione Utilizzo v3.0" src="https://github.com/user-attachments/assets/298c80be-014c-45c7-b5cc-181158ec1c22" width="60%" />
</p>
Dimostrazione utilizzo della versione 3.0.0


---

## Caratteristiche Principali

<p align="center">
  <img width="308" height="454" alt="Menù v3.1" src="https://github.com/user-attachments/assets/7e48c21e-22d8-48f3-a1ed-4f6ffa1cd6f6" />
</p>
Menù della versione 3.1.0


* 💰 **Filtro Prezzo (Min / Max):** Definisci un range di prezzo esatto. Gli annunci "In regalo" o senza prezzo vengono gestiti in modo intelligente senza essere nascosti.
* 🚫 **Blacklist:** Escludi annunci contenenti specifiche parole. Utilizza una logica avanzata a parole esatte (es. inserendo `mac` non nasconderà `macchina`).
* 🏷️ **Rimozione Vetrina / Venditore Pro:** Nascondi con un solo click tutti gli annunci sponsorizzati o messi in evidenza.
*  **Doppia Modalità di Nascondere:**
   **Modalità Fantasma:** L'annuncio viene reso quasi invisibile (10% di opacità e scala di grigi), ma resta cliccabile passandoci sopra col mouse.
   **Scomparsa Totale:** L'annuncio viene completamente rimosso dalla pagina e la griglia si ricompatta.
* 🎛️ **Interfaccia Spostabile:** Un pannello fluttuante, riducibile a icona e posizionabile ovunque nello schermo.
* **Tasto Reset:** Un tasto per riportare tutti i campi allo stato di default (cioè vuoti).

---

## 📦 Installazione

1. Assicurati di avere l'estensione **Tampermonkey** installata sul tuo browser, clicca sul tuo browser per installarla:  [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo),    [Firefox](https://addons.mozilla.org/it/firefox/addon/tampermonkey/),    [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikflhlhnmldbdhaainainbdfeagmcog).

2. Clicca sul link di installazione diretta dello script:
   👉 **[Clicca qui per Installare lo Script](https://raw.githubusercontent.com/MaffiGabri/Subito.it-filtri_avanzati/main/subito-filter.user.js)**
   
3. Tampermonkey aprirà una scheda di conferma: clicca su **Installa**.
   
4. Apri [Subito.it](https://www.subito.it) e goditi la tua ricerca pulita!

---

## 🛠️ Come si usa

1. Quando navighi su Subito.it, vedrai un pannello chiamato **⠿ Filtri Subito** , aprilo e chiudilo cliccando il tasto in alto a destra del pannello col bordo rosso.
2. **Imposta i valori:** Inserisci il prezzo Minimo/Massimo e le parole da escludere (separate da virgola, es: `rotto, difettoso, cerco`).
3. Scegli se spuntare **Scomparsa totale** o mantenere la modalità fantasma.
4. Clicca su **Applica** per attivare i filtri. Puoi accendere o spegnere lo script in qualsiasi momento col tasto **Acceso / Spento**.
5. Puoi trascinare il pannello dove preferisci prendendolo dall'intestazione grigia.

---

## 💬 Bug e Suggerimenti

Hai trovato un problema o vuoi proporre una nuova funzionalità? 
Apri una [Issue](https://github.com/MaffiGabri/Subito.it-filtri_avanzati/issues) su questa repository!

---

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-green.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

*Disclaimer: Questo script è un progetto amatoriale e non è affiliato, associato o approvato da Subito.it. Inoltre è stata usata AI per la programmazione, ma sotto mio scrutinio e sotto la mia totale direzione e visione.*
