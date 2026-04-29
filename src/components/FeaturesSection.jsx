import React from 'react';
import { MapPin, CalendarCheck, ShieldCheck, Wallet, BatteryCharging, Clock } from 'lucide-react';
import './FeaturesSection.css';

const FeatureCard = ({ icon, title, description }) => {
  const FeatureIcon = icon;
  return (
    <div className="feature-card glass-card">
      <div className="feature-icon-wrapper">
        <FeatureIcon className="feature-icon" size={32} />
      </div>
      <div className="feature-content">
        <h4 className="feature-title">{title}</h4>
        <p className="feature-desc">{description}</p>
      </div>
    </div>
  );
};

const FeaturesSection = () => {
  return (
    <section id="features" className="section features-section">
      <div className="container">
        <h2 className="section-title text-center">Built for Scale and Simplicity</h2>
        <p className="section-subtitle text-center">Everything you need to find, book, and monetize EV charging effortlessly.</p>
        
        <div className="features-grid">
          <FeatureCard 
            icon={MapPin} 
            title="Interactive Discovery Map" 
            description="Find available home and public chargers near you instantly. Filter by connector type, charging speed, and availability."
          />
          <FeatureCard 
            icon={CalendarCheck} 
            title="Smart Scheduling" 
            description="Book specific time slots to guarantee your charge. No more arriving at a public station to find it occupied."
          />
          <FeatureCard 
            icon={ShieldCheck} 
            title="Verified Hosts" 
            description="Our hosts undergo a review process to ensure safety and reliability. Trust is at the core of the EV-Net network."
          />
          <FeatureCard 
            icon={Wallet} 
            title="Seamless Payments" 
            description="Secure, transparent transactions. Pay through the app with no hidden fees and instant host payouts."
          />
          <FeatureCard 
            icon={BatteryCharging} 
            title="Real-Time Status" 
            description="Get notified when your booking starts, completes, or if the host makes any updates to their listing."
          />
          <FeatureCard 
            icon={Clock} 
            title="Automated Availability" 
            description="Hosts can set recurring availability schedules so their charger is automatically listed when they are at work or asleep."
          />
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
