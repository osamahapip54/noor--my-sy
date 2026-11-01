const library = [];
const sampleTracks = Array(8).fill(null);
let savedSampleIds = [];
const sampleVoices = new Map();
const trackAnalysisPromises = new Map();
const DECK_IDS = ['a', 'b', 'c', 'd'];
const decks = Object.fromEntries(DECK_IDS.map((id) => [id, {
  audio: null,
  source: null,
  gain: null,
  analyser: null,
  filters: {},
  frequencyData: null,
  track: null,
  seeking: false,
  cues: Array(8).fill(null),
  customLoop: null,
  padLoop: null,
  rollTimeout: null,
  rollResumeTime: null,
  stemMedia: [],
  stemUrls: [],
  headphoneCue: false,
  syncSourceId: null,
  fx: {}
}]));

let audioContext;
let masterGain;
let masterMeterAnalyser;
let masterMeterData;
let masterDestination;
let headphoneDestination;
let headphoneMasterGain;
let masterFallbackGain;
let masterOutputPlayer;
let headphoneOutputPlayer;
let activeRecorder = null;
let recordingChunks = [];
let recordingStartedAt = 0;
let recordingTimer = null;
let crossfadeGains = {};
const headphoneCueGains = {};
let toastTimeout;
let midiAccess;
let midiMappings = {};
let midiLearning = false;
let midiLearningTarget = null;
let midiActivityTimeout = null;
let midiControllersEnabled = true;
let fourDeckMode = false;
let currentLanguage = 'ar';
let activeLibraryFolder = '';
let audioOutputSettings = { masterDeviceId: '', headphoneDeviceId: '', cueMix: 0 };
let audioOutputDevices = [];

const $ = (selector) => document.querySelector(selector);

const arabicToEnglish = new Map(Object.entries({
  'استوديو الدي جي': 'DJ Studio',
  'جلسة جديدة': 'New session',
  'معلومات': 'Help',
  'مساحة العمل': 'Workspace',
  'خلّ الموسيقى': 'Let the music',
  'تتكلم.': 'speak.',
  'رتّب مجموعتك، جهّز المسارين، واصنع انتقالك القادم.': 'Organize your collection, cue your decks, and create your next transition.',
  'الرئيسي': 'Master',
  'مستوى الصوت الرئيسي': 'Master volume',
  'استيراد موسيقى': 'Import music',
  '＋ استيراد موسيقى': '＋ Import music',
  'تفعيل 4 عجلات': 'Enable 4 decks',
  'العودة إلى عجلتين': 'Switch to 2 decks',
  'مشغلات الدي جي': 'DJ decks',
  'مشغلات الدي جي': 'DJ decks',
  'المشغل A': 'Deck A',
  'المشغل B': 'Deck B',
  'المشغل C': 'Deck C',
  'المشغل D': 'Deck D',
  'جاهز للمزج': 'Ready to mix',
  'متوقف مؤقتًا': 'Paused',
  'قيد التشغيل': 'Playing',
  'تحميل مسار': 'Load track',
  'لا يوجد مسار': 'No track loaded',
  'اختر أغنية من مكتبتك للبدء': 'Choose a track from your library to begin',
  'خيارات المسار': 'Track options',
  'اسحب العجلة للخدش والتحريك': 'Drag the jog wheel to scratch or seek',
  'عجلة تحكم A': 'A jog wheel',
  'عجلة تحكم B': 'B jog wheel',
  'موجة الصوت للمسار A': 'A waveform',
  'موجة الصوت للمسار B': 'B waveform',
  'حمّل مسارًا لبدء التشغيل': 'Load a track to begin playback',
  'موضع التشغيل A': 'A playback position',
  'موضع التشغيل B': 'B playback position',
  'تشغيل أو إيقاف A': 'Play or pause A',
  'تشغيل أو إيقاف B': 'Play or pause B',
  'تكرار المسار A': 'Loop track A',
  'تكرار المسار B': 'Loop track B',
  'السرعة': 'Tempo',
  'مستوى المسار': 'Channel level',
  'الميكسر': 'Mixer',
  'ميكسر الصوت': 'Audio mixer',
  'مستويات قنوات الميكسر': 'Mixer channel levels',
  'مزامنة سرعة المشغل A مع مشغل آخر': 'Sync deck A tempo to another deck',
  'مزامنة سرعة المشغل B مع مشغل آخر': 'Sync deck B tempo to another deck',
  'مزامنة سرعة المشغل C مع مشغل آخر': 'Sync deck C tempo to another deck',
  'مزامنة سرعة المشغل D مع مشغل آخر': 'Sync deck D tempo to another deck',
  'تحليل': 'Analyze',
  'معلومات المسار': 'Track information',
  'تحليل المسار': 'Track analysis',
  'تحليل محلي للصوت والبيانات الوصفية': 'Local audio and metadata analysis',
  'يُقرأ النوع الموسيقي من وسوم الملف؛ لا يُخمَّن عند غيابها.': 'Genre is read from the file tags and is not guessed when tags are missing.',
  'اكتمل التحليل المحلي.': 'Local analysis complete.',
  'اكتمل تحليل الملف؛ لم يتم العثور على سرعة واضحة أو وسم BPM.': 'File analysis is complete; no clear tempo or BPM tag was found.',
  'اكتملت قراءة بيانات الملف، لكن تعذر تقدير BPM': 'File metadata was read, but BPM could not be estimated',
  'تعذر تحليل المسار': 'Could not analyze track',
  'إعادة التحليل': 'Analyze again',
  'إغلاق': 'Close',
  'إغلاق معلومات المسار': 'Close track information',
  'جارٍ قراءة معلومات الملف وتحليل الإيقاع…': 'Reading file information and analyzing tempo…',
  'MASTER': 'MASTER',
  'المتحكم': 'Controller',
  'وسادات MIDI': 'MIDI pads',
  'اختر متحكم MIDI': 'Select a MIDI controller',
  'المشغل المستهدف لوسادات MIDI المشتركة': 'Target deck for shared MIDI pads',
  'التسجيل': 'Recording',
  'بدء التسجيل': 'Start recording',
  'إيقاف التسجيل': 'Stop recording',
  'الأجهزة والتسجيل': 'Devices and recording',
  'صندوق العينات': 'Sample box',
  '＋ استيراد عينات': '＋ Import samples',
  'وسادات الأداء': 'Performance pads',
  'الوضع': 'Mode',
  'مسح Cue': 'Clear Cue',
  'إضافة مجلد': 'Add folder',
  '＋ إضافة مجلد': '＋ Add folder',
  '＋ إضافة أغاني': '＋ Add tracks',
  'عرض المكتبة': 'Open library',
  'المجموعة الصوتية': 'Music collection',
  'مكتبة الموسيقى': 'Music library',
  'مجلدات الموسيقى': 'Music folders',
  'إضافة إلى': 'Load to',
  'المجلد': 'Folder',
  'كل المجلدات': 'All folders',
  'ملفات منفردة': 'Individual files',
  'ملف صوتي محلي': 'Local audio file',
  'ابحث عن أغنية...': 'Search tracks...',
  'لا توجد مسارات مطابقة.': 'No matching tracks.',
  'استورد الموسيقى لبناء مكتبتك.': 'Import music to build your library.',
  'PFL · سماعة الرأس': 'PFL · Headphones',
  'مؤثرات A': 'Effects A',
  'مؤثرات B': 'Effects B',
  'مؤثرات C': 'Effects C',
  'مؤثرات D': 'Effects D',
  'مؤثرات ووسادات المشغل A': 'Deck A effects and pads',
  'مؤثرات ووسادات المشغل B': 'Deck B effects and pads',
  'مؤثرات ووسادات المشغل C': 'Deck C effects and pads',
  'مؤثرات ووسادات المشغل D': 'Deck D effects and pads',
  'سرعة التقطيع': 'Chop rate',
  'الترددات العالية A': 'A high frequencies',
  'الترددات المتوسطة A': 'A mid frequencies',
  'الترددات المنخفضة A': 'A low frequencies',
  'الترددات العالية B': 'B high frequencies',
  'الترددات المتوسطة B': 'B mid frequencies',
  'الترددات المنخفضة B': 'B low frequencies',
  'أزرار المؤثرات السريعة A': 'A quick effects',
  'أزرار المؤثرات السريعة B': 'B quick effects',
  'فصل Stems AI': 'Separate stems with AI',
  'فصل محلي لنحو 172 MiB من النموذج عند أول استخدام': 'Downloads a ~172 MiB model on first use; runs locally',
  'المسار كامل': 'Full track',
  'المزج المتقاطع': 'Crossfader',
  'مزج سلس': 'Smooth mix',
  'المزج بين المسارين A وB': 'Crossfade between decks A and B',
  'فتح مكتبة الموسيقى': 'Open music library',
  'إغلاق مكتبة الموسيقى': 'Close music library',
  'تصغير مكتبة الموسيقى': 'Minimize music library',
  'استعادة مكتبة الموسيقى': 'Restore music library',
  'ملء الشاشة': 'Full screen',
  'ملء الشاشة (F11)': 'Full screen (F11)',
  'تفعيل وضع ملء الشاشة': 'Enter full screen',
  'إنهاء وضع ملء الشاشة': 'Exit full screen',
  'إعداد مخارج الصوت': 'Configure audio outputs',
  'مخارج الصوت': 'Audio outputs',
  'توجيه مستقل للصوت': 'Independent audio routing',
  'السماعات الرئيسية': 'Main speakers',
  'سماعات الرأس للمعاينة': 'Headphone cue output',
  'مخرج النظام الافتراضي': 'System default output',
  'غير مُعدّة — المعاينة متوقفة': 'Not configured — cue monitoring is off',
  'مزيج سماعات الرأس': 'Headphone mix',
  'معاينة Cue': 'Cue preview',
  'Cue فقط': 'Cue only',
  'الصوت الرئيسي': 'Master audio',
  'اختر مخرجًا مستقلًا لسماعات الرأس، ثم اضغط PFL على أي مشغّل لسماع معاينته دون إرسالها للسماعات الرئيسية.': 'Choose a separate headphone output, then press PFL on a deck to preview it without sending it to the main speakers.',
  'اختر مخرج سماعات الرأس أولًا.': 'Choose a headphone output first.',
  'حمّل مسارًا قبل معاينته في سماعات الرأس.': 'Load a track before cueing it in headphones.',
  'تعذر تعداد مخارج الصوت': 'Unable to list audio outputs',
  'تعذر تغيير مخرج الصوت': 'Unable to change the audio output',
  'مخرج سماعات الرأس غير متاح؛ اختر جهازًا آخر.': 'The headphone output is unavailable; choose another device.',
  'تعذر تشغيل مخرج الصوت': 'Unable to start an audio output',
  'اختر جهازين مختلفين لمخارج السماعات.': 'Choose different devices for the speaker outputs.',
  'مخرج النظام': 'System output',
  'جهاز صوت': 'Audio device',
  'الرئيسي فقط': 'Master only',
  'معاينة المسار A في سماعات الرأس': 'Cue deck A in headphones',
  'معاينة المسار B في سماعات الرأس': 'Cue deck B in headphones',
  'معاينة المسار C في سماعات الرأس': 'Cue deck C in headphones',
  'معاينة المسار D في سماعات الرأس': 'Cue deck D in headphones',
  'A فقط': 'A only',
  'متوازن': 'Center',
  'B فقط': 'B only',
  'أدوات الأداء': 'Performance',
  'المؤثرات والوسادات': 'Effects & pads',
  'المؤثرات والوسادات والتحكم الخارجي': 'Effects, pads, and external controls',
  'غير متصل': 'Disconnected',
  'اختر متحكم MIDI': 'Choose a MIDI controller',
  'تشغيل وحدات التحكم': 'Enable controllers',
  'إيقاف وحدات التحكم': 'Disable controllers',
  'وحدات التحكم الخارجية متوقفة': 'External controllers are disabled',
  'إيقاف استقبال التحكم الخارجي': 'Disable external controller input',
  'تشغيل استقبال التحكم الخارجي': 'Enable external controller input',
  'لا توجد أجهزة': 'No devices',
  'لم يتم العثور على متحكم MIDI. تحقق من اتصال USB أو تعريف الشركة المصنّعة ثم أعد المحاولة.': 'No MIDI controller found. Check the USB connection or manufacturer driver, then try again.',
  'تم اكتشاف متحكم، لكن لا تصل منه إشارات MIDI. تحقق من وضع MIDI في الجهاز أو من برنامجه المساعد.': 'A controller was detected, but it is not sending MIDI. Check its MIDI mode or companion software.',
  'تم توصيل': 'Connected',
  'تم استقبال MIDI': 'MIDI received',
  'خرائط تلقائية للعناصر الأساسية متاحة لـ Pioneer DDJ-200/400/FLX4/SB3 وHercules Inpulse 200/300/500 وNumark Party Mix وMixtrack Pro/Platinum FX. إذا لم تستجب بعض أزرار DDJ-200، استخدم «تعلّم التحكم»؛ التعيين اليدوي له الأولوية.': 'Automatic mappings for core controls are available for Pioneer DDJ-200/400/FLX4/SB3, Hercules Inpulse 200/300/500, Numark Party Mix, and Mixtrack Pro/Platinum FX. If some DDJ-200 controls do not respond, use MIDI Learn; manual mappings take priority.',
  'Pioneer DJ': 'Pioneer DJ',
  'Hercules DJ': 'Hercules DJ',
  'Numark': 'Numark',
  'يدعم التطبيق وحدات MIDI القياسية من Pioneer وHercules وNumark وغيرها عبر التعيين اليدوي. بعض الطرازات تحتاج تعريف الشركة أو لا تعرض أزرارها كـ MIDI.': 'Standard MIDI controllers from Pioneer, Hercules, Numark, and other brands are supported through MIDI learn. Some models require manufacturer drivers or do not expose controls as MIDI.',
  'تظهر واجهات الصوت الخاصة بالمتحكم في إعدادات مخارج الصوت إذا تعرّف عليها Windows.': 'A controller’s audio interface appears in audio output settings when recognized by Windows.',
  'توصيل MIDI': 'Connect MIDI',
  'تعلّم التحكم': 'Learn controls',
  'لوحة المؤثرات': 'Effects panel',
  'تحكم مستقل لكل مشغّل': 'Independent control for each deck',
  'المؤثر': 'Effect',
  'القطع': 'Cutoff',
  'زمن الصدى': 'Delay time',
  'حجم الغرفة': 'Room size',
  'عمق التموج': 'Flanger depth',
  'سرعة الطور': 'Phaser rate',
  'التشبع': 'Drive',
  'المزج': 'Wet mix',
  'تشغيل': 'On',
  'إيقاف': 'Off',
  'وسادات الأداء': 'Performance pads',
  'المشغّل': 'Deck',
  'الوضع': 'Mode',
  'مسح نقاط Cue': 'Clear Cue points',
  'صندوق العينات': 'Sample box',
  '＋ استيراد عينات': '＋ Import samples',
  'أفلت أغنية من المكتبة على خانة لتعيينها كعينة.': 'Drag a track from the library onto a slot to assign it as a sample.',
  'صل متحكم MIDI عبر USB أو Bluetooth، ثم اختر «تعلّم التحكم» واربط أي زر أو منزلق.': 'Connect a USB or Bluetooth MIDI controller, choose “Learn controls,” then map any button or slider.',
  'فصل Stems بالذكاء الاصطناعي يتم محليًا؛ يُنزّل نموذجًا موثوقًا بحجم يقارب 172 MiB عند أول فصل ولا تُرفع الأغاني إلى أي خادم.': 'AI stem separation runs locally. A verified ~172 MiB model is downloaded once; your music is never uploaded.',
  'مجموعتك الصوتية': 'Your collection',
  'مكتبة الموسيقى': 'Music library',
  'ابحث عن أغنية...': 'Search tracks...',
  'ابحث في المكتبة': 'Search the library',
  '＋ إضافة مجلد': '＋ Add folder',
  '＋ إضافة أغاني': '＋ Add tracks',
  'المسار': 'Track',
  'المدة': 'Duration',
  'إضافة إلى': 'Load to',
  'مكتبتك تبدأ من هنا': 'Your library starts here',
  'استورد ملفاتك الصوتية وجهّزها للمزج.': 'Import your music and get ready to mix.',
  'استيراد الموسيقى': 'Import music',
  'ملف صوتي محلي': 'Local audio file',
  'لا توجد نتائج مطابقة': 'No matching results',
  'جرّب البحث باسم ملف آخر.': 'Try searching for a different file name.',
  'ملف صوتي': 'Audio file',
  'المسار كامل': 'Full track',
  'اختر مسارًا من مكتبتك أولًا.': 'Choose a track from your library first.',
  'جميع الأجهزة': 'All devices',
  'كل الأجهزة': 'All devices',
  'غير متصل': 'Disconnected',
  'متصل': 'Connected',
  'بانتظار إشارة MIDI': 'Waiting for MIDI input',
  'بانتظار اختيار عنصر': 'Waiting for a control selection',
  'تم حفظ التعيين': 'Mapping saved',
  'تعذر الاتصال': 'Connection failed',
  'تعذر فصل المسار': 'Stem separation failed',
  'تعذر تحميل المسار': 'Unable to load track',
  'تفعيل MIDI': 'Enable MIDI',
  'Change language': 'Change language',
  'حمّل مسارًا قبل استخدام CUE.': 'Load a track before using CUE.',
  'حمّل مسارًا قبل تفعيل التكرار.': 'Load a track before enabling loop.',
  'اختر أغنية من المكتبة أولًا.': 'Choose a track from the library first.',
  'تم مسح نقاط Hot Cue للمشغّل المحدد.': 'Hot Cue points cleared for the selected deck.',
  'اختر مجلد الموسيقى': 'Choose a music folder',
  'تعذر استيراد المجلدات': 'Unable to import folders',
  'تعذر استيراد الملفات': 'Unable to import files',
  'استوديو الدي جي الخاص بك': 'Your DJ studio',
  'امزج أغانيك، أنشئ إيقاعاتك، وتحكم بكل تفصيل من مكان واحد.': 'Mix your tracks, create beats, and control every detail from one place.',
  'مزايا NOOR DJ': 'NOOR DJ features',
  '٤ عجلات دي جي': '4 DJ decks',
  'منشئ إيقاعات': 'Beat maker',
  'مؤثرات وStems': 'Effects & stems',
  'ابدأ المزج': 'Start mixing',
  'النمط': 'Pattern',
  'فارغ': 'Empty',
  'مستوى الإيقاع': 'Beat level',
  'اسم الإيقاع': 'Beat name',
  'إيقاعي الجديد': 'My new beat',
  'حفظ الإيقاع': 'Save beat',
  'إيقاعاتي': 'My beats',
  'المحفوظة': 'Saved beats',
  'اختر نمطًا أو انقر الخطوات لصنع إيقاعك، ثم اضغط تشغيل.': 'Choose a pattern or click steps to make a beat, then press play.',
  '▶ تشغيل': '▶ Play',
  '■ إيقاف': '■ Stop',
  'حفظ': 'Save',
  'اختر إيقاعًا محفوظًا.': 'Choose a saved beat.',
  'اكتب اسمًا للإيقاع قبل حفظه.': 'Enter a name for your beat before saving.',
  'تم حفظ الإيقاع.': 'Beat saved.',
  'تعذر حفظ الإيقاع': 'Unable to save the beat',
  'تعذر قراءة الإيقاعات المحفوظة': 'Unable to read saved beats',
  'تعذر تشغيل الإيقاع': 'Unable to play the beat',
  'Kick': 'Kick',
  'Snare': 'Snare',
  'Closed Hat': 'Closed Hat',
  'Open Hat': 'Open Hat',
  'Clap': 'Clap',
  'ركلة': 'Kick',
  'سنير': 'Snare',
  'هاي هات مغلق': 'Closed Hat',
  'هاي هات مفتوح': 'Open Hat',
  'تصفيق': 'Clap',
  'مسارًا': 'tracks',
  'أضيفت': 'added'
}));
const englishToArabic = new Map([...arabicToEnglish].map(([arabic, english]) => [english, arabic]));

try {
  currentLanguage = localStorage.getItem('noor-dj-language') === 'en' ? 'en' : 'ar';
} catch (error) {
  showToast(`تعذر قراءة اللغة المحفوظة: ${error.message}`);
}

function translatedText(value) {
  const trimmed = value.trim();
  const dictionary = currentLanguage === 'en' ? arabicToEnglish : englishToArabic;
  const replacement = dictionary.get(trimmed);
  if (replacement) return value.replace(trimmed, replacement);
  if (currentLanguage === 'en') {
    const deckLabels = [
      [/^المشغل ([A-D])$/, 'Deck $1'],
      [/^مؤثرات ([A-D])$/, 'Deck $1 effects'],
      [/^عجلة تحكم ([A-D])$/, '$1 jog wheel'],
      [/^موجة الصوت للمسار ([A-D])$/, 'Deck $1 waveform'],
      [/^موضع التشغيل ([A-D])$/, 'Deck $1 playback position'],
      [/^تشغيل أو إيقاف ([A-D])$/, 'Play or pause deck $1'],
      [/^تكرار المسار ([A-D])$/, 'Loop deck $1'],
      [/^الترددات العالية ([A-D])$/, 'Deck $1 high frequencies'],
      [/^الترددات المتوسطة ([A-D])$/, 'Deck $1 mid frequencies'],
      [/^الترددات المنخفضة ([A-D])$/, 'Deck $1 low frequencies'],
      [/^أزرار المؤثرات السريعة ([A-D])$/, 'Deck $1 quick effects']
    ];
    for (const [pattern, english] of deckLabels) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, english));
    }
    const modelProgress = trimmed.match(/^تنزيل نموذج AI (\d+%)$/);
    if (modelProgress) return value.replace(trimmed, `Downloading AI model ${modelProgress[1]}`);
    const separationProgress = trimmed.match(/^فصل AI (\d+%)$/);
    if (separationProgress) return value.replace(trimmed, `AI separation ${separationProgress[1]}`);
    if (trimmed.startsWith('ملف صوتي · ')) return value.replace(trimmed, `Audio file · ${trimmed.slice('ملف صوتي · '.length)}`);
    const availableDevices = trimmed.match(/^(\d+) جهاز متاح$/);
    if (availableDevices) return value.replace(trimmed, `${availableDevices[1]} devices available`);
    const trackLoad = trimmed.match(/^تحميل (.+) على المسار ([A-D])$/);
    if (trackLoad) return value.replace(trimmed, `Load ${trackLoad[1]} to deck ${trackLoad[2]}`);
    const sampleNumber = trimmed.match(/^(تشغيل العينة|خانة عينة|إفراغ العينة) (\d+)( فارغة)?$/);
    if (sampleNumber) {
      const actions = { 'تشغيل العينة': 'Play sample', 'خانة عينة': 'Sample slot', 'إفراغ العينة': 'Clear sample' };
      return value.replace(trimmed, `${actions[sampleNumber[1]]} ${sampleNumber[2]}${sampleNumber[3] ? ' empty' : ''}`);
    }
    const emptySample = trimmed.match(/^عينة (\d+) · فارغة$/);
    if (emptySample) return value.replace(trimmed, `Sample ${emptySample[1]} · Empty`);
    const loadedTrack = trimmed.match(/^تم تحميل (.+) على المسار ([A-D])$/);
    if (loadedTrack) return value.replace(trimmed, `Loaded ${loadedTrack[1]} on deck ${loadedTrack[2]}`);
    const assignedSample = trimmed.match(/^تم تعيين (.+) على العينة (\d+)\.$/);
    if (assignedSample) return value.replace(trimmed, `Assigned ${assignedSample[1]} to sample ${assignedSample[2]}.`);
    const separated = trimmed.match(/^اكتمل فصل .* للمشغّل ([A-D])\.$/);
    if (separated) return value.replace(trimmed, `Stem separation complete for deck ${separated[1]}.`);
    const emptyDeck = trimmed.match(/^حمّل مسارًا على المشغّل ([A-D]) أولًا\.$/);
    if (emptyDeck) return value.replace(trimmed, `Load a track on deck ${emptyDeck[1]} first.`);
    if (trimmed.startsWith('تعذر ')) return value.replace(trimmed, `Unable to complete this action: ${trimmed.slice('تعذر '.length)}`);
    if (trimmed.startsWith('فشل ')) return value.replace(trimmed, `Failed: ${trimmed.slice('فشل '.length)}`);
  } else {
    const emptySample = trimmed.match(/^Sample (\d+) · Empty$/);
    if (emptySample) return value.replace(trimmed, `عينة ${emptySample[1]} · فارغة`);
    const dynamicDeckLabels = [
      [/^Deck ([A-D])$/, (_, id) => `المشغل ${id}`],
      [/^Deck effects ([A-D])$/, (_, id) => `مؤثرات ${id}`],
      [/^([A-D]) jog wheel$/, (_, id) => `عجلة تحكم ${id}`],
      [/^Deck ([A-D]) waveform$/, (_, id) => `موجة الصوت للمسار ${id}`],
      [/^Deck ([A-D]) playback position$/, (_, id) => `موضع التشغيل ${id}`],
      [/^Play or pause deck ([A-D])$/, (_, id) => `تشغيل أو إيقاف ${id}`],
      [/^Loop deck ([A-D])$/, (_, id) => `تكرار المسار ${id}`],
      [/^Deck ([A-D]) high frequencies$/, (_, id) => `الترددات العالية ${id}`],
      [/^Deck ([A-D]) mid frequencies$/, (_, id) => `الترددات المتوسطة ${id}`],
      [/^Deck ([A-D]) low frequencies$/, (_, id) => `الترددات المنخفضة ${id}`],
      [/^Deck ([A-D]) quick effects$/, (_, id) => `أزرار المؤثرات السريعة ${id}`]
    ];
    for (const [pattern, arabic] of dynamicDeckLabels) {
      if (pattern.test(trimmed)) return value.replace(trimmed, trimmed.replace(pattern, arabic));
    }
  }
  return value;
}

function translateSubtree(root) {
  const translateNode = (node) => {
    const updated = translatedText(node.nodeValue);
    if (updated !== node.nodeValue) node.nodeValue = updated;
  };
  if (root.nodeType === Node.TEXT_NODE) {
    translateNode(root);
    return;
  }
  if (!(root instanceof Element)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) translateNode(walker.currentNode);
  for (const element of [root, ...root.querySelectorAll('*')]) {
    for (const attribute of ['aria-label', 'placeholder', 'title']) {
      const value = element.getAttribute(attribute);
      const updated = value && translatedText(value);
      if (updated && updated !== value) element.setAttribute(attribute, updated);
    }
  }
}

function applyLanguage() {
  document.documentElement.lang = currentLanguage;
  document.documentElement.dir = currentLanguage === 'en' ? 'ltr' : 'rtl';
  for (const button of [$('#language-toggle'), $('#welcome-language-toggle')]) {
    button.textContent = currentLanguage === 'en' ? 'عربي' : 'EN';
    button.setAttribute('aria-label', currentLanguage === 'en' ? 'Switch to Arabic' : 'Switch to English');
  }
  translateSubtree(document.body);
}

function cloneDeckElement(source, from, to) {
  const clone = source.cloneNode(true);
  for (const element of [clone, ...clone.querySelectorAll(`.deck-${from}`)]) {
    element.classList.remove(`deck-${from}`);
    element.classList.add(`deck-${to}`);
  }
  if (clone.dataset.deck === from) clone.dataset.deck = to;
  clone.querySelectorAll('[id]').forEach((element) => {
    if (element.id.endsWith(`-${from}`)) {
      element.id = `${element.id.slice(0, -from.length)}${to}`;
    }
  });
  clone.querySelectorAll('[for]').forEach((element) => {
    if (element.htmlFor.endsWith(`-${from}`)) {
      element.htmlFor = `${element.htmlFor.slice(0, -from.length)}${to}`;
    }
  });
  clone.querySelectorAll('[data-deck]').forEach((element) => {
    if (element.dataset.deck === from) element.dataset.deck = to;
  });
  clone.querySelectorAll('[data-load]').forEach((element) => {
    if (element.dataset.load === from) element.dataset.load = to;
  });
  clone.querySelectorAll('[aria-label]').forEach((element) => {
    element.setAttribute('aria-label', element.getAttribute('aria-label').replaceAll(` ${from.toUpperCase()}`, ` ${to.toUpperCase()}`));
  });
  clone.querySelectorAll('[title]').forEach((element) => {
    element.title = element.title.replaceAll(` ${from.toUpperCase()}`, ` ${to.toUpperCase()}`);
  });
  clone.querySelector('.deck-letter').textContent = to.toUpperCase();
  clone.querySelector('.effect-channel-heading .deck-letter').textContent = to.toUpperCase();
  const heading = clone.querySelector('.deck-label h2');
  if (heading) heading.textContent = `المشغل ${to.toUpperCase()}`;
  const recordLabel = clone.querySelector('.record-label');
  if (recordLabel) recordLabel.textContent = to.toUpperCase();
  const jogCenter = clone.querySelector('.jog-center');
  if (jogCenter) jogCenter.textContent = to.toUpperCase();
  const effectHeading = clone.querySelector('.effect-channel-heading strong');
  if (effectHeading) effectHeading.textContent = `مؤثرات ${to.toUpperCase()}`;
  const padPanel = clone.querySelector('.deck-performance');
  if (padPanel) padPanel.setAttribute('aria-label', `مؤثرات ووسادات المشغل ${to.toUpperCase()}`);
  return clone;
}

function createFourDeckControls() {
  const deckGrid = $('.decks');
  deckGrid.append(
    cloneDeckElement($('.deck-a'), 'a', 'c'),
    cloneDeckElement($('.deck-b'), 'b', 'd')
  );
}

for (const id of ['a', 'b']) {
  $(`.deck-${id} .jog-control`).append($(`.deck-${id} .deck-performance`));
}

createFourDeckControls();

try {
  const savedMappings = JSON.parse(localStorage.getItem('mixdeck-midi-mappings') || '{}');
  if (!savedMappings || typeof savedMappings !== 'object' || Array.isArray(savedMappings)) {
    throw new Error('صيغة التعيينات غير صالحة.');
  }
  midiMappings = savedMappings;
} catch (error) {
  showToast(`تعذر قراءة تعيينات MIDI المحفوظة: ${error.message}`);
}

try {
  midiControllersEnabled = localStorage.getItem('mixdeck-midi-enabled') !== 'false';
} catch (error) {
  showToast(`تعذر قراءة إعداد وحدات التحكم الخارجية: ${error.message}`);
}

try {
  const saved = JSON.parse(localStorage.getItem('mixdeck-sample-slots') || '[]');
  if (!Array.isArray(saved) || saved.length > sampleTracks.length || saved.some((id) => id !== null && typeof id !== 'string')) {
    throw new Error('صيغة صندوق العينات غير صالحة.');
  }
  savedSampleIds = saved;
} catch (error) {
  showToast(`تعذر قراءة صندوق العينات المحفوظ: ${error.message}`);
}

const formatTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

function showToast(message) {
  const toast = $('#toast');
  toast.textContent = translatedText(message);
  toast.classList.add('visible');
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove('visible'), 2600);
}

function loadAudioOutputSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem('noor-dj-audio-outputs') || '{}');
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
      throw new Error('صيغة إعدادات مخارج الصوت غير صالحة.');
    }
    audioOutputSettings = {
      masterDeviceId: typeof saved.masterDeviceId === 'string' ? saved.masterDeviceId : '',
      headphoneDeviceId: typeof saved.headphoneDeviceId === 'string' ? saved.headphoneDeviceId : '',
      cueMix: Number.isInteger(saved.cueMix) ? Math.min(100, Math.max(0, saved.cueMix)) : 0
    };
  } catch (error) {
    showToast(`تعذر قراءة إعدادات مخارج الصوت: ${error.message}`);
  }
  $('#headphone-mix').value = String(audioOutputSettings.cueMix);
  updateHeadphoneMixLabel();
}

function saveAudioOutputSettings() {
  try {
    localStorage.setItem('noor-dj-audio-outputs', JSON.stringify(audioOutputSettings));
  } catch (error) {
    showToast(`تعذر حفظ إعدادات مخارج الصوت: ${error.message}`);
  }
}

function updateHeadphoneMixLabel() {
  const mix = audioOutputSettings.cueMix;
  const label = mix === 0
    ? 'Cue فقط'
    : mix === 100
      ? 'الرئيسي فقط'
      : currentLanguage === 'en'
        ? `${100 - mix}% Cue · ${mix}% Master`
        : `${100 - mix}% Cue · ${mix}% رئيسي`;
  $('#headphone-mix-value').textContent = translatedText(label);
}

function updateHeadphoneRouting() {
  if (!audioContext || !headphoneMasterGain) return;
  const mix = audioOutputSettings.cueMix / 100;
  const now = audioContext.currentTime;
  headphoneMasterGain.gain.setTargetAtTime(mix, now, 0.015);
  for (const id of DECK_IDS) {
    const enabled = decks[id].headphoneCue && Boolean(audioOutputSettings.headphoneDeviceId);
    headphoneCueGains[id].gain.setTargetAtTime(enabled ? 1 - mix : 0, now, 0.015);
    const button = $(`#headphone-cue-${id}`);
    button.setAttribute('aria-pressed', String(enabled));
    button.classList.toggle('active', enabled);
  }
}

function setAudioSettingsStatus(message) {
  $('#audio-settings-status').textContent = message ? translatedText(message) : '';
}

function renderAudioOutputOptions(select, placeholder, selectedId) {
  select.replaceChildren();
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = translatedText(placeholder);
  select.append(defaultOption);
  const selectableDevices = audioOutputDevices
    .filter((device) => device.deviceId && device.deviceId !== 'default');
  for (const [index, device] of selectableDevices.entries()) {
    const option = document.createElement('option');
    option.value = device.deviceId;
    option.textContent = device.label || `${translatedText('جهاز صوت')} ${index + 1}`;
    select.append(option);
  }
  select.value = selectedId;
}

async function refreshAudioOutputs() {
  try {
    audioOutputDevices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === 'audiooutput');
  } catch (error) {
    showToast(`تعذر تعداد مخارج الصوت: ${error.message}`);
    setAudioSettingsStatus(`تعذر تعداد مخارج الصوت: ${error.message}`);
    return;
  }

  const masterAvailable = !audioOutputSettings.masterDeviceId
    || audioOutputDevices.some((device) => device.deviceId === audioOutputSettings.masterDeviceId);
  const headphonesAvailable = !audioOutputSettings.headphoneDeviceId
    || audioOutputDevices.some((device) => device.deviceId === audioOutputSettings.headphoneDeviceId);
  if (!masterAvailable) {
    audioOutputSettings.masterDeviceId = '';
    setAudioSettingsStatus('مخرج النظام');
  }
  if (!headphonesAvailable) {
    audioOutputSettings.headphoneDeviceId = '';
    for (const id of DECK_IDS) decks[id].headphoneCue = false;
    $('#headphone-output').pause();
    setAudioSettingsStatus('مخرج سماعات الرأس غير متاح؛ اختر جهازًا آخر.');
    showToast('مخرج سماعات الرأس غير متاح؛ اختر جهازًا آخر.');
  }
  renderAudioOutputOptions($('#master-output-device'), 'مخرج النظام الافتراضي', audioOutputSettings.masterDeviceId);
  renderAudioOutputOptions($('#headphone-output-device'), 'غير مُعدّة — المعاينة متوقفة', audioOutputSettings.headphoneDeviceId);
  if (!masterAvailable || !headphonesAvailable) saveAudioOutputSettings();
  updateHeadphoneRouting();
}

async function applyAudioOutput(player, deviceId) {
  if (!deviceId) {
    if (typeof player.setSinkId === 'function') await player.setSinkId('');
    return;
  }
  if (typeof player.setSinkId !== 'function') {
    throw new Error('إصدار الصوت لا يدعم اختيار جهاز الإخراج.');
  }
  await player.setSinkId(deviceId);
}

async function startAudioOutputs() {
  if (!audioContext || !masterOutputPlayer) return;
  try {
    await applyAudioOutput(masterOutputPlayer, audioOutputSettings.masterDeviceId);
    if (masterOutputPlayer.paused) await masterOutputPlayer.play();
    masterFallbackGain.gain.setTargetAtTime(0, audioContext.currentTime, 0.03);
    masterOutputPlayer.dataset.playbackError = '';
  } catch (error) {
    masterFallbackGain.gain.setTargetAtTime(1, audioContext.currentTime, 0.015);
    if (masterOutputPlayer.dataset.playbackError !== error.message) {
      showToast(`تعذر تشغيل مخرج الصوت: ${error.message}`);
      masterOutputPlayer.dataset.playbackError = error.message;
    }
  }

  if (!audioOutputSettings.headphoneDeviceId) {
    headphoneOutputPlayer.pause();
    updateHeadphoneRouting();
    return false;
  }
  try {
    await applyAudioOutput(headphoneOutputPlayer, audioOutputSettings.headphoneDeviceId);
    if (headphoneOutputPlayer.paused) await headphoneOutputPlayer.play();
    headphoneOutputPlayer.dataset.playbackError = '';
    return true;
  } catch (error) {
    for (const id of DECK_IDS) decks[id].headphoneCue = false;
    updateHeadphoneRouting();
    setAudioSettingsStatus(`تعذر تشغيل مخرج الصوت: ${error.message}`);
    showToast(`تعذر تشغيل مخرج الصوت: ${error.message}`);
    headphoneOutputPlayer.dataset.playbackError = error.message;
    return false;
  }
}

async function setHeadphoneCue(id) {
  const deck = decks[id];
  if (!audioOutputSettings.headphoneDeviceId) {
    showToast('اختر مخرج سماعات الرأس أولًا.');
    return;
  }
  if (!deck.track) {
    showToast('حمّل مسارًا قبل معاينته في سماعات الرأس.');
    return;
  }
  ensureAudioGraph();
  try {
    await audioContext.resume();
    if (!await startAudioOutputs()) return;
    deck.headphoneCue = !deck.headphoneCue;
    updateHeadphoneRouting();
  } catch (error) {
    showToast(`تعذر تشغيل مخرج الصوت: ${error.message}`);
  }
}

loadAudioOutputSettings();

function ensureAudioGraph() {
  if (audioContext) return;

  audioContext = new AudioContext();
  masterGain = audioContext.createGain();
  masterGain.gain.value = Number($('#master-volume').value) / 100;
  masterDestination = audioContext.createMediaStreamDestination();
  headphoneDestination = audioContext.createMediaStreamDestination();
  masterMeterAnalyser = audioContext.createAnalyser();
  masterMeterAnalyser.fftSize = 256;
  masterMeterData = new Uint8Array(masterMeterAnalyser.fftSize);
  masterOutputPlayer = $('#master-output');
  headphoneOutputPlayer = $('#headphone-output');
  masterOutputPlayer.srcObject = masterDestination.stream;
  headphoneOutputPlayer.srcObject = headphoneDestination.stream;
  masterOutputPlayer.volume = 1;
  headphoneOutputPlayer.volume = 1;
  masterGain.connect(masterDestination);
  masterFallbackGain = audioContext.createGain();
  masterFallbackGain.gain.value = 1;
  masterGain.connect(masterMeterAnalyser).connect(masterFallbackGain).connect(audioContext.destination);
  headphoneMasterGain = audioContext.createGain();
  headphoneMasterGain.gain.value = 0;
  masterGain.connect(headphoneMasterGain).connect(headphoneDestination);

  for (const id of DECK_IDS) {
    const deck = decks[id];
    deck.audio = new Audio();
    deck.audio.preload = 'metadata';
    deck.audio.crossOrigin = 'anonymous';

    deck.source = audioContext.createMediaElementSource(deck.audio);
    deck.filters.low = audioContext.createBiquadFilter();
    deck.filters.low.type = 'lowshelf';
    deck.filters.low.frequency.value = 320;
    deck.filters.mid = audioContext.createBiquadFilter();
    deck.filters.mid.type = 'peaking';
    deck.filters.mid.frequency.value = 1000;
    deck.filters.mid.Q.value = 0.8;
    deck.filters.high = audioContext.createBiquadFilter();
    deck.filters.high.type = 'highshelf';
    deck.filters.high.frequency.value = 3200;
    deck.gain = audioContext.createGain();
    deck.gain.gain.value = Number($(`#volume-${id}`).value) / 100;
    for (const band of ['low', 'mid', 'high']) {
      deck.filters[band].gain.value = (Number($(`#${band}-${id}`).value) - 50) * 0.24;
    }
    deck.analyser = audioContext.createAnalyser();
    deck.analyser.fftSize = 128;
    deck.frequencyData = new Uint8Array(deck.analyser.frequencyBinCount);
    crossfadeGains[id] = audioContext.createGain();
    headphoneCueGains[id] = audioContext.createGain();

    deck.source
      .connect(deck.filters.low)
      .connect(deck.filters.mid)
      .connect(deck.filters.high)
      .connect(deck.gain);

    deck.dryGain = audioContext.createGain();
    deck.wetGain = audioContext.createGain();
    deck.gain.connect(deck.dryGain).connect(deck.analyser);
    deck.wetGain.connect(deck.analyser);
    deck.analyser.connect(crossfadeGains[id]).connect(masterGain);
    deck.analyser.connect(headphoneCueGains[id]).connect(headphoneDestination);
    createEffectBranches(deck);
    updateEffect(id);

    deck.audio.addEventListener('loadedmetadata', () => updateDuration(id));
    deck.audio.addEventListener('timeupdate', () => updateTimeline(id));
    deck.audio.addEventListener('play', () => setPlayingState(id, true));
    deck.audio.addEventListener('pause', () => setPlayingState(id, false));
    deck.audio.addEventListener('ended', () => setPlayingState(id, false));
    deck.audio.addEventListener('play', () => syncStemMedia(id, true));
    deck.audio.addEventListener('pause', () => syncStemMedia(id, false));
    deck.audio.addEventListener('error', () => {
      showToast(`تعذر تشغيل ${deck.track?.name ?? 'المسار'}. تحقق من صيغة الملف.`);
    });
  }

  updateCrossfader();
  updateHeadphoneRouting();
  requestAnimationFrame(drawVisualizers);
}

function createEffectBranches(deck) {
  const context = audioContext;
  const addBranch = (name, node, connectOutput = true) => {
    const send = context.createGain();
    send.gain.value = 0;
    deck.gain.connect(send).connect(node);
    if (connectOutput) node.connect(deck.wetGain);
    deck.fx[name] = { send, node };
  };

  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 12000;
  addBranch('filter', filter);

  const delay = context.createDelay(2);
  const feedback = context.createGain();
  delay.delayTime.value = 0.28;
  feedback.gain.value = 0.35;
  delay.connect(feedback).connect(delay);
  addBranch('echo', delay);
  deck.fx.echo.feedback = feedback;

  const reverb = context.createConvolver();
  reverb.buffer = createImpulseResponse(1.7);
  addBranch('reverb', reverb);

  const flangerDelay = context.createDelay(0.05);
  const flangerLfo = context.createOscillator();
  const flangerDepth = context.createGain();
  flangerDelay.delayTime.value = 0.006;
  flangerLfo.frequency.value = 0.25;
  flangerDepth.gain.value = 0.002;
  flangerLfo.connect(flangerDepth).connect(flangerDelay.delayTime);
  flangerLfo.start();
  addBranch('flanger', flangerDelay);
  deck.fx.flanger.lfo = flangerLfo;
  deck.fx.flanger.depth = flangerDepth;

  const phaserNodes = Array.from({ length: 4 }, () => {
    const node = context.createBiquadFilter();
    node.type = 'allpass';
    node.frequency.value = 700;
    node.Q.value = 0.7;
    return node;
  });
  phaserNodes.reduce((previous, node) => {
    if (previous) previous.connect(node);
    return node;
  }, null);
  const phaserLfo = context.createOscillator();
  const phaserDepth = context.createGain();
  phaserLfo.frequency.value = 0.35;
  phaserDepth.gain.value = 500;
  phaserLfo.connect(phaserDepth);
  phaserNodes.forEach((node) => phaserDepth.connect(node.frequency));
  phaserLfo.start();
  addBranch('phaser', phaserNodes[0], false);
  phaserNodes[phaserNodes.length - 1].connect(deck.wetGain);
  deck.fx.phaser.lfo = phaserLfo;
  deck.fx.phaser.depth = phaserDepth;

  const distortion = context.createWaveShaper();
  distortion.oversample = '4x';
  addBranch('distortion', distortion);

  const gate = context.createGain();
  gate.gain.value = 0;
  const gateLfo = context.createOscillator();
  gateLfo.type = 'square';
  gateLfo.frequency.value = 8;
  const gateDepth = context.createGain();
  gateDepth.gain.value = 0.5;
  const gateOffset = context.createConstantSource();
  gateOffset.offset.value = 0.5;
  gateLfo.connect(gateDepth).connect(gate.gain);
  gateOffset.connect(gate.gain);
  gateLfo.start();
  gateOffset.start();
  addBranch('gate', gate);
  deck.fx.gate.lfo = gateLfo;
  deck.fx.gate.depth = gateDepth;
  deck.fx.gate.offset = gateOffset;
}

function createImpulseResponse(seconds) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * seconds));
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
    const data = impulse.getChannelData(channel);
    for (let index = 0; index < length; index += 1) {
      data[index] = (Math.random() * 2 - 1) * (1 - index / length) ** 2;
    }
  }
  return impulse;
}

function updateRecordingControls(isRecording) {
  const button = $('#record-toggle');
  button.setAttribute('aria-pressed', String(isRecording));
  button.classList.toggle('recording', isRecording);
  $('#record-label').textContent = translatedText(isRecording ? 'إيقاف التسجيل' : 'بدء التسجيل');
  if (!isRecording) $('#record-time').textContent = '00:00';
}

async function toggleMixRecording() {
  if (activeRecorder?.state === 'recording') {
    activeRecorder.stop();
    return;
  }
  try {
    if (!window.MediaRecorder) throw new Error('التسجيل غير مدعوم في هذا الإصدار.');
    ensureAudioGraph();
    await audioContext.resume();
    const stream = masterDestination?.stream;
    if (!stream?.getAudioTracks().some((track) => track.readyState === 'live')) {
      throw new Error('لا يوجد صوت رئيسي متاح للتسجيل.');
    }

    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      .find((type) => MediaRecorder.isTypeSupported(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    recordingChunks = [];
    activeRecorder = recorder;
    recordingStartedAt = Date.now();
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size) recordingChunks.push(event.data);
    });
    recorder.addEventListener('error', (event) => {
      showToast(`تعذر تسجيل المزيج: ${event.error?.message || 'خطأ في مسجل الصوت.'}`);
      if (recorder.state === 'recording') recorder.stop();
    });
    recorder.addEventListener('stop', () => {
      window.clearInterval(recordingTimer);
      recordingTimer = null;
      activeRecorder = null;
      updateRecordingControls(false);
      const blob = new Blob(recordingChunks, { type: recorder.mimeType || 'audio/webm' });
      recordingChunks = [];
      if (!blob.size) {
        showToast('لم يحتوِ التسجيل على صوت، لذلك لم يتم حفظ ملف.');
        return;
      }
      const extension = blob.type.includes('mp4') ? 'm4a' : 'webm';
      const filename = `noor-dj-mix-${new Date().toISOString().replace(/[:.]/g, '-')}.${extension}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      showToast(`تم حفظ التسجيل: ${filename}`);
    });
    recorder.start(1000);
    updateRecordingControls(true);
    recordingTimer = window.setInterval(() => {
      $('#record-time').textContent = formatTime((Date.now() - recordingStartedAt) / 1000);
    }, 1000);
  } catch (error) {
    activeRecorder = null;
    updateRecordingControls(false);
    showToast(`تعذر بدء التسجيل: ${error.message}`);
  }
}

function createDistortionCurve(amount) {
  const curve = new Float32Array(44100);
  const drive = 1 + amount * 7;
  for (let index = 0; index < curve.length; index += 1) {
    const input = (index * 2) / (curve.length - 1) - 1;
    curve[index] = ((3 + drive) * input * 20 * (Math.PI / 180)) / (Math.PI + drive * Math.abs(input));
  }
  return curve;
}

function updateEffect(id, rebuildReverb = false) {
  const deck = decks[id];
  if (!audioContext || !deck.dryGain) return;

  const type = $(`#effect-type-${id}`).value;
  const amount = Number($(`#effect-param-${id}`).value) / 100;
  const wet = Number($(`#effect-wet-${id}`).value) / 100;
  const enabled = $(`#effect-toggle-${id}`).getAttribute('aria-pressed') === 'true';
  const labels = {
    filter: 'القطع',
    echo: 'زمن الصدى',
    reverb: 'حجم الغرفة',
    flanger: 'عمق التموج',
    gate: 'سرعة التقطيع',
    phaser: 'سرعة الطور',
    distortion: 'التشبع'
  };

  $(`#effect-param-name-${id}`).textContent = labels[type];
  $(`#effect-param-value-${id}`).textContent = String(Math.round(amount * 100));
  $(`#effect-wet-value-${id}`).textContent = `${Math.round(wet * 100)}%`;

  for (const [name, branch] of Object.entries(deck.fx)) {
    branch.send.gain.setTargetAtTime(enabled && name === type ? 1 : 0, audioContext.currentTime, 0.02);
  }

  const isInsert = ['filter', 'distortion', 'gate'].includes(type);
  deck.dryGain.gain.setTargetAtTime(enabled && isInsert ? 1 - wet : 1, audioContext.currentTime, 0.02);
  deck.wetGain.gain.setTargetAtTime(enabled ? wet : 0, audioContext.currentTime, 0.02);

  if (type === 'filter') {
    deck.fx.filter.node.frequency.setTargetAtTime(180 + (1 - amount) ** 2 * 17820, audioContext.currentTime, 0.02);
    deck.fx.filter.node.Q.setTargetAtTime(0.7 + amount * 9, audioContext.currentTime, 0.02);
  } else if (type === 'echo') {
    deck.fx.echo.node.delayTime.setTargetAtTime(0.08 + amount * 0.65, audioContext.currentTime, 0.02);
    deck.fx.echo.feedback.gain.setTargetAtTime(Math.min(0.82, 0.12 + amount * 0.68), audioContext.currentTime, 0.02);
  } else if (type === 'reverb' && rebuildReverb) {
    deck.fx.reverb.node.buffer = createImpulseResponse(0.4 + amount * 2.8);
  } else if (type === 'flanger') {
    deck.fx.flanger.lfo.frequency.setTargetAtTime(0.08 + amount * 1.8, audioContext.currentTime, 0.02);
    deck.fx.flanger.depth.gain.setTargetAtTime(0.0005 + amount * 0.008, audioContext.currentTime, 0.02);
  } else if (type === 'gate') {
    deck.fx.gate.lfo.frequency.setTargetAtTime(2 + amount * 14, audioContext.currentTime, 0.02);
  } else if (type === 'phaser') {
    deck.fx.phaser.lfo.frequency.setTargetAtTime(0.08 + amount * 1.7, audioContext.currentTime, 0.02);
    deck.fx.phaser.depth.gain.setTargetAtTime(80 + amount * 1700, audioContext.currentTime, 0.02);
  } else if (type === 'distortion') {
    deck.fx.distortion.node.curve = createDistortionCurve(amount);
  }
}

function updateCrossfader() {
  if (!audioContext) return;
  const position = Number($('#crossfader').value) / 100;
  const angle = position * Math.PI / 2;
  for (const id of DECK_IDS) {
    const isLeftSide = id === 'a' || id === 'c';
    const isHiddenDeck = id === 'c' || id === 'd';
    const gain = isHiddenDeck && !fourDeckMode
      ? 0
      : isLeftSide ? Math.cos(angle) : Math.sin(angle);
    crossfadeGains[id].gain.setTargetAtTime(gain, audioContext.currentTime, 0.015);
  }
}

function setPlayingState(id, playing) {
  const deck = decks[id];
  const button = $(`[data-action="play"][data-deck="${id}"]`);
  const status = $(`#status-${id}`);
  button.textContent = playing ? 'Ⅱ' : '▶';
  button.classList.toggle('is-playing', playing);
  status.textContent = playing ? 'قيد التشغيل' : deck.track ? 'متوقف مؤقتًا' : 'جاهز للمزج';
  status.classList.toggle('playing', playing);
}

function updateDuration(id) {
  const deck = decks[id];
  $(`#duration-${id}`).textContent = formatTime(deck.audio.duration);
  $(`#wave-empty-${id}`).hidden = true;
  $(`#track-detail-${id}`).textContent = `ملف صوتي · ${formatTime(deck.audio.duration)}`;
  if (deck.track && Number.isFinite(deck.audio.duration)) {
    deck.track.duration = deck.audio.duration;
    renderLibrary();
  }
}

function updateTimeline(id) {
  const deck = decks[id];
  if (!deck.audio) return;
  for (const stem of deck.stemMedia) {
    if (stem.ready && Math.abs(stem.audio.currentTime - deck.audio.currentTime) > 0.12) {
      stem.audio.currentTime = deck.audio.currentTime;
    }
  }
  $(`#time-${id}`).textContent = formatTime(deck.audio.currentTime);
  if (Number.isFinite(deck.audio.duration) && !deck.seeking) {
    $(`#seek-${id}`).value = String((deck.audio.currentTime / deck.audio.duration) * 100);
  }
}

function estimateTrackBpm(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const hopSize = Math.max(128, Math.round(sampleRate / 43));
  const frameCount = Math.floor(Math.min(audioBuffer.duration, 90) * sampleRate / hopSize);
  if (frameCount < 86) return null;

  const channels = Array.from({ length: audioBuffer.numberOfChannels }, (_, index) => audioBuffer.getChannelData(index));
  const energy = new Float32Array(frameCount);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    const end = Math.min(start + hopSize, channels[0].length);
    let sum = 0;
    let samples = 0;
    for (let channel = 0; channel < channels.length; channel += 1) {
      const data = channels[channel];
      for (let index = start; index < end; index += 1) {
        sum += data[index] * data[index];
        samples += 1;
      }
    }
    energy[frame] = samples ? Math.sqrt(sum / samples) : 0;
  }

  const onsets = new Float32Array(frameCount);
  let onsetEnergy = 0;
  for (let frame = 1; frame < frameCount; frame += 1) {
    const onset = Math.max(0, energy[frame] - energy[frame - 1]);
    onsets[frame] = onset;
    onsetEnergy += onset * onset;
  }
  if (onsetEnergy < 1e-8) return null;

  const correlate = (lag) => {
    const wholeLag = Math.floor(lag);
    const fraction = lag - wholeLag;
    let correlation = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let frame = wholeLag + 1; frame < frameCount; frame += 1) {
      const current = onsets[frame];
      const previous = onsets[frame - wholeLag] * (1 - fraction)
        + onsets[Math.max(0, frame - wholeLag - 1)] * fraction;
      correlation += current * previous;
      leftEnergy += current * current;
      rightEnergy += previous * previous;
    }
    return leftEnergy && rightEnergy ? correlation / Math.sqrt(leftEnergy * rightEnergy) : 0;
  };

  const framesPerSecond = sampleRate / hopSize;
  let bestBpm = null;
  let bestScore = 0;
  for (let bpm = 65; bpm <= 200; bpm += 0.25) {
    const beatLag = framesPerSecond * 60 / bpm;
    const score = correlate(beatLag) + correlate(beatLag * 2) * 0.35 + correlate(beatLag / 2) * 0.15;
    if (score > bestScore) {
      bestScore = score;
      bestBpm = bpm;
    }
  }
  return bestScore >= 0.12 ? Math.round(bestBpm * 10) / 10 : null;
}

async function analyzeTrack(track, force = false) {
  if (track.analysis && !force) return track.analysis;
  if (trackAnalysisPromises.has(track.id)) return trackAnalysisPromises.get(track.id);
  const analysisPromise = (async () => {
    const metadata = await window.mixDeck.readAudioMetadata(track.id);
    let bpm = Number(metadata.bpm);
    let bpmSource = Number.isFinite(bpm) && bpm >= 50 && bpm <= 250 ? 'tag' : 'unavailable';
    let bpmAnalysisWarning = '';
    if (!Number.isFinite(bpm) || bpm < 50 || bpm > 250) {
      try {
        const response = await fetch(track.url);
        if (!response.ok) throw new Error(`تعذر قراءة ملف الصوت (HTTP ${response.status}).`);
        const contentLength = Number(response.headers.get('content-length'));
        if (contentLength > 64 * 1024 * 1024) {
          throw new Error('الملف أكبر من الحد المدعوم للتحليل المحلي (64 MiB).');
        }
        const audioData = await response.arrayBuffer();
        if (audioData.byteLength > 64 * 1024 * 1024) {
          throw new Error('الملف أكبر من الحد المدعوم للتحليل المحلي (64 MiB).');
        }
        ensureAudioGraph();
        const audioBuffer = await audioContext.decodeAudioData(audioData);
        bpm = estimateTrackBpm(audioBuffer);
        if (Number.isFinite(bpm)) bpmSource = 'audio';
      } catch (error) {
        bpm = null;
        bpmAnalysisWarning = error.message;
      }
    }

    const analysis = {
      ...metadata,
      bpm: Number.isFinite(bpm) ? bpm : null,
      bpmSource,
      bpmAnalysisWarning
    };
    track.analysis = analysis;
    track.bpm = analysis.bpm;
    track.genre = analysis.genre;
    if (Number.isFinite(analysis.duration)) track.duration = analysis.duration;
    renderLibrary();
    for (const id of DECK_IDS) {
      if (decks[id].track === track) {
        if (decks[id].syncSourceId) setSynchronizedTempo(id, decks[id].syncSourceId);
        refreshSyncedFollowers(id);
      }
    }
    return analysis;
  })();
  trackAnalysisPromises.set(track.id, analysisPromise);
  try {
    return await analysisPromise;
  } finally {
    trackAnalysisPromises.delete(track.id);
  }
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '';
  const units = ['B', 'KiB', 'MiB', 'GiB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex ? 1 : 0)} ${units[unitIndex]}`;
}

let activeAnalysisTrack = null;

function renderTrackAnalysis(analysis) {
  const unknown = currentLanguage === 'en' ? 'Not available' : 'غير متوفر';
  const bpmSource = analysis.bpmSource === 'tag'
    ? (currentLanguage === 'en' ? 'Embedded file tag' : 'بيانات الملف')
    : analysis.bpmSource === 'audio'
      ? (currentLanguage === 'en' ? 'Estimated from audio' : 'تقدير من الصوت')
      : unknown;
  const lossless = typeof analysis.lossless === 'boolean'
    ? currentLanguage === 'en' ? (analysis.lossless ? 'Yes' : 'No') : (analysis.lossless ? 'نعم' : 'لا')
    : unknown;
  const fields = [
    ['العنوان', analysis.title],
    ['الفنان', analysis.artist],
    ['فنان الألبوم', analysis.albumArtist],
    ['الألبوم', analysis.album],
    ['النوع', analysis.genre?.join('، ')],
    ['السنة', analysis.year],
    ['التاريخ', analysis.date],
    ['BPM', analysis.bpm ? `${analysis.bpm} BPM · ${bpmSource}` : unknown],
    ['المفتاح الموسيقي', analysis.key],
    ['الملحن', analysis.composer],
    ['الناشر', analysis.publisher],
    ['رقم المسار', analysis.track],
    ['القرص', analysis.disc],
    ['الصيغة', analysis.format],
    ['الترميز', analysis.codec],
    ['المدة', Number.isFinite(analysis.duration) ? formatTime(analysis.duration) : ''],
    ['معدل البت', Number.isFinite(analysis.bitrate) ? `${Math.round(analysis.bitrate / 1000)} kbps` : ''],
    ['معدل العينة', Number.isFinite(analysis.sampleRate) ? `${(analysis.sampleRate / 1000).toFixed(1)} kHz` : ''],
    ['عمق البت', Number.isFinite(analysis.bitDepth) ? `${analysis.bitDepth} bit` : ''],
    ['القنوات', analysis.channels],
    ['ضغط بلا فقد', lossless],
    ['حجم الملف', formatFileSize(analysis.fileSize)],
    ['ملاحظات', analysis.comment]
  ];
  const labels = currentLanguage === 'en'
    ? ['Title', 'Artist', 'Album artist', 'Album', 'Genre', 'Year', 'Date', 'BPM', 'Musical key', 'Composer', 'Publisher', 'Track', 'Disc', 'Format', 'Codec', 'Duration', 'Bitrate', 'Sample rate', 'Bit depth', 'Channels', 'Lossless', 'File size', 'Comments']
    : null;
  const container = $('#track-analysis-fields');
  container.replaceChildren();
  fields.forEach(([label, value], index) => {
    const row = document.createElement('div');
    row.className = 'track-analysis-field';
    const name = document.createElement('span');
    name.textContent = labels?.[index] || label;
    const detail = document.createElement('strong');
    detail.textContent = value === null || value === undefined || value === '' ? unknown : String(value);
    row.append(name, detail);
    container.append(row);
  });
}

async function openTrackAnalysis(track, force = false) {
  activeAnalysisTrack = track;
  $('#track-analysis-title').textContent = track.name;
  $('#track-analysis-status').textContent = translatedText('جارٍ قراءة معلومات الملف وتحليل الإيقاع…');
  $('#track-analysis-fields').replaceChildren();
  $('#track-analysis-retry').disabled = true;
  const dialog = $('#track-analysis-modal');
  if (!dialog.open) dialog.showModal();
  try {
    const analysis = await analyzeTrack(track, force);
    if (activeAnalysisTrack !== track) return;
    renderTrackAnalysis(analysis);
    $('#track-analysis-status').textContent = analysis.bpm
      ? `${translatedText('اكتمل التحليل المحلي.')} ${analysis.bpm} BPM`
      : analysis.bpmAnalysisWarning
        ? `${translatedText('اكتملت قراءة بيانات الملف، لكن تعذر تقدير BPM')}: ${analysis.bpmAnalysisWarning}`
        : translatedText('اكتمل تحليل الملف؛ لم يتم العثور على سرعة واضحة أو وسم BPM.');
  } catch (error) {
    if (activeAnalysisTrack === track) {
      $('#track-analysis-status').textContent = `${translatedText('تعذر تحليل المسار')}: ${error.message}`;
      showToast(`${translatedText('تعذر تحليل المسار')}: ${error.message}`);
    }
  } finally {
    if (activeAnalysisTrack === track) $('#track-analysis-retry').disabled = false;
  }
}

function updateDeckTempo(id, percentage) {
  const deck = decks[id];
  if (deck.audio) {
    deck.audio.playbackRate = percentage / 100;
    for (const stem of deck.stemMedia) stem.audio.playbackRate = deck.audio.playbackRate;
  }
  $(`#tempo-value-${id}`).textContent = `${percentage > 100 ? '+' : ''}${Math.round(percentage - 100)}%`;
}

function setSynchronizedTempo(targetId, sourceId) {
  const source = decks[sourceId];
  const target = decks[targetId];
  if (!source.track?.bpm || !target.track?.bpm || !target.audio) return;
  const percentage = (source.track.bpm * source.audio.playbackRate / target.track.bpm) * 100;
  const slider = $(`#tempo-${targetId}`);
  if (percentage < Number(slider.min) || percentage > Number(slider.max)) {
    target.syncSourceId = null;
    $(`#sync-${targetId}`).setAttribute('aria-pressed', 'false');
    $(`#sync-${targetId}`).classList.remove('active');
    showToast(`تم إيقاف SYNC للمشغّل ${targetId.toUpperCase()} لأن السرعة المطلوبة خارج النطاق.`);
    return;
  }
  slider.value = String(percentage);
  slider.dataset.syncUpdate = 'true';
  slider.dispatchEvent(new Event('input', { bubbles: true }));
  delete slider.dataset.syncUpdate;
}

function refreshSyncedFollowers(sourceId) {
  for (const id of DECK_IDS) {
    if (decks[id].syncSourceId === sourceId) setSynchronizedTempo(id, sourceId);
  }
}

function chooseSyncSource(targetId) {
  const preferred = {
    a: ['b', 'c', 'd'],
    b: ['a', 'd', 'c'],
    c: ['d', 'a', 'b'],
    d: ['c', 'b', 'a']
  }[targetId];
  return preferred.find((id) => id !== targetId && decks[id].track) || null;
}

function wouldCreateSyncCycle(targetId, sourceId) {
  let currentId = sourceId;
  while (currentId) {
    if (currentId === targetId) return true;
    currentId = decks[currentId].syncSourceId;
  }
  return false;
}

async function syncDeckTempo(targetId) {
  const target = decks[targetId];
  if (!target.track) {
    showToast(`حمّل مسارًا على المشغّل ${targetId.toUpperCase()} قبل استخدام SYNC.`);
    return;
  }
  if (target.syncSourceId) {
    target.syncSourceId = null;
    $(`#sync-${targetId}`).setAttribute('aria-pressed', 'false');
    $(`#sync-${targetId}`).classList.remove('active');
    showToast(`تم إيقاف SYNC للمشغّل ${targetId.toUpperCase()}.`);
    return;
  }

  const sourceId = chooseSyncSource(targetId);
  if (!sourceId) {
    showToast('حمّل مسارًا على مشغّل آخر لمزامنة السرعة.');
    return;
  }
  if (wouldCreateSyncCycle(targetId, sourceId)) {
    showToast(translatedText('لا يمكن مزامنة مشغّل يعتمد على هذا المشغّل؛ اختر مصدرًا آخر.'));
    return;
  }
  const sourceTrack = decks[sourceId].track;
  const targetTrack = target.track;
  const button = $(`#sync-${targetId}`);
  button.disabled = true;
  try {
    const [sourceAnalysis, targetAnalysis] = await Promise.all([
      analyzeTrack(sourceTrack),
      analyzeTrack(targetTrack)
    ]);
    if (decks[sourceId].track !== sourceTrack || target.track !== targetTrack) {
      throw new Error('تغير المسار أثناء التحليل؛ أعد المحاولة.');
    }
    if (!sourceAnalysis.bpm || !targetAnalysis.bpm) {
      throw new Error('لم يتمكن المحلل من تحديد BPM لأحد المسارين.');
    }
    const percentage = (sourceAnalysis.bpm * decks[sourceId].audio.playbackRate / targetAnalysis.bpm) * 100;
    const slider = $(`#tempo-${targetId}`);
    if (percentage < Number(slider.min) || percentage > Number(slider.max)) {
      throw new Error(`تتطلب المزامنة سرعة خارج النطاق المتاح (${slider.min}–${slider.max}%).`);
    }
    target.syncSourceId = sourceId;
    setSynchronizedTempo(targetId, sourceId);
    button.setAttribute('aria-pressed', 'true');
    button.classList.add('active');
    showToast(`تمت مزامنة ${targetId.toUpperCase()} مع ${sourceId.toUpperCase()} عند ${Math.round(sourceAnalysis.bpm * decks[sourceId].audio.playbackRate)} BPM.`);
  } catch (error) {
    target.syncSourceId = null;
    button.setAttribute('aria-pressed', 'false');
    button.classList.remove('active');
    showToast(`تعذر مزامنة السرعة: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function loadTrack(id, track) {
  ensureAudioGraph();
  const deck = decks[id];
  clearStemPlayback(deck);
  deck.audio.pause();
  deck.audio.src = track.url;
  deck.audio.load();
  deck.track = track;
  deck.gain.gain.setTargetAtTime(Number($(`#volume-${id}`).value) / 100, audioContext.currentTime, 0.015);
  $(`#track-name-${id}`).textContent = track.name;
  $(`#track-detail-${id}`).textContent = 'جارٍ تحميل معلومات المسار…';
  $(`#seek-${id}`).value = '0';
  $(`#time-${id}`).textContent = '00:00';
  $(`#duration-${id}`).textContent = '00:00';
  $(`#wave-empty-${id}`).hidden = false;
  $(`#tempo-${id}`).value = '100';
  $(`#tempo-value-${id}`).textContent = '+0%';
  decks[id].syncSourceId = null;
  $(`#sync-${id}`).setAttribute('aria-pressed', 'false');
  $(`#sync-${id}`).classList.remove('active');
  deck.audio.playbackRate = 1;
  refreshSyncedFollowers(id);
  deck.audio.loop = false;
  deck.customLoop = null;
  deck.padLoop = null;
  deck.cues.fill(null);
  if (deck.rollTimeout) {
    window.clearTimeout(deck.rollTimeout);
    deck.rollTimeout = null;
  }
  $(`[data-action="loop"][data-deck="${id}"]`).classList.remove('active');
  renderPads();
  setPlayingState(id, false);
  try {
    await audioContext.resume();
    await startAudioOutputs();
  } catch (error) {
    showToast(`تعذر تفعيل الصوت: ${error.message}`);
    return;
  }
  showToast(`تم تحميل ${track.name} على المسار ${id.toUpperCase()}`);
  analyzeTrack(track).catch((error) => {
    if (decks[id].track?.id === track.id) {
      $(`#track-detail-${id}`).textContent = currentLanguage === 'en'
        ? `Analysis unavailable · ${error.message}`
        : `تعذر تحليل الملف · ${error.message}`;
    }
  });
}

function syncStemMedia(id, playing) {
  const deck = decks[id];
  for (const stem of deck.stemMedia) {
    if (!stem.ready) continue;
    if (Math.abs(stem.audio.currentTime - deck.audio.currentTime) > 0.08) {
      stem.audio.currentTime = deck.audio.currentTime;
    }
    stem.audio.playbackRate = deck.audio.playbackRate;
    if (playing && stem.audio.paused) {
      stem.audio.play().catch((error) => showToast(`تعذر تشغيل Stem ${stem.name}: ${error.message}`));
    } else if (!playing && !stem.audio.paused) {
      stem.audio.pause();
    }
  }
}

function clearStemPlayback(deck) {
  for (const stem of deck.stemMedia) {
    stem.audio.pause();
    stem.source.disconnect();
  }
  for (const url of deck.stemUrls) URL.revokeObjectURL(url);
  deck.stemMedia = [];
  deck.stemUrls = [];
  if (deck.audio) deck.audio.muted = false;
  const id = DECK_IDS.find((deckId) => decks[deckId] === deck);
  if (id) {
    for (const name of ['vocals', 'drums', 'bass', 'other']) {
      $(`#stem-${name}-${id}`).disabled = true;
      $(`#stem-${name}-${id}`).value = '100';
    }
    $(`#stems-status-${id}`).textContent = 'المسار كامل';
  }
}

function encodeStemWav(stem) {
  const sampleCount = Math.min(stem.left.length, stem.right.length);
  const bytesPerSample = 2;
  const dataLength = sampleCount * 2 * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeText = (offset, text) => {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  };
  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 2, true);
  view.setUint32(24, 44100, true);
  view.setUint32(28, 44100 * 2 * bytesPerSample, true);
  view.setUint16(32, 2 * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (let index = 0; index < sampleCount; index += 1) {
    for (const channel of [stem.left, stem.right]) {
      const sample = Math.max(-1, Math.min(1, channel[index]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
}

async function applySeparatedStems(id, result) {
  const deck = decks[id];
  clearStemPlayback(deck);
  deck.audio.pause();
  deck.audio.muted = true;
  try {
    for (const name of ['vocals', 'drums', 'bass', 'other']) {
      const url = encodeStemWav(result[name]);
      deck.stemUrls.push(url);
      const audio = new Audio(url);
      audio.preload = 'auto';
      const source = audioContext.createMediaElementSource(audio);
      const gain = audioContext.createGain();
      gain.gain.value = Number($(`#stem-${name}-${id}`).value) / 100;
      source.connect(gain).connect(deck.filters.low);
      const stem = { name, audio, source, gain, ready: false };
      audio.addEventListener('loadedmetadata', () => {
        stem.ready = true;
        audio.currentTime = Math.min(deck.audio.currentTime, audio.duration || deck.audio.currentTime);
        if (!deck.audio.paused) syncStemMedia(id, true);
      }, { once: true });
      audio.addEventListener('error', () => showToast(`تعذر تحميل Stem ${name}.`), { once: true });
      deck.stemMedia.push(stem);
      audio.load();
    }
  } catch (error) {
    clearStemPlayback(deck);
    throw error;
  }
  $(`#stems-status-${id}`).textContent = 'أجزاء مفصولة · محلي';
  for (const name of ['vocals', 'drums', 'bass', 'other']) {
    $(`#stem-${name}-${id}`).disabled = false;
  }
  if (deck.track) deck.track.stemsSeparated = true;
}

let stemProcessing = false;

async function separateDeckStems(id) {
  const deck = decks[id];
  if (!deck.track) {
    showToast('حمّل أغنية على هذا المشغّل قبل فصل Stems.');
    return;
  }
  if (stemProcessing) {
    showToast('يجري فصل مسار آخر؛ انتظر حتى يكتمل.');
    return;
  }
  stemProcessing = true;
  const sourceTrack = deck.track;
  const button = $(`#stems-${id}`);
  const status = $(`#stems-status-${id}`);
  const progress = $(`#stems-progress-${id}`);
  button.disabled = true;
  progress.hidden = false;
  progress.value = 0;
  status.textContent = 'تهيئة الفصل المحلي…';
  const removeProgressListener = window.mixDeck.onStemModelProgress(({ loaded, total }) => {
    if (total > 0) {
      progress.value = Math.round(loaded / total * 100);
      status.textContent = `تنزيل نموذج AI ${progress.value}%`;
    }
  });
  try {
    ensureAudioGraph();
    const modelUrl = await window.mixDeck.ensureStemModel();
    const engine = await import('mixdeck://app/stem-engine.js');
    const result = await engine.separateTrack(sourceTrack.url, modelUrl, (update) => {
      if (typeof update.progress === 'number') {
        progress.value = Math.round(update.progress * 100);
        status.textContent = `فصل AI ${progress.value}%`;
      } else if (update.message) {
        status.textContent = update.message;
      }
    });
    if (deck.track !== sourceTrack) {
      throw new Error('تغير المسار أثناء الفصل؛ أُهملت النتيجة القديمة.');
    }
    await applySeparatedStems(id, result);
    progress.value = 100;
    showToast(`اكتمل فصل Vocals وDrums وBass وOther للمشغّل ${id.toUpperCase()}.`);
  } catch (error) {
    status.textContent = 'تعذر فصل المسار';
    showToast(`فشل فصل Stems: ${error.message}`);
  } finally {
    removeProgressListener();
    button.disabled = false;
    window.setTimeout(() => {
      progress.hidden = true;
    }, 1200);
    stemProcessing = false;
  }
}

async function togglePlayback(id) {
  const deck = decks[id];
  if (!deck.track) {
    showToast('اختر أغنية من المكتبة أولًا.');
    return;
  }
  ensureAudioGraph();
  try {
    await audioContext.resume();
    await startAudioOutputs();
    if (deck.audio.paused) {
      await deck.audio.play();
    } else {
      deck.audio.pause();
    }
  } catch (error) {
    showToast(`تعذر بدء التشغيل: ${error.message}`);
  }
}

async function importTracks(deckId = null) {
  try {
    const tracks = await window.mixDeck.selectAudioFiles(currentLanguage);
    if (!tracks.length) return;
    addTracksToLibrary(tracks);
    renderLibrary();
    if (deckId) {
      await loadTrack(deckId, tracks[0]);
    } else {
      showToast(currentLanguage === 'en'
        ? `Added ${tracks.length} ${tracks.length === 1 ? 'file' : 'files'} to the library.`
        : `تمت إضافة ${tracks.length} ${tracks.length === 1 ? 'ملف' : 'ملفات'} إلى المكتبة`);
    }
  } catch (error) {
    showToast(`تعذر استيراد الملفات: ${error.message}`);
  }
}

async function importFolder() {
  try {
    const tracks = await window.mixDeck.selectAudioFolder(currentLanguage);
    if (!tracks.length) return;
    const added = addTracksToLibrary(tracks);
    renderLibrary();
    showToast(currentLanguage === 'en'
      ? added ? `Added ${added} tracks from the selected folder.` : 'No new tracks were found in that folder.'
      : added ? `تمت إضافة ${added} مسارًا من المجلد المحدد.` : 'لم يتم العثور على مسارات جديدة في هذا المجلد.');
  } catch (error) {
    showToast(`${currentLanguage === 'en' ? 'Unable to import folder' : 'تعذر استيراد المجلد'}: ${error.message}`);
  }
}

function addTracksToLibrary(tracks) {
  const knownIds = new Set(library.map((track) => track.id));
  let added = 0;
  for (const track of tracks) {
    if (!knownIds.has(track.id)) {
      library.push(track);
      knownIds.add(track.id);
      added += 1;
    }
  }
  return added;
}

async function importSamples() {
  try {
    const tracks = await window.mixDeck.selectAudioFiles(currentLanguage);
    if (!tracks.length) return;
    addTracksToLibrary(tracks);

    let nextSlot = sampleTracks.findIndex((track) => !track);
    let unassigned = 0;
    for (const track of tracks) {
      if (nextSlot < 0) {
        unassigned += 1;
        continue;
      }
      sampleTracks[nextSlot] = track;
      nextSlot = sampleTracks.findIndex((sample, index) => !sample && index > nextSlot);
    }
    renderLibrary();
    saveSampleAssignments();
    renderSampleBox();
    showToast(currentLanguage === 'en'
      ? unassigned
        ? `The sample box is full; ${unassigned} files were added to the library but not assigned.`
        : `Loaded ${tracks.length} ${tracks.length === 1 ? 'sample' : 'samples'} into the sample box.`
      : unassigned
        ? `امتلأ صندوق العينات؛ أُضيفت ${unassigned} ملفات إلى المكتبة دون تعيينها.`
        : `تم تحميل ${tracks.length} ${tracks.length === 1 ? 'عينة' : 'عينات'} إلى صندوق العينات.`);
  } catch (error) {
    showToast(`تعذر استيراد العينات: ${error.message}`);
  }
}

function renderLibrary() {
  const query = ($('#dock-search-input').value || $('#search-input').value).trim().toLocaleLowerCase();
  const filteredTracks = library.filter((track) => {
    const matchesQuery = track.name.toLocaleLowerCase().includes(query);
    const matchesFolder = !activeLibraryFolder || (track.folder || 'ملفات منفردة') === activeLibraryFolder;
    return matchesQuery && matchesFolder;
  });
  const formatTrackCount = (count) => currentLanguage === 'en'
    ? `${count} ${count === 1 ? 'track' : 'tracks'}`
    : `${count} ${count === 1 ? 'مسار' : 'مسارات'}`;
  $('#track-count').textContent = currentLanguage === 'en'
    ? `${library.length} ${library.length === 1 ? 'track' : 'tracks'}`
    : `${library.length} ${library.length === 1 ? 'مسار' : 'مسارات'}`;
  $('#dock-track-count').textContent = formatTrackCount(library.length);

  const folderCounts = new Map();
  for (const track of library) {
    const folder = track.folder || 'ملفات منفردة';
    folderCounts.set(folder, (folderCounts.get(folder) || 0) + 1);
  }
  const folders = $('#library-folders');
  folders.replaceChildren();
  const addFolderButton = (name, count) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `library-folder-button${activeLibraryFolder === name ? ' active' : ''}`;
    button.setAttribute('aria-pressed', String(activeLibraryFolder === name));
    const label = document.createElement('span');
    label.textContent = name || (currentLanguage === 'en' ? 'All folders' : 'كل المجلدات');
    const amount = document.createElement('span');
    amount.textContent = String(count);
    button.append(label, amount);
    button.addEventListener('click', () => {
      activeLibraryFolder = name;
      renderLibrary();
    });
    folders.append(button);
  };
  addFolderButton('', library.length);
  for (const [folder, count] of [...folderCounts].sort(([left], [right]) => left.localeCompare(right))) {
    addFolderButton(folder, count);
  }

  const renderTrackList = (list, isDock) => {
    list.replaceChildren();
    if (!filteredTracks.length) {
      const empty = document.createElement('div');
      empty.className = 'empty-library';
      empty.textContent = library.length
        ? (currentLanguage === 'en' ? 'No matching tracks.' : 'لا توجد مسارات مطابقة.')
        : (currentLanguage === 'en' ? 'Import music to build your library.' : 'استورد الموسيقى لبناء مكتبتك.');
      list.append(empty);
      return;
    }

    filteredTracks.forEach((track, index) => {
      const row = document.createElement('div');
      row.className = 'track-row';
      row.draggable = true;
      row.dataset.trackId = track.id;
      row.addEventListener('dragstart', (event) => {
        event.dataTransfer.setData('application/x-mixdeck-track', track.id);
        event.dataTransfer.setData('text/plain', track.id);
        event.dataTransfer.effectAllowed = 'copy';
        if (!isDock) $('#library-modal').classList.add('track-dragging');
      });
      row.addEventListener('dragend', () => $('#library-modal').classList.remove('track-dragging'));

      const number = document.createElement('span');
      number.className = 'track-number';
      number.textContent = String(index + 1).padStart(2, '0');

      const info = document.createElement('div');
      info.className = 'library-track';
      const art = document.createElement('span');
      art.className = 'mini-art';
      art.textContent = '♫';
      const text = document.createElement('span');
      text.className = 'library-track-text';
      const name = document.createElement('strong');
      name.textContent = track.name;
      const detail = document.createElement('span');
      detail.textContent = track.analysis
        ? [track.analysis.artist, track.analysis.bpm ? `${track.analysis.bpm} BPM` : '', track.analysis.genre?.[0]].filter(Boolean).join(' · ')
        : track.folder || (currentLanguage === 'en' ? 'Local audio file' : 'ملف صوتي محلي');
      text.append(name, detail);
      info.append(art, text);

      const duration = document.createElement('span');
      duration.className = 'track-duration';
      duration.textContent = isDock
        ? track.folder || (currentLanguage === 'en' ? 'Single files' : 'ملفات منفردة')
        : track.duration ? formatTime(track.duration) : '—';

      const actions = document.createElement('div');
      actions.className = 'load-actions';
      for (const id of fourDeckMode ? DECK_IDS : ['a', 'b']) {
        const button = document.createElement('button');
        button.type = 'button';
        button.id = `library-load-${track.id}-${id}${isDock ? '-dock' : ''}`;
        button.dataset.midiControl = '';
        button.textContent = id.toUpperCase();
        button.setAttribute('aria-label', `تحميل ${track.name} على المسار ${id.toUpperCase()}`);
        button.addEventListener('click', () => {
          if (libraryDialog.open) libraryDialog.close();
          loadTrack(id, track);
        });
        actions.append(button);
      }
      const infoButton = document.createElement('button');
      infoButton.type = 'button';
      infoButton.className = 'track-info-button';
      infoButton.textContent = 'ⓘ';
      infoButton.title = translatedText('معلومات المسار');
      infoButton.setAttribute('aria-label', `${translatedText('معلومات المسار')}: ${track.name}`);
      infoButton.addEventListener('click', () => openTrackAnalysis(track));
      actions.append(infoButton);
      row.append(number, info, duration, actions);
      list.append(row);
    });
  };

  renderTrackList($('#library-list'), false);
  renderTrackList($('#dock-library-list'), true);
}

const padLabels = {
  hotcue: ['CUE 1', 'CUE 2', 'CUE 3', 'CUE 4', 'CUE 5', 'CUE 6', 'CUE 7', 'CUE 8'],
  loop: ['¼ beat', '½ beat', '1 beat', '2 beats', '4 beats', '8 beats', '16 beats', '32 beats'],
  sampler: ['Kick', 'Snare', 'Closed Hat', 'Open Hat', 'Clap', 'Tom', 'Cowbell', 'Rim'],
  slicer: ['Slice 1', 'Slice 2', 'Slice 3', 'Slice 4', 'Slice 5', 'Slice 6', 'Slice 7', 'Slice 8'],
  roll: ['¼ beat', '½ beat', '1 beat', '2 beats', '4 beats', '8 beats', '16 beats', '32 beats']
};
const padBeatLengths = [0.25, 0.5, 1, 2, 4, 8, 16, 32];
let noiseBuffer;

const RHYTHM_INSTRUMENTS = [
  { id: 'kick', label: 'ركلة', english: 'Kick' },
  { id: 'snare', label: 'سنير', english: 'Snare' },
  { id: 'closedHat', label: 'هاي هات مغلق', english: 'Closed Hat' },
  { id: 'openHat', label: 'هاي هات مفتوح', english: 'Open Hat' },
  { id: 'clap', label: 'تصفيق', english: 'Clap' }
];
const RHYTHM_PATTERNS = {
  house: { kick: [0, 4, 8, 12], snare: [4, 12], closedHat: [2, 6, 10, 14], openHat: [7, 15], clap: [] },
  techno: { kick: [0, 4, 8, 12], snare: [4, 12], closedHat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [2, 6, 10, 14], clap: [] },
  hiphop: { kick: [0, 7, 10], snare: [4, 12], closedHat: [0, 2, 4, 6, 8, 10, 12, 14], openHat: [], clap: [] },
  breakbeat: { kick: [0, 3, 8, 11], snare: [4, 12], closedHat: [2, 6, 10, 14], openHat: [7, 15], clap: [] },
  empty: { kick: [], snare: [], closedHat: [], openHat: [], clap: [] }
};
let rhythmSteps = makeRhythmSteps(RHYTHM_PATTERNS.house);
let savedRhythms = [];
let rhythmTimer;
let rhythmRunning = false;
let rhythmNextNoteTime = 0;
let rhythmStep = 0;
let rhythmPlaybackToken = 0;

function getNoiseBuffer() {
  if (!noiseBuffer) {
    const length = audioContext.sampleRate;
    noiseBuffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let sample = 0; sample < length; sample += 1) data[sample] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function makeRhythmSteps(pattern) {
  return Object.fromEntries(RHYTHM_INSTRUMENTS.map(({ id }) => [
    id,
    Array.from({ length: 16 }, (_, index) => pattern[id].includes(index))
  ]));
}

function renderRhythmSequencer() {
  const sequencer = $('#rhythm-sequencer');
  const heading = document.createElement('div');
  heading.className = 'rhythm-step-row rhythm-step-heading';
  heading.append(document.createElement('span'));
  for (let index = 0; index < 16; index += 1) {
    const number = document.createElement('span');
    number.className = 'rhythm-step-number';
    number.textContent = String(index + 1);
    heading.append(number);
  }
  sequencer.replaceChildren(heading);

  for (const instrument of RHYTHM_INSTRUMENTS) {
    const row = document.createElement('div');
    row.className = 'rhythm-step-row';
    const label = document.createElement('span');
    label.className = 'rhythm-step-label';
    label.textContent = currentLanguage === 'en' ? instrument.english : instrument.label;
    row.append(label);
    for (let index = 0; index < 16; index += 1) {
      const step = document.createElement('button');
      step.type = 'button';
      step.className = `rhythm-step${rhythmSteps[instrument.id][index] ? ' active' : ''}`;
      step.dataset.instrument = instrument.id;
      step.dataset.step = String(index);
      step.setAttribute('aria-pressed', String(rhythmSteps[instrument.id][index]));
      step.setAttribute('aria-label', `${currentLanguage === 'en' ? instrument.english : instrument.label} ${index + 1}`);
      row.append(step);
    }
    sequencer.append(row);
  }
}

function renderSavedRhythms(selectedId = '') {
  const select = $('#rhythm-saved');
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = translatedText('المحفوظة');
  select.replaceChildren(placeholder);
  for (const rhythm of savedRhythms) {
    const option = document.createElement('option');
    option.value = rhythm.id;
    option.textContent = rhythm.name;
    select.append(option);
  }
  select.value = savedRhythms.some((rhythm) => rhythm.id === selectedId) ? selectedId : '';
}

function readSavedRhythms() {
  try {
    const stored = JSON.parse(localStorage.getItem('noor-dj-rhythms') || '[]');
    if (!Array.isArray(stored)) throw new Error('صيغة البيانات غير صالحة.');
    savedRhythms = stored.filter((rhythm) =>
      rhythm &&
      typeof rhythm.id === 'string' &&
      typeof rhythm.name === 'string' &&
      rhythm.steps &&
      RHYTHM_INSTRUMENTS.every(({ id }) =>
        Array.isArray(rhythm.steps[id]) &&
        rhythm.steps[id].length === 16 &&
        rhythm.steps[id].every((enabled) => typeof enabled === 'boolean')
      )
    );
    if (savedRhythms.length !== stored.length) {
      showToast('تعذر قراءة الإيقاعات المحفوظة: بعض الإيقاعات المحفوظة غير صالحة.');
    }
  } catch (error) {
    showToast(`تعذر قراءة الإيقاعات المحفوظة: ${error.message}`);
    savedRhythms = [];
  }
  renderSavedRhythms();
}

function saveRhythmsToStorage() {
  try {
    localStorage.setItem('noor-dj-rhythms', JSON.stringify(savedRhythms));
    return true;
  } catch (error) {
    showToast(`تعذر حفظ الإيقاع: ${error.message}`);
    return false;
  }
}

function playRhythmInstrument(instrument, time, volume) {
  if (volume <= 0) return;
  const context = audioContext;
  if (instrument === 'kick') {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(150, time);
    oscillator.frequency.exponentialRampToValueAtTime(42, time + 0.22);
    gain.gain.setValueAtTime(volume * 0.9, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.28);
    oscillator.connect(gain).connect(masterGain);
    oscillator.start(time);
    oscillator.stop(time + 0.3);
    return;
  }

  const bursts = instrument === 'clap' ? 3 : 1;
  for (let burst = 0; burst < bursts; burst += 1) {
    const startTime = time + burst * 0.025;
    const duration = instrument === 'openHat' ? 0.3 : instrument === 'snare' ? 0.2 : instrument === 'clap' ? 0.12 : 0.08;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = getNoiseBuffer();
    filter.type = instrument === 'snare' || instrument === 'clap' ? 'bandpass' : 'highpass';
    filter.frequency.value = instrument === 'snare' ? 1800 : instrument === 'clap' ? 1400 : 7800;
    const level = instrument === 'snare' ? 0.5 : instrument === 'clap' ? 0.42 / (burst + 1) : instrument === 'openHat' ? 0.28 : 0.22;
    gain.gain.setValueAtTime(volume * level, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
    source.connect(filter).connect(gain).connect(masterGain);
    source.start(startTime);
    source.stop(startTime + duration);
  }
}

function scheduleRhythmStep(stepIndex, time, token) {
  const volume = Number($('#rhythm-volume').value) / 100;
  for (const { id } of RHYTHM_INSTRUMENTS) {
    if (rhythmSteps[id][stepIndex]) playRhythmInstrument(id, time, volume);
  }
  const delay = Math.max(0, (time - audioContext.currentTime) * 1000);
  window.setTimeout(() => {
    if (!rhythmRunning || token !== rhythmPlaybackToken) return;
    $('#rhythm-sequencer').querySelectorAll('.rhythm-step.playing').forEach((button) => button.classList.remove('playing'));
    $('#rhythm-sequencer').querySelectorAll(`.rhythm-step[data-step="${stepIndex}"]`).forEach((button) => button.classList.add('playing'));
    window.setTimeout(() => {
      if (token === rhythmPlaybackToken) {
        $('#rhythm-sequencer').querySelectorAll('.rhythm-step.playing').forEach((button) => button.classList.remove('playing'));
      }
    }, Math.max(40, 60000 / Number($('#rhythm-tempo').value) / 4));
  }, delay);
}

function scheduleRhythm() {
  const lookahead = 0.12;
  while (rhythmNextNoteTime < audioContext.currentTime + lookahead) {
    scheduleRhythmStep(rhythmStep, rhythmNextNoteTime, rhythmPlaybackToken);
    rhythmNextNoteTime += 60 / Number($('#rhythm-tempo').value) / 4;
    rhythmStep = (rhythmStep + 1) % 16;
  }
}

async function startRhythm() {
  if (rhythmRunning) return;
  try {
    ensureAudioGraph();
    await audioContext.resume();
    rhythmRunning = true;
    rhythmPlaybackToken += 1;
    rhythmStep = 0;
    rhythmNextNoteTime = audioContext.currentTime + 0.05;
    $('#rhythm-play').disabled = true;
    $('#rhythm-stop').disabled = false;
    $('#rhythm-status').textContent = translatedText('قيد التشغيل');
    scheduleRhythm();
    rhythmTimer = window.setInterval(scheduleRhythm, 25);
  } catch (error) {
    stopRhythm();
    showToast(`تعذر تشغيل الإيقاع: ${error.message}`);
  }
}

function stopRhythm() {
  rhythmRunning = false;
  rhythmPlaybackToken += 1;
  window.clearInterval(rhythmTimer);
  rhythmTimer = null;
  $('#rhythm-play').disabled = false;
  $('#rhythm-stop').disabled = true;
  $('#rhythm-status').textContent = translatedText('اختر نمطًا أو انقر الخطوات لصنع إيقاعك، ثم اضغط تشغيل.');
  $('#rhythm-sequencer').querySelectorAll('.rhythm-step.playing').forEach((button) => button.classList.remove('playing'));
}

function assignSample(slot, track) {
  sampleTracks[slot] = track;
  saveSampleAssignments();
  renderSampleBox();
  showToast(`تم تعيين ${track.name} على العينة ${slot + 1}.`);
}

function saveSampleAssignments() {
  savedSampleIds = sampleTracks.map((track) => track?.id ?? null);
  try {
    localStorage.setItem('mixdeck-sample-slots', JSON.stringify(savedSampleIds));
  } catch (error) {
    showToast(`تعذر حفظ صندوق العينات: ${error.message}`);
  }
}

function renderSampleBox() {
  const slots = $('#sample-slots');
  if (!slots) return;
  slots.replaceChildren();
  sampleTracks.forEach((track, index) => {
    const slot = document.createElement('div');
    slot.className = `sample-slot${track ? ' filled' : ''}`;
    slot.dataset.sampleSlot = String(index);
    slot.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
      slot.classList.add('drop-target');
    });
    slot.addEventListener('dragleave', () => slot.classList.remove('drop-target'));
    slot.addEventListener('drop', (event) => {
      event.preventDefault();
      slot.classList.remove('drop-target');
      const droppedTrack = findDraggedTrack(event);
      if (droppedTrack) assignSample(index, droppedTrack);
    });

    const play = document.createElement('button');
    play.type = 'button';
    play.id = `sample-play-${index}`;
    play.dataset.midiControl = '';
    play.setAttribute('aria-label', track ? `تشغيل العينة ${track.name}` : `خانة عينة ${index + 1} فارغة`);
    play.textContent = track ? track.name : `عينة ${index + 1} · فارغة`;
    play.addEventListener('click', () => {
      if (track) playSample(index).catch((error) => showToast(`تعذر تشغيل العينة: ${error.message}`));
      else showToast('أفلت أغنية من المكتبة أو استورد ملفًا لتعيين هذه العينة.');
    });
    slot.append(play);

    if (track) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'sample-clear';
      clear.id = `sample-clear-${index}`;
      clear.dataset.midiControl = '';
      clear.setAttribute('aria-label', `إفراغ العينة ${index + 1}`);
      clear.textContent = '×';
      clear.addEventListener('click', () => {
        stopSample(index);
        sampleTracks[index] = null;
        saveSampleAssignments();
        renderSampleBox();
      });
      slot.append(clear);
    }
    slots.append(slot);
  });
}

function findDraggedTrack(event) {
  const id = event.dataTransfer.getData('application/x-mixdeck-track')
    || event.dataTransfer.getData('text/plain');
  return library.find((track) => track.id === id);
}

function stopSample(index) {
  const voice = sampleVoices.get(index);
  if (!voice) return;
  voice.audio.pause();
  voice.source.disconnect();
  sampleVoices.delete(index);
}

async function playSample(index) {
  const track = sampleTracks[index];
  if (!track) return;
  ensureAudioGraph();
  await audioContext.resume();
  stopSample(index);

  const audio = new Audio();
  audio.preload = 'auto';
  audio.crossOrigin = 'anonymous';
  audio.src = track.url;
  const source = audioContext.createMediaElementSource(audio);
  source.connect(masterGain);
  sampleVoices.set(index, { audio, source });
  audio.addEventListener('ended', () => {
    source.disconnect();
    if (sampleVoices.get(index)?.audio === audio) sampleVoices.delete(index);
  }, { once: true });
  try {
    await startAudioOutputs();
    await audio.play();
  } catch (error) {
    stopSample(index);
    showToast(`تعذر تشغيل العينة: ${error.message}`);
  }
}

function padModeForDeck(id) {
  return $(`#pad-mode-${id}`).value;
}

function renderPads(deckId = null) {
  for (const id of deckId ? [deckId] : DECK_IDS) {
    const pads = $(`#performance-pads-${id}`);
    pads.replaceChildren();
    const mode = padModeForDeck(id);
    const deck = decks[id];

    padLabels[mode].forEach((label, index) => {
      const pad = document.createElement('button');
      pad.type = 'button';
      pad.id = `performance-pad-${id}-${index}`;
      pad.dataset.padIndex = String(index);
      pad.className = 'performance-pad';
      pad.dataset.midiControl = '';
      pad.setAttribute('aria-label', `${label}، الوضع ${$(`#pad-mode-${id}`).selectedOptions[0].textContent}، المشغل ${id.toUpperCase()}`);
      const title = document.createElement('span');
      const detail = document.createElement('span');
      title.textContent = mode === 'hotcue' && deck.cues[index] !== null ? `● ${index + 1}` : String(index + 1).padStart(2, '0');
      detail.textContent = mode === 'hotcue' && deck.cues[index] !== null
        ? formatTime(deck.cues[index])
        : label;
      pad.append(title, detail);
      if (mode === 'loop' && deck.padLoop === index) pad.classList.add('pad-loop-active');
      if (mode === 'hotcue' && deck.cues[index] !== null) pad.classList.add('active');

      pad.addEventListener('pointerdown', () => {
        if (mode === 'roll') startRoll(id, index);
      });
      pad.addEventListener('pointerup', () => {
        if (mode === 'roll') stopRoll(id);
      });
      pad.addEventListener('pointercancel', () => stopRoll(id));
      pad.addEventListener('click', (event) => {
        if (mode === 'roll') {
          if (event.detail === 0) {
            startRoll(id, index);
            decks[id].rollTimeout = window.setTimeout(() => stopRoll(id), 250);
          }
          return;
        }
        triggerPad(id, mode, index);
      });
      pads.append(pad);
    });
  }
}

function requireDeckTrack(id) {
  if (decks[id].track) return true;
  showToast(`حمّل مسارًا على المشغّل ${id.toUpperCase()} أولًا.`);
  return false;
}

function triggerPad(id, mode, index) {
  const deck = decks[id];
  if (mode === 'sampler') {
    triggerSampler(index);
    return;
  }
  if (!requireDeckTrack(id)) return;

  if (mode === 'hotcue') {
    if (deck.cues[index] === null) {
      deck.cues[index] = deck.audio.currentTime;
      showToast(`تم حفظ Hot Cue ${index + 1} عند ${formatTime(deck.audio.currentTime)}`);
    } else {
      deck.audio.currentTime = deck.cues[index];
      deck.audio.play().catch((error) => showToast(`تعذر تشغيل نقطة Cue: ${error.message}`));
    }
    renderPads();
  } else if (mode === 'loop') {
    if (deck.padLoop === index && deck.customLoop) {
      stopPadLoop(id);
      return;
    }
    const start = deck.audio.currentTime;
    const length = (padBeatLengths[index] * 60) / 120;
    const end = Math.min(deck.audio.duration || start + length, start + length);
    deck.padLoop = index;
    deck.customLoop = { start, end };
    deck.audio.currentTime = start;
    deck.audio.play().catch((error) => showToast(`تعذر بدء الحلقة: ${error.message}`));
    renderPads();
  } else if (mode === 'slicer') {
    const duration = deck.audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return;
    const sliceLength = duration / 8;
    const start = sliceLength * index;
    deck.customLoop = { start, end: start + sliceLength, slice: true };
    deck.padLoop = null;
    deck.audio.currentTime = start;
    deck.audio.play().catch((error) => showToast(`تعذر تشغيل المقطع: ${error.message}`));
    renderPads();
  }
}

function stopPadLoop(id) {
  const deck = decks[id];
  deck.customLoop = null;
  deck.padLoop = null;
  renderPads();
}

function startRoll(id, index) {
  const deck = decks[id];
  if (!requireDeckTrack(id)) return;
  if (!deck.customLoop?.roll) deck.rollResumeTime = deck.audio.currentTime;
  if (deck.rollTimeout) {
    window.clearTimeout(deck.rollTimeout);
    deck.rollTimeout = null;
  }
  const length = (padBeatLengths[index] * 60) / 120;
  const start = deck.audio.currentTime;
  deck.customLoop = { start, end: start + length, roll: true };
  deck.padLoop = index;
  deck.audio.play().catch((error) => showToast(`تعذر بدء Roll: ${error.message}`));
  renderPads();
}

function stopRoll(id) {
  const deck = decks[id];
  if (deck.rollTimeout) {
    window.clearTimeout(deck.rollTimeout);
    deck.rollTimeout = null;
  }
  if (deck.customLoop?.roll) {
    const resumeTime = deck.rollResumeTime;
    stopPadLoop(id);
    deck.rollResumeTime = null;
    if (Number.isFinite(resumeTime) && Number.isFinite(deck.audio.duration)) {
      deck.audio.currentTime = Math.min(resumeTime, deck.audio.duration);
    }
  }
}

function triggerSampler(index) {
  if (sampleTracks[index]) {
    playSample(index).catch((error) => showToast(`تعذر تشغيل العينة: ${error.message}`));
    return;
  }
  ensureAudioGraph();
  audioContext.resume().catch((error) => showToast(`تعذر تفعيل الصوت: ${error.message}`));
  const now = audioContext.currentTime;
  const output = audioContext.createGain();
  output.gain.value = 0.7;
  output.connect(masterGain);

  const playTone = (frequency, endFrequency, duration, type = 'sine', gainValue = 0.8, offset = 0) => {
    const startAt = now + offset;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startAt + duration);
    gain.gain.setValueAtTime(gainValue, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(gain).connect(output);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  };
  const playNoise = (duration, cutoff, type = 'highpass', level = 0.5, offset = 0) => {
    const startAt = now + offset;
    const source = audioContext.createBufferSource();
    const filter = audioContext.createBiquadFilter();
    const gain = audioContext.createGain();
    source.buffer = getNoiseBuffer();
    filter.type = type;
    filter.frequency.value = cutoff;
    gain.gain.setValueAtTime(level, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    source.connect(filter).connect(gain).connect(output);
    source.start(startAt);
    source.stop(startAt + duration);
  };

  if (index === 0) playTone(150, 42, 0.32, 'sine', 1);
  else if (index === 1) {
    playNoise(0.22, 1800, 'bandpass', 0.55);
    playTone(190, 90, 0.12, 'triangle', 0.25);
  } else if (index === 2) playNoise(0.12, 8500, 'highpass', 0.3);
  else if (index === 3) playNoise(0.42, 6500, 'highpass', 0.35);
  else if (index === 4) {
    for (let burst = 0; burst < 3; burst += 1) {
      const delay = burst * 0.035;
      playNoise(0.12, 1400, 'highpass', 0.35 * (1 - burst * 0.2), delay);
    }
  } else if (index === 5) playTone(180, 65, 0.28, 'sine', 0.7);
  else if (index === 6) {
    playTone(540, 540, 0.16, 'square', 0.16);
    playTone(800, 800, 0.16, 'square', 0.16);
  } else playTone(1900, 900, 0.08, 'triangle', 0.35);

  window.setTimeout(() => output.disconnect(), 700);
}

function setMidiStatus(message, state = '') {
  const status = $('#midi-status');
  status.className = `midi-status ${state}`.trim();
  status.lastChild.textContent = ` ${message}`;
}

function updateMidiControllerToggle() {
  const button = $('#midi-enabled-toggle');
  button.setAttribute('aria-pressed', String(midiControllersEnabled));
  button.classList.toggle('active', midiControllersEnabled);
  button.textContent = translatedText(midiControllersEnabled ? 'إيقاف وحدات التحكم' : 'تشغيل وحدات التحكم');
  button.title = translatedText(midiControllersEnabled
    ? 'إيقاف استقبال التحكم الخارجي'
    : 'تشغيل استقبال التحكم الخارجي');
  $('#midi-learn').disabled = !midiControllersEnabled || !midiAccess?.inputs.size;
}

async function toggleMidiControllers() {
  midiControllersEnabled = !midiControllersEnabled;
  updateMidiControllerToggle();
  try {
    localStorage.setItem('mixdeck-midi-enabled', String(midiControllersEnabled));
  } catch (error) {
    showToast(`تعذر حفظ إعداد وحدات التحكم الخارجية: ${error.message}`);
  }

  if (!midiControllersEnabled) {
    midiLearning = false;
    midiLearningTarget = null;
    $('.midi-mapping-target')?.classList.remove('midi-mapping-target');
    $('#midi-learn').classList.remove('active');
    setMidiStatus(translatedText('وحدات التحكم الخارجية متوقفة'));
    return;
  }

  if (!midiAccess) {
    await connectMidi();
    return;
  }
  refreshMidiInputs();
}

function saveMidiMappings() {
  try {
    localStorage.setItem('mixdeck-midi-mappings', JSON.stringify(midiMappings));
  } catch (error) {
    showToast(`تعذر حفظ تعيينات MIDI: ${error.message}`);
  }
}

function refreshMidiInputs() {
  if (!midiAccess) return;
  const select = $('#midi-device');
  const previousId = select.dataset.initialized === 'true'
    ? select.value
    : localStorage.getItem('mixdeck-midi-device') || '';
  select.replaceChildren();
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = translatedText('كل الأجهزة');
  select.append(allOption);

  const inputs = Array.from(midiAccess.inputs.values());
  for (const input of inputs) {
    const option = document.createElement('option');
    option.value = input.id;
    option.textContent = midiDeviceLabel(input);
    select.append(option);
  }
  select.disabled = inputs.length === 0;
  $('#midi-connect').disabled = inputs.length > 0;
  if (inputs.some((input) => input.id === previousId)) select.value = previousId;
  else {
    const profiledInputs = inputs.filter((input) => getControllerProfile(input));
    select.value = profiledInputs.length === 1 ? profiledInputs[0].id : inputs.length === 1 ? inputs[0].id : '';
  }
  select.dataset.initialized = 'true';
  for (const input of inputs) {
    input.onmidimessage = (event) => {
      if (midiControllersEnabled && (!select.value || select.value === input.id)) {
        if (midiActivityTimeout === null) {
          setMidiStatus(`${midiDeviceLabel(input)} · ${translatedText('تم استقبال MIDI')}`, 'connected');
          midiActivityTimeout = window.setTimeout(() => {
            midiActivityTimeout = null;
          }, 500);
        }
        handleMidiMessage(event, input.id);
      }
    };
  }
  if (inputs.length) {
    const activeInput = inputs.find((input) => input.id === select.value);
    const status = activeInput
      ? `${translatedText('تم توصيل')} ${midiDeviceLabel(activeInput)}`
      : `${inputs.length} جهاز متاح`;
    if (midiControllersEnabled) setMidiStatus(status, 'connected');
    else setMidiStatus(translatedText('وحدات التحكم الخارجية متوقفة'));
    $('#midi-hint').textContent = translatedText('يدعم التطبيق وحدات MIDI القياسية من Pioneer وHercules وNumark وغيرها عبر التعيين اليدوي. بعض الطرازات تحتاج تعريف الشركة أو لا تعرض أزرارها كـ MIDI.');
    $('#midi-hint').textContent += ` ${translatedText('تظهر واجهات الصوت الخاصة بالمتحكم في إعدادات مخارج الصوت إذا تعرّف عليها Windows.')}`;
    if (inputs.some((input) => getControllerProfile(input))) {
      $('#midi-hint').textContent = translatedText('خرائط تلقائية للعناصر الأساسية متاحة لـ Pioneer DDJ-200/400/FLX4/SB3 وHercules Inpulse 200/300/500 وNumark Party Mix وMixtrack Pro/Platinum FX. إذا لم تستجب بعض أزرار DDJ-200، استخدم «تعلّم التحكم»؛ التعيين اليدوي له الأولوية.');
    }
    $('#midi-hint').classList.remove('attention');
  } else {
    $('#midi-connect').disabled = false;
    setMidiStatus(midiControllersEnabled ? 'لا توجد أجهزة' : translatedText('وحدات التحكم الخارجية متوقفة'));
  }
  updateMidiControllerToggle();
}

function midiDeviceLabel(input) {
  if (!input) return 'المتحكم';
  const description = `${input.manufacturer || ''} ${input.name || ''}`.trim();
  if (/pioneer|alpha.?theta|ddj/i.test(description)) return `Pioneer DJ · ${input.name || input.id}`;
  if (/hercules|djcontrol\s+inpulse/i.test(description)) return `Hercules DJ · ${input.name || input.id}`;
  if (/numark|mixtrack|party\s*mix/i.test(description)) return `Numark · ${input.name || input.id}`;
  return input.name || input.manufacturer || `MIDI ${input.id}`;
}

function getControllerProfile(input) {
  const description = `${input?.manufacturer || ''} ${input?.name || ''}`.replace(/[–—−]/g, '-');
  const pioneer = description.match(/ddj[\s_-]*(200|400|flx[\s_-]*4|sb[\s_-]*3)/i);
  if (pioneer) {
    const model = pioneer[1].toLowerCase().replace(/[\s_-]+/g, '');
    return {
      family: 'pioneer',
      model: model === 'flx4' ? 'DDJ-FLX4' : `DDJ-${model.toUpperCase()}`
    };
  }

  const inpulse = description.match(/(?:hercules\s+)?djcontrol[\s_-]*inpulse[\s_-]*(200|300|500)/i);
  if (inpulse) return { family: 'hercules-inpulse', model: `DJControl Inpulse ${inpulse[1]}` };

  if (/numark[\s_-]*party\s*mix|party\s*mix/i.test(description)) {
    return { family: 'numark-party-mix', model: 'Party Mix' };
  }
  if (/numark[\s_-]*mixtrack[\s_-]*platinum[\s_-]*fx|mixtrack[\s_-]*platinum[\s_-]*fx/i.test(description)) {
    return { family: 'numark-mixtrack-fx', model: 'Mixtrack Platinum FX' };
  }
  if (/numark[\s_-]*mixtrack[\s_-]*pro[\s_-]*fx|mixtrack[\s_-]*pro[\s_-]*fx/i.test(description)) {
    return { family: 'numark-mixtrack-fx', model: 'Mixtrack Pro FX' };
  }
  return null;
}

function setMidiRangeValue(target, value, maximum = 127) {
  if (!target || target.disabled) return;
  const minimum = Number(target.min || 0);
  const range = Number(target.max || 127) - minimum;
  target.value = String(minimum + (value / maximum) * range);
  target.dispatchEvent(new Event('input', { bubbles: true }));
  target.dispatchEvent(new Event('change', { bubbles: true }));
}

function handleControllerMessage(event, deviceId) {
  const input = midiAccess?.inputs.get(deviceId);
  const profile = getControllerProfile(input);
  if (!input || !profile) return false;

  const [status, number, value] = event.data;
  const command = status & 0xf0;
  const channel = status & 0x0f;
  const isNoteOn = command === 0x90 && value > 0;
  const isNoteOff = command === 0x80 || (command === 0x90 && value === 0);
  const fourDeckProfile = profile.model === 'DDJ-SB3' || profile.model === 'Mixtrack Platinum FX';
  const deckId = profile.family === 'hercules-inpulse'
    ? channel === 1 ? 'a' : channel === 2 ? 'b' : null
    : channel === 0 ? 'a'
      : channel === 1 ? 'b'
        : fourDeckProfile && channel === 2 ? 'c'
          : fourDeckProfile && channel === 3 ? 'd' : null;

  if (command === 0x90 || command === 0x80) {
    let handled = false;
    const playNote = profile.family === 'pioneer' ? 0x0b
      : profile.family === 'hercules-inpulse' ? 0x07 : 0x00;
    const cueNote = profile.family === 'pioneer' ? 0x0c
      : profile.family === 'hercules-inpulse' ? 0x06 : 0x01;
    if (deckId && (number === playNote || (profile.family === 'numark-mixtrack-fx' && number === 0x04)) && isNoteOn) {
      togglePlayback(deckId);
      handled = true;
    } else if (deckId && (number === cueNote || (profile.family === 'numark-mixtrack-fx' && number === 0x05)) && isNoteOn) {
      $(`[data-action="cue"][data-deck="${deckId}"]`).click();
      handled = true;
    } else if (
      profile.family === 'pioneer' && (channel === 7 || channel === 9) && number < 8
      || profile.family === 'hercules-inpulse'
        && (channel === 6 || (profile.model.endsWith('500') && channel === 7))
        && number < 8
    ) {
      const padDeck = profile.family === 'hercules-inpulse'
        ? profile.model.endsWith('500') ? channel === 6 ? 'a' : 'b' : $('#midi-pad-target').value
        : channel === 7 ? 'a' : 'b';
      if (isNoteOn) {
        const mode = padModeForDeck(padDeck);
        if (mode === 'roll') startRoll(padDeck, number);
        else triggerPad(padDeck, mode, number);
      } else if (isNoteOff && padModeForDeck(padDeck) === 'roll') {
        stopRoll(padDeck);
      }
      handled = isNoteOn || (isNoteOff && padModeForDeck(padDeck) === 'roll');
    } else if (profile.family === 'pioneer' && profile.model !== 'DDJ-200' && deckId && number === 0x48 && isNoteOn) {
      $(`[data-action="cue"][data-deck="${deckId}"]`).click();
      handled = true;
    }

    if (handled) setMidiStatus(`${midiDeviceLabel(input)} · ${translatedText('تم استقبال MIDI')}`, 'connected');
    return handled;
  }

  if (command !== 0xb0) return false;

  let handled = false;
  const isPioneerCrossfader = profile.family === 'pioneer' && channel === 6 && number === 0x1f;
  const isHerculesCrossfader = profile.family === 'hercules-inpulse' && channel === 0 && number === 0x00;
  const isNumarkCrossfader = profile.family.startsWith('numark-')
    && (channel === 15 && number === 0x08
      || profile.family === 'numark-mixtrack-fx' && channel === 1 && number === 0x08);

  if (isPioneerCrossfader || isHerculesCrossfader || isNumarkCrossfader) {
    setMidiRangeValue($('#crossfader'), value);
    handled = true;
  } else if (profile.family === 'pioneer' && deckId && number === 0x00) {
    setMidiRangeValue($(`#tempo-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'pioneer' && deckId && number === 0x13) {
    setMidiRangeValue($(`#volume-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'pioneer' && deckId && number === 0x07) {
    setMidiRangeValue($(`#high-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'pioneer' && deckId && number === 0x0b) {
    setMidiRangeValue($(`#mid-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'pioneer' && deckId && number === 0x0f) {
    setMidiRangeValue($(`#low-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'hercules-inpulse' && deckId && number === 0x00) {
    setMidiRangeValue($(`#volume-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'hercules-inpulse' && /(?:300|500)$/.test(profile.model) && deckId && number === 0x03) {
    setMidiRangeValue($(`#mid-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-party-mix' && deckId && number === 0x1c) {
    setMidiRangeValue($(`#volume-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-party-mix' && deckId && number === 0x18) {
    setMidiRangeValue($(`#high-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-party-mix' && deckId && number === 0x19) {
    setMidiRangeValue($(`#low-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-mixtrack-fx' && deckId && number === 0x1c) {
    setMidiRangeValue($(`#volume-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-mixtrack-fx' && deckId && number === 0x17) {
    setMidiRangeValue($(`#high-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-mixtrack-fx' && deckId && number === 0x18) {
    setMidiRangeValue($(`#mid-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-mixtrack-fx' && deckId && number === 0x19) {
    setMidiRangeValue($(`#low-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-mixtrack-fx' && deckId && number === 0x09) {
    setMidiRangeValue($(`#tempo-${deckId}`), value);
    handled = true;
  } else if (profile.family.startsWith('numark-') && deckId && [0x16, 0x17].includes(number)) {
    setMidiRangeValue($(`#volume-${deckId}`), value);
    handled = true;
  } else if (profile.family === 'numark-party-mix' && deckId && number === 0x09) {
    setMidiRangeValue($(`#tempo-${deckId}`), value);
    handled = true;
  } else if (
    (profile.family === 'pioneer' && deckId && [0x21, 0x22, 0x23, 0x29].includes(number))
    || (profile.family === 'hercules-inpulse' && deckId && [0x09, 0x0a].includes(number))
    || (profile.family.startsWith('numark-') && deckId && number === 0x06)
  ) {
    if (!decks[deckId].track) return false;
    const delta = value - 64;
    const sensitivity = number === 0x29 ? 0.012 : 0.004;
    const deck = decks[deckId];
    deck.audio.currentTime = Math.max(0, Math.min(
      deck.audio.duration || 0,
      deck.audio.currentTime + delta * sensitivity
    ));
    updateTimeline(deckId);
    handled = true;
  } else {
    return false;
  }

  if (handled) setMidiStatus(`${midiDeviceLabel(input)} · ${translatedText('تم استقبال MIDI')}`, 'connected');
  return handled;
}

async function connectMidi() {
  if (!navigator.requestMIDIAccess) {
    showToast('هذا الإصدار لا يدعم MIDI. استخدم نسخة حديثة من التطبيق.');
    return;
  }
  try {
    midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    midiAccess.onstatechange = refreshMidiInputs;
    refreshMidiInputs();
    if (midiAccess.inputs.size === 0) {
      $('#midi-hint').textContent = 'لم يتم العثور على متحكم MIDI. تحقق من اتصال USB أو تعريف الشركة المصنّعة ثم أعد المحاولة.';
      $('#midi-hint').classList.add('attention');
    }
  } catch (error) {
    showToast(`تعذر الاتصال بمتحكم MIDI: ${error.message}`);
    setMidiStatus('تعذر الاتصال');
  }
}

function midiMessageKey(status, number) {
  const channel = status & 0x0f;
  const command = status & 0xf0;
  if (command === 0x90 || command === 0x80) return `note:${channel}:${number}`;
  if (command === 0xb0) return `cc:${channel}:${number}`;
  if (command === 0xe0) return `pitch:${channel}`;
  return null;
}

function handleMidiMessage(event, deviceId) {
  const [status, number, value] = event.data;
  const key = midiMessageKey(status, number);
  if (!key) return;
  const command = status & 0xf0;
  const isNoteOn = command === 0x90 && value > 0;
  const isNoteOff = command === 0x80 || (command === 0x90 && value === 0);
  const isController = command === 0xb0;
  const isPitchBend = command === 0xe0;
  const midiValue = isPitchBend ? (value << 7) | number : value;
  const maxMidiValue = isPitchBend ? 16383 : 127;
  const mappingKey = `${deviceId}|${key}`;

  if (midiLearningTarget) {
    if (isNoteOff) return;
    midiMappings[mappingKey] = midiLearningTarget;
    midiLearningTarget = null;
    midiLearning = false;
    saveMidiMappings();
    $('.midi-mapping-target')?.classList.remove('midi-mapping-target');
    $('#midi-learn').classList.remove('active');
    $('#midi-hint').textContent = `تم ربط عنصر التحكم بإشارة ${key} من ${midiDeviceLabel(midiAccess.inputs.get(deviceId))}.`;
    setMidiStatus('تم حفظ التعيين', 'connected');
    return;
  }

  if (!midiMappings[mappingKey] && !midiMappings[key] && handleControllerMessage(event, deviceId)) return;

  const targetId = midiMappings[mappingKey] || midiMappings[key];
  const target = targetId ? document.getElementById(targetId) : null;
  if (!target || target.disabled) return;

  const padDeck = target.matches('.performance-pad') ? target.closest('.deck')?.dataset.deck : null;
  const padIndex = target.matches('.performance-pad') ? Number(target.dataset.padIndex) : -1;
  if (isNoteOff && padDeck && padModeForDeck(padDeck) === 'roll') {
    stopRoll(padDeck);
    return;
  }
  if (target.matches('.jog-wheel')) {
    const id = target.id.replace('jog-', '');
    const deck = decks[id];
    if ((isController || isPitchBend) && deck.track) {
      const thresholdKey = mappingKey;
      const previousValue = midiLastValues.get(thresholdKey);
      midiLastValues.set(thresholdKey, midiValue);
      if (previousValue !== undefined) {
        deck.audio.currentTime = Math.max(0, Math.min(
          deck.audio.duration || 0,
          deck.audio.currentTime + (midiValue - previousValue) * (isPitchBend ? 0.00025 : 0.025)
        ));
      }
    } else if (isNoteOn) {
      togglePlayback(id);
    }
    return;
  }
  if (target.matches('input[type="range"]')) {
    if (isController || isPitchBend || isNoteOn) {
      const minimum = Number(target.min || 0);
      const maximum = Number(target.max || 127);
      const normalizedValue = isNoteOn ? 1 : midiValue / maxMidiValue;
      target.value = String(minimum + normalizedValue * (maximum - minimum));
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
    }
    return;
  }

  if (target.matches('select')) {
    if (isController || isNoteOn) {
      const thresholdKey = mappingKey;
      const previousValue = midiLastValues.get(thresholdKey) || 0;
      midiLastValues.set(thresholdKey, midiValue);
      if (isNoteOn || (previousValue < 96 && midiValue >= 96)) {
        target.selectedIndex = isController
          ? Math.min(target.options.length - 1, Math.floor(midiValue / 128 * target.options.length))
          : (target.selectedIndex + 1) % target.options.length;
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    return;
  }

  if (target.matches('.performance-pad') && padDeck && padModeForDeck(padDeck) === 'roll') {
    const thresholdKey = mappingKey;
    const previousValue = midiLastValues.get(thresholdKey) || 0;
    midiLastValues.set(thresholdKey, midiValue);
    if (isNoteOn || (isController && previousValue < 96 && midiValue >= 96)) {
      startRoll(padDeck, padIndex);
    } else if (isController && previousValue >= 96 && midiValue < 96) {
      stopRoll(padDeck);
    }
    return;
  }

  if (isController) {
    const thresholdKey = mappingKey;
    const previousValue = midiLastValues.get(thresholdKey) || 0;
    midiLastValues.set(thresholdKey, midiValue);
    if (previousValue < 96 && midiValue >= 96) {
      target.click();
    }
  } else if (isNoteOn) {
    target.click();
  }
}

const midiLastValues = new Map();

function beginMidiLearning() {
  if (!midiAccess || midiAccess.inputs.size === 0) {
    showToast('وصّل متحكم MIDI أولًا قبل تعلّم الأزرار والمنزلقات.');
    return;
  }
  $('.midi-mapping-target')?.classList.remove('midi-mapping-target');
  midiLearning = !midiLearning;
  midiLearningTarget = null;
  if (midiLearning) {
    $('#midi-hint').textContent = 'اختر زرًا أو منزلقًا في الواجهة، ثم حرّك عنصر التحكم المقابل على متحكم MIDI.';
    $('#midi-hint').classList.add('attention');
    $('#midi-learn').classList.add('active');
    setMidiStatus('بانتظار اختيار عنصر', 'learning');
  } else {
    $('#midi-hint').textContent = 'تم إلغاء تعلّم MIDI.';
    $('#midi-hint').classList.remove('attention');
    $('#midi-learn').classList.remove('active');
    setMidiStatus(midiAccess?.inputs.size ? 'متصل' : 'غير متصل', midiAccess?.inputs.size ? 'connected' : '');
  }
}

function armMidiTarget(event) {
  if (!midiLearning || !midiAccess || !midiAccess.inputs.size) return;
  const target = event.target.closest?.('[data-midi-control]');
  if (!target || ['midi-learn', 'midi-connect'].includes(target.id)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  midiLearningTarget = target.id;
  midiLearning = false;
  target.classList.add('midi-mapping-target');
  $('#midi-learn').classList.remove('active');
  $('#midi-hint').textContent = `حرّك زرًا أو منزلقًا على المتحكم لربطه بـ «${target.getAttribute('aria-label') || target.id}».`;
  setMidiStatus('بانتظار إشارة MIDI', 'learning');
}

function updateDeckMode() {
  const toggle = $('#deck-mode-toggle');
  fourDeckMode = !fourDeckMode;
  document.body.classList.toggle('four-deck-mode', fourDeckMode);
  toggle.setAttribute('aria-pressed', String(fourDeckMode));
  toggle.textContent = fourDeckMode ? 'العودة إلى عجلتين' : 'تفعيل 4 عجلات';
  $('#crossfader-label').textContent = fourDeckMode ? 'A + C ↔ B + D' : 'A ↔ B';
  if (!fourDeckMode) {
    for (const id of ['c', 'd']) {
      decks[id].audio?.pause();
    }
  }
  renderLibrary();
  updateCrossfader();
}

function syncQuickEffectButtons(id) {
  const selected = $(`#effect-type-${id}`).value;
  const enabled = $(`#effect-toggle-${id}`).getAttribute('aria-pressed') === 'true';
  $(`.deck-${id} .deck-fx-buttons`).querySelectorAll('button').forEach((button) => {
    button.classList.toggle('active', enabled && button.dataset.quickEffect === selected);
  });
}

function setQuickEffect(id, type) {
  ensureAudioGraph();
  const selector = $(`#effect-type-${id}`);
  const toggle = $(`#effect-toggle-${id}`);
  const isSameActiveEffect = selector.value === type && toggle.getAttribute('aria-pressed') === 'true';
  selector.value = type;
  toggle.setAttribute('aria-pressed', String(!isSameActiveEffect));
  toggle.textContent = isSameActiveEffect ? 'تشغيل' : 'إيقاف';
  toggle.classList.toggle('active', !isSameActiveEffect);
  syncQuickEffectButtons(id);
  updateEffect(id, true);
}

function handleDeckDrop(event, id) {
  event.preventDefault();
  const card = event.currentTarget;
  card.classList.remove('drop-target');
  const track = findDraggedTrack(event);
  if (track) loadTrack(id, track);
}

function drawVisualizers() {
  for (const id of DECK_IDS) {
    const deck = decks[id];
    if (deck.customLoop && deck.audio && deck.audio.currentTime >= deck.customLoop.end) {
      if (deck.customLoop.slice) {
        deck.customLoop = null;
        deck.padLoop = null;
        deck.audio.pause();
        renderPads();
      } else {
        deck.audio.currentTime = deck.customLoop.start;
      }
    }
    const canvas = $(`#wave-${id}`);
    const context = canvas.getContext('2d');
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(bounds.width * window.devicePixelRatio));
    const height = Math.max(1, Math.floor(bounds.height * window.devicePixelRatio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    context.clearRect(0, 0, width, height);
    const color = id === 'a' ? '#b7f467' : '#aa85ff';
    context.fillStyle = `${color}99`;
    const bars = 68;
    const gap = Math.max(2, Math.floor(width / 230));
    const barWidth = width / bars - gap;
    if (deck.analyser && deck.track) deck.analyser.getByteFrequencyData(deck.frequencyData);
    let meterLevel = 0;
    if (deck.track && deck.frequencyData?.length) {
      for (const value of deck.frequencyData) meterLevel += value;
      meterLevel = meterLevel / deck.frequencyData.length / 255;
    }
    const meter = document.querySelector(`[data-mixer-meter="${id}"] .mixer-meter`);
    if (meter) meter.style.setProperty('--meter-level', `${Math.min(100, meterLevel * 180)}%`);

    for (let index = 0; index < bars; index += 1) {
      const value = deck.track ? deck.frequencyData[Math.floor(index * deck.frequencyData.length / bars)] / 255 : 0;
      const idle = deck.track ? 0.035 : 0;
      const barHeight = Math.max(2, (value * 0.8 + idle) * height);
      const x = index * width / bars + gap / 2;
      context.globalAlpha = deck.track ? 0.45 + value * 0.5 : 0.12;
      context.fillRect(x, (height - barHeight) / 2, barWidth, barHeight);
    }
    context.globalAlpha = 1;
    const jog = $(`#jog-${id}`);
    if (jog && deck.audio) {
      jog.style.setProperty('--jog-angle', `${deck.audio.currentTime * 36}deg`);
    }
  }
  if (masterMeterAnalyser && masterMeterData) {
    masterMeterAnalyser.getByteTimeDomainData(masterMeterData);
    let sumSquares = 0;
    for (const sample of masterMeterData) {
      const amplitude = (sample - 128) / 128;
      sumSquares += amplitude * amplitude;
    }
    const level = Math.sqrt(sumSquares / masterMeterData.length);
    $('#master-level-meter i').style.setProperty('--meter-level', `${Math.min(100, level * 180)}%`);
  }
  requestAnimationFrame(drawVisualizers);
}

$('#import-button').addEventListener('click', importTracks);
$('#library-import').addEventListener('click', importTracks);
$('#library-folder').addEventListener('click', importFolder);
$('#empty-import').addEventListener('click', importTracks);
$('#dock-library-import').addEventListener('click', importTracks);
$('#dock-library-folder').addEventListener('click', importFolder);
$('#dock-library-open').addEventListener('click', () => $('#library-open').click());
$('#search-input').addEventListener('input', (event) => {
  $('#dock-search-input').value = event.target.value;
  renderLibrary();
});
$('#dock-search-input').addEventListener('input', (event) => {
  $('#search-input').value = event.target.value;
  renderLibrary();
});
$('#library-open').addEventListener('click', () => {
  renderLibrary();
  if (!libraryDialog.open) libraryDialog.show();
  else if (libraryMinimized) libraryRestoreButton.click();
});
$('#library-close').addEventListener('click', () => $('#library-modal').close());

const libraryDialog = $('#library-modal');
let libraryDragState = null;
let libraryRestoreSize = null;
let libraryMinimized = false;

function moveLibraryDialog(left, top) {
  const margin = 12;
  const maxLeft = Math.max(margin, window.innerWidth - libraryDialog.offsetWidth - margin);
  const maxTop = Math.max(margin, window.innerHeight - libraryDialog.offsetHeight - margin);
  libraryDialog.style.left = `${Math.min(maxLeft, Math.max(margin, left))}px`;
  libraryDialog.style.right = 'auto';
  libraryDialog.style.top = `${Math.min(maxTop, Math.max(margin, top))}px`;
  libraryDialog.style.bottom = 'auto';
  libraryDialog.style.transform = 'none';
}

function beginLibraryDrag(event) {
  if (event.button !== 0) return;
  if (event.currentTarget === libraryDragHandle && event.target.closest('button, input, select, label')) return;
  const bounds = libraryDialog.getBoundingClientRect();
  moveLibraryDialog(bounds.left, bounds.top);
  libraryDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    left: bounds.left,
    top: bounds.top,
    moved: false
  };
  event.currentTarget.setPointerCapture(event.pointerId);
  event.preventDefault();
}

function moveLibraryDrag(event) {
  if (!libraryDragState || libraryDragState.pointerId !== event.pointerId) return;
  const deltaX = event.clientX - libraryDragState.startX;
  const deltaY = event.clientY - libraryDragState.startY;
  if (Math.abs(deltaX) + Math.abs(deltaY) > 3) libraryDragState.moved = true;
  moveLibraryDialog(libraryDragState.left + deltaX, libraryDragState.top + deltaY);
}

function finishLibraryDrag(event) {
  if (!libraryDragState || libraryDragState.pointerId !== event.pointerId) return;
  const moved = libraryDragState.moved;
  libraryDragState = null;
  if (moved && event.currentTarget === libraryRestoreButton) libraryDialog.dataset.dragged = 'true';
}

const libraryDragHandle = $('[data-library-drag-handle]');
const libraryRestoreButton = $('#library-restore');
for (const handle of [libraryDragHandle, libraryRestoreButton]) {
  handle.addEventListener('pointerdown', beginLibraryDrag);
  handle.addEventListener('pointermove', moveLibraryDrag);
  handle.addEventListener('pointerup', finishLibraryDrag);
  handle.addEventListener('pointercancel', finishLibraryDrag);
}

$('#library-minimize').addEventListener('click', () => {
  const bounds = libraryDialog.getBoundingClientRect();
  libraryRestoreSize = { width: bounds.width, height: bounds.height };
  moveLibraryDialog(bounds.left, bounds.top);
  libraryMinimized = true;
  libraryDialog.classList.add('is-minimized');
});
libraryRestoreButton.addEventListener('click', () => {
  if (libraryDialog.dataset.dragged === 'true') {
    delete libraryDialog.dataset.dragged;
    return;
  }
  if (!libraryMinimized) return;
  libraryDialog.classList.remove('is-minimized');
  if (libraryRestoreSize) {
    libraryDialog.style.width = `${libraryRestoreSize.width}px`;
    libraryDialog.style.height = `${libraryRestoreSize.height}px`;
  }
  libraryMinimized = false;
});

function updateFullScreenButton(isFullScreen) {
  const button = $('#fullscreen-toggle');
  button.setAttribute('aria-pressed', String(isFullScreen));
  const label = isFullScreen ? 'إنهاء وضع ملء الشاشة' : 'تفعيل وضع ملء الشاشة';
  button.setAttribute('aria-label', translatedText(label));
  button.title = translatedText('ملء الشاشة (F11)');
  button.classList.toggle('active', isFullScreen);
}

async function toggleFullScreen() {
  try {
    updateFullScreenButton(await window.mixDeck.toggleFullScreen());
  } catch (error) {
    showToast(`تعذر تغيير وضع ملء الشاشة: ${error.message}`);
  }
}

$('#fullscreen-toggle').addEventListener('click', toggleFullScreen);
window.mixDeck.onFullScreenChanged(updateFullScreenButton);
window.mixDeck.isFullScreen().then(updateFullScreenButton).catch((error) => {
  showToast(`تعذر قراءة حالة ملء الشاشة: ${error.message}`);
});

window.addEventListener('keydown', (event) => {
  if (event.key === 'F11') {
    event.preventDefault();
    toggleFullScreen();
    return;
  }
  if (event.key === 'Escape' && $('#library-modal').open && !$('#audio-settings-modal').open) {
    $('#library-modal').close();
  }
});
window.addEventListener('resize', () => {
  if (!libraryDialog.open) return;
  const bounds = libraryDialog.getBoundingClientRect();
  moveLibraryDialog(bounds.left, bounds.top);
});
$('#audio-settings-open').addEventListener('click', () => {
  refreshAudioOutputs().catch((error) => {
    showToast(`تعذر تعداد مخارج الصوت: ${error.message}`);
  });
  if (!$('#audio-settings-modal').open) $('#audio-settings-modal').showModal();
});
$('#audio-settings-close').addEventListener('click', () => $('#audio-settings-modal').close());
$('#master-output-device').addEventListener('change', async (event) => {
  const nextDeviceId = event.currentTarget.value;
  const previousDeviceId = audioOutputSettings.masterDeviceId;
  if (nextDeviceId && nextDeviceId === audioOutputSettings.headphoneDeviceId) {
    event.currentTarget.value = previousDeviceId;
    showToast('اختر جهازين مختلفين لمخارج السماعات.');
    return;
  }
  try {
    await applyAudioOutput($('#master-output'), nextDeviceId);
    audioOutputSettings.masterDeviceId = nextDeviceId;
    saveAudioOutputSettings();
    if (audioContext) await startAudioOutputs();
    setAudioSettingsStatus('متصل');
  } catch (error) {
    event.currentTarget.value = previousDeviceId;
    setAudioSettingsStatus(`تعذر تغيير مخرج الصوت: ${error.message}`);
    showToast(`تعذر تغيير مخرج الصوت: ${error.message}`);
  }
});
$('#headphone-output-device').addEventListener('change', async (event) => {
  const nextDeviceId = event.currentTarget.value;
  const previousDeviceId = audioOutputSettings.headphoneDeviceId;
  if (nextDeviceId && nextDeviceId === audioOutputSettings.masterDeviceId) {
    event.currentTarget.value = previousDeviceId;
    showToast('اختر جهازين مختلفين لمخارج السماعات.');
    return;
  }
  try {
    if (nextDeviceId) await applyAudioOutput($('#headphone-output'), nextDeviceId);
    audioOutputSettings.headphoneDeviceId = nextDeviceId;
    if (!nextDeviceId) {
      for (const id of DECK_IDS) decks[id].headphoneCue = false;
      $('#headphone-output').pause();
    }
    saveAudioOutputSettings();
    if (audioContext) await startAudioOutputs();
    updateHeadphoneRouting();
    setAudioSettingsStatus(nextDeviceId ? 'متصل' : '');
  } catch (error) {
    event.currentTarget.value = previousDeviceId;
    setAudioSettingsStatus(`تعذر تغيير مخرج الصوت: ${error.message}`);
    showToast(`تعذر تغيير مخرج الصوت: ${error.message}`);
  }
});
$('#headphone-mix').addEventListener('input', (event) => {
  audioOutputSettings.cueMix = Number(event.currentTarget.value);
  updateHeadphoneMixLabel();
  updateHeadphoneRouting();
  saveAudioOutputSettings();
});
refreshAudioOutputs().catch((error) => {
  showToast(`تعذر تعداد مخارج الصوت: ${error.message}`);
});
if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener('devicechange', () => {
    refreshAudioOutputs().catch((error) => {
      showToast(`تعذر تعداد مخارج الصوت: ${error.message}`);
    });
  });
}
$('#crossfader').addEventListener('input', updateCrossfader);
$('#deck-mode-toggle').addEventListener('click', updateDeckMode);
$('#track-analysis-close').addEventListener('click', () => $('#track-analysis-modal').close());
$('#track-analysis-dismiss').addEventListener('click', () => $('#track-analysis-modal').close());
$('#track-analysis-modal').addEventListener('close', () => {
  activeAnalysisTrack = null;
});
$('#track-analysis-retry').addEventListener('click', () => {
  if (activeAnalysisTrack) openTrackAnalysis(activeAnalysisTrack, true);
});
for (const id of DECK_IDS) {
  $(`#sync-${id}`).addEventListener('click', () => syncDeckTempo(id));
}
function toggleLanguage() {
  currentLanguage = currentLanguage === 'ar' ? 'en' : 'ar';
  try {
    localStorage.setItem('noor-dj-language', currentLanguage);
  } catch (error) {
    showToast(`تعذر حفظ اللغة: ${error.message}`);
  }
  applyLanguage();
  renderLibrary();
  renderRhythmSequencer();
  renderSavedRhythms($('#rhythm-saved').value);
  updateMidiControllerToggle();
  updateHeadphoneMixLabel();
  refreshAudioOutputs().catch((error) => {
    showToast(`تعذر تعداد مخارج الصوت: ${error.message}`);
  });
}
$('#language-toggle').addEventListener('click', toggleLanguage);
$('#welcome-language-toggle').addEventListener('click', toggleLanguage);
$('#welcome-enter').addEventListener('click', () => {
  $('#welcome-screen').classList.add('is-hidden');
  const app = $('.app-shell');
  app.inert = false;
  app.setAttribute('aria-hidden', 'false');
  $('#import-button').focus();
});
$('#rhythm-open').addEventListener('click', () => {
  if (!$('#rhythm-modal').open) $('#rhythm-modal').showModal();
});
$('#rhythm-close').addEventListener('click', () => $('#rhythm-modal').close());
$('#rhythm-modal').addEventListener('close', stopRhythm);
$('#rhythm-pattern').addEventListener('change', (event) => {
  rhythmSteps = makeRhythmSteps(RHYTHM_PATTERNS[event.currentTarget.value]);
  renderRhythmSequencer();
});
$('#rhythm-sequencer').addEventListener('click', (event) => {
  const button = event.target.closest('.rhythm-step');
  if (!button) return;
  const instrument = button.dataset.instrument;
  const index = Number(button.dataset.step);
  rhythmSteps[instrument][index] = !rhythmSteps[instrument][index];
  button.classList.toggle('active', rhythmSteps[instrument][index]);
  button.setAttribute('aria-pressed', String(rhythmSteps[instrument][index]));
});
$('#rhythm-tempo').addEventListener('input', (event) => {
  $('#rhythm-tempo-value').textContent = `${event.currentTarget.value} BPM`;
});
$('#rhythm-volume').addEventListener('input', (event) => {
  $('#rhythm-volume-value').textContent = `${event.currentTarget.value}%`;
});
$('#rhythm-save').addEventListener('click', () => {
  const name = $('#rhythm-name').value.trim();
  if (!name) {
    $('#rhythm-status').textContent = translatedText('اكتب اسمًا للإيقاع قبل حفظه.');
    $('#rhythm-name').focus();
    return;
  }
  const selectedId = $('#rhythm-saved').value;
  const existing = savedRhythms.find((rhythm) => rhythm.id === selectedId);
  const rhythm = {
    id: existing?.id || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    steps: Object.fromEntries(RHYTHM_INSTRUMENTS.map(({ id }) => [id, [...rhythmSteps[id]]]))
  };
  if (existing) savedRhythms = savedRhythms.map((item) => item.id === existing.id ? rhythm : item);
  else savedRhythms.push(rhythm);
  if (!saveRhythmsToStorage()) return;
  renderSavedRhythms(rhythm.id);
  $('#rhythm-status').textContent = translatedText('تم حفظ الإيقاع.');
});
$('#rhythm-saved').addEventListener('change', (event) => {
  const rhythm = savedRhythms.find((item) => item.id === event.currentTarget.value);
  if (!rhythm) {
    $('#rhythm-status').textContent = translatedText('اختر إيقاعًا محفوظًا.');
    return;
  }
  rhythmSteps = Object.fromEntries(RHYTHM_INSTRUMENTS.map(({ id }) => [id, [...rhythm.steps[id]]]));
  $('#rhythm-pattern').value = 'empty';
  $('#rhythm-name').value = rhythm.name;
  renderRhythmSequencer();
  $('#rhythm-status').textContent = translatedText('اختر نمطًا أو انقر الخطوات لصنع إيقاعك، ثم اضغط تشغيل.');
});
$('#rhythm-play').addEventListener('click', startRhythm);
$('#rhythm-stop').addEventListener('click', stopRhythm);
$('#master-volume').addEventListener('input', (event) => {
  $('#master-value').textContent = `${event.target.value}%`;
  if (masterGain) masterGain.gain.setTargetAtTime(Number(event.target.value) / 100, audioContext.currentTime, 0.015);
});

for (const id of DECK_IDS) {
  $(`#headphone-cue-${id}`).addEventListener('click', () => setHeadphoneCue(id));
  $(`[data-load="${id}"]`).addEventListener('click', () => importTracks(id));
  $(`[data-action="play"][data-deck="${id}"]`).addEventListener('click', () => togglePlayback(id));
  $(`[data-action="cue"][data-deck="${id}"]`).addEventListener('click', () => {
    const deck = decks[id];
    if (!deck.track) {
      showToast('حمّل مسارًا قبل استخدام CUE.');
      return;
    }
    deck.audio.pause();
    deck.audio.currentTime = 0;
    deck.customLoop = null;
    deck.padLoop = null;
    syncStemMedia(id, false);
    renderPads();
    updateTimeline(id);
  });
  $(`[data-action="loop"][data-deck="${id}"]`).addEventListener('click', (event) => {
    const deck = decks[id];
    if (!deck.track) {
      showToast('حمّل مسارًا قبل تفعيل التكرار.');
      return;
    }
    deck.audio.loop = !deck.audio.loop;
    deck.customLoop = null;
    deck.padLoop = null;
    event.currentTarget.classList.toggle('active', deck.audio.loop);
    renderPads();
  });
  $(`#seek-${id}`).addEventListener('input', (event) => {
    decks[id].seeking = true;
    const audio = decks[id].audio;
    if (audio && Number.isFinite(audio.duration)) {
      audio.currentTime = Number(event.target.value) / 100 * audio.duration;
      syncStemMedia(id, !audio.paused);
      $(`#time-${id}`).textContent = formatTime(audio.currentTime);
    }
  });
  $(`#seek-${id}`).addEventListener('change', () => {
    decks[id].seeking = false;
  });
  $(`#tempo-${id}`).addEventListener('input', (event) => {
    if (decks[id].syncSourceId && event.currentTarget.dataset.syncUpdate !== 'true') {
      decks[id].syncSourceId = null;
      $(`#sync-${id}`).setAttribute('aria-pressed', 'false');
      $(`#sync-${id}`).classList.remove('active');
    }
    updateDeckTempo(id, Number(event.currentTarget.value));
    refreshSyncedFollowers(id);
  });
  $(`#volume-${id}`).addEventListener('input', (event) => {
    if (decks[id].gain && audioContext) {
      decks[id].gain.gain.setTargetAtTime(Number(event.target.value) / 100, audioContext.currentTime, 0.015);
    }
  });

  for (const band of ['low', 'mid', 'high']) {
    $(`#${band}-${id}`).addEventListener('input', (event) => {
      const filter = decks[id].filters[band];
      if (filter && audioContext) {
        filter.gain.setTargetAtTime((Number(event.target.value) - 50) * 0.24, audioContext.currentTime, 0.015);
      }
    });
  }

  $(`#stems-${id}`).addEventListener('click', () => separateDeckStems(id));
  for (const name of ['vocals', 'drums', 'bass', 'other']) {
    $(`#stem-${name}-${id}`).addEventListener('input', (event) => {
      const stem = decks[id].stemMedia.find((item) => item.name === name);
      if (stem && audioContext) {
        stem.gain.gain.setTargetAtTime(Number(event.target.value) / 100, audioContext.currentTime, 0.015);
      }
    });
  }

  const jog = $(`#jog-${id}`);
  jog.addEventListener('pointerdown', (event) => {
    if (!decks[id].track) {
      showToast(`حمّل مسارًا على المشغّل ${id.toUpperCase()} أولًا.`);
      return;
    }
    jog.setPointerCapture(event.pointerId);
    decks[id].jogDrag = event.clientY;
    event.preventDefault();
  });
  jog.addEventListener('pointermove', (event) => {
    const deck = decks[id];
    if (deck.jogDrag === undefined || !deck.audio) return;
    const delta = deck.jogDrag - event.clientY;
    deck.jogDrag = event.clientY;
    deck.audio.currentTime = Math.max(0, Math.min(deck.audio.duration || 0, deck.audio.currentTime + delta * 0.035));
  });
  jog.addEventListener('pointerup', () => {
    delete decks[id].jogDrag;
  });
  jog.addEventListener('pointercancel', () => {
    delete decks[id].jogDrag;
  });

  const card = $(`.deck-${id}.deck`);
  card.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    card.classList.add('drop-target');
  });
  card.addEventListener('dragleave', (event) => {
    if (!card.contains(event.relatedTarget)) card.classList.remove('drop-target');
  });
  card.addEventListener('drop', (event) => handleDeckDrop(event, id));
  card.querySelectorAll('[data-quick-effect]').forEach((button) => {
    button.addEventListener('click', () => setQuickEffect(id, button.dataset.quickEffect));
  });
}

$('#help-button').addEventListener('click', () => {
  showToast('استورد ملفاتك، حمّل أغنية على A أو B، ثم استخدم المزج المتقاطع للانتقال بينهما.');
});

for (const id of DECK_IDS) {
  $(`#effect-type-${id}`).addEventListener('change', () => {
    ensureAudioGraph();
    updateEffect(id, true);
    syncQuickEffectButtons(id);
  });
  $(`#effect-toggle-${id}`).addEventListener('click', async (event) => {
    ensureAudioGraph();
    const enabled = event.currentTarget.getAttribute('aria-pressed') !== 'true';
    event.currentTarget.setAttribute('aria-pressed', String(enabled));
    event.currentTarget.textContent = enabled ? 'إيقاف' : 'تشغيل';
    event.currentTarget.classList.toggle('active', enabled);
    try {
      await audioContext.resume();
      updateEffect(id);
      syncQuickEffectButtons(id);
    } catch (error) {
      showToast(`تعذر تشغيل المؤثر: ${error.message}`);
    }
  });
  $(`#effect-param-${id}`).addEventListener('input', () => updateEffect(id));
  $(`#effect-param-${id}`).addEventListener('change', () => updateEffect(id, true));
  $(`#effect-wet-${id}`).addEventListener('input', () => updateEffect(id));
}

for (const id of DECK_IDS) {
  $(`#pad-mode-${id}`).addEventListener('change', () => renderPads(id));
  $(`#pad-reset-${id}`).addEventListener('click', () => {
    decks[id].cues.fill(null);
    renderPads(id);
    showToast(`تم مسح نقاط Hot Cue للمشغّل ${id.toUpperCase()}.`);
  });
}
$('#sample-import').addEventListener('click', importSamples);
document.addEventListener('pointerup', () => {
  for (const id of DECK_IDS) {
    if (decks[id].customLoop?.roll) stopRoll(id);
  }
});
$('#midi-connect').addEventListener('click', connectMidi);
$('#midi-enabled-toggle').addEventListener('click', () => {
  toggleMidiControllers().catch((error) => {
    showToast(`تعذر تشغيل وحدات التحكم الخارجية: ${error.message}`);
  });
});
$('#midi-learn').addEventListener('click', beginMidiLearning);
$('#record-toggle').addEventListener('click', toggleMixRecording);
$('#midi-device').addEventListener('change', (event) => {
  event.target.dataset.initialized = 'true';
  try {
    localStorage.setItem('mixdeck-midi-device', event.target.value);
  } catch (error) {
    showToast(`تعذر حفظ اختيار متحكم MIDI: ${error.message}`);
  }
  refreshMidiInputs();
});
if (navigator.requestMIDIAccess) connectMidi();
updateMidiControllerToggle();
document.addEventListener('pointerdown', armMidiTarget, true);
document.addEventListener('click', armMidiTarget, true);
document.querySelectorAll('input[type="range"], button[data-midi-control]').forEach((control) => {
  control.dataset.midiControl = '';
});
document.querySelectorAll('button[data-action], .deck-load, .effect-toggle, select[id^="effect-type-"]').forEach((control) => {
  control.dataset.midiControl = '';
});
const languageObserver = new MutationObserver((records) => {
  for (const record of records) {
    if (record.type === 'characterData') {
      translateSubtree(record.target);
    } else if (record.type === 'attributes') {
      translateSubtree(record.target);
    } else {
      record.addedNodes.forEach(translateSubtree);
    }
  }
});
languageObserver.observe(document.body, {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['aria-label', 'placeholder', 'title']
});
applyLanguage();
renderRhythmSequencer();
readSavedRhythms();
renderPads();
renderSampleBox();

window.mixDeck.listAudioFiles().then((tracks) => {
  const knownIds = new Set(library.map((track) => track.id));
  for (const track of tracks) {
    if (!knownIds.has(track.id)) {
      library.push(track);
      knownIds.add(track.id);
    }
  }
  const tracksById = new Map(library.map((track) => [track.id, track]));
  savedSampleIds.forEach((id, index) => {
    sampleTracks[index] = id ? tracksById.get(id) || null : null;
  });
  renderLibrary();
  renderSampleBox();
}).catch((error) => {
  showToast(`تعذر تحميل مكتبة الموسيقى: ${error.message}`);
});
