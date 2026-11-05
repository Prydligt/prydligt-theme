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

  function render(el) {
    var t = TEXT[lang()], s = state(), html;
    if (s.mode === 'today') {
      var h = Math.floor(s.left / 3600), m = Math.floor((s.left % 3600) / 60), sec = s.left % 60;
      var parts = (h > 0 ? h + '\u00a0' + t.h + ' ' : '') + m + '\u00a0' + t.m + ' ' + (sec < 10 ? '0' : '') + sec + '\u00a0' + t.s;
      html = t.pre + ' <strong class="p-ship-timer__time">' + parts + '</strong> \u2013 ' + t.today;
      if (lang() === 'fi') html = t.pre + ' <strong class="p-ship-timer__time">' + parts + '</strong> ' + t.today;
    } else if (s.mode === 'tomorrow') {
      html = t.next + ' <strong>' + t.tomorrow + '</strong>';
    } else {
      html = t.next + ' <strong>' + t.on + ' ' + t.days[s.day] + '</strong>';
    }
    html = '<span>' + html + '</span>';
    if (el.__last !== html) { el.innerHTML = html; el.__last = html; }
  }

  /* ---------- Placering på sidan ---------- */
  var timerEl = null;
  function inStock() {
    var msg = document.querySelector('.tws-article-stock-shipping--delivery-message');
    if (!msg) return false;
    return !HIDE_IF_STOCK_TEXT.test(msg.textContent || '');
  }
  function mount() {
    if (!document.body || !document.body.classList.contains('article')) return;
    var anchor = document.querySelector(ANCHOR);
    var ok = anchor && inStock();
    if (!ok) { if (timerEl && timerEl.parentNode) timerEl.parentNode.removeChild(timerEl); return; }
    if (!timerEl) {
      timerEl = document.createElement('div');
      timerEl.className = 'p-ship-timer';
      timerEl.setAttribute('aria-live', 'off');
    }
    if (timerEl.previousElementSibling !== anchor) anchor.insertAdjacentElement('afterend', timerEl);
    render(timerEl);
  }

  function start() {
    mount();
    setInterval(function () { mount(); }, 1000);   // uppdaterar sekunderna och klarar att Abicart byter sidinnehåll
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
 * STATUS: klar. Fyll i ART_UID (artikel-ID för de 32 garantiartiklarna) och sätt LIVE = true.
 * Tills dess visas modulen bara med ?garanti=1 i adressen.
 */
(function () {
  'use strict';

  /* ======================== INSTÄLLNINGAR ======================== */
  var LIVE = false;                     // sätt till true när addToCart är inkopplad
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

  /* --- Artikel-ID (uid) i Abicart för varje garantiartikel. Fylls i efter importen. --- */
  var ART_UID = {
    // 'GARANTI-1AR-A': 123456789,
  };

  /* --- Lägger en artikel i varukorgen via Abicarts eget API (Order.addArticle) --- */
  function store() { return window.twsReduxStore && window.twsReduxStore.getState ? window.twsReduxStore.getState() : null; }
  function rpc(method, params) {
    var st = store();
    if (!st || !st.host) return Promise.reject(new Error('Abicart-store saknas'));
    var q = { webshop: st.webshop && st.webshop.uid, auth: st.auth, session: st.session, language: st.language };
    var qs = Object.keys(q).map(function (k) { return k + '=' + (q[k] === null || q[k] === undefined ? '' : q[k]); }).join('&');
    return fetch('https://' + st.host + '?' + qs, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method: method, params: params })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j.error) throw j.error;
      return j.result;
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
  function addToCart(articleNumber, orderId) {
    if (window.prydligtAddArticle) return Promise.resolve(window.prydligtAddArticle(articleNumber, 1));
    var uid = ART_UID[articleNumber];
    if (!uid) { if (window.console) console.warn('[Prydligt garanti] uid saknas f\u00f6r', articleNumber); return Promise.resolve(); }
    return rpc('Order.addArticle', [orderId, uid, { quantity: 1 }, { uid: true }, { fastVerify: true }])
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
      el.querySelectorAll('.p-warranty__opt').forEach(function (o) {
        var on = o === b; o.classList.toggle('is-selected', on); o.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
    });
    return el;
  }

  function mount() {
    if (!document.body || !document.body.classList.contains('article') || !enabled()) return;
    var price = productPrice(), band = price && bandFor(price);
    var anchor = document.querySelector('.slot--unique-selling-points');
    if (!band || !anchor || !isWatch()) { if (box && box.parentNode) box.parentNode.removeChild(box); return; }
    if (!box || currentBand !== band) {
      if (box && box.parentNode) box.parentNode.removeChild(box);
      box = build(band); currentBand = band; selected = 0;
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
      addToCart(a, existing).then(pass, pass);
    } else {
      waitForOrder(8000).then(function (u) { if (u) addToCart(a, u); });
    }
  }, true);

  function start() { mount(); setInterval(mount, 1000); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();

  window.prydligtWarranty = { bands: BANDS, artNo: artNo, selected: function () { return selected; } };
})();
