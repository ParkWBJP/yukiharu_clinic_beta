// Korea regions (sido → sigungu). Labels include Korean and optional Japanese.
// For Japanese labels not provided, fallback to Korean in UI.

const regions = [
  {
    id: 'seoul',
    labelKo: '서울특별시',
    labelJp: 'ソウル特別市',
    districts: [
      ['gangnam', '강남구', 'カンナム（江南）区'],
      ['gangdong', '강동구', 'カンドン（江東）区'],
      ['gangbuk', '강북구', 'カンブク（江北）区'],
      ['gangseo', '강서구', 'カンソ（江西）区'],
      ['gwanak', '관악구', 'クァナク（冠岳）区'],
      ['gwangjin', '광진구', 'クァンジン（広津）区'],
      ['guro', '구로구', 'グロ（九老）区'],
      ['geumcheon', '금천구', 'クムチョン（金泉）区'],
      ['nowon', '노원구', 'ノウォン（蘆原）区'],
      ['dobong', '도봉구', 'トボン（道峰）区'],
      ['dongdaemun', '동대문구', 'トンデムン（東大門）区'],
      ['dongjak', '동작구', 'トンジャク（銅雀）区'],
      ['mapo', '마포구', 'マポ（麻浦）区'],
      ['seodaemun', '서대문구', 'ソデムン（西大門）区'],
      ['seocho', '서초구', 'ソチョ（瑞草）区'],
      ['seongdong', '성동구', 'ソンドン（城東）区'],
      ['seongbuk', '성북구', 'ソンブク（城北）区'],
      ['songpa', '송파구', 'ソンパ（松坡）区'],
      ['yangcheon', '양천구', 'ヤンチョン（陽川）区'],
      ['yeongdeungpo', '영등포구', 'ヨンドゥンポ（永登浦）区'],
      ['yongsan', '용산구', 'ヨンサン（龍山）区'],
      ['eunpyeong', '은평구', 'ウンピョン（恩平）区'],
      ['jongno', '종로구', 'チョンノ（鐘路）区'],
      ['jung', '중구', 'チュン（中）区'],
      ['jungnang', '중랑구', 'チュンナン（中浪）区']
    ]
  },
  {
    id: 'busan',
    labelKo: '부산광역시',
    labelJp: 'プサン（釜山）広域市',
    districts: [
      ['jung', '중구'], ['seo', '서구'], ['dong', '동구'], ['yeongdo', '영도구'],
      ['busanjin', '부산진구'], ['dongnae', '동래구'], ['nam', '남구'], ['buk', '북구'],
      ['haeundae', '해운대구'], ['saha', '사하구'], ['geumjeong', '금정구'], ['gangseo', '강서구'],
      ['yeonje', '연제구'], ['suyeong', '수영구'], ['sasang', '사상구'], ['gijang', '기장군']
    ]
  },
  {
    id: 'daegu',
    labelKo: '대구광역시',
    labelJp: 'テグ（大邱）広域市',
    districts: [
      ['jung', '중구'], ['dong', '동구'], ['seo', '서구'], ['nam', '남구'], ['buk', '북구'],
      ['suseong', '수성구'], ['dalseo', '달서구'], ['dalseong', '달성군'], ['gunwi', '군위군']
    ]
  },
  {
    id: 'incheon',
    labelKo: '인천광역시',
    labelJp: 'インチョン（仁川）広域市',
    districts: [
      ['jung', '중구'], ['dong', '동구'], ['michuhol', '미추홀구'], ['yeonsu', '연수구'],
      ['namdong', '남동구'], ['bupyeong', '부평구'], ['gyeyang', '계양구'], ['seo', '서구'],
      ['ganghwa', '강화군'], ['ongjin', '옹진군']
    ]
  },
  {
    id: 'gwangju', labelKo: '광주광역시', labelJp: 'クァンジュ（光州）広域市',
    districts: [['dong', '동구'], ['seo', '서구'], ['nam', '남구'], ['buk', '북구'], ['gwangsan', '광산구']]
  },
  {
    id: 'daejeon', labelKo: '대전광역시', labelJp: 'テジョン（大田）広域市',
    districts: [['dong', '동구'], ['jung', '중구'], ['seo', '서구'], ['yuseong', '유성구'], ['daedeok', '대덕구']]
  },
  {
    id: 'ulsan', labelKo: '울산광역시', labelJp: 'ウルサン（蔚山）広域市',
    districts: [['jung', '중구'], ['nam', '남구'], ['dong', '동구'], ['buk', '북구'], ['ulju', '울주군']]
  },
  {
    id: 'sejong', labelKo: '세종특별자치시', labelJp: 'セジョン特別自治市',
    districts: [['sejong', '세종시']]
  },
  {
    id: 'gyeonggi', labelKo: '경기도', labelJp: '京畿道',
    districts: [
      ['suwon', '수원시'], ['seongnam', '성남시'], ['uijeongbu', '의정부시'], ['anyang', '안양시'], ['bucheon', '부천시'],
      ['gwangmyeong', '광명시'], ['pyeongtaek', '평택시'], ['dongducheon', '동두천시'], ['ansan', '안산시'], ['goyang', '고양시'],
      ['gwacheon', '과천시'], ['guri', '구리시'], ['namyangju', '남양주시'], ['osan', '오산시'], ['siheung', '시흥시'],
      ['gunpo', '군포시'], ['uiwang', '의왕시'], ['hanam', '하남시'], ['yongin', '용인시'], ['paju', '파주시'],
      ['icheon', '이천시'], ['anseong', '안성시'], ['gimpo', '김포시'], ['hwaseong', '화성시'], ['gwangju', '광주시'],
      ['yangju', '양주시'], ['pocheon', '포천시'], ['yeoju', '여주시'], ['yeoncheon', '연천군'], ['gapyeong', '가평군'], ['yangpyeong', '양평군']
    ]
  },
  {
    id: 'gangwon', labelKo: '강원특별자치도', labelJp: '江原特別自治道',
    districts: [
      ['chuncheon', '춘천시'], ['wonju', '원주시'], ['gangneung', '강릉시'], ['donghae', '동해시'], ['taebaek', '태백시'],
      ['sokcho', '속초시'], ['samcheok', '삼척시'], ['hongcheon', '홍천군'], ['hoengseong', '횡성군'], ['yeongwol', '영월군'],
      ['pyeongchang', '평창군'], ['jeongseon', '정선군'], ['cheorwon', '철원군'], ['hwacheon', '화천군'], ['yanggu', '양구군'],
      ['inje', '인제군'], ['goseong', '고성군'], ['yangyang', '양양군']
    ]
  },
  {
    id: 'chungbuk', labelKo: '충청북도', labelJp: '忠清北道',
    districts: [
      ['cheongju', '청주시'], ['chungju', '충주시'], ['jecheon', '제천시'], ['boeun', '보은군'], ['okcheon', '옥천군'],
      ['yeongdong', '영동군'], ['jincheon', '진천군'], ['goesan', '괴산군'], ['eumseong', '음성군'], ['danyang', '단양군'], ['jeungpyeong', '증평군']
    ]
  },
  {
    id: 'chungnam', labelKo: '충청남도', labelJp: '忠清南道',
    districts: [
      ['cheonan', '천안시'], ['gongju', '공주시'], ['boryeong', '보령시'], ['asan', '아산시'], ['seosan', '서산시'],
      ['nonsan', '논산시'], ['gyeryong', '계룡시'], ['dangjin', '당진시'], ['geumsan', '금산군'], ['buyeo', '부여군'],
      ['seocheon', '서천군'], ['cheongyang', '청양군'], ['hongseong', '홍성군'], ['yesan', '예산군'], ['taean', '태안군']
    ]
  },
  {
    id: 'jeonbuk', labelKo: '전라북도', labelJp: '全羅北道',
    districts: [
      ['jeonju', '전주시'], ['gunsan', '군산시'], ['iksan', '익산시'], ['jeongeup', '정읍시'], ['namwon', '남원시'],
      ['gimje', '김제시'], ['wanju', '완주군'], ['jinan', '진안군'], ['muju', '무주군'], ['janggsu', '장수군'],
      ['imsil', '임실군'], ['sunchang', '순창군'], ['gochang', '고창군'], ['buan', '부안군']
    ]
  },
  {
    id: 'jeonnam', labelKo: '전라남도', labelJp: '全羅南道',
    districts: [
      ['mokpo', '목포시'], ['yeosu', '여수시'], ['suncheon', '순천시'], ['naj u', '나주시'], ['gwangyang', '광양시'],
      ['damyang', '담양군'], ['gokseong', '곡성군'], ['gurye', '구례군'], ['goheung', '고흥군'], ['boseong', '보성군'],
      ['hwaseongjn', '화순군'], ['jangheung', '장흥군'], ['gangjin', '강진군'], ['haenam', '해남군'], ['yeongam', '영암군'],
      ['muan', '무안군'], ['hampyeong', '함평군'], ['yeonggwang', '영광군'], ['jangseong', '장성군'], ['wando', '완도군'],
      ['jindo', '진도군'], ['shinan', '신안군']
    ]
  },
  {
    id: 'gyeongbuk', labelKo: '경상북도', labelJp: '慶尚北道',
    districts: [
      ['pohang', '포항시'], ['gyeongju', '경주시'], ['gimcheon', '김천시'], ['andong', '안동시'], ['gumi', '구미시'],
      ['yeongju', '영주시'], ['yeongcheon', '영천시'], ['sangju', '상주시'], ['mungyeong', '문경시'], ['gyeongsan', '경산시'],
      ['uiseong', '의성군'], ['cheongsong', '청송군'], ['yeongyang', '영양군'], ['yeongdeok', '영덕군'], ['cheongdo', '청도군'],
      ['goryeong', '고령군'], ['seongju', '성주군'], ['chilgok', '칠곡군'], ['yecheon', '예천군'], ['bonghwa', '봉화군'],
      ['uljin', '울진군'], ['ulleung', '울릉군']
    ]
  },
  {
    id: 'gyeongnam', labelKo: '경상남도', labelJp: '慶尚南道',
    districts: [
      ['changwon', '창원시'], ['jinju', '진주시'], ['tongyeong', '통영시'], ['sacheon', '사천시'], ['gimhae', '김해시'],
      ['miryang', '밀양시'], ['geoje', '거제시'], ['yangsan', '양산시'], ['uiryeong', '의령군'], ['haman', '함안군'],
      ['changnyeong', '창녕군'], ['goseong', '고성군'], ['namhae', '남해군'], ['hadong', '하동군'], ['sancheong', '산청군'],
      ['hamyang', '함양군'], ['geochang', '거창군'], ['hapcheon', '합천군']
    ]
  },
  {
    id: 'jeju', labelKo: '제주특별자치도', labelJp: '済州特別自治道',
    districts: [['jeju', '제주시'], ['seogwipo', '서귀포시']]
  }
];

export default regions;

