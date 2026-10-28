const app = getApp();
const { fetchPublishedJobs } = require('../../utils/api');
const { getJobs, setJobFilter, setRemoteJobs } = require('../../utils/jobs');
const { CITY_OPTIONS, HOME_CATEGORIES } = require('../../utils/constants');

Page({
  data: {
    city: '衡阳市',
    searchValue: '',
    scrollDuration: 10,
    scrollJobs: [],
    bannerList: [
      { id: 1, title: '日结工作 轻松到手', subtitle: '当天工作当天结算', bgColor: '#38BDF8' },
      { id: 2, title: '海量岗位 等你来选', subtitle: '本地零工一站式平台', bgColor: '#5AC8FA' },
      { id: 3, title: '雇主认证 安全可靠', subtitle: '正规用工 放心务工', bgColor: '#34C3B4' }
    ],
    categories: HOME_CATEGORIES,
    urgentJobs: [],
    recommendJobs: [],
    // 用于控制动画播放/暂停，解决真机滚动停止问题
    scrollAnimPlaying: true
  },

  onLoad() {
    this.refreshHomeJobs();
  },

  onShow() {
    // 页面从后台切回时重置动画播放状态，避免真机上动画卡死
    this.setData({ scrollAnimPlaying: false });
    // 延迟一帧再恢复，强制浏览器重新计算动画
    setTimeout(() => {
      this.setData({ scrollAnimPlaying: true });
    }, 50);
    this.refreshHomeJobs();
  },

  refreshHomeJobs() {
    fetchPublishedJobs()
      .then((jobs) => {
        setRemoteJobs(jobs);
        this.setHomeJobs(jobs);
      })
      .catch(() => {
        this.setHomeJobs(getJobs());
      });
  },

  setHomeJobs(jobs) {
    const urgentJobs = jobs
      .filter((job) => job.hot || (job.tags || []).indexOf('急招') >= 0 || (job.tags || []).indexOf('新发布') >= 0)
      .slice(0, 4);
    const recommendJobs = jobs.slice(0, 6);
    // 拼接两份用于无缝向上滚动轮播；第二份加 _dup 后缀保证 wx:key 唯一
    const scrollJobs = recommendJobs.length > 0
      ? [
          ...recommendJobs.map((j) => Object.assign({}, j, { uid: String(j.id) })),
          ...recommendJobs.map((j) => Object.assign({}, j, { uid: String(j.id) + '_dup' }))
        ]
      : [];
    // 每条岗位滚动约3秒，总时长 = 原始条数 × 3s（不能太快，真机上流畅度更好）
    const count = Math.max(recommendJobs.length, 1);
    this.setData({
      city: app.globalData.city,
      urgentJobs,
      recommendJobs,
      scrollJobs,
      scrollDuration: Math.round(count * 3 * 10) / 10
    });
  },

  goJobs(filter) {
    setJobFilter(filter);
    wx.switchTab({ url: '/pages/jobs/jobs' });
  },

  onSearch(e) {
    const keyword = (e && e.currentTarget && e.currentTarget.dataset.keyword) || this.data.searchValue;
    this.setData({ searchValue: keyword });
    this.goJobs({ keyword, category: '全部' });
  },

  onSearchInput(e) {
    this.setData({ searchValue: e.detail.value });
  },

  onCategoryTap(e) {
    const { name } = e.currentTarget.dataset;
    this.goJobs({ keyword: '', category: name || '全部' });
  },

  onJobTap(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/jobDetail/jobDetail?id=${id}` });
  },

  onChangeCity() {
    wx.showActionSheet({
      itemList: CITY_OPTIONS,
      success: (res) => {
        const city = CITY_OPTIONS[res.tapIndex];
        this.setData({ city });
        app.globalData.city = city;
        wx.setStorageSync('city', city);
      }
    });
  },

  onConvenienceTap() {
    wx.navigateTo({
      url: '/pages/convenience/convenience',
      fail: () => {
        wx.showModal({
          title: '便民信息查询',
          content: '该功能正在开发中，敬请期待！',
          showCancel: false
        });
      }
    });
  },

  onPullDownRefresh() {
    // 下拉刷新时也重置动画，防止刷新后动画不走
    this.setData({ scrollAnimPlaying: false });
    this.refreshHomeJobs();
    wx.stopPullDownRefresh();
    setTimeout(() => {
      this.setData({ scrollAnimPlaying: true });
    }, 300);
  }
});
