import type { Language } from '../hooks/useLanguage';
import { pickLanguage } from '../i18n/utils';

export const getDashboardNavLinks = (language: Language) => ([
  { to: '/inventory', label: pickLanguage(language, { en: 'Airport Inventory', ro: 'Inventar Aeroportuar' }) },
  { to: '/network', label: pickLanguage(language, { en: 'Global Network', ro: 'Rețea Globală' }) },
  { to: '/events', label: pickLanguage(language, { en: 'Events & Penalties', ro: 'Evenimente și Penalități' }) },
  { to: '/algorithm', label: pickLanguage(language, { en: 'Optimizer Algorithm', ro: 'Algoritmul Optimizerului' }) },
  { to: '/about', label: pickLanguage(language, { en: 'About Us', ro: 'Despre Noi' }) },
  { to: '/contact', label: pickLanguage(language, { en: 'Contact Us', ro: 'Contactează-ne' }) }
]);

export type DashboardNavLink = ReturnType<typeof getDashboardNavLinks>[number];

export default getDashboardNavLinks;
