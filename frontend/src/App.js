import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Authenticator } from '@aws-amplify/ui-react';
import { Auth } from 'aws-amplify';
import '@aws-amplify/ui-react/styles.css';

// Components
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Watchlist from './pages/Watchlist';
import Insights from './pages/Insights';
import Settings from './pages/Settings';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const currentUser = await Auth.currentAuthenticatedUser();
      setUser(currentUser);
    } catch (error) {
      console.log('No authenticated user');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Authenticator
      hideSignUp={false}
      components={{
        Header() {
          return (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <h1>CI Alert System</h1>
              <p>Competitive Intelligence for Pharmaceutical Industry</p>
            </div>
          );
        }
      }}
    >
      {({ signOut, user }) => (
        <Layout user={user} signOut={signOut}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/watchlist" element={<Watchlist />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/insights/:molecule" element={<Insights />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      )}
    </Authenticator>
  );
}

export default App;