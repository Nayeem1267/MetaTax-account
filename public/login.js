const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');

fetch('/api/session').then((response) => {
  if (response.ok) window.location.replace('/');
});

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const button = loginForm.querySelector('button');
  button.disabled = true;
  button.textContent = 'Signing in...';
  loginMessage.textContent = '';
  try {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(new FormData(loginForm)))
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    window.location.replace('/');
  } catch (error) {
    loginMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.innerHTML = 'Continue <span>→</span>';
  }
});
