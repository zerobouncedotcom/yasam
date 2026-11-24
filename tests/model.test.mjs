import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bucket,
  dateKey,
  plusDays,
  taskDraft,
  saveTask,
  removeTask,
  createMap,
  setMembers,
  toggleEdge,
  peers,
  seed,
} from '../dist/model.js';

const day = '2026-11-24';
const make = () => ({ revision: 0, tasks: [], edges: [], maps: [] });
const add = (s, title) => saveTask(s, { ...taskDraft(), title }, []);
test('просроченная задача остаётся видимой, неделя заканчивается в воскресенье', () => {
  const dated = (date) => bucket({ period: 'later', date }, day);
  assert.equal(dated('2026-11-19'), 'today');
  assert.equal(dated(day), 'today');
  assert.equal(dated('2026-11-29'), 'week');
  assert.equal(dated('2026-11-30'), 'later');
  assert.equal(bucket({ period: 'week', date: '' }, day), 'week');
  assert.equal(plusDays('2026-12-31', 1), '2027-01-01');
  assert.equal(dateKey(new Date(2026, 0, 1, 23)), '2026-01-01');
});
test('пустое имя, несуществующая дата и время без даты отклоняются', () => {
  for (const data of [
    { title: ' ' },
    { title: 'x', date: '2026-02-30' },
    { title: 'x', time: '09:20' },
  ]) {
    assert.throws(() => saveTask(make(), { ...taskDraft(), ...data }, []));
  }
});
test('черновик из другой вкладки не перезаписывает изменение', () => {
  const state = make();
  const first = add(state, 'Проект');
  const copy = structuredClone(first);
  saveTask(state, { ...first, title: 'Новый план' }, []);
  assert.throws(
    () => saveTask(state, { ...copy, title: 'Старый план' }, []),
    /измен/
  );
  assert.equal(state.tasks[0].title, 'Новый план');
});
test('обе стороны видят одну связь, удаление чистит карты и связи', () => {
  const state = make();
  const a = add(state, 'Первый');
  const b = add(state, 'Второй');
  const map = createMap(state, 'Карта', [a.id, b.id]);
  toggleEdge(state, a.id, b.id);
  assert.deepEqual(peers(state, b.id), [a.id]);
  assert.throws(() => toggleEdge(state, a.id, a.id));
  setMembers(state, map.id, [], [b.id]);
  assert.equal(state.edges.length, 1);
  assert.equal(map.nodes[b.id], undefined);
  removeTask(state, a.id);
  assert.deepEqual(state.edges, []);
  assert.deepEqual(map.nodes, {});
});
test('редактирование связей проверяет существование задач и сохраняет чужие связи', () => {
  const s = make(),
    a = add(s, 'A'),
    b = add(s, 'B'),
    c = add(s, 'C');
  toggleEdge(s, b.id, c.id);
  saveTask(s, { ...a }, [b.id, b.id]);
  assert.equal(s.edges.length, 2);
  assert.deepEqual(peers(s, a.id), [b.id]);
  assert.throws(() => saveTask(s, { ...s.tasks[0] }, ['missing']));
});
test('стартовый план содержит только существующие узлы и корректные счётчики', () => {
  for (const when of [day, '2026-11-29']) {
    const s = seed(when);
    assert.equal(new Set(s.tasks.map((t) => t.id)).size, s.tasks.length);
    assert.ok(s.maps.length);
    for (const [a, b] of s.edges)
      assert.ok([a, b].every((id) => s.tasks.some((t) => t.id === id)));
    for (const period of ['today', 'week', 'later'])
      assert.ok(s.tasks.some((t) => !t.done && bucket(t, when) === period));
  }
});

test('миграция сохраняет личные задачи, связи, файлы и повторный запуск', async () => {
  const { upgradePlan, projectProgress } = await import('../dist/model.js');
  const old = seed(day);
  delete old.projects;
  for (const t of old.tasks) delete t.projectId;
  const personal = old.tasks.find((t) => t.id === 'refs');
  personal.title = 'Моя задача';
  const links = structuredClone(old.edges),
    files = structuredClone(old.tasks.find((t) => t.id === 'outline').files);
  const upgraded = upgradePlan(old);
  assert.equal(personal.projectId, null);
  assert.equal(upgraded.projects.length, 2);
  assert.deepEqual(upgraded.edges, links);
  assert.deepEqual(upgraded.tasks.find((t) => t.id === 'outline').files, files);
  assert.equal(projectProgress(upgraded, 'portfolio').done, 1);
  const copy = structuredClone(upgraded);
  assert.deepEqual(upgradePlan(upgraded), copy);
});

test('удаление проекта оставляет задачи, быстрый ввод защищает название от конфликта', async () => {
  const { saveProject, removeProject, projectProgress, renameTask } =
    await import('../dist/model.js');
  const s = seed(day),
    project = saveProject(s, { name: 'Доставка' });
  const t = saveTask(
    s,
    { ...taskDraft(), title: 'Отправить', projectId: project.id },
    []
  );
  assert.deepEqual(projectProgress(s, project.id), {
    done: 0,
    total: 1,
    percent: 0,
  });
  renameTask(s, t.id, 'Отправить', 'Передать посылку');
  assert.throws(() => renameTask(s, t.id, 'Отправить', 'Старое имя'), /измен/);
  removeProject(s, project);
  assert.equal(t.projectId, null);
  assert.equal(t.title, 'Передать посылку');
  assert.throws(
    () => saveTask(s, { ...t, projectId: project.id }, []),
    /удалён/
  );
});
