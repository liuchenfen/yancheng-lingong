const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const wxmlFiles = [
  'miniprogram/pages/profile/profile.wxml',
  '雁城零工小程序_v2/pages/profile/profile.wxml',
  '雁城零工_修复版/pages/profile/profile.wxml',
  'write_all.py'
];
const wxssFiles = [
  'miniprogram/pages/profile/profile.wxss',
  '雁城零工小程序_v2/pages/profile/profile.wxss',
  '雁城零工_修复版/pages/profile/profile.wxss',
  'write_all.py'
];

for (const file of wxmlFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(content.includes('workbench-header'), `${file} should use the workbench header layout`);
  assert.ok(content.includes('login-card'), `${file} should use a focused login card`);
  assert.ok(content.includes('login-actions'), `${file} should group login actions`);
  assert.ok(content.includes('stats-strip'), `${file} should use a compact stats strip`);
  assert.ok(content.includes('menu-group'), `${file} should group profile menu rows`);
}

for (const file of wxssFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(content.includes('#4A90E2'), `${file} should use the light blue workbench primary color`);
  assert.ok(content.includes('workbench-header'), `${file} should style the workbench header`);
  assert.ok(content.includes('stats-strip'), `${file} should style the stats strip`);
}

console.log('profile workbench ui tests ok');
