import React, { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

const accent = '#ca8a04';
const accentSoft = 'rgba(202, 138, 4, 0.12)';

function FeatureSplitSection({ eyebrow, title, intro, items }) {
  const [activeId, setActiveId] = useState(items[0]?.id);
  const active = items.find((i) => i.id === activeId) || items[0];

  return (
    <Box component="section" sx={{ mb: { xs: 3.5, md: 4.5 } }}>
      {eyebrow ? (
        <Typography
          variant="overline"
          sx={{ letterSpacing: 0.14, color: accent, fontWeight: 800, display: 'block', mb: 0.5 }}
        >
          {eyebrow}
        </Typography>
      ) : null}
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, color: 'text.primary' }}>
        {title}
      </Typography>
      {intro ? (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, maxWidth: 640 }}>
          {intro}
        </Typography>
      ) : null}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(220px, 280px) 1fr' },
          gap: { xs: 2, md: 3 },
          alignItems: 'stretch',
        }}
      >
        <Stack spacing={0.5} sx={{ order: { xs: 1, md: 0 } }}>
          {items.map((item) => {
            const on = item.id === active.id;
            return (
              <Box
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setActiveId(item.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setActiveId(item.id);
                  }
                }}
                sx={{
                  cursor: 'pointer',
                  borderRadius: 1.5,
                  px: 1.5,
                  py: 1.25,
                  borderLeft: on ? `4px solid ${accent}` : '4px solid transparent',
                  bgcolor: on ? accentSoft : 'transparent',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  '&:hover': { bgcolor: on ? accentSoft : 'action.hover' },
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1.35 }}>
                  {item.title}
                </Typography>
                {item.blurb ? (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, lineHeight: 1.45 }}>
                    {item.blurb}
                  </Typography>
                ) : null}
              </Box>
            );
          })}
        </Stack>

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.75, sm: 2.25 },
            borderRadius: 2,
            order: { xs: 0, md: 1 },
            minHeight: { md: 0 },
            bgcolor: 'rgba(15,23,42,0.55)',
            border: '1px solid rgba(96,165,250,0.22)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.75 }}>
            {active.title}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.55 }}>
            {active.detail}
          </Typography>
          {active.bullets?.length ? (
            <Box component="ul" sx={{ m: 0, pl: 2, mb: 1.5, color: 'text.secondary', '& li': { mb: 0.5 } }}>
              {active.bullets.map((b) => (
                <Typography key={b} component="li" variant="body2" sx={{ lineHeight: 1.5, fontSize: '0.875rem' }}>
                  {b}
                </Typography>
              ))}
            </Box>
          ) : null}
          {active.ctaTo ? (
            <Button
              component={RouterLink}
              to={active.ctaTo}
              variant="contained"
              size="small"
              sx={{ textTransform: 'none', fontWeight: 700 }}
            >
              {active.ctaLabel || 'Open in app'}
            </Button>
          ) : null}
        </Paper>
      </Box>
    </Box>
  );
}

const researchItems = [
  {
    id: 'overview',
    title: 'Overview & indices',
    blurb: 'Indices, flows, and market tables in one view.',
    detail: 'Scan breadth and leadership from the Overview workspace.',
    bullets: ['Sector / sub-sector depth expands with premium.', 'Basic keeps some columns on the latest period only.'],
    ctaTo: '/outlook',
    ctaLabel: 'Open Overview',
  },
  {
    id: 'horizons',
    title: 'Long & short horizon views',
    blurb: 'Structural vs tactical outlook pages.',
    detail: 'Long Term and Short Term unlock with premium; sidebar shows a lock until then.',
    bullets: ['Long Term: slower-moving themes.', 'Short Term: nearer-term reads.'],
    ctaTo: '/long-term',
    ctaLabel: 'Open Long Term',
  },
  {
    id: 'screens',
    title: 'Screens',
    blurb: 'Filter the universe to your criteria.',
    detail: 'Build and save screens where configured — premium in production.',
    bullets: ['Pairs with Overview for idea flow.'],
    ctaTo: '/screens',
    ctaLabel: 'Open Screens',
  },
  {
    id: 'advisor',
    title: 'Advisor',
    blurb: 'Curated angles on risk and opportunity.',
    detail: 'Commentary-style flows to support decisions — premium module.',
    bullets: ['Use with a theme or watchlist in mind.'],
    ctaTo: '/advisor',
    ctaLabel: 'Open Advisor',
  },
];

const portfolioItems = [
  {
    id: 'portfolio',
    title: 'Portfolio Manager',
    blurb: 'Positions and exposure in one hub.',
    detail: 'Broker-linked data where enabled; reconcile the book to your risk rules.',
    bullets: ['Connect brokers from Profile when available.', 'Premium.'],
    ctaTo: '/portfolio-manager',
    ctaLabel: 'Open Portfolio Manager',
  },
  {
    id: 'alerts',
    title: 'Alerts',
    blurb: 'Price and event nudges.',
    detail: 'Alerts on symbols and watchlists you care about — premium.',
    bullets: ['Delivers in the same app flow you already use.'],
    ctaTo: '/alerts',
    ctaLabel: 'Open Alerts',
  },
];

const derivativesItems = [
  {
    id: 'fno',
    title: 'F&O',
    blurb: 'Futures & options context.',
    detail: 'Index and single-name derivatives next to your equity read — premium.',
    bullets: ['Cross-check with Overview for regime.'],
    ctaTo: '/fno',
    ctaLabel: 'Open F&O',
  },
  {
    id: 'comm',
    title: 'Commodities',
    blurb: 'Macro and physical markets.',
    detail: 'Commodity boards when macro or terms-of-trade matter — premium.',
    bullets: ['Pairs with Forex for global liquidity.'],
    ctaTo: '/commodities',
    ctaLabel: 'Open Commodities',
  },
  {
    id: 'fx',
    title: 'Forex',
    blurb: 'Currency drivers.',
    detail: 'FX alongside equities and derivatives — premium.',
    bullets: ['Use with Overview and commodities.'],
    ctaTo: '/forex',
    ctaLabel: 'Open Forex',
  },
];

const accountItemsBase = [
  {
    id: 'profile',
    title: 'Profile & brokers',
    blurb: 'Account, security, connectivity.',
    detail: 'Profile for credentials, optional AI keys, and broker drafts where supported.',
    bullets: ['One-time broker setup feeds downstream pages.'],
    ctaTo: '/profile',
    ctaLabel: 'Open Profile',
  },
  {
    id: 'premium',
    title: 'Plans & premium',
    blurb: 'Basic and Premium.',
    detail: 'Badge in the header shows Basic or Premium; yearly Premium activates after your admin confirms payment.',
    bullets: ['Locked nav opens after premium is active.', 'See Upgrade for payment steps.'],
    ctaTo: '/upgrade-premium',
    ctaLabel: 'Upgrade to Premium',
  },
  {
    id: 'events',
    title: 'Events',
    blurb: 'Firm sessions and notices.',
    detail: 'Webinars and updates your organisation publishes.',
    bullets: ['New entries appear as admins post them.'],
    ctaTo: '/events',
    ctaLabel: 'Open Events',
  },
];

/** Full features marketing body — used on the public Features route and Profile → Features tab. */
export function FeaturesMarketingContent() {
  const { isAuthenticated } = useAuth();
  const pricingHref = isAuthenticated ? '/profile?tab=pricing' : '/pricing';
  const accountItems = useMemo(
    () =>
      accountItemsBase.map((item) =>
        item.id === 'premium' && isAuthenticated
          ? { ...item, ctaTo: '/profile?tab=pricing', ctaLabel: 'View pricing' }
          : item,
      ),
    [isAuthenticated],
  );

  return (
    <>
      <Box sx={{ mb: 3, textAlign: { xs: 'left', sm: 'center' }, px: { xs: 0, sm: 0.5 } }}>
        <Typography
          variant="overline"
          sx={{ letterSpacing: 0.2, color: accent, fontWeight: 800, display: 'block', mb: 0.75 }}
        >
          Features
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, color: 'text.primary', lineHeight: 1.2 }}>
          One workspace for your desk
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 560, mx: 'auto', mb: 2, lineHeight: 1.55 }}>
          Short map of modules below. Premium items need an active plan — your header badge shows what is on.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent="center" alignItems="center" flexWrap="wrap">
          <Button
            component={RouterLink}
            to="/outlook"
            variant="contained"
            size="medium"
            sx={{ textTransform: 'none', fontWeight: 800, px: 2.25 }}
          >
            Open Overview
          </Button>
          <Button
            component={RouterLink}
            to={pricingHref}
            variant="outlined"
            size="medium"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Pricing
          </Button>
          <Button
            component={RouterLink}
            to="/upgrade-premium"
            variant="outlined"
            size="medium"
            sx={{ textTransform: 'none', fontWeight: 700 }}
          >
            Upgrade steps
          </Button>
        </Stack>
      </Box>

      <Divider sx={{ mb: 3, borderColor: 'rgba(148,163,184,0.2)' }} />

      <FeatureSplitSection
        eyebrow={'Research & markets'}
        title={'Research & outlook'}
        intro="Breadth to security selection — the flows you open each session."
        items={researchItems}
      />

      <FeatureSplitSection
        eyebrow={'Portfolio & risk'}
        title="Portfolio & alerts"
        intro="Size, watch, and react once you have ideas."
        items={portfolioItems}
      />

      <FeatureSplitSection
        eyebrow="Derivatives"
        title={'Derivatives & global'}
        intro="F&O, commodities, and FX beside your equity read."
        items={derivativesItems}
      />

      <FeatureSplitSection
        eyebrow="Account"
        title="Account & access"
        intro="Sign-in, brokers, premium, and firm events."
        items={accountItems}
      />

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          bgcolor: 'rgba(202, 138, 4, 0.1)',
          border: `1px solid rgba(202,138,4,0.35)`,
        }}
      >
        <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
          Need premium?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.55 }}>
          Payment is outside the app; admin activates access (often within 24h).
        </Typography>
        <Button component={RouterLink} to="/upgrade-premium" variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>
          Upgrade to Premium
        </Button>
      </Paper>
    </>
  );
}

function FeaturesPage() {
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 1 }}>
      <FeaturesMarketingContent />
    </Box>
  );
}

export default FeaturesPage;
