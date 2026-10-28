const app = getApp();
const { fetchConvenienceDetail, reportConvenience, downloadImageToLocal } = require('../../utils/api');

function parseDate(value) {
  if (!value) return null;
  if (typeof value === 'string') {
    const clean = value.replace(/-/g, '/');
    return new Date(clean);
  }
  return value instanceof Date ? value : new Date(value);
}

function relativeTimeText(value) {
  const date = parseDate(value);
  if (!date || isNaN(date.getTime())) return '刚刚';

  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return '刚刚';
  if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
  if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
  if (diff < 2592000) return Math.floor(diff / 86400) + '天前';
  if (diff < 31536000) return Math.floor(diff / 2592000) + '个月前';
  return Math.floor(diff / 31536000) + '年前';
}

function formatArea(area) {
  if (!area) return '';
  const parts = String(area).split('/');
  return parts[parts.length - 1] || area;
}

function makePhoneCall(phone) {
  if (!phone) return;
  wx.makePhoneCall({
    phoneNumber: phone,
    fail: () => {
      wx.setClipboardData({
        data: phone,
        success: () => wx.showToast({ title: '号码已复制', icon: 'none' })
      });
    }
  });
}

Page({
  data: {
    id: null,
    item: null,
    loading: true,
    errorTip: '',
    isFavorite: false,
    reporting: false
  },

  onLoad(options) {
    const id = Number(options && options.id);
    if (!Number.isFinite(id) || id <= 0) {
      this.setData({ loading: false, errorTip: '参数错误，无法加载详情' });
      return;
    }
    this.setData({ id });
    this.loadDetail(id);
  },

  loadDetail(id) {
    this.setData({ loading: true, errorTip: '' });
    fetchConvenienceDetail(id)
      .then((item) => {
        const detail = Object.assign({}, item, {
          timeText: relativeTimeText(item.createdAt),
          displayArea: formatArea(item.area),
          localImages: []
        });
        this.setData({
          loading: false,
          item: detail
        });
        // 真机环境下 HTTP 图片被微信拦截，下载为本地临时文件再显示
        if (detail.images && detail.images.length) {
          Promise.all(detail.images.map((url) => downloadImageToLocal(url)))
            .then((localPaths) => {
              const validPaths = localPaths.filter(Boolean);
              if (validPaths.length) {
                this.setData({ 'item.localImages': validPaths });
              }
            });
        }
      })
      .catch((error) => {
        this.setData({ loading: false, errorTip: error.message || '加载失败，请点击重试' });
      });
  },

  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    const { item } = this.data;
    if (!url || !item) return;
    wx.previewImage({
      current: url,
      urls: item.images || []
    });
  },

  onPhoneTap() {
    const { item } = this.data;
    if (!item || !item.contactPhone) {
      wx.showToast({ title: '暂无联系电话', icon: 'none' });
      return;
    }
    makePhoneCall(item.contactPhone);
  },

  onAddressTap() {
    const { item } = this.data;
    if (!item || !item.address) return;

    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);

    if (latitude && longitude) {
      wx.openLocation({
        latitude,
        longitude,
        name: item.address,
        address: item.address
      });
      return;
    }

    wx.setClipboardData({
      data: item.address,
      success: () => wx.showToast({ title: '地址已复制', icon: 'none' })
    });
  },

  onFavoriteTap() {
    const { isFavorite } = this.data;
    this.setData({ isFavorite: !isFavorite });
    wx.showToast({ title: isFavorite ? '已取消收藏' : '已收藏', icon: 'none' });
  },

  onReportTap() {
    const { item, reporting } = this.data;
    if (!item || reporting) return;

    wx.showModal({
      title: '举报',
      content: '确认举报该信息存在无效、虚假或诈骗行为？',
      confirmText: '举报',
      cancelText: '取消',
      success: (res) => {
        if (!res.confirm) return;

        this.setData({ reporting: true });
        reportConvenience(item.id, app.globalData.userInfo || {})
          .then(() => {
            wx.showToast({ title: '举报已提交，平台会尽快处理', icon: 'none' });
          })
          .catch((error) => {
            wx.showToast({
              title: '举报提交失败',
              icon: 'none'
            });
            if (error && error.message) {
              console.warn('[convenience-report]', error.message);
            }
          })
          .finally(() => {
            this.setData({ reporting: false });
          });
      }
    });
  },

  onReload() {
    const { id } = this.data;
    if (id) this.loadDetail(id);
  },

  onShareAppMessage() {
    const { item } = this.data;
    if (!item) return {};
    return {
      title: item.content || '便民信息详情',
      path: '/pages/convenienceDetail/convenienceDetail?id=' + item.id
    };
  }
});
