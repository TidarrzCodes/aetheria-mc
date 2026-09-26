// ==========================================
// UTILS: COOKIE, SESSION & SANITIZATION HELPERS
// ==========================================
function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/; SameSite=Strict";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(';');
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === ' ') c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function eraseCookie(name) {
  document.cookie = name + '=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

function clearAllSessions() {
  eraseCookie('aetheria_admin_token');
  sessionStorage.removeItem('aetheria_admin_auth');
  sessionStorage.removeItem('aetheria_admin_token');
  sessionStorage.removeItem('aetheria_admin_username');
  sessionStorage.removeItem('aetheria_admin_rank');
  localStorage.removeItem('aetheria_admin_auth');
  localStorage.removeItem('aetheria_admin_token');
  localStorage.removeItem('aetheria_admin_username');
  localStorage.removeItem('aetheria_admin_rank');
  localStorage.removeItem('aetheria_player_user');
}

function getAdminToken() {
  const cookie = getCookie('aetheria_admin_token');
  if (cookie && cookie !== 'true') return cookie;
  const sessionToken = sessionStorage.getItem('aetheria_admin_token');
  if (sessionToken && sessionToken !== 'true') return sessionToken;
  const localToken = localStorage.getItem('aetheria_admin_token');
  if (localToken && localToken !== 'true') return localToken;
  return '';
}

const ALLOWED_STAFF_RANKS = ['OWNER', 'ADMIN', 'MOD', 'MODERATOR', 'STAFF', 'HELPER'];

function isStaffRank(rank) {
  if (!rank) return false;
  const rankUpper = String(rank).toUpperCase();
  return ALLOWED_STAFF_RANKS.some(r => rankUpper.includes(r));
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
