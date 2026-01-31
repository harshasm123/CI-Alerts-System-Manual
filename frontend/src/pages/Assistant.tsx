import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, TextField, Button, List, ListItem, ListItemText, Chip, Paper } from '@mui/material';
import { SmartToy, Send, Psychology, TrendingUp } from '@mui/icons-material';

interface Message {
  id: number;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  confidence?: number;
}

const Assistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      type: 'assistant',
      content: 'Hello! I\'m your AI-powered competitive intelligence analyst. I can help you analyze pharmaceutical market trends, competitive threats, and strategic opportunities. What would you like to know?',
      timestamp: new Date(),
      confidence: 95
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');

  const templates = [
    'Analyze competitive threats to Keytruda',
    'Compare PD-1 inhibitors market share',
    'Assess Opdivo combination strategy',
    'Evaluate regulatory risks for immunotherapy',
    'Predict market trends for next 12 months'
  ];

  const handleSendMessage = () => {
    if (!inputMessage.trim()) return;

    const userMessage: Message = {
      id: messages.length + 1,
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    const assistantResponse: Message = {
      id: messages.length + 2,
      type: 'assistant',
      content: `Based on my analysis of recent clinical data, patent filings, and regulatory submissions, here are the key insights for "${inputMessage}": 

1. **Market Dynamics**: Current competitive landscape shows increasing pressure from combination therapies
2. **Regulatory Environment**: Recent FDA guidance suggests stricter safety monitoring requirements
3. **Clinical Pipeline**: 15+ competing assets in Phase II/III trials pose medium-term threats

📚 Sources: PubMed (45 articles), ClinicalTrials.gov (12 trials), FDA submissions (8 documents)`,
      timestamp: new Date(),
      confidence: 87
    };

    setMessages([...messages, userMessage, assistantResponse]);
    setInputMessage('');
  };

  const handleTemplateClick = (template: string) => {
    setInputMessage(template);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SmartToy /> AI Assistant
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, height: 'calc(100vh - 200px)' }}>
        <Box sx={{ flex: 1 }}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Psychology /> CI Analysis Assistant
              </Typography>
              
              <Box sx={{ flex: 1, overflow: 'auto', mb: 2 }}>
                {messages.map((message) => (
                  <Paper
                    key={message.id}
                    sx={{
                      p: 2,
                      mb: 2,
                      bgcolor: message.type === 'user' ? 'primary.light' : 'grey.100',
                      color: message.type === 'user' ? 'white' : 'text.primary',
                      ml: message.type === 'user' ? 4 : 0,
                      mr: message.type === 'assistant' ? 4 : 0
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {message.type === 'user' ? '👤 You' : '🤖 AI Assistant'}
                      </Typography>
                      {message.confidence && (
                        <Chip 
                          label={`${message.confidence}% confidence`} 
                          size="small" 
                          color="success"
                        />
                      )}
                    </Box>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-line' }}>
                      {message.content}
                    </Typography>
                    <Typography variant="caption" sx={{ opacity: 0.7, mt: 1, display: 'block' }}>
                      {message.timestamp.toLocaleTimeString()}
                    </Typography>
                  </Paper>
                ))}
              </Box>

              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  fullWidth
                  variant="outlined"
                  placeholder="Ask about competitive intelligence..."
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                />
                <Button
                  variant="contained"
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  sx={{ minWidth: 'auto', px: 2 }}
                >
                  <Send />
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Box>

        <Box sx={{ width: 300 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>📋 Analysis Templates</Typography>
              <List dense>
                {templates.map((template, index) => (
                  <ListItem
                    key={index}
                    button
                    onClick={() => handleTemplateClick(template)}
                    sx={{ 
                      bgcolor: 'grey.50', 
                      borderRadius: 1, 
                      mb: 1,
                      '&:hover': { bgcolor: 'grey.100' }
                    }}
                  >
                    <ListItemText 
                      primary={template}
                      primaryTypographyProps={{ variant: 'body2' }}
                    />
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        </Box>
      </Box>
    </Box>
  );
};

export default Assistant;