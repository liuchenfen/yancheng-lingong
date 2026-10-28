const assert = require('assert');

const {
  formatConvenienceItem,
  formatConvenienceList,
  getConvenienceById,
  setConvenienceCache
} = require('../utils/convenience');

function mockStorage() {
  const store = {};
  global.wx = {
    getStorageSync(key) {
      return store[key];
    },
    setStorageSync(key, value) {
      store[key] = value;
    }
  };
  return store;
}

function testFormatConvenienceItemAddsDisplayFields() {
  const item = formatConvenienceItem({
    id: 9,
    area: '全部',
    content: '正宗东北饺子馄饨，皮包馅大，每天新鲜现包现卖。',
    images: ['https://example.com/a.jpg'],
    views: undefined,
    createdAt: '3天前发布'
  });

  assert.strictEqual(item.displayTitle, '正宗东北饺子馄饨，皮包馅大，每天新鲜现');
  assert.strictEqual(item.coverImage, 'https://example.com/a.jpg');
  assert.strictEqual(item.displayViews, 0);
}

function testFormatConvenienceListKeepsIdsStable() {
  const list = formatConvenienceList([
    { id: 1, content: 'A', images: [] },
    { id: 2, content: 'B', images: ['x'] }
  ]);

  assert.deepStrictEqual(list.map((item) => item.id), [1, 2]);
  assert.strictEqual(list[1].coverImage, 'x');
}

function testFormatConvenienceListReturnsEmptyArrayForNonArrayInput() {
  assert.deepStrictEqual(formatConvenienceList(null), []);
  assert.deepStrictEqual(formatConvenienceList({ id: 1 }), []);
}

function testSetConvenienceCacheStoresFormattedItems() {
  const store = mockStorage();

  setConvenienceCache([
    {
      id: 55,
      content: '社区蔬菜团购，新鲜到家',
      images: ['https://example.com/veg.jpg'],
      views: '7'
    }
  ]);

  const cached = store.convenienceListCache;
  assert.ok(Array.isArray(cached));
  assert.strictEqual(cached[0].displayTitle, '社区蔬菜团购，新鲜到家');
  assert.strictEqual(cached[0].coverImage, 'https://example.com/veg.jpg');
  assert.strictEqual(cached[0].displayViews, 7);
}

function testCacheLookupFindsConvenienceItemById() {
  mockStorage();
  setConvenienceCache(formatConvenienceList([
    { id: 101, content: '饺子现包现卖', images: [], views: 12 }
  ]));

  const item = getConvenienceById(101);

  assert.ok(item);
  assert.strictEqual(item.id, 101);
  assert.strictEqual(item.displayViews, 12);
}

function testCacheLookupFormatsRawCachedItems() {
  mockStorage();
  setConvenienceCache([
    {
      id: 101,
      content: '便民缝补改衣，老手艺上门',
      images: ['https://example.com/sew.jpg'],
      views: '3'
    }
  ]);

  const item = getConvenienceById('101');

  assert.ok(item);
  assert.strictEqual(item.displayTitle, '便民缝补改衣，老手艺上门');
  assert.strictEqual(item.coverImage, 'https://example.com/sew.jpg');
  assert.strictEqual(item.displayViews, 3);
}

testFormatConvenienceItemAddsDisplayFields();
testFormatConvenienceListKeepsIdsStable();
testFormatConvenienceListReturnsEmptyArrayForNonArrayInput();
testSetConvenienceCacheStoresFormattedItems();
testCacheLookupFindsConvenienceItemById();
testCacheLookupFormatsRawCachedItems();

console.log('convenience tests ok');
