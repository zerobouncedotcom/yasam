import {
  periods,
  bucket,
  dateKey,
  taskById,
  peers,
  projectProgress,
  saveProject,
  removeProject,
  renameTask,
} from './model.js?v=2';
import { readPlan, writePlan, onRemoteChange } from './store.js?v=2';
import {
  icon,
  esc,
  brand,
  formatDate,
  words,
  showPopup,
  notify,
  readableError,
  chooseOption,
  editInlineTitle,
  confirmAction,
} from './ui.js?v=2';
import { openEditor } from './editor.js?v=2';
import { mapMarkup, bindMap, previewMap } from './map.js?v=2';

const page = document.querySelector('#page');
const nav = {
  plan: ['Мой план', 'plan'],
  projects: ['Проекты', 'folder'],
  map: ['Карта задач', 'map'],
  done: ['Завершённые', 'completed'],
};
const glyphs = { today: 'sun', week: 'calendar', later: 'layers' };
const collapsed = new Set();
let state,
  sort = 'plan',
  day = dateKey();
function route() {
  const [key, id] = location.hash.slice(1).split('/');
  return {
    key:
      Object.hasOwn(nav, key) ||
      Object.hasOwn(periods, key) ||
      (key === 'project' && state?.projects.some((p) => p.id === id))
        ? key
        : 'plan',
    id,
  };
}
function activeMap() {
  return state.maps.find((m) => m.id === route().id) ?? state.maps[0];
}
function accept(next) {
  if (!state || next.revision >= state.revision) state = next;
  render();
}
async function refresh() {
  try {
    accept(await readPlan());
  } catch (error) {
    page.removeAttribute('aria-busy');
    if (state) {
      notify(readableError(error), true);
      return;
    }
    page.innerHTML =
      '<div class="empty"><h2>Не удалось открыть план</h2><p>Для хранения задач разрешите сайту сохранять данные в браузере.</p><button class="btn" data-act="retry">Повторить</button></div>';
  }
}
async function commit(change) {
  accept(await writePlan(change));
}
function edit(id, period) {
  const { key } = route();
  openEditor({
    state,
    task: id ? taskById(state, id) : null,
    period: period ?? (Object.hasOwn(periods, key) ? key : 'today'),
    projectId: key === 'project' ? route().id : null,
    mapId: key === 'map' ? activeMap()?.id : null,
    commit,
    openRelated: edit,
  });
}
function navLink(key, label, glyph, count, active) {
  return `<a class="nav-link${active ? ' selected' : ''}" href="#${key}" ${active ? 'aria-current="page"' : ''}>${icon(glyph, 19)}<span>${label}</span>${count !== undefined ? `<small>${count}</small>` : ''}</a>`;
}
function chrome(key, counts, project) {
  const label = project?.name ?? nav[key]?.[0] ?? periods[key];
  const current =
    key === 'project' ? 'projects' : Object.hasOwn(periods, key) ? 'plan' : key;
  const mainNav = Object.entries(nav)
    .map(([k, [name, g]]) =>
      navLink(
        k,
        name,
        g,
        undefined,
        k === key || (k === 'projects' && key === 'project')
      )
    )
    .join('');
  document.querySelector('#sidebar').innerHTML = `
    <div class="sidebar-top">${brand()}</div>
    <nav class="side-nav" aria-label="Разделы">
      <div class="nav-heading">Рабочее пространство</div>${mainNav}
      <div class="nav-heading second">Периоды</div>${Object.entries(periods)
        .map(([k, v]) => navLink(k, v, glyphs[k], counts[k], k === key))
        .join('')}
    </nav>
    <button class="local-profile" data-act="info"><span class="avatar">Я</span><span><strong>Личный план</strong><small>В этом браузере</small></span>${icon('info', 16)}</button>`;
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘ K'
    : 'Ctrl K';
  document.querySelector('#topbar').innerHTML =
    `<div class="crumb">${icon('workspace', 17)}<span>Личное пространство</span><i>/</i><strong>${esc(label)}</strong></div>
    <div class="mobile-brand">${brand()}</div><div class="head-actions"><button class="search-btn" data-act="search" aria-label="Поиск">${icon('search', 17)}<span>Поиск</span><kbd>${shortcut}</kbd></button><button class="mobile-info icon-button" data-act="info" aria-label="О личном плане">${icon('info')}</button></div>`;
  document.querySelector('#mobile-nav').innerHTML = Object.entries(nav)
    .map(([k, [name, g]]) =>
      navLink(
        k,
        k === 'plan' ? 'План' : k === 'map' ? 'Карта' : name,
        g,
        undefined,
        k === current
      )
    )
    .join('');
  document.title = `${label} · YaSam`;
}
function horizonCards(counts, key) {
  return `<div class="horizons" aria-label="Периоды планирования">${Object.entries(
    periods
  )
    .map(
      ([k, name]) => `
    <a class="horizon ${k}${counts[k] >= 100 ? ' wide-count' : ''}" href="#${key === k ? 'plan' : k}" aria-label="${name}, ${counts[k]} ${words(counts[k])}" ${key === k ? 'aria-current="page"' : ''}>
      <span class="h-title">${name}</span>
      <span class="h-count">${counts[k]}</span>
      <img src="./assets/${k}.png" alt="" width="148" height="148">
    </a>`
    )
    .join('')}</div>`;
}
function taskRow(t) {
  const items = [];
  if (t.subs.length)
    items.push(
      `<span title="Подзадачи">${icon('sub', 14)} ${t.subs.filter((s) => s.done).length}/${t.subs.length}</span>`
    );
  if (t.files.length)
    items.push(
      `<span title="Вложения">${icon('clip', 13)} ${t.files.length} ${words(t.files.length, ['файл', 'файла', 'файлов'])}</span>`
    );
  const related = peers(state, t.id).length;
  if (related)
    items.push(
      `<span title="Связанные задачи">${icon('link', 13)} ${related}</span>`
    );
  if (!items.length && t.note)
    items.push(`<span>${icon('note', 13)} Заметка</span>`);
  const otherDate = t.date && t.date !== day ? formatDate(t.date) : '';
  const when = [otherDate, t.time].filter(Boolean).join(' · ');
  const overdue = t.date && t.date < day && !t.done;
  const due = when
    ? `<span class="due ${overdue ? 'overdue' : t.time ? 'timed' : ''}" ${overdue ? 'title="Срок прошёл"' : ''}>${icon(t.time ? 'clock' : 'calendar', 13)}${esc(when)}</span>`
    : '';
  return `<li class="task-row${t.done ? ' is-done' : ''}"><button class="task-check" role="checkbox" aria-checked="${t.done}" aria-label="${t.done ? 'Вернуть в план' : 'Завершить'}: ${esc(t.title)}" data-act="toggle" data-id="${esc(t.id)}"><i>${t.done ? icon('check', 12) : ''}</i></button>
    <div class="task-entry" data-act="edit" data-id="${esc(t.id)}"><div class="task-copy"><button class="task-name" data-act="rename" data-id="${esc(t.id)}" aria-label="Переименовать: ${esc(t.title)}">${esc(t.title)}</button>${items.length ? `<small>${items.join('')}</small>` : ''}</div>${due}<button class="task-open" data-act="edit" data-id="${esc(t.id)}" aria-label="Открыть детали: ${esc(t.title)}">${icon('right', 16)}</button></div></li>`;
}
function orderTasks(tasks) {
  if (sort === 'name')
    return tasks.sort((a, b) => a.title.localeCompare(b.title, 'ru'));
  if (sort === 'date')
    return tasks.sort(
      (a, b) =>
        (a.date || '9999').localeCompare(b.date || '9999') ||
        (a.time || '24').localeCompare(b.time || '24')
    );
  return tasks;
}
const sortChoices = [
  ['plan', 'По плану'],
  ['date', 'По сроку'],
  ['name', 'По названию'],
];
function taskList(key, project) {
  const done = key === 'done';
  const groups = project
    ? [...Object.keys(periods), 'done']
    : done
      ? ['done']
      : key === 'plan'
        ? Object.keys(periods)
        : [key];
  const sections = groups
    .map((k) => ({
      k,
      tasks: orderTasks(
        state.tasks.filter(
          (t) =>
            (!project || t.projectId === project.id) &&
            (k === 'done' ? t.done : !t.done && bucket(t, day) === k)
        )
      ),
    }))
    .filter(({ tasks }) => tasks.length || key === 'plan');
  const sortButton = `<button type="button" class="sort menu-trigger" data-act="sort" aria-haspopup="listbox" aria-expanded="false" aria-label="Сортировка задач">${icon('sort', 17)}<span>${sortChoices.find(([value]) => value === sort)[1]}</span></button>`;
  const list = sections
    .map(({ k, tasks }, index) => {
      const groupId = `${project?.id ?? key}:${k}`;
      const hidden = collapsed.has(groupId);
      const label = k === 'done' ? 'Готово' : k === key ? 'Задачи' : periods[k];
      const body = hidden
        ? ''
        : tasks.length
          ? `<ul>${tasks.map(taskRow).join('')}</ul>`
          : `<button type="button" class="text-btn empty-period-add" data-act="new" data-period="${k}" aria-label="Добавить задачу в раздел «${label}»">${icon('plus', 16)}Добавить задачу</button>`;
      return `<section class="task-group" aria-labelledby="heading-${k}">
      <div class="group-heading"><h2 id="heading-${k}"><button type="button" class="group-toggle" data-act="group" data-id="${esc(groupId)}" aria-expanded="${!hidden}" aria-controls="tasks-${k}">
      ${label}${hidden ? `<span class="group-count" aria-hidden="true">${tasks.length}</span>` : ''}${icon('down', 14)}</button></h2>${index === 0 ? sortButton : ''}</div>
      <div id="tasks-${k}"${hidden ? ' hidden' : ''}>${body}</div></section>`;
    })
    .join('');
  return `<section class="list-section" aria-label="${done ? 'Выполненные задачи' : 'Список задач'}">
    ${project && state.tasks.some((t) => t.projectId !== project.id) ? `<button class="text-btn project-import" data-act="attach-task" aria-haspopup="listbox" aria-expanded="false">${icon('plus', 16)}Добавить из плана</button>` : ''}
    ${list || `<div class="empty">${icon(done ? 'completed' : 'list', 28)}<h3>${done ? 'Завершённых задач пока нет' : 'Здесь пока нет задач'}</h3><p>${done ? 'Отмечайте выполненное кружком рядом с задачей.' : 'Добавьте первое дело в этот план.'}</p>${done ? '' : '<button class="btn" data-act="new">Новая задача</button>'}</div>`}
    </section>`;
}
function insights() {
  const map = state.maps[0];
  return `<aside class="insights" aria-label="Обзор плана"><section class="insight map-preview-card"><div class="rail-title"><span class="rail-icon">${icon('map', 17)}</span><h2>Карта задач</h2></div>
    <a class="mini-link" aria-label="Открыть карту ${esc(map?.name ?? '')}" href="#map${map ? '/' + esc(map.id) : ''}">${previewMap(state, map)}</a>
    <a class="map-open" href="#map${map ? '/' + esc(map.id) : ''}"><span>Открыть карту</span>${icon('upRight', 15)}</a></section>
    ${projectStack(true)}</aside>`;
}
function projectCard(project) {
  const { total, done, percent } = projectProgress(state, project.id);
  return `<a class="project-card" href="#project/${esc(project.id)}" ${route().key === 'project' && route().id === project.id ? 'aria-current="page"' : ''}><div class="project-card-top">${icon('folder', 17)}<strong>${esc(project.name)}</strong>${icon('right', 16)}</div>
    ${project.goal ? `<p>${esc(project.goal)}</p>` : ''}<div class="project-numbers"><span>Выполнено ${done} из ${total}</span><b>${percent}%</b></div>
    <div class="meter" role="progressbar" aria-label="${esc(project.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}"><i data-meter="${esc(project.id)}" style="transform:scaleX(${done / (total || 1)})"></i></div></a>`;
}
function projectStack(rail) {
  return `<section class="project-stack">${rail ? `<div class="rail-title"><span class="rail-icon neutral">${icon('folder', 17)}</span><h2>Проекты</h2><button class="icon-button" data-act="new-project" aria-label="Создать проект">${icon('plus', 17)}</button></div>` : ''}
    ${state.projects.map(projectCard).join('') || '<div class="empty"><h3>Проектов пока нет</h3><button class="btn" data-act="new-project">Создать проект</button></div>'}</section>`;
}
function projectEditor(project) {
  const dialog = showPopup(
    project ? 'Настройки проекта' : 'Новый проект',
    `<form class="project-form" novalidate><label class="field">Название проекта<input name="name" maxlength="100" required value="${esc(project?.name)}" placeholder="Например, портфолио"></label><label class="field">Результат <input name="goal" maxlength="180" value="${esc(project?.goal)}" placeholder="Чего хотите достичь?"></label><p role="alert" class="form-error"></p><div class="popup-foot">${project ? '<button type="button" class="btn delete-btn" data-remove>Удалить проект</button>' : ''}<button type="submit" class="btn primary">${project ? 'Сохранить' : 'Создать проект'}</button></div></form>`,
    { focus: 'input' }
  );
  const form = dialog.querySelector('form'),
    error = form.querySelector('.form-error');
  form.onsubmit = async (e) => {
    e.preventDefault();
    if (form.inert) return;
    form.inert = true;
    try {
      let id;
      await commit((s) => {
        id = saveProject(s, {
          ...project,
          name: form.elements.name.value,
          goal: form.elements.goal.value,
        }).id;
      });
      dialog.close();
      location.hash = 'project/' + id;
    } catch (err) {
      error.textContent = readableError(err);
    } finally {
      form.inert = false;
    }
  };
  const del = form.querySelector('[data-remove]');
  if (del)
    del.onclick = async () => {
      if (
        !(await confirmAction(
          'Удалить проект?',
          'Его задачи останутся в плане без проекта.',
          'Удалить проект',
          'Оставить',
          true
        ))
      )
        return;
      try {
        await commit((s) => removeProject(s, project));
        dialog.close();
        location.hash = 'projects';
      } catch (err) {
        error.textContent = readableError(err);
      }
    };
}
let lastRoute;
function render() {
  if (!state) return;
  day = dateKey();
  const { key } = route();
  const counts = { today: 0, week: 0, later: 0 };
  for (const t of state.tasks) if (!t.done) counts[bucket(t, day)]++;
  const focused = document.activeElement?.closest('[data-act][data-id]');
  const project =
    key === 'project' ? state.projects.find((p) => p.id === route().id) : null;
  const previousMeters = new Map(
    [...page.querySelectorAll('[data-meter]')].map((el) => [
      el.dataset.meter,
      el.style.transform,
    ])
  );
  chrome(key, counts, project);
  const title = project?.name ?? nav[key]?.[0] ?? periods[key];
  const date = formatDate(day, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const completeCount = state.tasks.filter((t) => t.done).length;
  const sub = project
    ? project.goal || 'Задачи проекта'
    : key === 'projects'
      ? `${state.projects.length} ${words(state.projects.length, ['проект', 'проекта', 'проектов'])}`
      : key === 'map'
        ? `${state.maps.length} ${words(state.maps.length, ['карта', 'карты', 'карт'])} · ${state.edges.length} ${words(state.edges.length, ['связь', 'связи', 'связей'])}`
        : key === 'done'
          ? `${completeCount} ${words(completeCount)}`
          : date.charAt(0).toUpperCase() + date.slice(1);
  const actions =
    key === 'projects'
      ? `<button class="btn primary" data-act="new-project">${icon('plus', 17)}Создать проект</button>`
      : `<div class="page-actions">${project ? '<button class="btn" data-act="edit-project">Настройки проекта</button>' : ''}<button class="btn primary new-task" data-act="new">${icon('plus', 18)}<span>Новая задача</span></button></div>`;
  const body =
    key === 'map'
      ? mapMarkup(state, activeMap())
      : key === 'projects'
        ? projectStack(false)
        : `${!project && key !== 'done' ? horizonCards(counts, key) : ''}<div class="plan-body">${taskList(key, project)}${insights()}</div>`;
  page.innerHTML =
    `<div class="page-heading"><div><h1>${esc(title)}</h1><p>${Object.hasOwn(periods, key) || key === 'plan' ? icon('calendar', 16) : ''}${esc(sub)}</p></div>${actions}</div>` +
    body;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    if (lastRoute !== undefined && lastRoute !== location.hash)
      page.querySelector('h1').animate([{ opacity: 0.65 }, { opacity: 1 }], {
        duration: 120,
        easing: 'ease-out',
      });
    for (const el of page.querySelectorAll('[data-meter]')) {
      const from = previousMeters.get(el.dataset.meter);
      if (from && from !== el.style.transform)
        el.animate([{ transform: from }, { transform: el.style.transform }], {
          duration: 160,
          easing: 'ease-out',
        });
    }
  }
  lastRoute = location.hash;
  page.removeAttribute('aria-busy');
  if (key === 'map') bindMap({ state, map: activeMap(), commit, edit, render });
  if (focused && !focused.isConnected) {
    const selector = `[data-act="${CSS.escape(focused.dataset.act)}"][data-id="${CSS.escape(focused.dataset.id)}"]`;
    (page.querySelector(selector) ?? page.querySelector('h1'))?.focus({
      preventScroll: true,
    });
  }
}
function search() {
  const dialog = showPopup(
    'Поиск задач',
    `<label class="search-box">${icon('search')}<input type="search" placeholder="Название, заметка или подзадача" aria-label="Поиск по задачам" autocomplete="off"></label><div class="search-results"></div>`,
    { focus: 'input' }
  );
  const input = dialog.querySelector('input'),
    results = dialog.querySelector('.search-results');
  function update() {
    const query = input.value.trim().toLocaleLowerCase('ru');
    const matches = state.tasks.filter((t) =>
      [
        t.title,
        t.note,
        ...t.subs.map((s) => s.title),
        ...t.files.map((f) => f.name),
      ].some((s) => s.toLocaleLowerCase('ru').includes(query))
    );
    results.innerHTML =
      matches
        .map(
          (t) =>
            `<button class="result" data-id="${esc(t.id)}">${icon(t.done ? 'completed' : glyphs[bucket(t, day)], 17)}<span>${esc(t.title)}<small>${t.done ? 'Завершена' : periods[bucket(t, day)]}</small></span>${icon('right', 14)}</button>`
        )
        .join('') ||
      '<p class="muted">Ничего не найдено. Попробуйте другое слово.</p>';
  }
  results.onclick = (e) => {
    const b = e.target.closest('[data-id]');
    if (b) {
      dialog.close();
      edit(b.dataset.id);
    }
  };
  input.oninput = update;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') results.querySelector('button')?.click();
  };
  update();
}
document.addEventListener('click', async (event) => {
  const b = event.target.closest('[data-act]');
  if (!b || b.closest('dialog')) return;
  try {
    switch (b.dataset.act) {
      case 'rename': {
        const task = taskById(state, b.dataset.id);
        editInlineTitle(b, task, (title) =>
          commit((s) => renameTask(s, task.id, task.title, title))
        );
        break;
      }
      case 'sort':
        chooseOption(b, 'Сортировка задач', sortChoices, sort, (value) => {
          sort = value;
          render();
          page.querySelector('.sort')?.focus({ preventScroll: true });
        });
        break;
      case 'attach-task': {
        const projectId = route().id;
        const candidates = state.tasks.filter((t) => t.projectId !== projectId);
        const options = candidates.map((t) => [
          t.id,
          [t.title, state.projects.find((p) => p.id === t.projectId)?.name]
            .filter(Boolean)
            .join(' · '),
        ]);
        chooseOption(b, 'Добавить из плана', options, null, async (id) => {
          try {
            const before = candidates.find((t) => t.id === id);
            await commit((s) => {
              const task = taskById(s, id);
              if (
                !s.projects.some((p) => p.id === projectId) ||
                task.projectId !== before.projectId
              )
                throw new Error(
                  'Состав проектов изменился. Выберите задачу ещё раз.'
                );
              task.projectId = projectId;
              task.rev++;
            });
            notify('Задача добавлена в проект');
          } catch (error) {
            notify(readableError(error), true);
          }
        });
        break;
      }
      case 'new-project':
        projectEditor(null);
        break;
      case 'edit-project':
        projectEditor(state.projects.find((p) => p.id === route().id));
        break;
      case 'retry':
        await refresh();
        break;
      case 'new':
        edit(undefined, b.dataset.period);
        break;
      case 'edit':
        edit(b.dataset.id);
        break;
      case 'toggle': {
        const id = b.dataset.id,
          done = b.getAttribute('aria-checked') !== 'true';
        b.disabled = true;
        await commit((s) => {
          const t = taskById(s, id);
          if (t.done !== done) {
            t.done = done;
            t.rev++;
          }
        });
        notify(done ? 'Задача завершена' : 'Задача снова в плане');
        break;
      }
      case 'group': {
        const id = b.dataset.id;
        if (collapsed.has(id)) collapsed.delete(id);
        else collapsed.add(id);
        render();
        break;
      }
      case 'search':
        search();
        break;
      case 'info':
        showPopup(
          'Личный план',
          '<div class="info-body"><p>При первом открытии YaSam добавляет пример плана для портфолио. Любую задачу можно изменить или удалить.</p><p>Задачи, карты и файлы хранятся в этом браузере на этом устройстве. У каждого посетителя свой план. Очистка данных сайта удалит его.</p></div>'
        );
        break;
    }
  } catch (error) {
    b.disabled = false;
    notify(readableError(error), true);
  }
});
document.addEventListener('keydown', (e) => {
  if (
    (e.ctrlKey || e.metaKey) &&
    e.key.toLowerCase() === 'k' &&
    state &&
    !document.querySelector('dialog[open]')
  ) {
    e.preventDefault();
    search();
  }
});
window.addEventListener('hashchange', () => {
  render();
  window.scrollTo(0, 0);
});
document.querySelector('.skip').addEventListener('click', (event) => {
  event.preventDefault();
  document.querySelector('#main').focus();
});
onRemoteChange(refresh);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) refresh();
});
setInterval(() => {
  if (!document.hidden && day !== dateKey()) render();
}, 30000);
refresh();
