const ADMIN_PASSWORD = "adminaetheria";
// SECURE PROXY ENDPOINT VIA CLOUDFLARE WORKER
const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";
const SERVER_DOMAIN = "aetheria.raditnex.my.id";

let ordersData = [];
let currentFilter = 'ALL';
let currentMainTab = 'orders';

// HELPER SANITASI XSS (ANTI-SCRIPT INJECTION)
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

window.addEventListener('DOMContentLoaded', () => {
  if (sessionStorage.getItem('aetheria_admin_auth') === 'true') {
    unlockDashboard();
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeImageModal();
});

function handleLogin(e) {
  e.preventDefault();
  const pwd = document.getElementById('passwordInput').value;
  const errorMsg = document.getElementById('loginError');

  if (pwd === ADMIN_PASSWORD) {
    sessionStorage.setItem('aetheria_admin_auth', 'true');
    errorMsg.classList.add('hidden');
    unlockDashboard();
  } else {
    errorMsg.classList.remove('hidden');
  }
}

function unlockDashboard() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('dashboardContent').classList.remove('hidden');
  fetchOrders();
  fetchOnlinePlayers();
  setInterval(fetchOnlinePlayers, 30000);
}

function handleLogout() {
  sessionStorage.removeItem('aetheria_admin_auth');
  location.reload();
}

// MAIN TAB SWITCHER (ORDERS VS PLAYERS)
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
}

// RANK BADGE FORMATTER
function renderRankBadge(rankName) {
  const rank = (rankName || 'MEMBER').toUpperCase();
  if (rank.includes('DRAGONIAN') || rank.includes('OWNER') || rank.includes('ADMIN')) {
    return `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">DRAGONIAN</span>`;
  }
  if (rank.includes('MVP')) {
    return `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">MVP</span>`;
  }
  if (rank.includes('VIP')) {
    return `<span class="bg-amber-400/10 text-amber-300 border border-amber-400/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide">VIP</span>`;
  }
  return `<span class="bg-zinc-800 text-zinc-400 border border-zinc-700 px-2 py-0.5 rounded text-[10px] font-mono font-semibold">MEMBER</span>`;
}

// FETCH ONLINE PLAYERS FROM SERVER API
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
          return `
            <tr class="hover:bg-zinc-900/40 transition">
              <td class="p-3.5 w-12">
                <img src="https://mc-heads.net/avatar/${escapeHTML(name)}/28" alt="${escapeHTML(name)}" class="w-7 h-7 rounded border border-zinc-700">
              </td>
              <td class="p-3.5 font-semibold text-white font-mono">
                ${escapeHTML(name)}
              </td>
              <td class="p-3.5">
                ${renderRankBadge(rank)}
              </td>
              <td class="p-3.5 text-right font-mono">
                <span class="inline-flex items-center gap-1.5 text-emerald-400 text-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                </span>
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

// FETCH ORDERS FROM CLOUDFLARE WORKER PROXY
async function fetchOrders() {
  const container = document.getElementById('order-list');
  const icon = document.getElementById('refresh-icon');
  icon.classList.add('fa-spin');

  try {
    const res = await fetch(WORKER_PROXY_URL);
    const json = await res.json();

    if (json.result === 'success') {
      ordersData = json.data.reverse();
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
            <button onclick="updateStatus('${escapeHTML(ord.id)}', 'APPROVED')" class="bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/50 text-emerald-300 px-2.5 py-1 rounded text-xs transition">
              Approve
            </button>
            <button onclick="updateStatus('${escapeHTML(ord.id)}', 'REJECTED')" class="bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 px-2.5 py-1 rounded text-xs transition">
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

// UPDATE STATUS VIA CLOUDFLARE WORKER PROXY
async function updateStatus(id, newStatus) {
  if (!confirm(`Ubah status ${id} -> ${newStatus}?`)) return;

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=updateStatus&id=${id}&status=${newStatus}`);
    const json = await res.json();

    if (json.result === 'success') {
      fetchOrders();
    } else {
      alert("Gagal memperbarui database.");
    }
  } catch (err) {
    alert("Kesalahan koneksi.");
  }
}

function viewImage(url) {
  document.getElementById('modalImg').src = url;
  document.getElementById('imageModal').classList.remove('hidden');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
}