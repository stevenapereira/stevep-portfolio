/**
 * Convert db.json to PostgreSQL
 * Usage: node convert-to-postgres.js [path_to_db.json]
 * Connection string template: psql -U <username> -h <host> -d <dbname> -f output_postgres.sql
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '../data/db.json');
const outputPath = path.join(__dirname, 'output_postgres.sql');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find ${inputPath}`);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let sql = '-- PostgreSQL Database Export\n\n';

function escapeValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number' || typeof val === 'boolean') return val;
    if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
    
    // Handle base64 image data (BYTEA)
    if (typeof val === 'string' && val.startsWith('data:image')) {
        const parts = val.split(',');
        if (parts.length === 2) {
            return `decode('${parts[1]}', 'base64')`;
        }
    }
    return `'${val.replace(/'/g, "''")}'`;
}

function getColumnType(val, key) {
    if (typeof val === 'string' && val.startsWith('data:image')) return 'BYTEA';
    if (typeof val === 'number') return 'INTEGER';
    if (typeof val === 'boolean') return 'BOOLEAN';
    if (typeof val === 'object') return 'JSONB';
    return 'TEXT';
}

function generateTable(tableName, data) {
    if (!data) return;
    
    let isArray = Array.isArray(data);
    let rows = isArray ? data : [data];
    if (rows.length === 0) return;
    
    if (typeof data !== 'object') {
        rows = [{ value: data }];
    }

    // Quote table names that might be reserved words
    const safeTableName = `"${tableName}"`;
    const columns = Object.keys(rows[0]);
    let ddl = `DROP TABLE IF EXISTS ${safeTableName};\nCREATE TABLE ${safeTableName} (\n`;
    
    if (columns.includes('id')) {
        ddl += `  "id" VARCHAR(255) PRIMARY KEY,\n`;
    } else {
        ddl += `  "_id" SERIAL PRIMARY KEY,\n`;
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
        sql += `INSERT INTO ${safeTableName} (${cols}) VALUES (${vals});\n`;
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
