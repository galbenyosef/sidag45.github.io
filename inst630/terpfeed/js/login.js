/* Sign up / log in: validates a UMD email and password, then stores the user. */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  // Only allow redirects to pages on this site, e.g. "group.html?id=ux-club".
  const rawNext = params.get("next") || "";
  const next = /^[a-z]+\.html(\?[\w=&.-]*)?$/i.test(rawNext) ? rawNext : null;
  let mode = params.get("mode") === "login" ? "login" : "signup";

  // Already signed in? Skip the form.
  if (TF.getUser()) {
    location.replace(next || "feed.html");
    return;
  }

  const form = document.getElementById("auth-form");
  const fields = {
    name: document.getElementById("name"),
    email: document.getElementById("email"),
    password: document.getElementById("password"),
  };
  const status = document.getElementById("form-status");
  const tabs = { signup: document.getElementById("tab-signup"), login: document.getElementById("tab-login") };

  function setMode(newMode) {
    mode = newMode;
    const signup = mode === "signup";
    tabs.signup.setAttribute("aria-selected", signup);
    tabs.login.setAttribute("aria-selected", !signup);
    document.getElementById("name-field").hidden = !signup;
    document.getElementById("auth-title").textContent = signup ? "Create your feed" : "Welcome back";
    document.getElementById("auth-sub").textContent = signup
      ? "Sign up with your UMD email to follow classes, clubs and teams."
      : "Log in with the UMD email you signed up with.";
    document.getElementById("submit-btn").textContent = signup ? "Sign up" : "Log in";
    fields.password.autocomplete = signup ? "new-password" : "current-password";
    document.getElementById("password-hint").hidden = !signup;
    clearErrors();
  }

  function setError(name, message) {
    const input = fields[name];
    document.getElementById(`${name}-error`).textContent = message;
    input.setAttribute("aria-invalid", message ? "true" : "false");
  }
  function clearErrors() {
    Object.keys(fields).forEach((k) => setError(k, ""));
    status.hidden = true;
  }

  function validate() {
    let ok = true;
    const name = fields.name.value.trim();
    const email = fields.email.value.trim().toLowerCase();
    const password = fields.password.value;

    if (mode === "signup") {
      if (!name) { setError("name", "Enter your name."); ok = false; }
      else if (name.length < 2) { setError("name", "Name must be at least 2 characters."); ok = false; }
      else setError("name", "");
    }

    if (!email) { setError("email", "Enter your UMD email."); ok = false; }
    else if (!TF.UMD_EMAIL.test(email)) {
      setError("email", "Use a UMD address ending in @umd.edu or @terpmail.umd.edu.");
      ok = false;
    } else setError("email", "");

    if (!password) { setError("password", "Enter a password."); ok = false; }
    else if (mode === "signup" && (password.length < 8 || !/\d/.test(password))) {
      setError("password", "Use at least 8 characters, including a number.");
      ok = false;
    } else setError("password", "");

    return ok ? { name, email } : null;
  }

  // Re-check a field as soon as the user leaves it.
  Object.values(fields).forEach((input) => input.addEventListener("blur", () => {
    if (input.value) validate();
  }));

  tabs.signup.addEventListener("click", () => setMode("signup"));
  tabs.login.addEventListener("click", () => setMode("login"));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    status.hidden = true;
    const data = validate();
    if (!data) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }

    const existing = TF.getAccounts().find((a) => a.email === data.email);
    if (mode === "signup") {
      if (existing) {
        status.textContent = "An account with this email already exists. Log in instead.";
        status.hidden = false;
        return;
      }
      const user = { name: data.name, email: data.email, joined: new Date().toISOString() };
      TF.saveAccount(user);
      TF.setUser(user);
      location.href = "onboarding.html";
    } else {
      if (!existing) {
        status.textContent = "No account found for that email in this browser. Sign up first.";
        status.hidden = false;
        return;
      }
      TF.setUser(existing);
      location.href = next || "feed.html";
    }
  });

  setMode(mode);
});
