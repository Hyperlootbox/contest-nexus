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
  "CTMC",
  "IMO",
  "EGMO",
  "RMM",
  "Balkan MO",
  "APMO",
  "ISL",
  "Putnam"
];

const contestAliasGroups = [
  {
    label: "HMMT",
    aliases: ["HMMT", "Harvard-MIT Math Tournament", "Harvard MIT Math Tournament"]
  },
  {
    label: "PUMaC",
    aliases: ["PUMaC", "Princeton University Mathematics Competition"]
  },
  {
    label: "SMT",
    aliases: ["SMT", "Stanford Math Tournament"]
  },
  {
    label: "CTMC",
    aliases: ["CTMC", "Canadian Team Mathematics Contest"]
  },
  {
    label: "Fermat",
    aliases: ["Fermat", "Waterloo Fermat"]
  }
];

let problems = [];
let topicsData = { fieldOrder: [], topicsByField: {} };
let currentField = "Algebra";

let contestCatalog = [];
let termCatalog = { allTerms: [], allTermsSorted: [] };
let currentSuggestions = [];
let activeSuggestionIndex = -1;
let hasTopicFocus = false;
let currentContestSuggestions = [];
let activeContestSuggestionIndex = -1;
let hasContestFocus = false;

let currentTopicParse = { valid: true, empty: true, rpn: null, reason: "" };
let appliedTopicParse = { valid: true, empty: true, rpn: null, reason: "" };

let appliedFilters = {
  titleQuery: "",
  contestQuery: "",
  topicQuery: "",
  minDifficulty: 1,
  maxDifficulty: 60
};

const PAGE_SIZE = 25;
const PAGE_TRANSITION_MS = 240;

let currentPage = 1;
let currentTotalPages = 1;
let currentTotalResults = 0;
let activePageJumpSlot = null;
let pageExitTimeoutId = null;
let pageEnterTimeoutId = null;

const searchInput = document.getElementById("search");
const topicInput = document.getElementById("topicInput");
const topicSuggestions = document.getElementById("topicSuggestions");
const contestInput = document.getElementById("contestInput");
const contestSuggestions = document.getElementById("contestSuggestions");
const searchBtn = document.getElementById("searchBtn");

const fieldTabs = document.getElementById("fieldTabs");
const topicPills = document.getElementById("topicPills");
const problemList = document.getElementById("problemList");
const paginationNav = document.getElementById("paginationNav");
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

const contestAliasLookup = contestAliasGroups.reduce((lookup, group) => {
  let normalizedKey = SearchUtils.normalizeContest(group.label);

  lookup.set(normalizedKey, {
    label: group.label,
    searchTerms: group.aliases.map(alias => SearchUtils.normalize(alias))
  });

  return lookup;
}, new Map());

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

function hideContestSuggestions() {
  contestSuggestions.classList.add("hidden");
  contestSuggestions.innerHTML = "";
  currentContestSuggestions = [];
  activeContestSuggestionIndex = -1;
}

function getContestCatalogEntry(value) {
  let label = String(value || "").trim();
  if (!label) return null;

  let normalizedKey = SearchUtils.normalizeContest(label);
  let aliasEntry = contestAliasLookup.get(normalizedKey);
  let displayLabel = aliasEntry ? aliasEntry.label : label;
  let searchTerms = aliasEntry
    ? aliasEntry.searchTerms
    : [SearchUtils.normalize(displayLabel)];

  return {
    label: displayLabel,
    labelLower: SearchUtils.normalize(displayLabel),
    normalizedKey,
    searchTerms
  };
}

function getContestDisplayLabel(value) {
  let entry = getContestCatalogEntry(value);
  return entry ? entry.label : "";
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

function getContestSuggestionMatches(query) {
  let normalizedQuery = SearchUtils.normalize(query);
  let matches = contestCatalog.filter(contest =>
    !normalizedQuery || contest.searchTerms.some(term => term.includes(normalizedQuery))
  );

  matches.sort((a, b) => {
    let aPrefix = contestMatchesPrefix(a, normalizedQuery) ? 0 : 1;
    let bPrefix = contestMatchesPrefix(b, normalizedQuery) ? 0 : 1;

    if (aPrefix !== bPrefix) {
      return aPrefix - bPrefix;
    }

    let aIndex = contestMatchIndex(a, normalizedQuery);
    let bIndex = contestMatchIndex(b, normalizedQuery);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    if (a.label.length !== b.label.length) {
      return a.label.length - b.label.length;
    }

    return a.label.localeCompare(b.label);
  });

  return normalizedQuery ? matches.slice(0, 12) : matches;
}

function contestMatchesPrefix(contest, normalizedQuery) {
  if (!normalizedQuery) return true;

  return contest.searchTerms.some(term => term.startsWith(normalizedQuery));
}

function contestMatchIndex(contest, normalizedQuery) {
  if (!normalizedQuery) return 0;

  let indexes = contest.searchTerms
    .map(term => term.indexOf(normalizedQuery))
    .filter(index => index >= 0);

  return indexes.length > 0 ? Math.min(...indexes) : Number.POSITIVE_INFINITY;
}

function renderContestSuggestions() {
  if (!hasContestFocus) {
    hideContestSuggestions();
    return;
  }

  currentContestSuggestions = getContestSuggestionMatches(contestInput.value);

  if (currentContestSuggestions.length === 0) {
    hideContestSuggestions();
    return;
  }

  if (
    activeContestSuggestionIndex < 0 ||
    activeContestSuggestionIndex >= currentContestSuggestions.length
  ) {
    activeContestSuggestionIndex = 0;
  }

  contestSuggestions.innerHTML = currentContestSuggestions
    .map((contest, index) => `
      <div
        class="suggestion-item ${index === activeContestSuggestionIndex ? "active" : ""}"
        data-contest-suggestion-index="${index}"
      >
        <span class="suggestion-main">${escapeHtml(contest.label)}</span>
        <span class="suggestion-meta">Contest</span>
      </div>
    `)
    .join("");

  contestSuggestions.classList.remove("hidden");
}

function applyContestSuggestion(contest) {
  if (!contest) return;

  contestInput.value = contest.label;
  contestInput.focus();
  contestInput.setSelectionRange(contest.label.length, contest.label.length);
  hideContestSuggestions();
}

function applyContestSuggestionByIndex(index) {
  let contest = currentContestSuggestions[index];
  if (!contest) return;
  applyContestSuggestion(contest);
}

function moveContestSuggestion(step) {
  if (contestSuggestions.classList.contains("hidden")) {
    renderContestSuggestions();

    if (currentContestSuggestions.length === 0) {
      return;
    }

    activeContestSuggestionIndex = step > 0
      ? 0
      : currentContestSuggestions.length - 1;
    renderContestSuggestions();
    return;
  }

  activeContestSuggestionIndex = (
    activeContestSuggestionIndex +
    step +
    currentContestSuggestions.length
  ) % currentContestSuggestions.length;

  renderContestSuggestions();
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
  let previousValue = getContestDisplayLabel(contestInput.value);

  let discoveredContests = Array.from(
    new Set(
      problems.map(problem => problem.contest).filter(Boolean)
    )
  )
    .filter(contest => !contestList.includes(contest))
    .sort((a, b) => a.localeCompare(b));

  contestCatalog = Array.from(
    new Map(
      [...contestList, ...discoveredContests]
        .map(getContestCatalogEntry)
        .filter(Boolean)
        .map(contest => [contest.normalizedKey, contest])
    ).values()
  ).sort((a, b) => a.label.localeCompare(b.label));

  contestInput.value = previousValue;

  if (hasContestFocus) {
    renderContestSuggestions();
  } else {
    hideContestSuggestions();
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

function clampPage(page, totalPages = currentTotalPages) {
  let numericPage = Number(page);
  let safeTotalPages = Math.max(1, totalPages);

  if (!Number.isFinite(numericPage)) {
    return 1;
  }

  return Math.min(Math.max(1, Math.trunc(numericPage)), safeTotalPages);
}

function getFilteredProblems() {
  return SearchUtils.filterProblems(problems, {
    titleQuery: appliedFilters.titleQuery,
    contestQuery: appliedFilters.contestQuery,
    minDifficulty: appliedFilters.minDifficulty,
    maxDifficulty: appliedFilters.maxDifficulty,
    topicParse: appliedTopicParse
  });
}

function buildProblemRowsHtml(visibleProblems) {
  return visibleProblems
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
              ${escapeHtml(problem.contest || "")}
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
}

function clearProblemListAnimation() {
  if (pageExitTimeoutId !== null) {
    window.clearTimeout(pageExitTimeoutId);
    pageExitTimeoutId = null;
  }

  if (pageEnterTimeoutId !== null) {
    window.clearTimeout(pageEnterTimeoutId);
    pageEnterTimeoutId = null;
  }

  problemList.classList.remove(
    "is-animating",
    "page-exit",
    "page-enter",
    "page-forward",
    "page-backward"
  );
  problemList.style.transition = "";
}

function updateProblemListContent(nextHtml) {
  problemList.innerHTML = nextHtml;
  renderMath(problemList);
}

function animateProblemListChange(nextHtml, direction) {
  clearProblemListAnimation();

  problemList.classList.add("is-animating", "page-exit", `page-${direction}`);

  pageExitTimeoutId = window.setTimeout(() => {
    // Position the incoming page instantly on the opposite side, then animate it in.
    problemList.style.transition = "none";
    updateProblemListContent(nextHtml);
    problemList.classList.remove("page-exit");
    problemList.classList.add("page-enter", `page-${direction}`);
    problemList.getBoundingClientRect();
    problemList.style.transition = "";

    window.requestAnimationFrame(() => {
      problemList.classList.remove("page-enter");
    });

    pageEnterTimeoutId = window.setTimeout(() => {
      clearProblemListAnimation();
    }, PAGE_TRANSITION_MS);
  }, PAGE_TRANSITION_MS);
}

function renderProblemRows(visibleProblems, options = {}) {
  let { animate = false, direction = "forward" } = options;
  let nextHtml = buildProblemRowsHtml(visibleProblems);

  if (!animate || !problemList.children.length) {
    clearProblemListAnimation();
    updateProblemListContent(nextHtml);
    return;
  }

  animateProblemListChange(nextHtml, direction);
}

function getPaginationItems() {
  let items = [
    { type: "page", page: 1 }
  ];

  if (currentTotalPages === 1) {
    return items;
  }

  if (currentPage > 2) {
    items.push({ type: "jump", slot: "left" });
  }

  if (currentPage !== 1 && currentPage !== currentTotalPages) {
    items.push({ type: "page", page: currentPage });
  }

  if (currentPage < currentTotalPages - 1) {
    items.push({ type: "jump", slot: "right" });
  }

  items.push({ type: "page", page: currentTotalPages });

  return items;
}

function renderPaginationItem(item) {
  if (item.type === "page") {
    let isCurrent = item.page === currentPage;

    return `
      <button
        type="button"
        class="pagination-btn pagination-page ${isCurrent ? "is-current" : ""}"
        data-page="${item.page}"
        ${isCurrent ? "disabled" : ""}
      >
        ${item.page}
      </button>
    `;
  }

  if (activePageJumpSlot === item.slot) {
    return `
      <form class="pagination-jump-form" data-page-jump-form="${item.slot}">
        <input
          class="pagination-jump-input"
          data-page-jump-input="${item.slot}"
          type="number"
          min="1"
          max="${currentTotalPages}"
          value="${currentPage}"
          aria-label="Jump to page"
        >
      </form>
    `;
  }

  return `
    <button
      type="button"
      class="pagination-btn pagination-ellipsis"
      data-page-jump-slot="${item.slot}"
      aria-label="Jump to a page"
    >
      ...
    </button>
  `;
}

function renderPagination() {
  if (currentTotalResults <= PAGE_SIZE) {
    activePageJumpSlot = null;
    paginationNav.innerHTML = "";
    paginationNav.classList.add("hidden");
    return;
  }

  let items = getPaginationItems();

  paginationNav.innerHTML = `
    <button
      type="button"
      class="pagination-btn pagination-nav-btn ${currentPage === 1 ? "is-disabled" : ""}"
      data-page="${currentPage - 1}"
      ${currentPage === 1 ? "disabled" : ""}
    >
      Previous
    </button>

    <div class="pagination-pages">
      ${items.map(renderPaginationItem).join("")}
    </div>

    <button
      type="button"
      class="pagination-btn pagination-nav-btn ${currentPage === currentTotalPages ? "is-disabled" : ""}"
      data-page="${currentPage + 1}"
      ${currentPage === currentTotalPages ? "disabled" : ""}
    >
      Next
    </button>
  `;

  paginationNav.classList.remove("hidden");

  if (activePageJumpSlot) {
    let jumpInput = paginationNav.querySelector(`[data-page-jump-input="${activePageJumpSlot}"]`);

    if (jumpInput) {
      jumpInput.focus();
      jumpInput.select();
    }
  }
}

function changePage(nextPage) {
  let targetPage = clampPage(nextPage);

  if (targetPage === currentPage) {
    activePageJumpSlot = null;
    renderPagination();
    return;
  }

  let direction = targetPage > currentPage ? "forward" : "backward";
  currentPage = targetPage;
  activePageJumpSlot = null;
  syncUrlToAppliedFilters();
  renderProblems({ animate: true, direction });
}

function submitPageJump(value) {
  let targetPage = Number(value);

  activePageJumpSlot = null;

  if (!Number.isFinite(targetPage)) {
    renderPagination();
    return;
  }

  changePage(targetPage);
}

function renderProblems(options = {}) {
  let { animate = false, direction = "forward" } = options;

  if (!appliedTopicParse.valid) {
    clearProblemListAnimation();
    problemList.innerHTML = `
      <div class="invalid-state">
        The topic expression is invalid, so no problems are being shown.
      </div>
    `;
    currentTotalResults = 0;
    currentTotalPages = 1;
    renderPagination();
    return;
  }

  let filteredProblems = getFilteredProblems();
  currentTotalResults = filteredProblems.length;
  currentTotalPages = Math.max(1, Math.ceil(currentTotalResults / PAGE_SIZE));
  let clampedPage = clampPage(currentPage, currentTotalPages);

  if (clampedPage !== currentPage) {
    currentPage = clampedPage;
    syncUrlToAppliedFilters();
  }

  if (filteredProblems.length === 0) {
    clearProblemListAnimation();
    problemList.innerHTML = `
      <div class="empty-state">
        No problems matched your current filters.
      </div>
    `;
    renderPagination();
    return;
  }

  let startIndex = (currentPage - 1) * PAGE_SIZE;
  let visibleProblems = filteredProblems.slice(startIndex, startIndex + PAGE_SIZE);

  renderProblemRows(visibleProblems, { animate, direction });
  renderPagination();
}

function refreshTopicExpression() {
  renderTopicState();
  renderSuggestions();
}

function applyFilters(options = {}) {
  let { resetPage = true, animate = false, direction = "forward" } = options;

  appliedFilters = {
    titleQuery: searchInput.value,
    contestQuery: getContestDisplayLabel(contestInput.value),
    topicQuery: topicInput.value,
    minDifficulty: Number(difficultyMinInput.value),
    maxDifficulty: Number(difficultyMaxInput.value)
  };

  if (resetPage) {
    currentPage = 1;
  }

  activePageJumpSlot = null;
  appliedTopicParse = { ...currentTopicParse };
  syncUrlToAppliedFilters();
  renderProblems({ animate, direction });
}

function refreshAll() {
  renderFieldTabs();
  renderContestOptions();
  renderTopicPills();
  updateDifficultyUi();
  refreshTopicExpression();
  applyFilters({ resetPage: false });
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
    applyFilters({ resetPage: false });
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

  if (currentPage !== 1) {
    params.set("page", String(currentPage));
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
  contestInput.value = getContestDisplayLabel(params.get("contest") || "");
  currentPage = clampPage(Number(params.get("page")) || 1, Number.MAX_SAFE_INTEGER);

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

contestSuggestions.addEventListener("mousedown", event => {
  let item = event.target.closest("[data-contest-suggestion-index]");
  if (!item) return;

  event.preventDefault();
  applyContestSuggestionByIndex(Number(item.dataset.contestSuggestionIndex));
});

searchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    applyFilters();
  }
});

paginationNav.addEventListener("click", event => {
  let pageButton = event.target.closest("[data-page]");

  if (pageButton && !pageButton.disabled) {
    changePage(Number(pageButton.dataset.page));
    return;
  }

  let jumpButton = event.target.closest("[data-page-jump-slot]");

  if (!jumpButton) return;

  activePageJumpSlot = jumpButton.dataset.pageJumpSlot;
  renderPagination();
});

paginationNav.addEventListener("submit", event => {
  let jumpForm = event.target.closest("[data-page-jump-form]");
  if (!jumpForm) return;

  event.preventDefault();

  let jumpInput = jumpForm.querySelector("[data-page-jump-input]");
  submitPageJump(jumpInput ? jumpInput.value : "");
});

paginationNav.addEventListener("keydown", event => {
  let jumpInput = event.target.closest("[data-page-jump-input]");
  if (!jumpInput) return;

  if (event.key === "Escape") {
    event.preventDefault();
    activePageJumpSlot = null;
    renderPagination();
  }
});

paginationNav.addEventListener("focusout", event => {
  let jumpInput = event.target.closest("[data-page-jump-input]");
  if (!jumpInput) return;

  window.setTimeout(() => {
    if (!paginationNav.contains(document.activeElement)) {
      activePageJumpSlot = null;
      renderPagination();
    }
  }, 0);
});

contestInput.addEventListener("input", renderContestSuggestions);

contestInput.addEventListener("focus", () => {
  hasContestFocus = true;
  renderContestSuggestions();
});

contestInput.addEventListener("click", () => {
  hasContestFocus = true;
  renderContestSuggestions();
});

contestInput.addEventListener("blur", () => {
  hasContestFocus = false;
  hideContestSuggestions();
});

contestInput.addEventListener("keydown", event => {
  if (event.key === "Enter") {
    event.preventDefault();
    hideContestSuggestions();
    applyFilters();
    return;
  }

  if (event.key === "ArrowDown") {
    if (currentContestSuggestions.length > 0 || SearchUtils.normalize(contestInput.value) || contestCatalog.length > 0) {
      event.preventDefault();
      moveContestSuggestion(1);
    }
    return;
  }

  if (event.key === "ArrowUp") {
    if (currentContestSuggestions.length > 0 || SearchUtils.normalize(contestInput.value) || contestCatalog.length > 0) {
      event.preventDefault();
      moveContestSuggestion(-1);
    }
    return;
  }

  if (event.key === "Tab" && currentContestSuggestions.length > 0) {
    event.preventDefault();
    applyContestSuggestionByIndex(
      activeContestSuggestionIndex >= 0 ? activeContestSuggestionIndex : 0
    );
    return;
  }

  if (event.key === "Escape") {
    hideContestSuggestions();
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
