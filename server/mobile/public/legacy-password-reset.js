'use strict';

(() => {
  const token = new URLSearchParams(window.location.search).get('token') || '';
  const checking = document.getElementById('checking');
  const invalid = document.getElementById('invalid');
  const network = document.getElementById('network');
  const form = document.getElementById('reset-form');
  const success = document.getElementById('success');
  const newPassword = document.getElementById('new-password');
  const confirmPassword = document.getElementById('confirm-password');
  const submit = document.getElementById('submit');
  const formError = document.getElementById('form-error');
  const eyeButtons = document.querySelectorAll('.eye');
  let linkVerified = false;
  let submitting = false;

  const setPasswordControlsEnabled = (enabled) => {
    newPassword.disabled = !enabled;
    confirmPassword.disabled = !enabled;
    eyeButtons.forEach((button) => { button.disabled = !enabled; });
  };

  const showOnly = (element) => {
    [checking, invalid, network, form, success].forEach((item) => item.classList.toggle('hidden', item !== element));
  };

  const checksFor = (value) => ({
    minLength: value.length >= 8,
    maxLength: value.length <= 128,
    uppercase: /[A-Z]/u.test(value),
    lowercase: /[a-z]/u.test(value),
    number: /[0-9]/u.test(value),
    special: /[^A-Za-z0-9\s]/u.test(value),
    noWhitespace: !/\s/u.test(value),
  });

  const refresh = () => {
    const checks = checksFor(newPassword.value);
    document.querySelectorAll('[data-rule]').forEach((row) => {
      row.classList.toggle('met', Boolean(checks[row.dataset.rule]));
    });
    const passwordValid = Object.values(checks).every(Boolean) && Boolean(newPassword.value);
    const confirmationValid = Boolean(confirmPassword.value) && confirmPassword.value === newPassword.value;
    submit.disabled = !linkVerified || submitting || !passwordValid || !confirmationValid;
  };

  const prohibitWhitespace = (input) => {
    input.addEventListener('beforeinput', (event) => {
      if (typeof event.data === 'string' && /\s/u.test(event.data)) event.preventDefault();
    });
    input.addEventListener('paste', (event) => {
      if (/\s/u.test(event.clipboardData.getData('text'))) event.preventDefault();
    });
    input.addEventListener('input', () => {
      if (/\s/u.test(input.value)) input.value = input.value.replace(/\s/gu, '');
      refresh();
    });
  };

  const verifyLink = async () => {
    linkVerified = false;
    setPasswordControlsEnabled(false);
    showOnly(checking);
    if (!token) {
      showOnly(invalid);
      return;
    }
    try {
      const response = await fetch('/api/m/auth/reset-password/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) throw new Error('verification request failed');
      const result = await response.json();
      if (!result.valid) {
        showOnly(invalid);
        return;
      }
      linkVerified = true;
      setPasswordControlsEnabled(true);
      showOnly(form);
      refresh();
    } catch (_error) {
      showOnly(network);
    }
  };

  eyeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.target);
      const visible = input.type === 'text';
      input.type = visible ? 'password' : 'text';
      button.textContent = visible ? 'Show' : 'Hide';
      button.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
    });
  });
  prohibitWhitespace(newPassword);
  prohibitWhitespace(confirmPassword);
  document.getElementById('retry').addEventListener('click', verifyLink);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !linkVerified) return;
    refresh();
    if (submit.disabled) return;
    submitting = true;
    submit.textContent = 'Updating…';
    refresh();
    formError.classList.add('hidden');
    try {
      const response = await fetch('/api/m/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword: newPassword.value }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status === 400 && result.code === 'RESET_LINK_INVALID') {
          linkVerified = false;
          setPasswordControlsEnabled(false);
          showOnly(invalid);
        }
        else throw Object.assign(new Error(result.detail || 'We could not update your password. Please try again.'), { handled: true });
        return;
      }
      newPassword.value = '';
      confirmPassword.value = '';
      linkVerified = false;
      setPasswordControlsEnabled(false);
      showOnly(success);
    } catch (error) {
      formError.textContent = error.handled ? error.message : 'Network error. Check your connection and try again.';
      formError.classList.remove('hidden');
    } finally {
      submitting = false;
      submit.textContent = 'Reset Password';
      refresh();
    }
  });

  verifyLink();
})();
