export const errors: Record<string, readonly [string, string, string]> = {
  expenses_online: [
    'Connect to the internet to record expenses.',
    'برای ثبت مصارفات به اینترنت وصل شوید.',
    'د لګښتونو د ثبتولو لپاره انټرنېټ سره وصل شئ.',
  ],
  rate_limited: [
    'Too many requests. Wait a minute and try again.',
    'درخواست‌ها زیاد است. یک دقیقه صبر کنید و دوباره کوشش کنید.',
    'غوښتنې ډېرې دي. یوه دقیقه انتظار وکړئ او بیا هڅه وکړئ.',
  ],
  invalid_amount: [
    'Enter a valid positive amount with at most two decimals.',
    'مبلغ معتبر با حداکثر دو رقم اعشار وارد کنید.',
    'سمه اندازه تر دوو اعشاري ځایونو پورې ولیکئ.',
  ],
  validation_failed: [
    'Check the required fields and their formats.',
    'خانه‌های ضروری و قالب معلومات را بررسی کنید.',
    'اړینې خانې او د معلوماتو بڼه وګورئ.',
  ],
  overpayment: [
    'Payment exceeds the remaining balance.',
    'مبلغ پرداخت بیشتر از باقی‌مانده است.',
    'ورکړه له پاتې بیلانس څخه زیاته ده.',
  ],
  version_conflict: [
    'Another device changed this record. Review the current server record before retrying.',
    'این مورد توسط دستگاه دیگر تغییر کرده است. قبل از ثبت مجدد معلومات سرور را بررسی کنید.',
    'بلې وسیلې دا ریکارډ بدل کړی. تر بیا هڅې مخکې د سرور معلومات وګورئ.',
  ],
  idempotency_mismatch: [
    'This operation ID was already used for a different request.',
    'شماره عملیات قبلاً برای درخواست دیگری استفاده شده است.',
    'د کړنې دا شمېره د بلې غوښتنې لپاره کارول شوې ده.',
  ],
  duplicate_record: [
    'A matching record already exists in this branch.',
    'مورد مشابه در این شعبه موجود است.',
    'ورته ریکارډ په دې څانګه کې شته.',
  ],
  identity_required: [
    'An authorized identity provider is required.',
    'اتصال هویت مجاز ضروری است.',
    'مجازې پېژندنې ته اړتیا ده.',
  ],
  identity_disabled: [
    'This identity is unavailable or disabled.',
    'این هویت موجود نیست یا غیرفعال است.',
    'دا پېژندنه نشته یا غیرفعاله ده.',
  ],
  forbidden: [
    'You do not have permission for this action.',
    'شما صلاحیت این عمل را ندارید.',
    'د دې کړنې واک نه لرئ.',
  ],
  branch_denied: [
    'Access to this branch is not authorized.',
    'دسترسی به این شعبه مجاز نیست.',
    'دې څانګې ته لاسرسی مجاز نه دی.',
  ],
  not_found: [
    'The record was not found in your permitted branch.',
    'مورد در شعبه مجاز شما یافت نشد.',
    'ریکارډ ستاسې په مجازه څانګه کې ونه موندل شو.',
  ],
  not_cached: [
    'This information is not available on this device. Connect to load it first.',
    'این معلومات در دستگاه موجود نیست. نخست متصل شوید.',
    'دا معلومات په وسیله کې نشته. لومړی ونښلئ.',
  ],
  offline_payment_denied: [
    'Branch policy does not permit this provisional offline payment.',
    'پالیسی شعبه این پرداخت موقتی آفلاین را اجازه نمی‌دهد.',
    'د څانګې تګلاره دا موقتي نالیکې ورکړه نه مني.',
  ],
  offline_action_denied: [
    'This action requires an online connection and authorization.',
    'این عمل به اتصال و صلاحیت آنلاین نیاز دارد.',
    'دا کړنه انلاین اړیکې او واک ته اړتیا لري.',
  ],
  offline_lease_expired: [
    'Reconnect to renew authorized device access.',
    'برای تمدید دسترسی مجاز دستگاه دوباره متصل شوید.',
    'د وسیلې د مجاز لاسرسي د نوي کولو لپاره بیا ونښلئ.',
  ],
  sync_disabled: [
    'Offline synchronization is disabled in this environment.',
    'همگام‌سازی آفلاین در این محیط غیرفعال است.',
    'په دې چاپېریال کې نالیکې همغږي غیرفعاله ده.',
  ],
  backdate_denied: [
    'You are not authorized to change the historical date.',
    'شما صلاحیت تغییر تاریخ گذشته را ندارید.',
    'د پخوانۍ نېټې د بدلولو واک نه لرئ.',
  ],
  invalid_status_transition: [
    'This delivery status change is not permitted.',
    'این تغییر وضعیت تسلیمی مجاز نیست.',
    'د سپارلو د حالت دا بدلون مجاز نه دی.',
  ],
  reverse_payments_before_cancellation: [
    'Reverse recorded payments before cancelling this transaction.',
    'قبل از لغو معامله پرداخت‌ها را با صلاحیت برگشت دهید.',
    'د معاملې تر لغوه کولو مخکې ثبت شوې ورکړې بېرته وګرځوئ.',
  ],
  payment_already_reversed: [
    'This payment has already been reversed.',
    'این پرداخت قبلاً برگشت شده است.',
    'دا ورکړه لا بېرته ګرځول شوې ده.',
  ],
  invalid_payment: [
    'Check the amount and configured payment method.',
    'مبلغ و روش پرداخت تنظیم‌شده را بررسی کنید.',
    'اندازه او د ورکړې ټاکل شوې لاره وګورئ.',
  ],
  guarantee_details_denied: [
    'Sensitive guarantee details require additional permission.',
    'جزئیات حساس ضمانت به صلاحیت اضافی نیاز دارد.',
    'د ضمانت حساس جزئیات اضافي واک ته اړتیا لري.',
  ],
  guarantee_details_required: [
    'Enter a short description for a manual guarantee.',
    'برای ضمانت دستی شرح کوتاه وارد کنید.',
    'د لاسي ضمانت لپاره لنډه تشریح ولیکئ.',
  ],
  request_failed: [
    'The request failed. Try again.',
    'درخواست ناموفق بود. دوباره تلاش کنید.',
    'غوښتنه ناکامه شوه. بیا هڅه وکړئ.',
  ],
  review_required: [
    'A supervisor must review this conflict before resubmission.',
    'مسئول باید قبل از ثبت مجدد این تعارض را بررسی کند.',
    'مسؤول باید تر بیا ثبت مخکې دا شخړه وګوري.',
  ],
};
