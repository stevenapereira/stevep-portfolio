const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'data', 'db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

const mediaMap = {
  // Headshots / Full Body Slates initially in headshots
  'media_1786401217950_1': {
    title: 'Steve in Navy Wedding Suit & Blue Tie',
    tag: 'Full Body',
    desc: 'Full length standing slate in navy suit with blue silk tie and floral boutonnière'
  },
  'media_1786401218653_2': {
    title: 'Steve in White Long-Sleeve Polo & Grey Joggers',
    tag: 'Full Body',
    desc: 'Full standing fitness slate in white long-sleeve polo, grey joggers & runners'
  },
  'media_1786401219318_4': {
    title: 'Steve in Red Embroidered Silk Kurta',
    tag: 'Headshot',
    desc: 'Head & torso spotlight in traditional red embroidered silk Kurta'
  },
  'media_1786401218918_3': {
    title: 'Steve in Light Brown Suit & White Tie',
    tag: 'Headshot',
    desc: 'Portrait in bespoke light brown suit and white polka-dot tie'
  },
  'media_1786401217495_0': {
    title: 'Steve as Doctor with Stethoscope & Pink Shirt',
    tag: 'Full Body',
    desc: 'Full character slate as Doctor in pink shirt, paisley tie and stethoscope'
  },
  'media_1786400952743_6': {
    title: 'Steve in Navy Button Shirt with Chest Tattoo',
    tag: 'Headshot',
    desc: 'Headshot in open navy denim-trim shirt showing chest tattoo'
  },
  'media_1786400952239_5': {
    title: 'Steve in Navy Shirt (Direct Spotlight Headshot)',
    tag: 'Headshot',
    desc: 'High-impact direct gaze casting headshot in navy open collar shirt'
  },
  'media_1786400951228_3': {
    title: 'Steve in Red Silk Kurta (Close Portrait)',
    tag: 'Headshot',
    desc: 'Warm close portrait in rich red silk Kurta'
  },
  'media_1786400950473_2': {
    title: 'Steve Smiling in Red Embroidered Silk Kurta',
    tag: 'Headshot',
    desc: 'Warm smile casting headshot in red embroidered Kurta'
  },
  'media_1786400949823_1': {
    title: 'Steve in Light Blue Pinstripe Shirt',
    tag: 'Headshot',
    desc: 'Smiling commercial headshot in light blue Tommy Hilfiger pinstripe shirt'
  },
  'media_1786400949130_0': {
    title: 'Steve in White Open Collar Shirt',
    tag: 'Headshot',
    desc: 'Clean studio headshot in crisp white dress shirt on white backdrop'
  },
  'hs1': {
    title: 'Steve in Black Tee with Chest Tattoo',
    tag: 'Headshot',
    desc: 'Signature Phoenix tattoo character portrait'
  },
  'hs2': {
    title: 'Steve in Brown Executive Suit (The Meeting)',
    tag: 'Headshot',
    desc: 'Executive tailored character portrait from 4K production'
  },
  'hs5': {
    title: 'Steve Dramatic B&W Character Portrait',
    tag: 'Headshot',
    desc: 'B&W dramatic low-key studio character study'
  },

  // Stills and action items
  'media_1786400785743_35': {
    title: 'Steve Panorama Montage (Game of Egos)',
    tag: 'Filming Still',
    desc: '5-character action mural panorama composition'
  },
  'media_1786400785338_34': {
    title: 'Steve by Fox Mural in Open Check Shirt',
    tag: 'Filming Still',
    desc: '35mm street still by fox graffiti mural in open check shirt'
  },
  'media_1786400784916_33': {
    title: 'Steve in Grey Puffer Gilet & White Vest',
    tag: 'Filming Still',
    desc: 'Character still in grey puffer gilet, sunglasses and white vest'
  },
  'media_1786400784459_32': {
    title: 'Steve in White Ribbed Tank Top & Sunglasses',
    tag: 'Full Body',
    desc: 'Full standing slate in white ribbed tank top and beige shorts'
  },
  'media_1786400784060_31': {
    title: 'Steve in Grey Armani Vest & Blue Beanie',
    tag: 'Filming Still',
    desc: 'Street action still in grey Armani vest and blue beanie'
  },
  'media_1786400783615_30': {
    title: 'Steve in Action Combat Pose (Phoenix Tattoo)',
    tag: 'Filming Still',
    desc: 'Dual action combat pose showing full chest phoenix tattoo'
  },
  'media_1786400777520_29': {
    title: 'Steve in Light Blue Open-Collar Linen Shirt',
    tag: 'Headshot',
    desc: 'Head and shoulders portrait in light blue open-collar shirt'
  },
  'media_1786400777112_28': {
    title: 'Steve in Starfleet Uniform on Starship Bridge',
    tag: 'Filming Still',
    desc: 'Sci-fi filming still in Starfleet gold uniform holding phaser'
  },
  'media_1786400776708_27': {
    title: 'Steve in Starfleet Uniform with Orion Crew',
    tag: 'Filming Still',
    desc: 'Full cast scene in Starfleet uniform with Orion alien companions'
  },
  'media_1786400776292_26': {
    title: 'Steve in Red Silk Kurta with Co-Stars',
    tag: 'Filming Still',
    desc: 'Trio character still in red embroidered silk Kurta'
  },
  'media_1786400775879_25': {
    title: 'Steve in Zombie Wedding (Vampire Groom)',
    tag: 'Filming Still',
    desc: 'Zombie wedding production still as Vampire Groom in top hat and cape'
  },
  'media_1786400775474_24': {
    title: 'Steve in Vampire Character Make-Up & Red Collar Cape',
    tag: 'Headshot',
    desc: 'Character headshot in vampire makeup, fangs and red collar cape'
  },
  'media_1786400775066_23': {
    title: 'Steve on Set in Harlequin Clown Costume',
    tag: 'Filming Still',
    desc: 'Horror night shoot in forest in Harlequin clown costume with script'
  },
  'media_1786400774691_22': {
    title: 'Steve in Horror Feature Film Stunt (Clown Role)',
    tag: 'Filming Still',
    desc: 'Feature film horror stunt still in clown costume'
  },
  'media_1786400774286_21': {
    title: 'Steve in White Ribbed Vest on Metal Staircase',
    tag: 'Full Body',
    desc: 'Full body athletic pose on metal staircase in white ribbed vest'
  },
  'media_1786400773928_20': {
    title: 'Steve in Black & White Staircase Scene',
    tag: 'Filming Still',
    desc: 'B&W dramatic still on fire escape staircase'
  },
  'media_1786400773557_19': {
    title: 'Steve in Vampire Brocade Waistcoat & White Cravat',
    tag: 'Headshot',
    desc: 'Head & shoulders in red brocade waistcoat, ruby brooch and cravat'
  },
  'media_1786400773026_18': {
    title: 'Steve Pointing at Camera in Grey Tank Top',
    tag: 'Filming Still',
    desc: 'Dramatic character pose in grey tank top with sunglasses'
  },
  'media_1786400772637_17': {
    title: 'Steve in White Vest & Gold Cross (Dramatic Headshot)',
    tag: 'Headshot',
    desc: 'Dramatic headshot in white vest with gold cross necklace and chest tattoo'
  },
  'media_1786400772265_16': {
    title: 'Steve as Killer Clown in Forest Scene',
    tag: 'Filming Still',
    desc: 'Horror production still in clown makeup peeking behind tree'
  },
  'media_1786400771884_15': {
    title: 'Steve in B&W Phoenix Tattoo Portrait',
    tag: 'Headshot',
    desc: 'B&W studio portrait showing Phoenix tattoo and clenched fist'
  },
  'media_1786400771490_14': {
    title: 'Steve in Vampire Groom Drama Still',
    tag: 'Filming Still',
    desc: 'Horror drama production still with Vampire bride'
  },
  'media_1786400771108_13': {
    title: 'Steve in Martial Arts Tonfa Stunt Pose',
    tag: 'Filming Still',
    desc: 'Martial arts wooden tonfa stunt pose showing chest tattoo'
  },
  'media_1786400770743_12': {
    title: 'Steve with Phoenix Tattoo (Studio Headshot)',
    tag: 'Headshot',
    desc: 'Studio headshot profile showcasing full colour phoenix chest tattoo'
  },
  'media_1786400770343_11': {
    title: 'Steve Chest Phoenix Tattoo (Close-up)',
    tag: 'Filming Still',
    desc: 'High detail macro close-up of Phoenix chest tattoo'
  },
  'media_1786400769912_10': {
    title: 'Steve Chest Phoenix Tattoo Artwork',
    tag: 'Filming Still',
    desc: 'Detailed studio capture of Phoenix chest tattoo artwork'
  },
  'media_1786400769502_9': {
    title: 'Steve in White Vest & Sunglasses (Urban Headshot)',
    tag: 'Headshot',
    desc: 'Head & shoulders portrait behind urban railing in white vest and sunglasses'
  },
  'media_1786400769156_8': {
    title: 'Steve in Black Hoodie & Nike Cap (Cross-Legged)',
    tag: 'Full Body',
    desc: 'Full body studio pose sitting cross-legged in black hoodie and Nike cap'
  },
  'media_1786400768739_7': {
    title: 'Steve by Urban Railing in White Vest',
    tag: 'Filming Still',
    desc: 'Medium waist-up still holding urban railing in white vest'
  },
  'media_1786400768366_6': {
    title: 'Steve in Hospital Surgeon Scrubs & Surgical Loupes',
    tag: 'Headshot',
    desc: 'Headshot in surgeon scrubs, surgical cap and headlight loupes'
  },
  'media_1786400767922_5': {
    title: 'Steve in Dark Creepy Clown Character Make-Up',
    tag: 'Headshot',
    desc: 'Head & shoulders character study in creepy clown makeup'
  },
  'media_1786400767474_4': {
    title: 'Steve in Clown Costume with Harley Quinn Co-Star',
    tag: 'Filming Still',
    desc: 'Character still in clown costume alongside Harley Quinn co-star'
  },
  'media_1786400767032_3': {
    title: 'Steve in Killer Clown Face Paint (Night Close-up)',
    tag: 'Headshot',
    desc: 'Close-up headshot in killer clown face paint in dark lighting'
  },
  'media_1786400766668_2': {
    title: 'Steve as Doctor with Stethoscope & Pink Shirt',
    tag: 'Full Body',
    desc: 'Full standing character slate as Doctor in pink shirt, paisley tie and stethoscope'
  },
  'media_1786400766184_1': {
    title: 'Steve in Surgeon Scrubs & Magnifier Headset',
    tag: 'Headshot',
    desc: 'Close-up headshot in surgeon scrubs and illuminated magnifier headset'
  },
  'media_1786400765316_0': {
    title: 'Steve in Killer Clown Face Paint & Grey Tank Top',
    tag: 'Headshot',
    desc: 'Head & shoulders in killer clown makeup and grey ribbed tank top'
  },
  'st1': {
    title: 'Steve in The Central Line (Supervisor Role)',
    tag: 'Filming Still',
    desc: 'The Central Line - Supervisor Role'
  },
  'st2': {
    title: 'Steve in Snickers Commercial (Lead Double)',
    tag: 'Filming Still',
    desc: 'Snickers Commercial Set - Lead Double'
  },
  'st3': {
    title: 'Steve in Feature Film Location Shoot',
    tag: 'Filming Still',
    desc: 'Location Film Shoot - Character Still'
  },
  'st4': {
    title: 'Steve in Television Drama Scene',
    tag: 'Filming Still',
    desc: 'Television Drama Set - High Tension'
  }
};

// Apply updates to headshots
if (Array.isArray(db.headshots)) {
  db.headshots.forEach(item => {
    if (mediaMap[item.id]) {
      const m = mediaMap[item.id];
      item.title = m.title;
      item.tag = m.tag;
      if (m.desc) item.desc = m.desc;
      delete item.name; // remove 'undefined' string if present
    }
  });
}

// Apply updates to stills
if (Array.isArray(db.stills)) {
  db.stills.forEach(item => {
    if (mediaMap[item.id]) {
      const m = mediaMap[item.id];
      item.title = m.title;
      item.tag = m.tag;
      if (m.desc) item.desc = m.desc;
      delete item.name;
    }
  });
}

// Build fullBodySlates collection in db
const allItems = [...(db.headshots || []), ...(db.stills || [])];
const fullBodyItems = allItems.filter(item => item.tag === 'Full Body');
db.fullBodySlates = fullBodyItems;

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
console.log('Successfully updated db.json with intelligent titles, tags and fullBodySlates!');
console.log('Total headshots:', (db.headshots || []).length);
console.log('Total stills:', (db.stills || []).length);
console.log('Total fullBodySlates:', (db.fullBodySlates || []).length);
