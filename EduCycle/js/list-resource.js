'use strict';

/* Give a resource: create and edit a listing */
(function () {
  const el = (id) => document.getElementById(id);

  function fieldPairs() {
    return [
      [el('resName'), RULES.length('Resource name', 3, 60)],
      [el('resCategory'), RULES.required('Category')],
      [el('resDescription'), RULES.length('Description', 10, 300)],
      [el('resCondition'), RULES.required('Condition')],
      [el('resDepartment'), RULES.required('Department')],
      [el('resSemester'), RULES.required('Semester')],
      [el('resQuantity'), RULES.intRange('Quantity', 1, 20)],
      [el('resLocation'), RULES.length('Pick-up location', 3, 60)]
    ];
  }

  const checkedType = () => {
    const checked = document.querySelector('input[name="type"]:checked');
    return checked ? checked.value : '';
  };

  function validateType() {
    const ok = Boolean(checkedType());
    el('typeField').classList.toggle('has-error', !ok);
    return ok;
  }

  function bindImagePreview() {
    const input = el('resImage');
    input.addEventListener('change', () => {
      const file = input.files[0];
      const preview = el('imagePreview');
      const field = input.closest('.field');
      preview.classList.add('d-none');
      field.classList.remove('has-error');
      if (!file) return;
      if (!file.type.startsWith('image/') || file.size > 2 * 1024 * 1024) {
        field.querySelector('.invalid-feedback').textContent = 'Choose an image file smaller than 2 MB.';
        field.classList.add('has-error');
        input.value = '';
        return;
      }
      preview.src = URL.createObjectURL(file);
      preview.classList.remove('d-none');
    });
  }

  function prefill(resource) {
    el('resName').value = resource.name;
    el('resCategory').value = resource.category;
    el('resDescription').value = resource.description;
    el('resCondition').value = resource.condition;
    const radio = document.querySelector(`input[name="type"][value="${resource.type}"]`);
    if (radio) radio.checked = true;
    el('resDepartment').value = resource.department;
    el('resSemester').value = resource.semester;
    el('resQuantity').value = resource.quantity;
    el('resLocation').value = resource.location;
    el('descCount').textContent = resource.description.length;
  }

  PAGES.list = (state) => {
    if (!requireLogin(state)) return;

    fillSelect(el('resCategory'), CATEGORIES, 'Select category');
    fillSelect(el('resCondition'), CONDITIONS, 'Select condition');
    fillSelect(el('resDepartment'), DEPARTMENTS, 'Select department');
    fillSelect(el('resSemester'), semesterOptions(), 'Select semester');

    const editId = Number(getParam('edit')) || null;
    let editing = null;
    if (editId) {
      editing = state.resources.find((r) => r.id === editId && r.ownerId === state.currentUser.id);
      if (!editing) { window.location.href = 'my-listings.html'; return; }
      el('pageTitle').textContent = 'Edit listing';
      el('pageSub').textContent = 'Changes appear in Browse straight away.';
      el('submitBtn').textContent = 'Save changes';
      document.title = 'Edit listing | EduCycle';
      prefill(editing);
    }

    const pairs = fieldPairs();
    pairs.forEach(([input, rule]) => liveValidate(input, rule));
    document.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener('change', validateType));
    el('resDescription').addEventListener('input', () => { el('descCount').textContent = el('resDescription').value.length; });
    bindImagePreview();

    el('resourceForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const fieldsOk = checkAll(pairs);
      const typeOk = validateType();
      if (!fieldsOk || !typeOk) {
        showToast('Please fix the highlighted fields.', 'error');
        return;
      }
      const data = {
        name: el('resName').value.trim(), category: el('resCategory').value, description: el('resDescription').value.trim(),
        condition: el('resCondition').value, type: checkedType(), department: el('resDepartment').value,
        semester: Number(el('resSemester').value), quantity: Number(el('resQuantity').value), location: el('resLocation').value.trim()
      };
      if (editing) {
        updateResource(state, editing.id, data);
        showToast('Listing updated.');
      } else {
        addResource(state, data);
        showToast('Listed. It is now visible in Browse.');
      }
      setTimeout(() => { window.location.href = 'my-listings.html'; }, 800);
    });
  };
})();
