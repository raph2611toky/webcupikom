document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-password");
  const input = document.getElementById("id_password");
  if (!toggle || !input) return;

  const eye = toggle.querySelector(".eye-icon");
  const eyeOff = toggle.querySelector(".eye-off-icon");

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    if (eye) eye.style.display = show ? "none" : "block";
    if (eyeOff) eyeOff.style.display = show ? "block" : "none";
    toggle.setAttribute("aria-label", show ? "Masquer le mot de passe" : "Afficher le mot de passe");
  });
});
