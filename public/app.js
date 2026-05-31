// --- State ---
let isRegisterMode = false;

//random quiz state
let quizQuestions = [];
let currentQuestionIndex = 0;
let quizScore = 0;

// --- Helpers ---
function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function setToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function removeToken() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

async function apiFetch(route, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.API_URL}${route}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || data.msg || "Request failed");
  return data;
}

// --- Auth ---
function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("app-section").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
  renderAuthForm();
}

function renderAuthForm() {
  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const title = isRegisterMode ? "Sign Up" : "Log In";
  const switchText = isRegisterMode
    ? 'Already have an account? <a href="#" id="switch-mode">Log in</a>'
    : 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';

  const formHTML = `
    <h2>${title}</h2>
    <form id="auth-form">
      ${fields
        .map((f) => {
          const type = f === "password" ? "password" : f === "email" ? "email" : "text";
          const label = f.charAt(0).toUpperCase() + f.slice(1);
          return `
          <div class="form-group">
            <label for="${f}">${label}</label>
            <input type="${type}" id="${f}" name="${f}" required />
          </div>`;
        })
        .join("")}
      <button type="submit">${title}</button>
    </form>
    <p class="switch-text">${switchText}</p>
    <p id="auth-error" class="error"></p>
  `;

  document.getElementById("auth-section").innerHTML = formHTML;
  document.getElementById("auth-form").addEventListener("submit", handleAuth);
  document.getElementById("switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    renderAuthForm();
  });
}

async function handleAuth(e) {
  e.preventDefault();
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const route = isRegisterMode ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;

  const body = {};
  fields.forEach((f) => {
    body[f] = document.getElementById(f).value;
  });

  try {
    const data = await apiFetch(route, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.token);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

// --- App ---
async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("logout-btn").style.display = "inline-block";
  await loadQuestions();
}

async function loadQuestions(keyword = "", page = 1) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading questions...</p>';

  try {
    const params = new URLSearchParams({ page, limit: CONFIG.QUESTIONS_PER_PAGE });
    if (keyword) params.set("keyword", keyword);
    const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}?${params}`);
    const { data: questions, total, totalPages } = result;
    const currentUserId = getCurrentUserId();

    const solvedCount = questions.filter((q) => q[CONFIG.API_FIELDS.SOLVED]).length;

    let html = `
      <div class="score-bar">
        <div class="score-item">
          <div class="score-value">${total}</div>
          <div class="score-label">Questions</div>
        </div>
        <div class="score-item">
          <div class="score-value">${solvedCount}/${questions.length}</div>
          <div class="score-label">Solved (this page)</div>
        </div>
      </div>
      <div class="toolbar">
        <button class="btn btn-primary" id="new-question-btn">+ New Question</button>
        <button class="btn btn-primary" id="random-quiz-btn">? Play Random Quiz</button>
        <button class="btn btn-primary" id="leaderboard-btn">🏆 Leaderboard</button>
        <button class="btn btn-primary" id="stats-btn"> My Stats</button>
        <div class="search-bar">
          <input type="text" id="keyword-input" placeholder="Search by keyword..." value="${keyword}" />
          <button class="btn btn-search" id="search-btn">Search</button>
          ${keyword ? `<button class="btn btn-clear" id="clear-btn">Clear</button>` : ""}
        </div>
      </div>`;

    if (questions.length === 0) {
      html += '<p class="empty-state">No questions found. Create one to get started!</p>';
    } else {
      html += questions
        .map(
          (q) => `
        <article class="question-card ${q[CONFIG.API_FIELDS.SOLVED] ? "solved-card" : ""}">
          <h3>
            <a href="#" class="question-link" data-id="${q.id}">${q.question}</a>
            ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}
          </h3>
          ${
            q.keywords && q.keywords.length
              ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
              : ""
          }
          <div class="question-actions">
            <span>
              <button class="btn btn-play" data-id="${q.id}">Play</button>
              <a href="#" class="read-more" data-id="${q.id}">See answer</a>
            </span>
            ${
              q.userId === currentUserId
                ? `<span class="owner-actions">
                    <button class="btn btn-edit" data-id="${q.id}">Edit</button>
                    <button class="btn btn-delete" data-id="${q.id}">Delete</button>
                  </span>`
                : ""
            }
          </div>
        </article>`
        )
        .join("");
    }

    if (totalPages > 1) {
      html += `
        <div class="pagination">
          <button class="btn btn-page" id="prev-btn" ${page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="page-info">Page ${page} of ${totalPages}</span>
          <button class="btn btn-page" id="next-btn" ${page >= totalPages ? "disabled" : ""}>Next</button>
        </div>`;
    }

    container.innerHTML = html;

    document.getElementById("new-question-btn").addEventListener("click", () => showQuestionForm());

    //random quiz button 
    document.getElementById("random-quiz-btn").addEventListener("click", () => loadRandomQuiz());

    //leaderboard button
    document.getElementById("leaderboard-btn").addEventListener("click", () => loadLeaderboard());

    //stats button
    document.getElementById("stats-btn").addEventListener("click", () => loadStats());

    document.getElementById("search-btn").addEventListener("click", () => {
      loadQuestions(document.getElementById("keyword-input").value.trim(), 1);
    });

    document.getElementById("keyword-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") loadQuestions(e.target.value.trim(), 1);
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => loadQuestions());

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", () => loadQuestions(keyword, page - 1));

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.addEventListener("click", () => loadQuestions(keyword, page + 1));

    container.querySelectorAll(".question-link, .read-more").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadQuestionDetail(el.dataset.id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach((el) => {
      el.addEventListener("click", () => showQuestionForm(el.dataset.id));
    });

    container.querySelectorAll(".btn-delete").forEach((el) => {
      el.addEventListener("click", () => deleteQuestion(el.dataset.id));
    });

    container.querySelectorAll(".btn-play").forEach((el) => {
      el.addEventListener("click", () => playQuestion(el.dataset.id));
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadQuestionDetail(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    const currentUserId = getCurrentUserId();
    const isOwner = q.userId === currentUserId;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <article class="question-card question-detail">
        <h3>${q.question} ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}</h3>
        <p class="question-meta">by ${q.userName || "Unknown"}</p>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="">` : ""}
        <p class="question-answer">${q.answer}</p>
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        ${
          isOwner
            ? `<div class="question-actions detail-actions">
                <button class="btn btn-edit" id="detail-edit-btn">Edit</button>
                <button class="btn btn-delete" id="detail-delete-btn">Delete</button>
              </div>`
            : ""
        }
      </article>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    if (isOwner) {
      document.getElementById("detail-edit-btn").addEventListener("click", () => showQuestionForm(qId));
      document.getElementById("detail-delete-btn").addEventListener("click", () => deleteQuestion(qId));
    }
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

//Random Quiz 
async function loadRandomQuiz() {
  try {
    const result = await apiFetch(
      `${CONFIG.ROUTES.QUESTIONS}/random?count=10`
    );

    quizQuestions = result.data;
    currentQuestionIndex = 0;
    quizScore = 0;

    renderQuizQuestion();

  } catch (err) {
    console.log(err);
  }
}

//leaderboard
async function loadLeaderboard() {
  const container = document.getElementById("questions-container");

  try {
    const leaderboard = await apiFetch(
      `${CONFIG.ROUTES.QUESTIONS}/leaderboard`
    );

    const first = leaderboard[0];
    const second = leaderboard[1];
    const third = leaderboard[2];

    const rest = leaderboard.slice(3);

    container.innerHTML = `
      <h2>🏆 Leaderboard</h2>

      <div class="leaderboard-podium">

        ${
          second
            ? `
          <div class="podium-card second">
            <div class="medal">🥈</div>
            <div class="name">${second.name}</div>
            <div class="score">${second.score} pts</div>
          </div>
        `
            : ""
        }

        ${
          first
            ? `
          <div class="podium-card first">
            <div class="medal">🥇</div>
            <div class="name">${first.name}</div>
            <div class="score">${first.score} pts</div>
          </div>
        `
            : ""
        }

        ${
          third
            ? `
          <div class="podium-card third">
            <div class="medal">🥉</div>
            <div class="name">${third.name}</div>
            <div class="score">${third.score} pts</div>
          </div>
        `
            : ""
        }

      </div>

      ${
        rest.length
          ? `
        <table class="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th>Score</th>
            </tr>
          </thead>

          <tbody>
            ${rest
              .map(
                (user, index) => `
                  <tr>
                    <td>${index + 4}</td>
                    <td>${user.name}</td>
                    <td>${user.score} pts</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      `
          : ""
      }

      <div style="margin-top:2rem;">
        <button id="back-btn" class="btn btn-primary">
          Back to Questions
        </button>
      </div>
    `;

    document
      .getElementById("back-btn")
      .addEventListener("click", () => loadQuestions());

  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

//stats funktio
async function loadStats() {
  const container = document.getElementById(
    "questions-container"
  );

  try {
    const stats = await apiFetch(
      `${CONFIG.ROUTES.QUESTIONS}/stats`
    );

    container.innerHTML = `
      <h2>Statistics</h2>

      <div class="stats-grid">

        <div class="stats-card">
          <div class="stats-value">
            ${stats.questionsCreated}
          </div>
          <div class="stats-label">
            Questions Created
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-value">
            ${stats.attempts}
          </div>
          <div class="stats-label">
            Attempts
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-value">
            ${stats.correctAnswers}
          </div>
          <div class="stats-label">
            Correct Answers
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-value">
            ${stats.accuracy}%
          </div>
          <div class="stats-label">
            Accuracy
          </div>
        </div>

        <div class="stats-card">
          <div class="stats-value">
            ${stats.questionsSolved}
          </div>
          <div class="stats-label">
            Solved Questions
          </div>
        </div>

      </div>

      <button
        id="back-btn"
        class="btn btn-primary"
      >
        Back
      </button>
    `;

    document
      .getElementById("back-btn")
      .addEventListener("click", () =>
        loadQuestions()
      );

  } catch (err) {
    container.innerHTML =
      `<p class="error">${err.message}</p>`;
  }
}


// --- Create / Edit ---
async function showQuestionForm(qId) {
  const container = document.getElementById("questions-container");
  const isEdit = !!qId;
  let q = { question: "", answer: "", keywords: [] };

  if (isEdit) {
    try {
      q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
      return;
    }
  }

  container.innerHTML = `
    <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
    <div class="question-form-wrapper">
      <h2>${isEdit ? "Edit Question" : "New Question"}</h2>
      <form id="question-form" enctype="multipart/form-data">
        <div class="form-group">
          <label for="q-question">Question</label>
          <input type="text" id="q-question" value="${q.question}" required />
        </div>
        <div class="form-group">
          <label for="q-answer">Answer</label>
          <textarea id="q-answer" rows="4" required>${q.answer}</textarea>
        </div>
        <div class="form-group">
          <label for="q-keywords">Keywords (comma-separated)</label>
          <input type="text" id="q-keywords" value="${q.keywords ? q.keywords.join(", ") : ""}" />
        </div>
        <div class="form-group">
          <label for="q-image">Image ${isEdit ? "(leave blank to keep current)" : "(optional)"}</label>
          <input type="file" id="q-image" accept="image/*" />
          ${isEdit && q.imageUrl ? `<img src="${q.imageUrl}" alt="" style="max-width:200px;margin-top:0.5rem;border-radius:4px" />` : ""}
        </div>
        <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Question"}</button>
      </form>
      <p id="question-form-error" class="error"></p>
    </div>`;

  document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadQuestions();
  });

  document.getElementById("question-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("question-form-error");
    errorEl.textContent = "";

    const body = new FormData();
    body.append("question", document.getElementById("q-question").value);
    body.append("answer", document.getElementById("q-answer").value);
    body.append("keywords", document.getElementById("q-keywords").value);
    const imageFile = document.getElementById("q-image").files[0];
    if (imageFile) body.append("image", imageFile);

    try {
      if (isEdit) {
        await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "PUT", body });
      } else {
        await apiFetch(CONFIG.ROUTES.QUESTIONS, { method: "POST", body });
      }
      loadQuestions();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

//random quiz
function renderQuizQuestion() {
  const container = document.getElementById("questions-container");
  const q = quizQuestions[currentQuestionIndex];

  container.innerHTML = `
    <div class="question-form-wrapper">
      <h2>Random Quiz</h2>

      <p>Question ${currentQuestionIndex + 1} / ${quizQuestions.length}</p>

      <div class="play-question-text">
        ${q.question}
      </div>

      <div class="quiz-answer-group">
        <label for="quiz-answer">Your Answer</label>
        <input
          type="text"
          id="quiz-answer"
          class="quiz-answer-input"
          placeholder="Type your answer here..."
          autocomplete="off"
        />
      </div>

      <button id="submit-quiz-answer" class="quiz-submit-btn">
        Submit
      </button>

      <div id="quiz-feedback"><div>
    </div>
  `;
  document
  .getElementById("submit-quiz-answer")
  .addEventListener("click", submitQuizAnswer);

  document
  .getElementById("quiz-answer")
  .addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitQuizAnswer();
    }
  });
}

//submit quiz answer
async function submitQuizAnswer() {
  const q = quizQuestions[currentQuestionIndex];

  const feedback = document.getElementById("quiz-feedback");

  const answer = document
    .getElementById("quiz-answer")
    .value
    .trim();

  if (!answer) {
    feedback.innerHTML = `
    <div class="quiz-feedback-enter-answer">
    Please enter an answer!
    </div
    `;
    return;
  }

  try {
    const result = await apiFetch(
      `${CONFIG.ROUTES.QUESTIONS}/${q.id}/play`,
      {
        method: "POST",
        body: JSON.stringify({ answer }),
      }
    );

    if (result.correct) {
      quizScore++;
      feedback.innerHTML = `
      <div class="quiz-feedback correct">
      Correct answer!
      </div
      `;
    } else {
      feedback.innerHTML = `
      <div class="quiz-feedback incorrect">
      Incorrect answer! Correct answer was:
      <strong>${result.correctAnswer}<strong>
      <div>
      `;
    }

    setTimeout(() => {
      nextQuizQuestion();
    }, 1500);

  } catch (err) {
    alert(err.message);
  }
}

//next question
function nextQuizQuestion() {
  currentQuestionIndex++;

  if (currentQuestionIndex >= quizQuestions.length) {
    showQuizResults();
    return;
  }

  renderQuizQuestion();
}

//show results
function showQuizResults() {
  const container = document.getElementById("questions-container");

  container.innerHTML = `
    <div class="question-form-wrapper">
      <h2>Quiz Finished!</h2>

      <p>
        You scored
        <strong>${quizScore}</strong>
        out of
        <strong>${quizQuestions.length}</strong>
      </p>

      <button id="back-to-questions" class="back-to-questions-btn">
        Back to Questions
      </button>
    </div>
  `;

  document
    .getElementById("back-to-questions")
    .addEventListener("click", () => {
      loadQuestions();
    });
}

// --- Play ---
async function playQuestion(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <div class="question-form-wrapper" style="text-align:center">
        <div class="play-question-text">${q.question}</div>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="" style="margin:0 auto 1rem">` : ""}
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords" style="justify-content:center;margin-bottom:1.5rem">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        <form id="play-form" style="text-align:left">
          <div class="form-group">
            <label for="play-answer">Your answer</label>
            <textarea id="play-answer" rows="3" required></textarea>
          </div>
          <div style="text-align:center">
            <button type="submit" class="btn btn-play" style="padding:0.7rem 2.5rem;font-size:1rem">Submit</button>
          </div>
        </form>
        <div id="play-result"></div>
        <p id="play-error" class="error"></p>
      </div>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    document.getElementById("play-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("play-error");
      const resultEl = document.getElementById("play-result");
      errorEl.textContent = "";
      resultEl.innerHTML = "";

      const answer = document.getElementById("play-answer").value;

      try {
        const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/play`, {
          method: "POST",
          body: JSON.stringify({ answer }),
        });

        if (result.correct) {
          resultEl.innerHTML = `<div class="play-result correct">Correct!</div>`;
        } else {
          resultEl.innerHTML = `
            <div class="play-result incorrect">
              Incorrect! The answer was: <strong>${result.correctAnswer}</strong>
            </div>`;
        }
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

// --- Delete ---
async function deleteQuestion(qId) {
  if (!confirm("Are you sure you want to delete this question?")) return;

  try {
    await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "DELETE" });
    loadQuestions();
  } catch (err) {
    alert(err.message);
  }
}

function handleLogout() {
  removeToken();
  showAuth();
}

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});
