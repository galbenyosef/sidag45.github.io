/* Post detail: full post, plus RSVP and add-to-calendar for events. */
document.addEventListener("DOMContentLoaded", async () => {
  const root = document.getElementById("post-root");
  let data;
  try {
    data = await TF.loadData();
  } catch (err) {
    TF.showLoadError(root, err);
    return;
  }

  const id = new URLSearchParams(location.search).get("id");
  const post = data.posts.find((p) => p.id === id);
  const group = post && data.groupById[post.groupId];
  if (!post || !group) {
    root.innerHTML = `
      <div class="empty">
        <h3>Post not found</h3>
        <p>This post doesn't exist or may have been removed.</p>
        <a class="btn btn--primary" href="feed.html">Back to your feed</a>
      </div>`;
    return;
  }
  document.title = `${post.title} · TerpFeed`;
  const isEvent = post.type === "event";
  const isPast = isEvent && !TF.isUpcoming(post);

  const sidebar = isEvent
    ? `<aside class="card rsvp-card">
         <h3 style="font-family:var(--font-body);font-size:1.1rem;line-height:1.3">${TF.escapeHTML(TF.formatEventRange(post))}</h3>
         <p class="muted" style="margin-bottom:6px">${TF.escapeHTML(post.location)}</p>
         <p class="muted" id="rsvp-count" aria-live="polite"></p>
         ${isPast
           ? '<p class="muted">This event has ended.</p>'
           : `<button class="btn btn--primary btn--block" id="rsvp-going" aria-pressed="false">RSVP: Going</button>
              <button class="btn btn--ghost btn--block" id="rsvp-interested" aria-pressed="false">Interested</button>`}
         <hr>
         <p class="eyebrow">Add to calendar</p>
         <div class="cal-buttons">
           <a class="btn btn--ghost btn--sm" href="${TF.googleCalendarUrl(post, group)}" target="_blank" rel="noopener">Google</a>
           <button class="btn btn--ghost btn--sm" id="ics-btn">Outlook (.ics)</button>
         </div>
       </aside>`
    : `<aside class="card widget">
         <h3>Posted by</h3>
         <div class="mini-group">
           ${TF.groupIcon(group)}
           <div class="mini-group__text">
             <a class="mini-group__name" href="group.html?id=${group.id}">${TF.escapeHTML(group.name)}</a>
             <span class="post__meta">${group.category}</span>
           </div>
         </div>
         ${TF.followButton(group, "btn--sm btn--block")}
       </aside>`;

  root.innerHTML = `
    <a class="back-link" href="group.html?id=${group.id}">← ${TF.escapeHTML(group.name)}</a>
    <div class="two-col">
      <article class="post-detail" data-post-id="${post.id}">
        ${isEvent ? '<div class="post-detail__hero" aria-hidden="true"></div>' : ""}
        <p class="eyebrow">${TF.escapeHTML(group.name)} · ${isEvent ? "Event" : "Announcement"} · ${TF.escapeHTML(TF.timeAgo(post.createdAt))}
          ${post.important ? ' <span class="badge badge--accent">Important</span>' : ""}</p>
        <h1>${TF.escapeHTML(post.title)}</h1>
        <p class="post-detail__body">${TF.escapeHTML(post.body)}</p>
        <div class="post__actions">
          <button class="link-btn" data-action="save" aria-pressed="${TF.isSaved(post.id)}">${TF.isSaved(post.id) ? "Saved" : "Save"}</button>
          <button class="link-btn" id="share-btn">Copy link</button>
          <button class="link-btn" id="report-btn">Report</button>
        </div>
      </article>
      ${sidebar}
    </div>`;

  TF.bindPostActions(root.querySelector(".post-detail"));
  TF.bindFollowButtons(root);

  document.getElementById("share-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      TF.toast("Link copied");
    } catch {
      TF.toast("Copy failed. Copy the address bar instead.");
    }
  });
  document.getElementById("report-btn").addEventListener("click", () => TF.toast("Thanks. A moderator will review this post."));

  if (!isEvent) return;

  document.getElementById("ics-btn").addEventListener("click", () => {
    TF.downloadIcs(post, group);
    TF.toast("Calendar file downloaded");
  });

  if (isPast) {
    document.getElementById("rsvp-count").textContent = `${post.rsvpCount} went`;
    return;
  }

  const going = document.getElementById("rsvp-going");
  const interested = document.getElementById("rsvp-interested");

  function renderRsvp() {
    const status = TF.getRsvp(post.id);
    going.setAttribute("aria-pressed", status === "going");
    interested.setAttribute("aria-pressed", status === "interested");
    going.textContent = status === "going" ? "Going ✓ (tap to cancel)" : "RSVP: Going";
    interested.textContent = status === "interested" ? "Interested ✓" : "Interested";
    going.classList.toggle("btn--primary", status !== "going");
    going.classList.toggle("btn--ghost", status === "going");
    const count = post.rsvpCount + (status === "going" ? 1 : 0);
    document.getElementById("rsvp-count").textContent = `${count} going`;
  }

  function choose(value) {
    if (!TF.getUser()) {
      TF.toast("Log in to RSVP");
      setTimeout(TF.requireUser, 700);
      return;
    }
    const current = TF.getRsvp(post.id);
    const next = current === value ? null : value;
    TF.setRsvp(post.id, next);
    renderRsvp();
    TF.toast(next === "going" ? "You're going. Add it to your calendar below." : next === "interested" ? "Marked as interested" : "RSVP removed");
  }

  going.addEventListener("click", () => choose("going"));
  interested.addEventListener("click", () => choose("interested"));
  renderRsvp();
});
