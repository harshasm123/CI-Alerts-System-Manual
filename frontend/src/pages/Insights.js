import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  Alert,
  CircularProgress,
  Link,
  Divider,
} from '@mui/material';
import {
  FilterList as FilterIcon,
  OpenInNew as OpenIcon,
} from '@mui/icons-material';
import ApiService from '../services/api';

function Insights() {
  const { molecule } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [insights, setInsights] = useState([]);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    days: 7,
    source: '',
    impact_level: '',
    min_relevance: 0.0,
  });

  useEffect(() => {
    loadInsights();
  }, [molecule, filters]);

  const loadInsights = async () => {
    try {
      setLoading(true);
      setError(null);

      let response;
      if (molecule) {
        response = await ApiService.getMoleculeInsights(molecule, filters);
        setStats(response.stats);
      } else {
        response = await ApiService.getInsights(filters);
      }

      setInsights(response.insights || []);
    } catch (err) {
      console.error('Error loading insights:', err);
      setError('Failed to load insights');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value,
    }));
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

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        {molecule ? `Insights for ${molecule}` : 'All Insights'}
      </Typography>

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <FilterIcon sx={{ mr: 1 }} />
            <Typography variant="h6">Filters</Typography>
          </Box>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={filters.days}
                  label="Time Range"
                  onChange={(e) => handleFilterChange('days', e.target.value)}
                >
                  <MenuItem value={1}>Last 24 hours</MenuItem>
                  <MenuItem value={7}>Last 7 days</MenuItem>
                  <MenuItem value={30}>Last 30 days</MenuItem>
                  <MenuItem value={90}>Last 90 days</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Source</InputLabel>
                <Select
                  value={filters.source}
                  label="Source"
                  onChange={(e) => handleFilterChange('source', e.target.value)}
                >
                  <MenuItem value="">All Sources</MenuItem>
                  <MenuItem value="PubMed">PubMed</MenuItem>
                  <MenuItem value="ClinicalTrials.gov">ClinicalTrials.gov</MenuItem>
                  <MenuItem value="FDA">FDA</MenuItem>
                  <MenuItem value="EMA">EMA</MenuItem>
                  <MenuItem value="WIPO">WIPO</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Impact Level</InputLabel>
                <Select
                  value={filters.impact_level}
                  label="Impact Level"
                  onChange={(e) => handleFilterChange('impact_level', e.target.value)}
                >
                  <MenuItem value="">All Levels</MenuItem>
                  <MenuItem value="HIGH">High Impact</MenuItem>
                  <MenuItem value="MEDIUM">Medium Impact</MenuItem>
                  <MenuItem value="LOW">Low Impact</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                label="Min Relevance"
                type="number"
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                value={filters.min_relevance}
                onChange={(e) => handleFilterChange('min_relevance', parseFloat(e.target.value) || 0)}
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Stats (for molecule-specific view) */}
      {stats && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Summary Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4" color="primary">
                  {stats.total_insights}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Total Insights
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4" color="error">
                  {stats.high_impact}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  High Impact
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4" color="warning">
                  {stats.medium_impact}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Medium Impact
                </Typography>
              </Grid>
              <Grid item xs={6} sm={3}>
                <Typography variant="h4">
                  {stats.avg_relevance?.toFixed(2) || '0.00'}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Avg Relevance
                </Typography>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      ) : insights.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary" gutterBottom>
                No insights found
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Try adjusting your filters or check back later for new insights
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Insights ({insights.length})
            </Typography>
            <List>
              {insights.map((insight, index) => (
                <React.Fragment key={insight.insight_id}>
                  <ListItem alignItems="flex-start">
                    <ListItemText
                      primary={
                        <Box>
                          <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <Typography variant="subtitle1" component="span">
                              {insight.title}
                            </Typography>
                            <Chip
                              label={insight.impact_level}
                              size="small"
                              color={getImpactColor(insight.impact_level)}
                            />
                            <Chip
                              label={`${(insight.relevance_score * 100).toFixed(0)}%`}
                              size="small"
                              variant="outlined"
                            />
                          </Box>
                          <Typography variant="body2" color="textSecondary" gutterBottom>
                            {insight.molecule} • {insight.source} • {formatDate(insight.timestamp)}
                          </Typography>
                          <Typography variant="body2" paragraph>
                            {insight.summary}
                          </Typography>
                          {insight.competitor_angle && (
                            <Typography variant="body2" color="primary" paragraph>
                              <strong>Competitive Intelligence:</strong> {insight.competitor_angle}
                            </Typography>
                          )}
                          {insight.entities && insight.entities.length > 0 && (
                            <Box display="flex" gap={0.5} flexWrap="wrap" mb={1}>
                              {insight.entities.slice(0, 5).map((entity) => (
                                <Chip
                                  key={entity}
                                  label={entity}
                                  size="small"
                                  variant="outlined"
                                />
                              ))}
                              {insight.entities.length > 5 && (
                                <Chip
                                  label={`+${insight.entities.length - 5} more`}
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          )}
                          {insight.url && (
                            <Link
                              href={insight.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              display="flex"
                              alignItems="center"
                              gap={0.5}
                            >
                              View Source <OpenIcon fontSize="small" />
                            </Link>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {index < insights.length - 1 && <Divider />}
                </React.Fragment>
              ))}
            </List>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default Insights;