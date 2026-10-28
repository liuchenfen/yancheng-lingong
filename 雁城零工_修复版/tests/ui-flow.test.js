const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function assertIncludes(file, expected) {
  assert.ok(
    read(file).includes(expected),
    `${file} should include ${expected}`
  );
}

function testJobsPageHasFlowFeedback() {
  assertIncludes('pages/jobs/jobs.wxml', 'loading-card');
  assertIncludes('pages/jobs/jobs.wxml', 'result-summary');
  assertIncludes('pages/jobs/jobs.wxml', 'bindtap="resetFilters"');
  assertIncludes('pages/jobs/jobs.js', 'connectionTip');
  assertIncludes('pages/jobs/jobs.js', 'hasActiveFilter');
  assertIncludes('pages/jobs/jobs.js', 'resetFilters()');
}

function testPublishPageHasInlineValidation() {
  assertIncludes('pages/publish/publish.wxml', 'form-error');
  assertIncludes('pages/publish/publish.wxml', 'errors.area');
  assertIncludes('pages/publish/publish.wxml', 'errors.content');
  assertIncludes('pages/publish/publish.wxml', 'errors.contactName');
  assertIncludes('pages/publish/publish.wxml', 'errors.contactPhone');
  assertIncludes('pages/publish/publish.wxml', 'errors.address');
  assertIncludes('pages/publish/publish.wxml', 'data-field="address"');
  assertIncludes('pages/publish/publish.wxml', 'submit-disabled');
  assertIncludes('pages/publish/publish.js', 'errors: {}');
  assertIncludes('pages/publish/publish.js', 'validateForm(form)');
  assertIncludes('pages/publish/publish.js', 'chooseLocation()');
}

function testJobDetailApplyModalHasSubmitState() {
  assertIncludes('pages/jobDetail/jobDetail.wxml', 'applySubmitting');
  assertIncludes('pages/jobDetail/jobDetail.wxml', 'applyErrors.name');
  assertIncludes('pages/jobDetail/jobDetail.wxml', "applySubmitting ? 'disabled'");
  assertIncludes('pages/jobDetail/jobDetail.js', 'applySubmitting: false');
  assertIncludes('pages/jobDetail/jobDetail.js', 'validateApplyForm');
}

testJobsPageHasFlowFeedback();
testPublishPageHasInlineValidation();
testJobDetailApplyModalHasSubmitState();

console.log('ui flow tests ok');
