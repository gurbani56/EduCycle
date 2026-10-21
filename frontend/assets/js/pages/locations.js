/* Pickup points: approved list, suggestion form and the student's own suggestions. */
EC.page(async ({ user }) => {
  const { $, esc } = EC;
  const isStudent = user && user.role === 'student';

  async function loadApproved() {
    $('#approved').innerHTML = EC.loadingBlock();
    try {
      const { items } = await EC.api('/locations');
      $('#approved').innerHTML = items.length
        ? `<div class="d-grid gap-3">${items.map((l) => `
            <div class="loc-card bg-surface">
              <span class="ico"><i class="bi bi-pin-map" aria-hidden="true"></i></span>
              <div class="min-w-0 flex-grow-1">
                <div class="d-flex flex-wrap justify-content-between gap-2"><h3 class="h5 mb-0">${esc(l.name)}</h3>${EC.locationStatusBadge(l)}</div>
                ${l.area ? `<div class="small text-muted">${esc(l.area)}</div>` : ''}
                ${l.description ? `<p class="small mb-0 mt-1">${esc(l.description)}</p>` : ''}
                <a class="small" href="browse.html?location=${esc(l.id)}">Resources at this point <i class="bi bi-arrow-right" aria-hidden="true"></i></a>
              </div>
            </div>`).join('')}</div>`
        : EC.state({ icon: 'bi-geo', title: 'No approved pickup points yet', text: 'An administrator has not approved any locations yet. Students can suggest one, and it appears here once approved.' });
    } catch (err) { $('#approved').innerHTML = EC.errorState(err); }
  }

  async function loadMine() {
    if (!isStudent) {
      $('#mine').innerHTML = user ? '<p class="small text-muted mb-0">Administrators manage locations in the dashboard.</p>'
        : `<p class="small text-muted mb-0"><a href="login.html?next=${encodeURIComponent('/locations.html')}">Log in</a> to see your suggestions.</p>`;
      return;
    }
    $('#mine').innerHTML = EC.loadingBlock();
    try {
      const { items } = await EC.api('/locations/mine');
      const focusId = EC.params().get('id');
      $('#mine').innerHTML = items.length
        ? `<ul class="list-unstyled mb-0 d-grid gap-3">${items.map((l) => `
            <li class="${focusId === l.id ? 'panel-muted' : ''}" id="loc-${esc(l.id)}">
              <div class="d-flex justify-content-between gap-2 flex-wrap"><strong>${esc(l.name)}</strong>${EC.locationStatusBadge(l)}</div>
              <div class="small text-muted">${esc(l.area)} · submitted ${EC.fmtDate(l.createdAt)}${l.reviewedAt ? ` · reviewed ${EC.fmtDate(l.reviewedAt)}` : ''}</div>
              ${l.status === 'Rejected' && l.rejectionReason ? `<div class="alert alert-danger small mt-2 mb-0 py-2"><i class="bi bi-info-circle" aria-hidden="true"></i><div><strong>Reason:</strong> ${esc(l.rejectionReason)}</div></div>` : ''}
              ${l.status === 'Pending' ? '<div class="small mt-1">Waiting for an administrator to review it. It cannot be used for exchanges yet.</div>' : ''}
              ${l.status === 'Approved' && l.active ? '<div class="small mt-1 text-success"><i class="bi bi-check2" aria-hidden="true"></i> Students can now choose this location.</div>' : ''}
            </li>`).join('')}</ul>`
        : '<p class="small text-muted mb-0">You have not suggested any locations yet.</p>';
    } catch (err) { $('#mine').innerHTML = EC.errorState(err); }
  }

  if (!isStudent) {
    $('#suggestBody').innerHTML = user
      ? '<p class="small text-muted mb-0">Administrators can add locations directly from the dashboard.</p>'
      : `<p class="small text-muted">Log in with your student account to suggest a location.</p><a class="btn btn-primary btn-sm" href="login.html?next=${encodeURIComponent('/locations.html')}">Log in</a>`;
  } else {
    EC.bindSuggestForm($('#suggestForm'), { onDone: loadMine });
  }

  loadApproved();
  loadMine();
});
