import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Help from './components/Help';
import useKeyboardShortcuts from './hooks/useKeyboardShortcuts';

function AppRoutes() {
  useKeyboardShortcuts();

  return (
    <Routes>
      <Route path="/help" element={<Help />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AppRoutes />
    </Router>
  );
}
