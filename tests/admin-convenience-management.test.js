const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(relativePath) {
  return fs.readFileSync(path.join(__dirname, '..', '雁城零工_管理员平台', relativePath), 'utf8');
}

function assertIncludes(file, expected) {
  assert.ok(read(file).includes(expected), `${file} should include ${expected}`);
}

function testIndexAddsConvenienceNavAndView() {
  assertIncludes('index.html', 'data-view="convenience"');
  assertIncludes('index.html', 'id="convenience"');
  assertIncludes('index.html', 'id="convenienceSearch"');
  assertIncludes('index.html', 'id="convenienceStatusFilter"');
  assertIncludes('index.html', 'id="convenienceTable"');
}

function testAppAddsConvenienceDataLoadingAndRendering() {
  assertIncludes('app.js', 'convenience: [');
  assertIncludes('app.js', 'conveniencePosts');
  assertIncludes('app.js', 'api("/api/admin/convenience")');
  assertIncludes('app.js', 'renderConvenience()');
  assertIncludes('app.js', 'function renderConvenience()');
  assertIncludes('app.js', 'function convenienceActions(item)');
  assertIncludes('app.js', 'updateConvenienceStatus');
  assertIncludes('app.js', 'convenience-offline');
  assertIncludes('app.js', 'convenience-restore');
  assertIncludes('app.js', 'convenienceSearch');
  assertIncludes('app.js', 'convenienceStatusFilter');
  assertIncludes('app.js', '/api/admin/convenience/${id}/status');
}

function testStylesAddConvenienceSummaryAndReportBadge() {
  assertIncludes('styles.css', '.summary-cell');
  assertIncludes('styles.css', '.report-badge');
}

testIndexAddsConvenienceNavAndView();
testAppAddsConvenienceDataLoadingAndRendering();
testStylesAddConvenienceSummaryAndReportBadge();

console.log('admin convenience management tests ok');
