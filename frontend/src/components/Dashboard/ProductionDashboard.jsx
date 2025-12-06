import React, { useState, useEffect } from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress
} from '@mui/material';
import {
  TrendingUp,
  TrendingDown,
  Science,
  Notifications,
  Speed,
  Security
} from '@mui/icons-material';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const MetricsCard = ({ title, value, trend, icon, color = 'primary', loading = false }) => (
  <Card sx={{ height: '100%', boxShadow: 3, borderLeft: `4px solid`, borderLeftColor: `${color}.main` }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography color="textSecondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          {loading ? (
            <CircularProgress size={24} />
          ) : (
            <Typography variant="h4" component="div" color={color}>
              {value}
            </Typography>
          )}
        </Box>
        <Box display="flex" flexDirection="column" alignItems="center">
          {icon}
          {trend !== undefined && (
            <Box display="flex" alignItems="center" mt={1}>
              {trend > 0 ? (
                <TrendingUp color="success" fontSize="small" />
              ) : (
                <TrendingDown color="error" fontSize="small" />
              )}
              <Typography variant="caption" color={trend > 0 ? 'success.main' : 'error.main'}>
                {Math.abs(trend)}%
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </CardContent>
  </Card>
);

const SystemHealthCard = ({ health }) => {
  const getHealthColor = (status) => {
    switch (status) {
      case 'healthy': return 'success';
      case 'warning': return 'warning';
      case 'critical': return 'error';
      default: return 'grey';
    }
  };

  return (
    <Card sx={{ height: '100%', boxShadow: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          System Health
        </Typography>
        <Box>
          {Object.entries(health).map(([service, status]) => (
            <Box key={service} display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="body2">{service}</Typography>
              <Chip
                label={status}
                color={getHealthColor(status)}
                size="small"
                variant="outlined"
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

const ProductionDashboard = ({ metrics, loading, error }) => {
  const [realTimeData, setRealTimeData] = useState({
    insights: [],
    molecules: [],
    activities: [],
    health: {}
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setRealTimeData(prev => ({
        ...prev,
        lastUpdate: new Date().toISOString()
      }));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load dashboard data: {error.message}
      </Alert>
    );
  }

  const mockHealth = {
    'API Gateway': 'healthy',
    'Lambda Functions': 'healthy',
    'DynamoDB': 'healthy',
    'Bedrock Models': 'warning',
    'S3 Storage': 'healthy',
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Production Dashboard
      </Typography>
      
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      
      <Grid container spacing={3}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Total Insights"
            value={metrics?.totalInsights || 1247}
            trend={12}
            icon={<Science color="primary" />}
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Active Molecules"
            value={metrics?.activeMolecules || 89}
            trend={5}
            icon={<TrendingUp color="success" />}
            color="success"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="Alerts Sent"
            value={metrics?.alertsSent || 156}
            trend={-3}
            icon={<Notifications color="warning" />}
            color="warning"
            loading={loading}
          />
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <MetricsCard
            title="System Uptime"
            value="99.97%"
            trend={0.1}
            icon={<Speed color="info" />}
            color="info"
            loading={loading}
          />
        </Grid>

        <Grid item xs={12} md={8}>
          <SystemHealthCard health={mockHealth} />
        </Grid>
      </Grid>
    </Box>
  );
};

export default ProductionDashboard;