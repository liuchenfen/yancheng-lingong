const JOB_CATEGORIES = [
  '搬运装卸',
  '餐饮服务',
  '促销导购',
  '保洁保安',
  '驾驶运输',
  '建筑工地',
  '家政月嫂'
];

const FILTER_CATEGORIES = ['全部'].concat(JOB_CATEGORIES);
const PUBLISH_CATEGORIES = JOB_CATEGORIES.concat(['其他']);
const CATEGORY_COLORS = ['#38BDF8', '#5AC8FA', '#34C3B4', '#5856D6', '#4CD964', '#5AC8FA', '#34C3B4'];
const CATEGORY_ICON_TYPES = ['cargo', 'food', 'shop', 'clean', 'drive', 'build', 'homecare'];
const CATEGORY_TONES = ['sky', 'cyan', 'mint', 'indigo', 'green', 'cyan', 'mint'];
const HOME_CATEGORIES = JOB_CATEGORIES.map((name, index) => ({
  id: index + 1,
  name,
  iconType: CATEGORY_ICON_TYPES[index],
  iconClass: 'icon-' + CATEGORY_ICON_TYPES[index],
  tone: CATEGORY_TONES[index],
  toneClass: 'tone-' + CATEGORY_TONES[index],
  color: CATEGORY_COLORS[index]
})).concat([{ id: JOB_CATEGORIES.length + 1, name: '更多职位', iconType: 'more', iconClass: 'icon-more', tone: 'gray', toneClass: 'tone-gray', color: '#8E8E93' }]);
const SALARY_OPTIONS = ['不限', '100-150', '150-200', '200-300', '300以上'];
const TIME_OPTIONS = ['不限', '今天', '明天', '本周', '下周'];
const SALARY_TYPES = ['日结', '周结', '月结'];
const CITY_OPTIONS = ['衡阳市', '衡南县', '衡山县', '衡东县', '祁东县', '常宁市', '耒阳市'];
const CONVENIENCE_CATEGORIES = ['商业宣传', '招聘求职', '房屋租售', '二手交易', '生活服务', '其他'];
const CONVENIENCE_AREAS = [
  '蒸湘区/全部',
  '雁峰区/全部',
  '珠晖区/全部',
  '石鼓区/全部',
  '南岳区/全部',
  '衡阳县/全部',
  '衡南县/全部',
  '衡山县/全部',
  '衡东县/全部',
  '祁东县/全部',
  '常宁市/全部',
  '耒阳市/全部'
];
const PHONE_REGEXP = /^1\d{10}$/;

function trimText(value) {
  return String(value || '').trim();
}

function trimFormValues(form, fields) {
  const result = Object.assign({}, form || {});
  const targetFields = fields || Object.keys(result);
  targetFields.forEach((field) => {
    if (typeof result[field] === 'string') {
      result[field] = result[field].trim();
    }
  });
  return result;
}

function isValidPhone(value) {
  return PHONE_REGEXP.test(trimText(value));
}

module.exports = {
  CITY_OPTIONS,
  CONVENIENCE_AREAS,
  CONVENIENCE_CATEGORIES,
  FILTER_CATEGORIES,
  HOME_CATEGORIES,
  JOB_CATEGORIES,
  PHONE_REGEXP,
  PUBLISH_CATEGORIES,
  SALARY_OPTIONS,
  SALARY_TYPES,
  TIME_OPTIONS,
  isValidPhone,
  trimFormValues,
  trimText
};
