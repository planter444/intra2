export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  safelist: ['md:pl-72'],
  theme: {
    extend: {
      colors: {
        brand: 'var(--brand-primary)',
        'brand-secondary': 'var(--brand-secondary)',
        'brand-accent': 'var(--brand-accent)',
        'surface-card': 'var(--surface-card)',
        'surface-page': 'var(--surface-page)',
        'text-primary': 'var(--text-primary)'
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))'
      },
      boxShadow: {
        soft: '0 10px 30px rgba(15, 23, 42, 0.08)'
      }
    }
  },
  plugins: []
};
