// ---- Garde d'accès ----
// Cette page n'a de sens que juste après une connexion admin réussie.
const identifiant = sessionStorage.getItem("identifiant");
const role = sessionStorage.getItem("role");

if (role !== "admin") {
  window.location.href = "index.html";
}

// L'épreuve doit être refaite à CHAQUE ouverture de cette page, même si
// l'accès avait déjà été validé lors d'une précédente visite dans la
// même session : on invalide donc systématiquement le flag ici, et le
// tableau de bord (admin.html) ne doit se fier qu'à ce flag mis à jour
// après résolution du puzzle plus bas.
sessionStorage.setItem("acces_verifie", "0");

const identifiantLabel = document.getElementById("identifiant-label");
if (identifiantLabel && identifiant) {
  identifiantLabel.textContent = identifiant.toUpperCase();
}

// ---- Configuration du puzzle ----
const GRID_SIZE = 6;
const SYMBOL_POOL = ["1C", "55", "BD", "E9", "7A", "FF"];
const BUFFER_SIZE = 8;
const TIME_LIMIT = 45; // secondes

// Trois paliers affichés. Seul celui marqué "required: true" déverrouille
// réellement le tableau de bord — les deux autres sont des leurres
// ("troll") : les reproduire ne fait rien de spécial pour l'instant.
const DIFFICULTIES = [
  { key: "facile", label: "SÉQUENCE FACILE", length: 3, required: false },
  { key: "moyen", label: "SÉQUENCE MOYENNE", length: 4, required: false },
  { key: "difficile", label: "SÉQUENCE DIFFICILE", length: 6, required: true },
];

const matrixEl = document.getElementById("matrix");
const bufferRowEl = document.getElementById("buffer-row");
const sequenceListEl = document.getElementById("sequence-list");
const timerFillEl = document.getElementById("timer-fill");
const timerValueEl = document.getElementById("timer-value");
const cancelBtn = document.getElementById("cancel-btn");
const resultOverlay = document.getElementById("result-overlay");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultSub = document.getElementById("result-sub");
const resultBtn = document.getElementById("result-btn");
const toastEl = document.getElementById("toast");

let grid = [];
let sequences = {}; // key -> { ...difficulty, codes: [...], matched: bool, rowEl, chipEls }
let picks = []; // { row, col }
let cellButtons = []; // référence DOM indexée [row][col]
let currentConstraint = null; // { type: "row" | "col", index }
let timeRemaining = TIME_LIMIT;
let timerIntervalId = null;
let toastTimeoutId = null;
let gameOver = false;

// ---- Sons (générés via Web Audio, aucun fichier externe nécessaire) ----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;

function unlockAudio() {
  if (!AudioCtx) return;
  if (!audioCtx) audioCtx = new AudioCtx();
  if (audioCtx.state === "suspended") audioCtx.resume();
}
document.addEventListener("pointerdown", unlockAudio, { once: true });

function playTone({ freq = 700, duration = 0.05, type = "sine", gain = 0.04, slideTo = null }) {
  if (!audioCtx || audioCtx.state !== "running") return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo !== null) {
    osc.frequency.linearRampToValueAtTime(slideTo, now + duration);
  }

  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gain, now + 0.006);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gainNode).connect(audioCtx.destination);
  osc.start(now);
  osc.stop(now + duration + 0.03);
}

function playHoverSound() {
  playTone({ freq: 640 + Math.random() * 90, duration: 0.045, type: "sine", gain: 0.03 });
}
function playSelectSound() {
  playTone({ freq: 980, duration: 0.07, type: "square", gain: 0.045 });
}
function playSequenceMatchSound() {
  playTone({ freq: 520, duration: 0.16, type: "sine", gain: 0.05, slideTo: 920 });
}
function playTrollSound() {
  playTone({ freq: 650, duration: 0.22, type: "triangle", gain: 0.05, slideTo: 260 });
}
function playSuccessSound() {
  playTone({ freq: 520, duration: 0.12, gain: 0.06 });
  setTimeout(() => playTone({ freq: 760, duration: 0.12, gain: 0.06 }), 100);
  setTimeout(() => playTone({ freq: 1080, duration: 0.2, gain: 0.07 }), 200);
}
function playFailSound() {
  playTone({ freq: 320, duration: 0.4, type: "sawtooth", gain: 0.05, slideTo: 80 });
}

function showToast(text) {
  toastEl.textContent = text;
  toastEl.classList.add("show");
  clearTimeout(toastTimeoutId);
  toastTimeoutId = setTimeout(() => toastEl.classList.remove("show"), 1600);
}

// ---- Génération de la grille et des séquences ----
function randomSymbol() {
  return SYMBOL_POOL[Math.floor(Math.random() * SYMBOL_POOL.length)];
}

function buildGrid() {
  grid = [];
  for (let r = 0; r < GRID_SIZE; r++) {
    const row = [];
    for (let c = 0; c < GRID_SIZE; c++) {
      row.push(randomSymbol());
    }
    grid.push(row);
  }
}

// Simule un parcours valide (règles de sélection ligne/colonne en
// alternance) pour garantir qu'une solution existe dans la grille générée.
function generateValidPath(length) {
  const path = [];

  let row = 0;
  let col = Math.floor(Math.random() * GRID_SIZE);
  path.push({ row, col });

  let constraint = "col"; // le prochain coup doit rester dans la même colonne

  for (let i = 1; i < length; i++) {
    if (constraint === "col") {
      const candidates = [];
      for (let r = 0; r < GRID_SIZE; r++) {
        const already = path.some((p) => p.row === r && p.col === col);
        if (!already) candidates.push(r);
      }
      if (candidates.length === 0) break;
      row = candidates[Math.floor(Math.random() * candidates.length)];
      path.push({ row, col });
      constraint = "row";
    } else {
      const candidates = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        const already = path.some((p) => p.row === row && p.col === c);
        if (!already) candidates.push(c);
      }
      if (candidates.length === 0) break;
      col = candidates[Math.floor(Math.random() * candidates.length)];
      path.push({ row, col });
      constraint = "col";
    }
  }

  return path;
}

// Construit les 3 séquences à partir d'un même parcours valide, ce qui
// garantit que la séquence "difficile" (celle qui donne réellement accès)
// est toujours atteignable. Les deux autres sont extraites du même
// parcours par confort (donc souvent atteignables aussi), mais leur
// réussite ne débloque rien pour l'instant.
function buildSequences() {
  const path = generateValidPath(BUFFER_SIZE);
  const requiredLength = Math.max(...DIFFICULTIES.map((d) => d.length));

  if (path.length < requiredLength) {
    return buildSequences();
  }

  const result = {};
  DIFFICULTIES.forEach((diff) => {
    const maxStart = path.length - diff.length;
    const start = Math.floor(Math.random() * (maxStart + 1));
    const codes = path.slice(start, start + diff.length).map(({ row, col }) => grid[row][col]);
    result[diff.key] = { ...diff, codes, matched: false, chipEls: [] };
  });

  return result;
}

// ---- Rendu ----
function renderMatrix() {
  matrixEl.style.setProperty("--cols", GRID_SIZE);
  matrixEl.innerHTML = "";
  cellButtons = [];

  for (let r = 0; r < GRID_SIZE; r++) {
    const rowEl = document.createElement("div");
    rowEl.className = "matrix__row";
    const rowButtons = [];

    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = document.createElement("button");
      cell.type = "button";
      cell.className = "cell";
      cell.textContent = grid[r][c];
      cell.addEventListener("click", () => handleCellClick(r, c));
      cell.addEventListener("mouseenter", () => {
        if (cell.classList.contains("cell--selectable")) playHoverSound();
      });
      rowEl.appendChild(cell);
      rowButtons.push(cell);
    }

    matrixEl.appendChild(rowEl);
    cellButtons.push(rowButtons);
  }
}

function renderBuffer() {
  bufferRowEl.innerHTML = "";
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const slot = document.createElement("div");
    slot.className = "buffer-slot";
    if (picks[i]) {
      const { row, col } = picks[i];
      slot.textContent = grid[row][col];
      slot.classList.add("buffer-slot--filled");
    }
    bufferRowEl.appendChild(slot);
  }
}

function renderSequenceList() {
  sequenceListEl.innerHTML = "";

  DIFFICULTIES.forEach((diff) => {
    const seq = sequences[diff.key];

    const row = document.createElement("div");
    row.className = "sequence-row";

    const dot = document.createElement("span");
    dot.className = `diff-dot diff-dot--${diff.key}`;
    row.appendChild(dot);

    const codesWrap = document.createElement("div");
    codesWrap.className = "sequence-row__codes";
    seq.chipEls = [];
    seq.codes.forEach((code) => {
      const chip = document.createElement("div");
      chip.className = "seq-chip";
      chip.textContent = code;
      codesWrap.appendChild(chip);
      seq.chipEls.push(chip);
    });
    row.appendChild(codesWrap);

    const text = document.createElement("div");
    text.className = "sequence-row__text";
    text.innerHTML = `
      <span class="sequence-row__title">${diff.label}</span>
      <span class="sequence-row__desc">Reproduisez cette séquence dans la matrice.</span>
    `;
    row.appendChild(text);

    sequenceListEl.appendChild(row);
    seq.rowEl = row;
  });

  updateSequenceChipStates();
}

function updateSequenceChipStates() {
  DIFFICULTIES.forEach((diff) => {
    const seq = sequences[diff.key];
    if (seq.matched) {
      seq.chipEls.forEach((chip) => chip.classList.add("seq-chip--done"));
      return;
    }
    const progress = computeProgress(seq.codes);
    seq.chipEls.forEach((chip, i) => {
      chip.classList.toggle("seq-chip--progress", i < progress);
    });
  });
}

// Recalcule quelles cases sont sélectionnables selon la contrainte
// courante (ligne ou colonne imposée par le dernier coup) et met à jour
// leur apparence.
function updateSelectableCells() {
  for (let r = 0; r < GRID_SIZE; r++) {
    for (let c = 0; c < GRID_SIZE; c++) {
      const cell = cellButtons[r][c];
      const alreadyPicked = picks.some((p) => p.row === r && p.col === c);

      cell.classList.remove("cell--selectable", "cell--used", "cell--picked");

      if (alreadyPicked) {
        cell.classList.add("cell--picked");
        continue;
      }

      let selectable;
      if (!currentConstraint) {
        // Premier coup : n'importe quelle case de la première ligne.
        selectable = r === 0;
      } else if (currentConstraint.type === "col") {
        selectable = c === currentConstraint.index;
      } else {
        selectable = r === currentConstraint.index;
      }

      cell.classList.add(selectable ? "cell--selectable" : "cell--used");
    }
  }
}

// Vérifie si une séquence donnée apparaît, dans l'ordre et de façon
// contiguë, quelque part dans les coups déjà joués.
function isSequenceMatched(codes) {
  const symbols = picks.map(({ row, col }) => grid[row][col]);
  if (symbols.length < codes.length) return false;

  for (let start = 0; start <= symbols.length - codes.length; start++) {
    let ok = true;
    for (let i = 0; i < codes.length; i++) {
      if (symbols[start + i] !== codes[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

// Longueur du plus long suffixe des coups joués qui correspond à un
// préfixe de la séquence donnée — sert uniquement à l'affichage de la
// progression (glow progressif sur les puces).
function computeProgress(codes) {
  const symbols = picks.map(({ row, col }) => grid[row][col]);
  const maxLen = Math.min(symbols.length, codes.length);

  for (let len = maxLen; len > 0; len--) {
    const suffix = symbols.slice(symbols.length - len);
    const prefix = codes.slice(0, len);
    if (suffix.every((s, i) => s === prefix[i])) return len;
  }
  return 0;
}

function handleCellClick(row, col) {
  if (gameOver) return;

  const alreadyPicked = picks.some((p) => p.row === row && p.col === col);
  if (alreadyPicked) return;

  let valid;
  if (!currentConstraint) {
    valid = row === 0;
  } else if (currentConstraint.type === "col") {
    valid = col === currentConstraint.index;
  } else {
    valid = row === currentConstraint.index;
  }
  if (!valid) return;

  picks.push({ row, col });
  currentConstraint = currentConstraint && currentConstraint.type === "col"
    ? { type: "row", index: row }
    : { type: "col", index: col };

  playSelectSound();
  renderBuffer();
  updateSelectableCells();
  updateSequenceChipStates();

  checkMatches();

  if (!gameOver && picks.length >= BUFFER_SIZE) {
    endGame(false);
  }
}

function checkMatches() {
  DIFFICULTIES.forEach((diff) => {
    const seq = sequences[diff.key];
    if (seq.matched) return;
    if (!isSequenceMatched(seq.codes)) return;

    seq.matched = true;
    updateSequenceChipStates();

    if (diff.required) {
      playSequenceMatchSound();
      endGame(true);
    } else {
      playTrollSound();
      showToast("… Rien ne se passe.");
    }
  });
}

// ---- Minuteur ----
function startTimer() {
  const start = Date.now();
  timerIntervalId = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    timeRemaining = Math.max(0, TIME_LIMIT - elapsed);
    timerValueEl.textContent = timeRemaining.toFixed(2);
    timerFillEl.style.width = `${(timeRemaining / TIME_LIMIT) * 100}%`;

    const critical = timeRemaining <= 10;
    timerFillEl.classList.toggle("timer-bar__fill--warning", critical);
    timerValueEl.classList.toggle("timer-value--warning", critical);

    if (timeRemaining <= 0) {
      endGame(false);
    }
  }, 100);
}

function stopTimer() {
  if (timerIntervalId !== null) {
    clearInterval(timerIntervalId);
    timerIntervalId = null;
  }
}

// ---- Fin de partie ----
function endGame(success) {
  if (gameOver) return;
  gameOver = true;
  stopTimer();

  resultCard.className = "result-card " + (success ? "result-card--success" : "result-card--fail");

  if (success) {
    resultTitle.textContent = "ACCÈS AUTORISÉ";
    resultSub.textContent = "Séquence validée. Ouverture du tableau de bord…";
    resultBtn.textContent = "Continuer";
    playSuccessSound();
    sessionStorage.setItem("acces_verifie", "1");
  } else {
    resultTitle.textContent = "ÉCHEC DE L'AUTHENTIFICATION";
    resultSub.textContent = "La séquence n'a pas été validée à temps.";
    resultBtn.textContent = "Réessayer";
    playFailSound();
  }

  resultOverlay.classList.add("open");

  if (success) {
    setTimeout(() => {
      window.location.href = "admin.html";
    }, 1100);
  }
}

resultBtn.addEventListener("click", () => {
  if (sessionStorage.getItem("acces_verifie") === "1") {
    window.location.href = "admin.html";
  } else {
    startPuzzle();
  }
});

cancelBtn.addEventListener("click", logout);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") logout();
});

function logout() {
  sessionStorage.removeItem("identifiant");
  sessionStorage.removeItem("role");
  sessionStorage.removeItem("acces_verifie");
  window.location.href = "index.html";
}

// ---- Lancement / relance du puzzle ----
function startPuzzle() {
  gameOver = false;
  picks = [];
  currentConstraint = null;
  timeRemaining = TIME_LIMIT;
  resultOverlay.classList.remove("open");
  toastEl.classList.remove("show");

  buildGrid();
  sequences = buildSequences();

  renderMatrix();
  renderBuffer();
  renderSequenceList();
  updateSelectableCells();

  timerFillEl.style.width = "100%";
  timerFillEl.classList.remove("timer-bar__fill--warning");
  timerValueEl.classList.remove("timer-value--warning");
  timerValueEl.textContent = TIME_LIMIT.toFixed(2);

  startTimer();
}

startPuzzle();
