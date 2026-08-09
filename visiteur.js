import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://bltqkxlczirsfharoeam.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdHFreGxjemlyc2ZoYXJvZWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDU1MTIsImV4cCI6MjEwMTQ4MTUxMn0.qszR74W-3jKofWSq_3tmOjI1gHytf8sTHbJRz31zoYI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Garde d'accès basique ----
const identifiant = sessionStorage.getItem("identifiant");
const role = sessionStorage.getItem("role");
if (role !== "visiteur") {
  window.location.href = "index.html";
}

// ---- Déconnexion ----
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("identifiant");
  sessionStorage.removeItem("role");
  window.location.href = "index.html";
});

// ---- Éléments du DOM ----
const defiTitreEl = document.getElementById("defi-titre");
const defiMontantEl = document.getElementById("defi-montant");
const timerEl = document.getElementById("timer");
const toggleProofBtn = document.getElementById("toggle-proof-btn");
const proofDoneEl = document.getElementById("proof-done");
const proofEchecEl = document.getElementById("proof-echec");
const proofForm = document.getElementById("proof-form");
const proofTitreInput = document.getElementById("proof-titre");
const proofLienInput = document.getElementById("proof-lien");
const pasteZone = document.getElementById("paste-zone");
const submitProofBtn = document.getElementById("submit-proof-btn");
const formMessage = document.getElementById("form-message");

let dureeSecondes = 0;
let lanceLe = null;
let imageFile = null; // Blob de l'image collée, prête à être uploadée
let preuveEnvoyee = false; // état courant, mis à jour à chaque changement d'affichage

function afficherPreuveDejaEnvoyee() {
  toggleProofBtn.style.display = "none";
  proofDoneEl.style.display = "flex";
  proofEchecEl.style.display = "none";
  preuveEnvoyee = true;
}

function afficherBoutonPreuve() {
  toggleProofBtn.style.display = "";
  proofDoneEl.style.display = "none";
  proofEchecEl.style.display = "none";
  preuveEnvoyee = false;
}

function afficherEchec() {
  toggleProofBtn.style.display = "none";
  proofDoneEl.style.display = "none";
  proofEchecEl.style.display = "flex";
}

// État de départ déterministe (indépendant de l'attribut "hidden" du HTML)
afficherBoutonPreuve();

// ---- Chargement du défi actuel ----
async function chargerDefi() {
  const { data, error } = await supabase.rpc("get_defi_actuel");

  if (error || !data || data.length === 0) {
    defiTitreEl.textContent = "Aucun défi pour l'instant";
    defiMontantEl.textContent = "";
    timerEl.textContent = "--:--:--";
    return;
  }

  const defi = Array.isArray(data) ? data[0] : data;
  defiTitreEl.textContent = defi.titre;
  defiMontantEl.textContent = `${defi.montant}$`;
  proofTitreInput.textContent = defi.titre;
  dureeSecondes = defi.duree_secondes;
  lanceLe = defi.lance_le;

  const { data: dejaEnvoye, error: dejaEnvoyeError } = await supabase.rpc("a_envoye_preuve", {
    p_identifiant: identifiant,
  });

  if (dejaEnvoyeError) {
    console.error("Erreur a_envoye_preuve :", dejaEnvoyeError);
    afficherBoutonPreuve();
  } else if (dejaEnvoye === true) {
    afficherPreuveDejaEnvoyee();
  } else {
    afficherBoutonPreuve();
  }

  // Le timer démarre après avoir su si une preuve a déjà été envoyée, pour
  // pouvoir afficher "Échec" correctement dès le chargement si le défi est
  // déjà terminé sans preuve.
  demarrerTimer();
}

// ---- Timer qui descend tout seul depuis le lancement ----
function formatTemps(totalSecondes) {
  const h = String(Math.floor(totalSecondes / 3600)).padStart(2, "0");
  const m = String(Math.floor((totalSecondes % 3600) / 60)).padStart(2, "0");
  const s = String(Math.floor(totalSecondes % 60)).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function demarrerTimer() {
  if (!lanceLe) {
    timerEl.textContent = "En attente de lancement";
    timerEl.classList.add("timer--attente");
    return;
  }

  timerEl.classList.remove("timer--attente");

  const debut = new Date(lanceLe).getTime();
  const fin = debut + dureeSecondes * 1000;

  function tick() {
    const restant = Math.max(0, Math.round((fin - Date.now()) / 1000));
    timerEl.textContent = formatTemps(restant);
    if (restant <= 0) {
      clearInterval(intervalId);
      timerEl.textContent = "Défi terminé";
      timerEl.classList.add("timer--attente");

      // Le temps est écoulé : si aucune preuve n'a été envoyée, on affiche
      // "Échec" à la place du bouton (et on ferme le formulaire s'il était ouvert).
      if (!preuveEnvoyee) {
        closeProofForm();
        afficherEchec();
      }
    }
  }

  tick();
  const intervalId = setInterval(tick, 1000);
}

// ---- Ouverture / fermeture du formulaire de preuve ----
// Le formulaire est en position fixed (voir visiteur.html), donc il ne
// fait jamais grandir la page : la hauteur reste fixe.
const proofBackdrop = document.getElementById("proof-backdrop");

function openProofForm() {
  proofForm.classList.add("open");
  proofBackdrop.classList.add("open");
}

function closeProofForm() {
  proofForm.classList.remove("open");
  proofBackdrop.classList.remove("open");
}

toggleProofBtn.addEventListener("click", openProofForm);

// Clic dans le vide (le fond assombri) = fermeture
proofBackdrop.addEventListener("click", closeProofForm);

// Touche Échap = fermeture
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeProofForm();
});

// ---- Capture de l'image collée (Ctrl+V) ----
pasteZone.addEventListener("paste", (event) => {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (item.type.startsWith("image/")) {
      imageFile = item.getAsFile();

      const reader = new FileReader();
      reader.onload = () => {
        pasteZone.innerHTML = `<img src="${reader.result}" alt="Image collée">`;
        pasteZone.classList.add("has-image");
      };
      reader.readAsDataURL(imageFile);
      break;
    }
  }
});

function setFormMessage(text, type) {
  formMessage.hidden = !text;
  formMessage.textContent = text || "";
  formMessage.className = "form-message" + (type ? ` form-message--${type}` : "");
}

// ---- Envoi de la preuve ----
proofForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setFormMessage(null);

  const lien = proofLienInput.value.trim();

  if (!lien && !imageFile) {
    setFormMessage("Ajoutez au moins un lien vidéo ou une image.", "error");
    return;
  }

  submitProofBtn.disabled = true;
  submitProofBtn.textContent = "Envoi...";

  let imageUrl = null;

  try {
    if (imageFile) {
      const nomFichier = `${identifiant}-${Date.now()}.png`;
      const { error: uploadError } = await supabase
        .storage
        .from("preuves")
        .upload(nomFichier, imageFile, { contentType: imageFile.type });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase
        .storage
        .from("preuves")
        .getPublicUrl(nomFichier);

      imageUrl = publicUrlData.publicUrl;
    }

    const { error: rpcError } = await supabase.rpc("ajouter_preuve", {
      p_identifiant: identifiant,
      p_lien_media: lien || null,
      p_image_url: imageUrl,
      p_latitude: null,
      p_longitude: null,
    });

    if (rpcError) throw rpcError;

    setFormMessage("Preuve envoyée, merci !", "success");
    proofLienInput.value = "";
    imageFile = null;
    pasteZone.innerHTML = "Cliquez ici puis collez votre image (Ctrl+V)";
    pasteZone.classList.remove("has-image");

    setTimeout(() => {
      closeProofForm();
      afficherPreuveDejaEnvoyee();
    }, 900);
  } catch (err) {
    console.error(err);
    setFormMessage("Une erreur est survenue. Merci de réessayer.", "error");
  } finally {
    submitProofBtn.disabled = false;
    submitProofBtn.textContent = "Envoyer";
  }
});

chargerDefi();
