// Contact form submission. POSTs JSON to the contact API, whose URL comes from
// the data-api-url attribute on this script's tag (params.apiUrl, set per
// environment by HUGO_PARAMS_APIURL). The same param feeds the CSP's
// connect-src in layouts/home._outputformat_headers_.txt.

const apiUrl = (document.currentScript as HTMLScriptElement | null)?.dataset.apiUrl;

function byId<T extends HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function resetTurnstile(): void {
  window.turnstile?.reset();
}

const form = document.getElementById("contact-form") as HTMLFormElement | null;

if (!apiUrl) {
  console.warn("Contact form: apiUrl is not configured (HUGO_PARAMS_APIURL)");
} else if (form) {
  const submitBtn = byId<HTMLButtonElement>("contact-submit");
  const submitText = byId("submit-text");
  const submitIcon = byId("submit-icon");
  const submitSpinner = byId("submit-spinner");
  const errorDiv = byId("contact-error");
  const errorText = byId("contact-error-text");
  const successDiv = byId("contact-success");

  // The container is rendered only when a Turnstile site key is configured.
  const turnstileRequired = document.getElementById("turnstile-container") !== null;

  const setLoading = (loading: boolean): void => {
    submitBtn.disabled = loading;
    submitText.textContent = loading ? "$ sending..." : "$ send";
    submitIcon.classList.toggle("hidden", loading);
    submitSpinner.classList.toggle("hidden", !loading);
  };

  const showError = (message: string): void => {
    errorText.textContent = message;
    errorDiv.classList.remove("hidden");
  };

  const hideError = (): void => {
    errorDiv.classList.add("hidden");
  };

  const isValidEmail = (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const value = (id: string): string => byId<HTMLInputElement>(id).value.trim();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    hideError();

    const name = value("contact-name");
    const email = value("contact-email");
    const subject = value("contact-subject");
    const message = value("contact-message");
    const turnstileResponse = document.querySelector<HTMLInputElement>(
      '[name="cf-turnstile-response"]',
    );
    const turnstileToken = turnstileResponse ? turnstileResponse.value : "";

    // Validate required fields
    if (!name || !email || !message) {
      showError("Please fill in all required fields.");
      return;
    }

    // Validate email format
    if (!isValidEmail(email)) {
      showError("Please enter a valid email address.");
      return;
    }

    // Check Turnstile token if configured
    if (turnstileRequired && !turnstileToken) {
      showError("Please complete the captcha verification.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          subject: subject || undefined,
          message,
          turnstileToken,
        }),
      });

      let data: { success?: boolean; error?: string };
      try {
        data = await response.json();
      } catch {
        showError("Server returned an invalid response. Please try again.");
        resetTurnstile();
        return;
      }

      if (response.ok && data.success) {
        form.classList.add("hidden");
        successDiv.classList.remove("hidden");
      } else {
        showError(data.error || "Failed to send message. Please try again.");
        resetTurnstile();
      }
    } catch {
      showError("Network error. Please check your connection and try again.");
      resetTurnstile();
    } finally {
      setLoading(false);
    }
  });
}

export {};
