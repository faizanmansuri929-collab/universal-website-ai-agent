/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        yui: {
          indigo: '#1E1B4B',
          'indigo-2': '#2B2770',
          red: '#E11D48',
          'red-soft': '#FFE4EA',
          ink: '#1F2340',
          muted: '#6B7085',
          line: '#E7E8F0',
          bg: '#F6F6FB',
        },
        uai: {
          brand: 'var(--uai-brand, #1E1B4B)',
          accent: 'var(--uai-accent, #E11D48)',
          bg: 'var(--uai-bg, #F6F6FB)',
          surface: 'var(--uai-surface, #FFFFFF)',
          'surface-muted': 'var(--uai-surface-muted, #FAFAFD)',
          border: 'var(--uai-border, #E7E8F0)',
          'border-strong': 'var(--uai-border-strong, #D5D7E3)',
          text: 'var(--uai-text, #1F2340)',
          'text-2': 'var(--uai-text-2, #4B516A)',
          'text-muted': 'var(--uai-text-muted, #6B7085)',
          'text-subtle': 'var(--uai-text-subtle, #9FA1CC)',
          online: 'var(--uai-online, #059669)',
          whatsapp: 'var(--uai-whatsapp, #25D366)',
          success: 'var(--uai-success, #059669)',
        },
        brand: {
          50: '#FFF1F2',
          100: '#FFE4E6',
          500: '#F43F5E',
          600: '#E11D48',
          700: '#BE123C',
        }
      }
    },
  },
  plugins: [],
}
