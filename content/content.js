/**
 * Resume Auto Filler — Content Script v2
 *
 * Architecture:
 * 1. SITE ADAPTERS — site-specific rules for major job platforms
 * 2. WIDGET HANDLERS — interact with custom date pickers, dropdowns, etc.
 * 3. SMART MATCHER — multi-signal weighted scoring for unknown forms
 * 4. SECTION DETECTOR — understand form context (edu/work/project sections)
 * 5. MULTI-ENTRY FILLER — handle "add experience" buttons and fill multiple entries
 */
  (function() {
  'use strict';
  if (window.__resumeFillerV2) return;
  window.__resumeFillerV2 = true;

  const api = globalThis.browser || globalThis.chrome;

  // L0 site adapters + interaction primitives (loaded before this script)
  const ADAPTERS = window.__RF_ADAPTERS__ || null;
  const PRIM = window.__RF_PRIMITIVES__ || null;
  if (PRIM) {
    PRIM.injectHelpers({ setNative: (el, v) => setNativeInputValue(el, v), triggerEvents });
  }

  // ================================================================
  // SECTION 1: FIELD MATCHERS — keyword/exact/negative rules
  // ================================================================

  const AUTOCOMPLETE_MAP = {
    'name': 'name', 'given-name': 'name', 'family-name': 'name',
    'email': 'email', 'tel': 'phone', 'tel-national': 'phone',
    'street-address': 'address', 'address-line1': 'address',
    'address-level2': 'city', 'bday': 'birthday',
    'sex': 'gender', 'organization': 'company',
    'organization-title': 'jobTitle', 'url': 'website',
  };

  const FIELD_MATCHERS = {
    name: {
      kw: ['姓名','真实姓名','名字','your name','full name','real name'],
      ex: ['name','realname','fullname','truename','applicantname','candidatename','xm','userName'],
      neg: ['company','school','university','emergency','project','父','母','紧急','公司','学校','项目','家庭','担保','推荐','联系人'],
      w: 10
    },
    gender: {
      kw: ['性别','gender','sex'],
      ex: ['gender','sex','xb'],
      neg: [], w: 5
    },
    birthday: {
      kw: ['出生日期','生日','出生年月','出生','birthday','birth date','date of birth'],
      ex: ['birthday','birthdate','dob','dateofbirth','birth','csrq'],
      neg: [], w: 5
    },
    idCard: {
      kw: ['身份证','证件号','身份证号码','身份证号','证件号码','id card','id number','identity'],
      ex: ['idcard','idnumber','identitynumber','certificateno','sfzh','idNo','cardNo','zjhm'],
      neg: [], w: 8
    },
    phone: {
      kw: ['手机','电话','联系电话','手机号','联系方式','移动电话','phone','mobile','telephone','cell'],
      ex: ['phone','mobile','tel','telephone','cellphone','mobilephone','phonenum','phoneNo','sjhm','lxdh'],
      neg: ['emergency','紧急','fax','传真','area','区号','country','code','prefix'], w: 8
    },
    phoneCode: {
      kw: ['区号','国际区号','国家代码','手机区号','country code','area code','dial code','phone code','calling code'],
      ex: ['phonecode','areacode','countrycode','dialcode','phoneprefix','telcode','callingcode','phoneAreaCode','mobileAreaCode'],
      neg: ['邮编','zip','postal'], w: 6
    },
    email: {
      kw: ['邮箱','电子邮箱','电子邮件','email','e-mail'],
      ex: ['email','mail','emailaddress','userEmail','contactEmail','dzyx'],
      neg: [], w: 8
    },
    city: {
      kw: ['城市','所在城市','现居城市','工作城市','工作地点','所在地','city','location','current city'],
      ex: ['city','location','currentcity','workcity','livecity'],
      neg: ['birth','籍贯','hometown','职位','关键字','搜索','search','keyword','job','filter','筛选','服从','调剂','意向'], w: 4
    },
    address: {
      kw: ['地址','详细地址','居住地址','通讯地址','家庭地址','住址','address','street'],
      ex: ['address','addr','detailaddress','homeaddress','streetaddress'],
      neg: ['email','ip','mac','url'], w: 4
    },
    ethnicity: {
      kw: ['民族','ethnicity','ethnic'],
      ex: ['ethnicity','ethnic','minzu','mz'],
      neg: ['nationality','国籍'], w: 3
    },
    nationality: {
      kw: ['国籍','nationality','citizenship'],
      ex: ['nationality','citizenship','guoji'],
      neg: ['民族','ethnicity'], w: 3
    },
    politicalStatus: {
      kw: ['政治面貌','political'],
      ex: ['political','politicalstatus','zzmm'],
      neg: [], w: 3
    },
    maritalStatus: {
      kw: ['婚姻','婚姻状况','marital','marriage'],
      ex: ['marital','maritalstatus','hyzk'],
      neg: [], w: 3
    },
    degree: {
      kw: ['学历','最高学历','学位','教育程度','degree','education level','qualification'],
      ex: ['degree','education','qualification','xueli','educationlevel','highestdegree'],
      neg: [], w: 5
    },
    school: {
      kw: ['学校','院校','毕业院校','毕业学校','就读学校','school','university','college','institution'],
      ex: ['school','university','college','institution','schoolname','collegename'],
      neg: [], w: 5
    },
    major: {
      kw: ['专业','所学专业','major','specialty','field of study'],
      ex: ['major','specialty','subject','profession','discipline','majorname'],
      neg: [], w: 5
    },
    eduStartDate: {
      kw: ['入学时间','入学日期','教育开始','education start'],
      ex: ['edustartdate','enrolldate','educationstartdate','rxsj'],
      neg: [], w: 3
    },
    eduEndDate: {
      kw: ['毕业时间','毕业日期','教育结束','graduation date'],
      ex: ['eduenddate','graduatedate','graduationdate','bysj'],
      neg: [], w: 3
    },
    gpa: {
      kw: ['gpa','绩点','成绩','平均分','grade point'],
      ex: ['gpa','grade','score','gradepoint'],
      neg: [], w: 3
    },
    company: {
      kw: ['公司','单位','公司名称','工作单位','企业','雇主','company','employer','organization'],
      ex: ['company','employer','organization','companyname','corp','orgname','enterprise','gzdw'],
      neg: [], w: 5
    },
    jobTitle: {
      kw: ['职位','岗位','职务','头衔','position','job title','role','designation'],
      ex: ['jobtitle','position','title','role','positionname','designation','zw','gwmc'],
      neg: ['expected','期望','target','意向'], w: 5
    },
    workStartDate: {
      kw: ['入职时间','开始工作','参加工作','work start','employment start','开始时间'],
      ex: ['workstartdate','jobstartdate','hiredate','employmentstart','startdate'],
      neg: [], w: 3
    },
    workEndDate: {
      kw: ['离职时间','结束工作','work end','employment end','结束时间'],
      ex: ['workenddate','jobenddate','leavedate','employmentend','enddate'],
      neg: [], w: 3
    },
    jobDescription: {
      kw: ['工作描述','工作内容','职责','工作职责','岗位描述','job description','responsibility','duties'],
      ex: ['jobdescription','description','responsibility','workdesc','duties','jobdesc'],
      neg: ['self','自我','项目描述','projectdesc'], w: 4
    },
    expectedSalary: {
      kw: ['期望薪资','薪资','期望薪酬','期望工资','薪资要求','salary','compensation','expected salary'],
      ex: ['salary','expectedsalary','compensation','wage','xzqw'],
      neg: [], w: 4
    },
    expectedJob: {
      kw: ['期望职位','意向职位','求职意向','期望岗位','目标职位'],
      ex: ['expectedjob','expectedposition','targetjob','intention','desiredposition','qzyx'],
      neg: [], w: 4
    },
    workYears: {
      kw: ['工作年限','工作经验','经验年限','work years','years of experience'],
      ex: ['workyears','experience','yearsofexperience','expyears','gznx'],
      neg: [], w: 4
    },
    industry: {
      kw: ['行业','所在行业','industry','sector'],
      ex: ['industry','sector','trade','hangye'],
      neg: [], w: 3
    },
    skills: {
      kw: ['技能','特长','技能特长','专业技能','技术栈','skills','expertise','proficiency'],
      ex: ['skills','skill','expertise','speciality','proficiency','techstack','jntc'],
      neg: [], w: 4
    },
    selfEvaluation: {
      kw: ['自我评价','自我介绍','个人简介','个人描述','self evaluation','introduction','summary','about me'],
      ex: ['selfevaluation','introduction','summary','aboutme','selfdescription','bio','profile','selfintro','zwpj'],
      neg: [], w: 4
    },
    website: {
      kw: ['个人网站','网站','github','主页','website','homepage','blog','portfolio'],
      ex: ['website','homepage','blog','portfolio','github','personalsite','personalurl'],
      neg: [], w: 3
    },
    wechat: {
      kw: ['微信','微信号','wechat','weixin'],
      ex: ['wechat','weixin','wechatid','wxid','wxh'],
      neg: [], w: 3
    },
    qq: {
      kw: ['qq','qq号'],
      ex: ['qq','qqnumber','qqno'],
      neg: [], w: 3
    },
    linkedin: {
      kw: ['linkedin','领英'],
      ex: ['linkedin','linkedinurl'],
      neg: [], w: 3
    },
    emergencyContact: {
      kw: ['紧急联系人','紧急联系','emergency contact'],
      ex: ['emergencycontact','emergencyname'],
      neg: [], w: 3
    },
    emergencyPhone: {
      kw: ['紧急联系人电话','紧急电话','emergency phone'],
      ex: ['emergencyphone','emergencytel'],
      neg: [], w: 3
    },
    eduDescription: {
      kw: ['在校经历','教育描述','在校活动','校内经历','education description'],
      ex: ['edudescription','educationdesc','schoolexperience','campusexperience'],
      neg: [], w: 3
    },
    // Multi-entry fields (used for section detection)
    projectName: {
      kw: ['项目名称','项目名','project name','project title'],
      ex: ['projectname','projecttitle','xmmc'],
      neg: [], w: 5
    },
    projectRole: {
      kw: ['担任角色','项目角色','your role','role in project'],
      ex: ['projectrole','role','myrole'],
      neg: [], w: 3
    },
    projectDescription: {
      kw: ['项目描述','项目内容','project description','project detail'],
      ex: ['projectdescription','projectdesc','projectdetail','xmms'],
      neg: [], w: 4
    },
    projectLink: {
      kw: ['项目链接','项目地址','project link','project url','demo'],
      ex: ['projectlink','projecturl','demolink','repolink'],
      neg: [], w: 3
    },
    // Hometown / Hukou / Physical
    hometown: {
      kw: ['籍贯','家乡','出生地','生源地','生源所在地','hometown','birthplace','native place'],
      ex: ['hometown','birthplace','nativeplace','jiguan','jg','shengyuan'],
      neg: ['户口','现居','所在城市'], w: 3
    },
    hukou: {
      kw: ['户口','户口所在地','户籍','户籍所在地','hukou','registered residence'],
      ex: ['hukou','registeredresidence','hkszd','huji'],
      neg: ['籍贯'], w: 3
    },
    height: {
      kw: ['身高','height','stature'],
      ex: ['height','stature','shengao','sg'],
      neg: ['体重','weight'], w: 3
    },
    weight: {
      kw: ['体重','weight'],
      ex: ['weight','tizhong','tz'],
      neg: ['身高','height'], w: 3
    },
    // Language & Computer
    englishLevel: {
      kw: ['英语水平','英语等级','英语能力','english level','english proficiency','cet'],
      ex: ['englishlevel','englishproficiency','cetlevel','yyshuiping'],
      neg: [], w: 3
    },
    englishScore: {
      kw: ['英语成绩','英语分数','cet成绩','cet分数','english score','toefl','ielts'],
      ex: ['englishscore','cetscore','toefl','ielts','yychengji'],
      neg: [], w: 3
    },
    otherLanguage: {
      kw: ['其他语言','第二语言','小语种','other language','second language'],
      ex: ['otherlanguage','secondlanguage','qtyuyan'],
      neg: [], w: 3
    },
    computerLevel: {
      kw: ['计算机等级','计算机水平','计算机能力','computer level','ncre','计算机证书'],
      ex: ['computerlevel','ncre','jsjdj','computergrade'],
      neg: [], w: 3
    },
    // Competition / Award
    competitionName: {
      kw: ['竞赛名称','比赛名称','奖项名称','获奖名称','获奖项','获奖情况','奖项','competition','award name','contest','award'],
      ex: ['competitionname','awardname','contestname','jsmc','awarditem','hjx'],
      neg: [], w: 5
    },
    awardLevel: {
      kw: ['获奖等级','奖项级别','获奖级别','award level','prize level'],
      ex: ['awardlevel','prizelevel','hjdj'],
      neg: [], w: 3
    },
    awardDate: {
      kw: ['获奖时间','获奖日期','award date'],
      ex: ['awarddate','prizedate','hjsj'],
      neg: [], w: 3
    },
    awardIssuer: {
      kw: ['颁发机构','颁奖机构','授奖单位','issuing organization','awarded by'],
      ex: ['awardissuer','issuer','bfjg'],
      neg: [], w: 3
    },
    awardDescription: {
      kw: ['获奖描述','竞赛描述','奖项描述','award description'],
      ex: ['awarddescription','competitiondesc','jsdescription'],
      neg: [], w: 3
    },
    // Certificate
    certName: {
      kw: ['证书名称','资格证书','资质名称','certificate name','certification','license'],
      ex: ['certname','certificatename','certification','licensename','zsmc'],
      neg: [], w: 5
    },
    certDate: {
      kw: ['取证时间','发证日期','获证时间','certificate date','issue date'],
      ex: ['certdate','certificatedate','issuedate','fzrq'],
      neg: [], w: 3
    },
    certIssuer: {
      kw: ['发证机关','颁发单位','发证单位','certificate issuer','issuing authority'],
      ex: ['certissuer','issuingauthority','fzjg'],
      neg: [], w: 3
    },
    certNo: {
      kw: ['证书编号','证书号','certificate number','license number'],
      ex: ['certno','certificatenumber','licensenumber','zsbh'],
      neg: [], w: 3
    },
  };

  const FIELD_LABELS = {};
  const labelMap = {
    name:'姓名',gender:'性别',birthday:'出生日期',idCard:'身份证号',phone:'手机号',phoneCode:'区号',email:'邮箱',
    city:'城市',address:'地址',ethnicity:'民族',nationality:'国籍',politicalStatus:'政治面貌',
    maritalStatus:'婚姻状况',degree:'学历',school:'学校',major:'专业',eduStartDate:'入学时间',
    eduEndDate:'毕业时间',eduDescription:'在校经历',gpa:'GPA',company:'公司',jobTitle:'职位',workStartDate:'入职时间',
    workEndDate:'离职时间',jobDescription:'工作描述',expectedSalary:'期望薪资',expectedJob:'期望职位',
    workYears:'工作年限',industry:'行业',skills:'技能',selfEvaluation:'自我评价',website:'网站',
    wechat:'微信',qq:'QQ',linkedin:'LinkedIn',emergencyContact:'紧急联系人',emergencyPhone:'紧急联系电话',
    projectName:'项目名称',projectRole:'项目角色',projectDescription:'项目描述',projectLink:'项目链接',
    hometown:'籍贯',hukou:'户口所在地',height:'身高',weight:'体重',
    englishLevel:'英语水平',englishScore:'英语成绩',otherLanguage:'其他语言',computerLevel:'计算机等级',
    competitionName:'竞赛名称',awardLevel:'获奖等级',awardDate:'获奖时间',awardIssuer:'颁发机构',awardDescription:'获奖描述',
    certName:'证书名称',certDate:'取证时间',certIssuer:'发证机关',certNo:'证书编号',
  };
  Object.assign(FIELD_LABELS, labelMap);

  // ================================================================
  // SECTION 2: IDENTIFIER EXTRACTION
  // ================================================================

  function getIdentifiers(el) {
    const ids = [];
    const add = (text, source, weight) => {
      if (text && text.length > 0 && text.length < 100)
        ids.push({ t: text.toLowerCase().trim(), s: source, w: weight });
    };

    // Direct attributes
    ['name','id','placeholder','aria-label','autocomplete',
     'data-field','data-name','data-key','data-type','data-label',
     'ng-model','v-model','formcontrolname','data-testid','data-cy'
    ].forEach(attr => {
      const v = el.getAttribute(attr);
      if (v) add(v, 'attr', (attr === 'name' || attr === 'id') ? 3 : 2);
    });

    // CSS classes
    if (el.className && typeof el.className === 'string') {
      el.className.split(/\s+/).forEach(cls => {
        if (cls.length > 2 && cls.length < 40) add(cls, 'class', 0.8);
      });
    }

    // label[for]
    if (el.id) {
      try {
        const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
        if (lbl) add(lbl.textContent.trim(), 'label', 3);
      } catch(e) {}
    }

    // Wrapping <label>
    const wrapLabel = el.closest('label');
    if (wrapLabel) {
      const clone = wrapLabel.cloneNode(true);
      clone.querySelectorAll('input,select,textarea,button').forEach(c => c.remove());
      add(clone.textContent.trim(), 'label', 3);
    }

    // Siblings
    const sibTags = new Set(['LABEL','SPAN','DIV','TD','TH','DT','P','STRONG','EM','B','H4','H5','H6']);
    let prev = el.previousElementSibling;
    for (let i = 0; i < 3 && prev; i++, prev = prev.previousElementSibling) {
      if (sibTags.has(prev.tagName) && !prev.querySelector('input,select,textarea')) {
        add(prev.textContent.trim(), 'sibling', 2 - i * 0.3);
      }
    }

    // Parent label-like elements
    const formGroupSelectors = [
      'label', '.label', '.form-label', '.field-label',
      '.el-form-item__label', '.ant-form-item-label label',
      '.ant-form-item-label', '.ivu-form-item-label',
      '.layui-form-label', '.control-label', '.col-form-label',
      '.arco-form-item-label', '.t-form__label', '.n-form-item-label',
      // Common Chinese job site selectors
      '.item-label', '.form-title', '.label-text', '.field-name',
      // SPA recruitment platforms (Mokahr, Moka, etc.)
      '[class*="label"]', '[class*="Label"]', '[class*="title"]',
      '[class*="field-name"]', '[class*="fieldName"]',
    ].join(',');

    for (let p = el.parentElement, depth = 0; p && depth < 4; p = p.parentElement, depth++) {
      // Table layouts: the label comes from preceding cells of the SAME row
      // (handled below). Harvesting labels from the whole <tr>/<table> leaks
      // other rows' labels in and trips negative-keyword checks.
      if (p.tagName === 'TR' || p.tagName === 'TABLE' || p.tagName === 'TBODY' || p.tagName === 'THEAD') break;

      let lbls = [];
      try { lbls = Array.from(p.querySelectorAll(formGroupSelectors)); } catch (e) {}
      // Nested matches (a label element inside a label container) count once
      const top = lbls.filter(n => !lbls.some(o => o !== n && o.contains(n)));
      // A container holding MANY labels is a section, not this field's item —
      // only trust single-label containers beyond the immediate parent.
      if (!(depth >= 1 && top.length > 1)) {
        top.forEach(lbl => {
          if (!lbl.contains(el) && !lbl.querySelector('input,select,textarea')) {
            add(lbl.textContent.trim(), 'parent-label', 2.5 - depth * 0.3);
          }
        });
      }
      // Also check direct text of table cells
      if (p.tagName === 'TD' || p.tagName === 'TH') {
        const prevTd = p.previousElementSibling;
        if (prevTd && (prevTd.tagName === 'TD' || prevTd.tagName === 'TH')) {
          add(prevTd.textContent.trim(), 'table-label', 2.5);
        }
        // Row-level scan: legacy table-layout portals put the label in any
        // preceding text cell of the same <tr> (sometimes with colspan spacers)
        const tr = p.closest('tr');
        if (tr) {
          let cell = p, hops = 0;
          while (cell && hops < 4) {
            cell = cell.previousElementSibling;
            hops++;
            if (!cell || (cell.tagName !== 'TD' && cell.tagName !== 'TH')) continue;
            if (cell.querySelector('input,select,textarea')) break; // reached a control cell — stop
            const txt = cell.textContent.trim();
            if (txt && txt.length < 30) {
              add(txt.replace(/[*:\s]+$/, ''), 'table-label', 2.8);
              break; // nearest preceding text cell is the label
            }
          }
        }
      }
    }

    // Title/tooltip
    if (el.title) add(el.title, 'title', 1.5);

    return ids;
  }

  // ================================================================
  // SECTION 3: SCORING ENGINE
  // ================================================================

  function scoreField(el, identifiers, key, m) {
    let score = 0;

    for (const id of identifiers) {
      const text = id.t;
      const clean = text.replace(/[-_.\s]/g, '');

      // Negative check
      if (m.neg.length > 0 && m.neg.some(n => text.includes(n.toLowerCase()) || clean.includes(n.toLowerCase().replace(/[-_.\s]/g, '')))) {
        return -1;
      }

      // Exact match
      for (const e of m.ex) {
        if (clean === e.toLowerCase()) { score += 20 * id.w; break; }
        else if (clean.includes(e.toLowerCase()) && clean.length < e.length + 12) { score += 12 * id.w; }
      }

      // Keyword match
      for (const kw of m.kw) {
        const kwl = kw.toLowerCase();
        if (text.includes(kwl) || clean.includes(kwl.replace(/[-_.\s]/g, ''))) {
          score += 10 * id.w;
          break; // Only count best keyword match per identifier
        }
      }
    }

    // Autocomplete bonus
    const ac = el.getAttribute('autocomplete');
    if (ac && AUTOCOMPLETE_MAP[ac] === key) score += 30;

    // Input type bonus
    const typeMap = { email: 'email', tel: 'phone', url: 'website' };
    if (typeMap[el.type] === key) score += 5;

    return score;
  }

  function matchField(el) {
    const ids = getIdentifiers(el);
    if (ids.length === 0) return null;

    let bestKey = null, bestScore = 0;
    for (const [key, m] of Object.entries(FIELD_MATCHERS)) {
      const s = scoreField(el, ids, key, m);
      if (s > bestScore) { bestScore = s; bestKey = key; }
    }
    return bestScore >= 8 ? bestKey : null;
  }

  // ================================================================
  // SECTION 4: SECTION/CONTEXT DETECTOR
  // ================================================================

  const SECTION_KEYWORDS = {
    education: ['教育','学历','学校','院校','education','academic','school','学习经历'],
    work: ['工作','职业','公司','雇主','work','employment','career','job experience','工作经历','工作经验'],
    intern: ['实习','intern','internship','实习经历','实习经验'],
    project: ['项目','project','项目经历','项目经验'],
    competition: ['竞赛','获奖','荣誉','比赛','competition','award','honor','contest','prize'],
    certificate: ['证书','资质','资格','certification','certificate','license','qualification'],
    basic: ['基本','个人','基本信息','basic','personal','profile','个人信息'],
    skill: ['技能','skills','专业技能','技术能力'],
    other: ['其他','other','附加','additional'],
  };

  function detectSection(el) {
    let node = el;
    for (let i = 0; i < 12 && node; i++) {
      node = node.parentElement;
      if (!node) break;

      const sig = [node.className, node.id, node.getAttribute('data-section'),
                   node.getAttribute('aria-label'), node.getAttribute('data-v-')].filter(Boolean).join(' ').toLowerCase();

      // Check headings inside this container
      const heading = node.querySelector('h1,h2,h3,h4,h5,h6,.section-title,.title,.panel-title,.card-title,.block-title');
      const headingText = heading ? heading.textContent.trim().toLowerCase() : '';

      for (const [section, keywords] of Object.entries(SECTION_KEYWORDS)) {
        if (keywords.some(kw => sig.includes(kw) || headingText.includes(kw))) return section;
      }
    }
    return 'unknown';
  }

  // ================================================================
  // SECTION 5: CUSTOM WIDGET HANDLERS
  // ================================================================

  // Handle custom date pickers (Ant Design, Element UI, etc.)
  function handleCustomDatePicker(el, value) {
    // Try direct value setting first
    el.focus();
    el.click();

    // For readonly inputs that trigger a date picker popup
    if (el.readOnly) {
      el.click();
      // Wait for picker popup
      setTimeout(() => {
        // Try to find and interact with the popup
        const popups = document.querySelectorAll(
          '.ant-picker-dropdown, .el-date-picker, .el-picker-panel, ' +
          '.ivu-date-picker-dropdown, .arco-trigger-popup, .laydate-main, ' +
          '.vant-popup, .picker-popup, [class*="datepicker"], [class*="date-picker"]'
        );
        // If popup found, try to close it and set value via attribute
        if (popups.length > 0) {
          // Try to set via input event
          const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
          if (nativeSetter && nativeSetter.set) {
            nativeSetter.set.call(el, value);
          }
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));

          // Try to close picker
          document.body.click();
          const mask = document.querySelector('.ant-picker-dropdown, .el-picker-panel');
          if (mask) mask.style.display = 'none';
        }
      }, 100);
      return true;
    }

    return false;
  }

  // Handle custom select dropdowns (non-native)
  function handleCustomSelect(el, value) {
    // Detect custom select containers
    const customSelectors = [
      '.el-select', '.ant-select', '.ivu-select', '.arco-select',
      '.t-select', '.n-select', '.ant-cascader', '[class*="cascader"]',
      '[class*="custom-select"]', '[class*="dropdown"]',
      // SPA platforms (Mokahr, Moka, etc.)
      '[class*="Select"]', '[class*="select-container"]',
      '[class*="Picker"]', '[class*="picker-wrap"]',
      '[role="combobox"]', '[role="listbox"]',
    ];

    const container = el.closest(customSelectors.join(','));
    if (!container) return false;

    // Click to open dropdown
    const trigger = container.querySelector('input, .el-input__inner, .ant-select-selection-item, .ant-select-selection-search-input, .ant-cascader-input');
    if (trigger) {
      trigger.click();
      trigger.focus();

      // Type the value to filter
      if (trigger.tagName === 'INPUT') {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (nativeSetter && nativeSetter.set) nativeSetter.set.call(trigger, value);
        trigger.dispatchEvent(new Event('input', { bubbles: true }));
      }

      // Wait for dropdown options to appear
      setTimeout(() => {
        const normalize = s => s.replace(/[省市区县自治区自治州特别行政区地区盟旗]/g, '').trim();
        const normValue = normalize(value);
        const optionSelectors = [
          '.el-select-dropdown__item', '.ant-select-item-option',
          '.ivu-select-item', '.arco-select-option',
          '.ant-cascader-menu-item', '[class*="cascader-node"]',
          '[class*="option"]', '[role="option"]', '[class*="Option"]',
          '[class*="menu-item"]', '[class*="MenuItem"]', 'li',
        ];

        const dropdown = document.querySelector(
          '.el-select-dropdown, .ant-select-dropdown, .ivu-select-dropdown, ' +
          '.arco-trigger-popup, .ant-cascader-dropdown, .ant-cascader-menus, ' +
          '[class*="dropdown-menu"], [class*="cascader-menu"], ' +
          '[class*="Dropdown"], [class*="Popup"], [class*="popup"], ' +
          '[role="listbox"], [class*="select-menu"], [class*="SelectMenu"]'
        );

        if (dropdown) {
          const options = dropdown.querySelectorAll(optionSelectors.join(','));
          for (const opt of options) {
            const optText = opt.textContent.trim();
            const normOpt = normalize(optText);
            if (optText === value || optText.includes(value) || value.includes(optText) ||
                (normOpt && normValue && (normOpt === normValue || normOpt.includes(normValue) || normValue.includes(normOpt)))) {
              opt.click();
              // For cascading: if this opens a sub-menu, try to match next level
              const parts = value.split(/[省市区\/\-]/).filter(Boolean);
              if (parts.length > 1) {
                setTimeout(() => clickCascaderLevel(parts.slice(1), 0), 300);
              }
              return;
            }
          }
        }
      }, 200);

      return true;
    }
    return false;
  }

  // Click through cascader levels (province → city → district)
  function clickCascaderLevel(remainingParts, attempt) {
    if (!remainingParts.length || attempt > 5) return;
    const normalize = s => s.replace(/[省市区县自治区自治州特别行政区地区盟旗]/g, '').trim();
    const target = normalize(remainingParts[0]);
    const menus = document.querySelectorAll(
      '.ant-cascader-menu, .el-cascader-menu, [class*="cascader-menu"]'
    );
    // Find the last (rightmost) menu panel
    const lastMenu = menus[menus.length - 1];
    if (!lastMenu) return;
    const items = lastMenu.querySelectorAll('li, [class*="cascader-node"], [class*="menu-item"]');
    for (const item of items) {
      const t = normalize(item.textContent.trim());
      if (t === target || t.includes(target) || target.includes(t)) {
        item.click();
        if (remainingParts.length > 1) {
          setTimeout(() => clickCascaderLevel(remainingParts.slice(1), 0), 300);
        }
        return;
      }
    }
  }

  // ================================================================
  // SECTION 6: VALUE SETTING (framework-compatible)
  // ================================================================

  /**
   * Get React internal props from a DOM element (works for React 15-18+).
   * React attaches __reactProps$xxx or __reactEventHandlers$xxx to DOM nodes.
   */
  function getReactProps(el) {
    for (const key of Object.keys(el)) {
      if (key.startsWith('__reactProps$') || key.startsWith('__reactEventHandlers$')) {
        return el[key];
      }
    }
    return null;
  }

  /**
   * Framework-compatible value setter.
   * Strategy 1: React internal onChange — directly call React's onChange handler
   * Strategy 2: execCommand('insertText') — simulates real user typing
   * Strategy 3: native setter + _valueTracker reset + synthetic events
   */
  function setNativeInputValue(el, value) {
    const tag = el.tagName.toLowerCase();
    const nativeSetters = {
      input: Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value'),
      textarea: Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value'),
    };

    // Strategy 1: React internal — find and call onChange directly to update React state
    const reactProps = getReactProps(el);
    if (reactProps && reactProps.onChange) {
      try {
        const setter = nativeSetters[tag];
        if (setter && setter.set) setter.set.call(el, value);
        else el.value = value;
        // Call React's onChange with a synthetic-like event object
        reactProps.onChange({
          target: el,
          currentTarget: el,
          type: 'change',
          bubbles: true,
          preventDefault: () => {},
          stopPropagation: () => {},
          nativeEvent: new Event('change', { bubbles: true }),
        });
        el.dispatchEvent(new Event('blur', { bubbles: true }));
        // Verify value actually stuck — if not, fall through to next strategy
        if (el.value === value) return true;
      } catch (e) { /* fall through */ }
    }

    // Strategy 2: execCommand — simulates real user typing
    if ((tag === 'input' || tag === 'textarea') && !['checkbox','radio','date','month','datetime-local','file'].includes(el.type)) {
      try {
        el.focus();
        if (el.value) {
          el.select();
          document.execCommand('delete', false);
        }
        const ok = document.execCommand('insertText', false, value);
        if (ok && el.value === value) {
          el.dispatchEvent(new Event('change', { bubbles: true }));
          el.dispatchEvent(new Event('blur', { bubbles: true }));
          return true;
        }
      } catch (e) { /* fall through */ }
    }

    // Strategy 3: native setter + _valueTracker reset (broadest fallback)
    const setter = nativeSetters[tag];
    const tracker = el._valueTracker;
    if (tracker) tracker.setValue('');
    if (setter && setter.set) {
      setter.set.call(el, value);
    } else {
      el.value = value;
    }
    el.dispatchEvent(new Event('focus', { bubbles: true }));
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur', { bubbles: true }));
    return el.value === value;
  }

  // Backward-compatible wrapper for cases that only need event dispatch (select, checkbox)
  function triggerEvents(el) {
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setSelectValue(el, value) {
    const opts = Array.from(el.options);
    // Normalize: strip trailing 省/市/区/县/自治区 etc. for flexible matching
    const normalize = s => s.replace(/[省市区县自治区自治州特别行政区地区盟旗]/g, '').trim();
    const normVal = normalize(value);

    const match = opts.find(o => o.value === value) ||
                  opts.find(o => o.textContent.trim() === value) ||
                  opts.find(o => o.value && value.includes(o.value) && o.value !== '') ||
                  opts.find(o => { const t = o.textContent.trim(); return t && (value.includes(t) || t.includes(value)) && t !== ''; }) ||
                  // Fuzzy: strip province/city suffixes for matching (e.g. "湖南省" matches "湖南")
                  opts.find(o => { const t = normalize(o.textContent.trim()); return t && normVal && (t === normVal || normVal.includes(t) || t.includes(normVal)) && t !== ''; });
    if (match) {
      el.value = match.value;
      triggerEvents(el);
      // For cascading selects (province→city→district), trigger change and wait for next level
      handleCascadeNext(el, value);
      return true;
    }
    // Try custom select handler
    return handleCustomSelect(el, value);
  }

  // Handle cascading select chains (province → city → district)
  function handleCascadeNext(el, fullValue) {
    // If the value contains multiple levels separated by common delimiters
    const parts = fullValue.split(/[省市区\/\-]/).filter(Boolean);
    if (parts.length <= 1) return;

    // Wait for cascading selects to populate after change event
    setTimeout(() => {
      const container = el.closest('.form-group, .form-item, .el-form-item, .ant-form-item, tr, .form-row, [class*="cascad"]') ||
                        el.parentElement?.parentElement;
      if (!container) return;
      const selects = container.querySelectorAll('select');
      const customSelects = container.querySelectorAll('.el-select, .ant-select, .ant-cascader, [class*="cascad"]');

      // Find the next sibling select and try to set it
      const allSelects = Array.from(selects);
      const myIdx = allSelects.indexOf(el);
      if (myIdx >= 0 && myIdx + 1 < allSelects.length && parts.length > 1) {
        const nextSelect = allSelects[myIdx + 1];
        setTimeout(() => setSelectValue(nextSelect, parts.slice(1).join('')), 300);
      }
    }, 300);
  }

  function setRadioValue(radios, value) {
    for (const r of radios) {
      const label = r.parentElement ? r.parentElement.textContent.trim() : '';
      if (r.value === value || label.includes(value) || value.includes(label) || value.includes(r.value)) {
        r.checked = true;
        r.dispatchEvent(new Event('change', { bubbles: true }));
        r.dispatchEvent(new Event('click', { bubbles: true }));
        return true;
      }
    }
    return false;
  }

  // Check if a value means "present / current / 至今"
  function isPresentValue(v) {
    return /^(至今|present|current|currently|now|在职|目前|-)$/i.test(v.trim());
  }

  // Handle "至今" for date fields: find nearby checkbox/radio/select and check it
  function handlePresentDate(el) {
    const container = el.closest(
      '.form-group, .form-item, .el-form-item, .ant-form-item, .form-row, tr, td, ' +
      '[class*="date"], [class*="period"], [class*="range"]'
    ) || el.parentElement;
    if (!container) return false;

    // Strategy 1: Look for a "至今" checkbox nearby
    const checkboxes = container.querySelectorAll('input[type="checkbox"]');
    for (const cb of checkboxes) {
      const label = cb.parentElement ? cb.parentElement.textContent.trim() : '';
      if (/至今|present|current|在职|目前/.test(label)) {
        if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); cb.dispatchEvent(new Event('click', { bubbles: true })); }
        return true;
      }
    }

    // Also search in the parent's parent (wider scope)
    const wider = container.parentElement;
    if (wider) {
      const widerCbs = wider.querySelectorAll('input[type="checkbox"]');
      for (const cb of widerCbs) {
        const label = cb.parentElement ? cb.parentElement.textContent.trim() : '';
        if (/至今|present|current|在职|目前/.test(label)) {
          if (!cb.checked) { cb.checked = true; cb.dispatchEvent(new Event('change', { bubbles: true })); cb.dispatchEvent(new Event('click', { bubbles: true })); }
          return true;
        }
      }
    }

    // Strategy 2: Look for a nearby select with "至今" option
    const selects = (wider || container).querySelectorAll('select');
    for (const sel of selects) {
      const opt = Array.from(sel.options).find(o => /至今|present|current/.test(o.textContent.trim()));
      if (opt) { sel.value = opt.value; triggerEvents(sel); return true; }
    }

    // Strategy 3: If it's a text input (not date type), just type "至今"
    if (el.type === 'text' || el.type === '') {
      setNativeInputValue(el, '至今');
      return true;
    }

    // Strategy 4: Clear the date field (leave empty) — can't type "至今" into date input
    return false;
  }

  function setFieldValue(el, value) {
    if (!value) return false;
    const tag = el.tagName.toLowerCase();

    // Rich-text editors (UEditor / wangEditor / KindEditor) — 央国企"自我评价"常见
    if (PRIM && PRIM.isRichText(el) && PRIM.fillRichText(el, value)) return true;

    if (el.isContentEditable) {
      el.focus();
      el.textContent = value;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }

    // Legacy JS date pickers (WdatePicker / My97 / laydate / jeDate)
    if (PRIM && PRIM.isLegacyDatePicker(el)) {
      if (isPresentValue(value)) return handlePresentDate(el);
      if (PRIM.fillLegacyDate(el, value)) return true;
    }

    if (tag === 'select') return setSelectValue(el, value);
    if (tag === 'input' && el.type === 'radio') return false; // handled separately
    if (tag === 'input' && ['file','submit','button','reset','image','hidden'].includes(el.type)) return false;

    if (tag === 'input' && el.type === 'checkbox') {
      const shouldCheck = ['是','有','yes','true','1'].includes(value.toLowerCase());
      if (el.checked !== shouldCheck) { el.checked = shouldCheck; triggerEvents(el); }
      return true;
    }

    // Date inputs — handle "至今" specially
    if (tag === 'input' && (el.type === 'date' || el.type === 'month' || el.type === 'datetime-local')) {
      if (isPresentValue(value)) {
        return handlePresentDate(el);
      }
      const val = el.type === 'month' ? value.substring(0, 7) : value;
      setNativeInputValue(el, val);
      return true;
    }

    // Readonly inputs might be custom pickers
    if (el.readOnly) {
      return handleCustomDatePicker(el, value);
    }

    // Standard text/textarea — use setNativeInputValue for React/Vue/Angular compatibility
    const ok = setNativeInputValue(el, value);
    if (!ok) { el.setAttribute('value', value); } // HTML attribute fallback

    // Legacy portals: fire inline onchange chains (__doPostBack) after setting
    const postback = (_activeAdapters || []).some(a => a.postback);
    if (PRIM) PRIM.afterSetValue(el, { postback });

    return true;
  }

  // Async select wrapper: retries while lazy options load (focus-triggered)
  async function setFieldValueAsync(el, value) {
    if (!value) return false;
    if (el.tagName === 'SELECT' && PRIM) {
      const r = await PRIM.withSelectRetry(el, () => setSelectValue(el, value));
      return !!r;
    }
    return setFieldValue(el, value);
  }

  // ================================================================
  // SECTION 7: "ADD MORE" — reveal entry forms (inline card or modal dialog)
  // ================================================================

  function findAddButton(sectionEl, sectionType, strict) {
    const keywords = {
      education: ['添加教育','新增教育','添加学历','add education','新增'],
      work: ['添加工作','新增工作','添加实习','add work','add experience','add internship','新增','添加经历'],
      intern: ['添加实习','新增实习','add intern','add internship','新增'],
      project: ['添加项目','新增项目','add project','新增'],
      competition: ['添加竞赛','新增竞赛','添加获奖','添加荣誉','获奖情况','add competition','add award','新增'],
      certificate: ['添加证书','新增证书','添加资质','add certificate','add certification','新增'],
    };

    let kws = keywords[sectionType] || ['添加', '新增', 'add', '+ '];
    if (strict) {
      // Without a section root we only trust section-specific wording — a bare
      // "新增" anywhere on the page could belong to 家庭成员/奖惩 etc.
      kws = kws.filter(k => !['新增', '添加', 'add', '+ '].includes(k));
    }

    const searchRoot = sectionEl || document.body;
    const buttons = searchRoot.querySelectorAll(
      'button, a, .btn, [role="button"], .ant-btn, .el-button, [class*="add"], [class*="new"]'
    );

    for (const btn of buttons) {
      if (!isVisible(btn)) continue;
      // A real link to another page would navigate away mid-fill — never click those
      if (btn.tagName === 'A') {
        const href = btn.getAttribute('href') || '';
        if (href && !href.startsWith('#') && !href.startsWith('javascript')) continue;
      }
      const text = btn.textContent.trim().toLowerCase();
      const title = (btn.getAttribute('title') || '').toLowerCase();
      const cls = (btn.className || '').toLowerCase();

      if (kws.some(kw => text.includes(kw) || title.includes(kw) || cls.includes(kw))) {
        return btn;
      }
      // Plus-icon buttons (no text) inside a scoped section
      if (!strict && !text && /(btn|button|icon).*(plus|add)|(add|plus).*(btn|icon)|(^|[-_ ])(add|plus)([-_ ]|$)/.test(cls)) {
        return btn;
      }
    }
    return null;
  }

  /** Locate the container of a section by its heading (教育经历/实习经历/...) */
  function findSectionRoot(sectionType) {
    const kws = SECTION_KEYWORDS[sectionType] || [];
    const heads = document.querySelectorAll(
      'h1,h2,h3,h4,h5,h6,.section-title,.panel-title,.card-title,.block-title,[class*="section-title"]'
    );
    for (const h of heads) {
      const t = h.textContent.trim().toLowerCase();
      if (t && t.length < 30 && kws.some(k => t.includes(k.toLowerCase()))) {
        // start from the heading's parent — the heading itself (often
        // class="section-title") must not become the search root
        const base = h.parentElement || h;
        return base.closest('[class*="section"], [class*="block"], [class*="panel"], .card, form, fieldset, div, table') || base;
      }
    }
    return null;
  }

  /** Add button for a section: scoped to its heading container when found */
  function findSectionAddButton(sectionType) {
    const root = findSectionRoot(sectionType);
    if (root) return findAddButton(root, sectionType, false);
    return findAddButton(document.body, sectionType, true);
  }

  // ---- Modal / dialog machinery ----

  function findDialogRoots() {
    return Array.from(document.querySelectorAll(
      '.ant-modal, .el-dialog, .ivu-modal, .arco-modal, .arco-drawer, .ant-drawer, .el-drawer, ' +
      '[role="dialog"], [role="alertdialog"], .modal, .modal-dialog, ' +
      '[class*="modal-box"], [class*="Modal-"], [class*="Dialog"], [class*="dialog-box"], [class*="Drawer"]'
    )).filter(isVisible);
  }

  /**
   * After clicking "新增", wait for the entry form to appear.
   * Returns { dialog } when a modal containing form fields opened, or
   * { newEls } for inline forms. null on timeout.
   */
  async function waitForReveal(sectionBeforeCount, beforeSet, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await sleep(200);
      const dlg = findDialogRoots().find(d =>
        d.querySelector('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea, [contenteditable="true"]'));
      if (dlg) return { dialog: dlg };

      const els = getAllFormElements();
      const sectionNow = els.filter(el => {
        const sec = detectSection(el);
        return sectionMatcher(sec);
      });
      const newEls = els.filter(el => !beforeSet.has(el));
      if (sectionNow.length > sectionBeforeCount || newEls.length > 0) {
        return { newEls };
      }
    }
    return null;
  }

  // bound per-call via withSectionPredicate (detectSection target can be work/intern)
  let _revealSectionTest = () => false;
  function sectionMatcher(sec) { return _revealSectionTest(sec); }

  /** Confirm (确定/保存) button INSIDE a dialog we opened ourselves */
  function findDialogConfirm(dialog) {
    const NEG = /取消|关闭|close|cancel|上一步|下一步|next|prev|返回/i;
    const POS = /^(确\s*定|保\s*存|确\s*认|添\s*加|应\s*用|完\s*成|ok|save|add|confirm|submit)$/i;
    const scopes = [
      dialog.querySelector('.ant-modal-footer, .el-dialog__footer, .arco-modal-footer, .modal-footer, [class*="footer"], [class*="Footer"]'),
      dialog,
    ].filter(Boolean);
    for (const scope of scopes) {
      const btns = scope.querySelectorAll('button, .btn, a, [role="button"], [class*="btn"], [class*="button"]');
      let plain = null;
      for (const b of btns) {
        if (!isVisible(b)) continue;
        const t = (b.textContent || '').trim();
        if (!t || t.length > 8 || NEG.test(t) || !POS.test(t)) continue;
        const cls = String(b.className || '');
        if (/primary|--primary|btn-confirm|btn-ok|confirm/i.test(cls)) return b;
        if (!plain) plain = b;
      }
      if (plain) return plain;
    }
    return null;
  }

  async function commitDialog(dialog) {
    const btn = findDialogConfirm(dialog);
    if (!btn) return false;
    try { btn.click(); } catch (e) { return false; }
    return true;
  }

  async function waitForDialogClose(dialog, timeout = 3000) {
    const deadline = Date.now() + timeout;
    while (Date.now() < deadline) {
      await sleep(150);
      if (!dialog.isConnected || !isVisible(dialog)) return true;
    }
    return false;
  }

  /** Fill one entry's fields inside a container (inline block or dialog) */
  async function fillEntryFields(root, fmap, entry, scopeEls) {
    let count = 0;
    let els;
    if (scopeEls && scopeEls.length) {
      els = scopeEls.filter(el => el.isConnected);
    } else if (root) {
      els = Array.from(root.querySelectorAll('input, select, textarea, [contenteditable="true"]'))
        .filter(el => el.type !== 'hidden' && el.type !== 'submit' && el.type !== 'button' && isVisible(el));
    } else {
      return 0;
    }
    for (const [entryField, matcherKey] of Object.entries(fmap)) {
      if (!matcherKey || !entry[entryField]) continue;
      for (const el of els) {
        if (matchField(el) === matcherKey) {
          if (await setFieldValueAsync(el, entry[entryField])) {
            highlightField(el);
            _reportFilled(el, matcherKey, 'ok');
            count++;
          }
          break;
        }
      }
    }
    return count;
  }

  // ================================================================
  // SECTION 8: VISUAL FEEDBACK
  // ================================================================

  function highlightField(el, tier) {
    const isLLM = tier === 'llm'; // amber = LLM-mapped, lower confidence → user should double-check
    const color = isLLM ? '#f59e0b' : '#34a853';
    const orig = { boxShadow: el.style.boxShadow, borderColor: el.style.borderColor, transition: el.style.transition };
    el.style.transition = 'all 0.3s ease';
    el.style.boxShadow = `0 0 0 3px ${isLLM ? 'rgba(245, 158, 11, 0.25)' : 'rgba(52, 168, 83, 0.25)'}`;
    el.style.borderColor = color;
    setTimeout(() => {
      el.style.transition = 'all 0.5s ease';
      el.style.boxShadow = orig.boxShadow;
      el.style.borderColor = orig.borderColor;
    }, isLLM ? 6000 : 2000);
  }

  function showBadge(count, label) {
    const existing = document.getElementById('__rf-badge');
    if (existing) existing.remove();

    if (!document.getElementById('__rf-style')) {
      const s = document.createElement('style');
      s.id = '__rf-style';
      s.textContent = `
        @keyframes __rfIn { from { opacity:0; transform:translateY(-10px) } to { opacity:1; transform:none } }
        @keyframes __rfOut { from { opacity:1 } to { opacity:0; transform:translateY(-10px) } }
      `;
      document.head.appendChild(s);
    }

    const badge = document.createElement('div');
    badge.id = '__rf-badge';
    badge.innerHTML = `<span style="font-size:20px;margin-right:6px">&#10003;</span> ${label || '已填写'} ${count} 个字段`;
    badge.style.cssText = `
      position:fixed;top:20px;right:20px;z-index:2147483647;
      background:linear-gradient(135deg,#34a853,#2d8f47);color:#fff;
      padding:12px 24px;border-radius:12px;font:600 14px/-apple-system,sans-serif;
      box-shadow:0 4px 20px rgba(52,168,83,0.3);animation:__rfIn .3s ease;
      display:flex;align-items:center;pointer-events:none;
    `;
    document.body.appendChild(badge);
    setTimeout(() => {
      badge.style.animation = '__rfOut .3s ease forwards';
      setTimeout(() => badge.remove(), 300);
    }, 2500);
  }

  // ================================================================
  // SECTION 9: ELEMENT COLLECTION
  // ================================================================

  function isVisible(el) {
    if (!el.offsetParent && getComputedStyle(el).position !== 'fixed' && getComputedStyle(el).position !== 'sticky') return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden';
  }

  /**
   * Check if an input is a search/filter input inside a custom dropdown/select component.
   * These should be skipped — they're not real form fields.
   */
  function isDropdownSearchInput(el) {
    if (el.tagName !== 'INPUT') return false;
    // Check if inside a custom select/dropdown container
    const dropdownParent = el.closest(
      '[class*="Select-container"], [class*="Dropdown-container"], [class*="select-container"], ' +
      '[class*="dropdown-container"], [class*="Picker-container"], [class*="picker-container"], ' +
      '[role="combobox"], [role="listbox"]'
    );
    if (!dropdownParent) return false;
    // If the input has addon class or is inside a select-like component, it's a dropdown search input
    const cls = el.className || '';
    if (/addon|has-addon/i.test(cls)) return true;
    // If the parent is a select container and input has no meaningful placeholder, likely a search input
    if (!el.placeholder || el.placeholder === '') return true;
    return false;
  }

  /**
   * Check if an input is a site search/filter bar (not a form field to fill).
   */
  function isSiteSearchInput(el) {
    if (el.tagName !== 'INPUT') return false;
    const ph = (el.placeholder || '').toLowerCase();
    const cls = (el.className || '') + ' ' + (el.getAttribute('role') || '');
    // Search bars: placeholder contains search/filter keywords
    if (/搜索|search|filter|筛选|关键字|keyword|查找/.test(ph)) return true;
    // Role="search" or inside a search container
    if (el.getAttribute('role') === 'search' || el.closest('[role="search"], [class*="search-bar"], [class*="SearchBar"], [class*="search-input"], [class*="SearchInput"], nav')) return true;
    return false;
  }

  /** querySelectorAll that pierces open shadow roots (web-component ATS portals) */
  function deepQueryAll(selector, root) {
    root = root || document;
    const out = [];
    const walk = (node) => {
      try { node.querySelectorAll(selector).forEach(el => out.push(el)); } catch (e) {}
      try {
        node.querySelectorAll('*').forEach(el => { if (el.shadowRoot) walk(el.shadowRoot); });
      } catch (e) {}
    };
    walk(root);
    return out;
  }

  function getAllFormElements() {
    const els = [];
    const seen = new WeakSet();

    // Standard form elements (skip dropdown search inputs and site search bars)
    deepQueryAll('input, select, textarea').forEach(el => {
      if (el.type !== 'hidden' && !el.disabled && isVisible(el) && !isDropdownSearchInput(el) && !isSiteSearchInput(el)) { els.push(el); seen.add(el); }
    });

    // contenteditable in form context
    deepQueryAll('[contenteditable="true"]').forEach(el => {
      if (!seen.has(el) && isVisible(el) && el.closest('form, [class*="form"], [class*="edit"]')) { els.push(el); seen.add(el); }
    });

    // SPA custom components: div/span acting as inputs (Mokahr, custom React/Vue)
    deepQueryAll(
      '[role="textbox"], [role="combobox"], [role="listbox"], [role="spinbutton"], ' +
      '[class*="input-wrap"] input, [class*="select-wrap"] input, ' +
      '[class*="field-input"] input, [class*="form-input"] input, ' +
      '[class*="formItem"] input, [class*="FormItem"] input, ' +
      '[class*="field_"] input, [class*="Field_"] input'
    ).forEach(el => {
      if (!seen.has(el) && !el.disabled && isVisible(el) && el.type !== 'hidden') { els.push(el); seen.add(el); }
    });

    // Rich-text sources (UEditor/KindEditor hide the source textarea; the
    // visible editor container is what matters — include regardless of the
    // textarea's own visibility)
    deepQueryAll('textarea, [contenteditable="true"]').forEach(el => {
      if (!seen.has(el) && PRIM && PRIM.isRichText(el)) { els.push(el); seen.add(el); }
    });

    return els;
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Group form elements by their nearest common container
  const CONTAINER_SELECTOR =
    '.entry-card, .card, .block, .panel, .item, .section-item, ' +
    '.el-card, .ant-card, .experience-item, .edu-item, .work-item, ' +
    '[class*="experience"], [class*="entry"], [class*="record"], ' +
    '[class*="item-content"], [class*="form-block"], [class*="resume-block"]';

  function containerOf(el) {
    return el.closest(CONTAINER_SELECTOR) || el.closest('form, .form-group, .form-item')?.parentElement || null;
  }

  function groupByContainer(elements) {
    const containerMap = new Map();

    for (const el of elements) {
      // Find the nearest "card" or "block" container
      const container = containerOf(el);
      const key = container || 'root';
      if (!containerMap.has(key)) containerMap.set(key, []);
      containerMap.get(key).push(el);
    }

    return Array.from(containerMap.values());
  }

  // ================================================================
  // SECTION 11: SCAN
  // ================================================================

  function scanForm() {
    const elements = getAllFormElements();
    const fields = [];
    const seen = new Set();

    for (const el of elements) {
      if (el.type === 'radio') continue;
      const key = matchField(el);
      const ids = getIdentifiers(el);
      const mainId = ids.length > 0 ? ids[0].t : '(unknown)';

      if (key && !seen.has(key)) {
        seen.add(key);
        fields.push({ label: FIELD_LABELS[key] || key, matched: true, key, identifier: mainId });
      } else if (!key && ids.length > 0) {
        const lbl = ids.find(i => i.s === 'label' || i.s === 'parent-label');
        if (lbl) fields.push({ label: lbl.t.substring(0, 15), matched: false, key: null, identifier: mainId });
      }
    }
    return fields;
  }

  // ================================================================
  // SECTION 12: PAGE INFO EXTRACTION (for application history)
  // ================================================================

  function extractPageInfo() {
    const info = { company: '', job: '' };

    // Layer 1: JSON-LD structured data (most reliable)
    document.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const ld = JSON.parse(script.textContent);
        const items = Array.isArray(ld) ? ld : [ld];
        for (const item of items) {
          if (item['@type'] === 'JobPosting') {
            if (!info.job && item.title) info.job = item.title.substring(0, 40);
            const org = item.hiringOrganization;
            if (!info.company && org) info.company = (typeof org === 'string' ? org : org.name || '').substring(0, 40);
          }
        }
      } catch(e) {}
    });
    if (info.company && info.job) return info;

    // Layer 2: Meta tags (Open Graph / itemprop)
    const ogSiteName = document.querySelector('meta[property="og:site_name"]');
    const ogTitle = document.querySelector('meta[property="og:title"]');
    const metaCompany = document.querySelector('meta[itemprop="hiringOrganization"], meta[name="company"]');
    const metaJob = document.querySelector('meta[itemprop="title"], meta[name="position"]');

    if (metaCompany && !info.company) info.company = (metaCompany.getAttribute('content') || '').substring(0, 40);
    if (metaJob && !info.job) info.job = (metaJob.getAttribute('content') || '').substring(0, 40);

    if (ogTitle && (!info.company || !info.job)) {
      const t = ogTitle.getAttribute('content') || '';
      const parts = t.split(/[-–—|_]/);
      if (parts.length >= 2) {
        if (!info.job) info.job = parts[0].trim().substring(0, 40);
        if (!info.company) info.company = parts[1].trim().substring(0, 40);
      }
    }
    if (ogSiteName && !info.company) {
      info.company = (ogSiteName.getAttribute('content') || '').substring(0, 40);
    }

    // Layer 3: DOM selectors
    const companySelectors = [
      '.company-name', '.company_name', '.employer-name', '.corp-name',
      '[class*="company-name"]', '[class*="companyName"]',
      '.job-company', '.com-name', '.company', '.firm-name',
      'h2.name', '.recruiter-company',
      '.job-sec .cname', '.com_title', '.company-title-text',
      '.company-info .name', '.recruit-company', '.corp-info h2',
    ];
    const jobSelectors = [
      '.job-name', '.job_name', '.position-name', '.job-title',
      '[class*="job-name"]', '[class*="jobName"]', '[class*="position-name"]',
      '.title-info h1', '.job h1', '.position h1',
      '.job-sec .name', '.pos-title', '.position-title',
      '.job-info .title', '.recruit-title', '.post-name',
    ];

    if (!info.company) {
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          info.company = el.textContent.trim().substring(0, 40);
          break;
        }
      }
    }
    if (!info.job) {
      for (const sel of jobSelectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          info.job = el.textContent.trim().substring(0, 40);
          break;
        }
      }
    }

    // Layer 4: h1 fallback
    if (!info.job) {
      const h1 = document.querySelector('h1');
      if (h1) info.job = h1.textContent.trim().substring(0, 40);
    }

    // Layer 5: Page title parsing
    if (!info.company || !info.job) {
      const title = document.title;
      const platformPattern = /[-_|·—]?\s*(招聘|求职|官网|校招|社招|热招|急招|内推|直聘|网招|人才|careers?|jobs?|hiring|recruit).*$/gi;
      const knownPlatforms = /[-_|·—]\s*(BOSS直聘|猎聘|智联招聘|前程无忧|拉勾|牛客|实习僧|51job|zhaopin|liepin|lagou|脉脉|看准|大街|应届生|智联|58同城)\s*$/gi;
      const cleaned = title.replace(knownPlatforms, '').replace(platformPattern, '').trim();
      const parts = cleaned.split(/[-–—|_]/);
      if (parts.length >= 2) {
        if (!info.job) info.job = parts[0].trim().substring(0, 40);
        if (!info.company) info.company = parts[1].trim().substring(0, 40);
      } else if (!info.company) {
        info.company = cleaned.trim().substring(0, 40);
      }
    }

    // Mark if extraction is uncertain (for LLM fallback)
    info._needsLLM = !info.company || !info.job;
    if (info._needsLLM) {
      // Collect page text snippet for LLM to parse
      const snippetParts = [];
      document.querySelectorAll('h1,h2,h3,.breadcrumb,[class*="title"],[class*="info"]').forEach(el => {
        const t = el.textContent.trim();
        if (t.length > 2 && t.length < 100) snippetParts.push(t);
      });
      info._pageSnippet = snippetParts.slice(0, 15).join('\n');
    }

    return info;
  }

  // ================================================================
  // MESSAGE LISTENER
  // ================================================================

  if (api && api.runtime && api.runtime.onMessage) api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'fillForm') {
      (async () => {
        try {
          const count = await fillFormAsync(msg.data);
          // Start auto-fill for subsequent steps
          startAutoFill(msg.data);
          // Save snapshot after fill
          saveFormSnapshot();
          sendResponse({ success: count > 0, filledCount: count });
        } catch (err) {
          console.error('[Resume Filler]', err);
          sendResponse({ success: false, filledCount: 0, error: err.message });
        }
      })();
      return true;
    }
    if (msg.action === 'scanForm') {
      try {
        sendResponse({ success: true, fields: scanForm() });
      } catch (err) {
        sendResponse({ success: false, fields: [] });
      }
      return true;
    }
    if (msg.action === 'extractPageInfo') {
      try {
        sendResponse({ success: true, info: extractPageInfo() });
      } catch (err) {
        sendResponse({ success: false, info: {} });
      }
      return true;
    }
    if (msg.action === 'stopAutoFill') {
      stopAutoFill();
      sendResponse({ success: true });
      return true;
    }
    if (msg.action === 'clearSiteData') {
      api.storage.local.remove(getSiteKey());
      sendResponse({ success: true });
      return true;
    }
    return true;
  });

  // Async wrapper for fill (needed for "add button" clicks with delays)
  // Derive birthday/gender/province from ID card number
  function deriveFromIdCard(data) {
    const id = data.idCard;
    if (!id || id.length !== 18) return data;
    const enriched = { ...data };
    const y = id.substring(6, 10), m = id.substring(10, 12), d = id.substring(12, 14);
    if (!enriched.birthday && +y >= 1900 && +y <= 2100) {
      enriched.birthday = `${y}-${m}-${d}`;
    }
    const gc = parseInt(id.charAt(16), 10);
    if (!enriched.gender && !isNaN(gc)) enriched.gender = gc % 2 === 1 ? '男' : '女';
    const provMap = {
      '11':'北京','12':'天津','13':'河北','14':'山西','15':'内蒙古',
      '21':'辽宁','22':'吉林','23':'黑龙江','31':'上海','32':'江苏',
      '33':'浙江','34':'安徽','35':'福建','36':'江西','37':'山东',
      '41':'河南','42':'湖北','43':'湖南','44':'广东','45':'广西',
      '46':'海南','50':'重庆','51':'四川','52':'贵州','53':'云南',
      '54':'西藏','61':'陕西','62':'甘肃','63':'青海','64':'宁夏','65':'新疆',
    };
    const prov = provMap[id.substring(0, 2)];
    if (prov && !enriched.hometown) enriched.hometown = prov;
    if (prov && !enriched.hukou) enriched.hukou = prov;
    return enriched;
  }

  /**
   * When filling a phone field, look for a nearby area code selector/input and fill +86.
   * Handles: <select> with country codes, <input> for area code, custom dropdown triggers.
   */
  function tryFillPhoneCode(phoneEl) {
    const container = phoneEl.closest(
      '.form-group, .form-item, .el-form-item, .ant-form-item, tr, .form-row, ' +
      '[class*="phone"], [class*="mobile"], [class*="tel"], [class*="field"], [class*="FormItem"], [class*="formItem"]'
    ) || phoneEl.parentElement?.parentElement || phoneEl.parentElement;
    if (!container) return;

    // Look for a select with country/area codes (options like +86, 86, China, 中国)
    const selects = container.querySelectorAll('select');
    for (const sel of selects) {
      if (sel === phoneEl) continue;
      const opts = Array.from(sel.options);
      const chinaOpt = opts.find(o => {
        const t = (o.textContent + ' ' + o.value).toLowerCase();
        return /\+?86|china|中国/.test(t);
      });
      if (chinaOpt) {
        sel.value = chinaOpt.value;
        triggerEvents(sel);
        return;
      }
    }

    // Look for an input for area code near the phone field
    const inputs = container.querySelectorAll('input');
    for (const inp of inputs) {
      if (inp === phoneEl) continue;
      const ids = getIdentifiers(inp);
      const text = ids.join(' ').toLowerCase();
      if (/area|code|区号|country|prefix|dial/.test(text)) {
        setNativeInputValue(inp, '+86');
        return;
      }
    }

    // Look for a custom dropdown trigger (div/span acting as select) for area code
    const triggers = container.querySelectorAll(
      '[class*="code"], [class*="area"], [class*="prefix"], [class*="country"], [class*="dial"]'
    );
    for (const trigger of triggers) {
      if (trigger.contains(phoneEl)) continue;
      // If it already shows +86 or 86 or 中国, skip
      const txt = trigger.textContent.trim();
      if (/^\+?86$|中国/.test(txt)) return;
      // Click to open dropdown, then look for China option
      trigger.click();
      setTimeout(() => {
        const popup = document.querySelector(
          '[class*="dropdown"], [class*="popup"], [class*="option"], [class*="list"], ' +
          '[role="listbox"], [role="menu"], .ant-select-dropdown, .el-select-dropdown'
        );
        if (popup) {
          const items = popup.querySelectorAll('[class*="option"], [class*="item"], li, [role="option"]');
          for (const item of items) {
            const t = item.textContent.toLowerCase();
            if (/\+?86|china|中国/.test(t) && !/886/.test(t)) {
              item.click();
              return;
            }
          }
        }
      }, 300);
      return;
    }
  }

  // ================================================================
  // FILL ORCHESTRATION — layered pipeline
  //   priority: L4 user corrections > L0 adapter rules > L1 matcher > L2 LLM
  // ================================================================

  // Active L0 adapters for the current fill (also consulted by setFieldValue)
  let _activeAdapters = [];

  // ---- L4: correction learning (user fixes → per-site overrides) ----

  const RF_CORRECTIONS_KEY = 'rfCorrections';

  function fieldSignature(el) {
    const ids = getIdentifiers(el);
    const label = ids
      .filter(i => i.s === 'label' || i.s === 'parent-label' || i.s === 'table-label')
      .map(i => i.t).join('/').substring(0, 60);
    const name = (el.name || el.id || '').substring(0, 40);
    const type = el.type || el.tagName;
    return `${type}|${name}|${label}`;
  }

  function correctionsSiteKey() { return `${location.host}${location.pathname}`; }

  function loadCorrections(cb) {
    if (!api || !api.storage || !api.storage.local) { cb({}); return; }
    try {
      api.storage.local.get(RF_CORRECTIONS_KEY, res => {
        const all = res && res[RF_CORRECTIONS_KEY];
        cb((all && all[correctionsSiteKey()]) || {});
      });
    } catch (e) { cb({}); }
  }

  function saveCorrection(sig, key, value) {
    if (!api || !api.storage || !api.storage.local) return;
    try {
      api.storage.local.get(RF_CORRECTIONS_KEY, res => {
        const all = (res && res[RF_CORRECTIONS_KEY]) || {};
        const site = all[correctionsSiteKey()] || {};
        site[sig] = { key, value, ts: Date.now() };
        const sigs = Object.keys(site);
        if (sigs.length > 300) {
          sigs.sort((a, b) => (site[a].ts || 0) - (site[b].ts || 0));
          delete site[sigs[0]];
        }
        all[correctionsSiteKey()] = site;
        api.storage.local.set({ [RF_CORRECTIONS_KEY]: all });
      });
    } catch (e) {}
  }

  function readbackValue(el) {
    if (el.type === 'checkbox' || el.type === 'radio') return el.checked ? '1' : '0';
    if (el.value !== undefined && el.value !== null) return String(el.value);
    return String(el.textContent || '');
  }

  // Watch fields we filled; if the user rewrites one, learn the corrected value
  let _correctionRecords = null;
  let _correctionListener = null;

  function startCorrectionCapture() {
    if (!_correctionRecords || _correctionRecords.size === 0) return;
    stopCorrectionCapture();
    _correctionListener = e => {
      const el = e.target;
      if (!el || !_correctionRecords || !_correctionRecords.has(el)) return;
      const rec = _correctionRecords.get(el);
      const now = readbackValue(el);
      if (now === rec.value) return;
      saveCorrection(fieldSignature(el), rec.key, now);
      _correctionRecords.delete(el);
    };
    document.addEventListener('change', _correctionListener, true);
    setTimeout(stopCorrectionCapture, 10 * 60 * 1000);
  }

  function stopCorrectionCapture() {
    if (_correctionListener) document.removeEventListener('change', _correctionListener, true);
    _correctionListener = null;
  }

  // ---- L2: LLM semantic mapping for unmatched fields ----

  function serializeCandidates(cands) {
    return cands.map((el, i) => {
      const ids = getIdentifiers(el);
      const label = (ids.find(x => x.s === 'label' || x.s === 'parent-label' || x.s === 'table-label') || ids[0] || {}).t || '';
      const o = {
        i,
        tag: el.tagName.toLowerCase(),
        type: el.type || '',
        name: (el.name || '').substring(0, 40),
        id: (el.id || '').substring(0, 40),
        label: label.substring(0, 40),
        sec: detectSection(el),
      };
      if (el.tagName === 'SELECT') {
        o.opts = Array.from(el.options).slice(0, 12).map(op => op.textContent.trim()).filter(Boolean);
      }
      return o;
    });
  }

  async function llmFallbackFill(data, usedKeys, filledEls) {
    if (!api || !api.runtime || !api.runtime.sendMessage) return 0;
    const smartFillOn = await new Promise(res => {
      if (!api.storage || !api.storage.local) return res(false);
      api.storage.local.get('llmSettings', r => {
        const s = r && r.llmSettings;
        res(!!(s && s.apiKey && s.smartFill !== false));
      });
    });
    if (!smartFillOn) return 0;

    const cands = getAllFormElements()
      .filter(el => {
        if (filledEls.has(el)) return false;
        if (el.tagName === 'INPUT' && ['radio','checkbox','file','submit','button','reset','hidden'].includes(el.type)) return false;
        if (matchField(el) && !_failedEls.has(el)) return false; // L1 already claims it
        if ((el.value || '').trim() !== '') return false; // don't stomp user input
        return getIdentifiers(el).length > 0;
      })
      .sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (ra.top - rb.top) || (ra.left - rb.left);
      })
      .slice(0, 60);
    if (cands.length === 0) return 0;

    let resp = null;
    try {
      resp = await new Promise(res => {
        let settled = false;
        const timer = setTimeout(() => { if (!settled) { settled = true; res(null); } }, 20000);
        api.runtime.sendMessage(
          { action: 'llmMapFields', fields: serializeCandidates(cands), keyLabels: FIELD_LABELS, host: location.host },
          r => { if (!settled) { settled = true; clearTimeout(timer); res(r || null); } }
        );
      });
    } catch (e) { return 0; }
    const mappings = (resp && Array.isArray(resp.mappings)) ? resp.mappings : [];
    if (mappings.length === 0) return 0;

    let count = 0;
    for (const m of mappings) {
      const el = cands[m.i];
      const key = m.key;
      if (!el || !key || !FIELD_LABELS[key]) continue; // closed-set whitelist
      if (usedKeys.has(key)) continue;
      const value = data[key];
      if (!value) continue;
      const ok = await setFieldValueAsync(el, value);
      if (ok) {
        usedKeys.add(key);
        filledEls.add(el);
        const tier = (typeof m.conf === 'number' && m.conf >= 0.8) ? 'ok' : 'llm';
        highlightField(el, tier);
        _reportFilled(el, key, tier);
        if (_correctionRecords) _correctionRecords.set(el, { key, value: readbackValue(el) });
        count++;
      }
    }
    return count;
  }

  // ================================================================
  // L2+: ANSWER BANK — 网申自定义题自动作答
  //   1) 本地题库模糊匹配(零网络、零隐私风险)
  //   2) 开放长文本题 AI 起草(显式开启,内容=题目+求职意向摘要)
  // ================================================================

  function normQText(s) {
    return String(s || '').toLowerCase().replace(/[\s,，。.?？!！、:：;；'"()（）\[\]{}<>《》【】*~\-]/g, '');
  }

  function bankMatchScore(label, question) {
    const a = normQText(label), b = normQText(question);
    if (!a || !b) return 0;
    if (a === b) return 1;
    if (a.includes(b) || b.includes(a)) return 0.9;
    const grams = s => { const set = new Set(); for (let i = 0; i < s.length - 1; i++) set.add(s.slice(i, i + 2)); return set; };
    const ga = grams(a), gb = grams(b);
    if (gb.size === 0) return 0;
    let hit = 0; gb.forEach(g => { if (ga.has(g)) hit++; });
    return hit / gb.size;
  }

  const OPEN_TEXT_RE = /为什么|动机|优势|劣势|自我介绍|认识|理解|规划|选择|描述|看法|适合|经历|印象|失败|成功|收获/;

  async function loadAnswerBank() {
    return await new Promise(res => {
      if (!api || !api.storage || !api.storage.local) return res([]);
      try { api.storage.local.get('answerBank', r => res((r && r.answerBank) || [])); } catch (e) { res([]); }
    });
  }

  function bestLabelText(el) {
    const ids = getIdentifiers(el);
    const l = ids.find(x => x.s === 'label' || x.s === 'parent-label' || x.s === 'table-label') ||
      ids.find(x => x.s === 'placeholder') || ids[0];
    return l ? l.t : '';
  }

  async function answerBankFill(data, filledEls) {
    let count = 0;
    let cands = collectUnmatched(filledEls);
    if (cands.length === 0) return 0;

    // 1) local bank matching — nothing leaves the browser
    const bank = await loadAnswerBank();
    if (bank.length > 0) {
      for (const el of cands) {
        const label = bestLabelText(el);
        if (!label) continue;
        let best = null, bestScore = 0;
        for (const item of bank) {
          const s = bankMatchScore(label, item.q);
          if (s > bestScore) { bestScore = s; best = item; }
        }
        if (best && bestScore >= 0.55 && best.a) {
          const ok = await setFieldValueAsync(el, best.a);
          if (ok) {
            filledEls.add(el);
            highlightField(el, 'ok');
            _reportFilled(el, `题库:${best.q}`, 'ok');
            count++;
          }
        }
      }
    }

    // 2) AI drafting for open-ended questions (explicit opt-in via llmSettings.aiDraft)
    const aiOn = await new Promise(res => {
      if (!api || !api.storage || !api.storage.local) return res(false);
      api.storage.local.get('llmSettings', r => {
        const s = r && r.llmSettings;
        res(!!(s && s.apiKey && s.aiDraft));
      });
    });
    if (!aiOn) return count;
    for (const el of collectUnmatched(filledEls)) {
      const label = bestLabelText(el);
      const isLong = el.tagName === 'TEXTAREA' || OPEN_TEXT_RE.test(label || '');
      if (!label || !isLong) continue;
      let resp = null;
      try {
        resp = await new Promise(res2 => {
          let settled = false;
          const timer = setTimeout(() => { if (!settled) { settled = true; res2(null); } }, 20000);
          api.runtime.sendMessage(
            {
              action: 'llmDraftAnswer', question: label,
              profile: { expectedJob: data.expectedJob, skills: data.skills, selfEvaluation: data.selfEvaluation, workYears: data.workYears },
            },
            r => { if (!settled) { settled = true; clearTimeout(timer); res2(r || null); } }
          );
        });
      } catch (e) {}
      const answer = resp && resp.answer;
      if (answer) {
        const ok = await setFieldValueAsync(el, answer);
        if (ok) {
          filledEls.add(el);
          highlightField(el, 'llm');
          _reportFilled(el, `AI起草:${label}`, 'llm');
          count++;
        }
      }
    }
    return count;
  }

  // ================================================================
  // L2+: ATTACHMENTS — 证件照 / 身份证 / 简历附件自动上传
  // ================================================================

  const ATTACH_RULES = [
    { kind: 'photo', re: /证件照|免冠|一寸|两寸|照片|近照|头像|电子照|photo|avatar/i },
    { kind: 'idcard', re: /身份证|证件扫描|证件复印|idcard/i },
    { kind: 'resume', re: /简历|附件|resume|\bcv\b/i },
  ];

  async function fillAttachments(filledEls) {
    if (!PRIM) return 0;
    const attachments = await new Promise(res => {
      if (!api || !api.storage || !api.storage.local) return res([]);
      try { api.storage.local.get('attachments', r => res((r && r.attachments) || [])); } catch (e) { res([]); }
    });
    if (!attachments.length) return 0;
    const inputs = getAllFormElements().filter(el => el.tagName === 'INPUT' && el.type === 'file');
    let count = 0;
    for (const el of inputs) {
      if (filledEls.has(el)) continue;
      const txt = getIdentifiers(el).map(i => i.t).join(' ');
      for (const rule of ATTACH_RULES) {
        if (!rule.re.test(txt)) continue;
        const att = attachments.find(a => a.kind === rule.kind);
        if (att && PRIM.fillFileInput(el, { name: att.name, base64: att.base64, mime: att.mime })) {
          filledEls.add(el);
          highlightField(el, 'ok');
          _reportFilled(el, `附件:${rule.kind}`, 'ok');
          count++;
        }
        break;
      }
    }
    return count;
  }

  // ================================================================
  // FILL REPORT + FEEDBACK PANEL — 填写报告 + 未识别字段手动指认(写入适配层)
  // ================================================================

  let _fillReport = null;
  let _panelTimer = null;
  // elements whose L1-matched key failed to apply (e.g. 值不匹配的下拉框) —
  // these stay eligible for the answer bank / LLM / panel paths
  let _failedEls = new Set();

  function _reportFilled(el, key, tier) {
    if (_fillReport) _fillReport.filled.push({ el, key, tier });
  }

  function collectUnmatched(filledEls) {
    return getAllFormElements().filter(el => {
      if (filledEls.has(el)) return false;
      if (el.tagName === 'INPUT' && ['radio', 'checkbox', 'submit', 'button', 'reset', 'hidden', 'file'].includes(el.type)) return false;
      if ((el.value || '').trim() !== '') return false;
      if (matchField(el) && !_failedEls.has(el)) return false;
      const ids = getIdentifiers(el);
      if (ids.length === 0) return false;
      const txt = ids.map(i => i.t).join(' ');
      if (/验证码|captcha|搜索|search|推荐码|邀请码/i.test(txt)) return false;
      return true;
    }).slice(0, 15);
  }

  async function manualAssign(el, key) {
    const data = _fillReport && _fillReport.data;
    if (!el || !key || !data || !data[key]) return;
    const ok = await setFieldValueAsync(el, data[key]);
    if (ok) {
      highlightField(el, 'ok');
      // teach-once: this assignment persists for the site via the correction layer
      saveCorrection(fieldSignature(el), key, data[key]);
      if (_fillReport) {
        _fillReport.filled.push({ el, key, tier: 'manual' });
        _fillReport.unmatched = (_fillReport.unmatched || []).filter(u => u.el !== el);
        renderFillPanel();
      }
    }
  }

  function renderFillPanel() {
    const report = _fillReport;
    if (!report) return;
    const okCount = report.filled.filter(f => f.tier === 'ok' || f.tier === 'manual').length;
    const llmItems = report.filled.filter(f => f.tier === 'llm');
    const unmatched = report.unmatched || [];
    if (okCount + llmItems.length === 0 && unmatched.length === 0) return;

    const existing = document.getElementById('__rf-panel-host');
    if (existing) existing.remove();
    const host = document.createElement('div');
    host.id = '__rf-panel-host';
    host.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;width:308px';
    const shadow = host.attachShadow({ mode: 'open' });

    const style = shadow.appendChild(document.createElement('style'));
    style.textContent = `
      * { box-sizing:border-box; margin:0; padding:0; font:12px/1.6 -apple-system,"Microsoft YaHei",sans-serif; }
      .box { background:#fff; border:1px solid #dde3ee; border-radius:10px; box-shadow:0 8px 32px rgba(20,35,70,.18); overflow:hidden; }
      .hd { display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f6f8fc; border-bottom:1px solid #e6eaf3; font-weight:600; color:#1c2b4a; }
      .hd .x { cursor:pointer; color:#8b96ad; font-size:16px; padding:0 4px; }
      .sec { padding:8px 14px; border-bottom:1px dashed #edf0f6; }
      .sec h4 { font-size:11px; color:#8b96ad; font-weight:500; margin-bottom:4px; }
      .row { display:flex; align-items:center; gap:6px; margin:4px 0; }
      .row .lb { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#2c3a55; }
      .dot { width:7px; height:7px; border-radius:50%; flex-shrink:0; }
      .dot.ok { background:#34a853; } .dot.llm { background:#f59e0b; } .dot.un { background:#c3cad9; }
      .row.link { cursor:pointer; }
      .row.link:hover .lb { color:#1a66ff; }
      select { max-width:130px; border:1px solid #d5dbe8; border-radius:5px; padding:2px 4px; font-size:11px; }
      button { border:none; border-radius:5px; padding:3px 10px; background:#2f6bff; color:#fff; cursor:pointer; font-size:11px; }
      button:hover { background:#2456d6; }
      .ft { padding:8px 14px; font-size:10px; color:#9aa4ba; background:#fafbfe; }
      .go { cursor:pointer; color:#1a66ff; }
    `;

    const box = shadow.appendChild(document.createElement('div'));
    box.className = 'box';
    const hd = box.appendChild(document.createElement('div'));
    hd.className = 'hd';
    hd.innerHTML = `<span>已填写 ${report.filled.length} 项</span>`;
    const x = hd.appendChild(document.createElement('span'));
    x.className = 'x'; x.textContent = '×';
    x.addEventListener('click', () => host.remove());

    if (llmItems.length > 0) {
      const sec = box.appendChild(document.createElement('div'));
      sec.className = 'sec';
      sec.innerHTML = `<h4>⚠ AI 填写,建议核对(${llmItems.length})</h4>`;
      for (const it of llmItems.slice(0, 8)) {
        const row = sec.appendChild(document.createElement('div'));
        row.className = 'row link';
        row.innerHTML = `<span class="dot llm"></span><span class="lb">${String(it.key).replace(/</g, '&lt;')}</span>`;
        row.addEventListener('click', () => {
          try { it.el.scrollIntoView({ block: 'center', behavior: 'smooth' }); (it.el.focus || function(){}).call(it.el); } catch (e) {}
        });
      }
    }

    if (unmatched.length > 0) {
      const sec = box.appendChild(document.createElement('div'));
      sec.className = 'sec';
      sec.innerHTML = `<h4>未识别字段 — 指认一次,本站永久生效(${unmatched.length})</h4>`;
      for (const u of unmatched.slice(0, 6)) {
        const row = sec.appendChild(document.createElement('div'));
        row.className = 'row';
        const dot = row.appendChild(document.createElement('span')); dot.className = 'dot un';
        const lb = row.appendChild(document.createElement('span')); lb.className = 'lb'; lb.textContent = u.label;
        const sel = row.appendChild(document.createElement('select'));
        sel.innerHTML = Object.entries(FIELD_LABELS)
          .map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
        const btn = row.appendChild(document.createElement('button'));
        btn.textContent = '记住';
        btn.addEventListener('click', () => manualAssign(u.el, sel.value));
      }
    }

    const ft = box.appendChild(document.createElement('div'));
    ft.className = 'ft';
    ft.textContent = '题库匹配与规则识别全程本地完成;仅 AI 起草/字段识别发送题目与结构信息。';

    document.body.appendChild(host);
    clearTimeout(_panelTimer);
    _panelTimer = setTimeout(() => { if (host.isConnected) host.remove(); }, 90000);
  }

  async function fillFormAsync(originalData) {
    // Enrich data: derive birthday/gender from ID card if available
    const data = deriveFromIdCard(originalData);
    const elements = getAllFormElements();
    let filledCount = 0;
    const usedKeys = new Set();
    const filledEls = new Set();
    _correctionRecords = new Map();
    _fillReport = { filled: [], unmatched: [], data: null };
    _failedEls = new Set();

    // L0: detect site adapters (stackable: e.g. dayee + webform + legacy-table)
    const pageUrl = document.__RF_URL_OVERRIDE__ || location.href;
    _activeAdapters = ADAPTERS ? ADAPTERS.detect(pageUrl, document) : [];
    const adapterKeyMap = new Map();
    if (ADAPTERS && _activeAdapters.length > 0) {
      for (const r of ADAPTERS.collectRules(_activeAdapters, document)) {
        if (!adapterKeyMap.has(r.el)) adapterKeyMap.set(r.el, r.key);
      }
    }

    // L4: per-site corrections learned from user edits (highest priority)
    const corrections = await new Promise(res => loadCorrections(res));

    // Radio groups
    const radioGroups = {};
    elements.forEach(el => {
      if (el.tagName === 'INPUT' && el.type === 'radio' && el.name) {
        if (!radioGroups[el.name]) radioGroups[el.name] = [];
        radioGroups[el.name].push(el);
      }
    });
    for (const [, radios] of Object.entries(radioGroups)) {
      const corr = corrections[fieldSignature(radios[0])];
      const key = (corr && corr.key && data[corr.key] !== undefined && corr.key) || matchField(radios[0]);
      if (key && data[key] && !usedKeys.has(key)) {
        if (setRadioValue(radios, data[key])) {
          radios.forEach(r => { if (r.checked) highlightField(r); filledEls.add(r); });
          usedKeys.add(key); filledCount++;
          _reportFilled(radios[0], key, 'ok');
        }
      }
    }

    // Sort by position
    const sortedEls = elements
      .filter(el => !filledEls.has(el) && !(el.tagName === 'INPUT' && el.type === 'radio'))
      .sort((a, b) => {
        const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
        return (ra.top - rb.top) || (ra.left - rb.left);
      });

    // DEBUG: log all detected elements and their matches
    console.log('[Resume Filler DEBUG] elements count:', sortedEls.length, '| adapters:', _activeAdapters.map(a => a.id).join(','));
    console.log('[Resume Filler DEBUG] data keys:', Object.keys(data).filter(k => data[k]));

    // Fill basic flat fields
    for (const el of sortedEls) {
      if (el.readOnly && el.type !== 'text') continue;

      // resolution order: correction > adapter rule > matcher
      const corr = corrections[fieldSignature(el)];
      let key = null;
      if (corr && corr.key && data[corr.key] !== undefined && !usedKeys.has(corr.key)) key = corr.key;
      if (!key && adapterKeyMap.has(el)) key = adapterKeyMap.get(el);
      if (!key) key = matchField(el);
      if (!key || usedKeys.has(key)) continue;

      // Skip multi-entry fields if we have array data
      if (['school','major','degree','gpa','eduStartDate','eduEndDate','eduDescription'].includes(key) && data.educations?.length > 0) continue;
      if (['company','jobTitle','workStartDate','workEndDate','jobDescription'].includes(key) && data.works?.length > 0) continue;
      if (['projectName','projectRole','projectDescription','projectLink'].includes(key) && data.projects?.length > 0) continue;
      if (['competitionName','awardLevel','awardDate','awardIssuer','awardDescription'].includes(key) && data.competitions?.length > 0) continue;
      if (['certName','certDate','certIssuer','certNo'].includes(key) && data.certificates?.length > 0) continue;

      // phoneCode: auto-fill +86 (China) if not provided in data
      if (key === 'phoneCode') {
        const code = data.phoneCode || '+86';
        if (await setFieldValueAsync(el, code)) { highlightField(el); usedKeys.add(key); filledCount++; }
        continue;
      }

      // user-corrected value overrides profile value for this exact field
      const value = (corr && key === corr.key && corr.value) ? corr.value : data[key];
      if (!value) continue;

      // When filling phone, also try to fill nearby area code selector
      if (key === 'phone') {
        tryFillPhoneCode(el);
      }

      if (await setFieldValueAsync(el, value)) {
        highlightField(el);
        usedKeys.add(key); filledCount++;
        _reportFilled(el, key, 'ok');
        if (_correctionRecords) _correctionRecords.set(el, { key, value: readbackValue(el) });
      } else {
        // claimed by the matcher but the value didn't apply — keep it eligible
        // for the answer bank / LLM / manual-assignment paths below
        _failedEls.add(el);
      }
    }

    // Fill multi-entry sections
    filledCount += await fillMultiEntriesAsync(data);

    // L2: LLM semantic mapping for whatever the above layers missed
    filledCount += await llmFallbackFill(data, usedKeys, filledEls);

    // L2+: answer bank / AI-drafted answers for site-custom questions
    filledCount += await answerBankFill(data, filledEls);

    // L2+: attachments (证件照/身份证/简历)
    filledCount += await fillAttachments(filledEls);

    // feedback panel: report + manual assignment for unknown fields
    _fillReport.unmatched = collectUnmatched(filledEls)
      .map(el => ({ el, label: (bestLabelText(el) || '(未命名字段)').substring(0, 20) }));
    _fillReport.data = data;
    renderFillPanel();

    // L4: start learning from any user corrections on this fill
    startCorrectionCapture();

    if (filledCount > 0) showBadge(filledCount);
    return filledCount;
  }

  async function fillMultiEntriesAsync(data) {
    let count = 0;
    const sections = {
      education: data.educations || [],
      work: data.works || [],
      project: data.projects || [],
      competition: data.competitions || [],
      certificate: data.certificates || [],
    };
    const fieldMaps = {
      education: { school:'school', degree:'degree', major:'major', gpa:'gpa', startDate:'eduStartDate', endDate:'eduEndDate', description:'eduDescription' },
      work: { company:'company', jobTitle:'jobTitle', startDate:'workStartDate', endDate:'workEndDate', description:'jobDescription' },
      project: { projectName:'projectName', role:'projectRole', startDate:'workStartDate', endDate:'workEndDate', description:'projectDescription', link:'projectLink' },
      competition: { competitionName:'competitionName', awardLevel:'awardLevel', awardDate:'awardDate', issuer:'awardIssuer', description:'awardDescription' },
      certificate: { certName:'certName', certDate:'certDate', certIssuer:'certIssuer', certNo:'certNo' },
    };

    for (const [sectionType, entries] of Object.entries(sections)) {
      if (entries.length === 0) continue;
      const fmap = fieldMaps[sectionType];
      const isSectionEl = el => {
        const sec = detectSection(el);
        return sec === sectionType || (sectionType === 'work' && sec === 'intern');
      };

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];

        // Re-scan elements each time (DOM may have changed)
        const allEls = getAllFormElements();
        const sectionEls = allEls.filter(isSectionEl);

        let containers = groupByContainer(sectionEls);
        let container = containers[i];

        // No container for this entry → the page may require clicking "新增"
        // to reveal the form. Covers sections that start EMPTY (only an add
        // button visible) and modal dialogs: fill → 确定 → close → next entry.
        if (!container) {
          const addBtn = findSectionAddButton(sectionType);
          if (addBtn) {
            const beforeSet = new Set(allEls);
            _revealSectionTest = isSectionEl;
            try { addBtn.click(); } catch (e) {}
            const revealed = await waitForReveal(sectionEls.length, beforeSet, 3000);

            if (revealed && revealed.dialog) {
              count += await fillEntryFields(revealed.dialog, fmap, entry, null);
              const committed = await commitDialog(revealed.dialog);
              if (committed) await waitForDialogClose(revealed.dialog);
              await sleep(200);
              continue;
            }
            if (revealed && revealed.newEls && revealed.newEls.length) {
              const root = containerOf(revealed.newEls[0]);
              count += await fillEntryFields(root, fmap, entry, revealed.newEls);
              await sleep(150);
              continue;
            }
            // Reveal failed — rescan once in case the click still produced something
            const sectionAfter = getAllFormElements().filter(isSectionEl);
            containers = groupByContainer(sectionAfter);
            container = containers[i];
          }
        }

        // If still no section-specific container, fill as flat
        if (!container && sectionEls.length === 0 && i === 0) {
          for (const [entryField, matcherKey] of Object.entries(fmap)) {
            if (!matcherKey || !entry[entryField]) continue;
            for (const el of allEls) {
              const key = matchField(el);
              if (key === matcherKey) {
                if (await setFieldValueAsync(el, entry[entryField])) { highlightField(el); count++; }
                break;
              }
            }
          }
          continue;
        }

        if (!container) continue;

        for (const [entryField, matcherKey] of Object.entries(fmap)) {
          if (!matcherKey || !entry[entryField]) continue;
          for (const el of container) {
            const key = matchField(el);
            if (key === matcherKey) {
              if (await setFieldValueAsync(el, entry[entryField])) { highlightField(el); count++; }
              break;
            }
          }
        }
      }
    }

    return count;
  }

  // ================================================================
  // SECTION 12: AUTO-FILL ON STEP CHANGE (MutationObserver)
  // ================================================================

  let _autoFillData = null;
  let _autoFillTimer = null;
  let _lastFilledSnapshot = '';
  let _autoFillCooldown = 0; // timestamp: don't re-fill until after this time

  function startAutoFill(data) {
    _autoFillData = data;
    _lastFilledSnapshot = getFormSnapshot();
    _autoFillCooldown = Date.now() + 3000; // 3s cooldown after initial fill

    if (_autoFillObserver) _autoFillObserver.disconnect();
    _autoFillObserver = new MutationObserver(() => {
      if (!_autoFillData) return;
      if (Date.now() < _autoFillCooldown) return; // still in cooldown
      // Debounce: wait for DOM to stabilize
      clearTimeout(_autoFillTimer);
      _autoFillTimer = setTimeout(async () => {
        if (Date.now() < _autoFillCooldown) return;
        const snap = getFormSnapshot();
        if (snap === _lastFilledSnapshot || snap === '') return;
        // Only re-fill if the number of form elements actually changed (new step/page)
        const oldCount = _lastFilledSnapshot.split('|').length;
        const newCount = snap.split('|').length;
        if (Math.abs(newCount - oldCount) < 2) {
          _lastFilledSnapshot = snap; // update snapshot but don't re-fill
          return;
        }
        _lastFilledSnapshot = snap;
        const count = await fillFormAsync(_autoFillData);
        if (count > 0) {
          showBadge(count, '自动填写');
          saveFormSnapshot();
          _autoFillCooldown = Date.now() + 3000; // cooldown after each auto-fill
        }
      }, 1500);
    });
    _autoFillObserver.observe(document.body, {
      childList: true, subtree: true, attributes: false,
    });
  }

  function stopAutoFill() {
    _autoFillData = null;
    if (_autoFillObserver) { _autoFillObserver.disconnect(); _autoFillObserver = null; }
    clearTimeout(_autoFillTimer);
  }

  let _autoFillObserver = null;

  // Snapshot: a fingerprint of current form fields to detect step changes
  function getFormSnapshot() {
    const els = getAllFormElements();
    return els.map(el => {
      const r = el.getBoundingClientRect();
      return `${el.tagName}:${el.type||''}:${(el.name||el.id||'').substring(0,20)}:${Math.round(r.top)}`;
    }).join('|');
  }

  // ================================================================
  // SECTION 13: FORM DATA PERSISTENCE PER SITE
  // ================================================================

  function getSiteKey() {
    // Use origin + pathname (without query/hash) as key
    return `formData_${location.origin}${location.pathname}`;
  }

  function saveFormSnapshot() {
    try {
      const els = getAllFormElements();
      const snapshot = {};
      els.forEach((el, i) => {
        const id = el.id || el.name || `__idx_${i}_${el.type || el.tagName}`;
        if (el.tagName === 'SELECT') {
          snapshot[id] = el.value;
        } else if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.checked) snapshot[id] = el.value || 'on';
        } else if (el.contentEditable === 'true') {
          snapshot[id] = el.innerHTML;
        } else {
          snapshot[id] = el.value;
        }
      });
      const key = getSiteKey();
      api.storage.local.set({ [key]: { data: snapshot, time: Date.now() } });
    } catch (e) { /* ignore */ }
  }

  function restoreFormSnapshot() {
    const key = getSiteKey();
    api.storage.local.get(key, (result) => {
      const saved = result[key];
      if (!saved || !saved.data) return;
      // Expire after 7 days
      if (Date.now() - saved.time > 7 * 24 * 3600 * 1000) {
        api.storage.local.remove(key);
        return;
      }
      const els = getAllFormElements();
      let restored = 0;
      els.forEach((el, i) => {
        const id = el.id || el.name || `__idx_${i}_${el.type || el.tagName}`;
        const val = saved.data[id];
        if (val === undefined || val === '') return;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (el.value === val || val === 'on') { el.checked = true; restored++; }
        } else if (el.contentEditable === 'true') {
          if (!el.innerHTML.trim()) { el.innerHTML = val; restored++; }
        } else if (el.tagName === 'SELECT') {
          el.value = val; restored++;
        } else {
          if (!el.value.trim()) {
            setFieldValue(el, val);
            restored++;
          }
        }
      });
      if (restored > 0) showBadge(restored, '已恢复');
    });
  }

  // Save form data periodically when user is interacting
  let _saveDebounce = null;
  document.addEventListener('input', () => {
    clearTimeout(_saveDebounce);
    _saveDebounce = setTimeout(saveFormSnapshot, 2000);
  }, true);

  // On page load, try to restore saved form data
  if (document.readyState === 'complete') {
    setTimeout(restoreFormSnapshot, 500);
  } else {
    window.addEventListener('load', () => setTimeout(restoreFormSnapshot, 500));
  }

  // ================================================================
  // SECTION 14: AUTO-DETECT SUBMISSION
  // ================================================================

  const DEFAULT_SUBMIT_KEYWORDS = [
    '投递', '立即投递', '申请职位', '投简历', '申请', '提交申请', '一键投递',
    '立即申请', '我要投递', '确认投递', '投递简历', '确定投递', '马上投递',
    '投递岗位', '确认申请', '提交简历', '发送简历', '我感兴趣', '立即沟通',
    '打招呼', '极速投递', '投个简历', '简历投递', '快速申请',
    '预览并提交', '提交', '确认提交', '保存并提交', '立即提交',
    '提交申请表', '确认并提交', '投递该职位', '申请该职位',
    'submit', 'apply', 'apply now', 'submit application', 'quick apply',
  ];

  let _submitKeywords = [...DEFAULT_SUBMIT_KEYWORDS];

  // Load user custom keywords
  api.storage.local.get('submitKeywords', (result) => {
    if (result.submitKeywords && result.submitKeywords.length > 0) {
      _submitKeywords = [...DEFAULT_SUBMIT_KEYWORDS, ...result.submitKeywords];
    }
  });

  // Listen for keyword updates from popup
  if (api && api.runtime && api.runtime.onMessage) api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'updateSubmitKeywords') {
      _submitKeywords = [...DEFAULT_SUBMIT_KEYWORDS, ...(msg.keywords || [])];
      sendResponse({ success: true });
      return true;
    }
  });

  function isSubmitButton(el) {
    const tag = el.tagName;
    if (tag !== 'BUTTON' && tag !== 'A' && tag !== 'INPUT' && tag !== 'DIV' && tag !== 'SPAN') return false;
    const text = (el.textContent || el.value || '').trim().toLowerCase();
    if (text.length > 20) return false;
    return _submitKeywords.some(kw => text.includes(kw));
  }

  let _lastSubmitTime = 0;
  document.addEventListener('click', (e) => {
    // Check clicked element and its ancestors (up to 3 levels)
    let target = e.target;
    let found = false;
    for (let i = 0; i < 4 && target && target !== document.body; i++) {
      if (isSubmitButton(target)) { found = true; break; }
      target = target.parentElement;
    }
    if (!found) return;

    // Debounce: ignore rapid clicks
    if (Date.now() - _lastSubmitTime < 5000) return;
    _lastSubmitTime = Date.now();

    // Extract page info and send to background/popup
    const info = extractPageInfo();
    if (!info.company && !info.job) return;

    if (api && api.runtime && api.runtime.sendMessage) api.runtime.sendMessage({
      action: 'autoRecordSubmit',
      data: {
        company: info.company || '未知公司',
        job: info.job || '',
        url: location.href,
        date: Date.now(),
        status: '已投递',
        note: '',
        _needsLLM: info._needsLLM,
        _pageSnippet: info._pageSnippet || '',
      }
    });
  }, true);

  // ================================================================
  // SECTION 15: AUTO-DETECT EXISTING APPLICATION STATUS
  // ================================================================

  const STATUS_INDICATORS = [
    { keywords: ['已投递', '已申请', '投递成功', '申请成功', '简历已投', '已发送'], status: '已投递' },
    { keywords: ['面试中', '已安排面试', '面试邀请', '待面试', '笔试中', '测评中', '流程中'], status: '已面试' },
    { keywords: ['已录用', '录用通知', 'offer', '恭喜您', '已通过'], status: '已录用' },
    { keywords: ['已拒绝', '不合适', '未通过', '已淘汰', '不匹配'], status: '已拒绝' },
  ];

  function detectExistingStatus() {
    // Scan page for application status indicators
    const textEls = document.querySelectorAll(
      '[class*="status"], [class*="state"], [class*="result"], [class*="tag"], ' +
      '[class*="badge"], [class*="tip"], [class*="notice"], [class*="alert"], ' +
      '.delivery-status, .apply-status, .job-status'
    );

    for (const el of textEls) {
      if (!isVisible(el)) continue;
      const text = el.textContent.trim();
      if (text.length > 30) continue;
      for (const { keywords, status } of STATUS_INDICATORS) {
        if (keywords.some(kw => text.includes(kw))) {
          return status;
        }
      }
    }

    // Also check button states — disabled "已投递" button
    const btns = document.querySelectorAll('button[disabled], a.disabled, [class*="disabled"]');
    for (const btn of btns) {
      const text = (btn.textContent || '').trim();
      if (['已投递', '已申请', '已投', '已沟通'].some(kw => text.includes(kw))) {
        return '已投递';
      }
    }

    return null;
  }

  // On page load, auto-detect and record existing status
  function autoDetectAndRecord() {
    const status = detectExistingStatus();
    if (!status) return;

    const info = extractPageInfo();
    if (!info.company && !info.job) return;

    if (api && api.runtime && api.runtime.sendMessage) api.runtime.sendMessage({
      action: 'autoRecordSubmit',
      data: {
        company: info.company || '未知公司',
        job: info.job || '',
        url: location.href,
        date: Date.now(),
        status: status,
        note: '页面自动识别',
        _needsLLM: info._needsLLM,
        _pageSnippet: info._pageSnippet || '',
      }
    });
  }

  // Delay detection to let page finish rendering
  if (document.readyState === 'complete') {
    setTimeout(autoDetectAndRecord, 1500);
  } else {
    window.addEventListener('load', () => setTimeout(autoDetectAndRecord, 1500));
  }

  // ================================================================
  // DEV / EVAL HOOK — used by test/eval.html and programmatic control
  // ================================================================
  window.__RF_DEBUG__ = {
    fill: d => fillFormAsync(d),
    scan: () => scanForm(),
    adapters: () => (_activeAdapters || []).map(a => a.id),
    match: el => matchField(el),
    signature: el => fieldSignature(el),
    ids: el => getIdentifiers(el).map(i => `${i.s}(${i.w}):${i.t}`),
  };

})();