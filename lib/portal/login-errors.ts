// Keep credential errors distinct from service/configuration failures.
export function loginErrorMessage(error: {code?: string;status?: number}, english: boolean) {
 if(error.code==='invalid_credentials')return english?'Invalid email or password':'البريد أو كلمة المرور غير صحيحة';
 if(error.status===429)return english?'Too many sign-in attempts. Please wait and try again.':'محاولات دخول كثيرة. انتظر قليلاً ثم أعد المحاولة.';
 if(error.code==='email_not_confirmed')return english?'Your account email needs confirmation. Contact Admin or CEO.':'البريد يحتاج تأكيداً. تواصل مع المسؤول أو الرئيس التنفيذي.';
 return english?'Unable to connect to the sign-in service. Please retry or contact Admin.':'تعذر الاتصال بخدمة الدخول أو التحقق من إعداداتها. أعد المحاولة أو تواصل مع المسؤول.';
}
