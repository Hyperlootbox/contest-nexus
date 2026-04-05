const SearchUtils = window.SearchUtils;
const problemDetail = document.getElementById("problemDetail");
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

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

function getProblemIdFromLocation() {
    return getUrlParams().get("id");
}

function getSearchStateFromUrl() {
    let params = getUrlParams();

    let min = Number(params.get("min"));
    let max = Number(params.get("max"));

    return {
        titleQuery: params.get("title") || "",
        contestQuery: params.get("contest") || "",
        topicQuery: params.get("topic") || "",
        minDifficulty: Number.isFinite(min) && min >= 1 && min <= 60 ? min : 1,
        maxDifficulty: Number.isFinite(max) && max >= 1 && max <= 60 ? max : 60
    };
}

function buildSearchParams(searchState) {
    let params = new URLSearchParams();

    if (searchState.titleQuery.trim()) {
        params.set("title", searchState.titleQuery.trim());
    }

    if (searchState.contestQuery) {
        params.set("contest", searchState.contestQuery);
    }

    if (searchState.topicQuery.trim()) {
        params.set("topic", searchState.topicQuery.trim());
    }

    if (searchState.minDifficulty !== 1) {
        params.set("min", String(searchState.minDifficulty));
    }

    if (searchState.maxDifficulty !== 60) {
        params.set("max", String(searchState.maxDifficulty));
    }

    return params;
}

function getBackToResultsHref(searchState) {
    let params = buildSearchParams(searchState);
    let query = params.toString();
    return query ? `index.html?${query}` : "index.html";
}

function getProblemHref(problemId, searchState) {
    let params = buildSearchParams(searchState);
    params.set("id", problemId);
    return `problem.html?${params.toString()}`;
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

function renderMessage(message) {
    problemDetail.innerHTML = `
    <div class="empty-state">${escapeHtml(message)}</div>
  `;
}

function renderProblem(problem, navigation, searchState) {
    let topicTags = (problem.topics || [])
        .map(topic => `<span class="tag">${escapeHtml(topic)}</span>`)
        .join("");

    let choicesHtml = problem.type === "multiple_choice" && Array.isArray(problem.choices)
        ? `
      <ol class="choice-list" type="A">
        ${problem.choices.map(choice => `<li>${escapeHtml(choice)}</li>`).join("")}
      </ol>
    `
        : "";

    let prevHtml = navigation.previousProblem
        ? `<a class="problem-nav-btn" href="${escapeHtml(getProblemHref(navigation.previousProblem.id, searchState))}">← Previous</a>`
        : `<span class="problem-nav-btn disabled">← Previous</span>`;

    let nextHtml = navigation.nextProblem
        ? `<a class="problem-nav-btn" href="${escapeHtml(getProblemHref(navigation.nextProblem.id, searchState))}">Next →</a>`
        : `<span class="problem-nav-btn disabled">Next →</span>`;

    problemDetail.innerHTML = `
        <article class="problem-detail-card">
            <h1 class="problem-detail-title">${escapeHtml(problem.title)}</h1>

            <div class="problem-detail-meta">
            ${escapeHtml(problem.exam || problem.contest || "")}
            |
            ${escapeHtml(problem.field || "")}
            |
            Difficulty ${escapeHtml(problem.difficulty)}
            </div>

            <div class="tag-row">
            ${topicTags}
            </div>

            <div class="problem-detail-section-title">Problem</div>
            <div class="problem-detail-text">${escapeHtml(problem.statement || "")}</div>

            ${choicesHtml}

            <button type="button" id="toggleAnswerBtn" class="solution-btn">Show Answer</button>

            <div class="solution" id="problemAnswerBox">
            <div class="solution-answer">Answer: ${escapeHtml(getAnswerText(problem))}</div>
            <div>${escapeHtml(problem.solution || "")}</div>
            </div>
        </article>

        <div class="problem-detail-nav">
            ${prevHtml}
            <a class="problem-back-link" href="${escapeHtml(getBackToResultsHref(searchState))}">Back to results</a>
            ${nextHtml}
        </div>
    `;
    renderMath(problemDetail);

    let toggleAnswerBtn = document.getElementById("toggleAnswerBtn");
    let problemAnswerBox = document.getElementById("problemAnswerBox");

    toggleAnswerBtn.addEventListener("click", () => {
        let isOpen = problemAnswerBox.classList.toggle("show");
        toggleAnswerBtn.textContent = isOpen ? "Hide Answer" : "Show Answer";
    });
}

async function loadProblem() {
    try {
        let problemId = getProblemIdFromLocation();
        let searchState = getSearchStateFromUrl();

        if (!problemId) {
            renderMessage("No problem id was provided.");
            return;
        }

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

        let problems = await problemsResponse.json();
        let topicsData = await topicsResponse.json();
        let termCatalog = SearchUtils.buildTermCatalog(topicsData);

        let topicParse = SearchUtils.parseTopicExpression(searchState.topicQuery, termCatalog.allTermsSorted);

        if (!topicParse.valid) {
            renderMessage("The saved topic expression in the URL is invalid.");
            return;
        }

        let filteredProblems = SearchUtils.filterProblems(problems, {
            titleQuery: searchState.titleQuery,
            contestQuery: searchState.contestQuery,
            minDifficulty: searchState.minDifficulty,
            maxDifficulty: searchState.maxDifficulty,
            topicParse
        });

        let currentIndex = filteredProblems.findIndex(problem => problem.id === problemId);
        let problem = problems.find(item => item.id === problemId);

        if (!problem) {
            renderMessage("Problem not found.");
            return;
        }

        let navigation = {
            previousProblem: currentIndex > 0 ? filteredProblems[currentIndex - 1] : null,
            nextProblem: currentIndex >= 0 && currentIndex < filteredProblems.length - 1
                ? filteredProblems[currentIndex + 1]
                : null
        };

        renderProblem(problem, navigation, searchState);
    } catch (error) {
        console.error(error);
        renderMessage("Could not load the problem.");
    }
}

loadProblem();