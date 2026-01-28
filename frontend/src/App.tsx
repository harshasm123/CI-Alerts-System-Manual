import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { CssBaseline, Box } from '@mui/material';
import { Provider } from 'react-redux';
import { QueryClient, QueryClientProvider } from 'react-query';
import { Amplify } from 'aws-amplify';
import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';

import { store } from './store/store';
import Navigation from './components/Navigation';
import Dashboard from './pages/Dashboard';
import BrandIntelligence from './pages/BrandIntelligence';
import { Competitive, Alerts, AIInsights, Assistant } from './pages/index';

// Configure Amplify
const amplifyConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.REACT_APP_USER_POOL_ID || '',
      userPoolClientId: process.env.REACT_APP_USER_POOL_CLIENT_ID || '',
      region: process.env.REACT_APP_REGION || 'us-east-1',
    }
  },
  API: {
    REST: {
      'ci-alert-api': {
        endpoint: process.env.REACT_APP_API_URL || '',
        region: process.env.REACT_APP_REGION || 'us-east-1',
      }
    }
  }
};

Amplify.configure(amplifyConfig);

// Material UI Theme
const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: '#f5f5f5',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 600,
    },
    h6: {
      fontWeight: 500,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          borderRadius: 12,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
        },
      },
    },
  },
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App: React.FC = () => {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <CssBaseline />
          <Authenticator>
            {({ signOut, user }) => (
              <Router>
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <Navigation user={user} signOut={signOut} />
                  <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
                    <Routes>
                      <Route path="/" element={<Navigate to="/dashboard" replace />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/brand-intelligence" element={<BrandIntelligence />} />
                      <Route path="/competitive" element={<Competitive />} />
                      <Route path="/alerts" element={<Alerts />} />
                      <Route path="/ai-insights" element={<AIInsights />} />
                      <Route path="/assistant" element={<Assistant />} />
                    </Routes>
                  </Box>
                </Box>
              </Router>
            )}
          </Authenticator>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  );
};

export default App;