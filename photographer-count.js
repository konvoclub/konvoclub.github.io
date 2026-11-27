// Only the aggregate count is public. The Apps Script counts applications in the sheet.
window.konvoPhotographerCount = count => {
  if (!Number.isSafeInteger(count) || count < 2) return;
  document.querySelectorAll('[data-photographer-count]').forEach(element => {
    element.textContent = count === 2
      ? 'Our two founders are on the list so far.'
      : `${count} photographers have joined or applied, including our two founders.`;
    element.hidden = false;
  });
};

const countScript = document.createElement('script');
countScript.crossOrigin = 'anonymous';
countScript.src = 'https://script.google.com/macros/s/AKfycbzQsRxmw9cc2nP4BUyYPUcGYRqJB-Jke4zuMgk8l88c0T5VgQyWg6S2dRxm36jjctP2rw/exec?count=photographers';
document.head.appendChild(countScript);
