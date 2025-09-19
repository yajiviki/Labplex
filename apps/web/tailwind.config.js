/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
	theme: {
		extend: {
			colors: { brand: { DEFAULT: "#1c6ee8", 600: "#175ac0" } },
		},
	},
	plugins: [],
};
