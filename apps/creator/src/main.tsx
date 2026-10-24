import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CreatorApp } from './app/CreatorApp';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Creator root element is missing.');
createRoot(root).render(<StrictMode><CreatorApp /></StrictMode>);
