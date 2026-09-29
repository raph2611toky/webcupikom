document.addEventListener("DOMContentLoaded", () => {
  console.log("Script password-toggle.js chargé")

  const togglePassword = document.getElementById("toggle-password")
  const passwordInput = document.getElementById("id_password")

  if (togglePassword && passwordInput) {
    const eyeIcon = togglePassword.querySelector(".eye-icon")
    const eyeOffIcon = togglePassword.querySelector(".eye-off-icon")

    togglePassword.addEventListener("click", (e) => {
      e.preventDefault()
      console.log("Toggle password clicked")

      const type = passwordInput.getAttribute("type") === "password" ? "text" : "password"
      passwordInput.setAttribute("type", type)

      if (type === "text") {
        eyeIcon.style.display = "none"
        eyeOffIcon.style.display = "block"
      } else {
        eyeIcon.style.display = "block"
        eyeOffIcon.style.display = "none"
      }
    })
  } else {
    console.error("Éléments de toggle mot de passe non trouvés")
  }
})
