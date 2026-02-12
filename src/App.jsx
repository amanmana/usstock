import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Help from './pages/Help';
import Favourites from './pages/Favourites';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/help" element={<Help />} />
                <Route path="/favourites" element={<Favourites />} />
            </Routes>
        </Router>
    );
}

export default App;
