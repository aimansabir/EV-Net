export function normalizePersonName(value = '') {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => {
      const [first, ...rest] = word;
      return first ? `${first.toUpperCase()}${rest.join('').toLowerCase()}` : '';
    })
    .join(' ');
}

export function friendlyAuthError(error) {
  const message = error?.message || String(error || '');
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials')) {
    return 'Email or password is incorrect.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please verify your email before logging in.';
  }

  if (lower.includes('already registered') || lower.includes('already exists') || lower.includes('user already')) {
    return 'If this email already has an account, please log in or reset your password.';
  }

  if (lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}
