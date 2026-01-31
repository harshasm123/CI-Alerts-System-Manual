import React from 'react';
import { Box, Typography, Grid, Card, CardContent, LinearProgress, Chip } from '@mui/material';
import { Psychology, TrendingUp, Lightbulb, Analytics } from '@mui/icons-material';

const AIInsights: React.FC = () => {
  const insights = [
    {
      title: 'Market Share Prediction',
      confidence: 92,
      insight: 'Keytruda market share likely to decline 5-8% over next 18 months due to emerging combination therapies',
      category: 'Market Analysis',
      impact: 'High'
    },
    {
      title: 'Competitive Threat Assessment',
      confidence: 87,
      insight: 'Opdivo + Yervoy combination poses significant threat in first-line NSCLC treatment',
      category: 'Competition',
      impact: 'High'
    },
    {
      title: 'Patent Cliff Analysis',
      confidence: 95,
      insight: 'Patent expiry in 2028 will result in 60-70% revenue loss within 24 months post-expiry',
      category: 'IP Strategy',
      impact: 'Critical'
    },
    {
      title: 'Regulatory Risk Score',
      confidence: 78,
      insight: 'Medium risk of additional safety warnings based on recent adverse event patterns',
      category: 'Regulatory',
      impact: 'Medium'
    }
  ];

  const trends = [
    { metric: 'Clinical Trial Success Rate', value: '68%', trend: 'up', change: '+5%' },
    { metric: 'Competitive Pressure Index', value: '7.2/10', trend: 'up', change: '+0.8' },
    { metric: 'Market Opportunity Score', value: '8.5/10', trend: 'down', change: '-0.3' },
    { metric: 'Innovation Pipeline Strength', value: '6.8/10', trend: 'up', change: '+1.2' }
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Psychology /> AI Insights
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Lightbulb /> Key Insights
              </Typography>
              {insights.map((insight, index) => (
                <Box key={index} sx={{ mb: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="subtitle1" fontWeight="bold">{insight.title}</Typography>
                    <Chip 
                      label={`${insight.confidence}% confidence`} 
                      color="primary" 
                      size="small" 
                    />
                  </Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>{insight.insight}</Typography>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Chip label={insight.category} size="small" variant="outlined" />
                    <Chip 
                      label={insight.impact} 
                      size="small" 
                      color={insight.impact === 'Critical' ? 'error' : insight.impact === 'High' ? 'warning' : 'info'}
                    />
                  </Box>
                  <LinearProgress 
                    variant="determinate" 
                    value={insight.confidence} 
                    sx={{ mt: 1, height: 6, borderRadius: 3 }}
                  />
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Analytics /> AI Metrics
              </Typography>
              {trends.map((trend, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">{trend.metric}</Typography>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                    <Typography variant="h6">{trend.value}</Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <TrendingUp 
                        color={trend.trend === 'up' ? 'success' : 'error'} 
                        sx={{ transform: trend.trend === 'down' ? 'rotate(180deg)' : 'none' }}
                      />
                      <Typography 
                        variant="body2" 
                        color={trend.trend === 'up' ? 'success.main' : 'error.main'}
                      >
                        {trend.change}
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default AIInsights;