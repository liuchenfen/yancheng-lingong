const assert = require('assert');

const api = require('../utils/api');

async function testRequestUsesLocalBackendApiBase() {
  let capturedOptions = null;
  global.wx = {
    request(options) {
      capturedOptions = options;
      options.success({
        statusCode: 200,
        data: {
          code: 0,
          data: { ok: true }
        }
      });
    }
  };

  assert.ok(api.API_BASE, 'API_BASE should be configured');
  assert.ok(/^http:\/\/.+:\d+$/.test(api.API_BASE), 'API_BASE should be a valid http host');

  const result = await api.request({ url: '/api/jobs' });

  assert.deepStrictEqual(result, { ok: true });
  assert.strictEqual(capturedOptions.url, `${api.API_BASE}/api/jobs`);
  assert.strictEqual(capturedOptions.method, 'GET');
}

testRequestUsesLocalBackendApiBase()
  .then(() => {
    console.log('api config tests ok');
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
