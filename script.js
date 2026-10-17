const taskInput = document.querySelector("#task");
const result = document.querySelector("#result");
const resultTitle = document.querySelector("#resultTitle");
const resultText = document.querySelector("#resultText");

function showResult(title, text) {
  resultTitle.textContent = title;
  resultText.textContent = text;
  result.classList.add("show");
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function solveLinearEquation(raw) {
  const text = raw.toLowerCase().replace(/[−–]/g, "-").replace(/,/g, ".").replace(/\s+/g, "");
  const match = text.match(/(-?\d*\.?\d*)x([+-]\d+(?:\.\d+)?)?=(-?\d+(?:\.\d+)?)/);
  if (!match) return null;

  let a = match[1];
  a = a === "" || a === "+" ? 1 : a === "-" ? -1 : Number(a);
  const b = Number(match[2] || 0);
  const c = Number(match[3]);
  if (!Number.isFinite(a) || a === 0) return null;

  const right = c - b;
  const x = right / a;
  return `Шаг 1. Перенесём свободное число в правую часть.\n${a}x = ${right}.\n\nШаг 2. Разделим обе части на ${a}.\nx = ${right} / ${a}.\n\nОтвет: x = ${Number(x.toFixed(6))}.`;
}

function solveArithmetic(raw) {
  const normalized = raw.trim().replace(/,/g, ".").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/[−–]/g, "-");
  const match = normalized.match(/(-?\d+(?:\.\d+)?(?:\s*[+\-*/]\s*-?\d+(?:\.\d+)?)+)/);
  if (!match) return null;
  const expression = match[1].replace(/\s/g, "");
  if (!/^[\d.+\-*/]+$/.test(expression)) return null;

  // Ограниченный разбор арифметики без выполнения произвольного кода.
  const tokens = expression.match(/\d+(?:\.\d+)?|[+\-*/]/g);
  if (!tokens || tokens.join("") !== expression) return null;
  let values = [], operators = [], current = Number(tokens[0]);
  for (let i = 1; i < tokens.length; i += 2) {
    const op = tokens[i], n = Number(tokens[i + 1]);
    if (!Number.isFinite(n)) return null;
    if (op === "*") current *= n;
    else if (op === "/") { if (n === 0) return "Делить на ноль нельзя."; current /= n; }
    else { values.push(current); operators.push(op); current = n; }
  }
  values.push(current);
  let total = values[0];
  for (let i = 0; i < operators.length; i++) total = operators[i] === "+" ? total + values[i + 1] : total - values[i + 1];
  if (!Number.isFinite(total)) return null;
  return `Выражение: ${expression}\nСначала выполняем умножение и деление, затем сложение и вычитание.\n\nОтвет: ${Number(total.toFixed(8))}.`;
}

document.querySelector("#solve").addEventListener("click", () => {
  const raw = taskInput.value.trim();
  if (!raw) {
    showResult("Добавь условие", "Введи текст задания выше, а затем нажми «Разобрать задание».");
    taskInput.focus();
    return;
  }

  const subject = document.querySelector("#subject").value;
  if (subject === "auto" || subject === "math") {
    const equation = solveLinearEquation(raw);
    if (equation) return showResult("Решение по шагам", equation);
    const arithmetic = solveArithmetic(raw);
    if (arithmetic) return showResult("Решение по шагам", arithmetic);
  }

  const hints = {
    physics: "1. Выпиши известные величины и единицы измерения.\n2. Запиши, что нужно найти.\n3. Подбери формулу и вырази неизвестное.\n4. Подставь значения и проверь единицы.",
    russian: "Определи грамматическую основу, части речи и правило, которое проверяет задание. Для подробного разбора вставь предложение или весь текст.",
    english: "Определи тип задания и время глагола. Проверь порядок слов, форму глагола и согласование. Для перевода учитывай контекст предложения.",
    other: "Раздели условие на известные факты, вопрос и необходимые действия. Затем решай по шагам и проверь, отвечает ли результат на вопрос."
  };
  const hint = hints[subject] || "В этой демо-версии автоматически решаются простые выражения (например, 8 + 4 * 2) и линейные уравнения (например, 2x + 3 = 9). Для полноценных ответов по любым предметам нужно подключить ИИ-сервис.";
  showResult("Подсказка к заданию", hint);
});

document.querySelector("#clear").addEventListener("click", () => {
  taskInput.value = "";
  document.querySelector("#photo").value = "";
  result.classList.remove("show");
  taskInput.focus();
});
