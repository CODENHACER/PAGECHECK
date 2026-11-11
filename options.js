const input = document.getElementById('apiKey');
const estado = document.getElementById('estado');

chrome.storage.sync.get('apiKey').then(({ apiKey }) => {
  if (apiKey) input.value = apiKey;
});

document.getElementById('guardar').addEventListener('click', async () => {
  await chrome.storage.sync.set({ apiKey: input.value.trim() });
  estado.textContent = 'Guardado';
  setTimeout(() => (estado.textContent = ''), 2000);
});
