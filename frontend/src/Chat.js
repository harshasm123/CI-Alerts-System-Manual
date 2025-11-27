import React, { useState, useRef, useEffect } from 'react';
import './Chat.css';

function Chat({ apiUrl, authToken }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
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
          sessionId: sessionId
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
        if (data.sessionId) setSessionId(data.sessionId);
      } else {
        setMessages(prev => [...prev, { role: 'error', content: data.error || 'Failed to get response' }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'error', content: 'Network error. Please try again.' }]);
    }

    setLoading(false);
  };

  const exampleQueries = [
    "What are the latest insights for Keytruda?",
    "Analyze sentiment trends for Opdivo over the past 30 days",
    "Compare Keytruda and Opdivo",
    "What FDA approvals happened recently?"
  ];

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h2>🤖 AI Assistant</h2>
        <p>Ask me anything about pharmaceutical competitive intelligence</p>
      </div>

      {messages.length === 0 && (
        <div className="chat-welcome">
          <h3>Try asking:</h3>
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
          <div key={i} className={`message ${msg.role}`}>
            <div className="message-avatar">
              {msg.role === 'user' ? '👤' : msg.role === 'error' ? '⚠️' : '🤖'}
            </div>
            <div className="message-content">
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message assistant">
            <div className="message-avatar">🤖</div>
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
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
          placeholder="Ask about molecules, trends, or insights..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}

export default Chat;
