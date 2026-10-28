const assert = require('assert');

const {
  DEFAULT_JOBS,
  createPublishedJob,
  filterJobs
} = require('../utils/jobs');
const {
  CITY_OPTIONS,
  FILTER_CATEGORIES,
  HOME_CATEGORIES,
  JOB_CATEGORIES,
  PUBLISH_CATEGORIES,
  SALARY_OPTIONS,
  SALARY_TYPES,
  TIME_OPTIONS,
  isValidPhone,
  trimFormValues
} = require('../utils/constants');

function names(list) {
  return list.map((item) => item.title);
}

function testKeywordAndCategoryFilter() {
  const result = filterJobs(DEFAULT_JOBS, {
    keyword: '服务员',
    category: '餐饮服务',
    salary: '不限',
    time: '不限'
  });

  assert.deepStrictEqual(names(result), ['餐厅服务员']);
}

function testSalaryFilterUsesDailyRangeOverlap() {
  const result = filterJobs(DEFAULT_JOBS, {
    keyword: '',
    category: '全部',
    salary: '300以上',
    time: '不限'
  });

  assert.deepStrictEqual(names(result), ['月嫂/育婴师', '货车司机']);
}

function testCreatePublishedJob() {
  const job = createPublishedJob(
    {
      jobTitle: '展会协助',
      category: '促销导购',
      salary: '180-220',
      salaryType: '日结',
      headcount: '6',
      workTime: '周末两天',
      location: '衡阳会展中心',
      description: '负责签到、指引和现场秩序维护',
      contactName: '陈经理',
      contactPhone: '13912345678'
    },
    DEFAULT_JOBS
  );

  assert.ok(job.id > 10);
  assert.strictEqual(job.title, '展会协助');
  assert.strictEqual(job.salary, '180-220元/天');
  assert.strictEqual(job.category, '促销导购');
  assert.deepStrictEqual(job.tags, ['日结', '促销导购', '新发布']);
  assert.strictEqual(job.phone, '13912345678');
  assert.strictEqual(job.source, 'local');
}

function testSharedOptionsStayConsistent() {
  assert.strictEqual(FILTER_CATEGORIES[0], '全部');
  assert.deepStrictEqual(FILTER_CATEGORIES.slice(1), JOB_CATEGORIES);
  assert.deepStrictEqual(PUBLISH_CATEGORIES.slice(0, JOB_CATEGORIES.length), JOB_CATEGORIES);
  assert.strictEqual(PUBLISH_CATEGORIES[PUBLISH_CATEGORIES.length - 1], '其他');
  assert.ok(CITY_OPTIONS.indexOf('衡阳市') >= 0);
  assert.ok(SALARY_OPTIONS.indexOf('300以上') >= 0);
  assert.ok(TIME_OPTIONS.indexOf('今天') >= 0);
  assert.deepStrictEqual(SALARY_TYPES, ['日结', '周结', '月结']);
  assert.strictEqual(HOME_CATEGORIES[0].name, JOB_CATEGORIES[0]);
  assert.strictEqual(HOME_CATEGORIES[HOME_CATEGORIES.length - 1].name, '更多职位');
}

function testPhoneValidationTrimsInput() {
  assert.strictEqual(isValidPhone(' 13912345678 '), true);
  assert.strictEqual(isValidPhone('23912345678'), false);
  assert.strictEqual(isValidPhone('1391234567'), false);
}

function testTrimFormValuesOnlyTrimsStrings() {
  const result = trimFormValues({ title: '  促销员 ', headcount: 3, phone: ' 13912345678 ' });
  assert.deepStrictEqual(result, { title: '促销员', headcount: 3, phone: '13912345678' });
}

testKeywordAndCategoryFilter();
testSalaryFilterUsesDailyRangeOverlap();
testCreatePublishedJob();
testSharedOptionsStayConsistent();
testPhoneValidationTrimsInput();
testTrimFormValuesOnlyTrimsStrings();

console.log('jobs tests ok');
