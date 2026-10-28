const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const files = [
  'miniprogram/pages/profile/profile.js',
  '雁城零工小程序_v2/pages/profile/profile.js',
  '雁城零工_修复版/pages/profile/profile.js',
  'write_all.py'
];

for (const file of files) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(!content.includes('完善简历'), `${file} should not include 完善简历`);
}

console.log('profile menu tests ok');
