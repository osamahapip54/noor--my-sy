# NOOR DJ

تطبيق DJ لنظام Windows مبني باستخدام Electron. يهدف المشروع إلى توفير مساحة محلية لمزج الموسيقى وتنظيمها، مع دعم أولي لوحدات التحكم الخارجية عبر MIDI.

**نرحّب بالأفكار وتقارير الأخطاء والمساهمات البرمجية.** ابدأ بفتح Issue قبل العمل على تغيير كبير حتى نتفق على النطاق.

## المزايا

- مشغلات DJ بوضعي العجلتين والأربع عجلات، مع مؤثرات صوتية ووسادات أداء.
- مكتبة محلية للأغاني، وتحليل معلومات الملفات وBPM عند توفر البيانات أو إمكانية تقديره.
- مزج صوتي وتسجيل محلي وإعدادات لمخارج الصوت وسماعات الرأس.
- استقبال MIDI مع تعيين تلقائي لبعض المتحكمات، وإمكانية تعلّم التعيينات يدويًا.

التوافق مع المتحكمات يعتمد على ما يرسله الجهاز وتعريفاته؛ التعيينات الحالية لا تضمن دعم كل وظائف كل طراز. لا ترفع ملفات الموسيقى أو التسجيلات الشخصية إلى Issues أو Pull Requests.

## التشغيل والتطوير

يتطلب المشروع Node.js وnpm.

```powershell
npm install
npm start
```

لبناء مُثبّت Windows:

```powershell
npm run dist
```

## كيف تساهم؟

1. ابحث في [Issues](https://github.com/osamahapip54/noor--my-sy/issues) عن مشكلة قائمة، أو افتح Issue لاقتراحك.
2. انسخ المستودع إلى حسابك (Fork)، وأنشئ فرعًا لتغييرك.
3. نفّذ تعديلًا محددًا، واختبره في التطبيق.
4. أرسل Pull Request يشرح المشكلة والحل وخطوات الاختبار. أرفق صورًا عند تغيير الواجهة، ولا ترفق ملفات موسيقى خاصة.

راجع [دليل المساهمة](./CONTRIBUTING.md) قبل البدء.

## ملاحظة حول الرخصة

هذا المستودع لا يحتوي حاليًا على ملف رخصة. نشر الكود علنًا لا يمنح تلقائيًا إذنًا عامًا بإعادة استخدامه أو توزيعه. تواصل مع مالك المشروع قبل إعادة استخدام الكود أو توزيعه؛ ويمكن مناقشة الرخصة مستقبلًا.

---

# NOOR DJ (English)

NOOR DJ is a Windows DJ application built with Electron. It aims to provide a local workspace for mixing and organizing music, with initial support for external MIDI controllers.

**Ideas, bug reports, and code contributions are welcome.** Please open an issue before starting substantial work so we can agree on its scope.

## Features

- Two- and four-deck layouts, audio effects, and performance pads.
- A local music library, file metadata analysis, and BPM analysis when tagged data or audio allows it.
- Audio mixing, local recording, and master/headphone output settings.
- MIDI input with automatic mappings for some controllers and manual MIDI learn.

Controller compatibility depends on device messages and drivers; current mappings do not guarantee every feature of every model. Do not upload personal music or recordings in issues or pull requests.

## Development

Install Node.js and npm, then run:

```powershell
npm install
npm start
```

Build the Windows installer with:

```powershell
npm run dist
```

## Contributing

1. Check [existing issues](https://github.com/osamahapip54/noor--my-sy/issues), or open one to discuss your idea.
2. Fork the repository and create a branch for your change.
3. Make a focused change and test it in the application.
4. Submit a pull request describing the problem, solution, and verification steps. Include screenshots for UI changes; never attach private music files.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

This repository currently has no license. Public visibility alone does not grant general permission to reuse or distribute the code. Contact the project owner before reusing or distributing it; a license may be discussed later.
