/* Home feed: posts from followed groups, with view and filter controls. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!TF.requireUser()) return;

  const list = document.getElementById("feed-list");
  const countEl = document.getElementById("feed-count");
  let data;
  try {
    data = await TF.loadData();
  } catch (err) {
    TF.showLoadError(list, err);
    return;
  }

  const state = { view: "all", filter: "all" };

  function matchesFilter(post, group) {
    const f = state.filter;
    if (f === "all") return true;
    if (f === "announcement" || f === "event") return post.type === f;
    return group.category === f;
  }

  function renderFeed() {
    const follows = new Set(TF.getFollows());
    const saved = new Set(TF.getSaved());

    let posts = data.posts.filter((p) => {
      const g = data.groupById[p.groupId];
      if (!g) return false;
      if (state.view === "saved") return saved.has(p.id);
      if (!follows.has(p.groupId)) return false;
      if (state.view === "important" && !p.important) return false;
      return matchesFilter(p, g);
    });
    if (state.view === "saved") posts = posts.filter((p) => matchesFilter(p, data.groupById[p.groupId]));
    posts = TF.sortPosts(posts);

    if (follows.size === 0 && state.view !== "saved") {
      countEl.textContent = "";
      list.innerHTML = `
        <div class="empty">
          <h3>Your feed is empty</h3>
          <p>Follow a few classes, clubs or teams and their updates will show up here.</p>
          <a class="btn btn--primary" href="explore.html">Explore groups</a>
        </div>`;
      return;
    }
    if (posts.length === 0) {
      countEl.textContent = "";
      const msg = state.view === "saved" ? "You haven't saved any posts yet." : "No posts match this filter.";
      list.innerHTML = `<div class="empty"><h3>Nothing here</h3><p>${msg}</p></div>`;
      return;
    }
    countEl.textContent = `${posts.length} ${posts.length === 1 ? "post" : "posts"}`;
    list.innerHTML = posts.map((p) => TF.postCard(p, data.groupById[p.groupId])).join("");
  }

  function renderFollowing() {
    const follows = TF.getFollows();
    const el = document.getElementById("following-list");
    el.innerHTML = follows.length
      ? follows
          .map((id) => data.groupById[id])
          .filter(Boolean)
          .map((g) => `<li><a href="group.html?id=${g.id}">${TF.groupIcon(g)}${TF.escapeHTML(g.name)}</a></li>`)
          .join("")
      : '<li class="muted" style="padding:0 12px;font-size:0.9rem">Not following any groups yet.</li>';
  }

  function renderUpcoming() {
    const follows = new Set(TF.getFollows());
    const events = data.posts
      .filter((p) => follows.has(p.groupId) && TF.isUpcoming(p))
      .sort((a, b) => new Date(a.eventStart) - new Date(b.eventStart))
      .slice(0, 4);
    const el = document.getElementById("upcoming");
    if (!events.length) {
      el.innerHTML = '<p class="muted" style="margin:0;font-size:0.9rem">No upcoming events from groups you follow.</p>';
      return;
    }
    el.innerHTML = events.map((p) => {
      const d = new Date(p.eventStart);
      const mon = d.toLocaleString("en-US", { month: "short" });
      return `
        <a class="event-row" href="post.html?id=${p.id}">
          <span class="date-pill">${mon}<strong>${d.getDate()}</strong></span>
          <span><strong style="display:block;font-size:0.92rem;line-height:1.3">${TF.escapeHTML(p.title)}</strong>
          <span class="post__meta">${TF.escapeHTML(data.groupById[p.groupId].name)} · ${TF.formatTime(p.eventStart)}</span></span>
        </a>`;
    }).join("");
  }

  function renderSuggestions() {
    const follows = new Set(TF.getFollows());
    const interests = new Set(TF.getInterests());
    const picks = data.groups
      .filter((g) => !follows.has(g.id))
      .map((g) => ({ g, s: g.tags.filter((t) => interests.has(t)).length * 1000 + g.followers }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(({ g }) => g);
    const el = document.getElementById("suggestions");
    el.innerHTML = picks.length
      ? picks.map((g) => `
          <div class="mini-group">
            ${TF.groupIcon(g)}
            <div class="mini-group__text">
              <a class="mini-group__name" href="group.html?id=${g.id}">${TF.escapeHTML(g.name)}</a>
              <span class="post__meta">${g.category}</span>
            </div>
            ${TF.followButton(g)}
          </div>`).join("")
      : '<p class="muted" style="margin:0;font-size:0.9rem">You follow every group. Nice.</p>';
  }

  function renderAll() {
    renderFeed();
    renderFollowing();
    renderUpcoming();
    renderSuggestions();
  }

  // View buttons (sidebar)
  document.getElementById("views").addEventListener("click", (e) => {
    const btn = e.target.closest("[data-view]");
    if (!btn) return;
    state.view = btn.dataset.view;
    document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b === btn));
    renderFeed();
  });

  // Filter chips
  document.getElementById("filters").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-filter]");
    if (!chip) return;
    state.filter = chip.dataset.filter;
    document.querySelectorAll("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", c === chip));
    renderFeed();
  });

  TF.bindPostActions(list, () => { if (state.view === "saved") renderFeed(); });
  TF.bindFollowButtons(document.getElementById("suggestions"), () => setTimeout(renderAll, 300));

  renderAll();
});
