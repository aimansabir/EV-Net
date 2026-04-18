import React from 'react';
import './TeamSection.css';

const TeamCard = ({ name }) => (
  <div className="team-card glass-card">
    <div className="team-avatar"></div>
    <h4 className="team-name">{name}</h4>
    <p className="team-role">Co-Founder</p>
  </div>
);

const TeamSection = () => {
  return (
    <section id="team" className="section team-section">
      <div className="container">
        <h2 className="section-title text-center">Meet the Team</h2>
        <p className="text-center" style={{color: 'var(--text-secondary)', marginBottom: '3rem'}}>Group 12 - Driving the Future of Sustainable Mobility</p>
        
        <div className="team-grid">
          <TeamCard name="Esharib Bin Safwan" />
          <TeamCard name="Saif Shehzad" />
          <TeamCard name="Aiman Gul Sabir" />
          <TeamCard name="Suman Baig" />
        </div>
      </div>
    </section>
  );
};

export default TeamSection;
