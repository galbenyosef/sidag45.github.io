/* ==========================================================
   TerpFeed shared code
   Loaded on every page before the page's own script.
   Exposes one global object, TF, with storage, data loading,
   rendering helpers and the shared header/footer.
   ========================================================== */

const TF = (() => {
  const KEYS = {
    user: "tf_user",
    accounts: "tf_accounts",
    follows: "tf_follows",
    saved: "tf_saved",
    rsvps: "tf_rsvps",
    notif: "tf_notif",
    interests: "tf_interests",
  };

  const UMD_EMAIL = /^[a-z0-9._%+-]+@(umd\.edu|terpmail\.umd\.edu)$/i;

  /* ---------- localStorage helpers ---------- */
  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }
  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn("Could not save to localStorage", err);
    }
  }

  /* ---------- User ---------- */
  const getUser = () => read(KEYS.user, null);
  const setUser = (user) => write(KEYS.user, user);
  function logout() {
    localStorage.removeItem(KEYS.user);
    window.location.href = "index.html";
  }
  function requireUser() {
    const user = getUser();
    if (!user) {
      const next = encodeURIComponent(location.pathname.split("/").pop() + location.search);
      window.location.replace(`login.html?next=${next}`);
    }
    return user;
  }
  const getAccounts = () => read(KEYS.accounts, []);
  const saveAccount = (account) => {
    const accounts = getAccounts().filter((a) => a.email !== account.email);
    accounts.push(account);
    write(KEYS.accounts, accounts);
  };

  /* ---------- Follows, saved posts, RSVPs, settings ---------- */
  const getFollows = () => read(KEYS.follows, []);
  const isFollowing = (groupId) => getFollows().includes(groupId);
  function setFollow(groupId, follow) {
    const set = new Set(getFollows());
    follow ? set.add(groupId) : set.delete(groupId);
    write(KEYS.follows, [...set]);
  }
  function toggleFollow(groupId) {
    const next = !isFollowing(groupId);
    setFollow(groupId, next);
    return next;
  }

  const getSaved = () => read(KEYS.saved, []);
  const isSaved = (postId) => getSaved().includes(postId);
  function toggleSaved(postId) {
    const set = new Set(getSaved());
    const next = !set.has(postId);
    next ? set.add(postId) : set.delete(postId);
    write(KEYS.saved, [...set]);
    return next;
  }

  const getRsvps = () => read(KEYS.rsvps, {});
  const getRsvp = (postId) => getRsvps()[postId] || null;
  function setRsvp(postId, status) {
    const all = getRsvps();
    if (status) all[postId] = status;
    else delete all[postId];
    write(KEYS.rsvps, all);
  }

  const getNotif = (groupId) => read(KEYS.notif, {})[groupId] || "all";
  function setNotif(groupId, level) {
    const all = read(KEYS.notif, {});
    all[groupId] = level;
    write(KEYS.notif, all);
  }

  const getInterests = () => read(KEYS.interests, []);
  const setInterests = (list) => write(KEYS.interests, list);

  /* ---------- Data loading ---------- */
  let cache = null;
  async function loadData() {
    if (cache) return cache;
    const [groups, posts] = await Promise.all([
      fetch("data/groups.json").then(checkResponse),
      fetch("data/posts.json").then(checkResponse),
    ]);
    const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));
    cache = { groups, posts, groupById };
    return cache;
  }
  function checkResponse(res) {
    if (!res.ok) throw new Error(`Could not load ${res.url} (${res.status})`);
    return res.json();
  }
  function showLoadError(container, err) {
    console.error(err);
    container.innerHTML = `
      <div class="empty" role="alert">
        <h3>Couldn't load TerpFeed data</h3>
        <p>If you opened this file directly from your computer, run it through a local server
        (for example VS Code Live Server) or the published site instead.</p>
      </div>`;
  }

  /* ---------- Formatting ---------- */
  function escapeHTML(str = "") {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  function initials(name = "") {
    const parts = name.replace(/[^A-Za-z0-9 ]/g, " ").trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const dateFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
  const formatDate = (iso) => dateFmt.format(new Date(iso));
  const formatTime = (iso) => timeFmt.format(new Date(iso));
  function formatEventRange(post) {
    return `${formatDate(post.eventStart)} · ${formatTime(post.eventStart)} to ${formatTime(post.eventEnd)}`;
  }
  function timeAgo(iso) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 0 || diff > 7 * 86400) return formatDate(iso);
    if (diff < 3600) return `${Math.max(1, Math.round(diff / 60))}m ago`;
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
    const days = Math.round(diff / 86400);
    return days === 1 ? "Yesterday" : `${days}d ago`;
  }
  const isUpcoming = (post) => post.type === "event" && new Date(post.eventEnd) > new Date();

  /* Important posts first, then pinned, then newest. */
  function sortPosts(posts) {
    return [...posts].sort((a, b) => {
      if (a.important !== b.important) return a.important ? -1 : 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /* ---------- Shared rendering ---------- */
  function groupIcon(group, size = "") {
    return `<span class="group-icon ${size}" aria-hidden="true">${escapeHTML(initials(group.name))}</span>`;
  }

  function postCard(post, group, { showGroup = true } = {}) {
    const saved = isSaved(post.id);
    const typeLabel = post.type === "event" ? "Event" : "Announcement";
    const event =
      post.type === "event"
        ? `<div class="post__event">
             <span><strong>${escapeHTML(formatEventRange(post))}</strong></span>
             <span class="muted">${escapeHTML(post.location)}</span>
           </div>`
        : "";
    return `
      <article class="card post ${post.important ? "post--important" : ""}" data-post-id="${post.id}">
        <div class="post__head">
          ${showGroup ? groupIcon(group) : ""}
          <div>
            ${showGroup ? `<a class="post__group" href="group.html?id=${group.id}">${escapeHTML(group.name)}</a>` : ""}
            <div class="post__meta">${typeLabel} · ${escapeHTML(timeAgo(post.createdAt))}</div>
          </div>
          <div style="margin-left:auto;display:flex;gap:6px">
            ${post.important ? '<span class="badge badge--accent">Important</span>' : ""}
            ${post.pinned ? '<span class="badge">Pinned</span>' : ""}
          </div>
        </div>
        <h3 class="post__title"><a href="post.html?id=${post.id}">${escapeHTML(post.title)}</a></h3>
        <p class="post__body">${escapeHTML(post.body)}</p>
        ${event}
        <div class="post__actions">
          <button class="link-btn" data-action="save" aria-pressed="${saved}">${saved ? "Saved" : "Save"}</button>
          <a class="link-btn" href="post.html?id=${post.id}">${post.type === "event" ? "RSVP" : "Open"}</a>
        </div>
      </article>`;
  }

  /* One delegated listener handles Save buttons in any list of post cards. */
  function bindPostActions(container, onChange) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest('[data-action="save"]');
      if (!btn) return;
      if (!getUser()) {
        toast("Log in to save posts");
        setTimeout(requireUser, 700);
        return;
      }
      const id = btn.closest("[data-post-id]").dataset.postId;
      const nowSaved = toggleSaved(id);
      btn.setAttribute("aria-pressed", nowSaved);
      btn.textContent = nowSaved ? "Saved" : "Save";
      toast(nowSaved ? "Post saved" : "Removed from saved");
      if (onChange) onChange();
    });
  }

  function followButton(group, extraClass = "btn--sm") {
    const following = isFollowing(group.id);
    return `<button class="btn ${following ? "btn--ghost" : "btn--primary"} ${extraClass}"
              data-follow="${group.id}" aria-pressed="${following}">
              ${following ? "Following" : "Follow"}
            </button>`;
  }
  function bindFollowButtons(container, onChange) {
    container.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-follow]");
      if (!btn) return;
      if (!getUser()) {
        toast("Log in to follow groups");
        setTimeout(requireUser, 700);
        return;
      }
      const id = btn.dataset.follow;
      const nowFollowing = toggleFollow(id);
      container.querySelectorAll(`[data-follow="${id}"]`).forEach((b) => {
        b.setAttribute("aria-pressed", nowFollowing);
        b.textContent = nowFollowing ? "Following" : "Follow";
        b.classList.toggle("btn--primary", !nowFollowing);
        b.classList.toggle("btn--ghost", nowFollowing);
      });
      toast(nowFollowing ? "Following. Posts will show in your feed." : "Unfollowed");
      if (onChange) onChange(id, nowFollowing);
    });
  }

  let toastTimer;
  function toast(message) {
    let el = document.querySelector(".toast");
    if (!el) {
      el = document.createElement("div");
      el.className = "toast";
      el.setAttribute("role", "status");
      el.setAttribute("aria-live", "polite");
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2200);
  }

  /* ---------- Calendar export ---------- */
  function toCalStamp(iso) {
    // Event times in the data are Eastern local times; export them as floating local times.
    return iso.replace(/[-:]/g, "").slice(0, 15);
  }
  function googleCalendarUrl(post, group) {
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: post.title,
      dates: `${toCalStamp(post.eventStart)}/${toCalStamp(post.eventEnd)}`,
      details: `${post.body}\n\nPosted by ${group.name} on TerpFeed.`,
      location: post.location,
      ctz: "America/New_York",
    });
    return `https://calendar.google.com/calendar/render?${params}`;
  }
  function downloadIcs(post, group) {
    const esc = (s) => s.replace(/[\\;,]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TerpFeed//EN",
      "BEGIN:VEVENT",
      `UID:${post.id}@terpfeed`,
      `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`,
      `DTSTART;TZID=America/New_York:${toCalStamp(post.eventStart)}`,
      `DTEND;TZID=America/New_York:${toCalStamp(post.eventEnd)}`,
      `SUMMARY:${esc(post.title)}`,
      `DESCRIPTION:${esc(post.body + " (" + group.name + ")")}`,
      `LOCATION:${esc(post.location)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${post.title.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  /* ---------- Header and footer ---------- */
  function renderHeader() {
    const page = document.body.dataset.page;
    const user = getUser();
    const link = (href, label, key) =>
      `<a href="${href}" ${page === key ? 'aria-current="page"' : ""}>${label}</a>`;

    const actions = user
      ? `<span class="user-chip"><span class="avatar" aria-hidden="true">${escapeHTML(initials(user.name))}</span>
           <span>${escapeHTML(user.name.split(" ")[0])}</span></span>
         <button class="btn btn--ghost btn--sm" id="logout-btn">Log out</button>`
      : `<a class="btn btn--ghost btn--sm" href="login.html">Log in</a>
         <a class="btn btn--primary btn--sm" href="login.html?mode=signup">Sign up</a>`;

    const header = document.createElement("header");
    header.className = "site-header";
    header.innerHTML = `
      <div class="container">
        <a class="logo" href="${user ? "feed.html" : "index.html"}"><span class="logo__mark" aria-hidden="true">T</span>TerpFeed</a>
        <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav">Menu</button>
        <nav class="nav" id="site-nav" aria-label="Main">
          ${link("feed.html", "Feed", "feed")}
          ${link("explore.html", "Explore", "explore")}
          ${link("about.html", "About", "about")}
        </nav>
        <div class="header__actions">${actions}</div>
      </div>`;

    const skip = document.createElement("a");
    skip.className = "skip-link";
    skip.href = "#main";
    skip.textContent = "Skip to content";

    document.body.prepend(header);
    document.body.prepend(skip);

    const toggle = header.querySelector(".menu-toggle");
    toggle.addEventListener("click", () => {
      const open = header.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", open);
      toggle.textContent = open ? "Close" : "Menu";
    });
    const logoutBtn = header.querySelector("#logout-btn");
    if (logoutBtn) logoutBtn.addEventListener("click", logout);
  }

  function renderFooter() {
    const footer = document.createElement("footer");
    footer.className = "site-footer";
    footer.innerHTML = `
      <div class="container">
        <span>TerpFeed · INST630 final project · University of Maryland</span>
        <span><a href="about.html">About</a> · Sample data for demonstration</span>
      </div>`;
    document.body.appendChild(footer);
  }

  document.addEventListener("DOMContentLoaded", () => {
    renderHeader();
    renderFooter();
  });

  return {
    UMD_EMAIL,
    getUser, setUser, logout, requireUser, getAccounts, saveAccount,
    getFollows, isFollowing, setFollow, toggleFollow,
    getSaved, isSaved, toggleSaved,
    getRsvp, setRsvp,
    getNotif, setNotif,
    getInterests, setInterests,
    loadData, showLoadError,
    escapeHTML, initials, formatDate, formatTime, formatEventRange, timeAgo, isUpcoming, sortPosts,
    groupIcon, postCard, bindPostActions, followButton, bindFollowButtons, toast,
    googleCalendarUrl, downloadIcs,
  };
})();
