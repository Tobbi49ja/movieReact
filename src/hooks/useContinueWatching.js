const STORAGE_KEY = 'tobbihub_continue_watching';
const MAX_ITEMS = 20;

export function useContinueWatching() {
  const getAll = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch { return []; }
  };

  const saveProgress = (item) => {
    // item: { id, title, poster, mediaType, season, episode, progress, timestamp }
    const list = getAll().filter(i => !(i.id === item.id && i.mediaType === item.mediaType));
    list.unshift({ ...item, timestamp: Date.now() });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ITEMS)));
  };

  const removeItem = (id, mediaType) => {
    const list = getAll().filter(i => !(i.id === id && i.mediaType === mediaType));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const getProgress = (id, mediaType) => {
    return getAll().find(i => i.id === id && i.mediaType === mediaType) || null;
  };

  return { getAll, saveProgress, removeItem, getProgress };
}
