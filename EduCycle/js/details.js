'use strict';

/* Resource Details: request status and action sit directly under the title */
(function () {
  const el = (id) => document.getElementById(id);

  function estimateLine(state, r) {
    const i = impactOf(state, r.category, r.quantity);
    return `Reusing this saves about <strong>${formatINR(i.money)}</strong> and <strong>${i.co2} kg</strong> of CO₂ <span class="sub">(estimated)</span>`;
  }

  /** The block under the title: the user's request status, or the action to request it. */
  function requestBlock(state, r) {
    const logged = isLoggedIn(state);

    if (logged && r.ownerId === state.currentUser.id) {
      return `<p class="mb-2 fw-semibold">This is your listing.</p>
        <a class="btn btn-outline-eco btn-sm" href="list-resource.html?edit=${r.id}">Edit listing</a>
        <a class="btn btn-link btn-sm" href="my-listings.html">My listings</a>`;
    }

    const mine = logged ? latestRequestFor(state, r.id) : null;
    if (mine && [...OPEN_STATUSES, 'Completed'].includes(mine.status)) {
      return `<h2 class="block-title">Your request</h2>
        ${exchangeMeta(state, mine)}
        <div class="stepper-wrap">${stepper(mine.status)}</div>
        ${mine.status !== 'Completed' ? '<a class="link-arrow d-inline-block mt-3" href="activity.html?tab=waiting">Open in Activity →</a>' : ''}`;
    }

    if (r.status !== 'Available') {
      return `<p class="mb-1">${statusDot(r.status)}</p>
        <p class="text-muted mb-2">This resource is not open for new requests right now.</p>
        <a class="link-arrow" href="request-board.html">Post a request instead →</a>`;
    }

    const note = mine && ['Rejected', 'Cancelled'].includes(mine.status)
      ? `<p class="text-muted small mb-3">${esc(requestStatusText(state, mine))}. You can request it again.</p>` : '';
    return `${note}<div class="request-action">
        <button id="requestBtn" class="btn btn-eco btn-lg" type="button">Request this resource</button>
        <span class="estimate">${estimateLine(state, r)}</span></div>`;
  }

  function detailHTML(state, r) {
    return `
      <p class="kicker">${esc(r.category)}</p>
      <h1>${esc(r.name)}</h1>
      <div class="detail-line">${typeTag(r.type)}${statusDot(r.status)}<span>Listed by ${esc(r.ownerName)} · ${formatDate(r.createdAt)}</span></div>
      <section class="request-block" id="requestArea" aria-label="Request">${requestBlock(state, r)}</section>
      <p class="lead-text">${esc(r.description)}</p>
      <h2 class="block-title">Details</h2>
      <dl class="meta-list wide">
        <div><dt>Condition</dt><dd>${esc(r.condition)}</dd></div>
        <div><dt>Quantity</dt><dd>${esc(r.quantity)}</dd></div>
        <div><dt>Pick-up</dt><dd>${esc(r.location)}</dd></div>
        <div><dt>Suited for</dt><dd>${esc(r.department)} · Semester ${esc(r.semester)}</dd></div>
      </dl>
      <button class="btn btn-link text-muted btn-sm px-0 mt-3" id="reportBtn" type="button">Report this listing</button>`;
  }

  function renderMore(state, r) {
    const others = sortListings(state.resources.filter((x) => x.id !== r.id && x.status === 'Available'));
    const same = others.filter((x) => x.category === r.category);
    const list = (same.length >= 3 ? same : same.concat(others.filter((x) => x.category !== r.category))).slice(0, 3);
    el('moreSection').classList.toggle('d-none', list.length === 0);
    el('moreList').innerHTML = list.map((x) => listingRow(x)).join('');
  }

  function bindActions(state, r) {
    const area = el('requestArea');

    area.addEventListener('click', (e) => {
      if (!e.target.closest('#requestBtn')) return;
      if (!requireLogin(state)) return;
      el('requestResourceName').textContent = r.name;
      bootstrap.Modal.getOrCreateInstance(el('requestModal')).show();
    });

    el('confirmRequest').addEventListener('click', () => {
      addRequest(state, r, el('requestMessage').value.trim());
      bootstrap.Modal.getOrCreateInstance(el('requestModal')).hide();
      el('requestMessage').value = '';
      area.innerHTML = requestBlock(state, r);
      showToast(`Request sent to ${r.ownerName}.`);
    });

    el('reportBtn').addEventListener('click', () => {
      if (!requireLogin(state)) return;
      bootstrap.Modal.getOrCreateInstance(el('reportModal')).show();
    });

    el('confirmReport').addEventListener('click', () => {
      const reason = el('reportReason');
      if (!setFieldState(reason, reason.value ? '' : 'Please choose a reason.')) return;
      bootstrap.Modal.getOrCreateInstance(el('reportModal')).hide();
      reason.value = '';
      clearValidation(el('reportForm'));
      showToast('Thanks. Your report was sent for review.');
    });
  }

  PAGES.details = (state) => {
    const root = el('detailRoot');
    const resource = state.resources.find((r) => r.id === Number(getParam('id')));
    if (!resource) {
      root.innerHTML = `<div class="empty-state"><h1 class="h4">Resource not found</h1>
        <p>It may have been removed by its owner.</p><a class="btn btn-eco" href="browse.html">Back to Browse</a></div>`;
      el('moreSection').classList.add('d-none');
      return;
    }
    document.title = `${resource.name} | EduCycle`;
    el('crumbName').textContent = resource.name;
    root.innerHTML = detailHTML(state, resource);
    renderMore(state, resource);
    bindActions(state, resource);
  };
})();
