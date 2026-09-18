const SERVER_DOMAIN = "aetheria.raditnex.my.id";

document.addEventListener('DOMContentLoaded', () => {
  checkPlayerSession();
  fetchOnlinePlayers();
  setInterval(fetchOnlinePlayers, 30000);
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
    showDashboardProfile(playerData);
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
    const res = await fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`);
    if (res.ok) {
      const data = await res.json();
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

// FETCH ONLINE PLAYERS TABLE
async function fetchOnlinePlayers() {
  const dot = document.getElementById('player-tab-dot');
  const countText = document.getElementById('player-tab-count');
  const tableBody = document.getElementById('player-table-list');

  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`);
    if (!response.ok) {
      throw new Error(`MCSrvStat API error: ${response.status}`);
    }
    const data = await response.json();

    if (data.online) {
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse";
      const online = data.players ? data.players.online : 0;
      const max = data.players ? data.players.max : 0;
      countText.innerText = `${online} / ${max} Ksatria Online In-Game`;

      if (data.players && data.players.list && data.players.list.length > 0) {
        tableBody.innerHTML = data.players.list.map(p => {
          const name = typeof p === 'object' ? p.name : p;
          const rank = typeof p === 'object' && p.group ? p.group : 'Member';
          return `
            <tr class="hover:bg-slate-900/60 transition">
              <td class="p-3 w-12">
                <img src="https://mc-heads.net/avatar/${escapeHTML(name)}/28" alt="${escapeHTML(name)}" class="w-7 h-7 rounded border border-slate-700">
              </td>
              <td class="p-3 font-semibold text-white">
                ${escapeHTML(name)}
              </td>
              <td class="p-3">
                ${renderRankBadge(rank)}
              </td>
              <td class="p-3 text-right">
                <span class="inline-flex items-center gap-1.5 text-emerald-400 text-xs">
                  <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Active
                </span>
              </td>
            </tr>
          `;
        }).join('');
      } else {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-slate-500">Belum ada ksatria yang online saat ini.</td></tr>`;
      }
    } else {
      dot.className = "w-2.5 h-2.5 rounded-full bg-rose-500";
      countText.innerText = "Server Offline / Maintenance";
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-rose-400">Server Minecraft sedang offline.</td></tr>`;
    }
  } catch (err) {
    dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
    countText.innerText = "Gagal memuat status server";
    tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-6 text-amber-500">Gagal mengambil data dari API server Minecraft.</td></tr>`;
  }
}