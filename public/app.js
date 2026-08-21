const form = document.querySelector('#upload-form');
const fileInput = document.querySelector('#file-input');
const dropZone = document.querySelector('#drop-zone');
const selectedFile = document.querySelector('#selected-file');
const formMessage = document.querySelector('#form-message');
const documentsBody = document.querySelector('#documents-body');
let documents = [];
const maxDocuments = 2;
let itrFiled = false;

function updateMalaysiaGreeting() {
  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', hour: 'numeric', hour12: false }).format(now));
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const date = new Intl.DateTimeFormat('en-MY', { timeZone: 'Asia/Kuala_Lumpur', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  document.querySelector('#greeting-text').textContent = greeting;
  document.querySelector('#greeting-name').textContent = 'Asmira';
  document.querySelector('#local-date').textContent = `${date.toUpperCase()} · MALAYSIA TIME`;
}

updateMalaysiaGreeting();

const modalBackdrop = document.querySelector('#modal-backdrop');
const modalEyebrow = document.querySelector('#modal-eyebrow');
const modalTitle = document.querySelector('#modal-title');
const modalContent = document.querySelector('#modal-content');

function openModal(eyebrow, title, content) {
  modalEyebrow.textContent = eyebrow;
  modalTitle.textContent = title;
  modalContent.innerHTML = content;
  modalBackdrop.hidden = false;
}

function closeModal() {
  modalBackdrop.hidden = true;
  modalContent.innerHTML = '';
}

const companyDetails = () => openModal('COMPANY PROFILE', 'Meta Platforms', '<p class="modal-copy">Your active company workspace for organising records and preparing the Malaysian tax return.</p><div class="company-detail-grid"><div class="company-detail"><small>Legal name</small><strong>Meta Platforms</strong></div><div class="company-detail"><small>Status</small><strong>Active</strong></div><div class="company-detail"><small>Tax region</small><strong>Malaysia</strong></div><div class="company-detail"><small>Reporting currency</small><strong>RM</strong></div><div class="company-detail"><small>Financial year</small><strong>FY 2026–27</strong></div><div class="company-detail"><small>Tax return</small><strong>IT return · 30 Sep 2027</strong></div></div><button class="modal-action" id="company-documents">View company documents →</button>');

document.querySelector('#company-switcher').addEventListener('click', companyDetails);
document.querySelector('#companies-link').addEventListener('click', (event) => { event.preventDefault(); companyDetails(); });
document.querySelector('#settings-button').addEventListener('click', () => openModal('WORKSPACE SETTINGS', 'Account settings', '<p class="modal-copy">Your workspace is configured for a Malaysian company account.</p><ul class="modal-list"><li><span>✓</span> Malaysian Ringgit (RM) reporting</li><li><span>✓</span> FY 2026–27 financial year</li><li><span>✓</span> Secure document storage enabled</li></ul><div class="notice">Settings are ready for this workspace. Contact your accountant to change filing details.</div>'));
document.querySelector('#notifications-button').addEventListener('click', () => openModal('NOTIFICATIONS', 'You\'re all caught up', '<div class="notice">There are no new notifications. Uploaded bills will appear here.</div>'));
function openItrChecklist() {
  if (itrFiled) {
    openModal('TAX RETURN', 'ITR already filed', '<div class="notice">✓ Your ITR has been filed successfully. This workspace is now read-only and documents can no longer be uploaded or deleted.</div>');
    return;
  }
  openModal('TAX RETURN', 'IT return checklist', '<p class="modal-copy">A quick view of what remains before your 30 September 2027 filing deadline.</p><ul class="modal-list"><li><span>✓</span> Company details are complete</li><li><span>2</span> Upload up to 2 business documents</li><li><span>3</span> Submit the IT return</li></ul><button class="modal-action" id="file-itr-button" type="button">File ITR →</button>');
}

function openItrSubmission() {
  openModal('ITR SUBMISSION', 'Verify and file ITR', '<p class="modal-copy">Your completed records are ready for submission. Continue to file the IT return for Meta Platforms.</p><div class="notice">Your ITR will be submitted for FY 2026–27.</div><button class="modal-action" id="verify-itr-button" type="button">Verify and file ITR →</button><p class="modal-form-message" id="otp-message" role="status"></p>');
}

document.querySelector('#deadline-button').addEventListener('click', openItrChecklist);
document.querySelector('#return-button').addEventListener('click', openItrChecklist);
document.querySelector('#readiness-options').addEventListener('click', openItrChecklist);
document.querySelector('#invite-button').addEventListener('click', () => openModal('ACCOUNTANT ACCESS', 'Invite your accountant', '<p class="modal-copy">Give your accountant secure access to review bills and prepare the return.</p><label class="invite-field">Accountant email<input id="invite-email" type="email" placeholder="accountant@example.com"></label><button class="modal-action" id="send-invite" type="button">Send invitation →</button><p class="modal-form-message" id="invite-message" role="status"></p>'));
modalContent.addEventListener('click', async (event) => {
  if (event.target.id === 'company-documents') { closeModal(); document.querySelector('#documents').scrollIntoView({ behavior: 'smooth' }); }
  if (event.target.id === 'send-invite') document.querySelector('#invite-message').textContent = 'Invitation ready to send from your accountant settings.';
  if (event.target.id === 'file-itr-button') openItrSubmission();
  if (event.target.id === 'verify-itr-button') {
    const button = event.target;
    button.disabled = true;
    button.textContent = 'Filing...';
    try {
      const response = await fetch('/api/itr/file', { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      itrFiled = true;
      renderDocuments();
      openModal('ITR SUBMISSION', 'Successfully filed', '<div class="notice">✓ Your ITR was filed successfully for FY 2026–27. This workspace is now read-only. Documents can no longer be uploaded or deleted.</div>');
    } catch (error) {
      document.querySelector('#otp-message').textContent = error.message;
      button.disabled = false;
      button.textContent = 'Verify and file ITR →';
    }
  }
});
document.querySelector('#modal-close').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (event) => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !modalBackdrop.hidden) closeModal(); });

document.querySelector('#logout-button').addEventListener('click', async () => {
  await fetch('/api/logout', { method: 'POST' });
  window.location.replace('/login');
});

const formatSize = (bytes) => bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
const formatDate = (date) => new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(date));
const formatAmount = (amount) => `RM ${(Number(amount) || 0).toFixed(2)}`;
const allFileTypes = '.pdf,.jpg,.jpeg,.png,.webp,.xlsx,.csv';

function selectFile(file) {
  if (!file) return;
  fileInput.files = (() => { const transfer = new DataTransfer(); transfer.items.add(file); return transfer.files; })();
  document.querySelector('#selected-name').textContent = file.name;
  document.querySelector('#selected-size').textContent = formatSize(file.size);
  selectedFile.hidden = false;
  formMessage.textContent = '';
}

function updateSummary() {
  const count = documents.length;
  const purchaseTotal = documents.filter((item) => item.category === 'Purchase invoice').reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const salesTotal = documents.filter((item) => item.category === 'Sales invoice').reduce((total, item) => total + (Number(item.amount) || 0), 0);
  const itrAmount = purchaseTotal + salesTotal;
  const readiness = Math.min(100, Math.round((count / maxDocuments) * 100));
  document.querySelector('#total-documents').textContent = count;
  document.querySelector('#readiness').textContent = `${readiness}%`;
  document.querySelector('#ring-value').textContent = `${readiness}%`;
  document.querySelector('#nav-count').textContent = count;
  document.querySelector('#file-count').textContent = `${count} ${count === 1 ? 'file' : 'files'}`;
  document.querySelector('#purchase-total').textContent = formatAmount(purchaseTotal);
  document.querySelector('#sales-total').textContent = formatAmount(salesTotal);
  document.querySelector('#itr-total').textContent = itrFiled ? formatAmount(itrAmount) : 'RM 0.00';
  document.querySelector('#itr-status').textContent = itrFiled ? 'Filed successfully · Read-only' : 'Not filed yet';
  document.querySelector('#documents-status').textContent = `${Math.min(count, maxDocuments)} / ${maxDocuments}`;
  document.querySelector('#documents-check').textContent = count >= maxDocuments ? '✓' : '2';
  document.querySelector('#documents-check').classList.toggle('done', count >= maxDocuments);
  const uploadButton = document.querySelector('#submit-button');
  uploadButton.disabled = itrFiled || count >= maxDocuments;
  uploadButton.innerHTML = itrFiled ? 'Workspace locked' : count >= maxDocuments ? 'Document limit reached' : 'Upload document <span>↑</span>';
  const ring = document.querySelector('.progress-ring');
  ring.style.background = `conic-gradient(var(--green) ${readiness * 3.6}deg, #e6ebe5 ${readiness * 3.6}deg)`;
}

function renderDocuments() {
  const query = document.querySelector('#search-input').value.toLowerCase();
  const filter = document.querySelector('#filter-select').value;
  const visible = documents.filter((item) => item.name.toLowerCase().includes(query) && (filter === 'all' || item.category === filter));
  documentsBody.innerHTML = visible.length ? visible.map((item) => `<tr><td><div class="document-name"><span class="file-icon">▤</span><span>${item.name}<small>${formatSize(item.size)}</small></span></div></td><td>${item.company}</td><td>${item.category}</td><td class="amount-cell">${formatAmount(item.amount)}</td><td>${formatDate(item.uploadedAt)}</td><td><span class="status">${item.status}</span></td><td>${itrFiled ? '<span class="locked-action">Locked</span>' : `<button class="delete-button" data-id="${item.id}" aria-label="Delete ${item.name}">×</button>`}</td></tr>`).join('') : '<tr><td colspan="7" class="empty-state">No matching documents found.</td></tr>';
  updateSummary();
}

async function loadDocuments() {
  try {
    const response = await fetch('/api/documents');
    documents = await response.json();
    renderDocuments();
  } catch (_error) {
    formMessage.textContent = 'Could not load your documents. Refresh to try again.';
  }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!fileInput.files[0]) { formMessage.textContent = 'Choose a bill before uploading.'; return; }
  if (itrFiled) {
    formMessage.textContent = 'This workspace is locked because the ITR has already been filed.';
    formMessage.style.color = '#c06342';
    return;
  }
  if (documents.length >= maxDocuments) {
    formMessage.textContent = `You can upload up to ${maxDocuments} documents.`;
    formMessage.style.color = '#c06342';
    return;
  }
  const button = document.querySelector('#submit-button');
  button.disabled = true;
  button.textContent = 'Uploading...';
  try {
    const response = await fetch('/api/documents', { method: 'POST', body: new FormData(form) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    documents.unshift(result);
    renderDocuments();
    form.reset();
    selectedFile.hidden = true;
    formMessage.textContent = 'Document uploaded successfully.';
    formMessage.style.color = '#478568';
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.style.color = '#c06342';
  } finally {
    button.disabled = false;
    button.innerHTML = documents.length >= maxDocuments ? 'Document limit reached' : 'Upload document <span>↑</span>';
  }
});

fileInput.addEventListener('change', () => selectFile(fileInput.files[0]));
document.querySelector('#remove-file').addEventListener('click', () => { fileInput.value = ''; selectedFile.hidden = true; });
document.querySelector('#header-upload').addEventListener('click', () => dropZone.scrollIntoView({ behavior: 'smooth', block: 'center' }));
document.querySelector('#spreadsheet-upload').addEventListener('click', () => {
  fileInput.accept = '.xlsx,.csv';
  fileInput.click();
  window.setTimeout(() => { fileInput.accept = allFileTypes; }, 1000);
});
document.querySelector('#search-input').addEventListener('input', renderDocuments);
document.querySelector('#filter-select').addEventListener('change', renderDocuments);
dropZone.addEventListener('dragover', (event) => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', (event) => { event.preventDefault(); dropZone.classList.remove('dragging'); selectFile(event.dataTransfer.files[0]); });
documentsBody.addEventListener('click', async (event) => {
  const button = event.target.closest('.delete-button');
  if (!button) return;
  const response = await fetch(`/api/documents/${button.dataset.id}`, { method: 'DELETE' });
  if (response.ok) { documents = documents.filter((item) => item.id !== button.dataset.id); renderDocuments(); }
});

fetch('/api/session')
  .then((response) => response.ok ? response.json() : Promise.reject(new Error('Not authenticated')))
  .then((session) => {
    itrFiled = Boolean(session.workspace?.itrFiled);
    return loadDocuments();
  })
  .catch(() => window.location.replace('/login'));
