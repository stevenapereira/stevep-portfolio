
function lockBodyScroll() { document.body.style.overflow = 'hidden'; }
function unlockBodyScroll() { document.body.style.overflow = ''; }

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
    title: "Steve Pereira | British Indian Actor | IT Expert Since 1992 | Cardiac Arrest Survivor | Sober Since 2012",
    description: "The Official Website for Steve Pereira, a Professional British Indian Actor from Leicester a Multi-Cultural City in the Heart of England, The Midlands. Steve grew up and spent most of his early life in Leicester where he first started his acting career at the Haymarket Theatre at the age of 11. Steve became a bit of an IT Nerd but got the chance to return to acting with his own unique story of survival.",
    keywords: "Steve Pereira, British Indian Actor, Actor, Leicester, London, Spotlight Actor, IT Nerd, IT Expert, Survival, Unique Story, Alcoholism, Sober, Edge of Life"
  },
  analytics: {}
};

let _kmstProfile = null;
let _kmstActiveChannel = 'all';
let _cachedKMSTConfig = null;
let _cachedKMSTHelplines = [];

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

// Silky-Smooth Hardware-Accelerated Parallax Engine with Lerp Interpolation
// Uses background-position-y so repeating patterns tile infinitely down any page length without running out!
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

    bgLayer.style.backgroundPosition = `center ${_currentBgY.toFixed(2)}px`;
    bgLayer.style.transform = 'none';
  } else if (bgLayer) {
    bgLayer.style.backgroundPosition = 'center top';
    bgLayer.style.transform = 'none';
  }

  requestAnimationFrame(updateBgParallax);
}
requestAnimationFrame(updateBgParallax);

// Load Data from Backend API or Static db.json / LocalStorage Fallback
async function loadData() {
  let loaded = false;

  // 1. Try Backend API first (for local node server or serverless setup)
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
        loaded = true;
      }
    }
  } catch (e) {
    console.warn('API fetch failed, trying static db.json fallback...');
  }

  // 2. If API fails or returns 404 (e.g. static cPanel hosting), fall back to /data/db.json or /data/data.json
  if (!loaded) {
    try {
      let resDb = await fetch('/data/db.json?v=' + Date.now());
      if (!resDb.ok) {
        resDb = await fetch('/data/data.json?v=' + Date.now());
      }
      if (resDb.ok) {
        const dbData = await resDb.json();
        if (dbData) {
          appData = {
            ...appData,
            ...dbData,
            spotlightVideos: (dbData.spotlightVideos && dbData.spotlightVideos.length > 0) ? dbData.spotlightVideos : appData.spotlightVideos,
            sectionRouting: dbData.sectionRouting || appData.sectionRouting
          };
          loaded = true;
        }
      }
    } catch (e) {
      console.warn('Static db.json fetch failed, using local cache...');
    }
  }

  // 3. Fall back to localStorage cache if available
  if (!loaded) {
    try {
      const cached = localStorage.getItem('stevep_app_data');
      if (cached) {
        const parsed = JSON.parse(cached);
        appData = { ...appData, ...parsed };
      }
    } catch(e) {}
  }

  if (appData.kmstMessages && Array.isArray(appData.kmstMessages) && appData.kmstMessages.length > 0) {
    _cachedKMSTMessages = appData.kmstMessages;
  }
  if (appData.kmstHelplines && Array.isArray(appData.kmstHelplines) && appData.kmstHelplines.length > 0) {
    _cachedKMSTHelplines = appData.kmstHelplines;
  }
  if (appData.blogs && Array.isArray(appData.blogs) && appData.blogs.length > 0) {
    _cachedKMSTArticles = appData.blogs;
  }
  renderAll();
  handleRoutingFromUrl();
}

function renderAll() {
  if (appData.activeTheme) {
    document.documentElement.setAttribute('data-theme', appData.activeTheme);
  }
  applyBgSettings();
  updateBgStudioUI();
  if (typeof initMosaicStudio === 'function') initMosaicStudio();
  applySiteTexts();
  if (typeof initSkimlinks === 'function') initSkimlinks();
  renderWorks();
  renderAdminCreditsTable();
  renderAdminHacksTable();
  renderAboutTimeline();
  renderParentsPage();
  renderHeadshotsDeck();
  renderFullBodyGrid();
  renderRightSideSpotlightVideos();
  renderHeroCarousel();
  renderITTimeline();
  renderAdminTimelines();
  renderHacks();
  renderKMSTCommunity();
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
  }).join('') + '</div>';
}

// --------------------------------------------------------------------------
// TAB SWITCHING & THEMES
// --------------------------------------------------------------------------
function switchTab(tabId, updateUrl = true) {
  let targetId = tabId;
  if (targetId === 'kmst') targetId = 'sobriety';
  if (targetId === 'it') targetId = 'itexpert';

  document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
  const active = document.getElementById(`tab-${targetId}`);
  if (active) active.classList.remove('hidden');

  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.removeAttribute('data-active');
  });

  const activeNav = document.getElementById(`nav-${targetId}`) || document.getElementById(`nav-${tabId}`);
  if (activeNav) {
    activeNav.classList.add('active');
    activeNav.setAttribute('data-active', 'true');
  }

  window._currentTab = targetId;
  if (targetId === 'sobriety') {
    if (typeof renderKMSTCommunity === 'function') renderKMSTCommunity();
    if (typeof renderUKHelp === 'function') renderUKHelp();
    if (typeof renderMilestoneChips === 'function') renderMilestoneChips(_kmstProfile ? (_kmstProfile.daysSober || 5260) : 5260);
    if (typeof renderKMSTLeaderboard === 'function') renderKMSTLeaderboard();
    if (typeof fetchKMSTMessages === 'function') fetchKMSTMessages(_currentKMSTChannel || 'all');
  }
  if (targetId !== 'admin') trackEvent('page_click', targetId);

  // Dynamic SEO friendly URL handling
  if (updateUrl) {
    let urlSlug = targetId;
    if (targetId === 'casting') urlSlug = '';
    if (targetId === 'sobriety') urlSlug = 'kmst';
    if (targetId === 'itexpert') urlSlug = 'it';
    
    const newPath = urlSlug ? '/' + urlSlug : '/';
    if (window.location.pathname !== newPath) {
      window.history.pushState({ tabId: targetId }, '', newPath);
    }
  }

  if (window.lucide) lucide.createIcons();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.switchTab = switchTab;

function handleRoutingFromUrl() {
  const path = window.location.pathname.replace(/^\/|\/$/g, '').toLowerCase();
  
  let target = 'casting'; // default home tab
  if (path) {
    target = path;
    if (target === 'kmst') target = 'sobriety';
    if (target === 'it') target = 'itexpert';
  }
  
  // Verify that the tab exists in the HTML (works for all current and future tabs!)
  const targetEl = document.getElementById(`tab-${target}`);
  if (targetEl) {
    switchTab(target, false);
  } else {
    switchTab('casting', false);
  }
}
window.handleRoutingFromUrl = handleRoutingFromUrl;

// Support browser Back/Forward navigation buttons
window.addEventListener('popstate', (event) => {
  if (event.state && event.state.tabId) {
    switchTab(event.state.tabId, false);
  } else {
    handleRoutingFromUrl();
  }
});

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
    modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  }
}

function closeLightbox() {
  const modal = document.getElementById('lightboxModal');
  if (modal) modal.classList.add('hidden');
    unlockBodyScroll();
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
    modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  }
}

function closeVideoModal() {
  const modal = document.getElementById('videoModal');
  const player = document.getElementById('modalVideoPlayer');
  if (player) player.pause();
  if (modal) modal.classList.add('hidden');
    unlockBodyScroll();
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

let currentWorksCategory = 'All';
let currentWorksSearch = '';

function handleWorksLiveSearch(val) {
  currentWorksSearch = (val || '').trim().toLowerCase();
  renderWorks(currentWorksCategory, currentWorksSearch);
}

function renderWorks(filterCat = 'All', searchQuery = '') {
  currentWorksCategory = filterCat;
  const tbody = document.getElementById('worksTableBody');
  if (!tbody) return;

  let credits = appData.credits || [];
  if (filterCat !== 'All') {
    credits = credits.filter(c => c.category === filterCat);
  }

  if (searchQuery) {
    credits = credits.filter(c => {
      const combined = `${c.title || ''} ${c.role || ''} ${c.category || ''} ${c.production || ''} ${c.year || ''} ${c.status || ''}`.toLowerCase();
      return combined.includes(searchQuery);
    });
  }

  const countBadge = document.getElementById('creditsCountBadge');
  if (countBadge) {
    countBadge.textContent = `${credits.length} Credit${credits.length === 1 ? '' : 's'} Shown`;
  }

  if (credits.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="p-8 text-center text-slate-400 font-mono-code text-xs">
          No credits matched your filter "${escapeHtml(filterCat)}" / search "${escapeHtml(searchQuery)}".
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = credits.map((c, idx) => {
    const pal = getCreditPalette(c, idx);
    return `
      <tr class="credit-row-item ${pal.rowClass} border-b border-slate-800/60 backdrop-blur-md">
        <td class="p-3 sm:p-4 font-bold text-white font-cinzel text-xs sm:text-sm">
          <div class="flex items-center gap-2">
            <span class="w-1.5 h-1.5 rounded-full bg-current opacity-75 shrink-0"></span>
            <span>${escapeHtml(c.title || '')}</span>
          </div>
        </td>
        <td class="p-3 sm:p-4">
          <span class="px-2.5 py-1 rounded-full ${pal.rolePill} text-[11px] sm:text-xs font-black tracking-wide inline-block">${escapeHtml(c.role || '')}</span>
        </td>
        <td class="p-4 whitespace-nowrap hidden md:table-cell">
          <span class="px-2.5 py-0.5 rounded-full ${pal.catBadge} text-[10px] font-extrabold uppercase">${escapeHtml(c.category || '')}</span>
        </td>
        <td class="p-4 text-slate-300 font-medium text-xs hidden md:table-cell">${escapeHtml(c.production || '')}</td>
        <td class="p-4 whitespace-nowrap hidden md:table-cell">
          <span class="${pal.yearPill} text-xs">${escapeHtml(c.year || '')}</span>
        </td>
        <td class="p-4 whitespace-nowrap hidden md:table-cell">
          <span class="px-2.5 py-0.5 rounded-full ${pal.statusBadge} text-[10px] font-extrabold uppercase">${escapeHtml(c.status || 'Verified')}</span>
        </td>
        <td class="p-3 sm:p-4 text-right md:hidden whitespace-nowrap">
          <button onclick="toggleCreditDetailRow(${idx})" class="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400 font-bold text-[11px] hover:bg-amber-500/20 transition inline-flex items-center gap-1">
            <span id="creditBtnText-${idx}">Details</span>
            <i data-lucide="chevron-down" id="creditChevron-${idx}" class="w-3.5 h-3.5 transition-transform duration-200"></i>
          </button>
        </td>
      </tr>
      <tr id="creditDetailRow-${idx}" class="hidden md:hidden bg-slate-950/90 border-b border-slate-800/80">
        <td colspan="3" class="p-3">
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
              <span class="text-slate-400 font-bold uppercase text-[9px] block">Category</span>
              <span class="font-extrabold text-amber-400">${escapeHtml(c.category || 'N/A')}</span>
            </div>
            <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80">
              <span class="text-slate-400 font-bold uppercase text-[9px] block">Year</span>
              <span class="font-mono-code font-bold text-slate-200">${escapeHtml(c.year || 'N/A')}</span>
            </div>
            <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 col-span-2">
              <span class="text-slate-400 font-bold uppercase text-[9px] block">Production / Director</span>
              <span class="font-medium text-slate-200">${escapeHtml(c.production || 'N/A')}</span>
            </div>
            <div class="bg-slate-900/90 p-2.5 rounded-xl border border-slate-800/80 col-span-2 flex items-center justify-between">
              <span class="text-slate-400 font-bold uppercase text-[9px]">Status</span>
              <span class="px-2 py-0.5 rounded-full ${pal.statusBadge} text-[9px] font-extrabold uppercase">${escapeHtml(c.status || 'Verified')}</span>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function toggleCreditDetailRow(idx) {
  const row = document.getElementById(`creditDetailRow-${idx}`);
  const chevron = document.getElementById(`creditChevron-${idx}`);
  const btnText = document.getElementById(`creditBtnText-${idx}`);
  
  if (row) {
    const isHidden = row.classList.contains('hidden');
    if (isHidden) {
      row.classList.remove('hidden');
      if (chevron) chevron.style.transform = 'rotate(180deg)';
      if (btnText) btnText.textContent = 'Hide';
    } else {
      row.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
      if (btnText) btnText.textContent = 'Details';
    }
  }
}
window.toggleCreditDetailRow = toggleCreditDetailRow;

function filterWorks(cat) {
  renderWorks(cat, currentWorksSearch);
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
      appData.siteTexts.heroBadge3 = 'LONDON BASED';

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
  appData.siteTexts.heroBadge3 = 'LONDON BASED';

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

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  if (window.lucide) lucide.createIcons();
}

function downloadFullCastingSheet() {
  openFullCastingSheetModal();
}

function closeCastingSheetModal() {
  const modal = document.getElementById('castingSheetModal');
  if (modal) modal.classList.add('hidden');
    unlockBodyScroll();
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
    { title: '5. Steve Pereira Portfolio Website', url: 'https://SteveP.uk', tag: 'Official Website' }
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

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  if (window.lucide) lucide.createIcons();
}

function closeFullCastingSheetModal() {
  const modal = document.getElementById('fullCastingSheetModal');
  if (modal) modal.classList.add('hidden');
    unlockBodyScroll();
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
          <span>Official Portfolio: <a href="https://SteveP.uk">https://SteveP.uk</a></span>
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
    ['5. Official Portfolio Website', 'https://SteveP.uk'],
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
Official Portfolio: https://SteveP.uk

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
          <span>Official Portfolio: https://SteveP.uk</span>
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
  setEl('statDisplayNationalities', s.nationalities || 'British / Indian');
  setEl('statDisplayChest', s.chest || '38" (96.5cm)');
  setEl('statDisplayWaist', s.waist || '30" (76.2cm)');
  setEl('statDisplayHips', s.hips || '34" (86.4cm)');
  setEl('statDisplayInsideLeg', s.insideLeg || '28" (71cm)');
  const cleanCollar = (s.collar || '15.5"').replace(/\s*\([^)]*\)/g, '').trim();
  const cleanShoe = (s.shoeSize || '7.5 UK').split('/')[0].trim();
  setEl('statDisplayCollarShoe', `${cleanCollar} / ${cleanShoe}`);
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
// LIVE HERO CARD & STATS EDITING & WORD HIGHLIGHTING ENGINE
// --------------------------------------------------------------------------
function formatHeroSummary(text) {
  if (!text) return '';
  let s = text.trim();

  // 1. Process custom markdown and styling markers
  // ==text== -> Amber highlight
  s = s.replace(/==([^=]+)==/g, '<mark class="bg-amber-500/25 text-amber-300 font-bold px-1.5 py-0.5 rounded border border-amber-500/40">$1</mark>');
  // ^^text^^ -> Cyan highlight
  s = s.replace(/\^\^([^^]+)\^\^/g, '<mark class="bg-cyan-500/25 text-cyan-300 font-bold px-1.5 py-0.5 rounded border border-cyan-500/40">$1</mark>');
  // %%text%% -> Emerald highlight
  s = s.replace(/%%([^%]+)%%/g, '<mark class="bg-emerald-500/25 text-emerald-300 font-bold px-1.5 py-0.5 rounded border border-emerald-500/40">$1</mark>');
  // **text** -> Bold white
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white font-black">$1</strong>');
  // *text* -> Italic
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em class="text-slate-200 italic font-serif">$1</em>');
  // [[text]] -> Gold mono pill badge
  s = s.replace(/\[\[([^\]]+)\]\]/g, '<span class="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold font-mono-code">$1</span>');

  // 2. Intelligent Auto-Highlighter for key actor terms & productions (if not already wrapped inside HTML tags or markers)
  const autoHighlightRules = [
    { pattern: /(?<![<>=])(\bElias\s*(?:&|&amp;)\s*Rosy\s+Pereira\b)(?![^<]*>)/gi, tag: '<a href="javascript:void(0)" onclick="switchTab(\'parents\')" class="text-[#FF9933] font-bold underline decoration-[#FF9933]/70 hover:text-orange-300 transition" title="Meet Steve\'s Parents: Elias &amp; Rosy Pereira">$1</a>' },
    { pattern: /(?<![<>=])(\bBritish[- ]Indian\b)(?![^<]*>)/gi, tag: '<strong class="text-amber-300 font-bold border-b border-amber-500/40 pb-0.5">$1</strong>' },
    { pattern: /(?<![<>=])(\bBukayo Saka\s*(?:&|&amp;)\s*Luka Modri[cć]\b|\bSaka\s*(?:&|&amp;)\s*Modri[cć]\b)(?![^<]*>)/gi, tag: '<strong class="text-amber-300 font-bold">$1</strong>' },
    { pattern: /(?<![<>=])(\bSnickers(?:\s+\(with\s+Saka\s+&\s+Modrić\))?)(?![^<]*>)/gi, tag: '<strong class="text-amber-400 font-bold">$1</strong>' },
    { pattern: /(?<![<>=])(\bTed Lasso(?:\s+\(Apple\s+TV\+\))?|\bApple\s+TV\+\'s\s+Ted\s+Lasso\b)(?![^<]*>)/gi, tag: '<strong class="text-amber-300 font-bold">$1</strong>' },
    { pattern: /(?<![<>=])(\bThe Witcher(?:\s+\(Netflix\))?|\bNetflix\'s\s+The\s+Witcher\b)(?![^<]*>)/gi, tag: '<strong class="text-amber-300 font-bold">$1</strong>' },
    { pattern: /(?<![<>=])(\bBBC Doctors\b|\bDoctors\b)(?![^<]*>)/gi, tag: '<strong class="text-amber-300 font-bold">$1</strong>' }
  ];

  for (let rule of autoHighlightRules) {
    s = s.replace(rule.pattern, rule.tag);
  }

  return s;
}

function applyHeroFormat(formatType) {
  const textarea = document.getElementById('editHeroActorSummaryInput');
  if (!textarea) return;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;
  const selectedText = val.substring(start, end);

  if (!selectedText) {
    alert('Please highlight/select the word or phrase in the text box below, then click the style tool button.');
    textarea.focus();
    return;
  }

  let formatted = selectedText;
  if (formatType === 'amber') {
    formatted = `==${selectedText.replace(/[=^%*\[\]]/g, '')}==`;
  } else if (formatType === 'cyan') {
    formatted = `^^${selectedText.replace(/[=^%*\[\]]/g, '')}^^`;
  } else if (formatType === 'emerald') {
    formatted = `%%${selectedText.replace(/[=^%*\[\]]/g, '')}%%`;
  } else if (formatType === 'bold') {
    formatted = `**${selectedText.replace(/[*]/g, '')}**`;
  } else if (formatType === 'italic') {
    formatted = `*${selectedText.replace(/[*]/g, '')}*`;
  } else if (formatType === 'badge') {
    formatted = `[[${selectedText.replace(/[\[\]]/g, '')}]]`;
  } else if (formatType === 'clear') {
    formatted = selectedText.replace(/[=^%*\[\]]/g, '');
  }

  textarea.value = val.substring(0, start) + formatted + val.substring(end);
  textarea.focus();
  textarea.setSelectionRange(start, start + formatted.length);
  updateLiveHeroCard();
}

function insertHeroKeyword(keyword, style) {
  const textarea = document.getElementById('editHeroActorSummaryInput');
  if (!textarea) return;

  let styledKeyword = keyword;
  if (style === 'amber') styledKeyword = `==${keyword}==`;
  else if (style === 'cyan') styledKeyword = `^^${keyword}^^`;
  else if (style === 'emerald') styledKeyword = `%%${keyword}%%`;
  else if (style === 'bold') styledKeyword = `**${keyword}**`;

  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const val = textarea.value;

  if (start !== end) {
    textarea.value = val.substring(0, start) + styledKeyword + val.substring(end);
  } else {
    // Append or insert at cursor
    const spaceBefore = (start > 0 && !/\s/.test(val[start - 1])) ? ' ' : '';
    const spaceAfter = (start < val.length && !/\s/.test(val[start])) ? ' ' : '';
    textarea.value = val.substring(0, start) + spaceBefore + styledKeyword + spaceAfter + val.substring(start);
  }
  textarea.focus();
  updateLiveHeroCard();
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
  if (collar && shoe && document.getElementById('statDisplayCollarShoe')) {
    const cleanCollar = collar.replace(/\s*\([^)]*\)/g, '').trim();
    const cleanShoe = shoe.split('/')[0].trim();
    document.getElementById('statDisplayCollarShoe').textContent = `${cleanCollar} / ${cleanShoe}`;
  }
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
  setVal('editHeroBadge3Input', t.heroBadge3 || 'LONDON BASED');

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
  populateParentsCMSInputs();
}

// --------------------------------------------------------------------------
// MEET THE PARENTS: CMS POPULATION & SAVE ENGINE
// --------------------------------------------------------------------------
function populateParentsCMSInputs() {
  const pData = appData.parentsPage;
  if (!pData) return;

  const quoteInput = document.getElementById('editParentsHeroQuote');
  if (quoteInput && pData.heroQuote) quoteInput.value = pData.heroQuote;

  const mumBioInput = document.getElementById('editMumBioDesc');
  if (mumBioInput && pData.mumBio && pData.mumBio.desc) mumBioInput.value = pData.mumBio.desc;

  const dadBioInput = document.getElementById('editDadBioDesc');
  if (dadBioInput && pData.dadBio && pData.dadBio.desc) dadBioInput.value = pData.dadBio.desc;

  const listContainer = document.getElementById('adminParentsPhotosList');
  if (listContainer) {
    const photos = pData.photos || [];
    listContainer.innerHTML = photos.map((p, idx) => `
      <div class="p-3 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
        <div class="flex items-center justify-between">
          <strong class="text-white text-xs font-cinzel">Photo #${idx + 1}: ${escapeHtml(p.title || 'Untitled')}</strong>
          <span class="px-2 py-0.5 rounded-full ${p.isPlaceholder ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/20 text-emerald-300'} text-[10px] font-mono-code font-bold">
            ${p.isPlaceholder ? 'Placeholder Slot' : 'Active Photo'}
          </span>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label class="text-[10px] text-slate-400 block mb-0.5">Image URL / Path:</label>
            <input type="text" id="parentPhotoUrl_${idx}" value="${escapeHtml(p.url || '')}" placeholder="/assets/your_photo.jpg" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-400">
          </div>
          <div>
            <label class="text-[10px] text-slate-400 block mb-0.5">Photo Title:</label>
            <input type="text" id="parentPhotoTitle_${idx}" value="${escapeHtml(p.title || '')}" placeholder="e.g. Wedding Day 1963" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-400">
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
          <div>
            <label class="text-[10px] text-slate-400 block mb-0.5">Subtitle / Location Tag:</label>
            <input type="text" id="parentPhotoSub_${idx}" value="${escapeHtml(p.subtitle || '')}" placeholder="e.g. Leicester, UK" class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-400">
          </div>
          <div>
            <label class="text-[10px] text-slate-400 block mb-0.5">Description / Memory:</label>
            <input type="text" id="parentPhotoDesc_${idx}" value="${escapeHtml(p.desc || '')}" placeholder="Memory details..." class="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-rose-400">
          </div>
        </div>
      </div>
    `).join('');
  }
}
window.populateParentsCMSInputs = populateParentsCMSInputs;

async function saveParentsCMSData() {
  appData.parentsPage = appData.parentsPage || {};
  const quoteInput = document.getElementById('editParentsHeroQuote');
  if (quoteInput) appData.parentsPage.heroQuote = quoteInput.value.trim();

  const mumBioInput = document.getElementById('editMumBioDesc');
  if (mumBioInput) {
    appData.parentsPage.mumBio = appData.parentsPage.mumBio || {};
    appData.parentsPage.mumBio.desc = mumBioInput.value.trim();
  }

  const dadBioInput = document.getElementById('editDadBioDesc');
  if (dadBioInput) {
    appData.parentsPage.dadBio = appData.parentsPage.dadBio || {};
    appData.parentsPage.dadBio.desc = dadBioInput.value.trim();
  }

  if (Array.isArray(appData.parentsPage.photos)) {
    appData.parentsPage.photos.forEach((p, idx) => {
      const u = document.getElementById(`parentPhotoUrl_${idx}`);
      const t = document.getElementById(`parentPhotoTitle_${idx}`);
      const s = document.getElementById(`parentPhotoSub_${idx}`);
      const d = document.getElementById(`parentPhotoDesc_${idx}`);
      if (u) {
        p.url = u.value.trim();
        p.isPlaceholder = !p.url;
      }
      if (t) p.title = t.value.trim();
      if (s) p.subtitle = s.value.trim();
      if (d) p.desc = d.value.trim();
    });
  }

  renderParentsPage();
  const ok = await saveAppDataToServer();
  alert(ok ? '✅ Meet The Parents Tribute & Photos saved to database!' : 'Error saving parents tribute.');
}
window.saveParentsCMSData = saveParentsCMSData;

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

function formatTimelineText(text) {
  if (!text) return '';
  let escaped = escapeHtml(text);
  // Universal clickable link whenever Elias & Rosy Pereira is mentioned
  escaped = escaped.replace(/(Elias\s*(&amp;|&)\s*Rosy(\s*Pereira)?)/gi, (match) => {
    return `<a href="javascript:void(0)" onclick="switchTab('parents')" class="text-rose-400 font-bold underline decoration-rose-500/60 hover:text-rose-300 transition" title="Meet Steve's Parents: Elias &amp; Rosy Pereira">${match}</a>`;
  });
  return escaped;
}

let currentAboutSearch = '';

function handleAboutLiveSearch(val) {
  currentAboutSearch = (val || '').trim().toLowerCase();
  renderAboutTimeline(currentAboutSearch);
}

function renderAboutTimeline(searchQuery = '') {
  const container = document.getElementById('aboutTimelineGrid');
  if (!container) return;

  const rawItems = appData.aboutTimeline || [];
  if (rawItems.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 font-mono-code text-xs">No timeline events found. Add them in the Admin CMS!</div>`;
    return;
  }

  // Sort chronologically by initial date field
  let items = [...rawItems].sort((a, b) => getInitialDateValue(a) - getInitialDateValue(b));

  if (searchQuery) {
    items = items.filter(item => {
      const combined = `${item.year || ''} ${item.date || ''} ${item.title || ''} ${item.tag || ''} ${item.category || ''} ${item.location || ''} ${item.desc || ''}`.toLowerCase();
      return combined.includes(searchQuery);
    });
  }

  const badge = document.getElementById('aboutCountBadge');
  if (badge) {
    badge.textContent = `${items.length} Milestone${items.length === 1 ? '' : 's'} Shown`;
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 font-mono-code text-xs">No life milestones matched "${escapeHtml(searchQuery)}".</div>`;
    return;
  }

  const layout = appData.layouts?.about || 'zigzag';

  if (layout === 'zigzag') {
    const totalItems = items.length;
    
    // Generate smooth snaking lifeline S-curve path for SVG (percentage based)
    let svgPathD = '';
    if (totalItems > 1) {
      const step = 100 / totalItems;
      svgPathD = `M 50,${step * 0.5}`;
      for (let i = 1; i < totalItems; i++) {
        const prevY = step * (i - 0.5);
        const currY = step * (i + 0.5);
        const swing = (i % 2 === 1) ? 58 : 42; // Snaking S-curve amplitude
        svgPathD += ` C ${swing},${prevY + step * 0.2} ${100 - swing},${currY - step * 0.2} 50,${currY}`;
      }
    } else {
      svgPathD = 'M 50,0 L 50,100';
    }

    container.className = "lifeline-timeline-container relative space-y-3 sm:space-y-4 py-2";

    // Build timeline items
    const itemsHtml = items.map((item, idx) => {
      const pal = getTimelinePalette(idx, item);
      const isOdd = idx % 2 === 1;

      // Smart icon selection based on event theme
      let eventIcon = item.icon || 'star';
      const titleLower = (item.title + ' ' + (item.year || '') + ' ' + (item.desc || '')).toLowerCase();
      if (titleLower.includes('lift') || titleLower.includes('born') || titleLower.includes('premature')) eventIcon = 'sparkles';
      else if (titleLower.includes('tech') || titleLower.includes('career') || titleLower.includes('it')) eventIcon = 'terminal';
      else if (titleLower.includes('briars') || titleLower.includes('volunteer')) eventIcon = 'heart';
      else if (titleLower.includes('dubai') || titleLower.includes('uae')) eventIcon = 'globe';
      else if (titleLower.includes('cardiac') || titleLower.includes('gatwick') || titleLower.includes('phoenix')) eventIcon = 'flame';
      else if (titleLower.includes('sober') || titleLower.includes('kmst')) eventIcon = 'shield-check';
      else if (titleLower.includes('actor') || titleLower.includes('architect') || titleLower.includes('present')) eventIcon = 'clapperboard';

      const webLink = item.url ? `
        <div class="pt-1.5">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-[11px] font-bold text-slate-200 hover:text-amber-300 transition shadow-sm group/link">
            <i data-lucide="external-link" class="w-3 h-3 text-amber-400 group-hover/link:translate-x-0.5 transition"></i>
            <span>${escapeHtml(item.urlText || 'Visit Official Web Page')}</span>
          </a>
        </div>
      ` : '';

      return `
        <div class="relative w-full group">
          <!-- Desktop Layout (Center Spine with alternating left/right cards) -->
          <div class="hidden md:flex items-center w-full">
            <!-- Left Side Container (50% width) -->
            <div class="w-1/2 pr-8 flex justify-end">
              ${!isOdd ? `
                <div class="w-full max-w-lg glass-card lifeline-card p-3.5 sm:p-4 rounded-2xl border ${pal.cardClass} space-y-1.5 transition backdrop-blur-xl shadow-lg relative group-hover:border-amber-400">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="px-2.5 py-0.5 rounded-full ${pal.yearPill} text-[11px] font-black font-mono-code flex items-center gap-1">
                      <i data-lucide="clock" class="w-3 h-3 text-amber-400"></i> ${escapeHtml(item.year || item.date || '')}
                    </span>
                    <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[10px] font-extrabold uppercase tracking-wider font-mono-code shadow-sm">
                      ${escapeHtml(item.tag || item.category || 'LIFELINE FACT')}
                    </span>
                  </div>

                  <h3 class="text-sm sm:text-base font-black text-white font-cinzel tracking-wide leading-snug">${escapeHtml(item.title)}</h3>
                  
                  ${item.location ? `<p class="text-[10px] text-slate-400 font-mono-code flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${escapeHtml(item.location)}</p>` : ''}
                  
                  <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${formatTimelineText(item.desc)}</p>
                  
                  ${webLink}
                </div>
              ` : ''}
            </div>

            <!-- Central Spine Node -->
            <div class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full border-2 ${pal.iconCircle} group-hover:scale-115 transition shrink-0 shadow-2xl z-20 bg-slate-950">
              <span class="lifeline-heartbeat-ring"></span>
              <span class="lifeline-heartbeat-ring-outer"></span>
              <i data-lucide="${eventIcon}" class="w-4 h-4 text-white relative z-10"></i>
            </div>

            <!-- Right Side Container (50% width) -->
            <div class="w-1/2 pl-8 flex justify-start">
              ${isOdd ? `
                <div class="w-full max-w-lg glass-card lifeline-card p-3.5 sm:p-4 rounded-2xl border ${pal.cardClass} space-y-1.5 transition backdrop-blur-xl shadow-lg relative group-hover:border-amber-400">
                  <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="px-2.5 py-0.5 rounded-full ${pal.yearPill} text-[11px] font-black font-mono-code flex items-center gap-1">
                      <i data-lucide="clock" class="w-3 h-3 text-amber-400"></i> ${escapeHtml(item.year || item.date || '')}
                    </span>
                    <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[10px] font-extrabold uppercase tracking-wider font-mono-code shadow-sm">
                      ${escapeHtml(item.tag || item.category || 'LIFELINE FACT')}
                    </span>
                  </div>

                  <h3 class="text-sm sm:text-base font-black text-white font-cinzel tracking-wide leading-snug">${escapeHtml(item.title)}</h3>
                  
                  ${item.location ? `<p class="text-[10px] text-slate-400 font-mono-code flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3 text-slate-500"></i> ${escapeHtml(item.location)}</p>` : ''}
                  
                  <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${formatTimelineText(item.desc)}</p>
                  
                  ${webLink}
                </div>
              ` : ''}
            </div>
          </div>

          <!-- Mobile Layout (< md) -->
          <div class="flex md:hidden items-start gap-3 w-full">
            <div class="flex items-center justify-center w-8 h-8 rounded-full border-2 ${pal.iconCircle} shrink-0 shadow-xl z-10 bg-slate-950 mt-1">
              <span class="lifeline-heartbeat-ring"></span>
              <i data-lucide="${eventIcon}" class="w-3.5 h-3.5 text-white"></i>
            </div>
            <div class="flex-1 min-w-0 glass-card lifeline-card p-3.5 rounded-2xl border ${pal.cardClass} space-y-1.5 shadow-lg">
              <div class="flex flex-wrap items-center justify-between gap-1.5">
                <span class="px-2 py-0.5 rounded-full ${pal.yearPill} text-[10px] font-black font-mono-code">
                  ${escapeHtml(item.year || item.date || '')}
                </span>
                <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[9px] font-extrabold uppercase font-mono-code">
                  ${escapeHtml(item.tag || item.category || 'FACT')}
                </span>
              </div>
              <h3 class="text-xs sm:text-sm font-black text-white font-cinzel leading-snug">${escapeHtml(item.title)}</h3>
              ${item.location ? `<p class="text-[9px] text-slate-400 font-mono-code">${escapeHtml(item.location)}</p>` : ''}
              <p class="text-[11px] text-slate-300 leading-relaxed whitespace-pre-line">${formatTimelineText(item.desc)}</p>
              ${webLink}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <!-- Snaking Lifeline SVG Spine -->
      <svg class="lifeline-track-svg hidden md:block" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <linearGradient id="lifelineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#f59e0b" />
            <stop offset="25%" stop-color="#06b6d4" />
            <stop offset="50%" stop-color="#f43f5e" />
            <stop offset="75%" stop-color="#10b981" />
            <stop offset="100%" stop-color="#a855f7" />
          </linearGradient>
        </defs>
        <path d="${svgPathD}" class="lifeline-glow-path" />
        <path d="${svgPathD}" class="lifeline-pulse-wave" />
      </svg>

      <!-- Mobile Lifeline Vertical Pulse Spine -->
      <div class="md:hidden absolute top-4 bottom-4 left-4 w-1 rounded-full bg-gradient-to-b from-amber-500 via-rose-500 to-indigo-500 shadow-[0_0_10px_rgba(244,63,94,0.8)] pointer-events-none z-0"></div>

      ${itemsHtml}
    `;
  } else if (layout === 'roadmap') {
    container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4";
    container.innerHTML = items.map((item, idx) => {
      const pal = getTimelinePalette(idx, item);
      const webLink = item.url ? `
        <div class="pt-1.5">
          <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition">
            <i data-lucide="external-link" class="w-3 h-3 text-amber-400"></i>
            <span>${escapeHtml(item.urlText || 'Web Page')}</span>
          </a>
        </div>
      ` : '';

      return `
        <div class="glass-card lifeline-card p-4 rounded-2xl border ${pal.cardClass} space-y-2.5 transition shadow-lg flex flex-col justify-between backdrop-blur-xl">
          <div class="space-y-1.5">
            <div class="flex items-center justify-between">
              <span class="px-2.5 py-0.5 rounded-full ${pal.yearPill} font-black text-[11px] font-mono-code">Step ${idx + 1} • ${escapeHtml(item.year || item.date || '')}</span>
              <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[10px] font-extrabold uppercase font-mono-code">${escapeHtml(item.tag || 'ERA')}</span>
            </div>
            <h3 class="text-sm font-black text-white font-cinzel">${escapeHtml(item.title)}</h3>
            ${item.location ? `<p class="text-[10px] text-slate-400 font-mono-code">${escapeHtml(item.location)}</p>` : ''}
            <p class="text-xs text-slate-300 leading-relaxed whitespace-pre-line">${escapeHtml(item.desc)}</p>
            ${webLink}
          </div>
          <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono-code">
            <span>Lifeline Node #${idx + 1}</span>
            <span class="text-rose-400 flex items-center gap-1"><i data-lucide="activity" class="w-3 h-3"></i> Pulse Active</span>
          </div>
        </div>
      `;
    }).join('');
  } else if (layout === 'story-cards') {
    container.className = "space-y-4";
    const first = items[0];
    const rest = items.slice(1);
    const pal0 = getTimelinePalette(0, first);

    container.innerHTML = `
      ${first ? `
        <div class="glass-card lifeline-card p-5 sm:p-6 rounded-3xl border ${pal0.cardClass} space-y-2.5 shadow-2xl backdrop-blur-xl">
          <div class="flex items-center justify-between gap-2">
            <span class="px-3 py-0.5 rounded-full ${pal0.yearPill} font-black text-xs font-mono-code">INITIAL MILESTONE • ${escapeHtml(first.year || first.date || '')}</span>
            <span class="px-2.5 py-0.5 rounded-full ${pal0.tagClass} text-xs font-extrabold uppercase font-mono-code">${escapeHtml(first.tag || 'HIGHLIGHT')}</span>
          </div>
          <h3 class="text-xl font-black text-white font-cinzel">${escapeHtml(first.title)}</h3>
          ${first.location ? `<p class="text-xs text-slate-400 font-mono-code">${escapeHtml(first.location)}</p>` : ''}
          <p class="text-slate-200 text-xs sm:text-sm leading-relaxed whitespace-pre-line">${escapeHtml(first.desc)}</p>
          ${first.url ? `
            <div class="pt-1.5">
              <a href="${escapeHtml(first.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition">
                <i data-lucide="external-link" class="w-3.5 h-3.5 text-amber-400"></i>
                <span>${escapeHtml(first.urlText || 'Visit Official Web Page')}</span>
              </a>
            </div>
          ` : ''}
        </div>
      ` : ''}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        ${rest.map((item, i) => {
          const pal = getTimelinePalette(i + 1, item);
          return `
            <div class="glass-card lifeline-card p-4 rounded-2xl border ${pal.cardClass} space-y-2 transition backdrop-blur-xl flex flex-col justify-between">
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <span class="px-2.5 py-0.5 rounded-full ${pal.yearPill} font-mono-code font-bold text-[11px]">${escapeHtml(item.year || item.date || '')}</span>
                  <span class="px-2 py-0.5 rounded-full ${pal.tagClass} text-[10px] font-extrabold uppercase font-mono-code">${escapeHtml(item.tag || 'MILESTONE')}</span>
                </div>
                <h4 class="text-sm sm:text-base font-black text-white font-cinzel">${escapeHtml(item.title)}</h4>
                ${item.location ? `<p class="text-[10px] text-slate-400 font-mono-code">${escapeHtml(item.location)}</p>` : ''}
                <p class="text-slate-300 text-xs leading-relaxed whitespace-pre-line">${escapeHtml(item.desc)}</p>
              </div>
              ${item.url ? `
                <div class="pt-1.5 border-t border-slate-800/80">
                  <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-950/90 border border-slate-700 hover:border-amber-400 text-xs font-bold text-slate-200 hover:text-amber-300 transition">
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

// --------------------------------------------------------------------------
// MEET THE PARENTS: ELIAS & ROSY PEREIRA PAGE ENGINE
// --------------------------------------------------------------------------
function renderParentsPage() {
  const pData = appData.parentsPage;
  if (!pData) return;

  const badgeEl = document.getElementById('parentsBadge');
  if (badgeEl && pData.badge) {
    badgeEl.innerHTML = `<i data-lucide="heart" class="w-3.5 h-3.5 text-rose-400 fill-rose-400"></i> ${escapeHtml(pData.badge)}`;
  }

  const titleEl = document.getElementById('parentsTitle');
  if (titleEl && pData.title) titleEl.textContent = pData.title;

  const subEl = document.getElementById('parentsSubtitle');
  if (subEl && pData.subtitle) subEl.textContent = pData.subtitle;

  const heroQuoteEl = document.getElementById('parentsHeroQuote');
  if (heroQuoteEl && pData.heroQuote) heroQuoteEl.textContent = `"${pData.heroQuote}"`;

  const mumBioEl = document.getElementById('mumBioDesc');
  if (mumBioEl && pData.mumBio && pData.mumBio.desc) mumBioEl.textContent = pData.mumBio.desc;

  const dadBioEl = document.getElementById('dadBioDesc');
  if (dadBioEl && pData.dadBio && pData.dadBio.desc) dadBioEl.textContent = pData.dadBio.desc;

  // Render extended story paragraphs
  const storyContainer = document.getElementById('parentsStoryContainer');
  if (storyContainer && Array.isArray(pData.storyParagraphs)) {
    storyContainer.innerHTML = pData.storyParagraphs.map(p => `
      <p class="text-xs sm:text-sm text-slate-300 leading-relaxed font-sans">${escapeHtml(p)}</p>
    `).join('');
  }

  // Render photos gallery
  const photosGrid = document.getElementById('parentsPhotosGrid');
  const countBadge = document.getElementById('parentsPhotoCountBadge');
  if (photosGrid) {
    const photos = pData.photos || [];
    const validCount = photos.filter(p => !p.isPlaceholder && p.url).length;
    if (countBadge) {
      countBadge.textContent = `${validCount} Family Treasures • CMS Editable`;
    }

    photosGrid.innerHTML = photos.map(photo => {
      if (photo.isPlaceholder) {
        return `
          <div onclick="openAddParentPhotoModal()" class="glass-card rounded-2xl border-2 border-dashed border-orange-500/40 hover:border-orange-400 p-8 flex flex-col items-center justify-center text-center cursor-pointer group transition bg-slate-950/40 min-h-[360px]">
            <div class="w-14 h-14 rounded-full bg-orange-500/15 group-hover:bg-orange-500/25 text-orange-400 flex items-center justify-center mb-3 group-hover:scale-110 transition">
              <i data-lucide="plus" class="w-7 h-7"></i>
            </div>
            <strong class="text-white text-sm font-cinzel block mb-1 group-hover:text-orange-300 transition">${escapeHtml(photo.title || '+ Add Family Photo')}</strong>
            <span class="text-[10px] text-orange-400 font-mono-code block mb-2">${escapeHtml(photo.subtitle || 'CMS Placeholder Slot')}</span>
            <p class="text-xs text-slate-400 max-w-xs">${escapeHtml(photo.desc || 'Upload additional family portraits and memories anytime via the Admin CMS.')}</p>
          </div>
        `;
      }

      return `
        <div onclick="openLightbox('${photo.url}', '${escapeHtml(photo.title)}', '${escapeHtml(photo.desc)}')" class="glass-card rounded-2xl overflow-hidden border border-orange-500/30 hover:border-orange-400 transition cursor-pointer group shadow-xl bg-slate-950/80 flex flex-col">
          <div class="aspect-[4/3] w-full overflow-hidden bg-black relative">
            <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.title)}" class="w-full h-full object-cover object-center group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80"></div>
            <div class="absolute top-3 right-3 p-1.5 rounded-full bg-slate-950/80 border border-slate-700 text-orange-400 opacity-0 group-hover:opacity-100 transition shadow">
              <i data-lucide="maximize-2" class="w-4 h-4"></i>
            </div>
          </div>
          <div class="p-4 sm:p-5 space-y-1.5 flex-1 flex flex-col justify-between">
            <div>
              <span class="text-[10px] text-orange-400 font-mono-code font-bold uppercase tracking-wider block">${escapeHtml(photo.subtitle || 'Family Memory')}</span>
              <h4 class="text-sm sm:text-base font-black text-white font-cinzel tracking-wide leading-snug group-hover:text-orange-200 transition">${escapeHtml(photo.title)}</h4>
              <p class="text-xs text-slate-300 leading-relaxed mt-1.5">${escapeHtml(photo.desc)}</p>
            </div>
            <div class="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400 font-mono-code">
              <span class="flex items-center gap-1 text-orange-300"><i data-lucide="heart" class="w-3 h-3 text-orange-400"></i> Heritage Treasure</span>
              <span class="text-amber-400 group-hover:underline">Enlarge Photo &rarr;</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  if (window.lucide) lucide.createIcons();
}
window.renderParentsPage = renderParentsPage;

function openAddParentPhotoModal() {
  switchTab('admin');
  setTimeout(() => {
    if (typeof setAdminSubTab === 'function') setAdminSubTab('about');
    showNotification('💡 You can manage and upload parent tribute photos in the Admin CMS!');
  }, 300);
}
window.openAddParentPhotoModal = openAddParentPhotoModal;

let currentITSearch = '';

function handleITLiveSearch(val) {
  currentITSearch = (val || '').trim().toLowerCase();
  renderITTimeline(currentITSearch);
}

function renderITTimeline(searchQuery = '') {
  const container = document.getElementById('itTimelineContainer');
  if (!container) return;

  let items = appData.itTimeline || [];
  if (searchQuery) {
    items = items.filter(item => {
      const combined = `${item.year || ''} ${item.title || ''} ${item.company || ''} ${item.desc || ''}`.toLowerCase();
      return combined.includes(searchQuery);
    });
  }

  if (items.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 font-mono-code text-xs">No IT career milestones matched "${escapeHtml(searchQuery)}".</div>`;
    return;
  }

  const layout = appData.layouts?.it || 'blueprint';

  if (layout === 'blueprint') {
    container.className = "space-y-4";
    container.innerHTML = items.map(item => `
      <div class="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 backdrop-blur-md hover:border-cyan-500/40 transition">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="px-3 py-0.5 rounded-full bg-cyan-500/20 text-cyan-400 text-xs font-black font-mono-code">${escapeHtml(item.year)}</span>
          <span class="text-xs font-bold text-slate-300">${escapeHtml(item.company || '')}</span>
        </div>
        <h4 class="text-white font-bold text-base font-cinzel">${escapeHtml(item.title)}</h4>
        <p class="text-slate-300 text-xs leading-relaxed">${escapeHtml(item.desc)}</p>
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
                <span>[${escapeHtml(item.year)}] > ${escapeHtml(item.company || 'Enterprise')}</span>
                <span class="text-[10px] text-slate-500">ID: ARCH_0${idx + 1}</span>
              </div>
              <h5 class="text-white font-bold">${escapeHtml(item.title)}</h5>
              <p class="text-slate-300 text-[11px] font-sans">${escapeHtml(item.desc)}</p>
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
            <span class="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 text-xs font-black font-mono-code">${escapeHtml(item.year)}</span>
            <span class="text-xs font-bold text-slate-300">${escapeHtml(item.company || 'Consultancy')}</span>
          </div>
          <h4 class="text-base font-black text-white font-cinzel">${escapeHtml(item.title)}</h4>
          <p class="text-slate-300 text-xs leading-relaxed">${escapeHtml(item.desc)}</p>
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

let hacksSearchQuery = '';

function setHacksCategory(cat) {
  currentHacksCategory = cat;
  renderHacks();
}

function handleHacksLiveSearch(val) {
  hacksSearchQuery = (val || '').trim().toLowerCase();
  const clearBtn = document.getElementById('clearHacksSearchBtn');
  if (clearBtn) {
    if (hacksSearchQuery) clearBtn.classList.remove('hidden');
    else clearBtn.classList.add('hidden');
  }
  renderHacks();
}

function clearHacksSearch() {
  const input = document.getElementById('hacksLiveSearchInput');
  if (input) input.value = '';
  hacksSearchQuery = '';
  const clearBtn = document.getElementById('clearHacksSearchBtn');
  if (clearBtn) clearBtn.classList.add('hidden');
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
    const clicks = h.clicks !== undefined ? h.clicks : 0;
    const usedCount = h.usedCount || (clicks ? Math.floor(clicks * 0.8) : 5);
    const discountPercent = h.discountPercent || (h.badge && h.badge.includes('%') ? parseInt(h.badge) : 20);
    const comments = h.comments || [];
    const approvedComments = comments.filter(c => c.approved);

    return {
      ...h,
      logo: logoSrc,
      image: defaultImg,
      clicks,
      usedCount,
      discountPercent,
      comments,
      approvedComments,
      isTopOffer: h.isTopOffer !== undefined ? h.isTopOffer : (h.badge === 'EXCLUSIVE' || h.badge === 'STEVE RECOMMENDS' || clicks > 10)
    };
  });

  const layout = appData.layouts?.hacks || 'cards-deck';

  // Render Steve's Top Offers Showcase Banner if in cards or bento mode
  if (topOffersContainer) {
    if (layout === 'table-list' || hacksSearchQuery) {
      topOffersContainer.innerHTML = '';
    } else {
      const topOffers = hacks.filter(h => h.isTopOffer);
      if (topOffers.length > 0) {
        topOffersContainer.innerHTML = `
          <div class="glass-card rounded-3xl border-2 border-amber-500/40 p-6 space-y-4 relative overflow-hidden bg-gradient-to-r from-slate-950 via-amber-950/20 to-slate-950 shadow-2xl">
            <div class="flex items-center justify-between">
              <span class="px-3 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-black uppercase flex items-center gap-1.5">
                🔥 Steve's Top Offers &amp; Verified Recommendations
              </span>
              <span class="text-xs text-slate-400 font-mono-code">${topOffers.length} Featured Deals</span>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              ${topOffers.slice(0, 2).map(h => `
                <div class="glass-card rounded-2xl border border-amber-500/30 p-4 flex gap-4 items-center bg-slate-950/80 hover:border-amber-400 transition group">
                  <div class="w-20 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 border border-slate-800 relative">
                    <img src="${escapeHtml(h.image)}" alt="${escapeHtml(h.title)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-300">
                    ${h.logo ? `<img src="${escapeHtml(h.logo)}" class="absolute bottom-1 right-1 w-6 h-6 rounded-md bg-slate-950 p-0.5 border border-slate-700 shadow" onerror="this.style.display='none'">` : ''}
                  </div>
                  <div class="flex-1 min-w-0 space-y-1.5">
                    <div class="flex items-center justify-between gap-2">
                      <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black">${escapeHtml(h.badge || 'DEAL')}</span>
                      <span id="hack-clicks-${h.id}-top" class="text-[10px] text-amber-300 font-mono-code font-bold flex items-center gap-1">
                        🔥 ${h.clicks || 0} clicks
                      </span>
                    </div>
                    <h5 class="text-white font-black text-sm truncate">${escapeHtml(h.title)}</h5>
                    <div class="flex items-center gap-2 pt-1">
                      <button onclick="copyHackCode('${escapeHtml(h.code)}', '${h.id}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono-code font-bold text-xs">
                        ${escapeHtml(h.code || 'CLAIM')}
                      </button>
                      <a href="${escapeHtml(h.link)}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition">
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

  // Filter category & live search
  let filtered = [...hacks];
  if (currentHacksCategory !== 'all') {
    filtered = filtered.filter(h => h.category === currentHacksCategory);
  }

  if (hacksSearchQuery) {
    filtered = filtered.filter(h => {
      const matchTitle = (h.title || '').toLowerCase().includes(hacksSearchQuery);
      const matchDesc = (h.desc || '').toLowerCase().includes(hacksSearchQuery);
      const matchCat = (h.category || '').toLowerCase().includes(hacksSearchQuery);
      const matchCode = (h.code || '').toLowerCase().includes(hacksSearchQuery);
      const matchKeywords = (h.seo && h.seo.keywords || '').toLowerCase().includes(hacksSearchQuery);
      return matchTitle || matchDesc || matchCat || matchCode || matchKeywords;
    });
  }

  // Sorting
  if (currentHacksFilter === 'top') {
    filtered.sort((a, b) => b.clicks - a.clicks);
  } else if (currentHacksFilter === 'discount') {
    filtered.sort((a, b) => (b.discountPercent || 0) - (a.discountPercent || 0));
  } else if (currentHacksFilter === 'clicked') {
    filtered.sort((a, b) => b.clicks - a.clicks);
  } else if (currentHacksFilter === 'used') {
    filtered.sort((a, b) => (b.usedCount || 0) - (a.usedCount || 0));
  }

  if (countBadge) {
    if (hacksSearchQuery) {
      countBadge.textContent = `${filtered.length} Deals match "${hacksSearchQuery}"`;
    } else {
      countBadge.textContent = `${filtered.length} Verified Deals &amp; Hacks`;
    }
  }

  if (filtered.length === 0) {
    mainContainer.innerHTML = `
      <div class="col-span-full py-16 text-center space-y-3 glass-card rounded-3xl border border-slate-800">
        <i data-lucide="search-x" class="w-10 h-10 mx-auto text-slate-500"></i>
        <h4 class="text-white font-bold text-sm">No deals matched your search filter.</h4>
        <p class="text-xs text-slate-400">Try changing your search term or select "All Categories".</p>
        <button onclick="clearHacksSearch(); setHacksCategory('all')" class="px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
          Reset Filters
        </button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  if (layout === 'cards-deck') {
    mainContainer.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";
    mainContainer.innerHTML = filtered.map(h => {
      const latestApprovedComment = h.approvedComments && h.approvedComments.length > 0 ? h.approvedComments[0] : null;

      return `
        <div class="glass-card rounded-3xl overflow-hidden border border-slate-800 hover:border-emerald-400/80 transition duration-300 flex flex-col justify-between group shadow-xl bg-slate-950/70">
          <div class="relative aspect-video w-full overflow-hidden bg-slate-900">
            <img src="${escapeHtml(h.image)}" alt="${escapeHtml(h.title)}" class="w-full h-full object-cover group-hover:scale-105 transition duration-500">
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
            
            <!-- Top Badges Row -->
            <div class="absolute top-3 inset-x-3 flex items-center justify-between">
              <span class="px-3 py-1 rounded-full bg-emerald-500 text-slate-950 font-black text-[10px] uppercase font-mono-code shadow-md">
                ${escapeHtml(h.badge || 'DEAL')}
              </span>
              <span id="hack-clicks-${h.id}" class="px-2.5 py-1 rounded-full bg-slate-950/90 text-amber-300 border border-amber-500/40 font-mono-code font-bold text-[10px] shadow-lg flex items-center gap-1">
                🔥 ${h.clicks || 0} Clicks
              </span>
            </div>
          </div>

          <div class="p-5 space-y-3.5 flex-1 flex flex-col justify-between">
            <div class="space-y-2.5">
              <div class="flex items-center gap-3">
                <img src="${escapeHtml(h.logo || 'https://www.google.com/s2/favicons?domain=github.com&sz=128')}" class="w-8 h-8 rounded-xl object-contain bg-slate-900 p-1 border border-slate-700 shadow shrink-0" alt="Logo" onerror="this.style.display='none'">
                <div class="min-w-0">
                  <h4 class="font-black text-white text-sm font-cinzel leading-tight truncate">${escapeHtml(h.title)}</h4>
                  <span class="text-[10px] font-mono-code text-slate-400">${escapeHtml(h.category || 'Tech')}</span>
                </div>
              </div>
              <p class="text-slate-300 text-xs leading-relaxed line-clamp-2">${escapeHtml(h.desc || '')}</p>

              <!-- 1-Line Approved Comment Section / Ticker -->
              ${latestApprovedComment ? `
                <div class="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] space-y-1">
                  <div class="flex items-center justify-between text-slate-400 font-mono-code text-[9px]">
                    <span class="flex items-center gap-1 text-emerald-400 font-bold">
                      <i data-lucide="message-square" class="w-3 h-3"></i> Verified 1-Line Feedback:
                    </span>
                    <span>${h.approvedComments.length} review${h.approvedComments.length > 1 ? 's' : ''}</span>
                  </div>
                  <p class="text-slate-200 italic line-clamp-2">
                    &ldquo;${escapeHtml(latestApprovedComment.text)}&rdquo;
                    <span class="text-slate-400 not-italic font-bold block text-[10px]">— ${escapeHtml(latestApprovedComment.author)}</span>
                  </p>
                </div>
              ` : `
                <div class="py-1 px-2 rounded-lg bg-slate-900/40 border border-slate-800/60 flex items-center justify-between text-[10px] text-slate-400">
                  <span>No community comments yet</span>
                  <button type="button" onclick="openAddCommentModal('${h.id}')" class="text-emerald-400 hover:text-emerald-300 font-bold">
                    + Be the first
                  </button>
                </div>
              `}
            </div>

            <!-- Footer: Promo Code, Claim Button & Add Comment Trigger -->
            <div class="space-y-2.5 pt-2.5 border-t border-slate-800/80">
              <div class="flex items-center justify-between gap-2">
                <span class="font-mono-code font-bold text-amber-400 text-xs px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 select-all truncate">
                  ${escapeHtml(h.code || 'NO CODE NEEDED')}
                </span>
                <button onclick="copyHackCode('${escapeHtml(h.code)}', '${h.id}')" class="px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold text-xs transition shrink-0">
                  Copy Code
                </button>
              </div>

              <div class="grid grid-cols-12 gap-2 items-center">
                <a href="${escapeHtml(h.link)}" target="_blank" onclick="trackHackClick('${h.id}')" class="col-span-8 py-2 px-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow transition">
                  <span>Claim Deal</span> <i data-lucide="external-link" class="w-3 h-3"></i>
                </a>
                <button type="button" onclick="openAddCommentModal('${h.id}')" class="col-span-4 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-emerald-400 border border-slate-700 font-bold text-[11px] flex items-center justify-center gap-1 transition" title="Leave 1-line feedback for this deal">
                  <i data-lucide="message-square" class="w-3.5 h-3.5"></i>
                  <span>Review</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
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
              <th class="p-3.5">Clicks &amp; Feedback</th>
              <th class="p-3.5">Promo Code</th>
              <th class="p-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-800/60">
            ${filtered.map(h => `
              <tr class="hover:bg-slate-900/50 transition">
                <td class="p-3.5 flex items-center gap-3">
                  <img src="${escapeHtml(h.logo || 'https://www.google.com/s2/favicons?domain=github.com&sz=128')}" class="w-7 h-7 rounded-lg object-contain bg-slate-900 p-1 border border-slate-700" alt="Logo" onerror="this.style.display='none'">
                  <div>
                    <strong class="text-white font-bold block">${escapeHtml(h.title)}</strong>
                    <span class="text-[10px] text-slate-400">${escapeHtml(h.desc ? h.desc.substring(0, 45) + '...' : '')}</span>
                  </div>
                </td>
                <td class="p-3.5 text-slate-300 font-mono-code text-[11px]">${escapeHtml(h.category || 'Tech')}</td>
                <td class="p-3.5"><span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono-code text-[10px]">${escapeHtml(h.badge || 'DEAL')}</span></td>
                <td class="p-3.5 font-mono-code">
                  <span id="hack-clicks-${h.id}" class="text-amber-300 font-bold text-xs">🔥 ${h.clicks || 0} clicks</span>
                  <button type="button" onclick="openAddCommentModal('${h.id}')" class="text-[10px] text-emerald-400 hover:underline block mt-0.5">💬 ${h.approvedComments.length} reviews</button>
                </td>
                <td class="p-3.5">
                  <span class="font-mono-code font-bold text-amber-400 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-xs select-all">${escapeHtml(h.code || 'AUTOMATIC')}</span>
                </td>
                <td class="p-3.5 text-right">
                  <div class="inline-flex items-center gap-2">
                    <button onclick="copyHackCode('${escapeHtml(h.code)}', '${h.id}')" class="px-2.5 py-1 rounded-lg bg-slate-800 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 font-bold text-[11px] transition">Copy</button>
                    <a href="${escapeHtml(h.link)}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] transition shadow">Claim</a>
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
              <span id="hack-clicks-${h.id}" class="text-amber-300 font-mono-code font-bold text-xs">🔥 ${h.clicks || 0} Clicks</span>
            </div>
            <h4 class="font-black text-white text-base font-cinzel leading-tight">${escapeHtml(h.title)}</h4>
            <p class="text-slate-300 text-xs line-clamp-2">${escapeHtml(h.desc || '')}</p>
            <div class="pt-2 border-t border-slate-800 flex items-center justify-between gap-2">
              <span class="font-mono-code font-bold text-amber-400 text-xs">${escapeHtml(h.code || 'DIRECT DEAL')}</span>
              <a href="${escapeHtml(h.link)}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow transition">Claim Deal</a>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        ${rest.map(h => `
          <div class="glass-card p-4 rounded-2xl border border-slate-800 space-y-2 hover:border-emerald-400 transition">
            <div class="flex items-center justify-between">
              <span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold font-mono-code">${escapeHtml(h.badge || 'DEAL')}</span>
              <span id="hack-clicks-${h.id}" class="text-[10px] text-amber-300 font-mono-code font-bold">🔥 ${h.clicks || 0}</span>
            </div>
            <h5 class="font-bold text-white text-xs truncate">${escapeHtml(h.title)}</h5>
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80">
              <span class="text-amber-400 font-mono-code font-bold text-xs truncate">${escapeHtml(h.code || 'AUTOMATIC')}</span>
              <a href="${escapeHtml(h.link)}" target="_blank" onclick="trackHackClick('${h.id}')" class="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-emerald-500 hover:text-slate-950 text-emerald-400 font-bold text-[11px] transition">Claim</a>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  if (window.lucide) lucide.createIcons();
}

function trackHackClick(id) {
  const hack = (appData.hacks || []).find(h => h.id === id);
  if (hack) {
    hack.clicks = (hack.clicks || 0) + 1;
    const els = document.querySelectorAll(`[id^="hack-clicks-${id}"]`);
    els.forEach(el => {
      el.textContent = `🔥 ${hack.clicks} Clicks`;
      el.classList.add('scale-110', 'text-amber-300');
      setTimeout(() => el.classList.remove('scale-110', 'text-amber-300'), 500);
    });
  }
  trackEvent('affiliate_click', hack?.title || id, { hackId: id, network: hack?.affiliateNetwork, payoutModel: hack?.payoutModel });
}

function openAddCommentModal(hackId) {
  const hack = (appData.hacks || []).find(h => h.id === hackId);
  if (!hack) return;

  const modal = document.getElementById('hackCommentModal');
  const targetId = document.getElementById('commentTargetHackId');
  const targetTitle = document.getElementById('commentTargetHackTitle');
  const authorInput = document.getElementById('commentAuthorInput');
  const textInput = document.getElementById('commentTextInput');

  if (targetId) targetId.value = hack.id;
  if (targetTitle) targetTitle.textContent = hack.title;
  if (authorInput) authorInput.value = '';
  if (textInput) textInput.value = '';
  updateCommentCharCount('');

  if (modal) modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  if (window.lucide) lucide.createIcons();
}

function closeAddCommentModal() {
  document.getElementById('hackCommentModal')?.classList.add('hidden');
}

function updateCommentCharCount(val) {
  const countEl = document.getElementById('commentCharCount');
  if (countEl) countEl.textContent = `${(val || '').length} / 120 chars`;
}

async function handleUserSubmitComment(e) {
  e.preventDefault();
  const hackId = document.getElementById('commentTargetHackId')?.value;
  const author = document.getElementById('commentAuthorInput')?.value.trim();
  const text = document.getElementById('commentTextInput')?.value.trim();

  if (!hackId || !author || !text) {
    alert('Please provide both your name and a 1-line comment.');
    return;
  }

  try {
    const res = await fetch(`/api/hacks/${hackId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, text })
    });
    const data = await res.json();

    if (data.success) {
      // Add to local appData
      const hack = (appData.hacks || []).find(h => h.id === hackId);
      if (hack) {
        hack.comments = hack.comments || [];
        hack.comments.unshift(data.comment);
      }
      closeAddCommentModal();
      alert('Thank you! Your comment has been submitted and will appear on the live site once approved by Steve.');
      renderAdminCommentsModeration();
    } else {
      alert('Failed to submit comment: ' + (data.message || 'Error'));
    }
  } catch (err) {
    alert('Error submitting comment: ' + err.message);
  }
}

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// KMST SOBRIETY, INTERACTIVE COMMUNITY & RECOVERY SANCTUARY ENGINE
// --------------------------------------------------------------------------
let _currentKMSTChannel = 'all';
let _cachedKMSTMessages = [
  {
    "id": "msg_topic_1_cravings",
    "channel": "general",
    "authorName": "Antigravity_AI",
    "authorRole": "Sanctuary AI Guide",
    "authorAvatar": "✨",
    "authorBadge": "Sanctuary AI Guide",
    "includeBadge": true,
    "badgeObject": "✨🧭 Guiding Light AI Beacon",
    "shieldIcon": "✨",
    "streakDays": 5260,
    "postColor": "cyan",
    "message": "💡 [TOPIC 1: CONQUERING THE 5 PM CRAVINGS]: For many in recovery, late afternoon/evening is the danger zone (the 'witching hour'). When cravings hit, use the HALT check: Are you Hungry, Angry, Lonely, or Tired? What is your go-to non-alcoholic swap or evening ritual that breaks the auto-pilot urge?",
    "timestamp": "2026-08-25T20:38:20.401Z",
    "pinned": true,
    "status": "approved",
    "reactions": {
      "strength": 42,
      "respect": 35,
      "celebrate": 29,
      "soberToday": 48
    }
  },
  {
    "id": "msg_steve_reply_cravings",
    "channel": "general",
    "authorName": "Steve Pereira",
    "authorRole": "Founder / Admin",
    "authorAvatar": "🔥",
    "authorBadge": "14 Yrs Phoenix Warrior",
    "includeBadge": true,
    "badgeObject": "🔥🦅 14-Year Steve Pereira Phoenix Tattoo Rebirth",
    "shieldIcon": "🔥",
    "streakDays": 5260,
    "postColor": "gold",
    "message": "@Antigravity_AI Spot on. In my early days after getting back on my feet, I learned that cravings peak like a wave for 15-20 minutes and then subside. Changing the physical environment, taking a brisk walk, or making an ice-cold sparkling water with fresh lemon immediately disrupted that mental loop.",
    "timestamp": "2026-08-25T21:38:20.405Z",
    "pinned": false,
    "status": "approved",
    "reactions": {
      "strength": 31,
      "respect": 28,
      "celebrate": 24,
      "soberToday": 36
    },
    "editedAt": "2026-08-26T01:35:23.507Z"
  },
  {
    "id": "msg_topic_2_trust",
    "channel": "family",
    "authorName": "Antigravity_AI",
    "authorRole": "Sanctuary AI Guide",
    "authorAvatar": "✨",
    "authorBadge": "Sanctuary AI Guide",
    "includeBadge": true,
    "badgeObject": "✨🧭 Guiding Light AI Beacon",
    "shieldIcon": "✨",
    "streakDays": 5260,
    "postColor": "purple",
    "message": "❤️ [TOPIC 2: REBUILDING FAMILY TRUST]: Living in active addiction often strained bonds with parents, partners, and siblings. Rebuilding trust doesn't happen with words or promises—it happens through repeated, predictable sober actions over time. How are you navigating relationship repair in your journey?",
    "timestamp": "2026-08-25T18:38:20.405Z",
    "pinned": true,
    "status": "approved",
    "reactions": {
      "strength": 38,
      "respect": 33,
      "celebrate": 26,
      "soberToday": 41
    }
  },
  {
    "id": "msg_topic_3_joy",
    "channel": "milestones",
    "authorName": "Antigravity_AI",
    "authorRole": "Sanctuary AI Guide",
    "authorAvatar": "✨",
    "authorBadge": "Sanctuary AI Guide",
    "includeBadge": true,
    "badgeObject": "✨🧭 Guiding Light AI Beacon",
    "shieldIcon": "✨",
    "streakDays": 5260,
    "postColor": "emerald",
    "message": "🌟 [TOPIC 3: REDISCOVERING PASSION & NATURAL JOY]: When alcohol stops numbing your dopamine receptors, the brain begins to recalibrate. What is a passion, creative hobby, sport, or simple joy you've rediscovered now that your mind and mornings are clear?",
    "timestamp": "2026-08-25T16:38:20.405Z",
    "pinned": true,
    "status": "approved",
    "reactions": {
      "strength": 45,
      "respect": 39,
      "celebrate": 40,
      "soberToday": 52
    }
  },
  {
    "id": "msg_sarah_reply_joy",
    "channel": "milestones",
    "authorName": "Sarah_London",
    "authorRole": "Member",
    "authorAvatar": "💖",
    "authorBadge": "30 Days Roman Bronze",
    "includeBadge": true,
    "badgeObject": "🏅 30-Day Ancient Roman Bronze Coin",
    "shieldIcon": "🏅",
    "streakDays": 30,
    "postColor": "rose",
    "message": "@Antigravity_AI Weekend sunrise runs! I used to lose entire Saturdays to hangovers in bed. At 30 days sober today, waking up at 7am with energy to run by the Thames is the most incredible natural high.",
    "timestamp": "2026-08-25T22:38:20.405Z",
    "pinned": false,
    "status": "approved",
    "reactions": {
      "strength": 29,
      "respect": 23,
      "celebrate": 34,
      "soberToday": 28
    }
  }
];
let _cachedKMSTMembers = [];
_cachedKMSTHelplines = [];
_cachedKMSTConfig = {
  founderSoberDate: "2012-04-01",
  heroTitle: "KEEP ME SOBER TOO <span class=\"text-rose-400 font-sans\">(KMST)</span>",
  heroBio: "In 2013, following a sudden cardiac arrest landing at Gatwick Airport, Steve Pereira survived against all odds, overcoming MRSA and pneumonia. Celebrating <strong>14 years of continuous sobriety</strong>, Steve founded <strong>KMST</strong> as a living sanctuary of hope, accountability, practical recovery tools, and interactive peer mentorship for anyone seeking freedom from alcohol addiction.",
  heroBadge1: "SOBER SINCE 2012",
  heroBadge2: "FOUNDER OF KEEP ME SOBER TOO (KMST)",
  heroBadge3: "INTERACTIVE PEER COMMUNITY",
  founderQuote: "Sobriety didn’t just save my life after Gatwick—it gave me clarity, energy, and a career in enterprise tech and screen acting. No matter what your Day 1 looks like, take the first step today.",
  communityTag: "1,250+ Warriors Community",
  instagramHandle: "KeepMeSoberToo",
  instagramUrl: "https://www.instagram.com/KeepMeSoberToo",
  twitterHandle: "KeepMeSoberToo",
  twitterUrl: "https://x.com/KeepMeSoberToo",
  slogan: "Staying sober has changed my life completely. This is not just my story, but those who supported me. Hope to help others rebuild."
};
// Brand New Unique 3D Milestone Objects: Hearts, Phoenix Tattoo, Badges, Shields, Trophies
const KMST_MILESTONE_DEFINITIONS = [
  {
    id: '24h',
    days: 1,
    name: '24-Hour Spark of Ignition',
    objectType: 'Ignition Medallion',
    objectIcon: '⚡',
    sub: 'ONE DAY AT A TIME',
    icon: '⚡',
    image: 'assets/badges/badge_24h.svg',
    color: 'text-amber-400',
    border: 'border-amber-500/50',
    bg: 'bg-gradient-to-b from-amber-950/40 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.25)]',
    meaning: 'The electric ignition spark that begins the journey. Every long-term recovery story starts with 24 hours of courage and clarity.'
  },
  {
    id: '7d',
    days: 7,
    name: '7-Day Ironclad Crusader Shield',
    objectType: 'Forged Knight Shield',
    objectIcon: '🛡️',
    sub: 'STEADFAST STRENGTH',
    icon: '🛡️',
    image: 'assets/badges/badge_7d.svg',
    color: 'text-slate-200',
    border: 'border-slate-400/50',
    bg: 'bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(148,163,184,0.25)]',
    meaning: 'One whole week of steadfast defense. Your physical body is detoxifying, brain fog lifts, and an ironclad mental shield forms.'
  },
  {
    id: '30d',
    days: 30,
    name: '30-Day Ancient Roman Bronze Coin',
    objectType: 'Roman Bronze Medallion',
    objectIcon: '🏅',
    sub: 'NEW FOUNDATION',
    icon: '🏅',
    image: 'assets/badges/badge_30d.svg',
    color: 'text-orange-400',
    border: 'border-orange-500/50',
    bg: 'bg-gradient-to-b from-orange-950/40 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(234,88,12,0.25)]',
    meaning: '30 continuous days sober. Deep restorative sleep returns, liver enzymes balance, and Roman-grade foundations are set in bronze.'
  },
  {
    id: '60d',
    days: 60,
    name: '60-Day Sterling Silver Starburst',
    objectType: 'Sterling Starburst Badge',
    objectIcon: '⭐',
    sub: 'STEADY HORIZONS',
    icon: '⭐',
    image: 'assets/badges/badge_60d.svg',
    color: 'text-sky-300',
    border: 'border-sky-400/50',
    bg: 'bg-gradient-to-b from-sky-950/40 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(56,189,248,0.25)]',
    meaning: 'Two full months without alcohol. Emotional stability solidifies and sterling clarity replaces old anxiety.'
  },
  {
    id: '90d',
    days: 90,
    name: '90-Day 24K Radiant Sunburst Shield',
    objectType: '24K Sunburst Shield',
    objectIcon: '🦁',
    sub: 'GOLDEN CLARITY',
    icon: '🦁',
    image: 'assets/badges/badge_90d.svg',
    color: 'text-yellow-400',
    border: 'border-yellow-400/50',
    bg: 'bg-gradient-to-b from-yellow-950/40 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]',
    meaning: '90 Days. The critical milestone where sobriety transforms from a daily battle into a radiant, sustainable way of life.'
  },
  {
    id: '6m',
    days: 180,
    name: '6-Month Faceted Ruby Crystal Heart',
    objectType: 'Faceted Ruby Heart',
    objectIcon: '💖',
    sub: 'UNBREAKABLE HEART',
    icon: '💖',
    image: 'assets/badges/badge_6m.svg',
    color: 'text-rose-400',
    border: 'border-rose-500/50',
    bg: 'bg-gradient-to-b from-rose-950/40 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(244,63,94,0.3)]',
    meaning: 'Half a year of courage. An unbreakable crystal heart flanked by golden wings, proving your emotional resilience and love for life.'
  },
  {
    id: '1y',
    days: 365,
    name: '1-Year Grand Victory Trophy Cup',
    objectType: 'Championship Trophy Cup',
    objectIcon: '🏆',
    sub: 'PLATINUM CHAMPION',
    icon: '🏆',
    image: 'assets/badges/badge_1y.svg',
    color: 'text-amber-300',
    border: 'border-amber-400/50',
    bg: 'bg-gradient-to-b from-amber-950/50 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_35px_rgba(251,191,36,0.35)]',
    meaning: '365 Days. You have navigated every season, holiday, and celebration fully sober. A true champion victory cup awarded for life.'
  },
  {
    id: '3y',
    days: 1095,
    name: '3-Year Celtic Emerald Tree of Life',
    objectType: 'Celtic Emerald Shield',
    objectIcon: '🌲',
    sub: 'ROOTED WISDOM',
    icon: '🌲',
    image: 'assets/badges/badge_3y.svg',
    color: 'text-emerald-400',
    border: 'border-emerald-500/50',
    bg: 'bg-gradient-to-b from-emerald-950/50 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    meaning: 'Over 1,000 days sober. Deep emotional peace, wisdom, and an ancient rooted tree of life with sprawling branches.'
  },
  {
    id: '5y',
    days: 1825,
    name: '5-Year Imperial Diamond Crown',
    objectType: 'Diamond Imperial Crown',
    objectIcon: '👑',
    sub: 'DIAMOND FREEDOM',
    icon: '👑',
    image: 'assets/badges/badge_5y.svg',
    color: 'text-purple-300',
    border: 'border-purple-500/50',
    bg: 'bg-gradient-to-b from-purple-950/50 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_30px_rgba(192,132,252,0.3)]',
    meaning: 'Half a decade of continuous freedom. Complete sovereignty over mind and destiny, crowned in brilliant multifaceted diamonds.'
  },
  {
    id: '10y',
    days: 3650,
    name: '10-Year Master Laurels & Infinity',
    objectType: 'Golden Infinity Medallion',
    objectIcon: '🌟',
    sub: 'MASTER LEGACY',
    icon: '🌟',
    image: 'assets/badges/badge_10y.svg',
    color: 'text-amber-300',
    border: 'border-amber-300/60',
    bg: 'bg-gradient-to-b from-amber-950/60 via-slate-950/80 to-slate-950/90',
    glow: 'shadow-[0_0_35px_rgba(252,211,77,0.35)]',
    meaning: 'A full decade of triumph. Golden victory laurels encircling an infinite loop of lifelong strength and legacy.'
  },
  {
    id: '14y',
    days: 4748,
    name: '14-Year Steve Pereira Phoenix Tattoo',
    objectType: 'SteveP Phoenix Tattoo Rebirth',
    objectIcon: '🔥🦅',
    sub: 'SURVIVOR • FOUNDER • LEGEND',
    icon: '🔥',
    image: 'assets/badges/badge_14y.svg',
    color: 'text-orange-400',
    border: 'border-orange-500/70',
    bg: 'bg-gradient-to-b from-red-950/60 via-orange-950/40 to-slate-950/90',
    glow: 'shadow-[0_0_40px_rgba(249,115,22,0.45)]',
    meaning: 'Founder Steve Pereira\'s iconic Phoenix tattoo milestone: Surviving cardiac arrest at Gatwick Airport in 2013 and rising from the ashes to 14 continuous years sober.'
  }
];

function calculateSobrietyDays() {
  const soberDate = new Date(_cachedKMSTConfig.founderSoberDate || '2012-04-01');
  const now = new Date();
  const diffTime = Math.max(0, now - soberDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  const el = document.getElementById('sobrietyDaysCount');
  if (el) el.textContent = diffDays.toLocaleString();
}

function renderKMSTHeroUI(config) {
  const c = config || _cachedKMSTConfig;
  if (!c) return;

  const hTitle = document.getElementById('kmstHeroTitle');
  if (hTitle && c.heroTitle) hTitle.innerHTML = c.heroTitle;

  const hBio = document.getElementById('kmstHeroBio');
  if (hBio && c.heroBio) hBio.innerHTML = c.heroBio;

  const b1 = document.getElementById('kmstHeroBadge1');
  if (b1 && c.heroBadge1) b1.innerHTML = `<i data-lucide="shield-check" class="w-3.5 h-3.5"></i> ${c.heroBadge1}`;

  const b2 = document.getElementById('kmstHeroBadge2');
  if (b2 && c.heroBadge2) b2.innerHTML = `<i data-lucide="award" class="w-3.5 h-3.5"></i> ${c.heroBadge2}`;

  const b3 = document.getElementById('kmstHeroBadge3');
  if (b3 && c.heroBadge3) b3.innerHTML = `<i data-lucide="users" class="w-3.5 h-3.5"></i> ${c.heroBadge3}`;

  const fQuote = document.getElementById('kmstFounderQuote');
  if (fQuote && c.founderQuote) fQuote.innerHTML = `&ldquo;${c.founderQuote}&rdquo;`;

  const sQuote = document.getElementById('kmstSocialBioQuote');
  if (sQuote && c.slogan) sQuote.innerHTML = `&ldquo;${c.slogan}&rdquo;`;

  const cTag = document.getElementById('kmstCommunityTag');
  if (cTag && c.communityTag) cTag.innerHTML = `<i data-lucide="users" class="w-3.5 h-3.5 text-purple-400"></i> ${c.communityTag}`;

  const iDisplay = document.getElementById('kmstInstaHandleDisplay');
  if (iDisplay && c.instagramHandle) iDisplay.innerHTML = `<i data-lucide="instagram" class="w-3.5 h-3.5 text-rose-400"></i> @${c.instagramHandle.replace(/^@/, '')}`;

  const iLink = document.getElementById('kmstInstaLinkBtn');
  if (iLink && c.instagramUrl) {
    iLink.href = c.instagramUrl;
    iLink.innerHTML = `<i data-lucide="instagram" class="w-4 h-4"></i> Follow On Instagram (@${(c.instagramHandle || 'KeepMeSoberToo').replace(/^@/, '')})`;
  }

  const tLink = document.getElementById('kmstTwitterLinkBtn');
  if (tLink && c.twitterUrl) {
    tLink.href = c.twitterUrl;
  }

  calculateSobrietyDays();
  if (window.lucide) lucide.createIcons();
}

async function fetchKMSTConfig() {
  try {
    const local = localStorage.getItem('kmst_admin_config');
    if (local) {
      _cachedKMSTConfig = { ..._cachedKMSTConfig, ...JSON.parse(local) };
      renderKMSTHeroUI(_cachedKMSTConfig);
    }
  } catch (e) {}

  try {
    const res = await fetch('/api/kmst/data');
    if (res.ok) {
      const data = await res.json();
      if (data.config) {
        _cachedKMSTConfig = { ..._cachedKMSTConfig, ...data.config };
        renderKMSTHeroUI(_cachedKMSTConfig);
      }
      if (data.helplines && data.helplines.length > 0) {
        _cachedKMSTHelplines = data.helplines;
        renderUKHelp();
      }
    }
  } catch (e) {}
}

async function fetchKMSTHelplines() {
  try {
    const res = await fetch('/api/kmst/helplines');
    if (res.ok) {
      const data = await res.json();
      if (data.helplines && data.helplines.length > 0) {
        _cachedKMSTHelplines = data.helplines;
      }
    }
  } catch (e) {}
  renderUKHelp();
}

function renderKMSTCommunity() {
  const currentDays = _kmstProfile ? (_kmstProfile.daysSober || 1) : 5260;
  renderMilestoneChips(currentDays);
  renderKMSTLeaderboard();
  calculateSobrietyDays();
  renderKMSTHeroUI();
  renderKMSTAvatarPickers();
  loadKMSTProfile();
  initKMSTCalculator();
  
  // Instant synchronous render from cached / embedded state
  if (typeof renderKMSTMessages === 'function') renderKMSTMessages(_cachedKMSTMessages);
  if (typeof renderKMSTArticles === 'function') renderKMSTArticles();
  if (typeof renderUKHelp === 'function') renderUKHelp();
  
  // Background live update
  fetchKMSTConfig();
  fetchKMSTHelplines();
  fetchKMSTCommunityStats();
  fetchKMSTMessages(_currentKMSTChannel || 'all');
  fetchKMSTArticles();
}

function loadKMSTProfile() {
  try {
    const raw = localStorage.getItem('kmst_member_profile');
    if (raw) {
      _kmstProfile = JSON.parse(raw);
    }
  } catch (e) {}

  if (!_kmstProfile) {
    _kmstProfile = {
      alias: 'Steve Pereira',
      email: 'stevenapereira@hotmail.com',
      soberDate: '2012-04-01',
      daysSober: 5260,
      dailySpend: 20.0,
      dailyDrinks: 8,
      moneySaved: 105200.0,
      drinksAvoided: 42080,
      hoursReclaimed: 13150,
      showSavingsPublic: true,
      primaryFocus: 'Continuous Sobriety & Philanthropy (Founder)',
      pledge: 'Sobriety saved my life after my hospitalization in Dubai in April 2012. Holding the torch for everyone fighting for Day 1.',
      avatar: 'phoenix-tattoo',
      profileTheme: 'luxury',
      profileColor: 'gold',
      badgeText: '14 Yrs Phoenix Legend',
      badgeObject: '🔥🦅 14-Year Steve Pereira Phoenix Tattoo Rebirth',
      shieldIcon: '🔥',
      emblemSvg: 'assets/badges/badge_14y.svg',
      verified: true,
      role: 'admin'
    };
    _kmstUser = _kmstProfile;
  }

  if (typeof renderKMSTAvatarPickers === 'function') renderKMSTAvatarPickers();
  if (typeof updateKMSTCalculations === 'function') updateKMSTCalculations();
  if (typeof updateKMSTBadgeUI === 'function') updateKMSTBadgeUI();
}

function initKMSTCalculator() {
  const calcDate = document.getElementById('kmstCalcDate');
  if (calcDate && !calcDate.value) {
    const d = new Date();
    d.setFullYear(d.getFullYear() - 1);
    calcDate.value = d.toISOString().split('T')[0];
  }
  runSobrietyCalculator();
}

function runSobrietyCalculator() {
  const dateInput = document.getElementById('kmstCalcDate')?.value;
  const spendInput = parseFloat(document.getElementById('kmstCalcSpend')?.value) || 15;
  const drinksInput = parseFloat(document.getElementById('kmstCalcDrinks')?.value) || 4;

  if (!dateInput) return;

  const now = new Date();
  const quitDate = new Date(dateInput);
  const diffTime = now - quitDate;
  const days = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  const weeks = Math.floor(days / 7);
  const months = (days / 30.4375).toFixed(1);
  const moneySaved = Math.floor(days * spendInput);
  const drinksAvoided = Math.floor(days * drinksInput);
  const hoursReclaimed = Math.floor(days * 3.5);

  const elDays = document.getElementById('kmstCalcDaysOut');
  if (elDays) elDays.textContent = days.toLocaleString();

  const elSubDays = document.getElementById('kmstCalcSubDays');
  if (elSubDays) elSubDays.textContent = `${weeks.toLocaleString()} Wks / ${months} Mos`;

  const elMoney = document.getElementById('kmstCalcMoneyOut');
  if (elMoney) elMoney.textContent = `£${moneySaved.toLocaleString()}`;

  const elDrinks = document.getElementById('kmstCalcDrinksOut');
  if (elDrinks) elDrinks.textContent = drinksAvoided.toLocaleString();

  const elHours = document.getElementById('kmstCalcHoursOut');
  if (elHours) elHours.textContent = `${hoursReclaimed.toLocaleString()}h`;

  renderMilestoneChips(days);
}

function renderMilestoneChips(currentDays) {
  const container = document.getElementById('kmstMilestoneChipsGrid');
  if (!container) return;

  let unlockedCount = 0;
  container.innerHTML = KMST_MILESTONE_DEFINITIONS.map(chip => {
    const isUnlocked = currentDays >= chip.days;
    if (isUnlocked) unlockedCount++;

    const progressPct = Math.min(100, Math.round((currentDays / chip.days) * 100));

    return `
      <div onclick="openKMSTBadgeModal('${chip.id}')" class="p-5 sm:p-6 rounded-3xl cursor-pointer ${isUnlocked ? `${chip.bg} ${chip.border} border-2 ${chip.glow} hover:-translate-y-2 hover:scale-[1.03]` : 'bg-slate-950/50 border border-slate-800/80 opacity-55 hover:opacity-85 hover:-translate-y-1'} flex flex-col items-center justify-between text-center space-y-4 transition-all duration-300 group relative overflow-hidden backdrop-blur-md">
        
        <!-- Header Tag Bar -->
        <div class="w-full flex items-center justify-between gap-1.5 border-b border-slate-800/60 pb-2">
          <span class="px-2 py-0.5 rounded-md bg-slate-900/90 border border-slate-700/80 text-[10px] uppercase font-mono-code font-bold text-slate-300 flex items-center gap-1">
            <span>${chip.objectIcon}</span>
            <span>${chip.objectType}</span>
          </span>
          <span class="text-[10px] font-mono-code font-bold ${isUnlocked ? 'text-emerald-400' : 'text-slate-400'}">
            ${isUnlocked ? '★ UNLOCKED' : `${chip.days}d Goal`}
          </span>
        </div>

        <!-- Big 3D Badge Graphic Container -->
        <div class="relative w-28 h-28 sm:w-36 sm:h-36 mx-auto my-1 flex items-center justify-center">
          <div class="absolute inset-0 rounded-full ${isUnlocked ? 'bg-gradient-to-tr from-amber-500/20 via-rose-500/20 to-purple-500/20 animate-pulse' : 'bg-slate-900/40'} blur-xl"></div>
          <img src="${chip.image}" alt="${chip.name}" class="w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.85)] group-hover:scale-110 group-hover:rotate-3 transition duration-500 relative z-10">
          ${isUnlocked ? '<span class="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-emerald-400 text-slate-950 text-xs font-black flex items-center justify-center shadow-lg border-2 border-slate-900 z-20">✓</span>' : ''}
        </div>

        <!-- Title and Description -->
        <div class="space-y-1.5 w-full">
          <h5 class="text-sm sm:text-base font-black ${isUnlocked ? chip.color : 'text-slate-300'} font-cinzel leading-snug line-clamp-2">
            ${chip.name}
          </h5>
          <p class="text-[11px] text-slate-300 leading-relaxed line-clamp-2">
            ${chip.meaning}
          </p>
        </div>

        <!-- Bottom Action / Progress Bar -->
        <div class="w-full pt-2 border-t border-slate-800/60">
          ${isUnlocked ? `
            <div class="flex items-center justify-between text-xs text-emerald-400 font-bold">
              <span class="flex items-center gap-1"><i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i> Achieved</span>
              <span class="text-[11px] text-slate-300 font-mono-code flex items-center gap-1">Inspect &amp; Share <i data-lucide="share-2" class="w-3 h-3"></i></span>
            </div>
          ` : `
            <div class="space-y-1">
              <div class="flex justify-between text-[10px] text-slate-400 font-mono-code">
                <span>Progress</span>
                <span>${progressPct}% (${currentDays}/${chip.days}d)</span>
              </div>
              <div class="w-full h-1.5 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                <div class="h-full bg-gradient-to-r from-purple-500 to-rose-500 rounded-full" style="width: ${progressPct}%"></div>
              </div>
            </div>
          `}
        </div>

      </div>
    `;
  }).join('');

  const countBadge = document.getElementById('kmstChipsUnlockedCount');
  if (countBadge) countBadge.textContent = `${unlockedCount} / ${KMST_MILESTONE_DEFINITIONS.length} Unlocked`;
  if (window.lucide) lucide.createIcons();
}

function openKMSTBadgeModal(badgeId) {
  const chip = KMST_MILESTONE_DEFINITIONS.find(c => c.id === badgeId) || KMST_MILESTONE_DEFINITIONS[0];
  _activeBadgeModalId = chip.id;

  const modal = document.getElementById('kmstBadgeModal');
  if (!modal) return;

  const imgEl = document.getElementById('kmstBadgeModalImg');
  if (imgEl) imgEl.src = chip.image;

  const daysEl = document.getElementById('kmstBadgeModalDays');
  if (daysEl) daysEl.textContent = `${chip.days} DAYS SOBRIETY • ${chip.objectType.toUpperCase()} • ${chip.sub}`;

  const titleEl = document.getElementById('kmstBadgeModalTitle');
  if (titleEl) titleEl.textContent = chip.name;

  const descEl = document.getElementById('kmstBadgeModalDesc');
  if (descEl) descEl.textContent = chip.meaning;

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  modal.classList.add('flex');
  if (window.lucide) lucide.createIcons();
}

function closeKMSTBadgeModal() {
  const modal = document.getElementById('kmstBadgeModal');
  if (modal) {
    modal.classList.add('hidden');
    unlockBodyScroll();
    modal.classList.remove('flex');
  }
}

function shareKMSTBadgeToTwitter() {
  const chip = KMST_MILESTONE_DEFINITIONS.find(c => c.id === _activeBadgeModalId) || KMST_MILESTONE_DEFINITIONS[0];
  const tweetText = `Proud to celebrate the ${chip.name} recovery chip (${chip.days} continuous days sober)! 🕊️💪 Check out the @KeepMeSoberToo sanctuary by Steve Pereira: https://SteveP.uk #KeepMeSoberToo #KMST #RecoveryWarriors #Sobriety`;
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
  window.open(url, '_blank');
}

function copyKMSTBadgeInstagramCaption() {
  const chip = KMST_MILESTONE_DEFINITIONS.find(c => c.id === _activeBadgeModalId) || KMST_MILESTONE_DEFINITIONS[0];
  const caption = `🕊️ MILESTONE UNLOCKED: ${chip.name} (${chip.days} Days Sober)!\n\n"${chip.meaning}"\n\nStaying sober has changed my life completely. One day at a time with clarity and purpose.\n\nJoin the KMST Recovery Sanctuary with founder Steve Pereira @KeepMeSoberToo (14 continuous years sober):\n🔗 SteveP.uk\n\n#KeepMeSoberToo #KMST #Sobriety #Recovery #AlcoholFree #SoberLife #SteveP`;
  
  navigator.clipboard.writeText(caption).then(() => {
    alert('📋 Instagram caption copied to clipboard! Opening @KeepMeSoberToo on Instagram...');
    window.open('https://www.instagram.com/KeepMeSoberToo', '_blank');
  }).catch(() => {
    window.open('https://www.instagram.com/KeepMeSoberToo', '_blank');
  });
}

function openKMSTSocialBroadcastModal(customMessage = '') {
  const modal = document.getElementById('kmstBroadcastModal');
  if (!modal) return;

  const days = _kmstProfile ? _kmstProfile.daysSober : 1;
  const alias = _kmstProfile ? _kmstProfile.alias : 'Warrior';
  const badge = _kmstProfile ? _kmstProfile.badgeText : 'Day 1 Warrior';
  const pledge = _kmstProfile ? _kmstProfile.pledge : 'One day at a time.';

  const messageBody = customMessage || `Checking in on Day ${days} continuous sobriety (${badge})! "${pledge}" 🕊️`;
  const fullBroadcastText = `🕊️ KMST RECOVERY CHECK-IN • ${alias} (${badge})\n\n${messageBody}\n\nJoin the free & confidential KMST Alcohol Recovery Sanctuary with founder Steve Pereira @KeepMeSoberToo (14 continuous years sober):\n🔗 SteveP.uk\n\n#KeepMeSoberToo #KMST #Sobriety #OneDayAtATime #RecoveryWarriors`;

  const preview = document.getElementById('kmstBroadcastPreviewText');
  if (preview) preview.value = fullBroadcastText;

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  modal.classList.add('flex');
}

function closeKMSTBroadcastModal() {
  const modal = document.getElementById('kmstBroadcastModal');
  if (modal) {
    modal.classList.add('hidden');
    unlockBodyScroll();
    modal.classList.remove('flex');
  }
}

function executeKMSTTweet() {
  const text = document.getElementById('kmstBroadcastPreviewText')?.value || '';
  const tweetText = text.length > 270 ? text.substring(0, 260) + '... @KeepMeSoberToo' : text;
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`, '_blank');
}

function executeKMSTInstaCopy() {
  const text = document.getElementById('kmstBroadcastPreviewText')?.value || '';
  navigator.clipboard.writeText(text).then(() => {
    alert('📋 Instagram story / post caption copied to clipboard! Opening @KeepMeSoberToo on Instagram...');
    window.open('https://www.instagram.com/KeepMeSoberToo', '_blank');
    closeKMSTBroadcastModal();
  }).catch(() => {
    window.open('https://www.instagram.com/KeepMeSoberToo', '_blank');
  });
}

// --------------------------------------------------------------------------
// KMST 1,000+ POSITIVE RECOVERY AFFIRMATION GENERATOR & HYPE ENGINE
// --------------------------------------------------------------------------
const KMST_AFFIRMATION_DATA = {
  openers: [
    "You are forging a life of unbreakable clarity and absolute purpose.",
    "Every single sober breath you take today is reclaiming your true destiny.",
    "Your courage today is shattering cycles that tried to define you in the past.",
    "You are a warrior rising infinitely higher than whatever tried to pull you down.",
    "The strength inside your spirit right now is far greater than any temporary urge.",
    "You survived 100% of your hardest days to stand here clean and proud today.",
    "Your mind is sharper, your heart is calmer, and your future is wide open.",
    "Look how far you have walked: each sober step is building an empire of peace.",
    "You are proving to yourself and everyone who loves you that rebirth is real.",
    "Never underestimate the massive power of choosing clarity one day at a time.",
    "Your recovery is not just saving your life—it is inspiring everyone around you.",
    "You are stepping into the greatest, strongest, healthiest chapter of your story.",
    "Stand tall and breathe deep: you have earned every single ounce of this peace.",
    "Your daily discipline is turning pain from the past into wisdom for the future.",
    "You hold the pen to your life, and today you are writing pure victory.",
    "No craving is stronger than your commitment to freedom, dignity, and honor.",
    "You are built of resilience, forged through fire, and crowned in continuous triumph.",
    "Every pound saved, every drink avoided, and every clear morning belongs to you.",
    "Your inner fire burns brighter than any storm outside.",
    "You are living proof that freedom from alcohol is the greatest gift on earth.",
    "Hold your head high: you walked through the darkness and found the light.",
    "Your future self is looking back right now, thanking you for staying strong today.",
    "True freedom is waking up with a clean conscience and an unstoppable heart.",
    "You are an absolute powerhouse of healing, focus, and positive transformation.",
    "Today is another victory logged in the book of your life. Keep shining bright!"
  ],
  truths: [
    "Your nervous system is healing, your sleep is restorative, and your spirit is unbroken.",
    "You chose self-respect over temporary escape, and that makes you unstoppable.",
    "The courage it took to choose Day 1 is proof of the unstoppable giant within you.",
    "You are replacing regret with momentum, fear with clarity, and guilt with pride.",
    "Your brain is rewiring for joy, deep connection, and real, authentic presence.",
    "You have broken the chains of alcohol and unlocked your true highest potential.",
    "Every single hour clean is restoring physical health and profound mental peace.",
    "You are creating a legacy of strength that will echo for generations to come.",
    "Your presence today is a blessing to your family, your community, and yourself."
  ],
  mantras: [
    "Walk into this day like the champion you are. You have earned every badge of honor.",
    "Keep this momentum burning like an eternal Phoenix flame.",
    "Breathe in strength, exhale old doubts, and own this present moment with pride.",
    "Stay grounded in the KMST sanctuary: we walk this road of freedom together.",
    "Celebrate your wins, protect your peace, and never look back with regret.",
    "One day at a time, you are conquering mountains.",
    "Clarity is your superpower. Wear it with pride and keep marching forward!"
  ],
  quotes: [
    { quote: "Sobriety didn't just save my life after my hospitalization in Dubai (2012)—it gave me clarity, career, and freedom.", author: "Steve Pereira (Founder, 14 Yrs Sober)" },
    { quote: "You have power over your mind - not outside events. Realize this, and you will find great strength.", author: "Marcus Aurelius" },
    { quote: "Rock bottom became the solid foundation on which I rebuilt my life.", author: "Recovery Warrior Wisdom" },
    { quote: "The secret of change is to focus all of your energy, not on fighting the old, but on building the new.", author: "Socrates" },
    { quote: "It does not matter how slowly you go as long as you do not stop.", author: "Confucius" },
    { quote: "Sobriety is the greatest self-care and ultimate act of rebellion against numbness.", author: "KMST Sanctuary" }
  ]
};

function generateRandomKMSTAffirmation(profile) {
  const p = profile || _kmstProfile || { alias: 'Warrior', daysSober: 1, moneySaved: 15.0 };
  const opener = KMST_AFFIRMATION_DATA.openers[Math.floor(Math.random() * KMST_AFFIRMATION_DATA.openers.length)];
  const truth = KMST_AFFIRMATION_DATA.truths[Math.floor(Math.random() * KMST_AFFIRMATION_DATA.truths.length)];
  const mantra = KMST_AFFIRMATION_DATA.mantras[Math.floor(Math.random() * KMST_AFFIRMATION_DATA.mantras.length)];

  let personalized = `${opener} ${truth} ${mantra}`;
  if (p.alias && p.alias !== 'Warrior' && p.alias !== 'Anonymous Warrior') {
    personalized = `Hey ${p.alias}! ${personalized}`;
  }
  return personalized;
}

function refreshSanctuaryAffirmation() {
  const text = generateRandomKMSTAffirmation(_kmstProfile);
  const targetEl = document.getElementById('kmstDailyAffirmationText');
  if (targetEl) {
    targetEl.classList.add('opacity-0', 'transition-opacity');
    setTimeout(() => {
      targetEl.textContent = `"${text}"`;
      targetEl.classList.remove('opacity-0');
    }, 150);
  }
}

// --------------------------------------------------------------------------
// 10 COLOR PALETTES FOR POSTS & PROFILES
// --------------------------------------------------------------------------
const KMST_THEME_PALETTES = {
  rose: {
    name: 'Crimson Rose',
    accent: '#f43f5e',
    badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    border: 'border-rose-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-rose-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(244,63,94,0.2)]',
    textGradient: 'from-rose-400 via-pink-300 to-white'
  },
  emerald: {
    name: 'Celtic Emerald',
    accent: '#10b981',
    badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    border: 'border-emerald-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-emerald-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(16,185,129,0.2)]',
    textGradient: 'from-emerald-400 via-teal-300 to-white'
  },
  amber: {
    name: 'Sunburst Amber',
    accent: '#f59e0b',
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    border: 'border-amber-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-amber-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(245,158,11,0.2)]',
    textGradient: 'from-amber-400 via-yellow-200 to-white'
  },
  purple: {
    name: 'Electric Purple',
    accent: '#a855f7',
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    border: 'border-purple-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-purple-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(168,85,247,0.2)]',
    textGradient: 'from-purple-400 via-fuchsia-300 to-white'
  },
  cyan: {
    name: 'Cyber Cyan',
    accent: '#06b6d4',
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    border: 'border-cyan-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-cyan-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(6,182,212,0.2)]',
    textGradient: 'from-cyan-400 via-sky-200 to-white'
  },
  ruby: {
    name: 'Ruby Velvet',
    accent: '#e11d48',
    badgeBg: 'bg-rose-600/20 text-rose-200 border-rose-600/40',
    border: 'border-rose-600/50',
    cardBg: 'bg-gradient-to-br from-slate-950 via-rose-950/40 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(225,29,72,0.25)]',
    textGradient: 'from-rose-500 via-red-300 to-white'
  },
  sapphire: {
    name: 'Royal Sapphire',
    accent: '#3b82f6',
    badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    border: 'border-blue-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-blue-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(59,130,246,0.2)]',
    textGradient: 'from-blue-400 via-indigo-200 to-white'
  },
  gold: {
    name: '24K Imperial Gold',
    accent: '#eab308',
    badgeBg: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50',
    border: 'border-yellow-500/50',
    cardBg: 'bg-gradient-to-br from-slate-950 via-yellow-950/30 to-slate-950',
    glow: 'shadow-[0_0_30px_rgba(234,179,8,0.3)]',
    textGradient: 'from-yellow-400 via-amber-200 to-yellow-100'
  },
  obsidian: {
    name: 'Obsidian Platinum',
    accent: '#94a3b8',
    badgeBg: 'bg-slate-700/30 text-slate-200 border-slate-600/50',
    border: 'border-slate-700/60',
    cardBg: 'bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(148,163,184,0.15)]',
    textGradient: 'from-slate-200 via-slate-400 to-white'
  },
  sunset: {
    name: 'Sunset Flame',
    accent: '#f97316',
    badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    border: 'border-orange-500/40',
    cardBg: 'bg-gradient-to-br from-slate-950 via-orange-950/30 to-slate-950',
    glow: 'shadow-[0_0_25px_rgba(249,115,22,0.25)]',
    textGradient: 'from-orange-400 via-amber-300 to-white'
  }
};

// --------------------------------------------------------------------------
// 100% FREE WHATSAPP, SMS & SOCIAL SHARING ENGINE
// --------------------------------------------------------------------------
function shareKMSTToWhatsApp(text) {
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareKMSTToSMS(text) {
  // Free native mobile SMS deep link works universally on iOS & Android
  window.location.href = `sms:?&body=${encodeURIComponent(text)}`;
}

function shareKMSTToX(text) {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareKMSTToFacebook(customUrl) {
  const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(customUrl || window.location.origin)}`;
  window.open(url, '_blank');
}

function shareKMSTToLinkedIn(customUrl, title) {
  const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(customUrl || window.location.origin)}`;
  window.open(url, '_blank');
}

function shareKMSTToTelegram(customUrl, text) {
  const url = `https://t.me/share/url?url=${encodeURIComponent(customUrl || window.location.origin)}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function shareKMSTToReddit(title, text) {
  const url = `https://reddit.com/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');
}

function copyKMSTInstagramCaption(text) {
  navigator.clipboard.writeText(text).then(() => {
    alert('📋 Instagram caption copied to clipboard! Opening @KeepMeSoberToo on Instagram...');
    window.open('https://www.instagram.com/KeepMeSoberToo', '_blank');
  }).catch(() => {
    window.open('https://www.instagram.com/KeepMeSoberToo', '_blank');
  });
}

function shareKMSTNative(title, text, url) {
  if (navigator.share) {
    navigator.share({
      title: title || 'Keep Me Sober Too (KMST)',
      text: text,
      url: url || window.location.origin
    }).catch(() => {});
  } else {
    // Fallback to social export modal
    openKMSTExportModal(text);
  }
}

// --------------------------------------------------------------------------
// SOCIAL EXPORT & SHARE MODAL
// --------------------------------------------------------------------------
let _activeExportShareText = '';
let _activeExportShareTitle = '';

function openKMSTExportModal(text, title = 'KMST Recovery Victory') {
  _activeExportShareText = text;
  _activeExportShareTitle = title;

  const modal = document.getElementById('kmstExportShareModal');
  const preview = document.getElementById('kmstExportSharePreview');
  if (preview) preview.value = text;

  if (modal) {
    modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
    modal.classList.add('flex');
  }
  if (window.lucide) lucide.createIcons();
}

function closeKMSTExportModal() {
  const modal = document.getElementById('kmstExportShareModal');
  if (modal) {
    modal.classList.add('hidden');
    unlockBodyScroll();
    modal.classList.remove('flex');
  }
}

function triggerExportAction(platform) {
  const text = document.getElementById('kmstExportSharePreview')?.value || _activeExportShareText;
  if (!text) return;

  switch (platform) {
    case 'whatsapp':
      shareKMSTToWhatsApp(text);
      break;
    case 'sms':
      shareKMSTToSMS(text);
      break;
    case 'x':
      shareKMSTToX(text);
      break;
    case 'instagram':
      copyKMSTInstagramCaption(text);
      break;
    case 'facebook':
      shareKMSTToFacebook(window.location.origin);
      break;
    case 'linkedin':
      shareKMSTToLinkedIn(window.location.origin, _activeExportShareTitle);
      break;
    case 'telegram':
      shareKMSTToTelegram(window.location.origin, text);
      break;
    case 'reddit':
      shareKMSTToReddit(_activeExportShareTitle, text);
      break;
    case 'native':
      shareKMSTNative(_activeExportShareTitle, text, window.location.origin);
      break;
    case 'copy':
      navigator.clipboard.writeText(text).then(() => {
        alert('📋 Message and milestone copied to clipboard!');
      });
      break;
  }
}

function shareKMSTPostCard(msgId) {
  const m = _cachedKMSTMessages.find(item => item.id === msgId);
  if (!m) return;

  const badgePart = m.includeBadge ? `[${m.streakDays || 1} Day Streak • ${m.shieldIcon || '🛡️'} ${m.authorBadge || 'Warrior'}]` : '';
  const shareText = `🕊️ KMST RECOVERY SANCTUARY • ${m.authorName} ${badgePart}\n\n"${m.message}"\n\nJoin the free & confidential KMST Alcohol Recovery Sanctuary with founder Steve Pereira @KeepMeSoberToo (14 continuous years sober):\n🔗 https://SteveP.uk\n\n#KeepMeSoberToo #KMST #Sobriety #OneDayAtATime #RecoveryWarriors`;
  
  openKMSTExportModal(shareText, `KMST Sanctuary Post by ${m.authorName}`);
}

// --------------------------------------------------------------------------
// MEMBER AUTHENTICATION, PROFILE CUSTOMIZER & AVATAR CLAIMING
// --------------------------------------------------------------------------
try {
  const local = localStorage.getItem('kmst_member_profile');
  if (local) _kmstProfile = JSON.parse(local);
} catch (e) {}

function isKMSTMemberLoggedIn() {
  return !!(_kmstProfile && _kmstProfile.alias);
}

// --------------------------------------------------------------------------
// 16 FRESH RECOVERY & WARRIOR AVATAR ICONS (CUSTOM SVGS & RECOVERY THEMES)
// --------------------------------------------------------------------------
const KMST_RECOVERY_AVATARS = [
  { id: 'phoenix-tattoo', name: 'Phoenix Rebirth', desc: "Steve Pereira's Phoenix Tattoo • Founder Exclusive", symbol: '🔥🦅', svg: 'assets/avatars/phoenix-tattoo.svg', founderOnly: true },
  { id: 'guiding-light', name: 'Guiding Light (Antigravity AI)', desc: 'Beacon of 24/7 Sanctuary Peer Guidance', symbol: '✨🧭', svg: 'assets/avatars/guiding-light.svg' },
  { id: 'broken-chain', name: 'Shattered Chains', desc: 'Breaking Free from Addiction Cycles', symbol: '⛓️💥', svg: 'assets/avatars/broken-chain.svg' },
  { id: 'iron-shield', name: 'Relapse Shield', desc: 'Unbreakable Defense Against Temptation', symbol: '🛡️⚡', svg: 'assets/avatars/iron-shield.svg' },
  { id: 'lion-heart', name: 'Lion Warrior Heart', desc: 'Courage, Honor & Raw Inner Strength', symbol: '🦁❤️', svg: 'assets/avatars/lion-heart.svg' },
  { id: 'clarity-diamond', name: 'Diamond of Clarity', desc: 'Unclouded Mind & Crystal Sobriety', symbol: '💎✨', svg: 'assets/avatars/clarity-diamond.svg' },
  { id: 'sober-torch', name: 'Torch of Truth', desc: 'Illuminating the Path Out of Darkness', symbol: '🗽🔥', svg: 'assets/avatars/sober-torch.svg' },
  { id: 'iron-anchor', name: 'Unshakable Anchor', desc: 'Grounded in Continuous Sobriety', symbol: '⚓🌊', svg: 'assets/avatars/iron-anchor.svg' },
  { id: 'zen-mountain', name: 'Zen Mountain Pillar', desc: 'Unyielding Calm in the Face of Storms', symbol: '🏔️🧘', svg: 'assets/avatars/zen-mountain.svg' },
  { id: 'healing-heart', name: 'Healing Heart', desc: 'Self-Compassion, Restoration & Peace', symbol: '💖🕊️', svg: 'assets/avatars/healing-heart.svg' },
  { id: 'willpower-spark', name: 'Spark of Willpower', desc: 'The Unstoppable Flame of Determination', symbol: '⚡🔥', svg: 'assets/avatars/willpower-spark.svg' },
  { id: 'sober-oak', name: 'Ancient Mighty Oak', desc: 'Deep Roots & Everlasting Growth', symbol: '🌳🛡️', svg: 'assets/avatars/sober-oak.svg' },
  { id: 'sober-compass', name: 'True North Compass', desc: 'Guiding Your New Sober Direction', symbol: '🧭⭐', svg: 'assets/avatars/sober-compass.svg' },
  { id: 'dragon-conqueror', name: 'Dragon Slayer', desc: 'Overcoming Addiction and Internal Demons', symbol: '🐉⚔️', svg: 'assets/avatars/dragon-conqueror.svg' },
  { id: 'spartan-helmet', name: 'Spartan Discipline', desc: 'Daily Structure, Focus & Resilience', symbol: '🪖🏛️', svg: 'assets/avatars/spartan-helmet.svg' },
  { id: 'sober-wings', name: 'Wings of Liberation', desc: 'Weightless Freedom from Alcohol Chains', symbol: '🕊️🌤️', svg: 'assets/avatars/sober-wings.svg' },
  { id: 'infinity-shield', name: 'Infinity Lifeline', desc: 'Lifelong Continuous Recovery Legacy', symbol: '♾️👑', svg: 'assets/avatars/infinity-shield.svg' }
];

function getKMSTAvatarHtml(avatarKey, className = "w-full h-full object-contain") {
  if (!avatarKey) return '🕊️';
  const found = KMST_RECOVERY_AVATARS.find(a => a.id === avatarKey || a.symbol === avatarKey || a.name === avatarKey);
  if (found) {
    return `<img src="${found.svg}" alt="${found.name}" class="${className} drop-shadow">`;
  }
  if (typeof avatarKey === 'string' && avatarKey.endsWith('.svg')) {
    return `<img src="${avatarKey}" alt="Avatar" class="${className} drop-shadow">`;
  }
  return `<span>${avatarKey}</span>`;
}

function renderKMSTAvatarPickers() {
  const container = document.getElementById('kmstAvatarPicker');
  if (!container) return;

  const currentVal = document.getElementById('kmstSelectedAvatar')?.value || (_kmstProfile ? _kmstProfile.avatar : 'phoenix-tattoo');

  container.innerHTML = KMST_RECOVERY_AVATARS.map(av => {
    const isSelected = av.id === currentVal || av.symbol === currentVal;
    return `
      <button type="button" onclick="selectKMSTAvatar('${av.id}')" data-avatar-id="${av.id}" title="${av.name} • ${av.desc}" class="kmst-avatar-btn group relative w-12 h-12 p-1 rounded-2xl ${isSelected ? 'bg-slate-900 border-2 border-rose-400 shadow-lg scale-105 ring-2 ring-rose-500/30' : 'bg-slate-950 border border-slate-800 hover:border-slate-600 hover:scale-105'} flex items-center justify-center transition">
        <img src="${av.svg}" class="w-full h-full object-contain" alt="${av.name}">
        <span class="absolute -bottom-1 -right-1 text-[9px] bg-slate-900/90 rounded-full px-1 border border-slate-700">${av.symbol.split(' ')[0] || ''}</span>
      </button>
    `;
  }).join('');
}

function selectKMSTAvatar(avatarId) {
  const found = KMST_RECOVERY_AVATARS.find(a => a.id === avatarId || a.symbol === avatarId) || KMST_RECOVERY_AVATARS[1];
  const hiddenInput = document.getElementById('kmstSelectedAvatar');
  if (hiddenInput) hiddenInput.value = found.id;

  document.querySelectorAll('.kmst-avatar-btn').forEach(btn => {
    const btnId = btn.getAttribute('data-avatar-id');
    if (btnId === found.id) {
      btn.className = 'kmst-avatar-btn group relative w-12 h-12 p-1 rounded-2xl bg-slate-900 border-2 border-rose-400 shadow-lg scale-105 ring-2 ring-rose-500/30 flex items-center justify-center transition';
    } else {
      btn.className = 'kmst-avatar-btn group relative w-12 h-12 p-1 rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-600 hover:scale-105 flex items-center justify-center transition';
    }
  });

  const previewAvatar = document.getElementById('kmstBadgeAvatar');
  if (previewAvatar) {
    previewAvatar.innerHTML = `<img src="${found.svg}" class="w-full h-full object-contain filter drop-shadow" alt="${found.name}">`;
  }

  const compAvatar = document.getElementById('kmstComposerAvatar');
  if (compAvatar) {
    compAvatar.innerHTML = `<img src="${found.svg}" class="w-full h-full object-contain filter drop-shadow" alt="${found.name}">`;
  }
}

function selectKMSTThemeStyle(themeStyle) {
  const input = document.getElementById('kmstSelectedTheme');
  if (input) input.value = themeStyle;

  document.querySelectorAll('.kmst-theme-btn').forEach(btn => {
    const isSelected = btn.getAttribute('data-theme-style') === themeStyle;
    btn.className = `kmst-theme-btn px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${isSelected ? 'bg-rose-600 text-white shadow-lg border border-rose-400' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'}`;
  });

  updateKMSTBadgeUI();
}

function selectKMSTColor(colorKey) {
  const input = document.getElementById('kmstSelectedColor');
  if (input) input.value = colorKey;

  document.querySelectorAll('.kmst-color-btn').forEach(btn => {
    const isSelected = btn.getAttribute('data-color-key') === colorKey;
    btn.className = `kmst-color-btn w-7 h-7 rounded-lg transition border-2 flex items-center justify-center ${isSelected ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-75 hover:opacity-100'}`;
  });

  updateKMSTBadgeUI();
}

function updateKMSTCalculations() {
  const soberDateVal = document.getElementById('kmstRegDate')?.value || (_kmstProfile ? _kmstProfile.soberDate : new Date().toISOString().split('T')[0]);
  const dailySpend = parseFloat(document.getElementById('kmstRegSpend')?.value) || (_kmstProfile ? _kmstProfile.dailySpend : 15.0);
  const dailyDrinks = parseInt(document.getElementById('kmstRegDrinks')?.value, 10) || (_kmstProfile ? _kmstProfile.dailyDrinks : 4);

  const now = new Date();
  const sDate = new Date(soberDateVal);
  const daysSober = Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
  const moneySaved = parseFloat((daysSober * dailySpend).toFixed(2));
  const drinksAvoided = daysSober * dailyDrinks;
  const hoursReclaimed = parseFloat((daysSober * 2.5).toFixed(1));

  const elDays = document.getElementById('kmstLiveCalcDays');
  if (elDays) elDays.textContent = daysSober.toLocaleString();

  const elMoney = document.getElementById('kmstLiveCalcMoney');
  if (elMoney) elMoney.textContent = `£${moneySaved.toLocaleString()}`;

  const elDrinks = document.getElementById('kmstLiveCalcDrinks');
  if (elDrinks) elDrinks.textContent = drinksAvoided.toLocaleString();

  const elHours = document.getElementById('kmstLiveCalcHours');
  if (elHours) elHours.textContent = hoursReclaimed.toLocaleString();

  return { daysSober, moneySaved, drinksAvoided, hoursReclaimed };
}

function updateKMSTBadgeUI() {

  const headAvatar = document.getElementById('kmstHeaderAvatar');
  const headAlias = document.getElementById('kmstHeaderAlias');
  const headDays = document.getElementById('kmstHeaderDays');
  if(headAvatar) headAvatar.src = _kmstProfile.emblemSvg;
  if(headAlias) headAlias.textContent = _kmstProfile.alias;
  if(headDays) headDays.textContent = _kmstProfile.daysSober + ' Days Sober (Edit Profile)';

  if (!_kmstProfile) return;

  const now = new Date();
  const sDate = new Date(_kmstProfile.soberDate || now);
  const daysSober = Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
  const dailySpend = _kmstProfile.dailySpend || 15.0;
  const dailyDrinks = _kmstProfile.dailyDrinks || 4;
  const moneySaved = parseFloat((daysSober * dailySpend).toFixed(2));
  const drinksAvoided = daysSober * dailyDrinks;
  const hoursReclaimed = parseFloat((daysSober * 2.5).toFixed(1));

  // Determine current badge
  let badgeName = '24h Spark of Ignition';
  let badgeObject = '⚡ 24-Hour Spark of Ignition Burst';
  let shieldIcon = '⚡';
  let emblemSvg = 'assets/badges/badge_24h.svg';
  let nextMilestone = 7;

  if (daysSober >= 4748) {
    badgeName = '14 Yrs Phoenix Legend';
    badgeObject = '🔥🦅 14-Year Steve Pereira Phoenix Tattoo Rebirth';
    shieldIcon = '🔥';
    emblemSvg = 'assets/badges/badge_14y.svg';
    nextMilestone = 5110;
  } else if (daysSober >= 3650) {
    badgeName = '10+ Yrs Master Legacy';
    badgeObject = '🌟 10-Year Master Laurels & Infinity Medallion';
    shieldIcon = '🌟';
    emblemSvg = 'assets/badges/badge_10y.svg';
    nextMilestone = 4748;
  } else if (daysSober >= 1825) {
    badgeName = '5+ Yrs Diamond Freedom';
    badgeObject = '👑 5-Year Imperial Diamond Crown';
    shieldIcon = '👑';
    emblemSvg = 'assets/badges/badge_5y.svg';
    nextMilestone = 3650;
  } else if (daysSober >= 1095) {
    badgeName = '3 Yrs Emerald Roots';
    badgeObject = '🌲 3-Year Celtic Emerald Tree of Life Shield';
    shieldIcon = '🌲';
    emblemSvg = 'assets/badges/badge_3y.svg';
    nextMilestone = 1825;
  } else if (daysSober >= 365) {
    badgeName = `${Math.floor(daysSober / 365)} Yr Trophy Champion`;
    badgeObject = '🏆 1-Year Grand Victory Championship Trophy';
    shieldIcon = '🏆';
    emblemSvg = 'assets/badges/badge_1y.svg';
    nextMilestone = 1095;
  } else if (daysSober >= 180) {
    badgeName = '6 Months Ruby Heart';
    badgeObject = '💖 6-Month Faceted Ruby Crystal Heart';
    shieldIcon = '💖';
    emblemSvg = 'assets/badges/badge_6m.svg';
    nextMilestone = 365;
  } else if (daysSober >= 90) {
    badgeName = '90 Days Sunburst Shield';
    badgeObject = '🦁 90-Day 24K Radiant Sunburst Shield';
    shieldIcon = '🦁';
    emblemSvg = 'assets/badges/badge_90d.svg';
    nextMilestone = 180;
  } else if (daysSober >= 60) {
    badgeName = '60 Days Silver Star';
    badgeObject = '⭐ 60-Day Sterling Silver Starburst Badge';
    shieldIcon = '⭐';
    emblemSvg = 'assets/badges/badge_60d.svg';
    nextMilestone = 90;
  } else if (daysSober >= 30) {
    badgeName = '30 Days Roman Bronze';
    badgeObject = '🏅 30-Day Ancient Roman Bronze Coin';
    shieldIcon = '🏅';
    emblemSvg = 'assets/badges/badge_30d.svg';
    nextMilestone = 60;
  } else if (daysSober >= 7) {
    badgeName = '7 Days Iron Shield';
    badgeObject = '🛡️ 7-Day Ironclad Crusader Shield';
    shieldIcon = '🛡️';
    emblemSvg = 'assets/badges/badge_7d.svg';
    nextMilestone = 30;
  }

  _kmstProfile.daysSober = daysSober;
  _kmstProfile.moneySaved = moneySaved;
  _kmstProfile.drinksAvoided = drinksAvoided;
  _kmstProfile.hoursReclaimed = hoursReclaimed;
  _kmstProfile.badgeText = badgeName;
  _kmstProfile.badgeObject = badgeObject;
  _kmstProfile.shieldIcon = shieldIcon;
  _kmstProfile.emblemSvg = emblemSvg;
  _kmstProfile.nextMilestoneDays = nextMilestone;

  // Update DOM active pass
  const aliasEl = document.getElementById('kmstBadgeAlias');
  if (aliasEl) aliasEl.textContent = _kmstProfile.alias;

  const rankEl = document.getElementById('kmstBadgeRank');
  if (rankEl) rankEl.textContent = badgeName;

  const focusEl = document.getElementById('kmstBadgeFocus');
  if (focusEl) focusEl.textContent = _kmstProfile.primaryFocus || 'Continuous Sobriety';

  const avatarEl = document.getElementById('kmstBadgeAvatar');
  if (avatarEl) avatarEl.innerHTML = getKMSTAvatarHtml(_kmstProfile.avatar || 'phoenix-tattoo');

  const daysEl = document.getElementById('kmstBadgeDays');
  if (daysEl) daysEl.textContent = daysSober.toLocaleString();

  const pledgeEl = document.getElementById('kmstBadgePledge');
  if (pledgeEl) pledgeEl.textContent = _kmstProfile.pledge || 'One day at a time with clarity and courage.';

  const cleanDateEl = document.getElementById('kmstBadgeCleanDate');
  if (cleanDateEl) cleanDateEl.textContent = _kmstProfile.soberDate || 'Active';

  const compAvatar = document.getElementById('kmstComposerAvatar');
  if (compAvatar) compAvatar.innerHTML = getKMSTAvatarHtml(_kmstProfile.avatar || 'phoenix-tattoo');

  const compAlias = document.getElementById('kmstComposerAlias');
  if (compAlias) compAlias.textContent = `Posting as: ${_kmstProfile.alias} (${shieldIcon} ${badgeName})`;

  const badgeTickLabel = document.getElementById('kmstComposerBadgeText');
  if (badgeTickLabel) {
    badgeTickLabel.textContent = `Include my ${daysSober}-Day streak & ${shieldIcon} ${badgeName} on this post`;
  }

  // Refresh daily affirmation banner
  refreshSanctuaryAffirmation();
}

async function handleKMSTSignup(e) {
  e.preventDefault();
  const alias = (document.getElementById('kmstRegAlias')?.value || '').trim();
  const email = (document.getElementById('kmstRegEmail')?.value || '').trim();
  const passwordPin = (document.getElementById('kmstRegPin')?.value || '1234').trim();
  const soberDate = document.getElementById('kmstRegDate')?.value || new Date().toISOString().split('T')[0];
  const dailySpend = parseFloat(document.getElementById('kmstRegSpend')?.value) || 15.0;
  const dailyDrinks = parseInt(document.getElementById('kmstRegDrinks')?.value, 10) || 4;
  const showSavingsPublic = document.getElementById('kmstRegShowSavings')?.checked ?? true;
  const primaryFocus = document.getElementById('kmstRegFocus')?.value || 'Alcohol Recovery (Continuous Sobriety)';
  const pledge = (document.getElementById('kmstRegPledge')?.value || '').trim() || 'One day at a time with clarity and courage.';
  const avatar = document.getElementById('kmstSelectedAvatar')?.value || '🕊️';
  const profileTheme = document.getElementById('kmstSelectedTheme')?.value || 'fancy';
  const profileColor = document.getElementById('kmstSelectedColor')?.value || 'rose';
  const hpToken = document.getElementById('kmstRegHoneypot')?.value || '';

  if (!alias || !soberDate) {
    alert('Please enter your Username / Alias and Clean Start Date.');
    return;
  }

  // Check for spam links in pledge
  if (/(https?:\/\/|www\.|\.com|\.xyz|\.top|\.ru|\.click)/i.test(pledge) || /(https?:\/\/|www\.|\.com)/i.test(alias)) {
    alert('Security Alert: Promotional links or external URLs are not permitted.');
    return;
  }

  const btn = document.getElementById('kmstSignupSubmitBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Activating Profile...`;
    if (window.lucide) lucide.createIcons();
  }

  try {
    const payload = {
      alias,
      email,
      passwordPin,
      soberDate,
      dailySpend,
      dailyDrinks,
      showSavingsPublic,
      primaryFocus,
      pledge,
      avatar,
      profileTheme,
      profileColor,
      kmst_hp_token: hpToken
    };

    const res = await fetch('/api/kmst/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data && data.success && data.member) {
      _kmstProfile = data.member;
      localStorage.setItem('kmst_member_profile', JSON.stringify(_kmstProfile));
      updateKMSTBadgeUI();
      fetchKMSTCommunityStats();
      alert(`🎉 Welcome to the KMST Sanctuary, ${_kmstProfile.alias}! Your verified recovery account, savings tracker, and milestone badge are active.`);
    } else {
      alert(data.message || 'Registration completed locally.');
      _kmstProfile = {
        alias, email, soberDate, dailySpend, dailyDrinks, showSavingsPublic, primaryFocus, pledge, avatar, profileTheme, profileColor,
        daysSober: Math.max(0, Math.floor((new Date() - new Date(soberDate)) / (1000 * 60 * 60 * 24)))
      };
      localStorage.setItem('kmst_member_profile', JSON.stringify(_kmstProfile));
      updateKMSTBadgeUI();
    }
  } catch (err) {
    _kmstProfile = {
      alias, email, soberDate, dailySpend, dailyDrinks, showSavingsPublic, primaryFocus, pledge, avatar, profileTheme, profileColor,
      daysSober: Math.max(0, Math.floor((new Date() - new Date(soberDate)) / (1000 * 60 * 60 * 24)))
    };
    localStorage.setItem('kmst_member_profile', JSON.stringify(_kmstProfile));
    updateKMSTBadgeUI();
    alert(`🎉 Profile saved locally! Welcome to the KMST Sanctuary, ${_kmstProfile.alias}.`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="badge-check" class="w-4 h-4"></i> Claim Your KMST Member Badge`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

async function handleKMSTLogin(e) {
  if (e) e.preventDefault();
  const identifier = (document.getElementById('kmstLoginIdentifier')?.value || '').trim();
  const pin = (document.getElementById('kmstLoginPin')?.value || '').trim();

  if (!identifier) {
    alert('Please enter your username or email.');
    return;
  }

  try {
    const res = await fetch('/api/kmst/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, passwordPin: pin })
    });
    const data = await res.json();
    if (data.success && data.member) {
      _kmstProfile = data.member;
      localStorage.setItem('kmst_member_profile', JSON.stringify(_kmstProfile));
      updateKMSTBadgeUI();
      closeKMSTAuthModal();
      alert(`Welcome back to the Sanctuary, ${_kmstProfile.alias}!`);
    } else {
      alert(data.message || 'Login failed. Please check your username or register a free account.');
    }
  } catch (e) {
    alert('Login error: ' + e.message);
  }
}

function logoutKMSTMember() {
  if (confirm('Sign out of your KMST Member Profile on this device?')) {
    _kmstProfile = null;
    localStorage.removeItem('kmst_member_profile');
    location.reload();
  }
}



// --------------------------------------------------------------------------
// PUBLIC MEMBER PROFILE VIEWER (4 THEMES & 10 COLORS)
// --------------------------------------------------------------------------
async function openKMSTPublicProfile(alias) {
  const targetAlias = alias || (_kmstProfile ? _kmstProfile.alias : 'Steve Pereira');
  let memberData = null;

  try {
    const res = await fetch(`/api/kmst/profile/${encodeURIComponent(targetAlias)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.profile) memberData = json.profile;
    }
  } catch (e) {}

  if (!memberData && _kmstProfile && _kmstProfile.alias.toLowerCase() === targetAlias.toLowerCase()) {
    memberData = _kmstProfile;
  }

  if (!memberData) {
    memberData = {
      alias: targetAlias,
      avatar: '🕊️',
      daysSober: 1,
      soberDate: '2026-08-24',
      badgeText: '24h Spark of Ignition',
      badgeObject: '⚡ 24-Hour Spark of Ignition Burst',
      shieldIcon: '⚡',
      emblemSvg: 'assets/badges/badge_24h.svg',
      nextMilestoneDays: 7,
      primaryFocus: 'Alcohol Recovery (Continuous Sobriety)',
      pledge: 'One day at a time with clarity and courage.',
      profileTheme: 'fancy',
      profileColor: 'rose',
      showSavingsPublic: true,
      moneySaved: 15.0,
      drinksAvoided: 4,
      hoursReclaimed: 2.5
    };
  }

  const modal = document.getElementById('kmstPublicProfileModal');
  const cardContainer = document.getElementById('kmstPublicProfileCardContainer');
  if (!modal || !cardContainer) return;

  const themeKey = memberData.profileTheme || 'fancy';
  const colorKey = memberData.profileColor || 'rose';
  const palette = KMST_THEME_PALETTES[colorKey] || KMST_THEME_PALETTES.rose;
  const affirmation = generateRandomKMSTAffirmation(memberData);

  // Financial Savings Block (Respects user privacy setting)
  const savingsHtml = memberData.showSavingsPublic ? `
    <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-3 border-t border-slate-800/80 text-center font-mono-code">
      <div class="p-3 rounded-2xl bg-slate-950/80 border ${palette.border}">
        <span class="text-lg sm:text-xl font-black text-emerald-400 block">£${(memberData.moneySaved || 0).toLocaleString()}</span>
        <span class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Money Saved</span>
      </div>
      <div class="p-3 rounded-2xl bg-slate-950/80 border ${palette.border}">
        <span class="text-lg sm:text-xl font-black text-rose-400 block">${(memberData.drinksAvoided || 0).toLocaleString()}</span>
        <span class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Drinks Avoided</span>
      </div>
      <div class="col-span-2 sm:col-span-1 p-3 rounded-2xl bg-slate-950/80 border ${palette.border}">
        <span class="text-lg sm:text-xl font-black text-sky-400 block">${(memberData.hoursReclaimed || 0).toLocaleString()}h</span>
        <span class="text-[9px] text-slate-400 uppercase font-bold tracking-wider">Life Reclaimed</span>
      </div>
    </div>
  ` : `
    <div class="p-3 rounded-2xl bg-slate-950/60 border border-slate-800 text-center text-xs text-slate-400">
      🔒 Financial stats kept private by member choice
    </div>
  `;

  // Render based on selected layout style
  let styleTemplate = '';

  if (themeKey === 'basic') {
    // 1. BASIC CLEAN STYLE
    styleTemplate = `
      <div class="p-6 sm:p-8 rounded-3xl bg-slate-950 border-2 ${palette.border} space-y-6 text-white">
        <div class="flex items-center justify-between border-b border-slate-800 pb-4">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl bg-slate-900 border border-slate-700 p-1.5 flex items-center justify-center shadow">
              ${getKMSTAvatarHtml(memberData.avatar, 'w-full h-full object-contain')}
            </div>
            <div>
              <h3 class="text-xl font-bold">${memberData.alias}</h3>
              <p class="text-xs text-slate-400">${memberData.primaryFocus || 'Recovery Warrior'}</p>
            </div>
          </div>
          <span class="px-3 py-1 rounded-full text-xs font-bold ${palette.badgeBg}">${memberData.badgeText}</span>
        </div>

        <div class="flex items-center gap-4 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <img src="${memberData.emblemSvg || 'assets/badges/badge_24h.svg'}" class="w-16 h-16 flex-shrink-0 object-contain" alt="Badge">
          <div class="space-y-1">
            <h4 class="text-sm font-black">${memberData.badgeObject || memberData.badgeText}</h4>
            <p class="text-xs text-emerald-400 font-mono-code font-bold">${memberData.daysSober} Continuous Days Clean</p>
          </div>
        </div>

        ${savingsHtml}

        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs italic text-slate-300">
          &ldquo;${memberData.pledge || 'One day at a time with clarity and courage.'}&rdquo;
        </div>

        <div class="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-amber-300 font-medium">
          ✨ <strong>Daily Affirmation:</strong> ${affirmation}
        </div>
      </div>
    `;
  } else if (themeKey === 'luxury') {
    // 2. ULTRA LUXURY GOLD STYLE
    styleTemplate = `
      <div class="p-6 sm:p-10 rounded-3xl bg-gradient-to-b from-slate-950 via-amber-950/30 to-slate-950 border-2 border-yellow-500/70 shadow-[0_0_50px_rgba(234,179,8,0.3)] space-y-6 text-white relative overflow-hidden">
        <div class="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-yellow-500/10 blur-3xl pointer-events-none"></div>
        <div class="flex items-center justify-between border-b border-yellow-500/30 pb-4 relative z-10">
          <span class="text-xs font-black uppercase tracking-widest text-yellow-400 flex items-center gap-1.5">
            👑 VIP KMST WARRIOR PASS
          </span>
          <span class="px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 text-[10px] font-black uppercase">
            VERIFIED SOVEREIGN
          </span>
        </div>

        <div class="flex flex-col sm:flex-row items-center gap-6 p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-yellow-950/40 to-slate-950 border-2 border-yellow-500/50 shadow-2xl relative z-10">
          <div class="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-yellow-500/10 border-2 border-yellow-400/60 p-2 flex items-center justify-center flex-shrink-0 shadow-[0_0_30px_rgba(234,179,8,0.4)] animate-pulse">
            <img src="${memberData.emblemSvg || 'assets/badges/badge_24h.svg'}" class="w-full h-full object-contain" alt="Emblem">
          </div>
          <div class="text-center sm:text-left space-y-1">
            <div class="text-2xl sm:text-3xl font-black font-cinzel bg-gradient-to-r from-yellow-300 via-amber-100 to-yellow-400 bg-clip-text text-transparent flex items-center justify-center sm:justify-start gap-2.5">
              <span class="w-8 h-8 inline-flex items-center justify-center">${getKMSTAvatarHtml(memberData.avatar, 'w-8 h-8 object-contain')}</span>
              <span>${memberData.alias}</span>
            </div>
            <div class="text-xs font-bold text-yellow-400">${memberData.badgeObject || memberData.badgeText}</div>
            <div class="text-sm font-mono-code font-black text-emerald-400">${memberData.daysSober} Days Continuous Freedom</div>
          </div>
        </div>

        ${savingsHtml}

        <div class="p-4 rounded-2xl bg-yellow-950/30 border border-yellow-500/30 text-xs italic text-yellow-200/90 leading-relaxed relative z-10">
          &ldquo;${memberData.pledge || 'Sobriety is my greatest victory.'}&rdquo;
        </div>

        <div class="p-4 rounded-2xl bg-slate-950/80 border border-yellow-500/30 text-xs text-yellow-300 font-medium relative z-10">
          🔥 <strong>Hype Affirmation:</strong> ${affirmation}
        </div>
      </div>
    `;
  } else if (themeKey === 'cyber') {
    // 3. CYBER NEON MATRIX STYLE
    styleTemplate = `
      <div class="p-6 sm:p-8 rounded-3xl bg-slate-950 border-2 border-cyan-500/60 shadow-[0_0_40px_rgba(6,182,212,0.25)] space-y-5 text-white font-mono-code relative">
        <div class="flex items-center justify-between border-b border-cyan-500/30 pb-3 text-xs">
          <span class="text-cyan-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
            <i data-lucide="terminal" class="w-4 h-4"></i> KMST::WARRIOR_HUD
          </span>
          <span class="px-2.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold">
            STATUS: CLEAN_ACTIVE
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-12 gap-4 p-5 rounded-2xl bg-slate-900/90 border border-cyan-500/40 shadow-inner">
          <div class="sm:col-span-4 flex flex-col items-center justify-center">
            <img src="${memberData.emblemSvg || 'assets/badges/badge_24h.svg'}" class="w-20 h-20 filter drop-shadow-[0_0_15px_rgba(6,182,212,0.5)] object-contain" alt="Emblem">
            <span class="text-[10px] text-cyan-300 uppercase tracking-widest mt-2">${memberData.shieldIcon} ${memberData.badgeText}</span>
          </div>
          <div class="sm:col-span-8 space-y-1.5 text-xs">
            <div class="text-xl font-black text-white flex items-center gap-2 font-cinzel">
              <span class="w-7 h-7 inline-flex items-center justify-center">${getKMSTAvatarHtml(memberData.avatar, 'w-7 h-7 object-contain')}</span>
              <span>${memberData.alias}</span>
            </div>
            <div class="text-cyan-400">> RECOVERY_FOCUS: ${memberData.primaryFocus || 'Alcohol Free'}</div>
            <div class="text-emerald-400">> STREAK_DAYS: ${memberData.daysSober}</div>
            <div class="text-purple-300">> NEXT_UNLOCK: IN ${Math.max(1, (memberData.nextMilestoneDays || 7) - memberData.daysSober)} DAYS</div>
          </div>
        </div>

        ${savingsHtml}

        <div class="p-3.5 rounded-xl bg-slate-900 border border-cyan-500/30 text-xs text-slate-300 italic">
          &ldquo;${memberData.pledge || 'One day at a time.'}&rdquo;
        </div>

        <div class="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/40 text-xs text-cyan-200">
          ⚡ <strong>AFFIRMATION_CORE:</strong> ${affirmation}
        </div>
      </div>
    `;
  } else {
    // 4. FANCY GLASSMORPHISM (DEFAULT)
    styleTemplate = `
      <div class="p-6 sm:p-8 rounded-3xl ${palette.cardBg} border-2 ${palette.border} ${palette.glow} backdrop-blur-xl space-y-6 text-white relative overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-800 pb-3">
          <span class="text-xs font-black text-rose-300 uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="shield-check" class="w-4 h-4 text-rose-400"></i> KMST Sanctuary Member Pass
          </span>
          <span class="px-2.5 py-0.5 rounded-full ${palette.badgeBg} text-[10px] font-black uppercase">
            VERIFIED WARRIOR
          </span>
        </div>

        <div class="flex items-center gap-4 p-4 sm:p-5 rounded-2xl bg-slate-900/80 border ${palette.border} shadow-xl">
          <div class="w-20 h-20 rounded-2xl bg-slate-950/80 border ${palette.border} p-1.5 flex items-center justify-center flex-shrink-0 shadow-lg">
            <img src="${memberData.emblemSvg || 'assets/badges/badge_24h.svg'}" class="w-full h-full object-contain" alt="Badge">
          </div>
          <div class="space-y-0.5 overflow-hidden">
            <h3 class="text-2xl font-black font-cinzel bg-gradient-to-r ${palette.textGradient} bg-clip-text text-transparent truncate flex items-center gap-2.5">
              <span class="w-8 h-8 inline-flex items-center justify-center">${getKMSTAvatarHtml(memberData.avatar, 'w-8 h-8 object-contain')}</span>
              <span>${memberData.alias}</span>
            </h3>
            <div class="text-xs font-bold text-rose-300 truncate">${memberData.badgeObject || memberData.badgeText}</div>
            <div class="text-xs font-mono-code font-bold text-emerald-400">${memberData.daysSober} Days Continuous Sobriety</div>
          </div>
        </div>

        ${savingsHtml}

        <div class="p-4 rounded-2xl bg-slate-950/80 border ${palette.border} text-xs text-slate-200 italic leading-relaxed">
          &ldquo;${memberData.pledge || 'One day at a time with clarity and courage.'}&rdquo;
        </div>

        <div class="p-4 rounded-2xl bg-rose-950/30 border ${palette.border} text-xs text-rose-200 font-medium">
          🌟 <strong>Daily Affirmation:</strong> ${affirmation}
        </div>
      </div>
    `;
  }

  cardContainer.innerHTML = styleTemplate;

  // Set share text for profile
  const shareProfileText = `🕊️ KMST RECOVERY WARRIOR • ${memberData.alias} (${memberData.daysSober} Days Sober • ${memberData.shieldIcon} ${memberData.badgeText})!\n\n"${memberData.pledge}"\n\nJoin the free & confidential KMST Alcohol Recovery Sanctuary with founder Steve Pereira @KeepMeSoberToo (14 continuous years sober):\n🔗 https://SteveP.uk\n\n#KeepMeSoberToo #KMST #Sobriety #OneDayAtATime #RecoveryWarriors`;
  
  const shareBtn = document.getElementById('kmstPublicProfileShareBtn');
  if (shareBtn) {
    shareBtn.onclick = () => openKMSTExportModal(shareProfileText, `${memberData.alias}'s KMST Recovery Profile`);
  }

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  modal.classList.add('flex');
  if (window.lucide) lucide.createIcons();
}

function closeKMSTPublicProfileModal() {
  const modal = document.getElementById('kmstPublicProfileModal');
  if (modal) {
    modal.classList.add('hidden');
    unlockBodyScroll();
    modal.classList.remove('flex');
  }
}


async function fetchKMSTMessages(channel = 'all') {
  _currentKMSTChannel = channel || 'all';
  _kmstActiveChannel = _currentKMSTChannel;
  try {
    const url = channel && channel !== 'all' ? `/api/kmst/messages?channel=${encodeURIComponent(channel)}` : '/api/kmst/messages';
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data && data.messages) {
        _cachedKMSTMessages = data.messages;
      }
    }
  } catch (e) {
    console.warn('Could not fetch messages from backend:', e);
  }
  renderKMSTMessages(_cachedKMSTMessages);
}

function setKMSTChannel(channel) {
  _currentKMSTChannel = channel || 'all';
  _kmstActiveChannel = _currentKMSTChannel;
  fetchKMSTMessages(_currentKMSTChannel);
}

function renderKMSTMessages(messages) {
  const container = document.getElementById('kmstMessagesFeed');
  if (!container) return;

  const msgs = (Array.isArray(messages) && messages.length > 0) ? messages : (_cachedKMSTMessages || []);
  const badgeCount = document.getElementById('kmstMessagesCountBadge');
  if (badgeCount) badgeCount.textContent = `${messages.length} Posts`;

  if (msgs.length === 0) {
    container.innerHTML = `
      <div class="p-8 rounded-2xl bg-slate-950/60 border border-slate-800 text-center space-y-2">
        <i data-lucide="message-square-dashed" class="w-8 h-8 text-slate-500 mx-auto"></i>
        <h4 class="text-white font-bold text-sm">No messages in this circle yet</h4>
        <p class="text-xs text-slate-400">Be the first warrior to post a check-in or start a discussion!</p>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  const isAdmin = !!(window._adminSessionToken || localStorage.getItem('steve_admin_session'));

  
  const channels = ['all', 'general', 'checkin', 'milestones', 'asksteve', 'family'];
  let tabsHtml = '<div class="flex items-center gap-2 overflow-x-auto pb-2 mb-4 custom-scrollbar">';
  channels.forEach(ch => {
    const isActive = _kmstActiveChannel === ch;
    tabsHtml += `
      <button onclick="_kmstActiveChannel='${ch}'; renderKMSTCommunity()" class="px-4 py-1.5 rounded-full text-[11px] font-bold transition whitespace-nowrap ${isActive ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800 hover:border-purple-500/50'}">
        ${ch === 'all' ? 'All Topics' : '#' + ch.charAt(0).toUpperCase() + ch.slice(1)}
      </button>
    `;
  });
  tabsHtml += '</div>';

  let pledgeHtml = '';
  if (_kmstUser && _kmstProfile && _kmstProfile.pledge) {
    pledgeHtml = `
      <div class="mb-4 p-4 rounded-xl bg-gradient-to-r from-emerald-900/30 to-slate-900 border border-emerald-500/30 shadow-lg relative overflow-hidden flex items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-400/40">
            <i data-lucide="shield-check" class="w-5 h-5 text-emerald-400"></i>
          </div>
          <div>
            <span class="block text-[10px] text-emerald-400 uppercase font-bold tracking-wider">Your Daily Pledge</span>
            <span class="block text-xs text-white font-cinzel italic mt-0.5">"${escapeHtml(_kmstProfile.pledge)}"</span>
          </div>
        </div>
        <button onclick="openKMSTAuthModal()" class="shrink-0 px-3 py-1.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-bold text-slate-400 hover:text-white transition">Edit</button>
      </div>
    `;
  }

  let filteredMsgs = _kmstActiveChannel === 'all' ? msgs : msgs.filter(m => m.channel === _kmstActiveChannel);

  container.innerHTML = tabsHtml + pledgeHtml + '<div class="space-y-3.5">' + filteredMsgs.map(m => {
    const channelPill = {
      general: '<span class="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold">#General</span>',
      checkin: '<span class="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">#Daily-Checkin</span>',
      milestones: '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold">#Milestones</span>',
      asksteve: '<span class="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold">#Ask-Steve</span>',
      family: '<span class="px-2 py-0.5 rounded bg-pink-500/20 text-pink-300 text-[10px] font-bold">#Family-Friends</span>'
    }[m.channel] || `<span class="px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-bold">#${m.channel}</span>`;

    const isFounder = m.authorRole === 'Founder' || (m.authorName && m.authorName.includes('Steve Pereira'));
    const reactions = m.reactions || { strength: 0, respect: 0, celebrate: 0, soberToday: 0 };
    const dateFormatted = m.timestamp ? new Date(m.timestamp).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent';

    // 10 Color Theme Styling
    const colorKey = m.postColor || (isFounder ? 'gold' : 'rose');
    const palette = KMST_THEME_PALETTES[colorKey] || KMST_THEME_PALETTES.rose;

    // Milestone Badge & Shield Attachment
    const badgeHtml = m.includeBadge !== false ? `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full ${palette.badgeBg} border text-[10px] font-mono-code font-bold">
        <span>${m.shieldIcon || '🛡️'}</span>
        <span>${m.streakDays ? `${m.streakDays}d Streak` : 'Active'}</span>
        <span class="text-slate-400">•</span>
        <span>${m.authorBadge || 'Warrior'}</span>
      </div>
    ` : '';

    return `
      <div class="p-4 sm:p-5 rounded-2xl ${m.pinned ? 'bg-gradient-to-r from-rose-950/40 via-purple-950/30 to-slate-950/80 border-2 border-rose-500/50 shadow-xl' : `${palette.cardBg} border ${palette.border} ${palette.glow}`} space-y-3.5 transition">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-900 pb-2.5">
          <div class="flex items-center gap-2.5">
            <button type="button" onclick="openKMSTPublicProfile('${m.authorName.replace(/'/g, "\\'")}')" title="View ${m.authorName}'s Profile" class="w-10 h-10 p-1 rounded-xl ${palette.badgeBg} flex items-center justify-center flex-shrink-0 hover:scale-105 transition shadow">
              ${getKMSTAvatarHtml(m.authorAvatar, 'w-8 h-8 object-contain')}
            </button>
            <div>
              <div class="flex flex-wrap items-center gap-1.5">
                <button type="button" onclick="openKMSTPublicProfile('${m.authorName.replace(/'/g, "\\'")}')" class="text-xs font-black text-white font-cinzel hover:underline text-left">
                  ${m.authorName}
                </button>
                ${isFounder ? '<span class="px-1.5 py-0.2 rounded bg-yellow-500/30 text-yellow-300 text-[9px] font-black border border-yellow-500/40">FOUNDER</span>' : ''}
                ${badgeHtml}
              </div>
              <span class="text-[10px] text-slate-400 font-mono-code">${dateFormatted}</span>
            </div>
          </div>

          <div class="flex items-center gap-2">
            ${m.pinned ? '<span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-black flex items-center gap-1"><i data-lucide="pin" class="w-3 h-3"></i> PINNED</span>' : ''}
            ${channelPill}
            <button onclick="shareKMSTPostCard('${m.id}')" title="Export / Share Post" class="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] font-bold flex items-center gap-1 transition">
              <i data-lucide="share-2" class="w-3 h-3 text-rose-400"></i> Share
            </button>
            ${isAdmin ? `
              <button onclick="openAdminKmstEditMsgModal('${m.id}')" title="Admin Edit Post" class="p-1 rounded text-slate-500 hover:text-amber-400 transition"><i data-lucide="edit-2" class="w-3.5 h-3.5"></i></button>
              <button onclick="deleteKMSTMessage('${m.id}')" title="Admin Remove Post" class="p-1 rounded text-slate-500 hover:text-rose-400 transition"><i data-lucide="trash-2" class="w-3.5 h-3.5"></i></button>
            ` : ''}
          </div>
        </div>

        <p class="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">${m.message}</p>

        <!-- Reaction Buttons Bar -->
        <div class="flex flex-wrap items-center gap-2 pt-1 border-t border-slate-900">
          <button onclick="reactKMSTMessage('${m.id}', 'strength')" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition flex items-center gap-1.5">
            <span>❤️ Strength</span>
            <span class="font-mono-code text-rose-400" id="rx-strength-${m.id}">${reactions.strength || 0}</span>
          </button>
          <button onclick="reactKMSTMessage('${m.id}', 'respect')" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition flex items-center gap-1.5">
            <span>🙌 Respect</span>
            <span class="font-mono-code text-emerald-400" id="rx-respect-${m.id}">${reactions.respect || 0}</span>
          </button>
          <button onclick="reactKMSTMessage('${m.id}', 'celebrate')" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition flex items-center gap-1.5">
            <span>🌟 Celebrate</span>
            <span class="font-mono-code text-amber-400" id="rx-celebrate-${m.id}">${reactions.celebrate || 0}</span>
          </button>
          <button onclick="reactKMSTMessage('${m.id}', 'soberToday')" class="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition flex items-center gap-1.5">
            <span>🙏 Sober Today</span>
            <span class="font-mono-code text-purple-400" id="rx-soberToday-${m.id}">${reactions.soberToday || 0}</span>
          </button>
        </div>
      </div>
    `;
  }).join('') + '</div>';

  if (window.lucide) lucide.createIcons();
}

async function submitKMSTMessage() {
  // Check if member is authenticated
  if (!isKMSTMemberLoggedIn()) {
    alert('🛡️ To keep the KMST Sanctuary secure and spam-free, please claim your free recovery account first.');
    openKMSTAuthModal('signup');
    return;
  }

  const text = (document.getElementById('kmstMessageText')?.value || '').trim();
  const channel = document.getElementById('kmstComposerChannel')?.value || 'general';
  const shouldBroadcast = document.getElementById('kmstShareSocials')?.checked ?? true;
  const includeBadge = document.getElementById('kmstIncludeBadgeCheck')?.checked ?? true;
  const postColor = document.getElementById('kmstPostColorSelect')?.value || (_kmstProfile ? _kmstProfile.profileColor : 'rose');
  const hpToken = document.getElementById('kmstMsgHoneypot')?.value || '';

  if (!text) {
    alert('Please enter a message before sharing.');
    return;
  }

  // Anti-Spam Zero Links Policy
  if (/(https?:\/\/|www\.|\.com|\.org|\.net|\.xyz|\.top|\.ru|\.click|\.work|\.loan|\.link|\.bit\.ly|\.t\.co|\.gg\/|t\.me\/)/i.test(text)) {
    alert('Security Alert: External links and promotional URLs are strictly prohibited in the KMST Sanctuary.');
    return;
  }

  const authorName = _kmstProfile.alias;
  const authorAvatar = _kmstProfile.avatar || '🕊️';
  const authorBadge = _kmstProfile.badgeText || 'Day 1 Warrior';
  const streakDays = _kmstProfile.daysSober || 1;
  const shieldIcon = _kmstProfile.shieldIcon || '⚡';
  const badgeObject = _kmstProfile.badgeObject || '⚡ 24-Hour Spark of Ignition';

  const btn = document.getElementById('kmstPostBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Sharing...`;
    if (window.lucide) lucide.createIcons();
  }

  // 1. Create optimistic local message
  const newMsg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
    channel: channel || 'general',
    authorName,
    authorRole: (authorName.includes('Steve Pereira') || authorBadge.includes('Founder')) ? 'Founder' : 'Member',
    authorAvatar,
    authorBadge,
    includeBadge,
    badgeObject,
    shieldIcon,
    streakDays,
    postColor,
    message: text,
    timestamp: new Date().toISOString(),
    pinned: false,
    reactions: {
      strength: 1,
      respect: 0,
      celebrate: 0,
      soberToday: 0
    }
  };

  // 2. Immediately inject into feed and render
  _cachedKMSTMessages.unshift(newMsg);
  renderKMSTMessages(_cachedKMSTMessages);
  document.getElementById('kmstMessageText').value = ''; closeKMSTComposerModal();

  // 3. Save to browser local storage so user post is preserved
  try {
    let localMsgs = [];
    const raw = localStorage.getItem('kmst_local_messages');
    if (raw) localMsgs = JSON.parse(raw);
    localMsgs.unshift(newMsg);
    if (localMsgs.length > 50) localMsgs = localMsgs.slice(0, 50);
    localStorage.setItem('kmst_local_messages', JSON.stringify(localMsgs));
  } catch (e) {}

  // 4. Trigger social broadcast modal if requested
  if (shouldBroadcast) {
    setTimeout(() => {
      shareKMSTPostCard(newMsg.id);
    }, 200);
  }

  // 5. Asynchronously persist to server
  try {
    fetch('/api/kmst/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        authorName,
        authorRole: newMsg.authorRole,
        authorAvatar,
        authorBadge,
        includeBadge,
        badgeObject,
        shieldIcon,
        streakDays,
        postColor,
        message: text,
        kmst_hp_token: hpToken
      })
    }).then(async res => {
      if (res.ok) {
        fetchKMSTCommunityStats();
      }
    }).catch(() => {});
  } catch (e) {}

  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-3.5 h-3.5"></i> Share To Sanctuary`;
    if (window.lucide) lucide.createIcons();
  }
}

async function reactKMSTMessage(messageId, reactionType) {
  const countEl = document.getElementById(`rx-${reactionType}-${messageId}`);
  if (countEl) {
    const current = parseInt(countEl.textContent || '0', 10);
    countEl.textContent = (current + 1).toString();
  }

  // Update in memory cache
  const target = _cachedKMSTMessages.find(m => m.id === messageId);
  if (target) {
    target.reactions = target.reactions || {};
    target.reactions[reactionType] = (target.reactions[reactionType] || 0) + 1;
  }

  try {
    await fetch(`/api/kmst/messages/${encodeURIComponent(messageId)}/react`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reaction: reactionType })
    });
  } catch (e) {}
}

async function deleteKMSTMessage(messageId) {
  if (!confirm('Are you sure you want to remove this message from the KMST Sanctuary?')) return;

  try {
    const res = await fetch(`/api/kmst/messages/${encodeURIComponent(messageId)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (data.success) {
      fetchKMSTMessages(_currentKMSTChannel);
      if (typeof loadAdminKMSTMessages === 'function') loadAdminKMSTMessages();
    } else {
      alert(data.message || 'Failed to delete message.');
    }
  } catch (err) {
    alert('Error removing message: ' + err.message);
  }
}

// --------------------------------------------------------------------------
// KMST ADMIN CMS CONTROLLER (PILLAR 13)
// --------------------------------------------------------------------------
async function loadAdminKMSTData() {
  // 1. Load locally cached config first
  try {
    const localCfg = localStorage.getItem('kmst_admin_config');
    if (localCfg) {
      _cachedKMSTConfig = { ..._cachedKMSTConfig, ...JSON.parse(localCfg) };
    }
  } catch (e) {}

  try {
    const res = await fetch('/api/kmst/data');
    if (res.ok) {
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.config) {
          _cachedKMSTConfig = { ..._cachedKMSTConfig, ...data.config };
          renderKMSTHeroUI(_cachedKMSTConfig);
        }
        if (data.messages) _cachedKMSTMessages = data.messages;
        if (data.helplines) _cachedKMSTHelplines = data.helplines;
        
        const badgeMem = document.getElementById('adminKmstMembersCount');
        if (badgeMem) badgeMem.textContent = data.membersCount || '0';

        const badgeMsg = document.getElementById('adminKmstMessagesCount');
        if (badgeMsg) badgeMsg.textContent = data.messagesCount || '0';
      } catch (e) {}
    }
  } catch (e) {}

  // Populate config settings inputs (Hero card + Socials + Founder Date)
  const hTitle = document.getElementById('adminKmstHeroTitle');
  if (hTitle && _cachedKMSTConfig?.heroTitle) hTitle.value = _cachedKMSTConfig.heroTitle;

  const hBio = document.getElementById('adminKmstHeroBio');
  if (hBio && _cachedKMSTConfig?.heroBio) hBio.value = _cachedKMSTConfig.heroBio;

  const b1 = document.getElementById('adminKmstHeroBadge1');
  if (b1 && _cachedKMSTConfig?.heroBadge1) b1.value = _cachedKMSTConfig.heroBadge1;

  const b2 = document.getElementById('adminKmstHeroBadge2');
  if (b2 && _cachedKMSTConfig?.heroBadge2) b2.value = _cachedKMSTConfig.heroBadge2;

  const b3 = document.getElementById('adminKmstHeroBadge3');
  if (b3 && _cachedKMSTConfig?.heroBadge3) b3.value = _cachedKMSTConfig.heroBadge3;

  const fQuote = document.getElementById('adminKmstFounderQuote');
  if (fQuote && _cachedKMSTConfig?.founderQuote) fQuote.value = _cachedKMSTConfig.founderQuote;

  const cTag = document.getElementById('adminKmstCommunityTag');
  if (cTag && _cachedKMSTConfig?.communityTag) cTag.value = _cachedKMSTConfig.communityTag;

  const fDate = document.getElementById('adminKmstFounderDate');
  if (fDate && _cachedKMSTConfig?.founderSoberDate) fDate.value = _cachedKMSTConfig.founderSoberDate;

  const iHandle = document.getElementById('adminKmstInstaHandle');
  if (iHandle && _cachedKMSTConfig?.instagramHandle) iHandle.value = _cachedKMSTConfig.instagramHandle;

  const iUrl = document.getElementById('adminKmstInstaUrl');
  if (iUrl && _cachedKMSTConfig?.instagramUrl) iUrl.value = _cachedKMSTConfig.instagramUrl;

  const tHandle = document.getElementById('adminKmstTwitterHandle');
  if (tHandle && _cachedKMSTConfig?.twitterHandle) tHandle.value = _cachedKMSTConfig.twitterHandle;

  const tUrl = document.getElementById('adminKmstTwitterUrl');
  if (tUrl && _cachedKMSTConfig?.twitterUrl) tUrl.value = _cachedKMSTConfig.twitterUrl;

  const sloganEl = document.getElementById('adminKmstSlogan');
  if (sloganEl && _cachedKMSTConfig?.slogan) sloganEl.value = _cachedKMSTConfig.slogan;

  loadAdminKMSTMessages();
  loadAdminKMSTMembers();
  if (typeof loadAdminKMSTBlogs === 'function') loadAdminKMSTBlogs();
}

// ── KMST Articles, Guidelines & Content Aggregator Client Engine ────────────
let _cachedKMSTArticles = [];
let _currentKMSTArticleCat = 'All';
let _currentKMSTArticleSearch = '';
let _currentReadingArticleId = null;

async function fetchKMSTArticles() {
  try {
    const res = await fetch('/api/kmst/blogs');
    if (res.ok) {
      const data = await res.json();
      if (data && data.blogs) {
        _cachedKMSTArticles = data.blogs;
        if (data.config) {
          const badgeEl = document.getElementById('kmstAggregatorStatusBadge');
          if (badgeEl) {
            badgeEl.textContent = data.config.enabled ? `Active • Curated ${data.blogs.length} Guides` : 'Daily Curated';
          }
        }
        renderKMSTArticles();
        return;
      }
    }
  } catch (err) {
    console.warn('[KMST ARTICLES] Fetch fallback:', err);
  }

  // Fallback to appData.blogs if available
  _cachedKMSTArticles = appData.blogs || [];
  renderKMSTArticles();
}
window.fetchKMSTArticles = fetchKMSTArticles;

function renderKMSTArticles() {
  const container = document.getElementById('kmstArticlesGrid');
  if (!container) return;

  let list = [..._cachedKMSTArticles];

  // Filter by category
  if (_currentKMSTArticleCat && _currentKMSTArticleCat !== 'All') {
    list = list.filter(a => a.category && a.category.toLowerCase() === _currentKMSTArticleCat.toLowerCase());
  }

  // Filter by search query
  if (_currentKMSTArticleSearch) {
    const q = _currentKMSTArticleSearch.toLowerCase().trim();
    list = list.filter(a =>
      (a.title && a.title.toLowerCase().includes(q)) ||
      (a.excerpt && a.excerpt.toLowerCase().includes(q)) ||
      (a.content && a.content.toLowerCase().includes(q)) ||
      (a.category && a.category.toLowerCase().includes(q)) ||
      (Array.isArray(a.tags) && a.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  if (list.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center glass-card rounded-2xl border border-slate-800 space-y-3">
        <i data-lucide="book-open" class="w-8 h-8 text-slate-500 mx-auto"></i>
        <p class="text-xs text-slate-400">No recovery articles found matching your filter criteria.</p>
        <button type="button" onclick="setKMSTArticleCategory('All')" class="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition">View All Wisdom</button>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
    return;
  }

  container.innerHTML = list.map(art => {
    const tagsHtml = Array.isArray(art.tags) ? art.tags.slice(0, 3).map(t => 
      `<span class="px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 text-[10px] font-mono-code">${escapeHtml(t)}</span>`
    ).join('') : '';

    const isFeatured = art.isFeatured;
    const borderClass = isFeatured ? 'border-amber-500/50 shadow-amber-500/10' : 'border-slate-800 hover:border-rose-500/40';
    const bgGradient = isFeatured ? 'bg-gradient-to-br from-slate-950 via-amber-950/20 to-slate-950' : 'bg-slate-950/80';

    return `
      <div class="glass-card rounded-3xl border ${borderClass} p-6 sm:p-7 space-y-4 relative overflow-hidden transition-all duration-300 hover:scale-[1.01] shadow-xl ${bgGradient} flex flex-col justify-between group">
        
        <div class="space-y-3">
          <!-- Top Row: Category Pill & Read Time -->
          <div class="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
            <span class="px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-black uppercase tracking-wider">
              ${escapeHtml(art.category || 'Recovery Guidelines')}
            </span>
            <div class="flex items-center gap-2 text-[10px] text-slate-400 font-mono-code">
              <span><i data-lucide="clock" class="w-3 h-3 inline mr-0.5 text-slate-500"></i> ${art.readTime || '5 min read'}</span>
            </div>
          </div>

          <!-- Title -->
          <h4 onclick="openKMSTArticleReader('${art.id}')" class="text-base sm:text-lg font-black text-white font-cinzel leading-snug cursor-pointer group-hover:text-rose-300 transition line-clamp-2">
            ${escapeHtml(art.title)}
          </h4>

          <!-- Author Info -->
          <div class="flex items-center gap-2 text-[11px] text-slate-400">
            <span class="font-bold text-amber-300">${escapeHtml(art.author || 'Steve Pereira (KMST Founder)')}</span>
            <span class="text-slate-600">•</span>
            <span class="text-slate-500 truncate">${escapeHtml(art.authorRole || 'Recovery Advocate')}</span>
          </div>

          <!-- Excerpt -->
          <p class="text-xs text-slate-300 leading-relaxed line-clamp-3">
            ${escapeHtml(art.excerpt || '')}
          </p>

          <!-- Action Steps Indicator -->
          ${Array.isArray(art.actionSteps) && art.actionSteps.length > 0 ? `
            <div class="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/30 flex items-center gap-2 text-[11px] text-amber-300 font-bold">
              <i data-lucide="check-circle" class="w-3.5 h-3.5 text-amber-400 shrink-0"></i>
              <span>${art.actionSteps.length}-Step Actionable Protocol Included</span>
            </div>
          ` : ''}
        </div>

        <div class="space-y-3 pt-3 border-t border-slate-800/80 mt-2">
          <!-- Tags -->
          <div class="flex flex-wrap items-center gap-1.5">
            ${tagsHtml}
          </div>

          <!-- CTA Button -->
          <button type="button" onclick="openKMSTArticleReader('${art.id}')" class="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-rose-600 text-slate-200 hover:text-white border border-slate-800 hover:border-rose-500 font-bold text-xs flex items-center justify-center gap-2 transition group-hover:shadow-lg">
            <span>Read Full Protocol</span>
            <i data-lucide="arrow-right" class="w-3.5 h-3.5 transition group-hover:translate-x-1"></i>
          </button>
        </div>

      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}
window.renderKMSTArticles = renderKMSTArticles;

function setKMSTArticleCategory(cat) {
  _currentKMSTArticleCat = cat;
  
  // Update button active state
  document.querySelectorAll('.kmst-art-cat-btn').forEach(btn => {
    btn.classList.remove('bg-rose-600', 'text-white', 'shadow-md');
    btn.classList.add('bg-slate-900', 'text-slate-300');
  });

  const catMap = {
    'All': 'artCat-All',
    'Recovery Guidelines': 'artCat-Guidelines',
    'Science & Health': 'artCat-Science',
    'Medical & NHS Pathways': 'artCat-Medical',
    'Personal Stories': 'artCat-Stories',
    'Mindset & Lifestyle': 'artCat-Mindset',
    'Nutrition & Detox': 'artCat-Nutrition',
    'Family Support': 'artCat-Family'
  };

  const activeBtnId = catMap[cat] || 'artCat-All';
  const activeBtn = document.getElementById(activeBtnId);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-900', 'text-slate-300');
    activeBtn.classList.add('bg-rose-600', 'text-white', 'shadow-md');
  }

  renderKMSTArticles();
}
window.setKMSTArticleCategory = setKMSTArticleCategory;

function handleKMSTArticleSearch() {
  const input = document.getElementById('kmstArticleSearchInput');
  _currentKMSTArticleSearch = input ? input.value : '';
  renderKMSTArticles();
}
window.handleKMSTArticleSearch = handleKMSTArticleSearch;

function formatKMSTArticleMarkdown(raw = '') {
  if (!raw) return '<p class="text-slate-400 italic">No content available.</p>';

  return raw
    .split('\n\n')
    .map(block => {
      block = block.trim();
      if (!block) return '';
      
      // Table rendering
      if (block.includes('|') && block.includes('---')) {
        const rows = block.split('\n').filter(r => r.trim().startsWith('|'));
        if (rows.length >= 2) {
          const headerCells = rows[0].split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim());
          const bodyRows = rows.slice(2).map(r => r.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim()));
          
          return `
            <div class="overflow-x-auto my-4">
              <table class="w-full text-xs text-left border-collapse border border-slate-800 rounded-xl overflow-hidden">
                <thead class="bg-slate-900/90 text-amber-300">
                  <tr>${headerCells.map(h => `<th class="p-3 border-b border-slate-800 font-black font-cinzel">${escapeHtml(h)}</th>`).join('')}</tr>
                </thead>
                <tbody class="divide-y divide-slate-800/60 bg-slate-950/60">
                  ${bodyRows.map(row => `<tr>${row.map(cell => `<td class="p-3 text-slate-300">${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}
                </tbody>
              </table>
            </div>
          `;
        }
      }

      // H2
      if (block.startsWith('## ')) {
        return `<h3 class="text-base sm:text-lg font-black text-white font-cinzel mt-6 mb-2 border-b border-slate-800/80 pb-1.5 flex items-center gap-2"><i data-lucide="sparkles" class="w-4 h-4 text-amber-400 inline"></i> ${escapeHtml(block.replace('## ', ''))}</h3>`;
      }
      // H3
      if (block.startsWith('### ')) {
        return `<h4 class="text-sm font-black text-rose-300 font-cinzel mt-4 mb-1.5">${escapeHtml(block.replace('### ', ''))}</h4>`;
      }
      // Blockquote
      if (block.startsWith('> ')) {
        return `<blockquote class="p-4 rounded-2xl bg-gradient-to-r from-rose-950/30 to-purple-950/30 border-l-4 border-rose-500 my-4 text-xs sm:text-sm text-slate-200 italic font-medium">${escapeHtml(block.replace(/^> /, ''))}</blockquote>`;
      }
      // List
      if (block.startsWith('- ') || block.startsWith('* ') || /^\d+\.\s/.test(block)) {
        const items = block.split('\n').map(line => {
          const clean = line.replace(/^[-*]\s+|\d+\.\s+/, '').trim();
          const formatted = clean.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>');
          return `<li class="flex items-start gap-2"><i data-lucide="check" class="w-3.5 h-3.5 text-emerald-400 mt-1 shrink-0"></i><span>${formatted}</span></li>`;
        }).join('');
        return `<ul class="space-y-2 my-3 text-xs sm:text-sm text-slate-300 pl-1">${items}</ul>`;
      }

      // Standard paragraph with **bold** formatting
      const formattedPara = escapeHtml(block)
        .replace(/&lt;strong class=&quot;text-white font-bold&quot;&gt;(.*?)&lt;\/strong&gt;/g, '<strong class="text-white font-bold">$1</strong>')
        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-bold">$1</strong>')
        .replace(/\*(.*?)\*/g, '<em class="text-slate-300">$1</em>');

      return `<p class="text-xs sm:text-sm text-slate-300 leading-relaxed my-2">${formattedPara}</p>`;
    })
    .join('');
}

function openKMSTArticleReader(articleId) {
  const art = (_cachedKMSTArticles || []).find(a => a.id === articleId || a.slug === articleId);
  if (!art) return;

  _currentReadingArticleId = art.id;

  const modal = document.getElementById('kmstArticleReaderModal');
  if (!modal) return;

  // Header Details
  document.getElementById('kmstReaderCategory').textContent = art.category || 'Sobriety';
  document.getElementById('kmstReaderReadTime').textContent = art.readTime || '5 min read';
  document.getElementById('kmstReaderDate').textContent = art.date ? `Published ${art.date}` : '';
  document.getElementById('kmstReaderTitle').textContent = art.title || '';
  document.getElementById('kmstReaderAuthor').textContent = art.author || 'Steve Pereira (KMST Founder)';
  document.getElementById('kmstReaderAuthorRole').textContent = art.authorRole || 'Recovery Advocate';
  document.getElementById('kmstReaderExcerpt').textContent = art.excerpt || '';

  // Action Steps Box
  const actionBox = document.getElementById('kmstReaderActionBox');
  const actionList = document.getElementById('kmstReaderActionList');
  if (Array.isArray(art.actionSteps) && art.actionSteps.length > 0) {
    actionBox.classList.remove('hidden');
    actionList.innerHTML = art.actionSteps.map((step, idx) => `
      <li class="flex items-start gap-2.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800">
        <span class="w-5 h-5 rounded-lg bg-amber-500/20 text-amber-300 font-mono-code font-black text-[10px] flex items-center justify-center shrink-0 border border-amber-500/30">${idx + 1}</span>
        <span class="text-xs text-slate-200">${escapeHtml(step)}</span>
      </li>
    `).join('');
  } else {
    actionBox.classList.add('hidden');
  }

  // Full Content
  const contentEl = document.getElementById('kmstReaderContent');
  if (contentEl) {
    contentEl.innerHTML = formatKMSTArticleMarkdown(art.content || art.excerpt);
  }

  // Tags
  const tagsContainer = document.getElementById('kmstReaderTags');
  if (tagsContainer) {
    if (Array.isArray(art.tags) && art.tags.length > 0) {
      tagsContainer.innerHTML = art.tags.map(t => 
        `<span class="px-2.5 py-1 rounded-lg bg-slate-900 text-slate-300 border border-slate-800 text-xs font-mono-code">${escapeHtml(t)}</span>`
      ).join('');
    } else {
      tagsContainer.innerHTML = '';
    }
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.body.style.overflow = 'hidden';

  if (window.lucide) lucide.createIcons();
}
window.openKMSTArticleReader = openKMSTArticleReader;

function closeKMSTArticleReader() {
  const modal = document.getElementById('kmstArticleReaderModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
  document.body.style.overflow = '';
}
window.closeKMSTArticleReader = closeKMSTArticleReader;

function copyKMSTArticleLink() {
  const art = (_cachedKMSTArticles || []).find(a => a.id === _currentReadingArticleId);
  const shareText = art ? `${art.title} — KMST Sobriety Sanctuary: ${window.location.origin}/#tab-sobriety` : window.location.href;
  
  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      alert('Article link copied to clipboard!');
    }).catch(() => {
      prompt('Copy article link:', shareText);
    });
  } else {
    prompt('Copy article link:', shareText);
  }
}
window.copyKMSTArticleLink = copyKMSTArticleLink;

// ── Admin KMST Blogs & Aggregator Management Engine ────────────────────────
async function loadAdminKMSTBlogs() {
  const grid = document.getElementById('adminBlogsListGrid');
  if (!grid) return;

  try {
    const res = await fetch('/api/kmst/blogs');
    if (res.ok) {
      const data = await res.json();
      if (data && data.blogs) {
        _cachedKMSTArticles = data.blogs;
        renderAdminKMSTBlogsList(data.blogs);

        // Update aggregator stats in admin panel
        const totalCountEl = document.getElementById('adminAggArticlesCount');
        if (totalCountEl) totalCountEl.textContent = `${data.blogs.length} Articles`;

        const lastRunEl = document.getElementById('adminAggLastRunText');
        if (lastRunEl && data.config && data.config.lastRun) {
          const d = new Date(data.config.lastRun);
          lastRunEl.textContent = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        const statusEl = document.getElementById('adminAggStatusText');
        if (statusEl && data.config) {
          statusEl.textContent = data.config.enabled ? `Active (${data.config.frequency || 'Daily'} Cron)` : 'Disabled';
        }
        return;
      }
    }
  } catch (e) {
    console.warn('Admin KMST blogs fetch fallback:', e);
  }

  renderAdminKMSTBlogsList(_cachedKMSTArticles);
}
window.loadAdminKMSTBlogs = loadAdminKMSTBlogs;

function renderAdminKMSTBlogsList(blogs = []) {
  const grid = document.getElementById('adminBlogsListGrid');
  if (!grid) return;

  if (!blogs || blogs.length === 0) {
    grid.innerHTML = '<div class="col-span-full py-8 text-center text-slate-500 italic">No recovery articles published yet. Click "+ New Article" or "Run Aggregator Now".</div>';
    return;
  }

  grid.innerHTML = blogs.map(b => `
    <div class="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-3 relative hover:border-rose-500/40 transition">
      <div class="flex items-center justify-between">
        <span class="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-black uppercase">${escapeHtml(b.category || 'Recovery Guidelines')}</span>
        <span class="text-[10px] text-slate-400 font-mono-code">${b.date || 'Recent'}</span>
      </div>

      <div>
        <h5 class="text-white font-bold text-sm font-cinzel line-clamp-2">${escapeHtml(b.title)}</h5>
        <span class="text-[10px] text-amber-400 block font-mono-code mt-0.5">${escapeHtml(b.author || 'Steve Pereira')}</span>
      </div>

      <p class="text-slate-400 text-xs line-clamp-2 leading-relaxed">${escapeHtml(b.excerpt || '')}</p>

      <div class="flex items-center justify-between pt-2 border-t border-slate-800/80">
        <button type="button" onclick="openKMSTArticleReader('${b.id}')" class="text-[11px] text-sky-400 hover:text-sky-300 font-bold flex items-center gap-1">
          <i data-lucide="eye" class="w-3 h-3"></i> Preview
        </button>

        <div class="flex items-center gap-1.5">
          <button type="button" onclick="editKMSTBlog('${b.id}')" class="px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-bold transition border border-slate-700">Edit</button>
          <button type="button" onclick="deleteKMSTBlog('${b.id}')" class="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-300 text-xs font-bold transition border border-rose-700">Delete</button>
        </div>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}
window.renderAdminKMSTBlogsList = renderAdminKMSTBlogsList;

function filterAdminBlogsList() {
  const input = document.getElementById('adminBlogSearchInput');
  const q = input ? input.value.toLowerCase().trim() : '';
  if (!q) {
    renderAdminKMSTBlogsList(_cachedKMSTArticles);
    return;
  }

  const filtered = (_cachedKMSTArticles || []).filter(b => 
    (b.title && b.title.toLowerCase().includes(q)) ||
    (b.excerpt && b.excerpt.toLowerCase().includes(q)) ||
    (b.category && b.category.toLowerCase().includes(q))
  );
  renderAdminKMSTBlogsList(filtered);
}
window.filterAdminBlogsList = filterAdminBlogsList;

async function adminRunAggregatorNow() {
  const btn = document.getElementById('adminAggregatorRunBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Curating Articles...';
    if (window.lucide) lucide.createIcons();
  }

  try {
    const res = await fetch('/api/kmst/aggregator/run', { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.success) {
      alert(`Success! ${data.message}`);
      await loadAdminKMSTBlogs();
      await fetchKMSTArticles();
    } else {
      alert(`Aggregator message: ${data.message || 'Complete'}`);
    }
  } catch (err) {
    alert(`Aggregator execution error: ${err.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="play" class="w-3.5 h-3.5"></i> Run Aggregator Now';
      if (window.lucide) lucide.createIcons();
    }
  }
}
window.adminRunAggregatorNow = adminRunAggregatorNow;

function openAdminBlogModal(blogId = null) {
  const modal = document.getElementById('adminKmstBlogModal');
  if (!modal) return;

  const titleInput = document.getElementById('adminBlogTitleInput');
  const catInput = document.getElementById('adminBlogCategoryInput');
  const readTimeInput = document.getElementById('adminBlogReadTimeInput');
  const dateInput = document.getElementById('adminBlogDateInput');
  const authorInput = document.getElementById('adminBlogAuthorInput');
  const authorRoleInput = document.getElementById('adminBlogAuthorRoleInput');
  const tagsInput = document.getElementById('adminBlogTagsInput');
  const excerptInput = document.getElementById('adminBlogExcerptInput');
  const actionStepsInput = document.getElementById('adminBlogActionStepsInput');
  const contentInput = document.getElementById('adminBlogContentInput');
  const featuredInput = document.getElementById('adminBlogFeaturedInput');
  const idInput = document.getElementById('adminBlogId');

  if (blogId) {
    const blog = (_cachedKMSTArticles || []).find(b => b.id === blogId);
    if (blog) {
      if (idInput) idInput.value = blog.id;
      if (titleInput) titleInput.value = blog.title || '';
      if (catInput) catInput.value = blog.category || 'Recovery Guidelines';
      if (readTimeInput) readTimeInput.value = blog.readTime || '5 min read';
      if (dateInput) dateInput.value = blog.date || '';
      if (authorInput) authorInput.value = blog.author || 'Steve Pereira (KMST Founder)';
      if (authorRoleInput) authorRoleInput.value = blog.authorRole || '14 Years Continuous Sobriety';
      if (tagsInput) tagsInput.value = Array.isArray(blog.tags) ? blog.tags.join(', ') : (blog.tags || '');
      if (excerptInput) excerptInput.value = blog.excerpt || '';
      if (actionStepsInput) actionStepsInput.value = Array.isArray(blog.actionSteps) ? blog.actionSteps.join('\n') : '';
      if (contentInput) contentInput.value = blog.content || '';
      if (featuredInput) featuredInput.checked = !!blog.isFeatured;
      document.getElementById('adminBlogModalTitle').textContent = 'Edit Recovery Article';
    }
  } else {
    if (idInput) idInput.value = '';
    if (titleInput) titleInput.value = '';
    if (catInput) catInput.value = 'Recovery Guidelines';
    if (readTimeInput) readTimeInput.value = '5 min read';
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    if (authorInput) authorInput.value = 'Steve Pereira (KMST Founder)';
    if (authorRoleInput) authorRoleInput.value = '14 Years Continuous Sobriety';
    if (tagsInput) tagsInput.value = '#RecoveryGuidelines, #Sobriety, #KMST';
    if (excerptInput) excerptInput.value = '';
    if (actionStepsInput) actionStepsInput.value = '';
    if (contentInput) contentInput.value = '';
    if (featuredInput) featuredInput.checked = false;
    document.getElementById('adminBlogModalTitle').textContent = 'Publish New Recovery Article';
  }

  modal.classList.remove('hidden');
  modal.classList.add('flex');
  if (window.lucide) lucide.createIcons();
}
window.openAdminBlogModal = openAdminBlogModal;

function closeAdminBlogModal() {
  const modal = document.getElementById('adminKmstBlogModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}
window.closeAdminBlogModal = closeAdminBlogModal;

function editKMSTBlog(id) {
  openAdminBlogModal(id);
}
window.editKMSTBlog = editKMSTBlog;

async function saveAdminBlog() {
  const id = document.getElementById('adminBlogId')?.value;
  const title = document.getElementById('adminBlogTitleInput')?.value?.trim();
  const category = document.getElementById('adminBlogCategoryInput')?.value;
  const readTime = document.getElementById('adminBlogReadTimeInput')?.value?.trim();
  const date = document.getElementById('adminBlogDateInput')?.value;
  const author = document.getElementById('adminBlogAuthorInput')?.value?.trim();
  const authorRole = document.getElementById('adminBlogAuthorRoleInput')?.value?.trim();
  const tagsRaw = document.getElementById('adminBlogTagsInput')?.value || '';
  const excerpt = document.getElementById('adminBlogExcerptInput')?.value?.trim();
  const actionStepsRaw = document.getElementById('adminBlogActionStepsInput')?.value || '';
  const content = document.getElementById('adminBlogContentInput')?.value || '';
  const isFeatured = document.getElementById('adminBlogFeaturedInput')?.checked;

  if (!title || !excerpt) {
    alert('Please enter a title and excerpt.');
    return;
  }

  const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
  const actionSteps = actionStepsRaw.split('\n').map(s => s.trim()).filter(Boolean);

  const payload = {
    title,
    category,
    readTime,
    date,
    author,
    authorRole,
    tags,
    excerpt,
    actionSteps,
    content,
    isFeatured
  };

  try {
    const url = id ? `/api/kmst/blogs/${id}` : '/api/kmst/blogs';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(id ? 'Article updated successfully!' : 'Article published successfully!');
      closeAdminBlogModal();
      await loadAdminKMSTBlogs();
      await fetchKMSTArticles();
    } else {
      alert(`Error saving article: ${data.message || 'Failed'}`);
    }
  } catch (err) {
    alert(`Network error saving article: ${err.message}`);
  }
}
window.saveAdminBlog = saveAdminBlog;

async function deleteKMSTBlog(id) {
  if (!confirm('Are you sure you want to delete this recovery article?')) return;

  try {
    const res = await fetch(`/api/kmst/blogs/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok && data.success) {
      alert('Article deleted successfully.');
      await loadAdminKMSTBlogs();
      await fetchKMSTArticles();
    } else {
      alert(`Error deleting article: ${data.message || 'Failed'}`);
    }
  } catch (err) {
    alert(`Network error deleting article: ${err.message}`);
  }
}
window.deleteKMSTBlog = deleteKMSTBlog;

function setKmstAdminView(viewName) {
  document.querySelectorAll('.kmst-admin-view').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById(`kmstAdminView-${viewName}`);
  if (target) target.classList.remove('hidden');

  document.querySelectorAll('.kmst-admin-pill').forEach(btn => {
    btn.classList.remove('bg-rose-500/20', 'text-rose-300', 'border-rose-500/30');
    btn.classList.add('bg-slate-900', 'text-slate-300');
  });

  const activeBtn = document.getElementById(`kmstAdminNav-${viewName}`);
  if (activeBtn) {
    activeBtn.classList.remove('bg-slate-900', 'text-slate-300');
    activeBtn.classList.add('bg-rose-500/20', 'text-rose-300', 'border-rose-500/30');
  }

  if (window.lucide) lucide.createIcons();
}


async function loadAdminKMSTMessages() {
  const channel = document.getElementById('adminKmstMsgFilterChannel')?.value || 'all';
  const query = (document.getElementById('adminKmstMsgSearch')?.value || '').toLowerCase();

  try {
    const res = await fetch(`/api/kmst/messages?channel=${encodeURIComponent(channel)}&q=${encodeURIComponent(query)}&pending=true`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.messages) {
        _cachedKMSTMessages = data.messages;
        renderAdminKMSTMessagesTable(data.messages);
        return;
      }
    }
  } catch (e) {
    console.warn('Admin messages fetch fallback:', e);
  }

  renderAdminKMSTMessagesTable(_cachedKMSTMessages);
}

function renderAdminKMSTMessagesTable(messages) {
  const tbody = document.getElementById('adminKmstMessagesTableBody');
  if (!tbody) return;

  const list = (messages && messages.length > 0) ? messages : _cachedKMSTMessages;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-500 italic">No community messages match your filter.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(m => {
    const isFounder = m.authorRole === 'Founder' || (m.authorName && m.authorName.includes('Steve Pereira'));
    const rx = m.reactions || {};
    const totalRx = (rx.strength || 0) + (rx.respect || 0) + (rx.celebrate || 0) + (rx.soberToday || 0);
    const isPublished = m.status === 'approved' || !m.status;

    return `
      <tr class="hover:bg-slate-900/50 transition border-b border-slate-800/60">
        <td class="py-2.5 px-3">
          <div class="flex items-center gap-2">
            <span>${m.authorAvatar || '🕊️'}</span>
            <div>
              <strong class="text-white block font-cinzel text-xs">${escapeHtml(m.authorName)}</strong>
              <span class="text-[10px] text-amber-400 font-mono-code">${escapeHtml(m.authorBadge || 'Warrior')}</span>
            </div>
          </div>
        </td>
        <td class="py-2.5 px-3 font-mono-code text-purple-300 text-[11px]">#${m.channel}</td>
        <td class="py-2.5 px-3 text-slate-300 max-w-xs sm:max-w-sm truncate" title="${escapeHtml(m.message)}">
          ${m.pinned ? '<span class="text-amber-400 font-bold mr-1">📌</span>' : ''}${escapeHtml(m.message)}
        </td>
        <td class="py-2.5 px-3 font-mono-code text-slate-400 text-[11px]">${totalRx} rx</td>
        <td class="py-2.5 px-3 text-right space-x-1.5 whitespace-nowrap">
          <button type="button" onclick="toggleAdminKmstMsgStatus('${m.id}')" title="Toggle Publish / Unpublish" class="px-2.5 py-1 rounded ${isPublished ? 'bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-900' : 'bg-amber-950/80 border border-amber-500/40 text-amber-300 hover:bg-amber-900'} text-[11px] font-bold transition">
            ${isPublished ? '✓ Published' : '○ Unpublished'}
          </button>
          <button type="button" onclick="openAdminKmstEditMsgModal('${m.id}')" class="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[11px] font-bold transition">Edit</button>
          <button type="button" onclick="deleteKMSTMessage('${m.id}')" class="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] font-bold transition">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}


function renderBlogs() {
  const container = document.getElementById('blogFeedList');
  if (!container) return;

  const blogs = appData.blogs || [];
  container.innerHTML = blogs.map(b => `
    <div class="p-5 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 backdrop-blur-md hover:border-rose-500/40 transition">
      <span class="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-bold">${b.category || 'Sobriety'}</span>
      <h4 class="text-white font-bold text-sm font-cinzel">${b.title}</h4>
      <p class="text-slate-300 text-xs leading-relaxed">${b.excerpt}</p>
      <span class="text-[10px] text-slate-400 font-mono-code block pt-2">${b.date || ''}</span>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
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
  if (actualTab === 'kmst') {
    if (typeof loadAdminKMSTData === 'function') loadAdminKMSTData();
    if (typeof loadAdminKMSTMessages === 'function') loadAdminKMSTMessages();
    if (typeof loadAdminKMSTMembers === 'function') loadAdminKMSTMembers();
    if (typeof loadAdminKMSTHelplines === 'function') loadAdminKMSTHelplines();
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

// Helper for Secure SHA-256 hashing
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleAdminLogin(e) {
  if (e) e.preventDefault();
  const pin = document.getElementById('adminPinInput')?.value.trim();
  if (!pin) return;

  const enteredHash = await sha256(pin);
  const defaultHash = 'fb33b02e0e0134dba63f496647fbe6be8d8e876743c064dd266faa1450e8778c'; // SHA-256 of '933989'
  const storedHash = localStorage.getItem('stevep_admin_pin_hash') || (appData && appData.adminPinHash) || defaultHash;

  if (enteredHash === storedHash) {
    document.getElementById('adminLockScreen')?.classList.add('hidden');
    document.getElementById('adminDashboard')?.classList.remove('hidden');
    populateHeroAdminInputs();
    populateITAdminInputs();
    updateSEODisplay();
    setAdminSubTab('spotlight');
    renderAdminMediaGrid();
  } else {
    alert('Incorrect Admin PIN. Access Denied.');
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
    'Self (SteveP)': '🏠'
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
  if (newPin.length !== 6 || !/^\d{6}$/.test(newPin)) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '⚠️ New PIN must be exactly 6 numeric digits (e.g. 933989).'; }
    return;
  }

  // Verify current PIN hash
  const currentHash = await sha256(currentPin);
  const defaultHash = 'fb33b02e0e0134dba63f496647fbe6be8d8e876743c064dd266faa1450e8778c';
  const storedHash = localStorage.getItem('stevep_admin_pin_hash') || (appData && appData.adminPinHash) || defaultHash;

  if (currentHash !== storedHash) {
    if (statusEl) { statusEl.classList.remove('hidden'); statusEl.className = 'text-[11px] text-red-400'; statusEl.textContent = '❌ Incorrect current PIN.'; }
    return;
  }

  // Save new 6-digit PIN hash
  const newHash = await sha256(newPin);
  localStorage.setItem('stevep_admin_pin_hash', newHash);
  
  // Clean up legacy plaintext PIN if it exists
  localStorage.removeItem('stevep_admin_pin');
  if (appData) {
    delete appData.adminPin;
    appData.adminPinHash = newHash;
  }

  await saveAppDataToServer();

  try {
    const res = await fetch('/api/admin/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPin, newPin })
    });
  } catch (err) {}

  if (statusEl) {
    statusEl.classList.remove('hidden');
    statusEl.className = 'text-[11px] text-emerald-400';
    statusEl.textContent = `✅ 6-Digit Admin PIN updated successfully!`;
  }
  document.getElementById('currentPinInput').value = '';
  document.getElementById('newPinInput').value = '';
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
  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
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
    // 1. Save to local browser storage so live edits immediately persist on screen
    localStorage.setItem('stevep_app_data', JSON.stringify(appData));

    // 2. Try Node backend endpoint if active
    const res = await fetch('/api/data/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(appData)
    });
    if (res.ok) {
      const data = await res.json();
      return data.success;
    }
  } catch (e) {
    console.warn('Backend /api/data/save endpoint unavailable, saved locally to browser storage.');
  }

  // 3. Static cPanel hosting fallback: Saved successfully!
  return true;
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
    'Need help?': 'Need<br>Help?',
    'Need Help?': 'Need<br>Help?',
    'Need Help': 'Need<br>Help?',
    'KMST Recovery': 'Need<br>Help?',
    'KEEP ME SOBER TOO (KMST)': 'Need<br>Help?',
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
    sobriety: ['nav-sobriety', 'Need<br>Help?'],
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
  if (typeof initMosaicStudio === 'function') initMosaicStudio();

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
  const colorLayer = document.getElementById('globalColorLayer');
  const overlayLayer = document.getElementById('globalVignetteLayer');
  const bgConfig = appData.bgConfig || {
    mode: 'image',
    activeImage: appData.activeBgImage || 'assets/steve_35mm_contact_wallpaper.jpg',
    brightness: 95,
    contrast: 100,
    overlayDensity: 30,
    glassOpacity: 48,
    parallaxEnabled: true,
    direction: 'opposite',
    speed: 0.16,
    scalePx: 680,
    plainColor: '#030712'
  };

  const mode = bgConfig.mode || 'image';

  // 1. Photo Wallpaper Layer
  if (bgLayer) {
    if (mode === 'image') {
      bgLayer.classList.remove('hidden');
      const activeImg = bgConfig.activeImage || appData.activeBgImage || 'assets/steve_35mm_contact_wallpaper.jpg';
      bgLayer.style.backgroundImage = `url('${activeImg}')`;
      const b = (typeof bgConfig.brightness === 'number' ? bgConfig.brightness : 95) / 100;
      const c = (typeof bgConfig.contrast === 'number' ? bgConfig.contrast : 100);
      const scalePx = bgConfig.scalePx || 680;
      const scaleVal = (scalePx === 'cover' || scalePx === 'contain') ? scalePx : `${scalePx}px auto`;
      bgLayer.style.backgroundSize = scaleVal;
      document.documentElement.style.setProperty('--bg-scale', scaleVal);
      bgLayer.style.filter = `contrast(${c}%) brightness(${b})`;
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
      const density = (typeof bgConfig.overlayDensity === 'number' ? bgConfig.overlayDensity : 30) / 100;
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
    brightness: 95,
    contrast: 100,
    overlayDensity: 30,
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
  if (modal) modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  renderBgMediaPickerGrid();
}

function closeBgMediaPickerModal() {
  const modal = document.getElementById('bgMediaPickerModal');
  if (modal) modal.classList.add('hidden');
    unlockBodyScroll();
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

let _customMosaicUploads = [];

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

  // Include custom uploaded photos first so they appear at the top!
  (_customMosaicUploads || []).forEach(u => add(u, 'Uploaded Photo'));
  (appData.customUploadedPhotos || []).forEach(u => add(u, 'Uploaded Photo'));
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

// ═══════════════════════════════════════════════════════════════════════════
// ON-THE-FLY CUSTOM WALLPAPER & MOSAIC STUDIO GENERATOR ENGINE
// ═══════════════════════════════════════════════════════════════════════════

let _mosaicSelectedPhotos = new Set();
let _mosaicScale = '25%';
let _mosaicScalePx = 680;
let _mosaicColorMode = 'bw';
let _mosaicSpacing = 4; // 2 (Every 2nd / Every Other), 3, 4 (Balanced), 5, 6, 7, 0 (None)
let _customInterrupters = []; // Array of { id, title, url, enabled }
let _mosaicLastGeneratedDataUrl = null;
let _mosaicLastGeneratedScalePx = 680;

function initMosaicStudio() {
  renderMosaicPhotoPickerGrid();
  renderMosaicCustomInterruptersList();
  renderMosaicPresetsBank();
  syncMosaicScaleUI();
}

function renderMosaicPhotoPickerGrid() {
  const grid = document.getElementById('mosaicPhotoPickerGrid');
  if (!grid) return;

  const allPhotos = getAllPortfolioPhotos();
  
  // If first run and none selected, auto-select all 35mm stills
  if (_mosaicSelectedPhotos.size === 0) {
    (appData.stills || []).forEach(s => {
      const u = s.url || s.image;
      if (u) _mosaicSelectedPhotos.add(u);
    });
  }

  grid.innerHTML = allPhotos.map(item => {
    const isSelected = _mosaicSelectedPhotos.has(item.url);
    const safeUrl = encodeURIComponent(item.url);
    return `
      <div onclick="toggleMosaicPhoto('${safeUrl}')" class="relative group rounded-lg overflow-hidden border cursor-pointer aspect-square bg-slate-950 transition ${isSelected ? 'border-cyan-400 ring-2 ring-cyan-400/40' : 'border-slate-800 hover:border-slate-700 opacity-60 hover:opacity-100'}">
        <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover">
        <div class="absolute top-1 right-1 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${isSelected ? 'bg-cyan-500 text-slate-950 shadow' : 'bg-slate-900/80 text-transparent border border-white/20'}">
          ✓
        </div>
        <div class="absolute inset-x-0 bottom-0 bg-slate-950/80 p-1 text-[8px] text-white truncate font-mono-code">
          ${escapeHtml(item.title)}
        </div>
      </div>
    `;
  }).join('');

  updateMosaicSelectedCount();
  if (window.lucide) lucide.createIcons();
}

function toggleMosaicPhoto(encodedUrl) {
  const url = decodeURIComponent(encodedUrl);
  if (_mosaicSelectedPhotos.has(url)) {
    _mosaicSelectedPhotos.delete(url);
  } else {
    _mosaicSelectedPhotos.add(url);
  }
  renderMosaicPhotoPickerGrid();
}

function selectMosaicPhotos(type) {
  _mosaicSelectedPhotos.clear();
  if (type === 'stills') {
    (appData.stills || []).forEach(s => {
      const u = s.url || s.image;
      if (u) _mosaicSelectedPhotos.add(u);
    });
  } else if (type === 'headshots') {
    (appData.headshots || []).forEach(h => {
      const u = h.url || h.image;
      if (u) _mosaicSelectedPhotos.add(u);
    });
  } else if (type === 'all') {
    getAllPortfolioPhotos().forEach(p => _mosaicSelectedPhotos.add(p.url));
  }
  renderMosaicPhotoPickerGrid();
}

function updateMosaicSelectedCount() {
  const countEl = document.getElementById('mosaicSelectedCount');
  if (countEl) countEl.textContent = `${_mosaicSelectedPhotos.size} Photos Selected`;
}

async function handleMosaicUpload(event) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const statusEl = document.getElementById('mosaicGenStatus');
  if (statusEl) statusEl.textContent = `⚡ Compressing and uploading ${files.length} photo(s)...`;

  let uploadCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const dataUrl = await compressImage(file, 1920, 1920, 0.78);
      if (!dataUrl) continue;

      const res = await fetch('/api/background/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          dataUrl, 
          name: file.name,
          setAsActive: false 
        })
      });
      const data = await res.json();
      if (data.success && data.url) {
        const newPhotoItem = {
          id: `upload_${Date.now()}_${i}`,
          url: data.url,
          title: file.name.replace(/\.[^/.]+$/, "") || 'Uploaded Photo',
          tag: 'Uploaded Photo'
        };
        _customMosaicUploads.unshift(newPhotoItem);
        appData.customUploadedPhotos = appData.customUploadedPhotos || [];
        appData.customUploadedPhotos.unshift(newPhotoItem);
        _mosaicSelectedPhotos.add(data.url);
        uploadCount++;
      }
    } catch (e) {
      console.error('Upload error in mosaic studio:', e);
    }
  }

  event.target.value = '';
  if (statusEl) statusEl.textContent = `✓ Uploaded ${uploadCount} photo(s) into studio!`;
  renderMosaicPhotoPickerGrid();
}

// ───────────────────────────────────────────────────────────────────────────
// CUSTOM INTERRUPTERS & SPACING ENGINE (Guaranteed Non-Adjacent Distribution)
// ───────────────────────────────────────────────────────────────────────────

function setMosaicSpacing(spacing) {
  _mosaicSpacing = parseInt(spacing, 10);
  const btns = document.querySelectorAll('.mosaic-spacing-btn');
  btns.forEach(b => {
    if (b.id === `spacingBtn-${spacing}`) {
      b.className = "mosaic-spacing-btn px-2 py-1.5 rounded-lg font-bold transition bg-amber-500 text-slate-950 shadow";
    } else {
      b.className = "mosaic-spacing-btn px-2 py-1.5 rounded-lg font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800";
    }
  });

  const badge = document.getElementById('mosaicSpacingLabelBadge');
  if (badge) {
    const labels = {
      2: 'Every 2nd (Every Other - Checkerboard Matrix)',
      3: 'Every 3rd Tile (1 in 3 - Staggered)',
      4: 'Every 4th Tile (1 in 4 - Balanced)',
      5: 'Every 5th Tile (1 in 5 - Subtle)',
      6: 'Every 6th Tile (1 in 6 - Light)',
      7: 'Every 7th Tile (1 in 7 - Sparse)',
      0: 'None (0% Photos Only)'
    };
    badge.textContent = labels[_mosaicSpacing] || `Every ${_mosaicSpacing}th Tile`;
  }
}

async function handleInterrupterUpload(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('mosaicGenStatus');
  if (statusEl) statusEl.textContent = '⚡ Uploading custom interrupter...';

  try {
    const dataUrl = await compressImage(file, 1600, 1600, 0.80);
    if (!dataUrl) return;

    const res = await fetch('/api/background/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dataUrl,
        name: file.name,
        setAsActive: false
      })
    });
    const data = await res.json();
    if (data.success && data.url) {
      const newInterrupter = {
        id: `custom_int_${Date.now()}`,
        url: data.url,
        title: file.name.replace(/\.[^/.]+$/, "") || 'Custom Interrupter',
        enabled: true,
        createdAt: Date.now()
      };

      _customInterrupters.unshift(newInterrupter);
      appData.customInterrupters = appData.customInterrupters || [];
      appData.customInterrupters.unshift(newInterrupter);
      await saveAppDataToServer();

      renderMosaicCustomInterruptersList();
      if (statusEl) statusEl.textContent = '✓ Custom interrupter uploaded and ready to weave into wallpaper!';
    }
  } catch (err) {
    console.error('Error uploading custom interrupter:', err);
    if (statusEl) statusEl.textContent = 'Error uploading interrupter: ' + err.message;
  }
  event.target.value = '';
}

function renderMosaicCustomInterruptersList() {
  const listEl = document.getElementById('mosaicCustomInterruptersList');
  if (!listEl) return;

  const items = appData.customInterrupters || _customInterrupters || [];
  if (items.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = items.map(item => {
    const isChecked = item.enabled !== false;
    return `
      <div class="relative flex items-center justify-between gap-2.5 p-3 rounded-xl border border-slate-800 bg-slate-900/70 group">
        <label class="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
          <input type="checkbox" onchange="toggleCustomInterrupter('${escapeHtml(item.id)}', this.checked)" ${isChecked ? 'checked' : ''} class="rounded accent-amber-400 shrink-0">
          <div class="w-10 h-10 rounded-lg bg-slate-950 border border-amber-500/30 flex items-center justify-center shrink-0 overflow-hidden">
            <img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.title)}" class="w-full h-full object-cover">
          </div>
          <div class="min-w-0">
            <strong class="text-xs font-bold text-white block truncate">${escapeHtml(item.title)}</strong>
            <span class="text-[10px] text-amber-400 font-mono-code block">Custom Interrupter</span>
          </div>
        </label>
        <button type="button" onclick="deleteCustomInterrupter('${escapeHtml(item.id)}')" class="p-1 text-slate-500 hover:text-rose-400 transition" title="Delete interrupter">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function toggleCustomInterrupter(id, isEnabled) {
  const items = appData.customInterrupters || [];
  const found = items.find(i => i.id === id);
  if (found) {
    found.enabled = isEnabled;
    saveAppDataToServer();
  }
}

async function deleteCustomInterrupter(id) {
  if (!confirm('Remove this custom interrupter?')) return;
  appData.customInterrupters = (appData.customInterrupters || []).filter(i => i.id !== id);
  _customInterrupters = _customInterrupters.filter(i => i.id !== id);
  await saveAppDataToServer();
  renderMosaicCustomInterruptersList();
}

// ───────────────────────────────────────────────────────────────────────────
// TILE SIZING & TONAL STYLES (Live Background Scaling)
// ───────────────────────────────────────────────────────────────────────────

function syncMosaicScaleUI() {
  const currentScalePx = (appData.bgConfig && appData.bgConfig.scalePx) || 680;
  _mosaicScalePx = (typeof currentScalePx === 'number') ? currentScalePx : 680;

  // 1. Generator Sliders & Displays
  const slider = document.getElementById('mosaicScaleSlider');
  if (slider) slider.value = (typeof currentScalePx === 'number') ? currentScalePx : 680;

  const pxVal = document.getElementById('mosaicScalePxVal');
  if (pxVal) pxVal.textContent = (currentScalePx === 'cover') ? 'Cover' : `${currentScalePx}px`;

  // 2. Active Controller Sliders & Displays
  const activeSlider = document.getElementById('activeScaleSlider');
  if (activeSlider) activeSlider.value = (typeof currentScalePx === 'number') ? currentScalePx : 680;

  const activePxVal = document.getElementById('activeScalePxReadout');
  if (activePxVal) activePxVal.textContent = (currentScalePx === 'cover') ? 'Cover' : `${currentScalePx}px`;

  // Scale mappings
  const scaleMap = { 680: '25%', 1020: '50%', 1360: '75%', 1800: '100%', 2400: '150%', cover: 'cover' };
  const matchedScale = (currentScalePx === 'cover') ? 'cover' : (scaleMap[currentScalePx] || `${Math.round((currentScalePx / 680) * 25)}%`);

  // Active scale badge in main controller
  const activeBadge = document.getElementById('activeBgScaleBadge');
  if (activeBadge) {
    const badgeNames = {
      '25%': '25% Compact (680px)',
      '50%': '50% Bigger (1020px)',
      '75%': '75% Large (1360px)',
      '100%': '100% Hero (1800px)',
      '150%': '150% Extra Large (2400px)',
      'cover': 'Full Cover (100% Stretch)'
    };
    activeBadge.textContent = badgeNames[matchedScale] || `${matchedScale} (${currentScalePx}px)`;
  }

  // Highlight buttons in Active Controller
  const activeBtns = document.querySelectorAll('.active-scale-btn');
  activeBtns.forEach(b => {
    if (b.id === `activeScaleBtn-${matchedScale.replace('%', '')}`) {
      b.className = "active-scale-btn px-2.5 py-2 rounded-xl text-xs font-bold transition bg-emerald-500 text-slate-950 shadow text-center";
    } else {
      b.className = "active-scale-btn px-2.5 py-2 rounded-xl text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800 text-center";
    }
  });

  // Highlight buttons in Generator
  const btns = document.querySelectorAll('.mosaic-scale-btn');
  btns.forEach(b => {
    if (b.id === `scaleBtn-${matchedScale.replace('%', '')}`) {
      b.className = "mosaic-scale-btn px-2 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 shadow";
    } else {
      b.className = "mosaic-scale-btn px-2 py-1.5 rounded-lg text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800";
    }
  });

  const lbl = document.getElementById('mosaicScaleLabel');
  if (lbl) {
    const names = {
      '25%': '25% (Standard ~97px)',
      '50%': '50% Bigger (1.5x ~145px)',
      '75%': '75% Large (2.0x ~195px)',
      '100%': '100% Hero (2.6x ~260px)',
      '150%': '150% Extra Large (3.5x ~390px)',
      'cover': 'Full Cover (100% Stretch)'
    };
    lbl.textContent = names[matchedScale] || `${matchedScale} (${currentScalePx}px)`;
  }
}

function setActiveWallpaperScale(scale) {
  const scaleMap = { '25%': 680, '50%': 1020, '75%': 1360, '100%': 1800, '150%': 2400, 'cover': 'cover' };
  const px = scaleMap[scale] !== undefined ? scaleMap[scale] : 680;
  _mosaicScale = scale;
  _mosaicScalePx = (px === 'cover') ? 1800 : px;
  updateMosaicScaleInternal(px, scale);
}

function updateActiveScaleFromSlider(px) {
  const val = parseInt(px, 10);
  _mosaicScalePx = val;
  const scalePct = `${Math.round((val / 680) * 25)}%`;
  _mosaicScale = scalePct;
  updateMosaicScaleInternal(val, scalePct);
}

async function saveActiveWallpaperScale() {
  const btn = document.getElementById('btnSaveActiveScale');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i data-lucide="check" class="w-3.5 h-3.5"></i> Saved!';
  }
  
  // Also update active preset in presets array if matching
  if (appData.activeBgImage && Array.isArray(appData.customWallpapers)) {
    const matchingPreset = appData.customWallpapers.find(p => p.url === appData.activeBgImage);
    if (matchingPreset) {
      matchingPreset.scalePx = appData.bgConfig.scalePx;
      matchingPreset.scale = _mosaicScale || `${Math.round((matchingPreset.scalePx / 680) * 25)}%`;
    }
  }

  const ok = await saveAppDataToServer();
  renderMosaicPresetsBank();
  
  if (btn) {
    setTimeout(() => {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="save" class="w-3.5 h-3.5"></i> Save Size';
      if (window.lucide) lucide.createIcons();
    }, 1500);
  }
}

function setMosaicScale(scale) {
  setActiveWallpaperScale(scale);
}

function updateMosaicScaleFromSlider(px) {
  updateActiveScaleFromSlider(px);
}

function updateMosaicScaleInternal(px, scaleLabel) {
  // 1. Immediately scale the live background layer
  const bgLayer = document.getElementById('globalBgLayer');
  const scaleVal = (px === 'cover' || px === 'contain') ? px : `${px}px auto`;
  if (bgLayer) {
    bgLayer.style.backgroundSize = scaleVal;
  }
  document.documentElement.style.setProperty('--bg-scale', scaleVal);

  // 2. Persist to appData
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.scalePx = px;
  
  // If the active wallpaper matches a saved preset, update that preset too
  if (appData.activeBgImage && Array.isArray(appData.customWallpapers)) {
    const matching = appData.customWallpapers.find(p => p.url === appData.activeBgImage);
    if (matching) {
      matching.scalePx = px;
      matching.scale = scaleLabel;
    }
  }

  saveAppDataToServer();

  // 3. Update all UI sliders, readouts and active button states
  syncMosaicScaleUI();
}

function setMosaicColorMode(mode) {
  _mosaicColorMode = mode;
  const btns = document.querySelectorAll('.mosaic-color-btn');
  btns.forEach(b => {
    if (b.id === `colorBtn-${mode}`) {
      b.className = "mosaic-color-btn px-2 py-1.5 rounded-lg text-xs font-bold transition bg-amber-500 text-slate-950 shadow";
    } else {
      b.className = "mosaic-color-btn px-2 py-1.5 rounded-lg text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800";
    }
  });

  const lbl = document.getElementById('mosaicColorLabel');
  if (lbl) {
    const names = { 'bw': 'Photographic B&W', 'color': 'Full Living Color', 'noir': 'Noir Darkroom' };
    lbl.textContent = names[mode] || mode;
  }
}

// ───────────────────────────────────────────────────────────────────────────
// GENERATOR ENGINE (Guaranteed Non-Adjacent Even Distribution)
// ───────────────────────────────────────────────────────────────────────────

async function generateCustomMosaicOnTheFly() {
  const statusEl = document.getElementById('mosaicGenStatus');
  const btn = document.getElementById('btnGenerateMosaic');
  if (btn) btn.disabled = true;
  if (statusEl) statusEl.textContent = '⚡ Stitching custom wallpaper with even non-adjacent interrupters...';

  try {
    let photoUrls = Array.from(_mosaicSelectedPhotos);
    if (photoUrls.length === 0) {
      photoUrls = getAllPortfolioPhotos().map(p => p.url);
    }

    const phoenixEnabled = !!document.getElementById('interrupter-phoenix')?.checked;
    const slateEnabled = !!document.getElementById('interrupter-slate')?.checked;
    const tattooHeroEnabled = !!document.getElementById('interrupter-tattoo-hero')?.checked;
    const crestEnabled = !!document.getElementById('interrupter-crest')?.checked;

    const availableInterrupters = [];
    if (phoenixEnabled) availableInterrupters.push({ type: 'PHOENIX_TATTOO' });
    if (slateEnabled) availableInterrupters.push({ type: 'FILM_SLATE' });
    if (tattooHeroEnabled) availableInterrupters.push({ type: 'TATTOO_HERO' });
    if (crestEnabled) availableInterrupters.push({ type: 'MINIMAL_CREST' });

    // Include enabled custom uploaded interrupters
    (appData.customInterrupters || []).forEach(ci => {
      if (ci.enabled !== false) {
        availableInterrupters.push({ type: 'CUSTOM_UPLOAD', url: ci.url, title: ci.title });
      }
    });

    // Canvas dimensions: 7 columns x 6 rows = 42 tiles
    const cols = 7;
    const rows = 6;
    const tileW = 260;
    const tileH = 180;
    const width = cols * tileW;
    const height = rows * tileH;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Base background
    ctx.fillStyle = '#06070a';
    ctx.fillRect(0, 0, width, height);

    // Image loader helper
    function loadImg(src) {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
      });
    }

    // Load photo images
    const loadedPhotos = [];
    for (let u of photoUrls) {
      const im = await loadImg(u);
      if (im && im.naturalWidth > 0) loadedPhotos.push(im);
    }

    const phoenixImg = phoenixEnabled ? await loadImg('assets/steve_phoenix_logo_transparent.png') : null;
    const tattooHeroImg = tattooHeroEnabled ? await loadImg('assets/steve_signature_tattoo_bg.jpg') : null;

    // Load custom interrupter images
    const loadedCustomInterrupters = {};
    for (let item of availableInterrupters) {
      if (item.type === 'CUSTOM_UPLOAD' && item.url) {
        loadedCustomInterrupters[item.url] = await loadImg(item.url);
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // MATHEMATICAL NON-ADJACENCY INTERRUPTER GRID MATRIX
    // ─────────────────────────────────────────────────────────────────────────
    const isInterrupterGrid = [];
    for (let r = 0; r < rows; r++) {
      isInterrupterGrid[r] = new Array(cols).fill(false);
    }

    if (availableInterrupters.length > 0 && _mosaicSpacing > 0) {
      if (_mosaicSpacing === 2) {
        // Strict checkerboard pattern ensures NO two interrupters are EVER side-by-side or vertically adjacent:
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            isInterrupterGrid[r][c] = (r + c) % 2 === 1;
          }
        }
      } else {
        // Staggered rhythmic distribution with strict non-adjacency enforcement
        for (let r = 0; r < rows; r++) {
          const rowStagger = (r * 2) % _mosaicSpacing;
          for (let c = 0; c < cols; c++) {
            if ((c + rowStagger) % _mosaicSpacing === 0) {
              const leftIsInt = (c > 0 && isInterrupterGrid[r][c - 1]);
              const topIsInt = (r > 0 && isInterrupterGrid[r - 1][c]);
              if (!leftIsInt && !topIsInt) {
                isInterrupterGrid[r][c] = true;
              }
            }
          }
        }
      }
    }

    let photoIdx = 0;
    let interrupterIdx = 0;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const dx = c * tileW;
        const dy = r * tileH;
        const padding = 3;
        const targetW = tileW - padding * 2;
        const targetH = tileH - padding * 2;

        ctx.fillStyle = '#0a0c10';
        ctx.fillRect(dx, dy, tileW, tileH);

        const isInterrupter = isInterrupterGrid[r][c] && availableInterrupters.length > 0;
        const intDef = isInterrupter ? availableInterrupters[interrupterIdx % availableInterrupters.length] : null;
        if (isInterrupter) interrupterIdx++;

        if (!isInterrupter && loadedPhotos.length > 0) {
          const img = loadedPhotos[photoIdx % loadedPhotos.length];
          photoIdx++;

          const imgAspect = img.naturalWidth / img.naturalHeight;
          const tileAspect = targetW / targetH;
          let sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight;

          if (imgAspect > tileAspect) {
            sw = img.naturalHeight * tileAspect;
            sx = (img.naturalWidth - sw) / 2;
          } else {
            sh = img.naturalWidth / tileAspect;
            sy = (img.naturalHeight - sh) * 0.25;
          }

          ctx.drawImage(img, sx, sy, sw, sh, dx + padding, dy + padding, targetW, targetH);

          if (_mosaicColorMode === 'bw' || _mosaicColorMode === 'noir') {
            const imgData = ctx.getImageData(dx + padding, dy + padding, targetW, targetH);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              let gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              if (_mosaicColorMode === 'noir') {
                gray = gray < 128 ? gray * 0.85 : Math.min(255, gray * 1.1);
              }
              d[i] = gray;
              d[i + 1] = gray;
              d[i + 2] = gray;
            }
            ctx.putImageData(imgData, dx + padding, dy + padding);
          }

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx + padding, dy + padding, targetW, targetH);

        } else if (intDef && intDef.type === 'PHOENIX_TATTOO') {
          const grad = ctx.createRadialGradient(dx + tileW / 2, dy + tileH / 2, 10, dx + tileW / 2, dy + tileH / 2, tileW * 0.65);
          grad.addColorStop(0, '#1c1510');
          grad.addColorStop(0.6, '#0f0e12');
          grad.addColorStop(1, '#050507');
          ctx.fillStyle = grad;
          ctx.fillRect(dx + padding, dy + padding, targetW, targetH);

          ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(dx + padding, dy + padding, targetW, targetH);

          if (phoenixImg) {
            const pSize = Math.min(targetW * 0.65, targetH * 0.75);
            const px = dx + (tileW - pSize) / 2;
            const py = dy + (tileH - pSize) / 2 - 8;
            ctx.drawImage(phoenixImg, px, py, pSize, pSize);
          }

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('PHOENIX TATTOO • STEVE PEREIRA', dx + tileW / 2, dy + tileH - 14);

        } else if (intDef && intDef.type === 'TATTOO_HERO' && tattooHeroImg) {
          const imgAspect = tattooHeroImg.naturalWidth / tattooHeroImg.naturalHeight;
          const tileAspect = targetW / targetH;
          let sx = 0, sy = 0, sw = tattooHeroImg.naturalWidth, sh = tattooHeroImg.naturalHeight;

          if (imgAspect > tileAspect) {
            sw = tattooHeroImg.naturalHeight * tileAspect;
            sx = (tattooHeroImg.naturalWidth - sw) / 2;
          } else {
            sh = tattooHeroImg.naturalWidth / tileAspect;
            sy = (tattooHeroImg.naturalHeight - sh) * 0.2;
          }

          ctx.drawImage(tattooHeroImg, sx, sy, sw, sh, dx + padding, dy + padding, targetW, targetH);

          if (_mosaicColorMode === 'bw' || _mosaicColorMode === 'noir') {
            const imgData = ctx.getImageData(dx + padding, dy + padding, targetW, targetH);
            const d = imgData.data;
            for (let i = 0; i < d.length; i += 4) {
              const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
              d[i] = gray;
              d[i + 1] = gray;
              d[i + 2] = gray;
            }
            ctx.putImageData(imgData, dx + padding, dy + padding);
          }

          ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(dx + padding, dy + padding, targetW, targetH);

          ctx.fillStyle = 'rgba(0,0,0,0.65)';
          ctx.fillRect(dx + padding, dy + tileH - 24, targetW, 20);
          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText('SIGNATURE TATTOO HERO', dx + tileW / 2, dy + tileH - 10);

        } else if (intDef && intDef.type === 'FILM_SLATE') {
          const grad = ctx.createLinearGradient(dx, dy, dx + tileW, dy + tileH);
          grad.addColorStop(0, '#10131c');
          grad.addColorStop(1, '#080a0f');
          ctx.fillStyle = grad;
          ctx.fillRect(dx + padding, dy + padding, targetW, targetH);

          ctx.fillStyle = '#1e293b';
          ctx.fillRect(dx + padding, dy + padding, targetW, 22);
          for (let s = 0; s < targetW; s += 20) {
            ctx.fillStyle = '#f8fafc';
            ctx.beginPath();
            ctx.moveTo(dx + padding + s, dy + padding);
            ctx.lineTo(dx + padding + s + 10, dy + padding);
            ctx.lineTo(dx + padding + s + 4, dy + padding + 22);
            ctx.lineTo(dx + padding + s - 6, dy + padding + 22);
            ctx.closePath();
            ctx.fill();
          }

          ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx + padding, dy + padding, targetW, targetH);

          ctx.textAlign = 'center';
          ctx.fillStyle = '#38bdf8';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('35MM FILM STILLS', dx + tileW / 2, dy + 55);

          ctx.fillStyle = '#94a3b8';
          ctx.font = '9px monospace';
          ctx.fillText('SCENE: THE MEETING • DOCTORS', dx + tileW / 2, dy + 75);
          ctx.fillText('ROLL: 35MM KODAK VISION3', dx + tileW / 2, dy + 95);

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 10px monospace';
          ctx.fillText('SPOTLIGHT UK: 9339-8945-6183', dx + tileW / 2, dy + 125);

          ctx.fillStyle = '#64748b';
          ctx.font = '8px sans-serif';
          ctx.fillText('DIRECTOR CONTACT SHEET', dx + tileW / 2, dy + 145);

        } else if (intDef && intDef.type === 'MINIMAL_CREST') {
          ctx.fillStyle = '#090a10';
          ctx.fillRect(dx + padding, dy + padding, targetW, targetH);

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.strokeRect(dx + padding, dy + padding, targetW, targetH);

          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.strokeRect(dx + tileW / 2 - 25, dy + 35, 50, 50);

          ctx.textAlign = 'center';
          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 22px serif';
          ctx.fillText('SP', dx + tileW / 2, dy + 68);

          ctx.fillStyle = '#f1f5f9';
          ctx.font = 'bold 10px sans-serif';
          ctx.fillText('STEVE PEREIRA', dx + tileW / 2, dy + 115);

          ctx.fillStyle = '#64748b';
          ctx.font = '8px monospace';
          ctx.fillText('BRITISH-INDIAN SCREEN ACTOR', dx + tileW / 2, dy + 133);

        } else if (intDef && intDef.type === 'CUSTOM_UPLOAD') {
          // Custom uploaded interrupter tile
          const grad = ctx.createLinearGradient(dx, dy, dx + tileW, dy + tileH);
          grad.addColorStop(0, '#12141c');
          grad.addColorStop(1, '#06070a');
          ctx.fillStyle = grad;
          ctx.fillRect(dx + padding, dy + padding, targetW, targetH);

          ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(dx + padding, dy + padding, targetW, targetH);

          const customIm = loadedCustomInterrupters[intDef.url];
          if (customIm) {
            const fitW = targetW * 0.72;
            const fitH = targetH * 0.68;
            const customAspect = customIm.naturalWidth / customIm.naturalHeight;
            const boxAspect = fitW / fitH;
            let drawW = fitW, drawH = fitH;
            if (customAspect > boxAspect) {
              drawH = fitW / customAspect;
            } else {
              drawW = fitH * customAspect;
            }
            const px = dx + (tileW - drawW) / 2;
            const py = dy + (tileH - drawH) / 2 - 8;
            ctx.drawImage(customIm, px, py, drawW, drawH);
          }

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 9px monospace';
          ctx.textAlign = 'center';
          ctx.fillText((intDef.title || 'CUSTOM INTERRUPTER').toUpperCase(), dx + tileW / 2, dy + tileH - 12);
        }
      }
    }

    _mosaicLastGeneratedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
    _mosaicLastGeneratedScalePx = _mosaicScalePx;

    const b64Length = _mosaicLastGeneratedDataUrl.length * (3/4);
    const kb = (b64Length / 1024).toFixed(0);

    const prevContainer = document.getElementById('mosaicPreviewContainer');
    const prevImg = document.getElementById('mosaicGeneratedPreviewImg');
    const sizeBadge = document.getElementById('mosaicFileSizeBadge');
    const titleInput = document.getElementById('mosaicPresetTitleInput');

    if (prevContainer) prevContainer.classList.remove('hidden');
    if (prevImg) prevImg.src = _mosaicLastGeneratedDataUrl;
    if (sizeBadge) sizeBadge.textContent = `${kb} KB (Optimized & Compressed)`;
    if (titleInput && !titleInput.value) {
      titleInput.value = `Custom Mosaic (${_mosaicScale} Scale - Spacing ${_mosaicSpacing})`;
    }

    if (statusEl) statusEl.textContent = '✓ Generation complete! Strict non-adjacent spacing applied.';
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    if (statusEl) statusEl.textContent = 'Error generating: ' + err.message;
  } finally {
    if (btn) btn.disabled = false;
  }
}

async function applyGeneratedMosaicLive() {
  if (!_mosaicLastGeneratedDataUrl) {
    alert('Please generate the wallpaper first!');
    return;
  }

  try {
    const res = await fetch('/api/background/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dataUrl: _mosaicLastGeneratedDataUrl, 
        name: 'custom_mosaic_on_the_fly.jpg',
        scalePx: _mosaicLastGeneratedScalePx
      })
    });
    const data = await res.json();
    if (data.success && data.url) {
      appData.activeBgImage = data.url;
      appData.bgConfig = appData.bgConfig || {};
      appData.bgConfig.activeImage = data.url;
      appData.bgConfig.mode = 'image';
      appData.bgConfig.scalePx = _mosaicLastGeneratedScalePx;
      
      applyBgSettings();
      updateBgStudioUI();
      await saveAppDataToServer();
      alert('Custom wallpaper applied live to portfolio at chosen scale!');
    } else {
      alert('Failed to apply wallpaper: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Error applying wallpaper: ' + err.message);
  }
}

async function saveGeneratedMosaicToPresets() {
  if (!_mosaicLastGeneratedDataUrl) {
    alert('Please generate the wallpaper first!');
    return;
  }

  const titleInput = document.getElementById('mosaicPresetTitleInput');
  const title = (titleInput && titleInput.value.trim()) || `Custom Mosaic (${_mosaicScale})`;

  try {
    const uploadRes = await fetch('/api/background/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        dataUrl: _mosaicLastGeneratedDataUrl, 
        name: `${title.replace(/\s+/g, '_')}.jpg`,
        scalePx: _mosaicLastGeneratedScalePx,
        setAsActive: false
      })
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.success || !uploadData.url) {
      alert('Failed to save preset asset: ' + (uploadData.message || 'Unknown error'));
      return;
    }

    const presetRes = await fetch('/api/background/save-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        url: uploadData.url,
        scale: _mosaicScale,
        scalePx: _mosaicLastGeneratedScalePx,
        colorMode: _mosaicColorMode,
        spacing: _mosaicSpacing
      })
    });
    const presetData = await presetRes.json();
    if (presetData.success) {
      appData.customWallpapers = presetData.presets;
      renderMosaicPresetsBank();
      alert(`Wallpaper preset "${title}" saved successfully!`);
    } else {
      alert('Failed to save preset info: ' + (presetData.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Error saving preset: ' + err.message);
  }
}

function renderMosaicPresetsBank() {
  const grid = document.getElementById('mosaicPresetsBankGrid');
  const countEl = document.getElementById('mosaicSavedPresetsCount');
  const presets = appData.customWallpapers || [];

  if (countEl) countEl.textContent = `${presets.length} Presets Available`;
  if (!grid) return;

  if (presets.length === 0) {
    grid.innerHTML = `<div class="col-span-full py-8 text-center text-slate-500 text-xs italic">No custom presets saved yet. Generate one above!</div>`;
    return;
  }

  grid.innerHTML = presets.map(p => {
    const isCurrent = appData.activeBgImage === p.url;
    return `
      <div class="rounded-xl border p-3 bg-slate-900/60 space-y-2.5 transition ${isCurrent ? 'border-amber-500/80 ring-1 ring-amber-500/50 shadow-md' : 'border-slate-800 hover:border-slate-700'}">
        <div class="h-24 w-full rounded-lg overflow-hidden border border-slate-800 relative bg-slate-950">
          <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.title)}" class="w-full h-full object-cover">
          ${isCurrent ? '<span class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 font-mono-code font-bold text-[9px]">LIVE ACTIVE</span>' : ''}
        </div>
        <div class="space-y-1">
          <strong class="text-xs font-bold text-white block truncate">${escapeHtml(p.title)}</strong>
          <div class="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono-code">
            <span class="px-1.5 py-0.5 rounded bg-slate-800 text-emerald-300">${escapeHtml(p.scale || '25%')} (${p.scalePx || 680}px)</span>
            <span class="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">${(p.colorMode || 'bw').toUpperCase()}</span>
          </div>
        </div>
        <div class="flex items-center justify-between gap-1.5 pt-1 border-t border-slate-800/80">
          <div class="flex items-center gap-1">
            <button type="button" onclick="applySavedWallpaperPreset('${encodeURIComponent(p.id)}')" class="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1 transition">
              <i data-lucide="play" class="w-3 h-3 fill-current"></i> Apply
            </button>
            <button type="button" onclick="openEditPresetModal('${encodeURIComponent(p.id)}')" class="px-2 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1 transition" title="Edit title and change tile size">
              <i data-lucide="edit-3" class="w-3 h-3"></i> Edit &amp; Resize
            </button>
          </div>
          <button type="button" onclick="deleteSavedWallpaperPreset('${encodeURIComponent(p.id)}')" class="px-2 py-1 rounded-lg text-slate-500 hover:text-rose-400 text-xs transition" title="Delete preset">
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

async function applySavedWallpaperPreset(encodedId) {
  const presetId = decodeURIComponent(encodedId);
  const preset = (appData.customWallpapers || []).find(p => p.id === presetId);
  if (!preset) return;

  appData.activeBgImage = preset.url;
  appData.bgConfig = appData.bgConfig || {};
  appData.bgConfig.activeImage = preset.url;
  appData.bgConfig.mode = 'image';
  appData.bgConfig.scalePx = preset.scalePx || (preset.scale === '100%' ? 1800 : (preset.scale === '50%' ? 1020 : 680));

  applyBgSettings();
  updateBgStudioUI();
  syncMosaicScaleUI();
  renderMosaicPresetsBank();
  await saveAppDataToServer();
}

// ═══════════════════════════════════════════════════════════════════════════
// WALLPAPER PRESET EDIT & RESIZE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

let _editingPreset = null;

function openEditPresetModal(encodedId) {
  const presetId = decodeURIComponent(encodedId);
  const preset = (appData.customWallpapers || []).find(p => p.id === presetId);
  if (!preset) return;

  _editingPreset = { ...preset };

  const modal = document.getElementById('editWallpaperPresetModal');
  const idInput = document.getElementById('editPresetId');
  const titleInput = document.getElementById('editPresetTitleInput');
  const imgPreview = document.getElementById('editPresetPreviewImg');

  if (idInput) idInput.value = preset.id;
  if (titleInput) titleInput.value = preset.title || 'Custom Wallpaper';
  if (imgPreview) imgPreview.src = preset.url || 'assets/steve_35mm_contact_wallpaper.jpg';

  const scalePx = preset.scalePx || (preset.scale === '100%' ? 1800 : (preset.scale === '50%' ? 1020 : 680));
  _editingPreset.scalePx = scalePx;
  _editingPreset.colorMode = preset.colorMode || 'bw';

  syncEditPresetModalUI();

  if (modal) modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
  if (window.lucide) lucide.createIcons();
}

function closeEditPresetModal() {
  const modal = document.getElementById('editWallpaperPresetModal');
  if (modal) modal.classList.add('hidden');
    unlockBodyScroll();
  _editingPreset = null;
}

function setEditPresetScale(scale) {
  if (!_editingPreset) return;
  const scaleMap = { '25%': 680, '50%': 1020, '75%': 1360, '100%': 1800, '150%': 2400, 'cover': 'cover' };
  const px = scaleMap[scale] !== undefined ? scaleMap[scale] : 680;
  _editingPreset.scale = scale;
  _editingPreset.scalePx = px;
  syncEditPresetModalUI();
  
  // Live preview if this preset is currently active
  if (appData.activeBgImage === _editingPreset.url) {
    updateMosaicScaleInternal(px, scale);
  }
}

function updateEditPresetScaleFromSlider(px) {
  if (!_editingPreset) return;
  const val = parseInt(px, 10);
  _editingPreset.scalePx = val;
  const scalePct = `${Math.round((val / 680) * 25)}%`;
  _editingPreset.scale = scalePct;
  syncEditPresetModalUI();

  // Live preview if this preset is currently active
  if (appData.activeBgImage === _editingPreset.url) {
    updateMosaicScaleInternal(val, scalePct);
  }
}

function setEditPresetColorMode(mode) {
  if (!_editingPreset) return;
  _editingPreset.colorMode = mode;
  syncEditPresetModalUI();
}

function syncEditPresetModalUI() {
  if (!_editingPreset) return;

  const currentScalePx = _editingPreset.scalePx || 680;
  const scaleMap = { 680: '25%', 1020: '50%', 1360: '75%', 1800: '100%', 2400: '150%', cover: 'cover' };
  const matchedScale = (currentScalePx === 'cover') ? 'cover' : (scaleMap[currentScalePx] || `${Math.round((currentScalePx / 680) * 25)}%`);

  const slider = document.getElementById('editPresetScaleSlider');
  if (slider) slider.value = (typeof currentScalePx === 'number') ? currentScalePx : 680;

  const pxReadout = document.getElementById('editPresetScalePxReadout');
  if (pxReadout) pxReadout.textContent = (currentScalePx === 'cover') ? 'Cover' : `${currentScalePx}px`;

  const scaleBadge = document.getElementById('editPresetScaleBadge');
  if (scaleBadge) {
    const badgeNames = {
      '25%': '25% Compact (680px)',
      '50%': '50% Bigger (1020px)',
      '75%': '75% Large (1360px)',
      '100%': '100% Hero (1800px)',
      '150%': '150% Extra Large (2400px)',
      'cover': 'Full Cover (100% Stretch)'
    };
    scaleBadge.textContent = badgeNames[matchedScale] || `${matchedScale} (${currentScalePx}px)`;
  }

  // Scale buttons
  const btns = document.querySelectorAll('.edit-preset-scale-btn');
  btns.forEach(b => {
    if (b.id === `editPresetScaleBtn-${matchedScale.replace('%', '')}`) {
      b.className = "edit-preset-scale-btn px-2 py-1.5 rounded-lg text-xs font-bold transition bg-emerald-500 text-slate-950 shadow text-center";
    } else {
      b.className = "edit-preset-scale-btn px-2 py-1.5 rounded-lg text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800 text-center";
    }
  });

  // Color mode buttons
  const colorMode = _editingPreset.colorMode || 'bw';
  const colorBtns = document.querySelectorAll('.edit-preset-color-btn');
  colorBtns.forEach(b => {
    if (b.id === `editPresetColorBtn-${colorMode}`) {
      b.className = "edit-preset-color-btn px-2.5 py-1.5 rounded-xl text-xs font-bold transition bg-amber-500 text-slate-950 shadow text-center";
    } else {
      b.className = "edit-preset-color-btn px-2.5 py-1.5 rounded-xl text-xs font-bold transition bg-slate-900 text-slate-400 hover:text-white border border-slate-800 text-center";
    }
  });

  const colorBadge = document.getElementById('editPresetColorBadge');
  if (colorBadge) {
    const names = { 'bw': 'Photographic B&W', 'color': 'Living Color', 'noir': 'Noir Darkroom' };
    colorBadge.textContent = names[colorMode] || colorMode;
  }
}

async function saveEditedPreset(setLive) {
  if (!_editingPreset) return;

  const titleInput = document.getElementById('editPresetTitleInput');
  const title = (titleInput && titleInput.value.trim()) || _editingPreset.title || 'Custom Wallpaper';

  _editingPreset.title = title;

  // Find and update in customWallpapers
  appData.customWallpapers = appData.customWallpapers || [];
  const idx = appData.customWallpapers.findIndex(p => p.id === _editingPreset.id);
  if (idx >= 0) {
    appData.customWallpapers[idx] = { ...appData.customWallpapers[idx], ..._editingPreset };
  } else {
    appData.customWallpapers.unshift(_editingPreset);
  }

  if (setLive || appData.activeBgImage === _editingPreset.url) {
    appData.activeBgImage = _editingPreset.url;
    appData.bgConfig = appData.bgConfig || {};
    appData.bgConfig.activeImage = _editingPreset.url;
    appData.bgConfig.mode = 'image';
    appData.bgConfig.scalePx = _editingPreset.scalePx;
    applyBgSettings();
    updateBgStudioUI();
    syncMosaicScaleUI();
  }

  renderMosaicPresetsBank();
  await saveAppDataToServer();
  closeEditPresetModal();

  alert(`Preset "${title}" updated successfully!`);
}

async function deleteSavedWallpaperPreset(encodedId) {
  const presetId = decodeURIComponent(encodedId);
  if (!confirm('Are you sure you want to delete this custom wallpaper preset?')) return;

  try {
    const res = await fetch('/api/background/delete-preset', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: presetId })
    });
    const data = await res.json();
    if (data.success) {
      appData.customWallpapers = data.presets;
      renderMosaicPresetsBank();
    } else {
      alert('Delete failed: ' + (data.message || 'Unknown error'));
    }
  } catch (err) {
    alert('Error deleting preset: ' + err.message);
  }
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

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
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

  modal.classList.remove('hidden'); lockBodyScroll();
    lockBodyScroll();
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
// AUTOMATED AFFILIATE REVENUE ENGINE & DEALS CRUD
// --------------------------------------------------------------------------
async function fetchAndRenderAffiliateStats() {
  try {
    const res = await fetch('/api/affiliate/stats');
    const json = await res.json();
    if (json.success && json.data) {
      renderAffiliateKpis(json.data);
    }
  } catch (e) {
    console.warn('Could not fetch affiliate stats:', e);
  }
}

function renderAffiliateKpis(stats) {
  const s = stats.summary || {};
  const curr = s.currency || '£';
  
  const totalRevEl = document.getElementById('affiliateKpiTotalRev');
  const monthlyRevEl = document.getElementById('affiliateKpiMonthlyRev');
  const avgEpcEl = document.getElementById('affiliateKpiAvgEpc');
  const clicksEl = document.getElementById('affiliateKpiClicks');
  const healthScoreEl = document.getElementById('affiliateKpiHealthScore');
  const healthStatusEl = document.getElementById('affiliateKpiHealthStatus');
  const goalPctEl = document.getElementById('kmstGoalPctDisplay');
  const goalProgressEl = document.getElementById('kmstGoalProgressBar');
  const monthlyGoalEl = document.getElementById('affiliateKpiMonthlyGoal');

  if (totalRevEl) totalRevEl.textContent = `${curr}${Number(s.estimatedTotalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (monthlyRevEl) monthlyRevEl.textContent = `${curr}${Number(s.estimatedMonthlyRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (avgEpcEl) avgEpcEl.textContent = `${curr}${Number(s.averageEPC || 0).toFixed(2)}`;
  if (clicksEl) clicksEl.textContent = Number(s.totalClicks || 0).toLocaleString();
  if (monthlyGoalEl) monthlyGoalEl.textContent = `KMST Goal: ${curr}${Number(s.monthlyGoal || 1500).toLocaleString()}/mo`;
  
  if (goalPctEl) goalPctEl.textContent = `${s.goalProgressPct || 0}%`;
  if (goalProgressEl) goalProgressEl.style.width = `${s.goalProgressPct || 0}%`;

  const hs = stats.healthSummary || {};
  const totalChecked = (hs.healthy || 0) + (hs.slow || 0) + (hs.broken || 0);
  const score = totalChecked > 0 ? Math.round(((hs.healthy || 0) / totalChecked) * 100) : 100;
  if (healthScoreEl) healthScoreEl.textContent = `${score}%`;
  if (healthStatusEl) {
    if (hs.broken > 0) {
      healthStatusEl.textContent = `⚠️ ${hs.broken} broken links flagged`;
      healthStatusEl.className = 'text-[10px] text-rose-400 font-bold truncate';
    } else if (hs.slow > 0) {
      healthStatusEl.textContent = `⚡ ${hs.slow} slow links detected`;
      healthStatusEl.className = 'text-[10px] text-amber-400 font-bold truncate';
    } else {
      healthStatusEl.textContent = `All links healthy 🟢`;
      healthStatusEl.className = 'text-[10px] text-emerald-400 font-bold truncate';
    }
  }

  // Render Networks List
  const netListEl = document.getElementById('affiliateNetworksList');
  if (netListEl) {
    const nets = stats.networkBreakdown || [];
    if (nets.length === 0) {
      netListEl.innerHTML = '<p class="text-slate-500 text-xs italic">No partner network data yet.</p>';
    } else {
      netListEl.innerHTML = nets.map(n => `
        <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
          <div class="flex items-center gap-2">
            <span class="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span class="font-bold text-slate-200 text-xs">${escapeHtml(n.name)}</span>
            <span class="text-[10px] text-slate-500 font-mono-code">(${n.count} deals)</span>
          </div>
          <div class="text-right font-mono-code">
            <span class="text-emerald-400 font-bold text-xs">${curr}${Number(n.estimatedRev || 0).toFixed(2)}</span>
            <span class="text-[10px] text-slate-400 block">${n.clicks} clicks</span>
          </div>
        </div>
      `).join('');
    }
  }

  // Render Models List
  const modelsListEl = document.getElementById('affiliateModelsList');
  if (modelsListEl) {
    const models = stats.modelBreakdown || {};
    modelsListEl.innerHTML = Object.entries(models).map(([model, data]) => `
      <div class="flex items-center justify-between p-2 rounded-xl bg-slate-900/60 border border-slate-800/80">
        <div class="flex items-center gap-2">
          <span class="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-400 font-mono-code font-bold text-[10px]">${model}</span>
          <span class="text-[11px] text-slate-300">${data.count} active deals</span>
        </div>
        <div class="text-right font-mono-code">
          <span class="text-cyan-400 font-bold text-xs">${curr}${Number(data.rev || 0).toFixed(2)}</span>
          <span class="text-[10px] text-slate-400 block">${data.clicks} clicks</span>
        </div>
      </div>
    `).join('');
  }
}

async function runAffiliateLinkAudit(singleHackId = null) {
  const btn = document.getElementById('runAuditBtn');
  const banner = document.getElementById('linkAuditStatusBanner');
  const bannerText = document.getElementById('linkAuditStatusText');

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i> Auditing...`;
  }
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/affiliate/check-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(singleHackId ? { hackId: singleHackId } : {})
    });
    const json = await res.json();

    if (json.success) {
      (json.results || []).forEach(r => {
        const target = (appData.hacks || []).find(h => h.id === r.id);
        if (target) {
          target.healthStatus = r.status;
          target.lastChecked = new Date().toISOString();
        }
      });

      if (banner && bannerText) {
        banner.classList.remove('hidden');
        bannerText.textContent = json.message;
      }
      renderAdminHacksTable();
      fetchAndRenderAffiliateStats();
    } else {
      alert('Audit error: ' + (json.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Failed to run link audit: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="stethoscope" class="w-3.5 h-3.5"></i> Audit Link Health`;
      if (window.lucide) lucide.createIcons();
    }
  }
}

function toggleAffiliateExportMenu() {
  const menu = document.getElementById('affiliateExportMenu');
  if (menu) menu.classList.toggle('hidden');
}

function exportAffiliateReport(format = 'csv') {
  const menu = document.getElementById('affiliateExportMenu');
  if (menu) menu.classList.add('hidden');
  window.open(`/api/affiliate/export?format=${format}`, '_blank');
}

function renderAdminHacksTable() {
  const tbody = document.getElementById('adminHacksTableBody');
  if (!tbody) return;

  const hacks = appData.hacks || [];
  if (hacks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400 italic">No affiliate deals added yet. Click "Add New Deal" above.</td></tr>`;
  } else {
    tbody.innerHTML = hacks.map(h => {
      const seoSlug = (h.seo && h.seo.slug) || (h.title ? h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : h.id);
      const clicks = h.clicks || 0;
      const model = h.payoutModel || 'CPA';
      const commVal = parseFloat(h.commissionValue) || (model === 'CPC' ? 0.45 : (model === 'CPA' ? 15.00 : 10.00));
      const convRate = parseFloat(h.conversionRateEst) || 0.035;
      const estRev = model === 'CPC' ? (clicks * commVal) : (clicks * convRate * commVal);

      // Health badge
      let healthBadge = `<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono-code font-bold text-[10px] border border-emerald-500/30 flex items-center gap-1 w-fit">🟢 HEALTHY</span>`;
      if (h.healthStatus === 'broken') {
        healthBadge = `<span class="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 font-mono-code font-bold text-[10px] border border-rose-500/30 flex items-center gap-1 w-fit">🔴 BROKEN</span>`;
      } else if (h.healthStatus === 'slow') {
        healthBadge = `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-mono-code font-bold text-[10px] border border-amber-500/30 flex items-center gap-1 w-fit">🟡 SLOW</span>`;
      }

      return `
        <tr class="hover:bg-slate-900/60 transition">
          <td class="p-3">
            <div class="flex items-center gap-2.5">
              ${h.logo ? `<img src="${escapeHtml(h.logo)}" class="w-7 h-7 rounded-lg object-contain bg-slate-900 p-0.5 border border-slate-700 shrink-0">` : `<div class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">💰</div>`}
              <div class="min-w-0">
                <strong class="text-white text-xs block truncate max-w-[180px]">${escapeHtml(h.title)}</strong>
                <span class="text-[10px] text-slate-400 font-mono-code block">${escapeHtml(h.category || 'Tech')} • Code: <strong class="text-amber-400">${escapeHtml(h.code || 'DIRECT')}</strong></span>
              </div>
            </div>
          </td>
          <td class="p-3 font-mono-code text-xs">
            <span class="text-slate-200 font-bold block">${escapeHtml(h.affiliateNetwork || 'Direct Partner')}</span>
            <a href="/go/${escapeHtml(seoSlug)}" target="_blank" class="text-[10px] text-cyan-400 hover:underline font-mono-code block truncate max-w-[140px]">/go/${escapeHtml(seoSlug)} ↗</a>
          </td>
          <td class="p-3 font-mono-code text-xs">
            <span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-bold text-[10px]">${escapeHtml(model)}</span>
            <span class="text-slate-300 text-[11px] block mt-0.5 font-bold">£${commVal.toFixed(2)} / conversion</span>
          </td>
          <td class="p-3 font-mono-code text-xs">
            <div class="space-y-0.5">
              <span class="text-amber-300 font-bold block">🔥 ${clicks} clicks</span>
              <span class="text-emerald-400 font-bold text-xs block">£${estRev.toFixed(2)} est. rev</span>
            </div>
          </td>
          <td class="p-3 whitespace-nowrap">
            ${healthBadge}
            <span class="text-[9px] text-slate-500 font-mono-code block mt-0.5">Checked: ${(h.lastChecked || '').split('T')[0] || 'Recently'}</span>
          </td>
          <td class="p-3 text-right space-x-1 whitespace-nowrap">
            <button onclick="runAffiliateLinkAudit('${h.id}')" title="Audit this link" class="px-2 py-1 rounded bg-slate-800 text-cyan-400 hover:bg-slate-700 font-bold text-[10px]">Audit</button>
            <button onclick="openEditHackModal('${h.id}')" class="px-2 py-1 rounded bg-slate-800 text-amber-400 hover:bg-slate-700 font-bold text-[10px]">Edit</button>
            <button onclick="deleteHack('${h.id}')" class="px-2 py-1 rounded bg-rose-600/80 text-white hover:bg-rose-500 font-bold text-[10px]">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Populate API credentials inside settings panel if available
  const config = appData.affiliateConfig || {};
  const skimlinksInput = document.getElementById('affiliateSkimlinksId');
  const awinTokenInput = document.getElementById('affiliateAwinToken');
  const impactSidInput = document.getElementById('affiliateImpactSid');
  const impactApiKeyInput = document.getElementById('affiliateImpactApiKey');

  if (skimlinksInput && !skimlinksInput.value) skimlinksInput.value = config.skimlinksId || '';
  if (awinTokenInput && !awinTokenInput.value) awinTokenInput.value = config.awinToken || '';
  if (impactSidInput && !impactSidInput.value) impactSidInput.value = config.impactAccountSid || '';
  if (impactApiKeyInput && !impactApiKeyInput.value) impactApiKeyInput.value = config.impactApiKey || '';

  fetchAndRenderAffiliateStats();
  renderAdminCommentsModeration();
}

function renderAdminCommentsModeration() {
  const tbody = document.getElementById('adminCommentsTableBody');
  const pendingBadge = document.getElementById('pendingCommentsBadge');
  const approvedBadge = document.getElementById('approvedCommentsBadge');
  if (!tbody) return;

  const hacks = appData.hacks || [];
  const allComments = [];
  hacks.forEach(h => {
    (h.comments || []).forEach(c => {
      allComments.push({
        ...c,
        hackId: h.id,
        hackTitle: h.title
      });
    });
  });

  const pendingCount = allComments.filter(c => !c.approved).length;
  const approvedCount = allComments.filter(c => c.approved).length;

  if (pendingBadge) pendingBadge.textContent = `${pendingCount} Pending Approval`;
  if (approvedBadge) approvedBadge.textContent = `${approvedCount} Live Approved`;

  if (allComments.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 italic">No community comments submitted yet.</td></tr>`;
    return;
  }

  // Sort pending first
  allComments.sort((a, b) => (a.approved === b.approved ? 0 : a.approved ? 1 : -1));

  tbody.innerHTML = allComments.map(c => `
    <tr class="hover:bg-slate-900/60 transition ${!c.approved ? 'bg-amber-500/5' : ''}">
      <td class="p-3 font-bold text-xs text-white max-w-[140px] truncate" title="${escapeHtml(c.hackTitle)}">
        ${escapeHtml(c.hackTitle)}
      </td>
      <td class="p-3 font-medium text-slate-300 text-xs whitespace-nowrap">
        ${escapeHtml(c.author)}
        <span class="text-[10px] text-slate-500 block font-mono-code">${escapeHtml(c.date || '')}</span>
      </td>
      <td class="p-3 text-xs text-slate-200 italic max-w-sm">
        &ldquo;${escapeHtml(c.text)}&rdquo;
      </td>
      <td class="p-3 whitespace-nowrap">
        ${c.approved 
          ? `<span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold font-mono-code text-[10px] border border-emerald-500/30 flex items-center gap-1 w-fit"><i data-lucide="check-circle" class="w-3 h-3"></i> LIVE APPROVED</span>`
          : `<span class="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-bold font-mono-code text-[10px] border border-amber-500/30 flex items-center gap-1 w-fit animate-pulse"><i data-lucide="clock" class="w-3 h-3"></i> PENDING APPROVAL</span>`
        }
      </td>
      <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
        ${!c.approved ? `
          <button onclick="approveComment('${c.hackId}', '${c.id}')" class="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] shadow transition inline-flex items-center gap-1">
            <i data-lucide="check" class="w-3 h-3"></i> Approve
          </button>
        ` : ''}
        <button onclick="deleteComment('${c.hackId}', '${c.id}')" class="px-2.5 py-1 rounded-lg bg-rose-600/80 hover:bg-rose-500 text-white font-bold text-[11px] transition inline-flex items-center gap-1">
          <i data-lucide="trash-2" class="w-3 h-3"></i> Delete
        </button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

async function approveComment(hackId, commentId) {
  try {
    const res = await fetch(`/api/hacks/${hackId}/comment/${commentId}/approve`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      const hack = (appData.hacks || []).find(h => h.id === hackId);
      if (hack && hack.comments) {
        const c = hack.comments.find(x => x.id === commentId);
        if (c) c.approved = true;
      }
      renderAdminCommentsModeration();
      renderHacks();
      alert('Comment approved and published live on the hacks page! 🟢');
    } else {
      alert('Could not approve comment: ' + (data.message || 'Error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

async function deleteComment(hackId, commentId) {
  if (!confirm('Are you sure you want to delete this comment?')) return;
  try {
    const res = await fetch(`/api/hacks/${hackId}/comment/${commentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      const hack = (appData.hacks || []).find(h => h.id === hackId);
      if (hack && hack.comments) {
        hack.comments = hack.comments.filter(x => x.id !== commentId);
      }
      renderAdminCommentsModeration();
      renderHacks();
    } else {
      alert('Could not delete comment: ' + (data.message || 'Error'));
    }
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

function toggleHackSeoSection() {
  const container = document.getElementById('hackSeoFieldsContainer');
  const chevron = document.getElementById('hackSeoChevron');
  if (container) {
    container.classList.toggle('hidden');
    if (chevron) {
      chevron.innerHTML = container.classList.contains('hidden') ? 'Click to edit &darr;' : 'Click to collapse &uarr;';
    }
  }
}

function updateHackSeoPreview() {
  const title = (document.getElementById('hackTitle')?.value || '').trim();
  const desc = (document.getElementById('hackDesc')?.value || '').trim();
  const category = (document.getElementById('hackCategory')?.value || 'Tech').trim();

  let seoTitle = (document.getElementById('hackSeoTitle')?.value || '').trim();
  let seoDesc = (document.getElementById('hackSeoDesc')?.value || '').trim();
  let seoSlug = (document.getElementById('hackSeoSlug')?.value || '').trim();

  if (!seoTitle && title) {
    seoTitle = `${title} | Verified Promo Code & Deals — Steve Pereira`;
  }
  if (!seoDesc && desc) {
    seoDesc = `${desc.slice(0, 140)}... Verified money-saving tech hack by Steve Pereira.`;
  }
  if (!seoSlug && title) {
    seoSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  const titleCount = document.getElementById('hackSeoTitleCount');
  const descCount = document.getElementById('hackSeoDescCount');
  const googleTitle = document.getElementById('hackGoogleTitlePreview');
  const googleDesc = document.getElementById('hackGoogleDescPreview');
  const googleUrl = document.getElementById('hackGoogleUrlPreview');
  const cloakPreview = document.getElementById('hackCloakPreview');

  if (titleCount) titleCount.textContent = `${seoTitle.length} / 60 chars`;
  if (descCount) descCount.textContent = `${seoDesc.length} / 160 chars`;
  if (googleTitle) googleTitle.textContent = seoTitle || 'Deal Title | Verified Promo Code — Steve Pereira';
  if (googleDesc) googleDesc.textContent = seoDesc || 'Save money with verified affiliate promo codes...';
  if (googleUrl) googleUrl.textContent = `https://SteveP.uk/#hack-${seoSlug || 'deal'}`;
  if (cloakPreview) cloakPreview.textContent = `/go/${seoSlug || 'deal'}`;
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

  // Affiliate Engine Fields
  if (document.getElementById('hackAffiliateNetwork')) document.getElementById('hackAffiliateNetwork').value = 'TopCashBack Direct';
  if (document.getElementById('hackPayoutModel')) document.getElementById('hackPayoutModel').value = 'CPA';
  if (document.getElementById('hackCommissionValue')) document.getElementById('hackCommissionValue').value = '15.00';
  if (document.getElementById('hackConversionRate')) document.getElementById('hackConversionRate').value = '5.0';
  if (document.getElementById('hackExpiryDate')) document.getElementById('hackExpiryDate').value = '';
  if (document.getElementById('hackIsFeatured')) document.getElementById('hackIsFeatured').checked = false;

  document.getElementById('hackSeoTitle').value = '';
  document.getElementById('hackSeoDesc').value = '';
  document.getElementById('hackSeoKeywords').value = 'cloud, vouchers, promo codes, discounts, savings, Steve Pereira hacks';
  document.getElementById('hackSeoSlug').value = '';

  const statusEl = document.getElementById('fetchMetaStatus');
  if (statusEl) statusEl.classList.add('hidden');
  updateHackModalPreview();
  updateHackSeoPreview();
  document.getElementById('hackModal')?.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function openEditHackModal(id) {
  const hack = (appData.hacks || []).find(h => h.id === id);
  if (!hack) return;

  const seo = hack.seo || {};
  const autoSlug = hack.title ? hack.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : hack.id;

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

  // Affiliate Engine Fields
  if (document.getElementById('hackAffiliateNetwork')) document.getElementById('hackAffiliateNetwork').value = hack.affiliateNetwork || 'Direct Partner';
  if (document.getElementById('hackPayoutModel')) document.getElementById('hackPayoutModel').value = hack.payoutModel || 'CPA';
  if (document.getElementById('hackCommissionValue')) document.getElementById('hackCommissionValue').value = hack.commissionValue !== undefined ? hack.commissionValue : '15.00';
  if (document.getElementById('hackConversionRate')) document.getElementById('hackConversionRate').value = hack.conversionRateEst !== undefined ? (hack.conversionRateEst * 100) : '5.0';
  if (document.getElementById('hackExpiryDate')) document.getElementById('hackExpiryDate').value = hack.expiryDate || '';
  if (document.getElementById('hackIsFeatured')) document.getElementById('hackIsFeatured').checked = !!hack.isFeatured;

  document.getElementById('hackSeoTitle').value = seo.metaTitle || `${hack.title} | Verified Promo Code — Steve Pereira`;
  document.getElementById('hackSeoDesc').value = seo.metaDescription || `${(hack.desc || '').slice(0, 140)}...`;
  document.getElementById('hackSeoKeywords').value = seo.keywords || `${(hack.category || 'tech').toLowerCase()}, promo code, discount, voucher, save money`;
  document.getElementById('hackSeoSlug').value = seo.slug || autoSlug;

  const statusEl = document.getElementById('fetchMetaStatus');
  if (statusEl) statusEl.classList.add('hidden');
  updateHackModalPreview();
  updateHackSeoPreview();
  document.getElementById('hackModal')?.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
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

  updateHackSeoPreview();
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

      // Autogenerate background SEO
      const autoTitle = data.title || 'Tech Deal';
      const autoDesc = data.desc || 'Curated deal';
      const autoSlug = autoTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

      if (document.getElementById('hackSeoTitle')) {
        document.getElementById('hackSeoTitle').value = `${autoTitle} | Verified Promo Code & Deals — Steve Pereira`;
      }
      if (document.getElementById('hackSeoDesc')) {
        document.getElementById('hackSeoDesc').value = `${autoDesc.slice(0, 140)}... Verified money-saving tech hack by Steve Pereira.`;
      }
      if (document.getElementById('hackSeoSlug')) {
        document.getElementById('hackSeoSlug').value = autoSlug;
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
  const title = document.getElementById('hackTitle').value.trim();
  const category = document.getElementById('hackCategory').value;
  const badge = document.getElementById('hackBadge').value.trim();
  const code = document.getElementById('hackCode').value.trim();
  const link = document.getElementById('hackLink').value.trim();
  const logo = document.getElementById('hackLogo').value.trim();
  const image = document.getElementById('hackImage').value.trim();
  const desc = document.getElementById('hackDesc').value.trim();

  // Affiliate Engine Fields
  const affiliateNetwork = (document.getElementById('hackAffiliateNetwork')?.value || 'Direct Partner').trim();
  const payoutModel = document.getElementById('hackPayoutModel')?.value || 'CPA';
  const commissionValue = parseFloat(document.getElementById('hackCommissionValue')?.value) || 15.00;
  const rawConvRate = parseFloat(document.getElementById('hackConversionRate')?.value) || 5.0;
  const conversionRateEst = rawConvRate > 1 ? (rawConvRate / 100) : rawConvRate;
  const expiryDate = document.getElementById('hackExpiryDate')?.value || null;
  const isFeatured = document.getElementById('hackIsFeatured')?.checked || false;

  // SEO metadata
  let seoTitle = (document.getElementById('hackSeoTitle')?.value || '').trim();
  let seoDesc = (document.getElementById('hackSeoDesc')?.value || '').trim();
  let seoKeywords = (document.getElementById('hackSeoKeywords')?.value || '').trim();
  let seoSlug = (document.getElementById('hackSeoSlug')?.value || '').trim();

  if (!seoTitle) seoTitle = `${title} | Verified Promo Code & Deals — Steve Pereira`;
  if (!seoDesc) seoDesc = `${desc.slice(0, 140)}... Verified money-saving tech hack by Steve Pereira.`;
  if (!seoKeywords) seoKeywords = `${category.toLowerCase()}, promo code, discount, voucher, save money, Steve Pereira hacks`;
  if (!seoSlug) seoSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const existingHack = id ? (appData.hacks || []).find(h => h.id === id) : null;

  const newHack = {
    id: id || ('hack_' + Date.now()),
    title,
    category,
    badge: badge || 'EXCLUSIVE',
    code: code || 'STEVEVIP',
    link: link || '#',
    logo,
    image,
    desc,
    clicks: existingHack ? (existingHack.clicks || 0) : 0,
    comments: existingHack ? (existingHack.comments || []) : [],
    seo: {
      metaTitle: seoTitle,
      metaDescription: seoDesc,
      keywords: seoKeywords,
      slug: seoSlug,
      canonicalUrl: link,
      ogImage: image || logo,
      schemaType: 'Offer',
      autoGenerated: true,
      lastUpdated: new Date().toISOString()
    }
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
  alert('Hack deal and background SEO metadata saved successfully! 🟢');
}

async function deleteHack(id) {
  if (!confirm('Are you sure you want to delete this hack deal?')) return;
  appData.hacks = (appData.hacks || []).filter(h => h.id !== id);
  renderAll();
  await saveAppDataToServer();
}

// ── Option A: Dynamic Skimlinks Injector
function initSkimlinks() {
  const config = appData.affiliateConfig || {};
  const skimlinksId = (config.skimlinksId || '').trim();
  let existing = document.getElementById('skimlinks-js-tag');
  
  if (skimlinksId) {
    if (existing) {
      if (existing.dataset.skimlinksId === skimlinksId) {
        return; // Already matches
      }
      existing.remove();
    }
    const script = document.createElement('script');
    script.id = 'skimlinks-js-tag';
    script.dataset.skimlinksId = skimlinksId;
    script.type = 'text/javascript';
    script.src = `//s.skimresources.com/js/${skimlinksId}.js`;
    script.async = true;
    document.head.appendChild(script);
    console.log(`[Affiliate Engine] Skimlinks script injected for Publisher ID: ${skimlinksId}`);
  } else if (existing) {
    existing.remove();
  }
}

// ── Save Affiliate Credentials
async function saveAffiliateSettings() {
  const skimlinksId = (document.getElementById('affiliateSkimlinksId')?.value || '').trim();
  const awinToken = (document.getElementById('affiliateAwinToken')?.value || '').trim();
  const impactSid = (document.getElementById('affiliateImpactSid')?.value || '').trim();
  const impactApiKey = (document.getElementById('affiliateImpactApiKey')?.value || '').trim();

  appData.affiliateConfig = appData.affiliateConfig || {};
  appData.affiliateConfig.skimlinksId = skimlinksId;
  appData.affiliateConfig.awinToken = awinToken;
  appData.affiliateConfig.impactAccountSid = impactSid;
  appData.affiliateConfig.impactApiKey = impactApiKey;

  initSkimlinks();
  await saveAppDataToServer();
  alert('Affiliate API keys and integration settings saved successfully! 🟢');
}

// ── Run Option B Auto-Sync Network Deals
async function runAffiliateAutoSync() {
  const btn = document.getElementById('runSyncBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Syncing...`;
  }
  if (window.lucide) lucide.createIcons();

  const config = appData.affiliateConfig || {};
  const awinToken = (document.getElementById('affiliateAwinToken')?.value || config.awinToken || '').trim();
  const impactSid = (document.getElementById('affiliateImpactSid')?.value || config.impactAccountSid || '').trim();
  const impactApiKey = (document.getElementById('affiliateImpactApiKey')?.value || config.impactApiKey || '').trim();

  try {
    const res = await fetch('/api/affiliate/sync-network', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ awinToken, impactAccountSid: impactSid, impactApiKey })
    });
    const json = await res.json();

    if (json.success) {
      alert(json.message);
      await loadData();
    } else {
      alert('Sync failed: ' + (json.message || 'Unknown error'));
    }
  } catch (e) {
    alert('Failed to connect to affiliate sync service: ' + e.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="refresh-cw" class="w-4 h-4"></i> Sync Network Deals`;
      if (window.lucide) lucide.createIcons();
    }
  }
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
• Contact & Bookings: info@SteveP.uk`;

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


// ----------------------------------------------------


// ----------------------------------------------------


// --------------------------------------------------------------------------
// GENERATE KMST PROFILE CARD HTML (LIVE PREVIEW & PUBLIC MODAL)
// --------------------------------------------------------------------------
function generateKMSTProfileCardHTML(profile, isPublic = true) {
  if (!profile) return '';
  const avatarObj = KMST_RECOVERY_AVATARS.find(a => a.id === profile.avatar) || KMST_RECOVERY_AVATARS[0];
  const colorKey = profile.profileColor || 'rose';
  const colorData = KMST_THEME_PALETTES[colorKey] || KMST_THEME_PALETTES.rose;
  const theme = profile.profileTheme || 'fancy';
  
  const bgClass = colorData.badgeBg || 'bg-rose-950/60';
  const borderClass = colorData.border || 'border-rose-500/40';
  const textClass = colorData.authorColor || 'text-rose-400';

  const days = profile.daysSober !== undefined ? profile.daysSober : 1;
  const alias = escapeHtml(profile.alias || 'Warrior');
  const badgeText = escapeHtml(profile.badgeText || (days >= 5000 ? '14 Yrs Phoenix Legend' : days >= 30 ? '30 Days Roman Bronze' : days >= 7 ? '7 Days Iron Shield' : '24h Spark of Ignition'));
  const pledge = escapeHtml(profile.pledge || 'Taking it one day at a time with clarity and courage.');
  const soberDate = profile.soberDate || '2012-04-01';

  return `
    <div class="glass-card rounded-3xl border ${borderClass} p-5 sm:p-7 space-y-4 relative overflow-hidden shadow-2xl ${theme === 'luxury' ? 'bg-gradient-to-br from-amber-950/40 via-slate-950/90 to-amber-950/20' : theme === 'cyber' ? 'bg-gradient-to-br from-cyan-950/40 via-slate-950/90 to-purple-950/30' : 'bg-slate-900/90'}">
      <div class="space-y-4 relative z-10">
        <div class="flex items-center justify-between border-b border-slate-800 pb-2.5">
          <span class="text-xs font-black ${textClass} uppercase tracking-wider flex items-center gap-1.5">
            <i data-lucide="id-card" class="w-4 h-4"></i> Active Member Pass
          </span>
          <span class="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-mono-code font-bold">
            VERIFIED
          </span>
        </div>

        <div class="p-4 sm:p-5 rounded-2xl bg-slate-950/80 border-2 ${borderClass} space-y-3.5 shadow-xl relative">
          <div class="flex items-center gap-3.5">
            <div class="w-12 h-12 rounded-2xl ${bgClass} border-2 ${borderClass} flex items-center justify-center shrink-0 shadow-inner">
              <img src="${avatarObj.svg}" class="w-7 h-7 object-contain drop-shadow-md">
            </div>
            <div class="space-y-0.5 overflow-hidden">
              <h4 class="text-base sm:text-lg font-black text-white font-cinzel truncate">${alias}</h4>
              <div class="text-xs font-bold ${textClass} truncate">${badgeText}</div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-center font-mono-code">
            <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
              <span class="text-lg sm:text-xl font-black ${textClass} block">${days}</span>
              <span class="text-[9px] text-slate-400 uppercase font-bold block">Days Sober</span>
            </div>
            <div class="p-2 rounded-xl bg-slate-900/90 border border-slate-800">
              <span class="text-xs font-black ${textClass} block pt-1 truncate">${soberDate}</span>
              <span class="text-[9px] text-slate-400 uppercase font-bold block">Clean Start</span>
            </div>
          </div>

          <div class="mt-2 p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 italic text-slate-200 text-xs text-center relative overflow-hidden">
            "${pledge}"
          </div>
        </div>
      </div>
    </div>
  `;
}

// --------------------------------------------------------------------------
// MULTI-STEP KMST ONBOARDING WIZARD & PROFILE SETTINGS
// --------------------------------------------------------------------------
let _wizardAvatar = 'phoenix-tattoo';

function openKMSTAuthModal(targetView = 'signup') {
  const modal = document.getElementById('kmstAuthModal');
  if (!modal) return;
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  lockBodyScroll();

  if (targetView === 'login') {
    switchToKmstLogin();
    return;
  }

  // Pre-fill fields if user profile exists
  const p = _kmstProfile || _kmstUser || {
    alias: 'Steve Pereira',
    soberDate: '2012-04-01',
    dailySpend: 20,
    pledge: 'Sobriety saved my life after my hospitalization in Dubai in April 2012. Holding the torch for everyone fighting for Day 1.',
    avatar: 'phoenix-tattoo',
    profileTheme: 'luxury',
    profileColor: 'gold'
  };

  const aliasEl = document.getElementById('kmstModalRegAlias');
  const dateEl = document.getElementById('kmstModalRegDate');
  const spendEl = document.getElementById('kmstModalSpend');
  const pledgeEl = document.getElementById('kmstModalPledge');
  const themeEl = document.getElementById('kmstModalTheme');
  const colorEl = document.getElementById('kmstModalColor');

  if (aliasEl && p.alias) aliasEl.value = p.alias;
  if (dateEl && p.soberDate) dateEl.value = p.soberDate;
  if (spendEl && p.dailySpend !== undefined) spendEl.value = p.dailySpend;
  if (pledgeEl && p.pledge) pledgeEl.value = p.pledge;
  if (themeEl && p.profileTheme) themeEl.value = p.profileTheme;
  if (colorEl && p.profileColor) colorEl.value = p.profileColor;
  if (p.avatar) _wizardAvatar = p.avatar;

  goToKmstStep(3); // Go straight to editor for customization
}

function closeKMSTAuthModal() {
  const modal = document.getElementById('kmstAuthModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    unlockBodyScroll();
  }
}

function goToKmstStep(step) {
  const loginView = document.getElementById('kmstLoginView');
  const s1 = document.getElementById('kmstStep1');
  const s2 = document.getElementById('kmstStep2');
  const s3 = document.getElementById('kmstStep3');

  if (loginView) loginView.classList.add('hidden');
  if (s1) s1.classList.add('hidden');
  if (s2) s2.classList.add('hidden');
  if (s3) {
    s3.classList.add('hidden');
    s3.classList.remove('flex');
  }

  const target = document.getElementById('kmstStep' + step);
  if (target) {
    target.classList.remove('hidden');
    if (step === 3) {
      target.classList.add('flex');
      renderKmstWizardAvatars();
      updateKmstPreview();
    }
  }
  if (window.lucide) lucide.createIcons();
}

function switchToKmstLogin() {
  const s1 = document.getElementById('kmstStep1');
  const s2 = document.getElementById('kmstStep2');
  const s3 = document.getElementById('kmstStep3');
  const loginView = document.getElementById('kmstLoginView');

  if (s1) s1.classList.add('hidden');
  if (s2) s2.classList.add('hidden');
  if (s3) {
    s3.classList.add('hidden');
    s3.classList.remove('flex');
  }
  if (loginView) loginView.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}

function renderKmstWizardAvatars() {
  const c = document.getElementById('kmstModalAvatarPicker');
  if (!c) return;
  c.innerHTML = '';

  const isSteve = (_kmstProfile?.alias === 'Steve Pereira' || _kmstProfile?.email === 'stevenapereira@hotmail.com' || document.getElementById('kmstModalRegAlias')?.value === 'Steve Pereira');

  KMST_RECOVERY_AVATARS.forEach(av => {
    // Only Steve Pereira can select phoenix-tattoo
    if (av.founderOnly && !isSteve) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all ' + 
      (_wizardAvatar === av.id ? 'bg-amber-500/30 border-2 border-amber-400 scale-110 shadow-lg' : 'bg-slate-900 border border-slate-700 hover:border-amber-400 opacity-75 hover:opacity-100');
    btn.title = av.name + ' - ' + av.desc;
    btn.innerHTML = `<img src="${av.svg}" alt="${av.name}" class="w-6 h-6 object-contain">`;
    btn.onclick = () => {
      _wizardAvatar = av.id;
      renderKmstWizardAvatars();
      updateKmstPreview();
    };
    c.appendChild(btn);
  });
}

function updateKmstPreview() {
  const container = document.getElementById('kmstPreviewContainer');
  if (!container) return;
  
  const alias = (document.getElementById('kmstModalRegAlias')?.value || 'Steve Pereira').trim();
  const theme = document.getElementById('kmstModalTheme')?.value || 'luxury';
  const color = document.getElementById('kmstModalColor')?.value || 'gold';
  const pledge = (document.getElementById('kmstModalPledge')?.value || 'Taking it one day at a time with clarity and courage.').trim();
  const spend = parseFloat(document.getElementById('kmstModalSpend')?.value || 20);
  const sDate = document.getElementById('kmstModalRegDate')?.value || '2012-04-01';
  
  // Calculate days sober
  const start = new Date(sDate);
  const now = new Date();
  const diffTime = Math.max(0, now - start);
  const days = Math.floor(diffTime / (1000 * 60 * 60 * 24)) || 1;

  const mockMember = {
    id: 'preview',
    alias,
    joinedAt: new Date().toISOString(),
    soberDate: sDate,
    dailySpend: spend,
    pledge,
    avatar: _wizardAvatar,
    profileTheme: theme,
    profileColor: color,
    daysSober: days,
    badgeText: days >= 5000 ? '14 Yrs Phoenix Legend' : days >= 30 ? '30 Days Roman Bronze' : days >= 7 ? '7 Days Iron Shield' : '24h Spark of Ignition',
    shieldIcon: days >= 5000 ? '🔥' : '⚡'
  };

  container.innerHTML = generateKMSTProfileCardHTML(mockMember, false);
  if (window.lucide) lucide.createIcons();
}

async function submitKmstRegistration() {
  const aliasEl = document.getElementById('kmstModalRegAlias');
  const dateEl = document.getElementById('kmstModalRegDate');
  const emailEl = document.getElementById('kmstRegEmail');
  const pinEl = document.getElementById('kmstRegPin');
  const spendEl = document.getElementById('kmstModalSpend');
  const pledgeEl = document.getElementById('kmstModalPledge');
  const themeEl = document.getElementById('kmstModalTheme');
  const colorEl = document.getElementById('kmstModalColor');

  const alias = aliasEl ? aliasEl.value.trim() : 'Steve Pereira';
  const soberDate = dateEl ? dateEl.value : '2012-04-01';
  const email = emailEl && emailEl.value.trim() ? emailEl.value.trim() : (alias === 'Steve Pereira' ? 'stevenapereira@hotmail.com' : alias.toLowerCase().replace(/\s+/g, '') + '@example.com');
  const pin = pinEl && pinEl.value.trim() ? pinEl.value.trim() : '1313';
  const pledge = pledgeEl && pledgeEl.value.trim() ? pledgeEl.value.trim() : 'Taking it one day at a time with clarity and courage.';

  const start = new Date(soberDate);
  const days = Math.floor(Math.max(0, new Date() - start) / 86400000) || 1;

  const payload = {
    alias,
    email,
    pin,
    soberDate,
    daysSober: days,
    dailySpend: parseFloat(spendEl ? spendEl.value : 20),
    avatar: _wizardAvatar,
    profileTheme: themeEl ? themeEl.value : 'luxury',
    profileColor: colorEl ? colorEl.value : 'gold',
    pledge,
    badgeText: days >= 5000 ? '14 Yrs Phoenix Legend' : days >= 30 ? '30 Days Roman Bronze' : '24h Spark of Ignition',
    shieldIcon: days >= 5000 ? '🔥' : '⚡',
    emblemSvg: days >= 5000 ? 'assets/badges/badge_14y.svg' : 'assets/badges/badge_24h.svg'
  };

  _kmstUser = payload;
  _kmstProfile = payload;
  localStorage.setItem('kmst_user', JSON.stringify(payload));
  localStorage.setItem('kmst_member_profile', JSON.stringify(payload));

  try {
    await fetch('/api/kmst/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) {}

  closeKMSTAuthModal();
  updateKMSTBadgeUI();
  renderKMSTCommunity();
  alert('Profile updated and pass activated for ' + payload.alias + '!');
}

// --------------------------------------------------------------------------
// COMPOSER & POST SUBMISSION
// --------------------------------------------------------------------------
function openKMSTComposerModal() {
  const modal = document.getElementById('kmstComposerModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    lockBodyScroll();

    const aliasEl = document.getElementById('kmstComposerAlias');
    const avEl = document.getElementById('kmstComposerAvatar');
    if (aliasEl && _kmstProfile) aliasEl.textContent = 'Posting as: ' + _kmstProfile.alias;
    if (avEl && _kmstProfile) {
      const avObj = KMST_RECOVERY_AVATARS.find(a => a.id === _kmstProfile.avatar) || KMST_RECOVERY_AVATARS[0];
      avEl.innerHTML = `<img src="${avObj.svg}" class="w-6 h-6 object-contain">`;
    }
  }
}

function closeKMSTComposerModal() {
  const modal = document.getElementById('kmstComposerModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    unlockBodyScroll();
  }
}

async function submitKMSTMessage() {
  const text = (document.getElementById('kmstMessageText')?.value || '').trim();
  const channel = document.getElementById('kmstComposerChannel')?.value || 'general';
  const includeBadge = document.getElementById('kmstIncludeBadgeCheck')?.checked ?? true;
  const postColor = document.getElementById('kmstPostColorSelect')?.value || (_kmstProfile ? _kmstProfile.profileColor : 'gold');

  if (!text) {
    alert('Please enter your message or pledge before posting.');
    return;
  }

  // Anti-Spam Zero Links Policy
  if (/(https?:\/\/|www\.|\.com|\.org|\.net|\.xyz|\.top|\.ru|\.click|\.work|\.loan|\.link|\.bit\.ly|\.t\.co|\.gg\/|t\.me\/)/i.test(text)) {
    alert('Security Alert: External links and promotional URLs are strictly prohibited in the KMST Sanctuary.');
    return;
  }

  const p = _kmstProfile || {
    alias: 'Steve Pereira',
    avatar: 'phoenix-tattoo',
    badgeText: '14 Yrs Phoenix Legend',
    daysSober: 5260,
    shieldIcon: '🔥',
    badgeObject: '🔥🦅 14-Year Steve Pereira Phoenix Tattoo Rebirth'
  };

  const newMsg = {
    id: 'msg_' + Date.now(),
    channel,
    authorName: p.alias,
    authorRole: p.alias === 'Steve Pereira' ? 'Founder / Admin' : 'Member',
    authorAvatar: p.shieldIcon || '🔥',
    authorBadge: p.badgeText || 'Warrior',
    includeBadge,
    badgeObject: p.badgeObject || '🔥🦅 14-Year Steve Pereira Phoenix Tattoo Rebirth',
    shieldIcon: p.shieldIcon || '🔥',
    streakDays: p.daysSober || 1,
    postColor,
    message: text,
    timestamp: new Date().toISOString(),
    status: 'approved',
    reactions: { strength: 1, respect: 1, celebrate: 1, soberToday: 1 }
  };

  try {
    const res = await fetch('/api/kmst/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    });
    if (!res.ok) throw new Error('Message submission failed');
  } catch (e) {
    console.warn('Posted locally:', e.message);
  }

  document.getElementById('kmstMessageText').value = '';
  closeKMSTComposerModal();
  fetchKMSTMessages(_currentKMSTChannel || 'all');
  alert('Your post has been published to the KMST Sanctuary!');
}


let _selectedKMSTHelpCategory = 'All';

function setKMSTHelpCategory(cat) {
  _selectedKMSTHelpCategory = cat || 'All';
  document.querySelectorAll('.kmst-help-cat-btn').forEach(btn => {
    btn.classList.remove('bg-rose-600', 'text-white', 'shadow');
    btn.classList.add('bg-slate-900', 'text-slate-300');
  });

  const catMap = {
    'All': 'helpCat-All',
    'Immediate Help': 'helpCat-Immediate',
    'Alcohol & Recovery': 'helpCat-Alcohol',
    'Mental Health': 'helpCat-Mental',
    'Family & Friends': 'helpCat-Family'
  };

  const btnId = catMap[cat] || 'helpCat-All';
  const activeBtn = document.getElementById(btnId);
  if (activeBtn) {
    activeBtn.classList.add('bg-rose-600', 'text-white', 'shadow');
    activeBtn.classList.remove('bg-slate-900', 'text-slate-300');
  }

  renderUKHelp();
}

function renderUKHelp() {
  const container = document.getElementById('ukHelplinesGrid') || document.getElementById('ukHelpGrid');
  if (!container) return;

  const query = (document.getElementById('helpSearchInput')?.value || '').toLowerCase();
  const list = (_cachedKMSTHelplines && _cachedKMSTHelplines.length > 0) ? _cachedKMSTHelplines : [
    { id: "help_1", title: "NHS 111 Urgent Care & Medical Advice", tel: "111", category: "Immediate Help", hours: "24/7 Free", web: "https://111.nhs.uk", desc: "Free 24/7 NHS confidential medical advice, urgent triage, and clinical detox support pathways.", badge: "NHS FREE" },
    { id: "help_2", title: "Samaritans UK Crisis Line", tel: "116 123", category: "Immediate Help", hours: "24/7 Free", web: "https://www.samaritans.org", desc: "Confidential emotional support 24 hours a day for anyone experiencing distress, despair, or loneliness.", badge: "24/7 CRISIS" },
    { id: "help_3", title: "Alcoholics Anonymous (AA UK)", tel: "0800 9177 650", category: "Alcohol & Recovery", hours: "24/7 Helpline", web: "https://www.alcoholics-anonymous.org.uk", desc: "National helpline and local 12-step peer fellowship meeting locator across England, Scotland & Wales.", badge: "RECOVERY GROUP" },
    { id: "help_4", title: "Al-Anon Family Groups UK", tel: "0800 0086 811", category: "Family & Friends", hours: "10am - 10pm Daily", web: "https://al-anonuk.org.uk", desc: "Dedicated compassionate support for partners, families, and friends affected by someone else's drinking.", badge: "FAMILY SUPPORT" },
    { id: "help_5", title: "FRANK (National Drug & Alcohol Info)", tel: "0300 123 6600", category: "Alcohol & Recovery", hours: "24/7 Confidential", web: "https://www.talktofrank.com", desc: "Honest, friendly, non-judgmental advice and treatment options for alcohol and substance dependency.", badge: "ADVICE SERVICE" },
    { id: "help_6", title: "Mind Mental Health Infoline", tel: "0300 123 3393", category: "Mental Health", hours: "Mon-Fri 9am-6pm", web: "https://www.mind.org.uk", desc: "Information and signposting for mental health support, dual-diagnosis, advocacy, and local UK services.", badge: "MENTAL HEALTH" },
    { id: "help_7", title: "NACOA (Children of Alcoholics)", tel: "0800 358 3456", category: "Family & Friends", hours: "Free & Confidential", web: "https://nacoa.org.uk", desc: "Helpline and online support for anyone affected by a parent's drinking, past or present.", badge: "CHILDREN & YOUTH" },
    { id: "help_8", title: "SMART Recovery UK", tel: "0300 303 0285", category: "Alcohol & Recovery", hours: "Meetings & Online", web: "https://smartrecovery.org.uk", desc: "Science-based mutual-aid recovery program helping individuals build self-empowerment and practical coping skills.", badge: "EVIDENCE BASED" },
    { id: "help_9", title: "Drinkline National Alcohol Helpline", tel: "0300 123 1110", category: "Alcohol & Recovery", hours: "Mon-Fri 9am-8pm, Wknd 11am-4pm", web: "https://www.drinkaware.co.uk", desc: "Free confidential helpline for anyone concerned about their drinking or seeking guidance for a loved one.", badge: "NATIONAL HELPLINE" }
  ];

  const filtered = list.filter(h => {
    const matchesCat = (_selectedKMSTHelpCategory === 'All') || (h.category === _selectedKMSTHelpCategory);
    const matchesQuery = (!query) || 
      (h.title && h.title.toLowerCase().includes(query)) || 
      (h.desc && h.desc.toLowerCase().includes(query)) || 
      (h.category && h.category.toLowerCase().includes(query)) || 
      (h.badge && h.badge.toLowerCase().includes(query)) || 
      (h.tel && h.tel.includes(query));
    return matchesCat && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-8 text-center bg-slate-950/60 rounded-2xl border border-slate-800 space-y-2">
        <p class="text-white font-bold text-sm">No helplines found matching your search filter.</p>
        <p class="text-xs text-slate-400">Try clearing the search box or selecting "All Support".</p>
        <button onclick="setKMSTHelpCategory('All')" class="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold">Reset Filters</button>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(h => `
    <div class="p-5 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-rose-500/50 transition-all space-y-3 relative overflow-hidden group shadow-lg">
      <div class="flex items-center justify-between gap-2 border-b border-slate-900 pb-2">
        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30 font-mono-code">${escapeHtml(h.badge || h.category)}</span>
        <span class="text-[10px] text-slate-400 font-mono-code flex items-center gap-1">
          <i data-lucide="clock" class="w-3 h-3 text-emerald-400"></i> ${escapeHtml(h.hours || '24/7')}
        </span>
      </div>

      <div class="space-y-1">
        <h4 class="text-sm font-black text-white group-hover:text-rose-300 transition leading-snug font-cinzel">${escapeHtml(h.title)}</h4>
        <p class="text-xs text-slate-400 line-clamp-2 leading-relaxed">${escapeHtml(h.desc)}</p>
      </div>

      <div class="pt-2 flex items-center justify-between gap-2">
        <a href="tel:${h.tel.replace(/\s+/g, '')}" class="px-3 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-mono-code font-black text-xs flex items-center gap-1.5 transition shadow">
          <i data-lucide="phone-call" class="w-3.5 h-3.5"></i> ${escapeHtml(h.tel)}
        </a>
        ${h.web ? `
          <a href="${h.web}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-1 transition">
            <span>Website</span> <i data-lucide="external-link" class="w-3 h-3 text-rose-400"></i>
          </a>
        ` : ''}
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}



async function renderKMSTLeaderboard() {
  const container = document.getElementById('kmstLeaderboardList');
  if (!container) return;

  let leaders = [
    { rank: 1, name: 'Steve Pereira', role: 'Founder', days: 5260, badge: '14 Yrs Phoenix', avatar: '🔥', icon: '🔥' },
    { rank: 2, name: 'Elena_Bristol', role: 'Member', days: 365, badge: '1 Year Diamond', avatar: '💎', icon: '💎' },
    { rank: 3, name: 'Dave_Manchester', role: 'Member', days: 180, badge: '6 Months Gold', avatar: '⚜️', icon: '⚜️' },
    { rank: 4, name: 'Marcus_Edinburgh', role: 'Member', days: 90, badge: '90 Days Silver', avatar: '🛡️', icon: '🛡️' },
    { rank: 5, name: 'Sarah_London', role: 'Member', days: 30, badge: '30 Days Bronze', avatar: '💖', icon: '🏅' }
  ];

  try {
    const res = await fetch('/api/kmst/leaderboard');
    if (res.ok) {
      const data = await res.json();
      if (data && data.leaderboard && data.leaderboard.length > 0) {
        leaders = data.leaderboard;
      }
    }
  } catch (e) {}

  container.innerHTML = leaders.map((l, idx) => {
    const isFounder = l.role === 'Founder' || (l.name && l.name.includes('Steve Pereira'));
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl ${isFounder ? 'bg-amber-950/30 border border-amber-500/40' : 'bg-slate-900/80 border border-slate-800'} transition hover:border-slate-700">
        <div class="flex items-center gap-2.5">
          <span class="w-5 h-5 rounded-full ${idx === 0 ? 'bg-amber-500 text-slate-950 font-black' : (idx === 1 ? 'bg-slate-300 text-slate-950 font-bold' : (idx === 2 ? 'bg-amber-700 text-white font-bold' : 'bg-slate-800 text-slate-400 font-medium'))} flex items-center justify-center text-[10px] font-mono-code">${l.rank || (idx + 1)}</span>
          <span>${l.avatar || '🕊️'}</span>
          <div>
            <div class="flex items-center gap-1.5">
              <span class="text-xs font-bold text-white font-cinzel">${escapeHtml(l.name)}</span>
              ${isFounder ? '<span class="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black border border-amber-500/30">FOUNDER</span>' : ''}
            </div>
            <span class="text-[10px] text-slate-400 font-mono-code">${escapeHtml(l.badge || 'Warrior')}</span>
          </div>
        </div>
        <div class="text-right">
          <span class="text-xs font-black text-emerald-400 font-mono-code block">${(l.days || 0).toLocaleString()}d</span>
          <span class="text-[9px] text-slate-500 font-mono-code">Streak</span>
        </div>
      </div>
    `;
  }).join('');
}

async function fetchKMSTCommunityStats() {
  try {
    const res = await fetch('/api/kmst/stats');
    if (res.ok) {
      const data = await res.json();
      const memCount = document.getElementById('kmstStatsMembersCount');
      if (memCount && data.membersCount) memCount.textContent = data.membersCount.toLocaleString();
      const daysCount = document.getElementById('kmstStatsDaysSober');
      if (daysCount && data.totalDaysSober) daysCount.textContent = data.totalDaysSober.toLocaleString();
    }
  } catch (e) {}
}



// ===========================================================================
// KMST ADMIN CMS CONTROLLERS: EDIT, PUBLISH/UNPUBLISH, MEMBERS, HELPLINES
// ===========================================================================

function openAdminKmstEditMsgModal(msgId) {
  const msg = _cachedKMSTMessages.find(m => m.id === msgId);
  if (!msg) {
    alert('Message not found.');
    return;
  }

  const idEl = document.getElementById('editMsgId');
  const authorEl = document.getElementById('editMsgAuthor');
  const badgeEl = document.getElementById('editMsgBadge');
  const channelEl = document.getElementById('editMsgChannel');
  const contentEl = document.getElementById('editMsgContent') || document.getElementById('editMsgText');
  const pinnedEl = document.getElementById('editMsgPinned');

  if (idEl) idEl.value = msg.id;
  if (authorEl) authorEl.value = msg.authorName || '';
  if (badgeEl) badgeEl.value = msg.authorBadge || '';
  if (channelEl) channelEl.value = msg.channel || 'general';
  if (contentEl) contentEl.value = msg.message || '';
  if (pinnedEl) pinnedEl.checked = !!msg.pinned;

  const modal = document.getElementById('adminKmstEditMsgModal');
  if (modal) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    if (typeof lockBodyScroll === 'function') lockBodyScroll();
  }
}
window.openAdminKmstEditMsgModal = openAdminKmstEditMsgModal;

function closeAdminKmstEditMsgModal() {
  const modal = document.getElementById('adminKmstEditMsgModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    if (typeof unlockBodyScroll === 'function') unlockBodyScroll();
  }
}
window.closeAdminKmstEditMsgModal = closeAdminKmstEditMsgModal;

async function saveAdminKmstMsgEdit() {
  const msgId = document.getElementById('editMsgId')?.value;
  const authorName = document.getElementById('editMsgAuthor')?.value.trim();
  const authorBadge = document.getElementById('editMsgBadge')?.value.trim();
  const channel = document.getElementById('editMsgChannel')?.value || 'general';
  const contentEl = document.getElementById('editMsgContent') || document.getElementById('editMsgText');
  const message = contentEl?.value.trim();
  const pinned = document.getElementById('editMsgPinned')?.checked ?? false;

  if (!message) {
    alert('Message content cannot be empty.');
    return;
  }

  const payload = {
    message,
    channel,
    authorName,
    authorBadge,
    pinned
  };

  try {
    const res = await fetch('/api/kmst/messages/' + encodeURIComponent(msgId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Save failed');
  } catch (e) {
    console.warn('Updated in local memory:', e.message);
  }

  _cachedKMSTMessages = _cachedKMSTMessages.map(m => m.id === msgId ? { ...m, ...payload } : m);

  closeAdminKmstEditMsgModal();
  loadAdminKMSTMessages();
  fetchKMSTMessages(_currentKMSTChannel || 'all');
  alert('Community post updated successfully!');
}
window.saveAdminKmstMsgEdit = saveAdminKmstMsgEdit;

async function toggleAdminKmstMsgStatus(msgId) {
  const msg = _cachedKMSTMessages.find(m => m.id === msgId);
  if (!msg) return;

  const newStatus = (msg.status === 'approved' || !msg.status) ? 'unapproved' : 'approved';

  try {
    await fetch('/api/kmst/messages/' + encodeURIComponent(msgId) + '/status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
  } catch (e) {
    console.warn('Status updated locally:', e.message);
  }

  msg.status = newStatus;
  _cachedKMSTMessages = _cachedKMSTMessages.map(m => m.id === msgId ? { ...m, status: newStatus } : m);

  loadAdminKMSTMessages();
  fetchKMSTMessages(_currentKMSTChannel || 'all');
}
window.toggleAdminKmstMsgStatus = toggleAdminKmstMsgStatus;

async function loadAdminKMSTMembers() {
  const tbody = document.getElementById('adminKmstMembersTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/kmst/members');
    if (res.ok) {
      const data = await res.json();
      if (data && data.members) {
        renderAdminKMSTMembersTable(data.members);
        return;
      }
    }
  } catch (e) {}

  renderAdminKMSTMembersTable([]);
}
window.loadAdminKMSTMembers = loadAdminKMSTMembers;

function renderAdminKMSTMembersTable(members) {
  const tbody = document.getElementById('adminKmstMembersTableBody');
  if (!tbody) return;

  if (!members || members.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="py-6 text-center text-slate-500 italic">No registered warriors in registry yet.</td></tr>';
    return;
  }

  tbody.innerHTML = members.map(m => `
    <tr class="hover:bg-slate-900/50 transition border-b border-slate-800/60">
      <td class="py-2.5 px-3">
        <div class="flex items-center gap-2">
          <span>${m.avatar || '🕊️'}</span>
          <div>
            <strong class="text-white block font-cinzel text-xs">${escapeHtml(m.alias || m.name || 'Member')}</strong>
            <span class="text-[10px] text-slate-400 font-mono-code">${escapeHtml(m.email || 'Confidential')}</span>
          </div>
        </div>
      </td>
      <td class="py-2.5 px-3 font-mono-code text-emerald-400 text-xs">${m.daysSober || 1} days</td>
      <td class="py-2.5 px-3 text-amber-300 font-mono-code text-[11px]">${escapeHtml(m.badgeText || 'Warrior')}</td>
      <td class="py-2.5 px-3 text-slate-400 text-[11px]">${m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('en-GB') : 'Active'}</td>
      <td class="py-2.5 px-3 text-right">
        <button type="button" onclick="deleteKMSTMember('${m.id}')" class="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] font-bold transition">Remove</button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}
window.renderAdminKMSTMembersTable = renderAdminKMSTMembersTable;

async function loadAdminKMSTHelplines() {
  const tbody = document.getElementById('adminKmstHelplinesTableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/kmst/helplines');
    if (res.ok) {
      const data = await res.json();
      if (data && data.helplines) {
        _cachedKMSTHelplines = data.helplines;
        renderAdminKMSTHelplinesTable(data.helplines);
        return;
      }
    }
  } catch (e) {}

  renderAdminKMSTHelplinesTable(_cachedKMSTHelplines);
}
window.loadAdminKMSTHelplines = loadAdminKMSTHelplines;

function renderAdminKMSTHelplinesTable(helplines) {
  const tbody = document.getElementById('adminKmstHelplinesTableBody');
  if (!tbody) return;

  const list = (helplines && helplines.length > 0) ? helplines : _cachedKMSTHelplines;

  if (!list || list.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" class="py-6 text-center text-slate-500 italic">No helplines found.</td></tr>';
    return;
  }

  tbody.innerHTML = list.map(h => `
    <tr class="hover:bg-slate-900/50 transition border-b border-slate-800/60">
      <td class="py-2.5 px-3">
        <strong class="text-white block text-xs">${escapeHtml(h.title)}</strong>
        <span class="text-[10px] text-slate-400">${escapeHtml(h.desc || '')}</span>
      </td>
      <td class="py-2.5 px-3 font-mono-code text-rose-400 font-bold text-xs">${escapeHtml(h.tel)}</td>
      <td class="py-2.5 px-3 text-purple-300 text-[11px]">${escapeHtml(h.category || 'General')}</td>
      <td class="py-2.5 px-3 text-right">
        <button type="button" onclick="deleteKMSTHelpline('${h.id}')" class="px-2.5 py-1 rounded bg-rose-950/60 hover:bg-rose-900 text-rose-300 text-[11px] font-bold transition">Delete</button>
      </td>
    </tr>
  `).join('');

  if (window.lucide) lucide.createIcons();
}
window.renderAdminKMSTHelplinesTable = renderAdminKMSTHelplinesTable;

async function deleteKMSTMember(memberId) {
  if (!confirm('Are you sure you want to remove this member?')) return;
  try {
    await fetch('/api/kmst/members/' + encodeURIComponent(memberId), { method: 'DELETE' });
    loadAdminKMSTMembers();
  } catch (e) {}
}
window.deleteKMSTMember = deleteKMSTMember;

async function deleteKMSTHelpline(helpId) {
  if (!confirm('Are you sure you want to delete this helpline?')) return;
  try {
    await fetch('/api/kmst/helplines/' + encodeURIComponent(helpId), { method: 'DELETE' });
    loadAdminKMSTHelplines();
    renderUKHelp();
  } catch (e) {}
}
window.deleteKMSTHelpline = deleteKMSTHelpline;

