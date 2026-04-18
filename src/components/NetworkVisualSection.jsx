import React from 'react';
import './NetworkVisualSection.css';
import networkImage from '../assets/ev_network_visual.png';

const NetworkVisualSection = () => {
  return (
    <section className="section network-visual-section" id="network">
      <div className="container" style={{ position: 'relative' }}>
        <div className="network-visual-header text-center" style={{ marginBottom: '3rem' }}>
          <h2 className="section-title">Envisioning the Future</h2>
          <p className="solution-intro" style={{ maxWidth: '700px', margin: '0 auto', color: 'var(--text-secondary)' }}>
            EV-Net ensures you are never too far from your next charge.
          </p>
        </div>

        <div className="visual-wrapper">
          <div className="glow-backdrop"></div>
          <img src={networkImage} alt="EV Network Map Visual" className="network-image" />

          <div className="floating-stat stat-1 glass-card">
            <span className="stat-value text-gradient">24/7</span>
            <span className="stat-label">Availability</span>
          </div>
          <div className="floating-stat stat-2 glass-card">
            <span className="stat-value" style={{ color: 'var(--brand-cyan)' }}>100%</span>
            <span className="stat-label">Scalability</span>
          </div>
          <div className="floating-stat stat-3 glass-card">
            <span className="stat-value text-gradient">Zero</span>
            <span className="stat-label">Range Anxiety</span>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NetworkVisualSection;
