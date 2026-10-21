/* Homepage: live showcase carousel, real statistics, categories and recent listings. */
EC.page(async () => {
  const { esc } = EC;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const [featured, stats, meta, recent] = await Promise.allSettled([
    EC.api('/resources/featured?limit=5'),
    EC.api('/stats'),
    EC.meta(),
    EC.api('/resources?limit=4&sort=newest'),
  ]);

  /* ---- Showcase carousel (real available listings) ---- */
  const body = EC.$('#showcaseBody');
  const items = featured.status === 'fulfilled' ? featured.value.items : [];
  if (!items.length) {
    body.innerHTML = `<div class="p-4 text-center">
      <div class="state-icon mx-auto mb-3" style="width:52px;height:52px;border-radius:50%;background:var(--ec-bg);display:flex;align-items:center;justify-content:center"><i class="bi bi-box-seam" aria-hidden="true"></i></div>
      <h3 class="h3">No listings yet</h3><p class="text-muted small mb-3">Be the first to share a textbook, calculator or lab kit with your campus.</p>
      <a class="btn btn-primary btn-sm" href="list-resource.html">List a resource</a></div>`;
  } else {
    body.innerHTML = `
      <div id="showcaseCarousel" class="carousel slide" ${reduceMotion ? '' : 'data-bs-ride="carousel" data-bs-interval="5500"'} data-bs-pause="hover" data-bs-touch="true">
        <div class="carousel-inner">
          ${items.map((r, i) => `
            <div class="carousel-item${i === 0 ? ' active' : ''}" role="group" aria-roledescription="slide" aria-label="${i + 1} of ${items.length}">
              <a class="text-decoration-none text-reset d-block" href="resource-details.html?id=${esc(r.id)}">
                <div class="showcase-media"><i class="bi ${EC.catIcon(r.category)}" aria-hidden="true"></i></div>
                <div class="d-flex gap-2 mb-2 flex-wrap">${EC.typeBadge(r.type)}<span class="badge-ec b-grey"><i class="bi ${EC.catIcon(r.category)}" aria-hidden="true"></i>${esc(r.category)}</span></div>
                <h3 class="h3 mb-1">${esc(r.title)}</h3>
                <p class="meta mb-0">${esc(r.condition)} · ${r.location && r.location.usable ? `<i class="bi bi-geo-alt" aria-hidden="true"></i> ${esc(r.location.name)}` : 'Pickup point awaiting approval'}</p>
              </a>
            </div>`).join('')}
        </div>
      </div>
      <div class="showcase-foot">
        <div class="carousel-indicators">${items.map((_, i) => `<button type="button" data-bs-target="#showcaseCarousel" data-bs-slide-to="${i}" ${i === 0 ? 'class="active" aria-current="true"' : ''} aria-label="Show listing ${i + 1}"></button>`).join('')}</div>
        <div class="d-flex gap-2">
          <button class="showcase-ctrl" type="button" data-bs-target="#showcaseCarousel" data-bs-slide="prev" aria-label="Previous listing"><i class="bi bi-chevron-left" aria-hidden="true"></i></button>
          <button class="showcase-ctrl" type="button" data-bs-target="#showcaseCarousel" data-bs-slide="next" aria-label="Next listing"><i class="bi bi-chevron-right" aria-hidden="true"></i></button>
        </div>
      </div>`;
    const el = EC.$('#showcaseCarousel');
    bootstrap.Carousel.getOrCreateInstance(el);
  }

  /* ---- Stats: only show figures that exist ---- */
  if (stats.status === 'fulfilled') {
    const s = stats.value;
    const figures = [
      [s.availableResources, 'resources available now'],
      [s.completedExchanges, 'exchanges completed'],
      [s.studentsSharing, 'students sharing'],
      [s.approvedLocations, 'approved pickup points'],
    ];
    if (figures.some(([v]) => v > 0)) {
      EC.$('#statsStrip').innerHTML = figures.map(([v, l]) => `<div><div class="stat-value">${Number(v).toLocaleString('en-IN')}</div><div class="stat-label">${esc(l)}</div></div>`).join('');
      EC.$('#statsSection').classList.remove('d-none');
    }
  }

  /* ---- Categories ---- */
  const counts = stats.status === 'fulfilled' ? stats.value.categoryCounts : {};
  const cats = meta.status === 'fulfilled' ? meta.value.categories : [];
  EC.$('#catGrid').innerHTML = cats.map((c) => `
    <a class="cat-tile" href="browse.html?category=${encodeURIComponent(c)}">
      <span class="cat-icon"><i class="bi ${EC.catIcon(c)}" aria-hidden="true"></i></span>
      <span><strong>${esc(c)}</strong><small>${counts[c] ? EC.plural(counts[c], 'available item') : 'Nothing listed yet'}</small></span>
    </a>`).join('');

  /* ---- Recent ---- */
  const grid = EC.$('#recentGrid');
  if (recent.status === 'rejected') grid.innerHTML = `<div class="col-12">${EC.errorState(recent.reason)}</div>`;
  else if (!recent.value.items.length) grid.innerHTML = `<div class="col-12">${EC.state({ icon: 'bi-box-seam', title: 'No resources listed yet', text: 'When students list items, the newest ones appear here.', actions: '<a class="btn btn-primary" href="list-resource.html">List the first resource</a>' })}</div>`;
  else grid.innerHTML = recent.value.items.map((r) => `<div class="col-sm-6 col-lg-3">${EC.resourceCard(r)}</div>`).join('');
});
