/**
 * Resume Auto Filler — Field Matchers (L1 data)
 *
 * 40+ 个字段的 keyword / exact / negative 规则，以及给 LLM 用的字段白名单。
 * 从 content.js 拆出，避免主引擎文件继续膨胀。
 *
 * Loaded before content.js via manifest content_scripts / build-eval.
 */
(function() {
  'use strict';
  if (window.__RF_MATCHERS__) return;
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
      // 拆开的 First/Last Name 各有匹配器，整名匹配器必须让位，
      // 否则「张三」会被同时塞进 First 和 Last 两个框
      neg: ['company','school','university','emergency','project','父','母','紧急','公司','学校','项目','家庭','担保','推荐','联系人',
            'first name','last name','family name','given name','surname','middle name','nickname','nick name','昵称','用户名','username','file name','filename'],
      w: 10
    },
    // ---- 外资/英文表单：First / Last / Middle 是三个独立输入框 ----
    firstName: {
      kw: ['名字','given name','first name','forename'],
      ex: ['firstname','first name','givenname','given name','fname','forename','first'],
      neg: ['姓','last','family','surname','middle','full name','fullname','company','school','昵称','nickname','username','用户名'],
      w: 6
    },
    lastName: {
      kw: ['姓氏','last name','family name','surname'],
      ex: ['lastname','last name','surname','familyname','family name','lname','last'],
      neg: ['姓名','first','given','middle','full name','fullname','company','school','昵称','nickname','username','用户名'],
      w: 6
    },
    middleName: {
      kw: ['middle name','middle initial'],
      ex: ['middlename','middle name','middleinitial'],
      neg: ['first given','last name','family','surname'], w: 2
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
      kw: ['手机','电话','联系电话','手机号','联系方式','移动电话','phone','mobile','telephone','cell','phone number','mobile number','contact number'],
      ex: ['phone','mobile','tel','telephone','cellphone','mobilephone','phonenum','phoneNo','sjhm','lxdh'],
      neg: ['emergency','紧急','fax','传真','area','区号','country','code','prefix'], w: 8
    },
    phoneCode: {
      kw: ['区号','国际区号','国家代码','手机区号','country code','area code','dial code','phone code','calling code'],
      ex: ['phonecode','areacode','countrycode','dialcode','phoneprefix','telcode','callingcode','phoneAreaCode','mobileAreaCode'],
      neg: ['邮编','zip','postal'], w: 6
    },
    email: {
      kw: ['邮箱','电子邮箱','电子邮件','email','e-mail','email address'],
      ex: ['email','mail','emailaddress','userEmail','contactEmail','dzyx'],
      neg: [], w: 8
    },
    city: {
      kw: ['城市','所在城市','现居城市','工作城市','工作地点','所在地','city','location','current city'],
      ex: ['city','location','currentcity','workcity','livecity'],
      neg: ['birth','籍贯','hometown','职位','关键字','搜索','search','keyword','job','filter','筛选','服从','调剂','意向',
            'state','province','省'], w: 4
    },
    province: {
      kw: ['省份','所在省','省/自治区','state/province','state','province','region'],
      ex: ['province','state','region','shengfen','sf'],
      neg: ['city','市','address','地址','country','国家','邮编','postal','zip','区号'], w: 3
    },
    country: {
      kw: ['国家','国家/地区','country/region','country','nation'],
      ex: ['country','countryregion','nation','guojia'],
      neg: ['code','区号','prefix','state','province','省'], w: 4
    },
    postalCode: {
      kw: ['邮编','邮政编码','zip code','postal code','postcode'],
      ex: ['zip','zipcode','postalcode','postcode','youbian','yzbm'],
      neg: [], w: 3
    },
    address: {
      kw: ['地址','详细地址','居住地址','通讯地址','家庭地址','住址','address','street','address line','street address'],
      ex: ['address','addr','detailaddress','homeaddress','streetaddress'],
      // addressSection_city / addressSection_countryRegion 这类标识符里带 address，
      // 但真正要的是 city / country —— 细分字段必须把 address 挤出去
      neg: ['email','ip','mac','url','city','state','province','region','country','postal','zip','城市','省','区','国家'], w: 4
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
      kw: ['学历','最高学历','学位','教育程度','degree','education level','qualification','highest degree','degree type','academic degree'],
      ex: ['degree','education','qualification','xueli','educationlevel','highestdegree'],
      neg: [], w: 5
    },
    school: {
      kw: ['学校','院校','毕业院校','毕业学校','就读学校','school','university','college','institution','school or university','institution name'],
      ex: ['school','university','college','institution','schoolname','collegename'],
      neg: [], w: 5
    },
    major: {
      kw: ['专业','所学专业','major','specialty','field of study','area of study','discipline','concentration','study field'],
      ex: ['major','specialty','subject','profession','discipline','majorname'],
      neg: [], w: 5
    },
    eduStartDate: {
      kw: ['入学时间','入学日期','教育开始','education start','start date','from'],
      ex: ['edustartdate','enrolldate','educationstartdate','rxsj'],
      neg: [], w: 3
    },
    eduEndDate: {
      kw: ['毕业时间','毕业日期','教育结束','graduation date','graduation','end date','to'],
      ex: ['eduenddate','graduatedate','graduationdate','bysj'],
      neg: [], w: 3
    },
    gpa: {
      kw: ['gpa','绩点','成绩','平均分','grade point'],
      ex: ['gpa','grade','score','gradepoint'],
      neg: [], w: 3
    },
    company: {
      kw: ['公司','单位','公司名称','工作单位','企业','雇主','company','employer','organization','current company','current employer','employer name'],
      ex: ['company','employer','organization','companyname','corp','orgname','enterprise','gzdw'],
      neg: [], w: 5
    },
    jobTitle: {
      kw: ['职位','岗位','职务','头衔','position','job title','role','designation','position title','current title'],
      ex: ['jobtitle','position','title','role','positionname','designation','zw','gwmc'],
      neg: ['expected','期望','target','意向'], w: 5
    },
    workStartDate: {
      kw: ['入职时间','开始工作','参加工作','work start','employment start','开始时间','start date','from'],
      ex: ['workstartdate','jobstartdate','hiredate','employmentstart','startdate'],
      neg: [], w: 3
    },
    workEndDate: {
      kw: ['离职时间','结束工作','work end','employment end','结束时间','end date','to'],
      ex: ['workenddate','jobenddate','leavedate','employmentend','enddate'],
      neg: [], w: 3
    },
    jobDescription: {
      kw: ['工作描述','工作内容','职责','工作职责','岗位描述','job description','responsibility','duties'],
      ex: ['jobdescription','description','responsibility','workdesc','duties','jobdesc'],
      neg: ['self','自我','项目描述','projectdesc'], w: 4
    },
    expectedSalary: {
      kw: ['期望薪资','薪资','期望薪酬','期望工资','薪资要求','salary','compensation','expected salary','desired salary','salary expectation'],
      ex: ['salary','expectedsalary','compensation','wage','xzqw'],
      neg: [], w: 4
    },
    expectedJob: {
      kw: ['期望职位','意向职位','求职意向','期望岗位','目标职位'],
      ex: ['expectedjob','expectedposition','targetjob','intention','desiredposition','qzyx'],
      neg: [], w: 4
    },
    workYears: {
      kw: ['工作年限','工作经验','经验年限','work years','years of experience','years of work experience'],
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
      kw: ['个人网站','网站','github','主页','website','homepage','blog','portfolio','portfolio url','personal website','web site'],
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
  window.__RF_MATCHERS__ = {
    AUTOCOMPLETE_MAP,
    FIELD_MATCHERS,
    FIELD_LABELS,
  };
})();