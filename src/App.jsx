import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Help from './pages/Help';
import Favourites from './pages/Favourites';
import AdviceJournal from './pages/AdviceJournal';
import Footer from './components/Footer';

import SOP from './pages/SOP';

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/help" element={<Help />} />
                <Route path="/favourites" element={<Favourites />} />
                <Route path="/journal" element={<AdviceJournal />} />
                <Route path="/sop" element={<SOP />} />
            </Routes>
            <Footer />
        </Router>
    );
}

export default App;
