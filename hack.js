// ---- Garde d'accès ----
// Cette page n'a de sens que juste après une connexion admin réussie.
const identifiant = sessionStorage.getItem("identifiant");
const role = sessionStorage.getItem("role");

if (role !== "admin") {
  window.location.href = "index.html";
}

// Si l'accès a déjà été validé (ex : retour arrière du navigateur après
// résolution), on ne fait pas refaire le puzzle.
if (sessionStorage.getItem("acces_verifie") === "1") {
  window.location.href = "admin.html";
}

const identifiantLabel = document.getElementById("identifiant-label");
if (identifiantLabel && identifiant) {
  identifiantLabel.textContent = identifiant.toUpperCase();
}

// ---- Configuration du puzzle ----
const GRID_SIZE = 5;
const SYMBOL_POOL = ["1C", "55", "BD", "E9", "7A", "FF"];
const BUFFER_SIZE = 6;
const REQUIRED_LENGTH = 4;
const TIME_LIMIT = 45; // secondes

const matrixEl = document.getElementById("matrix");
const bufferRowEl = document.getElementById("buffer-row");
const sequenceCodesEl = document.getElementById("sequence-codes");
const timerFillEl = document.getElementById("timer-fill");
const timerValueEl = document.getElementById("timer-value");
const cancelBtn = document.getElementById("cancel-btn");
const resultOverlay = document.getElementById("result-overlay");
const resultCard = document.getElementById("result-card");
const resultTitle = document.getElementById("result-title");
const resultSub = document.getElementById("result-sub");
const resultBtn = document.getElementById("result-btn");

let grid = [];
let requiredSequence = [];
let picks = []; // { row, col }
let cellButtons = []; // référence DOM indexée [row][col]
let currentConstraint = null; // { type: "row" | "col", index }
let timeRemaining = TIME_LIMIT;
let timerIntervalId = null;
let gameOver = false;

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
  const usedInCol = {};
  const usedInRow = {};

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

function buildRequiredSequence() {
  const path = generateValidPath(BUFFER_SIZE);

  // Sécurité : si jamais le parcours généré est trop court (grille
  // exceptionnellement contrainte), on retente.
  if (path.length < REQUIRED_LENGTH) {
    return buildRequiredSequence();
  }

  const maxStart = path.length - REQUIRED_LENGTH;
  const start = Math.floor(Math.random() * (maxStart + 1));
  const slice = path.slice(start, start + REQUIRED_LENGTH);

  return slice.map(({ row, col }) => grid[row][col]);
}

function renderMatrix() {
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

function renderSequence(progress) {
  sequenceCodesEl.innerHTML = "";
  requiredSequence.forEach((code, i) => {
    const chip = document.createElement("div");
    chip.className = "seq-chip";
    if (i < progress) chip.classList.add("seq-chip--progress");
    chip.textContent = code;
    sequenceCodesEl.appendChild(chip);
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

      if (selectable) {
        cell.classList.add("cell--selectable");
      } else {
        cell.classList.add("cell--used");
      }
    }
  }
}

// Vérifie si la séquence requise apparaît, dans l'ordre et de façon
// contiguë, quelque part dans les coups déjà joués.
function computeFullMatch() {
  const symbols = picks.map(({ row, col }) => grid[row][col]);
  if (symbols.length < REQUIRED_LENGTH) return false;

  for (let start = 0; start <= symbols.length - REQUIRED_LENGTH; start++) {
    let ok = true;
    for (let i = 0; i < REQUIRED_LENGTH; i++) {
      if (symbols[start + i] !== requiredSequence[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

// Longueur du plus long suffixe des coups joués qui correspond à un
// préfixe de la séquence requise — sert uniquement à l'affichage de la
// progression (glow progressif sur les puces de la séquence).
function computeProgress() {
  const symbols = picks.map(({ row, col }) => grid[row][col]);
  const maxLen = Math.min(symbols.length, REQUIRED_LENGTH);

  for (let len = maxLen; len > 0; len--) {
    const suffix = symbols.slice(symbols.length - len);
    const prefix = requiredSequence.slice(0, len);
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

  renderBuffer();
  updateSelectableCells();

  const progress = computeProgress();
  renderSequence(progress);

  if (computeFullMatch()) {
    endGame(true);
    return;
  }

  if (picks.length >= BUFFER_SIZE) {
    endGame(false);
  }
}

// ---- Minuteur ----
function startTimer() {
  const start = Date.now();
  timerIntervalId = setInterval(() => {
    const elapsed = (Date.now() - start) / 1000;
    timeRemaining = Math.max(0, TIME_LIMIT - elapsed);
    timerValueEl.textContent = timeRemaining.toFixed(2);
    timerFillEl.style.width = `${(timeRemaining / TIME_LIMIT) * 100}%`;

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
    sessionStorage.setItem("acces_verifie", "1");
  } else {
    resultTitle.textContent = "ÉCHEC DU PIRATAGE";
    resultSub.textContent = "La séquence n'a pas été validée à temps.";
    resultBtn.textContent = "Réessayer";
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

  buildGrid();
  requiredSequence = buildRequiredSequence();

  renderMatrix();
  renderBuffer();
  renderSequence(0);
  updateSelectableCells();

  timerFillEl.style.width = "100%";
  timerValueEl.textContent = TIME_LIMIT.toFixed(2);

  startTimer();
}

startPuzzle();
