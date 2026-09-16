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

// EMBERS PARTICLE ENGINE
(function initEmbers() {
  const canvas = document.getElementById('emberCanvas');
  const ctx = canvas.getContext('2d');
  let width = canvas.width = window.innerWidth;
  let height = canvas.height = window.innerHeight;
  let mouse = { x: width / 2, y: height / 2 };

  window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const embers = Array.from({ length: 65 }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    r: Math.random() * 2.5 + 0.6,
    dx: (Math.random() - 0.5) * 0.7,
    dy: -Math.random() * 1.5 - 0.4,
    alpha: Math.random() * 0.85 + 0.15
  }));

  function draw() {
    ctx.clearRect(0, 0, width, height);
    embers.forEach(e => {
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(244, 63, 94, ${e.alpha})`;
      ctx.fill();

      e.x += e.dx + (mouse.x - width / 2) * 0.00005;
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

// FETCH LIVE ONLINE PLAYERS WITH TAB LIST BADGES
async function fetchOnlinePlayers() {
  const dot = document.getElementById('server-status-dot');
  const countText = document.getElementById('player-count-text');
  const container = document.getElementById('player-list-container');

  try {
    const response = await fetch(`https://api.mcsrvstat.us/3/${SERVER_DOMAIN}`);
    const data = await response.json();

    if (data.online) {
      dot.className = "w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse";
      const onlineCount = data.players ? data.players.online : 0;
      const maxCount = data.players ? data.players.max : 0;
      countText.innerText = `${onlineCount} / ${maxCount} Warriors Online`;

      if (data.players && data.players.list && data.players.list.length > 0) {
        container.innerHTML = data.players.list.map(player => {
          const playerName = typeof player === 'object' ? player.name : player;
          const playerRank = typeof player === 'object' && player.group ? player.group : 'Member';

          return `
            <div class="flex items-center gap-2 bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 px-3 py-1.5 rounded-xl transition shadow-md">
              <img src="https://mc-heads.net/avatar/${playerName}/24" alt="${playerName}" class="w-5 h-5 rounded">
              <span class="text-[11px] font-mono-code text-slate-200 font-semibold">${playerName}</span>
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
    } else {
      dot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
      countText.innerText = "Server Offline";
      container.innerHTML = `<span class="text-xs text-red-400 font-mono-code">Server sedang offline / Maintenance.</span>`;
    }
  } catch (err) {
    console.error("Gagal mengambil status server:", err);
    dot.className = "w-2.5 h-2.5 rounded-full bg-amber-500";
    countText.innerText = "Status Tidak Tersedia";
    container.innerHTML = `<span class="text-xs text-amber-400 font-mono-code">Gagal memuat list player online.</span>`;
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

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('signaturePad');
  function resizeCanvas() {
    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d").scale(ratio, ratio);
  }
  resizeCanvas();
  signaturePad = new SignaturePad(canvas, { penColor: "rgb(244, 63, 94)" });

  fetchOnlinePlayers();
  setInterval(fetchOnlinePlayers, 30000);
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

    const response = await fetch(WORKER_PROXY_URL, {
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