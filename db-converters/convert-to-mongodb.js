/**
 * Convert db.json to MongoDB JS shell commands
 * Usage: node convert-to-mongodb.js [path_to_db.json]
 * Connection string template: mongosh "mongodb://localhost:27017/mydb" < output_mongodb.js
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '../data/db.json');
const outputPath = path.join(__dirname, 'output_mongodb.js');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find ${inputPath}`);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let script = '// MongoDB Shell Import Script\n\n';

function processDocument(doc) {
    let processed = { ...doc };
    for (const key in processed) {
        const val = processed[key];
        
        // Convert base64 image data to MongoDB BinData
        if (typeof val === 'string' && val.startsWith('data:image')) {
            const parts = val.split(',');
            if (parts.length === 2) {
                // Using BinData in Mongo Shell: BinData(0, "base64string")
                processed[key] = { $type: 'BinData', value: parts[1] };
            }
        } else if (typeof val === 'object' && val !== null) {
            processed[key] = processDocument(val); // Recursive for nested
        }
    }
    return processed;
}

function stringifyWithBinData(obj) {
    let json = JSON.stringify(obj, null, 2);
    // Find our placeholder for BinData and replace it with actual JS syntax
    // since we can't just JSON stringify complex Mongo types.
    json = json.replace(/"\{\s*"\\\$type":\s*"BinData",\s*"value":\s*"([^"]+)"\s*\}"/g, (match, p1) => {
        return `BinData(0, "${p1}")`;
    });
    
    // Quick regex replace for our hacky object structure
    json = json.replace(/\{\s*"\$type":\s*"BinData",\s*"value":\s*"([^"]+)"\s*\}/g, 'BinData(0, "$1")');
    return json;
}

const collections = [
    'credits', 'headshots', 'stills', 'stats', 'socials', 
    'aboutTimeline', 'itTimeline', 'hacks', 'blogs', 'seo', 
    'analytics', 'spotlightVideos', 'fullBodySlates', 'sectionRouting', 
    'customPages', 'siteTexts', 'spotlightProfile', 'training', 
    'layouts', 'activeTheme'
];

collections.forEach(key => {
    let data = db[key];
    if (data === undefined) return;
    
    script += `db.getCollection('${key}').drop();\n`;
    
    let isArray = Array.isArray(data);
    let rows = isArray ? data : [data];
    if (rows.length === 0) return;
    
    if (typeof data !== 'object') {
        rows = [{ value: data }];
    }

    const processedRows = rows.map(processDocument);
    script += `db.getCollection('${key}').insertMany(\n${stringifyWithBinData(processedRows)}\n);\n\n`;
});

fs.writeFileSync(outputPath, script);
console.log(`Successfully generated ${outputPath}`);
