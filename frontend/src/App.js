import React, { useState, useEffect } from 'react';
import { Amplify } from 'aws-amplify';
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL;
const USER_POOL_ID = process.env.REACT_APP_USER_POOL_ID;
const USER_POOL_CLIENT_ID = process.env.REACT_APP_USER_POOL_CLIENT_ID;
const REGION = process.env.REACT_APP_REGION;

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: USER_POOL_ID,
      userPoolClientId: USER_POOL_CLIENT_ID,
    }
  }
});

function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [watchlist, setWatchlist] = useState([]);
  const [insights, setInsights] = useState([]);
  const [newMolecule, setNewMolecule] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState({
    emailFrequency: 'daily',
    notificationEmail: '',
    enableAlerts: true,
    alertThreshold: 'medium'
  });

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadWatchlist();
      loadInsights();
      loadSettings();
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (err) {
      setUser(null);
    }
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn({ username: email, password });
      await checkUser();
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp({ 
        username: email, 
        password, 
        options: { 
          userAttributes: { email },
          autoSignIn: false
        } 
      });
      setError('Sign up successful! Your account is auto-verified. Please sign in.');
      setIsSignUp(false);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const handleSignOut = async () => {
    await signOut();
    setUser(null);
    setWatchlist([]);
    setInsights([]);
  };

  const getAuthToken = async () => {
    const session = await fetchAuthSession();
    return session.tokens.idToken.toString();
  };

  const loadWatchlist = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}watchlist?userId=${user.username}`, {
        headers: { Authorization: token }
      });
      if (!res.ok) throw new Error('Failed to load watchlist');
      const data = await res.json();
      setWatchlist(data.watchlist || data.molecules || []);
    } catch (err) {
      console.error('Load watchlist error:', err);
      setWatchlist([]);
    }
  };

  const loadInsights = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}insights`, {
        headers: { Authorization: token }
      });
      if (!res.ok) throw new Error('Failed to load insights');
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Load insights error:', err);
      setInsights([]);
    }
  };

  const loadSettings = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}user-settings`, {
        headers: { Authorization: token }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings({
          emailFrequency: 'daily',
          notificationEmail: data.email || user.username,
          enableAlerts: data.preferences?.email_enabled ?? true,
          alertThreshold: data.preferences?.min_relevance >= 0.8 ? 'high' : data.preferences?.min_relevance >= 0.5 ? 'medium' : 'all'
        });
      }
    } catch (err) {
      console.error('Load settings error:', err);
    }
  };

  const saveSettings = async () => {
    try {
      const token = await getAuthToken();
      const payload = {
        email: settings.notificationEmail || user.username,
        preferences: {
          email_enabled: settings.enableAlerts,
          min_relevance: settings.alertThreshold === 'high' ? 0.8 : settings.alertThreshold === 'medium' ? 0.5 : 0.3,
          sources: ['PubMed', 'ClinicalTrials.gov', 'FDA', 'EMA', 'WIPO'],
          impact_levels: ['HIGH', 'MEDIUM', 'LOW']
        }
      };
      
      console.log('Saving settings to:', `${API_URL}user-settings`);
      console.log('Payload:', payload);
      
      const res = await fetch(`${API_URL}user-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify(payload)
      });
      
      console.log('Response status:', res.status);
      const responseText = await res.text();
      console.log('Response:', responseText);
      
      if (res.ok) {
        setError('✅ Settings saved successfully!');
        setTimeout(() => setError(''), 3000);
      } else {
        let errMsg = 'Failed to save';
        try {
          const errData = JSON.parse(responseText);
          errMsg = errData.error || errData.message || errMsg;
        } catch (e) {
          errMsg = responseText || errMsg;
        }
        throw new Error(errMsg);
      }
    } catch (err) {
      console.error('Save settings error:', err);
      setError('❌ ' + (err.message || 'Failed to save settings'));
    }
  };

  const addMolecule = async (e) => {
    e.preventDefault();
    if (!newMolecule.trim()) return;
    setError('');
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ userId: user.username, molecule: newMolecule })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.message || 'Failed to add molecule');
      }
      setNewMolecule('');
      await loadWatchlist();
    } catch (err) {
      console.error('Add molecule error:', err);
      setError(err.message || 'Failed to add molecule');
    }
  };

  const removeMolecule = async (molecule) => {
    try {
      const token = await getAuthToken();
      await fetch(`${API_URL}watchlist?userId=${user.username}&molecule=${molecule}`, {
        method: 'DELETE',
        headers: { Authorization: token }
      });
      loadWatchlist();
    } catch (err) {
      setError('Failed to remove molecule');
    }
  };

  if (!user) {
    return (
      <div className="App">
        <div className="auth-container">
          <h1>🧬 CI Alert System</h1>
          <p>Pharmaceutical Competitive Intelligence Platform</p>
          <form onSubmit={isSignUp ? handleSignUp : handleSignIn}>
            <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button type="submit" disabled={loading}>{isSignUp ? 'Sign Up' : 'Sign In'}</button>
          </form>
          <button onClick={() => setIsSignUp(!isSignUp)} className="toggle-btn">
            {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
          </button>
          {error && <p className="error">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <header>
        <h1>🧬 CI Alert System</h1>
        <div className="user-info">
          <span>{user.username}</span>
          <button onClick={handleSignOut} className="btn-secondary">Sign Out</button>
        </div>
      </header>

      <nav className="tabs">
        <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        <button className={activeTab === 'watchlist' ? 'active' : ''} onClick={() => setActiveTab('watchlist')}>Watchlist</button>
        <button className={activeTab === 'insights' ? 'active' : ''} onClick={() => setActiveTab('insights')}>Insights</button>
        <button className={activeTab === 'settings' ? 'active' : ''} onClick={() => setActiveTab('settings')}>Settings</button>
      </nav>

      <div className="content">
        {error && <div className="alert">{error}</div>}

        {activeTab === 'dashboard' && (
          <div className="dashboard">
            <h2>Dashboard</h2>
            <div className="stats">
              <div className="stat-card">
                <h3>{watchlist.length}</h3>
                <p>Molecules Tracked</p>
              </div>
              <div className="stat-card">
                <h3>{insights.length}</h3>
                <p>Total Insights</p>
              </div>
              <div className="stat-card">
                <h3>{settings.enableAlerts ? 'Active' : 'Paused'}</h3>
                <p>Alert Status</p>
              </div>
              <div className="stat-card">
                <h3>{settings.emailFrequency}</h3>
                <p>Email Frequency</p>
              </div>
            </div>
            <div className="recent-activity">
              <h3>Recent Insights</h3>
              {insights.slice(0, 5).map((insight, i) => (
                <div key={i} className="insight-preview">
                  <strong>{insight.molecule}</strong>
                  <p>{insight.summary?.substring(0, 150)}...</p>
                  <small>{new Date(insight.timestamp).toLocaleString()}</small>
                </div>
              ))}
              {insights.length === 0 && <p className="empty-state">No insights yet. Add molecules to start tracking.</p>}
            </div>
          </div>
        )}

        {activeTab === 'watchlist' && (
          <section className="watchlist-section">
            <h2>My Watchlist</h2>
            <form onSubmit={addMolecule} className="add-form">
              <input type="text" placeholder="Enter molecule name (e.g., pembrolizumab)" value={newMolecule} onChange={(e) => setNewMolecule(e.target.value)} />
              <button type="submit" className="btn-primary">Add Molecule</button>
            </form>
            {watchlist.length === 0 ? (
              <div className="empty-state">
                <p>No molecules in your watchlist yet.</p>
                <p>Add pharmaceutical molecules to track competitive intelligence.</p>
              </div>
            ) : (
              <ul className="molecule-list">
                {watchlist.map((item) => {
                  const mol = typeof item === 'string' ? item : item.molecule;
                  return (
                    <li key={mol}>
                      <span className="molecule-name">{mol}</span>
                      <button onClick={() => removeMolecule(mol)} className="btn-danger">Remove</button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {activeTab === 'insights' && (
          <section className="insights-section">
            <h2>All Insights</h2>
            {insights.length === 0 ? (
              <div className="empty-state">
                <p>No insights available yet.</p>
                <p>Add molecules to your watchlist to receive AI-powered competitive intelligence alerts.</p>
              </div>
            ) : (
              <div className="insights-list">
                {insights.map((insight, i) => (
                  <div key={i} className="insight-card">
                    <div className="insight-header">
                      <strong>{insight.molecule}</strong>
                      <span className="insight-date">{new Date(insight.timestamp).toLocaleDateString()}</span>
                    </div>
                    <p>{insight.summary}</p>
                    {insight.source && <small className="insight-source">Source: {insight.source}</small>}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'settings' && (
          <section className="settings-section">
            <h2>Settings</h2>
            <div className="settings-form">
              <div className="form-group">
                <label>Notification Email</label>
                <input 
                  type="email" 
                  value={settings.notificationEmail || user.username} 
                  onChange={(e) => setSettings({...settings, notificationEmail: e.target.value})}
                  placeholder={user.username}
                />
                <small>Email address where you'll receive alerts</small>
              </div>

              <div className="form-group">
                <label>Email Frequency</label>
                <select value={settings.emailFrequency} onChange={(e) => setSettings({...settings, emailFrequency: e.target.value})}>
                  <option value="immediate">Immediate (as they happen)</option>
                  <option value="daily">Daily Digest (9 AM)</option>
                  <option value="weekly">Weekly Summary (Monday 9 AM)</option>
                  <option value="never">Never (dashboard only)</option>
                </select>
              </div>

              <div className="form-group">
                <label>Alert Threshold</label>
                <select value={settings.alertThreshold} onChange={(e) => setSettings({...settings, alertThreshold: e.target.value})}>
                  <option value="all">All Updates</option>
                  <option value="medium">Medium & High Priority</option>
                  <option value="high">High Priority Only</option>
                </select>
                <small>Minimum importance level for alerts</small>
              </div>

              <div className="form-group checkbox">
                <label>
                  <input 
                    type="checkbox" 
                    checked={settings.enableAlerts} 
                    onChange={(e) => setSettings({...settings, enableAlerts: e.target.checked})}
                  />
                  Enable email alerts
                </label>
                <small>Uncheck to pause all email notifications</small>
              </div>

              <button onClick={saveSettings} className="btn-primary">Save Settings</button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export default App;
