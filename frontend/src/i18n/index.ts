import { alterations } from './alterations';
import { advertisements } from './advertisements';
import { publicSite } from './publicSite';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en/translation.json';
import fa from './locales/fa-AF/translation.json';
import ps from './locales/ps-AF/translation.json';
import { common } from './common';
import { business } from './business';
import { errors } from './errors';
import { expenses } from './expenses';
import { auth, permissionLabels } from './auth';
import { permissions } from '@myt/shared';
import { premium } from './premium';
import { printing } from './printing';
import { clothing } from './clothing';
import { enterprise } from './enterprise';
const triples = {
  ...enterprise,
  'currency.AFN': [
    'AFN — Afghan Afghani (؋)',
    'AFN — افغانی (؋)',
    'AFN — افغانۍ (؋)',
  ],
  'currency.USD': [
    'USD — US Dollar ($)',
    'USD — دالر امریکایی ($)',
    'USD — امریکايي ډالر ($)',
  ],
  'error.currency_mismatch': [
    'Package and payment currency must match the transaction.',
    'واحد پول بسته و پرداخت باید با معامله یکسان باشد.',
    'د بستې او ورکړې اسعار باید له معاملې سره یو شان وي.',
  ],
  'workflow.receipt': ['Print receipt', 'چاپ رسید', 'رسید چاپول'],
  'field.discount': ['Discount', 'تخفیف', 'تخفیف'],
  'field.charges': ['Additional charges', 'مصارف اضافی', 'اضافي لګښتونه'],
  'workflow.messaging': [
    'In-app reminders only. Automatic customer messaging is not configured; no customer messages have been sent.',
    'یادآوری داخل سیستم است. ارسال خودکار پیام به مشتری تنظیم نشده و پیامی ارسال نشده است.',
    'یوازې د سیستم خبرتیاوې. د پېرېدونکو اتومات پیغامونه نه دي تنظیم شوي او نه دي لېږل شوي.',
  ],
  'branch.dollar': ['Dollar Department', 'بخش دالر', 'د ډالرو څانګه'],
  'workflow.next': [
    'Continue to transaction',
    'ادامه به معامله',
    'معاملې ته دوام',
  ],
  'workflow.management': ['Management', 'مدیریت', 'مدیریت'],
  'field.branchName': ['Branch name', 'نام شعبه', 'د څانګې نوم'],
  'field.reference': ['Reference number', 'شماره مرجع', 'د حوالې شمېره'],
  'error.currency_locked': [
    'Branch currency cannot be changed.',
    'واحد پول شعبه قابل تغییر نیست.',
    'د څانګې اسعار نه شي بدلېدای.',
  ],
  'error.total_below_paid': [
    'Total must be positive and cannot be below payments received.',
    'مجموع باید مثبت و کمتر از پرداخت دریافتی نباشد.',
    'ټول باید مثبت وي او له ورکړې کم نه وي.',
  ],
  ...clothing,
  ...permissionLabels(permissions),
  ...expenses,
  ...common,
  ...business,
  ...auth,
  ...premium,
  ...printing,
  ...alterations,
  ...advertisements,
  ...publicSite,
  ...Object.fromEntries(
    Object.entries(errors).map(([key, value]) => [`error.${key}`, value]),
  ),
};
const localized = (index: number) =>
  Object.fromEntries(
    Object.entries(triples).map(([key, value]) => [key, value[index]]),
  );
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: { ...en, ...localized(0) } },
    'fa-AF': { translation: { ...fa, ...localized(1) } },
    'ps-AF': { translation: { ...ps, ...localized(2) } },
  },
  lng: localStorage.getItem('myt-language') || 'fa-AF',
  keySeparator: false,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
export default i18n;
