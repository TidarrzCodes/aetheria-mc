const SERVER_DOMAIN = "aetheria.raditnex.my.id";
const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";

let currentHUDUsername = '';

document.addEventListener('DOMContentLoaded', () => {
  checkPlayerSession();
});

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

  const embers = Array.from({ length: 30 }, () => ({
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

// SANITASI INPUT XSS
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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
    fetchPlayerInventoryHUD(playerData.username);
  } catch (err) {
    localStorage.removeItem('aetheria_player_user');
    window.location.href = './login.html';
  }
}

// TAMPILKAN PROFILE CARD KETIKA SESI AKTIF
async function showDashboardProfile(playerData) {
  const staffContainer = document.getElementById('staffAccessContainer');
  const rankUpper = (playerData.rank || '').toUpperCase();
  const isStaff = ['OWNER', 'ADMIN', 'HELPER'].some(r => rankUpper.includes(r));

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

  document.getElementById('playerDisplayRank').innerHTML = renderRankBadge(currentRank);
  document.getElementById('rankBenefitList').innerHTML = renderRankBenefits(currentRank);
}

// LOGOUT PLAYER
function handlePlayerLogout() {
  localStorage.removeItem('aetheria_player_user');
  window.location.href = './login.html';
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

    // Jika server offline / 404, coba fallback dari localStorage
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
  try { checkPlayerSession(); } catch (e) { }
});