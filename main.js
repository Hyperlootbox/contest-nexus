const SearchUtils = window.SearchUtils;

const contestList = [
  "AMC 8",
  "AMC 10A",
  "AMC 10B",
  "AMC 12A",
  "AMC 12B",
  "AIME I",
  "AIME II",
  "USAJMO",
  "USAMO",
  "AJHSME",
  "AHSME",
  "ARML",
  "Purple Comet",
  "Math Prize for Girls",
  "HMMT",
  "CHMMC",
  "PUMaC",
  "Harvard-MIT Math Tournament",
  "Princeton University Mathematics Competition",
  "Stanford Math Tournament",
  "SMT",
  "BMO",
  "BMO1",
  "BMO2",
  "UKMT Intermediate Mathematical Challenge",
  "UKMT Senior Mathematical Challenge",
  "KMO",
  "COMC",
  "CMO",
  "CJMO",
  "Pascal",
  "Cayley",
  "Fermat",
  "Euclid",
  "Hypatia",
  "Galois",
  "Canadian Team Mathematics Contest",
  "CTMC",
  "IMO",
  "EGMO",
  "RMM",
  "Balkan MO",
  "APMO",
  "ISL",
  "Putnam"
];

let problems = [];
let topicsData = { fieldOrder: [], topicsByField: {} };
let currentField = "Algebra";

let termCatalog = { allTerms: [], allTermsSorted: [] };
let currentSuggestions = [];
let activeSuggestionIndex = -1;
let hasTopicFocus = false;

let currentTopicParse = { valid: true, empty: true, rpn: null, reason: "" };
let appliedTopicParse = { valid: true, empty: true, rpn: null, reason: "" };

let appliedFilters = {
  titleQuery: "",
  contestQuery: "",
  topicQuery: "",
  minDifficulty: 1,
  maxDifficulty: 60
};

const searchInput = document.getElementById("search");
const topicInput = document.getElementById("topicInput");
const topicSuggestions = document.getElementById("topicSuggestions");
const contestSelect = document.getElementById("contestSelect");
const searchBtn = document.getElementById("searchBtn");

const fieldTabs = document.getElementById("fieldTabs");
const topicPills = document.getElementById("topicPills");
const problemList = document.getElementById("problemList");
const topicStatus = document.getElementById("topicStatus");

const clearTopicsBtn = document.getElementById("clearTopicsBtn");
const backspaceBtn = document.getElementById("backspaceBtn");
const andBtn = document.getElementById("andBtn");
const orBtn = document.getElementById("orBtn");
const openParenBtn = document.getElementById("openParenBtn");
const closeParenBtn = document.getElementById("closeParenBtn");

const difficultyMinInput = document.getElementById("difficultyMin");
const difficultyMaxInput = document.getElementById("difficultyMax");
const difficultyRangeText = document.getElementById("difficultyRangeText");
const dualRangeFill = document.getElementById("dualRangeFill");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hideSuggestions() {
  topicSuggestions.classList.add("hidden");
  topicSuggestions.innerHTML = "";
  currentSuggestions = [];
  activeSuggestionIndex = -1;
}

function renderSuggestions() {
  if (!hasTopicFocus) {
    hideSuggestions();
    return;
  }

  let caret = topicInput.selectionStart ?? topicInput.value.length;
  let fragment = SearchUtils.getCurrentFragmentData(topicInput.value, caret);
  currentSuggestions = SearchUtils.getSuggestionMatches(fragment.query, termCatalog.allTerms, currentField);

  if (currentSuggestions.length === 0) {
    hideSuggestions();
    return;
  }

  if (
    currentSuggestions.length === 1 &&
    SearchUtils.normalize(fragment.query) === currentSuggestions[0].labelLower
  ) {
    hideSuggestions();
    return;
  }

  if (activeSuggestionIndex < 0 || activeSuggestionIndex >= currentSuggestions.length) {
    activeSuggestionIndex = 0;
  }

  topicSuggestions.innerHTML = currentSuggestions
    .map((term, index) => `
      <div
        class="suggestion-item ${index === activeSuggestionIndex ? "active" : ""}"
        data-suggestion-index="${index}"
      >
        <span class="suggestion-main">${escapeHtml(term.label)}</span>
        <span class="suggestion-meta">${escapeHtml(term.kind === "field" ? "Field" : term.field)}</span>
      </div>
    `)
    .join("");

  topicSuggestions.classList.remove("hidden");
}

function applySuggestion(term) {
  let caret = topicInput.selectionStart ?? topicInput.value.length;
  let fragment = SearchUtils.getCurrentFragmentData(topicInput.value, caret);

  let text = topicInput.value;
  let before = text.slice(0, fragment.start);
  let after = text.slice(fragment.end);

  let prefixSpace = before.length > 0 && !/[\s(]$/.test(before) ? " " : "";
  let suffixSpace = after.length === 0 ? " " : (!/^[\s)]/.test(after) ? " " : "");

  let insertion = prefixSpace + term.label + suffixSpace;
  let newValue = before + insertion + after;
  let newCaret = (before + insertion).length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function applySuggestionByIndex(index) {
  let term = currentSuggestions[index];
  if (!term) return;
  applySuggestion(term);
}

function replaceSelection(textToInsert) {
  let start = topicInput.selectionStart ?? 0;
  let end = topicInput.selectionEnd ?? start;
  let value = topicInput.value;
  let newValue = value.slice(0, start) + textToInsert + value.slice(end);
  let newCaret = start + textToInsert.length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function insertBinaryOperator(operator) {
  let start = topicInput.selectionStart ?? 0;
  let end = topicInput.selectionEnd ?? start;
  let value = topicInput.value;
  let before = value.slice(0, start);
  let after = value.slice(end);

  let prefixSpace = before.length > 0 && !/[\s(]$/.test(before) ? " " : "";
  let suffixSpace = " ";

  let insertion = prefixSpace + operator + suffixSpace;
  let newValue = before + insertion + after;
  let newCaret = (before + insertion).length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function insertOpenParen() {
  let start = topicInput.selectionStart ?? 0;
  let end = topicInput.selectionEnd ?? start;
  let value = topicInput.value;
  let before = value.slice(0, start);
  let after = value.slice(end);

  let prefixSpace = before.length > 0 && !/[\s(]$/.test(before) ? " " : "";
  let insertion = prefixSpace + "(";
  let newValue = before + insertion + after;
  let newCaret = (before + insertion).length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function insertCloseParen() {
  replaceSelection(")");
}

function backspaceExpression() {
  let start = topicInput.selectionStart ?? 0;
  let end = topicInput.selectionEnd ?? start;
  let value = topicInput.value;

  if (start !== end) {
    topicInput.value = value.slice(0, start) + value.slice(end);
    topicInput.focus();
    topicInput.setSelectionRange(start, start);
    refreshTopicExpression();
    return;
  }

  if (start === 0) {
    return;
  }

  topicInput.value = value.slice(0, start - 1) + value.slice(start);
  topicInput.focus();
  topicInput.setSelectionRange(start - 1, start - 1);
  refreshTopicExpression();
}

function clearExpression() {
  topicInput.value = "";
  topicInput.focus();
  refreshTopicExpression();
}

function renderTopicState() {
  currentTopicParse = SearchUtils.parseTopicExpression(topicInput.value, termCatalog.allTermsSorted);

  topicInput.classList.remove("invalid");

  if (!topicStatus) {
    return;
  }

  topicStatus.className = "topic-status";

  if (!currentTopicParse.valid) {
    topicInput.classList.add("invalid");
    topicStatus.classList.add("error");
    topicStatus.textContent = currentTopicParse.reason;
    return;
  }

  if (currentTopicParse.empty) {
    topicStatus.textContent = "Precedence: parentheses, AND, OR.";
    return;
  }

  topicStatus.classList.add("ok");
  topicStatus.textContent = "Expression is valid.";
}

function renderFieldTabs() {
  fieldTabs.innerHTML = topicsData.fieldOrder
    .map(field => `
      <button
        type="button"
        class="field-tab ${field === currentField ? "active" : ""}"
        data-field="${escapeHtml(field)}"
      >
        ${escapeHtml(field)}
      </button>
    `)
    .join("");
}

function renderTopicPills() {
  let topicsForField = topicsData.topicsByField[currentField] || [];

  let fieldPill = `
    <button
      type="button"
      class="topic-pill field-pill"
      data-kind="field"
      data-value="${escapeHtml(currentField)}"
      data-label="${escapeHtml(`All ${currentField}`)}"
    >
      All ${escapeHtml(currentField)}
    </button>
  `;

  let topicPillHtml = topicsForField
    .map(topic => `
      <button
        type="button"
        class="topic-pill"
        data-kind="topic"
        data-value="${escapeHtml(topic)}"
        data-label="${escapeHtml(topic)}"
      >
        ${escapeHtml(topic)}
      </button>
    `)
    .join("");

  topicPills.innerHTML = fieldPill + topicPillHtml;
}

function renderContestOptions() {
  let previousValue = contestSelect.value;

  let discoveredContests = Array.from(
    new Set(
      problems.flatMap(problem => [problem.exam, problem.contest]).filter(Boolean)
    )
  )
    .filter(contest => !contestList.includes(contest))
    .sort((a, b) => a.localeCompare(b));

  let allContests = [...contestList, ...discoveredContests];

  contestSelect.innerHTML = `
    <option value="">All contests</option>
    ${allContests.map(contest => `
      <option value="${escapeHtml(contest)}">${escapeHtml(contest)}</option>
    `).join("")}
  `;

  if (allContests.includes(previousValue)) {
    contestSelect.value = previousValue;
  } else {
    contestSelect.value = "";
  }
}

function updateDifficultyUi() {
  let min = Number(difficultyMinInput.value);
  let max = Number(difficultyMaxInput.value);

  difficultyRangeText.textContent = `${min} to ${max}`;

  let minPercent = ((min - 1) / 59) * 100;
  let maxPercent = ((max - 1) / 59) * 100;

  dualRangeFill.style.left = `${minPercent}%`;
  dualRangeFill.style.right = `${100 - maxPercent}%`;
}

function getDifficultyLabel(difficulty) {
  return `Difficulty ${difficulty}`;
}

function getAnswerText(problem) {
  if (
    problem.type === "multiple_choice" &&
    Array.isArray(problem.choices) &&
    typeof problem.answerIndex === "number"
  ) {
    let letter = String.fromCharCode(65 + problem.answerIndex);
    let answerChoice = problem.choices[problem.answerIndex];
    return `${letter}. ${answerChoice}`;
  }

  if (problem.answer !== undefined && problem.answer !== null && problem.answer !== "") {
    return String(problem.answer);
  }

  return "Not set";
}

function renderProblems() {
  if (!appliedTopicParse.valid) {
    problemList.innerHTML = `
      <div class="invalid-state">
        The topic expression is invalid, so no problems are being shown.
      </div>
    `;
    return;
  }

  let filteredProblems = SearchUtils.filterProblems(problems, {
    titleQuery: appliedFilters.titleQuery,
    contestQuery: appliedFilters.contestQuery,
    minDifficulty: appliedFilters.minDifficulty,
    maxDifficulty: appliedFilters.maxDifficulty,
    topicParse: appliedTopicParse
  });

  if (filteredProblems.length === 0) {
    problemList.innerHTML = `
      <div class="empty-state">
        No problems matched your current filters.
      </div>
    `;
    return;
  }

  problemList.innerHTML = filteredProblems
    .map(problem => {
      let visibleTopics = (problem.topics || []).slice(0, 3);

      let topicTags = visibleTopics
        .map(topic => `<span class="problem-row-tag">${escapeHtml(topic)}</span>`)
        .join("");

      return `
        <a class="problem-row" href="${escapeHtml(getProblemHref(problem.id))}">
          <div class="problem-row-main">
            <div class="problem-row-title">${escapeHtml(problem.title)}</div>
            <div class="problem-row-meta">
              ${escapeHtml(problem.exam || problem.contest || "")}
              <span class="problem-row-sep">|</span>
              ${escapeHtml(problem.field || "")}
              <span class="problem-row-sep">|</span>
              ${escapeHtml(getDifficultyLabel(problem.difficulty))}
            </div>
          </div>

          <div class="problem-row-tags">
            ${topicTags}
          </div>
        </a>
      `;
    })
    .join("");
    renderMath(problemList);
}

function refreshTopicExpression() {
  renderTopicState();
  renderSuggestions();
}

function applyFilters() {
  appliedFilters = {
    titleQuery: searchInput.value,
    contestQuery: contestSelect.value,
    topicQuery: topicInput.value,
    minDifficulty: Number(difficultyMinInput.value),
    maxDifficulty: Number(difficultyMaxInput.value)
  };

  appliedTopicParse = { ...currentTopicParse };
  syncUrlToAppliedFilters();
  renderProblems();
}

function refreshAll() {
  renderFieldTabs();
  renderContestOptions();
  renderTopicPills();
  updateDifficultyUi();
  refreshTopicExpression();
  applyFilters();
}

async function loadData() {
  try {
    let [problemsResponse, topicsResponse] = await Promise.all([
      fetch("data/problems.json"),
      fetch("data/topics.json")
    ]);

    if (!problemsResponse.ok) {
      throw new Error("Could not load data/problems.json");
    }

    if (!topicsResponse.ok) {
      throw new Error("Could not load data/topics.json");
    }

    problems = await problemsResponse.json();
    topicsData = await topicsResponse.json();

    termCatalog = SearchUtils.buildTermCatalog(topicsData);

    currentField = topicsData.fieldOrder.includes("Algebra")
      ? "Algebra"
      : topicsData.fieldOrder[0];

    renderFieldTabs();
    renderContestOptions();
    renderTopicPills();
    readInitialFiltersFromUrl();
    updateDifficultyUi();
    refreshTopicExpression();
    applyFilters();
  } catch (error) {
    console.error(error);
    problemList.innerHTML = `
      <div class="empty-state">
        Could not load the site data. Make sure you are running the site through Live Server or another local web server.
      </div>
    `;
  }
}
function buildAppliedSearchParams() {
  let params = new URLSearchParams();

  if (appliedFilters.titleQuery.trim()) {
    params.set("title", appliedFilters.titleQuery.trim());
  }

  if (appliedFilters.contestQuery) {
    params.set("contest", appliedFilters.contestQuery);
  }

  if (appliedFilters.topicQuery.trim()) {
    params.set("topic", appliedFilters.topicQuery.trim());
  }

  if (appliedFilters.minDifficulty !== 1) {
    params.set("min", String(appliedFilters.minDifficulty));
  }

  if (appliedFilters.maxDifficulty !== 60) {
    params.set("max", String(appliedFilters.maxDifficulty));
  }

  return params;
}

function syncUrlToAppliedFilters() {
  let params = buildAppliedSearchParams();
  let query = params.toString();
  let nextUrl = query ? `?${query}` : window.location.pathname;
  history.replaceState(null, "", nextUrl);
}

function readInitialFiltersFromUrl() {
  let params = new URLSearchParams(window.location.search);

  searchInput.value = params.get("title") || "";
  topicInput.value = params.get("topic") || "";

  let contestValue = params.get("contest") || "";
  let hasContestOption = Array.from(contestSelect.options).some(option => option.value === contestValue);
  contestSelect.value = hasContestOption ? contestValue : "";

  let min = Number(params.get("min"));
  let max = Number(params.get("max"));

  if (Number.isFinite(min) && min >= 1 && min <= 60) {
    difficultyMinInput.value = String(min);
  } else {
    difficultyMinInput.value = "1";
  }

  if (Number.isFinite(max) && max >= 1 && max <= 60) {
    difficultyMaxInput.value = String(max);
  } else {
    difficultyMaxInput.value = "60";
  }

  if (Number(difficultyMinInput.value) > Number(difficultyMaxInput.value)) {
    difficultyMaxInput.value = difficultyMinInput.value;
  }
}

function getProblemHref(problemId) {
  let params = buildAppliedSearchParams();
  params.set("id", problemId);
  return `problem.html?${params.toString()}`;
}
function renderMath(rootElement) {
  if (!rootElement || typeof window.renderMathInElement !== "function") {
    return;
  }

  window.renderMathInElement(rootElement, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "\\[", right: "\\]", display: true },
      { left: "\\(", right: "\\)", display: false },
      { left: "$", right: "$", display: false }
    ],
    throwOnError: false
  });
}

fieldTabs.addEventListener("click", event => {
  let button = event.target.closest("button[data-field]");
  if (!button) return;

  currentField = button.dataset.field;
  renderFieldTabs();
  renderTopicPills();
  renderSuggestions();
});

topicPills.addEventListener("click", event => {
  let button = event.target.closest("button[data-label]");
  if (!button) return;

  applySuggestion({
    label: button.dataset.label,
    labelLower: SearchUtils.normalize(button.dataset.label),
    kind: button.dataset.kind,
    value: button.dataset.value,
    field: button.dataset.kind === "field" ? button.dataset.value : currentField
  });
});

topicSuggestions.addEventListener("mousedown", event => {
  let item = event.target.closest("[data-suggestion-index]");
  if (!item) return;

  event.preventDefault();
  applySuggestionByIndex(Number(item.dataset.suggestionIndex));
  hideSuggestions();
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyFilters();
  }
});

topicInput.addEventListener("input", refreshTopicExpression);

topicInput.addEventListener("focus", () => {
  hasTopicFocus = true;
  renderSuggestions();
});

topicInput.addEventListener("click", () => {
  hasTopicFocus = true;
  renderSuggestions();
});

topicInput.addEventListener("blur", () => {
  hasTopicFocus = false;
  hideSuggestions();
});

topicInput.addEventListener("keyup", event => {
  if (["ArrowUp", "ArrowDown", "Tab", "Escape", "Enter"].includes(event.key)) {
    return;
  }

  renderSuggestions();
});

topicInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    hideSuggestions();
    applyFilters();
    return;
  }

  if (event.key === "ArrowDown" && currentSuggestions.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex + 1) % currentSuggestions.length;
    renderSuggestions();
    return;
  }

  if (event.key === "ArrowUp" && currentSuggestions.length > 0) {
    event.preventDefault();
    activeSuggestionIndex = (activeSuggestionIndex - 1 + currentSuggestions.length) % currentSuggestions.length;
    renderSuggestions();
    return;
  }

  if (event.key === "Tab" && currentSuggestions.length > 0) {
    event.preventDefault();
    applySuggestionByIndex(activeSuggestionIndex >= 0 ? activeSuggestionIndex : 0);
    hideSuggestions();
    return;
  }

  if (event.key === "Escape") {
    hideSuggestions();
  }
});

clearTopicsBtn.addEventListener("click", clearExpression);
backspaceBtn.addEventListener("click", backspaceExpression);
andBtn.addEventListener("click", () => insertBinaryOperator("AND"));
orBtn.addEventListener("click", () => insertBinaryOperator("OR"));
openParenBtn.addEventListener("click", insertOpenParen);
closeParenBtn.addEventListener("click", insertCloseParen);

difficultyMinInput.addEventListener("input", () => {
  let min = Number(difficultyMinInput.value);
  let max = Number(difficultyMaxInput.value);

  if (min > max) {
    difficultyMaxInput.value = String(min);
  }

  updateDifficultyUi();
});

difficultyMaxInput.addEventListener("input", () => {
  let min = Number(difficultyMinInput.value);
  let max = Number(difficultyMaxInput.value);

  if (max < min) {
    difficultyMinInput.value = String(max);
  }

  updateDifficultyUi();
});

searchBtn.addEventListener("click", applyFilters);

loadData();