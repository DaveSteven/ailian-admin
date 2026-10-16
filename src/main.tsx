import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { store } from './store';
import './styles.css';

const basename = window.location.hostname === 'admin.ailian.help' ? undefined : '/admin';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Provider store={store}><BrowserRouter basename={basename}><App /></BrowserRouter></Provider></React.StrictMode>);
