const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const profileJs = fs.readFileSync(path.join(root, 'miniprogram/pages/profile/profile.js'), 'utf8');
const profileWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/profile/profile.wxml'), 'utf8');
const apiJs = fs.readFileSync(path.join(root, 'miniprogram/utils/api.js'), 'utf8');
const serverJs = fs.readFileSync(path.join(root, '雁城零工_管理员平台/server/server.js'), 'utf8');
const wechatRouteStart = serverJs.indexOf('app.post("/api/auth/wechat-login"');
const phoneRouteStart = serverJs.indexOf('app.post("/api/auth/phone-login"');
const wechatRoute = serverJs.slice(wechatRouteStart, phoneRouteStart);

assert.ok(apiJs.includes('function syncWechatLogin'), 'api.js should define syncWechatLogin');
assert.ok(apiJs.includes("url: '/api/auth/wechat-login'"), 'syncWechatLogin should post to backend auth endpoint');
assert.ok(apiJs.includes('syncWechatLogin'), 'api.js should export syncWechatLogin');

assert.ok(profileJs.includes("require('../../utils/api')"), 'profile page should import api helpers');
assert.ok(profileJs.includes('syncWechatLogin(userInfo)'), 'profile login should sync WeChat identity with backend');
assert.ok(profileJs.includes('applyLogin'), 'profile page should centralize successful login state updates');
assert.ok(profileJs.includes('userId: remoteUser.id'), 'profile login should keep backend userId');
assert.ok(profileJs.includes('openid: remoteUser.openid'), 'profile login should keep backend openid');
assert.ok(profileJs.includes('onChooseAvatar'), 'profile page should handle WeChat avatar selection');
assert.ok(profileJs.includes('onNicknameInput'), 'profile page should handle nickname input');

assert.ok(profileWxml.includes('open-type="chooseAvatar"'), 'profile page should expose WeChat avatar selection');
assert.ok(profileWxml.includes('bindchooseavatar="onChooseAvatar"'), 'avatar selector should bind onChooseAvatar');
assert.ok(profileWxml.includes('type="nickname"'), 'profile page should expose WeChat nickname input');
assert.ok(profileWxml.includes('bindinput="onNicknameInput"'), 'nickname input should bind onNicknameInput');

assert.ok(wechatRoute.includes('WX_APPID'), 'wechat-login route should read WX_APPID');
assert.ok(wechatRoute.includes('WX_SECRET'), 'wechat-login route should read WX_SECRET');
assert.ok(wechatRoute.includes('jscode2session'), 'wechat-login route should exchange code with jscode2session');
assert.ok(wechatRoute.includes('session.openid'), 'wechat-login route should persist openid returned by WeChat');

console.log('wechat real login tests ok');
