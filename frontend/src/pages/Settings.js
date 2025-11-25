import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Chip,
} from '@mui/material';
import { Save as SaveIcon } from '@mui/icons-material';
import ApiService from '../services/api';

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
];

const SOURCES = ['PubMed', 'ClinicalTrials.gov', 'FDA', 'EMA', 'WIPO'];
const IMPACT_LEVELS = ['HIGH', 'MEDIUM', 'LOW'];

function Settings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [settings, setSettings] = useState({
    email: '',
    alert_time: '09:00',
    timezone: 'UTC',
    preferences: {
      email_enabled: true,
      min_relevance: 0.5,
      sources: SOURCES,
      impact_levels: IMPACT_LEVELS,
    },
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ApiService.getUserSettings();
      setSettings(response);
    } catch (err) {
      console.error('Error loading settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await ApiService.updateUserSettings(settings);
      setSuccess('Settings saved successfully');
    } catch (err) {
      console.error('Error saving settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSettingChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePreferenceChange = (field, value) => {
    setSettings(prev => ({
      ...prev,
      preferences: {
        ...prev.preferences,
        [field]: value,
      },
    }));
  };

  const handleSourceToggle = (source) => {
    const currentSources = settings.preferences.sources || [];
    const newSources = currentSources.includes(source)
      ? currentSources.filter(s => s !== source)
      : [...currentSources, source];
    
    handlePreferenceChange('sources', newSources);
  };

  const handleImpactLevelToggle = (level) => {
    const currentLevels = settings.preferences.impact_levels || [];
    const newLevels = currentLevels.includes(level)
      ? currentLevels.filter(l => l !== level)
      : [...currentLevels, level];
    
    handlePreferenceChange('impact_levels', newLevels);
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
        Settings
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Account Settings */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Settings
              </Typography>
              <TextField
                fullWidth
                label="Email Address"
                value={settings.email}
                onChange={(e) => handleSettingChange('email', e.target.value)}
                margin="normal"
                type="email"
              />
              <TextField
                fullWidth
                label="Daily Alert Time"
                value={settings.alert_time}
                onChange={(e) => handleSettingChange('alert_time', e.target.value)}
                margin="normal"
                type="time"
                InputLabelProps={{ shrink: true }}
                helperText="Time when you want to receive daily digest emails"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Timezone</InputLabel>
                <Select
                  value={settings.timezone}
                  label="Timezone"
                  onChange={(e) => handleSettingChange('timezone', e.target.value)}
                >
                  {TIMEZONES.map((tz) => (
                    <MenuItem key={tz} value={tz}>
                      {tz}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </CardContent>
          </Card>
        </Grid>

        {/* Notification Preferences */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Notification Preferences
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.preferences.email_enabled}
                    onChange={(e) => handlePreferenceChange('email_enabled', e.target.checked)}
                  />
                }
                label="Enable Email Notifications"
              />
              <TextField
                fullWidth
                label="Minimum Relevance Score"
                value={settings.preferences.min_relevance}
                onChange={(e) => handlePreferenceChange('min_relevance', parseFloat(e.target.value) || 0)}
                margin="normal"
                type="number"
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                helperText="Only show insights with relevance score above this threshold (0.0 - 1.0)"
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Content Filters */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Content Filters
              </Typography>
              
              <Typography variant="subtitle1" gutterBottom sx={{ mt: 2 }}>
                Data Sources
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Select which sources you want to receive insights from
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap" mb={3}>
                {SOURCES.map((source) => (
                  <Chip
                    key={source}
                    label={source}
                    clickable
                    color={settings.preferences.sources?.includes(source) ? 'primary' : 'default'}
                    onClick={() => handleSourceToggle(source)}
                  />
                ))}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle1" gutterBottom>
                Impact Levels
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Select which impact levels you want to receive
              </Typography>
              <Box display="flex" gap={1} flexWrap="wrap">
                {IMPACT_LEVELS.map((level) => (
                  <Chip
                    key={level}
                    label={level}
                    clickable
                    color={settings.preferences.impact_levels?.includes(level) ? 'primary' : 'default'}
                    onClick={() => handleImpactLevelToggle(level)}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Save Button */}
      <Box mt={3} display="flex" justifyContent="flex-end">
        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          size="large"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
      </Box>
    </Box>
  );
}

export default Settings;