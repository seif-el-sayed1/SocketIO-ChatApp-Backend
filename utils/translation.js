const translate = (str, lang = "en") => {
  if (lang?.toLowerCase() === "ar") return ar[str] || str;
  return str;
};

const ar = {
  //user
  "User not found!": "المستخدم غير موجود",
  "User not found": "المستخدم غير موجود",
  "Incorrect Email or password": "الايميل او كلمة المرور غير صحيحة",
  "Verification OTP is required" : "رمز التحقق مطلوب",
  "Invalid request": "طلب غير صالح",
  "Verification OTP is expired": "رمز التحقق منتهي الصلاحية",
  "Invalid Verification OTP": "رمز التحقق غير صحيح",
  "Incorrect password": "كلمة المرور غير صحيحة",
  "OTP isn't found!": "رمز التحقق غير موجود",
  "Your account is not verified yet" : "لم يتم التحقق من حسابك",
  "Reset OTP is expired": "نتهت صلاحية رمز إعادة تعيين كلمة المرور",
  "Invalid reset code": "رمز إعادة التعيين غير صالح",
  "User is already deactivated" : "المستخدم معطل بالفعل",
  "Your account is blocked, please contact the support team" : "حسابك محظور, يرجى الاتصال بفريق الدعم",
  // user validator
  "First Name is required" : "اسم المستخدم مطلوب",
  "last Name is required" : "اسم العائلة مطلوب",
  "Email is required" : "الايميل مطلوب",
  "Password is required" : "كلمة المرور مطلوبة",
  "Phone is required" : "رقم الهاتف مطلوب",
  "Age is required" : "العمر مطلوب",
  "Password must be at least 6 characters" : "كلمة المرور يجب ان تكون على الاقل 6 حروف",
  "Confirm Password is required" : "تاكيد كلمة المرور مطلوب",
  "Passwords do not match" : "كلمات المرور غير متطابقة",
  "Phone number must start with '0' and contain exactly 11 digits" : "رقم الجوال يجب ان يبدا ب '0' ويحتوي على 11 رقم",
  "Duplicated Phone Number" : "رقم الهاتف مكرر",
  "This Phone Number Has Been Verified Before" : "تم التحقق من هذا الرقم من قبل",
  "Duplicated Email" : "البريد الالكتروني مكرر",
  "This Email Has Been Verified Before" : "تم التحقق من هذا البريد من قبل",
  "You Can't Block Yourself" : "لا يمكنك حظر نفسك",
  "Gender is required" : "النوع مطلوب",
  "DateOfBirth is required" : "تاريخ الميلاد مطلوب",
  // global validator
  "Password must be at least 8 characters long" : "كلمة المرور يجب ان تكون على الاقل 8 حروف",
  "Confirm password must match password" : "تاكيد كلمة المرور يجب ان تكون متطابقة مع كلمة المرور",
  "Confirm password is required" : "تاكيد كلمة المرور مطلوب",
  "Email must be provided" : "الايميل مطلوب",
  "Reset code is not verified" : "لم يتم التحقق من رمز التعيين",
  "Invalid language" : "لغة غير صالحة",
  "Language is required" : "اللغة مطلوبة",
  "Invalid phone Number" : "رقم الهاتف غير صالح",
  "Invalid Email Address" : "عنوان البريد الالكتروني غير صالح",
  "Invalid phone number format" : "تنسيق رقم الهاتف غير صالح",
  "Current password is required" : "كلمة المرور الحالية مطلوبة",
  "Language is required" : "اللغة مطلوبة",
  "Invalid Language" : "لغة غير صالحة",
  //auth middleware
  "Session expired, please login again..." : "انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى...",
  "account is deactivated" : "تم إلغاء تنشيط هذا الحساب",
  "Password recently changed, please login again..." : "تم تغيير كلمة المرور مؤخرا، يرجى تسجيل الدخول مرة أخرى...",
  "not found" : "غير موجود",
  "Invalid token, please login again..." : "رمز غير صالح، يرجى تسجيل الدخول مرة أخرى...",
  "Invalid token role, please login again..." : "صلاحية رمز غير صالحة، يرجى تسجيل الدخول مرة أخرى...",
  "Token has expired, please login again..." : "انتهت صلاحية الرمز، يرجى تسجيل الدخول مرة أخرى...",
  "Not allowed to access this route" : "غير مسموح بالوصول إلى هذا المسار",
  // multer
  "Not an image, please upload only Image" : "ليس صورة، يرجى تحميل صورة فقط",
  "Not a PDF, please upload only PDFs" : "ليس PDF، يرجى تحميل PDFات فقط",
  "Not a video, please upload only Video" : "ليس فيديو، يرجى تحميل فيديوات فقط",
  // firebase
  "Invalid File Format or Not a Valid PDF" : "تنسيق الملف غير صالح او ليس PDF صالح",
  "Media file is required" : "الملف الوسائط مطلوب",
  // send email
  "Unable to send an email, please try again later." : "لا يمكن ارسال بريد، يرجى المحاولة مرة أخرى لاحقا.", 
  // errors middlewares
  "Something went wrong": "حدث خطأ ما",  
  "Invalid token, Please login again ...": "الرمز غير صحيح، يرجى تسجيل الدخول مرة أخرى",
  "Expired token, Please login again ...": "الرمز منتهي الصلاحية، يرجى تسجيل الدخول مرة أخرى",
  "Invalid": "غير صحيح",
  "Invalid Input Data": "بيانات غير صحيحة",
  "is already used": "مستخدم بالفعل",
  "Arabic": "العربي",
  "English": "الإنجليزي",  
  "email": "البريد الإلكتروني",
  "phone": "رقم الهاتف",
  "username": "اسم المستخدم",
  "password": "كلمة المرور",
  "name": "الاسم",
  "fullName": "الاسم الكامل",
  "address": "العنوان",
  "age": "العمر",
  "gender": "النوع",
  // chat
  "Chat not found" : "الدردشة غير موجودة",
  "Please provide either chat id or receiver id" : "يرجى تقديم معرف الدردشة او معرف المستقبل",
  "You are not a participant in this chat" : "انت لسه مشارك في هذه الدردشة",
  // message notification
  "New message from" : "رسالة جديدة من",
};

function translateNumbers(input, lang = "en") {
  console.log("🚀 ~ translateNumbers ~ lang:", lang);
  lang = lang.toLowerCase();
  let localizedNumber;
  if (lang === "ar") localizedNumber = latinToArabicNumbers(input, lang);
  else localizedNumber = arabicToLatinNumbers(input, lang);
  console.log("🚀 ~ translateNumbers ~ localizedNumber:", localizedNumber);
  return localizedNumber;
}

function latinToArabicNumbers(input) {
  const latinNumbers = "0123456789"; // Latin digits (0-9)
  const arabicNumbers = "٠١٢٣٤٥٦٧٨٩"; // Corresponding Arabic digits
  return input.replace(/[0-9]/g, (digit) => arabicNumbers[latinNumbers.indexOf(digit)]);
}

function arabicToLatinNumbers(input) {
  const arabicNumbers = "٠١٢٣٤٥٦٧٨٩"; // Arabic digits (0-9)
  const latinNumbers = "0123456789"; // Corresponding Latin digits
  return input.replace(/[٠-٩]/g, (digit) => latinNumbers[arabicNumbers.indexOf(digit)]);
}

module.exports = { translate, translateNumbers };