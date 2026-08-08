// ---- Connexion Supabase (lecture des données du dashboard) ----
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://bltqkxlczirsfharoeam.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdHFreGxjemlyc2ZoYXJvZWFtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MDU1MTIsImV4cCI6MjEwMTQ4MTUxMn0.qszR74W-3jKofWSq_3tmOjI1gHytf8sTHbJRz31zoYI";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- Garde d'accès basique ----
// Vérifie que la session marquée par la page de connexion correspond bien
// à un admin. C'est une protection côté client seulement (facile à
// contourner) : elle évite juste d'afficher la page par erreur.
// Si vous avez déjà une vraie session serveur, remplacez ce bloc par une
// vérification côté serveur (cookie de session, etc.).
const role = sessionStorage.getItem("role");
if (role !== "admin") {
  window.location.href = "index.html";
}

// ---- Horloge en temps réel ----
const clockEl = document.getElementById("clock");

function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}`;
}

updateClock();
setInterval(updateClock, 1000 * 15);

// ---- Déconnexion ----
document.getElementById("logout-btn").addEventListener("click", () => {
  sessionStorage.removeItem("identifiant");
  sessionStorage.removeItem("role");
  window.location.href = "index.html";
});

// ---- Données du tableau de bord ----

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) +
    " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

async function chargerClassement() {
  const list = document.getElementById("rank-list");
  const { data, error } = await supabase.rpc("get_classement", { p_limit: 5 });

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<li class="rank-item"><span class="rank-item__name">Aucune action pour l'instant</span></li>`;
    return;
  }

  list.innerHTML = data.map((row, i) => `
    <li class="rank-item">
      <span class="rank-item__pos">${i + 1}</span>
      <span class="rank-item__name">${row.identifiant}</span>
      <span class="rank-item__score">${row.nb_actions} action${row.nb_actions > 1 ? "s" : ""}</span>
    </li>
  `).join("");
}

async function chargerTimeline() {
  const list = document.getElementById("timeline-list");
  const { data, error } = await supabase.rpc("get_timeline", { p_limit: 10 });

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<li class="timeline-item"><div class="timeline-item__text">Aucune action pour l'instant</div></li>`;
    return;
  }

  list.innerHTML = data.map((row) => `
    <li class="timeline-item">
      <div class="timeline-item__time">${formatDate(row.created_at)}</div>
      <div class="timeline-item__text">${row.identifiant} — ${row.titre_contenu}</div>
    </li>
  `).join("");
}

async function chargerDerniersComptes() {
  const list = document.getElementById("account-list");
  const { data, error } = await supabase.rpc("get_derniers_comptes", { p_limit: 5 });

  if (error) {
    console.error(error);
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<li class="account-item"><span class="account-item__name">Aucun compte pour l'instant</span></li>`;
    return;
  }

  list.innerHTML = data.map((row) => `
    <li class="account-item">
      <span class="account-item__name">${row.identifiant}${row.identite ? ` <span style="color:var(--ink-dim);font-weight:400">(${row.identite})</span>` : ""}</span>
      <span class="account-item__date">${formatDate(row.created_at)}</span>
    </li>
  `).join("");
}

chargerClassement();
chargerTimeline();
chargerDerniersComptes();

document.getElementById("see-more-btn").addEventListener("click", () => {
  // À adapter quand la page "liste des comptes" sera créée :
  // window.location.href = "comptes.html";
});

// ---- Modale "Nouveau défi" ----
const newDefiBtn = document.getElementById("new-defi-btn");
const defiModal = document.getElementById("defi-modal");
const defiModalBackdrop = document.getElementById("defi-modal-backdrop");
const defiForm = document.getElementById("defi-form");
const defiTitreInput = document.getElementById("defi-titre-input");
const defiMontantInput = document.getElementById("defi-montant-input");
const defiHeuresInput = document.getElementById("defi-heures-input");
const defiMinutesInput = document.getElementById("defi-minutes-input");
const visiteursGrid = document.getElementById("visiteurs-grid");
const defiFormMessage = document.getElementById("defi-form-message");
const defiSubmitBtn = document.getElementById("defi-submit-btn");

function setDefiMessage(text, type) {
  defiFormMessage.hidden = !text;
  defiFormMessage.textContent = text || "";
  defiFormMessage.className = "modal-message" + (type ? ` modal-message--${type}` : "");
}

async function chargerVisiteurs() {
  visiteursGrid.innerHTML = `<span style="font-size:12.5px;color:var(--ink-dim)">Chargement...</span>`;

  const { data, error } = await supabase.rpc("get_comptes_visiteurs");

  if (error) {
    console.error(error);
    visiteursGrid.innerHTML = `<span style="font-size:12.5px;color:var(--danger)">Impossible de charger les visiteurs.</span>`;
    return;
  }

  if (!data || data.length === 0) {
    visiteursGrid.innerHTML = `<span style="font-size:12.5px;color:var(--ink-dim)">Aucun visiteur pour l'instant</span>`;
    return;
  }

  visiteursGrid.innerHTML = data.map((row) => `
    <label class="visiteur-check">
      <input type="checkbox" name="visiteur" value="${row.identifiant}">
      <span>${row.identifiant}</span>
    </label>
  `).join("");
}

function openDefiModal() {
  defiModal.classList.add("open");
  defiModalBackdrop.classList.add("open");
  chargerVisiteurs();
}

function closeDefiModal() {
  defiModal.classList.remove("open");
  defiModalBackdrop.classList.remove("open");
}

newDefiBtn.addEventListener("click", openDefiModal);
defiModalBackdrop.addEventListener("click", closeDefiModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeDefiModal();
});

defiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setDefiMessage(null);

  const titre = defiTitreInput.value.trim();
  const montant = parseFloat(defiMontantInput.value);
  const heures = parseInt(defiHeuresInput.value, 10) || 0;
  const minutes = parseInt(defiMinutesInput.value, 10) || 0;
  const dureeSecondes = heures * 3600 + minutes * 60;

  const identifiantsChoisis = Array.from(
    visiteursGrid.querySelectorAll('input[name="visiteur"]:checked')
  ).map((input) => input.value);

  if (!titre || isNaN(montant)) {
    setDefiMessage("Merci de renseigner un titre et un montant.", "error");
    return;
  }

  if (dureeSecondes <= 0) {
    setDefiMessage("Merci d'indiquer une durée.", "error");
    return;
  }

  if (identifiantsChoisis.length === 0) {
    setDefiMessage("Coche au moins un visiteur concerné.", "error");
    return;
  }

  defiSubmitBtn.disabled = true;
  defiSubmitBtn.textContent = "Création...";

  const { error } = await supabase.rpc("creer_defi", {
    p_titre: titre,
    p_montant: montant,
    p_duree_secondes: dureeSecondes,
    p_identifiants: identifiantsChoisis,
  });

  defiSubmitBtn.disabled = false;
  defiSubmitBtn.textContent = "Créer le défi";

  if (error) {
    console.error(error);
    setDefiMessage("Une erreur est survenue. Merci de réessayer.", "error");
    return;
  }

  setDefiMessage("Défi créé !", "success");
  defiForm.reset();
  chargerTimeline();

  setTimeout(closeDefiModal, 900);
});

// ---- Modale "Nouveau visiteur" ----
const newVisiteurBtn = document.getElementById("new-visiteur-btn");
const visiteurModal = document.getElementById("visiteur-modal");
const visiteurModalBackdrop = document.getElementById("visiteur-modal-backdrop");
const visiteurForm = document.getElementById("visiteur-form");
const nvIdentifiantInput = document.getElementById("nv-identifiant-input");
const nvIdentiteInput = document.getElementById("nv-identite-input");
const nvMotdepasseInput = document.getElementById("nv-motdepasse-input");
const visiteurFormMessage = document.getElementById("visiteur-form-message");
const visiteurSubmitBtn = document.getElementById("visiteur-submit-btn");

function setVisiteurMessage(text, type) {
  visiteurFormMessage.hidden = !text;
  visiteurFormMessage.textContent = text || "";
  visiteurFormMessage.className = "modal-message" + (type ? ` modal-message--${type}` : "");
}

function openVisiteurModal() {
  visiteurModal.classList.add("open");
  visiteurModalBackdrop.classList.add("open");
}

function closeVisiteurModal() {
  visiteurModal.classList.remove("open");
  visiteurModalBackdrop.classList.remove("open");
}

newVisiteurBtn.addEventListener("click", openVisiteurModal);
visiteurModalBackdrop.addEventListener("click", closeVisiteurModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeVisiteurModal();
});

visiteurForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setVisiteurMessage(null);

  const identifiant = nvIdentifiantInput.value.trim();
  const identite = nvIdentiteInput.value.trim();
  const motDePasse = nvMotdepasseInput.value;

  if (!identifiant || !motDePasse) {
    setVisiteurMessage("Merci de renseigner l'identifiant et le mot de passe.", "error");
    return;
  }

  if (motDePasse.length < 6) {
    setVisiteurMessage("Le mot de passe doit faire au moins 6 caractères.", "error");
    return;
  }

  visiteurSubmitBtn.disabled = true;
  visiteurSubmitBtn.textContent = "Création...";

  const { error } = await supabase.rpc("creer_visiteur", {
    p_identifiant: identifiant,
    p_mot_de_passe: motDePasse,
    p_identite: identite || null,
  });

  visiteurSubmitBtn.disabled = false;
  visiteurSubmitBtn.textContent = "Créer le compte";

  if (error) {
    console.error(error);
    setVisiteurMessage(error.message || "Une erreur est survenue. Merci de réessayer.", "error");
    return;
  }

  setVisiteurMessage("Compte créé !", "success");
  visiteurForm.reset();
  chargerDerniersComptes();

  setTimeout(closeVisiteurModal, 900);
});
