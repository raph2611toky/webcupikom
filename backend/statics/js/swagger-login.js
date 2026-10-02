(() => {
  const toggle = document.querySelector("[data-password-toggle]");
  const input = document.getElementById("swagger-password");

  if (!toggle || !input) return;

  toggle.addEventListener("click", () => {
    const shouldShow = input.type === "password";
    input.type = shouldShow ? "text" : "password";
    toggle.setAttribute("aria-pressed", String(shouldShow));
    toggle.setAttribute(
      "aria-label",
      shouldShow ? "Masquer le mot de passe" : "Afficher le mot de passe",
    );
    input.focus({ preventScroll: true });
  });
})();
