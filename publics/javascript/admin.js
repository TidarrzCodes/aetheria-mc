const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";
const SERVER_DOMAIN = "aetheria.raditnex.my.id";

let ordersData = [];
let currentFilter = 'ALL';
let currentMainTab = 'systems';

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

function getAdminToken() {
  const cookie = getCookie('aetheria_admin_token');
  if (cookie && cookie !== 'true') return cookie;
  return '';
}

// ==========================================
// TOAST NOTIFICATION SYSTEM
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
// INITIALIZATION & TIMERS
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  const adminCookie = getCookie('aetheria_admin_token');
  const sessionAuth = sessionStorage.getItem('aetheria_admin_auth');

  if (adminCookie || sessionAuth === 'true') {
    unlockDashboard();
  } else {
    window.location.href = './login.html';
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeImageModal();
    closeInvseeModal();
    closeEditPlayerModal();
  }
});

let autoReloadElapsed = 0;
let autoReloadTimer = null;
const AUTO_REFRESH_INTERVAL = 10000; // Interval tabel pemain (10 detik)

function startAutoReloadAnimation() {
  if (autoReloadTimer) clearInterval(autoReloadTimer);
  autoReloadElapsed = 0;

  const bar = document.getElementById('autoReloadBar');
  const spinner = document.getElementById('autoReloadSpinner');

  autoReloadTimer = setInterval(() => {
    autoReloadElapsed += 100;
    const percent = Math.min((autoReloadElapsed / AUTO_REFRESH_INTERVAL) * 100, 100);

    if (bar) {
      bar.style.width = `${percent}%`;
    }

    if (autoReloadElapsed >= AUTO_REFRESH_INTERVAL) {
      autoReloadElapsed = 0;
      if (bar) bar.style.width = '0%';

      if (spinner) {
        spinner.classList.add('fa-spin');
        setTimeout(() => spinner.classList.remove('fa-spin'), 1000);
      }

      syncCurrentTab();
    }
  }, 100);

  // Interval terpisah khusus console log (3000ms) untuk menghemat kuota Worker & Pterodactyl
  setInterval(() => {
    if (currentMainTab === 'systems') {
      fetchRealtimeConsoleLogs();
    }
  }, 3000);
}

function unlockDashboard() {
  const dash = document.getElementById('dashboardContent');
  if (dash) dash.classList.remove('hidden');

  renderStaffProfileBadge();
  syncCurrentTab();
  startAutoReloadAnimation();
}

async function renderStaffProfileBadge() {
  const badgeContainer = document.getElementById('staffProfileBadge');
  if (!badgeContainer) return;

  const savedUser = sessionStorage.getItem('aetheria_admin_username') || localStorage.getItem('aetheria_player_user') || 'Admin';
  const savedRank = sessionStorage.getItem('aetheria_admin_rank') || 'Staff';

  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=staff_heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ username: savedUser, rank: savedRank })
    });

    const json = await res.json().catch(() => null);
    if (res.ok && json && json.result === 'success' && Array.isArray(json.activeStaff)) {
      renderActiveStaffList(json.activeStaff);
      return;
    }
  } catch (e) { }

  renderActiveStaffList([{ username: savedUser, rank: savedRank }]);
}

function renderActiveStaffList(staffList) {
  const badgeContainer = document.getElementById('staffProfileBadge');
  if (!badgeContainer) return;

  if (!Array.isArray(staffList) || staffList.length === 0) {
    badgeContainer.classList.add('hidden');
    return;
  }

  const avatarsHtml = staffList.map(item => {
    const user = escapeHTML(item.username);
    const rank = escapeHTML((item.rank || 'Staff').toUpperCase());
    return `
      <div class="relative group flex items-center gap-1.5 bg-[#09090b] px-2 py-1 rounded-lg border border-zinc-800/80" title="${user} (${rank})">
        <div class="relative shrink-0">
          <img src="https://mc-heads.net/avatar/${encodeURIComponent(item.username)}/24" alt="${user}" class="w-5 h-5 rounded-full border border-rose-500/60 object-cover shadow-sm">
          <span class="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 border border-[#09090b] animate-pulse"></span>
        </div>
        <div class="hidden sm:flex flex-col leading-none">
          <span class="text-white font-bold text-[10px] font-mono">${user}</span>
          <span class="text-[8px] text-rose-400 font-mono tracking-tight">${rank}</span>
        </div>
      </div>
    `;
  }).join('');

  badgeContainer.innerHTML = avatarsHtml;
  badgeContainer.classList.remove('hidden');
  badgeContainer.classList.add('flex');
}

function handleLogout() {
  eraseCookie('aetheria_admin_token');
  sessionStorage.removeItem('aetheria_admin_auth');
  localStorage.removeItem('aetheria_player_user');
  window.location.href = './login.html';
}

function switchMainTab(tabName) {
  currentMainTab = tabName;
  autoReloadElapsed = 0;
  const bar = document.getElementById('autoReloadBar');
  if (bar) bar.style.width = '0%';

  const viewOrders = document.getElementById('view-orders');
  const viewPlayers = document.getElementById('view-players');
  const viewSystems = document.getElementById('view-systems');
  const viewEtc = document.getElementById('view-etc');

  const btnOrders = document.getElementById('main-tab-orders');
  const btnPlayers = document.getElementById('main-tab-players');
  const btnSystems = document.getElementById('main-tab-systems');
  const btnEtc = document.getElementById('main-tab-etc');

  if (viewOrders) viewOrders.classList.add('hidden');
  if (viewPlayers) viewPlayers.classList.add('hidden');
  if (viewSystems) viewSystems.classList.add('hidden');
  if (viewEtc) viewEtc.classList.add('hidden');

  const inactiveBtnClass = "px-2.5 sm:px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition flex items-center justify-center gap-1.5 text-xs";
  const activeBtnClass = "px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium transition flex items-center justify-center gap-1.5 text-xs";

  if (btnOrders) btnOrders.className = inactiveBtnClass;
  if (btnPlayers) btnPlayers.className = inactiveBtnClass;
  if (btnSystems) btnSystems.className = inactiveBtnClass;
  if (btnEtc) btnEtc.className = inactiveBtnClass;

  if (tabName === 'orders') {
    if (viewOrders) viewOrders.classList.remove('hidden');
    if (btnOrders) btnOrders.className = activeBtnClass;
    fetchOrders();
  } else if (tabName === 'players') {
    if (viewPlayers) viewPlayers.classList.remove('hidden');
    if (btnPlayers) btnPlayers.className = activeBtnClass;
    fetchOnlinePlayers();
  } else if (tabName === 'systems') {
    if (viewSystems) viewSystems.classList.remove('hidden');
    if (btnSystems) btnSystems.className = activeBtnClass;
    fetchRealtimeConsoleLogs();
  } else if (tabName === 'etc') {
    if (viewEtc) viewEtc.classList.remove('hidden');
    if (btnEtc) btnEtc.className = activeBtnClass;
    fetchWebChatLogs();
  }
}

function syncCurrentTab() {
  if (currentMainTab === 'orders') {
    fetchOrders();
  } else if (currentMainTab === 'players') {
    fetchOnlinePlayers();
  } else if (currentMainTab === 'systems') {
    fetchRealtimeConsoleLogs();
  } else if (currentMainTab === 'etc') {
    fetchWebChatLogs();
  }
}

// ==========================================
// MODERASI PEMAIN & KONSOL
// ==========================================
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
  if (!username) return;

  const modal = document.getElementById('invseeModal');
  const userEl = document.getElementById('invseeUsername');
  const headEl = document.getElementById('invseePlayerHead');
  const loadingEl = document.getElementById('invseeLoading');
  const errorEl = document.getElementById('invseeError');
  const errorMsgEl = document.getElementById('invseeErrorMessage');
  const contentEl = document.getElementById('invseeContent');

  if (userEl) userEl.innerText = username;
  if (headEl) headEl.src = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/28`;

  if (modal) modal.classList.remove('hidden');
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (contentEl) contentEl.classList.add('hidden');

  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_inventory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ username })
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success' && Array.isArray(json.inventory)) {
      renderPlayerInventory(json.inventory);
      if (loadingEl) loadingEl.classList.add('hidden');
      if (contentEl) contentEl.classList.remove('hidden');
    } else {
      const errorMsg = (json && json.message) || `Player "${username}" offline atau data inventori tidak ditemukan.`;
      if (errorMsgEl) errorMsgEl.innerText = errorMsg;
      if (loadingEl) loadingEl.classList.add('hidden');
      if (errorEl) errorEl.classList.remove('hidden');
    }
  } catch (err) {
    console.error("Invsee fetch error:", err);
    if (errorMsgEl) errorMsgEl.innerText = "Kesalahan koneksi saat mengambil inventori pemain.";
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
  }
}

function closeInvseeModal() {
  const modal = document.getElementById('invseeModal');
  if (modal) modal.classList.add('hidden');
}

let currentTargetPlayer = '';

function openEditPlayerModal(username) {
  if (!username) return;
  currentTargetPlayer = username;

  const modal = document.getElementById('editPlayerModal');
  const userEl = document.getElementById('editPlayerUsername');
  const headEl = document.getElementById('editPlayerHead');

  if (userEl) userEl.innerText = username;
  if (headEl) headEl.src = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/28`;

  switchEditPlayerTab('lp');

  if (modal) modal.classList.remove('hidden');
}

function closeEditPlayerModal() {
  const modal = document.getElementById('editPlayerModal');
  if (modal) modal.classList.add('hidden');
}

function switchEditPlayerTab(tabName) {
  const tabLp = document.getElementById('editPlayerTab-lp');
  const tabEco = document.getElementById('editPlayerTab-eco');
  const btnLp = document.getElementById('editPlayerBtnTab-lp');
  const btnEco = document.getElementById('editPlayerBtnTab-eco');

  if (tabLp) tabLp.classList.add('hidden');
  if (tabEco) tabEco.classList.add('hidden');

  const inactiveBtnClass = "px-2.5 py-1 rounded-lg text-zinc-400 hover:text-white transition text-[11px] font-mono flex items-center gap-1";
  const activeBtnClass = "px-2.5 py-1 rounded-lg bg-zinc-800 text-white font-medium transition text-[11px] font-mono flex items-center gap-1";

  if (btnLp) btnLp.className = inactiveBtnClass;
  if (btnEco) btnEco.className = inactiveBtnClass;

  if (tabName === 'lp') {
    if (tabLp) tabLp.classList.remove('hidden');
    if (btnLp) btnLp.className = activeBtnClass;
  } else if (tabName === 'eco') {
    if (tabEco) tabEco.classList.remove('hidden');
    if (btnEco) btnEco.className = activeBtnClass;
  }
}

async function submitLpSetGroup() {
  if (!currentTargetPlayer) return;
  const select = document.getElementById('lpGroupSelect');
  const group = select ? select.value : 'default';

  const command = `lp user ${currentTargetPlayer} parent set ${group}`;
  await executeAdminCommand(command, `Rank ${currentTargetPlayer} diubah menjadi ${group.toUpperCase()}!`);
  closeEditPlayerModal();
  fetchOnlinePlayers();
}

async function submitLpAddPermission() {
  if (!currentTargetPlayer) return;
  const input = document.getElementById('lpPermissionInput');
  const perm = input ? input.value.trim() : '';

  if (!perm) {
    showToast("Masukkan nama permission node!", "warning");
    return;
  }

  const command = `lp user ${currentTargetPlayer} permission set ${perm} true`;
  await executeAdminCommand(command, `Permission "${perm}" ditambahkan ke ${currentTargetPlayer}!`);
  if (input) input.value = '';
}

async function submitLpUnsetPermission() {
  if (!currentTargetPlayer) return;
  const input = document.getElementById('lpUnsetPermissionInput');
  const perm = input ? input.value.trim() : '';

  if (!perm) {
    showToast("Masukkan nama permission node!", "warning");
    return;
  }

  const command = `lp user ${currentTargetPlayer} permission unset ${perm}`;
  await executeAdminCommand(command, `Permission "${perm}" dihapus dari ${currentTargetPlayer}!`);
  if (input) input.value = '';
}

async function submitLpCheckInfo() {
  if (!currentTargetPlayer) return;
  const command = `lp user ${currentTargetPlayer} info`;
  await executeAdminCommand(command, `Info LuckPerms ${currentTargetPlayer} telah diminta.`);
}

async function submitLpClearParent() {
  if (!currentTargetPlayer) return;
  if (!confirm(`Hapus semua parent rank dari ${currentTargetPlayer}?`)) return;

  const command = `lp user ${currentTargetPlayer} parent clear`;
  await executeAdminCommand(command, `Parent ranks ${currentTargetPlayer} telah dibersihkan.`);
  closeEditPlayerModal();
  fetchOnlinePlayers();
}

async function submitEcoSetBalance() {
  if (!currentTargetPlayer) return;
  const input = document.getElementById('ecoAmountInput');
  const amount = input ? input.value.trim() : '';

  if (!amount || isNaN(amount) || Number(amount) < 0) {
    showToast("Masukkan nominal saldo yang valid!", "warning");
    return;
  }

  const command = `eco set ${currentTargetPlayer} ${amount}`;
  await executeAdminCommand(command, `Balance ${currentTargetPlayer} di-set ke $${Number(amount).toLocaleString()}!`);
  if (input) input.value = '';
}

async function submitEcoGiveMoney() {
  if (!currentTargetPlayer) return;
  const input = document.getElementById('ecoAmountInput');
  const amount = input ? input.value.trim() : '';

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    showToast("Masukkan nominal saldo yang valid!", "warning");
    return;
  }

  const command = `eco give ${currentTargetPlayer} ${amount}`;
  await executeAdminCommand(command, `Menambahkan $${Number(amount).toLocaleString()} ke ${currentTargetPlayer}!`);
  if (input) input.value = '';
}

async function submitEcoTakeMoney() {
  if (!currentTargetPlayer) return;
  const input = document.getElementById('ecoAmountInput');
  const amount = input ? input.value.trim() : '';

  if (!amount || isNaN(amount) || Number(amount) <= 0) {
    showToast("Masukkan nominal saldo yang valid!", "warning");
    return;
  }

  const command = `eco take ${currentTargetPlayer} ${amount}`;
  await executeAdminCommand(command, `Mengurangi $${Number(amount).toLocaleString()} dari ${currentTargetPlayer}!`);
  if (input) input.value = '';
}

async function submitEcoResetBalance() {
  if (!currentTargetPlayer) return;
  if (!confirm(`Reset saldo ${currentTargetPlayer} menjadi 0?`)) return;

  const command = `eco reset ${currentTargetPlayer}`;
  await executeAdminCommand(command, `Balance ${currentTargetPlayer} telah di-reset ke 0.`);
}

window.openEditPlayerModal = openEditPlayerModal;
window.closeEditPlayerModal = closeEditPlayerModal;
window.switchEditPlayerTab = switchEditPlayerTab;
window.submitLpSetGroup = submitLpSetGroup;
window.submitLpAddPermission = submitLpAddPermission;
window.submitLpUnsetPermission = submitLpUnsetPermission;
window.submitLpCheckInfo = submitLpCheckInfo;
window.submitLpClearParent = submitLpClearParent;
window.submitEcoSetBalance = submitEcoSetBalance;
window.submitEcoGiveMoney = submitEcoGiveMoney;
window.submitEcoTakeMoney = submitEcoTakeMoney;
window.submitEcoResetBalance = submitEcoResetBalance;

function renderPlayerInventory(inventoryList) {
  const itemMap = {};
  if (Array.isArray(inventoryList)) {
    inventoryList.forEach(item => {
      if (item && typeof item.slot === 'number') {
        itemMap[item.slot] = item;
      }
    });
  }

  const armorSlots = [
    { slot: 103, elId: 'invsee-slot-103', placeholder: '<i class="fa-solid fa-helmet-safety text-zinc-700 text-xs"></i>', label: 'Helmet' },
    { slot: 102, elId: 'invsee-slot-102', placeholder: '<i class="fa-solid fa-shirt text-zinc-700 text-xs"></i>', label: 'Chestplate' },
    { slot: 101, elId: 'invsee-slot-101', placeholder: '<i class="fa-solid fa-user text-zinc-700 text-xs"></i>', label: 'Leggings' },
    { slot: 100, elId: 'invsee-slot-100', placeholder: '<i class="fa-solid fa-socks text-zinc-700 text-xs"></i>', label: 'Boots' },
    { slot: -106, elId: 'invsee-slot--106', placeholder: '<i class="fa-solid fa-shield text-zinc-700 text-xs"></i>', label: 'Offhand' }
  ];

  armorSlots.forEach(cfg => {
    const el = document.getElementById(cfg.elId);
    if (el) {
      const item = itemMap[cfg.slot];
      el.innerHTML = renderSlotInnerHtml(cfg.slot, item, cfg.placeholder, cfg.label);
    }
  });

  const mainGrid = document.getElementById('mainInventoryGrid');
  if (mainGrid) {
    let mainHtml = '';
    for (let s = 9; s <= 35; s++) {
      const item = itemMap[s];
      mainHtml += renderSlotInnerHtml(s, item);
    }
    mainGrid.innerHTML = mainHtml;
  }

  const hotbarGrid = document.getElementById('hotbarGrid');
  if (hotbarGrid) {
    let hotbarHtml = '';
    for (let s = 0; s <= 8; s++) {
      const item = itemMap[s];
      hotbarHtml += renderSlotInnerHtml(s, item);
    }
    hotbarGrid.innerHTML = hotbarHtml;
  }
}

function renderSlotInnerHtml(slotNum, item, placeholderIcon = '', defaultLabel = '') {
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
          <div class="bg-zinc-950/95 border border-zinc-700 text-zinc-100 text-[10px] font-mono py-1 px-2 rounded shadow-2xl whitespace-nowrap">
            <div class="font-bold text-rose-400">${escapeHTML(itemName)}</div>
            <div class="text-[9px] text-zinc-400">Jumlah: ${item.count} &bull; Slot: ${slotNum} &bull; ID: ${escapeHTML(cleanId)}</div>
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

function handleItemImgError(img, cleanId) {
  if (!img) return;
  const currentStep = parseInt(img.dataset.step || '0', 10);
  const nextStep = currentStep + 1;
  img.dataset.step = String(nextStep);

  const sources = [
    `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/items/${cleanId}.png`,
    `https://raw.githubusercontent.com/PrismarineJS/minecraft-assets/master/data/1.20.1/blocks/${cleanId}.png`,
    `https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/item/${cleanId}.png`,
    `https://assets.mcasset.cloud/1.20.1/assets/minecraft/textures/block/${cleanId}.png`,
    `https://mc-heads.net/item/${cleanId}`
  ];

  if (nextStep < sources.length) {
    img.src = sources[nextStep];
  } else {
    img.style.display = 'none';
    const parent = img.parentElement;
    if (parent && !parent.querySelector('.mc-fallback-badge')) {
      const badge = document.createElement('span');
      badge.className = 'mc-fallback-badge text-[10px] font-mono font-bold text-rose-300 truncate max-w-[34px] block text-center uppercase select-none';
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

async function controlServerPower(signal) {
  const signalNames = {
    start: 'MENYALAKAN (ON)',
    stop: 'MEMATIKAN (OFF)',
    restart: 'MEREBOOT (RESTART)'
  };
  const label = signalNames[signal] || signal;

  if (!confirm(`Apakah Anda yakin ingin ${label} server Minecraft?`)) {
    return;
  }

  const btnStart = document.getElementById('btnPowerStart');
  const btnRestart = document.getElementById('btnPowerRestart');
  const btnStop = document.getElementById('btnPowerStop');

  [btnStart, btnRestart, btnStop].forEach(btn => {
    if (btn) btn.disabled = true;
  });

  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=server_power`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ signal })
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success') {
      showToast(json.message || `Signal ${signal} berhasil dikirim ke server!`, "success");
      appendConsoleOutput(`[POWER STATE] Signal ${signal.toUpperCase()}`, json.message || "Power signal executed.", false);
      setTimeout(fetchOnlinePlayers, 3000);
    } else {
      const errorMsg = (json && json.message) || "Gagal mengubah status power server.";
      showToast("Gagal: " + errorMsg, "error");
      appendConsoleOutput(`[POWER STATE] Signal ${signal.toUpperCase()}`, errorMsg, true);
    }
  } catch (err) {
    console.error("Power control error:", err);
    showToast("Kesalahan koneksi saat menghubungi Worker.", "error");
  } finally {
    [btnStart, btnRestart, btnStop].forEach(btn => {
      if (btn) btn.disabled = false;
    });
  }
}

window.controlServerPower = controlServerPower;

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
    const adminToken = getAdminToken();
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
      btn.innerHTML = `Send`;
    }
  }
}

let lastConsoleLogHash = '';
let isFetchingConsole = false;

async function fetchRealtimeConsoleLogs() {
  const terminal = document.getElementById('consoleTerminalWindow');
  if (!terminal || isFetchingConsole) return;
  isFetchingConsole = true;

  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_console_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      }
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success' && Array.isArray(json.logs)) {
      const logsStr = json.logs.join('\n');
      if (logsStr === lastConsoleLogHash) return;
      lastConsoleLogHash = logsStr;

      const cleanLogs = json.logs
        .filter(line => {
          const lower = line.toLowerCase();
          return !lower.includes('issued server command: /list') &&
            !lower.includes('issued server command: /data get entity') &&
            !lower.includes('there are 0 out of maximum') &&
            !lower.includes('players online');
        })
        .map(line => {
          return line
            .replace(/\u001b\[[0-9;]*m/g, '')
            .replace(/§[0-9a-fk-or]/gi, '');
        });

      const isScrolledToBottom = terminal.scrollHeight - terminal.clientHeight <= terminal.scrollTop + 50;

      terminal.innerHTML = cleanLogs.map(line => {
        const lower = line.toLowerCase();
        const isError = lower.includes('error') || lower.includes('exception') || lower.includes('warn');
        const isCmd = lower.includes('[webchat]') || lower.includes('issued server command');
        const colorClass = isError ? 'text-rose-400 font-semibold' : (isCmd ? 'text-amber-300 font-medium' : 'text-zinc-300');
        return `<div class="${colorClass} leading-relaxed text-[11px] font-mono break-all">${escapeHTML(line)}</div>`;
      }).join('');

      if (isScrolledToBottom || terminal.scrollTop === 0) {
        terminal.scrollTop = terminal.scrollHeight;
      }
    }
  } catch (err) {
  } finally {
    isFetchingConsole = false;
  }
}

function appendConsoleOutput(command, output, isError = false) {
  setTimeout(fetchRealtimeConsoleLogs, 300);
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
  const headerDot = document.getElementById('header-status-dot');
  const countText = document.getElementById('player-tab-count');
  const tableBody = document.getElementById('player-table-list');
  const badgeCount = document.getElementById('nav-player-badge');

  try {
    const adminToken = getAdminToken();
    const [pteroRes, rconPlayersRes] = await Promise.all([
      fetch(`${WORKER_PROXY_URL}?action=get_server_status`).catch(() => null),
      fetch(`${WORKER_PROXY_URL}?action=get_online_players`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        }
      }).catch(() => null)
    ]);

    const pteroData = pteroRes ? await pteroRes.json().catch(() => null) : null;
    const rconData = rconPlayersRes ? await rconPlayersRes.json().catch(() => null) : null;

    const pteroState = (pteroData && pteroData.result === 'success') ? pteroData.state : null;
    const pteroOnline = (pteroData && pteroData.result === 'success') ? pteroData.online : false;
    const rconSuccess = rconData && rconData.result === 'success';

    // Strict evaluation: If Pterodactyl explicit status is returned, strictly respect state ('running' vs 'offline'/'stopped')
    let isOnline = false;
    if (pteroData && pteroData.result === 'success') {
      isOnline = pteroOnline && (pteroState === 'running');
    } else {
      isOnline = rconSuccess;
    }

    if (isOnline) {
      if (dot) dot.className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse";
      if (headerDot) headerDot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";

      let onlineList = (rconData && rconData.players) ? rconData.players : [];
      let onlineCount = (rconData && typeof rconData.online === 'number') ? rconData.online : onlineList.length;
      let maxCount = (rconData && rconData.max) ? rconData.max : 20;

      if (countText) countText.innerText = `${onlineCount} / ${maxCount} Player Online (ONLINE)`;
      if (badgeCount) badgeCount.innerText = onlineCount;

      if (onlineList.length > 0) {
        if (tableBody) {
          tableBody.innerHTML = onlineList.map(p => {
            const name = typeof p === 'object' ? p.name : p;
            const rank = typeof p === 'object' && p.group ? p.group : 'Member';
            const safeName = escapeHTML(name);

            return `
              <tr onclick="openPlayerDetailModal('${safeName}')" class="hover:bg-zinc-900/60 transition cursor-pointer group" title="Klik baris untuk melihat IP, Geolokasi, & Telemetry ${safeName}">
                <td class="p-3.5 w-12">
                  <img src="https://mc-heads.net/avatar/${safeName}/28" alt="${safeName}" class="w-7 h-7 rounded border border-zinc-700 group-hover:border-rose-500 transition">
                </td>
                <td class="p-3.5 font-semibold text-white font-mono flex items-center gap-1.5">
                  <span>${safeName}</span>
                  <i class="fa-solid fa-circle-info text-[10px] text-zinc-600 group-hover:text-rose-400 transition"></i>
                </td>
                <td class="p-3.5">
                  ${renderRankBadge(rank)}
                </td>
                <td class="p-3.5">
                  <span class="text-zinc-500 font-mono text-[11px]">-</span>
                </td>
                <td class="p-3.5">
                  <span class="text-zinc-500 font-mono text-[11px]">-</span>
                </td>
                <td class="p-3.5 text-right font-mono" onclick="event.stopPropagation()">
                  <div class="inline-flex items-center gap-1.5 flex-wrap justify-end">
                    <button onclick="event.stopPropagation(); invseePlayer('${safeName}')" class="bg-blue-950/80 hover:bg-blue-900 border border-blue-600/50 text-blue-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1 whitespace-nowrap" title="Inspeksi Inventori">
                      <i class="fa-solid fa-box-open text-[10px]"></i> Invsee
                    </button>
                    <button onclick="event.stopPropagation(); openEditPlayerModal('${safeName}')" class="bg-purple-950/80 hover:bg-purple-900 border border-purple-600/50 text-purple-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1 whitespace-nowrap" title="Edit Rank & Balance">
                      <i class="fa-solid fa-user-gear text-[10px]"></i> Edit
                    </button>
                    <button onclick="event.stopPropagation(); kickPlayer('${safeName}')" class="bg-amber-950/80 hover:bg-amber-900 border border-amber-600/50 text-amber-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1 whitespace-nowrap">
                      <i class="fa-solid fa-user-minus text-[10px]"></i> Kick
                    </button>
                    <button onclick="event.stopPropagation(); banPlayer('${safeName}')" class="bg-rose-950/80 hover:bg-rose-900 border border-rose-600/50 text-rose-300 px-2 py-1 rounded text-[11px] transition flex items-center gap-1 whitespace-nowrap">
                      <i class="fa-solid fa-gavel text-[10px]"></i> Ban
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('');
        }
      } else {
        if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-zinc-500 font-mono">Belum ada player yang sedang online di server.</td></tr>`;
      }
    } else {
      if (dot) dot.className = "w-3 h-3 rounded-full bg-rose-500";
      if (headerDot) headerDot.className = "w-2 h-2 rounded-full bg-rose-500";
      if (countText) countText.innerText = "Server Offline (OFF)";
      if (badgeCount) badgeCount.innerText = "0";
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-rose-400 font-mono">Server Minecraft sedang offline. Tekan tombol ON untuk menyalakan server.</td></tr>`;
    }
  } catch (err) {
    if (dot) dot.className = "w-3 h-3 rounded-full bg-amber-500";
    if (headerDot) headerDot.className = "w-2 h-2 rounded-full bg-amber-500";
    if (countText) countText.innerText = "Gagal memuat data server";
    if (badgeCount) badgeCount.innerText = "!";
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="6" class="text-center p-8 text-amber-500 font-mono">Gagal mengambil data dari API server Minecraft.</td></tr>`;
  }
}

async function fetchOrders() {
  const container = document.getElementById('order-list');
  const icon = document.getElementById('refresh-icon');
  if (icon) icon.classList.add('fa-spin');

  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_admin_orders`, {
      headers: {
        'X-Admin-Token': adminToken
      }
    });
    const json = await res.json();

    if (Array.isArray(json)) {
      ordersData = json.reverse();
      renderOrders();
    } else if (json && json.result === 'success') {
      ordersData = (json.data || []).reverse();
      renderOrders();
    } else {
      if (container && ordersData.length === 0) {
        container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-400 font-mono">Gagal membaca data dari Proxy (${json?.message || 'Error'}).</td></tr>`;
      }
    }
  } catch (err) {
    console.error(err);
    if (container && ordersData.length === 0) {
      container.innerHTML = `<tr><td colspan="7" class="text-center p-6 text-rose-500 font-mono">Kesalahan koneksi Proxy Gateway endpoint.</td></tr>`;
    }
  } finally {
    if (icon) icon.classList.remove('fa-spin');
  }
}

function handleFilterChange() {
  renderOrders();
}

function resetOrderFilters() {
  const searchInput = document.getElementById('orderSearchInput');
  const startDate = document.getElementById('startDateInput');
  const endDate = document.getElementById('endDateInput');
  const dateSort = document.getElementById('dateSortSelect');

  if (searchInput) searchInput.value = '';
  if (startDate) startDate.value = '';
  if (endDate) endDate.value = '';
  if (dateSort) dateSort.value = 'newest';

  renderOrders();
}

function parseOrderDate(dateStr) {
  if (!dateStr) return 0;
  const parts = String(dateStr).split(',');
  if (parts.length >= 1) {
    const dParts = parts[0].trim().split('/');
    if (dParts.length === 3) {
      const day = parseInt(dParts[0], 10);
      const month = parseInt(dParts[1], 10) - 1;
      const year = parseInt(dParts[2], 10);

      let hour = 0, min = 0, sec = 0;
      if (parts[1]) {
        const tParts = parts[1].trim().split('.');
        if (tParts.length === 3) {
          hour = parseInt(tParts[0], 10);
          min = parseInt(tParts[1], 10);
          sec = parseInt(tParts[2], 10);
        }
      }
      return new Date(year, month, day, hour, min, sec).getTime();
    }
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? 0 : parsed;
}

function filterStatus(status) {
  currentFilter = status;
  ['ALL', 'PENDING', 'APPROVED', 'REJECTED'].forEach(st => {
    const btn = document.getElementById(`tab-${st}`);
    if (btn) {
      if (st === status) {
        btn.className = "px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium transition shrink-0";
      } else {
        btn.className = "px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition shrink-0";
      }
    }
  });
  renderOrders();
}

function renderOrders() {
  const container = document.getElementById('order-list');
  document.getElementById('stat-total').innerText = ordersData.length;
  document.getElementById('stat-pending').innerText = ordersData.filter(o => o.status === 'PENDING').length;
  document.getElementById('stat-approved').innerText = ordersData.filter(o => o.status === 'APPROVED').length;

  const searchQuery = (document.getElementById('orderSearchInput')?.value || '').toLowerCase().trim();
  const startDateVal = document.getElementById('startDateInput')?.value;
  const endDateVal = document.getElementById('endDateInput')?.value;
  const dateSortVal = document.getElementById('dateSortSelect')?.value || 'newest';

  const startTime = startDateVal ? new Date(startDateVal + 'T00:00:00').getTime() : null;
  const endTime = endDateVal ? new Date(endDateVal + 'T23:59:59').getTime() : null;

  let filtered = ordersData.filter(o => {
    if (currentFilter !== 'ALL' && o.status !== currentFilter) return false;

    if (searchQuery) {
      const matchId = String(o.id || '').toLowerCase().includes(searchQuery);
      const matchUser = String(o.username || '').toLowerCase().includes(searchQuery);
      const matchItem = String(o.itemName || '').toLowerCase().includes(searchQuery);
      const matchCat = String(o.category || '').toLowerCase().includes(searchQuery);
      if (!matchId && !matchUser && !matchItem && !matchCat) return false;
    }

    if (startTime || endTime) {
      const ordTime = parseOrderDate(o.timestamp);
      if (startTime && ordTime < startTime) return false;
      if (endTime && ordTime > endTime) return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const timeA = parseOrderDate(a.timestamp);
    const timeB = parseOrderDate(b.timestamp);
    return dateSortVal === 'oldest' ? timeA - timeB : timeB - timeA;
  });

  document.getElementById('row-count').innerText = `${filtered.length} record(s)`;

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="7" class="text-center p-8 text-zinc-500 font-mono">Tidak ada pesanan yang sesuai filter.</td></tr>`;
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

  const targetIndex = ordersData.findIndex(o => String(o.id) === String(id));
  const oldStatus = targetIndex !== -1 ? ordersData[targetIndex].status : null;

  if (targetIndex !== -1) {
    ordersData[targetIndex].status = newStatus;
    renderOrders();
  }

  try {
    const adminToken = getAdminToken();
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

  if (modalImg) modalImg.classList.add('hidden');
  if (modalIframe) modalIframe.classList.add('hidden');
  if (modalLoading) modalLoading.classList.remove('hidden');
  if (modalImgLink) modalImgLink.href = rawUrl;

  const modal = document.getElementById('imageModal');
  if (modal) modal.classList.remove('hidden');

  const fileId = extractGDriveFileId(rawUrl);

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

// ==========================================
// ETC TAB: WEBCHAT LOGS
// ==========================================
let allWebChatLogs = [];

async function fetchWebChatLogs() {
  const tableBody = document.getElementById('webchat-table-list');
  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_webchat_logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      }
    });

    const json = await res.json().catch(() => null);
    if (res.ok && json && json.result === 'success' && Array.isArray(json.logs)) {
      allWebChatLogs = json.logs;
      renderWebChatLogs(allWebChatLogs);
    } else {
      if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-zinc-500">Belum ada histori WebChat tersimpan.</td></tr>`;
    }
  } catch (err) {
    console.error("Gagal mengambil WebChat logs:", err);
    if (tableBody) tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-rose-400">Kesalahan koneksi saat mengambil data WebChat.</td></tr>`;
  }
}

function renderWebChatLogs(logs) {
  const tableBody = document.getElementById('webchat-table-list');
  if (!tableBody) return;

  if (!Array.isArray(logs) || logs.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-zinc-500">Tidak ada pesan WebChat yang cocok.</td></tr>`;
    return;
  }

  tableBody.innerHTML = logs.map(item => {
    const timeStr = item.timestamp ? new Date(item.timestamp).toLocaleString('id-ID') : '-';
    const safeUser = escapeHTML(item.username || 'Guest');
    const safeEmail = escapeHTML(item.email || '-');
    const safeMsg = escapeHTML(item.message || '');

    return `
      <tr class="hover:bg-zinc-800/40 transition">
        <td class="p-3 text-zinc-500 text-[11px] font-mono whitespace-nowrap">${timeStr}</td>
        <td class="p-3 font-semibold text-cyan-400 flex items-center gap-2">
          <img src="https://mc-heads.net/avatar/${encodeURIComponent(item.username || 'steve')}/20" alt="avatar" class="w-4 h-4 rounded">
          <span>${safeUser}</span>
        </td>
        <td class="p-3 text-zinc-400 text-xs font-mono">${safeEmail}</td>
        <td class="p-3 text-zinc-200 font-mono text-xs break-words">${safeMsg}</td>
      </tr>
    `;
  }).join('');
}

function filterWebChatLogs() {
  const query = (document.getElementById('webchatSearchInput')?.value || '').toLowerCase();
  if (!query) {
    renderWebChatLogs(allWebChatLogs);
    return;
  }

  const filtered = allWebChatLogs.filter(log =>
    (log.username || '').toLowerCase().includes(query) ||
    (log.email || '').toLowerCase().includes(query) ||
    (log.message || '').toLowerCase().includes(query)
  );

  renderWebChatLogs(filtered);
}

// ==========================================
// PLAYER TELEMETRY MODAL
// ==========================================
let currentDetailIpValue = '';

async function openPlayerDetailModal(username) {
  if (!username) return;

  const modal = document.getElementById('playerDetailModal');
  const userEl = document.getElementById('detailPlayerUsername');
  const headEl = document.getElementById('detailPlayerHead');
  const loadingEl = document.getElementById('detailLoading');
  const contentEl = document.getElementById('detailContent');

  if (userEl) userEl.innerText = username;
  if (headEl) headEl.src = `https://mc-heads.net/avatar/${encodeURIComponent(username)}/36`;

  if (modal) modal.classList.remove('hidden');
  if (loadingEl) loadingEl.classList.remove('hidden');
  if (contentEl) contentEl.classList.add('hidden');

  let geoData = {
    ip: 'Internal / Off-grid',
    isp: 'Minecraft Server Connection',
    country: 'Indonesia',
    countryCode: 'ID',
    region: '-',
    city: '-',
    timezone: 'Asia/Jakarta',
    lat: null,
    lon: null,
    group: 'Member',
    clan: '-',
    balance: '$0'
  };

  try {
    const adminToken = getAdminToken();
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_player_geo`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ username })
    });

    const json = await res.json().catch(() => null);

    if (res.ok && json && json.result === 'success') {
      const data = json.data || json;
      geoData = {
        ...geoData,
        ...data,
        ip: data.ip || data.query || geoData.ip,
        isp: data.isp || data.org || data.network || geoData.isp,
        region: data.regionName || data.region || geoData.region,
        city: data.city || geoData.city,
        country: data.country_name || data.countryName || data.country || geoData.country,
        countryCode: data.countryCode || data.country_code || geoData.countryCode,
        lat: data.lat !== undefined && data.lat !== null ? data.lat : (data.latitude !== undefined ? data.latitude : geoData.lat),
        lon: data.lon !== undefined && data.lon !== null ? data.lon : (data.longitude !== undefined ? data.longitude : geoData.lon),
        timezone: data.timezone || geoData.timezone,
        group: data.group || data.rank || data.role || geoData.group,
        clan: data.clan || data.guild || data.faction || data.tag || geoData.clan,
        balance: data.balance || data.money || data.eco || data.cash || data.saldo || geoData.balance
      };

      // Fallback: Jika koordinat tidak tersedia atau ISP unknown, fetch via HTTPS
      if (geoData.ip && !geoData.ip.includes('Internal') && !geoData.lat) {
        try {
          const extRes = await fetch(`https://ipwho.is/${geoData.ip}`);
          const extData = await extRes.json();
          if (extData && extData.success !== false) {
            geoData.isp = extData.connection?.isp || extData.org || geoData.isp;
            geoData.country = extData.country || geoData.country;
            geoData.countryCode = extData.country_code || geoData.countryCode;
            geoData.region = extData.region || geoData.region;
            geoData.city = extData.city || geoData.city;
            geoData.timezone = extData.timezone?.id || geoData.timezone;
            geoData.lat = extData.latitude;
            geoData.lon = extData.longitude;
          }
        } catch (e) {
          console.error("IP fallback failed", e);
        }
      }
    }
  } catch (err) {
    console.error("Player detail fetch error:", err);
  } finally {
    currentDetailIpValue = geoData.ip || 'Internal / Hidden';

    const ipEl = document.getElementById('detailIp');
    const ispEl = document.getElementById('detailIsp');
    const countryEl = document.getElementById('detailCountry');
    const regionEl = document.getElementById('detailRegion');
    const cityEl = document.getElementById('detailCity');
    const timezoneEl = document.getElementById('detailTimezone');
    const coordsEl = document.getElementById('detailCoords');
    const mapLinkEl = document.getElementById('detailMapLink');
    const rankEl = document.getElementById('detailRank');
    const clanEl = document.getElementById('detailClan');
    const balEl = document.getElementById('detailBalance');

    const ispLogoEl = document.getElementById('detailIspLogo');

    if (ipEl) ipEl.innerText = geoData.ip || '---';
    if (ispEl) ispEl.innerText = geoData.isp || '---';
    
    if (ispLogoEl && geoData.isp) {
      const ispLower = geoData.isp.toLowerCase();
      let domain = '';
      if (ispLower.includes('myrepublic')) domain = 'myrepublic.co.id';
      else if (ispLower.includes('telkom') || ispLower.includes('indihome') || ispLower.includes('astinet')) domain = 'telkom.co.id';
      else if (ispLower.includes('biznet')) domain = 'biznetnetworks.com';
      else if (ispLower.includes('first media') || ispLower.includes('firstmedia')) domain = 'firstmedia.com';
      else if (ispLower.includes('mnc') || ispLower.includes('play')) domain = 'mncplay.id';
      else if (ispLower.includes('xl') || ispLower.includes('axiata')) domain = 'xl.co.id';
      else if (ispLower.includes('indosat') || ispLower.includes('ooredoo')) domain = 'ioh.co.id';
      else if (ispLower.includes('tri ') || ispLower.includes('hutchison')) domain = 'tri.co.id';
      else if (ispLower.includes('smartfren')) domain = 'smartfren.com';
      else if (ispLower.includes('cbn')) domain = 'cbn.id';
      else if (ispLower.includes('oxygen')) domain = 'oxygen.id';
      else if (ispLower.includes('iconnet') || ispLower.includes('icon plus') || ispLower.includes('pln')) domain = 'iconnet.id';
      else if (ispLower.includes('balifiber') || ispLower.includes('bali fiber')) domain = 'balifiber.id';
      else if (ispLower.includes('moratelindo') || ispLower.includes('mora telematika')) domain = 'moratelindo.co.id';

      if (domain) {
        ispLogoEl.src = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
        ispLogoEl.classList.remove('hidden');
      } else {
        ispLogoEl.classList.add('hidden');
        ispLogoEl.src = '';
      }
    } else if (ispLogoEl) {
      ispLogoEl.classList.add('hidden');
      ispLogoEl.src = '';
    }

    if (countryEl) countryEl.innerText = geoData.countryCode ? `${geoData.country} (${geoData.countryCode})` : (geoData.country || '---');
    if (regionEl) regionEl.innerText = geoData.region || '---';
    if (cityEl) cityEl.innerText = geoData.city || '---';
    if (timezoneEl) timezoneEl.innerText = geoData.timezone || '---';

    if (geoData.lat !== null && geoData.lon !== null && geoData.lat !== undefined && geoData.lon !== undefined) {
      if (coordsEl) coordsEl.innerText = `${geoData.lat}, ${geoData.lon}`;
      if (mapLinkEl) {
        mapLinkEl.href = `https://maps.google.com/?q=${geoData.lat},${geoData.lon}`;
        mapLinkEl.classList.remove('hidden');
      }
    } else {
      if (coordsEl) coordsEl.innerText = 'Koordinat tidak tersedia';
      if (mapLinkEl) mapLinkEl.classList.add('hidden');
    }

    if (rankEl) rankEl.innerText = geoData.group || 'Member';
    if (clanEl) clanEl.innerText = geoData.clan ? `[${geoData.clan}]` : '-';
    if (balEl) balEl.innerText = geoData.balance || '$0';

    if (loadingEl) loadingEl.classList.add('hidden');
    if (contentEl) contentEl.classList.remove('hidden');
  }
}

function closePlayerDetailModal() {
  const modal = document.getElementById('playerDetailModal');
  if (modal) modal.classList.add('hidden');
}

function copyDetailIp() {
  if (!currentDetailIpValue) return;
  navigator.clipboard.writeText(currentDetailIpValue).then(() => {
    showToast(`IP ${currentDetailIpValue} tersalin ke clipboard!`, "success");
  }).catch(() => {
    showToast("Gagal menyalin IP", "warning");
  });
}

window.openPlayerDetailModal = openPlayerDetailModal;
window.closePlayerDetailModal = closePlayerDetailModal;
window.copyDetailIp = copyDetailIp;

window.addEventListener('languageChanged', () => {
  try { syncCurrentTab(); } catch (e) { }
});