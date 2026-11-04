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
  var HIDE_IF_STOCK_TEXT = /slut|ej i lager|tillfälligt|beställningsvara|utsolgt|udsolgt|loppu|ausverkauft|uitverkocht/i;
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
    sv: { minus: 'Minska antal', plus: 'Öka antal', remove: 'Ta bort' },
    nb: { minus: 'Reduser antall', plus: 'Øk antall', remove: 'Fjern' },
    da: { minus: 'Formindsk antal', plus: 'Forøg antal', remove: 'Fjern' },
    fi: { minus: 'Vähennä', plus: 'Lisää', remove: 'Poista' },
    de: { minus: 'Menge verringern', plus: 'Menge erhöhen', remove: 'Entfernen' },
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
