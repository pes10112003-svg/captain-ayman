import type { Locale } from "./config";

/**
 * Translations for messages produced on the server (service errors, validation errors).
 * Services throw English messages; the action/API layer translates them for the viewer's locale.
 */
const AR: Record<string, string> = {
  "Please sign in to continue.": "سجّل الدخول للمتابعة.",
  "You don't have permission to do that.": "ليس لديك صلاحية للقيام بذلك.",
  "Not found.": "غير موجود.",
  "Please check the highlighted fields.": "راجع الحقول المحددة.",
  "Something went wrong on our side. Please try again.": "حدث خطأ من جهتنا. حاول مرة أخرى.",
  "Please set a new password first.": "عيّن كلمة مرور جديدة أولًا.",
  "Cross-site request blocked.": "تم حظر طلب من موقع خارجي.",
  "Client not found.": "العميل غير موجود.",
  "Invalid email or password.": "البريد أو كلمة المرور غير صحيحة.",
  "This account has been disabled. Please contact your coach.": "هذا الحساب موقوف. تواصل مع الكابتن.",
  "Current password is incorrect.": "كلمة المرور الحالية غير صحيحة.",
  "Choose a password you haven't used here.": "اختر كلمة مرور لم تستخدمها هنا من قبل.",
  "Choose a new password.": "اختر كلمة مرور جديدة.",
  "This reset link is invalid or has expired. Ask for a new one.": "رابط إعادة التعيين غير صالح أو منتهي. اطلب رابطًا جديدًا.",
  "This reset link has already been used.": "تم استخدام رابط إعادة التعيين من قبل.",
  "That email is already in use.": "هذا البريد مستخدم بالفعل.",
  "Type the client's full name to confirm.": "اكتب اسم العميل كاملًا للتأكيد.",
  "Name doesn't match.": "الاسم غير مطابق.",
  "Set not found.": "المجموعة غير موجودة.",
  "This set is no longer available — your coach may have just updated the workout. Refresh to continue.":
    "هذه المجموعة لم تعد موجودة — ربما حدّث الكابتن التمرين للتو. حدّث الصفحة للمتابعة.",
  "Only today's workout can be updated.": "يمكن تعديل تمرين اليوم فقط.",
  "This workout is already completed.": "هذا التمرين مكتمل بالفعل.",
  "No workout assigned for today.": "لا يوجد تمرين اليوم.",
  "Workout record not found.": "سجل التمرين غير موجود.",
  "Meal not found.": "الوجبة غير موجودة.",
  "This meal is no longer in your plan — refresh to see the latest.": "هذه الوجبة لم تعد في خطتك — حدّث الصفحة لترى الأحدث.",
  "Only today's meals can be updated.": "يمكن تعديل وجبات اليوم فقط.",
  "Unknown measurement type.": "نوع قياس غير معروف.",
  "Measurement not found.": "القياس غير موجود.",
  "Photo not found.": "الصورة غير موجودة.",
  "Choose an image to upload.": "اختر صورة لرفعها.",
  "Only JPEG, PNG, WebP, AVIF or HEIC images are allowed.": "مسموح فقط بصور JPEG أو PNG أو WebP أو AVIF أو HEIC.",
  "That file isn't a valid image.": "هذا الملف ليس صورة صالحة.",
  "Unsupported image format.": "صيغة صورة غير مدعومة.",
  "We couldn't process that image. Try a JPEG or PNG.": "تعذّرت معالجة الصورة. جرّب JPEG أو PNG.",
  "Enter your email and password.": "أدخل البريد وكلمة المرور.",
  "Enter a valid email address.": "أدخل بريدًا إلكترونيًا صحيحًا.",
  "Enter a valid email address": "أدخل بريدًا إلكترونيًا صحيحًا",
  "Admin setup is disabled on this server.": "صفحة إعداد المسؤول غير مفعّلة على هذا الخادم.",
  "Email is required": "البريد مطلوب",
  "Password is required": "كلمة المرور مطلوبة",
  "Password must be at least 8 characters": "كلمة المرور يجب ألا تقل عن 8 أحرف",
  "Password must be 128 characters or fewer": "كلمة المرور يجب ألا تزيد عن 128 حرفًا",
  "Passwords don't match": "كلمتا المرور غير متطابقتين",
  "Name is too short": "الاسم قصير جدًا",
  "Enter a valid phone number": "أدخل رقم هاتف صحيحًا",
  "Enter a valid date": "أدخل تاريخًا صحيحًا",
  "Enter a valid http(s) URL": "أدخل رابطًا صحيحًا يبدأ بـ http(s)",
  "Invalid identifier": "معرّف غير صالح",
  "Use HH:MM (24h)": "استخدم الصيغة HH:MM",
  "Exercise name is required": "اسم التمرين مطلوب",
  "Add at least one set": "أضف مجموعة واحدة على الأقل",
  "Workout title is required": "اسم التمرين مطلوب",
  "Plan name is required": "اسم الخطة مطلوب",
  "Food name is required": "اسم الصنف مطلوب",
  "Meal name is required": "اسم الوجبة مطلوب",
  "Must be greater than 0": "يجب أن تكون أكبر من 0",
  "Enter at least one measurement": "أدخل قياسًا واحدًا على الأقل",
  "Unknown timezone": "منطقة زمنية غير معروفة",
  "Duplicate workout keys": "أيام تمرين مكررة",
  "Unknown workout in schedule": "تمرين غير معروف في الجدول",
  "That access code isn't correct.": "كود الدخول غير صحيح.",
  "Enter the access code.": "أدخل كود الدخول.",
  "Access code must be at least 6 letters or numbers.": "كود الدخول يجب أن يكون 6 حروف أو أرقام على الأقل.",
  "The admin key is incorrect.": "مفتاح المسؤول غير صحيح.",
  "A coach account already exists.": "حساب الكابتن موجود بالفعل.",
  "No coach account with that email.": "لا يوجد حساب كابتن بهذا البريد.",
  "Body must be { consumed: boolean }": "صيغة الطلب غير صحيحة.",
  "Invalid input": "قيمة غير صالحة",
};

const AR_PATTERNS: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Too many attempts\. Try again in (\d+) minute\(s\)\.$/, (m) => `محاولات كثيرة. حاول مرة أخرى بعد ${m[1]} دقيقة.`],
  [/^Images must be (\d+) MB or smaller\.$/, (m) => `الصور يجب ألا تتجاوز ${m[1]} ميجا.`],
  [/^(.+) was entered twice\.$/, (m) => `${m[1]} مكرر مرتين.`],
  [/^(.+) must be 100% or less\.$/, (m) => `${m[1]} يجب ألا تتجاوز 100%.`],
  [/^(.+) must be at least ([\d.]+)$/, (m) => `${tr(m[1]!)} يجب ألا تقل عن ${m[2]}`],
  [/^(.+) must be at most ([\d.]+)$/, (m) => `${tr(m[1]!)} يجب ألا تزيد عن ${m[2]}`],
  [/^(.+) must be a number$/, (m) => `${tr(m[1]!)} يجب أن تكون رقمًا`],
  [/^Must be (\d+) characters or fewer$/, (m) => `يجب ألا يزيد عن ${m[1]} حرفًا`],
  [/^Your coach hasn't enabled (.+) for your account\.$/, () => "الكابتن لم يفعّل هذه الخاصية لحسابك."],
  [/^Your coach manages your personal info\.$/, () => "الكابتن هو من يدير بياناتك الشخصية."],
  [/^Your coach manages your password\.$/, () => "الكابتن هو من يدير كلمة مرورك."],
];

const FIELD_AR: Record<string, string> = {
  Height: "الطول",
  "Starting weight": "وزن البداية",
  "Goal weight": "الوزن المستهدف",
  Value: "القيمة",
};
const tr = (s: string) => FIELD_AR[s] ?? s;

export function translateServerMessage(message: string, locale: Locale): string {
  if (locale !== "ar" || !message) return message;
  if (AR[message]) return AR[message]!;
  for (const [re, fn] of AR_PATTERNS) {
    const m = message.match(re);
    if (m) return fn(m);
  }
  return message;
}

export function translateFieldErrors(errors: Record<string, string[]> | undefined, locale: Locale) {
  if (!errors || locale !== "ar") return errors;
  return Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v.map((m) => translateServerMessage(m, locale))]));
}
