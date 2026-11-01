# المساهمة في NOOR DJ

شكرًا لاهتمامك بالمساعدة في تطوير NOOR DJ!

## قبل البدء

- افتح Issue لوصف الخطأ أو الميزة المقترحة، وناقش التغييرات الكبيرة قبل تنفيذها.
- اذكر إصدار Windows وخطوات إعادة إنتاج المشكلة عند الإبلاغ عن خطأ.
- لا ترفق أغانٍ أو تسجيلات أو بيانات شخصية. استخدم وصفًا أو ملفات تجريبية تملك حق مشاركتها.

## إعداد المشروع

```powershell
npm install
npm start
```

## إرسال تغيير

1. أنشئ Fork وفرعًا مستقلًا لكل تغيير.
2. اتبع أنماط HTML وCSS وJavaScript الموجودة، واجعل التغيير محدودًا وواضحًا.
3. اختبر السلوك المتأثر يدويًا. للمتحكمات، اذكر الطراز ونظام التشغيل وطريقة الاتصال؛ لا تفترض أن محاكاة MIDI تؤكد توافق جهاز حقيقي.
4. أرسل Pull Request مع ملخص التغيير وخطوات الاختبار، وأرفق صورًا للتغييرات المرئية عند الحاجة.
5. إذا لم تستطع إكمال العمل، أخبرنا بما جربته وأين توقفت.

لا يوجد حاليًا إعداد آلي للاختبارات في `package.json`؛ اذكر بوضوح ما تم التحقق منه وما لم يتم.

## الرخصة

المشروع حاليًا بلا ملف رخصة. لا تفترض وجود إذن لإعادة استخدام الكود أو توزيعه؛ تواصل مع مالك المشروع بشأن ذلك.

---

# Contributing to NOOR DJ

Thanks for helping improve NOOR DJ!

## Before you start

- Open an issue describing a bug or proposed feature. Discuss substantial changes before implementing them.
- For bug reports, include the Windows version and clear reproduction steps.
- Never attach songs, recordings, or personal data. Use descriptions or test files you have permission to share.

## Set up the project

```powershell
npm install
npm start
```

## Submit a change

1. Fork the repository and create a separate branch for each change.
2. Follow the existing HTML, CSS, and JavaScript patterns; keep changes focused.
3. Manually test the affected behavior. For controller changes, include the model, OS, and connection method; MIDI simulation alone does not verify a physical controller.
4. Open a pull request with a summary and verification steps. Include screenshots for visual changes when useful.
5. If you cannot finish, share what you tried and where you got stuck.

There is currently no automated test script in `package.json`. Be explicit about what you did and did not verify.

## License

The project currently has no license file. Do not assume permission to reuse or distribute the code; contact the project owner.
