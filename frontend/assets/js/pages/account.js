/* Account settings: profile, password change and personal activity log. */
EC.page(async ({ user }) => {
  const { $, esc } = EC;
  const meta = await EC.meta();
  const pf = $('#profileForm');
  pf.elements.name.value = user.name;
  $('#pfEmail').value = user.email;
  EC.fillSelect($('#pfDept'), meta.departments.filter((d) => d !== 'All Departments'), { placeholder: 'Not set', value: user.department });
  EC.fillSelect($('#pfSem'), meta.semesters.map((s) => ({ value: s, label: `Semester ${s}` })), { placeholder: 'Not set', value: user.semester || '' });

  pf.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(pf);
    const v = EC.form.values(pf);
    if ((v.name || '').length < 2) return EC.form.errors(pf, { name: 'Enter your full name.' });
    const body = { name: v.name };
    if (v.department) body.department = v.department;
    if (v.semester) body.semester = Number(v.semester);
    const btn = pf.querySelector('[type=submit]');
    EC.form.busy(btn, true);
    try { await EC.api('/auth/me', { method: 'PATCH', body }); EC.toast('Profile saved.'); } catch (err) { EC.form.handleError(pf, err); } finally { EC.form.busy(btn, false); }
  });

  const pw = $('#passwordForm');
  pw.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(pw);
    const cur = pw.elements.currentPassword.value; const nw = pw.elements.newPassword.value; const cf = pw.elements.confirm.value;
    const errs = {};
    if (!cur) errs.currentPassword = 'Enter your current password.';
    if (nw.length < 8 || !/[A-Za-z]/.test(nw) || !/\d/.test(nw)) errs.newPassword = 'Use at least 8 characters with a letter and a number.';
    if (nw !== cf) errs.confirm = 'The passwords do not match.';
    if (Object.keys(errs).length) return EC.form.errors(pw, errs);
    const btn = pw.querySelector('[type=submit]');
    EC.form.busy(btn, true);
    try { await EC.api('/auth/password', { method: 'POST', body: { currentPassword: cur, newPassword: nw } }); pw.reset(); EC.toast('Password updated.'); } catch (err) { EC.form.handleError(pw, err); } finally { EC.form.busy(btn, false); }
  });

  try {
    const { items } = await EC.api('/activity/mine?limit=12');
    $('#log').innerHTML = items.length
      ? `<ul class="timeline">${items.map((a) => `<li><time>${EC.fmtDateTime(a.createdAt)}</time>${esc(a.summary)}</li>`).join('')}</ul>`
      : '<p class="small text-muted mb-0">No activity yet.</p>';
  } catch (err) { $('#log').innerHTML = `<p class="small text-danger mb-0">${esc(err.message)}</p>`; }
});
