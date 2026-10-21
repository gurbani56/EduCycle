/* Student login and registration. */
EC.page(async ({ user }) => {
  const { $, $$ } = EC;
  const p = EC.params();
  // Only allow same-site relative redirects (prevents open redirects).
  const rawNext = p.get('next') || '';
  const next = /^\/(?!\/)[\w\-./?=&%]*$/.test(rawNext) && !/login/.test(rawNext) ? rawNext : 'browse.html';

  if (user && user.role === 'student') { location.replace(next); return; }
  if (user && user.role === 'admin') { location.replace('admin.html'); return; }

  const reasons = {
    expired: 'Your session has ended. Please log in again.',
    disabled: 'Your account has been disabled. Contact the EduCycle administrators if you think this is a mistake.',
  };
  if (reasons[p.get('reason')]) { $('#reasonAlert').textContent = reasons[p.get('reason')]; $('#reasonAlert').classList.remove('d-none'); }
  else if (rawNext) { $('#reasonAlert').textContent = 'Please log in to continue.'; $('#reasonAlert').className = 'alert alert-info'; }

  function show(mode) {
    const reg = mode === 'register';
    $('#pane-login').classList.toggle('d-none', reg);
    $('#pane-register').classList.toggle('d-none', !reg);
    $('#tab-login').classList.toggle('active', !reg); $('#tab-login').setAttribute('aria-selected', !reg);
    $('#tab-register').classList.toggle('active', reg); $('#tab-register').setAttribute('aria-selected', reg);
    $('#authTitle').textContent = reg ? 'Create your account' : 'Log in';
    $('#authSub').textContent = reg ? 'It is free and takes less than a minute.' : 'Welcome back. Log in with your student account.';
    document.title = `${reg ? 'Create account' : 'Log in'} | EduCycle`;
  }
  $('#tab-login').addEventListener('click', () => show('login'));
  $('#tab-register').addEventListener('click', () => show('register'));
  show(p.get('mode') === 'register' ? 'register' : 'login');

  $$('[data-toggle-password]').forEach((b) => b.addEventListener('click', () => {
    const input = document.getElementById(b.dataset.togglePassword);
    const showing = input.type === 'text';
    input.type = showing ? 'password' : 'text';
    b.setAttribute('aria-pressed', String(!showing));
    b.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    b.innerHTML = `<i class="bi ${showing ? 'bi-eye' : 'bi-eye-slash'}" aria-hidden="true"></i>`;
  }));

  const meta = await EC.meta();
  EC.fillSelect($('#regDept'), meta.departments.filter((d) => d !== 'All Departments'), { placeholder: 'Choose department' });
  EC.fillSelect($('#regSem'), meta.semesters.map((s) => ({ value: s, label: `Semester ${s}` })), { placeholder: 'Choose' });

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    EC.form.clear(form);
    const v = EC.form.values(form);
    v.password = form.elements.password.value; // keep exact password
    const errs = {};
    if (!emailOk(v.email || '')) errs.email = 'Enter a valid email address.';
    if (!v.password) errs.password = 'Enter your password.';
    if (Object.keys(errs).length) return EC.form.errors(form, errs);
    const btn = form.querySelector('[type=submit]');
    EC.form.busy(btn, true, 'Logging in…');
    try {
      await EC.api('/auth/login', { method: 'POST', body: { email: v.email, password: v.password } });
      location.href = next;
    } catch (err) {
      if (err.code === 'USE_ADMIN_LOGIN') EC.form.alert(form, 'This is an administrator account. Please use the admin login page.');
      else EC.form.handleError(form, err);
      EC.form.busy(btn, false);
    }
  });

  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    EC.form.clear(form);
    const v = EC.form.values(form);
    v.password = form.elements.password.value;
    const errs = {};
    if ((v.name || '').length < 2) errs.name = 'Enter your full name.';
    if (!emailOk(v.email || '')) errs.email = 'Enter a valid email address.';
    if (v.password.length < 8 || !/[A-Za-z]/.test(v.password) || !/\d/.test(v.password)) errs.password = 'Use at least 8 characters with a letter and a number.';
    if (!v.department) errs.department = 'Choose your department.';
    if (!v.semester) errs.semester = 'Choose your semester.';
    if (!form.elements.terms.checked) errs.terms = 'Please accept the terms to continue.';
    if (Object.keys(errs).length) return EC.form.errors(form, errs);
    const btn = form.querySelector('[type=submit]');
    EC.form.busy(btn, true, 'Creating account…');
    try {
      await EC.api('/auth/register', { method: 'POST', body: { name: v.name, email: v.email, password: v.password, department: v.department, semester: Number(v.semester) } });
      EC.flash('Welcome to EduCycle! Your account is ready.');
      location.href = next;
    } catch (err) {
      EC.form.handleError(form, err);
      if (err.status === 409) EC.form.errors(form, { email: err.message });
      EC.form.busy(btn, false);
    }
  });
});
