import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Chip, List, ListItem, ListItemText, ListItemIcon, Badge } from '@mui/material';
import { Notifications, Warning, Info, CheckCircle, Schedule } from '@mui/icons-material';

const Alerts: React.FC = () => {
  const alerts = [
    { id: 1, type: 'Critical', title: 'FDA Safety Signal - Keytruda', message: 'New safety data reported for melanoma indication', time: '2 hours ago', status: 'unread' },
    { id: 2, type: 'High', title: 'Competitor Launch - Opdivo Combo', message: 'Bristol Myers announces new combination therapy', time: '4 hours ago', status: 'unread' },
    { id: 3, type: 'Medium', title: 'Clinical Trial Update', message: 'Phase III results for Tecentriq published', time: '1 day ago', status: 'read' },
    { id: 4, type: 'Low', title: 'Patent Expiry Notice', message: 'Keytruda patent expires in 2028', time: '2 days ago', status: 'read' },
    { id: 5, type: 'High', title: 'Regulatory Approval', message: 'EMA approves new indication for Imfinzi', time: '3 days ago', status: 'unread' },
  ];

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'Critical': return <Warning color="error" />;
      case 'High': return <Warning color="warning" />;
      case 'Medium': return <Info color="info" />;
      case 'Low': return <CheckCircle color="success" />;
      default: return <Info />;
    }
  };

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'Critical': return 'error';
      case 'High': return 'warning';
      case 'Medium': return 'info';
      case 'Low': return 'success';
      default: return 'default';
    }
  };

  const unreadCount = alerts.filter(alert => alert.status === 'unread').length;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Badge badgeContent={unreadCount} color="error">
          <Notifications />
        </Badge>
        Alerts ({unreadCount} new)
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Recent Alerts</Typography>
              <List>
                {alerts.map((alert) => (
                  <ListItem 
                    key={alert.id}
                    sx={{ 
                      bgcolor: alert.status === 'unread' ? 'action.hover' : 'transparent',
                      borderRadius: 1,
                      mb: 1
                    }}
                  >
                    <ListItemIcon>
                      {getAlertIcon(alert.type)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" fontWeight={alert.status === 'unread' ? 'bold' : 'normal'}>
                            {alert.title}
                          </Typography>
                          <Chip 
                            label={alert.type} 
                            size="small" 
                            color={getAlertColor(alert.type) as any}
                          />
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {alert.message}
                          </Typography>
                          <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
                            <Schedule fontSize="small" />
                            {alert.time}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Alert Summary</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Critical</Typography>
                  <Chip label="1" color="error" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">High Priority</Typography>
                  <Chip label="2" color="warning" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Medium Priority</Typography>
                  <Chip label="1" color="info" size="small" />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body2">Low Priority</Typography>
                  <Chip label="1" color="success" size="small" />
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Alerts;