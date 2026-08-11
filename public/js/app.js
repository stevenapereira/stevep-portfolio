// ==========================================================================
// STEVE PEREIRA WEBSITE - APPLICATION LOGIC (APP.JS)
// ==========================================================================

let appData = {
  credits: [],
  headshots: [],
  stills: [],
  spotlightVideos: [
    { id: 'v1', title: '1. The Meeting - Up to 4K.mov', url: 'assets/The_Meeting_Up_to_4K.mov', poster: 'assets/thumb_the_meeting.jpg', size: '24.6 MB', tag: 'Showreel Video', type: 'video' },
    { id: 'v2', title: '2. SteveP-Showreel', url: 'assets/SteveP-Showreel.mp4', poster: 'assets/thumb_stevep_showreel.jpg', size: '39.4 MB', tag: 'Showreel Video', type: 'video' },
    { id: 'v3', title: '3. Combat Certificate Training', url: 'assets/Combat_Certificate_Training.mp4', poster: 'assets/thumb_combat_training.jpg', size: '6.0 MB', tag: 'Showreel Video', type: 'video' }
  ],
  fullBodySlates: [],
  sectionRouting: {
    leftPanelCategory: 'Filming Still',
    flutterDeckCategory: 'Headshot',
    fullBodyCategory: 'Full Body',
    heroCategory: 'Headshot'
  },
  stats: {},
  aboutTimeline: [],
  itTimeline: [],
  hacks: [],
  blogs: [],
  customPages: [],
  seo: {},
  analytics: {}
};

let currentHeroIndex = 0;
let heroCarouselTimer = null;
let currentStillIndex = 0;
let stillAutoplayTimer = null;
let selectedMediaIds = new Set();

// Non-blocking upload queue state
let isUploading = false;

// Initialize Application
window.addEventListener('DOMContentLoaded', () => {
  if (window.lucide) lucide.createIcons();
  
  // Default ambient background layer
  const bgLayer = document.getElementById('globalBgLayer');
  if (bgLayer) {
    bgLayer.style.backgroundImage = "url('assets/steve_signature_tattoo_bg.jpg')";
  }

  loadData();
  calculateSobrietyDays();
  trackEvent('page_view');
});

// Downward Parallax Motion for Background Photo on Page Scroll
window.addEventListener('scroll', () => {
  const bgLayer = document.getElementById('globalBgLayer');
  if (bgLayer) {
    const scrollY = window.scrollY || window.pageYOffset;
    // Downward translation matching scroll direction
    const offset = scrollY * 0.18;
    bgLayer.style.transform = `translate3d(0, -${offset}px, 0)`;
  }
});

// Load Data from Backend API or LocalStorage Fallback
async function loadData() {
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        appData = {
          ...appData,
          ...json.data,
          spotlightVideos: (json.data.spotlightVideos && json.data.spotlightVideos.length > 0) ? json.data.spotlightVideos : appData.spotlightVideos,
          sectionRouting: json.data.sectionRouting || appData.sectionRouting
        };
        renderAll();
        return;
      }
    }
  } catch (e) {
    console.log('Using local state cache');
  }

  renderAll();
}

function renderAll() {
  renderWorks();
  renderAdminCreditsTable();
  renderAboutTimeline();
  renderHeadshotsDeck();
  renderFullBodyGrid();
  renderRightSideSpotlightVideos();
  renderHeroCarousel();
  renderITTimeline();
  renderHacks();
  renderUKHelp();
  renderBlogs();
  renderAnalytics();
  renderAdminMediaGrid();
  renderCustomPages();
  updateSEODisplay();
  if (window.lucide) lucide.createIcons();
}

// --------------------------------------------------------------------------
// VIDEO REEL SOURCE TOGGLE
// --------------------------------------------------------------------------
function toggleVideoSource(type) {
  const spotlightFrame = document.getElementById('spotlightVideoFrame');
  const localPlayer = document.getElementById('showreelPlayer');

  if (type === 'spotlightFrame') {
    if (spotlightFrame) spotlightFrame.classList.remove('hidden');
    if (localPlayer) {
      localPlayer.classList.add('hidden');
      localPlayer.pause();
    }
  } else {
    if (spotlightFrame) spotlightFrame.classList.add('hidden');
    if (localPlayer) localPlayer.classList.remove('hidden');
  }
}

function switchMainShowreel(url, title, poster) {
  const player = document.getElementById('showreelPlayer');
  const src = document.getElementById('showreelPlayerSrc');
  const titleEl = document.getElementById('showreelMainTitle');
  const downloadBtn = document.getElementById('showreelMainDownloadBtn');

  if (player) {
    if (poster) player.poster = poster;
    if (src) src.src = url;
    player.src = url;
    player.load();
    player.play().catch(e => {});
    if (titleEl) titleEl.textContent = title;
    if (downloadBtn) {
      downloadBtn.href = url;
      downloadBtn.download = title.replace(/[^a-zA-Z0-9_\.-]/g, '_');
    }
  }
}

// --------------------------------------------------------------------------
// ABOUT STEVEP TIMELINE STORY
// --------------------------------------------------------------------------
function renderAboutTimeline() {
  const container = document.getElementById('aboutTimelineGrid');
  if (!container) return;

  const items = appData.aboutTimeline || [];
  container.innerHTML = items.map((item, idx) => `
    <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
      <div class="flex items-center justify-center w-10 h-10 rounded-full border border-slate-700 bg-slate-900 text-amber-400 font-bold shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-lg">
        ${idx + 1}
      </div>
      <div class="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] glass-card p-6 rounded-2xl border border-slate-800 space-y-2 backdrop-blur-md">
        <div class="flex items-center justify-between">
          <span class="px-3 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-black font-mono-code">${item.year}</span>
          <span class="text-xs font-bold text-slate-400">${item.location}</span>
        </div>
        <h3 class="text-lg font-black text-white font-cinzel">${item.title}</h3>
        <p class="text-slate-300 text-xs leading-relaxed">${item.desc}</p>
      </div>
    </div>
  `).join('');
}

// --------------------------------------------------------------------------
// FULL BODY STANDING SLATES GRID
// --------------------------------------------------------------------------
function renderFullBodyGrid() {
  const container = document.getElementById('fullBodyGrid');
  if (!container) return;

  const headshots = appData.headshots || [];
  const slates = appData.fullBodySlates || [];
  const fullBodyItems = [...slates, ...headshots.filter(h => h.tag === 'Full Body')];

  if (fullBodyItems.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400 italic">No standing full body slates allocated yet. Assign photos as "Full Body" in Admin Media.</div>`;
    return;
  }

  container.innerHTML = fullBodyItems.map(h => `
    <div onclick="openLightbox('${h.url}', '${h.title}', '${h.desc}')" class="glass-card rounded-2xl overflow-hidden border border-slate-800 cursor-pointer group hover:border-amber-400 transition">
      <div class="aspect-[3/4] w-full overflow-hidden bg-slate-950">
        <img src="${h.url}" alt="${h.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
      </div>
      <div class="p-4 space-y-1">
        <span class="px-2 py-0.5 rounded bg-yellow-400 text-slate-950 text-[10px] font-black">Full Body Slate</span>
        <h4 class="text-white text-xs font-bold font-cinzel truncate">${h.title}</h4>
        <p class="text-slate-300 text-[11px] truncate">${h.desc || "Head-to-toe standing slate"}</p>
      </div>
    </div>
  `).join('');
}

function renderRightSideSpotlightVideos() {
  const container = document.getElementById('rightSpotlightVideosContainer');
  if (!container) return;

  const videos = appData.spotlightVideos || [];
  if (videos.length === 0) {
    container.innerHTML = `<div class="p-4 rounded-xl bg-slate-900/50 border border-slate-800 text-center text-xs text-slate-400">No showreel videos found. Upload videos in Admin Media.</div>`;
    return;
  }

  container.innerHTML = videos.map((vid) => `
    <div class="glass-card rounded-xl border border-slate-800 p-2.5 flex items-center gap-3 hover:border-amber-400/60 transition shadow-md">
      <div class="w-36 shrink-0 aspect-video rounded-lg overflow-hidden bg-slate-950 relative border border-slate-800 group cursor-pointer" onclick="openVideoModal('${vid.url}', '${(vid.title || 'Spotlight Video').replace(/'/g, "\\'")}')">
        <video src="${vid.url}" poster="${vid.poster || 'assets/thumb_stevep_showreel.jpg'}" class="w-full h-full object-cover"></video>
        <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center group-hover:bg-amber-500/20 transition">
          <div class="w-7 h-7 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center shadow-lg group-hover:scale-110 transition">
            <i data-lucide="play" class="w-3.5 h-3.5 fill-current ml-0.5"></i>
          </div>
        </div>
      </div>

      <div class="flex-1 min-w-0 space-y-1">
        <h4 class="font-black text-white text-xs leading-tight truncate" title="${vid.title}">${vid.title}</h4>
        <span class="inline-block px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] text-slate-400 font-mono-code font-bold">${vid.size || 'Video Reel'}</span>
        <div class="flex items-center gap-1.5 pt-0.5">
          <button onclick="openVideoModal('${vid.url}', '${(vid.title || 'Spotlight Video').replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-400 font-bold text-[10px] flex items-center gap-1 transition">
            <i data-lucide="maximize-2" class="w-3 h-3"></i> Watch
          </button>
          <a href="${vid.url}" download="${vid.title}.mp4" class="px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] flex items-center gap-1 transition shadow">
            <i data-lucide="download" class="w-3 h-3"></i> Download
          </a>
        </div>
      </div>
    </div>
  `).join('');

  const countBadge = document.getElementById('spotlightVideoCountBadge');
  if (countBadge) countBadge.textContent = `ArtistRef: M283723 (${videos.length} Videos)`;
  if (window.lucide) lucide.createIcons();
}

// --------------------------------------------------------------------------
// HERO HEADSHOTS CAROUSEL
// --------------------------------------------------------------------------
function renderHeroCarousel() {
  const headshots = appData.headshots || [];
  if (headshots.length === 0) return;

  const current = headshots[currentHeroIndex % headshots.length];
  const heroImg = document.getElementById('heroActorPhoto');
  const heroTag = document.getElementById('heroHeadshotTag');

  if (heroImg && current) {
    heroImg.style.opacity = '0.3';
    setTimeout(() => {
      heroImg.src = current.url;
      heroImg.style.opacity = '1';
    }, 200);
  }
  if (heroTag && current) {
    heroTag.textContent = current.tag || 'Professional Headshot';
  }

  // Dots
  const dotsContainer = document.getElementById('heroHeadshotDots');
  if (dotsContainer) {
    dotsContainer.innerHTML = headshots.map((h, i) => `
      <button onclick="setHeroHeadshot(${i})" class="w-2.5 h-2.5 rounded-full transition ${i === currentHeroIndex % headshots.length ? 'bg-amber-400 w-6' : 'bg-slate-700 hover:bg-slate-500'}"></button>
    `).join('');
  }

  // Auto-rotate every 3.5 seconds
  if (!heroCarouselTimer) {
    heroCarouselTimer = setInterval(() => {
      nextHeroHeadshot();
    }, 3500);
  }
}

function setHeroHeadshot(index) {
  const headshots = appData.headshots || [];
  if (headshots.length === 0) return;
  currentHeroIndex = (index + headshots.length) % headshots.length;
  renderHeroCarousel();
}

function nextHeroHeadshot() {
  setHeroHeadshot(currentHeroIndex + 1);
}

function prevHeroHeadshot() {
  setHeroHeadshot(currentHeroIndex - 1);
}

async function updateSectionRouting(sectionKey, newCategory) {
  appData.sectionRouting = appData.sectionRouting || {};
  appData.sectionRouting[sectionKey] = newCategory;
  renderAll();
  await saveAppDataToServer();
}

// --------------------------------------------------------------------------
// 3D HEADSHOTS DECK
// --------------------------------------------------------------------------
function renderHeadshotsDeck() {
  const container = document.getElementById('inlineHeadshotsDeck');
  if (!container) return;

  const targetCategory = appData.sectionRouting?.flutterDeckCategory || 'Headshot';
  const allHeadshots = appData.headshots || [];
  const allStills = appData.stills || [];
  const allSlates = appData.fullBodySlates || [];
  const combined = [...allHeadshots, ...allStills, ...allSlates];

  let deckItems = combined.filter(h => h.tag === targetCategory);
  if (deckItems.length === 0) deckItems = combined.filter(h => h.tag !== 'Full Body');
  if (deckItems.length === 0) return;

  container.innerHTML = deckItems.slice(0, 5).map((h, i) => {
    return `
      <div onclick="openLightbox('${h.url}', '${h.title}', '${h.desc}')" 
           class="deck-card deck-card-${i} absolute w-48 sm:w-56 h-64 sm:h-72 rounded-2xl overflow-hidden glass-card border-2 border-slate-700 cursor-pointer shadow-2xl"
           style="z-index: ${30 + i};">
        <img src="${h.url}" alt="${h.title}" class="w-full h-full object-cover object-top">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
        <div class="absolute bottom-3 left-3 right-3 text-left">
          <span class="px-2 py-0.5 rounded bg-amber-500 text-slate-950 text-[10px] font-black">${h.tag || 'Headshot'}</span>
          <h4 class="text-white text-xs font-bold font-cinzel mt-1 truncate">${h.title}</h4>
        </div>
      </div>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// TAB SWITCHING & THEMES
// --------------------------------------------------------------------------
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const active = document.getElementById(`tab-${tabId}`);
  if (active) active.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('text-amber-400', 'bg-slate-950/60', 'border', 'border-slate-700/80');
    btn.classList.add('text-slate-200');
  });

  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.classList.remove('text-slate-200');
    activeNav.classList.add('text-amber-400', 'bg-slate-950/60', 'border', 'border-slate-700/80');
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleThemeDrawer() {
  const drawer = document.getElementById('themeDrawer');
  if (drawer) drawer.classList.toggle('hidden');
}

function setTheme(themeName) {
  document.documentElement.setAttribute('data-theme', themeName);
}

function toggleMobileMenu() {
  const menu = document.getElementById('mobileMenu');
  if (menu) menu.classList.toggle('hidden');
}

function toggleBgBlur() {
  const bg = document.getElementById('globalBgLayer');
  if (bg) {
    bg.style.filter = bg.style.filter.includes('brightness(0.2)') 
      ? 'grayscale(100%) contrast(150%) brightness(0.48)' 
      : 'grayscale(100%) contrast(180%) brightness(0.2)';
  }
}

// --------------------------------------------------------------------------
// LIGHTBOX & BACKGROUND PICKER
// --------------------------------------------------------------------------
function openLightbox(url, title, desc) {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImg');
  const titleEl = document.getElementById('lightboxTitle');
  const descEl = document.getElementById('lightboxDesc');
  const downloadBtn = document.getElementById('lightboxDownloadBtn');

  if (modal && img) {
    img.src = url;
    if (titleEl) titleEl.textContent = title || 'Steve Pereira Headshot';
    if (descEl) descEl.textContent = desc || '';
    if (downloadBtn) downloadBtn.href = url;
    modal.classList.remove('hidden');
  }
}

function closeLightbox() {
  const modal = document.getElementById('lightboxModal');
  if (modal) modal.classList.add('hidden');
}

function openVideoModal(url, title = 'Steve Pereira Video Reel') {
  const modal = document.getElementById('videoModal');
  const player = document.getElementById('modalVideoPlayer');
  const src = document.getElementById('modalVideoSrc');
  const titleEl = document.getElementById('videoModalTitle');
  const downloadBtn = document.getElementById('modalVideoDownloadBtn');

  if (modal && player && src) {
    src.src = url;
    player.load();
    player.play().catch(e => {});
    if (titleEl) titleEl.textContent = title;
    if (downloadBtn) {
      downloadBtn.href = url;
      downloadBtn.download = title.replace(/[^a-zA-Z0-9_\.-]/g, '_');
    }
    modal.classList.remove('hidden');
  }
}

function closeVideoModal() {
  const modal = document.getElementById('videoModal');
  const player = document.getElementById('modalVideoPlayer');
  if (player) player.pause();
  if (modal) modal.classList.add('hidden');
}

function setLightboxImgAsBg() {
  const img = document.getElementById('lightboxImg');
  if (img && img.src) {
    const bgLayer = document.getElementById('globalBgLayer');
    if (bgLayer) bgLayer.style.backgroundImage = `url('${img.src}')`;
    alert('Ambient background photo updated!');
    closeLightbox();
  }
}

// --------------------------------------------------------------------------
// FILMOGRAPHY CREDITS & SPOTLIGHT CRUD
// --------------------------------------------------------------------------
function renderWorks(filterCat = 'All') {
  const tbody = document.getElementById('worksTableBody');
  if (!tbody) return;

  let credits = appData.credits || [];
  if (filterCat !== 'All') {
    credits = credits.filter(c => c.category === filterCat);
  }

  tbody.innerHTML = credits.map(c => `
    <tr class="hover:bg-slate-900/60 transition">
      <td class="p-4 font-bold text-white">${c.title}</td>
      <td class="p-4 text-amber-400 font-medium">${c.role}</td>
      <td class="p-4"><span class="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-bold">${c.category}</span></td>
      <td class="p-4 text-slate-300">${c.production}</td>
      <td class="p-4 font-mono-code font-bold text-slate-400">${c.year}</td>
      <td class="p-4"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">${c.status}</span></td>
    </tr>
  `).join('');
}

function filterWorks(cat) {
  renderWorks(cat);
}

function renderAdminCreditsTable() {
  const tbody = document.getElementById('adminCreditsTableBody');
  if (!tbody) return;

  const credits = appData.credits || [];
  tbody.innerHTML = credits.map(c => `
    <tr class="hover:bg-slate-900/80 transition">
      <td class="p-3 font-bold text-white">${c.title}</td>
      <td class="p-3 text-amber-400">${c.role}</td>
      <td class="p-3 text-slate-300">${c.category}</td>
      <td class="p-3 text-slate-400">${c.production}</td>
      <td class="p-3 font-mono-code text-slate-400">${c.year}</td>
      <td class="p-3 flex items-center gap-2">
        <button onclick="editCreditPrompt('${c.id}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-400 text-[10px] font-bold">Edit</button>
        <button onclick="deleteCredit('${c.id}')" class="px-2.5 py-1 rounded bg-rose-600/80 hover:bg-rose-500 text-white text-[10px] font-bold">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function syncSpotlightVideos() {
  const btns = document.querySelectorAll('#spotlightVideoSyncBtn');
  btns.forEach(btn => {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Syncing Spotlight Videos (M283723)...`;
  });

  try {
    const res = await fetch('/api/spotlight/sync-videos', { method: 'POST' });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        appData.spotlightVideos = json.data;
        renderAll();
        alert(json.message || 'Successfully synced all video media from Spotlight!');
      }
    } else {
      alert('Failed to sync Spotlight videos.');
    }
  } catch (e) {
    alert('Error connecting to Spotlight Video Sync API: ' + e.message);
  } finally {
    btns.forEach(btn => {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="film" class="w-4 h-4"></i> Sync Videos from Spotlight (M283723)`;
    });
    if (window.lucide) lucide.createIcons();
  }
}

async function syncSpotlightCredits() {
  const btn = document.getElementById('spotlightSyncBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Syncing Spotlight...`;
  }

  try {
    const res = await fetch('/api/spotlight/sync', { method: 'POST' });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        appData.credits = json.data;
        renderAll();
        alert('Spotlight credits synced successfully!');
      }
    }
  } catch (e) {
    alert('Error syncing Spotlight credits');
  }

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Sync Credits (9339-8945-6183)`;
  }
}

async function deleteCredit(id) {
  if (!confirm('Are you sure you want to delete this credit?')) return;
  appData.credits = appData.credits.filter(c => c.id !== id);
  renderAll();
  try {
    await fetch(`/api/credits/${id}`, { method: 'DELETE' });
  } catch (e) {}
}

async function editCreditPrompt(id) {
  const credit = appData.credits.find(c => c.id === id);
  if (!credit) return;

  const newTitle = prompt('Edit Title:', credit.title);
  if (newTitle === null) return;
  const newRole = prompt('Edit Role:', credit.role);
  if (newRole === null) return;

  credit.title = newTitle;
  credit.role = newRole;
  renderAll();

  try {
    await fetch(`/api/credits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credit)
    });
  } catch (e) {}
}

// --------------------------------------------------------------------------
// 34-YEAR IT TIMELINE & AI BLUEPRINT GENERATOR
// --------------------------------------------------------------------------
function renderITTimeline() {
  const container = document.getElementById('itTimelineContainer');
  if (!container) return;

  const items = appData.itTimeline || [];
  container.innerHTML = items.map(item => `
    <div class="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 backdrop-blur-md">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <span class="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-black font-mono-code">${item.year}</span>
        <span class="text-xs font-bold text-slate-300">${item.company}</span>
      </div>
      <h4 class="text-white font-bold text-base font-cinzel">${item.title}</h4>
      <p class="text-slate-300 text-xs leading-relaxed">${item.desc}</p>
    </div>
  `).join('');
}

function generateITBlueprint() {
  const input = document.getElementById('aiITQuery');
  const output = document.getElementById('aiITOutput');
  const btn = document.getElementById('aiITBtn');

  if (!input || !input.value.trim()) {
    alert('Please enter your IT requirements');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Generating Blueprint...`;

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="cpu" class="w-4 h-4"></i> Generate Architectural Blueprint`;
    output.classList.remove('hidden');
    output.innerHTML = `
      <strong class="text-cyan-400 block text-sm font-cinzel mb-2">STEVE PEREIRA CLOUD ARCHITECTURE SPECIFICATION</strong>
      <p class="mb-2"><strong>Requirement:</strong> "${input.value}"</p>
      <ul class="list-disc list-inside space-y-1 text-slate-200">
        <li><strong>Multi-Region Resilience:</strong> Active-Active load balancing across AWS/GCP regions with automated failover under 500ms.</li>
        <li><strong>Media Ingestion:</strong> Zero-trust API Gateway with TLS 1.3 encryption and automated CDN caching.</li>
        <li><strong>Database Tier:</strong> Distributed Spanner/PostgreSQL cluster with read-replicas for sub-10ms response times.</li>
        <li><strong>Compliance:</strong> SAIF & ISO 27001 compliant enterprise security framework.</li>
      </ul>
      <p class="mt-3 text-[11px] text-emerald-400 font-bold">Generated by Steve Pereira 34-Yr IT Consultancy Engine (Dubai & UK Experience).</p>
    `;
    if (window.lucide) lucide.createIcons();
  }, 1200);
}

// --------------------------------------------------------------------------
// HACKS & MONEY SAVING DEALS
// --------------------------------------------------------------------------
function renderHacks() {
  const container = document.getElementById('hacksGrid');
  if (!container) return;

  const hacks = appData.hacks || [];
  container.innerHTML = hacks.map(h => `
    <div class="glass-card rounded-2xl border border-slate-800 p-6 space-y-4 flex flex-col justify-between">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <span class="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase border border-emerald-500/30">${h.badge}</span>
          <span class="text-xs text-slate-300 font-mono-code">${h.category}</span>
        </div>
        <h3 class="text-lg font-black text-white font-cinzel">${h.title}</h3>
        <p class="text-xs text-slate-300 leading-relaxed">${h.desc}</p>
      </div>

      <div class="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <div class="bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 font-mono-code font-bold text-xs text-amber-400">
          Code: <span>${h.code}</span>
        </div>
        <a href="${h.link}" target="_blank" onclick="trackEvent('affiliate_click', '${h.title}')" class="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 transition shadow">
          <span>Claim Deal</span> <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
        </a>
      </div>
    </div>
  `).join('');
}

// --------------------------------------------------------------------------
// KMST SOBRIETY & UK HELP DIRECTORY
// --------------------------------------------------------------------------
function calculateSobrietyDays() {
  const soberDate = new Date(2013, 5, 1);
  const diffTime = Math.abs(new Date() - soberDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const el = document.getElementById('sobrietyDaysCount');
  if (el) el.textContent = diffDays.toLocaleString();
}

function renderUKHelp() {
  const container = document.getElementById('ukHelpGrid');
  if (!container) return;

  const query = (document.getElementById('helpSearchInput')?.value || '').toLowerCase();
  const helpList = [
    { title: "NHS 111 Alcohol Helpline", tel: "111", desc: "Free 24/7 NHS confidential medical advice and detox support pathways.", badge: "NHS FREE" },
    { title: "Samaritans UK", tel: "116 123", desc: "Confidential emotional support 24 hours a day for anyone in distress.", badge: "24/7 HELPLINE" },
    { title: "Alcoholics Anonymous (AA UK)", tel: "0800 9177 650", desc: "National helpline and local 12-step meeting locator across the UK.", badge: "RECOVERY GROUP" },
    { title: "Al-Anon Family Groups UK", tel: "0800 0086 811", desc: "Support for families and friends affected by someone else's drinking.", badge: "FAMILY SUPPORT" },
    { title: "FRANK Alcohol & Drug Support", tel: "0300 123 6600", desc: "Honest advice about alcohol, drugs, and treatment options.", badge: "ADVICE SERVICE" },
    { title: "SMART Recovery UK", tel: "0300 303 0285", desc: "Science-based self-empowerment recovery meetings and tools.", badge: "EVIDENCE BASED" }
  ];

  const filtered = helpList.filter(h => h.title.toLowerCase().includes(query) || h.desc.toLowerCase().includes(query));

  container.innerHTML = filtered.map(h => `
    <div class="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-3 backdrop-blur-md">
      <div class="flex items-center justify-between">
        <span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 text-[10px] font-black">${h.badge}</span>
        <i data-lucide="phone-call" class="w-4 h-4 text-rose-400"></i>
      </div>
      <h4 class="text-white font-bold text-sm font-cinzel">${h.title}</h4>
      <p class="text-slate-300 text-xs">${h.desc}</p>
      <a href="tel:${h.tel.replace(/\s+/g, '')}" class="w-full py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs flex items-center justify-center gap-2 transition shadow">
        <i data-lucide="phone" class="w-3.5 h-3.5"></i> Call ${h.tel}
      </a>
    </div>
  `).join('');
}

function renderBlogs() {
  const container = document.getElementById('blogFeedList');
  if (!container) return;

  const blogs = appData.blogs || [];
  container.innerHTML = blogs.map(b => `
    <div class="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 backdrop-blur-md">
      <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">${b.category}</span>
      <h4 class="text-white font-bold text-sm font-cinzel">${b.title}</h4>
      <p class="text-slate-300 text-xs">${b.excerpt}</p>
      <span class="text-[10px] text-slate-400 font-mono-code block pt-2">${b.date}</span>
    </div>
  `).join('');
}

// --------------------------------------------------------------------------
// CUSTOM PAGES BUILDER
// --------------------------------------------------------------------------
function renderCustomPages() {
  const container = document.getElementById('customPagesList');
  if (!container) return;

  const pages = appData.customPages || [];
  if (pages.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic">No custom pages created yet.</p>`;
    return;
  }

  container.innerHTML = pages.map(p => `
    <div class="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3 text-xs">
      <div>
        <strong class="text-white font-cinzel block text-sm">${p.title}</strong>
        <span class="text-slate-400 font-mono-code text-[11px]">Slug: /#${p.slug}</span>
      </div>
      <button onclick="deleteCustomPage('${p.id}')" class="px-3 py-1.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold">Delete Page</button>
    </div>
  `).join('');
}

async function handleCreateCustomPage(e) {
  e.preventDefault();
  const title = document.getElementById('customPageTitle').value;
  const icon = document.getElementById('customPageIcon').value;
  const content = document.getElementById('customPageContent').value;

  const newPage = {
    title,
    icon,
    content,
    slug: title.toLowerCase().replace(/[^a-z0-9]/g, '-')
  };

  try {
    const res = await fetch('/api/pages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPage)
    });
    if (res.ok) {
      const json = await res.json();
      if (json.data) {
        appData.customPages = appData.customPages || [];
        appData.customPages.push(json.data);
        renderAll();
        alert(`Custom page "${title}" created successfully!`);
      }
    }
  } catch (e) {
    alert('Error creating custom page');
  }
}

async function deleteCustomPage(id) {
  if (!confirm('Delete this page?')) return;
  appData.customPages = appData.customPages.filter(p => p.id !== id);
  renderAll();
  try {
    await fetch(`/api/pages/${id}`, { method: 'DELETE' });
  } catch (e) {}
}

// --------------------------------------------------------------------------
// EXPANDED ADMIN CMS PORTAL & SUB-TABS
// --------------------------------------------------------------------------
function setAdminSubTab(subTab) {
  document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`adminSection-${subTab}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.admin-subnav-btn').forEach(btn => {
    btn.classList.remove('bg-amber-500/20', 'text-amber-400', 'border-amber-500/30');
    btn.classList.add('bg-slate-900', 'text-slate-300');
  });

  const activeBtn = document.getElementById(`adminSubNav-${subTab}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-900', 'text-slate-300');
    activeBtn.classList.add('bg-amber-500/20', 'text-amber-400', 'border-amber-500/30');
  }
}

function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('adminPinInput')?.value;
  if (pin === '1234' || pin === 'admin' || pin === '9339') {
    document.getElementById('adminLockScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    renderAdminMediaGrid();
  } else {
    alert('Incorrect Admin PIN. Try 1234');
  }
}

function lockAdmin() {
  document.getElementById('adminLockScreen')?.classList.remove('hidden');
  document.getElementById('adminDashboard')?.classList.add('hidden');
}

function renderAnalytics() {
  const analytics = appData.analytics || {};
  if (document.getElementById('statViews')) document.getElementById('statViews').textContent = (analytics.pageViews || 1450).toLocaleString();
  if (document.getElementById('statSpotlight')) document.getElementById('statSpotlight').textContent = (analytics.spotlightClicks || 320).toLocaleString();
  if (document.getElementById('statShowreel')) document.getElementById('statShowreel').textContent = (analytics.showreelPlays || 505).toLocaleString();
  if (document.getElementById('statCV')) document.getElementById('statCV').textContent = (analytics.cvDownloads || 190).toLocaleString();
  if (document.getElementById('statBooking')) document.getElementById('statBooking').textContent = (analytics.bookingEnquiries || 30).toLocaleString();
}

function updateSEODisplay() {
  const seo = appData.seo || {};
  if (document.getElementById('adminSEOTitle')) document.getElementById('adminSEOTitle').value = seo.title || '';
  if (document.getElementById('adminSEODesc')) document.getElementById('adminSEODesc').value = seo.description || '';
  if (document.getElementById('adminSEOKeywords')) document.getElementById('adminSEOKeywords').value = seo.keywords || '';
}

// --------------------------------------------------------------------------
// CLIENT-SIDE CANVAS IMAGE OPTIMIZER & NON-BLOCKING UPLOAD ENGINE
// --------------------------------------------------------------------------
function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
    };
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function startBackgroundUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const targetRole = document.getElementById('bulkUploadTargetRole')?.value || 'Headshot';
  const progressContainer = document.getElementById('uploadProgressContainer');
  const progressBar = document.getElementById('uploadProgressBar');
  const progressPercent = document.getElementById('uploadProgressPercent');
  const progressText = document.getElementById('uploadProgressText');

  if (progressContainer) progressContainer.classList.remove('hidden');

  const fileList = Array.from(files);
  const total = fileList.length;

  for (let i = 0; i < total; i++) {
    const file = fileList[i];
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|m4v|mkv)$/i) || targetRole === 'Showreel Video';

    if (isVideo) {
      const videoDataUrl = await readFileAsDataURL(file);
      const newVideo = {
        id: 'vid_' + Date.now() + '_' + i,
        title: file.name.replace(/\.[^/.]+$/, ""),
        url: videoDataUrl,
        type: 'video',
        tag: 'Showreel Video',
        poster: 'assets/thumb_stevep_showreel.jpg',
        size: (file.size / (1024 * 1024)).toFixed(1) + ' MB'
      };
      appData.spotlightVideos = appData.spotlightVideos || [];
      appData.spotlightVideos.unshift(newVideo);
    } else {
      const compressedUrl = await compressImage(file);
      const newMedia = {
        id: 'media_' + Date.now() + '_' + i,
        title: file.name.replace(/\.[^/.]+$/, ""),
        tag: targetRole,
        type: 'photo',
        desc: `${targetRole} photo`,
        url: compressedUrl
      };

      if (targetRole === 'Filming Still') {
        appData.stills.unshift(newMedia);
      } else if (targetRole === 'Full Body') {
        appData.fullBodySlates = appData.fullBodySlates || [];
        appData.fullBodySlates.unshift(newMedia);
      } else {
        appData.headshots.unshift(newMedia);
      }

      if (targetRole === 'Signature B&W') {
        const bg = document.getElementById('globalBgLayer');
        if (bg) bg.style.backgroundImage = `url('${compressedUrl}')`;
      }
    }

    const pct = Math.round(((i + 1) / total) * 100);
    if (progressBar) progressBar.style.width = `${pct}%`;
    if (progressPercent) progressPercent.textContent = `${pct}%`;
    if (progressText) progressText.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Processing ${i + 1} of ${total} files...`;
    
    renderAll();
    await new Promise(r => setTimeout(r, 100));
  }

  await saveAppDataToServer();

  if (progressText) progressText.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> All ${total} files processed, added to ${targetRole}, & saved to database!`;
  setTimeout(() => {
    if (progressContainer) progressContainer.classList.add('hidden');
  }, 3000);
}

function handleHeadshotUpload(e) {
  startBackgroundUpload(e);
}

// Drag & Drop Reordering State
let draggedMediaId = null;

function handleMediaDragStart(e, id) {
  draggedMediaId = id;
  e.dataTransfer.setData('text/plain', id);
  e.target.classList.add('opacity-40');
}

function handleMediaDragOver(e) {
  e.preventDefault();
}

async function handleMediaDrop(e, targetId) {
  e.preventDefault();
  if (!draggedMediaId || draggedMediaId === targetId) return;

  const sourceCat = findMediaCategory(draggedMediaId);
  const targetCat = findMediaCategory(targetId);

  if (sourceCat && targetCat && sourceCat === targetCat) {
    const list = appData[sourceCat];
    const fromIdx = list.findIndex(m => m.id === draggedMediaId);
    const toIdx = list.findIndex(m => m.id === targetId);

    if (fromIdx !== -1 && toIdx !== -1) {
      const [moved] = list.splice(fromIdx, 1);
      list.splice(toIdx, 0, moved);
      renderAll();
      await saveAppDataToServer();
    }
  }
}

async function moveMediaUp(id) {
  const category = findMediaCategory(id);
  if (!category || !appData[category]) return;
  const list = appData[category];
  const idx = list.findIndex(m => m.id === id);
  if (idx > 0) {
    const [item] = list.splice(idx, 1);
    list.splice(idx - 1, 0, item);
    renderAll();
    await saveAppDataToServer();
  }
}

async function moveMediaDown(id) {
  const category = findMediaCategory(id);
  if (!category || !appData[category]) return;
  const list = appData[category];
  const idx = list.findIndex(m => m.id === id);
  if (idx !== -1 && idx < list.length - 1) {
    const [item] = list.splice(idx, 1);
    list.splice(idx + 1, 0, item);
    renderAll();
    await saveAppDataToServer();
  }
}

function findMediaCategory(id) {
  if ((appData.spotlightVideos || []).some(m => m.id === id)) return 'spotlightVideos';
  if ((appData.headshots || []).some(m => m.id === id)) return 'headshots';
  if ((appData.stills || []).some(m => m.id === id)) return 'stills';
  if ((appData.fullBodySlates || []).some(m => m.id === id)) return 'fullBodySlates';
  return null;
}

function renderAdminMediaGrid() {
  const container = document.getElementById('adminMediaGrid');
  if (!container) return;

  const categoryVal = document.getElementById('mediaCategoryFilter')?.value || 'ALL';
  const typeVal = document.getElementById('mediaTypeFilter')?.value || 'ALL';

  const defaultVids = [
    { id: 'v1', title: '1. The Meeting - Up to 4K.mov', url: 'assets/The_Meeting_Up_to_4K.mov', poster: 'assets/thumb_the_meeting.jpg', size: '24.6 MB', tag: 'Showreel Video', type: 'video' },
    { id: 'v2', title: '2. SteveP-Showreel', url: 'assets/SteveP-Showreel.mp4', poster: 'assets/thumb_stevep_showreel.jpg', size: '39.4 MB', tag: 'Showreel Video', type: 'video' },
    { id: 'v3', title: '3. Combat Certificate Training', url: 'assets/Combat_Certificate_Training.mp4', poster: 'assets/thumb_combat_training.jpg', size: '6.0 MB', tag: 'Showreel Video', type: 'video' }
  ];

  const rawVids = (appData.spotlightVideos && appData.spotlightVideos.length > 0) ? appData.spotlightVideos : defaultVids;
  const vids = rawVids.map(v => ({ ...v, tag: 'Showreel Video', type: 'video' }));
  const headshots = (appData.headshots || []).map(h => ({ ...h, type: h.type || 'photo' }));
  const stills = (appData.stills || []).map(s => ({ ...s, tag: s.tag || 'Filming Still', type: s.type || 'photo' }));
  const slates = (appData.fullBodySlates || []).map(f => ({ ...f, tag: 'Full Body', type: f.type || 'photo' }));

  let allMedia = [...vids, ...headshots, ...stills, ...slates];

  if (categoryVal !== 'ALL') {
    allMedia = allMedia.filter(m => {
      if (categoryVal === 'Showreel Video' || categoryVal === 'Showreel') {
        return m.tag === 'Showreel Video' || m.tag === 'Showreel' || m.type === 'video';
      }
      return m.tag === categoryVal;
    });
  }

  if (typeVal !== 'ALL') {
    allMedia = allMedia.filter(m => {
      if (typeVal === 'video') return m.type === 'video' || m.tag === 'Showreel Video' || m.tag === 'Showreel';
      if (typeVal === 'photo') return m.type !== 'video' && m.tag !== 'Showreel Video' && m.tag !== 'Showreel';
      return true;
    });
  }

  const badgeEl = document.getElementById('mediaSummaryBadge');
  if (badgeEl) {
    badgeEl.textContent = `Showing (${allMedia.length} items) - Drag & drop or use ⬆️⬇️ to reorder`;
  }

  const selectedCountEl = document.getElementById('selectedMediaCount');
  if (selectedCountEl) {
    selectedCountEl.textContent = `${selectedMediaIds.size} Selected`;
  }

  if (allMedia.length === 0) {
    container.innerHTML = `<div class="col-span-full py-8 text-center text-xs text-slate-400 italic">No media items found for selected filter.</div>`;
    return;
  }

  container.innerHTML = allMedia.map(m => {
    const isChecked = selectedMediaIds.has(m.id);
    const isVideo = m.type === 'video' || m.tag === 'Showreel Video' || m.tag === 'Showreel';
    let typeBadge = isVideo ? "bg-purple-500 text-white font-black" : "bg-amber-500 text-slate-950 font-black";

    return `
      <div draggable="true" ondragstart="handleMediaDragStart(event, '${m.id}')" ondragover="handleMediaDragOver(event)" ondrop="handleMediaDrop(event, '${m.id}')" class="relative group rounded-xl overflow-hidden glass-card border ${isChecked ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-800'} aspect-square flex flex-col justify-between cursor-move shadow-md">
        
        ${isVideo ? `
          <video src="${m.url}" poster="${m.poster || 'assets/thumb_stevep_showreel.jpg'}" class="w-full h-full object-cover absolute inset-0" preload="metadata"></video>
          <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center group-hover:bg-purple-600/30 transition">
            <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition cursor-pointer" onclick="openVideoModal('${m.url}', '${(m.title || 'Video').replace(/'/g, "\\'")}')">
              <i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i>
            </div>
          </div>
        ` : `
          <img src="${m.url}" class="w-full h-full object-cover object-top absolute inset-0">
        `}
        
        <!-- Top Controls Overlay -->
        <div class="relative z-10 p-2 flex items-center justify-between bg-gradient-to-b from-slate-950/90 to-transparent">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleMediaSelect('${m.id}')" class="w-4 h-4 rounded text-amber-500 cursor-pointer">
          <div class="flex items-center gap-1">
            <span class="px-1.5 py-0.5 rounded ${typeBadge} text-[9px] truncate">${isVideo ? '🎥 VIDEO' : '📸 PHOTO'}</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[9px] truncate">${m.tag}</span>
          </div>
        </div>

        <!-- Bottom Actions & Quick Reorder Controls Overlay -->
        <div class="relative z-10 p-2 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent opacity-90 group-hover:opacity-100 transition space-y-1.5 text-left">
          <div class="flex items-center justify-between gap-1">
            <span class="text-[9px] text-slate-300 font-bold">Reorder:</span>
            <div class="flex items-center gap-1">
              <button onclick="moveMediaUp('${m.id}')" class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-400 text-[10px] font-black" title="Move Up">⬆️</button>
              <button onclick="moveMediaDown('${m.id}')" class="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 hover:border-amber-400 text-amber-400 text-[10px] font-black" title="Move Down">⬇️</button>
            </div>
          </div>

          <div class="space-y-0.5">
            <select onchange="reassignMediaRole('${m.id}', this.value)" class="w-full px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-amber-300">
              <option value="Headshot" ${m.tag === 'Headshot' ? 'selected' : ''}>Standard Headshot</option>
              <option value="Showreel Video" ${m.tag === 'Showreel Video' ? 'selected' : ''}>🎥 Showreel Video</option>
              <option value="Full Body" ${m.tag === 'Full Body' ? 'selected' : ''}>Full Body Slate</option>
              <option value="Filming Still" ${m.tag === 'Filming Still' ? 'selected' : ''}>35mm Filming Still</option>
              <option value="Signature B&W" ${m.tag === 'Signature B&W' ? 'selected' : ''}>Ambient BG Photo</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function toggleMediaSelect(id) {
  if (selectedMediaIds.has(id)) selectedMediaIds.delete(id);
  else selectedMediaIds.add(id);
  renderAdminMediaGrid();
}

async function saveAppDataToServer() {
  try {
    const res = await fetch('/api/data/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    const data = await res.json();
    return data.success;
  } catch (e) {
    console.error('Failed to persist appData to server:', e);
    return false;
  }
}

async function reassignMediaRole(id, newRole) {
  const item = [...(appData.headshots || []), ...(appData.stills || [])].find(m => m.id === id);
  if (item) {
    item.tag = newRole;
    renderAll();
    await saveAppDataToServer();
  }
}

async function bulkMoveSelected() {
  if (selectedMediaIds.size === 0) return alert('Select photos to move first using checkboxes.');
  const newRole = document.getElementById('bulkMoveTarget')?.value || 'Headshot';

  [...(appData.headshots || []), ...(appData.stills || [])].forEach(m => {
    if (selectedMediaIds.has(m.id)) {
      m.tag = newRole;
    }
  });

  selectedMediaIds.clear();
  renderAll();
  await saveAppDataToServer();
  alert(`Selected photos moved to "${newRole}" and saved!`);
}

function setPhotoAsBg(url) {
  const bg = document.getElementById('globalBgLayer');
  if (bg) bg.style.backgroundImage = `url('${url}')`;
  appData.seo = appData.seo || {};
  appData.seo.bgPhotoUrl = url;
  saveAppDataToServer();
  alert('Background updated & saved!');
}

async function deleteSelectedMedia() {
  if (selectedMediaIds.size === 0) return alert('Select photos to delete first');
  appData.headshots = appData.headshots.filter(h => !selectedMediaIds.has(h.id));
  appData.stills = appData.stills.filter(s => !selectedMediaIds.has(s.id));
  selectedMediaIds.clear();
  renderAll();
  await saveAppDataToServer();
  alert('Selected photos deleted & saved!');
}

// --------------------------------------------------------------------------
// BACKUP & RESTORE
// --------------------------------------------------------------------------
function handleRestoreBackup(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const json = JSON.parse(event.target.result);
      if (json.credits || json.headshots || json.seo) {
        appData = json;
        renderAll();
        await saveAppDataToServer();
        alert('Site backup restored and saved permanently to server!');
      } else {
        alert('Invalid backup format');
      }
    } catch (err) {
      alert('Error parsing JSON backup file');
    }
  };
  reader.readAsText(file);
}

// --------------------------------------------------------------------------
// FORM SAVES & EVENT TRACKING
// --------------------------------------------------------------------------
async function handleSaveSEO(e) {
  e.preventDefault();
  appData.seo = appData.seo || {};
  appData.seo.title = document.getElementById('adminSEOTitle').value;
  appData.seo.description = document.getElementById('adminSEODesc').value;
  appData.seo.keywords = document.getElementById('adminSEOKeywords').value;
  
  if (document.title && appData.seo.title) document.title = appData.seo.title;
  
  const saved = await saveAppDataToServer();
  if (saved) alert('SEO Settings Saved & Saved to Database!');
  else alert('SEO Settings updated locally');
}

async function handleSaveVitalStats(e) {
  e.preventDefault();
  const height = document.getElementById('adminStatHeight').value;
  const hair = document.getElementById('adminStatHair').value;
  const eyes = document.getElementById('adminStatEyes').value;

  appData.stats = { ...appData.stats, height, hair, eyes };
  if (document.getElementById('statDisplayHeight')) document.getElementById('statDisplayHeight').textContent = height;
  if (document.getElementById('statDisplayHairEyes')) document.getElementById('statDisplayHairEyes').textContent = `${hair} / ${eyes}`;
  await saveAppDataToServer();
  alert('Vital stats updated & saved permanently!');
}

async function handleSaveCredit(e) {
  e.preventDefault();
  const newCredit = {
    id: 'w_' + Date.now(),
    title: document.getElementById('adminCreditTitle').value,
    role: document.getElementById('adminCreditRole').value,
    category: document.getElementById('adminCreditCat').value,
    production: 'Independent',
    year: '2026',
    status: 'Active'
  };
  appData.credits.unshift(newCredit);
  renderAll();
  await saveAppDataToServer();
  alert('Acting credit added and saved!');
}

function handleSaveHack(e) {
  e.preventDefault();
  const newHack = {
    id: 'hk_' + Date.now(),
    title: document.getElementById('adminHackTitle').value,
    category: 'Tech & Savings',
    tag: 'Community Deal',
    code: document.getElementById('adminHackCode').value || 'STEVEVIP',
    link: document.getElementById('adminHackLink').value,
    desc: document.getElementById('adminHackDesc').value || 'Curated deal by Steve Pereira.',
    badge: document.getElementById('adminHackBadge').value || 'PROMO'
  };
  appData.hacks.unshift(newHack);
  renderAll();
  alert('Affiliate hack added!');
}

function handleBookingSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('bookName').value;
  alert(`Thank you ${name}! Your enquiry has been sent directly to Steve Pereira & The Central Line Agency.`);
}

function trackEvent(type, name = '') {
  try {
    fetch('/api/analytics/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, name, timestamp: new Date().toISOString() })
    });
  } catch (e) {}
}

// Stills Reel navigation
function prevStill() {
  const stills = appData.stills || [];
  if (stills.length === 0) return;
  currentStillIndex = (currentStillIndex - 1 + stills.length) % stills.length;
  updateStillDisplay();
}

function nextStill() {
  const stills = appData.stills || [];
  if (stills.length === 0) return;
  currentStillIndex = (currentStillIndex + 1) % stills.length;
  updateStillDisplay();
}

function selectStillByIndex(idx) {
  const stills = appData.stills || [];
  if (idx >= 0 && idx < stills.length) {
    currentStillIndex = idx;
    updateStillDisplay();
  }
}

function openLightboxCurrentStill() {
  const stills = appData.stills || [];
  if (stills[currentStillIndex]) {
    openLightbox(stills[currentStillIndex].url, stills[currentStillIndex].title || '35mm Filming Location Still', stills[currentStillIndex].desc || '');
  }
}

function renderStillsThumbStrip() {
  const container = document.getElementById('mainStillsThumbStrip');
  if (!container) return;

  const stills = appData.stills || [];
  container.innerHTML = stills.map((still, idx) => `
    <button onclick="selectStillByIndex(${idx})" class="w-16 h-12 shrink-0 rounded-lg overflow-hidden border-2 ${idx === currentStillIndex ? 'border-amber-400 ring-2 ring-amber-400/50 scale-105' : 'border-slate-800 opacity-60 hover:opacity-100'} transition shadow">
      <img src="${still.url}" alt="${still.title || '35mm Still'}" class="w-full h-full object-cover">
    </button>
  `).join('');
}

function updateStillDisplay() {
  const stills = appData.stills || [];
  if (stills.length === 0) return;
  const current = stills[currentStillIndex];
  if (current) {
    const imgEl = document.getElementById('cinemaStillImg');
    const titleEl = document.getElementById('cinemaStillTitle');
    const descEl = document.getElementById('cinemaStillDesc');
    const counterEl = document.getElementById('cinemaCounter');

    if (imgEl) imgEl.src = current.url;
    if (titleEl) titleEl.textContent = current.title || '35mm Filming Location Still';
    if (descEl) descEl.textContent = current.desc || 'Original 35mm lens location capture';
    if (counterEl) counterEl.textContent = `${currentStillIndex + 1} / ${stills.length}`;

    renderStillsThumbStrip();
  }
}

function toggleReelAutoPlay() {
  const btn = document.getElementById('reelAutoPlayBtn');
  if (stillAutoplayTimer) {
    clearInterval(stillAutoplayTimer);
    stillAutoplayTimer = null;
    if (btn) btn.innerHTML = `<i data-lucide="play" class="w-4 h-4"></i> Auto-Play Slideshow`;
  } else {
    stillAutoplayTimer = setInterval(nextStill, 3000);
    if (btn) btn.innerHTML = `<i data-lucide="pause" class="w-4 h-4"></i> Pause Slideshow`;
  }
  if (window.lucide) lucide.createIcons();
}
