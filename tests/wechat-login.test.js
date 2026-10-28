const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const profileFiles = [
  'miniprogram/pages/profile/profile.js',
  '雁城零工小程序_v2/pages/profile/profile.js',
  '雁城零工_修复版/pages/profile/profile.js',
  'write_all.py'
];
const profileViews = [
  'miniprogram/pages/profile/profile.wxml',
  '雁城零工小程序_v2/pages/profile/profile.wxml',
  '雁城零工_修复版/pages/profile/profile.wxml',
  'write_all.py'
];

for (const file of profileFiles) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(content.includes('onWechatLogin'), `${file} should expose onWechatLogin`);
  assert.ok(content.includes('onPhoneLogin'), `${file} should expose onPhoneLogin`);
  assert.ok(content.includes('wx.login'), `${file} should call wx.login for WeChat login`);
  assert.ok(content.includes('wx.getPhoneMask'), `${file} should request phone mask before one-click phone login`);
  assert.ok(content.includes('loginLoading'), `${file} should guard repeated login taps`);
  assert.ok(!content.includes('sms'), `${file} should not keep sms login logic`);
  assert.ok(!content.includes('verifyCode'), `${file} should not keep verification code login logic`);
}

for (const file of profileViews) {
  const content = fs.readFileSync(path.join(root, file), 'utf8');
  assert.ok(content.includes('bindtap="onWechatLogin"'), `${file} should bind the login button to onWechatLogin`);
  assert.ok(content.includes('open-type="phoneOneClickLogin"'), `${file} should render native phone one-click login button`);
  assert.ok(content.includes('bindphoneoneclicklogin="onPhoneLogin"'), `${file} should bind phone one-click login to onPhoneLogin`);
  assert.ok(!content.includes('code-input'), `${file} should not render a verification code input`);
  assert.ok(!content.includes('sms-login'), `${file} should not render sms login controls`);
}

console.log('wechat login tests ok');
