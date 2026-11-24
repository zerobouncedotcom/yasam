import { seed, upgradePlan, sampleFile, sampleContent } from './model.js?v=2';

let connection;
const changeChannel =
  'BroadcastChannel' in window
    ? new BroadcastChannel('yasam-updates-v1')
    : null;
export function onRemoteChange(cb) {
  changeChannel?.addEventListener('message', cb);
}

function open() {
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open('yasam-planner', 2);
      request.onupgradeneeded = (event) => {
        if (event.oldVersion === 1) {
          const plans = request.transaction.objectStore('plan');
          const read = plans.get('workspace');
          read.onsuccess = () =>
            plans.put(upgradePlan(read.result), 'workspace');
          return;
        }
        const plans = request.result.createObjectStore('plan');
        const files = request.result.createObjectStore('files');
        plans.put(seed(), 'workspace');
        files.put(
          new Blob([sampleContent], { type: sampleFile.type }),
          sampleFile.id
        );
      };
      request.onsuccess = () => {
        request.result.onversionchange = () => {
          request.result.close();
          connection = undefined;
        };
        resolve(request.result);
      };
      request.onerror = () => {
        connection = undefined;
        reject(request.error);
      };
      request.onblocked = () =>
        reject(new Error('Закройте другие вкладки YaSam и обновите страницу.'));
    });
  }
  return connection;
}

async function read(store, id) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = db.transaction(store).objectStore(store).get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
export const readPlan = () => read('plan', 'workspace');
export const readFile = (id) => read('files', id);

// IndexedDB serializes writers across tabs. File changes and the new plan commit together.
export async function writePlan(change) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['plan', 'files'], 'readwrite');
    const plan = tx.objectStore('plan');
    const request = plan.get('workspace');
    let state, reason;
    request.onsuccess = () => {
      try {
        state = request.result;
        change(state, tx.objectStore('files'));
        state.revision++;
        plan.put(state, 'workspace');
      } catch (error) {
        reason = error;
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      changeChannel?.postMessage(state.revision);
      resolve(state);
    };
    tx.onabort = () =>
      reject(
        reason ?? tx.error ?? new Error('Не удалось сохранить изменения.')
      );
  });
}
