import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Alert, Card, CardContent } from '@mui/material';
import { Add } from '@mui/icons-material';

const AddMolecule: React.FC = () => {
  const [molecule, setMolecule] = useState('');
  const [brandName, setBrandName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    if (!molecule.trim()) return;
    
    setLoading(true);
    try {
      const response = await fetch(`${process.env.REACT_APP_API_URL}/molecules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        },
        body: JSON.stringify({
          molecule: molecule.trim(),
          brand_name: brandName.trim()
        })
      });
      
      if (response.ok) {
        setMessage(`Successfully added ${molecule} for tracking`);
        setMolecule('');
        setBrandName('');
      } else {
        setMessage('Failed to add molecule');
      }
    } catch (error) {
      setMessage('Error adding molecule');
    }
    setLoading(false);
  };

  return (
    <Card sx={{ maxWidth: 400, mx: 'auto', mt: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Add /> Add New Molecule
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Molecule Name"
            value={molecule}
            onChange={(e) => setMolecule(e.target.value)}
            placeholder="e.g., pembrolizumab"
            fullWidth
          />
          
          <TextField
            label="Brand Name (Optional)"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g., Keytruda"
            fullWidth
          />
          
          <Button
            variant="contained"
            onClick={handleSubmit}
            disabled={!molecule.trim() || loading}
            fullWidth
          >
            {loading ? 'Adding...' : 'Add Molecule'}
          </Button>
          
          {message && (
            <Alert severity={message.includes('Successfully') ? 'success' : 'error'}>
              {message}
            </Alert>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

export default AddMolecule;