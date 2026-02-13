import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Heart, Users, Book, HelpCircle, LayoutDashboard, ClipboardCheck } from 'lucide-react';

const Footer = () => {
    const [visitorCount, setVisitorCount] = useState(0);
    const location = useLocation();

    useEffect(() => {
        // Fetch unique visitors
        fetch('/.netlify/functions/visitors')
            .then(res => res.json())
            .then(data => setVisitorCount(data.count || 0))
            .catch(err => console.error("Error fetching visitor count:", err));
    }, [location.pathname]); // Refresh on navigation to show latest if needed

    const navLinks = [
        { to: '/', label: 'Dashboard', icon: <LayoutDashboard className="w-3.5 h-3.5" />, color: 'gray' },
        { to: '/favourites', label: 'Kegemaran', icon: <Heart className="w-3.5 h-3.5 fill-red-500 text-red-500" />, color: 'red' },
        { to: '/sop', label: 'SOP', icon: <ClipboardCheck className="w-3.5 h-3.5" />, color: 'emerald' },
        { to: '/help', label: 'Bantuan', icon: <HelpCircle className="w-3.5 h-3.5" />, color: 'primary' },
        { to: '/journal', label: 'Buku Strategi', icon: <Book className="w-3.5 h-3.5" />, color: 'purple' },
    ];

    return (
        <footer className="fixed bottom-0 left-0 w-full bg-[#0a0a0c]/80 backdrop-blur-xl border-t border-white/5 py-3 px-6 flex flex-col md:flex-row justify-between items-center z-[100] gap-4">
            <div className="flex items-center gap-4 md:gap-8 flex-wrap justify-center">
                <div className="text-[10px] text-gray-500 uppercase tracking-widest font-black hidden lg:block">
                    &copy; 2026 B.R.S
                </div>

                <div className="flex items-center gap-4 md:gap-6">
                    {navLinks.map((link) => {
                        const isActive = location.pathname === link.to;
                        return (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`
                                    flex items-center gap-2 text-[10px] uppercase tracking-widest font-black transition-all group
                                    ${isActive
                                        ? `text-${link.color === 'primary' ? 'primary' : link.color + '-400'} border-b-2 border-current pb-1`
                                        : 'text-gray-500 hover:text-white pb-1 border-b-2 border-transparent'}
                                `}
                            >
                                <span className={`${isActive ? 'opacity-100' : 'opacity-50 group-hover:opacity-100'} transition-opacity`}>
                                    {link.icon}
                                </span>
                                {link.label}
                            </Link>
                        );
                    })}
                </div>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-gray-500 font-black bg-white/5 px-4 py-1.5 rounded-full border border-white/5 shadow-2xl">
                <Users className="w-3.5 h-3.5 text-primary" />
                <span className="tracking-tighter uppercase opacity-70">Pelawat Unik:</span>
                <span className="text-white font-mono">{(visitorCount || 0).toLocaleString()}</span>
            </div>
        </footer>
    );
};

export default Footer;
