let problems = [];
let topicsData = { fieldOrder: [], topicsByField: {} };
let currentField = "Algebra";

let allTerms = [];
let allTermsSorted = [];
let currentSuggestions = [];
let activeSuggestionIndex = -1;
let hasTopicFocus = false;
let currentTopicParse = { valid: true, empty: true, rpn: null, reason: "" };

const searchInput = document.getElementById("search");
const topicInput = document.getElementById("topicInput");
const topicSuggestions = document.getElementById("topicSuggestions");
const topicStatus = document.getElementById("topicStatus");
const fieldTabs = document.getElementById("fieldTabs");
const topicPills = document.getElementById("topicPills");
const problemList = document.getElementById("problemList");

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

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function buildTermCatalog() {
  allTerms = [];

  for (const field of topicsData.fieldOrder) {
    allTerms.push({
      label: `All ${field}`,
      labelLower: normalize(`All ${field}`),
      kind: "field",
      value: field,
      field
    });

    for (const topic of topicsData.topicsByField[field] || []) {
      allTerms.push({
        label: topic,
        labelLower: normalize(topic),
        kind: "topic",
        value: topic,
        field
      });
    }
  }

  allTermsSorted = [...allTerms].sort((a, b) => {
    if (b.label.length !== a.label.length) {
      return b.label.length - a.label.length;
    }

    return a.label.localeCompare(b.label);
  });
}

function matchBoundaryBefore(text, index) {
  return index === 0 || /[\s()]/.test(text[index - 1]);
}

function matchBoundaryAfter(text, index) {
  return index >= text.length || /[\s()]/.test(text[index]);
}

function matchesOperator(text, index, op) {
  return (
    text.slice(index, index + op.length) === op &&
    matchBoundaryBefore(text, index) &&
    matchBoundaryAfter(text, index + op.length)
  );
}

function tokenizeExpression(text) {
  const tokens = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];

    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }

    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch });
      i += 1;
      continue;
    }

    let matchedTerm = null;

    for (const term of allTermsSorted) {
      const end = i + term.label.length;

      if (
        text.slice(i, end).toLowerCase() === term.labelLower &&
        matchBoundaryBefore(text, i) &&
        matchBoundaryAfter(text, end)
      ) {
        matchedTerm = term;
        break;
      }
    }

    if (matchedTerm) {
      tokens.push({
        type: "term",
        kind: matchedTerm.kind,
        value: matchedTerm.value,
        label: matchedTerm.label
      });
      i += matchedTerm.label.length;
      continue;
    }

    if (matchesOperator(text, i, "AND")) {
      tokens.push({ type: "binary", value: "AND" });
      i += 3;
      continue;
    }

    if (matchesOperator(text, i, "OR")) {
      tokens.push({ type: "binary", value: "OR" });
      i += 2;
      continue;
    }

    let end = i + 1;
    while (end < text.length && !/[\s()]/.test(text[end])) {
      end += 1;
    }

    throw new Error(`Unknown token near "${text.slice(i, end)}"`);
  }

  return tokens;
}

function validateTokens(tokens) {
  let expectingOperand = true;
  let openParens = 0;

  for (const token of tokens) {
    if (expectingOperand) {
      if (token.type === "term") {
        expectingOperand = false;
        continue;
      }

      if (token.type === "paren" && token.value === "(") {
        openParens += 1;
        continue;
      }

      throw new Error("Expected a topic, All Field, or (");
    }

    if (token.type === "binary") {
      expectingOperand = true;
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      if (openParens <= 0) {
        throw new Error("Unmatched closing parenthesis");
      }

      openParens -= 1;
      continue;
    }

    throw new Error("Expected AND, OR, or )");
  }

  if (expectingOperand) {
    throw new Error("Expression cannot end with AND, OR, or (");
  }

  if (openParens !== 0) {
    throw new Error("Unmatched opening parenthesis");
  }
}

function getOperatorPrecedence(operator) {
  if (operator === "AND") {
    return 2;
  }

  if (operator === "OR") {
    return 1;
  }

  return 0;
}

function toReversePolishNotation(tokens) {
  const output = [];
  const operators = [];

  for (const token of tokens) {
    if (token.type === "term") {
      output.push(token);
      continue;
    }

    if (token.type === "binary") {
      while (
        operators.length > 0 &&
        operators[operators.length - 1].type === "binary" &&
        getOperatorPrecedence(operators[operators.length - 1].value) >= getOperatorPrecedence(token.value)
      ) {
        output.push(operators.pop());
      }

      operators.push(token);
      continue;
    }

    if (token.type === "paren" && token.value === "(") {
      operators.push(token);
      continue;
    }

    if (token.type === "paren" && token.value === ")") {
      while (
        operators.length > 0 &&
        !(operators[operators.length - 1].type === "paren" && operators[operators.length - 1].value === "(")
      ) {
        output.push(operators.pop());
      }

      if (operators.length === 0) {
        throw new Error("Unmatched closing parenthesis");
      }

      operators.pop();
    }
  }

  while (operators.length > 0) {
    const top = operators.pop();

    if (top.type === "paren") {
      throw new Error("Unmatched opening parenthesis");
    }

    output.push(top);
  }

  return output;
}

function parseTopicExpression() {
  const raw = topicInput.value.trim();

  if (!raw) {
    return { valid: true, empty: true, rpn: null, reason: "" };
  }

  try {
    const tokens = tokenizeExpression(topicInput.value);
    validateTokens(tokens);
    const rpn = toReversePolishNotation(tokens);

    return { valid: true, empty: false, rpn, reason: "" };
  } catch (error) {
    return {
      valid: false,
      empty: false,
      rpn: null,
      reason: error.message || "Invalid expression"
    };
  }
}

function termMatchesProblem(term, problem) {
  if (term.kind === "field") {
    return normalize(problem.field) === normalize(term.value);
  }

  if (term.kind === "topic") {
    return Array.isArray(problem.topics) &&
      problem.topics.some(topic => normalize(topic) === normalize(term.value));
  }

  return false;
}

function evaluateExpressionForProblem(rpnTokens, problem) {
  const stack = [];

  for (const token of rpnTokens) {
    if (token.type === "term") {
      stack.push(termMatchesProblem(token, problem));
      continue;
    }

    if (token.type === "binary") {
      if (stack.length < 2) {
        return false;
      }

      const right = stack.pop();
      const left = stack.pop();

      if (token.value === "AND") {
        stack.push(left && right);
      } else if (token.value === "OR") {
        stack.push(left || right);
      }
    }
  }

  return stack.length === 1 ? stack[0] : false;
}

function findFragmentStart(text, caret) {
  const left = text.slice(0, caret);
  const regex = /\bAND\b|\bOR\b|\(|\)/g;
  let start = 0;
  let match;

  while ((match = regex.exec(left))) {
    start = match.index + match[0].length;
  }

  while (start < left.length && /\s/.test(left[start])) {
    start += 1;
  }

  return start;
}

function findFragmentEnd(text, caret) {
  const right = text.slice(caret);
  const regex = /\bAND\b|\bOR\b|\(|\)/g;
  const match = regex.exec(right);
  let end = match ? caret + match.index : text.length;

  while (end > caret && /\s/.test(text[end - 1])) {
    end -= 1;
  }

  return end;
}

function getCurrentFragmentData() {
  const text = topicInput.value;
  const caret = topicInput.selectionStart ?? text.length;
  const start = findFragmentStart(text, caret);
  const end = findFragmentEnd(text, caret);
  const query = text.slice(start, caret).trim();

  return { text, caret, start, end, query };
}

function getSuggestionMatches(query) {
  if (!query) {
    return [];
  }

  const q = normalize(query);

  const matches = allTerms.filter(term => term.labelLower.includes(q));

  matches.sort((a, b) => {
    const aPrefix = a.labelLower.startsWith(q) ? 0 : 1;
    const bPrefix = b.labelLower.startsWith(q) ? 0 : 1;

    if (aPrefix !== bPrefix) {
      return aPrefix - bPrefix;
    }

    const aFieldBoost = a.field === currentField ? 0 : 1;
    const bFieldBoost = b.field === currentField ? 0 : 1;

    if (aFieldBoost !== bFieldBoost) {
      return aFieldBoost - bFieldBoost;
    }

    const aIndex = a.labelLower.indexOf(q);
    const bIndex = b.labelLower.indexOf(q);

    if (aIndex !== bIndex) {
      return aIndex - bIndex;
    }

    if (a.label.length !== b.label.length) {
      return a.label.length - b.label.length;
    }

    return a.label.localeCompare(b.label);
  });

  return matches.slice(0, 8);
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

  const fragment = getCurrentFragmentData();
  currentSuggestions = getSuggestionMatches(fragment.query);

  if (currentSuggestions.length === 0) {
    hideSuggestions();
    return;
  }

  if (
    currentSuggestions.length === 1 &&
    normalize(fragment.query) === currentSuggestions[0].labelLower
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
  const fragment = getCurrentFragmentData();
  const text = topicInput.value;
  const before = text.slice(0, fragment.start);
  const after = text.slice(fragment.end);

  const prefixSpace = before.length > 0 && !/[\s(]$/.test(before) ? " " : "";
  const suffixSpace = after.length === 0 ? " " : (!/^[\s)]/.test(after) ? " " : "");

  const insertion = prefixSpace + term.label + suffixSpace;
  const newValue = before + insertion + after;
  const newCaret = (before + insertion).length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function applySuggestionByIndex(index) {
  const term = currentSuggestions[index];

  if (!term) {
    return;
  }

  applySuggestion(term);
}

function replaceSelection(textToInsert) {
  const start = topicInput.selectionStart ?? 0;
  const end = topicInput.selectionEnd ?? start;
  const value = topicInput.value;
  const newValue = value.slice(0, start) + textToInsert + value.slice(end);
  const newCaret = start + textToInsert.length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function insertBinaryOperator(operator) {
  const start = topicInput.selectionStart ?? 0;
  const end = topicInput.selectionEnd ?? start;
  const value = topicInput.value;
  const before = value.slice(0, start);
  const after = value.slice(end);

  const prefixSpace = before.length > 0 && !/[\s(]$/.test(before) ? " " : "";
  const suffixSpace = after.length > 0 && !/^(\s|\))/.test(after) ? " " : " ";

  const insertion = prefixSpace + operator + suffixSpace;
  const newValue = before + insertion + after;
  const newCaret = (before + insertion).length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function insertOpenParen() {
  const start = topicInput.selectionStart ?? 0;
  const end = topicInput.selectionEnd ?? start;
  const value = topicInput.value;
  const before = value.slice(0, start);
  const after = value.slice(end);

  const prefixSpace = before.length > 0 && !/[\s(]$/.test(before) ? " " : "";
  const insertion = prefixSpace + "(";
  const newValue = before + insertion + after;
  const newCaret = (before + insertion).length;

  topicInput.value = newValue;
  topicInput.focus();
  topicInput.setSelectionRange(newCaret, newCaret);

  refreshTopicExpression();
}

function insertCloseParen() {
  replaceSelection(")");
}

function backspaceExpression() {
  const start = topicInput.selectionStart ?? 0;
  const end = topicInput.selectionEnd ?? start;
  const value = topicInput.value;

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
  currentTopicParse = parseTopicExpression();

  topicInput.classList.remove("invalid");
  topicStatus.classList.remove("error");
  topicStatus.classList.remove("ok");

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
  const topicsForField = topicsData.topicsByField[currentField] || [];

  const fieldPill = `
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

  const topicPillHtml = topicsForField
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

function updateDifficultyUi() {
  const min = Number(difficultyMinInput.value);
  const max = Number(difficultyMaxInput.value);

  difficultyRangeText.textContent = `${min} to ${max}`;

  const minPercent = ((min - 1) / 59) * 100;
  const maxPercent = ((max - 1) / 59) * 100;

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
    const letter = String.fromCharCode(65 + problem.answerIndex);
    const answerChoice = problem.choices[problem.answerIndex];
    return `${letter}. ${answerChoice}`;
  }

  if (problem.answer !== undefined && problem.answer !== null && problem.answer !== "") {
    return String(problem.answer);
  }

  return "Not set";
}

function matchesDifficulty(problem) {
  const min = Number(difficultyMinInput.value);
  const max = Number(difficultyMaxInput.value);
  return problem.difficulty >= min && problem.difficulty <= max;
}

function matchesSearch(problem) {
  const searchValue = normalize(searchInput.value);

  if (!searchValue) {
    return true;
  }

  return normalize(problem.title).includes(searchValue);
}

function renderProblems() {
  if (!currentTopicParse.valid) {
    problemList.innerHTML = `
      <div class="invalid-state">
        The topic expression is invalid, so no problems are being shown.
      </div>
    `;
    return;
  }

  const filteredProblems = problems.filter(problem => {
    const searchMatch = matchesSearch(problem);
    const difficultyMatch = matchesDifficulty(problem);
    const topicMatch = currentTopicParse.empty
      ? true
      : evaluateExpressionForProblem(currentTopicParse.rpn, problem);

    return searchMatch && difficultyMatch && topicMatch;
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
      const topicTags = (problem.topics || [])
        .map(topic => `<span class="tag">${escapeHtml(topic)}</span>`)
        .join("");

      const choicesHtml = problem.type === "multiple_choice" && Array.isArray(problem.choices)
        ? `
          <ol class="choice-list" type="A">
            ${problem.choices.map(choice => `<li>${escapeHtml(choice)}</li>`).join("")}
          </ol>
        `
        : "";

      return `
        <article class="problem-card">
          <h2>${escapeHtml(problem.title)}</h2>

          <div class="meta">
            ${escapeHtml(problem.exam || problem.contest || "")}
            |
            ${escapeHtml(problem.field || "")}
            |
            ${getDifficultyLabel(problem.difficulty)}
          </div>

          <div class="tag-row">
            ${topicTags}
          </div>

          <div class="statement">${escapeHtml(problem.statement || "")}</div>

          ${choicesHtml}

          <button
            type="button"
            class="solution-btn"
            data-solution-id="${escapeHtml(problem.id)}"
          >
            Show Solution
          </button>

          <div class="solution" id="solution-${escapeHtml(problem.id)}">
            <div class="solution-answer">Answer: ${escapeHtml(getAnswerText(problem))}</div>
            <div>${escapeHtml(problem.solution || "")}</div>
          </div>
        </article>
      `;
    })
    .join("");
}

function refreshTopicExpression() {
  renderTopicState();
  renderSuggestions();
  renderProblems();
}

function refreshAll() {
  renderFieldTabs();
  renderTopicPills();
  updateDifficultyUi();
  refreshTopicExpression();
}

async function loadData() {
  try {
    const [problemsResponse, topicsResponse] = await Promise.all([
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

    buildTermCatalog();

    currentField = topicsData.fieldOrder.includes("Algebra")
      ? "Algebra"
      : topicsData.fieldOrder[0];

    refreshAll();
  } catch (error) {
    console.error(error);
    problemList.innerHTML = `
      <div class="empty-state">
        Could not load the site data. Make sure you are running the site through Live Server or another local web server.
      </div>
    `;
  }
}

fieldTabs.addEventListener("click", event => {
  const button = event.target.closest("button[data-field]");
  if (!button) {
    return;
  }

  currentField = button.dataset.field;
  renderFieldTabs();
  renderTopicPills();
  renderSuggestions();
});

topicPills.addEventListener("click", event => {
  const button = event.target.closest("button[data-label]");
  if (!button) {
    return;
  }

  applySuggestion({
    label: button.dataset.label,
    labelLower: normalize(button.dataset.label),
    kind: button.dataset.kind,
    value: button.dataset.value,
    field: button.dataset.kind === "field" ? button.dataset.value : currentField
  });
});

topicSuggestions.addEventListener("mousedown", event => {
  const item = event.target.closest("[data-suggestion-index]");
  if (!item) {
    return;
  }

  event.preventDefault();
  applySuggestionByIndex(Number(item.dataset.suggestionIndex));
  hideSuggestions();
});

problemList.addEventListener("click", event => {
  const button = event.target.closest("button[data-solution-id]");
  if (!button) {
    return;
  }

  const solutionId = button.dataset.solutionId;
  const solutionBox = document.getElementById(`solution-${solutionId}`);

  if (!solutionBox) {
    return;
  }

  const isOpen = solutionBox.classList.toggle("show");
  button.textContent = isOpen ? "Hide Solution" : "Show Solution";
});

searchInput.addEventListener("input", renderProblems);

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
  if (["ArrowUp", "ArrowDown", "Tab", "Escape"].includes(event.key)) {
    return;
  }

  renderSuggestions();
});

topicInput.addEventListener("keydown", event => {
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
  const min = Number(difficultyMinInput.value);
  const max = Number(difficultyMaxInput.value);

  if (min > max) {
    difficultyMaxInput.value = String(min);
  }

  updateDifficultyUi();
  renderProblems();
});

difficultyMaxInput.addEventListener("input", () => {
  const min = Number(difficultyMinInput.value);
  const max = Number(difficultyMaxInput.value);

  if (max < min) {
    difficultyMinInput.value = String(max);
  }

  updateDifficultyUi();
  renderProblems();
});

loadData();