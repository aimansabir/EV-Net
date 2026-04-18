import React from 'react';
import './ImpactSection.css';

const ImpactSection = () => {
  return (
    <section id="impact" className="section impact-section">
      <div className="container">
        <h2 className="section-title text-center">Why EV-Net Matters</h2>
        <div className="impact-grid">
          <div className="impact-item">
            <span className="impact-number">01</span>
            <p>Reduces EV range anxiety significantly</p>
          </div>
          <div className="impact-item">
            <span className="impact-number">02</span>
            <p>Makes EV ownership more practical and accessible</p>
          </div>
          <div className="impact-item">
            <span className="impact-number">03</span>
            <p>Turns private assets into a shared public utility</p>
          </div>
          <div className="impact-item">
            <span className="impact-number">04</span>
            <p>Supports Pakistan’s green mobility transition</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ImpactSection;
