/* Group page: details, follow, notification level, pinned and recent posts. */
document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("group-root");
  let data;
  try {
    data = await TF.loadData();
  } catch (err) {
    TF.showLoadError(root, err);
    return;
  }

  const id = new URLSearchParams(location.search).get("id");
  const group = data.groupById[id];
  if (!group) {
    root.innerHTML = `
      <div class="empty">
        <h3>Group not found</h3>
        <p>This group doesn't exist or may have been removed.</p>
        <a class="btn btn--primary" href="explore.html">Explore groups</a>
      </div>`;
    return;
  }
  document.title = `${group.name} · TerpFeed`;

  const posts = data.posts.filter((p) => p.groupId === group.id);
  const pinned = TF.sortPosts(posts.filter((p) => p.pinned));
  const recent = TF.sortPosts(posts.filter((p) => !p.pinned));
  const upcoming = posts
    .filter(TF.isUpcoming)
    .sort((a, b) => new Date(a.eventStart) - new Date(b.eventStart));

  const notif = TF.getNotif(group.id);
  const notifOption = (value, label) => `<option value="${value}" ${notif === value ? "selected" : ""}>${label}</option>`;
  const postList = (list, empty) =>
    list.length
      ? `<div class="feed-list">${list.map((p) => TF.postCard(p, group, { showGroup: false })).join("")}</div>`
      : `<p class="muted">${empty}</p>`;

  root.innerHTML = `
    <div class="group-cover" aria-hidden="true"></div>
    <div class="group-header">
      ${TF.groupIcon(group, "group-icon--lg")}
      <div class="group-header__text">
        <h1>${TF.escapeHTML(group.name)}</h1>
        <div class="muted">
          ${group.fullName ? TF.escapeHTML(group.fullName) + " · " : ""}${group.category} ·
          <span id="follower-count">${group.followers.toLocaleString()}</span> followers ·
          ${group.admins.length} ${group.admins.length === 1 ? "admin" : "admins"}
          ${group.verified ? ' <span class="badge badge--verified">Verified class</span>' : ""}
        </div>
      </div>
      <div class="group-header__actions">
        <label>
          <span class="sr-only">Notifications for this group</span>
          <select id="notif" ${TF.isFollowing(group.id) ? "" : "disabled"} title="Notifications">
            ${notifOption("all", "Notifications: All")}
            ${notifOption("important", "Notifications: Important only")}
            ${notifOption("mute", "Notifications: Mute")}
          </select>
        </label>
        ${TF.followButton(group, "")}
      </div>
    </div>

    <div class="two-col">
      <section aria-label="Posts" id="group-posts">
        ${pinned.length ? `<p class="eyebrow section-label">Pinned</p>${postList(pinned, "")}` : ""}
        <p class="eyebrow section-label">Recent</p>
        ${postList(recent, "No posts yet.")}
      </section>

      <aside>
        <section class="card widget">
          <h3>About</h3>
          <p class="muted" style="margin:0">${TF.escapeHTML(group.description)}</p>
        </section>
        <section class="card widget">
          <h3>Upcoming events</h3>
          ${upcoming.length
            ? upcoming.map((p) => `
                <a class="event-row" href="post.html?id=${p.id}">
                  <span class="date-pill">${new Date(p.eventStart).toLocaleString("en-US", { month: "short" })}<strong>${new Date(p.eventStart).getDate()}</strong></span>
                  <span><strong style="display:block;font-size:0.92rem">${TF.escapeHTML(p.title)}</strong>
                  <span class="post__meta">${TF.formatTime(p.eventStart)}</span></span>
                </a>`).join("")
            : '<p class="muted" style="margin:0;font-size:0.9rem">No upcoming events.</p>'}
        </section>
        <section class="card widget">
          <h3>Admins</h3>
          <ul class="admin-list">
            ${group.admins.map((a) => `<li><span class="avatar" aria-hidden="true">${TF.initials(a)}</span>${TF.escapeHTML(a)}</li>`).join("")}
          </ul>
        </section>
        <button class="link-btn" id="report-btn" style="margin-top:16px">Report group</button>
      </aside>
    </div>`;

  // Follow changes the follower count and enables notification settings.
  const notifSelect = document.getElementById("notif");
  TF.bindFollowButtons(root, (gid, following) => {
    document.getElementById("follower-count").textContent = (group.followers + (following ? 1 : 0)).toLocaleString();
    notifSelect.disabled = !following;
  });
  if (TF.isFollowing(group.id)) {
    document.getElementById("follower-count").textContent = (group.followers + 1).toLocaleString();
  }

  notifSelect.addEventListener("change", () => {
    TF.setNotif(group.id, notifSelect.value);
    const labels = { all: "all posts", important: "Important posts only", mute: "nothing (muted)" };
    TF.toast(`You'll be notified about ${labels[notifSelect.value]}`);
  });

  TF.bindPostActions(document.getElementById("group-posts"));

  document.getElementById("report-btn").addEventListener("click", () => {
    TF.toast("Thanks. A moderator will review this group.");
  });
});
