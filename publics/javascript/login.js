const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";

// COOKIE HELPER
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

// EMBERS PARTICLE ENGINE
(function initEmbers() {
  const canvas = document.getElementById('emberCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const embers = Array.from({ length: 50 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 2 + 0.5,
    dx: (Math.random() - 0.5) * 0.5,
    dy: -Math.random() * 1.2 - 0.3,
    alpha: Math.random() * 0.8 + 0.2
  }));

  function draw() {
    ctx.clearRect(0, 0, width, height);
    embers.forEach(e => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${e.alpha})`;
      ctx.fill();

      e.x += e.dx;
      e.y += e.dy;

      if (e.y < 0) {
        e.y = height + 10;
        e.x = Math.random() * width;
      }
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

// CHECK ACTIVE SESSION ON LOAD
document.addEventListener('DOMContentLoaded', () => {
  const adminCookie = getCookie('aetheria_admin_token');
  const sessionAuth = sessionStorage.getItem('aetheria_admin_auth');
  const playerUser = localStorage.getItem('aetheria_player_user');

  if (adminCookie || sessionAuth === 'true') {
    showToast("Anda sudah login sebagai Staff/Admin. Mengalihkan...", "info");
    setTimeout(() => {
      window.location.href = './admin.html';
    }, 1000);
  } else if (playerUser) {
    try {
      const data = JSON.parse(playerUser);
      showToast(`Selamat datang kembali, ${data.username}! Mengalihkan...`, "info");
      setTimeout(() => {
        window.location.href = './players.html';
      }, 1000);
    } catch (e) {}
  }
});

// SUBMIT LOGIN FORM HANDLER
async function handleLoginSubmit(e) {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorBox = document.getElementById('loginError');
  const errorText = document.getElementById('loginErrorText');
  const btn = document.getElementById('btnLogin');

  if (!username || !password) return;

  errorBox.classList.add('hidden');
  btn.innerText = "Memverifikasi...";
  btn.disabled = true;

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=player_login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data && data.result === 'success') {
      const rankUpper = (data.rank || '').toUpperCase();
      const staffRanks = ['OWNER', 'ADMIN', 'HELPER'];
      const isStaff = staffRanks.some(r => rankUpper.includes(r));

      if (isStaff) {
        // Staff Authentication
        const staffToken = data.token || btoa(JSON.stringify({ username: data.username || username, rank: data.rank, time: Date.now() }));
        setCookie('aetheria_admin_token', staffToken, 1);
        sessionStorage.setItem('aetheria_admin_auth', 'true');

        showToast(`Login Staff Berhasil (${data.rank})! Mengalihkan ke Dashboard Staff...`, "success");
        setTimeout(() => {
          window.location.href = './admin.html';
        }, 1000);
      } else {
        // Player Authentication
        const playerData = {
          username: data.username || username,
          rank: data.rank || 'Member'
        };
        localStorage.setItem('aetheria_player_user', JSON.stringify(playerData));

        showToast(`Selamat datang ${playerData.username}! Mengalihkan ke Dashboard...`, "success");
        setTimeout(() => {
          window.location.href = './players.html';
        }, 1000);
      }

    } else {
      const msg = (data && data.message) || "Username atau password in-game (/login) salah!";
      errorText.innerText = msg;
      errorBox.classList.remove('hidden');
      showToast(msg, "error");
    }
  } catch (err) {
    console.error('Login Error:', err);
    errorText.innerText = "Gagal terhubung ke server verifikasi AuthMe.";
    errorBox.classList.remove('hidden');
    showToast("Kesalahan jaringan saat verifikasi akun.", "error");
  } finally {
    btn.innerHTML = `<i class="fa-solid fa-right-to-bracket"></i> Masuk Sekarang`;
    btn.disabled = false;
  }
}
