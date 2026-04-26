import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { useAuth } from '../auth/AuthContext';

const accent = '#ca8a04';
const defaultCourses = [
  {
    id: 'fundamentals-playlist',
    title: 'Course 1: Fundamental Analysis (52 videos)',
    url: 'https://www.youtube.com/playlist?list=PLggxfrdV-9sv-uROt8YpO-0hBcDErT2p9',
  },
  {
    id: 'fundamentals-extra',
    title: 'Course 1: Fundamental Analysis (Additional session)',
    url: 'https://www.youtube.com/watch?v=rRzt5rfAX3Q&list=PLggxfrdV-9svmAbnOvE_WBvae-C-xMKVS',
  },
  {
    id: 'ta-basic',
    title: 'Course 2: Technical Analysis Basics',
    url: 'https://www.youtube.com/watch?v=82SqXcKaadU&list=PLggxfrdV-9suY4CBhkq0jup966IzoxHhX',
  },
  {
    id: 'ta-volume-analysis',
    title: 'Course 2: Volume Analysis',
    url: 'https://youtu.be/hWM2Gw36FlU',
  },
  {
    id: 'adv-chart-patterns',
    title: 'Course 3 (Advanced): Chart Patterns',
    url: 'https://www.youtube.com/@Wysetrade/videos?view=0&sort=p&shelf_id=1',
  },
  {
    id: 'adv-cpr',
    title: 'Course 3 (Advanced): CPR',
    url: 'https://www.youtube.com/@cprbykgs/videos',
  },
  {
    id: 'adv-smc',
    title: 'Course 3 (Advanced): SMC (Smart Money Concepts)',
    url: 'https://www.youtube.com/watch?v=1NQ5U9CHL-4&list=PLb0LJvd0db_AJdPEatHGMKuuSgQyi1G2-',
  },
  {
    id: 'adv-order-block',
    title: 'Course 3 (Advanced): Order Block',
    url: 'https://www.youtube.com/watch?v=f18gazn0nYE&t=53s&pp=ygUTb3JkZXIgYmxvY2tzIGNvdXJzZdIHCQnUCgGHKiGM7w%3D%3D',
  },
  {
    id: 'adv-squeeze-momentum-1',
    title: 'Course 3 (Advanced): Squeeze Momentum (Part 1)',
    url: 'https://www.youtube.com/watch?v=Xz3l0OSvrVE&pp=ygUjc3F1ZWV6ZSBtb21lbnR1bSBpbmRpY2F0b3IgbGF6eWJlYXI%3D',
  },
  {
    id: 'adv-squeeze-momentum-2',
    title: 'Course 3 (Advanced): Squeeze Momentum (Part 2)',
    url: 'https://www.youtube.com/watch?v=fgtfI5eAS_Y&pp=ygUjc3F1ZWV6ZSBtb21lbnR1bSBpbmRpY2F0b3IgbGF6eWJlYXI%3D',
  },
  {
    id: 'adv-fibonacci',
    title: 'Course 3 (Advanced): Fibonacci Retracement and Extension',
    url: 'https://www.youtube.com/watch?v=oVMeymdZwWI&pp=ygUjZmlib25hY2NpIHJldHJhY2VtZW50IGFuZCBleHRlbnNpb24%3D',
  },
];

const envCourses = (process.env.REACT_APP_ONBOARDING_COURSE_LINKS || '')
  .split(',')
  .map((v) => String(v || '').trim())
  .filter(Boolean)
  .map((url, idx) => ({ id: `env-${idx + 1}`, title: `Course ${idx + 1}`, url }));
const courses = envCourses.length ? envCourses : defaultCourses;

const YT_WATCH_RE = /(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{11})/i;

function toEmbedUrl(rawUrl) {
  const raw = String(rawUrl || '').trim();
  if (!raw) return '';
  const m = raw.match(YT_WATCH_RE);
  if (m?.[1]) return `https://www.youtube.com/embed/${m[1]}`;
  return raw;
}

/** Full onboarding body — used on the public Onboarding route and Profile → Onboarding tab. */
export function OnboardingMarketingContent() {
  const { isAuthenticated, outlookPremium } = useAuth();
  const canViewOnboardingVideo = Boolean(isAuthenticated && outlookPremium);
  const [videoSrc, setVideoSrc] = useState('');
  const [videoError, setVideoError] = useState('');
  const [videoLoading, setVideoLoading] = useState(false);
  const onboardingVideoUrl = useMemo(
    () => toEmbedUrl(process.env.REACT_APP_ONBOARDING_VIDEO_URL || ''),
    [],
  );

  useEffect(() => {
    let localUrl = '';
    let cancelled = false;
    const loadProtectedVideo = async () => {
      if (!canViewOnboardingVideo || onboardingVideoUrl) {
        setVideoSrc('');
        setVideoError('');
        setVideoLoading(false);
        return;
      }
      setVideoLoading(true);
      setVideoError('');
      try {
        const token = localStorage.getItem('auth_access_token') || '';
        if (!token) throw new Error('Login required to load onboarding video.');
        const res = await fetch('/api/auth/onboarding-video', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          throw new Error(txt || `Unable to load video (${res.status}).`);
        }
        const blob = await res.blob();
        localUrl = URL.createObjectURL(blob);
        if (!cancelled) setVideoSrc(localUrl);
      } catch (e) {
        if (!cancelled) setVideoError(e?.message || 'Unable to load onboarding video.');
      } finally {
        if (!cancelled) setVideoLoading(false);
      }
    };
    loadProtectedVideo();
    return () => {
      cancelled = true;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [canViewOnboardingVideo, onboardingVideoUrl]);

  return (
    <>
      <Box sx={{ mb: 3, textAlign: { xs: 'left', sm: 'center' }, px: { xs: 0, sm: 0.5 } }}>
        <Typography
          variant="overline"
          sx={{ letterSpacing: 0.2, color: accent, fontWeight: 800, display: 'block', mb: 0.75 }}
        >
          Onboarding
        </Typography>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, color: 'text.primary', lineHeight: 1.2 }}>
          How to use the full website
        </Typography>
      </Box>

      <Divider sx={{ mb: 3, borderColor: 'rgba(148,163,184,0.2)' }} />

      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: 2,
          mb: 3,
          border: '1px solid rgba(96,165,250,0.22)',
          bgcolor: 'rgba(15,23,42,0.35)',
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.2 }}>
          Onboarding video guide
        </Typography>
        {canViewOnboardingVideo && onboardingVideoUrl ? (
          <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: 1.5, overflow: 'hidden', mb: 1 }}>
            <Box
              component="iframe"
              src={onboardingVideoUrl}
              title="Onboarding video"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </Box>
        ) : canViewOnboardingVideo && videoSrc ? (
          <Box sx={{ position: 'relative', width: '100%', pt: '56.25%', borderRadius: 1.5, overflow: 'hidden', mb: 1 }}>
            <Box
              component="video"
              controls
              preload="metadata"
              sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, bgcolor: '#000' }}
            >
              <source src={videoSrc} type="video/mp4" />
            </Box>
          </Box>
        ) : canViewOnboardingVideo && videoLoading ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Loading onboarding video...
          </Typography>
        ) : canViewOnboardingVideo && videoError ? (
          <Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
            {videoError}
          </Typography>
        ) : canViewOnboardingVideo ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            No onboarding video configured yet.
          </Typography>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Onboarding video is available only for Premium users with full access. Upgrade your plan to unlock it.
          </Typography>
        )}
        <Typography variant="caption" color="text.secondary">
          Recommended: 8-15 minute walkthrough covering login, profile, brokers, overview, screens, alerts, and upgrade flow.
        </Typography>
      </Paper>

      <Box component="section" sx={{ mb: 3.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 800, mb: 1.25 }}>
          Courses
        </Typography>
        {courses.length ? (
          <Stack spacing={1.1}>
            {courses.map((course) => (
              <Paper key={course.id} elevation={0} sx={{ p: 1.4, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1} flexWrap="wrap">
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {course.title}
                  </Typography>
                  <Button
                    component="a"
                    href={course.url}
                    target="_blank"
                    rel="noreferrer"
                    variant="outlined"
                    size="small"
                    sx={{ textTransform: 'none', fontWeight: 700 }}
                  >
                    Watch on YouTube
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Paper elevation={0} sx={{ p: 1.4, borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="body2" color="text.secondary">
              No course links added yet. Set `REACT_APP_ONBOARDING_COURSE_LINKS` as comma-separated YouTube URLs.
            </Typography>
          </Paper>
        )}
      </Box>

    </>
  );
}

function FeaturesPage() {
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', pb: 1 }}>
      <OnboardingMarketingContent />
    </Box>
  );
}

export const FeaturesMarketingContent = OnboardingMarketingContent;
export default FeaturesPage;
