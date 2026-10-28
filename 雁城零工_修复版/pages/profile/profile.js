const app = getApp();
const { syncWechatLogin, uploadAvatar } = require('../../utils/api');
const { getApplications, getCollectedJobs, getStats, getJobs } = require('../../utils/jobs');

Page({
  data: {
    isLogin: false,
    userInfo: null,
    loginLoading: false,
    // 头像/昵称选择器
    tempAvatarUrl: '',
    tempNickName: '',
    showKefuModal: false,
    stats: { applied: 0, collected: 0, viewed: 0 },
    menus: []
  },

  onShow() {
    const stats = getStats();
    this.setData({
      isLogin: app.globalData.isLogin,
      userInfo: app.globalData.userInfo,
      stats,
      menus: this.buildMenus(stats)
    });
  },

  buildMenus(stats) {
    const publishedCount = getJobs().filter((item) => item.source === 'local').length;
    return [
      { id: 1, icon: '投', title: '我的投递', desc: '查看已申请岗位', badge: stats.applied },
      { id: 2, icon: '藏', title: '我的收藏', desc: '管理收藏岗位', badge: stats.collected },
      { id: 3, icon: '发', title: '我的发布', desc: '查看已发布信息', badge: publishedCount },
      { id: 5, icon: '设', title: '账号设置', desc: '登录信息与偏好', badge: 0 },
      { id: 6, icon: '客', title: '客服帮助', desc: '联系平台客服', badge: 0 }
    ];
  },

  /* ========== 头像 / 昵称 选择 ========== */

  /**
   * 用户点击头像区域 → 微信弹出头像选择器（open-type="chooseAvatar"）
   * 选完后自动上传到服务器，拿到永久 URL
   */
  onChooseAvatar(e) {
    const avatarUrl = (e.detail && e.detail.avatarUrl) || '';
    if (!avatarUrl) return;

    this.setData({ tempAvatarUrl: avatarUrl });

    // 立即上传到服务器获取永久 URL
    uploadAvatar(avatarUrl).then((serverUrl) => {
      if (serverUrl) {
        this.setData({ tempAvatarUrl: serverUrl });
      }
    }).catch(() => {});
  },

  /** 昵称输入 */
  onNicknameInput(e) {
    this.setData({ tempNickName: e.detail.value || '' });
  },

  onNicknameBlur(e) {
    const val = (e.detail.value || '').trim();
    if (val) this.setData({ tempNickName: val });
  },

  /* ========== 登录 ========== */

  /**
   * 微信一键登录
   * 流程：wx.login → 后端换取 openid → 写入用户信息（含头像+昵称）
   */
  onWechatLogin() {
    if (this.data.loginLoading) return;

    // 必须选头像
    if (!this.data.tempAvatarUrl) {
      wx.showToast({ title: '请先选择头像', icon: 'none' });
      return;
    }
    // 必须填昵称
    const nick = (this.data.tempNickName || '').trim();
    if (!nick) {
      wx.showToast({ title: '请先填写昵称', icon: 'none' });
      return;
    }

    this.setData({ loginLoading: true });

    wx.login({
      success: (loginRes) => {
        const code = loginRes.code || '';
        this._doLogin(code);
      },
      fail: () => {
        this._doLogin('');
      }
    });
  },

  _doLogin(code) {
    const nickName = (this.data.tempNickName || '').trim();
    const avatarUrl = this.data.tempAvatarUrl;

    const userInfo = {
      nickName,
      avatarUrl,
      loginType: 'wechat',
      loginCode: code,
      loginTime: Date.now()
    };

    syncWechatLogin(userInfo).then((remoteUser) => {
      this.applyLogin(Object.assign({}, userInfo, {
        userId: remoteUser.id,
        openid: remoteUser.openid,
        nickName: remoteUser.nickname || nickName,
        avatarUrl: remoteUser.avatarUrl || avatarUrl,
        name: remoteUser.name || userInfo.name || '',
        phone: remoteUser.phone || userInfo.phone || '',
        gender: remoteUser.gender || userInfo.gender || '',
        age: remoteUser.age != null ? remoteUser.age : (userInfo.age || null)
      }));
    }).catch((err) => {
      this.setData({ loginLoading: false });
      const msg = (err && err.message) || '登录失败，请检查网络';
      wx.showToast({ title: msg, icon: 'none' });
    });
  },

  applyLogin(userInfo) {
    app.globalData.userInfo = userInfo;
    app.globalData.isLogin = true;
    wx.setStorageSync('userInfo', userInfo);
    this.setData({
      isLogin: true,
      userInfo,
      loginLoading: false,
      tempAvatarUrl: '',
      tempNickName: ''
    });
    wx.showToast({ title: '登录成功', icon: 'success' });
  },

  /* ========== 菜单 / 客服 / 退出 ========== */

  onMenuTap(e) {
    const id = Number(e.currentTarget.dataset.id);
    if (id === 1) {
      this.showListModal('我的投递', getApplications().map((item) => `${item.title}｜${item.status}`));
      return;
    }
    if (id === 2) {
      this.showListModal('我的收藏', getCollectedJobs().map((item) => `${item.title}｜${item.salary}`));
      return;
    }
    if (id === 3) {
      this.showListModal('我的发布', getJobs().filter((item) => item.source === 'local').map((item) => `${item.title}｜${item.salary}`));
      return;
    }
    if (id === 6) {
      this.setData({ showKefuModal: true });
    }
  },

  showListModal(title, items) {
    wx.showModal({
      title,
      content: items.length ? items.join('\n') : '暂无记录',
      showCancel: false
    });
  },

  onCloseKefuModal() {
    this.setData({ showKefuModal: false });
  },

  onCallKefu() {
    wx.makePhoneCall({ phoneNumber: '15773452907' });
  },

  onLogout() {
    wx.showModal({
      title: '提示',
      content: '确认退出登录？',
      success: (res) => {
        if (res.confirm) {
          app.globalData.userInfo = null;
          app.globalData.isLogin = false;
          wx.removeStorageSync('userInfo');
          this.setData({
            isLogin: false,
            userInfo: null,
            loginLoading: false,
            tempAvatarUrl: '',
            tempNickName: ''
          });
        }
      }
    });
  }
});
