const {
  fetchCustomerServiceMessages,
  fetchMessageHome,
  markNotificationsRead,
  sendCustomerServiceMessage
} = require('../../utils/api');

const fallbackMessages = [
  { id: 1, senderType: 'admin', content: '您好，我是雁城零工客服。请告诉我想找什么工作、所在区域和可上岗时间，我来帮您推荐。', createdAt: '刚刚' }
];
const MESSAGE_POLL_INTERVAL = 5000;

Page({
  data: {
    loading: false,
    sending: false,
    inputValue: '',
    isLogin: false,
    userInfo: null,
    service: null,
    chatMessages: fallbackMessages,
    scrollTop: 0,
    notifications: [
      { id: 'local-1', title: '系统通知', content: '欢迎使用雁城零工，您可以直接联系客服推荐合适工作。', createdAt: '今天', isRead: false }
    ],
    unreadCount: 0,
    noticeFolded: true,
    quickQuestions: [
      '帮我推荐今天能做的日结工作',
      '我想找附近的餐饮服务',
      '有没有搬运装卸的高薪岗位'
    ]
  },

  onLoad() {
    this.initUser();
    this.loadMessages();
  },

  onShow() {
    this.initUser();
    this.loadMessages({ silent: true });
    this.startMessagePolling();
  },

  onHide() {
    this.stopMessagePolling();
  },

  onUnload() {
    this.stopMessagePolling();
  },

  /**
   * 从全局数据读取登录状态（唯一权威来源）
   * 不做任何 fallback 推断，避免退出后被误判
   */
  getLoginState() {
    const app = getApp();
    const isLogin = !!app.globalData.isLogin;
    const userInfo = app.globalData.userInfo || null;
    return { isLogin, userInfo };
  },

  initUser() {
    const { isLogin, userInfo } = this.getLoginState();
    this.setData({
      isLogin: isLogin,
      userInfo: userInfo
    });
  },

  checkLogin() {
    const { isLogin, userInfo } = this.getLoginState();
    if (isLogin) {
      if (!this.data.isLogin) {
        this.setData({ isLogin: true, userInfo: userInfo || null });
      }
      return true;
    }
    wx.showModal({
      title: '请先登录',
      content: '发送消息需要登录账号，是否前往登录？',
      confirmText: '去登录',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.switchTab({ url: '/pages/profile/profile' });
        }
      }
    });
    return false;
  },

  startMessagePolling() {
    this.stopMessagePolling();
    this.messagePollTimer = setInterval(() => {
      this.loadMessages({ silent: true });
    }, MESSAGE_POLL_INTERVAL);
  },

  stopMessagePolling() {
    if (!this.messagePollTimer) return;
    clearInterval(this.messagePollTimer);
    this.messagePollTimer = null;
  },

  scrollToBottom() {
    wx.nextTick(() => {
      const query = wx.createSelectorQuery().in(this);
      query.select('.chat-list-inner').boundingClientRect();
      query.exec((res) => {
        if (res && res[0]) {
          this.setData({ scrollTop: res[0].height });
        }
      });
    });
  },

  loadMessages(options) {
    const opts = options || {};
    const { isLogin, userInfo } = this.getLoginState();
    if (!opts.silent) {
      this.setData({ loading: true });
    }
    if (opts.silent && this.data.sending) {
      return;
    }
    Promise.all([
      fetchMessageHome(isLogin ? (userInfo || {}) : {}),
      fetchCustomerServiceMessages(isLogin ? (userInfo || {}) : {})
    ])
      .then(([home, serviceData]) => {
        const newMessages = serviceData.messages && serviceData.messages.length
          ? serviceData.messages
          : fallbackMessages;
        const oldMessages = this.data.chatMessages;
        const oldLast = oldMessages[oldMessages.length - 1];
        const newLast = newMessages[newMessages.length - 1];
        const changed = oldMessages.length !== newMessages.length ||
          (oldLast && newLast && (oldLast.id !== newLast.id || oldLast.content !== newLast.content));
        const newUnreadCount = typeof home.unreadCount === 'number' ? home.unreadCount : 0;
        const newNotifications = home.notifications && home.notifications.length ? home.notifications : this.data.notifications;

        const willChange = changed || !opts.silent || newUnreadCount !== this.data.unreadCount;
        if (willChange) {
          this.setData({
            service: serviceData.thread || home.service || null,
            chatMessages: newMessages,
            notifications: newNotifications,
            unreadCount: newUnreadCount,
            loading: false
          }, () => {
            this.scrollToBottom();
          });
        } else {
          this.setData({ loading: false });
        }
      })
      .catch(() => {
        if (!opts.silent) {
          this.setData({ loading: false });
        }
      });
  },

  /**
   * 点击通知栏 - 展开/折叠通知列表
   * 展开时自动标记全部通知为已读
   */
  onToggleNotices() {
    const folded = !this.data.noticeFolded;
    this.setData({ noticeFolded: folded });

    if (!folded && this.data.unreadCount > 0) {
      // 展开时标记已读
      const { userInfo } = this.getLoginState();
      markNotificationsRead(userInfo || {}).then(() => {
        const updated = (this.data.notifications || []).map(n => Object.assign({}, n, { isRead: true }));
        this.setData({
          notifications: updated,
          unreadCount: 0
        });
      }).catch(() => {});
    }
  },

  onMessageInput(e) {
    this.setData({ inputValue: e.detail.value });
  },

  onInput(e) {
    this.onMessageInput(e);
  },

  onFocusInput() {
    if (!this.checkLogin()) return;
  },

  onQuickReply(e) {
    if (!this.checkLogin()) return;
    const text = e.currentTarget.dataset.text;
    this.sendMessage(text);
  },

  onQuickTap(e) {
    this.onQuickReply(e);
  },

  onSendMessage() {
    if (!this.checkLogin()) return;
    this.sendMessage(this.data.inputValue);
  },

  onSend() {
    this.onSendMessage();
  },

  sendMessage(value) {
    const content = String(value || '').trim();
    if (!content) {
      wx.showToast({ title: '请输入咨询内容', icon: 'none' });
      return;
    }
    if (this.data.sending) return;

    const { isLogin, userInfo } = this.getLoginState();
    if (!isLogin) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const optimistic = {
      id: 'local-' + Date.now(),
      senderType: 'user',
      content,
      createdAt: '发送中'
    };
    this.setData({
      sending: true,
      inputValue: '',
      chatMessages: this.data.chatMessages.concat([optimistic])
    }, () => {
      this.scrollToBottom();
    });

    sendCustomerServiceMessage(userInfo || {}, content)
      .then((data) => {
        const serverMessages = data.messages && data.messages.length ? data.messages : this.data.chatMessages;
        this.setData({
          sending: false,
          service: data.thread,
          chatMessages: serverMessages
        }, () => {
          this.scrollToBottom();
        });
      })
      .catch((error) => {
        const cleaned = this.data.chatMessages.filter(m => m.id !== optimistic.id);
        this.setData({
          sending: false,
          chatMessages: cleaned
        });
        wx.showToast({ title: error.message || '发送失败', icon: 'none' });
      });
  }
});
