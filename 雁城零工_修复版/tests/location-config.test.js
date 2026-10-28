const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function testAppJsonDeclaresLocationRequirements() {
  const appConfig = JSON.parse(read('app.json'));

  assert.ok(appConfig.permission, 'app.json should declare permission');
  assert.ok(
    appConfig.permission['scope.userLocation'],
    'app.json should provide scope.userLocation usage description'
  );
  assert.ok(
    Array.isArray(appConfig.requiredPrivateInfos),
    'app.json should declare requiredPrivateInfos'
  );
  assert.ok(
    appConfig.requiredPrivateInfos.includes('chooseLocation'),
    'app.json should declare chooseLocation in requiredPrivateInfos'
  );
}

function testPublishPageHandlesLocationPermission() {
  const publishJs = read('pages/publish/publish.js');
  const publishWxml = read('pages/publish/publish.wxml');

  assert.ok(
    publishJs.includes('scope.userLocation'),
    'publish.js should check scope.userLocation permission'
  );
  assert.ok(
    publishJs.includes('wx.getSetting'),
    'publish.js should inspect location permission before choosing a location'
  );
  assert.ok(
    publishJs.includes('wx.openSetting'),
    'publish.js should guide the user to re-enable location permission'
  );
  assert.ok(
    publishWxml.includes('data-field="address"'),
    'publish.wxml should keep a manual address input as a fallback'
  );
  assert.ok(
    publishWxml.includes('bindtap="chooseLocation"'),
    'publish.wxml should still offer chooseLocation entry'
  );
}

testAppJsonDeclaresLocationRequirements();
testPublishPageHandlesLocationPermission();

console.log('location config tests ok');
