const SearchUtils = window.SearchUtils;
const problemDetail = document.getElementById("problemDetail");
const backLink = document.querySelector(".back-link");
const PAGE_SIZE = 25;
const PROBLEM_TRANSITION_MS = 240;

let siteDataPromise = null;
let problemExitTimeoutId = null;
let problemEnterTimeoutId = null;
let problemRenderRequestId = 0;

function normalizeNavigationLabels() {
    if (backLink) {
        backLink.innerHTML = "&larr; Back to search";
    }

    let navButtons = problemDetail.querySelectorAll(".problem-nav-btn");

    if (navButtons[0]) {
        navButtons[0].innerHTML = "&larr; Previous";
    }

    if (navButtons[1]) {
        navButtons[1].innerHTML = "Next &rarr;";
    }
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

function getSearchStateFromParams(params) {
    let min = Number(params.get("min"));
    let max = Number(params.get("max"));
    let page = Number(params.get("page"));

    return {
        titleQuery: params.get("title") || "",
        contestQuery: params.get("contest") || "",
        topicQuery: params.get("topic") || "",
        minDifficulty: Number.isFinite(min) && min >= 1 && min <= 60 ? min : 1,
        maxDifficulty: Number.isFinite(max) && max >= 1 && max <= 60 ? max : 60,
        page: Number.isFinite(page) && page >= 1 ? Math.trunc(page) : 1
    };
}

function getSearchStateFromUrl() {
    return getSearchStateFromParams(getUrlParams());
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

    if (searchState.page && searchState.page !== 1) {
        params.set("page", String(searchState.page));
    }

    return params;
}

function getBackToResultsHref(searchState) {
    let params = buildSearchParams(searchState);
    let query = params.toString();
    return query ? `search.html?${query}` : "search.html";
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

function clearProblemDetailAnimation() {
    if (problemExitTimeoutId !== null) {
        window.clearTimeout(problemExitTimeoutId);
        problemExitTimeoutId = null;
    }

    if (problemEnterTimeoutId !== null) {
        window.clearTimeout(problemEnterTimeoutId);
        problemEnterTimeoutId = null;
    }

    problemDetail.classList.remove(
        "is-animating",
        "problem-exit",
        "problem-enter",
        "problem-forward",
        "problem-backward"
    );
    problemDetail.style.transition = "";
}

function animateProblemDetailChange(renderNextProblem, direction) {
    if (!problemDetail.children.length) {
        clearProblemDetailAnimation();
        renderNextProblem();
        return;
    }

    clearProblemDetailAnimation();
    problemDetail.classList.add("is-animating", "problem-exit", `problem-${direction}`);

    problemExitTimeoutId = window.setTimeout(() => {
        problemDetail.style.transition = "none";
        renderNextProblem();

        problemDetail.classList.remove("problem-exit");
        problemDetail.classList.add("problem-enter", `problem-${direction}`);
        problemDetail.getBoundingClientRect();
        problemDetail.style.transition = "";

        window.requestAnimationFrame(() => {
            problemDetail.classList.remove("problem-enter");
        });

        problemEnterTimeoutId = window.setTimeout(() => {
            clearProblemDetailAnimation();
        }, PROBLEM_TRANSITION_MS);
    }, PROBLEM_TRANSITION_MS);
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
    let statementImagesHtml = renderProblemImages(problem.statementImages || problem.statementImage);
    let problemBodyClass = statementImagesHtml
        ? "problem-detail-body has-images"
        : "problem-detail-body";
    let solutionImagesHtml = renderProblemImages(problem.solutionImages || problem.solutionImage);
    let creditHtml = renderProblemCredit(problem);

    let prevHtml = navigation.previousProblem
        ? `<a class="problem-nav-btn" href="${escapeHtml(getProblemHref(navigation.previousProblem.id, searchState))}">&larr; Previous</a>`
        : `<span class="problem-nav-btn disabled">&larr; Previous</span>`;

    let nextHtml = navigation.nextProblem
        ? `<a class="problem-nav-btn" href="${escapeHtml(getProblemHref(navigation.nextProblem.id, searchState))}">Next &rarr;</a>`
        : `<span class="problem-nav-btn disabled">Next &rarr;</span>`;

    problemDetail.innerHTML = `
        <article class="problem-detail-card">
            <h1 class="problem-detail-title">${escapeHtml(problem.title)}</h1>

            <div class="problem-detail-meta">
            ${escapeHtml(problem.contest || "")}
            |
            ${escapeHtml(problem.field || "")}
            |
            Difficulty ${escapeHtml(problem.difficulty)}
            </div>

            <div class="tag-row">
            ${topicTags}
            </div>

            <div class="problem-detail-section-title">Problem</div>
            <div class="${problemBodyClass}">
              <div class="problem-detail-copy">
                <div class="problem-detail-text">${escapeHtml(problem.statement || "")}</div>
                ${choicesHtml}
              </div>
              ${statementImagesHtml ? `<aside class="problem-detail-media">${statementImagesHtml}</aside>` : ""}
            </div>

            <button type="button" id="toggleAnswerBtn" class="solution-btn">Show Answer</button>

            <div class="solution" id="problemAnswerBox">
            <div class="solution-answer">Answer: ${escapeHtml(getAnswerText(problem))}</div>
            <div>${escapeHtml(problem.solution || "")}</div>
            ${solutionImagesHtml}
            </div>
            ${creditHtml}
        </article>

        <div class="problem-detail-nav">
            ${prevHtml}
            <a class="problem-back-link" href="${escapeHtml(getBackToResultsHref(searchState))}">Back to results</a>
            ${nextHtml}
        </div>
    `;
    normalizeNavigationLabels();

    let navItems = problemDetail.querySelectorAll(".problem-detail-nav > *");
    let previousLink = navItems[0];
    let resultsLink = navItems[1];
    let nextLink = navItems[2];

    if (navigation.previousProblem && navigation.previousSearchState && previousLink && previousLink.tagName === "A") {
        previousLink.setAttribute(
            "href",
            getProblemHref(navigation.previousProblem.id, navigation.previousSearchState)
        );
    }

    if (resultsLink && resultsLink.tagName === "A") {
        resultsLink.setAttribute(
            "href",
            getBackToResultsHref(navigation.currentSearchState || searchState)
        );
    }

    if (navigation.nextProblem && navigation.nextSearchState && nextLink && nextLink.tagName === "A") {
        nextLink.setAttribute(
            "href",
            getProblemHref(navigation.nextProblem.id, navigation.nextSearchState)
        );
    }

    renderMath(problemDetail);

    let toggleAnswerBtn = document.getElementById("toggleAnswerBtn");
    let problemAnswerBox = document.getElementById("problemAnswerBox");

    toggleAnswerBtn.addEventListener("click", () => {
        let isOpen = problemAnswerBox.classList.toggle("show");
        toggleAnswerBtn.textContent = isOpen ? "Hide Answer" : "Show Answer";
    });
}

async function getSiteData() {
    if (!siteDataPromise) {
        siteDataPromise = (async () => {
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

            return {
                problems,
                topicsData,
                termCatalog: SearchUtils.buildTermCatalog(topicsData)
            };
        })();
    }

    return siteDataPromise;
}

function buildProblemViewModel(siteData, problemId, searchState) {
    let { problems, termCatalog } = siteData;
    let topicParse = SearchUtils.parseTopicExpression(searchState.topicQuery, termCatalog.allTermsSorted);

    if (!topicParse.valid) {
        return {
            errorMessage: "The saved topic expression in the URL is invalid."
        };
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
        return {
            errorMessage: "Problem not found."
        };
    }

    return {
        problem,
        navigation: {
            currentSearchState: {
                ...searchState,
                page: currentIndex >= 0 ? Math.floor(currentIndex / PAGE_SIZE) + 1 : searchState.page
            },
            previousProblem: currentIndex > 0 ? filteredProblems[currentIndex - 1] : null,
            previousSearchState: currentIndex > 0
                ? { ...searchState, page: Math.floor((currentIndex - 1) / PAGE_SIZE) + 1 }
                : null,
            nextProblem: currentIndex >= 0 && currentIndex < filteredProblems.length - 1
                ? filteredProblems[currentIndex + 1]
                : null,
            nextSearchState: currentIndex >= 0 && currentIndex < filteredProblems.length - 1
                ? { ...searchState, page: Math.floor((currentIndex + 1) / PAGE_SIZE) + 1 }
                : null
        }
    };
}

function renderProblemView(viewModel, searchState, options = {}) {
    let { animate = false, direction = "forward" } = options;
    let renderNextProblem = () => {
        if (viewModel.errorMessage) {
            renderMessage(viewModel.errorMessage);
            document.title = "Problem | Contest Nexus";
            return;
        }

        renderProblem(viewModel.problem, viewModel.navigation, searchState);
        document.title = `${viewModel.problem.title} | Contest Nexus`;
    };

    if (!animate) {
        clearProblemDetailAnimation();
        renderNextProblem();
        return;
    }

    animateProblemDetailChange(renderNextProblem, direction);
}

async function showProblem(problemId, searchState, options = {}) {
    let {
        animate = false,
        direction = "forward",
        historyMode = "replace"
    } = options;
    let requestId = ++problemRenderRequestId;

    try {
        if (!problemId) {
            clearProblemDetailAnimation();
            renderMessage("No problem id was provided.");
            document.title = "Problem | Contest Nexus";
            return;
        }

        let siteData = await getSiteData();

        if (requestId !== problemRenderRequestId) {
            return;
        }

        let viewModel = buildProblemViewModel(siteData, problemId, searchState);

        if (historyMode === "push") {
            window.history.pushState({}, "", getProblemHref(problemId, searchState));
        } else if (historyMode === "replace") {
            window.history.replaceState({}, "", getProblemHref(problemId, searchState));
        }

        renderProblemView(viewModel, searchState, { animate, direction });
    } catch (error) {
        console.error(error);
        clearProblemDetailAnimation();
        renderMessage("Could not load the problem.");
        document.title = "Problem | Contest Nexus";
    }
}

function handleProblemNavigationClick(event) {
    let navLink = event.target.closest(".problem-nav-btn[href]");

    if (!navLink || !problemDetail.contains(navLink)) {
        return;
    }

    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
    }

    event.preventDefault();

    let targetUrl = new URL(navLink.href, window.location.href);
    let targetProblemId = targetUrl.searchParams.get("id");
    let targetSearchState = getSearchStateFromParams(targetUrl.searchParams);
    let direction = navLink.textContent.includes("Next") ? "forward" : "backward";

    showProblem(targetProblemId, targetSearchState, {
        animate: true,
        direction,
        historyMode: "push"
    });
}
function normalizeImageEntries(rawValue) {
    if (!rawValue) {
        return [];
    }

    let items = Array.isArray(rawValue) ? rawValue : [rawValue];

    return items
        .map(item => {
            if (typeof item === "string") {
                return {
                    src: item,
                    alt: "",
                    caption: ""
                };
            }

            if (item && typeof item === "object") {
                return {
                    src: item.src || "",
                    alt: item.alt || "",
                    caption: item.caption || ""
                };
            }

            return null;
        })
        .filter(item => item && item.src);
}

function renderProblemImages(rawValue) {
    let images = normalizeImageEntries(rawValue);

    if (images.length === 0) {
        return "";
    }

    return `
    <div class="problem-image-gallery">
      ${images.map(image => `
        <figure class="problem-figure">
          <img
            class="problem-image"
            src="${escapeHtml(image.src)}"
            alt="${escapeHtml(image.alt)}"
            loading="lazy"
          >
          ${image.caption ? `<figcaption class="problem-figcaption">${escapeHtml(image.caption)}</figcaption>` : ""}
        </figure>
      `).join("")}
    </div>
  `;
}

function renderProblemCredit(problem) {
    if (!problem.credit) {
        return "";
    }

    return `
    <footer class="problem-credit">
      Credit: ${escapeHtml(problem.credit)}
    </footer>
  `;
}

problemDetail.addEventListener("click", handleProblemNavigationClick);

window.addEventListener("popstate", () => {
    showProblem(getProblemIdFromLocation(), getSearchStateFromUrl(), {
        animate: true,
        historyMode: "none"
    });
});

showProblem(getProblemIdFromLocation(), getSearchStateFromUrl(), {
    historyMode: "replace"
});
normalizeNavigationLabels();
