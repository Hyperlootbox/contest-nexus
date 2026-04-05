window.SearchUtils = (() => {
  function normalize(value) {
    return String(value || "").trim().toLowerCase();
  }

  function buildTermCatalog(topicsData) {
    let allTerms = [];

    for (let field of topicsData.fieldOrder || []) {
      allTerms.push({
        label: `All ${field}`,
        labelLower: normalize(`All ${field}`),
        kind: "field",
        value: field,
        field
      });

      for (let topic of topicsData.topicsByField[field] || []) {
        allTerms.push({
          label: topic,
          labelLower: normalize(topic),
          kind: "topic",
          value: topic,
          field
        });
      }
    }

    let allTermsSorted = [...allTerms].sort((a, b) => {
      if (b.label.length !== a.label.length) {
        return b.label.length - a.label.length;
      }

      return a.label.localeCompare(b.label);
    });

    return { allTerms, allTermsSorted };
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

  function tokenizeExpression(text, allTermsSorted) {
    let tokens = [];
    let i = 0;

    while (i < text.length) {
      let ch = text[i];

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

      for (let term of allTermsSorted) {
        let end = i + term.label.length;

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

    for (let token of tokens) {
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
    if (operator === "AND") return 2;
    if (operator === "OR") return 1;
    return 0;
  }

  function toReversePolishNotation(tokens) {
    let output = [];
    let operators = [];

    for (let token of tokens) {
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
      let top = operators.pop();

      if (top.type === "paren") {
        throw new Error("Unmatched opening parenthesis");
      }

      output.push(top);
    }

    return output;
  }

  function parseTopicExpression(text, allTermsSorted) {
    let raw = text.trim();

    if (!raw) {
      return { valid: true, empty: true, rpn: null, reason: "" };
    }

    try {
      let tokens = tokenizeExpression(text, allTermsSorted);
      validateTokens(tokens);
      let rpn = toReversePolishNotation(tokens);

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
    let stack = [];

    for (let token of rpnTokens) {
      if (token.type === "term") {
        stack.push(termMatchesProblem(token, problem));
        continue;
      }

      if (token.type === "binary") {
        if (stack.length < 2) {
          return false;
        }

        let right = stack.pop();
        let left = stack.pop();

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
    let left = text.slice(0, caret);
    let regex = /\bAND\b|\bOR\b|\(|\)/g;
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
    let right = text.slice(caret);
    let regex = /\bAND\b|\bOR\b|\(|\)/g;
    let match = regex.exec(right);
    let end = match ? caret + match.index : text.length;

    while (end > caret && /\s/.test(text[end - 1])) {
      end -= 1;
    }

    return end;
  }

  function getCurrentFragmentData(text, caret) {
    let start = findFragmentStart(text, caret);
    let end = findFragmentEnd(text, caret);
    let query = text.slice(start, caret).trim();

    return { text, caret, start, end, query };
  }

  function getSuggestionMatches(query, allTerms, currentField) {
    if (!query) {
      return [];
    }

    let q = normalize(query);
    let matches = allTerms.filter(term => term.labelLower.includes(q));

    matches.sort((a, b) => {
      let aPrefix = a.labelLower.startsWith(q) ? 0 : 1;
      let bPrefix = b.labelLower.startsWith(q) ? 0 : 1;

      if (aPrefix !== bPrefix) {
        return aPrefix - bPrefix;
      }

      let aFieldBoost = a.field === currentField ? 0 : 1;
      let bFieldBoost = b.field === currentField ? 0 : 1;

      if (aFieldBoost !== bFieldBoost) {
        return aFieldBoost - bFieldBoost;
      }

      let aIndex = a.labelLower.indexOf(q);
      let bIndex = b.labelLower.indexOf(q);

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

  function matchesTitle(problem, titleQuery) {
    let query = normalize(titleQuery);

    if (!query) {
      return true;
    }

    return normalize(problem.title).includes(query);
  }

  function matchesContest(problem, contestQuery) {
    let query = normalize(contestQuery);

    if (!query) {
      return true;
    }

    let possibleContestValues = [
      problem.exam,
      problem.contest
    ]
      .filter(Boolean)
      .map(normalize);

    return possibleContestValues.includes(query);
  }

  function matchesDifficulty(problem, minDifficulty, maxDifficulty) {
    return problem.difficulty >= minDifficulty && problem.difficulty <= maxDifficulty;
  }

  function filterProblems(problems, options) {
    let {
      titleQuery,
      contestQuery,
      minDifficulty,
      maxDifficulty,
      topicParse
    } = options;

    return problems.filter(problem => {
      let titleMatch = matchesTitle(problem, titleQuery);
      let contestMatch = matchesContest(problem, contestQuery);
      let difficultyMatch = matchesDifficulty(problem, minDifficulty, maxDifficulty);
      let topicMatch = topicParse.empty
        ? true
        : evaluateExpressionForProblem(topicParse.rpn, problem);

      return titleMatch && contestMatch && difficultyMatch && topicMatch;
    });
  }

  return {
    normalize,
    buildTermCatalog,
    parseTopicExpression,
    getCurrentFragmentData,
    getSuggestionMatches,
    filterProblems
  };
})();