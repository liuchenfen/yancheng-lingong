const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');

const pageCopies = [
  'miniprogram/pages/index',
  '雁城零工小程序_v2/pages/index',
  '雁城零工_修复版/pages/index'
];

for (const pagePath of pageCopies) {
  const wxml = fs.readFileSync(path.join(root, pagePath, 'index.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(root, pagePath, 'index.wxss'), 'utf8');

  assert.ok(wxml.includes('wx:for-index="categoryIndex"'), `${pagePath} should render icons by category index`);
  assert.ok(wxml.includes('category-graphic icon-cargo'), `${pagePath} should render cargo graphic icon`);
  assert.ok(wxml.includes('category-graphic icon-homecare'), `${pagePath} should render homecare graphic icon`);
  assert.ok(wxml.includes('category-graphic icon-more'), `${pagePath} should render more graphic icon`);
  assert.ok(wxml.includes('category-halo'), `${pagePath} should render the animated icon halo`);
  assert.ok(!wxml.includes('category-icon">{{item.icon}}</text>'), `${pagePath} should not render large text category placeholders`);

  assert.ok(wxss.includes('@keyframes categoryFloat'), `${pagePath} should animate category icons`);
  assert.ok(wxss.includes('@keyframes iconSteam'), `${pagePath} should include steam animation`);
  assert.ok(wxss.includes('@keyframes iconSweep'), `${pagePath} should include sweep animation`);
  assert.ok(wxss.includes('@keyframes iconHeartbeat'), `${pagePath} should include heartbeat animation`);
  assert.ok(wxss.includes('.icon-cargo'), `${pagePath} should include cargo icon drawing styles`);
  assert.ok(wxss.includes('.icon-homecare'), `${pagePath} should include homecare icon drawing styles`);
}

const miniprogramIndex = fs.readFileSync(path.join(root, 'miniprogram/pages/index/index.js'), 'utf8');
const v2Index = fs.readFileSync(path.join(root, '雁城零工小程序_v2/pages/index/index.js'), 'utf8');
const constants = fs.readFileSync(path.join(root, '雁城零工_修复版/utils/constants.js'), 'utf8');

for (const content of [miniprogramIndex, v2Index]) {
  assert.ok(content.includes("iconType: 'cargo'"), 'category data should include cargo icon type');
  assert.ok(content.includes("iconClass: 'icon-cargo'"), 'category data should include cargo icon class');
  assert.ok(content.includes("iconType: 'more'"), 'category data should include more icon type');
  assert.ok(content.includes("tone: 'sky'"), 'category data should include tone classes');
  assert.ok(content.includes("toneClass: 'tone-sky'"), 'category data should include full tone class');
}
assert.ok(constants.includes("'cargo'"), 'shared constants should include cargo icon type');
assert.ok(constants.includes('iconClass:'), 'shared constants should include full icon classes');
assert.ok(constants.includes("iconType: 'more'"), 'shared constants should include more icon type');
assert.ok(constants.includes("'sky'"), 'shared constants should include tone classes');
assert.ok(constants.includes('toneClass:'), 'shared constants should include full tone classes');

console.log('home category icon tests ok');
