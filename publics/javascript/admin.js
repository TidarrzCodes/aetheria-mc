const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";
const SERVER_DOMAIN = "aetheria.raditnex.my.id";

let ordersData = [];
let currentFilter = 'ALL';
let currentMainTab = 'orders';

// ==========================================
// UTILS: COOKIE HELPER
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
  document.cookie = name + '=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;';
}

// ==========================================
// TOAST NOTIFICATION SYSTEM (POJOK KANAN ATAS)
// ==========================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const isSuccess = type === 'success';
  const isError = type === 'error';

  const bgColor = isSuccess ? 'bg-zinc-900 border-emerald-500/50 text-emerald-400' :
                  isError ? 'bg-zinc-900 border-rose-500/50 text-rose-400' :
                  'bg-zinc-900 border-amber-500/50 text-amber-400';

  const icon = isSuccess ? 'fa-circle-check' : isError ? 'fa-circle-xmark' : 'fa-circle-info';

  toast.className = `pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl border ${bgColor} shadow-2xl font-mono text-xs transition-all duration-300 opacity-0 transform translate-y-[-10px] min-w-[260px] max-w-sm`;
  
  toast.innerHTML = `
    <i class="fa-solid ${icon} text-base shrink-0"></i>
    <span class="flex-1 font-medium text-white leading-snug">${message}</span>
    <button onclick="this.parentElement.remove()" class="text-zinc-500 hover:text-white transition ml-1 text-xs">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('opacity-0', 'translate-y-[-10px]');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-[-10px]');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
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

// ==========================================
// INITIALIZATION & COOKIE VERIFICATION
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  // Cek otentikasi dari Cookie atau Session Storage
  const adminCookie = getCookie('aetheria_admin_token');
  const sessionAuth = sessionStorage.getItem('aetheria_admin_auth');

  if (adminCookie || sessionAuth === 'true') {
    unlockDashboard();
  } else {
    window.location.href = './login.html';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeImageModal();
});

function unlockDashboard() {
  const dash = document.getElementById('dashboardContent');
  if (dash) dash.classList.remove('hidden');
  fetchOrders();
  fetchOnlinePlayers();
  setInterval(fetchOnlinePlayers, 30000);
}

function handleLogout() {
  eraseCookie('aetheria_admin_token');
  sessionStorage.removeItem('aetheria_admin_auth');
  localStorage.removeItem('aetheria_player_user');
  window.location.href = './login.html';
}

function switchMainTab(tabName) {
  currentMainTab = tabName;
  const viewOrders = document.getElementById('view-orders');
  const viewPlayers = document.getElementById('view-players');
  const btnOrders = document.getElementById('main-tab-orders');
  const btnPlayers = document.getElementById('main-tab-players');

  if (tabName === 'orders') {
    viewOrders.classList.remove('hidden');
    viewPlayers.classList.add('hidden');
    btnOrders.className = "px-3 py-1.5 rounded-md bg-zinc-800 text-white font-medium transition flex items-center gap-2";
    btnPlayers.className = "px-3 py-1.5 rounded-md text-zinc-400 hover:text-white transition flex items-center gap-2";
  } else {
    viewOrders.classList.add('hidden');
    viewPlayers.classList.remove('hidden');
    btnPlayers.className = "px-3 py-1.5 rounded-md bg-zinc-800 text-white font-medium transition flex items-center gap-2";
    btnOrders.className = "px-3 py-1.5 rounded-md text-zinc-400 hover:text-white transition flex items-center gap-2";
  }
}

function syncCurrentTab() {
  if (currentMainTab === 'orders') {
    fetchOrders();
  } else {
    fetchOnlinePlayers();
  }
  showToast("Data berhasil disinkronkan", "info");
}

// MODERASI PLAYER: KICK, BAN, INVSEE, & CUSTOM COMMAND
async function kickPlayer(username) {
  const reason = prompt(`Masukkan alasan kick untuk ${username}:`, "Dikeluarkan oleh Admin");
  if (reason === null) return;

  const command = `kick ${username} ${reason}`;
  await executeAdminCommand(command, `Player ${username} berhasil dikick!`);
  fetchOnlinePlayers();
}

async function banPlayer(username) {
  const reason = prompt(`Masukkan alasan BAN permanen untuk ${username}:`, "Melanggar aturan server");
  if (reason === null) return;

  const command = `ban ${username} ${reason}`;
  await executeAdminCommand(command, `Player ${username} berhasil dibanned!`);
  fetchOnlinePlayers();
}

async function invseePlayer(username) {
  const command = `invsee ${username}`;
  await executeAdminCommand(command, `Command "/invsee ${username}" dikirim ke konsol.`);
}

async function sendConsoleCommand(e) {
  e.preventDefault();
  const input = document.getElementById('consoleCommandInput');
  const command = input.value.trim();
  if (!command) return;

  await executeAdminCommand(command, `Command "${command}" dieksekusi!`);
  input.value = '';
}

async function executeAdminCommand(command, successMessage) {
  try {
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
    const res = await fetch(`${WORKER_PROXY_URL}?action=admin_command`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ command })
    });

    const json = await res.json();
    if (res.ok && json.result === 'success') {
      showToast(successMessage, "success");
    } else {
      showToast("Gagal: " + (json.message || "Error tidak diketahui"), "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Kesalahan koneksi ke Worker.", "error");
  }
}

function renderRankBadge(rankName) {
  const rank = (rankName || 'PLAYER').toUpperCase();
  if (rank.includes('OWNER')) {
    return `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">OWNER</span>`;
  }
  if (rank.includes('ADMIN')) {
    return `<span class="bg-rose-500/10 text-rose-300 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">ADMIN</span>`;
  }
  if (rank.includes('HELPER')) {
    return `<span class="bg-blue-500/10 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">HELPER</span>`;
  }
  if (rank.includes('DRAGONIAN')) {
    return `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">DRAGONIAN</span>`;
  }
  if (rank.includes('MVP')) {
    return `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">MVP</span>`;
  }
  if (rank.includes('VIP')) {
    return `<span class="bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">VIP</span>`;
  }
  return `<span class="bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">PLAYER</span>`;
}

async function fetchOnlinePlayers() {
  const dot = document.getElementById('player-tab-dot');
  const countText = document.getElementById('player-tab-count');
  const tableBody = document.getElementById('player-table-list');
  const badgeCount = document.getElementById('nav-player-badge');

  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`);
    const data = await response.json();

    if (data.online) {
      dot.className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse";
      const online = data.players ? data.players.online : 0;
      const max = data.players ? data.players.max : 0;
      countText.innerText = `${online} / ${max} Player Online`;
      badgeCount.innerText = online;

      if (data.players && data.players.list && data.players.list.length > 0) {
        tableBody.innerHTML = data.players.list.map(p => {
          const name = typeof p === 'object' ? p.name : p;
          const rank = typeof p === 'object' && p.group ? p.group : 'Member';
          const safeName = escapeHTML(name);

          return `
            <tr class="hover:bg-zinc-900/40 transition">
              <td class="p-3.5 w-12">
                <img src="https://mc-heads.net/avatar/${safeName}/28" alt="${safeName}" class="w-7 h-7 rounded border border-zinc-700">
              </td>
              <td class="p-3.5 font-semibold text-white font-mono">
                ${safeName}
              </td>
              <td class="p-3.5">
                ${renderRankBadge(rank)}
              </td>
              <td class="p-3.5 text-right font-mono">
                <div class="inline-flex items-center gap-1.5">
                  <button onclick="invseePlayer('${safeName}')" class="bg-blue-950/80 hover:bg-blue-900 border border-blue-600/50 text-blue-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1">
                    <i class="fa-solid fa-box-open text-[10px]"></i> Invsee
                  </button>
                  <button onclick="kickPlayer('${safeName}')" class="bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1">
                    <i class="fa-solid fa-user-minus text-[10px]"></i> Kick
                  </button>
                  <button onclick="banPlayer('${safeName}')" class="bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1">
                    <i class="fa-solid fa-gavel text-[10px]"></i> Ban
                  </button>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-zinc-500 font-mono">Belum ada player yang sedang online di server.</td></tr>`;
      }
    } else {
      dot.className = "w-3 h-3 rounded-full bg-rose-500";
      countText.innerText = "Server Offline / Maintenance";
      badgeCount.innerText = "0";
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-rose-400 font-mono">Server Minecraft sedang offline.</td></tr>`;
    }
  } catch (err) {
    dot.className = "w-3 h-3 rounded-full bg-amber-500";
    countText.innerText = "Gagal memuat data server";
    badgeCount.innerText = "!";
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-amber-500 font-mono">Gagal mengambil data dari API server Minecraft.</td></tr>`;
  }
}

async function fetchOrders() {
  const container = document.getElementById('order-list');
  const icon = document.getElementById('refresh-icon');
  icon.classList.add('fa-spin');

  try {
    const res = await fetch(WORKER_PROXY_URL);
    const json = await res.json();

    if (json.result === 'success') {
      ordersData = (json.data || []).reverse();
      renderOrders();
    } else {
      container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-400 font-mono">Gagal membaca data dari Proxy.</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-500 font-mono">Kesalahan koneksi Proxy Gateway endpoint.</td></tr>`;
  } finally {
    icon.classList.remove('fa-spin');
  }
}

function filterStatus(status) {
  currentFilter = status;
  ['ALL', 'PENDING', 'APPROVED', 'REJECTED'].forEach(st => {
    const btn = document.getElementById(`tab-${st}`);
    if (st === status) {
      btn.className = "px-3 py-1.5 rounded-md bg-zinc-800 text-white font-medium transition";
    } else {
      btn.className = "px-3 py-1.5 rounded-md text-zinc-400 hover:text-white transition";
    }
  });
  renderOrders();
}

function renderOrders() {
  const container = document.getElementById('order-list');
  document.getElementById('stat-total').innerText = ordersData.length;
  document.getElementById('stat-pending').innerText = ordersData.filter(o => o.status === 'PENDING').length;
  document.getElementById('stat-approved').innerText = ordersData.filter(o => o.status === 'APPROVED').length;

  const filtered = ordersData.filter(o => currentFilter === 'ALL' || o.status === currentFilter);
  document.getElementById('row-count').innerText = `${filtered.length} record(s)`;

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-zinc-500 font-mono">Tidak ada pesanan ditemukan.</td></tr>`;
    return;
  }

  container.innerHTML = filtered.map(ord => `
    <tr class="hover:bg-zinc-900/40 transition">
      <td class="p-3.5 font-mono">
        <span class="font-medium text-white block">${escapeHTML(ord.id)}</span>
        <span class="text-[10px] text-zinc-500">${escapeHTML(ord.timestamp)}</span>
      </td>
      <td class="p-3.5">
        <div class="flex items-center gap-2">
          <img src="https://mc-heads.net/avatar/${escapeHTML(ord.username)}/20" alt="${escapeHTML(ord.username)}" class="w-5 h-5 rounded border border-zinc-700">
          <span class="font-semibold text-zinc-200">${escapeHTML(ord.username)}</span>
        </div>
      </td>
      <td class="p-3.5">
        <span class="text-zinc-200 font-medium block">${escapeHTML(ord.itemName)}</span>
        <span class="text-[10px] font-mono text-zinc-500 uppercase">${escapeHTML(ord.category)}</span>
      </td>
      <td class="p-3.5 font-mono font-medium text-emerald-400">${escapeHTML(ord.price)}</td>
      <td class="p-3.5 text-center">
        <div class="inline-flex gap-1.5">
          <button onclick="viewImage('${escapeHTML(ord.proofUrl)}')" class="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded text-[11px] font-mono transition">
            Bukti
          </button>
          <button onclick="viewImage('${escapeHTML(ord.sigUrl)}')" class="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 px-2.5 py-1 rounded text-[11px] font-mono transition">
            TTD
          </button>
        </div>
      </td>
      <td class="p-3.5 text-center font-mono">
        ${getStatusBadge(ord.status)}
      </td>
      <td class="p-3.5 text-right font-mono">
        ${ord.status === 'PENDING' ? `
          <div class="inline-flex gap-1">
            <button onclick="updateStatus('${escapeHTML(ord.id)}', 'APPROVED', '${escapeHTML(ord.username)}', '${escapeHTML(ord.itemName)}')" class="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-2.5 py-1 rounded text-xs transition">
              Approve
            </button>
            <button onclick="updateStatus('${escapeHTML(ord.id)}', 'REJECTED', '${escapeHTML(ord.username)}', '${escapeHTML(ord.itemName)}')" class="bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 px-2.5 py-1 rounded text-xs transition">
              Reject
            </button>
          </div>
        ` : `<span class="text-zinc-600 text-[11px]">&mdash;</span>`}
      </td>
    </tr>
  `).join('');
}

function getStatusBadge(status) {
  if (status === 'APPROVED') return `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-medium">APPROVED</span>`;
  if (status === 'REJECTED') return `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[10px] font-medium">REJECTED</span>`;
  return `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-medium">PENDING</span>`;
}

async function updateStatus(id, newStatus, username, itemName) {
  const confirmMsg = newStatus === 'APPROVED' 
    ? `Setujui pesanan ${id} untuk ${username} (${itemName}) & kirim rank/coins ke server?`
    : `Tolak pesanan ${id}?`;

  if (!confirm(confirmMsg)) return;

  try {
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
    const res = await fetch(`${WORKER_PROXY_URL}?action=update_status`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({
        id: id,
        status: newStatus,
        username: username,
        itemName: itemName
      })
    });

    const json = await res.json();

    if (res.ok && json.result === 'success') {
      showToast(`Status berhasil diperbarui ke ${newStatus}!`, "success");
      fetchOrders();
    } else {
      showToast("Gagal memperbarui database: " + (json.message || "Error tidak diketahui"), "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Kesalahan koneksi saat memperbarui status.", "error");
  }
}

function viewImage(url) {
  document.getElementById('modalImg').src = url;
  document.getElementById('imageModal').classList.remove('hidden');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
}