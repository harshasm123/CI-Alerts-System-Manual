import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

function Chat({ apiUrl, authToken }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [ragMode, setRagMode] = useState('hybrid');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    // Initialize with welcome message
    setMessages([{
      role: 'assistant',
      content: '🧬 Welcome to your AI-powered Pharmaceutical Intelligence Assistant!\n\nI have access to:\n• 📚 RAG Knowledge Base with clinical documents\n• 🔍 Real-time insights from your watchlist\n• 📊 Historical data and trends\n• 🏥 FDA approvals and regulatory updates\n\nHow can I help you today?',
      timestamp: new Date().toLocaleTimeString(),
      type: 'welcome'
    }]);
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  }, []);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { 
      role: 'user', 
      content: userMessage,
      timestamp: new Date().toLocaleTimeString()
    }]);
    setLoading(true);

    try {
      const response = await fetch(`${apiUrl}agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authToken
        },
        body: JSON.stringify({
          query: userMessage,
          sessionId: sessionId,
          ragMode: ragMode,
          context: {
            timestamp: new Date().toISOString()
          }
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.response || data.message,
          timestamp: new Date().toLocaleTimeString(),
          sources: data.sources || [],
          citations: data.citations || [],
          confidence: data.confidence
        }]);
        if (data.sessionId) setSessionId(data.sessionId);
      } else {
        setMessages(prev => [...prev, { 
          role: 'error', 
          content: data.error || 'Failed to get response',
          timestamp: new Date().toLocaleTimeString()
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        role: 'error', 
        content: '❌ Network error. Please check your connection and try again.',
        timestamp: new Date().toLocaleTimeString()
      }]);
    }

    setLoading(false);
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: '🔄 Chat cleared. How can I help you?',
      timestamp: new Date().toLocaleTimeString()
    }]);
    setSessionId(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  };

  const exampleQueries = [
    "What are the latest clinical trial results for Keytruda?",
    "Compare the efficacy of Opdivo vs Keytruda in lung cancer",
    "What FDA approvals happened in the last 30 days?",
    "Analyze the competitive landscape for CAR-T therapies",
    "What are the patent expiration dates for top oncology drugs?",
    "Show me biosimilar competition for Humira"
  ];

  const formatMessage = (content) => {
    return content.split('\n').map((line, index) => (
      <div key={index}>{line}</div>
    ));
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-content">
          <h2>🤖 AI Assistant</h2>
          <p>Powered by AWS Bedrock Agent with RAG Knowledge Base</p>
        </div>
        <div className="header-controls">
          <select 
            value={ragMode} 
            onChange={(e) => setRagMode(e.target.value)}
            className="rag-mode-select"
          >
            <option value="hybrid">🔍 Hybrid Search</option>
            <option value="semantic">🧠 Semantic Search</option>
            <option value="keyword">📝 Keyword Search</option>
          </select>
          <button onClick={clearChat} className="clear-button">🗑️ Clear</button>
        </div>
      </div>

      {messages.length <= 1 && (
        <div className="chat-welcome">
          <h3>💡 Try these queries:</h3>
          <div className="example-queries">
            {exampleQueries.map((query, i) => (
              <button
                key={i}
                className="example-query"
                onClick={() => setInput(query)}
              >
                {query}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="chat-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role} ${msg.type || ''}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : msg.role === 'error' ? '⚠️' : '🤖'}
            </div>
            <div className="message-content">
              <div className="message-text">
                {formatMessage(msg.content)}
              </div>
              
              {msg.confidence && (
                <div className="confidence-score">
                  <span className="confidence-label">Confidence:</span>
                  <div className="confidence-bar">
                    <div 
                      className="confidence-fill" 
                      style={{ width: `${msg.confidence * 100}%` }}
                    ></div>
                  </div>
                  <span className="confidence-value">{Math.round(msg.confidence * 100)}%</span>
                </div>
              )}
              
              {msg.citations && msg.citations.length > 0 && (
                <div className="message-citations">
                  <strong>📚 Knowledge Base Citations:</strong>
                  <div className="citations-list">
                    {msg.citations.map((citation, index) => (
                      <div key={index} className="citation-item">
                        <div className="citation-text">"{citation.text}"</div>
                        <div className="citation-source">
                          📄 {citation.source}
                          {citation.score && <span className="citation-score">({Math.round(citation.score * 100)}% match)</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {msg.sources && msg.sources.length > 0 && (
                <div className="message-sources">
                  <strong>🔗 External Sources:</strong>
                  <ul>
                    {msg.sources.map((source, index) => (
                      <li key={index}>
                        <a href={source.url} target="_blank" rel="noopener noreferrer">
                          {source.title || source.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              {msg.timestamp && (
                <div className="message-time">{msg.timestamp}</div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span>🔍 Searching knowledge base</span>
                <div className="dots">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about molecules, clinical trials, FDA approvals, market analysis..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          {loading ? '⏳' : '🚀'} Send
        </button>
      </form>
      
      <div className="chat-footer">
        <div className="rag-status">
          <span className="status-indicator active"></span>
          <span>RAG Knowledge Base: Active</span>
          <span className="separator">•</span>
          <span>Mode: {ragMode}</span>
          <span className="separator">•</span>
          <span>Session: {sessionId?.slice(-8)}</span>
        </div>
      </div>
    </div>
  );
}

export default Chat;
