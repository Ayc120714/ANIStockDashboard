import React from 'react';
import { Box, Typography } from '@mui/material';

/**
 * Standard Indian-market style risk disclosure (informational; not legal advice).
 * @param {'login' | 'default'} variant — login uses higher-contrast footer styling.
 */
function MarketDisclaimer({ variant = 'default' }) {
  const isLogin = variant === 'login';
  return (
    <Box
      component="aside"
      aria-label="Regulatory disclaimer"
      sx={{
        borderRadius: isLogin ? 2 : 1,
        px: { xs: 2, md: 3 },
        py: isLogin ? 2 : 1.5,
        maxWidth: 1200,
        mx: 'auto',
        width: '100%',
        bgcolor: isLogin ? 'rgba(15, 23, 42, 0.92)' : 'action.hover',
        border: isLogin ? '1px solid rgba(96,165,250,0.35)' : '1px solid',
        borderColor: isLogin ? undefined : 'divider',
      }}
    >
      <Typography
        variant="caption"
        component="div"
        sx={{
          color: isLogin ? 'rgba(226, 232, 240, 0.95)' : 'text.secondary',
          lineHeight: 1.65,
          fontSize: isLogin ? '0.78rem' : '0.75rem',
        }}
      >
        <Box component="span" sx={{ fontWeight: 800, color: isLogin ? '#f8fafc' : 'text.primary' }}>
          Disclaimer —{' '}
        </Box>
        Investment in securities market are subject to market risks. Read all the related documents carefully before
        investing. The securities quoted (if any) are for illustration only and are not recommendatory. Registration
        granted by{' '}
        <Box component="span" sx={{ fontWeight: 800 }}>
          SEBI
        </Box>
        , membership of a{' '}
        <Box component="span" sx={{ fontWeight: 800 }}>
          SEBI
        </Box>{' '}
        recognized supervisory body (if any) and certification from NISM in no way guarantee performance of the
        intermediary or provide any assurance of returns to investors. For further disclosures, refer to your
        intermediary and applicable statutory documents.
      </Typography>
    </Box>
  );
}

export default MarketDisclaimer;
