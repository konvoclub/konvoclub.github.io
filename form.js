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

// "2026-12-18" -> "18 Dec 2026"; other answers as typed
function readable(value) {
  if (!value || value instanceof File) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(`${value}T00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function portfolioLink(form) {
  return form.querySelector('input[name="Portfolio"]')?.value.trim();
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

    // Files from every upload field; data-upload names the sheet column for their Drive links
    const uploads = [...form.querySelectorAll('input[type="file"][data-upload]')]
      .flatMap(input => [...input.files].map(file => ({ file, field: input.dataset.upload })));
    if (form.dataset.form === 'photographer' && !portfolioLink(form) && !uploads.length) {
      status.textContent = 'Please share a portfolio link or upload a file.';
      return;
    }
    if (uploads.reduce((total, { file }) => total + file.size, 0) > 10 * 1024 * 1024) {
      status.textContent = 'Please keep uploads to 10 MB in total.';
      return;
    }

    // Join multi-select answers into one cell, e.g. "English, Mandarin"
    const data = new FormData(form);
    const body = new URLSearchParams({ form: form.dataset.form });
    for (const key of new Set(data.keys())) {
      if (!(data.get(key) instanceof File)) body.set(key, data.getAll(key).filter(Boolean).join(', '));
    }
    // Question order, so the sheet's columns follow the form
    body.set('_order', [...new Set([...form.elements].map(el => el.dataset.upload || el.name).filter(Boolean))].join('|'));

    const random = new Uint8Array(16);
    crypto.getRandomValues(random);
    const requestId = Array.from(random, byte => byte.toString(16).padStart(2, '0')).join('');
    body.set('_requestId', requestId);

    button.disabled = true;
    button.textContent = 'Sending…';
    try {
      for (const [i, { file, field }] of uploads.entries()) {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = '';
        for (let j = 0; j < bytes.length; j += 32768) {
          binary += String.fromCharCode(...bytes.subarray(j, j + 32768));
        }
        body.set(`_upload${i}`, btoa(binary));
        body.set(`_uploadName${i}`, file.name);
        body.set(`_uploadType${i}`, file.type || 'application/octet-stream');
        body.set(`_uploadField${i}`, field);
      }
      await fetch(ENDPOINT, { method: 'POST', mode: 'no-cors', body });
      if (!(await checkReceipt(requestId))) {
        status.textContent = "We couldn't confirm your submission. Please contact us before sending it again.";
        return;
      }
      form.hidden = true;
      document.querySelectorAll('.form-intro').forEach(intro => { intro.hidden = true; });
      // WhatsApp button with a message filled in from the form, e.g. {Name} -> "Aisyah"
      for (const link of document.querySelectorAll('[data-whatsapp]')) {
        const text = link.dataset.whatsappText.replace(/\{([^}]+)\}/g, (_, key) => readable(data.get(key)));
        link.href = `https://wa.me/${link.dataset.whatsapp}?text=${encodeURIComponent(text)}`;
      }
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
