import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  Stack,
  Typography,
} from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import { useAuth } from '../../auth/AuthContext';
import { useNotificationInbox } from '../../hooks/useNotificationInbox';
import {
  INBOX_FILTER_CHIPS,
  INBOX_SOURCES,
  formatAlertTimeIST,
  inboxItemKey,
} from '../../utils/alertInboxUtils';

function sourceChipColor(source) {
  if (String(source || '').startsWith('trend_b')) return { bg: '#ecfdf5', color: '#047857' };
  if (String(source || '').startsWith('trend_s')) return { bg: '#fef2f2', color: '#b91c1c' };
  if (source === INBOX_SOURCES.WEEKLY) return { bg: '#eff6ff', color: '#1d4ed8' };
  if (source === INBOX_SOURCES.DIVERGENCE) return { bg: '#fdf4ff', color: '#7e22ce' };
  if (source === INBOX_SOURCES.PRICE) return { bg: '#fff7ed', color: '#c2410c' };
  if (source === INBOX_SOURCES.ADMIN) return { bg: '#fef2f2', color: '#b91c1c' };
  return { bg: '#ecfdf5', color: '#047857' };
}

function UserNotificationBell() {
  const navigate = useNavigate();
  const { user, isSuperAdmin } = useAuth();
  const userId = String(user?.id || user?.user_id || '');
  const [anchorEl, setAnchorEl] = useState(null);
  const [filter, setFilter] = useState('all');

  const {
    sections,
    counts,
    loading,
    error,
    badgeCount,
    load,
    markItemRead,
    markAllRead,
  } = useNotificationInbox({
    enabled: Boolean(userId || user?.email),
    userId,
    isSuperAdmin,
  });

  const open = Boolean(anchorEl);

  const visibleFilters = useMemo(
    () => INBOX_FILTER_CHIPS.filter((f) => {
      if (f.id === INBOX_SOURCES.ADMIN && !isSuperAdmin) return false;
      if (f.id === 'all') return true;
      return (counts[f.id] || 0) > 0 || f.id === filter;
    }),
    [counts, filter, isSuperAdmin],
  );

  const items = useMemo(() => {
    if (filter === 'all') return sections.all || [];
    return sections[filter] || [];
  }, [filter, sections]);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
    load();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = async (item) => {
    await markItemRead(item);
    handleClose();
    if (item.source === INBOX_SOURCES.ADMIN && isSuperAdmin) {
      navigate('/admin-users', {
        state: {
          highlightUserId: item.raw?.subject_user_id,
          fromNotification: true,
        },
      });
      return;
    }
    navigate('/alerts');
  };

  return (
    <>
      <IconButton
        size="small"
        aria-label="Notifications"
        onClick={handleOpen}
        sx={{
          border: '1px solid rgba(59, 130, 246, 0.35)',
          bgcolor: 'rgba(255,255,255,0.85)',
        }}
      >
        <Badge badgeContent={badgeCount} color="error" max={99} invisible={badgeCount <= 0}>
          <NotificationsNoneOutlinedIcon fontSize="small" />
        </Badge>
      </IconButton>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{
          paper: {
            sx: { width: 400, maxWidth: '95vw', maxHeight: 480 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          {badgeCount > 0 ? (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
              {badgeCount} unread
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ px: 1.5, pb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {visibleFilters.map((chip) => (
            <Chip
              key={chip.id}
              size="small"
              label={chip.label}
              variant={filter === chip.id ? 'filled' : 'outlined'}
              color={filter === chip.id ? 'primary' : 'default'}
              onClick={() => setFilter(chip.id)}
              sx={{ fontSize: 11 }}
            />
          ))}
        </Box>
        <Divider />
        {loading && !items.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
            <CircularProgress size={22} />
          </Box>
        ) : null}
        {error ? (
          <Typography variant="body2" color="error" sx={{ px: 2, py: 1.5 }}>
            {error}
          </Typography>
        ) : null}
        {!loading && !error && !items.length ? (
          <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 2 }}>
            No notifications yet.
          </Typography>
        ) : null}
        <List dense disablePadding sx={{ maxHeight: 320, overflow: 'auto' }}>
          {items.slice(0, 40).map((item) => {
            const tone = sourceChipColor(item.source);
            return (
              <ListItemButton
                key={inboxItemKey(item)}
                onClick={() => handleSelect(item)}
                sx={{
                  alignItems: 'flex-start',
                  bgcolor: item.isRead ? 'transparent' : 'rgba(25, 118, 210, 0.06)',
                  borderLeft: item.isRead ? '3px solid transparent' : '3px solid #1976d2',
                }}
              >
                <ListItemText
                  primary={(
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography component="span" variant="body2" sx={{ fontWeight: item.isRead ? 600 : 800 }}>
                        {item.symbol}
                      </Typography>
                      <Box
                        component="span"
                        sx={{
                          fontSize: 10,
                          fontWeight: 700,
                          px: 0.75,
                          py: 0.2,
                          borderRadius: 0.75,
                          bgcolor: tone.bg,
                          color: tone.color,
                        }}
                      >
                        {item.sourceLabel}
                      </Box>
                    </Stack>
                  )}
                  secondary={(
                    <>
                      <Typography component="span" variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                        {item.title}
                      </Typography>
                      <Typography component="span" variant="caption" sx={{ color: 'text.disabled' }}>
                        {formatAlertTimeIST(item.timestamp)}
                      </Typography>
                    </>
                  )}
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItemButton>
            );
          })}
        </List>
        <Divider />
        <Box sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          {badgeCount > 0 ? (
            <Button size="small" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null}
          <Button size="small" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button size="small" onClick={() => { handleClose(); navigate('/alerts'); }}>
            All alerts
          </Button>
        </Box>
      </Menu>
    </>
  );
}

export default UserNotificationBell;
