import React from 'react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import './FinalCTASection.css';

const FinalCTASection = () => {
  const navigate = useNavigate();
  const { isAuthenticated, role, isInitialized } = useAuthStore();

  return (
    <section className="cta-section">
      <div className="container">
        <div className="cta-box glass-card text-center">
          <h2>Ready to Explore EV-Net?</h2>
          <p>Join the movement bridging Pakistan’s charging gap.</p>
          <div className="cta-actions" style={{ minHeight: '44px' }}>
            {!isInitialized ? null : isAuthenticated ? (
              <button 
                className="btn btn-primary" 
                onClick={() => navigate(role === 'host' ? '/host/dashboard' : role === 'admin' ? '/admin' : '/app/explore')}
                style={{ width: '220px' }}
              >
                {role === 'host' ? 'Go to Host Dashboard' : role === 'admin' ? 'Go to Admin Console' : 'Go to Explore'}
              </button>
            ) : (
              <>
                <button className="btn btn-primary" style={{ marginRight: '1rem' }} onClick={() => navigate('/signup/user')}>Explore the Platform</button>
                <button className="btn btn-secondary" onClick={() => navigate('/signup/host')}>Become a Charging Host</button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FinalCTASection;
