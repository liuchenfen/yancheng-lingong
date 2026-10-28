const { fetchPublishedJobs } = require('../../utils/api');
const { filterJobs, getJobs, setRemoteJobs, takeJobFilter } = require('../../utils/jobs');
const { FILTER_CATEGORIES, SALARY_OPTIONS, TIME_OPTIONS } = require('../../utils/constants');

Page({
  data: {
    searchValue: '',
    activeCategory: '全部',
    activeSalary: '不限',
    activeTime: '不限',
    categories: FILTER_CATEGORIES,
    salaryOptions: SALARY_OPTIONS,
    timeOptions: TIME_OPTIONS,
    jobList: [],
    filteredList: [],
    loading: false,
    connectionTip: '',
    hasActiveFilter: false
  },

  onLoad(options) {
    this.refreshJobs(options || {});
  },

  onShow() {
    this.refreshJobs(takeJobFilter());
  },

  refreshJobs(filter) {
    this.setData({ loading: true });
    fetchPublishedJobs()
      .then((jobs) => {
        setRemoteJobs(jobs);
        this.applyJobData(jobs, filter || {});
        this.setData({ loading: false, connectionTip: '' });
      })
      .catch(() => {
        this.applyJobData(getJobs(), filter || {});
        this.setData({ loading: false, connectionTip: '已使用本地缓存岗位，联网后会自动刷新' });
        wx.showToast({ title: '已使用本地缓存岗位', icon: 'none' });
      });
  },

  applyJobData(jobs, filter) {
    const nextData = { jobList: jobs };
    if (filter.keyword !== undefined) nextData.searchValue = filter.keyword;
    if (filter.category !== undefined) nextData.activeCategory = filter.category || '全部';
    if (filter.salary !== undefined) nextData.activeSalary = filter.salary || '不限';
    if (filter.time !== undefined) nextData.activeTime = filter.time || '不限';
    this.setData(nextData);
    this.applyFilter();
  },

  onSearchInput(e) {
    this.setData({ searchValue: e.detail.value });
  },

  onSearch() {
    this.applyFilter();
  },

  onClearSearch() {
    this.setData({ searchValue: '' });
    this.applyFilter();
  },

  onCategoryTap(e) {
    const cat = e.currentTarget.dataset.name;
    this.setData({ activeCategory: cat });
    this.applyFilter();
  },

  onSalaryTap(e) {
    this.setData({ activeSalary: e.currentTarget.dataset.val });
    this.applyFilter();
  },

  onTimeTap(e) {
    this.setData({ activeTime: e.currentTarget.dataset.val });
    this.applyFilter();
  },

  applyFilter() {
    const { jobList, activeCategory, activeSalary, activeTime, searchValue } = this.data;
    const filteredList = filterJobs(jobList, {
      keyword: searchValue,
      category: activeCategory,
      salary: activeSalary,
      time: activeTime
    });
    const hasActiveFilter = !!searchValue || activeCategory !== '全部' || activeSalary !== '不限' || activeTime !== '不限';
    this.setData({ filteredList, hasActiveFilter });
  },

  resetFilters() {
    this.setData({
      searchValue: '',
      activeCategory: '全部',
      activeSalary: '不限',
      activeTime: '不限'
    });
    this.applyFilter();
  },

  onJobTap(e) {
    wx.navigateTo({ url: `/pages/jobDetail/jobDetail?id=${e.currentTarget.dataset.id}` });
  }
});
