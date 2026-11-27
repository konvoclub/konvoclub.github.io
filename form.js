// Apps Script web app (WaffleBox account) that writes to the Konvo Club sheet
const ENDPOINT = 'https://script.google.com/macros/s/AKfycbzQsRxmw9cc2nP4BUyYPUcGYRqJB-Jke4zuMgk8l88c0T5VgQyWg6S2dRxm36jjctP2rw/exec';

// Apps Script accepts cross-origin POSTs without exposing their responses.
// Check a short-lived receipt separately before showing the success message.
const pendingReceipts = new Map();
window.konvoFormReceipt = (id, received) => pendingReceipts.get(id)?.(received);

function checkReceipt(id) {
  return new Promise(resolve => {
    const script = document.createElement('script');
    let timer;
    const finish = received => {
      clearTimeout(timer);
      pendingReceipts.delete(id);
      script.remove();
      resolve(received);
    };
    pendingReceipts.set(id, finish);
    timer = setTimeout(() => finish(false), 5000);
    script.onerror = () => finish(false);
    // No cookies: visitors signed into several Google accounts otherwise get an error page
    script.crossOrigin = 'anonymous';
    script.src = `${ENDPOINT}?id=${encodeURIComponent(id)}`;
    document.head.appendChild(script);
  });
}

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

    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    const requestId = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    body.set('_requestId', requestId);

    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body });
      if (!(await checkReceipt(requestId))) {
        status.textContent = "We couldn't confirm your submission. Please contact us before sending it again.";
        return;
      }
      form.hidden = true;
      document.querySelector('.form-done').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      status.textContent = "Couldn't send. Check your connection and try again.";
    } finally {
      button.disabled = false;
      button.textContent = form.dataset.submitLabel;
    }
  });
});
