export type Language = 'es' | 'en';
export type Page = 'classes' | 'profile';

export const routes = {
  es: { classes: '/', profile: '/perfil-profesional/' },
  en: { classes: '/en/', profile: '/en/professional-profile/' },
} satisfies Record<Language, Record<Page, string>>;

const confirmedPhone = '+527226278711';
const override = import.meta.env.PUBLIC_PHONE;
const phone = override === undefined || override === '' ? confirmedPhone : override;
export const publicPhone = /^\+[1-9]\d{6,14}$/.test(phone) ? phone : undefined;
export const portfolio = {
  cv: '/trabajos/CV_Daniela.Linares.pdf',
  portrait: '/images/miss-daly-hero.webp',
  portraitSmall: '/images/miss-daly-hero-640.webp',
};
