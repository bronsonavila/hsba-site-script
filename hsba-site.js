/*
  HSBA site script

  Loaded on every page of hsba.org by one script tag in the site-wide footer. The file is kept
  in this repository so the people who run the site can see the custom code that runs on it.

  What it does:
  - Hides the account status label ("Active Member") and its dot in the header, the label in
    the account menu, and the label on the My Account card. The label shows the state of the
    website account, not the attorney's membership status.
  - My Account sidebar (desktop and mobile menu): hides "My Memberships & Subscriptions".
  - My Account card, "Account Snapshot": hides "Member Number" (the website's own account
    number, not the JD number) and "Account Credit". Shows "JD Number" and "Membership Status".

  Where the data comes from:
  - Membership Status: the member's primary membership plan, from the traits the page gives
    analytics.identify(...) for the signed-in member. The page queues that call before the
    analytics library loads, so the queued call is read first; then analytics.user().traits().
    This also works when a browser blocks the analytics library.
  - JD Number: the "JD Number" field on Account Settings > Personal Information. On that page it
    is in the page's own data. On other pages it is read once from that page (one GET) and kept
    for the browser tab (sessionStorage).

  If anything here fails, the page shows as it does without this script, except that the
  labels stay hidden (CSS only).
*/
(function () {
  if (window.__hsbaSite) return;
  window.__hsbaSite = true;

  var SETTINGS = {
    JD_FIELD: '1d5ca75a-fb83-44a1-855d-0376b703be36', // "JD Number" custom field
    JD_PAGE: '/my-account/pages/personal-information',
    JD_LABEL: 'JD Number',
    STATUS_LABEL: 'Membership Status',
    HIDE_SNAPSHOT: ['Member Number', 'Account Credit'], // card lines, by the text before ":"
    STORE: 'hsbaSiteJd' // sessionStorage key: {user, jd}
  };

  // 1. The labels and the dot, by their place in the page (their color changes with the state),
  //    and the sidebar link, by its address.
  var style = document.createElement('style');
  style.textContent =
    '.nav-account-status,' + // header
    '.nav-account-status-dot,' + // header: the dot on the avatar
    '.nav-account-menu__panel__inner > div > div.inline-flex,' + // account menu
    '.card .pt-16 > .flex-wrap.justify-center,' + // My Account card
    'li:has(> a[href$="/my-account/memberships-and-subscriptions"])' + // My Account sidebar
    '{display:none!important}' +
    '.card .pt-16:has(> .flex-wrap.justify-center){padding-top:3.5rem}';
  document.head.appendChild(style);

  function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }

  // The member's traits: the queued identify call, else the loaded library.
  function traits() {
    var a = window.analytics;
    if (Array.isArray(a)) {
      for (var i = 0; i < a.length; i++) {
        var call = Array.prototype.slice.call(a[i] || []);
        if (call[0] === 'identify') {
          var t = call.slice(1).filter(function (x) { return x && typeof x === 'object'; })[0];
          if (t) return t;
        }
      }
    }
    try { if (a && typeof a.user === 'function') return a.user().traits() || null; } catch (e) {}
    return null;
  }

  // The JD number from a page's Livewire data, or '' if not there.
  function jdFrom(root) {
    var els = root.querySelectorAll('[wire\\:initial-data]');
    for (var i = 0; i < els.length; i++) {
      try {
        var data = JSON.parse(els[i].getAttribute('wire:initial-data')).serverMemo.data;
        var v = data && data.customFormData && data.customFormData[SETTINGS.JD_FIELD];
        if (v != null) return clean(v);
      } catch (e) {}
    }
    return '';
  }

  function stored(user) {
    try {
      var s = JSON.parse(sessionStorage.getItem(SETTINGS.STORE) || 'null');
      return s && s.user === user ? s.jd : null;
    } catch (e) { return null; }
  }

  function store(user, jd) {
    try { sessionStorage.setItem(SETTINGS.STORE, JSON.stringify({ user: user, jd: jd })); } catch (e) {}
  }

  function getJd(user, done) {
    var here = jdFrom(document);
    if (here || location.pathname === SETTINGS.JD_PAGE) { store(user, here); return done(here); }
    var s = stored(user);
    if (s !== null) return done(s);
    fetch(SETTINGS.JD_PAGE, { credentials: 'same-origin' })
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (html) {
        var jd = html ? jdFrom(new DOMParser().parseFromString(html, 'text/html')) : '';
        store(user, jd);
        done(jd);
      })
      .catch(function () { done(''); });
  }

  // 2. The card's Account Snapshot.
  function snapshot(t) {
    var h = Array.prototype.filter.call(document.querySelectorAll('.card h6'), function (e) {
      return /account snapshot/i.test(e.textContent);
    })[0];
    var ul = h && h.parentElement.querySelector('ul');
    if (!ul || ul.getAttribute('data-hsba')) return;
    ul.setAttribute('data-hsba', '1');
    Array.prototype.forEach.call(ul.children, function (li) {
      var name = clean(li.textContent).split(':')[0];
      if (SETTINGS.HIDE_SNAPSHOT.indexOf(name) >= 0) li.style.display = 'none';
    });
    function line(label, value) {
      var li = document.createElement('li');
      li.appendChild(document.createTextNode(label + ': '));
      var b = document.createElement('span');
      b.className = 'font-semibold';
      b.textContent = value;
      li.appendChild(b);
      ul.appendChild(li);
      return b;
    }
    var status = clean(t && t.primary_membership_plan);
    var jdLine = line(SETTINGS.JD_LABEL, '…');
    if (status) line(SETTINGS.STATUS_LABEL, status);
    getJd(String(t && (t.uuid || t.id) || ''), function (jd) {
      if (jd) jdLine.textContent = jd;
      else jdLine.parentElement.style.display = 'none';
    });
  }

  function run() {
    var t = traits();
    if (!t) return; // guests: nothing to add
    snapshot(t);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
