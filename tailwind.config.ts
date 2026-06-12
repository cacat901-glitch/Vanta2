import type { Config } from 'tailwindcss'
import animate from 'tailwindcss-animate'

export default {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      colors: {
        // StudyOS Design System
        'app-bg': '#0F0F13',
        'surface': '#17171F',
        'surface-elevated': '#1F1F2E',
        'sidebar-bg': '#13131A',
        'border-default': '#2A2A3D',
        'border-subtle': '#1E1E2C',
        'accent-primary': '#7C6FFF',
        'accent-hover': '#9183FF',
        'accent-secondary': '#3ECFB2',
        'accent-tertiary': '#FF9040',
        'text-primary': '#EEEDF8',
        'text-secondary': '#8A8AA8',
        'text-muted': '#55556A',
        'text-disabled': '#3A3A52',
        'success': '#3ECFB2',
        'warning': '#FFBB38',
        'danger': '#FF5263',
        'info': '#4DA6FF',

        // shadcn/ui compatible tokens (maps to our design system)
        border: '#2A2A3D',
        input: '#2A2A3D',
        ring: '#7C6FFF',
        background: '#0F0F13',
        foreground: '#EEEDF8',
        primary: {
          DEFAULT: '#7C6FFF',
          foreground: '#EEEDF8',
        },
        secondary: {
          DEFAULT: '#17171F',
          foreground: '#8A8AA8',
        },
        destructive: {
          DEFAULT: '#FF5263',
          foreground: '#EEEDF8',
        },
        muted: {
          DEFAULT: '#17171F',
          foreground: '#8A8AA8',
        },
        accent: {
          DEFAULT: '#1F1F2E',
          foreground: '#EEEDF8',
        },
        popover: {
          DEFAULT: '#1F1F2E',
          foreground: '#EEEDF8',
        },
        card: {
          DEFAULT: '#17171F',
          foreground: '#EEEDF8',
        },

        // Course colors (10 presets)
        course: {
          purple: '#7C6FFF',
          teal: '#3ECFB2',
          amber: '#FFBB38',
          red: '#FF5263',
          blue: '#4DA6FF',
          green: '#4CAF50',
          pink: '#E91E8C',
          orange: '#FF9040',
          cyan: '#00BCD4',
          lime: '#8BC34A',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px' }],
        xs: ['12px', { lineHeight: '16px' }],
        sm: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
        editor: ['15px', { lineHeight: '1.75' }],
        md: ['15px', { lineHeight: '22px' }],
        lg: ['18px', { lineHeight: '26px' }],
        xl: ['22px', { lineHeight: '30px' }],
        '2xl': ['28px', { lineHeight: '36px' }],
        '3xl': ['36px', { lineHeight: '44px' }],
        '4xl': ['48px', { lineHeight: '56px' }],
      },
      spacing: {
        sidebar: '240px',
        'sidebar-collapsed': '48px',
        'ai-panel': '320px',
        topbar: '48px',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'slide-in-from-right': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'slide-out-to-right': {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(100%)', opacity: '0' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'ai-pulse': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(124, 111, 255, 0)' },
          '50%': { boxShadow: '0 0 0 4px rgba(124, 111, 255, 0.3)' },
        },
        'ai-glow': {
          '0%, 100%': { borderColor: 'rgba(124, 111, 255, 0.3)' },
          '50%': { borderColor: 'rgba(124, 111, 255, 0.8)' },
        },
        'streak-flame': {
          '0%, 100%': { transform: 'scaleY(1)' },
          '50%': { transform: 'scaleY(1.1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'slide-in-right': 'slide-in-from-right 0.2s ease-out',
        'slide-out-right': 'slide-out-to-right 0.2s ease-in',
        'fade-in': 'fade-in 0.15s ease-out',
        'ai-pulse': 'ai-pulse 2s ease-in-out infinite',
        'ai-glow': 'ai-glow 2s ease-in-out infinite',
        'streak-flame': 'streak-flame 1.5s ease-in-out infinite',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [animate],
} satisfies Config
