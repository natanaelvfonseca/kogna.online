import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./pages/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101417',
        paper: '#F7F4ED',
        graphite: '#2F3437',
        ember: '#D84A31',
        moss: '#1F8A5B',
        citron: '#D9F35F',
      },
      boxShadow: {
        panel: '0 24px 80px rgba(16, 20, 23, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
