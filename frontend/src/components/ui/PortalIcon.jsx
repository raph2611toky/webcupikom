/** Consistent outline icons for the portal navigation. */
const paths = {
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  requests: 'M6 3h8l4 4v14H6ZM14 3v5h4M9 12h6M9 16h6',
  reports: 'M12 3 2 21h20ZM12 9v5M12 17v1',
  services: 'M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z',
  transport: 'M5 17h14V5a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2ZM5 10h14M8 14h1M15 14h1M7 17v4M17 17v4',
  appointments: 'M4 5h16v16H4ZM8 3v4M16 3v4M4 10h16M8 14h2M14 14h2M8 17h2',
  messages: 'M3 5h18v14H3ZM3 5l9 7 9-7',
  notifications: 'M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4M12 2v2',
  news: 'M4 3h16v18H4ZM8 7h8M8 11h8M8 15h3M14 15h2M8 18h3M14 18h2',
  projects: 'm12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3Z',
  partners: 'M7 11a4 4 0 1 1 3.4-6.1M17 11a4 4 0 1 0-3.4-6.1M3 21v-1a5 5 0 0 1 5-5h2M21 21v-1a5 5 0 0 0-5-5h-2M9 21v-1a3 3 0 0 1 6 0v1',
  profile: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M10 15v6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  usage: 'M4 20V10M10 20V4M16 20v-7M22 20V7M2 20h22',
  audit: 'M4 4h16v16H4ZM8 8h8M8 12h5M8 16h3M16 15l1.5 1.5L20 14',
  security: 'M12 3 4 6v5c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V6ZM9 12l2 2 4-4',
};
export default function PortalIcon({name}) {
  return <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name] || paths.home}/></svg>;
}
