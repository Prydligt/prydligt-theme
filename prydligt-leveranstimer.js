/*!
 * Prydligt – leveransnedräkning på produktsidan
 * "Beställ inom 2 h 34 min 12 s – skickas idag"
 *
 * Räknar alltid i svensk tid (Europe/Stockholm), oavsett var kunden befinner sig.
 * Skickdagar: måndag–fredag, ej svenska helgdagar eller aftnar (se INSTÄLLNINGAR).
 * Visas bara när produkten finns i lager.
 */

/* Gräns för fri frakt per marknad (sidans språk). ÄNDRA BARA HÄR – och samtidigt i Abicarts fraktinställningar,
   annars visar mätare, korsförsäljning och kassans fyllare fel belopp. */
window.PRYDLIGT_FREE = { sv: 600, nb: 700, no: 700, da: 449, fi: 59, de: 59, nl: 59 };

/* Bildstorlek: Abicarts CDN skalar om bilder via ?max-width=…&fmt=webp.
   Originalen är 0,5–2 MB; en rund färgbild på 52 px behöver ~2 kB. Använd alltid denna. */
window.prydligtImg = function (u, w, q) {
  u = String(u || '');
  if (!/cdn\.abicart\.com/.test(u)) return u;
  return u.split('?')[0] + '?max-width=' + w + '&max-height=' + w + '&quality=' + (q || 80) + '&fmt=webp';
};

/* En gemensam klocka för alla avsnitt i stället för 12 egna setInterval.
   Pausar när fliken inte syns (sparar batteri/processor) och kör allt direkt när kunden kommer tillbaka. */
(function () {
  var jobs = [], timer = null;
  function run(force) {
    if (document.hidden) return;
    var now = Date.now();
    for (var i = 0; i < jobs.length; i++) {
      var j = jobs[i];
      if (force || now - j.last >= j.ms - 250) { j.last = now; try { j.fn(); } catch (e) {} }
    }
  }
  window.prydligtEvery = function (fn, ms) {
    jobs.push({ fn: fn, ms: ms, last: Date.now() });
    if (!timer) timer = setInterval(run, 500);
  };
  document.addEventListener('visibilitychange', function () { if (!document.hidden) run(true); });
})();

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
    sv: { days: [1, 2], free: window.PRYDLIGT_FREE.sv, cur: 'kr',  fmt: function (n) { return n + ' kr'; } },
    nb: { days: [2, 4], free: window.PRYDLIGT_FREE.nb, cur: 'kr',  fmt: function (n) { return n + ' kr'; } },
    da: { days: [2, 4], free: window.PRYDLIGT_FREE.da, cur: 'kr',  fmt: function (n) { return n + ' kr'; } },
    fi: { days: [2, 4], free: window.PRYDLIGT_FREE.fi, cur: 'EUR', fmt: function (n) { return n + ' €'; } },
    de: { days: [2, 4], free: window.PRYDLIGT_FREE.de, cur: 'EUR', fmt: function (n) { return n + ' €'; } },
    nl: { days: [2, 4], free: window.PRYDLIGT_FREE.nl, cur: 'EUR', fmt: function (n) { return '€ ' + n; } }
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

  function supported() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    if (l === 'no' || l === 'nn') l = 'nb';
    return !!TEXT[l];   // en/fr/pl/es/it/pt: inga leveransuppgifter än -> visa inget hellre än fel
  }
  function mount() {
    if (!document.body || !document.body.classList.contains('article')) return;
    if (!supported()) return;
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
    if (!supported()) return;
    // Abicart har två sammanfattningar (mobil och dator) – använd den som syns
    var slots = document.querySelectorAll('.slot--checkout-cart-summary'), anchor = null;
    for (var i = 0; i < slots.length; i++) { if (slots[i].offsetParent !== null) { anchor = slots[i]; break; } }
    if (!anchor) anchor = slots[0];
    if (!anchor) return;
    if (!cartEl) { cartEl = document.createElement('div'); cartEl.className = 'p-cart-free'; }
    if (anchor.firstElementChild !== cartEl) anchor.insertBefore(cartEl, anchor.firstChild);
    var l = lang(), b = BOX[l], m = MARKET[l], left = freeShippingLeft(m);
    // I kassan: ingen mätare och inget "X kr kvar" (lockar bort kunden från kassan).
    // Fri frakt visas som en bock-rad när gränsen är nådd; leveransdatumet visas alltid.
    cartEl.classList.toggle('p-cart-free--ok', left <= 0);
    var html = (left > 0 ? '' : '<div class="p-ship__free p-ship__free--ok"><span>' + b.reached + '</span></div>') +
      '<p class="p-ship__when">' + deliveryText(l, TEXT[l], b, m, state()) + '</p>';
    if (cartEl.__last !== html) { cartEl.innerHTML = html; cartEl.__last = html; }
  }

  function start() {
    mount(); mountCart();
    window.prydligtEvery(function () { mount(); mountCart(); }, 1000);   // uppdaterar sekunderna och klarar att Abicart byter sidinnehåll
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
    nl: { minus: 'Aantal verlagen', plus: 'Aantal verhogen', remove: 'Verwijderen' },
    en: { minus: 'Decrease quantity', plus: 'Increase quantity', remove: 'Remove' },
    fr: { minus: 'Diminuer la quantité', plus: 'Augmenter la quantité', remove: 'Supprimer' },
    pl: { minus: 'Zmniejsz ilość', plus: 'Zwiększ ilość', remove: 'Usuń' },
    es: { minus: 'Reducir cantidad', plus: 'Aumentar cantidad', remove: 'Eliminar' },
    it: { minus: 'Diminuisci quantità', plus: 'Aumenta quantità', remove: 'Rimuovi' },
    pt: { minus: 'Diminuir quantidade', plus: 'Aumentar quantidade', remove: 'Remover' }
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
  // Prisnivåer efter produktens pris (kr). Priser = andel av nivåns mittpunkt:
  // 1 år 15 %, 2 år 27 %, 3 år 35 %, 5 år 50 % (ca 10/22/33 % billigare per år än 1 år).
  var BANDS = [
    { from: 200 , to: 299 , id: 'A', price: { 1: 38, 2: 68, 3: 88, 5: 125 } },
    { from: 300 , to: 449 , id: 'B', price: { 1: 56, 2: 101, 3: 131, 5: 188 } },
    { from: 450 , to: 599 , id: 'C', price: { 1: 79, 2: 142, 3: 184, 5: 262 } },
    { from: 600 , to: 799 , id: 'D', price: { 1: 105, 2: 189, 3: 245, 5: 350 } },
    { from: 800 , to: 999 , id: 'E', price: { 1: 135, 2: 243, 3: 315, 5: 450 } },
    { from: 1000, to: 1499, id: 'F', price: { 1: 188, 2: 338, 3: 438, 5: 625 } },
    { from: 1500, to: 2499, id: 'G', price: { 1: 300, 2: 540, 3: 700, 5: 1000 } },
    { from: 2500, to: 3999, id: 'H', price: { 1: 488, 2: 878, 3: 1138, 5: 1625 } }
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
    info: 'Kostnadsfri reparation eller ny klocka vid fabrikations- eller materialfel, och fri frakt \u2013 under hela garantitiden.',
    infoBtn: 'Vad ing\u00e5r?',
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

  // Används av fri frakt-fyllaren i kassan (avsnitt 14)
  window.prydligtAddToOrder = function (articleNumber) {
    var u = orderUid();
    return u ? lookupUid(articleNumber).then(function (uid) { return rpc('Order.addArticle', [u, uid, { quantity: 1 }, { uid: true }, { fastVerify: true }]); })
      .then(function () { return refreshOrder(u); }) : Promise.reject(new Error('ingen order'));
  };
  function addToCart(articleNumber, orderId) {
    if (window.prydligtAddArticle) return Promise.resolve(window.prydligtAddArticle(articleNumber, 1));
    return lookupUid(articleNumber)
      .then(function (uid) { return rpc('Order.addArticle', [orderId, uid, { quantity: 1 }, { uid: true }, { fastVerify: true }]); })
      .then(function (r) { return refreshOrder(orderId).then(function () { return r; }); })
      .catch(function (err) { if (window.console) console.warn('[Prydligt garanti] kunde inte l\u00e4gga till', articleNumber, err); });
  }


  /* --- Popup "Vad ing\u00e5r?" \u2013 j\u00e4mf\u00f6relse, pris per \u00e5r, s\u00e5 g\u00f6r du, undantag --- */
  var INFO = {
    title: 'F\u00f6rl\u00e4ngd garanti',
    lead: 'Samma skydd som v\u00e5r vanliga garanti \u2013 men l\u00e4ngre. G\u00e5r klockan s\u00f6nder av ett fabrikations- eller materialfel reparerar vi den eller skickar en ny, utan kostnad.',
    colStd: 'Standard (1 \u00e5r)', colExt: 'F\u00f6rl\u00e4ngd garanti',
    rows: [
      ['Fabrikations- och materialfel', 1, 1],
      ['Urverk som stannar eller g\u00e5r fel', 1, 1],
      ['Krona, knappar eller delar som lossnar utan yttre p\u00e5verkan', 1, 1],
      ['Reparation eller ny klocka utan kostnad', 1, 1],
      ['Fri frakt till och fr\u00e5n oss vid reparation', 1, 1],
      ['Skyddstid fr\u00e5n leverans', '1 \u00e5r', '2\u20136 \u00e5r']
    ],
    perYear: '/ \u00e5r', save: 'Spara', choose: 'V\u00e4lj',
    howTitle: 'Om n\u00e5got h\u00e4nder',
    how: ['Mejla support@prydligt.se med ordernummer och en bild eller film p\u00e5 felet.',
          'Vi skickar en fraktsedel \u2013 frakten st\u00e5r vi f\u00f6r.',
          'Vi reparerar klockan eller skickar en ny likv\u00e4rdig.'],
    notTitle: 'Det h\u00e4r ing\u00e5r inte',
    not: ['Olyckor, t.ex. tapp, slag, st\u00f6tar eller krossat glas',
          'Vattenskador n\u00e4r klockan anv\u00e4nts djupare \u00e4n vattent\u00e4theten anger',
          'Normalt slitage: repor, pl\u00e4tering, armband och batteri',
          'F\u00f6rlust och st\u00f6ld',
          'Klockor som \u00f6ppnats eller reparerats av n\u00e5gon annan \u00e4n oss'],
    terms: 'Fullst\u00e4ndiga villkor', close: 'St\u00e4ng'
  };
  var dlg = null, lastFocus = null;
  function closeInfo() {
    if (!dlg) return;
    dlg.parentNode && dlg.parentNode.removeChild(dlg); dlg = null;
    document.documentElement.classList.remove('p-wdlg-open');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openInfo(band, moduleEl) {
    closeInfo();
    lastFocus = document.activeElement;
    var mark = function (v) { return v === 1 ? '<span class="p-wdlg__yes" aria-label="Ja">\u2713</span>' : (v ? v : '<span class="p-wdlg__no" aria-label="Nej">\u2013</span>'); };
    var rows = INFO.rows.map(function (r) { return '<tr><th scope="row">' + r[0] + '</th><td>' + mark(r[1]) + '</td><td>' + mark(r[2]) + '</td></tr>'; }).join('');
    var base = band.price[1];
    var cards = YEARS.map(function (y) {
      var p = band.price[y], py = Math.round(p / y), sv = Math.round((1 - p / (base * y)) * 100);
      return '<button type="button" class="p-wdlg__card" data-years="' + y + '">' +
        '<span class="p-wdlg__len">+' + y + ' ' + TXT.year + '</span>' +
        '<span class="p-wdlg__py">' + py + ' kr ' + INFO.perYear + '</span>' +
        (sv > 0 ? '<span class="p-wdlg__save">' + INFO.save + ' ' + sv + ' %</span>' : '<span class="p-wdlg__save p-wdlg__save--none">&nbsp;</span>') +
        '<span class="p-wdlg__total">' + p + ' kr</span>' +
        '<span class="p-wdlg__choose">' + INFO.choose + '</span></button>';
    }).join('');
    dlg = document.createElement('div');
    dlg.className = 'p-wdlg';
    dlg.innerHTML =
      '<div class="p-wdlg__backdrop"></div>' +
      '<div class="p-wdlg__box" role="dialog" aria-modal="true" aria-labelledby="p-wdlg-title" tabindex="-1">' +
        '<button type="button" class="p-wdlg__x" aria-label="' + INFO.close + '">\u00d7</button>' +
        '<h2 id="p-wdlg-title" class="p-wdlg__title">' + INFO.title + '</h2>' +
        '<p class="p-wdlg__lead">' + INFO.lead + '</p>' +
        '<table class="p-wdlg__table"><thead><tr><th></th><th scope="col">' + INFO.colStd + '</th><th scope="col">' + INFO.colExt + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
        '<div class="p-wdlg__cards">' + cards + '</div>' +
        '<h3 class="p-wdlg__h3">' + INFO.howTitle + '</h3><ol class="p-wdlg__steps">' + INFO.how.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ol>' +
        '<h3 class="p-wdlg__h3">' + INFO.notTitle + '</h3><ul class="p-wdlg__not">' + INFO.not.map(function (t) { return '<li>' + t + '</li>'; }).join('') + '</ul>' +
        '<p class="p-wdlg__terms"><a href="' + TXT.moreUrl + '" target="_blank" rel="noopener">' + INFO.terms + '</a></p>' +
      '</div>';
    dlg.addEventListener('click', function (e) {
      if (e.target.closest('.p-wdlg__x') || e.target.classList.contains('p-wdlg__backdrop')) { closeInfo(); return; }
      var c = e.target.closest('.p-wdlg__card');
      if (c) {
        var opt = moduleEl.querySelector('.p-warranty__opt[data-years="' + c.getAttribute('data-years') + '"]');
        if (opt) opt.click();
        closeInfo();
      }
    });
    document.body.appendChild(dlg);
    document.documentElement.classList.add('p-wdlg-open');
    dlg.querySelector('.p-wdlg__box').focus();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeInfo(); });

  var box = null, selected = 0, currentBand = null;

  function build(band) {
    var el = document.createElement('div');
    el.className = 'p-warranty';
    var opts = '<button type="button" class="p-warranty__opt is-selected" data-years="0" aria-pressed="true"><span class="p-warranty__len">' + TXT.none + '</span><span class="p-warranty__total">1 \u00e5r ing\u00e5r</span></button>';
    YEARS.forEach(function (y) {
      opts += '<button type="button" class="p-warranty__opt" data-years="' + y + '" aria-pressed="false">' +
        '<span class="p-warranty__len">+' + y + ' ' + (y === 1 ? TXT.year : TXT.yearPl) + '</span>' +
        '<span class="p-warranty__price">' + band.price[y] + ' ' + TXT.kr + '</span>' +
        (function () { var sv = Math.round((1 - band.price[y] / (band.price[1] * y)) * 100);
          return y > 1 && sv > 0 ? '<span class="p-warranty__save">Spara ' + sv + ' %</span>' : ''; })() +
        '</button>';
    });
    el.innerHTML =
      '<div class="p-warranty__head"><span class="p-warranty__title">' + TXT.title + '</span>' +
        '<button type="button" class="p-warranty__infobtn" aria-haspopup="dialog">' + TXT.infoBtn + '</button></div>' +
      '<div class="p-warranty__opts" role="group" aria-label="' + TXT.title + '">' + opts + '</div>' +
      '<p class="p-warranty__info">' + TXT.info + ' <a href="' + TXT.moreUrl + '" target="_blank" rel="noopener">' + TXT.more + '</a></p>';
    el.addEventListener('click', function (e) {
      if (e.target.closest('.p-warranty__infobtn') || e.target.closest('.p-warranty__info a')) {
        e.preventDefault(); openInfo(band, el); return;
      }
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
  // Spärr: medan en garanti läggs till ignoreras fler klick på Köp. Annars lade varje extra klick
  // (kunden tryckte igen när inget verkade hända) till en garanti till, medan Abicart bara lade
  // till klockan en gång – t.ex. 1 klocka + 3 garantier.
  /* --- Mätning: ett GA4-event (via GTM:s dataLayer) per tillägg som faktiskt lagts i varukorgen --- */
  function trackAddon(nr) {
    try {
      var u = String(nr).toUpperCase();
      var type = /^GARANTI/.test(u) ? 'garanti' : /^TOOL/.test(u) ? 'verktyg' : /^Y-/.test(u) ? 'herrarmband' : /^K-/.test(u) ? 'smycke' : /^(KOM|NIB|LOR|G|BA|BB|E|MF|A)-/.test(u) ? 'klocka' : 'ovrigt';
      var meta = (window.prydligtAddonMeta && window.prydligtAddonMeta[u]) || {};
      var st = store(), cur = (st && st.currency) || 'SEK';
      var bc = document.querySelector('.tws-breadcrumbs');
      var page = /smycken|smykker|korut|schmuck|sieraden|jewel|bijoux/i.test(bc ? bc.textContent : '') ? 'smycke' : 'klocka';
      var main = (function () { var a = st && st.route && st.route.params && st.articles && st.articles[st.route.params.article]; return a ? String(a.articleNumber || '') : ''; })();
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({
        event: 'addon_added',
        addon_type: type, addon_sku: nr, addon_value: meta.price != null ? meta.price : null,
        addon_currency: cur, addon_source: meta.source || (type === 'garanti' ? 'garanti' : ''),
        addon_position: meta.position || null,
        addon_page: page, main_sku: main
      });
    } catch (e) {}
  }

  var adding = false;
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.slot--article-buy-button .tws-article-buy-button-with-modal--buy-button');
    if (!btn || btn.__pBypass) return;
    // Allt som ska läggas till ihop med produkten: vald garanti + valt verktyg (tilläggsrutan, avsnitt 10)
    var extras = [];
    if (selected && currentBand && enabled()) extras.push(artNo(currentBand, selected));
    [window.prydligtAddonSelected, window.prydligtMatchSelected].forEach(function (fn) {
      if (typeof fn !== 'function') return;
      var ad = fn(); if (ad) extras = extras.concat(ad);
    });
    if (!extras.length) return;
    if (adding) { e.preventDefault(); e.stopImmediatePropagation(); return; }
    adding = true;
    btn.classList.add('p-busy'); btn.setAttribute('aria-busy', 'true');
    var release = function () { adding = false; btn.classList.remove('p-busy'); btn.removeAttribute('aria-busy'); };
    var addAll = function (orderId) {
      return extras.reduce(function (p, nr) {
        return p.then(function () { return addToCart(nr, orderId); }).then(function (r) { if (r) trackAddon(nr); });
      }, Promise.resolve())
        .then(function () { try { document.dispatchEvent(new CustomEvent('prydligt:extras-added')); } catch (err) {} });
    };
    var existing = orderUid();
    var pass = function () { btn.__pBypass = true; btn.click(); setTimeout(function () { btn.__pBypass = false; }, 0); };
    if (existing) {
      e.preventDefault(); e.stopImmediatePropagation();
      var done = false, go = function () { if (!done) { done = true; pass(); setTimeout(release, 2000); } };
      setTimeout(go, 3000);                       // köpet av klockan får aldrig vänta längre än 3 s
      addAll(existing).then(go, go);
    } else {
      var rel = setTimeout(release, 10000);
      waitForOrder(8000).then(function (u) { return u ? addAll(u) : null; })
        .then(function () { clearTimeout(rel); setTimeout(release, 1500); }, function () { clearTimeout(rel); release(); });
    }
  }, true);

  function start() { mount(); window.prydligtEvery(mount, 1000); }
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
  function start() { addFooterLogo(); window.prydligtEvery(addFooterLogo, 2000); }
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
  var NL_DELAY = 30000;   // 30 s: popupen ska inte täcka produkten direkt (Google straffar påträngande rutor på mobil)
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
  /* Abicart låser body (modal_active + overflow:hidden) så fort popupen läggs in,
     även när vår CSS döljer den. CSS-fixen 19d bygger på :has(), som saknas i
     äldre iOS (< 15.4) och Firefox (< 121). Här låses sidan upp med JS oavsett
     webbläsare så länge popupen är dold – och alltid i kassan. */
  function unlockWhileHidden() {
    var b = document.body;
    if (!b) return;
    var hidden = !root.classList.contains('p-nl-ok') || b.classList.contains('checkout');
    var nl = document.querySelector('.tws-newsletter-subscribe--dialog');
    if (hidden && nl && b.classList.contains('modal_active')) {
      b.style.setProperty('overflow', 'auto', 'important');
      b.style.setProperty('padding-right', '0', 'important');
      b.setAttribute('data-p-nl-unlocked', '1');
    } else if (!hidden && b.getAttribute('data-p-nl-unlocked')) {
      b.style.removeProperty('overflow');
      b.style.removeProperty('padding-right');
      b.removeAttribute('data-p-nl-unlocked');
    }
  }
  function tick() {
    fixPlaceholder();
    unlockWhileHidden();
    if (root.classList.contains('p-nl-ok')) {
      if (document.body.classList.contains('checkout')) root.classList.remove('p-nl-ok');
      return;
    }
    if (Date.now() - t0 < NL_DELAY) return;
    if (document.body.classList.contains('checkout')) return;
    if (cookieBarVisible()) return;
    root.classList.add('p-nl-ok');
  }
  function start() {
    tick();
    window.prydligtEvery(tick, 1000);
    /* Lås upp direkt när Abicart sätter modal_active, inte först vid nästa tick */
    try {
      new MutationObserver(unlockWhileHidden)
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* ===================================================================
   6. USP-PUNKTER P\u00c5 PRODUKTSIDAN: ikon + klickbar f\u00f6rklaring
   Punkterna skrivs i temaeditorn (Produktsida -> Unique Selling Points).
   H\u00e4r kopplas varje punkt till en ikon och en kort text som f\u00e4lls ut.
   =================================================================== */
(function () {
  var TXT = {
    sv: {
      ret: 'Ångra dig i upp till 99 dagar. Mejla support@prydligt.se så fixar vi resten – ingen utskrift behövs. Pengarna är tillbaka inom 3 vardagar efter att vi fått returen.',
      ship: 'Vi packar och skickar fr\u00e5n v\u00e5rt eget lager i V\u00e4nersborg. Snabbt, utan mellanh\u00e4nder.',
      cust: '\u00d6ver 450 000 kunder har handlat hos oss sedan starten.',
      warr: 'G\u00e5r n\u00e5got s\u00f6nder vid normal anv\u00e4ndning reparerar vi det eller skickar en ny, utan kostnad. Till klockor kan du l\u00e4gga till f\u00f6rl\u00e4ngd garanti.',
      warrLink: 'L\u00e4s mer', warrUrl: '/forlangd-garanti'
    },
    da: {
      ret: 'Fortryd dit køb i op til 99 dage. Skriv til support@prydligt.se, så klarer vi resten. Pengene er tilbage inden for 3 hverdage, efter at vi har modtaget returen.',
      ship: 'Vi pakker og sender fra vores eget lager i V\u00e4nersborg i Sverige. Ingen told inden for EU.',
      cust: 'Over 450.000 kunder har handlet hos os siden starten.',
      warr: 'G\u00e5r noget i stykker ved normal brug, reparerer vi det eller sender et nyt, uden beregning.'
    },
    de: {
      ret: 'Du hast 99 Tage Rückgaberecht. Schreib an support@prydligt.se, wir kümmern uns um den Rest. Dein Geld ist innerhalb von 3 Werktagen nach Eingang der Rücksendung zurück.',
      ship: 'Wir packen und versenden aus unserem eigenen Lager in V\u00e4nersborg, Schweden. Kein Zoll innerhalb der EU.',
      cust: '\u00dcber 450.000 Kunden haben seit unserem Start bei uns eingekauft.',
      warr: 'Geht bei normalem Gebrauch etwas kaputt, reparieren wir es oder schicken dir ein neues, kostenlos.'
    },
    en: {
      ret: "Change your mind within 99 days. Email support@prydligt.se and we'll take care of the rest. You'll have your money back within 3 working days of us receiving your return.",
      ship: 'We pack and ship from our own warehouse in V\u00e4nersborg, Sweden.',
      cust: 'Over 450,000 customers have shopped with us since we started.',
      warr: 'If something breaks with normal use, we repair it or send you a new one, free of charge.'
    },
    fi: {
      ret: 'Voit perua ostoksesi 99 päivän ajan. Lähetä sähköpostia osoitteeseen support@prydligt.se, niin hoidamme loput. Saat rahasi takaisin 3 arkipäivän kuluessa siitä, kun palautus on saapunut.',
      ship: 'Pakkaamme ja l\u00e4het\u00e4mme omasta varastostamme V\u00e4nersborgista, Ruotsista. Ei tulleja EU:n sis\u00e4ll\u00e4.',
      cust: 'Yli 450 000 asiakasta on ostanut meilt\u00e4 aloituksestamme l\u00e4htien.',
      warr: 'Jos jokin hajoaa normaalik\u00e4yt\u00f6ss\u00e4, korjaamme sen tai l\u00e4het\u00e4mme uuden veloituksetta.'
    },
    nb: {
      ret: 'Angre kjøpet i opptil 99 dager. Send en e-post til support@prydligt.se, så ordner vi resten. Du får pengene tilbake innen 3 virkedager etter at vi har mottatt returen.',
      ship: 'Vi pakker og sender fra v\u00e5rt eget lager i V\u00e4nersborg i Sverige. Vi er registrert i VOEC, s\u00e5 du betaler ingen toll eller gebyrer ved levering.',
      cust: 'Over 450 000 kunder har handlet hos oss siden starten.',
      warr: 'G\u00e5r noe i stykker ved normal bruk, reparerer vi det eller sender et nytt, uten kostnad.'
    },
    nl: {
      ret: 'Je hebt 99 dagen bedenktijd. Mail naar support@prydligt.se en wij regelen de rest. Je hebt je geld binnen 3 werkdagen terug nadat we je retour hebben ontvangen.',
      ship: 'We pakken en verzenden vanuit ons eigen magazijn in V\u00e4nersborg, Zweden. Geen douanekosten binnen de EU.',
      cust: 'Meer dan 450.000 klanten kochten al bij ons sinds onze start.',
      warr: 'Gaat er bij normaal gebruik iets kapot, dan repareren we het of sturen we een nieuw exemplaar, gratis.'
    },
    fr: {
      ret: 'Vous disposez de 99 jours pour changer d’avis. Écrivez à support@prydligt.se et nous nous occupons du reste. Vous êtes remboursé sous 3 jours ouvrés après réception du retour.',
      ship: 'Nous emballons et expédions depuis notre propre entrepôt à Vänersborg, en Suède. Pas de droits de douane au sein de l’UE.',
      cust: 'Plus de 450 000 clients ont acheté chez nous depuis nos débuts.',
      warr: 'Si quelque chose se casse lors d’une utilisation normale, nous le réparons ou vous en envoyons un nouveau, gratuitement.'
    },
    pl: {
      ret: 'Masz 99 dni na zwrot. Napisz na support@prydligt.se, a my zajmiemy się resztą. Pieniądze wrócą do Ciebie w ciągu 3 dni roboczych od otrzymania zwrotu.',
      ship: 'Pakujemy i wysyłamy z naszego własnego magazynu w Vänersborgu w Szwecji. Bez cła w obrębie UE.',
      cust: 'Ponad 450 000 klientów zrobiło u nas zakupy od początku naszej działalności.',
      warr: 'Jeśli coś zepsuje się podczas normalnego użytkowania, naprawimy to lub wyślemy nowy egzemplarz bezpłatnie.'
    },
    es: {
      ret: 'Tienes 99 días para cambiar de opinión. Escribe a support@prydligt.se y nos encargamos del resto. Recibirás tu dinero en un plazo de 3 días laborables tras recibir la devolución.',
      ship: 'Empaquetamos y enviamos desde nuestro propio almacén en Vänersborg, Suecia. Sin aranceles dentro de la UE.',
      cust: 'Más de 450.000 clientes han comprado con nosotros desde que empezamos.',
      warr: 'Si algo se rompe con un uso normal, lo reparamos o te enviamos uno nuevo, sin coste.'
    },
    it: {
      ret: 'Hai 99 giorni per cambiare idea. Scrivi a support@prydligt.se e pensiamo noi al resto. Riceverai il rimborso entro 3 giorni lavorativi dalla ricezione del reso.',
      ship: 'Imballiamo e spediamo dal nostro magazzino a Vänersborg, in Svezia. Nessun dazio all’interno dell’UE.',
      cust: 'Oltre 450.000 clienti hanno acquistato da noi dal nostro inizio.',
      warr: 'Se qualcosa si rompe con un uso normale, lo ripariamo o te ne inviamo uno nuovo, gratuitamente.'
    },
    pt: {
      ret: 'Tem 99 dias para mudar de ideias. Escreva para support@prydligt.se e tratamos do resto. Recebe o reembolso no prazo de 3 dias úteis após recebermos a devolução.',
      ship: 'Embalamos e enviamos a partir do nosso próprio armazém em Vänersborg, na Suécia. Sem taxas alfandegárias dentro da UE.',
      cust: 'Mais de 450.000 clientes já compraram connosco desde o início.',
      warr: 'Se algo avariar com uma utilização normal, reparamos ou enviamos um novo, sem custos.'
    }
  };
  TXT.no = TXT.nb;

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    return TXT[l] ? l : 'sv';
  }
  function kind(text) {
    if (/\b99\b/.test(text)) return 'ret';
    if (/450/.test(text)) return 'cust';
    if (/Sverige|Sweden|Schweden|Ruotsi|Zweden|Su[eè]de|Szwecj|Suecia|Svezia|Su[eé]cia/i.test(text)) return 'ship';
    if (/garanti|warranty|takuu|gwarancj|garant[ií]a|garanzia/i.test(text)) return 'warr';
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
      if (k === 'warr' && t.warrUrl) more.appendChild(link(t.warrUrl, t.warrLink));
      if (k === 'ret' && t.retUrl) more.appendChild(link(t.retUrl, t.retLink));
      // Står öppet köp i listan behövs inte raden i fraktrutan
      if (k === 'ret') document.body.classList.add('p-has-ret');
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
  function start() { enhance(); window.prydligtEvery(enhance, 1500); }
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
      icons: ['Skickas fr\u00e5n Sverige', '99 dagars \u00f6ppet k\u00f6p', '450\u00a0000+\nkunder'],
      head: 'Beh\u00f6ver du mer information?',
      faq: [
        ['N\u00e4r f\u00e5r jag min order?', 'Best\u00e4ller du f\u00f6re kl. 16 en vardag skickar vi samma dag med PostNord. Leveransen tar 1\u20132 arbetsdagar och frakten \u00e4r fri \u00f6ver 600 kr.'],
        ['Hur returnerar jag?', 'Du har 99 dagars \u00f6ppet k\u00f6p. Mejla {mail} s\u00e5 skickar vi en l\u00e4nk till v\u00e5r returportal, d\u00e4r du f\u00e5r en QR-kod att visa hos PostNord-ombudet. Vi betalar tillbaka inom 3 vardagar fr\u00e5n att returen kommit fram.'],
        ['Vilken garanti ing\u00e5r?', 'Alla produkter har 1 \u00e5rs garanti mot fabrikations- och materialfel. Dessutom har du alltid tre \u00e5rs reklamationsr\u00e4tt enligt konsumentk\u00f6plagen. Till klockor kan du l\u00e4gga till f\u00f6rl\u00e4ngd garanti.'],
      ]
    },
    da: {
      icons: ['Sendes fra Sverige', '99 dages fuld returret', '450.000+\nkunder'],
      head: 'Har du brug for mere information?',
      faq: [
        ['Hvorn\u00e5r f\u00e5r jeg min ordre?', 'Bestiller du inden kl. 16 (svensk tid) p\u00e5 en hverdag, sender vi samme dag med PostNord. Levering tager 2\u20134 hverdage, og fragten er gratis over ' + window.PRYDLIGT_FREE.da + ' kr. Ingen told inden for EU.'],
        ['Hvordan returnerer jeg?', 'Du har 99 dages fuld returret. Skriv til {mail} med dit ordrenummer, s\u00e5 hj\u00e6lper vi dig med returneringen.'],
        ['Hvilken garanti er inkluderet?', 'Alle produkter har 1 \u00e5rs garanti mod fabrikations- og materialefejl. Det p\u00e5virker ikke din lovpligtige reklamationsret.'],
      ]
    },
    nb: {
      icons: ['Sendes fra Sverige', '99 dagers \u00e5pent kj\u00f8p', 'Ingen toll eller gebyrer'],
      head: 'Trenger du mer informasjon?',
      faq: [
        ['M\u00e5 jeg betale toll?', 'Nei. Vi er registrert i VOEC, s\u00e5 mva. er inkludert i prisen og du betaler ingen toll eller gebyrer ved levering.'],
        ['N\u00e5r f\u00e5r jeg ordren min?', 'Bestiller du f\u00f8r kl. 16 (svensk tid) p\u00e5 en hverdag, sender vi samme dag med PostNord. Leveringen tar 2\u20134 virkedager, og frakten er gratis over ' + window.PRYDLIGT_FREE.nb + ' kr.'],
        ['Hvordan returnerer jeg?', 'Du har 99 dagers \u00e5pent kj\u00f8p. Send en e-post til {mail} med ordrenummeret ditt, s\u00e5 hjelper vi deg med returen.'],
        ['Hvilken garanti er inkludert?', 'Alle produkter har 1 \u00e5rs garanti mot produksjons- og materialfeil. Det p\u00e5virker ikke reklamasjonsretten din etter loven.'],
      ]
    },
    fi: {
      icons: ['L\u00e4hetet\u00e4\u00e4n Ruotsista', '99 p\u00e4iv\u00e4n palautusoikeus', '450\u00a0000+\nasiakasta'],
      head: 'Tarvitsetko lis\u00e4tietoja?',
      faq: [
        ['Milloin saan tilaukseni?', 'Kun tilaat arkip\u00e4iv\u00e4n\u00e4 ennen klo 16 (Ruotsin aikaa), l\u00e4het\u00e4mme saman p\u00e4iv\u00e4n aikana PostNordilla. Toimitus kest\u00e4\u00e4 2\u20134 arkip\u00e4iv\u00e4\u00e4, ja yli ' + window.PRYDLIGT_FREE.fi + ' \u20ac:n tilaukset toimitetaan ilmaiseksi. Ei tulleja EU:n sis\u00e4ll\u00e4.'],
        ['Miten palautan tuotteen?', 'Sinulla on 99 p\u00e4iv\u00e4n palautusoikeus. L\u00e4het\u00e4 tilausnumerosi osoitteeseen {mail}, niin autamme palautuksessa.'],
        ['Mik\u00e4 takuu tuotteilla on?', 'Kaikilla tuotteilla on 1 vuoden takuu valmistus- ja materiaalivirheiden varalta. Se ei vaikuta lakis\u00e4\u00e4teisiin oikeuksiisi.'],
      ]
    },
    de: {
      icons: ['Versand aus Schweden', '99 Tage R\u00fcckgaberecht', '450.000+\nKunden'],
      head: 'Brauchst du mehr Informationen?',
      faq: [
        ['Wann kommt meine Bestellung?', 'Bestellst du werktags vor 16 Uhr, versenden wir noch am selben Tag mit PostNord. Die Lieferung dauert 2\u20134 Werktage, ab ' + window.PRYDLIGT_FREE.de + ' \u20ac ist der Versand kostenlos. Kein Zoll innerhalb der EU.'],
        ['Wie funktioniert die R\u00fccksendung?', 'Du hast 99 Tage R\u00fcckgaberecht. Schreib uns mit deiner Bestellnummer an {mail}, dann helfen wir dir weiter.'],
        ['Welche Garantie ist enthalten?', 'Alle Produkte haben 1 Jahr Garantie auf Herstellungs- und Materialfehler. Deine gesetzlichen Gew\u00e4hrleistungsrechte bleiben davon unber\u00fchrt.'],
      ]
    },
    nl: {
      icons: ['Verzonden vanuit Zweden', '99 dagen bedenktijd', '450.000+\nklanten'],
      head: 'Meer informatie nodig?',
      faq: [
        ['Wanneer krijg ik mijn bestelling?', 'Bestel je op een werkdag v\u00f3\u00f3r 16.00 uur, dan versturen we dezelfde dag met PostNord. Levering duurt 2\u20134 werkdagen en vanaf ' + window.PRYDLIGT_FREE.nl + ' \u20ac is de verzending gratis. Geen douanekosten binnen de EU.'],
        ['Hoe stuur ik iets terug?', 'Je hebt 99 dagen bedenktijd. Mail je ordernummer naar {mail} en we helpen je met de retour.'],
        ['Welke garantie krijg ik?', 'Alle producten hebben 1 jaar garantie op fabricage- en materiaalfouten. Dit doet niets af aan je wettelijke rechten.'],
      ]
    },
    en: {
      icons: ['Shipped from Sweden', '99-day returns', '450,000+\ncustomers'],
      head: 'Need more information?',
      faq: [
        ['When will my order arrive?', 'Order before 4 pm (Swedish time) on a weekday and we ship the same day with PostNord. Delivery takes 2\u20134 working days.'],
        ['How do I return something?', 'You have 99 days to return. Email {mail} with your order number and we will help you.'],
        ['What warranty is included?', 'All products have a 1-year warranty against manufacturing and material defects. Your statutory rights are not affected.'],
      ]
    },
    fr: { icons: ['Expédié de Suède', '99 jours pour changer d’avis', '450\u00a0000+\nclients'], head: '', faq: [] },
    pl: { icons: ['Wysyłka ze Szwecji', '99 dni na zwrot', '450\u00a0000+\nklientów'], head: '', faq: [] },
    es: { icons: ['Enviado desde Suecia', '99 días de devolución', '450.000+\nclientes'], head: '', faq: [] },
    it: { icons: ['Spedito dalla Svezia', '99 giorni per il reso', '450.000+\nclienti'], head: '', faq: [] },
    pt: { icons: ['Enviado da Suécia', '99 dias para devolução', '450\u00a0000+\nclientes'], head: '', faq: [] }
  };
  T.no = T.nb;

  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    return T[l] ? l : 'sv';
  }
  var ICON = ['ship', 'ret', 'cust'];

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
  function start() { mount(); window.prydligtEvery(mount, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/*!
 * Prydligt – hopfälld varukorg i kassan (mobil/surfplatta)
 * När kassan är enkolumns (sammanfattningen i sidokolumnen syns inte) visas rubriken
 * "Kassa" och en rad "Visa varukorg (3)  1 564 SEK". Varorna och sammanfattningen är
 * dolda tills kunden klickar. På dator (två kolumner) ändras ingenting här.
 */
(function () {
  'use strict';
  var T = {
    sv: ['Kassa', 'Visa varukorg', 'Dölj varukorg'],
    nb: ['Kasse', 'Vis handlekurv', 'Skjul handlekurv'],
    da: ['Kasse', 'Vis kurv', 'Skjul kurv'],
    fi: ['Kassa', 'Näytä ostoskori', 'Piilota ostoskori'],
    de: ['Kasse', 'Warenkorb anzeigen', 'Warenkorb ausblenden'],
    nl: ['Afrekenen', 'Winkelwagen tonen', 'Winkelwagen verbergen'],
    en: ['Checkout', 'Show cart', 'Hide cart'],
    fr: ['Paiement', 'Afficher le panier', 'Masquer le panier'],
    pl: ['Kasa', 'Pokaż koszyk', 'Ukryj koszyk'],
    es: ['Pago', 'Ver carrito', 'Ocultar carrito'],
    it: ['Cassa', 'Mostra carrello', 'Nascondi carrello'],
    pt: ['Finalizar compra', 'Ver carrinho', 'Ocultar carrinho']
  };
  T.no = T.nb;
  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    return T[l] ? l : 'sv';
  }
  var open = false, title = null, btn = null;

  function txt(sel) {
    var e = document.querySelector(sel);
    return e ? (e.textContent || '').replace(/\s+/g, ' ').trim() : '';
  }

  function tick() {
    var body = document.body;
    if (!body || !body.classList.contains('checkout')) return;
    var cart = document.querySelector('.opc-checkout--main .tws-opc-cart');
    var side = document.querySelector('.opc-checkout--summary');
    var mobile = !side || side.offsetParent === null;
    body.classList.toggle('p-co-mobile', mobile);
    if (!cart || !cart.parentElement) return;

    var t = T[lang()];
    if (!title) { title = document.createElement('h1'); title.className = 'p-co-title'; }
    if (!btn) {
      btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'p-co-toggle';
      btn.addEventListener('click', function () { open = !open; tick(); });
    }
    if (cart.previousElementSibling !== btn) cart.parentElement.insertBefore(btn, cart);
    if (btn.previousElementSibling !== title) btn.parentElement.insertBefore(title, btn);
    if (title.textContent !== t[0]) title.textContent = t[0];

    var n = (txt('.tws-cart-summary--items-count').match(/\d+/) || [''])[0];
    var total = txt('.tws-cart-summary--sum-row .tws-cart-summary--value');
    var html = '<span class="p-co-toggle__lbl">' + (open ? t[2] : t[1]) + (n ? ' (' + n + ')' : '') +
      ' <span class="p-co-toggle__chev" aria-hidden="true"></span></span><span class="p-co-toggle__tot">' + total + '</span>';
    if (btn.__last !== html) { btn.innerHTML = html; btn.__last = html; }
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    body.classList.toggle('p-co-closed', !open);
  }

  function start() { tick(); window.prydligtEvery(tick, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/*!
 * Prydligt – leveranskort i kassan (land + leveranssätt i en ruta)
 * Läser Abicarts egna element och klickar på dem; inget av Abicarts flöde ersätts.
 */
(function () {
  'use strict';
  var T = {
    sv: ['Leverans', 'Ändra land', 'Fri frakt'], nb: ['Levering', 'Endre land', 'Fri frakt'],
    da: ['Levering', 'Skift land', 'Gratis fragt'], fi: ['Toimitus', 'Vaihda maa', 'Ilmainen toimitus'],
    de: ['Lieferung', 'Land ändern', 'Kostenloser Versand'], nl: ['Levering', 'Land wijzigen', 'Gratis verzending'],
    en: ['Delivery', 'Change country', 'Free shipping'], fr: ['Livraison', 'Changer de pays', 'Livraison gratuite'],
    pl: ['Dostawa', 'Zmień kraj', 'Darmowa dostawa'], es: ['Entrega', 'Cambiar país', 'Envío gratis'],
    it: ['Consegna', 'Cambia paese', 'Spedizione gratuita'], pt: ['Entrega', 'Alterar país', 'Envio grátis']
  };
  T.no = T.nb;
  var FLAG = [
    [/sverige|sweden|schweden|ruotsi|zweden|su[eè]de/i, '🇸🇪'],
    [/norge|norway|norwegen|norja|noorwegen|norv[eè]ge/i, '🇳🇴'],
    [/danmark|denmark|d[aä]nemark|tanska|denemarken/i, '🇩🇰'],
    [/finland|suomi|finnland|finlande/i, '🇫🇮'],
    [/tyskland|germany|deutschland|saksa|duitsland|allemagne/i, '🇩🇪'],
    [/nederl|netherlands|niederlande|alankomaat|pays-bas|holland/i, '🇳🇱'],
    [/storbritannien|united kingdom|great britain|storbritannia|isobritannia|großbritannien|verenigd koninkrijk|royaume-uni|wielka brytania|reino unido|regno unito/i, '🇬🇧'],
    [/frankrike|france|frankrig|ranska|frankreich|frankrijk|francja|francia|frança/i, '🇫🇷'],
    [/polen|poland|puola|pologne|polska|polonia|polónia/i, '🇵🇱'],
    [/spanien|spain|spania|espanja|spanje|espagne|hiszpania|españa|spagna|espanha/i, '🇪🇸'],
    [/italien|italy|italia|itali|italië|italie|włochy|itália/i, '🇮🇹'],
    [/portugal|portugali|portugalia|portogallo/i, '🇵🇹']
  ];
  function lang() {
    var l = (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2);
    return T[l] ? l : 'sv';
  }
  function txt(el) { return el ? (el.textContent || '').replace(/\s+/g, ' ').trim() : ''; }
  function esc(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var card = null;

  function tick() {
    var body = document.body;
    if (!body || !body.classList.contains('checkout')) return;
    var sc = document.querySelector('.opc-checkout--shortcuts');
    var btn = sc && sc.querySelector('.tws-checkout-shortcuts--button');
    var methods = document.querySelectorAll('.tws-checkout--delivery-method');
    if (!sc || !btn || !methods.length) { body.classList.remove('p-lev-on'); if (card && card.parentNode) card.parentNode.removeChild(card); return; }

    var t = T[lang()];
    var country = txt(sc.querySelector('.tws-react-common--search-dropdown-label') || btn).split('/')[0].trim();
    var flag = '🌐';
    for (var i = 0; i < FLAG.length; i++) if (FLAG[i][0].test(country)) { flag = FLAG[i][1]; break; }
    var free = !!document.querySelector('.p-cart-free--ok, .p-ship__free--ok');

    var rows = '';
    for (var j = 0; j < methods.length; j++) {
      var m = methods[j];
      var img = m.querySelector('.tws-checkout--delivery-method-logo img');
      var carrier = img && /postnord/i.test(img.src) ? 'PostNord' : img && /instabox/i.test(img.src) ? 'Instabox' : img && /budbee/i.test(img.src) ? 'Budbee' : '';
      var title = txt(m.querySelector('.tws-checkout--delivery-method-title')).replace(/\.$/, '');
      var desc = txt(m.querySelector('.tws-checkout--delivery-method-description')).replace(/\.$/, '');
      var on = m.classList.contains('tws-checkout--delivery-method-selected');
      // Fraktbolagets logga (från Abicart) i stället för bara text. Saknas loggan visas namnet som text.
      var src = img && (img.currentSrc || img.src);
      var brandOnly = /^[\w\u00c0-\u017f-]+$/.test(title);   // titeln är bara ett namn, t.ex. "DHL"
      var head = src
        ? '<div class="p-levcard__logo"><img src="' + esc(src) + '" alt="' + esc(carrier || title) + '"></div>'
        : '<div class="p-levcard__t">' + esc(carrier || title) + '</div>';
      var sub = src
        ? (brandOnly ? desc : title + (desc ? '\n' + desc : ''))
        : (carrier ? title + (desc ? '\n' + desc : '') : desc);
      var price = txt(m.querySelector('.tws-checkout--delivery-method-price, .tws-api-price'));
      var priceHtml = price ? '<span class="p-levcard__p">' + esc(price) + '</span>' : (free && on ? '<span class="p-levcard__p is-free">' + esc(t[2]) + '</span>' : '');
      rows += '<div class="p-levcard__row p-levcard__m' + (on ? ' is-on' : '') + '" data-i="' + j + '" role="radio" aria-checked="' + on + '" tabindex="0">' +
        '<span class="p-levcard__chk" aria-hidden="true"></span><span class="p-levcard__grow">' +
        head + '<div class="p-levcard__d">' + esc(sub) + '</div></span>' + priceHtml + '</div>';
    }
    var html = '<div class="p-levcard__h">' + esc(t[0]) + '</div><div class="p-levcard__box">' +
      '<div class="p-levcard__row"><span class="p-levcard__flag" aria-hidden="true">' + flag + '</span>' +
      '<span class="p-levcard__grow p-levcard__country">' + esc(country) + '</span>' +
      '<button type="button" class="p-levcard__link p-levcard__change">' + esc(t[1]) + '</button></div>' + rows + '</div>';

    if (!card) {
      card = document.createElement('div');
      card.className = 'p-levcard';
      card.addEventListener('click', function (e) {
        var ch = e.target.closest('.p-levcard__change');
        if (ch) { e.preventDefault(); e.stopPropagation(); var b = document.querySelector('.opc-checkout--shortcuts .tws-checkout-shortcuts--button'); if (b) b.click(); return; }
        var row = e.target.closest('.p-levcard__m');
        if (row) { var ms = document.querySelectorAll('.tws-checkout--delivery-method'); var target = ms[+row.getAttribute('data-i')]; if (target && !target.classList.contains('tws-checkout--delivery-method-selected')) target.click(); }
      });
    }
    if (sc.previousElementSibling !== card) sc.parentNode.insertBefore(card, sc);
    if (card.__last !== html) { card.innerHTML = html; card.__last = html; }
    body.classList.add('p-lev-on');
  }
  function start() { tick(); window.prydligtEvery(tick, 700); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();


/* ===================================================================
   9. PRODUKTSIDAN: presentpåse-rad för smycken + städad lagerstatus
   - "Ingår: Presentpåse i sammet (värde X)" under måttraden på Céleste-smycken.
     Tryck på raden visar bild på påsen.
     Värdet per valuta står i GIFT_VALUE nedan.
   - Tar bort ✅ efter "Finns i lager" (gröna pricken räcker).
   =================================================================== */
(function () {
  // Presentpåsens värde per valuta (ändra här vid behov)
  var GIFT_VALUE = { SEK: 49, NOK: 59, DKK: 39, EUR: 4.9, GBP: 4.9, PLN: 19.9 };
  // Bild på påsen som visas när man trycker på raden (byt när det finns en version utan ringar)
  var GIFT_IMG = 'https://cdn.abicart.com/shop/30854/art54/h5103/208005103-origpic-aa935b.jpg';
  var T = {
    sv: ['Ingår:', 'Presentpåse i sammet', 'värde', 'Varje Céleste-smycke levereras i en presentpåse i sammet – redo att ge bort direkt.'],
    nb: ['Inkludert:', 'Gavepose i fløyel', 'verdi', 'Hvert Céleste-smykke leveres i en gavepose i fløyel – klar til å gis bort.'],
    da: ['Medfølger:', 'Gavepose i fløjl', 'værdi', 'Hvert Céleste-smykke leveres i en gavepose i fløjl – klar til at give væk.'],
    fi: ['Sisältyy:', 'Samettinen lahjapussi', 'arvo', 'Jokainen Céleste-koru toimitetaan samettisessa lahjapussissa – valmiina lahjaksi.'],
    de: ['Inklusive:', 'Geschenkbeutel aus Samt', 'Wert', 'Jedes Céleste-Schmuckstück kommt in einem Geschenkbeutel aus Samt – fertig zum Verschenken.'],
    nl: ['Inbegrepen:', 'Fluwelen cadeauzakje', 'waarde', 'Elk Céleste-sieraad wordt geleverd in een fluwelen cadeauzakje – klaar om cadeau te geven.'],
    en: ['Included:', 'Velvet gift pouch', 'worth', 'Every Céleste piece arrives in a velvet gift pouch – ready to give.'],
    fr: ['Inclus :', 'Pochette cadeau en velours', 'valeur', 'Chaque bijou Céleste est livré dans une pochette cadeau en velours – prêt à offrir.'],
    pl: ['W zestawie:', 'Aksamitny woreczek prezentowy', 'wartość', 'Każda biżuteria Céleste trafia do Ciebie w aksamitnym woreczku – gotowa na prezent.'],
    es: ['Incluye:', 'Bolsa de regalo de terciopelo', 'valor', 'Cada joya Céleste llega en una bolsa de regalo de terciopelo, lista para regalar.'],
    it: ['Incluso:', 'Sacchetto regalo in velluto', 'valore', 'Ogni gioiello Céleste arriva in un sacchetto regalo di velluto, pronto da regalare.'],
    pt: ['Inclui:', 'Bolsa de oferta em veludo', 'valor', 'Cada joia Céleste chega numa bolsa de oferta em veludo, pronta a oferecer.']
  };
  T.no = T.nb;
  var JEWEL = /smycken|smykker|korut|schmuck|sieraden|jewel|bijoux|joaillerie|biżuteria|bizuteria|joyas|gioielli|joias|joalharia/i;
  var CUR = { sv: 'SEK', nb: 'NOK', no: 'NOK', da: 'DKK', pl: 'PLN' };
  var LOC = { sv: 'sv-SE', nb: 'nb-NO', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI', de: 'de-DE', nl: 'nl-NL', en: 'en-GB', fr: 'fr-FR', pl: 'pl-PL', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };

  function lang() { return (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2); }
  function currency() {
    var l = lang();
    if (CUR[l]) return CUR[l];
    var p = document.querySelector('.slot--article-price');
    var tx = p ? p.textContent : '';
    if (/£/.test(tx)) return 'GBP';
    if (/zł/.test(tx)) return 'PLN';
    return 'EUR';
  }
  function fmt(v, c) {
    try { return new Intl.NumberFormat(LOC[lang()] || 'sv-SE', { style: 'currency', currency: c, minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v); }
    catch (e) { return v + ' ' + c; }
  }
  function isJewellery() {
    var bc = document.querySelector('.slot--breadcrumbs');
    return !!(bc && JEWEL.test(bc.textContent));
  }
  // Presentpåsen gäller bara Céleste (andra smyckesmärken får annan förpackning)
  function isCeleste() {
    var n = document.querySelector('.slot--article-name');
    var a = document.querySelector('.slot--article-attributes');
    return /c[eé]leste/i.test((n ? n.textContent : '') + ' ' + (a ? a.textContent : ''));
  }
  function introHasText(intro) {
    if (!intro || intro.offsetParent === null) return false;
    var rm = intro.querySelector('.tws-article-introduction--read-more');
    var t = intro.textContent;
    if (rm) t = t.replace(rm.textContent, '');
    return !!t.trim();
  }
  function addGift() {
    if (document.querySelector('.p-gift')) return;
    var price = document.querySelector('.slot--article-price');
    if (!price || !isJewellery() || !isCeleste()) return;
    var t = T[lang()] || T.sv, c = currency();
    if (GIFT_VALUE[c] == null) return;
    // Placeras som produktfakta: direkt efter måttraden (.p-matt), annars direkt under priset.
    var matt = document.querySelectorAll('.slot--article-introduction .p-matt');
    var intro = document.querySelector('.slot--article-introduction');
    var p = document.createElement('p');
    p.className = 'p-matt p-gift';
    var b = document.createElement('strong'); b.textContent = t[0];
    var v = document.createElement('span'); v.className = 'p-gift__val';
    v.textContent = '(' + t[2] + ' ' + fmt(GIFT_VALUE[c], c) + ')';
    p.appendChild(b);
    p.appendChild(document.createTextNode(' ' + t[1] + ' '));
    p.appendChild(v);
    var panel = document.createElement('div');
    panel.className = 'p-gift__panel'; panel.id = 'p-gift-panel'; panel.hidden = true;
    var img = document.createElement('div');
    img.className = 'p-gift__img'; img.setAttribute('role', 'img'); img.setAttribute('aria-label', t[1]);
    img.style.backgroundImage = 'url("' + window.prydligtImg(GIFT_IMG, 800, 75) + '")';
    var cap = document.createElement('p'); cap.textContent = t[3];
    panel.appendChild(img); panel.appendChild(cap);
    p.setAttribute('role', 'button'); p.setAttribute('tabindex', '0');
    p.setAttribute('aria-expanded', 'false'); p.setAttribute('aria-controls', 'p-gift-panel');
    function tog() {
      panel.hidden = !panel.hidden;
      p.classList.toggle('p-gift--open', !panel.hidden);
      p.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
    }
    p.addEventListener('click', tog);
    p.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tog(); } });
    if (matt.length) { var last = matt[matt.length - 1]; last.parentNode.insertBefore(p, last.nextSibling); }
    else if (introHasText(intro)) intro.appendChild(p);   // inledande text finns och syns
    // Inga mått och tom/dold inledande text (Abicart döljer tom slot): direkt under priset
    else price.parentNode.insertBefore(p, price.nextSibling);
    p.parentNode.insertBefore(panel, p.nextSibling);
  }
  function cleanStock() {
    var s = document.querySelectorAll('.tws-article-stock-shipping--delivery-message span');
    for (var i = 0; i < s.length; i++) {
      if (/✅/.test(s[i].textContent)) s[i].textContent = s[i].textContent.replace(/\s*✅️?/g, '');
    }
  }
  function run() { cleanStock(); addGift(); }
  function start() { run(); window.prydligtEvery(run, 1500); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();


/* ===================================================================
   10. PRODUKTSIDAN: "Anpassa din klocka" – verktyg som tillval vid köpknappen
   - Länkborttagare (Tool-1): bara klockor med länkarmband i metall (LINK nedan,
     framtagen från produkttexter + bilder nov 2026).
   - Komplett verktygssats (Tool-2): alla klockor utom smartklockor.
   - Ett val åt gången (verktygssatsen täcker även länkarna).
   - Läggs i varukorgen av garantins köplogik (avsnittet om förlängd garanti),
     via window.prydligtAddonSelected().
   =================================================================== */
(function () {
  'use strict';
  var TOOL1 = 'Tool-1', TOOL2 = 'Tool-2';
  var LINK = {};
  'BA-2-1,BB-3-11,BB-6-8,BB-6-9,BB-6-10,LOR59,LOR62,A-1-6,A-2-16,A-6-11,BA-5-2,BA-5-4,BA-5-5,E-10-7,E-7-2,E-7-3,E-2-5,E-5-7,E-8-3,E-5-1,E-16-4,E-16-3,RG5,RG6,RG9,RG8,RG10,G-12-3,G-11-7,G-13-1,G-17-3,G-19-6,G-25-1,G-32-6,G-32-7,G-32-10,G-32-11,G-36-3,G-36-10,G-36-11,G-36-12,G-37-2,G-39-3,G-39-5,G-40-3,G-40-11,G-41-5,G-42-3,G-42-10,G-43-9,G-43-10,G-44-10,G-45-5,G-45-11,G-46-1,G-46-2,G-47-9,G-48-4,G-48-7,G-48-8,G-48-9,G-48-10,G-48-11,G-48-12,G-49-2,G-49-4,G-49-5,G-50-5,G-50-6,G-50-7,G-50-8,G-50-9,G-50-10,G-50-11,G-50-12,G-51-1,G-51-3,G-51-4,G-52-6,G-52-7,G-52-8,G-52-9,G-53-10,G-53-11,G-54-3,G-54-4,G-54-6,G-54-7,G-55-6,G-55-8,G-55-10,G-55-12,G-56-1,G-56-5,G-56-6,G-56-7,G-56-8,G-56-9,G-56-10,G-56-11,G-56-12,G-57-1,G-57-2,G-57-3,G-57-4,G-57-5,G-57-6,G-57-7,G-57-8,G-57-10,G-57-11,G-57-12,G-58-3,WO-G-47-12,G-48-1,G-58-12,G-59-3,G-59-7,G-62-3,G-62-4,MF-26-3,MF-26-9,MF-29-4,MF-30-3,NIB-30,NIB-31,NIB-32,NIB-33,NIB-34,NIB-35,NIB-38,NIB-39,NIB-41,NIB-4,NIB-5,NIB-6,NIB-7,NIB-8,NIB-9,NIB-10,NIB-42,NIB-44,NIB-45,NIB-15,NIB-16,NIB-17,NIB-21,NIB-22,NIB-23,NIB-24,NIB-25,NIB-26,NIB-27,NIB-28,NIB-50,NIB-51,NIB-52,NIB-53,NIB-57,NIB-58,NIB-59,NIB-60,NIB-61,XX-47-4-steel,NIB-62,NIB-64,NIB-65,NIB-66,NIB-67,NIB-68,NIB-69,NIB-71,NIB-72,NIB-73,NIB-74,NIB-75,KOM-1,KOM-2,KOM-3,KOM-4,KOM-5,KOM-7,KOM-8,KOM-9,KOM-10,KOM-11,KOM-12,KOM-13,KOM-14,KOM-15,KOM-16,KOM-17,KOM-18,KOM-19,KOM-20,KOM-21,KOM-22,KOM-23,KOM-24,KOM-25,KOM-26,KOM-27,LOR-71,LOR-72,LOR-73,LOR-74,LOR-75,LOR-76,LOR-78,LOR-79,LOR-80,LOR-82,LOR-81,LOR-85,LOR-86,LOR-84,LOR-83,NIB-84,NIB-85,NIB-86,KOM-29,KOM-31,KOM-32,KOM-33,KOM-34,KOM-36,KOM-37,KOM-38,KOM-54,KOM-55,KOM-56,KOM-57,KOM-58,KOM-59,KOM-60,KOM-61,KOM-62,LOR-87,LOR-89,LOR-90,LOR-91,LOR-93,LOR-94,LOR-95,LOR-96,LOR-99,LOR-100,LOR-101,LOR-102,LOR-117,LOR-118,LOR-119,LOR-120,LOR-121,LOR-123,LOR-124,LOR-125,LOR-126,LOR-127,LOR-128,LOR-129,LOR-130,LOR-131,LOR-132,LOR-133,LOR-134,LOR-135,LOR-136,LOR-137,LOR-138,KOM-63,KOM-64,KOM-65,KOM-66,KOM-67,KOM-68,KOM-69,KOM-70,KOM-71,KOM-72,KOM-73,KOM-74,KOM-75,KOM-76,KOM-77,KOM-78,KOM-79,KOM-80,KOM-81,KOM-82,NIB-147,NIB-150,NIB-123,NIB-124,NIB-125,NIB-126,NIB-128,NIB-129,NIB-130,NIB-105,NIB-106,NIB-107,NIB-109,NIB-136,NIB-137,NIB-138,NIB-141,NIB-143,NIB-144,NIB-145,NIB-131,NIB-132,NIB-133,NIB-91,NIB-93,NIB-95,NIB-96,LOR-139,LOR-140,LOR-141,LOR-142,LOR-143,LOR-144,LOR-145,NIB-154,NIB-156,NIB-158,NIB-160,NIB-161,NIB-162,NIB-163,NIB-164,NIB-165,NIB-166,NIB-167,NIB-168,NIB-169,NIB-171,NIB-172,NIB-173,NIB-174,NIB-176,NIB-177,LOR-146,LOR-147,LOR-148,LOR-149,LOR-150,LOR-151,LOR-152,LOR-153,LOR-154,LOR-155,LOR-156,LOR-157,LOR-158,LOR-159,LOR-160,LOR-161,LOR-162,NIB-178,NIB-179,NIB-180,NIB-181,NIB-182,NIB-183,NIB-184,NIB-185,NIB-187,KOM-94,KOM-95,KOM-96,KOM-97,KOM-98,KOM-99,KOM-100,KOM-101,KOM-102,KOM-103,KOM-104,KOM-105,KOM-106,KOM-107,KOM-108,KOM-109,KOM-110,KOM-112,KOM-113,KOM-115,KOM-117,KOM-119,LOR-163,LOR-164,LOR-165,LOR-166,LOR-167,LOR-168,LOR-169,LOR-170,LOR-171,LOR-172,LOR-173,LOR-174,LOR-175,LOR-176,NIB-190,NIB-191,NIB-193,NIB-195,NIB-196,NIB-201,NIB-202,NIB-204,NIB-207,NIB-208,NIB-209,LOR-177,LOR-178,LOR-179,LOR-180,LOR-181,LOR-182,LOR-183,LOR-185,LOR-186,LOR-188,KOM-146,KOM-147,KOM-149,KOM-150,KOM-151,KOM-152,KOM-153,KOM-155,KOM-158,KOM-159,KOM-162,KOM-163,KOM-164,KOM-165,KOM-166,KOM-167,KOM-168,KOM-169,KOM-171,KOM-178,KOM-179,KOM-183,KOM-185,KOM-186,KOM-187,LOR-209,LOR-210,LOR-211,LOR-212,LOR-213,LOR-214,LOR-215,LOR-216,LOR-217,LOR-218,LOR-219,LOR-220,LOR-221,LOR-222,KOM-202,KOM-203,KOM-204,KOM-205,LOR-191,LOR-189,LOR-192,LOR-193,LOR-199,LOR-200,LOR-201,LOR-202,LOR-203,KOM-206,KOM-207,KOM-208,KOM-209,KOM-210,KOM-211,KOM-212,KOM-213,KOM-214,KOM-215,KOM-188,KOM-189,KOM-190,KOM-191,KOM-192,KOM-193,KOM-194,KOM-195,KOM-196,KOM-197,KOM-198,KOM-199,KOM-200,KOM-201,NIB-217,NIB-218,NIB-219,NIB-220,NIB-222,NIB-226,NIB-232,NIB-233,NIB-234,NIB-235,NIB-236,NIB-237,NIB-238,NIB-239,NIB-240,NIB-241,NIB-242,NIB-243,NIB-244,NIB-245,NIB-246,NIB-247,NIB-248,NIB-249,NIB-250,NIB-251,NIB-252,NIB-253,NIB-254,NIB-255,NIB-256,NIB-257,NIB-258,NIB-259,NIB-260'.split(',').forEach(function (n) { LINK[n.trim().toUpperCase()] = 1; });
  var WATCH = /klock|klokk|\bur\b|\bure\b|kello|uhr|horlog|watch|montre|zegar|reloj|orolog|rel[oó]gi/i;
  var NOT = /smart|fitness|garanti|verktyg|tool|armband\b/i;   // smartklockor m.m. får inget

  var T = {
    sv: ['Anpassa din klocka', 'Länkborttagare', 'Korta armbandet själv – ingen urmakare behövs', 'Komplett verktygssats', 'Korta armbandet, byt batteri och armband – allt i ett fodral', 'Byt batteri och armband själv – allt i ett fodral'],
    nb: ['Tilpass klokken din', 'Lenkefjerner', 'Kort inn lenken selv – ingen urmaker trengs', 'Komplett verktøysett', 'Kort inn lenken, bytt batteri og reim – alt i ett etui', 'Bytt batteri og reim selv – alt i ett etui'],
    da: ['Tilpas dit ur', 'Ledfjerner', 'Afkort lænken selv – ingen urmager nødvendig', 'Komplet værktøjssæt', 'Afkort lænken, skift batteri og rem – alt i ét etui', 'Skift batteri og rem selv – alt i ét etui'],
    fi: ['Muokkaa kelloasi', 'Linkinpoistaja', 'Lyhennä ranneke itse – kelloseppää ei tarvita', 'Täydellinen työkalusarja', 'Lyhennä ranneke, vaihda paristo ja hihna – kaikki yhdessä kotelossa', 'Vaihda paristo ja hihna itse – kaikki yhdessä kotelossa'],
    de: ['Passe deine Uhr an', 'Gliederentferner', 'Armband selbst kürzen – kein Uhrmacher nötig', 'Komplettes Werkzeugset', 'Armband kürzen, Batterie und Band wechseln – alles in einem Etui', 'Batterie und Band selbst wechseln – alles in einem Etui'],
    nl: ['Pas je horloge aan', 'Schakelverwijderaar', 'Kort de band zelf in – geen horlogemaker nodig', 'Complete gereedschapsset', 'Band inkorten, batterij en band vervangen – alles in één etui', 'Zelf batterij en band vervangen – alles in één etui'],
    en: ['Customise your watch', 'Link remover', 'Shorten the bracelet yourself – no watchmaker needed', 'Complete toolkit', 'Shorten the bracelet, change battery and strap – all in one case', 'Change battery and strap yourself – all in one case'],
    fr: ['Personnalisez votre montre', 'Outil de retrait de maillons', 'Raccourcissez le bracelet vous-même – sans horloger', 'Kit d’outils complet', 'Raccourcir le bracelet, changer la pile et le bracelet – tout dans un étui', 'Changez la pile et le bracelet vous-même – tout dans un étui'],
    pl: ['Dopasuj swój zegarek', 'Usuwacz ogniw', 'Skróć bransoletę sam – bez zegarmistrza', 'Kompletny zestaw narzędzi', 'Skróć bransoletę, wymień baterię i pasek – wszystko w jednym etui', 'Wymień baterię i pasek sam – wszystko w jednym etui'],
    es: ['Personaliza tu reloj', 'Quitaeslabones', 'Acorta la pulsera tú mismo – sin relojero', 'Kit de herramientas completo', 'Acorta la pulsera, cambia la pila y la correa – todo en un estuche', 'Cambia la pila y la correa tú mismo – todo en un estuche'],
    it: ['Personalizza il tuo orologio', 'Rimuovi maglie', 'Accorcia il bracciale da solo – senza orologiaio', 'Kit di attrezzi completo', 'Accorcia il bracciale, cambia batteria e cinturino – tutto in un astuccio', 'Cambia batteria e cinturino da solo – tutto in un astuccio'],
    pt: ['Personalize o seu relógio', 'Removedor de elos', 'Encurte a bracelete sozinho – sem relojoeiro', 'Kit de ferramentas completo', 'Encurte a bracelete, troque a pilha e a correia – tudo num estojo', 'Troque a pilha e a correia sozinho – tudo num estojo']
  };
  T.no = T.nb;
  var T2 = { sv: 'Vad ingår?', nb: 'Hva følger med?', no: 'Hva følger med?', da: 'Hvad følger med?', fi: 'Mitä sisältyy?', de: 'Was ist enthalten?', nl: 'Wat zit erbij?', en: 'What’s included?', fr: 'Que contient-il ?', pl: 'Co zawiera?', es: '¿Qué incluye?', it: 'Cosa include?', pt: 'O que inclui?' };
  var LOC = { sv: 'sv-SE', nb: 'nb-NO', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI', de: 'de-DE', nl: 'nl-NL', en: 'en-GB', fr: 'fr-FR', pl: 'pl-PL', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };

  var info = null, asked = false, chosen = null, box = null, forArticle = null;
  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function lang() { return (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2); }
  function current() {
    var st = store(); if (!st || !st.route || st.route.name !== 'article') return null;
    var uid = st.route.params && st.route.params.article;
    var a = st.articles && st.articles[uid];
    return a ? { uid: uid, nr: String(a.articleNumber || '').trim().toUpperCase() } : null;
  }
  function rpc(method, params) {
    var st = store();
    if (!st || !window.twsCore || typeof window.twsCore.twapiFromState !== 'function') return Promise.reject(new Error('no api'));
    return Promise.resolve(window.twsCore.twapiFromState(st)(method).apply(null, params));
  }
  function fmt(v) {
    var st = store(), c = (st && st.currency) || 'SEK';
    try { return '+' + new Intl.NumberFormat(LOC[lang()] || 'sv-SE', { style: 'currency', currency: c, minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v); }
    catch (e) { return '+' + v + ' ' + c; }
  }
  function loadInfo(cb) {
    if (info || asked) return cb();
    asked = true;
    rpc('Article.list', [['articleNumber', 'price', 'images', 'isBuyable'], { filters: { articleNumber: { 'in': [TOOL1, TOOL2] } }, limit: 2 }])
      .then(function (list) {
        var st = store(), c = (st && st.currency) || 'SEK';
        info = {};
        (list || []).forEach(function (a) {
          var pr = a.price && a.price.current && a.price.current[c];
          if (pr != null && a.isBuyable !== false) info[String(a.articleNumber).toUpperCase()] = { price: pr, img: a.images && a.images[0] && window.prydligtImg(a.images[0], 120) };
        });
        cb();
      }, function () { cb(); });
  }
  function row(key, title, sub) {
    var i = info[key.toUpperCase()]; if (!i) return '';
    window.prydligtAddonMeta = window.prydligtAddonMeta || {};
    window.prydligtAddonMeta[key.toUpperCase()] = { price: i.price, source: 'anpassa_klocka' };
    return '<div class="p-addon__row" role="checkbox" aria-checked="false" tabindex="0" data-nr="' + key + '">' +
      '<span class="p-addon__cb"></span>' +
      (i.img ? '<span class="p-addon__img" style="background-image:url(\'' + i.img + '\')"></span>' : '') +
      '<span class="p-addon__t"><b></b><span></span></span>' +
      '<span class="p-addon__p">' + fmt(i.price) + '</span></div>';
  }
  function build(isLink) {
    var t = T[lang()] || T.sv;
    var d = document.createElement('div'); d.className = 'p-addon';
    d.innerHTML = '<div class="p-addon__h"></div>' + (isLink ? row(TOOL1) : '') + row(TOOL2);
    d.querySelector('.p-addon__h').textContent = t[0];
    var rows = d.querySelectorAll('.p-addon__row');
    if (!rows.length) return null;
    for (var k = 0; k < rows.length; k++) {
      var r = rows[k], one = r.getAttribute('data-nr') === TOOL1;
      r.querySelector('b').textContent = one ? t[1] : t[3];
      r.querySelector('.p-addon__t span').textContent = one ? t[2] : (isLink ? t[4] : t[5]);
      (function (rowEl) {
        var more = document.createElement('button'); more.type = 'button'; more.className = 'p-addon__more';
        more.textContent = (T2[lang()] || T2.sv);
        more.addEventListener('click', function (e) {
          e.preventDefault(); e.stopPropagation();
          if (!window.prydligtQuickView) return;
          window.prydligtQuickView({ nr: rowEl.getAttribute('data-nr'),
            isOn: function () { return rowEl.classList.contains('on'); },
            toggle: function () { pick.call(rowEl); } });
        });
        rowEl.querySelector('.p-addon__t').appendChild(more);
      })(r);
      r.addEventListener('click', pick);
      r.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick.call(this); } });
    }
    return d;
  }
  function pick() {
    var on = !this.classList.contains('on');
    var all = box.querySelectorAll('.p-addon__row');
    for (var k = 0; k < all.length; k++) { all[k].classList.remove('on'); all[k].setAttribute('aria-checked', 'false'); }
    if (on) { this.classList.add('on'); this.setAttribute('aria-checked', 'true'); }
    chosen = on ? this.getAttribute('data-nr') : null;
  }
  function eligible() {
    var bc = document.querySelector('.tws-breadcrumbs'), nm = document.querySelector('.slot--article-name');
    var name = nm ? nm.textContent : '';
    return WATCH.test(bc ? bc.textContent : '') && !NOT.test(name);
  }
  function mount() {
    var a = current();
    if (!a) return;
    if (forArticle !== a.uid) { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; chosen = null; forArticle = a.uid; }
    if (box && document.body.contains(box)) return;
    var grp = document.querySelector('.brew--buy-button-group');
    if (!grp || !(LINK[a.nr] || eligible())) return;
    loadInfo(function () {
      if (!info || box) return;
      var b = build(!!LINK[a.nr]);
      if (!b) return;
      box = b; grp.parentNode.insertBefore(box, grp);
    });
  }
  // Efter att valen lagts i varukorgen: nollställ, så att nästa Köp-tryck inte lägger till dem igen
  document.addEventListener('prydligt:extras-added', function () {
    chosen = null;
    if (box) { var all = box.querySelectorAll('.p-addon__row'); for (var k = 0; k < all.length; k++) { all[k].classList.remove('on'); all[k].setAttribute('aria-checked', 'false'); } }
  });
  // Läses av köpknappslogiken (förlängd garanti) när kunden trycker Köp
  window.prydligtAddonSelected = function () { return box && document.body.contains(box) ? chosen : null; };
  function start() { mount(); window.prydligtEvery(mount, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();


/* ===================================================================
   11. PRODUKTSIDAN: tillägg – smycken (och herrarmband) på klocksidor,
       "Komplettera looken" (andra smyckestyper i samma färgton) på smyckessidor
   - Damklockor: "Matcha med ett smycke" – Céleste-förslag.
   - Herrklockor: "Komplettera köpet" – upp till 5 herrklockor (en per serie, aldrig
     samma serie som sidan) + 3 Céleste ("Till henne"). Rad med "Lägg till för X till – då blir
     frakten gratis" som räknas om när kunden väljer. Klockor som räcker till fri frakt visas först.
   - Svepbar rad med upp till 8 förslag (MAX).
   - Bara artiklar som finns i lager och går att köpa visas (slutsålda döljs
     av Abicart och filtreras bort här). Färre än 2 kvar = ingen ruta alls.
   - Valda läggs i varukorgen när kunden trycker Köp (garantins köplogik).
   - Listorna är handplockade förslag; ringar exkluderas.
   =================================================================== */
(function () {
  'use strict';
  var JEWEL = 'K-8-16,K-15-6,K-15-9,K-15-11,K-51-10,K-51-15,K-66-3,K-17-10,K-16-16,K-50-14,K-27-7,K-51-3,K-16-12,K-12-11,K-64-2,K-15-10,K-50-6,K-49-14,K-31-14,K-7-2,K-30-18,K-21-10'.split(',');
  // Smyckessidor: förslag per färgton (ringar exkluderade)
  var GOLD_J = 'K-8-16,K-15-6,K-15-9,K-51-15,K-15-11,K-51-10,K-66-3,K-17-10,K-16-16,K-50-14,K-50-6,K-16-12,K-27-7,K-51-3,K-64-2,K-15-10,K-12-11,K-49-14,K-48-14,K-31-14,K-50-5,K-21-10,K-28-15,K-29-2,K-59-13,K-3-1,K-19-2,K-59-14,K-27-12,K-23-3,K-51-4,K-9-1,K-11-5,K-60-3,K-15-8,K-62-14,K-31-15,K-16-6,K-32-11,K-68-11,K-81-9,K-9-18,K-26-17,K-51-17,K-65-3'.split(',');
  var SILVER_J = 'K-48-2,K-31-8,K-44-3,K-47-17,K-48-4,K-25-17,K-25-10,K-19-3,K-40-11,K-23-12,K-12-17,K-25-11,K-18-7,K-19-16,K-26-1,K-40-1,K-47-15,K-19-17'.split(',');
  var JEWELPAGE = /smycken|smykker|korut|schmuck|sieraden|jewel|bijoux|bi[zż]uteria|joyas|gioielli|joias/i;
  // Herrklockor att föreslå
  var MENW = 'KOM-12,NIB-19,NIB-105,NIB-14,KOM-4,KOM-2,KOM-133,G-38-6,NIB-116,KOM-5,NIB-2,KOM-277,NIB-12,NIB-16,G-35-5,NIB-23,NIB-17,KOM-276,NIB-15,KOM-275,NIB-34,KOM-274,NIB-106,KOM-7,KOM-3,NIB-18,KOM-278'.split(',');
  // Fri frakt-gräns per språk (samma som leveransrutan, avsnitt 1)
  var FREE = window.PRYDLIGT_FREE;
  var SHIP = {
    sv: ['Lägg till för %s till – då blir frakten gratis', 'Fri frakt på köpet', 'Klocka'],
    nb: ['Legg til for %s til – da blir frakten gratis', 'Gratis frakt på kjøpet', 'Klokke'],
    da: ['Tilføj for %s mere – så er fragten gratis', 'Gratis fragt på købet', 'Ur'],
    fi: ['Lisää %s, niin toimitus on ilmainen', 'Ilmainen toimitus', 'Kello'],
    de: ['Noch %s hinzufügen – dann ist der Versand kostenlos', 'Kostenloser Versand', 'Uhr'],
    nl: ['Voeg nog %s toe – dan is de verzending gratis', 'Gratis verzending', 'Horloge'],
    en: [null, null, 'Watch'], fr: [null, null, 'Montre'], pl: [null, null, 'Zegarek'], es: [null, null, 'Reloj'], it: [null, null, 'Orologio'], pt: [null, null, 'Relógio']
  };
  SHIP.no = SHIP.nb;
  var MEN = 'Y-10-26,Y-10-28,Y-6-27,Y-6-34,Y-10-24,Y-1-5,Y-10-13,Y-4-36,Y-10-27,Y-8-21,Y-6-19,Y-1-15,Y-8-8,Y-1-1,Y-3-31,Y-5-1,Y-1-2,Y-2-5,Y-8-27,Y-9-14'.split(',');
  var WATCH = /klock|klokk|\bur\b|\bure\b|kello|uhr|horlog|watch|montre|zegar|reloj|orolog|rel[oó]gi/i;
  var WOMEN = /dam|dame|naisten|women|ladies|femme|damsk|mujer|donna|senhora|mulher/i;
  var T = {
    sv: ['Matcha med ett smycke', 'Komplettera köpet', 'Läggs till när du trycker Köp', 'Till henne', 'Till dig', 'Komplettera looken'],
    nb: ['Match med et smykke', 'Fullfør kjøpet', 'Legges til når du trykker Kjøp', 'Til henne', 'Til deg', 'Fullfør looken'],
    da: ['Match med et smykke', 'Gør købet komplet', 'Tilføjes, når du trykker Køb', 'Til hende', 'Til dig', 'Gør looket komplet'],
    fi: ['Viimeistele korulla', 'Täydennä ostoksesi', 'Lisätään, kun painat Osta', 'Hänelle', 'Sinulle', 'Viimeistele tyyli'],
    de: ['Passend dazu: Schmuck', 'Ergänze deinen Kauf', 'Wird beim Klick auf Kaufen hinzugefügt', 'Für sie', 'Für dich', 'Vervollständige den Look'],
    nl: ['Combineer met een sieraad', 'Maak je aankoop compleet', 'Wordt toegevoegd als je op Kopen drukt', 'Voor haar', 'Voor jou', 'Maak de look compleet'],
    en: ['Match it with jewellery', 'Complete your order', 'Added when you tap Buy', 'For her', 'For you', 'Complete the look'],
    fr: ['Assortissez avec un bijou', 'Complétez votre achat', 'Ajouté lorsque vous appuyez sur Acheter', 'Pour elle', 'Pour vous', 'Complétez le look'],
    pl: ['Dopasuj biżuterię', 'Uzupełnij zamówienie', 'Dodane po kliknięciu Kup', 'Dla niej', 'Dla ciebie', 'Dopełnij stylizację'],
    es: ['Combínalo con una joya', 'Completa tu compra', 'Se añade al pulsar Comprar', 'Para ella', 'Para ti', 'Completa el look'],
    it: ['Abbinalo a un gioiello', 'Completa il tuo acquisto', 'Aggiunto quando premi Acquista', 'Per lei', 'Per te', 'Completa il look'],
    pt: ['Combine com uma joia', 'Complete a sua compra', 'Adicionado ao tocar em Comprar', 'Para ela', 'Para si', 'Complete o look']
  };
  T.no = T.nb;
  var LOC = { sv: 'sv-SE', nb: 'nb-NO', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI', de: 'de-DE', nl: 'nl-NL', en: 'en-GB', fr: 'fr-FR', pl: 'pl-PL', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };
  var MAX = 8;   // antal förslag i den svepbara raden
  // Damklockor att föreslå (används av fri frakt-fyllaren i kassan)
  var WOMENW = 'LOR-63,LOR-117,LOR-66,LOR-71,LOR-79,LOR-74,LOR-87,LOR-64,LOR-83,LOR-120,LOR-75,LOR-72,LOR-129,LOR-121,LOR-67,LOR-185,LOR-137,NIB-179,LOR-139,LOR-160,LOR-118,LOR-84,LOR-225,LOR-224,LOR-85,LOR-161,LOR-193,LOR-80,LOR-186,NIB-176'.split(',');
  window.prydligtLists = { JEWEL: JEWEL, MENW: MENW, WOMENW: WOMENW, GOLD_J: GOLD_J, SILVER_J: SILVER_J };
  var box = null, forArticle = null, loading = false, picked = {};

  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function lang() { return (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2); }
  function rpc(method, params) {
    var st = store();
    if (!st || !window.twsCore || typeof window.twsCore.twapiFromState !== 'function') return Promise.reject(new Error('no api'));
    return Promise.resolve(window.twsCore.twapiFromState(st)(method).apply(null, params));
  }
  function money(v) {
    var st = store(), c = (st && st.currency) || 'SEK';
    try { return new Intl.NumberFormat(LOC[lang()] || 'sv-SE', { style: 'currency', currency: c, minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v); }
    catch (e) { return v + ' ' + c; }
  }
  var TYPE = {
    sv: { Earrings: 'Örhängen', Earring: 'Örhänge', Necklace: 'Halsband', Pendant: 'Hänge', Bracelet: 'Armband', Bangle: 'Armring' },
    nb: { Earrings: 'Øreringer', Earring: 'Ørering', Necklace: 'Halskjede', Pendant: 'Anheng', Bracelet: 'Armbånd', Bangle: 'Armring' },
    da: { Earrings: 'Øreringe', Earring: 'Ørering', Necklace: 'Halskæde', Pendant: 'Vedhæng', Bracelet: 'Armbånd', Bangle: 'Armring' },
    fi: { Earrings: 'Korvakorut', Earring: 'Korvakoru', Necklace: 'Kaulakoru', Pendant: 'Riipus', Bracelet: 'Rannekoru', Bangle: 'Rannerengas' },
    de: { Earrings: 'Ohrringe', Earring: 'Ohrring', Necklace: 'Halskette', Pendant: 'Anhänger', Bracelet: 'Armband', Bangle: 'Armreif' },
    nl: { Earrings: 'Oorbellen', Earring: 'Oorbel', Necklace: 'Ketting', Pendant: 'Hanger', Bracelet: 'Armband', Bangle: 'Armband' }
  };
  TYPE.no = TYPE.nb;
  function short(n) {
    var x = String(n || '').replace(/^c[eé]l[eé]ste\s+/i, '').replace(/^tom cole\s+/i, '').replace(/\s+18k\s+gold$/i, '').replace(/\s+gold$/i, '');
    var map = TYPE[lang()];
    if (map) x = x.replace(/^(Earrings|Earring|Necklace|Pendant|Bracelet|Bangle)\b/, function (w) { return map[w] || w; });
    return x;
  }
  function current() {
    var st = store(); if (!st || !st.route || st.route.name !== 'article') return null;
    var uid = st.route.params && st.route.params.article;
    return st.articles && st.articles[uid] ? uid : null;
  }
  // Kortbild 300 px webp (~7–13 kB) i stället för originalet (0,5–1 MB)
  function thumb(u) { return window.prydligtImg(u, 300); }
  // Kvar till fri frakt i varukorgen just nu (Abicarts notis i sidhuvudet, annars varukorgens värde)
  function cartLeft(free) {
    if (typeof window.__pTestCartLeft === 'number') return window.__pTestCartLeft;
    var n = document.querySelector('.tws-free-shipping-notice');
    if (n) {
      if (n.querySelector('.tws-free-shipping-notice--cost-reached')) return 0;
      var num = (n.textContent || '').replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
      if (num) return Math.max(0, parseFloat(num[1].replace(',', '.')));
    }
    try { var c = store().order.costs.cart.incVat; if (typeof c === 'number') return Math.max(0, free - c); } catch (e) {}
    return free;
  }
  // Andel som återstår efter rabatter i korgen (t.ex. 10 % endast idag) – 1 om ingen rabatt
  function discRatio() {
    try { var c = store().order.costs, full = c.fullCartPrice && c.fullCartPrice.incVat; if (full > 0) return Math.max(0.5, Math.min(1, c.cart.incVat / full)); } catch (e) {}
    return 1;
  }
  function render(list, mode, gap0) {
    var women = mode !== 'men';
    var t = T[lang()] || T.sv, l = lang();
    var d = document.createElement('div'); d.className = 'p-match';
    var h = document.createElement('div'); h.className = 'p-match__h'; h.textContent = mode === 'look' ? t[5] : (mode === 'women' ? t[0] : t[1]);
    var s = document.createElement('div'); s.className = 'p-match__s'; s.textContent = t[2];
    var row = document.createElement('div'); row.className = 'p-match__row';
    // Fri frakt-rad (herrklockor): visas bara när det finns något kvar till gränsen
    var ship = null, shipTxt = null, shipBar = null, sh = SHIP[l] || [];
    var updShip = function () {
      if (!ship) return;
      var sum = 0; Object.keys(picked).forEach(function (k) { sum += picked[k] || 0; });
      var left = Math.ceil(gap0 - sum * discRatio());
      if (left > 0) shipTxt.innerHTML = sh[0].replace('%s', '<b>' + money(left) + '</b>');
      else shipTxt.innerHTML = '<b>✓ ' + sh[1] + '</b>';
      ship.classList.toggle('p-match__ship--ok', left <= 0);
      shipBar.style.width = Math.max(4, Math.min(100, Math.round((1 - Math.max(0, left) / FREE[l]) * 100))) + '%';
    };
    if (mode === 'men' && sh[0] && FREE[l] && gap0 > 0) {
      ship = document.createElement('div'); ship.className = 'p-match__ship';
      ship.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/></svg>';
      shipTxt = document.createElement('span'); ship.appendChild(shipTxt);
      var bw = document.createElement('div'); bw.className = 'p-match__bar'; shipBar = document.createElement('i'); bw.appendChild(shipBar);
      ship.appendChild(bw);
    }
    window.prydligtAddonMeta = window.prydligtAddonMeta || {};
    list.forEach(function (a, pos) {
      window.prydligtAddonMeta[String(a.articleNumber).toUpperCase()] = { position: pos + 1, price: a._p, source: mode === 'look' ? 'komplettera_looken' : (mode === 'women' ? 'matcha_smycke' : 'komplettera_kopet') };
      var c = document.createElement('div'); c.className = 'p-match__c'; c.setAttribute('data-nr', a.articleNumber);
      var nm = short(a.name[l] || a.name.sv || a.name.en);
      // Bild + namn öppnar snabbvyn (avsnitt 12), plus-knappen väljer direkt
      var view = document.createElement('button'); view.type = 'button'; view.className = 'p-match__view';
      var i = document.createElement('span'); i.className = 'p-match__img'; i.style.backgroundImage = 'url("' + thumb(a.images[0]) + '")';
      var n = document.createElement('span'); n.className = 'p-match__n'; n.textContent = nm;
      view.appendChild(i); view.appendChild(n);
      var f = document.createElement('span'); f.className = 'p-match__f';
      var pr = document.createElement('b'); pr.textContent = money(a._p);
      var plus = document.createElement('button'); plus.type = 'button'; plus.className = 'p-match__plus';
      plus.setAttribute('aria-pressed', 'false'); plus.setAttribute('aria-label', nm);
      f.appendChild(pr); f.appendChild(plus);
      if (!women) {
        var tag = document.createElement('span'); tag.className = 'p-match__tag';
        tag.textContent = a._w ? ((SHIP[l] || SHIP.sv)[2]) : (/^Y-/i.test(a.articleNumber) ? t[4] : t[3]);
        c.appendChild(tag);
      }
      c.appendChild(view); c.appendChild(f);
      var isOn = function () { return !!picked[a.articleNumber]; };
      var toggle = function () {
        var on = !isOn();
        c.classList.toggle('on', on); plus.setAttribute('aria-pressed', on ? 'true' : 'false');
        if (on) picked[a.articleNumber] = a._p; else delete picked[a.articleNumber];
        updShip();
      };
      plus.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
      view.addEventListener('click', function (e) {
        e.preventDefault();
        if (window.prydligtQuickView) window.prydligtQuickView({ nr: a.articleNumber, isOn: isOn, toggle: toggle });
        else toggle();
      });
      row.appendChild(c);
    });
    var wrap = document.createElement('div'); wrap.className = 'p-match__wrap';
    wrap.appendChild(row);
    if (list.length > 3) {
      ['prev', 'next'].forEach(function (dir) {
        var b = document.createElement('button'); b.type = 'button'; b.className = 'p-match__arr p-match__arr--' + dir;
        b.setAttribute('aria-label', dir === 'next' ? '›' : '‹');
        b.addEventListener('click', function () { row.scrollBy({ left: (dir === 'next' ? 1 : -1) * row.clientWidth * 0.8, behavior: 'smooth' }); });
        wrap.appendChild(b);
      });
      var upd = function () {
        wrap.classList.toggle('p-match--start', row.scrollLeft < 5);
        wrap.classList.toggle('p-match--end', row.scrollLeft + row.clientWidth > row.scrollWidth - 5);
      };
      row.addEventListener('scroll', upd, { passive: true }); setTimeout(upd, 50);
    }
    d.appendChild(h); if (ship) { d.appendChild(ship); updShip(); } d.appendChild(wrap); d.appendChild(s);
    return d;
  }
  function mount() {
    var uid = current();
    if (!uid) return;
    if (forArticle !== uid) { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; picked = {}; forArticle = uid; loading = false; }
    if (box || loading) return;
    var grp = document.querySelector('.brew--buy-button-group');
    var bc = document.querySelector('.tws-breadcrumbs');
    var bct = bc ? bc.textContent : '';
    if (!grp) return;
    var isWatch = WATCH.test(bct), isJewel = !isWatch && JEWELPAGE.test(bct);
    if (!isWatch && !isJewel) return;
    var women = WOMEN.test(bct);
    var nmEl = document.querySelector('.slot--article-name');
    var curName = nmEl ? nmEl.textContent : '';
    var curNr = (function () { var st2 = store(); var a = st2 && st2.articles && st2.articles[uid]; return a ? String(a.articleNumber || '').toUpperCase() : ''; })();
    var silver = /silver|argent|silber|zilver|hopea|s[oø]lv/i.test(curName);
    var pool = isWatch ? JEWEL.concat(women ? [] : MENW) : (silver ? SILVER_J : GOLD_J);
    var st = store(), cur = (st && st.currency) || 'SEK';
    loading = true;
    rpc('Article.list', [['articleNumber', 'name', 'price', 'images', 'isBuyable'], { filters: { articleNumber: { 'in': pool } }, limit: 60 }])
      .then(function (res) {
        if (forArticle !== uid) return;
        // Bara köpbara artiklar med bild och pris i rätt valuta; aldrig ringar (storlek krävs), aldrig produkten själv
        var ok = (res || []).filter(function (a) {
          var pr = a.price && a.price.current && a.price.current[cur];
          if (pr == null || a.isBuyable === false || !a.images || !a.images[0]) return false;
          if (String(a.articleNumber).toUpperCase() === curNr) return false;
          if (/\bring\b|\bringen\b|\bsormus|\bpierścion|\banillo|\banello|\banel\b/i.test(JSON.stringify(a.name))) return false;
          a._p = pr; return true;
        });
        var rank = function (list) { return list.map(function (nr) { return ok.filter(function (a) { return a.articleNumber.toUpperCase() === nr.toUpperCase(); })[0]; }).filter(Boolean); };
        // Typ av smycke: örhängen / halsband / armband (Bangle = armband, Pendant = halsband)
        var typeOf = function (name) {
          var n = String(name || '').toLowerCase();
          if (/earring|örhäng|ohrring/.test(n)) return 'earrings';
          if (/necklace|pendant|halsband|kette/.test(n)) return 'necklace';
          if (/bracelet|bangle|armband/.test(n)) return 'bracelet';
          if (/\bring\b/.test(n)) return 'ring';
          return n.split(' ')[1] || '';
        };
        var tA = function (a) { return typeOf(a.name.en || a.name.sv); };
        // Blanda typerna i listans ordning: örhängen, halsband, armband, örhängen, ... (hoppar över skipType)
        var varied = function (list, n, skipType) {
          var groups = [], idx = {};
          list.forEach(function (a) { var t = tA(a); if (t === skipType) return; if (!(t in idx)) { idx[t] = groups.length; groups.push([]); } groups[idx[t]].push(a); });
          var out = [];
          for (var round = 0; out.length < n; round++) {
            var added = false;
            for (var g = 0; g < groups.length && out.length < n; g++) if (groups[g][round]) { out.push(groups[g][round]); added = true; }
            if (!added) break;
          }
          return out;
        };
        var pick, mode, gap = 0;
        if (isJewel) {
          mode = 'look';
          pick = varied(rank(pool), MAX, typeOf(curName));
        } else {
          var j = rank(JEWEL), m = rank(MEN);
          mode = women ? 'women' : 'men';
          // Herrklockor: herrarmband först ("Till dig"), sedan smycken ("Till henne")
          if (women) pick = varied(j, MAX);
          else {
            // Herrklockor: en klocka per serie (två första orden i engelska namnet), inte sidans egen serie
            var serie = function (a) { return String((a.name && (a.name.en || a.name.sv)) || '').toLowerCase().split(/\s+/).slice(0, 2).join(' '); };
            var me = (st.articles && st.articles[uid]) || {};
            var seen = {}; seen[serie(me)] = 1;
            var w = rank(MENW).filter(function (a) { var k = serie(a); if (seen[k]) return false; seen[k] = 1; a._w = 1; return true; }).slice(0, 5);
            // Klockor som räcker till fri frakt först (i säljordning), sedan resten
            var mp = me.price && me.price.current && me.price.current[cur];
            var dr = discRatio();
            gap = FREE[lang()] && typeof mp === 'number' ? cartLeft(FREE[lang()]) - mp * dr : 0;
            if (gap > 0) w = w.filter(function (a) { return a._p * dr >= gap; }).concat(w.filter(function (a) { return a._p * dr < gap; }));
            pick = w.concat(varied(j, MAX - w.length > 3 ? 3 : MAX - w.length));
          }
        }
        if (pick.length < 2) return;                          // hellre ingen ruta än en halvtom
        var g = document.querySelector('.brew--buy-button-group');
        if (!g) return;
        box = render(pick, mode, gap);
        var addon = document.querySelector('.p-addon');
        if (addon && addon.parentNode === g.parentNode) g.parentNode.insertBefore(box, addon); else g.parentNode.insertBefore(box, g);
      }, function () {})
      .then(function () { loading = false; });
  }
  document.addEventListener('prydligt:extras-added', function () {
    picked = {};
    if (box) { var all = box.querySelectorAll('.p-match__c'); for (var k = 0; k < all.length; k++) { all[k].classList.remove('on'); var pb = all[k].querySelector('.p-match__plus'); if (pb) pb.setAttribute('aria-pressed', 'false'); } }
  });
  // Läses av köpknappslogiken (avsnittet om förlängd garanti) när kunden trycker Köp
  window.prydligtMatchSelected = function () {
    if (!box || !document.body.contains(box)) return null;
    var k = Object.keys(picked); return k.length ? k : null;
  };
  function start() { mount(); window.prydligtEvery(mount, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();


/* ===================================================================
   12. SNABBVY för tillägg på produktsidan (smycken, herrarmband, verktyg)
   Öppnas från bild/namn i tilläggsrutorna. Ruta nerifrån med bilder att svepa,
   namn, pris, mått/kort beskrivning och "Lägg till". Kunden stannar på klocksidan.
   window.prydligtQuickView({ nr, isOn(), toggle() })
   =================================================================== */
(function () {
  'use strict';
  var T = {
    sv: ['Lägg till', 'Tillagd – ta bort', 'Läggs i varukorgen när du trycker Köp', 'Visa produktsidan', 'Stäng', 'Ingår: Presentpåse i sammet'],
    nb: ['Legg til', 'Lagt til – fjern', 'Legges i handlekurven når du trykker Kjøp', 'Vis produktsiden', 'Lukk', 'Inkludert: Gavepose i fløyel'],
    da: ['Tilføj', 'Tilføjet – fjern', 'Lægges i kurven, når du trykker Køb', 'Vis produktsiden', 'Luk', 'Medfølger: Gavepose i fløjl'],
    fi: ['Lisää', 'Lisätty – poista', 'Lisätään ostoskoriin, kun painat Osta', 'Näytä tuotesivu', 'Sulje', 'Sisältyy: Samettinen lahjapussi'],
    de: ['Hinzufügen', 'Hinzugefügt – entfernen', 'Wird beim Klick auf Kaufen in den Warenkorb gelegt', 'Zur Produktseite', 'Schließen', 'Inklusive: Geschenkbeutel aus Samt'],
    nl: ['Toevoegen', 'Toegevoegd – verwijderen', 'Wordt toegevoegd als je op Kopen drukt', 'Bekijk productpagina', 'Sluiten', 'Inbegrepen: Fluwelen cadeauzakje'],
    en: ['Add', 'Added – remove', 'Added to your cart when you tap Buy', 'View product page', 'Close', 'Included: Velvet gift pouch'],
    fr: ['Ajouter', 'Ajouté – retirer', 'Ajouté au panier lorsque vous appuyez sur Acheter', 'Voir la page produit', 'Fermer', 'Inclus : Pochette cadeau en velours'],
    pl: ['Dodaj', 'Dodano – usuń', 'Dodane do koszyka po kliknięciu Kup', 'Zobacz stronę produktu', 'Zamknij', 'W zestawie: Aksamitny woreczek prezentowy'],
    es: ['Añadir', 'Añadido – quitar', 'Se añade a la cesta al pulsar Comprar', 'Ver la página del producto', 'Cerrar', 'Incluye: Bolsa de regalo de terciopelo'],
    it: ['Aggiungi', 'Aggiunto – rimuovi', 'Aggiunto al carrello quando premi Acquista', 'Vedi la pagina del prodotto', 'Chiudi', 'Incluso: Sacchetto regalo in velluto'],
    pt: ['Adicionar', 'Adicionado – remover', 'Adicionado ao carrinho ao tocar em Comprar', 'Ver página do produto', 'Fechar', 'Inclui: Bolsa de oferta em veludo']
  };
  T.no = T.nb;
  var LOC = { sv: 'sv-SE', nb: 'nb-NO', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI', de: 'de-DE', nl: 'nl-NL', en: 'en-GB', fr: 'fr-FR', pl: 'pl-PL', es: 'es-ES', it: 'it-IT', pt: 'pt-PT' };
  var cache = {}, el = null, lastFocus = null;

  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function lang() { return (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2); }
  function cur() { var st = store(); return (st && st.currency) || 'SEK'; }
  function money(v) {
    try { return new Intl.NumberFormat(LOC[lang()] || 'sv-SE', { style: 'currency', currency: cur(), minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v); }
    catch (e) { return v + ' ' + cur(); }
  }
  function rpc(method, params) {
    var st = store();
    if (!st || !window.twsCore || typeof window.twsCore.twapiFromState !== 'function') return Promise.reject(new Error('no api'));
    return Promise.resolve(window.twsCore.twapiFromState(st)(method).apply(null, params));
  }
  function load(nr) {
    if (cache[nr]) return Promise.resolve(cache[nr]);
    return rpc('Article.list', [['articleNumber', 'name', 'price', 'images', 'introductionText', 'description', 'url'], { filters: { articleNumber: { 'in': [nr] } }, limit: 1 }])
      .then(function (r) { var a = r && r[0]; if (a) cache[nr] = a; return a; });
  }
  function pick(obj) { if (!obj) return ''; var l = lang(); return obj[l] || obj[l === 'nb' ? 'no' : l] || obj.sv || obj.en || ''; }
  // Kort text: måttrader från inledande texten + första stycket i beskrivningen som handlar om
  // just produkten (hoppar över den generella varumärkestexten)
  function details(a) {
    var out = [], tmp = document.createElement('div');
    tmp.innerHTML = pick(a.introductionText);
    var ps = tmp.querySelectorAll('p');
    for (var i = 0; i < ps.length; i++) { var x = ps[i].textContent.trim(); if (x) out.push({ html: ps[i].innerHTML }); }
    // Beskrivningen är ofta vanlig text med tomrader mellan styckena (ibland <p>/<br>)
    var raw = String(pick(a.description) || '').replace(/<\/p>|<br\s*\/?>\s*<br\s*\/?>/gi, '\n\n');
    var blocks = raw.split(/\r?\n\s*\r?\n/), chosen = '';
    var GENERIC = /(c[eé]l[eé]ste paris|v[aä]lkommen|welcome|willkommen|velkommen|tervetuloa|welkom|varje smycke|alla smycken|auktoriserad|authori[sz]ed|autoris|originalbox|original box)/i;
    for (var k = 0; k < blocks.length && chosen.length < 200; k++) {
      tmp.innerHTML = blocks[k];
      var tx = tmp.textContent.replace(/\s+/g, ' ').trim();
      if (tx.length < 40 || GENERIC.test(tx)) continue;
      chosen += (chosen ? ' ' : '') + tx;
    }
    if (chosen.length > 320) chosen = chosen.slice(0, 300).replace(/\s+\S*$/, '') + '…';
    return { facts: out, text: chosen };
  }
  function close() {
    if (!el) return;
    el.classList.remove('p-qv--in');
    var e = el; el = null;
    setTimeout(function () { if (e.parentNode) e.parentNode.removeChild(e); }, 220);
    document.documentElement.classList.remove('p-qv-open');
    document.removeEventListener('keydown', onKey);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function onKey(e) { if (e.key === 'Escape') close(); }
  function open(opt) {
    close();
    try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'addon_quickview', addon_sku: opt.nr }); } catch (e) {}
    lastFocus = document.activeElement;
    var t = T[lang()] || T.sv;
    el = document.createElement('div'); el.className = 'p-qv';
    el.innerHTML = '<div class="p-qv__bg"></div><div class="p-qv__box" role="dialog" aria-modal="true" tabindex="-1">' +
      '<button type="button" class="p-qv__x"></button><div class="p-qv__body"><div class="p-qv__load"></div></div></div>';
    el.querySelector('.p-qv__x').setAttribute('aria-label', t[4]);
    document.body.appendChild(el);
    document.documentElement.classList.add('p-qv-open');
    requestAnimationFrame(function () { if (el) el.classList.add('p-qv--in'); });
    el.querySelector('.p-qv__bg').addEventListener('click', close);
    el.querySelector('.p-qv__x').addEventListener('click', close);
    document.addEventListener('keydown', onKey);
    var me = el;
    load(opt.nr).then(function (a) {
      if (el !== me) return;
      if (!a) { close(); return; }
      var body = el.querySelector('.p-qv__body'); body.innerHTML = '';
      var imgs = (a.images || []).slice(0, 8);
      var gal = document.createElement('div'); gal.className = 'p-qv__gal';
      imgs.forEach(function (src) { var im = document.createElement('img'); im.src = window.prydligtImg(src, 800, 75); im.alt = ''; im.loading = 'lazy'; gal.appendChild(im); });
      body.appendChild(gal);
      if (imgs.length > 1) {
        var dots = document.createElement('div'); dots.className = 'p-qv__dots';
        imgs.forEach(function (x, i) { var d = document.createElement('i'); if (!i) d.className = 'on'; dots.appendChild(d); });
        body.appendChild(dots);
        gal.addEventListener('scroll', function () {
          var i = Math.round(gal.scrollLeft / gal.clientWidth), ds = dots.children;
          for (var k = 0; k < ds.length; k++) ds[k].className = k === i ? 'on' : '';
        }, { passive: true });
      }
      var h = document.createElement('h3'); h.className = 'p-qv__name'; h.textContent = pick(a.name); body.appendChild(h);
      var pr = a.price && a.price.current && a.price.current[cur()];
      if (pr != null) { var pe = document.createElement('div'); pe.className = 'p-qv__price'; pe.textContent = money(pr); body.appendChild(pe); }
      var d = details(a);
      d.facts.forEach(function (f) { var p = document.createElement('p'); p.className = 'p-qv__fact'; p.innerHTML = f.html; body.appendChild(p); });
      if (/c[eé]l[eé]ste/i.test(pick(a.name))) { var g = document.createElement('p'); g.className = 'p-qv__fact p-qv__gift'; g.textContent = t[5]; body.appendChild(g); }
      if (d.text) { var tx = document.createElement('p'); tx.className = 'p-qv__text'; tx.textContent = d.text; body.appendChild(tx); }
      var btn = document.createElement('button'); btn.type = 'button'; btn.className = 'p-qv__add';
      var paint = function () { var on = opt.isOn(); btn.textContent = on ? t[1] : t[0]; btn.classList.toggle('on', on); };
      paint();
      btn.addEventListener('click', function () { var was = opt.isOn(); opt.toggle(); paint(); if (!was) setTimeout(close, 450); });
      body.appendChild(btn);
      var note = document.createElement('p'); note.className = 'p-qv__note'; note.textContent = t[2]; body.appendChild(note);
      var u = pick(a.url);
      if (u) { var lk = document.createElement('a'); lk.className = 'p-qv__link'; lk.href = u; lk.textContent = t[3]; body.appendChild(lk); }
      el.querySelector('.p-qv__box').focus();
    }, function () { close(); });
  }
  window.prydligtQuickView = open;
})();


/* ===================================================================
   13. PRODUKTSIDAN: "Finns i fler färger" – runda bilder på andra färger i samma serie
   Serierna byggs varje natt av GitHub (tools/build-colors.mjs → colors.json) från katalogen,
   grupperade på namn utan färgord, så nya färger kommer med automatiskt. Inget sparas hos besökaren.
   Går colors.json inte att hämta visas ingen färgruta.
   Bara varianter som går att köpa visas; finns ingen annan än produkten själv visas inget.
   Ett tryck öppnar den färgens produktsida.
   =================================================================== */
(function () {
  'use strict';
  var MAP = {};   // tom: serierna kommer från colors.json

  /* --- Aktuella serier: colors.json byggs varje natt i GitHub (tools/build-colors.mjs) --- */
  var DYN = null;
  function loadGroups() {
    fetch('https://cdn.jsdelivr.net/gh/Prydligt/prydligt-theme@main/colors.json', { cache: 'no-cache' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j || !j.groups || j.groups.length < 50) return;
        var m = {};
        j.groups.forEach(function (list) { list.forEach(function (nr) { m[String(nr).toUpperCase()] = list; }); });
        DYN = m;
      }, function () {});
  }
  var T = { sv: 'Finns i fler färger', nb: 'Finnes i flere farger', da: 'Findes i flere farver', fi: 'Saatavilla myös muissa väreissä', de: 'Auch in weiteren Farben', nl: 'Ook in andere kleuren', en: 'Also available in', fr: 'Disponible en d’autres couleurs', pl: 'Dostępne w innych kolorach', es: 'Disponible en otros colores', it: 'Disponibile in altri colori', pt: 'Disponível noutras cores' };
  T.no = T.nb;
  var box = null, forArticle = null, loading = false, usedKey = '';

  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function lang() { return (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2); }
  function pick(o) { if (!o) return ''; var l = lang(); return o[l] || o[l === 'nb' ? 'no' : l] || o.sv || o.en || ''; }
  function rpc(method, params) {
    var st = store();
    if (!st || !window.twsCore || typeof window.twsCore.twapiFromState !== 'function') return Promise.reject(new Error('no api'));
    return Promise.resolve(window.twsCore.twapiFromState(st)(method).apply(null, params));
  }
  function current() {
    var st = store(); if (!st || !st.route || st.route.name !== 'article') return null;
    var uid = st.route.params && st.route.params.article;
    var a = st.articles && st.articles[uid];
    return a ? { uid: uid, nr: String(a.articleNumber || '').trim().toUpperCase() } : null;
  }
  // Färgdelen av namnet = det som skiljer det från de andra i serien
  function colorLabels(list) {
    var words = list.map(function (a) { return String(a.name.en || a.name.sv || '').split(/\s+/); });
    var n = 0, first = words[0];
    while (n < first.length && words.every(function (w) { return w[n] === first[n]; })) n++;
    return list.map(function (a, i) { var rest = words[i].slice(n).join(' ').replace(/^[\/\-\s]+/, ''); return rest || String(a.name.en || a.name.sv); });
  }
  function mount() {
    var a = current();
    if (!a) return;
    var want = ((DYN && DYN[a.nr]) || MAP[a.nr] || []).join(',');
    if (forArticle !== a.uid || (box && want !== usedKey && !loading)) { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; forArticle = a.uid; loading = false; }
    if (box || loading) return;
    var group = (DYN && DYN[a.nr]) || MAP[a.nr];
    var anchor = document.querySelector('.brew--article-choices-wrapper') || document.querySelector('.brew--buy-button-group');
    if (!group || !anchor) return;
    usedKey = group.join(',');
    loading = true;
    rpc('Article.list', [['articleNumber', 'name', 'images', 'url', 'isBuyable'], { filters: { articleNumber: { 'in': group } }, limit: 30 }])
      .then(function (res) {
        if (forArticle !== a.uid) return;
        var byNr = {};
        (res || []).forEach(function (x) { byNr[String(x.articleNumber).trim().toUpperCase()] = x; });
        // Seriens ordning, produkten själv alltid med; andra bara om de går att köpa och har bild
        var list = group.map(function (nr) { return byNr[nr.toUpperCase()]; }).filter(function (x) {
          if (!x || !x.images || !x.images[0]) return false;
          var me = String(x.articleNumber).trim().toUpperCase() === a.nr;
          return me || x.isBuyable !== false;
        });
        if (list.length < 2) return;
        var labels = colorLabels(list);
        var d = document.createElement('div'); d.className = 'p-colors';
        var head = document.createElement('div'); head.className = 'p-colors__h';
        var curIdx = 0;
        list.forEach(function (x, i) { if (String(x.articleNumber).trim().toUpperCase() === a.nr) curIdx = i; });
        var t1 = document.createElement('span'); t1.textContent = (T[lang()] || T.sv) + ': ';
        var t2 = document.createElement('b'); t2.textContent = labels[curIdx];
        head.appendChild(t1); head.appendChild(t2);
        var row = document.createElement('div'); row.className = 'p-colors__row';
        list.forEach(function (x, i) {
          var me = i === curIdx;
          var el = document.createElement(me ? 'span' : 'a');
          el.className = 'p-colors__sw' + (me ? ' on' : '');
          el.title = labels[i]; el.setAttribute('aria-label', labels[i]);
          if (!me) el.href = pick(x.url);
          el.style.backgroundImage = 'url("' + window.prydligtImg(x.images[0], 120) + '")';
          if (!me) {
            el.addEventListener('mouseenter', function () { t2.textContent = labels[i]; });
            el.addEventListener('mouseleave', function () { t2.textContent = labels[curIdx]; });
            el.addEventListener('click', function () { try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: 'color_variant_click', from_sku: a.nr, to_sku: x.articleNumber }); } catch (e) {} });
          }
          row.appendChild(el);
        });
        d.appendChild(head); d.appendChild(row);
        var anc = document.querySelector('.brew--article-choices-wrapper') || document.querySelector('.brew--buy-button-group');
        if (!anc) return;
        box = d; anc.parentNode.insertBefore(box, anc);
      }, function () {})
      .then(function () { loading = false; });
  }
  function start() { loadGroups(); mount(); window.prydligtEvery(mount, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();


/* ===================================================================
   14. KASSAN: fri frakt-fyllare
   "Lägg till för 204 kr till – då blir frakten gratis" + 2–3 varor som var för sig räcker.
   - Visas bara när det fattas något till fri frakt och minst 2 relevanta varor räcker hela vägen.
   - Golv per valuta (FLOOR): inga billiga utfyllnadsvaror – den tappade fraktavgiften ska
     täckas med råge. Hellre ingen ruta än ett förslag som inte lönar sig.
   - Relevans: herrklocka i korgen → herrklockor + Céleste, damklocka → damklockor + Céleste,
     bara smycken → smycken i samma färgton + damklockor, annat → klockor + Céleste.
   - Ett tryck lägger varan i ordern direkt (kunden lämnar aldrig kassan).
   =================================================================== */
(function () {
  'use strict';
  var FREE = window.PRYDLIGT_FREE;
  var FLOOR = { SEK: 130, NOK: 130, DKK: 90, EUR: 13 };
  var T = {
    sv: ['Lägg till för %s till – då blir frakten gratis', 'Lägg till', 'Lägger till…', 'Tillagd ✓'],
    nb: ['Legg til for %s til – da blir frakten gratis', 'Legg til', 'Legger til…', 'Lagt til ✓'],
    da: ['Tilføj for %s mere – så er fragten gratis', 'Tilføj', 'Tilføjer…', 'Tilføjet ✓'],
    fi: ['Lisää %s, niin toimitus on ilmainen', 'Lisää', 'Lisätään…', 'Lisätty ✓'],
    de: ['Noch %s hinzufügen – dann ist der Versand kostenlos', 'Hinzufügen', 'Wird hinzugefügt…', 'Hinzugefügt ✓'],
    nl: ['Voeg nog %s toe – dan is de verzending gratis', 'Toevoegen', 'Bezig…', 'Toegevoegd ✓']
  };
  T.no = T.nb;
  var LOC = { sv: 'sv-SE', nb: 'nb-NO', no: 'nb-NO', da: 'da-DK', fi: 'fi-FI', de: 'de-DE', nl: 'nl-NL' };
  var WATCH_NR = /^(KOM|NIB|LOR|G|BA|BB|E|MF|A|SH|SD)-/i;
  var MEN_URL = /herr|herre|miesten|herren|heren|\/men/i;
  var box = null, key = '', loading = false, cache = {};

  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function lang() { return (document.documentElement.getAttribute('lang') || 'sv').toLowerCase().slice(0, 2); }
  function rpc(method, params) {
    var st = store();
    if (!st || !window.twsCore || typeof window.twsCore.twapiFromState !== 'function') return Promise.reject(new Error('no api'));
    return Promise.resolve(window.twsCore.twapiFromState(st)(method).apply(null, params));
  }
  function money(v, c) {
    try { return new Intl.NumberFormat(LOC[lang()] || 'sv-SE', { style: 'currency', currency: c, minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(v); }
    catch (e) { return v + ' ' + c; }
  }
  function track(ev, extra) { try { window.dataLayer = window.dataLayer || []; var o = { event: ev, addon_source: 'kassa_fri_frakt' }; for (var k in extra) o[k] = extra[k]; window.dataLayer.push(o); } catch (e) {} }
  function remove() { if (box && box.parentNode) box.parentNode.removeChild(box); box = null; }

  function mount() {
    if (!document.body || !document.body.classList.contains('checkout')) { remove(); return; }
    var st = store(), l = lang(), t = T[l], free = FREE[l], L = window.prydligtLists;
    if (!st || !st.order || !t || !free || !L) { remove(); return; }
    var cur = st.order.currency || st.currency || 'SEK', floor = FLOOR[cur];
    var cart = st.order.costs && st.order.costs.cart && st.order.costs.cart.incVat;
    var items = st.order.items || [];
    if (!floor || typeof cart !== 'number' || !items.length) { remove(); return; }
    // Rabatter i korgen (t.ex. "10 % endast idag") gäller även tillägget – räkna med samma andel,
    // annars kan ett förslag som "räcker" hamna under gränsen efter rabatten.
    var full = st.order.costs.fullCartPrice && st.order.costs.fullCartPrice.incVat;
    var ratio = full > 0 ? Math.max(0.5, Math.min(1, cart / full)) : 1;
    var whole = cur !== 'EUR';
    var gap = whole ? Math.ceil(free - cart) : Math.ceil((free - cart) * 100) / 100;
    if (gap <= 0) { remove(); return; }
    // Relevans utifrån korgen
    var cartSeries = {}, inCart = {}, hasMen = false, hasWatch = false, hasJewel = false, silver = false;
    items.forEach(function (it) {
      var a = it.article || {}, nr = String(a.articleNumber || it.articleNumber || '').toUpperCase();
      inCart[nr] = 1;
      var url = (a.url && (a.url[l] || a.url.sv || a.url.en)) || '';
      if (WATCH_NR.test(nr)) { hasWatch = true; if (MEN_URL.test(url)) hasMen = true; }
      if (/^K-/.test(nr)) hasJewel = true;
      var nm0 = a.name && (a.name.en || a.name.sv || a.name[l]);
      if (nm0) cartSeries[String(nm0).toLowerCase().split(/\s+/).slice(0, 2).join(' ')] = 1;
      if (/silver|argent|silber|zilver|hopea|s[oø]lv/i.test(JSON.stringify(a.name || ''))) silver = true;
    });
    var pool = hasWatch ? (hasMen ? L.MENW : L.WOMENW).concat(L.JEWEL)
      : hasJewel ? (silver ? L.SILVER_J : L.GOLD_J).concat(L.WOMENW)
      : L.MENW.concat(L.WOMENW, L.JEWEL);
    // Reserv när gapet är stort (t.ex. Norge): dyrare klockor/smartklockor som ensamma räcker.
    var BIG = ['X-1-25','X-1-26','X-1-27','X-1-28','C-2-6','XX-47-2','XX-47-4','XX-47-4-steel','FF-9-4','BB-3-11','P-5-1']
      .concat(hasMen ? L.MENW : hasWatch ? L.WOMENW : L.MENW.concat(L.WOMENW))
      .filter(function (n, i, arr) { return pool.indexOf(n) < 0 && arr.indexOf(n) === i; });
    var all = pool.concat(BIG);
    var k = [cur, Math.round(gap), ratio.toFixed(3), Object.keys(inCart).sort().join(','), hasMen ? 'm' : '', silver ? 's' : ''].join('|');
    var anchor = null, slots = document.querySelectorAll('.slot--checkout-cart-summary');
    for (var i = 0; i < slots.length; i++) if (slots[i].offsetParent !== null) { anchor = slots[i]; break; }
    if (!anchor) return;
    var after = anchor.querySelector('.p-cart-free');
    if (box && key === k) { if (box.parentNode !== anchor) anchor.insertBefore(box, after ? after.nextSibling : anchor.firstChild); return; }
    if (loading) return;
    loading = true;
    var ck = all.join(',');
    var get = cache[ck] ? Promise.resolve(cache[ck]) :
      rpc('Article.list', [['articleNumber', 'name', 'price', 'images', 'isBuyable'], { filters: { articleNumber: { 'in': all } }, limit: 200 }])
        .then(function (r) { cache[ck] = r || []; return cache[ck]; });
    get.then(function (res) {
      var by = {};
      res.forEach(function (a) { by[String(a.articleNumber).toUpperCase()] = a; });
      var need = Math.max(gap, floor), seen = {}, pick = [];
      for (var cs in cartSeries) seen[cs] = 1;   // inte samma modell i annan färg
      function price(nr) { var a = by[nr.toUpperCase()]; return a && a.price && a.price.current && a.price.current[cur]; }
      // Först de relevanta förslagen i ordning, sedan reserven – billigast som räcker först (minst överskott).
      var order = pool.concat(BIG.filter(function (n) { return typeof price(n) === 'number'; })
        .sort(function (x, y) { return price(x) - price(y); }));
      order.forEach(function (nr) {
        var a = by[nr.toUpperCase()];
        if (!a || pick.length >= 3 || inCart[nr.toUpperCase()] || a.isBuyable === false || !a.images || !a.images[0]) return;
        var pr = a.price && a.price.current && a.price.current[cur];
        if (typeof pr !== 'number' || pr * ratio < need) return;
        if (/\bring\b|\bsormus|\banillo|\banello/i.test(JSON.stringify(a.name))) return;
        var n = String((a.name && (a.name.en || a.name.sv)) || '').toLowerCase().split(/\s+/).slice(0, 2).join(' ');
        if (seen[n]) return; seen[n] = 1;
        pick.push({ nr: a.articleNumber, name: (a.name && (a.name[l] || a.name.sv || a.name.en)) || a.articleNumber, price: pr, img: a.images[0] });
      });
      remove(); key = k;
      if (pick.length < 2) return;
      box = document.createElement('div'); box.className = 'p-fill';
      var h = document.createElement('div'); h.className = 'p-fill__h';
      h.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17.5" cy="17.5" r="1.6"/></svg>';
      var ht = document.createElement('span'); ht.innerHTML = t[0].replace('%s', '<b>' + money(gap, cur) + '</b>'); h.appendChild(ht);
      var bar = document.createElement('div'); bar.className = 'p-fill__bar';
      var bi = document.createElement('i'); bi.style.width = Math.max(4, Math.min(100, Math.round((1 - gap / free) * 100))) + '%'; bar.appendChild(bi);
      box.appendChild(h); box.appendChild(bar);
      pick.forEach(function (x, pos) {
        var row = document.createElement('div'); row.className = 'p-fill__r';
        var im = document.createElement('span'); im.className = 'p-fill__i'; im.style.backgroundImage = 'url("' + window.prydligtImg(x.img, 120) + '")';
        var tx = document.createElement('span'); tx.className = 'p-fill__t';
        var nm = document.createElement('span'); nm.textContent = x.name;
        var pr = document.createElement('b'); pr.textContent = money(x.price, cur);
        tx.appendChild(nm); tx.appendChild(pr);
        var b = document.createElement('button'); b.type = 'button'; b.className = 'p-fill__b'; b.textContent = '+ ' + t[1];
        b.addEventListener('click', function () {
          if (b.disabled || !window.prydligtAddToOrder) return;
          b.disabled = true; b.textContent = t[2];
          window.prydligtAddToOrder(x.nr).then(function () {
            b.textContent = t[3];
            track('addon_added', { addon_type: WATCH_NR.test(x.nr) ? 'klocka' : 'smycke', addon_sku: x.nr, addon_value: x.price, addon_currency: cur, addon_position: pos + 1, addon_page: 'kassa', main_sku: null });
            // Abicart räknar inte om fraktvalet (och betalningen, t.ex. Klarna) när ordern ändras utanför
            // kassans egna knappar. Ladda om kassan så att frakt, summa och betalning stämmer med ordern.
            setTimeout(function () { window.location.reload(); }, 400);
          }, function () { b.disabled = false; b.textContent = '+ ' + t[1]; });
        });
        row.appendChild(im); row.appendChild(tx); row.appendChild(b);
        box.appendChild(row);
      });
      anchor.insertBefore(box, after ? after.nextSibling : anchor.firstChild);
      track('freeship_filler_view', { gap: gap, currency: cur, items: pick.length });
    }, function () {}).then(function () { loading = false; });
  }
  function start() { mount(); window.prydligtEvery(mount, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
