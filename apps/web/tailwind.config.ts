import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        opfy: {
          violet: '#6D28D9',
          violetDark: '#4C1D95',
          ink: '#0F0B1F',
        },
      },
    },
  },
  plugins: [],
};

export default config;
