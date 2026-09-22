'use strict';

/* Log in / Create account (front-end validation only for now) */
(function () {
  const el = (id) => document.getElementById(id);

  function showPane(name) {
    ['login', 'register'].forEach((key) => {
      const active = key === name;
      el('tab-' + key).classList.toggle('active', active);
      el('tab-' + key).setAttribute('aria-selected', active);
      el('pane-' + key).classList.toggle('d-none', !active);
    });
    el('authTitle').textContent = name === 'login' ? 'Log in' : 'Create your account';
  }

  function bindPasswordToggles() {
    document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const input = el(btn.dataset.togglePassword);
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.textContent = show ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  function handleLogin(state) {
    const form = el('loginForm');
    const email = el('loginEmail');
    const password = el('loginPassword');
    liveValidate(email, RULES.email);
    liveValidate(password, RULES.loginPassword);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!checkAll([[email, RULES.email], [password, RULES.loginPassword]])) return;
      login(state);
      showToast('Logged in.');
      setTimeout(() => { window.location.href = safeNext(getParam('next')); }, 600);
    });
  }

  function handleRegister() {
    const form = el('registerForm');
    const name = el('regName');
    const email = el('regEmail');
    const password = el('regPassword');
    const dept = el('regDept');
    const sem = el('regSem');
    const pairs = [
      [name, RULES.name], [email, RULES.email], [password, RULES.password],
      [dept, RULES.required('Department')], [sem, RULES.required('Semester')]
    ];
    pairs.forEach(([input, rule]) => liveValidate(input, rule));

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!checkAll(pairs)) return;
      const registeredEmail = email.value.trim();
      form.reset();
      clearValidation(form);
      showPane('login');
      el('loginEmail').value = registeredEmail;
      el('registerSuccess').classList.remove('d-none');
    });
  }

  PAGES.login = (state) => {
    if (isLoggedIn(state)) { window.location.href = 'browse.html'; return; }
    fillSelect(el('regDept'), DEPARTMENTS.filter((d) => d !== 'All Departments'), 'Select department');
    fillSelect(el('regSem'), semesterOptions(), 'Select semester');
    bindPasswordToggles();
    handleLogin(state);
    handleRegister();

    el('tab-login').addEventListener('click', () => showPane('login'));
    el('tab-register').addEventListener('click', () => showPane('register'));
    if (getParam('required')) el('loginRequired').classList.remove('d-none');
    showPane(window.location.hash === '#register' ? 'register' : 'login');
  };
})();
