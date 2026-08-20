import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#F0F3F9',
          100: '#D9E2F1',
          500: '#2C4375',
          800: '#15213B',
          900: '#1B2A4A', // Primary Navy from requirements
        },
        gold: {
          100: '#FDF8E7',
          300: '#EAD38A',
          500: '#C9A84C', // Warm Gold accent from requirements
          600: '#B08E35',
          700: '#8A6D23',
        },
        background: '#F8F9FA',
      },
    },
  },
  plugins: [],
};
export default config;
