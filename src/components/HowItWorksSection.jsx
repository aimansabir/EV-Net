import React from 'react';
import './HowItWorksSection.css';

const StepCard = ({ number, title, desc }) => (
  <div className="step-card">
    <div className="step-number">{number}</div>
    <div className="step-content">
      <h4>{title}</h4>
      <p>{desc}</p>
    </div>
  </div>
);

const HowItWorksSection = () => {
  return (
    <section id="how-it-works" className="section how-it-works-section">
      <div className="container">
        <h2 className="section-title text-center">How It Works</h2>
        
        <div className="flows-container">
          <div className="flow-column">
            <h3 className="flow-title">For EV Users</h3>
            <div className="steps-wrapper user-steps">
              <StepCard number="1" title="Search Chargers" desc="Find nearby charging spots on our online platform." />
              <StepCard number="2" title="View Availability" desc="Check real-time status and pricing details." />
              <StepCard number="3" title="Book a Slot" desc="Reserve your preferred charging time securely." />
              <StepCard number="4" title="Visit & Charge" desc="Arrive at the location and charge your EV." />
            </div>
          </div>

          <div className="flow-column">
            <h3 className="flow-title">For Hosts</h3>
            <div className="steps-wrapper host-steps">
              <StepCard number="1" title="Create Listing" desc="Sign up and add your charger to the network." />
              <StepCard number="2" title="Add Details" desc="Set your availability schedule and pricing." />
              <StepCard number="3" title="Receive Bookings" desc="Accept requests from verified EV drivers." />
              <StepCard number="4" title="Earn Income" desc="Get paid for sharing your existing asset." />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
