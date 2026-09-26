const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";

// Cookie and session helpers are imported from cookies.js

function isAdminLoggedIn() {
  const token = getAdminToken();
  const sessionAuth = sessionStorage.getItem('aetheria_admin_auth') === 'true' || localStorage.getItem('aetheria_admin_auth') === 'true';
  const adminRank = sessionStorage.getItem('aetheria_admin_rank') || localStorage.getItem('aetheria_admin_rank') || '';
  return Boolean((token || sessionAuth) && isStaffRank(adminRank));
}

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bgColors = {
    success: 'bg-slate-900/95 border-emerald-500/60 text-emerald-300',
    error: 'bg-slate-900/95 border-rose-500/60 text-rose-300',
    info: 'bg-slate-900/95 border-purple-500/60 text-purple-300'
  };

  const icons = {
    success: '<i class="fa-solid fa-circle-check text-emerald-400"></i>',
    error: '<i class="fa-solid fa-triangle-exclamation text-rose-400"></i>',
    info: '<i class="fa-solid fa-circle-info text-purple-400"></i>'
  };

  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-mono-code transition duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;

  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// CHECK ACTIVE SESSION ON LOAD
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('logout') === 'true' || urlParams.get('reset') === 'true') {
    clearAllSessions();
    return;
  }

  if (isAdminLoggedIn()) {
    showToast("Anda sudah login sebagai Staff/Admin. Mengalihkan...", "info");
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 800);
    return;
  }

  const playerUser = localStorage.getItem('aetheria_player_user');
  if (playerUser) {
    try {
      const data = JSON.parse(playerUser);
      if (isStaffRank(data.rank)) {
        // Akun staff terdeteksi namun belum terautentikasi penuh dengan token kriptografi, biarkan di halaman login
        return;
      }

      showToast(`Selamat datang kembali, ${data.username}! Mengalihkan...`, "info");
      setTimeout(() => {
        window.location.href = './players.html';
      }, 800);
    } catch (e) {
      localStorage.removeItem('aetheria_player_user');
    }
  }
});

// SUBMIT LOGIN FORM HANDLER
async function handleLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const usernameEl = document.getElementById('loginUsername');
  const passwordEl = document.getElementById('loginPassword');
  const errorBox = document.getElementById('loginError');
  const errorText = document.getElementById('loginErrorText');
  const btn = document.getElementById('btnLogin');

  if (usernameEl) usernameEl.classList.remove('border-rose-500');
  if (passwordEl) passwordEl.classList.remove('border-rose-500');

  const username = usernameEl ? usernameEl.value.trim() : '';
  const password = passwordEl ? passwordEl.value : '';

  if (!username || !password) {
    if (!username && usernameEl) usernameEl.classList.add('border-rose-500');
    if (!password && passwordEl) {
      passwordEl.classList.add('border-rose-500');
      passwordEl.focus();
    }
    if (errorBox && errorText) {
      errorText.innerText = "Username dan Password wajib diisi!";
      errorBox.classList.remove('hidden');
    }
    showToast("Username dan Password wajib diisi!", "error");
    return;
  }

  // Clear previous session states before new login attempt
  clearAllSessions();

  if (errorBox) errorBox.classList.add('hidden');
  if (btn) {
    btn.innerText = "Memverifikasi...";
    btn.disabled = true;
  }

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=player_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data && data.result === 'success') {
      const isStaff = isStaffRank(data.rank);

      if (isStaff) {
        // Staff Authentication - Wajib memiliki token kriptografi resmi dari Worker
        if (!data.token) {
          showToast("Gagal menginisialisasi sesi staff: Token otentikasi tidak valid.", "error");
          if (errorBox && errorText) {
            errorText.innerText = "Gagal menginisialisasi token sesi staff dari server!";
            errorBox.classList.remove('hidden');
          }
          if (passwordEl) {
            passwordEl.value = '';
            passwordEl.classList.add('border-rose-500');
          }
          return;
        }

        const staffToken = data.token;
        setCookie('aetheria_admin_token', staffToken, 1);
        sessionStorage.setItem('aetheria_admin_token', staffToken);
        sessionStorage.setItem('aetheria_admin_auth', 'true');
        sessionStorage.setItem('aetheria_admin_username', data.username || username);
        sessionStorage.setItem('aetheria_admin_rank', data.rank || 'Staff');

        localStorage.setItem('aetheria_admin_token', staffToken);
        localStorage.setItem('aetheria_admin_auth', 'true');
        localStorage.setItem('aetheria_admin_username', data.username || username);
        localStorage.setItem('aetheria_admin_rank', data.rank || 'Staff');

        const playerData = {
          username: data.username || username,
          rank: data.rank || 'Staff'
        };
        localStorage.setItem('aetheria_player_user', JSON.stringify(playerData));

        showToast(`Login Staff Berhasil (${data.rank})! Mengalihkan ke Dashboard Staff...`, "success");
        setTimeout(() => {
          window.location.href = './admin.html';
        }, 800);
      } else {
        // Player Authentication (Non-Staff) -> Pastikan TIDAK menyimpan session admin!
        clearAllSessions();

        const playerData = {
          username: data.username || username,
          rank: data.rank || 'Member'
        };
        localStorage.setItem('aetheria_player_user', JSON.stringify(playerData));

        showToast(`Selamat datang ${playerData.username}! Mengalihkan ke Dashboard Player...`, "success");
        setTimeout(() => {
          window.location.href = './players.html';
        }, 800);
      }

    } else {
      // Logic password salah / auth error
      clearAllSessions();
      const msg = (data && data.message) || "Username atau password in-game (/login) salah!";
      if (errorBox && errorText) {
        errorText.innerText = msg;
        errorBox.classList.remove('hidden');
      }
      if (passwordEl) {
        passwordEl.value = '';
        passwordEl.classList.add('border-rose-500');
        passwordEl.focus();
      }
      showToast(msg, "error");
    }
  } catch (err) {
    console.error('Login Error:', err);
    clearAllSessions();
    if (errorBox && errorText) {
      errorText.innerText = "Gagal terhubung ke server verifikasi AuthMe.";
      errorBox.classList.remove('hidden');
    }
    if (passwordEl) {
      passwordEl.classList.add('border-rose-500');
    }
    showToast("Kesalahan jaringan saat verifikasi akun.", "error");
  } finally {
    if (btn) {
      btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Masuk Sekarang`;
      btn.disabled = false;
    }
  }
}

function togglePasswordVisibility() {
  const passwordInput = document.getElementById('loginPassword');
  const icon = document.getElementById('togglePasswordIcon');
  if (!passwordInput || !icon) return;

  if (passwordInput.type === 'password') {
    passwordInput.type = 'text';
    icon.classList.remove('fa-eye');
    icon.classList.add('fa-eye-slash');
  } else {
    passwordInput.type = 'password';
    icon.classList.remove('fa-eye-slash');
    icon.classList.add('fa-eye');
  }
}

function forceResetSession() {
  clearAllSessions();
  showToast("Sesi berhasil direset. Silakan login kembali.", "info");
  setTimeout(() => {
    window.location.href = './login.html?reset=true';
  }, 300);
}
