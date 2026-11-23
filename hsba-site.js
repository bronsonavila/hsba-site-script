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
  - Login window: shows a note under the email field of the "Enter your email to sign in or
    create an account" step (what to do when the member cannot use the account email address). The note shows only while the window
    has exactly that text; on every other step of the window it is taken away.

  Where the data comes from:
  - Membership Status: the member's primary membership plan, from the traits the page gives
    analytics.identify(...) for the signed-in member. The page queues that call before the
    analytics library loads, so the queued call is read first; then analytics.user().traits().
    This also works when a browser blocks the analytics library.
    The traits are read when this file runs, and again when the page is ready. If they cannot
    be read then (the library is starting), the script tries again for up to 10 seconds.
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

  var LOGIN = {
    PROMPT: 'Enter your email to sign in or create an account', // the note shows only under this exact text
    PROMPT_SELECTOR: '.auth0-lock-form > div > p > span',
    NOTE_CLASS: 'hsba-login-note',
    // The note's parts, in order: [text, kind]. 'strong' is bold; 'nowrap' stays on one line.
    NOTE_PARTS: [
      ['No longer have access to your account email address?', 'strong'],
      [' For example, it was an email address at a firm you have left. Do not create a new account. Contact HSBA staff before you log in: '],
      ['ars@hsba.org', 'nowrap'],
      [' or '],
      ['808-537-1868', 'nowrap'],
      [' during regular business hours.']
    ]
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

  // The Login window. It is drawn and redrawn by the sign-in library, so the page is watched:
  // the note is put under the email field when the prompt has exactly the LOGIN.PROMPT text, and
  // taken away when it does not.
  // The prompt's text, with each line break read as a space. (innerText is not used: it reads
  // the line break only when the window is shown, and the window is filled before it is shown.)
  function promptText(prompt) {
    return cleanText(
      Array.prototype.map
        .call(prompt.childNodes, function (node) {
          return node.nodeName === 'BR' ? ' ' : node.textContent;
        })
        .join('')
    );
  }

  function updateLoginNote() {
    var prompt = document.querySelector(LOGIN.PROMPT_SELECTOR);
    var note = document.querySelector('.' + LOGIN.NOTE_CLASS);
    var paragraph = prompt && promptText(prompt) === LOGIN.PROMPT ? prompt.parentElement : null;
    if (!paragraph) {
      if (note) note.remove();
      return;
    }
    var container = paragraph.parentElement;
    if (note && note.parentElement === container && container.lastElementChild === note) return;
    if (!note) {
      note = document.createElement('div');
      note.className = LOGIN.NOTE_CLASS;
      LOGIN.NOTE_PARTS.forEach(function (part) {
        var element = part[1] ? document.createElement(part[1] === 'strong' ? 'strong' : 'span') : null;
        if (element) element.textContent = part[0];
        note.appendChild(element || document.createTextNode(part[0]));
      });
    }
    container.appendChild(note); // under the email field
  }

  function watchLoginWindow() {
    if (typeof MutationObserver !== 'function') return;
    var waiting = false;
    new MutationObserver(function () {
      if (waiting) return;
      waiting = true;
      setTimeout(function () {
        waiting = false;
        try {
          updateLoginNote();
        } catch (error) {}
      }, 50);
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }

  watchLoginWindow();

  // The traits as they are when this file runs. In <head>, that is before the analytics library
  // has loaded and taken the queued call away.
  var earlyTraits = memberTraits();
  var tries = 0;

  function hasData(traits) {
    return !!traits && Object.keys(traits).length > 0;
  }

  // While the analytics library starts, there is a short time when the queued call is gone and
  // the library is not ready, so the traits cannot be read. Then: try again (every 250 ms, for
  // 10 seconds at most) before the list is shown without the member's lines.
  function run() {
    if (!document.querySelector('aside .card h6')) return; // guests have no card
    var traits = hasData(earlyTraits) ? earlyTraits : memberTraits();
    if (!hasData(traits) && tries++ < 40) return setTimeout(run, 250);
    updateSnapshot(hasData(traits) ? traits : null);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
