import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Help from './pages/Help';
import BursaDashboard from './pages/BursaDashboard';
import Favourites from './pages/Favourites';
import AdviceJournal from './pages/AdviceJournal';
import TradeLog from './pages/TradeLog';
import Footer from './components/Footer';

import SOP from './pages/SOP';
import StockManager from './pages/StockManager';

import Login from './pages/Login';

function App() {
    const [isAuthenticated, setIsAuthenticated] = React.useState(
        localStorage.getItem('brs_auth') === 'true'
    );

    const handleLogin = () => {
        localStorage.setItem('brs_auth', 'true');
        setIsAuthenticated(true);
    };

    if (!isAuthenticated) return <Login onLogin={handleLogin} />;

    return (
        <Router>
            <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/bursa" element={<BursaDashboard />} />
                <Route path="/help" element={<Help />} />
                <Route path="/favourites" element={<Favourites />} />
                <Route path="/tradelog" element={<TradeLog />} />
                <Route path="/journal" element={<AdviceJournal />} />
                <Route path="/sop" element={<SOP />} />
                <Route path="/stock-manager" element={<StockManager />} />
            </Routes>
            <Footer />
        </Router>
    );
}

export default App;
