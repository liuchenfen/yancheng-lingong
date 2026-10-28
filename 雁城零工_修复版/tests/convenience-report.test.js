const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertIncludes(file, expected) {
  assert.ok(read(file).includes(expected), `${file} should include ${expected}`);
}

function testApiExportsReportConvenience() {
  assertIncludes('utils/api.js', 'function reportConvenience(id, userInfo)');
  assertIncludes('utils/api.js', "url: '/api/wechat/convenience/' + id + '/report'");
  assertIncludes('utils/api.js', 'reportConvenience');
}

function testConvenienceDetailUsesRealReportRequest() {
  assertIncludes('pages/convenienceDetail/convenienceDetail.js', 'reportConvenience');
  assertIncludes('pages/convenienceDetail/convenienceDetail.js', 'reporting: false');
  assertIncludes('pages/convenienceDetail/convenienceDetail.js', 'app.globalData.userInfo || {}');
  assertIncludes('pages/convenienceDetail/convenienceDetail.js', "title: '举报提交失败'");
}

function testReportButtonReflectsSubmittingState() {
  assertIncludes('pages/convenienceDetail/convenienceDetail.wxml', "reporting ? '提交中...' : '点击举报'");
}

testApiExportsReportConvenience();
testConvenienceDetailUsesRealReportRequest();
testReportButtonReflectsSubmittingState();

console.log('convenience report tests ok');
