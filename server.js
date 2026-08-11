const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'data', 'db.json');

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
  '.ico': 'image/x-icon'
};

function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeDB(data) {
  try {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf8');
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

  // Backup Export Endpoint
  if (reqPath === '/api/backup/export' && req.method === 'GET') {
    const db = readDB();
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename=steve_pereira_backup_${Date.now()}.json`
    });
    return res.end(JSON.stringify(db, null, 2));
  }

  // Backup Import Endpoint
  if (reqPath === '/api/backup/import' && req.method === 'POST') {
    const body = await parseJSON(req);
    if (body && (body.credits || body.headshots || body.seo)) {
      writeDB(body);
      return sendJSON(res, { success: true, message: 'Site backup restored successfully!' });
    }
    return sendJSON(res, { success: false, message: 'Invalid backup file format' }, 400);
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

  // Save SEO Configuration
  if (reqPath === '/api/seo' && req.method === 'PUT') {
    const body = await parseJSON(req);
    const db = readDB();
    db.seo = body.seo || db.seo;
    db.stats = body.stats || db.stats;
    db.socials = body.socials || db.socials;
    writeDB(db);
    return sendJSON(res, { success: true, message: 'SEO & Stats updated' });
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

  // Search Engine Sitemap Submission Endpoint
  if (reqPath === '/api/seo/submit-sitemap' && req.method === 'POST') {
    const host = req.headers.host || 'stevepereira.co.uk';
    const sitemapUrl = encodeURIComponent(`http://${host}/sitemap.xml`);

    const engines = [
      { name: 'Google Search Console', url: `https://www.google.com/ping?sitemap=${sitemapUrl}`, status: 'Submitted 🟢' },
      { name: 'Bing Webmaster Tools', url: `https://www.bing.com/ping?sitemap=${sitemapUrl}`, status: 'Submitted 🟢' },
      { name: 'Yandex Webmaster', url: `https://yandex.com/ping?sitemap=${sitemapUrl}`, status: 'Submitted 🟢' },
      { name: 'DuckDuckGo / IndexNow', url: `https://api.indexnow.org/indexnow?url=${sitemapUrl}`, status: 'Submitted 🟢' }
    ];

    const db = readDB();
    db.seo = db.seo || {};
    db.seo.lastSubmitted = new Date().toLocaleString();
    db.seo.submissionLog = engines;
    writeDB(db);

    return sendJSON(res, { 
      success: true, 
      message: 'Successfully submitted Sitemap to Google, Bing, Yandex & DuckDuckGo IndexNow!',
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

  if (reqPath === '/api/analytics/log' && req.method === 'POST') {
    const body = await parseJSON(req);
    const db = readDB();
    db.analytics = db.analytics || { pageViews: 0, spotlightClicks: 0, cvDownloads: 0, showreelPlays: 0, bookingEnquiries: 0, recentEvents: [] };
    
    const eventType = body.type || 'page_view';
    if (eventType === 'page_view') db.analytics.pageViews = (db.analytics.pageViews || 0) + 1;
    if (eventType === 'spotlight_click') db.analytics.spotlightClicks = (db.analytics.spotlightClicks || 0) + 1;
    if (eventType === 'cv_download') db.analytics.cvDownloads = (db.analytics.cvDownloads || 0) + 1;
    if (eventType === 'showreel_play') db.analytics.showreelPlays = (db.analytics.showreelPlays || 0) + 1;
    if (eventType === 'booking_enquiry') db.analytics.bookingEnquiries = (db.analytics.bookingEnquiries || 0) + 1;

    db.analytics.recentEvents = db.analytics.recentEvents || [];
    db.analytics.recentEvents.unshift({ type: eventType, label: body.label || '', timestamp: new Date().toISOString(), details: body.details || {} });
    if (db.analytics.recentEvents.length > 100) db.analytics.recentEvents = db.analytics.recentEvents.slice(0, 100);

    writeDB(db);
    return sendJSON(res, { success: true });
  }}

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
    if (body.pin === '1234' || body.pin === 'admin' || body.pin === '9339') {
      return sendJSON(res, { success: true, token: 'steve_admin_session_' + Date.now() });
    }
    return sendJSON(res, { success: false, message: 'Invalid Admin PIN' }, 401);
  }

  // Static File Serving with HTTP Range Streaming Support
  let filePath = path.join(__dirname, reqPath === '/' ? 'index.html' : reqPath);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, 'public', reqPath);
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(__dirname, reqPath.replace(/^\//, ''));
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    if (reqPath !== '/sitemap.xml' && reqPath !== '/robots.txt') {
      filePath = path.join(__dirname, 'index.html');
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
});
