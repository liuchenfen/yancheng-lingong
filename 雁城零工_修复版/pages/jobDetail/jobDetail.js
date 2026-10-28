const app = getApp();
const { fetchPublishedJobs, submitApplication } = require('../../utils/api');
const {
  addApplication,
  getJobById,
  hasApplied,
  isCollected,
  setRemoteJobs,
  toggleCollected
} = require('../../utils/jobs');
const { isValidPhone, trimText } = require('../../utils/constants');

Page({
  data: {
    job: null,
    isCollected: false,
    showApplyModal: false,
    isApplied: false,
    applyName: '',
    applyPhone: '',
    applyGender: '',
    applyAge: '',
    applySubmitting: false,
    applyErrors: {}
  },

  onLoad(options) {
    const id = parseInt(options.id, 10);
    this.loadJob(id);
  },

  loadJob(id) {
    const job = getJobById(id);
    if (!job) {
      fetchPublishedJobs()
        .then((jobs) => {
          setRemoteJobs(jobs);
          const remoteJob = getJobById(id);
          if (!remoteJob) {
            wx.showToast({ title: '岗位不存在', icon: 'none' });
            setTimeout(() => wx.navigateBack(), 800);
            return;
          }
          this.setJob(remoteJob);
        })
        .catch(() => {
          wx.showToast({ title: '岗位不存在', icon: 'none' });
          setTimeout(() => wx.navigateBack(), 800);
        });
      return;
    }
    this.setJob(job);
  },

  setJob(job) {
    const id = Number(job.id);
    this.setData({
      job,
      isCollected: isCollected(id),
      isApplied: hasApplied(id)
    });
    wx.setNavigationBarTitle({ title: job.title });
  },

  onCollect() {
    const { job } = this.data;
    const newVal = toggleCollected(job.id);
    this.setData({ isCollected: newVal });
    wx.showToast({ title: newVal ? '收藏成功' : '取消收藏', icon: 'none' });
  },

  onShare() {
    wx.showShareMenu({ withShareTicket: true });
  },

  onApply() {
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '请先登录后再申请',
        confirmText: '去登录',
        success: (res) => { if (res.confirm) wx.switchTab({ url: '/pages/profile/profile' }); }
      });
      return;
    }
    if (this.data.isApplied) {
      wx.showToast({ title: '该岗位已投递', icon: 'none' });
      return;
    }
    // 自动填充用户已保存的全部信息（首次为空，投递后永久记忆）
    const userInfo = app.globalData.userInfo || {};
    const applyName = this.data.applyName || userInfo.name || '';
    const applyPhone = this.data.applyPhone || userInfo.phone || '';
    const applyGender = this.data.applyGender || userInfo.gender || '';
    const applyAge = this.data.applyAge || (userInfo.age != null ? String(userInfo.age) : '');
    this.setData({ showApplyModal: true, applyName, applyPhone, applyGender, applyAge, applyErrors: {} });
  },

  onApplyNameInput(e) {
    const applyErrors = Object.assign({}, this.data.applyErrors, { name: '' });
    this.setData({ applyName: e.detail.value, applyErrors });
  },
  onApplyPhoneInput(e) {
    const applyErrors = Object.assign({}, this.data.applyErrors, { phone: '' });
    this.setData({ applyPhone: e.detail.value, applyErrors });
  },
  onApplyGender(e) {
    const applyErrors = Object.assign({}, this.data.applyErrors, { gender: '' });
    this.setData({ applyGender: e.currentTarget.dataset.value, applyErrors });
  },
  onApplyAgeInput(e) {
    const applyErrors = Object.assign({}, this.data.applyErrors, { age: '' });
    this.setData({ applyAge: e.detail.value, applyErrors });
  },
  onApplyCancel() {
    if (this.data.applySubmitting) return;
    this.setData({ showApplyModal: false, applyErrors: {} });
  },
  onModalTap() { /* 阻止冒泡 */ },

  onApplyConfirm() {
    if (this.data.applySubmitting) return;
    const applyName = trimText(this.data.applyName);
    const applyPhone = trimText(this.data.applyPhone);
    const applyGender = this.data.applyGender;
    const applyAge = trimText(this.data.applyAge);
    const { job } = this.data;
    const applyErrors = this.validateApplyForm(applyName, applyPhone, applyGender, applyAge);
    if (Object.keys(applyErrors).length) {
      this.setData({ applyName, applyPhone, applyErrors });
      wx.showToast({ title: '请完善申请信息', icon: 'none' });
      return;
    }
    this.setData({ applySubmitting: true, applyErrors: {} });
    submitApplication(job, { name: applyName, phone: applyPhone, gender: applyGender, age: applyAge }, app.globalData.userInfo)
      .then((result) => {
        // 保存用户画像到本地，后续投递和重新登录后自动填充
        const profile = app.globalData.userInfo || {};
        let changed = false;
        if (applyName && profile.name !== applyName) { profile.name = applyName; changed = true; }
        if (applyPhone && profile.phone !== applyPhone) { profile.phone = applyPhone; changed = true; }
        if (applyGender && profile.gender !== applyGender) { profile.gender = applyGender; changed = true; }
        if (applyAge && profile.age !== Number(applyAge)) { profile.age = Number(applyAge); changed = true; }
        if (changed) {
          app.globalData.userInfo = profile;
          wx.setStorageSync('userInfo', profile);
        }
        addApplication(job, { name: applyName, phone: applyPhone, gender: applyGender, age: applyAge });
        this.setData({ applyName, applyPhone, applyGender, applyAge, showApplyModal: false, isApplied: true, applySubmitting: false });
        wx.showToast({ title: '投递成功！', icon: 'success' });
      })
      .catch((error) => {
        this.setData({ applySubmitting: false });
        wx.showToast({ title: error.message || '投递失败', icon: 'none' });
      });
  },

  validateApplyForm(name, phone, gender, age) {
    const applyErrors = {};
    if (!name) applyErrors.name = '请输入姓名';
    if (!phone) {
      applyErrors.phone = '请输入联系电话';
    } else if (!isValidPhone(phone)) {
      applyErrors.phone = '请输入正确的手机号';
    }
    if (!gender) applyErrors.gender = '请选择性别';
    if (!age) {
      applyErrors.age = '请输入年龄';
    } else if (isNaN(Number(age)) || Number(age) < 16 || Number(age) > 70) {
      applyErrors.age = '请输入有效年龄（16-70岁）';
    }
    return applyErrors;
  },

  onCallPhone() {
    wx.makePhoneCall({ phoneNumber: this.data.job.phone });
  },

  onShareAppMessage() {
    const { job } = this.data;
    return { title: `${job.title} - ${job.salary}`, path: `/pages/jobDetail/jobDetail?id=${job.id}` };
  }
});
