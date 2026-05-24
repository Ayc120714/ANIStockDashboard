import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Box,
  Button,
  CircularProgress,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  Typography,
} from '@mui/material';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import {
  fetchAdminNotifications,
  markAdminNotificationRead,
} from '../../api/auth';

const POLL_MS = 60_000;

function formatWhen(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function AdminNotificationBell() {
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchAdminNotifications({ limit: 40 });
      setItems(Array.isArray(res?.data) ? res.data : []);
      setUnreadCount(Number(res?.unread_count) || 0);
    } catch (err) {
      setError(err?.message || 'Could not load notifications.');
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const open = Boolean(anchorEl);

  const handleOpen = (event) => {
    setAnchorEl(event.currentTarget);
    load();
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleSelect = async (notification) => {
    if (!notification?.id) return;
    try {
      if (!notification.is_read) {
        await markAdminNotificationRead(notification.id);
        setItems((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, is_read: true } : n,
          ),
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
    } catch (_) {
      // still navigate so admin can act on the user
    }
    handleClose();
    navigate('/admin-users', {
      state: {
        highlightUserId: notification.subject_user_id,
        fromNotification: true,
      },
    });
  };

  return (
    <>
      <IconButton
        size="small"
        aria-label="Admin notifications"
        onClick={handleOpen}
        sx={{
          border: '1px solid rgba(59, 130, 246, 0.35)',
          bgcolor: 'rgba(255,255,255,0.85)',
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="error"
          max={99}
          invisible={unreadCount <= 0}
        >
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
            sx: { width: 360, maxWidth: '95vw', maxHeight: 420 },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Notifications
          </Typography>
          {unreadCount > 0 ? (
            <Typography variant="caption" sx={{ color: 'error.main', fontWeight: 700 }}>
              {unreadCount} unread
            </Typography>
          ) : null}
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
        <List dense disablePadding sx={{ maxHeight: 300, overflow: 'auto' }}>
          {items.map((n) => (
            <ListItemButton
              key={n.id}
              onClick={() => handleSelect(n)}
              sx={{
                alignItems: 'flex-start',
                bgcolor: n.is_read ? 'transparent' : 'rgba(25, 118, 210, 0.06)',
                borderLeft: n.is_read ? '3px solid transparent' : '3px solid #1976d2',
              }}
            >
              <ListItemText
                primary={n.title || 'Notification'}
                secondary={
                  <>
                    <Typography component="span" variant="caption" display="block" sx={{ color: 'text.secondary' }}>
                      {n.body}
                    </Typography>
                    <Typography component="span" variant="caption" sx={{ color: 'text.disabled' }}>
                      {formatWhen(n.created_at)}
                    </Typography>
                  </>
                }
                primaryTypographyProps={{ fontSize: 13, fontWeight: n.is_read ? 500 : 700 }}
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItemButton>
          ))}
        </List>
        <Divider />
        <Box sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Button size="small" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button size="small" onClick={() => { handleClose(); navigate('/admin-users'); }}>
            All users
          </Button>
        </Box>
      </Menu>
    </>
  );
}

export default AdminNotificationBell;
