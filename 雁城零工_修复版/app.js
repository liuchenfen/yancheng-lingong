const { CITY_OPTIONS } = require('./utils/constants');

App({
  globalData: {
    userInfo: null,
    city: CITY_OPTIONS[0],
    isLogin: false
  },
  onLaunch() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.globalData.userInfo = userInfo;
      this.globalData.isLogin = true;
    }
    const city = wx.getStorageSync('city');
    if (city) {
      this.globalData.city = city;
    }
  }
});
