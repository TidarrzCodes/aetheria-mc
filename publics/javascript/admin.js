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
  syncCurrentTab();
  setInterval(syncCurrentTab, 5000);
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
    fetchOrders();
  } else {
    viewOrders.classList.add('hidden');
    viewPlayers.classList.remove('hidden');
    btnPlayers.className = "px-3 py-1.5 rounded-md bg-zinc-800 text-white font-medium transition flex items-center gap-2";
    btnOrders.className = "px-3 py-1.5 rounded-md text-zinc-400 hover:text-white transition flex items-center gap-2";
    fetchOnlinePlayers();
  }
}

function syncCurrentTab() {
  if (currentMainTab === 'orders') {
    fetchOrders();
  } else {
    fetchOnlinePlayers();
  }
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
  const btn = document.getElementById('btnSendConsole');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin text-[11px]"></i> Memproses...`;
  }

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

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success') {
      showToast(successMessage || `Command "${command}" dieksekusi!`, "success");
      appendConsoleOutput(command, json.output || "");
    } else {
      const errorMsg = (json && json.message) || "Error tidak diketahui";
      showToast("Gagal: " + errorMsg, "error");
      appendConsoleOutput(command, errorMsg, true);
    }
  } catch (err) {
    console.error(err);
    showToast("Kesalahan koneksi ke Worker.", "error");
    appendConsoleOutput(command, "Kesalahan jaringan saat menghubungi Cloudflare Worker.", true);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-paper-plane text-[11px]"></i> Kirim Command`;
    }
  }
}

function appendConsoleOutput(command, output, isError = false) {
  const terminal = document.getElementById('consoleTerminalWindow');
  if (!terminal) return;

  const cmdLine = document.createElement('div');
  cmdLine.className = "text-white font-medium font-mono pt-1";
  cmdLine.innerText = command;
  terminal.appendChild(cmdLine);

  if (output && output.trim()) {
    const outLine = document.createElement('pre');
    outLine.className = isError 
      ? "text-rose-400 whitespace-pre-wrap font-mono leading-relaxed text-xs" 
      : "text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed text-xs";
    outLine.innerText = output.trim();
    terminal.appendChild(outLine);
  }

  terminal.scrollTop = terminal.scrollHeight;
}

function clearConsoleLog() {
  const terminal = document.getElementById('consoleTerminalWindow');
  if (terminal) {
    terminal.innerHTML = `<div class="text-zinc-500 text-[11px]">// Live Console Terminal Ready. Type command below...</div>`;
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
  if (icon) icon.classList.add('fa-spin');

  try {
    const res = await fetch(WORKER_PROXY_URL);
    const json = await res.json();

    if (json.result === 'success') {
      ordersData = (json.data || []).reverse();
      renderOrders();
    } else {
      if (container) container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-400 font-mono">Gagal membaca data dari Proxy.</td></tr>`;
    }
  } catch (err) {
    console.error(err);
    if (container) container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-500 font-mono">Kesalahan koneksi Proxy Gateway endpoint.</td></tr>`;
  } finally {
    if (icon) icon.classList.remove('fa-spin');
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
      <td class="p-3.5 font-mono font-medium text-emerald-400">${formatRupiah(ord.price)}</td>
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

function formatRupiah(val) {
  if (val === undefined || val === null || val === '') return 'Rp 0';
  const numStr = String(val).replace(/[^0-9]/g, '');
  if (!numStr) return escapeHTML(val);
  return 'Rp ' + Number(numStr).toLocaleString('id-ID');
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

  // Simpan status lama untuk rollback jika error
  const targetIndex = ordersData.findIndex(o => String(o.id) === String(id));
  const oldStatus = targetIndex !== -1 ? ordersData[targetIndex].status : null;

  // Optimistic UI Update: Langsung ubah status di tampilan lokal
  if (targetIndex !== -1) {
    ordersData[targetIndex].status = newStatus;
    renderOrders();
  }

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
      // Rollback jika server return error
      if (targetIndex !== -1 && oldStatus) {
        ordersData[targetIndex].status = oldStatus;
        renderOrders();
      }
      showToast("Gagal memperbarui database: " + (json.message || "Error tidak diketahui"), "error");
    }
  } catch (err) {
    console.error(err);
    if (targetIndex !== -1 && oldStatus) {
      ordersData[targetIndex].status = oldStatus;
      renderOrders();
    }
    showToast("Kesalahan koneksi saat memperbarui status.", "error");
  }
}

function extractGDriveFileId(url) {
  if (!url) return null;
  const str = String(url).trim();
  const matchFile = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  const matchId = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return matchFile ? matchFile[1] : (matchId ? matchId[1] : null);
}

function viewImage(url) {
  if (!url || url.trim() === '' || url === 'null' || url === 'undefined') {
    showToast("Gambar tidak tersedia / belum diunggah untuk pesanan ini.", "error");
    return;
  }

  const rawUrl = String(url).trim();
  const modalImg = document.getElementById('modalImg');
  const modalIframe = document.getElementById('modalIframe');
  const modalLoading = document.getElementById('modalLoading');
  const modalImgLink = document.getElementById('modalImgLink');

  // Reset display
  if (modalImg) modalImg.classList.add('hidden');
  if (modalIframe) modalIframe.classList.add('hidden');
  if (modalLoading) modalLoading.classList.remove('hidden');
  if (modalImgLink) modalImgLink.href = rawUrl;

  const modal = document.getElementById('imageModal');
  if (modal) modal.classList.remove('hidden');

  const fileId = extractGDriveFileId(rawUrl);

  // CASE 1: Base64 Image Data (Misal TTD Canvas Signature Pad)
  if (rawUrl.startsWith('data:image')) {
    if (modalImg) {
      modalImg.src = rawUrl;
      modalImg.onload = () => {
        if (modalLoading) modalLoading.classList.add('hidden');
        modalImg.classList.remove('hidden');
      };
    }
    return;
  }

  // CASE 2: Google Drive File URL (Gunakan GDrive Embedded Preview iFrame)
  if (fileId) {
    const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    if (modalIframe) {
      modalIframe.src = previewUrl;
      modalIframe.onload = () => {
        if (modalLoading) modalLoading.classList.add('hidden');
        modalIframe.classList.remove('hidden');
      };
    }
    return;
  }

  // CASE 3: Standard Image URL Direct Link
  if (modalImg) {
    modalImg.src = rawUrl;
    modalImg.onload = () => {
      if (modalLoading) modalLoading.classList.add('hidden');
      modalImg.classList.remove('hidden');
    };
    modalImg.onerror = () => {
      if (modalLoading) modalLoading.classList.add('hidden');
      showToast("Gagal memuat gambar dari URL tersebut.", "error");
    };
  }
}

function closeImageModal() {
  const modal = document.getElementById('imageModal');
  const modalIframe = document.getElementById('modalIframe');
  const modalImg = document.getElementById('modalImg');

  if (modalIframe) modalIframe.src = '';
  if (modalImg) modalImg.src = '';
  if (modal) modal.classList.add('hidden');
}