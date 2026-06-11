/*!
 * Suppuo live chat widget — embeddable chat bubble that turns website
 * conversations into Suppuo tickets, riding entirely on the public
 * ticket API (/api/v1/public/tickets).
 *
 * Usage:
 *   <script src="https://suppuo.com/widget.js"
 *           data-suppuo-account="acc_..." async></script>
 *
 * Optional attributes:
 *   data-position="left"        bubble on the bottom-left (default: right)
 *   data-suppuo-base="https://suppuo.com"
 *                               API/brand origin override (default: the
 *                               origin this script was loaded from)
 *
 * Plain self-contained JS — no framework, no external CSS. State is one
 * accessToken in localStorage (`suppuo_widget_<accountId>`); the thread
 * is re-fetched from the API (polled every 10s while the panel is open).
 */
(function () {
  'use strict';

  // ── config from the <script> tag ──────────────────────────────────
  var script =
    document.currentScript ||
    document.querySelector('script[data-suppuo-account]');
  if (!script) return;

  var ACCOUNT_ID = script.getAttribute('data-suppuo-account');
  if (!ACCOUNT_ID) {
    console.warn('[suppuo-widget] missing data-suppuo-account attribute');
    return;
  }

  var POSITION = script.getAttribute('data-position') === 'left' ? 'left' : 'right';

  var BASE = script.getAttribute('data-suppuo-base') || '';
  if (!BASE && script.src) {
    try {
      BASE = new URL(script.src).origin;
    } catch (e) {
      /* old browser / opaque src */
    }
  }
  if (!BASE) BASE = window.location.origin;

  var API = BASE + '/api/v1/public';
  var STORAGE_KEY = 'suppuo_widget_' + ACCOUNT_ID;
  var POLL_MS = 10000;

  // Guard against double-embeds.
  if (document.getElementById('suppuo-widget-root')) return;

  // ── tiny helpers ───────────────────────────────────────────────────
  var BLUE = '#0080FF';
  var FONT =
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

  function el(tag, styles, attrs) {
    var node = document.createElement(tag);
    if (styles) css(node, styles);
    if (attrs) {
      for (var k in attrs) {
        if (k === 'text') node.textContent = attrs[k];
        else node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  function css(node, styles) {
    for (var k in styles) node.style[k] = styles[k];
    return node;
  }

  function getToken() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }
  function setToken(t) {
    try {
      if (t) localStorage.setItem(STORAGE_KEY, t);
      else localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      /* private mode — session-only widget still works via memory */
    }
    memToken = t;
  }
  var memToken = getToken();

  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    }).then(function (res) {
      return res.json().then(function (envelope) {
        if (!res.ok || envelope.error) {
          var err = new Error(
            (envelope.error && envelope.error.message) || 'Request failed',
          );
          err.status = res.status;
          throw err;
        }
        return envelope.data;
      });
    });
  }

  var STATUS_LABEL = {
    open: 'Open',
    pending: 'Waiting for you',
    resolved: 'Resolved',
    closed: 'Closed',
  };

  // ── DOM scaffold ───────────────────────────────────────────────────
  var root = el('div', null, { id: 'suppuo-widget-root' });

  var sideStyle = {};
  sideStyle[POSITION] = '20px';

  // Bubble button
  var bubble = el(
    'button',
    {
      position: 'fixed',
      bottom: '20px',
      width: '56px',
      height: '56px',
      borderRadius: '50%',
      border: 'none',
      background: BLUE,
      color: '#fff',
      cursor: 'pointer',
      boxShadow: '0 4px 14px rgba(0,0,0,0.25)',
      zIndex: '2147483000',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '0',
      transition: 'transform 0.15s ease',
    },
    { type: 'button', 'aria-label': 'Open support chat', 'aria-expanded': 'false' },
  );
  css(bubble, sideStyle);
  var CHAT_ICON =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>';
  var CLOSE_ICON =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  bubble.innerHTML = CHAT_ICON;
  bubble.onmouseenter = function () {
    bubble.style.transform = 'scale(1.06)';
  };
  bubble.onmouseleave = function () {
    bubble.style.transform = 'scale(1)';
  };

  // Panel
  var panel = el(
    'div',
    {
      position: 'fixed',
      bottom: '88px',
      width: '360px',
      maxWidth: 'calc(100vw - 32px)',
      height: '520px',
      maxHeight: 'calc(100vh - 110px)',
      background: '#fff',
      borderRadius: '14px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
      zIndex: '2147483000',
      display: 'none',
      flexDirection: 'column',
      overflow: 'hidden',
      fontFamily: FONT,
      fontSize: '14px',
      color: '#1a202c',
      textAlign: 'left',
    },
    { role: 'dialog', 'aria-label': 'Support chat' },
  );
  css(panel, sideStyle);

  // Header
  var header = el('div', {
    background: BLUE,
    color: '#fff',
    padding: '14px 16px',
    flexShrink: '0',
  });
  var headerTitle = el('div', { fontWeight: '700', fontSize: '15px' }, { text: 'Chat with us' });
  var headerSub = el('div', { fontSize: '12px', opacity: '0.85', marginTop: '2px' }, {
    text: 'We usually reply within a few hours',
  });
  header.appendChild(headerTitle);
  header.appendChild(headerSub);

  // Body (scrollable view area)
  var body = el('div', {
    flex: '1',
    overflowY: 'auto',
    padding: '14px',
    background: '#f7f9fc',
  });

  // Footer (composer area + powered-by)
  var footer = el('div', { flexShrink: '0', background: '#fff', borderTop: '1px solid #e6eaf0' });
  var composer = el('div', { padding: '10px 12px 6px' });
  var powered = el('div', {
    textAlign: 'center',
    padding: '4px 0 8px',
    fontSize: '11px',
    color: '#8a94a6',
  });
  var poweredLink = el(
    'a',
    { color: '#8a94a6', textDecoration: 'none', fontWeight: '600' },
    { href: BASE + '/?utm_source=widget', target: '_blank', rel: 'noopener', text: 'Suppuo' },
  );
  powered.appendChild(document.createTextNode('Powered by '));
  powered.appendChild(poweredLink);
  footer.appendChild(composer);
  footer.appendChild(powered);

  panel.appendChild(header);
  panel.appendChild(body);
  panel.appendChild(footer);
  root.appendChild(panel);
  root.appendChild(bubble);

  // ── shared input styling ───────────────────────────────────────────
  var INPUT_STYLE = {
    width: '100%',
    boxSizing: 'border-box',
    border: '1px solid #d7dde6',
    borderRadius: '8px',
    padding: '9px 10px',
    fontSize: '14px',
    fontFamily: FONT,
    color: '#1a202c',
    background: '#fff',
    outline: 'none',
  };
  var LABEL_STYLE = {
    display: 'block',
    fontSize: '12px',
    fontWeight: '600',
    color: '#4a5568',
    margin: '10px 0 4px',
  };

  function primaryButton(label) {
    return el(
      'button',
      {
        width: '100%',
        border: 'none',
        borderRadius: '8px',
        background: BLUE,
        color: '#fff',
        fontWeight: '700',
        fontSize: '14px',
        fontFamily: FONT,
        padding: '10px',
        cursor: 'pointer',
        marginTop: '12px',
      },
      { type: 'submit', text: label },
    );
  }

  // ── state ──────────────────────────────────────────────────────────
  var isOpen = false;
  var pollTimer = null;
  var sending = false;
  var lastMessageCount = -1;

  // ── view: first-open form ──────────────────────────────────────────
  function renderForm() {
    stopPolling();
    headerSub.textContent = 'We usually reply within a few hours';
    body.innerHTML = '';
    composer.innerHTML = '';
    lastMessageCount = -1;

    var intro = el(
      'p',
      { margin: '0 0 4px', fontSize: '13px', color: '#4a5568', lineHeight: '1.5' },
      { text: 'Hi! Leave us a message and we’ll get back to you — here and by email.' },
    );
    body.appendChild(intro);

    var form = el('form', null, { novalidate: 'novalidate' });

    var nameLabel = el('label', LABEL_STYLE, { for: 'suppuo-w-name', text: 'Name (optional)' });
    var nameInput = el('input', INPUT_STYLE, {
      id: 'suppuo-w-name',
      type: 'text',
      autocomplete: 'name',
      maxlength: '200',
    });

    var emailLabel = el('label', LABEL_STYLE, { for: 'suppuo-w-email', text: 'Email' });
    var emailInput = el('input', INPUT_STYLE, {
      id: 'suppuo-w-email',
      type: 'email',
      required: 'required',
      autocomplete: 'email',
      placeholder: 'you@example.com',
    });

    var msgLabel = el('label', LABEL_STYLE, { for: 'suppuo-w-msg', text: 'How can we help?' });
    var msgInput = el('textarea', INPUT_STYLE, {
      id: 'suppuo-w-msg',
      rows: '4',
      required: 'required',
      maxlength: '20000',
      placeholder: 'Type your message…',
    });
    css(msgInput, { resize: 'vertical', minHeight: '72px' });

    var errLine = el('p', {
      display: 'none',
      margin: '8px 0 0',
      fontSize: '12px',
      color: '#d33',
    });

    var submit = primaryButton('Start conversation');

    form.appendChild(nameLabel);
    form.appendChild(nameInput);
    form.appendChild(emailLabel);
    form.appendChild(emailInput);
    form.appendChild(msgLabel);
    form.appendChild(msgInput);
    form.appendChild(errLine);
    form.appendChild(submit);
    body.appendChild(form);

    form.onsubmit = function (e) {
      e.preventDefault();
      if (sending) return;
      var email = emailInput.value.trim();
      var message = msgInput.value.trim();
      errLine.style.display = 'none';
      if (!email || email.indexOf('@') < 1) {
        errLine.textContent = 'Please enter a valid email address.';
        errLine.style.display = 'block';
        emailInput.focus();
        return;
      }
      if (!message) {
        errLine.textContent = 'Please type a message.';
        errLine.style.display = 'block';
        msgInput.focus();
        return;
      }
      sending = true;
      submit.textContent = 'Sending…';
      submit.disabled = true;

      var firstLine = message.split('\n')[0];
      var subject = firstLine.length > 60 ? firstLine.slice(0, 57) + '…' : firstLine;

      api('/tickets', {
        method: 'POST',
        body: {
          accountId: ACCOUNT_ID,
          subject: subject,
          body: message,
          email: email,
          name: nameInput.value.trim() || undefined,
        },
      })
        .then(function (data) {
          setToken(data.accessToken);
          renderThread(true);
        })
        .catch(function (err) {
          errLine.textContent = err.message || 'Could not send — please try again.';
          errLine.style.display = 'block';
        })
        .then(function () {
          sending = false;
          submit.textContent = 'Start conversation';
          submit.disabled = false;
        });
    };

    setTimeout(function () {
      (nameInput.value ? msgInput : emailInput).focus();
    }, 50);
  }

  // ── view: thread ───────────────────────────────────────────────────
  function renderThread(focusReply) {
    body.innerHTML = '';
    composer.innerHTML = '';
    lastMessageCount = -1;

    var loading = el(
      'p',
      { margin: '0', fontSize: '13px', color: '#8a94a6' },
      { text: 'Loading conversation…' },
    );
    body.appendChild(loading);

    // Reply composer
    var form = el('form', { display: 'flex', gap: '8px', alignItems: 'flex-end' });
    var replyLabel = el(
      'label',
      {
        position: 'absolute',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clip: 'rect(0 0 0 0)',
        whiteSpace: 'nowrap',
      },
      { for: 'suppuo-w-reply', text: 'Your reply' },
    );
    var replyInput = el('textarea', INPUT_STYLE, {
      id: 'suppuo-w-reply',
      rows: '1',
      maxlength: '20000',
      placeholder: 'Write a reply…',
    });
    css(replyInput, { resize: 'none', minHeight: '38px', maxHeight: '110px', flex: '1' });
    var sendBtn = el(
      'button',
      {
        border: 'none',
        borderRadius: '8px',
        background: BLUE,
        color: '#fff',
        fontWeight: '700',
        fontSize: '13px',
        fontFamily: FONT,
        padding: '10px 14px',
        cursor: 'pointer',
        flexShrink: '0',
      },
      { type: 'submit', text: 'Send', 'aria-label': 'Send reply' },
    );
    form.appendChild(replyLabel);
    form.appendChild(replyInput);
    form.appendChild(sendBtn);
    composer.appendChild(form);

    // subtle "start over" link under the composer
    var reset = el(
      'button',
      {
        display: 'block',
        margin: '6px auto 0',
        border: 'none',
        background: 'none',
        color: '#8a94a6',
        fontSize: '11px',
        fontFamily: FONT,
        cursor: 'pointer',
        textDecoration: 'underline',
        padding: '0',
      },
      { type: 'button', text: 'Start a new conversation' },
    );
    reset.onclick = function () {
      setToken(null);
      renderForm();
    };
    composer.appendChild(reset);

    replyInput.onkeydown = function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        form.dispatchEvent(new Event('submit', { cancelable: true }));
      }
    };

    form.onsubmit = function (e) {
      e.preventDefault();
      var text = replyInput.value.trim();
      if (!text || sending) return;
      sending = true;
      sendBtn.disabled = true;
      sendBtn.textContent = '…';
      api('/tickets/' + memToken + '/messages', { method: 'POST', body: { body: text } })
        .then(function () {
          replyInput.value = '';
          return fetchThread();
        })
        .catch(function () {
          /* keep text in the box so nothing is lost */
        })
        .then(function () {
          sending = false;
          sendBtn.disabled = false;
          sendBtn.textContent = 'Send';
          replyInput.focus();
        });
    };

    fetchThread().then(function () {
      if (focusReply) replyInput.focus();
    });
    startPolling();
  }

  function fetchThread() {
    if (!memToken) return Promise.resolve();
    return api('/tickets/' + memToken)
      .then(function (ticket) {
        headerSub.textContent =
          'Ticket #' +
          ticket.number +
          ' · ' +
          (STATUS_LABEL[ticket.status] || ticket.status);
        drawMessages(ticket.messages || []);
      })
      .catch(function (err) {
        if (err && err.status === 404) {
          // Stale/revoked token — start fresh.
          setToken(null);
          renderForm();
        }
      });
  }

  function drawMessages(messages) {
    if (messages.length === lastMessageCount) return; // avoid scroll-jank on poll
    lastMessageCount = messages.length;
    body.innerHTML = '';
    var i, m;
    for (i = 0; i < messages.length; i++) {
      m = messages[i];
      var mine = m.authorType === 'requester';
      var row = el('div', {
        display: 'flex',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        marginBottom: '10px',
      });
      var stack = el('div', { maxWidth: '82%' });
      var bub = el('div', {
        background: mine ? BLUE : '#fff',
        color: mine ? '#fff' : '#1a202c',
        border: mine ? 'none' : '1px solid #e6eaf0',
        borderRadius: mine ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
        padding: '9px 12px',
        fontSize: '13px',
        lineHeight: '1.45',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      });
      bub.textContent = m.body; // textContent — never innerHTML for user data
      var meta = el('div', {
        fontSize: '10px',
        color: '#8a94a6',
        marginTop: '3px',
        textAlign: mine ? 'right' : 'left',
      });
      var when = '';
      try {
        when = new Date(m.createdAt).toLocaleString();
      } catch (e) {
        /* noop */
      }
      meta.textContent = (mine ? 'You' : m.authorName || 'Support') + (when ? ' · ' + when : '');
      stack.appendChild(bub);
      stack.appendChild(meta);
      row.appendChild(stack);
      body.appendChild(row);
    }
    body.scrollTop = body.scrollHeight;
  }

  // ── polling ────────────────────────────────────────────────────────
  function startPolling() {
    stopPolling();
    pollTimer = setInterval(function () {
      if (isOpen && memToken) fetchThread();
    }, POLL_MS);
  }
  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  }

  // ── open/close ─────────────────────────────────────────────────────
  function openPanel() {
    isOpen = true;
    panel.style.display = 'flex';
    bubble.innerHTML = CLOSE_ICON;
    bubble.setAttribute('aria-label', 'Close support chat');
    bubble.setAttribute('aria-expanded', 'true');
    if (memToken) renderThread(false);
    else renderForm();
  }
  function closePanel() {
    isOpen = false;
    panel.style.display = 'none';
    bubble.innerHTML = CHAT_ICON;
    bubble.setAttribute('aria-label', 'Open support chat');
    bubble.setAttribute('aria-expanded', 'false');
    stopPolling();
  }
  bubble.onclick = function () {
    if (isOpen) closePanel();
    else openPanel();
  };
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) closePanel();
  });

  // ── mount ──────────────────────────────────────────────────────────
  function mount() {
    document.body.appendChild(root);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
