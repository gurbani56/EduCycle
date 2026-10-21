/* Administrator sign-in. The server rejects non-admin accounts. */
EC.page(async ({ user }) => {
  const { $ } = EC;
  if (user && user.role === 'admin') { location.replace('admin.html'); return; }
  const reason = EC.params().get('reason');
  const msgs = { expired: 'Your admin session has ended. Please sign in again.', disabled: 'This account is disabled.' };
  if (user && user.role === 'student') msgs.student = `You are signed in as the student ${user.name}. Signing in here will end that session.`;
  const m = msgs[reason] || (user && user.role === 'student' ? msgs.student : '');
  if (m) { $('#reasonAlert').textContent = m; $('#reasonAlert').classList.remove('d-none'); }

  const form = $('#adminLoginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    EC.form.clear(form);
    const email = form.elements.email.value.trim();
    const password = form.elements.password.value;
    const errs = {};
    if (!email) errs.email = 'Enter your admin email.';
    if (!password) errs.password = 'Enter your password.';
    if (Object.keys(errs).length) return EC.form.errors(form, errs);
    const btn = form.querySelector('[type=submit]');
    EC.form.busy(btn, true, 'Signing in…');
    try {
      await EC.api('/auth/admin/login', { method: 'POST', body: { email, password } });
      const next = EC.params().get('next');
      location.href = next && /^\/admin(\.html)?(#[\w-]*)?$/.test(next) ? next : 'admin.html';
    } catch (err) {
      EC.form.handleError(form, err);
      form.elements.password.value = '';
      EC.form.busy(btn, false);
    }
  });
});
