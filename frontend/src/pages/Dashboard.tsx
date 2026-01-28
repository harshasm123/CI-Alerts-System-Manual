import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  Business as BusinessIcon,
  TrendingUp as TrendingUpIcon,
  Warning as WarningIcon,
  Gavel as GavelIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const Dashboard: React.FC = () => {
  // Mock data for charts
  const activityData = [
    { month: 'Jan', activity: 45 },
    { month: 'Feb', activity: 78 },
    { month: 'Mar', activity: 65 },
    { month: 'Apr', activity: 89 },
    { month: 'May', activity: 52 },
    { month: 'Jun', activity: 73 },
  ];

  const recentChanges = [
    { drug: 'Keytruda', change: 'New Phase III trial data', time: '2 hours ago' },
    { drug: 'Opdivo', change: 'FDA safety signal reported', time: '4 hours ago' },
    { drug: 'Tecentriq', change: 'Competitor launch announced', time: '6 hours ago' },
  ];

  const kpiCards = [
    { title: 'Brands Tracked', value: '15', icon: <BusinessIcon />, color: '#1976d2' },
    { title: 'Competitors Monitored', value: '47', icon: <TrendingUpIcon />, color: '#388e3c' },
    { title: 'Critical Alerts (24h)', value: '8', icon: <WarningIcon />, color: '#f57c00' },
    { title: 'Regulatory Events', value: '12', icon: <GavelIcon />, color: '#7b1fa2' },
  ];

  return (
    <Box sx={{ flexGrow: 1 }}>
      <Typography variant="h4" gutterBottom sx={{ mb: 3, fontWeight: 600 }}>
        📊 Pharmaceutical Intelligence Dashboard
      </Typography>

      {/* KPI Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {kpiCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Box
                    sx={{
                      p: 1,
                      borderRadius: 2,
                      backgroundColor: `${card.color}20`,
                      color: card.color,
                      mr: 2,
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Typography variant="h6" component="div" sx={{ fontWeight: 500 }}>
                    {card.title}
                  </Typography>
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 700, color: card.color }}>
                  {card.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Charts and Activity */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
              📈 Brand vs Brand Activity (Last 30 Days)
            </Typography>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="activity"
                  stroke="#1976d2"
                  strokeWidth={3}
                  dot={{ fill: '#1976d2', strokeWidth: 2, r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: 400 }}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 500 }}>
              📅 What Changed Since Yesterday?
            </Typography>
            <List>
              {recentChanges.map((item, index) => (
                <ListItem key={index} sx={{ px: 0 }}>
                  <ListItemIcon>
                    <DotIcon sx={{ color: '#1976d2' }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" sx={{ fontWeight: 500 }}>
                        {item.drug}
                      </Typography>
                    }
                    secondary={
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          {item.change}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.time}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Dashboard;