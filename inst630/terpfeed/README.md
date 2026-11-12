# TerpFeed

A responsive web app for UMD students: follow the classes, clubs, sports teams and interest groups you care about, and see every update in one low-noise feed.

INST630 final project · University of Maryland

## Pages

| Page | File | What it does |
|---|---|---|
| Landing | `index.html` | Introduces TerpFeed; sign-up call to action |
| About | `about.html` | Mission and how the app works |
| Sign up / Log in | `login.html` | UMD email validation (@umd.edu, @terpmail.umd.edu) |
| Onboarding | `onboarding.html` | Pick interests, then follow suggested groups |
| Home feed | `feed.html` | Posts from followed groups; views (All, Important, Saved) and filters |
| Explore | `explore.html` | Live search by name or course code, category filter, follow/unfollow |
| Group page | `group.html?id=...` | Group details, pinned and recent posts, events, notification level |
| Post detail | `post.html?id=...` | Full post, RSVP, add to Google Calendar or download an .ics for Outlook |

## How it works

- **Data:** sample groups and posts live in `data/groups.json` and `data/posts.json` and are loaded with `fetch()`.
- **State:** the signed-in user, follows, saved posts, RSVPs and notification settings are stored in `localStorage`. There is no server, so accounts exist only in the browser that created them.
- **Shared code:** `js/app.js` builds the header and footer on every page and holds the storage, data loading, rendering and calendar helpers. Each page has its own script in `js/`.
- **Design:** `#0C0C0C` background, `#F5F3F3` text, `#F20018` accent. Headings use Agdasima (Google Fonts). Body text uses InaiMathi where installed (macOS) and falls back to the system font.

## Run locally

`fetch()` doesn't work when you open the HTML files straight from your computer (`file://`). Use a local server:

- **VS Code:** install the Live Server extension, right-click `index.html` and choose **Open with Live Server**.
- **Terminal:** run `python3 -m http.server 8000` in this folder and open http://localhost:8000.

## Deploy to GitHub Pages

1. Create a new public repository on GitHub, for example `terpfeed`.
2. Upload every file and folder in this project to the repository root (drag them into **Add file → Upload files**, or push with git).
3. In the repository, go to **Settings → Pages**.
4. Under **Build and deployment**, set **Source** to **Deploy from a branch**, choose the `main` branch and the `/ (root)` folder, and click **Save**.
5. After a minute or two the site is live at `https://<your-username>.github.io/terpfeed/`.

With git:

```bash
git init
git add .
git commit -m "TerpFeed checkpoint"
git branch -M main
git remote add origin https://github.com/<your-username>/terpfeed.git
git push -u origin main
```

## Try it

1. Sign up with any address ending in `@umd.edu` or `@terpmail.umd.edu` (no email is sent).
2. Pick a few interests, follow some suggested groups, and open your feed.
3. Try the filters, save a post, search Explore for `INST631`, and RSVP to an event.

To reset, clear the site's data in your browser (DevTools → Application → Local Storage).
