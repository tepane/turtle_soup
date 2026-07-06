import { firebaseConfig, adminUids } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

const SAMPLE_PROBLEMS = [
  {
    title: "엘리베이터를 타지 못한 남자",
    prompt:
      "한 남자는 매일 아파트 20층에 있는 집으로 돌아간다. 그런데 비가 오는 날을 제외하면 늘 15층에서 내려 계단으로 올라간다. 왜 그럴까?",
    answer:
      "남자는 키가 작아 엘리베이터의 20층 버튼을 누르지 못한다. 15층 버튼까지만 손이 닿는다. 비가 오는 날에는 우산으로 20층 버튼을 누를 수 있다.",
    difficulty: 2,
    creativity: 3
  },
  {
    title: "바다거북수프",
    prompt:
      "한 남자가 식당에서 바다거북수프를 주문해 먹었다. 그는 수프를 한 숟갈 먹고 집으로 돌아가 스스로 목숨을 끊었다. 왜 그랬을까?",
    answer:
      "남자는 과거 조난 중에 동료가 만들어준 '바다거북수프'를 먹고 살아남았다고 믿었다. 식당에서 진짜 바다거북수프 맛을 본 뒤, 과거에 자신이 먹은 것이 실은 동료의 시신이었다는 사실을 깨달았다.",
    difficulty: 4,
    creativity: 5
  },
  {
    title: "불이 꺼진 방",
    prompt:
      "한 여자가 방에 들어가 불을 껐다. 그 결과 수십 명이 죽었다. 여자는 살인자가 아니다. 무슨 일이 있었을까?",
    answer:
      "여자는 등대지기였다. 등대의 불을 꺼서 배가 암초에 부딪혔고, 많은 사람이 사망했다.",
    difficulty: 3,
    creativity: 4
  }
];

const state = {
  problems: [],
  currentUser: null,
  isAdmin: false,
  firebaseReady: false,
  demoMode: false,
  db: null,
  auth: null,
  unsubscribeProblems: null
};

const $ = (selector) => document.querySelector(selector);
const problemList = $("#problemList");
const problemCardTemplate = $("#problemCardTemplate");
const emptyState = $("#emptyState");
const setupNotice = $("#setupNotice");
const adminPanel = $("#adminPanel");
const adminStatus = $("#adminStatus");
const problemCount = $("#problemCount");
const loginDialog = $("#loginDialog");
const loginError = $("#loginError");
const adminLoginButton = $("#adminLoginButton");
const adminLogoutButton = $("#adminLogoutButton");
const problemForm = $("#problemForm");
const formTitle = $("#formTitle");
const resetFormButton = $("#resetFormButton");
const seedButton = $("#seedButton");
const searchInput = $("#searchInput");
const sortSelect = $("#sortSelect");
const difficultyInput = $("#difficultyInput");
const creativityInput = $("#creativityInput");
const difficultyValue = $("#difficultyValue");
const creativityValue = $("#creativityValue");

function isFirebaseConfigured() {
  return Boolean(
    firebaseConfig?.apiKey &&
      firebaseConfig?.projectId &&
      !firebaseConfig.apiKey.startsWith("YOUR_") &&
      !firebaseConfig.projectId.startsWith("YOUR_") &&
      Array.isArray(adminUids) &&
      adminUids.length > 0 &&
      !adminUids.includes("YOUR_ADMIN_UID")
  );
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function stars(value) {
  const score = Number(value) || 0;
  return "★".repeat(score) + "☆".repeat(Math.max(0, 5 - score));
}

function normalizeProblem(docId, data) {
  return {
    id: docId,
    title: data.title?.trim() || "제목 없음",
    prompt: data.prompt?.trim() || "",
    answer: data.answer?.trim() || "",
    difficulty: Math.min(5, Math.max(1, Number(data.difficulty) || 1)),
    creativity: Math.min(5, Math.max(1, Number(data.creativity) || 1)),
    createdAt: data.createdAt?.toMillis?.() || data.createdAt || Date.now(),
    updatedAt: data.updatedAt?.toMillis?.() || data.updatedAt || Date.now()
  };
}

function filteredProblems() {
  const keyword = searchInput.value.trim().toLowerCase();
  const sorted = [...state.problems];

  sorted.sort((a, b) => {
    switch (sortSelect.value) {
      case "difficultyDesc":
        return b.difficulty - a.difficulty || b.creativity - a.creativity;
      case "creativityDesc":
        return b.creativity - a.creativity || b.difficulty - a.difficulty;
      case "titleAsc":
        return a.title.localeCompare(b.title, "ko");
      case "newest":
      default:
        return b.createdAt - a.createdAt;
    }
  });

  if (!keyword) return sorted;
  return sorted.filter((problem) =>
    [problem.title, problem.prompt, problem.answer].some((field) =>
      field.toLowerCase().includes(keyword)
    )
  );
}

function render() {
  const problems = filteredProblems();
  problemList.innerHTML = "";
  problemCount.textContent = `${problems.length}개 문제`;
  adminStatus.textContent = state.isAdmin
    ? `관리자 모드${state.demoMode ? " · 데모" : ""}`
    : `방문자 모드${state.demoMode ? " · 데모" : ""}`;

  adminPanel.classList.toggle("hidden", !state.isAdmin);
  adminLoginButton.classList.toggle("hidden", state.isAdmin);
  adminLogoutButton.classList.toggle("hidden", !state.isAdmin);
  emptyState.classList.toggle("hidden", problems.length !== 0);

  problems.forEach((problem, index) => {
    const node = problemCardTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".card-number").textContent = `#${String(index + 1).padStart(2, "0")}`;
    node.querySelector(".card-title").textContent = problem.title;
    node.querySelector(".prompt").textContent = problem.prompt;
    node.querySelector(".difficulty-rating").textContent = `난이도 ${stars(problem.difficulty)}`;
    node.querySelector(".creativity-rating").textContent = `창의성 ${stars(problem.creativity)}`;

    const answer = node.querySelector(".answer");
    const toggle = node.querySelector(".answer-toggle");
    answer.innerHTML = `<strong>정답</strong><br>${escapeHtml(problem.answer).replaceAll("\n", "<br>")}`;
    toggle.addEventListener("click", () => {
      const isHidden = answer.classList.toggle("hidden");
      toggle.textContent = isHidden ? "정답 보기" : "정답 숨기기";
    });

    const actions = node.querySelector(".admin-card-actions");
    actions.classList.toggle("hidden", !state.isAdmin);
    node.querySelector(".edit-button").addEventListener("click", () => fillForm(problem));
    node.querySelector(".delete-button").addEventListener("click", () => removeProblem(problem));

    problemList.append(node);
  });
}

function showNotice(message) {
  setupNotice.textContent = message;
  setupNotice.classList.toggle("hidden", !message);
}

function resetForm() {
  problemForm.reset();
  $("#problemId").value = "";
  difficultyInput.value = "3";
  creativityInput.value = "3";
  difficultyValue.textContent = "3";
  creativityValue.textContent = "3";
  formTitle.textContent = "문제 추가";
}

function fillForm(problem) {
  $("#problemId").value = problem.id;
  $("#titleInput").value = problem.title;
  $("#promptInput").value = problem.prompt;
  $("#answerInput").value = problem.answer;
  difficultyInput.value = problem.difficulty;
  creativityInput.value = problem.creativity;
  difficultyValue.textContent = problem.difficulty;
  creativityValue.textContent = problem.creativity;
  formTitle.textContent = "문제 수정";
  adminPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formData() {
  return {
    title: $("#titleInput").value.trim(),
    prompt: $("#promptInput").value.trim(),
    answer: $("#answerInput").value.trim(),
    difficulty: Number(difficultyInput.value),
    creativity: Number(creativityInput.value)
  };
}

async function saveProblem(event) {
  event.preventDefault();
  if (!state.isAdmin) return alert("관리자만 저장할 수 있습니다.");

  const id = $("#problemId").value;
  const data = formData();

  if (state.demoMode) {
    if (id) {
      state.problems = state.problems.map((problem) =>
        problem.id === id ? { ...problem, ...data, updatedAt: Date.now() } : problem
      );
    } else {
      state.problems.unshift({
        id: crypto.randomUUID(),
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
    }
    localStorage.setItem("turtleSoupDemoProblems", JSON.stringify(state.problems));
    resetForm();
    render();
    return;
  }

  const payload = {
    ...data,
    updatedAt: serverTimestamp()
  };

  if (id) {
    await updateDoc(doc(state.db, "problems", id), payload);
  } else {
    await addDoc(collection(state.db, "problems"), {
      ...payload,
      createdAt: serverTimestamp()
    });
  }

  resetForm();
}

async function removeProblem(problem) {
  if (!state.isAdmin) return alert("관리자만 삭제할 수 있습니다.");
  const ok = confirm(`'${problem.title}' 문제를 삭제할까요? 되돌릴 수 없습니다.`);
  if (!ok) return;

  if (state.demoMode) {
    state.problems = state.problems.filter((item) => item.id !== problem.id);
    localStorage.setItem("turtleSoupDemoProblems", JSON.stringify(state.problems));
    render();
    return;
  }

  await deleteDoc(doc(state.db, "problems", problem.id));
}

async function seedProblems() {
  if (!state.isAdmin) return alert("관리자만 샘플 문제를 추가할 수 있습니다.");
  const ok = confirm("샘플 문제 3개를 추가할까요?");
  if (!ok) return;

  if (state.demoMode) {
    const now = Date.now();
    const seeded = SAMPLE_PROBLEMS.map((problem, index) => ({
      ...problem,
      id: crypto.randomUUID(),
      createdAt: now - index,
      updatedAt: now - index
    }));
    state.problems = [...seeded, ...state.problems];
    localStorage.setItem("turtleSoupDemoProblems", JSON.stringify(state.problems));
    render();
    return;
  }

  for (const problem of SAMPLE_PROBLEMS) {
    await addDoc(collection(state.db, "problems"), {
      ...problem,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }
}

function bootDemoMode() {
  state.demoMode = true;
  state.isAdmin = true;
  const stored = localStorage.getItem("turtleSoupDemoProblems");
  state.problems = stored
    ? JSON.parse(stored)
    : SAMPLE_PROBLEMS.map((problem, index) => ({
        ...problem,
        id: `demo-${index}`,
        createdAt: Date.now() - index,
        updatedAt: Date.now() - index
      }));
  showNotice(
    "Firebase 설정이 아직 없습니다. 현재는 브라우저 localStorage 데모 모드입니다. 실제 배포 전 firebase-config.js와 firestore.rules를 설정하세요."
  );
  render();
}

async function bootFirebase() {
  try {
    const app = initializeApp(firebaseConfig);
    state.auth = getAuth(app);
    state.db = getFirestore(app);
    state.firebaseReady = true;
    showNotice("");

    onAuthStateChanged(state.auth, (user) => {
      state.currentUser = user;
      state.isAdmin = Boolean(user && adminUids.includes(user.uid));
      render();
    });

    const problemsQuery = query(collection(state.db, "problems"), orderBy("createdAt", "desc"));
    state.unsubscribeProblems = onSnapshot(
      problemsQuery,
      (snapshot) => {
        state.problems = snapshot.docs.map((item) => normalizeProblem(item.id, item.data()));
        render();
      },
      async () => {
        const snapshot = await getDocs(collection(state.db, "problems"));
        state.problems = snapshot.docs.map((item) => normalizeProblem(item.id, item.data()));
        render();
      }
    );
  } catch (error) {
    console.error(error);
    bootDemoMode();
  }
}

async function login(event) {
  event.preventDefault();
  loginError.classList.add("hidden");
  loginError.textContent = "";

  if (state.demoMode) {
    loginDialog.close();
    state.isAdmin = true;
    render();
    return;
  }

  try {
    const email = $("#emailInput").value.trim();
    const password = $("#passwordInput").value;
    const credential = await signInWithEmailAndPassword(state.auth, email, password);

    if (!adminUids.includes(credential.user.uid)) {
      await signOut(state.auth);
      throw new Error("관리자 UID가 아닙니다. firebase-config.js의 adminUids를 확인하세요.");
    }

    loginDialog.close();
    $("#loginForm").reset();
  } catch (error) {
    loginError.textContent = error.message || "로그인에 실패했습니다.";
    loginError.classList.remove("hidden");
  }
}

async function logout() {
  if (state.demoMode) {
    state.isAdmin = false;
    render();
    return;
  }
  await signOut(state.auth);
}

function bindEvents() {
  adminLoginButton.addEventListener("click", () => loginDialog.showModal());
  adminLogoutButton.addEventListener("click", logout);
  $("#closeLoginButton").addEventListener("click", () => loginDialog.close());
  $("#loginForm").addEventListener("submit", login);
  problemForm.addEventListener("submit", saveProblem);
  resetFormButton.addEventListener("click", resetForm);
  seedButton.addEventListener("click", seedProblems);
  searchInput.addEventListener("input", render);
  sortSelect.addEventListener("change", render);
  difficultyInput.addEventListener("input", () => (difficultyValue.textContent = difficultyInput.value));
  creativityInput.addEventListener("input", () => (creativityValue.textContent = creativityInput.value));
}

bindEvents();

if (isFirebaseConfigured()) {
  bootFirebase();
} else {
  bootDemoMode();
}
