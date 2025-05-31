/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",         // App Router 기준
    "./components/**/*.{js,ts,jsx,tsx}",  // 컴포넌트 폴더
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
