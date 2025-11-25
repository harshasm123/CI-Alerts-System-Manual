import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import {
  TrendingUp,
  Visibility,
  Insights as InsightsIcon,
  Warning,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ApiService from '../services/api';

function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dashboardData, setDashboardData] = useState({
    watchlist: [],
    recentInsights: [],
    stats: {
      totalMolecules: 0,
      totalInsights: 0,
      highImpactInsights: 0,
    },
  });
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load watchlist and recent insights in parallel
      const [watchlistResponse, insightsResponse] = await Promise.all([
        ApiService.getWatchlist(),
        ApiService.getInsights({ days: 7, limit: 10 }),
      ]);

      const stats = {
        totalMolecules: watchlistResponse.molecules?.length || 0,
        totalInsights: insightsResponse.total_count || 0,
        highImpactInsights: insightsResponse.insights?.filter(
          (insight) => insight.impact_level === 'HIGH'
        ).length || 0,
      };

      setDashboardData({
        watchlist: watchlistResponse.molecules || [],
        recentInsights: insightsResponse.insights || [],
        stats,
      });
    } catch (err) {
      console.error('Error loading dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getImpactColor = (level) => {
    switch (level) {
      case 'HIGH':
        return 'error';
      case 'MEDIUM':
        return 'warning';
      case 'LOW':
        return 'info';
      default:
        return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Visibility color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Watched Molecules
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData.stats.totalMolecules}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <InsightsIcon color="primary" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Recent Insights (7 days)
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData.stats.totalInsights}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center">
                <Warning color="error" sx={{ mr: 2 }} />
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    High Impact Alerts
                  </Typography>
                  <Typography variant="h4">
                    {dashboardData.stats.highImpactInsights}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Watchlist */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Your Watchlist</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/watchlist')}
                >
                  Manage
                </Button>
              </Box>
              {dashboardData.watchlist.length === 0 ? (
                <Typography color="textSecondary">
                  No molecules in your watchlist. Add some to get started!
                </Typography>
              ) : (
                <List dense>
                  {dashboardData.watchlist.slice(0, 5).map((item) => (
                    <ListItem
                      key={item.molecule}
                      button
                      onClick={() => navigate(`/insights/${item.molecule}`)}
                    >
                      <ListItemText
                        primary={item.molecule}
                        secondary={`Added ${new Date(item.created_at).toLocaleDateString()}`}
                      />
                    </ListItem>
                  ))}
                  {dashboardData.watchlist.length > 5 && (
                    <ListItem>
                      <ListItemText
                        secondary={`... and ${dashboardData.watchlist.length - 5} more`}
                      />
                    </ListItem>
                  )}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Insights */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Recent Insights</Typography>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => navigate('/insights')}
                >
                  View All
                </Button>
              </Box>
              {dashboardData.recentInsights.length === 0 ? (
                <Typography color="textSecondary">
                  No recent insights. Check back later!
                </Typography>
              ) : (
                <List dense>
                  {dashboardData.recentInsights.slice(0, 5).map((insight) => (
                    <ListItem key={insight.insight_id}>
                      <ListItemText
                        primary={
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography variant="body2" noWrap>
                              {insight.title}
                            </Typography>
                            <Chip
                              label={insight.impact_level}
                              size="small"
                              color={getImpactColor(insight.impact_level)}
                            />
                          </Box>
                        }
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {insight.molecule} • {insight.source}
                            </Typography>
                            <Typography variant="caption" color="textSecondary">
                              {new Date(insight.timestamp).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Quick Actions */}
      <Box mt={4}>
        <Typography variant="h6" gutterBottom>
          Quick Actions
        </Typography>
        <Grid container spacing={2}>
          <Grid item>
            <Button
              variant="contained"
              onClick={() => navigate('/watchlist')}
              startIcon={<Visibility />}
            >
              Add Molecule
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              onClick={() => navigate('/insights')}
              startIcon={<InsightsIcon />}
            >
              Browse Insights
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="outlined"
              onClick={() => navigate('/settings')}
            >
              Settings
            </Button>
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}

export default Dashboard;