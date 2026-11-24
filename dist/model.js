export const periods = {
  today: 'Сегодня',
  week: 'На этой неделе',
  later: 'Потом',
};

export function dateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export function localDate(key) {
  const [year, month, day] = key.split('-').map(Number);
  const result = new Date(2000, 0, 1, 12);
  result.setFullYear(year, month - 1, day);
  return result;
}

export function plusDays(key, days) {
  const d = localDate(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

export function bucket(task, today = dateKey()) {
  if (!task.date) return task.period;
  if (task.date <= today) return 'today';
  const weekday = (localDate(today).getDay() + 6) % 7;
  return task.date <= plusDays(today, 6 - weekday) ? 'week' : 'later';
}

export function taskDraft(period = 'today') {
  return {
    id: crypto.randomUUID(),
    rev: 0,
    title: '',
    period,
    projectId: null,
    date: '',
    time: '',
    note: '',
    subs: [],
    files: [],
    done: false,
  };
}

export function saveProject(
  state,
  { id = crypto.randomUUID(), name, goal = '', rev = 0 }
) {
  const existing = state.projects.find((p) => p.id === id);
  if ((existing?.rev ?? 0) !== rev)
    throw new Error('Проект изменился. Откройте его заново.');
  if (!name.trim()) throw new Error('Введите название проекта.');
  const project = { id, name: name.trim(), goal: goal.trim(), rev: rev + 1 };
  if (existing) state.projects[state.projects.indexOf(existing)] = project;
  else state.projects.push(project);
  return project;
}

export function removeProject(state, project) {
  const existing = state.projects.find((p) => p.id === project.id);
  if (!existing || existing.rev !== project.rev)
    throw new Error('Проект изменился. Откройте его заново.');
  state.projects = state.projects.filter((p) => p.id !== project.id);
  for (const task of state.tasks) {
    if (task.projectId === project.id) {
      task.projectId = null;
      task.rev++;
    }
  }
}

export function projectProgress(state, id) {
  const tasks = state.tasks.filter((t) => t.projectId === id);
  const done = tasks.filter((t) => t.done).length;
  return {
    total: tasks.length,
    done,
    percent: tasks.length ? Math.round((100 * done) / tasks.length) : 0,
  };
}

export function renameTask(state, id, original, value) {
  const task = taskById(state, id);
  if (task.title !== original)
    throw new Error(
      'Название изменилось в другой вкладке. Откройте его заново.'
    );
  const title = value.trim();
  if (!title) throw new Error('Введите название задачи.');
  if (title !== task.title) {
    task.title = title;
    task.rev++;
  }
}

export function taskById(state, id) {
  const task = state.tasks.find((item) => item.id === id);
  if (!task) throw new Error('Задача уже удалена. Откройте план заново.');
  return task;
}

export function peers(state, id) {
  return state.edges
    .filter((edge) => edge.includes(id))
    .map(([a, b]) => (a === id ? b : a));
}

export function toggleEdge(state, a, b) {
  if (a === b) throw new Error('Выберите две разные задачи.');
  const first = taskById(state, a);
  const second = taskById(state, b);
  const index = state.edges.findIndex(
    (edge) => edge.includes(a) && edge.includes(b)
  );
  if (index < 0) state.edges.push([a, b].sort());
  else state.edges.splice(index, 1);
  first.rev++;
  second.rev++;
  return index < 0;
}

export function saveTask(state, draft, related) {
  const existing = state.tasks.find((t) => t.id === draft.id);
  if ((existing?.rev ?? 0) !== draft.rev)
    throw new Error(
      'Задача изменилась в другой вкладке. Скопируйте нужные правки и откройте её заново.'
    );
  const title = draft.title.trim();
  if (!title) throw new Error('Введите название задачи.');
  if (!(draft.period in periods)) throw new Error('Выберите период.');
  if (
    draft.date &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) ||
      dateKey(localDate(draft.date)) !== draft.date)
  )
    throw new Error('Проверьте дату.');
  if (
    draft.time &&
    (!draft.date || !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time))
  )
    throw new Error('Для времени укажите дату.');
  if (draft.projectId && !state.projects?.some((p) => p.id === draft.projectId))
    throw new Error('Этот проект уже удалён. Выберите другой.');
  const selected = new Set(related);
  if (selected.has(draft.id))
    throw new Error('Выберите другую задачу для связи.');
  for (const id of selected) taskById(state, id);
  const previous = new Set(peers(state, draft.id));
  const changed = [...new Set([...selected, ...previous])].filter(
    (id) => selected.has(id) !== previous.has(id)
  );
  for (const id of changed) taskById(state, id).rev++;
  state.edges = state.edges.filter((edge) => !edge.includes(draft.id));
  for (const id of selected) state.edges.push([draft.id, id].sort());
  const task = { ...structuredClone(draft), title, rev: draft.rev + 1 };
  if (existing) state.tasks[state.tasks.indexOf(existing)] = task;
  else state.tasks.push(task);
  return task;
}

export function removeTask(state, id, expectedRev) {
  const task = taskById(state, id);
  if (expectedRev !== undefined && expectedRev !== task.rev)
    throw new Error('Задача изменилась. Откройте её заново перед удалением.');
  for (const other of peers(state, id)) taskById(state, other).rev++;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  state.edges = state.edges.filter((edge) => !edge.includes(id));
  for (const map of state.maps) delete map.nodes[id];
  return task.files;
}

export function createMap(state, name, ids = []) {
  if (!name.trim()) throw new Error('Введите название карты.');
  const map = { id: crypto.randomUUID(), name: name.trim(), nodes: {} };
  state.maps.push(map);
  setMembers(state, map.id, ids, []);
  return map;
}

export function setMembers(state, mapId, add, remove) {
  const map = state.maps.find((item) => item.id === mapId);
  if (!map) throw new Error('Карта уже удалена.');
  for (const id of remove) delete map.nodes[id];
  for (const id of add) {
    taskById(state, id);
    if (map.nodes[id]) continue;
    let slot = 0,
      x,
      y;
    do {
      x = 32 + (slot % 3) * 255;
      y = 40 + Math.floor(slot / 3) * 112;
      slot++;
    } while (
      Object.values(map.nodes).some(
        (p) => Math.abs(p.x - x) < 214 && Math.abs(p.y - y) < 84
      )
    );
    map.nodes[id] = { x, y };
  }
  return map;
}

export const sampleFile = {
  id: 'sample-brief',
  name: 'План кейса.txt',
  type: 'text/plain;charset=utf-8',
};
export const sampleContent =
  'План кейса\n\n1. Задача и ограничения\n2. Поиск решения\n3. Прототип и проверка\n4. Что получилось\n';

export function seed(today = dateKey()) {
  const state = { revision: 1, tasks: [], edges: [], maps: [], projects: [] };
  saveProject(state, {
    id: 'portfolio',
    name: 'Портфолио',
    goal: 'Опубликовать новый кейс',
  });
  saveProject(state, {
    id: 'website',
    name: 'Прототип сайта',
    goal: 'Подготовить макет к показу',
  });
  const next = plusDays(today, 1);
  function example(id, title, period, details = {}) {
    const task = { ...taskDraft(period), id, title, rev: 1, ...details };
    state.tasks.push(task);
    return task;
  }
  example('refs', 'Собрать референсы для портфолио', 'today', {
    date: today,
    time: '10:00',
    note: 'Выбрать три работы и записать, что хочется перенести в свой кейс.',
    subs: [
      'Посмотреть подборку',
      'Отобрать три работы',
      'Подписать находки',
    ].map((title, i) => ({ id: 'ref-' + i, title, done: i === 0 })),
  });
  example('meeting', 'Обсудить концепцию с командой', 'today', {
    date: today,
    time: '14:30',
    note: 'Сверить сценарий показа и договориться о следующем шаге.',
  });
  example('outline', 'Набросать структуру кейса', 'today', {
    date: today,
    files: [{ ...sampleFile, size: new Blob([sampleContent]).size }],
  });
  example('prototype', 'Собрать первый прототип', 'week', {
    date: bucket({ date: next }, today) === 'week' ? next : '',
    subs: [
      { id: 'p1', title: 'Собрать основной экран', done: false },
      { id: 'p2', title: 'Проверить переходы', done: false },
    ],
  });
  example('text', 'Написать текст для главной', 'week', {
    note: 'Начать с одной фразы о том, какую задачу решает проект.',
  });
  example('review', 'Показать макет коллегам', 'week');
  example('mobile', 'Проверить мобильную версию', 'week');
  example('publish', 'Опубликовать новый кейс', 'later');
  example('ideas', 'Разобрать идеи для следующего проекта', 'later');
  example('brief', 'Записать цель проекта', 'today', {
    date: today,
    done: true,
  });
  for (const task of state.tasks) {
    task.projectId = ['meeting', 'prototype', 'review', 'mobile'].includes(
      task.id
    )
      ? 'website'
      : 'portfolio';
  }
  state.edges = [
    ['outline', 'refs'],
    ['outline', 'prototype'],
    ['prototype', 'review'],
    ['prototype', 'publish'],
  ];
  const map = createMap(state, 'Портфолио', [
    'refs',
    'outline',
    'prototype',
    'review',
    'publish',
  ]);
  map.nodes = {
    refs: { x: 30, y: 130 },
    outline: { x: 280, y: 130 },
    prototype: { x: 530, y: 130 },
    review: { x: 780, y: 50 },
    publish: { x: 780, y: 215 },
  };
  return state;
}

export function upgradePlan(state) {
  if (Array.isArray(state.projects)) return state;
  const sample = seed();
  const used = new Set();
  for (const t of state.tasks) {
    const example = sample.tasks.find(
      (e) => e.id === t.id && e.title === t.title
    );
    t.projectId = example?.projectId ?? null;
    if (t.projectId) used.add(t.projectId);
  }
  state.projects = sample.projects.filter((p) => used.has(p.id));
  state.revision++;
  return state;
}
