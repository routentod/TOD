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

async function chargerDefis() {
  const list = document.getElementById("timeline-list");
  const { data, error } = await supabase.rpc("get_tous_defis");

  if (error) {
    console.error(error);
    list.innerHTML = `<li class="defi-item"><span class="defi-item__titre">Impossible de charger les défis.</span></li>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<li class="defi-item"><span class="defi-item__titre">Aucun défi pour l'instant</span></li>`;
    return;
  }

  list.innerHTML = data.map((defi) => {
    const identifiants = defi.identifiants || [];
    const tags = identifiants.length
      ? identifiants.map((id) => `<span class="joueur-tag">${id}</span>`).join("")
      : `<span class="joueur-tag">Aucun joueur</span>`;

    return `
    <li class="defi-item" data-id="${defi.id}" data-lance-le="${defi.lance_le || ""}" data-duree="${defi.duree_secondes}">
      <div class="defi-item__top">
        <span class="defi-item__titre">${defi.titre}</span>
        <button type="button" class="account-action-btn account-action-btn--danger" data-action="delete-defi" title="Supprimer le défi">${ICON_TRASH}</button>
      </div>
      <div class="defi-item__meta">
        <span class="defi-item__montant">${defi.montant}$</span>
        <span class="defi-item__timer">--:--:--</span>
      </div>
      <div class="defi-item__joueurs">${tags}</div>
    </li>
  `;
  }).join("");

  mettreAJourTimersDefis();
}

function mettreAJourTimersDefis() {
  document.querySelectorAll(".defi-item").forEach((item) => {
    const timerEl = item.querySelector(".defi-item__timer");
    if (!timerEl) return;

    const lanceLe = item.dataset.lanceLe;
    const duree = parseInt(item.dataset.duree, 10) || 0;

    if (!lanceLe) {
      timerEl.textContent = "En attente";
      timerEl.className = "defi-item__timer defi-item__timer--attente";
      return;
    }

    const debut = new Date(lanceLe).getTime();
    const fin = debut + duree * 1000;
    const restant = Math.round((fin - Date.now()) / 1000);

    if (restant <= 0) {
      timerEl.textContent = "Terminé";
      timerEl.className = "defi-item__timer defi-item__timer--termine";
      return;
    }

    const h = String(Math.floor(restant / 3600)).padStart(2, "0");
    const m = String(Math.floor((restant % 3600) / 60)).padStart(2, "0");
    const s = String(Math.floor(restant % 60)).padStart(2, "0");
    timerEl.textContent = `${h}:${m}:${s}`;
    timerEl.className = "defi-item__timer";
  });
}

setInterval(mettreAJourTimersDefis, 1000);

const ICON_EDIT = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
const ICON_TRASH = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>`;

const ICON_CLOSE = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

async function chargerComptesParCategorie() {
  const list = document.getElementById("account-list");
  const { data, error } = await supabase.rpc("get_comptes_visiteurs");

  if (error) {
    console.error(error);
    list.innerHTML = `<li class="defi-item"><span class="defi-item__titre">Impossible de charger les comptes.</span></li>`;
    return;
  }

  if (!data || data.length === 0) {
    list.innerHTML = `<li class="defi-item"><span class="defi-item__titre">Aucun compte pour l'instant</span></li>`;
    return;
  }

  // Regroupe les joueurs par catégorie (les "sans catégorie" à la fin)
  const groupes = new Map();
  data.forEach((row) => {
    const cle = row.categorie_nom || "__sans__";
    if (!groupes.has(cle)) groupes.set(cle, []);
    groupes.get(cle).push(row);
  });

  const cles = Array.from(groupes.keys()).sort((a, b) => {
    if (a === "__sans__") return 1;
    if (b === "__sans__") return -1;
    return a.localeCompare(b);
  });

  list.innerHTML = cles.map((cle) => {
    const titre = cle === "__sans__" ? "Sans catégorie" : cle;
    const tags = groupes.get(cle).map((row) => `
      <span class="compte-tag" data-identifiant="${row.identifiant}">
        ${row.identifiant}
        <span class="compte-tag__del" data-action="delete" title="Supprimer ce joueur">${ICON_CLOSE}</span>
      </span>
    `).join("");

    return `
      <li class="defi-item">
        <div class="defi-item__top">
          <span class="defi-item__titre">${titre}</span>
        </div>
        <div class="defi-item__joueurs">${tags}</div>
      </li>
    `;
  }).join("");
}

chargerClassement();
chargerDefis();
chargerComptesParCategorie();

// ---- Actions sur un compte (clic = modifier, ✕ = supprimer) ----
document.getElementById("account-list").addEventListener("click", (event) => {
  const delBtn = event.target.closest(".compte-tag__del");
  const tag = event.target.closest(".compte-tag");
  if (!tag) return;

  const identifiant = tag.dataset.identifiant;
  if (!identifiant) return;

  try {
    if (delBtn) {
      supprimerJoueur(identifiant);
    } else {
      openEditJoueurModal(identifiant);
    }
  } catch (err) {
    console.error("Erreur en ouvrant l'action compte :", err);
  }
});

async function supprimerJoueur(identifiant) {
  const confirme = confirm(`Supprimer le compte "${identifiant}" ? Cette action est irréversible.`);
  if (!confirme) return;

  const { error } = await supabase.rpc("supprimer_visiteur", { p_identifiant: identifiant });

  if (error) {
    console.error(error);
    alert("Impossible de supprimer ce compte pour l'instant.");
    return;
  }

  chargerComptesParCategorie();
}


// ---- Suppression d'un défi ----
document.getElementById("timeline-list").addEventListener("click", async (event) => {
  const btn = event.target.closest('[data-action="delete-defi"]');
  if (!btn) return;

  const item = btn.closest(".defi-item");
  const id = item?.dataset.id;
  if (!id) return;

  const confirme = confirm("Supprimer ce défi ? Cette action est irréversible.");
  if (!confirme) return;

  const { error } = await supabase.rpc("supprimer_defi", { p_id: id });

  if (error) {
    console.error(error);
    alert("Impossible de supprimer ce défi pour l'instant.");
    return;
  }

  chargerDefis();
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
const defiCategorieTags = document.getElementById("defi-categorie-tags");
const defiFormMessage = document.getElementById("defi-form-message");
const defiSubmitBtn = document.getElementById("defi-submit-btn");

function setDefiMessage(text, type) {
  defiFormMessage.hidden = !text;
  defiFormMessage.textContent = text || "";
  defiFormMessage.className = "modal-message" + (type ? ` modal-message--${type}` : "");
}

// Multi-sélection de catégories (tags qui basculent indépendamment, "Sans
// catégorie" inclus pour pouvoir viser aussi les joueurs non catégorisés)
async function chargerCategorieTagsDefi() {
  defiCategorieTags.innerHTML = `<span style="font-size:12.5px;color:var(--ink-dim)">Chargement...</span>`;

  const categories = await chargerListeCategories();
  const tous = [...categories, { id: "__sans__", nom: "Sans catégorie" }];

  defiCategorieTags.innerHTML = tous.map((c) => `
    <button type="button" class="categorie-tag" data-id="${c.id}">${c.nom}</button>
  `).join("");

  defiCategorieTags.querySelectorAll(".categorie-tag").forEach((tag) => {
    tag.addEventListener("click", () => tag.classList.toggle("active"));
  });
}

function getCategoriesSelectionneesDefi() {
  return Array.from(defiCategorieTags.querySelectorAll(".categorie-tag.active")).map((t) => t.dataset.id);
}

// ---- Catégories : chargement partagé (liste + remplissage des <select>) ----
async function chargerListeCategories() {
  const { data, error } = await supabase.rpc("get_categories");
  if (error) {
    console.error(error);
    return [];
  }
  return data || [];
}

function remplirTagsCategorie(containerEl, categories, valeurSelectionnee) {
  containerEl.dataset.selected = valeurSelectionnee || "";

  const tous = [{ id: "", nom: "Sans catégorie" }, ...categories];

  containerEl.innerHTML = tous.map((c) => `
    <button type="button" class="categorie-tag${c.id === (valeurSelectionnee || "") ? " active" : ""}" data-id="${c.id}">${c.nom}</button>
  `).join("");

  containerEl.querySelectorAll(".categorie-tag").forEach((tag) => {
    tag.addEventListener("click", () => {
      containerEl.dataset.selected = tag.dataset.id;
      containerEl.querySelectorAll(".categorie-tag").forEach((t) => t.classList.toggle("active", t === tag));
    });
  });
}

function getCategorieSelectionnee(containerEl) {
  return containerEl.dataset.selected || null;
}

function openDefiModal() {
  defiModal.classList.add("open");
  defiModalBackdrop.classList.add("open");
  chargerCategorieTagsDefi();
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

  const categorieIdsChoisis = getCategoriesSelectionneesDefi();

  if (!titre || isNaN(montant)) {
    setDefiMessage("Merci de renseigner un titre et un montant.", "error");
    return;
  }

  if (dureeSecondes <= 0) {
    setDefiMessage("Merci d'indiquer une durée.", "error");
    return;
  }

  if (categorieIdsChoisis.length === 0) {
    setDefiMessage("Coche au moins une catégorie concernée.", "error");
    return;
  }

  // Résout les catégories choisies en identifiants de joueurs (le "défi" est
  // toujours stocké par joueur côté base ; seule la façon de les choisir a
  // changé côté admin).
  const { data: comptes, error: comptesError } = await supabase.rpc("get_comptes_visiteurs");
  if (comptesError) {
    console.error(comptesError);
    setDefiMessage("Impossible de charger les joueurs de ces catégories.", "error");
    return;
  }

  const identifiantsChoisis = (comptes || [])
    .filter((c) => categorieIdsChoisis.includes(c.categorie_id || "__sans__"))
    .map((c) => c.identifiant);

  if (identifiantsChoisis.length === 0) {
    setDefiMessage("Aucun joueur dans la ou les catégories sélectionnées.", "error");
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
  chargerDefis();

  setTimeout(closeDefiModal, 900);
});

// ---- Modale "Nouveau joueur" ----
const newJoueurBtn = document.getElementById("new-joueur-btn");
const joueurModal = document.getElementById("joueur-modal");
const joueurModalBackdrop = document.getElementById("joueur-modal-backdrop");
const joueurForm = document.getElementById("joueur-form");
const nvIdentifiantInput = document.getElementById("nv-identifiant-input");
const nvIdentiteInput = document.getElementById("nv-identite-input");
const nvMotdepasseInput = document.getElementById("nv-motdepasse-input");
const joueurFormMessage = document.getElementById("joueur-form-message");
const joueurSubmitBtn = document.getElementById("joueur-submit-btn");

function setJoueurMessage(text, type) {
  joueurFormMessage.hidden = !text;
  joueurFormMessage.textContent = text || "";
  joueurFormMessage.className = "modal-message" + (type ? ` modal-message--${type}` : "");
}

const nvCategorieTags = document.getElementById("nv-categorie-tags");

async function openJoueurModal() {
  joueurModal.classList.add("open");
  joueurModalBackdrop.classList.add("open");
  const categories = await chargerListeCategories();
  remplirTagsCategorie(nvCategorieTags, categories, "");
}

function closeJoueurModal() {
  joueurModal.classList.remove("open");
  joueurModalBackdrop.classList.remove("open");
}

newJoueurBtn.addEventListener("click", openJoueurModal);
joueurModalBackdrop.addEventListener("click", closeJoueurModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeJoueurModal();
});

joueurForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setJoueurMessage(null);

  const identifiant = nvIdentifiantInput.value.trim();
  const identite = nvIdentiteInput.value.trim();
  const motDePasse = nvMotdepasseInput.value;

  if (!identifiant || !motDePasse) {
    setJoueurMessage("Merci de renseigner l'identifiant et le mot de passe.", "error");
    return;
  }

  if (motDePasse.length < 6) {
    setJoueurMessage("Le mot de passe doit faire au moins 6 caractères.", "error");
    return;
  }

  joueurSubmitBtn.disabled = true;
  joueurSubmitBtn.textContent = "Création...";

  const { error } = await supabase.rpc("creer_visiteur", {
    p_identifiant: identifiant,
    p_mot_de_passe: motDePasse,
    p_identite: identite || null,
  });

  joueurSubmitBtn.disabled = false;
  joueurSubmitBtn.textContent = "Créer le compte";

  if (error) {
    console.error(error);
    setJoueurMessage(error.message || "Une erreur est survenue. Merci de réessayer.", "error");
    return;
  }

  const categorieId = getCategorieSelectionnee(nvCategorieTags);
  if (categorieId) {
    const { error: catError } = await supabase.rpc("assigner_visiteur_categorie", {
      p_identifiant: identifiant,
      p_categorie_id: categorieId,
    });
    if (catError) console.error(catError);
  }

  setJoueurMessage("Compte créé !", "success");
  joueurForm.reset();
  chargerComptesParCategorie();

  setTimeout(closeJoueurModal, 900);
});

// ---- Modale "Modifier le compte joueur" ----
const editJoueurModal = document.getElementById("edit-joueur-modal");
const editJoueurModalBackdrop = document.getElementById("edit-joueur-modal-backdrop");
const editJoueurForm = document.getElementById("edit-joueur-form");
const evIdentifiantInput = document.getElementById("ev-identifiant-input");
const evIdentifiantDisplay = document.getElementById("ev-identifiant-display");
const evMotdepasseInput = document.getElementById("ev-motdepasse-input");
const editJoueurFormMessage = document.getElementById("edit-joueur-form-message");
const editJoueurSubmitBtn = document.getElementById("edit-joueur-submit-btn");

// Afficher / masquer le mot de passe (modale "Modifier le compte")
const evTogglePassword = document.getElementById("ev-toggle-password");
const evEyeOpen = document.getElementById("ev-eye-open");
const evEyeClosed = document.getElementById("ev-eye-closed");

evTogglePassword.addEventListener("click", () => {
  const isPassword = evMotdepasseInput.type === "password";
  evMotdepasseInput.type = isPassword ? "text" : "password";
  evEyeOpen.style.display = isPassword ? "none" : "block";
  evEyeClosed.style.display = isPassword ? "block" : "none";
  evTogglePassword.setAttribute("aria-label", isPassword ? "Masquer le mot de passe" : "Afficher le mot de passe");
});

function setEditJoueurMessage(text, type) {
  editJoueurFormMessage.hidden = !text;
  editJoueurFormMessage.textContent = text || "";
  editJoueurFormMessage.className = "modal-message" + (type ? ` modal-message--${type}` : "");
}

const evCategorieTags = document.getElementById("ev-categorie-tags");

async function openEditJoueurModal(identifiant) {
  setEditJoueurMessage(null);
  editJoueurForm.reset();
  evMotdepasseInput.type = "password";
  evEyeOpen.style.display = "block";
  evEyeClosed.style.display = "none";
  evIdentifiantInput.value = identifiant;
  if (evIdentifiantDisplay) evIdentifiantDisplay.textContent = identifiant;
  editJoueurModal.classList.add("open");
  editJoueurModalBackdrop.classList.add("open");

  const [categories, comptes] = await Promise.all([
    chargerListeCategories(),
    supabase.rpc("get_comptes_visiteurs").then((r) => r.data || []),
  ]);
  const compte = comptes.find((c) => c.identifiant === identifiant);
  remplirTagsCategorie(evCategorieTags, categories, compte?.categorie_id || "");
}

function closeEditJoueurModal() {
  editJoueurModal.classList.remove("open");
  editJoueurModalBackdrop.classList.remove("open");
}

editJoueurModalBackdrop.addEventListener("click", closeEditJoueurModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeEditJoueurModal();
});

editJoueurForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setEditJoueurMessage(null);

  const identifiant = evIdentifiantInput.value;
  const motDePasse = evMotdepasseInput.value;
  const categorieId = getCategorieSelectionnee(evCategorieTags);

  if (motDePasse && motDePasse.length < 6) {
    setEditJoueurMessage("Le mot de passe doit faire au moins 6 caractères.", "error");
    return;
  }

  editJoueurSubmitBtn.disabled = true;
  editJoueurSubmitBtn.textContent = "Enregistrement...";

  const { error: catError } = await supabase.rpc("assigner_visiteur_categorie", {
    p_identifiant: identifiant,
    p_categorie_id: categorieId,
  });

  let mdpError = null;
  if (motDePasse) {
    const { error } = await supabase.rpc("modifier_mot_de_passe_visiteur", {
      p_identifiant: identifiant,
      p_nouveau_mot_de_passe: motDePasse,
    });
    mdpError = error;
  }

  editJoueurSubmitBtn.disabled = false;
  editJoueurSubmitBtn.textContent = "Enregistrer";

  if (catError || mdpError) {
    console.error(catError || mdpError);
    setEditJoueurMessage((catError || mdpError).message || "Une erreur est survenue. Merci de réessayer.", "error");
    return;
  }

  setEditJoueurMessage("Compte mis à jour !", "success");
  chargerComptesParCategorie();
  setTimeout(closeEditJoueurModal, 900);
});

// ---- Modale "Catégories" ----
const categoriesBtn = document.getElementById("categories-btn");
const categoriesModal = document.getElementById("categories-modal");
const categoriesModalBackdrop = document.getElementById("categories-modal-backdrop");
const categorieForm = document.getElementById("categorie-form");
const ncNomInput = document.getElementById("nc-nom-input");
const categorieFormMessage = document.getElementById("categorie-form-message");
const categorieSubmitBtn = document.getElementById("categorie-submit-btn");
const categoriesList = document.getElementById("categories-list");

function setCategorieMessage(text, type) {
  categorieFormMessage.hidden = !text;
  categorieFormMessage.textContent = text || "";
  categorieFormMessage.className = "modal-message" + (type ? ` modal-message--${type}` : "");
}

async function chargerCategoriesModal() {
  categoriesList.innerHTML = `<li class="account-item"><span class="account-item__name">Chargement...</span></li>`;
  const categories = await chargerListeCategories();

  if (categories.length === 0) {
    categoriesList.innerHTML = `<li class="account-item"><span class="account-item__name">Aucune catégorie pour l'instant</span></li>`;
    return;
  }

  categoriesList.innerHTML = categories.map((c) => `
    <li class="account-item" data-id="${c.id}" data-nom="${c.nom}">
      <div class="account-item__info">
        <span class="account-item__name">${c.nom}</span>
        <span class="account-item__date">${c.nb_joueurs} joueur${c.nb_joueurs > 1 ? "s" : ""}</span>
      </div>
      <div class="account-item__actions">
        <button type="button" class="account-action-btn" data-action="renommer" title="Renommer">${ICON_EDIT}</button>
        <button type="button" class="account-action-btn account-action-btn--danger" data-action="supprimer" title="Supprimer">${ICON_TRASH}</button>
      </div>
    </li>
  `).join("");
}

function openCategoriesModal() {
  setCategorieMessage(null);
  categorieForm.reset();
  categoriesModal.classList.add("open");
  categoriesModalBackdrop.classList.add("open");
  chargerCategoriesModal();
}

function closeCategoriesModal() {
  categoriesModal.classList.remove("open");
  categoriesModalBackdrop.classList.remove("open");
}

categoriesBtn.addEventListener("click", openCategoriesModal);
categoriesModalBackdrop.addEventListener("click", closeCategoriesModal);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeCategoriesModal();
});

categorieForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setCategorieMessage(null);

  const nom = ncNomInput.value.trim();
  if (!nom) {
    setCategorieMessage("Merci de renseigner un nom.", "error");
    return;
  }

  categorieSubmitBtn.disabled = true;
  categorieSubmitBtn.textContent = "Création...";

  const { error } = await supabase.rpc("creer_categorie", { p_nom: nom });

  categorieSubmitBtn.disabled = false;
  categorieSubmitBtn.textContent = "Créer";

  if (error) {
    console.error(error);
    setCategorieMessage(error.message || "Une erreur est survenue. Merci de réessayer.", "error");
    return;
  }

  ncNomInput.value = "";
  setCategorieMessage("Catégorie créée !", "success");
  chargerCategoriesModal();
});

categoriesList.addEventListener("click", async (event) => {
  const btn = event.target.closest(".account-action-btn");
  if (!btn) return;

  const item = btn.closest(".account-item");
  const id = item?.dataset.id;
  const nom = item?.dataset.nom;
  if (!id) return;

  if (btn.dataset.action === "renommer") {
    const nouveauNom = prompt("Nouveau nom de la catégorie :", nom);
    if (!nouveauNom || nouveauNom.trim() === "" || nouveauNom.trim() === nom) return;

    const { error } = await supabase.rpc("renommer_categorie", { p_id: id, p_nom: nouveauNom.trim() });
    if (error) {
      console.error(error);
      alert(error.message || "Impossible de renommer cette catégorie.");
      return;
    }
    chargerCategoriesModal();
  } else if (btn.dataset.action === "supprimer") {
    const confirme = confirm(`Supprimer la catégorie "${nom}" ? Les joueurs qu'elle contient repasseront "sans catégorie".`);
    if (!confirme) return;

    const { error } = await supabase.rpc("supprimer_categorie", { p_id: id });
    if (error) {
      console.error(error);
      alert(error.message || "Impossible de supprimer cette catégorie.");
      return;
    }
    chargerCategoriesModal();
  }
});
