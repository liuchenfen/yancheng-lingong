const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(
  path.join(__dirname, '..', '雁城零工_管理员平台', 'server', 'server.js'),
  'utf8'
);

function assertIncludes(expected) {
  assert.ok(source.includes(expected), `server.js should include ${expected}`);
}

function getSection(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.ok(start >= 0, `server.js should include ${startMarker}`);
  const end = source.indexOf(endMarker, start);
  assert.ok(end >= 0, `server.js should include ${endMarker} after ${startMarker}`);
  return source.slice(start, end);
}

function testConvenienceSchemaAddsModerationFields() {
  assertIncludes('report_count');
  assertIncludes('last_reported_at');
  assertIncludes('offline_reason');
  assertIncludes('offline_by');
  assertIncludes('reporter_key');
  assertIncludes('CREATE TABLE IF NOT EXISTS convenience_reports');
  assertIncludes('UNIQUE KEY uk_post_reporter (post_id, reporter_key)');
}

function testBackendAddsReportAndAdminRoutes() {
  assertIncludes('app.post("/api/wechat/convenience/:id/report"');
  assertIncludes('app.get("/api/admin/convenience"');
  assertIncludes('app.patch("/api/admin/convenience/:id/status"');
}

function testConvenienceMapperExposesModerationFields() {
  assertIncludes('reportCount: Number(row.report_count || 0)');
  assertIncludes('lastReportedAt: formatDate(row.last_reported_at)');
  assertIncludes('offlineReason: row.offline_reason || ""');
}

function testPublicReportRouteRequiresPublishedIdentityAndTransaction() {
  const reportRoute = getSection(
    'app.post("/api/wechat/convenience/:id/report"',
    'app.use("/api/admin", requireAdmin);'
  );

  assert.ok(
    !reportRoute.includes('includeUnpublished: true'),
    'report route should not include unpublished access'
  );
  assert.ok(
    reportRoute.includes('const post = await getConveniencePostRow(id);') ||
      reportRoute.includes('const post = await getConveniencePost(id);'),
    'report route should load only published convenience posts'
  );
  assert.ok(
    source.includes('async function getTrustedConvenienceReporter') &&
      source.includes('FROM wx_users') &&
      reportRoute.includes('getTrustedConvenienceReporter'),
    'report route should verify reporter identity against wx_users'
  );
  assert.ok(
    reportRoute.includes('await conn.beginTransaction()') &&
      reportRoute.includes('await conn.commit()') &&
      reportRoute.includes('await conn.rollback()'),
    'report route should wrap insert and counter updates in a transaction'
  );
}

function testAdminStatusRouteUsesRequestReasonAndAdminContext() {
  const adminRoute = getSection(
    'app.patch("/api/admin/convenience/:id/status"',
    'app.get("/api/admin/jobs"'
  );

  assert.ok(
    adminRoute.includes('offlineReason'),
    'admin status route should read offlineReason from request body'
  );
  assert.ok(
    adminRoute.includes('req.admin'),
    'admin status route should derive moderator identity from req.admin'
  );
  assert.ok(
    !adminRoute.includes("offline_by = 1"),
    'admin status route should not hard-code offline_by = 1'
  );
}

testConvenienceSchemaAddsModerationFields();
testBackendAddsReportAndAdminRoutes();
testConvenienceMapperExposesModerationFields();
testPublicReportRouteRequiresPublishedIdentityAndTransaction();
testAdminStatusRouteUsesRequestReasonAndAdminContext();

console.log('convenience moderation backend tests ok');
