import React from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { MdCheck } from 'react-icons/md';
import { useAuth } from '../auth/AuthContext';

const SUPPORT_EMAIL = 'support@aycindustries.com';
const accent = '#ca8a04';

function FeatureBlock({ title, lines }) {
  return (
    <Box sx={{ mb: 1.25 }}>
      <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', letterSpacing: 0.08 }}>
        {title}
      </Typography>
      <Stack spacing={0.75} sx={{ mt: 0.75 }}>
        {lines.map((line) => (
          <Stack key={line} direction="row" spacing={1} alignItems="flex-start">
            <MdCheck size={18} style={{ flexShrink: 0, marginTop: 2, color: '#60a5fa' }} aria-hidden />
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.55 }}>
              {line}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}

export function PricingMarketingContent() {
  const { isAuthenticated, outlookPremium } = useAuth();
  const premiumCtaTo = isAuthenticated ? '/upgrade-premium' : '/login';
  const premiumCtaLabel = isAuthenticated ? 'How to activate premium' : 'Sign in to upgrade';
  const showBasicPlan = !isAuthenticated;

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 900, textAlign: 'center', mb: 0.75, color: 'text.primary' }}>
        Plans at a glance
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 560, mx: 'auto', mb: 2.5, lineHeight: 1.55 }}>
        {showBasicPlan ? (
          <>
            Basic is included with your account. Premium unlocks the full desk. Pay yearly outside the app; your admin
            confirms payment and access usually updates within about 24 hours.
          </>
        ) : (
          <>
            Premium unlocks the full desk. Pay yearly outside the app; your admin confirms payment and access usually
            updates within about 24 hours.
          </>
        )}
      </Typography>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            md: showBasicPlan ? 'repeat(2, 1fr)' : 'minmax(0, 520px)',
          },
          gap: 2.5,
          alignItems: 'stretch',
          justifyContent: showBasicPlan ? 'stretch' : 'center',
        }}
      >
        {showBasicPlan ? (
          <Box>
            <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'rgba(15,23,42,0.35)' }}>
              <CardContent sx={{ p: 2, display: 'flex', flexDirection: 'column', height: '100%' }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Basic
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 900, my: 0.5 }}>
                  Included
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  After sign-up; header shows <strong>Basic</strong>.
                </Typography>
                <Button component={RouterLink} to="/signup" variant="contained" fullWidth sx={{ textTransform: 'none', fontWeight: 800 }}>
                  Sign up
                </Button>
              </CardContent>
            </Card>
          </Box>
        ) : null}

        <Box sx={{ maxWidth: showBasicPlan ? 'none' : 520, width: '100%', mx: showBasicPlan ? 0 : 'auto' }}>
          <Card
            elevation={0}
            sx={{
              height: '100%',
              border: `2px solid ${accent}`,
              borderRadius: 2,
              boxShadow: '0 12px 32px rgba(15,23,42,0.08)',
              position: 'relative',
            }}
          >
            <Stack direction="row" spacing={1} sx={{ position: 'absolute', top: 12, right: 12, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <Chip size="small" label="Most popular" sx={{ fontWeight: 800, bgcolor: accent, color: '#1c1917' }} />
            </Stack>
            <CardContent sx={{ p: 2, pt: 3.5, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'rgba(15,23,42,0.25)' }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                Premium (annual)
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 900, my: 0.5 }}>
                Annual
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Yearly via your org; no card in this app.
                {outlookPremium ? ' You already have premium.' : ''}
              </Typography>
              <Button component={RouterLink} to={premiumCtaTo} variant="contained" fullWidth sx={{ textTransform: 'none', fontWeight: 800, mb: 2 }}>
                {premiumCtaLabel}
              </Button>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                Everything in Basic, plus:
              </Typography>
              <FeatureBlock
                title="Markets & research"
                lines={['Full Overview depth (plan-based).', 'Long / Short Term, Screens, Advisor.']}
              />
              <FeatureBlock
                title="Desk & derivatives"
                lines={['Portfolio + Alerts; F&O, Commodities, Forex.', 'Telegram / integrations when enabled.']}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 'auto', pt: 1, display: 'block', lineHeight: 1.45 }}>
                Your admin confirms payment; Premium then shows on your account.
              </Typography>
            </CardContent>
          </Card>
        </Box>
      </Box>

      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
          Billing or access questions?
        </Typography>
        <Link href={`mailto:${SUPPORT_EMAIL}`} underline="hover" fontWeight={700}>
          {SUPPORT_EMAIL}
        </Link>
        <Typography variant="body2" sx={{ mt: 2 }}>
          <Link
            component={RouterLink}
            to={isAuthenticated ? '/profile?tab=features' : '/features'}
            underline="hover"
            fontWeight={700}
          >
            Browse product features
          </Link>
          {' · '}
          <Link component={RouterLink} to="/privacy-policy" underline="hover" fontWeight={700}>
            Privacy
          </Link>
          {' · '}
          <Link component={RouterLink} to="/terms-of-use" underline="hover" fontWeight={700}>
            Terms
          </Link>
          {' · '}
          <Link component={RouterLink} to="/cancellation-policy" underline="hover" fontWeight={700}>
            Cancellation
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}

function PricingPage() {
  return <PricingMarketingContent />;
}

export default PricingPage;
