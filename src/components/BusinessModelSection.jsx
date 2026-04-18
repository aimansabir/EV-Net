import React from 'react';
import { Percent, CreditCard, Sparkles } from 'lucide-react';
import './BusinessModelSection.css';

const BusinessModelSection = () => {
  return (
    <section className="section business-section">
      <div className="container">
        <h2 className="section-title text-center">Revenue Model</h2>
        <p className="text-center text-secondary" style={{ maxWidth: '600px', margin: '0 auto 3rem' }}>
          EV-Net is designed for sustainable growth, balancing value for hosts with platform scalability.
        </p>
        
        <div className="business-grid">
          <div className="glass-card b-card">
            <div className="b-icon-wrapper"><Percent size={32} /></div>
            <h4 className="b-title">Host Commission</h4>
            <p className="text-secondary" style={{ fontSize: '0.9rem' }}>A transparent, flat-rate deduction on payouts ensures we only earn when our hosts earn.</p>
          </div>
          <div className="glass-card b-card">
            <div className="b-icon-wrapper"><CreditCard size={32} /></div>
            <h4 className="b-title">EV User Service Fee</h4>
            <p className="text-secondary" style={{ fontSize: '0.9rem' }}>A nominal transaction fee applied at checkout to cover 24/7 support and platform security.</p>
          </div>
          <div className="glass-card b-card" style={{ borderColor: 'var(--brand-cyan)' }}>
            <div className="b-icon-wrapper" style={{ color: 'var(--brand-cyan)', background: 'rgba(0, 240, 255, 0.1)' }}><Sparkles size={32} /></div>
            <h4 className="b-title">Featured Placements</h4>
            <p className="text-secondary" style={{ fontSize: '0.9rem' }}>Premium visibility options for commercial charging partners and high-volume power hosts.</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BusinessModelSection;
