const PUBLISHED_JOBS_KEY = 'publishedJobs';
const REMOTE_JOBS_KEY = 'remoteJobs';
const COLLECTED_JOBS_KEY = 'collectedJobs';
const APPLIED_JOBS_KEY = 'appliedJobs';
const JOB_FILTER_KEY = 'jobFilter';

const { DEFAULT_JOBS } = require('./jobData');
const { trimText } = require('./constants');

function hasWxStorage() {
  return typeof wx !== 'undefined' && wx.getStorageSync && wx.setStorageSync;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function readArray(key) {
  if (!hasWxStorage()) return [];
  const value = wx.getStorageSync(key);
  return Array.isArray(value) ? value : [];
}

function writeArray(key, value) {
  if (hasWxStorage()) {
    wx.setStorageSync(key, value);
  }
}

function getJobs() {
  const remoteJobs = readArray(REMOTE_JOBS_KEY);
  if (remoteJobs.length) return clone(remoteJobs);
  const publishedJobs = readArray(PUBLISHED_JOBS_KEY);
  return clone(DEFAULT_JOBS).concat(publishedJobs);
}

function setRemoteJobs(jobs) {
  writeArray(REMOTE_JOBS_KEY, jobs || []);
}

function getJobById(id) {
  const jobId = Number(id);
  return getJobs().find((job) => Number(job.id) === jobId) || null;
}

function getUrgentJobs(limit) {
  return getJobs()
    .filter((job) => job.hot || job.tags.indexOf('急招') >= 0 || job.tags.indexOf('新发布') >= 0)
    .slice(0, limit || 4);
}

function normalizeKeyword(value) {
  return trimText(value).toLowerCase();
}

function parseSalaryRange(salary) {
  const nums = String(salary || '').match(/\d+/g);
  if (!nums || nums.length === 0) return { min: 0, max: 0 };
  const min = Number(nums[0]);
  const max = Number(nums[1] || nums[0]);
  return { min, max };
}

function matchesSalary(job, option) {
  if (!option || option === '不限') return true;
  const range = parseSalaryRange(job.salary);
  if (option === '300以上') return range.min >= 300;
  const target = parseSalaryRange(option);
  return range.max >= target.min && range.min <= target.max;
}

function matchesTime(job, option) {
  if (!option || option === '不限') return true;
  return job.timeOption === option;
}

function filterJobs(jobs, filters) {
  const current = filters || {};
  const keyword = normalizeKeyword(current.keyword);
  const category = current.category || '全部';

  return jobs.filter((job) => {
    const text = [
      job.title,
      job.company,
      job.location,
      job.displayLocation,
      job.category,
      (job.tags || []).join(' ')
    ].join(' ').toLowerCase();

    if (keyword && text.indexOf(keyword) < 0) return false;
    if (category && category !== '全部' && job.category !== category) return false;
    if (!matchesSalary(job, current.salary)) return false;
    if (!matchesTime(job, current.time)) return false;
    return true;
  });
}

function salaryUnit(salaryType) {
  if (salaryType === '周结') return '周';
  if (salaryType === '月结') return '月';
  return '天';
}

function nextJobId(existingJobs) {
  return existingJobs.reduce((max, job) => Math.max(max, Number(job.id) || 0), 0) + 1;
}

function createPublishedJob(form, existingJobs) {
  const salaryType = form.salaryType || '日结';
  const category = form.category || '其他';
  const title = trimText(form.jobTitle);
  const contactName = trimText(form.contactName) || '招聘负责人';
  const description = trimText(form.description) || '岗位信息已提交，欢迎符合条件的求职者联系咨询。';
  const salary = trimText(form.salary);

  return {
    id: nextJobId(existingJobs || DEFAULT_JOBS),
    title,
    company: contactName + '发布',
    salary: salary + '元/' + salaryUnit(salaryType),
    salaryType,
    location: trimText(form.location),
    displayLocation: trimText(form.location),
    tags: [salaryType, category, '新发布'],
    experience: '不限',
    education: '不限',
    workTime: trimText(form.workTime) || '时间面议',
    headcount: Number(form.headcount) || 1,
    contact: contactName,
    phone: trimText(form.contactPhone),
    description,
    postedTime: '刚刚',
    time: '刚刚',
    timeOption: '今天',
    views: 0,
    hot: true,
    category,
    source: 'local'
  };
}

function savePublishedJob(form) {
  const publishedJobs = readArray(PUBLISHED_JOBS_KEY);
  const job = createPublishedJob(form, getJobs());
  publishedJobs.unshift(job);
  writeArray(PUBLISHED_JOBS_KEY, publishedJobs);
  return job;
}

function getCollectedIds() {
  return readArray(COLLECTED_JOBS_KEY);
}

function isCollected(id) {
  return getCollectedIds().indexOf(Number(id)) >= 0;
}

function toggleCollected(id) {
  const jobId = Number(id);
  const ids = getCollectedIds();
  const index = ids.indexOf(jobId);
  if (index >= 0) {
    ids.splice(index, 1);
    writeArray(COLLECTED_JOBS_KEY, ids);
    return false;
  }
  ids.unshift(jobId);
  writeArray(COLLECTED_JOBS_KEY, ids);
  return true;
}

function getCollectedJobs() {
  const jobs = getJobs();
  return getCollectedIds()
    .map((id) => jobs.find((job) => Number(job.id) === Number(id)))
    .filter(Boolean);
}

function getApplications() {
  return readArray(APPLIED_JOBS_KEY);
}

function hasApplied(id) {
  return getApplications().some((item) => Number(item.jobId) === Number(id));
}

function addApplication(job, applicant) {
  const applications = getApplications();
  const jobId = Number(job.id);
  const existingIndex = applications.findIndex((item) => Number(item.jobId) === jobId);
  const record = {
    jobId,
    title: job.title,
    company: job.company,
    salary: job.salary,
    name: applicant.name,
    phone: applicant.phone,
    createdAt: Date.now(),
    status: '已投递'
  };

  if (existingIndex >= 0) {
    applications.splice(existingIndex, 1);
  }
  applications.unshift(record);
  writeArray(APPLIED_JOBS_KEY, applications);
  return record;
}

function getStats() {
  return {
    applied: getApplications().length,
    collected: getCollectedIds().length,
    viewed: getJobs().reduce((sum, job) => sum + (Number(job.views) || 0), 0)
  };
}

function setJobFilter(filter) {
  if (hasWxStorage()) {
    wx.setStorageSync(JOB_FILTER_KEY, filter || {});
  }
}

function takeJobFilter() {
  if (!hasWxStorage()) return {};
  const filter = wx.getStorageSync(JOB_FILTER_KEY) || {};
  wx.removeStorageSync(JOB_FILTER_KEY);
  return filter;
}

module.exports = {
  DEFAULT_JOBS,
  JOB_FILTER_KEY,
  addApplication,
  createPublishedJob,
  filterJobs,
  getApplications,
  getCollectedJobs,
  getJobById,
  getJobs,
  getStats,
  getUrgentJobs,
  hasApplied,
  isCollected,
  savePublishedJob,
  setJobFilter,
  setRemoteJobs,
  takeJobFilter,
  toggleCollected
};
