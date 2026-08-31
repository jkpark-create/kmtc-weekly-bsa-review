const GOOGLE_CLIENT_ID = '409330651463-giie223egsskdq10etn642gjtron1hq5.apps.googleusercontent.com';
const ALLOWED_DOMAIN = 'ekmtc.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const AUTH_TOKEN_KEY = 'gtoken';
const AUTH_USER_KEY = 'guser';
const RETURN_PATH_KEY = 'obtReturnPath';
const AUTH_REDIRECT_PATH = '/kmtc-3w-dashboard-web/';
const PROTECTED_INDEX_FILE = 'protected-assets.json';
const LANGUAGE_KEY = 'lang';
const DRIVE_FETCH_MAX_ATTEMPTS = 3;
const DRIVE_FETCH_RETRY_BASE_MS = 500;

const LOGIN_COPY = Object.freeze({
  ko: Object.freeze({
    pageTitle: 'KMTC Integrated Dashboard · 로그인',
    dashboardTitle: '통합 대시보드',
    heading: '회사 계정 로그인이 필요합니다',
    description: 'KMTC 회사 Google 계정(@{domain})으로<br />로그인한 사용자만 확인할 수 있습니다.',
    checking: '로그인 상태를 확인하고 있습니다.',
    signIn: 'Google 계정으로 로그인',
    footnote: '업무용 데이터는 인증 후 회사 공유 Drive에서 안전하게 불러옵니다.',
    languageControl: '로그인 화면 언어',
    companyOnlyError: '@{domain} 회사 계정만 접근할 수 있습니다.',
    sessionExpiredError: '로그인 세션이 만료되었습니다. 다시 로그인해 주세요.',
    protectedIndexError: '보호 자산 목록을 불러오지 못했습니다 ({status}).',
    protectedIndexFormatError: '보호 자산 목록 형식이 올바르지 않습니다.',
    noSessionError: 'Google 로그인 세션이 없습니다.',
    protectedAppError: '보호된 앱을 불러오지 못했습니다 ({status}).',
    accessError: '로그인 또는 데이터 접근 권한을 확인하지 못했습니다.'
  }),
  en: Object.freeze({
    pageTitle: 'KMTC Integrated Dashboard · Login',
    dashboardTitle: 'Integrated Dashboard',
    heading: 'Company account sign-in required',
    description: 'Sign in with your KMTC Google account (@{domain})<br />to view this dashboard.',
    checking: 'Checking your sign-in status.',
    signIn: 'Sign in with Google',
    footnote: 'Business data is securely loaded from the company shared Drive after authentication.',
    languageControl: 'Login language',
    companyOnlyError: 'Access is restricted to @{domain} company accounts.',
    sessionExpiredError: 'Your sign-in session has expired. Please sign in again.',
    protectedIndexError: 'Unable to load the protected asset index ({status}).',
    protectedIndexFormatError: 'The protected asset index format is invalid.',
    noSessionError: 'No Google sign-in session is available.',
    protectedAppError: 'Unable to load the protected application ({status}).',
    accessError: 'Unable to verify your sign-in or data access permission.'
  })
});

const nativeFetch = window.fetch.bind(window);
const root = document.getElementById('root');
const loaderUrl = new URL(import.meta.url);
const baseUrl = new URL('./', loaderUrl);
const isLocalPreview = ['localhost', '127.0.0.1'].includes(window.location.hostname);
const useProtectedDrive = !isLocalPreview || new URLSearchParams(location.search).has('protectedDrive');

function waitForRetry(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function preferredLanguage() {
  try {
    return localStorage.getItem(LANGUAGE_KEY) === 'en' ? 'en' : 'ko';
  } catch (_) {
    return 'ko';
  }
}

function loginCopy(key, params = {}) {
  const language = preferredLanguage();
  let value = LOGIN_COPY[language]?.[key] ?? LOGIN_COPY.ko[key] ?? key;
  Object.entries(params).forEach(([name, replacement]) => {
    value = value.replaceAll(`{${name}}`, String(replacement));
  });
  return value;
}

function savePreferredLanguage(language) {
  const normalized = language === 'en' ? 'en' : 'ko';
  try {
    localStorage.setItem(LANGUAGE_KEY, normalized);
  } catch (_) {
    // The current page can still re-render even when browser storage is unavailable.
  }
  document.documentElement.lang = normalized;
}

function googleIcon() {
  return `
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59A14.2 14.2 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>`;
}

function renderGate({ checking = false, error = '' } = {}) {
  const language = preferredLanguage();
  savePreferredLanguage(language);
  document.title = loginCopy('pageTitle');
  root.innerHTML = `
    <main class="authGateShell">
      <section class="authGateCard" aria-labelledby="authGateTitle">
        <header class="authGateBrand">
          <small>KMTC Integrated Dashboard</small>
          <div class="authGateLanguage" role="group" aria-label="${escapeHtml(loginCopy('languageControl'))}">
            <button type="button" data-auth-language="ko" class="${language === 'ko' ? 'active' : ''}" aria-pressed="${language === 'ko'}">한국</button>
            <button type="button" data-auth-language="en" class="${language === 'en' ? 'active' : ''}" aria-pressed="${language === 'en'}">EN</button>
          </div>
          <h1>${loginCopy('dashboardTitle')}</h1>
        </header>
        <div class="authGateBody">
          <h2 id="authGateTitle">${loginCopy('heading')}</h2>
          <p>${loginCopy('description', { domain: ALLOWED_DOMAIN })}</p>
          ${checking
            ? `<div class="authGateStatus" role="status"><span class="authGateSpinner"></span>${loginCopy('checking')}</div>`
            : `<button class="authGateButton" id="companyLoginButton" type="button">${googleIcon()}<span>${loginCopy('signIn')}</span></button>`}
          ${error ? `<p class="authGateError" role="alert">${escapeHtml(error)}</p>` : ''}
          <p class="authGateFootnote">${loginCopy('footnote')}</p>
        </div>
      </section>
    </main>`;
  document.getElementById('companyLoginButton')?.addEventListener('click', startCompanyLogin);
  document.querySelectorAll('[data-auth-language]').forEach((button) => {
    button.addEventListener('click', () => {
      const nextLanguage = button.dataset.authLanguage === 'en' ? 'en' : 'ko';
      if (nextLanguage === language) return;
      savePreferredLanguage(nextLanguage);
      renderGate({ checking, error });
    });
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function storageValue(key) {
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || '';
  } catch (_) {
    return '';
  }
}

function readStoredUser() {
  try {
    return JSON.parse(storageValue(AUTH_USER_KEY) || 'null');
  } catch (_) {
    return null;
  }
}

function saveSession(token, user) {
  const serialized = JSON.stringify(user);
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, serialized);
  sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  sessionStorage.setItem(AUTH_USER_KEY, serialized);
}

function clearSession({ keepUser = false } = {}) {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  sessionStorage.removeItem(AUTH_TOKEN_KEY);
  if (!keepUser) {
    localStorage.removeItem(AUTH_USER_KEY);
    sessionStorage.removeItem(AUTH_USER_KEY);
  }
}

function isAllowedUser(user) {
  const email = String(user?.email || '').trim().toLowerCase();
  return email.endsWith(`@${ALLOWED_DOMAIN}`) && email.split('@').length === 2;
}

function startCompanyLogin() {
  const previousUser = readStoredUser();
  sessionStorage.setItem(RETURN_PATH_KEY, `${location.pathname}${location.search}`);
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: `${location.origin}${AUTH_REDIRECT_PATH}`,
    response_type: 'token',
    scope: `email profile openid ${DRIVE_SCOPE}`,
    include_granted_scopes: 'true',
    hd: ALLOWED_DOMAIN
  });
  if (previousUser?.email) params.set('login_hint', previousUser.email);
  location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

async function verifySession(token, storedUser) {
  if (!token || !storedUser) return null;
  if (isLocalPreview) {
    return isAllowedUser(storedUser) ? storedUser : null;
  }
  const response = await nativeFetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!response.ok) return null;
  const info = await response.json();
  const verified = info.verified_email === true || info.email_verified === true;
  if (!verified || !isAllowedUser(info)) {
    throw new Error(loginCopy('companyOnlyError', { domain: ALLOWED_DOMAIN }));
  }
  return {
    email: info.email,
    name: info.name || info.email.split('@')[0],
    picture: info.picture || ''
  };
}

let protectedIndexPromise = null;

async function loadProtectedIndex() {
  if (!protectedIndexPromise) {
    const indexUrl = new URL(PROTECTED_INDEX_FILE, baseUrl);
    protectedIndexPromise = nativeFetch(`${indexUrl}?t=${Date.now()}`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(loginCopy('protectedIndexError', { status: response.status }));
        const payload = await response.json();
        if (payload?.format !== 'kmtc-protected-assets-v1' || !payload?.appEntry?.fileId) {
          throw new Error(loginCopy('protectedIndexFormatError'));
        }
        return payload;
      })
      .catch((error) => {
        protectedIndexPromise = null;
        throw error;
      });
  }
  return protectedIndexPromise;
}

function assetKeyForUrl(value) {
  const target = new URL(typeof value === 'string' ? value : value.url, location.href);
  if (target.origin !== location.origin || !target.pathname.startsWith(baseUrl.pathname)) return '';
  return decodeURIComponent(target.pathname.slice(baseUrl.pathname.length)).replace(/^\/+/, '');
}

async function fetchDriveFile(fileId, options = {}) {
  const token = storageValue(AUTH_TOKEN_KEY);
  if (!token) {
    clearSession({ keepUser: true });
    location.reload();
    throw new Error(loginCopy('noSessionError'));
  }
  const requestUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`;
  for (let attempt = 1; attempt <= DRIVE_FETCH_MAX_ATTEMPTS; attempt += 1) {
    let response;
    try {
      response = await nativeFetch(`${requestUrl}&t=${Date.now()}`, {
        ...options,
        cache: 'no-store',
        headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      if (attempt >= DRIVE_FETCH_MAX_ATTEMPTS) throw error;
      await waitForRetry(DRIVE_FETCH_RETRY_BASE_MS * (2 ** (attempt - 1)));
      continue;
    }
    if (response.status === 401) {
      clearSession({ keepUser: true });
      location.reload();
      return response;
    }
    if (response.status !== 429 && response.status < 500) return response;
    if (attempt >= DRIVE_FETCH_MAX_ATTEMPTS) return response;
    await waitForRetry(DRIVE_FETCH_RETRY_BASE_MS * (2 ** (attempt - 1)));
  }
  throw new Error('Google Drive request exhausted without a response.');
}

async function fetchProtectedAsset(input, options = {}) {
  const key = assetKeyForUrl(input);
  if (!key || !useProtectedDrive) return nativeFetch(input, options);
  const index = await loadProtectedIndex();
  const entry = index.files?.[key];
  if (!entry?.fileId) {
    return new Response(JSON.stringify({ error: `Protected asset not found: ${key}` }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  return fetchDriveFile(entry.fileId, options);
}

async function loadApplication(index, user) {
  window.KMTC_AUTH = Object.freeze({
    user,
    allowedDomain: ALLOWED_DOMAIN,
    fetchProtectedAsset,
    logout() {
      clearSession();
      sessionStorage.removeItem(RETURN_PATH_KEY);
      location.reload();
    }
  });

  root.innerHTML = '';
  document.title = 'KMTC Weekly BSA Review';
  if (isLocalPreview && index.appEntry.localPath) {
    await import(new URL(index.appEntry.localPath, baseUrl).href);
    return;
  }

  const response = await fetchDriveFile(index.appEntry.fileId);
  if (!response.ok) throw new Error(loginCopy('protectedAppError', { status: response.status }));
  const source = await response.blob();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(moduleUrl);
  } finally {
    URL.revokeObjectURL(moduleUrl);
  }
}

async function bootstrap() {
  const token = storageValue(AUTH_TOKEN_KEY);
  const storedUser = readStoredUser();
  if (!token || !storedUser) {
    renderGate();
    return;
  }

  renderGate({ checking: true });
  try {
    const user = await verifySession(token, storedUser);
    if (!user) {
      clearSession({ keepUser: true });
      renderGate({ error: loginCopy('sessionExpiredError') });
      return;
    }
    saveSession(token, user);
    const index = await loadProtectedIndex();
    await loadApplication(index, user);
  } catch (error) {
    clearSession({ keepUser: true });
    renderGate({ error: error?.message || loginCopy('accessError') });
  }
}

bootstrap();
