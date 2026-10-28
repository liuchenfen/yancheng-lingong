const CONVENIENCE_CACHE_KEY = 'convenienceListCache';

function hasWxStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync;
}

function trimText(value) {
  return String(value || '').trim();
}

function buildDisplayTitle(content) {
  return trimText(content).slice(0, 19);
}

function formatConvenienceItem(item) {
  const current = Object.assign({}, item || {});
  const images = Array.isArray(current.images) ? current.images : [];
  const views = Number(current.views);

  current.images = images;
  current.displayTitle = buildDisplayTitle(current.content);
  current.coverImage = images[0] || '';
  current.displayViews = Number.isFinite(views) ? views : 0;

  return current;
}

function formatConvenienceList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(formatConvenienceItem);
}

function setConvenienceCache(list) {
  if (hasWxStorage()) {
    wx.setStorageSync(CONVENIENCE_CACHE_KEY, formatConvenienceList(list));
  }
}

function getConvenienceCache() {
  if (!hasWxStorage()) return [];
  const list = wx.getStorageSync(CONVENIENCE_CACHE_KEY);
  return Array.isArray(list) ? list : [];
}

function getConvenienceById(id) {
  const targetId = Number(id);
  return getConvenienceCache().find((item) => Number(item.id) === targetId) || null;
}

module.exports = {
  CONVENIENCE_CACHE_KEY,
  formatConvenienceItem,
  formatConvenienceList,
  getConvenienceById,
  getConvenienceCache,
  setConvenienceCache
};
