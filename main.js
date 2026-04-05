let problems = [
  {
    title: "AMC 10 2023 Problem 1",
    contest: "AMC 10",
    year: 2023,
    topic: "Algebra",
    difficulty: "Easy",
    statement: "Find the value of x if 2x + 3 = 11.",
    solution: "Subtract 3 from both sides to get 2x = 8, so x = 4."
  },
  {
    title: "COMC 2024 Geometry Problem",
    contest: "COMC",
    year: 2024,
    topic: "Geometry",
    difficulty: "Medium",
    statement: "A triangle has side lengths 3, 4, and 5. Find its area.",
    solution: "This is a right triangle, so the area is (1/2)(3)(4) = 6."
  },
  {
    title: "Mock Number Theory Problem",
    contest: "Practice Set",
    year: 2026,
    topic: "Number Theory",
    difficulty: "Hard",
    statement: "Find all integers n such that n^2 - 1 is divisible by 8.",
    solution: "For odd n, write n = 2k + 1. Then n^2 - 1 = 4k(k+1), which is divisible by 8 since k(k+1) is even."
  }
];

let problemList = document.getElementById("problemList");
let searchInput = document.getElementById("search");
let topicFilter = document.getElementById("topicFilter");
let difficultyFilter = document.getElementById("difficultyFilter");

function renderProblems() {
  let search = searchInput.value.toLowerCase().trim();
  let topic = topicFilter.value;
  let difficulty = difficultyFilter.value;

  let filtered = problems.filter(problem => {
    let matchesSearch =
      problem.title.toLowerCase().includes(search) ||
      problem.contest.toLowerCase().includes(search) ||
      problem.topic.toLowerCase().includes(search);

    let matchesTopic = topic === "all" || problem.topic === topic;
    let matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;

    return matchesSearch && matchesTopic && matchesDifficulty;
  });

  if (filtered.length === 0) {
    problemList.innerHTML = "<p>No problems found.</p>";
    return;
  }

  problemList.innerHTML = filtered.map((problem, index) => `
    <div class="problem-card">
      <h2>${problem.title}</h2>
      <div class="meta">${problem.contest} | ${problem.year} | ${problem.topic} | ${problem.difficulty}</div>
      <div class="statement">${problem.statement}</div>
      <button class="solution-btn" onclick="toggleSolution(${index})">Show Solution</button>
      <div class="solution" id="solution-${index}">${problem.solution}</div>
    </div>
  `).join("");
}

function toggleSolution(index) {
  let box = document.getElementById(`solution-${index}`);
  if (box) box.classList.toggle("show");
}

searchInput.addEventListener("input", renderProblems);
topicFilter.addEventListener("change", renderProblems);
difficultyFilter.addEventListener("change", renderProblems);

renderProblems();