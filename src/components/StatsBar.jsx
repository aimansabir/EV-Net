import React from 'react';
import './StatsBar.css';

const StatCard = ({ number, label, highlight }) => (
  <div className={`stat-card ${highlight ? 'highlighted' : ''}`}>
    <div className="stat-number">{number}</div>
    <div className="stat-label">{label}</div>
  </div>
);

const StatsBar = () => {
  return (
    <section className="stats-section">
      <div className="container">
        <div className="stats-grid glass-card animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <StatCard number="75,000 +" label="EVs on the road" />
          <StatCard number="~ 100" label="Public Charging Stations" />
          <StatCard number="750 : 1" label="EV-to-Charger Ratio" highlight={true} />
          <StatCard number="20 + hours/day" label="Home Chargers Sit Idle" />
        </div>
      </div>
    </section>
  );
};

export default StatsBar;
