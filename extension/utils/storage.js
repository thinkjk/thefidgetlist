// IndexedDB wrapper for queue storage

const DB_NAME = 'FidgetListDB';
const DB_VERSION = 1;
const QUEUE_STORE = 'queue';

let db = null;

// Initialize database
async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Database failed to open:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      console.log('Database opened successfully');
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      db = event.target.result;
      console.log('Database upgrade needed');

      // Create queue object store if it doesn't exist
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        const objectStore = db.createObjectStore(QUEUE_STORE, {
          keyPath: 'id',
          autoIncrement: true
        });

        // Create indexes for searching
        objectStore.createIndex('group_name', 'group_name', { unique: false });
        objectStore.createIndex('fidget_name', 'fidget_name', { unique: false });
        objectStore.createIndex('timestamp', 'timestamp', { unique: false });

        console.log('Object store created');
      }
    };
  });
}

// Ensure DB is initialized before operations
async function ensureDB() {
  if (!db) {
    await initDB();
  }
  return db;
}

// Add item to queue
async function addToQueue(item) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(QUEUE_STORE);

    // Add timestamp if not present
    if (!item.timestamp) {
      item.timestamp = new Date().toISOString();
    }

    const request = objectStore.add(item);

    request.onsuccess = () => {
      console.log('Item added to queue:', request.result);
      resolve(request.result); // Returns the auto-generated ID
    };

    request.onerror = () => {
      console.error('Error adding item to queue:', request.error);
      reject(request.error);
    };
  });
}

// Get all queue items
async function getQueue() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readonly');
    const objectStore = transaction.objectStore(QUEUE_STORE);
    const request = objectStore.getAll();

    request.onsuccess = () => {
      console.log('Retrieved queue items:', request.result.length);
      resolve(request.result);
    };

    request.onerror = () => {
      console.error('Error getting queue:', request.error);
      reject(request.error);
    };
  });
}

// Get single queue item by ID
async function getQueueItem(id) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readonly');
    const objectStore = transaction.objectStore(QUEUE_STORE);
    const request = objectStore.get(id);

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Update queue item
async function updateQueueItem(id, item) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(QUEUE_STORE);

    // Ensure the ID is preserved
    item.id = id;

    const request = objectStore.put(item);

    request.onsuccess = () => {
      console.log('Item updated:', id);
      resolve(id);
    };

    request.onerror = () => {
      console.error('Error updating item:', request.error);
      reject(request.error);
    };
  });
}

// Delete queue item
async function deleteQueueItem(id) {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(QUEUE_STORE);
    const request = objectStore.delete(id);

    request.onsuccess = () => {
      console.log('Item deleted:', id);
      resolve(id);
    };

    request.onerror = () => {
      console.error('Error deleting item:', request.error);
      reject(request.error);
    };
  });
}

// Clear entire queue
async function clearQueue() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readwrite');
    const objectStore = transaction.objectStore(QUEUE_STORE);
    const request = objectStore.clear();

    request.onsuccess = () => {
      console.log('Queue cleared');
      resolve();
    };

    request.onerror = () => {
      console.error('Error clearing queue:', request.error);
      reject(request.error);
    };
  });
}

// Get queue count
async function getQueueCount() {
  const database = await ensureDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction([QUEUE_STORE], 'readonly');
    const objectStore = transaction.objectStore(QUEUE_STORE);
    const request = objectStore.count();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// Export functions for use in other scripts
// Note: This will be loaded via script tag, so functions are globally available
if (typeof window !== 'undefined') {
  window.FidgetStorage = {
    initDB,
    addToQueue,
    getQueue,
    getQueueItem,
    updateQueueItem,
    deleteQueueItem,
    clearQueue,
    getQueueCount
  };
}
