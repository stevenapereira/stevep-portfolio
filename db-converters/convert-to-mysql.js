/**
 * Convert db.json to MySQL
 * Usage: node convert-to-mysql.js [path_to_db.json]
 * Connection string template: mysql -u <username> -p<password> -h <host> <dbname> < output_mysql.sql
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '../data/db.json');
const outputPath = path.join(__dirname, 'output_mysql.sql');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find ${inputPath}`);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let sql = '-- MySQL Database Export\n\n';

function escapeValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
    
    // Handle base64 image data (LONGBLOB)
    if (typeof val === 'string' && val.startsWith('data:image')) {
        const parts = val.split(',');
        if (parts.length === 2) {
            return `FROM_BASE64('${parts[1]}')`;
        }
    }
    return `'${val.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function getColumnType(val, key) {
    if (typeof val === 'string' && val.startsWith('data:image')) return 'LONGBLOB';
    if (typeof val === 'number') return 'INT';
    if (typeof val === 'boolean') return 'BOOLEAN';
    if (typeof val === 'object') return 'JSON';
    return 'TEXT';
}

function generateTable(tableName, data) {
    if (!data) return;
    
    let isArray = Array.isArray(data);
    let rows = isArray ? data : [data];
    if (rows.length === 0) return;
    
    // For single primitive values like activeTheme
    if (typeof data !== 'object') {
        rows = [{ value: data }];
    }

    const columns = Object.keys(rows[0]);
    let ddl = `DROP TABLE IF EXISTS ${tableName};\nCREATE TABLE ${tableName} (\n`;
    
    // Ensure id column if it exists is the primary key
    if (columns.includes('id')) {
        ddl += `  id VARCHAR(255) PRIMARY KEY,\n`;
    } else {
        ddl += `  _id INT AUTO_INCREMENT PRIMARY KEY,\n`;
    }

    columns.forEach(col => {
        if (col === 'id') return;
        ddl += `  ${col} ${getColumnType(rows[0][col], col)},\n`;
    });
    
    ddl = ddl.replace(/,\n$/, '\n);\n\n');
    sql += ddl;

    rows.forEach(row => {
        const cols = Object.keys(row).join(', ');
        const vals = Object.keys(row).map(k => escapeValue(row[k])).join(', ');
        sql += `INSERT INTO ${tableName} (${cols}) VALUES (${vals});\n`;
    });
    sql += '\n';
}

// 20 keys to process
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
