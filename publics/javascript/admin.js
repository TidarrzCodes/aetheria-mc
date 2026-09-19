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
  if (e.key === 'Escape') {
    closeImageModal();
    closeInvseeModal();
  }
});

function unlockDashboard() {
  const dash = document.getElementById('dashboardContent');
  if (dash) dash.classList.remove('hidden');

  // Load and render logged-in Staff Profile Badge
  renderStaffProfileBadge();

  syncCurrentTab();
  setInterval(syncCurrentTab, 8000); // Optimized 8-second refresh to save Cloudflare Worker quota
}

function renderStaffProfileBadge() {
  const badgeEl = document.getElementById('staffProfileBadge');
  const userEl = document.getElementById('staffUsername');
  const rankEl = document.getElementById('staffRankBadge');
  const avatarEl = document.getElementById('staffAvatarHead');

  if (!badgeEl) return;

  const savedUser = localStorage.getItem('aetheria_player_user') || sessionStorage.getItem('aetheria_admin_username') || 'Admin';
  const savedRank = sessionStorage.getItem('aetheria_admin_rank') || 'Staff';

  if (userEl) userEl.innerText = savedUser;
  if (rankEl) rankEl.innerText = savedRank.toUpperCase();
  if (avatarEl) avatarEl.src = `https://mc-heads.net/avatar/${encodeURIComponent(savedUser)}/24`;

  badgeEl.classList.remove('hidden');
  badgeEl.classList.add('flex');
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
  const viewEtc = document.getElementById('view-etc');
  const btnOrders = document.getElementById('main-tab-orders');
  const btnPlayers = document.getElementById('main-tab-players');
  const btnEtc = document.getElementById('main-tab-etc');

  if (viewOrders) viewOrders.classList.add('hidden');
  if (viewPlayers) viewPlayers.classList.add('hidden');
  if (viewEtc) viewEtc.classList.add('hidden');

  if (btnOrders) btnOrders.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition flex items-center gap-1.5 text-xs";
  if (btnPlayers) btnPlayers.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition flex items-center gap-1.5 text-xs";
  if (btnEtc) btnEtc.className = "px-2.5 sm:px-3 py-1.5 rounded-lg text-zinc-400 hover:text-white transition flex items-center gap-1.5 text-xs";

  if (tabName === 'orders') {
    if (viewOrders) viewOrders.classList.remove('hidden');
    if (btnOrders) btnOrders.className = "px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium transition flex items-center gap-1.5 text-xs";
    fetchOrders();
  } else if (tabName === 'players') {
    if (viewPlayers) viewPlayers.classList.remove('hidden');
    if (btnPlayers) btnPlayers.className = "px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium transition flex items-center gap-1.5 text-xs";
    fetchOnlinePlayers();
    fetchRealtimeConsoleLogs();
  } else if (tabName === 'etc') {
    if (viewEtc) viewEtc.classList.remove('hidden');
    if (btnEtc) btnEtc.className = "px-2.5 sm:px-3 py-1.5 rounded-lg bg-zinc-800 text-white font-medium transition flex items-center gap-1.5 text-xs";
    fetchWebChatLogs();
  }
}

function syncCurrentTab() {
  if (currentMainTab === 'orders') {
    fetchOrders();
  } else if (currentMainTab === 'players') {
    fetchOnlinePlayers();
    fetchRealtimeConsoleLogs();
  } else if (currentMainTab === 'etc') {
    fetchWebChatLogs();
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
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
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

function renderPlayerInventory(inventoryList) {
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

  // 2. Main Inventory Grid (Slots 9 to 35)
  const mainGrid = document.getElementById('mainInventoryGrid');
  if (mainGrid) {
    let mainHtml = '';
    for (let s = 9; s <= 35; s++) {
      const item = itemMap[s];
      mainHtml += renderSlotInnerHtml(s, item);
    }
    mainGrid.innerHTML = mainHtml;
  }

  // 3. Hotbar Grid (Slots 0 to 8)
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

const ITEM_ID_ALIASES = {
  // Food & Cooked items
  'cooked_beef': ['cooked_beef', 'beef_cooked'],
  'cooked_porkchop': ['cooked_porkchop', 'porkchop_cooked'],
  'cooked_chicken': ['cooked_chicken', 'chicken_cooked'],
  'cooked_mutton': ['cooked_mutton', 'mutton_cooked'],
  'cooked_cod': ['cooked_cod', 'fish_cooked', 'raw_fish'],
  'cooked_salmon': ['cooked_salmon', 'salmon_cooked'],
  'porkchop': ['porkchop', 'porkchop_raw'],
  'beef': ['beef', 'beef_raw'],
  'chicken': ['chicken', 'chicken_raw'],

  // Books & Potions & Special items
  'enchanted_book': ['enchanted_book', 'book_enchanted'],
  'written_book': ['written_book', 'book_written'],
  'writable_book': ['writable_book', 'book_writable'],
  'glass_bottle': ['glass_bottle', 'potion_bottle_empty'],
  'totem_of_undying': ['totem_of_undying', 'totem'],
  'experience_bottle': ['experience_bottle', 'bottle_o_enchanting'],

  // Gold tools & armor
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

  // Wooden tools
  'wooden_sword': ['wooden_sword', 'wood_sword'],
  'wooden_shovel': ['wooden_shovel', 'wood_shovel'],
  'wooden_pickaxe': ['wooden_pickaxe', 'wood_pickaxe'],
  'wooden_axe': ['wooden_axe', 'wood_axe'],
  'wooden_hoe': ['wooden_hoe', 'wood_hoe'],

  // Redstone & utility
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
    // Hide broken img & display text badge if all CDNs fail
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
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
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

let lastConsoleLogHash = '';

async function fetchRealtimeConsoleLogs() {
  const terminal = document.getElementById('consoleTerminalWindow');
  if (!terminal) return;

  try {
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
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

      // Clean ANSI color codes & Minecraft formatting symbols, filter out automatic background /list polling spam
      const cleanLogs = json.logs
        .filter(line => !line.toLowerCase().includes('issued server command: /list') && !line.toLowerCase().includes('there are') && !line.toLowerCase().includes('players online'))
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
    // Silent fail for background console log polling
  }
}

function appendConsoleOutput(command, output, isError = false) {
  const terminal = document.getElementById('consoleTerminalWindow');
  if (!terminal) return;

  const cmdLine = document.createElement('div');
  cmdLine.className = "text-white font-medium font-mono pt-1";
  cmdLine.innerText = `>> ${command}`;
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
  setTimeout(fetchRealtimeConsoleLogs, 1000);
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
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
    const [pteroRes, mcsrvRes, rconPlayersRes] = await Promise.all([
      fetch(`${WORKER_PROXY_URL}?action=get_server_status`).catch(() => null),
      fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`).catch(() => null),
      fetch(`${WORKER_PROXY_URL}?action=get_online_players`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken
        }
      }).catch(() => null)
    ]);

    const pteroData = pteroRes ? await pteroRes.json().catch(() => null) : null;
    const data = mcsrvRes ? await mcsrvRes.json().catch(() => null) : null;
    const rconData = rconPlayersRes ? await rconPlayersRes.json().catch(() => null) : null;

    const mcOnline = data ? !!data.online : false;
    const pteroState = (pteroData && pteroData.result === 'success') ? pteroData.state : null;
    const pteroOnline = (pteroData && pteroData.result === 'success') ? pteroData.online : false;

    // Server dinyatakan ONLINE jika SALAH SATU API mengonfirmasi online!
    const isOnline = mcOnline || pteroOnline || pteroState === 'running';

    if (isOnline) {
      dot.className = "w-3 h-3 rounded-full bg-emerald-500 animate-pulse";
      
      // Utamakan realtime RCON player list jika tersedia, fallback ke mcsrvstat
      let onlineList = [];
      let onlineCount = 0;
      let maxCount = 20;

      if (rconData && rconData.result === 'success') {
        onlineList = rconData.players || [];
        onlineCount = typeof rconData.online === 'number' ? rconData.online : onlineList.length;
        maxCount = rconData.max || 20;
      } else if (data && data.players) {
        onlineList = data.players.list || [];
        onlineCount = data.players.online || 0;
        maxCount = data.players.max || 20;
      }

      countText.innerText = `${onlineCount} / ${maxCount} Player Online (ONLINE)`;
      badgeCount.innerText = onlineCount;

      if (onlineList.length > 0) {
        tableBody.innerHTML = onlineList.map(p => {
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
    } else if (pteroState === 'starting') {
      dot.className = "w-3 h-3 rounded-full bg-amber-500 animate-pulse";
      countText.innerText = "Server Sedang Starting...";
      badgeCount.innerText = "0";
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-amber-400 font-mono"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Server Minecraft sedang dalam proses Startup...</td></tr>`;
    } else if (pteroState === 'stopping') {
      dot.className = "w-3 h-3 rounded-full bg-rose-400 animate-pulse";
      countText.innerText = "Server Sedang Stopping...";
      badgeCount.innerText = "0";
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-rose-400 font-mono"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Server Minecraft sedang mematikan sistem...</td></tr>`;
    } else {
      dot.className = "w-3 h-3 rounded-full bg-rose-500";
      countText.innerText = "Server Offline (OFF)";
      badgeCount.innerText = "0";
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-rose-400 font-mono">Server Minecraft sedang offline. Tekan tombol ON untuk menyalakan server.</td></tr>`;
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
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
    const res = await fetch(WORKER_PROXY_URL, {
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
  // Parse format "19/9/2026, 07.44.08" atau ISO date
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
    // Filter status tab
    if (currentFilter !== 'ALL' && o.status !== currentFilter) return false;

    // Filter Pencarian Teks (ID, Username, Item Name, Category)
    if (searchQuery) {
      const matchId = String(o.id || '').toLowerCase().includes(searchQuery);
      const matchUser = String(o.username || '').toLowerCase().includes(searchQuery);
      const matchItem = String(o.itemName || '').toLowerCase().includes(searchQuery);
      const matchCat = String(o.category || '').toLowerCase().includes(searchQuery);
      if (!matchId && !matchUser && !matchItem && !matchCat) return false;
    }

    // Filter Rentang Tanggal
    if (startTime || endTime) {
      const ordTime = parseOrderDate(o.timestamp);
      if (startTime && ordTime < startTime) return false;
      if (endTime && ordTime > endTime) return false;
    }

    return true;
  });

  // Urutkan Tanggal
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

// ==========================================
// ETC TAB: WEBCHAT LOGS & PODIUM LEADERBOARD
// ==========================================
let allWebChatLogs = [];
let currentPodiumCategory = 'kills';
let podiumDataStore = {
  kills: [
    { rank: 1, username: 'AytidarG_', stat: '154 Kills', title: 'Supreme Warlord' },
    { rank: 2, username: 'Darrzz', stat: '112 Kills', title: 'Shadow Blade' },
    { rank: 3, username: 'Radit_Dev', stat: '87 Kills', title: 'Dragon Slayer' },
    { rank: 4, username: 'Vortex_Hunter', stat: '64 Kills', title: 'Vanguard' },
    { rank: 5, username: 'EnderKnight99', stat: '51 Kills', title: 'Berserker' },
    { rank: 6, username: 'Nico_Blade', stat: '43 Kills', title: 'Gladiator' },
    { rank: 7, username: 'SlayerZero', stat: '38 Kills', title: 'Assassin' },
    { rank: 8, username: 'Phantom_X', stat: '29 Kills', title: 'Executioner' }
  ],
  playtime: [
    { rank: 1, username: 'Darrzz', stat: '342 Jam', title: 'Veteran Realm' },
    { rank: 2, username: 'AytidarG_', stat: '285 Jam', title: 'Sentinel Guard' },
    { rank: 3, username: 'Radit_Dev', stat: '210 Jam', title: 'Ancient Wanderer' },
    { rank: 4, username: 'CraftMaster_ID', stat: '176 Jam', title: 'Guild Keeper' },
    { rank: 5, username: 'DragonRider', stat: '145 Jam', title: 'Dragon Tamer' },
    { rank: 6, username: 'Shadow_Walker', stat: '128 Jam', title: 'Explorer' },
    { rank: 7, username: 'MinerFortyNine', stat: '98 Jam', title: 'Deep Miner' },
    { rank: 8, username: 'Aether_Hero', stat: '74 Jam', title: 'Adventurer' }
  ],
  donators: [
    { rank: 1, username: 'Darrzz', stat: 'Rp 450.000', title: 'Sultan Realm' },
    { rank: 2, username: 'AytidarG_', stat: 'Rp 325.000', title: 'Royal Patron' },
    { rank: 3, username: 'Radit_Dev', stat: 'Rp 200.000', title: 'Crown Sponsor' },
    { rank: 4, username: 'EnderKnight99', stat: 'Rp 150.000', title: 'Mythic Supporter' },
    { rank: 5, username: 'Vortex_Hunter', stat: 'Rp 100.000', title: 'Dragon Benefactor' },
    { rank: 6, username: 'SlayerZero', stat: 'Rp 75.000', title: 'Guild Founder' },
    { rank: 7, username: 'Nico_Blade', stat: 'Rp 50.000', title: 'Honorary Knight' },
    { rank: 8, username: 'Phantom_X', stat: 'Rp 25.000', title: 'VIP Supporter' }
  ],
  baltop: [
    { rank: 1, username: 'Darrzz', stat: '5.450.000 Coins', title: 'Sultan Ekonomi' },
    { rank: 2, username: 'AytidarG_', stat: '3.820.000 Coins', title: 'Banker Realm' },
    { rank: 3, username: 'Radit_Dev', stat: '2.150.000 Coins', title: 'Merchant King' },
    { rank: 4, username: 'EnderKnight99', stat: '1.400.000 Coins', title: 'Rich Tycoon' },
    { rank: 5, username: 'Vortex_Hunter', stat: '950.000 Coins', title: 'Gold Hoarder' },
    { rank: 6, username: 'SlayerZero', stat: '620.000 Coins', title: 'Coin Collector' },
    { rank: 7, username: 'Nico_Blade', stat: '450.000 Coins', title: 'Trader' },
    { rank: 8, username: 'Phantom_X', stat: '300.000 Coins', title: 'Saver' }
  ]
};

async function fetchWebChatLogs() {
  const tableBody = document.getElementById('webchat-table-list');
  try {
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
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

async function fetchPodiumLeaderboard() {
  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_leaderboard`);
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.result === 'success' && json.leaderboard) {
      podiumDataStore = json.leaderboard;
    }
  } catch (err) {
    console.error("Gagal mengambil leaderboard backend:", err);
  }
  populatePodiumForm(currentPodiumCategory);
}

function switchPodiumCategory(category) {
  currentPodiumCategory = category;
  ['kills', 'playtime', 'donators', 'baltop'].forEach(cat => {
    const btn = document.getElementById(`podium-cat-${cat}`);
    if (btn) {
      if (cat === category) {
        btn.className = cat === 'kills' ? "px-3 py-1.5 rounded-md bg-rose-600 text-white font-semibold transition shrink-0" :
                        cat === 'playtime' ? "px-3 py-1.5 rounded-md bg-indigo-600 text-white font-semibold transition shrink-0" :
                        cat === 'donators' ? "px-3 py-1.5 rounded-md bg-purple-600 text-white font-semibold transition shrink-0" :
                        "px-3 py-1.5 rounded-md bg-amber-600 text-white font-semibold transition shrink-0";
      } else {
        btn.className = "px-3 py-1.5 rounded-md text-zinc-400 hover:text-white transition shrink-0";
      }
    }
  });

  populatePodiumForm(category);
}

function populatePodiumForm(category) {
  const list = podiumDataStore[category] || [];
  for (let r = 1; r <= 8; r++) {
    const item = list.find(x => Number(x.rank) === r) || { username: '', title: '', stat: '' };
    const elUser = document.getElementById(`podium-r${r}-username`);
    const elTitle = document.getElementById(`podium-r${r}-title`);
    const elStat = document.getElementById(`podium-r${r}-stat`);

    if (elUser) elUser.value = item.username || '';
    if (elTitle) elTitle.value = item.title || '';
    if (elStat) elStat.value = item.stat || '';
  }
}

async function savePodiumData(e) {
  e.preventDefault();
  const btn = document.getElementById('btnSavePodium');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Menyimpan...`;
  }

  const newCategoryData = [];
  for (let r = 1; r <= 8; r++) {
    const username = document.getElementById(`podium-r${r}-username`)?.value.trim() || '';
    const title = document.getElementById(`podium-r${r}-title`)?.value.trim() || '';
    const stat = document.getElementById(`podium-r${r}-stat`)?.value.trim() || '';
    newCategoryData.push({ rank: r, username, title, stat });
  }

  podiumDataStore[currentPodiumCategory] = newCategoryData;

  try {
    const adminToken = getCookie('aetheria_admin_token') || sessionStorage.getItem('aetheria_admin_auth') || '';
    const res = await fetch(`${WORKER_PROXY_URL}?action=update_leaderboard`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': adminToken
      },
      body: JSON.stringify({ leaderboard: podiumDataStore })
    });

    const json = await res.json().catch(() => null);
    if (res.ok && json && json.result === 'success') {
      showToast(`Podium leaderboard (${currentPodiumCategory.toUpperCase()}) berhasil diperbarui & disimpan!`, "success");
    } else {
      showToast("Gagal menyimpan podium: " + (json?.message || "Error server"), "error");
    }
  } catch (err) {
    console.error(err);
    showToast("Kesalahan koneksi saat menyimpan podium leaderboard.", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Simpan & Update Podium`;
    }
  }
}