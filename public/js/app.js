// Safe HTML escaping utility
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;

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
  seo: {
    title: "Steve Pereira | British Indian Actor | IT Expert Since 1992 | Cardiac Arrest Survivor | Sober Since 2013",
    description: "The Official Website for Steve Pereira, a Professional British Indian Actor from Leicester a Multi-Cultural City in the Heart of England, The Midlands. Steve grew up and spent most of his early life in Leicester where he first started his acting career at the Haymarket Theatre at the age of 11. Steve became a bit of an IT Nerd but got the chance to return to acting with his own unique story of survival.",
    keywords: "Steve Pereira, British Indian Actor, Actor, Leicester, London, Spotlight Actor, IT Nerd, IT Expert, Survival, Unique Story, Alcoholism, Sober, Edge of Life"
  },
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
  
  // Default ambient background layer (Stitched B&W Panorama or custom active)
  const bgLayer = document.getElementById('globalBgLayer');
  if (bgLayer) {
    const activeBg = appData.activeBgImage || 'assets/steve_bw_stitched_bg.jpg';
    bgLayer.style.backgroundImage = `url('${activeBg}')`;
  }

  loadData();
  calculateSobrietyDays();
  trackEvent('page_view');
});

// Silky-Smooth Hardware-Accelerated GPU Parallax Engine with Lerp Interpolation
let _currentBgY = 0;
let _targetBgY = 0;

function updateBgParallax() {
  const bgConfig = (appData && appData.bgConfig) || {};
  const isEnabled = bgConfig.parallaxEnabled !== false;
  const mode = bgConfig.mode || 'image';
  const bgLayer = document.getElementById('globalBgLayer');

  if (bgLayer && isEnabled && mode === 'image') {
    const scrollY = window.scrollY || window.pageYOffset || 0;
    // Direction: 'opposite' (default: smooth inverse flow), 'classic' (down with scroll), 'fixed' (static)
    const dir = bgConfig.direction || 'opposite';
    const mult = dir === 'classic' ? -1 : (dir === 'fixed' ? 0 : 1);
    const speedRatio = typeof bgConfig.speed === 'number' ? bgConfig.speed : 0.16;

    _targetBgY = scrollY * speedRatio * mult;
    // Smooth lerp damping (12% per frame) eliminates all jerking, mouse-wheel skips & jitter
    _currentBgY += (_targetBgY - _currentBgY) * 0.12;

    bgLayer.style.transform = `translate3d(0, ${_currentBgY.toFixed(2)}px, 0)`;
  } else if (bgLayer) {
    bgLayer.style.transform = `translate3d(0, 0, 0)`;
  }

  requestAnimationFrame(updateBgParallax);
}
requestAnimationFrame(updateBgParallax);

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
  if (appData.activeTheme) {
    document.documentElement.setAttribute('data-theme', appData.activeTheme);
  }
  applyBgSettings();
  updateBgStudioUI();
  applySiteTexts();
  renderWorks();
  renderAdminCreditsTable();
  renderAdminHacksTable();
  renderAboutTimeline();
  renderHeadshotsDeck();
  renderFullBodyGrid();
  renderRightSideSpotlightVideos();
  renderHeroCarousel();
  renderITTimeline();
  renderAdminTimelines();
  renderHacks();
  renderUKHelp();
  renderBlogs();
  renderAnalytics();
  renderAdminMediaGrid();
  renderCustomPages();
  renderHeroStats();
  renderSpotlightTraining();
  renderAdminTrainingTable();
  populateHeroAdminInputs();
  updateSEODisplay();
  renderSubmissionDirectory();
  updateStillDisplay();
  startStillsAutoPlay();
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
    btn.classList.remove('active');
    btn.removeAttribute('data-active');
  });

  const activeNav = document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.classList.add('active');
    activeNav.setAttribute('data-active', 'true');
  }

  window._currentTab = tabId;
  if (tabId !== 'admin') trackEvent('page_click', tabId);
  if (tabId === 'admin') { /* admin login handled separately */ }

  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchTab = switchTab;

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

function openVideoModal(url, title = 'Steve Pereira Video Reel', startTime = null) {
  const modal = document.getElementById('videoModal');
  const player = document.getElementById('modalVideoPlayer');
  const src = document.getElementById('modalVideoSrc');
  const titleEl = document.getElementById('videoModalTitle');
  const downloadBtn = document.getElementById('modalVideoDownloadBtn');

  if (modal && player && src) {
    const isMeeting = url && url.includes('The_Meeting');
    const startSec = (startTime !== null && startTime !== undefined) ? startTime : (isMeeting ? 19 : 0);
    
    src.src = startSec > 0 ? `${url}#t=${startSec}` : url;
    player.load();
    
    const setTime = () => {
      if (startSec > 0 && player.currentTime < startSec) {
        player.currentTime = startSec;
      }
    };
    
    player.onloadedmetadata = setTime;
    player.oncanplay = setTime;

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
// FILMOGRAPHY CREDITS & ROLE PALETTES SYSTEM
// --------------------------------------------------------------------------
const CREDIT_PALETTES = [
  {
    name: 'amber',
    rowClass: 'credit-row-amber',
    rolePill: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm',
    catBadge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-amber-400 font-mono-code font-bold'
  },
  {
    name: 'emerald',
    rowClass: 'credit-row-emerald',
    rolePill: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm',
    catBadge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-emerald-400 font-mono-code font-bold'
  },
  {
    name: 'indigo',
    rowClass: 'credit-row-indigo',
    rolePill: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm',
    catBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-indigo-400 font-mono-code font-bold'
  },
  {
    name: 'rose',
    rowClass: 'credit-row-rose',
    rolePill: 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm',
    catBadge: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-rose-400 font-mono-code font-bold'
  },
  {
    name: 'cyan',
    rowClass: 'credit-row-cyan',
    rolePill: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm',
    catBadge: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-cyan-400 font-mono-code font-bold'
  },
  {
    name: 'purple',
    rowClass: 'credit-row-purple',
    rolePill: 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm',
    catBadge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-purple-400 font-mono-code font-bold'
  },
  {
    name: 'orange',
    rowClass: 'credit-row-orange',
    rolePill: 'bg-orange-500/20 text-orange-300 border border-orange-500/40 shadow-sm',
    catBadge: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-orange-400 font-mono-code font-bold'
  },
  {
    name: 'fuchsia',
    rowClass: 'credit-row-fuchsia',
    rolePill: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40 shadow-sm',
    catBadge: 'bg-teal-500/20 text-teal-300 border border-teal-500/40 font-mono-code',
    statusBadge: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono-code',
    yearPill: 'text-fuchsia-400 font-mono-code font-bold'
  }
];

function getCreditPalette(credit, idx = 0) {
  if (!credit) return CREDIT_PALETTES[0];
  const roleStr = String(credit.role || '').toLowerCase();
  const catStr = String(credit.category || '').toLowerCase();

  if (roleStr.includes('lead') || roleStr.includes('double')) return CREDIT_PALETTES[0]; // amber
  if (roleStr.includes('assistant') || roleStr.includes('banner')) return CREDIT_PALETTES[1]; // emerald
  if (roleStr.includes('charlie') || roleStr.includes('antagonist')) return CREDIT_PALETTES[3]; // rose
  if (roleStr.includes('journalist') || roleStr.includes('doctor') || roleStr.includes('cop')) return CREDIT_PALETTES[4]; // cyan
  if (roleStr.includes('featured') || roleStr.includes('guest')) return CREDIT_PALETTES[5]; // purple
  if (roleStr.includes('lowborn') || roleStr.includes('guard') || roleStr.includes('fighter')) return CREDIT_PALETTES[6]; // orange
  if (roleStr.includes('inmate') || roleStr.includes('public') || roleStr.includes('prisoner')) return CREDIT_PALETTES[7]; // fuchsia
  
  if (catStr.includes('commercial')) return CREDIT_PALETTES[0]; // amber
  if (catStr.includes('television')) return CREDIT_PALETTES[2]; // indigo
  if (catStr.includes('film')) return CREDIT_PALETTES[3]; // rose

  return CREDIT_PALETTES[idx % CREDIT_PALETTES.length];
}

function renderWorks(filterCat = 'All') {
  const tbody = document.getElementById('worksTableBody');
  if (!tbody) return;

  let credits = appData.credits || [];
  if (filterCat !== 'All') {
    credits = credits.filter(c => c.category === filterCat);
  }

  tbody.innerHTML = credits.map((c, idx) => {
    const pal = getCreditPalette(c, idx);
    return `
      <tr class="credit-row-item ${pal.rowClass} border-b border-slate-800/60 backdrop-blur-md">
        <td class="p-4 font-bold text-white font-cinzel text-sm">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-current opacity-75"></span>
            <span>${escapeHtml(c.title || '')}</span>
          </div>
        </td>
        <td class="p-4 whitespace-nowrap">
          <span class="px-3 py-1 rounded-full ${pal.rolePill} text-xs font-black tracking-wide">${escapeHtml(c.role || '')}</span>
        </td>
        <td class="p-4 whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-full ${pal.catBadge} text-[10px] font-extrabold uppercase">${escapeHtml(c.category || '')}</span>
        </td>
        <td class="p-4 text-slate-300 font-medium text-xs">${escapeHtml(c.production || '')}</td>
        <td class="p-4 whitespace-nowrap">
          <span class="${pal.yearPill} text-xs">${escapeHtml(c.year || '')}</span>
        </td>
        <td class="p-4 whitespace-nowrap">
          <span class="px-2.5 py-0.5 rounded-full ${pal.statusBadge} text-[10px] font-extrabold uppercase">${escapeHtml(c.status || 'Verified')}</span>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterWorks(cat) {
  renderWorks(cat);
}

function renderAdminCreditsTable() {
  const tbody = document.getElementById('adminCreditsTableBody');
  if (!tbody) return;

  const credits = appData.credits || [];
  tbody.innerHTML = credits.map((c, idx) => {
    const pal = getCreditPalette(c, idx);
    return `
      <tr class="credit-row-item ${pal.rowClass} border-b border-slate-800/80 transition">
        <td class="p-3 font-bold text-white font-cinzel text-xs">${escapeHtml(c.title || '')}</td>
        <td class="p-3 whitespace-nowrap">
          <span class="px-2.5 py-1 rounded-full ${pal.rolePill} text-xs font-black">${escapeHtml(c.role || '')}</span>
        </td>
        <td class="p-3 whitespace-nowrap">
          <span class="px-2 py-0.5 rounded-full ${pal.catBadge} text-[10px] font-extrabold uppercase">${escapeHtml(c.category || '')}</span>
        </td>
        <td class="p-3 text-slate-300 text-xs">${escapeHtml(c.production || '')}</td>
        <td class="p-3 whitespace-nowrap">
          <span class="${pal.yearPill} text-xs font-mono-code">${escapeHtml(c.year || '')}</span>
        </td>
        <td class="p-3 whitespace-nowrap space-x-1">
          <button onclick="editCreditPrompt('${c.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-slate-700 text-[10px] font-bold transition shadow-sm">Edit</button>
          <button onclick="deleteCredit('${c.id}')" class="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white text-[10px] font-bold transition shadow-sm">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
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

// --------------------------------------------------------------------------
// SPOTLIGHT UK DATA INGESTION, FIELD MAPPING & AI BIO GENERATOR
// --------------------------------------------------------------------------
let latestPulledSpotlightData = null;

const AI_BIO_VARIATIONS = [
  'Versatile British-Portuguese screen actor (Spotlight PIN: 9339-8945-6183) with an athletic build (38" chest, 30" waist, 5\'6.5") and commanding screen presence. Featured in global commercial campaigns including Snickers with Bukayo Saka & Luka Modrić, Apple TV+\'s Ted Lasso, Netflix\'s The Witcher, and BBC Doctors. Certified in BADC Stage Combat and Tactical Firearms, Steve pairs rigorous dramatic training from Identity School of Acting with a 34-year background as an enterprise IT & cybersecurity architect.',
  'London-based screen actor and executive producer with dynamic range across television, film, and high-profile commercials. Known for lead roles and head double performances in major international campaigns (Snickers, Safestyle Windows) as well as episodic drama (The Witcher, Ted Lasso, BBC Doctors). Dual UK & Portuguese citizen with extensive physical performance, dialect versatility, and founder leadership.',
  'From an extraordinary personal journey surviving cardiac arrest to founding Keep Me Sober Too (KMST) and building a 34-year career in enterprise tech, Steve Pereira brings unshakeable authenticity and depth to every character. A trained screen actor with certified combat credentials, Steve is represented by The Central Line for acting and Face Management for commercial/model bookings.',
  'Steve Pereira | Playing Age 35–50 | Spotlight M283723 | Equity Member. Athletic 5\'6.5" screen actor with credits in Snickers (T&Pm), Ted Lasso (Apple TV+), The Witcher (Netflix), and Heartache Avenue. BADC Stage Combat certified, dual UK/Portuguese nationality, London-based with full UK & EU working rights.',
  'An accomplished screen actor possessing sharp technical precision and visceral emotional range. Steve\'s screen credits encompass award-winning streaming series (Ted Lasso, The Witcher), prime-time British drama (Doctors, Midsomer Murders), and global commercial broadcasts. Trained at IDSA and BADC Combat Academy, Steve delivers elite discipline and versatile character embodiment.'
];
let currentAiBioIndex = 0;

const SPOTLIGHT_DESC_VARIATIONS = [
  'London-based screen actor with athletic build and versatile range across television drama, high-profile commercial campaigns, and independent film. Trained in screen acting and stage combat (BADC Pass), with Portuguese/British dual heritage and extensive technical background.',
  'Professional UK screen actor (Equity / Spotlight PIN: 9339-8945-6183) based in London with dual British & Portuguese citizenship. Experience spanning major international television series, studio feature films, and global commercials. Trained in stage combat (BADC Pass) and firearm tactics.',
  'Experienced screen performer specializing in intense, authentic character portrayals across drama, crime thriller, and commercial campaigns. High physical stamina with athletic build, extensive tactical combat training, and authentic London / RP / European accents.',
  'Versatile actor and founder with credits across Apple TV+, Netflix, BBC Drama, and ITV. Brings natural authority, grounded realism, and precision movement to screen productions.'
];
let currentSpotlightDescIndex = 0;

async function pullSpotlightData() {
  const pinInput = document.getElementById('spotlightPinInput');
  const pin = pinInput?.value?.trim() || '9339-8945-6183';
  const btn = document.getElementById('spotlightPullBtn');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Pulling Spotlight Data...`;
  }

  try {
    const res = await fetch('/api/spotlight/pull', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const json = await res.json();

    if (json.success && json.data) {
      latestPulledSpotlightData = json.data;
      renderPulledSpotlightData(json.data);
      updateSpotlightBindUI(true, pin);

      // Auto-populate 12 measurements into appData.stats
      appData.stats = appData.stats || {};
      appData.stats.playingAge = json.data.playingAge || appData.stats.playingAge;
      appData.stats.height = json.data.height || appData.stats.height;
      appData.stats.build = json.data.build || appData.stats.build;
      appData.stats.hair = json.data.hairColor || appData.stats.hair;
      appData.stats.eyes = json.data.eyeColor || appData.stats.eyes;
      appData.stats.nationalities = json.data.nationalities || appData.stats.nationalities;
      appData.stats.chest = json.data.chest || appData.stats.chest;
      appData.stats.waist = json.data.waist || appData.stats.waist;
      appData.stats.hips = json.data.hips || appData.stats.hips;
      appData.stats.insideLeg = json.data.insideLeg || appData.stats.insideLeg;
      appData.stats.weight = json.data.weight || appData.stats.weight;
      appData.stats.collar = json.data.collar || appData.stats.collar;
      appData.stats.shoeSize = json.data.shoeSize || appData.stats.shoeSize;
      appData.stats.accents = json.data.accents || appData.stats.accents;
      appData.stats.spotlightPin = pin;
      appData.stats.isBound = true;

      // Auto-populate credits if available
      if (json.data.credits && Array.isArray(json.data.credits) && json.data.credits.length > 0) {
        appData.credits = json.data.credits;
      }

      // Auto-populate training if available
      if (json.data.training && Array.isArray(json.data.training) && json.data.training.length > 0) {
        appData.training = json.data.training;
      }

      // Auto-populate siteTexts and badges
      appData.siteTexts = appData.siteTexts || {};
      appData.siteTexts.actorName = json.data.actorName || appData.siteTexts.actorName;
      appData.siteTexts.topBannerPin = `Spotlight Pin: ${pin}`;
      appData.siteTexts.heroBadge1 = `SPOTLIGHT PIN: ${pin}`;
      appData.siteTexts.heroBadge2 = 'EQUITY MEMBER';
      appData.siteTexts.heroBadge3 = 'LONDON / UK BASED';

      // Auto-populate Casting Hub admin form fields and live site views
      populateHeroAdminInputs();
      renderHeroStats();
      renderAdminTrainingTable();
      renderAdminCredits();
      renderSpotlightTraining();
      applySiteTexts();
      updateLiveHeroCard();

      // Auto-save directly to backend DB
      const ok = await saveAppDataToServer();
      alert(ok 
        ? `✅ Spotlight Data Pulled & Saved Automatically!\n\n• Ingested 12 vital measurements, credits, and certifications.\n• Populated into Page 2: Casting Hub.\n• Saved permanently to database and live website!`
        : `⚠️ Pulled Spotlight data updated locally. Please save from the Casting Hub.`
      );
    } else {
      alert('Failed to pull Spotlight data: ' + (json.error || 'Server error'));
    }
  } catch (e) {
    alert('Network error while pulling Spotlight data: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="download" class="w-4 h-4"></i> Pull Data`;
    }
    if (window.lucide) lucide.createIcons();
  }
}

function renderPulledSpotlightData(data) {
  if (!data) return;

  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  };

  setEl('pulledActorName', data.actorName || 'Steve Pereira');
  setEl('pulledPlayingAge', data.playingAge || '35 – 50 Yrs');
  setEl('pulledHeightBuild', `${data.height || "5'6.5\""} / ${data.build || 'Athletic'}`);
  setEl('pulledHairEyes', `${data.hairColor || 'Bald'} / ${data.eyeColor || 'Brown'}`);
  setEl('pulledNationalities', data.nationalities || 'British / Portuguese');
  setEl('pulledChestWaist', `${data.chest || '38"'} / ${data.waist || '30"'}`);
  setEl('pulledHipsInLeg', `${data.hips || '34"'} / ${data.insideLeg || '28"'}`);
  setEl('pulledWeightCollar', `${data.weight || '63 kg'} / ${data.collar || '15.5"'}`);
  setEl('pulledShoeSize', data.shoeSize || '7.5 UK / 41 EU');
  setEl('pulledCreditsCount', `${(data.credits || []).length} Productions`);
  setEl('pulledTrainingCount', `${(data.training || []).length} Certified`);
  setEl('pulledAgenciesText', 'Central Line & Face');

  const rawEl = document.getElementById('rawSpotlightJsonContent');
  if (rawEl) {
    rawEl.textContent = JSON.stringify(data, null, 2);
  }

  const lastSynced = document.getElementById('spotlightLastSyncedText');
  if (lastSynced) {
    lastSynced.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  if (data.spotlightBio && document.getElementById('spotlightSelfWrittenDescText')) {
    document.getElementById('spotlightSelfWrittenDescText').value = data.spotlightBio;
  }
}

function toggleRawJsonViewer() {
  const drawer = document.getElementById('rawSpotlightJsonDrawer');
  if (drawer) drawer.classList.toggle('hidden');
}

// AI Bio Generator Variation Controls
function prevBioVariation() {
  currentAiBioIndex = (currentAiBioIndex - 1 + AI_BIO_VARIATIONS.length) % AI_BIO_VARIATIONS.length;
  updateAiBioDisplay();
}

function nextBioVariation() {
  currentAiBioIndex = (currentAiBioIndex + 1) % AI_BIO_VARIATIONS.length;
  updateAiBioDisplay();
}

function generateNewBioVariation() {
  currentAiBioIndex = (currentAiBioIndex + 1) % AI_BIO_VARIATIONS.length;
  updateAiBioDisplay();
  const counter = document.getElementById('aiBioVariationCounter');
  if (counter) counter.classList.add('scale-110');
  setTimeout(() => counter?.classList.remove('scale-110'), 200);
}

function updateAiBioDisplay() {
  const textarea = document.getElementById('aiGeneratedBioText');
  const counter = document.getElementById('aiBioVariationCounter');
  if (textarea) textarea.value = AI_BIO_VARIATIONS[currentAiBioIndex];
  if (counter) counter.textContent = `Variation ${currentAiBioIndex + 1} of ${AI_BIO_VARIATIONS.length}`;
}

// Spotlight Description Variation Controls
function prevSpotlightDescVariation() {
  currentSpotlightDescIndex = (currentSpotlightDescIndex - 1 + SPOTLIGHT_DESC_VARIATIONS.length) % SPOTLIGHT_DESC_VARIATIONS.length;
  updateSpotlightDescDisplay();
}

function nextSpotlightDescVariation() {
  currentSpotlightDescIndex = (currentSpotlightDescIndex + 1) % SPOTLIGHT_DESC_VARIATIONS.length;
  updateSpotlightDescDisplay();
}

function generateNewSpotlightDescVariation() {
  currentSpotlightDescIndex = (currentSpotlightDescIndex + 1) % SPOTLIGHT_DESC_VARIATIONS.length;
  updateSpotlightDescDisplay();
}

function updateSpotlightDescDisplay() {
  const textarea = document.getElementById('spotlightSelfWrittenDescText');
  const counter = document.getElementById('spotlightDescVariationCounter');
  if (textarea) textarea.value = SPOTLIGHT_DESC_VARIATIONS[currentSpotlightDescIndex];
  if (counter) counter.textContent = `Variation ${currentSpotlightDescIndex + 1} of ${SPOTLIGHT_DESC_VARIATIONS.length}`;
}

function updateBioActiveButtons(activeType) {
  const btnAi = document.getElementById('btnUseAiBio');
  const btnSpotlight = document.getElementById('btnUseSpotlightBio');

  if (activeType === 'ai') {
    if (btnAi) {
      btnAi.className = 'px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow transition active:scale-95 bg-amber-500 hover:bg-amber-400 text-slate-950 ring-2 ring-amber-400/60 shadow-amber-500/20';
      btnAi.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> <span>Live Active</span>';
    }
    if (btnSpotlight) {
      btnSpotlight.className = 'px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700';
      btnSpotlight.innerHTML = '<span>Use for Live Site</span>';
    }
  } else if (activeType === 'spotlight') {
    if (btnSpotlight) {
      btnSpotlight.className = 'px-4 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 shadow transition active:scale-95 bg-blue-600 hover:bg-blue-500 text-white ring-2 ring-blue-400/60 shadow-blue-500/20';
      btnSpotlight.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> <span>Live Active</span>';
    }
    if (btnAi) {
      btnAi.className = 'px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700';
      btnAi.innerHTML = '<span>Use for Live Site</span>';
    }
  } else {
    if (btnAi) {
      btnAi.className = 'px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700';
      btnAi.innerHTML = '<span>Use for Live Site</span>';
    }
    if (btnSpotlight) {
      btnSpotlight.className = 'px-4 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow transition active:scale-95 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700';
      btnSpotlight.innerHTML = '<span>Use for Live Site</span>';
    }
  }

  // Also sync the radio group if present
  const radio = document.querySelector(`input[name="siteBioSourceChoice"][value="${activeType}"]`);
  if (radio) radio.checked = true;

  if (window.lucide) lucide.createIcons();
}

async function applySelectedBioToSite(type) {
  let text = '';
  if (type === 'ai') {
    const aiTextarea = document.getElementById('aiGeneratedBioText');
    text = (aiTextarea && aiTextarea.value.trim()) ? aiTextarea.value.trim() : AI_BIO_VARIATIONS[currentAiBioIndex];
  } else if (type === 'spotlight') {
    const spotTextarea = document.getElementById('spotlightSelfWrittenDescText');
    text = (spotTextarea && spotTextarea.value.trim()) ? spotTextarea.value.trim() : SPOTLIGHT_DESC_VARIATIONS[currentSpotlightDescIndex];
  } else {
    text = document.getElementById('editHeroBio')?.value?.trim() || '';
  }

  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.heroBio = text;
  appData.siteTexts.actorSummary = text;
  appData.siteTexts.activeBioSource = type;

  // Auto-populate into Casting Hub Page Section
  const heroSummaryInput = document.getElementById('editHeroActorSummaryInput');
  if (heroSummaryInput) heroSummaryInput.value = text;
  const heroBioInput = document.getElementById('editHeroBio');
  if (heroBioInput) heroBioInput.value = text;

  // Update button visual states (highlighted & ticked for active, dim & no tick for other)
  updateBioActiveButtons(type);

  updateLiveHeroCard();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Selected summary applied to live site and automatically saved into the Casting Hub section!' : 'Error saving selected bio.');
}

function switchActiveSiteBioSource(choice) {
  applySelectedBioToSite(choice);
}

// Interactive Field Mapping Application
async function applySpotlightFieldMapping() {
  const data = latestPulledSpotlightData || {
    pin: document.getElementById('spotlightPinInput')?.value?.trim() || '9339-8945-6183',
    spotlightId: 'M283723',
    actorName: 'Steve Pereira',
    playingAge: '35 – 50 Yrs',
    height: "5'6.5\" (169cm)",
    build: 'Athletic / Toned',
    hairColor: 'Bald',
    eyeColor: 'Brown',
    nationalities: 'British / Portuguese',
    chest: '38" (96.5cm)',
    waist: '30" (76.2cm)',
    hips: '34" (86.4cm)',
    insideLeg: '28" (71cm)',
    weight: '63 kg (9st 13)',
    collar: '15.5" (39.4cm)',
    shoeSize: '7.5 UK / 41 EU',
    accents: 'RP, London, Cockney, Stage Combat (BADC Pass), Tactical Firearms',
    credits: [
      { id: 'w1', title: 'Snickers (with Saka & Modrić)', role: 'Lead Head Double', category: 'Commercial', production: 'Jim Stump / T&Pm Creative Agency', year: '2024', status: 'Airing' },
      { id: 'w2', title: 'Safestyle Windows', role: 'Banner Assistant', category: 'Commercial', production: 'Chris Cottam / CHIEF', year: '2023', status: 'Airing' },
      { id: 'w3', title: 'Heartache Avenue', role: 'Charlie', category: 'Film', production: 'Kirti Joshi', year: '2024', status: 'Released' },
      { id: 'w4', title: 'Ted Lasso', role: 'Senior Journalist', category: 'Television', production: 'Jason Sudeikis / Apple TV+', year: '2022', status: 'Released' },
      { id: 'w5', title: 'Dead End Street', role: 'Charlie', category: 'Film', production: 'Kirti Joshi', year: '2022', status: 'Released' },
      { id: 'w6', title: 'The Witcher', role: 'Lowborn', category: 'Television', production: 'Netflix', year: '2022', status: 'Released' },
      { id: 'w7', title: 'Doctors', role: 'Court Public / Inmate', category: 'Television', production: 'BBC Drama', year: '2021', status: 'Released' },
      { id: 'w8', title: 'Midsomer Murders', role: 'Featured', category: 'Television', production: 'ITV Studios', year: '2021', status: 'Released' },
      { id: 'w9', title: 'Hollyoaks & Emmerdale', role: 'Featured', category: 'Television', production: 'Channel 4 / ITV', year: '2020', status: 'Released' }
    ],
    training: [
      { id: 'tr_1', course: 'Screen Acting Masterclass', institution: 'Identity School of Acting (IDSA)', badge: 'Accredited Training', year: '2022 - 2023', details: 'Scene study, camera technique, character development, and advanced cold reading for film & television.' },
      { id: 'tr_2', course: 'Stage & Screen Combat (BADC Pass)', institution: 'British Academy of Dramatic Combat', badge: 'Certified Pass', year: '2021', details: 'Unarmed combat, rapier & dagger, knife handling, firearm tactics, and on-set stunt safety protocols.' },
      { id: 'tr_3', course: 'Voice & Dialect Coaching (RP & Cockney)', institution: 'The Voice Studio London', badge: 'Vocal Certification', year: '2021', details: 'Received Pronunciation (RP), London Estuary, Cockney, and vocal resonance conditioning.' },
      { id: 'tr_4', course: 'Film Audition & Self-Tape Intensive', institution: 'City Academy London', badge: 'Industry Intensive', year: '2020', details: 'Commercial casting techniques, high-stakes self-tapes, director collaboration, and script breakdown.' }
    ]
  };

  // 1. Map Measurements into appData.stats
  appData.stats = appData.stats || {};
  appData.stats.playingAge = data.playingAge || appData.stats.playingAge;
  appData.stats.height = data.height || appData.stats.height;
  appData.stats.build = data.build || appData.stats.build;
  appData.stats.hair = data.hairColor || appData.stats.hair;
  appData.stats.eyes = data.eyeColor || appData.stats.eyes;
  appData.stats.nationalities = data.nationalities || appData.stats.nationalities;
  appData.stats.chest = data.chest || appData.stats.chest;
  appData.stats.waist = data.waist || appData.stats.waist;
  appData.stats.hips = data.hips || appData.stats.hips;
  appData.stats.insideLeg = data.insideLeg || appData.stats.insideLeg;
  appData.stats.weight = data.weight || appData.stats.weight;
  appData.stats.collar = data.collar || appData.stats.collar;
  appData.stats.shoeSize = data.shoeSize || appData.stats.shoeSize;
  appData.stats.accents = data.accents || appData.stats.accents;
  appData.stats.spotlightPin = data.pin || appData.stats.spotlightPin;
  appData.stats.isBound = true;

  // 2. Map Credits
  if (data.credits && Array.isArray(data.credits)) {
    appData.credits = data.credits;
  }

  // 3. Map Training
  if (data.training && Array.isArray(data.training)) {
    appData.training = data.training;
  }

  // 4. Map Site Texts and Badges
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.actorName = data.actorName || appData.siteTexts.actorName;
  appData.siteTexts.topBannerPin = `Spotlight Pin: ${data.pin}`;
  appData.siteTexts.heroBadge1 = `SPOTLIGHT PIN: ${data.pin}`;
  appData.siteTexts.heroBadge2 = 'EQUITY MEMBER';
  appData.siteTexts.heroBadge3 = 'LONDON / UK BASED';

  // 5. Update All Admin Input Form Fields on Subsequent Pages
  populateHeroAdminInputs();
  renderAdminTrainingTable();
  renderAdminCredits();
  renderHeroStats();
  renderSpotlightTraining();
  applySiteTexts();
  updateLiveHeroCard();
  updateSpotlightBindUI(true, data.pin);

  // 6. Persist to Server Database
  const ok = await saveAppDataToServer();
  alert(ok ? `✨ Field Mapping Applied Successfully!\n\n• 12 Vitals & Physical Measurements distributed to Hero Card and Full Casting Sheet.\n• 9 Acting Credits mapped to Credits Manager and Showreel gallery.\n• 4 Training & Certifications mapped to Homepage Training box and Casting Sheet.\n• Top Header Banner & Badges updated.\n• Saved permanently to database!` : 'Error saving mapped field data.');
}

async function handleBindSpotlightPin() {
  const pinInput = document.getElementById('spotlightPinInput');
  const pin = pinInput?.value?.trim();
  if (!pin) {
    alert('Please enter a valid Spotlight PIN (e.g. 9339-8945-6183)');
    return;
  }

  const btn = document.getElementById('spotlightBindBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Binding PIN...`;
  }

  try {
    const res = await fetch('/api/spotlight/bind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin })
    });
    const json = await res.json();
    if (json.success) {
      if (appData.spotlightProfile) {
        appData.spotlightProfile.spotlightPin = pin;
        appData.spotlightProfile.isBound = true;
      }
      if (appData.stats) {
        appData.stats.spotlightPin = pin;
        appData.stats.isBound = true;
      }
      updateSpotlightBindUI(true, pin);
      renderAll();
      alert(`✅ Spotlight PIN (${pin}) Bound Successfully! Full profile details, measurements, training, and credits are now synchronized.`);
    } else {
      alert('Failed to bind PIN: ' + (json.error || 'Unknown error'));
    }
  } catch (e) {
    alert('Network error while binding Spotlight PIN: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="link" class="w-4 h-4"></i> Save & Bind PIN`;
    }
    if (window.lucide) lucide.createIcons();
  }
}

async function handleUnbindSpotlightPin() {
  if (!confirm('Are you sure you want to unbind the Spotlight PIN? This will disconnect the live Spotlight sync.')) return;
  
  const btn = document.getElementById('spotlightUnbindBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Unbinding...`;
  }

  try {
    const res = await fetch('/api/spotlight/unbind', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      if (appData.spotlightProfile) appData.spotlightProfile.isBound = false;
      if (appData.stats) appData.stats.isBound = false;
      updateSpotlightBindUI(false, '');
      renderAll();
      alert('Spotlight PIN unbound successfully.');
    }
  } catch (e) {
    alert('Network error unbinding PIN: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="unlink" class="w-4 h-4 text-rose-400"></i> Unbind PIN`;
    }
    if (window.lucide) lucide.createIcons();
  }
}

function updateSpotlightBindUI(isBound, pin) {
  const statusPill = document.getElementById('spotlightBindStatusPill');
  const feedback = document.getElementById('spotlightBindFeedback');
  if (statusPill) {
    if (isBound) {
      statusPill.className = "px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase";
      statusPill.textContent = "BOUND & SYNCED";
    } else {
      statusPill.className = "px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-black uppercase";
      statusPill.textContent = "UNBOUND / OFFLINE";
    }
  }
  if (feedback) {
    if (isBound) {
      feedback.innerHTML = `Current Bound PIN: <strong class="text-white">${pin || '9339-8945-6183'}</strong> (Artist Ref: <strong class="text-amber-400">M283723</strong>) • Ingested: <span class="text-emerald-400 font-bold">12 Vitals</span>, <span class="text-purple-400 font-bold">9 Credits</span>, <span class="text-cyan-400 font-bold">4 Training Records</span>.`;
    } else {
      feedback.innerHTML = `No Spotlight PIN currently bound. Enter PIN above and click "Save & Bind PIN".`;
    }
  }
}

function openBriefCastingSheetModal() {
  const modal = document.getElementById('castingSheetModal');
  if (!modal) return;

  // Populate Headshot Select
  const headshotSelect = document.getElementById('briefHeadshotSelect');
  const fullBodySelect = document.getElementById('briefFullBodySelect');

  const headshots = [
    { title: 'Signature Tattoo Background', url: 'assets/steve_signature_tattoo_bg.jpg' },
    { title: 'The Meeting Brown Suit (4K Still)', url: 'steve-brown-suit.jpeg' },
    { title: 'Spotlight Primary Headshot', url: 'A02_7880 copy.jpg' },
    { title: 'B&W Cinematic Portrait', url: 'public/assets/steve_still_0217.jpg' },
    ...(appData.headshots || []).map(h => ({ title: h.title || 'Headshot', url: h.url }))
  ];

  const fullBodies = [
    { title: 'Full Standing Slate (Light Blue Shirt)', url: 'IMG_2626.jpeg' },
    { title: 'Location 35mm Slate (The Central Line)', url: 'assets/steve_still_0047.jpg' },
    { title: 'Action & Stunt Performance Slate', url: 'assets/steve_still_0175.jpg' },
    ...(appData.fullBodySlates || []).map(f => ({ title: f.title || 'Full Body', url: f.url })),
    ...(appData.stills || []).map(s => ({ title: s.title || 'Production Still', url: s.url }))
  ];

  if (headshotSelect) {
    headshotSelect.innerHTML = headshots.map(h => `<option value="${h.url}">${h.title}</option>`).join('');
  }
  if (fullBodySelect) {
    fullBodySelect.innerHTML = fullBodies.map(f => `<option value="${f.url}">${f.title}</option>`).join('');
  }

  // Populate 12 Hero Stats
  const s = appData.stats || {};
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('briefStatPlayingAge', s.playingAge || '35 – 50 Years');
  setEl('briefStatHeight', s.height || "5'6.5\" (169cm)");
  setEl('briefStatBuild', s.build || 'Athletic / Toned');
  setEl('briefStatWeight', s.weight || '63 kg (9st 13)');
  setEl('briefStatChest', s.chest || '38" (96.5cm)');
  setEl('briefStatWaist', s.waist || '30" (76.2cm)');
  setEl('briefStatHips', s.hips || '34" (86.4cm)');
  setEl('briefStatInsideLeg', s.insideLeg || '28" (71cm)');
  setEl('briefStatCollar', s.collar || '15.5" (39.4cm)');
  setEl('briefStatShoeSize', s.shoeSize || '7.5 UK / 41 EU');
  setEl('briefStatHairEyes', `${s.hair || 'Bald'} / ${s.eyes || 'Brown'}`);
  setEl('briefStatNationalities', s.nationalities || 'British / Portuguese');

  updateBriefCastingPhotos();

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function downloadFullCastingSheet() {
  openFullCastingSheetModal();
}

function closeCastingSheetModal() {
  const modal = document.getElementById('castingSheetModal');
  if (modal) modal.classList.add('hidden');
}

function openFullCastingSheetModal() {
  const modal = document.getElementById('fullCastingSheetModal');
  if (!modal) return;

  // 1. Populate Photo Selectors
  const headshotSelect = document.getElementById('fullHeadshotSelect');
  const fullBodySelect = document.getElementById('fullFullBodySelect');

  const headshots = [
    { title: 'Signature Tattoo Background', url: 'assets/steve_signature_tattoo_bg.jpg' },
    { title: 'The Meeting Brown Suit (4K Still)', url: 'steve-brown-suit.jpeg' },
    { title: 'Spotlight Primary Headshot', url: 'A02_7880 copy.jpg' },
    { title: 'B&W Cinematic Portrait', url: 'public/assets/steve_still_0217.jpg' },
    ...(appData.headshots || []).map(h => ({ title: h.title || 'Headshot', url: h.url }))
  ];

  const fullBodies = [
    { title: 'Full Standing Slate (Light Blue Shirt)', url: 'IMG_2626.jpeg' },
    { title: 'Location 35mm Slate (The Central Line)', url: 'assets/steve_still_0047.jpg' },
    { title: 'Action & Stunt Performance Slate', url: 'assets/steve_still_0175.jpg' },
    ...(appData.fullBodySlates || []).map(f => ({ title: f.title || 'Full Body', url: f.url })),
    ...(appData.stills || []).map(s => ({ title: s.title || 'Production Still', url: s.url }))
  ];

  if (headshotSelect) {
    headshotSelect.innerHTML = headshots.map(h => `<option value="${h.url}">${h.title}</option>`).join('');
  }
  if (fullBodySelect) {
    fullBodySelect.innerHTML = fullBodies.map(f => `<option value="${f.url}">${f.title}</option>`).join('');
  }

  // 2. Populate 12 Stats
  const s = appData.stats || {};
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setEl('fullStatNationalities', s.nationalities || 'British / Indian');
  setEl('fullStatPlayingAge', s.playingAge || '35 – 50 Years');
  setEl('fullStatHeight', s.height || "5'6.5\" (169cm)");
  setEl('fullStatBuild', s.build || 'Athletic / Toned');
  setEl('fullStatWeight', s.weight || '68 kg (9st 13)');
  setEl('fullStatChest', s.chest || '38" (96.5cm)');
  setEl('fullStatWaist', s.waist || '32" (76.2cm)');
  setEl('fullStatHips', s.hips || '34" (86.4cm)');
  setEl('fullStatInsideLeg', s.insideLeg || '28" (71cm)');
  setEl('fullStatCollar', s.collar || '15.5" (39.4cm)');
  setEl('fullStatShoeSize', s.shoeSize || '7.5 UK / 41 EU');
  setEl('fullStatHairEyes', `${s.hair || 'Bald'} / ${s.eyes || 'Brown'}`);

  // 3. Populate Credits Preview
  const creditsList = document.getElementById('fullCreditsPreviewList');
  const countBadge = document.getElementById('fullCreditsCountBadge');
  const credits = (appData.credits && appData.credits.length > 0) ? appData.credits : [
    { title: 'Snickers (with Saka & Modrić)', role: 'Lead Head Double', category: 'Commercial', production: 'Jim Stump / T&Pm Creative', year: '2024' },
    { title: 'Safestyle Windows', role: 'Banner Assistant', category: 'Commercial', production: 'Chris Cottam / CHIEF', year: '2023' },
    { title: 'Heartache Avenue', role: 'Charlie', category: 'Film', production: 'Kirti Joshi', year: '2024' },
    { title: 'Ted Lasso', role: 'Senior Journalist', category: 'Television', production: 'Jason Sudeikis / Apple TV+', year: '2022' },
    { title: 'The Witcher', role: 'Lowborn', category: 'Television', production: 'Netflix', year: '2022' },
    { title: 'Doctors', role: 'Court Public / Inmate', category: 'Television', production: 'BBC Drama', year: '2021' },
    { title: 'Midsomer Murders', role: 'Featured', category: 'Television', production: 'ITV Studios', year: '2021' },
    { title: 'Hollyoaks & Emmerdale', role: 'Featured', category: 'Television', production: 'Channel 4 / ITV', year: '2020' }
  ];
  if (countBadge) countBadge.textContent = `${credits.length} Verified Credits`;
  if (creditsList) {
    creditsList.innerHTML = credits.map((c, idx) => {
      const pal = getCreditPalette(c, idx);
      return `
        <tr class="credit-row-item ${pal.rowClass} transition border-b border-slate-800/60">
          <td class="p-2.5 font-bold text-white font-cinzel text-xs">${escapeHtml(c.title || '')}</td>
          <td class="p-2.5 whitespace-nowrap"><span class="px-2 py-0.5 rounded-full ${pal.rolePill} text-[10.5px] font-black">${escapeHtml(c.role || '')}</span></td>
          <td class="p-2.5 whitespace-nowrap"><span class="px-1.5 py-0.5 rounded-full ${pal.catBadge} text-[9px] font-extrabold uppercase">${escapeHtml(c.category || '')}</span></td>
          <td class="p-2.5 text-slate-300 text-xs">${escapeHtml(c.production || '')}</td>
          <td class="p-2.5 whitespace-nowrap"><span class="${pal.yearPill} text-xs font-mono-code">${escapeHtml(c.year || '')}</span></td>
        </tr>
      `;
    }).join('');
  }

  // 4. Populate Training Preview
  const trainingList = document.getElementById('fullTrainingPreviewList');
  const training = (appData.training && appData.training.length > 0) ? appData.training : [
    { course: 'ECSPC Screen Combat Foundation Certificate', institution: 'ECSPC', badge: 'PASS / CERTIFIED', details: 'Rapier & Dagger, Unarmed Combat, Smallsword / Stage Safety & Fight Choreography' },
    { course: 'Screen Acting & Audition Technique', institution: 'London Studios', badge: 'PROFESSIONAL', details: 'Camera Awareness, Scene Study, Character Arc Development & Subtext Delivery' },
    { course: 'Firearms & Tactical Handling for Film', institution: 'Armoury Specialists', badge: 'TACTICAL', details: 'Sidearms, Tactical Room Clearance, Law Enforcement Stance, Safety Protocol' },
    { course: 'Voice, Dialect & Accent Immersion', institution: 'UK Vocal', badge: 'VOICE & DIALECT', details: 'RP (Received Pronunciation), Heightened British, Urban London & Dialect Placement' },
    { course: 'Online with Sophie Holland & Faye Timby', institution: 'Sophie Holland Casting', badge: 'CASTING WORKSHOP', details: 'Casting Workshop with Director Q&A & Scene Analysis' }
  ];
  if (trainingList) {
    trainingList.innerHTML = training.map(t => {
      const badgeInfo = resolveTrainingBadge(t);
      return `
        <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 text-xs">
          <div class="flex items-center justify-between mb-0.5">
            <span class="px-1.5 py-0.5 rounded ${badgeInfo.colorClass} text-[8.5px] font-black uppercase">${badgeInfo.label}</span>
            <span class="text-[9.5px] text-slate-400 font-mono-code">${t.institution || ''}</span>
          </div>
          <strong class="text-white block text-xs">${t.course || t.title || ''}</strong>
          <span class="text-[10.5px] text-slate-400 block">${t.details || ''}</span>
        </div>
      `;
    }).join('');
  }

  // 5. Populate Showreels & Media Links Preview
  const showreelsList = document.getElementById('fullShowreelsPreviewList');
  const videos = [
    { title: '1. The Meeting (4K Drama Showreel)', url: `${window.location.origin}/assets/The_Meeting_Up_to_4K.mov`, tag: 'Lead Drama Reel' },
    { title: '2. Steve Pereira Multi-Role Showreel', url: `${window.location.origin}/assets/SteveP-Showreel.mp4`, tag: 'Full Showreel' },
    { title: '3. ECSPC Combat & Action Reel', url: `${window.location.origin}/assets/Combat_Certificate_Training.mp4`, tag: 'Stage Combat Reel' },
    { title: '4. Official Spotlight Directory Profile', url: 'https://app.spotlight.com/9339-8945-6183', tag: 'Spotlight Profile' },
    { title: '5. Steve Pereira Portfolio Website', url: 'https://stevepereira.pro', tag: 'Official Website' }
  ];
  if (showreelsList) {
    showreelsList.innerHTML = videos.map(v => `
      <a href="${v.url}" target="_blank" class="p-2 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-cyan-400 text-xs flex items-center justify-between group transition">
        <div>
          <span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 text-[8.5px] font-mono-code font-bold uppercase">${v.tag}</span>
          <strong class="text-white group-hover:text-cyan-300 block text-xs mt-0.5">${v.title}</strong>
        </div>
        <i data-lucide="external-link" class="w-3.5 h-3.5 text-slate-400 group-hover:text-cyan-300 shrink-0"></i>
      </a>
    `).join('');
  }

  updateFullCastingPhotos();

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeFullCastingSheetModal() {
  const modal = document.getElementById('fullCastingSheetModal');
  if (modal) modal.classList.add('hidden');
}

function updateFullCastingPhotos() {
  const headshotSelect = document.getElementById('fullHeadshotSelect');
  const fullBodySelect = document.getElementById('fullFullBodySelect');
  const headshotImg = document.getElementById('fullHeadshotImg');
  const fullBodyImg = document.getElementById('fullFullBodyImg');

  if (headshotSelect && headshotImg && headshotSelect.value) {
    headshotImg.src = headshotSelect.value;
  }
  if (fullBodySelect && fullBodyImg && fullBodySelect.value) {
    fullBodyImg.src = fullBodySelect.value;
  }
}

function exportFullCastingSheetPDF() {
  const s = appData.stats || {};
  const t = appData.siteTexts || {};
  const headshotUrl = document.getElementById('fullHeadshotSelect')?.value || 'assets/steve_signature_tattoo_bg.jpg';
  const fullBodyUrl = document.getElementById('fullFullBodySelect')?.value || 'IMG_2626.jpeg';

  const credits = (appData.credits && appData.credits.length > 0) ? appData.credits : [
    { title: 'Snickers (with Saka & Modrić)', role: 'Lead Head Double', category: 'Commercial', production: 'Jim Stump / T&Pm Creative Agency', year: '2024' },
    { title: 'Safestyle Windows', role: 'Banner Assistant', category: 'Commercial', production: 'Chris Cottam / CHIEF', year: '2023' },
    { title: 'Heartache Avenue', role: 'Charlie', category: 'Film', production: 'Kirti Joshi', year: '2024' },
    { title: 'Ted Lasso', role: 'Senior Journalist', category: 'Television', production: 'Jason Sudeikis / Apple TV+', year: '2022' },
    { title: 'The Witcher', role: 'Lowborn', category: 'Television', production: 'Netflix', year: '2022' },
    { title: 'Doctors', role: 'Court Public / Inmate', category: 'Television', production: 'BBC Drama', year: '2021' },
    { title: 'Midsomer Murders', role: 'Featured', category: 'Television', production: 'ITV Studios', year: '2021' },
    { title: 'Hollyoaks & Emmerdale', role: 'Featured', category: 'Television', production: 'Channel 4 / ITV', year: '2020' }
  ];

  const training = (appData.training && appData.training.length > 0) ? appData.training : [
    { course: 'ECSPC Screen Combat Foundation Certificate', institution: 'ECSPC', badge: 'PASS / CERTIFIED', details: 'Rapier & Dagger, Unarmed Combat, Smallsword / Stage Safety & Fight Choreography' },
    { course: 'Screen Acting & Audition Technique', institution: 'London Studios', badge: 'PROFESSIONAL', details: 'Camera Awareness, Scene Study, Character Arc Development & Subtext Delivery' },
    { course: 'Firearms & Tactical Handling for Film', institution: 'Armoury Specialists', badge: 'TACTICAL', details: 'Sidearms, Tactical Room Clearance, Law Enforcement Stance, Safety Protocol' },
    { course: 'Voice, Dialect & Accent Immersion', institution: 'UK Vocal', badge: 'VOICE & DIALECT', details: 'RP (Received Pronunciation), Heightened British, Urban London & Dialect Placement' },
    { course: 'Online with Sophie Holland & Faye Timby', institution: 'Sophie Holland Casting', badge: 'CASTING WORKSHOP', details: 'Casting Workshop with Director Q&A & Scene Analysis' }
  ];

  const printWindow = window.open('', '_blank', 'width=950,height=1100');
  if (!printWindow) {
    alert('Please allow popups to generate and print the Full PDF casting dossier.');
    return;
  }

  const origin = window.location.origin;

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Steve Pereira — Full Casting Sheet & Artist Dossier</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Montserrat:wght@400;500;600;700;800&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 8mm 10mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Montserrat', sans-serif;
          background: #ffffff;
          color: #0f172a;
          line-height: 1.3;
          padding: 8px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 820px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 10px;
          margin-bottom: 10px;
        }
        .title-group h1 {
          font-family: 'Cinzel', serif;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #0f172a;
        }
        .title-group p {
          font-size: 10.5px;
          color: #334155;
          font-weight: 600;
          margin-top: 2px;
        }
        .badge-box {
          text-align: right;
          font-family: 'Space Mono', monospace;
          font-size: 9.5px;
          color: #065f46;
          font-weight: 700;
          background: #ecfdf5;
          border: 1.5px solid #a7f3d0;
          padding: 5px 9px;
          border-radius: 6px;
        }
        .photos-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 10px;
        }
        .photo-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          overflow: hidden;
          background: #f8fafc;
          text-align: center;
        }
        .photo-card img {
          width: 100%;
          height: 250px;
          object-fit: cover;
          object-position: top;
          display: block;
        }
        .photo-caption {
          font-size: 9px;
          font-weight: 700;
          color: #334155;
          background: #f1f5f9;
          padding: 3px;
          text-transform: uppercase;
          font-family: 'Space Mono', monospace;
        }
        .bio-box {
          background: #f8fafc;
          border-left: 3px solid #059669;
          padding: 6px 10px;
          margin-bottom: 10px;
          font-size: 10px;
          color: #334155;
          line-height: 1.35;
        }
        .section-title {
          font-family: 'Cinzel', serif;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          border-bottom: 1.5px solid #cbd5e1;
          padding-bottom: 2px;
          margin-top: 8px;
          margin-bottom: 6px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 5px;
          margin-bottom: 10px;
        }
        .stat-cell {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 5px;
          padding: 4px 5px;
          text-align: center;
        }
        .stat-label {
          font-size: 7.5px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          display: block;
        }
        .stat-value {
          font-size: 10px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 1px;
          display: block;
        }
        .credits-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5px;
          margin-bottom: 10px;
        }
        .credits-table th {
          background: #0f172a;
          color: #ffffff;
          padding: 4px 6px;
          text-align: left;
          font-family: 'Space Mono', monospace;
          font-size: 8.5px;
          text-transform: uppercase;
        }
        .credits-table td {
          padding: 4px 6px;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
        }
        .credits-table tr:nth-child(even) td {
          background: #f8fafc;
        }
        .credit-tag {
          font-size: 8px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 3px;
          background: #e2e8f0;
          color: #334155;
          text-transform: uppercase;
        }
        .two-col-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 10px;
        }
        .info-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 6px 8px;
          font-size: 9.5px;
        }
        .info-card strong {
          color: #0f172a;
          display: block;
          margin-bottom: 2px;
          font-size: 9px;
          text-transform: uppercase;
          font-family: 'Space Mono', monospace;
        }
        .training-item {
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 3px;
          margin-bottom: 3px;
        }
        .training-item:last-child {
          border-bottom: none;
          margin-bottom: 0;
          padding-bottom: 0;
        }
        .training-badge {
          display: inline-block;
          font-size: 7.5px;
          font-weight: 800;
          padding: 1px 4px;
          border-radius: 3px;
          background: #dcfce7;
          color: #166534;
          text-transform: uppercase;
          margin-bottom: 1px;
        }
        .links-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          margin-bottom: 10px;
        }
        .link-chip {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 5px;
          padding: 4px 7px;
          font-size: 9px;
          color: #065f46;
          text-decoration: none;
          display: block;
        }
        .link-chip strong {
          display: block;
          color: #047857;
          font-size: 9px;
        }
        .link-url {
          font-size: 8px;
          color: #0f766e;
          font-family: 'Space Mono', monospace;
          word-break: break-all;
        }
        .agents-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-bottom: 10px;
        }
        .agent-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 6px 8px;
          background: #f8fafc;
          font-size: 9.5px;
        }
        .agent-card strong {
          font-size: 10px;
          display: block;
          color: #0f172a;
        }
        .agent-type {
          font-size: 8px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 700;
        }
        .agent-contact {
          font-family: 'Space Mono', monospace;
          font-size: 8.5px;
          color: #334155;
          margin-top: 1px;
          display: block;
        }
        .footer {
          border-top: 1.5px solid #0f172a;
          padding-top: 6px;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 8.5px;
          color: #475569;
          font-family: 'Space Mono', monospace;
        }
        .footer a {
          color: #059669;
          font-weight: 700;
          text-decoration: none;
        }
        @media print {
          .page-break {
            page-break-before: always;
          }
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- Top Header -->
        <div class="header">
          <div class="title-group">
            <h1>STEVE PEREIRA</h1>
            <p>Versatile British-Indian Screen Actor • Equity Full Member • London / UK Based</p>
          </div>
          <div class="badge-box">
            <div>SPOTLIGHT PIN: 9339-8945-6183</div>
            <div>ARTIST REF: M283723 • EQUITY MEMBER</div>
          </div>
        </div>

        <!-- 2 High-Res Selected Photos -->
        <div class="photos-row">
          <div class="photo-card">
            <img src="${headshotUrl}" alt="Steve Pereira Primary Headshot">
            <div class="photo-caption">1. Primary Spotlight Headshot</div>
          </div>
          <div class="photo-card">
            <img src="${fullBodyUrl}" alt="Steve Pereira Full Body Slate">
            <div class="photo-caption">2. Full Body Standing Slate</div>
          </div>
        </div>

        <!-- Professional Summary / Bio -->
        <div class="bio-box">
          <strong>Summary & Bio:</strong> ${t.actorSummary || 'Versatile British-Indian screen actor with an athletic build and commanding screen presence. Featured in global commercial campaigns including Snickers with Bukayo Saka & Luka Modrić, Apple TV+\'s Ted Lasso, Netflix\'s The Witcher, and BBC Doctors. Certified in ESPCA Stage Combat and Tactical Firearms, Steve pairs rigorous dramatic training across the UK with 34 years of enterprise IT background.'}
        </div>

        <!-- Physical Measurements & Vitals (12 Specs) -->
        <div class="section-title">Physical Measurements & Hero Vitals (12 Specs)</div>
        <div class="stats-grid">
          <div class="stat-cell"><span class="stat-label">Nationalities</span><span class="stat-value">${s.nationalities || 'British / Indian'}</span></div>
          <div class="stat-cell"><span class="stat-label">Playing Age</span><span class="stat-value">${s.playingAge || '35 – 50 Yrs'}</span></div>
          <div class="stat-cell"><span class="stat-label">Height</span><span class="stat-value">${s.height || "5'6.5\" (169cm)"}</span></div>
          <div class="stat-cell"><span class="stat-label">Build</span><span class="stat-value">${s.build || 'Athletic / Toned'}</span></div>
          <div class="stat-cell"><span class="stat-label">Weight</span><span class="stat-value">${s.weight || '68 kg (9st 13)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Chest</span><span class="stat-value">${s.chest || '38" (96.5cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Waist</span><span class="stat-value">${s.waist || '32" (76.2cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Hips</span><span class="stat-value">${s.hips || '34" (86.4cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Inside Leg</span><span class="stat-value">${s.insideLeg || '28" (71cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Collar</span><span class="stat-value">${s.collar || '15.5" (39.4cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Shoe Size</span><span class="stat-value">${s.shoeSize || '7.5 UK / 41 EU'}</span></div>
          <div class="stat-cell"><span class="stat-label">Hair & Eyes</span><span class="stat-value">${s.hair || 'Bald'} / ${s.eyes || 'Brown'}</span></div>
        </div>

        <!-- Featured Spotlight Credits Table -->
        <div class="section-title">Spotlight Credits & Film / Television / Commercial Works</div>
        <table class="credits-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Role</th>
              <th>Category</th>
              <th>Production / Director</th>
              <th>Year</th>
            </tr>
          </thead>
          <tbody>
            ${credits.map(c => `
              <tr>
                <td><strong>${c.title || ''}</strong></td>
                <td>${c.role || ''}</td>
                <td><span class="credit-tag">${c.category || ''}</span></td>
                <td>${c.production || ''}</td>
                <td><strong>${c.year || ''}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <!-- Training, Accreditations & Special Skills -->
        <div class="section-title">Training, Stage Combat & Special Skills</div>
        <div class="two-col-grid">
          <div class="info-card">
            <strong>Certified Training & Workshops</strong>
            ${training.map(tr => `
              <div class="training-item">
                <span class="training-badge">${tr.badge || 'CERTIFIED'}</span>
                <div><strong>${tr.course || tr.title || ''}</strong> (${tr.institution || 'Accredited'})</div>
                <div style="font-size: 8.5px; color: #475569;">${tr.details || ''}</div>
              </div>
            `).join('')}
          </div>
          <div class="info-card">
            <strong>Accents, Dialects & Special Skills</strong>
            <div style="margin-bottom: 6px;">
              <span style="font-weight: 700; color: #0f172a;">Accents & Dialects:</span>
              <div style="color: #334155; margin-top: 1px;">RP (Received Pronunciation), Contemporary London, Cockney, South African, General American, Indian.</div>
            </div>
            <div style="margin-bottom: 6px;">
              <span style="font-weight: 700; color: #0f172a;">Combat & Firearm Certifications:</span>
              <div style="color: #334155; margin-top: 1px;">ECSPC Screen Combat Foundation (Pass), Tactical Firearms Handling & Movement for Film, Safety Protocol.</div>
            </div>
            <div>
              <span style="font-weight: 700; color: #0f172a;">Additional Skills:</span>
              <div style="color: #334155; margin-top: 1px;">Precision Driving, Enterprise IT & Cloud Solutions Architect (34 Yrs), Voiceover.</div>
            </div>
          </div>
        </div>

        <!-- Video Showreels & Media Links (Active Clickable Hyperlinks) -->
        <div class="section-title">Video Showreels & Media Links (Clickable Hyperlinks)</div>
        <div class="links-grid">
          <a href="${origin}/assets/The_Meeting_Up_to_4K.mov" target="_blank" class="link-chip">
            <strong>▶ 1. The Meeting (4K Drama Showreel)</strong>
            <span class="link-url">${origin}/assets/The_Meeting_Up_to_4K.mov</span>
          </a>
          <a href="${origin}/assets/SteveP-Showreel.mp4" target="_blank" class="link-chip">
            <strong>▶ 2. Steve Pereira Multi-Role Showreel</strong>
            <span class="link-url">${origin}/assets/SteveP-Showreel.mp4</span>
          </a>
          <a href="${origin}/assets/Combat_Certificate_Training.mp4" target="_blank" class="link-chip">
            <strong>▶ 3. ECSPC Combat & Action Reel</strong>
            <span class="link-url">${origin}/assets/Combat_Certificate_Training.mp4</span>
          </a>
          <a href="https://app.spotlight.com/9339-8945-6183" target="_blank" class="link-chip">
            <strong>★ 4. Official Spotlight Directory Profile</strong>
            <span class="link-url">https://app.spotlight.com/9339-8945-6183</span>
          </a>
        </div>

        <!-- Official Agency Representation -->
        <div class="section-title">Official Agency Representation</div>
        <div class="agents-row">
          <div class="agent-card">
            <span class="agent-type">Acting & Commercials Agency</span>
            <strong>The Central Line Agency</strong>
            <span class="agent-contact">020 7434 4771 • agency@thecentralline.co.uk</span>
          </div>
          <div class="agent-card">
            <span class="agent-type">Model & Commercial Agency</span>
            <strong>Face Management</strong>
            <span class="agent-contact">0113 245 8667 • facemanagement.co.uk</span>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          <span>Official Portfolio: <a href="https://stevepereira.pro">https://stevepereira.pro</a></span>
          <span>Spotlight Directory Link: <a href="https://app.spotlight.com/9339-8945-6183">app.spotlight.com/9339-8945-6183</a></span>
        </div>

      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function exportFullCastingSheetExcel() {
  const s = appData.stats || {};
  const t = appData.siteTexts || {};
  const headshotUrl = document.getElementById('fullHeadshotSelect')?.value || 'assets/steve_signature_tattoo_bg.jpg';
  const fullBodyUrl = document.getElementById('fullFullBodySelect')?.value || 'IMG_2626.jpeg';

  const credits = (appData.credits && appData.credits.length > 0) ? appData.credits : [
    { title: 'Snickers (with Saka & Modrić)', role: 'Lead Head Double', category: 'Commercial', production: 'Jim Stump / T&Pm Creative Agency', year: '2024' },
    { title: 'Safestyle Windows', role: 'Banner Assistant', category: 'Commercial', production: 'Chris Cottam / CHIEF', year: '2023' },
    { title: 'Heartache Avenue', role: 'Charlie', category: 'Film', production: 'Kirti Joshi', year: '2024' },
    { title: 'Ted Lasso', role: 'Senior Journalist', category: 'Television', production: 'Jason Sudeikis / Apple TV+', year: '2022' },
    { title: 'The Witcher', role: 'Lowborn', category: 'Television', production: 'Netflix', year: '2022' },
    { title: 'Doctors', role: 'Court Public / Inmate', category: 'Television', production: 'BBC Drama', year: '2021' },
    { title: 'Midsomer Murders', role: 'Featured', category: 'Television', production: 'ITV Studios', year: '2021' },
    { title: 'Hollyoaks & Emmerdale', role: 'Featured', category: 'Television', production: 'Channel 4 / ITV', year: '2020' }
  ];

  const training = (appData.training && appData.training.length > 0) ? appData.training : [
    { course: 'ECSPC Screen Combat Foundation Certificate', institution: 'ECSPC', badge: 'PASS / CERTIFIED', details: 'Rapier & Dagger, Unarmed, Smallsword' },
    { course: 'Screen Acting & Audition Technique', institution: 'London Studios', badge: 'PROFESSIONAL', details: 'Camera Awareness, Scene Study, Character Arc' },
    { course: 'Firearms & Tactical Handling for Film', institution: 'Armoury Specialists', badge: 'TACTICAL', details: 'Sidearms, Tactical Room Clearance, Safety' },
    { course: 'Voice, Dialect & Accent Immersion', institution: 'UK Vocal', badge: 'VOICE & DIALECT', details: 'RP, Heightened British, Urban London' },
    { course: 'Online with Sophie Holland & Faye Timby', institution: 'Sophie Holland Casting', badge: 'CASTING WORKSHOP', details: 'Casting Workshop with Director Q&A' }
  ];

  const origin = window.location.origin;

  const rows = [
    ['STEVE PEREIRA — OFFICIAL FULL CASTING SHEET & DOSSIER'],
    ['Generated from Portfolio', new Date().toLocaleDateString('en-GB')],
    [],
    ['PROFILE SPECIFICATIONS', 'VALUE'],
    ['Actor Name', 'Steve Pereira'],
    ['Spotlight PIN', '9339-8945-6183'],
    ['Spotlight Artist Ref', 'M283723'],
    ['Equity Membership', 'Full Member'],
    ['Nationalities', s.nationalities || 'British / Indian'],
    ['Playing Age', s.playingAge || '35 – 50 Years'],
    ['Professional Bio', t.actorSummary || 'Versatile British-Indian screen actor with athletic build and commanding presence.'],
    [],
    ['HERO PHYSICAL STATS (12 VITALS)', 'VALUE'],
    ['Height', s.height || '5\'6.5" (169cm)'],
    ['Build', s.build || 'Athletic / Toned'],
    ['Weight', s.weight || '68 kg (9st 13lb)'],
    ['Chest', s.chest || '38" (96.5cm)'],
    ['Waist', s.waist || '32" (76.2cm)'],
    ['Hips', s.hips || '34" (86.4cm)'],
    ['Inside Leg', s.insideLeg || '28" (71cm)'],
    ['Collar Size', s.collar || '15.5" (39.4cm)'],
    ['Shoe Size', s.shoeSize || '7.5 UK / 41 EU'],
    ['Hair Color', s.hair || 'Bald'],
    ['Eye Color', s.eyes || 'Brown'],
    ['Hair & Eyes Summary', `${s.hair || 'Bald'} / ${s.eyes || 'Brown'}`],
    [],
    ['SPOTLIGHT CREDITS & PROFESSIONAL WORKS', 'ROLE', 'CATEGORY', 'PRODUCTION / DIRECTOR', 'YEAR'],
    ...credits.map(c => [c.title || '', c.role || '', c.category || '', c.production || '', c.year || '']),
    [],
    ['ACCREDITED TRAINING & COMBAT CERTIFICATIONS', 'INSTITUTION', 'BADGE', 'DETAILS'],
    ...training.map(tr => [tr.course || tr.title || '', tr.institution || '', tr.badge || '', tr.details || '']),
    [],
    ['ACCENTS, DIALECTS & SPECIAL SKILLS', 'DETAILS'],
    ['Accents & Dialects', 'RP (Received Pronunciation), Contemporary London, Cockney, South African, General American, Indian'],
    ['Stage Combat Certification', 'ECSPC / BADC Screen Combat Foundation (Pass) - Rapier & Dagger, Unarmed, Smallsword'],
    ['Tactical Handling', 'Firearms & Tactical Movement for Film, Safety Protocol, Room Clearance'],
    ['Special Skills', 'Precision Driving, Enterprise IT & Cybersecurity Solutions Architect (34 Yrs), Voiceover'],
    [],
    ['VIDEO SHOWREELS & MEDIA LINKS', 'ACTIVE URL'],
    ['1. The Meeting (4K Drama Showreel)', `${origin}/assets/The_Meeting_Up_to_4K.mov`],
    ['2. Steve Pereira Showreel (Multi-Role)', `${origin}/assets/SteveP-Showreel.mp4`],
    ['3. ECSPC Combat & Action Reel', `${origin}/assets/Combat_Certificate_Training.mp4`],
    ['4. Spotlight Verified Directory Profile', 'https://app.spotlight.com/9339-8945-6183'],
    ['5. Official Portfolio Website', 'https://stevepereira.pro'],
    ['6. Included Primary Headshot', `${origin}/${headshotUrl}`],
    ['7. Included Full Body Slate', `${origin}/${fullBodyUrl}`],
    [],
    ['OFFICIAL AGENCY REPRESENTATION', 'CONTACT DETAILS'],
    ['Acting & Commercials Agent', 'The Central Line Agency | Tel: 020 7434 4771 | Email: agency@thecentralline.co.uk'],
    ['Model & Commercial Agent', 'Face Management | Tel: 0113 245 8667 | Web: https://facemanagement.co.uk']
  ];

  const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Steve_Pereira_Full_Casting_Dossier.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function copyFullCastingSheetText() {
  const s = appData.stats || {};
  const t = appData.siteTexts || {};
  const headshotUrl = document.getElementById('fullHeadshotSelect')?.value || 'assets/steve_signature_tattoo_bg.jpg';
  const fullBodyUrl = document.getElementById('fullFullBodySelect')?.value || 'IMG_2626.jpeg';
  const origin = window.location.origin;

  const credits = (appData.credits && appData.credits.length > 0) ? appData.credits : [
    { title: 'Snickers (with Saka & Modrić)', role: 'Lead Head Double', category: 'Commercial', production: 'Jim Stump / T&Pm Creative Agency', year: '2024' },
    { title: 'Safestyle Windows', role: 'Banner Assistant', category: 'Commercial', production: 'Chris Cottam / CHIEF', year: '2023' },
    { title: 'Heartache Avenue', role: 'Charlie', category: 'Film', production: 'Kirti Joshi', year: '2024' },
    { title: 'Ted Lasso', role: 'Senior Journalist', category: 'Television', production: 'Jason Sudeikis / Apple TV+', year: '2022' },
    { title: 'The Witcher', role: 'Lowborn', category: 'Television', production: 'Netflix', year: '2022' },
    { title: 'Doctors', role: 'Court Public / Inmate', category: 'Television', production: 'BBC Drama', year: '2021' }
  ];

  const training = (appData.training && appData.training.length > 0) ? appData.training : [
    { course: 'ECSPC Screen Combat Foundation Certificate', institution: 'ECSPC', badge: 'PASS / CERTIFIED' },
    { course: 'Screen Acting & Audition Technique', institution: 'London Studios', badge: 'PROFESSIONAL' },
    { course: 'Firearms & Tactical Handling for Film', institution: 'Armoury Specialists', badge: 'TACTICAL' },
    { course: 'Voice, Dialect & Accent Immersion', institution: 'UK Vocal', badge: 'VOICE & DIALECT' }
  ];

  const creditsText = credits.map(c => `• ${c.title} — Role: ${c.role} (${c.category}, ${c.year}) | ${c.production}`).join('\n');
  const trainingText = training.map(tr => `• ${tr.course} (${tr.institution}) — [${tr.badge || 'CERTIFIED'}]`).join('\n');

  const text = `
STEVE PEREIRA — FULL CASTING SHEET & ARTIST DOSSIER
===================================================
Spotlight PIN: 9339-8945-6183 (Artist Ref: M283723)
Equity: Full Member | Nationalities: ${s.nationalities || 'British / Indian'}
Spotlight Link: https://app.spotlight.com/9339-8945-6183
Official Portfolio: https://stevepereira.pro

SUMMARY & BIO:
${t.actorSummary || 'Versatile British-Indian screen actor with an athletic build and commanding screen presence. Featured in global commercial campaigns including Snickers with Bukayo Saka & Luka Modrić, Apple TV+\'s Ted Lasso, Netflix\'s The Witcher, and BBC Doctors. Certified in ESPCA Stage Combat and Tactical Firearms, Steve pairs rigorous dramatic training across the UK with 34 years of enterprise IT background.'}

PHYSICAL MEASUREMENTS & HERO VITALS (12 SPECS):
- Nationalities: ${s.nationalities || 'British / Indian'}
- Playing Age: ${s.playingAge || '35 – 50 Years'}
- Height: ${s.height || "5'6.5\" (169cm)"}
- Build: ${s.build || 'Athletic / Toned'}
- Weight: ${s.weight || '68 kg (9st 13lb)'}
- Chest: ${s.chest || '38" (96.5cm)'}
- Waist: ${s.waist || '32" (76.2cm)'}
- Hips: ${s.hips || '34" (86.4cm)'}
- Inside Leg: ${s.insideLeg || '28" (71cm)'}
- Collar: ${s.collar || '15.5" (39.4cm)'}
- Shoe Size: ${s.shoeSize || '7.5 UK / 41 EU'}
- Hair & Eyes: ${s.hair || 'Bald'} / ${s.eyes || 'Brown'}

FEATURED SPOTLIGHT CREDITS:
${creditsText}

TRAINING & CERTIFICATIONS:
${trainingText}

ACCENTS & SPECIAL SKILLS:
- Accents: RP (Received Pronunciation), Contemporary London, Cockney, South African, General American, Indian
- Combat / Stunts: ECSPC Screen Combat Foundation (Pass), Tactical Firearms Handling & Movement, Precision Driving
- Additional: Enterprise IT & Cloud Solutions Architect (34 Yrs), Voiceover

VIDEO SHOWREELS & MEDIA LINKS:
- 1. The Meeting (4K Drama Showreel): ${origin}/assets/The_Meeting_Up_to_4K.mov
- 2. Steve Pereira Showreel (Multi-Role): ${origin}/assets/SteveP-Showreel.mp4
- 3. ECSPC Combat & Action Reel: ${origin}/assets/Combat_Certificate_Training.mp4
- 4. Spotlight Verified Profile: https://app.spotlight.com/9339-8945-6183
- 5. Primary Headshot: ${origin}/${headshotUrl}
- 6. Full Body Slate: ${origin}/${fullBodyUrl}

OFFICIAL AGENCY REPRESENTATION:
- Acting & Commercials: The Central Line Agency (020 7434 4771 | agency@thecentralline.co.uk)
- Model & Commercial: Face Management (0113 245 8667 | facemanagement.co.uk)
  `.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Full Casting Sheet & Dossier copied to clipboard for instant email submission!');
    }).catch(() => {
      prompt('Copy full casting dossier text below:', text);
    });
  } else {
    prompt('Copy full casting dossier text below:', text);
  }
}

function updateBriefCastingPhotos() {
  const headshotSelect = document.getElementById('briefHeadshotSelect');
  const fullBodySelect = document.getElementById('briefFullBodySelect');
  const headshotImg = document.getElementById('briefHeadshotImg');
  const fullBodyImg = document.getElementById('briefFullBodyImg');

  if (headshotSelect && headshotImg && headshotSelect.value) {
    headshotImg.src = headshotSelect.value;
  }
  if (fullBodySelect && fullBodyImg && fullBodySelect.value) {
    fullBodyImg.src = fullBodySelect.value;
  }
}

function exportBriefCastingSheetPDF() {
  const s = appData.stats || {};
  const t = appData.siteTexts || {};
  const headshotUrl = document.getElementById('briefHeadshotSelect')?.value || 'assets/steve_signature_tattoo_bg.jpg';
  const fullBodyUrl = document.getElementById('briefFullBodySelect')?.value || 'IMG_2626.jpeg';

  const printWindow = window.open('', '_blank', 'width=900,height=1000');
  if (!printWindow) {
    alert('Please allow popups to generate and print the PDF casting sheet.');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Steve Pereira — Brief Casting Sheet</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Montserrat:wght@400;600;700;800&family=Space+Mono:wght@700&display=swap" rel="stylesheet">
      <style>
        @page {
          size: A4 portrait;
          margin: 10mm 12mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Montserrat', sans-serif;
          background: #ffffff;
          color: #0f172a;
          line-height: 1.35;
          padding: 10px;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .container {
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 14px;
        }
        .title-group h1 {
          font-family: 'Cinzel', serif;
          font-size: 26px;
          font-weight: 900;
          letter-spacing: 1px;
          color: #0f172a;
        }
        .title-group p {
          font-size: 11px;
          color: #475569;
          font-weight: 600;
          margin-top: 2px;
        }
        .badge-box {
          text-align: right;
          font-family: 'Space Mono', monospace;
          font-size: 10px;
          color: #b45309;
          font-weight: 700;
          background: #fef3c7;
          border: 1px solid #fde68a;
          padding: 6px 10px;
          border-radius: 6px;
        }
        .photos-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 14px;
        }
        .photo-card {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          overflow: hidden;
          background: #f8fafc;
          text-align: center;
        }
        .photo-card img {
          width: 100%;
          height: 310px;
          object-fit: cover;
          object-position: top;
          display: block;
        }
        .photo-caption {
          font-size: 10px;
          font-weight: 700;
          color: #475569;
          background: #f1f5f9;
          padding: 4px;
          text-transform: uppercase;
          font-family: 'Space Mono', monospace;
        }
        .section-title {
          font-family: 'Cinzel', serif;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          border-bottom: 1px solid #cbd5e1;
          padding-bottom: 3px;
          margin-bottom: 8px;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(6, 1fr);
          gap: 6px;
          margin-bottom: 14px;
        }
        .stat-cell {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 5px 6px;
          text-align: center;
        }
        .stat-label {
          font-size: 8px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          display: block;
        }
        .stat-value {
          font-size: 11px;
          font-weight: 800;
          color: #0f172a;
          margin-top: 1px;
          display: block;
        }
        .skills-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 14px;
        }
        .skills-box {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          padding: 8px;
          font-size: 10.5px;
        }
        .skills-box strong {
          color: #0f172a;
          display: block;
          margin-bottom: 3px;
          font-size: 10px;
          text-transform: uppercase;
        }
        .agents-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 12px;
        }
        .agent-card {
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 8px 10px;
          background: #f8fafc;
          font-size: 10.5px;
        }
        .agent-card strong {
          font-size: 11px;
          display: block;
          color: #0f172a;
        }
        .agent-type {
          font-size: 9px;
          color: #64748b;
          text-transform: uppercase;
          font-weight: 600;
        }
        .agent-contact {
          font-family: 'Space Mono', monospace;
          font-size: 9.5px;
          color: #334155;
          margin-top: 2px;
          display: block;
        }
        .footer {
          border-top: 1px solid #cbd5e1;
          padding-top: 8px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 9px;
          color: #64748b;
          font-family: 'Space Mono', monospace;
        }
        .footer a {
          color: #b45309;
          font-weight: 700;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="title-group">
            <h1>STEVE PEREIRA</h1>
            <p>Versatile Screen Actor • London / UK Based • Equity Full Member</p>
          </div>
          <div class="badge-box">
            <div>SPOTLIGHT PIN: 9339-8945-6183</div>
            <div>ARTIST REF: M283723</div>
          </div>
        </div>

        <div class="photos-row">
          <div class="photo-card">
            <img src="${headshotUrl}" alt="Steve Pereira Headshot">
            <div class="photo-caption">1. Primary Headshot</div>
          </div>
          <div class="photo-card">
            <img src="${fullBodyUrl}" alt="Steve Pereira Full Body Shot">
            <div class="photo-caption">2. Full Body Slate</div>
          </div>
        </div>

        <div class="section-title">Physical Measurements & Hero Vitals (12 Specs)</div>
        <div class="stats-grid">
          <div class="stat-cell"><span class="stat-label">Playing Age</span><span class="stat-value">${s.playingAge || '35 – 50 Yrs'}</span></div>
          <div class="stat-cell"><span class="stat-label">Height</span><span class="stat-value">${s.height || "5'6.5\" (169cm)"}</span></div>
          <div class="stat-cell"><span class="stat-label">Build</span><span class="stat-value">${s.build || 'Athletic / Toned'}</span></div>
          <div class="stat-cell"><span class="stat-label">Weight</span><span class="stat-value">${s.weight || '63 kg (9st 13)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Chest</span><span class="stat-value">${s.chest || '38" (96.5cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Waist</span><span class="stat-value">${s.waist || '30" (76.2cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Hips</span><span class="stat-value">${s.hips || '34" (86.4cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Inside Leg</span><span class="stat-value">${s.insideLeg || '28" (71cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Collar</span><span class="stat-value">${s.collar || '15.5" (39.4cm)'}</span></div>
          <div class="stat-cell"><span class="stat-label">Shoe Size</span><span class="stat-value">${s.shoeSize || '7.5 UK / 41 EU'}</span></div>
          <div class="stat-cell"><span class="stat-label">Hair & Eyes</span><span class="stat-value">${s.hair || 'Bald'} / ${s.eyes || 'Brown'}</span></div>
          <div class="stat-cell"><span class="stat-label">Nationalities</span><span class="stat-value">${s.nationalities || 'British / Portuguese'}</span></div>
        </div>

        <div class="skills-row">
          <div class="skills-box">
            <strong>Key Accents & Dialects</strong>
            RP (Received Pronunciation), Contemporary London, Cockney, South African, General American.
          </div>
          <div class="skills-box">
            <strong>Combat & Accreditations</strong>
            ECSPC/BADC Screen Combat (Pass), Firearms & Tactical Movement for Film, Precision Driving.
          </div>
        </div>

        <div class="section-title">Official Agency Representation</div>
        <div class="agents-row">
          <div class="agent-card">
            <span class="agent-type">Acting & Commercials Agency</span>
            <strong>The Central Line Agency</strong>
            <span class="agent-contact">020 7434 4771 • agency@thecentralline.co.uk</span>
          </div>
          <div class="agent-card">
            <span class="agent-type">Model & Commercial Agency</span>
            <strong>Face Management</strong>
            <span class="agent-contact">0113 245 8667 • facemanagement.co.uk</span>
          </div>
        </div>

        <div class="footer">
          <span>Official Portfolio: https://stevepereira.pro</span>
          <span>Spotlight Directory Link: <a href="https://app.spotlight.com/9339-8945-6183">app.spotlight.com/9339-8945-6183</a></span>
        </div>
      </div>
      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
          }, 300);
        };
      <\/script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function exportBriefCastingSheetExcel() {
  const s = appData.stats || {};
  const t = appData.siteTexts || {};
  const headshotUrl = document.getElementById('briefHeadshotSelect')?.value || 'assets/steve_signature_tattoo_bg.jpg';
  const fullBodyUrl = document.getElementById('briefFullBodySelect')?.value || 'IMG_2626.jpeg';

  const rows = [
    ['STEVE PEREIRA — OFFICIAL BRIEF CASTING SHEET'],
    ['Generated from Portfolio', new Date().toLocaleDateString('en-GB')],
    [],
    ['PROFILE SPECIFICATIONS', 'VALUE'],
    ['Actor Name', 'Steve Pereira'],
    ['Spotlight PIN', '9339-8945-6183'],
    ['Spotlight Artist Ref', 'M283723'],
    ['Equity Membership', 'Full Member'],
    ['Nationalities', s.nationalities || 'British / Portuguese'],
    ['Playing Age', s.playingAge || '35 – 50 Years'],
    [],
    ['HERO PHYSICAL STATS (12 VITALS)', 'VALUE'],
    ['Height', s.height || '5\'6.5" (169cm)'],
    ['Build', s.build || 'Athletic / Toned'],
    ['Weight', s.weight || '63 kg (9st 13lb)'],
    ['Chest', s.chest || '38" (96.5cm)'],
    ['Waist', s.waist || '30" (76.2cm)'],
    ['Hips', s.hips || '34" (86.4cm)'],
    ['Inside Leg', s.insideLeg || '28" (71cm)'],
    ['Collar Size', s.collar || '15.5" (39.4cm)'],
    ['Shoe Size', s.shoeSize || '7.5 UK / 41 EU'],
    ['Hair Color', s.hair || 'Bald'],
    ['Eye Color', s.eyes || 'Brown'],
    ['Hair & Eyes Summary', `${s.hair || 'Bald'} / ${s.eyes || 'Brown'}`],
    [],
    ['ACCENTS, SKILLS & TRAINING', 'DETAILS'],
    ['Accents & Dialects', 'RP, Contemporary London, Cockney, South African, General American'],
    ['Combat Certification', 'ECSPC / BADC Standard Stage Combat (Pass) - Rapier & Dagger, Unarmed, Smallsword'],
    ['Special Skills', 'Firearms & Tactical Handling, Precision Driving, Advanced Cloud Architecture (34 Yrs)'],
    [],
    ['OFFICIAL REPRESENTATION', 'CONTACT DETAILS'],
    ['Acting & Commercials Agent', 'The Central Line Agency | Tel: 020 7434 4771 | Email: agency@thecentralline.co.uk'],
    ['Model & Commercial Agent', 'Face Management | Tel: 0113 245 8667 | Web: https://facemanagement.co.uk'],
    [],
    ['INCLUDED CASTING MEDIA', 'ASSET PATH / URL'],
    ['1. Primary Headshot', headshotUrl],
    ['2. Full Body Slate Shot', fullBodyUrl],
    ['Spotlight Web Directory', 'https://app.spotlight.com/9339-8945-6183']
  ];

  const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'Steve_Pereira_Brief_Casting_Sheet.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function copyBriefCastingSheetText() {
  const s = appData.stats || {};
  const headshotUrl = document.getElementById('briefHeadshotSelect')?.value || 'assets/steve_signature_tattoo_bg.jpg';
  const fullBodyUrl = document.getElementById('briefFullBodySelect')?.value || 'IMG_2626.jpeg';

  const text = `
STEVE PEREIRA — BRIEF CASTING SHEET
====================================
Spotlight PIN: 9339-8945-6183 (Artist Ref: M283723)
Equity: Full Member | Nationalities: ${s.nationalities || 'British / Portuguese'}
Spotlight Link: https://app.spotlight.com/9339-8945-6183

PHYSICAL STATS & HERO VITALS:
- Playing Age: ${s.playingAge || '35 – 50 Years'}
- Height: ${s.height || "5'6.5\" (169cm)"}
- Build: ${s.build || 'Athletic / Toned'}
- Weight: ${s.weight || '63 kg (9st 13lb)'}
- Chest: ${s.chest || '38" (96.5cm)'}
- Waist: ${s.waist || '30" (76.2cm)'}
- Hips: ${s.hips || '34" (86.4cm)'}
- Inside Leg: ${s.insideLeg || '28" (71cm)'}
- Collar: ${s.collar || '15.5" (39.4cm)'}
- Shoe Size: ${s.shoeSize || '7.5 UK / 41 EU'}
- Hair & Eyes: ${s.hair || 'Bald'} / ${s.eyes || 'Brown'}

ACCENTS & SKILLS:
- Accents: RP (Received Pronunciation), Contemporary London, Cockney, South African, General American
- Combat / Stunts: ECSPC Screen Combat Foundation (Pass), Tactical Firearms Handling, Precision Driving

AGENTS / REPRESENTATION:
- Acting & Commercials: The Central Line Agency (020 7434 4771 | agency@thecentralline.co.uk)
- Model & Commercial: Face Management (0113 245 8667 | facemanagement.co.uk)

MEDIA:
- Headshot: ${window.location.origin}/${headshotUrl}
- Full Body Shot: ${window.location.origin}/${fullBodyUrl}
  `.trim();

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      alert('✅ Brief Casting Sheet copied to clipboard for instant email submission!');
    }).catch(() => {
      prompt('Copy casting summary text below:', text);
    });
  } else {
    prompt('Copy casting summary text below:', text);
  }
}

function renderHeroStats() {
  const s = appData.stats || {};
  const setEl = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = (val !== undefined && val !== null && String(val).trim() !== '') ? val : '';
  };
  setEl('statDisplayPlayingAge', s.playingAge || '35 – 50 Yrs');
  setEl('statDisplayHeight', s.height || '5\'6.5" (169cm)');
  setEl('statDisplayBuild', s.build || 'Athletic / Toned');
  setEl('statDisplayHairEyes', `${s.hair || 'Bald'} / ${s.eyes || 'Brown'}`);
  setEl('statDisplayNationalities', s.nationalities || 'British / Portuguese');
  setEl('statDisplayChest', s.chest || '38" (96.5cm)');
  setEl('statDisplayWaist', s.waist || '30" (76.2cm)');
  setEl('statDisplayHips', s.hips || '34" (86.4cm)');
  setEl('statDisplayInsideLeg', s.insideLeg || '28" (71cm)');
  setEl('statDisplayWeight', s.weight || '63 kg (9st 13)');
  setEl('statDisplayCollarShoe', `${s.collar || '15.5"'} / ${s.shoeSize || '7.5 UK'}`);
}

function resolveTrainingBadge(t) {
  const fullText = `${t.badge || ''} ${t.course || ''} ${t.institution || ''} ${t.details || ''}`.toLowerCase();
  
  let label = t.badge || '';
  let color = t.badgeColor || '';

  if (fullText.includes('voice') || fullText.includes('dialect') || fullText.includes('accent')) {
    if (!label || label === 'CERTIFIED' || label === 'N/A') label = 'VOICE & DIALECT';
    color = color || 'amber';
  } else if (fullText.includes('tactical') || fullText.includes('firearm') || fullText.includes('armoury') || fullText.includes('weapon')) {
    if (!label || label === 'CERTIFIED' || label === 'N/A') label = 'TACTICAL';
    color = color || 'rose';
  } else if (fullText.includes('combat') || fullText.includes('badc') || fullText.includes('ecspc') || fullText.includes('stunt') || fullText.includes('sword') || fullText.includes('fight')) {
    if (!label || label === 'N/A') label = 'PASS / CERTIFIED';
    color = color || 'emerald';
  } else if (fullText.includes('screen acting') || fullText.includes('acting') || fullText.includes('audition') || fullText.includes('drama') || fullText.includes('studio')) {
    if (!label || label === 'CERTIFIED' || label === 'N/A') label = 'PROFESSIONAL';
    color = color || 'indigo';
  } else if (fullText.includes('casting') || fullText.includes('workshop') || fullText.includes('sophie') || fullText.includes('faye') || fullText.includes('director')) {
    if (!label || label === 'CERTIFIED' || label === 'N/A') label = 'CASTING WORKSHOP';
    color = color || 'cyan';
  } else {
    if (!label || label === 'N/A') label = 'CERTIFIED';
    color = color || 'emerald';
  }

  const map = {
    amber: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    indigo: 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30',
    purple: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
    rose: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    red: 'bg-rose-500/20 text-rose-400 border border-rose-500/30',
    emerald: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    green: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    cyan: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    blue: 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
  };

  return {
    label,
    colorClass: map[color] || 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
  };
}

function renderSpotlightTraining() {
  const grid = document.getElementById('spotlightTrainingGrid');
  if (!grid) return;
  const training = (appData.training && appData.training.length > 0) ? appData.training : [
    {
      course: 'ECSPC Screen Combat Foundation Certificate',
      institution: 'ECSPC',
      badge: 'PASS / CERTIFIED',
      badgeColor: 'emerald',
      details: 'Rapier & Dagger, Unarmed Combat, Smallsword / Stage Safety & Fight Choreography'
    },
    {
      course: 'Screen Acting & Audition Technique',
      institution: 'London Studios',
      badge: 'PROFESSIONAL',
      badgeColor: 'indigo',
      details: 'Camera Awareness, Scene Study, Character Arc Development & Subtext Delivery'
    },
    {
      course: 'Firearms & Tactical Handling for Film',
      institution: 'Armoury Specialists',
      badge: 'TACTICAL',
      badgeColor: 'rose',
      details: 'Sidearms, Tactical Room Clearance, Law Enforcement Stance, Safety Protocol'
    },
    {
      course: 'Voice, Dialect & Accent Immersion',
      institution: 'UK Vocal',
      badge: 'VOICE & DIALECT',
      badgeColor: 'amber',
      details: 'RP (Received Pronunciation), Heightened British, Urban London & Dialect Placement'
    },
    {
      course: 'Online with Sophie Holland & Faye Timby',
      institution: 'Sophie Holland Casting',
      badge: 'CASTING WORKSHOP',
      badgeColor: 'cyan',
      details: 'Casting Workshop with Director Q&A & Scene Analysis'
    }
  ];

  grid.innerHTML = training.map(t => {
    const badgeInfo = resolveTrainingBadge(t);
    return `
      <div class="p-3 rounded-xl bg-slate-950/70 border border-slate-800/90 space-y-1">
        <div class="flex items-center justify-between">
          <span class="px-2 py-0.5 rounded ${badgeInfo.colorClass} text-[9px] font-black uppercase tracking-wide">${badgeInfo.label}</span>
          <span class="text-[10px] text-slate-400 font-mono-code font-bold">${t.institution || 'Accredited'}</span>
        </div>
        <h4 class="font-extrabold text-white text-xs">${t.course || t.title}</h4>
        <p class="text-[11px] text-slate-300 leading-snug">${t.details || ''}</p>
      </div>
    `;
  }).join('');
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// LIVE HERO CARD & STATS EDITING & FORMATTING PRESERVATION
// --------------------------------------------------------------------------
function formatHeroSummary(text) {
  if (!text) return '';
  // Strip existing HTML tags to avoid nesting
  let clean = text.replace(/<[^>]+>/g, '').trim();
  // Highlight productions and key roles in signature amber bold
  let formatted = clean
    .replace(/(Snickers(?:\s+\(with\s+Saka\s+&\s+Modrić\))?)/gi, '<strong class="text-amber-400">$1</strong>')
    .replace(/(Ted Lasso(?:\s+\(Apple\s+TV\+\))?)/gi, '<strong class="text-amber-400">$1</strong>')
    .replace(/(The Witcher(?:\s+\(Netflix\))?)/gi, '<strong class="text-amber-400">$1</strong>')
    .replace(/(BBC Doctors|Doctors)/gi, '<strong class="text-amber-400">$1</strong>');
  return formatted;
}

function updateLiveHeroCard() {
  const getVal = id => document.getElementById(id)?.value?.trim();

  // Header and Badges
  const actorName = getVal('editHeroActorNameInput');
  const actorSummary = getVal('editHeroActorSummaryInput');
  const badge1 = getVal('editHeroBadge1Input');
  const badge2 = getVal('editHeroBadge2Input');
  const badge3 = getVal('editHeroBadge3Input');

  if (actorName && document.getElementById('heroActorName')) {
    document.getElementById('heroActorName').textContent = actorName;
  }
  if (actorSummary && document.getElementById('heroActorSummary')) {
    document.getElementById('heroActorSummary').innerHTML = formatHeroSummary(actorSummary);
  }
  if (badge1 && document.getElementById('heroBadge1Text')) {
    document.getElementById('heroBadge1Text').textContent = badge1;
  }
  if (badge2 && document.getElementById('heroBadge2')) {
    document.getElementById('heroBadge2').textContent = badge2;
  }
  if (badge3 && document.getElementById('heroBadge3')) {
    document.getElementById('heroBadge3').textContent = badge3;
  }

  // 12 Vitals Grid
  const pAge = getVal('editStatPlayingAge');
  const height = getVal('editStatHeight');
  const build = getVal('editStatBuild');
  const hair = getVal('editStatHair');
  const eyes = getVal('editStatEyes');
  const nats = getVal('editStatNationalities');
  const chest = getVal('editStatChest');
  const waist = getVal('editStatWaist');
  const hips = getVal('editStatHips');
  const inLeg = getVal('editStatInsideLeg');
  const weight = getVal('editStatWeight');
  const collar = getVal('editStatCollar');
  const shoe = getVal('editStatShoeSize');

  if (pAge && document.getElementById('statDisplayPlayingAge')) document.getElementById('statDisplayPlayingAge').textContent = pAge;
  if (height && document.getElementById('statDisplayHeight')) document.getElementById('statDisplayHeight').textContent = height;
  if (build && document.getElementById('statDisplayBuild')) document.getElementById('statDisplayBuild').textContent = build;
  if (hair && eyes && document.getElementById('statDisplayHairEyes')) document.getElementById('statDisplayHairEyes').textContent = `${hair} / ${eyes}`;
  if (nats && document.getElementById('statDisplayNationalities')) document.getElementById('statDisplayNationalities').textContent = nats;
  if (chest && document.getElementById('statDisplayChest')) document.getElementById('statDisplayChest').textContent = chest;
  if (waist && document.getElementById('statDisplayWaist')) document.getElementById('statDisplayWaist').textContent = waist;
  if (hips && document.getElementById('statDisplayHips')) document.getElementById('statDisplayHips').textContent = hips;
  if (inLeg && document.getElementById('statDisplayInsideLeg')) document.getElementById('statDisplayInsideLeg').textContent = inLeg;
  if (weight && document.getElementById('statDisplayWeight')) document.getElementById('statDisplayWeight').textContent = weight;
  if (collar && shoe && document.getElementById('statDisplayCollarShoe')) document.getElementById('statDisplayCollarShoe').textContent = `${collar} / ${shoe}`;
}

// --------------------------------------------------------------------------
// MASTER PAGE SAVES & INDIVIDUAL SECTION SAVES
// --------------------------------------------------------------------------
async function saveAllHomePageData() {
  const confirmSave = confirm('⚠️ Warning: You are about to overwrite the live Home & Casting Hub page content on the website with these changes.\n\nDo you want to proceed and save to the live database?');
  if (!confirmSave) return;

  saveHeroIdentityData();
  saveHeroSummaryData();
  saveHeroStatsData();
  saveTopBannerData();
  saveAgencyData();
  saveSectionTitlesData();
  saveTabNamesData();
  applySiteTexts();
  renderHeroStats();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ All Home & Casting Hub Page content saved permanently to database!' : 'Error saving home page data.');
}

async function saveAllAboutPageData() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.heroBio = document.getElementById('editHeroBio')?.value || appData.siteTexts.heroBio;
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ All About SteveP Timeline content saved permanently to database!' : 'Error saving about page data.');
}

function saveITHeaderData() {
  const getVal = (id, fallback) => document.getElementById(id)?.value?.trim() || fallback || '';
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.itBadge = getVal('editITPageBadge', appData.siteTexts.itBadge);
  appData.siteTexts.itHeading = getVal('editITPageHeading', appData.siteTexts.itHeading);
  appData.siteTexts.itSummary = getVal('editITPageSummary', appData.siteTexts.itSummary);
  appData.siteTexts.itYearsBadge = getVal('editITPageYearsBadge', appData.siteTexts.itYearsBadge);
}

async function saveITHeaderSection() {
  saveITHeaderData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ IT Page Header & Narrative saved to database!' : 'Error saving IT header.');
}

async function saveAllITData() {
  saveITHeaderData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ All 34-Year IT Career Milestones & Page Narrative saved permanently to database!' : 'Error saving IT data.');
}

function populateITAdminInputs() {
  const t = appData.siteTexts || {};
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };
  setVal('editITPageBadge', t.itBadge || 'ENTERPRISE IT & CLOUD SOLUTIONS');
  setVal('editITPageHeading', t.itHeading || '34 Years in IT (Age 17 to 51)');
  setVal('editITPageSummary', t.itSummary || 'Steve Pereira began his career in tech at age 17 in 1992. Now 51 in 2026, he brings over 34 years of battle-tested enterprise architecture expertise, including 5 years living and working in Dubai (UAE) engineering systems for News Group International & Mediawatch Dubai.');
  setVal('editITPageYearsBadge', t.itYearsBadge || '34+');
}

async function saveAllSpotlightData() {
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ All Spotlight PIN, Credits, and Training records saved permanently to database!' : 'Error saving spotlight data.');
}

async function saveAllHacksData() {
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ All Hacks & Deals saved permanently to database!' : 'Error saving hacks data.');
}

async function saveAllMediaData() {
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ All Media Settings & Photo categorizations saved permanently to database!' : 'Error saving media settings.');
}

// Section Data Extraction
function saveHeroIdentityData() {
  const getVal = id => document.getElementById(id)?.value?.trim();
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.actorName = getVal('editHeroActorNameInput') || appData.siteTexts.actorName;
  appData.siteTexts.heroTitle = getVal('editHeroTitle') || appData.siteTexts.heroTitle;
  appData.siteTexts.heroSubtitle = getVal('editHeroSubtitle') || appData.siteTexts.heroSubtitle;
  appData.siteTexts.heroBadge1 = getVal('editHeroBadge1Input') || appData.siteTexts.heroBadge1;
  appData.siteTexts.heroBadge2 = getVal('editHeroBadge2Input') || appData.siteTexts.heroBadge2;
  appData.siteTexts.heroBadge3 = getVal('editHeroBadge3Input') || appData.siteTexts.heroBadge3;
}

async function saveHeroIdentitySection() {
  saveHeroIdentityData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Hero Identity & Status Badges saved to database!' : 'Error saving identity section.');
}

function saveHeroSummaryData() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.actorSummary = document.getElementById('editHeroActorSummaryInput')?.value?.trim() || appData.siteTexts.actorSummary;
}

async function saveHeroSummarySection() {
  const confirmSave = confirm('⚠️ Warning: You are about to overwrite the live Hero Featured Credits Summary on the website.\n\nDo you want to proceed and save to the live database?');
  if (!confirmSave) return;

  saveHeroSummaryData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Hero Featured Credits Summary saved to database!' : 'Error saving summary section.');
}

function saveHeroStatsData() {
  const getVal = (id, fallback) => document.getElementById(id)?.value?.trim() || fallback || '';
  appData.stats = appData.stats || {};
  appData.stats.playingAge = getVal('editStatPlayingAge', appData.stats.playingAge);
  appData.stats.height = getVal('editStatHeight', appData.stats.height);
  appData.stats.build = getVal('editStatBuild', appData.stats.build);
  appData.stats.hair = getVal('editStatHair', appData.stats.hair);
  appData.stats.eyes = getVal('editStatEyes', appData.stats.eyes);
  appData.stats.nationalities = getVal('editStatNationalities', appData.stats.nationalities);
  appData.stats.chest = getVal('editStatChest', appData.stats.chest);
  appData.stats.waist = getVal('editStatWaist', appData.stats.waist);
  appData.stats.hips = getVal('editStatHips', appData.stats.hips);
  appData.stats.insideLeg = getVal('editStatInsideLeg', appData.stats.insideLeg);
  appData.stats.weight = getVal('editStatWeight', appData.stats.weight);
  appData.stats.collar = getVal('editStatCollar', appData.stats.collar);
  appData.stats.shoeSize = getVal('editStatShoeSize', appData.stats.shoeSize);
  appData.stats.accents = getVal('editStatAccents', appData.stats.accents);
}

async function saveHeroCardAndStats() {
  saveHeroStatsData();
  renderHeroStats();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Vital Physical Measurements saved permanently to database!' : 'Error saving measurements.');
}

function saveTopBannerData() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.topBannerPin = document.getElementById('editTopBannerPin')?.value || appData.siteTexts.topBannerPin;
  appData.siteTexts.topBannerAgent = document.getElementById('editTopBannerAgent')?.value || appData.siteTexts.topBannerAgent;
}

async function saveTopBannerSection() {
  saveTopBannerData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Header Banner & Pin Text saved to database!' : 'Error saving banner section.');
}

function saveAgencyData() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.agent1Name = document.getElementById('editAgent1Name')?.value || 'The Central Line';
  appData.siteTexts.agent1Type = document.getElementById('editAgent1Type')?.value || 'Acting & Commercials';
  appData.siteTexts.agent1Phone = document.getElementById('editAgent1Phone')?.value || '020 7434 4771';
  appData.siteTexts.agent1Link = document.getElementById('editAgent1Link')?.value || 'mailto:agency@thecentralline.co.uk';
  appData.siteTexts.agent2Name = document.getElementById('editAgent2Name')?.value || 'Face Management';
  appData.siteTexts.agent2Type = document.getElementById('editAgent2Type')?.value || 'Model & Commercial';
  appData.siteTexts.agent2Phone = document.getElementById('editAgent2Phone')?.value || '0113 245 8667';
  appData.siteTexts.agent2Link = document.getElementById('editAgent2Link')?.value || 'https://facemanagement.co.uk';
}

async function saveAgencySection() {
  saveAgencyData();
  updateAgentHero();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Agency Representation details saved to database!' : 'Error saving agency section.');
}

function saveSectionTitlesData() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.stillsTitle = document.getElementById('editStillsTitle')?.value || appData.siteTexts.stillsTitle;
  appData.siteTexts.headshotsTitle = document.getElementById('editHeadshotsTitle')?.value || appData.siteTexts.headshotsTitle;
  appData.siteTexts.showreelsTitle = document.getElementById('editShowreelsTitle')?.value || appData.siteTexts.showreelsTitle;
  appData.siteTexts.hacksTitle = document.getElementById('editHacksTitle')?.value || appData.siteTexts.hacksTitle;
}

async function saveSectionTitles() {
  saveSectionTitlesData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Portfolio Section Headings saved to database!' : 'Error saving section titles.');
}

function saveTabNamesData() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.tabNames = {
    casting: document.getElementById('editTabNameCasting')?.value || '',
    about: document.getElementById('editTabNameAbout')?.value || '',
    headshots: document.getElementById('editTabNameHeadshots')?.value || '',
    itexpert: document.getElementById('editTabNameIT')?.value || '',
    hacks: document.getElementById('editTabNameHacks')?.value || '',
    sobriety: document.getElementById('editTabNameSobriety')?.value || '',
    booking: document.getElementById('editTabNameBooking')?.value || ''
  };
}

async function saveTabNamesSection() {
  saveTabNamesData();
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Navigation Page Tabs saved to database!' : 'Error saving navigation tab titles.');
}

async function saveHeroBioStorySection() {
  appData.siteTexts = appData.siteTexts || {};
  appData.siteTexts.heroBio = document.getElementById('editHeroBio')?.value || appData.siteTexts.heroBio;
  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Hero Bio Story saved to database!' : 'Error saving hero bio story.');
}

async function saveAboutMilestonesSection() {
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ About SteveP Life Milestones saved to database!' : 'Error saving milestones.');
}

function populateHeroAdminInputs() {
  const s = appData.stats || {};
  const t = appData.siteTexts || {};

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };

  setVal('editHeroActorNameInput', t.actorName || 'STEVE PEREIRA');
  setVal('editHeroActorSummaryInput', t.actorSummary || 'Versatile UK Screen Actor • Playing Age 35–50 • Featured in Snickers (with Saka & Modrić), Ted Lasso (Apple TV+), The Witcher (Netflix) & BBC Doctors.');
  setVal('editHeroTitle', t.heroTitle || 'Steve Pereira: Actor & Screen Producer');
  setVal('editHeroSubtitle', t.heroSubtitle || 'Screen Actor, Executive Producer & Cybersecurity Founder');
  setVal('editHeroBio', t.heroBio || '');
  setVal('editHeroBadge1Input', t.heroBadge1 || 'SPOTLIGHT PIN: 9339-8945-6183');
  setVal('editHeroBadge2Input', t.heroBadge2 || 'EQUITY MEMBER');
  setVal('editHeroBadge3Input', t.heroBadge3 || 'LONDON / UK BASED');

  setVal('editTopBannerPin', t.topBannerPin || 'Spotlight Pin: 9339-8945-6183');
  setVal('editTopBannerAgent', t.topBannerAgent || 'Represented by The Central Line Agency');

  // Populate Stats
  setVal('editStatPlayingAge', s.playingAge || '35 – 50 Yrs');
  setVal('editStatHeight', s.height || '5\'6.5" (169cm)');
  setVal('editStatBuild', s.build || 'Athletic / Toned');
  setVal('editStatHair', s.hair || 'Bald');
  setVal('editStatEyes', s.eyes || 'Brown');
  setVal('editStatNationalities', s.nationalities || 'British / Portuguese');
  setVal('editStatChest', s.chest || '38" (96.5cm)');
  setVal('editStatWaist', s.waist || '30" (76.2cm)');
  setVal('editStatHips', s.hips || '34" (86.4cm)');
  setVal('editStatInsideLeg', s.insideLeg || '28" (71cm)');
  setVal('editStatWeight', s.weight || '63 kg (9st 13)');
  setVal('editStatCollar', s.collar || '15.5" (39.4cm)');
  setVal('editStatShoeSize', s.shoeSize || '7.5 UK / 41 EU');
  setVal('editStatAccents', s.accents || 'RP, London, Cockney, Stage Combat (BADC Pass), Tactical Firearms');

  // If a custom active summary exists in siteTexts, reflect it in the active summary card textarea
  const activeSource = t.activeBioSource || 'ai';
  if (t.actorSummary) {
    if (activeSource === 'ai') {
      const aiEl = document.getElementById('aiGeneratedBioText');
      if (aiEl) aiEl.value = t.actorSummary;
    } else if (activeSource === 'spotlight') {
      const spotEl = document.getElementById('spotlightSelfWrittenDescText');
      if (spotEl) spotEl.value = t.actorSummary;
    }
  }

  // Sync active bio buttons state on load
  updateBioActiveButtons(activeSource);
}

// --------------------------------------------------------------------------
// SPOTLIGHT TRAINING & ACCREDITATIONS CRUD
// --------------------------------------------------------------------------
function renderAdminTrainingTable() {
  const tbody = document.getElementById('adminTrainingTableBody');
  if (!tbody) return;

  const list = appData.training || [];
  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-500">No training records added yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map((t, idx) => {
    const badgeInfo = resolveTrainingBadge(t);
    return `
      <tr class="hover:bg-slate-900/50 transition">
        <td class="p-3 font-bold text-white">${t.course || t.title || ''}</td>
        <td class="p-3 text-slate-300">${t.institution || ''}</td>
        <td class="p-3">
          <span class="px-2 py-0.5 rounded ${badgeInfo.colorClass} font-bold text-[10px] uppercase">${badgeInfo.label}</span>
        </td>
        <td class="p-3 text-slate-400 text-xs max-w-xs truncate">${t.details || ''}</td>
        <td class="p-3 text-right space-x-1">
          <button onclick="editTrainingPrompt(${idx})" class="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-amber-400 hover:bg-slate-800" title="Edit">
            <i data-lucide="edit-2" class="w-3.5 h-3.5"></i>
          </button>
          <button onclick="deleteTraining(${idx})" class="p-1.5 rounded-lg bg-slate-900 border border-slate-700 text-rose-400 hover:bg-slate-800" title="Delete">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function handleSaveTraining(e) {
  e.preventDefault();
  const course = document.getElementById('adminTrainingCourse')?.value.trim();
  const inst = document.getElementById('adminTrainingInstitution')?.value.trim();
  const badge = document.getElementById('adminTrainingBadge')?.value.trim() || 'CERTIFIED';
  const details = document.getElementById('adminTrainingDetails')?.value.trim();

  if (!course || !inst) {
    alert('Please provide Course Name and Institution.');
    return;
  }

  appData.training = appData.training || [];
  appData.training.push({
    course,
    institution: inst,
    badge,
    badgeColor: 'emerald',
    details
  });

  renderSpotlightTraining();
  renderAdminTrainingTable();
  await saveAppDataToServer();

  if (e.target && typeof e.target.reset === 'function') e.target.reset();
  alert('✅ Training / Accreditation record added successfully!');
}

async function editTrainingPrompt(idx) {
  const t = appData.training[idx];
  if (!t) return;

  const course = prompt('Edit Course / Accreditation:', t.course || t.title || '');
  if (course === null) return;
  const inst = prompt('Edit Institution:', t.institution || '');
  if (inst === null) return;
  const badge = prompt('Edit Badge:', t.badge || 'CERTIFIED');
  if (badge === null) return;
  const details = prompt('Edit Details:', t.details || '');
  if (details === null) return;

  t.course = course;
  t.institution = inst;
  t.badge = badge;
  t.details = details;

  renderSpotlightTraining();
  renderAdminTrainingTable();
  await saveAppDataToServer();
}

async function deleteTraining(idx) {
  if (!confirm('Are you sure you want to delete this training accreditation?')) return;
  appData.training.splice(idx, 1);
  renderSpotlightTraining();
  renderAdminTrainingTable();
  await saveAppDataToServer();
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
  const newYear = prompt('Edit Year:', credit.year || '');
  if (newYear === null) return;

  credit.title = newTitle;
  credit.role = newRole;
  credit.year = newYear;
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
// ABOUT TIMELINE COLOR PALETTES & DATE SORTING SYSTEM
// --------------------------------------------------------------------------
const ABOUT_PALETTES = [
  {
    name: 'amber',
    label: '🟡 Amber Gold',
    cardClass: 'timeline-card-amber',
    tagClass: 'timeline-tag-amber',
    yearPill: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    titleColor: 'text-amber-200',
    iconCircle: 'border-amber-500/60 bg-amber-950/60 text-amber-400',
    cmsBorder: 'timeline-cms-row-amber',
    tagPreview: 'bg-rose-500/20 text-rose-300 border-rose-500/40'
  },
  {
    name: 'emerald',
    label: '🟢 Emerald Forest',
    cardClass: 'timeline-card-emerald',
    tagClass: 'timeline-tag-emerald',
    yearPill: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40',
    titleColor: 'text-emerald-200',
    iconCircle: 'border-emerald-500/60 bg-emerald-950/60 text-emerald-400',
    cmsBorder: 'timeline-cms-row-emerald',
    tagPreview: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  {
    name: 'indigo',
    label: '🔵 Indigo Royal',
    cardClass: 'timeline-card-indigo',
    tagClass: 'timeline-tag-indigo',
    yearPill: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
    titleColor: 'text-indigo-200',
    iconCircle: 'border-indigo-500/60 bg-indigo-950/60 text-indigo-400',
    cmsBorder: 'timeline-cms-row-indigo',
    tagPreview: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
  },
  {
    name: 'rose',
    label: '🔴 Rose Ruby',
    cardClass: 'timeline-card-rose',
    tagClass: 'timeline-tag-rose',
    yearPill: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
    titleColor: 'text-rose-200',
    iconCircle: 'border-rose-500/60 bg-rose-950/60 text-rose-400',
    cmsBorder: 'timeline-cms-row-rose',
    tagPreview: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
  {
    name: 'cyan',
    label: '🩵 Cyan Sky',
    cardClass: 'timeline-card-cyan',
    tagClass: 'timeline-tag-cyan',
    yearPill: 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40',
    titleColor: 'text-cyan-200',
    iconCircle: 'border-cyan-500/60 bg-cyan-950/60 text-cyan-400',
    cmsBorder: 'timeline-cms-row-cyan',
    tagPreview: 'bg-purple-500/20 text-purple-300 border-purple-500/40'
  },
  {
    name: 'purple',
    label: '🟣 Purple Violet',
    cardClass: 'timeline-card-purple',
    tagClass: 'timeline-tag-purple',
    yearPill: 'bg-purple-500/20 text-purple-300 border border-purple-500/40',
    titleColor: 'text-purple-200',
    iconCircle: 'border-purple-500/60 bg-purple-950/60 text-purple-400',
    cmsBorder: 'timeline-cms-row-purple',
    tagPreview: 'bg-amber-500/20 text-amber-300 border-amber-500/40'
  },
  {
    name: 'orange',
    label: '🟠 Orange Coral',
    cardClass: 'timeline-card-orange',
    tagClass: 'timeline-tag-orange',
    yearPill: 'bg-orange-500/20 text-orange-300 border border-orange-500/40',
    titleColor: 'text-orange-200',
    iconCircle: 'border-orange-500/60 bg-orange-950/60 text-orange-400',
    cmsBorder: 'timeline-cms-row-orange',
    tagPreview: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
  },
  {
    name: 'fuchsia',
    label: '🌸 Fuchsia Magenta',
    cardClass: 'timeline-card-fuchsia',
    tagClass: 'timeline-tag-fuchsia',
    yearPill: 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40',
    titleColor: 'text-fuchsia-200',
    iconCircle: 'border-fuchsia-500/60 bg-fuchsia-950/60 text-fuchsia-400',
    cmsBorder: 'timeline-cms-row-fuchsia',
    tagPreview: 'bg-teal-500/20 text-teal-300 border-teal-500/40'
  }
];

function getTimelinePalette(idx, item) {
  if (item && item.colorTheme && item.colorTheme !== 'auto') {
    const found = ABOUT_PALETTES.find(p => p.name === item.colorTheme);
    if (found) return found;
  }
  return ABOUT_PALETTES[idx % ABOUT_PALETTES.length];
}

function getInitialDateValue(item) {
  if (!item) return 9999;
  const str = String(item.year || item.date || item.title || '').trim().toLowerCase();
  
  // 1. Birth / Earliest event (excluding rebirth)
  if (/\b(born|birth|premature|infirmary|friday the 13th|friday 13th)\b/i.test(str) && !str.includes('rebirth')) {
    return 1974.1;
  }
  
  // 2. Extract first 4-digit year e.g. 1992, 1994, 2008, 2013
  const match = str.match(/\b(19\d{2}|20\d{2})\b/);
  if (match) return parseInt(match[1], 10);
  
  // 3. Fallbacks for key events
  if (str.includes('phoenix') || str.includes('gatwick') || str.includes('rebirth') || str.includes('cardiac')) return 2013.1;
  if (str.includes('sober') || str.includes('kmst')) return 2013.2;
  if (str.includes('present') || str.includes('today') || str.includes('current')) return 2026;
  
  return 2000;
}

function renderAboutTimeline() {
  const container = document.getElementById('aboutTimelineGrid');
  if (!container) return;

  const rawItems = appData.aboutTimeline || [];
  if (rawItems.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 font-mono-code text-xs">No timeline events found. Add them in the Admin CMS!</div>`;
    return;
  }

  // Sort chronologically by initial date field
  const items = [...rawItems].sort((a, b) => getInitialDateValue(a) - getInitialDateValue(b));

  const layout = appData.layouts?.about || 'zigzag';

  if (layout === 'zigzag') {
    container.className = "relative space-y-8 before:absolute before:inset-0 before:left-1/2 before:-translate-x-1/2 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-amber-500 before:via-rose-500 before:to-indigo-500";
    container.innerHTML = items.map((item, idx) => {
      const pal = getTimelinePalette(idx, item);
      const webLink = item.url ? `
        <div class="pt-2">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition shadow-sm group/link">
            <i data-lucide="external-link" class="w-3.5 h-3.5 text-amber-400 group-hover/link:translate-x-0.5 transition"></i>
            <span>${escapeHtml(item.urlText || 'Visit Official Web Page')}</span>
          </a>
        </div>
      ` : '';

      return `
        <div class="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
          <div class="flex items-center justify-center w-10 h-10 rounded-full border ${pal.iconCircle} group-hover:scale-110 transition shrink-0 shadow-lg z-10">
            <i data-lucide="${item.icon || 'star'}" class="w-5 h-5"></i>
          </div>
          <div class="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] glass-card p-5 sm:p-6 rounded-2xl border ${pal.cardClass} space-y-2.5 transition backdrop-blur-xl">
            <div class="flex flex-wrap items-center justify-between gap-2">
              <span class="px-3 py-0.5 rounded-full ${pal.yearPill} text-xs font-black font-mono-code">${escapeHtml(item.year || item.date || '')}</span>
              <span class="px-2.5 py-0.5 rounded-full ${pal.tagClass} text-[11px] font-extrabold uppercase tracking-wider font-mono-code shadow-sm">${escapeHtml(item.tag || item.category || 'MILESTONE')}</span>
            </div>
            <h3 class="text-lg font-black text-white font-cinzel tracking-wide">${escapeHtml(item.title)}</h3>
            ${item.location ? `<p class="text-[11px] text-slate-400 font-mono-code flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${escapeHtml(item.location)}</p>` : ''}
            <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${escapeHtml(item.desc)}</p>
            ${webLink}
          </div>
        </div>
      `;
    }).join('');
  } else if (layout === 'roadmap') {
    container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5";
    container.innerHTML = items.map((item, idx) => {
      const pal = getTimelinePalette(idx, item);
      const webLink = item.url ? `
        <div class="pt-2">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition">
            <i data-lucide="external-link" class="w-3 h-3 text-amber-400"></i>
            <span>${escapeHtml(item.urlText || 'Web Page')}</span>
          </a>
        </div>
      ` : '';

      return `
        <div class="glass-card p-5 rounded-2xl border ${pal.cardClass} space-y-3 transition shadow-lg flex flex-col justify-between backdrop-blur-xl">
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <span class="px-3 py-1 rounded-full ${pal.yearPill} font-black text-xs font-mono-code">Step ${idx + 1} • ${escapeHtml(item.year || item.date || '')}</span>
              <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[10px] font-extrabold uppercase font-mono-code">${escapeHtml(item.tag || 'ERA')}</span>
            </div>
            <h3 class="text-base font-black text-white font-cinzel">${escapeHtml(item.title)}</h3>
            ${item.location ? `<p class="text-[10px] text-slate-400 font-mono-code">${escapeHtml(item.location)}</p>` : ''}
            <p class="text-slate-300 text-xs leading-relaxed whitespace-pre-line">${escapeHtml(item.desc)}</p>
            ${webLink}
          </div>
          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono-code">
            <span>Milestone #${idx + 1}</span>
            <span>SteveP Journey</span>
          </div>
        </div>
      `;
    }).join('');
  } else if (layout === 'story-cards') {
    container.className = "space-y-6";
    const first = items[0];
    const rest = items.slice(1);
    const pal0 = getTimelinePalette(0, first);

    container.innerHTML = `
      ${first ? `
        <div class="glass-card p-6 sm:p-8 rounded-3xl border ${pal0.cardClass} space-y-3 shadow-2xl backdrop-blur-xl">
          <div class="flex items-center justify-between gap-2">
            <span class="px-3 py-1 rounded-full ${pal0.yearPill} font-black text-xs font-mono-code">INITIAL MILESTONE • ${escapeHtml(first.year || first.date || '')}</span>
            <span class="px-2.5 py-0.5 rounded-full ${pal0.tagClass} text-xs font-extrabold uppercase font-mono-code">${escapeHtml(first.tag || 'HIGHLIGHT')}</span>
          </div>
          <h3 class="text-2xl font-black text-white font-cinzel">${escapeHtml(first.title)}</h3>
          ${first.location ? `<p class="text-xs text-slate-400 font-mono-code">${escapeHtml(first.location)}</p>` : ''}
          <p class="text-slate-200 text-sm leading-relaxed whitespace-pre-line">${escapeHtml(first.desc)}</p>
          ${first.url ? `
            <div class="pt-2">
              <a href="${escapeHtml(first.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition">
                <i data-lucide="external-link" class="w-3.5 h-3.5 text-amber-400"></i>
                <span>${escapeHtml(first.urlText || 'Visit Official Web Page')}</span>
              </a>
            </div>
          ` : ''}
        </div>
      ` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
        ${rest.map((item, i) => {
          const pal = getTimelinePalette(i + 1, item);
          return `
            <div class="glass-card p-6 rounded-2xl border ${pal.cardClass} space-y-2.5 transition backdrop-blur-xl flex flex-col justify-between">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded-full ${pal.yearPill} font-mono-code font-bold text-xs">${escapeHtml(item.year || item.date || '')}</span>
                  <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[10px] font-extrabold uppercase font-mono-code">${escapeHtml(item.tag || 'MILESTONE')}</span>
                </div>
                <h4 class="text-lg font-black text-white font-cinzel">${escapeHtml(item.title)}</h4>
                ${item.location ? `<p class="text-[10px] text-slate-400 font-mono-code">${escapeHtml(item.location)}</p>` : ''}
                <p class="text-slate-300 text-xs leading-relaxed whitespace-pre-line">${escapeHtml(item.desc)}</p>
              </div>
              ${item.url ? `
                <div class="pt-2 border-t border-slate-800/80">
                  <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition">
                    <i data-lucide="external-link" class="w-3 h-3 text-amber-400"></i>
                    <span>${escapeHtml(item.urlText || 'Web Page')}</span>
                  </a>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function renderITTimeline() {
  const container = document.getElementById('itTimelineContainer');
  if (!container) return;

  const items = appData.itTimeline || [];
  if (items.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 font-mono-code text-xs">No IT career milestones found. Add them in the Admin CMS!</div>`;
    return;
  }

  const layout = appData.layouts?.it || 'blueprint';

  if (layout === 'blueprint') {
    container.className = "space-y-4";
    container.innerHTML = items.map(item => `
      <div class="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 backdrop-blur-md hover:border-cyan-500/40 transition">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-black font-mono-code">${item.year}</span>
          <span class="text-xs font-bold text-slate-300">${item.company || ''}</span>
        </div>
        <h4 class="text-white font-bold text-base font-cinzel">${item.title}</h4>
        <p class="text-slate-300 text-xs leading-relaxed">${item.desc}</p>
      </div>
    `).join('');
  } else if (layout === 'terminal') {
    container.className = "space-y-3 font-mono-code text-xs";
    container.innerHTML = `
      <div class="p-5 rounded-2xl bg-slate-950 border border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] space-y-4">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px] text-cyan-400">
          <span>root@stevep-architect:~$ it-log --all</span>
          <span class="text-emerald-400 font-bold">STATUS: 34 YRS ACTIVE</span>
        </div>
        <div class="space-y-3">
          ${items.map((item, idx) => `
            <div class="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-1 hover:border-cyan-400/60 transition">
              <div class="flex items-center justify-between text-cyan-300 text-xs font-bold">
                <span>[${item.year}] > ${item.company || 'Enterprise'}</span>
                <span class="text-[10px] text-slate-500">ID: ARCH_0${idx + 1}</span>
              </div>
              <h5 class="text-white font-bold">${item.title}</h5>
              <p class="text-slate-300 text-[11px] font-sans">${item.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  } else if (layout === 'consulting') {
    container.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
    container.innerHTML = items.map((item, idx) => `
      <div class="glass-card p-5 rounded-2xl border border-slate-800 space-y-3 hover:border-cyan-400 transition flex flex-col justify-between">
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs font-black font-mono-code">${item.year}</span>
            <span class="text-xs font-bold text-slate-300">${item.company || 'Consultancy'}</span>
          </div>
          <h4 class="text-base font-black text-white font-cinzel">${item.title}</h4>
          <p class="text-slate-300 text-xs leading-relaxed">${item.desc}</p>
        </div>
        <div class="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono-code">
          <span>Case Study #${idx + 1}</span>
          <span class="text-cyan-400">Enterprise Delivery</span>
        </div>
      </div>
    `).join('');
  }

  if (window.lucide) lucide.createIcons();
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
// HACKS & MONEY SAVING DEALS (MULTI-LAYOUT SYSTEM)
// --------------------------------------------------------------------------
let currentHacksFilter = 'all';
let currentHacksCategory = 'all';

function setHacksFilter(filter) {
  currentHacksFilter = filter;
  ['all', 'top', 'discount', 'clicked', 'used'].forEach(f => {
    const btn = document.getElementById(`btnFilter-${f}`);
    if (btn) {
      if (f === filter) {
        btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-black transition bg-emerald-500 text-slate-950 shadow';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-amber-400 hover:bg-slate-900 transition';
      }
    }
  });
  renderHacks();
}

function setHacksCategory(cat) {
  currentHacksCategory = cat;
  renderHacks();
}

function renderHacks() {
  const mainContainer = document.getElementById('hacksGrid');
  const topOffersContainer = document.getElementById('stevesTopOffersContainer');
  const countBadge = document.getElementById('hacksCountBadge');
  if (!mainContainer) return;

  let hacks = [...(appData.hacks || [])];

  // Calculate default values if missing
  hacks = hacks.map(h => {
    let logoSrc = h.logo;
    if (!logoSrc && h.link && h.link.length > 8) {
      try {
        const hostname = new URL(h.link.startsWith('http') ? h.link : 'https://' + h.link).hostname;
        logoSrc = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
      } catch(e) {}
    }
    const defaultImg = h.image || 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80';
    const clicks = h.clicks || 0;
    const usedCount = h.usedCount || (h.clicks ? Math.floor(h.clicks * 0.8) : 5);
    const discountPercent = h.discountPercent || (h.badge && h.badge.includes('%') ? parseInt(h.badge) : 20);

    return {
      ...h,
      logo: logoSrc,
      image: defaultImg,
      clicks,
      usedCount,
      discountPercent,
      isTopOffer: h.isTopOffer !== undefined ? h.isTopOffer : (h.badge === 'EXCLUSIVE' || h.badge === 'STEVE RECOMMENDS' || h.clicks > 10)
    };
  });

  const layout = appData.layouts?.hacks || 'cards-deck';

  // Render Steve's Top Offers Showcase Banner if in cards or bento mode
  if (topOffersContainer) {
    if (layout === 'table-list') {
      topOffersContainer.innerHTML = '';
    } else {
      const topOffers = hacks.filter(h => h.isTopOffer);
      if (topOffers.length > 0) {
        topOffersContainer.innerHTML = `
          <div class="glass-card rounded-3xl border-2 border-amber-500/40 p-6 space-y-4 relative overflow-hidden bg-gradient-to-r from-slate-950 via-amber-950/20 to-slate-950 shadow-2xl">
            <div class="flex items-center justify-between">
              <span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black uppercase flex items-center gap-1">
                🔥 Steve's Top Offers & Recommendations
              </span>
              <span class="text-xs text-slate-400 font-mono-code">${topOffers.length} Featured Deals</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              ${topOffers.slice(0, 2).map(h => `
                <div class="glass-card rounded-2xl border border-amber-500/30 p-4 flex gap-4 items-center bg-slate-950/80 hover:border-amber-400 transition group">
                  <div class="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800 relative">
                    <img src="${h.image}" alt="${h.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    ${h.logo ? `<img src="${h.logo}" class="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-slate-950 p-0.5 border border-slate-700 shadow" onerror="this.style.display='none'">` : ''}
                  </div>
                  <div class="flex-1 min-w-0 space-y-1">
                    <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black">${h.badge || 'DEAL'}</span>
                    <h5 class="text-white font-black text-sm truncate">${h.title}</h5>
                    <div class="flex items-center gap-2 pt-1">
                      <button onclick="copyHackCode('${h.code}', '${h.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono-code font-bold text-xs">
                        ${h.code || 'CLAIM'}
                      </button>
                      <a href="${h.link}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-3 py-1 rounded-lg bg-amber-500 text-slate-950 font-black text-xs">
                        Visit Deal &rarr;
                      </a>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      } else {
        topOffersContainer.innerHTML = '';
      }
    }
  }

  // Filter category & sort
  let filtered = [...hacks];
  if (currentHacksCategory !== 'all') {
    filtered = filtered.filter(h => h.category === currentHacksCategory);
  }

  if (currentHacksFilter === 'top') {
    filtered.sort((a, b) => b.clicks - a.clicks);
  } else if (currentHacksFilter === 'discount') {
    filtered.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
  } else if (currentHacksFilter === 'clicked') {
    filtered.sort((a, b) => b.clicks - a.clicks);
  } else if (currentHacksFilter === 'used') {
    filtered.sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0));
  }

  if (countBadge) countBadge.textContent = `${filtered.length} Verified Deals & Hacks`;

  if (filtered.length === 0) {
    mainContainer.innerHTML = `<div class="col-span-full py-12 text-center text-xs text-slate-400">No deals found in this category. Add deals in Admin Hacks.</div>`;
    return;
  }

  if (layout === 'cards-deck') {
    mainContainer.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    mainContainer.innerHTML = filtered.map(h => `
      <div class="glass-card rounded-3xl overflow-hidden border border-slate-800 hover:border-emerald-400/80 transition duration-300 flex flex-col justify-between group shadow-xl">
        <div class="relative aspect-video w-full overflow-hidden bg-slate-900">
          <img src="${h.image}" alt="${h.title}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
          <span class="absolute top-3 left-3 px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono-code shadow-md">${h.badge || 'DEAL'}</span>
        </div>
        <div class="p-5 space-y-3 flex-1 flex flex-col justify-between">
          <div class="space-y-2">
            <div class="flex items-center gap-3">
              <img src="${h.logo || 'https://www.google.com/s2/favicons?domain=github.com&sz=128'}" class="w-8 h-8 rounded-xl object-contain bg-slate-900 p-1 border border-slate-700 shadow" alt="Logo">
              <div>
                <h4 class="font-black text-white text-sm font-cinzel leading-tight">${h.title}</h4>
                <span class="text-[10px] font-mono-code text-slate-400">${h.category || 'Tech'}</span>
              </div>
            </div>
            <p class="text-slate-300 text-xs leading-relaxed line-clamp-2">${h.desc || ''}</p>
          </div>
          <div class="space-y-2 pt-2 border-t border-slate-800/80">
            <div class="flex items-center justify-between gap-2">
              <span class="font-mono-code font-bold text-amber-400 text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 select-all">${h.code || 'NO CODE NEEDED'}</span>
              <button onclick="copyHackCode('${h.code}', '${h.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold text-xs transition">Copy Code</button>
            </div>
            <a href="${h.link}" target="_blank" onclick="trackHackClick('${h.id}')" class="w-full py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition">
              <span>Claim Deal</span> <i data-lucide="external-link" class="w-3 h-3"></i>
            </a>
          </div>
        </div>
      </div>
    `).join('');
  } else if (layout === 'table-list') {
    mainContainer.className = "col-span-full space-y-3";
    mainContainer.innerHTML = `
      <div class="overflow-x-auto rounded-2xl border border-slate-800 glass-card">
        <table class="w-full text-left text-xs">
          <thead class="bg-slate-900/90 text-slate-300 font-mono-code text-[11px] uppercase border-b border-slate-800">
            <tr>
              <th class="p-3.5">Company / Deal</th>
              <th class="p-3.5">Category</th>
              <th class="p-3.5">Discount Tag</th>
              <th class="p-3.5">Promo Code</th>
              <th class="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${filtered.map(h => `
              <tr class="hover:bg-slate-900/50 transition">
                <td class="p-3.5 flex items-center gap-3">
                  <img src="${h.logo || 'https://www.google.com/s2/favicons?domain=github.com&sz=128'}" class="w-7 h-7 rounded-lg object-contain bg-slate-900 p-1 border border-slate-700" alt="Logo">
                  <div>
                    <strong class="text-white font-bold block">${h.title}</strong>
                    <span class="text-[10px] text-slate-400">${h.desc ? h.desc.substring(0, 45) + '...' : ''}</span>
                  </div>
                </td>
                <td class="p-3.5 text-slate-300 font-mono-code text-[11px]">${h.category || 'Tech'}</td>
                <td class="p-3.5"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono-code text-[10px]">${h.badge || 'DEAL'}</span></td>
                <td class="p-3.5">
                  <span class="font-mono-code font-bold text-amber-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-xs select-all">${h.code || 'AUTOMATIC'}</span>
                </td>
                <td class="p-3.5 text-right">
                  <div class="inline-flex items-center gap-2">
                    <button onclick="copyHackCode('${h.code}', '${h.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold text-[11px] transition">Copy</button>
                    <a href="${h.link}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow">Claim</a>
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } else if (layout === 'bento-deals') {
    const top3 = filtered.slice(0, 3);
    const rest = filtered.slice(3);
    mainContainer.className = "col-span-full space-y-6";
    mainContainer.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
        ${top3.map((h, i) => `
          <div class="glass-card p-5 rounded-3xl border border-emerald-500/40 bg-gradient-to-b from-slate-900/90 to-emerald-950/20 space-y-3 shadow-xl">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] font-mono-code">HOT DEAL #${i + 1}</span>
              <img src="${h.logo || 'https://www.google.com/s2/favicons?domain=github.com&sz=128'}" class="w-7 h-7 rounded-lg object-contain bg-slate-900 p-0.5" alt="Logo">
            </div>
            <h4 class="font-black text-white text-base font-cinzel leading-tight">${h.title}</h4>
            <p class="text-slate-300 text-xs line-clamp-2">${h.desc || ''}</p>
            <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <span class="font-mono-code font-bold text-amber-400 text-xs">${h.code || 'DIRECT DEAL'}</span>
              <a href="${h.link}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow transition">Claim Deal</a>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        ${rest.map(h => `
          <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2 hover:border-emerald-400 transition">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono-code">${h.badge || 'DEAL'}</span>
              <span class="text-[10px] text-slate-400 font-mono-code">${h.category || 'Tech'}</span>
            </div>
            <h5 class="font-bold text-white text-xs truncate">${h.title}</h5>
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <span class="text-amber-400 font-mono-code font-bold text-xs truncate">${h.code || 'AUTOMATIC'}</span>
              <a href="${h.link}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold text-[11px] transition">Claim</a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
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
// EXPANDED ADMIN CMS PORTAL & SUB-TABS (PAGE-BY-PAGE ORDER)
// --------------------------------------------------------------------------
function setAdminSubTab(subTab) {
  // Alias mapping for backwards compatibility and clean routing
  const aliasMap = {
    'sitetexts': 'hero',
    'timelines': 'about',
    'itexpert': 'it'
  };
  const actualTab = aliasMap[subTab] || subTab || 'spotlight';

  document.querySelectorAll('.admin-section').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`adminSection-${actualTab}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.admin-subnav-btn').forEach(btn => {
    btn.classList.remove('bg-amber-500/20', 'text-amber-400', 'border-amber-500/30');
    btn.classList.add('bg-slate-900', 'text-slate-300');
  });

  const activeBtn = document.getElementById(`adminSubNav-${actualTab}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-900', 'text-slate-300');
    activeBtn.classList.add('bg-amber-500/20', 'text-amber-400', 'border-amber-500/30');
  }

  if (actualTab === 'analytics' && typeof loadAnalyticsDashboard === 'function') {
    loadAnalyticsDashboard();
  }
  if (actualTab === 'media' && typeof renderAdminMediaGrid === 'function') {
    renderAdminMediaGrid();
  }
  if (actualTab === 'themes' && typeof renderAdminThemes === 'function') {
    renderAdminThemes();
  }
  if (actualTab === 'backup' && typeof renderBackupDashboard === 'function') {
    renderBackupDashboard();
  }
  if (actualTab === 'hero' || actualTab === 'spotlight' || actualTab === 'about') {
    if (typeof populateHeroAdminInputs === 'function') populateHeroAdminInputs();
  }
  if (actualTab === 'it') {
    if (typeof populateITAdminInputs === 'function') populateITAdminInputs();
    if (typeof renderAdminTimelines === 'function') renderAdminTimelines();
  }
  if (actualTab === 'seo') {
    if (typeof updateSEODisplay === 'function') updateSEODisplay();
  }
  if (window.lucide) lucide.createIcons();
}

function handleAdminLogin(e) {
  e.preventDefault();
  const pin = document.getElementById('adminPinInput')?.value;
  if (pin === '1234' || pin === 'admin' || pin === '9339') {
    document.getElementById('adminLockScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    populateHeroAdminInputs();
    populateITAdminInputs();
    updateSEODisplay();
    setAdminSubTab('spotlight');
    renderAdminMediaGrid();
  } else {
    alert('Incorrect Admin PIN. Try 1234');
  }
}

function lockAdmin() {
  document.getElementById('adminLockScreen')?.classList.remove('hidden');
  document.getElementById('adminDashboard')?.classList.add('hidden');
}


// ===========================================================================
// ADVANCED ANALYTICS DASHBOARD
// ===========================================================================

let _analyticsData = null;
let _analyticsTab = 'overview';
let _analyticsFilter = { eventType: '', country: '', device: '', search: '' };

async function loadAnalyticsDashboard() {
  const loadingEl = document.getElementById('analyticsLoadingSpinner');
  if (loadingEl) loadingEl.classList.remove('hidden');
  try {
    const res = await fetch('/api/analytics');
    if (res.ok) {
      const json = await res.json();
      if (json.success) {
        _analyticsData = json;
        renderAnalyticsDashboard();
      }
    }
  } catch(e) {
    console.log('Analytics fetch error', e);
  }
  if (loadingEl) loadingEl.classList.add('hidden');
}
window.loadAnalyticsDashboard = loadAnalyticsDashboard;

function setAnalyticsTab(tab) {
  _analyticsTab = tab;
  document.querySelectorAll('.analytics-tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tab;
    btn.className = isActive
      ? 'analytics-tab-btn px-3 py-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/40 font-black text-xs whitespace-nowrap'
      : 'analytics-tab-btn px-3 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white font-bold text-xs whitespace-nowrap transition';
    btn.dataset.tab = btn.dataset.tab;
  });
  document.querySelectorAll('.analytics-panel').forEach(p => p.classList.add('hidden'));
  const panel = document.getElementById(`analyticsPanel-${tab}`);
  if (panel) panel.classList.remove('hidden');
  renderAnalyticsPanel(tab);
}
window.setAnalyticsTab = setAnalyticsTab;

function countryFlag(code) {
  if (!code || code === 'XX') return '🌍';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
}

function sourceIcon(source) {
  const icons = {
    'Google': '🔍', 'Bing': '🔎', 'DuckDuckGo': '🦆', 'Yahoo': '📬', 'Yandex': '🌐',
    'Facebook': '📘', 'Instagram': '📸', 'X (Twitter)': '🐦', 'LinkedIn': '💼',
    'Spotlight UK': '⭐', 'IMDb': '🎬', 'Direct': '🔗', 'Other Referral': '↗️',
    'Self (stevepereira)': '🏠'
  };
  return icons[source] || '🌐';
}

function deviceIcon(device) {
  const icons = { 'Desktop': '🖥️', 'Mobile': '📱', 'Tablet': '📋', 'Bot': '🤖' };
  return icons[device] || '💻';
}

function renderAnalytics() {
  loadAnalyticsDashboard();
}

function renderAnalyticsDashboard() {
  if (!_analyticsData) return;
  const s = _analyticsData.summary || {};

  // KPI cards
  const kpis = [
    { id: 'kpi-views', val: s.pageViews || 0, label: 'Page Views', color: 'text-blue-400', icon: '👁️' },
    { id: 'kpi-spotlight', val: s.spotlightClicks || 0, label: 'Spotlight Clicks', color: 'text-amber-400', icon: '⭐' },
    { id: 'kpi-showreel', val: s.showreelPlays || 0, label: 'Showreel Plays', color: 'text-indigo-400', icon: '🎬' },
    { id: 'kpi-cv', val: s.cvDownloads || 0, label: 'CV Downloads', color: 'text-emerald-400', icon: '📄' },
    { id: 'kpi-booking', val: s.bookingEnquiries || 0, label: 'Enquiries', color: 'text-rose-400', icon: '📩' },
    { id: 'kpi-affiliate', val: s.affiliateClicks || 0, label: 'Affiliate Clicks', color: 'text-cyan-400', icon: '🔗' },
    { id: 'kpi-events', val: s.totalEvents || 0, label: 'Total Events', color: 'text-purple-400', icon: '📊' },
  ];

  kpis.forEach(k => {
    const el = document.getElementById(k.id);
    if (el) el.innerHTML = `<span class="text-2xl font-black ${k.color}">${(k.val).toLocaleString()}</span><span class="text-[10px] text-slate-400 block mt-0.5 font-mono-code uppercase">${k.icon} ${k.label}</span>`;
  });

  // Render active panel
  renderAnalyticsPanel(_analyticsTab);
}

function renderBar(label, count, total, colorClass = 'bg-amber-500', icon = '') {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return `
    <div class="space-y-1">
      <div class="flex items-center justify-between text-xs">
        <span class="text-slate-200 font-bold flex items-center gap-1.5">${icon} ${label}</span>
        <span class="text-slate-400 font-mono-code">${count.toLocaleString()} <span class="text-slate-500">(${pct}%)</span></span>
      </div>
      <div class="w-full h-2.5 rounded-full bg-slate-900 border border-slate-800 overflow-hidden">
        <div class="h-full ${colorClass} rounded-full transition-all duration-700" style="width:${pct}%"></div>
      </div>
    </div>
  `;
}

function renderAnalyticsPanel(tab) {
  if (!_analyticsData) return;
  const d = _analyticsData;

  if (tab === 'overview') {
    const panel = document.getElementById('analyticsPanel-overview');
    if (!panel) return;

    // Timeline chart
    const timeline = d.timeline || [];
    const maxTL = Math.max(...timeline.map(t => t.count), 1);
    const timelineHtml = timeline.length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No timeline data yet. Events will appear here as visitors arrive.</p>' :
      `<div class="flex items-end gap-1 h-24 pt-2">
        ${timeline.slice(-30).map(t => {
          const h = Math.max(4, Math.round((t.count / maxTL) * 96));
          const dateStr = new Date(t.date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
          return `<div class="flex-1 flex flex-col items-center gap-1 group relative">
            <div class="w-full bg-amber-500/80 hover:bg-amber-400 rounded-t transition cursor-pointer" style="height:${h}px" title="${dateStr}: ${t.count} events"></div>
            <span class="text-[8px] text-slate-500 rotate-45 origin-top-left hidden group-hover:block absolute bottom-0 left-0">${dateStr}</span>
          </div>`;
        }).join('')}
      </div>
      <div class="flex justify-between text-[10px] text-slate-500 font-mono-code mt-1">
        <span>${timeline.length > 0 ? new Date(timeline[Math.max(0, timeline.length-30)].date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : ''}</span>
        <span>${timeline.length > 0 ? new Date(timeline[timeline.length-1].date).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' }) : ''}</span>
      </div>`;

    // Pages breakdown
    const pages = d.pages || [];
    const totalPV = pages.reduce((s, p) => s + p.count, 0) || 1;
    const pageColors = ['bg-amber-500', 'bg-blue-500', 'bg-indigo-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500', 'bg-purple-500'];
    const pagesHtml = pages.length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No page data yet.</p>' :
      pages.slice(0, 8).map((p, i) => renderBar(p.name, p.count, totalPV, pageColors[i % pageColors.length])).join('');

    panel.innerHTML = `
      <div class="space-y-6">
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>📈</span> Activity Timeline (Last 30 Days)
          </h4>
          ${timelineHtml}
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
            <span>📄</span> Top Pages / Sections Visited
          </h4>
          <div class="space-y-3">${pagesHtml}</div>
        </div>
      </div>`;
  }

  if (tab === 'sources') {
    const panel = document.getElementById('analyticsPanel-sources');
    if (!panel) return;
    const sources = d.sources || [];
    const total = sources.reduce((s, x) => s + x.count, 0) || 1;
    const srcColors = { search: 'bg-blue-500', social: 'bg-rose-500', referral: 'bg-emerald-500', direct: 'bg-amber-500', internal: 'bg-purple-500' };
    const srcMediums = {};
    (d.recentEvents || []).forEach(ev => { const src = ev.source || 'Direct'; srcMediums[src] = ev.medium || 'direct'; });

    panel.innerHTML = `
      <div class="space-y-6">
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🔍 Traffic Sources</h4>
          <div class="space-y-3">
            ${sources.length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No source data yet. Send your link around!</p>' :
              sources.map(s => {
                const med = srcMediums[s.name] || 'direct';
                return renderBar(s.name, s.count, total, srcColors[med] || 'bg-slate-500', sourceIcon(s.name));
              }).join('')}
          </div>
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">📊 Traffic Medium Breakdown</h4>
          <div class="grid grid-cols-3 gap-3 text-center text-xs">
            ${['search', 'social', 'direct', 'referral', 'internal'].map(med => {
              const cnt = (d.recentEvents || []).filter(ev => (ev.medium || 'direct') === med).length;
              const colors = { search: 'text-blue-400', social: 'text-rose-400', direct: 'text-amber-400', referral: 'text-emerald-400', internal: 'text-purple-400' };
              return `<div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1">
                <strong class="text-lg font-black ${colors[med] || 'text-white'}">${cnt}</strong>
                <span class="text-slate-400 block uppercase font-mono-code text-[9px]">${med}</span>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🔗 Affiliate Link Performance</h4>
          <div class="space-y-2">
            ${Object.entries(d.hacksStats || {}).length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No affiliate clicks tracked yet.</p>' :
              Object.entries(d.hacksStats || {}).sort((a,b) => b[1] - a[1]).map(([name, cnt]) =>
                renderBar(name, cnt, Math.max(...Object.values(d.hacksStats || {}), 1), 'bg-emerald-500', '💰')
              ).join('')}
          </div>
        </div>
      </div>`;
  }

  if (tab === 'geo') {
    const panel = document.getElementById('analyticsPanel-geo');
    if (!panel) return;
    const countries = d.countries || [];
    const cities = d.cities || [];
    const total = countries.reduce((s, c) => s + c.count, 0) || 1;
    const cityTotal = cities.reduce((s, c) => s + c.count, 0) || 1;

    panel.innerHTML = `
      <div class="space-y-6">
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🌍 Visitors by Country</h4>
          ${countries.length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No geo data yet. Events appear here as visitors arrive from the internet.</p>' :
            `<div class="space-y-2.5">
              ${countries.slice(0, 15).map((c, i) => {
                const colors = ['bg-amber-500', 'bg-blue-500', 'bg-emerald-500', 'bg-rose-500', 'bg-cyan-500', 'bg-purple-500', 'bg-indigo-500'];
                return renderBar(`${countryFlag(c.code)} ${c.name}`, c.count, total, colors[i % colors.length]);
              }).join('')}
            </div>`}
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🏙️ Top Cities</h4>
          ${cities.length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No city data yet.</p>' :
            `<div class="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              ${cities.slice(0, 9).map((c, i) => `
                <div class="p-3 rounded-xl bg-slate-950/80 border border-slate-800 space-y-0.5">
                  <strong class="text-white font-bold text-sm">${c.count}</strong>
                  <span class="text-slate-400 block text-[10px]">${c.name}</span>
                </div>`).join('')}
            </div>`}
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">📋 Full Country Table</h4>
          <div class="overflow-x-auto">
            <table class="w-full text-xs">
              <thead class="text-left text-slate-400 font-mono-code uppercase text-[10px] border-b border-slate-800">
                <tr><th class="pb-2 pr-4">Country</th><th class="pb-2 pr-4">Visits</th><th class="pb-2">% Share</th></tr>
              </thead>
              <tbody class="divide-y divide-slate-800/50">
                ${countries.map(c => `
                  <tr class="hover:bg-slate-900/40 transition">
                    <td class="py-2 pr-4 font-bold text-white">${countryFlag(c.code)} ${c.name}</td>
                    <td class="py-2 pr-4 text-amber-400 font-mono-code font-bold">${c.count}</td>
                    <td class="py-2 text-slate-400">${total > 0 ? Math.round((c.count/total)*100) : 0}%</td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
  }

  if (tab === 'devices') {
    const panel = document.getElementById('analyticsPanel-devices');
    if (!panel) return;
    const devices = d.devices || [];
    const browsers = d.browsers || [];
    const osData = d.os || [];
    const devTotal = devices.reduce((s, x) => s + x.count, 0) || 1;
    const brTotal = browsers.reduce((s, x) => s + x.count, 0) || 1;
    const osTotal = osData.reduce((s, x) => s + x.count, 0) || 1;

    panel.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">💻 Device Type</h4>
          <div class="space-y-2.5">
            ${devices.length === 0 ? '<p class="text-slate-500 text-xs py-4 text-center">No data yet</p>' :
              devices.map((d, i) => renderBar(d.name, d.count, devTotal, ['bg-blue-500','bg-rose-500','bg-emerald-500','bg-amber-500'][i%4], deviceIcon(d.name))).join('')}
          </div>
          <div class="grid grid-cols-2 gap-2 mt-3">
            ${devices.slice(0,3).map(d => `
              <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                <span class="text-xl">${deviceIcon(d.name)}</span>
                <strong class="text-white font-black block text-lg">${devTotal>0?Math.round((d.count/devTotal)*100):0}%</strong>
                <span class="text-slate-400 text-[10px]">${d.name}</span>
              </div>`).join('')}
          </div>
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🌐 Browser</h4>
          <div class="space-y-2.5">
            ${browsers.length === 0 ? '<p class="text-slate-500 text-xs py-4 text-center">No data yet</p>' :
              browsers.map((b, i) => renderBar(b.name, b.count, brTotal, ['bg-amber-500','bg-blue-500','bg-emerald-500','bg-rose-500','bg-purple-500'][i%5])).join('')}
          </div>
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🖥️ Operating System</h4>
          <div class="space-y-2.5">
            ${osData.length === 0 ? '<p class="text-slate-500 text-xs py-4 text-center">No data yet</p>' :
              osData.map((o, i) => renderBar(o.name, o.count, osTotal, ['bg-cyan-500','bg-indigo-500','bg-emerald-500','bg-amber-500','bg-rose-500'][i%5])).join('')}
          </div>
        </div>
      </div>`;
  }

  if (tab === 'links') {
    const panel = document.getElementById('analyticsPanel-links');
    if (!panel) return;
    const links = d.links || [];
    const linkTotal = links.reduce((s, l) => s + l.count, 0) || 1;

    panel.innerHTML = `
      <div class="space-y-4">
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">🔗 External Links Clicked (Drilldown)</h4>
          ${links.length === 0 ? '<p class="text-slate-500 text-xs text-center py-8">No external link clicks tracked yet. Clicks on affiliate links, Spotlight, CV, and social links will appear here.</p>' :
            `<div class="space-y-2">
              ${links.map((l, i) => `
                <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition group" onclick="openLinkDrilldown('${encodeURIComponent(l.url)}')">
                  <span class="text-amber-400 font-black text-sm min-w-[2rem] text-center">${i+1}</span>
                  <div class="flex-1 min-w-0">
                    <div class="text-white font-bold text-xs truncate">${l.url}</div>
                    <div class="w-full h-1.5 rounded-full bg-slate-800 mt-1.5 overflow-hidden">
                      <div class="h-full bg-amber-500 rounded-full" style="width:${Math.round((l.count/linkTotal)*100)}%"></div>
                    </div>
                  </div>
                  <div class="text-right shrink-0">
                    <span class="text-amber-400 font-black font-mono-code text-sm">${l.count}</span>
                    <span class="text-slate-500 text-[10px] block">clicks</span>
                  </div>
                  <span class="text-slate-500 group-hover:text-amber-400 transition text-xs">→</span>
                </div>`).join('')}
            </div>`}
        </div>
        <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60 space-y-3">
          <h4 class="text-xs font-black text-white uppercase tracking-wider">⭐ Affiliate Hacks Click Leaders</h4>
          <div class="space-y-2">
            ${Object.entries(d.hacksStats || {}).length === 0 ? '<p class="text-slate-500 text-xs text-center py-4">No affiliate link clicks yet.</p>' :
              Object.entries(d.hacksStats || {}).sort((a,b) => b[1]-a[1]).map(([name, cnt], i) => `
                <div class="flex items-center gap-3 p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                  <span class="text-emerald-400 font-black text-sm min-w-[2rem] text-center">${i+1}</span>
                  <span class="flex-1 text-white font-bold text-xs truncate">💰 ${name}</span>
                  <span class="text-emerald-400 font-black font-mono-code">${cnt} clicks</span>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  if (tab === 'log') {
    renderActivityLog();
  }

  if (window.lucide) lucide.createIcons();
}

function renderActivityLog() {
  const panel = document.getElementById('analyticsPanel-log');
  if (!panel || !_analyticsData) return;
  let events = (_analyticsData.recentEvents || []);

  // Apply filters
  const ftEl = document.getElementById('logFilterType');
  const fcEl = document.getElementById('logFilterCountry');
  const fdEl = document.getElementById('logFilterDevice');
  const fsEl = document.getElementById('logFilterSearch');
  const ft = ftEl ? ftEl.value : '';
  const fc = fcEl ? fcEl.value : '';
  const fd = fdEl ? fdEl.value : '';
  const fs = fsEl ? fsEl.value.toLowerCase() : '';

  if (ft) events = events.filter(e => e.type === ft);
  if (fc) events = events.filter(e => (e.country || '') === fc);
  if (fd) events = events.filter(e => (e.device || '') === fd);
  if (fs) events = events.filter(e => JSON.stringify(e).toLowerCase().includes(fs));

  const uniqueCountries = [...new Set((_analyticsData.recentEvents || []).map(e => e.country).filter(Boolean))].sort();
  const uniqueDevices = [...new Set((_analyticsData.recentEvents || []).map(e => e.device).filter(Boolean))].sort();
  const eventTypes = [...new Set((_analyticsData.recentEvents || []).map(e => e.type).filter(Boolean))].sort();

  const typeColors = {
    'page_view': 'text-blue-400', 'page_click': 'text-amber-400', 'affiliate_click': 'text-emerald-400',
    'spotlight_click': 'text-yellow-400', 'showreel_play': 'text-indigo-400', 'cv_download': 'text-cyan-400', 'booking_enquiry': 'text-rose-400'
  };

  panel.innerHTML = `
    <div class="space-y-4">
      <!-- Filters -->
      <div class="glass-card rounded-2xl border border-slate-800 p-4 bg-slate-950/60">
        <div class="flex flex-wrap items-end gap-3">
          <div class="space-y-1 flex-1 min-w-[120px]">
            <label class="text-[10px] text-slate-400 uppercase font-mono-code font-bold">Event Type</label>
            <select id="logFilterType" onchange="renderActivityLog()" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
              <option value="">All Types</option>
              ${eventTypes.map(t => `<option value="${t}" ${ft===t?'selected':''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1 flex-1 min-w-[120px]">
            <label class="text-[10px] text-slate-400 uppercase font-mono-code font-bold">Country</label>
            <select id="logFilterCountry" onchange="renderActivityLog()" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
              <option value="">All Countries</option>
              ${uniqueCountries.map(c => `<option value="${c}" ${fc===c?'selected':''}>${countryFlag('')} ${c}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1 flex-1 min-w-[100px]">
            <label class="text-[10px] text-slate-400 uppercase font-mono-code font-bold">Device</label>
            <select id="logFilterDevice" onchange="renderActivityLog()" class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
              <option value="">All Devices</option>
              ${uniqueDevices.map(d => `<option value="${d}" ${fd===d?'selected':''}>${d}</option>`).join('')}
            </select>
          </div>
          <div class="space-y-1 flex-1 min-w-[140px]">
            <label class="text-[10px] text-slate-400 uppercase font-mono-code font-bold">Search</label>
            <input id="logFilterSearch" type="text" value="${fs}" oninput="renderActivityLog()" placeholder="Search logs..." class="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs">
          </div>
          <button onclick="exportActivityLogCSV()" class="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center gap-1.5 shadow whitespace-nowrap">
            ⬇️ Export CSV
          </button>
        </div>
        <p class="text-[10px] text-slate-500 mt-2 font-mono-code">Showing ${events.length} of ${(_analyticsData.recentEvents||[]).length} total events</p>
      </div>

      <!-- Log Table -->
      <div class="glass-card rounded-2xl border border-slate-800 bg-slate-950/60 overflow-hidden">
        <div class="overflow-x-auto max-h-[480px] overflow-y-auto">
          <table class="w-full text-xs">
            <thead class="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 text-slate-400 font-mono-code uppercase text-[10px]">
              <tr>
                <th class="p-3 text-left whitespace-nowrap">Time</th>
                <th class="p-3 text-left whitespace-nowrap">Event</th>
                <th class="p-3 text-left whitespace-nowrap">Label</th>
                <th class="p-3 text-left whitespace-nowrap">Source</th>
                <th class="p-3 text-left whitespace-nowrap">Country</th>
                <th class="p-3 text-left whitespace-nowrap">City</th>
                <th class="p-3 text-left whitespace-nowrap">Device</th>
                <th class="p-3 text-left whitespace-nowrap">Browser</th>
                <th class="p-3 text-left whitespace-nowrap">OS</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-800/50">
              ${events.length === 0 ? `<tr><td colspan="9" class="p-8 text-center text-slate-500">No events match your filters.</td></tr>` :
                events.slice(0, 200).map(ev => `
                  <tr class="hover:bg-slate-900/40 transition">
                    <td class="p-3 text-slate-400 font-mono-code whitespace-nowrap">${new Date(ev.timestamp).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</td>
                    <td class="p-3 whitespace-nowrap"><span class="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 font-mono-code ${typeColors[ev.type]||'text-white'}">${ev.type}</span></td>
                    <td class="p-3 text-white font-bold max-w-[150px] truncate">${ev.label || '—'}</td>
                    <td class="p-3 text-slate-300 whitespace-nowrap">${sourceIcon(ev.source)} ${ev.source || 'Direct'}</td>
                    <td class="p-3 text-slate-300 whitespace-nowrap">${countryFlag(ev.countryCode)} ${ev.country || '—'}</td>
                    <td class="p-3 text-slate-400">${ev.city || '—'}</td>
                    <td class="p-3 text-slate-300 whitespace-nowrap">${deviceIcon(ev.device)} ${ev.device || '—'}</td>
                    <td class="p-3 text-slate-400">${ev.browser || '—'}</td>
                    <td class="p-3 text-slate-400">${ev.os || '—'}</td>
                  </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}
window.renderActivityLog = renderActivityLog;

function openLinkDrilldown(encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  if (!_analyticsData) return;
  const events = (_analyticsData.recentEvents || []).filter(ev => ev.url === url || ev.referrerRaw === url);

  const html = `
    <div id="linkDrilldownModal" class="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4" onclick="document.getElementById('linkDrilldownModal').remove()">
      <div class="w-full max-w-2xl glass-card rounded-3xl border border-amber-500/40 p-6 space-y-4 shadow-2xl" onclick="event.stopPropagation()">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <span class="text-[10px] text-amber-400 font-mono-code font-bold uppercase">🔗 Link Drilldown</span>
            <h3 class="text-sm font-black text-white mt-0.5 break-all">${url}</h3>
          </div>
          <button onclick="document.getElementById('linkDrilldownModal').remove()" class="p-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white">✕</button>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center text-xs">
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong class="text-amber-400 font-black text-xl block">${events.length}</strong>
            <span class="text-slate-400 text-[10px]">Total Clicks</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong class="text-blue-400 font-black text-lg block">${[...new Set(events.map(e=>e.country).filter(Boolean))].length || '—'}</strong>
            <span class="text-slate-400 text-[10px]">Countries</span>
          </div>
          <div class="p-3 rounded-xl bg-slate-950 border border-slate-800">
            <strong class="text-emerald-400 font-black text-lg block">${[...new Set(events.map(e=>e.device).filter(Boolean))].join(' / ') || '—'}</strong>
            <span class="text-slate-400 text-[10px]">Devices</span>
          </div>
        </div>
        <div class="max-h-72 overflow-y-auto space-y-1.5 font-mono-code text-xs">
          ${events.length === 0 ? '<p class="text-slate-500 text-center py-6">No detailed event records for this link yet.</p>' :
            events.slice(0, 50).map(ev => `
              <div class="p-2.5 rounded-lg bg-slate-950/90 border border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span class="text-white font-bold">${countryFlag(ev.countryCode)} ${ev.country || 'Unknown'} — ${ev.city || ''}</span>
                  <span class="text-slate-400 text-[10px]">${deviceIcon(ev.device)} ${ev.device} · ${ev.browser}</span>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-slate-400">${sourceIcon(ev.source)} ${ev.source || 'Direct'}</span>
                  <span class="text-slate-500">${new Date(ev.timestamp).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}</span>
                </div>
              </div>`).join('')}
        </div>
        <div class="flex justify-end pt-2 border-t border-slate-800">
          <button onclick="document.getElementById('linkDrilldownModal').remove()" class="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs">Close</button>
        </div>
      </div>
    </div>`;
  document.body.insertAdjacentHTML('beforeend', html);
}
window.openLinkDrilldown = openLinkDrilldown;

function exportActivityLogCSV() {
  if (!_analyticsData) return;
  let events = _analyticsData.recentEvents || [];
  const ftEl = document.getElementById('logFilterType');
  const fcEl = document.getElementById('logFilterCountry');
  const fdEl = document.getElementById('logFilterDevice');
  if (ftEl && ftEl.value) events = events.filter(e => e.type === ftEl.value);
  if (fcEl && fcEl.value) events = events.filter(e => e.country === fcEl.value);
  if (fdEl && fdEl.value) events = events.filter(e => e.device === fdEl.value);

  const headers = ['timestamp','type','label','source','medium','country','city','region','isp','device','browser','os','referrerRaw','url','duration'];
  const rows = events.map(e => headers.map(h => `"${(e[h]||'').toString().replace(/"/g,'""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `stevep_analytics_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
}
window.exportActivityLogCSV = exportActivityLogCSV;

async function resetAnalyticsData() {
  if (!confirm('⚠️ This will permanently delete ALL analytics data. Are you sure?')) return;
  try {
    const res = await fetch('/api/analytics/reset', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      _analyticsData = null;
      alert('Analytics reset successfully!');
      loadAnalyticsDashboard();
    }
  } catch(e) { alert('Error resetting analytics.'); }
}
window.resetAnalyticsData = resetAnalyticsData;

// Legacy shim so old HTML onclick calls still work
function openClickDetailsModal(metricName) { loadAnalyticsDashboard(); }
window.openClickDetailsModal = openClickDetailsModal;

function setAnalyticsDateRange(range) { loadAnalyticsDashboard(); }
window.setAnalyticsDateRange = setAnalyticsDateRange;

function exportAnalyticsData(fmt) { exportActivityLogCSV(); }
window.exportAnalyticsData = exportAnalyticsData;


// ══════════════════════════════════════════════════════════════════════════════
// ENTERPRISE BACKUP & UNIVERSAL RESTORE SYSTEM — Frontend Controller
// ══════════════════════════════════════════════════════════════════════════════

// ── Create Manual Backup (1-Click) ──────────────────────────────────────────
async function createManualBackup() {
  const password = document.getElementById('backupPasswordInput')?.value.trim() || null;
  const includeMedia = document.getElementById('backupMediaToggle')?.checked || false;

  const box = document.getElementById('backupProgressBox');
  const bar = document.getElementById('backupProgressBar');
  const label = document.getElementById('backupProgressLabel');

  if (box) { box.classList.remove('hidden'); bar.style.width = '10%'; label.textContent = 'Creating backup ZIP...'; }

  try {
    const res = await fetch('/api/backup/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'manual', password, includeMedia })
    });

    if (bar) bar.style.width = '70%';

    const data = await res.json();
    if (data.success) {
      if (bar) bar.style.width = '100%';
      if (label) label.textContent = '✅ Backup created successfully!';

      // Show password warning
      const pwMsg = data.password ? `\n\n🔐 BACKUP PASSWORD: ${data.password}\n⚠️ SAVE THIS PASSWORD — you need it to unlock the restore page!` : '';
      const mediaMsg = includeMedia ? '\n📁 Media ZIP is being created separately.' : '';
      alert(`✅ Backup Created!\n\nFile: ${data.filename}\nSize: ${data.fileSizeHuman}${pwMsg}${mediaMsg}`);

      setTimeout(() => {
        if (box) box.classList.add('hidden');
        if (bar) bar.style.width = '0%';
      }, 2000);

      // Refresh backup list
      renderBackupDashboard();

      // Auto-download
      window.location.href = `/api/backup/download/${encodeURIComponent(data.filename)}`;
    } else {
      alert('❌ Backup failed: ' + (data.message || 'Unknown error'));
      if (box) box.classList.add('hidden');
    }
  } catch (err) {
    alert('❌ Backup error: ' + err.message);
    if (box) box.classList.add('hidden');
  }
}
window.createManualBackup = createManualBackup;

// ── Render Backup Dashboard (History Grid + Config) ─────────────────────────
async function renderBackupDashboard() {
  try {
    const res = await fetch('/api/backup/list');
    const data = await res.json();
    if (!data.success) return;

    const backups = data.backups || [];
    const config = data.config || {};
    const grid = document.getElementById('backupHistoryGrid');
    const storageLabel = document.getElementById('backupStorageLabel');

    // Update storage label
    const totalSize = backups.reduce((sum, b) => sum + (b.fileSize || 0) + (b.mediaFileSize || 0), 0);
    if (storageLabel) {
      storageLabel.textContent = `${backups.length} backup${backups.length !== 1 ? 's' : ''} · ${formatBytesClient(totalSize)}`;
    }

    // Update scheduler UI
    const toggle = document.getElementById('schedulerToggle');
    const toggleDot = document.getElementById('schedulerToggleDot');
    const statusLabel = document.getElementById('schedulerStatusLabel');
    const scheduleSelect = document.getElementById('backupScheduleSelect');

    if (toggle && config.schedulerEnabled !== undefined) {
      toggle.checked = config.schedulerEnabled;
      if (toggleDot) toggleDot.style.transform = config.schedulerEnabled ? 'translateX(20px)' : 'translateX(0)';
      if (toggleDot) toggleDot.style.backgroundColor = config.schedulerEnabled ? '#f59e0b' : '#94a3b8';
      if (statusLabel) statusLabel.textContent = config.schedulerEnabled ? 'Enabled' : 'Disabled';
      if (statusLabel) statusLabel.className = `text-xs font-bold ${config.schedulerEnabled ? 'text-amber-400' : 'text-slate-300'}`;
    }
    if (scheduleSelect && config.schedulerFrequency) {
      scheduleSelect.value = config.schedulerFrequency;
    }

    // Render backup rows
    if (!grid) return;
    if (backups.length === 0) {
      grid.innerHTML = '<div class="text-center text-slate-500 py-4">No backups yet. Create your first backup above!</div>';
      return;
    }

    grid.innerHTML = backups.map(b => {
      const date = new Date(b.createdAt);
      const dateStr = date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      const timeStr = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      const typeBadge = b.type === 'auto'
        ? '<span class="px-1.5 py-0.5 bg-indigo-500/20 text-indigo-400 rounded text-[10px] font-bold">AUTO</span>'
        : '<span class="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded text-[10px] font-bold">MANUAL</span>';
      const mediaBadge = b.includesMedia
        ? '<span class="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[10px] font-bold">+MEDIA</span>'
        : '';
      const existsBadge = b.exists
        ? ''
        : '<span class="px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded text-[10px] font-bold">FILE MISSING</span>';

      const passwordSection = b.password
        ? `<div class="flex items-center gap-1 mt-1">
            <span class="text-[10px] text-amber-300/60">🔐 Password:</span>
            <span class="text-[10px] font-mono bg-slate-800 px-1.5 py-0.5 rounded text-amber-400 select-all cursor-pointer backup-pw-hidden" id="pw-${b.id}" onclick="this.classList.toggle('backup-pw-hidden')" title="Click to reveal/hide">${b.password}</span>
            <button onclick="navigator.clipboard.writeText('${b.password}');this.textContent='Copied!';setTimeout(()=>this.textContent='📋',1500)" class="text-[10px] text-slate-500 hover:text-white">📋</button>
          </div>
          <div class="text-[10px] text-rose-400/50 mt-0.5">⚠️ Save this password! You need it to unlock restore.html</div>`
        : '<div class="text-[10px] text-slate-500 mt-1">No password set</div>';

      return `
        <div class="p-3 rounded-xl bg-slate-900/50 border border-slate-800 flex flex-col sm:flex-row sm:items-center gap-3">
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              ${typeBadge} ${mediaBadge} ${existsBadge}
              <span class="text-white font-bold truncate">${dateStr} ${timeStr}</span>
              <span class="text-slate-500 text-[10px]">${b.fileSizeHuman || '?'}${b.mediaFileSizeHuman ? ' + ' + b.mediaFileSizeHuman + ' media' : ''}</span>
            </div>
            ${passwordSection}
          </div>
          <div class="flex items-center gap-2 shrink-0">
            ${b.exists ? `<a href="/api/backup/download/${encodeURIComponent(b.filename)}" download class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold">⬇ Site</a>` : ''}
            ${b.mediaFilename ? `<a href="/api/backup/download/${encodeURIComponent(b.mediaFilename)}" download class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-bold">⬇ Media</a>` : ''}
            <button onclick="deleteBackup('${b.filename}')" class="px-3 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 text-[11px] font-bold">🗑</button>
          </div>
        </div>`;
    }).join('');

  } catch (err) {
    console.error('Failed to load backup dashboard:', err);
  }
}
window.renderBackupDashboard = renderBackupDashboard;

// ── Delete Backup ───────────────────────────────────────────────────────────
async function deleteBackup(filename) {
  if (!confirm(`Delete backup "${filename}"? This cannot be undone.`)) return;
  try {
    await fetch(`/api/backup/delete/${encodeURIComponent(filename)}`, { method: 'DELETE' });
    renderBackupDashboard();
  } catch (err) {
    alert('Delete failed: ' + err.message);
  }
}
window.deleteBackup = deleteBackup;

// ── Toggle Backup Scheduler ─────────────────────────────────────────────────
async function toggleBackupScheduler() {
  try {
    const res = await fetch('/api/backup/schedule/toggle', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      renderBackupDashboard();
    }
  } catch (err) {
    alert('Toggle failed: ' + err.message);
  }
}
window.toggleBackupScheduler = toggleBackupScheduler;

// ── Update Schedule Frequency ───────────────────────────────────────────────
async function updateScheduleFrequency() {
  const freq = document.getElementById('backupScheduleSelect')?.value || 'Daily';
  try {
    await fetch('/api/backup/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ schedulerFrequency: freq })
    });
  } catch (err) {
    console.error('Failed to update frequency:', err);
  }
}
window.updateScheduleFrequency = updateScheduleFrequency;

// ── Change Admin PIN ────────────────────────────────────────────────────────
async function changeAdminPin() {
  const currentPin = document.getElementById('currentPinInput')?.value.trim();
  const newPin = document.getElementById('newPinInput')?.value.trim();
  const statusEl = document.getElementById('pinChangeStatus');

  if (!currentPin || !newPin) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '⚠️ Please enter both current and new PIN.'; }
    return;
  }
  if (newPin.length < 4) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '⚠️ New PIN must be at least 4 characters.'; }
    return;
  }

  try {
    const res = await fetch('/api/admin/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    });
    const data = await res.json();
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.className = `text-[11px] ${data.success ? 'text-emerald-400' : 'text-red-400'}`;
      statusEl.textContent = data.success ? '✅ ' + data.message : '❌ ' + data.message;
    }
    if (data.success) {
      document.getElementById('currentPinInput').value = '';
      document.getElementById('newPinInput').value = '';
    }
  } catch (err) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '❌ Error: ' + err.message; }
  }
}
window.changeAdminPin = changeAdminPin;

// ── Domain Migration ────────────────────────────────────────────────────────
async function migrateDomain() {
  const oldDomain = document.getElementById('migrationOldDomain')?.value.trim();
  const newDomain = document.getElementById('migrationNewDomain')?.value.trim();
  const statusEl = document.getElementById('migrationStatus');

  if (!oldDomain || !newDomain) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '⚠️ Enter both old and new domain.'; }
    return;
  }
  if (!confirm(`Rewrite ALL references from "${oldDomain}" to "${newDomain}" in the database? This affects URLs, SEO, and all content.`)) return;

  try {
    const res = await fetch('/api/backup/migrate-domain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldDomain, newDomain })
    });
    const data = await res.json();
    if (statusEl) {
      statusEl.classList.remove('hidden');
      statusEl.className = `text-[11px] ${data.success ? 'text-emerald-400' : 'text-red-400'}`;
      statusEl.textContent = data.success ? '✅ ' + data.message : '❌ ' + data.message;
    }
  } catch (err) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '❌ Error: ' + err.message; }
  }
}
window.migrateDomain = migrateDomain;

// ── Cloud Storage (Placeholder) ─────────────────────────────────────────────
function connectCloud(provider) {
  const names = { gdrive: 'Google Drive', s3: 'Amazon S3', onedrive: 'OneDrive', dropbox: 'Dropbox', b2: 'Backblaze B2' };
  alert(`🚧 ${names[provider] || provider} integration requires OAuth setup.\n\nTo connect:\n1. Create API credentials for ${names[provider]}\n2. Add them in Settings → Cloud Storage\n3. Test the connection\n\nThis feature will be fully available in a future update.`);
}
window.connectCloud = connectCloud;

// ── Client-side byte formatter ──────────────────────────────────────────────
function formatBytesClient(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Legacy compatibility wrapper
function triggerFullBackupExport() { createManualBackup(); }
window.triggerFullBackupExport = triggerFullBackupExport;

function saveBackupSettings() { updateScheduleFrequency(); }
window.saveBackupSettings = saveBackupSettings;

async function resetAnalyticsData() {
  if (!confirm('Are you sure you want to reset all analytics and metrics counters to 0?')) return;
  appData.analytics = {
    pageViews: 0,
    spotlightClicks: 0,
    cvDownloads: 0,
    showreelPlays: 0,
    bookingEnquiries: 0,
    recentEvents: []
  };
  (appData.hacks || []).forEach(h => { h.clicks = 0; h.usedCount = 0; });
  renderAll();
  await saveAppDataToServer();
  alert('Analytics metrics reset to 0 and saved!');
}

function exportAnalyticsData(format) {
  const analytics = appData.analytics || {};
  if (format === 'json') {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(analytics, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `stevep_analytics_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  } else {
    let csv = "Metric,Value\n";
    csv += `Total Page Views,${analytics.pageViews || 0}\n`;
    csv += `Spotlight Clicks,${analytics.spotlightClicks || 0}\n`;
    csv += `Showreel Plays,${analytics.showreelPlays || 0}\n`;
    csv += `CV Downloads,${analytics.cvDownloads || 0}\n`;
    csv += `Booking Enquiries,${analytics.bookingEnquiries || 0}\n`;
    
    const dataStr = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `stevep_analytics_${Date.now()}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }
}

function updateSEODisplay() {
  const seo = appData.seo || {};
  
  // Populate Admin Inputs
  if (document.getElementById('adminSEOTitle')) document.getElementById('adminSEOTitle').value = seo.title || '';
  if (document.getElementById('adminSEODesc')) document.getElementById('adminSEODesc').value = seo.description || '';
  if (document.getElementById('adminSEOKeywords')) document.getElementById('adminSEOKeywords').value = seo.keywords || '';

  // Synchronize Live Browser Tab Title & Head Meta Tags
  if (seo.title) {
    document.title = seo.title;
    const titleEl = document.getElementById('seoMetaTitle');
    if (titleEl) titleEl.textContent = seo.title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', seo.title);
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', seo.title);
  }

  if (seo.description) {
    const descEl = document.getElementById('seoMetaDesc') || document.querySelector('meta[name="description"]');
    if (descEl) descEl.setAttribute('content', seo.description);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', seo.description);
    const twDesc = document.querySelector('meta[name="twitter:description"]');
    if (twDesc) twDesc.setAttribute('content', seo.description);
  }

  if (seo.keywords) {
    const kwEl = document.getElementById('seoMetaKeywords') || document.querySelector('meta[name="keywords"]');
    if (kwEl) kwEl.setAttribute('content', seo.keywords);
  }
}

// --------------------------------------------------------------------------
// CLIENT-SIDE CANVAS IMAGE OPTIMIZER & NON-BLOCKING UPLOAD ENGINE
// --------------------------------------------------------------------------
function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.76) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.naturalWidth || img.width;
        let height = img.naturalHeight || img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(event.target.result);
    };
    reader.onerror = () => resolve(null);
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

// ==========================================
// UPLOAD STAGING & CLASSIFICATION STATE
// ==========================================
let stagingUploadQueue = [];

async function startBackgroundUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const defaultRole = document.getElementById('bulkUploadTargetRole')?.value || 'Headshot';
  stagingUploadQueue = [];

  const fileList = Array.from(files);
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const isVideo = file.type.startsWith('video/') || file.name.match(/\.(mp4|mov|webm|m4v|mkv)$/i) || defaultRole === 'Showreel Video';
    
    let previewUrl = '';
    if (isVideo) {
      previewUrl = 'assets/thumb_stevep_showreel.jpg';
    } else {
      previewUrl = URL.createObjectURL(file);
    }

    // Clean file name
    const rawName = file.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ").replace(/\s+/g, " ").trim();
    let suggestedTitle = rawName;
    if (!suggestedTitle.toLowerCase().startsWith('steve')) {
      suggestedTitle = `Steve in ${suggestedTitle}`;
    }

    // Smart category suggestion based on filename if available
    let suggestedCategory = defaultRole;
    const lower = file.name.toLowerCase();
    if (lower.includes('headshot') || lower.includes('portrait')) suggestedCategory = 'Headshot';
    else if (lower.includes('full') || lower.includes('body') || lower.includes('standing') || lower.includes('slate')) suggestedCategory = 'Full Body';
    else if (lower.includes('still') || lower.includes('scene') || lower.includes('film') || lower.includes('action')) suggestedCategory = 'Filming Still';

    stagingUploadQueue.push({
      file,
      isVideo,
      previewUrl,
      title: suggestedTitle,
      category: suggestedCategory,
      sizeMb: (file.size / (1024 * 1024)).toFixed(2)
    });
  }

  // Reset file input so user can re-trigger if needed
  e.target.value = '';

  openUploadStagingModal();
}

function openUploadStagingModal() {
  const modal = document.getElementById('uploadStagingModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  renderUploadStagingGrid();
  if (window.lucide) lucide.createIcons();
}

function closeUploadStagingModal(e) {
  if (e && e.target !== e.currentTarget) return;
  cancelUploadStaging();
}

function cancelUploadStaging() {
  stagingUploadQueue.forEach(item => {
    if (item.previewUrl && item.previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
  stagingUploadQueue = [];
  document.getElementById('uploadStagingModal')?.classList.add('hidden');
  document.getElementById('stagingProcessingContainer')?.classList.add('hidden');
  const confirmBtn = document.getElementById('confirmStagingUploadBtn');
  if (confirmBtn) confirmBtn.disabled = false;
}

function renderUploadStagingGrid() {
  const container = document.getElementById('stagingCardsContainer');
  const countLabel = document.getElementById('stagingItemsCountLabel');
  if (countLabel) countLabel.textContent = `${stagingUploadQueue.length} items ready to ingest`;

  if (!container) return;

  if (stagingUploadQueue.length === 0) {
    container.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 text-xs italic">No items in staging queue. Select photos or videos to stage uploads.</div>`;
    return;
  }

  container.innerHTML = stagingUploadQueue.map((item, idx) => `
    <div class="glass-card rounded-2xl border border-slate-800 p-3 space-y-2.5 bg-slate-900/60 flex flex-col justify-between">
      <div class="relative w-full h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
        ${item.isVideo ? `
          <div class="flex flex-col items-center justify-center gap-1.5 text-purple-400">
            <i data-lucide="video" class="w-8 h-8"></i>
            <span class="text-[10px] font-bold font-mono-code px-2 text-center truncate w-full">${escapeHtml(item.file.name)}</span>
          </div>
        ` : `
          <img src="${item.previewUrl}" class="w-full h-full object-cover object-top" alt="Staged Preview">
        `}
        <div class="absolute top-1.5 right-1.5 flex items-center gap-1">
          <span class="px-1.5 py-0.5 rounded bg-slate-950/80 border border-slate-800 text-[9px] font-mono-code text-slate-300 font-bold">${item.sizeMb} MB</span>
          <button onclick="removeStagingItem(${idx})" class="p-1 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white shadow" title="Remove">
            <i data-lucide="trash" class="w-3 h-3"></i>
          </button>
        </div>
      </div>

      <div class="space-y-1.5 text-xs text-left">
        <div>
          <label class="text-[10px] font-bold text-slate-300 block mb-0.5">Photo Title (e.g. Steve in...):</label>
          <input type="text" value="${escapeHtml(item.title)}" oninput="updateStagingItemTitle(${idx}, this.value)" class="admin-input text-xs font-bold text-amber-300 px-2 py-1" placeholder="Steve in...">
        </div>

        <div>
          <label class="text-[10px] font-bold text-slate-300 block mb-0.5">Target Category / Tag:</label>
          <select onchange="updateStagingItemCategory(${idx}, this.value)" class="admin-select text-xs font-bold text-amber-400 px-2 py-1">
            <option value="Headshot" ${item.category === 'Headshot' ? 'selected' : ''}>🎭 Headshot (Head & Shoulders)</option>
            <option value="Full Body" ${item.category === 'Full Body' ? 'selected' : ''}>🧍 Full Body Standing Slate</option>
            <option value="Filming Still" ${item.category === 'Filming Still' ? 'selected' : ''}>📸 35mm Filming Location Still</option>
            <option value="Signature B&W" ${item.category === 'Signature B&W' ? 'selected' : ''}>🖼️ Ambient Background Photo</option>
            <option value="Showreel Video" ${item.category === 'Showreel Video' ? 'selected' : ''}>🎥 Showreel Video</option>
          </select>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

function updateStagingItemTitle(idx, val) {
  if (stagingUploadQueue[idx]) {
    stagingUploadQueue[idx].title = val;
  }
}

function updateStagingItemCategory(idx, val) {
  if (stagingUploadQueue[idx]) {
    stagingUploadQueue[idx].category = val;
  }
}

function removeStagingItem(idx) {
  if (stagingUploadQueue[idx]) {
    if (stagingUploadQueue[idx].previewUrl && stagingUploadQueue[idx].previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(stagingUploadQueue[idx].previewUrl);
    }
    stagingUploadQueue.splice(idx, 1);
    renderUploadStagingGrid();
  }
}

function applyBatchCategoryToStaging() {
  const cat = document.getElementById('stagingBatchCategory')?.value || 'Headshot';
  stagingUploadQueue.forEach(item => {
    item.category = cat;
  });
  renderUploadStagingGrid();
}

function prefixAllStagingTitles(prefix) {
  stagingUploadQueue.forEach(item => {
    let clean = item.title.trim();
    clean = clean.replace(/^(Steve in |Steve with |Steve |steve )/i, '').trim();
    item.title = `${prefix}${clean}`;
  });
  renderUploadStagingGrid();
}

async function confirmStagedUploads() {
  if (stagingUploadQueue.length === 0) return alert('No items to upload.');

  const processContainer = document.getElementById('stagingProcessingContainer');
  const processBar = document.getElementById('stagingProcessingBar');
  const processPercent = document.getElementById('stagingProcessingPercent');
  const processText = document.getElementById('stagingProcessingText');
  const confirmBtn = document.getElementById('confirmStagingUploadBtn');

  if (confirmBtn) confirmBtn.disabled = true;
  if (processContainer) processContainer.classList.remove('hidden');

  const total = stagingUploadQueue.length;

  for (let i = 0; i < total; i++) {
    const item = stagingUploadQueue[i];
    const pct = Math.round(((i) / total) * 100);
    if (processBar) processBar.style.width = `${pct}%`;
    if (processPercent) processPercent.textContent = `${pct}%`;
    if (processText) processText.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i> Processing "${escapeHtml(item.title)}" (${i + 1} of ${total})...`;

    if (item.isVideo) {
      const videoDataUrl = await readFileAsDataURL(item.file);
      const newVideo = {
        id: 'vid_' + Date.now() + '_' + i,
        title: item.title,
        url: videoDataUrl,
        type: 'video',
        tag: 'Showreel Video',
        poster: 'assets/thumb_stevep_showreel.jpg',
        size: item.sizeMb + ' MB'
      };
      appData.spotlightVideos = appData.spotlightVideos || [];
      appData.spotlightVideos.unshift(newVideo);
    } else {
      const compressedUrl = await compressImage(item.file);
      const newMedia = {
        id: 'media_' + Date.now() + '_' + i,
        title: item.title,
        tag: item.category,
        type: 'photo',
        desc: `${item.category} photo: ${item.title}`,
        url: compressedUrl
      };

      if (item.category === 'Filming Still') {
        appData.stills = appData.stills || [];
        appData.stills.unshift(newMedia);
      } else if (item.category === 'Full Body') {
        appData.fullBodySlates = appData.fullBodySlates || [];
        appData.fullBodySlates.unshift(newMedia);
      } else {
        appData.headshots = appData.headshots || [];
        appData.headshots.unshift(newMedia);
      }

      if (item.category === 'Signature B&W') {
        const bg = document.getElementById('globalBgLayer');
        if (bg) bg.style.backgroundImage = `url('${compressedUrl}')`;
      }
    }

    await new Promise(r => setTimeout(r, 60));
  }

  if (processBar) processBar.style.width = `100%`;
  if (processPercent) processPercent.textContent = `100%`;
  if (processText) processText.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> Saving to database...`;

  await saveAppDataToServer();

  cancelUploadStaging();
  renderAll();
  alert(`✅ Successfully ingested and categorized ${total} photos/videos with your custom names!`);
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

// Inline Title Quick Update
async function updateMediaTitle(id, newTitle) {
  const item = [...(appData.headshots || []), ...(appData.stills || []), ...(appData.fullBodySlates || []), ...(appData.spotlightVideos || [])].find(m => m.id === id);
  if (item) {
    item.title = newTitle.trim() || item.title;
    renderAll();
    await saveAppDataToServer();
  }
}

// Single Media Quick-Edit Modal
function openEditMediaModal(id) {
  const item = [...(appData.headshots || []), ...(appData.stills || []), ...(appData.fullBodySlates || []), ...(appData.spotlightVideos || [])].find(m => m.id === id);
  if (!item) return;
  
  document.getElementById('editMediaId').value = item.id;
  document.getElementById('editMediaTitle').value = item.title || '';
  document.getElementById('editMediaCategory').value = item.tag || 'Headshot';
  document.getElementById('editMediaRole').value = item.role || '';
  document.getElementById('editMediaDesc').value = item.desc || '';

  const imgEl = document.getElementById('editMediaPreviewImg');
  const vidEl = document.getElementById('editMediaPreviewVid');

  if (item.type === 'video' || item.tag === 'Showreel Video') {
    imgEl.classList.add('hidden');
    vidEl.classList.remove('hidden');
    vidEl.src = item.url;
  } else {
    vidEl.classList.add('hidden');
    imgEl.classList.remove('hidden');
    imgEl.src = item.url;
  }

  document.getElementById('editMediaModal').classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeEditMediaModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('editMediaModal')?.classList.add('hidden');
}

async function saveMediaEditModal() {
  const id = document.getElementById('editMediaId').value;
  const newTitle = document.getElementById('editMediaTitle').value.trim();
  const newCategory = document.getElementById('editMediaCategory').value;
  const newRole = document.getElementById('editMediaRole').value.trim();
  const newDesc = document.getElementById('editMediaDesc').value.trim();

  const item = [...(appData.headshots || []), ...(appData.stills || []), ...(appData.fullBodySlates || []), ...(appData.spotlightVideos || [])].find(m => m.id === id);
  if (item) {
    if (newTitle) item.title = newTitle;
    item.tag = newCategory;
    if (newRole) item.role = newRole;
    if (newDesc) item.desc = newDesc;

    await reassignMediaRole(id, newCategory);
    document.getElementById('editMediaModal').classList.add('hidden');
  }
}

async function promptBulkRenameSelected() {
  if (selectedMediaIds.size === 0) return alert('Please select one or more photos using checkboxes first.');
  const newName = prompt(`Enter new title prefix or name for the ${selectedMediaIds.size} selected items:\n(e.g. Steve in Navy Suit)`, "Steve in ");
  if (!newName || !newName.trim()) return;

  const trimmed = newName.trim();
  let count = 0;
  [...(appData.headshots || []), ...(appData.stills || []), ...(appData.fullBodySlates || []), ...(appData.spotlightVideos || [])].forEach(m => {
    if (selectedMediaIds.has(m.id)) {
      count++;
      m.title = `${trimmed}${count > 1 ? ` (${count})` : ''}`;
    }
  });

  selectedMediaIds.clear();
  renderAll();
  await saveAppDataToServer();
  alert(`✅ Renamed ${count} selected items successfully!`);
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
  const vids = rawVids.map(v => ({ ...v, tag: v.tag || 'Showreel Video', type: 'video' }));
  const headshots = (appData.headshots || []).map(h => ({ ...h, tag: h.tag || 'Headshot', type: h.type || 'photo' }));
  const stills = (appData.stills || []).map(s => ({ ...s, tag: s.tag || 'Filming Still', type: s.type || 'photo' }));
  const slates = (appData.fullBodySlates || []).map(f => ({ ...f, tag: f.tag || 'Full Body', type: f.type || 'photo' }));

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
      <div draggable="true" ondragstart="handleMediaDragStart(event, '${m.id}')" ondragover="handleMediaDragOver(event)" ondrop="handleMediaDrop(event, '${m.id}')" class="relative group rounded-2xl overflow-hidden glass-card border ${isChecked ? 'border-amber-400 ring-2 ring-amber-400/50' : 'border-slate-800'} flex flex-col justify-between cursor-move shadow-lg bg-slate-950 transition hover:border-slate-700">
        
        <!-- Photo/Video Preview Box (Dedicated Visible Container) -->
        <div class="relative w-full h-48 sm:h-56 bg-slate-900 overflow-hidden flex items-center justify-center">
          ${isVideo ? `
            <video src="${m.url}" poster="${m.poster || 'assets/thumb_stevep_showreel.jpg'}" class="w-full h-full object-cover" preload="metadata"></video>
            <div class="absolute inset-0 bg-slate-950/30 flex items-center justify-center group-hover:bg-purple-600/20 transition cursor-pointer" onclick="openVideoModal('${m.url}', '${(m.title || 'Video').replace(/'/g, "\\'")}')">
              <div class="w-10 h-10 rounded-full bg-purple-600/90 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg group-hover:scale-110 transition">
                <i data-lucide="play" class="w-5 h-5 fill-current ml-0.5"></i>
              </div>
            </div>
          ` : `
            <img src="${m.url}" class="w-full h-full object-cover object-top cursor-pointer transition duration-300 group-hover:scale-105" onclick="openEditMediaModal('${m.id}')" alt="${escapeHtml(m.title || 'Steve Pereira')}" title="Click to view & edit full details">
          `}

          <!-- Floating Top Badges -->
          <div class="absolute top-2 left-2 z-10">
            <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleMediaSelect('${m.id}')" class="w-4 h-4 rounded text-amber-500 cursor-pointer shadow">
          </div>

          <div class="absolute top-2 right-2 z-10 flex items-center gap-1">
            <button onclick="openEditMediaModal('${m.id}')" class="p-1.5 rounded-lg bg-slate-950/80 hover:bg-amber-500 text-slate-300 hover:text-slate-950 border border-slate-700/80 transition shadow backdrop-blur-sm" title="Edit Details">
              <i data-lucide="edit-2" class="w-3 h-3"></i>
            </button>
            <span class="px-1.5 py-0.5 rounded-md ${typeBadge} text-[9px] font-mono-code font-bold uppercase shadow backdrop-blur-sm">
              ${isVideo ? '🎥 REEL' : (m.tag === 'Headshot' ? '🎭 HEADSHOT' : (m.tag === 'Full Body' ? '🧍 BODY' : '📸 STILL'))}
            </span>
          </div>
        </div>

        <!-- Dedicated Control Box Below Photo -->
        <div class="p-2.5 bg-slate-900/95 border-t border-slate-800/80 space-y-1.5 text-left">
          <!-- Editable Title Input -->
          <div>
            <label class="text-[9px] font-bold text-slate-400 block mb-0.5 uppercase tracking-wider font-mono-code">Title:</label>
            <input type="text" value="${escapeHtml(m.title || '')}" onchange="updateMediaTitle('${m.id}', this.value)" class="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-amber-400 focus:border-amber-400 text-xs font-bold text-amber-300 placeholder:text-slate-500 truncate" placeholder="Steve in...">
          </div>

          <!-- Category Selector & Up/Down -->
          <div class="flex items-center gap-1.5">
            <select onchange="reassignMediaRole('${m.id}', this.value)" class="w-full px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[10px] font-bold text-amber-400">
              <option value="Headshot" ${m.tag === 'Headshot' ? 'selected' : ''}>🎭 Headshot</option>
              <option value="Full Body" ${m.tag === 'Full Body' ? 'selected' : ''}>🧍 Full Body</option>
              <option value="Filming Still" ${m.tag === 'Filming Still' ? 'selected' : ''}>📸 35mm Still</option>
              <option value="Signature B&W" ${m.tag === 'Signature B&W' ? 'selected' : ''}>🖼️ Ambient BG</option>
              <option value="Showreel Video" ${m.tag === 'Showreel Video' ? 'selected' : ''}>🎥 Reel Video</option>
            </select>
            <button onclick="moveMediaUp('${m.id}')" class="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-amber-400 text-amber-400 text-xs font-black transition shadow" title="Move Up">⬆️</button>
            <button onclick="moveMediaDown('${m.id}')" class="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-amber-400 text-amber-400 text-xs font-black transition shadow" title="Move Down">⬇️</button>
          </div>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
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
  const allCollections = ['headshots', 'stills', 'fullBodySlates', 'spotlightVideos'];
  let foundItem = null;

  for (const col of allCollections) {
    if (Array.isArray(appData[col])) {
      const item = appData[col].find(m => m.id === id);
      if (item) {
        foundItem = item;
        break;
      }
    }
  }

  if (foundItem) {
    foundItem.tag = newRole;

    if (newRole === 'Full Body') {
      appData.fullBodySlates = appData.fullBodySlates || [];
      if (!appData.fullBodySlates.some(m => m.id === id)) {
        appData.fullBodySlates.push(foundItem);
      }
    } else {
      if (appData.fullBodySlates) {
        appData.fullBodySlates = appData.fullBodySlates.filter(m => m.id !== id);
      }
    }

    renderAll();
    await saveAppDataToServer();
  }
}

async function bulkMoveSelected() {
  if (selectedMediaIds.size === 0) return alert('Select photos to move first using checkboxes.');
  const newRole = document.getElementById('bulkMoveTarget')?.value || 'Headshot';

  const allItems = [...(appData.headshots || []), ...(appData.stills || []), ...(appData.fullBodySlates || [])];
  allItems.forEach(m => {
    if (selectedMediaIds.has(m.id)) {
      m.tag = newRole;
      if (newRole === 'Full Body') {
        appData.fullBodySlates = appData.fullBodySlates || [];
        if (!appData.fullBodySlates.some(item => item.id === m.id)) {
          appData.fullBodySlates.push(m);
        }
      } else {
        if (appData.fullBodySlates) {
          appData.fullBodySlates = appData.fullBodySlates.filter(item => item.id !== m.id);
        }
      }
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
// BACKUP & RESTORE (handleRestoreBackup — canonical client-side restore)
// Note: triggerFullBackupExport / createManualBackup are defined above
// --------------------------------------------------------------------------
function handleRestoreBackup(e) {
  const file = e.target?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      let json = JSON.parse(event.target.result);
      if (json.db && typeof json.db === 'object') {
        json = json.db;
      }
      if (json.credits || json.headshots || json.seo || json.stats || json.siteTexts) {
        appData = json;
        renderAll();
        populateHeroAdminInputs();
        renderAdminTrainingTable();
        renderAdminCredits();
        renderHeroStats();
        renderSpotlightTraining();
        applySiteTexts();
        updateLiveHeroCard();
        await saveAppDataToServer();
        alert('✅ Full Site Backup Restored & Saved Permanently to Database!');
      } else {
        alert('Invalid backup format: missing core portfolio data keys.');
      }
    } catch (err) {
      alert('Error parsing JSON backup file: ' + err.message);
    }
  };
  reader.readAsText(file);
}
window.handleRestoreBackup = handleRestoreBackup;

// --------------------------------------------------------------------------
// FORM SAVES & EVENT TRACKING
// --------------------------------------------------------------------------
async function handleSaveSEO(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  
  const titleInput = document.getElementById('adminSEOTitle');
  const descInput = document.getElementById('adminSEODesc');
  const keywordsInput = document.getElementById('adminSEOKeywords');

  appData.seo = {
    title: (titleInput ? titleInput.value : appData.seo?.title || '').trim(),
    description: (descInput ? descInput.value : appData.seo?.description || '').trim(),
    keywords: (keywordsInput ? keywordsInput.value : appData.seo?.keywords || '').trim()
  };
  
  updateSEODisplay();
  
  let savedSeo = false;
  try {
    const resSeo = await fetch('/api/seo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seo: appData.seo })
    });
    if (resSeo.ok) savedSeo = true;
  } catch (err) {
    console.error('Error saving directly to /api/seo:', err);
  }

  const savedAll = await saveAppDataToServer();
  if (savedSeo || savedAll) {
    alert('✅ SEO Settings Saved & Permanently Committed to Database and HTML!');
  } else {
    alert('⚠️ SEO Settings updated locally in browser.');
  }
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
  const yearInput = document.getElementById('adminCreditYear');
  const newCredit = {
    id: 'w_' + Date.now(),
    title: document.getElementById('adminCreditTitle').value.trim(),
    role: document.getElementById('adminCreditRole').value.trim(),
    category: document.getElementById('adminCreditCat').value,
    production: 'Independent',
    year: (yearInput && yearInput.value.trim()) ? yearInput.value.trim() : new Date().getFullYear().toString(),
    status: 'Active'
  };
  appData.credits.unshift(newCredit);
  renderAll();
  await saveAppDataToServer();
  if (e.target && typeof e.target.reset === 'function') e.target.reset();
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

let _pageLoadTime = Date.now();

function trackEvent(type, name = '', extra = {}) {
  try {
    const duration = Math.round((Date.now() - _pageLoadTime) / 1000);
    fetch('/api/analytics/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        name,
        label: name,
        referrer: document.referrer || '',
        page: window._currentTab || document.title,
        duration,
        timestamp: new Date().toISOString(),
        ...extra
      })
    });
  } catch (e) {}
}

// Stills Reel navigation
function prevStill(isUserClick = false) {
  const stills = appData.stills || [];
  if (stills.length === 0) return;
  currentStillIndex = (currentStillIndex - 1 + stills.length) % stills.length;
  updateStillDisplay();
  if (isUserClick && stillAutoplayTimer) {
    clearInterval(stillAutoplayTimer);
    stillAutoplayTimer = setInterval(nextStill, 3000);
  }
}

function nextStill(isUserClick = false) {
  const stills = appData.stills || [];
  if (stills.length === 0) return;
  currentStillIndex = (currentStillIndex + 1) % stills.length;
  updateStillDisplay();
  if (isUserClick && stillAutoplayTimer) {
    clearInterval(stillAutoplayTimer);
    stillAutoplayTimer = setInterval(nextStill, 3000);
  }
}

function selectStillByIndex(idx) {
  const stills = appData.stills || [];
  if (idx >= 0 && idx < stills.length) {
    currentStillIndex = idx;
    updateStillDisplay();
    if (stillAutoplayTimer) {
      clearInterval(stillAutoplayTimer);
      stillAutoplayTimer = setInterval(nextStill, 3000);
    }
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
    document.querySelectorAll('#cinemaStillImg, #cinemaStillImg2, [data-cinema-still-img]').forEach(el => {
      el.src = current.url;
    });
    document.querySelectorAll('#cinemaStillTitle, #cinemaStillTitle2, [data-cinema-still-title]').forEach(el => {
      el.textContent = current.title || '35mm Filming Location Still';
    });
    document.querySelectorAll('#cinemaStillDesc, #cinemaStillDesc2, [data-cinema-still-desc]').forEach(el => {
      el.textContent = current.desc || 'Original 35mm lens location capture';
    });
    document.querySelectorAll('#cinemaCounter, #cinemaCounter2, [data-cinema-counter]').forEach(el => {
      el.textContent = `${currentStillIndex + 1} / ${stills.length}`;
    });

    renderStillsThumbStrip();
  }
}

function startStillsAutoPlay() {
  if (!stillAutoplayTimer) {
    stillAutoplayTimer = setInterval(nextStill, 3000);
  }
  updateAutoPlayButtonUI(true);
}

function stopStillsAutoPlay() {
  if (stillAutoplayTimer) {
    clearInterval(stillAutoplayTimer);
    stillAutoplayTimer = null;
  }
  updateAutoPlayButtonUI(false);
}

function updateAutoPlayButtonUI(isPlaying) {
  document.querySelectorAll('#reelAutoPlayBtn, #reelAutoPlayBtn2, [data-reel-autoplay-btn]').forEach(btn => {
    if (isPlaying) {
      btn.innerHTML = `<i data-lucide="pause" class="w-3.5 h-3.5"></i> Pause Autoplay`;
      btn.classList.add('bg-amber-500/30', 'text-amber-300');
    } else {
      btn.innerHTML = `<i data-lucide="play" class="w-3.5 h-3.5"></i> Auto-Play Slideshow`;
      btn.classList.remove('bg-amber-500/30', 'text-amber-300');
    }
  });
  if (window.lucide) lucide.createIcons();
}

function toggleReelAutoPlay() {
  if (stillAutoplayTimer) {
    stopStillsAutoPlay();
  } else {
    startStillsAutoPlay();
  }
}

// --------------------------------------------------------------------------
// PAGE TEXT & HERO CONTENT EDITOR (DOUBLE-LINE NAVIGATION PRESERVATION)
// --------------------------------------------------------------------------
function formatNavTitleToDoubleLine(text) {
  if (!text) return '';
  if (text.includes('<br>')) return text;
  if (text.includes('\n')) return text.replace(/\n/g, '<br>');
  
  const clean = text.trim();
  const known = {
    'Casting Director Hub': 'Casting Director<br>Hub',
    'Casting Hub': 'Casting<br>Hub',
    'About SteveP Timeline': 'About SteveP<br>Timeline',
    'About Steve Pereira Timeline': 'About SteveP<br>Timeline',
    'Headshots & Full Body': 'Headshots &amp;<br>Full Body',
    'Professional Headshots & Full Body': 'Headshots &amp;<br>Full Body',
    '34-Yr IT Architect': '34-Yr IT<br>Architect',
    '34-Year IT Architect': '34-Yr IT<br>Architect',
    'Hacks & Savings': 'Hacks &amp;<br>Savings',
    'Hacks & Money Savings': 'Hacks &amp;<br>Savings',
    'SteveP Tech Hacks & Savings': 'Hacks &amp;<br>Savings',
    'KMST Recovery': 'KMST<br>Recovery',
    'KEEP ME SOBER TOO (KMST)': 'KMST<br>Recovery',
    'Book / Contact': 'Book /<br>Contact',
    'Book / Contact Steve': 'Book /<br>Contact'
  };
  if (known[clean]) return known[clean];

  const words = clean.split(/\s+/);
  if (words.length >= 3) {
    const mid = Math.ceil(words.length / 2);
    return words.slice(0, mid).join(' ') + '<br>' + words.slice(mid).join(' ');
  } else if (words.length === 2) {
    return words[0] + '<br>' + words[1];
  }
  return clean;
}

function applySiteTexts() {
  const t = appData.siteTexts || {};
  
  if (t.topBannerPin) {
    const el = document.getElementById('topBannerPinText');
    if (el) el.textContent = t.topBannerPin;
  }
  if (t.topBannerAgent) {
    const el = document.getElementById('topBannerAgentText');
    if (el) el.textContent = t.topBannerAgent;
  }
  if (t.actorName) {
    const el = document.getElementById('heroActorName');
    if (el) el.textContent = t.actorName;
  }
  if (t.actorSummary) {
    const el = document.getElementById('heroActorSummary');
    if (el) el.innerHTML = formatHeroSummary(t.actorSummary);
  }
  if (t.heroBadge1) {
    const el = document.getElementById('heroBadge1Text');
    if (el) el.textContent = t.heroBadge1;
  }
  if (t.heroBadge2) {
    const el = document.getElementById('heroBadge2');
    if (el) el.textContent = t.heroBadge2;
  }
  if (t.heroBadge3) {
    const el = document.getElementById('heroBadge3');
    if (el) el.textContent = t.heroBadge3;
  }
  if (t.heroTitle) {
    const el = document.getElementById('heroTitleText');
    if (el) el.textContent = t.heroTitle;
  }
  if (t.heroSubtitle) {
    const el = document.getElementById('heroSubtitleText');
    if (el) el.textContent = t.heroSubtitle;
  }
  if (t.heroBio) {
    const el = document.getElementById('heroBioText');
    if (el) el.textContent = t.heroBio;
  }
  if (t.stillsTitle) {
    const el = document.getElementById('stillsSectionTitle');
    if (el) el.textContent = t.stillsTitle;
  }
  if (t.headshotsTitle) {
    const el = document.getElementById('headshotsSectionTitle');
    if (el) el.textContent = t.headshotsTitle;
  }
  if (t.showreelsTitle) {
    const el = document.getElementById('showreelsSectionTitle');
    if (el) el.textContent = t.showreelsTitle;
  }
  if (t.hacksTitle) {
    const el = document.getElementById('hacksSectionTitle');
    if (el) el.textContent = t.hacksTitle;
  }
  if (t.itBadge) {
    const el = document.getElementById('itPageBadge');
    if (el) el.textContent = t.itBadge;
  }
  if (t.itHeading) {
    const el = document.getElementById('itPageHeading');
    if (el) el.textContent = t.itHeading;
  }
  if (t.itSummary) {
    const el = document.getElementById('itPageSummary');
    if (el) el.textContent = t.itSummary;
  }
  if (t.itYearsBadge) {
    const el = document.getElementById('itPageYearsBadge');
    if (el) el.textContent = t.itYearsBadge;
  }

  // Custom Page Tab Names with strict Double-Line Enforcement
  const tabNames = t.tabNames || {};
  const defaultNavMap = {
    casting: ['nav-casting', 'Casting Director<br>Hub'],
    about: ['nav-about', 'About SteveP<br>Timeline'],
    headshots: ['nav-headshots', 'Headshots &amp;<br>Full Body'],
    itexpert: ['nav-itexpert', '34-Yr IT<br>Architect'],
    hacks: ['nav-hacks', 'Hacks &amp;<br>Savings'],
    sobriety: ['nav-sobriety', 'KMST<br>Recovery'],
    booking: ['nav-booking', 'Book /<br>Contact']
  };

  Object.keys(defaultNavMap).forEach(key => {
    const [navId, defaultHtml] = defaultNavMap[key];
    const customText = tabNames[key];
    const btn = document.getElementById(navId);
    if (btn) {
      const span = btn.querySelector('span');
      if (span) {
        span.innerHTML = (customText && customText.trim())
          ? formatNavTitleToDoubleLine(customText)
          : defaultHtml;
      }
    }
  });
}

async function saveSiteTexts() {
  appData.siteTexts = appData.siteTexts || {};
  
  appData.siteTexts.topBannerPin = document.getElementById('editTopBannerPin')?.value || appData.siteTexts.topBannerPin;
  appData.siteTexts.topBannerAgent = document.getElementById('editTopBannerAgent')?.value || appData.siteTexts.topBannerAgent;
  appData.siteTexts.heroTitle = document.getElementById('editHeroTitle')?.value || appData.siteTexts.heroTitle;
  appData.siteTexts.heroSubtitle = document.getElementById('editHeroSubtitle')?.value || appData.siteTexts.heroSubtitle;
  appData.siteTexts.heroBio = document.getElementById('editHeroBio')?.value || appData.siteTexts.heroBio;
  appData.siteTexts.stillsTitle = document.getElementById('editStillsTitle')?.value || appData.siteTexts.stillsTitle;
  appData.siteTexts.headshotsTitle = document.getElementById('editHeadshotsTitle')?.value || appData.siteTexts.headshotsTitle;
  appData.siteTexts.showreelsTitle = document.getElementById('editShowreelsTitle')?.value || appData.siteTexts.showreelsTitle;
  appData.siteTexts.hacksTitle = document.getElementById('editHacksTitle')?.value || appData.siteTexts.hacksTitle;

  // Save Tab Names
  appData.siteTexts.tabNames = {
    casting: document.getElementById('editTabNameCasting')?.value || '',
    about: document.getElementById('editTabNameAbout')?.value || '',
    headshots: document.getElementById('editTabNameHeadshots')?.value || '',
    itexpert: document.getElementById('editTabNameIT')?.value || '',
    hacks: document.getElementById('editTabNameHacks')?.value || '',
    sobriety: document.getElementById('editTabNameSobriety')?.value || '',
    booking: document.getElementById('editTabNameBooking')?.value || ''
  };

  applySiteTexts();
  const ok = await saveAppDataToServer();
  alert(ok ? 'Successfully saved all page text, tab names, and banner content!' : 'Error saving page text.');
}

// --------------------------------------------------------------------------
// THEME & DESIGN STUDIO MANAGER (ADMIN PORTAL & SANDBOX EXPLORATION)
// --------------------------------------------------------------------------
const AVAILABLE_THEMES = [
  {
    id: 'editorial-light',
    name: '1. Editorial Studio Light',
    desc: 'Crisp high-contrast daylight, alabaster white, dark slate typography, and warm amber gold.',
    bg: '#f8fafc',
    accent: '#d97706',
    card: 'rgba(255,255,255,0.85)',
    tag: 'Daylight Gallery (Popular)'
  },
  {
    id: 'warm-linen',
    name: '2. Warm Linen & Terracotta',
    desc: 'Warm sand beige, Italian terracotta, espresso text, and creamy luxury editorial cards.',
    bg: '#f5ede0',
    accent: '#c2410c',
    card: 'rgba(254,250,243,0.88)',
    tag: 'Vogue Luxury'
  },
  {
    id: 'nordic-frost',
    name: '3. Nordic Glacier & Arctic Teal',
    desc: 'Crisp pale ice-blue, frosted crystal cards, arctic teal accents, and deep navy text.',
    bg: '#eef6fb',
    accent: '#0284c7',
    card: 'rgba(255,255,255,0.88)',
    tag: 'Ice Light Modern'
  },
  {
    id: 'neon-sunset',
    name: '4. Miami Neon Sunset',
    desc: 'Midnight twilight with glowing electric magenta, synthwave cyan, and sunset orange.',
    bg: '#0d041c',
    accent: '#f43f5e',
    card: 'rgba(28,10,56,0.58)',
    tag: 'Synthwave Bold'
  },
  {
    id: 'royal-navy',
    name: '5. Oxford Royal Navy & Gold',
    desc: 'Deep collegiate luxury navy with champagne gold accents and sapphire highlights.',
    bg: '#071426',
    accent: '#fbbf24',
    card: 'rgba(15,32,58,0.62)',
    tag: 'Executive Prestige'
  },
  {
    id: 'emerald-matrix',
    name: '6. Cyber Matrix Emerald',
    desc: 'Pitch obsidian black with electric matrix lime green and glowing cyber borders.',
    bg: '#010d06',
    accent: '#00ff66',
    card: 'rgba(2,28,14,0.65)',
    tag: 'Matrix Cyberpunk'
  },
  {
    id: 'crimson-stage',
    name: '7. Hollywood Crimson Stage',
    desc: 'Dramatic velvet burgundy and ruby reds with warm golden Hollywood stage spotlight glow.',
    bg: '#1c0409',
    accent: '#f43f5e',
    card: 'rgba(45,8,16,0.65)',
    tag: 'Dramatic Cinema'
  },
  {
    id: 'noir',
    name: '8. Pure Cinema Noir',
    desc: 'Signature deep pitch obsidian with amber gold glow, crimson accents, and sharp contrast.',
    bg: '#030712',
    accent: '#f59e0b',
    card: 'rgba(10,15,28,0.48)',
    tag: 'Signature Default'
  }
];

const AVAILABLE_LAYOUTS = {
  about: [
    { id: 'zigzag', name: 'Vertical Alternating Zig-Zag (Default)', desc: 'Classic chronological timeline with central glowing axis.' },
    { id: 'roadmap', name: '3-Column Milestone Cards', desc: 'Modern responsive card grid sorted by era with year badges.' },
    { id: 'story-cards', name: 'Editorial Story Bento Cards', desc: 'Top featured era story spotlight with 2-column milestone narrative.' }
  ],
  it: [
    { id: 'blueprint', name: 'Enterprise Architecture Blueprint (Default)', desc: 'Dual-column architecture specs & AI generator.' },
    { id: 'terminal', name: 'Cyber Command Center Dashboard', desc: 'High-tech CLI console layout with live system metrics.' },
    { id: 'consulting', name: 'Executive Consultancy & Case Studies', desc: '3-Column executive consulting portfolio.' }
  ],
  hacks: [
    { id: 'cards-deck', name: 'Interactive Promo Cards (Default)', desc: '3-Column responsive card deck with logos & copy buttons.' },
    { id: 'table-list', name: 'Compact Deal Matrix & Aggregator', desc: 'High-efficiency quick-search tabular aggregator.' },
    { id: 'bento-deals', name: 'Featured Hot Deals Bento Showcase', desc: 'Top 3 mega-discount hero banners + category tiles.' }
  ]
};

let _stagedTheme = null;

function renderAdminThemes() {
  const themeContainer = document.getElementById('adminThemeCardsGrid');
  const layoutContainer = document.getElementById('adminLayoutStudioGrid');
  
  const currentSaved = appData.activeTheme || 'noir';
  const activeNow = document.documentElement.getAttribute('data-theme') || currentSaved;

  if (themeContainer) {
    themeContainer.innerHTML = AVAILABLE_THEMES.map(theme => {
      const isSaved = (theme.id === currentSaved);
      const isCurrentlyPreviewed = (theme.id === activeNow);

      return `
        <div class="glass-card rounded-2xl p-5 border ${isCurrentlyPreviewed ? 'border-amber-400/90 shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'border-slate-800'} space-y-4 flex flex-col justify-between transition relative overflow-hidden">
          ${isSaved ? '<span class="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[9px] font-black uppercase font-mono-code">★ Active Live</span>' : ''}
          ${!isSaved && isCurrentlyPreviewed ? '<span class="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 text-[9px] font-black uppercase font-mono-code">👁 Previewing</span>' : ''}
          
          <div class="space-y-2">
            <div class="flex items-center gap-2">
              <span class="w-5 h-5 rounded-full border border-white/20 shadow-inner flex-shrink-0" style="background-color: ${theme.accent};"></span>
              <h4 class="font-black text-white font-cinzel text-sm">${theme.name}</h4>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">${theme.desc}</p>
            
            <!-- Palette Swatches -->
            <div class="flex items-center gap-1.5 pt-1">
              <span class="w-4 h-4 rounded-md border border-white/10" style="background: ${theme.bg};" title="Background"></span>
              <span class="w-4 h-4 rounded-md border border-white/10" style="background: ${theme.card};" title="Card Surface"></span>
              <span class="w-4 h-4 rounded-md border border-white/10" style="background: ${theme.accent};" title="Accent Glow"></span>
              <span class="text-[10px] font-mono-code text-slate-400 ml-1.5">${theme.tag}</span>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-2">
            <button onclick="previewTheme('${theme.id}')" class="px-3 py-2 rounded-xl ${isCurrentlyPreviewed ? 'bg-amber-500/20 text-amber-300 border border-amber-400' : 'bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700'} font-bold text-xs flex items-center justify-center gap-1.5 transition">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Preview
            </button>

            <button onclick="saveActiveTheme('${theme.id}')" class="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition">
              <i data-lucide="check" class="w-3.5 h-3.5"></i> Set Live
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  // Render Layouts Studio
  if (layoutContainer) {
    appData.layouts = appData.layouts || { about: 'zigzag', it: 'blueprint', hacks: 'cards-deck' };
    
    const sections = [
      { key: 'about', title: '1. About SteveP Timeline Page Layout', items: AVAILABLE_LAYOUTS.about },
      { key: 'it', title: '2. 34-Year IT Architect Page Layout', items: AVAILABLE_LAYOUTS.it },
      { key: 'hacks', title: '3. Hacks & Money Savings Page Layout', items: AVAILABLE_LAYOUTS.hacks }
    ];

    layoutContainer.innerHTML = sections.map(sec => `
      <div class="glass-card rounded-2xl p-5 border border-slate-800 space-y-3">
        <h5 class="text-xs font-black text-amber-400 uppercase tracking-wider font-mono-code flex items-center gap-2">
          <i data-lucide="layout" class="w-3.5 h-3.5"></i> ${sec.title}
        </h5>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          ${sec.items.map(opt => {
            const isActive = (appData.layouts[sec.key] === opt.id);
            return `
              <div onclick="previewLayout('${sec.key}', '${opt.id}')" class="p-3.5 rounded-xl border cursor-pointer transition ${isActive ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md' : 'bg-slate-900/80 border-slate-800 hover:border-slate-600 text-slate-300'} space-y-1">
                <div class="flex items-center justify-between">
                  <strong class="text-xs font-bold font-cinzel ${isActive ? 'text-amber-300' : 'text-white'}">${opt.name}</strong>
                  ${isActive ? '<i data-lucide="check-circle" class="w-3.5 h-3.5 text-amber-400"></i>' : ''}
                </div>
                <p class="text-[11px] text-slate-400 leading-tight">${opt.desc}</p>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('');
  }

  const statusEl = document.getElementById('adminCurrentThemeStatus');
  if (statusEl) {
    statusEl.innerHTML = `Active Live Theme: <strong class="text-amber-400">${currentSaved.toUpperCase()}</strong> | Previewing: <strong class="text-cyan-400">${activeNow.toUpperCase()}</strong>`;
  }

  updateBgStudioUI();

  if (window.lucide) lucide.createIcons();
}

window.updateBgSelectorUI = updateBgStudioUI;

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL ATMOSPHERIC BACKGROUND & ARTISTRY STUDIO ENGINE
// ═══════════════════════════════════════════════════════════════════════════

function setBgMode(mode) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.mode = mode;
  applyBgSettings();
  updateBgStudioUI();
  saveAppDataToServer();
}

function applyBgSettings() {
  const bgLayer = document.getElementById('globalBgLayer');
  const colorLayer = document.getElementById('globalBgColorLayer');
  const overlayLayer = document.getElementById('globalBgOverlay');
  const bgConfig = appData.bgConfig || {
    mode: 'image',
    activeImage: appData.activeBgImage || 'assets/steve_bw_stitched_bg.jpg',
    brightness: 85,
    contrast: 115,
    overlayDensity: 35,
    glassOpacity: 48,
    parallaxEnabled: true,
    direction: 'opposite',
    speed: 0.16,
    plainColor: '#030712'
  };

  const mode = bgConfig.mode || 'image';

  // 1. Photo Wallpaper Layer
  if (bgLayer) {
    if (mode === 'image') {
      bgLayer.classList.remove('hidden');
      const activeImg = bgConfig.activeImage || appData.activeBgImage || 'assets/steve_bw_stitched_bg.jpg';
      bgLayer.style.backgroundImage = `url('${activeImg}')`;
      const b = (bgConfig.brightness || 85) / 100;
      const c = (bgConfig.contrast || 115);
      bgLayer.style.filter = `grayscale(100%) contrast(${c}%) brightness(${b})`;
      bgLayer.style.opacity = '1';
    } else {
      bgLayer.classList.add('hidden');
      bgLayer.style.opacity = '0';
    }
  }

  // 2. Plain Color Layer
  if (colorLayer) {
    if (mode === 'plain') {
      colorLayer.classList.remove('hidden');
      const col = bgConfig.plainColor || '#030712';
      colorLayer.style.background = col;
      colorLayer.style.opacity = '1';
    } else {
      colorLayer.classList.add('hidden');
      colorLayer.style.opacity = '0';
    }
  }

  // 3. Dark Overlay / Vignette Layer
  if (overlayLayer) {
    if (mode === 'off') {
      overlayLayer.style.opacity = '0';
    } else {
      const density = (typeof bgConfig.overlayDensity === 'number' ? bgConfig.overlayDensity : 35) / 100;
      overlayLayer.style.opacity = density > 0 ? (density * 1.5).toString() : '0';
    }
  }

  // 4. Glass Cards Transparency
  const glass = typeof bgConfig.glassOpacity === 'number' ? bgConfig.glassOpacity : 48;
  document.documentElement.style.setProperty('--glass-opacity', (glass / 100).toString());
}

async function setActiveBackground(url) {
  appData.activeBgImage = url;
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.activeImage = url;
  appData.bgConfig.mode = 'image';
  applyBgSettings();
  updateBgStudioUI();
  await saveAppDataToServer();
}

function setBgPlainColor(hex) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.mode = 'plain';
  appData.bgConfig.plainColor = hex;
  const picker = document.getElementById('adminBgColorPicker');
  if (picker) picker.value = hex;
  applyBgSettings();
  updateBgStudioUI();
  saveAppDataToServer();
}

function updateBgBrightness(val) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.brightness = parseInt(val, 10);
  const label = document.getElementById('bgBrightnessVal');
  if (label) label.textContent = `${val}%`;
  applyBgSettings();
}

function updateBgContrast(val) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.contrast = parseInt(val, 10);
  const label = document.getElementById('bgContrastVal');
  if (label) label.textContent = `${val}%`;
  applyBgSettings();
}

function updateBgOverlayDensity(val) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.overlayDensity = parseInt(val, 10);
  const label = document.getElementById('bgOverlayVal');
  if (label) label.textContent = `${val}%`;
  applyBgSettings();
}

function updateGlassOpacity(val) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.glassOpacity = parseInt(val, 10);
  const label = document.getElementById('glassOpacityVal');
  if (label) label.textContent = `${val}%`;
  applyBgSettings();
}

function toggleBgParallax(enabled) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.parallaxEnabled = !!enabled;
  saveAppDataToServer();
}

function setBgParallaxDirection(dir) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.direction = dir;
  saveAppDataToServer();
}

function updateBgParallaxSpeed(val) {
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.speed = parseInt(val, 10) / 100;
  const label = document.getElementById('bgSpeedVal');
  if (label) label.textContent = `${val}%`;
}

async function handleBgFileUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  try {
    const compressedDataUrl = await compressImage(file, 1920, 1920, 0.76);
    const res = await fetch('/api/background/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl: compressedDataUrl, name: file.name })
    });
    const data = await res.json();
    if (data.success && data.url) {
      appData.activeBgImage = data.url;
      appData.bgConfig = appData.bgConfig || {};
      appData.bgConfig.activeImage = data.url;
      appData.bgConfig.mode = 'image';
      applyBgSettings();
      updateBgStudioUI();
      alert('Custom background uploaded, compressed & saved as isolated asset!');
    } else {
      alert('Upload failed: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Error uploading background: ' + err.message);
  }
}

async function resetBgStudioSettings() {
  if (!confirm('Reset background wallpaper, lighting, and parallax motion back to signature defaults?')) return;

  const defaultImg = 'assets/steve_35mm_contact_wallpaper.jpg';
  appData.activeBgImage = defaultImg;
  appData.bgConfig = {
    mode: 'image',
    activeImage: defaultImg,
    brightness: 85,
    contrast: 115,
    overlayDensity: 35,
    glassOpacity: 48,
    parallaxEnabled: true,
    direction: 'opposite',
    speed: 0.16,
    plainColor: '#030712'
  };

  applyBgSettings();
  updateBgStudioUI();
  await saveAppDataToServer();
  alert('Background & Artistry Studio reset to signature default settings!');
}

// Media Bank Background Picker Modal
let _bgMediaPickerFilter = 'ALL';

function openBgMediaPickerModal() {
  const modal = document.getElementById('bgMediaPickerModal');
  if (modal) modal.classList.remove('hidden');
  renderBgMediaPickerGrid();
}

function closeBgMediaPickerModal() {
  const modal = document.getElementById('bgMediaPickerModal');
  if (modal) modal.classList.add('hidden');
}

function filterBgMediaPicker(category) {
  _bgMediaPickerFilter = category;
  const tabs = document.querySelectorAll('#bgMediaFilterTabs .bg-filter-btn');
  tabs.forEach(btn => {
    if (btn.textContent.includes(category) || (category === 'ALL' && btn.textContent.includes('All'))) {
      btn.className = "bg-filter-btn px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 shadow whitespace-nowrap";
    } else {
      btn.className = "bg-filter-btn px-3 py-1 rounded-lg text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 whitespace-nowrap";
    }
  });
  renderBgMediaPickerGrid();
}

function getAllPortfolioPhotos() {
  const list = [];
  const seen = new Set();

  function add(item, defaultCategory) {
    if (!item) return;
    const imgUrl = item.url || item.fileUrl || item.image || item.src;
    if (imgUrl && typeof imgUrl === 'string' && !seen.has(imgUrl) && !imgUrl.endsWith('.mp4') && !imgUrl.endsWith('.mov')) {
      seen.add(imgUrl);
      list.push({
        id: item.id || ('img_' + list.length),
        url: imgUrl,
        title: item.title || item.name || 'Steve Pereira Photo',
        tag: item.tag || item.category || defaultCategory || 'Portfolio Photo'
      });
    }
  }

  (appData.headshots || []).forEach(h => add(h, 'Headshots'));
  (appData.stills || []).forEach(s => add(s, 'Film Stills'));
  (appData.fullBodySlates || []).forEach(f => add(f, 'Stage Combat & Tactical'));
  (appData.media || []).forEach(m => add(m, 'Media Bank'));

  return list;
}

function renderBgMediaPickerGrid() {
  const grid = document.getElementById('bgMediaPickerGrid');
  if (!grid) return;

  const allPhotos = getAllPortfolioPhotos();
  const filtered = _bgMediaPickerFilter === 'ALL' 
    ? allPhotos 
    : allPhotos.filter(m => (m.tag || '').toLowerCase().includes(_bgMediaPickerFilter.toLowerCase()));

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-12 text-center text-slate-400 italic text-xs">No photos found in this category.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const imgUrl = item.url;
    const title = item.title;
    const tag = item.tag;
    return `
      <div onclick="selectBgFromMediaBank('${encodeURIComponent(imgUrl)}')" class="group relative rounded-xl overflow-hidden border border-slate-800 hover:border-amber-400 cursor-pointer bg-slate-900 transition aspect-[4/5] shadow-md hover:scale-[1.02]">
        <img src="${escapeHtml(imgUrl)}" alt="${escapeHtml(title)}" class="w-full h-full object-cover group-hover:brightness-110 transition">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-transparent to-transparent opacity-80 group-hover:opacity-95 transition flex flex-col justify-end p-2.5">
          <span class="text-[9px] font-mono-code font-bold text-amber-400 uppercase tracking-wider block truncate">${escapeHtml(tag)}</span>
          <strong class="text-xs font-bold text-white block truncate">${escapeHtml(title)}</strong>
          <span class="text-[10px] text-cyan-300 font-mono-code mt-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
            <i data-lucide="check-circle" class="w-3 h-3"></i> Apply as Isolated Background
          </span>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function selectBgFromMediaBank(encodedUrl) {
  const mediaUrl = decodeURIComponent(encodedUrl);
  try {
    const res = await fetch('/api/background/copy-from-media', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mediaUrl })
    });
    const data = await res.json();
    if (data.success && data.url) {
      appData.activeBgImage = data.url;
      appData.bgConfig = appData.bgConfig || {};
      appData.bgConfig.activeImage = data.url;
      appData.bgConfig.mode = 'image';
      applyBgSettings();
      updateBgStudioUI();
      closeBgMediaPickerModal();
      alert('Photo isolated and set as your live background!');
    } else {
      setActiveBackground(mediaUrl);
      closeBgMediaPickerModal();
    }
  } catch (err) {
    setActiveBackground(mediaUrl);
    closeBgMediaPickerModal();
  }
}

function updateBgStudioUI() {
  const bgConfig = appData.bgConfig || { mode: 'image', activeImage: appData.activeBgImage || 'assets/steve_35mm_contact_wallpaper.jpg' };
  const mode = bgConfig.mode || 'image';
  const currentImg = bgConfig.activeImage || appData.activeBgImage || 'assets/steve_35mm_contact_wallpaper.jpg';

  // Mode Buttons
  const btnImg = document.getElementById('bgModeBtn-image');
  const btnPlain = document.getElementById('bgModeBtn-plain');
  const btnOff = document.getElementById('bgModeBtn-off');
  const secPhoto = document.getElementById('bgPhotoSection');
  const secPlain = document.getElementById('bgPlainSection');

  if (btnImg) btnImg.className = mode === 'image' ? "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-amber-500 text-slate-950 shadow" : "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5";
  if (btnPlain) btnPlain.className = mode === 'plain' ? "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-amber-500 text-slate-950 shadow" : "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5";
  if (btnOff) btnOff.className = mode === 'off' ? "px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 bg-amber-500 text-slate-950 shadow" : "px-3 py-1.5 rounded-lg text-xs font-bold text-slate-400 hover:text-white transition flex items-center gap-1.5";

  if (secPhoto) secPhoto.classList.toggle('hidden', mode !== 'image');
  if (secPlain) secPlain.classList.toggle('hidden', mode !== 'plain');

  // Photo Cards Badges
  const optStitched = document.getElementById('bgOption-stitched');
  const optTattoo = document.getElementById('bgOption-tattoo');
  const optCustom = document.getElementById('bgOption-custom');
  const badgeStitched = document.getElementById('badge-bg-stitched');
  const badgeTattoo = document.getElementById('badge-bg-tattoo');
  const badgeCustom = document.getElementById('badge-bg-custom');
  const customImg = document.getElementById('bgCustomPreviewImg');
  const customEmpty = document.getElementById('bgCustomEmptyText');

  if (currentImg.includes('stitched') || currentImg.includes('35mm_contact') || currentImg.includes('steve_bw_stitched_bg')) {
    if (optStitched) optStitched.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900 border-amber-500/60 shadow-lg";
    if (optTattoo) optTattoo.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900/60 border-slate-800 hover:border-slate-700";
    if (optCustom) optCustom.className = "p-3.5 rounded-xl border transition space-y-2 bg-slate-900/60 border-slate-800";
    if (badgeStitched) badgeStitched.classList.remove('hidden');
    if (badgeTattoo) badgeTattoo.classList.add('hidden');
    if (badgeCustom) badgeCustom.classList.add('hidden');
  } else if (currentImg.includes('tattoo')) {
    if (optTattoo) optTattoo.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900 border-amber-500/60 shadow-lg";
    if (optStitched) optStitched.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900/60 border-slate-800 hover:border-slate-700";
    if (optCustom) optCustom.className = "p-3.5 rounded-xl border transition space-y-2 bg-slate-900/60 border-slate-800";
    if (badgeTattoo) badgeTattoo.classList.remove('hidden');
    if (badgeStitched) badgeStitched.classList.add('hidden');
    if (badgeCustom) badgeCustom.classList.add('hidden');
  } else {
    if (optCustom) optCustom.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900 border-amber-500/60 shadow-lg";
    if (optStitched) optStitched.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900/60 border-slate-800 hover:border-slate-700";
    if (optTattoo) optTattoo.className = "p-3.5 rounded-xl border cursor-pointer transition space-y-2 bg-slate-900/60 border-slate-800 hover:border-slate-700";
    if (badgeCustom) badgeCustom.classList.remove('hidden');
    if (badgeStitched) badgeStitched.classList.add('hidden');
    if (badgeTattoo) badgeTattoo.classList.add('hidden');
    if (customImg) {
      customImg.src = currentImg;
      customImg.classList.remove('hidden');
    }
    if (customEmpty) customEmpty.classList.add('hidden');
  }

  // Sliders and controls values
  const brightness = typeof bgConfig.brightness === 'number' ? bgConfig.brightness : 85;
  const contrast = typeof bgConfig.contrast === 'number' ? bgConfig.contrast : 115;
  const overlayDensity = typeof bgConfig.overlayDensity === 'number' ? bgConfig.overlayDensity : 35;
  const glassOpacity = typeof bgConfig.glassOpacity === 'number' ? bgConfig.glassOpacity : 48;
  const speed = typeof bgConfig.speed === 'number' ? Math.round(bgConfig.speed * 100) : 16;
  const dir = bgConfig.direction || 'opposite';
  const parallaxOn = bgConfig.parallaxEnabled !== false;

  const sliderBright = document.getElementById('adminBgBrightnessSlider');
  const sliderContrast = document.getElementById('adminBgContrastSlider');
  const sliderOverlay = document.getElementById('adminBgOverlaySlider');
  const sliderGlass = document.getElementById('adminGlassOpacitySlider');
  const sliderSpeed = document.getElementById('adminBgSpeedSlider');
  const selectDir = document.getElementById('adminBgParallaxDirection');
  const toggleParallax = document.getElementById('adminBgParallaxToggle');

  if (sliderBright) sliderBright.value = brightness;
  if (sliderContrast) sliderContrast.value = contrast;
  if (sliderOverlay) sliderOverlay.value = overlayDensity;
  if (sliderGlass) sliderGlass.value = glassOpacity;
  if (sliderSpeed) sliderSpeed.value = speed;
  if (selectDir) selectDir.value = dir;
  if (toggleParallax) toggleParallax.checked = parallaxOn;

  const lblBright = document.getElementById('bgBrightnessVal');
  const lblContrast = document.getElementById('bgContrastVal');
  const lblOverlay = document.getElementById('bgOverlayVal');
  const lblGlass = document.getElementById('glassOpacityVal');
  const lblSpeed = document.getElementById('bgSpeedVal');

  if (lblBright) lblBright.textContent = `${brightness}%`;
  if (lblContrast) lblContrast.textContent = `${contrast}%`;
  if (lblOverlay) lblOverlay.textContent = `${overlayDensity}%`;
  if (lblGlass) lblGlass.textContent = `${glassOpacity}%`;
  if (lblSpeed) lblSpeed.textContent = `${speed}%`;
}

function previewTheme(themeId) {
  _stagedTheme = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  renderAdminThemes();
}

function saveActiveTheme(themeId) {
  appData.activeTheme = themeId;
  _stagedTheme = themeId;
  document.documentElement.setAttribute('data-theme', themeId);
  renderAdminThemes();
  saveAppDataToServer();
  alert(`Theme "${themeId.toUpperCase()}" is now permanently saved as the public live theme!`);
}

function revertTheme() {
  const saved = appData.activeTheme || 'noir';
  _stagedTheme = saved;
  document.documentElement.setAttribute('data-theme', saved);
  renderAdminThemes();
}

function previewLayout(section, layoutId) {
  appData.layouts = appData.layouts || { about: 'zigzag', it: 'blueprint', hacks: 'cards-deck' };
  appData.layouts[section] = layoutId;
  if (section === 'about') renderAboutTimeline();
  if (section === 'it') renderITTimeline();
  if (section === 'hacks') renderHacks();
  renderAdminThemes();
}

async function saveActiveLayouts() {
  await saveAppDataToServer();
  alert('Successfully saved all live layout presets!');
}

// --------------------------------------------------------------------------
// ADMIN TIMELINES & PAGE CONTENT MANAGER (ABOUT & IT CAREER)
// --------------------------------------------------------------------------
function renderAdminTimelines() {
  const aboutBody = document.getElementById('adminAboutTimelineBody');
  const itBody = document.getElementById('adminITTimelineBody');

  if (aboutBody) {
    const rawItems = appData.aboutTimeline || [];
    if (rawItems.length === 0) {
      aboutBody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">No timeline entries found. Click "+ Add New Milestone" above.</td></tr>`;
    } else {
      // Sort chronologically by initial date
      const items = [...rawItems].sort((a, b) => getInitialDateValue(a) - getInitialDateValue(b));

      aboutBody.innerHTML = items.map((item, idx) => {
        const pal = getTimelinePalette(idx, item);
        const originalIndex = rawItems.findIndex(x => (x.id && x.id === item.id) || (x.title === item.title && x.year === item.year));
        const webBadge = item.url ? `
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-[11px] font-mono-code font-bold hover:bg-cyan-500 hover:text-slate-950 transition shadow-sm" title="${escapeHtml(item.url)}">
            <i data-lucide="external-link" class="w-3 h-3"></i>
            <span class="max-w-[130px] truncate">${escapeHtml(item.urlText || 'Web Page')}</span>
          </a>
        ` : `<span class="text-slate-500 text-[11px] italic font-mono-code">— None —</span>`;

        return `
          <tr class="hover:bg-slate-900/70 transition ${pal.cmsBorder}">
            <td class="p-3 font-mono-code whitespace-nowrap">
              <span class="px-2.5 py-1 rounded-lg ${pal.yearPill} font-bold text-xs block text-center shadow-sm">${escapeHtml(item.year || item.date || '')}</span>
            </td>
            <td class="p-3 whitespace-nowrap">
              <div class="space-y-1">
                <span class="px-2.5 py-0.5 rounded-full ${pal.tagClass} font-extrabold text-[10px] font-mono-code uppercase block text-center shadow-sm">${escapeHtml(item.tag || item.category || 'MILESTONE')}</span>
                <span class="text-[9px] text-slate-400 font-mono-code block text-center">${pal.label}</span>
              </div>
            </td>
            <td class="p-3 max-w-md">
              <strong class="text-white text-xs block font-bold font-cinzel">${escapeHtml(item.title)}</strong>
              ${item.location ? `<span class="text-[10px] text-slate-400 font-mono-code block">${escapeHtml(item.location)}</span>` : ''}
              <span class="text-slate-300 text-[11px] block line-clamp-2 mt-0.5 leading-relaxed">${escapeHtml(item.desc)}</span>
            </td>
            <td class="p-3 whitespace-nowrap">
              ${webBadge}
            </td>
            <td class="p-3 text-right space-x-1 whitespace-nowrap">
              <button onclick="openEditAboutTimelineModal('${item.id || originalIndex}')" class="px-2.5 py-1.5 rounded-lg bg-slate-800 text-amber-400 hover:bg-amber-500 hover:text-slate-950 border border-slate-700 hover:border-amber-400 font-bold text-xs transition shadow-sm">
                Edit
              </button>
              <button onclick="deleteAboutTimeline(${originalIndex})" class="px-2.5 py-1.5 rounded-lg bg-rose-600/80 text-white hover:bg-rose-600 font-bold text-xs transition shadow-sm">
                Delete
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (itBody) {
    const items = appData.itTimeline || [];
    if (items.length === 0) {
      itBody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 italic">No IT milestones found. Click "+ Add IT Milestone" above.</td></tr>`;
    } else {
      itBody.innerHTML = items.map((item, idx) => `
        <tr class="hover:bg-slate-900/60 transition">
          <td class="p-2.5 font-mono-code font-bold text-cyan-400 whitespace-nowrap">${escapeHtml(item.year)}</td>
          <td class="p-2.5 font-bold text-slate-300 text-xs">${escapeHtml(item.company || '-')}</td>
          <td class="p-2.5">
            <strong class="text-white text-xs block font-cinzel">${escapeHtml(item.title)}</strong>
            <span class="text-slate-400 text-[11px] block line-clamp-1">${escapeHtml(item.desc)}</span>
          </td>
          <td class="p-2.5 text-right space-x-1 whitespace-nowrap">
            <button onclick="editITTimelinePrompt(${idx})" class="px-2.5 py-1 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700 font-bold text-[10px]">Edit</button>
            <button onclick="deleteITTimeline(${idx})" class="px-2.5 py-1 rounded bg-rose-600/80 text-white hover:bg-rose-500 font-bold text-[10px]">Delete</button>
          </td>
        </tr>
      `).join('');
    }
  }

  if (window.lucide) lucide.createIcons();
}

function openAddAboutTimelineModal() {
  const modal = document.getElementById('aboutTimelineEditModal');
  if (!modal) return;
  
  document.getElementById('aboutModalId').value = '';
  document.getElementById('aboutModalYear').value = '';
  document.getElementById('aboutModalTitle').value = '';
  document.getElementById('aboutModalTag').value = 'MILESTONE';
  document.getElementById('aboutModalColor').value = 'auto';
  document.getElementById('aboutModalIcon').value = 'star';
  document.getElementById('aboutModalUrl').value = '';
  document.getElementById('aboutModalUrlText').value = '';
  document.getElementById('aboutModalDesc').value = '';
  document.getElementById('aboutTimelineModalHeading').innerHTML = `<i data-lucide="plus-circle" class="w-4 h-4 text-purple-400"></i> Add New Life Story Milestone`;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function openEditAboutTimelineModal(idOrIdx) {
  const modal = document.getElementById('aboutTimelineEditModal');
  if (!modal) return;

  let item = null;
  if (typeof idOrIdx === 'string' && idOrIdx.startsWith('ab_')) {
    item = (appData.aboutTimeline || []).find(x => x.id === idOrIdx);
  } else {
    const idx = parseInt(idOrIdx, 10);
    item = (appData.aboutTimeline || [])[idx];
  }

  if (!item) return alert('Milestone not found');

  document.getElementById('aboutModalId').value = item.id || '';
  document.getElementById('aboutModalYear').value = item.year || item.date || '';
  document.getElementById('aboutModalTitle').value = item.title || '';
  document.getElementById('aboutModalTag').value = item.tag || item.category || 'MILESTONE';
  document.getElementById('aboutModalColor').value = item.colorTheme || 'auto';
  document.getElementById('aboutModalIcon').value = item.icon || 'star';
  document.getElementById('aboutModalUrl').value = item.url || item.link || '';
  document.getElementById('aboutModalUrlText').value = item.urlText || item.linkText || '';
  document.getElementById('aboutModalDesc').value = item.desc || '';
  document.getElementById('aboutTimelineModalHeading').innerHTML = `<i data-lucide="edit-3" class="w-4 h-4 text-purple-400"></i> Edit Life Story Milestone`;

  modal.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function closeAboutTimelineModal(e) {
  if (e && e.target !== e.currentTarget) return;
  document.getElementById('aboutTimelineEditModal')?.classList.add('hidden');
}

async function handleSaveAboutTimelineModal(e) {
  e.preventDefault();
  const id = document.getElementById('aboutModalId')?.value;
  const year = document.getElementById('aboutModalYear')?.value.trim();
  const title = document.getElementById('aboutModalTitle')?.value.trim();
  const tag = document.getElementById('aboutModalTag')?.value.trim() || 'MILESTONE';
  const colorTheme = document.getElementById('aboutModalColor')?.value || 'auto';
  const icon = document.getElementById('aboutModalIcon')?.value || 'star';
  const url = document.getElementById('aboutModalUrl')?.value.trim();
  const urlText = document.getElementById('aboutModalUrlText')?.value.trim();
  const desc = document.getElementById('aboutModalDesc')?.value.trim();

  if (!year || !title || !desc) {
    return alert('Please fill in Year/Date, Title, and Description.');
  }

  appData.aboutTimeline = appData.aboutTimeline || [];

  if (id) {
    const existing = appData.aboutTimeline.find(x => x.id === id);
    if (existing) {
      existing.year = year;
      existing.title = title;
      existing.tag = tag;
      existing.colorTheme = colorTheme;
      existing.icon = icon;
      existing.url = url;
      existing.urlText = urlText;
      existing.desc = desc;
    }
  } else {
    const newId = 'ab_' + Date.now();
    appData.aboutTimeline.push({
      id: newId,
      year,
      title,
      tag,
      colorTheme,
      icon,
      url,
      urlText,
      desc
    });
  }

  // Sort permanently by initial date
  appData.aboutTimeline.sort((a, b) => getInitialDateValue(a) - getInitialDateValue(b));

  closeAboutTimelineModal();
  renderAll();
  const saved = await saveAppDataToServer();
  if (saved) {
    alert('✅ Milestone saved permanently to database!');
  } else {
    alert('⚠️ Milestone saved in browser state');
  }
}

async function deleteAboutTimeline(idx) {
  if (!confirm('Are you sure you want to delete this About Timeline milestone?')) return;
  appData.aboutTimeline.splice(idx, 1);
  renderAll();
  await saveAppDataToServer();
}

async function addITTimelinePrompt() {
  const year = prompt('Year range (e.g. 2022 - 2026):', '2026');
  if (!year) return;
  const company = prompt('Company / Location (e.g. Dubai / UK):', 'Enterprise Cloud Consultancy');
  if (!company) return;
  const title = prompt('Role Title:', 'Senior Enterprise Architect');
  if (!title) return;
  const desc = prompt('Key Achievements & Details:', 'Engineered high-resiliency cloud architecture...');
  if (!desc) return;

  appData.itTimeline = appData.itTimeline || [];
  appData.itTimeline.unshift({ id: 'it_' + Date.now(), year, company, title, desc });
  renderAll();
  await saveAppDataToServer();
}

async function editITTimelinePrompt(idx) {
  const item = appData.itTimeline[idx];
  if (!item) return;

  const year = prompt('Edit Year:', item.year);
  if (year === null) return;
  const company = prompt('Edit Company/Client:', item.company);
  if (company === null) return;
  const title = prompt('Edit Title:', item.title);
  if (title === null) return;
  const desc = prompt('Edit Description:', item.desc);
  if (desc === null) return;

  item.year = year;
  item.company = company;
  item.title = title;
  item.desc = desc;

  renderAll();
  await saveAppDataToServer();
}

async function deleteITTimeline(idx) {
  if (!confirm('Are you sure you want to delete this IT Career milestone?')) return;
  appData.itTimeline.splice(idx, 1);
  renderAll();
  await saveAppDataToServer();
}

// --------------------------------------------------------------------------
// HACKS & MONEY SAVING DEALS CRUD MANAGER
// --------------------------------------------------------------------------
function renderAdminHacksTable() {
  const tbody = document.getElementById('adminHacksTableBody');
  if (!tbody) return;

  const hacks = appData.hacks || [];
  if (hacks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No hacks or deals added yet. Click "Add New Hack / Deal" above.</td></tr>`;
    return;
  }

  tbody.innerHTML = hacks.map(h => `
    <tr class="hover:bg-slate-900/60 transition">
      <td class="p-3 font-mono-code text-slate-300 font-bold">${h.category}</td>
      <td class="p-3">
        <strong class="text-white text-xs block">${h.title}</strong>
        <span class="text-slate-400 text-[11px] block truncate max-w-xs">${h.desc}</span>
      </td>
      <td class="p-3 font-mono-code font-bold text-amber-400">${h.code}</td>
      <td class="p-3"><span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 font-bold text-[10px]">${h.badge}</span></td>
      <td class="p-3 text-right space-x-1">
        <button onclick="openEditHackModal('${h.id}')" class="px-2.5 py-1 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-[10px]">Edit</button>
        <button onclick="deleteHack('${h.id}')" class="px-2.5 py-1 rounded bg-rose-600/80 text-white hover:bg-rose-500 font-bold text-[10px]">Delete</button>
      </td>
    </tr>
  `).join('');
}

function openAddHackModal() {
  document.getElementById('hackModalHeader').textContent = 'Add New Tech Hack / Deal';
  document.getElementById('hackEditId').value = '';
  document.getElementById('hackTitle').value = '';
  document.getElementById('hackCategory').value = 'Developer Tools';
  document.getElementById('hackBadge').value = 'EXCLUSIVE';
  document.getElementById('hackCode').value = 'STEVEVIP';
  document.getElementById('hackLink').value = 'https://';
  document.getElementById('hackLogo').value = '';
  document.getElementById('hackImage').value = '';
  document.getElementById('hackDesc').value = '';
  const statusEl = document.getElementById('fetchMetaStatus');
  if (statusEl) statusEl.classList.add('hidden');
  updateHackModalPreview();
  document.getElementById('hackModal')?.classList.remove('hidden');
}

function openEditHackModal(id) {
  const hack = (appData.hacks || []).find(h => h.id === id);
  if (!hack) return;

  document.getElementById('hackModalHeader').textContent = 'Edit Tech Hack / Deal';
  document.getElementById('hackEditId').value = hack.id;
  document.getElementById('hackTitle').value = hack.title || '';
  document.getElementById('hackCategory').value = hack.category || 'Developer Tools';
  document.getElementById('hackBadge').value = hack.badge || 'EXCLUSIVE';
  document.getElementById('hackCode').value = hack.code || 'STEVEVIP';
  document.getElementById('hackLink').value = hack.link || 'https://';
  document.getElementById('hackLogo').value = hack.logo || '';
  document.getElementById('hackImage').value = hack.image || '';
  document.getElementById('hackDesc').value = hack.desc || '';
  const statusEl = document.getElementById('fetchMetaStatus');
  if (statusEl) statusEl.classList.add('hidden');
  updateHackModalPreview();
  document.getElementById('hackModal')?.classList.remove('hidden');
}

function closeHackModal() {
  document.getElementById('hackModal')?.classList.add('hidden');
}

function updateHackModalPreview() {
  const title = document.getElementById('hackTitle')?.value || 'Deal Title Preview';
  const desc = document.getElementById('hackDesc')?.value || 'Company description preview...';
  const logo = document.getElementById('hackLogo')?.value;
  const image = document.getElementById('hackImage')?.value;
  const badge = document.getElementById('hackBadge')?.value || 'EXCLUSIVE';
  const link = document.getElementById('hackLink')?.value;

  const titleEl = document.getElementById('hackTitlePreview');
  const descEl = document.getElementById('hackDescPreview');
  const logoEl = document.getElementById('hackLogoPreview');
  const imageBox = document.getElementById('hackImagePreviewBox');
  const imageEl = document.getElementById('hackImagePreview');
  const badgeEl = document.getElementById('hackBadgePreview');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = desc;
  if (badgeEl) badgeEl.textContent = badge;

  let logoSrc = logo;
  if (!logoSrc && link && link.length > 8) {
    try {
      const hostname = new URL(link.startsWith('http') ? link : 'https://' + link).hostname;
      logoSrc = `https://www.google.com/s2/favicons?domain=${hostname}&sz=128`;
    } catch(e) {}
  }
  if (logoEl) logoEl.src = logoSrc || 'https://www.google.com/s2/favicons?domain=github.com&sz=128';

  if (image && imageBox && imageEl) {
    imageEl.src = image;
    imageBox.classList.remove('hidden');
  } else if (imageBox) {
    imageBox.classList.add('hidden');
  }
}

async function fetchHackMetaFromUrl() {
  const linkInput = document.getElementById('hackLink');
  const statusEl = document.getElementById('fetchMetaStatus');
  const btn = document.getElementById('fetchHackMetaBtn');
  const rawUrl = (linkInput?.value || '').trim();

  if (!rawUrl || rawUrl === 'https://') {
    alert('Please enter a target deal URL link first.');
    return;
  }

  if (btn) btn.disabled = true;
  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.textContent = 'Fetching company info, logo & picture... ⏳';
  }

  try {
    const res = await fetch('/api/hacks/fetch-meta', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: rawUrl })
    });
    const data = await res.json();

    if (data.success) {
      if (data.title && document.getElementById('hackTitle')) {
        document.getElementById('hackTitle').value = data.title;
      }
      if (data.desc && document.getElementById('hackDesc')) {
        document.getElementById('hackDesc').value = data.desc;
      }
      if (data.logoUrl && document.getElementById('hackLogo')) {
        document.getElementById('hackLogo').value = data.logoUrl;
      }
      if (data.imageUrl && document.getElementById('hackImage')) {
        document.getElementById('hackImage').value = data.imageUrl;
      }
      if (data.link && document.getElementById('hackLink')) {
        document.getElementById('hackLink').value = data.link;
      }

      updateHackModalPreview();
      if (statusEl) statusEl.textContent = `Successfully fetched meta & logo for ${data.domain || 'company'}! 🟢`;
    } else {
      if (statusEl) statusEl.textContent = 'Could not fetch metadata automatically. You can fill in logo & details manually.';
    }
  } catch (err) {
    if (statusEl) statusEl.textContent = 'Error connecting to URL meta fetcher.';
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function handleSaveHack(e) {
  e.preventDefault();
  const id = document.getElementById('hackEditId').value;
  const newHack = {
    id: id || ('hack_' + Date.now()),
    title: document.getElementById('hackTitle').value,
    category: document.getElementById('hackCategory').value,
    badge: document.getElementById('hackBadge').value,
    code: document.getElementById('hackCode').value,
    link: document.getElementById('hackLink').value,
    logo: document.getElementById('hackLogo').value,
    image: document.getElementById('hackImage').value,
    desc: document.getElementById('hackDesc').value,
    clicks: 0
  };

  appData.hacks = appData.hacks || [];
  if (id) {
    appData.hacks = appData.hacks.map(h => h.id === id ? { ...h, ...newHack } : h);
  } else {
    appData.hacks.unshift(newHack);
  }

  renderAll();
  closeHackModal();
  await saveAppDataToServer();
  alert('Hack deal saved successfully!');
}

async function deleteHack(id) {
  if (!confirm('Are you sure you want to delete this hack deal?')) return;
  appData.hacks = (appData.hacks || []).filter(h => h.id !== id);
  renderAll();
  await saveAppDataToServer();
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// 92+ SEARCH ENGINES, HIGH-CLASS NEWSPAPERS & COMMUNITY BOARDS SUBMISSION MATRIX
// --------------------------------------------------------------------------
const SUBMISSION_OUTLETS = [
  // ── SEARCH ENGINES & WEB CRAWLERS (25) ───────────────────────────────────
  { id: 'se_google', name: 'Google Search Console', cat: 'search_engines', tier: 'Global #1', domain: 'google.com', desc: 'Direct URL inspection, sitemap indexing, and search ranking.', url: 'https://search.google.com/search-console', pingable: true, pingEndpoint: 'google' },
  { id: 'se_bing', name: 'Bing Webmaster Tools', cat: 'search_engines', tier: 'Global #2', domain: 'bing.com', desc: 'Fast indexing protocol powering Bing, Yahoo & DuckDuckGo.', url: 'https://www.bing.com/webmasters', pingable: true, pingEndpoint: 'bing' },
  { id: 'se_indexnow', name: 'IndexNow Protocol', cat: 'search_engines', tier: 'Instant API', domain: 'indexnow.org', desc: 'Instant multi-engine crawler notification protocol for fast rank updates.', url: 'https://www.indexnow.org/', pingable: true, pingEndpoint: 'indexnow' },
  { id: 'se_yandex', name: 'Yandex Webmaster', cat: 'search_engines', tier: 'Europe & Central', domain: 'yandex.com', desc: 'Primary search engine for Europe and international indexing.', url: 'https://webmaster.yandex.com/', pingable: true, pingEndpoint: 'yandex' },
  { id: 'se_brave', name: 'Brave Search Index', cat: 'search_engines', tier: 'Privacy Tier 1', domain: 'search.brave.com', desc: 'Independent search engine index with privacy-first crawling.', url: 'https://search.brave.com/', pingable: true, pingEndpoint: 'brave' },
  { id: 'se_duckduckgo', name: 'DuckDuckGo Engine', cat: 'search_engines', tier: 'Privacy Global', domain: 'duckduckgo.com', desc: 'Privacy search powered by IndexNow and Bing syndication.', url: 'https://duckduckgo.com/', pingable: true, pingEndpoint: 'indexnow' },
  { id: 'se_yahoo', name: 'Yahoo! Search Index', cat: 'search_engines', tier: 'Global Tier 1', domain: 'search.yahoo.com', desc: 'Global search and media portal indexed via Bing syndication.', url: 'https://search.yahoo.com/', pingable: false },
  { id: 'se_baidu', name: 'Baidu Webmaster Tools', cat: 'search_engines', tier: 'Asia #1', domain: 'ziyuan.baidu.com', desc: 'Dominant search engine in Asia for global casting exposure.', url: 'https://ziyuan.baidu.com/', pingable: false },
  { id: 'se_naver', name: 'Naver Search Advisor', cat: 'search_engines', tier: 'East Asia', domain: 'searchadvisor.naver.com', desc: 'South Korea premier portal and search engine advisor.', url: 'https://searchadvisor.naver.com/', pingable: false },
  { id: 'se_seznam', name: 'Seznam.cz Webmaster', cat: 'search_engines', tier: 'Central Europe', domain: 'seznam.cz', desc: 'Major European independent search index and news portal.', url: 'https://search.seznam.cz/', pingable: true, pingEndpoint: 'seznam' },
  { id: 'se_qwant', name: 'Qwant Search (Europe)', cat: 'search_engines', tier: 'EU Privacy', domain: 'qwant.com', desc: 'European privacy search engine based in Paris.', url: 'https://www.qwant.com/', pingable: false },
  { id: 'se_ecosia', name: 'Ecosia Search', cat: 'search_engines', tier: 'Eco Global', domain: 'ecosia.org', desc: 'Green search engine with 20M+ active daily users.', url: 'https://www.ecosia.org/', pingable: false },
  { id: 'se_mojeek', name: 'Mojeek UK Independent', cat: 'search_engines', tier: 'UK Native', domain: 'mojeek.com', desc: 'UK-based independent crawler with 6B+ page index.', url: 'https://www.mojeek.com/', pingable: false },
  { id: 'se_startpage', name: 'Startpage Privacy', cat: 'search_engines', tier: 'Privacy Tier 1', domain: 'startpage.com', desc: 'Dutch privacy search engine serving worldwide results.', url: 'https://www.startpage.com/', pingable: false },
  { id: 'se_petal', name: 'Petal Search Global', cat: 'search_engines', tier: 'Mobile Global', domain: 'petalsearch.com', desc: 'Mobile search engine with 100M+ international users.', url: 'https://petalsearch.com/', pingable: false },
  { id: 'se_sogou', name: 'Sogou Search Portal', cat: 'search_engines', tier: 'APAC Major', domain: 'zhanzhang.sogou.com', desc: 'Major Asian search portal for cross-border talent discovery.', url: 'https://zhanzhang.sogou.com/', pingable: false },
  { id: 'se_you', name: 'You.com AI Search', cat: 'search_engines', tier: 'AI Search', domain: 'you.com', desc: 'AI-powered multimodal conversational search engine.', url: 'https://you.com/', pingable: false },
  { id: 'se_perplexity', name: 'Perplexity AI Search', cat: 'search_engines', tier: 'AI Knowledge', domain: 'perplexity.ai', desc: 'Leading conversational AI knowledge search engine.', url: 'https://www.perplexity.ai/', pingable: false },
  { id: 'se_andi', name: 'Andi AI Search', cat: 'search_engines', tier: 'Generative AI', domain: 'andisearch.com', desc: 'Next-generation AI visual search and summary assistant.', url: 'https://andisearch.com/', pingable: false },
  { id: 'se_wayback', name: 'Internet Archive Wayback', cat: 'search_engines', tier: 'Permanent Archive', domain: 'archive.org', desc: 'Permanent preservation and indexing of Steve’s portfolio.', url: 'https://web.archive.org/save/', pingable: true, pingEndpoint: 'archive' },
  { id: 'se_feedburner', name: 'FeedBurner Syndicate', cat: 'search_engines', tier: 'Google RSS', domain: 'feedburner.google.com', desc: 'Google RSS media feed distribution and news aggregation.', url: 'https://feedburner.google.com/', pingable: false },
  { id: 'se_entireweb', name: 'Entireweb Free Submission', cat: 'search_engines', tier: 'Free Pinger', domain: 'entireweb.com', desc: 'Quick multi-engine automated submission directory.', url: 'https://www.entireweb.com/free_submission/', pingable: false },
  { id: 'se_exactseek', name: 'ExactSeek Directory', cat: 'search_engines', tier: 'Web Index', domain: 'exactseek.com', desc: 'Fast-crawl directory with syndication to multiple niche portals.', url: 'https://www.exactseek.com/', pingable: false },
  { id: 'se_gigablast', name: 'Gigablast Open Engine', cat: 'search_engines', tier: 'Open Source', domain: 'gigablast.com', desc: 'Independent web indexer with open API discovery.', url: 'https://www.gigablast.com/', pingable: false },
  { id: 'se_similarweb', name: 'SimilarWeb Domain Profile', cat: 'search_engines', tier: 'Analytics Rank', domain: 'similarweb.com', desc: 'Global digital authority and web intelligence indexing.', url: 'https://www.similarweb.com/', pingable: false },

  // ── HIGH-CLASS NEWSPAPERS, TRADE PRESS & MEDIA WIRES (35) ─────────────────
  { id: 'np_thestage', name: 'The Stage UK', cat: 'newspapers', tier: 'UK Theatre #1', domain: 'thestage.co.uk', desc: 'Premier UK performing arts newspaper since 1880 for actors, casting & theatre.', url: 'https://www.thestage.co.uk/contact-us', pingable: false },
  { id: 'np_broadcast', name: 'Broadcast Magazine UK', cat: 'newspapers', tier: 'UK TV & Film #1', domain: 'broadcastnow.co.uk', desc: 'The authoritative weekly magazine for the UK television and broadcasting industry.', url: 'https://www.broadcastnow.co.uk/', pingable: false },
  { id: 'np_variety', name: 'Variety Magazine', cat: 'newspapers', tier: 'Global Trade #1', domain: 'variety.com', desc: 'Leading entertainment industry news source covering film, television, and casting.', url: 'https://variety.com/', pingable: false },
  { id: 'np_hollywoodreporter', name: 'The Hollywood Reporter', cat: 'newspapers', tier: 'Global Film & TV', domain: 'hollywoodreporter.com', desc: 'World-renowned daily industry magazine for Hollywood, UK & global cinema.', url: 'https://www.hollywoodreporter.com/', pingable: false },
  { id: 'np_screendaily', name: 'Screen International (Screen Daily)', cat: 'newspapers', tier: 'UK & Global Cinema', domain: 'screendaily.com', desc: 'Global film industry trade publication and production news network.', url: 'https://www.screendaily.com/', pingable: false },
  { id: 'np_deadline', name: 'Deadline Hollywood', cat: 'newspapers', tier: 'Breaking Entertainment', domain: 'deadline.com', desc: 'Real-time breaking entertainment, casting announcements, and box office scoops.', url: 'https://deadline.com/', pingable: false },
  { id: 'np_britishcomedyguide', name: 'British Comedy Guide (BCG)', cat: 'newspapers', tier: 'UK Comedy & Acting', domain: 'comedy.co.uk', desc: 'Comprehensive UK guide for comedy actors, sit-com credits, and auditions.', url: 'https://www.comedy.co.uk/contact/', pingable: false },
  { id: 'np_backstage', name: 'Backstage Magazine UK', cat: 'newspapers', tier: 'Casting Trade', domain: 'backstage.com', desc: 'The premiere resource for actors, performers, and casting directors worldwide.', url: 'https://www.backstage.com/magazine/', pingable: false },
  { id: 'np_castingnetworks_news', name: 'Casting Networks News', cat: 'newspapers', tier: 'Industry Insider', domain: 'castingnetworks.com', desc: 'Acting career advice, casting director interviews, and industry trends.', url: 'https://www.castingnetworks.com/news/', pingable: false },
  { id: 'np_filmnews', name: 'Film News UK', cat: 'newspapers', tier: 'UK Film Press', domain: 'film-news.co.uk', desc: 'British and European cinema news, reviews, interviews, and festival coverage.', url: 'https://www.film-news.co.uk/', pingable: false },
  { id: 'np_bbcnews', name: 'BBC News & Media Centre', cat: 'newspapers', tier: 'UK National Broadcaster', domain: 'bbc.co.uk', desc: 'Official media centre and culture desk for British Broadcasting Corporation.', url: 'https://www.bbc.co.uk/mediacentre/', pingable: false },
  { id: 'np_guardian', name: 'The Guardian Culture & Film', cat: 'newspapers', tier: 'High-Class Broadsheet', domain: 'theguardian.com', desc: 'World-renowned British daily broadsheet with extensive arts and culture reporting.', url: 'https://www.theguardian.com/culture', pingable: false },
  { id: 'np_thetimes', name: 'The Times Culture & Arts', cat: 'newspapers', tier: 'Premier UK Daily', domain: 'thetimes.co.uk', desc: 'The premier national newspaper of the United Kingdom with elite arts journalism.', url: 'https://www.thetimes.co.uk/culture', pingable: false },
  { id: 'np_telegraph', name: 'The Daily Telegraph Arts & Film', cat: 'newspapers', tier: 'UK Broadsheet Press', domain: 'telegraph.co.uk', desc: 'National British broadsheet newspaper renowned for cultural features and film reviews.', url: 'https://www.telegraph.co.uk/culture/', pingable: false },
  { id: 'np_independent', name: 'The Independent Culture', cat: 'newspapers', tier: 'Digital Broadsheet', domain: 'independent.co.uk', desc: 'Major UK news outlet covering arts, drama, film, and entertainment.', url: 'https://www.independent.co.uk/arts-entertainment', pingable: false },
  { id: 'np_standard', name: 'London Evening Standard', cat: 'newspapers', tier: 'Capital Newspaper', domain: 'standard.co.uk', desc: 'London’s flagship newspaper for West End theatre, films, and capital talent.', url: 'https://www.standard.co.uk/culture', pingable: false },
  { id: 'np_leicestermercury', name: 'Leicester Mercury (Leicestershire Live)', cat: 'newspapers', tier: 'Steve’s Hometown Paper', domain: 'leicestermercury.co.uk', desc: 'Primary daily news publisher for Leicestershire and the Midlands arts scene.', url: 'https://www.leicestermercury.co.uk/', pingable: false },
  { id: 'np_manchesterevening', name: 'Manchester Evening News (MEN)', cat: 'newspapers', tier: 'Major UK Regional', domain: 'manchestereveningnews.co.uk', desc: 'One of the UK’s most read regional publications covering North West & UK arts.', url: 'https://www.manchestereveningnews.co.uk/', pingable: false },
  { id: 'np_birminghammail', name: 'Birmingham Mail / Live', cat: 'newspapers', tier: 'Midlands Press', domain: 'birminghammail.co.uk', desc: 'Leading news source for the West Midlands and Central England entertainment.', url: 'https://www.birminghammail.co.uk/', pingable: false },
  { id: 'np_financialtimes', name: 'Financial Times (Tech & Careers)', cat: 'newspapers', tier: 'Global Business', domain: 'ft.com', desc: 'World’s leading financial newspaper covering Enterprise IT, Cloud, and leadership.', url: 'https://www.ft.com/', pingable: false },
  { id: 'np_wired', name: 'Wired UK & Global', cat: 'newspapers', tier: 'Tech & Culture', domain: 'wired.com', desc: 'Authoritative magazine on technology innovation, media, and digital culture.', url: 'https://www.wired.com/', pingable: false },
  { id: 'np_techcrunch', name: 'TechCrunch UK & Europe', cat: 'newspapers', tier: 'Tech Leader', domain: 'techcrunch.com', desc: 'Leading technology news platform for enterprise architecture and AI innovation.', url: 'https://techcrunch.com/', pingable: false },
  { id: 'np_forbes', name: 'Forbes UK & Europe', cat: 'newspapers', tier: 'Global Leadership', domain: 'forbes.com', desc: 'Global media company focusing on business, leadership, and technology innovators.', url: 'https://www.forbes.com/', pingable: false },
  { id: 'np_dailymail', name: 'Daily Mail Showcase & TV', cat: 'newspapers', tier: 'High-Traffic Daily', domain: 'dailymail.co.uk', desc: 'One of the most visited English-language news sites with massive showbiz reach.', url: 'https://www.dailymail.co.uk/tvshowbiz/index.html', pingable: false },
  { id: 'np_prnewswire', name: 'PR Newswire Global', cat: 'newspapers', tier: 'Press Wire #1', domain: 'prnewswire.com', desc: 'Global leader in commercial press release distribution to 4,000+ newsrooms.', url: 'https://www.prnewswire.com/', pingable: false },
  { id: 'np_businesswire', name: 'Business Wire', cat: 'newspapers', tier: 'Berkshire Hathaway Wire', domain: 'businesswire.com', desc: 'Worldwide press release network reaching news organizations in 160+ countries.', url: 'https://www.businesswire.com/', pingable: false },
  { id: 'np_responsesource', name: 'ResponseSource UK Press Network', cat: 'newspapers', tier: 'UK Journalist Hub', domain: 'responsesource.com', desc: 'Direct journalist inquiry service connecting talent with 30,000+ UK reporters.', url: 'https://www.responsesource.com/', pingable: false },
  { id: 'np_pamedia', name: 'PA Media (Press Association UK)', cat: 'newspapers', tier: 'UK National Wire', domain: 'pa.media', desc: 'The national news agency for the UK and Ireland feeding all national papers.', url: 'https://pa.media/', pingable: false },
  { id: 'np_einpresswire', name: 'EIN Presswire', cat: 'newspapers', tier: 'Entertainment Wire', domain: 'einpresswire.com', desc: 'Global press distribution platform indexing on Google News, Bloomberg & AP.', url: 'https://www.einpresswire.com/', pingable: false },
  { id: 'np_247press', name: '24-7 Press Release Newswire', cat: 'newspapers', tier: 'Digital Syndication', domain: '24-7pressrelease.com', desc: 'Disseminates news to digital news portals, RSS feeds, and journalists.', url: 'https://www.24-7pressrelease.com/', pingable: false },
  { id: 'np_newsfile', name: 'Newsfile Corp Wire', cat: 'newspapers', tier: 'Compliant Wire', domain: 'newsfilecorp.com', desc: 'News wire distribution service targeting financial and media networks.', url: 'https://www.newsfilecorp.com/', pingable: false },
  { id: 'np_openpr', name: 'OpenPR Global Portal', cat: 'newspapers', tier: 'Free PR Portal', domain: 'openpr.com', desc: 'Open PR platform distributing releases to international search engines.', url: 'https://www.openpr.com/', pingable: false },
  { id: 'np_medium', name: 'Medium Official Publications', cat: 'newspapers', tier: 'Thought Leadership', domain: 'medium.com', desc: 'Global publishing platform with high search domain authority for articles.', url: 'https://medium.com/', pingable: false },
  { id: 'np_substack', name: 'Substack Network', cat: 'newspapers', tier: 'Direct Journalism', domain: 'substack.com', desc: 'Direct publishing platform for newsletter syndication and recovery writing.', url: 'https://substack.com/', pingable: false },
  { id: 'np_linkedin_pulse', name: 'LinkedIn Pulse Press', cat: 'newspapers', tier: 'B2B & Executive', domain: 'linkedin.com', desc: 'Professional content syndication reaching 1 Billion+ global business leaders.', url: 'https://www.linkedin.com/pulse/', pingable: false },

  // ── HIGH-PLACED INDUSTRY BOARDS, FILM HUBS & DIRECTORIES (32) ─────────────
  { id: 'cb_spotlight', name: 'Spotlight UK Directory', cat: 'community_boards', tier: 'Actor Directory #1', domain: 'spotlight.com', desc: 'Steve’s official verified Spotlight profile (PIN: 9339-8945-6183) for UK casting.', url: 'https://app.spotlight.com/9339-8945-6183', pingable: false },
  { id: 'cb_imdbpro', name: 'IMDbPro Casting Directory', cat: 'community_boards', tier: 'Global Film DB', domain: 'pro.imdb.com', desc: 'Global industry standard database for screen credits, agent reps, and filmography.', url: 'https://pro.imdb.com/', pingable: false },
  { id: 'cb_mandy', name: 'Mandy.com Actors & Crew', cat: 'community_boards', tier: 'Actor Community', domain: 'mandy.com', desc: 'UK and international casting, auditions, and filmmaker collaboration board.', url: 'https://www.mandy.com/', pingable: false },
  { id: 'cb_starnow', name: 'StarNow UK Casting', cat: 'community_boards', tier: 'Talent Network', domain: 'starnow.com', desc: 'Major UK talent discovery network for commercial, film, and TV casting.', url: 'https://www.starnow.com/', pingable: false },
  { id: 'cb_equity', name: 'Equity UK Union Directory', cat: 'community_boards', tier: 'British Actors Union', domain: 'equity.org.uk', desc: 'The official trade union representing 47,000+ UK performers and creative workers.', url: 'https://www.equity.org.uk/', pingable: false },
  { id: 'cb_bafta', name: 'BAFTA Members & Directory', cat: 'community_boards', tier: 'British Academy', domain: 'bafta.org', desc: 'British Academy of Film and Television Arts talent network and events.', url: 'https://www.bafta.org/', pingable: false },
  { id: 'cb_filmlondon', name: 'Film London Directory', cat: 'community_boards', tier: 'London Film Office', domain: 'filmlondon.org.uk', desc: 'Strategic agency for London film, TV, animation, and creative crews.', url: 'https://filmlondon.org.uk/', pingable: false },
  { id: 'cb_bfi', name: 'British Film Institute (BFI)', cat: 'community_boards', tier: 'UK Film Heritage', domain: 'bfi.org.uk', desc: 'The lead organization for film in the UK supporting British talent and cinema.', url: 'https://www.bfi.org.uk/', pingable: false },
  { id: 'cb_reddit_acting', name: 'Reddit r/acting Community', cat: 'community_boards', tier: 'Actor Forum (250k+)', domain: 'reddit.com/r/acting', desc: 'Largest international peer community for professional actors and casting advice.', url: 'https://www.reddit.com/r/acting/', pingable: false },
  { id: 'cb_reddit_filmmakers', name: 'Reddit r/Filmmakers', cat: 'community_boards', tier: 'Filmmaker Hub (3M+)', domain: 'reddit.com/r/Filmmakers', desc: 'Major community for directors, cinematographers, stunt performers & crew.', url: 'https://www.reddit.com/r/Filmmakers/', pingable: false },
  { id: 'cb_reddit_london', name: 'Reddit r/london Community', cat: 'community_boards', tier: 'Capital Hub (1M+)', domain: 'reddit.com/r/london', desc: 'Active London community for creative networking and arts events.', url: 'https://www.reddit.com/r/london/', pingable: false },
  { id: 'cb_reddit_leicester', name: 'Reddit r/leicester Board', cat: 'community_boards', tier: 'Hometown Board', domain: 'reddit.com/r/leicester', desc: 'Leicester regional community board for Midlands arts, theatre, and culture.', url: 'https://www.reddit.com/r/leicester/', pingable: false },
  { id: 'cb_stage32', name: 'Stage 32 Industry Network', cat: 'community_boards', tier: 'Global Network (1M+)', domain: 'stage32.com', desc: 'The largest online network connecting entertainment industry professionals.', url: 'https://www.stage32.com/', pingable: false },
  { id: 'cb_productionbase', name: 'ProductionBase UK', cat: 'community_boards', tier: 'UK Crew & Talent', domain: 'productionbase.co.uk', desc: 'The UK’s premier network for TV, film, and commercial production talent.', url: 'https://www.productionbase.co.uk/', pingable: false },
  { id: 'cb_shootingpeople', name: 'Shooting People Film Hub', cat: 'community_boards', tier: 'Indie Cinema Hub', domain: 'shootingpeople.org', desc: 'Legendary independent filmmakers network connecting 45,000+ creatives.', url: 'https://shootingpeople.org/', pingable: false },
  { id: 'cb_thedots', name: 'The Dots Creative Community', cat: 'community_boards', tier: 'Creative Professional', domain: 'the-dots.com', desc: 'The professional network for the creative sector, branding, and entertainment.', url: 'https://the-dots.com/', pingable: false },
  { id: 'cb_castingworkbook', name: 'Casting Workbook Network', cat: 'community_boards', tier: 'International Casting', domain: 'castingworkbook.com', desc: 'Global actor submission software used by major international casting directors.', url: 'https://www.castingworkbook.com/', pingable: false },
  { id: 'cb_pggb', name: 'Production Guild of Great Britain', cat: 'community_boards', tier: 'Film Guild UK', domain: 'productionguild.com', desc: 'The UK’s leading membership organization for film and TV production management.', url: 'https://productionguild.com/', pingable: false },
  { id: 'cb_cdg', name: 'Casting Directors’ Guild (CDG)', cat: 'community_boards', tier: 'Casting Guild', domain: 'thecdg.co.uk', desc: 'Professional association of casting directors in the UK and Ireland.', url: 'https://www.thecdg.co.uk/', pingable: false },
  { id: 'cb_creativeengland', name: 'Creative England Film Office', cat: 'community_boards', tier: 'National Film Office', domain: 'creativeengland.co.uk', desc: 'Dedicated to growing the creative industries and supporting regional filming.', url: 'https://www.creativeengland.co.uk/', pingable: false },
  { id: 'cb_londonfilmnetwork', name: 'London Film Network', cat: 'community_boards', tier: 'Capital Indie Network', domain: 'londonfilmnetwork.co.uk', desc: 'Community directory for filmmakers, actors, and production companies in London.', url: 'https://www.londonfilmnetwork.co.uk/', pingable: false },
  { id: 'cb_googlebusiness', name: 'Google Business Profile', cat: 'community_boards', tier: 'Google Verified Entity', domain: 'business.google.com', desc: 'Official Knowledge Panel and local presence indexing on Google Maps and Search.', url: 'https://business.google.com/', pingable: false },
  { id: 'cb_applebusiness', name: 'Apple Business Connect', cat: 'community_boards', tier: 'Apple Ecosystem', domain: 'businessconnect.apple.com', desc: 'Verified presence on Apple Maps, Siri, Spotlight search, and Safari.', url: 'https://businessconnect.apple.com/', pingable: false },
  { id: 'cb_bingplaces', name: 'Bing Places for Business', cat: 'community_boards', tier: 'Microsoft Ecosystem', domain: 'bingplaces.com', desc: 'Official listing on Bing Maps and Windows desktop Cortana search.', url: 'https://www.bingplaces.com/', pingable: false },
  { id: 'cb_trustpilot', name: 'Trustpilot Directory', cat: 'community_boards', tier: 'Verified Reviews', domain: 'trustpilot.com', desc: 'Global consumer review and reputation management community.', url: 'https://www.trustpilot.com/', pingable: false },
  { id: 'cb_producthunt', name: 'Product Hunt Community', cat: 'community_boards', tier: 'Tech Launch #1', domain: 'producthunt.com', desc: 'Major tech community for discovering new platforms, tools, and digital ventures.', url: 'https://www.producthunt.com/', pingable: false },
  { id: 'cb_crunchbase', name: 'Crunchbase Enterprise Profile', cat: 'community_boards', tier: 'B2B & Venture', domain: 'crunchbase.com', desc: 'Leading directory of business leaders, founders, and enterprise architects.', url: 'https://www.crunchbase.com/', pingable: false },
  { id: 'cb_yell', name: 'Yell.com UK Business Directory', cat: 'community_boards', tier: 'UK Yellow Pages', domain: 'yell.com', desc: 'The UK’s leading online business and professional directory.', url: 'https://www.yell.com/', pingable: false },
  { id: 'cb_scoot', name: 'Scoot UK National Directory', cat: 'community_boards', tier: 'UK Directory', domain: 'scoot.co.uk', desc: 'Comprehensive UK commercial and professional business network.', url: 'https://www.scoot.co.uk/', pingable: false },
  { id: 'cb_freeindex', name: 'FreeIndex UK Rated Directory', cat: 'community_boards', tier: 'UK Rated Network', domain: 'freeindex.co.uk', desc: 'UK business directory with customer ratings and direct search visibility.', url: 'https://www.freeindex.co.uk/', pingable: false },
  { id: 'cb_aa_uk', name: 'Alcoholics Anonymous UK Community', cat: 'community_boards', tier: 'Recovery Network', domain: 'alcoholics-anonymous.org.uk', desc: 'National fellowship directory and support hub for recovery outreach (KMST).', url: 'https://www.alcoholics-anonymous.org.uk/', pingable: false },
  { id: 'cb_ukat', name: 'UK Addiction Treatment (UKAT) Hub', cat: 'community_boards', tier: 'Sobriety Portal', domain: 'ukat.co.uk', desc: 'Leading addiction recovery network and directory for KEEP ME SOBER TOO.', url: 'https://www.ukat.co.uk/', pingable: false }
];

let activeSubmissionFilter = 'all';
let activeSubmissionQuery = '';

function renderSubmissionDirectory() {
  const container = document.getElementById('submissionsGridContainer');
  if (!container) return;

  let filtered = SUBMISSION_OUTLETS;

  if (activeSubmissionFilter !== 'all') {
    filtered = filtered.filter(item => item.cat === activeSubmissionFilter);
  }

  if (activeSubmissionQuery.trim()) {
    const q = activeSubmissionQuery.toLowerCase().trim();
    filtered = filtered.filter(item => 
      item.name.toLowerCase().includes(q) || 
      item.domain.toLowerCase().includes(q) || 
      item.desc.toLowerCase().includes(q) || 
      item.tier.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full py-12 text-center text-xs text-slate-400 italic">
        No submission outlets matched "${escapeHtml(activeSubmissionQuery)}".
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(item => {
    let catBadgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    let catIcon = 'globe';
    if (item.cat === 'newspapers') {
      catBadgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      catIcon = 'newspaper';
    } else if (item.cat === 'community_boards') {
      catBadgeColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      catIcon = 'landmark';
    }

    return `
      <div class="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-amber-400/60 transition-all flex flex-col justify-between gap-2.5 text-xs shadow">
        <div class="space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <span class="px-2 py-0.5 rounded-md border text-[10px] font-mono-code font-bold ${catBadgeColor} flex items-center gap-1">
              <i data-lucide="${catIcon}" class="w-3 h-3"></i> ${escapeHtml(item.tier)}
            </span>
            <span class="text-[10px] font-mono-code text-slate-400 font-bold truncate">${escapeHtml(item.domain)}</span>
          </div>

          <h5 class="font-bold text-white text-xs font-cinzel tracking-wide line-clamp-1">${escapeHtml(item.name)}</h5>
          <p class="text-[11px] text-slate-300 line-clamp-2 leading-relaxed">${escapeHtml(item.desc)}</p>
        </div>

        <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
          ${item.pingable ? `
            <span class="text-[10px] font-mono-code text-emerald-400 font-bold flex items-center gap-1">
              <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> Auto-Pinger
            </span>
          ` : `
            <span class="text-[10px] font-mono-code text-slate-400">Direct Submission</span>
          `}
          
          <a href="${item.url}" target="_blank" class="px-3 py-1 rounded-xl bg-slate-950 hover:bg-amber-500 hover:text-slate-950 text-amber-400 border border-slate-700 font-bold text-[11px] flex items-center gap-1 transition shadow">
            <span>Open Portal</span>
            <i data-lucide="external-link" class="w-3 h-3"></i>
          </a>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function filterSubmissions(cat) {
  activeSubmissionFilter = cat;
  document.querySelectorAll('.sub-filter-btn').forEach(btn => {
    btn.className = 'sub-filter-btn px-3.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 hover:text-white border border-slate-800 transition text-xs font-bold';
  });
  const activeBtn = document.getElementById(`subFilter-${cat}`);
  if (activeBtn) {
    activeBtn.className = 'sub-filter-btn px-3.5 py-1.5 rounded-xl bg-amber-500 text-slate-950 font-black shadow transition text-xs';
  }
  renderSubmissionDirectory();
}

function searchSubmissions(val) {
  activeSubmissionQuery = val || '';
  renderSubmissionDirectory();
}

async function pingAllSearchEngines() {
  const btn = document.getElementById('pingAllEnginesBtn');
  const banner = document.getElementById('pingerStatusBanner');
  const statusText = document.getElementById('pingerStatusText');
  const badge = document.getElementById('pingerProgressBadge');

  if (btn) btn.disabled = true;
  if (banner) banner.classList.remove('hidden');
  if (statusText) statusText.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin text-emerald-400"></i> Pinging Google, Bing, Yandex, DuckDuckGo IndexNow, Seznam & Archive.org...`;
  if (badge) {
    badge.textContent = 'Pinging...';
    badge.className = 'px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 font-mono-code text-[11px] font-extrabold';
  }
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/seo/submit-sitemap', { method: 'POST' });
    const json = await res.json();
    if (json.success) {
      if (statusText) statusText.innerHTML = `<i data-lucide="check-circle-2" class="w-4 h-4 text-emerald-400"></i> ${json.message} (${json.timestamp || 'Live'})`;
      if (badge) {
        badge.textContent = 'Success 🟢';
        badge.className = 'px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-mono-code text-[11px] font-extrabold';
      }
      alert(`✅ ${json.message}\n\nAll primary search engines and the Wayback Machine have been notified!`);
    } else {
      if (statusText) statusText.textContent = 'Error sending ping notifications.';
    }
  } catch (err) {
    if (statusText) statusText.textContent = 'Network error contacting submission API.';
  } finally {
    if (btn) btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }
}

function copySitemapUrl() {
  const sitemapUrl = `${window.location.origin}/sitemap.xml`;
  navigator.clipboard.writeText(sitemapUrl).then(() => {
    alert(`📋 Copied Sitemap URL to Clipboard:\n${sitemapUrl}`);
  }).catch(() => {
    prompt('Copy Sitemap URL:', sitemapUrl);
  });
}

function copyPressKitBio() {
  const bioText = `STEVE PEREIRA — OFFICIAL CASTING & PRESS SYNDICATION KIT
======================================================
• Name: Steve Pereira
• Profession: Professional British Indian Actor & 34-Year Senior Enterprise IT Architect
• Spotlight PIN: 9339-8945-6183 (Verify: https://app.spotlight.com/9339-8945-6183)
• Key Attributes: 5'6.5", Bald, Dark Brown Eyes, Phoenix Tattoo, Playing Age 38-53
• Background: Leicester-born actor, Haymarket Theatre alumnus, cardiac arrest survivor, sober since 2013, founder of KEEP ME SOBER TOO (KMST).
• Notable Screen Roles: Snickers Commercial (Lead Double), Ted Lasso (Locker Room Tech), The Central Line (Supervisor), Bloodline (Paramedic Lead).
• Representation:
  - Acting Agent: Top Hat Management (01234 567890 | tophatmanagement.co.uk)
  - Commercial & Model Agent: Face Management (0113 245 8667 | facemanagement.co.uk)
• Portfolio Website: ${window.location.origin}
• Sitemap: ${window.location.origin}/sitemap.xml
• Contact & Bookings: info@stevepereira.pro`;

  navigator.clipboard.writeText(bioText).then(() => {
    alert('📰 Official Press Kit & Actor Bio Pitch copied to clipboard!');
  }).catch(() => {
    prompt('Press Kit Text:', bioText);
  });
}

function exportSubmissionsCSV() {
  const headers = ['ID', 'Outlet Name', 'Category', 'Tier / Authority', 'Domain', 'Submission URL', 'Description', 'Direct Pinger'];
  const rows = SUBMISSION_OUTLETS.map(item => [
    `"${item.id}"`,
    `"${item.name.replace(/"/g, '""')}"`,
    `"${item.cat}"`,
    `"${item.tier.replace(/"/g, '""')}"`,
    `"${item.domain}"`,
    `"${item.url}"`,
    `"${item.desc.replace(/"/g, '""')}"`,
    item.pingable ? '"Yes (Auto-Pinger)"' : '"Manual Submission Portal"'
  ]);

  const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `steve_pereira_92_submission_directory_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ── Live Agent Hero Updater ──────────────────────────────────────────────────
function updateAgentHero() {
  const a1Name  = document.getElementById('editAgent1Name');
  const a1Type  = document.getElementById('editAgent1Type');
  const a1Phone = document.getElementById('editAgent1Phone');
  const a1Link  = document.getElementById('editAgent1Link');
  const a2Name  = document.getElementById('editAgent2Name');
  const a2Type  = document.getElementById('editAgent2Type');
  const a2Phone = document.getElementById('editAgent2Phone');
  const a2Link  = document.getElementById('editAgent2Link');

  if (a1Name  && document.getElementById('heroAgent1Name'))  document.getElementById('heroAgent1Name').textContent  = a1Name.value;
  if (a1Type  && document.getElementById('heroAgent1Type'))  document.getElementById('heroAgent1Type').textContent  = a1Type.value;
  if (a1Phone && document.getElementById('heroAgent1Phone')) document.getElementById('heroAgent1Phone').textContent = a1Phone.value;
  if (a1Link  && document.getElementById('heroAgent1Link'))  document.getElementById('heroAgent1Link').href          = a1Link.value;

  if (a2Name  && document.getElementById('heroAgent2Name'))  document.getElementById('heroAgent2Name').textContent  = a2Name.value;
  if (a2Type  && document.getElementById('heroAgent2Type'))  document.getElementById('heroAgent2Type').textContent  = a2Type.value;
  if (a2Phone && document.getElementById('heroAgent2Phone')) document.getElementById('heroAgent2Phone').textContent = a2Phone.value;
  if (a2Link  && document.getElementById('heroAgent2Link'))  document.getElementById('heroAgent2Link').href          = a2Link.value;
}

window.updateAgentHero = updateAgentHero;
window.renderSubmissionDirectory = renderSubmissionDirectory;
window.filterSubmissions = filterSubmissions;
window.searchSubmissions = searchSubmissions;
window.pingAllSearchEngines = pingAllSearchEngines;
window.copySitemapUrl = copySitemapUrl;
window.copyPressKitBio = copyPressKitBio;
window.exportSubmissionsCSV = exportSubmissionsCSV;
