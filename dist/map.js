import {
  bucket,
  periods,
  setMembers,
  createMap,
  toggleEdge,
  peers,
} from './model.js?v=2';
import {
  esc,
  icon,
  iconButton,
  words,
  showPopup,
  chooseOption,
  notify,
  readableError,
} from './ui.js?v=2';

const W = 206,
  H = 78;
const views = new Map();
let linking = null;
function view(mapId) {
  if (!views.has(mapId)) views.set(mapId, { zoom: null, left: 0, top: 0 });
  return views.get(mapId);
}
function connectors(edges, nodes) {
  return edges
    .filter(([a, b]) => nodes[a] && nodes[b])
    .map(([a, b]) => {
      let p = nodes[a],
        q = nodes[b];
      if (p.x > q.x) [p, q] = [q, p];
      const ax = p.x + W,
        ay = p.y + H / 2,
        bx = q.x,
        by = q.y + H / 2;
      if (bx < ax && Math.abs(ay - by) > H) {
        if (p.y > q.y) [p, q] = [q, p];
        const top = p.y + H,
          bottom = q.y,
          mid = (top + bottom) / 2;
        return `<path d="M${p.x + W / 2} ${top} C${p.x + W / 2} ${mid},${q.x + W / 2} ${mid},${q.x + W / 2} ${bottom}"/>`;
      }
      const curve = Math.max(32, Math.abs(bx - ax) * 0.48);
      return `<path d="M${ax} ${ay} C${ax + curve} ${ay},${bx - curve} ${by},${bx} ${by}"/>`;
    })
    .join('');
}
export function previewMap(state, map) {
  if (!map || !Object.keys(map.nodes).length)
    return '<div class="mini-canvas empty-mini">Добавить задачи на карту</div>';
  const ids = Object.keys(map.nodes);
  const related = (id) =>
    peers(state, id).filter((other) => ids.includes(other));
  const first = [...ids].sort(
    (a, b) => related(b).length - related(a).length
  )[0];
  const children = related(first).slice(0, 2);
  const idsShown = [first, ...children];
  const points =
    children.length === 2
      ? [
          [145, 38],
          [72, 105],
          [218, 105],
        ]
      : children.length === 1
        ? [
            [145, 38],
            [145, 105],
          ]
        : [[145, 67]];
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const paths = points
    .slice(1)
    .map(
      ([x, y]) =>
        `<path d="M145 49 V62 Q145 71 ${x === 145 ? 145 : x < 145 ? 135 : 155} 71 H${x} Q${x} 71 ${x} 82 V${y - 12}"/>`
    )
    .join('');
  const labels = idsShown
    .map((id, i) => {
      const title = byId.get(id).title;
      const w = i ? 126 : 170,
        [x, y] = points[i];
      const clipped =
        title.length > (i ? 16 : 23)
          ? title.slice(0, i ? 15 : 22).trimEnd() + '…'
          : title;
      return `<g transform="translate(${x},${y})"><rect x="${-w / 2}" y="-14" width="${w}" height="28" rx="7" fill="${i ? '#fff' : '#e7edff'}" stroke="${i ? '#d7def0' : '#91a8ff'}"/><circle cx="${-w / 2 + 11}" r="2.6" fill="${i ? '#97a9d8' : '#4664e8'}"/><text x="4" y="3.8" text-anchor="middle">${esc(clipped)}</text></g>`;
    })
    .join('');
  return `<div class="mini-canvas"><svg aria-hidden="true" viewBox="0 0 290 145"><g fill="none" stroke="#9aabe2" stroke-width="1.5">${paths}</g>${labels}</svg></div>`;
}
export function mapMarkup(state, map) {
  const size = map ? Object.keys(map.nodes).length : 0;
  return `<section class="map-section"><div class="map-switch"><button type="button" class="menu-trigger" data-map-picker aria-label="Выбрать карту" aria-haspopup="listbox" aria-expanded="false">${icon('layers', 17)}<span>${esc(map?.name ?? 'Выбрать карту')}</span>${icon('down', 16)}</button><button class="btn" data-map-act="create">${icon('plus', 16)} Создать карту</button></div>
    <div class="map-frame"><div class="map-toolbar"><div class="map-caption"><strong>${esc(map?.name ?? 'Карта')}</strong><span>${size} ${words(size)}</span></div>
      <div class="map-actions"><button class="btn" data-map-act="members">${icon('list', 16)}Состав карты</button><button class="btn" data-map-act="link" aria-pressed="false">${icon('link', 16)}Связать</button></div></div>
    <div class="map-instruction" role="status" hidden></div>
    <div class="board-wrap"><div class="board-scroll" tabindex="0" aria-label="Полотно карты"><div class="scale-box"><div class="board-plane"><svg class="edge-layer" aria-hidden="true"></svg><div class="nodes"></div></div></div></div>
      ${size ? '' : '<div class="board-empty"><h3>На карте пока нет задач</h3><button class="btn" data-map-act="members">Выбрать задачи</button></div>'}
      <div class="zoom">${iconButton('zoom-out', 'Уменьшить масштаб', 'minus')}<output></output>${iconButton('zoom-in', 'Увеличить масштаб', 'plus')}<i></i>${iconButton('fit', 'Вместить карту', 'fit')}</div></div></div></section>`;
}
function chooseMembers(state, map, create, commit) {
  const before = new Set(Object.keys(create ? {} : map.nodes));
  const choices = state.tasks
    .map(
      (t) =>
        `<label class="member"><input type="checkbox" name="member" value="${esc(t.id)}" ${before.has(t.id) ? 'checked' : ''}><span>${esc(t.title)}<small>${t.done ? 'Завершена' : periods[bucket(t)]}</small></span></label>`
    )
    .join('');
  const popup = showPopup(
    create ? 'Новая карта' : 'Состав карты',
    `<form class="members-form" novalidate>${create ? '<label class="field">Название карты<input name="name" required maxlength="100" placeholder="Например, запуск проекта"></label>' : ''}<p class="form-label">Задачи на карте</p><div class="member-list">${choices || '<p class="muted">Задачи можно добавить позже.</p>'}</div><p role="alert" class="form-error"></p><div class="popup-foot"><button class="btn primary" type="submit">${create ? 'Создать карту' : 'Сохранить состав'}</button></div></form>`,
    { focus: create ? 'input[name="name"]' : 'input[name="member"]' }
  );
  const form = popup.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const chosen = new Set(
      [...form.querySelectorAll('[name="member"]:checked')].map(
        (el) => el.value
      )
    );
    const name = create ? form.elements.name.value : '';
    let id = map?.id;
    form.inert = true;
    try {
      await commit((s) => {
        if (create) id = createMap(s, name, [...chosen]).id;
        else
          setMembers(
            s,
            id,
            [...chosen].filter((x) => !before.has(x)),
            [...before].filter((x) => !chosen.has(x))
          );
      });
      popup.close();
      location.hash = 'map/' + id;
      notify(create ? 'Карта создана' : 'Состав карты сохранён');
    } catch (error) {
      form.querySelector('.form-error').textContent = readableError(error);
    } finally {
      form.inert = false;
    }
  };
}
export function bindMap({ state, map, commit, edit }) {
  const section = document.querySelector('.map-section');
  const picker = section.querySelector('[data-map-picker]');
  picker.onclick = () =>
    chooseOption(
      picker,
      'Выбрать карту',
      state.maps.map((m) => [m.id, m.name]),
      map?.id,
      (id) => {
        linking = null;
        location.hash = 'map/' + id;
      }
    );
  section.querySelector('[data-map-act="create"]').onclick = () =>
    chooseMembers(state, map, true, commit);
  if (!map) return;
  if (linking && linking.mapId !== map.id) linking = null;
  const pos = structuredClone(map.nodes),
    current = view(map.id);
  const scroll = section.querySelector('.board-scroll'),
    plane = section.querySelector('.board-plane'),
    box = section.querySelector('.scale-box');
  const edgeLayer = section.querySelector('.edge-layer'),
    nodes = section.querySelector('.nodes'),
    hint = section.querySelector('.map-instruction');
  const byId = new Map(state.tasks.map((t) => [t.id, t]));
  const bounds = () => {
    const all = Object.values(pos);
    return {
      width: Math.max(280, ...all.map((p) => p.x + W + 32)),
      height: Math.max(160, ...all.map((p) => p.y + H + 32)),
    };
  };
  function fit() {
    const b = bounds();
    return Math.min(
      1,
      (scroll.clientWidth - 8) / b.width,
      (scroll.clientHeight - 8) / b.height
    );
  }
  if (current.zoom === null) current.zoom = Math.max(0.75, fit());
  function layout() {
    const z = current.zoom,
      b = bounds();
    const w = Math.max(b.width, scroll.clientWidth / z),
      h = Math.max(b.height, scroll.clientHeight / z);
    plane.style.width = w + 'px';
    plane.style.height = h + 'px';
    plane.style.transform = `scale(${z})`;
    box.style.width = Math.ceil(w * z) + 'px';
    box.style.height = Math.ceil(h * z) + 'px';
    edgeLayer.innerHTML = connectors(state.edges, pos);
    section.querySelector('.zoom output').textContent =
      Math.round(z * 100) + '%';
  }
  nodes.innerHTML = Object.entries(pos)
    .map(([id, p]) => {
      const t = byId.get(id);
      return `<button type="button" class="map-node${t.done ? ' finished' : ''}" data-node="${esc(id)}" style="left:${p.x}px;top:${p.y}px" title="${esc(t.title)}"><small><i class="period-dot ${bucket(t)}"></i>${t.done ? 'Завершена' : periods[bucket(t)]}</small><strong>${esc(t.title)}</strong></button>`;
    })
    .join('');
  layout();
  scroll.scrollTo(current.left, current.top);
  scroll.onscroll = () => {
    current.left = scroll.scrollLeft;
    current.top = scroll.scrollTop;
  };
  function linkState() {
    hint.hidden = !linking;
    hint.textContent = !linking
      ? ''
      : linking.from
        ? 'Выберите вторую задачу. Повторный выбор пары уберёт связь.'
        : 'Выберите первую задачу для связи.';
    section
      .querySelector('[data-map-act="link"]')
      .setAttribute('aria-pressed', String(Boolean(linking)));
    for (const el of nodes.children)
      el.classList.toggle('chosen', el.dataset.node === linking?.from);
  }
  linkState();
  async function activate(id) {
    if (!linking) {
      edit(id);
      return;
    }
    if (!linking.from) {
      linking.from = id;
      linkState();
      return;
    }
    const source = linking.from;
    if (source === id) {
      linking.from = null;
      linkState();
      return;
    }
    linking = null;
    let added;
    try {
      await commit((s) => {
        added = toggleEdge(s, source, id);
      });
      notify(added ? 'Связь добавлена' : 'Связь удалена');
    } catch (error) {
      linkState();
      notify(readableError(error), true);
    }
  }
  let drag = null,
    suppress = false;
  async function savePosition(id, p) {
    try {
      await commit((s) => {
        const target = s.maps.find((m) => m.id === map.id);
        if (!target?.nodes[id]) throw new Error('Задачу уже убрали с карты.');
        target.nodes[id] = { x: Math.round(p.x), y: Math.round(p.y) };
      });
    } catch (error) {
      Object.assign(pos[id], map.nodes[id]);
      place(id);
      notify(readableError(error), true);
    }
  }
  function place(id) {
    const el = nodes.querySelector(`[data-node="${CSS.escape(id)}"]`);
    el.style.left = pos[id].x + 'px';
    el.style.top = pos[id].y + 'px';
    layout();
  }
  scroll.onpointerdown = (e) => {
    if (e.button !== 0 || !e.isPrimary) return;
    const node = e.target.closest('[data-node]');
    if (linking || (!node && e.pointerType === 'touch')) return;
    const id = node?.dataset.node;
    drag = {
      id,
      startX: e.clientX,
      startY: e.clientY,
      origin: id
        ? { ...pos[id] }
        : { x: scroll.scrollLeft, y: scroll.scrollTop },
      moved: false,
    };
    (node ?? scroll).setPointerCapture(e.pointerId);
  };
  scroll.onpointermove = (e) => {
    if (!drag || !e.isPrimary) return;
    const dx = e.clientX - drag.startX,
      dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    drag.moved = true;
    if (!drag.id) {
      scroll.scrollTo(drag.origin.x - dx, drag.origin.y - dy);
      return;
    }
    pos[drag.id] = {
      x: Math.max(8, drag.origin.x + dx / current.zoom),
      y: Math.max(8, drag.origin.y + dy / current.zoom),
    };
    place(drag.id);
  };
  scroll.onpointercancel = () => {
    if (drag?.id) {
      pos[drag.id] = drag.origin;
      place(drag.id);
    }
    drag = null;
  };
  scroll.onpointerup = () => {
    if (!drag) return;
    const ended = drag;
    drag = null;
    if (ended.moved && ended.id) {
      suppress = true;
      setTimeout(() => {
        suppress = false;
      }, 0);
      savePosition(ended.id, pos[ended.id]);
    }
  };
  nodes.onkeydown = (e) => {
    const step = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }[e.key];
    if (!step || !e.target.dataset.node || linking) return;
    e.preventDefault();
    const id = e.target.dataset.node,
      p = pos[id],
      n = e.shiftKey ? 50 : 12;
    p.x = Math.max(8, p.x + step[0] * n);
    p.y = Math.max(8, p.y + step[1] * n);
    place(id);
    savePosition(id, p).then(() =>
      document
        .querySelector(`[data-node="${CSS.escape(id)}"]`)
        ?.focus({ preventScroll: true })
    );
  };
  section.onclick = (e) => {
    const node = e.target.closest('[data-node]');
    if (node) {
      if (!suppress) activate(node.dataset.node);
      return;
    }
    const act =
      e.target.closest('[data-map-act]')?.dataset.mapAct ??
      e.target.closest('[data-act]')?.dataset.act;
    if (act === 'link') {
      if (Object.keys(pos).length < 2) {
        notify('Для связи добавьте на карту две задачи.');
        return;
      }
      linking = linking ? null : { mapId: map.id, from: null };
      linkState();
    } else if (act === 'members') chooseMembers(state, map, false, commit);
    else if (['zoom-in', 'zoom-out', 'fit'].includes(act)) {
      current.zoom =
        act === 'fit'
          ? Math.max(0.05, fit())
          : Math.min(
              1.8,
              Math.max(0.15, current.zoom + (act === 'zoom-in' ? 0.15 : -0.15))
            );
      layout();
      if (act === 'fit') scroll.scrollTo(0, 0);
    }
  };
}
