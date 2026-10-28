const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'miniprogram/pages/jobDetail/jobDetail.wxml',
  '雁城零工小程序_v2/pages/jobDetail/jobDetail.wxml',
  '雁城零工_修复版/pages/jobDetail/jobDetail.wxml',
  'write_all.py'
];
const scriptFiles = [
  'miniprogram/pages/jobDetail/jobDetail.js',
  '雁城零工小程序_v2/pages/jobDetail/jobDetail.js',
  '雁城零工_修复版/pages/jobDetail/jobDetail.js',
  'write_all.py'
];

function collectSnippet(content) {
  const start = content.indexOf('collect-btn');
  assert.notStrictEqual(start, -1, 'collect button should exist');
  return content.slice(start, start + 180);
}

for (const file of files) {
  const snippet = collectSnippet(fs.readFileSync(path.join(root, file), 'utf8'));
  assert.ok(snippet.includes('⭐️'), `${file} should use a star icon for favorite`);
  assert.ok(snippet.includes('☆'), `${file} should use a hollow star before favorite`);
  assert.ok(snippet.includes("isCollected ? '⭐️' : '☆'"), `${file} should show solid star only after favorite`);
  assert.ok(!snippet.includes("'藏'"), `${file} should not use 藏 as favorite text`);
  assert.ok(!snippet.includes("'已'"), `${file} should not use 已 as favorite text`);
  assert.ok(!snippet.includes('❤️'), `${file} should not use heart icons for favorite`);
  assert.ok(!snippet.includes('🤍'), `${file} should not use heart icons for favorite`);
}

for (const file of scriptFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(content.includes('onCollect'), `${file} should keep tap-to-favorite behavior`);
  assert.ok(!content.includes('已收藏'), `${file} should not use 已收藏 toast text`);
  assert.ok(!content.includes('已取消收藏'), `${file} should not use 已取消收藏 toast text`);
}

console.log('favorite button tests ok');
