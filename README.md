# Acme Interiors — website

Marketing website for **Acme Interiors**, a corporate interior design and fit-out studio. It's plain HTML, CSS and JavaScript with no build step and no framework, made to run on **GitHub Pages**.

- The home page has an interactive 3D office built with [Three.js](https://threejs.org/), loaded from a CDN.
- **Projects** and **open roles** are JSON files in this repo, managed from an **admin panel** (`admin.html`) that commits changes through the GitHub API.
- **Form submissions** (contact enquiries and job applications) go to a private Google Sheet through a small Google Apps Script. The admin panel reads them from there.

## Pages

| File | Page | Notes |
|---|---|---|
| `index.html` | Home | 3D scroll story (hero → stats → anatomy → zones → deliver), services, process, sectors, contact form. Scroll snapping is on for this page only. |
| `work.html` | Work / gallery | Project grid with sector filters, built from `data/projects.json`. |
| `project.html` | Project detail | **One template for every project**, picked by the URL hash: `project.html#tech-floor`. An unknown id redirects to `404.html`. |
| `careers.html` | Careers | Perks, open roles from `data/careers.json` (expandable, filterable by team), hiring steps, application form with CV upload. |
| `terms.html` | Terms & Conditions | Static content with a scroll-tracking contents list. |
| `privacy.html` | Privacy Policy | Same layout as Terms. |
| `404.html` | Not found | GitHub Pages serves this automatically for missing URLs. |
| `admin.html` | Admin panel | Add, edit, remove and reorder projects and roles; read form submissions. Not linked from the site and hidden from search engines. |

## Folder structure

```
.
├── index.html, work.html, project.html, careers.html, terms.html, privacy.html, 404.html
├── admin.html          Admin panel (content + form submissions)
├── data/
│   ├── projects.json   Projects + sectors, written by the admin panel
│   └── careers.json    Roles + teams, written by the admin panel
├── css/
│   ├── base.css        Design tokens (colours, fonts), reset, nav, buttons, forms, footer, page headers
│   ├── home.css        3D stage, story cards, stats band, services, process, sectors, contact
│   ├── work.css        Gallery grid and project detail template
│   ├── careers.css · legal.css · 404.css
│   └── admin.css       Admin panel
├── js/
│   ├── config.js       Site settings: GitHub repo + forms endpoint (public, no secrets)
│   ├── site.js         Shared: nav highlight, scroll reveal, chips, form sending
│   ├── data.js         Loads data/*.json for the public pages
│   ├── home.js         Three.js office model, scroll story, stats counter (ES module)
│   ├── work.js         Gallery filters and cards
│   ├── project.js      Project detail template
│   ├── careers.js      Open roles, team filter, "Apply for this role"
│   ├── legal.js        Contents-list highlighting on terms/privacy
│   ├── github.js       GitHub API client used by the admin panel
│   └── admin.js        Admin panel
├── apps-script/
│   └── Code.gs         Google Apps Script that stores form submissions in a private Google Sheet
├── assets/logo.svg     Brand logo (nav, favicon, 3D reception wall)
├── img/                Images. Admin uploads go to img/projects/<project-id>/
├── robots.txt          Keeps admin.html out of search engines
└── .nojekyll           Tells GitHub Pages to serve files as-is
```

The nav and footer markup is repeated in each HTML file, so if you change a link, update it in every page.

## 1. Put the site on GitHub Pages

1. Create a repository (e.g. `acme-website`) and upload the contents of this folder to the `main` branch. Include the hidden `.nojekyll` file.
2. Repository **Settings → Pages → Build and deployment → Deploy from a branch → `main` / `(root)`** → Save.
3. After a minute the site is live at `https://<owner>.github.io/<repo>/`. To use your own domain, add it under Settings → Pages → Custom domain.

## 2. Connect the admin panel

Open `https://<your-site>/admin.html`.

There's no separate login. Anyone can open the page, but nothing can be changed without a **GitHub token** with write access to this repo, and submissions can't be read without the **admin key** (step 3). Both are kept only in the admin's own browser: in localStorage, or for the current session only if "Remember on this device" is unticked. They are never written to the repo.

**Create the token:**
1. GitHub → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token** ([direct link](https://github.com/settings/personal-access-tokens/new)).
2. **Repository access:** *Only select repositories* → this website repo.
3. **Permissions → Repository permissions → Contents: Read and write.** Nothing else is needed.
4. Set an expiry date, generate, and copy the token (`github_pat_…`).
5. In `admin.html` → **Settings**, enter owner, repo, branch (`main`) and the token, then click **Save & connect**. On `*.github.io` addresses the owner and repo are filled in automatically. With a custom domain, type them in once or set them in `js/config.js`.

> **Never put the token in any file in the repo.** The repo is public, and GitHub automatically revokes tokens it finds in public code. If a token leaks, delete it on GitHub and generate a new one. Only connect the admin panel on computers you trust.

### What the admin panel does

| Section | You can |
|---|---|
| **Projects** | Add, edit, delete and reorder projects. Upload a hero image and any number of project images with captions (drag and drop or click). Mark a project as *featured* (large tile on the work page). Add new sectors. Images are resized in the browser (hero 2400 px, others 2000 px, JPEG) before upload. Images a deleted or edited project no longer uses are removed from the repo. |
| **Careers** | Add, edit, delete and reorder roles. Open or close a role: closed roles stay in the list but are hidden from the careers page. Add new teams. Responsibilities and requirements are one point per line. |
| **Enquiries** | Submissions from the home-page contact form: search, view details, reply by email, delete, export CSV. |
| **Applications** | Submissions from the careers form, including the link to the uploaded CV in Google Drive. |
| **Settings** | GitHub connection and form-storage connection. |

Every save is **one commit** to the repo (for example "Add project: Fintech HQ"), so there's a full history on GitHub and any change can be reverted there. GitHub Pages republishes the site about a minute after each save, and the public pages may show cached data for up to another minute. Allow 1–3 minutes before checking a change on the live site.

### The project page template
`project.html` is the single template for every project. From top to bottom:

1. Back link, sector and year
2. Project title
3. Hero image
4. Intro sentence (large) and description (blank lines start new paragraphs)
5. Stat tiles: **area (sq ft), duration (weeks), type of work, sector, year completed**. Empty fields are skipped.
6. Project images with captions, in a repeating *full width → large half → small half* layout
7. "Next project" link and a "Start a similar project" button

## 3. Form submissions (Google Apps Script)

The contact form and the job application form send to a Google Apps Script web app (`apps-script/Code.gs`). It saves each form to **its own tab** in a private Google Sheet, **Enquiries** and **Applications**, and saves CVs to a Google Drive folder.

Submissions are deliberately **not** stored in the GitHub repo. A GitHub Pages repo is public, so names, phone numbers and CVs would be visible to anyone. A public web form also can't hold a GitHub token without giving every visitor write access to the site.

**Setup (about 10 minutes, free):**
1. Create a new **Google Sheet** (e.g. "Acme website submissions") in the Google account that should own the data.
2. **Extensions → Apps Script**. Replace the contents of `Code.gs` with `apps-script/Code.gs` from this folder and save.
3. **Project Settings (gear icon) → Script properties → Add script property:**
   - `ADMIN_KEY`: a long random password (12+ characters). The admin panel uses it to read and delete submissions.
   - `NOTIFY_EMAIL` *(optional)*: an address that gets an email for every new submission.
   - `CV_FOLDER_ID` *(optional)*: the id of a Drive folder for CVs. If it's left out, a folder called "Acme Interiors — CVs" is created automatically.
4. **Deploy → New deployment → Select type: Web app.** *Execute as:* **Me**. *Who has access:* **Anyone**. Click **Deploy**, approve the permissions, and copy the **Web app URL** (it ends in `/exec`).
5. Paste the URL into `js/config.js` → `formsEndpoint`, and commit. The website forms are now live.
6. In `admin.html` → **Settings → Form submissions**, paste the same URL and your `ADMIN_KEY` → **Save & test**.

If you edit `Code.gs` later: **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy**. The URL stays the same.

Notes:
- Until `formsEndpoint` is set, the forms show a "preview only" message and send nothing.
- Each form has a hidden field that bots tend to fill in. Those submissions are silently dropped.
- CVs are limited to 5 MB (PDF or Word). The Drive folder is private to the Google account that owns the script.
- Values that look like spreadsheet formulas are stored as plain text.
- Update the privacy policy to say that submissions are stored with Google (Sheets and Drive).

## Running locally

Use a local web server rather than double-clicking the files. Browsers block `fetch()` and ES modules on `file://` URLs, and every page needs them.

```bash
# from this folder
python3 -m http.server 8000
# then open http://localhost:8000
```

`npx serve .` or the VS Code Live Server extension work too. The admin panel also works locally. It commits to the GitHub repo set in Settings, so changes go live the same way, and you `git pull` to see them in your local copy.

## Editing by hand

### Brand colours and fonts
All colours are CSS variables at the top of `css/base.css`. `--acc` is the brand orange `#FE7F2D` and `--navy` is `#233D4D`. The fonts are Inter Tight (headings and body) and JetBrains Mono (small labels), loaded from Google Fonts in each page's `<head>`. The 3D model's colours are the `C` and `M` objects near the top of `js/home.js`.

### Stats (home page)
In `index.html`, find the `.statsbar` block. Each number comes from `data-to` (and `data-dec` for decimals), e.g. `<strong data-to="250">`. **The current figures (250+ projects, 12 years, 4.9/5) are placeholders.**

### Data files
The admin panel writes these, but they're plain JSON if you'd rather edit them directly:

```jsonc
// data/projects.json
{ "categories": [ { "id": "tech", "name": "Technology", "color": "#FE7F2D" } ],
  "projects": [ { "id": "tech-floor", "title": "…", "category": "tech", "featured": true,
                  "area": "18,000", "duration": "14", "type": "Design & build", "year": "2025",
                  "lead": "…", "body": "…", "hero": "img/…jpg",
                  "images": [ { "src": "img/…jpg", "caption": "…" } ] } ] }

// data/careers.json
{ "departments": [ { "id": "design", "name": "Design", "color": "#FE7F2D" } ],
  "roles": [ { "id": "senior-interior-designer", "title": "…", "department": "design",
               "type": "Full-time", "experience": "6+ years", "open": true, "summary": "…",
               "responsibilities": ["…"], "requirements": ["…"] } ] }
```

The order in each list is the order on the site.

### Terms & privacy
Plain HTML in `terms.html` and `privacy.html`. Text wrapped in `<span class="ph">…</span>` marks details Acme must fill in: legal name, registered address, emails, jurisdiction, retention periods, cookie use and the grievance officer. **These pages are templates, not legal advice. Have them reviewed by a lawyer before going live.**

## Sample content to replace before launch

- The six starter projects, their descriptions and figures, and every image in `img/` (placeholders)
- The six starter roles
- The home-page stats
- The placeholders in the terms and privacy pages

## Browser support

The site targets current Chrome, Edge, Safari and Firefox. The 3D office needs WebGL. Animations respect `prefers-reduced-motion`.

## Credits

- Hosting and content: GitHub Pages + GitHub REST API. Forms: Google Apps Script.
- 3D rendering: [Three.js](https://threejs.org/) r160 (MIT), via jsDelivr
- Fonts: Inter Tight and JetBrains Mono (SIL Open Font License), via Google Fonts
