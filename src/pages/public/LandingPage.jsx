import React from 'react';
import Navbar from '../../components/Navbar';
import HeroSection from '../../components/HeroSection';
import StatsBar from '../../components/StatsBar';
import ProblemSection from '../../components/ProblemSection';
import SolutionSection from '../../components/SolutionSection';
import HowItWorksSection from '../../components/HowItWorksSection';
import MarketplacePreview from '../../components/MarketplacePreview';
import FeaturesSection from '../../components/FeaturesSection';
import BusinessModelSection from '../../components/BusinessModelSection';
import ImpactSection from '../../components/ImpactSection';
import NetworkVisualSection from '../../components/NetworkVisualSection';
import FinalCTASection from '../../components/FinalCTASection';
import Footer from '../../components/Footer';

const LandingPage = () => {
  return (
    <div className="App">
      <Navbar />
      <HeroSection />
      <StatsBar />
      <ProblemSection />
      <SolutionSection />
      <HowItWorksSection />
      <MarketplacePreview />
      <FeaturesSection />
      <BusinessModelSection />
      <ImpactSection />
      <NetworkVisualSection />
      <FinalCTASection />
      <Footer />
    </div>
  );
};

export default LandingPage;
