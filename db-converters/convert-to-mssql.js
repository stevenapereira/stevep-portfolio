/**
 * Convert db.json to Microsoft SQL Server (MSSQL)
 * Usage: node convert-to-mssql.js [path_to_db.json]
 * Connection string template: sqlcmd -S <server> -U <username> -P <password> -d <dbname> -i output_mssql.sql
 */
const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2] || path.join(__dirname, '../data/db.json');
const outputPath = path.join(__dirname, 'output_mssql.sql');

if (!fs.existsSync(inputPath)) {
    console.error(`Error: Could not find ${inputPath}`);
    process.exit(1);
}

const db = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
let sql = '-- MSSQL Database Export\n\n';

function escapeValue(val) {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return val;
    if (typeof val === 'boolean') return val ? 1 : 0; // MSSQL uses BIT (1/0)
    if (typeof val === 'object') return `N'${JSON.stringify(val).replace(/'/g, "''")}'`;
    
    // Handle base64 image data (VARBINARY(MAX))
    // In SQL Server, we can use CAST(N'' AS XML).value('xs:base64Binary(.)', 'VARBINARY(MAX)') 
    // to decode base64 string, or just supply the hex. Let's supply the hex for simplicity.
    if (typeof val === 'string' && val.startsWith('data:image')) {
        const parts = val.split(',');
        if (parts.length === 2) {
            const hex = Buffer.from(parts[1], 'base64').toString('hex');
            return `0x${hex}`;
        }
    }
    return `N'${val.replace(/'/g, "''")}'`;
}

function getColumnType(val, key) {
    if (typeof val === 'string' && val.startsWith('data:image')) return 'VARBINARY(MAX)';
    if (typeof val === 'number') return 'INT';
    if (typeof val === 'boolean') return 'BIT';
    // MSSQL doesn't have a native JSON type prior to 2016 (uses NVARCHAR), but standard practice is NVARCHAR(MAX)
    return 'NVARCHAR(MAX)'; 
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
    // Use brackets for table names to handle keywords
    let ddl = `IF OBJECT_ID('[${tableName}]', 'U') IS NOT NULL DROP TABLE [${tableName}];\nGO\n\nCREATE TABLE [${tableName}] (\n`;
    
    if (columns.includes('id')) {
        ddl += `  [id] NVARCHAR(255) PRIMARY KEY,\n`;
    } else {
        ddl += `  [_id] INT IDENTITY(1,1) PRIMARY KEY,\n`;
    }

    columns.forEach(col => {
        if (col === 'id') return;
        ddl += `  [${col}] ${getColumnType(rows[0][col], col)},\n`;
    });
    
    ddl = ddl.replace(/,\n$/, '\n);\nGO\n\n');
    sql += ddl;

    rows.forEach(row => {
        const cols = Object.keys(row).map(k => `[${k}]`).join(', ');
        const vals = Object.keys(row).map(k => escapeValue(row[k])).join(', ');
        sql += `INSERT INTO [${tableName}] (${cols}) VALUES (${vals});\n`;
    });
    sql += 'GO\n\n';
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
