const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const entries = fs.readdirSync(root);

function findDir(match) {
  const dir = entries.find((name) => name.includes(match));
  assert.ok(dir, `missing directory containing ${match}`);
  return path.join(root, dir);
}

const adminRoot = findDir('管理员平台');
const miniRoots = [
  path.join(root, 'miniprogram'),
  findDir('小程序_v2'),
  findDir('_修复版')
];

const server = fs.readFileSync(path.join(adminRoot, 'server/server.js'), 'utf8');
assert.ok(server.includes('/api/wechat/messages'), 'server should expose message home api');
assert.ok(server.includes('/api/wechat/messages/customer-service'), 'server should expose customer-service chat api');
assert.ok(server.includes('/api/admin/messages/threads'), 'server should expose admin message threads api');
assert.ok(server.includes('/api/admin/messages/system'), 'server should expose admin system notification api');
assert.ok(server.includes('support_threads'), 'server should initialize support thread table');
assert.ok(server.includes('support_messages'), 'server should initialize support message table');
assert.ok(server.includes('system_notifications'), 'server should initialize system notification table');

const adminHtml = fs.readFileSync(path.join(adminRoot, 'index.html'), 'utf8');
const adminApp = fs.readFileSync(path.join(adminRoot, 'app.js'), 'utf8');
const adminCss = fs.readFileSync(path.join(adminRoot, 'styles.css'), 'utf8');
assert.ok(adminHtml.includes('客服消息'), 'admin nav should include customer-service messages');
assert.ok(adminHtml.includes('id="messages"'), 'admin should render messages section');
assert.ok(adminApp.includes('refreshMessageThreads'), 'admin app should load message threads');
assert.ok(adminApp.includes('handleAdminReply'), 'admin app should support thread replies');
assert.ok(adminApp.includes('handleSystemNotice'), 'admin app should support system notices');
assert.ok(adminCss.includes('.thread-card'), 'admin styles should include thread layout');
assert.ok(adminCss.includes('.chat-panel'), 'admin styles should include chat panel layout');

for (const miniRoot of miniRoots) {
  const apiPath = path.join(miniRoot, 'utils/api.js');
  const pageRoot = path.join(miniRoot, 'pages/message');
  const api = fs.readFileSync(apiPath, 'utf8');
  const pageJs = fs.readFileSync(path.join(pageRoot, 'message.js'), 'utf8');
  const pageWxml = fs.readFileSync(path.join(pageRoot, 'message.wxml'), 'utf8');
  const pageWxss = fs.readFileSync(path.join(pageRoot, 'message.wxss'), 'utf8');

  assert.ok(api.includes('fetchMessageHome'), `${miniRoot} should fetch message home data`);
  assert.ok(api.includes('fetchCustomerServiceMessages'), `${miniRoot} should fetch service chat`);
  assert.ok(api.includes('sendCustomerServiceMessage'), `${miniRoot} should send service messages`);
  assert.ok(pageJs.includes('onMessageInput'), `${miniRoot} message page should handle text input`);
  assert.ok(pageJs.includes('onSendMessage'), `${miniRoot} message page should send text`);
  assert.ok(pageJs.includes('onQuickReply'), `${miniRoot} message page should support quick chips`);
  assert.ok(pageJs.includes('onInput(e)'), `${miniRoot} message page should keep onInput compatibility`);
  assert.ok(pageJs.includes('MESSAGE_POLL_INTERVAL'), `${miniRoot} message page should define a message polling interval`);
  assert.ok(pageJs.includes('startMessagePolling'), `${miniRoot} message page should start foreground polling`);
  assert.ok(pageJs.includes('stopMessagePolling'), `${miniRoot} message page should stop polling when hidden`);
  assert.ok(pageJs.includes('setInterval'), `${miniRoot} message page should poll backend for new replies`);
  assert.ok(pageJs.includes('clearInterval'), `${miniRoot} message page should clear polling timer`);
  assert.ok(pageJs.includes('onHide()'), `${miniRoot} message page should stop polling on hide`);
  assert.ok(pageJs.includes('onUnload()'), `${miniRoot} message page should stop polling on unload`);
  assert.ok(pageWxml.includes('bindinput="onMessageInput"'), `${miniRoot} message page should bind text input`);
  assert.ok(pageWxml.includes('bindtap="onSendMessage"'), `${miniRoot} message page should bind send button`);
  assert.ok(pageWxml.includes('notifications'), `${miniRoot} message page should render system notices`);
  assert.ok(pageWxss.includes('.chat-bubble'), `${miniRoot} message page should style chat bubbles`);
  assert.ok(pageWxss.includes('padding: 22rpx 30rpx 38rpx;'), `${miniRoot} message page should align outer padding with home page`);
  assert.ok(pageWxss.includes('width: 108rpx;'), `${miniRoot} message page should use a smaller send button`);

  const handlers = Array.from(pageWxml.matchAll(/\bbind(?:tap|input|confirm)="([^"]+)"/g), (match) => match[1]);
  for (const handler of handlers) {
    assert.ok(pageJs.includes(`${handler}(`), `${miniRoot} should define ${handler} handler used by WXML`);
  }
}

console.log('message module tests ok');
