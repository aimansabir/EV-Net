import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PlugZap, Home } from 'lucide-react';
import useAuthStore from '../store/authStore';
import './SolutionSection.css';

const SolutionSection = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role, isInitialized } = useAuthStore();
  return (
    <section id="solution" className="section solution-section">
      <div className="container">

        <div className="solution-header text-center">
          <h2 className="section-title">Introducing EV-Net</h2>
          <p className="solution-intro">
            EV-Net is a website-based peer-to-peer EV charging marketplace that connects households with idle home chargers to EV users who need convenient charging access. Instead of building new stations from scratch, the platform unlocks existing private chargers, making EV travel more practical, scalable, and accessible across Pakistan.
          </p>
        </div>

        <div className="solution-columns">
          <div className="glass-card solution-card user-card">
            <div className="card-icon gradient-border">
              <span className="icon-inner">
                <PlugZap size={32} strokeWidth={2.25} />
              </span>
            </div>

            <div className="card-content-wrapper">
              <h3 className="card-title">For EV Users</h3>
              <ul className="benefit-list">
                <li>Search nearby charging spots on the map</li>
                <li>Compare pricing, speed, and availability</li>
                <li>Book and reserve a convenient charging slot</li>
                <li>Travel long distances with zero range anxiety</li>
              </ul>
            </div>

            <div className="card-actions" style={{ minHeight: '44px' }}>
              {!isInitialized ? null : isAuthenticated ? (
                role === 'host' ? null : (
                  <button className="btn btn-secondary w-100" onClick={() => navigate('/app/explore')}>Go to Explore</button>
                )
              ) : (
                <button className="btn btn-secondary w-100" onClick={() => navigate('/signup/user')}>Explore Chargers</button>
              )}
            </div>
          </div>

          <div className="glass-card solution-card host-card">
            <div className="card-icon gradient-border">
              <span className="icon-inner">
                <Home size={32} strokeWidth={2.25} />
              </span>
            </div>

            <div className="card-content-wrapper">
              <h3 className="card-title">For Hosts</h3>
              <ul className="benefit-list">
                <li>List your home charger online in minutes</li>
                <li>Set your own custom availability and pricing</li>
                <li>Accept bookings and manage sessions easily</li>
                <li>Earn passive income from an idle asset</li>
              </ul>
            </div>

            <div className="card-actions" style={{ minHeight: '44px' }}>
              {!isInitialized ? null : isAuthenticated ? (
                role === 'host' ? (
                  <button className="btn btn-primary w-100" onClick={() => navigate('/host/dashboard')}>Go to Dashboard</button>
                ) : null
              ) : (
                <button className="btn btn-primary w-100" onClick={() => navigate('/signup/host')}>Become a Host</button>
              )}
            </div>
          </div>
        </div>

      </div>
    </section>
  );
};

export default SolutionSection;
