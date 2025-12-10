import { get, set, del } from 'idb-keyval';
import { HistoryItem } from '../types';

const STORE_KEY = 'medical_guide_history_v2';

export const storageService = {
  async saveItem(item: HistoryItem): Promise<HistoryItem[]> {
    const current = await this.getAll();
    const index = current.findIndex(i => i.id === item.id);
    let updated;
    if (index >= 0) {
      updated = [...current];
      updated[index] = item;
    } else {
      updated = [item, ...current];
    }
    // Limit to 50 items to keep performance reasonable, though IDB can handle more
    if (updated.length > 50) updated = updated.slice(0, 50);
    
    await set(STORE_KEY, updated);
    return updated;
  },

  async getAll(): Promise<HistoryItem[]> {
    return (await get<HistoryItem[]>(STORE_KEY)) || [];
  },

  async deleteItem(id: string): Promise<HistoryItem[]> {
    const current = await this.getAll();
    const updated = current.filter(i => i.id !== id);
    await set(STORE_KEY, updated);
    return updated;
  },

  async clear(): Promise<void> {
    await del(STORE_KEY);
  },

  // Migrate old localStorage data to IndexedDB
  async migrateFromLocalStorage(): Promise<void> {
    const old = localStorage.getItem('medical_guide_history');
    if (old) {
      try {
        const parsed = JSON.parse(old);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const current = await this.getAll();
          // Only migrate if DB is empty to avoid overwriting new data with old data repeatedly
          if (current.length === 0) {
             await set(STORE_KEY, parsed);
             console.log("Successfully migrated history to IndexedDB");
             // Optional: Clear old storage after successful migration
             // localStorage.removeItem('medical_guide_history'); 
          }
        }
      } catch (e) {
        console.error("Migration failed", e);
      }
    }
  }
};