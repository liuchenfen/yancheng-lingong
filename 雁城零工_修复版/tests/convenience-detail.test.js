const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function testConvenienceDetailRouteIsRegistered() {
  const appConfig = readJson('app.json');

  assert.ok(
    Array.isArray(appConfig.pages),
    'app.json should define pages'
  );
  assert.ok(
    appConfig.pages.includes('pages/convenienceDetail/convenienceDetail'),
    'app.json should register pages/convenienceDetail/convenienceDetail'
  );
}

function testConvenienceDetailPageFilesExist() {
  const pageBase = path.join(ROOT, 'pages', 'convenienceDetail', 'convenienceDetail');
  const requiredExtensions = ['.js', '.json', '.wxml', '.wxss'];

  requiredExtensions.forEach((extension) => {
    assert.ok(
      fs.existsSync(`${pageBase}${extension}`),
      `pages/convenienceDetail/convenienceDetail${extension} should exist`
    );
  });
}

testConvenienceDetailRouteIsRegistered();
testConvenienceDetailPageFilesExist();

console.log('convenience detail tests ok');
