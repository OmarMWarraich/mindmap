import CtaBanner from '../components/marketing/CtaBanner';
import FeaturesGrid from '../components/marketing/FeaturesGrid';
import HeroSection from '../components/marketing/HeroSection';
import LandingFooter from '../components/marketing/LandingFooter';
import LandingNav from '../components/marketing/LandingNav';
import PricingSection from '../components/marketing/PricingSection';
import ThreeSteps from '../components/marketing/ThreeSteps';

export default function LandingPage() {
  return (
    <>
      <LandingNav />
      <HeroSection />
      <ThreeSteps />
      <FeaturesGrid />
      <PricingSection />
      <CtaBanner />
      <LandingFooter />
    </>
  );
}
