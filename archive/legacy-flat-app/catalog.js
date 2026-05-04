const catalogRoot = document.getElementById("catalog-root");
const heroCountEl = document.getElementById("hero-tests-count");
const CATALOG_URL = "/tests/catalog.json";

async function loadCatalogFile() {
  const response = await fetch(CATALOG_URL, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Не удалось загрузить каталог тестов: ${CATALOG_URL}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Файл tests/catalog.json должен содержать массив.");
  }

  return data;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function normalizeVariantStamp(value) {
  if (typeof value !== "string") return "";
  return value.replace(/[^\d]/g, "");
}

function compareVariants(a, b) {
  const aStamp = normalizeVariantStamp(a.variantKey || a.id || "");
  const bStamp = normalizeVariantStamp(b.variantKey || b.id || "");

  if (aStamp && bStamp) {
    return bStamp.localeCompare(aStamp);
  }

  return (b.id || "").localeCompare(a.id || "");
}

function getPlural(count, one, few, many) {
  const mod10 = count % 10;
  const mod100 = count % 100;

  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function detectCategory({ topic = "", title = "", description = "" }) {
  const text = `${topic} ${title} ${description}`.toLowerCase();

  if (text.includes("вероят") || text.includes("статист") || text.includes("комбинатор")) {
    return "Вероятность";
  }

  if (
    text.includes("геометр") ||
    text.includes("вектор") ||
    text.includes("плоскост") ||
    text.includes("координат") ||
    text.includes("пространств")
  ) {
    return "Геометрия";
  }

  if (
    text.includes("предел") ||
    text.includes("производ") ||
    text.includes("интеграл") ||
    text.includes("функц") ||
    text.includes("анализ")
  ) {
    return "Анализ";
  }

  if (
    text.includes("тригоном") ||
    text.includes("sin") ||
    text.includes("cos") ||
    text.includes("tg") ||
    text.includes("ctg")
  ) {
    return "Тригонометрия";
  }

  if (
    text.includes("алгебр") ||
    text.includes("уравнен") ||
    text.includes("виета") ||
    text.includes("дискримин") ||
    text.includes("корн") ||
    text.includes("полином")
  ) {
    return "Алгебра";
  }

  return "Прочее";
}

async function enrichCatalogEntries(entries) {
  const enriched = await Promise.all(
    entries.map(async (entry) => {
      try {
        const response = await fetch(entry.file, { cache: "no-store" });

        if (!response.ok) {
          return {
            ...entry,
            topic: entry.title || "Без темы",
            level: "Не указан",
            version: null,
            variantKey: "",
            questionsCount: null,
            category: "Прочее"
          };
        }

        const data = await response.json();

        const topic = data.topic || entry.title || "Без темы";
        const title = data.title || entry.title || "Тест";
        const description = data.description || entry.description || "";

        return {
          ...entry,
          topic,
          title,
          description,
          level: data.level || "Не указан",
          version: data.version || 1,
          variantKey: data.variantKey || "",
          questionsCount: Array.isArray(data.questions) ? data.questions.length : null,
          category: detectCategory({ topic, title, description })
        };
      } catch {
        const topic = entry.title || "Без темы";
        return {
          ...entry,
          topic,
          title: entry.title || "Тест",
          description: entry.description || "",
          level: "Не указан",
          version: null,
          variantKey: "",
          questionsCount: null,
          category: detectCategory({
            topic,
            title: entry.title || "",
            description: entry.description || ""
          })
        };
      }
    })
  );

  return enriched;
}

function groupByTopicAndLevel(entries) {
  const map = new Map();

  entries.forEach((entry) => {
    const key = `${entry.category}|||${entry.topic}|||${entry.level}`;

    if (!map.has(key)) {
      map.set(key, []);
    }

    map.get(key).push(entry);
  });

  return Array.from(map.entries()).map(([key, items]) => {
    const [category, topic, level] = key.split("|||");
    const variants = [...items].sort(compareVariants);
    const latest = variants[0];

    return {
      key,
      category,
      topic,
      level,
      latest,
      variants,
      count: variants.length
    };
  });
}

function groupByCategory(groups) {
  const map = new Map();

  groups.forEach((group) => {
    if (!map.has(group.category)) {
      map.set(group.category, []);
    }
    map.get(group.category).push(group);
  });

  return Array.from(map.entries())
    .map(([category, items]) => ({
      category,
      items: items.sort((a, b) => a.topic.localeCompare(b.topic, "ru"))
    }))
    .sort((a, b) => a.category.localeCompare(b.category, "ru"));
}

function renderVariantItem(variant, variantIndex, total) {
  return `
    <article class="variant-item">
      <div class="variant-item-top">
        <div class="variant-item-title">
          ${variantIndex === 0 ? "Новый" : `Вариант ${total - variantIndex}`}
        </div>

        <div class="variant-meta">
          ${
            variant.questionsCount
              ? `<span class="badge badge-light">${variant.questionsCount} ${getPlural(variant.questionsCount, "задание", "задания", "заданий")}</span>`
              : ""
          }
          ${
            variant.version
              ? `<span class="badge badge-light">v${variant.version}</span>`
              : ""
          }
        </div>
      </div>

      <p>${escapeHtml(variant.description || "")}</p>

      <div class="card-actions">
        <a class="small-btn" href="test.html?id=${encodeURIComponent(variant.id)}">Открыть</a>
      </div>
    </article>
  `;
}

function renderTopicGroup(group, index) {
  const latest = group.latest;
  const listId = `variant-list-${index}`;

  return `
    <section class="catalog-group">
      <div class="catalog-group-header">
        <div class="catalog-group-heading">
          <h3>${escapeHtml(group.topic)}</h3>
          <p>${escapeHtml(latest.description || "Тест по математике.")}</p>
        </div>

        <div class="catalog-group-meta">
          <span class="badge badge-dark">${escapeHtml(group.level)}</span>
          <span class="badge badge-light">${group.count} ${getPlural(group.count, "вариант", "варианта", "вариантов")}</span>
          ${
            latest.questionsCount
              ? `<span class="badge badge-accent">${latest.questionsCount} ${getPlural(latest.questionsCount, "задание", "задания", "заданий")}</span>`
              : ""
          }
        </div>
      </div>

      <div class="catalog-grid">
        <article class="catalog-card catalog-card-main">
          <div class="card-top">
            <span class="variant-label">Актуально</span>
            ${
              latest.version
                ? `<span class="badge badge-light">v${latest.version}</span>`
                : ""
            }
          </div>

          <h4>${escapeHtml(latest.title)}</h4>
          <p>${escapeHtml(latest.description || "")}</p>

          <div class="card-actions">
            <a class="catalog-btn" href="test.html?id=${encodeURIComponent(latest.id)}">Пройти</a>
            ${
              group.count > 1
                ? `<button class="ghost-btn" type="button" data-toggle="${listId}">Варианты</button>`
                : ""
            }
          </div>
        </article>
      </div>

      ${
        group.count > 1
          ? `
            <div id="${listId}" class="variant-list">
              <div class="variant-list-grid">
                ${group.variants
                  .map((variant, variantIndex) => renderVariantItem(variant, variantIndex, group.count))
                  .join("")}
              </div>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderCategoryBlock(categoryGroup, categoryIndex, globalOffset = 0) {
  return `
    <section class="category-block" id="cat-${categoryIndex}">
      <div class="category-head">
        <div>
          <div class="category-kicker">Раздел</div>
          <h2>${escapeHtml(categoryGroup.category)}</h2>
        </div>
        <span class="badge badge-light">
          ${categoryGroup.items.length} ${getPlural(categoryGroup.items.length, "тема", "темы", "тем")}
        </span>
      </div>

      <div class="catalog-groups">
        ${categoryGroup.items
          .map((group, localIndex) => renderTopicGroup(group, globalOffset + localIndex))
          .join("")}
      </div>
    </section>
  `;
}

function attachCatalogToggles() {
  const buttons = document.querySelectorAll("[data-toggle]");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.dataset.toggle;
      const target = document.getElementById(targetId);

      if (!target) return;

      const isOpen = target.classList.contains("open");
      target.classList.toggle("open", !isOpen);
      button.textContent = isOpen ? "Варианты" : "Скрыть";
    });
  });
}

function attachCategoryNav() {
  const navLinks = document.querySelectorAll("[data-category-target]");

  navLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const targetId = link.dataset.categoryTarget;
      const target = document.getElementById(targetId);

      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

async function renderCatalog() {
  try {
    const rawEntries = await loadCatalogFile();
    const enrichedEntries = await enrichCatalogEntries(rawEntries);

    const topicGroups = groupByTopicAndLevel(enrichedEntries);
    const categoryGroups = groupByCategory(topicGroups);

    const totalTests = enrichedEntries.length;
    const totalTopics = topicGroups.length;

    if (heroCountEl) {
      heroCountEl.textContent = `${totalTests} ${getPlural(totalTests, "тест", "теста", "тестов")}`;
    }

    let runningOffset = 0;

    catalogRoot.innerHTML = `
      <section class="catalog-shell">
        <div class="catalog-intro">
          <div class="catalog-title-group">
            <div class="catalog-kicker">Разделы</div>
            <h2>Тесты</h2>
            <p>Темы распределены по разделам, чтобы быстрее находить нужные варианты.</p>
          </div>

          <div class="catalog-stats">
            <span class="stat-chip">${totalTopics} ${getPlural(totalTopics, "тема", "темы", "тем")}</span>
            <span class="stat-chip">${totalTests} ${getPlural(totalTests, "тест", "теста", "тестов")}</span>
          </div>
        </div>

        <div class="category-nav">
          ${categoryGroups
            .map(
              (group, index) => `
            <button class="category-chip" type="button" data-category-target="cat-${index}">
              ${escapeHtml(group.category)}
            </button>
          `
            )
            .join("")}
        </div>

        <div class="category-stack">
          ${categoryGroups
            .map((group, index) => {
              const html = renderCategoryBlock(group, index, runningOffset);
              runningOffset += group.items.length;
              return html;
            })
            .join("")}
        </div>
      </section>
    `;

    attachCatalogToggles();
    attachCategoryNav();
  } catch (error) {
    console.error(error);

    catalogRoot.innerHTML = `
      <section class="catalog-shell">
        <div class="catalog-group">
          <div class="error-box">
            <h2>Ошибка загрузки</h2>
            <p>${escapeHtml(error.message)}</p>
          </div>
        </div>
      </section>
    `;
  }
}

window.renderCatalog = renderCatalog;
renderCatalog();