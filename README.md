
<p align="center">
  <img src="Testata.png" alt="Subito.it Filtri Avanzati Testata" width="60%">
</p>

# Subito.it - Filtri Avanzati & Automazione 🔍

Widget che potenzia la navigazione su Subito.it introducendo filtri prezzo, rimozione dei blocchi pubblicitari e strumenti di automazione per la visualizzazione e lo scorrimento dei risultati.

<p align="center">
  <img width="1056" height="774" alt="Utilizzo v4.0" src="https://github.com/user-attachments/assets/bdf29609-7509-417d-9d8b-a87200967a40" width="60%" />
</p>
Dimostrazione utilizzo della versione 4.0


---

## FUNZIONALITÀ

<p align="center">
  <img align="right" height="600" alt="Menù v4.0" src="https://github.com/user-attachments/assets/9f2e3dc6-b4a3-43d4-bb0c-d38e208df462" />

  Menù della versione 4.0
</p>

### Filtri Annunci
* Range di Prezzo.
* Blacklist Avanzata: esclusione di parole precise (cioè <mac> non esclude <macchina>).
* Esclusione Vetrina / Sponsorizzati.
* Esclusione Annunci Senza Prezzo.
* Esclusione Aziende / Rivenditori.
* Modalita Visive:
  * Modalita Fantasma: riduce l'opacita degli annunci esclusi, rendendoli nuovamente visibili al passaggio del mouse.
  * Scomparsa Totale: rimuove completamente l'annuncio e collassa la griglia.

### Pulizia Interfaccia
* Blocco Pubblicita: rimozione di banner top, laterali, promozionali e slot sponsorizzati.

### Automazione della Navigazione
* Auto-Start alla Lista: all'apertura o al cambio di pagina, lo scroll si posiziona automaticamente sopra il primo annuncio reale, superando l'intestazione.
* Auto-Scroll: scorrimento automatico verso il basso con regolazione numerica della velocità.
* Auto-Skip a Fine Pagina: passaggio automatico alla pagina successiva dopo un intervallo temporale predefinito, si avvia quando i bottoni delle pagine diventano visibili.
* Pausa se interagisci: il conto alla rovescia dell'auto-skip e lo scorrimento si interrompono automaticamente se il cursore del mouse sosta sopra un annuncio.
* Modalita Intelligente:
  * Scroll a Step: per leggere meglio.
  * Calcolo Dinamico Skip: in base a quanti annunci ci sono all ultima riga e quanti secondi si impostano.
---

## 📦 INSTALLAZIONE

1. Assicurati di avere l'estensione **Tampermonkey** installata sul tuo browser, clicca sul tuo browser per installarla:  [Chrome](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo),    [Firefox](https://addons.mozilla.org/it/firefox/addon/tampermonkey/),    [Edge](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikflhlhnmldbdhaainainbdfeagmcog).

2. Clicca sul link di installazione diretta dello script:
   👉 **[Clicca qui per Installare lo Script](https://raw.githubusercontent.com/MaffiGabri/Subito.it-filtri_avanzati/main/subito-filter.user.js)**
   
3. Tampermonkey aprirà una scheda di conferma: clicca su **Installa**.
   
4. Apri [Subito.it](https://www.subito.it) e goditi la tua ricerca pulita!

---

## 🛠️ COME SI USA?

All'apertura della pagina comparirà un pannello fluttuante:
* Trascinamento e Riduzione: la barra superiore consente di spostare il pannello in qualsiasi punto dello schermo; il pulsante laterale riduce l'interfaccia a icona o apre il widget.
* Applicazione Filtri: i campi testuali supportano l'aggiornamento automatico durante la digitazione oppure l'invio manuale tramite tasto Enter o pulsante "Applica".
* Menu Impostazioni Avanzate: il menu a tendina racchiude i filtri secondari, la rimozione banner e tutti i parametri di navigazione automatica.
* Contatore in Tempo Reale: una barra di stato in fondo al pannello indica costantemente il numero di inserzioni nascoste rispetto al totale presente nella pagina.
---

## 💬 Bug e Suggerimenti

Hai trovato un problema o vuoi proporre una nuova funzionalità? 
Apri una [Issue](https://github.com/MaffiGabri/Subito.it-filtri_avanzati/issues) su questa repository!

---

![Tampermonkey](https://img.shields.io/badge/Tampermonkey-Supported-green.svg)
![License](https://img.shields.io/badge/License-MIT-blue.svg)

*Disclaimer: Questo script è un progetto amatoriale e non è affiliato, associato o approvato da Subito.it. Inoltre è stata usata AI per la programmazione, ma sotto mio scrutinio e sotto la mia direzione e visione.*
