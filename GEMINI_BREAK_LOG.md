# 🔴 SteveP Portfolio — Gemini Break Log
### Project: `stevenapereira/stevep-portfolio` | Local: `~/Desktop/1) SteveP Pro`

> **Purpose:** A record of every incident where a Gemini AI change broke the live site, what was wrong, how long it took to diagnose & fix, and a pattern analysis so it stops happening.  
> Last updated: **12 Aug 2026, 00:34 BST**

---

## 📊 Summary Stats

| Metric | Count |
|---|---|
| Total site-breaking incidents | **5** |
| Caused by Gemini edits | **5 / 5** (100%) |
| Avg time to detect & fix | ~30–60 min per incident |
| Symptoms each time | Site blank / nav broken / hero missing |
| Files broken most often | `index.html`, `public/js/app.js` |
| Root cause pattern | Corrupt closing tags / stray characters after large edits |

---

## 🔴 Incident #1 — `server.js` Syntax Error
**Date:** 11 Aug 2026, 01:43 BST  
**Commit that broke it:** Feature addition around `f25be92`  
**Fix commit:** `c955f24`  

### What broke
The server crashed immediately on startup — site was completely unreachable (connection refused).

### Root cause
Gemini introduced a **syntax error on line 475 of `server.js`** while adding the Admin CMS, Hacks CRUD manager, and analytics tracking features. A malformed JavaScript expression caused Node.js to fail to parse the file, crashing the server before it could serve any requests.

### Impact
- ❌ Site 100% down — no pages loading at all
- ❌ All API endpoints offline
- ❌ Any data saved via Admin CMS inaccessible

### Fix
Manually located and corrected the syntax error on line 475 of `server.js`.

---

## 🔴 Incident #2 — `index.html` Syntax Error (Nav Broken)
**Date:** 11 Aug 2026, 03:49 BST  
**Commit that broke it:** `4e0c3ee` (Hacks cards enhancement)  
**Fix commit:** `d18c576`  

### What broke
- Site loaded visually but **navigation tabs were all broken** — clicking any menu item did nothing
- Page appeared stuck on the first tab with no way to switch

### Root cause
Gemini introduced a **syntax error on line 787 of `index.html`** while enhancing the Hacks section cards. A malformed HTML attribute broke the surrounding JavaScript `onclick` handler chain, causing all tab navigation to silently fail.

### Impact
- ❌ All navigation broken — only the home/casting tab was accessible
- ❌ About, Headshots, IT, Hacks, KMST, Booking, Admin pages unreachable
- ❌ Site appeared partially working (fooling the user) but was essentially broken

### Fix
Located and fixed the malformed HTML on line 787 of `index.html`.

---

## 🔴 Incident #3 — Fatal JS Syntax Error (Entire Site JS Dead)
**Date:** 11 Aug 2026, ~18:50 BST  
**Commit that broke it:** `5c07d73` (sticky menu, gold banner, icons redesign)  
**Fix commit:** `a20ad74`  

### What broke
- Site shell loaded (static HTML) but **everything dynamic was completely dead**
- Hero photo carousel: ❌ missing
- Credits table: ❌ not rendered
- All tab navigation: ❌ broken (switchTab undefined)
- All admin functions: ❌ dead

### Root cause
Gemini added **two stray `"` (double-quote) characters** inside `public/js/app.js`:
- **Line 837:** End of `renderHacks()` function — `}"` instead of `}`
- **Line 1079:** End of analytics export function — `}"` instead of `}`

These single extra characters created a **fatal JavaScript parse error**. Because `app.js` is loaded in `<head>`, when the browser failed to parse it, **100% of all JavaScript on the page was silently discarded** — nothing in `app.js` ran at all.

### Why it's so dangerous
A single stray character in JS = zero JS on the entire site. No error message, no partial fallback — just a completely broken dynamic layer while the static HTML skeleton shows fine.

### Impact
- ❌ Hero section blank (not rendered by JS)
- ❌ All 9 acting credits missing (rendered by JS)
- ❌ All navigation broken
- ❌ Site appeared visually present but was functionally dead

### How it was detected
`node --check public/js/app.js` revealed the exact line numbers with `SyntaxError`.

### Fix
Removed both stray `"` characters. Verified with `node --check` → `SYNTAX OK`.

---

## 🔴 Incident #4 — Broken `</div>` Closing Tag (Banner Corruption)
**Date:** 11 Aug 2026, ~21:31 BST  
**Commit that broke it:** `bc42e26` (nav redesign, social icons, analytics deep-dive)  
**Fix commit:** `f688990`  

### What broke
Same symptoms as Incident #3 — entire layout collapsed, hero missing, nav broken.

### Root cause
On **line 89 of `index.html`**, the banner section's closing `</div>` was truncated to just `</` with no element name:
```html
<!-- BROKEN — line 89 -->
</      <!-- ================= HEADER & NAVIGATION ================= -->

<!-- CORRECT -->
</div>

<!-- ================= HEADER & NAVIGATION ================= -->
```
The browser tried to parse `</` followed by whitespace as a closing tag for... nothing. This caused the entire `sticky top-0` nav container to never close, collapsing everything below it.

### Why it happened
Gemini was making large edits to the nav bar HTML and accidentally deleted the `div>` portion of the closing tag while restructuring, leaving just `</` on the line.

### Impact
- ❌ Entire page layout broken — all sections stacked/collapsed
- ❌ Hero missing
- ❌ Nav not clickable
- ❌ Credits not visible

### Fix
Restored `</div>` on line 89.

---

## 🔴 Incident #5 — Double Closing Div + Orphaned Duplicate Block
**Date:** 11 Aug 2026, ~21:46 BST  
**Commit that broke it:** `bc42e26` (same large feature commit as Incident #4)  
**Fix commit:** `d009164`  

### What broke
Same as above — Incident #4's fix revealed this second, deeper corruption that was also introduced by the same commit.

### Root cause
Two separate corruptions on the same line and surrounding area of `index.html`:

**Corruption 1 — Line 370:** A `</div>` was **duplicated** on the same line:
```html
<!-- BROKEN -->
        </div>             </div>

<!-- CORRECT -->
        </div>
```
The extra `</div>` prematurely closed the hero glass-card container, ejecting everything below it from its proper nesting.

**Corruption 2 — Lines 371–391:** An entire **22-line "Action CTA Buttons" block** was left floating outside the hero box as an orphaned duplicate. This block already existed correctly at lines 331–341 inside the hero. The orphaned version then had **3 trailing `</div>` closers** that closed containers that no longer existed.

**Net result:** 4 extra `</div>` tags across the file with no matching opens → browser collapses DOM nesting from the hero downward.

### Diagnosis method
```bash
python3 -c "
import re
with open('index.html') as f:
    content = f.read()
opens = len(re.findall(r'<div[\s>]', content))
closes = len(re.findall(r'</div>', content))
print(f'net={opens-closes}')
"
# Output: net=-4  ← should be 0
```

### Fix
1. Removed the duplicate `</div>` from line 370
2. Deleted the entire orphaned CTA block (lines 371–391)
3. Verified: `opens=266 closes=266 net=0 ✅`

---

## 🧠 Pattern Analysis — Why This Keeps Happening

### The Core Problem: Large Edits in a Single Pass
Every incident followed the same pattern:
1. You ask Gemini to add a significant new feature (nav redesign, icons, analytics etc.)
2. Gemini makes **many changes across a large file in a single edit**
3. During that edit, **small corruptions slip in** — a stray `"`, a truncated `</`, a doubled `</div>`
4. The page appears to load (the HTML skeleton is static) but **all dynamic content is dead**
5. Hours are wasted diagnosing

### The 3 Types of Corruption Gemini Keeps Introducing

| Type | Example | Effect |
|---|---|---|
| **Stray character in JS** | `}"` instead of `}` | ALL JavaScript dies silently |
| **Truncated HTML tag** | `</` instead of `</div>` | Layout collapses from that point down |
| **Duplicate/orphaned block** | Double `</div>` + orphaned content | Nesting breaks, sections collapse |

### Why They're So Hard to Spot
- The HTML **skeleton still loads** so the page looks like it's "working"
- JavaScript errors are **silent in production** (no visible error messages)
- Visual tools (browser) can't easily show you which div is unclosed
- The corruption is often **1 character** in a 2000-line file

---

## ✅ Prevention Checklist (for after every Gemini edit)

Run these commands immediately after every change:

```bash
# 1. Check JS syntax — catches ALL JS errors instantly
node --check public/js/app.js && echo "JS OK ✅" || echo "JS BROKEN ❌"

# 2. Check HTML div balance — catches unclosed/doubled divs
python3 -c "
import re
with open('index.html') as f: content = f.read()
o = len(re.findall(r'<div[\s>]', content))
c = len(re.findall(r'</div>', content))
print(f'divs: {o} open, {c} close, net={o-c}')
print('✅ BALANCED' if o==c else '❌ IMBALANCED — investigate!')
"

# 3. Check server and API are live
curl -s -o /dev/null -w "root: %{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "api/data: %{http_code}\n" http://localhost:3000/api/data
```

> [!IMPORTANT]
> **Always run the JS syntax check and div balance check after EVERY Gemini edit — before closing the session.**

---

## 📋 Incident Timeline (Chronological)

| Time (BST) | Commit | Type | File | Issue |
|---|---|---|---|---|
| 11 Aug 01:43 | `c955f24` | JS Syntax | `server.js` | Syntax error line 475 — server crash |
| 11 Aug 03:49 | `d18c576` | HTML Syntax | `index.html` | Syntax error line 787 — nav broken |
| 11 Aug 18:50 | `a20ad74` | JS Syntax | `app.js` | 2× stray `"` chars (lines 837, 1079) — all JS dead |
| 11 Aug 21:31 | `f688990` | HTML Tag | `index.html` | `</` truncated (line 89) — layout collapsed |
| 11 Aug 21:46 | `d009164` | HTML Structure | `index.html` | Double `</div>` + orphaned block — 4 extra closes |

---

## 📬 For Antigravity / Gemini Support

**Reference:** Conversation ID `84383124-10be-4748-9c7c-7f104c65ec02`  
**Project:** `stevenapereira/stevep-portfolio` (GitHub)  
**Local path:** `/Users/stevenpereira/Desktop/1) SteveP Pro`  

**Pattern complaint:** Every time a large feature is added in a single edit pass, small but catastrophic corruptions are introduced into `index.html` or `app.js`. These corruptions (stray chars, truncated tags, doubled/orphaned blocks) cause the **entire site to visually break** even though the server stays up. This has now happened **5 times in a single day (11 Aug 2026)**, costing many hours of your time.

**Request:** Gemini should run `node --check` on any modified JS files and verify HTML div balance on any modified HTML files **before committing**, as part of every edit workflow.
