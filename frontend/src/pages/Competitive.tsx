import React from 'react';
import { Box, Typography, Grid, Card, CardContent, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';
import { TrendingUp, Warning, Assessment } from '@mui/icons-material';

const Competitive: React.FC = () => {
  const competitors = [
    { name: 'Opdivo', company: 'Bristol Myers Squibb', marketShare: '28%', threat: 'High', revenue: '$8.2B' },
    { name: 'Tecentriq', company: 'Roche', marketShare: '15%', threat: 'Medium', revenue: '$4.1B' },
    { name: 'Imfinzi', company: 'AstraZeneca', marketShare: '12%', threat: 'Medium', revenue: '$2.8B' },
    { name: 'Bavencio', company: 'Merck KGaA', marketShare: '8%', threat: 'Low', revenue: '$1.2B' },
  ];

  const threats = [
    { type: 'New Combination Therapies', impact: 'High', timeline: '6-12 months' },
    { type: 'Biosimilar Competition', impact: 'Medium', timeline: '18-24 months' },
    { type: 'Novel MOA Drugs', impact: 'High', timeline: '24-36 months' },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Assessment /> Competitive Analysis
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>Market Competitors</Typography>
              <TableContainer component={Paper} elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Drug</TableCell>
                      <TableCell>Company</TableCell>
                      <TableCell>Market Share</TableCell>
                      <TableCell>Revenue</TableCell>
                      <TableCell>Threat Level</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {competitors.map((competitor) => (
                      <TableRow key={competitor.name}>
                        <TableCell>{competitor.name}</TableCell>
                        <TableCell>{competitor.company}</TableCell>
                        <TableCell>{competitor.marketShare}</TableCell>
                        <TableCell>{competitor.revenue}</TableCell>
                        <TableCell>
                          <Chip 
                            label={competitor.threat}
                            color={competitor.threat === 'High' ? 'error' : competitor.threat === 'Medium' ? 'warning' : 'success'}
                            size="small"
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Warning /> Emerging Threats
              </Typography>
              {threats.map((threat, index) => (
                <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle2" fontWeight="bold">{threat.type}</Typography>
                  <Typography variant="body2" color="text.secondary">Impact: {threat.impact}</Typography>
                  <Typography variant="body2" color="text.secondary">Timeline: {threat.timeline}</Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Competitive;