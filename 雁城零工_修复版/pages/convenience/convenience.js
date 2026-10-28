const { fetchConvenience, downloadImageToLocal } = require('../../utils/api');

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

Page({
  data: {
    list: [],
    loading: false,
    refreshing: false,
    page: 1,
    pageSize: 20,
    hasMore: true,
    errorTip: ''
  },

  onLoad() {
    this.loadList(true);
  },

  onPullDownRefresh() {
    this.setData({ refreshing: true });
    this.loadList(true).finally(() => {
      this.setData({ refreshing: false });
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadList(false);
    }
  },

  loadList(reset) {
    if (this.data.loading) return Promise.resolve();

    const page = reset ? 1 : this.data.page + 1;
    this.setData({ loading: true, errorTip: '' });

    return fetchConvenience({ page, pageSize: this.data.pageSize })
      .then((list) => {
        console.log('[convenience] list images:', list.map((item) => ({
          id: item.id,
          images: item.images
        })));
        const enriched = list.map((item) => Object.assign({}, item, {
          timeText: relativeTimeText(item.createdAt),
          localCover: ''
        }));
        const current = reset ? [] : this.data.list;
        const baseIndex = current.length;
        const nextList = current.concat(enriched);
        this.setData({
          list: nextList,
          page,
          hasMore: list.length >= this.data.pageSize,
          loading: false
        });
        // 真机环境下 HTTP 图片被微信拦截，下载为本地临时文件再显示
        enriched.forEach((item, idx) => {
          if (item.images && item.images[0]) {
            downloadImageToLocal(item.images[0]).then((localPath) => {
              if (!localPath) return;
              const dataKey = `list[${baseIndex + idx}].localCover`;
              this.setData({ [dataKey]: localPath });
            });
          }
        });
      })
      .catch((error) => {
        this.setData({
          loading: false,
          errorTip: error.message || '加载失败，请下拉重试'
        });
      });
  },

  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    const item = this.data.list.find((i) => i.images && i.images.indexOf(url) >= 0);
    wx.previewImage({
      current: url,
      urls: (item && item.images) || []
    });
  },

  onImageError(e) {
    const { index } = e.currentTarget.dataset;
    const item = this.data.list[index];
    console.error('[convenience] image load error:', {
      index,
      id: item && item.id,
      url: e.currentTarget.dataset.url,
      errMsg: e.detail && e.detail.errMsg
    });
  },

  onCardTap(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) return;
    wx.navigateTo({ url: '/pages/convenienceDetail/convenienceDetail?id=' + id });
  }
});
