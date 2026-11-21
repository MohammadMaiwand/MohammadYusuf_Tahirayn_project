import Dexie, { type EntityTable } from 'dexie';
// Metadata only. Sensitive records and mutation queues are deliberately absent.
export const localDatabase = new Dexie('myt-foundation') as Dexie & {
  metadata: EntityTable<{ key: string; value: string }, 'key'>;
};
localDatabase.version(1).stores({ metadata: '&key' });
