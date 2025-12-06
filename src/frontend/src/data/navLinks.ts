export const dashboardNavLinks = [
  { to: '/inventory', label: 'Airport Inventory' },
  { to: '/network', label: 'Global Network' },
  { to: '/events', label: 'Events & Penalties' },
  { to: '/about', label: 'About Us' },
  { to: '/contact', label: 'Contact Us' }
];

export type DashboardNavLink = typeof dashboardNavLinks[number];

export default dashboardNavLinks;
