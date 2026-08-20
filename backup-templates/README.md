# Steve Pereira Portfolio - Deployment & Management Guide

Welcome to the source code for Steve Pereira's professional portfolio. This document outlines how to deploy, configure, and maintain this application across various environments.

## 🚀 Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
   *(Or run `node server.js` directly)*
3. View the site: Open [http://localhost:3000](http://localhost:3000)

## 📋 System Requirements
- Node.js v18.0.0 or higher
- Minimum 512MB RAM
- Modern web browser for the admin interface

## 🌐 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | The port the HTTP server binds to | `3000` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `development` |

## 💻 Local Development Environments

### Mac Local Development
1. Install Homebrew (if not installed):
   `/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"`
2. Install Node.js: `brew install node`
3. Clone/extract the project.
4. Run `npm install` and `npm start`.

### Windows PC Local Development
1. Download the Node.js installer from [nodejs.org](https://nodejs.org/).
2. Run the installer and ensure npm is included in your PATH.
3. Open PowerShell or Command Prompt.
4. Navigate to the project directory: `cd C:\path\to\project`
5. Run `npm install` and `npm start`.

## 🚀 Deployment Guides

### cPanel Deployment (Shared Hosting)
1. Log in to cPanel and open **Setup Node.js App**.
2. Click **Create Application**.
3. Set **Node.js version** to 18.x.
4. Set **Application mode** to `Production`.
5. Enter the **Application root** (e.g., `portfolio`).
6. Set **Application URL** to your domain.
7. Set **Application startup file** to `server.js`.
8. Click **Create**, then click **Run NPM Install**.
9. Upload your files via File Manager (excluding `node_modules`).
10. Click **Start App**.

### Linux VPS Deployment (Ubuntu/Debian)
We recommend using PM2 for process management and Nginx as a reverse proxy.

1. **Install Node.js & PM2:**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx
   sudo npm install -g pm2
   ```
2. **Start the App:**
   ```bash
   cd /path/to/portfolio
   npm install
   pm2 start server.js --name "steve-portfolio"
   pm2 startup
   pm2 save
   ```
3. **Configure Nginx:**
   Create `/etc/nginx/sites-available/portfolio`:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```
4. **Enable & Reload:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/portfolio /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```
5. **Install SSL:** `sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d yourdomain.com`

### Windows Server Deployment (IIS)
1. Install Node.js on the server.
2. Install **iisnode** and the **URL Rewrite** module for IIS.
3. Place files in `C:\inetpub\wwwroot\portfolio`.
4. Create a `web.config` file to map requests to `server.js`.
5. Alternatively, use PM2 (`npm install -g pm2`, `pm2-windows-service`) and reverse proxy via IIS URL Rewrite to `localhost:3000`.

## 🗄️ Database Migration
The app defaults to a flat-file JSON database (`data/db.json`). If you need to scale, use the bundled converter scripts in the `db-converters/` directory.

1. Navigate to `db-converters/`.
2. Choose your target database (e.g., `mysql-converter.js`, `postgres-converter.js`).
3. Follow the instructions in the specific converter file to push your `db.json` data to the new database.
4. **Note:** You will need to update `server.js` database operations to use the corresponding DB driver instead of reading/writing `db.json`.

## 🔗 Domain Migration
If you move the site to a new domain:
1. The site uses relative paths, so most assets will resolve automatically.
2. If any absolute URLs are hardcoded in the frontend content (e.g., in `db.json`), you can do a text replace in `db.json` from the old domain to the new domain.
3. Make sure to restart the server after manually editing `db.json`.

## 💾 Backup & Restore
- **Backup:** The application exposes an `/api/backup/*` endpoint to download zip files.
- **Restore:** Use the bundled `restore.html`. Open it in any browser (no server needed), provide the admin PIN and the backup ZIP file, and it will restore the `data/db.json` and `public/assets/` directly to the running server.

## ⚠️ Troubleshooting

- **EADDRINUSE (Port 3000 is taken):**
  Kill the process using the port, or change the port: `PORT=3001 npm start`.
- **Permission Errors writing to data/db.json:**
  Ensure the process owner has write permissions to the `data` folder: `chmod 755 data && chmod 644 data/db.json`.
- **Video Streaming Issues (Safari/iOS):**
  The server implements HTTP 206 Partial Content. If videos fail to play, ensure your reverse proxy (Nginx/Apache) is not stripping the `Range` headers or trying to buffer the entire file.
- **Admin PIN not working:**
  The PIN is stored as a SHA-256 hash in `db.json`. If you get locked out, you can generate a new SHA-256 hash of your desired PIN and manually replace the `adminPin` value in `data/db.json`, then restart the server.
