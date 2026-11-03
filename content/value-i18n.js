/**
 * Resume Auto Filler — Value i18n / Equivalence Layer
 *
 * 中文简历值 → 外资/英文表单选项 的等价映射层。
 *
 * 解决的问题：
 *   简历里存的是「本科」，Workday/Greenhouse 的下拉里只有 "Bachelor's Degree"；
 *   简历里是「男」，外资表单只有 "Male"；「中国」对应 "China / CN"。
 *   没有这层，setSelectValue 的字符串匹配必然失败 —— 字段认对了，值也填不进去。
 *
 * 同时提供姓名拆分（张三 → 姓:张 / 名:三；San Zhang → First:San / Last:Zhang），
 * 外资表单 First/Last Name 是两个框，不拆会把整名同时塞进两个框。
 *
 * Loaded before content.js via manifest content_scripts / build-eval.
 */
(function () {
  'use strict';
  if (window.__RF_I18N__) return;

  // ----------------------------------------------------------------
  // Normalisation
  // ----------------------------------------------------------------

  /** 比较用归一化：小写、去掉标点/空格/引号/连字符 → "Bachelor's Degree" == "bachelorsdegree" */
  function norm(s) {
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/[\u2018\u2019\u0060\u00b4]/g, '')
      .replace(/[\s\-_./\\()\[\]{}:：，,、·]+/g, '')
      .trim();
  }

  // ----------------------------------------------------------------
  // Equivalence groups — 同一组内的值互相等价（组与组之间不等价）
  // ----------------------------------------------------------------

  const GROUPS = {
    degree: [
      ['高中', '高中毕业', '普通高中', 'high school', 'high school diploma', 'high school graduate', 'secondary school'],
      ['中专', '中职', '中等专业学校', 'vocational school', 'technical secondary school'],
      ['大专', '专科', '高职', '大学专科', 'associate', "associate's degree", 'associates degree', 'associate degree', 'junior college'],
      ['本科', '学士', '大学本科', 'bachelor', "bachelor's degree", 'bachelors degree', 'bachelor degree', 'undergraduate', 'bsc'],
      ['硕士', '研究生', '硕士研究生', 'master', "master's degree", 'masters degree', 'master degree', 'postgraduate', 'msc'],
      ['博士', '博士研究生', 'doctor', 'doctorate', 'doctoral', 'doctoral degree', 'phd'],
      ['mba', '工商管理硕士'],
    ],
    gender: [
      ['男', '男性', 'male', 'man', 'masculine'],
      ['女', '女性', 'female', 'woman', 'feminine'],
    ],
    politicalStatus: [
      ['中共党员', '党员', '中国共产党党员', 'cpc member', 'communist party member', 'party member'],
      ['中共预备党员', '预备党员', 'probationary party member'],
      ['共青团员', '团员', 'league member', 'cylc member', 'communist youth league member'],
      ['群众', '普通群众', 'masses', 'ordinary citizen'],
      ['民主党派', '民主党派人士', 'democratic party member'],
      ['无党派人士', '无党派', 'non-party'],
    ],
    ethnicity: [
      ['汉族', '汉', 'han', 'han chinese'],
      ['回族', '回', 'hui'],
      ['满族', '满', 'manchu'],
      ['壮族', '壮', 'zhuang'],
      ['蒙古族', '蒙古', 'mongolian'],
      ['维吾尔族', '维吾尔', 'uyghur', 'uygur'],
      ['藏族', '藏', 'tibetan'],
      ['苗族', '苗', 'miao'],
      ['彝族', '彝', 'yi'],
      ['土家族', '土家', 'tujia'],
    ],
    maritalStatus: [
      ['未婚', 'single', 'never married', 'unmarried'],
      ['已婚', 'married'],
      ['离异', '离婚', 'divorced'],
      ['丧偶', 'widowed'],
    ],
    country: [
      ['中国', '中华人民共和国', 'china', 'cn', 'chn', "people's republic of china", 'prc', 'mainland china'],
      ['中国香港', '香港', 'hong kong'],
      ['中国澳门', '澳门', 'macau', 'macao'],
      ['中国台湾', '台湾', 'taiwan'],
      ['美国', 'united states', 'usa', 'united states of america'],
      ['英国', 'united kingdom', 'uk', 'great britain', 'britain'],
      ['日本', 'japan'],
      ['韩国', 'south korea', 'korea'],
      ['新加坡', 'singapore'],
      ['加拿大', 'canada'],
      ['澳大利亚', '澳洲', 'australia'],
      ['德国', 'germany'],
      ['法国', 'france'],
    ],
    nationality: [
      ['中国', 'china', 'chinese', 'cn', 'chn'],
      ['美国', 'united states', 'american', 'usa'],
      ['英国', 'united kingdom', 'british', 'uk'],
    ],
    yesNo: [
      ['是', '有', 'yes', 'true', 'agree'],
      ['否', '无', '没有', 'no', 'false', 'disagree'],
    ],
    workType: [
      ['全职', 'full-time', 'full time', 'fulltime'],
      ['兼职', 'part-time', 'part time', 'parttime'],
      ['实习', 'internship', 'intern', 'trainee'],
      ['合同工', 'contract', 'contractor'],
      ['劳务派遣', 'dispatch', 'agency'],
    ],
    englishLevel: [
      ['cet-4', 'cet4', '英语四级', '大学英语四级', '四级', 'college english test band 4'],
      ['cet-6', 'cet6', '英语六级', '大学英语六级', '六级', 'college english test band 6'],
      ['tem-4', 'tem4', '英语专业四级', '专业四级'],
      ['tem-8', 'tem8', '英语专业八级', '专业八级'],
      ['ielts', '雅思'],
      ['toefl', '托福'],
      ['toeic', '托业'],
    ],
    jobType: [
      ['应届生', '应届毕业生', 'fresh graduate', 'new graduate', 'graduate'],
      ['社会招聘', '社招', 'experienced', 'lateral'],
      ['校园招聘', '校招', 'campus recruitment'],
    ],
  };

  // norm(值) → 与该值**严格等价**的原样成员（只含它所在的那个分组）。
  // 不能把整个类别合并：本科 与 高中 都在 degree 下但不是一回事，
  // 合并会让「本科」去匹配下拉里的 "High School Diploma"。
  // 同一字面值出现在多个分组时（如「中国」既在国家也在国籍）才做并集。
  const LOOKUP = new Map();
  const mergePool = (key, pool) => {
    const k = norm(key);
    if (!k) return;
    const existing = LOOKUP.get(k);
    if (!existing) { LOOKUP.set(k, pool.slice()); return; }
    for (const v of pool) {
      if (!existing.some(e => norm(e) === norm(v))) existing.push(v);
    }
  };
  for (const members of Object.values(GROUPS)) {
    for (const group of members) {
      if (group.length < 2) continue;
      for (const raw of group) mergePool(raw, group);
    }
  }

  // ----------------------------------------------------------------
  // Month names (Month 下拉 / MM-YYYY 文本日期)
  // ----------------------------------------------------------------

  const MONTHS = [
    ['january', 'jan', '一月', '1月'],
    ['february', 'feb', '二月', '2月'],
    ['march', 'mar', '三月', '3月'],
    ['april', 'apr', '四月', '4月'],
    ['may', '五月', '5月'],
    ['june', 'jun', '六月', '6月'],
    ['july', 'jul', '七月', '7月'],
    ['august', 'aug', '八月', '8月'],
    ['september', 'sep', 'sept', '九月', '9月'],
    ['october', 'oct', '十月', '10月'],
    ['november', 'nov', '十一月', '11月'],
    ['december', 'dec', '十二月', '12月'],
  ];

  // ----------------------------------------------------------------
  // Provinces / municipalities (State/Province 下拉，外资表单常要英文)
  // ----------------------------------------------------------------

  const PROVINCES = [
    ['北京', '北京市', 'beijing'],
    ['天津', '天津市', 'tianjin'],
    ['上海', '上海市', 'shanghai'],
    ['重庆', '重庆市', 'chongqing'],
    ['河北', '河北省', 'hebei'],
    ['山西', '山西省', 'shanxi'],
    ['辽宁', '辽宁省', 'liaoning'],
    ['吉林', '吉林省', 'jilin'],
    ['黑龙江', '黑龙江省', 'heilongjiang'],
    ['江苏', '江苏省', 'jiangsu'],
    ['浙江', '浙江省', 'zhejiang'],
    ['安徽', '安徽省', 'anhui'],
    ['福建', '福建省', 'fujian'],
    ['江西', '江西省', 'jiangxi'],
    ['山东', '山东省', 'shandong'],
    ['河南', '河南省', 'henan'],
    ['湖北', '湖北省', 'hubei'],
    ['湖南', '湖南省', 'hunan'],
    ['广东', '广东省', 'guangdong'],
    ['海南', '海南省', 'hainan'],
    ['四川', '四川省', 'sichuan'],
    ['贵州', '贵州省', 'guizhou'],
    ['云南', '云南省', 'yunnan'],
    ['陕西', '陕西省', 'shaanxi'],
    ['甘肃', '甘肃省', 'gansu'],
    ['青海', '青海省', 'qinghai'],
    ['台湾', '台湾省', 'taiwan'],
    ['内蒙古', '内蒙古自治区', 'inner mongolia', 'nei mongol'],
    ['广西', '广西壮族自治区', 'guangxi'],
    ['西藏', '西藏自治区', 'tibet', 'xizang'],
    ['宁夏', '宁夏回族自治区', 'ningxia'],
    ['新疆', '新疆维吾尔自治区', 'xinjiang'],
    ['香港', '香港特别行政区', 'hong kong'],
    ['澳门', '澳门特别行政区', 'macau', 'macao'],
  ];
  PROVINCES.forEach(group => {
    for (const raw of group) mergePool(raw, group);
  });

  // ----------------------------------------------------------------
  // Public: candidate expansion
  // ----------------------------------------------------------------

  /**
   * 给定简历值，返回按优先级排列的候选字符串（原文第一）。
   * setSelectValue / setRadioValue 依次尝试，直到某个候选命中选项。
   */
  function candidates(value) {
    const out = [];
    const push = v => {
      const s = String(v == null ? '' : v);
      if (s.trim() !== '' && !out.some(o => norm(o) === norm(s))) out.push(s);
    };
    push(value);
    const key = norm(value);
    if (!key) return out;
    const pool = LOOKUP.get(key);
    if (!pool) return out;
    const isCjk = /[\u4e00-\u9fa5]/.test(String(value));
    // 原值第一（中文站点先命中中文选项），随后同文种优先
    const rest = pool.filter(g => norm(g) !== key).sort((a, b) => {
      const ac = /[\u4e00-\u9fa5]/.test(a) ? 0 : 1;
      const bc = /[\u4e00-\u9fa5]/.test(b) ? 0 : 1;
      if (ac !== bc) return isCjk ? ac - bc : bc - ac;
      return 0;
    });
    rest.forEach(push);
    return out;
  }


  // ----------------------------------------------------------------
  // Public: name splitting
  // ----------------------------------------------------------------

  const COMPOUND_SURNAMES = ['欧阳', '司马', '上官', '诸葛', '东方', '皇甫', '尉迟', '公孙', '慕容',
    '长孙', '宇文', '司徒', '令狐', '夏侯', '申屠', '太史', '端木', '南宫', '独孤', '轩辕',
    '百里', '呼延', '东郭', '西门', '第五', '梁丘', '左丘', '谷梁', '钟离'];

  /**
   * 拆分姓名。
   *   中文：姓在前（含复姓）→ 张三 = {first:'三', last:'张'}
   *   西文：姓在后 → 'San Zhang' = {first:'San', last:'Zhang'}
   *   单段西文（'Cher'）：first 给全名，last 留空
   * @returns {{first:string,last:string,middle:string,full:string,script:'cjk'|'latin'}}
   */
  function splitName(full) {
    const s = String(full == null ? '' : full).trim();
    if (!s) return { first: '', last: '', middle: '', full: '', script: 'latin' };

    if (/[\u4e00-\u9fa5]/.test(s)) {
      const clean = s.replace(/\s+/g, '');
      const compound = COMPOUND_SURNAMES.find(c => clean.startsWith(c) && clean.length > c.length);
      const sur = compound || clean.slice(0, 1);
      return { first: clean.slice(sur.length), last: sur, middle: '', full: s, script: 'cjk' };
    }

    const parts = s.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { first: parts[0], last: '', middle: '', full: s, script: 'latin' };
    if (parts.length === 2) return { first: parts[0], last: parts[1], middle: '', full: s, script: 'latin' };
    return {
      first: parts[0],
      last: parts[parts.length - 1],
      middle: parts.slice(1, -1).join(' '),
      full: s,
      script: 'latin',
    };
  }

  /** 取姓名某一部分；data 里显式给了 firstName/lastName 就以显式值为准 */
  function namePart(data, part) {
    if (!data) return '';
    const explicit = { first: data.firstName, last: data.lastName, middle: data.middleName };
    if (explicit[part]) return explicit[part];
    const split = splitName(data.nameEn || data.name || '');
    return split[part] || '';
  }

  // ----------------------------------------------------------------
  // Public: month / date helpers
  // ----------------------------------------------------------------

  /** "2019-09-01" → {y:'2019', m:'09', d:'01'} */
  function dateParts(value) {
    const m = String(value || '').match(/(\d{4})\D*(\d{1,2})?\D*(\d{1,2})?/);
    if (!m) return null;
    return {
      y: m[1],
      m: m[2] ? String(m[2]).padStart(2, '0') : '',
      d: m[3] ? String(m[3]).padStart(2, '0') : '',
    };
  }

  /** 月份候选：'09' → ['09','9','september','sep','sept','九月','9月'] */
  function monthCandidates(month) {
    const out = [String(month), String(parseInt(month, 10))];
    const idx = parseInt(month, 10) - 1;
    if (idx >= 0 && idx < 12) MONTHS[idx].forEach(v => { if (!out.includes(v)) out.push(v); });
    return out;
  }

  /**
   * 月份下拉识别：选项是否为 12 个月的月份选择器。
   * @returns {HTMLOptionElement[]|null} 命中返回有效选项数组
   */
  function isMonthSelect(select) {
    if (!select || select.tagName !== 'SELECT') return null;
    const opts = Array.from(select.options).filter(o => o.value !== '' || o.textContent.trim() !== '');
    if (opts.length < 12 || opts.length > 13) return null;
    const hits = opts.filter(o => {
      const n = norm(o.textContent);
      return MONTHS.some(g => g.some(v => norm(v) === n)) || /^(0?[1-9]|1[0-2])$/.test(o.textContent.trim());
    });
    return hits.length >= 12 ? opts : null;
  }

  window.__RF_I18N__ = {
    norm,
    candidates,
    namePart,
    dateParts,
    monthCandidates,
    isMonthSelect,
  };
})();
