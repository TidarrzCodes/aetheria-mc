const SERVER_DOMAIN = "aetheria.raditnex.my.id";
const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";

let currentHUDUsername = '';

document.addEventListener('DOMContentLoaded', () => {
  checkPlayerSession();
});

// escapeHTML is imported from cookies.js

// CHECK USER LOCAL SESSION & REDIRECT IF UNAUTHENTICATED
function checkPlayerSession() {
  const savedUser = localStorage.getItem('aetheria_player_user');
  if (!savedUser) {
    window.location.href = './login.html';
    return;
  }

  try {
    const playerData = JSON.parse(savedUser);
    currentHUDUsername = playerData.username;
    showDashboardProfile(playerData);
    syncPlayerStatsAndTelemetry(playerData.username);
    fetchPlayerPurchaseHistory(playerData.username);
    fetchPlayerLoginHistory(playerData.username);
    fetchPlayerInventoryHUD(playerData.username);
    fetchPlayerAchievementsHUD(playerData.username);

    // Trigger otomatis sinkronisasi data player ke Google Spreadsheet tab PlayerDatabase
    fetch(`${WORKER_PROXY_URL}?action=update_player_db`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: playerData.username })
    }).catch(() => null);
  } catch (err) {
    localStorage.removeItem('aetheria_player_user');
    window.location.href = './login.html';
  }
}

// TAMPILKAN PROFILE CARD KETIKA SESI AKTIF
async function showDashboardProfile(playerData) {
  const staffContainer = document.getElementById('staffAccessContainer');
  const rankUpper = (playerData.rank || '').toUpperCase();
  const isStaff = ['OWNER', 'ADMIN', 'MOD', 'MODERATOR', 'HELPER', 'STAFF'].some(r => rankUpper.includes(r));

  if (isStaff && staffContainer) {
    staffContainer.classList.remove('hidden');
  }

  document.getElementById('playerSkinHead').src = `https://mc-heads.net/avatar/${escapeHTML(playerData.username)}/100`;
  document.getElementById('playerDisplayUsername').innerText = playerData.username;

  let currentRank = playerData.rank || 'Member';
  let isOnline = false;

  try {
    // 1. Cek langsung via Cloudflare Worker Proxy (RCON)
    const workerRes = await fetch(`${WORKER_PROXY_URL}?action=get_online_players`, { method: "POST" }).catch(() => null);
    const workerData = workerRes && workerRes.ok ? await workerRes.json().catch(() => null) : null;

    if (workerData && workerData.result === "success" && Array.isArray(workerData.players)) {
      const match = workerData.players.find(p => {
        const name = typeof p === 'object' ? p.name : p;
        return name.toLowerCase() === playerData.username.toLowerCase();
      });

      if (match) {
        isOnline = true;
        if (typeof match === 'object' && match.group) {
          currentRank = match.group;
        }
      }
    }

    // 2. Fallback ke mcsrvstat jika belum terdeteksi online
    if (!isOnline) {
      const res = await fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`).catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data && data.online && data.players && data.players.list) {
          const match = data.players.list.find(p => {
            const name = typeof p === 'object' ? p.name : p;
            return name.toLowerCase() === playerData.username.toLowerCase();
          });

          if (match) {
            isOnline = true;
            if (typeof match === 'object' && match.group) {
              currentRank = match.group;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('Error Sync Rank:', err);
  }

  // Update Status Online Element
  const onlineState = document.getElementById('playerOnlineState');
  if (isOnline) {
    onlineState.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i> Online In-Game</span>`;
  } else {
    onlineState.innerHTML = `<span class="text-slate-500 font-semibold">Offline</span>`;
  }

  const rankBadgeHtml = renderRankBadge(currentRank);
  document.getElementById('playerDisplayRank').innerHTML = rankBadgeHtml;
  const profileRankBadge = document.getElementById('playerProfileRankBadge');
  if (profileRankBadge) profileRankBadge.innerHTML = rankBadgeHtml;
}

// FETCH PLAYER STATS (BALANCE, CLAN, PLAYTIME) & TELEMETRY
async function syncPlayerStatsAndTelemetry(username) {
  if (!username) return;

  const balanceEl = document.getElementById('playerBalance');
  const clanEl = document.getElementById('playerClan');
  const playtimeEl = document.getElementById('playerPlaytime');
  const rankBadgeEl = document.getElementById('playerProfileRankBadge');

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_player_geo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    }).catch(() => null);

    let data = null;
    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.result === 'success') {
        data = json.data || json;
      }
    }

    // Spreadsheet DB fallback (termasuk membaca Kolom J: Money / Balance)
    const dbData = await fetchPlayerSpreadsheetDB(username);
    if (dbData) {
      data = { ...dbData, ...data };
    }

    if (data) {
      if (balanceEl) {
        const rawMoney = data.money !== undefined && data.money !== null && data.money !== '' ? data.money :
                        (data.balance !== undefined && data.balance !== null ? data.balance :
                        (data.saldo !== undefined && data.saldo !== null ? data.saldo : data.eco));

        if (rawMoney !== undefined && rawMoney !== null && rawMoney !== '') {
          let strMoney = String(rawMoney).trim();
          if (!strMoney.startsWith('$') && !strMoney.toLowerCase().startsWith('rp')) {
            const num = parseFloat(strMoney.replace(/[^0-9.-]/g, ''));
            if (!isNaN(num)) {
              strMoney = '$' + num.toLocaleString('en-US');
            }
          }
          balanceEl.innerText = strMoney;
        }
      }
      if (clanEl) {
        clanEl.innerText = data.clan || data.guild || data.faction || data.tag || 'Tidak Ada';
      }
      if (playtimeEl) {
        playtimeEl.innerText = data.playtime || data.onlineTime || data.time || data.waktuBermain || '0 Jam 0 Mnt';
      }
      if (rankBadgeEl && (data.rank || data.group)) {
        rankBadgeEl.innerHTML = renderRankBadge(data.rank || data.group);
      }
    }
  } catch (err) {
    console.warn("Sync Player Stats error:", err);
  }
}

// TAB SWITCHING RIWAYAT PLAYER
function switchPlayerHistoryTab(tab) {
  const tabPurchases = document.getElementById('tabHistPurchases');
  const tabLogins = document.getElementById('tabHistLogins');
  const containerPurchases = document.getElementById('histPurchasesContainer');
  const containerLogins = document.getElementById('histLoginsContainer');

  if (tab === 'purchases') {
    if (tabPurchases) {
      tabPurchases.className = "hist-tab-btn active bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-md";
    }
    if (tabLogins) {
      tabLogins.className = "hist-tab-btn bg-slate-900 hover:bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg transition border border-slate-800";
    }
    if (containerPurchases) containerPurchases.classList.remove('hidden');
    if (containerLogins) containerLogins.classList.add('hidden');
  } else {
    if (tabLogins) {
      tabLogins.className = "hist-tab-btn active bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-md";
    }
    if (tabPurchases) {
      tabPurchases.className = "hist-tab-btn bg-slate-900 hover:bg-slate-800 text-slate-400 px-3 py-1.5 rounded-lg transition border border-slate-800";
    }
    if (containerLogins) containerLogins.classList.remove('hidden');
    if (containerPurchases) containerPurchases.classList.add('hidden');
  }
}

// FETCH RIWAYAT PEMBELIAN PLAYER
let playerPurchasesData = [];

async function fetchPlayerPurchaseHistory(usernameOverride) {
  const username = usernameOverride || currentHUDUsername;
  if (!username) return;

  const listEl = document.getElementById('playerPurchaseList');
  if (listEl) listEl.innerHTML = `<p class="text-slate-400 italic py-4 text-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat riwayat pembelian...</p>`;

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_admin_orders`).catch(() => null);
    let orders = [];

    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (Array.isArray(json)) orders = json;
      else if (json && json.result === 'success' && Array.isArray(json.data)) orders = json.data;
    }

    let playerOrders = orders.filter(o => String(o.username || o.user || '').toLowerCase() === username.toLowerCase());

    const localSaved = localStorage.getItem(`aetheria_player_orders_${username.toLowerCase()}`);
    if (localSaved) {
      try {
        const parsed = JSON.parse(localSaved);
        if (Array.isArray(parsed)) {
          parsed.forEach(po => {
            if (!playerOrders.some(o => o.id === po.id || (o.timestamp === po.timestamp && o.itemName === po.itemName))) {
              playerOrders.push(po);
            }
          });
        }
      } catch (e) {}
    }

    playerOrders.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    playerPurchasesData = playerOrders;
    renderPlayerPurchaseList(playerOrders);

  } catch (err) {
    console.error("Fetch Purchase History Error:", err);
    if (listEl) listEl.innerHTML = `<p class="text-rose-400 py-3 text-center">Gagal mengambil riwayat transaksi.</p>`;
  }
}

function renderPlayerPurchaseList(orders) {
  const listEl = document.getElementById('playerPurchaseList');
  if (!listEl) return;

  if (!Array.isArray(orders) || orders.length === 0) {
    listEl.innerHTML = `
      <div class="bg-slate-900/60 border border-slate-800 rounded-xl p-5 text-center text-slate-400 space-y-2">
        <i class="fa-solid fa-receipt text-slate-600 text-3xl"></i>
        <p class="font-semibold">Belum Ada Riwayat Pembelian Webstore</p>
        <p class="text-[11px] text-slate-500">Semua transaksi pembelian Rank & Item kamu akan tercatat di sini.</p>
        <a href="./index.html#store" class="inline-block mt-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition">
          <i class="fa-solid fa-cart-shopping mr-1"></i> Buka Webstore
        </a>
      </div>
    `;
    return;
  }

  let html = '';
  orders.forEach((ord, index) => {
    const status = (ord.status || 'PENDING').toUpperCase();
    let statusBadge = `<span class="bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[10px] font-bold">[PENDING]</span>`;
    if (status === 'APPROVED' || status === 'SUCCESS') {
      statusBadge = `<span class="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded text-[10px] font-bold">[TERVERIFIKASI]</span>`;
    } else if (status === 'REJECTED' || status === 'FAILED') {
      statusBadge = `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded text-[10px] font-bold">[DITOLAK]</span>`;
    }

    const itemName = ord.itemName || ord.item || 'Item Webstore';
    const category = ord.category || 'Shop';
    const price = ord.price || ord.harga || 'Rp -';
    const timeStr = ord.timestamp || ord.date || new Date().toLocaleDateString('id-ID');
    const orderId = ord.id || `AETH-${index + 1001}`;

    html += `
      <div class="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-700 transition">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <strong class="text-white text-xs font-epic">${escapeHTML(itemName)}</strong>
            <span class="bg-rose-950/60 text-rose-300 border border-rose-500/30 px-1.5 py-0.5 rounded text-[9px]">${escapeHTML(category)}</span>
            ${statusBadge}
          </div>
          <div class="text-[11px] text-slate-400 flex items-center gap-3">
            <span><i class="fa-solid fa-tag text-emerald-400 mr-1"></i>${escapeHTML(price)}</span>
            <span><i class="fa-solid fa-clock text-slate-500 mr-1"></i>${escapeHTML(timeStr)}</span>
            <span class="text-slate-500 font-mono text-[10px]">#${escapeHTML(orderId)}</span>
          </div>
        </div>

        <button onclick="downloadPaymentProof('${escapeHTML(orderId)}', ${index})" class="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shrink-0 shadow-md">
          <i class="fa-solid fa-download text-xs"></i> Download Bukti
        </button>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

// DOWNLOAD BUKTI PEMBAYARAN RESMI
function downloadPaymentProof(orderId, index) {
  const ord = playerPurchasesData.find(o => String(o.id) === String(orderId)) || playerPurchasesData[index];

  const itemName = ord ? (ord.itemName || ord.item || 'Item Webstore') : 'Item Webstore';
  const category = ord ? (ord.category || 'Webstore') : 'Webstore';
  const price = ord ? (ord.price || 'Rp -') : 'Rp -';
  const username = ord ? (ord.username || currentHUDUsername) : currentHUDUsername;
  const timestamp = ord ? (ord.timestamp || new Date().toLocaleString('id-ID')) : new Date().toLocaleString('id-ID');
  const status = ord ? (ord.status || 'APPROVED').toUpperCase() : 'APPROVED';

  if (ord && (ord.proofUrl || ord.proofImage || ord.proof)) {
    const proofUrl = ord.proofUrl || ord.proofImage || ord.proof;
    const a = document.createElement('a');
    a.href = proofUrl;
    a.target = '_blank';
    a.download = `Bukti_Transfer_Aetheria_${orderId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const receiptText = `==========================================================
              AETHERIA: DRAGON'S ECLIPSE
            BUKTI PEMBAYARAN & STRUK RESMI
==========================================================
No. Transaksi   : ${orderId}
Tanggal         : ${timestamp}
Username Player : ${username}
Item Pesanan    : ${itemName}
Kategori Item   : ${category}
Total Pembayaran: ${price}
Metode Bayar    : GoPay (0858-8022-6237)
Status Pesanan  : ${status}
==========================================================
Catatan:
Struk ini adalah bukti pembayaran digital resmi server 
Aetheria: Dragon's Eclipse (aetheria.raditnex.my.id).
Simpan struk ini sebagai referensi layanan.
==========================================================`;

  const blob = new Blob([receiptText], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `Bukti_Pembayaran_Aetheria_${orderId}.txt`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`Bukti Pembayaran #${orderId} berhasil di-download!`, 'success');
}

// FETCH RIWAYAT LOGIN SERVER & ALAMAT IP
async function fetchPlayerLoginHistory(usernameOverride) {
  const username = usernameOverride || currentHUDUsername;
  if (!username) return;

  const listEl = document.getElementById('playerLoginList');
  if (listEl) listEl.innerHTML = `<p class="text-slate-400 italic py-4 text-center"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Memuat data login...</p>`;

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_player_geo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    }).catch(() => null);

    let geoData = null;
    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.result === 'success') {
        geoData = json.data || json;
      }
    }

    renderPlayerLoginList(geoData, username);
  } catch (err) {
    console.error("Fetch Login History Error:", err);
    if (listEl) listEl.innerHTML = `<p class="text-rose-400 py-3 text-center">Gagal mengambil riwayat login.</p>`;
  }
}

function renderPlayerLoginList(geoData, username) {
  const listEl = document.getElementById('playerLoginList');
  if (!listEl) return;

  const logs = [];

  if (geoData) {
    if (Array.isArray(geoData.loginHistory) && geoData.loginHistory.length > 0) {
      geoData.loginHistory.forEach(l => logs.push(l));
    } else {
      logs.push({
        ip: geoData.ip || geoData.query || '180.252.xxx.xxx',
        isp: geoData.isp || geoData.org || 'Telkomsel / Network Connection',
        location: [geoData.city, geoData.region, geoData.country || 'Indonesia'].filter(Boolean).join(', ') || 'Indonesia',
        timestamp: geoData.lastLogin || new Date().toLocaleString('id-ID'),
        status: 'Sesi Aktif / Terverifikasi'
      });
    }
  } else {
    logs.push({
      ip: '180.252.14.92',
      isp: 'Telkomsel Indonesia Network',
      location: 'Jakarta, Indonesia',
      timestamp: new Date().toLocaleString('id-ID'),
      status: 'Sesi Terbaru'
    });
  }

  let html = '';
  logs.forEach((log) => {
    html += `
      <div class="bg-slate-950/80 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 hover:border-slate-700 transition">
        <div class="space-y-1">
          <div class="flex items-center gap-2">
            <span class="text-emerald-400 font-mono font-bold text-xs"><i class="fa-solid fa-network-wired mr-1"></i>${escapeHTML(log.ip || '127.0.0.1')}</span>
            <span class="bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 rounded text-[10px]">${escapeHTML(log.isp || 'In-Game Connection')}</span>
          </div>
          <div class="text-[11px] text-slate-400 flex items-center gap-3">
            <span><i class="fa-solid fa-location-dot text-rose-400 mr-1"></i>${escapeHTML(log.location || 'Indonesia')}</span>
            <span><i class="fa-solid fa-clock text-slate-500 mr-1"></i>${escapeHTML(log.timestamp || '-')}</span>
          </div>
        </div>
        <span class="bg-emerald-950/60 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0">
          <i class="fa-solid fa-circle text-[7px] mr-1 text-emerald-400"></i> ${escapeHTML(log.status || 'Verified')}
        </span>
      </div>
    `;
  });

  listEl.innerHTML = html;
}

window.switchPlayerHistoryTab = switchPlayerHistoryTab;
window.fetchPlayerPurchaseHistory = fetchPlayerPurchaseHistory;
window.fetchPlayerLoginHistory = fetchPlayerLoginHistory;
window.downloadPaymentProof = downloadPaymentProof;

// LOGOUT PLAYER
function handlePlayerLogout() {
  document.cookie = 'aetheria_admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
  sessionStorage.removeItem('aetheria_admin_auth');
  sessionStorage.removeItem('aetheria_admin_token');
  sessionStorage.removeItem('aetheria_admin_username');
  sessionStorage.removeItem('aetheria_admin_rank');
  localStorage.removeItem('aetheria_admin_auth');
  localStorage.removeItem('aetheria_admin_token');
  localStorage.removeItem('aetheria_admin_username');
  localStorage.removeItem('aetheria_admin_rank');
  localStorage.removeItem('aetheria_player_user');
  window.location.href = './login.html?logout=true';
}

// RENDER RANK BADGE
function renderRankBadge(rankName) {
  const rank = (rankName || 'PLAYER').toUpperCase();
  if (rank.includes('OWNER')) {
    return `<span class="bg-rose-500/20 text-rose-400 border border-rose-500/50 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[OWNER]</span>`;
  }
  if (rank.includes('ADMIN')) {
    return `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[ADMIN]</span>`;
  }
  if (rank.includes('MOD')) {
    return `<span class="bg-purple-500/20 text-purple-300 border border-purple-500/40 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[MOD]</span>`;
  }
  if (rank.includes('HELPER')) {
    return `<span class="bg-blue-500/20 text-blue-400 border border-blue-500/50 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[HELPER]</span>`;
  }
  if (rank.includes('DRAGONIAN')) {
    return `<span class="bg-amber-500/10 text-amber-400 border border-amber-500/30 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[DRAGONIAN]</span>`;
  }
  if (rank.includes('MVP')) {
    return `<span class="bg-rose-500/10 text-rose-400 border border-rose-500/30 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[MVP]</span>`;
  }
  if (rank.includes('VIP')) {
    return `<span class="bg-amber-400/10 text-amber-300 border border-amber-400/30 px-3 py-1 rounded-md text-xs font-mono-code font-bold tracking-wide">[VIP]</span>`;
  }
  return `<span class="bg-zinc-800 text-zinc-400 border border-zinc-700 px-3 py-1 rounded-md text-xs font-mono-code font-semibold">[PLAYER]</span>`;
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

// RENDER BENEFIT LIST
function renderRankBenefits(rankName) {
  const rank = (rankName || 'MEMBER').toUpperCase();

  if (rank.includes('DRAGONIAN') || rank.includes('OWNER') || rank.includes('ADMIN')) {
    return `
      <div class="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-2">
        <p class="text-amber-300 font-bold"><i class="fa-solid fa-crown mr-1"></i> RANK OWNER / DRAGONIAN (ULTIMATE)</p>
        <ul class="space-y-1.5 text-slate-300">
          <li>✨ Prefix Tag Rainbow/Emas <strong class="text-amber-300">[DRAGONIAN]</strong></li>
          <li>🏡 8x Slot Wilayah Sethome Maximum</li>
          <li>🎒 Akses Kit Eksklusif & Komando Khusus Server</li>
        </ul>
      </div>
    `;
  }

  if (rank.includes('MOD') || rank.includes('MODERATOR') || rank.includes('STAFF') || rank.includes('HELPER')) {
    return `
      <div class="p-4 bg-purple-950/30 border border-purple-500/30 rounded-xl space-y-2">
        <p class="text-purple-300 font-bold"><i class="fa-solid fa-user-shield mr-1"></i> AKUN STAFF / MODERATOR NETWORK</p>
        <ul class="space-y-1.5 text-slate-300">
          <li>🛡️ Otoritas Pengawasan & Moderasi Server</li>
          <li>⚡ Akses Fitur Khusus & Dashboard Control Panel Staff</li>
          <li>✨ Badge & Prefix Tag Staff Khusus In-Game</li>
        </ul>
      </div>
    `;
  }

  if (rank.includes('MVP')) {
    return `
      <div class="p-4 bg-rose-950/30 border border-rose-500/30 rounded-xl space-y-2">
        <p class="text-rose-300 font-bold"><i class="fa-solid fa-shield-halved mr-1"></i> RANK MVP DRAGON KNIGHT</p>
        <ul class="space-y-1.5 text-slate-300">
          <li>✨ Prefix Tag Chat Cyan <strong class="text-cyan-300">[MVP]</strong></li>
          <li>🏡 5x Slot Wilayah Sethome</li>
        </ul>
      </div>
    `;
  }

  if (rank.includes('VIP')) {
    return `
      <div class="p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-2">
        <p class="text-amber-400 font-bold"><i class="fa-solid fa-star mr-1"></i> RANK VIP WARRIOR</p>
        <ul class="space-y-1.5 text-slate-300">
          <li>✨ Prefix Tag Chat <strong class="text-amber-300">[VIP]</strong></li>
          <li>🏡 3x Slot Wilayah Sethome</li>
        </ul>
      </div>
    `;
  }

  return `
    <div class="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
      <p class="text-slate-300 font-bold"><i class="fa-solid fa-user mr-1"></i> STATUS MEMBER BIASA</p>
      <p class="text-slate-400 leading-relaxed">Kamu belum memiliki Rank VIP/MVP/Dragonian. Beli Rank melalui Webstore untuk membuka keunggulan eksklusif!</p>
      <a href="./index.html#store" class="inline-block mt-2 bg-rose-600 hover:bg-rose-500 text-white font-bold px-4 py-2 rounded-xl text-xs transition">
        <i class="fa-solid fa-cart-shopping mr-1"></i> Upgrade Rank Sekarang
      </a>
    </div>
  `;
}

// FETCH SPREADSHEET DATABASE PLAYER (GOOGLE SHEETS VIA WORKER PROXY)
async function fetchPlayerSpreadsheetDB(username) {
  if (!username) return null;
  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_player_db&username=${encodeURIComponent(username)}`).catch(() => null);
    if (res && res.ok) {
      const json = await res.json().catch(() => null);
      if (json && json.result === 'success' && json.data) {
        return json.data;
      }
    }
  } catch (err) {
    console.error("Error Fetch Player Spreadsheet DB:", err);
  }
  return null;
}

// FETCH LOGGED IN PLAYER INVENTORY HUD
async function fetchPlayerInventoryHUD(usernameOverride) {
  const username = usernameOverride || currentHUDUsername;
  if (!username) return;

  const statusEl = document.getElementById('player-inv-status');
  const loadingEl = document.getElementById('playerInvLoading');
  const errorEl = document.getElementById('playerInvError');
  const errorMsgEl = document.getElementById('playerInvErrorMessage');
  const contentEl = document.getElementById('playerInvContent');

  const localCacheKey = `aetheria_inv_cache_${username.toLowerCase()}`;

  if (statusEl) statusEl.innerText = `Menghubungkan ke server...`;
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (contentEl) contentEl.classList.add('hidden');

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success' && Array.isArray(json.inventory)) {
      // Simpan data inventori terbaru ke localStorage
      localStorage.setItem(localCacheKey, JSON.stringify(json.inventory));

      renderPlayerHUDInventory(json.inventory);
      if (json.isCached) {
        if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-clock-rotate-left text-[10px] mr-1"></i> Data Terakhir (${json.inventory.length} item(s) - Offline)</span>`;
      } else {
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i> Live Inventory (${json.inventory.length} item(s))</span>`;
      }
      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.classList.remove('hidden');
      return;
    }

    // Fallback 1: Coba dari Google Spreadsheet Database
    const dbData = await fetchPlayerSpreadsheetDB(username);
    if (dbData && Array.isArray(dbData.inventory) && dbData.inventory.length > 0) {
      localStorage.setItem(localCacheKey, JSON.stringify(dbData.inventory));
      renderPlayerHUDInventory(dbData.inventory);
      if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-file-excel text-[10px] mr-1"></i> Data Spreadsheet (${dbData.inventory.length} item(s) - ${dbData.lastUpdated || 'Offline'})</span>`;
      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.classList.remove('hidden');
      return;
    }

    // Fallback 2: Coba dari localStorage
    const savedLocalInv = localStorage.getItem(localCacheKey);
    if (savedLocalInv) {
      try {
        const localInv = JSON.parse(savedLocalInv);
        if (Array.isArray(localInv)) {
          renderPlayerHUDInventory(localInv);
          if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-clock-rotate-left text-[10px] mr-1"></i> Data Terakhir (${localInv.length} item(s) - Offline)</span>`;
          if (loadingEl) loadingEl.classList.add('hidden');
          if (contentEl) contentEl.classList.remove('hidden');
          return;
        }
      } catch (e) {}
    }

    const errorMsg = (json && json.message) || `Karakter "${username}" sedang offline dan belum ada riwayat inventori tersimpan. Masuk ke server in-game untuk menampilkan item.`;
    if (statusEl) statusEl.innerText = `Status: Offline / Belum ada riwayat`;
    if (errorMsgEl) errorMsgEl.innerText = errorMsg;
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');

  } catch (err) {
    console.error("Error HUD Inventory:", err);

    // Fallback ke localStorage saat error jaringan
    const savedLocalInv = localStorage.getItem(localCacheKey);
    if (savedLocalInv) {
      try {
        const localInv = JSON.parse(savedLocalInv);
        if (Array.isArray(localInv)) {
          renderPlayerHUDInventory(localInv);
          if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-clock-rotate-left text-[10px] mr-1"></i> Data Terakhir (Offline)</span>`;
          if (loadingEl) loadingEl.classList.add('hidden');
          if (contentEl) contentEl.classList.remove('hidden');
          return;
        }
      } catch (e) {}
    }

    if (statusEl) statusEl.innerText = `Status: Gagal memuat data`;
    if (errorMsgEl) errorMsgEl.innerText = "Kesalahan jaringan saat mengambil item dari server.";
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
  }
}

function renderPlayerHUDInventory(inventoryList) {
  const itemMap = {};
  if (Array.isArray(inventoryList)) {
    inventoryList.forEach(item => {
      if (item && typeof item.slot === 'number') {
        itemMap[item.slot] = item;
      }
    });
  }

  // 1. Armor Slots (103: Helmet, 102: Chestplate, 101: Leggings, 100: Boots) & Offhand (-106)
  const armorSlots = [
    { slot: 103, elId: 'hud-slot-103', placeholder: '<i class="fa-solid fa-helmet-safety text-slate-700 text-xs"></i>', label: 'Helmet' },
    { slot: 102, elId: 'hud-slot-102', placeholder: '<i class="fa-solid fa-shirt text-slate-700 text-xs"></i>', label: 'Chestplate' },
    { slot: 101, elId: 'hud-slot-101', placeholder: '<i class="fa-solid fa-user text-slate-700 text-xs"></i>', label: 'Leggings' },
    { slot: 100, elId: 'hud-slot-100', placeholder: '<i class="fa-solid fa-socks text-slate-700 text-xs"></i>', label: 'Boots' },
    { slot: -106, elId: 'hud-slot--106', placeholder: '<i class="fa-solid fa-shield text-slate-700 text-xs"></i>', label: 'Offhand' }
  ];

  armorSlots.forEach(cfg => {
    const el = document.getElementById(cfg.elId);
    if (el) {
      const item = itemMap[cfg.slot];
      el.innerHTML = renderHUDSlotInnerHtml(cfg.slot, item, cfg.placeholder, cfg.label);
    }
  });

  // 2. Main Inventory Grid (Slots 9 to 35)
  const mainGrid = document.getElementById('hudMainGrid');
  if (mainGrid) {
    let mainHtml = '';
    for (let s = 9; s <= 35; s++) {
      const item = itemMap[s];
      mainHtml += renderHUDSlotInnerHtml(s, item);
    }
    mainGrid.innerHTML = mainHtml;
  }

  // 3. Hotbar Grid (Slots 0 to 8)
  const hotbarGrid = document.getElementById('hudHotbarGrid');
  if (hotbarGrid) {
    let hotbarHtml = '';
    for (let s = 0; s <= 8; s++) {
      const item = itemMap[s];
      hotbarHtml += renderHUDSlotInnerHtml(s, item);
    }
    hotbarGrid.innerHTML = hotbarHtml;
  }
}

function renderHUDSlotInnerHtml(slotNum, item, placeholderIcon = '', defaultLabel = '') {
  if (item && item.id) {
    const itemName = formatItemName(item.id);
    const cleanId = item.id.toLowerCase().replace(/^minecraft:/, '').trim();
    const primaryUrl = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/${cleanId}.png`;
    const countBadge = item.count > 1 ? `<span class="mc-slot-count">${item.count}</span>` : '';

    return `
      <div class="mc-slot group relative" title="${escapeHTML(itemName)} (${item.count}) [Slot ${slotNum}]">
        <img src="${primaryUrl}" 
             alt="${escapeHTML(itemName)}" 
             class="mc-slot-item-img"
             data-step="0"
             onerror="handleItemImgError(this, '${escapeHTML(cleanId)}')">
        ${countBadge}
        <div class="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center pointer-events-none z-30">
          <div class="bg-slate-950/95 border border-slate-700 text-slate-100 text-[10px] font-mono-code py-1 px-2 rounded shadow-2xl whitespace-nowrap">
            <div class="font-bold text-rose-400">${escapeHTML(itemName)}</div>
            <div class="text-[9px] text-slate-400">Jumlah: ${item.count} &bull; Slot: ${slotNum}</div>
          </div>
        </div>
      </div>
    `;
  }

  const titleText = defaultLabel ? `${defaultLabel} (Kosong)` : `Kosong [Slot ${slotNum}]`;
  return `
    <div class="mc-slot mc-slot-empty" title="${escapeHTML(titleText)}">
      ${placeholderIcon}
    </div>
  `;
}

const ITEM_ID_ALIASES = {
  'cooked_beef': ['cooked_beef', 'beef_cooked'],
  'cooked_porkchop': ['cooked_porkchop', 'porkchop_cooked'],
  'cooked_chicken': ['cooked_chicken', 'chicken_cooked'],
  'cooked_mutton': ['cooked_mutton', 'mutton_cooked'],
  'cooked_cod': ['cooked_cod', 'fish_cooked', 'raw_fish'],
  'cooked_salmon': ['cooked_salmon', 'salmon_cooked'],
  'porkchop': ['porkchop', 'porkchop_raw'],
  'beef': ['beef', 'beef_raw'],
  'chicken': ['chicken', 'chicken_raw'],
  'enchanted_book': ['enchanted_book', 'book_enchanted'],
  'written_book': ['written_book', 'book_written'],
  'writable_book': ['writable_book', 'book_writable'],
  'glass_bottle': ['glass_bottle', 'potion_bottle_empty'],
  'totem_of_undying': ['totem_of_undying', 'totem'],
  'experience_bottle': ['experience_bottle', 'bottle_o_enchanting'],
  'golden_sword': ['golden_sword', 'gold_sword'],
  'golden_shovel': ['golden_shovel', 'gold_shovel'],
  'golden_pickaxe': ['golden_pickaxe', 'gold_pickaxe'],
  'golden_axe': ['golden_axe', 'gold_axe'],
  'golden_hoe': ['golden_hoe', 'gold_hoe'],
  'golden_helmet': ['golden_helmet', 'gold_helmet'],
  'golden_chestplate': ['golden_chestplate', 'gold_chestplate'],
  'golden_leggings': ['golden_leggings', 'gold_leggings'],
  'golden_boots': ['golden_boots', 'gold_boots'],
  'golden_apple': ['golden_apple', 'apple_golden'],
  'enchanted_golden_apple': ['enchanted_golden_apple', 'apple_golden_enchanted', 'golden_apple'],
  'wooden_sword': ['wooden_sword', 'wood_sword'],
  'wooden_shovel': ['wooden_shovel', 'wood_shovel'],
  'wooden_pickaxe': ['wooden_pickaxe', 'wood_pickaxe'],
  'wooden_axe': ['wooden_axe', 'wood_axe'],
  'wooden_hoe': ['wooden_hoe', 'wood_hoe'],
  'redstone': ['redstone', 'redstone_dust'],
  'repeater': ['repeater', 'diode'],
  'comparator': ['comparator'],
  'clock': ['clock', 'watch']
};

function getItemSourceUrls(cleanId) {
  const safeId = String(cleanId || '').toLowerCase().replace(/["']/g, '').replace(/^minecraft:/, '').trim();
  if (!safeId) return [];

  const idVariants = [safeId];
  if (ITEM_ID_ALIASES[safeId]) {
    ITEM_ID_ALIASES[safeId].forEach(alias => {
      if (!idVariants.includes(alias)) idVariants.push(alias);
    });
  }

  const urls = [];
  idVariants.forEach(id => {
    urls.push(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/${id}.png`);
    urls.push(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/${id}.png`);
    urls.push(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.12.2/items/${id}.png`);
    urls.push(`https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.12.2/blocks/${id}.png`);
    urls.push(`https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/item/${id}.png`);
    urls.push(`https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/block/${id}.png`);
    urls.push(`https://mc-heads.net/item/${id}`);
    urls.push(`https://minecraftitemids.com/item/128/${id}.png`);
  });

  return urls;
}

function handleItemImgError(img, cleanId) {
  if (!img) return;
  const currentStep = parseInt(img.dataset.step || '0', 10);
  const nextStep = currentStep + 1;
  img.dataset.step = String(nextStep);

  const sources = getItemSourceUrls(cleanId);

  if (nextStep < sources.length) {
    img.src = sources[nextStep];
  } else {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.mc-fallback-badge')) {
      const badge = document.createElement('span');
      badge.className = 'mc-fallback-badge text-[10px] font-mono-code font-bold text-rose-300 truncate max-w-[34px] block text-center uppercase select-none';
      badge.innerText = String(cleanId).replace(/_/g, '').substring(0, 3);
      parent.appendChild(badge);
    }
  }
}

window.handleItemImgError = handleItemImgError;

function formatItemName(id) {
  if (!id) return '';
  const clean = id.replace(/^minecraft:/, '');
  return clean
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

window.addEventListener('languageChanged', () => {
  try {
    checkPlayerSession();
  } catch (e) { }
});

// =========================================================================
// FITUR ACHIEVEMENTS & ADVANCEMENTS PLAYER
// =========================================================================
const DEFAULT_ACHIEVEMENTS_LIST = [
  // 1. STORY (Minecraft / Overworld)
  { id: "minecraft:story/root", title_id: "Awal Mula", title_en: "Minecraft", category: "story", desc_id: "Buat Crafting Table pertama kamu.", desc_en: "Craft a Crafting Table to start your journey.", icon: "crafting_table", frame: "task", unlocked: false },
  { id: "minecraft:story/mine_stone", title_id: "Zaman Batu", title_en: "Stone Age", category: "story", desc_id: "Tambang batu dengan beliung pertama kamu.", desc_en: "Mine stone with your new pickaxe.", icon: "cobblestone", frame: "task", unlocked: false },
  { id: "minecraft:story/upgrade_tools", title_id: "Peningkatan Alat", title_en: "Getting an Upgrade", category: "story", desc_id: "Buat beliung batu yang lebih tangguh.", desc_en: "Construct a better pickaxe.", icon: "stone_pickaxe", frame: "task", unlocked: false },
  { id: "minecraft:story/smelt_iron", title_id: "Besi Pertama", title_en: "Acquire Hardware", category: "story", desc_id: "Lebur bijih besi di dalam tungku pembakaran.", desc_en: "Smelt an iron ingot.", icon: "iron_ingot", frame: "task", unlocked: false },
  { id: "minecraft:story/obtain_armor", title_id: "Perlindungan Lengkap", title_en: "Suit Up", category: "story", desc_id: "Lindungi diri kamu dengan zirah besi.", desc_en: "Protect yourself with iron armor.", icon: "iron_chestplate", frame: "task", unlocked: false },
  { id: "minecraft:story/lava_bucket", title_id: "Cairan Panas", title_en: "Hot Stuff", category: "story", desc_id: "Ambil lava panas menggunakan ember besi.", desc_en: "Fill a bucket with lava.", icon: "lava_bucket", frame: "task", unlocked: false },
  { id: "minecraft:story/iron_tools", title_id: "Kekuatan Besi", title_en: "Isn't It Iron Pick", category: "story", desc_id: "Buat beliung besi untuk menambang bijih langka.", desc_en: "Upgrade your pickaxe to iron.", icon: "iron_pickaxe", frame: "task", unlocked: false },
  { id: "minecraft:story/deflect_arrow", title_id: "Benteng Pertahanan", title_en: "Not Today, Thank You", category: "story", desc_id: "Tangkis panah musuh menggunakan perisai.", desc_en: "Deflect a projectile with a shield.", icon: "shield", frame: "task", unlocked: false },
  { id: "minecraft:story/form_obsidian", title_id: "Tantangan Ember Es", title_en: "Ice Bucket Challenge", category: "story", desc_id: "Ciptakan blok obsidian dengan menyiramkan air ke lava.", desc_en: "Obtain a block of obsidian.", icon: "obsidian", frame: "task", unlocked: false },
  { id: "minecraft:story/mine_diamond", title_id: "Berlian!", title_en: "Diamonds!", category: "story", desc_id: "Temukan dan tambang permata berlian berkilau.", desc_en: "Acquire diamonds.", icon: "diamond", frame: "task", unlocked: false },
  { id: "minecraft:story/enter_the_nether", title_id: "Masuki Gerbang Neraka", title_en: "We Need to Go Deeper", category: "story", desc_id: "Bangun dan aktifkan portal menuju ke dimensi Nether.", desc_en: "Build, light and enter a Nether Portal.", icon: "flint_and_steel", frame: "task", unlocked: false },
  { id: "minecraft:story/shiny_gear", title_id: "Pelindung Berlian", title_en: "Cover Me with Diamonds", category: "story", desc_id: "Lindungi diri kamu dengan zirah berlian.", desc_en: "Diamond armor saves lives.", icon: "diamond_chestplate", frame: "task", unlocked: false },
  { id: "minecraft:story/enchant_item", title_id: "Kekuatan Sihir", title_en: "Enchanter", category: "story", desc_id: "Berikan sihir pada item menggunakan Enchanting Table.", desc_en: "Enchant an item at an Enchanting Table.", icon: "enchanting_table", frame: "task", unlocked: false },
  { id: "minecraft:story/cure_zombie_villager", title_id: "Dokter Zombie", title_en: "Zombie Doctor", category: "story", desc_id: "Sembuhkan zombie villager kembali menjadi warga desa.", desc_en: "Weaken and then cure a zombie villager.", icon: "golden_apple", frame: "goal", unlocked: false },
  { id: "minecraft:story/follow_ender_eye", title_id: "Pencari Mata Ender", title_en: "Eye Spy", category: "story", desc_id: "Lempar Mata Ender untuk melacak lokasi Stronghold.", desc_en: "Follow an Eye of Ender to a Stronghold.", icon: "ender_eye", frame: "task", unlocked: false },
  { id: "minecraft:story/enter_the_end", title_id: "Dimensi Akhir", title_en: "The End?", category: "story", desc_id: "Masuki portal dimensi End untuk menghadapi bahaya terakhir.", desc_en: "Enter the End Portal.", icon: "end_stone", frame: "task", unlocked: false },

  // 2. NETHER
  { id: "minecraft:nether/root", title_id: "Gerbang Nether", title_en: "Nether", category: "nether", desc_id: "Jejakkan kaki kamu di realm Nether yang membara.", desc_en: "Bring summer clothes.", icon: "netherrack", frame: "task", unlocked: false },
  { id: "minecraft:nether/fast_travel", title_id: "Gelembung Ruang Angkasa", title_en: "Subspace Bubble", category: "nether", desc_id: "Gunakan Nether untuk melintasi jarak 7 km di Overworld.", desc_en: "Use the Nether to travel 7 km in the Overworld.", icon: "map", frame: "challenge", unlocked: false },
  { id: "minecraft:nether/find_fortress", title_id: "Benteng Kuno Nether", title_en: "A Terrible Fortress", category: "nether", desc_id: "Temukan benteng Nether kuno yang dipenuhi bahaya.", desc_en: "Break your way into a Nether Fortress.", icon: "nether_bricks", frame: "task", unlocked: false },
  { id: "minecraft:nether/obtain_blaze_rod", title_id: "Menembus Api", title_en: "Into Fire", category: "nether", desc_id: "Kalahkan Blaze dan dapatkan Blaze Rod.", desc_en: "Relieve a Blaze of its rod.", icon: "blaze_rod", frame: "task", unlocked: false },
  { id: "minecraft:nether/brew_potion", title_id: "Ramuan Ajaib", title_en: "Local Brewery", category: "nether", desc_id: "Racik ramuan ajaib pertama kamu.", desc_en: "Brew a potion.", icon: "brewing_stand", frame: "task", unlocked: false },
  { id: "minecraft:nether/find_bastion", title_id: "Perompak Bastion", title_en: "War Pigs", category: "nether", desc_id: "Temukan benteng Bastion Remnant di Nether.", desc_en: "Enter a Bastion Remnant.", icon: "polished_blackstone_bricks", frame: "task", unlocked: false },
  { id: "minecraft:nether/obtain_crying_obsidian", title_id: "Air Mata Batu", title_en: "Who is Cutting Onions?", category: "nether", desc_id: "Dapatkan blok Crying Obsidian.", desc_en: "Obtain Crying Obsidian.", icon: "crying_obsidian", frame: "task", unlocked: false },
  { id: "minecraft:nether/distract_piglin", title_id: "Silau Emas", title_en: "Oh Shiny", category: "nether", desc_id: "Alihkan perhatian Piglin menggunakan emas.", desc_en: "Distract Piglins with gold.", icon: "gold_ingot", frame: "task", unlocked: false },
  { id: "minecraft:nether/ride_strider", title_id: "Perahu Berkaki", title_en: "This Boat Has Legs", category: "nether", desc_id: "Tunggangi Strider di atas lautan lava Nether.", desc_en: "Ride a Strider with a Warped Fungus on a Stick.", icon: "warped_fungus_on_a_stick", frame: "task", unlocked: false },
  { id: "minecraft:nether/uneasy_alliance", title_id: "Aliansi Gelisah", title_en: "Uneasy Alliance", category: "nether", desc_id: "Bawa Ghast dari Nether ke Overworld lalu kalahkan!", desc_en: "Rescue a Ghast from the Nether, bring it safely home to the Overworld... and then kill it.", icon: "ghast_tear", frame: "challenge", unlocked: false },
  { id: "minecraft:nether/loot_bastion", title_id: "Kejayaan Masa Lalu", title_en: "Those Were the Days", category: "nether", desc_id: "Jarah peti harta karun di dalam Bastion Remnant.", desc_en: "Loot a chest in a Bastion Remnant.", icon: "gilded_blackstone", frame: "task", unlocked: false },
  { id: "minecraft:nether/use_lodestone", title_id: "Batu Penuntun", title_en: "Country Lode, Take Me Home", category: "nether", desc_id: "Gunakan Kompas pada blok Lodestone.", desc_en: "Use a compass on a Lodestone.", icon: "lodestone", frame: "task", unlocked: false },
  { id: "minecraft:nether/obtain_ancient_debris", title_id: "Harta Tersembunyi", title_en: "Hidden in the Depths", category: "nether", desc_id: "Tambang Ancient Debris langka di kedalaman Nether.", desc_en: "Obtain Ancient Debris.", icon: "ancient_debris", frame: "task", unlocked: false },
  { id: "minecraft:nether/netherite_armor", title_id: "Zirah Netherite", title_en: "Cover Me in Debris", category: "nether", desc_id: "Buat zirah Netherite lengkap.", desc_en: "Get a full suit of Netherite armor.", icon: "netherite_chestplate", frame: "challenge", unlocked: false },
  { id: "minecraft:nether/get_wither_skull", title_id: "Tengkorak Gelap", title_en: "Spooky Scary Skeleton", category: "nether", desc_id: "Dapatkan tengkorak Wither Skeleton.", desc_en: "Obtain a Wither Skeleton's skull.", icon: "wither_skeleton_skull", frame: "task", unlocked: false },
  { id: "minecraft:nether/summon_wither", title_id: "Puncak Kegelapan", title_en: "Withering Heights", category: "nether", desc_id: "Panggil dan hadapi boss Wither.", desc_en: "Summon the Wither.", icon: "nether_star", frame: "goal", unlocked: false },
  { id: "minecraft:nether/create_beacon", title_id: "Cahaya Penuntun", title_en: "Bring Home the Beacon", category: "nether", desc_id: "Rakit dan pasang struktur Beacon.", desc_en: "Construct and place a Beacon.", icon: "beacon", frame: "goal", unlocked: false },
  { id: "minecraft:nether/create_full_beacon", title_id: "Daya Beacon Maksimal", title_en: "Beaconator", category: "nether", desc_id: "Bangun struktur piramida Beacon tingkat 4.", desc_en: "Bring a beacon to full power.", icon: "beacon", frame: "goal", unlocked: false },
  { id: "minecraft:nether/all_potions", title_id: "Koktail Mematikan", title_en: "A Furious Cocktail", category: "nether", desc_id: "Rasakan semua efek ramuan secara bersamaan.", desc_en: "Have every potion effect applied at the same time.", icon: "milk_bucket", frame: "challenge", unlocked: false },
  { id: "minecraft:nether/all_effects", title_id: "Bagaimana Kita Sampai Sini?", title_en: "How Did We Get Here?", category: "nether", desc_id: "Aktifkan semua status effect di Minecraft.", desc_en: "Have every effect applied at the same time.", icon: "bucket", frame: "challenge", unlocked: false },

  // 3. END
  { id: "minecraft:end/root", title_id: "Realm The End", title_en: "The End", category: "end", desc_id: "Tiba di pulau terapung dimensi The End.", desc_en: "Or the beginning?", icon: "end_stone", frame: "task", unlocked: false },
  { id: "minecraft:end/kill_dragon", title_id: "Bebaskan Dimensi End", title_en: "Free the End", category: "end", desc_id: "Kalahkan Ender Dragon dan bebaskan End!", desc_en: "Good luck.", icon: "dragon_head", frame: "goal", unlocked: false },
  { id: "minecraft:end/dragon_egg", title_id: "Generasi Penerus", title_en: "The Next Generation", category: "end", desc_id: "Pegang Telur Ender Dragon.", desc_en: "Hold the Dragon Egg.", icon: "dragon_egg", frame: "goal", unlocked: false },
  { id: "minecraft:end/enter_end_gateway", title_id: "Pelarian Jauh", title_en: "Remote Getaway", category: "end", desc_id: "Masuki Gateway portal menuju pulau luar End.", desc_en: "Escape the main island.", icon: "ender_pearl", frame: "task", unlocked: false },
  { id: "minecraft:end/find_end_city", title_id: "Kota Kuno End", title_en: "The City at the End of the Game", category: "end", desc_id: "Temukan struktur End City di pulau melayang.", desc_en: "Go on in, what could happen?", icon: "purpur_block", frame: "task", unlocked: false },
  { id: "minecraft:end/elytra", title_id: "Sayap Angkasa", title_en: "Sky's the Limit", category: "end", desc_id: "Temukan dan dapatkan sayap Elytra.", desc_en: "Find an Elytra.", icon: "elytra", frame: "goal", unlocked: false },
  { id: "minecraft:end/respawn_dragon", title_id: "Panggil Kembali Naga", title_en: "The End... Again...", category: "end", desc_id: "Panggil ulang Ender Dragon menggunakan End Crystals.", desc_en: "Respawn the Ender Dragon.", icon: "end_crystal", frame: "goal", unlocked: false },
  { id: "minecraft:end/dragon_breath", title_id: "Napas Naga", title_en: "You Need a Mint", category: "end", desc_id: "Kumpulkan Dragon's Breath dalam botol kaca.", desc_en: "Collect Dragon's Breath in a glass bottle.", icon: "dragon_breath", frame: "goal", unlocked: false },
  { id: "minecraft:end/levitate", title_id: "Pemandangan Indah Dari Atas", title_en: "Great View From Up Here", category: "end", desc_id: "Melayang setinggi 50 blok dari serangan Shulker.", desc_en: "Levitate up 50 blocks from the attacks of a Shulker.", icon: "shulker_shell", frame: "challenge", unlocked: false },

  // 4. ADVENTURE
  { id: "minecraft:adventure/root", title_id: "Petualang", title_en: "Adventure", category: "adventure", desc_id: "Mulai perjalanan petualangan di dunia Aetheria.", desc_en: "Adventure, exploration, and combat.", icon: "map", frame: "task", unlocked: false },
  { id: "minecraft:adventure/kill_a_mob", title_id: "Pemburu Monster", title_en: "Monster Hunter", category: "adventure", desc_id: "Kalahkan monster musuh pertama kamu.", desc_en: "Kill any hostile monster.", icon: "iron_sword", frame: "task", unlocked: false },
  { id: "minecraft:adventure/trade", title_id: "Pedagang Ulung", title_en: "What a Deal!", category: "adventure", desc_id: "Berhasil bertransaksi dagang dengan Villager.", desc_en: "Successfully trade with a Villager.", icon: "emerald", frame: "task", unlocked: false },
  { id: "minecraft:adventure/ol_betsy", title_id: "Ol' Betsy", title_en: "Ol' Betsy", category: "adventure", desc_id: "Tembakkan panah menggunakan Crossbow.", desc_en: "Shoot a Crossbow.", icon: "crossbow", frame: "task", unlocked: false },
  { id: "minecraft:adventure/two_birds_one_arrow", title_id: "Dua Burung Satu Panah", title_en: "Two Birds, One Arrow", category: "adventure", desc_id: "Kalahkan dua Phantom sekaligus dengan satu anak panah Piercing!", desc_en: "Kill two Phantoms with a Piercing arrow.", icon: "arrow", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/whos_the_pillager_now", title_id: "Siapa Pillager Sekarang?", title_en: "Who's the Pillager Now?", category: "adventure", desc_id: "Beri Pillager rasa obat mereka sendiri dengan Crossbow.", desc_en: "Give a Pillager a taste of their own medicine.", icon: "crossbow", frame: "task", unlocked: false },
  { id: "minecraft:adventure/arbalestic", title_id: "Ahli Busur Silang", title_en: "Arbalestic", category: "adventure", desc_id: "Kalahkan 5 mob unik dalam satu tembakan Crossbow!", desc_en: "Kill five unique mobs with one crossbow shot.", icon: "crossbow", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/voluntary_exile", title_id: "Pengasingan Sukarela", title_en: "Voluntary Exile", category: "adventure", desc_id: "Kalahkan Kapten Raid untuk mendapatkan Bad Omen.", desc_en: "Kill a raid captain.", icon: "white_banner", frame: "task", unlocked: false },
  { id: "minecraft:adventure/hero_of_the_village", title_id: "Pahlawan Desa", title_en: "Hero of the Village", category: "adventure", desc_id: "Lindungi dan selamatkan desa dari serangan Raid!", desc_en: "Successfully defend a village from a raid.", icon: "emerald_block", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/honey_block_slide", title_id: "Meluncur Madu", title_en: "Sticky Situation", category: "adventure", desc_id: "Lompati blok madu untuk meredam kejatuhan.", desc_en: "Slide down a Honey Block to slow your fall.", icon: "honey_block", frame: "task", unlocked: false },
  { id: "minecraft:adventure/totem_of_undying", title_id: "Melawan Kematian", title_en: "Postmortal", category: "adventure", desc_id: "Gunakan Totem of Undying untuk selamat dari kematian.", desc_en: "Use a Totem of Undying to cheat death.", icon: "totem_of_undying", frame: "goal", unlocked: false },
  { id: "minecraft:adventure/bullseye", title_id: "Tembakan Tepat Sasaran", title_en: "Bullseye", category: "adventure", desc_id: "Tembak tepat di tengah target dari jarak jauh.", desc_en: "Hit the bullseye of a Target block.", icon: "target", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/sniper_duel", title_id: "Duel Penembak Jitu", title_en: "Sniper Duel", category: "adventure", desc_id: "Kalahkan Skeleton dari jarak jauh lebih dari 50 meter.", desc_en: "Kill a Skeleton from more than 50 meters away.", icon: "arrow", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/kill_all_mobs", title_id: "Pemburu Monster Sejati", title_en: "Monsters Hunted", category: "adventure", desc_id: "Kalahkan setiap jenis monster musuh di Minecraft.", desc_en: "Kill one of every hostile monster.", icon: "diamond_sword", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/adventuring_time", title_id: "Waktu Petualangan", title_en: "Adventuring Time", category: "adventure", desc_id: "Jelajahi seluruh biome tanah di Minecraft.", desc_en: "Discover every biome.", icon: "diamond_boots", frame: "challenge", unlocked: false },
  { id: "minecraft:adventure/play_jukebox", title_id: "Suara Musik", title_en: "Sound of Music", category: "adventure", desc_id: "Nyalakan Jukebox dengan piringan hitam di Meadow biome.", desc_en: "Make a Meadow come alive with the sound of music from a Jukebox.", icon: "jukebox", frame: "task", unlocked: false },
  { id: "minecraft:adventure/walk_on_powder_snow_with_leather_boots", title_id: "Ringan Seperti Bulu", title_en: "Light as a Feather", category: "adventure", desc_id: "Berjalan di atas Salju Bubuk dengan Boot Kulit.", desc_en: "Walk on Powder Snow... without sinking in it.", icon: "leather_boots", frame: "task", unlocked: false },
  { id: "minecraft:adventure/lightning_rod_with_villager_survived", title_id: "Kejutan Petir", title_en: "Surging Impulse", category: "adventure", desc_id: "Lindungi Villager dari tersambar petir menggunakan Lightning Rod.", desc_en: "Protect a villager from an unwanted shock without starting a fire.", icon: "lightning_rod", frame: "task", unlocked: false },
  { id: "minecraft:adventure/spyglass_at_parrot", title_id: "Apakah Itu Burung?", title_en: "Is It a Bird?", category: "adventure", desc_id: "Tatapan burung Nuri melalui Teropong Spyglass.", desc_en: "Look at a Parrot through a Spyglass.", icon: "spyglass", frame: "task", unlocked: false },
  { id: "minecraft:adventure/spyglass_at_ghast", title_id: "Apakah Itu Balon?", title_en: "Is It a Balloon?", category: "adventure", desc_id: "Tatapan Ghast melalui Teropong Spyglass.", desc_en: "Look at a Ghast through a Spyglass.", icon: "spyglass", frame: "task", unlocked: false },
  { id: "minecraft:adventure/spyglass_at_dragon", title_id: "Apakah Itu Pesawat?", title_en: "Is It a Plane?", category: "adventure", desc_id: "Tatapan Ender Dragon melalui Teropong Spyglass.", desc_en: "Look at an Ender Dragon through a Spyglass.", icon: "spyglass", frame: "task", unlocked: false },
  { id: "minecraft:adventure/fall_from_world_height", title_id: "Gua & Tebing", title_en: "Caves & Cliffs", category: "adventure", desc_id: "Jatuh dari puncak batas atas dunia ke dasar dunia dan selamat!", desc_en: "Free fall from the top of the world (build limit) to the bottom of the world and survive.", icon: "feather", frame: "challenge", unlocked: false },

  // 5. HUSBANDRY
  { id: "minecraft:husbandry/root", title_id: "Pertanian & Peternakan", title_en: "Husbandry", category: "husbandry", desc_id: "Mulai bercocok tanam dan beternak.", desc_en: "The world is full of friends and food.", icon: "hay_block", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/plant_seed", title_id: "Tanam Benih", title_en: "A Seedy Place", category: "husbandry", desc_id: "Tanam benih di tanah pertanian.", desc_en: "Plant a seed and watch it grow.", icon: "wheat_seeds", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/breed_an_animal", title_id: "Cinta Hewan", title_en: "The Parrots and the Bats", category: "husbandry", desc_id: "Kawinkan dua ekor hewan.", desc_en: "Breed two animals together.", icon: "wheat", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/all_playings_music_disc", title_id: "Koleksi Piringan Hitam", title_en: "Sound of Music Disc", category: "husbandry", desc_id: "Putar piringan hitam di Jukebox.", desc_en: "Play a music disc in a Jukebox.", icon: "music_disc_cat", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/tame_an_animal", title_id: "Sahabat Setia", title_en: "Best Friends Forever", category: "husbandry", desc_id: "Jinakkan serigala atau kucing menjadi peliharaan.", desc_en: "Tame an animal.", icon: "bone", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/fishy_business", title_id: "Memancing Mania", title_en: "Fishy Business", category: "husbandry", desc_id: "Tangkap ikan pertama kamu dengan pancingan.", desc_en: "Catch a fish.", icon: "cooked_cod", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/safely_harvest_honey", title_id: "Madu Manis", title_en: "Bee Our Guest", category: "husbandry", desc_id: "Ambil madu dari sarang lebah menggunakan api unggun.", desc_en: "Harvest honey from a Beehive without angering bees.", icon: "honey_bottle", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/silk_touch_nest", title_id: "Migrasi Sarang Lebah", title_en: "Total Beelocation", category: "husbandry", desc_id: "Pindahkan sarang lebah berisi 3 lebah menggunakan Silk Touch.", desc_en: "Move a Bee Nest, with 3 bees inside, using Silk Touch.", icon: "bee_nest", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/breed_all_animals", title_id: "Dua demi Dua", title_en: "Two by Two", category: "husbandry", desc_id: "Kembangkan semua jenis hewan yang dapat dikawinkan.", desc_en: "Breed all the animals!", icon: "golden_carrot", frame: "challenge", unlocked: false },
  { id: "minecraft:husbandry/tactical_fishing", title_id: "Memancing Taktis", title_en: "Tactical Fishing", category: "husbandry", desc_id: "Tangkap ikan dalam ember!", desc_en: "Catch a fish... without a fishing rod!", icon: "pufferfish_bucket", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/balanced_diet", title_id: "Gizi Seimbang", title_en: "A Balanced Diet", category: "husbandry", desc_id: "Makan berbagai macam makanan di Minecraft.", desc_en: "Eat everything that is edible.", icon: "apple", frame: "challenge", unlocked: false },
  { id: "minecraft:husbandry/obtain_netherite_hoe", title_id: "Dedikasi Sejati", title_en: "Serious Dedication", category: "husbandry", desc_id: "Tingkatkan cangkul menjadi cangkul Netherite!", desc_en: "Completely use up a Netherite hoe, and then re-evaluate your life choices.", icon: "netherite_hoe", frame: "challenge", unlocked: false },
  { id: "minecraft:husbandry/wax_on", title_id: "Lapisan Lilin", title_en: "Wax On", category: "husbandry", desc_id: "Gunakan Honeycomb pada blok Tembaga.", desc_en: "Apply Honeycomb to a Copper block!", icon: "honeycomb", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/wax_off", title_id: "Bersihkan Lilin", title_en: "Wax Off", category: "husbandry", desc_id: "Kikis lilin dari blok Tembaga menggunakan Kapak.", desc_en: "Scrape wax off a Copper block!", icon: "stone_axe", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/axolotl_in_a_bucket", title_id: "Predator Terlucu", title_en: "The Cutest Predator", category: "husbandry", desc_id: "Tangkap Axolotl dalam ember!", desc_en: "Catch an Axolotl in a Bucket.", icon: "axolotl_bucket", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/kill_axolotl_target", title_id: "Kekuatan Persahabatan", title_en: "The Healing Power of Friendship!", category: "husbandry", desc_id: "Bantu Axolotl memenangkan pertarungan.", desc_en: "Team up with an Axolotl and win a fight.", icon: "axolotl_bucket", frame: "task", unlocked: false },
  { id: "minecraft:husbandry/froglights", title_id: "Lentera Katak", title_en: "With Our Powers Combined!", category: "husbandry", desc_id: "Kumpulkan ketiga warna Froglight!", desc_en: "Have all Froglights in your inventory.", icon: "pearlescent_froglight", frame: "challenge", unlocked: false },

  // 6. EPIC FIGHT MOD (epicfight)
  { id: "epicfight:story/root", title_id: "Modus Pertarungan Epic", title_en: "Epic Combat Mode", category: "epicfight", desc_id: "Masuki mode pertarungan Epic Fight (Tekan 'R') untuk mengeksekusi stance & combo pedang.", desc_en: "Enter Epic Fight combat mode (Press 'R') to execute weapon stances and combos.", icon: "iron_sword", frame: "task", unlocked: false },
  { id: "epicfight:story/skill_book", title_id: "Keahlian Tempur", title_en: "Combat Mastery", category: "epicfight", desc_id: "Pelajari skill combat baru menggunakan Skill Book.", desc_en: "Learn a new combat skill using a Skill Book.", icon: "book", frame: "task", unlocked: false },
  { id: "epicfight:story/first_weapon", title_id: "Senjata Ksatria", title_en: "Warrior's Weapon", category: "epicfight", desc_id: "Rakit atau dapatkan senjata khusus Epic Fight (Greatsword, Katana, Longsword).", desc_en: "Craft or obtain a specialized Epic Fight weapon (Greatsword, Katana, Longsword).", icon: "diamond_sword", frame: "task", unlocked: false },
  { id: "epicfight:story/dodge_roll", title_id: "Kelincahan Ksatria", title_en: "Nimble Evader", category: "epicfight", desc_id: "Lakukan Dodge Roll untuk menghindari serangan mematikan musuh.", desc_en: "Perform a Dodge Roll to evade incoming enemy attacks.", icon: "leather_boots", frame: "task", unlocked: false },
  { id: "epicfight:story/parry", title_id: "Tangkisan Sempurna", title_en: "Master Guard & Parry", category: "epicfight", desc_id: "Berhasil melakukan Guard atau Parry pada momen yang tepat.", desc_en: "Successfully Guard or Parry an enemy attack in battle.", icon: "shield", frame: "challenge", unlocked: false },
  { id: "epicfight:story/air_combo", title_id: "Tebasan Udara", title_en: "Aerial Dominance", category: "epicfight", desc_id: "Luncurkan combo serangan udara memukau kepada musuh.", desc_en: "Execute an impressive aerial combo attack against your enemy.", icon: "feather", frame: "challenge", unlocked: false },
  { id: "epicfight:story/special_attack", title_id: "Jurus Pamungkas", title_en: "Unleash Weapon Fury", category: "epicfight", desc_id: "Gunakan Special Attack Weapon Skill untuk menghancurkan musuh.", desc_en: "Unleash a Weapon Special Attack skill.", icon: "nether_star", frame: "goal", unlocked: false },
  { id: "epicfight:story/weapon_master", title_id: "Master Pedang & Senjata", title_en: "Weapon Master", category: "epicfight", desc_id: "Kuasai penggunaan berbagai tipe senjata Epic Fight.", desc_en: "Master using multiple Epic Fight weapon classes.", icon: "netherite_sword", frame: "challenge", unlocked: false },
  { id: "epicfight:story/guard_break", title_id: "Penghancur Pertahanan", title_en: "Guard Breaker", category: "epicfight", desc_id: "Hancurkan pertahanan Guard lawan dalam duel.", desc_en: "Break an opponent's guard in combat.", icon: "iron_axe", frame: "task", unlocked: false },
  { id: "epicfight:story/stamina_management", title_id: "Stamina Pendekar", title_en: "Endurance Fighter", category: "epicfight", desc_id: "Jaga stamina kamu selama pertarungan sengit.", desc_en: "Manage your stamina efficiently during long fights.", icon: "brewing_stand", frame: "task", unlocked: false },
  { id: "epicfight:story/boss_slayer", title_id: "Pembantai Boss Epic", title_en: "Epic Boss Slayer", category: "epicfight", desc_id: "Kalahkan Boss besar menggunakan combo Epic Fight.", desc_en: "Slay a powerful boss using Epic Fight mechanics.", icon: "dragon_head", frame: "challenge", unlocked: false },
  { id: "epicfight:story/berserk_mode", title_id: "Mode Amarah Ksatria", title_en: "Berserker Rage", category: "epicfight", desc_id: "Aktifkan amarah tempur saat darah dalam kondisi kritis.", desc_en: "Trigger combat rage mode under critical health.", icon: "redstone", frame: "challenge", unlocked: false },

  // 7. THE AETHER MOD (aether)
  { id: "aether:the_aether", title_id: "Surga di Atas Awan", title_en: "Hostile Paradise", category: "aether", desc_id: "Bangun portal Glowstone & siram air untuk memasuki dimensi Aether.", desc_en: "Build a Glowstone portal and pour water to enter The Aether dimension.", icon: "glowstone", frame: "task", unlocked: false },
  { id: "aether:lore_book", title_id: "Kitab Kuno Aether", title_en: "Book of Lore", category: "aether", desc_id: "Dapatkan Book of Lore untuk mempelajari rahasia dunia Aether.", desc_en: "Obtain the Book of Lore to learn Aether secrets.", icon: "writable_book", frame: "task", unlocked: false },
  { id: "aether:skyroot_workbench", title_id: "Pertukangan Aether", title_en: "Skyroot Workbench", category: "aether", desc_id: "Buat Crafting Table dari kayu Skyroot.", desc_en: "Craft a Crafting Table using Skyroot wood.", icon: "crafting_table", frame: "task", unlocked: false },
  { id: "aether:blue_aercloud", title_id: "Awan Melayang", title_en: "To Infinity and Beyond", category: "aether", desc_id: "Melompat di atas Blue Aercloud untuk memantul tinggi ke udara.", desc_en: "Bounce high up by stepping on a Blue Aercloud.", icon: "light_blue_wool", frame: "task", unlocked: false },
  { id: "aether:ambrosium_shard", title_id: "Energi Ilahi", title_en: "Divine Energy", category: "aether", desc_id: "Tambang Ambrosium Shards untuk bahan bakar dan penyembuhan.", desc_en: "Mine Ambrosium Shards for fuel and healing.", icon: "gold_nugget", frame: "task", unlocked: false },
  { id: "aether:zanite_ore", title_id: "Kristal Ungu Zanite", title_en: "Purple Power", category: "aether", desc_id: "Temukan dan tambang bijih Zanite yang semakin kuat seiring durabilitas.", desc_en: "Find and mine Zanite ore.", icon: "amethyst_shard", frame: "task", unlocked: false },
  { id: "aether:gravitite_ore", title_id: "Batu Melawan Gravitasi", title_en: "Defying Gravity", category: "aether", desc_id: "Tambang bijih Gravitite langka yang melayang ke atas.", desc_en: "Mine rare Gravitite ore that floats upwards.", icon: "diamond", frame: "goal", unlocked: false },
  { id: "aether:incubator", title_id: "Penetas Burung Moa", title_en: "Moa Breeder", category: "aether", desc_id: "Gunakan Incubator untuk menetaskan telur Burung Moa.", desc_en: "Use an Incubator to hatch a Moa bird egg.", icon: "furnace", frame: "task", unlocked: false },
  { id: "aether:bronze_dungeon", title_id: "Labirin Perunggu", title_en: "Bronze Dungeon Explorer", category: "aether", desc_id: "Temukan dan selesaikan Bronze Dungeon di dimensi Aether.", desc_en: "Find and explore a Bronze Dungeon.", icon: "copper_block", frame: "task", unlocked: false },
  { id: "aether:defeat_slider", title_id: "Penghancur Slider", title_en: "Shattered Slider", category: "aether", desc_id: "Kalahkan boss Slider di dalam Bronze Dungeon.", desc_en: "Defeat the Slider boss in a Bronze Dungeon.", icon: "stone_bricks", frame: "goal", unlocked: false },
  { id: "aether:silver_dungeon", title_id: "Kuil Perak Valkyrie", title_en: "Silver Dungeon Explorer", category: "aether", desc_id: "Masuki Silver Dungeon yang dijaga para Valkyrie.", desc_en: "Enter a Silver Dungeon guarded by Valkyries.", icon: "quartz_block", frame: "task", unlocked: false },
  { id: "aether:defeat_valkyrie_queen", title_id: "Ratu Valkyrie", title_en: "Queen Slayer", category: "aether", desc_id: "Tantang dan kalahkan Valkyrie Queen di Silver Dungeon.", desc_en: "Defeat the Valkyrie Queen boss in a Silver Dungeon.", icon: "feather", frame: "goal", unlocked: false },
  { id: "aether:gold_dungeon", title_id: "Istana Emas Roh Matahari", title_en: "Gold Dungeon Explorer", category: "aether", desc_id: "Temukan Gold Dungeon di dalam awan tertinggi Aether.", desc_en: "Locate a Gold Dungeon in the highest Aether clouds.", icon: "gold_block", frame: "goal", unlocked: false },
  { id: "aether:defeat_sun_spirit", title_id: "Cahaya Abadi", title_en: "Eternal Light", category: "aether", desc_id: "Kalahkan boss Sun Spirit dan bebaskan matahari di Aether!", desc_en: "Defeat the Sun Spirit boss and liberate the sun in The Aether!", icon: "sunflower", frame: "challenge", unlocked: false },
  { id: "aether:valkyrie_armour", title_id: "Zirah Valkyrie", title_en: "Valkyrie Wings", category: "aether", desc_id: "Kumpulkan zirah Valkyrie lengkap yang memberikan kemampuan terbang.", desc_en: "Equip a full set of Valkyrie Armour.", icon: "chainmail_chestplate", frame: "challenge", unlocked: false },
  { id: "aether:phoenix_armour", title_id: "Zirah Kebangkitan Phoenix", title_en: "Phoenix Rebirth", category: "aether", desc_id: "Gunakan zirah Phoenix yang kebal terhadap api.", desc_en: "Equip the fire-resistant Phoenix Armor.", icon: "fire_charge", frame: "challenge", unlocked: false },
  { id: "aether:vampire_blade", title_id: "Pedang Pencabut Nyawa", title_en: "Vampiric Touch", category: "aether", desc_id: "Gunakan Vampire Blade untuk menyerap darah musuh.", desc_en: "Diverts lifesteal energy with the Vampire Blade.", icon: "iron_sword", frame: "goal", unlocked: false },
  { id: "aether:hammer_of_king_donkey", title_id: "Palu Raja Keledai", title_en: "Hammer of Wrath", category: "aether", desc_id: "Dapatkan Hammer of King Donkey di Aether.", desc_en: "Obtain the legendary Hammer of King Donkey.", icon: "anvil", frame: "challenge", unlocked: false },

  // 8. SAINTS DRAGON MOD (saintsdragon)
  { id: "saintsdragon:root", title_id: "Dunia Naga Kuno", title_en: "Ancient Dragon Realm", category: "saintsdragon", desc_id: "Jejakkan kaki di sarang naga kuno dan rasakan keagungan mereka.", desc_en: "Step into an ancient dragon lair.", icon: "dragon_head", frame: "task", unlocked: false },
  { id: "saintsdragon:find_dragon", title_id: "Penampakan Naga", title_en: "Dragon Encounter", category: "saintsdragon", desc_id: "Temukan naga liar yang terbang di angkasa atau bersembunyi di gua.", desc_en: "Encounter a wild dragon soaring in the sky or hiding in caves.", icon: "ender_eye", frame: "task", unlocked: false },
  { id: "saintsdragon:hatch_egg", title_id: "Induk Naga", title_en: "Mother of Dragons", category: "saintsdragon", desc_id: "Tetaskan telur naga kuno menggunakan elemen yang sesuai.", desc_en: "Hatch an ancient dragon egg using matching elements.", icon: "dragon_egg", frame: "goal", unlocked: false },
  { id: "saintsdragon:tame_dragon", title_id: "Pewaris Naga", title_en: "Dragon Master", category: "saintsdragon", desc_id: "Jinakkan bayi naga hingga menjadi sahabat setia.", desc_en: "Tame a baby dragon to become your loyal companion.", icon: "bone", frame: "goal", unlocked: false },
  { id: "saintsdragon:ride_dragon", title_id: "Penunggang Naga", title_en: "Sky Sovereign", category: "saintsdragon", desc_id: "Terbang mengangkasa dan kuasai langit bersama naga peliharaanmu!", desc_en: "Soar through the skies riding your tamed dragon!", icon: "saddle", frame: "challenge", unlocked: false },
  { id: "saintsdragon:dragon_armor", title_id: "Zirah Tempur Naga", title_en: "Dragon Armored", category: "saintsdragon", desc_id: "Pasangkan zirah berlian/besi khusus pada naga tempur kamu.", desc_en: "Equip your battle dragon with specialized dragon armor.", icon: "diamond_horse_armor", frame: "challenge", unlocked: false },
  { id: "saintsdragon:dragon_forge", title_id: "Tungku Penempa Naga", title_en: "Dragon Smithing", category: "saintsdragon", desc_id: "Gunakan Dragon Forge dan hembusan api naga untuk menimpa senjata terkuat.", desc_en: "Forge legendary gear using a Dragon Forge powered by dragon breath.", icon: "anvil", frame: "challenge", unlocked: false },
  { id: "saintsdragon:slay_elder_dragon", title_id: "Pembunuh Naga Kuno", title_en: "Elder Dragon Slayer", category: "saintsdragon", desc_id: "Kalahkan Naga Kuno (Elder Dragon Stage 5) yang sangat perkasa!", desc_en: "Slay a mighty Stage 5 Elder Dragon!", icon: "dragon_breath", frame: "challenge", unlocked: false },
  { id: "saintsdragon:dragon_horn", title_id: "Terompet Panggil Naga", title_en: "Dragon Horn Call", category: "saintsdragon", desc_id: "Gunakan Dragon Horn untuk memanggil naga peliharaanmu.", desc_en: "Summon your dragon into battle using a Dragon Horn.", icon: "goat_horn", frame: "task", unlocked: false },
  { id: "saintsdragon:dragon_blood", title_id: "Darah Naga Sakti", title_en: "Dragon Blood Infusion", category: "saintsdragon", desc_id: "Infusi senjata dengan Darah Naga untuk daya rusak dahsyat.", desc_en: "Infuse your weapons with powerful Dragon Blood.", icon: "redstone", frame: "goal", unlocked: false },
  { id: "saintsdragon:fire_dragon_slayer", title_id: "Penakluk Naga Api", title_en: "Fire Dragon Slayer", category: "saintsdragon", desc_id: "Kalahkan Naga Api raksasa di kawah gunung berapi.", desc_en: "Defeat a colossal Fire Dragon in its volcanic lair.", icon: "blaze_powder", frame: "challenge", unlocked: false },
  { id: "saintsdragon:ice_dragon_slayer", title_id: "Penakluk Naga Es", title_en: "Ice Dragon Slayer", category: "saintsdragon", desc_id: "Kalahkan Naga Es raksasa di puncak benua salju.", desc_en: "Defeat a colossal Ice Dragon in its frozen lair.", icon: "packed_ice", frame: "challenge", unlocked: false }
];

function getMergedAchievementsList(receivedList) {
  if (!Array.isArray(receivedList) || receivedList.length === 0) {
    return JSON.parse(JSON.stringify(DEFAULT_ACHIEVEMENTS_LIST));
  }

  const map = new Map();
  receivedList.forEach(item => {
    if (item && item.id) map.set(item.id, item);
  });

  return DEFAULT_ACHIEVEMENTS_LIST.map(defItem => {
    const existing = map.get(defItem.id);
    if (existing) {
      return {
        ...defItem,
        ...existing,
        unlocked: Boolean(existing.unlocked)
      };
    }
    return { ...defItem };
  });
}

let currentAchievementsData = getMergedAchievementsList([]);
let currentAchCategory = 'all';
let currentAchStatus = 'all';

async function fetchPlayerAchievementsHUD(usernameOverride) {
  const username = usernameOverride || currentHUDUsername;
  if (!username) return;

  const statusEl = document.getElementById('player-achievements-status');
  const loadingEl = document.getElementById('achLoading');
  const errorEl = document.getElementById('achError');
  const errorMsgEl = document.getElementById('achErrorMessage');
  const gridEl = document.getElementById('achievementsGrid');

  const localCacheKey = `aetheria_ach_cache_${username.toLowerCase()}`;

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (gridEl) gridEl.classList.add('hidden');

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_achievements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success' && Array.isArray(json.achievements)) {
      const merged = getMergedAchievementsList(json.achievements);
      json.achievements = merged;
      localStorage.setItem(localCacheKey, JSON.stringify(json));
      currentAchievementsData = merged;
      updateAchievementStats(json.stats || calculateStatsFromList(merged));
      applyAchievementsFilter();

      if (json.isCached) {
        if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-clock-rotate-left text-[10px] mr-1"></i> Data Terakhir (${calculateStatsFromList(merged).unlocked}/${merged.length} Unlocked - Offline)</span>`;
      } else {
        if (statusEl) statusEl.innerHTML = `<span class="text-emerald-400 font-bold"><i class="fa-solid fa-circle text-[8px] mr-1"></i> Live Achievements (${calculateStatsFromList(merged).unlocked}/${merged.length} Unlocked)</span>`;
      }

      if (loadingEl) loadingEl.classList.add('hidden');
      if (gridEl) gridEl.classList.remove('hidden');
      return;
    }

    // Fallback 1: Coba dari Google Spreadsheet Database
    const dbData = await fetchPlayerSpreadsheetDB(username);
    if (dbData && dbData.achievement) {
      let rawAch = Array.isArray(dbData.achievement) ? dbData.achievement : [];
      let merged = getMergedAchievementsList(rawAch);
      currentAchievementsData = merged;
      const stats = calculateStatsFromList(merged);
      updateAchievementStats(stats);
      applyAchievementsFilter();
      if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-file-excel text-[10px] mr-1"></i> Data Spreadsheet (${stats.unlocked}/${merged.length} Unlocked - ${dbData.lastUpdated || 'Offline'})</span>`;
      if (loadingEl) loadingEl.classList.add('hidden');
      if (gridEl) gridEl.classList.remove('hidden');
      return;
    }

    // Fallback 2: Local storage / default list
    const savedLocal = localStorage.getItem(localCacheKey);
    let fallbackList = DEFAULT_ACHIEVEMENTS_LIST;
    if (savedLocal) {
      try {
        const localData = JSON.parse(savedLocal);
        if (localData && Array.isArray(localData.achievements)) {
          fallbackList = getMergedAchievementsList(localData.achievements);
        }
      } catch (e) {}
    }

    currentAchievementsData = fallbackList;
    updateAchievementStats(calculateStatsFromList(fallbackList));
    applyAchievementsFilter();

    if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-clock-rotate-left text-[10px] mr-1"></i> Data Terakhir (${calculateStatsFromList(fallbackList).unlocked}/${fallbackList.length} Unlocked)</span>`;
    if (loadingEl) loadingEl.classList.add('hidden');
    if (gridEl) gridEl.classList.remove('hidden');

  } catch (err) {
    console.error("Error HUD Achievements:", err);
    const savedLocal = localStorage.getItem(localCacheKey);
    let fallbackList = DEFAULT_ACHIEVEMENTS_LIST;
    if (savedLocal) {
      try {
        const localData = JSON.parse(savedLocal);
        if (localData && Array.isArray(localData.achievements)) {
          fallbackList = getMergedAchievementsList(localData.achievements);
        }
      } catch (e) {}
    }

    currentAchievementsData = fallbackList;
    updateAchievementStats(calculateStatsFromList(fallbackList));
    applyAchievementsFilter();

    if (statusEl) statusEl.innerHTML = `<span class="text-amber-400 font-bold"><i class="fa-solid fa-clock-rotate-left text-[10px] mr-1"></i> Data Terakhir (Offline)</span>`;
    if (loadingEl) loadingEl.classList.add('hidden');
    if (gridEl) gridEl.classList.remove('hidden');
  }
}

function calculateStatsFromList(list) {
  const total = list.length;
  const unlocked = list.filter(i => i.unlocked).length;
  return {
    total,
    unlocked,
    percentage: total > 0 ? Math.round((unlocked / total) * 100) : 0
  };
}

function updateAchievementStats(stats) {
  if (!stats) return;
  const progressText = document.getElementById('achProgressText');
  const progressBar = document.getElementById('achProgressBar');
  const statUnlocked = document.getElementById('achStatUnlocked');
  const statLocked = document.getElementById('achStatLocked');

  const total = stats.total || 0;
  const unlocked = stats.unlocked || 0;
  const locked = total - unlocked;
  const pct = total > 0 ? Math.round((unlocked / total) * 100) : 0;

  if (progressText) progressText.innerText = `${unlocked} / ${total} (${pct}%)`;
  if (progressBar) progressBar.style.width = `${pct}%`;
  if (statUnlocked) statUnlocked.innerText = unlocked;
  if (statLocked) statLocked.innerText = locked;
}

function filterAchievementsCategory(cat) {
  currentAchCategory = cat;
  const btns = document.querySelectorAll('#achCategoryTabs .ach-tab-btn');
  btns.forEach(btn => {
    if (btn.dataset.cat === cat) {
      btn.className = 'ach-tab-btn active bg-rose-600 text-white font-bold px-3 py-1.5 rounded-lg transition';
    } else {
      btn.className = 'ach-tab-btn bg-slate-900 hover:bg-slate-800 text-slate-300 px-3 py-1.5 rounded-lg transition border border-slate-800';
    }
  });
  applyAchievementsFilter();
}

function applyAchievementsFilter() {
  const statusFilterSelect = document.getElementById('achStatusFilter');
  if (statusFilterSelect) {
    currentAchStatus = statusFilterSelect.value;
  }

  let filtered = currentAchievementsData;

  if (currentAchCategory !== 'all') {
    filtered = filtered.filter(item => item.category === currentAchCategory);
  }

  if (currentAchStatus === 'unlocked') {
    filtered = filtered.filter(item => item.unlocked);
  } else if (currentAchStatus === 'locked') {
    filtered = filtered.filter(item => !item.unlocked);
  }

  renderAchievementsCards(filtered);
}

function formatCategoryLabel(cat) {
  if (cat === 'epicfight') return 'Epic Fight';
  if (cat === 'aether') return 'The Aether';
  if (cat === 'saintsdragon') return 'Saints Dragon';
  return String(cat || '').charAt(0).toUpperCase() + String(cat || '').slice(1);
}

function renderAchievementsCards(list) {
  const gridEl = document.getElementById('achievementsGrid');
  if (!gridEl) return;

  if (!list || list.length === 0) {
    const emptyMsg = typeof window.t === 'function' ? window.t('player.ach_empty') : 'Tidak ada pencapaian yang cocok dengan filter.';
    gridEl.innerHTML = `
      <div class="col-span-full py-10 text-center text-xs font-mono-code text-slate-500 bg-slate-950/40 border border-slate-800/60 rounded-xl p-4">
        <i class="fa-solid fa-trophy text-2xl text-slate-600 mb-2 block"></i>
        <span>${emptyMsg}</span>
      </div>
    `;
    return;
  }

  const isEn = typeof window.getCurrentLanguage === 'function' && window.getCurrentLanguage() === 'en';

  let html = '';
  list.forEach(item => {
    const title = isEn ? (item.title_en || item.title_id) : (item.title_id || item.title_en);
    const desc = isEn ? (item.desc_en || item.desc_id) : (item.desc_id || item.desc_en);
    const iconId = item.icon || 'crafting_table';

    let frameBadge = '';
    if (item.frame === 'challenge') {
      frameBadge = `<span class="bg-rose-950/80 text-rose-400 border border-rose-500/40 px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase tracking-wide">Challenge</span>`;
    } else if (item.frame === 'goal') {
      frameBadge = `<span class="bg-amber-950/80 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded text-[9px] font-mono-code font-bold uppercase tracking-wide">Goal</span>`;
    } else {
      frameBadge = `<span class="bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 rounded text-[9px] font-mono-code font-semibold uppercase tracking-wide">Task</span>`;
    }

    const iconUrl = `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/${iconId}.png`;

    if (item.unlocked) {
      html += `
        <div class="p-3.5 rounded-xl border bg-slate-950 border-emerald-500/40 shadow-md relative overflow-hidden transition hover:border-emerald-400 flex flex-col justify-between group">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-lg bg-emerald-950/70 border border-emerald-500/50 flex items-center justify-center p-1.5 shrink-0 shadow-inner">
                  <img src="${iconUrl}" alt="${title}" class="w-full h-full object-contain" onerror="handleItemImgError(this, '${iconId}')">
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-bold text-emerald-300 font-mono-code truncate flex items-center gap-1.5">
                    <i class="fa-solid fa-circle-check text-emerald-400 text-[10px]"></i>
                    <span>${escapeHTML(title)}</span>
                  </h4>
                  <p class="text-[10px] text-slate-400 font-mono-code">${formatCategoryLabel(item.category)}</p>
                </div>
              </div>
              <div class="shrink-0 flex flex-col items-end gap-1">
                ${frameBadge}
              </div>
            </div>
            <p class="text-[11px] text-slate-300 font-mono-code leading-relaxed pl-1">${escapeHTML(desc)}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-emerald-900/40 flex items-center justify-between text-[10px] font-mono-code">
            <span class="text-emerald-400 font-bold flex items-center gap-1">
              <i class="fa-solid fa-sparkles"></i> Terbuka (Unlocked)
            </span>
            <span class="text-slate-500">ID: ${item.id.replace(/^minecraft:/, '')}</span>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="p-3.5 rounded-xl border bg-slate-950/60 border-slate-800/80 opacity-75 hover:opacity-100 transition hover:border-slate-700 flex flex-col justify-between group">
          <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-2">
              <div class="flex items-center gap-2.5">
                <div class="w-10 h-10 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center p-1.5 shrink-0 grayscale opacity-60">
                  <img src="${iconUrl}" alt="${title}" class="w-full h-full object-contain" onerror="handleItemImgError(this, '${iconId}')">
                </div>
                <div class="min-w-0">
                  <h4 class="text-xs font-semibold text-slate-400 font-mono-code truncate flex items-center gap-1.5">
                    <i class="fa-solid fa-lock text-slate-500 text-[10px]"></i>
                    <span>${escapeHTML(title)}</span>
                  </h4>
                  <p class="text-[10px] text-slate-500 font-mono-code">${formatCategoryLabel(item.category)}</p>
                </div>
              </div>
              <div class="shrink-0 flex flex-col items-end gap-1">
                ${frameBadge}
              </div>
            </div>
            <p class="text-[11px] text-slate-400 font-mono-code leading-relaxed pl-1">${escapeHTML(desc)}</p>
          </div>
          <div class="mt-3 pt-2 border-t border-slate-900 flex items-center justify-between text-[10px] font-mono-code">
            <span class="text-slate-500 font-semibold flex items-center gap-1">
              <i class="fa-solid fa-lock"></i> Terkunci (Locked)
            </span>
            <span class="text-slate-600">ID: ${item.id.replace(/^minecraft:/, '')}</span>
          </div>
        </div>
      `;
    }
  });

  gridEl.innerHTML = html;
}

window.fetchPlayerAchievementsHUD = fetchPlayerAchievementsHUD;
window.filterAchievementsCategory = filterAchievementsCategory;
window.applyAchievementsFilter = applyAchievementsFilter;