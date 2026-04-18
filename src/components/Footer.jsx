import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <h3 className="text-gradient">EV-Net</h3>
            <p>Connecting the Electric Drive.</p>
          </div>
          <div className="footer-links">
            <a href="#problem">Problem</a>
            <a href="#solution">Solution</a>
            <a href="#how-it-works">How It Works</a>
          </div>
          <div className="footer-credit">
            <p>A Project</p>
            <p className="copyright">© 2026 EV-Net. All rights reserved.</p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
