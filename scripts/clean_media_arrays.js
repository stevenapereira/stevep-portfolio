const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

// All items across collections
const allPhotos = [...(db.headshots || []), ...(db.stills || []), ...(db.fullBodySlates || [])];

// Deduplicate by ID
const uniqueMap = new Map();
allPhotos.forEach(p => {
  if (p && p.id && !uniqueMap.has(p.id)) {
    uniqueMap.set(p.id, p);
  }
});

const distinctItems = Array.from(uniqueMap.values());

// Filter into appropriate primary arrays
db.headshots = distinctItems.filter(item => item.tag === 'Headshot');
db.fullBodySlates = distinctItems.filter(item => item.tag === 'Full Body');
db.stills = distinctItems.filter(item => item.tag === 'Filming Still' || item.tag === 'Signature B&W' || (!item.tag && item.type !== 'video'));

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

console.log('=== CLEAN ARRAYS REORGANIZED ===');
console.log('Headshots (Head & Shoulders):', db.headshots.length);
console.log('Full Body Standing Slates:', db.fullBodySlates.length);
console.log('Filming & Set Stills:', db.stills.length);
