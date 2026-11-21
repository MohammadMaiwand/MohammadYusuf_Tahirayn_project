export const clothing = {
  'clothing.available': [
    'Available at last check',
    'موجود در آخرین بررسی',
    'په وروستۍ کتنه کې شته',
  ],
  'clothing.unavailable': [
    'Reserved / unavailable',
    'رزرو شده / ناموجود',
    'نیول شوې / نشته',
  ],
  'clothing.returnDue': [
    'Expected return date (optional)',
    'تاریخ برگشت مورد انتظار (اختیاری)',
    'د بېرته ستنېدو نېټه (اختیاري)',
  ],
  'error.reservation_conflict': [
    'This clothing is reserved for the selected period. Choose another item or date.',
    'این لباس در زمان انتخاب‌شده رزرو است. لباس یا تاریخ دیگری انتخاب کنید.',
    'دا جامې په ټاکلي وخت کې نیول شوې دي. بله نېټه یا جامې وټاکئ.',
  ],
  'error.invalid_return_date': [
    'Return must be after the rental date.',
    'تاریخ برگشت باید بعد از تاریخ کرایه باشد.',
    'د ستنېدو نېټه باید د کرایې له نېټې وروسته وي.',
  ],
  'clothing.id': ['Clothing ID', 'شناسه لباس', 'د جامو پېژند'],
  'clothing.photo': ['Clothing photo', 'عکس لباس', 'د جامو انځور'],
  'clothing.noPhoto': ['No photo', 'بدون عکس', 'انځور نشته'],
  'clothing.remove': ['Remove photo', 'حذف عکس', 'انځور لرې کړئ'],
  'clothing.showInvoice': [
    'Show clothing photo on invoice',
    'نمایش عکس لباس در بل',
    'په بل کې د جامو انځور ښودل',
  ],
  'clothing.pending': [
    'Availability is confirmed by the server when saved.',
    'موجودیت هنگام ثبت توسط سرور تأیید می‌شود.',
    'شتون د ثبت پر وخت د سرور له خوا تاییدېږي.',
  ],
  'error.clothing_id_required': [
    'Enter a clothing ID.',
    'شناسه لباس را وارد کنید.',
    'د جامو پېژند ولیکئ.',
  ],
  'error.invalid_photo': [
    'Choose a valid JPEG, PNG or WebP image.',
    'یک عکس معتبر JPEG، PNG یا WebP انتخاب کنید.',
    'سم JPEG، PNG یا WebP انځور وټاکئ.',
  ],
  'error.photo_too_large': [
    'Maximum photo size is 5 MB.',
    'حداکثر اندازه عکس ۵ مگابایت است.',
    'د انځور اعظمي کچه ۵ مېګابایټ ده.',
  ],
} as const;
