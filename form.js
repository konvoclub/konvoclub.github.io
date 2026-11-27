// Paste the Apps Script web app URL here (see setup/SETUP.md)
const ENDPOINT = 'APPS_SCRIPT_URL';

document.querySelectorAll('form[data-form]').forEach(form => {
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async event => {
    event.preventDefault();
    status.textContent = '';

    if (!form.reportValidity()) return;

    // Checkbox groups marked required need at least one ticked
    for (const group of form.querySelectorAll('[data-required-group]')) {
      if (!group.querySelector('input:checked')) {
        status.textContent = `Please answer: ${group.dataset.requiredGroup}`;
        group.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }

    if (!ENDPOINT.startsWith('https://')) {
      status.textContent = "This form isn't connected yet. Please try again later.";
      return;
    }

    // Join multi-select answers into one cell, e.g. "English, Mandarin"
    const data = new FormData(form);
    const body = new URLSearchParams({ form: form.dataset.form });
    for (const key of new Set(data.keys())) {
      body.set(key, data.getAll(key).filter(Boolean).join(', '));
    }

    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body });
      form.hidden = true;
      document.querySelector('.form-done').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      status.textContent = "Couldn't send. Check your connection and try again.";
      button.disabled = false;
      button.textContent = form.dataset.submitLabel;
    }
  });
});
