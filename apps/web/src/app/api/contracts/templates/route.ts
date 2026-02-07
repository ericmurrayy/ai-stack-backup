/**
 * Contract Templates API
 * ======================
 * Get pre-defined contract templates
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Pre-defined contract templates
const contractTemplates = [
  {
    id: 'hvac-maintenance',
    name: 'HVAC Maintenance Agreement',
    description: 'Annual HVAC system maintenance with priority service',
    billing_frequency: 'annual',
    duration_months: 12,
    base_price: 299,
    services: [
      {
        id: 'hvac-tune-up',
        name: 'Seasonal Tune-Up',
        description: 'Complete system inspection and tune-up',
        frequency: 'quarterly',
        estimated_duration: 90,
        included_visits: 2,
      },
      {
        id: 'filter-replace',
        name: 'Filter Replacement',
        description: 'Standard filter replacement',
        frequency: 'quarterly',
        estimated_duration: 15,
        included_visits: 4,
      },
    ],
    benefits: [
      'Priority emergency scheduling',
      '15% parts discount',
      '10% repair discount',
      '2 seasonal tune-ups included',
      '4 filter replacements included',
    ],
    terms_summary: 'Auto-renews annually. Cancel with 30 days notice.',
  },
  {
    id: 'plumbing-protection',
    name: 'Plumbing Protection Plan',
    description: 'Comprehensive plumbing coverage with annual inspection',
    billing_frequency: 'annual',
    duration_months: 12,
    base_price: 199,
    services: [
      {
        id: 'plumbing-inspection',
        name: 'Annual Plumbing Inspection',
        description: 'Full system inspection including water heater',
        frequency: 'annual',
        estimated_duration: 60,
        included_visits: 1,
      },
      {
        id: 'drain-cleaning',
        name: 'Drain Cleaning',
        description: 'Main line drain cleaning',
        frequency: 'as_needed',
        estimated_duration: 45,
        included_visits: 1,
      },
    ],
    benefits: [
      '24/7 emergency service',
      'Up to $500/year repair coverage',
      '15% service discount',
      'Annual inspection included',
      'Drain cleaning included',
    ],
    terms_summary: 'No refunds after 6 months. Cancel with 30 days notice.',
  },
  {
    id: 'electrical-safety',
    name: 'Electrical Safety Plan',
    description: 'Annual electrical inspection and safety check',
    billing_frequency: 'annual',
    duration_months: 12,
    base_price: 249,
    services: [
      {
        id: 'electrical-inspection',
        name: 'Electrical Safety Inspection',
        description: 'Complete home electrical inspection',
        frequency: 'annual',
        estimated_duration: 90,
        included_visits: 1,
      },
      {
        id: 'panel-check',
        name: 'Panel Check',
        description: 'Breaker panel inspection and tightening',
        frequency: 'annual',
        estimated_duration: 30,
        included_visits: 1,
      },
    ],
    benefits: [
      'Comprehensive safety report',
      'Priority scheduling',
      '10% repair discount',
      'Free upgrade estimates',
      'Annual inspection included',
    ],
    terms_summary: 'Cancel anytime with prorated refund.',
  },
  {
    id: 'total-home',
    name: 'Total Home Protection',
    description: 'Complete coverage: HVAC, Plumbing, and Electrical',
    billing_frequency: 'monthly',
    duration_months: 12,
    base_price: 49,
    services: [
      {
        id: 'hvac-tune-up',
        name: 'HVAC Tune-Up',
        frequency: 'quarterly',
        estimated_duration: 90,
        included_visits: 2,
      },
      {
        id: 'plumbing-inspection',
        name: 'Plumbing Inspection',
        frequency: 'annual',
        estimated_duration: 60,
        included_visits: 1,
      },
      {
        id: 'electrical-inspection',
        name: 'Electrical Inspection',
        frequency: 'annual',
        estimated_duration: 60,
        included_visits: 1,
      },
    ],
    benefits: [
      '24/7 emergency service',
      '20% all repairs discount',
      'No service call fees',
      'No deductibles',
      'Transferable to new owner',
      'All systems covered',
    ],
    terms_summary: 'Cancel anytime. No long-term commitment.',
  },
  {
    id: 'commercial-basic',
    name: 'Commercial Basic Plan',
    description: 'Essential maintenance for small businesses',
    billing_frequency: 'quarterly',
    duration_months: 12,
    base_price: 399,
    services: [
      {
        id: 'commercial-hvac',
        name: 'Commercial HVAC Service',
        frequency: 'quarterly',
        estimated_duration: 120,
        included_visits: 4,
      },
      {
        id: 'commercial-plumbing',
        name: 'Commercial Plumbing Check',
        frequency: 'quarterly',
        estimated_duration: 60,
        included_visits: 4,
      },
    ],
    benefits: [
      'Same-day emergency response',
      '25% parts discount',
      '15% labor discount',
      'Quarterly maintenance visits',
      'Detailed service reports',
    ],
    terms_summary: '12-month commitment. 60 days notice to cancel.',
  },
];

/**
 * GET /api/contracts/templates
 * Get all contract templates
 */
export async function GET() {
  return NextResponse.json({ templates: contractTemplates });
}
