/* Optional Supabase authentication. No passwords are stored by this page. */
(() => {
  "use strict";

  // Authentication configuration and page elements.
  const config = window.ADIB_SUPABASE_CONFIG || {};
  const isConfigured =
    /^https:\/\//i.test(config.url || "") &&
    Boolean(config.anonKey && config.anonKey.trim());
  const backdrop = document.querySelector("#auth-backdrop");
  const standalonePage = document.body.classList.contains("signin-body");
  const modal = document.querySelector("#auth-modal");
  const closeButton = document.querySelector("#auth-close");
  const formView = document.querySelector("#auth-form-view");
  const accountView = document.querySelector("#auth-account-view");
  const form = document.querySelector("#auth-form");
  const emailInput = document.querySelector("#auth-email");
  const passwordInput = document.querySelector("#auth-password");
  const confirmField = document.querySelector("#auth-confirm-field");
  const confirmInput = document.querySelector("#auth-confirm-password");
  const accountNote = document.querySelector(".auth-account-note");
  const passwordWrap = document.querySelector(".auth-password-wrap");
  const emailField = emailInput?.closest(".auth-field");
  const tabs = [...document.querySelectorAll("[data-auth-mode]")];
  const title = document.querySelector("#auth-title");
  const eyebrow = document.querySelector("#auth-eyebrow");
  const subtitle = document.querySelector("#auth-subtitle");
  const submitLabel = document.querySelector("#auth-submit-label");
  const submitButton = document.querySelector("#auth-submit");
  const forgotButton = document.querySelector("#auth-forgot");
  const separator = document.querySelector(".auth-separator");
  const socials = document.querySelector(".auth-socials");
  const configNote = document.querySelector("#auth-config-note");
  const legalNote = document.querySelector(".auth-legal");
  const status = document.querySelector("#auth-status");
  const accountStatus = document.querySelector("#auth-account-status");
  const accountEmail = document.querySelector("#auth-account-email");
  const accountTitle = document.querySelector("#auth-account-title");
  const passwordHint = document.querySelector("#auth-password-hint");
  const signOutButton = document.querySelector("#auth-signout");
  const triggers = [...document.querySelectorAll("[data-auth-open]")];
  let client = null;
  let authMode = "signin";
  let currentUser = null;
  let currentAuthSource = "supabase";
  let lastFocused = null;
  let busy = false;
  let wasRecoveryCallback = false;

  if (!backdrop || !modal || !form || !emailInput || !passwordInput) return;

  if (isConfigured && window.supabase?.createClient) {
    try {
      client = window.supabase.createClient(
        config.url.trim(),
        config.anonKey.trim(),
        {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true,
          },
        },
      );
    } catch (error) {
      console.error("Supabase client could not be initialized.", error);
    }
  }

  if (client) {
    configNote.textContent =
      "Connected to Supabase Auth. Your password is sent to the authentication provider; this page does not save it.";
    configNote.classList.add("is-connected");
    if (legalNote)
      legalNote.textContent =
        "By continuing, you agree to use this site responsibly. Supabase Auth manages the identity; this static page never stores your password.";
  } else if (isConfigured) {
    configNote.textContent =
      "Supabase settings are present, but the authentication client could not start. Check the CDN, project URL, and public client key. Local demo mode is paused so you do not accidentally create a local-only account.";
    configNote.classList.add("is-warning");
    if (legalNote)
      legalNote.textContent =
        "Authentication is not ready. Check the Supabase configuration and library connection before using sign-in.";
  } else {
    configNote.textContent =
      "You can create an account and sign in in this browser to test the interface. Do not use a real or reused password. Connect Supabase for secure hosted accounts, verified email, password recovery, and OAuth.";
    configNote.classList.add("is-demo");
    if (legalNote)
      legalNote.textContent =
        "LOCAL DEMO ONLY · Account data stays in this browser and is not suitable for private data or production use. Connect Supabase before publishing member authentication.";
  }

  const getRedirectUrl = () => window.location.href.split(/[?#]/)[0];
  const DEMO_USERS_KEY = "adib-demo-accounts-v1";
  const DEMO_SESSION_KEY = "adib-demo-session-v1";
  const DEMO_HASH_ITERATIONS = 120000;

  // Local demo credentials are only for interface testing; use Supabase for production.
  function readDemoUsers() {
    try {
      const parsed = JSON.parse(localStorage.getItem(DEMO_USERS_KEY) || "[]");
      return Array.isArray(parsed)
        ? parsed.filter(
            (user) =>
              user &&
              typeof user.email === "string" &&
              user.salt &&
              user.verifier,
          )
        : [];
    } catch (_) {
      return [];
    }
  }

  function bytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i++)
      binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  }

  async function deriveDemoVerifier(
    password,
    salt,
    iterations = DEMO_HASH_ITERATIONS,
  ) {
    if (!window.crypto?.subtle)
      throw new Error(
        "This browser does not support the demo credential check. Open the site through localhost or HTTPS, then try again.",
      );
    const key = await window.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(password),
      "PBKDF2",
      false,
      ["deriveBits"],
    );
    const bits = await window.crypto.subtle.deriveBits(
      { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
      key,
      256,
    );
    return new Uint8Array(bits);
  }

  function constantTimeEqual(left, right) {
    if (left.length !== right.length) return false;
    let difference = 0;
    for (let i = 0; i < left.length; i++) difference |= left[i] ^ right[i];
    return difference === 0;
  }

  async function makeDemoCredential(password) {
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const verifier = await deriveDemoVerifier(password, salt);
    return {
      salt: bytesToBase64(salt),
      verifier: bytesToBase64(verifier),
      iterations: DEMO_HASH_ITERATIONS,
    };
  }

  async function verifyDemoCredential(password, user) {
    const salt = base64ToBytes(user.salt);
    const expected = base64ToBytes(user.verifier);
    const actual = await deriveDemoVerifier(
      password,
      salt,
      Number(user.iterations) || DEMO_HASH_ITERATIONS,
    );
    return constantTimeEqual(actual, expected);
  }

  function saveDemoUsers(users) {
    try {
      localStorage.setItem(DEMO_USERS_KEY, JSON.stringify(users));
      return true;
    } catch (_) {
      return false;
    }
  }

  // Accessible status messages for form feedback.
  function setMessage(message, type = "") {
    status.textContent = message;
    status.className = `auth-status${type ? ` is-${type}` : ""}`;
    status.hidden = !message;
  }

  function setAccountMessage(message, type = "") {
    accountStatus.textContent = message;
    accountStatus.className = `auth-status${type ? ` is-${type}` : ""}`;
    accountStatus.hidden = !message;
  }

  function syncHeader(user) {
    triggers.forEach((trigger) => {
      const label = trigger.querySelector(".header-auth-label");
      if (label) label.textContent = user ? "ACCOUNT" : "SIGN IN";
      trigger.setAttribute(
        "aria-label",
        user
          ? `Account: ${user.email || "signed in"}`
          : "Sign in to member access",
      );
      trigger.classList.toggle("is-authenticated", Boolean(user));
    });
  }

  function renderAccount(user, source = "supabase") {
    currentUser = user || null;
    currentAuthSource = currentUser ? source : "supabase";
    const signedIn = Boolean(currentUser);
    formView.hidden = signedIn;
    accountView.hidden = !signedIn;
    if (signedIn) {
      accountEmail.textContent = currentUser.email || "Authenticated account";
      accountTitle.innerHTML = "You\u2019re <em>in.</em>";
      if (accountNote) {
        accountNote.textContent =
          currentAuthSource === "demo"
            ? "This is a local demo session stored in this browser only. It is not an online account, cannot be used on another device, and must not be used for real passwords or private data."
            : "Your identity is authenticated by Supabase. The public portfolio remains open; account-only features can be added when there is something worth keeping private.";
      }
      setAccountMessage(
        currentAuthSource === "demo"
          ? "Local demo session active."
          : "Your session is active.",
        "success",
      );
    }
    syncHeader(currentUser);
  }

  function configureMode(nextMode, shouldFocus = false) {
    authMode = nextMode;
    const recovery = nextMode === "recovery";
    const signup = nextMode === "signup";
    tabs.forEach((tab) => {
      const active = tab.dataset.authMode === nextMode;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    document.querySelector(".auth-tabs").hidden = recovery;
    emailField.hidden = recovery;
    emailInput.required = !recovery;
    emailInput.disabled = recovery;
    emailInput.autocomplete = "email";
    passwordInput.autocomplete =
      signup || recovery ? "new-password" : "current-password";
    const needsConfirmation = signup || recovery;
    confirmField.hidden = !needsConfirmation;
    confirmInput.disabled = !needsConfirmation;
    confirmInput.required = needsConfirmation;
    confirmInput.autocomplete = "new-password";
    confirmInput.value = "";
    forgotButton.hidden = signup || recovery;
    separator.hidden = recovery || !client;
    socials.hidden = recovery || !client;
    passwordHint.textContent = recovery
      ? "Choose a new password (8+ characters)."
      : signup
        ? "Use at least 8 characters."
        : "Use your account password.";

    if (recovery) {
      eyebrow.textContent = "ACCOUNT RECOVERY";
      title.innerHTML = "A fresh <em>start.</em>";
      subtitle.textContent =
        "Choose a new password for your account. The update is handled securely by Supabase Auth.";
      submitLabel.textContent = "UPDATE PASSWORD";
    } else if (signup) {
      eyebrow.textContent = "MAKE ROOM FOR NEW IDEAS";
      title.innerHTML = "Create your <em>space.</em>";
      subtitle.textContent = client
        ? "Create an account for future experiments. Email confirmation may be required by the provider."
        : "Create a test account for this browser only. Never use a real or reused password in demo mode.";
      submitLabel.textContent = "CREATE ACCOUNT";
    } else {
      eyebrow.textContent = "GOOD TO SEE YOU AGAIN";
      title.innerHTML = "Welcome <em>back.</em>";
      subtitle.textContent = client
        ? "Sign in to your workspace. Supabase Auth manages your identity and password."
        : "Sign in to a local demo account stored in this browser. Connect Supabase for real hosted accounts.";
      submitLabel.textContent = "SIGN IN";
    }
    passwordInput.value = "";
    confirmInput.value = "";
    setMessage("");
    if (shouldFocus)
      (recovery ? passwordInput : signup ? emailInput : emailInput).focus();
  }

  // Modal controls are used only if authentication is embedded on another page.
  function openAuth() {
    lastFocused = document.activeElement;
    if (window.adibLenis) window.adibLenis.stop();
    backdrop.hidden = false;
    document.body.classList.add("auth-open");
    if (currentUser) renderAccount(currentUser, currentAuthSource);
    else if (!wasRecoveryCallback) configureMode("signin");
    if (
      window.gsap &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.gsap.fromTo(
        backdrop,
        { autoAlpha: 0, backdropFilter: "blur(0px)" },
        {
          autoAlpha: 1,
          backdropFilter: "blur(16px)",
          duration: 0.28,
          ease: "power2.out",
          overwrite: true,
        },
      );
      window.gsap.fromTo(
        modal,
        {
          y: 38,
          opacity: 0,
          rotateX: -3,
          scale: 0.975,
          transformPerspective: 1200,
        },
        {
          y: 0,
          opacity: 1,
          rotateX: 0,
          scale: 1,
          duration: 0.68,
          ease: "power4.out",
          overwrite: true,
        },
      );
      window.gsap.fromTo(
        ".auth-visual-copy > *, .auth-heading > *, .auth-tabs, .auth-field, .auth-submit, .auth-social, .auth-legal",
        { y: 14, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.46,
          stagger: 0.035,
          delay: 0.12,
          ease: "power3.out",
          overwrite: true,
        },
      );
      window.gsap.to(".auth-art-ring-1", {
        rotation: 360,
        transformOrigin: "50% 50%",
        duration: 24,
        repeat: -1,
        ease: "none",
      });
      window.gsap.to(".auth-art-ring-2", {
        rotation: -360,
        transformOrigin: "50% 50%",
        duration: 18,
        repeat: -1,
        ease: "none",
      });
      window.gsap.fromTo(
        ".auth-orbit-art path",
        { strokeDasharray: "130 700", strokeDashoffset: 130 },
        { strokeDashoffset: -700, duration: 7, repeat: -1, ease: "none" },
      );
    }
    window.setTimeout(() => {
      if (!backdrop.hidden) (currentUser ? signOutButton : emailInput).focus();
    }, 30);
  }

  function closeAuth() {
    if (backdrop.hidden) return;
    const finish = () => {
      if (window.gsap)
        window.gsap.killTweensOf(
          ".auth-art-ring-1, .auth-art-ring-2, .auth-orbit-art path",
        );
      backdrop.hidden = true;
      document.body.classList.remove("auth-open");
      if (lastFocused && typeof lastFocused.focus === "function")
        lastFocused.focus();
      if (window.adibLenis) window.adibLenis.start();
    };
    if (
      window.gsap &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      window.gsap
        .timeline({ onComplete: finish })
        .to(modal, {
          y: 20,
          scale: 0.985,
          opacity: 0,
          duration: 0.22,
          ease: "power2.in",
        })
        .to(backdrop, { autoAlpha: 0, duration: 0.2, ease: "power2.in" }, 0.04);
    } else finish();
  }

  if (!standalonePage)
    triggers.forEach((trigger) =>
      trigger.addEventListener("click", () => {
        if (trigger.classList.contains("nav-auth")) {
          document
            .querySelector("#primary-navigation")
            ?.classList.remove("is-open");
          document
            .querySelector("#menu-toggle")
            ?.setAttribute("aria-expanded", "false");
        }
        openAuth();
      }),
    );
  if (!standalonePage) {
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      closeAuth();
    });
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) closeAuth();
    });
  }
  tabs.forEach((tab) =>
    tab.addEventListener("click", () =>
      configureMode(tab.dataset.authMode, false),
    ),
  );

  // Password visibility controls.
  document
    .querySelector("#auth-toggle-password")
    .addEventListener("click", (event) => {
      const toggle = event.currentTarget;
      const show = passwordInput.type === "password";
      passwordInput.type = show ? "text" : "password";
      toggle.textContent = show ? "HIDE" : "SHOW";
      toggle.setAttribute(
        "aria-label",
        show ? "Hide password" : "Show password",
      );
    });

  document
    .querySelector("#auth-toggle-confirm-password")
    .addEventListener("click", (event) => {
      const toggle = event.currentTarget;
      const show = confirmInput.type === "password";
      confirmInput.type = show ? "text" : "password";
      toggle.textContent = show ? "HIDE" : "SHOW";
      toggle.setAttribute(
        "aria-label",
        show ? "Hide confirm password" : "Show confirm password",
      );
    });

  forgotButton.addEventListener("click", async () => {
    if (!client) {
      setMessage(
        "Password-reset emails need a verified email service. Connect Supabase in auth-config.js; local demo accounts do not have real email or password recovery.",
        "error",
      );
      return;
    }
    const email = emailInput.value.trim();
    if (!email || !emailInput.checkValidity()) {
      setMessage(
        "Enter your account email first, then select “Forgot password?”.",
        "error",
      );
      emailInput.focus();
      return;
    }
    setBusy(true, "SENDING RESET LINK…");
    try {
      const { error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: getRedirectUrl(),
      });
      if (error) throw error;
      setMessage(
        "If an account exists for that address, a password reset email has been requested. Check your inbox.",
        "success",
      );
    } catch (error) {
      setMessage(
        error.message || "Could not request a reset email. Try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  });

  function setBusy(value, label) {
    busy = value;
    submitButton.disabled = value;
    submitButton.classList.toggle("is-busy", value);
    submitLabel.textContent = value
      ? label || "PLEASE WAIT…"
      : authMode === "signup"
        ? "CREATE ACCOUNT"
        : authMode === "recovery"
          ? "UPDATE PASSWORD"
          : "SIGN IN";
    document.querySelectorAll("[data-auth-provider]").forEach((button) => {
      button.disabled = value;
    });
    document.querySelector("#auth-toggle-password").disabled = value;
    document.querySelector("#auth-toggle-confirm-password").disabled = value;
    tabs.forEach((tab) => {
      tab.disabled = value;
    });
  }

  async function submitDemoAuth() {
    const email = emailInput.value.trim().toLowerCase();
    const password = passwordInput.value;
    const confirmPassword = confirmInput.value;
    if (isConfigured) {
      setMessage(
        "Supabase is configured but did not initialize. Check the CDN/network and project settings, then reload. Local demo mode is disabled while real auth is configured.",
        "error",
      );
      return;
    }
    if (!window.crypto?.getRandomValues || !window.crypto?.subtle) {
      setMessage(
        "Local demo sign-in needs Web Crypto. Open the site with Live Server or deploy it over HTTPS.",
        "error",
      );
      return;
    }
    try {
      const users = readDemoUsers();
      const userIndex = users.findIndex(
        (user) => user.email.toLowerCase() === email,
      );
      if (authMode === "signup") {
        if (password !== confirmPassword) {
          setMessage(
            "The passwords do not match. Check both fields and try again.",
            "error",
          );
          confirmInput.focus();
          return;
        }
        if (userIndex >= 0) {
          setMessage(
            "A local demo account already exists for this email. Switch to Sign in instead.",
            "error",
          );
          emailInput.focus();
          return;
        }
        const credential = await makeDemoCredential(password);
        users.push({
          email,
          ...credential,
          createdAt: new Date().toISOString(),
        });
        if (!saveDemoUsers(users))
          throw new Error(
            "This browser could not save the demo account. Check its local storage settings.",
          );
        localStorage.setItem(DEMO_SESSION_KEY, email);
        renderAccount({ email }, "demo");
        setAccountMessage(
          "Demo account created. This session exists only in this browser.",
          "success",
        );
      } else if (authMode === "signin") {
        if (
          userIndex < 0 ||
          !(await verifyDemoCredential(password, users[userIndex]))
        ) {
          setMessage(
            "Email or password does not match a local demo account. Create one first, or connect Supabase for real accounts.",
            "error",
          );
          passwordInput.focus();
          return;
        }
        localStorage.setItem(DEMO_SESSION_KEY, email);
        renderAccount({ email }, "demo");
        setAccountMessage("Signed in to your local demo account.", "success");
      } else if (authMode === "recovery") {
        setMessage(
          "Password recovery requires Supabase so ownership can be verified by email. Local demo accounts cannot safely reset passwords.",
          "error",
        );
      }
    } catch (error) {
      setMessage(
        error.message || "The local demo sign-in could not be completed.",
        "error",
      );
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (busy) return;
    if (
      authMode !== "recovery" &&
      (!emailInput.value.trim() || !emailInput.checkValidity())
    ) {
      emailInput.reportValidity();
      return;
    }
    if (passwordInput.value.length < 8) {
      setMessage("Use a password with at least 8 characters.", "error");
      passwordInput.focus();
      return;
    }
    if (
      (authMode === "signup" || authMode === "recovery") &&
      passwordInput.value !== confirmInput.value
    ) {
      setMessage(
        "The passwords do not match. Check both fields and try again.",
        "error",
      );
      confirmInput.focus();
      return;
    }

    setBusy(true);
    setMessage("");
    if (!client) {
      try {
        await submitDemoAuth();
      } finally {
        setBusy(false);
      }
      return;
    }
    try {
      let result;
      if (authMode === "signin") {
        result = await client.auth.signInWithPassword({
          email: emailInput.value.trim(),
          password: passwordInput.value,
        });
        if (result.error) throw result.error;
        renderAccount(result.data.user || result.data.session?.user);
        setAccountMessage("Signed in successfully.", "success");
      } else if (authMode === "signup") {
        result = await client.auth.signUp({
          email: emailInput.value.trim(),
          password: passwordInput.value,
          options: { emailRedirectTo: getRedirectUrl() },
        });
        if (result.error) throw result.error;
        if (result.data.session) {
          renderAccount(result.data.user || result.data.session.user);
          setAccountMessage("Account created and signed in.", "success");
        } else {
          setMessage(
            "Account request received. Check your inbox for the confirmation email, then come back to sign in.",
            "success",
          );
          passwordInput.value = "";
        }
      } else if (authMode === "recovery") {
        result = await client.auth.updateUser({
          password: passwordInput.value,
        });
        if (result.error) throw result.error;
        wasRecoveryCallback = false;
        renderAccount(result.data.user || currentUser);
        setAccountMessage("Password updated successfully.", "success");
      }
    } catch (error) {
      setMessage(
        error.message ||
          "Authentication could not be completed. Please try again.",
        "error",
      );
    } finally {
      setBusy(false);
    }
  });

  document.querySelectorAll("[data-auth-provider]").forEach((button) =>
    button.addEventListener("click", async () => {
      if (!client) {
        setMessage(
          "Social sign-in needs a connected Supabase project and provider configuration. Local demo mode supports email/password only.",
          "error",
        );
        return;
      }
      setBusy(true, "CONNECTING…");
      try {
        const { error } = await client.auth.signInWithOAuth({
          provider: button.dataset.authProvider,
          options: { redirectTo: getRedirectUrl() },
        });
        if (error) throw error;
      } catch (error) {
        setMessage(
          error.message ||
            `Could not connect ${button.dataset.authProvider}. Check the provider settings.`,
          "error",
        );
        setBusy(false);
      }
    }),
  );

  signOutButton.addEventListener("click", async () => {
    signOutButton.disabled = true;
    try {
      if (currentAuthSource === "demo") {
        localStorage.removeItem(DEMO_SESSION_KEY);
        renderAccount(null);
        configureMode("signin");
        setMessage("Signed out of the local demo account.", "success");
        return;
      }
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
      renderAccount(null);
      configureMode("signin");
      setMessage("You have signed out.", "success");
    } catch (error) {
      setAccountMessage(
        error.message || "Could not sign out. Try again.",
        "error",
      );
    } finally {
      signOutButton.disabled = false;
    }
  });

  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeAuth();
    }
    if (event.key !== "Tab") return;
    const focusable = [
      ...modal.querySelectorAll(
        'button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), a[href], [tabindex]:not([tabindex="-1"])',
      ),
    ].filter((element) => !element.closest("[hidden]"));
    if (!focusable.length) return;
    if (event.shiftKey && document.activeElement === focusable[0]) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (
      !event.shiftKey &&
      document.activeElement === focusable[focusable.length - 1]
    ) {
      event.preventDefault();
      focusable[0].focus();
    }
  });

  if (client) {
    client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) console.warn("Could not restore auth session.", error);
        renderAccount(data?.session?.user || null, "supabase");
      })
      .catch((error) => console.warn("Could not restore auth session.", error));
    client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        wasRecoveryCallback = true;
        renderAccount(null);
        configureMode("recovery");
        openAuth();
        setMessage(
          "Choose a new password to finish account recovery.",
          "success",
        );
      } else if (event === "SIGNED_OUT") {
        renderAccount(null);
      } else if (session?.user) {
        renderAccount(session.user, "supabase");
      }
    });
  } else if (!isConfigured) {
    try {
      const savedEmail = localStorage.getItem(DEMO_SESSION_KEY);
      const demoUser = readDemoUsers().find(
        (user) => user.email.toLowerCase() === (savedEmail || "").toLowerCase(),
      );
      if (demoUser) renderAccount({ email: demoUser.email }, "demo");
      else localStorage.removeItem(DEMO_SESSION_KEY);
    } catch (_) {
      /* Storage may be disabled; the sign-in form will explain if saving fails. */
    }
  }

  window.adibAuth = {
    open: openAuth,
    close: closeAuth,
    get configured() {
      return Boolean(client);
    },
    get user() {
      return currentUser;
    },
  };
})();
