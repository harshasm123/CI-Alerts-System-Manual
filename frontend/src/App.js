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
      region: REGION,
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

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (user) {
      loadWatchlist();
      loadInsights();
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
      await signUp({ username: email, password, options: { userAttributes: { email } } });
      setError('Sign up successful! Check your email for verification code, then sign in.');
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
      const data = await res.json();
      setWatchlist(data.watchlist || []);
    } catch (err) {
      console.error('Load watchlist error:', err);
    }
  };

  const loadInsights = async () => {
    try {
      const token = await getAuthToken();
      const res = await fetch(`${API_URL}insights`, {
        headers: { Authorization: token }
      });
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Load insights error:', err);
    }
  };

  const addMolecule = async (e) => {
    e.preventDefault();
    if (!newMolecule.trim()) return;
    try {
      const token = await getAuthToken();
      await fetch(`${API_URL}watchlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: token },
        body: JSON.stringify({ userId: user.username, molecule: newMolecule })
      });
      setNewMolecule('');
      loadWatchlist();
    } catch (err) {
      setError('Failed to add molecule');
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
          <h1>CI Alert System</h1>
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
        <h1>CI Alert System</h1>
        <div>
          <span>{user.username}</span>
          <button onClick={handleSignOut}>Sign Out</button>
        </div>
      </header>

      <div className="content">
        <section className="watchlist-section">
          <h2>My Watchlist</h2>
          <form onSubmit={addMolecule}>
            <input type="text" placeholder="Add molecule..." value={newMolecule} onChange={(e) => setNewMolecule(e.target.value)} />
            <button type="submit">Add</button>
          </form>
          <ul>
            {watchlist.map((mol) => (
              <li key={mol}>
                {mol}
                <button onClick={() => removeMolecule(mol)}>Remove</button>
              </li>
            ))}
          </ul>
        </section>

        <section className="insights-section">
          <h2>Recent Insights</h2>
          {insights.length === 0 ? (
            <p>No insights yet. Add molecules to your watchlist to receive alerts.</p>
          ) : (
            <ul>
              {insights.map((insight, i) => (
                <li key={i}>
                  <strong>{insight.molecule}</strong>
                  <p>{insight.summary}</p>
                  <small>{new Date(insight.timestamp).toLocaleString()}</small>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

export default App;
