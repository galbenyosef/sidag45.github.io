/* Onboarding: step 1 picks interests, step 2 follows suggested groups. */
document.addEventListener("DOMContentLoaded", async () => {
  if (!TF.requireUser()) return;

  const interestWrap = document.getElementById("interest-groups");
  let data;
  try {
    data = await TF.loadData();
  } catch (err) {
    TF.showLoadError(interestWrap, err);
    return;
  }

  // Build interest options from the data: course codes, then tags.
  const courses = data.groups.filter((g) => g.courseCode).map((g) => g.courseCode);
  const tags = [...new Set(data.groups.flatMap((g) => g.tags))].sort();
  const sports = tags.filter((t) => ["tennis", "running", "climbing", "sports"].includes(t));
  const other = tags.filter((t) => !sports.includes(t));
  const sections = [
    ["Classes", courses],
    ["Sports and rec", sports],
    ["Interests", other],
  ];

  const selected = new Set(TF.getInterests());
  const label = (t) => (t === t.toUpperCase() ? t : t.replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bUx\b/, "UX").replace(/\bXr\b/, "XR").replace(/\bVr\b/, "VR").replace(/\bAr\b/, "AR").replace(/\bHci\b/, "HCI").replace(/\bHtml\b/, "HTML"));

  interestWrap.innerHTML = sections
    .map(([title, items]) => `
      <div class="interest-group">
        <p class="eyebrow">${title}</p>
        <div class="chips">
          ${items.map((t) => `<button class="chip" data-interest="${TF.escapeHTML(t)}" aria-pressed="${selected.has(t)}">${TF.escapeHTML(label(t))}</button>`).join("")}
        </div>
      </div>`)
    .join("");

  const countEl = document.getElementById("selection-count");
  const updateCount = () => {
    countEl.textContent = step === 1 ? `${selected.size} selected` : `${TF.getFollows().length} following`;
  };

  interestWrap.addEventListener("click", (e) => {
    const chip = e.target.closest("[data-interest]");
    if (!chip) return;
    const t = chip.dataset.interest;
    selected.has(t) ? selected.delete(t) : selected.add(t);
    chip.setAttribute("aria-pressed", selected.has(t));
    updateCount();
  });

  // Step handling
  let step = 1;
  const stepInterests = document.getElementById("step-interests");
  const stepGroups = document.getElementById("step-groups");
  const nextBtn = document.getElementById("next-btn");
  const backBtn = document.getElementById("back-btn");
  const suggested = document.getElementById("suggested");

  function scoreGroup(g) {
    let score = 0;
    if (g.courseCode && selected.has(g.courseCode)) score += 10;
    g.tags.forEach((t) => { if (selected.has(t)) score += 3; });
    return score + g.followers / 1000;
  }

  function renderSuggestions() {
    const ranked = [...data.groups]
      .map((g) => ({ g, s: scoreGroup(g) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 8)
      .map(({ g }) => g);
    suggested.innerHTML = ranked.map((g) => `
      <article class="card group-card">
        <div style="display:flex;gap:10px;align-items:center">
          ${TF.groupIcon(g)}
          <div><strong>${TF.escapeHTML(g.name)}</strong><div class="post__meta">${g.category} · ${g.followers} followers</div></div>
        </div>
        <p class="group-card__desc">${TF.escapeHTML(g.description)}</p>
        <div>${TF.followButton(g)}</div>
      </article>`).join("");
  }
  TF.bindFollowButtons(suggested, updateCount);

  function goTo(n) {
    step = n;
    stepInterests.hidden = n !== 1;
    stepGroups.hidden = n !== 2;
    backBtn.hidden = n === 1;
    document.getElementById("step-label").textContent = `Step ${n} of 2`;
    document.getElementById("progress-bar").style.width = n === 1 ? "50%" : "100%";
    nextBtn.textContent = n === 1 ? "Continue" : "Go to my feed";
    updateCount();
    window.scrollTo({ top: 0 });
  }

  nextBtn.addEventListener("click", () => {
    if (step === 1) {
      if (selected.size === 0) {
        TF.toast("Pick at least one interest to continue");
        return;
      }
      TF.setInterests([...selected]);
      // Auto-follow the classes the student picked.
      data.groups.filter((g) => g.courseCode && selected.has(g.courseCode)).forEach((g) => TF.setFollow(g.id, true));
      renderSuggestions();
      goTo(2);
    } else {
      location.href = "feed.html";
    }
  });
  backBtn.addEventListener("click", () => goTo(1));

  goTo(1);
});
