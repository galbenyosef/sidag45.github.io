/* Explore: live search plus category filter, with follow buttons. */
document.addEventListener("DOMContentLoaded", async () => {
  const results = document.getElementById("results");
  const countEl = document.getElementById("results-count");
  const input = document.getElementById("search");

  let data;
  try {
    data = await TF.loadData();
  } catch (err) {
    TF.showLoadError(results, err);
    return;
  }

  const params = new URLSearchParams(location.search);
  const state = { q: params.get("q") || "", category: params.get("category") || "all" };
  input.value = state.q;

  // Normalize so "inst 630", "INST630" and "inst630" all match.
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, "");

  function matches(g) {
    if (state.category !== "all" && g.category !== state.category) return false;
    const q = normalize(state.q.trim());
    if (!q) return true;
    const haystack = [g.name, g.fullName || "", g.courseCode || "", g.category, ...g.tags].map(normalize).join("|");
    return haystack.includes(q);
  }

  function render() {
    const found = data.groups.filter(matches).sort((a, b) => b.followers - a.followers);
    const label = state.q.trim() ? ` for "${state.q.trim()}"` : "";
    countEl.textContent = `${found.length} ${found.length === 1 ? "group" : "groups"}${label}`;

    if (!found.length) {
      results.innerHTML = `
        <div class="empty" style="grid-column:1/-1">
          <h3>No groups found</h3>
          <p>Try a different name or course code, or clear the category filter.</p>
          <button class="btn btn--ghost btn--sm" id="clear-search">Clear search</button>
        </div>`;
      document.getElementById("clear-search").addEventListener("click", () => {
        state.q = "";
        input.value = "";
        setCategory("all");
      });
      return;
    }

    results.innerHTML = found.map((g) => `
      <article class="card group-card">
        <div class="group-card__cover">${g.verified ? '<span class="badge badge--verified">Verified class</span>' : `<span class="badge">${g.category}</span>`}</div>
        <a class="group-card__name" href="group.html?id=${g.id}">${TF.escapeHTML(g.name)}</a>
        <span class="post__meta">${g.category} · ${g.followers.toLocaleString()} followers</span>
        <p class="group-card__desc">${TF.escapeHTML(g.description)}</p>
        <div class="group-card__foot">
          ${TF.followButton(g)}
          <a class="link-btn" href="group.html?id=${g.id}">View</a>
        </div>
      </article>`).join("");
  }

  function updateUrl() {
    const p = new URLSearchParams();
    if (state.q.trim()) p.set("q", state.q.trim());
    if (state.category !== "all") p.set("category", state.category);
    const qs = p.toString();
    history.replaceState(null, "", qs ? `?${qs}` : location.pathname);
  }

  function setCategory(cat) {
    state.category = cat;
    document.querySelectorAll("[data-category]").forEach((c) => c.setAttribute("aria-pressed", c.dataset.category === cat));
    updateUrl();
    render();
  }

  let debounce;
  input.addEventListener("input", () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.q = input.value;
      updateUrl();
      render();
    }, 150);
  });

  document.getElementById("categories").addEventListener("click", (e) => {
    const chip = e.target.closest("[data-category]");
    if (chip) setCategory(chip.dataset.category);
  });

  TF.bindFollowButtons(results);
  setCategory(state.category);
});
