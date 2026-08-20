# AGENT_GUIDE.md - AI Developer Guide

Welcome, AI Agent! This document provides the essential context, architecture, and constraints for maintaining and expanding Steve Pereira's portfolio website.

## 🎯 Project Overview
This is a single-page application (SPA) acting as:
1. Steve Pereira's actor portfolio (headshots, stills, reels).
2. His IT career showcase.
3. A KMST recovery hub.

## 🛠️ Technology Stack
- **Backend:** Vanilla Node.js (`http.createServer`). **NO EXPRESS** or other backend frameworks.
- **Frontend:** HTML5, Vanilla JavaScript (`app.js`), Tailwind CSS (via CDN), Lucide Icons.
- **Database:** Flat-file JSON (`data/db.json`). About ~15MB (contains base64 images).
- **Media:** Static files served via Node (`/public/assets/`). Videos support HTTP 206 streaming.

## 🚀 How to Run
1. `npm install`
2. `node server.js` (or `npm start`)
3. Access at `http://localhost:3000`

## 🔒 Admin Access
- The admin dashboard allows content editing.
- Access via the UI (usually a hidden button or specific route).
- **Authentication:** PIN-based.
- **Storage:** The PIN is SHA-256 hashed and stored in `db.json` under the key `adminPin`.
- **API Endpoint:** POST `/api/admin/login`
- **Default PIN:** (Refer to local configuration, but usually `1234` or `0000` for fresh dev instances unless overridden).

## 📂 File Architecture
- `server.js` (~1170 lines): The sole backend file. Handles routing, static files, 206 video streams, and REST API.
- `package.json`: Node dependencies.
- `index.html` (~3000 lines): The main monolithic SPA view containing all templates, sections, and modals.
- `data/db.json` (~15MB): The database.
- `public/js/app.js` (~5200 lines): Frontend logic. Handles state, UI updates, API calls, and admin interactions.
- `public/css/themes.css`: CSS variables for the theming system.
- `public/assets/`: Media files.

## 🗄️ Database Schema (`db.json`)
The JSON object contains roughly 20 top-level keys. Key sections:
- `adminPin` (string): SHA-256 hash.
- `siteSettings` (object): Theme, title, SEO info.
- `headshots` (array): Objects with base64 data, titles, and ordering.
- `stills` (array): Production stills.
- `credits` (array): Acting credits.
- `videos` (array): Reel metadata.
- `resume` (object): IT/Acting resume data.
- `kmst` (array): Recovery hub resources.
- `pages` (array): Custom dynamic pages.
- `analytics` (object): Basic visitor tracking.

## 📡 API Reference
All endpoints expect and return JSON unless specified.
- `GET /api/data`: Fetch the entire public DB (excludes PIN).
- `POST /api/data/save`: Save changes (Requires Admin Auth header).
- `GET /api/backup/*`: Download system backups.
- `GET /api/credits`, `POST /api/credits`: Manage credits.
- `GET /api/hacks`, `POST /api/hacks`: IT hacks/tips.
- `GET /api/pages`, `POST /api/pages`: Custom pages.
- `GET /api/spotlight/*`, `POST /api/spotlight/*`: Spotlight features.
- `GET /api/seo`, `POST /api/seo`: SEO metadata management.
- `GET /api/analytics`: View page views.
- `POST /api/booking`: Submit contact form.
- `POST /api/admin/login`: Verify PIN.
- `POST /api/admin/change-pin`: Update PIN.
- `GET /api/training`, `POST /api/training`: Training/education history.
- `POST /api/seo/submit-sitemap`: Ping search engines.

## 🖥️ Frontend Architecture (`app.js`)
- **Monolithic Controller:** `app.js` runs the entire SPA.
- **renderAll Pipeline:** Data is fetched once, state is updated, and `renderAll()` (or specific render functions) updates the DOM.
- **Theme System:** Dynamically toggles classes on `<body>` based on settings.
- **Admin Tabs:** Content management is separated into logical tabs dynamically rendered when an admin is logged in.

## 📏 Key Conventions
- **Naming:** CamelCase for JS variables/functions. Kebab-case for CSS classes.
- **CSS:** Exclusively Tailwind CSS utility classes.
- **Icons:** Lucide Icons. Use `<i data-lucide="icon-name"></i>` and call `lucide.createIcons()` after DOM updates.
- **Fonts:** Keep generic or standard web fonts unless specified in `themes.css`.

## 🛠️ Common Development Tasks
- **Add a Credit:** Edit admin UI, POST to `/api/data/save` with updated array.
- **Change Theme:** Update `siteSettings.theme` via `/api/data/save`, `app.js` applies new CSS classes.
- **Update SEO:** Modify `siteSettings.seo`, update `<head>` tags.
- **Create Custom Page:** Add object to `pages` array, render logic in `app.js` creates a new section.

## ⚠️ Important Gotchas
1. **Base64 Images:** Many images are stored directly in `db.json` as base64 strings. Be cautious when reading/writing the file manually; it is large.
2. **No ORM:** Data is manipulated as raw JavaScript objects. Ensure deep copies/references are handled correctly before writing back to disk.
3. **HTTP 206 Streaming:** `server.js` manually calculates byte ranges. Do not modify the video streaming logic unless you fully understand HTTP range requests.
4. **Admin PIN:** It is one-way hashed. You cannot retrieve it, only overwrite it.
