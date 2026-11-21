import i18n from '../i18n';

// نام نمایندگی به زبان جاری سیستم؛ اگر برای نمایندگی ترجمه‌ای ثبت نشده باشد،
// نام تنظیم‌شدهٔ همان نمایندگی و در نهایت شناسهٔ آن نمایش داده می‌شود.
export function branchLabel(id: string, configuredName?: string | null) {
  const key = `branch.${id}`;
  return i18n.exists(key) ? i18n.t(key) : configuredName || id;
}
