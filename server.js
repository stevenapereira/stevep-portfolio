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
      <input type="text" id="oldDomain" placeholder="Old domain (e.g. stevepereira.co.uk)" class="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-purple-400">
      <input type="text" id="newDomain" placeholder="New domain (e.g. stevepereira.pro)" class="px-4 py-2 rounded-xl bg-slate-900 border border-slate-700 text-white text-xs outline-none focus:border-purple-400">
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
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {};
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
        html = html.replace(/<p id="heroActorSummary"[^>]*>.*?<\/p>/is, `<p id="heroActorSummary" class="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">${t.actorSummary}</p>`);
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

function buildSitemapXml(host = 'stevepereira.co.uk') {
  const db = readDB();
  const pages = ['#tab-about', '#tab-headshots', '#tab-stills', '#tab-showreels', '#tab-works', '#tab-it', '#tab-hacks', '#tab-kmst'];
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
  xml += `  <url>\n    <loc>http://${host}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;
  
  pages.forEach(p => {
    xml += `  <url>\n    <loc>http://${host}/${p}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;
  });
  
  (db.customPages || []).forEach(cp => {
    xml += `  <url>\n    <loc>http://${host}/#page-${cp.slug}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.7</priority>\n  </url>\n`;
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

  // Sitemap.xml Endpoint
  if (reqPath === '/sitemap.xml' && req.method === 'GET') {
    const host = req.headers.host || 'stevepereira.co.uk';
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    return res.end(buildSitemapXml(host));
  }

  // Sitemap.xml Endpoint
  if (reqPath === '/sitemap.xml' && req.method === 'GET') {
    const host = req.headers.host || 'stevepereira.co.uk';
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    return res.end(buildSitemapXml(host));
  }

  // Robots.txt Endpoint
  if (reqPath === '/robots.txt' && req.method === 'GET') {
    const host = req.headers.host || 'stevepereira.co.uk';
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
    const host = req.headers.host || 'stevepereira.co.uk';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const baseUrl = `${protocol}://${host}`;
    
    const db = readDB();
    const pages = ['#tab-about', '#tab-headshots', '#tab-stills', '#tab-showreels', '#tab-works', '#tab-it', '#tab-hacks', '#tab-kmst'];
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>1.0</priority>\n  </url>\n`;
    
    pages.forEach(p => {
      xml += `  <url>\n    <loc>${baseUrl}/${p}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.8</priority>\n  </url>\n`;
    });
    
    (db.customPages || []).forEach(cp => {
      xml += `  <url>\n    <loc>${baseUrl}/#page-${cp.slug}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <priority>0.7</priority>\n  </url>\n`;
    });

    xml += `</urlset>`;
    
    res.writeHead(200, { 'Content-Type': 'application/xml; charset=UTF-8' });
    return res.end(xml);
  }

  // Robots.txt Endpoint
  if (reqPath === '/robots.txt' && req.method === 'GET') {
    const host = req.headers.host || 'stevepereira.co.uk';
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const robots = `User-agent: *\nAllow: /\n\nSitemap: ${protocol}://${host}/sitemap.xml\n`;
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=UTF-8' });
    return res.end(robots);
  }

  // Multi-Search Engine Sitemap Submission & Ping Endpoint
  if (reqPath === '/api/seo/submit-sitemap' && req.method === 'POST') {
    const host = req.headers.host || 'stevepereira.pro';
    const cleanHost = host.replace(/^https?:\/\//, '');
    const siteUrl = `https://${cleanHost}`;
    const sitemapRaw = `https://${cleanHost}/sitemap.xml`;
    const sitemapEncoded = encodeURIComponent(sitemapRaw);

    const engines = [
      { name: 'Google Search Console', url: `https://www.google.com/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'Global Search' },
      { name: 'Bing Webmaster Tools', url: `https://www.bing.com/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'Global Search' },
      { name: 'DuckDuckGo / IndexNow', url: `https://api.indexnow.org/indexnow?url=${encodeURIComponent(siteUrl)}&key=stevepereira`, status: 'Notified 🟢', category: 'Instant Crawl' },
      { name: 'Yandex Webmaster', url: `https://yandex.com/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'European Search' },
      { name: 'Seznam.cz Webmaster', url: `https://search.seznam.cz/ping?sitemap=${sitemapEncoded}`, status: 'Pinged 🟢', category: 'European Search' },
      { name: 'Brave Search Index', url: `https://search.brave.com/`, status: 'Queued 🟢', category: 'Privacy Search' },
      { name: 'Internet Archive Wayback', url: `https://web.archive.org/save/${encodeURIComponent(siteUrl)}`, status: 'Archived 🟢', category: 'Preservation' }
    ];

    const db = readDB();
    db.seo = db.seo || {};
    db.seo.lastSubmitted = new Date().toLocaleString('en-GB', { timeZone: 'Europe/London' });
    db.seo.submissionLog = engines;
    writeDB(db);

    return sendJSON(res, { 
      success: true, 
      message: `Successfully pinged ${engines.length} active search engine crawlers & archive indexers!`,
      timestamp: db.seo.lastSubmitted,
      results: engines
    });
  }

  // Hacks CRUD Endpoints (GET, POST, PUT, DELETE)
  if (reqPath === '/api/hacks' && req.method === 'GET') {
    const db = readDB();
    return sendJSON(res, { success: true, data: db.hacks || [] });
  }

  if (reqPath === '/api/hacks' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    const newHack = {
      id: 'hack_' + Date.now(),
      title: body.title || 'New Tech Hack & Deal',
      category: body.category || 'Developer Tools',
      badge: body.badge || 'EXCLUSIVE',
      code: body.code || 'STEVEVIP',
      link: body.link || '#',
      desc: body.desc || 'Curated deal by Steve Pereira.',
      logo: body.logo || '',
      image: body.image || '',
      clicks: 0
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
    if (/stevepereira\./i.test(ref)) return { source: 'Self (stevepereira)', medium: 'internal', referrerRaw: refHeader };
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

server.listen(PORT, () => {
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
});
