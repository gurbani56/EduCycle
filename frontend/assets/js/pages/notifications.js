/* Notification centre with read/unread state. */
EC.page(async () => {
  const { $, $$, esc } = EC;
  const icons = { request: 'bi-arrow-left-right', location: 'bi-geo-alt', grievance: 'bi-flag', board: 'bi-megaphone', resource: 'bi-box-seam', account: 'bi-person' };
  const state = { unread: false, page: 1 };
  // Only follow links that point at our own pages.
  const safeLink = (l) => (/^[a-z0-9-]+\.html(\?[\w=&%.-]*)?$/i.test(l || '') ? l : '');

  async function load() {
    $('#list').innerHTML = EC.loadingBlock();
    try {
      const data = await EC.api(`/notifications?page=${state.page}${state.unread ? '&unread=true' : ''}`);
      $('#unreadCount').textContent = data.unreadCount;
      $('#unreadCount').classList.toggle('attn', data.unreadCount > 0);
      $('#readAll').disabled = !data.unreadCount;
      if (!data.items.length) {
        $('#list').innerHTML = EC.state({ icon: 'bi-bell', title: state.unread ? 'You are all caught up' : 'No notifications yet', text: 'You will be notified here when someone responds to your requests, suggestions or grievances.' });
      } else {
        $('#list').innerHTML = `<div class="table-wrap">${data.items.map((n) => {
          const link = safeLink(n.link);
          return `
          <div class="notif${n.read ? '' : ' unread'}">
            <span class="ico"><i class="bi ${icons[n.type] || 'bi-bell'}" aria-hidden="true"></i></span>
            <div class="flex-grow-1 min-w-0">
              <p class="notif-title">${link ? `<a class="text-reset" href="${esc(link)}" data-open="${n.id}">${esc(n.title)}</a>` : esc(n.title)}</p>
              ${n.body ? `<p class="small mb-1">${esc(n.body)}</p>` : ''}
              <span class="meta">${EC.timeAgo(n.createdAt)}</span>
            </div>
            <button class="btn btn-link btn-sm align-self-start" type="button" data-toggle="${n.id}" data-read="${n.read}">${n.read ? 'Mark unread' : 'Mark read'}</button>
          </div>`;
        }).join('')}</div>`;
      }
      EC.renderPagination($('#pager'), data.pagination, (n) => { state.page = n; load(); });
      EC.refreshBell();
    } catch (err) { $('#list').innerHTML = EC.errorState(err, 'retry'); $('#retry').addEventListener('click', load); }
  }

  $('#tabs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-unread]'); if (!b) return;
    state.unread = b.dataset.unread === 'true'; state.page = 1;
    $$('#tabs .nav-link').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-selected', x === b); });
    load();
  });
  $('#list').addEventListener('click', async (e) => {
    const t = e.target.closest('[data-toggle]');
    const o = e.target.closest('[data-open]');
    if (t) {
      await EC.api(`/notifications/${t.dataset.toggle}/read`, { method: 'PATCH', body: { read: t.dataset.read !== 'true' } }).catch((err) => EC.toast(err.message, { error: true }));
      load();
    }
    if (o) {
      e.preventDefault();
      try { await EC.api(`/notifications/${o.dataset.open}/read`, { method: 'PATCH', body: { read: true } }); } catch (_) { /* still navigate */ }
      location.href = o.getAttribute('href');
    }
  });
  $('#readAll').addEventListener('click', async () => {
    try { await EC.api('/notifications/read-all', { method: 'PATCH' }); EC.toast('All notifications marked as read.'); load(); } catch (err) { EC.toast(err.message, { error: true }); }
  });

  load();
});
