'use strict';

/* Home: recently listed resources */
(function () {
  PAGES.home = (state) => {
    const recent = sortListings(state.resources.filter((r) => r.status === 'Available')).slice(0, 4);
    document.getElementById('recentList').innerHTML = recent.map((r) => listingRow(r)).join('');
  };
})();
