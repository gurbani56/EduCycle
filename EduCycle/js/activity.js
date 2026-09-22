'use strict';

/* Activity: every exchange you are part of, grouped by what needs to happen next */
(function () {
  const el = (id) => document.getElementById(id);
  const ACTIONS = {
    accept: { status: 'Accepted', message: 'Request accepted. The item is now reserved.' },
    reject: { status: 'Rejected', message: 'Request declined.' },
    handover: { status: 'Handed Over', message: 'Marked as handed over.' },
    complete: { status: 'Completed', message: 'Exchange completed.' },
    cancel: { status: 'Cancelled', message: 'Request cancelled.' }
  };
  let current = 'needs';

  function actionButtons(req, isOwner) {
    const btn = (action, label, cls) => `<button class="btn btn-sm ${cls}" type="button" data-action="${action}" data-id="${req.id}">${label}</button>`;
    if (isOwner) {
      if (req.status === 'Pending') return btn('accept', 'Accept', 'btn-eco') + btn('reject', 'Decline', 'btn-outline-eco');
      if (req.status === 'Accepted') return btn('handover', 'Mark handed over', 'btn-eco');
      if (req.status === 'Handed Over') return btn('complete', 'Mark completed', 'btn-eco');
    } else if (req.status === 'Pending') {
      return btn('cancel', 'Cancel request', 'btn-outline-eco');
    }
    return '';
  }

  function exchangeRow(state, req) {
    const isOwner = req.ownerId === state.currentUser.id;
    const exists = state.resources.some((r) => r.id === req.resourceId);
    const title = exists
      ? `<a href="resource-details.html?id=${req.resourceId}">${esc(req.resourceName)}</a>`
      : `<span class="deleted-title">${esc(req.resourceName)}</span>`;
    return `
      <article class="xchg">
        <div class="xchg-main">
          <div class="xchg-title">${title}${typeTag(req.type)}</div>
          ${exchangeMeta(state, req)}
        </div>
        <div class="xchg-track">${stepper(req.status)}</div>
        <div class="xchg-actions">${actionButtons(req, isOwner)}</div>
      </article>`;
  }

  function groups(state) {
    const uid = state.currentUser.id;
    const open = (r) => OPEN_STATUSES.includes(r.status);
    const byDate = (a, b) => b.date.localeCompare(a.date) || b.id - a.id;
    return {
      needs: state.requests.filter((r) => r.ownerId === uid && open(r)).sort(byDate),
      waiting: state.requests.filter((r) => r.requesterId === uid && open(r)).sort(byDate),
      history: state.requests.filter((r) => (r.ownerId === uid || r.requesterId === uid) && ['Completed', 'Rejected', 'Cancelled'].includes(r.status)).sort(byDate)
    };
  }

  function renderSummary(state) {
    const total = calcImpact(state);
    el('impactLine').innerHTML = total.count
      ? `<span><strong>${total.count}</strong> ${total.count === 1 ? 'exchange' : 'exchanges'} completed</span>
         <span><strong>${formatINR(total.money)}</strong> saved</span>
         <span><strong>${total.co2} kg</strong> CO₂ avoided <span class="sub">(estimated)</span></span>`
      : '<span>Complete an exchange to see how much you have saved.</span>';
  }

  function render(state) {
    const g = groups(state);
    el('activityTabs').querySelectorAll('button').forEach((btn) => {
      const key = btn.dataset.tab;
      btn.classList.toggle('active', key === current);
      btn.setAttribute('aria-selected', String(key === current));
      btn.querySelector('.n').textContent = g[key].length;
      btn.classList.toggle('has-alert', key === 'needs' && g.needs.length > 0);
    });
    const items = g[current];
    el('activityList').innerHTML = items.map((r) => exchangeRow(state, r)).join('');
    el('activityList').classList.toggle('d-none', items.length === 0);
    Object.keys(g).forEach((key) => el('empty-' + key).classList.toggle('d-none', key !== current || items.length > 0));
    renderSummary(state);
  }

  PAGES.activity = (state) => {
    if (!requireLogin(state)) return;
    const g = groups(state);
    const fromUrl = getParam('tab');
    current = ['needs', 'waiting', 'history'].includes(fromUrl) ? fromUrl : (g.needs.length ? 'needs' : 'waiting');

    el('activityTabs').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-tab]');
      if (btn) { current = btn.dataset.tab; render(state); }
    });
    el('activityList').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = ACTIONS[btn.dataset.action];
      const result = setRequestStatus(state, Number(btn.dataset.id), action.status);
      if (!result.ok) { showToast(result.message, 'error'); return; }
      render(state);
      renderNavbar(state);
      showToast(action.message);
    });
    render(state);
  };
})();
