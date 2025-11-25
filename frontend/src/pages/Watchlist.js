import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Alert,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import ApiService from '../services/api';

function Watchlist() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [molecules, setMolecules] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMolecule, setNewMolecule] = useState('');
  const [newAliases, setNewAliases] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadWatchlist();
  }, []);

  const loadWatchlist = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await ApiService.getWatchlist();
      setMolecules(response.molecules || []);
    } catch (err) {
      console.error('Error loading watchlist:', err);
      setError('Failed to load watchlist');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMolecule = async () => {
    if (!newMolecule.trim()) {
      setError('Molecule name is required');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const aliases = newAliases
        .split(',')
        .map(alias => alias.trim())
        .filter(alias => alias.length > 0);

      await ApiService.addToWatchlist(newMolecule.trim(), aliases);
      
      setSuccess('Molecule added to watchlist successfully');
      setDialogOpen(false);
      setNewMolecule('');
      setNewAliases('');
      loadWatchlist();
    } catch (err) {
      console.error('Error adding molecule:', err);
      if (err.response?.status === 409) {
        setError('Molecule is already in your watchlist');
      } else {
        setError('Failed to add molecule to watchlist');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMolecule = async (molecule) => {
    if (!window.confirm(`Are you sure you want to remove "${molecule}" from your watchlist?`)) {
      return;
    }

    try {
      setError(null);
      await ApiService.removeFromWatchlist(molecule);
      setSuccess('Molecule removed from watchlist');
      loadWatchlist();
    } catch (err) {
      console.error('Error removing molecule:', err);
      setError('Failed to remove molecule from watchlist');
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setNewMolecule('');
    setNewAliases('');
    setError(null);
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Molecule Watchlist</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Molecule
        </Button>
      </Box>

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

      <Card>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Your Watched Molecules ({molecules.length})
          </Typography>
          
          {molecules.length === 0 ? (
            <Box textAlign="center" py={4}>
              <Typography color="textSecondary" gutterBottom>
                No molecules in your watchlist yet
              </Typography>
              <Typography variant="body2" color="textSecondary" gutterBottom>
                Add pharmaceutical molecules to track competitive intelligence
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setDialogOpen(true)}
                sx={{ mt: 2 }}
              >
                Add Your First Molecule
              </Button>
            </Box>
          ) : (
            <List>
              {molecules.map((item) => (
                <ListItem key={item.molecule} divider>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="subtitle1" component="span">
                          {item.molecule}
                        </Typography>
                        {item.aliases && item.aliases.length > 0 && (
                          <Box display="flex" gap={0.5}>
                            {item.aliases.map((alias) => (
                              <Chip
                                key={alias}
                                label={alias}
                                size="small"
                                variant="outlined"
                              />
                            ))}
                          </Box>
                        )}
                      </Box>
                    }
                    secondary={`Added on ${new Date(item.created_at).toLocaleDateString()}`}
                  />
                  <ListItemSecondaryAction>
                    <IconButton
                      edge="end"
                      aria-label="view insights"
                      onClick={() => navigate(`/insights/${item.molecule}`)}
                      sx={{ mr: 1 }}
                    >
                      <ViewIcon />
                    </IconButton>
                    <IconButton
                      edge="end"
                      aria-label="delete"
                      onClick={() => handleRemoveMolecule(item.molecule)}
                      color="error"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItemSecondaryAction>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Add Molecule Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Add Molecule to Watchlist</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Molecule Name"
            fullWidth
            variant="outlined"
            value={newMolecule}
            onChange={(e) => setNewMolecule(e.target.value)}
            placeholder="e.g., pembrolizumab"
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Aliases (optional)"
            fullWidth
            variant="outlined"
            value={newAliases}
            onChange={(e) => setNewAliases(e.target.value)}
            placeholder="e.g., keytruda, MK-3475"
            helperText="Separate multiple aliases with commas"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button
            onClick={handleAddMolecule}
            variant="contained"
            disabled={submitting || !newMolecule.trim()}
          >
            {submitting ? <CircularProgress size={20} /> : 'Add Molecule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Watchlist;