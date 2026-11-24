import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright-core';

const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4173';
const browser = await chromium.launch();
const errors = [];
const context = await browser.newContext({
  viewport: { width: 1440, height: 960 },
  locale: 'ru-RU',
  acceptDownloads: true,
});
context.on('weberror', (event) => errors.push(event.error().message));
context.on('dialog', (dialog) => {
  errors.push('Системный диалог: ' + dialog.type());
  dialog.dismiss();
});
const page = await context.newPage();
page.setDefaultTimeout(7000);
const drawer = page.locator('#editor'),
  popup = page.locator('#popup');

async function screenshot(target, name) {
  if (!process.env.SCREENSHOT_DIR) return;
  await mkdir(process.env.SCREENSHOT_DIR, { recursive: true });
  await target.screenshot({
    path: resolve(process.env.SCREENSHOT_DIR, name + '.png'),
    animations: 'disabled',
  });
}
async function visible(locator) {
  await locator.waitFor({ state: 'visible' });
}
async function finishEdit(label = 'Сохранить') {
  await drawer.getByRole('button', { name: label, exact: true }).click();
  await drawer.waitFor({ state: 'hidden' });
}
const row = (title) =>
  page.getByRole('button', { name: 'Открыть детали: ' + title, exact: true });
try {
  await page.goto(baseURL);
  await visible(page.getByRole('heading', { level: 1, name: 'Мой план' }));
  await page.evaluate(() => document.fonts.ready);
  await page
    .locator('img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
  assert.equal(await page.locator('.horizon').count(), 3);
  assert.equal(
    await page
      .locator('img')
      .evaluateAll((imgs) =>
        imgs.every((img) => img.complete && img.naturalWidth > 0)
      ),
    true
  );
  await screenshot(page, 'desktop');
  await page.setViewportSize({ width: 1440, height: 1120 });
  await row('Набросать структуру кейса').click();
  const chevrons = await drawer
    .locator('.fold summary > svg:last-child')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().right));
  assert.equal(chevrons.length, 2);
  assert.ok(Math.abs(chevrons[0] - chevrons[1]) < 1);
  await screenshot(page, 'editor');
  await drawer.getByRole('button', { name: 'Закрыть задачу' }).click();
  await page.setViewportSize({ width: 1440, height: 960 });

  await page
    .getByRole('button', { name: 'Новая задача', exact: true })
    .first()
    .click();
  await drawer.getByLabel('Название задачи').fill('Проверить сборку YaSam');
  await drawer.getByRole('button', { name: 'Потом', exact: true }).click();
  await drawer
    .getByRole('textbox', { name: 'Новая подзадача' })
    .fill('Открыть на телефоне');
  await drawer.getByRole('textbox', { name: 'Новая подзадача' }).press('Enter');
  await drawer
    .getByRole('checkbox', { name: 'Открыть на телефоне', exact: true })
    .check();
  await drawer
    .getByLabel('Заметка', { exact: true })
    .fill('Результат проверки');
  await drawer.locator('summary').filter({ hasText: 'Файлы' }).click();
  await drawer.locator('input[type=file]').setInputFiles({
    name: 'результат.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('YaSam smoke'),
  });
  const droppedFile = await page.evaluateHandle(() => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File(['drop'], 'Перетащенный.txt', { type: 'text/plain' })
    );
    return transfer;
  });
  await drawer
    .locator('.files-fold')
    .dispatchEvent('drop', { dataTransfer: droppedFile });
  await droppedFile.dispose();
  await visible(
    drawer.locator('.file-download').filter({ hasText: 'Перетащенный.txt' })
  );
  await drawer
    .getByRole('button', { name: 'Убрать файл Перетащенный.txt' })
    .click();
  await drawer
    .locator('summary')
    .filter({ hasText: 'Связанные задачи' })
    .click();
  await drawer.getByRole('button', { name: 'Добавить связь' }).click();
  await page
    .getByRole('option', {
      name: 'Собрать референсы для портфолио',
      exact: true,
    })
    .click();
  await finishEdit('Создать задачу');
  await page.reload();
  await row('Проверить сборку YaSam').click();
  assert.equal(
    await drawer.getByLabel('Заметка', { exact: true }).inputValue(),
    'Результат проверки'
  );
  assert.equal(
    await drawer
      .getByRole('checkbox', { name: 'Открыть на телефоне', exact: true })
      .isChecked(),
    true
  );
  assert.match(
    await drawer.locator('.related').innerText(),
    /Собрать референсы/
  );
  const downloadEvent = page.waitForEvent('download');
  await drawer.locator('.file-download').click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), 'результат.txt');
  assert.equal(await readFile(await download.path(), 'utf8'), 'YaSam smoke');
  await drawer
    .getByLabel('Дата', { exact: true })
    .fill(
      await page.evaluate(() =>
        new Intl.DateTimeFormat('sv-SE').format(new Date())
      )
    );
  await drawer.getByLabel('Время', { exact: true }).fill('17:45');
  await finishEdit();
  await page.locator('.horizon.today').click();
  await visible(row('Проверить сборку YaSam'));
  await page
    .getByRole('checkbox', {
      name: 'Завершить: Проверить сборку YaSam',
      exact: true,
    })
    .click();
  await page.locator('#sidebar a[href="#done"]').click();
  await page
    .getByRole('checkbox', {
      name: 'Вернуть в план: Проверить сборку YaSam',
      exact: true,
    })
    .click();

  await page.locator('#sidebar a[href="#map"]').click();
  await visible(page.locator('.map-node').first());
  await page.locator('#status.visible').waitFor({ state: 'hidden' });
  await screenshot(page, 'map');
  await page
    .getByRole('button', { name: 'Создать карту', exact: true })
    .click();
  await popup.getByLabel('Название карты').fill('Проверка карты');
  await popup.getByRole('checkbox', { name: /Проверить сборку YaSam/ }).check();
  await popup
    .getByRole('checkbox', { name: /Показать макет коллегам/ })
    .check();
  await popup
    .getByRole('button', { name: 'Создать карту', exact: true })
    .click();
  await visible(
    page
      .locator('.map-caption strong')
      .getByText('Проверка карты', { exact: true })
  );
  assert.equal(await page.locator('.map-node').count(), 2);
  await page.getByRole('button', { name: 'Связать', exact: true }).click();
  await page
    .locator('.map-node')
    .filter({ hasText: 'Проверить сборку YaSam' })
    .click();
  await page
    .locator('.map-node')
    .filter({ hasText: 'Показать макет коллегам' })
    .click();
  await page.locator('.edge-layer path').waitFor({ state: 'attached' });
  assert.ok(
    await page
      .locator('.edge-layer path')
      .evaluate(
        (path) =>
          path.getTotalLength() > 0 && getComputedStyle(path).stroke !== 'none'
      )
  );
  const node = page
    .locator('.map-node')
    .filter({ hasText: 'Проверить сборку YaSam' });
  const draggedNode = await node.elementHandle();
  const startTop = await node.evaluate((el) => parseFloat(el.style.top));
  const before = await node.boundingBox();
  await page.mouse.move(before.x + 40, before.y + 30);
  await page.mouse.down();
  await page.mouse.move(before.x + 72, before.y + 68, { steps: 5 });
  await page.mouse.up();
  await page.waitForFunction((el) => !el.isConnected, draggedNode, {
    timeout: 5000,
  });
  await page.reload();
  const savedTop = await node.evaluate((el) => parseFloat(el.style.top));
  assert.ok(
    savedTop > startTop + 15,
    'Смещение узла должно пережить перезагрузку: ' + startTop + ' → ' + savedTop
  );
  await node.click();
  await drawer.getByLabel('Название задачи').fill('Карта проверена');
  await finishEdit();
  await visible(
    page.locator('.map-node').filter({ hasText: 'Карта проверена' })
  );
  await page.getByRole('button', { name: 'Состав карты' }).click();
  await popup
    .getByRole('checkbox', { name: /Показать макет коллегам/ })
    .uncheck();
  await popup.getByRole('button', { name: 'Сохранить состав' }).click();
  await page
    .locator('.map-node')
    .filter({ hasText: 'Показать макет коллегам' })
    .waitFor({ state: 'detached' });

  await page.locator('#topbar [data-act=search]').click();
  await popup.getByRole('searchbox').fill('Результат проверки');
  await popup.locator('.result').filter({ hasText: 'Карта проверена' }).click();
  assert.equal(await drawer.locator('.related-row').count(), 2);
  await drawer.getByRole('button', { name: 'Удалить', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Удалить задачу?' })
    .getByRole('button', { name: 'Удалить', exact: true })
    .click();
  await drawer.waitFor({ state: 'hidden' });
  assert.equal(await page.locator('.map-node').count(), 0);

  // An older draft in another tab must not silently overwrite a newer save.
  const second = await context.newPage();
  await second.goto(baseURL);
  await second.locator('.task-open[data-id=refs]').click();
  await page.locator('#sidebar nav a[href="#plan"]').click();
  await page.locator('.task-open[data-id=refs]').click();
  await drawer.getByLabel('Название задачи').fill('Обновлённая подборка');
  await finishEdit();
  await second.locator('#editor [name=note]').fill('Устаревшая заметка');
  await second.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await visible(second.getByRole('alert').filter({ hasText: 'изменилась' }));
  await second.close();

  await page
    .getByRole('button', {
      name: 'Переименовать: Обновлённая подборка',
      exact: true,
    })
    .click();
  const inline = page.getByRole('dialog', {
    name: 'Название задачи',
    exact: true,
  });
  await inline.getByRole('textbox').fill('Отобрать примеры');
  await inline.getByRole('textbox').press('Enter');
  await visible(row('Отобрать примеры'));

  await page.locator('#sidebar a[href="#projects"]').click();
  await visible(page.getByRole('heading', { level: 1, name: 'Проекты' }));
  await page
    .getByRole('button', { name: 'Создать проект', exact: true })
    .click();
  await popup.getByLabel('Название проекта').fill('Выставка');
  await popup.getByLabel('Результат').fill('Открыть экспозицию');
  await popup
    .getByRole('button', { name: 'Создать проект', exact: true })
    .click();
  await visible(page.getByRole('heading', { level: 1, name: 'Выставка' }));
  await page.locator('.new-task').click();
  assert.equal(
    await drawer.locator('#project-value').textContent(),
    'Выставка'
  );
  await drawer.getByLabel('Название задачи').fill('Подготовить зал');
  await drawer.getByRole('button', { name: 'Открыть календарь' }).click();
  await page
    .locator('.calendar-pop')
    .getByRole('button', { name: 'Сегодня', exact: true })
    .click();
  await drawer.getByRole('button', { name: 'Выбрать время' }).click();
  await page.getByRole('option', { name: '10:30', exact: true }).click();
  await finishEdit('Создать задачу');
  await row('Подготовить зал').click();
  const toggle = drawer.getByRole('button', {
    name: 'Завершить задачу',
    exact: true,
  });
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-pressed'), 'true');
  assert.equal(await toggle.locator('svg').count(), 1);
  await finishEdit();
  assert.equal(
    await page
      .getByRole('progressbar', { name: 'Выставка' })
      .getAttribute('aria-valuenow'),
    '100'
  );
  await page.getByRole('button', { name: 'Добавить из плана' }).click();
  await page.getByRole('option', { name: /Отобрать примеры/ }).click();
  await visible(row('Отобрать примеры'));
  assert.equal(
    await page
      .getByRole('progressbar', { name: 'Выставка' })
      .getAttribute('aria-valuenow'),
    '50'
  );
  await row('Отобрать примеры').click();
  await drawer.locator('[data-act=project]').click();
  await page.getByRole('option', { name: 'Без проекта', exact: true }).click();
  await drawer.getByRole('button', { name: 'Закрыть задачу' }).click();
  await page
    .getByRole('dialog', { name: 'Закрыть задачу?' })
    .getByRole('button', { name: 'Продолжить редактирование' })
    .click();
  await finishEdit();
  await row('Отобрать примеры').waitFor({ state: 'hidden' });
  await page.reload();
  assert.equal(
    await page
      .getByRole('progressbar', { name: 'Выставка' })
      .getAttribute('aria-valuenow'),
    '100'
  );
  await page.getByRole('button', { name: 'Сортировка задач' }).click();
  await page.getByRole('option', { name: 'По названию' }).click();
  assert.match(await page.locator('.sort').innerText(), /По названию/);
  assert.equal(await page.locator('select').count(), 0);
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    locale: 'ru-RU',
  });
  mobile.on('weberror', (event) => errors.push(event.error().message));
  const phone = await mobile.newPage();
  await phone.goto(baseURL);
  await visible(phone.getByRole('heading', { name: 'Мой план', level: 1 }));
  await phone.evaluate(() => document.fonts.ready);
  await phone
    .locator('.horizon img')
    .evaluateAll((imgs) => Promise.all(imgs.map((img) => img.decode())));
  assert.deepEqual(
    (await phone.locator('.task-group h2').allInnerTexts()).map((s) =>
      s.trim()
    ),
    ['Сегодня', 'На этой неделе', 'Потом']
  );
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  );
  await screenshot(phone, 'mobile');
  const todayToggle = phone
    .getByRole('heading', { name: 'Сегодня', level: 2 })
    .getByRole('button');
  await todayToggle.click();
  assert.equal(await phone.locator('#tasks-today').isVisible(), false);
  await todayToggle.click();
  await visible(phone.locator('#tasks-today .task-name').first());
  await phone
    .getByRole('button', { name: 'Новая задача', exact: true })
    .first()
    .click();
  await phone.getByLabel('Название задачи').fill('Задача с телефона');
  await phone
    .getByRole('button', { name: 'Создать задачу', exact: true })
    .click();
  await visible(
    phone.getByRole('button', { name: 'Открыть детали: Задача с телефона' })
  );
  await phone.locator('#mobile-nav a[href="#map"]').click();
  await visible(phone.locator('.board-scroll'));
  assert.equal(
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth
    ),
    true
  );
  await phone.getByRole('button', { name: 'Вместить карту' }).click();
  for (const width of [320, 390, 480, 720, 768, 1024]) {
    await phone.setViewportSize({ width, height: 820 });
    await phone.goto(baseURL);
    await visible(phone.getByRole('heading', { name: 'Мой план', level: 1 }));
    assert.equal(
      await phone.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth
      ),
      true,
      'Ширина ' + width
    );
    const tiles = await phone.locator('.horizon').evaluateAll((cards) =>
      cards.map((card) => {
        const bounds = card.getBoundingClientRect();
        const art = card.querySelector('img').getBoundingClientRect();
        return {
          text: card.innerText.replace(/\s+/g, ' ').trim(),
          contained:
            art.width > 0 &&
            art.height > 0 &&
            art.left >= bounds.left &&
            art.right <= bounds.right &&
            art.top >= bounds.top &&
            art.bottom <= bounds.bottom,
        };
      })
    );
    for (const tile of tiles) {
      assert.match(tile.text, /^(Сегодня|На этой неделе|Потом) \d+$/);
      assert.ok(
        tile.contained,
        'Иллюстрация внутри миниатюры при ширине ' + width
      );
    }
    if (width <= 720) {
      const firstTimed = phone.locator('.task-entry:has(.due)').first();
      assert.ok(
        await firstTimed.evaluate((row) => {
          const name = row.querySelector('.task-name').getBoundingClientRect();
          const time = row.querySelector('.due').getBoundingClientRect();
          return time.top >= name.bottom - 1;
        }),
        'Срок располагается под названием'
      );
    }
  }
  await phone.setViewportSize({ width: 320, height: 700 });
  await phone.emulateMedia({ reducedMotion: 'reduce' });
  await phone.locator('.task-open[data-id=refs]').click();
  const phoneEditor = phone.locator('#editor');
  assert.equal(
    await phoneEditor.evaluate((el) => getComputedStyle(el).animationName),
    'none'
  );
  await phoneEditor.locator('[data-act=project]').click();
  const choicesOnPhone = phone.getByRole('listbox');
  await visible(choicesOnPhone);
  const box = await choicesOnPhone.boundingBox();
  assert.ok(
    box.x >= 0 &&
      box.x + box.width <= 320 &&
      box.y >= 0 &&
      box.y + box.height <= 700
  );
  await phone.getByRole('option', { name: 'Прототип сайта' }).click();
  await phoneEditor
    .getByRole('button', { name: 'Сохранить', exact: true })
    .click();
  await mobile.close();
  if (!baseURL.startsWith('file:')) {
    // Upgrade a real v1 database on the same origin, including the separate blob store.
    const legacy = await browser.newContext();
    const tab = await legacy.newPage();
    const fixture = new URL('./__yasam_v1_fixture__', baseURL).href;
    await tab.route(fixture, (route) =>
      route.fulfill({
        contentType: 'text/html',
        body: '<!doctype html><title>v1</title>',
      })
    );
    await tab.goto(fixture);
    await tab.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('yasam-planner', 1);
          req.onupgradeneeded = () => {
            const plan = req.result.createObjectStore('plan'),
              files = req.result.createObjectStore('files');
            files.put(new Blob(['v1'], { type: 'text/plain' }), 'old-file');
            plan.put(
              {
                revision: 7,
                tasks: [
                  {
                    id: 'custom',
                    title: 'Прежняя задача',
                    note: 'До обновления',
                    rev: 2,
                    done: false,
                    date: '',
                    time: '',
                    period: 'later',
                    subs: [],
                    files: [
                      {
                        id: 'old-file',
                        name: 'Старый.txt',
                        type: 'text/plain',
                        size: 2,
                      },
                    ],
                  },
                ],
                edges: [],
                maps: [],
              },
              'workspace'
            );
          };
          req.onsuccess = () => {
            req.result.close();
            resolve();
          };
          req.onerror = () => reject(req.error);
        })
    );
    await tab.goto(baseURL);
    await tab
      .getByRole('button', { name: 'Открыть детали: Прежняя задача' })
      .click();
    assert.equal(
      await tab.locator('#project-value').textContent(),
      'Без проекта'
    );
    assert.equal(
      await tab.getByLabel('Заметка', { exact: true }).inputValue(),
      'До обновления'
    );
    const incoming = tab.waitForEvent('download');
    await tab.locator('.file-download').click();
    assert.equal(await readFile(await (await incoming).path(), 'utf8'), 'v1');
    await tab.getByRole('button', { name: 'Закрыть задачу' }).click();
    await tab
      .getByRole('button', {
        name: 'Добавить задачу в раздел «На этой неделе»',
      })
      .click();
    const editor = tab.locator('#editor');
    assert.equal(
      await editor
        .getByRole('button', { name: 'На этой неделе', exact: true })
        .getAttribute('aria-pressed'),
      'true'
    );
    await editor.getByLabel('Название задачи').fill('Дело на эту неделю');
    await editor
      .getByRole('button', { name: 'Создать задачу', exact: true })
      .click();
    await visible(
      tab
        .locator('#tasks-week')
        .getByRole('button', { name: 'Переименовать: Дело на эту неделю' })
    );
    await legacy.close();
  }
  assert.deepEqual(errors, []);
  console.log(
    'Пройдены сценарии задач, проектов, меню, вложений, карты, двух вкладок и мобильного экрана.'
  );
} catch (error) {
  console.error(
    'Страница при сбое:',
    await page.locator('dialog[open]').allTextContents(),
    errors
  );
  throw error;
} finally {
  await browser.close();
}
