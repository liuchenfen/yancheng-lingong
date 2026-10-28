const app = getApp();
const { submitConvenience, uploadImage } = require('../../utils/api');
const { CONVENIENCE_AREAS, CONVENIENCE_CATEGORIES, isValidPhone, trimFormValues } = require('../../utils/constants');

Page({
  data: {
    category: '商业宣传',
    area: '',
    content: '',
    images: [],
    contactName: '',
    contactPhone: '',
    otherContact: '',
    address: '',
    latitude: null,
    longitude: null,
    categories: CONVENIENCE_CATEGORIES,
    areas: CONVENIENCE_AREAS,
    submitting: false,
    errors: {}
  },

  onLoad() {
    this.checkLogin();
  },

  onShow() {
    this.checkLogin();
  },

  checkLogin() {
    if (!app.globalData.isLogin) {
      wx.showModal({
        title: '提示',
        content: '发布便民信息需要先登录',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.switchTab({ url: '/pages/profile/profile' });
          }
        }
      });
    }
  },

  onCategoryChange(e) {
    const category = this.data.categories[e.detail.value];
    const errors = Object.assign({}, this.data.errors, { category: '' });
    this.setData({ category, errors });
  },

  onAreaChange(e) {
    const area = this.data.areas[e.detail.value];
    const errors = Object.assign({}, this.data.errors, { area: '' });
    this.setData({ area, errors });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const errors = Object.assign({}, this.data.errors);

    if (errors[field]) errors[field] = '';

    const nextData = { [field]: value, errors };
    if (field === 'address') {
      nextData.latitude = null;
      nextData.longitude = null;
    }

    this.setData(nextData);
  },

  chooseLocation() {
    this.ensureLocationPermission()
      .then(() => this.openLocationPicker())
      .catch((error) => {
        if (!error || error.cancelled) return;
        this.showLocationError(error.message || '请选择详细地址或手动填写');
      });
  },

  ensureLocationPermission() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: ({ authSetting = {} }) => {
          const locationPermission = authSetting['scope.userLocation'];

          if (locationPermission === true) {
            resolve();
            return;
          }

          if (typeof locationPermission === 'undefined') {
            wx.authorize({
              scope: 'scope.userLocation',
              success: () => resolve(),
              fail: () => this.promptLocationSetting(resolve, reject)
            });
            return;
          }

          this.promptLocationSetting(resolve, reject);
        },
        fail: () => {
          reject(new Error('无法获取定位权限，请手动填写详细地址'));
        }
      });
    });
  },

  promptLocationSetting(resolve, reject) {
    wx.showModal({
      title: '需要定位权限',
      content: '定位用于快捷选择详细地址。你也可以手动输入地址。',
      confirmText: '去设置',
      cancelText: '手动填写',
      success: (res) => {
        if (!res.confirm) {
          reject({ cancelled: true });
          return;
        }

        wx.openSetting({
          success: (settingRes) => {
            if (settingRes.authSetting && settingRes.authSetting['scope.userLocation']) {
              resolve();
              return;
            }

            reject(new Error('未开启定位权限，请手动填写详细地址'));
          },
          fail: () => {
            reject(new Error('打开设置失败，请手动填写详细地址'));
          }
        });
      },
      fail: () => {
        reject(new Error('无法打开权限设置，请手动填写详细地址'));
      }
    });
  },

  openLocationPicker() {
    wx.chooseLocation({
      success: (res) => {
        this.setData({
          address: res.address || res.name || '',
          latitude: res.latitude || null,
          longitude: res.longitude || null,
          errors: Object.assign({}, this.data.errors, { address: '' })
        });
      },
      fail: (err) => {
        const errMsg = err && err.errMsg ? err.errMsg : '';

        if (errMsg.indexOf('cancel') >= 0) return;

        if (
          errMsg.indexOf('auth deny') >= 0 ||
          errMsg.indexOf('scope.userLocation') >= 0 ||
          errMsg.indexOf('authorize') >= 0
        ) {
          this.promptLocationSetting(
            () => this.openLocationPicker(),
            (error) => {
              if (!error || error.cancelled) return;
              this.showLocationError(error.message || '请手动填写详细地址');
            }
          );
          return;
        }

        if (errMsg.indexOf('requiredPrivateInfos') >= 0) {
          this.showLocationError('定位能力未生效，请重新编译后再试，也可手动填写地址');
          return;
        }

        this.showLocationError('定位选择失败，请手动填写详细地址');
      }
    });
  },

  showLocationError(message) {
    wx.showToast({
      title: message,
      icon: 'none'
    });
  },

  chooseImage() {
    const remain = 9 - this.data.images.length;
    if (remain <= 0) {
      wx.showToast({ title: '最多上传9张图片', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      count: remain,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFiles = res.tempFiles || [];
        this.uploadImages(tempFiles.map((file) => file.tempFilePath));
      }
    });
  },

  uploadImages(paths) {
    wx.showLoading({ title: '上传中...', mask: true });
    Promise.all(paths.map((path) => uploadImage(path)))
      .then((urls) => {
        wx.hideLoading();
        const images = this.data.images.concat(urls);
        this.setData({ images });
      })
      .catch((error) => {
        wx.hideLoading();
        wx.showToast({ title: error.message || '图片上传失败', icon: 'none' });
      });
  },

  previewImage(e) {
    const { url } = e.currentTarget.dataset;
    wx.previewImage({
      current: url,
      urls: this.data.images
    });
  },

  deleteImage(e) {
    const { index } = e.currentTarget.dataset;
    const images = this.data.images.slice();
    images.splice(index, 1);
    this.setData({ images });
  },

  onSubmit() {
    if (this.data.submitting) return;

    const form = trimFormValues(this.data, [
      'category',
      'area',
      'content',
      'contactName',
      'contactPhone',
      'otherContact',
      'address'
    ]);
    const errors = this.validateForm(form);

    if (Object.keys(errors).length) {
      this.setData(Object.assign({}, form, { errors }));
      wx.showToast({ title: '请完善标红信息', icon: 'none' });
      return;
    }

    this.setData(Object.assign({}, form, { submitting: true, errors: {} }));
    submitConvenience(form, app.globalData.userInfo)
      .then(() => {
        this.setData({ submitting: false });
        wx.showModal({
          title: '发布成功',
          content: '您的便民信息已发布，可在便民信息列表中查看。',
          showCancel: false,
          confirmText: '确定',
          success: () => {
            this.resetForm();
            wx.navigateTo({ url: '/pages/convenience/convenience' });
          }
        });
      })
      .catch((error) => {
        this.setData({ submitting: false });
        wx.showToast({ title: error.message || '发布失败', icon: 'none' });
      });
  },

  validateForm(form) {
    const errors = {};
    if (!form.category) errors.category = '请选择信息分类';
    if (!form.area) errors.area = '请选择所属区域';
    if (!form.content) errors.content = '请填写内容详情';
    if (!form.contactName) errors.contactName = '请填写联系人姓名';
    if (!form.contactPhone) {
      errors.contactPhone = '请填写联系电话';
    } else if (!isValidPhone(form.contactPhone)) {
      errors.contactPhone = '请输入正确的手机号';
    }
    if (!form.address) errors.address = '请选择或填写详细地址';
    return errors;
  },

  resetForm() {
    this.setData({
      category: '商业宣传',
      area: '',
      content: '',
      images: [],
      contactName: '',
      contactPhone: '',
      otherContact: '',
      address: '',
      latitude: null,
      longitude: null,
      submitting: false,
      errors: {}
    });
  }
});
