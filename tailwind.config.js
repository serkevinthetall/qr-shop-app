/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind web requires `class` so app theme can set color scheme
  // (media mode throws: "Cannot manually set color scheme…").
  darkMode: 'class',
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './contexts/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
