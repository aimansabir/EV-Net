import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, MapPin, CreditCard, Wallet, Users, Zap } from 'lucide-react';
import logoUrl from '../../assets/logo.png';
const AuthShell = ({ children, title, subtitle, role = 'login' }) => {

  const getPanelContent = () => {
    switch (role) {
      case 'user':
        return {
          headline: 'Drive Without Limits',
          subtext: 'Access verified chargers at secure host locations across Pakistan.',
          bullets: [
            { icon: <ShieldCheck size={20} />, text: 'Verified Chargers & Safe Locations' },
            { icon: <CreditCard size={20} />, text: 'Transparent Pricing & Instant Booking' },
            { icon: <MapPin size={20} />, text: 'Find Charging Anywhere You Go' },
          ]
        };
      case 'host':
        return {
          headline: 'Monetize Your Driveway',
          subtext: 'Turn your home charger into a revenue stream while supporting the EV ecosystem.',
          bullets: [
            { icon: <Wallet size={20} />, text: 'Earn Extra Income Effortlessly' },
            { icon: <Users size={20} />, text: 'Secure Marketplace with Trusted Guests' },
            { icon: <Zap size={20} />, text: 'Complete Control Over Your Schedule' },
          ]
        };
      default: // login
        return {
          headline: "Powering Pakistan's EV Future",
          subtext: 'Join the thousands already sharing and charging across the nation.',
          bullets: [
            { icon: <ShieldCheck size={20} />, text: 'Pakistan\'s Largest Verified Network' },
            { icon: <Zap size={20} />, text: 'Smart Discovery & Connector Matching' },
            { icon: <CreditCard size={20} />, text: 'Protected Payouts & Secure Payments' },
          ]
        };
    }
  };

  const panel = getPanelContent();

  return (
    <div className="auth-wrapper">
      {/* Left Panel: Trust & Brand */}
      <div className="auth-panel-left">
        <div className="auth-panel-glow" />
        <div className="auth-panel-illustration">
          <Zap size={400} strokeWidth={0.5} />
        </div>
        <div className="auth-panel-content">
          <div className="auth-panel-badge">Marketplace MVP</div>
          <h1 className="auth-panel-headline">{panel.headline}</h1>
          <p className="auth-panel-subtext">{panel.subtext}</p>

          <div className="auth-panel-bullets">
            {panel.bullets.map((b, i) => (
              <div key={i} className="auth-panel-bullet">
                <div className="bullet-icon">{b.icon}</div>
                <span>{b.text}</span>
              </div>
            ))}
          </div>

          <div className="auth-panel-footer">
            <div className="trust-indicator">
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel: Actions */}
      <div className="auth-panel-right">
        <div className="auth-panel-actions-wrapper">
          <Link to="/" className="auth-back-link">
            <ArrowLeft size={16} />
            Back to Home
          </Link>

          <div className="auth-right-content">
            <Link to="/" className="auth-logo" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
              <img src={logoUrl} alt="EV-Net Logo" style={{ height: '48px', width: 'auto' }} />
            </Link>

            <div className="auth-header">
              <h2>{title}</h2>
              <p>{subtitle}</p>
            </div>

            <div className="auth-children">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthShell;
