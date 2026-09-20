// UNIFIED CLOUDFLARE WORKER PROXY ENDPOINT
const WORKER_PROXY_URL = "https://aetheria-checkout.raditnur216531.workers.dev/";
const SERVER_DOMAIN = "aetheria.raditnex.my.id";

let signaturePad;
let selectedItem = { name: '', price: '', category: '' };

// CUSTOM HUD TOAST NOTIFICATION SYSTEM
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');

  const bgColors = {
    success: 'bg-slate-900/95 border-emerald-500/60 text-emerald-300',
    error: 'bg-slate-900/95 border-rose-500/60 text-rose-300',
    info: 'bg-slate-900/95 border-purple-500/60 text-purple-300'
  };

  const icons = {
    success: '<i class="fa-solid fa-circle-check text-emerald-400 text-sm"></i>',
    error: '<i class="fa-solid fa-triangle-exclamation text-rose-400 text-sm"></i>',
    info: '<i class="fa-solid fa-circle-info text-purple-400 text-sm"></i>'
  };

  toast.className = `pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-md shadow-xl text-xs font-mono-code transition duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
  toast.innerHTML = `${icons[type] || icons.info} <span>${message}</span>`;

  container.appendChild(toast);

  playUiSound(type === 'error' ? 300 : 750, 'sine', 0.1);

  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('translate-y-2', 'opacity-0');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// WEB AUDIO SYNTHESIZER
function playUiSound(freq = 440, type = 'sine', duration = 0.08) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) { }
}

// LIGHTWEIGHT & FAST EMBERS PARTICLE ENGINE (OPTIMIZED FPS & CPU)
(function initEmbers() {
  const canvas = document.getElementById('emberCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  let mouse = { x: width / 2, y: height / 2 };
  let isTabActive = true;
  let lastTime = 0;
  const fpsInterval = 1000 / 30; // Cap at 30 FPS for super light performance

  const isMobile = window.innerWidth < 768;
  const particleCount = isMobile ? 22 : 35; // Fewer particles = zero lag

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  }, { passive: true });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }, 200);
  });

  document.addEventListener('visibilitychange', () => {
    isTabActive = document.visibilityState === 'visible';
    if (isTabActive) requestAnimationFrame(draw);
  });

  const embers = Array.from({ length: particleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 2.2 + 0.6,
    dx: (Math.random() - 0.5) * 0.5,
    dy: -Math.random() * 1.2 - 0.3,
    alpha: Math.random() * 0.75 + 0.25
  }));

  function draw(currentTime) {
    if (!isTabActive) return;

    requestAnimationFrame(draw);

    const elapsed = currentTime - lastTime;
    if (elapsed < fpsInterval) return;
    lastTime = currentTime - (elapsed % fpsInterval);

    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < embers.length; i++) {
      const e = embers[i];
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${e.alpha})`;
      ctx.fill();

      e.x += e.dx + (mouse.x - width / 2) * 0.00003;
      e.y += e.dy;

      if (e.y < 0) {
        e.y = height + 10;
        e.x = Math.random() * width;
      }
    }
  }

  requestAnimationFrame(draw);
})();

// LIGHTBOX FUNCTIONS
function openLightbox(url, caption) {
  document.getElementById('lightboxImg').src = url;
  document.getElementById('lightboxCaption').innerText = caption;
  document.getElementById('lightboxModal').classList.remove('hidden');
}

function closeLightbox() {
  playUiSound(300, 'sine');
  document.getElementById('lightboxModal').classList.add('hidden');
}

// FORMATTER BADGE RANK MINECRAFT IN-GAME
function renderHeroRankBadge(rankName) {
  const rank = (rankName || 'MEMBER').toUpperCase();

  if (rank.includes('DRAGONIAN') || rank.includes('OWNER') || rank.includes('ADMIN')) {
    return `<span class="bg-gradient-to-r from-amber-500/20 to-rose-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded text-[9px] font-mono-code font-extrabold tracking-wide">DRAGONIAN</span>`;
  }
  if (rank.includes('MVP')) {
    return `<span class="bg-rose-500/20 text-rose-300 border border-rose-500/40 px-1.5 py-0.5 rounded text-[9px] font-mono-code font-bold">MVP</span>`;
  }
  if (rank.includes('VIP')) {
    return `<span class="bg-amber-400/20 text-amber-300 border border-amber-400/40 px-1.5 py-0.5 rounded text-[9px] font-mono-code font-bold">VIP</span>`;
  }
  return `<span class="bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 rounded text-[9px] font-mono-code font-semibold">MEMBER</span>`;
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

let isFetchingPlayers = false;

// FETCH LIVE ONLINE PLAYERS WITH TAB LIST BADGES
async function fetchOnlinePlayers() {
  if (isFetchingPlayers) return;
  isFetchingPlayers = true;

  const dot = document.getElementById('server-status-dot');
  const countText = document.getElementById('player-count-text');
  const container = document.getElementById('player-list-container');

  try {
    let isOnline = false;
    let onlineCount = 0;
    let maxCount = 20;
    let playerList = [];

    // Priority 1: Check Pterodactyl power status & online players via Worker Proxy Gateway
    try {
      const [statusRes, playersRes] = await Promise.all([
        fetch(`${WORKER_PROXY_URL}?action=get_server_status`).catch(() => null),
        fetch(`${WORKER_PROXY_URL}?action=get_online_players`, { method: "POST" }).catch(() => null)
      ]);

      let statusData = statusRes && statusRes.ok ? await statusRes.json().catch(() => null) : null;
      let playersData = playersRes && playersRes.ok ? await playersRes.json().catch(() => null) : null;

      if (statusData && statusData.result === "success") {
        isOnline = !!statusData.online && statusData.state === "running";
      }

      if (!isOnline && playersData && playersData.result === "success" && playersData.online > 0) {
        isOnline = true;
      }
    } catch (e) {
      console.warn("Worker fetch status/players failed:", e);
    }

    // Priority 2: Fallback to mcsrvstat API if Worker did not respond as online
    if (!isOnline) {
      try {
        const response = await fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`);
        const data = await response.json();

        if (data && data.online) {
          isOnline = true;
          onlineCount = data.players ? data.players.online : 0;
          maxCount = data.players ? data.players.max : 20;
          playerList = (data.players && data.players.list) ? data.players.list : [];
        }
      } catch (e) {
        console.warn("mcsrvstat fetch failed:", e);
      }
    }

    if (isOnline) {
      if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
      if (countText) countText.innerText = `${onlineCount} / ${maxCount} Warriors Online`;

      if (container) {
        if (playerList.length > 0) {
          container.innerHTML = playerList.map(player => {
            const playerName = typeof player === 'object' ? player.name : player;
            const playerRank = typeof player === 'object' && player.group ? player.group : 'Member';
            const safeName = escapeHTML(playerName);

            return `
              <div class="flex items-center gap-2 bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 px-3 py-1.5 rounded-xl transition shadow-md">
                <img src="https://mc-heads.net/avatar/${safeName}/24" alt="${safeName}" class="w-5 h-5 rounded">
                <span class="text-[11px] font-mono-code text-slate-200 font-semibold">${safeName}</span>
                ${renderHeroRankBadge(playerRank)}
              </div>
            `;
          }).join('');
        } else {
          container.innerHTML = `
            <div class="text-[11px] sm:text-xs text-slate-400 font-mono-code flex items-center gap-2 py-1">
              <i class="fa-solid fa-shield-halved text-slate-500"></i> Belum ada player/ksatria yang online saat ini.
            </div>
          `;
        }
      }
    } else {
      if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
      if (countText) countText.innerText = "Server Offline";
      if (container) container.innerHTML = `<span class="text-xs text-red-400 font-mono-code">Server sedang offline / Maintenance.</span>`;
    }
  } catch (err) {
    console.error("Gagal mengambil status server:", err);
    if (dot) dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
    if (countText) countText.innerText = "Status Tidak Tersedia";
    if (container) container.innerHTML = `<span class="text-xs text-amber-400 font-mono-code">Gagal memuat list player online.</span>`;
  } finally {
    isFetchingPlayers = false;
  }
}

function switchTab(type) {
  playUiSound(600, 'square');
  const tabRank = document.getElementById('tab-rank');
  const tabMoney = document.getElementById('tab-money');
  const ranks = document.querySelectorAll('.item-rank');
  const moneys = document.querySelectorAll('.item-money');

  if (type === 'rank') {
    tabRank.className = "flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg bg-rose-600 text-white shadow-lg shadow-rose-900/40 transition";
    tabMoney.className = "flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg text-slate-400 hover:text-white transition";
    ranks.forEach(el => {
      el.classList.remove('hidden');
      el.classList.add('flex');
    });
    moneys.forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('flex');
    });
  } else {
    tabMoney.className = "flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 transition";
    tabRank.className = "flex-1 sm:flex-none px-4 sm:px-5 py-2.5 rounded-lg text-slate-400 hover:text-white transition";
    moneys.forEach(el => {
      el.classList.remove('hidden');
      el.classList.add('flex');
    });
    ranks.forEach(el => {
      el.classList.add('hidden');
      el.classList.remove('flex');
    });
  }
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

function checkAuthNavState() {
  const btn = document.getElementById('navAuthBtn');
  const btnText = document.getElementById('navAuthBtnText');
  if (!btn || !btnText) return;

  const adminCookie = getCookie('aetheria_admin_token');
  const sessionAuth = sessionStorage.getItem('aetheria_admin_auth');
  const playerUser = localStorage.getItem('aetheria_player_user');

  if (adminCookie || sessionAuth === 'true') {
    btn.href = './admin.html';
    btnText.innerText = 'Dashboard Staff';
  } else if (playerUser) {
    btn.href = './players.html';
    btnText.innerText = 'Dashboard Player';
  } else {
    btn.href = './login.html';
    btnText.innerText = 'Login';
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try { checkAuthNavState(); } catch (e) { console.error(e); }
  try { checkWebChatIdentity(); } catch (e) { console.error(e); }

  try {
    const canvas = document.getElementById('signaturePad');
    if (canvas && typeof SignaturePad !== 'undefined') {
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      if (canvas.getContext) canvas.getContext("2d").scale(ratio, ratio);
      signaturePad = new SignaturePad(canvas, { penColor: "rgb(244, 63, 94)" });
    }
  } catch (e) { console.error(e); }

  try {
    fetchOnlinePlayers();
    setInterval(fetchOnlinePlayers, 30000);
  } catch (e) { console.error(e); }

  try {
    initLeaderboard();
    syncDonatorsFromWorker();
  } catch (e) { console.error(e); }
});

function openModal(name, price, category) {
  selectedItem = { name, price, category };
  document.getElementById('modal-item-name').innerText = name;
  document.getElementById('modal-item-price').innerText = price;
  document.getElementById('checkoutModal').classList.remove('hidden');

  setTimeout(() => {
    const canvas = document.getElementById('signaturePad');
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
    if (signaturePad) signaturePad.clear();
  }, 50);
}

function closeModal() {
  playUiSound(300, 'sine');
  document.getElementById('checkoutModal').classList.add('hidden');
  document.getElementById('orderForm').reset();
  clearSignature();
}

function clearSignature() {
  if (signaturePad) signaturePad.clear();
}

function copyGopay(num) {
  navigator.clipboard.writeText(num);
  showToast(`Nomor GoPay tersalin: ${num}`, 'success');
}

function copyIP(ip) {
  navigator.clipboard.writeText(ip);
  showToast(`IP Server tersalin: ${ip}`, 'success');
}

// SUBMIT FORM KE CLOUDFLARE WORKER PROXY GATEWAY
async function handleFormSubmit(e) {
  e.preventDefault();

  if (signaturePad.isEmpty()) {
    showToast('Tanda tangan digital wajib diisi!', 'error');
    return;
  }

  const username = document.getElementById('usernameInput').value;
  const proofFile = document.getElementById('proofInput').files[0];
  const submitBtn = document.getElementById('submitBtn');

  submitBtn.disabled = true;
  submitBtn.innerText = "Mengirim Bukti...";

  try {
    const signatureBase64 = signaturePad.toDataURL();
    const signatureBlob = await (await fetch(signatureBase64)).blob();

    const formData = new FormData();
    const payloadJSON = {
      content: "📦 **ADA PESANAN AETHERIA WEBSTORE BARU (GOPAY)**",
      embeds: [{
        title: "AETHERIA: DRAGON'S ECLIPSE - DETAIL PESANAN",
        color: selectedItem.category === 'Rank' ? 15998046 : 4325229,
        fields: [
          { name: "Username", value: `\`${username}\``, inline: true },
          { name: "Kategori", value: selectedItem.category, inline: true },
          { name: "Item", value: selectedItem.name, inline: true },
          { name: "Harga", value: selectedItem.price, inline: true }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    formData.append("payload_json", JSON.stringify(payloadJSON));
    formData.append("file1", proofFile, `bukti_${username}.png`);
    formData.append("file2", signatureBlob, `ttd_${username}.png`);

    const response = await fetch(`${WORKER_PROXY_URL}?action=submit_checkout`, {
      method: "POST",
      body: formData
    });

    const resData = await response.json().catch(() => ({}));

    if (response.ok && resData.result === "success") {
      showToast('Bukti pembayaran terkirim ke Discord & tercatat di Admin Sheet!', 'success');
      closeModal();
    } else {
      const errorMessage = resData.message || 'Gagal mengirim bukti pembayaran.';
      showToast(errorMessage, 'error');
    }

  } catch (err) {
    console.error(err);
    showToast('Terjadi kesalahan jaringan saat memproses data.', 'error');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerText = "Kirim Bukti Pembayaran";
  }
}

// =========================================================================
// LIVE WEB CHAT TO IN-GAME MINECRAFT SERVER FUNCTIONS
// =========================================================================
function checkWebChatIdentity() {
  const authContainer = document.getElementById('webChatAuthContainer');
  const boxContainer = document.getElementById('webChatBoxContainer');
  const userEl = document.getElementById('activeChatUser');
  const emailEl = document.getElementById('activeChatEmail');

  if (!authContainer || !boxContainer) return;

  const savedIdentity = localStorage.getItem('aetheria_webchat_identity');
  if (savedIdentity) {
    try {
      const { username, email } = JSON.parse(savedIdentity);
      if (username && email) {
        if (userEl) userEl.innerText = username;
        if (emailEl) emailEl.innerText = `(${email})`;
        authContainer.classList.add('hidden');
        boxContainer.classList.remove('hidden');
        return;
      }
    } catch (e) {
      localStorage.removeItem('aetheria_webchat_identity');
    }
  }

  authContainer.classList.remove('hidden');
  boxContainer.classList.add('hidden');
}

function initWebChatUser(e) {
  e.preventDefault();
  const username = document.getElementById('webChatUsername').value.trim();
  const email = document.getElementById('webChatEmail').value.trim();

  if (!username || !email) return;

  localStorage.setItem('aetheria_webchat_identity', JSON.stringify({ username, email }));
  checkWebChatIdentity();
  showToast(`Identity tersimpan! Kamu siap live chat ke server sebagai ${username}.`, 'success');
}

function resetWebChatUser() {
  localStorage.removeItem('aetheria_webchat_identity');
  checkWebChatIdentity();
  showToast('Silakan masukkan nama user dan email kembali.', 'info');
}

async function handleSendWebChat(e) {
  e.preventDefault();

  const savedIdentity = localStorage.getItem('aetheria_webchat_identity');
  if (!savedIdentity) {
    resetWebChatUser();
    return;
  }

  let username = "", email = "";
  try {
    const parsed = JSON.parse(savedIdentity);
    username = parsed.username;
    email = parsed.email;
  } catch (err) {
    resetWebChatUser();
    return;
  }

  const msgInput = document.getElementById('webChatMessage');
  const btnSend = document.getElementById('btnSendWebChat');
  const message = msgInput.value.trim();

  if (!message) return;

  btnSend.disabled = true;
  btnSend.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i>`;

  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=send_chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, message })
    });

    const data = await res.json().catch(() => null);

    if (res.ok && data && data.result === 'success') {
      const chatLog = document.getElementById('webChatLog');
      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const msgDiv = document.createElement('div');
      msgDiv.className = "flex items-start gap-2 text-xs py-0.5 border-b border-slate-900/60";
      msgDiv.innerHTML = `
        <span class="text-slate-500 font-mono-code text-[10px] shrink-0">[${timeStr}]</span>
        <span class="text-cyan-400 font-bold shrink-0">[WebChat] ${escapeHTML(username)}:</span>
        <span class="text-slate-200 font-mono-code">${escapeHTML(message)}</span>
      `;

      chatLog.appendChild(msgDiv);
      chatLog.scrollTop = chatLog.scrollHeight;

      msgInput.value = '';
      showToast('Pesan terkirim & muncul di chat in-game Minecraft server!', 'success');
    } else {
      const errorMsg = (data && data.message) || `Response server (${res.status}): Gagal mengirim pesan ke server.`;
      showToast(errorMsg, 'error');
    }
  } catch (err) {
    console.error('WebChat Fetch Error:', err);
    showToast(`Kesalahan koneksi saat mengirim live chat: ${err.message || 'Network Error'}`, 'error');
  } finally {
    btnSend.disabled = false;
    btnSend.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim`;
  }
}

function toggleWebChatPopup() {
  const popup = document.getElementById('webChatPopup');
  if (!popup) return;
  const isHidden = popup.classList.contains('hidden') || popup.style.display === 'none';
  if (isHidden) {
    popup.classList.remove('hidden');
    popup.style.display = 'block';
    playUiSound(550, 'sine');
    checkWebChatIdentity();
  } else {
    popup.classList.add('hidden');
    popup.style.display = 'none';
    playUiSound(350, 'sine');
  }
}

window.toggleWebChatPopup = toggleWebChatPopup;

// =========================================================================
function formatPlaytimeString(rawStat) {
  if (!rawStat) return '0j 0h';
  const str = String(rawStat).trim();

  // If already in human format like "342 Jam" or "10d 5h"
  if (str.includes('Jam')) {
    const hours = parseInt(str.replace(/[^0-9]/g, ''), 10) || 0;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return days > 0 ? `${days}h ${remHours}j` : `${remHours}j`;
  }

  // Parse strings like "5d 2h 22m", "10d 4h", "20h 15m", "45m"
  const dayMatch = str.match(/(\d+)\s*d(?:ays?)?/i);
  const hourMatch = str.match(/(\d+)\s*h(?:ours?)?/i);
  const minMatch = str.match(/(\d+)\s*m(?:in(?:utes?)?)?/i);

  let days = dayMatch ? parseInt(dayMatch[1], 10) : 0;
  let hours = hourMatch ? parseInt(hourMatch[1], 10) : 0;
  let mins = minMatch ? parseInt(minMatch[1], 10) : 0;

  if (days === 0 && hours === 0 && mins === 0) {
    const pureNum = parseInt(str.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(pureNum) && pureNum > 0) {
      days = Math.floor(pureNum / 24);
      hours = pureNum % 24;
    }
  }

  const parts = [];
  if (days > 0) parts.push(`${days}h`);
  if (hours > 0 || days > 0) parts.push(`${hours}j`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);

  return parts.join(' ');
}

// 3D MINECRAFT SKIN LEADERBOARD SYSTEM (TOP KILLS, PLAYTIME, DONATORS)
// =========================================================================
const LEADERBOARD_DATA = {
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
    { rank: 1, username: 'Darrzz', stat: '14h 6j', title: 'Veteran Realm' },
    { rank: 2, username: 'AytidarG_', stat: '11h 21j', title: 'Sentinel Guard' },
    { rank: 3, username: 'Radit_Dev', stat: '8h 18j', title: 'Ancient Wanderer' },
    { rank: 4, username: 'CraftMaster_ID', stat: '7h 8j', title: 'Guild Keeper' },
    { rank: 5, username: 'DragonRider', stat: '6h 1j', title: 'Dragon Tamer' },
    { rank: 6, username: 'Shadow_Walker', stat: '5h 8j', title: 'Explorer' },
    { rank: 7, username: 'MinerFortyNine', stat: '4h 2j', title: 'Deep Miner' },
    { rank: 8, username: 'Aether_Hero', stat: '3h 2j', title: 'Adventurer' }
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

let currentLbCategory = 'kills';
const skinViewers = {};

function initLeaderboard() {
  fetchCustomLeaderboardData();
  renderLeaderboard('kills');

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (currentLbCategory) renderLeaderboard(currentLbCategory);
    }, 250);
  });
}

async function fetchCustomLeaderboardData() {
  try {
    const res = await fetch(`${WORKER_PROXY_URL}?action=get_leaderboard`);
    const json = await res.json().catch(() => null);
    if (res.ok && json && json.result === 'success' && json.data && typeof json.data === 'object') {
      ['kills', 'playtime', 'donators', 'baltop'].forEach(cat => {
        if (Array.isArray(json.data[cat]) && json.data[cat].length > 0) {
          if (cat === 'playtime') {
            LEADERBOARD_DATA[cat] = json.data[cat].map(item => ({
              ...item,
              stat: formatPlaytimeString(item.stat)
            }));
          } else {
            LEADERBOARD_DATA[cat] = json.data[cat];
          }
        }
      });
      renderLeaderboard(currentLbCategory);
    }
  } catch (e) {
    // Fallback to static leaderboard data
  }
}

function renderSkinViewer(canvasId, fallbackId, imgId, username) {
  const canvas = document.getElementById(canvasId);
  const fallback = document.getElementById(fallbackId);
  const img = document.getElementById(imgId);
  if (!canvas) return;

  const encodedUser = encodeURIComponent(username);
  const mcHeadsUrl = `https://mc-heads.net/skin/${encodedUser}`;
  const crafatarUrl = `https://crafatar.com/skins/${encodedUser}`;
  const elyByUrl = `https://ely.by/services/skins-buffer/skins/${encodedUser}.png`;
  const defaultSteveUrl = `https://mc-heads.net/skin/Steve`;
  const renderFallbackUrl = `https://mc-heads.net/body/${encodedUser}/right`;

  if (skinViewers[canvasId]) {
    try { skinViewers[canvasId].dispose(); } catch (e) {}
    skinViewers[canvasId] = null;
  }

  if (typeof skinview3d !== 'undefined' && skinview3d.SkinViewer) {
    try {
      if (fallback) fallback.classList.add('hidden');
      canvas.classList.remove('hidden');

      const width = canvas.parentElement ? canvas.parentElement.clientWidth : 200;
      const height = canvas.parentElement ? canvas.parentElement.clientHeight : 250;

      const viewer = new skinview3d.SkinViewer({
        canvas: canvas,
        width: width || 200,
        height: height || 250,
        skin: mcHeadsUrl
      });

      viewer.fov = 70;
      viewer.zoom = 0.85;
      viewer.autoRotate = true;
      viewer.autoRotateSpeed = 0.8;

      if (skinview3d.WalkingAnimation) {
        viewer.animation = new skinview3d.WalkingAnimation();
        viewer.animation.speed = 0.5;
      }

      // Fallback skin loader jika mc-heads melempar error (404/Steve default)
      viewer.playerObject.skin.image.onerror = () => {
        viewer.loadSkin(elyByUrl).catch(() => {
          viewer.loadSkin(crafatarUrl).catch(() => {
            viewer.loadSkin(defaultSteveUrl).catch(() => {});
          });
        });
      };

      skinViewers[canvasId] = viewer;
      return;
    } catch (err) {
      console.warn("skinview3d WebGL failed:", err);
    }
  }

  // Fallback if skinview3d / WebGL unavailable
  canvas.classList.add('hidden');
  if (fallback && img) {
    img.src = renderFallbackUrl;
    img.onerror = () => {
      img.src = `https://ely.by/services/skins-buffer/skins/${encodedUser}.png`;
      img.onerror = () => {
        img.src = `https://mc-heads.net/body/Steve/right`;
      };
    };
    fallback.classList.remove('hidden');
  }
}

function switchLeaderboardCategory(cat) {
  playUiSound(650, 'square');
  currentLbCategory = cat;

  ['kills', 'playtime', 'donators', 'baltop'].forEach(c => {
    const tabBtn = document.getElementById(`lb-tab-${c}`);
    if (tabBtn) {
      if (c === cat) {
        tabBtn.className = "flex-1 sm:flex-none px-3.5 py-2 rounded-lg bg-rose-600 text-white shadow-lg shadow-rose-900/40 transition flex items-center justify-center gap-2";
      } else {
        tabBtn.className = "flex-1 sm:flex-none px-3.5 py-2 rounded-lg text-slate-400 hover:text-white transition flex items-center justify-center gap-2";
      }
    }
  });

  renderLeaderboard(cat);
}

function renderLeaderboard(cat) {
  const data = LEADERBOARD_DATA[cat] || LEADERBOARD_DATA.kills;

  const tableTitle = document.getElementById('lb-table-stat-title');
  if (tableTitle) {
    if (cat === 'kills') tableTitle.innerText = "Total Kills";
    else if (cat === 'playtime') tableTitle.innerText = "Jam Bermain";
    else if (cat === 'donators') tableTitle.innerText = "Total Donasi";
    else if (cat === 'baltop') tableTitle.innerText = "Total Uang (Coins)";
  }

  const r1 = data[0] || { username: 'None', stat: '-', title: '-' };
  const r2 = data[1] || { username: 'None', stat: '-', title: '-' };
  const r3 = data[2] || { username: 'None', stat: '-', title: '-' };

  // Set Rank 1 (Gold)
  const elName1 = document.getElementById('nameRank1');
  const elStat1 = document.getElementById('statRank1');
  const elBadge1 = document.getElementById('badgeRank1');
  if (elName1) elName1.innerText = r1.username;
  if (elStat1) elStat1.innerText = r1.stat;
  if (elBadge1) elBadge1.innerText = r1.title || 'Champion';
  renderSkinViewer('skinCanvasRank1', 'fallbackRank1', 'imgRank1', r1.username);

  // Set Rank 2 (Silver)
  const elName2 = document.getElementById('nameRank2');
  const elStat2 = document.getElementById('statRank2');
  const elBadge2 = document.getElementById('badgeRank2');
  if (elName2) elName2.innerText = r2.username;
  if (elStat2) elStat2.innerText = r2.stat;
  if (elBadge2) elBadge2.innerText = r2.title || 'Silver Knight';
  renderSkinViewer('skinCanvasRank2', 'fallbackRank2', 'imgRank2', r2.username);

  // Set Rank 3 (Bronze)
  const elName3 = document.getElementById('nameRank3');
  const elStat3 = document.getElementById('statRank3');
  const elBadge3 = document.getElementById('badgeRank3');
  if (elName3) elName3.innerText = r3.username;
  if (elStat3) elStat3.innerText = r3.stat;
  if (elBadge3) elBadge3.innerText = r3.title || 'Bronze Knight';
  renderSkinViewer('skinCanvasRank3', 'fallbackRank3', 'imgRank3', r3.username);

  // Set Table (#4 - #10)
  const tableBody = document.getElementById('leaderboardListTable');
  if (tableBody) {
    const others = data.slice(3);
    if (others.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-slate-500 italic font-mono-code">Belum ada data ksatria lain.</td></tr>`;
    } else {
      tableBody.innerHTML = others.map(item => `
        <tr class="hover:bg-slate-900/60 transition font-mono-code">
          <td class="p-3 text-center font-bold text-slate-400">#${item.rank}</td>
          <td class="p-3">
            <div class="flex items-center gap-2.5">
              <img src="https://mc-heads.net/avatar/${escapeHTML(item.username)}/24" alt="${escapeHTML(item.username)}" class="w-6 h-6 rounded border border-slate-700">
              <span class="font-bold text-slate-200">${escapeHTML(item.username)}</span>
            </div>
          </td>
          <td class="p-3 text-slate-400 text-[11px]">${escapeHTML(item.title || 'Warrior')}</td>
          <td class="p-3 text-right font-bold ${cat === 'donators' ? 'text-emerald-400' : (cat === 'kills' ? 'text-rose-400' : 'text-amber-400')}">${escapeHTML(item.stat)}</td>
        </tr>
      `).join('');
    }
  }
}

async function syncDonatorsFromWorker() {
  try {
    const res = await fetch(WORKER_PROXY_URL);
    const json = await res.json();
    if (json && json.result === 'success' && Array.isArray(json.data)) {
      const totals = {};
      json.data.forEach(ord => {
        if (ord.status === 'APPROVED' && ord.username && ord.price) {
          const numPrice = Number(String(ord.price).replace(/[^0-9]/g, '')) || 0;
          if (numPrice > 0) {
            totals[ord.username] = (totals[ord.username] || 0) + numPrice;
          }
        }
      });

      const sorted = Object.entries(totals)
        .map(([user, amt]) => ({ username: user, amount: amt }))
        .sort((a, b) => b.amount - a.amount);

      if (sorted.length > 0) {
        LEADERBOARD_DATA.donators = sorted.map((item, index) => ({
          rank: index + 1,
          username: item.username,
          stat: 'Rp ' + item.amount.toLocaleString('id-ID'),
          title: index === 0 ? 'Sultan Realm' : (index === 1 ? 'Royal Patron' : (index === 2 ? 'Crown Sponsor' : 'Supporter'))
        }));
        if (currentLbCategory === 'donators') {
          renderLeaderboard('donators');
        }
      }
    }
  } catch (e) {
    console.warn("Could not sync donators from worker:", e);
  }
}

window.switchLeaderboardCategory = switchLeaderboardCategory;