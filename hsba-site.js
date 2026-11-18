/*
  HSBA site script

  Loaded on every page of hsba.org. The file is kept in this repository so the people who run
  the site can see the custom code that runs on it. The parts it hides are in hsba-site.css,
  which the page loads with its own tag.

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
    is read from the page's own data when it is there. Otherwise it is read once from that page
    (one GET) and kept for the browser tab (sessionStorage).

  If anything here fails, the page shows as it does without this script, except for the parts
  hidden by hsba-site.css. (If this script does not run, the card's Account Snapshot list
  stays hidden.)
*/
(function () {
  if (window.__hsbaSite) return;
  window.__hsbaSite = true;

  var SETTINGS = {
    JD_FIELD_ID: '1d5ca75a-fb83-44a1-855d-0376b703be36', // "JD Number" custom field
    JD_PAGE: '/my-account/pages/personal-information',
    JD_LABEL: 'JD Number',
    STATUS_LABEL: 'Membership Status',
    HIDDEN_SNAPSHOT_LINES: ['Member Number', 'Account Credit'], // card lines, by the text before ":"
    STORAGE_KEY: 'hsbaSiteJdNumber' // sessionStorage key: {user, jdNumber}
  };

  function cleanText(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
  }

  // The member's traits: the queued identify call, else the loaded library.
  function memberTraits() {
    var analytics = window.analytics;
    if (Array.isArray(analytics)) {
      for (var index = 0; index < analytics.length; index++) {
        var queuedCall = Array.prototype.slice.call(analytics[index] || []);
        if (queuedCall[0] === 'identify') {
          var traits = queuedCall.slice(1).filter(function (argument) {
            return argument && typeof argument === 'object';
          })[0];
          if (traits) return traits;
        }
      }
    }
    try {
      if (analytics && typeof analytics.user === 'function') return analytics.user().traits() || null;
    } catch (error) {}
    return null;
  }

  // The JD number from a page's Livewire data (the HTML as sent), or '' if not there.
  function jdNumberFrom(page) {
    var components = page.querySelectorAll('[wire\\:initial-data]');
    for (var index = 0; index < components.length; index++) {
      try {
        var data = JSON.parse(components[index].getAttribute('wire:initial-data')).serverMemo.data;
        var value = data && data.customFormData && data.customFormData[SETTINGS.JD_FIELD_ID];
        if (value != null) return cleanText(value);
      } catch (error) {}
    }
    return '';
  }

  // The JD number on this page. Once Livewire has started, it removes the data from the HTML,
  // so its running components are read as well.
  function jdNumberOnThisPage() {
    var fromHtml = jdNumberFrom(document);
    if (fromHtml) return fromHtml;
    try {
      var components = window.Livewire && typeof window.Livewire.all === 'function' ? window.Livewire.all() : [];
      for (var index = 0; index < components.length; index++) {
        var value = components[index].get('customFormData.' + SETTINGS.JD_FIELD_ID);
        if (value != null && cleanText(value)) return cleanText(value);
      }
    } catch (error) {}
    return '';
  }

  function storedJdNumber(userId) {
    try {
      var saved = JSON.parse(sessionStorage.getItem(SETTINGS.STORAGE_KEY) || 'null');
      return saved && saved.user === userId ? saved.jdNumber : null;
    } catch (error) {
      return null;
    }
  }

  function storeJdNumber(userId, jdNumber) {
    try {
      sessionStorage.setItem(SETTINGS.STORAGE_KEY, JSON.stringify({ user: userId, jdNumber: jdNumber }));
    } catch (error) {}
  }

  function getJdNumber(userId, done) {
    var onThisPage = jdNumberOnThisPage();
    if (onThisPage) {
      storeJdNumber(userId, onThisPage);
      return done(onThisPage);
    }
    var stored = storedJdNumber(userId);
    if (stored !== null) return done(stored);
    fetch(SETTINGS.JD_PAGE, { credentials: 'same-origin' })
      .then(function (response) {
        return response.ok ? response.text() : '';
      })
      .then(function (html) {
        if (!html) return done(''); // not kept, so the next page tries again
        var jdNumber = jdNumberFrom(new DOMParser().parseFromString(html, 'text/html'));
        storeJdNumber(userId, jdNumber);
        done(jdNumber);
      })
      .catch(function () {
        done('');
      });
  }

  // The card's Account Snapshot.
  function updateSnapshot(traits) {
    var heading = Array.prototype.filter.call(document.querySelectorAll('.card h6'), function (element) {
      return /account snapshot/i.test(element.textContent);
    })[0];
    var list = heading && heading.parentElement.querySelector('ul');
    if (!list || list.getAttribute('data-hsba')) return;
    list.setAttribute('data-hsba', '1');

    Array.prototype.forEach.call(list.children, function (item) {
      var lineName = cleanText(item.textContent).split(':')[0];
      if (SETTINGS.HIDDEN_SNAPSHOT_LINES.indexOf(lineName) >= 0) item.style.display = 'none';
    });

    function addLine(label, value) {
      var item = document.createElement('li');
      item.appendChild(document.createTextNode(label + ': '));
      var valueElement = document.createElement('span');
      valueElement.className = 'font-semibold';
      valueElement.textContent = value;
      item.appendChild(valueElement);
      list.appendChild(item);
      return valueElement;
    }

    if (!traits) return; // no member data: only the hidden lines
    var membershipStatus = cleanText(traits.primary_membership_plan);
    var jdValue = addLine(SETTINGS.JD_LABEL, '…');
    if (membershipStatus) addLine(SETTINGS.STATUS_LABEL, membershipStatus);

    getJdNumber(String(traits.uuid || traits.id || ''), function (jdNumber) {
      if (jdNumber) jdValue.textContent = jdNumber;
      else jdValue.parentElement.style.display = 'none';
    });
  }

  function run() {
    updateSnapshot(memberTraits()); // guests have no card, so nothing happens
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
