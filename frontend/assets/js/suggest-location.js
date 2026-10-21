/* Shared "Suggest a new location" form handler (used on the listing form and the Pickup points page). */
(function () {
  'use strict';
  EC.bindSuggestForm = function bindSuggestForm(form, { onDone, modal } = {}) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      EC.form.clear(form);
      const v = EC.form.values(form);
      const errs = {};
      if ((v.name || '').length < 3) errs.name = 'Enter a name of at least 3 characters.';
      if ((v.area || '').length < 3) errs.area = 'Enter the campus area or building.';
      if (Object.keys(errs).length) return EC.form.errors(form, errs);
      const btn = form.querySelector('[type="submit"]');
      EC.form.busy(btn, true, 'Submitting…');
      try {
        const { location } = await EC.api('/locations', { method: 'POST', body: v });
        form.reset();
        if (modal) bootstrap.Modal.getOrCreateInstance(modal).hide();
        EC.toast(`“${location.name}” was submitted for review. You will be notified of the decision.`);
        if (onDone) onDone(location);
      } catch (err) {
        EC.form.handleError(form, err);
      } finally { EC.form.busy(btn, false); }
    });
  };
})();
