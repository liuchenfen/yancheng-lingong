// 真机调试：使用电脑局域网IP，替换 192.168.x.x 为你的实际IP（ipconfig查看）
// 本机WiFi IP: 192.168.200.103
const API_BASE = 'http://192.168.200.103:3000';

/** 相对路径拼成完整 URL；已是完整 URL 但指向旧 IP/端口的，统一替换为当前 API_BASE */
function getFullUrl(path) {
  if (!path) return '';
  if (!path.startsWith('http')) return API_BASE + path;
  return path.replace(/^http:\/\/[^/]+:3000/, API_BASE);
}

/** 统一图片 URL：相对路径补 API_BASE；旧 IP 完整 URL 替换为当前 API_BASE */
function normalizeImageUrl(img) {
  if (!img) return '';
  if (!img.startsWith('http')) return API_BASE + img;
  // 兼容 IP 变化导致的历史完整 URL（如 http://192.168.200.88:3000/uploads/...）
  return img.replace(/^http:\/\/[^/]+:3000/, API_BASE);
}

/** 把远程图片下载到本地临时文件，用于绕过真机 image 组件对 HTTP 的限制 */
function downloadImageToLocal(url) {
  if (!url) return Promise.resolve('');
  return new Promise((resolve) => {
    wx.downloadFile({
      url,
      success: (res) => {
        if (res.statusCode === 200 && res.tempFilePath) {
          resolve(res.tempFilePath);
        } else {
          console.warn('[downloadImageToLocal] fail', url, res.statusCode);
          resolve('');
        }
      },
      fail: (err) => {
        console.warn('[downloadImageToLocal] error', url, err && err.errMsg);
        resolve('');
      }
    });
  });
}

function request(options) {
  if (!API_BASE) {
    return Promise.reject(new Error('后端接口未配置'));
  }
  const opts = options || {};
  return new Promise((resolve, reject) => {
    wx.request({
      url: API_BASE + opts.url,
      method: opts.method || 'GET',
      data: opts.data || {},
      header: {
        'content-type': 'application/json; charset=utf-8'
      },
      success(res) {
        const payload = res.data || {};
        if (res.statusCode >= 200 && res.statusCode < 300 && payload.code === 0) {
          resolve(payload.data);
          return;
        }
        reject(new Error(payload.message || '接口请求失败'));
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络连接失败'));
      }
    });
  });
}

function normalizeJob(job) {
  const salaryType = job.salaryType || '日结';
  const category = job.category || '其他';
  const rawSalary = String(job.salary || '').trim();
  // 若薪资缺少“元”或“/”等单位，则按结算方式自动补全，保证展示一致
  let salary = rawSalary || '薪资面议';
  if (rawSalary && !/[元块\/]/.test(rawSalary)) {
    const unitMap = {
      '日结': '元/天',
      '周结': '元/周',
      '月结': '元/月',
      '完工结': '元/单'
    };
    salary = rawSalary + (unitMap[salaryType] || '元/天');
  }
  return {
    id: Number(job.id),
    title: job.title,
    company: job.company || '雁城零工发布',
    salary,
    salaryType,
    location: job.location,
    displayLocation: job.displayLocation || job.location,
    tags: [salaryType, category],
    experience: '不限',
    education: '不限',
    workTime: job.workTime || '时间面议',
    headcount: Number(job.headcount) || 1,
    contact: job.contact,
    phone: job.phone,
    description: job.description || '暂无岗位描述',
    postedTime: job.createdAt || '刚刚',
    time: job.createdAt || '刚刚',
    timeOption: '不限',
    views: 0,
    hot: false,
    category,
    status: job.status,
    source: 'remote'
  };
}

function fetchPublishedJobs(params) {
  return request({
    url: '/api/jobs',
    data: params || {}
  }).then((data) => (data.list || []).map(normalizeJob));
}

function submitWechatJob(form) {
  return request({
    url: '/api/wechat/jobs',
    method: 'POST',
    data: {
      title: form.jobTitle,
      category: form.category,
      salary: form.salary + '元/' + salaryUnit(form.salaryType),
      salaryType: form.salaryType || '日结',
      headcount: Number(form.headcount) || 1,
      displayLocation: form.location,
      location: form.location,
      company: (form.contactName || '用户') + '发布',
      contact: form.contactName || '招聘负责人',
      phone: form.contactPhone,
      workTime: form.workTime || '时间面议',
      description: form.description || '岗位信息已提交，欢迎符合条件的求职者联系咨询。'
    }
  }).then(normalizeJob);
}

function normalizeConvenience(post) {
  const rawImages = Array.isArray(post.images) ? post.images : [];
  // 相对路径补 API_BASE；旧 IP 完整 URL 替换为当前 API_BASE
  const images = rawImages.map(normalizeImageUrl).filter(Boolean);
  return {
    id: Number(post.id),
    category: post.category || '商业宣传',
    area: post.area || '',
    content: post.content || '',
    images,
    viewCount: Number(post.viewCount || post.view_count || 0),
    contactName: post.contactName || '',
    contactPhone: post.contactPhone || '',
    otherContact: post.otherContact || '',
    address: post.address || '',
    latitude: post.latitude,
    longitude: post.longitude,
    status: post.status,
    createdAt: post.createdAt || '刚刚'
  };
}

function fetchConvenience(params) {
  return request({
    url: '/api/convenience',
    data: params || {}
  }).then((data) => (data.list || []).map(normalizeConvenience));
}

function fetchConvenienceDetail(id) {
  return request({
    url: '/api/convenience/' + id
  }).then(normalizeConvenience);
}

function reportConvenience(id, userInfo) {
  const info = userInfo || {};
  return request({
    url: '/api/wechat/convenience/' + id + '/report',
    method: 'POST',
    data: {
      openid: info.openid || info.userId || '',
      userId: info.userId || null
    }
  });
}

function submitConvenience(form, userInfo) {
  const info = userInfo || {};
  return request({
    url: '/api/wechat/convenience',
    method: 'POST',
    data: {
      openid: info.openid || info.userId || '',
      category: form.category || '商业宣传',
      area: form.area,
      content: form.content,
      images: form.images || [],
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      otherContact: form.otherContact || '',
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude
    }
  }).then(normalizeConvenience);
}

function uploadImage(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: API_BASE + '/api/upload/image',
      filePath: filePath,
      name: 'file',
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0 && data.data && data.data.url) {
            // 只返回相对路径，显示时由 normalizeConvenience 拼 API_BASE
            resolve(data.data.url);
          } else {
            reject(new Error(data.message || '上传失败'));
          }
        } catch (e) {
          reject(new Error('上传响应解析失败'));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

function syncWechatLogin(userInfo) {
  const info = userInfo || {};
  return request({
    url: '/api/auth/wechat-login',
    method: 'POST',
    data: {
      code: info.loginCode || info.code || ('local_' + Date.now()),
      openid: info.openid || '',
      nickname: info.nickName || info.nickname || '微信用户',
      avatarUrl: info.avatarUrl || '',
      loginType: info.loginType || 'wechat',
      phoneLoginCode: info.phoneLoginCode || '',
      phone: info.phone || '',
      city: info.city || '衡阳'
    }
  }).then(data => {
    // 头像可能是相对路径，拼成完整 URL
    if (data && data.avatarUrl) {
      data.avatarUrl = getFullUrl(data.avatarUrl);
    }
    return data;
  });
}

/**
 * 本机号码一键登录
 * @param {object} params - { phoneCode: 手机号凭证code, loginCode: wx.login的code }
 * @returns {Promise<{id, openid, nickname, avatarUrl, phone}>}
 */
function phoneLogin(params) {
  const p = params || {};
  return request({
    url: '/api/auth/phone-login',
    method: 'POST',
    data: {
      phoneCode: p.phoneCode || '',
      loginCode: p.loginCode || ''
    }
  });
}

function ensureBackendUser(userInfo) {
  if (userInfo && userInfo.userId) return Promise.resolve(userInfo);
  return syncWechatLogin(userInfo || {}).then((remoteUser) => Object.assign({}, userInfo || {}, {
    userId: remoteUser.id,
    openid: remoteUser.openid,
    nickName: remoteUser.nickname || (userInfo && userInfo.nickName) || '微信用户',
    avatarUrl: remoteUser.avatarUrl || (userInfo && userInfo.avatarUrl) || ''
  }));
}

function submitApplication(job, applicant, userInfo) {
  return ensureBackendUser(userInfo).then((backendUser) => request({
    url: '/api/applications',
    method: 'POST',
    data: {
      jobId: Number(job.id),
      userId: backendUser.userId,
      userName: applicant.name,
      phone: applicant.phone,
      gender: applicant.gender || '',
      age: applicant.age ? Number(applicant.age) : null,
      wxAvatarUrl: backendUser.avatarUrl || '',
      note: '小程序端投递'
    }
  }).then((application) => ({
    application,
    userInfo: backendUser
  })));
}

function fetchMessageHome(userInfo) {
  const openid = getMessageOpenid(userInfo);
  return request({
    url: '/api/wechat/messages',
    data: { openid }
  });
}

function fetchCustomerServiceMessages(userInfo) {
  const openid = getMessageOpenid(userInfo);
  return request({
    url: '/api/wechat/messages/customer-service',
    data: {
      openid,
      userId: userInfo && userInfo.userId,
      userName: getUserName(userInfo),
      avatarUrl: userInfo && userInfo.avatarUrl
    }
  }).then(data => {
    if (data && Array.isArray(data.messages)) {
      data.messages = data.messages.map(m => {
        if (m && m.avatarUrl) m.avatarUrl = getFullUrl(m.avatarUrl);
        return m;
      });
    }
    return data;
  });
}

function sendCustomerServiceMessage(userInfo, content) {
  const openid = getMessageOpenid(userInfo);
  return request({
    url: '/api/wechat/messages/customer-service',
    method: 'POST',
    data: {
      openid,
      userId: userInfo && userInfo.userId,
      userName: getUserName(userInfo),
      avatarUrl: userInfo && userInfo.avatarUrl,
      content
    }
  }).then(data => {
    if (data && Array.isArray(data.messages)) {
      data.messages = data.messages.map(m => {
        if (m && m.avatarUrl) m.avatarUrl = getFullUrl(m.avatarUrl);
        return m;
      });
    }
    return data;
  });
}

function getMessageOpenid(userInfo) {
  const info = userInfo || {};
  return info.openid || info.userId || wx.getStorageSync('messageOpenid') || createLocalOpenid();
}

function createLocalOpenid() {
  const openid = 'local_' + Date.now();
  wx.setStorageSync('messageOpenid', openid);
  return openid;
}

function getUserName(userInfo) {
  const info = userInfo || {};
  return info.nickName || info.nickname || '微信用户';
}

function markNotificationsRead(userInfo) {
  const openid = getMessageOpenid(userInfo);
  return request({
    url: '/api/wechat/messages/notifications/read',
    method: 'POST',
    data: { openid }
  });
}

function salaryUnit(salaryType) {
  if (salaryType === '周结') return '周';
  if (salaryType === '月结') return '月';
  return '天';
}

/**
 * 上传头像文件到后端
 * @param {string} filePath - chooseAvatar 返回的临时路径
 * @returns {Promise<string>} 永久访问URL
 */
function uploadAvatar(filePath) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: API_BASE + '/api/upload/avatar',
      filePath: filePath,
      name: 'file',
      success: (res) => {
        try {
          const data = JSON.parse(res.data);
          if (data.code === 0 && data.data && data.data.url) {
            // 只返回相对路径，显示时拼 API_BASE
            resolve(data.data.url);
          } else {
            reject(new Error(data.message || '上传失败'));
          }
        } catch (e) {
          reject(new Error('上传响应解析失败'));
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

module.exports = {
  API_BASE,
  getFullUrl,
  downloadImageToLocal,
  ensureBackendUser,
  fetchConvenience,
  fetchConvenienceDetail,
  fetchCustomerServiceMessages,
  fetchMessageHome,
  fetchPublishedJobs,
  normalizeJob,
  markNotificationsRead,
  phoneLogin,
  reportConvenience,
  request,
  sendCustomerServiceMessage,
  submitApplication,
  submitConvenience,
  syncWechatLogin,
  submitWechatJob,
  uploadAvatar,
  uploadImage
};
