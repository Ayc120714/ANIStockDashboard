import { createTheme } from '@mui/material/styles';

/**
 * Dark surface + blue accents to match the AYC login page for public marketing routes.
 */
export const marketingPublicTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#2563eb' },
    secondary: { main: '#ca8a04' },
    background: {
      default: 'transparent',
      paper: 'rgba(30, 41, 59, 0.72)',
    },
    divider: 'rgba(148, 163, 184, 0.22)',
    text: {
      primary: '#f1f5f9',
      secondary: '#cbd5e1',
    },
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        containedPrimary: {
          background: 'linear-gradient(100deg, #2563eb, #1d4ed8)',
          '&:hover': {
            background: 'linear-gradient(100deg, #1d4ed8, #1e40af)',
          },
        },
        outlined: {
          borderColor: 'rgba(96, 165, 250, 0.45)',
          color: '#e2e8f0',
          '&:hover': {
            borderColor: 'rgba(147, 197, 253, 0.65)',
            backgroundColor: 'rgba(30, 64, 175, 0.2)',
          },
        },
      },
    },
  },
});
