import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Small delay to ensure browser extensions and scripts are loaded
setTimeout(() => {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
}, 0);
