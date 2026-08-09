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
const mapHint = document.getElementById("map-hint");
const submitProofBtn = document.getElementById("submit-proof-btn");
const formMessage = document.getElementById("form-message");

let dureeSecondes = 0;
let lanceLe = null;
let imageFile = null; // Blob de l'image collée, prête à être uploadée
let lieuLat = null;
let lieuLng = null;
let map = null;
let marker = null;
let preuveEnvoyee = false; // état courant, mis à jour à chaque changement d'affichage

// ---- Configuration de la carte GTA V (reprise de map.html) ----
const MAP_TILE_SIZE = 256;
const MAP_MIN_ZOOM = -2;
const MAP_MAX_ZOOM = 5;
const MAP_TILES_AT_MAX_ZOOM = 32;

const MAP_STYLES = {
  atlas: "mapStyles/styleAtlas/{z}/{x}/{y}.jpg",
  satellite: "mapStyles/styleSatelite/{z}/{x}/{y}.jpg",
};

const MAP_STYLE_BG = {
  atlas: "#0FA8D2",
  satellite: "#153E6A",
};

const MAP_PLACES = {
  "los santos": { x: 115, y: -197 }, "vinewood": { x: 125, y: -170 },
  "vinewood hills": { x: 111, y: -154 }, "richman": { x: 88, y: -171 },
  "rockford hills": { x: 101, y: -179 }, "place des cubes": { x: 122, y: -192 },
  "pillbox hill": { x: 120, y: -187 }, "little seoul": { x: 105, y: -192 },
  "la mesa": { x: 133, y: -194 }, "el burro heights": { x: 145, y: -207 },
  "cypress flats": { x: 136, y: -224 }, "pont rouge": { x: 133, y: -227 },
  "pont vert": { x: 108, y: -220 }, "terminal": { x: 137, y: -239 },
  "port de los santos": { x: 117, y: -225 }, "del perro": { x: 84, y: -188 },
  "fete forraine": { x: 84, y: -194 }, "vespucci": { x: 96, y: -185 },
  "vespucci beach": { x: 88, y: -204 }, "marina": { x: 99, y: -202 },
  "morningwood": { x: 89, y: -178 }, "hawick": { x: 124, y: -178 },
  "davis": { x: 124, y: -205 }, "strawberry": { x: 117, y: -206 },
  "champs petrole": { x: 148, y: -217 }, "rancho": { x: 124, y: -215 },
  "mirror park": { x: 140, y: -184 }, "golf": { x: 92, y: -171 },
  "cimetiere": { x: 82, y: -171 }, "eclipse": { x: 102, y: -168 },
  "spanish avenue": { x: 115, y: -171 }, "harmony": { x: 125, y: -114 },
  "sandy shores": { x: 153, y: -96 }, "grapeseed": { x: 161, y: -71 },
  "paleto": { x: 114, y: -42 }, "mont chiliad": { x: 128, y: -59 },
  "aérodrome sandy shores": { x: 145, y: -109 }, "fort zancudo": { x: 74, y: -108 },
  "marécages": { x: 76, y: -120 }, "chumash": { x: 52, y: -153 },
  "banham canyon": { x: 69, y: -149 }, "tongva hills": { x: 69, y: -132 },
  "mont josiah": { x: 96, y: -98 }, "stab city": { x: 119, y: -97 },
  "lac de sandy shores": { x: 141, y: -89 }, "mount gordo": { x: 175, y: -49 },
  "mine": { x: 176, y: -114 }, "palmer station": { x: 175, y: -141 },
  "plage alcatraz": { x: 175, y: -187 }, "aéroport": { x: 115, y: -171 },
};

let mapCurrentLayer = null;
const mapLayerCache = {};

function loadMapStyle(styleKey) {
  if (mapCurrentLayer) map.removeLayer(mapCurrentLayer);

  if (!mapLayerCache[styleKey]) {
    mapLayerCache[styleKey] = L.tileLayer(MAP_STYLES[styleKey], {
      tileSize: MAP_TILE_SIZE,
      minZoom: MAP_MIN_ZOOM,
      maxZoom: MAP_MAX_ZOOM,
      noWrap: true,
      errorTileUrl: "",
    });
  }
  mapCurrentLayer = mapLayerCache[styleKey];
  mapCurrentLayer.addTo(map);

  document.getElementById("map").style.background = MAP_STYLE_BG[styleKey];

  document.querySelectorAll(".map-style-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.style === styleKey);
  });
}

function mapSearch() {
  const raw = document.getElementById("map-search").value.trim();
  if (!raw) return;

  const coordMatch = raw.match(/^(-?\d+(\.\d+)?)\s*,\s*(-?\d+(\.\d+)?)$/);
  if (coordMatch) {
    const x = parseFloat(coordMatch[1]);
    const y = parseFloat(coordMatch[3]);
    map.setView([y, x], MAP_MAX_ZOOM);
    return;
  }

  const key = raw.toLowerCase();
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const wordBoundaryRegex = new RegExp("(^|\\s)" + escapedKey);
  const matchKey = Object.keys(MAP_PLACES).find((name) => wordBoundaryRegex.test(name));
  if (matchKey) {
    const p = MAP_PLACES[matchKey];
    map.setView([p.y, p.x], MAP_MAX_ZOOM);
  }
}

// ---- Carte pour sélectionner le lieu du défi ----
function initMap() {
  if (map) return; // déjà initialisée

  map = L.map("map", {
    crs: L.CRS.Simple,
    minZoom: MAP_MIN_ZOOM,
    maxZoom: MAP_MAX_ZOOM,
    zoomControl: true,
    attributionControl: false,
  });

  loadMapStyle("atlas");

  const mapPixelSize = MAP_TILE_SIZE * MAP_TILES_AT_MAX_ZOOM;
  const southWest = map.unproject([0, mapPixelSize], MAP_MAX_ZOOM);
  const northEast = map.unproject([mapPixelSize, 0], MAP_MAX_ZOOM);
  const fullBounds = L.latLngBounds(southWest, northEast);

  map.setMaxBounds(fullBounds);
  // On évite fitBounds() ici : dans ce petit conteneur (200px de haut), il
  // calculerait un zoom hors de la plage couverte par les tuiles (0 à 5),
  // ce qui affichait juste le fond bleu. On centre plutôt à un zoom fixe
  // qui existe vraiment.
  map.setView(fullBounds.getCenter(), 0);

  map.on("click", (event) => {
    lieuLat = event.latlng.lat;
    lieuLng = event.latlng.lng;

    if (marker) {
      marker.setLatLng(event.latlng);
    } else {
      marker = L.marker(event.latlng).addTo(map);
    }

    mapHint.textContent = `Lieu sélectionné (x: ${Math.round(lieuLng)}, y: ${Math.round(lieuLat)})`;
    mapHint.classList.add("map-hint--ok");
  });

  document.querySelectorAll(".map-style-btn").forEach((btn) => {
    btn.addEventListener("click", () => loadMapStyle(btn.dataset.style));
  });

  document.getElementById("map-search").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      mapSearch();
    }
  });

  setTimeout(() => map.invalidateSize(), 200);
}

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
  initMap();
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

  if (lieuLat === null || lieuLng === null) {
    setFormMessage("Merci d'indiquer le lieu du défi sur la carte.", "error");
    return;
  }

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
      p_latitude: lieuLat,
      p_longitude: lieuLng,
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
