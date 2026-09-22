'use strict';

/* ==========================================================
   EduCycle – form validation (JavaScript regular expressions)
   Each rule takes the field value and returns an error message,
   or an empty string when the value is valid.
   ========================================================== */

const PATTERNS = {
  name: /^[A-Za-z][A-Za-z .'-]{1,49}$/,
  collegeEmail: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.(edu|ac\.in|edu\.in)$/i,
  password: /^(?=.*[A-Za-z])(?=.*\d).{8,64}$/
};

const RULES = {
  name: (v) => (PATTERNS.name.test(v.trim()) ? '' : 'Enter your full name (letters only, 2–50 characters).'),
  email: (v) => (PATTERNS.collegeEmail.test(v.trim()) ? '' : 'Use your college email (it must end with .edu or .ac.in).'),
  password: (v) => (PATTERNS.password.test(v) ? '' : 'Use at least 8 characters with one letter and one number.'),
  loginPassword: (v) => (v.length >= 8 ? '' : 'Password must be at least 8 characters.'),
  required: (label) => (v) => (String(v).trim() ? '' : `${label} is required.`),
  length: (label, min, max) => (v) => {
    const len = String(v).trim().length;
    return len >= min && len <= max ? '' : `${label} must be ${min}–${max} characters.`;
  },
  intRange: (label, min, max) => (v) => {
    const n = Number(v);
    return Number.isInteger(n) && n >= min && n <= max ? '' : `${label} must be a whole number between ${min} and ${max}.`;
  }
};

/** Show or clear the error state on a field. Returns true when valid. */
function setFieldState(input, message) {
  const field = input.closest('.field');
  const valid = !message;
  input.classList.toggle('is-invalid', !valid);
  if (field) {
    field.classList.toggle('has-error', !valid);
    const feedback = field.querySelector('.invalid-feedback');
    if (feedback) feedback.textContent = message || '';
  }
  return valid;
}

/** Validate one input with a rule function. */
function checkField(input, rule) {
  return setFieldState(input, rule(input.value));
}

/** Validate a list of [input, rule] pairs and return true only if all pass. */
function checkAll(pairs) {
  // map first so every field shows its message (no early exit)
  return pairs.map(([input, rule]) => checkField(input, rule)).every(Boolean);
}

/**
 * Validate a field on blur, and re-validate while typing once it has been
 * touched or is already showing an error. Clearing the error while typing (not
 * on blur) stops the layout from shifting under the mouse when the user clicks
 * Submit right after fixing the last field.
 */
function liveValidate(input, rule) {
  if (!input) return;
  const revalidate = () => {
    if (input.dataset.touched || input.classList.contains('is-invalid')) checkField(input, rule);
  };
  input.addEventListener('blur', () => {
    input.dataset.touched = '1';
    checkField(input, rule);
  });
  input.addEventListener('input', revalidate);
  input.addEventListener('change', revalidate);
}

function clearValidation(form) {
  form.querySelectorAll('.is-valid, .is-invalid').forEach((el) => el.classList.remove('is-valid', 'is-invalid'));
  form.querySelectorAll('.field.has-error').forEach((el) => el.classList.remove('has-error'));
  form.querySelectorAll('[data-touched]').forEach((el) => delete el.dataset.touched);
}
