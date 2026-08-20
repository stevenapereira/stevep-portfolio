/**
 * Convert db.json to SQLite
 * Usage: node convert-to-sqlite.js [path_to_db.json]
 * Connection string template: sqlite3 mydatabase.db < output_sqlite.sql
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '../data/db.json');
const outputPath = path.join(__dirname, 'output_sqlite.sql');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find ${inputPath}`);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let sql = '-- SQLite Database Export\n\n';

function escapeValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number' || typeof val === 'boolean') return val ? 1 : 0;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    
    // Handle base64 image data
    // SQLite doesn't have a built-in base64 decode in standard CLI without extensions,
    // so we can store it as base64 string or attempt to store as hex blob.
    // For simplicity and standard compatibility, we'll store hex.
    if (typeof val === 'string' && val.startsWith('data:image')) {
        const parts = val.split(',');
        if (parts.length === 2) {
            const buf = Buffer.from(parts[1], 'base64');
            return `X'${buf.toString('hex')}'`;
        }
    }
    return `'${val.replace(/'/g, "''")}'`;
}

function getColumnType(val, key) {
    if (typeof val === 'string' && val.startsWith('data:image')) return 'BLOB';
    if (typeof val === 'number') return 'INTEGER';
    if (typeof val === 'boolean') return 'INTEGER'; // SQLite doesn't have boolean
    return 'TEXT'; // JSON will be TEXT in SQLite
}

function generateTable(tableName, data) {
    if (!data) return;
    
    let isArray = Array.isArray(data);
    let rows = isArray ? data : [data];
    if (rows.length === 0) return;
    
    if (typeof data !== 'object') {
        rows = [{ value: data }];
    }

    const columns = Object.keys(rows[0]);
    let ddl = `DROP TABLE IF EXISTS "${tableName}";\nCREATE TABLE "${tableName}" (\n`;
    
    if (columns.includes('id')) {
        ddl += `  "id" TEXT PRIMARY KEY,\n`;
    } else {
        ddl += `  "_id" INTEGER PRIMARY KEY AUTOINCREMENT,\n`;
    }

    columns.forEach(col => {
        if (col === 'id') return;
        ddl += `  "${col}" ${getColumnType(rows[0][col], col)},\n`;
    });
    
    ddl = ddl.replace(/,\n$/, '\n);\n\n');
    sql += ddl;

    rows.forEach(row => {
        const cols = Object.keys(row).map(k => `"${k}"`).join(', ');
        const vals = Object.keys(row).map(k => escapeValue(row[k])).join(', ');
        sql += `INSERT INTO "${tableName}" (${cols}) VALUES (${vals});\n`;
    });
    sql += '\n';
}

const collections = [
    'credits', 'headshots', 'stills', 'stats', 'socials', 
    'aboutTimeline', 'itTimeline', 'hacks', 'blogs', 'seo', 
    'analytics', 'spotlightVideos', 'fullBodySlates', 'sectionRouting', 
    'customPages', 'siteTexts', 'spotlightProfile', 'training', 
    'layouts', 'activeTheme'
];

collections.forEach(key => {
    if (db[key] !== undefined) {
        generateTable(key, db[key]);
    }
});

fs.writeFileSync(outputPath, sql);
console.log(`Successfully generated ${outputPath}`);
