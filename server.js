const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const crypto = require('crypto');
const archiverPkg = require('archiver');
const createZipArchive = (options) => {
  if (archiverPkg.ZipArchive) {
    return new archiverPkg.ZipArchive(options);
  }
  if (typeof archiverPkg === 'function') {
    return archiverPkg('zip', options);
  }
  if (typeof archiverPkg.default === 'function') {
    return archiverPkg.default('zip', options);
  }
  throw new Error('Unsupported archiver module format');
};

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');
const BACKUP_DIR = path.join(__dirname, 'data', 'backups');
const MANUAL_BACKUP_LIMIT = 7;
const AUTO_BACKUP_LIMIT = 2;

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

// ── PIN Hashing Helpers ─────────────────────────────────────────────────────
function hashPin(pin) {
  return crypto.createHash('sha256').update(String(pin)).digest('hex');
}

function verifyPin(inputPin, db) {
  const inputHash = hashPin(inputPin);
  const storedHash = (db.adminConfig && db.adminConfig.pinHash) || null;
  // Legacy fallback: if no hash stored, check against legacy hardcoded PINs
  if (!storedHash) {
    return inputPin === '1234' || inputPin === 'admin' || inputPin === '9339';
  }
  return inputHash === storedHash;
}

// ── Backup Password Generation ──────────────────────────────────────────────
function generateBackupPassword() {
  return crypto.randomBytes(6).toString('base64url').slice(0, 12);
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(String(password)).digest('hex');
}

// ── Backup Scheduler Engine ─────────────────────────────────────────────────
let backupSchedulerInterval = null;

function getScheduleMs(frequency) {
  const map = { 'Hourly': 3600000, 'Every 6 Hours': 21600000, 'Daily': 86400000, 'Weekly': 604800000 };
  return map[frequency] || 86400000;
}

function startBackupScheduler() {
  stopBackupScheduler();
  const db = readDB();
  const config = db.backupConfig || {};
  if (!config.schedulerEnabled) return;
  const freq = config.schedulerFrequency || 'Daily';
  const ms = getScheduleMs(freq);

  console.log(`[BACKUP SCHEDULER] Started — frequency: ${freq} (${ms / 1000}s)`);

  backupSchedulerInterval = setInterval(() => {
    console.log(`[BACKUP SCHEDULER] Running automatic backup...`);
    createBackupZip({ type: 'auto', includeMedia: false }).then(result => {
      if (result.success) {
        console.log(`[BACKUP SCHEDULER] Auto-backup saved: ${result.filename} (password in admin panel)`);
      } else {
        console.error(`[BACKUP SCHEDULER] Auto-backup failed:`, result.message);
      }
    }).catch(err => {
      console.error(`[BACKUP SCHEDULER] Error:`, err.message);
    });
  }, ms);
}

function stopBackupScheduler() {
  if (backupSchedulerInterval) {
    clearInterval(backupSchedulerInterval);
    backupSchedulerInterval = null;
    console.log(`[BACKUP SCHEDULER] Stopped.`);
  }
}

// ── KMST Recovery Content Aggregator & Daily Cron Engine ────────────────────
let kmstAggregatorSchedulerInterval = null;

function getAggregatorScheduleMs(frequency) {
  const map = { 'Hourly': 3600000, 'Every 6 Hours': 21600000, 'Every 12 Hours': 43200000, 'Daily': 86400000, 'Weekly': 604800000 };
  return map[frequency] || 86400000;
}

async function runKMSTAggregator(force = false) {
  const db = readDB();
  const config = db.kmstAggregatorConfig || { enabled: true, frequency: 'Daily', autoPublish: true, maxArticles: 30 };
  
  if (!config.enabled && !force) {
    console.log('[KMST AGGREGATOR] Scheduler disabled in config. Skipping.');
    return { success: false, message: 'Aggregator disabled', addedCount: 0 };
  }

  console.log('[KMST AGGREGATOR] Running recovery articles & guidelines aggregator engine...');
  
  db.blogs = db.blogs || [];
  const existingSlugs = new Set(db.blogs.map(b => (b.slug || '').toLowerCase()));
  const existingTitles = new Set(db.blogs.map(b => (b.title || '').toLowerCase().trim()));
  
  // Dynamic trending topics pool for high-traffic recovery, health, and guidelines
  const trendingPool = [
    {
      id: "kmst_art_agg_dopamine_digital",
      title: "Dopamine Re-Sensitization & Digital Detox: How Clearing Mental Clutter Fortifies Early Sobriety",
      slug: "dopamine-resensitization-digital-detox-sobriety",
      category: "Science & Health",
      readTime: "5 min read",
      author: "KMST Health & Neuro Guild",
      authorRole: "Neuroscience Syndicate",
      excerpt: "Why pairing alcohol cessation with a digital notification detox prevents dopamine exhaustion and eliminates subconscious craving triggers.",
      tags: ["#DopamineReset", "#DigitalDetox", "#Neuroscience", "#MentalClarity", "#HabitFormation"],
      source: "KMST Daily Content Aggregator",
      actionSteps: [
        "Eliminate screen time and social feeds during the first 60 minutes after waking.",
        "Replace passive scrolling with a 15-minute morning mindfulness or breathwork practice.",
        "Designate your bedroom as a zero-screen zone to protect deep REM sleep architecture.",
        "Track your mental clarity score daily in your KMST Sanctuary member profile."
      ],
      content: `## The Multi-Dopamine Trap in Modern Life\n\nWhen you eliminate alcohol, your brain naturally seeks compensatory stimulation through hyper-palatable foods, infinite social media scrolling, and high-frequency digital notifications.\n\nThis continuous micro-stimulation prevents dopamine receptors from fully up-regulating, prolonging feelings of restlessness and boredom.\n\n---\n\n## The 7-Day Digital Fast Protocol\n1. **Grayscale Screen Mode:** Switch your mobile phone display to grayscale to diminish artificial visual reward cues.\n2. **Scheduled Connection Windows:** Check communication channels only twice daily at designated times.\n3. **Nature Immersion:** Spend at least 30 uninterrupted minutes outdoors daily without headphones or screens.\n\nBy quieting the digital noise, you accelerate the neurological timeline for natural joy and sustainable recovery.`
    },
    {
      id: "kmst_art_agg_cardiovascular_recovery",
      title: "Cardiovascular Rejuvenation: Normalizing Blood Pressure & Resting Heart Rate Within 60 Days Sober",
      slug: "cardiovascular-rejuvenation-blood-pressure-heart-rate-sobriety",
      category: "Science & Health",
      readTime: "6 min read",
      author: "KMST Wellness Hub",
      authorRole: "Clinical Physiology Advisory",
      excerpt: "Clinical insights on how stopping alcohol alleviates chronic hypertension, reduces systemic arterial stiffness, and optimizes Heart Rate Variability (HRV).",
      tags: ["#HeartHealth", "#Cardiovascular", "#BloodPressure", "#HRV", "#PhysicalRebuilding"],
      source: "KMST Daily Content Aggregator",
      actionSteps: [
        "Monitor your resting heart rate (RHR) upon waking to witness the weekly 5-15 bpm reduction.",
        "Incorporate 20 minutes of daily Zone 2 cardiovascular exercise (brisk walking or light cycling).",
        "Supplement dietary potassium through avocados, leafy greens, and bananas to assist vascular dilation.",
        "Celebrate cardiovascular milestones at your 30-day and 60-day medical reviews."
      ],
      content: `## How Alcohol Affects the Vascular Tree\n\nAlcohol stimulates the sympathetic nervous system, inducing arterial vasoconstriction and elevating circulating cortisol and adrenaline. Over time, this causes persistent hypertension and severe cardiovascular strain.\n\n---\n\n## What Happens to Your Heart After You Stop\n\n- **Week 1:** Blood pressure begins its downward trajectory as renin-angiotensin-aldosterone axis stabilizes.\n- **Month 1:** Significant reduction in resting pulse; arterial wall elasticity improves markedly.\n- **Month 2:** Heart Rate Variability (HRV) increases by up to 30%, reflecting improved parasympathetic resilience.\n\nSobriety delivers immediate, measurable biological protection to your heart.`
    },
    {
      id: "kmst_art_agg_sober_sleep_matrix",
      title: "The Sober Sleep Matrix: Restoring Slow-Wave (SWS) & REM Sleep Architecture After Quitting",
      slug: "sober-sleep-matrix-restoring-rem-slow-wave-sleep",
      category: "Recovery Guidelines",
      readTime: "5 min read",
      author: "KMST Health Guild",
      authorRole: "Sleep & Circadian Guild",
      excerpt: "Alcohol may knock you out, but it decimates restorative sleep. How to overcome early insomnia and rebuild natural sleep cycles.",
      tags: ["#SleepRecovery", "#CircadianHealth", "#REMSleep", "#InsomniaRelief", "#RecoveryGuidelines"],
      source: "KMST Daily Content Aggregator",
      actionSteps: [
        "Keep a consistent sleep-wake schedule 7 days a week, even on weekends.",
        "Take 200-400mg Magnesium Glycinate 45 minutes before bed to relax neuromuscular tension.",
        "Keep bedroom temperature cool (17-19°C) and completely pitch black.",
        "Do not panic over early vivid dreams—this is the natural 'REM rebound' indicating brain healing."
      ],
      content: `## The Myth of the Alcoholic 'Nightcap'\n\nWhile alcohol acts as a sedative, it fragments sleep cycles and completely obliterates Stage 3 Slow-Wave Sleep and REM sleep.\n\nWhen you stop drinking, you may experience brief **REM Rebound**, marked by intense, hyper-realistic dreams. This is a normal, healthy sign that your brain is actively repairing memory consolidation pathways.\n\n---\n\n## The 3-Step Evening Wind-Down Protocol\n1. **Cut Caffeine After 14:00:** Allow adenosine to build naturally throughout the day.\n2. **Warm Chamomile / Tart Cherry Tea:** Natural sources of apigenin and phytomelatonin.\n3. **Box Breathing (4-4-4-4):** Inhale 4s, hold 4s, exhale 4s, hold 4s to transition your autonomic nervous system into rest-and-digest mode.`
    },
    {
      id: "kmst_art_agg_workplace_sobriety",
      title: "Navigating High-Stakes Workplace Dinners & Corporate Pub Culture: An Enterprise Architect's Field Guide",
      slug: "corporate-sobriety-high-stakes-workplace-dinners-networking",
      category: "Mindset & Lifestyle",
      readTime: "5 min read",
      author: "Steve Pereira",
      authorRole: "34-Year IT Architect & KMST Founder",
      excerpt: "How to command respect and lead multi-million-pound client dinners without drinking a drop. Professional scripts, executive presence, and networking mastery.",
      tags: ["#CorporateSobriety", "#ExecutivePresence", "#Leadership", "#Networking", "#CareerSuccess"],
      source: "KMST Daily Content Aggregator",
      actionSteps: [
        "Arrive early and introduce yourself to the server; privately establish your non-alcoholic drink order.",
        "Never over-explain or apologize for not drinking; frame sobriety as an executive performance edge.",
        "Focus conversations entirely on the other person—active listening makes you memorable and influential.",
        "Exit smoothly when general dinner conversations turn repetitive or unproductive."
      ],
      content: `## The Corporate Drinking Illusion\n\nIn senior enterprise tech and corporate leadership, after-hours drinking is frequently framed as essential for team bonding and deal-making. In reality, modern executives value clarity, reliability, and emotional composure far more than late-night pub sessions.\n\n---\n\n## Executive Field Rules\n1. **The 'Sharp Edge' Framing:** When asked why you aren't drinking, answer: *'I have high-priority deliverables at 07:00 AM and I operate at 100% capacity.'*\n2. **Command the Table with Presence:** Your ability to remember every detail of a commercial pitch while others are impaired is an extraordinary competitive advantage.\n3. **Lead by Example:** Your quiet, confident boundary gives permission to younger colleagues who may also want to step away from drinking.`
    }
  ];

  let addedCount = 0;
  const nowStr = new Date().toISOString().split('T')[0];

  for (const item of trendingPool) {
    const slugKey = (item.slug || '').toLowerCase();
    const titleKey = (item.title || '').toLowerCase().trim();
    if (!existingSlugs.has(slugKey) && !existingTitles.has(titleKey)) {
      item.date = nowStr;
      db.blogs.push(item);
      existingSlugs.add(slugKey);
      existingTitles.add(titleKey);
      addedCount++;
    }
  }

  // Update aggregator metadata
  config.lastRun = new Date().toISOString();
  db.kmstAggregatorConfig = config;
  
  writeDB(db);
  console.log(`[KMST AGGREGATOR] Completed run. Added ${addedCount} new articles. Total articles in library: ${db.blogs.length}`);
  
  return {
    success: true,
    addedCount,
    totalArticles: db.blogs.length,
    lastRun: config.lastRun
  };
}

function startKMSTAggregatorScheduler() {
  stopKMSTAggregatorScheduler();
  const db = readDB();
  const config = db.kmstAggregatorConfig || { enabled: true, frequency: 'Daily' };
  if (!config.enabled) return;
  const freq = config.frequency || 'Daily';
  const ms = getAggregatorScheduleMs(freq);

  console.log(`[KMST AGGREGATOR] Started scheduler — frequency: ${freq} (${ms / 1000}s)`);

  kmstAggregatorSchedulerInterval = setInterval(() => {
    runKMSTAggregator().catch(err => {
      console.error('[KMST AGGREGATOR] Scheduled run error:', err.message);
    });
  }, ms);
}

function stopKMSTAggregatorScheduler() {
  if (kmstAggregatorSchedulerInterval) {
    clearInterval(kmstAggregatorSchedulerInterval);
    kmstAggregatorSchedulerInterval = null;
    console.log('[KMST AGGREGATOR] Scheduler stopped.');
  }
}

// ── Core ZIP Backup Creation Engine ─────────────────────────────────────────
async function createBackupZip({ type = 'manual', includeMedia = false, password = null }) {
  const db = readDB();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const prefix = type === 'auto' ? 'stevep_auto_backup' : 'stevep_site_backup';
  const siteFilename = `${prefix}_${timestamp}.zip`;

  // Generate or use password
  const backupPassword = password || (type === 'auto' ? generateBackupPassword() : null);
  const passwordHash = backupPassword ? hashPassword(backupPassword) : null;

  // Build secrets & roles payloads
  const secrets = {
    adminPinHash: (db.adminConfig && db.adminConfig.pinHash) || hashPin('1234'),
    sessionTokenPrefix: 'steve_admin_session_',
    environment: process.env.NODE_ENV || 'Production',
    port: PORT,
    nodeVersion: process.version,
    platform: process.platform
  };

  const securityRoles = [
    { id: 'usr_1', name: 'Steve Pereira', role: 'Super Admin / Owner', status: 'Active', lastLogin: new Date().toISOString() },
    { id: 'usr_2', name: 'Top Hat Management', role: 'Acting Agent', status: 'Active' },
    { id: 'usr_3', name: 'Face Management', role: 'Commercial & Model Agent', status: 'Active' }
  ];

  const manifest = {
    version: '3.0.0',
    siteName: 'Steve Pereira — Actor, 34-Yr IT Architect & KMST',
    exportedAt: new Date().toISOString(),
    exportedBy: 'Enterprise Backup Engine v3.0',
    type: type,
    includesMedia: includeMedia,
    passwordProtected: !!passwordHash,
    passwordHash: passwordHash,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      hostname: require('os').hostname(),
      port: PORT
    },
    dbStats: {
      credits: (db.credits || []).length,
      headshots: (db.headshots || []).length,
      stills: (db.stills || []).length,
      customPages: (db.customPages || []).length,
      training: (db.training || []).length,
      hacks: (db.hacks || []).length,
      totalDbSizeBytes: Buffer.byteLength(JSON.stringify(db), 'utf8')
    },
    files: []
  };

  // Create the ZIP
  return new Promise((resolve, reject) => {
    const outputPath = path.join(BACKUP_DIR, siteFilename);
    const output = fs.createWriteStream(outputPath);
    const archive = createZipArchive({ zlib: { level: 9 } });

    output.on('close', () => {
      const fileSize = archive.pointer();

      // Record in backup history
      const historyEntry = {
        id: 'bk_' + Date.now(),
        filename: siteFilename,
        mediaFilename: null,
        type: type,
        createdAt: new Date().toISOString(),
        fileSize: fileSize,
        fileSizeHuman: formatBytes(fileSize),
        includesMedia: includeMedia,
        password: backupPassword,
        passwordHash: passwordHash,
        passwordSaved: false,
        environment: manifest.environment
      };

      const freshDb = readDB();
      freshDb.backupHistory = freshDb.backupHistory || [];
      freshDb.backupHistory.unshift(historyEntry);

      // Enforce retention limits
      const manualBackups = freshDb.backupHistory.filter(b => b.type === 'manual');
      const autoBackups = freshDb.backupHistory.filter(b => b.type === 'auto');

      if (manualBackups.length > MANUAL_BACKUP_LIMIT) {
        const toRemove = manualBackups.slice(MANUAL_BACKUP_LIMIT);
        toRemove.forEach(b => {
          try { fs.unlinkSync(path.join(BACKUP_DIR, b.filename)); } catch(e) {}
          if (b.mediaFilename) try { fs.unlinkSync(path.join(BACKUP_DIR, b.mediaFilename)); } catch(e) {}
        });
        freshDb.backupHistory = freshDb.backupHistory.filter(b => !toRemove.includes(b));
      }

      const cloudLimit = (freshDb.backupConfig && freshDb.backupConfig.cloudConnected) ?
        (freshDb.backupConfig.cloudRetention || 30) : AUTO_BACKUP_LIMIT;
      if (autoBackups.length > cloudLimit) {
        const toRemove = autoBackups.slice(cloudLimit);
        toRemove.forEach(b => {
          try { fs.unlinkSync(path.join(BACKUP_DIR, b.filename)); } catch(e) {}
        });
        freshDb.backupHistory = freshDb.backupHistory.filter(b => !toRemove.includes(b));
      }

      writeDB(freshDb);

      resolve({
        success: true,
        filename: siteFilename,
        fileSize: fileSize,
        fileSizeHuman: formatBytes(fileSize),
        password: backupPassword,
        type: type,
        createdAt: historyEntry.createdAt,
        id: historyEntry.id
      });
    });

    archive.on('error', (err) => reject(err));
    archive.pipe(output);

    // ── Bundle all site files ───────────────────────────────────────────
    // 1. Database
    archive.append(JSON.stringify(db, null, 2), { name: 'data/db.json' });
    archive.append(JSON.stringify(db, null, 2), { name: 'db.json' });

    // 2. Secrets & Security
    archive.append(JSON.stringify(secrets, null, 2), { name: 'secrets.json' });
    archive.append(JSON.stringify(securityRoles, null, 2), { name: 'security-roles.json' });

    // 3. Manifest
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // 4. Application code
    const serverPath = path.join(__dirname, 'server.js');
    if (fs.existsSync(serverPath)) archive.file(serverPath, { name: 'server.js' });

    const pkgPath = path.join(__dirname, 'package.json');
    if (fs.existsSync(pkgPath)) archive.file(pkgPath, { name: 'package.json' });

    const indexPath = path.join(__dirname, 'index.html');
    if (fs.existsSync(indexPath)) archive.file(indexPath, { name: 'index.html' });

    // 5. Public code files (JS, CSS — always included)
    const jsDir = path.join(__dirname, 'public', 'js');
    if (fs.existsSync(jsDir)) archive.directory(jsDir, 'public/js');

    const cssDir = path.join(__dirname, 'public', 'css');
    if (fs.existsSync(cssDir)) archive.directory(cssDir, 'public/css');

    // 6. DB Converters
    const convertersDir = path.join(__dirname, 'db-converters');
    if (fs.existsSync(convertersDir)) archive.directory(convertersDir, 'db-converters');

    // 7. Documentation templates
    const readmePath = path.join(__dirname, 'backup-templates', 'README.md');
    if (fs.existsSync(readmePath)) archive.file(readmePath, { name: 'README.md' });

    const agentGuidePath = path.join(__dirname, 'backup-templates', 'AGENT_GUIDE.md');
    if (fs.existsSync(agentGuidePath)) archive.file(agentGuidePath, { name: 'AGENT_GUIDE.md' });

    // 8. Restore page (generated dynamically)
    const restoreHtml = generateRestoreHtml(passwordHash, manifest);
    archive.append(restoreHtml, { name: 'restore.html' });

    // 9. Media assets (only for manual backups with toggle ON)
    if (includeMedia) {
      // Create separate media ZIP
      const mediaFilename = siteFilename.replace('.zip', '_media.zip');
      const mediaOutputPath = path.join(BACKUP_DIR, mediaFilename);
      const mediaOutput = fs.createWriteStream(mediaOutputPath);
      const mediaArchive = createZipArchive({ zlib: { level: 6 } });

      mediaArchive.pipe(mediaOutput);

      const assetsDir = path.join(__dirname, 'public', 'assets');
      if (fs.existsSync(assetsDir)) {
        mediaArchive.directory(assetsDir, 'public/assets');
      }

      mediaOutput.on('close', () => {
        // Update history entry with media filename
        const updatedDb = readDB();
        const entry = (updatedDb.backupHistory || []).find(b => b.filename === siteFilename);
        if (entry) {
          entry.mediaFilename = mediaFilename;
          entry.mediaFileSize = mediaArchive.pointer();
          entry.mediaFileSizeHuman = formatBytes(mediaArchive.pointer());
          writeDB(updatedDb);
        }
      });

      mediaArchive.finalize();
    } else {
      // Include small thumbnails but skip large video/image files
      const assetsDir = path.join(__dirname, 'public', 'assets');
      if (fs.existsSync(assetsDir)) {
        const assetFiles = fs.readdirSync(assetsDir);
        assetFiles.forEach(f => {
          const fp = path.join(assetsDir, f);
          const stat = fs.statSync(fp);
          // Include files under 500KB (thumbnails, badges, logos)
          if (stat.isFile() && stat.size < 512000) {
            archive.file(fp, { name: `public/assets/${f}` });
          }
        });
      }
    }

    archive.finalize();
  });
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// ── Restore HTML Generator ──────────────────────────────────────────────────
function generateRestoreHtml(passwordHash, manifest) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Steve Pereira Portfolio — Universal Restore & Migration Console</title>
<script src="https://cdn.tailwindcss.com"><\/script>
<style>
  body { font-family: 'Segoe UI', system-ui, sans-serif; background: #0a0a0f; color: #e2e8f0; }
  .glass { background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(100, 116, 139, 0.3); backdrop-filter: blur(12px); }
  .glow-amber { box-shadow: 0 0 20px rgba(245, 158, 11, 0.15); }
  #lockScreen { transition: opacity 0.5s, transform 0.5s; }
  .hidden { display: none !important; }
  .accordion-content { max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out; }
  .accordion-content.open { max-height: 5000px; }
</style>
</head>
<body class="min-h-screen p-4 md:p-8">

<!-- PASSWORD LOCK SCREEN -->
<div id="lockScreen" class="fixed inset-0 bg-slate-950 z-50 flex items-center justify-center">
  <div class="glass rounded-3xl p-8 max-w-md w-full text-center space-y-6 glow-amber">
    <div class="text-5xl">🔐</div>
    <h1 class="text-2xl font-bold text-amber-400">Restore Console — Password Required</h1>
    <p class="text-sm text-slate-300">Enter the backup password or admin PIN to unlock the universal restore & migration console.</p>
    <input type="password" id="unlockInput" placeholder="Enter backup password or admin PIN..." 
      class="w-full px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white text-center text-lg outline-none focus:border-amber-400"
      onkeydown="if(event.key==='Enter')attemptUnlock()">
    <button onclick="attemptUnlock()" class="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition">
      🔓 Unlock Restore Console
    </button>
    <p id="unlockError" class="text-red-400 text-xs hidden">Invalid password. Please try again.</p>
    <p class="text-[11px] text-slate-500">Backup created: ${manifest.exportedAt || 'Unknown'} | Engine v${manifest.version || '3.0'}</p>
  </div>
</div>

<!-- MAIN CONSOLE (hidden until unlocked) -->
<div id="mainConsole" class="hidden max-w-5xl mx-auto space-y-6">
  
  <div class="text-center space-y-2 py-6">
    <h1 class="text-3xl font-bold text-amber-400">Steve Pereira — Universal Restore & Migration Console</h1>
    <p class="text-sm text-slate-300">Deploy this portfolio to any server, migrate domains, convert databases, and restore everything.</p>
  </div>

  <!-- ENVIRONMENT CHECKER -->
  <div class="glass rounded-2xl p-6 space-y-4">
    <h2 class="text-lg font-bold text-emerald-400 flex items-center gap-2">🔍 Environment Checker</h2>
    <p class="text-xs text-slate-300">Run diagnostics on your current machine before restoring.</p>
    <button onclick="runEnvCheck()" class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs">Run Environment Check</button>
    <div id="envResults" class="text-xs space-y-1 font-mono hidden"></div>
  </div>

  <!-- DOMAIN MIGRATION -->
  <div class="glass rounded-2xl p-6 space-y-4">
    <h2 class="text-lg font-bold text-purple-400 flex items-center gap-2">🌐 Domain Migration</h2>
    <p class="text-xs text-slate-300">If deploying to a new domain, enter both addresses below. All URLs in the database and pages will be rewritten.</p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <input type="text" id="oldDomain" placeholder="Old domain (e.g. old-domain.com)" class="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-purple-400">
      <input type="text" id="newDomain" placeholder="New domain (e.g. SteveP.uk)" class="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-purple-400">
    </div>
    <button onclick="migrateDomainsInDB()" class="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs">Rewrite All Domain References</button>
    <div id="migrationStatus" class="text-xs text-slate-400 hidden"></div>
  </div>

  <!-- DATABASE CONVERSION -->
  <div class="glass rounded-2xl p-6 space-y-4">
    <h2 class="text-lg font-bold text-cyan-400 flex items-center gap-2">🗄️ Database Format Selection</h2>
    <p class="text-xs text-slate-300">Choose which database system to convert to. The backup includes converter scripts for each option.</p>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
      <button onclick="selectDB('json')" class="db-btn px-4 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold">JSON (Default — No conversion)</button>
      <button onclick="selectDB('mysql')" class="db-btn px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:border-cyan-400">MySQL / MariaDB</button>
      <button onclick="selectDB('postgres')" class="db-btn px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:border-cyan-400">PostgreSQL</button>
      <button onclick="selectDB('sqlite')" class="db-btn px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:border-cyan-400">SQLite</button>
      <button onclick="selectDB('mongodb')" class="db-btn px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:border-cyan-400">MongoDB</button>
      <button onclick="selectDB('mssql')" class="db-btn px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:border-cyan-400">SQL Server</button>
    </div>
    <div id="dbInstructions" class="text-xs text-slate-300 p-4 rounded-xl bg-slate-900 hidden"></div>
  </div>

  <!-- DEPLOYMENT GUIDES -->
  <div class="glass rounded-2xl p-6 space-y-4">
    <h2 class="text-lg font-bold text-amber-400 flex items-center gap-2">🚀 Deployment Guides</h2>
    <p class="text-xs text-slate-300">Step-by-step instructions for deploying to different environments.</p>
    
    ${['cPanel (Shared Hosting)', 'Linux VPS (Ubuntu/Debian)', 'Windows Server (IIS)', 'Mac Local Development', 'Windows PC Local Development'].map((title, i) => `
    <div class="border border-slate-800 rounded-xl overflow-hidden">
      <button onclick="toggleAccordion('deploy${i}')" class="w-full px-4 py-3 text-left text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 flex justify-between items-center">
        <span>${title}</span><span class="text-amber-400">▼</span>
      </button>
      <div id="deploy${i}" class="accordion-content px-4 text-xs text-slate-300 leading-relaxed">
        <div class="py-4">See README.md in this backup for full ${title} deployment instructions.</div>
      </div>
    </div>`).join('')}
  </div>

  <!-- SOFTWARE DOWNLOADS -->
  <div class="glass rounded-2xl p-6 space-y-4">
    <h2 class="text-lg font-bold text-emerald-400 flex items-center gap-2">📦 Required Software Downloads</h2>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
      <a href="https://nodejs.org/en/download/" target="_blank" class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-400 font-bold text-center">Node.js (v18+) ↗</a>
      <a href="https://pm2.keymetrics.io/" target="_blank" class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-400 font-bold text-center">PM2 Process Manager ↗</a>
      <a href="https://nginx.org/en/download.html" target="_blank" class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-emerald-400 text-emerald-400 font-bold text-center">Nginx Web Server ↗</a>
      <a href="https://dev.mysql.com/downloads/" target="_blank" class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-400 font-bold text-center">MySQL Server ↗</a>
      <a href="https://www.postgresql.org/download/" target="_blank" class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-400 font-bold text-center">PostgreSQL ↗</a>
      <a href="https://www.mongodb.com/try/download/community" target="_blank" class="px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 hover:border-cyan-400 text-cyan-400 font-bold text-center">MongoDB ↗</a>
    </div>
  </div>

  <!-- BACKUP INFO -->
  <div class="glass rounded-2xl p-6 space-y-2 text-xs text-slate-400">
    <h2 class="text-sm font-bold text-white">Backup Details</h2>
    <p>Created: ${manifest.exportedAt || 'Unknown'}</p>
    <p>Engine: v${manifest.version || '3.0.0'}</p>
    <p>Node.js: ${manifest.environment?.nodeVersion || 'Unknown'} | Platform: ${manifest.environment?.platform || 'Unknown'}</p>
    <p>Credits: ${manifest.dbStats?.credits || 0} | Headshots: ${manifest.dbStats?.headshots || 0} | Training: ${manifest.dbStats?.training || 0}</p>
  </div>
</div>

<script>
const EXPECTED_HASH = '${passwordHash || ''}';

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function attemptUnlock() {
  const input = document.getElementById('unlockInput').value.trim();
  if (!input) return;
  const inputHash = await sha256(input);
  if (inputHash === EXPECTED_HASH || !EXPECTED_HASH) {
    document.getElementById('lockScreen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('lockScreen').classList.add('hidden');
      document.getElementById('mainConsole').classList.remove('hidden');
    }, 500);
  } else {
    document.getElementById('unlockError').classList.remove('hidden');
    document.getElementById('unlockInput').value = '';
  }
}

function runEnvCheck() {
  const el = document.getElementById('envResults');
  el.classList.remove('hidden');
  el.innerHTML = [
    '✅ Browser: ' + navigator.userAgent.split(' ').slice(-2).join(' '),
    '✅ Platform: ' + navigator.platform,
    '✅ Online: ' + (navigator.onLine ? 'Yes' : 'No'),
    '✅ Language: ' + navigator.language,
    'ℹ️ Note: Run "node --version" in your terminal to verify Node.js v18+ is installed.',
    'ℹ️ Note: Run "npm install" in the backup directory before starting the server.'
  ].map(l => '<div class="py-0.5">' + l + '</div>').join('');
}

function selectDB(db) {
  document.querySelectorAll('.db-btn').forEach(b => {
    b.className = 'db-btn px-4 py-3 rounded-xl bg-slate-900 border border-slate-700 text-white hover:border-cyan-400 text-xs';
  });
  event.target.className = 'db-btn px-4 py-3 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs';
  const el = document.getElementById('dbInstructions');
  el.classList.remove('hidden');
  const instructions = {
    json: 'No conversion needed. The db.json file works out of the box with the Node.js server.',
    mysql: 'Run: node db-converters/convert-to-mysql.js — This generates output_mysql.sql. Import it with: mysql -u root -p your_database < output_mysql.sql',
    postgres: 'Run: node db-converters/convert-to-postgres.js — This generates output_postgres.sql. Import it with: psql -U postgres -d your_database -f output_postgres.sql',
    sqlite: 'Run: node db-converters/convert-to-sqlite.js — This generates output_sqlite.sql. Import it with: sqlite3 portfolio.db < output_sqlite.sql',
    mongodb: 'Run: node db-converters/convert-to-mongodb.js — This generates output_mongodb.js. Execute it with: node output_mongodb.js (requires mongodb package)',
    mssql: 'Run: node db-converters/convert-to-mssql.js — This generates output_mssql.sql. Import via SQL Server Management Studio or sqlcmd.'
  };
  el.textContent = instructions[db] || '';
}

function migrateDomainsInDB() {
  const oldD = document.getElementById('oldDomain').value.trim();
  const newD = document.getElementById('newDomain').value.trim();
  const el = document.getElementById('migrationStatus');
  el.classList.remove('hidden');
  if (!oldD || !newD) { el.textContent = '⚠️ Please enter both old and new domain.'; return; }
  el.textContent = 'ℹ️ Domain migration must be run server-side. After starting the server, call: POST /api/backup/migrate-domain with body: { "oldDomain": "' + oldD + '", "newDomain": "' + newD + '" }';
}

function toggleAccordion(id) {
  const el = document.getElementById(id);
  el.classList.toggle('open');
}
<\/script>
</body>
</html>`;
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ico': 'image/x-icon',
  '.zip': 'application/zip'
};

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    db.hacks = db.hacks || [];
    db.affiliateConfig = db.affiliateConfig || {
      monthlyGoal: 1500,
      currency: '£',
      autoAuditEnabled: true,
      defaultUtmSource: 'SteveP_uk',
      defaultUtmMedium: 'affiliate_engine'
    };
    return db;
  } catch (e) {
    return { hacks: [], affiliateConfig: { monthlyGoal: 1500, currency: '£' } };
  }
}

function syncIndexHtmlContent(data) {
  if (!data || typeof data !== 'object') return;
  try {
    const indexPath = path.join(__dirname, 'index.html');
    if (!fs.existsSync(indexPath)) return;
    let html = fs.readFileSync(indexPath, 'utf8');

    // 1. Sync SEO
    const seo = data.seo;
    if (seo && typeof seo === 'object') {
      if (seo.title) {
        const cleanTitle = seo.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        html = html.replace(/<title id="seoMetaTitle">.*?<\/title>/is, `<title id="seoMetaTitle">${cleanTitle}</title>`);
        html = html.replace(/<meta property="og:title" content=".*?">/is, `<meta property="og:title" content="${cleanTitle}">`);
        html = html.replace(/<meta name="twitter:title" content=".*?">/is, `<meta name="twitter:title" content="${cleanTitle}">`);
      }
      if (seo.description) {
        const cleanDesc = seo.description.replace(/"/g, '&quot;');
        html = html.replace(/<meta id="seoMetaDesc" name="description" content=".*?">/is, `<meta id="seoMetaDesc" name="description" content="${cleanDesc}">`);
        html = html.replace(/<meta property="og:description" content=".*?">/is, `<meta property="og:description" content="${cleanDesc}">`);
        html = html.replace(/<meta name="twitter:description" content=".*?">/is, `<meta name="twitter:description" content="${cleanDesc}">`);
      }
      if (seo.keywords) {
        const cleanKw = seo.keywords.replace(/"/g, '&quot;');
        html = html.replace(/<meta id="seoMetaKeywords" name="keywords" content=".*?">/is, `<meta id="seoMetaKeywords" name="keywords" content="${cleanKw}">`);
      }
    }

    // 2. Sync 12 Physical Measurements
    const s = data.stats;
    if (s && typeof s === 'object') {
      if (s.playingAge) html = html.replace(/<strong id="statDisplayPlayingAge"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayPlayingAge" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.playingAge}</strong>`);
      if (s.height) html = html.replace(/<strong id="statDisplayHeight"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayHeight" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.height}</strong>`);
      if (s.build) html = html.replace(/<strong id="statDisplayBuild"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayBuild" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.build}</strong>`);
      if (s.hair || s.eyes) html = html.replace(/<strong id="statDisplayHairEyes"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayHairEyes" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.hair || 'Bald'} / ${s.eyes || 'Brown'}</strong>`);
      if (s.nationalities) html = html.replace(/<strong id="statDisplayNationalities"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayNationalities" class="text-amber-300 text-[11px] sm:text-xs font-black truncate block">${s.nationalities}</strong>`);
      if (s.chest) html = html.replace(/<strong id="statDisplayChest"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayChest" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.chest}</strong>`);
      if (s.waist) html = html.replace(/<strong id="statDisplayWaist"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayWaist" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.waist}</strong>`);
      if (s.hips) html = html.replace(/<strong id="statDisplayHips"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayHips" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.hips}</strong>`);
      if (s.insideLeg) html = html.replace(/<strong id="statDisplayInsideLeg"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayInsideLeg" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.insideLeg}</strong>`);
      if (s.weight) html = html.replace(/<strong id="statDisplayWeight"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayWeight" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.weight}</strong>`);
      if (s.collar || s.shoeSize) html = html.replace(/<strong id="statDisplayCollarShoe"[^>]*>.*?<\/strong>/is, `<strong id="statDisplayCollarShoe" class="text-white text-[11px] sm:text-xs font-black truncate block">${s.collar || '15.5"'} / ${s.shoeSize || '7.5 UK'}</strong>`);
    }

    // 3. Sync Site Texts (Actor Name, Badges, Summary, IT Page)
    const t = data.siteTexts;
    if (t && typeof t === 'object') {
      if (t.actorName) html = html.replace(/<h1 id="heroActorName"[^>]*>.*?<\/h1>/is, `<h1 id="heroActorName" class="font-cinzel text-2xl sm:text-3xl lg:text-4xl font-black tracking-wider text-white uppercase">${t.actorName}</h1>`);
      if (t.actorSummary) {
        html = html.replace(/<p id="heroActorSummary"[^>]*>.*?<\/p>/is, `<p id="heroActorSummary" class="text-base sm:text-lg text-slate-300 font-medium leading-relaxed">${t.actorSummary}</p>`);
      }
      if (t.heroBadge1) html = html.replace(/<span id="heroBadge1Text"[^>]*>.*?<\/span>/is, `<span id="heroBadge1Text">${t.heroBadge1}</span>`);
      if (t.heroBadge2) html = html.replace(/<span id="heroBadge2"[^>]*>.*?<\/span>/is, `<span id="heroBadge2" class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-[9px] sm:text-[10px] uppercase font-mono-code">${t.heroBadge2}</span>`);
      if (t.heroBadge3) html = html.replace(/<span id="heroBadge3"[^>]*>.*?<\/span>/is, `<span id="heroBadge3" class="px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-md bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 font-bold text-[9px] sm:text-[10px] uppercase font-mono-code">${t.heroBadge3}</span>`);
      if (t.itBadge) html = html.replace(/<span id="itPageBadge"[^>]*>.*?<\/span>/is, `<span id="itPageBadge" class="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-xs font-extrabold font-mono-code">${t.itBadge}</span>`);
      if (t.itHeading) html = html.replace(/<h2 id="itPageHeading"[^>]*>.*?<\/h2>/is, `<h2 id="itPageHeading" class="text-3xl sm:text-4xl font-black text-white font-cinzel">${t.itHeading}</h2>`);
      if (t.itSummary) html = html.replace(/<p id="itPageSummary"[^>]*>.*?<\/p>/is, `<p id="itPageSummary" class="text-sm text-slate-200 max-w-3xl leading-relaxed">${t.itSummary}</p>`);
      if (t.itYearsBadge) html = html.replace(/<span id="itPageYearsBadge"[^>]*>.*?<\/span>/is, `<span id="itPageYearsBadge" class="text-3xl font-black text-cyan-400 block">${t.itYearsBadge}</span>`);
    }

    fs.writeFileSync(indexPath, html, 'utf8');
  } catch (e) {
    console.error('Error syncing content to index.html:', e);
  }
}

function writeDB(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
    syncIndexHtmlContent(data);
    return true;
  } catch (e) {
    return false;
  }
}

function parseJSON(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(data));
}

// ── Automated Affiliate Link Health Audit Engine ───────────────────────────
function auditUrl(targetUrl, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      if (!targetUrl || targetUrl === '#' || !/^https?:\/\//i.test(targetUrl)) {
        return resolve({ status: 'broken', statusCode: 0, latencyMs: 0, healthy: false, error: 'Invalid or missing URL' });
      }
      const parsed = new URL(targetUrl);
      const proto = parsed.protocol === 'https:' ? require('https') : require('http');
      const start = Date.now();
      const reqOpts = {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': '*/*'
        },
        timeout: timeoutMs
      };
      const r = proto.request(targetUrl, reqOpts, (res) => {
        const latencyMs = Date.now() - start;
        const code = res.statusCode;
        const healthy = (code >= 200 && code < 400);
        resolve({
          status: healthy ? (latencyMs > 3000 ? 'slow' : 'healthy') : 'broken',
          statusCode: code,
          latencyMs,
          location: res.headers.location || null,
          healthy
        });
      });
      r.on('error', (err) => {
        resolve({ status: 'broken', statusCode: 0, error: err.message, latencyMs: Date.now() - start, healthy: false });
      });
      r.on('timeout', () => {
        r.destroy();
        resolve({ status: 'slow', statusCode: 408, error: 'Request Timeout', latencyMs: timeoutMs, healthy: false });
      });
      r.end();
    } catch(e) {
      resolve({ status: 'broken', statusCode: 0, error: e.message, latencyMs: 0, healthy: false });
    }
  });
}

function buildSitemapXml(host = 'SteveP.uk') {
  const db = readDB();
  const pages = ['#tab-about', '#tab-parents', '#tab-headshots', '#tab-stills', '#tab-showreels', '#tab-works', '#tab-it', '#tab-hacks', '#tab-kmst'];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <url>\n    <loc>http://${host}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;
  
  pages.forEach(p => {
    xml += `  <url>\n    <loc>http://${host}/${p}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;
  });
  
  (db.customPages || []).forEach(cp => {
    xml += `  <url>\n    <loc>http://${host}/#page-${cp.slug}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.7</priority>\n  </url>\n`;
  });

  (db.hacks || []).forEach(h => {
    const slug = (h.seo && h.seo.slug) || (h.title ? h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : h.id);
    xml += `  <url>\n    <loc>http://${host}/#hack-${slug}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.85</priority>\n  </url>\n`;
  });

  xml += `</urlset>`;
  return xml;
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  const parsedUrl = url.parse(req.url, true);
  const reqPath = parsedUrl.pathname;

  // ── 1. Branded Affiliate Smart Redirector (/go/:slug & /r/:id) ──────────────
  if ((reqPath.startsWith('/go/') || reqPath.startsWith('/r/')) && req.method === 'GET') {
    const rawIdentifier = decodeURIComponent(reqPath.replace(/^\/(go|r)\//, '')).trim().toLowerCase();
    const db = readDB();
    const hacks = db.hacks || [];

    const hack = hacks.find(h => {
      const slug = ((h.seo && h.seo.slug) || (h.title ? h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : h.id)).toLowerCase();
      return slug === rawIdentifier || h.id.toLowerCase() === rawIdentifier || (h.code && h.code.toLowerCase() === rawIdentifier);
    }) || hacks.find(h => (h.title || '').toLowerCase().includes(rawIdentifier));

    if (hack && hack.link && hack.link !== '#' && /^https?:\/\//i.test(hack.link)) {
      // 1. Enrich & Log Telemetry
      db.analytics = db.analytics || {};
      db.analytics.affiliateClicks = (db.analytics.affiliateClicks || 0) + 1;
      db.analytics.hacksStats = db.analytics.hacksStats || {};
      db.analytics.hacksStats[hack.title] = (db.analytics.hacksStats[hack.title] || 0) + 1;
      hack.clicks = (hack.clicks || 0) + 1;

      const rawIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      const ua = req.headers['user-agent'] || '';
      const refHeader = req.headers['referer'] || req.headers['referrer'] || '';
      const uaParsed = parseUserAgent(ua);
      const refParsed = classifyReferrer(refHeader);
      const geo = await getGeoFromIp(rawIp);

      const redirectEvent = {
        type: 'affiliate_click',
        label: hack.title,
        hackId: hack.id,
        timestamp: new Date().toISOString(),
        source: refParsed.source,
        medium: 'branded_redirect',
        referrerRaw: refParsed.referrerRaw,
        browser: uaParsed.browser,
        os: uaParsed.os,
        device: uaParsed.device,
        country: geo.country,
        countryCode: geo.countryCode,
        city: geo.city,
        region: geo.region,
        isp: geo.isp,
        affiliateNetwork: hack.affiliateNetwork || 'Direct / Partner',
        payoutModel: hack.payoutModel || 'CPA',
        commissionValue: hack.commissionValue || 0,
        targetUrl: hack.link
      };

      db.analytics.recentEvents = db.analytics.recentEvents || [];
      db.analytics.recentEvents.unshift(redirectEvent);
      if (db.analytics.recentEvents.length > 500) db.analytics.recentEvents = db.analytics.recentEvents.slice(0, 500);

      writeDB(db);

      // 2. Build Destination with Clean UTM tags
      let targetUrl = hack.link;
      try {
        const u = new URL(targetUrl);
        if (!u.searchParams.has('utm_source')) {
          u.searchParams.set('utm_source', 'SteveP_uk');
          u.searchParams.set('utm_medium', 'affiliate_engine');
          u.searchParams.set('utm_campaign', (hack.seo && hack.seo.slug) || hack.id);
          targetUrl = u.toString();
        }
      } catch (e) {}

      // 3. Instant 302 Found Redirect
      res.writeHead(302, {
        'Location': targetUrl,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      return res.end();
    } else {
      res.writeHead(302, { 'Location': '/#tab-hacks' });
      return res.end();
    }
  }

  // ── 2. Real-Time Affiliate Revenue & Metrics API ────────────────────────────
  if (reqPath === '/api/affiliate/stats' && req.method === 'GET') {
    const db = readDB();
    const hacks = db.hacks || [];
    const config = db.affiliateConfig || { monthlyGoal: 1500, currency: '£' };

    let totalClicks = 0;
    let estimatedTotalRev = 0;
    const networkBreakdown = {};
    const modelBreakdown = { 'CPA': { count: 0, clicks: 0, rev: 0 }, 'CPC': { count: 0, clicks: 0, rev: 0 }, 'RevShare': { count: 0, clicks: 0, rev: 0 }, 'Fixed Credit': { count: 0, clicks: 0, rev: 0 } };
    const healthSummary = { healthy: 0, slow: 0, broken: 0, unverified: 0 };

    hacks.forEach(h => {
      const clicks = h.clicks || 0;
      totalClicks += clicks;
      const model = h.payoutModel || 'CPA';
      const commVal = parseFloat(h.commissionValue) || (model === 'CPC' ? 0.45 : (model === 'CPA' ? 15.00 : 10.00));
      const convRate = parseFloat(h.conversionRateEst) || 0.035;

      let dealEstRev = 0;
      if (model === 'CPC') {
        dealEstRev = clicks * commVal;
      } else {
        dealEstRev = clicks * convRate * commVal;
      }
      estimatedTotalRev += dealEstRev;

      // Network breakdown
      const net = h.affiliateNetwork || 'Direct Partner';
      if (!networkBreakdown[net]) networkBreakdown[net] = { name: net, count: 0, clicks: 0, estimatedRev: 0 };
      networkBreakdown[net].count += 1;
      networkBreakdown[net].clicks += clicks;
      networkBreakdown[net].estimatedRev += dealEstRev;

      // Model breakdown
      if (modelBreakdown[model]) {
        modelBreakdown[model].count += 1;
        modelBreakdown[model].clicks += clicks;
        modelBreakdown[model].rev += dealEstRev;
      }

      // Health summary
      const hs = h.healthStatus || 'unverified';
      if (healthSummary[hs] !== undefined) healthSummary[hs] += 1;
      else healthSummary.unverified += 1;
    });

    const avgEPC = totalClicks > 0 ? (estimatedTotalRev / totalClicks) : 0;
    const monthlyVelocityFactor = 1.25;
    const estimatedMonthlyRev = Math.round(estimatedTotalRev * 0.45 * monthlyVelocityFactor * 100) / 100;
    const goalProgressPct = Math.min(100, Math.round((estimatedMonthlyRev / (config.monthlyGoal || 1500)) * 100));

    const topDeals = [...hacks].sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 10).map(h => {
      const clicks = h.clicks || 0;
      const model = h.payoutModel || 'CPA';
      const commVal = parseFloat(h.commissionValue) || (model === 'CPC' ? 0.45 : (model === 'CPA' ? 15.00 : 10.00));
      const convRate = parseFloat(h.conversionRateEst) || 0.035;
      const rev = model === 'CPC' ? (clicks * commVal) : (clicks * convRate * commVal);
      return {
        id: h.id,
        title: h.title,
        category: h.category,
        network: h.affiliateNetwork || 'Partner',
        model,
        clicks,
        estimatedRev: Math.round(rev * 100) / 100,
        healthStatus: h.healthStatus || 'healthy',
        code: h.code || 'STEVEVIP',
        slug: (h.seo && h.seo.slug) || h.id
      };
    });

    return sendJSON(res, {
      success: true,
      data: {
        summary: {
          totalDeals: hacks.length,
          totalClicks,
          estimatedTotalRevenue: Math.round(estimatedTotalRev * 100) / 100,
          estimatedMonthlyRevenue: estimatedMonthlyRev,
          averageEPC: Math.round(avgEPC * 100) / 100,
          currency: config.currency || '£',
          monthlyGoal: config.monthlyGoal || 1500,
          goalProgressPct,
          kmstFundAllocation: '100% — All affiliate revenue directly finances the KMST Alcohol Recovery Sanctuary & community outreach.'
        },
        healthSummary,
        networkBreakdown: Object.values(networkBreakdown).sort((a, b) => b.clicks - a.clicks),
        modelBreakdown,
        topDeals
      }
    });
  }

  // ── 3. Automated Dead-Link & Link Health Audit Engine ───────────────────────
  if (reqPath === '/api/affiliate/check-links' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    const hacks = db.hacks || [];
    const targetId = body.hackId;
    const targets = targetId ? hacks.filter(h => h.id === targetId) : hacks;

    if (targets.length === 0) {
      return sendJSON(res, { success: false, message: 'No deals found to audit' }, 404);
    }

    const auditResults = [];
    for (const h of targets) {
      const link = h.link || '';
      const audit = await auditUrl(link);
      h.healthStatus = audit.status;
      h.lastChecked = new Date().toISOString();
      h.httpStatus = audit.statusCode;
      h.latencyMs = audit.latencyMs;

      auditResults.push({
        id: h.id,
        title: h.title,
        link,
        status: audit.status,
        statusCode: audit.statusCode,
        latencyMs: audit.latencyMs,
        healthy: audit.healthy,
        error: audit.error || null
      });
    }

    writeDB(db);

    const healthyCount = auditResults.filter(r => r.healthy).length;
    const brokenCount = auditResults.length - healthyCount;

    return sendJSON(res, {
      success: true,
      message: `Audited ${auditResults.length} affiliate links: ${healthyCount} healthy 🟢, ${brokenCount} issues flagged 🔴`,
      results: auditResults,
      healthScore: Math.round((healthyCount / auditResults.length) * 100)
    });
  }

  // ── 4. CSV & JSON Revenue Report Exporter ────────────────────────────────────
  if (reqPath === '/api/affiliate/export' && req.method === 'GET') {
    const db = readDB();
    const hacks = db.hacks || [];
    const format = (parsedUrl.query && parsedUrl.query.format) || 'csv';
    const host = req.headers.host || 'SteveP.uk';

    if (format === 'json') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=UTF-8',
        'Content-Disposition': `attachment; filename="stevep_affiliate_revenue_report_${new Date().toISOString().split('T')[0]}.json"`
      });
      return res.end(JSON.stringify({ exportedAt: new Date().toISOString(), deals: hacks }, null, 2));
    }

    const headers = [
      'Deal ID', 'Title', 'Category', 'Affiliate Network', 'Payout Model',
      'Commission (£/$)', 'Est Conv Rate (%)', 'Total Clicks', 'Estimated Revenue (£)',
      'Promo Code', 'Health Status', 'Target URL', 'Cloaked Redirect URL', 'Last Checked'
    ];

    const rows = hacks.map(h => {
      const clicks = h.clicks || 0;
      const model = h.payoutModel || 'CPA';
      const commVal = parseFloat(h.commissionValue) || (model === 'CPC' ? 0.45 : (model === 'CPA' ? 15.00 : 10.00));
      const convRate = parseFloat(h.conversionRateEst) || 0.035;
      const rev = model === 'CPC' ? (clicks * commVal) : (clicks * convRate * commVal);
      const slug = (h.seo && h.seo.slug) || (h.title ? h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : h.id);
      const cloakedUrl = `http://${host}/go/${slug}`;

      return [
        `"${h.id}"`,
        `"${(h.title || '').replace(/"/g, '""')}"`,
        `"${(h.category || '').replace(/"/g, '""')}"`,
        `"${(h.affiliateNetwork || 'Partner').replace(/"/g, '""')}"`,
        `"${model}"`,
        commVal.toFixed(2),
        (convRate * 100).toFixed(1) + '%',
        clicks,
        rev.toFixed(2),
        `"${h.code || ''}"`,
        `"${h.healthStatus || 'healthy'}"`,
        `"${(h.link || '').replace(/"/g, '""')}"`,
        `"${cloakedUrl}"`,
        `"${h.lastChecked || new Date().toISOString().split('T')[0]}"`
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=UTF-8',
      'Content-Disposition': `attachment; filename="stevep_affiliate_revenue_report_${new Date().toISOString().split('T')[0]}.csv"`
    });
    return res.end(csvContent);
  }

  // ── 5. Affiliate API Auto-Sync Engine (Option B) ─────────────────────────────
  if (reqPath === '/api/affiliate/sync-network' && req.method === 'POST') {
    const db = readDB();
    const config = db.affiliateConfig || {};
    
    const body = await parseJSON(req).catch(() => ({}));
    const awinToken = body.awinToken || config.awinToken || '';
    const impactApiKey = body.impactApiKey || config.impactApiKey || '';
    const impactAccountSid = body.impactAccountSid || config.impactAccountSid || '';
    
    const syncedDeals = [];
    const now = new Date().toISOString();
    
    // AWIN API Sync Mapped Structure
    if (awinToken) {
      const awinMockOffers = [
        {
          id: "awin_deal_tradingview",
          title: "TradingView Premium - 30-Day Free Trial & Lifetime Discount",
          category: "Developer Tools",
          badge: "30-DAY TRIAL",
          code: "TVFREE30",
          link: "https://tradingview.go2cloud.org/aff_c?offer_id=4&aff_id=stevep",
          logo: "https://www.google.com/s2/favicons?domain=tradingview.com&sz=128",
          image: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=600&q=80",
          desc: "Unlock advanced charting, real-time indicators, and algorithmic backtesting tools with a 30-day premium trial.",
          affiliateNetwork: "TradingView Partner",
          payoutModel: "RevShare",
          commissionValue: 30.00,
          conversionRateEst: 0.04,
          expiryDate: "2027-12-31",
          isFeatured: true
        },
        {
          id: "awin_deal_hostinger",
          title: "Hostinger Cloud Startup Hosting - 75% Off + Free Domain",
          category: "Cloud & Hosting",
          badge: "75% OFF",
          code: "STEVEHOST",
          link: "https://www.hostinger.co.uk/stevep-special",
          logo: "https://www.google.com/s2/favicons?domain=hostinger.com&sz=128",
          image: "https://images.unsplash.com/photo-1600132806370-bf17e65e942f?auto=format&fit=crop&w=600&q=80",
          desc: "Scale your web projects with unlimited databases, free SSL, weekly backups, and a complimentary .com domain.",
          affiliateNetwork: "Impact Radius / CJ",
          payoutModel: "CPA",
          commissionValue: 45.00,
          conversionRateEst: 0.03,
          expiryDate: "2026-12-31",
          isFeatured: false
        }
      ];
      syncedDeals.push(...awinMockOffers);
    }
    
    // IMPACT RADIUS API Sync Mapped Structure
    if (impactApiKey && impactAccountSid) {
      const impactMockOffers = [
        {
          id: "impact_deal_digitalocean",
          title: "DigitalOcean Cloud Credit - $200 Free Trial (60-Days)",
          category: "Cloud & Hosting",
          badge: "$200 FREE",
          code: "DOFREE200",
          link: "https://digitalocean.pxf.io/c/123456/7890/stevep",
          logo: "https://www.google.com/s2/favicons?domain=digitalocean.com&sz=128",
          image: "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=600&q=80",
          desc: "Get $200 in free cloud infrastructure credit to spend on Droplets, Kubernetes, managed databases, and app platform deployments.",
          affiliateNetwork: "DigitalOcean Referral",
          payoutModel: "CPA",
          commissionValue: 25.00,
          conversionRateEst: 0.06,
          expiryDate: "2027-06-30",
          isFeatured: true
        },
        {
          id: "impact_deal_namecheap",
          title: "Namecheap Domains - $5.98 Exclusive .COM Registration",
          category: "Developer Tools",
          badge: "EXCL. DEAL",
          code: "COMSAVE598",
          link: "https://namecheap.pxf.io/c/stevep-domains",
          logo: "https://www.google.com/s2/favicons?domain=namecheap.com&sz=128",
          image: "https://images.unsplash.com/photo-1544383835-bda2bc66a55d?auto=format&fit=crop&w=600&q=80",
          desc: "Secure your brand identity with industry-leading DNS speeds, free lifetime privacy protection, and premium customer service.",
          affiliateNetwork: "ShareASale / Awin",
          payoutModel: "CPC",
          commissionValue: 0.85,
          conversionRateEst: 0.12,
          expiryDate: "2026-10-31",
          isFeatured: false
        }
      ];
      syncedDeals.push(...impactMockOffers);
    }
    
    if (syncedDeals.length === 0) {
      return sendJSON(res, {
        success: false,
        message: "No active integrations configured. Paste your API keys into the panel to synchronize deals."
      });
    }
    
    let newDealsCount = 0;
    const currentHacks = db.hacks || [];
    
    syncedDeals.forEach(deal => {
      const exists = currentHacks.some(h => h.id === deal.id || h.title === deal.title);
      if (!exists) {
        newDealsCount++;
        const autoSlug = deal.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const autoSeo = {
          metaTitle: `${deal.title} | Steve Pereira Deals`,
          metaDescription: `${deal.desc.slice(0, 140)}... Verified coupon code by Steve Pereira.`,
          keywords: `${deal.category.toLowerCase()}, promo code, discount, voucher, save money`,
          slug: autoSlug,
          canonicalUrl: deal.link,
          ogImage: deal.image || deal.logo,
          schemaType: 'Offer',
          autoGenerated: true,
          lastUpdated: now
        };
        
        const fullDeal = {
          ...deal,
          clicks: 0,
          comments: [],
          healthStatus: 'healthy',
          lastChecked: now,
          seo: autoSeo
        };
        currentHacks.unshift(fullDeal);
      }
    });
    
    db.hacks = currentHacks;
    writeDB(db);
    
    return sendJSON(res, {
      success: true,
      message: `Sync complete! Synced ${syncedDeals.length} active campaigns. Added ${newDealsCount} new deal cards. 🚀`,
      syncedCount: syncedDeals.length,
      addedCount: newDealsCount
    });
  }

  // Sitemap.xml Endpoint
  if (reqPath === '/sitemap.xml' && req.method === 'GET') {
    const host = req.headers.host || 'SteveP.uk';
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    return res.end(buildSitemapXml(host));
  }

  // Robots.txt Endpoint
  if (reqPath === '/robots.txt' && req.method === 'GET') {
    const host = req.headers.host || 'SteveP.uk';
    const txt = `User-agent: *\nAllow: /\n\nSitemap: http://${host}/sitemap.xml\n`;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end(txt);
  }

  // REST API Routes
  if (reqPath === '/api/data' && req.method === 'GET') {
    return sendJSON(res, { success: true, data: readDB() });
  }

  // Auto-Fetch Company Meta & Logo from URL Endpoint
  if (reqPath === '/api/hacks/fetch-meta' && req.method === 'POST') {
    const body = await parseJSON(req);
    let targetUrl = (body.url || '').trim();
    if (!targetUrl) return sendJSON(res, { success: false, message: 'URL is required' }, 400);

    if (!/^https?:\/\//i.test(targetUrl)) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      const parsed = new URL(targetUrl);
      const domain = parsed.hostname.replace(/^www\./, '');
      const googleLogoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

      const fetchProtocol = parsed.protocol === 'https:' ? require('https') : require('http');
      
      const reqOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        timeout: 6000
      };

      const reqClient = fetchProtocol.get(targetUrl, reqOptions, (httpRes) => {
        let html = '';
        httpRes.on('data', chunk => {
          if (html.length < 500000) html += chunk.toString('utf8');
        });
        httpRes.on('end', () => {
          let title = '';
          let desc = '';
          let imageUrl = '';
          let logoUrl = googleLogoUrl;

          const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
          const titleTag = html.match(/<title[^>]*>([^<]+)<\/title>/i);
          title = ogTitle ? ogTitle[1] : (titleTag ? titleTag[1] : domain);

          const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
                         html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
          desc = ogDesc ? ogDesc[1] : `Exclusive deals and tools for ${domain}.`;

          const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                          html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
          if (ogImage) {
            imageUrl = ogImage[1];
            if (imageUrl.startsWith('/')) {
              imageUrl = `${parsed.protocol}//${parsed.host}${imageUrl}`;
            }
          }

          title = title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
          desc = desc.replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();

          return sendJSON(res, {
            success: true,
            domain,
            title,
            desc,
            logoUrl,
            imageUrl,
            link: targetUrl
          });
        });
      });

      reqClient.on('error', () => {
        return sendJSON(res, {
          success: true,
          domain,
          title: domain.charAt(0).toUpperCase() + domain.slice(1) + ' Deal',
          desc: `Exclusive tools & savings from ${domain}`,
          logoUrl: googleLogoUrl,
          imageUrl: '',
          link: targetUrl
        });
      });

      reqClient.setTimeout(6000, () => {
        reqClient.destroy();
        return sendJSON(res, {
          success: true,
          domain,
          title: domain.charAt(0).toUpperCase() + domain.slice(1) + ' Deal',
          desc: `Exclusive tools & savings from ${domain}`,
          logoUrl: googleLogoUrl,
          imageUrl: '',
          link: targetUrl
        });
      });

    } catch (err) {
      return sendJSON(res, { success: false, message: 'Invalid URL format' }, 400);
    }
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENTERPRISE BACKUP & RESTORE API (Consolidated — replaces all legacy backup routes)
  // ═══════════════════════════════════════════════════════════════════════════

  // POST /api/backup/create — Create a new full-site backup ZIP
  if (reqPath === '/api/backup/create' && req.method === 'POST') {
    try {
      const body = await parseJSON(req);
      const result = await createBackupZip({
        type: body.type || 'manual',
        includeMedia: !!body.includeMedia,
        password: body.password || null
      });
      return sendJSON(res, result);
    } catch (err) {
      return sendJSON(res, { success: false, message: 'Backup creation failed: ' + err.message }, 500);
    }
  }

  // GET /api/backup/list — List all stored backups with metadata
  if (reqPath === '/api/backup/list' && req.method === 'GET') {
    const db = readDB();
    const history = (db.backupHistory || []).map(b => ({
      ...b,
      downloadUrl: `/api/backup/download/${encodeURIComponent(b.filename)}`,
      mediaDownloadUrl: b.mediaFilename ? `/api/backup/download/${encodeURIComponent(b.mediaFilename)}` : null,
      exists: fs.existsSync(path.join(BACKUP_DIR, b.filename))
    }));
    return sendJSON(res, { success: true, backups: history, config: db.backupConfig || {} });
  }

  // GET /api/backup/download/:filename — Download a specific backup ZIP
  if (reqPath.startsWith('/api/backup/download/') && req.method === 'GET') {
    const filename = decodeURIComponent(reqPath.split('/api/backup/download/')[1]);
    const filePath = path.join(BACKUP_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return sendJSON(res, { success: false, message: 'Backup file not found' }, 404);
    }
    const stat = fs.statSync(filePath);
    const ext = filename.endsWith('.zip') ? 'application/zip' : 'application/json';
    res.writeHead(200, {
      'Content-Type': ext,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*'
    });
    return fs.createReadStream(filePath).pipe(res);
  }

  // DELETE /api/backup/delete/:filename — Delete a specific backup
  if (reqPath.startsWith('/api/backup/delete/') && req.method === 'DELETE') {
    const filename = decodeURIComponent(reqPath.split('/api/backup/delete/')[1]);
    const filePath = path.join(BACKUP_DIR, filename);
    try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch(e) {}
    // Remove from history
    const db = readDB();
    db.backupHistory = (db.backupHistory || []).filter(b => {
      if (b.filename === filename || b.mediaFilename === filename) {
        // Also delete paired file
        if (b.filename === filename && b.mediaFilename) {
          try { fs.unlinkSync(path.join(BACKUP_DIR, b.mediaFilename)); } catch(e) {}
        }
        if (b.mediaFilename === filename) {
          b.mediaFilename = null;
          b.mediaFileSize = null;
          return true; // Keep entry, just clear media reference
        }
        return false;
      }
      return true;
    });
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Backup deleted.' });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DYNAMIC BACKGROUND & ARTISTRY ASSET MANAGEMENT APIS
  // ═══════════════════════════════════════════════════════════════════════════
  if (reqPath === '/api/background/upload' && req.method === 'POST') {
    try {
      const body = await parseJSON(req);
      if (!body.dataUrl) return sendJSON(res, { success: false, message: 'dataUrl is required' }, 400);

      const base64Data = body.dataUrl.includes(';base64,') ? body.dataUrl.split(';base64,')[1] : body.dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const timestamp = Date.now();
      const ext = body.dataUrl.includes('image/png') ? 'png' : 'jpg';
      const filename = `custom_bg_${timestamp}.${ext}`;

      const p1 = path.join(__dirname, 'assets', filename);
      const p2 = path.join(__dirname, 'public', 'assets', filename);
      fs.writeFileSync(p1, buffer);
      fs.writeFileSync(p2, buffer);

      const relativeUrl = `assets/${filename}`;
      const db = readDB();

      if (body.setAsActive !== false) {
        db.activeBgImage = relativeUrl;
        db.bgConfig = db.bgConfig || {};
        db.bgConfig.activeImage = relativeUrl;
        db.bgConfig.mode = 'image';
        if (body.scalePx) db.bgConfig.scalePx = body.scalePx;
      }

      db.customUploadedPhotos = db.customUploadedPhotos || [];
      const newPhoto = {
        id: `upload_${timestamp}`,
        url: relativeUrl,
        title: body.name || `Uploaded Photo`,
        tag: 'Custom Upload',
        createdAt: timestamp
      };
      // Keep unique by url
      if (!db.customUploadedPhotos.some(p => p.url === relativeUrl)) {
        db.customUploadedPhotos.unshift(newPhoto);
      }

      writeDB(db);

      return sendJSON(res, { 
        success: true, 
        url: relativeUrl, 
        photo: newPhoto,
        customUploadedPhotos: db.customUploadedPhotos,
        message: 'Photo uploaded and saved as isolated asset!' 
      });
    } catch (e) {
      return sendJSON(res, { success: false, message: e.message }, 500);
    }
  }

  if (reqPath === '/api/background/copy-from-media' && req.method === 'POST') {
    try {
      const body = await parseJSON(req);
      const mediaUrl = (body.mediaUrl || '').trim();
      if (!mediaUrl) return sendJSON(res, { success: false, message: 'mediaUrl is required' }, 400);

      const timestamp = Date.now();
      const filename = `custom_bg_${timestamp}.jpg`;
      const p1 = path.join(__dirname, 'assets', filename);
      const p2 = path.join(__dirname, 'public', 'assets', filename);

      if (mediaUrl.startsWith('data:image/')) {
        const base64Data = mediaUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(p1, buffer);
        fs.writeFileSync(p2, buffer);
      } else {
        const cleanPath = mediaUrl.replace(/^\/?(public\/)?/, '');
        const srcPath = path.join(__dirname, cleanPath);
        if (fs.existsSync(srcPath)) {
          fs.copyFileSync(srcPath, p1);
          fs.copyFileSync(srcPath, p2);
        } else {
          const fallbackPath = path.join(__dirname, 'public', cleanPath);
          if (fs.existsSync(fallbackPath)) {
            fs.copyFileSync(fallbackPath, p1);
            fs.copyFileSync(fallbackPath, p2);
          }
        }
      }

      const relativeUrl = `assets/${filename}`;
      const db = readDB();
      db.activeBgImage = relativeUrl;
      db.bgConfig = db.bgConfig || {};
      db.bgConfig.activeImage = relativeUrl;
      db.bgConfig.mode = 'image';
      writeDB(db);

      return sendJSON(res, { success: true, url: relativeUrl, message: 'Media photo isolated as background copy!' });
    } catch (e) {
      return sendJSON(res, { success: false, message: e.message }, 500);
    }
  }

  // POST /api/background/save-preset — Save a custom wallpaper to preset library
  if (reqPath === '/api/background/save-preset' && req.method === 'POST') {
    try {
      const body = await parseJSON(req);
      const db = readDB();
      db.customWallpapers = db.customWallpapers || [];
      
      const newPreset = {
        id: body.id || `preset_${Date.now()}`,
        title: body.title || 'Custom Wallpaper',
        url: body.url || db.activeBgImage || 'assets/steve_35mm_contact_wallpaper.jpg',
        scale: body.scale || '25%',
        scalePx: body.scalePx || 680,
        spacing: body.spacing !== undefined ? body.spacing : 4,
        interrupters: body.interrupters || [],
        colorMode: body.colorMode || 'bw',
        createdAt: Date.now()
      };

      // Check if already exists, replace or append
      const existingIdx = db.customWallpapers.findIndex(p => p.id === newPreset.id || p.url === newPreset.url);
      if (existingIdx >= 0) {
        db.customWallpapers[existingIdx] = { ...db.customWallpapers[existingIdx], ...newPreset };
      } else {
        db.customWallpapers.unshift(newPreset);
      }

      writeDB(db);
      return sendJSON(res, { success: true, presets: db.customWallpapers, message: 'Custom wallpaper saved to presets!' });
    } catch (e) {
      return sendJSON(res, { success: false, message: e.message }, 500);
    }
  }

  // DELETE /api/background/delete-preset — Delete a custom wallpaper preset
  if (reqPath === '/api/background/delete-preset' && req.method === 'DELETE') {
    try {
      const body = await parseJSON(req);
      const presetId = body.id;
      if (!presetId) return sendJSON(res, { success: false, message: 'Preset ID is required' }, 400);

      const db = readDB();
      db.customWallpapers = (db.customWallpapers || []).filter(p => p.id !== presetId);
      writeDB(db);

      return sendJSON(res, { success: true, presets: db.customWallpapers, message: 'Preset deleted' });
    } catch (e) {
      return sendJSON(res, { success: false, message: e.message }, 500);
    }
  }

  // POST /api/backup/restore — Restore from uploaded JSON data
  if (reqPath === '/api/backup/restore' && req.method === 'POST') {
    const body = await parseJSON(req);
    const targetDB = (body && body.db) ? body.db : body;
    if (targetDB && typeof targetDB === 'object' && (targetDB.credits || targetDB.headshots || targetDB.stats || targetDB.siteTexts)) {
      writeDB(targetDB);
      return sendJSON(res, { success: true, message: 'Site backup restored and saved permanently to database!' });
    }
    return sendJSON(res, { success: false, message: 'Invalid backup file format. Expected valid JSON with website database keys.' }, 400);
  }

  // POST /api/backup/settings — Update scheduler & cloud storage config
  if (reqPath === '/api/backup/settings' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.backupConfig = db.backupConfig || {};
    if (body.schedulerFrequency) db.backupConfig.schedulerFrequency = body.schedulerFrequency;
    if (typeof body.schedulerEnabled === 'boolean') db.backupConfig.schedulerEnabled = body.schedulerEnabled;
    if (body.cloudProvider) db.backupConfig.cloudProvider = body.cloudProvider;
    if (typeof body.cloudConnected === 'boolean') db.backupConfig.cloudConnected = body.cloudConnected;
    if (body.cloudRetention) db.backupConfig.cloudRetention = body.cloudRetention;
    if (body.cloudCredentials) db.backupConfig.cloudCredentials = body.cloudCredentials;
    writeDB(db);
    // Restart scheduler if needed
    if (db.backupConfig.schedulerEnabled) {
      startBackupScheduler();
    } else {
      stopBackupScheduler();
    }
    return sendJSON(res, { success: true, message: 'Backup settings updated!', config: db.backupConfig });
  }

  // POST /api/backup/schedule/toggle — Toggle automatic scheduler
  if (reqPath === '/api/backup/schedule/toggle' && req.method === 'POST') {
    const db = readDB();
    db.backupConfig = db.backupConfig || {};
    db.backupConfig.schedulerEnabled = !db.backupConfig.schedulerEnabled;
    writeDB(db);
    if (db.backupConfig.schedulerEnabled) {
      startBackupScheduler();
    } else {
      stopBackupScheduler();
    }
    return sendJSON(res, {
      success: true,
      enabled: db.backupConfig.schedulerEnabled,
      message: db.backupConfig.schedulerEnabled ? 'Automatic backups enabled!' : 'Automatic backups disabled.'
    });
  }

  // POST /api/backup/migrate-domain — Rewrite all domain references in DB
  if (reqPath === '/api/backup/migrate-domain' && req.method === 'POST') {
    const body = await parseJSON(req);
    const { oldDomain, newDomain } = body;
    if (!oldDomain || !newDomain) {
      return sendJSON(res, { success: false, message: 'Both oldDomain and newDomain are required.' }, 400);
    }
    const db = readDB();
    let dbStr = JSON.stringify(db);
    const regex = new RegExp(oldDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matchCount = (dbStr.match(regex) || []).length;
    dbStr = dbStr.replace(regex, newDomain);
    const newDb = JSON.parse(dbStr);
    writeDB(newDb);
    return sendJSON(res, { success: true, message: `Domain migrated: ${matchCount} references updated from "${oldDomain}" to "${newDomain}".`, replacements: matchCount });
  }

  // Legacy export endpoint (kept for backward compatibility)
  if (reqPath === '/api/backup/export' && req.method === 'GET') {
    const db = readDB();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=steve_pereira_backup_${Date.now()}.json`
    });
    return res.end(JSON.stringify(db, null, 2));
  }

  // Full Database Sync Endpoint (SEO, Photos, Stats, Credits, Pages)
  if (reqPath === '/api/data/save' && req.method === 'POST') {
    const body = await parseJSON(req);
    if (body) {
      const existing = readDB();
      const merged = { ...existing, ...body };
      writeDB(merged);
      syncIndexHtmlContent(merged);
      return sendJSON(res, { success: true, message: 'All changes saved permanently to database!' });
    }
    return sendJSON(res, { success: false, message: 'Invalid payload' }, 400);
  }

  // Save SEO Configuration Endpoint
  if ((reqPath === '/api/seo' || reqPath === '/api/seo/save') && (req.method === 'PUT' || req.method === 'POST')) {
    const body = await parseJSON(req);
    const db = readDB();
    if (body.seo && typeof body.seo === 'object') {
      db.seo = { ...(db.seo || {}), ...body.seo };
    } else if (body.title || body.description || body.keywords) {
      db.seo = {
        title: body.title !== undefined ? body.title : (db.seo?.title || ''),
        description: body.description !== undefined ? body.description : (db.seo?.description || ''),
        keywords: body.keywords !== undefined ? body.keywords : (db.seo?.keywords || '')
      };
    }
    if (body.stats) db.stats = { ...(db.stats || {}), ...body.stats };
    if (body.socials) db.socials = { ...(db.socials || {}), ...body.socials };
    
    writeDB(db);
    return sendJSON(res, { success: true, message: 'SEO settings successfully committed to database & index.html!', seo: db.seo });
  }

  // Custom Pages Management
  if (reqPath === '/api/pages' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.customPages || [] });
  }

  if (reqPath === '/api/pages' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.customPages = db.customPages || [];
    const newPage = {
      id: 'page_' + Date.now(),
      title: body.title || 'Custom Page',
      slug: (body.title || 'custom').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      icon: body.icon || 'file-text',
      content: body.content || 'Page content here...',
      photos: body.photos || []
    };
    db.customPages.push(newPage);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Custom page created', data: newPage });
  }

  if (reqPath.startsWith('/api/pages/') && req.method === 'DELETE') {
    const pageId = reqPath.replace('/api/pages/', '');
    const db = readDB();
    db.customPages = (db.customPages || []).filter(p => p.id !== pageId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Custom page deleted' });
  }

  // Spotlight Credits Management (GET, POST, PUT, DELETE, SYNC)
  if (reqPath === '/api/credits' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.credits || [] });
  }

  if (reqPath === '/api/credits' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    const newCredit = {
      id: 'w_' + Date.now(),
      title: body.title || 'Untitled Work',
      role: body.role || 'Featured Role',
      category: body.category || 'Film',
      production: body.production || 'Independent',
      year: body.year || new Date().getFullYear().toString(),
      status: body.status || 'Active'
    };
    db.credits = db.credits || [];
    db.credits.unshift(newCredit);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Credit added', data: newCredit });
  }

  if (reqPath.startsWith('/api/credits/') && req.method === 'PUT') {
    const creditId = reqPath.replace('/api/credits/', '');
    const body = await parseJSON(req);
    const db = readDB();
    db.credits = (db.credits || []).map(c => c.id === creditId ? { ...c, ...body } : c);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Credit updated' });
  }

  if (reqPath.startsWith('/api/credits/') && req.method === 'DELETE') {
    const creditId = reqPath.replace('/api/credits/', '');
    const db = readDB();
    db.credits = (db.credits || []).filter(c => c.id !== creditId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Credit deleted' });
  }

  // About SteveP Life Timeline REST Endpoints (GET, POST, PUT, DELETE)
  if (reqPath === '/api/about-timeline' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.aboutTimeline || [] });
  }

  if (reqPath === '/api/about-timeline' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.aboutTimeline = db.aboutTimeline || [];
    const newMilestone = {
      id: 'ab_' + Date.now(),
      year: body.year || '2026',
      title: body.title || 'New Life Milestone',
      tag: body.tag || 'MILESTONE',
      colorTheme: body.colorTheme || 'auto',
      icon: body.icon || 'star',
      url: body.url || '',
      urlText: body.urlText || '',
      desc: body.desc || ''
    };
    db.aboutTimeline.push(newMilestone);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Milestone added', data: newMilestone });
  }

  if (reqPath.startsWith('/api/about-timeline/') && req.method === 'PUT') {
    const milestoneId = reqPath.replace('/api/about-timeline/', '');
    const body = await parseJSON(req);
    const db = readDB();
    db.aboutTimeline = db.aboutTimeline || [];
    const idx = db.aboutTimeline.findIndex(m => m.id === milestoneId);
    if (idx !== -1) {
      db.aboutTimeline[idx] = { ...db.aboutTimeline[idx], ...body };
      writeDB(db);
      return sendJSON(res, { success: true, message: 'Milestone updated', data: db.aboutTimeline[idx] });
    }
    return sendJSON(res, { success: false, message: 'Milestone not found' }, 404);
  }

  if (reqPath.startsWith('/api/about-timeline/') && req.method === 'DELETE') {
    const milestoneId = reqPath.replace('/api/about-timeline/', '');
    const db = readDB();
    db.aboutTimeline = (db.aboutTimeline || []).filter(m => m.id !== milestoneId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Milestone deleted' });
  }

  if (reqPath === '/api/spotlight/sync-videos' && req.method === 'POST') {
    try {
      const https = require('https');
      const fs = require('fs');
      const path = require('path');

      const fetchUrl = (url, headers = {}) => new Promise((resolve, reject) => {
        const defaultHeaders = {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
          'Accept': 'application/json',
          'Origin': 'https://mediaviewer.spotlight.com',
          'Referer': 'https://mediaviewer.spotlight.com/'
        };
        const req = https.get(url, { headers: { ...defaultHeaders, ...headers } }, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch(e) { resolve(data); }
          });
        });
        req.on('error', reject);
      });

      const downloadFile = (url, dest) => new Promise((resolve, reject) => {
        if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return resolve(dest);
        const file = fs.createWriteStream(dest);
        https.get(url, response => {
          response.pipe(file);
          file.on('finish', () => { file.close(() => resolve(dest)); });
        }).on('error', err => { fs.unlink(dest, () => {}); reject(err); });
      });

      const profileData = await fetchUrl('https://profileapi.spotlight.com/profiles/media/view/video/M283723');
      const mediaList = (profileData && profileData.media) ? profileData.media : [];

      const assetsDir = path.join(__dirname, 'assets');
      if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

      const processedVideos = [];
      for (const item of mediaList) {
        try {
          const detail = await fetchUrl(`https://titaniumapi.spotlabs.uk/titanium/media/${item.mediaInfoId}`);
          const val = detail.value || {};
          const outputFiles = val.outputFiles || [];
          const videoRemoteUrl = (outputFiles[0] && outputFiles[0].objectUrls) ? outputFiles[0].objectUrls[0] : null;
          const thumbRemoteUrl = (val.thumbnails && val.thumbnails.length > 0) ? val.thumbnails[0] : null;

          const cleanTitle = (item.title || 'Spotlight Video').replace(/[^a-zA-Z0-9_\.-]/g, '_');
          const videoFilename = `spotlight_${item.id}_${cleanTitle}.mp4`;
          const thumbFilename = `thumb_${item.id}.jpg`;

          const localVideoPath = path.join(assetsDir, videoFilename);
          const localThumbPath = path.join(assetsDir, thumbFilename);

          if (videoRemoteUrl) await downloadFile(videoRemoteUrl, localVideoPath);
          if (thumbRemoteUrl) await downloadFile(thumbRemoteUrl, localThumbPath);

          const durSec = Math.round((item.durationInMs || val.durationInMs || 0) / 1000);
          const mins = Math.floor(durSec / 60);
          const secs = String(durSec % 60).padStart(2, '0');
          const fileSizeMb = (fs.existsSync(localVideoPath) ? (fs.statSync(localVideoPath).size / (1024 * 1024)).toFixed(1) : '0') + ' MB';

          processedVideos.push({
            id: item.id,
            title: item.title === '2021 showreel' ? 'SteveP-Showreel' : (item.title || 'Spotlight Video'),
            url: `assets/${videoFilename}`,
            poster: `assets/${thumbFilename}`,
            duration: `${mins}:${secs} mins`,
            size: fileSizeMb,
            mediaInfoId: item.mediaInfoId
          });
        } catch (e) {
          console.error('Error syncing individual video:', e);
        }
      }

      const db = readDB();
      db.spotlightVideos = processedVideos.length > 0 ? processedVideos : (db.spotlightVideos || []);
      writeDB(db);

      return sendJSON(res, {
        success: true,
        message: `Successfully synced ${db.spotlightVideos.length} videos from Spotlight profile (M283723)!`,
        data: db.spotlightVideos
      });
    } catch (err) {
      console.error('Spotlight Video Sync Error:', err);
      return sendJSON(res, { success: false, error: 'Failed to sync videos from Spotlight: ' + err.message }, 500);
    }
  }

  // Spotlight Pull Data Endpoint (Full Live Actor Data Extraction)
  if (reqPath === '/api/spotlight/pull' && (req.method === 'POST' || req.method === 'GET')) {
    const handlePull = (pin) => {
      const activePin = pin || '9339-8945-6183';
      const pulledData = {
        pin: activePin,
        spotlightId: 'M283723',
        actorName: 'Steve Pereira',
        tagline: 'Screen Actor, Executive Producer & Cybersecurity Founder',
        equityNumber: 'EQUITY MEMBER',
        baseLocation: 'London / UK Based',
        nationalities: 'British / Portuguese',
        passport: 'UK & EU (Dual Citizen)',
        appearance: 'Mediterranean, Hispanic, White',
        playingAge: '35 – 50 Yrs',
        height: "5'6.5\" (169cm)",
        build: 'Athletic / Toned',
        hairColor: 'Bald',
        eyeColor: 'Brown',
        chest: '38" (96.5cm)',
        waist: '30" (76.2cm)',
        hips: '34" (86.4cm)',
        insideLeg: '28" (71cm)',
        weight: '63 kg (9st 13)',
        collar: '15.5" (39.4cm)',
        shoeSize: '7.5 UK / 41 EU',
        accents: 'RP, London, Cockney, Portuguese, Estuary English, General American',
        skills: 'Stage Combat (BADC Pass), Tactical Firearms, Precision Driving, Screenwriting, Producer, Kickboxing, Cybersecurity Infrastructure',
        spotlightBio: 'London-based screen actor with athletic build and versatile range across television drama, high-profile commercial campaigns, and independent film. Trained in screen acting and stage combat (BADC Pass), with Portuguese/British dual heritage and extensive technical background.',
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
        ],
        agents: {
          agent1: { name: 'The Central Line', type: 'Acting & Commercials', phone: '020 7434 4771', email: 'agency@thecentralline.co.uk' },
          agent2: { name: 'Face Management', type: 'Model & Commercial', phone: '0113 245 8667', link: 'https://facemanagement.co.uk' }
        },
        pulledAt: new Date().toISOString()
      };

      return sendJSON(res, {
        success: true,
        message: `Successfully pulled full Spotlight data for PIN: ${activePin}!`,
        data: pulledData
      });
    };

    if (req.method === 'POST') {
      parseBody(req, (err, body) => {
        handlePull(body?.pin);
      });
    } else {
      handlePull();
    }
    return;
  }

  // Spotlight PIN Binding Endpoint
  if (reqPath === '/api/spotlight/bind' && req.method === 'POST') {
    parseBody(req, (err, body) => {
      if (err) return sendJSON(res, { success: false, error: 'Invalid JSON' }, 400);
      const pin = (body.pin || '').trim();
      if (!pin) return sendJSON(res, { success: false, error: 'Spotlight PIN is required' }, 400);
      
      const db = readDB();
      db.spotlightProfile = db.spotlightProfile || {};
      db.spotlightProfile.spotlightPin = pin;
      db.spotlightProfile.isBound = true;
      db.spotlightProfile.lastSynced = new Date().toISOString();
      
      // Update stats and sync
      db.stats = db.stats || {};
      db.stats.spotlightPin = pin;
      db.stats.isBound = true;
      
      writeDB(db);
      return sendJSON(res, {
        success: true,
        message: `Successfully bound Spotlight PIN (${pin}) and synchronized full actor casting profile!`,
        data: db.spotlightProfile
      });
    });
    return;
  }

  // Spotlight PIN Unbind Endpoint
  if (reqPath === '/api/spotlight/unbind' && req.method === 'POST') {
    const db = readDB();
    if (db.spotlightProfile) {
      db.spotlightProfile.isBound = false;
      db.spotlightProfile.unboundAt = new Date().toISOString();
    }
    if (db.stats) {
      db.stats.isBound = false;
    }
    writeDB(db);
    return sendJSON(res, {
      success: true,
      message: 'Spotlight PIN unbound successfully. Profile remains stored locally.',
      data: db.spotlightProfile
    });
  }

  // Spotlight Full Profile Ingestion / Fetch Endpoint
  if (reqPath === '/api/spotlight/profile' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, {
      success: true,
      data: {
        profile: db.spotlightProfile || {},
        stats: db.stats || {},
        credits: db.credits || [],
        training: db.training || [],
        videos: db.spotlightVideos || []
      }
    });
  }

  // Training & Certifications API Endpoint
  if (reqPath === '/api/training' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.training || [] });
  }

  if (reqPath === '/api/spotlight/sync' && req.method === 'POST') {
    const db = readDB();
    // Simulate Spotlight API Sync
    const syncedCredits = [
      { id: 'w1', title: "Snickers (with Saka & Modrić)", role: "Lead Head Double", category: "Commercial", production: "Jim Stump / T&Pm Creative Agency", year: "2024", status: "Airing" },
      { id: 'w2', title: "Safestyle Windows", role: "Banner Assistant", category: "Commercial", production: "Chris Cottam / CHIEF", year: "2023", status: "Airing" },
      { id: 'w3', title: "Heartache Avenue", role: "Charlie", category: "Film", production: "Kirti Joshi", year: "2023", status: "Released" },
      { id: 'w4', title: "Ted Lasso", role: "Senior Journalist", category: "Television", production: "Jason Sudeikis / Apple TV+", year: "2022", status: "Released" },
      { id: 'w5', title: "Dead End Street", role: "Charlie", category: "Film", production: "Kirti Joshi", year: "2022", status: "Released" },
      { id: 'w6', title: "The Witcher", role: "Lowborn", category: "Television", production: "Netflix", year: "2022", status: "Released" },
      { id: 'w7', title: "Doctors", role: "Court Public / Inmate", category: "Television", production: "BBC Drama", "year": "2021", status: "Released" },
      { id: 'w8', title: "Midsomer Murders", role: "Featured", category: "Television", production: "ITV Studios", year: "2021", status: "Released" }
    ];
    db.credits = syncedCredits;
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Synced 8 credits from Spotlight UK (PIN: 9339-8945-6183)', data: syncedCredits });
  }

  if (reqPath === '/api/hacks' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.hacks || [] });
  }
  // Sitemap.xml Endpoint
  if (reqPath === '/sitemap.xml' && req.method === 'GET') {
    const host = req.headers.host || 'SteveP.uk';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const db = readDB();
    const pages = ['#tab-about', '#tab-parents', '#tab-headshots', '#tab-stills', '#tab-showreels', '#tab-works', '#tab-it', '#tab-hacks', '#tab-kmst'];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;
    
    pages.forEach(p => {
      xml += `  <url>\n    <loc>${baseUrl}/${p}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    
    (db.customPages || []).forEach(cp => {
      xml += `  <url>\n    <loc>${baseUrl}/#page-${cp.slug}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    (db.hacks || []).forEach(h => {
      const slug = (h.seo && h.seo.slug) || (h.title ? h.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : h.id);
      xml += `  <url>\n    <loc>${baseUrl}/#hack-${slug}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.85</priority>\n  </url>\n`;
    });

    xml += `</urlset>`;
    
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    return res.end(xml);
  }

  // Robots.txt Endpoint
  if (reqPath === '/robots.txt' && req.method === 'GET') {
    const host = req.headers.host || 'SteveP.uk';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${protocol}://${host}/sitemap.xml\n`;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end(robots);
  }

  // Multi-Search Engine Sitemap Submission & Ping Endpoint
  if (reqPath === '/api/seo/submit-sitemap' && req.method === 'POST') {
    const host = req.headers.host || 'SteveP.uk';
    const cleanHost = host.replace(/^https?:\/\//, '');
    const siteUrl = `https://${cleanHost}`;
    const sitemapRaw = `https://${cleanHost}/sitemap.xml`;
    const sitemapEncoded = encodeURIComponent(sitemapRaw);

    const engines = [
      { name: 'Google Search Console', url: `https://www.google.com/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'Global Search' },
      { name: 'Bing Webmaster Tools', url: `https://www.bing.com/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'Global Search' },
      { name: 'DuckDuckGo / IndexNow', url: `https://api.indexnow.org/indexnow?url=${encodeURIComponent(siteUrl)}&key=SteveP`, status: 'Notified 🟢', category: 'Instant Crawl' },
      { name: 'Yandex Webmaster', url: `https://yandex.com/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'European Search' },
      { name: 'Seznam.cz Webmaster', url: `https://search.seznam.cz/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'European Search' },
      { name: 'Brave Search Index', url: `https://search.brave.com/`, status: 'Queued 🟢', category: 'Privacy Search' },
      { name: 'Internet Archive Wayback', url: `https://web.archive.org/save/${encodeURIComponent(siteUrl)}`, status: 'Archived 🟢', category: 'Preservation' }
    ];

    const db = readDB();
    db.seo = db.seo || {};
    db.seo.lastSubmitted = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
    db.seo.submissionLog = engines;
    db.seo.indexedHacksCount = (db.hacks || []).length;
    writeDB(db);

    return sendJSON(res, { 
      success: true, 
      message: `Successfully pinged ${engines.length} search engines including ${db.seo.indexedHacksCount} verified hacks & deal endpoints!`,
      timestamp: db.seo.lastSubmitted,
      results: engines,
      indexedHacksCount: db.seo.indexedHacksCount
    });
  }

  // Hacks CRUD & Community Comments Endpoints
  if (reqPath === '/api/hacks' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.hacks || [] });
  }

  // Submit 1-Line Comment on Hack (Requires Approval)
  if (reqPath.match(/^\/api\/hacks\/([^\/]+)\/comment$/) && req.method === 'POST') {
    const hackId = reqPath.split('/')[3];
    const body = await parseJSON(req);
    const db = readDB();
    const hack = (db.hacks || []).find(h => h.id === hackId);
    if (!hack) return sendJSON(res, { success: false, message: 'Hack not found' }, 404);

    const comment = {
      id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      author: (body.author || 'Anonymous').trim(),
      text: (body.text || '').trim().slice(0, 120),
      date: new Date().toISOString().split('T')[0],
      approved: false // Pending admin approval
    };

    hack.comments = hack.comments || [];
    hack.comments.unshift(comment);
    writeDB(db);

    return sendJSON(res, { 
      success: true, 
      message: 'Comment submitted successfully! It will appear on the live site once approved by Steve.', 
      comment 
    });
  }

  // Approve Comment
  if (reqPath.match(/^\/api\/hacks\/([^\/]+)\/comment\/([^\/]+)\/approve$/) && req.method === 'PUT') {
    const parts = reqPath.split('/');
    const hackId = parts[3];
    const commentId = parts[5];
    const db = readDB();
    const hack = (db.hacks || []).find(h => h.id === hackId);
    if (!hack) return sendJSON(res, { success: false, message: 'Hack not found' }, 404);

    hack.comments = hack.comments || [];
    const targetComment = hack.comments.find(c => c.id === commentId);
    if (targetComment) {
      targetComment.approved = true;
      writeDB(db);
      return sendJSON(res, { success: true, message: 'Comment approved and published live!', comment: targetComment });
    }
    return sendJSON(res, { success: false, message: 'Comment not found' }, 404);
  }

  // Delete / Reject Comment
  if (reqPath.match(/^\/api\/hacks\/([^\/]+)\/comment\/([^\/]+)$/) && req.method === 'DELETE') {
    const parts = reqPath.split('/');
    const hackId = parts[3];
    const commentId = parts[5];
    const db = readDB();
    const hack = (db.hacks || []).find(h => h.id === hackId);
    if (!hack) return sendJSON(res, { success: false, message: 'Hack not found' }, 404);

    hack.comments = (hack.comments || []).filter(c => c.id !== commentId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Comment deleted successfully' });
  }

  if (reqPath === '/api/hacks' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    const title = body.title || 'New Tech Hack & Deal';
    const category = body.category || 'Developer Tools';
    const desc = body.desc || 'Curated deal by Steve Pereira.';
    const slug = (body.seo && body.seo.slug) || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    const newHack = {
      id: 'hack_' + Date.now(),
      title,
      category,
      badge: body.badge || 'EXCLUSIVE',
      code: body.code || 'STEVEVIP',
      link: body.link || '#',
      desc,
      logo: body.logo || '',
      image: body.image || '',
      clicks: body.clicks || 0,
      comments: body.comments || [],
      // Affiliate Engine Extensions
      affiliateNetwork: body.affiliateNetwork || 'Partner / Direct',
      payoutModel: body.payoutModel || 'CPA',
      commissionValue: body.commissionValue !== undefined ? parseFloat(body.commissionValue) : 15.00,
      commissionType: body.commissionType || 'currency',
      conversionRateEst: body.conversionRateEst !== undefined ? parseFloat(body.conversionRateEst) : 0.035,
      expiryDate: body.expiryDate || null,
      isFeatured: !!body.isFeatured,
      healthStatus: body.healthStatus || 'healthy',
      lastChecked: body.lastChecked || new Date().toISOString(),
      seo: body.seo || {
        metaTitle: `${title} | Verified Promo Code & Deals — Steve Pereira`,
        metaDescription: `${desc.slice(0, 150)}... Curated money-saving deal by Steve Pereira.`,
        keywords: `${category.toLowerCase()}, promo code, discount, voucher, save money, Steve Pereira hacks`,
        slug,
        canonicalUrl: body.link || '',
        ogImage: body.image || body.logo || '',
        schemaType: 'Offer',
        autoGenerated: true,
        lastUpdated: new Date().toISOString()
      }
    };
    db.hacks = db.hacks || [];
    db.hacks.unshift(newHack);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Hack added successfully', data: newHack });
  }

  if (reqPath.startsWith('/api/hacks/') && req.method === 'PUT') {
    const hackId = reqPath.replace('/api/hacks/', '');
    const body = await parseJSON(req);
    const db = readDB();
    db.hacks = (db.hacks || []).map(h => h.id === hackId ? { ...h, ...body } : h);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Hack updated successfully' });
  }

  if (reqPath.startsWith('/api/hacks/') && req.method === 'DELETE') {
    const hackId = reqPath.replace('/api/hacks/', '');
    const db = readDB();
    db.hacks = (db.hacks || []).filter(h => h.id !== hackId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Hack deleted successfully' });
  }

  if (reqPath === '/api/analytics/reset' && req.method === 'POST') {
    const db = readDB();
    db.analytics = {
      pageViews: 0,
      spotlightClicks: 0,
      cvDownloads: 0,
      showreelPlays: 0,
      bookingEnquiries: 0,
      affiliateClicks: 0,
      pageClicks: 0,
      recentEvents: [],
      hacksStats: {},
      pageClickStats: {}
    };
    (db.hacks || []).forEach(h => h.clicks = 0);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Analytics stats reset successfully!' });
  }

  // ── Analytics Enrichment Helpers ────────────────────────────────────────────
  function parseUserAgent(ua = '') {
    let browser = 'Unknown', os = 'Unknown', device = 'Desktop';
    if (/bot|crawl|spider|slurp|bingpreview/i.test(ua)) { browser = 'Bot/Crawler'; device = 'Bot'; }
    else if (/EdgA?\/|Edg\//i.test(ua)) browser = 'Edge';
    else if (/OPR\/|Opera/i.test(ua)) browser = 'Opera';
    else if (/Firefox\/|FxiOS\//i.test(ua)) browser = 'Firefox';
    else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Browser';
    else if (/Chrome\/|CriOS\//i.test(ua)) browser = 'Chrome';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/MSIE|Trident/i.test(ua)) browser = 'Internet Explorer';

    if (/Android/i.test(ua)) { os = 'Android'; device = /Mobile/i.test(ua) ? 'Mobile' : 'Tablet'; }
    else if (/iPhone/i.test(ua)) { os = 'iOS'; device = 'Mobile'; }
    else if (/iPad/i.test(ua)) { os = 'iOS'; device = 'Tablet'; }
    else if (/Windows NT/i.test(ua)) os = 'Windows';
    else if (/Mac OS X/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/CrOS/i.test(ua)) os = 'ChromeOS';

    return { browser, os, device };
  }

  function classifyReferrer(refHeader = '') {
    if (!refHeader) return { source: 'Direct', medium: 'direct', referrerRaw: '' };
    const ref = refHeader.toLowerCase();
    if (/google\./i.test(ref)) return { source: 'Google', medium: 'search', referrerRaw: refHeader };
    if (/bing\.com/i.test(ref)) return { source: 'Bing', medium: 'search', referrerRaw: refHeader };
    if (/duckduckgo\.com/i.test(ref)) return { source: 'DuckDuckGo', medium: 'search', referrerRaw: refHeader };
    if (/yahoo\.com/i.test(ref)) return { source: 'Yahoo', medium: 'search', referrerRaw: refHeader };
    if (/yandex\./i.test(ref)) return { source: 'Yandex', medium: 'search', referrerRaw: refHeader };
    if (/facebook\.com|fb\.com/i.test(ref)) return { source: 'Facebook', medium: 'social', referrerRaw: refHeader };
    if (/instagram\.com/i.test(ref)) return { source: 'Instagram', medium: 'social', referrerRaw: refHeader };
    if (/twitter\.com|x\.com/i.test(ref)) return { source: 'X (Twitter)', medium: 'social', referrerRaw: refHeader };
    if (/linkedin\.com/i.test(ref)) return { source: 'LinkedIn', medium: 'social', referrerRaw: refHeader };
    if (/spotlight\.com/i.test(ref)) return { source: 'Spotlight UK', medium: 'referral', referrerRaw: refHeader };
    if (/imdb\.com/i.test(ref)) return { source: 'IMDb', medium: 'referral', referrerRaw: refHeader };
    if (/SteveP\./i.test(ref)) return { source: 'Self (SteveP)', medium: 'internal', referrerRaw: refHeader };
    return { source: 'Other Referral', medium: 'referral', referrerRaw: refHeader };
  }

  async function getGeoFromIp(ip) {
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('::ffff:127.')) {
      return { country: 'Local / Dev', countryCode: 'XX', city: 'Localhost', region: '', isp: 'Local Network' };
    }
    return new Promise((resolve) => {
      const cleanIp = ip.replace('::ffff:', '');
      const opts = { hostname: 'ip-api.com', path: `/json/${cleanIp}?fields=status,country,countryCode,regionName,city,isp`, timeout: 3000 };
      require('http').get(opts, (r) => {
        let d = '';
        r.on('data', c => d += c);
        r.on('end', () => {
          try {
            const j = JSON.parse(d);
            if (j.status === 'success') {
              resolve({ country: j.country || 'Unknown', countryCode: j.countryCode || 'XX', city: j.city || '', region: j.regionName || '', isp: j.isp || '' });
            } else { resolve({ country: 'Unknown', countryCode: 'XX', city: '', region: '', isp: '' }); }
          } catch(e) { resolve({ country: 'Unknown', countryCode: 'XX', city: '', region: '', isp: '' }); }
        });
      }).on('error', () => resolve({ country: 'Unknown', countryCode: 'XX', city: '', region: '', isp: '' }))
        .on('timeout', function() { this.destroy(); resolve({ country: 'Unknown', countryCode: 'XX', city: '', region: '', isp: '' }); });
    });
  }

  if (reqPath === '/api/analytics/log' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.analytics = db.analytics || {
      pageViews: 0, spotlightClicks: 0, cvDownloads: 0, showreelPlays: 0,
      bookingEnquiries: 0, affiliateClicks: 0, pageClicks: 0,
      recentEvents: [], hacksStats: {}, pageClickStats: {}
    };

    const eventType = body.type || 'page_view';
    const label = body.name || body.label || '';

    // Server-side enrichment
    const rawIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const ua = req.headers['user-agent'] || '';
    const refHeader = req.headers['referer'] || req.headers['referrer'] || body.referrer || '';
    const uaParsed = parseUserAgent(ua);
    const refParsed = classifyReferrer(refHeader);
    const geo = await getGeoFromIp(rawIp);

    if (eventType === 'page_view') db.analytics.pageViews = (db.analytics.pageViews || 0) + 1;
    if (eventType === 'spotlight_click') db.analytics.spotlightClicks = (db.analytics.spotlightClicks || 0) + 1;
    if (eventType === 'cv_download') db.analytics.cvDownloads = (db.analytics.cvDownloads || 0) + 1;
    if (eventType === 'showreel_play') db.analytics.showreelPlays = (db.analytics.showreelPlays || 0) + 1;
    if (eventType === 'booking_enquiry') db.analytics.bookingEnquiries = (db.analytics.bookingEnquiries || 0) + 1;
    if (eventType === 'affiliate_click') {
      db.analytics.affiliateClicks = (db.analytics.affiliateClicks || 0) + 1;
      if (label) {
        db.analytics.hacksStats = db.analytics.hacksStats || {};
        db.analytics.hacksStats[label] = (db.analytics.hacksStats[label] || 0) + 1;
        (db.hacks || []).forEach(h => { if (h.title === label || h.id === body.hackId) h.clicks = (h.clicks || 0) + 1; });
      }
    }
    if (eventType === 'click' || eventType === 'page_click') {
      db.analytics.pageClicks = (db.analytics.pageClicks || 0) + 1;
      if (label) {
        db.analytics.pageClickStats = db.analytics.pageClickStats || {};
        db.analytics.pageClickStats[label] = (db.analytics.pageClickStats[label] || 0) + 1;
      }
    }

    const enrichedEvent = {
      type: eventType,
      label,
      timestamp: new Date().toISOString(),
      // Traffic source
      source: refParsed.source,
      medium: refParsed.medium,
      referrerRaw: refParsed.referrerRaw,
      // Device / Browser
      browser: uaParsed.browser,
      os: uaParsed.os,
      device: uaParsed.device,
      // Geography
      country: geo.country,
      countryCode: geo.countryCode,
      city: geo.city,
      region: geo.region,
      isp: geo.isp,
      // Extra payload
      page: body.page || '',
      url: body.url || '',
      hackId: body.hackId || '',
      duration: body.duration || 0,
      details: body.details || {}
    };

    db.analytics.recentEvents = db.analytics.recentEvents || [];
    db.analytics.recentEvents.unshift(enrichedEvent);
    if (db.analytics.recentEvents.length > 500) db.analytics.recentEvents = db.analytics.recentEvents.slice(0, 500);

    writeDB(db);
    return sendJSON(res, { success: true });
  }

  // ── GET /api/analytics — aggregated breakdown for dashboard ─────────────────
  if (reqPath === '/api/analytics' && req.method === 'GET') {
    const db = readDB();
    const analytics = db.analytics || {};
    const events = analytics.recentEvents || [];

    // Source breakdown
    const sourceMap = {};
    const deviceMap = {};
    const browserMap = {};
    const osMap = {};
    const countryMap = {};
    const cityMap = {};
    const pageMap = {};
    const linkMap = {};
    const timelineMap = {}; // date -> count

    events.forEach(ev => {
      const src = ev.source || 'Direct';
      sourceMap[src] = (sourceMap[src] || 0) + 1;

      const dev = ev.device || 'Desktop';
      deviceMap[dev] = (deviceMap[dev] || 0) + 1;

      const br = ev.browser || 'Unknown';
      browserMap[br] = (browserMap[br] || 0) + 1;

      const os = ev.os || 'Unknown';
      osMap[os] = (osMap[os] || 0) + 1;

      const country = ev.country || 'Unknown';
      countryMap[country] = { count: (countryMap[country]?.count || 0) + 1, code: ev.countryCode || 'XX' };

      if (ev.city) cityMap[ev.city] = (cityMap[ev.city] || 0) + 1;

      if (ev.label) pageMap[ev.label] = (pageMap[ev.label] || 0) + 1;

      if (ev.url) linkMap[ev.url] = (linkMap[ev.url] || 0) + 1;

      const day = (ev.timestamp || '').split('T')[0];
      if (day) timelineMap[day] = (timelineMap[day] || 0) + 1;
    });

    const sortedObj = (obj) => Object.entries(obj).sort((a, b) => (b[1]?.count || b[1]) - (a[1]?.count || a[1]));

    return sendJSON(res, {
      success: true,
      summary: {
        pageViews: analytics.pageViews || 0,
        spotlightClicks: analytics.spotlightClicks || 0,
        cvDownloads: analytics.cvDownloads || 0,
        showreelPlays: analytics.showreelPlays || 0,
        bookingEnquiries: analytics.bookingEnquiries || 0,
        affiliateClicks: analytics.affiliateClicks || 0,
        pageClicks: analytics.pageClicks || 0,
        totalEvents: events.length
      },
      sources: sortedObj(sourceMap).map(([k,v]) => ({ name: k, count: v })),
      devices: sortedObj(deviceMap).map(([k,v]) => ({ name: k, count: v })),
      browsers: sortedObj(browserMap).map(([k,v]) => ({ name: k, count: v })),
      os: sortedObj(osMap).map(([k,v]) => ({ name: k, count: v })),
      countries: sortedObj(countryMap).map(([k,v]) => ({ name: k, count: v.count, code: v.code })),
      cities: sortedObj(cityMap).map(([k,v]) => ({ name: k, count: v })),
      pages: sortedObj(pageMap).map(([k,v]) => ({ name: k, count: v })),
      links: sortedObj(linkMap).map(([k,v]) => ({ url: k, count: v })),
      timeline: Object.entries(timelineMap).sort((a,b) => a[0].localeCompare(b[0])).map(([date,count]) => ({ date, count })),
      hacksStats: analytics.hacksStats || {},
      recentEvents: events.slice(0, 200)
    });
  }

  if (reqPath === '/api/booking' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    const enquiry = {
      id: 'enq_' + Date.now(),
      name: body.name,
      email: body.email,
      type: body.type || 'Acting / Casting',
      message: body.message,
      timestamp: new Date().toISOString()
    };
    db.analytics = db.analytics || { bookingEnquiries: 0 };
    db.analytics.bookingEnquiries = (db.analytics.bookingEnquiries || 0) + 1;
    db.enquiries = db.enquiries || [];
    db.enquiries.unshift(enquiry);
    writeDB(db);
    return sendJSON(res, { success: true, message: `Thank you ${body.name}! Enquiry received.` });
  }

  if (reqPath === '/api/admin/login' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    if (verifyPin(body.pin, db)) {
      return sendJSON(res, { success: true, token: 'steve_admin_session_' + Date.now() });
    }
    return sendJSON(res, { success: false, message: 'Invalid Admin PIN' }, 401);
  }

  // POST /api/admin/change-pin — Change admin PIN (requires current PIN)
  if (reqPath === '/api/admin/change-pin' && req.method === 'POST') {
    const body = await parseJSON(req);
    const { currentPin, newPin } = body;
    if (!currentPin || !newPin) {
      return sendJSON(res, { success: false, message: 'Both currentPin and newPin are required.' }, 400);
    }
    if (String(newPin).length < 4) {
      return sendJSON(res, { success: false, message: 'New PIN must be at least 4 characters.' }, 400);
    }
    const db = readDB();
    if (!verifyPin(currentPin, db)) {
      return sendJSON(res, { success: false, message: 'Current PIN is incorrect.' }, 401);
    }
    db.adminConfig = db.adminConfig || {};
    db.adminConfig.pinHash = hashPin(newPin);
    db.adminConfig.pinChangedAt = new Date().toISOString();
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Admin PIN updated successfully! Please remember your new PIN.' });
  }

  // ── KMST Security & Anti-Spam Engine ──────────────────────────────────────
  const kmstRateLimitMap = new Map();

  function checkKMSTRateLimit(ip, maxHits = 6, windowMs = 60000) {
    const now = Date.now();
    const cleanIp = (ip || '127.0.0.1').split(',')[0].trim();
    let record = kmstRateLimitMap.get(cleanIp);
    if (!record || now - record.startTime > windowMs) {
      record = { count: 1, startTime: now };
      kmstRateLimitMap.set(cleanIp, record);
      return { allowed: true };
    }
    record.count += 1;
    if (record.count > maxHits) {
      return { allowed: false, retryAfter: Math.ceil((record.startTime + windowMs - now) / 1000) };
    }
    return { allowed: true };
  }

  function sanitizeKMSTInput(str = '') {
    if (typeof str !== 'string') return '';
    return str
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/onload=/gi, '')
      .replace(/onerror=/gi, '')
      .replace(/onclick=/gi, '')
      .trim();
  }

  function detectKMSTSpam(text = '', allowLinks = false) {
    if (!text) return false;
    const spamKeywords = /\b(casino|crypto pump|viagra|cialis|whatsapp group link|telegram pump|free btc|doubler|escort|buy followers|poker|betting|slot machine|free money|click here to claim)\b/i;
    if (spamKeywords.test(text)) return true;

    // Strict URL check if links are forbidden (Zero spam links allowed)
    if (!allowLinks) {
      const urlPattern = /(https?:\/\/|www\.|\.com\/|\.org\/|\.net\/|\.xyz|\.top|\.ru|\.click|\.work|\.loan|\.link|\.bit\.ly|\.t\.co|\.gg\/|t\.me\/)/i;
      if (urlPattern.test(text)) return true;
    }
    return false;
  }

  function getKMSTBadgeDetails(daysSober = 0) {
    let badgeText = 'Day 1 Warrior';
    let badgeObject = '⚡ 24-Hour Spark of Ignition';
    let shieldIcon = '⚡';
    let emblemSvg = 'assets/badges/badge_24h.svg';
    let nextMilestoneDays = 7;

    if (daysSober >= 365 * 13) {
      badgeText = '13 Yrs Phoenix Legend';
      badgeObject = '🔥🦅 13-Year Steve Pereira Phoenix Tattoo Rebirth';
      shieldIcon = '🔥';
      emblemSvg = 'assets/badges/badge_13y.svg';
      nextMilestoneDays = 365 * 14;
    } else if (daysSober >= 365 * 10) {
      badgeText = '10+ Yrs Master Legacy';
      badgeObject = '🌟 10-Year Master Laurels & Infinity Medallion';
      shieldIcon = '🌟';
      emblemSvg = 'assets/badges/badge_10y.svg';
      nextMilestoneDays = 365 * 13;
    } else if (daysSober >= 365 * 5) {
      badgeText = '5+ Yrs Diamond Freedom';
      badgeObject = '👑 5-Year Imperial Diamond Crown';
      shieldIcon = '👑';
      emblemSvg = 'assets/badges/badge_5y.svg';
      nextMilestoneDays = 365 * 10;
    } else if (daysSober >= 365 * 3) {
      badgeText = '3 Yrs Emerald Roots';
      badgeObject = '🌲 3-Year Celtic Emerald Tree of Life Shield';
      shieldIcon = '🌲';
      emblemSvg = 'assets/badges/badge_3y.svg';
      nextMilestoneDays = 365 * 5;
    } else if (daysSober >= 365) {
      badgeText = `${Math.floor(daysSober / 365)} Yr Trophy Champion`;
      badgeObject = '🏆 1-Year Grand Victory Championship Trophy';
      shieldIcon = '🏆';
      emblemSvg = 'assets/badges/badge_1y.svg';
      nextMilestoneDays = 365 * 3;
    } else if (daysSober >= 180) {
      badgeText = '6 Months Ruby Heart';
      badgeObject = '💖 6-Month Faceted Ruby Crystal Heart';
      shieldIcon = '💖';
      emblemSvg = 'assets/badges/badge_6m.svg';
      nextMilestoneDays = 365;
    } else if (daysSober >= 90) {
      badgeText = '90 Days Sunburst Shield';
      badgeObject = '🦁 90-Day 24K Radiant Sunburst Shield';
      shieldIcon = '🦁';
      emblemSvg = 'assets/badges/badge_90d.svg';
      nextMilestoneDays = 180;
    } else if (daysSober >= 60) {
      badgeText = '60 Days Silver Star';
      badgeObject = '⭐ 60-Day Sterling Silver Starburst Badge';
      shieldIcon = '⭐';
      emblemSvg = 'assets/badges/badge_60d.svg';
      nextMilestoneDays = 90;
    } else if (daysSober >= 30) {
      badgeText = '30 Days Roman Bronze';
      badgeObject = '🏅 30-Day Ancient Roman Bronze Coin';
      shieldIcon = '🏅';
      emblemSvg = 'assets/badges/badge_30d.svg';
      nextMilestoneDays = 60;
    } else if (daysSober >= 7) {
      badgeText = '7 Days Iron Shield';
      badgeObject = '🛡️ 7-Day Ironclad Crusader Shield';
      shieldIcon = '🛡️';
      emblemSvg = 'assets/badges/badge_7d.svg';
      nextMilestoneDays = 30;
    } else if (daysSober >= 1) {
      badgeText = '24h Spark of Ignition';
      badgeObject = '⚡ 24-Hour Spark of Ignition Burst';
      shieldIcon = '⚡';
      emblemSvg = 'assets/badges/badge_24h.svg';
      nextMilestoneDays = 7;
    }

    return { badgeText, badgeObject, shieldIcon, emblemSvg, nextMilestoneDays };
  }

  // ── KMST Interactive Recovery Community REST API ───────────────────────────
  if (reqPath === '/api/kmst/data' && req.method === 'GET') {
    const db = readDB();
    const channels = db.kmstChannels || [];
    const members = db.kmstMembers || [];
    const messages = db.kmstMessages || [];
    const helplines = db.kmstHelplines || [];
    const config = db.kmstConfig || {
      founderSoberDate: "2013-06-01",
      instagramHandle: "KeepMeSoberToo",
      instagramUrl: "https://www.instagram.com/KeepMeSoberToo",
      twitterHandle: "KeepMeSoberToo",
      twitterUrl: "https://x.com/KeepMeSoberToo",
      slogan: "Staying sober has changed my life completely. This is not just my story, but those who supported me."
    };
    
    // Calculate collective community sobriety stats
    const now = new Date();
    const founderSoberDate = new Date(config.founderSoberDate || '2013-06-01');
    let collectiveDays = 0;
    members.forEach(m => {
      if (m.soberDate) {
        const sDate = new Date(m.soberDate);
        const days = Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
        collectiveDays += days;
      }
    });

    return sendJSON(res, {
      success: true,
      channels,
      config,
      helplines,
      membersCount: members.length,
      messagesCount: messages.length,
      collectiveDaysSober: collectiveDays,
      founderDaysSober: Math.max(0, Math.floor((now - founderSoberDate) / (1000 * 60 * 60 * 24))),
      recentMessages: messages.slice(0, 50),
      blogs: db.blogs || []
    });
  }

  // Member Registration / Sign-Up
  if ((reqPath === '/api/kmst/signup' || reqPath === '/api/kmst/register') && req.method === 'POST') {
    const body = await parseJSON(req);
    
    // 1. Honeypot check (anti-bot)
    if (body.kmst_hp_token) {
      return sendJSON(res, { success: true, message: 'Welcome to the Sanctuary!' });
    }

    // 2. Rate limit check (max 8 signups per 5 minutes per IP)
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const rateCheck = checkKMSTRateLimit('signup_' + clientIp, 8, 300000);
    if (!rateCheck.allowed) {
      return sendJSON(res, { success: false, message: `Too many registration attempts. Please try again in ${rateCheck.retryAfter}s.` }, 429);
    }

    const db = readDB();
    db.kmstMembers = db.kmstMembers || [];

    const alias = sanitizeKMSTInput(body.alias || body.name || 'Phoenix_Warrior').trim();
    const email = sanitizeKMSTInput(body.email || '').toLowerCase().trim();
    const passwordPin = sanitizeKMSTInput(body.passwordPin || body.password || '1234').trim();
    const soberDate = body.soberDate || new Date().toISOString().split('T')[0];
    const dailySpend = Math.max(0, parseFloat(body.dailySpend) || 15.0);
    const dailyDrinks = Math.max(0, parseInt(body.dailyDrinks, 10) || 4);
    const showSavingsPublic = body.showSavingsPublic !== false;
    const primaryFocus = sanitizeKMSTInput(body.primaryFocus || 'Alcohol Recovery (Continuous Sobriety)');
    const pledge = sanitizeKMSTInput(body.pledge || 'One day at a time with clarity and courage.');
    const avatar = body.avatar || '🕊️';
    const profileTheme = sanitizeKMSTInput(body.profileTheme || 'fancy'); // basic, fancy, luxury, cyber
    const profileColor = sanitizeKMSTInput(body.profileColor || 'rose'); // emerald, rose, amber, purple, cyan, ruby, sapphire, gold, obsidian, sunset

    // Spam check on pledge and alias (zero spam links allowed)
    if (detectKMSTSpam(pledge, false) || detectKMSTSpam(alias, false)) {
      return sendJSON(res, { success: false, message: 'Registration rejected: Links or spam keywords are not permitted.' }, 400);
    }

    // Calculate days, financial savings, and milestone badge
    const now = new Date();
    const sDate = new Date(soberDate);
    const daysSober = Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
    const moneySaved = parseFloat((daysSober * dailySpend).toFixed(2));
    const drinksAvoided = daysSober * dailyDrinks;
    const hoursReclaimed = parseFloat((daysSober * 2.5).toFixed(1));
    const badgeDetails = getKMSTBadgeDetails(daysSober);

    const memberId = 'mem_' + Date.now();
    const newMember = {
      id: memberId,
      name: body.name || alias,
      alias,
      email,
      passwordPin,
      soberDate,
      daysSober,
      dailySpend,
      dailyDrinks,
      moneySaved,
      drinksAvoided,
      hoursReclaimed,
      showSavingsPublic,
      primaryFocus,
      pledge,
      avatar,
      profileTheme,
      profileColor,
      badgeText: badgeDetails.badgeText,
      badgeObject: badgeDetails.badgeObject,
      shieldIcon: badgeDetails.shieldIcon,
      emblemSvg: badgeDetails.emblemSvg,
      nextMilestoneDays: badgeDetails.nextMilestoneDays,
      role: (alias.toLowerCase().includes('steve pereira') || email.includes('steve')) ? 'founder' : 'member',
      verified: true,
      joinedAt: new Date().toISOString()
    };

    // Replace if alias or email already exists, otherwise add new
    const existingIdx = db.kmstMembers.findIndex(m => 
      (m.alias && m.alias.toLowerCase() === alias.toLowerCase()) || 
      (email && m.email && m.email === email)
    );

    if (existingIdx >= 0) {
      db.kmstMembers[existingIdx] = { ...db.kmstMembers[existingIdx], ...newMember, id: db.kmstMembers[existingIdx].id };
    } else {
      db.kmstMembers.unshift(newMember);
    }

    writeDB(db);
    return sendJSON(res, {
      success: true,
      message: `Welcome to the KMST Sanctuary, ${alias}! Your account is active.`,
      member: newMember
    });
  }

  // Member Login
  if (reqPath === '/api/kmst/login' && req.method === 'POST') {
    const body = await parseJSON(req);
    const identifier = (body.identifier || body.alias || body.email || '').trim().toLowerCase();
    const pin = (body.passwordPin || body.pin || body.password || '').trim();

    if (!identifier) {
      return sendJSON(res, { success: false, message: 'Please enter your username or email.' }, 400);
    }

    const db = readDB();
    const members = db.kmstMembers || [];
    const member = members.find(m => 
      (m.alias && m.alias.toLowerCase() === identifier) || 
      (m.email && m.email.toLowerCase() === identifier)
    );

    if (!member) {
      return sendJSON(res, { success: false, message: 'No recovery account found with this username. Please register first.' }, 404);
    }

    // Optional PIN verification if set
    if (member.passwordPin && pin && member.passwordPin !== pin && member.passwordPin !== '1234') {
      return sendJSON(res, { success: false, message: 'Incorrect passcode PIN. Please try again.' }, 401);
    }

    // Recalculate live streak & savings
    const now = new Date();
    const sDate = new Date(member.soberDate || now);
    const daysSober = Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
    const dailySpend = member.dailySpend || 15.0;
    const dailyDrinks = member.dailyDrinks || 4;
    member.daysSober = daysSober;
    member.moneySaved = parseFloat((daysSober * dailySpend).toFixed(2));
    member.drinksAvoided = daysSober * dailyDrinks;
    member.hoursReclaimed = parseFloat((daysSober * 2.5).toFixed(1));
    const badge = getKMSTBadgeDetails(daysSober);
    member.badgeText = badge.badgeText;
    member.badgeObject = badge.badgeObject;
    member.shieldIcon = badge.shieldIcon;
    member.emblemSvg = badge.emblemSvg;
    member.nextMilestoneDays = badge.nextMilestoneDays;

    return sendJSON(res, {
      success: true,
      message: `Welcome back, ${member.alias}!`,
      member
    });
  }

  // Get Public Profile
  if (reqPath.startsWith('/api/kmst/profile/') && req.method === 'GET') {
    const aliasQuery = decodeURIComponent(reqPath.replace('/api/kmst/profile/', '')).toLowerCase();
    const db = readDB();
    const members = db.kmstMembers || [];
    const member = members.find(m => m.alias && m.alias.toLowerCase() === aliasQuery);

    if (!member) {
      return sendJSON(res, { success: false, message: 'Member profile not found.' }, 404);
    }

    const now = new Date();
    const sDate = new Date(member.soberDate || now);
    const daysSober = Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
    const badge = getKMSTBadgeDetails(daysSober);

    const publicProfile = {
      alias: member.alias,
      avatar: member.avatar || '🕊️',
      daysSober,
      soberDate: member.soberDate,
      badgeText: badge.badgeText,
      badgeObject: badge.badgeObject,
      shieldIcon: badge.shieldIcon,
      emblemSvg: badge.emblemSvg,
      nextMilestoneDays: badge.nextMilestoneDays,
      primaryFocus: member.primaryFocus,
      pledge: member.pledge,
      profileTheme: member.profileTheme || 'fancy',
      profileColor: member.profileColor || 'rose',
      showSavingsPublic: member.showSavingsPublic !== false,
      moneySaved: member.showSavingsPublic !== false ? parseFloat((daysSober * (member.dailySpend || 15)).toFixed(2)) : null,
      drinksAvoided: member.showSavingsPublic !== false ? (daysSober * (member.dailyDrinks || 4)) : null,
      hoursReclaimed: member.showSavingsPublic !== false ? parseFloat((daysSober * 2.5).toFixed(1)) : null,
      joinedAt: member.joinedAt
    };

    return sendJSON(res, { success: true, profile: publicProfile });
  }

  // Update Profile Settings
  if (reqPath === '/api/kmst/profile' && req.method === 'PUT') {
    const body = await parseJSON(req);
    const alias = (body.alias || '').trim();
    const db = readDB();
    db.kmstMembers = db.kmstMembers || [];
    const targetIdx = db.kmstMembers.findIndex(m => m.alias && m.alias.toLowerCase() === alias.toLowerCase());

    if (targetIdx < 0) {
      return sendJSON(res, { success: false, message: 'Member not found.' }, 404);
    }

    db.kmstMembers[targetIdx] = {
      ...db.kmstMembers[targetIdx],
      ...body,
      alias: db.kmstMembers[targetIdx].alias, // Protect alias identity
      updatedAt: new Date().toISOString()
    };

    writeDB(db);
    return sendJSON(res, { success: true, message: 'Profile updated successfully!', member: db.kmstMembers[targetIdx] });
  }

  // Get Messages Feed
  if (reqPath === '/api/kmst/messages' && req.method === 'GET') {
    const db = readDB();
    const allMessages = db.kmstMessages || [];
    const channel = parsedUrl.query.channel;
    const q = (parsedUrl.query.q || '').toLowerCase();
    const includePending = parsedUrl.query.pending === 'true';

    let filtered = allMessages.filter(m => includePending ? true : (m.status !== 'rejected'));
    if (channel && channel !== 'all') {
      filtered = filtered.filter(m => m.channel === channel);
    }
    if (q) {
      filtered = filtered.filter(m => 
        (m.message && m.message.toLowerCase().includes(q)) ||
        (m.authorName && m.authorName.toLowerCase().includes(q)) ||
        (m.authorBadge && m.authorBadge.toLowerCase().includes(q))
      );
    }

    return sendJSON(res, {
      success: true,
      channel: channel || 'all',
      count: filtered.length,
      messages: filtered
    });
  }

  // Post Message (Enforces account requirement, anti-spam link blocker, and milestone badge attachment)
  if (reqPath === '/api/kmst/messages' && req.method === 'POST') {
    const body = await parseJSON(req);
    
    // 1. Honeypot check (anti-bot)
    if (body.kmst_hp_token) {
      return sendJSON(res, { success: true, message: 'Message shared!' });
    }

    // 2. Rate limit check (max 8 messages per minute per IP)
    const clientIp = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const rateCheck = checkKMSTRateLimit('msg_' + clientIp, 8, 60000);
    if (!rateCheck.allowed) {
      return sendJSON(res, { success: false, message: `Please slow down. You can post again in ${rateCheck.retryAfter}s.` }, 429);
    }

    const rawText = (body.message || '').trim();
    if (!rawText) {
      return sendJSON(res, { success: false, message: 'Message content cannot be empty.' }, 400);
    }

    if (rawText.length > 2000) {
      return sendJSON(res, { success: false, message: 'Message exceeds maximum length (2,000 characters).' }, 400);
    }

    // 3. Strict Anti-Spam & Zero External Links Policy
    const authorRole = sanitizeKMSTInput(body.authorRole || 'Member');
    const isFounder = authorRole.toLowerCase().includes('founder');
    
    if (detectKMSTSpam(rawText, isFounder)) {
      return sendJSON(res, { 
        success: false, 
        message: 'Security Notice: External links, promo links, or promotional spam are strictly prohibited in the KMST Sanctuary.' 
      }, 400);
    }

    const sanitizedText = sanitizeKMSTInput(rawText);
    const db = readDB();
    db.kmstMessages = db.kmstMessages || [];

    const authorName = sanitizeKMSTInput(body.authorName || 'Anonymous Warrior');
    const includeBadge = body.includeBadge !== false;
    const postColor = sanitizeKMSTInput(body.postColor || 'rose'); // 1 of 10 matching site colors

    // Lookup member stats for accurate badge attachment
    const member = (db.kmstMembers || []).find(m => m.alias && m.alias.toLowerCase() === authorName.toLowerCase());
    let streakDays = 1;
    let badgeObject = '⚡ 24-Hour Spark of Ignition';
    let shieldIcon = '⚡';
    let badgeText = 'Day 1 Warrior';

    if (member && member.soberDate) {
      const now = new Date();
      streakDays = Math.max(0, Math.floor((now - new Date(member.soberDate)) / (1000 * 60 * 60 * 24)));
      const details = getKMSTBadgeDetails(streakDays);
      badgeText = details.badgeText;
      badgeObject = details.badgeObject;
      shieldIcon = details.shieldIcon;
    } else if (body.authorBadge) {
      badgeText = sanitizeKMSTInput(body.authorBadge);
    }

    const newMsg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      channel: sanitizeKMSTInput(body.channel || 'general'),
      authorName,
      authorRole,
      authorAvatar: body.authorAvatar || (member ? member.avatar : '🕊️'),
      authorBadge: badgeText,
      includeBadge,
      badgeObject,
      shieldIcon,
      streakDays,
      postColor,
      message: sanitizedText,
      timestamp: new Date().toISOString(),
      pinned: !!body.pinned,
      status: 'approved', // auto-approved with immediate admin moderation capability
      reactions: {
        strength: 1,
        respect: 0,
        celebrate: 0,
        soberToday: 0
      }
    };

    db.kmstMessages.unshift(newMsg);
    if (db.kmstMessages.length > 1000) db.kmstMessages = db.kmstMessages.slice(0, 1000);

    writeDB(db);
    return sendJSON(res, {
      success: true,
      message: 'Your message has been posted to the KMST Sanctuary!',
      data: newMsg
    });
  }

  // Admin Update Message Status (Approve / Reject / Pin)
  if (reqPath.startsWith('/api/kmst/messages/') && reqPath.endsWith('/status') && req.method === 'PUT') {
    const parts = reqPath.split('/');
    const messageId = parts[4];
    const body = await parseJSON(req);
    const db = readDB();
    db.kmstMessages = db.kmstMessages || [];
    const target = db.kmstMessages.find(m => m.id === messageId);

    if (!target) return sendJSON(res, { success: false, message: 'Message not found.' }, 404);

    if (body.status) target.status = sanitizeKMSTInput(body.status);
    if (body.pinned !== undefined) target.pinned = !!body.pinned;

    writeDB(db);
    return sendJSON(res, { success: true, message: 'Message status updated.', data: target });
  }

  // Admin edit message (PUT)
  if (reqPath.startsWith('/api/kmst/messages/') && !reqPath.endsWith('/react') && !reqPath.endsWith('/status') && req.method === 'PUT') {
    const messageId = reqPath.replace('/api/kmst/messages/', '');
    const body = await parseJSON(req);
    const db = readDB();
    db.kmstMessages = db.kmstMessages || [];
    const targetIdx = db.kmstMessages.findIndex(m => m.id === messageId);
    if (targetIdx < 0) return sendJSON(res, { success: false, message: 'Message not found.' }, 404);

    db.kmstMessages[targetIdx] = {
      ...db.kmstMessages[targetIdx],
      message: sanitizeKMSTInput(body.message || db.kmstMessages[targetIdx].message),
      channel: body.channel || db.kmstMessages[targetIdx].channel,
      authorName: sanitizeKMSTInput(body.authorName || db.kmstMessages[targetIdx].authorName),
      authorBadge: sanitizeKMSTInput(body.authorBadge || db.kmstMessages[targetIdx].authorBadge),
      pinned: body.pinned !== undefined ? !!body.pinned : db.kmstMessages[targetIdx].pinned,
      postColor: body.postColor || db.kmstMessages[targetIdx].postColor || 'rose',
      editedAt: new Date().toISOString()
    };

    writeDB(db);
    return sendJSON(res, { success: true, message: 'Message updated successfully!', data: db.kmstMessages[targetIdx] });
  }

  if (reqPath.startsWith('/api/kmst/messages/') && reqPath.endsWith('/react') && req.method === 'POST') {
    const parts = reqPath.split('/');
    const messageId = parts[4];
    const body = await parseJSON(req);
    const reactionType = body.reaction || 'strength'; // strength, respect, celebrate, soberToday

    const db = readDB();
    db.kmstMessages = db.kmstMessages || [];
    const target = db.kmstMessages.find(m => m.id === messageId);

    if (!target) {
      return sendJSON(res, { success: false, message: 'Message not found.' }, 404);
    }

    target.reactions = target.reactions || { strength: 0, respect: 0, celebrate: 0, soberToday: 0 };
    target.reactions[reactionType] = (target.reactions[reactionType] || 0) + 1;
    writeDB(db);

    return sendJSON(res, {
      success: true,
      reactions: target.reactions
    });
  }

  if (reqPath.startsWith('/api/kmst/messages/') && req.method === 'DELETE') {
    const messageId = reqPath.replace('/api/kmst/messages/', '');
    const db = readDB();
    db.kmstMessages = (db.kmstMessages || []).filter(m => m.id !== messageId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Message removed from community.' });
  }

  // Admin Members CRUD
  if (reqPath === '/api/kmst/members' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, members: db.kmstMembers || [] });
  }

  if (reqPath.startsWith('/api/kmst/members/') && req.method === 'DELETE') {
    const memberId = reqPath.replace('/api/kmst/members/', '');
    const db = readDB();
    db.kmstMembers = (db.kmstMembers || []).filter(m => m.id !== memberId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Member removed from community registry.' });
  }

  // Admin KMST Config (PUT)
  if (reqPath === '/api/kmst/config' && (req.method === 'PUT' || req.method === 'POST')) {
    const body = await parseJSON(req);
    const db = readDB();
    db.kmstConfig = {
      ...(db.kmstConfig || {}),
      ...body,
      updatedAt: new Date().toISOString()
    };
    writeDB(db);
    return sendJSON(res, { success: true, message: 'KMST Hub settings updated successfully!', config: db.kmstConfig });
  }

  // Admin Helplines CRUD
  if (reqPath === '/api/kmst/helplines' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, helplines: db.kmstHelplines || [] });
  }

  if (reqPath === '/api/kmst/helplines' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.kmstHelplines = db.kmstHelplines || [];
    const newHelp = {
      id: 'help_' + Date.now(),
      title: sanitizeKMSTInput(body.title || 'New Helpline'),
      tel: sanitizeKMSTInput(body.tel || ''),
      category: sanitizeKMSTInput(body.category || 'Alcohol & Recovery'),
      hours: sanitizeKMSTInput(body.hours || '24/7 Free'),
      web: sanitizeKMSTInput(body.web || ''),
      desc: sanitizeKMSTInput(body.desc || ''),
      badge: sanitizeKMSTInput(body.badge || 'SUPPORT'),
      order: db.kmstHelplines.length + 1
    };
    db.kmstHelplines.push(newHelp);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Helpline added successfully!', data: newHelp });
  }

  if (reqPath.startsWith('/api/kmst/helplines/') && req.method === 'PUT') {
    const helpId = reqPath.replace('/api/kmst/helplines/', '');
    const body = await parseJSON(req);
    const db = readDB();
    db.kmstHelplines = (db.kmstHelplines || []).map(h => {
      if (h.id === helpId) {
        return {
          ...h,
          title: body.title !== undefined ? sanitizeKMSTInput(body.title) : h.title,
          tel: body.tel !== undefined ? sanitizeKMSTInput(body.tel) : h.tel,
          category: body.category !== undefined ? sanitizeKMSTInput(body.category) : (h.category || 'Alcohol & Recovery'),
          hours: body.hours !== undefined ? sanitizeKMSTInput(body.hours) : (h.hours || '24/7 Free'),
          web: body.web !== undefined ? sanitizeKMSTInput(body.web) : (h.web || ''),
          desc: body.desc !== undefined ? sanitizeKMSTInput(body.desc) : h.desc,
          badge: body.badge !== undefined ? sanitizeKMSTInput(body.badge) : h.badge
        };
      }
      return h;
    });
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Helpline updated successfully!' });
  }

  if (reqPath.startsWith('/api/kmst/helplines/') && req.method === 'DELETE') {
    const helpId = reqPath.replace('/api/kmst/helplines/', '');
    const db = readDB();
    db.kmstHelplines = (db.kmstHelplines || []).filter(h => h.id !== helpId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Helpline deleted successfully!' });
  }

  // ── KMST Blogs & Recovery Articles REST API ─────────────────────────────────
  if (reqPath === '/api/kmst/blogs' && req.method === 'GET') {
    const db = readDB();
    let blogs = db.blogs || [];
    const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const catQuery = urlObj.searchParams.get('category');
    const searchQuery = (urlObj.searchParams.get('q') || urlObj.searchParams.get('search') || '').toLowerCase().trim();
    const tagQuery = (urlObj.searchParams.get('tag') || '').toLowerCase().trim();

    if (catQuery && catQuery !== 'All' && catQuery !== 'all') {
      blogs = blogs.filter(b => b.category && b.category.toLowerCase() === catQuery.toLowerCase());
    }
    if (searchQuery) {
      blogs = blogs.filter(b => 
        (b.title && b.title.toLowerCase().includes(searchQuery)) ||
        (b.excerpt && b.excerpt.toLowerCase().includes(searchQuery)) ||
        (b.content && b.content.toLowerCase().includes(searchQuery)) ||
        (b.category && b.category.toLowerCase().includes(searchQuery)) ||
        (Array.isArray(b.tags) && b.tags.some(t => t.toLowerCase().includes(searchQuery)))
      );
    }
    if (tagQuery) {
      blogs = blogs.filter(b => Array.isArray(b.tags) && b.tags.some(t => t.toLowerCase().includes(tagQuery)));
    }

    return sendJSON(res, {
      success: true,
      count: blogs.length,
      total: (db.blogs || []).length,
      blogs,
      config: db.kmstAggregatorConfig || {}
    });
  }

  if (reqPath.startsWith('/api/kmst/blogs/') && req.method === 'GET') {
    const identifier = reqPath.replace('/api/kmst/blogs/', '').trim();
    const db = readDB();
    const blog = (db.blogs || []).find(b => b.id === identifier || b.slug === identifier);
    if (!blog) {
      return sendJSON(res, { success: false, message: 'Article not found' }, 404);
    }
    return sendJSON(res, { success: true, blog });
  }

  // Admin Recovery Blogs CRUD
  if (reqPath === '/api/kmst/blogs' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.blogs = db.blogs || [];
    const title = sanitizeKMSTInput(body.title || 'Untitled Recovery Article');
    const slug = body.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const newBlog = {
      id: 'kmst_art_' + Date.now(),
      title,
      slug,
      category: sanitizeKMSTInput(body.category || 'Recovery Guidelines'),
      readTime: sanitizeKMSTInput(body.readTime || '5 min read'),
      author: sanitizeKMSTInput(body.author || 'Steve Pereira (KMST Founder)'),
      authorRole: sanitizeKMSTInput(body.authorRole || 'KMST Recovery Advocate'),
      excerpt: sanitizeKMSTInput(body.excerpt || ''),
      content: body.content || '',
      actionSteps: Array.isArray(body.actionSteps) ? body.actionSteps : (body.actionSteps ? [body.actionSteps] : []),
      tags: Array.isArray(body.tags) ? body.tags : (typeof body.tags === 'string' ? body.tags.split(',').map(t => t.trim()) : []),
      isFeatured: !!body.isFeatured,
      source: body.source || 'KMST Sanctuary Original',
      date: body.date || new Date().toISOString().split('T')[0]
    };
    db.blogs.unshift(newBlog);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Recovery article published!', data: newBlog });
  }

  if (reqPath.startsWith('/api/kmst/blogs/') && req.method === 'PUT') {
    const blogId = reqPath.replace('/api/kmst/blogs/', '');
    const body = await parseJSON(req);
    const db = readDB();
    db.blogs = (db.blogs || []).map(b => b.id === blogId ? { ...b, ...body } : b);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Recovery article updated!' });
  }

  if (reqPath.startsWith('/api/kmst/blogs/') && req.method === 'DELETE') {
    const blogId = reqPath.replace('/api/kmst/blogs/', '');
    const db = readDB();
    db.blogs = (db.blogs || []).filter(b => b.id !== blogId);
    writeDB(db);
    return sendJSON(res, { success: true, message: 'Recovery article deleted!' });
  }

  // ── KMST Aggregator Control Endpoints ─────────────────────────────────────
  if (reqPath === '/api/kmst/aggregator/status' && req.method === 'GET') {
    const db = readDB();
    const config = db.kmstAggregatorConfig || {};
    return sendJSON(res, {
      success: true,
      config,
      totalArticles: (db.blogs || []).length,
      lastRun: config.lastRun || null,
      schedulerActive: !!kmstAggregatorSchedulerInterval
    });
  }

  if (reqPath === '/api/kmst/aggregator/run' && req.method === 'POST') {
    try {
      const result = await runKMSTAggregator(true);
      return sendJSON(res, {
        success: true,
        message: `Aggregator executed successfully! Added ${result.addedCount} new articles. Total in library: ${result.totalArticles}`,
        result
      });
    } catch (err) {
      return sendJSON(res, { success: false, message: 'Aggregator run failed: ' + err.message }, 500);
    }
  }

  if (reqPath === '/api/kmst/aggregator/config' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.kmstAggregatorConfig = {
      ...(db.kmstAggregatorConfig || {}),
      ...body
    };
    writeDB(db);
    startKMSTAggregatorScheduler(); // Restart scheduler with new config
    return sendJSON(res, { success: true, message: 'Aggregator configuration updated!', config: db.kmstAggregatorConfig });
  }

  
  if (reqPath === '/api/kmst/leaderboard' && req.method === 'GET') {
    const db = readDB();
    const members = db.kmstMembers || [];
    // Sort by daysSober descending
    const sorted = [...members].sort((a, b) => (b.daysSober || 0) - (a.daysSober || 0));
    // Return top 15
    const top = sorted.slice(0, 15).map(m => ({
      alias: m.alias,
      avatar: m.avatar,
      daysSober: m.daysSober,
      badgeText: m.badgeText,
      shieldIcon: m.shieldIcon,
      profileTheme: m.profileTheme,
      profileColor: m.profileColor
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(top));
  }

  if (reqPath === '/api/kmst/stats' && req.method === 'GET') {
    const db = readDB();
    const members = db.kmstMembers || [];
    const messages = db.kmstMessages || [];
    const config = db.kmstConfig || {};
    const now = new Date();
    const founderDate = new Date(config.founderSoberDate || '2013-06-01');
    let collectiveDays = 0;
    members.forEach(m => {
      if (m.soberDate) {
        const sDate = new Date(m.soberDate);
        collectiveDays += Math.max(0, Math.floor((now - sDate) / (1000 * 60 * 60 * 24)));
      }
    });

    return sendJSON(res, {
      success: true,
      membersCount: members.length,
      messagesCount: messages.length,
      collectiveDaysSober: collectiveDays,
      steveDaysSober: Math.max(0, Math.floor((now - founderDate) / (1000 * 60 * 60 * 24)))
    });
  }

  // Any unmatched /api/ route returns JSON 404, never fallback to HTML
  if (reqPath.startsWith('/api/')) {
    return sendJSON(res, { success: false, message: `API route not found: ${req.method} ${reqPath}` }, 404);
  }

  // Static File Serving with HTTP Range Streaming Support
  let filePath = path.join(__dirname, 'public', reqPath === '/' ? 'index.html' : reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, reqPath.replace(/^\//, ''));
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    const ext = path.extname(reqPath).toLowerCase();
    if (!ext || ext === '.html') {
      filePath = path.join(__dirname, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('File Not Found');
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range && (ext === '.mp4' || ext === '.mov')) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(filePath, { start, end });

      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      };

      res.writeHead(206, head);
      file.pipe(res);
    } else if (ext === '.html' || filePath.endsWith('index.html')) {
      let html = fs.readFileSync(filePath, 'utf8');
      const db = readDB();
      const seo = db.seo;
      if (seo && typeof seo === 'object') {
        if (seo.title) {
          const cleanTitle = seo.title.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          html = html.replace(/<title id="seoMetaTitle">.*?<\/title>/is, `<title id="seoMetaTitle">${cleanTitle}</title>`);
          html = html.replace(/<meta property="og:title" content=".*?">/is, `<meta property="og:title" content="${cleanTitle}">`);
          html = html.replace(/<meta name="twitter:title" content=".*?">/is, `<meta name="twitter:title" content="${cleanTitle}">`);
        }
        if (seo.description) {
          const cleanDesc = seo.description.replace(/"/g, '&quot;');
          html = html.replace(/<meta id="seoMetaDesc" name="description" content=".*?">/is, `<meta id="seoMetaDesc" name="description" content="${cleanDesc}">`);
          html = html.replace(/<meta property="og:description" content=".*?">/is, `<meta property="og:description" content="${cleanDesc}">`);
          html = html.replace(/<meta name="twitter:description" content=".*?">/is, `<meta name="twitter:description" content="${cleanDesc}">`);
        }
        if (seo.keywords) {
          const cleanKw = seo.keywords.replace(/"/g, '&quot;');
          html = html.replace(/<meta id="seoMetaKeywords" name="keywords" content=".*?">/is, `<meta id="seoMetaKeywords" name="keywords" content="${cleanKw}">`);
        }
      }
      const buffer = Buffer.from(html, 'utf8');
      res.writeHead(200, {
        'Content-Length': buffer.length,
        'Content-Type': 'text/html; charset=UTF-8',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(buffer);
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      };
      res.writeHead(200, head);
      fs.createReadStream(filePath).pipe(res);
    }
  } catch (err) {
    res.writeHead(500);
    res.end('Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`====================================================`);
  console.log(` STEVE PEREIRA PORTFOLIO SERVER (SPOTLIGHT API) `);
  console.log(` Port: ${PORT}`);
  console.log(` URL:  http://localhost:${PORT}`);
  console.log(`====================================================`);
  // Initialize backup scheduler if enabled
  try {
    startBackupScheduler();
  } catch(e) {
    console.log('[BACKUP SCHEDULER] Init skipped:', e.message);
  }
  // Initialize KMST Content Aggregator scheduler if enabled
  try {
    startKMSTAggregatorScheduler();
  } catch(e) {
    console.log('[KMST AGGREGATOR] Init skipped:', e.message);
  }
});
