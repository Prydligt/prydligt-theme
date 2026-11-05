/*!
 * Prydligt – leveransnedräkning på produktsidan
 * "Beställ inom 2 h 34 min 12 s – skickas idag"
 *
 * Räknar alltid i svensk tid (Europe/Stockholm), oavsett var kunden befinner sig.
 * Skickdagar: måndag–fredag, ej svenska helgdagar eller aftnar (se INSTÄLLNINGAR).
 * Visas bara när produkten finns i lager.
 */
(function () {
  'use strict';

  /* ======================== INSTÄLLNINGAR ======================== */
  var CUTOFF_HOUR = 16;        // beställ före 16:00 …
  var CUTOFF_MINUTE = 0;       // … och 00 minuter
  var SHIP_WEEKDAYS = [1, 2, 3, 4, 5];   // 1 = måndag … 5 = fredag
  var SKIP_EVES = true;        // julafton, nyårsafton och midsommarafton räknas inte som skickdagar
  var EXTRA_CLOSED = [];       // egna stängda dagar, t.ex. ['2026-12-28', '2026-12-29']
  var HIDE_IF_STOCK_TEXT = /slut|ej i lager|tillf\u00e4lligt|best\u00e4llningsvara|utsolgt|udsolgt|loppu|ausverkauft|uitverkocht/i;
  var ANCHOR = '.slot--article-stock-shipping';   // timern läggs direkt under lagerstatusen
  /* ============================================================== */

  var TZ = 'Europe/Stockholm';

  var TEXT = {
    sv: { pre: 'Best\u00e4ll inom', today: 'skickas idag', tomorrow: 'skickas imorgon', on: 'skickas', next: 'Best\u00e4ll nu \u2013',
          days: ['s\u00f6ndag', 'm\u00e5ndag', 'tisdag', 'onsdag', 'torsdag', 'fredag', 'l\u00f6rdag'], h: 'h', m: 'min', s: 's' },
    nb: { pre: 'Bestill innen', today: 'sendes i dag', tomorrow: 'sendes i morgen', on: 'sendes', next: 'Bestill n\u00e5 \u2013',
          days: ['s\u00f8ndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'l\u00f8rdag'], h: 't', m: 'min', s: 's' },
    da: { pre: 'Bestil inden', today: 'sendes i dag', tomorrow: 'sendes i morgen', on: 'sendes', next: 'Bestil nu \u2013',
          days: ['s\u00f8ndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'l\u00f8rdag'], h: 't', m: 'min', s: 's' },
    fi: { pre: 'Tilaa', today: 'sis\u00e4ll\u00e4 \u2013 l\u00e4hetet\u00e4\u00e4n t\u00e4n\u00e4\u00e4n', tomorrow: 'l\u00e4hetet\u00e4\u00e4n huomenna', on: 'l\u00e4hetet\u00e4\u00e4n', next: 'Tilaa nyt \u2013',
          days: ['sunnuntaina', 'maanantaina', 'tiistaina', 'keskiviikkona', 'torstaina', 'perjantaina', 'lauantaina'], h: 't', m: 'min', s: 's' },
    de: { pre: 'Bestellen Sie innerhalb von', today: 'Versand noch heute', tomorrow: 'Versand morgen', on: 'Versand am', next: 'Jetzt bestellen \u2013',
          days: ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'], h: 'Std.', m: 'Min.', s: 'Sek.' },
    nl: { pre: 'Bestel binnen', today: 'vandaag verzonden', tomorrow: 'morgen verzonden', on: 'verzonden op', next: 'Bestel nu \u2013',
          days: ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag'], h: 'u', m: 'min', s: 's' }
  };

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    if (l === 'no' || l === 'nn') l = 'nb';
    return TEXT[l] ? l : 'sv';
  }

  /* ---------- Svensk tid ---------- */
  var fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  });
  function now() { return (window.__prydligtTimerNow ? window.__prydligtTimerNow() : new Date()); }
  // Väggklockan i Stockholm som ett "falskt UTC"-datum (lätt att räkna med)
  function stockholmWall(d) {
    var p = {};
    fmt.formatToParts(d).forEach(function (x) { p[x.type] = x.value; });
    return new Date(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second));
  }
  function ymd(d) { return d.toISOString().slice(0, 10); }
  function addDays(d, n) { var x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }

  /* ---------- Svenska helgdagar ---------- */
  var holidayCache = {};
  function easter(y) {
    var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
        f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
        i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
        month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(Date.UTC(y, month - 1, day));
  }
  function firstWeekdayBetween(y, mo, from, to, wd) {
    for (var dd = from; dd <= to; dd++) { var x = new Date(Date.UTC(y, mo, dd)); if (x.getUTCDay() === wd) return x; }
  }
  function holidays(y) {
    if (holidayCache[y]) return holidayCache[y];
    var e = easter(y), list = [
      Date.UTC(y, 0, 1), Date.UTC(y, 0, 6), Date.UTC(y, 4, 1), Date.UTC(y, 5, 6),
      Date.UTC(y, 11, 25), Date.UTC(y, 11, 26)
    ].map(function (t) { return new Date(t); });
    list.push(addDays(e, -2), addDays(e, 1), addDays(e, 39));            // långfredag, annandag påsk, Kristi himmelsfärd
    var midsommardagen = firstWeekdayBetween(y, 5, 20, 26, 6);           // lördag 20–26 juni
    list.push(midsommardagen);
    list.push(firstWeekdayBetween(y, 9, 31, 31, 6) || firstWeekdayBetween(y, 10, 1, 6, 6)); // alla helgons dag
    if (SKIP_EVES) {
      list.push(new Date(Date.UTC(y, 11, 24)), new Date(Date.UTC(y, 11, 31)), addDays(midsommardagen, -1));
    }
    var set = {};
    list.forEach(function (d) { if (d) set[ymd(d)] = true; });
    EXTRA_CLOSED.forEach(function (s) { set[s] = true; });
    holidayCache[y] = set;
    return set;
  }
  function isShipDay(d) {
    return SHIP_WEEKDAYS.indexOf(d.getUTCDay()) !== -1 && !holidays(d.getUTCFullYear())[ymd(d)];
  }

  /* ---------- Beräkning ---------- */
  function state() {
    var wall = stockholmWall(now());
    var today = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()));
    var cutoff = new Date(today.getTime() + (CUTOFF_HOUR * 60 + CUTOFF_MINUTE) * 60000);
    if (isShipDay(today) && wall < cutoff) {
      return { mode: 'today', left: Math.floor((cutoff - wall) / 1000) };
    }
    var d = addDays(today, 1), n = 1;
    while (!isShipDay(d) && n < 30) { d = addDays(d, 1); n++; }
    return { mode: n === 1 ? 'tomorrow' : 'day', day: d.getUTCDay() };
  }

  /* ---------- Leveransruta: fri frakt-mätare + nedräkning + beräknad leverans + öppet köp ---------- */
  // Per marknad (styrs av sidans språk): leveranstid i vardagar och gräns för fri frakt
  var MARKET = {
    sv: { days: [1, 2], free: 600, cur: 'kr',  fmt: function (n) { return n + ' kr'; } },
    nb: { days: [2, 4], free: 800, cur: 'kr',  fmt: function (n) { return n + ' kr'; } },
    da: { days: [2, 4], free: 600, cur: 'kr',  fmt: function (n) { return n + ' kr'; } },
    fi: { days: [2, 4], free: 80,  cur: 'EUR', fmt: function (n) { return n + ' €'; } },
    de: { days: [2, 4], free: 80,  cur: 'EUR', fmt: function (n) { return n + ' €'; } },
    nl: { days: [2, 4], free: 80,  cur: 'EUR', fmt: function (n) { return '€ ' + n; } }
  };
  var BOX = {
    sv: { free: 'Fri frakt', left: 'kvar', reached: 'Du har fri frakt', pre: 'Beställ inom', today: 'så skickas din order idag.', next: 'Beställ nu så skickas din order', est: 'Beräknad leverans mellan', and: 'och', ret: '99 dagars öppet köp', tomorrow: 'imorgon' ,
          months: ['jan','feb','mars','apr','maj','juni','juli','aug','sep','okt','nov','dec'] },
    nb: { free: 'Gratis frakt', left: 'igjen', reached: 'Du har gratis frakt', pre: 'Bestill innen', today: 'så sendes ordren din i dag.', next: 'Bestill nå så sendes ordren din', est: 'Beregnet levering mellom', and: 'og', ret: '99 dagers åpent kjøp', tomorrow: 'i morgen',
          months: ['jan','feb','mars','apr','mai','juni','juli','aug','sep','okt','nov','des'] },
    da: { free: 'Gratis fragt', left: 'tilbage', reached: 'Du har gratis fragt', pre: 'Bestil inden', today: 'så sendes din ordre i dag.', next: 'Bestil nu så sendes din ordre', est: 'Forventet levering mellem', and: 'og', ret: '99 dages fuld returret', tomorrow: 'i morgen',
          months: ['jan','feb','marts','apr','maj','juni','juli','aug','sep','okt','nov','dec'] },
    fi: { free: 'Ilmainen toimitus', left: 'jäljellä', reached: 'Saat ilmaisen toimituksen', pre: 'Tilaa', today: 'sisällä, niin tilauksesi lähetetään tänään.', next: 'Tilaa nyt, niin tilauksesi lähetetään', est: 'Arvioitu toimitus', and: '–', ret: '99 päivän palautusoikeus', tomorrow: 'huomenna',
          months: ['tammik.','helmik.','maalisk.','huhtik.','toukok.','kesäk.','heinäk.','elok.','syysk.','lokak.','marrask.','jouluk.'] },
    de: { free: 'Kostenloser Versand', left: 'übrig', reached: 'Kostenloser Versand erreicht', pre: 'Bestellen Sie innerhalb von', today: 'und Ihre Bestellung wird heute versandt.', next: 'Jetzt bestellen – Versand', est: 'Voraussichtliche Lieferung zwischen', and: 'und', ret: '99 Tage Rückgaberecht', tomorrow: 'morgen',
          months: ['Jan.','Feb.','März','Apr.','Mai','Juni','Juli','Aug.','Sep.','Okt.','Nov.','Dez.'] },
    nl: { free: 'Gratis verzending', left: 'te gaan', reached: 'Je hebt gratis verzending', pre: 'Bestel binnen', today: 'en je bestelling wordt vandaag verzonden.', next: 'Bestel nu, dan wordt je bestelling verzonden', est: 'Verwachte levering tussen', and: 'en', ret: '99 dagen bedenktijd', tomorrow: 'morgen',
          months: ['jan','feb','mrt','apr','mei','jun','jul','aug','sep','okt','nov','dec'] }
  };

  function addShipDays(d, n) { var x = d; while (n > 0) { x = addDays(x, 1); if (isShipDay(x)) n--; } return x; }
  function fmtDate(d) {
    var l = lang(), t = TEXT[l], b = BOX[l];
    var wd = t.days[d.getUTCDay()], day = d.getUTCDate(), mon = b.months[d.getUTCMonth()];
    if (l === 'de') return wd + ', ' + day + '. ' + mon;
    if (l === 'fi') return day + '. ' + mon;
    return wd + ' ' + day + ' ' + mon;
  }
  function shipDate() {
    var wall = stockholmWall(now());
    var today = new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()));
    var st = state();
    if (st.mode === 'today') return today;
    var d = addDays(today, 1); while (!isShipDay(d)) d = addDays(d, 1);
    return d;
  }
  // Kvar till fri frakt: läses från Abicarts egen notis i sidhuvudet ("330 SEK kvar till fri frakt" / "Du har fri frakt")
  function freeShippingLeft(m) {
    var n = document.querySelector('.tws-free-shipping-notice');
    if (!n) {
      // Ingen notis på sidan (t.ex. i kassan): räkna från varukorgens värde i butikens data
      try {
        var o = window.twsReduxStore && window.twsReduxStore.getState().order;
        var cart = o && o.costs && o.costs.cart && o.costs.cart.incVat;
        if (typeof cart === 'number') return Math.max(0, Math.round(m.free - cart));
      } catch (e) {}
      return m.free;
    }
    if (n.querySelector('.tws-free-shipping-notice--cost-reached')) return 0;
    var txt = (n.textContent || '').replace(/\s/g, '');
    var num = txt.match(/(\d+(?:[.,]\d+)?)/);
    return num ? Math.max(0, Math.round(parseFloat(num[1].replace(',', '.')))) : m.free;
  }

  // Nedräkning + beräknad leveransdag (används på produktsidan och i kassan)
  function deliveryText(l, t, b, m, s) {
    var when;
    if (s.mode === 'today') {
      var h = Math.floor(s.left / 3600), mi = Math.floor((s.left % 3600) / 60), sec = s.left % 60;
      var parts = (h > 0 ? h + ' ' + t.h + ' ' : '') + mi + ' ' + t.m + ' ' + (sec < 10 ? '0' : '') + sec + ' ' + t.s;
      when = b.pre + ' <strong class="p-ship-timer__time">' + parts + '</strong> ' + b.today;
    } else {
      when = b.next + ' <strong>' + (s.mode === 'tomorrow' ? b.tomorrow : t.days[s.day]) + '</strong>.';
    }
    var sd = shipDate(), d1 = addShipDays(sd, m.days[0]), d2 = addShipDays(sd, m.days[1]);
    var end = fmtDate(d2), dot = /\.$/.test(end) ? '' : '.';
    var est = ' ' + b.est + ' <strong>' + fmtDate(d1) + '</strong> ' + b.and + ' <strong>' + end + '</strong>' + dot;

    return when + est;
  }

  function render(el) {
    var l = lang(), t = TEXT[l], b = BOX[l], m = MARKET[l], s = state();
    var left = freeShippingLeft(m), pct = Math.max(0, Math.min(100, Math.round((m.free - left) / m.free * 100)));
    var freeRow = left > 0
      ? '<div class="p-ship__free"><span>' + b.free + '</span><span><strong>' + m.fmt(left) + '</strong> ' + b.left + '</span></div>'
      : '<div class="p-ship__free p-ship__free--ok"><span>' + b.reached + '</span></div>';
    var bar = '<div class="p-ship__bar" aria-hidden="true"><span style="width:' + (left > 0 ? pct : 100) + '%"></span></div>';

    var whenEst = deliveryText(l, t, b, m, s);

    var html = freeRow + bar +
      '<p class="p-ship__when">' + whenEst + '</p>' +
      '<p class="p-ship__ret">' + b.ret + '</p>';
    if (el.__last !== html) { el.innerHTML = html; el.__last = html; }
  }

  /* ---------- Placering på sidan ---------- */
  var timerEl = null;
  // Visa rutan om produkten finns i lager, eller om lagerstatus inte visas än (t.ex. variant ej vald).
  // Göm den bara om lagerstatusen uttryckligen säger slut/beställningsvara.
  function inStock() {
    var msg = document.querySelector('.tws-article-stock-shipping--delivery-message');
    if (!msg || !(msg.textContent || '').trim()) return true;
    return !HIDE_IF_STOCK_TEXT.test(msg.textContent || '');
  }
  function placeBox(el) {
    var stock = document.querySelector(ANCHOR);
    if (stock && stock.offsetParent !== null) {           // lagerstatusen syns: direkt under den
      if (el.previousElementSibling !== stock) stock.insertAdjacentElement('afterend', el);
      return true;
    }
    // annars före garantimodulen / förtroenderutan
    var before = document.querySelector('.p-warranty') || document.querySelector('.slot--unique-selling-points');
    if (before) { if (el.nextElementSibling !== before) before.insertAdjacentElement('beforebegin', el); return true; }
    if (stock) { if (el.previousElementSibling !== stock) stock.insertAdjacentElement('afterend', el); return true; }
    return false;
  }
  /* ---------- "Finns i lager" på produkter där Abicart inte visar lagerstatus
     (produkter utan lagerhantering, t.ex. smycken med bokstavsval). Kollas mot butikens API. ---------- */
  var STOCK_TXT = { sv: 'Finns i lager', nb: 'På lager', da: 'På lager', fi: 'Varastossa', de: 'Auf Lager', nl: 'Op voorraad' };
  var stockCheck = { path: null, ok: false };
  function pageArticleNumber() {
    var el = document.querySelector('.tws-article-description--article-number');
    var m = el && (el.textContent || '').match(/:\s*(\S+)/);
    return m ? m[1] : null;
  }
  function checkBuyable() {
    if (stockCheck.path === location.pathname) return;
    stockCheck = { path: location.pathname, ok: false };
    var nr = pageArticleNumber(), st = window.twsReduxStore && window.twsReduxStore.getState && window.twsReduxStore.getState();
    if (!nr || !st || !(window.twsCore && window.twsCore.twapiFromState)) return;
    var path = location.pathname;
    Promise.resolve(window.twsCore.twapiFromState(st)('Article.list')({ uid: true, isBuyable: true, presentationOnly: true, stock: true }, { filters: { articleNumber: nr }, limit: 1 }))
      .then(function (list) {
        var a = list && list[0];
        if (path !== location.pathname || !a) return;
        // Ingen lagerhantering + köpbar = alltid tillgänglig
        stockCheck.ok = a.isBuyable !== false && !a.presentationOnly && !(a.stock && a.stock.useStock);
      }).catch(function () {});
  }
  var stockEl = null;
  function showOwnStock(box) {
    var themeMsg = document.querySelector('.tws-article-stock-shipping--delivery-message');
    var themeShows = themeMsg && (themeMsg.textContent || '').trim() && themeMsg.offsetParent !== null;
    checkBuyable();
    if (themeShows || !stockCheck.ok) { if (stockEl && stockEl.parentNode) stockEl.parentNode.removeChild(stockEl); return; }
    if (!stockEl) { stockEl = document.createElement('div'); stockEl.className = 'p-stock'; }
    stockEl.textContent = STOCK_TXT[lang()] || STOCK_TXT.sv;
    if (box.previousElementSibling !== stockEl) box.insertAdjacentElement('beforebegin', stockEl);
  }

  function mount() {
    if (!document.body || !document.body.classList.contains('article')) return;
    if (!inStock()) { if (timerEl && timerEl.parentNode) timerEl.parentNode.removeChild(timerEl); return; }
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.className = 'p-ship-timer p-ship';
      timerEl.setAttribute('aria-live', 'off');
    }
    if (!placeBox(timerEl)) return;
    render(timerEl);
    showOwnStock(timerEl);
  }

  // Fri frakt-mätare i varukorgen, ovanför sammanfattningen
  var cartEl = null;
  function mountCart() {
    if (!document.body || !document.body.classList.contains('checkout')) return;
    // Abicart har två sammanfattningar (mobil och dator) – använd den som syns
    var slots = document.querySelectorAll('.slot--checkout-cart-summary'), anchor = null;
    for (var i = 0; i < slots.length; i++) { if (slots[i].offsetParent !== null) { anchor = slots[i]; break; } }
    if (!anchor) anchor = slots[0];
    if (!anchor) return;
    if (!cartEl) { cartEl = document.createElement('div'); cartEl.className = 'p-cart-free'; }
    if (anchor.firstElementChild !== cartEl) anchor.insertBefore(cartEl, anchor.firstChild);
    var l = lang(), b = BOX[l], m = MARKET[l], left = freeShippingLeft(m);
    var pct = left > 0 ? Math.max(0, Math.min(100, Math.round((m.free - left) / m.free * 100))) : 100;
    var html = (left > 0
      ? '<div class="p-ship__free"><span>' + b.free + '</span><span><strong>' + m.fmt(left) + '</strong> ' + b.left + '</span></div>'
      : '<div class="p-ship__free p-ship__free--ok"><span>' + b.reached + '</span></div>') +
      '<div class="p-ship__bar" aria-hidden="true"><span style="width:' + pct + '%"></span></div>' +
      '<p class="p-ship__when">' + deliveryText(l, TEXT[l], b, m, state()) + '</p>';
    if (cartEl.__last !== html) { cartEl.innerHTML = html; cartEl.__last = html; }
  }

  function start() {
    mount(); mountCart();
    setInterval(function () { mount(); mountCart(); }, 1000);   // uppdaterar sekunderna och klarar att Abicart byter sidinnehåll
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  // För test: window.prydligtTimer.state()
  window.prydligtTimer = { state: state, isShipDay: isShipDay, holidays: holidays };
})();

/*!
 * Prydligt – antalsknappar i varukorgen:  [ − ]  2  [ + ]
 * Ändrar antalet och uppdaterar varukorgen direkt (Abicarts egen uppdatera-knapp
 * trycks i bakgrunden). Vid antal 1 blir minus en papperskorg som tar bort varan.
 */
(function () {
  'use strict';

  var DELAY = 450;   // ms att vänta efter sista klicket innan varukorgen uppdateras

  var L = {
    sv: { minus: 'Minska antal', plus: '\u00d6ka antal', remove: 'Ta bort' },
    nb: { minus: 'Reduser antall', plus: '\u00d8k antall', remove: 'Fjern' },
    da: { minus: 'Formindsk antal', plus: 'For\u00f8g antal', remove: 'Fjern' },
    fi: { minus: 'V\u00e4henn\u00e4', plus: 'Lis\u00e4\u00e4', remove: 'Poista' },
    de: { minus: 'Menge verringern', plus: 'Menge erh\u00f6hen', remove: 'Entfernen' },
    nl: { minus: 'Aantal verlagen', plus: 'Aantal verhogen', remove: 'Verwijderen' }
  };
  function t() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    if (l === 'no' || l === 'nn') l = 'nb';
    return L[l] || L.sv;
  }

  var ICON_MINUS = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_PLUS  = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M5 12h14M12 5v14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';
  var ICON_TRASH = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';

  // Sätt värdet så att Abicarts React-komponent märker ändringen
  var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  function setValue(input, v) {
    setter.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function refreshButton(box) {
    var btns = box.querySelectorAll('button:not(.p-qty__btn)');
    return btns.length ? btns[btns.length - 1] : null;
  }
  function removeButton(box) {
    var item = box.closest('.tws-opc-cart--item');
    return item ? item.querySelector('.tws-opc-cart--item-remove-action') : null;
  }

  function sync(box) {
    var input = box.querySelector('input[type="number"]');
    var minus = box.querySelector('.p-qty__minus');
    if (!input || !minus) return;
    var v = parseInt(input.value, 10) || 1;
    var atOne = v <= 1;
    if (minus.__atOne !== atOne) {
      minus.innerHTML = atOne ? ICON_TRASH : ICON_MINUS;
      minus.setAttribute('aria-label', atOne ? t().remove : t().minus);
      minus.classList.toggle('p-qty__minus--remove', atOne);
      minus.__atOne = atOne;
    }
  }

  function scheduleRefresh(box) {
    clearTimeout(box.__pTimer);
    box.__pTimer = setTimeout(function () {
      var r = refreshButton(box);
      if (r) r.click();
    }, DELAY);
  }

  function enhance(box) {
    if (box.__pQty) return;
    var input = box.querySelector('input[type="number"]');
    if (!input) return;
    box.__pQty = true;
    box.classList.add('p-qty');

    var minus = document.createElement('button');
    minus.type = 'button';
    minus.className = 'p-qty__btn p-qty__minus';
    var plus = document.createElement('button');
    plus.type = 'button';
    plus.className = 'p-qty__btn p-qty__plus';
    plus.innerHTML = ICON_PLUS;
    plus.setAttribute('aria-label', t().plus);

    input.insertAdjacentElement('beforebegin', minus);
    input.insertAdjacentElement('afterend', plus);
    input.setAttribute('inputmode', 'numeric');

    minus.addEventListener('click', function (e) {
      e.preventDefault();
      var v = parseInt(input.value, 10) || 1;
      if (v <= 1) {
        var rm = removeButton(box);
        if (rm) rm.click();
        return;
      }
      setValue(input, v - 1); sync(box); scheduleRefresh(box);
    });
    plus.addEventListener('click', function (e) {
      e.preventDefault();
      var v = parseInt(input.value, 10) || 0;
      var max = parseInt(input.getAttribute('max'), 10);
      if (max && v >= max) return;
      setValue(input, v + 1); sync(box); scheduleRefresh(box);
    });
    // Skriver kunden en siffra själv uppdateras varukorgen också automatiskt
    input.addEventListener('change', function (e) { if (e.isTrusted) { sync(box); scheduleRefresh(box); } });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); sync(box); scheduleRefresh(box); } });

    sync(box);
  }

  function scan() {
    var boxes = document.querySelectorAll('.tws-opc-cart--item-info-quantity');
    for (var i = 0; i < boxes.length; i++) {
      if (!boxes[i].__pQty || !boxes[i].querySelector('.p-qty__minus')) { boxes[i].__pQty = false; enhance(boxes[i]); }
      else sync(boxes[i]);
    }
  }

  function start() {
    scan();
    new MutationObserver(function () { scan(); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/*!
 * Prydligt – förlängd garanti som tillval på produktsidan
 * [ Nej tack ] [ 1 år 47 kr ] [ 2 år 84 kr ] [ 3 år 110 kr ] [ 5 år 156 kr ]
 *
 * Priset styrs av produktens pris via prisnivåer (BANDS). Varje nivå + längd är en egen
 * artikel i Abicart (artikelnummer i ART), som läggs i varukorgen tillsammans med produkten.
 *
 * STATUS: klar. Artikel-ID slås upp automatiskt via artikelnumret. Sätt LIVE = true efter test.
 * Tills dess visas modulen bara med ?garanti=1 i adressen.
 */
(function () {
  'use strict';

  /* ======================== INSTÄLLNINGAR ======================== */
  var LIVE = true;                      // sätt till true när addToCart är inkopplad
  var CURRENCY = 'SEK';                 // visas bara i butiker med denna valuta (fler läggs till senare)
  var YEARS = [1, 2, 3, 5];
  // Prisnivåer efter produktens pris (kr). Priser = Diturs procentsatser på nivåns mittpunkt:
  // 1 år 9 %, 2 år 16 %, 3 år 21 %, 5 år 30 %.
  var BANDS = [
    { from: 200,  to: 299,  id: 'A', price: { 1: 22,  2: 40,  3: 52,  5: 74 } },
    { from: 300,  to: 449,  id: 'B', price: { 1: 34,  2: 60,  3: 78,  5: 111 } },
    { from: 450,  to: 599,  id: 'C', price: { 1: 47,  2: 84,  3: 110, 5: 156 } },
    { from: 600,  to: 799,  id: 'D', price: { 1: 63,  2: 112, 3: 146, 5: 208 } },
    { from: 800,  to: 999,  id: 'E', price: { 1: 81,  2: 144, 3: 188, 5: 267 } },
    { from: 1000, to: 1499, id: 'F', price: { 1: 112, 2: 199, 3: 261, 5: 371 } },
    { from: 1500, to: 2499, id: 'G', price: { 1: 180, 2: 319, 3: 418, 5: 594 } },
    { from: 2500, to: 3999, id: 'H', price: { 1: 292, 2: 519, 3: 679, 5: 966 } }
  ];
  function artNo(band, years) { return 'GARANTI-' + years + 'AR-' + band.id; }   // t.ex. GARANTI-2AR-C
  var ONLY_IN = /klock|watch|ur\b/i;   // visa bara på klockor (matchas mot brödsmulor/kategori); tomt = alla
  /* ============================================================== */

  var TXT = {
    title: 'F\u00f6rl\u00e4ngd garanti',
    none: 'Nej tack',
    year: '\u00e5r',
    yearPl: '\u00e5r',
    kr: 'kr',
    info: 'Kostnadsfri reparation eller ny klocka vid fel, fritt batteribyte och fri frakt \u2013 under hela garantitiden.',
    more: 'L\u00e4s mer',
    moreUrl: '/forlangd-garanti'
  };

  function enabled() {
    if (LIVE) return true;
    try { return /[?&]garanti=1\b/.test(location.search) || sessionStorage.getItem('pGarantiPreview') === '1'; } catch (e) { return false; }
  }
  try { if (/[?&]garanti=1\b/.test(location.search)) sessionStorage.setItem('pGarantiPreview', '1'); } catch (e) {}

  function productPrice() {
    var el = document.querySelector('.slot--article-price .tws-article-price--price .twsPriceCurrent');
    if (!el) return null;
    var txt = el.textContent || '';
    if (CURRENCY === 'SEK' && !/sek|kr/i.test(txt)) return null;
    var n = parseFloat(txt.replace(/[^\d,.]/g, '').replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }
  function bandFor(price) {
    for (var i = 0; i < BANDS.length; i++) if (price >= BANDS[i].from && price <= BANDS[i].to) return BANDS[i];
    return null;
  }
  function isWatch() {
    if (!ONLY_IN) return true;
    var crumbs = document.querySelector('.tws-breadcrumbs');
    var name = document.querySelector('.slot--article-name h1');
    return ONLY_IN.test(((crumbs && crumbs.textContent) || '') + ' ' + ((name && name.textContent) || ''));
  }

  /* --- Abicarts eget API, via temats egen koppling (twsCore.twapiFromState) --- */
  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function rpc(method, params) {
    var st = store();
    if (!st) return Promise.reject(new Error('Abicart-store saknas'));
    if (window.twsCore && typeof window.twsCore.twapiFromState === 'function') {
      var call = window.twsCore.twapiFromState(st)(method);
      return Promise.resolve(call.apply(null, params));
    }
    // Reserv: samma anrop som temat gör
    var q = { webshop: st.webshop && st.webshop.uid, auth: st.auth, session: st.session, language: st.language };
    var qs = Object.keys(q).map(function (k) { return k + '=' + (q[k] === null || q[k] === undefined ? '' : q[k]); }).join('&');
    return fetch('https://' + st.host + '?' + qs, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: method, params: params })
    }).then(function (r) { return r.json(); }).then(function (j) { if (j.error) throw j.error; return j.result; });
  }

  /* --- Artikelnummer -> Abicarts interna artikel-ID (uid), slås upp en gång och sparas --- */
  var uidCache = {};
  try { uidCache = JSON.parse(sessionStorage.getItem('pGarantiUids') || '{}') || {}; } catch (e) { uidCache = {}; }
  function lookupUid(articleNumber) {
    if (uidCache[articleNumber]) return Promise.resolve(uidCache[articleNumber]);
    return rpc('Article.list', [['uid', 'articleNumber'], { filters: { articleNumber: articleNumber }, limit: 1 }])
      .then(function (list) {
        var hit = list && list[0];
        if (!hit || !hit.uid) throw new Error('Hittar ingen artikel ' + articleNumber);
        uidCache[articleNumber] = hit.uid;
        try { sessionStorage.setItem('pGarantiUids', JSON.stringify(uidCache)); } catch (e) {}
        return hit.uid;
      });
  }
  function orderUid() { var st = store(); return st && st.order && st.order.uid; }
  function waitForOrder(ms) {
    return new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        var u = orderUid();
        if (u) return resolve(u);
        if (Date.now() - t0 > ms) return resolve(null);
        setTimeout(poll, 250);
      })();
    });
  }
  /* --- Uppdatera Abicarts varukorg (antal i menyn, fri frakt-notis, summor) efter att garantin lagts till.
         Samma anrop och samma urval som temat själv använder (Order.getCritical + SET_ORDER). --- */
  function orderSelection(st) {
    var lang = st.language, def = st.webshop && st.webshop.defaultLanguage, names = [lang];
    if (def && def !== lang) names.push(def);
    var sel = { costs: true, currency: true, customer: true, delivery: true, hasVat: true, payments: {}, changed: true,
      items: { uid: true, article: { uid: true, name: names, articleNumber: true, url: lang,
        choices: { name: lang, options: {}, description: lang, type: true, uid: true, quantityChoicesAffectsOptionPrices: true, quantity: true },
        deliveryInfo: names, content: true, isBuyable: true, images: true, imagesAltText: true, freeFreight: true, presentationOnly: true,
        sku: true, stock: true, type: true, articlegroup: { name: names }, unit: true, variants: true, price: true, quantityInfo: true },
        choices: true, costs: ['unit', 'total'], articleName: true, articleNumber: true, discountInfo: true, deliveryInfo: names },
      language: true, discountInfo: true };
    if (!(st.order && st.order.uid)) sel.uid = true;
    if (!(st.order && st.order.ordered)) sel.ordered = true;
    return sel;
  }
  function refreshOrder(orderId) {
    var st = store();
    if (!st || !window.twsReduxStore.dispatch) return Promise.resolve();
    return rpc('Order.getCritical', [orderId, orderSelection(st)]).then(function (order) {
      if (order && order.changed !== null) window.twsReduxStore.dispatch({ type: 'SET_ORDER', payload: order });
    }).catch(function (err) { if (window.console) console.warn('[Prydligt garanti] kunde inte uppdatera varukorgen', err); });
  }

  function addToCart(articleNumber, orderId) {
    if (window.prydligtAddArticle) return Promise.resolve(window.prydligtAddArticle(articleNumber, 1));
    return lookupUid(articleNumber)
      .then(function (uid) { return rpc('Order.addArticle', [orderId, uid, { quantity: 1 }, { uid: true }, { fastVerify: true }]); })
      .then(function (r) { return refreshOrder(orderId).then(function () { return r; }); })
      .catch(function (err) { if (window.console) console.warn('[Prydligt garanti] kunde inte l\u00e4gga till', articleNumber, err); });
  }

  var box = null, selected = 0, currentBand = null;

  function build(band) {
    var el = document.createElement('div');
    el.className = 'p-warranty';
    var opts = '<button type="button" class="p-warranty__opt is-selected" data-years="0" aria-pressed="true"><span class="p-warranty__len">' + TXT.none + '</span></button>';
    YEARS.forEach(function (y) {
      opts += '<button type="button" class="p-warranty__opt" data-years="' + y + '" aria-pressed="false">' +
        '<span class="p-warranty__len">' + y + ' ' + (y === 1 ? TXT.year : TXT.yearPl) + '</span>' +
        '<span class="p-warranty__price">' + band.price[y] + ' ' + TXT.kr + '</span></button>';
    });
    el.innerHTML =
      '<div class="p-warranty__head"><span class="p-warranty__title">' + TXT.title + '</span></div>' +
      '<div class="p-warranty__opts" role="group" aria-label="' + TXT.title + '">' + opts + '</div>' +
      '<p class="p-warranty__info">' + TXT.info + ' <a href="' + TXT.moreUrl + '" target="_blank" rel="noopener">' + TXT.more + '</a></p>';
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.p-warranty__opt');
      if (!b) return;
      selected = parseInt(b.getAttribute('data-years'), 10) || 0;
      if (selected) lookupUid(artNo(band, selected)).catch(function (err) { if (window.console) console.warn('[Prydligt garanti]', err); });
      el.querySelectorAll('.p-warranty__opt').forEach(function (o) {
        var on = o === b; o.classList.toggle('is-selected', on); o.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
    return el;
  }

  // Göm längder vars garantiartikel butiken inte hittar, och hela modulen om ingen hittas
  function verify(el, band) {
    el.style.display = 'none';
    var left = YEARS.length, found = 0;
    YEARS.forEach(function (y) {
      lookupUid(artNo(band, y)).then(function () { found++; }, function () {
        var o = el.querySelector('.p-warranty__opt[data-years="' + y + '"]');
        if (o) o.parentNode.removeChild(o);
      }).then(function () {
        if (--left === 0 && found > 0) el.style.display = '';
      });
    });
  }

  function mount() {
    if (!document.body || !document.body.classList.contains('article') || !enabled()) return;
    var price = productPrice(), band = price && bandFor(price);
    var anchor = document.querySelector('.slot--unique-selling-points');
    if (!band || !anchor || !isWatch()) { if (box && box.parentNode) box.parentNode.removeChild(box); return; }
    if (!box || currentBand !== band) {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      box = build(band); currentBand = band; selected = 0;
      verify(box, band);
    }
    if (box.nextElementSibling !== anchor) anchor.insertAdjacentElement('beforebegin', box);
  }

  // När kunden trycker Köp med en garanti vald:
  // finns redan en varukorg läggs garantin till först (så att Abicarts egen uppdatering visar båda),
  // annars läggs klockan till först och garantin direkt efter att varukorgen skapats.
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.slot--article-buy-button .tws-article-buy-button-with-modal--buy-button');
    if (!btn || btn.__pBypass || !selected || !currentBand || !enabled()) return;
    var a = artNo(currentBand, selected);
    var existing = orderUid();
    var pass = function () { btn.__pBypass = true; btn.click(); setTimeout(function () { btn.__pBypass = false; }, 0); };
    if (existing) {
      e.preventDefault(); e.stopImmediatePropagation();
      var done = false, go = function () { if (!done) { done = true; pass(); } };
      setTimeout(go, 3000);                       // köpet av klockan får aldrig vänta längre än 3 s
      addToCart(a, existing).then(go, go);
    } else {
      waitForOrder(8000).then(function (u) { if (u) addToCart(a, u); });
    }
  }, true);

  function start() { mount(); setInterval(mount, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.prydligtWarranty = { bands: BANDS, artNo: artNo, selected: function () { return selected; } };
})();

/*!
 * Prydligt – butikens logga i sidfoten (kopieras från sidhuvudet, så att rätt logga visas på varje marknad)
 */
(function () {
  'use strict';
  function addFooterLogo() {
    var footer = document.querySelector('.brew--footer > .container, .brew--footer .container');
    if (!footer || footer.querySelector('.p-footer-logo')) return;
    var img = document.querySelector('.slot--sidebar-logo .tws-logo img, .slot--header-logo .tws-logo img, a.tws-logo img');
    if (!img || !img.currentSrc && !img.src) return;
    var a = document.createElement('a');
    a.className = 'p-footer-logo';
    a.href = '/';
    var logo = document.createElement('img');
    logo.src = img.currentSrc || img.src;
    logo.alt = img.alt || 'Prydligt';
    logo.loading = 'lazy';
    a.appendChild(logo);
    footer.insertBefore(a, footer.firstChild);
  }
  function start() { addFooterLogo(); setInterval(addFooterLogo, 2000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ===================================================================
   5. NYHETSBREVS-POPUP: visa först efter en stund
   Abicart visar popupen direkt. CSS:en döljer den tills <html> får
   klassen p-nl-ok, vilket sker när besökaren varit på sajten i
   NL_DELAY ms (räknas över sidbyten), inte står i kassan och
   cookie-rutan är borta. Lämnar besökaren innan dess har popupen
   aldrig setts, och Abicart visar den igen vid nästa besök.
   =================================================================== */
(function () {
  var NL_DELAY = 20000;
  var KEY = 'pNlStart';
  var t0 = Date.now();
  try {
    var s = +sessionStorage.getItem(KEY);
    if (s) t0 = s; else sessionStorage.setItem(KEY, String(t0));
  } catch (e) {}
  var root = document.documentElement;

  function cookieBarVisible() {
    var els = document.querySelectorAll('[class*="cookie" i]');
    for (var i = 0; i < els.length; i++) {
      var cs = getComputedStyle(els[i]);
      if ((cs.position === 'fixed' || cs.position === 'sticky') &&
          els[i].offsetHeight > 40 && cs.display !== 'none' && cs.visibility !== 'hidden') return true;
    }
    return false;
  }
  function fixPlaceholder() {
    var f = document.querySelectorAll('.tws-newsletter-subscribe--form-wrapper input[type="email"]');
    for (var i = 0; i < f.length; i++) {
      if (f[i].placeholder === 'Din epostadress') f[i].placeholder = 'Din e-postadress';
    }
  }
  function tick() {
    fixPlaceholder();
    if (root.classList.contains('p-nl-ok')) {
      if (document.body.classList.contains('checkout')) root.classList.remove('p-nl-ok');
      return;
    }
    if (Date.now() - t0 < NL_DELAY) return;
    if (document.body.classList.contains('checkout')) return;
    if (cookieBarVisible()) return;
    root.classList.add('p-nl-ok');
  }
  function start() { tick(); setInterval(tick, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ===================================================================
   6. USP-PUNKTER P\u00c5 PRODUKTSIDAN: ikon + klickbar f\u00f6rklaring
   Punkterna skrivs i temaeditorn (Produktsida -> Unique Selling Points).
   H\u00e4r kopplas varje punkt till en ikon och en kort text som f\u00e4lls ut.
   =================================================================== */
(function () {
  var TP = 'https://www.trustpilot.com/review/prydligt.se';
  var TXT = {
    sv: {
      ship: 'Vi packar och skickar fr\u00e5n v\u00e5rt eget lager i V\u00e4nersborg. Snabbt, utan mellanh\u00e4nder.',
      cust: '\u00d6ver 450 000 kunder har handlat hos oss. Se vad de tycker p\u00e5 Trustpilot.',
      custLink: 'L\u00e4s omd\u00f6men', custUrl: 'https://se.trustpilot.com/review/prydligt.se',
      warr: 'G\u00e5r n\u00e5got s\u00f6nder vid normal anv\u00e4ndning reparerar vi det eller skickar en ny, utan kostnad. Till klockor kan du l\u00e4gga till f\u00f6rl\u00e4ngd garanti med fritt batteribyte.',
      warrLink: 'L\u00e4s mer', warrUrl: '/forlangd-garanti'
    },
    da: {
      ship: 'Vi pakker og sender fra vores eget lager i V\u00e4nersborg i Sverige. Ingen told inden for EU.',
      cust: 'Over 450.000 kunder har handlet hos os. Se hvad de siger p\u00e5 Trustpilot.',
      custLink: 'L\u00e6s anmeldelser', custUrl: 'https://dk.trustpilot.com/review/prydligt.se',
      warr: 'G\u00e5r noget i stykker ved normal brug, reparerer vi det eller sender et nyt, uden beregning.'
    },
    de: {
      ship: 'Wir packen und versenden aus unserem eigenen Lager in V\u00e4nersborg, Schweden. Kein Zoll innerhalb der EU.',
      cust: '\u00dcber 450.000 Kunden haben bei uns eingekauft. Lies ihre Bewertungen auf Trustpilot.',
      custLink: 'Bewertungen lesen', custUrl: 'https://de.trustpilot.com/review/prydligt.se',
      warr: 'Geht bei normalem Gebrauch etwas kaputt, reparieren wir es oder schicken dir ein neues, kostenlos.'
    },
    en: {
      ship: 'We pack and ship from our own warehouse in V\u00e4nersborg, Sweden.',
      cust: 'Over 450,000 customers have shopped with us. See what they say on Trustpilot.',
      custLink: 'Read reviews', custUrl: TP,
      warr: 'If something breaks with normal use, we repair it or send you a new one, free of charge.'
    },
    fi: {
      ship: 'Pakkaamme ja l\u00e4het\u00e4mme omasta varastostamme V\u00e4nersborgista, Ruotsista. Ei tulleja EU:n sis\u00e4ll\u00e4.',
      cust: 'Yli 450 000 asiakasta on ostanut meilt\u00e4. Katso mit\u00e4 he sanovat Trustpilotissa.',
      custLink: 'Lue arvostelut', custUrl: TP,
      warr: 'Jos jokin hajoaa normaalik\u00e4yt\u00f6ss\u00e4, korjaamme sen tai l\u00e4het\u00e4mme uuden veloituksetta.'
    },
    nb: {
      ship: 'Vi pakker og sender fra v\u00e5rt eget lager i V\u00e4nersborg i Sverige. Vi er registrert i VOEC, s\u00e5 du betaler ingen toll eller gebyrer ved levering.',
      cust: 'Over 450 000 kunder har handlet hos oss. Se hva de sier p\u00e5 Trustpilot.',
      custLink: 'Les anmeldelser', custUrl: 'https://no.trustpilot.com/review/prydligt.se',
      warr: 'G\u00e5r noe i stykker ved normal bruk, reparerer vi det eller sender et nytt, uten kostnad.'
    },
    nl: {
      ship: 'We pakken en verzenden vanuit ons eigen magazijn in V\u00e4nersborg, Zweden. Geen douanekosten binnen de EU.',
      cust: 'Meer dan 450.000 klanten kochten al bij ons. Lees hun reviews op Trustpilot.',
      custLink: 'Reviews lezen', custUrl: 'https://nl.trustpilot.com/review/prydligt.se',
      warr: 'Gaat er bij normaal gebruik iets kapot, dan repareren we het of sturen we een nieuw exemplaar, gratis.'
    }
  };
  TXT.no = TXT.nb;

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    return TXT[l] ? l : 'sv';
  }
  function kind(text) {
    if (/450/.test(text)) return 'cust';
    if (/Sverige|Sweden|Schweden|Ruotsi|Zweden/i.test(text)) return 'ship';
    if (/garanti|warranty|takuu/i.test(text)) return 'warr';
    return null;
  }
  function link(href, label) {
    var a = document.createElement('a');
    a.href = href; a.textContent = label;
    if (/^https?:/.test(href)) { a.target = '_blank'; a.rel = 'noopener'; }
    a.addEventListener('click', function (e) { e.stopPropagation(); });
    return a;
  }
  function enhance() {
    var items = document.querySelectorAll('.slot--unique-selling-points li');
    if (!items.length) return;
    var t = TXT[lang()];
    for (var i = 0; i < items.length; i++) {
      var li = items[i];
      if (li.querySelector('.p-usp__more')) continue;
      var span = li.querySelector('.tws-unique-selling-points--text');
      var k = kind((span || li).textContent);
      if (!k) continue;
      li.classList.add('p-usp', 'p-usp--' + k);
      var more = document.createElement('div');
      more.className = 'p-usp__more';
      more.id = 'p-usp-' + k;
      more.appendChild(document.createTextNode(t[k] + ' '));
      if (k === 'cust' && t.custUrl) more.appendChild(link(t.custUrl, t.custLink));
      if (k === 'warr' && t.warrUrl) more.appendChild(link(t.warrUrl, t.warrLink));
      li.appendChild(more);
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.setAttribute('aria-expanded', 'false');
      li.setAttribute('aria-controls', more.id);
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle.call(this); }
      });
    }
  }
  function toggle() {
    var open = this.classList.toggle('p-usp--open');
    this.setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  function start() { enhance(); setInterval(enhance, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ===================================================================
   7. KASSAN: trygghetsrad + vanliga fr\u00e5gor under betalningen
   L\u00e4ggs direkt efter betalrutan (Klarna/Kustom), dvs under knappen
   "Slutf\u00f6r k\u00f6p". Texterna per spr\u00e5k nedan.
   =================================================================== */
(function () {
  var MAIL = 'support@prydligt.se';
  var RETURN_URL = 'https://myreturns.postnord.com/Prydligt001';   // svensk returportal
  var RETURN_LABEL = 'v\u00e5r returportal';
  var T = {
    sv: {
      icons: ['Skickas fr\u00e5n Sverige', '99 dagars \u00f6ppet k\u00f6p', '1 \u00e5rs garanti'],
      head: 'Beh\u00f6ver du mer information?',
      faq: [
        ['N\u00e4r f\u00e5r jag min order?', 'Best\u00e4ller du f\u00f6re kl. 16 en vardag skickar vi samma dag med PostNord. Leveransen tar 1\u20132 arbetsdagar och frakten \u00e4r fri \u00f6ver 600 kr.'],
        ['Hur returnerar jag?', 'Du har 99 dagars \u00f6ppet k\u00f6p. Registrera returen i {ret}: fyll i dina orderuppgifter s\u00e5 f\u00e5r du en QR-kod som du visar hos ombudet f\u00f6r att f\u00e5 en retursedel. Vi betalar tillbaka pengarna n\u00e4r vi f\u00e5tt varan.'],
        ['Vilken garanti ing\u00e5r?', 'Alla produkter har 1 \u00e5rs garanti mot fabrikations- och materialfel. Dessutom har du alltid tre \u00e5rs reklamationsr\u00e4tt enligt konsumentk\u00f6plagen. Till klockor kan du l\u00e4gga till f\u00f6rl\u00e4ngd garanti.'],
        ['Hur kan jag betala?', 'Du betalar tryggt med kort, Swish, Apple Pay, Google Pay eller Klarna (faktura och delbetalning). Vi f\u00e5r aldrig se dina kortuppgifter.']
      ]
    },
    da: {
      icons: ['Sendes fra Sverige', '99 dages fuld returret', '1 \u00e5rs garanti'],
      head: 'Har du brug for mere information?',
      faq: [
        ['Hvorn\u00e5r f\u00e5r jeg min ordre?', 'Bestiller du inden kl. 16 (svensk tid) p\u00e5 en hverdag, sender vi samme dag med PostNord. Levering tager 2\u20134 hverdage, og fragten er gratis over 600 kr. Ingen told inden for EU.'],
        ['Hvordan returnerer jeg?', 'Du har 99 dages fuld returret. Skriv til {mail} med dit ordrenummer, s\u00e5 hj\u00e6lper vi dig med returneringen.'],
        ['Hvilken garanti er inkluderet?', 'Alle produkter har 1 \u00e5rs garanti mod fabrikations- og materialefejl. Det p\u00e5virker ikke din lovpligtige reklamationsret.'],
        ['Hvordan kan jeg betale?', 'Du betaler trygt med kort, MobilePay eller Klarna. Vi ser aldrig dine kortoplysninger.']
      ]
    },
    nb: {
      icons: ['Sendes fra Sverige', '99 dagers \u00e5pent kj\u00f8p', 'Ingen toll eller gebyrer'],
      head: 'Trenger du mer informasjon?',
      faq: [
        ['M\u00e5 jeg betale toll?', 'Nei. Vi er registrert i VOEC, s\u00e5 mva. er inkludert i prisen og du betaler ingen toll eller gebyrer ved levering.'],
        ['N\u00e5r f\u00e5r jeg ordren min?', 'Bestiller du f\u00f8r kl. 16 (svensk tid) p\u00e5 en hverdag, sender vi samme dag med PostNord. Leveringen tar 2\u20134 virkedager, og frakten er gratis over 800 kr.'],
        ['Hvordan returnerer jeg?', 'Du har 99 dagers \u00e5pent kj\u00f8p. Send en e-post til {mail} med ordrenummeret ditt, s\u00e5 hjelper vi deg med returen.'],
        ['Hvilken garanti er inkludert?', 'Alle produkter har 1 \u00e5rs garanti mot produksjons- og materialfeil. Det p\u00e5virker ikke reklamasjonsretten din etter loven.'],
        ['Hvordan kan jeg betale?', 'Du betaler trygt med kort, Vipps eller Klarna. Vi ser aldri kortopplysningene dine.']
      ]
    },
    fi: {
      icons: ['L\u00e4hetet\u00e4\u00e4n Ruotsista', '99 p\u00e4iv\u00e4n palautusoikeus', '1 vuoden takuu'],
      head: 'Tarvitsetko lis\u00e4tietoja?',
      faq: [
        ['Milloin saan tilaukseni?', 'Kun tilaat arkip\u00e4iv\u00e4n\u00e4 ennen klo 16 (Ruotsin aikaa), l\u00e4het\u00e4mme saman p\u00e4iv\u00e4n aikana PostNordilla. Toimitus kest\u00e4\u00e4 2\u20134 arkip\u00e4iv\u00e4\u00e4, ja yli 80 \u20ac:n tilaukset toimitetaan ilmaiseksi. Ei tulleja EU:n sis\u00e4ll\u00e4.'],
        ['Miten palautan tuotteen?', 'Sinulla on 99 p\u00e4iv\u00e4n palautusoikeus. L\u00e4het\u00e4 tilausnumerosi osoitteeseen {mail}, niin autamme palautuksessa.'],
        ['Mik\u00e4 takuu tuotteilla on?', 'Kaikilla tuotteilla on 1 vuoden takuu valmistus- ja materiaalivirheiden varalta. Se ei vaikuta lakis\u00e4\u00e4teisiin oikeuksiisi.'],
        ['Miten voin maksaa?', 'Maksat turvallisesti kortilla, MobilePaylla, verkkopankissa tai Klarnalla. Emme koskaan n\u00e4e korttitietojasi.']
      ]
    },
    de: {
      icons: ['Versand aus Schweden', '99 Tage R\u00fcckgaberecht', '1 Jahr Garantie'],
      head: 'Brauchst du mehr Informationen?',
      faq: [
        ['Wann kommt meine Bestellung?', 'Bestellst du werktags vor 16 Uhr, versenden wir noch am selben Tag mit PostNord. Die Lieferung dauert 2\u20134 Werktage, ab 80 \u20ac ist der Versand kostenlos. Kein Zoll innerhalb der EU.'],
        ['Wie funktioniert die R\u00fccksendung?', 'Du hast 99 Tage R\u00fcckgaberecht. Schreib uns mit deiner Bestellnummer an {mail}, dann helfen wir dir weiter.'],
        ['Welche Garantie ist enthalten?', 'Alle Produkte haben 1 Jahr Garantie auf Herstellungs- und Materialfehler. Deine gesetzlichen Gew\u00e4hrleistungsrechte bleiben davon unber\u00fchrt.'],
        ['Wie kann ich bezahlen?', 'Du bezahlst sicher mit Karte, PayPal, auf Rechnung oder mit Klarna. Wir sehen deine Kartendaten nie.']
      ]
    },
    nl: {
      icons: ['Verzonden vanuit Zweden', '99 dagen bedenktijd', '1 jaar garantie'],
      head: 'Meer informatie nodig?',
      faq: [
        ['Wanneer krijg ik mijn bestelling?', 'Bestel je op een werkdag v\u00f3\u00f3r 16.00 uur, dan versturen we dezelfde dag met PostNord. Levering duurt 2\u20134 werkdagen en vanaf 80 \u20ac is de verzending gratis. Geen douanekosten binnen de EU.'],
        ['Hoe stuur ik iets terug?', 'Je hebt 99 dagen bedenktijd. Mail je ordernummer naar {mail} en we helpen je met de retour.'],
        ['Welke garantie krijg ik?', 'Alle producten hebben 1 jaar garantie op fabricage- en materiaalfouten. Dit doet niets af aan je wettelijke rechten.'],
        ['Hoe kan ik betalen?', 'Je betaalt veilig met iDEAL, kaart of Klarna. Wij zien je kaartgegevens nooit.']
      ]
    },
    en: {
      icons: ['Shipped from Sweden', '99-day returns', '1-year warranty'],
      head: 'Need more information?',
      faq: [
        ['When will my order arrive?', 'Order before 4 pm (Swedish time) on a weekday and we ship the same day with PostNord. Delivery takes 2\u20134 working days.'],
        ['How do I return something?', 'You have 99 days to return. Email {mail} with your order number and we will help you.'],
        ['What warranty is included?', 'All products have a 1-year warranty against manufacturing and material defects. Your statutory rights are not affected.'],
        ['How can I pay?', 'You pay securely by card or Klarna. We never see your card details.']
      ]
    }
  };
  T.no = T.nb;

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    return T[l] ? l : 'sv';
  }
  var ICON = ['ship', 'ret', 'warr'];

  function build() {
    var l = lang(), t = T[l];
    var box = document.createElement('section');
    box.className = 'p-trust';
    var row = document.createElement('div');
    row.className = 'p-trust__icons';
    for (var i = 0; i < 3; i++) {
      var it = document.createElement('div');
      var key = (i === 2 && (l === 'nb' || l === 'no')) ? 'info' : ICON[i];
      it.className = 'p-trust__icon p-trust__icon--' + key;
      it.appendChild(document.createElement('span'));
      it.appendChild(document.createTextNode(t.icons[i]));
      row.appendChild(it);
    }
    box.appendChild(row);
    var h = document.createElement('h3');
    h.className = 'p-trust__head';
    h.textContent = t.head;
    box.appendChild(h);
    for (var j = 0; j < t.faq.length; j++) {
      var d = document.createElement('details');
      d.className = 'p-trust__faq';
      var s = document.createElement('summary');
      s.textContent = t.faq[j][0];
      var p = document.createElement('p');
      var parts = t.faq[j][1].split(/(\{mail\}|\{ret\})/);
      for (var q = 0; q < parts.length; q++) {
        if (parts[q] === '{mail}' || parts[q] === '{ret}') {
          var a = document.createElement('a');
          if (parts[q] === '{mail}') { a.href = 'mailto:' + MAIL; a.textContent = MAIL; }
          else { a.href = RETURN_URL; a.textContent = RETURN_LABEL; a.target = '_blank'; a.rel = 'noopener'; }
          p.appendChild(a);
        } else if (parts[q]) {
          p.appendChild(document.createTextNode(parts[q]));
        }
      }
      d.appendChild(s); d.appendChild(p);
      box.appendChild(d);
    }
    return box;
  }
  function mount() {
    if (!document.body.classList.contains('checkout')) return;
    var slot = document.querySelector('.opc-checkout--checkout-method .slot--checkout');
    if (!slot || !slot.parentElement) return;
    var next = slot.nextElementSibling;
    if (next && next.classList.contains('p-trust')) return;
    var old = document.querySelector('.p-trust');
    if (old) old.parentElement.removeChild(old);
    slot.parentElement.insertBefore(build(), slot.nextSibling);
  }
  function start() { mount(); setInterval(mount, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
