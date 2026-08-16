import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// ---- Configuration Supabase ----
// La clé "anon" est publique par nature (elle est faite pour être exposée
// côté client) : la vraie sécurité vient de la RLS + de la fonction
// verify_admin_login définie côté base de données.
const SUPABASE_URL = "https://bltqkxlczirsfharoeam.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdHFreGxjemlyc2ZoYXJvZWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDU1MTIsImV4cCI6MjEwMTQ4MTUxMn0.qszR74W-3jKofWSq_3tmOjI1gHytf8sTHbJRz31zoYI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Éléments du DOM ----
const form = document.getElementById("login-form");
const identifiantInput = document.getElementById("identifiant");
const passwordInput = document.getElementById("mot-de-passe");
const errorMessage = document.getElementById("error-message");
const submitBtn = document.getElementById("submit-btn");
const submitLabel = submitBtn.querySelector(".submit__label");
const toggleBtn = document.getElementById("toggle-password");
const eyeOpen = document.getElementById("eye-open");
const eyeClosed = document.getElementById("eye-closed");

// Afficher / masquer le mot de passe
toggleBtn.addEventListener("click", () => {
  const isPassword = passwordInput.type === "password";
  passwordInput.type = isPassword ? "text" : "password";
  eyeOpen.style.display = isPassword ? "none" : "block";
  eyeClosed.style.display = isPassword ? "block" : "none";
  toggleBtn.setAttribute("aria-label", isPassword ? "Masquer le mot de passe" : "Afficher le mot de passe");
});

function setError(message) {
  if (!message) {
    errorMessage.hidden = true;
    errorMessage.textContent = "";
    return;
  }
  errorMessage.hidden = false;
  errorMessage.textContent = message;
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitLabel.textContent = isLoading ? "Connexion..." : "Se connecter";
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setError(null);

  const identifiant = identifiantInput.value.trim();
  const motDePasse = passwordInput.value;

  if (!identifiant || !motDePasse) {
    setError("Merci de renseigner l'identifiant et le mot de passe.");
    return;
  }

  setLoading(true);

  const { data, error } = await supabase.rpc("verify_login", {
    p_identifiant: identifiant,
    p_password: motDePasse,
  });

  setLoading(false);

  if (error) {
    console.error(error);
    setError("Une erreur est survenue. Merci de réessayer.");
    return;
  }

  const resultat = Array.isArray(data) ? data[0] : data;

  if (resultat?.succes) {
    // Connexion réussie : on marque la session côté client, avec le rôle
    // renvoyé par la base (admin ou visiteur), pour rediriger plus tard
    // vers la bonne page.
    sessionStorage.setItem("identifiant", identifiant);
    sessionStorage.setItem("role", resultat.role);
    sessionStorage.removeItem("acces_verifie"); // un nouveau login exige un nouveau piratage
    submitLabel.textContent = "Connecté ✓";

    if (resultat.role === "admin") {
      window.location.href = "minis-jeux/hack.html";
    } else if (resultat.role === "visiteur") {
      window.location.href = "visiteur.html";
    }
  } else {
    setError("Identifiant ou mot de passe incorrect.");
  }
});
