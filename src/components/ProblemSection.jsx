import React from 'react';
import './ProblemSection.css';

const ProblemSection = () => {
  return (
    <section id="problem" className="section problem-section">
      <div className="container">
        <div className="problem-header text-center">
          <h2 className="section-title">
            Pakistan’s EV Growth Is Being Held Back by<br/>
            <span className="text-gradient">Charging Infrastructure</span>
          </h2>
        </div>

        <div className="problem-grid">
          {/* Large Ratio Card */}
          <div className="glass-card ratio-card">
            <div className="ratio-badge">Critical Bottleneck</div>
            <h3 className="ratio-text">750:1</h3>
            <p className="ratio-desc">
              For every 750 electric vehicles on the road, there is only <strong>1 public charging station</strong>. 
              The majority of these stations are concentrated in major cities alone.
            </p>
          </div>

          {/* Right Column with bullets & small cards */}
          <div className="problem-details">
            <div className="pain-points">
              <h4>The Reality of EV Travel</h4>
              <ul className="bullet-list">
                <li><span className="bullet-icon">✗</span> <strong>Range Anxiety:</strong> Drivers fear running out of charge mid-journey.</li>
                <li><span className="bullet-icon">✗</span> <strong>Stranded in Cities:</strong> Inter-city travel (e.g. Karachi to Lahore) is virtually impossible.</li>
                <li><span className="bullet-icon">✗</span> <strong>Slow Expansion:</strong> Building new stations is extremely expensive and time-consuming.</li>
                <li><span className="bullet-icon">!</span> <strong>Missed Opportunity:</strong> Thousands of private home chargers remain completely unused for over 20 hours a day.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
